import React from 'react';

/* =====================================================================
   PAGE SHELL — shared design tokens + reusable layout primitives
   used across every authenticated page (admin, owner, staff).

   Pulls the same color language as the marketing site so the in-app
   surfaces feel like a continuation of the brand rather than a
   separate utilitarian dashboard.
   ===================================================================== */

// Vibrant pastel palette — same tokens used on the landing page so the
// in-app and marketing surfaces share a single visual identity.
export const C = {
  terracotta:'#B85C38', terracottaDeep:'#9C4427',
  ochre:'#D4A574',     amber:'#E3A869',
  rose:'#E8917C',      coral:'#F2A48A',
  lavender:'#9B7FB8',  lilac:'#C8B8DD',
  sky:'#4A90E2',       azure:'#A8C7E8',
  teal:'#3C9D9B',      mint:'#A7DCD3',
  sage:'#7FA269',      meadow:'#D4E5C4',
  inkDeep:'#1C1917',   inkSoft:'#2D2A26',  inkMute:'#57534E',
  bone:'#FDFBF7',      cream:'#F5F1EA',    sand:'#EDE7DA',
  hairline:'#E8E2D5',
};

// Per-role accent gradient. Drives the brand mark, the active-nav glow,
// the page-header underline, and the primary CTA in any role-scoped page.
// Keeping each role visually distinct helps an admin who's switched
// accounts immediately know which view they're in.
export const ROLE_THEME = {
  super_admin:    { from: C.terracotta, mid: C.rose,     to: C.lavender, label: 'Super Admin',    ring: C.terracotta },
  business_owner: { from: C.ochre,      mid: C.amber,    to: C.terracotta, label: 'Business Owner', ring: C.ochre },
  manager:        { from: C.teal,       mid: C.mint,     to: C.sky,      label: 'Manager',         ring: C.teal },
  staff:          { from: C.sky,        mid: C.azure,    to: C.lavender, label: 'Staff',           ring: C.sky },
  default:        { from: C.terracotta, mid: C.ochre,    to: C.rose,     label: 'FidéliTour',      ring: C.terracotta },
};

export const themeForRole = (role) => ROLE_THEME[role] || ROLE_THEME.default;

/**
 * PageHeader — the consistent slot at the top of every page.
 * Eyebrow + Cormorant title + Manrope description + optional right-side actions.
 */
