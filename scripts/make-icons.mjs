/**
 * Gera os ícones PNG do PWA (jogador) sem dependências: fundo escuro +
 * grade 2×2 nas cores das alternativas. Uso: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'player', 'public');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** PNG RGB a partir de uma função (x, y) → [r, g, b]. */
function png(size, pixelFn) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#0f172a');
const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'].map(hex);

/** Ponto dentro de um retângulo de cantos arredondados. */
function inRounded(x, y, x0, y0, w, h, r) {
  if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
  const nx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const ny = Math.min(Math.max(y, y0 + r), y0 + h - r);
  return (x - nx) ** 2 + (y - ny) ** 2 <= r ** 2;
}

function icon(size) {
  const m = size * 0.2; // margem (zona segura de ícones "maskable")
  const gap = size * 0.05;
  const cell = (size - 2 * m - gap) / 2;
  const r = cell * 0.24;
  const cells = [
    [m, m],
    [m + cell + gap, m],
    [m, m + cell + gap],
    [m + cell + gap, m + cell + gap],
  ];
  return png(size, (x, y) => {
    for (let i = 0; i < 4; i++) {
      if (inRounded(x, y, cells[i][0], cells[i][1], cell, cell, r)) return COLORS[i];
    }
    return BG;
  });
}

mkdirSync(OUT, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), icon(size));
  console.log(`icon-${size}.png ✓`);
}
