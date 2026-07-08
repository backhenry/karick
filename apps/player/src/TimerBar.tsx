import { useEffect, useState } from 'react';

/**
 * Barra + contagem regressiva numérica. Reinicia quando `resetKey` muda.
 * Chama `onExpire` quando o tempo acaba (para desabilitar os botões no cliente).
 */
export function TimerBar({
  durationSec,
  resetKey,
  onExpire,
}: {
  durationSec: number;
  resetKey: number | string;
  onExpire?: () => void;
}) {
  const [width, setWidth] = useState('100%');
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    setWidth('100%');
    setRemaining(durationSec);
    const raf = requestAnimationFrame(() => setWidth('0%'));

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, durationSec - (Date.now() - startedAt) / 1000);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 200);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
    // onExpire é estável o suficiente; reiniciamos só quando a pergunta muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, durationSec]);

  return (
    <div className="p-3">
      <div className="mb-1 text-center text-2xl font-black text-slate-700">{Math.ceil(remaining)}</div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-indigo-500"
          style={{ width, transition: `width ${durationSec}s linear` }}
        />
      </div>
    </div>
  );
}
