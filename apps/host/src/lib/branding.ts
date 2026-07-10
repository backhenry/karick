export interface Branding {
  logo: string; // URL http(s) opcional
  color: string; // cor de destaque (hex)
}

const KEY = 'karick.branding';
const DEFAULT: Branding = { logo: '', color: '#6366f1' };

export function loadBranding(): Branding {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Branding) };
  } catch {
    /* ignora */
  }
  return DEFAULT;
}

export function saveBranding(b: Branding): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* ignora */
  }
}
