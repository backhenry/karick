import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  GameRoom,
  Player,
  Question,
  PlayerQuestionPayload,
  ServerToClientEvents,
  SocketData,
} from '@karick/shared';
import { MAX_NICKNAME_LENGTH, validateQuiz, AVATARS, ADD_TIME_SECONDS, REACTIONS, normalizeTeams, STARTING_BANK, optionPermutation, normalizeAnswer, sanitizeBrand } from '@karick/shared';
import type { GameMode } from '@karick/shared';

/** Permutação determinística das opções para um jogador numa pergunta (perm[exibida]=original). */
const permFor = (playerId: string, qIndex: number, n: number) => optionPermutation(`${playerId}:${qIndex}`, n);

/** Monta o payload de pergunta para um jogador (respeitando anti-cola e a preferência de texto). */
function playerQuestion(room: GameRoom, p: Player, q: Question): PlayerQuestionPayload {
  const wantsText = !!p.showText;
  const qType = q.type ?? 'choice';
  let options: string[] | undefined;
  if (qType !== 'text') {
    if (room.shuffle) options = permFor(p.id, room.currentQuestionIndex, q.options.length).map((o) => q.options[o]);
    else if (wantsText) options = q.options;
  }
  return {
    index: room.currentQuestionIndex,
    total: room.quiz.questions.length,
    ...(qType !== 'choice' ? { type: qType } : {}),
    optionsCount: q.options.length,
    timeLimitSec: q.timeLimitSec,
    imageUrl: q.imageUrl,
    ...(q.imageUrl && q.imageReveal ? { imageReveal: true } : {}),
    mode: room.mode,
    ...(room.mode === 'betting' ? { bank: p.score } : {}),
    ...(options ? { options } : {}),
    ...(wantsText ? { text: q.text } : {}),
  };
}
import { generatePin, type RoomStore } from '../store/roomStore.js';
import type { HistoryRepository } from '../store/historyRepository.js';
import type { UserRepository } from '../store/userRepository.js';
import { RateLimiter } from '../util/rateLimiter.js';
import { isOffensive } from '../util/nickname.js';
import { userIdFromCookieHeader } from '../auth/session.js';
import {
  allPlayersAnswered,
  buildDistribution,
  buildLeaderboard,
  buildRevealLeaderboard,
  buildTeamLeaderboard,
  computeScore,
  currentQuestion,
  hasMoreQuestions,
  streakBonus,
} from './gameService.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Timers autoritativos, em processo (não serializáveis). Ao escalar: BullMQ. */
const timers = new Map<string, NodeJS.Timeout>();

const createRoomLimiter = new RateLimiter(15, 60_000);
const joinLimiter = new RateLimiter(40, 60_000);
const answerLimiter = new RateLimiter(120, 60_000);
const reactionLimiter = new RateLimiter(20, 60_000);

function clearRoomTimer(pin: string) {
  const t = timers.get(pin);
  if (t) {
    clearTimeout(t);
    timers.delete(pin);
  }
}

