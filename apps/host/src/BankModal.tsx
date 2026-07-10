import { useEffect, useState } from 'react';
import type { BankQuestion, QuizDraft } from '@karick/shared';
import { api } from './lib/api.js';

/** Banco de perguntas: sortear N de uma tag para montar um quiz, ou remover perguntas. */
export function BankModal({ onDraw, onClose }: { onDraw: (draft: QuizDraft) => void; onClose: () => void }) {
  const [items, setItems] = useState<BankQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState<string>('__all__');
  const [count, setCount] = useState(5);

  const refresh = () => api.listBank().then(setItems).catch((e) => setError((e as Error).message));
  useEffect(() => {
    refresh();
  }, []);

  const allTags = [...new Set((items ?? []).flatMap((i) => i.tags))].sort();
  const pool = (items ?? []).filter((i) => tag === '__all__' || i.tags.includes(tag));

  const draw = () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.max(1, count));
    onDraw({
      title: tag === '__all__' ? 'Sorteio do banco' : `Sorteio: ${tag}`,
      questions: shuffled.map((i) => i.question),
      tags: tag === '__all__' ? [] : [tag],
    });
  };

  const remove = async (id: string) => {
    await api.removeBank(id).catch((e) => setError((e as Error).message));
    refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-slate-800 p-6 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Banco de perguntas</h2>
          <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">Fechar ✕</button>
        </div>

        {error && <p className="mb-3 rounded bg-red-500/20 p-2 text-sm text-red-300">{error}</p>}

        {items === null ? (
          <p className="text-white/50">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg bg-white/5 p-6 text-center text-white/50">
            Banco vazio. No editor, use <b>“Enviar ao banco”</b> para guardar perguntas aqui.
          </p>
        ) : (
          <>
            <div className="mb-3 rounded-lg bg-white/5 p-3">
              <p className="mb-2 text-sm text-white/70">Sortear perguntas e montar um quiz:</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded bg-white/10 p-2 text-sm">
                  <option value="__all__">Todas ({items.length})</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      #{t} ({items.filter((i) => i.tags.includes(t)).length})
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm">
                  N:
                  <input
                    type="number"
                    min={1}
                    max={pool.length || 1}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-16 rounded bg-white/10 p-1 text-center"
                  />
                </label>
                <button
                  onClick={draw}
                  disabled={pool.length === 0}
                  className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-400 disabled:opacity-40"
                >
                  🎲 Sortear {Math.min(count, pool.length)} de {pool.length}
                </button>
              </div>
            </div>

            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded bg-white/5 p-2 text-sm">
                  <span className="min-w-0">
                    <span className="truncate">{i.question.text || '(sem enunciado)'}</span>
                    {i.tags.length > 0 && <span className="ml-2 text-xs text-indigo-300">{i.tags.map((t) => `#${t}`).join(' ')}</span>}
                  </span>
                  <button onClick={() => remove(i.id)} className="shrink-0 text-white/30 hover:text-red-400">✕</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
