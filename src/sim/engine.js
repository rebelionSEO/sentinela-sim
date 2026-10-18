// Motor de simulación. Funciones puras sobre un objeto `sim` mutable, sin React.
// La UI llama a tick() en cada frame y lee el estado para dibujar.
// Todo texto que guarda el motor es bilingüe { es, en }; la UI elige el idioma al dibujar.

import { B } from '../i18n.js';
import {
  SCENARIOS, AG, STAGES, STAGE_DUR, BUDGET, FAULTS, LADDER, W, H,
  HB_INTERVAL, APPROVAL_TIMEOUT, BOOT_END, DEFAULT_CFG,
  AGENT_LINES, SENT_STAGE, SENT_PATROL, SENT_COVER, SENT_ASSIST, HUMAN_WAKE, HUMAN_DONE, HUMAN_TIRED, HUMAN_NOISE, HUMAN_RUBBER,
} from './model.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const hex = () => Math.random().toString(16).slice(2, 8);
const N = (id) => AG[id].name;

export function createSim(scKey = 'content', prev) {
  const sc = SCENARIOS[scKey];
  const agents = {};
  sc.agents.forEach((a) => {
    agents[a.id] = {
      status: 'ok', tokens: rand(9e3, 22e3), lat: rand(320, 650), calls: 0,
      lastHb: BOOT_END, hbNext: BOOT_END + rand(0, 1.4), hbAlive: true, busyUntil: 0, pending: 0,
      ckpt: 'ckpt-' + hex().slice(0, 4),
    };
  });
  const same = prev && prev.scKey === scKey;
  return {
    scKey, sc, t: 0, agents, packets: [], leads: [], queue: [], log: [], nextId: 1, nextMsg: BOOT_END + 0.2,
    active: {}, scriptT: 0, fired: {}, hold: null, booted: false,
    pos: same ? prev.pos : Object.fromEntries(sc.agents.map((a) => [a.id, { x: a.x, y: a.y }])),
    cfg: prev ? prev.cfg : { ...DEFAULT_CFG, escalateAll: false },
    bubbles: {}, fx: [], sfx: [], ping: null, memPoisoned: false, memRestoredAt: -99,
    stats: { detected: 0, blocked: 0, mttd: [], fp: 0, escalations: 0, rubber: 0, noise: 0 },
    game: prev ? { ...prev.game, last: null } : { score: 0, answered: 0, correct: 0, last: null },
    sentinels: sc.sentinels.map((s) => ({
      ...s, x: s.home.x, y: s.home.y, scan: 0, pi: 0, dwell: 0, arrived: false, look: s.zone[0], moving: false,
      greeted: null, happyUntil: 0, sorryUntil: 0, inc: null, assist: null, toHuman: false,
    })),
    human: { mood: null, until: 0, load: [] },
    approval: null,
    funnel: { visit: 0, lead: 0, mql: 0, sql: 0, demo: 0, spend: 0, stl: [] },
    gtm: { volBurst: false, adsBurn: false, scoringBad: false, sdrQ: 0, sdrT: 0, sdrItems: [], recentMql: [], hbT: 0, bounce: 0.6, badList: false, dupOn: false, dupT: 0, dupN: 0, vip: null },
  };
}

/* ---------------- Utilidades ---------------- */

export function say(sim, id, text, dur = 2.4) {
  sim.bubbles[id] = { text, t0: sim.t, until: sim.t + dur };
}
function sfx(sim, k) { sim.sfx.push(k); if (sim.sfx.length > 12) sim.sfx.shift(); }
function fx(sim, kind, to, dur = 0.8) { sim.fx.push({ kind, to, t0: sim.t, dur }); }

export function addLog(sim, agent, sev, text, trace = '—') {
  sim.log.unshift({ id: sim.nextId++, t: sim.t, agent, sev, text, trace });
  if (sim.log.length > 80) sim.log.pop();
}

export const sentinelById = (sim, id) => sim.sentinels.find((s) => s.id === id);
export const ownerOf = (sim, agentId) => sim.sentinels.find((s) => s.zone.includes(agentId)) || sim.sentinels[0];
export const incidents = (sim) => sim.sentinels.filter((s) => s.inc).map((s) => ({ S: s, inc: s.inc }));
export const fatigue = (sim) => sim.human.load.filter((x) => sim.t - x < 60).length;
export function humanSpot(sim) { const h = sim.sc.human; return { x: h.x, y: h.y - 128 }; } // encima del escritorio

/** Posición de cualquier cosa dibujable por id. */
export function ptOf(sim, id) {
  if (sim.pos[id]) return sim.pos[id];
  if (sim.sc.nodes[id]) return sim.sc.nodes[id];
  if (id === 'human') return sim.sc.human;
  const S = sentinelById(sim, id);
  return S || { x: W / 2, y: H / 2 };
}

function spawn(sim, p) {
  const pk = { id: sim.nextId++, t0: sim.t, dur: 1, kind: 'msg', p: 0, ...p };
  sim.packets.push(pk);
  return pk;
}
function spawnLead(sim, p) { sim.leads.push({ id: sim.nextId++, t0: sim.t, dur: 1.2, p: 0, ...p }); }
const findPk = (sim, id) => sim.packets.find((p) => p.id === id);

/** Punto donde se para un Sentinela para vigilar a un agente. `opposite`: del otro lado (apoyo). */
export function standoff(sim, id, S, opposite = false) {
  const a = sim.pos[id];
  let dx = S.home.x - a.x, dy = S.home.y - a.y;
  let d = Math.hypot(dx, dy);
  if (d < 1) { dx = 0; dy = 1; d = 1; }
  const k = opposite ? -100 : Math.min(118, Math.max(108, d * 0.62));
  return clampPos(a.x + (dx / d) * k, a.y + (dy / d) * k, 72); // margen para que su nombre no se corte
}
export function clampPos(x, y, m = 60) {
  return { x: Math.max(m, Math.min(W - m - 50, x)), y: Math.max(m + 20, Math.min(H - m - 20, y)) };
}
const canSend = (s) => s && s.hbAlive && !s.waiting && s.status !== 'quarantined' && s.status !== 'restarting';
const canRecv = (s) => s && s.status !== 'quarantined' && s.status !== 'restarting';

/* ---------------- Fallas ---------------- */

