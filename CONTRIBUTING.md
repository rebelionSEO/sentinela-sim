# Cómo contribuir

1. `npm install` y `npm run dev` (abre en http://localhost:5199).
2. Haz tus cambios en una rama, no en `main`.
3. Antes de abrir un PR corre `npm run check` (pruebas + build).
4. Todo texto visible va en **español e inglés** con `B('es', 'en')` (ver `src/i18n.js`).
   Las pruebas fallan si falta una traducción.

## Dónde está cada cosa

| Quiero… | Archivo |
|---|---|
| Agregar o cambiar un agente, escenario o riesgo | `src/sim/model.js` |
| Cambiar cómo se detecta o responde un riesgo | `src/sim/engine.js` |
| Editar explicaciones, glosario, quiz o recorrido | `src/content/learn.js` |
| Cambiar textos de botones y paneles | `src/i18n.js` |
| Cambiar el dibujo de robots, Sentinelas o humano | `src/components/Deck.jsx`, `src/components/Human.jsx` |

## Agregar un riesgo nuevo

1. `model.js`: entrada en `FAULTS` (agente, severidad, `ladder`, regla y 7 etapas bilingües) y súmalo a `agentFaults` del escenario.
2. `engine.js`: qué pasa al dispararse (`triggerFault`), cómo se detecta (`detectAt` o una condición) y qué hace el Sentinela (`applyAction`).
3. `learn.js`: ficha en `FAULT_LEARN`.
4. `npm test`: la prueba revisa que se detecte, se cierre y tenga textos completos.
