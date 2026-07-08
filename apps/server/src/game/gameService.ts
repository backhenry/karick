import type { GameRoom, LeaderboardRow, Question } from '@karick/shared';

/**
 * Lógica de jogo PURA (sem I/O nem sockets) — fácil de testar isoladamente.
 * O gateway chama estas funções e cuida da comunicação.
 */

/**
 * Pontuação estilo Kahoot: acerto vale entre 50% e 100% da base,
 * proporcional à rapidez da resposta. Erro vale 0.
 */
export function computeScore(question: Question, elapsedSec: number): number {
  const ratio = Math.min(elapsedSec / question.timeLimitSec, 1);
  return Math.round(question.points * (1 - ratio / 2));
}

export function currentQuestion(room: GameRoom): Question | undefined {
  return room.quiz.questions[room.currentQuestionIndex];
}

export function hasMoreQuestions(room: GameRoom): boolean {
  return room.currentQuestionIndex < room.quiz.questions.length - 1;
}

export function allPlayersAnswered(room: GameRoom): boolean {
  const players = Object.values(room.players);
  return players.length > 0 && players.every((p) => p.currentAnswer !== null);
}

export function buildLeaderboard(room: GameRoom): LeaderboardRow[] {
  return Object.values(room.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, nickname: p.nickname, score: p.score }));
}
