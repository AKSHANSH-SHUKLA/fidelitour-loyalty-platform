/* =====================================================================
   theme.js — JS-side palette for the product UI.

   CSS vars (--flc-*, --blue, --red…) cover everything styled in CSS,
   but Recharts/SVG charts take colours as JS props — they can't read
   CSS at render time. This module hands those components the same
   palette the stylesheet uses.

   P6 (2026-08-30): the Minuit Doré dark theme was REMOVED. There is
   one palette. The .flc-nuit class, the MINUIT object and the
   MutationObserver that watched for a theme flip are all gone, and
   must not return — no dark background, band, panel, card or footer
   at any breakpoint.

   Usage:
     const { T } = useTheme();
     <CartesianGrid stroke={T.grid} />
   ===================================================================== */
import React from 'react';

/* The single product palette. Mirrors the .flc token block in index.css.
   Measured ratios are noted where a value is text-bearing. */
export const PALETTE = {
  paper: '#F1F5FA',        // --canvas
  paper2: '#F8F9FC',
  card: '#FFFFFF',
  line: '#ECEFF4', lineHi: '#CBD3DC',

  ink: '#030E1D',          // 19.37:1 on white
  ink2: '#556272',         //  6.22:1 on white
  ink3: '#626F7E',         //  5.13:1 on white
  tick: '#626F7E',

  accent: '#0F6FDE',       // white label on it = 4.83:1
  accentDeep: '#1453BD',   // 7.00:1 on white, 6.12:1 on #E5F1FF
  accentHi: '#0D62C4',
  tint: '#E5F1FF',

  /* Two-token positive. #10BC4C is 2.52:1 against white in BOTH
     directions, so `ok` (a text-bearing role) must be the deep one.
     Use `okFill` for bars and tracks only — never as a text colour,
     never as a chip carrying a white glyph. */
  ok: '#087A31',           // 5.47:1 on white
  okFill: '#10BC4C',

  /* Two-token negative, lightness-matched to the blue pair.
     `risk` for dots and non-text marks (a white ICON GLYPH on it is
     fine); `riskDeep` for text and for count badges, because a
     numeral is text. */
  risk: '#D93036',         // 4.74:1 with white
  riskDeep: '#A81E27',     // 7.29:1 with white

  /* `warn` no longer has its own hue: amber is forbidden (#FFB60A is
     1.76:1), so a warning is red. `risk` and `warn` collapsing onto
     one pair is a known lost semantic slot, tracked in P10. */
  warn: '#A81E27',

  grid: '#ECEFF4',

  /* Chart series. Five categorical marks drawn from three permitted
     hues — `serieAmber` and `serieSky` are DEPRECATED NAMES that do
     not resolve to amber or to a third blue. Series separation at
     five categories is genuinely tight under this palette and is
     flagged as an open P7 question, not solved here. */
  serieBlue: '#0F6FDE',
  serieAmber: '#1453BD',   // deprecated name — NOT amber
  serieGreen: '#10BC4C',   // a chart mark, not text
  serieRed: '#D93036',
  serieSky: '#626F7E',     // deprecated name — neutral slate, not a third blue

  /* Tiers are ORDINAL (bronze < silver < gold < vip), so they get a
     sequential ramp rather than four categorical hues. That is correct
     for ordinal data and it removes the amber (`gold`) and violet
     (`vip`) problem outright. These are --blue at decreasing alpha
     resolved over white: a tint of the declared blue, not a new blue.
     Labels on the three light steps must be `ink`; only vip takes
     white (7.00:1). */
  tier: { bronze: '#CADFF8', silver: '#93BEF0', gold: '#5297E7', vip: '#1453BD' },

  /* Heatmap ramp: canvas -> deepest blue. `ink` holds >=4.5:1 up to
     t~=0.78; white takes over above that (7.00:1 at the top). */
  heatLo: [0xF1, 0xF5, 0xFA], heatHi: [0x14, 0x53, 0xBD],
  heatFlip: 0.78,
  heatEmpty: '#F8F9FC', heatTextHi: '#FFFFFF', heatTextLo: '#030E1D',

  /* Flat, not a gradient: the product has no gradient panel anywhere. */
  ctaGrad: '#0F6FDE',
  onCta: '#FFFFFF',
};

/* Kept as the export name so the ~30 existing call sites keep resolving. */
export const ECLAT = PALETTE;

export function useTheme() {
  // One palette, no observer, no subscription. `nuit` is retained as a
  // permanently-false field only so any stray `nuit ? a : b` still
  // resolves to the light branch; P10 removes it with the call sites.
  return { nuit: false, T: PALETTE };
}

/* Heatmap ramp helper — lerp between the two anchors. */
export const heatColor = (T, t) => {
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(T.heatLo[0], T.heatHi[0])}, ${lerp(T.heatLo[1], T.heatHi[1])}, ${lerp(T.heatLo[2], T.heatHi[2])})`;
};

export default useTheme;