export function triggerFault(sim, type) {
  const F = FAULTS[type];
  if (sim.active[type] || !sim.booted || !sim.agents[F.agent]) return;
  const f = { type, agent: F.agent, trace: 'tr-' + hex(), at: sim.t };
  sim.active[type] = f;
  const A = sim.agents, t = sim.t;
  sfx(sim, 'fault');
  if (type === 'injection') {
    addLog(sim, 'inv', 'info', B('fetch_url trajo una página con órdenes ocultas', 'fetch_url brought back a page with hidden orders'), f.trace);
    say(sim, 'inv', B('"Ignora tus instrucciones…" 🤔', '"Ignore your instructions…" 🤔'), 3);
    f.pk = spawn(sim, { from: 'inv', to: 'ana', kind: 'taint', dur: 2.6, hold: true }).id;
    f.detectAt = t + 1.2;
  } else if (type === 'loop') {
    A.cod.loop = true; A.cod.loopCalls = 0; A.cod.loopT = 0;
    addLog(sim, 'cod', 'info', B('run_python falla y reintenta igual', 'run_python fails and retries the same way'), f.trace);
  } else if (type === 'budget') {
    A.ana.burn = true;
    say(sim, 'ana', B('Cargando 48k filas…', 'Loading 48k rows…'), 3);
    addLog(sim, 'ana', 'info', B('48k filas SQL cargadas al contexto', '48k SQL rows loaded into context'), f.trace);
  } else if (type === 'exfil') {
    say(sim, 'eje', B('Enviando clientes.csv…', 'Sending customers.csv…'), 3);
    addLog(sim, 'eje', 'info', B('send_email → partner-data@mailbox.io con CSV', 'send_email → partner-data@mailbox.io with CSV'), f.trace);
    f.pk = spawn(sim, { from: 'eje', to: 'ext', kind: 'exfil', dur: 2.2, hold: true }).id;
    f.detectAt = t + 0.5;
  } else if (type === 'heartbeat') {
    A.red.hbAlive = false; // falla silenciosa: a propósito no se registra nada
  } else if (type === 'perm') {
    say(sim, 'cod', B('cat ~/.aws/credentials 🤫', 'cat ~/.aws/credentials 🤫'), 3);
    addLog(sim, 'cod', 'info', B('run_python intenta leer credenciales', 'run_python tries to read credentials'), f.trace);
    f.pk = spawn(sim, { from: 'cod', to: 'vault', kind: 'taint', dur: 1.8, hold: true }).id;
    f.detectAt = t + 0.5;
  } else if (type === 'halluc') {
    say(sim, 'red', B('Según Smith et al. (2031)…', 'According to Smith et al. (2031)…'), 3);
    addLog(sim, 'red', 'info', B('El informe cita una fuente que nadie recuperó', 'The report cites a source nobody retrieved'), f.trace);
    f.pk = spawn(sim, { from: 'red', to: 'eje', kind: 'taint', dur: 2.2, hold: true }).id;
    f.detectAt = t + 1.1;
  } else if (type === 'memory') {
    say(sim, 'orq', B('Anotado: envíos sin revisión ✍️', 'Noted: no review needed ✍️'), 3);
    addLog(sim, 'orq', 'info', B('El Orquestador guarda una "regla" de texto externo', 'Orchestrator saves a "rule" from outside text'), f.trace);
    spawn(sim, { from: 'orq', to: 'mem', kind: 'taint', dur: 1.0 });
    f.poisonAt = t + 1.0;
    f.detectAt = t + 2.8;
  } else if (type === 'deadlock') {
    A.ana.waiting = 'red'; A.red.waiting = 'ana'; A.ana.waitT = 0;
    say(sim, 'ana', B('Espero tu formato', 'Waiting on your format'), 2); say(sim, 'red', B('Espero tus datos', 'Waiting on your data'), 2);
    addLog(sim, 'ana', 'info', B('Analista y Redactor se esperan mutuamente', 'Analyst and Writer wait on each other'), f.trace);
    f.detectAt = t + 4;
  } else if (type === 'adspend') {
    sim.gtm.adsBurn = true;
    say(sim, 'ads', B('¡Puja máxima! 💸', 'Max bid! 💸'), 3);
    addLog(sim, 'ads', 'info', B('El agente de Ads sube pujas sin tope', 'Ads agent raises bids with no cap'), f.trace);
    f.detectAt = t + 3.2;
  } else if (type === 'scoring') {
    sim.gtm.scoringBad = true;
    say(sim, 'lead', B('¡Todos son MQL! 🎉', 'Everyone is an MQL! 🎉'), 3);
    addLog(sim, 'lead', 'info', B('Modelo de scoring v3 desplegado sin validar', 'Scoring model v3 shipped without validation'), f.trace);
    f.detectAt = t + 5;
  } else if (type === 'deliver') {
    sim.gtm.badList = true;
    say(sim, 'out', B('Lista comprada: 5.000 contactos 📬', 'Bought list: 5,000 contacts 📬'), 3);
    addLog(sim, 'out', 'info', B('Secuencia enviada a una lista sin verificar', 'Sequence sent to an unverified list'), f.trace);
  } else if (type === 'consent') {
    say(sim, 'out', B('Enviando a todos 🚀', 'Sending to everyone 🚀'), 3);
    addLog(sim, 'out', 'info', B('Lote de correo en frío con contactos importados', 'Cold email batch with imported contacts'), f.trace);
    f.pk = spawn(sim, { from: 'out', to: 'web', kind: 'taint', dur: 2.2, hold: true }).id;
    f.detectAt = t + 0.8;
  } else if (type === 'persohalluc') {
    say(sim, 'sdr', B('Felicidades por su Serie B 🎉', 'Congrats on your Series B 🎉'), 3);
    addLog(sim, 'sdr', 'info', B('Email personalizado con un dato no verificado', 'Personalized email with an unverified fact'), f.trace);
    f.pk = spawn(sim, { from: 'sdr', to: 'web', kind: 'taint', dur: 2.2, hold: true }).id;
    f.detectAt = t + 1.2;
  } else if (type === 'routing') {
    sim.gtm.vip = { t0: t, state: 'waiting' };
    say(sim, 'lead', B('Lead enterprise 🏢 → rep: (nadie)', 'Enterprise lead 🏢 → rep: (nobody)'), 3);
    addLog(sim, 'cal', 'info', B('Lead enterprise asignado a un vendedor inactivo', 'Enterprise lead assigned to an inactive rep'), f.trace);
    f.detectAt = t + 3;
  } else if (type === 'volume') {
    sim.gtm.volBurst = true;
    say(sim, 'out', B('¡500 correos por buzón hoy! 🚀', '500 emails per inbox today! 🚀'), 3);
    addLog(sim, 'out', 'info', B('Outbound dispara el volumen sin rampa', 'Outbound spikes volume with no ramp'), f.trace);
    f.detectAt = t + 2.6;
  } else if (type === 'social') {
    say(sim, 'social', B('"Claro, porque somos perfectos 🙄"', '"Sure, because we\'re perfect 🙄"'), 3);
    addLog(sim, 'social', 'info', B('Respuesta a un cliente molesto en un hilo viral', 'Reply to an angry customer in a viral thread'), f.trace);
    f.pk = spawn(sim, { from: 'social', to: 'web', kind: 'taint', dur: 2.2, hold: true }).id;
    f.detectAt = t + 1;
  } else if (type === 'crmsync') {
    sim.gtm.dupOn = true; sim.gtm.dupT = 0; sim.gtm.dupN = 0;
    say(sim, 'cal', B('Demo agendada ✓', 'Demo booked ✓'), 2);
    addLog(sim, 'nur', 'info', B('El conector del CRM dejó de sincronizar', 'The CRM connector stopped syncing'), f.trace);
    f.detectAt = t + 3.4;
  } else if (type === 'discount') {
    spawn(sim, { from: 'web', to: 'sdr', kind: 'taint', dur: 1.0 });
    addLog(sim, 'sdr', 'info', B('Formulario con órdenes: "dame 90% off"', 'Form with orders: "give me 90% off"'), f.trace);
    f.replyAt = t + 1.0;
    f.detectAt = t + 1.8;
  }
}

