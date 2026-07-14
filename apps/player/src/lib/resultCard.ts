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
 * Desenha a orca realista (avatar sem emoji) no canvas, espelhando o SVG do
 * componente Avatar. (cx0, cy0) é o centro; s é o lado em px (viewBox 64).
 */
function drawOrca(x: CanvasRenderingContext2D, cx0: number, cy0: number, s: number): void {
  const k = s / 64;
  const px = (n: number) => cx0 + (n - 32) * k; // mapeia X do viewBox
  const py = (n: number) => cy0 + (n - 32) * k; // mapeia Y do viewBox

  // corpo: gradiente radial (foco de luz em cima à esquerda)
  const body = x.createRadialGradient(px(23), py(18), 0, px(23), py(18), 61 * k);
  body.addColorStop(0, '#3a4150');
  body.addColorStop(0.55, '#14161b');
  body.addColorStop(1, '#060709');
  // barbatanas: gradiente vertical (topo mais claro)
  const fin = x.createLinearGradient(0, py(4), 0, py(55));
  fin.addColorStop(0, '#2a303a');
  fin.addColorStop(1, '#08090c');

  // cauda
  x.fillStyle = fin;
  x.beginPath();
  x.moveTo(px(49), py(34));
  x.bezierCurveTo(px(55), py(31), px(58), py(28), px(63), py(22));
  x.bezierCurveTo(px(59), py(31), px(60), py(34), px(63), py(42));
  x.bezierCurveTo(px(56), py(37), px(54), py(36), px(49), py(35));
  x.closePath();
  x.fill();
  // barbatana peitoral (remo)
  x.beginPath();
  x.moveTo(px(23), py(39));
  x.bezierCurveTo(px(20), py(47), px(19), py(51), px(16), py(55));
  x.bezierCurveTo(px(22), py(52), px(27), py(46), px(30), py(41));
  x.bezierCurveTo(px(28), py(40), px(25), py(39), px(23), py(39));
  x.closePath();
  x.fill();
  // corpo
  x.fillStyle = body;
  x.beginPath();
  x.moveTo(px(6), py(32));
  x.bezierCurveTo(px(6), py(24), px(15), py(20), px(27), py(21));
  x.bezierCurveTo(px(40), py(22), px(51), py(26), px(55), py(33));
  x.bezierCurveTo(px(49), py(39), px(32), py(43), px(16), py(41));
  x.bezierCurveTo(px(9), py(40), px(6), py(36), px(6), py(32));
  x.closePath();
  x.fill();
  // barbatana dorsal
  x.fillStyle = fin;
  x.beginPath();
  x.moveTo(px(24), py(22));
  x.bezierCurveTo(px(25), py(9), px(31), py(4), px(40), py(4));
  x.bezierCurveTo(px(34), py(11), px(34), py(17), px(34), py(22));
  x.closePath();
  x.fill();
  // barriga branca, subindo no flanco perto da cauda
  x.fillStyle = '#f6f8fb';
  x.beginPath();
  x.moveTo(px(9), py(34));
  x.bezierCurveTo(px(19), py(41), px(33), py(42), px(42), py(39));
  x.bezierCurveTo(px(48), py(37), px(50), py(30), px(47), py(30));
  x.bezierCurveTo(px(46), py(36), px(40), py(39), px(34), py(40));
  x.bezierCurveTo(px(24), py(40.5), px(15), py(38), px(9), py(34));
  x.closePath();
  x.fill();
  // garganta branca sob a cabeça
  x.beginPath();
  x.moveTo(px(8), py(33));
  x.bezierCurveTo(px(11), py(38), px(16), py(40), px(22), py(40));
  x.bezierCurveTo(px(17), py(41.5), px(11), py(40.5), px(8), py(37));
  x.closePath();
  x.fill();
  // linha da boca
  x.strokeStyle = 'rgba(10,11,14,0.5)';
  x.lineWidth = 0.8 * k;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(px(7), py(34));
  x.bezierCurveTo(px(11), py(35), px(15), py(35), px(18), py(34));
  x.stroke();
  // mancha (sela) cinza atrás da dorsal
  x.fillStyle = 'rgba(100,107,120,0.7)';
  x.beginPath();
  x.moveTo(px(33), py(23));
  x.bezierCurveTo(px(41), py(22), px(47), py(24), px(50), py(28));
  x.bezierCurveTo(px(45), py(25), px(39), py(25), px(33), py(26));
  x.closePath();
  x.fill();
  // mancha branca do olho (elipse rotacionada)
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.ellipse(px(13.5), py(27.5), 4.5 * k, 2.5 * k, (-24 * Math.PI) / 180, 0, Math.PI * 2);
  x.fill();
  // olho + brilho
  x.fillStyle = '#08090c';
  x.beginPath();
  x.ellipse(px(11.4), py(29.4), 1.9 * k, 1.9 * k, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.9)';
  x.beginPath();
  x.ellipse(px(10.8), py(28.6), 0.65 * k, 0.65 * k, 0, 0, Math.PI * 2);
  x.fill();
  // brilho no dorso
  x.strokeStyle = 'rgba(146,156,171,0.38)';
  x.lineWidth = 1.8 * k;
  x.beginPath();
  x.moveTo(px(11), py(24));
  x.bezierCurveTo(px(22), py(20), px(35), py(21), px(46), py(26));
  x.stroke();
}
