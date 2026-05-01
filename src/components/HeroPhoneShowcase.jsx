import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Activity, TrendingUp, Star, Bell, MapPin,
  Gift, Sparkles, Coffee, Cake, BrainCircuit, Zap,
  Target, AlertTriangle,
} from 'lucide-react';
import { C } from './PageShell';

/**
 * HERO PHONE SHOWCASE — the cinematic four-scene loop on the landing page.
 *
 * One iPhone-style frame at centre that auto-rotates through:
 *   0) Analytics dashboard on the phone
 *   1) Push notifications cascading on the lock screen
 *   2) Apple-Wallet style loyalty card with stamps filling up
 *   3) Geolocation push (a customer is nearby)
 *
 * A subtle "dashboard echo" panel sits behind the phone showing the
 * desktop equivalent of whatever scene is playing — so the viewer
 * understands the app works on both devices without us writing copy.
 *
 * Scene rotation is automatic (~6s per scene) and looped. Click the dots
 * at the bottom to jump to a scene manually.
 *
 * Self-contained component — does not depend on any other landing-page
 * component and does not modify the existing HeroDashboardMockup (kept
 * in LandingPage.jsx for rollback safety).
 */

const SCENE_DURATION = 6000;

const SCENES = [
  { id: 'analytics',     label: 'Analytics' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'wallet',        label: 'Wallet card' },
  { id: 'geolocation',   label: 'Geolocation' },
  { id: 'ai',            label: 'AI Intelligence' },
];

const HeroPhoneShowcase = () => {
  const [scene, setScene] = useState(0);

  // Auto-advance — pauses while document is hidden to save battery on background tabs.
  useEffect(() => {
    const tick = () => setScene((s) => (s + 1) % SCENES.length);
    const id = setInterval(() => {
      if (!document.hidden) tick();
    }, SCENE_DURATION);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-[640px] mx-auto" style={{ perspective: '2000px' }}>
      {/* Multi-color glow halo */}
      <div
        aria-hidden="true"
        className="absolute -inset-16 rounded-[60px] opacity-40 blur-3xl pointer-events-none"
        style={{
          background:
            'conic-gradient(from 90deg, ' + C.terracotta + ', ' + C.rose + ', ' + C.lavender + ', ' + C.sky + ', ' + C.teal + ', ' + C.terracotta + ')',
        }}
      />

      {/* Background dashboard echo — desktop view of the same scene */}
      <DashboardEcho scene={SCENES[scene].id} />

      {/* Foreground phone */}
      <div className="relative flex justify-center">
        <PhoneFrame>
          <AnimatePresence mode="wait">
            {scene === 0 && <SceneAnalytics key="analytics" />}
            {scene === 1 && <SceneNotifications key="notifications" />}
            {scene === 2 && <SceneWalletCard key="wallet" />}
            {scene === 3 && <SceneGeolocation key="geolocation" />}
            {scene === 4 && <SceneAIIntelligence key="ai" />}
          </AnimatePresence>
        </PhoneFrame>
      </div>

      {/* Scene indicator dots */}
      <div className="relative mt-6 flex items-center justify-center gap-2">
        {SCENES.map((s, i) => {
          const active = i === scene;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScene(i)}
              aria-label={'Show scene: ' + s.label}
              className="transition-all"
              style={{
                width: active ? 32 : 8,
                height: 8,
                borderRadius: 4,
                background: active ? C.terracotta : C.hairline,
              }}
            />
          );
        })}
      </div>
      <p className="relative text-center text-xs mt-2 font-semibold uppercase tracking-widest" style={{ color: C.inkMute }}>
        {SCENES[scene].label}
      </p>
    </div>
  );
};

