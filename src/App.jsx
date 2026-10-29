import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FAULTS, DEFAULT_CFG } from './sim/model.js';
import { createSim, tick, triggerFault, decide, releaseHold, pingAgent, answer } from './sim/engine.js';
import { createScriptedSource } from './sim/sources.js';
import { TOUR } from './content/learn.js';
import { setLang, detectLang, tx, t as T } from './i18n.js';
import { play, unlock } from './sound.js';
import { Deck } from './components/Deck.jsx';
import { IncidentPanel, LearnCard, Inspector, Log, LabPanel, FunnelPanel } from './components/Panels.jsx';
import { Tour } from './components/Tour.jsx';
import { HowItWorks } from './components/HowItWorks.jsx';
import { Quiz } from './components/Quiz.jsx';
import { Compare } from './components/Compare.jsx';

// Modo incrustado (?embed): solo la cubierta, para un <iframe> en un blog.
const params = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const EMBED = params.has('embed');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

export default function App() {
  const [lang, setLangState] = useState(() => { const l = detectLang(store.get('sentinela-lang')); setLang(l); return l; });
  const [scenario, setScenario] = useState(() => (EMBED ? (params.get('sc') === 'gtm' ? 'gtm' : 'content') : store.get('sentinela-sc') === 'gtm' ? 'gtm' : 'content'));
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = createSim(scenario);
  const sourceRef = useRef(createScriptedSource());
  const [, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [auto, setAuto] = useState(true);
  const [teach, setTeach] = useState(false);
  const [game, setGame] = useState(false);
  const [sound, setSound] = useState(false);
  const [sel, setSel] = useState(null);
  const [tourStep, setTourStep] = useState(() => (EMBED || store.get('sentinela-tour-v3') ? null : 0));
  const R = useRef({});
  R.current = { playing, speed, auto, teach, game, sound };
  const reduce = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches).current;

  setLang(lang);
  useEffect(() => { try { document.documentElement.lang = lang; } catch { /* sin DOM */ } if (!EMBED) store.set('sentinela-lang', lang); }, [lang]);

  // Incrustado: avisa al blog la altura real para que el iframe no tenga scroll interno.
  useEffect(() => {
    if (!EMBED || window.parent === window || typeof ResizeObserver === 'undefined') return;
    let last = 0;
    const send = () => {
      const root = document.getElementById('root');
      const h = Math.ceil(root ? root.getBoundingClientRect().height : document.documentElement.scrollHeight);
      if (Math.abs(h - last) > 2) { last = h; window.parent.postMessage({ type: 'sentinela:height', height: h }, '*'); }
    };
    const ro = new ResizeObserver(send);
    ro.observe(document.getElementById('root') || document.body); send();
    return () => ro.disconnect();
  }, []);

  // Bucle de animación: avanza el motor, reproduce sonidos y redibuja.
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const o = R.current, sim = simRef.current;
      if (o.playing) tick(sim, dt * o.speed, { source: o.auto ? sourceRef.current : null, teach: o.teach, game: o.game });
      if (sim.sfx.length) { const q = sim.sfx.splice(0); if (o.sound) q.slice(-3).forEach(play); }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sim = simRef.current, t = sim.t;
  const focus = tourStep == null ? null : TOUR[tourStep].focus;
  const agents = sim.sc.agents;
  const healthy = agents.filter((a) => { const s = sim.agents[a.id]; return s.status === 'ok' && s.hbAlive; }).length;
  const mttd = sim.stats.mttd.length ? (sim.stats.mttd.reduce((x, y) => x + y, 0) / sim.stats.mttd.length).toFixed(1) + ' s' : '—';
  const inspectId = sel && sim.agents[sel] ? sel : agents[0].id;
  const faultList = [...new Set(Object.values(sim.sc.agentFaults).flat())];

  const switchScenario = (k) => {
    if (k === scenario) return;
    simRef.current = createSim(k, simRef.current);
    setScenario(k); setSel(null); if (!EMBED) store.set('sentinela-sc', k);
  };
  const goStep = (i) => {
    setTourStep(i);
    const st = TOUR[i];
    let s = simRef.current;
    if (st.sc && st.sc !== s.scKey) { switchScenario(st.sc); s = simRef.current; }
    if (i === 0 && s.scKey !== 'content') { switchScenario('content'); s = simRef.current; }
    if (st.focus === 'gate') triggerFault(s, s.scKey === 'gtm' ? 'discount' : 'injection');
    if (st.focus === 'compare' || st.focus === 'funnel') {
      try { document.getElementById(st.focus === 'compare' ? 'comparar' : 'embudo')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); } catch { /* sin DOM */ }
    }
  };
  const closeTour = () => { setTourStep(null); store.set('sentinela-tour-v3', '1'); };
  const toggleTeach = () => setTeach((v) => { if (v && !sim.hold?.game) releaseHold(sim); return !v; });
  const toggleGame = () => setGame((v) => { if (v && sim.hold?.game) releaseHold(sim); return !v; });
  const toggleSound = () => setSound((v) => { if (!v) { unlock(); setTimeout(() => play('good'), 30); } return !v; });
  const select = (id) => { setSel((s) => (s === id ? null : id)); sim.sfx.push('click'); };
  const fault = (k) => triggerFault(sim, k);
  const onOff = (v) => (v ? T('on') : T('off'));

  if (EMBED) {
    const full = `${location.origin}/#${lang}`;
    return (
      <div className="wrap embed">
        <header className="top">
          <h1>{lang === 'es' ? <>{T('title1')} <span>{T('title2')}</span></> : <><span>{T('title1')}</span> {T('title2')}</>}</h1>
          <div className="lang" role="group" aria-label="Language">
            {['es', 'en'].map((l) => (
              <button key={l} className={'btn' + (lang === l ? ' on' : '')} aria-pressed={lang === l} onClick={() => setLangState(l)}>{l.toUpperCase()}</button>
            ))}
            <a className="btn link full" href={full} target="_blank" rel="noopener">{T('fullVersion')}</a>
          </div>
        </header>
        <div className="scenarios" role="tablist">
          {[['content', 'scContent', 'scContentHint'], ['gtm', 'scGtm', 'scGtmHint']].map(([k, l, h]) => (
            <button key={k} role="tab" aria-selected={scenario === k} className={'sc-btn' + (scenario === k ? ' on' : '')} onClick={() => switchScenario(k)}>
              <b>{T(l)}</b><small>{T(h)}</small>
            </button>
          ))}
        </div>
        <div className={'deck' + (sim.hold ? ' held' : '')}>
          <Deck sim={sim} t={t} sel={sel} onSelect={select} onPing={(id) => pingAgent(sim, id)} onFault={fault} reduce={reduce} focus={null} />
        </div>
        <div className="faults">
          <span className="lbl-s">{T('inject')}</span>
          {faultList.map((k) => (
            <button key={k} className="btn fault" disabled={!!sim.active[k] || !sim.booted} onClick={() => fault(k)}>{tx(FAULTS[k].label)}</button>
          ))}
        </div>
        <IncidentPanel sim={sim} hl={null} game={false} onDecide={(c) => decide(sim, c)} />
        <div className="kpis">
          <div className="kpi"><b>{healthy}/{agents.length}</b><small>{T('healthy')}</small></div>
          <div className="kpi"><b>{sim.stats.detected}</b><small>{T('detected')}</small></div>
          <div className="kpi"><b>{sim.stats.blocked}</b><small>{T('blocked')}</small></div>
          <div className="kpi"><b>{sim.stats.escalations}</b><small>{T('escalations')}</small></div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>{lang === 'es' ? <>{T('title1')} <span>{T('title2')}</span></> : <><span>{T('title1')}</span> {T('title2')}</>}</h1>
          <p className="sub">{T('sub')}</p>
        </div>
        <div className="lang" role="group" aria-label="Language">
          {['es', 'en'].map((l) => (
            <button key={l} className={'btn' + (lang === l ? ' on' : '')} aria-pressed={lang === l} onClick={() => setLangState(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>

      <div className={'scenarios' + (focus === 'scenario' ? ' hl' : '')} role="tablist">
        {[['content', 'scContent', 'scContentHint'], ['gtm', 'scGtm', 'scGtmHint']].map(([k, l, h]) => (
          <motion.button key={k} role="tab" aria-selected={scenario === k} className={'sc-btn' + (scenario === k ? ' on' : '')} onClick={() => switchScenario(k)} whileTap={{ scale: 0.98 }}>
            <b>{T(l)}</b><small>{T(h)}</small>
          </motion.button>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi"><b>{healthy}/{agents.length}</b><small>{T('healthy')}</small></div>
        <div className="kpi"><b>{sim.stats.detected}</b><small>{T('detected')}</small></div>
        <div className="kpi"><b>{sim.stats.blocked}</b><small>{T('blocked')}</small></div>
        <div className="kpi"><b>{sim.stats.escalations}</b><small>{T('escalations')}</small></div>
        <div className="kpi"><b>{sim.stats.fp}</b><small>{T('falseAlarms')}</small></div>
        <div className="kpi"><b>{mttd}</b><small>{T('mttd')}</small></div>
        {game && (
          <motion.div className="kpi score" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <motion.b key={sim.game.score} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{sim.game.score}</motion.b><small>{T('score')}</small>
          </motion.div>
        )}
      </div>

      <div className="controls">
        <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? T('pause') : T('resume')}</button>
        {[0.5, 1, 2].map((v) => <button key={v} className={'btn' + (speed === v ? ' on' : '')} onClick={() => setSpeed(v)}>{v}×</button>)}
        <span className="sep" />
        <button className={'btn' + (game ? ' on' : '') + (focus === 'game' ? ' hl' : '')} onClick={toggleGame}>{T('game')} · {onOff(game)}</button>
        <button className={'btn learn-btn' + (teach ? ' on' : '')} onClick={toggleTeach}>{T('teach')} · {onOff(teach)}</button>
        <button className={'btn' + (auto ? ' on' : '')} onClick={() => setAuto((a) => !a)}>{T('script')} · {onOff(auto)}</button>
        <button className={'btn' + (sound ? ' on' : '')} onClick={toggleSound} aria-pressed={sound}>{T('sound')} · {onOff(sound)}</button>
        <span className="sep" />
        <button className="btn" onClick={() => goStep(0)}>{T('tour')}</button>
        <a className="btn link" href="#comparar">{T('compare')}</a>
        <a className="btn link" href="#quiz">{T('quiz')}</a>
        <a className="btn link" href="#como-funciona">{T('how')}</a>
        <button className="btn" onClick={() => { simRef.current = createSim(scenario, simRef.current); }}>{T('reset')}</button>
      </div>

      <div className="grid">
        <div className="col">
          <div className={'deck' + (sim.hold ? ' held' : '')}>
            <Deck sim={sim} t={t} sel={sel} onSelect={select} onPing={(id) => pingAgent(sim, id)} onFault={fault} reduce={reduce} focus={focus} />
          </div>
          <div className={'faults' + (focus === 'faults' ? ' hl' : '')}>
            <span className="lbl-s">{T('inject')}</span>
            {faultList.map((k) => (
              <motion.button key={k} whileTap={{ scale: 0.95 }} className="btn fault" disabled={!!sim.active[k] || !sim.booted} onClick={() => fault(k)}>
                {tx(FAULTS[k].label)}
              </motion.button>
            ))}
          </div>
          <div className="legend">
            <span><i style={{ background: '#7fa6ff' }} />{T('legMsg')}</span>
            <span><i style={{ background: '#5fd4c4', width: 6, height: 6 }} />{T('legTel')}</span>
            <span><i style={{ background: '#ff5d6c' }} />{T('legRisk')}</span>
            <span><i style={{ background: '#ffc14d', borderRadius: 1, transform: 'rotate(45deg)' }} />{T('legCtl')}</span>
            {scenario === 'gtm' && <span><i style={{ background: 'linear-gradient(90deg,#8f9bb9,#7fa6ff,#c49bff,#ffc14d,#5fe3a1)', width: 22, borderRadius: 3 }} />{T('legLead')}</span>}
            <span><i style={{ background: '#26314f', borderRadius: 2 }} />{T('legTok')}</span>
          </div>
          {scenario === 'gtm' && <div id="embudo"><FunnelPanel sim={sim} hl={focus} /></div>}
          <LabPanel sim={sim} hl={focus} onChange={(k, v) => { sim.cfg[k] = v; }} onReset={() => { Object.assign(sim.cfg, DEFAULT_CFG, { escalateAll: false }); }} />
          <Log sim={sim} />
        </div>
        <div className="col">
          <LearnCard sim={sim} teach={teach} game={game} onContinue={() => releaseHold(sim)} onAnswer={(i) => answer(sim, i)} />
          <IncidentPanel sim={sim} hl={focus} game={game} onDecide={(c) => decide(sim, c)} />
          <Inspector sim={sim} sel={inspectId} onPing={(id) => pingAgent(sim, id)} onFault={fault} />
        </div>
      </div>

      <Compare current={scenario} onSwitch={switchScenario} hl={focus} />
      <Quiz onSfx={(k) => { if (sound) play(k); }} />
      <HowItWorks />
      <Tour step={tourStep} onStep={goStep} onClose={closeTour} />
    </div>
  );
}
