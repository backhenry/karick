import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  GameRoom,
  ServerToClientEvents,
  SocketData,
} from '@karick/shared';
import { MAX_NICKNAME_LENGTH, validateQuiz } from '@karick/shared';
import { generatePin, type RoomStore } from '../store/roomStore.js';
import {
  allPlayersAnswered,
  buildLeaderboard,
  computeScore,
  currentQuestion,
  hasMoreQuestions,
} from './gameService.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Timers autoritativos, fora do objeto GameRoom (não são serializáveis).
 * Débito técnico para escala: mover para BullMQ/Redis para sobreviver a restart.
 */
const timers = new Map<string, NodeJS.Timeout>();

function clearRoomTimer(pin: string) {
  const t = timers.get(pin);
  if (t) {
    clearTimeout(t);
    timers.delete(pin);
  }
}

export function registerGameGateway(io: IO, store: RoomStore) {
  function broadcastLobby(room: GameRoom) {
    const players = Object.values(room.players).map((p) => ({
      nickname: p.nickname,
      score: p.score,
    }));
    io.to(room.pin).emit('lobby:updated', { players, count: players.length });
  }

  function sendQuestion(room: GameRoom) {
    const q = currentQuestion(room);
    if (!q) return endGame(room);

    room.status = 'QUESTION';
    room.questionStartedAt = Date.now();
    Object.values(room.players).forEach((p) => (p.currentAnswer = null));

    io.to(room.hostSocketId).emit('game:question:host', {
      index: room.currentQuestionIndex,
      total: room.quiz.questions.length,
      text: q.text,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      correctIndex: q.correctIndex,
    });

    Object.values(room.players).forEach((p) => {
      io.to(p.socketId).emit('game:question:player', {
        index: room.currentQuestionIndex,
        total: room.quiz.questions.length,
        optionsCount: q.options.length,
        timeLimitSec: q.timeLimitSec,
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
    io.to(room.pin).emit('game:reveal', {
      correctIndex: q ? q.correctIndex : -1,
      leaderboard: buildLeaderboard(room),
    });
  }

  function endGame(room: GameRoom) {
    clearRoomTimer(room.pin);
    room.status = 'FINISHED';
    io.to(room.pin).emit('game:over', { podium: buildLeaderboard(room).slice(0, 3) });
    // TODO: persistir GameResult no PostgreSQL aqui.
  }

  io.on('connection', (socket: IOSocket) => {
    // ─── HOST: cria a sala ───────────────────────────────
    socket.on('host:createRoom', ({ quiz }, ack) => {
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
        players: {},
      };
      store.create(room);
      socket.join(pin);
      socket.data.pin = pin;
      socket.data.role = 'host';
      ack?.({ ok: true, pin });
    });

    // ─── PLAYER: entra na sala ───────────────────────────
    socket.on('player:join', ({ pin, nickname }, ack) => {
      const room = store.get(pin);
      const clean = nickname?.trim().slice(0, MAX_NICKNAME_LENGTH);
      if (!room) return ack?.({ ok: false, error: 'Sala não encontrada' });
      if (room.status !== 'LOBBY') return ack?.({ ok: false, error: 'Jogo já iniciado' });
      if (!clean) return ack?.({ ok: false, error: 'Apelido inválido' });
      const taken = Object.values(room.players).some((p) => p.nickname === clean);
      if (taken) return ack?.({ ok: false, error: 'Apelido já em uso' });

      room.players[socket.id] = { socketId: socket.id, nickname: clean, score: 0, currentAnswer: null };
      socket.join(pin);
      socket.data.pin = pin;
      socket.data.role = 'player';
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

    // ─── PLAYER: responde ────────────────────────────────
    socket.on('player:submitAnswer', ({ optionIndex }, ack) => {
      const room = store.get(socket.data.pin ?? '');
      if (!room || room.status !== 'QUESTION' || room.questionStartedAt === null) {
        return ack?.({ ok: false, error: 'Fora de uma pergunta ativa' });
      }
      const player = room.players[socket.id];
      if (!player) return ack?.({ ok: false, error: 'Jogador não está na sala' });
      if (player.currentAnswer) return ack?.({ ok: false, error: 'Você já respondeu' });

      const q = currentQuestion(room)!;
      const elapsedSec = (Date.now() - room.questionStartedAt) / 1000;
      const isCorrect = optionIndex === q.correctIndex;
      const pointsAwarded = isCorrect ? computeScore(q, elapsedSec) : 0;

      player.currentAnswer = { optionIndex, answeredAt: Date.now(), isCorrect, pointsAwarded };
      player.score += pointsAwarded;

      ack?.({ ok: true, isCorrect, pointsAwarded, totalScore: player.score });

      const players = Object.values(room.players);
      const answered = players.filter((p) => p.currentAnswer !== null).length;
      io.to(room.hostSocketId).emit('game:answerCount', { answered, total: players.length });

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
      } else if (room.players[socket.id]) {
        delete room.players[socket.id];
        broadcastLobby(room);
      }
    });
  });
}
