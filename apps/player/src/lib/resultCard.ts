import orcaSvg from '../orca.svg?raw';

// A orca é uma ilustração SVG (não é emoji). Rasterizamos uma vez e reusamos.
let orcaImg: HTMLImageElement | null = null;
function loadOrca(): Promise<HTMLImageElement> {
  if (orcaImg) return Promise.resolve(orcaImg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      orcaImg = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(orcaSvg);
  });
}

/** Gera um PNG (data URL) com o resultado do jogador, pronto para compartilhar. */
export async function buildResultCard(opts: { nickname: string; avatar: string; rank?: number; score?: number; badges?: string[] }): Promise<string> {
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
    // Ilustração 1.36:1 (paisagem), centrada em (300, 135).
    const w = 150, h = w / 1.36;
    try {
      const img = await loadOrca();
      x.drawImage(img, 300 - w / 2, 135 - h / 2, w, h);
    } catch {
      x.font = '90px sans-serif';
      x.fillText('🐋', 300, 170);
    }
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
