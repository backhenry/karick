import { useEffect, useState } from 'react';
import type { QuizDraft, Question } from '@karick/shared';
import {
  OPTION_COLORS,
  OPTION_SHAPES,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MIN_TIME_LIMIT,
  MAX_TIME_LIMIT,
  validateQuiz,
} from '@karick/shared';
import { loadDraft, saveDraft, emptyQuestion, exampleQuiz } from './lib/quizStorage.js';

interface Props {
  connected: boolean;
  onStart: (quiz: QuizDraft) => Promise<string | null>;
}

export function QuizEditor({ connected, onStart }: Props) {
  const [draft, setDraft] = useState<QuizDraft>(loadDraft);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => saveDraft(draft), [draft]);

  const update = (fn: (d: QuizDraft) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const patchQuestion = (qi: number, fn: (q: Question) => void) =>
    update((d) => fn(d.questions[qi]));

  const start = async () => {
    const err = validateQuiz(draft);
    if (err) return setError(err);
    setError(null);
    setStarting(true);
    const serverErr = await onStart(draft);
    setStarting(false);
    if (serverErr) setError(serverErr);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-black text-indigo-400">Karick</h1>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setDraft(exampleQuiz())} className="rounded bg-white/10 px-3 py-2 hover:bg-white/20">
            Carregar exemplo
          </button>
          <button
            onClick={() => setDraft({ title: '', questions: [emptyQuestion()] })}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            Limpar
          </button>
        </div>
      </header>

      <input
        value={draft.title}
        onChange={(e) => update((d) => (d.title = e.target.value))}
        placeholder="Título do quiz"
        className="mb-6 w-full rounded-lg bg-white/10 p-4 text-2xl font-bold outline-none placeholder:text-white/40"
      />

      <div className="space-y-6">
        {draft.questions.map((q, qi) => (
          <div key={qi} className="rounded-xl bg-white/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold text-white/70">Pergunta {qi + 1}</span>
              <div className="flex gap-2 text-sm">
                <span className="text-white/40">
                  {q.timeLimitSec}s · {q.points} pts
                </span>
                {draft.questions.length > 1 && (
                  <button
                    onClick={() => update((d) => d.questions.splice(qi, 1))}
                    className="rounded bg-red-500/20 px-2 py-1 text-red-300 hover:bg-red-500/30"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={q.text}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.text = e.target.value))}
              placeholder="Enunciado da pergunta"
              rows={2}
              className="mb-3 w-full resize-none rounded-lg bg-white/10 p-3 outline-none placeholder:text-white/40"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => (
                <div
                  key={oi}
                  className="flex items-center gap-2 rounded-lg p-2"
                  style={{ background: OPTION_COLORS[oi] + '33' }}
                >
                  <span className="text-xl" style={{ color: OPTION_COLORS[oi] }}>
                    {OPTION_SHAPES[oi]}
                  </span>
                  <input
                    value={opt}
                    onChange={(e) => patchQuestion(qi, (qq) => (qq.options[oi] = e.target.value))}
                    placeholder={`Opção ${oi + 1}`}
                    className="flex-1 bg-transparent outline-none placeholder:text-white/40"
                  />
                  <label className="flex items-center gap-1 text-xs text-white/70">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => patchQuestion(qi, (qq) => (qq.correctIndex = oi))}
                    />
                    correta
                  </label>
                  {q.options.length > MIN_OPTIONS && (
                    <button
                      onClick={() =>
                        patchQuestion(qi, (qq) => {
                          qq.options.splice(oi, 1);
                          if (qq.correctIndex >= qq.options.length) qq.correctIndex = 0;
                        })
                      }
                      className="text-white/40 hover:text-red-300"
                      title="Remover opção"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {q.options.length < MAX_OPTIONS && (
                <button
                  onClick={() => patchQuestion(qi, (qq) => qq.options.push(''))}
                  className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                >
                  + opção
                </button>
              )}
              <label className="flex items-center gap-2">
                Tempo (s):
                <input
                  type="number"
                  min={MIN_TIME_LIMIT}
                  max={MAX_TIME_LIMIT}
                  value={q.timeLimitSec}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.timeLimitSec = Number(e.target.value)))}
                  className="w-16 rounded bg-white/10 p-1 text-center outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                Pontos:
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={q.points}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.points = Number(e.target.value)))}
                  className="w-20 rounded bg-white/10 p-1 text-center outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => update((d) => d.questions.push(emptyQuestion()))}
        className="mt-6 w-full rounded-xl border-2 border-dashed border-white/20 py-4 text-white/60 hover:border-white/40 hover:text-white"
      >
        + Adicionar pergunta
      </button>

      {error && <p className="mt-4 rounded-lg bg-red-500/20 p-3 text-center text-red-300">{error}</p>}

      <button
        onClick={start}
        disabled={starting || !connected}
        className="mt-4 w-full rounded-xl bg-green-500 py-4 text-2xl font-bold text-white transition hover:bg-green-400 disabled:opacity-40"
      >
        {!connected ? 'Conectando…' : starting ? 'Criando sala…' : 'Iniciar hospedagem →'}
      </button>
    </div>
  );
}
