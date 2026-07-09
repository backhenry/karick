import { useState } from 'react';
import type { QuizDraft } from '@karick/shared';
import { OPTION_COLORS, OPTION_SHAPES } from '@karick/shared';

/** Prévia (somente leitura) de como as perguntas aparecem na tela do Host. */
export function QuizPreview({ draft, onClose }: { draft: QuizDraft; onClose: () => void }) {
  const [i, setI] = useState(0);
  const q = draft.questions[i];
  if (!q) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between p-4 text-slate-500">
        <span className="text-lg font-bold">
          Prévia · {i + 1}/{draft.questions.length}
        </span>
        <button onClick={onClose} className="rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-300">
          Fechar ✕
        </button>
      </div>

      <h2 className="px-8 pt-4 text-center text-4xl font-bold text-slate-800">{q.text || '(sem enunciado)'}</h2>

      {q.imageUrl && /^https?:\/\//i.test(q.imageUrl) && (
        <div className="flex justify-center px-8 py-3">
          <img src={q.imageUrl} alt="" className="max-h-[28vh] rounded-xl object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 gap-4 p-6">
        {q.options.map((opt, oi) => {
          const isCorrect = oi === q.correctIndex;
          return (
            <div
              key={oi}
              className="flex items-center gap-4 rounded-xl p-6 text-2xl font-bold text-white"
              style={{ background: OPTION_COLORS[oi], opacity: isCorrect ? 1 : 0.55 }}
            >
              <span className="text-4xl">{OPTION_SHAPES[oi]}</span>
              {opt || `Opção ${oi + 1}`}
              {isCorrect && <span className="ml-auto">✓</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 p-4">
        <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="rounded-lg bg-slate-200 px-6 py-3 font-bold disabled:opacity-40">
          ← Anterior
        </button>
        <span className="text-slate-500">{q.timeLimitSec}s · {q.points} pts</span>
        <button onClick={() => setI((v) => Math.min(draft.questions.length - 1, v + 1))} disabled={i >= draft.questions.length - 1} className="rounded-lg bg-slate-200 px-6 py-3 font-bold disabled:opacity-40">
          Próxima →
        </button>
      </div>
    </div>
  );
}
