/**
 * AuchanCard.jsx — shared loyalty-card layout + editor.
 *
 * Exports:
 *   - DEFAULT_LAYOUT
 *   - FONT_LIST
 *   - substitute(text, ctx)
 *   - AuchanPreview
 *   - AuchanEditor
 *   - LockScreenPushPreview
 */
import React, { useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Eye, EyeOff, RotateCcw, Hexagon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Font catalogue                                                    */
/* ------------------------------------------------------------------ */
export const FONT_LIST = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway',
  'Oswald', 'Bebas Neue', 'Playfair Display', 'Merriweather', 'PT Serif',
  'Lora', 'Cormorant Garamond', 'Libre Baskerville', 'Nunito', 'Quicksand',
  'Work Sans', 'Rubik', 'DM Serif Display', 'Abril Fatface', 'Pacifico',
  'Dancing Script', 'Caveat', 'Shadows Into Light', 'Special Elite',
  'Press Start 2P', 'Geist Variable', 'Times New Roman', 'Arial', 'Georgia',
];

const STAMP_STYLES = [
  { id: 'none',    label: 'No stamps' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'dots',    label: 'Dots' },
  { id: 'circles', label: 'Circles' },
  { id: 'squares', label: 'Squares' },
  { id: 'stars',   label: 'Stars' },
];

/* ------------------------------------------------------------------ */
/*  Default layout                                                    */
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
  // stamps
  stamp_style: 'hexagon',
  stamps_target: 10,
  stamps_color_empty: '#E5E7EB',
  stamps_color_filled: '#B85C38',
  // meter
  meter: {
    enabled: true,
    color_empty: '#E5E7EB',
    color_filled: '#22C55E',
    label: '{stamps_earned} / {stamps_target} visits',
    label_color: '#6B7280',
    label_size: 10,
  },
  slots: {
    plus_dinfos: defaultSlot({
      text: 'PLUS D’INFOS sur ...',
      size: 11, color: '#6B7280', align: 'right', bold: true,
    }),
    banner_eyebrow: defaultSlot({
      text: 'Du 28 mars au 1er avril 2023',
      size: 11, color: '#FFFFFF', align: 'center',
    }),
    banner_subtitle: defaultSlot({
      text: 'par tranche de 15€ sur les chocolats de pâques',
      size: 11, color: '#FFFFFF', align: 'center',
    }),
    banner_title: defaultSlot({
      text: '5€ offerts',
      size: 34, color: '#FFFFFF', bold: true, align: 'center',
      font: 'Montserrat',
    }),
    banner_tag: defaultSlot({
      text: 'sur vos prochaines courses',
      size: 10, color: '#E30613', bold: true, align: 'center',
    }),
    greeting_label: defaultSlot({
      text: 'BONJOUR', size: 10, color: '#9CA3AF', bold: true,
    }),
    greeting_name: defaultSlot({
      text: '{first_name}', size: 22, color: '#1C1917', bold: true, font: 'Montserrat',
    }),
    points_label: defaultSlot({
      text: 'MA CAGNOTTE', size: 10, color: '#9CA3AF', bold: true, align: 'right',
    }),
    points_value: defaultSlot({
      text: '{points} €', size: 22, color: '#1C1917', bold: true, align: 'right',
      font: 'Montserrat',
    }),
    // New slots
    business_name: defaultSlot({
      text: '{business_name}', size: 13, color: '#1C1917', bold: true, align: 'left',
    }),
    customer_name: defaultSlot({
      text: '{name}', size: 12, color: '#6B7280', align: 'left',
    }),
    birthday: defaultSlot({
      text: '🎂 {birthday}', size: 12, color: '#6B7280', align: 'right',
    }),
    points: defaultSlot({
      text: '⭐ {points} pts', size: 12, color: '#B85C38', bold: true, align: 'right',
    }),
  },
  push: {
    title: '',
    body: '5€ offerts 🛒 Sur vos prochaines courses dès 15€ d’achat, jusqu’au 01/04.',
  },
};

