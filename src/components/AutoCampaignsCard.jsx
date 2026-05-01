import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Cake, BellOff, Play, Save, Eye, Coffee } from 'lucide-react';
import { C as C_PS } from './PageShell';

/**
 * Drop-in card for SettingsPage: configure auto-generated messages for
 * birthdays and inactive customers. Talks to features/auto_campaigns.py.
 *
 * "Run now (dry-run)" lets the owner preview exactly which customers would
 * be messaged and what they'd say, before any real send.
 */
const AutoCampaignsCard = () => {
  const [cfg, setCfg] = useState({
    birthday_enabled: true,
    birthday_message: '',
    birthday_bonus_points: 50,
    inactive_enabled: true,
    inactive_message: '',
    inactive_trigger_days: 0,
    inactive_cooldown_days: 30,
    almost_there_enabled: true,
    almost_there_message: '',
    almost_there_visits_left: 1,
    almost_there_cooldown_days: 7,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [running, setRunning] = useState(null);   // 'birthdays' | 'inactive' | null
  const [previews, setPreviews] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/owner/auto-campaigns/config');
      setCfg(res.data);
    } catch (e) { console.error('auto-campaigns load failed', e); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/owner/auto-campaigns/config', cfg);
      setSavedAt(new Date());
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const ENDPOINTS = {
    birthdays:    '/owner/auto-campaigns/run-birthdays',
    inactive:     '/owner/auto-campaigns/run-inactive',
    almost_there: '/owner/auto-campaigns/run-almost-there',
  };

  const runDry = async (which) => {
    setRunning(which); setPreviews(null);
    try {
      const res = await api.post(ENDPOINTS[which], null, { params: { dry_run: true } });
      setPreviews({ which, ...res.data });
    } catch (e) {
      alert('Dry-run failed: ' + (e?.response?.data?.detail || e.message));
    } finally { setRunning(null); }
  };

  const sendNow = async (which) => {
    if (!window.confirm(`Really send ${which} messages now? This is a real send.`)) return;
    setRunning(which);
    try {
      const res = await api.post(ENDPOINTS[which]);
      alert(`${res.data.sent} message${res.data.sent === 1 ? '' : 's'} sent.`);
      setPreviews(null);
    } catch (e) {
      alert('Send failed: ' + (e?.response?.data?.detail || e.message));
    } finally { setRunning(null); }
  };

  return (
    <div className="rounded-xl bg-white p-6 mt-6" style={{ border: `1px solid ${C_PS.hairline}` }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${C_PS.terracotta}1A`, color: C_PS.terracotta }}>
          <Cake size={18} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: C_PS.inkDeep }}>
            Automatic messages
          </h2>
          <p className="text-sm mt-1" style={{ color: C_PS.inkMute }}>
            Birthday wishes and inactive-customer rescue messages — generated automatically from templates and your customer data.
            Available variables: <code>{'{first_name} {name} {business_name} {tier} {points} {visits}'}</code>
          </p>
        </div>
      </div>

      {/* Birthday block */}
      <Section
        title="Birthday wishes"
        enabled={cfg.birthday_enabled}
        onToggle={(v) => setCfg({ ...cfg, birthday_enabled: v })}
        icon={Cake}
      >
        <Field label="Message template" type="textarea"
          value={cfg.birthday_message}
          onChange={(v) => setCfg({ ...cfg, birthday_message: v })} />
        <Field label="Bonus points to credit" suffix="points" type="number"
          value={cfg.birthday_bonus_points}
          onChange={(v) => setCfg({ ...cfg, birthday_bonus_points: parseInt(v || '0', 10) })}
          hint="0 = no bonus, just the message." />
        <RunButtons which="birthdays" running={running} onDry={runDry} onSend={sendNow} disabled={!cfg.birthday_enabled} />
      </Section>

      {/* Inactive block */}
      <Section
        title="Inactive-customer rescue"
        enabled={cfg.inactive_enabled}
        onToggle={(v) => setCfg({ ...cfg, inactive_enabled: v })}
        icon={BellOff}
      >
        <Field label="Message template" type="textarea"
          value={cfg.inactive_message}
          onChange={(v) => setCfg({ ...cfg, inactive_message: v })} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Trigger after silence of" suffix="days" type="number"
            value={cfg.inactive_trigger_days}
            onChange={(v) => setCfg({ ...cfg, inactive_trigger_days: parseInt(v || '0', 10) })}
            hint="0 = use the dormant threshold from your customer-status definition." />
          <Field label="Cool-down between sends" suffix="days" type="number"
            value={cfg.inactive_cooldown_days}
            onChange={(v) => setCfg({ ...cfg, inactive_cooldown_days: parseInt(v || '0', 10) })}
            hint="Don't message the same person more often than this." />
        </div>
        <RunButtons which="inactive" running={running} onDry={runDry} onSend={sendNow} disabled={!cfg.inactive_enabled} />
      </Section>

      {/* Almost-there block — nudge customers one visit away from the next reward */}
      <Section
        title="Almost there — one visit from a reward"
        enabled={cfg.almost_there_enabled}
        onToggle={(v) => setCfg({ ...cfg, almost_there_enabled: v })}
        icon={Coffee}
      >
        <Field label="Message template" type="textarea"
          value={cfg.almost_there_message}
          onChange={(v) => setCfg({ ...cfg, almost_there_message: v })} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Trigger when this many visits remain" suffix="visit(s)" type="number"
            value={cfg.almost_there_visits_left}
            onChange={(v) => setCfg({ ...cfg, almost_there_visits_left: parseInt(v || '1', 10) })}
            hint="1 = 'one more visit and the reward is yours'." />
          <Field label="Cool-down between sends" suffix="days" type="number"
            value={cfg.almost_there_cooldown_days}
            onChange={(v) => setCfg({ ...cfg, almost_there_cooldown_days: parseInt(v || '0', 10) })}
            hint="Avoid spamming the same person on repeat cycles." />
        </div>
        <RunButtons which="almost_there" running={running} onDry={runDry} onSend={sendNow} disabled={!cfg.almost_there_enabled} />
      </Section>

      <div className="flex items-center gap-3 mt-6">
        <button type="button" onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
          style={{ background: C_PS.terracotta }}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save configuration'}
        </button>
        {savedAt && <span className="text-xs" style={{ color: C_PS.inkMute }}>Saved {savedAt.toLocaleTimeString()}</span>}
      </div>

      {previews && (
        <div className="mt-5 pt-5 border-t" style={{ borderColor: C_PS.hairline }}>
          <p className="text-[10px] uppercase font-bold tracking-widest mb-2" style={{ color: C_PS.inkMute }}>
            Dry-run preview — {previews.which === 'birthdays' ? 'birthdays today' : 'inactive customers'}
          </p>
          <p className="text-sm mb-3" style={{ color: C_PS.inkDeep }}>
            <Eye size={14} className="inline mr-1" />
            {previews.found ?? previews.candidates ?? 0} candidate{((previews.found ?? previews.candidates ?? 0) === 1) ? '' : 's'} — {(previews.preview || []).length} would receive a message.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(previews.preview || []).map((p) => (
              <div key={p.customer_id} className="rounded-lg p-3 text-sm" style={{ background: '#F3EFE7' }}>
                <p className="font-semibold" style={{ color: C_PS.inkDeep }}>{p.name}</p>
                <p style={{ color: C_PS.inkSoft }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({ title, enabled, onToggle, icon: Icon, children }) => (
  <div className="mb-5 pb-5 last:mb-0 last:pb-0 last:border-b-0 border-b" style={{ borderColor: C_PS.hairline }}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-[#B85C38]" />
        <h3 className="font-bold" style={{ color: C_PS.inkDeep }}>{title}</h3>
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4" />
        <span style={{ color: C_PS.inkMute }}>{enabled ? 'Enabled' : 'Disabled'}</span>
      </label>
    </div>
    <div className={`space-y-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>{children}</div>
  </div>
);

const Field = ({ label, value, onChange, type = 'text', suffix, hint }) => (
  <div>
    <label className="text-xs font-bold uppercase tracking-widest mb-1 block" style={{ color: C_PS.inkMute }}>{label}</label>
    {type === 'textarea' ? (
      <textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: C_PS.hairline }} />
    ) : (
      <div className="flex items-center gap-2">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: C_PS.hairline }} />
        {suffix && <span className="text-xs font-semibold shrink-0" style={{ color: C_PS.inkMute }}>{suffix}</span>}
      </div>
    )}
    {hint && <p className="text-[11px] mt-1" style={{ color: C_PS.inkMute }}>{hint}</p>}
  </div>
);

const RunButtons = ({ which, running, onDry, onSend, disabled }) => (
  <div className="flex gap-2 pt-1">
    <button type="button" onClick={() => onDry(which)} disabled={disabled || !!running}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
      style={{ background: 'white', color: C_PS.terracotta, border: `1px solid ${C_PS.terracotta}55` }}>
      <Eye size={12} /> {running === which ? 'Running…' : 'Preview (dry-run)'}
    </button>
    <button type="button" onClick={() => onSend(which)} disabled={disabled || !!running}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
      style={{ background: C_PS.terracotta }}>
      <Play size={12} /> Send now
    </button>
  </div>
);

export default AutoCampaignsCard;