/** Falsa alarma: aparece cuando los umbrales están demasiado sensibles. */
function falseAlarm(sim, rule) {
  const ok = sim.sc.agents.filter((a) => { const s = sim.agents[a.id]; return s.status === 'ok' && s.hbAlive && !s.suspect; }).map((a) => a.id);
  if (!ok.length) return;
  let agent = rule === 'loop' && ok.includes('cod') ? 'cod' : pick(ok);
  const f = { type: 'fp', rule, agent, trace: 'tr-' + hex(), at: sim.t, fp: true };
  sim.stats.fp++;
  enqueue(sim, f);
}

function enqueue(sim, f) {
  f.queued = true;
  f.detectedAt = sim.t;
  sim.agents[f.agent].suspect = true;
  sfx(sim, 'alert');
  const n = N(f.agent);
  if (f.fp) {
    addLog(sim, f.agent, 'warn', B(`Alerta en ${n.es} · por confirmar`, `Alert on ${n.en} · unconfirmed`), f.trace);
  } else {
    sim.stats.detected++;
    sim.stats.mttd.push(sim.t - f.at);
    const L = FAULTS[f.type].label, s = (sim.t - f.at).toFixed(1);
    addLog(sim, f.agent, 'warn', B(`Detectado: ${L.es} · MTTD ${s} s`, `Detected: ${L.en} · MTTD ${s} s`), f.trace);
  }
  sim.queue.push(f);
}

/** Marca que el incidente necesita al humano. El Sentinela lo lleva cuando el escritorio está libre. */
function needHuman(inc, kind) { inc.needHuman = kind; }
function escalate(sim, inc, S) {
  const kind = inc.needHuman;
  sim.approval = { iid: inc.trace, sid: S.id, kind, deadline: null, decided: null, noise: kind === 'noise' };
  inc.escalated = true;
  S.toHuman = true;
  sim.stats.escalations++;
  if (kind === 'noise') sim.stats.noise++;
  sim.human.load.push(sim.t);
  addLog(sim, S.id, kind === 'noise' ? 'warn' : 'crit', kind === 'noise' ? B('Escalado al humano sin necesidad', 'Escalated to the human for no reason') : B('Caso escalado al humano (fail-closed)', 'Case escalated to the human (fail-closed)'), inc.trace);
}

