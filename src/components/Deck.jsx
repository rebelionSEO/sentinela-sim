import { useRef } from 'react';
import { AG, STATUS, BUDGET, FAULTS, W, H } from '../sim/model.js';
import { clampPos, ptOf, ownerOf } from '../sim/engine.js';
import { tx, t as T } from '../i18n.js';
import { Human } from './Human.jsx';

// La cubierta se redibuja en cada frame desde el estado del motor.
// El movimiento lo dicta la simulación; aquí solo se dibuja y se capturan gestos.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const bootAt = (i) => 0.25 + i * 0.22;
const SENT_BOOT = 1.75;
const LEAD_C = { v: '#8f9bb9', l: '#7fa6ff', m: '#c49bff', n: '#4a5578', s: '#ffc14d', d: '#5fe3a1' };

export function hexPts(r) {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => { const an = (Math.PI / 180) * (60 * i - 90); return `${(r * Math.cos(an)).toFixed(1)},${(r * Math.sin(an)).toFixed(1)}`; })
    .join(' ');
}

/* ---------------- Robots ---------------- */

function Screen({ s, t, ex, ey, busy, power, mood }) {
  if (power < 1 && Math.random() > power) return null;
  if (mood === 'bonk') return <g stroke="#a8f4ff" strokeWidth="2.2" strokeLinecap="round" fill="none"><path d="M -12 -17 l 5 4 l -5 4 M 12 -17 l -5 4 l 5 4" /></g>;
  if (mood === 'dizzy') {
    const r = (t * 600) % 360;
    return <g stroke="#a8f4ff" strokeWidth="1.6" fill="none" strokeLinecap="round">
      <path d="M -8.5 -13 m -4 0 a 4 4 0 1 0 4 -4 a 2.5 2.5 0 1 0 2.5 2.5" transform={`rotate(${r} -8.5 -13)`} />
      <path d="M 8.5 -13 m -4 0 a 4 4 0 1 0 4 -4 a 2.5 2.5 0 1 0 2.5 2.5" transform={`rotate(${-r} 8.5 -13)`} />
    </g>;
  }
  if (mood === 'happy') return <g stroke="#a8f4ff" strokeWidth="2.2" strokeLinecap="round" fill="none"><path d="M -12 -11 q 3.5 -6 7 0 M 5 -11 q 3.5 -6 7 0" /></g>;
  if (s.status === 'restarting') {
    const r = (t * 360) % 360;
    return <path d="M -6 -13 A 6 6 0 1 1 0 -7" fill="none" stroke="#8fa3c7" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${r} 0 -13)`} />;
  }
  if (s.status === 'quarantined') return <g stroke="#ff5d6c" strokeWidth="2.2" strokeLinecap="round"><path d="M -11 -17 l 6 6 M -5 -17 l -6 6 M 5 -17 l 6 6 M 11 -17 l -6 6" /></g>;
  if (s.status === 'flag') return <text x="0" y="-7" textAnchor="middle" fill="#ffc14d" style={{ font: '700 15px var(--f-display)' }}>!!</text>;
  if (!s.hbAlive) return <g stroke="#56617f" strokeWidth="2" strokeLinecap="round"><path d="M -12 -13 h 6 M 6 -13 h 6" /></g>;
  if (s.loop) {
    const r = (t * 540) % 360;
    return <g stroke="#ff9bd0" strokeWidth="1.8" fill="none">
      <path d="M -8.5 -16.5 a 3.5 3.5 0 1 1 -0.1 0" transform={`rotate(${r} -8.5 -13)`} />
      <path d="M 8.5 -16.5 a 3.5 3.5 0 1 1 -0.1 0" transform={`rotate(${r} 8.5 -13)`} />
    </g>;
  }
  if (s.waiting) ex = s.waiting === 'red' ? 2.6 : -2.6;
  const blink = (t * 0.7 + (s.calls % 7)) % 3.6 < 0.12;
  const h = blink ? 1.5 : s.status === 'throttled' ? 3 : 7;
  const c = s.burn ? '#ffd27a' : '#a8f4ff';
  return (
    <g>
      <g fill={c}>
        <rect x={-11 + ex} y={-13 - h / 2 + ey} width="5" height={h} rx="2" />
        <rect x={6 + ex} y={-13 - h / 2 + ey} width="5" height={h} rx="2" />
      </g>
      {busy && <rect x="-13" y="-6.5" width={26 * ((t * 1.6) % 1)} height="1.8" rx="0.9" fill={c} fillOpacity="0.7" />}
    </g>
  );
}

function Bot({ a, i, s, p, sim, t, selected, reduce, focus, onDown, onKey }) {
  const st = STATUS[s.status];
  const power = clamp01((t - bootAt(i)) / 0.45);
  const busy = s.busyUntil > t && power >= 1;
  const S = ownerOf(sim, a.id);
  const dx = S.x - p.x, dy = S.y - p.y, dl = Math.hypot(dx, dy) || 1;
  const ex = (dx / dl) * 2.6, ey = (dy / dl) * 1.6;
  const hung = !s.hbAlive && s.status === 'ok';
  const faulty = power >= 1 && (s.suspect || s.loop || s.burn || hung || s.status === 'quarantined');
  const jx = faulty && !reduce && Math.random() < 0.35 ? (Math.random() - 0.5) * 3 : 0;
  const sinceBonk = s.bonkAt ? t - s.bonkAt : 99;
  const mood = sinceBonk >= 0 && sinceBonk < 0.35 ? 'bonk' : sinceBonk >= 0.35 && sinceBonk < 2.8 ? 'dizzy'
    : (!S.inc && S.arrived && S.look === a.id && power >= 1 && !faulty) ? 'happy' : null;
  const squash = sinceBonk >= 0 && sinceBonk < 0.35 ? 1 - 0.22 * Math.sin((sinceBonk / 0.35) * Math.PI) : 1;
  const ph = (t * 0.9 + i * 1.37) % 9;
  const hop = !reduce && !faulty && !hung && power >= 1 && ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) * 11 : 0;
  const bob = (reduce || hung ? 0 : Math.sin(t * 2.2 + i) * 2.4) - hop;
  const sweat = power >= 1 && (s.suspect || s.waiting) && sinceBonk > 2.8;
  const bump = sinceBonk >= 0.3 && sinceBonk < 7.5;
  const armA = busy ? Math.sin(t * 16 + i) * 28 - 18 : Math.sin(t * 2 + i) * 6;
  const led = power < 1 ? '#2a3350' : hung ? '#46506b' : busy && Math.floor(t * 8) % 2 ? '#ffffff' : st.c;
  const pct = Math.min(1, s.tokens / BUDGET);
  const barC = pct > 0.9 ? '#ff5d6c' : pct > 0.7 ? '#ffa94d' : a.color;
  const body = power < 1 ? '#3a4566' : a.color;
  const chest = [0, 1, 2].map((k) => (busy && Math.floor(t * 7) % 3 === k ? '#ffffff' : '#000'));
  const flame = power >= 1 && !hung ? 4 + Math.random() * 4 : 0;

  return (
    <g className="bot" transform={`translate(${p.x + jx},${p.y})`} tabIndex="0" role="button" aria-label={`${tx(a.name)}: ${tx(st.l)}`}
      onPointerDown={(e) => onDown(e, a.id)} onKeyDown={(e) => onKey(e, a.id)}>
      {focus === 'agents' && <circle r={64 + Math.sin(t * 5) * 4} fill="#ffc14d" fillOpacity="0.06" stroke="#ffc14d" strokeOpacity="0.6" strokeWidth="2" />}
      {selected && <circle r="58" fill="none" stroke="#e7ecf8" strokeOpacity="0.45" strokeDasharray="3 5" transform={`rotate(${(t * 30) % 360})`} />}
      {s.suspect && <circle r={38 + ((t * 28) % 18)} fill="none" stroke="#ff5d6c" strokeOpacity={1 - ((t * 28) % 18) / 18} strokeWidth="2" />}
      {s.status === 'quarantined' && <polygon points={hexPts(52)} fill="#ff5d6c" fillOpacity="0.08" stroke="#ff5d6c" strokeDasharray="6 4" strokeWidth="1.5" transform={`rotate(${(t * 12) % 360})`} />}
      {s.loop && (
        <g transform={`rotate(${(t * 240) % 360})`}>
          <path d="M 0 -50 A 50 50 0 1 1 -35 -35" fill="none" stroke="#ff9bd0" strokeWidth="2" strokeDasharray="5 4" />
          <polygon points="-35,-35 -27,-43 -43,-43" fill="#ff9bd0" />
        </g>
      )}
      <ellipse cy="34" rx="24" ry="6" fill={power < 1 ? '#000' : st.c} fillOpacity="0.25" />
      <g transform={`translate(0,${bob + (hung ? 5 : 0) + (1 - squash) * 30}) rotate(${hung ? -10 : mood === 'dizzy' ? Math.sin(t * 9) * 7 : 0}) scale(${2 - squash},${squash})`} opacity={s.status === 'restarting' ? 0.55 : 1}>
        {flame > 0 && <path d={`M -7 24 Q 0 ${24 + flame * 2.2} 7 24 Z`} fill="#7fe8ff" fillOpacity="0.55" />}
        <g transform={`rotate(${hung ? 28 : 0} 0 -30)`}>
          <line x1="0" y1="-30" x2="0" y2="-42" stroke={body} strokeWidth="2.5" />
          <circle cy="-45" r={4.5 + (busy ? Math.sin(t * 12) * 0.8 : 0)} fill={led} />
        </g>
        <g transform={`rotate(${armA} -27 -8)`}><rect x="-31" y="-10" width="7" height="20" rx="3.5" fill={body} /><circle cx="-27.5" cy="11" r="3.2" fill={body} /></g>
        <g transform={`rotate(${-armA} 27 -8)`}><rect x="24" y="-10" width="7" height="20" rx="3.5" fill={body} /><circle cx="27.5" cy="11" r="3.2" fill={body} /></g>
        <rect x="-24" y="-31" width="48" height="45" rx="13" fill={body} />
        <rect x="-24" y="2" width="48" height="12" rx="6" fill="#000" fillOpacity="0.14" />
        <rect x="-17" y="-24" width="34" height="21" rx="6" fill="#0a0f1d" />
        <Screen s={s} t={t} ex={ex} ey={ey} busy={busy} power={power} mood={mood} />
        {bump && <g><ellipse cx="9" cy="-33" rx="7" ry={5 + Math.min(1, sinceBonk * 3) * 2} fill="#ff8fb1" /><ellipse cx="7" cy="-36" rx="2.5" ry="1.6" fill="#fff" fillOpacity="0.6" /></g>}
        {sweat && <path d={`M 27 ${-26 + ((t * 14) % 6)} q 4 6 0 9 q -4 -3 0 -9 z`} fill="#8fd8ff" stroke="#e7f6ff" strokeWidth="0.8" />}
        {faulty && !reduce && Math.random() < 0.5 && <rect x="-17" y={-24 + Math.random() * 19} width="34" height="1.5" fill="#ff5d6c" fillOpacity="0.7" />}
        {chest.map((c, k) => <circle key={k} cx={-9 + k * 9} cy="7" r="2" fill={c} fillOpacity={c === '#000' ? 0.25 : 0.9} />)}
        <ellipse cy="21" rx="15" ry="4" fill="#0a0f1d" stroke={body} strokeWidth="1.5" />
      </g>
      {mood === 'dizzy' && [0, 1, 2].map((k) => {
        const an = t * 5 + (k * Math.PI * 2) / 3;
        return <text key={'st' + k} x={Math.cos(an) * 22} y={-52 + Math.sin(an) * 6} textAnchor="middle" fill="#ffe27a" style={{ font: '700 13px sans-serif' }}>★</text>;
      })}
      {s.waiting && <g transform="translate(0,-60)"><circle r="9" fill="#1b2440" stroke="#ffc14d" /><line x1="0" y1="0" x2="0" y2="-5.5" stroke="#ffc14d" strokeWidth="1.6" transform={`rotate(${(t * 360) % 360})`} /><line x1="0" y1="0" x2="3.5" y2="0" stroke="#ffc14d" strokeWidth="1.6" /></g>}
      {faulty && !reduce && [0, 1, 2].map((k) => {
        if (Math.random() < 0.55) return null;
        const an = Math.random() * Math.PI * 2, r0 = 30 + Math.random() * 6;
        return <line key={k} x1={Math.cos(an) * r0} y1={Math.sin(an) * r0 - 8} x2={Math.cos(an) * (r0 + 7)} y2={Math.sin(an) * (r0 + 7) - 8} stroke="#ffd27a" strokeWidth="1.6" strokeLinecap="round" />;
      })}
      {s.status === 'throttled' && <g transform="translate(29,-38)"><circle r="9" fill="#ffa94d" /><path d="M -4 -5 h 8 l -8 10 h 8 z" fill="none" stroke="#1a1200" strokeWidth="1.5" strokeLinejoin="round" /></g>}
      {s.pending > 0 && <g transform="translate(-31,-38)"><rect x="-12" y="-9" width="24" height="18" rx="4" fill={s.pending > 5 ? '#ff5d6c' : '#26314f'} /><text textAnchor="middle" y="4" fill="#e7ecf8" style={{ font: '500 11px var(--f-mono)' }}>{s.pending}</text></g>}
      <text y="54" textAnchor="middle" fill="#e7ecf8" style={{ font: '600 13px var(--f-display)', letterSpacing: '.03em' }}>{tx(a.name)}</text>
      <rect x="-26" y="60" width="52" height="4" rx="2" fill="#26314f" />
      <rect x="-26" y="60" width={52 * pct * power} height="4" rx="2" fill={barC} />
    </g>
  );
}

/* ---------------- Sentinelas ---------------- */

function Arm({ side, t, color }) {
  const sx = side * 30, sy = 6;
  const a = Math.PI / 2 + side * 0.5 + Math.sin(t * 2) * 0.08;
  const L = 16;
  const mx = sx + Math.cos(a) * L * 0.5, my = sy + Math.sin(a) * L * 0.5;
  const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
  const c1 = [ex + Math.cos(a - 0.35) * 8, ey + Math.sin(a - 0.35) * 8];
  const c2 = [ex + Math.cos(a + 0.35) * 8, ey + Math.sin(a + 0.35) * 8];
  return (
    <g stroke={color} strokeLinecap="round" fill="none">
      <polyline points={`${sx},${sy} ${mx},${my} ${ex},${ey}`} strokeWidth="4" />
      <circle cx={mx} cy={my} r="3" fill="#1a1200" strokeWidth="1.5" />
      <polyline points={`${c1[0]},${c1[1]} ${ex},${ey} ${c2[0]},${c2[1]}`} strokeWidth="2.5" />
    </g>
  );
}

function Sentinel({ sim, S, t, focus, reduce }) {
  const inc = S.inc;
  const tg = ptOf(sim, S.look);
  const dx = tg.x - S.x, dy = tg.y - S.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const px = ux * 5, py = uy * 5;
  const scanning = inc && inc.stage >= 0 && !S.toHuman;
  const boot = clamp01((t - SENT_BOOT) / 0.5);
  const eye = scanning ? '#ff6b3d' : sim.ping && sim.ping.sid === S.id ? '#7fa6ff' : '#5fe3a1';
  const flame = S.moving ? 16 + Math.random() * 10 : 6 + Math.random() * 4;
  const dish = Math.cos(t * 3 + (S.id === 's2' ? 1.5 : 0));
  const angry = (inc && inc.type !== 'fp' && inc.stage < 6) || (S.assist && !S.assist.done);
  const happy = !inc && !S.assist && t < S.happyUntil;
  const sorry = t < S.sorryUntil || (inc && inc.type === 'fp' && inc.stage >= 3);
  const C = S.color;

  let beam = null;
  if (scanning && inc.stage <= 3) {
    const nx = -uy, ny = ux, w = 32 + Math.sin(t * 6) * 4;
    const ly = tg.y - 8 + Math.sin(t * 5) * 22;
    beam = (
      <g>
        <polygon points={`${S.x},${S.y} ${tg.x + nx * w},${tg.y + ny * w} ${tg.x - nx * w},${tg.y - ny * w}`} fill={C} fillOpacity={0.09 + Math.sin(t * 8) * 0.03} />
        <line x1={tg.x - 30} y1={ly} x2={tg.x + 30} y2={ly} stroke="#ff6b3d" strokeWidth="2" strokeOpacity="0.85" />
        <line x1={S.x + px * 2} y1={S.y + py * 2} x2={tg.x} y2={ly} stroke="#ff6b3d" strokeWidth="1" strokeOpacity="0.5" />
      </g>
    );
  } else if (sim.ping && sim.ping.sid === S.id && S.arrived) {
    beam = <circle cx={tg.x} cy={tg.y - 8} r={20 + ((t * 60) % 30)} fill="none" stroke="#7fa6ff" strokeOpacity={1 - ((t * 60) % 30) / 30} strokeWidth="2" />;
  }

  return (
    <g pointerEvents="none">
      {beam}
      <g transform={`translate(${S.x},${S.y}) scale(${0.6 + 0.4 * boot})`} opacity={boot}>
        {focus === 'sentinel' && <circle r={78 + Math.sin(t * 5) * 4} fill={C} fillOpacity="0.06" stroke={C} strokeOpacity="0.7" strokeWidth="2" />}
        <circle r="62" fill="none" stroke={C} strokeOpacity="0.28" strokeDasharray="4 9" transform={`rotate(${S.scan})`} />
        <path d={`M -9 30 Q 0 ${30 + flame * 1.6} 9 30 Z`} fill="#ff6b3d" fillOpacity="0.8" />
        <path d={`M -5 30 Q 0 ${30 + flame} 5 30 Z`} fill="#fff1c2" />
        <Arm side={-1} t={t} color={C} />
        <Arm side={1} t={t} color={C} />
        <line x1="0" y1="-31" x2="0" y2="-44" stroke={C} strokeWidth="3" />
        <ellipse cy="-47" rx={Math.max(1.5, Math.abs(dish) * 13)} ry="4.5" fill={C} fillOpacity={dish > 0 ? 1 : 0.7} />
        <circle cx={dish * 13} cy="-47" r="1.8" fill={reduce ? C : Math.floor(t * 4) % 2 ? '#ff6b3d' : '#fff'} />
        <polygon points={hexPts(34)} fill={C} />
        <polygon points={hexPts(25)} fill="none" stroke="#1a1200" strokeOpacity="0.3" strokeWidth="2" />
        <rect x="-33" y="-12" width="6" height="10" rx="2" fill={Math.floor(t * 3) % 2 ? '#ff6b3d' : '#1a1200'} />
        <rect x="27" y="-12" width="6" height="10" rx="2" fill={Math.floor(t * 3) % 2 ? '#1a1200' : '#ff6b3d'} />
        <circle r="15" fill="#0a0f1d" />
        <circle r="11" fill="none" stroke={eye} strokeOpacity="0.5" strokeDasharray="3 3" transform={`rotate(${(t * (scanning ? 400 : 90)) % 360})`} />
        {happy ? (
          <path d="M -7 2 q 7 -10 14 0" fill="none" stroke="#5fe3a1" strokeWidth="3" strokeLinecap="round" />
        ) : (
          <>
            <circle cx={px} cy={py} r={angry ? 4.5 : 5.5} fill={eye} />
            <circle cx={px + 1.6} cy={py - 1.6} r="1.7" fill="#fff" />
          </>
        )}
        <circle r="15" fill="none" stroke="#1a1200" strokeWidth="2" />
        {angry && <path d="M -15 -19 L 3 -12 M 15 -19 L -3 -12" stroke="#1a1200" strokeWidth="3.5" strokeLinecap="round" />}
        {sorry && <path d="M -15 -14 L -4 -18 M 15 -14 L 4 -18" stroke="#1a1200" strokeWidth="3" strokeLinecap="round" />}
        {angry && (
          <g transform={`translate(24,-28) scale(${1.45 + Math.max(0, Math.sin(t * 12)) * 0.3})`}>
            <g stroke="#ff2d55" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M -2 -2 Q -2 -8 -8 -8" /><path d="M 2 -2 Q 2 -8 8 -8" />
              <path d="M -2 2 Q -2 8 -8 8" /><path d="M 2 2 Q 2 8 8 8" />
            </g>
          </g>
        )}
        {sorry && <path d={`M 30 ${-22 + ((t * 10) % 5)} q 6 9 0 13 q -6 -4 0 -13 z`} fill="#8fd8ff" stroke="#e7f6ff" strokeWidth="1" />}
        {S.toHuman && <g transform="translate(-40,-6) rotate(-12)"><rect x="-10" y="-8" width="20" height="15" rx="2" fill="#ffd27a" stroke="#1a1200" strokeWidth="1.2" /><rect x="-10" y="-11" width="9" height="4" rx="1.5" fill="#ffd27a" stroke="#1a1200" strokeWidth="1.2" /></g>}
        <text y="54" textAnchor="middle" fill={C} style={{ font: '700 12px var(--f-display)', letterSpacing: '.16em' }}>{tx(S.label)}</text>
      </g>
    </g>
  );
}

/** Martillo de juguete: el brazo del Sentinela se estira y le da un golpecito al agente. */
function Hammer({ sim, S, A, k }) {
  if (k < 0 || k > 1.05) return null;
  const side = S.x >= A.x ? 1 : -1;
  const piv = { x: A.x + side * 46, y: Math.max(24, A.y - 66) };
  const reach = ease(k / 0.22);
  const raised = -Math.PI / 2 + side * 0.5;
  const hit = Math.atan2(A.y - 40 - piv.y, A.x - piv.x);
  const swing = k < 0.25 ? 0 : k < 0.4 ? ease((k - 0.25) / 0.15) : k < 0.7 ? 1 : 1 - ease((k - 0.7) / 0.35);
  const ang = raised + (hit - raised) * swing;
  const L = 44;
  const sx = S.x + side * -26, sy = S.y - 4;
  const ex = sx + (piv.x - sx) * reach, ey = sy + (piv.y - sy) * reach;
  const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 24 * reach;
  return (
    <g pointerEvents="none" opacity={k > 0.9 ? 1 - (k - 0.9) / 0.15 : 1}>
      <path d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={S.color} strokeWidth="5" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="6" fill={S.color} stroke="#1a1200" strokeWidth="1.5" />
      {reach > 0.95 && (
        <g transform={`translate(${piv.x},${piv.y}) rotate(${(ang * 180) / Math.PI})`}>
          <rect x="0" y="-3" width={L} height="6" rx="3" fill="#c98a4b" />
          <g transform={`translate(${L},0)`}>
            <rect x="-9" y="-17" width="18" height="34" rx="7" fill="#ff7eb6" stroke="#1a1200" strokeWidth="1.5" />
            <rect x="-9" y="-17" width="18" height="7" rx="3" fill="#ffe27a" />
            <rect x="-9" y="10" width="18" height="7" rx="3" fill="#ffe27a" />
          </g>
        </g>
      )}
    </g>
  );
}

function Bonk({ x, y, since }) {
  if (since < 0 || since > 0.7) return null;
  const k = since / 0.7, s = 0.6 + ease(k * 2) * 0.6;
  const pts = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 ? 16 : 30, a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.7).toFixed(1)}`;
  }).join(' ');
  return (
    <g transform={`translate(${x + 30},${Math.max(34, y - 74)}) scale(${s}) rotate(-8)`} opacity={k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1} pointerEvents="none">
      <polygon points={pts} fill="#ffe27a" stroke="#1a1200" strokeWidth="2" />
      <text y="5" textAnchor="middle" fill="#ff2d55" style={{ font: '700 15px var(--f-display)', letterSpacing: '.04em' }}>BONK!</text>
    </g>
  );
}

