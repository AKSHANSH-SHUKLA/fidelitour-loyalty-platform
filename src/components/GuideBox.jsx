/**
 * GuideBox — a tiny collapsible "Comment ça marche ?" helper.
 *
 * WHY (terrain, août 2026): the cabinet screens pack a lot of power and the
 * feedback was "trop dur à naviguer". Apps the profession loves (MyFiteco…)
 * spoon-feed: every section explains itself in one tap. GuideBox brings that:
 * drop it at the top of any section with 2-5 concrete steps + one example.
 * Collapsed by default (one line), zero clutter for power users.
 */
import { useState } from 'react';
import { MC } from './cabinet/mc';

export default function GuideBox({ title = 'Comment ça marche ?', steps = [], example }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-3 text-xs"
         style={{ background: 'rgba(124,124,248,.10)', border: '1px solid rgba(124,124,248,.28)' }}>
      <button type="button" onClick={() => setOpen(!open)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left font-semibold cursor-pointer"
              style={{ color: MC.indigo }}>
        <span>❓</span> {title}
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3" style={{ color: MC.ink2, lineHeight: 1.6 }}>
          <ol className="list-decimal pl-5 space-y-1">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {example && (
            <div className="mt-2 rounded-lg px-2.5 py-1.5"
                 style={{ background: 'rgba(245,184,81,.14)', color: MC.amber }}>
              <b>Exemple :</b> {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
