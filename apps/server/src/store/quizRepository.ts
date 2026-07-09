import type pg from 'pg';
import type { Question, QuizDraft, QuizSummary, SavedQuiz } from '@karick/shared';
import { normalizeTags } from '@karick/shared';

/** Todas as operações são escopadas ao dono (ownerId) — cada um só vê os seus. */
export interface QuizRepository {
  list(ownerId: string): Promise<QuizSummary[]>;
  get(id: string, ownerId: string): Promise<SavedQuiz | null>;
  create(draft: QuizDraft, ownerId: string): Promise<SavedQuiz>;
  update(id: string, draft: QuizDraft, ownerId: string): Promise<SavedQuiz | null>;
  remove(id: string, ownerId: string): Promise<boolean>;
}

const genId = () => 'qz_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ─── Postgres ─── */

export class PostgresQuizRepository implements QuizRepository {
  constructor(private pool: pg.Pool) {}

  async list(ownerId: string): Promise<QuizSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT id, title, tags, jsonb_array_length(questions) AS question_count, updated_at
       FROM quizzes WHERE owner_id = $1 ORDER BY updated_at DESC`,
      [ownerId],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      tags: parseTags(r.tags),
      questionCount: Number(r.question_count),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async get(id: string, ownerId: string): Promise<SavedQuiz | null> {
    const { rows } = await this.pool.query(
      `SELECT id, title, questions, tags, updated_at FROM quizzes WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return rows[0] ? toSavedQuiz(rows[0]) : null;
  }

  async create(draft: QuizDraft, ownerId: string): Promise<SavedQuiz> {
    const id = genId();
    const { rows } = await this.pool.query(
      `INSERT INTO quizzes (id, title, questions, tags, owner_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, title, questions, tags, updated_at`,
      [id, draft.title.trim(), JSON.stringify(draft.questions), JSON.stringify(normalizeTags(draft.tags)), ownerId],
    );
    return toSavedQuiz(rows[0]);
  }

  async update(id: string, draft: QuizDraft, ownerId: string): Promise<SavedQuiz | null> {
    const { rows } = await this.pool.query(
      `UPDATE quizzes SET title = $2, questions = $3, tags = $4, updated_at = now()
       WHERE id = $1 AND owner_id = $5
       RETURNING id, title, questions, tags, updated_at`,
      [id, draft.title.trim(), JSON.stringify(draft.questions), JSON.stringify(normalizeTags(draft.tags)), ownerId],
    );
    return rows[0] ? toSavedQuiz(rows[0]) : null;
  }

  async remove(id: string, ownerId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM quizzes WHERE id = $1 AND owner_id = $2`, [id, ownerId]);
    return (rowCount ?? 0) > 0;
  }
}

function parseTags(v: unknown): string[] {
  const arr = typeof v === 'string' ? JSON.parse(v) : v;
  return Array.isArray(arr) ? arr : [];
}

function toSavedQuiz(row: { id: string; title: string; questions: Question[] | string; tags: unknown; updated_at: string }): SavedQuiz {
  return {
    id: row.id,
    title: row.title,
    questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : row.questions,
    tags: parseTags(row.tags),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/* ─── Em memória (dev / sem DATABASE_URL) ─── */

interface OwnedQuiz extends SavedQuiz {
  ownerId: string;
}

export class InMemoryQuizRepository implements QuizRepository {
  private store = new Map<string, OwnedQuiz>();

  async list(ownerId: string): Promise<QuizSummary[]> {
    return [...this.store.values()]
      .filter((q) => q.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((q) => ({ id: q.id, title: q.title, tags: q.tags, questionCount: q.questions.length, updatedAt: q.updatedAt }));
  }
  async get(id: string, ownerId: string): Promise<SavedQuiz | null> {
    const q = this.store.get(id);
    return q && q.ownerId === ownerId ? q : null;
  }
  async create(draft: QuizDraft, ownerId: string): Promise<SavedQuiz> {
    const quiz: OwnedQuiz = {
      id: genId(),
      title: draft.title.trim(),
      questions: draft.questions,
      tags: normalizeTags(draft.tags),
      updatedAt: new Date().toISOString(),
      ownerId,
    };
    this.store.set(quiz.id, quiz);
    return quiz;
  }
  async update(id: string, draft: QuizDraft, ownerId: string): Promise<SavedQuiz | null> {
    const existing = this.store.get(id);
    if (!existing || existing.ownerId !== ownerId) return null;
    const quiz: OwnedQuiz = {
      id,
      title: draft.title.trim(),
      questions: draft.questions,
      tags: normalizeTags(draft.tags),
      updatedAt: new Date().toISOString(),
      ownerId,
    };
    this.store.set(id, quiz);
    return quiz;
  }
  async remove(id: string, ownerId: string): Promise<boolean> {
    const q = this.store.get(id);
    if (!q || q.ownerId !== ownerId) return false;
    return this.store.delete(id);
  }
}