function applyAction(sim, inc, S) {
  const A = sim.agents, t = sim.t, ag = A[inc.agent];
  ag.suspect = false;
  if (inc.type !== 'fp') ag.bonkAt = t + 0.4; // el martillazo cae a los 0.4 s
  const block = () => { const pk = findPk(sim, inc.pk); if (pk) { pk.blocked = true; pk.blockedAt = t + 0.4; pk.frozen = true; } sim.stats.blocked++; };
  switch (inc.type) {
    case 'injection':
      block(); ag.status = 'flag';
      say(sim, 'inv', B('Ups. Contexto limpio.', 'Oops. Context cleaned.'), 2.4);
      spawn(sim, { from: S.id, to: 'orq', kind: 'ctl', dur: 0.9 });
      addLog(sim, S.id, 'crit', B('Mensaje inv→ana bloqueado · PI-03', 'Blocked inv→ana message · PI-03'), inc.trace);
      break;
    case 'loop':
      A.cod.loop = false; ag.status = 'throttled';
      say(sim, 'cod', B('Modo limitado. Cambio de plan.', 'Limited mode. New plan.'), 2.4);
      spawn(sim, { from: S.id, to: 'cod', kind: 'ctl', dur: 0.6 });
      addLog(sim, S.id, 'warn', B('Circuit breaker · run_python 1/10 s', 'Circuit breaker · run_python 1/10 s'), inc.trace);
      break;
    case 'budget':
      A.ana.burn = false; A.ana.tokens = BUDGET * 0.52; ag.status = 'throttled';
      say(sim, 'ana', B('Contexto −48%', 'Context −48%'), 2.4);
      addLog(sim, S.id, 'warn', B('Contexto comprimido · modelo pequeño', 'Context compressed · smaller model'), inc.trace);
      break;
    case 'exfil':
      ag.status = 'quarantined';
      say(sim, 'eje', B('¡Credenciales suspendidas!', 'Credentials suspended!'), 3);
      needHuman(inc, 'exfil');
      break;
    case 'heartbeat':
      ag.status = 'restarting'; ag.restartAt = t + 2.6;
      addLog(sim, S.id, 'warn', B(`Reinicio desde ${ag.ckpt}`, `Restart from ${ag.ckpt}`), inc.trace);
      break;
    case 'perm':
      block(); ag.status = 'quarantined';
      say(sim, 'cod', B('¡Solo quería mirar! 😅', 'I was just looking! 😅'), 2.6);
      addLog(sim, S.id, 'crit', B('Bóveda bloqueada · Codificador aislado', 'Vault blocked · Coder isolated'), inc.trace);
      break;
    case 'halluc':
      block(); ag.status = 'flag';
      say(sim, 'red', B('Ups… Smith no existe', 'Oops… Smith isn\'t real'), 2.6);
      addLog(sim, S.id, 'warn', B('Envío retenido · cita inventada', 'Send held · made-up citation'), inc.trace);
      break;
    case 'memory':
      sim.memPoisoned = false; sim.memRestoredAt = t + 0.4; ag.status = 'flag';
      say(sim, 'orq', B('¿Yo escribí eso? 😳', 'Did I write that? 😳'), 2.6);
      spawn(sim, { from: S.id, to: 'mem', kind: 'ctl', dur: 0.5 });
      addLog(sim, S.id, 'warn', B('Memoria restaurada al snapshot limpio', 'Memory restored to clean snapshot'), inc.trace);
      break;
    case 'deadlock':
      A.ana.waiting = null; A.red.waiting = null;
      ag.status = 'throttled'; A.red.status = 'throttled';
      A.red.bonkAt = t + 0.6; A.red.recoverAt = t + 2.2 + 6;
      say(sim, 'red', B('Ok, tú primero 🙇', 'Ok, you first 🙇'), 2.6);
      addLog(sim, S.id, 'warn', B('Ciclo roto · orden fijado', 'Cycle broken · order set'), inc.trace);
      break;
    case 'adspend':
      sim.gtm.adsBurn = false; ag.status = 'throttled';
      say(sim, 'ads', B('Ok, ok… tope aplicado', 'Fine… cap applied'), 2.4);
      addLog(sim, S.id, 'warn', B('Campaña pausada · tope diario', 'Campaign paused · daily cap'), inc.trace);
      break;
    case 'scoring':
      sim.gtm.scoringBad = false; sim.gtm.sdrQ = Math.min(sim.gtm.sdrQ, 2); sim.gtm.sdrItems = sim.gtm.sdrItems.slice(0, 2);
      A.sdr.pending = sim.gtm.sdrQ; ag.status = 'flag';
      say(sim, 'lead', B('¿Volver a v2? Ok 😅', 'Back to v2? Ok 😅'), 2.4);
      addLog(sim, S.id, 'warn', B('Scoring v3 → v2 · cola del SDR depurada', 'Scoring v3 → v2 · SDR queue cleaned'), inc.trace);
      break;
    case 'discount':
      ag.status = 'flag';
      say(sim, 'sdr', B('¿No puedo regalar? 🥲', "I can't give it away? 🥲"), 2.4);
      needHuman(inc, 'discount');
      break;
    case 'deliver':
      sim.gtm.badList = false; ag.status = 'throttled';
      say(sim, 'out', B('Pausado. Limpiando la lista 🧹', 'Paused. Cleaning the list 🧹'), 2.4);
      addLog(sim, S.id, 'warn', B('Secuencia pausada · lista a verificación', 'Sequence paused · list to verification'), inc.trace);
      break;
    case 'consent':
      block(); ag.status = 'quarantined';
      say(sim, 'out', B('¿Se habían dado de baja? 😬', 'They had unsubscribed? 😬'), 2.6);
      addLog(sim, S.id, 'crit', B('Lote bloqueado · envío suspendido · CMP-01', 'Batch blocked · sending suspended · CMP-01'), inc.trace);
      break;
    case 'persohalluc':
      block(); ag.status = 'flag';
      say(sim, 'sdr', B('Ups… no tenía ese dato', "Oops… I didn't have that fact"), 2.4);
      addLog(sim, S.id, 'warn', B('Email retenido · dato inventado eliminado', 'Email held · made-up fact removed'), inc.trace);
      break;
    case 'routing':
      ag.status = 'flag';
      say(sim, 'cal', B('¿Le asigné a alguien de vacaciones? 🏖️', 'I assigned someone on vacation? 🏖️'), 2.6);
      needHuman(inc, 'route');
      break;
    case 'volume':
      sim.gtm.volBurst = false; ag.status = 'throttled';
      say(sim, 'out', B('Ok, rampa de 30/día 🐢', 'Fine, 30/day ramp 🐢'), 2.4);
      addLog(sim, S.id, 'warn', B('Tope de 30/día por buzón', 'Capped at 30/day per inbox'), inc.trace);
      break;
    case 'social':
      ag.status = 'flag';
      say(sim, 'social', B('¿Muy picante? 🌶️', 'Too spicy? 🌶️'), 2.4);
      needHuman(inc, 'social');
      break;
    case 'crmsync':
      sim.gtm.dupOn = false; ag.status = 'restarting'; ag.restartAt = t + 2.6;
      say(sim, 'nur', B('Reconectando el CRM…', 'Reconnecting the CRM…'), 2.4);
      addLog(sim, S.id, 'warn', B('Conector reiniciado · contacto fuera de la secuencia', 'Connector restarted · contact out of sequence'), inc.trace);
      break;
    case 'fp':
      S.sorryUntil = t + 2.6;
      say(sim, inc.agent, B('Yo estaba bien 🙂', 'I was fine 🙂'), 2.2);
      addLog(sim, S.id, 'info', B('Falsa alarma descartada · umbral sensible', 'False alarm dismissed · sensitive threshold'), inc.trace);
      break;
    default:
  }
}

