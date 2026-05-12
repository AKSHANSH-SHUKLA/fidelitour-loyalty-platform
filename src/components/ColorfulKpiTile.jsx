import React from 'react';
import PeriodPicker from './PeriodPicker';

/**
 * ColorfulKpiTile — vivid KPI card.
 *
 * Design notes for the "make it pop" version:
 *
 *   • The tile sits on a soft-to-medium GRADIENT (not flat pastel). This
 *     gives it depth without breaking the calm palette.
 *   • The icon chip is now SOLID in the tone's vivid colour, with a white
 *     icon glyph. This is the single biggest "premium look" lever — a
 *     vivid chip in the corner of every card.
 *   • A decorative blurred circle ("glow") sits behind the icon chip in
 *     the same vivid colour, adding atmosphere without noise.
 *   • The big number is rendered in the tone's deep ink — vivid, but
 *     readable.
 *   • Sparkline area-fill opacity bumped to 0.22 so the line is more
 *     present, and the line stroke is 1.8px instead of 1.4px.
 *   • Hover lift + soft shadow growth makes the tile feel "real" when
 *     it's clickable.
 *
 * Existing call sites are 100% backward compatible — the `tone` prop
 * unlocks the new look; `accent` still works for the neutral white tile.
 */

const TONE_STYLE = {
  success: {
    fill: 'var(--tone-success-gradient)',
    ink:  'var(--tone-success-ink)',
    line: 'var(--tone-success-line)',
    vivid:'var(--tone-success-vivid)',
    glow: 'var(--tone-success-glow)',
  },
  danger: {
    fill: 'var(--tone-danger-gradient)',
    ink:  'var(--tone-danger-ink)',
    line: 'var(--tone-danger-line)',
    vivid:'var(--tone-danger-vivid)',
    glow: 'var(--tone-danger-glow)',
  },
  warning: {
    fill: 'var(--tone-warning-gradient)',
    ink:  'var(--tone-warning-ink)',
    line: 'var(--tone-warning-line)',
    vivid:'var(--tone-warning-vivid)',
    glow: 'var(--tone-warning-glow)',
  },
  info: {
    fill: 'var(--tone-info-gradient)',
    ink:  'var(--tone-info-ink)',
    line: 'var(--tone-info-line)',
    vivid:'var(--tone-info-vivid)',
    glow: 'var(--tone-info-glow)',
  },
  purple: {
    fill: 'var(--tone-purple-gradient)',
    ink:  'var(--tone-purple-ink)',
    line: 'var(--tone-purple-line)',
    vivid:'var(--tone-purple-vivid)',
    glow: 'var(--tone-purple-glow)',
  },
  neutral: {
    fill: 'linear-gradient(135deg, #F1EEE8 0%, #FAF8F4 60%, #FCFAF6 100%)',
    ink:  'var(--ink)',
    line: 'var(--tone-neutral-line)',
    vivid:'#7A716C',
    glow: 'rgba(122, 113, 108, 0.22)',
  },
};

/** Inline sparkline with bigger presence: thicker stroke + denser fill
 *  so the chart reads as part of the tile, not decoration. */
const Sparkline = ({ points = [], stroke = '#7A716C', width = 100, height = 32 }) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const xy = points.map((p, i) => [i * stepX, height - 3 - ((p - min) / range) * (height - 6)]);
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path d={area} fill={stroke} opacity="0.22" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const DeltaPill = ({ delta, ink }) => {
  if (!delta || typeof delta.value !== 'number') return null;
  const sign = delta.sign || (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat');
  const arrow = sign === 'up' ? '↗' : sign === 'down' ? '↘' : '→';
  const abs = Math.abs(delta.value);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5"
      style={{
        color: ink || 'var(--ink-soft)',
        background: 'rgba(255,255,255,0.75)',
        fontWeight: 600,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
      }}
    >
      <span aria-hidden="true">{arrow}</span>
      {sign === 'up' && '+'}{sign === 'down' && '-'}{abs.toFixed(abs < 10 ? 1 : 0)}%
    </span>
  );
};

const ColorfulKpiTile = ({
  icon: Icon,
  title,
  value,
  sublabel,
  delta,
  trend,
  accent = '#B85C38',
  tone,
  onClick,
  period,
  onPeriodChange,
  topRight,
  loading = false,
  className = '',
}) => {
  const palette = tone ? TONE_STYLE[tone] || TONE_STYLE.neutral : null;
  const surfaceFill = palette ? palette.fill : '#FFFFFF';
  const surfaceLine = palette ? palette.line : '#7A716C';
  const vivid       = palette ? palette.vivid : accent;
  const glow        = palette ? palette.glow : `${accent}33`;
  const numberInk   = palette ? palette.ink : 'var(--ink)';
  const surfaceBorder = palette ? 'transparent' : 'var(--hairline)';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden ft-lift ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: surfaceFill,
        color: 'var(--ink)',
        border: `1px solid ${surfaceBorder}`,
        boxShadow: palette
          ? '0 1px 0 rgba(0,0,0,0.02), 0 6px 14px -10px rgba(0,0,0,0.08)'
          : '0 1px 2px rgba(28,25,23,0.04)',
        padding: '16px 18px 12px',
        minHeight: 148,
      }}
    >
      {/* Decorative corner glow — soft vivid blur behind the icon. Adds depth
          without competing with the number for attention. */}
      {palette && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -18, right: -18,
            width: 90, height: 90,
            background: glow,
            borderRadius: '50%',
            filter: 'blur(20px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {topRight && (
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          {topRight}
        </div>
      )}

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] uppercase"
            style={{
              color: palette ? numberInk : 'var(--ink-mute)',
              opacity: palette ? 0.78 : 1,
              fontWeight: 600,
              letterSpacing: '0.14em',
            }}
          >
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span
              style={{
                fontSize: 32,
                lineHeight: 1,
                fontWeight: 600,
                color: numberInk,
                letterSpacing: '-0.026em',
              }}
            >
              {loading
                ? <span className="inline-block w-14 h-7 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                : value}
            </span>
            <DeltaPill delta={delta} ink={numberInk} />
          </div>
          {sublabel && (
            <p
              className="mt-1 text-[11.5px] line-clamp-2"
              style={{ color: palette ? numberInk : 'var(--ink-mute)', opacity: palette ? 0.7 : 1 }}
            >
              {sublabel}
            </p>
          )}
        </div>

        {/* Icon chip — SOLID vivid colour with white glyph. This is the single
            most "premium" lever; every modern dashboard uses this pattern. */}
        {Icon && (
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center relative"
            style={{
              background: vivid,
              color: '#FFFFFF',
              boxShadow: `0 4px 12px -4px ${glow}, inset 0 1px 0 rgba(255,255,255,0.22)`,
            }}
          >
            <Icon size={19} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Sparkline along the bottom edge of the card, full width, taller than
          before so the trend reads as data not garnish. */}
      {Array.isArray(trend) && trend.length >= 2 && (
        <div className="mt-3 -mx-1 -mb-1">
          <Sparkline points={trend} stroke={surfaceLine} height={32} />
        </div>
      )}

      {period && onPeriodChange && (
        <div className="relative mt-3 flex justify-start">
          <PeriodPicker
            value={period.value}
            unit={period.unit}
            onChange={onPeriodChange}
            accent={palette ? vivid : accent}
            compact
          />
        </div>
      )}
    </Tag>
  );
};

export default ColorfulKpiTile;
