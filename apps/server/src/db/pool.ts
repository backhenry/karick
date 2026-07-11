import pg from 'pg';

/**
 * Cria o pool de conexões a partir de DATABASE_URL (ex.: connection string do
 * Supabase). Se a variável não existir, retorna null → o app roda sem banco
 * (modo em memória), útil em dev.
 */
export function createPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  return new pg.Pool({
    connectionString: url,
    // Supabase/serviços gerenciados exigem SSL; rejectUnauthorized:false evita
    // problema de cadeia de certificados em plataformas como o Render.
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

/** Cria as tabelas se ainda não existirem (roda uma vez no boot). */
export async function initSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      questions  JSONB NOT NULL,
      tags       JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
    CREATE TABLE IF NOT EXISTS game_history (
      id         TEXT PRIMARY KEY,
      quiz_title TEXT NOT NULL,
      pin        TEXT NOT NULL,
      players    JSONB NOT NULL,
      played_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_game_history_played_at ON game_history (played_at DESC);

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE quizzes      ADD COLUMN IF NOT EXISTS owner_id TEXT;
    ALTER TABLE quizzes      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE game_history ADD COLUMN IF NOT EXISTS owner_id TEXT;
    ALTER TABLE game_history ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE users        ADD COLUMN IF NOT EXISTS brand JSONB;
    ALTER TABLE users        ADD COLUMN IF NOT EXISTS fixed_pin TEXT;
    CREATE INDEX IF NOT EXISTS idx_quizzes_owner ON quizzes (owner_id);

    CREATE TABLE IF NOT EXISTS bank_questions (
      id         TEXT PRIMARY KEY,
      owner_id   TEXT NOT NULL,
      question   JSONB NOT NULL,
      tags       JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_bank_owner ON bank_questions (owner_id);
  `);
}
