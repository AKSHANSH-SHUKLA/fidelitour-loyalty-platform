import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Send, X, Pencil, ShieldCheck, Inbox, CheckCircle2 } from 'lucide-react';
import { C as C_PS } from './PageShell';
import PhonePushPreview from './PhonePushPreview';

/**
 * PendingAutoRunsCard — review queue for auto-campaigns the cron prepared.
 *
 * Each pending row corresponds to one batch (e.g. "23 birthdays today",
 * "8 inactive customers"). Owner can:
 *   • Edit the title + body template before sending
 *   • Approve to actually fire the messages
 *   • Skip to discard the batch
 *
 * Until the owner clicks Approve, NOTHING leaves the server.
 */
const KIND_LABEL = {
  birthday: '🎂 Birthday wishes',
  inactive_rescue: '👋 Inactive rescue',
  almost_there: '🎁 Almost there',
};

const PendingAutoRunsCard = ({ id }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); // { [runId]: 'approve' | 'skip' | 'save' }
  const [edits, setEdits] = useState({}); // { [runId]: { title, body_template } }
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/owner/auto-campaigns/pending');
      setRows(r.data?.pending || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load pending runs');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setBusyFor = (runId, action) => setBusy((b) => ({ ...b, [runId]: action }));
  const clearBusyFor = (runId) => setBusy((b) => { const n = { ...b }; delete n[runId]; return n; });

  const onApprove = async (run) => {
    if (!confirm(`Send to ${run.recipient_count} customer(s) now?`)) return;
    setBusyFor(run.id, 'approve');
    setError('');
    try {
      // If the owner edited inline, save first so the batch ships with the new copy.
      const ed = edits[run.id];
      if (ed && (ed.title !== run.title || ed.body_template !== run.body_template)) {
        await api.put(`/owner/auto-campaigns/pending/${run.id}`, ed);
      }
      const r = await api.post(`/owner/auto-campaigns/pending/${run.id}/approve`);
      alert(`✓ Sent to ${r.data?.sent ?? 0} customer(s).`);
      setEdits((e) => { const n = { ...e }; delete n[run.id]; return n; });
      load();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Approve failed');
    } finally { clearBusyFor(run.id); }
  };

  const onSkip = async (run) => {
    if (!confirm('Discard this batch? It will not be sent.')) return;
    setBusyFor(run.id, 'skip');
    setError('');
    try {
      await api.post(`/owner/auto-campaigns/pending/${run.id}/skip`);
      load();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Skip failed');
    } finally { clearBusyFor(run.id); }
  };

  const onEditField = (runId, field, value, currentRun) => {
    setEdits((e) => ({
      ...e,
      [runId]: { title: currentRun.title, body_template: currentRun.body_template, ...(e[runId] || {}), [field]: value },
    }));
  };
  const onSaveEdit = async (run) => {
    const ed = edits[run.id];
    if (!ed) return;
    setBusyFor(run.id, 'save');
    setError('');
    try {
      await api.put(`/owner/auto-campaigns/pending/${run.id}`, ed);
      load();
      setEdits((e) => { const n = { ...e }; delete n[run.id]; return n; });
    } catch (e) {
      setError(e?.response?.data?.detail || 'Save failed');
    } finally { clearBusyFor(run.id); }
  };

  // Substitute a placeholder for preview using the first recipient's data so
  // the owner sees a realistic message.
  const previewWith = (template, recipient) => {
    if (!template) return '';
    const ctx = {
      first_name: recipient?.first_name || 'Marie',
      name: recipient?.name || 'Marie Dupont',
      business_name: 'Your shop',
      visits_left: 1,
      tier: 'Bronze',
    };
    let out = template;
    Object.entries(ctx).forEach(([k, v]) => { out = out.replaceAll(`{${k}}`, v); });
    return out;
  };

  if (loading) {
    return (
      <section id={id} className="rounded-2xl p-6 bg-white border" style={{ borderColor: C_PS.hairline }}>
        <p className="text-sm" style={{ color: C_PS.inkMute }}>Loading pending auto-runs…</p>
      </section>
    );
  }

  return (
    <section id={id} className="rounded-2xl p-6 bg-white border space-y-4"
             style={{ borderColor: C_PS.hairline, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }}>
      <header>
        <h2 className="text-2xl font-semibold flex items-center gap-2"
            style={{ fontFamily: 'Cormorant Garamond', color: C_PS.inkDeep }}>
          <Inbox size={20} style={{ color: C_PS.terracotta }} /> Auto-campagnes en attente
        </h2>
        <p className="text-sm mt-1" style={{ color: C_PS.inkMute }}>
          Le système prépare chaque jour les envois automatiques (anniversaires, relances, presque-récompense),
          mais <b>rien ne part avant votre validation</b>. Relisez chaque lot, modifiez si besoin, puis approuvez.
        </p>
      </header>

      {error && <p className="text-xs" style={{ color: C_PS.terracotta }}>⚠ {error}</p>}

      {rows.length === 0 ? (
        <div className="rounded-xl p-6 flex flex-col items-center justify-center text-center"
             style={{ background: 'var(--flc-paper2, #FAFAF8)', border: `1px dashed ${C_PS.hairline}` }}>
          <CheckCircle2 size={28} style={{ color: C_PS.sage }} />
          <p className="text-sm font-bold mt-2" style={{ color: C_PS.inkDeep }}>Tout est à jour</p>
          <p className="text-xs mt-1" style={{ color: C_PS.inkMute }}>
            Aucun lot en attente. Le prochain cron quotidien préparera les nouveaux envois.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((run) => {
            const ed = edits[run.id] || {};
            const liveTitle = ed.title ?? run.title;
            const liveBody = ed.body_template ?? run.body_template;
            const sample = run.recipients?.[0];
            const isBusy = !!busy[run.id];
            return (
              <div key={run.id} className="rounded-xl border p-4"
                   style={{ borderColor: C_PS.hairline, background: 'var(--flc-paper2, #FAFAF8)' }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C_PS.terracotta }}>
                      {KIND_LABEL[run.kind] || run.kind}
                    </p>
                    <p className="text-sm" style={{ color: C_PS.inkDeep }}>
                      <b>{run.recipient_count}</b> recipient{run.recipient_count > 1 ? 's' : ''} · prepared{' '}
                      {run.prepared_at ? new Date(run.prepared_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
                  {/* Editor */}
                  <div className="min-w-0 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest"
                           style={{ color: C_PS.inkMute }}>Title</label>
                    <input
                      type="text"
                      value={liveTitle}
                      onChange={(e) => onEditField(run.id, 'title', e.target.value, run)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: C_PS.hairline, color: C_PS.inkDeep }}
                    />
                    <label className="text-[10px] font-bold uppercase tracking-widest"
                           style={{ color: C_PS.inkMute }}>Body template</label>
                    <textarea
                      value={liveBody}
                      rows={4}
                      onChange={(e) => onEditField(run.id, 'body_template', e.target.value, run)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: C_PS.hairline, color: C_PS.inkDeep }}
                    />
                    <p className="text-[10px]" style={{ color: C_PS.inkMute }}>
                      Placeholders: <code>{'{first_name}'}</code>, <code>{'{business_name}'}</code>, <code>{'{tier}'}</code>, <code>{'{visits_left}'}</code>
                    </p>
                    <p className="text-xs mt-2" style={{ color: C_PS.inkSoft }}>
                      ➜ Sample for {sample?.name || 'first recipient'}: <i>{previewWith(liveBody, sample)}</i>
                    </p>
                  </div>

                  {/* Phone preview */}
                  <PhonePushPreview
                    businessName="Your shop"
                    title={previewWith(liveTitle, sample)}
                    body={previewWith(liveBody, sample)}
                    primaryColor={C_PS.terracotta}
                    width={190}
                    caption="What recipients will see"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onApprove(run)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: C_PS.terracotta }}
                  >
                    <Send size={13} /> {busy[run.id] === 'approve' ? 'Sending…' : `Approve & send to ${run.recipient_count}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveEdit(run)}
                    disabled={isBusy || !edits[run.id]}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                    style={{ borderColor: C_PS.hairline, color: C_PS.inkSoft }}
                  >
                    <Pencil size={12} /> {busy[run.id] === 'save' ? 'Saving…' : 'Save edit (don\'t send yet)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkip(run)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: '#FCEBEB', color: '#791F1F' }}
                  >
                    <X size={12} /> {busy[run.id] === 'skip' ? 'Skipping…' : 'Skip this batch'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PendingAutoRunsCard;