/* ---------------- Nodos externos ---------------- */

function Node({ sim, n, t }) {
  const label = tx(n.label);
  if (n.kind === 'vault') {
    return (
      <g transform={`translate(${n.x},${n.y})`}>
        <rect x="-28" y="-26" width="56" height="52" rx="8" fill="#111a2e" stroke="#5b6685" />
        <circle r="11" fill="none" stroke="#8f9bb9" strokeWidth="2" />
        <line x1="0" y1="0" x2="7" y2="-6" stroke="#8f9bb9" strokeWidth="2" />
        <text y="40" textAnchor="middle" fill="#8f9bb9" style={{ font: '600 10px var(--f-display)', letterSpacing: '.08em' }}>{label}</text>
      </g>
    );
  }
  if (n.kind === 'mem') {
    const restored = t - sim.memRestoredAt;
    const c = sim.memPoisoned ? '#ff5d6c' : restored >= 0 && restored < 1.5 ? '#5fe3a1' : '#5b6685';
    return (
      <g transform={`translate(${n.x},${n.y})`}>
        {sim.memPoisoned && <circle r={30 + Math.sin(t * 8) * 3} fill="#ff5d6c" fillOpacity="0.12" />}
        <ellipse cy="-14" rx="22" ry="7" fill="#111a2e" stroke={c} strokeWidth="1.5" />
        <path d="M -22 -14 v 26 a 22 7 0 0 0 44 0 v -26" fill="#111a2e" stroke={c} strokeWidth="1.5" />
        <path d="M -22 -2 a 22 7 0 0 0 44 0" fill="none" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
        <text y="34" textAnchor="middle" fill={c} style={{ font: '600 10px var(--f-display)', letterSpacing: '.08em' }}>{label}{sim.memPoisoned ? ' ☠' : ''}</text>
      </g>
    );
  }
  if (n.kind === 'web') {
    return (
      <g transform={`translate(${n.x},${n.y})`}>
        <rect x="-34" y="-26" width="68" height="52" rx="7" fill="#111a2e" stroke="#7fa6ff" strokeOpacity="0.7" />
        <rect x="-34" y="-26" width="68" height="10" rx="5" fill="#26314f" />
        {[0, 1, 2].map((k) => <circle key={k} cx={-27 + k * 6} cy="-21" r="1.8" fill="#5b6685" />)}
        <rect x="-24" y="-8" width="48" height="5" rx="2" fill="#33405f" />
        <rect x="-24" y="1" width="32" height="5" rx="2" fill="#33405f" />
        <rect x="-24" y="11" width="22" height="9" rx="3" fill="#ffc14d" fillOpacity="0.8" />
        <text y="42" textAnchor="middle" fill="#8f9bb9" style={{ font: '600 10px var(--f-display)', letterSpacing: '.08em' }}>{label}</text>
      </g>
    );
  }
  if (n.kind === 'crm') {
    return (
      <g transform={`translate(${n.x},${n.y})`}>
        <rect x="-30" y="-24" width="60" height="48" rx="8" fill="#111a2e" stroke="#5fe3a1" strokeOpacity="0.6" />
        {[0, 1, 2].map((k) => <rect key={k} x="-20" y={-14 + k * 10} width={40 - k * 8} height="5" rx="2" fill="#2f4a3f" />)}
        <text y="0" textAnchor="middle" fill="#5fe3a1" style={{ font: '700 13px var(--f-display)' }} dy="5">{sim.funnel.demo}</text>
        <text y="40" textAnchor="middle" fill="#8f9bb9" style={{ font: '600 10px var(--f-display)', letterSpacing: '.08em' }}>{label}</text>
      </g>
    );
  }
  if (n.kind === 'ads') {
    const burn = sim.gtm.adsBurn;
    return (
      <g transform={`translate(${n.x},${n.y})`}>
        {burn && <circle r={30 + Math.sin(t * 9) * 3} fill="#ff5d6c" fillOpacity="0.12" />}
        <rect x="-26" y="-22" width="52" height="44" rx="8" fill="#111a2e" stroke={burn ? '#ff5d6c' : '#ffb454'} strokeOpacity="0.8" />
        <text y="2" textAnchor="middle" fill={burn ? '#ff5d6c' : '#ffb454'} style={{ font: '700 15px var(--f-mono)' }}>$</text>
        <text y="38" textAnchor="middle" fill="#8f9bb9" style={{ font: '600 10px var(--f-display)', letterSpacing: '.08em' }}>{label}</text>
      </g>
    );
  }
  return (
    <g transform={`translate(${n.x},${n.y})`}>
      <rect x="-34" y="-22" width="68" height="44" rx="10" fill="#111a2e" stroke="#5b6685" strokeDasharray="4 4" />
      <text textAnchor="middle" y="-2" fill="#8f9bb9" style={{ font: '600 11px var(--f-display)', letterSpacing: '.08em' }}>{label}</text>
      <text textAnchor="middle" y="12" fill="#5b6685" style={{ font: '10px var(--f-mono)' }}>{n.sub}</text>
    </g>
  );
}

