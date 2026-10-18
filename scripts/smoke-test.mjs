// Pruebas rápidas sin navegador: el motor y los textos.
// Corre con `npm test`. Sale con código 1 si algo falla (lo usa la CI).
import { createSim, tick, releaseHold, answer, decide, triggerFault, incidents } from '../src/sim/engine.js';
import { createScriptedSource } from '../src/sim/sources.js';
import { SCENARIOS, FAULTS, STAGES, LADDER, DEFAULT_CFG } from '../src/sim/model.js';
import * as LEARN from '../src/content/learn.js';
import { UI } from '../src/i18n.js';

let failures = 0;
const check = (ok, msg) => { if (ok) console.log('  ✓', msg); else { failures++; console.error('  ✗', msg); } };
const DT = 0.016;

console.log('\n1) Cada falla de cada escenario se detecta y se cierra');
for (const [key, sc] of Object.entries(SCENARIOS)) {
  const faults = [...new Set(Object.values(sc.agentFaults).flat())];
  for (const type of faults) {
    const sim = createSim(key);
    for (let i = 0; i < 200; i++) tick(sim, DT, {});
    triggerFault(sim, type);
    let closed = false;
    for (let i = 0; i < 4000; i++) {
      tick(sim, DT, {});
      if (sim.approval && sim.approval.deadline != null && !sim.approval.decided) decide(sim, 'deny');
      if (!sim.active[type]) { closed = true; break; }
    }
    check(closed && sim.stats.detected === 1, `${key} · ${type}`);
  }
}

console.log('\n2) El guion completo corre sin trabarse (modo normal, Tú decides y aprendizaje)');
for (const key of Object.keys(SCENARIOS)) {
  for (const mode of ['plain', 'game', 'teach']) {
    const sim = createSim(key), src = createScriptedSource();
    for (let i = 0; i < 20000; i++) {
      if (sim.hold) {
        if (sim.hold.game && !sim.hold.answered) {
          const S = sim.sentinels.find((s) => s.id === sim.hold.sid);
          answer(sim, Math.max(...FAULTS[S.inc.type].ladder));
        }
        releaseHold(sim);
      }
      if (sim.approval && sim.approval.deadline != null && !sim.approval.decided && Math.random() < 0.02) decide(sim, 'approve');
      tick(sim, DT, { source: src, game: mode === 'game', teach: mode === 'teach' });
    }
    check(sim.stats.detected > 5 && sim.queue.length < 4, `${key} · ${mode}: ${sim.stats.detected} detectados, cola ${sim.queue.length}`);
  }
}

console.log('\n3) Lecciones que la simulación debe mostrar');
{
  const fast = createSim('content'); Object.assign(fast.cfg, { loopN: 2, budgetPct: 0.6, hbTimeout: 2 });
  const src = createScriptedSource();
  for (let i = 0; i < 20000; i++) { if (fast.hold) releaseHold(fast); tick(fast, DT, { source: src }); }
  check(fast.stats.fp > 0, `Umbrales sensibles generan falsas alarmas (${fast.stats.fp})`);

  const tired = createSim('gtm'); tired.cfg.escalateAll = true;
  const src2 = createScriptedSource();
  for (let i = 0; i < 20000; i++) { if (tired.hold) releaseHold(tired); tick(tired, DT, { source: src2 }); }
  check(tired.stats.rubber > 0, `Escalar todo provoca aprobaciones sin leer (${tired.stats.rubber})`);

  const calm = createSim('gtm'); const src3 = createScriptedSource();
  for (let i = 0; i < 20000; i++) { if (calm.hold) releaseHold(calm); tick(calm, DT, { source: src3 }); }
  check(calm.stats.rubber === 0, 'Sin escalar todo, el humano no aprueba sin leer');
  check(calm.funnel.demo > 0, `El embudo GTM llega a demo (${calm.funnel.demo})`);
}

console.log('\n4) Textos completos en español e inglés');
const missing = [];
const ALLOW_EMPTY = new Set(['UI.ago', 'HARD_COST.0']);
function walk(v, path) {
  if (!v || typeof v !== 'object' || v instanceof RegExp) return;
  if ('es' in v && 'en' in v && (typeof v.es === 'string' || typeof v.en === 'string')) {
    if (!ALLOW_EMPTY.has(path) && (!v.es || !v.en)) missing.push(path);
    return;
  }
  for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
}
walk(UI, 'UI');
for (const [k, v] of Object.entries(LEARN)) walk(v, k);
walk(STAGES, 'STAGES'); walk(LADDER, 'LADDER');
for (const [type, F] of Object.entries(FAULTS)) {
  walk(F.label, `FAULTS.${type}.label`); walk(F.act, `FAULTS.${type}.act`);
  const fake = { type, agent: F.agent || 'cod', rule: 'loop' };
  walk(F.stages(DEFAULT_CFG, fake), `FAULTS.${type}.stages`);
  check(F.stages(DEFAULT_CFG, fake).length === STAGES.length, `${type}: ${STAGES.length} etapas`);
  if (type !== 'fp') check(!!LEARN.FAULT_LEARN[type], `${type}: tiene ficha educativa`);
}
check(missing.length === 0, missing.length ? `Faltan traducciones: ${missing.join(', ')}` : 'Sin traducciones faltantes');

console.log(failures ? `\n${failures} prueba(s) fallaron\n` : '\nTodo bien ✓\n');
process.exit(failures ? 1 : 0);
