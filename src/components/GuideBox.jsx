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

export default function GuideBox({ title = 'Comment ça marche ?', steps = [], example }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-3 text-xs"
         style={{ background: 'rgba(47,111,179,.06)', border: '1px solid rgba(47,111,179,.18)' }}>
      <button type="button" onClick={() => setOpen(!open)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left font-semibold"
              style={{ color: '#2F6FB3' }}>
        <span>❓</span> {title}
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-[#57534E]">
          <ol className="list-decimal pl-5 space-y-1">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {example && (
            <div className="mt-2 rounded-lg px-2.5 py-1.5"
                 style={{ background: 'rgba(184,134,11,.10)', color: '#7A5A0B' }}>
              <b>Exemple :</b> {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
