import { useEffect } from 'react';

/** Fecha um modal com a tecla Esc (acessibilidade e conveniência). */
export function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
