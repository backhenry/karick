import { useState } from 'react';
import type { QuizDraft } from '@karick/shared';
import { OPTION_COLORS, OPTION_SHAPES } from '@karick/shared';
import { QuestionMedia } from './QuestionMedia.js';
import { useEscape } from './lib/useEscape.js';
import { useI18n } from './i18n.js';

/** Prévia (somente leitura) de como as perguntas aparecem na tela do Host. */
export function QuizPreview({ draft, onClose }: { draft: QuizDraft; onClose: () => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  useEscape(onClose);
  const q = draft.questions[i];
  if (!q) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between p-4 text-slate-500">
        <span className="text-lg font-bold">
          {t('previewHeader', { i: i + 1, n: draft.questions.length })}
        </span>
        <button onClick={onClose} className="rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-300">
          {t('closeX')}
        </button>
      </div>

      <h2 className="px-8 pt-4 text-center text-4xl font-bold text-slate-800">{q.text || t('noStatement')}</h2>

      {q.imageUrl && /^https?:\/\//i.test(q.imageUrl) && (
        <div className="flex justify-center px-8 py-3">
          <img src={q.imageUrl} alt="" className="max-h-[28vh] rounded-xl object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      )}

      {(q.audioUrl || q.videoUrl || q.code || q.latex) && (
        <div className="py-2">
          <QuestionMedia audioUrl={q.audioUrl} videoUrl={q.videoUrl} audioOnly={q.audioOnly} code={q.code} latex={q.latex} />
        </div>
      )}

      {(q.type ?? 'choice') === 'text' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-slate-600">
          <span className="text-6xl">✍️</span>
          <p className="text-2xl font-bold">{t('typedAnswerLabel')}</p>
          <p className="rounded-lg bg-slate-100 px-4 py-2 text-lg">
            {t('acceptedLabel')} <b>{(q.acceptedAnswers ?? []).filter((a) => a.trim()).join(', ') || t('noneYet')}</b>
          </p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-4 p-6">
          {q.options.map((opt, oi) => {
            const isPoll = q.type === 'poll';
            const isCorrect = !isPoll && oi === q.correctIndex;
            return (
              <div
                key={oi}
                className="flex items-center gap-4 rounded-xl p-6 text-2xl font-bold text-white"
                style={{ background: OPTION_COLORS[oi], opacity: isPoll || isCorrect ? 1 : 0.55 }}
              >
                <span className="text-4xl">{OPTION_SHAPES[oi]}</span>
                {opt || t('optionN', { n: oi + 1 })}
                {isCorrect && <span className="ml-auto">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 p-4">
        <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="rounded-lg bg-slate-200 px-6 py-3 font-bold disabled:opacity-40">
          {t('prevArrow')}
        </button>
        <span className="text-slate-500">{q.timeLimitSec}s · {q.points} pts</span>
        <button onClick={() => setI((v) => Math.min(draft.questions.length - 1, v + 1))} disabled={i >= draft.questions.length - 1} className="rounded-lg bg-slate-200 px-6 py-3 font-bold disabled:opacity-40">
          {t('nextArrow2')}
        </button>
      </div>
    </div>
  );
}
