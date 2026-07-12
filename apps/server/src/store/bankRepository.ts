import type pg from 'pg';
import type { BankQuestion, Question } from '@karick/shared';
import { normalizeTags } from '@karick/shared';

export interface BankRepository {
  list(ownerId: string): Promise<BankQuestion[]>;
  add(ownerId: string, question: Question, tags: string[]): Promise<BankQuestion>;
  remove(id: string, ownerId: string): Promise<boolean>;
  removeAllByOwner(ownerId: string): Promise<void>;
}

const genId = () => 'bq_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const parse = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;

export class PostgresBankRepository implements BankRepository {
  constructor(private pool: pg.Pool) {}

  async list(ownerId: string): Promise<BankQuestion[]> {
    const { rows } = await this.pool.query(
      `SELECT id, question, tags, created_at FROM bank_questions WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId],
    );
    return rows.map((r) => ({
      id: r.id,
      question: parse<Question>(r.question),
      tags: parse<string[]>(r.tags) ?? [],
      updatedAt: new Date(r.created_at).toISOString(),
    }));
  }

  async add(ownerId: string, question: Question, tags: string[]): Promise<BankQuestion> {
    const id = genId();
    const { rows } = await this.pool.query(
      `INSERT INTO bank_questions (id, owner_id, question, tags) VALUES ($1, $2, $3, $4)
       RETURNING id, question, tags, created_at`,
      [id, ownerId, JSON.stringify(question), JSON.stringify(normalizeTags(tags))],
    );
    const r = rows[0];
    return { id: r.id, question: parse<Question>(r.question), tags: parse<string[]>(r.tags) ?? [], updatedAt: new Date(r.created_at).toISOString() };
  }

  async remove(id: string, ownerId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM bank_questions WHERE id = $1 AND owner_id = $2`, [id, ownerId]);
    return (rowCount ?? 0) > 0;
  }
  async removeAllByOwner(ownerId: string): Promise<void> {
    await this.pool.query(`DELETE FROM bank_questions WHERE owner_id = $1`, [ownerId]);
  }
}

export class InMemoryBankRepository implements BankRepository {
  private items = new Map<string, BankQuestion & { ownerId: string }>();

  async list(ownerId: string): Promise<BankQuestion[]> {
    return [...this.items.values()]
      .filter((i) => i.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ ownerId: _o, ...rest }) => rest);
  }
  async add(ownerId: string, question: Question, tags: string[]): Promise<BankQuestion> {
    const item = { id: genId(), question, tags: normalizeTags(tags), updatedAt: new Date().toISOString(), ownerId };
    this.items.set(item.id, item);
    const { ownerId: _o, ...rest } = item;
    return rest;
  }
  async remove(id: string, ownerId: string): Promise<boolean> {
    const it = this.items.get(id);
    if (!it || it.ownerId !== ownerId) return false;
    return this.items.delete(id);
  }
  async removeAllByOwner(ownerId: string): Promise<void> {
    for (const [id, it] of this.items) if (it.ownerId === ownerId) this.items.delete(id);
  }
}
