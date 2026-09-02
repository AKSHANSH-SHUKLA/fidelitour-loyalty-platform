import React, { useState, useEffect } from 'react';
import { Save, Send, CheckCircle, AlertCircle, Palette, Coins, Award, ImagePlus, X } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import NumberInput from '../components/NumberInput';
import { PageHeader, C as C_PS } from '../components/PageShell';
import PremiumLoyaltyCard from '../components/PremiumLoyaltyCard';
import WalletCard from '../components/WalletCard';

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
  // Where the logo sits on the card. 'top_left' is the Apple-Wallet default
  // (matches Maison 123, FNAC, GÉMO). 'middle_overlay' puts it centred over
  // the middle band, 'top_center' centres it on the top strip.
  logo_position:    'top_left',  // 'top_left' | 'top_center' | 'middle_overlay'
  // Text content
  title_label:      'Ta carte fidélité',
  points_label:     'Points',
  greeting_label:   'Bonjour',
  back_label:       'Détails récompenses',
  back_value:       'Au dos →',
  // Typography
  title_font:       'Cormorant Garamond',  // serif by default
  title_italic:     true,
  title_bold:       true,
  title_underline:  false,
  // Visibility toggles (show/hide each element)
  show_tier:        true,   // "MEMBRE GOLD" under brand name
  show_points:      true,   // points block top-right
  show_title:       true,   // "Ta carte fidélité" editorial title
  show_greeting:    true,   // "Bonjour Marie" row
  show_back_link:   true,   // "Au dos →" right side
  show_card_number: true,   // "N° CARTE 4E62" footer
  show_barcode:     true,   // Code 128 strip

  // ── Wallet-anatomy design (layout_style: 'wallet') ───────────────
  // The redesigned card (FidClic-Card-Redesign-Spec). Duo-tone contract:
  // the merchant picks a surface (card body) + a brand colour (accent);
  // cardTheme.js derives every other colour with contrast arithmetic.
  // These keys ride brand_fields into the customer payload automatically.
  layout_style:     '',          // '' = legacy render · 'wallet' = new anatomy
  surface:          'anthracite',// curated: noir|anthracite|marine|foret|espresso|blanc|creme|sable
  surface_color:    '',          // optional custom hex — overrides `surface`
  brand_color:      '#B85C38',   // THE accent (stamps, meter, offer chip, tier ring)
  code_type:        'qr',        // 'qr' | 'barcode' | 'both' — QR default: Apple
                                 // notes Code128 is unsupported on watchOS and
                                 // square codes scan better on small screens
  hero_mode:        'image',     // 'image' | 'brand' | 'none'

  // ── Layout selector + Wallet-pass-specific fields ────────────────
  // Two ways to render the card:
  //   - 'hero': full brand-coloured hero with logo + name + image
  //     overlay (the existing premium layout, KFC-inspired).
  //   - 'wallet_pass': 3-band Apple-Wallet style — light top strip,
  //     promotional middle band (image OR colour with text + optional
  //     CTA box), light bottom strip with member fields + barcode.
  //     Matches GÉMO, Maison 123, FNAC adhérent, etc.
  // Default to the 3-band wallet-pass layout (FNAC / Maison 123 / GÉMO style)
  // since this is what most owners want out of the box. They can flip to
  // 'hero' from the layout picker if they prefer the brand-coloured full-bleed.
  layout_style:        'wallet_pass',
  // Card surface colour — shared by the top strip + bottom strip
  // in 'wallet_pass' layout. Default white.
  card_bg_color:       '#FFFFFF',
  card_ink_color:      '#171412',   // text colour on top + bottom strips
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

  // ── Stamps grid + progress meter (bottom band) ───────────────────
  // The user wants the classic punch-card-style stamp grid AND a
  // points meter on the bottom band of the wallet-pass layout.
  show_stamps_grid:    true,
  // Shape of each individual stamp slot. 'custom' uses stamp_custom_url
  // for both filled and empty states (filled = full colour, empty = faded).
  stamp_shape:         'circle',         // 'circle' | 'hexagon' | 'octagon' | 'square' | 'custom'
  stamp_custom_url:    '',               // data URL when stamp_shape === 'custom'
  stamp_fill_color:    '#B85C38',        // colour of a collected stamp
  stamp_empty_color:   '#E9E5E0',        // colour of an unfilled slot
  stamp_ink_color:     '#FFFFFF',        // colour of the icon/check inside a filled stamp
  stamp_size:          28,               // pixel size of each slot
  stamps_label:        'Vos tampons',    // small caption above the stamps row

  // Progress meter — slim horizontal bar that mirrors the stamps fill
  show_meter:          true,
  meter_fill_color:    '#B85C38',
  meter_track_color:   '#F2EDE3',
  meter_label:         'Points',         // caption above the points meter

  // ── Apple-Wallet-style bottom band layout ──────────────────────────
  // Top-right corner of the card — small "+ D'INFOS / N pts" stack
  show_points_top_right: true,
  points_top_right_label: '+ D\'INFOS',
  // Greeting on the bottom band (Maison 123: "VICTOIRE / Utku")
  bottom_greeting_label: 'Bienvenue',
  // QR code + barcode controls — owner picks one or both, and the size
  show_qr:              true,
  show_barcode:         true,           // re-declared for clarity (matches above)
  qr_size:              90,             // px on the card surface
  // Birthday display
  show_birthday:        false,
  birthday_label:       'Anniversaire',
  // Tier badge on the top strip
  show_tier_badge:      true,
  tier_badge_bronze:    '#B26344',
  tier_badge_silver:    '#9AA6B3',
  tier_badge_gold:      '#E8A53B',
  tier_badge_vip:       '#9A6DBF',
};

