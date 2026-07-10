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

/** Paletas prontas para escolha rápida. */
export const BRAND_PRESETS: { name: string; bg: string; primary: string; options: string[] }[] = [
  { name: 'Karick', bg: '#0f172a', primary: '#6366f1', options: [...OPTION_COLORS] },
  { name: 'Oceano', bg: '#0c2436', primary: '#22d3ee', options: ['#0891b2', '#2563eb', '#0ea5e9', '#14b8a6'] },
  { name: 'Pôr do sol', bg: '#2a0f1e', primary: '#fb7185', options: ['#e11d48', '#f97316', '#eab308', '#db2777'] },
  { name: 'Floresta', bg: '#0f2417', primary: '#4ade80', options: ['#16a34a', '#65a30d', '#0d9488', '#ca8a04'] },
  { name: 'Corporativo', bg: '#111827', primary: '#3b82f6', options: ['#2563eb', '#7c3aed', '#0891b2', '#475569'] },
  { name: 'Uva', bg: '#1e1030', primary: '#a78bfa', options: ['#7c3aed', '#c026d3', '#4f46e5', '#db2777'] },
];
