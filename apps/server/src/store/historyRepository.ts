import type pg from 'pg';
import type { GameHistoryEntry, LeaderboardRow } from '@karick/shared';

interface RecordInput {
  quizTitle: string;
  pin: string;
  players: LeaderboardRow[];
  ownerId: string | null;
}

export interface HistoryRepository {
  record(entry: RecordInput): Promise<void>;
  recent(ownerId: string, limit?: number): Promise<GameHistoryEntry[]>;
}

const genId = () => 'gh_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export class PostgresHistoryRepository implements HistoryRepository {
  constructor(private pool: pg.Pool) {}

  async record(entry: RecordInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO game_history (id, quiz_title, pin, players, owner_id, played_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [genId(), entry.quizTitle, entry.pin, JSON.stringify(entry.players), entry.ownerId],
    );
  }

  async recent(ownerId: string, limit = 20): Promise<GameHistoryEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT id, quiz_title, pin, players, played_at
       FROM game_history WHERE owner_id = $1 ORDER BY played_at DESC LIMIT $2`,
      [ownerId, limit],
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
  private entries: (GameHistoryEntry & { ownerId: string | null })[] = [];

  async record(entry: RecordInput): Promise<void> {
    this.entries.unshift({
      id: genId(),
      quizTitle: entry.quizTitle,
      pin: entry.pin,
      players: entry.players,
      ownerId: entry.ownerId,
      playedAt: new Date().toISOString(),
    });
    this.entries = this.entries.slice(0, 200);
  }
  async recent(ownerId: string, limit = 20): Promise<GameHistoryEntry[]> {
    return this.entries.filter((e) => e.ownerId === ownerId).slice(0, limit);
  }
}