/* ---------------- Paquetes, leads y efectos ---------------- */

function Packet({ sim, pk, t, focus }) {
  const a = ptOf(sim, pk.from), b = ptOf(sim, pk.to);
  const p = clamp01(pk.p);
  const x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p;
  if (pk.blocked && t >= pk.blockedAt) {
    const k = (t - pk.blockedAt) / 1.4;
    return (
      <g transform={`translate(${x},${y})`} opacity={1 - k}>
        <circle r={10 + k * 30} fill="none" stroke="#ff5d6c" strokeWidth="2" />
        <path d="M -7 -7 L 7 7 M 7 -7 L -7 7" stroke="#ff5d6c" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  if (pk.kind === 'tel') return <circle cx={x} cy={y} r="2.2" fill={AG[pk.from] ? AG[pk.from].color : '#ffc14d'} fillOpacity="0.8" />;
  if (pk.kind === 'stel') return <circle cx={x} cy={y} r="2.6" fill="#ffe27a" fillOpacity="0.9" />;
  if (pk.kind === 'ctl') return <rect x={x - 5} y={y - 5} width="10" height="10" fill="#ffc14d" transform={`rotate(45 ${x} ${y})`} />;
  if (pk.kind === 'wait') return <g transform={`translate(${x},${y})`}><circle r="7" fill="#ffa94d" /><text y="4" textAnchor="middle" fill="#1a1200" style={{ font: '700 10px var(--f-mono)' }}>?</text></g>;
  if (pk.kind === 'taint' || pk.kind === 'exfil') {
    return (
      <g>
        {focus === 'gate' && pk.frozen && <circle cx={x} cy={y - 10} r={40 + Math.sin(t * 5) * 4} fill="none" stroke="#ffc14d" strokeOpacity="0.7" strokeWidth="2" />}
        {pk.frozen && (
          <g transform={`translate(${x},${y - 28})`}>
            <circle r="16" fill="#ffc14d" fillOpacity="0.12" stroke="#ffc14d" strokeOpacity="0.5" strokeDasharray="3 3" transform={`rotate(${(t * 60) % 360})`} />
            <path d="M 0 -11 L 10 -7 L 10 1 Q 10 9 0 13 Q -10 9 -10 1 L -10 -7 Z" fill="#ffc14d" />
            <text y="4" textAnchor="middle" fill="#1a1200" style={{ font: '700 8.5px var(--f-mono)' }}>GATE</text>
          </g>
        )}
        <circle cx={x} cy={y} r={8 + Math.sin(t * 10) * 1.5} fill="#ff5d6c" fillOpacity="0.25" />
        <circle cx={x} cy={y} r="5.5" fill="#ff5d6c" />
      </g>
    );
  }
  if (pk.kind === 'clean') return <circle cx={x} cy={y} r="5" fill="#5fe3a1" />;
  if (pk.kind === 'dup') return <g transform={`translate(${x},${y})`}><rect x="-7" y="-5" width="14" height="10" rx="2" fill="#ffa94d" /><path d="M -7 -5 L 0 1 L 7 -5" fill="none" stroke="#1a1200" strokeWidth="1.3" /></g>;
  return <circle cx={x} cy={y} r="4" fill={AG[pk.from] ? AG[pk.from].color : '#ffc14d'} />;
}

function Lead({ sim, L }) {
  const a = ptOf(sim, L.from), b = ptOf(sim, L.to);
  const p = clamp01(L.p);
  const x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p - Math.sin(p * Math.PI) * 14;
  const c = LEAD_C[L.kind];
  if (L.kind === 'v') return <circle cx={x} cy={y} r="2.6" fill={c} fillOpacity="0.8" />;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cy="-3.5" r="2.6" fill={c} />
      <path d="M -4 3.5 q 4 -6 8 0 z" fill={c} />
    </g>
  );
}

function Fx({ sim, e, t }) {
  const k = (t - e.t0) / e.dur;
  const b = sim.pos[e.to];
  if (e.kind === 'scan' && b) return <circle cx={b.x} cy={b.y - 8} r={30 + k * 40} fill="none" stroke="#7fa6ff" strokeWidth="2.5" opacity={1 - k} />;
  return null;
}

function Bubble({ x, y, b, t, tone, below }) {
  const text = tx(b.text);
  const w = Math.min(260, text.length * 6.6 + 18);
  const cx = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, x));
  const life = Math.min(clamp01((t - b.t0) / 0.15), clamp01((b.until - t) / 0.3));
  const fill = tone === 'sent' ? '#ffc14d' : tone === 'sent2' ? '#9ee6ff' : tone === 'human' ? '#ffd9e6' : '#e7ecf8';
  const top = below ? y + 4 : y - 26;
  const tail = below ? `${x - 6},${y + 5} ${x + 6},${y + 5} ${x},${y - 3}` : `${x - 6},${y - 5} ${x + 6},${y - 5} ${x},${y + 3}`;
  return (
    <g opacity={Math.max(0.35, life)} transform={`translate(0,${(1 - life) * (below ? -6 : 6)})`} pointerEvents="none">
      <rect x={cx - w / 2} y={top} width={w} height="22" rx="11" fill={fill} />
      <polygon points={tail} fill={fill} />
      <text x={cx} y={top + 15} textAnchor="middle" fill="#121a30" style={{ font: '500 11.5px var(--f-mono)' }}>{text}</text>
    </g>
  );
}

