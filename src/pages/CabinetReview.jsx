import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { comptableAPI, facturationAPI, cabinetOsAPI } from '../lib/api';
import LiveText from '../components/LiveText';

/**
 * CabinetReview — the review queue (route: /cabinet/revue).
 *
 * THE LAB TRAY, NOT THE ARCHIVE
 *   Before this page, "reviewing" meant opening every dossier and hunting for
 *   what was pending — which in practice means it never happens. Here every
 *   invoice whose review is unfinished lands in ONE list, oldest first (the
 *   order a reviewer should actually work in), each row naming its preparer.
 *
 * FOUR-EYES, VISIBLY
 *   If validating a row would violate the seuil rule FOR ME (I prepared it
 *   and it is at/above the cabinet threshold), the button is disabled with
 *   the reason — the rule teaches itself instead of bouncing a click.
 */
export default function CabinetReview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [seuilDraft, setSeuilDraft] = useState('');

  const load = useCallback(async () => {
    const [q, m] = await Promise.all([
      comptableAPI.reviewQueue().catch(() => null),
      cabinetOsAPI.me().catch(() => null),
    ]);
    setData(q?.data || { queue: [], count: 0, seuil: 1000 });
    setMe(m?.data || null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (ok, msg) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 6000); };

  const act = async (inv, target) => {
    setBusy(inv.id);
    try {
      await facturationAPI.setReview(inv.id, { target });
      flash(true, target === 'validated'
        ? `Facture ${inv.number} validée.`
        : `Correction demandée pour ${inv.number}.`);
      await load();
    } catch (e) {
      flash(false, e?.response?.data?.detail || 'Action impossible.');
    } finally { setBusy(null); }
  };

  const saveSeuil = async () => {
    try {
      await cabinetOsAPI.updateSettings({ review_threshold_eur: parseFloat(seuilDraft) });
      flash(true, `Seuil quatre-yeux mis à jour : ${seuilDraft} €.`);
      setSeuilDraft('');
      await load();
    } catch (e) {
      flash(false, e?.response?.data?.detail || 'Modification impossible.');
    }
  };

  const isEC = ['admin', 'expert_comptable'].includes(me?.membership?.role);
  const canValidate = me?.can?.validate;

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(1200px 500px at 85% -10%, rgba(47,122,82,.06), transparent 60%), #FBF7EF',
    }}>
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/cabinet')} className="text-[#57534E] hover:text-[#1C1917] mr-1">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#2F7A52,#1D4D33)' }}>
            <CheckCircle2 size={16} color="#fff" />
          </div>
          <span className="font-bold text-[#1C1917]">À valider</span>
          {data && (
            <LiveText className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: '#2F7A52', background: 'rgba(63,156,107,.12)' }}>
              {String(data.count)}
            </LiveText>
          )}
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

        {/* four-eyes policy strip */}
        <div className="rounded-2xl bg-white border px-4 py-3 mb-5 flex items-center gap-3 flex-wrap"
             style={{ borderColor: '#ECE3D2' }}>
          <ShieldAlert size={16} style={{ color: '#B8860B' }} />
          <div className="text-xs text-[#57534E] flex-1 min-w-[220px]">
            <LiveText>
              {`Règle des quatre yeux : au-delà de ${data?.seuil ?? 1000} € TTC, une facture doit être validée par une autre personne que celle qui l'a préparée. En dessous, l'auto-validation est autorisée mais marquée dans l'historique.`}
            </LiveText>
          </div>
          {isEC && (
            <div className="flex items-center gap-2">
              <input className="fld-sm w-24" placeholder={String(data?.seuil ?? 1000)}
                     value={seuilDraft} onChange={(e) => setSeuilDraft(e.target.value)} />
              <button onClick={saveSeuil} disabled={!seuilDraft}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                      style={{ background: '#2F7A52' }}>
                Changer le seuil
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {(data?.queue || []).length === 0 ? (
            <div className="rounded-3xl bg-white border px-5 py-12 text-center text-sm text-[#8B8680]"
                 style={{ borderColor: '#ECE3D2' }}>
              Rien à valider — la corbeille est vide. 🎉
            </div>
          ) : data.queue.map((inv) => (
            <div key={inv.id} className="rounded-2xl bg-white border p-4"
                 style={{ borderColor: inv.four_eyes_blocked_for_me ? 'rgba(184,134,11,.45)' : '#ECE3D2' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#1C1917]">{inv.number}</span>
                    <LiveText className="text-xs text-[#57534E]">{inv.client_name || ''}</LiveText>
                    <span className="text-xs font-semibold text-[#1C1917]">
                      {Number(inv.total_ttc).toLocaleString('fr-FR')} € TTC
                    </span>
                    {inv.four_eyes_blocked_for_me && (
                      <LiveText className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ color: '#B8860B', background: 'rgba(184,134,11,.12)' }}>
                        Quatre yeux — préparée par vous
                      </LiveText>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8B8680] mt-0.5">
                    <LiveText>{`Préparée par ${inv.created_by_label || inv.created_by || '—'} · ${inv.date || ''} · statut PA : ${inv.pa_status || '—'}`}</LiveText>
                  </div>
                </div>
                {canValidate && (
                  <div className="flex gap-2">
                    <button disabled={busy === inv.id || inv.four_eyes_blocked_for_me}
                            title={inv.four_eyes_blocked_for_me
                              ? 'Vous avez préparé cette facture — un autre validateur est requis.' : ''}
                            onClick={() => act(inv, 'validated')}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                            style={{ background: '#2F7A52' }}>
                      Valider
                    </button>
                    <button disabled={busy === inv.id}
                            onClick={() => act(inv, 'correction_required')}
                            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                            style={{ borderColor: 'rgba(192,57,43,.4)', color: '#C0392B' }}>
                      Demander correction
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`.fld-sm{border:1px solid #E7E1D5;border-radius:10px;padding:6px 10px;font-size:12px;color:#1C1917;background:#FCFAF5;outline:none}.fld-sm:focus{border-color:#2F7A52}`}</style>
    </div>
  );
}
