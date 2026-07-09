import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@karick/shared';
import { createAdapter } from '@socket.io/redis-adapter';
import { InMemoryRoomStore, type RoomStore } from './store/roomStore.js';
import { RedisRoomStore } from './store/redisRoomStore.js';
import { registerGameGateway } from './game/gameGateway.js';
import { createPool, initSchema } from './db/pool.js';
import {
  InMemoryQuizRepository,
  PostgresQuizRepository,
  type QuizRepository,
} from './store/quizRepository.js';
import {
  InMemoryHistoryRepository,
  PostgresHistoryRepository,
  type HistoryRepository,
} from './store/historyRepository.js';
import { createApiRouter } from './api/apiRouter.js';
import { RateLimiter } from './util/rateLimiter.js';
import { InMemoryUserRepository, PostgresUserRepository, type UserRepository } from './store/userRepository.js';
import { createAuthRouter } from './auth/authRouter.js';
import { connectRedis } from './db/redis.js';

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_APPS = join(__dirname, '..', '..');
const PLAYER_DIST = join(REPO_APPS, 'player', 'dist');
const HOST_DIST = join(REPO_APPS, 'host', 'dist');
const FRONTENDS_BUILT = existsSync(PLAYER_DIST) && existsSync(HOST_DIST);

// ─── Banco de dados (opcional) ───
const pool = createPool();
let quizRepo: QuizRepository;
let historyRepo: HistoryRepository;
let userRepo: UserRepository;
let dbEnabled = false;

if (pool) {
  try {
    await initSchema(pool);
    quizRepo = new PostgresQuizRepository(pool);
    historyRepo = new PostgresHistoryRepository(pool);
    userRepo = new PostgresUserRepository(pool);
    dbEnabled = true;
    console.log('🗄️  Postgres conectado (biblioteca, histórico e contas persistentes)');
  } catch (err) {
    console.error('⚠️  Falha ao conectar no Postgres, caindo para memória:', err);
    quizRepo = new InMemoryQuizRepository();
    historyRepo = new InMemoryHistoryRepository();
    userRepo = new InMemoryUserRepository();
  }
} else {
  quizRepo = new InMemoryQuizRepository();
  historyRepo = new InMemoryHistoryRepository();
  userRepo = new InMemoryUserRepository();
  console.log('💾 Sem DATABASE_URL — usando repositório em memória (não persiste)');
}

// ─── HTTP / Express ───
const app = express();
app.set('trust proxy', 1); // atrás do proxy do Render: usa o IP real do cliente
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Rate limit da API (por IP) — protege contra flood de requisições.
const apiLimiter = new RateLimiter(Number(process.env.API_RATE_MAX ?? 100), 60_000);
app.use('/api', (req, res, next) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (!apiLimiter.allow(ip)) return res.status(429).json({ error: 'Muitas requisições, tente novamente em instantes.' });
  next();
});
app.use('/api/auth', createAuthRouter(userRepo));
app.use('/api', createApiRouter(quizRepo, historyRepo, dbEnabled));

if (FRONTENDS_BUILT) {
  app.use('/host', express.static(HOST_DIST));
  app.get('/host/*', (_req, res) => res.sendFile(join(HOST_DIST, 'index.html')));
  app.use(express.static(PLAYER_DIST));
  app.get('*', (_req, res) => res.sendFile(join(PLAYER_DIST, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.status(200).send('Karick server no ar (modo dev). Fronts via Vite (5173/5174).'),
  );
}

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: CORS_ORIGIN } },
);

// Redis (opcional): adapter de broadcast + estado das salas atômico.
const redis = await connectRedis();
let roomStore: RoomStore;
if (redis) {
  io.adapter(createAdapter(redis, redis.duplicate()));
  roomStore = new RedisRoomStore(redis);
} else {
  roomStore = new InMemoryRoomStore();
}

registerGameGateway(io, roomStore, historyRepo);

httpServer.listen(PORT, () => {
  console.log(`🚀 Karick server pronto na porta ${PORT}`);
  console.log(FRONTENDS_BUILT ? '   servindo fronts (Player em / e Host em /host)' : '   modo dev');
  console.log(
    redis
      ? '🔻 Redis ativo: estado das salas + broadcast entre instâncias (valide em staging antes de escalar)'
      : '   Estado das salas em memória (instância única)',
  );
});