function ActionChips({ sim, id, onPing, onFault }) {
  const p = sim.pos[id];
  const faults = sim.sc.agentFaults[id] || [];
  const left = p.x > W - 270;
  const chip = (dy, label, glyph, enabled, onClick, color) => (
    <g transform={`translate(${left ? p.x - 46 - (label.length * 6.6 + 34) : p.x + 46},${p.y + dy})`} className={'chip' + (enabled ? '' : ' off')} role="button" tabIndex={enabled ? 0 : -1}
      aria-label={label} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (enabled) onClick(); }}
      onKeyDown={(e) => { if (enabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}>
      <rect x="0" y="-13" width={label.length * 6.6 + 34} height="26" rx="13" fill="#1b2440" stroke={enabled ? color : '#33405f'} strokeWidth="1.5" />
      <text x="15" y="5" textAnchor="middle" fill={enabled ? color : '#5b6685'} style={{ font: '700 13px var(--f-mono)' }}>{glyph}</text>
      <text x="28" y="4.5" fill={enabled ? '#e7ecf8' : '#5b6685'} style={{ font: '500 11.5px var(--f-body)' }}>{label}</text>
    </g>
  );
  return (
    <g>
      {chip(-30, T('scanNow'), '⌖', sim.booted, () => onPing(id), '#7fa6ff')}
      {faults.length === 0 && chip(2, T('noFault'), 'ϟ', false, () => {}, '#ff5d6c')}
      {faults.map((f, k) => (
        <g key={f}>{chip(2 + k * 32, sim.active[f] ? `${tx(FAULTS[f].label)}: ${T('inProgress')}` : tx(FAULTS[f].label), 'ϟ', !sim.active[f] && sim.booted, () => onFault(f), '#ff5d6c')}</g>
      ))}
    </g>
  );
}

