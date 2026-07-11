import { useEffect, useRef, useState } from 'react';

/** Barra que encolhe de 100% a 0 ao longo de `durationSec`. Reinicia quando `resetKey` muda. */
export function TimerBar({ durationSec, resetKey, paused = false }: { durationSec: number; resetKey: number | string; paused?: boolean }) {
  const [width, setWidth] = useState('100%');
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWidth('100%');
    const id = requestAnimationFrame(() => setWidth('0%'));
    return () => cancelAnimationFrame(id);
  }, [resetKey]);

  // Ao pausar, fixa a largura atual (congela a transição); ao retomar, o pai
  // re-chaveia a barra com o tempo restante, então ela reinicia limpa.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    if (paused) {
      const w = getComputedStyle(el).width;
      el.style.transition = 'none';
      el.style.width = w;
    }
  }, [paused]);

  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-black/10">
      <div
        ref={barRef}
        className="h-full"
        style={{ width, background: 'var(--k-primary, #6366f1)', transition: `width ${durationSec}s linear` }}
      />
    </div>
  );
}