/* ===================================================================== */
/* PHONE FRAME — iPhone-like outline with notch and screen area          */
/* ===================================================================== */
const PhoneFrame = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, rotateY: -8 }}
    animate={{ opacity: 1, y: 0, rotateY: 0 }}
    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    className="relative"
    style={{
      width: 290,
      height: 600,
      transformStyle: 'preserve-3d',
    }}
  >
    {/* Outer bezel */}
    <div
      className="absolute inset-0 rounded-[44px] shadow-2xl"
      style={{
        background: 'linear-gradient(145deg, #1A1A1F 0%, #2A2A30 50%, #0E0E12 100%)',
        boxShadow: '0 30px 60px -15px rgba(0,0,0,0.4), 0 10px 25px -5px rgba(0,0,0,0.2), inset 0 0 0 2px #303035',
      }}
    />
    {/* Inner screen */}
    <div
      className="absolute rounded-[34px] overflow-hidden"
      style={{
        top: 8, left: 8, right: 8, bottom: 8,
        background: '#FDFBF7',
      }}
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
        style={{ width: 100, height: 24, background: '#0E0E12', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
        <div className="w-2 h-2 rounded-full" style={{ background: '#1A1A1F', boxShadow: '0 0 0 1px #2A2A30' }} />
      </div>

      {/* Status bar */}
      <div className="absolute top-1 left-0 right-0 z-20 flex items-center justify-between px-6 text-[10px] font-bold"
        style={{ color: '#1C1917' }}>
        <span>9:41</span>
        <span className="invisible">·</span>
        <span className="flex items-center gap-1">
          <SignalDots />
          <BatteryIcon />
        </span>
      </div>

      {/* Scene content area */}
      <div className="absolute inset-0 pt-8">
        {children}
      </div>
    </div>
  </motion.div>
);

const SignalDots = () => (
  <span className="inline-flex items-end gap-[2px]">
    {[3, 5, 7, 9].map((h, i) => (
      <span key={i} className="rounded-sm" style={{ width: 2.5, height: h, background: '#1C1917' }} />
    ))}
  </span>
);

const BatteryIcon = () => (
  <span className="inline-flex items-center">
    <span className="rounded-[3px]" style={{ width: 18, height: 9, border: '1.2px solid #1C1917' }}>
      <span className="block rounded-sm" style={{ width: '70%', height: '100%', background: '#1C1917' }} />
    </span>
    <span className="ml-[1px] rounded-r-[1px]" style={{ width: 1.5, height: 4, background: '#1C1917' }} />
  </span>
);

/* ===================================================================== */
/* SCENE 1 — ANALYTICS                                                    */
/* ===================================================================== */
const SceneAnalytics = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.5 }}
    className="absolute inset-0 px-3.5 py-3 overflow-hidden flex flex-col gap-2.5"
    style={{ background: 'linear-gradient(180deg, #FDFBF7 0%, #F3EFE7 100%)' }}
  >
    {/* Header */}
    <div className="flex items-center gap-2 mt-1">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
        style={{ background: 'linear-gradient(135deg, ' + C.terracotta + ', ' + C.rose + ')' }}>P</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold leading-tight" style={{ color: C.inkDeep }}>Café Lumière</p>
        <p className="text-[8px]" style={{ color: C.inkMute }}>Welcome back, Pierre</p>
      </div>
    </div>

    {/* KPIs */}
    <div className="grid grid-cols-2 gap-2">
      <KPI icon={Users}      label="Customers" target={2847} accent={C.sky}        bg={C.azure} />
      <KPI icon={Activity}   label="Visits"    target={14200} suffix="+" accent={C.sage} bg={C.meadow} />
      <KPI icon={TrendingUp} label="Repeat"    target={96}    suffix="%" accent={C.terracotta} bg={C.shellPink} />
      <KPI icon={Star}       label="Rating"    target={87}    divisor={10} fixed={1} accent={C.ochre} bg={C.butter} />
    </div>

    {/* Chart */}
    <div className="rounded-xl p-2.5 border" style={{ background: 'white', borderColor: C.hairline }}>
      <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: C.inkFaint }}>Visits — 14 days</p>
      <svg viewBox="0 0 200 50" className="w-full h-12">
        <defs>
          <linearGradient id="hpx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={C.terracotta} stopOpacity="0.4" />
            <stop offset="100%" stopColor={C.terracotta} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0 38 L15 32 L30 36 L45 24 L60 28 L75 18 L90 22 L105 14 L120 18 L135 10 L150 14 L165 8 L180 12 L195 4"
          fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 0.3 }}
        />
        <motion.path
          d="M0 38 L15 32 L30 36 L45 24 L60 28 L75 18 L90 22 L105 14 L120 18 L135 10 L150 14 L165 8 L180 12 L195 4 L195 50 L0 50 Z"
          fill="url(#hpx)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.5 }}
        />
      </svg>
    </div>

    {/* Live activity */}
    <div className="rounded-xl p-2.5 border space-y-1.5" style={{ background: 'white', borderColor: C.hairline }}>
      <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: C.inkFaint }}>Live activity</p>
      {[
        { dot: C.sage,     text: 'Sophie M. visited · +25 pts', t: 'now' },
        { dot: C.lavender, text: 'Antoine L. became VIP',        t: '2m' },
        { dot: C.coral,    text: 'Birthday offer · 12 sent',     t: '5m' },
      ].map((a, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 + i * 0.2 }}
          className="flex items-center gap-1.5 text-[9px]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} />
          <span className="flex-1 truncate" style={{ color: C.inkDeep }}>{a.text}</span>
          <span style={{ color: C.inkFaint }}>{a.t}</span>
        </motion.div>
      ))}
    </div>
  </motion.div>
);

