import React, { useState, useEffect } from 'react';
import { Save, Send, CheckCircle, AlertCircle, Palette } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import { AuchanEditor, DEFAULT_LAYOUT } from '../components/AuchanCard';

export default function CardDesignerPage() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [tenant, setTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [t, tpl] = await Promise.all([ownerAPI.getTenant(), ownerAPI.getCardTemplate()]);
        setTenant(t.data || null);
        const saved = tpl?.data?.auchan_layout;
        if (saved && typeof saved === 'object') {
          setLayout({
            ...DEFAULT_LAYOUT,
            ...saved,
            slots: { ...DEFAULT_LAYOUT.slots, ...(saved.slots || {}) },
            push: { ...DEFAULT_LAYOUT.push, ...(saved.push || {}) },
          });
        }
      } catch (e) {
        /* defaults are fine */
      }
    })();
  }, []);

  const flash = (type, msg) => {
    if (type === 'ok') { setOk(msg); setErr(''); }
    else { setErr(msg); setOk(''); }
    setTimeout(() => { setOk(''); setErr(''); }, 3000);
  };

  const save = async () => {
    setSaving(true);
    try {
      await ownerAPI.saveCardTemplate({ auchan_layout: layout });
      flash('ok', 'Card design saved.');
    } catch (e) {
      flash('err', 'Save failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const sendPush = async () => {
    setPushing(true);
    try {
      await ownerAPI.sendCardNotification({
        type: 'offer',
        title: layout.push?.title || tenant?.business_name || 'Nouvelle offre',
        body: layout.push?.body || '',
      });
      flash('ok', 'Push sent to all your customers.');
    } catch (e) {
      flash('err', 'Push failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setPushing(false);
    }
  };

  const ctx = {
    first_name: 'Sophie',
    name: 'Sophie Dupont',
    points: '3.4',
    loyalty_number: '049130960',
    business_name: tenant?.business_name || 'Mon commerce',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1917] flex items-center gap-2">
            <Palette size={22} /> Card Designer
          </h1>
          <p className="text-sm text-[#6B7280]">
            Fixed Auchan-style layout — edit every text, font, size, color, style and placement.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={sendPush}
            disabled={pushing}
            className="px-4 py-2 rounded-lg bg-white border border-[#B85C38] text-[#B85C38] text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={15} /> {pushing ? 'Sending…' : 'Send push now'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#B85C38] text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? 'Saving…' : 'Save card design'}
          </button>
        </div>
      </div>

      {ok && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-2 text-sm flex items-center gap-2">
          <CheckCircle size={15} /> {ok}
        </div>
      )}
      {err && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm flex items-center gap-2">
          <AlertCircle size={15} /> {err}
        </div>
      )}

      <AuchanEditor
        layout={layout}
        onChange={setLayout}
        ctx={ctx}
        businessName={tenant?.business_name}
      />
    </div>
  );
}
