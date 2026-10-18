import { motion } from 'framer-motion';
import { SCENARIOS, FAULTS } from '../sim/model.js';
import { tx, t as T, B } from '../i18n.js';

// Compara los dos escenarios con datos reales del modelo (no números inventados).
function stats(sc) {
  const faults = [...new Set(Object.values(sc.agentFaults).flat())];
  return {
    cAgents: sc.agents.length,
    cZones: sc.zones ? sc.zones.length : 1,
    cSentinels: sc.sentinels.length,
    cPath: sc.path.length - 1,
    cWatched: sc.watched.length,
    cMoney: sc.money ? 1 : 0,
    cHuman: faults.filter((f) => FAULTS[f].approval).length,
  };
}
const ROWS = ['cAgents', 'cZones', 'cSentinels', 'cPath', 'cWatched', 'cMoney', 'cHuman'];
const fmt = (r, v) => (r === 'cMoney' ? tx(v ? B('Sí', 'Yes') : B('No', 'No')) : v);
const LESSONS = [
  B('Cada handoff es un lugar donde algo se puede perder o llegar contaminado.', 'Every handoff is a place where something can get lost or arrive tainted.'),
  B('Más zonas = un solo Sentinela no alcanza. Dividir el trabajo exige que se cubran y se vigilen.', 'More zones = one Sentinel is not enough. Splitting the work means they must cover and watch each other.'),
  B('Con dinero, clientes y precios en juego, aparecen más casos para el humano… y más riesgo de cansarlo.', 'With money, customers and pricing at stake, more cases go to the human… and more risk of wearing them out.'),
];

export function Compare({ current, onSwitch, hl }) {
  const a = stats(SCENARIOS.content), b = stats(SCENARIOS.gtm);
  return (
    <section className={'card compare' + (hl === 'compare' ? ' hl' : '')} id="comparar">
      <h2>{T('compare')}</h2>
      <p className="empty" style={{ marginBottom: 12 }}>{T('compareHint')}</p>
      <div className="cmp-head">
        <span />
        {[['content', 'scContent'], ['gtm', 'scGtm']].map(([k, l]) => (
          <button key={k} className={'cmp-col' + (current === k ? ' on' : '')} onClick={() => onSwitch(k)}>
            {T(l)}<small>{current === k ? T('current') : T('switchTo') + ' →'}</small>
          </button>
        ))}
      </div>
      {ROWS.map((r) => {
        const max = Math.max(a[r], b[r], 1);
        if (r === 'cMoney') { /* barra llena = sí */ }
        return (
          <div key={r} className="cmp-row">
            <span className="cl">{T(r)}</span>
            {[a, b].map((v, i) => (
              <div key={i} className="cmp-cell">
                <div className="cb"><motion.i initial={{ width: 0 }} animate={{ width: `${(v[r] / max) * 100}%` }} style={{ background: i ? '#9ee6ff' : '#ffc14d' }} /></div>
                <b>{fmt(r, v[r])}</b>
              </div>
            ))}
          </div>
        );
      })}
      <ul className="cmp-lessons">{LESSONS.map((l, i) => <li key={i}>{tx(l)}</li>)}</ul>
    </section>
  );
}