const KPI = ({ icon: Icon, label, target, accent, bg, suffix = '', divisor = 1, fixed = 0 }) => {
  const display = useCountUp(target, 1500);
  const formatted = (display / divisor).toFixed(fixed);
  return (
    <div className="rounded-xl p-2 border" style={{ background: 'white', borderColor: C.hairline }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center mb-1" style={{ background: bg }}>
        <Icon size={11} style={{ color: accent }} />
      </div>
      <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: C.inkFaint }}>{label}</p>
      <p className="text-[13px] font-bold leading-tight" style={{ color: C.inkDeep }}>
        {formatted}{suffix}
      </p>
    </div>
  );
};

// Hook: smoothly counts up from 0 to `to` over `durationMs`.
const useCountUp = (to, durationMs = 1200) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
  }, [to, durationMs]);
  return n;
};

/* ===================================================================== */
/* SCENE 2 — NOTIFICATIONS                                                */
/* ===================================================================== */
const SceneNotifications = () => {
  const items = [
    { icon: Sparkles, tint: C.sage,      title: 'Nouveau client', body: 'Sophie just joined — your 47th this month.' },
    { icon: TrendingUp,tint: C.terracotta, title: 'Big spender',   body: 'Marie spent €45 — VIP tier reached.' },
    { icon: Cake,     tint: C.rose,      title: 'Birthday today', body: 'Lisa\'s 30th — auto-message ready.' },
    { icon: Bell,     tint: C.lavender,  title: 'Tuesday peak',   body: 'Visits up 23% vs last Tuesday.' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 px-3.5 py-3 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #1C1917 0%, #2A1C2E 100%)' }}
    >
      {/* Lock screen time */}
      <div className="text-center mt-3 mb-4">
        <p className="text-[10px] font-semibold tracking-wider opacity-80" style={{ color: 'white' }}>Mardi 30 Avril</p>
        <p className="text-[44px] font-bold leading-none mt-1" style={{ color: 'white', fontFamily: 'Cormorant Garamond' }}>9:41</p>
      </div>

      {/* Notification stack */}
      <div className="flex flex-col gap-2 px-1">
        {items.map((n, i) => {
          const Icon = n.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 22, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl px-3 py-2.5 backdrop-blur-md flex items-start gap-2.5"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.3)',
              }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: n.tint, color: 'white' }}>
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold leading-tight" style={{ color: '#1C1917' }}>FidéliTour</p>
                  <p className="text-[8px]" style={{ color: '#57534E' }}>now</p>
                </div>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#1C1917' }}>{n.title}</p>
                <p className="text-[9px] leading-tight" style={{ color: '#57534E' }}>{n.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

/* ===================================================================== */
/* SCENE 3 — WALLET CARD WITH STAMPS                                      */
/* ===================================================================== */
const SceneWalletCard = () => {
  // Stamps fill in sequence — 7/10 ends up filled, last 3 stay empty.
  const target = 7;
  const total = 10;
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setFilled(i);
      if (i >= target) clearInterval(id);
    }, 280);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 px-3 py-3 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #E8E5DD 0%, #C8C4BD 100%)' }}
    >
      {/* Apple Wallet header */}
      <div className="flex items-center justify-between mt-1 px-1">
        <p className="text-[9px] font-bold" style={{ color: '#1C1917' }}>Wallet</p>
        <p className="text-[9px]" style={{ color: '#57534E' }}>•••</p>
      </div>

      {/* The card */}
      <motion.div
        initial={{ y: 30, opacity: 0, rotateX: 6 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 rounded-2xl p-3.5 shadow-2xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, ' + C.terracotta + ' 0%, #8B3F1E 100%)',
          color: 'white',
          minHeight: 360,
        }}
      >
        {/* Logo + brand */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Café Lumière</p>
            <p className="text-[16px] font-bold leading-tight mt-0.5" style={{ fontFamily: 'Cormorant Garamond' }}>Sophie Dupont</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-bold uppercase tracking-wider opacity-80">Ma cagnotte</p>
            <p className="text-[18px] font-bold leading-tight">70 €</p>
          </div>
        </div>

        {/* Stamps grid */}
        <div className="bg-white/15 rounded-xl p-3 mt-2">
          <p className="text-[8px] font-bold uppercase tracking-wider mb-2 opacity-90">Cards collected</p>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: total }).map((_, i) => {
              const isFilled = i < filled;
              return (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{ scale: isFilled ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.4 }}
                  className="aspect-square rounded-lg flex items-center justify-center"
                  style={{
                    background: isFilled ? 'white' : 'rgba(255,255,255,0.2)',
                    border: '1.5px solid ' + (isFilled ? 'white' : 'rgba(255,255,255,0.3)'),
                  }}
                >
                  {isFilled && <Coffee size={12} style={{ color: C.terracotta }} />}
                </motion.div>
              );
            })}
          </div>
          <p className="text-[9px] mt-2 text-center font-semibold opacity-90">
            {filled} / {total} — {total - filled} away from a free coffee
          </p>
        </div>

        {/* Reward unlocked toast (appears after stamps fill) */}
        {filled >= target && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="absolute bottom-3 left-3 right-3 rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.95)', color: '#1C1917' }}
          >
            <Gift size={14} style={{ color: C.terracotta }} />
            <p className="text-[10px] font-bold flex-1">You're 3 stamps from a free latte ☕</p>
          </motion.div>
        )}

        {/* Decorative shine */}
        <div aria-hidden="true" className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
      </motion.div>

      <p className="text-[8px] text-center mt-3 font-medium" style={{ color: '#57534E' }}>
        Apple Wallet · Tap to open
      </p>
    </motion.div>
  );
};

