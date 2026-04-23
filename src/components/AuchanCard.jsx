/**
 * AuchanCard.jsx — shared loyalty-card layout + editor.
 *
 * Exports:
 *   - DEFAULT_LAYOUT         canonical empty layout
 *   - FONT_LIST              30+ Google Font families
 *   - substitute(text, ctx)  replace {first_name} etc.
 *   - AuchanPreview          read-only render of the card (for customer page)
 *   - AuchanEditor           side-by-side editor with live preview
 *   - LockScreenPushPreview  iPhone lock-screen notification preview
 */
import React, { useState } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, RotateCcw } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Font catalogue (families imported in src/index.css)               */
/* ------------------------------------------------------------------ */
export const FONT_LIST = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway',
  'Oswald', 'Bebas Neue', 'Playfair Display', 'Merriweather', 'PT Serif',
  'Lora', 'Cormorant Garamond', 'Libre Baskerville', 'Nunito', 'Quicksand',
  'Work Sans', 'Rubik', 'DM Serif Display', 'Abril Fatface', 'Pacifico',
  'Dancing Script', 'Caveat', 'Shadows Into Light', 'Special Elite',
  'Press Start 2P', 'Geist Variable', 'Times New Roman', 'Arial', 'Georgia',
];

/* ------------------------------------------------------------------ */
/*  Default layout — matches the Auchan reference card                */
/* ------------------------------------------------------------------ */
const defaultSlot = (over = {}) => ({
  visible: true,
  text: '',
  font: 'Inter',
  size: 14,
  color: '#1C1917',
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  ...over,
});

export const DEFAULT_LAYOUT = {
  card_bg_color: '#FFFFFF',
  banner_bg_color: '#E30613',
  banner_image_url: '',
  logo_url: '',
  slots: {
    plus_dinfos: defaultSlot({
      text: 'PLUS D’INFOS sur ...',
      size: 11,
      color: '#6B7280',
      align: 'right',
      bold: true,
    }),
    banner_eyebrow: defaultSlot({
      text: 'Du 28 mars au 1er avril 2023',
      size: 11,
      color: '#FFFFFF',
      align: 'center',
    }),
    banner_subtitle: defaultSlot({
      text: 'par tranche de 15€ sur les chocolats de pâques',
      size: 11,
      color: '#FFFFFF',
      align: 'center',
    }),
    banner_title: defaultSlot({
      text: '5€ offerts',
      size: 34,
      color: '#FFFFFF',
      bold: true,
      align: 'center',
      font: 'Montserrat',
    }),
    banner_tag: defaultSlot({
      text: 'sur vos prochaines courses',
      size: 10,
      color: '#E30613',
      bold: true,
      align: 'center',
    }),
    greeting_label: defaultSlot({
      text: 'BONJOUR',
      size: 10,
      color: '#9CA3AF',
      bold: true,
    }),
    greeting_name: defaultSlot({
      text: '{first_name}',
      size: 22,
      color: '#1C1917',
      bold: true,
      font: 'Montserrat',
    }),
    points_label: defaultSlot({
      text: 'MA CAGNOTTE',
      size: 10,
      color: '#9CA3AF',
      bold: true,
      align: 'right',
    }),
    points_value: defaultSlot({
      text: '{points} €',
      size: 22,
      color: '#1C1917',
      bold: true,
      align: 'right',
      font: 'Montserrat',
    }),
    loyalty_label: defaultSlot({
      text: 'N° fidélité :',
      size: 12,
      color: '#6B7280',
      align: 'center',
    }),
    loyalty_number: defaultSlot({
      text: '{loyalty_number}',
      size: 12,
      color: '#6B7280',
      align: 'center',
    }),
  },
  push: {
    title: '',            // default = business name
    body: '5€ offerts 🛒 Sur vos prochaines courses dès 15€ d’achat, jusqu’au 01/04.',
  },
};

