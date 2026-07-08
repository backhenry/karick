import type pg from 'pg';
import type { GameHistoryEntry, LeaderboardRow } from '@karick/shared';

export interface HistoryRepository {
  record(entry: { quizTitle: string; pin: string; players: LeaderboardRow[] }): Promise<void>;
  recent(limit?: number): Promise<GameHistoryEntry[]>;
}

const genId = () => 'gh_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export class PostgresHistoryRepository implements HistoryRepository {
  constructor(private pool: pg.Pool) {}

  async record(entry: { quizTitle: string; pin: string; players: LeaderboardRow[] }): Promise<void> {
    await this.pool.query(
      `INSERT INTO game_history (id, quiz_title, pin, players, played_at)
       VALUES ($1, $2, $3, $4, now())`,
      [genId(), entry.quizTitle, entry.pin, JSON.stringify(entry.players)],
    );
  }

  async recent(limit = 20): Promise<GameHistoryEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT id, quiz_title, pin, players, played_at
       FROM game_history ORDER BY played_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      quizTitle: r.quiz_title,
      pin: r.pin,
      players: typeof r.players === 'string' ? JSON.parse(r.players) : r.players,
      playedAt: new Date(r.played_at).toISOString(),
    }));
  }
}

export class InMemoryHistoryRepository implements HistoryRepository {
  private entries: GameHistoryEntry[] = [];

  async record(entry: { quizTitle: string; pin: string; players: LeaderboardRow[] }): Promise<void> {
    this.entries.unshift({ id: genId(), ...entry, playedAt: new Date().toISOString() });
    this.entries = this.entries.slice(0, 100);
  }
  async recent(limit = 20): Promise<GameHistoryEntry[]> {
    return this.entries.slice(0, limit);
  }
}
