/** Gera um PNG (data URL) com o resultado do jogador, pronto para compartilhar. */
export function buildResultCard(opts: { nickname: string; avatar: string; rank?: number; score?: number; badges?: string[] }): string {
  const badges = opts.badges ?? [];
  const height = badges.length ? 450 : 400;
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = height;
  const x = canvas.getContext('2d');
  if (!x) return '';

  const grad = x.createLinearGradient(0, 0, 600, height);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(1, '#0f172a');
  x.fillStyle = grad;
  x.fillRect(0, 0, 600, height);

  x.textAlign = 'center';
  x.fillStyle = '#c7d2fe';
  x.font = 'bold 34px sans-serif';
  x.fillText('Karick', 300, 60);

  if (opts.avatar === 'orca') {
    drawOrca(x, 300, 135, 100);
  } else {
    x.font = '90px sans-serif';
    x.fillText(opts.avatar || '🎮', 300, 170);
  }

  x.fillStyle = '#ffffff';
  x.font = 'bold 34px sans-serif';
  x.fillText(opts.nickname || 'Jogador', 300, 225);

  if (opts.rank) {
    const medal = ['🥇', '🥈', '🥉'][opts.rank - 1];
    x.font = 'bold 30px sans-serif';
    x.fillText(medal ? `${medal} ${opts.rank}º lugar` : `${opts.rank}º lugar`, 300, 285);
  }

  x.font = 'bold 50px sans-serif';
  x.fillText(`${opts.score ?? 0} pts`, 300, 350);

  if (badges.length) {
    x.fillStyle = '#c7d2fe';
    x.font = 'bold 22px sans-serif';
    // maxWidth espreme o texto se houver muitos selos.
    x.fillText(badges.join('   ·   '), 300, 410, 560);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Desenha a orca (avatar sem emoji) no canvas, espelhando o SVG do componente
 * Avatar. (cx0, cy0) é o centro; s é o lado em px (viewBox original é 64).
 */
function drawOrca(x: CanvasRenderingContext2D, cx0: number, cy0: number, s: number): void {
  const k = s / 64;
  const px = (n: number) => cx0 + (n - 32) * k; // mapeia X do viewBox
  const py = (n: number) => cy0 + (n - 32) * k; // mapeia Y do viewBox
  const BLACK = '#15151a';

  // cauda
  x.fillStyle = BLACK;
  x.beginPath();
  x.moveTo(px(50), py(32));
  x.lineTo(px(63), py(24));
  x.quadraticCurveTo(px(60), py(32), px(63), py(40));
  x.closePath();
  x.fill();
  // corpo
  x.beginPath();
  x.ellipse(px(29), py(34), 25 * k, 14 * k, 0, 0, Math.PI * 2);
  x.fill();
  // barbatana dorsal
  x.beginPath();
  x.moveTo(px(28), py(22));
  x.lineTo(px(35), py(7));
  x.lineTo(px(43), py(22));
  x.closePath();
  x.fill();
  // barbatana peitoral
  x.beginPath();
  x.moveTo(px(27), py(45));
  x.lineTo(px(21), py(55));
  x.lineTo(px(34), py(47));
  x.closePath();
  x.fill();
  // barriga branca
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.moveTo(px(9), py(40));
  x.quadraticCurveTo(px(29), py(52), px(50), py(40));
  x.quadraticCurveTo(px(29), py(46), px(9), py(40));
  x.fill();
  // mancha (sela) atrás da dorsal
  x.fillStyle = '#e7edf3';
  x.beginPath();
  x.ellipse(px(37), py(29), 6 * k, 2.6 * k, (-8 * Math.PI) / 180, 0, Math.PI * 2);
  x.fill();
  // mancha branca do olho
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.ellipse(px(15), py(30), 3.6 * k, 2 * k, (-18 * Math.PI) / 180, 0, Math.PI * 2);
  x.fill();
  // olho
  x.fillStyle = '#0b0b0f';
  x.beginPath();
  x.ellipse(px(13.5), py(32.5), 1.7 * k, 1.7 * k, 0, 0, Math.PI * 2);
  x.fill();
}
