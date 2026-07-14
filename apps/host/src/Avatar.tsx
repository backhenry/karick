import orcaSvg from './orca.svg?raw';

/**
 * Renderiza um avatar do jogador. Normalmente é um emoji (string), mas alguns
 * valores são "tokens" ilustrados por SVG — ex.: 'orca', que não tem emoji no
 * Unicode. O SVG escala com a font-size (1em), herdando o tamanho do texto.
 */
export function Avatar({ value, className }: { value?: string; className?: string }) {
  if (value === 'orca') return <OrcaAvatar className={className} />;
  return <span className={className}>{value ?? '👤'}</span>;
}

/** Ilustração de orca (baleia-orca) exibida no lugar de um emoji. */
export function OrcaAvatar({ className }: { className?: string }) {
  return (
    <span
      className={className}
      role="img"
      aria-label="orca"
      style={{ display: 'inline-block', width: '1em', height: '1em', verticalAlign: '-0.15em' }}
      dangerouslySetInnerHTML={{ __html: orcaSvg }}
    />
  );
}
