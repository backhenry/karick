// E2E abrangente do fluxo de jogo (servidor real em memória + socket.io + REST).
// Roda a partir da raiz do repo: node tests/e2e/game-flow.mjs
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = 3097;
const URL = `http://localhost:${PORT}`;
const HARD_TIMEOUT = setTimeout(() => { console.error('❌ TIMEOUT GERAL'); process.exit(1); }, 60_000);

const srv = spawn('npx', ['tsx', 'apps/server/src/main.ts'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', SESSION_SECRET: 'e2e-secret' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => (log += d));
srv.stderr.on('data', (d) => (log += d));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const section = (s) => console.log('\n▶', s);
const connect = () => { const s = io(URL, { transports: ['websocket'], forceNew: true }); return new Promise((r) => s.on('connect', () => r(s))); };
const emitAck = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const waitUp = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(URL + '/api/status')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error('server down\n' + log); };

const quiz = (over = {}) => ({
  title: 'Quiz E2E',
  questions: [
    { text: 'Capital do Brasil?', options: ['Brasília', 'Rio', 'SP', 'BH'], correctIndex: 0, timeLimitSec: 20, points: 1000 },
    { text: '2+2?', options: ['3', '4', '5'], correctIndex: 1, timeLimitSec: 20, points: 1000 },
  ],
  ...over,
});

async function main() {
  await waitUp();

  // ── 1. Auth + REST (quiz CRUD) ──
  section('Auth + REST');
  const jar = [];
  const rest = async (path, opts = {}) => {
    const r = await fetch(URL + '/api' + path, {
      ...opts,
      headers: { 'content-type': 'application/json', cookie: jar.join('; '), ...(opts.headers || {}) },
    });
    const setc = r.headers.get('set-cookie');
    if (setc) jar.push(setc.split(';')[0]);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const email = `e2e_${Date.now()}@x.com`;
  ok((await rest('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password: 'senha-e2e-1' }) })).status === 201, 'signup cria conta (201)');
  ok((await rest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'errada' }) })).status === 401, 'login com senha errada → 401');
  ok((await rest('/auth/me')).body.email === email, '/auth/me devolve o usuário logado');
  const created = await rest('/quizzes', { method: 'POST', body: JSON.stringify(quiz()) });
  ok(created.status === 201 && created.body.id, 'cria quiz via REST');
  ok((await rest('/quizzes')).body.length === 1, 'lista mostra 1 quiz do dono');
  ok((await rest(`/quizzes/${created.body.id}`, { method: 'DELETE' })).status === 204, 'exclui quiz (204)');
  ok((await rest('/quizzes')).body.length === 0, 'biblioteca vazia após excluir');

  // ── 2. Partida individual completa (2 perguntas, 3 jogadores) ──
  section('Partida individual (host + 3 jogadores)');
  const host = await connect();
  const { pin } = (await emitAck(host, 'host:createRoom', { quiz: quiz() })).valueOf();
  ok(!!pin, `sala criada (pin ${pin})`);

  // Sala pública por PIN (rota REST usada pelo player antes de entrar)
  ok((await fetch(`${URL}/api/room/${pin}`)).status === 200, 'GET /api/room/:pin público responde 200');

  const names = ['Ana', 'Bruno', 'Carla'];
  const players = [];
  for (let i = 0; i < names.length; i++) {
    const s = await connect();
    const ack = await emitAck(s, 'player:join', { pin, nickname: names[i], playerId: 'p' + i, avatar: '🦊' });
    ok(ack.ok, `${names[i]} entrou`);
    players.push(s);
  }

  // Rejeições de entrada
  const dupSock = await connect();
  ok(!(await emitAck(dupSock, 'player:join', { pin, nickname: 'Ana', playerId: 'zz', avatar: '🦊' })).ok, 'apelido duplicado é rejeitado');
  ok(!(await emitAck(dupSock, 'player:join', { pin: '000000', nickname: 'X', playerId: 'x', avatar: '🦊' })).ok, 'PIN inexistente é rejeitado');

  // Pergunta 1: cada um responde (Ana correta e mais rápida)
  const q1 = players.map((s) => new Promise((r) => s.once('game:question:player', r)));
  host.emit('host:startGame');
  await Promise.all(q1);
  ok(true, 'game:startGame → todos recebem a pergunta');
  const ans = async (s, idx) => (await emitAck(s, 'player:submitAnswer', { optionIndex: idx })).valueOf();
  const rA = await ans(players[0], 0); // correta
  const rB = await ans(players[1], 0); // correta (depois → menos pontos)
  const rC = await ans(players[2], 1); // errada
  ok(rA.isCorrect === true && rA.pointsAwarded > 0, 'Ana acertou e pontuou');
  ok(rC.isCorrect === false && rC.pointsAwarded === 0, 'Carla errou (0 ponto)');
  ok(rA.pointsAwarded >= rB.pointsAwarded, 'quem respondeu antes pontua ≥');

  // Reveal automático (todos responderam) — host recebe game:reveal
  const reveal1 = await new Promise((r) => host.once('game:reveal', r));
  ok(Array.isArray(reveal1.leaderboard) && reveal1.leaderboard[0].nickname === 'Ana', 'reveal: Ana lidera o placar');
  ok(reveal1.distribution[0] === 2 && reveal1.distribution[1] === 1, 'reveal: distribuição correta (2 na A, 1 na B)');

  // Pergunta 2
  const q2 = players.map((s) => new Promise((r) => s.once('game:question:player', r)));
  host.emit('host:nextQuestion');
  await Promise.all(q2);
  await ans(players[0], 1); await ans(players[1], 1); await ans(players[2], 1); // todos certos
  await new Promise((r) => host.once('game:reveal', r));

  // Fim de jogo → pódio
  const over = new Promise((r) => host.once('game:over', r));
  host.emit('host:nextQuestion');
  const fim = await over;
  ok(Array.isArray(fim.podium) && fim.podium.length <= 3 && fim.podium[0].nickname === 'Ana', 'game:over: pódio com Ana em 1º');

  host.close(); players.forEach((s) => s.close()); dupSock.close();

  // ── 3. Power-up 50/50 e reconexão ──
  section('Power-up 50/50 + reconexão');
  const h2 = await connect();
  const pin2 = (await emitAck(h2, 'host:createRoom', { quiz: quiz() })).pin;
  const pl = await connect();
  await emitAck(pl, 'player:join', { pin: pin2, nickname: 'Zé', playerId: 'zp', avatar: '🦊' });
  const gotQ = new Promise((r) => pl.once('game:question:player', r));
  h2.emit('host:startGame');
  await gotQ;
  const kept = await emitAck(pl, 'player:usePowerup', { type: 'fiftyFifty' });
  ok(kept.ok && Array.isArray(kept.keep) && kept.keep.length === 2 && kept.keep.includes(0), '50/50 devolve 2 opções incluindo a correta');

  // Reconexão: novo socket com o MESMO playerId reassume o estado
  pl.close();
  const pl2 = await connect();
  const reack = await emitAck(pl2, 'player:join', { pin: pin2, nickname: 'Zé', playerId: 'zp', avatar: '🦊' });
  ok(reack.ok, 'reconexão com mesmo playerId é aceita');
  h2.close(); pl2.close();

  // ── 4. Pergunta digitada (type text) aceita variações normalizadas ──
  section('Pergunta digitada (normalização de resposta)');
  const h3 = await connect();
  const textQuiz = { title: 'T', questions: [{ text: 'Capital?', type: 'text', acceptedAnswers: ['Brasília'], timeLimitSec: 20, points: 1000, options: [] }] };
  const pin3 = (await emitAck(h3, 'host:createRoom', { quiz: textQuiz })).pin;
  const pt = await connect();
  await emitAck(pt, 'player:join', { pin: pin3, nickname: 'Ty', playerId: 'ty', avatar: '🦊' });
  const gq = new Promise((r) => pt.once('game:question:player', r));
  h3.emit('host:startGame');
  await gq;
  const textAns = await emitAck(pt, 'player:submitAnswer', { text: '  BRASILIA ' }); // sem acento, caixa/espaço
  ok(textAns.isCorrect === true, 'resposta digitada "BRASILIA" casa com "Brasília" (normalizada)');
  h3.close(); pt.close();

  console.log(`\n${pass}/${pass + fail} checagens passaram`);
  clearTimeout(HARD_TIMEOUT);
  srv.kill();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('ERRO', e, '\n', log.slice(-1500)); srv.kill(); process.exit(1); });
