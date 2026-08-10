/* =====================================================================
   theme.js — JS-side palette for the Fidelity dual theme.

   CSS vars (--flc-*) flip automatically with the .flc-nuit class, but
   Recharts/SVG charts take colors as JS props — they can't read CSS
   at render time. This hook observes the .flc-nuit class on the
   DashboardLayout root and hands components a palette object, so
   chart colors flip with the theme like everything else.

   Usage:
     const { nuit, T } = useTheme();
     <CartesianGrid stroke={T.grid} />
   ===================================================================== */
import React from 'react';

/* Eclat (light) — flame on gallery white. Mirrors .flc in index.css. */
export const ECLAT = {
  paper: '#FFF7F2', paper2: '#F8EFF4', card: '#FFFFFF',
  line: '#F0E3EA', lineHi: '#EBD5E2',
  ink: '#221420', ink2: '#463442', ink3: '#7A5F72', tick: '#9A8090',
  accent: '#E0397A', accentDeep: '#B02468', accentHi: '#FF7A59',
  ok: '#0E9563', info: '#3E63DD', risk: '#E23D5C', warn: '#D98A1F',
  grid: '#F8E6EF',
  // Chart series — semantic hues used across the dashboard data-viz.
  serieBlue: '#3E63DD', serieAmber: '#F2B23E', serieGreen: '#0E9563',
  serieRed: '#E23D5C', serieSky: '#5856D6',
  tier: { bronze: '#D27A3E', silver: '#9AA6B3', gold: '#E8A53B', vip: '#9A6DBF' },
  // Heatmap ramp anchors (pale paper -> deep rose-violet).
  heatLo: [0xFF, 0xFB, 0xF8], heatHi: [0x6E, 0x1A, 0x52],
  heatEmpty: '#FAFAF8', heatTextHi: '#FAFAF8', heatTextLo: '#171412',
  ctaGrad: 'linear-gradient(120deg,#FF7A59,#E0397A 48%,#8B3FC3)',
  onCta: '#FFFFFF',
};

/* Minuit Dore (dark) — champagne on espresso. Mirrors .flc-nuit. */
export const MINUIT = {
  paper: '#0D0B09', paper2: '#1C1815', card: '#141110',
  line: 'rgba(212,175,110,.16)', lineHi: 'rgba(212,175,110,.38)',
  ink: '#F5F1E8', ink2: '#C9C2B4', ink3: '#8D8578', tick: '#8D8578',
  accent: '#D4AF6E', accentDeep: '#A8823D', accentHi: '#EBD5A0',
  ok: '#8FCDA8', info: '#8ABDF0', risk: '#E2938A', warn: '#E8C36A',
  grid: 'rgba(212,175,110,.12)',
  serieBlue: '#7FC4E8', serieAmber: '#E8C36A', serieGreen: '#8FCDA8',
  serieRed: '#E2938A', serieSky: '#8ABDF0',
  tier: { bronze: '#D89B6A', silver: '#B9C2CC', gold: '#EBD5A0', vip: '#C0A0E0' },
  // Heatmap ramp: espresso -> champagne gold (dark cells idle, gold = peak).
  heatLo: [0x1C, 0x18, 0x15], heatHi: [0xEB, 0xD5, 0xA0],
  heatEmpty: '#141110', heatTextHi: '#141110', heatTextLo: '#C9C2B4',
  ctaGrad: 'linear-gradient(135deg,#EBD5A0,#A8823D)',
  onCta: '#141110',
};

/* ── flc-nuit class observer ─────────────────────────────────────────
 * One MutationObserver for the whole app; components subscribe via
 * useSyncExternalStore so a theme flip re-renders every chart. */
const listeners = new Set();
let observer = null;

const isNuit = () => {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('.flc-nuit');
};

let current = isNuit();

const ensureObserver = () => {
  if (observer || typeof document === 'undefined') return;
  observer = new MutationObserver(() => {
    const next = isNuit();
    if (next !== current) {
      current = next;
      listeners.forEach((l) => l());
    }
  });
  observer.observe(document.body, {
    attributes: true, attributeFilter: ['class'], subtree: true,
  });
};

const subscribe = (cb) => {
  ensureObserver();
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const getSnapshot = () => {
  // Cheap re-check on snapshot: covers the initial-mount race where the
  // class landed before the observer attached.
  current = isNuit();
  return current;
};

export function useTheme() {
  const nuit = React.useSyncExternalStore(subscribe, getSnapshot, () => false);
  const T = nuit ? MINUIT : ECLAT;
  return { nuit, T };
}

/* Heatmap ramp helper — lerp between the theme's two anchors. */
export const heatColor = (T, t) => {
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(T.heatLo[0], T.heatHi[0])}, ${lerp(T.heatLo[1], T.heatHi[1])}, ${lerp(T.heatLo[2], T.heatHi[2])})`;
};

export default useTheme;
