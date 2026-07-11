import { useEffect, useState } from 'react';
import type { QuizSummary } from '@karick/shared';
import { api } from './lib/api.js';
import { useEscape } from './lib/useEscape.js';

/** Galeria pública: descobrir quizzes de outros e clonar para a própria biblioteca. */
export function GalleryModal({ onClose, onCloned }: { onClose: () => void; onCloned: () => void }) {
  useEscape(onClose);
  const [items, setItems] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.gallery().then(setItems).catch((e) => setError((e as Error).message));
  }, []);

  const clone = async (id: string, title: string) => {
    setBusy(id);
    try {
      const quiz = await api.galleryQuiz(id);
      await api.createQuiz({ title: `Cópia de ${quiz.title}`, questions: quiz.questions, tags: quiz.tags });
      setMsg(`“${title}” copiado para a sua biblioteca ✓`);
      setTimeout(() => setMsg(null), 3000);
      onCloned();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-slate-800 p-6 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold">🌐 Galeria pública</h2>
          <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">Fechar ✕</button>
        </div>

        {error && <p className="mb-3 rounded bg-red-500/20 p-2 text-sm text-red-300">{error}</p>}
        {msg && <p className="mb-3 rounded bg-green-500/20 p-2 text-sm text-green-300">{msg}</p>}

        {items === null ? (
          <p className="text-white/50">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg bg-white/5 p-6 text-center text-white/50">
            Nenhum quiz público ainda. Marque um quiz como <b>público</b> no editor para aparecer aqui.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {items.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{q.title}</p>
                  <p className="text-xs text-white/40">
                    {q.questionCount} pergunta{q.questionCount !== 1 ? 's' : ''} · {fmt(q.updatedAt)}
                    {q.tags.length > 0 && ' · ' + q.tags.map((t) => `#${t}`).join(' ')}
                  </p>
                </div>
                <button
                  onClick={() => clone(q.id, q.title)}
                  disabled={busy === q.id}
                  className="shrink-0 rounded bg-green-500 px-3 py-2 text-sm font-bold text-white hover:bg-green-400 disabled:opacity-50"
                >
                  Usar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
