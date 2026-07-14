/**
 * Renderiza um avatar do jogador. Normalmente é um emoji (string), mas alguns
 * valores são "tokens" desenhados como SVG — ex.: 'orca', que não tem emoji no
 * Unicode. O SVG escala com a font-size (1em), então herda o tamanho do texto.
 */
export function Avatar({ value, className }: { value?: string; className?: string }) {
  if (value === 'orca') return <OrcaAvatar className={className} />;
  return <span className={className}>{value ?? '👤'}</span>;
}

/** Desenho de orca (baleia-orca) em vista lateral, virada para a esquerda. */
export function OrcaAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="orca"
      className={className}
      style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: '-0.15em' }}
    >
      {/* cauda */}
      <path d="M50 32 L63 24 Q60 32 63 40 Z" fill="#15151a" />
      {/* corpo */}
      <ellipse cx="29" cy="34" rx="25" ry="14" fill="#15151a" />
      {/* barbatana dorsal */}
      <path d="M28 22 L35 7 L43 22 Z" fill="#15151a" />
      {/* barbatana peitoral */}
      <path d="M27 45 L21 55 L34 47 Z" fill="#15151a" />
      {/* barriga branca */}
      <path d="M9 40 Q29 52 50 40 Q29 46 9 40 Z" fill="#ffffff" />
      {/* mancha (sela) branca atrás da dorsal */}
      <ellipse cx="37" cy="29" rx="6" ry="2.6" fill="#e7edf3" transform="rotate(-8 37 29)" />
      {/* mancha branca do olho */}
      <ellipse cx="15" cy="30" rx="3.6" ry="2" fill="#ffffff" transform="rotate(-18 15 30)" />
      {/* olho */}
      <circle cx="13.5" cy="32.5" r="1.7" fill="#0b0b0f" />
    </svg>
  );
}
