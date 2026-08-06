import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { casesAPI, cabinetOsAPI } from '../lib/api';
import LiveText from '../components/LiveText';
import CabinetShell from '../components/cabinet/CabinetShell';
import { MC, glass } from '../components/cabinet/mc';
import { Pill, McButton, Rise, StatTile } from '../components/cabinet/Primitives';

/**
 * CabinetCases — the Exception Centre (route: /cabinet/cas).
 *
 * WHY IT LOOKS LIKE A QUEUE, NOT AN INBOX
 *   The failure mode this replaces is an email nobody owns. So every row must
 *   answer four questions at a glance: what broke, for which client, WHOSE job
 *   it is, and by when. Sorting is overdue-first, then severity, then age —
 *   the order a person should actually work in, not the order things arrived.
 *
 * The two counters at the top are not decoration: clicking them filters the
 * list, so "3 en retard" is a way in rather than a fact to memorise.
 */

const STATUS = {
  open: { label: 'Ouvert', tone: 'danger' },
  in_progress: { label: 'En cours', tone: 'warn' },
  resolved: { label: 'Résolu', tone: 'ok' },
  dismissed: { label: 'Écarté', tone: 'idle' },
};

/** Closing a case asks for a note in-app — a dismissal must carry a reason. */
function CloseCaseModal({ caseItem, mode, onCancel, onConfirm }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const dismissing = mode === 'dismissed';
  const REASONS = dismissing
    ? ['Faux positif — la pièce est conforme', 'Doublon d\'un autre cas', 'Traité hors FidClic',
       'Client informé, sans suite', 'Autre (préciser ci-dessous)']
    : ['Pièce reçue et saisie', 'Facture corrigée puis renvoyée', 'Rapprochement effectué',
       'Client relancé et régularisé', 'Autre (préciser ci-dessous)'];

  const go = async () => {
    if (dismissing && !note.trim()) return;
    setBusy(true);
    await onConfirm(note.trim());
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,6,15,.82)', backdropFilter: 'blur(6px)' }} onClick={onCancel}>
      <div className="w-full max-w-md" style={{ ...glass('accent'), padding: 20 }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, color: MC.ink, fontSize: 15.5 }}>
          {dismissing ? `Écarter le cas ${caseItem.number}` : `Résoudre le cas ${caseItem.number}`}
        </div>
        <div style={{ fontSize: 12, color: MC.ink3, marginTop: 3, marginBottom: 14 }}>
          {dismissing
            ? 'Un motif est obligatoire : « on a choisi de ne rien faire » est exactement la décision qu\'on vous demandera d\'expliquer dans six mois.'
            : 'Une note de résolution est facultative, mais elle fait gagner du temps au prochain qui ouvre ce dossier.'}
        </div>

        <label style={{ fontSize: 11.5, color: MC.ink3, fontWeight: 600 }}>Motif courant</label>
        <select className="fld-mc w-full mt-1 mb-3"
                onChange={(e) => setNote(e.target.value.startsWith('Autre') ? '' : e.target.value)}>
          <option value="">— choisir —</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label style={{ fontSize: 11.5, color: MC.ink3, fontWeight: 600 }}>
          {dismissing ? 'Motif (obligatoire)' : 'Note (optionnel)'}
        </label>
        <textarea className="fld-mc w-full mt-1" rows={3} value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={dismissing ? 'Pourquoi ce cas n\'appelle aucune action…' : 'Ce qui a été fait…'} />

        <div className="flex gap-2 mt-4">
          <McButton variant="ghost" size="sm" onClick={onCancel}>Annuler</McButton>
          <McButton size="sm" style={{ marginLeft: 'auto', ...(dismissing && !note.trim() ? { opacity: .4 } : {}) }}
                    variant={dismissing ? 'danger' : 'ok'}
                    disabled={busy || (dismissing && !note.trim())} onClick={go}>
            {busy ? '…' : (dismissing ? 'Écarter' : 'Résoudre')}
          </McButton>
        </div>
      </div>
    </div>
  );
}