/* ------------------------------------------------------------------ */
/*  Template substitution                                             */
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
    stamps_earned: ctx.stamps_earned ?? 7,
    stamps_target: ctx.stamps_target ?? 10,
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
/*  Stamps                                                            */
/* ------------------------------------------------------------------ */
function Stamp({ style, filled, size, colorEmpty, colorFilled }) {
  const color = filled ? colorFilled : colorEmpty;
  switch (style) {
    case 'hexagon':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <polygon
            points="50,5 93.3,27.5 93.3,72.5 50,95 6.7,72.5 6.7,27.5"
            fill={filled ? color : 'none'}
            stroke={color}
            strokeWidth="6"
          />
        </svg>
      );
    case 'dots':
    case 'circles':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40"
            fill={filled ? color : 'none'}
            stroke={color}
            strokeWidth={style === 'dots' ? 0 : 6} />
        </svg>
      );
    case 'squares':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <rect x="10" y="10" width="80" height="80" rx="10"
            fill={filled ? color : 'none'}
            stroke={color}
            strokeWidth="6" />
        </svg>
      );
    case 'stars':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <polygon
            points="50,8 62,38 94,38 68,58 78,90 50,72 22,90 32,58 6,38 38,38"
            fill={filled ? color : 'none'}
            stroke={color}
            strokeWidth="4"
          />
        </svg>
      );
    default:
      return null;
  }
}

