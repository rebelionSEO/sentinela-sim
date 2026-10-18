import { GLOSSARY } from '../content/learn.js';
import { tx, t as T, B } from '../i18n.js';

// Diagrama de arquitectura: dónde se ubica el Sentinela respecto a los agentes y al humano.
function Arch() {
  const L = (es, en) => tx(B(es, en));
  const box = (x, y, w, h, title, sub, opt = {}) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={opt.fill || '#18213b'} stroke={opt.stroke || '#33405f'} strokeDasharray={opt.dash} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 4 : -4)} textAnchor="middle" fill={opt.tc || '#e7ecf8'} style={{ font: '600 13px var(--f-display)' }}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fill="#8f9bb9" style={{ font: '11px var(--f-mono)' }}>{sub}</text>}
    </g>
  );
  const stages = [L('Ingesta', 'Ingest'), L('Normalizar', 'Normalize'), L('Reglas', 'Rules'), L('Anomalía', 'Anomaly'), L('Decisión', 'Decision'), L('Acción', 'Action')];
  return (
    <svg viewBox="0 0 900 360" role="img" aria-label={L('Arquitectura del Sentinela', 'Sentinel architecture')}>
      <defs>
        <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8f9bb9" /></marker>
        <marker id="am" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffc14d" /></marker>
      </defs>
      {box(20, 110, 150, 90, L('Agentes', 'Agents'), L('en el bus', 'on the bus'))}
      <rect x="250" y="30" width="430" height="200" rx="14" fill="#1d1a14" stroke="#ffc14d" strokeOpacity="0.6" />
      <text x="270" y="56" fill="#ffc14d" style={{ font: '700 13px var(--f-display)', letterSpacing: '.16em' }}>{L('SENTINELA', 'SENTINEL')}</text>
      {stages.map((s, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 270 + col * 135, y = 74 + row * 72;
        return (
          <g key={i}>
            <rect x={x} y={y} width="120" height="48" rx="8" fill="#2a2416" stroke="#ffc14d" strokeOpacity="0.35" />
            <text x={x + 60} y={y + 20} textAnchor="middle" fill="#ffc14d" style={{ font: '500 10px var(--f-mono)' }}>{i + 1}</text>
            <text x={x + 60} y={y + 36} textAnchor="middle" fill="#e7ecf8" style={{ font: '600 12px var(--f-display)' }}>{s}</text>
            {col < 2 && <line x1={x + 120} y1={y + 24} x2={x + 133} y2={y + 24} stroke="#ffc14d" strokeOpacity="0.6" markerEnd="url(#am)" />}
          </g>
        );
      })}
      <path d="M 600 122 C 600 136, 330 130, 330 143" fill="none" stroke="#ffc14d" strokeOpacity="0.6" markerEnd="url(#am)" />
      {box(730, 30, 150, 60, L('Bitácora', 'Audit log'), L('7 · auditoría', '7 · audit'))}
      {box(730, 110, 150, 60, L('Humano', 'Human'), L('si es crítico', 'if critical'), { stroke: '#ff5d6c' })}
      {box(730, 190, 150, 50, 'Watchdog', L('vigila al Sentinela', 'watches the Sentinel'), { dash: '4 4' })}
      {box(250, 280, 160, 50, 'Gate', L('revisión síncrona', 'synchronous check'), { stroke: '#ffc14d', tc: '#ffc14d' })}
      {box(490, 280, 190, 50, L('Acciones riesgosas', 'Risky actions'), L('email · http · precios', 'email · http · pricing'), { stroke: '#ff5d6c' })}
      <path d="M 170 135 L 250 135" stroke="#ffc14d" strokeDasharray="5 4" markerEnd="url(#am)" />
      <text x="174" y="126" fill="#ffc14d" style={{ font: '10px var(--f-mono)' }}>{L('telemetría', 'telemetry')}</text>
      <path d="M 250 190 L 170 190" stroke="#8f9bb9" markerEnd="url(#ar)" />
      <text x="178" y="207" fill="#8f9bb9" style={{ font: '10px var(--f-mono)' }}>{L('controles', 'controls')}</text>
      <path d="M 95 200 L 95 305 L 250 305" fill="none" stroke="#8f9bb9" markerEnd="url(#ar)" />
      <path d="M 410 305 L 490 305" stroke="#8f9bb9" markerEnd="url(#ar)" />
      <text x="420" y="296" fill="#5fe3a1" style={{ font: '10px var(--f-mono)' }}>{L('si aprueba', 'if cleared')}</text>
      <path d="M 330 280 L 330 232" stroke="#ffc14d" markerEnd="url(#am)" />
      <path d="M 680 60 L 730 60" stroke="#8f9bb9" markerEnd="url(#ar)" />
      <path d="M 680 140 L 730 140" stroke="#ff5d6c" markerEnd="url(#ar)" />
      <path d="M 730 215 L 682 215" stroke="#8f9bb9" strokeDasharray="4 4" markerEnd="url(#ar)" />
    </svg>
  );
}

const NOTES = [
  [B('Fuera de banda', 'Out of band'), B('Lee telemetría por un canal aparte. No frena a los agentes.', "Reads telemetry on a side channel. Doesn't slow agents down.")],
  [B('Gate solo donde importa', 'Gate only where it matters'), B('Lo riesgoso espera revisión; lo demás fluye.', 'Risky actions wait for review; the rest flows.')],
  [B('Dos capas de detección', 'Two detection layers'), B('Reglas fijas + anomalías contra la línea base.', 'Fixed rules + anomalies against the baseline.')],
  [B('Respuesta proporcional', 'Proportional response'), B('Observar → … → Escalar. Solo lo necesario.', 'Observe → … → Escalate. Only as needed.')],
  [B('Humano en lo irreversible', 'Human for the irreversible'), B('Fugas, precios y dinero los decide una persona. Si no responde: fail-closed.', 'Leaks, pricing and money go to a person. No answer: fail-closed.')],
  [B('Sencilla vs compleja', 'Simple vs complex'), B('Más zonas y handoffs = más puntos de falla. Por eso GTM usa 2 Sentinelas que se cubren.', 'More zones and handoffs = more failure points. That is why GTM uses 2 Sentinels that cover each other.')],
];

export function HowItWorks() {
  return (
    <section className="card how" id="como-funciona">
      <h2>{T('how')}</h2>
      <p className="lead">{tx(B('El Sentinela es un agente con un solo trabajo: mirar a los demás. Observa aparte, detecta, responde lo mínimo y deja evidencia.',
        'The Sentinel is an agent with one job: watching the others. It observes on the side, detects, responds minimally and leaves a record.'))}</p>
      <div className="diagram"><Arch /></div>
      <div className="notes">
        {NOTES.map(([h, p], i) => <div key={i} className="note"><h3>{tx(h)}</h3><p>{tx(p)}</p></div>)}
      </div>
      <h2 style={{ marginTop: 20 }}>{T('glossary')}</h2>
      <dl className="glossary">
        {GLOSSARY.map((g, i) => <div key={i}><dt>{tx(g.k)}</dt><dd>{tx(g.d)}</dd></div>)}
      </dl>
    </section>
  );
}