/* ------------------------------------------------------------------ */
/*  Template-variable substitution                                    */
/* ------------------------------------------------------------------ */
export function substitute(text, ctx = {}) {
  if (!text) return '';
  const vars = {
    first_name: ctx.first_name || ctx.name?.split(' ')?.[0] || 'Sophie',
    name: ctx.name || 'Sophie Dupont',
    points: ctx.points ?? '3.4',
    tier: ctx.tier || 'Bronze',
    birthday: ctx.birthday || '12 Mai',
    business_name: ctx.business_name || 'Mon commerce',
    loyalty_number: ctx.loyalty_number || '049130960',
    amount: ctx.amount ?? ctx.points ?? '3.4',
  };
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/* ------------------------------------------------------------------ */
/*  Slot renderer                                                     */
/* ------------------------------------------------------------------ */
function SlotText({ slot, ctx, className = '', style: extraStyle = {} }) {
  if (!slot || slot.visible === false) return null;
  const style = {
    fontFamily: `'${slot.font}', sans-serif`,
    fontSize: `${slot.size}px`,
    color: slot.color,
    fontWeight: slot.bold ? 700 : 400,
    fontStyle: slot.italic ? 'italic' : 'normal',
    textDecoration: slot.underline ? 'underline' : 'none',
    textAlign: slot.align || 'left',
    lineHeight: 1.15,
    ...extraStyle,
  };
  return <div className={className} style={style}>{substitute(slot.text, ctx)}</div>;
}

/* ------------------------------------------------------------------ */
/*  Barcode SVG (visual only)                                         */
/* ------------------------------------------------------------------ */
function Barcode({ value = '049130960' }) {
  // Render a dense strip of vertical bars — purely decorative.
  // Real scanning can be handled by the QR endpoint (unchanged).
  const bars = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) seed += value.charCodeAt(i);
  for (let i = 0; i < 90; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 1 + (seed % 3);
    bars.push(w);
  }
  let x = 0;
  return (
    <svg viewBox="0 0 180 40" width="100%" height="40" preserveAspectRatio="none">
      {bars.map((w, i) => {
        const r = <rect key={i} x={x} y={0} width={w} height={40} fill="#111827" />;
        x += w + 1;
        return r;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  AuchanPreview                                                      */
/* ------------------------------------------------------------------ */
export function AuchanPreview({ layout = DEFAULT_LAYOUT, ctx = {}, scale = 1 }) {
  const L = { ...DEFAULT_LAYOUT, ...layout, slots: { ...DEFAULT_LAYOUT.slots, ...(layout.slots || {}) } };
  const pad = `${16 * scale}px`;
  return (
    <div
      className="rounded-[22px] shadow-xl overflow-hidden relative"
      style={{
        width: `${320 * scale}px`,
        backgroundColor: L.card_bg_color,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between" style={{ padding: pad }}>
        <div
          className="rounded-md bg-gray-100 flex items-center justify-center overflow-hidden"
          style={{ width: `${68 * scale}px`, height: `${32 * scale}px` }}
        >
          {L.logo_url ? (
            <img src={L.logo_url} alt="logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-gray-400">logo</span>
          )}
        </div>
        <div style={{ maxWidth: '55%' }}>
          <SlotText slot={L.slots.plus_dinfos} ctx={ctx} />
        </div>
      </div>

      {/* PROMO BANNER */}
      <div
        className="mx-3 rounded-lg relative overflow-hidden flex items-center"
        style={{ backgroundColor: L.banner_bg_color, minHeight: `${108 * scale}px` }}
      >
        <div className="flex-1 px-3 py-2 space-y-1 relative">
          <SlotText slot={L.slots.banner_eyebrow} ctx={ctx} />
          <SlotText slot={L.slots.banner_subtitle} ctx={ctx} />
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="flex flex-col items-center">
              <SlotText slot={L.slots.banner_title} ctx={ctx} />
              <div className="bg-white rounded-full px-2 py-0.5 -mt-1">
                <SlotText slot={L.slots.banner_tag} ctx={ctx} />
              </div>
            </div>
          </div>
        </div>
        {L.banner_image_url && (
          <div
            className="rounded-full bg-white overflow-hidden flex-shrink-0 mr-2 border-2 border-white shadow"
            style={{ width: `${72 * scale}px`, height: `${72 * scale}px` }}
          >
            <img src={L.banner_image_url} alt="promo" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* GREETING + POINTS */}
      <div className="flex justify-between items-end px-4 pt-3 pb-2">
        <div>
          <SlotText slot={L.slots.greeting_label} ctx={ctx} />
          <SlotText slot={L.slots.greeting_name} ctx={ctx} />
        </div>
        <div>
          <SlotText slot={L.slots.points_label} ctx={ctx} />
          <SlotText slot={L.slots.points_value} ctx={ctx} />
        </div>
      </div>

      {/* BARCODE */}
      <div className="px-6 py-3 flex justify-center">
        <div style={{ width: '100%', maxWidth: `${220 * scale}px` }}>
          <Barcode value={substitute(L.slots.loyalty_number?.text, ctx)} />
        </div>
      </div>

      {/* LOYALTY NUMBER */}
      <div className="pb-4 px-4 flex items-center justify-center gap-1">
        <SlotText slot={L.slots.loyalty_label} ctx={ctx} style={{ display: 'inline' }} />
        <span>&nbsp;</span>
        <SlotText slot={L.slots.loyalty_number} ctx={ctx} style={{ display: 'inline' }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LockScreenPushPreview                                              */
/* ------------------------------------------------------------------ */
export function LockScreenPushPreview({ title, body, businessName = 'Mon commerce' }) {
  const t = title || businessName;
  return (
    <div className="relative mx-auto" style={{ width: 260 }}>
      <div
        className="rounded-[40px] p-3 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg,#1e3a8a 0%,#0f172a 100%)',
          minHeight: 480,
        }}
      >
        <div className="text-center text-white pt-8">
          <div className="text-xs opacity-80">jeudi 30 mars</div>
          <div className="text-6xl font-light tracking-tight">11:52</div>
        </div>
        <div className="mt-64">
          <div className="bg-white/15 backdrop-blur rounded-2xl p-3 text-white text-[11px] leading-tight">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t}</div>
              <div className="opacity-70">now</div>
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words">{body || 'Your push body…'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AuchanEditor                                                       */
/* ------------------------------------------------------------------ */
const SLOT_LABELS = {
  plus_dinfos: 'Top-right link (PLUS D’INFOS)',
  banner_eyebrow: 'Banner · date / eyebrow',
  banner_subtitle: 'Banner · subtitle',
  banner_title: 'Banner · main headline',
  banner_tag: 'Banner · highlight tag',
  greeting_label: 'Greeting label (BONJOUR)',
  greeting_name: 'Customer name',
  points_label: 'Points label (MA CAGNOTTE)',
  points_value: 'Points value',
  loyalty_label: 'Loyalty-number label',
  loyalty_number: 'Loyalty number',
};

function SlotEditor({ slotKey, slot, onChange }) {
  const update = (patch) => onChange({ ...slot, ...patch });
  const labelCls = 'text-[11px] font-bold text-gray-500 uppercase tracking-wider';
  const btn = (active) =>
    `p-1.5 rounded border ${active ? 'bg-[#B85C38] text-white border-[#B85C38]' : 'bg-white border-gray-200 text-gray-600'}`;

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-white space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[#1C1917]">{SLOT_LABELS[slotKey] || slotKey}</div>
        <button
          type="button"
          onClick={() => update({ visible: !slot.visible })}
          className={`text-xs flex items-center gap-1 ${slot.visible ? 'text-green-600' : 'text-gray-400'}`}
        >
          {slot.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          {slot.visible ? 'visible' : 'hidden'}
        </button>
      </div>
      <input
        type="text"
        value={slot.text}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="Text (use {first_name}, {points}, {loyalty_number}, {business_name})"
        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={labelCls}>Font</div>
          <select
            value={slot.font}
            onChange={(e) => update({ font: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1"
          >
            {FONT_LIST.map((f) => (
              <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>Size · {slot.size}px</div>
          <input
            type="range" min="8" max="48" value={slot.size}
            onChange={(e) => update({ size: parseInt(e.target.value, 10) })}
            className="w-full"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <div className={labelCls}>Color</div>
          <input
            type="color" value={slot.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-9 h-8 border border-gray-200 rounded cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={btn(slot.bold)} onClick={() => update({ bold: !slot.bold })}><Bold size={12} /></button>
          <button type="button" className={btn(slot.italic)} onClick={() => update({ italic: !slot.italic })}><Italic size={12} /></button>
          <button type="button" className={btn(slot.underline)} onClick={() => update({ underline: !slot.underline })}><Underline size={12} /></button>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" className={btn(slot.align === 'left')} onClick={() => update({ align: 'left' })}><AlignLeft size={12} /></button>
          <button type="button" className={btn(slot.align === 'center')} onClick={() => update({ align: 'center' })}><AlignCenter size={12} /></button>
          <button type="button" className={btn(slot.align === 'right')} onClick={() => update({ align: 'right' })}><AlignRight size={12} /></button>
        </div>
      </div>
    </div>
  );
}

export function AuchanEditor({ layout, onChange, ctx = {}, businessName }) {
  const [activeTab, setActiveTab] = useState('card');
  const L = { ...DEFAULT_LAYOUT, ...layout, slots: { ...DEFAULT_LAYOUT.slots, ...(layout?.slots || {}) }, push: { ...DEFAULT_LAYOUT.push, ...(layout?.push || {}) } };

  const setSlot = (key, nextSlot) => onChange({ ...L, slots: { ...L.slots, [key]: nextSlot } });
  const setField = (key, val) => onChange({ ...L, [key]: val });
  const setPush = (key, val) => onChange({ ...L, push: { ...L.push, [key]: val } });

  const resetSlot = (key) => setSlot(key, DEFAULT_LAYOUT.slots[key]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6">
      {/* ---------- Controls ---------- */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {[
            ['card', 'Card elements'],
            ['style', 'Colors & images'],
            ['push', 'Lock-screen push'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === k ? 'border-[#B85C38] text-[#B85C38]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'card' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Layout is fixed (logo top-left, promo banner, greeting + points, barcode, loyalty number). Every text slot below is fully editable.
            </p>
            {Object.keys(SLOT_LABELS).map((key) => (
              <div key={key} className="relative">
                <SlotEditor slotKey={key} slot={L.slots[key]} onChange={(s) => setSlot(key, s)} />
                <button
                  type="button"
                  onClick={() => resetSlot(key)}
                  className="absolute -top-1 -right-1 bg-white border border-gray-200 rounded-full p-1 text-gray-400 hover:text-[#B85C38]"
                  title="Reset to default"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'style' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Card background</label>
                <input type="color" value={L.card_bg_color} onChange={(e) => setField('card_bg_color', e.target.value)} className="w-full h-10 border rounded" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Banner background</label>
                <input type="color" value={L.banner_bg_color} onChange={(e) => setField('banner_bg_color', e.target.value)} className="w-full h-10 border rounded" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Logo URL</label>
              <input type="text" value={L.logo_url} onChange={(e) => setField('logo_url', e.target.value)} placeholder="https://…/logo.png" className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Banner image URL (optional)</label>
              <input type="text" value={L.banner_image_url} onChange={(e) => setField('banner_image_url', e.target.value)} placeholder="https://…/promo.jpg" className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
        )}

        {activeTab === 'push' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Sets the default text used when you send a push notification. Customers see it on their lock screen and tapping opens their wallet card.</p>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Title (defaults to business name)</label>
              <input type="text" value={L.push.title} onChange={(e) => setPush('title', e.target.value)} placeholder={businessName || 'Business name'} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Body</label>
              <textarea rows={4} value={L.push.body} onChange={(e) => setPush('body', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex justify-center pt-2">
              <LockScreenPushPreview title={L.push.title} body={L.push.body} businessName={businessName} />
            </div>
          </div>
        )}
      </div>

      {/* ---------- Live preview (sticky) ---------- */}
      <div className="lg:sticky lg:top-4 self-start">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">Live preview</div>
        <div className="bg-gray-100 rounded-xl p-4 flex justify-center">
          <AuchanPreview layout={L} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

export default AuchanPreview;
