import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@karick/shared';
import { InMemoryRoomStore } from './store/roomStore.js';
import { registerGameGateway } from './game/gameGateway.js';

const PORT = Number(process.env.PORT ?? 3001);
// Em produção tudo é servido da mesma origem, então CORS pode ficar restrito.
// Deixe '*' só se o front for hospedado num domínio diferente do servidor.
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist do server fica em apps/server/dist (build) ou src (dev tsx);
// os fronts compilados ficam em apps/{player,host}/dist.
const REPO_APPS = join(__dirname, '..', '..');
const PLAYER_DIST = join(REPO_APPS, 'player', 'dist');
const HOST_DIST = join(REPO_APPS, 'host', 'dist');
const FRONTENDS_BUILT = existsSync(PLAYER_DIST) && existsSync(HOST_DIST);

const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

if (FRONTENDS_BUILT) {
  // Host em /host (Vite buildado com base '/host/')
  app.use('/host', express.static(HOST_DIST));
  app.get('/host/*', (_req, res) => res.sendFile(join(HOST_DIST, 'index.html')));
  // Player na raiz
  app.use(express.static(PLAYER_DIST));
  app.get('*', (_req, res) => res.sendFile(join(PLAYER_DIST, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res
      .status(200)
      .send('Karick server no ar (modo dev). Os front-ends rodam separados via Vite (5173/5174).'),
  );
}

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: CORS_ORIGIN } },
);

const store = new InMemoryRoomStore();
registerGameGateway(io, store);

httpServer.listen(PORT, () => {
  console.log(`🚀 Karick server pronto na porta ${PORT}`);
  console.log(FRONTENDS_BUILT ? '   servindo front-ends compilados (Player em / e Host em /host)' : '   modo dev (sem front-ends compilados)');
});
