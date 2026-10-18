// Fuentes de eventos. El motor no sabe de dónde vienen las fallas:
// solo llama a source.step(sim, dt) en cada tick.
//
// Hoy existe createScriptedSource (guion por escenario). Para conectar un sistema real,
// implementa la misma interfaz { step(sim, dt) } traduciendo tu telemetría a llamadas de engine.js.

import { triggerFault } from './engine.js';

/** Dispara las fallas del escenario activo en ciclo, según su `script`. */
export function createScriptedSource() {
  return {
    name: 'guion',
    step(sim, dt) {
      const { script, scriptLen } = sim.sc;
      sim.scriptT += dt;
      for (const [at, type] of script) {
        if (!sim.fired[at] && sim.scriptT >= at) { sim.fired[at] = true; triggerFault(sim, type); }
      }
      if (sim.scriptT >= scriptLen) { sim.scriptT = 0; sim.fired = {}; }
    },
  };
}

/**
 * Esqueleto para telemetría real (no se usa todavía).
 * Tu collector de OpenTelemetry (o un backend propio) emite por WebSocket eventos ya clasificados:
 *   { kind: 'fault', type: 'loop' }   { kind: 'heartbeat', agent: 'red' }
 * Se encolan al llegar y se aplican en step(), para que el motor siga siendo el único que modifica `sim`.
 */
export function createOtelSource(url) {
  const inbox = [];
  let ws = null;
  return {
    name: 'otel',
    connect() {
      ws = new WebSocket(url);
      ws.onmessage = (e) => { try { inbox.push(JSON.parse(e.data)); } catch { /* ignora mensajes inválidos */ } };
    },
    disconnect() { ws?.close(); },
    step(sim) {
      while (inbox.length) {
        const ev = inbox.shift();
        if (ev.kind === 'fault') triggerFault(sim, ev.type);
      }
    },
  };
}
