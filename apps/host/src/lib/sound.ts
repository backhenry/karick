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
    tone(523, 150, 'triangle', 0.08);
    tone(659, 150, 'triangle', 0.08, 150);
    tone(784, 300, 'triangle', 0.08, 300);
  },
};
