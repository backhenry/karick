import { OPTION_COLORS } from './constants.js';

/** Identidade visual da marca: nome, logo e paleta de cores do jogo. */
export interface Brand {
  name?: string; // substitui "Karick" nas telas
  logo?: string; // URL http(s) opcional
  bg?: string; // fundo das telas de jogo (hex)
  primary?: string; // cor de destaque: PIN, botões e títulos (hex)
  options?: string[]; // 4 cores das alternativas (hex)
}

export const DEFAULT_BRAND: Brand = {
  name: 'Karick',
  logo: '',
  bg: '#0f172a',
  primary: '#6366f1',
  options: [...OPTION_COLORS],
};

/** Nome de exibição, com fallback para "Karick". */
export function brandName(b?: Brand | null): string {
  const n = b?.name?.trim();
  return n ? n : 'Karick';
}

/** Cor de uma alternativa via variável CSS (com fallback ao padrão). */
export function optColor(i: number): string {
  return `var(--k-opt-${i}, ${OPTION_COLORS[i] ?? '#666'})`;
}

/** Aplica a paleta como variáveis CSS no documento (só no browser). */
export function applyBrandVars(b?: Brand | null): void {
  if (typeof document === 'undefined') return;
  const s = document.documentElement.style;
  s.setProperty('--k-bg', b?.bg || DEFAULT_BRAND.bg!);
  s.setProperty('--k-primary', b?.primary || DEFAULT_BRAND.primary!);
  const opts = b?.options && b.options.length === 4 ? b.options : OPTION_COLORS;
  opts.forEach((c, i) => s.setProperty(`--k-opt-${i}`, c));
}

const STRICT_HEX = /^#[0-9a-fA-F]{6}$/;
const isStrictHex = (v: unknown): v is string => typeof v === 'string' && STRICT_HEX.test(v);

/** Higieniza uma marca vinda do cliente: só hex válidos, URL http(s), nome curto. */
export function sanitizeBrand(b?: Brand | null): Brand | undefined {
  if (!b || typeof b !== 'object') return undefined;
  const out: Brand = {};
  if (typeof b.name === 'string' && b.name.trim()) out.name = b.name.trim().slice(0, 40);
  if (typeof b.logo === 'string' && /^https?:\/\//i.test(b.logo)) out.logo = b.logo.slice(0, 500);
  if (isStrictHex(b.bg)) out.bg = b.bg;
  if (isStrictHex(b.primary)) out.primary = b.primary;
  if (Array.isArray(b.options) && b.options.length === 4 && b.options.every(isStrictHex)) out.options = b.options.slice(0, 4);
  return Object.keys(out).length ? out : undefined;
}

/** Normaliza uma cor para #rrggbb (aceita #rgb, sem #, maiúsculas, rgb(), hex embutido em texto). */
function normalizeHex(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const rgb = v.match(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
  if (rgb) {
    const hex = rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
    return '#' + hex;
  }
  let s = v.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  if (/^[0-9a-fA-F]{6}$/.test(s)) return '#' + s.toLowerCase();
  // Hex embutido em texto, ex.: "Vermelho Vale (#e21b3c)".
  const inText = v.match(/#([0-9a-fA-F]{6})\b/);
  return inText ? '#' + inText[1].toLowerCase() : undefined;
}

/** Extrai um hex de um item de paleta (string ou objeto {hex|color|value}). */
function hexFromItem(el: unknown): string | undefined {
  if (typeof el === 'string') return normalizeHex(el);
  if (el && typeof el === 'object') {
    const o = el as Record<string, unknown>;
    return normalizeHex(o.hex ?? o.color ?? o.value);
  }
  return undefined;
}

/** Extrai uma URL de imagem utilizável de um texto (lida com link markdown [x](y), wrappers de busca, etc.). */
export function extractImageUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const found = v.match(/https?:\/\/[^\s)\]]+/gi);
  if (!found) return undefined;
  const urls = found.map((u) => u.replace(/[.,)\]]+$/, ''));
  const isWrapper = (u: string) => /[?&]q=https?/i.test(u) || /\/(search|url)\?/i.test(u);
  const looksImg = (u: string) => /\.(png|jpe?g|svg|webp|gif|avif)(\?|$)/i.test(u);
  return urls.find((u) => looksImg(u) && !isWrapper(u)) ?? urls.find((u) => !isWrapper(u)) ?? urls[0];
}

