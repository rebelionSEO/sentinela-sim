import { t as T } from '../i18n.js';

// El Revisor humano: un personaje anime original sentado en su escritorio.
// Estados en reposo: café → música → siesta (en ciclo). Cuando le llega un caso: alerta → "-_-" → decidiendo → listo.

const SKIN = '#ffd9b8', HAIR = '#2b2f4a', HOODIE = '#6c7bd9', HOODIE_D = '#5563bf';

export function humanMood(sim) {
  const H = sim.human, ap = sim.approval, t = sim.t;
  const waiting = ap && ap.deadline != null && !ap.decided;
  if (H.mood === 'annoyed' && t < H.until) return t - (H.until - 2.2) < 0.55 ? 'alert' : 'annoyed';
  if (waiting) return 'deciding';
  if (H.mood === 'done' && t < H.until) return 'done';
  const ph = (t + 3) % 30;
  return ph < 10 ? 'coffee' : ph < 20 ? 'music' : 'sleep';
}

function Eyes({ mood, t, tired }) {
  const L = -14, R = 2, Y = -44;
  const bags = tired && <g stroke="#9a7bb8" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d={`M ${L - 4} ${Y + 5} q 4 3 8 0`} /><path d={`M ${R - 4} ${Y + 5} q 4 3 8 0`} /></g>;
  const line = (d) => <g stroke="#2b2f4a" strokeWidth="2.2" fill="none" strokeLinecap="round">{d}</g>;
  let eyes;
  if (mood === 'alert') {
    eyes = <g>{[L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r="5" fill="#fff" stroke="#2b2f4a" strokeWidth="1.5" /><circle cx={x} cy={Y} r="1.6" fill="#2b2f4a" /></g>)}</g>;
  } else if (mood === 'annoyed') {
    eyes = line(<><path d={`M ${L - 4.5} ${Y} h 9`} /><path d={`M ${R - 4.5} ${Y} h 9`} /></>);
  } else if (mood === 'sleep') {
    eyes = line(<><path d={`M ${L - 4} ${Y + 1} q 4 2.5 8 0`} /><path d={`M ${R - 4} ${Y + 1} q 4 2.5 8 0`} /></>);
  } else if (mood === 'music' || mood === 'done') {
    eyes = line(<><path d={`M ${L - 4} ${Y + 1} q 4 -5 8 0`} /><path d={`M ${R - 4} ${Y + 1} q 4 -5 8 0`} /></>);
  } else if (mood === 'deciding') {
    eyes = <g fill="#2b2f4a">{[L, R].map((x) => <ellipse key={x} cx={x + 1} cy={Y + 1.5} rx="2.2" ry="2.8" />)}</g>;
  } else {
    // café: ojos relajados, medio cerrados
    eyes = <g>{[L, R].map((x) => <g key={x}><ellipse cx={x} cy={Y + 0.5} rx="2.4" ry="2.8" fill="#2b2f4a" /><path d={`M ${x - 4} ${Y - 1.5} h 8`} stroke={SKIN} strokeWidth="3" /></g>)}</g>;
  }
  return <g>{eyes}{bags}</g>;
}

