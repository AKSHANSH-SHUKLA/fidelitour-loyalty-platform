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
  paper: '#FBFAF8', paper2: '#F4F1EC', card: '#FFFFFF',
  line: '#ECE8E2', lineHi: '#D9D3CA',
  ink: '#191410', ink2: '#3A332B', ink3: '#524A40', tick: '#8D857D',
  accent: '#C73E2C', accentDeep: '#A82843', accentHi: '#E8703A',
  ok: '#0F8B58', info: '#3568B8', risk: '#C22F45', warn: '#A8862D',
  grid: '#F6E9E2',
  // Chart series — semantic hues used across the dashboard data-viz.
  serieBlue: '#3FA9D9', serieAmber: '#E8A53B', serieGreen: '#20714C',
  serieRed: '#E15A47', serieSky: '#5984AC',
  tier: { bronze: '#D27A3E', silver: '#9AA6B3', gold: '#E8A53B', vip: '#9A6DBF' },
  // Heatmap ramp anchors (pale paper -> deep flame-burgundy).
  heatLo: [0xFD, 0xFB, 0xF7], heatHi: [0x6B, 0x21, 0x0F],
  heatEmpty: '#FAFAF8', heatTextHi: '#FAFAF8', heatTextLo: '#171412',
  ctaGrad: 'linear-gradient(135deg,#E8703A,#C73E2C 55%,#A82843)',
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
