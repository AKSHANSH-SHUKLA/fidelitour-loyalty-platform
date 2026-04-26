import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  MapPin, BrainCircuit, ScanLine, Smartphone, Settings2, BarChart3,
  Users, TrendingUp, Star, Sparkles, Zap, Target, Megaphone, Gift,
  ChevronRight, Check, ArrowRight, Award, Activity, MessageSquare,
} from 'lucide-react';
import { AuchanPreview, DEFAULT_LAYOUT } from '../components/AuchanCard';

/* =====================================================================
   COLOR SYSTEM — vibrant pastels + saturated accents
   ===================================================================== */
const C = {
  // Brand
  terracotta: '#B85C38',
  ochre:      '#E3A869',
  rose:       '#D77FA0',
  lavender:   '#8B7DC9',
  sky:        '#6BA4D9',
  teal:       '#6FA89C',
  sage:       '#88B27E',
  coral:      '#F08C7A',
  // Pastel surfaces
  cream:      '#FDFBF7',
  sand:       '#F5EFE5',
  shellPink:  '#FCE3DC',
  blush:      '#FBE0E8',
  lilac:      '#F0EBF8',
  azure:      '#DDEBF6',
  mint:       '#DDF1ED',
  meadow:     '#E5F0DC',
  butter:     '#FDF1DC',
  // Ink
  inkDeep:    '#1C1917',
  inkSoft:    '#3D2820',
  inkMute:    '#57534E',
  inkFaint:   '#8B8680',
  hairline:   '#EFE9E0',
};

/* ---------------------------------------------------------------------
   AnimatedNumber — counts up from 0 to target when scrolled into view
   --------------------------------------------------------------------- */
function AnimatedNumber({ to, format = (n) => n.toLocaleString(), duration = 1.6, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return <span ref={ref}>{format(Math.round(val))}{suffix}</span>;
}

/* ---------------------------------------------------------------------
   Reusable: badged eyebrow at the start of a section
   --------------------------------------------------------------------- */
const Eyebrow = ({ children, color = C.terracotta, bg = C.shellPink }) => (
  <span
    className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] mb-6"
    style={{ backgroundColor: bg, color }}
  >
    {children}
  </span>
);

/* =====================================================================
   ANIMATED HERO DASHBOARD MOCKUP
   Live-feeling product preview that sits next to the hero copy
   ===================================================================== */
