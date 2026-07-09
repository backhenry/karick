import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  GameRoom,
  Player,
  ServerToClientEvents,
  SocketData,
} from '@karick/shared';
import { MAX_NICKNAME_LENGTH, validateQuiz } from '@karick/shared';
import { generatePin, type RoomStore } from '../store/roomStore.js';
import type { HistoryRepository } from '../store/historyRepository.js';
import { RateLimiter } from '../util/rateLimiter.js';
import {
  allPlayersAnswered,
  buildDistribution,
  buildLeaderboard,
  buildRevealLeaderboard,
  computeScore,
  currentQuestion,
  hasMoreQuestions,
  streakBonus,
} from './gameService.js';
import { AVATARS, ADD_TIME_SECONDS } from '@karick/shared';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Timers autoritativos, fora do objeto GameRoom (não são serializáveis).
 * Débito técnico para escala: mover para BullMQ/Redis para sobreviver a restart.
 */
const timers = new Map<string, NodeJS.Timeout>();

// Rate limiting anti-flood, por endereço (janela de 1 min).
const createRoomLimiter = new RateLimiter(15, 60_000);
const joinLimiter = new RateLimiter(40, 60_000);
const answerLimiter = new RateLimiter(120, 60_000);

function clearRoomTimer(pin: string) {
  const t = timers.get(pin);
  if (t) {
    clearTimeout(t);
    timers.delete(pin);
  }
}

