// Efectos de sonido sintetizados con Web Audio. Nada se descarga.
// El audio solo arranca después de que el usuario prende el sonido (regla de los navegadores).

let ctx = null;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.08, type = 'square', vol = 0.035, delay = 0, slideTo = null) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SFX = {
  click: () => tone(1100, 0.04, 'square', 0.025),
  stage: () => tone(1500, 0.03, 'sine', 0.02),
  alert: () => { tone(660, 0.09); tone(990, 0.12, 'square', 0.04, 0.11); },
  fault: () => tone(300, 0.18, 'sawtooth', 0.025, 0, 140),
  zap: () => { tone(1400, 0.16, 'sawtooth', 0.04, 0, 180); tone(90, 0.12, 'square', 0.03, 0.02); },
  good: () => { tone(523, 0.08, 'triangle', 0.05); tone(784, 0.14, 'triangle', 0.05, 0.09); },
  bad: () => { tone(260, 0.12, 'sawtooth', 0.035); tone(180, 0.2, 'sawtooth', 0.035, 0.12); },
  bonk: () => { tone(820, 0.06, 'square', 0.05, 0, 300); tone(1600, 0.05, 'triangle', 0.035, 0.07, 2400); tone(2000, 0.05, 'triangle', 0.03, 0.14, 2800); },
  boot: () => { [330, 440, 554, 660].forEach((f, i) => tone(f, 0.09, 'square', 0.03, i * 0.08)); },
};

export function play(name) {
  try { SFX[name]?.(); } catch { /* audio no disponible */ }
}
export function unlock() { try { ac(); } catch { /* sin audio */ } }
