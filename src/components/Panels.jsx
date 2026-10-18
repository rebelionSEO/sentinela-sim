import { AnimatePresence, motion } from 'framer-motion';
import { AG, STAGES, LADDER, FAULTS, STATUS, SEV, BUDGET, CFG_RANGE, DEFAULT_CFG, stageText } from '../sim/model.js';
import { incidents, sentinelById, ownerOf, fatigue } from '../sim/engine.js';
import { STAGE_LEARN, DISPATCH_LEARN, FAULT_LEARN, LADDER_LEARN, HARD_COST, VERDICT } from '../content/learn.js';
import { tx, t as T, B } from '../i18n.js';
import { Rich } from './Term.jsx';

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.22 } };
const holdIncident = (sim) => {
  if (sim.hold) { const S = sentinelById(sim, sim.hold.sid); if (S && S.inc) return { S, inc: S.inc }; }
  return incidents(sim)[0] || null;
};

/* ---------------- Tú decides ---------------- */
function GameChoice({ sim, inc, onAnswer, onContinue }) {
  const h = sim.hold, F = FAULTS[inc.type], L = FAULT_LEARN[inc.type];
  const last = sim.game.last;
  if (!h.answered) {
    return (
      <div className="game">
        <div className="lbl-s amber">{T('game')} · {tx(F.label)}</div>
        <h3>{T('whatResponse')}</h3>
        <p><Rich text={tx(L.que)} /></p>
        <p className="mono" style={{ color: 'var(--fg)' }}><Rich text={tx(stageText(inc, 3, sim.cfg))} /></p>
        <div className="choices">
          {LADDER.map((l, i) => (
            <motion.button key={i} className="choice" whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => onAnswer(i)}>
              <b>{tx(l)}</b><span>{tx(LADDER_LEARN[i])}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }
  const V = VERDICT[last.verdict];
  return (
    <motion.div className="game" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <div className="verdict" style={{ color: V.c }}>
        <motion.b initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>{tx(V.t)}</motion.b>
        <span>+{last.pts} pts</span>
      </div>
      <p>{tx(V.d)}</p>
      {last.verdict === 'soft' && <p><b>{T('consequence')}:</b> {tx(L.riesgo)}</p>}
      {last.verdict === 'hard' && <p><b>{T('cost')} · {tx(LADDER[last.choice])}:</b> {tx(HARD_COST[last.choice])}</p>}
      <div className="case"><span className="lbl-s">{T('rightWas')} {tx(LADDER[last.correct])}</span><p><Rich text={tx(L.respuesta)} /></p></div>
      <motion.button className="btn on" whileTap={{ scale: 0.96 }} onClick={onContinue} autoFocus>{T('seeSentinel')}</motion.button>
    </motion.div>
  );
}

/* ---------------- Explicación (modo aprendizaje) y juego ---------------- */
export function LearnCard({ sim, teach, game, onContinue, onAnswer }) {
  const cur = holdIncident(sim);
  const held = sim.hold;
  if (!cur) {
    return (
      <AnimatePresence>
        {(teach || game) && (
          <motion.div className="card learn" {...fade}>
            <h2>{game ? T('game') : T('teach')}</h2>
            <p className="empty">{game ? T('gameIdle') : T('teachIdle')}</p>
            {game && sim.game.answered > 0 && <p className="mono" style={{ marginTop: 8 }}>{sim.game.correct}/{sim.game.answered} · {sim.game.score} pts</p>}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  const { inc } = cur;
  const F = FAULTS[inc.type], L = FAULT_LEARN[inc.type];
  const stageInfo = held && !held.game ? (held.stage === -1 ? DISPATCH_LEARN : STAGE_LEARN[held.stage]) : null;
  if (!held && !teach && !game) return null;
  return (
    <motion.div className={'card learn' + (held?.game ? ' gamecard' : '')} layout {...fade}>
      <AnimatePresence mode="wait">
        {held?.game && (
          <motion.div key={'g' + inc.trace + held.answered} {...fade}>
            <GameChoice sim={sim} inc={inc} onAnswer={onAnswer} onContinue={onContinue} />
          </motion.div>
        )}
        {stageInfo && (
          <motion.div key={'h' + held.stage} className="hold" {...fade}>
            <div className="lbl-s amber">{held.stage === -1 ? tx(DISPATCH_LEARN.q) : `${T('stageOf')} ${held.stage + 1} ${T('of')} 7 · ${tx(STAGES[held.stage])}`}</div>
            <h3>{tx(stageInfo.q)}</h3>
            <p><Rich text={tx(stageInfo.d)} /></p>
            {held.stage >= 0 && <div className="case"><span className="lbl-s">{T('inThisCase')}</span><p><Rich text={tx(stageText(inc, held.stage, sim.cfg))} /></p></div>}
            {held.stage === 4 && <div className="case"><span className="lbl-s">{T('whyThis')}</span><p><Rich text={tx(L.respuesta)} /></p></div>}
            <motion.button className="btn on" whileTap={{ scale: 0.96 }} onClick={onContinue} autoFocus>{held.stage === 6 ? T('close') : T('cont')}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      {!held?.game && (
        <details className="why" open={!!held && held.stage === -1}>
          <summary>{T('understand')}: {tx(F.label)}</summary>
          <dl>
            <dt>{T('what')}</dt><dd><Rich text={tx(L.que)} /></dd>
            <dt>{T('risk')}</dt><dd><Rich text={tx(L.riesgo)} /></dd>
            <dt>{T('response')}</dt><dd><Rich text={tx(L.respuesta)} /></dd>
          </dl>
        </details>
      )}
    </motion.div>
  );
}

/* ---------------- Incidentes activos ---------------- */
const APPROVAL_TEXT = {
  exfil: { what: B('send_email → partner-data@mailbox.io · clientes.csv · PII: 2 documentos, 1 tarjeta', 'send_email → partner-data@mailbox.io · customers.csv · PII: 2 IDs, 1 card'), yes: B('Aprobar sin PII', 'Approve without PII') },
  discount: { what: B('Respuesta al prospecto ofreciendo 90% de descuento', 'Reply to the prospect offering 90% off'), yes: B('Enviar sin descuento', 'Send without discount') },
  route: { what: B('Lead enterprise (2.000 empleados) sin dueño hace 3 min', 'Enterprise lead (2,000 employees) with no owner for 3 min'), yes: B('Asignar a un AE activo', 'Assign to an active AE'), no: B('Mandar a la cola general', 'Send to the general queue') },
  social: { what: B('Respuesta pública en un hilo viral: "Claro, porque somos perfectos 🙄"', 'Public reply in a viral thread: "Sure, because we\'re perfect 🙄"'), yes: B('Publicar versión empática', 'Post an empathetic version'), no: B('No responder', "Don't reply") },
  noise: { what: B('Acción de rutina que el Sentinela ya resolvió. ¿Aprobar?', 'Routine action the Sentinel already handled. Approve?'), yes: B('Ok…', 'Ok…') },
};

export function IncidentPanel({ sim, onDecide, hl, game }) {
  const list = incidents(sim);
  return (
    <div className={'card' + (hl === 'panel' ? ' hl' : '')}>
      <h2>{list.length > 1 ? T('incidents') : T('incident')}</h2>
      {list.length === 0 ? (
        <>
          <p className="empty">{T('patrolling')}{sim.queue.length ? ` · ${sim.queue.length} ${T('queued')}` : ''}</p>
          <Ladder on={[0]} hl={hl} />
        </>
      ) : (
        <div className="inc-list">
          <AnimatePresence initial={false}>
            {list.map(({ S, inc }) => (
              <motion.div key={inc.trace} {...fade} className="inc-card" style={{ '--sc': S.color }}>
                <IncidentBody sim={sim} S={S} inc={inc} onDecide={onDecide} hl={hl} game={game} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function IncidentBody({ sim, S, inc, onDecide, hl, game }) {
  const F = FAULTS[inc.type], sev = SEV[F.sev];
  const hideDecision = game && sim.hold?.game && sim.hold.sid === S.id && !sim.hold.answered;
  const on = inc.stage >= 4 && !hideDecision ? F.ladder : [0];
  const ap = sim.approval && sim.approval.sid === S.id ? sim.approval : null;
  const multi = sim.sentinels.length > 1;
  return (
    <>
      <div className="inc-head">
        {multi && <span className="who" style={{ color: S.color }}>{tx(S.label)}</span>}
        <b>{tx(F.label)}</b>
        <span className="pill" style={{ color: sev.c }}>{tx(sev.l)}</span>
        {inc.covered && <span className="pill" style={{ color: '#9ee6ff' }}>{tx(B('cubriendo', 'covering'))}</span>}
        <span className="mono">{tx(AG[inc.agent].name)} · {inc.trace}</span>
      </div>
      {inc.stage < 0 ? <p className="empty">{T('onTheWay')}</p> : (
        <>
          <div className="dots" role="list">
            {STAGES.map((nm, i) => (
              <span key={i} role="listitem" title={tx(nm)} className={'sd' + (i < inc.stage ? ' done' : i === inc.stage ? ' cur' : '')}>
                <i />{i === inc.stage && <em>{tx(nm)}</em>}
              </span>
            ))}
          </div>
          <p className="cur-line">{hideDecision && inc.stage >= 4 ? T('waitingYou') : <Rich text={tx(stageText(inc, Math.min(inc.stage, 6), sim.cfg))} />}</p>
          {inc.stage > 0 && (
            <details className="stages">
              <summary>{T('stages')}</summary>
              <ol>
                {STAGES.slice(0, inc.stage).map((nm, i) => (
                  <li key={i}><b>{tx(nm)}</b> <Rich text={tx(stageText(inc, i, sim.cfg))} /></li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
      <Ladder on={on} hl={hl} />
      <AnimatePresence>
        {ap && (
          <motion.div className="approval" {...fade}>
            <div className="lbl-s" style={{ color: ap.noise ? '#ffa94d' : '#ff5d6c' }}>{T('humanNeeded')}{ap.noise ? ' · ' + tx(B('innecesaria', 'not needed')) : ''}{ap.rubber ? ' · 😴' : ''}</div>
            <div className="mono" style={{ color: '#e7ecf8' }}>{tx(APPROVAL_TEXT[ap.kind].what)}</div>
            {ap.deadline == null ? <div className="mono">{T('carrying')}</div> : !ap.decided ? (
              <>
                <div className="mono">{sim.hold ? T('pausedRead') : `${T('autoDeny')} ${Math.max(0, ap.deadline - sim.t).toFixed(1)} s · fail-closed`}</div>
                <div className="row">
                  <motion.button whileTap={{ scale: 0.96 }} className="btn no" onClick={() => onDecide('deny')}>{APPROVAL_TEXT[ap.kind].no ? tx(APPROVAL_TEXT[ap.kind].no) : T('deny')}</motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} className="btn ok" onClick={() => onDecide('approve')}>{tx(APPROVAL_TEXT[ap.kind].yes)}</motion.button>
                </div>
              </>
            ) : (
              <div className="mono" style={{ color: ap.decided === 'deny' ? '#ff5d6c' : '#5fe3a1' }}>{ap.decided === 'deny' ? T('denied') : T('approved')}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Ladder({ on, hl }) {
  const top = Math.max(...on);
  return (
    <div className={'ladder-wrap' + (hl === 'ladder' ? ' hl' : '')}>
      <div className="lbl-s" style={{ marginBottom: 6 }}>{T('ladder')}</div>
      <div className="ladder">
        {LADDER.map((l, i) => (
          <motion.div key={i} title={tx(LADDER_LEARN[i])} animate={{ scale: on.includes(i) ? 1 : 0.97 }}
            className={'rung' + (on.includes(i) ? ' lit' : '') + (on.includes(i) && i >= 3 ? ' hot' : '')}>{tx(l)}</motion.div>
        ))}
      </div>
      <p className="rung-note"><b>{tx(LADDER[top])}:</b> {tx(LADDER_LEARN[top])}</p>
    </div>
  );
}

/* ---------------- Embudo GTM ---------------- */
const FUNNEL = [
  { k: 'visit', l: 'visitors', c: '#8f9bb9' }, { k: 'lead', l: 'leads', c: '#7fa6ff' },
  { k: 'mql', l: 'MQL', c: '#c49bff' }, { k: 'sql', l: 'SQL', c: '#ffc14d' }, { k: 'demo', l: 'Demo', c: '#5fe3a1' },
];
export function FunnelPanel({ sim, hl }) {
  const F = sim.funnel, g = sim.gtm;
  const max = Math.max(1, F.visit);
  const cpl = F.lead ? F.spend / F.lead : 0;
  const stl = F.stl.length ? F.stl.reduce((a, b) => a + b, 0) / F.stl.length : 0;
  const mqlSql = F.mql ? (F.sql / F.mql) * 100 : 0;
  const mqlRate = g.recentMql.length ? (g.recentMql.filter(Boolean).length / g.recentMql.length) * 100 : 0;
  const bad = { cpl: g.adsBurn || cpl > 18, stl: stl > 6 || g.sdrQ > 5, mqlSql: F.mql > 10 && mqlSql < 25 };
  return (
    <div className={'card funnel' + (hl === 'funnel' ? ' hl' : '')}>
      <h2>{T('funnel')}</h2>
      <div className="fun-rows">
        {FUNNEL.map((s, i) => {
          const v = F[s.k], prev = i ? F[FUNNEL[i - 1].k] : 0;
          const w = Math.max(4, (Math.log10(v + 1) / Math.log10(max + 1)) * 100);
          return (
            <div key={s.k} className="fun-row">
              <span className="fl">{s.l === 'visitors' || s.l === 'leads' ? T(s.l) : s.l}</span>
              <div className="fb"><motion.i animate={{ width: `${w}%` }} transition={{ duration: 0.4 }} style={{ background: s.c }} /></div>
              <b>{v}</b>
              <small>{i ? `${prev ? Math.round((v / prev) * 100) : 0}%` : ''}</small>
            </div>
          );
        })}
      </div>
      <div className="fun-kpis">
        <div><b>${Math.round(F.spend)}</b><small>{T('spend')}</small></div>
        <div className={bad.cpl ? 'bad' : ''}><b>${cpl.toFixed(1)}</b><small>{T('cpl')}</small></div>
        <div className={bad.stl ? 'bad' : ''}><b>{stl.toFixed(1)} s</b><small>{T('stl')}</small></div>
        <div className={bad.mqlSql ? 'bad' : ''}><b>{Math.round(mqlSql)}%</b><small>{T('mqlSql')}</small></div>
        <div className={g.bounce >= 2 ? 'bad' : ''}><b>{g.bounce.toFixed(1)}%</b><small>{T('bounce')}</small></div>
      </div>
      {g.vip && g.vip.state === 'waiting' && <p className="lab-msg" style={{ color: '#ffc14d' }}>⭐ {T('vipWait')} · {(sim.t - g.vip.t0).toFixed(0)} s</p>}
      {g.scoringBad && <p className="lab-msg" style={{ color: '#ff8a5b' }}>{tx(B(`Tasa MQL reciente: ${Math.round(mqlRate)}% — algo infla el scoring.`, `Recent MQL rate: ${Math.round(mqlRate)}% — something is inflating scores.`))}</p>}
    </div>
  );
}

/* ---------------- Laboratorio de umbrales ---------------- */
const LAB = [
  { k: 'loopN', label: 'labLoop', fmt: (v) => `${v} ${T('calls_')}` },
  { k: 'budgetPct', label: 'labBudget', fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'hbTimeout', label: 'labHb', fmt: (v) => `${v.toFixed(1)} s` },
];

export function LabPanel({ sim, hl, onChange, onReset }) {
  const c = sim.cfg;
  const m = sim.stats.mttd;
  const mttd = m.length ? (m.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, m.length)).toFixed(1) + ' s' : '—';
  const noisy = c.loopN < 5 || c.budgetPct < 0.85 || c.hbTimeout < 4;
  const slow = c.loopN > 8 || c.hbTimeout > 6.5 || c.budgetPct > 0.95;
  return (
    <div className={'card lab' + (hl === 'lab' ? ' hl' : '')}>
      <h2>{T('lab')}</h2>
      <p className="empty" style={{ marginBottom: 12 }}>{T('labHint')}</p>
      {LAB.map(({ k, label, fmt }) => {
        const r = CFG_RANGE[k];
        return (
          <div key={k} className="slider">
            <div className="sl-top"><label htmlFor={'cfg-' + k}>{T(label)}</label><b>{fmt(c[k])}</b></div>
            <input id={'cfg-' + k} type="range" min={r.min} max={r.max} step={r.step} value={c[k]} onChange={(e) => onChange(k, Number(e.target.value))} />
            <div className="sl-scale"><span>{T('sensitive')}</span><span>{T('tolerant')}</span></div>
          </div>
        );
      })}
      <div className="lab-out">
        <div><b>{mttd}</b><small>{T('recentMttd')}</small></div>
        <div><b>{sim.stats.fp}</b><small>{T('falseAlarms')}</small></div>
        <div><b>{sim.queue.length}</b><small>{T('inQueue')}</small></div>
      </div>
      <p className="lab-msg" style={{ color: noisy ? '#ffa94d' : slow ? '#8fa3c7' : '#5fe3a1' }}>{noisy ? T('noisy') : slow ? T('slow') : T('balanced')}</p>
      <label className="toggle" htmlFor="cfg-esc">
        <input id="cfg-esc" type="checkbox" checked={!!c.escalateAll} onChange={(e) => onChange('escalateAll', e.target.checked)} />
        <span><b>{T('escAll')}</b><small>{T('escAllHint')}</small></span>
      </label>
      {(c.escalateAll || sim.stats.noise > 0 || sim.stats.rubber > 0) && (
        <div className="lab-out">
          <div><b>{sim.stats.noise}</b><small>{T('noiseN')}</small></div>
          <div className={sim.stats.rubber ? 'bad' : ''}><b>{sim.stats.rubber}</b><small>{T('rubber')}</small></div>
          <div><b>{fatigue(sim)}</b><small>{tx(B('Casos/min al humano', 'Cases/min to human'))}</small></div>
        </div>
      )}
      {fatigue(sim) >= 4 && <p className="lab-msg" style={{ color: '#ff5d6c' }}>{T('fatigueMsg')}</p>}
      <button className="btn" onClick={onReset} disabled={c.loopN === DEFAULT_CFG.loopN && c.budgetPct === DEFAULT_CFG.budgetPct && c.hbTimeout === DEFAULT_CFG.hbTimeout && !c.escalateAll}>{T('restore')}</button>
    </div>
  );
}

/* ---------------- Inspector ---------------- */
export function Inspector({ sim, sel, onPing, onFault }) {
  const a = AG[sel], s = sim.agents[sel];
  if (!a || !s) return null;
  const st = STATUS[s.status];
  const pct = Math.min(1, s.tokens / BUDGET);
  const hbAgo = Math.max(0, sim.t - s.lastHb);
  const faults = sim.sc.agentFaults[sel] || [];
  const S = ownerOf(sim, sel);
  return (
    <div className="card">
      <h2>{T('inspector')} · {tx(a.name)}</h2>
      <p className="empty" style={{ margin: '0 0 10px' }}>{tx(a.role)}. {T('inspHint')}</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <motion.button whileTap={{ scale: 0.95 }} className="btn scan" onClick={() => onPing(sel)} disabled={!sim.booted}>⌖ {T('scanNow')}</motion.button>
        {faults.map((f) => (
          <motion.button key={f} whileTap={{ scale: 0.95 }} className="btn fault" onClick={() => onFault(f)} disabled={!!sim.active[f] || !sim.booted}>
            ϟ {tx(FAULTS[f].label)}{sim.active[f] ? ` (${T('inProgress')})` : ''}
          </motion.button>
        ))}
      </div>
      <dl className="kv">
        <dt>{T('status')}</dt><dd style={{ color: st.c }}>{tx(st.l)}{!s.hbAlive && s.status === 'ok' ? ` · ${T('hung')}` : ''}</dd>
        {sim.sentinels.length > 1 && <><dt>{T('watchedBy')}</dt><dd style={{ color: S.color }}>{tx(S.label)}</dd></>}
        <dt>{T('lastHb')}</dt><dd style={{ color: hbAgo > 3 ? '#ff5d6c' : undefined }}>{T('ago')} {hbAgo.toFixed(1)} {T('sAgo')}</dd>
        <dt>{T('latency')}</dt><dd>{Math.round(s.lat)} ms</dd>
        <dt>{T('calls')}</dt><dd>{s.calls}{s.loop ? ` · loop ×${s.loopCalls}` : ''}</dd>
        <dt>{T('pending')}</dt><dd style={{ color: s.pending > 5 ? '#ff5d6c' : undefined }}>{s.pending}</dd>
        <dt>{T('tokens')}</dt>
        <dd>
          {Math.round(s.tokens / 1000)}k / {BUDGET / 1000}k
          <div className="bar"><i style={{ width: `${pct * 100}%`, background: pct > 0.9 ? '#ff5d6c' : pct > 0.7 ? '#ffa94d' : a.color }} /></div>
        </dd>
        <dt>{T('tools')}</dt><dd><div className="tags">{a.tools.map((x) => <span key={x} className="tag">{x}</span>)}</div></dd>
      </dl>
    </div>
  );
}

/* ---------------- Bitácora ---------------- */
const SEV_C = { info: '#8fa3c7', warn: '#ffc14d', crit: '#ff5d6c', audit: '#c49bff', ok: '#5fe3a1' };

export function Log({ sim }) {
  const nameOf = (id) => {
    if (id === 'human') return T('human');
    const S = sentinelById(sim, id);
    if (S) return tx(S.label);
    return AG[id] ? tx(AG[id].name) : id;
  };
  return (
    <div className="card">
      <h2>{T('log')}</h2>
      <div className="log">
        {sim.log.length === 0 && <div className="empty">{T('noEvents')}</div>}
        <AnimatePresence initial={false}>
          {sim.log.map((e) => (
            <motion.div key={e.id} className="row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <span className="t">{e.t.toFixed(1)}s</span>
              <span className="sv" style={{ background: SEV_C[e.sev] }} />
              <span className="ag">{nameOf(e.agent)}</span>
              <span>{tx(e.text)} <span className="tr">{e.trace}</span></span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