export function registerGameGateway(io: IO, store: RoomStore, history: HistoryRepository, users: UserRepository) {
  // Emissões (somente leitura do room já obtido) ────────────────
  function broadcastLobby(room: GameRoom) {
    const players = Object.values(room.players).map((p) => ({
      nickname: p.nickname,
      score: p.score,
      avatar: p.avatar,
      team: p.team,
    }));
    io.to(room.pin).emit('lobby:updated', { players, count: players.length, teams: room.teams });
  }

  function sendSync(room: GameRoom, player: Player, socket: IOSocket) {
    if (room.status === 'FINISHED') return socket.emit('game:sync', { screen: 'OVER' });
    const q = currentQuestion(room);

    if (room.status === 'QUESTION' && q) {
      // Pausada: congela o restante no instante da pausa.
      const ref = room.paused && room.pausedAt ? room.pausedAt : Date.now();
      const remainingSec = room.questionEndsAt
        ? Math.max(0, Math.round((room.questionEndsAt - ref) / 1000))
        : q.timeLimitSec;
      return socket.emit('game:sync', {
        screen: player.currentAnswer ? 'ANSWERED' : 'QUESTION',
        question: playerQuestion(room, player, q),
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
          explanation: room.lastReveal.explanation,
        },
        answered: player.currentAnswer ? { isCorrect: player.currentAnswer.isCorrect } : undefined,
      });
    }

    return socket.emit('game:sync', { screen: 'LOBBY' });
  }

  // Transições (mutação atômica via store.update) ───────────────
  async function sendQuestion(pin: string) {
    const room = await store.update(pin, (r) => {
      const q = currentQuestion(r);
      if (!q) return;
      r.status = 'QUESTION';
      r.questionStartedAt = Date.now();
      r.questionEndsAt = Date.now() + q.timeLimitSec * 1000;
      r.paused = false;
      r.pausedAt = null;
      Object.values(r.players).forEach((p) => {
        p.currentAnswer = null;
        p.fiftyUsedQ = false;
        p.scoringPowerupQ = null;
      });
    });
    if (!room) return;
    const q = currentQuestion(room);
    if (!q) return endGame(pin);

    io.to(room.hostSocketId).emit('game:question:host', {
      index: room.currentQuestionIndex,
      total: room.quiz.questions.length,
      text: q.text,
      type: q.type,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      correctIndex: q.correctIndex,
      imageUrl: q.imageUrl,
      audioUrl: q.audioUrl,
      videoUrl: q.videoUrl,
      audioOnly: q.audioOnly,
      code: q.code,
      latex: q.latex,
      mode: room.mode,
      imageReveal: q.imageReveal,
      hints: q.hints,
    });
    Object.values(room.players).forEach((p) => {
      io.to(p.socketId).emit('game:question:player', playerQuestion(room, p, q));
    });

    clearRoomTimer(pin);
    timers.set(pin, setTimeout(() => void revealAnswer(pin), q.timeLimitSec * 1000));
  }

  async function revealAnswer(pin: string) {
    clearRoomTimer(pin);
    let payload: { correctIndex: number; correctText: string; distribution: number[]; leaderboard: ReturnType<typeof buildRevealLeaderboard>; teamLeaderboard?: ReturnType<typeof buildTeamLeaderboard>; explanation?: string } | null = null;
    let transitioned = false;
    const room = await store.update(pin, (r) => {
      payload = null;
      transitioned = false;
      if (r.status !== 'QUESTION') return; // já revelada
      transitioned = true;
      r.status = 'REVEAL';
      const q = currentQuestion(r);
      const qType = q?.type ?? 'choice';
      // Sobrevivência: quem errou ou não respondeu (e ainda estava vivo) é eliminado.
      // Enquete não elimina ninguém (não existe "errar" uma enquete).
      if (r.mode === 'survival' && qType !== 'poll') {
        for (const p of Object.values(r.players)) {
          if (!p.eliminated && (!p.currentAnswer || !p.currentAnswer.isCorrect)) p.eliminated = true;
        }
      }
      const distribution = q ? buildDistribution(r, q.options.length) : [];
      const teamLeaderboard = buildTeamLeaderboard(r);
      // correctIndex/correctText por tipo: digitada mostra a 1ª resposta aceita; enquete não tem certa.
      const correctIndex = q && qType === 'choice' ? q.correctIndex : -1;
      const correctText = !q ? '' : qType === 'choice' ? q.options[q.correctIndex] : qType === 'text' ? (q.acceptedAnswers?.[0] ?? '') : '';
      payload = {
        correctIndex,
        correctText,
        distribution,
        leaderboard: buildRevealLeaderboard(r),
        ...(teamLeaderboard.length ? { teamLeaderboard } : {}),
        explanation: q?.explanation,
      };
      r.lastReveal = payload;
      // Enquete fica fora das estatísticas de acerto (não é medição de conhecimento).
      if (q && qType !== 'poll') {
        const all = Object.values(r.players);
        const answeredPlayers = all.filter((p) => p.currentAnswer !== null);
        r.stats.push({
          text: q.text,
          correctCount: answeredPlayers.filter((p) => p.currentAnswer!.isCorrect).length,
          answered: answeredPlayers.length,
          total: all.length,
          // Detalhe por jogador — alimenta o relatório individual pós-jogo.
          answers: all.map((p) => ({
            nickname: p.nickname,
            avatar: p.avatar,
            answered: p.currentAnswer !== null,
            correct: !!p.currentAnswer?.isCorrect,
            gained: p.currentAnswer?.pointsAwarded ?? 0,
          })),
        });
      }
    });
    if (room && transitioned && payload) io.to(room.pin).emit('game:reveal', payload);
  }

  async function endGame(pin: string) {
    clearRoomTimer(pin);
    let did = false;
    let leaderboard: ReturnType<typeof buildLeaderboard> = [];
    let teamPodium: ReturnType<typeof buildTeamLeaderboard> = [];
    let stats: GameRoom['stats'] = [];
    let quizTitle = '';
    let ownerId: string | null = null;
    const room = await store.update(pin, (r) => {
      did = false;
      if (r.status === 'FINISHED') return;
      did = true;
      r.status = 'FINISHED';
      leaderboard = buildLeaderboard(r);
      teamPodium = buildTeamLeaderboard(r);
      stats = r.stats;
      quizTitle = r.quiz.title;
      ownerId = r.hostUserId;
    });
    if (!room || !did) return;
    io.to(room.pin).emit('game:over', {
      podium: leaderboard.slice(0, 3),
      stats,
      ...(teamPodium.length ? { teamPodium } : {}),
    });
    if (leaderboard.length > 0) {
      history
        .record({ quizTitle, pin, players: leaderboard, ownerId, stats })
        .catch((err) => console.error('Falha ao gravar histórico:', err));
    }
  }

  const isHost = (room: GameRoom | null, socket: IOSocket): room is GameRoom =>
    !!room && room.hostSocketId === socket.id;

  io.on('connection', (socket: IOSocket) => {
    // ─── HOST: cria a sala ───────────────────────────────
    socket.on('host:createRoom', async ({ quiz, teams, mode, shuffle, brand, fixedPin }, ack) => {
      if (!createRoomLimiter.allow(socket.handshake.address)) {
        return ack?.({ ok: false, error: 'Muitas salas criadas, aguarde um instante.' });
      }
      const err = validateQuiz(quiz);
      if (err) return ack?.({ ok: false, error: err });

      const normTeams = normalizeTeams(teams);
      const valid: GameMode[] = ['individual', 'teams', 'betting', 'survival'];
      let gameMode: GameMode = mode && valid.includes(mode) ? mode : 'individual';
      if (gameMode === 'teams' && normTeams.length < 2) gameMode = 'individual';

      const hostUserId = userIdFromCookieHeader(socket.handshake.headers.cookie);
      let pin: string;
      if (fixedPin && hostUserId) {
        // Sala permanente: mesmo PIN em todas as partidas do usuário.
        let fp = await users.getFixedPin(hostUserId);
        if (!fp) {
          fp = await generatePin(store);
          await users.setFixedPin(hostUserId, fp);
        }
        const existing = await store.get(fp);
        if (existing && existing.hostUserId !== hostUserId) {
          return ack?.({ ok: false, error: 'Seu PIN fixo está em uso por outra sala; tente novamente em instantes.' });
        }
        if (existing) {
          // Substitui a sala anterior do próprio usuário (partida antiga).
          clearRoomTimer(fp);
          await store.delete(fp);
        }
        pin = fp;
      } else {
        pin = await generatePin(store);
      }

      await store.create({
        pin,
        hostSocketId: socket.id,
        hostUserId,
        quiz: { id: pin, title: quiz.title.trim(), questions: quiz.questions },
        status: 'LOBBY',
        currentQuestionIndex: -1,
        mode: gameMode,
        shuffle: !!shuffle,
        teams: gameMode === 'teams' ? normTeams : [],
        brand: sanitizeBrand(brand),
        questionStartedAt: null,
        questionEndsAt: null,
        stats: [],
        players: {},
      });
      socket.join(pin);
      socket.data.pin = pin;
      socket.data.role = 'host';
      ack?.({ ok: true, pin });
    });

    // ─── PLAYER: entra na sala (ou reconecta) ────────────
    socket.on('player:join', async ({ pin, nickname, avatar, playerId, team, showText }, ack) => {
      if (!joinLimiter.allow(socket.handshake.address)) {
        return ack?.({ ok: false, error: 'Muitas tentativas, aguarde um instante.', errorCode: 'errRateLimit' });
      }
      if (!playerId) return ack?.({ ok: false, error: 'Identificador ausente', errorCode: 'errNoId' });

      let outcome = 'new' as 'reconnect' | 'new' | 'inprogress' | 'badnick' | 'taken' | 'offensive' | 'needteam';
      const clean = nickname?.trim().slice(0, MAX_NICKNAME_LENGTH);
      const room = await store.update(pin, (r) => {
        const existing = r.players[playerId];
        if (existing) {
          existing.socketId = socket.id;
          existing.connected = true;
          existing.showText = !!showText;
          outcome = 'reconnect';
          return;
        }
        if (r.status !== 'LOBBY') return void (outcome = 'inprogress');
        if (!clean) return void (outcome = 'badnick');
        if (isOffensive(clean)) return void (outcome = 'offensive');
        if (Object.values(r.players).some((p) => p.nickname === clean)) return void (outcome = 'taken');
        if (r.teams.length > 0 && !(team && r.teams.includes(team))) return void (outcome = 'needteam');
        const chosenAvatar =
          avatar && AVATARS.includes(avatar as (typeof AVATARS)[number])
            ? avatar
            : AVATARS[Math.floor(Math.random() * AVATARS.length)];
        r.players[playerId] = {
          id: playerId,
          socketId: socket.id,
          nickname: clean,
          score: r.mode === 'betting' ? STARTING_BANK : 0,
          avatar: chosenAvatar,
          streak: 0,
          connected: true,
          powerups: { fiftyFifty: true, double: true, freeze: true },
          eliminated: false,
          showText: !!showText,
          ...(r.teams.length > 0 ? { team } : {}),
          currentAnswer: null,
        };
        outcome = 'new';
      });

      if (!room) return ack?.({ ok: false, error: 'Sala não encontrada', errorCode: 'errRoomNotFound' });
      if (outcome === 'inprogress') return ack?.({ ok: false, error: 'Jogo já iniciado', errorCode: 'errInProgress' });
      if (outcome === 'badnick') return ack?.({ ok: false, error: 'Apelido inválido', errorCode: 'errBadNick' });
      if (outcome === 'offensive') return ack?.({ ok: false, error: 'Apelido não permitido', errorCode: 'errOffensive' });
      if (outcome === 'taken') return ack?.({ ok: false, error: 'Apelido já em uso', errorCode: 'errNickTaken' });
      if (outcome === 'needteam') return ack?.({ ok: false, error: 'Escolha uma equipe', errorCode: 'errNeedTeam', needTeam: true, teams: room.teams, brand: room.brand });

      socket.join(pin);
      socket.data.pin = pin;
      socket.data.role = 'player';
      socket.data.playerId = playerId;
      ack?.({ ok: true, mode: room.mode, brand: room.brand });
      if (outcome === 'reconnect') sendSync(room, room.players[playerId], socket);
      broadcastLobby(room);
    });

    // ─── HOST: inicia o jogo ─────────────────────────────
    socket.on('host:startGame', async () => {
      const room = await store.get(socket.data.pin ?? '');
      if (!isHost(room, socket)) return;
      await store.update(room.pin, (r) => (r.currentQuestionIndex = 0));
      await sendQuestion(room.pin);
    });

    // ─── HOST: próxima pergunta ──────────────────────────
    socket.on('host:nextQuestion', async () => {
      const room = await store.get(socket.data.pin ?? '');
      if (!isHost(room, socket)) return;
      if (!hasMoreQuestions(room)) return void endGame(room.pin);
      await store.update(room.pin, (r) => (r.currentQuestionIndex += 1));
      await sendQuestion(room.pin);
    });

    // ─── HOST: revelar agora ─────────────────────────────
    socket.on('host:revealNow', async () => {
      const room = await store.get(socket.data.pin ?? '');
      if (!isHost(room, socket) || room.status !== 'QUESTION') return;
      await revealAnswer(room.pin);
    });

    // ─── HOST: adicionar tempo ───────────────────────────
    socket.on('host:addTime', async () => {
      const room0 = await store.get(socket.data.pin ?? '');
      if (!isHost(room0, socket) || room0.status !== 'QUESTION' || room0.questionEndsAt === null) return;
      let remainingMs = 0;
      const room = await store.update(room0.pin, (r) => {
        if (r.questionEndsAt === null) return;
        r.questionEndsAt += ADD_TIME_SECONDS * 1000;
        remainingMs = Math.max(0, r.questionEndsAt - Date.now());
      });
      if (!room) return;
      clearRoomTimer(room.pin);
      timers.set(room.pin, setTimeout(() => void revealAnswer(room.pin), remainingMs));
      io.to(room.pin).emit('game:timer', { remainingSec: Math.round(remainingMs / 1000) });
    });

    // ─── HOST: pausar a pergunta (congela cronômetro + relógio de pontuação) ───
    socket.on('host:pauseQuestion', async () => {
      const room0 = await store.get(socket.data.pin ?? '');
      if (!isHost(room0, socket) || room0.status !== 'QUESTION' || room0.paused || room0.questionEndsAt === null) return;
      let remainingSec = 0;
      const room = await store.update(room0.pin, (r) => {
        if (r.questionEndsAt === null) return;
        r.paused = true;
        r.pausedAt = Date.now();
        remainingSec = Math.max(0, Math.round((r.questionEndsAt - r.pausedAt) / 1000));
      });
      if (!room) return;
      clearRoomTimer(room.pin); // segura o auto-reveal
      io.to(room.pin).emit('game:paused', { paused: true, remainingSec });
    });

    // ─── HOST: retomar (desloca início e fim pelo tempo pausado, reagenda) ───
    socket.on('host:resumeQuestion', async () => {
      const room0 = await store.get(socket.data.pin ?? '');
      if (!isHost(room0, socket) || room0.status !== 'QUESTION' || !room0.paused) return;
      let remainingMs = 0;
      const room = await store.update(room0.pin, (r) => {
        if (!r.pausedAt || r.questionEndsAt === null) return;
        const delta = Date.now() - r.pausedAt;
        r.questionEndsAt += delta;
        if (r.questionStartedAt !== null) r.questionStartedAt += delta; // pontuação por velocidade fica justa
        r.paused = false;
        r.pausedAt = null;
        remainingMs = Math.max(0, r.questionEndsAt - Date.now());
      });
      if (!room) return;
      clearRoomTimer(room.pin);
      timers.set(room.pin, setTimeout(() => void revealAnswer(room.pin), remainingMs));
      io.to(room.pin).emit('game:paused', { paused: false, remainingSec: Math.round(remainingMs / 1000) });
    });

    // ─── HOST: remover jogador ───────────────────────────
    socket.on('host:kickPlayer', async ({ nickname }) => {
      const room0 = await store.get(socket.data.pin ?? '');
      if (!isHost(room0, socket)) return;
      let kickedSocketId: string | null = null;
      const room = await store.update(room0.pin, (r) => {
        const entry = Object.entries(r.players).find(([, p]) => p.nickname === nickname);
        if (!entry) return;
        kickedSocketId = entry[1].socketId;
        delete r.players[entry[0]];
      });
      if (kickedSocketId) {
        io.to(kickedSocketId).emit('player:kicked');
        const target = io.sockets.sockets.get(kickedSocketId); // só se for local
        if (target) {
          target.leave(room0.pin);
          target.data.pin = undefined;
        }
      }
      if (room) broadcastLobby(room);
    });

    // ─── PLAYER: responde ────────────────────────────────
    socket.on('player:submitAnswer', async ({ optionIndex, wager, text }, ack) => {
      if (!answerLimiter.allow(socket.handshake.address)) {
        return ack?.({ ok: false, error: 'Muitas ações, aguarde um instante.', errorCode: 'errRateLimit' });
      }
      const pin = socket.data.pin ?? '';
      const playerId = socket.data.playerId;
      let outcome = 'ok' as 'ok' | 'inactive' | 'noplayer' | 'answered' | 'eliminated' | 'badanswer';
      let result: { isCorrect: boolean; pointsAwarded: number; totalScore: number; streak: number; streakBonus: number } | null = null;
      const room = await store.update(pin, (r) => {
        outcome = 'ok';
        result = null;
        if (r.status !== 'QUESTION' || r.questionStartedAt === null || r.paused) return void (outcome = 'inactive');
        const p = playerId ? r.players[playerId] : undefined;
        if (!p) return void (outcome = 'noplayer');
        if (p.eliminated) return void (outcome = 'eliminated');
        if (p.currentAnswer) return void (outcome = 'answered');
        const q = currentQuestion(r)!;
        const qType = q.type ?? 'choice';
        const elapsedSec = (Date.now() - r.questionStartedAt) / 1000;

        let originalIndex = -1;
        let isCorrect = false;
        if (qType === 'text') {
          const typed = typeof text === 'string' ? text.trim().slice(0, 200) : '';
          if (!typed) return void (outcome = 'badanswer');
          isCorrect = (q.acceptedAnswers ?? []).some((a) => normalizeAnswer(a) === normalizeAnswer(typed));
        } else {
          if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= q.options.length) {
            return void (outcome = 'badanswer');
          }
          // Anti-cola: o jogador envia a posição EXIBIDA; mapeamos para a opção original.
          originalIndex = r.shuffle
            ? (permFor(p.id, r.currentQuestionIndex, q.options.length)[optionIndex] ?? optionIndex)
            : optionIndex;
          isCorrect = qType === 'choice' && originalIndex === q.correctIndex;
        }

        let pointsAwarded = 0;
        let bonus = 0;
        if (qType === 'poll') {
          // Enquete: registra o voto; sem pontos e sem mexer na sequência.
        } else if (r.mode === 'betting') {
          // Aposta: acertou ganha o valor apostado, errou perde. Sem velocidade/streak.
          const bet = Math.max(1, Math.min(Math.round(wager ?? 0) || 0, p.score));
          pointsAwarded = isCorrect ? bet : -bet;
          p.score = Math.max(0, p.score + pointsAwarded);
        } else {
          if (isCorrect) {
            p.streak += 1;
            bonus = streakBonus(p.streak);
          } else {
            p.streak = 0;
          }
          // Power-ups: freeze = pontuação de velocidade máxima; double = dobra o total.
          const base = p.scoringPowerupQ === 'freeze' ? q.points : computeScore(q, elapsedSec);
          pointsAwarded = isCorrect ? base + bonus : 0;
          if (isCorrect && p.scoringPowerupQ === 'double') pointsAwarded *= 2;
          p.score += pointsAwarded;
        }
        p.currentAnswer = { optionIndex: originalIndex, answeredAt: Date.now(), isCorrect, pointsAwarded };
        result = { isCorrect, pointsAwarded, totalScore: p.score, streak: p.streak, streakBonus: bonus };
      });
      if (!room || outcome === 'inactive') return ack?.({ ok: false, error: 'Fora de uma pergunta ativa', errorCode: 'errInactive' });
      if (outcome === 'noplayer') return ack?.({ ok: false, error: 'Jogador não está na sala', errorCode: 'errNoPlayer' });
      if (outcome === 'eliminated') return ack?.({ ok: false, error: 'Você foi eliminado', errorCode: 'errEliminated' });
      if (outcome === 'answered') return ack?.({ ok: false, error: 'Você já respondeu', errorCode: 'errAlreadyAnswered' });
      if (outcome === 'badanswer') return ack?.({ ok: false, error: 'Resposta inválida', errorCode: 'errBadAnswer' });
      ack?.({ ok: true, ...result! });

      const connected = Object.values(room.players).filter((p) => p.connected && !p.eliminated);
      const answered = connected.filter((p) => p.currentAnswer !== null).length;
      // Inclui quem respondeu (sem a opção) para o feed de avatares no telão.
      const who = playerId ? room.players[playerId] : undefined;
      io.to(room.hostSocketId).emit('game:answerCount', { answered, total: connected.length, nickname: who?.nickname, avatar: who?.avatar });
      if (allPlayersAnswered(room)) await revealAnswer(pin);
    });

    // ─── PLAYER: reação (emoji) ──────────────────────────
    socket.on('player:react', ({ emoji }) => {
      const pin = socket.data.pin;
      if (!pin || socket.data.role !== 'player') return;
      if (!reactionLimiter.allow(socket.handshake.address)) return;
      if (!REACTIONS.includes(emoji as (typeof REACTIONS)[number])) return;
      io.to(pin).emit('game:reaction', { emoji });
    });

    // ─── PLAYER: usar power-up na pergunta atual ─────────
    socket.on('player:usePowerup', async ({ type }, ack) => {
      const pin = socket.data.pin ?? '';
      const playerId = socket.data.playerId;
      let outcome = 'ok' as 'ok' | 'invalid' | 'unavailable' | 'already' | 'answered';
      let keep: number[] = [];
      await store.update(pin, (r) => {
        outcome = 'ok';
        keep = [];
        if (r.status !== 'QUESTION') return void (outcome = 'invalid');
        const p = playerId ? r.players[playerId] : undefined;
        if (!p) return void (outcome = 'invalid');
        if (p.currentAnswer) return void (outcome = 'answered');
        if (!p.powerups[type]) return void (outcome = 'unavailable');
        const q = currentQuestion(r);
        if (!q) return void (outcome = 'invalid');

        if (type === 'fiftyFifty') {
          // 50/50 só faz sentido com alternativas e uma resposta certa.
          if ((q.type ?? 'choice') !== 'choice') return void (outcome = 'unavailable');
          p.powerups.fiftyFifty = false;
          p.fiftyUsedQ = true;
          const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
          const keepWrong = wrong[Math.floor(Math.random() * wrong.length)];
          let kept = [q.correctIndex, keepWrong]; // índices originais
          if (r.shuffle) {
            const perm = permFor(p.id, r.currentQuestionIndex, q.options.length);
            kept = kept.map((orig) => perm.indexOf(orig)); // → posições exibidas
          }
          keep = kept.sort((a, b) => a - b);
        } else {
          if (p.scoringPowerupQ) return void (outcome = 'already'); // um power-up de pontuação por pergunta
          p.powerups[type] = false;
          p.scoringPowerupQ = type;
        }
      });
      if (outcome === 'ok') ack?.({ ok: true, keep });
      else if (outcome === 'unavailable') ack?.({ ok: false, error: 'Power-up já usado' });
      else if (outcome === 'already') ack?.({ ok: false, error: 'Você já usou um power-up de pontuação nesta pergunta' });
      else if (outcome === 'answered') ack?.({ ok: false, error: 'Você já respondeu' });
      else ack?.({ ok: false, error: 'Indisponível agora' });
    });

    // ─── Desconexão ──────────────────────────────────────
    socket.on('disconnect', async () => {
      const pin = socket.data.pin ?? '';
      const room0 = await store.get(pin);
      if (!room0) return;

      if (room0.hostSocketId === socket.id) {
        io.to(pin).emit('game:hostLeft');
        clearRoomTimer(pin);
        await store.delete(pin);
        return;
      }

      const pid = socket.data.playerId;
      if (!pid) return;
      let changed = false;
      const room = await store.update(pin, (r) => {
        const p = r.players[pid];
        if (!p || p.socketId !== socket.id) return; // desconexão "velha" (já reconectou)
        if (r.status === 'LOBBY') delete r.players[pid];
        else p.connected = false;
        changed = true;
      });
      if (changed && room) broadcastLobby(room);
    });
  });
}
