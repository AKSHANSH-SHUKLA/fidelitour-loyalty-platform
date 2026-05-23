/**
 * AutomationCard — single automation strip card.
 *
 * Props:
 *   icon:     lucide-react component (e.g. Gift, Clock, Crown)
 *   title:    short title ("Anniversaire")
 *   subtitle: counts / status text ("23 envois ce mois")
 *   status:   'active' | 'paused' | 'draft' — drives the pill colour
 *   accent:   'purple' | 'cyan' | 'pink' | 'emerald' | 'orange' | 'amber'
 *             — drives the icon tint
 *   onClick:  optional click handler
 */
import React from 'react';

const ACCENT = {
  purple:  'hsl(252 90% 76%)',
  cyan:    'hsl(187 85% 53%)',
  pink:    'hsl(351 95% 71%)',
  emerald: 'hsl(158 64% 52%)',
  orange:  'hsl(21 90% 53%)',
  amber:   'hsl(38 92% 50%)',
};

const STATUS_PILL = {
  active:  { fg: 'hsl(160 84% 50%)', bg: 'hsl(160 84% 39% / .14)', label: 'Actif' },
  paused:  { fg: 'hsl(38 92% 60%)',  bg: 'hsl(38 92% 50% / .14)',  label: 'Pause' },
  draft:   { fg: 'hsl(228 11% 70%)', bg: 'hsl(228 30% 21% / .55)', label: 'Brouillon' },
};

const AutomationCard = ({
  icon: Icon,
  title,
  subtitle,
  status = 'active',
  accent = 'purple',
  onClick,
}) => {
  const tone = STATUS_PILL[status] || STATUS_PILL.active;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '1px solid #ECE3D2',
        borderRadius: 14,
        padding: 12,
        textAlign: 'left',
        color: 'hsl(228 28% 14%)',
        cursor: onClick ? 'pointer' : 'default',
        font: 'inherit',
        transition: 'transform 150ms cubic-bezier(.2,.7,.3,1), border-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.borderColor = 'hsl(228 28% 26%)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.borderColor = '#ECE3D2';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {Icon ? (
          <Icon size={18} aria-hidden="true" style={{ color: ACCENT[accent] || ACCENT.purple }} />
        ) : <span />}
        <span
          style={{
            fontSize: 9.5, fontWeight: 500, padding: '2px 7px', borderRadius: 99,
            color: tone.fg, background: tone.bg, letterSpacing: '0.02em',
          }}
        >
          {tone.label}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 10.5, color: 'hsl(228 11% 45%)', marginTop: 2 }}>{subtitle}</div>
      )}
    </Tag>
  );
};

export default AutomationCard;