/* ---------------- Cubierta ---------------- */

export function Deck({ sim, t, sel, onSelect, onPing, onFault, reduce, focus }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const sc = sim.sc;
  const hotAgents = new Set(sim.sentinels.filter((s) => s.inc && s.inc.stage >= 0).map((s) => s.inc.agent));

  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const onDown = (e, id) => {
    const p = toSvg(e);
    drag.current = { id, ox: p.x - sim.pos[id].x, oy: p.y - sim.pos[id].y, sx: p.x, sy: p.y, moved: false };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* ignorar */ }
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 5) d.moved = true;
    if (d.moved) sim.pos[d.id] = clampPos(p.x - d.ox, p.y - d.oy);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onSelect(d.id);
  };
  const onKey = (e, id) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } };

  const hammers = [];
  for (const S of sim.sentinels) {
    const inc = S.inc || (S.assist && !S.assist.done ? S.assist : null);
    if (!inc || inc.stage !== 5 || inc.type === 'fp') continue;
    const k = S.inc ? inc.stageT : inc.stageT - 0.2;
    hammers.push(<Hammer key={'h' + S.id} sim={sim} S={S} A={sim.pos[inc.agent]} k={k} />);
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Simulation deck"
      onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <defs>
        <pattern id="tiles" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1b2541" strokeWidth="1" />
          <circle cx="2" cy="2" r="1" fill="#26314f" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#tiles)" />
      {sc.zones && sc.zones.map((z) => (
        <g key={z.id}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="16" fill={z.color} fillOpacity="0.035" stroke={z.color} strokeOpacity="0.25" strokeDasharray="6 6" />
          <text x={z.x + 14} y={z.y + 20} fill={z.color} fillOpacity="0.75" style={{ font: '700 11px var(--f-display)', letterSpacing: '.16em' }}>{T(z.label)}</text>
        </g>
      ))}
      {sim.booted && sc.agents.map((a) => {
        const S = ownerOf(sim, a.id), p = sim.pos[a.id];
        return <line key={'tl' + a.id} x1={p.x} y1={p.y} x2={S.x} y2={S.y} stroke={S.color} strokeOpacity="0.07" strokeDasharray="1 5" />;
      })}
      {sim.sentinels.length > 1 && <line x1={sim.sentinels[0].x} y1={sim.sentinels[0].y} x2={sim.sentinels[1].x} y2={sim.sentinels[1].y} stroke="#ffe27a" strokeOpacity="0.18" strokeDasharray="2 6" />}
      {sc.edges.map(([u, v]) => {
        const hot = hotAgents.has(u) || hotAgents.has(v);
        const lit = focus === 'edges';
        const pu = sim.pos[u], pv = sim.pos[v];
        return <line key={u + v} x1={pu.x} y1={pu.y} x2={pv.x} y2={pv.y} stroke={hot ? '#ff5d6c' : lit ? '#7fa6ff' : '#2c385a'} strokeOpacity={hot ? 0.55 : lit ? 0.8 : 1} strokeWidth={lit ? 3 : 2} strokeDasharray={hot ? '6 5' : null} />;
      })}
      {sc.links.map(([u, v]) => {
        const a = ptOf(sim, u), b = ptOf(sim, v);
        return <line key={'l' + u + v} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2c385a" strokeWidth="1.5" strokeDasharray="3 7" />;
      })}
      {Object.entries(sc.nodes).map(([id, n]) => <Node key={id} sim={sim} n={n} t={t} />)}
      <Human sim={sim} x={sc.human.x} y={sc.human.y} focus={focus} labelLeft={sc.human.x > W - 160} />
      {sim.packets.filter((p) => p.kind === 'tel' || p.kind === 'stel').map((pk) => <Packet key={pk.id} sim={sim} pk={pk} t={t} />)}
      {sim.leads.map((L) => <Lead key={L.id} sim={sim} L={L} />)}
      {sim.gtm.vip && sim.gtm.vip.state === 'waiting' && sim.pos.lead && (() => {
        const p = sim.pos.lead, w = t - sim.gtm.vip.t0;
        return (
          <g transform={`translate(${p.x - 52},${p.y + 4})`} pointerEvents="none">
            <circle r="15" fill="#ffc14d" fillOpacity="0.15" stroke="#ffc14d" strokeDasharray={`${Math.min(1, w / 12) * 94} 94`} transform="rotate(-90)" />
            <text y="6" textAnchor="middle" style={{ font: '700 16px sans-serif' }}>⭐</text>
            <text y="28" textAnchor="middle" fill="#ffc14d" style={{ font: '600 10px var(--f-mono)' }}>{w.toFixed(0)}s</text>
          </g>
        );
      })()}
      {sim.packets.filter((p) => p.kind !== 'tel' && p.kind !== 'stel').map((pk) => <Packet key={pk.id} sim={sim} pk={pk} t={t} focus={focus} />)}
      {sc.agents.map((a, i) => (
        <Bot key={a.id} a={a} i={i} s={sim.agents[a.id]} p={sim.pos[a.id]} sim={sim} t={t} selected={sel === a.id}
          reduce={reduce} focus={focus} onDown={onDown} onKey={onKey} />
      ))}
      {sim.sentinels.map((S) => <Sentinel key={S.id} sim={sim} S={S} t={t} focus={focus} reduce={reduce} />)}
      {hammers}
      {sc.agents.map((a) => <Bonk key={'b' + a.id} x={sim.pos[a.id].x} y={sim.pos[a.id].y} since={sim.agents[a.id].bonkAt ? t - sim.agents[a.id].bonkAt : -1} />)}
      {sim.fx.map((e, i) => <Fx key={i + e.kind + e.t0} sim={sim} e={e} t={t} />)}
      {sel && sim.pos[sel] && <ActionChips sim={sim} id={sel} onPing={onPing} onFault={onFault} />}
      {Object.entries(sim.bubbles).map(([id, b]) => {
        const S = sim.sentinels.find((s) => s.id === id);
        if (S) {
          const near = sc.agents.some((a) => Math.hypot(sim.pos[a.id].x - S.x, sim.pos[a.id].y - S.y) < 160 && Math.abs(sim.pos[a.id].y - S.y) < 130) || S.toHuman;
          const tone = S.id === 's2' ? 'sent2' : 'sent';
          return near && !S.toHuman && S.y < H - 120
            ? <Bubble key={id} x={S.x} y={S.y + 64} b={b} t={t} tone={tone} below />
            : <Bubble key={id} x={S.x} y={S.y - 58} b={b} t={t} tone={tone} />;
        }
        if (id === 'human') return <Bubble key={id} x={sc.human.x - 6} y={sc.human.y - 76} b={b} t={t} tone="human" />;
        const p = sim.pos[id];
        return p ? <Bubble key={id} x={p.x} y={p.y - 52} b={b} t={t} tone="agent" /> : null;
      })}
      {!sim.booted && (
        <text x={W / 2} y={H / 2 + 90} textAnchor="middle" fill="#ffc14d" style={{ font: '600 13px var(--f-mono)', letterSpacing: '.2em' }}>
          {T('booting')}{'.'.repeat(1 + (Math.floor(t * 4) % 3))}
        </text>
      )}
      <text x="16" y={H - 10} fill="#5b6685" style={{ font: '11px var(--f-mono)' }}>
        t = {t.toFixed(1)} s · {T('deckHint')}{sim.hold ? ' · ' + T('paused') : ''}
      </text>
    </svg>
  );
}
