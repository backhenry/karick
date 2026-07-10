import { type Brand, DEFAULT_BRAND } from '@karick/shared';

export type { Brand };

const KEY = 'karick.branding';

export function loadBranding(): Brand {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Brand & { color?: string };
      // Migração do formato antigo ({logo, color}) → primary.
      if (p.color && !p.primary) p.primary = p.color;
      return { ...DEFAULT_BRAND, ...p };
    }
  } catch {
    /* ignora */
  }
  return { ...DEFAULT_BRAND };
}

export function saveBranding(b: Brand): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* ignora */
  }
}
