/**
 * Renderiza um avatar do jogador. Normalmente é um emoji (string), mas alguns
 * valores são "tokens" desenhados como SVG — ex.: 'orca', que não tem emoji no
 * Unicode. O SVG escala com a font-size (1em), então herda o tamanho do texto.
 */
export function Avatar({ value, className }: { value?: string; className?: string }) {
  if (value === 'orca') return <OrcaAvatar className={className} />;
  return <span className={className}>{value ?? '👤'}</span>;
}

/** Desenho realista de orca (baleia-orca), vista lateral virada para a esquerda. */
export function OrcaAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="orca"
      className={className}
      style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: '-0.15em' }}
    >
      <defs>
        <radialGradient id="ko-body" cx="0.36" cy="0.28" r="0.95">
          <stop offset="0" stopColor="#3a4150" />
          <stop offset="0.55" stopColor="#14161b" />
          <stop offset="1" stopColor="#060709" />
        </radialGradient>
        <linearGradient id="ko-fin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a303a" />
          <stop offset="1" stopColor="#08090c" />
        </linearGradient>
      </defs>
      {/* cauda */}
      <path d="M49 34 C55 31 58 28 63 22 C59 31 60 34 63 42 C56 37 54 36 49 35 Z" fill="url(#ko-fin)" />
      {/* barbatana peitoral (remo) */}
      <path d="M23 39 C20 47 19 51 16 55 C22 52 27 46 30 41 C28 40 25 39 23 39 Z" fill="url(#ko-fin)" />
      {/* corpo */}
      <path d="M6 32 C6 24 15 20 27 21 C40 22 51 26 55 33 C49 39 32 43 16 41 C9 40 6 36 6 32 Z" fill="url(#ko-body)" />
      {/* barbatana dorsal */}
      <path d="M24 22 C25 9 31 4 40 4 C34 11 34 17 34 22 Z" fill="url(#ko-fin)" />
      {/* barriga branca, subindo no flanco perto da cauda */}
      <path d="M9 34 C19 41 33 42 42 39 C48 37 50 30 47 30 C46 36 40 39 34 40 C24 40.5 15 38 9 34 Z" fill="#f6f8fb" />
      {/* garganta branca sob a cabeça */}
      <path d="M8 33 C11 38 16 40 22 40 C17 41.5 11 40.5 8 37 Z" fill="#f6f8fb" />
      {/* linha da boca */}
      <path d="M7 34 C11 35 15 35 18 34" stroke="#0a0b0e" strokeWidth="0.8" fill="none" opacity="0.5" strokeLinecap="round" />
      {/* mancha (sela) cinza atrás da dorsal */}
      <path d="M33 23 C41 22 47 24 50 28 C45 25 39 25 33 26 Z" fill="#646b78" opacity="0.7" />
      {/* mancha branca do olho */}
      <ellipse cx="13.5" cy="27.5" rx="4.5" ry="2.5" fill="#fff" transform="rotate(-24 13.5 27.5)" />
      {/* olho */}
      <circle cx="11.4" cy="29.4" r="1.9" fill="#08090c" />
      <circle cx="10.8" cy="28.6" r="0.65" fill="#fff" opacity="0.9" />
      {/* brilho no dorso */}
      <path d="M11 24 C22 20 35 21 46 26" stroke="#929cab" strokeWidth="1.8" fill="none" opacity="0.38" strokeLinecap="round" />
    </svg>
  );
}