/** Prompt pronto para colar numa IA e obter a identidade visual de uma marca em JSON. */
export const BRAND_IMPORT_PROMPT = `Aja como especialista em identidade visual de marcas.
Quero a identidade visual da seguinte marca: [DESCREVA AQUI — nome, site ou setor da marca].

Responda APENAS com um JSON válido (sem markdown, sem comentários, sem texto antes ou depois), exatamente neste formato:

{
  "name": "Nome da marca",
  "logo": "https://url-publica-do-logo.png",
  "bg": "#0f172a",
  "primary": "#6366f1",
  "options": ["#e21b3c", "#1368ce", "#d89e00", "#26890c"]
}

Regras:
- Todas as cores em hexadecimal no formato #rrggbb.
- "bg": cor de fundo ESCURA (o texto por cima é branco) — use um tom bem escuro da paleta da marca.
- "primary": cor de destaque principal da marca (usada em PIN, botões e títulos).
- "options": 4 cores VIBRANTES e bem distintas entre si para as alternativas do quiz (podem derivar da paleta da marca).
- "logo": URL http(s) pública do logo; se não tiver certeza de uma URL real, use "".
- Não invente URLs de logo que possam não existir.`;

/** Interpreta um JSON de identidade visual (tolerante a apelidos e cercas de markdown). */
export function parseBrandImport(raw: string): { ok: true; brand: Brand } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: false, error: 'Cole o JSON da identidade visual.' };
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'JSON inválido — verifique o texto colado.' };
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'O JSON precisa ser um objeto.' };
  // Achata objetos aninhados comuns (ex.: { "colors": { "primary": … } }).
  for (const key of ['colors', 'cores', 'theme', 'tema', 'identity', 'identidade', 'branding']) {
    const nested = obj[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) obj = { ...(nested as Record<string, unknown>), ...obj };
  }
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) if (obj[k] != null) return obj[k];
    return undefined;
  };
  const brand: Brand = {};
  const name = pick('name', 'brand', 'title', 'nome');
  if (typeof name === 'string' && name.trim()) brand.name = name.trim().slice(0, 40);
  const logo = extractImageUrl(pick('logo', 'logoUrl', 'logotipo', 'image'));
  if (logo) brand.logo = logo;
  const bg = normalizeHex(pick('bg', 'background', 'backgroundColor', 'fundo'));
  if (bg) brand.bg = bg;
  const primary = normalizeHex(pick('primary', 'accent', 'primaryColor', 'destaque', 'brandColor'));
  if (primary) brand.primary = primary;
  let rawOpts = pick('options', 'answerColors', 'palette', 'alternativas', 'colors', 'optionColors', 'opcoes', 'opções');
  // Aceita objeto ({"opcao1": "#…", …}) além de array.
  if (rawOpts && typeof rawOpts === 'object' && !Array.isArray(rawOpts)) rawOpts = Object.values(rawOpts);
  if (Array.isArray(rawOpts)) {
    const opts = rawOpts.map(hexFromItem).filter((c): c is string => !!c);
    if (opts.length >= 4) brand.options = opts.slice(0, 4);
  }
  if (!Object.keys(brand).length) return { ok: false, error: 'Nenhum campo reconhecido (name, logo, bg, primary, options).' };
  return { ok: true, brand };
}

/** Paletas prontas para escolha rápida. */
export const BRAND_PRESETS: { name: string; bg: string; primary: string; options: string[] }[] = [
  { name: 'Karick', bg: '#0f172a', primary: '#6366f1', options: [...OPTION_COLORS] },
  { name: 'Oceano', bg: '#0c2436', primary: '#22d3ee', options: ['#0891b2', '#2563eb', '#0ea5e9', '#14b8a6'] },
  { name: 'Pôr do sol', bg: '#2a0f1e', primary: '#fb7185', options: ['#e11d48', '#f97316', '#eab308', '#db2777'] },
  { name: 'Floresta', bg: '#0f2417', primary: '#4ade80', options: ['#16a34a', '#65a30d', '#0d9488', '#ca8a04'] },
  { name: 'Corporativo', bg: '#111827', primary: '#3b82f6', options: ['#2563eb', '#7c3aed', '#0891b2', '#475569'] },
  { name: 'Uva', bg: '#1e1030', primary: '#a78bfa', options: ['#7c3aed', '#c026d3', '#4f46e5', '#db2777'] },
];
