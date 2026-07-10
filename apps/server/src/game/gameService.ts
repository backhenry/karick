import type { GameRoom, LeaderboardRow, Question, TeamRow } from '@karick/shared';
import { STREAK_BONUS_STEP, STREAK_BONUS_MAX } from '@karick/shared';

/**
 * Placar por equipe pela MÉDIA por integrante (soma ÷ nº de membros), para ser
 * justo entre times de tamanhos diferentes. `score` = média arredondada.
 * Vazio se individual.
 */
export function buildTeamLeaderboard(room: GameRoom): TeamRow[] {
  if (room.teams.length === 0) return [];
  const totals = new Map<string, { sum: number; players: number }>();
  for (const name of room.teams) totals.set(name, { sum: 0, players: 0 });
  for (const p of Object.values(room.players)) {
    if (!p.team) continue;
    const t = totals.get(p.team);
    if (t) {
      t.sum += p.score;
      t.players += 1;
    }
  }
  return [...totals.entries()]
    .map(([name, t]) => ({ name, score: t.players > 0 ? Math.round(t.sum / t.players) : 0, players: t.players }))
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ rank: i + 1, ...t }));
}

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

/**
 * Bônus de sequência: dado o nº de acertos consecutivos (incluindo o atual),
 * o 2º acerto seguido vale +STEP, o 3º +2*STEP, etc., até o teto.
 */
export function streakBonus(newStreak: number): number {
  return Math.min((newStreak - 1) * STREAK_BONUS_STEP, STREAK_BONUS_MAX);
}

/** Quantos jogadores escolheram cada opção da pergunta atual. */
export function buildDistribution(room: GameRoom, optionCount: number): number[] {
  const dist = new Array<number>(optionCount).fill(0);
  for (const p of Object.values(room.players)) {
    const idx = p.currentAnswer?.optionIndex;
    if (idx !== undefined && idx >= 0 && idx < optionCount) dist[idx]++;
  }
  return dist;
}

export function currentQuestion(room: GameRoom): Question | undefined {
  return room.quiz.questions[room.currentQuestionIndex];
}

export function hasMoreQuestions(room: GameRoom): boolean {
  return room.currentQuestionIndex < room.quiz.questions.length - 1;
}

export function allPlayersAnswered(room: GameRoom): boolean {
  // Considera só conectados e não eliminados — quem caiu ou saiu não trava a revelação.
  const players = Object.values(room.players).filter((p) => p.connected && !p.eliminated);
  return players.length > 0 && players.every((p) => p.currentAnswer !== null);
}

export function buildLeaderboard(room: GameRoom): LeaderboardRow[] {
  return Object.values(room.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, nickname: p.nickname, score: p.score, avatar: p.avatar }));
}

/**
 * Leaderboard da revelação: inclui os pontos ganhos na rodada e a variação
 * de posição vs. a última revelação. Mutação: atualiza `previousRank` de cada
 * jogador para servir de base à próxima rodada.
 */
export function buildRevealLeaderboard(room: GameRoom): LeaderboardRow[] {
  const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
  return sorted.map((p, i) => {
    const rank = i + 1;
    const rankDelta = p.previousRank !== undefined ? p.previousRank - rank : undefined;
    p.previousRank = rank;
    return {
      rank,
      nickname: p.nickname,
      score: p.score,
      avatar: p.avatar,
      gained: p.currentAnswer?.pointsAwarded ?? 0,
      rankDelta,
    };
  });
}