/* ===================================================================== */
/* SCENE 4 — GEOLOCATION                                                  */
/* ===================================================================== */
const SceneGeolocation = () => {
  // Four feature pills cascade in after the map + push notification appear.
  const features = [
    { icon: '📍', title: 'Configurable radius', sub: '50m – 2km' },
    { icon: '👑', title: 'VIP-only opt-in',     sub: 'restrict to top tier' },
    { icon: '⏱',  title: 'Cooldown protection', sub: 'max 1 nudge / X days' },
    { icon: '🤫', title: 'Silent on the back-end', sub: 'no popups, just works' },
  ];

  return (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="absolute inset-0 flex flex-col"
  >
    {/* Stylised map (compact — leaves room for the feature pills below) */}
    <div className="relative overflow-hidden" style={{ height: 200, background: 'linear-gradient(180deg, #DCE9D5 0%, #C9DCC2 100%)' }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 290 200" preserveAspectRatio="none">
        <g stroke="#FDFBF7" strokeWidth="12" strokeLinecap="round">
          <line x1="-20" y1="60"  x2="320" y2="50" />
          <line x1="-20" y1="140" x2="320" y2="130" />
          <line x1="80" y1="-20" x2="100" y2="220" />
          <line x1="220" y1="-20" x2="200" y2="220" />
        </g>
        <g fill="#F3EFE7">
          <rect x="20" y="20" width="40" height="32" rx="3" />
          <rect x="120" y="70" width="60" height="38" rx="3" />
          <rect x="240" y="20" width="30" height="32" rx="3" />
          <rect x="20" y="160" width="50" height="32" rx="3" />
        </g>
      </svg>

      {/* Café pin */}
      <motion.div
        initial={{ scale: 0, y: -10 }} animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute z-20"
        style={{ left: '50%', top: '38%', transform: 'translate(-50%, -100%)' }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(135deg, ' + C.terracotta + ', ' + C.rose + ')' }}>
          <Coffee size={16} className="text-white" />
        </div>
      </motion.div>

      {/* Customer dot with pulsing proximity ring */}
      <div className="absolute z-10" style={{ left: '34%', top: '64%' }}>
        <motion.div
          className="absolute -inset-5 rounded-full"
          style={{ background: C.sky, opacity: 0.4 }}
          animate={{ scale: [1, 2.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }}
          className="relative w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
          style={{ background: C.sky }}
        />
      </div>

      {/* Distance label */}
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="absolute z-20 px-2 py-0.5 rounded-full text-[8px] font-bold"
        style={{ left: '42%', top: '57%', background: 'white', color: C.inkDeep, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      >
        100 m
      </motion.div>
    </div>

    {/* Push notification — what THE CUSTOMER receives */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-3 mt-3 rounded-2xl px-3 py-2.5 backdrop-blur-md flex items-start gap-2.5"
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)',
      }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white"
        style={{ background: 'linear-gradient(135deg, ' + C.sky + ', ' + C.lavender + ')' }}>
        <MapPin size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold leading-tight" style={{ color: '#1C1917' }}>Café Lumière</p>
          <p className="text-[8px]" style={{ color: '#57534E' }}>now</p>
        </div>
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#1C1917' }}>Vous passez devant ?</p>
        <p className="text-[9px] leading-tight" style={{ color: '#57534E' }}>
          5€ offert sur votre prochain café — entrez nous voir.
        </p>
      </div>
    </motion.div>

    {/* Headline + 4 feature pills (cascade in) */}
    <div className="px-3 mt-3 mb-1">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.terracotta }}>
        When your VIP walks past
      </p>
      <p className="text-[10px] font-semibold mt-0.5 leading-tight" style={{ color: C.inkDeep }}>
        They get a friendly nudge — not you.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-1.5 mx-3 mb-3">
      {features.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 + i * 0.18, duration: 0.4 }}
          className="rounded-lg px-2 py-1.5 flex items-start gap-1.5"
          style={{ background: 'white', border: '1px solid ' + C.hairline }}
        >
          <span className="text-[12px] leading-none">{f.icon}</span>
          <div className="min-w-0">
            <p className="text-[8.5px] font-bold leading-tight truncate" style={{ color: C.inkDeep }}>{f.title}</p>
            <p className="text-[7.5px] leading-tight truncate" style={{ color: C.inkMute }}>{f.sub}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
  );
};

/* ===================================================================== */
/* SCENE 5 — AI INTELLIGENCE                                              */
/* ===================================================================== */
const SceneAIIntelligence = () => {
  // Four AI-generated insight cards that cascade in. The first three are
  // proactive recommendations the merchant can act on; the fourth is a
  // predictive churn alert.
  const insights = [
    {
      icon: Target, tone: 'lavender',
      eyebrow: 'Recommended action',
      title: 'Win back 12 silent Gold customers',
      detail: 'Send "we miss you" — projected uplift +€340 this week.',
      metric: '+€340',
    },
    {
      icon: TrendingUp, tone: 'sage',
      eyebrow: 'Pattern detected',
      title: 'Tuesday is your peak — by 23%',
      detail: 'Schedule extra staff 11:00–14:00. Push offer Mon evening.',
      metric: '+23%',
    },
    {
      icon: AlertTriangle, tone: 'terracotta',
      eyebrow: 'Churn alert',
      title: 'Sophie likely to churn in 9 days',
      detail: 'Best-paying customer drifted from her 6-day rhythm.',
      metric: 'act today',
    },
    {
      icon: Zap, tone: 'ochre',
      eyebrow: 'Quick win',
      title: 'Lower Silver to 8 visits',
      detail: 'Promotes 47 customers, lifts visit frequency ~19%.',
      metric: '+47',
    },
  ];

  const toneColor = (t) => ({
    lavender: C.lavender, sage: C.sage, terracotta: C.terracotta, ochre: C.ochre,
  }[t] || C.terracotta);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 px-3.5 py-3 overflow-hidden flex flex-col gap-2"
      style={{ background: 'linear-gradient(180deg, #FDFBF7 0%, #F0EDFA 100%)' }}
    >
      {/* Header — AI assistant identity */}
      <div className="flex items-center gap-2 mt-1">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, ' + C.lavender + ', ' + C.terracotta + ')' }}
        >
          <BrainCircuit size={14} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold leading-tight" style={{ color: C.inkDeep }}>AI Intelligence</p>
          <div className="flex items-center gap-1 mt-0.5">
            <motion.span
              className="block w-1 h-1 rounded-full"
              style={{ background: C.sage }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <p className="text-[8px]" style={{ color: C.inkMute }}>Live · learning from your data</p>
          </div>
        </div>
        <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ background: C.terracotta + '1A', color: C.terracotta }}>
          4 NEW
        </span>
      </div>

      {/* "Auto-detected today" banner */}
      <motion.div
        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-lg p-2 mt-1"
        style={{
          background: 'linear-gradient(135deg, ' + C.lavender + '12, ' + C.terracotta + '08)',
          border: '1px solid ' + C.lavender + '33',
        }}
      >
        <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: C.lavender }}>
          ✨ Auto-detected · ranked by impact
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: C.inkSoft }}>
          Patterns the platform spotted in your last 30 days, sorted by projected revenue.
        </p>
      </motion.div>

      {/* Stack of 4 insight cards — cascade in 0.3s apart */}
      <div className="flex flex-col gap-1.5 mt-1 flex-1 overflow-hidden">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          const accent = toneColor(ins.tone);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.32, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg p-2 flex gap-2 items-start"
              style={{
                background: 'white',
                border: '1px solid ' + accent + '33',
                boxShadow: '0 1px 3px rgba(28,25,23,0.05)',
              }}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: accent + '1A', color: accent, border: '1px solid ' + accent + '33' }}>
                <Icon size={11} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-[7.5px] font-bold uppercase tracking-widest leading-none" style={{ color: accent }}>
                    {ins.eyebrow}
                  </p>
                  <span className="text-[8px] font-bold leading-none" style={{ color: accent }}>
                    {ins.metric}
                  </span>
                </div>
                <p className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: C.inkDeep }}>{ins.title}</p>
                <p className="text-[8.5px] leading-tight mt-0.5" style={{ color: C.inkMute }}>{ins.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* "Ask anything" prompt at the bottom */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.9, duration: 0.4 }}
        className="mt-1 rounded-lg px-2 py-1.5 flex items-center gap-2"
        style={{
          background: 'linear-gradient(135deg, ' + C.inkDeep + ' 0%, #2A1C2E 100%)',
          color: 'white',
        }}
      >
        <Sparkles size={11} style={{ color: C.ochre }} />
        <p className="text-[9px] flex-1 truncate">Ask: "Why did Saturday drop?"</p>
        <span className="text-[8px] font-bold opacity-70">⌘K</span>
      </motion.div>
    </motion.div>
  );
};