// Font options for the title.
const TITLE_FONTS = [
  // Serif — boutique / luxury
  'Cormorant Garamond',
  'Playfair Display',
  'DM Serif Display',
  'Abril Fatface',
  'Libre Caslon Text',
  'EB Garamond',
  // Sans — modern SaaS
  'Inter',
  'Montserrat',
  'Poppins',
  'Work Sans',
  'DM Sans',
  // Display — bold, sporty, brand
  'Bebas Neue',
  'Anton',
  'Oswald',
  'Archivo Black',
  // Script — handwritten
  'Pacifico',
  'Dancing Script',
  'Great Vibes',
  // Monospace — tech / editorial
  'JetBrains Mono',
  'IBM Plex Mono',
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
          // Wallet-anatomy keys may exist only at top level (set via API
          // before this UI existed — the demo tenant, for one). Seed them
          // from there so opening the designer and hitting Save doesn't
          // silently flip a live wallet card back to the legacy render.
          layout_style: tplData.layout_style ?? tplData.brand_fields?.layout_style ?? '',
          surface: tplData.surface ?? tplData.brand_fields?.surface ?? DEFAULT_BRAND.surface,
          surface_color: tplData.surface_color ?? tplData.brand_fields?.surface_color ?? '',
          brand_color: tplData.brand_color ?? tplData.brand_fields?.brand_color ?? DEFAULT_BRAND.brand_color,
          code_type: tplData.code_type ?? tplData.brand_fields?.code_type ?? DEFAULT_BRAND.code_type,
          hero_mode: tplData.hero_mode ?? tplData.brand_fields?.hero_mode ?? DEFAULT_BRAND.hero_mode,
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
        reward_threshold_stamps: Math.max(1, Math.min(15, parseInt(rules.reward_threshold_stamps, 10) || 1)),
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
        // Wallet-anatomy keys mirrored at top level: the customer payload
        // reads these via tpl.get(...), which would override the brand_fields
        // spread with None if they only lived inside brand_fields.
        layout_style: brand.layout_style || '',
        surface: brand.surface || 'anthracite',
        surface_color: brand.surface_color || '',
        brand_color: brand.brand_color || DEFAULT_BRAND.brand_color,
        code_type: brand.code_type || 'qr',
        hero_mode: brand.hero_mode || 'image',
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
              style={{ background: 'var(--flc-card, #FFFFFF)', border: `1px solid ${C_PS.terracotta}`, color: C_PS.terracotta }}
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
      <div className="rounded-xl border-2 border-[#E3A869] bg-[#F6E9E2] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Coins size={20} className="text-[#96431F]" />
          <h2 className="text-lg font-bold text-[#96431F]">
            Loyalty Rules — what your customers earn
          </h2>
        </div>
        <p className="text-xs text-[#96431F]/80 -mt-2">
          These numbers control your scan flow and reward unlocks. Change them and every customer's
          card and progression updates. The visual stamp count below auto-syncs with the reward threshold.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#96431F] uppercase tracking-wider mb-1 block">
              Points awarded per visit
            </label>
            <p className="text-[11px] text-[#96431F]/80 mb-2">
              How many points each customer gets when staff scans their visit. Default: 10.
            </p>
            <NumberInput
              min={0}
              max={1000}
              emptyValue={10}
              value={rules.points_per_visit}
              onChange={(n) => updateRule('points_per_visit', n)}
              className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#171412]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#96431F] uppercase tracking-wider mb-1 block">
              Visits required per stamp
            </label>
            <p className="text-[11px] text-[#96431F]/80 mb-2">
              Usually 1 (every visit = 1 stamp). Set to 2 if you want stamps to feel rarer.
            </p>
            <NumberInput
              min={1}
              max={20}
              emptyValue={1}
              value={rules.visits_per_stamp}
              onChange={(n) => updateRule('visits_per_stamp', n)}
              className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#171412]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#96431F] uppercase tracking-wider mb-1 block">
              Stamps to unlock the reward
            </label>
            <p className="text-[11px] text-[#96431F]/80 mb-2">
              How many stamps to fill the card. Default: 10 (the classic café punch card).
            </p>
            <NumberInput
              min={1}
              max={15}
              emptyValue={10}
              value={rules.reward_threshold_stamps}
              onChange={(n) => updateRule('reward_threshold_stamps', n)}
              className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#171412]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#96431F] uppercase tracking-wider mb-1 block">
              Reward description
            </label>
            <p className="text-[11px] text-[#96431F]/80 mb-2">
              What customers see they'll earn. Shown on the card and in the unlock notification.
            </p>
            <input
              type="text"
              maxLength={120}
              value={rules.reward_description}
              onChange={(e) => updateRule('reward_description', e.target.value)}
              placeholder="e.g. Un café gratuit"
              className="w-full px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-semibold text-[#171412]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-[#96431F] uppercase tracking-wider mb-1 block">
              🔔 Send "almost there" push when N visits remain
            </label>
            <p className="text-[11px] text-[#96431F]/80 mb-2">
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
                className="w-24 px-3 py-2 rounded-lg border border-[#E3A869]/60 bg-white text-lg font-bold text-[#171412]"
              />
              <div className="flex items-center gap-2 text-xs text-[#96431F]">
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
                          : 'bg-white border border-[#E3A869]/60 hover:bg-[#F6E9E2]'
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
        <div className="rounded-lg bg-[#96431F] text-white p-4 flex items-start gap-3">
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

      {/* ── Nouveau design Wallet — the wallet-anatomy card ──────────────
          Duo-tone contract: surface + brand colour, everything else derived.
          Four curated presets follow the PassKit research: template-led with
          premium constraints, never a freeform canvas. */}
      <div className="rounded-xl border border-[#E9E5E0] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-[#171412]">
            Nouveau design Wallet
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider align-middle px-2 py-0.5 rounded-full"
              style={{ background: brand.layout_style === 'wallet' ? '#DCF0E4' : '#F2F2F2',
                       color: brand.layout_style === 'wallet' ? '#0F6B45' : '#8D857D' }}>
              {brand.layout_style === 'wallet' ? 'Actif' : 'Inactif'}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setBrand((b) => ({ ...b, layout_style: b.layout_style === 'wallet' ? '' : 'wallet' }))}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border"
            style={brand.layout_style === 'wallet'
              ? { borderColor: '#E9E5E0', color: '#57504A', background: '#FAFAF8' }
              : { borderColor: '#171412', color: '#FFFFFF', background: '#171412' }}
          >
            {brand.layout_style === 'wallet' ? 'Revenir à l’ancien design' : 'Activer le nouveau design'}
          </button>
        </div>
        <p className="text-xs text-[#57504A] -mt-2 max-w-xl">
          Style « carte Apple Wallet » : vous choisissez la couleur de la carte, la couleur
          d’accent, le logo et la photo — la lisibilité (contrastes, tailles, typographie)
          est garantie automatiquement. Vos anciennes cartes ne changent pas tant que vous
          n’activez pas ce design.
        </p>

        {brand.layout_style === 'wallet' && (
          <div className="space-y-5">
            {/* Presets */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Départs rapides</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'signature', label: 'Signature', surface: 'noir',   brand_color: '#C9A34E', hero_mode: 'image', hint: 'Noir + or, photo' },
                  { key: 'lumiere',   label: 'Lumière',   surface: 'creme',  brand_color: '#5C3A21', hero_mode: 'image', hint: 'Crème + chocolat' },
                  { key: 'marine',    label: 'Marine',    surface: 'marine', brand_color: '#E8703A', hero_mode: 'brand', hint: 'Marine + orange' },
                  { key: 'minimal',   label: 'Minimal',   surface: 'anthracite', brand_color: '#9BA3AD', hero_mode: 'none', hint: 'Sobre, sans photo' },
                ].map((p) => (
                  <button key={p.key} type="button"
                    onClick={() => setBrand((b) => ({ ...b, surface: p.surface, surface_color: '', brand_color: p.brand_color, hero_mode: p.hero_mode }))}
                    className="rounded-lg border border-[#E9E5E0] p-2 text-left hover:border-[#171412] transition-colors">
                    <span className="flex gap-1 mb-1.5" aria-hidden="true">
                      <span className="w-5 h-5 rounded" style={{ background: { noir:'#141519', anthracite:'#1C1D22', marine:'#101B2E', creme:'#F6EFE3' }[p.surface] || '#1C1D22', border: '1px solid #E9E5E0' }} />
                      <span className="w-5 h-5 rounded" style={{ background: p.brand_color }} />
                    </span>
                    <span className="block text-xs font-bold text-[#171412]">{p.label}</span>
                    <span className="block text-[10px] text-[#8D857D]">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duo-tone pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Couleur de la carte (fond)</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[['noir','#141519'],['anthracite','#1C1D22'],['marine','#101B2E'],['foret','#12211A'],
                    ['espresso','#211711'],['blanc','#FDFCFA'],['creme','#F6EFE3'],['sable','#EFE9DD']].map(([k, hex]) => (
                    <button key={k} type="button" title={k}
                      onClick={() => setBrand((b) => ({ ...b, surface: k, surface_color: '' }))}
                      className="w-8 h-8 rounded-lg border-2"
                      style={{ background: hex,
                               borderColor: (brand.surface === k && !brand.surface_color) ? '#171412' : '#E9E5E0' }} />
                  ))}
                  <label className="w-8 h-8 rounded-lg border-2 overflow-hidden cursor-pointer grid place-items-center text-[10px] font-bold"
                    style={{ borderColor: brand.surface_color ? '#171412' : '#E9E5E0',
                             background: brand.surface_color || '#FFFFFF', color: '#8D857D' }}
                    title="Couleur personnalisée">
                    {!brand.surface_color && '+'}
                    <input type="color" className="sr-only"
                      value={brand.surface_color || '#1C1D22'}
                      onChange={(e) => setBrand((b) => ({ ...b, surface_color: e.target.value }))} />
                  </label>
                </div>
                <p className="text-[10px] text-[#8D857D]">Le texte s’adapte automatiquement — même une couleur personnalisée reste lisible.</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Couleur d’accent (marque)</p>
                <div className="flex items-center gap-2">
                  <input type="color"
                    value={brand.brand_color || '#B85C38'}
                    onChange={(e) => setBrand((b) => ({ ...b, brand_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-[#E9E5E0] cursor-pointer" />
                  <div className="text-[11px] text-[#57504A]">
                    Tampons, jauge, offre, accents.<br />
                    <span className="text-[#8D857D]">Duo gagnant : noir + or, marine + orange…</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero + code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Bandeau (haut de carte)</p>
                <div className="flex gap-1.5">
                  {[['image','Photo'],['brand','Couleur'],['none','Aucun']].map(([v, lbl]) => (
                    <button key={v} type="button"
                      onClick={() => setBrand((b) => ({ ...b, hero_mode: v }))}
                      className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                      style={brand.hero_mode === v
                        ? { background: '#171412', color: '#FFF', borderColor: '#171412' }
                        : { background: '#FFF', color: '#57504A', borderColor: '#E9E5E0' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#8D857D] mt-1.5">
                  La photo vient du champ « Image hero » ci-dessous. Conseil Apple : pas de
                  texte important dans la photo — les infos vont dans les champs de la carte.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Code scanné en caisse</p>
                <div className="flex gap-1.5">
                  {[['qr','QR'],['barcode','Code-barres'],['both','Les deux']].map(([v, lbl]) => (
                    <button key={v} type="button"
                      onClick={() => setBrand((b) => ({ ...b, code_type: v }))}
                      className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                      style={brand.code_type === v
                        ? { background: '#171412', color: '#FFF', borderColor: '#171412' }
                        : { background: '#FFF', color: '#57504A', borderColor: '#E9E5E0' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#8D857D] mt-1.5">
                  QR recommandé : lisible sur petit écran, et le Code128 n’est pas supporté
                  sur Apple Watch.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium brand block — drives the new wallet card surface
          (logo, hero image, brand colours, title + points labels). The Auchan
          editor below is for fine-tuning the back-of-card / legacy layout. */}
      <div className="rounded-xl border border-[#E9E5E0] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={20} className="text-[#B85C38]" />
          <h2 className="text-lg font-bold text-[#171412]">
            Design premium — logo, image, couleurs
          </h2>
        </div>
        <p className="text-xs text-[#57504A] -mt-2">
          Ces éléments forment la première impression du client quand il ouvre sa carte.
          Un logo net + une belle photo de votre produit + la bonne couleur de marque suffisent à
          faire passer la carte de "site web" à "Apple Wallet".
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
          {/* Editor column */}
          <div className="space-y-5">
            {/* Logo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#57504A] mb-1">
                Logo (carré, 200×200 idéal)
              </label>
              <div className="flex items-center gap-3">
                {brand.logo_url ? (
                  <div className="relative">
                    <div className="w-36 h-36 rounded-xl border border-[#E9E5E0] bg-white p-2 flex items-center justify-center overflow-hidden">
                      <img src={brand.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setBrand((b) => ({ ...b, logo_url: '' }))}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#171412] text-white flex items-center justify-center shadow-md"
                      aria-label="Supprimer le logo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-xl bg-[#FAFAF8] border border-dashed border-[#D6D3D1] flex items-center justify-center text-[#8D857D]">
                    <ImagePlus size={36} />
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm font-medium text-[#171412] cursor-pointer hover:bg-[#FAFAF8]">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#57504A] mb-1">
                Image héros (photo produit, paysage 16:9 idéal)
              </label>
              <p className="text-[11px] text-[#8D857D] mb-2">
                Affichée en filigrane derrière le titre de la carte — donne instantanément un côté premium type KFC, Starbucks, etc.
              </p>
              <div className="flex items-center gap-3">
                {brand.hero_image_url ? (
                  <div className="relative">
                    <img src={brand.hero_image_url} alt="" className="w-28 h-16 rounded-lg object-cover border border-[#E9E5E0]" />
                    <button
                      type="button"
                      onClick={() => setBrand((b) => ({ ...b, hero_image_url: '' }))}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#171412] text-white flex items-center justify-center"
                      aria-label="Supprimer l'image"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="w-28 h-16 rounded-lg bg-[#FAFAF8] border border-dashed border-[#D6D3D1] flex items-center justify-center text-[#8D857D]">
                    <ImagePlus size={22} />
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm font-medium text-[#171412] cursor-pointer hover:bg-[#FAFAF8]">
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

            {/* 5 Colour pickers — primary, secondary, accent, text-on-brand, back-link */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Palette de marque</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'primary_color',   label: 'Principale' },
                  { key: 'secondary_color', label: 'Dégradé' },
                  { key: 'accent_color',    label: 'Accent' },
                  { key: 'text_on_brand',   label: 'Texte sur marque' },
                  { key: 'back_link_color', label: 'Lien "Au dos"' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">{label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={brand[key]}
                        onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                        className="w-9 h-9 rounded-md border border-[#E9E5E0] cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={brand[key]}
                        onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                        className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E9E5E0] font-mono text-[10px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map text / "Au dos" fields removed — they belonged to the
                legacy hero layout and don't appear anywhere on the 3-band
                card. The 3-band design has its own clearly-labelled controls
                in the "Disposition Apple Wallet" section below
                (points top-right, greeting, action prompt, etc.). */}

            {/* Typography — font + italic + bold + underline */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Typographie du titre</p>
              <div className="grid grid-cols-1 gap-3">
                <select
                  value={brand.title_font}
                  onChange={(e) => setBrand((b) => ({ ...b, title_font: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm"
                  style={{ fontFamily: brand.title_font }}
                >
                  {TITLE_FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
                <div className="flex items-center gap-4 flex-wrap">
                <label className="inline-flex items-center gap-2 text-sm text-[#171412] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brand.title_italic}
                    onChange={(e) => setBrand((b) => ({ ...b, title_italic: e.target.checked }))}
                  />
                  <span style={{ fontStyle: 'italic' }}>Italique</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[#171412] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brand.title_bold !== false}
                    onChange={(e) => setBrand((b) => ({ ...b, title_bold: e.target.checked }))}
                  />
                  <span style={{ fontWeight: 700 }}>Gras</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[#171412] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!brand.title_underline}
                    onChange={(e) => setBrand((b) => ({ ...b, title_underline: e.target.checked }))}
                  />
                  <span style={{ textDecoration: 'underline' }}>Souligné</span>
                </label>
                </div>
              </div>
              <p className="text-[10px] text-[#8D857D] mt-1.5">
                Choisissez la police qui correspond à l'identité de votre marque. Cormorant Garamond = boutique chic. Inter = SaaS moderne. Bebas Neue = sport / urbain.
              </p>
            </div>

            {/* Visibility toggles — show or hide each element */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A] mb-2">Éléments visibles</p>
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
                  <label key={key} className="flex items-center gap-2 text-[12px] text-[#171412] cursor-pointer py-1 px-2 rounded hover:bg-[#FAFAF8]">
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

            {/* Layout picker removed — the card now uses ONE design (the
                3-band Apple-Wallet style). brand.layout_style is hard-wired
                to 'wallet_pass' so the user gets the FNAC / Maison 123 /
                GÉMO pattern strictly: top + bottom share the same colour,
                middle is the fully-customizable promotional band. */}

            {/* ────────────────────────────────────────────────────────
                Wallet-pass specific controls — only shown when that
                layout is selected. They're additive: every existing
                control above still works in this mode.
                ──────────────────────────────────────────────────────── */}
            <div className="pt-4 mt-2 space-y-4" style={{ borderTop: '1px solid #EFEDE9' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#57504A]">3 bandes — Top, Milieu, Bas</p>

                {/* Card surface colours (top + bottom strips) */}
                <div>
                  <p className="text-[10px] text-[#8D857D] mb-1">Couleur des bandes haut + bas (mêmes)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">Fond bandes</label>
                      <div className="flex items-center gap-1">
                        <input type="color" value={brand.card_bg_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_bg_color: e.target.value }))}
                               className="w-9 h-9 rounded-md border border-[#E9E5E0] cursor-pointer shrink-0" />
                        <input type="text" value={brand.card_bg_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_bg_color: e.target.value }))}
                               className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E9E5E0] font-mono text-[10px]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">Texte sur bandes</label>
                      <div className="flex items-center gap-1">
                        <input type="color" value={brand.card_ink_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_ink_color: e.target.value }))}
                               className="w-9 h-9 rounded-md border border-[#E9E5E0] cursor-pointer shrink-0" />
                        <input type="text" value={brand.card_ink_color}
                               onChange={(e) => setBrand((b) => ({ ...b, card_ink_color: e.target.value }))}
                               className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E9E5E0] font-mono text-[10px]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle band — type + content */}
                <div>
                  <p className="text-[10px] text-[#8D857D] mb-1">Bande promotionnelle (milieu)</p>
                  <p className="text-[10.5px] text-[#8D857D] mb-2 leading-snug">
                    <b>Couleur unie</b> = la bande du milieu est un aplat de couleur (style GÉMO vert, Maison 123 brun) avec votre titre + sous-titre en surimpression.
                    <br />
                    <b>Image</b> = vous téléversez une photo promotionnelle qui remplit la bande (style FNAC Black Friday).
                  </p>
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
                                style={{ background: active ? 'var(--flc-ink, #171412)' : 'var(--flc-card, #FFFFFF)', color: active ? 'var(--flc-paper, #FFFFFF)' : 'var(--flc-ink, #171412)', border: '1px solid var(--flc-line, #E9E5E0)' }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  {brand.strip_type === 'color' && (
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">Couleur bande</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={brand.strip_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_color: e.target.value }))}
                                 className="w-9 h-9 rounded-md border border-[#E9E5E0] cursor-pointer shrink-0" />
                          <input type="text" value={brand.strip_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_color: e.target.value }))}
                                 className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E9E5E0] font-mono text-[10px]" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">Texte sur bande</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={brand.strip_text_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_text_color: e.target.value }))}
                                 className="w-9 h-9 rounded-md border border-[#E9E5E0] cursor-pointer shrink-0" />
                          <input type="text" value={brand.strip_text_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, strip_text_color: e.target.value }))}
                                 className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[#E9E5E0] font-mono text-[10px]" />
                        </div>
                      </div>
                    </div>
                  )}
                  {brand.strip_type === 'image' && (
                    <p className="text-[10px] text-[#8D857D] mb-2">Téléversez l'image héros plus haut — elle remplit la bande quand ce mode est actif.</p>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    <input type="text" value={brand.strip_title}
                           onChange={(e) => setBrand((b) => ({ ...b, strip_title: e.target.value }))}
                           placeholder="Titre principal de la bande (ex: HÔTEL MAGIQUE)"
                           className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                    <input type="text" value={brand.strip_subtitle}
                           onChange={(e) => setBrand((b) => ({ ...b, strip_subtitle: e.target.value }))}
                           placeholder="Sous-titre (optionnel)"
                           className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                  </div>
                </div>

                {/* Offer callout box */}
                <div>
                  <label className="flex items-center gap-2 text-[12px] text-[#171412] cursor-pointer mb-2">
                    <input type="checkbox" checked={brand.show_offer_box}
                           onChange={(e) => setBrand((b) => ({ ...b, show_offer_box: e.target.checked }))} />
                    Afficher l'encart d'offre (façon « 10€ cagnottés » de GÉMO)
                  </label>
                  {brand.show_offer_box && (
                    <div className="space-y-2 pl-6">
                      <input type="text" value={brand.offer_box_text}
                             onChange={(e) => setBrand((b) => ({ ...b, offer_box_text: e.target.value }))}
                             placeholder="Texte principal (ex: 10€ cagnottés*)"
                             className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                      <input type="text" value={brand.offer_box_subtext}
                             onChange={(e) => setBrand((b) => ({ ...b, offer_box_subtext: e.target.value }))}
                             placeholder="Sous-texte (ex: Dès 3 articles achetés)"
                             className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">Fond encart</label>
                          <input type="color" value={brand.offer_box_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, offer_box_color: e.target.value }))}
                                 className="w-full h-8 rounded-md border border-[#E9E5E0] cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8D857D] mb-1">Texte encart</label>
                          <input type="color" value={brand.offer_box_ink_color}
                                 onChange={(e) => setBrand((b) => ({ ...b, offer_box_ink_color: e.target.value }))}
                                 className="w-full h-8 rounded-md border border-[#E9E5E0] cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Orphan "top-right link" + "member fields" blocks removed.
                    Their fields didn't render anywhere on the 3-band card.
                    The active fields (points top-right label, action prompt,
                    greeting label) live in the "Disposition Apple Wallet"
                    section below. */}
              </div>

            {/* ─── Disposition Apple Wallet — logo, top-right, action prompt, QR, anniversaire, tiers ─── */}
            <div className="rounded-xl border border-[#E9E5E0] bg-white p-4 space-y-4 mt-3">
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-[#B85C38]" />
                <h3 className="text-[14px] font-bold text-[#171412]">Disposition Apple Wallet</h3>
              </div>
              <p className="text-[11.5px] text-[#8D857D] -mt-2">
                Réglez où va le logo, ce qui s'affiche en haut à droite, l'invite d'action en bas, la taille du QR, l'anniversaire et les badges de palier.
              </p>

              {/* Logo position */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8D857D] mb-2 font-bold">Position du logo</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'top_left',       label: 'Haut gauche' },
                    { key: 'top_center',     label: 'Haut centre' },
                    { key: 'middle_overlay', label: 'Sur la bande centrale' },
                  ].map(({ key, label }) => {
                    const active = brand.logo_position === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => setBrand((b) => ({ ...b, logo_position: key }))}
                        className={`p-2 rounded-lg border text-[11px] text-center transition ${active ? 'border-[#B85C38] bg-[#FEF6F0] text-[#B85C38] font-semibold' : 'border-[#E9E5E0] bg-white hover:bg-[#FAFAF8] text-[#171412]'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Top-right pts label */}
              <div>
                <label className="flex items-center gap-2 text-[12px] font-bold text-[#171412] mb-2 cursor-pointer">
                  <input type="checkbox" checked={brand.show_points_top_right !== false}
                         onChange={(e) => setBrand((b) => ({ ...b, show_points_top_right: e.target.checked }))} />
                  Afficher les points en haut à droite ("+ D'INFOS / N pts")
                </label>
                {brand.show_points_top_right !== false && (
                  <input type="text" value={brand.points_top_right_label}
                         onChange={(e) => setBrand((b) => ({ ...b, points_top_right_label: e.target.value }))}
                         placeholder="+ D'INFOS"
                         className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                )}
              </div>

              {/* Action prompt section removed — the bottom-right of the
                  card now shows "Total visites / N" (computed from the
                  customer's visits count). The points meter underneath
                  shows points earned / points needed for next reward. */}

              {/* Greeting label */}
              <div>
                <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Étiquette d'accueil</label>
                <input type="text" value={brand.bottom_greeting_label}
                       onChange={(e) => setBrand((b) => ({ ...b, bottom_greeting_label: e.target.value }))}
                       placeholder="Bienvenue / Membre / Bonjour"
                       className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
              </div>

              {/* QR / barcode / birthday toggles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-[12px] text-[#171412] cursor-pointer">
                  <input type="checkbox" checked={brand.show_qr !== false}
                         onChange={(e) => setBrand((b) => ({ ...b, show_qr: e.target.checked }))} />
                  QR code
                </label>
                <label className="flex items-center gap-2 text-[12px] text-[#171412] cursor-pointer">
                  <input type="checkbox" checked={brand.show_barcode !== false}
                         onChange={(e) => setBrand((b) => ({ ...b, show_barcode: e.target.checked }))} />
                  Code-barres
                </label>
                <label className="flex items-center gap-2 text-[12px] text-[#171412] cursor-pointer">
                  <input type="checkbox" checked={!!brand.show_birthday}
                         onChange={(e) => setBrand((b) => ({ ...b, show_birthday: e.target.checked }))} />
                  Anniversaire
                </label>
              </div>

              {/* QR size + birthday label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Taille du QR (px)</label>
                  <input type="range" min="48" max="140" value={brand.qr_size}
                         onChange={(e) => setBrand((b) => ({ ...b, qr_size: parseInt(e.target.value, 10) }))}
                         className="w-full" />
                  <p className="text-[11px] text-[#171412] mt-1">{brand.qr_size}px</p>
                </div>
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Étiquette anniversaire</label>
                  <input type="text" value={brand.birthday_label}
                         onChange={(e) => setBrand((b) => ({ ...b, birthday_label: e.target.value }))}
                         placeholder="Anniversaire"
                         className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                </div>
              </div>

              {/* Tier badge colours */}
              <div>
                <label className="flex items-center gap-2 text-[12px] font-bold text-[#171412] mb-2 cursor-pointer">
                  <input type="checkbox" checked={brand.show_tier_badge !== false}
                         onChange={(e) => setBrand((b) => ({ ...b, show_tier_badge: e.target.checked }))} />
                  Afficher le badge de palier sur la carte
                </label>
                {brand.show_tier_badge !== false && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'tier_badge_bronze', label: 'Bronze' },
                      { key: 'tier_badge_silver', label: 'Silver' },
                      { key: 'tier_badge_gold',   label: 'Gold' },
                      { key: 'tier_badge_vip',    label: 'VIP' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">{label}</label>
                        <input type="color" value={brand[key]}
                               onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                               className="w-full h-8 rounded border border-[#E9E5E0]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Tampons & progression — punch-card stamps + meter ─── */}
            <div className="rounded-xl border border-[#E9E5E0] bg-white p-4 space-y-4 mt-3">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-[#B85C38]" />
                <h3 className="text-[14px] font-bold text-[#171412]">Tampons & progression</h3>
              </div>
              <p className="text-[11.5px] text-[#8D857D] -mt-2">
                Personnalisez le design des tampons et de la jauge affichés en bas de la carte.
                Le nombre de tampons se synchronise automatiquement avec la règle "Stamps to unlock the reward".
              </p>

              {/* Stamp shape picker */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8D857D] mb-2 font-bold">Forme du tampon</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: 'circle',  label: 'Cercle',  preview: { borderRadius: '50%' } },
                    { key: 'hexagon', label: 'Hexagone', preview: { clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)' } },
                    { key: 'octagon', label: 'Octogone', preview: { clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' } },
                    { key: 'square',  label: 'Carré',   preview: { borderRadius: 4 } },
                    { key: 'custom',  label: 'Personnalisé', preview: { borderRadius: 4, border: '2px dashed #B85C38', background: '#FFF' } },
                  ].map(({ key, label, preview }) => {
                    const active = brand.stamp_shape === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBrand((b) => ({ ...b, stamp_shape: key }))}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition ${active ? 'border-[#B85C38] bg-[#FEF6F0]' : 'border-[#E9E5E0] bg-white hover:bg-[#FAFAF8]'}`}
                      >
                        <div style={{ width: 26, height: 26, background: active ? brand.stamp_fill_color : '#D6CFC1', ...preview }} />
                        <span className="text-[10px] text-[#171412] font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom stamp image upload (only when shape === 'custom') */}
              {brand.stamp_shape === 'custom' && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#8D857D] mb-2 font-bold">Image de tampon personnalisée</p>
                  <div className="flex items-center gap-3">
                    {brand.stamp_custom_url ? (
                      <div className="relative">
                        <img src={brand.stamp_custom_url} alt="" className="w-12 h-12 rounded object-cover border border-[#E9E5E0]" />
                        <button type="button" onClick={() => setBrand((b) => ({ ...b, stamp_custom_url: '' }))}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#171412] text-white flex items-center justify-center"
                                aria-label="Supprimer">
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded border-2 border-dashed border-[#E9E5E0] flex items-center justify-center text-[#8D857D]">
                        <ImagePlus size={18} />
                      </div>
                    )}
                    <label className="cursor-pointer text-[12px] text-[#B85C38] font-semibold hover:underline">
                      Choisir une image…
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files && e.target.files[0];
                          if (!f) return;
                          try {
                            const dataUrl = await compressImage(f, 200, 0.85);
                            setBrand((b) => ({ ...b, stamp_custom_url: dataUrl }));
                          } catch { /* swallow — bad image */ }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Colour pickers — stamp fill, empty, ink */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Tampon rempli</label>
                  <input type="color" value={brand.stamp_fill_color}
                         onChange={(e) => setBrand((b) => ({ ...b, stamp_fill_color: e.target.value }))}
                         className="w-full h-9 rounded border border-[#E9E5E0]" />
                </div>
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Tampon vide</label>
                  <input type="color" value={brand.stamp_empty_color}
                         onChange={(e) => setBrand((b) => ({ ...b, stamp_empty_color: e.target.value }))}
                         className="w-full h-9 rounded border border-[#E9E5E0]" />
                </div>
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Icône (✓)</label>
                  <input type="color" value={brand.stamp_ink_color}
                         onChange={(e) => setBrand((b) => ({ ...b, stamp_ink_color: e.target.value }))}
                         className="w-full h-9 rounded border border-[#E9E5E0]" />
                </div>
              </div>

              {/* Size + label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Taille (px)</label>
                  <input type="range" min="18" max="40" value={brand.stamp_size}
                         onChange={(e) => setBrand((b) => ({ ...b, stamp_size: parseInt(e.target.value, 10) }))}
                         className="w-full" />
                  <p className="text-[11px] text-[#171412] mt-1">{brand.stamp_size}px</p>
                </div>
                <div>
                  <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Étiquette</label>
                  <input type="text" value={brand.stamps_label}
                         onChange={(e) => setBrand((b) => ({ ...b, stamps_label: e.target.value }))}
                         placeholder="Vos tampons"
                         className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                </div>
              </div>

              {/* Meter (progress bar) settings */}
              <div className="border-t border-[#F0EAE0] pt-4">
                <label className="flex items-center gap-2 text-[12px] font-bold text-[#171412] cursor-pointer mb-2">
                  <input type="checkbox" checked={brand.show_meter !== false}
                         onChange={(e) => setBrand((b) => ({ ...b, show_meter: e.target.checked }))} />
                  Afficher la jauge de points
                </label>
                {brand.show_meter !== false && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Couleur de remplissage</label>
                      <input type="color" value={brand.meter_fill_color}
                             onChange={(e) => setBrand((b) => ({ ...b, meter_fill_color: e.target.value }))}
                             className="w-full h-9 rounded border border-[#E9E5E0]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Couleur de fond</label>
                      <input type="color" value={brand.meter_track_color}
                             onChange={(e) => setBrand((b) => ({ ...b, meter_track_color: e.target.value }))}
                             className="w-full h-9 rounded border border-[#E9E5E0]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8D857D] mb-1 font-bold uppercase tracking-wider">Étiquette jauge points</label>
                      <input type="text" value={brand.meter_label}
                             onChange={(e) => setBrand((b) => ({ ...b, meter_label: e.target.value }))}
                             placeholder="Progression"
                             className="w-full px-3 py-2 rounded-lg border border-[#E9E5E0] text-sm" />
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle: show stamps grid */}
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#171412] cursor-pointer">
                <input type="checkbox" checked={brand.show_stamps_grid !== false}
                       onChange={(e) => setBrand((b) => ({ ...b, show_stamps_grid: e.target.checked }))} />
                Afficher la grille de tampons sur la carte
              </label>
            </div>
          </div>

          {/* Live preview column — the card renders standalone (no PhoneFrame,
              no Safari URL bar) so it reads as if it's already sitting inside
              the Apple Wallet app. Sticky so the owner can scroll through the
              editor on the left and never lose sight of the live result.
              Underneath the card we render an annotated map that names each
              of the 3 patches and which controls live there. */}
          <div
            className="card-designer-preview-pane self-start"
          >
            {/* Hyper-realistic iPhone 15 Pro frame. Titanium-edged body,
                Dynamic Island, real status bar (time / signal / Wi-Fi /
                battery), Apple Wallet's "Done / ⋯" detail-view top bar,
                home indicator at the bottom. Card lives inside this. */}
            <div
              className="mx-auto"
              style={{
                position: 'relative',
                width: 312,
                height: 640,
                borderRadius: 50,
                background: 'linear-gradient(155deg, #5C5A57 0%, #2A2826 26%, #181615 60%, #2E2C2A 100%)',
                padding: 6,
                boxShadow: '0 36px 70px -28px rgba(0,0,0,0.60), 0 14px 28px -10px rgba(0,0,0,0.32)',
              }}
            >
              {/* Inner black bezel ring */}
              <div style={{ position: 'absolute', inset: 4, borderRadius: 46, background: '#000', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }} />
              {/* Screen */}
              <div style={{ position: 'absolute', inset: 8, borderRadius: 42, overflow: 'hidden', background: '#000000' }}>
                {/* Status bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px 0', color: '#FFFFFF', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>9:41</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
                      <rect x="0"  y="6" width="3" height="4"  rx="0.6" fill="#FFFFFF" />
                      <rect x="4"  y="4" width="3" height="6"  rx="0.6" fill="#FFFFFF" />
                      <rect x="8"  y="2" width="3" height="8"  rx="0.6" fill="#FFFFFF" />
                      <rect x="12" y="0" width="3" height="10" rx="0.6" fill="#FFFFFF" />
                    </svg>
                    <svg width="14" height="10" viewBox="0 0 15 11" aria-hidden="true">
                      <path d="M7.5 10.2a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2zM7.5 6.6a3.3 3.3 0 012.35.97l1.05-1.05a4.8 4.8 0 00-6.8 0L5.15 7.57A3.3 3.3 0 017.5 6.6zm0-3.6a6.9 6.9 0 014.93 2.05l1.05-1.05A8.4 8.4 0 007.5 1.4 8.4 8.4 0 001.52 4l1.05 1.05A6.9 6.9 0 017.5 3z" fill="#FFFFFF"/>
                    </svg>
                    <svg width="26" height="11" viewBox="0 0 26 11" aria-hidden="true">
                      <rect x="0.5" y="0.5" width="21" height="10" rx="2.4" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" />
                      <rect x="2.2" y="2.2" width="15.6" height="6.6" rx="1.2" fill="#FFFFFF" />
                      <rect x="22.5" y="3.5" width="2" height="4" rx="0.6" fill="#FFFFFF" fillOpacity="0.55" />
                    </svg>
                  </div>
                </div>
                {/* Dynamic Island */}
                <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 96, height: 28, borderRadius: 999, background: '#000000', border: '1px solid #1A1A1A' }} />
                {/* Apple Wallet detail-view top bar */}
                <div style={{ position: 'absolute', top: 50, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', color: '#FFFFFF', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  <span style={{ fontSize: 16, fontWeight: 400 }}>OK</span>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, color: '#FFFFFF', letterSpacing: 1 }}>⋯</div>
                </div>
                {/* Card surface — sits just below the Wallet top bar */}
                <div style={{ position: 'absolute', top: 92, left: 10, right: 10, bottom: 26, overflowY: 'auto' }}>
                  <div className="relative">
                {(() => {
                  // The preview MUST run through the same switch as the
                  // customer page: what the owner sees while designing is
                  // literally what the customer gets.
                  const CardPreview = brand?.layout_style === 'wallet' ? WalletCard : PremiumLoyaltyCard;
                  return (
                    <CardPreview
                      customer={{
                        name: 'Marie Lefèvre',
                        first_name: 'Marie',
                        tier: 'Gold',
                        barcode_id: 'FT-1DFC4E62',
                        // Sample customer at 60% of one reward cycle so the
                        // owner sees a half-filled card. Visits are EXPRESSED
                        // as raw visits (not stamps), so we multiply by
                        // visits_per_stamp to get the correct underlying count.
                        visits: Math.floor((parseInt(rules.reward_threshold_stamps, 10) || 10) * 0.6) * (Math.max(1, parseInt(rules.visits_per_stamp, 10) || 1)),
                        reward_threshold: parseInt(rules.reward_threshold_stamps, 10) || 10,
                        offers_count: 1,
                        birthday: '12/05',
                      }}
                      tenant={{ name: tenant?.name || tenant?.business_name || 'Mon commerce' }}
                      card={{
                        ...brand,
                        // Merge loyalty rules so the points meter on the preview
                        // reflects the owner's current points-per-visit setting.
                        points_per_visit: parseInt(rules.points_per_visit, 10) || 10,
                        visits_per_stamp: parseInt(rules.visits_per_stamp, 10) || 1,
                      }}
                      compact
                    />
                  );
                })()}
                {/* Numbered band tags overlaid on the card so the owner can
                    visually anchor each editor section to a strip. */}
                {/* Numbered band tags overlaid on the card (legend below) */}
                <span className="absolute -left-1 top-[8%] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#3FA9D9', color: '#FFFFFF', letterSpacing: '0.10em' }}>1</span>
                <span className="absolute -left-1 top-[40%] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#E8A53B', color: '#FFFFFF', letterSpacing: '0.10em' }}>2</span>
                <span className="absolute -left-1 top-[74%] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#20714C', color: '#FFFFFF', letterSpacing: '0.10em' }}>3</span>
                  </div>
                </div>
                {/* Home indicator bar */}
                <div aria-hidden="true" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 110, height: 5, background: 'var(--flc-card, #FFFFFF)', borderRadius: 3, opacity: 0.9 }} />
              </div>
            </div>

            {/* Map text — pictorial legend that shows what each band contains
                and which editor section controls it. */}
            <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: 'var(--flc-line, #E9E5E0)' }}>
              <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#8D857D] mb-2">Carte — légende</p>
              <ul className="space-y-2 text-[11.5px]">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: '#3FA9D9', color: '#FFFFFF' }}>1</span>
                  <div>
                    <div className="font-semibold text-[#171412]">Bande HAUT</div>
                    <div className="text-[#8D857D] leading-snug">Logo · nom du commerce · badge palier · "+ D'INFOS / N pts". Couleur = <span className="font-mono text-[10.5px] text-[#171412]">card_bg_color</span> (partagée avec la bande bas).</div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: '#E8A53B', color: '#FFFFFF' }}>2</span>
                  <div>
                    <div className="font-semibold text-[#171412]">Bande MILIEU</div>
                    <div className="text-[#8D857D] leading-snug">Image ou couleur · titre · sous-titre · encart offre. Couleur indépendante via <span className="font-mono text-[10.5px] text-[#171412]">strip_color</span> ou l'image téléversée.</div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: '#20714C', color: '#FFFFFF' }}>3</span>
                  <div>
                    <div className="font-semibold text-[#171412]">Bande BAS</div>
                    <div className="text-[#8D857D] leading-snug">Salutation · prénom · total visites · grille de tampons · jauge de points · QR code · code-barres · anniversaire. Même couleur que la bande haut.</div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
