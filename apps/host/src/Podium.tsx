import { useEffect, useState } from 'react';
import type { LeaderboardRow } from '@karick/shared';

const HEIGHT: Record<number, number> = { 1: 190, 2: 140, 3: 95 };
const MEDAL = ['🥇', '🥈', '🥉'];
const COLOR: Record<number, string> = { 1: '#d89e00', 2: '#8a94a6', 3: '#b06a3b' };

function Column({ row }: { row: LeaderboardRow }) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // 3º sobe primeiro, depois 2º, depois 1º (suspense).
    const id = setTimeout(() => setHeight(HEIGHT[row.rank] ?? 80), 150 + (4 - row.rank) * 350);
    return () => clearTimeout(id);
  }, [row.rank]);

  return (
    <div className="flex w-28 flex-col items-center justify-end">
      <div className="text-4xl">{MEDAL[row.rank - 1]}</div>
      <div className="text-4xl">{row.avatar}</div>
      <div className="max-w-full truncate font-bold">{row.nickname}</div>
      <div className="mb-1 text-sm opacity-80">{row.score} pts</div>
      <div
        className="w-full rounded-t-lg"
        style={{ height, background: COLOR[row.rank] ?? '#666', transition: 'height 800ms cubic-bezier(.2,.8,.2,1)' }}
      />
    </div>
  );
}

/** Pódio animado: recebe até 3 linhas (rank 1..3) e as dispõe 2º-1º-3º. */
export function Podium({ top }: { top: LeaderboardRow[] }) {
  const byRank = (r: number) => top.find((x) => x.rank === r);
  const arrangement = [byRank(2), byRank(1), byRank(3)];
  return (
    <div className="flex items-end justify-center gap-4">
      {arrangement.map((row, i) =>
        row ? <Column key={row.rank} row={row} /> : <div key={`empty-${i}`} className="w-28" />,
      )}
    </div>
  );
}
