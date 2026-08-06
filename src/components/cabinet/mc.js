/**
 * Mission-control design tokens for the Espace Cabinet.
 *
 * Direction (from the ui-ux-pro-max design system for "accounting control tower,
 * premium fintech, mission control"): Modern Dark / Cinema — deep navy canvas,
 * frosted-glass surfaces, indigo→cyan glow, one green "all clear" accent and one
 * red "act now" accent. Never pure #000 (OLED smear), motion on Expo.out.
 *
 * Why a JS token file and not Tailwind classes: these values are used inside
 * inline styles for glass/glow effects that Tailwind's utility set doesn't cover
 * cleanly, and keeping them in one place stops the palette drifting per screen.
 */

export const MC = {
  // canvas
  bg: '#070B18',
  bgDeep: '#04060F',
  // glass surfaces
  glass: 'rgba(255,255,255,.045)',
  glassStrong: 'rgba(255,255,255,.075)',
  stroke: 'rgba(255,255,255,.10)',
  strokeStrong: 'rgba(255,255,255,.18)',
  // text
  ink: '#F8FAFC',
  ink2: '#B9C2D6',
  ink3: '#7C879F',
  // accents
  indigo: '#7C7CF8',
  cyan: '#38D9E8',
  green: '#3DDC97',
  amber: '#F5B851',
  red: '#FF6B6B',
  plum: '#C77DFF',
};

/** Frosted-glass card surface. `tone` tints the glow for status cards. */
export function glass(tone) {
  const glow = { danger: 'rgba(255,107,107,.18)', warn: 'rgba(245,184,81,.16)',
                 ok: 'rgba(61,220,151,.16)', accent: 'rgba(124,124,248,.20)' }[tone];
  return {
    background: MC.glass,
    border: `1px solid ${tone ? 'rgba(255,255,255,.14)' : MC.stroke}`,
    borderRadius: 18,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: glow ? `0 0 0 1px ${glow}, 0 18px 40px -24px ${glow}`
                    : '0 18px 40px -28px rgba(0,0,0,.9)',
  };
}

/** Expo.out — the house easing. Everything decelerates the same way. */
export const EASE = 'cubic-bezier(.16,1,.3,1)';

export const statusColor = { red: MC.red, amber: MC.amber, green: MC.green };
