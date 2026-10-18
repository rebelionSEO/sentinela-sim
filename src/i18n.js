// Idioma. Todo texto visible es un string o un objeto { es, en }.
// tx() devuelve la versión del idioma activo. La UI se redibuja cada frame, así que
// cambiar el idioma se ve al instante sin pasar `lang` por todos los componentes.

let LANG = 'es';
export const setLang = (l) => { LANG = l === 'en' ? 'en' : 'es'; };
export const getLang = () => LANG;
export const B = (es, en) => ({ es, en });
export const tx = (v) => (v == null ? '' : typeof v === 'string' ? v : v[LANG] ?? v.es ?? '');

/** Idioma inicial: #en / #es en la URL, luego lo guardado, luego el del navegador. */
export function detectLang(stored) {
  try {
    const h = (location.hash || '').replace('#', '');
    if (h === 'en' || h === 'es') return h;
  } catch { /* sin location */ }
  if (stored === 'en' || stored === 'es') return stored;
  try { return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en'; } catch { return 'es'; }
}

/* Textos de interfaz */
const UI = {
  title1: B('Agente', 'Sentinel'), title2: B('Sentinela', 'Agent'),
  sub: B('Un agente que vigila a otros agentes: detecta fallas, responde lo justo y deja todo auditado.',
    'An agent that watches other agents: spots failures, responds just enough and logs everything.'),
  scContent: B('Automatización de contenido', 'Content automation'),
  scGtm: B('Automatización GTM (pipeline)', 'GTM automation (pipeline)'),
  scContentHint: B('Sencilla · 6 agentes · 1 Sentinela', 'Simple · 6 agents · 1 Sentinel'),
  scGtmHint: B('Compleja · 8 agentes · 2 Sentinelas · embudo', 'Complex · 8 agents · 2 Sentinels · funnel'),
  healthy: B('Agentes sanos', 'Healthy agents'), detected: B('Detectados', 'Detected'), blocked: B('Bloqueados', 'Blocked'),
  falseAlarms: B('Falsas alarmas', 'False alarms'), mttd: B('MTTD medio', 'Avg MTTD'), score: B('Puntaje', 'Score'),
  escalations: B('Al humano', 'To human'),
  pause: B('Pausar', 'Pause'), resume: B('Reanudar', 'Resume'),
  game: B('Tú decides', 'You decide'), teach: B('Modo aprendizaje', 'Learning mode'), script: B('Guion automático', 'Auto script'),
  sound: B('Sonido', 'Sound'), on: B('activo', 'on'), off: B('apagado', 'off'),
  tour: B('Recorrido', 'Tour'), quiz: B('Quiz', 'Quiz'), how: B('Cómo funciona', 'How it works'), reset: B('Reiniciar', 'Reset'),
  inject: B('Provocar falla', 'Trigger failure'),
  legMsg: B('Mensaje', 'Message'), legTel: B('Heartbeat', 'Heartbeat'), legRisk: B('Contenido riesgoso', 'Risky content'),
  legCtl: B('Orden de control', 'Control order'), legTok: B('Barra: tokens usados', 'Bar: tokens used'),
  legLead: B('Lead (color = etapa)', 'Lead (color = stage)'),
  deckHint: B('arrastra un agente · tócalo para ver acciones', 'drag an agent · tap it for actions'),
  paused: B('PAUSADO', 'PAUSED'), booting: B('ENCENDIENDO', 'BOOTING'),
  scanNow: B('Escanear ahora', 'Scan now'), inProgress: B('en curso', 'running'), noFault: B('Sin falla simulada', 'No simulated failure'),
  incident: B('Incidente activo', 'Active incident'), incidents: B('Incidentes activos', 'Active incidents'),
  patrolling: B('Patrullando. Sin incidentes abiertos.', 'Patrolling. No open incidents.'),
  queued: B('en cola', 'queued'), onTheWay: B('Sentinela en camino…', 'Sentinel on its way…'),
  ladder: B('Escalera de respuesta', 'Response ladder'), stages: B('Ver etapas', 'Show stages'),
  waitingYou: B('Esperando tu decisión…', 'Waiting for your call…'),
  humanNeeded: B('Aprobación humana', 'Human approval'),
  carrying: B('El Sentinela lleva el caso al humano…', 'The Sentinel is taking the case to the human…'),
  autoDeny: B('Se deniega solo en', 'Auto-denies in'), pausedRead: B('Reloj pausado mientras lees.', 'Clock paused while you read.'),
  deny: B('Denegar', 'Deny'), approve: B('Aprobar', 'Approve'),
  denied: B('Denegado. No salió.', 'Denied. Nothing went out.'), approved: B('Aprobado.', 'Approved.'),
  inspector: B('Inspector', 'Inspector'), inspHint: B('Toca otro agente o arrástralo.', 'Tap another agent or drag it.'),
  status: B('Estado', 'Status'), lastHb: B('Último heartbeat', 'Last heartbeat'), ago: B('hace', ''), sAgo: B('s', 's ago'),
  latency: B('Latencia p50', 'Latency p50'), calls: B('Llamadas', 'Calls'), pending: B('Cola', 'Queue'),
  tokens: B('Tokens', 'Tokens'), tools: B('Herramientas', 'Tools'), hung: B('colgado', 'hung'), watchedBy: B('Vigila', 'Watched by'),
  log: B('Bitácora', 'Audit log'), noEvents: B('Aún sin eventos.', 'No events yet.'),
  lab: B('Laboratorio de umbrales', 'Threshold lab'),
  labHint: B('Sensible detecta antes pero trae falsas alarmas. Tolerante da calma pero detecta tarde.',
    'Sensitive detects sooner but brings false alarms. Tolerant is calm but detects late.'),
  sensitive: B('sensible', 'sensitive'), tolerant: B('tolerante', 'tolerant'),
  labLoop: B('Bucle: repeticiones', 'Loop: repeats'), labBudget: B('Presupuesto de tokens', 'Token budget'), labHb: B('Timeout de heartbeat', 'Heartbeat timeout'),
  calls_: B('llamadas', 'calls'), recentMttd: B('MTTD reciente', 'Recent MTTD'), inQueue: B('En cola', 'Queued'),
  noisy: B('Muy sensible: llegan falsas alarmas y lo real espera en cola.', 'Too sensitive: false alarms pile up, real issues wait.'),
  slow: B('Muy tolerante: poco ruido, pero detecta tarde.', 'Too tolerant: quiet, but detects late.'),
  balanced: B('Equilibrado.', 'Balanced.'), restore: B('Restaurar', 'Restore'),
  gameIdle: B('En el próximo incidente tú eliges la respuesta. Provoca una falla para empezar.', 'On the next incident you pick the response. Trigger a failure to start.'),
  teachIdle: B('Se detiene en cada etapa del próximo incidente para explicarla.', 'It will pause at each stage of the next incident to explain it.'),
  whatResponse: B('¿Qué respuesta aplicas?', 'Which response do you apply?'),
  seeSentinel: B('Ver al Sentinela actuar', 'Watch the Sentinel act'),
  rightWas: B('La justa era', 'The right one was'), cost: B('Costo', 'Cost'), consequence: B('Consecuencia', 'Consequence'),
  cont: B('Continuar', 'Continue'), close: B('Cerrar incidente', 'Close incident'),
  understand: B('Entender esta falla', 'Understand this failure'),
  what: B('Qué pasó', 'What happened'), risk: B('Riesgo', 'Risk'), response: B('Respuesta', 'Response'),
  stageOf: B('Etapa', 'Stage'), of: B('de', 'of'), inThisCase: B('En este caso', 'In this case'), whyThis: B('Por qué esta respuesta', 'Why this response'),
  funnel: B('Embudo en vivo', 'Live funnel'), visitors: B('Visitas', 'Visits'), leads: B('Leads', 'Leads'),
  spend: B('Gasto', 'Spend'), cpl: B('Costo/lead', 'Cost/lead'), stl: B('Speed-to-lead', 'Speed-to-lead'), mqlSql: B('MQL→SQL', 'MQL→SQL'),
  zoneA: B('ZONA MARKETING', 'MARKETING ZONE'), zoneB: B('ZONA PIPELINE', 'PIPELINE ZONE'),
  human: B('HUMANO', 'HUMAN'), reviewer: B('Revisor', 'Reviewer'),
  quizTitle: B('Pon a prueba lo que aprendiste', 'Test what you learned'), question: B('Pregunta', 'Question'),
  correctN: B('correctas', 'correct'), done: B('Terminado', 'Done'), right: B('¡Correcto!', 'Correct!'), wrong: B('No exactamente.', 'Not quite.'),
  next: B('Siguiente', 'Next'), result: B('Ver resultado', 'See result'), retry: B('Intentar de nuevo', 'Try again'),
  back: B('Atrás', 'Back'), start: B('Empezar', 'Start'), tourOf: B('Recorrido', 'Tour'),
  glossary: B('Glosario', 'Glossary'),
  escAll: B('Escalar todo al humano', 'Escalate everything to the human'),
  escAllHint: B('Prueba qué pasa si cada incidente pasa por la persona.', 'See what happens if every incident goes through the person.'),
  rubber: B('Aprobados sin leer', 'Approved unread'), noiseN: B('Escalaciones innecesarias', 'Needless escalations'),
  fatigueMsg: B('El humano está saturado: ya aprueba sin leer, incluso lo crítico.', 'The human is overloaded: approving without reading, even critical cases.'),
  bounce: B('Rebotes', 'Bounces'), vipWait: B('Lead enterprise esperando dueño', 'Enterprise lead waiting for an owner'),
  compare: B('Sencilla vs compleja', 'Simple vs complex'),
  compareHint: B('Mismo Sentinela, distinta escala. Lo que cambia es cuánto se puede romper.', 'Same Sentinel, different scale. What changes is how much can break.'),
  cAgents: B('Agentes', 'Agents'), cZones: B('Zonas', 'Zones'), cSentinels: B('Sentinelas', 'Sentinels'),
  cPath: B('Handoffs de punta a punta', 'End-to-end handoffs'), cWatched: B('Métricas que vigila', 'Metrics watched'),
  cMoney: B('Dinero y clientes en juego', 'Money and customers at stake'), cHuman: B('Tipos de caso para el humano', 'Case types for the human'),
  current: B('actual', 'current'), switchTo: B('Ver este', 'View this'),

};
export { UI };
export const t = (k) => (UI[k] ? tx(UI[k]) : k);
