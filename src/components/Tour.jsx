import { AnimatePresence, motion } from 'framer-motion';
import { TOUR } from '../content/learn.js';
import { tx, t as T } from '../i18n.js';

export function Tour({ step, onStep, onClose }) {
  const s = step == null ? null : TOUR[step];
  return (
    <AnimatePresence>
      {s && (
        <motion.aside className="tour" role="dialog" aria-label={T('tour')}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
          <div className="tour-top">
            <span className="lbl-s amber">{T('tourOf')} · {step + 1}/{TOUR.length}</span>
            <button className="x" onClick={onClose} aria-label="×">×</button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
              <h3>{tx(s.title)}</h3>
              <p>{tx(s.body)}</p>
            </motion.div>
          </AnimatePresence>
          <div className="dots-t">{TOUR.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
          <div className="row">
            <button className="btn" disabled={step === 0} onClick={() => onStep(step - 1)}>{T('back')}</button>
            {step < TOUR.length - 1
              ? <button className="btn on" onClick={() => onStep(step + 1)}>{T('next')}</button>
              : <button className="btn on" onClick={onClose}>{T('start')}</button>}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