/* ===================================================================== */
/* DASHBOARD ECHO — soft desktop mockup behind the phone                  */
/* ===================================================================== */
const DashboardEcho = ({ scene }) => (
  <div
    aria-hidden="true"
    className="absolute hidden lg:block"
    style={{
      right: -40, top: 80,
      width: 380, height: 240,
      transform: 'perspective(1500px) rotateY(-12deg) rotateX(4deg)',
      transformStyle: 'preserve-3d',
      opacity: 0.55,
      filter: 'blur(0.4px)',
    }}
  >
    {/* Browser shell */}
    <div className="rounded-xl shadow-xl border w-full h-full overflow-hidden"
      style={{ background: 'white', borderColor: C.hairline }}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: C.hairline, background: C.sand }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#FF5F57' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#FEBC2E' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#28C840' }} />
        <span className="ml-2 text-[9px] font-mono" style={{ color: C.inkMute }}>fidelitour.fr/{scene}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="p-3"
          style={{ background: C.cream, height: 'calc(100% - 28px)' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: C.inkFaint }}>
            {scene === 'analytics'     && 'Dashboard · Analytics'}
            {scene === 'notifications' && 'Notifications · Live feed'}
            {scene === 'wallet'        && 'Card Designer · Live preview'}
            {scene === 'geolocation'   && 'Customer Map · Geofences'}
            {scene === 'ai'            && 'Insights · AI recommendations'}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} className="rounded-md p-2 border"
                style={{ background: 'white', borderColor: C.hairline, height: 36 }} />
            ))}
          </div>
          <div className="rounded-md mt-2 border" style={{ background: 'white', borderColor: C.hairline, height: 80 }} />
        </motion.div>
      </AnimatePresence>
    </div>
  </div>
);

export default HeroPhoneShowcase;
