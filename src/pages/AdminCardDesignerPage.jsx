import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Palette } from 'lucide-react';
import { adminAPI } from '../lib/api';
import { AuchanEditor, DEFAULT_LAYOUT } from '../components/AuchanCard';

export default function AdminCardDesignerPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  // Load tenant list
  useEffect(() => {
    adminAPI.getTenants()
      .then((r) => {
        const list = r.data?.tenants || r.data || [];
        setTenants(list);
        if (list.length && !selectedId) setSelectedId(list[0]._id || list[0].id);
      })
      .catch(() => {});
  }, []);

  // Load template when tenant changes
  useEffect(() => {
    if (!selectedId) return;
    adminAPI.getCardTemplate(selectedId)
      .then((r) => {
        const saved = r.data?.auchan_layout;
        if (saved && typeof saved === 'object') {
          setLayout({
            ...DEFAULT_LAYOUT,
            ...saved,
            slots: { ...DEFAULT_LAYOUT.slots, ...(saved.slots || {}) },
            push: { ...DEFAULT_LAYOUT.push, ...(saved.push || {}) },
          });
        } else {
          setLayout(DEFAULT_LAYOUT);
        }
      })
      .catch(() => setLayout(DEFAULT_LAYOUT));
  }, [selectedId]);

  const flash = (type, msg) => {
    if (type === 'ok') { setOk(msg); setErr(''); }
    else { setErr(msg); setOk(''); }
    setTimeout(() => { setOk(''); setErr(''); }, 3000);
  };

  const save = async () => {
    if (!selectedId) {
      flash('err', 'Pick a business first');
      return;
    }
    setSaving(true);
    try {
      await adminAPI.saveCardTemplate(selectedId, { auchan_layout: layout });
      flash('ok', 'Card design saved for this business.');
    } catch (e) {
      flash('err', 'Save failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const selected = tenants.find((t) => (t._id || t.id) === selectedId);

  const ctx = {
    first_name: 'Sophie',
    name: 'Sophie Dupont',
    points: '3.4',
    loyalty_number: '049130960',
    business_name: selected?.business_name || 'Mon commerce',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1917] flex items-center gap-2">
            <Palette size={22} /> Card Designer
          </h1>
          <p className="text-sm text-[#6B7280]">
            Design a loyalty card for any business — fixed Auchan-style layout, every slot fully editable.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#B85C38] text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={15} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Business</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded px-2 py-2"
        >
          {tenants.map((t) => (
            <option key={t._id || t.id} value={t._id || t.id}>
              {t.business_name || t.name || t.slug || (t._id || t.id)}
            </option>
          ))}
        </select>
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
        businessName={selected?.business_name}
      />
    </div>
  );
}