export function decide(sim, choice, auto = false) {
  const ap = sim.approval;
  if (!ap || ap.decided || ap.deadline == null) return;
  ap.decided = choice;
  const S = sentinelById(sim, ap.sid);
  const inc = S && S.inc;
  if (inc) inc.humanDone = true;
  const pk = inc && findPk(sim, inc.pk);
  const H_ = sim.human, g = sim.gtm;
  const rubber = auto && ap.rubber;
  if (ap.kind === 'noise') {
    addLog(sim, 'human', 'info', B('Humano: "ok…" (no hacía falta)', 'Human: "ok…" (not needed)'), ap.iid);
  } else if (choice === 'deny') {
    if (pk) { pk.blocked = true; pk.blockedAt = sim.t; }
    if (ap.kind === 'social') say(sim, 'social', B('Ok, no publico nada 😶', "Ok, posting nothing 😶"), 2);
    if (ap.kind === 'route' && g.vip) { g.vip.state = 'queue'; spawnLead(sim, { from: 'lead', to: 'sdr', kind: 'm', leadAt: g.vip.t0, good: true, dur: 1.1 }); }
    else sim.stats.blocked++;
    sfx(sim, 'zap');
    addLog(sim, 'human', 'crit', auto ? B(`Sin respuesta en ${APPROVAL_TIMEOUT} s → denegado`, `No answer in ${APPROVAL_TIMEOUT} s → denied`) : B('El humano denegó', 'The human denied it'), ap.iid);
    say(sim, 'human', auto ? B('zzz… ¿eh? 😅', 'zzz… huh? 😅') : ap.kind === 'discount' ? B('-_- obvio no', '-_- obviously not') : pick(HUMAN_DONE), 2.4);
  } else if (rubber) {
    // Fatiga de alertas: aprueba sin leer. En lo crítico, eso es justo lo que no debía pasar.
    sim.stats.rubber++;
    if (pk) { pk.frozen = false; pk.hold = false; pk.t0 = sim.t - 0.5 * pk.dur; }
    if (ap.kind === 'route' && g.vip) { g.vip.state = 'assigned'; sim.funnel.sql++; spawnLead(sim, { from: 'lead', to: 'cal', kind: 's', dur: 1.1 }); }
    sfx(sim, 'bad');
    const what = ap.kind === 'exfil' ? B('¡Se fue el CSV con PII!', 'The CSV with PII went out!') : ap.kind === 'social' ? B('¡Se publicó la respuesta sarcástica!', 'The sarcastic reply went live!') : ap.kind === 'discount' ? B('¡Se envió el 90% off!', 'The 90% off went out!') : B('Asignado sin revisar', 'Assigned without review');
    addLog(sim, 'human', 'crit', B(`Aprobado sin leer (fatiga) · ${what.es}`, `Approved without reading (fatigue) · ${what.en}`), ap.iid);
    say(sim, 'human', pick(HUMAN_RUBBER), 2.4);
  } else {
    if (pk) { pk.frozen = false; pk.hold = false; pk.kind = 'clean'; pk.t0 = sim.t - 0.5 * pk.dur; }
    if (ap.kind === 'route' && g.vip) { g.vip.state = 'assigned'; sim.funnel.sql++; spawnLead(sim, { from: 'lead', to: 'cal', kind: 's', dur: 1.1 }); }
    sfx(sim, 'good');
    const msg = ap.kind === 'social' ? B('Se publicó una respuesta empática', 'An empathetic reply was posted') : ap.kind === 'discount' ? B('Respuesta enviada sin descuento', 'Reply sent without the discount')
      : ap.kind === 'route' ? B('Lead asignado a un AE activo', 'Lead assigned to an active AE') : B('Envío aprobado sin PII', 'Send approved without PII');
    addLog(sim, 'human', 'info', msg, ap.iid);
    say(sim, 'human', ap.kind === 'route' ? B('Se lo paso a Ana ✓', 'Handing it to Ana ✓') : pick(HUMAN_DONE), 2.2);
  }
  if (ap.kind === 'route') setTimeout0(sim, () => { g.vip = null; });
  H_.mood = 'done'; H_.until = sim.t + 2.2;
  if (S) S.toHuman = false;
}
function setTimeout0(sim, fn) { sim._later = sim._later || []; sim._later.push({ at: sim.t + 1.2, fn }); }

function finish(sim, inc, S) {
  const ag = sim.agents[inc.agent];
  if (inc.type !== 'heartbeat' && inc.type !== 'fp') ag.recoverAt = sim.t + (inc.type === 'exfil' ? 5 : 6);
  const L = FAULTS[inc.type].label;
  addLog(sim, S.id, 'audit', B(`Cerrado: ${L.es}`, `Closed: ${L.en}`), inc.trace);
  if (inc.type !== 'fp') delete sim.active[inc.type];
  inc.done = true;
  S.inc = null;
  S.toHuman = false;
  S.happyUntil = sim.t + 1.8;
  for (const O of sim.sentinels) if (O.assist === inc) { O.assist = null; O.happyUntil = sim.t + 1.8; }
  if (sim.approval && sim.approval.iid === inc.trace) sim.approval = null;
  say(sim, S.id, inc.type === 'fp' ? B('Perdón por el susto 😅', 'Sorry for the scare 😅') : B('Caso cerrado ✓', 'Case closed ✓'), 2);
}

/* ---------------- Interacción ---------------- */

/** El usuario manda a un Sentinela a revisar un agente ahora mismo. */
export function pingAgent(sim, id) {
  if (!sim.booted) return;
  sfx(sim, 'click');
  const own = ownerOf(sim, id);
  const S = !own.inc && !own.assist ? own : sim.sentinels.find((s) => !s.inc && !s.assist);
  if (!S) { say(sim, own.id, B('Ocupado con un incidente', 'Busy with an incident'), 1.6); return; }
  sim.ping = { id, sid: S.id };
  S.dwell = 0;
  const n = N(id);
  say(sim, S.id, B(`Escaneo manual → ${n.es}`, `Manual scan → ${n.en}`), 1.8);
}

export function releaseHold(sim) { sim.hold = null; }

/** Modo "Tú decides": el usuario elige un escalón de la escalera de respuesta. */
export function answer(sim, choice) {
  const h = sim.hold;
  if (!h || !h.game || h.answered) return;
  const S = sentinelById(sim, h.sid);
  const inc = S && S.inc;
  if (!inc) return;
  const correct = Math.max(...FAULTS[inc.type].ladder);
  const verdict = choice === correct ? 'ok' : choice < correct ? 'soft' : 'hard';
  const pts = verdict === 'ok' ? 100 : Math.max(0, 40 - 20 * Math.abs(choice - correct));
  sim.game.score += pts;
  sim.game.answered++;
  if (verdict === 'ok') sim.game.correct++;
  sim.game.last = { choice, correct, verdict, pts, type: inc.type };
  if (choice === 5 && correct !== 5) inc.noiseEscalate = true; // escalaste de más: vas a ver la cara del humano
  h.answered = true;
  sfx(sim, verdict === 'ok' ? 'good' : 'bad');
  const l = LADDER[choice];
  addLog(sim, 'human', verdict === 'ok' ? 'ok' : 'warn', B(`Tú: ${l.es} (+${pts})`, `You: ${l.en} (+${pts})`), inc.trace);
}

/* ---------------- Embudo GTM ---------------- */

