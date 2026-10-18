import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QUIZ } from '../content/learn.js';
import { tx, t as T, B } from '../i18n.js';
import { Rich } from './Term.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

export function Quiz({ onSfx }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = QUIZ[i];
  const n = QUIZ.length;

  const choose = (k) => {
    if (pick !== null) return;
    setPick(k);
    if (k === q.a) { setScore((s) => s + 1); onSfx?.('good'); } else onSfx?.('bad');
  };
  const next = () => {
    if (i + 1 >= n) { setDone(true); onSfx?.('boot'); return; }
    setI(i + 1); setPick(null);
  };
  const restart = () => { setI(0); setPick(null); setScore(0); setDone(false); };
  const verdict = score >= n - 1 ? B('Nivel Sentinela 🛡️', 'Sentinel level 🛡️') : score >= 9 ? B('Casi listo para vigilar', 'Almost ready to keep watch')
    : score >= 6 ? B('Vas bien; repasa el glosario', 'Good start; review the glossary') : B('Activa el modo aprendizaje y vuelve', 'Try learning mode and come back');

  return (
    <section className="card quiz" id="quiz">
      <div className="quiz-head">
        <h2>{T('quizTitle')}</h2>
        <span className="mono">{done ? T('done') : `${T('question')} ${i + 1}/${n}`} · {score} {T('correctN')}</span>
      </div>
      <div className="progress"><i style={{ width: `${((done ? n : i + (pick !== null ? 1 : 0)) / n) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" className="quiz-done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <motion.b initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>{score}/{n}</motion.b>
            <p>{tx(verdict)}</p>
            <button className="btn on" onClick={restart}>{T('retry')}</button>
          </motion.div>
        ) : (
          <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            <h3>{tx(q.q)}</h3>
            <div className="quiz-opts">
              {q.o.map((o, k) => {
                const state = pick === null ? '' : k === q.a ? ' right' : k === pick ? ' wrong' : ' dim';
                return (
                  <motion.button key={k} className={'qopt' + state} onClick={() => choose(k)} disabled={pick !== null}
                    whileHover={pick === null ? { x: 3 } : {}} whileTap={pick === null ? { scale: 0.98 } : {}}
                    animate={pick === k && k !== q.a ? { x: [0, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.35 }}>
                    <span className="ql">{LETTERS[k]}</span><span>{tx(o)}</span>
                  </motion.button>
                );
              })}
            </div>
            <AnimatePresence>
              {pick !== null && (
                <motion.div className={'qexp' + (pick === q.a ? ' ok' : ' no')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <b>{pick === q.a ? T('right') : T('wrong')}</b> <Rich text={tx(q.e)} />
                  <div style={{ marginTop: 10 }}><button className="btn on" onClick={next} autoFocus>{i + 1 >= n ? T('result') : T('next')}</button></div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