function HeroDashboardMockup() {
  return (
    <div className="relative w-full max-w-[640px] mx-auto" style={{ perspective: '1500px' }}>
      {/* Multi-color glow halo behind */}
      <div
        aria-hidden="true"
        className="absolute -inset-12 rounded-[40px] opacity-50 blur-3xl pointer-events-none"
        style={{
          background:
            'conic-gradient(from 90deg, ' + C.terracotta + ', ' + C.rose + ', ' + C.lavender + ', ' + C.sky + ', ' + C.teal + ', ' + C.terracotta + ')',
        }}
      />

      {/* The "browser" frame */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border"
        style={{ borderColor: C.hairline, transformStyle: 'preserve-3d' }}
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: C.hairline, background: C.sand }}>
          <span className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#FEBC2E' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
          <span className="ml-3 px-3 py-1 rounded-md text-xs font-mono"
                style={{ background: 'white', color: C.inkMute, border: '1px solid ' + C.hairline }}>
            fidelitour.fr/dashboard
          </span>
        </div>

        {/* Dashboard interior */}
        <div className="p-5 space-y-3" style={{ background: C.cream }}>
          {/* Top row: 4 KPI tiles */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Users,      label: 'Customers',  value: '2,847', accent: C.sky,       bg: C.azure },
              { icon: Activity,   label: 'Visits',     value: '14.2K', accent: C.sage,      bg: C.meadow },
              { icon: TrendingUp, label: 'Repeat',     value: '96%',   accent: C.terracotta, bg: C.shellPink },
              { icon: Star,       label: 'Rating',     value: '8.7',   accent: C.ochre,     bg: C.butter },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <motion.div
                  key={k.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="rounded-xl p-2.5 border"
                  style={{ background: 'white', borderColor: C.hairline }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5" style={{ background: k.bg }}>
                    <Icon size={14} style={{ color: k.accent }} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.inkFaint }}>{k.label}</p>
                  <p className="text-base font-bold" style={{ color: C.inkDeep }}>{k.value}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Mid row: chart + tier pie */}
          <div className="grid grid-cols-3 gap-2">
            {/* Visits-over-time chart */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="col-span-2 rounded-xl p-3 border"
              style={{ background: 'white', borderColor: C.hairline }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.inkFaint }}>
                Visits — last 14 days
              </p>
              <svg viewBox="0 0 200 60" className="w-full h-14">
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor={C.terracotta} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={C.terracotta} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 45 L15 38 L30 42 L45 30 L60 35 L75 22 L90 28 L105 18 L120 24 L135 14 L150 20 L165 12 L180 16 L195 8"
                  fill="none"
                  stroke={C.terracotta}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.9 }}
                />
                <motion.path
                  d="M0 45 L15 38 L30 42 L45 30 L60 35 L75 22 L90 28 L105 18 L120 24 L135 14 L150 20 L165 12 L180 16 L195 8 L195 60 L0 60 Z"
                  fill="url(#lg)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 1.5 }}
                />
              </svg>
            </motion.div>

            {/* Tier distribution */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.85 }}
              className="rounded-xl p-3 border"
              style={{ background: 'white', borderColor: C.hairline }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.inkFaint }}>Tiers</p>
              <div className="flex justify-center">
                <svg viewBox="0 0 60 60" className="w-14 h-14">
                  <circle cx="30" cy="30" r="22" fill="none" stroke={C.shellPink} strokeWidth="10" />
                  <motion.circle
                    cx="30" cy="30" r="22" fill="none" stroke={C.terracotta} strokeWidth="10"
                    strokeDasharray="138" strokeDashoffset="69" transform="rotate(-90 30 30)"
                    initial={{ strokeDashoffset: 138 }} animate={{ strokeDashoffset: 69 }}
                    transition={{ duration: 1, delay: 1 }}
                  />
                </svg>
              </div>
              <div className="flex justify-center gap-1 mt-1 text-[9px]" style={{ color: C.inkMute }}>
                <span>Gold</span><span style={{ color: C.inkFaint }}>·</span><span>52%</span>
              </div>
            </motion.div>
          </div>

          {/* Bottom row: live activity feed */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="rounded-xl p-3 border space-y-1.5"
            style={{ background: 'white', borderColor: C.hairline }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.inkFaint }}>Live activity</p>
            {[
              { dot: C.sage,       text: 'Sophie M. visited · +25 pts',   t: 'now' },
              { dot: C.lavender,   text: 'Antoine L. became VIP',          t: '2m' },
              { dot: C.coral,      text: 'Birthday offer sent · 12 cust.', t: '5m' },
            ].map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.15 }}
                className="flex items-center gap-2 text-[11px]"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.dot }} />
                <span className="flex-1 truncate" style={{ color: C.inkDeep }}>{a.text}</span>
                <span style={{ color: C.inkFaint }}>{a.t}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Floating notification card on top-right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.4 }}
        className="absolute -right-4 lg:-right-12 top-16 hidden md:flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border"
        style={{ background: 'white', borderColor: C.hairline }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
             style={{ background: 'linear-gradient(135deg, ' + C.rose + ' 0%, ' + C.lavender + ' 100%)' }}>
          <Gift size={18} />
        </div>
        <div className="text-xs">
          <p className="font-bold" style={{ color: C.inkDeep }}>🎂 Birthday today</p>
          <p style={{ color: C.inkMute }}>Sending offer to <b>Marie D.</b></p>
        </div>
      </motion.div>

      {/* Floating "+€42 in revenue today" pill on bottom-left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.6 }}
        className="absolute -left-4 lg:-left-10 bottom-12 hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl border"
        style={{ background: 'white', borderColor: C.hairline }}
      >
        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: C.sage }} />
        <span className="text-sm font-bold" style={{ color: C.inkDeep }}>+€42 today · live</span>
      </motion.div>

      {/* "VIP unlocked" pill mid-right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.8 }}
        className="absolute right-2 lg:-right-8 bottom-32 hidden lg:flex items-center gap-2 px-4 py-2 rounded-full shadow-xl"
        style={{
          background: 'linear-gradient(135deg, ' + C.lavender + ' 0%, ' + C.rose + ' 100%)',
          color: 'white',
        }}
      >
        <Sparkles size={14} />
        <span className="text-xs font-bold">VIP unlocked</span>
      </motion.div>
    </div>
  );
}

/* =====================================================================
   BENTO FEATURE CARD — varied sizes, colorful surfaces
   ===================================================================== */
function BentoCard({ children, className = '', tint = 'white', border = C.hairline, glow }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={`relative rounded-3xl p-7 border overflow-hidden ${className}`}
      style={{ background: tint, borderColor: border }}
    >
      {glow && (
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: glow }}
        />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  );
}

/* =====================================================================
   SHOWCASE CARD — premium, elegant, marketing-grade loyalty card.
   Used only in the landing page hero/demo. Different from the production
   AuchanPreview which is utilitarian. This one is meant to wow.
   ===================================================================== */
function ShowcaseCard() {
  const cardRef = useRef(null);
  // Mouse-tilt for a 3D feel
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 25 });
  const rX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 25 });
  // Glare follows cursor
  const gx = useTransform(mx, [-0.5, 0.5], ['10%', '90%']);
  const gy = useTransform(my, [-0.5, 0.5], ['10%', '90%']);
  const handleMove = (e) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateY: rY, rotateX: rX, transformStyle: 'preserve-3d', perspective: '1200px' }}
      className="relative w-full max-w-[400px]"
    >
      {/* Multi-color halo behind the card */}
      <div
        aria-hidden="true"
        className="absolute -inset-12 rounded-[48px] opacity-60 blur-3xl pointer-events-none"
        style={{
          background: `conic-gradient(from 90deg, ${C.terracotta}, ${C.ochre}, ${C.rose}, ${C.lavender}, ${C.sky}, ${C.teal}, ${C.terracotta})`,
        }}
      />

      {/* The card itself */}
      <div
        className="relative rounded-[32px] overflow-hidden"
        style={{
          background: `
            radial-gradient(at 0% 0%, ${C.shellPink} 0%, transparent 50%),
            radial-gradient(at 100% 0%, ${C.butter} 0%, transparent 50%),
            radial-gradient(at 100% 100%, ${C.lilac} 0%, transparent 50%),
            radial-gradient(at 0% 100%, ${C.mint} 0%, transparent 50%),
            linear-gradient(135deg, #FFFEFB 0%, ${C.cream} 100%)
          `,
          boxShadow: `
            0 40px 80px -20px rgba(28,25,23,0.45),
            0 16px 40px -10px ${C.terracotta}30,
            0 0 0 1px rgba(255,255,255,0.6) inset,
            0 1px 2px rgba(255,255,255,0.9) inset
          `,
        }}
      >
        {/* Subtle iridescent shimmer overlay */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-40"
          style={{
            background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)`,
            backgroundSize: '300% 100%',
          }}
          animate={{ backgroundPosition: ['200% center', '-100% center'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />

        {/* Cursor-tracking glare */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-60"
          style={{
            background: useTransform(
              [gx, gy],
              ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.7) 0%, transparent 50%)`
            ),
          }}
        />

        {/* ============= CARD CONTENT ============= */}
        <div className="relative p-6 space-y-5">
          {/* HEADER ROW: business identity + tier pill */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              {/* Logo medallion with gold-foil ring */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md relative"
                style={{
                  background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)`,
                }}
              >
                {/* Gold-foil ring */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-0.5 rounded-full pointer-events-none"
                  style={{
                    background: `conic-gradient(from 0deg, ${C.ochre}, #FFE9C2, ${C.ochre}, #FFE9C2, ${C.ochre})`,
                    padding: '1.5px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />
                <span className="relative">CL</span>
              </div>
              <div>
                <p className="font-['Cormorant_Garamond'] text-base font-bold leading-tight" style={{ color: C.inkDeep }}>
                  Café Lumière
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: C.inkFaint }}>
                  Programme Fidélité
                </p>
              </div>
            </div>

            {/* VIP / Tier pill */}
            <div
              className="relative px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm"
              style={{
                background: `linear-gradient(135deg, #FFE9C2 0%, ${C.ochre} 50%, #B98947 100%)`,
                color: '#5A3A0F',
                boxShadow: `0 2px 8px ${C.ochre}40, inset 0 1px 0 rgba(255,255,255,0.6)`,
              }}
            >
              <span className="relative flex items-center gap-1">
                <Sparkles size={10} />
                Gold Member
              </span>
            </div>
          </div>

          {/* HERO ZONE: greeting + cagnotte */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: C.inkFaint }}>
                Bonjour
              </p>
              <p className="font-['Cormorant_Garamond'] text-3xl font-bold leading-none" style={{ color: C.inkDeep }}>
                Sophie
              </p>
              <p className="text-xs mt-1" style={{ color: C.inkMute }}>
                <span style={{ color: C.rose }}>🎂</span> 12 Mai
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: C.inkFaint }}>
                Ma cagnotte
              </p>
              <p className="font-['Cormorant_Garamond'] text-4xl font-bold leading-none">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.ochre} 100%)`,
                  }}
                >
                  12,40
                </span>
                <span className="text-2xl ml-1" style={{ color: C.terracotta }}>€</span>
              </p>
            </div>
          </div>

          {/* PROGRESS BAR with gradient + pearl marker */}
          <div>
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: C.inkMute }}>
              <span className="font-semibold">Progression</span>
              <span className="font-semibold">7 / 10 visites</span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(28,25,23,0.08)' }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${C.terracotta} 0%, ${C.ochre} 50%, ${C.rose} 100%)`,
                }}
                initial={{ width: '0%' }}
                whileInView={{ width: '70%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: C.inkMute }}>
              <span className="font-bold" style={{ color: C.terracotta }}>3 visites</span> avant votre récompense ✨
            </p>
          </div>

          {/* STAMPS — gold-foil hexagons */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: C.inkFaint }}>
              Vos tampons
            </p>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < 7;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.05 * i, ease: 'easeOut' }}
                    className="relative"
                    style={{ width: 26, height: 30 }}
                  >
                    <svg viewBox="0 0 100 110" className="w-full h-full">
                      <defs>
                        <linearGradient id={`stamp-${i}`} x1="0" y1="0" x2="1" y2="1">
                          {filled ? (
                            <>
                              <stop offset="0%" stopColor="#FFE9C2" />
                              <stop offset="50%" stopColor={C.ochre} />
                              <stop offset="100%" stopColor="#B98947" />
                            </>
                          ) : (
                            <>
                              <stop offset="0%" stopColor="rgba(28,25,23,0.06)" />
                              <stop offset="100%" stopColor="rgba(28,25,23,0.10)" />
                            </>
                          )}
                        </linearGradient>
                      </defs>
                      <polygon
                        points="50,5 93.3,27.5 93.3,72.5 50,95 6.7,72.5 6.7,27.5"
                        fill={`url(#stamp-${i})`}
                        stroke={filled ? '#8C5C15' : 'rgba(28,25,23,0.10)'}
                        strokeWidth={filled ? 1.5 : 1}
                      />
                      {filled && (
                        <text x="50" y="60" fontSize="32" fontWeight="bold" fill="#5A3A0F" textAnchor="middle">
                          ★
                        </text>
                      )}
                    </svg>
                    {filled && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full opacity-30 blur-md pointer-events-none"
                        style={{ background: C.ochre }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* OFFER STRIP */}
          <div
            className="rounded-2xl p-3 flex items-center gap-3 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${C.shellPink} 0%, ${C.lilac} 100%)`,
              border: `1px solid ${C.rose}30`,
            }}
          >
            <div
              aria-hidden="true"
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-50 blur-2xl"
              style={{ background: C.rose }}
            />
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 relative"
              style={{ background: `linear-gradient(135deg, ${C.rose} 0%, ${C.terracotta} 100%)` }}
            >
              <Gift size={18} />
            </div>
            <div className="flex-1 relative">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.inkFaint }}>
                Offre exclusive
              </p>
              <p className="text-sm font-bold leading-tight" style={{ color: C.inkDeep }}>
                Pâtisserie offerte au 10ᵉ café
              </p>
            </div>
          </div>

          {/* BARCODE */}
          <div className="flex flex-col items-center pt-1">
            <svg viewBox="0 0 200 36" className="w-full" preserveAspectRatio="none" style={{ height: 36 }}>
              {Array.from({ length: 60 }).map((_, i) => {
                const w = 1 + ((i * 9301 + 49297) % 233280) % 4 / 1.5;
                let x = 0;
                for (let j = 0; j < i; j++) {
                  x += 1 + ((j * 9301 + 49297) % 233280) % 4 / 1.5 + 1;
                }
                return <rect key={i} x={x} y={0} width={w} height={36} fill={C.inkDeep} />;
              })}
            </svg>
            <p className="text-[9px] font-mono tracking-[0.3em] mt-1.5" style={{ color: C.inkFaint }}>
              FT-AKSH0001
            </p>
          </div>
        </div>

        {/* Bottom gold-foil accent line */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, ${C.terracotta} 0%, ${C.ochre} 25%, #FFE9C2 50%, ${C.ochre} 75%, ${C.terracotta} 100%)`,
          }}
        />
      </div>

      {/* Floating decorative pills around the card for that elegant marketing-shot feel */}
      <motion.div
        aria-hidden="true"
        className="absolute -left-12 top-16 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-xl border"
        style={{ borderColor: C.hairline, transform: 'translateZ(60px)' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.sage }} />
        <span className="text-[10px] font-bold" style={{ color: C.inkDeep }}>Apple Wallet</span>
      </motion.div>
      <motion.div
        aria-hidden="true"
        className="absolute -right-10 bottom-24 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xl border"
        style={{ background: 'white', borderColor: C.hairline, transform: 'translateZ(60px)' }}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      >
        <Sparkles size={11} style={{ color: C.lavender }} />
        <span className="text-[10px] font-bold" style={{ color: C.inkDeep }}>Live updates</span>
      </motion.div>
    </motion.div>
  );
}

