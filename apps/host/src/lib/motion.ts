/** True quando o usuário pediu menos animação no sistema (acessibilidade). */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
