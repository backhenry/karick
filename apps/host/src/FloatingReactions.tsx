import { useEffect, useState } from 'react';

export interface Reaction {
  id: number;
  emoji: string;
  x: number; // 0-100 (% da largura)
}

function Floating({ emoji, x }: { emoji: string; x: number }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setUp(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span
      className="absolute bottom-4 text-5xl"
      style={{
        left: `${x}%`,
        transform: up ? 'translateY(-60vh) scale(1.4)' : 'translateY(0) scale(0.6)',
        opacity: up ? 0 : 1,
        transition: 'transform 2.6s ease-out, opacity 2.6s ease-in',
      }}
    >
      {emoji}
    </span>
  );
}

/** Camada que faz as reações (emojis) subirem e sumirem na tela do Host. */
export function FloatingReactions({ items }: { items: Reaction[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {items.map((r) => (
        <Floating key={r.id} emoji={r.emoji} x={r.x} />
      ))}
    </div>
  );
}
