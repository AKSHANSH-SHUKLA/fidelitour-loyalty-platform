import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, RefreshCw, Clock } from 'lucide-react';
import { casesAPI, cabinetOsAPI } from '../lib/api';
import LiveText from '../components/LiveText';

/**
 * CabinetCases — the Exception Centre.
 *
 * WHY IT LOOKS LIKE A QUEUE, NOT AN INBOX
 *   The failure mode this replaces is an email nobody owns. So every row must
 *   answer four questions at a glance: what broke, for which client, WHOSE job
 *   it is, and by when. Sorting is overdue-first, then severity, then age —
 *   the order a person should actually work in, not the order things arrived.
 */

const STATUS = {
  open: { label: 'Ouvert', c: '#C0392B', bg: 'rgba(192,57,43,.12)' },
  in_progress: { label: 'En cours', c: '#B8860B', bg: 'rgba(184,134,11,.12)' },
  resolved: { label: 'Résolu', c: '#2F7A52', bg: 'rgba(63,156,107,.12)' },
  dismissed: { label: 'Écarté', c: '#8B8680', bg: 'rgba(139,134,128,.12)' },
};

export default function CabinetCases() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [team, setTeam] = useState([]);
  const [me, setMe] = useState(null);
  const [filter, setFilter] = useState({ status: 'open', assignee: '' });
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

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

  const close = (c, status) => {
    // A dismissal must carry a reason: "we chose not to act" is exactly the
    // decision someone will question months later.
    const note = status === 'dismissed'
      ? window.prompt('Motif (obligatoire pour écarter un cas) :')
      : window.prompt('Note de résolution (optionnel) :') || '';
    if (status === 'dismissed' && !note) return;
    act(() => casesAPI.setStatus(c.id, status, note), c.id,
        status === 'resolved' ? `Cas ${c.number} résolu.` : `Cas ${c.number} écarté.`);
  };

  const counts = data?.counts || {};
  const isAdmin = me?.membership?.role === 'admin';

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(1200px 500px at 85% -10%, rgba(192,57,43,.05), transparent 60%), #FBF7EF',
    }}>
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/cabinet')} className="text-[#57534E] hover:text-[#1C1917] mr-1">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#C0392B,#8A1F14)' }}>
            <AlertTriangle size={16} color="#fff" />
          </div>
          <span className="font-bold text-[#1C1917]">Centre d'exceptions</span>
        </div>
        <button onClick={load} className="text-[#8B8680] hover:text-[#1C1917]"><RefreshCw size={16} /></button>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16">
        {toast && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-sm border"
               style={toast.ok
                 ? { background: 'rgba(63,156,107,.10)', borderColor: 'rgba(63,156,107,.35)', color: '#2F7A52' }
                 : { background: 'rgba(192,57,43,.08)', borderColor: 'rgba(192,57,43,.30)', color: '#C0392B' }}>
            <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl bg-white border p-4 text-center" style={{ borderColor: '#ECE3D2' }}>
            <LiveText as="div" className="text-2xl font-extrabold" style={{ color: '#C0392B' }}>
              {String(counts.open ?? 0)}
            </LiveText>
            <div className="text-[11px] text-[#8B8680] mt-0.5">Cas ouverts</div>
          </div>
          <div className="rounded-2xl bg-white border p-4 text-center" style={{ borderColor: '#ECE3D2' }}>
            <LiveText as="div" className="text-2xl font-extrabold"
                      style={{ color: counts.overdue ? '#C0392B' : '#2F7A52' }}>
              {String(counts.overdue ?? 0)}
            </LiveText>
            <div className="text-[11px] text-[#8B8680] mt-0.5">En retard</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <select className="fld-sm" value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="open">Ouverts</option>
            <option value="resolved">Résolus</option>
            <option value="dismissed">Écartés</option>
            <option value="">Tous</option>
          </select>
          <select className="fld-sm" value={filter.assignee}
                  onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}>
            <option value="">Tout le monde</option>
            <option value="me">Mes cas</option>
            {isAdmin && team.filter((m) => m.status === 'active').map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5">
          {(data?.cases || []).length === 0 ? (
            <div className="rounded-3xl bg-white border px-5 py-12 text-center text-sm text-[#8B8680]"
                 style={{ borderColor: '#ECE3D2' }}>
              Aucun cas — tout est traité. 🎉
            </div>
          ) : data.cases.map((c) => {
            const st = STATUS[c.status] || STATUS.open;
            const isOpen = ['open', 'in_progress'].includes(c.status);
            return (
              <div key={c.id} className="rounded-2xl bg-white border p-4"
                   style={{ borderColor: c.overdue ? 'rgba(192,57,43,.4)' : '#ECE3D2' }}>
                <div className="flex items-start gap-3 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: c.severity === 'red' ? '#C0392B' : '#E0A92B' }} />
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-[#8B8680]">{c.number}</span>
                      <LiveText className="font-bold text-[#1C1917]">{c.title_fr}</LiveText>
                      <LiveText className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ color: st.c, background: st.bg }}>{st.label}</LiveText>
                      {c.overdue && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                              style={{ color: '#C0392B', background: 'rgba(192,57,43,.12)' }}>
                          <Clock size={10} /> En retard
                        </span>
                      )}
                      {c.occurrences > 1 && (
                        <span className="text-[10px] text-[#8B8680]">×{c.occurrences}</span>
                      )}
                    </div>
                    {c.detail_fr && (
                      <LiveText as="div" className="text-sm text-[#57534E] mt-0.5">{c.detail_fr}</LiveText>
                    )}
                    <div className="text-[11px] text-[#8B8680] mt-1">
                      <LiveText>{`${c.client_name || '—'} · ${c.assignee_name || 'non assigné'} · échéance ${c.due_date || '—'}`}</LiveText>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#F2ECE0' }}>
                    {c.status === 'open' && (
                      <button disabled={busy === c.id}
                              onClick={() => act(() => casesAPI.setStatus(c.id, 'in_progress'), c.id,
                                                 `Cas ${c.number} pris en charge.`)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                              style={{ background: '#B8860B' }}>
                        Prendre en charge
                      </button>
                    )}
                    <button disabled={busy === c.id} onClick={() => close(c, 'resolved')}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                            style={{ background: '#2F7A52' }}>
                      Résoudre
                    </button>
                    <button disabled={busy === c.id} onClick={() => close(c, 'dismissed')}
                            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                            style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
                      Écarter
                    </button>
                    {isAdmin && (
                      <select className="fld-sm ml-auto" value={c.assignee_membership_id || ''}
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
                  <div className="text-[11px] text-[#8B8680] mt-2 italic">« {c.resolution_note} »</div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <style>{`.fld-sm{border:1px solid #E7E1D5;border-radius:10px;padding:6px 10px;font-size:12px;color:#1C1917;background:#FCFAF5;outline:none}.fld-sm:focus{border-color:#C0392B}`}</style>
    </div>
  );
}
