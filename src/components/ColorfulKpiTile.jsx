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
  // Light-card variant — white surface, colored icon chip, dark text.
  // Matches the "beautiful, stunning" KPICard look the page had before.
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left p-5 rounded-2xl overflow-hidden transition-all
        ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : ''} ${className}`}
      style={{
        background: '#FFFFFF',
        color: '#1C1917',
        border: `1px solid #E7E5E4`,
        boxShadow: '0 1px 2px rgba(28,25,23,0.04)',
      }}
    >
      {/* Top-right slot (Send Campaign etc.) */}
      {topRight && (
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          {topRight}
        </div>
      )}

      {/* Soft accent blob in the corner — gives each tile its color identity
          without sacrificing readability. */}
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: accent }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: '#57534E' }}
          >
            {title}
          </p>
          <p
            className="mt-2 font-bold leading-none"
            style={{ fontSize: 36, fontFamily: 'Cormorant Garamond', color: '#1C1917' }}
          >
            {loading ? <span className="inline-block w-16 h-7 bg-stone-200 rounded animate-pulse" /> : value}
          </p>
          {sublabel && (
            <p className="mt-1.5 text-xs line-clamp-2" style={{ color: '#8B8680' }}>
              {sublabel}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: `${accent}1A`,
              border: `1px solid ${accent}33`,
              color: accent,
            }}
          >
            <Icon size={20} />
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
            accent={accent}
            compact
          />
        </div>
      )}
    </Tag>
  );
};

export default ColorfulKpiTile;
