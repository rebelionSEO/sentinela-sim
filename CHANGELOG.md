# Changelog

## 1.1.0 — 2026-10-29

- Modo incrustado: `?embed` muestra solo la cubierta, el selector de escenario, las fallas,
  el incidente activo y 4 indicadores, con enlace a la versión completa. Pensado para un `<iframe>` en un blog.
- El iframe puede ajustar su altura solo: la página avisa su alto con `postMessage` (`sentinela:height`).
- `?embed&sc=gtm` abre directo en el escenario GTM.

## 1.0.0 — 2026-10-17

Primera versión pública.

- Dos escenarios: **Automatización de contenido** (6 agentes, 1 Sentinela, 9 riesgos) y
  **Automatización GTM** (8 agentes en 2 zonas, 2 Sentinelas, embudo en vivo, 10 riesgos).
- Pipeline de 7 etapas, escalera de respuesta proporcional, martillazo y humor anime.
- Humano en el ciclo con fail-closed y fatiga de alertas.
- Modo aprendizaje, "Tú decides", laboratorio de umbrales, recorrido guiado, quiz de 19 preguntas y glosario.
- Español e inglés.
