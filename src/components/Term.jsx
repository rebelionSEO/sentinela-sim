import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GLOSSARY } from '../content/learn.js';
import { tx, getLang } from '../i18n.js';

/** Término del glosario con definición emergente (hover, foco o toque). */
export function Term({ entry, children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="term" tabIndex={0} role="button" aria-expanded={open}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.span className="pop" role="tooltip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}>
            <b>{tx(entry.k)}</b>{tx(entry.d)}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Texto plano con los términos del glosario del idioma activo convertidos en <Term>. Cada término una sola vez. */
export function Rich({ text }) {
  const lang = getLang();
  const parts = [];
  const used = new Set();
  let rest = text || '';
  let key = 0;
  for (;;) {
    let best = null;
    for (const g of GLOSSARY) {
      const re = g.m[lang];
      if (!re || used.has(g)) continue;
      const m = rest.match(re);
      if (m && (best === null || m.index < best.m.index)) best = { g, m };
    }
    if (!best) break;
    const { g, m } = best;
    if (m.index > 0) parts.push(rest.slice(0, m.index));
    parts.push(<Term key={key++} entry={g}>{m[0]}</Term>);
    used.add(g);
    rest = rest.slice(m.index + m[0].length);
  }
  parts.push(rest);
  return <>{parts}</>;
}