/* =====================================================================
   MAIN LANDING PAGE
   ===================================================================== */
const LandingPage = () => {
  return (
    <div className="min-h-screen font-['Manrope']" style={{ background: C.cream, color: C.inkDeep }}>

      {/* ───────────── NAVIGATION ───────────── */}
      <nav className="fixed w-full backdrop-blur-md border-b z-50" style={{ background: 'rgba(253,251,247,0.85)', borderColor: C.hairline }}>
        <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-[2px]"
             style={{ background: `linear-gradient(90deg, ${C.terracotta} 0%, ${C.rose} 25%, ${C.lavender} 50%, ${C.sky} 75%, ${C.teal} 100%)` }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md"
                 style={{ background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)` }}>F</div>
            <span className="font-['Cormorant_Garamond'] text-2xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)` }}>
              FidéliTour
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 font-medium text-sm">
            <a href="#features" className="hover:text-[#B85C38] transition-colors">Capabilities</a>
            <a href="#proof"    className="hover:text-[#B85C38] transition-colors">Proof</a>
            <a href="#how"      className="hover:text-[#B85C38] transition-colors">How it works</a>
            <a href="#pricing"  className="hover:text-[#B85C38] transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="font-medium text-sm hover:text-[#B85C38] transition-colors">Sign in</Link>
            <Link to="/register"
                  className="text-white px-5 py-2 rounded-full text-sm font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${C.inkDeep} 0%, ${C.inkSoft} 100%)` }}>
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ───────────── HERO — split layout ───────────── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Ambient orbs */}
        <motion.div aria-hidden="true" className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-3xl opacity-50 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.shellPink} 0%, transparent 70%)` }}
                    animate={{ x: [0, 60, 0], y: [0, -40, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div aria-hidden="true" className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.azure} 0%, transparent 70%)` }}
                    animate={{ x: [0, -50, 0], y: [0, 40, 0] }} transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
        <motion.div aria-hidden="true" className="absolute bottom-0 left-1/3 w-[420px] h-[420px] rounded-full blur-3xl opacity-40 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.lilac} 0%, transparent 70%)` }}
                    animate={{ x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 4 }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <div>
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border shadow-sm mb-6"
                        style={{ borderColor: C.hairline }}>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: C.sage }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.sage }} />
              </span>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: C.inkMute }}>
                <span style={{ color: C.terracotta }}>2,800+</span> · businesses retain customers with us
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-['Cormorant_Garamond'] text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight"
            >
              The retention engine your <br/>
              <span className="bg-clip-text text-transparent inline-block"
                    style={{
                      backgroundImage: `linear-gradient(110deg, ${C.terracotta} 0%, ${C.ochre} 25%, ${C.rose} 50%, ${C.lavender} 75%, ${C.sky} 100%)`,
                      backgroundSize: '200% auto',
                      animation: 'heroGradient 8s linear infinite',
                    }}>
                local business deserves.
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }}
                      className="text-lg md:text-xl mt-6 leading-relaxed max-w-xl" style={{ color: C.inkMute }}>
              Digital wallet cards. Automated campaigns. Real-time analytics. Sentiment tracking.
              FidéliTour does in 5 minutes what your old loyalty stamp card couldn't do in a decade.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-col sm:flex-row gap-3 mt-10">
              <Link to="/register"
                    className="inline-flex items-center justify-center gap-2 text-white px-7 py-4 rounded-full font-semibold text-base shadow-xl transition-all hover:-translate-y-0.5"
                    style={{ background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)`, boxShadow: `0 12px 28px ${C.terracotta}40` }}>
                Start free for 30 days
                <ArrowRight size={18} />
              </Link>
              <a href="#how"
                 className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-semibold text-base border-2 transition-all hover:bg-white"
                 style={{ borderColor: C.hairline, background: 'rgba(255,255,255,0.6)', color: C.inkDeep }}>
                See how it works
              </a>
            </motion.div>

            {/* Trust strip */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }}
                        className="flex items-center gap-4 mt-8 text-sm" style={{ color: C.inkMute }}>
              <div className="flex -space-x-2">
                {[C.rose, C.ochre, C.sage, C.sky].map((bg, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white"
                       style={{ background: `linear-gradient(135deg, ${bg} 0%, ${C.terracotta} 100%)` }} />
                ))}
              </div>
              <span>
                <b style={{ color: C.inkDeep }}>4.9/5</b> from 80+ owners ·
                <span className="ml-1" style={{ color: C.ochre }}>★★★★★</span>
              </span>
            </motion.div>
          </div>

          {/* Right — animated dashboard mockup */}
          <div className="relative">
            <HeroDashboardMockup />
          </div>
        </div>

        <style>{`@keyframes heroGradient { to { background-position: 200% center; } }`}</style>
      </section>

      {/* ───────────── STATS STRIP — animated counters ───────────── */}
      <section id="proof" className="relative py-16 border-y" style={{ borderColor: C.hairline, background: 'white' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {[
            { value: 2847, suffix: '+', label: 'Active customers tracked', color: C.sky },
            { value: 96,   suffix: '%',  label: 'Average repeat rate',     color: C.sage },
            { value: 14,   suffix: 'K',  label: 'Visits recorded weekly',  color: C.terracotta },
            { value: 24,   suffix: '€',  label: 'Saved per customer/year', color: C.lavender, prefix: '+' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-['Cormorant_Garamond'] text-5xl lg:text-6xl font-bold"
                 style={{ color: stat.color }}>
                {stat.prefix || ''}<AnimatedNumber to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm font-medium mt-2" style={{ color: C.inkMute }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── PROBLEM / OUTCOME ───────────── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Eyebrow color={C.coral} bg={C.shellPink}>The shift</Eyebrow>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-tight">
              Yesterday's punch card.<br/>
              <span style={{ color: C.terracotta }}>Today's retention engine.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Old way */}
            <div className="rounded-3xl p-8 border-2 relative overflow-hidden"
                 style={{ borderColor: C.hairline, background: C.sand }}>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
                    style={{ background: 'rgba(140,134,128,0.15)', color: C.inkFaint }}>
                The old way
              </span>
              <h3 className="font-['Cormorant_Garamond'] text-3xl font-bold mb-4" style={{ color: C.inkSoft }}>
                Paper cards & guesswork
              </h3>
              <ul className="space-y-3 text-sm" style={{ color: C.inkMute }}>
                <li className="flex gap-2">✗ Customers lose them in 3 weeks</li>
                <li className="flex gap-2">✗ You don't know who came back, or didn't</li>
                <li className="flex gap-2">✗ No way to message dormant customers</li>
                <li className="flex gap-2">✗ Birthdays go uncelebrated</li>
                <li className="flex gap-2">✗ Marketing is "post on Instagram and pray"</li>
              </ul>
            </div>
            {/* New way */}
            <div className="rounded-3xl p-8 border-2 relative overflow-hidden"
                 style={{
                   borderColor: C.terracotta + '30',
                   background: `linear-gradient(135deg, ${C.shellPink} 0%, ${C.butter} 50%, ${C.lilac} 100%)`,
                 }}>
              <div aria-hidden="true" className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-50"
                   style={{ background: C.rose }} />
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 relative"
                    style={{ background: C.terracotta, color: 'white' }}>
                With FidéliTour
              </span>
              <h3 className="font-['Cormorant_Garamond'] text-3xl font-bold mb-4 relative" style={{ color: C.inkDeep }}>
                Wallet cards that work for you
              </h3>
              <ul className="space-y-3 text-sm relative" style={{ color: C.inkSoft }}>
                <li className="flex gap-2"><Check size={18} style={{ color: C.sage }} /> Card lives in Apple Wallet — never lost</li>
                <li className="flex gap-2"><Check size={18} style={{ color: C.sage }} /> Live dashboard — every visit, every stamp, every euro</li>
                <li className="flex gap-2"><Check size={18} style={{ color: C.sage }} /> Auto-detect sleeping customers, send a personal nudge</li>
                <li className="flex gap-2"><Check size={18} style={{ color: C.sage }} /> Birthday offers fire automatically — every year</li>
                <li className="flex gap-2"><Check size={18} style={{ color: C.sage }} /> AI tells you which 12 customers to contact today</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── BENTO FEATURE GRID ───────────── */}
      <section id="features" className="relative py-20 lg:py-28" style={{ background: 'white' }}>
        <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-1"
             style={{ background: `linear-gradient(90deg, ${C.terracotta} 0%, ${C.rose} 20%, ${C.lavender} 40%, ${C.sky} 60%, ${C.teal} 80%, ${C.sage} 100%)` }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Eyebrow color={C.lavender} bg={C.lilac}>Capabilities</Eyebrow>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-tight">
              Everything to grow loyalty,<br/>
              <span style={{ color: C.lavender }}>nothing you don't need.</span>
            </h2>
          </div>

          {/* Bento — 6 cards in a varied grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-fr">
            {/* LARGE — Wallet integration */}
            <BentoCard className="md:col-span-2 md:row-span-2" tint={C.azure} border={`${C.sky}40`} glow={C.sky + '50'}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                   style={{ background: 'white', boxShadow: `0 4px 12px ${C.sky}30` }}>
                <Smartphone size={24} style={{ color: C.sky }} />
              </div>
              <h3 className="font-['Cormorant_Garamond'] text-3xl font-bold mb-3" style={{ color: C.inkDeep }}>
                Native Apple Wallet & Google Wallet
              </h3>
              <p className="text-base leading-relaxed mb-5" style={{ color: C.inkMute }}>
                Customers tap once and the card lives in their wallet next to their credit cards.
                No app to download. No friction. Real-time updates push from your dashboard.
              </p>
              {/* Mini visual */}
              <div className="flex items-center gap-3 mt-6">
                <div className="flex-1 rounded-xl p-3 border" style={{ background: 'white', borderColor: C.hairline }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.inkFaint }}>Apple Wallet</p>
                  <p className="text-sm font-bold mt-1" style={{ color: C.inkDeep }}>iOS · iPadOS</p>
                </div>
                <div className="flex-1 rounded-xl p-3 border" style={{ background: 'white', borderColor: C.hairline }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.inkFaint }}>Google Wallet</p>
                  <p className="text-sm font-bold mt-1" style={{ color: C.inkDeep }}>Android · Chrome</p>
                </div>
              </div>
            </BentoCard>

            {/* SMALL — AI */}
            <BentoCard tint={C.lilac} border={`${C.lavender}40`} glow={C.lavender + '50'}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                   style={{ background: 'white', boxShadow: `0 4px 12px ${C.lavender}30` }}>
                <BrainCircuit size={22} style={{ color: C.lavender }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: C.inkDeep }}>AI advisor</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.inkMute }}>
                "Who should I message this week?" — get a real answer in plain language.
              </p>
            </BentoCard>

            {/* SMALL — Sentiment */}
            <BentoCard tint={C.shellPink} border={`${C.coral}40`} glow={C.coral + '50'}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                   style={{ background: 'white', boxShadow: `0 4px 12px ${C.coral}30` }}>
                <MessageSquare size={22} style={{ color: C.coral }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: C.inkDeep }}>Sentiment tracking</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.inkMute }}>
                Reviews automatically tagged as positive, negative, by topic — speed, staff, price, cleanliness.
              </p>
            </BentoCard>

            {/* MEDIUM — Geofence */}
            <BentoCard tint={C.meadow} border={`${C.sage}40`} glow={C.sage + '50'}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                   style={{ background: 'white', boxShadow: `0 4px 12px ${C.sage}30` }}>
                <MapPin size={22} style={{ color: C.sage }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: C.inkDeep }}>Geofenced offers</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.inkMute }}>
                When a VIP customer walks within 500m of your store, they get a friendly nudge.
              </p>
            </BentoCard>

            {/* MEDIUM — Campaigns */}
            <BentoCard tint={C.butter} border={`${C.ochre}40`} glow={C.ochre + '50'}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                   style={{ background: 'white', boxShadow: `0 4px 12px ${C.ochre}30` }}>
                <Megaphone size={22} style={{ color: C.ochre }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: C.inkDeep }}>Targeted campaigns</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.inkMute }}>
                12 one-click segments. Send to lunch regulars, dormant customers, big spenders — in 30 seconds.
              </p>
            </BentoCard>

            {/* WIDE — Analytics */}
            <BentoCard className="md:col-span-3" tint={C.cream} border={C.hairline}>
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                       style={{ background: 'white', boxShadow: `0 4px 12px ${C.terracotta}30`, border: `1px solid ${C.hairline}` }}>
                    <BarChart3 size={22} style={{ color: C.terracotta }} />
                  </div>
                  <h3 className="font-['Cormorant_Garamond'] text-2xl md:text-3xl font-bold mb-2" style={{ color: C.inkDeep }}>
                    25+ live KPIs, every one drillable
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.inkMute }}>
                    Repeat rate. Churn. LTV. Visits per branch. Time-of-day mix.
                    Click any number — see exactly which customers are behind it.
                  </p>
                </div>
                {/* Mini chart */}
                <div className="rounded-2xl p-4 border" style={{ background: 'white', borderColor: C.hairline }}>
                  <div className="flex items-end justify-between h-24 gap-1.5">
                    {[40, 55, 48, 70, 62, 85, 92, 78, 95, 88, 100, 92].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className="flex-1 rounded-t origin-bottom"
                        style={{
                          height: `${h}%`,
                          background: `linear-gradient(to top, ${C.terracotta}, ${C.rose})`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px]" style={{ color: C.inkFaint }}>
                    <span>Jan</span><span>Apr</span><span>Aug</span><span>Dec</span>
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ───────────── CARD PREVIEW ───────────── */}
      <section id="demo" className="relative py-20 lg:py-28 overflow-hidden"
               style={{ background: `linear-gradient(135deg, ${C.cream} 0%, ${C.shellPink} 25%, ${C.lilac} 50%, ${C.azure} 75%, ${C.meadow} 100%)` }}>
        <motion.div aria-hidden="true" className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.rose} 0%, transparent 70%)` }}
                    animate={{ x: [0, 40, 0], y: [0, -30, 0] }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div aria-hidden="true" className="absolute bottom-1/4 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-50 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.lavender} 0%, transparent 70%)` }}
                    animate={{ x: [0, -50, 0], y: [0, 30, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 3 }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow color={C.rose} bg={C.blush}>The customer's view</Eyebrow>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-tight mb-6">
              The card your customer<br/>
              <span style={{ color: C.terracotta }}>actually keeps.</span>
            </h2>
            <p className="text-lg leading-relaxed mb-6" style={{ color: C.inkMute }}>
              Logo, promo banner, greeting, points balance, stamp progress, working barcode — all
              rendered live from your business data. Every element is fully customizable from the
              Card Designer in your dashboard.
            </p>
            <div className="space-y-3">
              {[
                { color: C.sage,     text: 'Customer name + birthday auto-personalized' },
                { color: C.lavender, text: 'Banner image — upload yours or use a template' },
                { color: C.coral,    text: 'Tier badge + reward progress live-updating' },
                { color: C.sky,      text: 'Working scan barcode for staff at the counter' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: C.inkSoft }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The premium showcase card — pure visual showcase, mouse-tilted */}
          <div className="flex justify-center items-center">
            <ShowcaseCard />
          </div>
        </div>
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section id="how" className="py-20 lg:py-28" style={{ background: 'white' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Eyebrow color={C.sage} bg={C.meadow}>How it works</Eyebrow>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-tight">
              Up and running <span style={{ color: C.sage }}>in one afternoon.</span>
            </h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connecting dotted line on desktop */}
            <div aria-hidden="true" className="hidden md:block absolute left-0 right-0 top-12 h-0.5"
                 style={{
                   background: `repeating-linear-gradient(90deg, ${C.hairline} 0 8px, transparent 8px 16px)`,
                   marginLeft: '16.66%', marginRight: '16.66%',
                 }} />
            {[
              { n: 1, title: 'Set up in 5 min', body: 'Add your business, upload a logo, set your reward — "10 visits = 1 free coffee".', color: C.terracotta, bg: C.shellPink, icon: Settings2 },
              { n: 2, title: 'Customers join', body: 'They scan the QR at your counter, get a card in their Wallet. No app downloads.', color: C.lavender, bg: C.lilac, icon: ScanLine },
              { n: 3, title: 'Watch retention rise', body: 'Live dashboard shows who\'s coming back. Auto-campaigns nudge dormant customers.', color: C.sage, bg: C.meadow, icon: TrendingUp },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: step.n * 0.1 }}
                  className="relative bg-white rounded-3xl p-7 border-2 z-10"
                  style={{ borderColor: step.bg }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-['Cormorant_Garamond'] text-2xl font-bold"
                         style={{ background: `linear-gradient(135deg, ${step.color} 0%, ${C.rose} 100%)` }}>
                      {step.n}
                    </div>
                    <Icon size={22} style={{ color: step.color }} />
                  </div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: C.inkDeep }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.inkMute }}>{step.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── TESTIMONIALS ───────────── */}
      <section className="relative py-20 lg:py-28 overflow-hidden"
               style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.butter} 50%, ${C.shellPink})` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Eyebrow color={C.ochre} bg={C.butter}>Loved by local businesses</Eyebrow>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-tight">
              From café owners to <span style={{ color: C.ochre }}>salon directors.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: '"We brought back 47 dormant customers in the first 3 weeks. Our coffee mornings are full again."',
                name: 'Marie Dubois',
                role: 'Owner, Café Lumière',
                location: 'Tours · 2 branches',
                color: C.terracotta, bg: C.shellPink,
              },
              {
                quote: '"The AI told me my Tuesday lunch crowd was at risk. I sent one campaign. Tuesdays are back to full.”',
                name: 'Antoine Leroy',
                role: 'Manager, Le Bistrot',
                location: 'Lyon · 1 branch',
                color: C.lavender, bg: C.lilac,
              },
              {
                quote: '"My customers love the wallet card. They show it off. I love the analytics — I finally know which day to staff up."',
                name: 'Sophie Martin',
                role: 'Director, Studio Lili',
                location: 'Paris · 3 branches',
                color: C.sage, bg: C.meadow,
              },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-3xl p-7 shadow-lg border relative overflow-hidden"
                style={{ borderColor: C.hairline }}
              >
                <div aria-hidden="true" className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-50" style={{ background: t.bg }} />
                <div className="relative">
                  {/* 5 stars */}
                  <div className="flex gap-0.5 mb-4">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={16} fill={C.ochre} stroke={C.ochre} />
                    ))}
                  </div>
                  <p className="text-base leading-relaxed mb-6" style={{ color: C.inkSoft }}>{t.quote}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                         style={{ background: `linear-gradient(135deg, ${t.color} 0%, ${C.rose} 100%)` }}>
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: C.inkDeep }}>{t.name}</p>
                      <p className="text-xs" style={{ color: C.inkMute }}>{t.role}</p>
                      <p className="text-xs" style={{ color: C.inkFaint }}>{t.location}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── PRICING ───────────── */}
      <section id="pricing" className="relative py-20 lg:py-28 overflow-hidden">
        <motion.div aria-hidden="true" className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-30 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.azure} 0%, transparent 70%)` }} />
        <motion.div aria-hidden="true" className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-30 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${C.lilac} 0%, transparent 70%)` }} />
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Eyebrow color={C.sage} bg={C.meadow}>Plans</Eyebrow>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold leading-tight mb-4">
              One price, no surprises.
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: C.inkMute }}>
              Cancel anytime. No setup fees. 30-day free trial on every plan.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Basic', price: 29, badge: 'Starter', themeBg: C.azure, themeAccent: C.sky, features: ['Up to 500 customers', '2 campaigns/mo', 'Wallet passes', 'Core analytics'], cta: 'Start free', dark: false },
              { name: 'Gold',  price: 79, badge: '⭐ Optimal', highlight: true, themeAccent: C.ochre, features: ['Up to 2,000 customers', '10 campaigns/mo', 'Card Designer', 'AI Assistant 20/day', 'Lifetime DB'], cta: 'Deploy Gold', dark: true },
              { name: 'VIP',   price: 199, badge: 'Premium', themeBg: C.lilac, themeAccent: C.lavender, features: ['Up to 10,000 customers', '100 campaigns/mo', 'Geofence push', 'AI Assistant 35/day', 'CSV exports'], cta: 'Upgrade to VIP', dark: false },
            ].map((tier) => {
              if (tier.dark) {
                return (
                  <div key={tier.name} className="text-white p-10 rounded-3xl shadow-2xl relative transform lg:-translate-y-4 flex flex-col overflow-hidden"
                       style={{ background: `linear-gradient(155deg, ${C.inkDeep} 0%, ${C.inkSoft} 50%, ${C.inkDeep} 100%)` }}>
                    <div aria-hidden="true" className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-40" style={{ background: C.ochre }} />
                    <div aria-hidden="true" className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: C.terracotta }} />
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-sm font-bold px-5 py-1.5 rounded-full shadow-lg"
                         style={{ background: `linear-gradient(135deg, ${C.terracotta}, ${C.ochre})` }}>
                      {tier.badge}
                    </div>
                    <h3 className="text-xl font-bold mb-2 pt-2 relative">{tier.name} Standard</h3>
                    <p className="text-5xl font-bold mb-6 relative">
                      <span className="bg-clip-text text-transparent"
                            style={{ backgroundImage: `linear-gradient(135deg, #FFD7A8, ${C.ochre})` }}>
                        €{tier.price}
                      </span>
                      <span className="text-base text-white/60 font-medium">/mo</span>
                    </p>
                    <ul className="mb-8 space-y-3 flex-1 text-white/80 text-sm relative">
                      {tier.features.map((f, i) => (
                        <li key={i} className="flex gap-2"><Check size={16} style={{ color: C.ochre }} /> {f}</li>
                      ))}
                    </ul>
                    <Link to="/register"
                          className="relative block text-center w-full text-white font-semibold px-6 py-4 rounded-xl shadow-lg hover:-translate-y-0.5 transition-all"
                          style={{ background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)` }}>
                      {tier.cta}
                    </Link>
                  </div>
                );
              }
              return (
                <div key={tier.name} className="bg-white p-10 rounded-3xl border-2 shadow-sm flex flex-col relative overflow-hidden hover:-translate-y-1 transition-transform"
                     style={{ borderColor: tier.themeBg }}>
                  <div aria-hidden="true" className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-60"
                       style={{ background: tier.themeBg }} />
                  <span className="inline-block self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 relative"
                        style={{ background: tier.themeBg, color: tier.themeAccent }}>
                    {tier.badge}
                  </span>
                  <h3 className="text-xl font-bold mb-2 relative">{tier.name} Protocol</h3>
                  <p className="text-5xl font-bold mb-6 relative" style={{ color: tier.themeAccent }}>
                    €{tier.price}<span className="text-base font-medium" style={{ color: C.inkMute }}>/mo</span>
                  </p>
                  <ul className="mb-8 space-y-3 flex-1 text-sm relative" style={{ color: C.inkMute }}>
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex gap-2"><Check size={16} style={{ color: tier.themeAccent }} /> {f}</li>
                    ))}
                  </ul>
                  <Link to="/register"
                        className="relative block text-center w-full font-semibold px-6 py-4 rounded-xl transition-all hover:shadow-md"
                        style={{ background: tier.themeBg, color: tier.themeAccent }}>
                    {tier.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── FINAL CTA ───────────── */}
      <section className="py-16 lg:py-24 max-w-5xl mx-auto px-4">
        <div className="rounded-3xl p-[2px] shadow-xl"
             style={{ background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 25%, ${C.lavender} 50%, ${C.sky} 75%, ${C.teal} 100%)` }}>
          <div className="rounded-[22px] overflow-hidden p-10 md:p-16 text-center"
               style={{ background: `linear-gradient(135deg, ${C.inkDeep} 0%, ${C.inkSoft} 50%, #2A1C2E 100%)` }}>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-6xl text-white font-bold leading-tight mb-6">
              Stop losing customers <br/>
              <span className="bg-clip-text text-transparent inline-block"
                    style={{ backgroundImage: `linear-gradient(110deg, ${C.terracotta}, ${C.ochre}, ${C.rose}, ${C.lavender}, ${C.sky})`, backgroundSize: '200% auto', animation: 'heroGradient 6s linear infinite' }}>
                you don't even know are gone.
              </span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: '#D4C8B5' }}>
              30-day free trial. No card required. Setup help included.
              Cancel anytime — keep your data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register"
                    className="inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-full text-base font-semibold transition-all shadow-2xl hover:-translate-y-0.5"
                    style={{ background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)` }}>
                Start your 30-day trial <ArrowRight size={18} />
              </Link>
              <a href="mailto:contact@fidelitour.fr"
                 className="inline-flex items-center justify-center px-8 py-4 rounded-full text-base font-semibold border transition-all hover:bg-white/10"
                 style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white' }}>
                Talk to a human
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── FOOTER ───────────── */}
      <footer className="relative bg-white border-t py-14" style={{ borderColor: C.hairline }}>
        <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-1"
             style={{ background: `linear-gradient(90deg, ${C.terracotta} 0%, ${C.rose} 16%, ${C.lavender} 33%, ${C.sky} 50%, ${C.teal} 66%, ${C.sage} 83%, ${C.ochre} 100%)` }} />
        <div className="max-w-7xl mx-auto px-4 text-center" style={{ color: C.inkMute }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                 style={{ background: `linear-gradient(135deg, ${C.terracotta} 0%, ${C.rose} 100%)` }}>
              F
            </div>
            <p className="font-['Cormorant_Garamond'] text-2xl font-bold" style={{ color: C.terracotta }}>FidéliTour</p>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} FidéliTour Platforms · Architected for local excellence.</p>
          <div className="flex justify-center gap-2 mt-6">
            {[C.terracotta, C.rose, C.lavender, C.sky, C.teal, C.sage, C.ochre].map((c, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
