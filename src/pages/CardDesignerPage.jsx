import React, { useState, useEffect } from 'react';
import { Save, Send, CheckCircle, AlertCircle, Palette, Coins, Award, ImagePlus, X } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import NumberInput from '../components/NumberInput';
import { PageHeader, C as C_PS } from '../components/PageShell';
import PremiumLoyaltyCard from '../components/PremiumLoyaltyCard';
import PhoneFrame from '../components/PhoneFrame';

// Defaults for the loyalty rules — kept in sync with the backend CardTemplate model.
const DEFAULT_RULES = {
  points_per_visit: 10,
  visits_per_stamp: 1,
  reward_threshold_stamps: 10,
  reward_description: 'Un café gratuit',
  notify_before_reward: 1,   // Push fires when this-many visits remain
};

// Brand defaults for the premium card. EVERY visible field on
// PremiumLoyaltyCard is editable here so the owner can match their brand
// down to the last detail without touching code.
const DEFAULT_BRAND = {
  // Colours
  primary_color:    '#B85C38',
  secondary_color:  '#9C4427',
  accent_color:     '#F4D8A8',
  text_on_brand:    '#FFFFFF',   // text colour on the hero block
  back_link_color:  '#F4D8A8',   // "Au dos →" colour
  // Images
  logo_url:         '',
  hero_image_url:   '',
  hero_opacity:     85,          // 0–100, drives image visibility behind text
  // Text content
  title_label:      'Ta carte fidélité',
  points_label:     'Points',
  greeting_label:   'Bonjour',
  back_label:       'Détails récompenses',
  back_value:       'Au dos →',
  // Typography
  title_font:       'Cormorant Garamond',  // serif by default
  title_italic:     true,
  // Visibility toggles (show/hide each element)
  show_tier:        true,   // "MEMBRE GOLD" under brand name
  show_points:      true,   // points block top-right
  show_title:       true,   // "Ta carte fidélité" editorial title
  show_greeting:    true,   // "Bonjour Marie" row
  show_back_link:   true,   // "Au dos →" right side
  show_card_number: true,   // "N° CARTE 4E62" footer
  show_barcode:     true,   // Code 128 strip

  // ── Layout selector + Wallet-pass-specific fields ────────────────
  // Two ways to render the card:
  //   - 'hero': full brand-coloured hero with logo + name + image
  //     overlay (the existing premium layout, KFC-inspired).
  //   - 'wallet_pass': 3-band Apple-Wallet style — light top strip,
  //     promotional middle band (image OR colour with text + optional
  //     CTA box), light bottom strip with member fields + barcode.
  //     Matches GÉMO, Maison 123, FNAC adhérent, etc.
  layout_style:        'hero',
  // Card surface colour — shared by the top strip + bottom strip
  // in 'wallet_pass' layout. Default white.
  card_bg_color:       '#FFFFFF',
  card_ink_color:      '#1F1B1A',   // text colour on top + bottom strips
  // Middle band — solid colour OR image
  strip_type:          'color',     // 'color' | 'image'
  strip_color:         '#7AA070',   // sage by default (GÉMO is mint green)
  strip_text_color:    '#FFFFFF',   // text overlaid on the strip
  strip_title:         'Avantage exclusif fidélité',
  strip_subtitle:      'Réservé aux membres du programme',
  // Optional callout box inside the strip (like GÉMO's "10€ cagnottés")
  show_offer_box:      true,
  offer_box_text:      '10€ cagnottés*',
  offer_box_subtext:   'Dès 3 articles achetés',
  offer_box_color:     '#FFFFFF',   // box fill colour (often white-on-strip)
  offer_box_ink_color: '#4A6740',   // text inside the box
  // Top-right link (GÉMO has "PLUS D'INFOS ↗ Florian MARTINEZ")
  top_right_label:     'Plus d\'infos',
  top_right_value:     '',          // owner can set a URL or leave empty
  show_top_right:      true,
  // Member identifier line shown on the bottom strip
  show_member_id:      true,
  member_id_label:     'Membre',    // shown above the name
  use_full_name:       false,       // false = "Marie", true = "Marie LEFÈVRE"
  // Stats row on the bottom strip — "MON COMPTEUR FID 1/3" + "MES OFFRES DISPONIBLES 0"
  show_counter:        true,
  counter_label:       'Mon compteur fid',
  show_offers_count:   true,
  offers_count_label:  'Mes offres disponibles',
};

