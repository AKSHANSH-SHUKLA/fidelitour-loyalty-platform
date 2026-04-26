import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Palette, Coins, Award } from 'lucide-react';
import { adminAPI } from '../lib/api';
import { AuchanEditor, DEFAULT_LAYOUT } from '../components/AuchanCard';
import NumberInput from '../components/NumberInput';

const DEFAULT_RULES = {
  points_per_visit: 10,
  visits_per_stamp: 1,
  reward_threshold_stamps: 10,
  reward_description: 'Un café gratuit',
  notify_before_reward: 1,
};

export default function AdminCardDesignerPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [serverTemplate, setServerTemplate] = useState(null);
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
        const tplData = r.data || {};
        setServerTemplate(tplData);
        const saved = tplData.auchan_layout;
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
        setRules({
          points_per_visit: tplData.points_per_visit ?? DEFAULT_RULES.points_per_visit,
          visits_per_stamp: tplData.visits_per_stamp ?? DEFAULT_RULES.visits_per_stamp,
          reward_threshold_stamps: tplData.reward_threshold_stamps ?? DEFAULT_RULES.reward_threshold_stamps,
          reward_description: tplData.reward_description ?? DEFAULT_RULES.reward_description,
          notify_before_reward: tplData.notify_before_reward ?? DEFAULT_RULES.notify_before_reward,
        });
      })
      .catch(() => {
        setLayout(DEFAULT_LAYOUT);
        setRules(DEFAULT_RULES);
        setServerTemplate(null);
      });
  }, [selectedId]);

  const updateRule = (key, val) => {
    setRules((r) => {
      const next = { ...r, [key]: val };
      if (key === 'reward_threshold_stamps') {
        setLayout((L) => ({ ...L, stamps_target: Math.max(1, parseInt(val, 10) || 1) }));
      }
      return next;
    });
  };

  const flash = (type, msg) => {
    if (type === 'ok') { setOk(msg); setErr(''); }
    else { setErr(msg); setOk(''); }
    setTimeout(() => { setOk(''); setErr(''); }, 3000);
  };

  // Robust error-string extraction. Backends return validation errors as
  // arrays/objects; concatenating them onto a string yields "[object Object]"
  // which tells the user nothing. Stringify properly.
  const errMsg = (e) => {
    const d = e?.response?.data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join('; ');
    if (d && typeof d === 'object') return JSON.stringify(d);
    if (e?.response?.status === 413) return 'Payload too large — your image is over the upload limit. Try a smaller / more compressed banner.';
    if (e?.response?.statusText) return `${e.response.status} ${e.response.statusText}`;
    return e?.message || 'Unknown error';
  };

  const save = async () => {
    if (!selectedId) {
      flash('err', 'Pick a business first');
      return;
    }
    setSaving(true);
    try {
      // Compose the full template — preserve existing fields, override with edits
      const payload = {
        ...(serverTemplate || {}),
        auchan_layout: layout,
        points_per_visit: Math.max(0, parseInt(rules.points_per_visit, 10) || 0),
        visits_per_stamp: Math.max(1, parseInt(rules.visits_per_stamp, 10) || 1),
        reward_threshold_stamps: Math.max(1, parseInt(rules.reward_threshold_stamps, 10) || 1),
        reward_description: (rules.reward_description || '').trim() || 'Reward',
        notify_before_reward: Math.max(0, parseInt(rules.notify_before_reward, 10) || 0),
      };
      delete payload._id;
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 4_000_000) {
        flash('err', `Your card design is ${(payloadSize / 1_048_576).toFixed(1)} MB — too large to save (limit ~4 MB). Use smaller images or upload them as URLs hosted elsewhere.`);
        setSaving(false);
        return;
      }
      const res = await adminAPI.saveCardTemplate(selectedId, payload);
      if (res?.data) setServerTemplate(res.data);
      flash('ok', 'Card design + loyalty rules saved.');
    } catch (e) {
      flash('err', 'Save failed: ' + errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const totalVisitsForReward = Math.max(1, parseInt(rules.visits_per_stamp, 10) || 1) *
    Math.max(1, parseInt(rules.reward_threshold_stamps, 10) || 1);
  const pointsPerReward = Math.max(0, parseInt(rules.points_per_visit, 10) || 0) * totalVisitsForReward;

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

      {/* Loyalty Rules — admin-side mirror of the owner panel. Same fields,
          drives scan + reward logic for whichever business is selected. */}
      {selectedId && (
        <div className="rounded-xl border-2 border-[#E3A869] bg-[#FEF9E7] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-[#7B3F00]" />
            <h2 className="text-lg font-bold text-[#7B3F00]">
              Loyalty Rules — what customers earn at this business
            </h2>
          </div>
          <p className="text-xs text-[#7B3F00]/80 -mt-2">
            These numbers control the scan flow and reward unlocks for the selected business.
            The visual stamp count below auto-syncs with the reward threshold.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#7B3F00] uppercase tracking-wider mb-1 block">
                Points awarded per visit
              </label>
              <NumberInput
                min={0}
                max={1000}
                emptyValue={10}
                value={rules.points_per_visit}
                onChange={(n) => updateRule('points_per_visit', n)}
                className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#1C1917]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#7B3F00] uppercase tracking-wider mb-1 block">
                Visits required per stamp
              </label>
              <NumberInput
                min={1}
                max={20}
                emptyValue={1}
                value={rules.visits_per_stamp}
                onChange={(n) => updateRule('visits_per_stamp', n)}
                className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#1C1917]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#7B3F00] uppercase tracking-wider mb-1 block">
                Stamps to unlock the reward
              </label>
              <NumberInput
                min={1}
                max={20}
                emptyValue={10}
                value={rules.reward_threshold_stamps}
                onChange={(n) => updateRule('reward_threshold_stamps', n)}
                className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#1C1917]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#7B3F00] uppercase tracking-wider mb-1 block">
                Reward description
              </label>
              <input
                type="text"
                maxLength={120}
                value={rules.reward_description}
                onChange={(e) => updateRule('reward_description', e.target.value)}
                placeholder="e.g. Un café gratuit"
                className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-semibold text-[#1C1917]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-[#7B3F00] uppercase tracking-wider mb-1 block">
                🔔 Send "almost there" push when N visits remain
              </label>
              <p className="text-[11px] text-[#7B3F00]/80 mb-2">
                Auto push fires once when a customer is this many visits away from the reward. Set to <b>0</b> to disable.
              </p>
              <div className="flex items-center gap-3">
                <NumberInput
                  min={0}
                  max={10}
                  emptyValue={0}
                  value={rules.notify_before_reward}
                  onChange={(n) => updateRule('notify_before_reward', n)}
                  className="w-24 px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#1C1917]"
                />
                <div className="flex items-center gap-2 text-xs text-[#7B3F00]">
                  {[0, 1, 2, 3].map((preset) => {
                    const active = parseInt(rules.notify_before_reward, 10) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateRule('notify_before_reward', preset)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                          active ? 'bg-[#B85C38] text-white' : 'bg-white border border-[#E3A869]/60 hover:bg-[#FEF9E7]'
                        }`}
                      >
                        {preset === 0 ? 'Off' : `${preset} visit${preset > 1 ? 's' : ''} away`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-[#7B3F00] text-white p-4 flex items-start gap-3">
            <Award size={18} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">In plain English:</p>
              <p className="opacity-95">
                Customers earn <b>{rules.points_per_visit} points</b> per visit.
                {' '}After <b>{totalVisitsForReward} visit{totalVisitsForReward === 1 ? '' : 's'}</b>
                {' '}({rules.reward_threshold_stamps} stamp{rules.reward_threshold_stamps === 1 ? '' : 's'} ·
                {' '}{rules.visits_per_stamp} visit{rules.visits_per_stamp === 1 ? '' : 's'} per stamp)
                {' '}they unlock <b>"{rules.reward_description}"</b> — having earned <b>{pointsPerReward} points</b> along the way.
                {parseInt(rules.notify_before_reward, 10) > 0 && (
                  <>
                    {' '}🔔 When they're <b>{rules.notify_before_reward} visit{parseInt(rules.notify_before_reward, 10) === 1 ? '' : 's'}</b> away,
                    {' '}an automatic "almost there!" push lands on their phone.
                  </>
                )}
              </p>
            </div>
          </div>
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
