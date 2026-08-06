import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { comptableAPI, facturationAPI, cabinetOsAPI } from '../lib/api';
import LiveText from '../components/LiveText';
import CabinetShell from '../components/cabinet/CabinetShell';
import { MC, glass } from '../components/cabinet/mc';
import { Panel, Pill, McButton, Rise } from '../components/cabinet/Primitives';

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
 *
 * It sits inside CabinetShell so the sidebar, the palette and the ambient
 * canvas are the same object as on every other cabinet screen.
 */
export default function CabinetReview() {
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
  const queue = data?.queue || [];

  return (
    <CabinetShell
      title="À valider"
      subtitle="La file de revue du cabinet — la plus ancienne d'abord, c'est l'ordre dans lequel on doit travailler."
      headerRight={
        <>
          {data && <Pill tone={data.count ? 'warn' : 'ok'}>{`${data.count} en attente`}</Pill>}
          <McButton variant="ghost" size="sm" onClick={load} title="Rafraîchir">
            <RefreshCw size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </McButton>
        </>
      }>

      {toast && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm"
             style={toast.ok
               ? { background: 'rgba(61,220,151,.12)', border: '1px solid rgba(61,220,151,.35)', color: MC.green }
               : { background: 'rgba(255,107,107,.10)', border: '1px solid rgba(255,107,107,.35)', color: MC.red }}>
          <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
        </div>
      )}

      {/* four-eyes policy strip — the rule stated where it is enforced */}
      <Panel tone="warn" className="mb-4">
        <div className="flex items-start gap-3 flex-wrap">
          <ShieldAlert size={16} style={{ color: MC.amber, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: MC.ink2, lineHeight: 1.6, flex: 1, minWidth: 240 }}>
            <LiveText>
              {`Règle des quatre yeux : au-delà de ${data?.seuil ?? 1000} € TTC, une facture doit être validée par une autre personne que celle qui l'a préparée. En dessous, l'auto-validation est autorisée mais marquée dans l'historique.`}
            </LiveText>
          </div>
          {isEC && (
            <div className="flex items-center gap-2">
              <input className="fld-mc w-24" placeholder={String(data?.seuil ?? 1000)}
                     value={seuilDraft} onChange={(e) => setSeuilDraft(e.target.value)} />
              <McButton size="sm" onClick={saveSeuil} disabled={!seuilDraft}
                        style={!seuilDraft ? { opacity: .4 } : undefined}>
                Changer le seuil
              </McButton>
            </div>
          )}
        </div>
      </Panel>

      <div className="space-y-2.5">
        {queue.length === 0 ? (
          <Rise>
            <div style={{ ...glass('ok'), padding: '44px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: MC.green, marginBottom: 4 }}>
                Rien à valider
              </div>
              <div style={{ fontSize: 12.5, color: MC.ink3 }}>
                La file est vide — les agents n'ont rien laissé en attente.
              </div>
            </div>
          </Rise>
        ) : queue.map((inv, i) => (
          <Rise key={inv.id} delay={i * 40}>
            <div style={{ ...glass(inv.four_eyes_blocked_for_me ? 'warn' : undefined), padding: 15 }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span key={inv.number} style={{ fontWeight: 700, color: MC.ink, fontSize: 14 }}>{inv.number}</span>
                    <LiveText style={{ fontSize: 12.5, color: MC.ink2 }}>{inv.client_name || ''}</LiveText>
                    <span key={`amt-${inv.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: MC.ink,
                      fontVariantNumeric: 'tabular-nums' }}>
                      {`${Number(inv.total_ttc).toLocaleString('fr-FR')} € TTC`}
                    </span>
                    {inv.four_eyes_blocked_for_me && (
                      <Pill tone="warn">Quatre yeux — préparée par vous</Pill>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MC.ink3, marginTop: 3 }}>
                    <LiveText>{`Préparée par ${inv.created_by_label || inv.created_by || '—'} · ${inv.date || ''} · statut PA : ${inv.pa_status || '—'}`}</LiveText>
                  </div>
                </div>
                {canValidate && (
                  <div className="flex gap-2">
                    <McButton size="sm" variant="ok"
                              disabled={busy === inv.id || inv.four_eyes_blocked_for_me}
                              style={(busy === inv.id || inv.four_eyes_blocked_for_me) ? { opacity: .4 } : undefined}
                              title={inv.four_eyes_blocked_for_me
                                ? 'Vous avez préparé cette facture — un autre validateur est requis.' : ''}
                              onClick={() => act(inv, 'validated')}>
                      Valider
                    </McButton>
                    <McButton size="sm" variant="ghost" disabled={busy === inv.id}
                              style={busy === inv.id ? { opacity: .5 } : { color: MC.red, borderColor: 'rgba(255,107,107,.35)' }}
                              onClick={() => act(inv, 'correction_required')}>
                      Demander correction
                    </McButton>
                  </div>
                )}
              </div>
            </div>
          </Rise>
        ))}
      </div>

      <style>{`.fld-mc{border:1px solid ${MC.stroke};border-radius:10px;padding:6px 10px;font-size:12px;color:${MC.ink};background:rgba(255,255,255,.05);outline:none}.fld-mc:focus{border-color:${MC.indigo}}.fld-mc::placeholder{color:${MC.ink3}}`}</style>
    </CabinetShell>
  );
}