export function registerGameGateway(io: IO, store: RoomStore, history: HistoryRepository) {
  function broadcastLobby(room: GameRoom) {
    const players = Object.values(room.players).map((p) => ({
      nickname: p.nickname,
      score: p.score,
      avatar: p.avatar,
    }));
    io.to(room.pin).emit('lobby:updated', { players, count: players.length });
  }

  /** Envia ao jogador (re)conectado o estado atual, para cair na tela certa. */
  function sendSync(room: GameRoom, player: Player, socket: IOSocket) {
    if (room.status === 'FINISHED') return socket.emit('game:sync', { screen: 'OVER' });
    const q = currentQuestion(room);

    if (room.status === 'QUESTION' && q) {
      const remainingSec = room.questionEndsAt
        ? Math.max(0, Math.round((room.questionEndsAt - Date.now()) / 1000))
        : q.timeLimitSec;
      const question = {
        index: room.currentQuestionIndex,
        total: room.quiz.questions.length,
        optionsCount: q.options.length,
        timeLimitSec: q.timeLimitSec,
        imageUrl: q.imageUrl,
      };
      return socket.emit('game:sync', {
        screen: player.currentAnswer ? 'ANSWERED' : 'QUESTION',
        question,
        remainingSec,
      });
    }

    if (room.status === 'REVEAL' && room.lastReveal) {
      const row = room.lastReveal.leaderboard.find((r) => r.nickname === player.nickname);
      return socket.emit('game:sync', {
        screen: 'FEEDBACK',
        reveal: {
          correctIndex: room.lastReveal.correctIndex,
          correctText: room.lastReveal.correctText,
          rank: row?.rank,
          gained: row?.gained,
          score: row?.score,
        },
        answered: player.currentAnswer ? { isCorrect: player.currentAnswer.isCorrect } : undefined,
      });
    }

    return socket.emit('game:sync', { screen: 'LOBBY' });
  }

  function sendQuestion(room: GameRoom) {
    const q = currentQuestion(room);
    if (!q) return endGame(room);

    room.status = 'QUESTION';
    room.questionStartedAt = Date.now();
    room.questionEndsAt = Date.now() + q.timeLimitSec * 1000;
    Object.values(room.players).forEach((p) => (p.currentAnswer = null));

    io.to(room.hostSocketId).emit('game:question:host', {
      index: room.currentQuestionIndex,
      total: room.quiz.questions.length,
      text: q.text,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      correctIndex: q.correctIndex,
      imageUrl: q.imageUrl,
    });

    Object.values(room.players).forEach((p) => {
      io.to(p.socketId).emit('game:question:player', {
        index: room.currentQuestionIndex,
        total: room.quiz.questions.length,
        optionsCount: q.options.length,
        timeLimitSec: q.timeLimitSec,
        imageUrl: q.imageUrl,
      });
    });

    clearRoomTimer(room.pin);
    timers.set(room.pin, setTimeout(() => revealAnswer(room), q.timeLimitSec * 1000));
  }

  function revealAnswer(room: GameRoom) {
    clearRoomTimer(room.pin);
    if (room.status !== 'QUESTION') return; // já revelada
    room.status = 'REVEAL';
    const q = currentQuestion(room);
    const distribution = q ? buildDistribution(room, q.options.length) : [];
    const payload = {
      correctIndex: q ? q.correctIndex : -1,
      correctText: q ? q.options[q.correctIndex] : '',
      distribution,
      leaderboard: buildRevealLeaderboard(room),
    };
    room.lastReveal = payload;
    if (q) {
      room.stats.push({
        text: q.text,
        correctCount: distribution[q.correctIndex] ?? 0,
        answered: distribution.reduce((a, b) => a + b, 0),
        total: Object.keys(room.players).length,
      });
    }
    io.to(room.pin).emit('game:reveal', payload);
  }

  function endGame(room: GameRoom) {
    clearRoomTimer(room.pin);
    room.status = 'FINISHED';
    const leaderboard = buildLeaderboard(room);
    io.to(room.pin).emit('game:over', { podium: leaderboard.slice(0, 3), stats: room.stats });

    // Registra a partida no histórico (best-effort — não derruba o jogo se falhar).
    if (leaderboard.length > 0) {
      history
        .record({ quizTitle: room.quiz.title, pin: room.pin, players: leaderboard })
        .catch((err) => console.error('Falha ao gravar histórico:', err));
    }
  }

  io.on('connection', (socket: IOSocket) => {
    // ─── HOST: cria a sala ───────────────────────────────
    socket.on('host:createRoom', ({ quiz }, ack) => {
      if (!createRoomLimiter.allow(socket.handshake.address)) {
        return ack?.({ ok: false, error: 'Muitas salas criadas, aguarde um instante.' });
      }
      const err = validateQuiz(quiz);
      if (err) return ack?.({ ok: false, error: err });

      const pin = generatePin(store);
      const room: GameRoom = {
        pin,
        hostSocketId: socket.id,
        quiz: { id: pin, title: quiz.title.trim(), questions: quiz.questions },
        status: 'LOBBY',
        currentQuestionIndex: -1,
        questionStartedAt: null,
        questionEndsAt: null,
        stats: [],
        players: {},
      };
      store.create(room);
      socket.join(pin);
      socket.data.pin = pin;
      socket.data.role = 'host';
      ack?.({ ok: true, pin });
    });

    // ─── PLAYER: entra na sala (ou reconecta) ────────────
    socket.on('player:join', ({ pin, nickname, avatar, playerId }, ack) => {
      if (!joinLimiter.allow(socket.handshake.address)) {
        return ack?.({ ok: false, error: 'Muitas tentativas, aguarde um instante.' });
      }
      const room = store.get(pin);
      if (!room) return ack?.({ ok: false, error: 'Sala não encontrada' });
      if (!playerId) return ack?.({ ok: false, error: 'Identificador ausente' });

      const existing = room.players[playerId];
      if (existing) {
        // Reconexão: religa o socket e re-sincroniza o estado atual.
        existing.socketId = socket.id;
        existing.connected = true;
        socket.join(pin);
        socket.data.pin = pin;
        socket.data.role = 'player';
        socket.data.playerId = playerId;
        ack?.({ ok: true });
        sendSync(room, existing, socket);
        broadcastLobby(room);
        return;
      }

      // Novo jogador só entra no lobby.
      if (room.status !== 'LOBBY') return ack?.({ ok: false, error: 'Jogo já iniciado' });
      const clean = nickname?.trim().slice(0, MAX_NICKNAME_LENGTH);
      if (!clean) return ack?.({ ok: false, error: 'Apelido inválido' });
      const taken = Object.values(room.players).some((p) => p.nickname === clean);
      if (taken) return ack?.({ ok: false, error: 'Apelido já em uso' });

      const chosenAvatar = (avatar && AVATARS.includes(avatar as (typeof AVATARS)[number]))
        ? avatar
        : AVATARS[Math.floor(Math.random() * AVATARS.length)];
      room.players[playerId] = {
        id: playerId,
        socketId: socket.id,
        nickname: clean,
        score: 0,
        avatar: chosenAvatar,
        streak: 0,
        connected: true,
        currentAnswer: null,
      };
      socket.join(pin);
      socket.data.pin = pin;
      socket.data.role = 'player';
      socket.data.playerId = playerId;
      ack?.({ ok: true });
      broadcastLobby(room);
    });

    // ─── HOST: inicia o jogo ─────────────────────────────
    socket.on('host:startGame', () => {
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.hostSocketId !== socket.id) return;
      room.currentQuestionIndex = 0;
      sendQuestion(room);
    });

    // ─── HOST: próxima pergunta ──────────────────────────
    socket.on('host:nextQuestion', () => {
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.hostSocketId !== socket.id) return;
      if (!hasMoreQuestions(room)) return endGame(room);
      room.currentQuestionIndex += 1;
      sendQuestion(room);
    });

    // ─── HOST: revelar agora (pular o tempo restante) ────
    socket.on('host:revealNow', () => {
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.hostSocketId !== socket.id || room.status !== 'QUESTION') return;
      revealAnswer(room);
    });

    // ─── HOST: adicionar tempo ───────────────────────────
    socket.on('host:addTime', () => {
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.hostSocketId !== socket.id || room.status !== 'QUESTION' || room.questionEndsAt === null) return;
      room.questionEndsAt += ADD_TIME_SECONDS * 1000;
      const remainingMs = Math.max(0, room.questionEndsAt - Date.now());
      clearRoomTimer(room.pin);
      timers.set(room.pin, setTimeout(() => revealAnswer(room), remainingMs));
      io.to(room.pin).emit('game:timer', { remainingSec: Math.round(remainingMs / 1000) });
    });

    // ─── HOST: remover jogador ───────────────────────────
    socket.on('host:kickPlayer', ({ nickname }) => {
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.hostSocketId !== socket.id) return;
      const entry = Object.entries(room.players).find(([, p]) => p.nickname === nickname);
      if (!entry) return;
      const [key, player] = entry;
      delete room.players[key];
      const target = io.sockets.sockets.get(player.socketId);
      if (target) {
        target.emit('player:kicked');
        target.leave(room.pin);
        target.data.pin = undefined;
      }
      broadcastLobby(room);
    });

    // ─── PLAYER: responde ────────────────────────────────
    socket.on('player:submitAnswer', ({ optionIndex }, ack) => {
      if (!answerLimiter.allow(socket.handshake.address)) {
        return ack?.({ ok: false, error: 'Muitas ações, aguarde um instante.' });
      }
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.status !== 'QUESTION' || room.questionStartedAt === null) {
        return ack?.({ ok: false, error: 'Fora de uma pergunta ativa' });
      }
      const player = socket.data.playerId ? room.players[socket.data.playerId] : undefined;
      if (!player) return ack?.({ ok: false, error: 'Jogador não está na sala' });
      if (player.currentAnswer) return ack?.({ ok: false, error: 'Você já respondeu' });

      const q = currentQuestion(room)!;
      const elapsedSec = (Date.now() - room.questionStartedAt) / 1000;
      const isCorrect = optionIndex === q.correctIndex;

      let bonus = 0;
      if (isCorrect) {
        player.streak += 1;
        bonus = streakBonus(player.streak);
      } else {
        player.streak = 0;
      }
      const pointsAwarded = isCorrect ? computeScore(q, elapsedSec) + bonus : 0;

      player.currentAnswer = { optionIndex, answeredAt: Date.now(), isCorrect, pointsAwarded };
      player.score += pointsAwarded;

      ack?.({ ok: true, isCorrect, pointsAwarded, totalScore: player.score, streak: player.streak, streakBonus: bonus });

      const connected = Object.values(room.players).filter((p) => p.connected);
      const answered = connected.filter((p) => p.currentAnswer !== null).length;
      io.to(room.hostSocketId).emit('game:answerCount', { answered, total: connected.length });

      if (allPlayersAnswered(room)) revealAnswer(room);
    });

    // ─── Desconexão ──────────────────────────────────────
    socket.on('disconnect', () => {
      const room = store.get(socket.data.pin ?? '');
      if (!room) return;

      if (room.hostSocketId === socket.id) {
        io.to(room.pin).emit('game:hostLeft');
        clearRoomTimer(room.pin);
        store.delete(room.pin);
        return;
      }

      const pid = socket.data.playerId;
      const player = pid ? room.players[pid] : undefined;
      // Ignora desconexão "velha" (o jogador já reconectou com outro socket).
      if (!player || player.socketId !== socket.id) return;

      if (room.status === 'LOBBY') {
        delete room.players[pid!]; // antes do jogo, sair = deixar a sala
      } else {
        player.connected = false; // durante o jogo, mantém a pontuação
      }
      broadcastLobby(room);
    });
  });
}
