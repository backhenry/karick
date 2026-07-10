import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

/** Chuva de confetes em canvas — sem dependências. Respeita prefers-reduced-motion. */
export function Confetti({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colorKey = colors.join('|');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const palette = colorKey.split('|').filter(Boolean);
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const make = (burst: boolean): Particle => ({
      x: rnd(0, w),
      y: burst ? rnd(-h * 0.3, h * 0.3) : rnd(-40, -10),
      vx: rnd(-0.6, 0.6),
      vy: rnd(1.4, 3.2),
      size: rnd(6, 12),
      color: palette[Math.floor(Math.random() * palette.length)] ?? '#fff',
      rot: rnd(0, Math.PI * 2),
      vr: rnd(-0.12, 0.12),
    });

    let parts = Array.from({ length: 160 }, () => make(true));
    let raf = 0;
    const stepFrame = () => {
      ctx.clearRect(0, 0, w, h);
      parts = parts.map((p) => (p.y > h + 30 ? make(false) : p));
      for (const p of parts) {
        p.x += p.vx + Math.sin(p.y / 45) * 0.5;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(stepFrame);
    };
    raf = requestAnimationFrame(stepFrame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [colorKey]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-40" aria-hidden />;
}