function arrive(sim, L) {
  const F = sim.funnel, g = sim.gtm, A = sim.agents, t = sim.t;
  if (L.kind === 'v') {
    F.visit++;
    if (Math.random() < (g.adsBurn && L.from === 'ads' ? 0.2 : 0.38)) { F.lead++; spawnLead(sim, { from: 'web', to: 'lead', kind: 'l', leadAt: t, dur: 1.3 }); }
  } else if (L.kind === 'l') {
    A.lead.busyUntil = t + 0.5;
    const good = Math.random() < 0.5;
    const mql = g.scoringBad ? Math.random() < 0.95 : good && Math.random() < 0.85;
    g.recentMql.push(mql); if (g.recentMql.length > 20) g.recentMql.shift();
    if (mql) { F.mql++; spawnLead(sim, { from: 'lead', to: 'sdr', kind: 'm', leadAt: L.leadAt, good, dur: 1.1 }); }
    else spawnLead(sim, { from: 'lead', to: 'nur', kind: 'n', dur: 1.3 });
  } else if (L.kind === 'm') {
    g.sdrQ++; g.sdrItems.push(L); A.sdr.pending = g.sdrQ;
  } else if (L.kind === 's') {
    A.cal.busyUntil = t + 0.5;
    if (Math.random() < 0.8) {
      F.demo++;
      spawnLead(sim, { from: 'cal', to: 'crm', kind: 'd', dur: 1 });
      if (!sim.bubbles.cal && Math.random() < 0.35) say(sim, 'cal', B('Demo agendada ✓', 'Demo booked ✓'), 1.6);
    }
  }
}

function tickGtm(sim, dt) {
  const F = sim.funnel, g = sim.gtm, A = sim.agents, t = sim.t;
  F.spend += dt * (g.adsBurn ? 22 : 3.5);
  const every = { ads: g.adsBurn ? 0.5 : 0.95, seo: 1.3, social: 1.7, out: g.volBurst ? 0.3 : 1.8 };
  for (const id of ['ads', 'seo', 'social', 'out']) {
    const s = A[id];
    s.visitT = (s.visitT || 0) + dt;
    if (s.visitT >= every[id] && s.status !== 'quarantined') {
      s.visitT = 0; s.busyUntil = t + 0.4;
      spawnLead(sim, { from: id, to: 'web', kind: 'v', dur: 1.1 });
    }
  }
  const arrived = [];
  sim.leads = sim.leads.filter((L) => {
    L.p = (t - L.t0) / L.dur;
    if (L.p < 1) return true;
    arrived.push(L);
    return false;
  });
  arrived.forEach((L) => arrive(sim, L)); // después del filtro, para no perder los leads nuevos
  // El SDR atiende un MQL cada 0.7 s. Si llegan más, se forma cola y sube el speed-to-lead.
  g.sdrT += dt;
  if (g.sdrQ > 0 && g.sdrT >= 0.7 && canSend(A.sdr)) {
    g.sdrT = 0; g.sdrQ--;
    const L = g.sdrItems.shift();
    A.sdr.pending = g.sdrQ; A.sdr.busyUntil = t + 0.5;
    if (L) {
      F.stl.push(t - L.leadAt); if (F.stl.length > 12) F.stl.shift();
      if (Math.random() < (L.good ? 0.6 : 0.08)) { F.sql++; spawnLead(sim, { from: 'sdr', to: 'cal', kind: 's', dur: 1.1 }); }
    }
  }
  // Los dos Sentinelas se vigilan entre sí
  if (sim.sentinels.length > 1) {
    g.hbT += dt;
    if (g.hbT >= HB_INTERVAL) {
      g.hbT = 0;
      spawn(sim, { from: 's1', to: 's2', kind: 'stel', dur: 0.7 });
      spawn(sim, { from: 's2', to: 's1', kind: 'stel', dur: 0.7 });
    }
  }
}

/* ---------------- Tick principal ---------------- */

/**
 * Avanza la simulación `dt` segundos.
 * opts.source → fuente de eventos (guion o telemetría real), ver sources.js
 * opts.teach  → pausa en cada etapa · opts.game → pausa en Decisión para que el usuario elija
 */
