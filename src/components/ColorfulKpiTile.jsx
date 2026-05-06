import React from 'react';
import PeriodPicker from './PeriodPicker';

/**
 * ColorfulKpiTile — vibrant gradient KPI card.
 *
 * Visual differences vs. the old plain white KPICard:
 *   • Saturated gradient background derived from `accent`
 *   • White text + glassy icon chip
 *   • Optional inline <PeriodPicker /> at the bottom
 *
 * Props:
 *   icon          → lucide-react icon component
 *   title         → label (uppercased)
 *   value         → big number / text
 *   sublabel      → small grey-on-light caption
 *   accent        → primary hex color (drives the gradient)
 *   accentDeep    → optional darker stop for the gradient (defaults to a 30% darker shade)
 *   onClick       → click-to-drill handler
 *   period        → { value, unit } (omit to skip the picker — for time-proof tiles)
 *   onPeriodChange→ (days, { value, unit }) => void
 *   topRight      → optional ReactNode rendered top-right (e.g. a Send Campaign button)
 *   loading       → boolean — shows a pulsing skeleton on the value
 */

// Derive a slightly darker stop for the gradient. Cheap RGB → 0.7 multiply.
const darken = (hex, factor = 0.7) => {
  if (!hex || hex.length < 7) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
};

const ColorfulKpiTile = ({
  icon: Icon,
  title,
  value,
  sublabel,
  accent = '#B85C38',
  accentDeep,
  onClick,
  period,
  onPeriodChange,
  topRight,
  loading = false,
  className = '',
}) => {
  const deep = accentDeep || darken(accent, 0.72);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left p-5 rounded-2xl overflow-hidden transition-all
        ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl' : ''} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${deep} 100%)`,
        color: 'white',
        border: `1px solid ${deep}`,
        boxShadow: `0 6px 20px -10px ${accent}99`,
      }}
    >
      {/* Top-right slot (Send Campaign etc.) */}
      {topRight && (
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          {topRight}
        </div>
      )}

      {/* Decorative blob */}
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-10 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: 'white' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: 'white' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
            {title}
          </p>
          <p
            className="mt-2 font-bold leading-none text-white"
            style={{ fontSize: 36, fontFamily: 'Cormorant Garamond' }}
          >
            {loading ? <span className="inline-block w-16 h-7 bg-white/20 rounded animate-pulse" /> : value}
          </p>
          {sublabel && (
            <p className="mt-1.5 text-xs text-white/75 line-clamp-2">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <Icon size={20} className="text-white" />
          </div>
        )}
      </div>

      {/* Per-tile period picker */}
      {period && onPeriodChange && (
        <div className="relative mt-3 flex justify-start">
          <PeriodPicker
            value={period.value}
            unit={period.unit}
            onChange={onPeriodChange}
            onDark
            compact
          />
        </div>
      )}
    </Tag>
  );
};

export default ColorfulKpiTile;
