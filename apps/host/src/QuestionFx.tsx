import { useEffect, useState } from 'react';
import { reducedMotion } from './lib/motion.js';
import { useI18n } from './i18n.js';

/**
 * Imagem que se revela: começa borrada/ampliada e fica nítida ao longo
 * de `durationSec` — responder cedo (imagem ruim) vale mais pontos.
 */
export function RevealImage({ src, durationSec, resetKey, className }: { src: string; durationSec: number; resetKey: number | string; className?: string }) {
  const [sharp, setSharp] = useState(false);
  useEffect(() => {
    setSharp(false);
    const id = requestAnimationFrame(() => setSharp(true));
    return () => cancelAnimationFrame(id);
  }, [resetKey]);
  return (
    <div className="overflow-hidden rounded-xl">
      <img
        src={src}
        alt=""
        className={className ?? 'max-h-[32vh] object-contain'}
        style={{
          filter: sharp ? 'blur(0px)' : 'blur(26px)',
          transform: sharp ? 'scale(1)' : 'scale(1.18)',
          transition: `filter ${durationSec}s linear, transform ${durationSec}s linear`,
        }}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </div>
  );
}

/**
 * "Quem sou eu?": dicas aparecem uma a uma, distribuídas pelo tempo da
 * pergunta (a 1ª é imediata) — cada dica nova derruba o valor de responder.
 */
export function Hints({ hints, durationSec, resetKey }: { hints: string[]; durationSec: number; resetKey: number | string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(1);
  useEffect(() => {
    setShown(1);
    const stepMs = (durationSec * 1000) / hints.length;
    const ids = hints.slice(1).map((_, i) => setTimeout(() => setShown((s) => Math.max(s, i + 2)), stepMs * (i + 1)));
    return () => ids.forEach(clearTimeout);
  }, [resetKey, durationSec, hints.length]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-10 py-3">
      {hints.slice(0, shown).map((h, i) => (
        <HintRow key={i} label={t('hintN', { n: i + 1 })} text={h} />
      ))}
      {shown < hints.length && (
        <p className="text-center text-sm text-white/40">{t('nextHint', { shown, total: hints.length })}</p>
      )}
    </div>
  );
}

function HintRow({ label, text }: { label: string; text: string }) {
  const [inScreen, setIn] = useState(reducedMotion());
  useEffect(() => {
    const id = requestAnimationFrame(() => setIn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className="rounded-lg bg-white/10 px-4 py-2 text-2xl text-white"
      style={{ opacity: inScreen ? 1 : 0, transform: inScreen ? 'translateY(0)' : 'translateY(8px)', transition: reducedMotion() ? 'none' : 'opacity 400ms, transform 400ms' }}
    >
      <b className="mr-2 text-white/50">{label}</b>
      {text}
    </div>
  );
}
