/**
 * cardTheme.js — the derivation engine behind the wallet-anatomy card.
 *
 * The old designer exposed ~17 colour pickers and merchants produced carnival
 * cards with them (blue band + red octagon stamps + cyan name + pink meter on
 * one card — the screenshot that triggered this redesign). The new contract:
 *
 *     merchant chooses   brand colour + surface (sombre | clair)
 *     this module derives everything else with contrast arithmetic
 *
 * so any input produces a professional card. Colour is maths here, not taste.
 *
 * Every derived value is WCAG-aware: ink on any surface resolves to the
 * highest-contrast option, and brand-on-surface falls back to a lightened or
 * darkened variant of the brand when the raw brand fails 3:1 against the
 * surface (a pastel brand on a light card would otherwise vanish).
 */

// ---------------------------------------------------------------- colour math

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '').trim();
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance per WCAG 2.x. */
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

/** WCAG contrast ratio between two hex colours (1..21). */
export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `hex` toward pure white (amt>0) or pure black (amt<0), amt in 0..1. */
function shade(hex, amt) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amt >= 0 ? 255 : 0;
  const t = Math.abs(amt);
  return rgbToHex({
    r: rgb.r + (target - rgb.r) * t,
    g: rgb.g + (target - rgb.g) * t,
    b: rgb.b + (target - rgb.b) * t,
  });
}

/** rgba() string from hex + alpha — for tracks and hairlines. */
function tint(hex, alpha) {
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * A variant of `brand` guaranteed to read against `surface` (≥3:1, the WCAG
 * threshold for graphical objects). Walks the brand toward white on dark
 * surfaces and toward black on light ones until it clears the bar.
 */
function legibleBrand(brand, surface) {
  if (contrast(brand, surface) >= 3) return brand;
  const towardWhite = luminance(surface) < 0.5;
  let candidate = brand;
  for (let step = 0.15; step <= 0.9; step += 0.15) {
    candidate = shade(brand, towardWhite ? step : -step);
    if (contrast(candidate, surface) >= 3) return candidate;
  }
  return towardWhite ? '#FFFFFF' : '#111111';
}

// ---------------------------------------------------------------- the engine

/**
 * Fixed metallic tier set. Deliberately NOT derived from the brand and NOT
 * merchant-editable: bronze/silver/gold/black-card mean the same thing on
 * every loyalty programme on earth, and that universality is the point.
 */
const TIER_CHIPS = {
  bronze: { bg: '#8C6239', ink: '#FFF6EC', label: 'Bronze' },
  silver: { bg: '#9BA3AD', ink: '#10151B', label: 'Argent' },
  gold:   { bg: '#C9A34E', ink: '#241B04', label: 'Or' },
  vip:    { bg: '#17181C', ink: '#E8D9A0', label: 'VIP' },
};

const SURFACES = {
  sombre: { bg: '#1C1D22', inkMax: '#F4F3F0', inkMin: '#101014' },
  clair:  { bg: '#FDFCFA', inkMax: '#17181C', inkMin: '#FFFFFF' },
};

/**
 * deriveCardTheme({ brandColor, surface }) → every colour the card needs.
 *
 * Returned tokens are the ONLY colours WalletCard is allowed to paint with.
 * If a new element needs a colour, it gets a new derived token here — never
 * a new merchant-facing picker.
 */
export function deriveCardTheme({ brandColor, surface } = {}) {
  const s = SURFACES[surface === 'clair' ? 'clair' : 'sombre'];
  const brandRaw = hexToRgb(brandColor) ? brandColor : '#C73E2C';
  const brand = legibleBrand(brandRaw, s.bg);

  // Ink: whichever extreme reads better on this surface. By construction the
  // SURFACES pairs always pass 4.5:1, but compute rather than assume.
  const ink = contrast(s.inkMax, s.bg) >= contrast(s.inkMin, s.bg) ? s.inkMax : s.inkMin;
  // Text on a solid brand fill (hero fallback, filled stamps).
  const onBrand = contrast('#FFFFFF', brand) >= contrast('#111111', brand) ? '#FFFFFF' : '#111111';

  return {
    surface: s.bg,
    ink,                              // primary values (names, numbers)
    inkSoft: tint(ink === s.inkMax ? ink : s.inkMax, 0.62),   // secondary text
    label: tint(ink === s.inkMax ? ink : s.inkMax, 0.45),     // uppercase micro-labels
    hairline: tint(ink === s.inkMax ? ink : s.inkMax, 0.14),  // separators
    brand,                            // accent: meter fill, stamp fill, offer border
    brandRaw,                         // untouched merchant colour (hero fallback fill)
    onBrand,                          // text/check marks on brand fills
    track: tint(ink === s.inkMax ? ink : s.inkMax, 0.12),     // meter track, empty stamps
    codeBg: '#FFFFFF',                // QR/barcode block — always white, scanners first
    codeInk: '#111111',
    chipBg: tint(ink === s.inkMax ? ink : s.inkMax, 0.08),    // offer chip surface
    tiers: TIER_CHIPS,
  };
}

/** Preset definitions the designer offers. Pure data — render reads the theme. */
export const CARD_PRESETS = [
  { key: 'signature', label: 'Signature', surface: 'sombre', hero: 'image' },
  { key: 'lumiere',   label: 'Lumière',   surface: 'clair',  hero: 'image' },
  { key: 'couleur',   label: 'Couleur',   surface: 'sombre', hero: 'brand' },
  { key: 'minimal',   label: 'Minimal',   surface: 'sombre', hero: 'none' },
];
