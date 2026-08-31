import React from 'react';
import { Crown } from 'lucide-react';

/**
 * Tier badge with color + crown icon.
 * Usage: <TierBadge tier="gold" />  or  <TierBadge tier="silver" size="sm" />
 */
/* Tiers are ORDINAL (bronze < silver < gold < vip), so they take the same
   sequential blue ramp used in lib/theme.js and AnalyticsPage rather than four
   categorical hues. That preserves the ranking, removes the legacy warm/violet
   values, and keeps every label above the 4.5:1 text floor.

   Fills are flat: the old gradients were decorative. The crown matches the
   label colour — at the `gold` step a --blue-deep crown measured 2.31:1,
   under the 3:1 graphical-object floor. */
const TIER_STYLES = {
  bronze: {
    bg: '#CADFF8',            // --blue @ .22
    border: '#ABCDF3',
    text: '#030E1D',          // 14.22:1
    crown: '#030E1D',
    label: 'Bronze',
  },
  silver: {
    bg: '#93BEF0',            // --blue @ .45
    border: '#6DA7EB',
    text: '#030E1D',          // 10.02:1
    crown: '#030E1D',
    label: 'Silver',
  },
  gold: {
    bg: '#5297E7',            // --blue @ .72
    border: '#2E82E2',
    text: '#030E1D',          // 6.40:1
    crown: '#030E1D',
    label: 'Gold',
  },
  vip: {
    bg: '#1453BD',            // --blue-deep, the deepest step
    border: '#0D3F91',
    text: '#FFFFFF',          // 7.00:1
    crown: '#FFFFFF',
    label: 'VIP',
  },
};

export default function TierBadge({ tier = 'bronze', size = 'md', showLabel = true }) {
  const key = String(tier || 'bronze').toLowerCase();
  const style = TIER_STYLES[key] || TIER_STYLES.bronze;

  const sizeMap = {
    xs: { pad: '2px 6px', font: '10px', iconSize: 10 },
    sm: { pad: '3px 8px', font: '11px', iconSize: 11 },
    md: { pad: '4px 10px', font: '12px', iconSize: 13 },
    lg: { pad: '6px 14px', font: '14px', iconSize: 16 },
  };
  const sz = sizeMap[size] || sizeMap.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: sz.pad,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        borderRadius: '999px',
        fontSize: sz.font,
        fontFamily: 'Manrope',
        fontWeight: 600,
        textTransform: 'capitalize',
        letterSpacing: '0.02em',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      <Crown size={sz.iconSize} style={{ color: style.crown, fill: style.crown }} strokeWidth={2} />
      {showLabel && <span>{style.label}</span>}
    </span>
  );
}