function Mouth({ mood }) {
  const s = { stroke: '#7a3b3b', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' };
  if (mood === 'alert') return <ellipse cx="-6" cy="-33" rx="3" ry="3.6" fill="#7a3b3b" />;
  if (mood === 'annoyed') return <path d="M -10 -33 h 7" {...s} />;
  if (mood === 'sleep') return <path d="M -9 -33 q 3 2 6 0" {...s} />;
  if (mood === 'done' || mood === 'music') return <path d="M -10 -34 q 4 4 8 0" {...s} />;
  if (mood === 'deciding') return <path d="M -9 -33 q 3 -1.5 6 0" {...s} />;
  return <path d="M -9 -34 q 3 2 6 0" {...s} />;
}

export function Human({ sim, x, y, focus, labelLeft }) {
  const t = sim.t;
  const mood = humanMood(sim);
  const tired = sim.human.load.filter((v) => t - v < 60).length >= 3;
  const ap = sim.approval;
  const sleeping = mood === 'sleep';
  const tilt = sleeping ? 14 : mood === 'music' ? Math.sin(t * 7) * 6 : mood === 'alert' ? -4 : 0;
  const jump = mood === 'alert' ? -6 : 0;
  const sipPh = (t % 4.5) / 4.5;
  const sipping = mood === 'coffee' && sipPh > 0.55 && sipPh < 0.85;
  const remaining = ap && ap.deadline != null && !ap.decided ? Math.max(0, (ap.deadline - t) / 12) : null;

  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      {focus === 'human' && <circle cy="-30" r={66 + Math.sin(t * 5) * 4} fill="#ffc14d" fillOpacity="0.06" stroke="#ffc14d" strokeOpacity="0.6" strokeWidth="2" />}
      {/* silla */}
      <rect x="-30" y="-40" width="40" height="44" rx="8" fill="#2a3352" />
      <g transform={`translate(0,${jump})`}>
        {/* torso con capucha */}
        <path d="M -30 4 Q -30 -20 -6 -22 Q 18 -20 18 4 Z" fill={HOODIE} />
        <path d="M -14 -22 q 8 6 16 0" fill="none" stroke={HOODIE_D} strokeWidth="3" />
        <line x1="-10" y1="-18" x2="-11" y2="-8" stroke="#e7ecf8" strokeWidth="1.2" />
        <line x1="-2" y1="-18" x2="-1" y2="-8" stroke="#e7ecf8" strokeWidth="1.2" />
        {/* cabeza */}
        <g transform={`rotate(${tilt} -6 -24)`}>
          <circle cx="-6" cy="-44" r="18" fill={SKIN} />
          {/* pelo en picos */}
          <path d="M -25 -46 L -27 -60 L -18 -55 L -16 -68 L -8 -58 L -2 -70 L 2 -58 L 10 -64 L 9 -52 L 14 -50 Q 8 -64 -6 -63 Q -22 -63 -25 -46 Z" fill={HAIR} />
          <path d="M -24 -50 Q -14 -46 -8 -54 Q -2 -46 10 -50 L 12 -56 Q -6 -64 -24 -56 Z" fill={HAIR} />
          {tired && <path d="M -4 -64 q 6 -10 12 -4" fill="none" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" />}
          <circle cx="-20" cy="-38" r="3" fill="#ff9bb0" fillOpacity={mood === 'done' || mood === 'music' ? 0.6 : 0.25} />
          <circle cx="8" cy="-38" r="3" fill="#ff9bb0" fillOpacity={mood === 'done' || mood === 'music' ? 0.6 : 0.25} />
          <Eyes mood={mood} t={t} tired={tired} />
          <Mouth mood={mood} />
          {mood === 'annoyed' && <g stroke="#7fa6ff" strokeWidth="1.3" strokeOpacity="0.8">{[-16, -11, -6].map((gx) => <line key={gx} x1={gx} y1="-60" x2={gx} y2="-52" />)}</g>}
          {mood === 'music' && (
            <g>
              <path d="M -25 -46 Q -6 -72 13 -46" fill="none" stroke="#ff7eb6" strokeWidth="3" />
              <rect x="-29" y="-50" width="7" height="12" rx="3" fill="#ff7eb6" />
              <rect x="10" y="-50" width="7" height="12" rx="3" fill="#ff7eb6" />
            </g>
          )}
          {sleeping && (
            <circle cx="-2" cy={-37} r={3 + (Math.sin(t * 1.6) + 1) * 3.2} fill="#9ee6ff" fillOpacity="0.55" stroke="#e7f6ff" strokeWidth="0.8" />
          )}
        </g>
        {/* brazo + taza */}
        {mood === 'coffee' && (
          <g transform={sipping ? 'translate(4,-22)' : ''}>
            <rect x="6" y="-8" width="12" height="13" rx="2.5" fill="#f2efe8" />
            <path d="M 18 -5 q 5 0 5 4 q 0 4 -5 4" fill="none" stroke="#f2efe8" strokeWidth="2" />
            {!tired && [0, 1].map((k) => (
              <path key={k} d={`M ${10 + k * 4} -11 q ${Math.sin(t * 3 + k) * 3} -5 0 -10`} fill="none" stroke="#e7ecf8" strokeOpacity={0.5} strokeWidth="1.3" />
            ))}
          </g>
        )}
        {(mood === 'deciding' || mood === 'annoyed') && tired && <path d={`M 12 ${-58 + ((t * 10) % 5)} q 5 8 0 11 q -5 -3 0 -11 z`} fill="#8fd8ff" />}
        {mood === 'alert' && <text x="16" y="-66" fill="#ffc14d" style={{ font: '700 18px var(--f-display)' }}>!</text>}
      </g>
      {/* escritorio y laptop */}
      <rect x="-48" y="4" width="98" height="9" rx="3" fill="#3a4566" />
      <rect x="-42" y="13" width="5" height="22" fill="#2a3352" /><rect x="39" y="13" width="5" height="22" fill="#2a3352" />
      <path d="M 18 4 L 22 -14 L 46 -14 L 44 4 Z" fill="#8f9bb9" />
      <circle cx="33" cy="-5" r="2.2" fill={mood === 'deciding' ? '#ffc14d' : '#e7ecf8'} fillOpacity={mood === 'deciding' ? 0.6 + Math.sin(t * 8) * 0.4 : 0.6} />
      {/* notas y zzz */}
      {mood === 'music' && [0, 1, 2].map((k) => {
        const ph = (t * 0.6 + k / 3) % 1;
        return <text key={k} x={-30 + k * 14 + Math.sin(ph * 6) * 4} y={-70 - ph * 30} fill="#ff7eb6" fillOpacity={1 - ph} style={{ font: '700 13px sans-serif' }}>{k % 2 ? '♫' : '♪'}</text>;
      })}
      {sleeping && [0, 1, 2].map((k) => {
        const ph = (t * 0.5 + k / 3) % 1;
        return <text key={k} x={8 + ph * 20} y={-62 - ph * 26} fill="#9ee6ff" fillOpacity={1 - ph} style={{ font: `700 ${10 + k * 3}px var(--f-display)` }}>z</text>;
      })}
      {mood === 'done' && <text x="18" y="-62" fill="#5fe3a1" style={{ font: '700 15px sans-serif' }}>✓</text>}
      {remaining != null && (
        <g transform="translate(-6,-44)">
          <circle r="27" fill="none" stroke="#26314f" strokeWidth="3" />
          <circle r="27" fill="none" stroke={remaining > 0.35 ? '#ffc14d' : '#ff5d6c'} strokeWidth="3" strokeDasharray={`${remaining * 169.6} 169.6`} transform="rotate(-90)" strokeLinecap="round" />
        </g>
      )}
      <text y="24" x={labelLeft ? -54 : 54} textAnchor={labelLeft ? 'end' : 'start'} fill="#e7ecf8" style={{ font: '600 12px var(--f-display)', letterSpacing: '.08em' }}>{T('human')}</text>
      <text y="37" x={labelLeft ? -54 : 54} textAnchor={labelLeft ? 'end' : 'start'} fill="#8f9bb9" style={{ font: '11px var(--f-mono)' }}>{T('reviewer')}{tired ? ' · 😵' : ''}</text>
    </g>
  );
}
