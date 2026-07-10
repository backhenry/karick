import { useEffect, useState } from 'react';

/** Barra que encolhe de 100% a 0 ao longo de `durationSec`. Reinicia quando `resetKey` muda. */
export function TimerBar({ durationSec, resetKey }: { durationSec: number; resetKey: number | string }) {
  const [width, setWidth] = useState('100%');

  useEffect(() => {
    setWidth('100%');
    const id = requestAnimationFrame(() => setWidth('0%'));
    return () => cancelAnimationFrame(id);
  }, [resetKey]);

  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-black/10">
      <div
        className="h-full"
        style={{ width, background: 'var(--k-primary, #6366f1)', transition: `width ${durationSec}s linear` }}
      />
    </div>
  );
}
