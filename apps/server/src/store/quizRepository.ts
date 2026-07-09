import type pg from 'pg';
import type { Question, QuizDraft, QuizSummary, SavedQuiz } from '@karick/shared';
import { normalizeTags } from '@karick/shared';

export interface QuizRepository {
  list(): Promise<QuizSummary[]>;
  get(id: string): Promise<SavedQuiz | null>;
  create(draft: QuizDraft): Promise<SavedQuiz>;
  update(id: string, draft: QuizDraft): Promise<SavedQuiz | null>;
  remove(id: string): Promise<boolean>;
}

const genId = () => 'qz_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ─── Postgres ─── */

export class PostgresQuizRepository implements QuizRepository {
  constructor(private pool: pg.Pool) {}

  async list(): Promise<QuizSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT id, title, tags, jsonb_array_length(questions) AS question_count, updated_at
       FROM quizzes ORDER BY updated_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      tags: parseTags(r.tags),
      questionCount: Number(r.question_count),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async get(id: string): Promise<SavedQuiz | null> {
    const { rows } = await this.pool.query(
      `SELECT id, title, questions, tags, updated_at FROM quizzes WHERE id = $1`,
      [id],
    );
    return rows[0] ? toSavedQuiz(rows[0]) : null;
  }

  async create(draft: QuizDraft): Promise<SavedQuiz> {
    const id = genId();
    const { rows } = await this.pool.query(
      `INSERT INTO quizzes (id, title, questions, tags, updated_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, title, questions, tags, updated_at`,
      [id, draft.title.trim(), JSON.stringify(draft.questions), JSON.stringify(normalizeTags(draft.tags))],
    );
    return toSavedQuiz(rows[0]);
  }

  async update(id: string, draft: QuizDraft): Promise<SavedQuiz | null> {
    const { rows } = await this.pool.query(
      `UPDATE quizzes SET title = $2, questions = $3, tags = $4, updated_at = now()
       WHERE id = $1
       RETURNING id, title, questions, tags, updated_at`,
      [id, draft.title.trim(), JSON.stringify(draft.questions), JSON.stringify(normalizeTags(draft.tags))],
    );
    return rows[0] ? toSavedQuiz(rows[0]) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM quizzes WHERE id = $1`, [id]);
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
    // pg já desserializa JSONB; se vier string (driver antigo), fazemos parse.
    questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : row.questions,
    tags: parseTags(row.tags),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/* ─── Em memória (dev / sem DATABASE_URL) ─── */

export class InMemoryQuizRepository implements QuizRepository {
  private store = new Map<string, SavedQuiz>();

  async list(): Promise<QuizSummary[]> {
    return [...this.store.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((q) => ({ id: q.id, title: q.title, tags: q.tags, questionCount: q.questions.length, updatedAt: q.updatedAt }));
  }
  async get(id: string): Promise<SavedQuiz | null> {
    return this.store.get(id) ?? null;
  }
  async create(draft: QuizDraft): Promise<SavedQuiz> {
    const quiz: SavedQuiz = {
      id: genId(),
      title: draft.title.trim(),
      questions: draft.questions,
      tags: normalizeTags(draft.tags),
      updatedAt: new Date().toISOString(),
    };
    this.store.set(quiz.id, quiz);
    return quiz;
  }
  async update(id: string, draft: QuizDraft): Promise<SavedQuiz | null> {
    if (!this.store.has(id)) return null;
    const quiz: SavedQuiz = {
      id,
      title: draft.title.trim(),
      questions: draft.questions,
      tags: normalizeTags(draft.tags),
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, quiz);
    return quiz;
  }
  async remove(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
