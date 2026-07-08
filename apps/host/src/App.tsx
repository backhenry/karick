import type { ReactNode } from 'react';
import { OPTION_COLORS, OPTION_SHAPES } from '@karick/shared';
import { useHostSocket } from './hooks/useHostSocket.js';
import { QuizEditor } from './QuizEditor.js';
import { TimerBar } from './TimerBar.js';

export function App() {
  const g = useHostSocket();

  // ─── EDITOR: monta o quiz e cria a sala ───
  if (g.phase === 'EDITOR')
    return (
      <div className="min-h-screen bg-slate-900">
        <QuizEditor connected={g.connected} onStart={g.createRoom} />
      </div>
    );

  // ─── LOBBY: PIN gigante + jogadores entrando ───
  if (g.phase === 'LOBBY')
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-900 text-white">
        <p className="text-2xl opacity-70">Entre no app do jogador com o PIN</p>
        <h1 className="text-8xl font-black tracking-[0.2em]">{g.pin || '…'}</h1>
        <div className="flex max-w-4xl flex-wrap justify-center gap-2">
          {g.players.map((p) => (
            <span key={p.nickname} className="rounded-full bg-white/10 px-4 py-2 text-lg">
              {p.nickname}
            </span>
          ))}
        </div>
        <button
          onClick={g.start}
          disabled={g.players.length === 0}
          className="rounded-xl bg-green-500 px-10 py-4 text-2xl font-bold disabled:opacity-40"
        >
          Iniciar ({g.players.length})
        </button>
      </div>
    );

  // ─── QUESTION: pergunta + opções + tempo + progresso ───
  if (g.phase === 'QUESTION' && g.question)
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <div className="flex items-center justify-between p-6 text-slate-500">
          <span className="text-xl">
            Pergunta {g.question.index + 1} de {g.question.total}
          </span>
          <span className="rounded-full bg-slate-100 px-4 py-1 text-xl font-bold text-slate-700">
            {g.answeredCount}/{g.players.length} responderam
          </span>
        </div>

        <div className="px-10">
          <TimerBar durationSec={g.question.timeLimitSec} resetKey={g.question.index} />
        </div>

        <h2 className="px-10 py-8 text-center text-5xl font-bold text-slate-800">{g.question.text}</h2>

        <div className="grid flex-1 grid-cols-2 gap-4 p-6">
          {g.question.options.map((opt, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl p-6 text-3xl font-bold text-white"
              style={{ background: OPTION_COLORS[i] }}
            >
              <span className="text-5xl">{OPTION_SHAPES[i]}</span> {opt}
            </div>
          ))}
        </div>
      </div>
    );

  // ─── REVEAL: leaderboard entre perguntas ───
  if (g.phase === 'REVEAL' && g.reveal)
    return (
      <div className="min-h-screen bg-slate-900 p-10 text-white">
        <h2 className="mb-8 text-center text-4xl font-bold">Placar</h2>
        <ol className="mx-auto max-w-2xl space-y-3">
          {g.reveal.leaderboard.slice(0, 8).map((r) => (
            <li key={r.rank} className="flex justify-between rounded-lg bg-white/10 px-6 py-3 text-2xl">
              <span>
                {r.rank}. {r.nickname}
              </span>
              <span className="font-bold">{r.score}</span>
            </li>
          ))}
        </ol>
        <button
          onClick={g.next}
          className="mx-auto mt-10 block rounded-xl bg-blue-500 px-10 py-4 text-2xl font-bold hover:bg-blue-400"
        >
          Próxima →
        </button>
      </div>
    );

  // ─── OVER: pódio final ───
  if (g.phase === 'OVER')
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 text-white">
        <h1 className="text-6xl font-black">🏆 Pódio</h1>
        {g.podium.map((r) => (
          <div key={r.rank} className="text-3xl">
            {['🥇', '🥈', '🥉'][r.rank - 1]} {r.nickname} — {r.score} pts
          </div>
        ))}
        <button
          onClick={() => location.reload()}
          className="mt-6 rounded-xl bg-white/10 px-8 py-3 text-xl hover:bg-white/20"
        >
          Novo jogo
        </button>
      </div>
    );

  return <Screen dark>Carregando…</Screen>;
}

function Screen({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-screen items-center justify-center p-6 text-center text-2xl ${
        dark ? 'bg-slate-900 text-white' : 'text-slate-700'
      }`}
    >
      {children}
    </div>
  );
}
