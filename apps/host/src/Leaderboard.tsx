import { useEffect, useState } from 'react';
import type { LeaderboardRow } from '@karick/shared';
import { reducedMotion } from './lib/motion.js';

function RankDelta({ delta }: { delta?: number }) {
  if (delta === undefined) return <span className="w-8 text-center text-sm text-white/30">•</span>;
  if (delta > 0) return <span className="w-8 text-center text-sm font-bold text-green-400">▲{delta}</span>;
  if (delta < 0) return <span className="w-8 text-center text-sm font-bold text-red-400">▼{-delta}</span>;
  return <span className="w-8 text-center text-sm text-white/30">—</span>;
}

function Bar({ row, pct }: { row: LeaderboardRow; pct: number }) {
  const [width, setWidth] = useState('0%');
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(`${pct}%`));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-white/10 px-6 py-3 text-2xl">
      <div
        className="absolute inset-y-0 left-0 bg-indigo-500/40"
        style={{ width, transition: 'width 900ms ease-out' }}
      />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-3">
          <RankDelta delta={row.rankDelta} />
          {row.rank}. <span className="text-2xl">{row.avatar}</span> {row.nickname}
        </span>
        <span className="flex items-baseline gap-3">
          {row.gained ? (
            <span className="text-lg font-bold text-green-400">+{row.gained}</span>
          ) : (
            <span className="text-lg text-white/30">+0</span>
          )}
          <span className="font-bold">{row.score}</span>
        </span>
      </div>
    </div>
  );
}

/** Altura de cada linha do placar: 56px de barra + 12px de vão. */
const ROW_H = 68;

/**
 * Placar em "corrida": cada linha entra na posição da rodada anterior
 * e desliza até a atual — as trocas de posição viram animação.
 */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const shown = rows.slice(0, 8);
  const max = Math.max(1, ...shown.map((r) => r.score));
  const [settled, setSettled] = useState(reducedMotion());

  useEffect(() => {
    if (reducedMotion()) return setSettled(true); // sem corrida: já nas posições finais
    setSettled(false);
    const id = setTimeout(() => setSettled(true), 350);
    return () => clearTimeout(id);
  }, [rows]);

  const yOf = (r: LeaderboardRow) => {
    // rankDelta positivo = subiu; a posição anterior era rank + delta.
    const prevRank = r.rankDelta === undefined ? r.rank : r.rank + r.rankDelta;
    const rank = settled ? r.rank : prevRank;
    return (Math.min(Math.max(rank, 1), shown.length) - 1) * ROW_H;
  };

  return (
    <ol className="relative mx-auto max-w-2xl" style={{ height: Math.max(0, shown.length * ROW_H - 12) }}>
      {shown.map((r) => (
        <li
          key={r.nickname}
          className="absolute inset-x-0"
          style={{ transform: `translateY(${yOf(r)}px)`, transition: reducedMotion() ? 'none' : 'transform 900ms cubic-bezier(.22,1,.36,1)' }}
        >
          <Bar row={r} pct={(r.score / max) * 100} />
        </li>
      ))}
    </ol>
  );
}