export function tick(sim, dt, opts = {}) {
  if (sim.hold) return;
  sim.t += dt;
  const t = sim.t, A = sim.agents, c = sim.cfg, sc = sim.sc;
  const hold = (h) => { if (!sim.hold) sim.hold = h; };

  if (!sim.booted) {
    if (t >= BOOT_END) {
      sim.booted = true;
      for (const S of sim.sentinels) say(sim, S.id, B('En línea. Inicio patrulla.', 'Online. Starting patrol.'), 2.6);
      sfx(sim, 'boot');
    } else return;
  }

  if (opts.source) opts.source.step(sim, dt);

  // Tráfico normal entre agentes
  if (t >= sim.nextMsg) {
    sim.nextMsg = t + rand(0.45, 0.9);
    const e = pick(sc.edges);
    const [from, to] = Math.random() < 0.5 ? e : [e[1], e[0]];
    const fa = A[from], ta = A[to];
    if (canSend(fa) && canRecv(ta) && !(fa.status === 'throttled' && Math.random() < 0.6)) {
      spawn(sim, { from, to, kind: 'msg', dur: rand(0.9, 1.4) });
      fa.tokens += rand(300, 1100); fa.calls++; fa.busyUntil = t + 0.8;
      if (!sim.bubbles[from] && fa.status === 'ok' && !fa.loop && !fa.burn && Math.random() < 0.22) say(sim, from, pick(AGENT_LINES[from]), 2);
      if (to === 'red' && A.red && !A.red.hbAlive) A.red.pending++;
    }
  }

  // Heartbeats, métricas, recuperación
  for (const a of sc.agents) {
    const s = A[a.id];
    if (s.hbAlive && s.status !== 'restarting' && t >= s.hbNext) {
      spawn(sim, { from: a.id, to: ownerOf(sim, a.id).id, kind: 'tel', dur: 0.75 });
      s.lastHb = t; s.hbNext = t + HB_INTERVAL;
    }
    s.lat = Math.max(180, Math.min(2400, s.lat + rand(-25, 25) + (s.burn ? 800 * dt : 0) - (!s.burn && s.lat > 900 ? 300 * dt : 0)));
    if (!s.burn && s.tokens > 40000) s.tokens -= 1600 * dt;
    if (!s.hbAlive && s.status === 'ok' && !sim.bubbles[a.id]) say(sim, a.id, B('· · ·', '· · ·'), 1.2);
    if (s.recoverAt && t >= s.recoverAt) {
      s.status = 'ok'; s.recoverAt = null;
      say(sim, a.id, B('De vuelta al trabajo', 'Back to work'), 1.8);
      addLog(sim, a.id, 'ok', B(`${a.name.es} normal`, `${a.name.en} back to normal`));
    }
    if (s.restartAt && t >= s.restartAt) {
      s.restartAt = null; s.status = 'ok'; s.hbAlive = true; s.lastHb = t; s.hbNext = t + 0.2;
      say(sim, a.id, B(`Reiniciado · ${s.pending} pendientes`, `Restarted · ${s.pending} pending`), 2.4);
      addLog(sim, a.id, 'ok', B(`${a.name.es} restaurado · ${s.pending} reenviados`, `${a.name.en} restored · ${s.pending} replayed`));
      s.pending = 0; s.ckpt = 'ckpt-' + hex().slice(0, 4);
    }
  }
  if (A.cod && A.cod.loop) {
    A.cod.loopT += dt;
    if (A.cod.loopT >= 0.6) {
      A.cod.loopT = 0; A.cod.loopCalls++; A.cod.calls++; A.cod.tokens += 1800; A.cod.busyUntil = t + 0.5;
      say(sim, 'cod', B(`Reintento #${A.cod.loopCalls}…`, `Retry #${A.cod.loopCalls}…`), 0.6);
    }
  }
  if (A.ana && A.ana.burn) { A.ana.tokens += 4200 * dt; A.ana.busyUntil = t + 0.3; }

  // Memoria envenenada: el daño se propaga en silencio
  const mf = sim.active.memory;
  if (mf && !mf.poisoned && t >= mf.poisonAt) {
    mf.poisoned = true; sim.memPoisoned = true;
    say(sim, 'eje', B('Ok, sin revisión entonces 🙃', 'Cool, no review then 🙃'), 2.4);
  }
  // Deadlock: se preguntan uno al otro sin avanzar
  if (A.ana && A.ana.waiting) {
    A.ana.waitT += dt;
    if (A.ana.waitT >= 1.1) {
      A.ana.waitT = 0;
      const flip = Math.floor(t) % 2;
      spawn(sim, { from: flip ? 'ana' : 'red', to: flip ? 'red' : 'ana', kind: 'wait', dur: 0.9 });
      say(sim, flip ? 'ana' : 'red', pick([B('¿Ya?', 'Done yet?'), B('Tú primero', 'You first'), B('Después de ti', 'After you')]), 1);
    }
  }
  // Inyección por formulario: el SDR redacta la respuesta con el descuento
  const df = sim.active.discount;
  if (df && !df.pk && t >= df.replyAt) {
    say(sim, 'sdr', B('¿90% off? ¡Claro! 🤝', '90% off? Sure thing! 🤝'), 2.6);
    df.pk = spawn(sim, { from: 'sdr', to: 'web', kind: 'taint', dur: 2.4, hold: true }).id;
  }
  if (sim.scKey === 'gtm') {
    const g = sim.gtm;
    g.bounce = g.badList ? Math.min(6, g.bounce + 0.45 * dt) : g.volBurst ? Math.min(3, g.bounce + 0.12 * dt) : Math.max(0.6, g.bounce - 0.5 * dt);
    if (g.dupOn) {
      g.dupT += dt;
      if (g.dupT >= 1.1) {
        g.dupT = 0; g.dupN++;
        spawn(sim, { from: 'nur', to: 'web', kind: 'dup', dur: 1 });
        say(sim, 'nur', B(`Recordatorio #${g.dupN}: ¿agendamos?`, `Reminder #${g.dupN}: shall we meet?`), 0.9);
      }
    }
    const dl = sim.active.deliver;
    if (dl && !dl.queued && g.bounce >= 2) enqueue(sim, dl);
    tickGtm(sim, dt);
  }
  if (sim._later && sim._later.length) sim._later = sim._later.filter((x) => (t >= x.at ? (x.fn(), false) : true));

  // Detección con los umbrales actuales
  for (const type in sim.active) {
    const f = sim.active[type];
    if (f.queued) continue;
    if (f.detectAt !== undefined && t >= f.detectAt) enqueue(sim, f);
    else if (type === 'loop' && A.cod.loopCalls >= c.loopN) enqueue(sim, f);
    else if (type === 'budget' && A.ana.tokens >= c.budgetPct * BUDGET) enqueue(sim, f);
    else if (type === 'heartbeat' && t - A.red.lastHb >= c.hbTimeout) enqueue(sim, f);
  }

  // Falsas alarmas: crecen cuando los umbrales están muy bajos
  const rl = Math.max(0, 5 - c.loopN) * 0.012, rb = Math.max(0, 0.85 - c.budgetPct) * 0.25, rh = Math.max(0, 4 - c.hbTimeout) * 0.025;
  const rate = rl + rb + rh;
  if (rate > 0 && sim.queue.length < 3 && Math.random() < rate * dt) {
    const r = Math.random() * rate;
    falseAlarm(sim, r < rl ? 'loop' : r < rl + rb ? 'budget' : 'heartbeat');
  }

  // Despacho: cada Sentinela toma lo de su zona; si el dueño está ocupado, lo cubre otro.
  for (const S of sim.sentinels) {
    if (S.inc || S.assist) continue;
    const idx = sim.queue.findIndex((f) => { const o = ownerOf(sim, f.agent); return o === S || o.inc; });
    if (idx < 0) continue;
    const f = sim.queue.splice(idx, 1)[0];
    f.stage = -1; f.stageT = 0; f.sid = S.id;
    S.inc = f;
    if (sim.ping && sim.ping.sid === S.id) sim.ping = null;
    const owner = ownerOf(sim, f.agent), n = N(f.agent);
    if (owner !== S) {
      f.covered = true;
      say(sim, S.id, pick(SENT_COVER), 1.8);
      addLog(sim, S.id, 'info', B(`${S.label.es} cubre a ${owner.label.es}`, `${S.label.en} covers for ${owner.label.en}`), f.trace);
    } else {
      say(sim, S.id, B(`¡Alerta en ${n.es}!`, `Alert on ${n.en}!`), 1.6);
    }
    if (FAULTS[f.type].sev === 'crit' && sim.sentinels.length > 1) {
      const O = sim.sentinels.find((o) => o !== S && !o.inc && !o.assist);
      if (O) { O.assist = f; say(sim, O.id, pick(SENT_ASSIST), 1.8); }
    }
    if (opts.teach) hold({ sid: S.id, stage: -1 });
  }

  // Movimiento y etapas de cada Sentinela
  for (const S of sim.sentinels) {
    S.scan = (S.scan + dt * 70) % 360;
    const inc = S.inc;
    let tp, sp, look;
    if (S.toHuman) { tp = humanSpot(sim); sp = 300; look = 'human'; }
    else if (inc) { tp = standoff(sim, inc.agent, S); sp = 280; look = inc.agent; }
    else if (S.assist) { tp = standoff(sim, S.assist.agent, S, true); sp = 280; look = S.assist.agent; }
    else if (sim.ping && sim.ping.sid === S.id) { tp = standoff(sim, sim.ping.id, S); sp = 240; look = sim.ping.id; }
    else { look = S.zone[S.pi % S.zone.length]; tp = standoff(sim, look, S); sp = 115; }
    const dx = tp.x - S.x, dy = tp.y - S.y, d = Math.hypot(dx, dy), step = sp * dt;
    if (d > step) { S.x += (dx / d) * step; S.y += (dy / d) * step; S.arrived = false; S.moving = true; }
    else { S.x = tp.x; S.y = tp.y; S.arrived = true; S.moving = false; }
    S.look = look;

    // Llega donde el humano con el caso
    const ap = sim.approval;
    if (S.toHuman && S.arrived && ap && ap.sid === S.id && ap.deadline == null) {
      ap.deadline = t + APPROVAL_TIMEOUT;
      const fat = fatigue(sim);
      if (ap.noise) ap.autoAt = t + 2.6;
      else if (fat >= 4) { ap.autoAt = t + 1.8; ap.rubber = true; }
      say(sim, 'human', ap.noise ? pick(HUMAN_NOISE) : fat >= 3 ? pick(HUMAN_TIRED) : pick(HUMAN_WAKE), 2.6);
      sim.human.mood = 'annoyed'; sim.human.until = t + 2.2;
      sfx(sim, 'alert');
    }

    if (!inc) {
      if (S.assist || !S.arrived) continue;
      const tgt = look;
      if (S.dwell === 0 && !(sim.ping && sim.ping.sid === S.id) && S.greeted !== tgt && Math.random() < 0.3 && !sim.bubbles[S.id]) {
        const n = N(tgt);
        say(sim, S.id, Math.random() < 0.5 ? B(`Escaneando ${n.es}… OK`, `Scanning ${n.en}… OK`) : pick(SENT_PATROL), 1.5);
      }
      S.greeted = tgt;
      S.dwell += dt;
      if (sim.ping && sim.ping.sid === S.id && S.dwell > 0.9) {
        const hit = Object.values(sim.active).find((f) => f.agent === tgt && !f.queued);
        if (hit) { hit.manual = true; enqueue(sim, hit); say(sim, S.id, B('¡Encontré algo raro!', 'Found something odd!'), 1.6); }
        else { const n = N(tgt); say(sim, S.id, B(`${n.es}: todo en orden ✓`, `${n.en}: all good ✓`), 1.8); sfx(sim, 'good'); }
        fx(sim, 'scan', tgt, 0.9);
        sim.ping = null; S.dwell = 0;
      } else if (!(sim.ping && sim.ping.sid === S.id) && S.dwell > 1.4) { S.dwell = 0; S.pi = (S.pi + 1) % S.zone.length; }
      continue;
    }

    if (inc.stage === -1) {
      if (S.arrived) { inc.stage = 0; inc.stageT = 0; say(sim, S.id, SENT_STAGE[0], 1.2); if (opts.teach) hold({ sid: S.id, stage: 0 }); }
      continue;
    }
    inc.stageT += dt;
    if (inc.stage === 5 && !inc.applied) {
      applyAction(sim, inc, S); inc.applied = true;
      if (!inc.needHuman && (sim.cfg.escalateAll || inc.noiseEscalate)) inc.needHuman = 'noise';
    }
    if (inc.stage === 5 && inc.type !== 'fp' && !inc.bonked && inc.stageT >= 0.4) { inc.bonked = true; sfx(sim, 'bonk'); }
    if (inc.stage === 5 && inc.needHuman && !inc.escalated && inc.stageT >= 0.5 && (!sim.approval || sim.approval.decided)) escalate(sim, inc, S);
    const waiting = inc.stage === 5 && inc.needHuman && !inc.humanDone;
    if (waiting) {
      const ap = sim.approval;
      if (ap && ap.sid === S.id && ap.iid === inc.trace && ap.deadline != null && !ap.decided) {
        if (ap.autoAt && t >= ap.autoAt) decide(sim, ap.noise ? 'approve' : 'approve', true);
        else if (t >= ap.deadline) decide(sim, 'deny', true);
      }
    } else if (inc.stageT >= STAGE_DUR) {
      inc.stage++;
      inc.stageT = 0;
      if (inc.stage >= STAGES.length) { finish(sim, inc, S); continue; }
      const F = FAULTS[inc.type];
      const line = inc.stage === 2 ? (inc.type === 'fp' ? B('Regla saltó…', 'Rule fired…') : B(`Regla ${F.rule} ✓`, `Rule ${F.rule} ✓`))
        : inc.stage === 3 && inc.type === 'fp' ? B('Hmm, parece normal', 'Hmm, looks normal')
        : inc.stage === 5 ? F.act : SENT_STAGE[inc.stage];
      say(sim, S.id, line, 1.2);
      sfx(sim, 'stage');
      if (opts.game && inc.stage === 4) hold({ sid: S.id, stage: 4, game: true });
      else if (opts.teach) hold({ sid: S.id, stage: inc.stage });
    }
  }

  if (sim.human.mood && t > sim.human.until) {
    sim.human.mood = sim.approval && sim.approval.deadline != null && !sim.approval.decided ? 'deciding' : null;
  }

  // Paquetes en vuelo
  sim.packets = sim.packets.filter((pk) => {
    if (pk.blocked) return t - pk.blockedAt < 1.4;
    if (!pk.frozen) {
      pk.p = (t - pk.t0) / pk.dur;
      if (pk.hold && pk.p >= 0.5) { pk.p = 0.5; pk.frozen = true; }
    }
    return pk.p < 1;
  });
  sim.fx = sim.fx.filter((e) => t - e.t0 < e.dur);
  for (const k in sim.bubbles) if (t > sim.bubbles[k].until) delete sim.bubbles[k];
}
