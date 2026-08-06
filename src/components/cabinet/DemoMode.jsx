/**
 * DemoMode — a scripted, self-playing run of one night of agent work.
 *
 * Why it exists: the strongest thing about FidClic is invisible — the agent
 * works while nobody is watching. A screenshot can't show that; a list of
 * features can't either. This plays it back as a timeline the visitor can
 * watch in 40 seconds, on fake data, touching nothing real.
 *
 * It is deliberately NOT connected to the API: it must be safe to run in front
 * of a prospect on a live account.
 */
import { useEffect, useRef, useState } from 'react';
import { MC, glass, EASE } from './mc';
import { McButton, LiveDot } from './Primitives';

const SCRIPT = [
  { at: 0.0, agent: 'Collecte', icon: '📨', tone: 'accent',
    title: 'Relance envoyée à 3 clients',
    detail: 'Boulangerie Petit · Garage Moreau · Pharmacie Blanc — relevés bancaires de juillet',
    human: null },
  { at: 0.16, agent: 'OCR', icon: '📷', tone: 'accent',
    title: '7 factures fournisseurs lues',
    detail: 'Metro 240,00 € · EDF 890,00 € · Carrefour 86,40 € — confiance moyenne 94 %',
    human: null },
  { at: 0.32, agent: 'Saisie', icon: '🧾', tone: 'warn',
    title: '7 écritures préparées',
    detail: '606400 Fournitures + 445660 TVA déductible ↔ 401 Fournisseurs — toutes équilibrées',
    human: 'à valider' },
  { at: 0.48, agent: 'Lettrage', icon: '🔗', tone: 'warn',
    title: '4 rapprochements proposés',
    detail: 'VIR 1 200,00 € ↔ FAC-2026-0002 — montant + référence, confiance 95 %',
    human: 'à valider' },
  { at: 0.62, agent: 'Gardien', icon: '🛡️', tone: 'danger',
    title: '1 point de vigilance',
    detail: 'Facture V-12 validée sans SIREN client — non conforme à la réforme 2026',
    human: 'à corriger' },
  { at: 0.76, agent: 'Conseiller', icon: '💡', tone: 'ok',
    title: 'Opportunité de mission détectée',
    detail: 'Garage Moreau : 2 factures échues (3 400 €) — proposer un suivi de trésorerie',
    human: 'à proposer' },
  { at: 0.9, agent: 'TVA', icon: '🧮', tone: 'accent',
    title: 'CA3 de juillet préparée',
    detail: 'Collectée 4 820 € − déductible 1 690 € = 3 130 € à payer (brouillon)',
    human: 'à signer' },
];

const TOTAL_MS = 26000;

export default function DemoMode({ onClose }) {
  const [t, setT] = useState(0);            // 0..1
  const [playing, setPlaying] = useState(true);
  const raf = useRef(); const start = useRef();

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setT(1); setPlaying(false); return; }
    if (!playing) return;
    start.current = performance.now() - t * TOTAL_MS;
    const tick = (now) => {
      const p = Math.min(1, (now - start.current) / TOTAL_MS);
      setT(p);
      if (p < 1) raf.current = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const shown = SCRIPT.filter((s) => t >= s.at);
  const clock = new Date(2026, 7, 6, 2, 12, 0);
  clock.setMinutes(clock.getMinutes() + Math.round(t * 214));
  const hhmm = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;
  const done = t >= 1;

  const toValidate = shown.filter((s) => s.human).length;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,6,15,.86)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-auto"
           style={{ ...glass('accent'), padding: 0 }} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-5 py-4"
             style={{ borderBottom: `1px solid ${MC.stroke}` }}>
          <LiveDot />
          <div>
            <div style={{ color: MC.ink, fontWeight: 700, fontSize: 15 }}>Mode démo — une nuit de travail</div>
            <div key={`sub-${hhmm}`} style={{ color: MC.ink3, fontSize: 11.5 }}>
              {`Données fictives · l'agent a commencé à 02:12 · il est ${hhmm}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
                  style={{ marginLeft: 'auto', color: MC.ink3, fontSize: 20, cursor: 'pointer', background: 'none' }}>×</button>
        </div>

        {/* progress rail */}
        <div style={{ height: 3, background: 'rgba(255,255,255,.06)' }}>
          <div style={{ height: '100%', width: `${t * 100}%`,
            background: `linear-gradient(90deg, ${MC.indigo}, ${MC.cyan})`, transition: 'width .2s linear' }} />
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {shown.length === 0 && (
            <div style={{ color: MC.ink3, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              L'agent démarre…
            </div>
          )}
          {shown.map((s, idx) => (
            <div key={s.title}
                 style={{ ...glass(s.tone), padding: '12px 14px', display: 'flex', gap: 12,
                          alignItems: 'flex-start', animation: `mcRise .45s ${EASE} both` }}>
              <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span key={`ag-${s.agent}`} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em',
                    color: MC.indigo, textTransform: 'uppercase' }}>{s.agent}</span>
                  <span key={`ti-${s.title}`} style={{ color: MC.ink, fontWeight: 600, fontSize: 13.5 }}>{s.title}</span>
                  {s.human && (
                    <span key={`h-${s.human}-${idx}`} style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700,
                      color: MC.amber, background: 'rgba(245,184,81,.14)', borderRadius: 999, padding: '2px 8px' }}>
                      {s.human}
                    </span>
                  )}
                </div>
                <div key={`d-${s.detail}`} style={{ color: MC.ink2, fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>
                  {s.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {done && (
          <div className="px-5 pb-5">
            <div style={{ ...glass('ok'), padding: 16 }}>
              <div style={{ color: MC.green, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Au matin, tout est prêt
              </div>
              <div key={`sum-${toValidate}`} style={{ color: MC.ink2, fontSize: 12.8, lineHeight: 1.6 }}>
                {`L'agent a travaillé pendant que le cabinet dormait : 7 pièces lues, 7 écritures et 4 rapprochements préparés, 1 anomalie signalée, 1 opportunité de mission, la CA3 en brouillon. Il reste ${toValidate} décisions humaines — quelques clics, pas quelques heures.`}
              </div>
              <div style={{ color: MC.ink3, fontSize: 11.5, marginTop: 8 }}>
                L'agent prépare. Il ne valide jamais. La responsabilité reste au cabinet.
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-5 flex gap-2">
          <McButton variant="ghost" size="sm"
                    onClick={() => { setT(0); setPlaying(true); }}>Rejouer</McButton>
          {!done && (
            <McButton variant="ghost" size="sm"
                      onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Reprendre'}</McButton>
          )}
          {!done && (
            <McButton variant="ghost" size="sm" onClick={() => { setPlaying(false); setT(1); }}>
              Tout afficher
            </McButton>
          )}
          <McButton size="sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Fermer</McButton>
        </div>
      </div>
    </div>
  );
}
