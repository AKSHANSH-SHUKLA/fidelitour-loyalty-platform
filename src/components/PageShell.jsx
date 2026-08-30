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
// Tokens read CSS variables so every inline style flips with the theme.
// Light = Eclat (flame on gallery white), dark = Minuit Dore (champagne on
// P6: single light palette. Values live in index.css under :root and .flc.
export const C = {
  /* ── DEPRECATED WARM-NAME ALIASES ─────────────────────────────────
     Every name below is a LIE as of P6: terracotta, coral, lilac,
     lavender, rose, ochre, amber and sage all resolve to a token in
     the blue / green / red product palette. None keeps a warm value.

     AMBER especially: #FFB60A measures 1.76:1 on white and is
     forbidden as a value, so the NAME cannot resolve to amber. It
     resolves to the pressed blue.

     These are kept only so that a recolour phase does not become a
     747-reference rename. P10: rename the call sites, delete this map.
     Fallbacks are the literal token values, so a missing var can never
     reintroduce a warm colour. ──────────────────────────────────── */
  terracotta:'var(--flc-accent,#0F6FDE)',     terracottaDeep:'var(--flc-accent-deep,#1453BD)',
  ochre:'var(--flc-accent-2,#0D62C4)',        amber:'var(--flc-accent-2,#0D62C4)',
  rose:'var(--flc-accent,#0F6FDE)',           coral:'var(--flc-accent-2,#0D62C4)',
  lavender:'var(--flc-accent,#0F6FDE)',       lilac:'var(--flc-accent-2,#0D62C4)',
  sky:'var(--flc-info,#0F6FDE)',              azure:'var(--flc-info,#0F6FDE)',
  teal:'var(--flc-ok,#087A31)',               mint:'var(--flc-ok,#087A31)',
  sage:'var(--flc-ok,#087A31)',               meadow:'var(--flc-ok,#087A31)',
  inkDeep:'var(--flc-ink,#030E1D)',           inkSoft:'var(--flc-ink2,#556272)',
  inkMute:'var(--flc-ink3,#626F7E)',
  bone:'var(--flc-paper,#F1F5FA)',            cream:'var(--flc-paper2,#F8F9FC)',
  sand:'var(--flc-paper2,#F8F9FC)',
  hairline:'var(--flc-line,#ECEFF4)',

  /* ── P6 palette, by its real name. Prefer these in new code. ──── */
  blue:'var(--blue,#0F6FDE)',                 bluePressed:'var(--blue-pressed,#0D62C4)',
  blueDeep:'var(--blue-deep,#1453BD)',        tintBlue:'var(--tint-blue,#E5F1FF)',
  green:'var(--green,#10BC4C)',               /* bar + track fills ONLY */
  greenDeep:'var(--green-deep,#087A31)',      /* text + white-glyph chips */
  red:'var(--red,#D93036)',                   /* dots, non-text marks */
  redDeep:'var(--red-deep,#A81E27)',          /* count badges: a numeral is text */
  canvas:'var(--canvas,#F1F5FA)',             surface:'var(--surface-1,#FFFFFF)',
  borderStrong:'var(--border-strong,#CBD3DC)',
};

// Per-role accent gradient. Drives the brand mark, the active-nav glow,
// the page-header underline, and the primary CTA in any role-scoped page.
// Keeping each role visually distinct helps an admin who's switched
// accounts immediately know which view they're in.
export const ROLE_THEME = {
  /* P6: role accents collapse onto the single product blue. The brand
     mark is a flat fill, not a gradient — `from`/`mid`/`to` are kept
     so existing call sites still resolve, but they are the same value
     on purpose. P10 removes the triple. */
  super_admin:    { from: C.blue, mid: C.blue, to: C.blue, label: 'Super Admin',    ring: C.blue },
  business_owner: { from: C.blue, mid: C.blue, to: C.blue, label: 'Business Owner', ring: C.blue },
  manager:        { from: C.blue, mid: C.blue, to: C.blue, label: 'Manager',        ring: C.blue },
  staff:          { from: C.blue, mid: C.blue, to: C.blue, label: 'Staff',          ring: C.blue },
  default:        { from: C.blue, mid: C.blue, to: C.blue, label: 'FidéliTour',     ring: C.blue },
};

export const themeForRole = (role) => ROLE_THEME[role] || ROLE_THEME.default;

/**
 * PageHeader — the consistent slot at the top of every page.
 * Eyebrow + Cormorant title + Manrope description + optional right-side actions.
 */
export const PageHeader = ({ eyebrow, title, description, actions, role = 'default', live = true }) => {
  const theme = themeForRole(role);
  return (
    <div className="relative mb-6">
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-[0.16em] mb-2"
              style={{
                background: 'transparent',
                color: 'var(--ink-mute)',
                fontWeight: 600,
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="flex items-center gap-3 text-[26px] md:text-[30px] leading-[1.1]"
            style={{
              color: 'var(--ink)',
              fontWeight: 500,
              letterSpacing: '-0.022em',
            }}
          >
            <span>{title}</span>
            {live && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase"
                style={{
                  background: 'var(--tone-success-fill)',
                  color: 'var(--tone-success-ink)',
                  letterSpacing: '0.12em',
                  fontWeight: 600,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--tone-success-line)' }}></span>
                Live
              </span>
            )}
          </h1>
          {description && (
            <p className="mt-1.5 text-[13.5px] max-w-2xl" style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>
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
              background: 'var(--flc-card, #FFFFFF)',
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
      background: 'var(--flc-card, #FFFFFF)',
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
