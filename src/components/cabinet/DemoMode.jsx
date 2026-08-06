/**
 * DemoMode — a guided replay of one night of agent work, with the REAL
 * interface captured at each step.
 *
 * Every image in `/demo/*.jpg` is a screenshot of this product actually doing
 * the thing described — the reconciliations, the anomaly, the review verdict
 * and the VAT drafts below were produced by the agents on a live dossier, not
 * mocked up. That is the whole point: a prospect should see the software work,
 * not read a claim that it does.
 *
 * The playback itself touches no API, so it is safe to run in front of anyone.
 */
import { useEffect, useRef, useState } from 'react';
import { MC, glass, EASE } from './mc';
import { McButton, LiveDot } from './Primitives';

const STEPS = [
  {
    time: '02:12', agent: 'Collecte', tone: 'accent',
    title: 'Relances envoyées aux clients',
    detail: "L'agent écrit à chaque client qui doit une pièce — au moment calculé pour lui, par email ou WhatsApp. Un seul message par client, listant tout ce qui manque.",
    proof: "Un bon payeur est relancé tard et doucement ; un retardataire, tôt et fermement. Le score de fiabilité s'ajuste à chaque pièce reçue.",
    human: null,
  },
  {
    time: '02:40', agent: 'Import & OCR', tone: 'accent', img: '/demo/imports.jpg',
    title: 'Les pièces entrent toutes seules',
    detail: "Fichiers du cabinet (CSV, FEC, Excel, Factur-X), e-factures récupérées depuis la plateforme du client, et photos de tickets lues par l'OCR.",
    proof: "Capture réelle : les trois portes d'entrée des données d'un dossier.",
    human: null,
  },
  {
    time: '03:05', agent: 'Lettrage', tone: 'warn', img: '/demo/lettrage.jpg',
    title: 'Rapprochements bancaires proposés',
    detail: "L'agent relie chaque virement reçu à la facture qu'il paie — montant et numéro de facture — et donne son niveau de confiance.",
    proof: "Capture réelle : 120,00 € et 2 400,00 € rapprochés à 95 % de confiance. Le bouton « Valider ✓ » attend un humain.",
    human: 'à valider',
  },
  {
    time: '03:30', agent: 'Gardien', tone: 'danger', img: '/demo/gardien.jpg',
    title: 'Point de vigilance signalé',
    detail: "Le Gardien relit tout le dossier : factures rejetées, SIREN manquant, numéro en double, impayé ancien, taux de TVA hors norme, pièce lue mais jamais saisie.",
    proof: "Capture réelle : « Taux de TVA inhabituel (15 %) — facture FAC-2026-0005 », détecté sans que personne ne l'ait cherché.",
    human: 'à corriger',
  },
  {
    time: '04:00', agent: 'Réviseur', tone: 'warn', img: '/demo/reviseur.jpg',
    title: 'Revue avant validation',
    detail: "Chaque facture non validée passe une check-list : numéro, lignes, adresse, SIREN client, taux de TVA, et l'arithmétique TTC = HT + TVA.",
    proof: "Capture réelle : « 3 factures revues · 2 prêtes · 1 à corriger ». Le comptable sait où regarder avant d'ouvrir quoi que ce soit.",
    human: null,
  },
  {
    time: '04:20', agent: 'TVA / CA3', tone: 'accent', img: '/demo/tva.jpg',
    title: 'Déclaration de TVA préparée',
    detail: "TVA collectée sur les ventes validées, moins la TVA déductible des achats acceptés, par période — en brouillon.",
    proof: "Capture réelle : trois périodes calculées, « à payer 420,00 € · brouillon ». L'agent ne télédéclare jamais.",
    human: 'à signer',
  },
  {
    time: '07:00', agent: 'Au matin', tone: 'ok', img: '/demo/ventes.jpg',
    title: 'Le cabinet ouvre son écran',
    detail: "Les impayés sont en tête, les factures triées par ce qui attend une action, et chaque agent a laissé son travail prêt à valider.",
    proof: "Capture réelle : 2 520 € d'impayés remontés en premier, sur 5 factures émises.",
    human: null,
  },
];

const STEP_MS = 5200;