export default function CabinetCases() {
  const [data, setData] = useState(null);
  const [team, setTeam] = useState([]);
  const [me, setMe] = useState(null);
  const [filter, setFilter] = useState({ status: 'open', assignee: '' });
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [closing, setClosing] = useState(null); // { caseItem, mode }

  const load = useCallback(async () => {
    const [c, t, m] = await Promise.all([
      casesAPI.list(filter).catch(() => null),
      cabinetOsAPI.team().catch(() => null),
      cabinetOsAPI.me().catch(() => null),
    ]);
    setData(c?.data || { cases: [], counts: {} });
    setTeam(t?.data?.members || []);
    setMe(m?.data || null);
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  // Poll so a case raised by a webhook shows up without anyone pressing refresh.
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, 45000);
    return () => clearInterval(id);
  }, [load]);

  const flash = (ok, msg) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 6000); };

  const act = async (fn, id, okMsg) => {
    setBusy(id);
    try { await fn(); flash(true, okMsg); await load(); }
    catch (e) { flash(false, e?.response?.data?.detail || 'Action impossible.'); }
    finally { setBusy(null); }
  };

  const counts = data?.counts || {};
  // v2 roles: EC and superviseur both have portfolio-wide oversight; legacy
  // "admin" kept until every row has been normalized on read.
  const isAdmin = ['admin', 'expert_comptable', 'superviseur'].includes(me?.membership?.role);
  const rows = (data?.cases || []).filter((c) => (overdueOnly ? c.overdue : true));

  return (
    <CabinetShell
      title="Centre d'exceptions"
      subtitle="Ce qui a cassé, chez quel client, à qui c'est, et pour quand. Les cas en retard remontent en premier."
      headerRight={
        <McButton variant="ghost" size="sm" onClick={load} title="Rafraîchir">
          <RefreshCw size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
        </McButton>
      }>

      {toast && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm"
             style={toast.ok
               ? { background: 'rgba(61,220,151,.12)', border: '1px solid rgba(61,220,151,.35)', color: MC.green }
               : { background: 'rgba(255,107,107,.10)', border: '1px solid rgba(255,107,107,.35)', color: MC.red }}>
          <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatTile label="Cas ouverts" value={counts.open ?? 0} tone={counts.open ? 'red' : 'green'}
                  active={!overdueOnly} onClick={() => { setOverdueOnly(false); setFilter((f) => ({ ...f, status: 'open' })); }} />
        <StatTile label="En retard" value={counts.overdue ?? 0} tone={counts.overdue ? 'red' : 'green'}
                  delay={60} active={overdueOnly} onClick={() => { setOverdueOnly(true); setFilter((f) => ({ ...f, status: 'open' })); }} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="fld-mc" value={filter.status}
                onChange={(e) => { setOverdueOnly(false); setFilter({ ...filter, status: e.target.value }); }}>
          <option value="open">Ouverts</option>
          <option value="resolved">Résolus</option>
          <option value="dismissed">Écartés</option>
          <option value="">Tous</option>
        </select>
        <select className="fld-mc" value={filter.assignee}
                onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}>
          <option value="">Tout le monde</option>
          <option value="me">Mes cas</option>
          {isAdmin && team.filter((m) => m.status === 'active').map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
        {overdueOnly && (
          <button onClick={() => setOverdueOnly(false)} className="cursor-pointer"
                  style={{ fontSize: 11.5, color: MC.indigo, background: 'none' }}>
            ✕ retirer le filtre « en retard »
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {rows.length === 0 ? (
          <Rise>
            <div style={{ ...glass('ok'), padding: '44px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: MC.green, marginBottom: 4 }}>Aucun cas</div>
              <div style={{ fontSize: 12.5, color: MC.ink3 }}>Tout est traité — rien n'attend une décision.</div>
            </div>
          </Rise>
        ) : rows.map((c, i) => {
          const st = STATUS[c.status] || STATUS.open;
          const isOpen = ['open', 'in_progress'].includes(c.status);
          return (
            <Rise key={c.id} delay={i * 35}>
              <div style={{ ...glass(c.overdue ? 'danger' : undefined), padding: 15 }}>
                <div className="flex items-start gap-3 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: c.severity === 'red' ? MC.red : MC.amber,
                                 boxShadow: `0 0 12px ${c.severity === 'red' ? MC.red : MC.amber}` }} />
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span key={c.number} style={{ fontSize: 11, fontWeight: 700, color: MC.ink3 }}>{c.number}</span>
                      <LiveText style={{ fontWeight: 700, color: MC.ink, fontSize: 14 }}>{c.title_fr}</LiveText>
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {c.overdue && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: MC.red,
                          background: 'rgba(255,107,107,.14)', borderRadius: 999, padding: '2px 9px',
                          display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} /> En retard
                        </span>
                      )}
                      {c.occurrences > 1 && (
                        <span key={`occ-${c.id}-${c.occurrences}`} style={{ fontSize: 10.5, color: MC.ink3 }}>
                          {`×${c.occurrences}`}
                        </span>
                      )}
                    </div>
                    {c.detail_fr && (
                      <LiveText as="div" style={{ fontSize: 12.5, color: MC.ink2, marginTop: 3, lineHeight: 1.5 }}>
                        {c.detail_fr}
                      </LiveText>
                    )}
                    <div style={{ fontSize: 11, color: MC.ink3, marginTop: 5 }}>
                      <LiveText>{`${c.client_name || '—'} · ${c.assignee_name || 'non assigné'} · échéance ${c.due_date || '—'}`}</LiveText>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${MC.stroke}` }}>
                    {c.status === 'open' && (
                      <McButton size="sm" variant="ghost" disabled={busy === c.id}
                                style={{ color: MC.amber, borderColor: 'rgba(245,184,81,.35)' }}
                                onClick={() => act(() => casesAPI.setStatus(c.id, 'in_progress'), c.id,
                                                   `Cas ${c.number} pris en charge.`)}>
                        Prendre en charge
                      </McButton>
                    )}
                    <McButton size="sm" variant="ok" disabled={busy === c.id}
                              onClick={() => setClosing({ caseItem: c, mode: 'resolved' })}>
                      Résoudre
                    </McButton>
                    <McButton size="sm" variant="ghost" disabled={busy === c.id}
                              onClick={() => setClosing({ caseItem: c, mode: 'dismissed' })}>
                      Écarter
                    </McButton>
                    {isAdmin && (
                      <select className="fld-mc ml-auto" value={c.assignee_membership_id || ''}
                              onChange={(e) => act(() => casesAPI.assign(c.id, e.target.value || null),
                                                   c.id, `Cas ${c.number} réattribué.`)}>
                        <option value="">Non assigné</option>
                        {team.filter((m) => m.status === 'active').map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {c.resolution_note && (
                  <LiveText as="div" style={{ fontSize: 11, color: MC.ink3, marginTop: 8, fontStyle: 'italic' }}>
                    {`« ${c.resolution_note} »`}
                  </LiveText>
                )}
              </div>
            </Rise>
          );
        })}
      </div>

      {closing && (
        <CloseCaseModal caseItem={closing.caseItem} mode={closing.mode}
                        onCancel={() => setClosing(null)}
                        onConfirm={async (note) => {
                          const c = closing.caseItem, mode = closing.mode;
                          setClosing(null);
                          await act(() => casesAPI.setStatus(c.id, mode, note), c.id,
                                    mode === 'resolved' ? `Cas ${c.number} résolu.` : `Cas ${c.number} écarté.`);
                        }} />
      )}

      <style>{`.fld-mc{border:1px solid ${MC.stroke};border-radius:10px;padding:6px 10px;font-size:12px;color:${MC.ink};background:rgba(255,255,255,.05);outline:none}.fld-mc:focus{border-color:${MC.indigo}}.fld-mc option{background:#0D1428;color:${MC.ink}}.fld-mc::placeholder{color:${MC.ink3}}`}</style>
    </CabinetShell>
  );
}
