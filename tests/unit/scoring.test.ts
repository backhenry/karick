import { describe, it, expect } from 'vitest';
import type { GameRoom, Player, Question } from '@karick/shared';
import {
  computeScore,
  streakBonus,
  buildDistribution,
  buildLeaderboard,
  buildRevealLeaderboard,
  allPlayersAnswered,
  hasMoreQuestions,
  currentQuestion,
} from '../../apps/server/src/game/gameService';

const question = (over: Partial<Question> = {}): Question => ({
  text: 'Q?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
  timeLimitSec: 20,
  points: 1000,
  ...over,
});

const player = (over: Partial<Player> = {}): Player => ({
  id: over.id ?? 'p' + Math.random(),
  socketId: 's',
  nickname: over.nickname ?? 'Jog',
  score: 0,
  avatar: '🦊',
  streak: 0,
  connected: true,
  powerups: { fiftyFifty: true, double: true, freeze: true },
  currentAnswer: null,
  ...over,
});

const room = (players: Player[], over: Partial<GameRoom> = {}): GameRoom =>
  ({
    pin: '123456',
    hostSocketId: 'h',
    hostUserId: null,
    quiz: { id: '1', title: 'T', questions: [question(), question()] },
    status: 'QUESTION',
    currentQuestionIndex: 0,
    mode: 'individual',
    shuffle: false,
    teams: [],
    questionStartedAt: null,
    questionEndsAt: null,
    stats: [],
    players: Object.fromEntries(players.map((p) => [p.id, p])),
    ...over,
  }) as GameRoom;

describe('computeScore', () => {
  const q = question({ points: 1000, timeLimitSec: 20 });
  it('resposta instantânea vale a pontuação cheia', () => expect(computeScore(q, 0)).toBe(1000));
  it('no meio do tempo vale ~75%', () => expect(computeScore(q, 10)).toBe(750));
  it('no fim do tempo vale metade', () => expect(computeScore(q, 20)).toBe(500));
  it('nunca menos que a metade (satura no limite)', () => expect(computeScore(q, 999)).toBe(500));
});

describe('streakBonus', () => {
  it('o 1º acerto não dá bônus', () => expect(streakBonus(1)).toBe(0));
  it('cresce com a sequência', () => expect(streakBonus(3)).toBeGreaterThan(streakBonus(2)));
  it('satura num teto', () => expect(streakBonus(999)).toBe(streakBonus(1000)));
});

describe('buildDistribution', () => {
  it('conta as escolhas por opção', () => {
    const r = room([
      player({ id: 'a', currentAnswer: { optionIndex: 0, answeredAt: 1, isCorrect: true, pointsAwarded: 100 } }),
      player({ id: 'b', currentAnswer: { optionIndex: 0, answeredAt: 1, isCorrect: true, pointsAwarded: 100 } }),
      player({ id: 'c', currentAnswer: { optionIndex: 2, answeredAt: 1, isCorrect: false, pointsAwarded: 0 } }),
      player({ id: 'd', currentAnswer: null }),
    ]);
    expect(buildDistribution(r, 4)).toEqual([2, 0, 1, 0]);
  });
});

describe('leaderboards', () => {
  it('buildLeaderboard ordena por score desc com rank', () => {
    const rows = buildLeaderboard(room([
      player({ id: 'a', nickname: 'Ana', score: 300 }),
      player({ id: 'b', nickname: 'Bia', score: 900 }),
      player({ id: 'c', nickname: 'Cid', score: 600 }),
    ]));
    expect(rows.map((r) => r.nickname)).toEqual(['Bia', 'Cid', 'Ana']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it('buildRevealLeaderboard calcula variação e pontos ganhos', () => {
    const p = player({ id: 'a', nickname: 'Ana', score: 900, previousRank: 3, currentAnswer: { optionIndex: 0, answeredAt: 1, isCorrect: true, pointsAwarded: 500 } });
    const r = room([p, player({ id: 'b', nickname: 'Bia', score: 100 })]);
    const rows = buildRevealLeaderboard(r);
    const ana = rows.find((x) => x.nickname === 'Ana')!;
    expect(ana.rank).toBe(1);
    expect(ana.gained).toBe(500);
    expect(ana.rankDelta).toBe(2); // subiu de 3º para 1º
    expect(p.previousRank).toBe(1); // muta para a próxima rodada
  });
});

describe('fluxo de rodada', () => {
  it('allPlayersAnswered ignora desconectados e eliminados', () => {
    const r = room([
      player({ id: 'a', currentAnswer: { optionIndex: 0, answeredAt: 1, isCorrect: true, pointsAwarded: 1 } }),
      player({ id: 'b', connected: false, currentAnswer: null }), // caído não trava
      player({ id: 'c', eliminated: true, currentAnswer: null }), // eliminado não trava
    ]);
    expect(allPlayersAnswered(r)).toBe(true);
  });
  it('allPlayersAnswered é false se um conectado não respondeu', () => {
    const r = room([
      player({ id: 'a', currentAnswer: { optionIndex: 0, answeredAt: 1, isCorrect: true, pointsAwarded: 1 } }),
      player({ id: 'b', currentAnswer: null }),
    ]);
    expect(allPlayersAnswered(r)).toBe(false);
  });
  it('hasMoreQuestions / currentQuestion respeitam o índice', () => {
    const r = room([player({ id: 'a' })], { currentQuestionIndex: 0 });
    expect(hasMoreQuestions(r)).toBe(true);
    expect(currentQuestion(r)).toBeDefined();
    r.currentQuestionIndex = 1;
    expect(hasMoreQuestions(r)).toBe(false);
  });
});
