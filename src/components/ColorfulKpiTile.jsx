import React from 'react';
import PeriodPicker from './PeriodPicker';

/**
 * ColorfulKpiTile — soothing pastel KPI card.
 *
 * Visual specification (matches the premium reference mockups the client
 * shared, see /references/dashboard-mockup-1.png):
 *
 *   • Light pastel BACKGROUND derived from `tone` (success → soft green,
 *     danger → soft coral, warning → soft amber, info → soft blue,
 *     neutral → soft sand). No saturated gradients, no harsh borders.
 *   • Number rendered at 30px / weight 500 — present but not screaming.
 *     The colour of the number matches the tone (deep green / deep coral
 *     / deep amber / deep navy / deep ink). This is what carries the meaning.
 *   • Title uppercased at 10.5px / weight 600 / 0.14em tracking — secondary.
 *   • Sublabel (e.g. "72% de la base client") at 11.5px / weight 400.
 *   • Optional sparkline embedded along the bottom of the card, drawn in
 *     the tone's accent line colour.
 *   • Optional delta pill ("+12%") next to the number — soft fill, dark ink.
 *
 * The tile is the same component as before; the visual change is the
 * stylesheet. Every existing call site keeps working. Pages that want
 * the new pastel look pass `tone="success" | "danger" | "warning" |
 * "info" | "neutral"`. Pages without `tone` fall back to a neutral
 * white surface with the old accent-blob behaviour preserved for
 * backward compat.
 */

const TONE_STYLE = {
  success: { fill: 'var(--tone-success-fill)', ink: 'var(--tone-success-ink)', line: 'var(--tone-success-line)' },
  danger:  { fill: 'var(--tone-danger-fill)',  ink: 'var(--tone-danger-ink)',  line: 'var(--tone-danger-line)' },
  warning: { fill: 'var(--tone-warning-fill)', ink: 'var(--tone-warning-ink)', line: 'var(--tone-warning-line)' },
  info:    { fill: 'var(--tone-info-fill)',    ink: 'var(--tone-info-ink)',    line: 'var(--tone-info-line)' },
  neutral: { fill: 'var(--tone-neutral-fill)', ink: 'var(--tone-neutral-ink)', line: 'var(--tone-neutral-line)' },
};

/** Soft sparkline. The line is a sibling of the area fill; both share the
 *  same path. Always renders inside the card's footer slot so it never
 *  competes with the number for attention. */
const Sparkline = ({ points = [], stroke = '#7A716C', width = 100, height = 26 }) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const xy = points.map((p, i) => [i * stepX, height - 3 - ((p - min) / range) * (height - 6)]);
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={stroke} opacity="0.16" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
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
      className="inline-flex items-center gap-1 text-[11px] rounded-full px-1.5 py-0.5"
      style={{
        color: ink || 'var(--ink-soft)',
        background: 'rgba(255,255,255,0.6)',
        fontWeight: 500,
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
  const numberInk = palette ? palette.ink : 'var(--ink)';
  const surfaceBorder = palette ? 'transparent' : 'var(--hairline)';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden transition-all
        ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''} ${className}`}
      style={{
        background: surfaceFill,
        color: 'var(--ink)',
        border: `1px solid ${surfaceBorder}`,
        boxShadow: palette ? '0 1px 0 rgba(0,0,0,0.02)' : '0 1px 2px rgba(28,25,23,0.04)',
        padding: '16px 18px 14px',
        minHeight: 134,
      }}
    >
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
              fontWeight: 600,
              letterSpacing: '0.14em',
            }}
          >
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span
              style={{
                fontSize: 30,
                lineHeight: 1,
                fontWeight: 500,
                color: numberInk,
                letterSpacing: '-0.022em',
              }}
            >
              {loading
                ? <span className="inline-block w-14 h-6 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                : value}
            </span>
            <DeltaPill delta={delta} ink={numberInk} />
          </div>
          {sublabel && (
            <p className="mt-1.5 text-[11.5px] line-clamp-2" style={{ color: 'var(--ink-mute)' }}>
              {sublabel}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: palette ? 'rgba(255,255,255,0.55)' : `${accent}14`,
              color: palette ? numberInk : accent,
            }}
          >
            <Icon size={18} strokeWidth={1.7} />
          </div>
        )}
      </div>

      {/* Sparkline floats along the bottom of the card. Stays out of the way
          and gives the tile its "is this trending" answer at a glance. */}
      {Array.isArray(trend) && trend.length >= 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline points={trend} stroke={surfaceLine} />
        </div>
      )}

      {period && onPeriodChange && (
        <div className="relative mt-3 flex justify-start">
          <PeriodPicker
            value={period.value}
            unit={period.unit}
            onChange={onPeriodChange}
            accent={palette ? surfaceLine : accent}
            compact
          />
        </div>
      )}
    </Tag>
  );
};

export default ColorfulKpiTile;
