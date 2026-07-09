// Diagnóstico de conexão com o Postgres.
// Uso:  DATABASE_URL="sua-connection-string" node scripts/db-check.mjs
// Lê a string do ambiente (nunca a coloque no código/commit).
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✘ Defina DATABASE_URL. Ex.: DATABASE_URL="postgresql://..." node scripts/db-check.mjs');
  process.exit(1);
}

// Mostra o destino SEM revelar a senha.
try {
  const u = new URL(url);
  console.log(`→ host=${u.hostname} porta=${u.port || 5432} db=${u.pathname.slice(1)} usuario=${u.username}`);
} catch {
  console.log('→ (não consegui parsear a URL, mas vou tentar conectar)');
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 8000,
});

try {
  const r = await pool.query('select version()');
  console.log('✔ CONECTOU —', r.rows[0].version.split(',')[0]);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, questions JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`,
  );
  const t = await pool.query(
    `select tablename from pg_tables where schemaname='public' and tablename in ('quizzes','game_history')`,
  );
  console.log('✔ CREATE TABLE OK — tabelas:', t.rows.map((x) => x.tablename).join(', ') || '(nenhuma)');
  console.log('\n✅ A string funciona. Se o app no Render não persiste, o problema é a variável não chegar no serviço (veja abaixo).');
} catch (e) {
  console.log('✘ FALHOU —', e.message);
  console.log('\nDicas: use o Session pooler (porta 5432) e confira a senha.');
} finally {
  await pool.end();
}