export default function DemoMode({ onClose }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef();

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setPlaying(false); return; }
    timer.current = setTimeout(() => {
      setI((v) => (v >= STEPS.length - 1 ? (setPlaying(false), v) : v + 1));
    }, STEP_MS);
    return () => clearTimeout(timer.current);
  }, [i, playing]);

  const s = STEPS[i];
  const last = i >= STEPS.length - 1;
  const toneColor = { accent: MC.indigo, warn: MC.amber, danger: MC.red, ok: MC.green }[s.tone];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,6,15,.88)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-auto" style={{ ...glass('accent'), padding: 0 }}
           onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${MC.stroke}` }}>
          <LiveDot />
          <div>
            <div style={{ color: MC.ink, fontWeight: 700, fontSize: 15 }}>
              Une nuit de travail de l'agent
            </div>
            <div style={{ color: MC.ink3, fontSize: 11.5 }}>
              Captures réelles du produit · aucune donnée client n'est touchée pendant la démo
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
                  style={{ marginLeft: 'auto', color: MC.ink3, fontSize: 22, cursor: 'pointer', background: 'none' }}>×</button>
        </div>

        {/* timeline rail */}
        <div className="flex gap-1 px-5 pt-3">
          {STEPS.map((st, k) => (
            <button key={st.title} onClick={() => { setPlaying(false); setI(k); }}
                    title={`${st.time} — ${st.agent}`}
                    className="flex-1 cursor-pointer" style={{ height: 4, borderRadius: 999, border: 'none',
                      background: k <= i ? `linear-gradient(90deg, ${MC.indigo}, ${MC.cyan})` : 'rgba(255,255,255,.10)',
                      transition: `background .3s ${EASE}` }} />
          ))}
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span key={`tm-${s.time}`} style={{ fontSize: 12, fontWeight: 700, color: MC.ink3,
              fontVariantNumeric: 'tabular-nums' }}>{s.time}</span>
            <span key={`ag-${s.agent}`} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.09em',
              color: toneColor, textTransform: 'uppercase' }}>{s.agent}</span>
            {s.human && (
              <span key={`hu-${s.human}`} style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700,
                color: MC.amber, background: 'rgba(245,184,81,.14)', borderRadius: 999, padding: '2px 9px' }}>
                {s.human}
              </span>
            )}
          </div>

          <div key={`ti-${s.title}`} style={{ color: MC.ink, fontWeight: 700, fontSize: 18,
            letterSpacing: '-.01em', marginBottom: 6 }}>{s.title}</div>
          <div key={`de-${s.detail}`} style={{ color: MC.ink2, fontSize: 13.5, lineHeight: 1.6 }}>{s.detail}</div>

          {s.img && (
            <div key={s.img} className="mt-3" style={{ borderRadius: 14, overflow: 'hidden',
              border: `1px solid ${MC.strokeStrong}`, background: '#fff',
              animation: `mcRise .45s ${EASE} both`, boxShadow: '0 20px 50px -26px rgba(0,0,0,.95)' }}>
              <img src={s.img} alt={s.title} style={{ display: 'block', width: '100%' }} />
            </div>
          )}

          <div key={`pr-${s.proof}`} className="mt-3" style={{ padding: '9px 12px', borderRadius: 12,
            background: 'rgba(124,124,248,.12)', color: '#CFCBFF', fontSize: 12.5, lineHeight: 1.55 }}>
            {s.proof}
          </div>

          {last && (
            <div className="mt-3" style={{ ...glass('ok'), padding: 15 }}>
              <div style={{ color: MC.green, fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
                Ce qui reste au cabinet : les décisions
              </div>
              <div style={{ color: MC.ink2, fontSize: 13, lineHeight: 1.6 }}>
                L'agent a relancé, importé, rapproché, contrôlé, révisé et calculé pendant la nuit.
                Au matin il reste à valider — quelques clics, pas quelques heures.
              </div>
              <div style={{ color: MC.ink3, fontSize: 11.5, marginTop: 8 }}>
                L'agent prépare. Il ne valide jamais. La responsabilité reste humaine.
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2 flex-wrap">
          <McButton variant="ghost" size="sm" onClick={() => { setPlaying(false); setI(Math.max(0, i - 1)); }}
                    disabled={i === 0}>← Précédent</McButton>
          {!last ? (
            <McButton variant="ghost" size="sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? '❚❚ Pause' : '▶ Lecture'}
            </McButton>
          ) : (
            <McButton variant="ghost" size="sm" onClick={() => { setI(0); setPlaying(true); }}>↻ Rejouer</McButton>
          )}
          <span key={`ct-${i}`} className="self-center" style={{ fontSize: 11.5, color: MC.ink3 }}>
            {`${i + 1} / ${STEPS.length}`}
          </span>
          <McButton size="sm" style={{ marginLeft: 'auto' }}
                    onClick={() => (last ? onClose() : (setPlaying(false), setI(i + 1)))}>
            {last ? 'Fermer' : 'Suivant →'}
          </McButton>
        </div>
      </div>
    </div>
  );
}
