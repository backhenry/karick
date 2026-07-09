import { useEffect, useState } from 'react';
import type { LeaderboardRow } from '@karick/shared';

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
    <li className="relative overflow-hidden rounded-lg bg-white/10 px-6 py-3 text-2xl">
      <div
        className="absolute inset-y-0 left-0 bg-indigo-500/40"
        style={{ width, transition: 'width 900ms ease-out' }}
      />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-3">
          <RankDelta delta={row.rankDelta} />
          {row.rank}. {row.nickname}
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
    </li>
  );
}

/** Placar com barras proporcionais à pontuação, animadas ao aparecer. */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.score));
  return (
    <ol className="mx-auto max-w-2xl space-y-3">
      {rows.slice(0, 8).map((r) => (
        <Bar key={r.nickname} row={r} pct={(r.score / max) * 100} />
      ))}
    </ol>
  );
}
