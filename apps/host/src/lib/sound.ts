/**
 * Sons via Web Audio API — sem arquivos externos, tudo gerado por oscilador.
 * O AudioContext só é criado após a 1ª interação do usuário (regra dos browsers).
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.08, delayMs = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

export const sfx = {
  join: () => tone(660, 120, 'triangle'),
  questionStart: () => {
    tone(523, 120, 'square', 0.05);
    tone(784, 160, 'square', 0.05, 120);
  },
  reveal: () => {
    tone(392, 140, 'sawtooth', 0.05);
    tone(587, 200, 'sawtooth', 0.05, 130);
  },
  over: () => {
    // Fanfarra: arpejo ascendente + acorde de resolução sustentado.
    [523, 659, 784].forEach((f, i) => tone(f, 180, 'triangle', 0.08, i * 130));
    tone(1047, 550, 'triangle', 0.09, 420);
    [262, 330, 392].forEach((f) => tone(f, 700, 'sine', 0.04, 420));
  },
  /** Tique de tensão — sobe de tom conforme o tempo acaba (secsLeft: 5..1). */
  tick: (secsLeft: number) => tone(700 + (6 - secsLeft) * 90, 70, 'square', 0.06),
  timeUp: () => tone(200, 400, 'sawtooth', 0.08),
};

/**
 * Música de lobby: arpejos suaves em loop (Am–F–C–G), volume baixo.
 * Retorna uma função para parar (ao sair do lobby ou silenciar).
 */
export function startLobbyMusic(): () => void {
  const c = getCtx();
  if (!c) return () => {};
  const chords = [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [130.81, 164.81, 196.0], // C
    [196.0, 246.94, 293.66], // G
  ];
  let bar = 0;
  let step = 0;
  const id = setInterval(() => {
    const chord = chords[bar % chords.length];
    // 4 passos por compasso: sobe o arpejo e coroa com a fundamental uma oitava acima.
    const freq = step < 3 ? chord[step] : chord[0] * 2;
    tone(freq, 300, 'sine', 0.028);
    if (step === 0) tone(chord[0] / 2, 900, 'sine', 0.02); // baixo sustentado
    step = (step + 1) % 4;
    if (step === 0) bar++;
  }, 290);
  return () => clearInterval(id);
}

/**
 * Agenda os tiques de tensão para os últimos `durationSec` segundos.
 * Retorna uma função para cancelar (ao trocar de pergunta/estender tempo).
 */
export function scheduleTension(durationSec: number): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let s = Math.min(5, Math.floor(durationSec) - 1); s >= 1; s--) {
    timers.push(setTimeout(() => sfx.tick(s), (durationSec - s) * 1000));
  }
  if (durationSec > 0) timers.push(setTimeout(() => sfx.timeUp(), durationSec * 1000));
  return () => timers.forEach(clearTimeout);
}
