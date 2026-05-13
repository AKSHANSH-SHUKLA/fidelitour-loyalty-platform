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

// Premium SaaS look: every tile sits on the SAME warm-cream surface so the
// dashboard reads as one cohesive product (Stripe/Linear pattern). The tone
// only colors the icon chip, sparkline, and a subtle corner glow — the
// big number and background stay neutral. Result: restrained, not childish.
const SHARED_SURFACE = 'linear-gradient(135deg, #FAF5EB 0%, #FBF7EE 60%, #FDFAF3 100%)';
const SHARED_LINE    = '#ECE3D5';
const SHARED_INK     = 'var(--ink)';

const TONE_STYLE = {
  success: { vivid: 'var(--tone-success-vivid)', glow: 'var(--tone-success-glow)', line: 'var(--tone-success-line)' },
  danger:  { vivid: 'var(--tone-danger-vivid)',  glow: 'var(--tone-danger-glow)',  line: 'var(--tone-danger-line)'  },
  warning: { vivid: 'var(--tone-warning-vivid)', glow: 'var(--tone-warning-glow)', line: 'var(--tone-warning-line)' },
  info:    { vivid: 'var(--tone-info-vivid)',    glow: 'var(--tone-info-glow)',    line: 'var(--tone-info-line)'    },
  purple:  { vivid: 'var(--tone-purple-vivid)',  glow: 'var(--tone-purple-glow)',  line: 'var(--tone-purple-line)'  },
  neutral: { vivid: '#9C8E78',                   glow: 'rgba(156, 142, 120, 0.22)', line: 'var(--tone-neutral-line)' },
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

// Delta colors are DIRECTION-based, never metric-based: a "+" delta is
// always green, a "-" delta is always red. A flat delta is muted.
const DELTA_STYLE = {
  up:   { bg: 'rgba(56, 130, 80, 0.14)',  fg: '#2F6A3C', dot: '#3F8A52' },
  down: { bg: 'rgba(184, 60, 50, 0.14)',  fg: '#8A2E24', dot: '#B53D32' },
  flat: { bg: 'rgba(122, 113, 108, 0.12)', fg: '#5C544F', dot: '#7A716C' },
};

const DeltaPill = ({ delta }) => {
  if (!delta || typeof delta.value !== 'number') return null;
  const sign = delta.sign || (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat');
  const s = DELTA_STYLE[sign] || DELTA_STYLE.flat;
  const arrow = sign === 'up' ? '↗' : sign === 'down' ? '↘' : '→';
  const abs = Math.abs(delta.value);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5"
      style={{
        color: s.fg,
        background: s.bg,
        fontWeight: 600,
        boxShadow: `inset 0 0 0 1px ${s.dot}33`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span aria-hidden="true" style={{ color: s.dot }}>{arrow}</span>
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
  const palette     = tone ? TONE_STYLE[tone] || TONE_STYLE.neutral : null;
  const vivid       = palette ? palette.vivid : accent;
  const glow        = palette ? palette.glow  : `${accent}33`;
  const surfaceLine = palette ? palette.line  : SHARED_LINE;
  // Big number and background stay neutral across every tile — the tone
  // only shows in the icon chip / sparkline / corner glow.
  const numberInk   = SHARED_INK;

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden ft-lift ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: SHARED_SURFACE,
        color: 'var(--ink)',
        border: `1px solid ${SHARED_LINE}`,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 4px 12px -8px rgba(28,25,23,0.08)',
        padding: '16px 18px 12px',
        minHeight: 148,
      }}
    >
      {/* Subtle corner glow in the tone colour — only added when there's a
          tone. Adds restraint-level depth without competing with the number. */}
      {palette && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -18, right: -18,
            width: 90, height: 90,
            background: glow,
            borderRadius: '50%',
            filter: 'blur(22px)',
            opacity: 0.6,
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
              color: 'var(--ink-mute)',
              fontWeight: 700,
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
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {loading
                ? <span className="inline-block w-14 h-7 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                : value}
            </span>
            <DeltaPill delta={delta} />
          </div>
          {sublabel && (
            <p
              className="mt-1 text-[11.5px] line-clamp-2"
              style={{ color: 'var(--ink-mute)' }}
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