export const PageHeader = ({ eyebrow, title, description, actions, role = 'default' }) => {
  const theme = themeForRole(role);
  return (
    <div className="relative mb-8">
      {/* Soft ambient gradient orb behind the title — anchors the page. */}
      <div
        aria-hidden="true"
        className="absolute -top-12 -left-8 w-72 h-72 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${theme.from} 0%, transparent 70%)` }}
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] mb-3"
              style={{
                background: `linear-gradient(135deg, ${theme.from}1A, ${theme.to}1A)`,
                color: theme.from,
                border: `1px solid ${theme.from}33`,
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-[1.1]"
            style={{ color: C.inkDeep }}
          >
            <span className="ft-gradient-text-slow">{title}</span>
            <span
              className="ml-3 inline-block h-1.5 rounded-full align-middle"
              style={{
                width: 56,
                background: `linear-gradient(90deg, ${theme.from}, ${theme.mid}, ${theme.to})`,
              }}
            />
          </h1>
          {description && (
            <p className="mt-3 text-base max-w-2xl" style={{ color: C.inkMute, fontFamily: 'Manrope' }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

/**
 * StatCard — modern KPI tile.
 *
 * Variants:
 *   - `accent` (default) → soft tinted background + colored icon chip
 *   - `dark` → premium dark card (use sparingly, ~1 per row max)
 *
 * Always renders the icon as a colored chip in the top-right — clean and
 * scannable in a 4-up KPI row.
 */
export const StatCard = ({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,           // optional: { delta: '+12%', positive: true }
  color = C.terracotta,
  variant = 'accent',
  onClick,
  className = '',
}) => {
  const dark = variant === 'dark';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left p-5 rounded-2xl overflow-hidden transition-all
        ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : ''}
        ${className}`}
      style={
        dark
          ? {
              background: `linear-gradient(135deg, ${C.inkDeep} 0%, ${C.inkSoft} 100%)`,
              color: 'white',
              boxShadow: '0 1px 2px rgba(28,25,23,0.05)',
            }
          : {
              background: 'white',
              border: `1px solid ${C.hairline}`,
              boxShadow: '0 1px 2px rgba(28,25,23,0.04)',
            }
      }
    >
      {/* Subtle blob in the corner for depth */}
      <div
        aria-hidden="true"
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-30 pointer-events-none"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-white/60' : ''}`}
             style={dark ? {} : { color: C.inkMute }}>
            {label}
          </p>
          <p
            className={`mt-2 font-['Cormorant_Garamond'] font-bold leading-none ${dark ? 'text-white' : ''}`}
            style={{ fontSize: 36, color: dark ? '#fff' : C.inkDeep }}
          >
            {value}
          </p>
          {sublabel && (
            <p className={`mt-1.5 text-xs ${dark ? 'text-white/60' : ''}`} style={dark ? {} : { color: C.inkMute }}>
              {sublabel}
            </p>
          )}
          {trend && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                 style={{ color: trend.positive ? C.sage : C.terracotta }}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{trend.delta}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: dark ? 'rgba(255,255,255,0.08)' : `${color}1A`,
              color: dark ? '#fff' : color,
              border: dark ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${color}33`,
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>
    </Tag>
  );
};

/**
 * Section — content wrapper used to group related widgets on a page.
 * Card-like surface with consistent padding, optional header.
 */
export const Section = ({ title, hint, actions, children, className = '' }) => (
  <section
    className={`bg-white border rounded-2xl p-6 ${className}`}
    style={{ borderColor: C.hairline, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }}
  >
    {(title || actions) && (
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          {title && (
            <h2
              className="font-['Cormorant_Garamond'] text-2xl font-semibold leading-tight"
              style={{ color: C.inkDeep }}
            >
              {title}
            </h2>
          )}
          {hint && <p className="mt-1 text-sm" style={{ color: C.inkMute }}>{hint}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
    )}
    {children}
  </section>
);

/** PrimaryButton — gradient pill matching the role accent. */
export const PrimaryButton = ({ role = 'default', className = '', children, ...rest }) => {
  const theme = themeForRole(role);
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all shadow-md hover:-translate-y-0.5 hover:shadow-lg ${className}`}
      style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
    >
      {children}
    </button>
  );
};

/** SecondaryButton — outline style for less-prominent actions. */
export const SecondaryButton = ({ className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:bg-[${C.cream}] ${className}`}
    style={{
      border: `1px solid ${C.hairline}`,
      color: C.inkSoft,
      background: 'white',
    }}
  >
    {children}
  </button>
);

/** Animated gradient background — subtle moving radial mesh used as the
    page-level body backdrop. Performance is fine; pure CSS keyframes. */
export const AmbientBackdrop = ({ role = 'default' }) => {
  const theme = themeForRole(role);
  return (
    <>
      <style>{`
        @keyframes shellOrb1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,40px); } }
        @keyframes shellOrb2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px,-30px); } }
      `}</style>
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none -z-0">
        <div
          className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full blur-3xl opacity-15"
          style={{ background: theme.from, animation: 'shellOrb1 18s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[-15%] left-[-10%] w-[45vw] h-[45vw] rounded-full blur-3xl opacity-10"
          style={{ background: theme.to, animation: 'shellOrb2 22s ease-in-out infinite' }}
        />
      </div>
    </>
  );
};

export default {
  C, ROLE_THEME, themeForRole,
  PageHeader, StatCard, Section, PrimaryButton, SecondaryButton, AmbientBackdrop,
};
