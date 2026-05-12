import React, { useState, useEffect } from 'react';
import { Save, Send, CheckCircle, AlertCircle, Palette, Coins, Award, ImagePlus, X, Sliders } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import NumberInput from '../components/NumberInput';
import { PageHeader, C as C_PS } from '../components/PageShell';
import PremiumLoyaltyCard from '../components/PremiumLoyaltyCard';
import PhoneFrame from '../components/PhoneFrame';
import { AuchanEditor, DEFAULT_LAYOUT } from '../components/AuchanCard';

// Defaults for the loyalty rules — kept in sync with the backend CardTemplate model.
const DEFAULT_RULES = {
  points_per_visit: 10,
  visits_per_stamp: 1,
  reward_threshold_stamps: 10,
  reward_description: 'Un café gratuit',
  notify_before_reward: 1,   // Push fires when this-many visits remain
};

// Brand defaults for the premium card preview. These are the fields that
// drive PremiumLoyaltyCard — separate from the Auchan-layout fine-tuning.
const DEFAULT_BRAND = {
  primary_color: '#B85C38',
  secondary_color: '#9C4427',
  accent_color: '#F4D8A8',
  logo_url: '',
  hero_image_url: '',
  title_label: 'Ta carte fidélité',
  points_label: 'Points',
};