// Font options for the title. Loaded globally via index.css Google Fonts.
const TITLE_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'DM Serif Display',
  'Abril Fatface',
  'Inter',
  'Montserrat',
  'Bebas Neue',
  'Poppins',
  'Pacifico',
  'Dancing Script',
];

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
        // Pull ALL brand fields from the saved template. Spread defaults
        // first so any new field added later picks up sensibly.
        setBrand({
          ...DEFAULT_BRAND,
          ...(tplData.brand_fields || {}),
          // Legacy field names — keep reading these for old docs
          primary_color: tplData.primary_color || DEFAULT_BRAND.primary_color,
          secondary_color: tplData.secondary_color || DEFAULT_BRAND.secondary_color,
          accent_color: tplData.accent_color || DEFAULT_BRAND.accent_color,
          logo_url: tplData.logo_url || '',
          hero_image_url: tplData.hero_image_url || '',
          title_label: tplData.title_label || DEFAULT_BRAND.title_label,
          points_label: tplData.points_label || DEFAULT_BRAND.points_label,
        });
        // Legacy auchan_layout is preserved on save but no longer edited.
      } catch (e) {
        /* defaults are fine */
      }
    })();
  }, []);

  const updateRule = (key, val) => {
    setRules((r) => ({ ...r, [key]: val }));
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
        // The premium card is the single source of truth. Legacy
        // auchan_layout in the existing doc is preserved (it spreads
        // through `...serverTemplate`) but no longer edited from the UI.
        points_per_visit: Math.max(0, parseInt(rules.points_per_visit, 10) || 0),
        visits_per_stamp: Math.max(1, parseInt(rules.visits_per_stamp, 10) || 1),
        reward_threshold_stamps: Math.max(1, parseInt(rules.reward_threshold_stamps, 10) || 1),
        reward_description: (rules.reward_description || '').trim() || 'Reward',
        notify_before_reward: Math.max(0, parseInt(rules.notify_before_reward, 10) || 0),
        // Brand fields drive the PremiumLoyaltyCard surface. We persist
        // both the top-level keys (for backward-compat with older readers)
        // AND a single brand_fields object (for forward-looking growth —
        // any new toggle landed in DEFAULT_BRAND auto-persists).
        brand_fields: brand,
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

            {/* Hero opacity slider — controls how prominent the image is */}
            {brand.hero_image_url && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#57534E]">
                    Opacité de l'image héros
                  </label>
                  <span className="text-[11px] font-mono text-[#1C1917]">{brand.hero_opacity}%</span>
                </div>
                <input
                  type="range" min="20" max="100" step="5"
                  value={brand.hero_opacity}
                  onChange={(e) => setBrand((b) => ({ ...b, hero_opacity: parseInt(e.target.value, 10) }))}
                  className="w-full"
                />
                <p className="text-[10px] text-[#8B8680] mt-1">
                  20% = très discret, façon filigrane · 85% = front-and-centre comme KFC · 100% = image dominante.
                </p>
              </div>
            )}

            {/* 5 Colour pickers — primary, secondary, accent, text-on-brand, back-link */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-2">Palette de marque</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'primary_color',   label: 'Principale' },
                  { key: 'secondary_color', label: 'Dégradé' },
                  { key: 'accent_color',    label: 'Accent' },
                  { key: 'text_on_brand',   label: 'Texte sur marque' },
                  { key: 'back_link_color', label: 'Lien "Au dos"' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">{label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={brand[key]}
                        onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                        className="w-9 h-9 rounded-md border border-[#E7E5E4] cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={brand[key]}
                        onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                        className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E7E5E4] font-mono text-[10px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Text fields — every label on the card is editable */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-2">Textes de la carte</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#7A716C] mb-1">Titre éditorial</label>
                  <input
                    type="text"
                    value={brand.title_label}
                    onChange={(e) => setBrand((b) => ({ ...b, title_label: e.target.value }))}
                    placeholder="Ta carte fidélité"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#7A716C] mb-1">Étiquette "Points" (top droit)</label>
                  <input
                    type="text"
                    value={brand.points_label}
                    onChange={(e) => setBrand((b) => ({ ...b, points_label: e.target.value }))}
                    placeholder="Points / Solde / Tampons"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#7A716C] mb-1">Préfixe salutation</label>
                  <input
                    type="text"
                    value={brand.greeting_label}
                    onChange={(e) => setBrand((b) => ({ ...b, greeting_label: e.target.value }))}
                    placeholder="Bonjour"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#7A716C] mb-1">Étiquette "Au dos" (titre)</label>
                  <input
                    type="text"
                    value={brand.back_label}
                    onChange={(e) => setBrand((b) => ({ ...b, back_label: e.target.value }))}
                    placeholder="Détails récompenses"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-[#7A716C] mb-1">Lien "Au dos" (texte cliquable)</label>
                  <input
                    type="text"
                    value={brand.back_value}
                    onChange={(e) => setBrand((b) => ({ ...b, back_value: e.target.value }))}
                    placeholder="Au dos →"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Typography — font + italic */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-2">Typographie du titre</p>
              <div className="grid grid-cols-[1fr,auto] gap-3 items-center">
                <select
                  value={brand.title_font}
                  onChange={(e) => setBrand((b) => ({ ...b, title_font: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm"
                  style={{ fontFamily: brand.title_font }}
                >
                  {TITLE_FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 text-sm text-[#1C1917] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brand.title_italic}
                    onChange={(e) => setBrand((b) => ({ ...b, title_italic: e.target.checked }))}
                  />
                  Italique
                </label>
              </div>
              <p className="text-[10px] text-[#8B8680] mt-1.5">
                Choisissez la police qui correspond à l'identité de votre marque. Cormorant Garamond = boutique chic. Inter = SaaS moderne. Bebas Neue = sport / urbain.
              </p>
            </div>

            {/* Visibility toggles — show or hide each element */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-2">Éléments visibles</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'show_tier',        label: 'Palier (Membre Gold)' },
                  { key: 'show_points',      label: 'Bloc points (top droit)' },
                  { key: 'show_title',       label: 'Titre éditorial' },
                  { key: 'show_greeting',    label: 'Salutation (Bonjour Marie)' },
                  { key: 'show_back_link',   label: 'Lien "Au dos"' },
                  { key: 'show_card_number', label: 'N° de carte (footer)' },
                  { key: 'show_barcode',     label: 'Code-barres Code 128' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-[12px] text-[#1C1917] cursor-pointer py-1 px-2 rounded hover:bg-[#FAF8F4]">
                    <input
                      type="checkbox"
                      checked={brand[key]}
                      onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* ────────────────────────────────────────────────────────
                Layout selector — Hero vs Wallet-pass (GÉMO / Maison 123)
                ──────────────────────────────────────────────────────── */}
            <div className="pt-4 mt-2" style={{ borderTop: '1px solid #ECE8E1' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] mb-2">Style de carte</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'hero',         label: 'Style Hero', desc: 'Carte premium pleine couleur · type KFC, Café' },
                  { key: 'wallet_pass',  label: 'Style Wallet', desc: '3 bandes · type GÉMO, Maison 123, Fnac' },
                ].map((opt) => {
                  const active = brand.layout_style === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setBrand((b) => ({ ...b, layout_style: opt.key }))}
                      className="text-left p-3 rounded-lg transition-colors"
                      style={{
                        background: active ? '#F8E8E2' : 'white',
                        border: active ? '2px solid #B85C38' : '1px solid #E7E5E4',
                      }}
                    >
                      <div className="text-[13px] font-medium" style={{ color: active ? '#9C4427' : '#1C1917' }}>{opt.label}</div>
                      <div className="text-[10px] mt-1" style={{ color: '#7A716C' }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ────────────────────────────────────────────────────────
                Wallet-pass specific controls — only shown when that
                layout is selected. They're additive: every existing
                control above still works in this mode.
                ──────────────────────────────────────────────────────── */}
            {brand.layout_style === 'wallet_pass' && (
              <div className="pt-4 mt-2 space-y-4" style={{ borderTop: '1px solid #ECE8E1' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#57534E]">Options Wallet-pass</p>

                {/* Card surface colours (top + bottom strips) */}
                <div>
                  <p className="text-[10px] text-[#7A716C] mb-1">Couleur des bandes haut + bas (mêmes)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">Fond bandes</label>
                      <div className="flex items-center gap-1">
                        <input type="color" value={brand.card_bg_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_bg_color: e.target.value }))}
                               className="w-9 h-9 rounded-md border border-[#E7E5E4] cursor-pointer shrink-0" />
                        <input type="text" value={brand.card_bg_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_bg_color: e.target.value }))}
                               className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E7E5E4] font-mono text-[10px]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">Texte sur bandes</label>
                      <div className="flex items-center gap-1">
                        <input type="color" value={brand.card_ink_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_ink_color: e.target.value }))}
                               className="w-9 h-9 rounded-md border border-[#E7E5E4] cursor-pointer shrink-0" />
                        <input type="text" value={brand.card_ink_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_ink_color: e.target.value }))}
                               className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E7E5E4] font-mono text-[10px]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle band — type + content */}
                <div>
                  <p className="text-[10px] text-[#7A716C] mb-1">Bande promotionnelle (milieu)</p>
                  <div className="flex gap-2 mb-2">
                    {[
                      { key: 'color', label: 'Couleur unie' },
                      { key: 'image', label: 'Image' },
                    ].map((t) => {
                      const active = brand.strip_type === t.key;
                      return (
                        <button key={t.key} type="button"
                                onClick={() => setBrand((b) => ({ ...b, strip_type: t.key }))}
                                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                                style={{ background: active ? '#1C1917' : 'white', color: active ? 'white' : '#1C1917', border: '1px solid #E7E5E4' }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  {brand.strip_type === 'color' && (
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">Couleur bande</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={brand.strip_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_color: e.target.value }))}
                                 className="w-9 h-9 rounded-md border border-[#E7E5E4] cursor-pointer shrink-0" />
                          <input type="text" value={brand.strip_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_color: e.target.value }))}
                                 className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E7E5E4] font-mono text-[10px]" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">Texte sur bande</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={brand.strip_text_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_text_color: e.target.value }))}
                                 className="w-9 h-9 rounded-md border border-[#E7E5E4] cursor-pointer shrink-0" />
                          <input type="text" value={brand.strip_text_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_text_color: e.target.value }))}
                                 className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E7E5E4] font-mono text-[10px]" />
                        </div>
                      </div>
                    </div>
                  )}
                  {brand.strip_type === 'image' && (
                    <p className="text-[10px] text-[#7A716C] mb-2">Téléversez l'image héros plus haut — elle remplit la bande quand ce mode est actif.</p>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    <input type="text" value={brand.strip_title}
                           onChange={(e) => setBrand((b) => ({ ...b, strip_title: e.target.value }))}
                           placeholder="Titre principal de la bande (ex: HÔTEL MAGIQUE)"
                           className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                    <input type="text" value={brand.strip_subtitle}
                           onChange={(e) => setBrand((b) => ({ ...b, strip_subtitle: e.target.value }))}
                           placeholder="Sous-titre (optionnel)"
                           className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                  </div>
                </div>

                {/* Offer callout box */}
                <div>
                  <label className="flex items-center gap-2 text-[12px] text-[#1C1917] cursor-pointer mb-2">
                    <input type="checkbox" checked={brand.show_offer_box}
                           onChange={(e) => setBrand((b) => ({ ...b, show_offer_box: e.target.checked }))} />
                    Afficher l'encart d'offre (façon « 10€ cagnottés » de GÉMO)
                  </label>
                  {brand.show_offer_box && (
                    <div className="space-y-2 pl-6">
                      <input type="text" value={brand.offer_box_text}
                             onChange={(e) => setBrand((b) => ({ ...b, offer_box_text: e.target.value }))}
                             placeholder="Texte principal (ex: 10€ cagnottés*)"
                             className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                      <input type="text" value={brand.offer_box_subtext}
                             onChange={(e) => setBrand((b) => ({ ...b, offer_box_subtext: e.target.value }))}
                             placeholder="Sous-texte (ex: Dès 3 articles achetés)"
                             className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">Fond encart</label>
                          <input type="color" value={brand.offer_box_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, offer_box_color: e.target.value }))}
                                 className="w-full h-8 rounded-md border border-[#E7E5E4] cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#7A716C] mb-1">Texte encart</label>
                          <input type="color" value={brand.offer_box_ink_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, offer_box_ink_color: e.target.value }))}
                                 className="w-full h-8 rounded-md border border-[#E7E5E4] cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top-right link */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#7A716C] mb-1">Étiquette haut droit</label>
                    <input type="text" value={brand.top_right_label}
                           onChange={(e) => setBrand((b) => ({ ...b, top_right_label: e.target.value }))}
                           placeholder="Plus d'infos"
                           className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#7A716C] mb-1">Lien (URL optionnel)</label>
                    <input type="text" value={brand.top_right_value}
                           onChange={(e) => setBrand((b) => ({ ...b, top_right_value: e.target.value }))}
                           placeholder="https://…"
                           className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                  </div>
                </div>

                {/* Member fields */}
                <div>
                  <p className="text-[10px] text-[#7A716C] mb-2">Champs membre (bande bas)</p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <input type="text" value={brand.counter_label}
                           onChange={(e) => setBrand((b) => ({ ...b, counter_label: e.target.value }))}
                           placeholder="Mon compteur fid"
                           className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                    <input type="text" value={brand.offers_count_label}
                           onChange={(e) => setBrand((b) => ({ ...b, offers_count_label: e.target.value }))}
                           placeholder="Mes offres disponibles"
                           className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'show_top_right',     label: 'Étiquette haut-droit' },
                      { key: 'show_member_id',     label: 'Nom du membre' },
                      { key: 'show_counter',       label: 'Compteur (1/3)' },
                      { key: 'show_offers_count',  label: 'Compteur offres' },
                      { key: 'use_full_name',      label: 'Nom complet (NOM Prénom)' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-[12px] text-[#1C1917] cursor-pointer py-1 px-2 rounded hover:bg-[#FAF8F4]">
                        <input type="checkbox" checked={brand[key]}
                               onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
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

    </div>
  );
}
