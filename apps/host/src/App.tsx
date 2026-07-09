import { useState, type ReactNode } from 'react';
import { OPTION_COLORS, OPTION_SHAPES, type QuizDraft } from '@karick/shared';
import { useHostSocket } from './hooks/useHostSocket.js';
import { QuizEditor } from './QuizEditor.js';
import { Library } from './Library.js';
import { TimerBar } from './TimerBar.js';
import { emptyDraft } from './lib/quizStorage.js';

type PreGameView =
  | { screen: 'LIBRARY' }
  | { screen: 'EDITOR'; draft: QuizDraft; quizId: string | null };

export function App() {
  const g = useHostSocket();
  const [view, setView] = useState<PreGameView>({ screen: 'LIBRARY' });

  // ─── PRÉ-JOGO: biblioteca ou editor ───
  if (g.phase === 'PREGAME') {
    if (view.screen === 'EDITOR')
      return (
        <div className="min-h-screen bg-slate-900">
          <QuizEditor
            connected={g.connected}
            initialDraft={view.draft}
            quizId={view.quizId}
            onStart={g.createRoom}
            onBack={() => setView({ screen: 'LIBRARY' })}
            onSavedId={(id) => setView((v) => (v.screen === 'EDITOR' ? { ...v, quizId: id } : v))}
          />
        </div>
      );
    return (
      <div className="min-h-screen bg-slate-900">
        <Library
          onNew={() => setView({ screen: 'EDITOR', draft: emptyDraft(), quizId: null })}
          onEdit={(quizId, draft) => setView({ screen: 'EDITOR', draft, quizId })}
          onHost={(draft) => g.createRoom(draft)}
        />
      </div>
    );
  }

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

  // ─── REVEAL: resposta certa + placar com ganhos e variação ───
  if (g.phase === 'REVEAL' && g.reveal) {
    const isLast = g.question ? g.question.index >= g.question.total - 1 : false;
    return (
      <div className="min-h-screen bg-slate-900 p-10 text-white">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="mb-2 text-lg text-white/50">Resposta certa</p>
          <div
            className="inline-flex items-center gap-3 rounded-xl px-8 py-4 text-3xl font-bold"
            style={{ background: OPTION_COLORS[g.reveal.correctIndex] }}
          >
            <span className="text-4xl">{OPTION_SHAPES[g.reveal.correctIndex]}</span>
            {g.reveal.correctText}
          </div>
        </div>

        <h2 className="mb-4 text-center text-3xl font-bold">Placar</h2>
        <ol className="mx-auto max-w-2xl space-y-3">
          {g.reveal.leaderboard.slice(0, 8).map((r) => (
            <li key={r.nickname} className="flex items-center justify-between rounded-lg bg-white/10 px-6 py-3 text-2xl">
              <span className="flex items-center gap-3">
                <RankDelta delta={r.rankDelta} />
                {r.rank}. {r.nickname}
              </span>
              <span className="flex items-baseline gap-3">
                {r.gained ? <span className="text-lg font-bold text-green-400">+{r.gained}</span> : <span className="text-lg text-white/30">+0</span>}
                <span className="font-bold">{r.score}</span>
              </span>
            </li>
          ))}
        </ol>

        <button
          onClick={g.next}
          className="mx-auto mt-10 block rounded-xl bg-blue-500 px-10 py-4 text-2xl font-bold hover:bg-blue-400"
        >
          {isLast ? 'Ver pódio 🏆' : 'Próxima →'}
        </button>
      </div>
    );
  }

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

function RankDelta({ delta }: { delta?: number }) {
  if (delta === undefined) return <span className="w-8 text-center text-sm text-white/30">•</span>;
  if (delta > 0) return <span className="w-8 text-center text-sm font-bold text-green-400">▲{delta}</span>;
  if (delta < 0) return <span className="w-8 text-center text-sm font-bold text-red-400">▼{-delta}</span>;
  return <span className="w-8 text-center text-sm text-white/30">—</span>;
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