// Convert an image File into a base64 data URL. We keep file size in check
// (max 800KB after re-encode) so the card_template doc stays under Mongo's
// 4MB cap even with a hero photograph attached.
function compressImage(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CardDesignerPage() {
  // Loyalty rules — owner-configurable. Stored on the card_template doc itself.
  const [rules, setRules] = useState(DEFAULT_RULES);
  // Brand fields for the premium card surface (logo, hero image, colours).
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  // Auchan layout — fine-tune slot fonts / colours / sizes / visibility.
  // The advanced editor below is the source of truth for the back-of-card
  // detailed text. Casual owners can leave it untouched; power users use
  // it to match the brand exactly.
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  // Whether the advanced editor is expanded. Collapsed by default so the
  // page doesn't overwhelm a first-time owner.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Hold the full server-side template so we don't drop fields on save.
  const [serverTemplate, setServerTemplate] = useState(null);
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
        const tplData = tpl?.data || {};
        setServerTemplate(tplData);
        // Pull rules from the top-level card_template fields
        setRules({
          points_per_visit: tplData.points_per_visit ?? DEFAULT_RULES.points_per_visit,
          visits_per_stamp: tplData.visits_per_stamp ?? DEFAULT_RULES.visits_per_stamp,
          reward_threshold_stamps: tplData.reward_threshold_stamps ?? DEFAULT_RULES.reward_threshold_stamps,
          reward_description: tplData.reward_description ?? DEFAULT_RULES.reward_description,
          notify_before_reward: tplData.notify_before_reward ?? DEFAULT_RULES.notify_before_reward,
        });
        // Pull brand fields (used by the premium card surface)
        setBrand({
          primary_color: tplData.primary_color || DEFAULT_BRAND.primary_color,
          secondary_color: tplData.secondary_color || DEFAULT_BRAND.secondary_color,
          accent_color: tplData.accent_color || DEFAULT_BRAND.accent_color,
          logo_url: tplData.logo_url || '',
          hero_image_url: tplData.hero_image_url || '',
          title_label: tplData.title_label || DEFAULT_BRAND.title_label,
          points_label: tplData.points_label || DEFAULT_BRAND.points_label,
        });
        // Pull advanced layout (Auchan slots, fonts, colours)
        const saved = tplData.auchan_layout;
        if (saved && typeof saved === 'object') {
          setLayout({
            ...DEFAULT_LAYOUT,
            ...saved,
            slots: { ...DEFAULT_LAYOUT.slots, ...(saved.slots || {}) },
            push: { ...DEFAULT_LAYOUT.push, ...(saved.push || {}) },
          });
          // Auto-expand the advanced editor if the owner has previously
          // customised it — they're a power user, save them the click.
          setAdvancedOpen(true);
        }
      } catch (e) {
        /* defaults are fine */
      }
    })();
  }, []);

  const updateRule = (key, val) => {
    setRules((r) => ({ ...r, [key]: val }));
    // Keep the advanced editor's visual stamp count in lockstep with the
    // reward threshold so what the owner sees in the preview matches what
    // the cron actually awards.
    if (key === 'reward_threshold_stamps') {
      setLayout((L) => ({ ...L, stamps_target: Math.max(1, parseInt(val, 10) || 1) }));
    }
  };

  const flash = (type, msg) => {
    if (type === 'ok') { setOk(msg); setErr(''); }
    else { setErr(msg); setOk(''); }
    setTimeout(() => { setOk(''); setErr(''); }, 3000);
  };

  // Convert any backend error into a readable string (objects/arrays were
  // showing as "[object Object]").
  const errMsg = (e) => {
    const d = e?.response?.data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join('; ');
    if (d && typeof d === 'object') return JSON.stringify(d);
    if (e?.response?.status === 413) return 'Payload too large — your image is over the upload limit. Try a smaller banner.';
    if (e?.response?.statusText) return `${e.response.status} ${e.response.statusText}`;
    return e?.message || 'Unknown error';
  };

  const save = async () => {
    setSaving(true);
    try {
      // Build the full card_template payload: server-side fields + the
      // owner-edited layout + the owner-edited rules. We start from the
      // existing serverTemplate so we never drop an admin-set field.
      const payload = {
        ...(serverTemplate || {}),
        // Persist the Auchan advanced layout so power users can fine-tune
        // every text slot. The customer-facing wallet card still uses the
        // PremiumLoyaltyCard (sourced from primary_color / hero_image_url /
        // logo_url / title_label / points_label), so this layout drives the
        // detailed back-of-card view + push presets.
        auchan_layout: layout,
        points_per_visit: Math.max(0, parseInt(rules.points_per_visit, 10) || 0),
        visits_per_stamp: Math.max(1, parseInt(rules.visits_per_stamp, 10) || 1),
        reward_threshold_stamps: Math.max(1, parseInt(rules.reward_threshold_stamps, 10) || 1),
        reward_description: (rules.reward_description || '').trim() || 'Reward',
        notify_before_reward: Math.max(0, parseInt(rules.notify_before_reward, 10) || 0),
        // Brand fields drive the PremiumLoyaltyCard surface in the wallet page.
        primary_color: brand.primary_color || DEFAULT_BRAND.primary_color,
        secondary_color: brand.secondary_color || DEFAULT_BRAND.secondary_color,
        accent_color: brand.accent_color || DEFAULT_BRAND.accent_color,
        logo_url: brand.logo_url || '',
        hero_image_url: brand.hero_image_url || '',
        title_label: (brand.title_label || '').trim() || DEFAULT_BRAND.title_label,
        points_label: (brand.points_label || '').trim() || DEFAULT_BRAND.points_label,
      };
      delete payload._id; // mongo internal field — never round-trip
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 4_000_000) {
        flash('err', `Your card design is ${(payloadSize / 1_048_576).toFixed(1)} MB — too large to save (limit ~4 MB). Use a smaller / more compressed image.`);
        setSaving(false);
        return;
      }
      const res = await ownerAPI.saveCardTemplate(payload);
      // Re-anchor the server template so subsequent saves keep working
      if (res?.data) setServerTemplate(res.data);
      flash('ok', 'Card design + loyalty rules saved.');
    } catch (e) {
      flash('err', 'Save failed: ' + errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  // Live, human-readable summary of how the rules combine.
  const totalVisitsForReward = Math.max(1, parseInt(rules.visits_per_stamp, 10) || 1) *
    Math.max(1, parseInt(rules.reward_threshold_stamps, 10) || 1);
  const pointsPerReward = Math.max(0, parseInt(rules.points_per_visit, 10) || 0) * totalVisitsForReward;

  const sendPush = async () => {
    setPushing(true);
    try {
      await ownerAPI.sendCardNotification({
        type: 'offer',
        title: tenant?.business_name || tenant?.name || 'Nouvelle offre',
        body: `${rules.reward_description ? rules.reward_description + ' ' : ''}vous attend !`,
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
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Visual Design"
        title="Card Designer"
        description="Edit every text, font, color, and placement on the wallet card. Save to push the new look to all customers."
        role="business_owner"
        actions={
          <div className="flex gap-2">
            <button
              onClick={sendPush}
              disabled={pushing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'white', border: `1px solid ${C_PS.terracotta}`, color: C_PS.terracotta }}
            >
              <Send size={14} /> {pushing ? 'Sending…' : 'Send push'}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${C_PS.ochre}, ${C_PS.terracotta})` }}
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save design'}
            </button>
          </div>
        }
      />

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

      {/* Loyalty Rules — these drive the actual scan + reward logic. They're
          separate from the visual design so owners can change "10 visits = 1
          free coffee" → "8 visits = 1 free pastry" in seconds without touching
          the layout. The visual stamps_target auto-syncs with reward_threshold_stamps. */}
      <div className="rounded-xl border-2 border-[#E3A869] bg-[#FEF9E7] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Coins size={20} className="text-[#7B3F00]" />
          <h2 className="text-lg font-bold text-[#7B3F00]">
            Loyalty Rules — what your customers earn
          </h2>
        </div>
        <p className="text-xs text-[#7B3F00]/80 -mt-2">
          These numbers control your scan flow and reward unlocks. Change them and every customer's
          card and progression updates. The visual stamp count below auto-syncs with the reward threshold.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#7B3F00] uppercase tracking-wider mb-1 block">
              Points awarded per visit
            </label>
            <p className="text-[11px] text-[#7B3F00]/80 mb-2">
              How many points each customer gets when staff scans their visit. Default: 10.
            </p>
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
            <p className="text-[11px] text-[#7B3F00]/80 mb-2">
              Usually 1 (every visit = 1 stamp). Set to 2 if you want stamps to feel rarer.
            </p>
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
            <p className="text-[11px] text-[#7B3F00]/80 mb-2">
              How many stamps to fill the card. Default: 10 (the classic café punch card).
            </p>
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
            <p className="text-[11px] text-[#7B3F00]/80 mb-2">
              What customers see they'll earn. Shown on the card and in the unlock notification.
            </p>
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
              When a customer is this many visits away from unlocking the reward, an automatic push
              fires once. Set to <b>1</b> for the classic "one more visit and you get a free coffee!"
              nudge. Set to <b>0</b> to disable.
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
                        active
                          ? 'bg-[#B85C38] text-white'
                          : 'bg-white border border-[#E3A869]/60 hover:bg-[#FEF9E7]'
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

        {/* Live, plain-English summary */}
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

      {/* Premium brand block — drives the new wallet card surface
          (logo, hero image, brand colours, title + points labels). The Auchan
          editor below is for fine-tuning the back-of-card / legacy layout. */}
      <div className="rounded-xl border border-[#E7E5E4] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={20} className="text-[#B85C38]" />
          <h2 className="text-lg font-bold text-[#1C1917]">
            Design premium — logo, image, couleurs
          </h2>
        </div>
        <p className="text-xs text-[#57534E] -mt-2">
          Ces éléments forment la première impression du client quand il ouvre sa carte.
          Un logo net + une belle photo de votre produit + la bonne couleur de marque suffisent à
          faire passer la carte de "site web" à "Apple Wallet".
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
          {/* Editor column */}
          <div className="space-y-5">
            {/* Logo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#57534E] mb-1">
                Logo (carré, 200×200 idéal)
              </label>
              <div className="flex items-center gap-3">
                {brand.logo_url ? (
                  <div className="relative">
                    <img src={brand.logo_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-[#E7E5E4]" />
                    <button
                      type="button"
                      onClick={() => setBrand((b) => ({ ...b, logo_url: '' }))}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1C1917] text-white flex items-center justify-center"
                      aria-label="Supprimer le logo"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-[#FAF8F4] border border-dashed border-[#D6D3D1] flex items-center justify-center text-[#8B8680]">
                    <ImagePlus size={20} />
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm font-medium text-[#1C1917] cursor-pointer hover:bg-[#FAF8F4]">
                  <ImagePlus size={14} />
                  {brand.logo_url ? 'Changer le logo' : 'Téléverser un logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const dataUrl = await compressImage(f, 400, 0.9);
                        setBrand((b) => ({ ...b, logo_url: dataUrl }));
                      } catch (_e) { flash('err', 'Impossible de lire l\'image.'); }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Hero image */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#57534E] mb-1">
                Image héros (photo produit, paysage 16:9 idéal)
              </label>
              <p className="text-[11px] text-[#8B8680] mb-2">
                Affichée en filigrane derrière le titre de la carte — donne instantanément un côté premium type KFC, Starbucks, etc.
              </p>
              <div className="flex items-center gap-3">
                {brand.hero_image_url ? (
                  <div className="relative">
                    <img src={brand.hero_image_url} alt="" className="w-28 h-16 rounded-lg object-cover border border-[#E7E5E4]" />
                    <button
                      type="button"
                      onClick={() => setBrand((b) => ({ ...b, hero_image_url: '' }))}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1C1917] text-white flex items-center justify-center"
                      aria-label="Supprimer l'image"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="w-28 h-16 rounded-lg bg-[#FAF8F4] border border-dashed border-[#D6D3D1] flex items-center justify-center text-[#8B8680]">
                    <ImagePlus size={22} />
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm font-medium text-[#1C1917] cursor-pointer hover:bg-[#FAF8F4]">
                  <ImagePlus size={14} />
                  {brand.hero_image_url ? 'Changer l\'image' : 'Téléverser une image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const dataUrl = await compressImage(f, 1200, 0.82);
                        setBrand((b) => ({ ...b, hero_image_url: dataUrl }));
                      } catch (_e) { flash('err', 'Impossible de lire l\'image.'); }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Colour pickers */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'primary_color',   label: 'Couleur principale' },
                { key: 'secondary_color', label: 'Dégradé secondaire' },
                { key: 'accent_color',    label: 'Couleur accent' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-1">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brand[key]}
                      onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                      className="w-10 h-10 rounded-md border border-[#E7E5E4] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brand[key]}
                      onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#E7E5E4] font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Title + points labels */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-1">
                  Titre de la carte
                </label>
                <input
                  type="text"
                  value={brand.title_label}
                  onChange={(e) => setBrand((b) => ({ ...b, title_label: e.target.value }))}
                  placeholder="Ta carte fidélité"
                  className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-1">
                  Étiquette "Points"
                </label>
                <input
                  type="text"
                  value={brand.points_label}
                  onChange={(e) => setBrand((b) => ({ ...b, points_label: e.target.value }))}
                  placeholder="Points"
                  className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4]"
                />
              </div>
            </div>
          </div>

          {/* Live preview column — wrapped in a PhoneFrame so the patron sees
              the card in the exact context a customer will: rounded device
              chrome, dynamic-island notch, real status bar, Safari URL chip.
              What you design here is what they'll see — pixel-for-pixel. */}
          <div className="lg:sticky lg:top-4 self-start flex justify-center">
            <PhoneFrame width={260} label="Aperçu sur téléphone client">
              <PremiumLoyaltyCard
                customer={{
                  name: 'Marie Lefèvre',
                  first_name: 'Marie',
                  tier: 'Gold',
                  points: 1240,
                  barcode_id: 'FT-1DFC4E62',
                }}
                tenant={{ name: tenant?.name || tenant?.business_name || 'Mon commerce' }}
                card={brand}
                compact
              />
            </PhoneFrame>
          </div>
        </div>
      </div>

      {/* ─── Advanced editor — collapsed by default ───────────────────
          The Premium block above covers what 90% of owners need (logo,
          hero image, colours, title labels). The block below exposes
          every text slot, font, size, colour, and visibility toggle.
          Power users use it to match a brand exactly; casual users
          leave it folded. */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid #E7E5E4' }}
      >
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#FAF8F4]"
          style={{ color: '#1C1917' }}
          aria-expanded={advancedOpen}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#F8E8E2', color: '#9C4427' }}
            >
              <Sliders size={18} />
            </span>
            <div className="text-left">
              <p className="text-[15px] font-medium" style={{ color: '#1C1917' }}>
                Édition avancée — chaque ligne, chaque couleur, chaque police
              </p>
              <p className="text-[12px]" style={{ color: '#7A716C' }}>
                Pour personnaliser au pixel près : 4 onglets (éléments, tampons, couleurs, push) avec aperçu live.
              </p>
            </div>
          </div>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {advancedOpen && (
          <div className="px-5 pb-5" style={{ borderTop: '1px solid #ECE8E1' }}>
            <AuchanEditor
              layout={layout}
              onChange={setLayout}
              ctx={ctx}
              businessName={tenant?.business_name}
            />
          </div>
        )}
      </div>

    </div>
  );
}