function StampsRow({ layout, ctx }) {
  if (!layout.stamp_style || layout.stamp_style === 'none') return null;
  const target = Math.max(1, Math.min(14, layout.stamps_target || 10));
  const earned = Math.max(0, Math.min(target, Number(ctx.stamps_earned ?? 7)));
  const size = target > 10 ? 22 : target > 8 ? 26 : 30;
  return (
    <div className="px-4 pt-2 pb-1 flex items-center justify-center gap-1.5 flex-wrap">
      {Array.from({ length: target }).map((_, i) => (
        <Stamp
          key={i}
          style={layout.stamp_style}
          filled={i < earned}
          size={size}
          colorEmpty={layout.stamps_color_empty}
          colorFilled={layout.stamps_color_filled}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Meter                                                             */
/* ------------------------------------------------------------------ */
function MeterBar({ layout, ctx }) {
  const m = layout.meter || {};
  if (!m.enabled) return null;
  const target = Math.max(1, layout.stamps_target || 10);
  const earned = Math.max(0, Math.min(target, Number(ctx.stamps_earned ?? 7)));
  const pct = Math.round((earned / target) * 100);
  const labelText = substitute(m.label || '', { ...ctx, stamps_earned: earned, stamps_target: target });
  return (
    <div className="px-4 pt-1 pb-2">
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: m.color_empty || '#E5E7EB' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: m.color_filled || '#22C55E' }}
        />
      </div>
      {labelText && (
        <div
          className="text-center mt-1"
          style={{ color: m.label_color || '#6B7280', fontSize: `${m.label_size || 10}px` }}
        >
          {labelText}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Barcode                                                           */
/* ------------------------------------------------------------------ */
function Barcode({ value = '049130960' }) {
  const bars = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) seed += value.charCodeAt(i);
  for (let i = 0; i < 110; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    bars.push(1 + (seed % 3));
  }
  let x = 0;
  return (
    <svg viewBox="0 0 220 44" width="100%" height="44" preserveAspectRatio="none">
      {bars.map((w, i) => {
        const r = <rect key={i} x={x} y={0} width={w} height={44} fill="#111827" />;
        x += w + 1;
        return r;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  AuchanPreview                                                     */
/* ------------------------------------------------------------------ */
export function AuchanPreview({ layout = DEFAULT_LAYOUT, ctx = {}, width = 380 }) {
  const L = {
    ...DEFAULT_LAYOUT,
    ...layout,
    meter: { ...DEFAULT_LAYOUT.meter, ...(layout.meter || {}) },
    slots: { ...DEFAULT_LAYOUT.slots, ...(layout.slots || {}) },
  };
  return (
    <div
      className="rounded-[22px] shadow-xl overflow-hidden relative"
      style={{ width: `${width}px`, backgroundColor: L.card_bg_color, fontFamily: "'Inter', sans-serif" }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between p-4">
        <div className="rounded-md bg-gray-100 flex items-center justify-center overflow-hidden" style={{ width: 78, height: 38 }}>
          {L.logo_url
            ? <img src={L.logo_url} alt="logo" className="w-full h-full object-contain" />
            : <span className="text-[10px] text-gray-400">logo</span>}
        </div>
        <div style={{ maxWidth: '55%' }}>
          <SlotText slot={L.slots.plus_dinfos} ctx={ctx} />
        </div>
      </div>

      {/* PROMO BANNER */}
      <div className="mx-3 rounded-lg relative overflow-hidden flex items-center" style={{ backgroundColor: L.banner_bg_color, minHeight: 116 }}>
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
          <div className="rounded-full bg-white overflow-hidden flex-shrink-0 mr-2 border-2 border-white shadow" style={{ width: 78, height: 78 }}>
            <img src={L.banner_image_url} alt="promo" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* GREETING + POINTS */}
      <div className="flex justify-between items-end px-4 pt-3 pb-1">
        <div>
          <SlotText slot={L.slots.greeting_label} ctx={ctx} />
          <SlotText slot={L.slots.greeting_name} ctx={ctx} />
        </div>
        <div>
          <SlotText slot={L.slots.points_label} ctx={ctx} />
          <SlotText slot={L.slots.points_value} ctx={ctx} />
        </div>
      </div>

      {/* EXTRA INFO ROW */}
      <div className="flex justify-between items-center gap-2 px-4 pt-1 pb-2">
        <div className="flex flex-col flex-1 min-w-0">
          <SlotText slot={L.slots.business_name} ctx={ctx} />
          <SlotText slot={L.slots.customer_name} ctx={ctx} />
        </div>
        <div className="flex flex-col items-end flex-1 min-w-0">
          <SlotText slot={L.slots.birthday} ctx={ctx} />
          <SlotText slot={L.slots.points} ctx={ctx} />
        </div>
      </div>

      {/* STAMPS */}
      <StampsRow layout={L} ctx={ctx} />

      {/* METER */}
      <MeterBar layout={L} ctx={ctx} />

      {/* BARCODE */}
      <div className="px-6 py-3 pb-5 flex justify-center">
        <div style={{ width: '100%', maxWidth: 260 }}>
          <Barcode value={substitute('{loyalty_number}', ctx)} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LockScreenPushPreview                                             */
/* ------------------------------------------------------------------ */
export function LockScreenPushPreview({ title, body, businessName = 'Mon commerce' }) {
  const t = title || businessName;
  return (
    <div className="relative mx-auto" style={{ width: 260 }}>
      <div className="rounded-[40px] p-3 shadow-2xl" style={{ background: 'linear-gradient(180deg,#1e3a8a 0%,#0f172a 100%)', minHeight: 480 }}>
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
/*  Slot editor                                                       */
/* ------------------------------------------------------------------ */
const SLOT_LABELS = {
  plus_dinfos:     'Top-right link (PLUS D’INFOS)',
  banner_eyebrow:  'Banner · date / eyebrow',
  banner_subtitle: 'Banner · subtitle',
  banner_title:    'Banner · main headline',
  banner_tag:      'Banner · highlight tag',
  greeting_label:  'Greeting label (BONJOUR)',
  greeting_name:   'Customer first name (greeting)',
  points_label:    'Points label (MA CAGNOTTE)',
  points_value:    'Points value (headline)',
  business_name:   'Business name',
  customer_name:   'Customer full name',
  birthday:        'Customer birthday',
  points:          'Points (secondary)',
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
        placeholder="Text — use {first_name}, {name}, {points}, {birthday}, {business_name}"
        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={labelCls}>Font</div>
          <select value={slot.font} onChange={(e) => update({ font: e.target.value })} className="w-full text-sm border border-gray-200 rounded px-2 py-1">
            {FONT_LIST.map((f) => (
              <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>Size · {slot.size}px</div>
          <input type="range" min="8" max="48" value={slot.size} onChange={(e) => update({ size: parseInt(e.target.value, 10) })} className="w-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <div className={labelCls}>Color</div>
          <input type="color" value={slot.color} onChange={(e) => update({ color: e.target.value })} className="w-9 h-8 border border-gray-200 rounded cursor-pointer" />
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

/* ------------------------------------------------------------------ */
/*  AuchanEditor                                                      */
/* ------------------------------------------------------------------ */
export function AuchanEditor({ layout, onChange, ctx = {}, businessName }) {
  const [activeTab, setActiveTab] = useState('card');
  const L = {
    ...DEFAULT_LAYOUT,
    ...layout,
    meter: { ...DEFAULT_LAYOUT.meter, ...(layout?.meter || {}) },
    slots: { ...DEFAULT_LAYOUT.slots, ...(layout?.slots || {}) },
    push: { ...DEFAULT_LAYOUT.push, ...(layout?.push || {}) },
  };

  const setSlot  = (key, nextSlot) => onChange({ ...L, slots: { ...L.slots, [key]: nextSlot } });
  const setField = (key, val) => onChange({ ...L, [key]: val });
  const setPush  = (key, val) => onChange({ ...L, push: { ...L.push, [key]: val } });
  const setMeter = (patch)      => onChange({ ...L, meter: { ...L.meter, ...patch } });

  const resetSlot = (key) => setSlot(key, DEFAULT_LAYOUT.slots[key]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,460px] gap-6">
      {/* ---------- Controls ---------- */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-gray-200 flex-wrap">
          {[
            ['card',   'Card elements'],
            ['stamps', 'Stamps & meter'],
            ['style',  'Colors & images'],
            ['push',   'Lock-screen push'],
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
              Layout is fixed (logo · banner · greeting + points · extra info · stamps · meter · barcode). Every text slot is fully editable.
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

        {activeTab === 'stamps' && (
          <div className="space-y-4">
            {/* Stamps */}
            <div className="rounded-lg border border-gray-200 p-3 bg-white space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
                <Hexagon size={14} /> Stamps
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Style</label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {STAMP_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setField('stamp_style', s.id)}
                      className={`px-2 py-1.5 text-xs rounded border ${L.stamp_style === s.id ? 'bg-[#B85C38] text-white border-[#B85C38]' : 'bg-white text-gray-700 border-gray-200'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Target · {L.stamps_target}</label>
                  <input type="range" min="3" max="14" value={L.stamps_target} onChange={(e) => setField('stamps_target', parseInt(e.target.value, 10))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Empty color</label>
                  <input type="color" value={L.stamps_color_empty} onChange={(e) => setField('stamps_color_empty', e.target.value)} className="w-full h-9 border rounded" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Filled color</label>
                  <input type="color" value={L.stamps_color_filled} onChange={(e) => setField('stamps_color_filled', e.target.value)} className="w-full h-9 border rounded" />
                </div>
              </div>
            </div>

            {/* Meter */}
            <div className="rounded-lg border border-gray-200 p-3 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1C1917]">Points meter</div>
                <button
                  type="button"
                  onClick={() => setMeter({ enabled: !L.meter.enabled })}
                  className={`text-xs flex items-center gap-1 ${L.meter.enabled ? 'text-green-600' : 'text-gray-400'}`}
                >
                  {L.meter.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                  {L.meter.enabled ? 'visible' : 'hidden'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Empty color</label>
                  <input type="color" value={L.meter.color_empty} onChange={(e) => setMeter({ color_empty: e.target.value })} className="w-full h-9 border rounded" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Filled color</label>
                  <input type="color" value={L.meter.color_filled} onChange={(e) => setMeter({ color_filled: e.target.value })} className="w-full h-9 border rounded" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Label (use {'{stamps_earned}'} / {'{stamps_target}'})</label>
                <input
                  type="text"
                  value={L.meter.label}
                  onChange={(e) => setMeter({ label: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Label color</label>
                  <input type="color" value={L.meter.label_color} onChange={(e) => setMeter({ label_color: e.target.value })} className="w-full h-9 border rounded" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Label size · {L.meter.label_size}px</label>
                  <input type="range" min="8" max="20" value={L.meter.label_size} onChange={(e) => setMeter({ label_size: parseInt(e.target.value, 10) })} className="w-full" />
                </div>
              </div>
            </div>
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
            <p className="text-xs text-gray-500">Default push text — customers see it on their lock screen, tapping opens their wallet card.</p>
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

      {/* ---------- Live preview ---------- */}
      <div className="lg:sticky lg:top-4 self-start">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">Live preview</div>
        <div className="bg-gray-100 rounded-xl p-4 flex justify-center">
          <AuchanPreview layout={L} ctx={ctx} width={420} />
        </div>
      </div>
    </div>
  );
}

export default AuchanPreview;
