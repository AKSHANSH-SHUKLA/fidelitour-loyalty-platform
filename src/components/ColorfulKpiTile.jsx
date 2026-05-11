import React from 'react';
import PeriodPicker from './PeriodPicker';

/**
 * ColorfulKpiTile — premium KPI card with a built-in sparkline.
 *
 * Inspired by the design references we lifted from premium SaaS dashboards
 * (Linear, Stripe, the loyalty-platform mockups the client showed):
 *
 *   • White surface, soft 1px border, generous breathing room.
 *   • Big number on the left in a serif weight that feels editorial,
 *     not Excel — pairs with a tinted icon chip on the right.
 *   • A sparkline trendline sits in the bottom-right corner when
 *     historical points are passed in — the "is this going up or down"
 *     glance that turns a number into a decision.
 *   • Optional percentage delta badge ("+12%") sits next to the value with
 *     a semantic colour (green = up, red = down, neutral grey = flat).
 *   • Optional accent strip on the left edge — semantic colour cue tied to
 *     the KPI's role (success / danger / warning / info / neutral).
 *
 * Props:
 *   icon          → lucide-react icon component
 *   title         → label (uppercased)
 *   value         → big number / text
 *   sublabel      → small grey caption under the number
 *   delta         → optional { value: number, sign: 'up'|'down'|'flat' }
 *   trend         → optional number[] (recent points; renders sparkline)
 *   accent        → primary hex (drives icon chip + sparkline stroke)
 *   tone          → 'success' | 'danger' | 'warning' | 'info' | 'neutral'
 *                   when set, picks accent + accent strip colour automatically.
 *   onClick       → click-to-drill handler
 *   period        → { value, unit } (omit to skip the picker)
 *   onPeriodChange→ (days, { value, unit }) => void
 *   topRight      → optional ReactNode rendered top-right
 *   loading       → boolean — pulsing skeleton on the value
 */

const TONE_PALETTE = {
  success: { accent: '#3F9D58', strip: '#3F9D58', fill: '#EAF3DE' },
  danger:  { accent: '#C44848', strip: '#C44848', fill: '#FCEBEB' },
  warning: { accent: '#D4A574', strip: '#D4A574', fill: '#FBEDD9' },
  info:    { accent: '#5B7AB7', strip: '#5B7AB7', fill: '#E6EEF8' },
  neutral: { accent: '#8B8680', strip: '#D4D2CD', fill: '#F4F2EE' },
};

/** Tiny SVG sparkline. Renders a stroked path through the points, plus a soft
 *  area fill underneath. Auto-scales to the values passed in.
 */
const Sparkline = ({ points = [], stroke = '#B85C38', width = 88, height = 28 }) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const xy = points.map((p, i) => [i * stepX, height - 4 - ((p - min) / range) * (height - 8)]);
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} fill={stroke} opacity="0.12" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="2.5" fill={stroke} />
    </svg>
  );
};

const DeltaBadge = ({ delta }) => {
  if (!delta || typeof delta.value !== 'number') return null;
  const sign = delta.sign || (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat');
  const color = sign === 'up' ? '#3F6D11' : sign === 'down' ? '#791F1F' : '#57534E';
  const bg    = sign === 'up' ? '#EAF3DE' : sign === 'down' ? '#FCEBEB' : '#F2F2F2';
  const arrow = sign === 'up' ? '↗' : sign === 'down' ? '↘' : '→';
  const abs = Math.abs(delta.value);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5"
      style={{ background: bg, color }}
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
  const palette = tone ? TONE_PALETTE[tone] || TONE_PALETTE.neutral : null;
  const effectiveAccent = palette ? palette.accent : accent;
  const stripColor = palette ? palette.strip : accent;

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
      {/* Left accent strip — semantic cue */}
      {tone && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: stripColor }}
        />
      )}

      {/* Top-right slot (Send Campaign etc.) */}
      {topRight && (
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          {topRight}
        </div>
      )}

      {/* Soft accent blob — gives each tile a colour identity without
          sacrificing readability of the number. */}
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: effectiveAccent }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: '#57534E' }}
          >
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <p
              className="font-bold leading-none"
              style={{ fontSize: 36, fontFamily: 'Cormorant Garamond', color: '#1C1917' }}
            >
              {loading
                ? <span className="inline-block w-16 h-7 bg-stone-200 rounded animate-pulse" />
                : value}
            </p>
            <DeltaBadge delta={delta} />
          </div>
          {sublabel && (
            <p className="mt-1.5 text-xs line-clamp-2" style={{ color: '#8B8680' }}>
              {sublabel}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          {Icon && (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: `${effectiveAccent}1A`,
                border: `1px solid ${effectiveAccent}33`,
                color: effectiveAccent,
              }}
            >
              <Icon size={20} />
            </div>
          )}
          {Array.isArray(trend) && trend.length >= 2 && (
            <Sparkline points={trend} stroke={effectiveAccent} />
          )}
        </div>
      </div>

      {/* Per-tile period picker */}
      {period && onPeriodChange && (
        <div className="relative mt-3 flex justify-start">
          <PeriodPicker
            value={period.value}
            unit={period.unit}
            onChange={onPeriodChange}
            accent={effectiveAccent}
            compact
          />
        </div>
      )}
    </Tag>
  );
};

export default ColorfulKpiTile;
