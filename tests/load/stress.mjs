// Teste de carga: N salas simultâneas × M jogadores, cada sala jogando 1 rodada.
// Mede entradas, respostas, reveals e tempos. Uso: node tests/load/stress.mjs
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const ROOMS = Number(process.env.ROOMS) || 10;
const PER_ROOM = Number(process.env.PER_ROOM) || 50;
const PORT = 3096;
const URL = `http://localhost:${PORT}`;
const HARD = setTimeout(() => { console.error('❌ TIMEOUT'); process.exit(1); }, 120_000);

const srv = spawn('npx', ['tsx', 'apps/server/src/main.ts'], {
  // Por padrão usa os limites reais do código (realismo de turma num só IP).
  // RAW_CAPACITY=1 desliga os limites para medir a CAPACIDADE pura do servidor.
  env: {
    ...process.env, PORT: String(PORT), NODE_ENV: 'development', SESSION_SECRET: 'load',
    ...(process.env.RAW_CAPACITY ? { API_RATE_MAX: '1000000', JOIN_RATE_MAX: '1000000', ANSWER_RATE_MAX: '1000000', CREATE_ROOM_RATE_MAX: '1000000' } : {}),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => (log += d));
srv.stderr.on('data', (d) => (log += d));

const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 20000 });
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
});
const emitAck = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: 'ack timeout' }), 20000); s.emit(ev, p, (a) => { clearTimeout(t); res(a); }); });
const waitUp = async () => { for (let i = 0; i < 80; i++) { try { if ((await fetch(URL + '/api/status')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error('server down'); };

const quiz = { title: 'Load', questions: [{ text: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, timeLimitSec: 30, points: 1000 }] };

const stats = { hosts: 0, joins: 0, joinErr: 0, answers: 0, ansErr: 0, reveals: 0, roomErr: 0 };

async function runRoom(i) {
  try {
    const host = await connect();
    const ack = await emitAck(host, 'host:createRoom', { quiz });
    if (!ack.ok || !ack.pin) { stats.roomErr++; return; }
    stats.hosts++;
    const pin = ack.pin;

    const players = [];
    await Promise.all(Array.from({ length: PER_ROOM }, async (_, j) => {
      try {
        const s = await connect();
        const a = await emitAck(s, 'player:join', { pin, nickname: `R${i}P${j}`, playerId: `r${i}p${j}`, avatar: '🦊' });
        if (a.ok) { stats.joins++; players.push(s); } else stats.joinErr++;
      } catch { stats.joinErr++; }
    }));

    const revealed = new Promise((r) => host.once('game:reveal', r));
    const gotQ = players.map((s) => new Promise((r) => s.once('game:question:player', () => r())));
    host.emit('host:startGame');
    await Promise.all(gotQ);
    await Promise.all(players.map(async (s) => {
      const a = await emitAck(s, 'player:submitAnswer', { optionIndex: Math.floor(Math.random() * 4) });
      if (a && a.isCorrect !== undefined) stats.answers++; else stats.ansErr++;
    }));
    await revealed; stats.reveals++;
    host.close(); players.forEach((s) => s.close());
  } catch (e) { stats.roomErr++; }
}

async function main() {
  await waitUp();
  const expected = ROOMS * PER_ROOM;
  console.log(`▶ Carga: ${ROOMS} salas × ${PER_ROOM} jogadores = ${expected} jogadores simultâneos\n`);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: ROOMS }, (_, i) => runRoom(i)));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('Salas hospedadas :', stats.hosts, '/', ROOMS);
  console.log('Entradas OK      :', stats.joins, '/', expected, `(erros: ${stats.joinErr})`);
  console.log('Respostas OK     :', stats.answers, `(erros: ${stats.ansErr})`);
  console.log('Reveals recebidos:', stats.reveals, '/', ROOMS);
  console.log('Erros de sala    :', stats.roomErr);
  console.log('Tempo total      :', secs + 's');

  const okAll = stats.hosts === ROOMS && stats.joins === expected && stats.reveals === ROOMS && stats.joinErr === 0 && stats.ansErr === 0 && stats.roomErr === 0;
  console.log(`\n${okAll ? '✅ CARGA OK — sem perdas' : '❌ houve perdas sob carga'}`);
  if (!okAll) console.error(log.slice(-1500));
  clearTimeout(HARD); srv.kill(); process.exit(okAll ? 0 : 1);
}
main().catch((e) => { console.error('ERRO', e, '\n', log.slice(-1500)); srv.kill(); process.exit(1); });
