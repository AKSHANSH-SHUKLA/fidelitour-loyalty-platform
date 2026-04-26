import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, BrainCircuit, ScanLine, Smartphone, Settings2, BarChart3 } from 'lucide-react';
import { AuchanPreview, DEFAULT_LAYOUT } from '../components/AuchanCard';


// =====================================================================
//  Color palette — vibrant but warm + elegant.
//  Each "theme" pairs a soft pastel background with a saturated accent
//  for the icon. Used by FeatureCard and elsewhere for variety.
// =====================================================================
const THEME = {
  terracotta: { bg: '#FBE5DD', icon: '#B85C38', glow: 'rgba(184,92,56,0.20)' },
  ochre:      { bg: '#FDF1DC', icon: '#D4A574', glow: 'rgba(212,165,116,0.25)' },
  sage:       { bg: '#E5F0DC', icon: '#7FA37C', glow: 'rgba(127,163,124,0.25)' },
  teal:       { bg: '#DDF1ED', icon: '#6FA89C', glow: 'rgba(111,168,156,0.25)' },
  sky:        { bg: '#DDEBF6', icon: '#6BA4D9', glow: 'rgba(107,164,217,0.25)' },
  lavender:   { bg: '#F0EBF8', icon: '#8B7DC9', glow: 'rgba(139,125,201,0.25)' },
  coral:      { bg: '#FCE3DC', icon: '#F08C7A', glow: 'rgba(240,140,122,0.25)' },
  rose:       { bg: '#FBE0E8', icon: '#D77FA0', glow: 'rgba(215,127,160,0.25)' },
};

const FeatureCard = ({ icon: Icon, title, description, theme = 'terracotta' }) => {
  const t = THEME[theme] || THEME.terracotta;
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="bg-white p-8 rounded-2xl border border-[#EFE9E0] transition-all relative overflow-hidden group"
      style={{ boxShadow: `0 4px 14px rgba(28,25,23,0.04)` }}
    >
      {/* Soft color wash behind the card on hover */}
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"
        style={{ background: t.glow }}
      />
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3"
        style={{ backgroundColor: t.bg }}
      >
        <Icon className="w-7 h-7" style={{ color: t.icon }} />
      </div>
      <h3 className="text-2xl font-['Cormorant_Garamond'] font-bold mb-3 relative">{title}</h3>
      <p className="text-[#57534E] leading-relaxed relative">{description}</p>
    </motion.div>
  );
};

const DemoCard = ({ title, description, children }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-2xl shadow-sm border border-[#E7E5E4] hover:shadow-lg transition-all"
  >
    <h3 className="text-2xl font-['Cormorant_Garamond'] font-bold mb-4">{title}</h3>
    <div className="bg-[#F3EFE7] rounded-xl p-8 mb-6 min-h-64 flex items-center justify-center">
      {children}
    </div>
    <p className="text-[#57534E] leading-relaxed">{description}</p>
  </motion.div>
);

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#FDFBF7] font-['Manrope'] text-[#1C1917]">
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-[#EFE9E0] z-50">
        {/* Tiny multi-color accent line at the very top of the nav */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, #B85C38 0%, #D77FA0 25%, #8B7DC9 50%, #6BA4D9 75%, #6FA89C 100%)',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md"
              style={{ background: 'linear-gradient(135deg, #B85C38 0%, #D77FA0 100%)' }}
            >
              F
            </div>
            <span
              className="font-['Cormorant_Garamond'] text-2xl font-bold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #B85C38 0%, #D77FA0 100%)' }}
            >
              FidéliTour
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 font-medium">
            <a href="#intro" className="hover:text-[#B85C38] transition-colors">Philosophy</a>
            <a href="#features" className="hover:text-[#B85C38] transition-colors">Capabilities</a>
            <a href="#demo" className="hover:text-[#B85C38] transition-colors">Live Simulation</a>
            <a href="#pricing" className="hover:text-[#B85C38] transition-colors">Plans</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="font-medium hover:text-[#B85C38] transition-colors">Sign in</Link>
            <Link
              to="/register"
              className="text-white px-6 py-2 rounded-full transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #1C1917 0%, #3D2820 100%)' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION — colorful ambient orbs in the background, gradient text accent */}
      <section id="intro" className="relative pt-40 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated multi-color ambient orbs */}
        <motion.div
          aria-hidden="true"
          className="absolute -top-20 -left-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #FCE3DC 0%, transparent 70%)' }}
          animate={{ x: [0, 60, -30, 0], y: [0, -40, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute top-20 -right-24 w-[460px] h-[460px] rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #DDEBF6 0%, transparent 70%)' }}
          animate={{ x: [0, -50, 20, 0], y: [0, 40, -20, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute top-1/2 left-1/3 w-[420px] h-[420px] rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #F0EBF8 0%, transparent 70%)' }}
          animate={{ x: [0, 30, -50, 0], y: [0, 20, -30, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute bottom-0 right-1/3 w-[380px] h-[380px] rounded-full blur-3xl opacity-35 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #E5F0DC 0%, transparent 70%)' }}
          animate={{ x: [0, -30, 40, 0], y: [0, 30, -10, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        />

        <div className="relative max-w-7xl mx-auto flex flex-col items-center text-center">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[#E7E5E4] shadow-sm mb-8"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7FA37C] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7FA37C]" />
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-[#57534E]">
              <span className="text-[#B85C38]">New</span> · Customer reviews + AI insights live
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl space-y-8"
          >
            <h1 className="font-['Cormorant_Garamond'] text-6xl md:text-8xl font-bold leading-[1.1] tracking-tight">
              Stop giving away paper punch cards. <br/>
              <span
                className="bg-clip-text text-transparent inline-block"
                style={{
                  backgroundImage: 'linear-gradient(110deg, #B85C38 0%, #E3A869 30%, #D77FA0 55%, #8B7DC9 80%, #6BA4D9 100%)',
                  backgroundSize: '200% auto',
                  animation: 'heroGradient 8s linear infinite',
                }}
              >
                Start building loyalty.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-[#57534E] max-w-2xl mx-auto leading-relaxed">
              A meticulously crafted B2B2C retention platform for local businesses. Digital wallet
              passes, AI insights, and real-time geolocalisation marketing.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
              <Link
                to="/register"
                className="text-white px-8 py-4 rounded-full text-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #B85C38 0%, #D77FA0 100%)',
                  boxShadow: '0 10px 30px rgba(184,92,56,0.35)',
                }}
              >
                Deploy Your System
              </Link>
              <a href="#demo" className="bg-white/90 backdrop-blur-sm border border-[#E7E5E4] text-[#1C1917] px-8 py-4 rounded-full text-lg hover:bg-white transition-all shadow-sm font-semibold">
                Try the Interactive Demo
              </a>
            </div>

            {/* Trust strip — 4 colorful proof chips */}
            <div className="flex flex-wrap justify-center items-center gap-3 pt-12 text-xs">
              {[
                { color: '#7FA37C', bg: '#E5F0DC', label: '25+ live KPIs' },
                { color: '#6BA4D9', bg: '#DDEBF6', label: '12 customer segments' },
                { color: '#8B7DC9', bg: '#F0EBF8', label: 'Sentiment analysis' },
                { color: '#F08C7A', bg: '#FCE3DC', label: 'Real-time geofencing' },
                { color: '#D4A574', bg: '#FDF1DC', label: 'Multi-branch support' },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold border"
                  style={{ backgroundColor: chip.bg, color: chip.color, borderColor: chip.color + '40' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chip.color }} />
                  {chip.label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        <style>{`
          @keyframes heroGradient {
            to { background-position: 200% center; }
          }
        `}</style>
      </section>

      {/* COMPREHENSIVE FEATURES GRID — each card in its own color theme */}
      <section id="features" className="relative py-24 bg-white border-y border-[#EFE9E0] overflow-hidden">
        {/* Subtle multi-color wash at the top edge */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: 'linear-gradient(90deg, #B85C38 0%, #D77FA0 20%, #8B7DC9 40%, #6BA4D9 60%, #6FA89C 80%, #88B27E 100%)',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                  style={{ backgroundColor: '#FDF1DC', color: '#9C7223' }}>
              Capabilities
            </span>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold mb-6">
              Unrivaled Retention Architecture
            </h2>
            <p className="text-lg text-[#57534E]">
              We engineered FidéliTour not just to track points, but to actively pull customers
              back into your storefront using advanced data telemetry.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              theme="sky"
              icon={Smartphone}
              title="Native Wallet Integration"
              description="Customers save their pass directly to Apple Wallet or Google Pay. Nobody wants another app. We live where their credit cards live."
            />
            <FeatureCard
              theme="lavender"
              icon={Settings2}
              title="Tier-Specific Card Designs"
              description="Bronze, Silver, and Gold each with their own distinct visual look. Upload your logo, select typography, and switch between card styles in seconds."
            />
            <FeatureCard
              theme="sage"
              icon={MapPin}
              title="Know Your Neighborhoods"
              description="Track where customers come from: Instagram, TikTok, QR in store, and more. Know which neighborhoods need focus with the Tours map."
            />
            <FeatureCard
              theme="coral"
              icon={ScanLine}
              title="Automatic Points & Stamps"
              description="Automatic points when they pay—just type the amount. Customers collect stamps and earn free rewards. You configure how many visits fill one stamp."
            />
            <FeatureCard
              theme="ochre"
              icon={BrainCircuit}
              title="Neural Marketing Assistant"
              description="Ask our built-in AI complex questions like 'Who are my inactive Bronze tier members?' and let it automatically generate marketing campaigns to win them back."
            />
            <FeatureCard
              theme="terracotta"
              icon={BarChart3}
              title="Enterprise Grade Analytics"
              description="Beautiful, interaction-heavy Recharts displaying cohort retention, active vs inactive member flows, and lifetime value segmented by custom time windows."
            />
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO - Card Design Mockups */}
      <section
        id="demo"
        className="relative py-24 overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #FDFBF7 0%, #FCE3DC 25%, #F0EBF8 50%, #DDEBF6 75%, #E5F0DC 100%)',
        }}
      >
        {/* Decorative blur orbs to give the section depth */}
        <motion.div
          aria-hidden="true"
          className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #D77FA0 0%, transparent 70%)' }}
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute bottom-1/4 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8B7DC9 0%, transparent 70%)' }}
          animate={{ x: [0, -50, 0], y: [0, 30, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold mb-6">How Your Customers Will See Their Loyalty Card</h2>
            <p className="text-lg text-[#57534E]">
              This is how the digital pass appears in customers' Apple Wallet and Google Wallet. A frictionless, native experience that keeps your business just a tap away.
            </p>
          </div>

          {/* iPhone Mockup with the REAL production card — large, CaptainWallet-style */}
          <div className="flex justify-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="relative"
              style={{ filter: 'drop-shadow(0 30px 60px rgba(28,25,23,0.35)) drop-shadow(0 10px 30px rgba(184,92,56,0.15))' }}
            >
              {/* iPhone shell — generous size to host a real ~440px card */}
              <div
                className="relative bg-[#0A0A0A] rounded-[56px] p-3"
                style={{ width: 480 }}
              >
                {/* Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#0A0A0A] rounded-b-2xl z-10" />

                {/* Screen — warmer, multi-color gradient instead of solid black */}
                <div
                  className="relative rounded-[44px] overflow-hidden"
                  style={{
                    minHeight: 880,
                    background: 'linear-gradient(155deg, #2C2520 0%, #4A2D3D 35%, #3A2D5A 65%, #1C2A3D 100%)',
                  }}
                >
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-8 pt-5 pb-3 text-white text-sm font-semibold">
                    <span>9:41</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs">5G</span>
                      <span>●●●●</span>
                      <span>🔋</span>
                    </span>
                  </div>

                  {/* Multiple colored ambient glows behind the card */}
                  <div
                    aria-hidden="true"
                    className="absolute left-1/4 top-1/4 w-[280px] h-[280px] rounded-full opacity-50 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #D77FA0 0%, transparent 70%)' }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute right-1/4 bottom-1/3 w-[280px] h-[280px] rounded-full opacity-40 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #6BA4D9 0%, transparent 70%)' }}
                  />

                  {/* The actual production loyalty card */}
                  <div className="relative flex justify-center pt-6 pb-10">
                    <AuchanPreview
                      layout={DEFAULT_LAYOUT}
                      ctx={{
                        first_name: 'Sophie',
                        name: 'Sophie Dupont',
                        points: '12.40',
                        business_name: 'Café Lumière',
                        birthday: '12 Mai',
                        stamps_earned: 7,
                        stamps_target: 10,
                      }}
                      width={440}
                    />
                  </div>

                  {/* Footer hint inside the phone */}
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                    <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                      <p className="text-xs text-white/70 tracking-wider uppercase">Apple Wallet · Google Wallet</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating proof labels — each in its own color for visual richness */}
              <motion.div
                aria-hidden="true"
                className="absolute -left-20 top-32 hidden lg:flex items-center gap-2 px-4 py-2 rounded-full shadow-xl border"
                style={{ backgroundColor: '#E5F0DC', borderColor: '#7FA37C', color: '#3D5A36' }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#7FA37C' }} />
                <span className="text-sm font-semibold">Live updates</span>
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="absolute -right-24 top-64 hidden lg:flex items-center gap-2 px-4 py-2 rounded-full shadow-xl border"
                style={{ backgroundColor: '#FBE0E8', borderColor: '#D77FA0', color: '#8A4566' }}
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              >
                <span className="text-base">🎂</span>
                <span className="text-sm font-semibold">Birthday offer queued</span>
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="absolute -left-16 bottom-40 hidden lg:flex items-center gap-2 px-4 py-2 rounded-full shadow-xl border"
                style={{ backgroundColor: '#F0EBF8', borderColor: '#8B7DC9', color: '#56488C' }}
                animate={{ x: [0, 6, 0], y: [0, -4, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8B7DC9' }} />
                <span className="text-sm font-semibold">VIP unlocked</span>
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="absolute -right-12 bottom-56 hidden lg:flex items-center gap-2 px-4 py-2 rounded-full shadow-xl border"
                style={{ backgroundColor: '#DDEBF6', borderColor: '#6BA4D9', color: '#3A6892' }}
                animate={{ y: [0, -6, 0], x: [0, -4, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1.8 }}
              >
                <span className="text-sm font-semibold">+1 stamp added</span>
              </motion.div>
            </motion.div>
          </div>

          {/* Caption row — explains what the customer sees, no marketing fluff */}
          <div className="max-w-3xl mx-auto mb-20 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-[#B85C38] font-bold mb-3">
              The exact card your customers see
            </p>
            <p className="text-lg text-[#57534E] leading-relaxed">
              Logo, promo banner, greeting, points balance, stamp progress, and a working barcode —
              all rendered live from your business data. Every element is fully customisable from the
              Card Designer in your dashboard.
            </p>
          </div>

          {/* Demo Dashboard Section */}
          <div className="mb-16">
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold text-center mb-16">See Your Dashboard in Action</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Analytics Dashboard Demo */}
              <DemoCard
                title="Analytics Dashboard"
                description="Real-time insights into customer engagement, lifetime value trends, and retention metrics at a glance."
              >
                <div className="w-full space-y-3">
                  {/* Bar chart mockup */}
                  <div className="flex items-end justify-center gap-2 h-32">
                    <div className="w-6 bg-[#B85C38]/40 rounded-t" style={{ height: '60%' }}></div>
                    <div className="w-6 bg-[#B85C38]/60 rounded-t" style={{ height: '75%' }}></div>
                    <div className="w-6 bg-[#B85C38]/80 rounded-t" style={{ height: '90%' }}></div>
                    <div className="w-6 bg-[#B85C38] rounded-t" style={{ height: '100%' }}></div>
                    <div className="w-6 bg-[#4A5D23]/40 rounded-t" style={{ height: '65%' }}></div>
                  </div>
                  <div className="flex justify-center gap-1 text-xs text-[#57534E]">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                  </div>
                  <div className="pt-3 border-t border-[#E7E5E4]">
                    <p className="text-sm font-bold text-[#1C1917]">€4,250</p>
                    <p className="text-xs text-[#57534E]">↑ 12% revenue</p>
                  </div>
                </div>
              </DemoCard>

              {/* Campaign Manager Demo */}
              <DemoCard
                title="Campaign Manager"
                description="Design and launch targeted push notifications. Watch engagement rates spike when customers see personalized offers."
              >
                <div className="w-full space-y-2">
                  {/* Push notification mockup */}
                  <div className="bg-white border border-[#E7E5E4] rounded-lg p-3 text-left">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#B85C38] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1C1917]">Your Business</p>
                        <p className="text-xs text-[#57534E] truncate">Come back & earn double points!</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#57534E] bg-[#F3EFE7] rounded px-2 py-1">Now</p>
                  </div>

                  <div className="text-center text-sm py-2">
                    <p className="text-[#57534E] text-xs">2 more campaigns</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7E5E4]">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#B85C38]">47%</p>
                      <p className="text-xs text-[#57534E]">Open Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#4A5D23]">23%</p>
                      <p className="text-xs text-[#57534E]">Click Rate</p>
                    </div>
                  </div>
                </div>
              </DemoCard>

              {/* Geolocalisation Demo */}
              <DemoCard
                title="Geolocalisation Notifications"
                description="When customers are within 50m of your shop, they instantly get a personalized offer. Real-time, automatic, powerful."
              >
                <div className="w-full space-y-3">
                  {/* Phone mockup with notification */}
                  <div className="bg-black rounded-2xl p-2 mx-auto w-32">
                    <div className="bg-[#FDFBF7] rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-[#1C1917] mb-2">9:42</p>
                      <div className="bg-[#B85C38] rounded-lg p-2 mb-2">
                        <p className="text-white text-xs font-bold">📍 Nearby</p>
                        <p className="text-white text-xs">Come in now!</p>
                        <p className="text-white/90 text-xs">+5 bonus</p>
                      </div>
                      <p className="text-xs text-[#57534E]">Tap</p>
                    </div>
                  </div>

                  <div className="text-center text-sm">
                    <p className="text-[#57534E] text-xs">50m geofence</p>
                    <p className="text-[#B85C38] text-xs font-bold">312 nearby</p>
                  </div>
                </div>
              </DemoCard>

              {/* Multi-Branch Dashboard Demo */}
              <DemoCard
                title="Multi-Branch Dashboard"
                description="Multi-location owners see everything in one place. Know which neighborhood needs more attention with the Tours map."
              >
                <div className="w-full space-y-3">
                  {/* Branch KPI rows */}
                  <div className="space-y-2">
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-2">
                      <p className="text-xs font-bold text-[#1C1917] mb-1">Downtown</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1"><span className="text-[#B85C38] font-bold">542</span> customers</span>
                        <span className="flex-1"><span className="text-[#4A5D23] font-bold">€1,250</span> rev</span>
                      </div>
                    </div>
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-2">
                      <p className="text-xs font-bold text-[#1C1917] mb-1">Riverside</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1"><span className="text-[#B85C38] font-bold">387</span> customers</span>
                        <span className="flex-1"><span className="text-[#4A5D23] font-bold">€890</span> rev</span>
                      </div>
                    </div>
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-2">
                      <p className="text-xs font-bold text-[#1C1917] mb-1">Westend</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1"><span className="text-[#B85C38] font-bold">264</span> customers</span>
                        <span className="flex-1"><span className="text-[#4A5D23] font-bold">€620</span> rev</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#E7E5E4]">
                    <p className="text-xs font-bold text-[#1C1917] mb-2">Your Tours Map</p>
                    <svg viewBox="0 0 120 80" className="w-full h-16">
                      <rect x="5" y="5" width="110" height="70" fill="#F3EFE7" stroke="#E7E5E4" strokeWidth="1" rx="2" />
                      <circle cx="30" cy="25" r="3" fill="#B85C38" />
                      <circle cx="70" cy="40" r="3" fill="#B85C38" />
                      <circle cx="50" cy="60" r="3" fill="#4A5D23" />
                      <circle cx="85" cy="55" r="3" fill="#B85C38" />
                      <text x="35" y="35" fontSize="8" fill="#57534E" fontWeight="bold">12</text>
                      <text x="55" y="50" fontSize="8" fill="#57534E" fontWeight="bold">8</text>
                      <text x="75" y="70" fontSize="8" fill="#57534E" fontWeight="bold">5</text>
                    </svg>
                  </div>
                </div>
              </DemoCard>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING — each tier in its own color identity */}
      <section id="pricing" className="relative py-24 overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #DDEBF6 0%, transparent 70%)' }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #F0EBF8 0%, transparent 70%)' }}
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />

        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                  style={{ backgroundColor: '#E5F0DC', color: '#4A6B41' }}>
              Plans
            </span>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold mb-4">
              Transparent Software Pricing
            </h2>
            <p className="text-center text-[#57534E] max-w-2xl mx-auto text-lg">
              No hidden implementation fees. Predictable SaaS scaling designed for independently
              owned operators up to regional chains.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Basic — Sky theme */}
            <div className="bg-white p-10 rounded-3xl border-2 shadow-sm flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-transform"
                 style={{ borderColor: '#DDEBF6' }}>
              <div aria-hidden="true" className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-60"
                   style={{ background: 'radial-gradient(circle, #DDEBF6 0%, transparent 70%)' }} />
              <span className="inline-block self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 relative"
                    style={{ backgroundColor: '#DDEBF6', color: '#3A6892' }}>
                Basic
              </span>
              <h3 className="text-2xl font-bold mb-2 relative">Basic Protocol</h3>
              <p className="text-4xl font-bold mb-6 relative" style={{ color: '#3A6892' }}>
                €29<span className="text-lg text-[#57534E] font-medium">/mo</span>
              </p>
              <ul className="mb-8 space-y-3 flex-1 text-[#57534E] relative">
                <li className="flex gap-2"><span style={{ color: '#6BA4D9' }}>✓</span> Up to 500 Managed Customers</li>
                <li className="flex gap-2"><span style={{ color: '#6BA4D9' }}>✓</span> 2 Marketing Campaigns / mo</li>
                <li className="flex gap-2"><span style={{ color: '#6BA4D9' }}>✓</span> Native Digital Wallet Passes</li>
                <li className="flex gap-2"><span style={{ color: '#6BA4D9' }}>✓</span> Core Dashboard Analytics</li>
              </ul>
              <Link to="/register" className="relative block text-center w-full font-semibold px-6 py-4 rounded-xl transition-all hover:shadow-md"
                    style={{ backgroundColor: '#DDEBF6', color: '#3A6892' }}>
                Get Started
              </Link>
            </div>

            {/* Gold — featured tier with rich gradient */}
            <div className="text-white p-10 rounded-3xl shadow-2xl relative transform lg:-translate-y-4 flex flex-col overflow-hidden"
                 style={{
                   background: 'linear-gradient(155deg, #2C2520 0%, #4A2D1A 50%, #1C1917 100%)',
                 }}>
              <div aria-hidden="true" className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-40"
                   style={{ background: 'radial-gradient(circle, #E3A869 0%, transparent 70%)' }} />
              <div aria-hidden="true" className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-30"
                   style={{ background: 'radial-gradient(circle, #B85C38 0%, transparent 70%)' }} />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-sm font-bold px-6 py-2 rounded-full shadow-lg"
                   style={{ background: 'linear-gradient(135deg, #B85C38 0%, #E3A869 100%)' }}>
                ⭐ OPTIMAL FOR MOST
              </div>
              <span className="inline-block self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mt-2 mb-4 relative"
                    style={{ backgroundColor: 'rgba(227,168,105,0.20)', color: '#E3A869', border: '1px solid rgba(227,168,105,0.4)' }}>
                Gold
              </span>
              <h3 className="text-2xl font-bold mb-2 relative">Gold Standard</h3>
              <p className="text-4xl font-bold mb-6 relative">
                <span className="bg-clip-text text-transparent"
                      style={{ backgroundImage: 'linear-gradient(135deg, #FFD7A8 0%, #E3A869 100%)' }}>
                  €79
                </span>
                <span className="text-lg text-white/70 font-medium">/mo</span>
              </p>
              <ul className="mb-8 space-y-3 flex-1 text-white/80 relative">
                <li className="flex gap-2"><span style={{ color: '#E3A869' }}>✓</span> Up to 2,000 Managed Customers</li>
                <li className="flex gap-2"><span style={{ color: '#E3A869' }}>✓</span> 10 Marketing Campaigns / mo</li>
                <li className="flex gap-2"><span style={{ color: '#E3A869' }}>✓</span> Complete Visual Card Designer</li>
                <li className="flex gap-2"><span style={{ color: '#E3A869' }}>✓</span> AI Assistant (20 queries/day)</li>
                <li className="flex gap-2"><span style={{ color: '#E3A869' }}>✓</span> Advanced Revenue & Lifetime DB</li>
              </ul>
              <Link to="/register" className="relative block text-center w-full text-white font-semibold px-6 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #B85C38 0%, #D77FA0 100%)' }}>
                Deploy Gold Standard
              </Link>
            </div>

            {/* VIP — Lavender theme */}
            <div className="bg-white p-10 rounded-3xl border-2 shadow-sm flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-transform"
                 style={{ borderColor: '#F0EBF8' }}>
              <div aria-hidden="true" className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-60"
                   style={{ background: 'radial-gradient(circle, #F0EBF8 0%, transparent 70%)' }} />
              <span className="inline-block self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 relative"
                    style={{ backgroundColor: '#F0EBF8', color: '#56488C' }}>
                VIP
              </span>
              <h3 className="text-2xl font-bold mb-2 relative">VIP Matrix</h3>
              <p className="text-4xl font-bold mb-6 relative" style={{ color: '#56488C' }}>
                €199<span className="text-lg text-[#57534E] font-medium">/mo</span>
              </p>
              <ul className="mb-8 space-y-3 flex-1 text-[#57534E] relative">
                <li className="flex gap-2"><span style={{ color: '#8B7DC9' }}>✓</span> Up to 10,000 Managed Customers</li>
                <li className="flex gap-2"><span style={{ color: '#8B7DC9' }}>✓</span> 100 Marketing Campaigns / mo</li>
                <li className="flex gap-2"><span style={{ color: '#8B7DC9' }}>✓</span> Geofence Radius Push Notifications</li>
                <li className="flex gap-2"><span style={{ color: '#8B7DC9' }}>✓</span> AI Assistant (35 queries/day)</li>
                <li className="flex gap-2"><span style={{ color: '#8B7DC9' }}>✓</span> Raw Database CSV Extraction</li>
              </ul>
              <Link to="/register" className="relative block text-center w-full font-semibold px-6 py-4 rounded-xl transition-all hover:shadow-md"
                    style={{ backgroundColor: '#F0EBF8', color: '#56488C' }}>
                Upgrade to VIP
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MULTI-STORE CTA — kept dramatic but with multi-color accents */}
      <section id="multi-store" className="max-w-5xl mx-auto px-4 pb-20">
        {/* Animated gradient border via padding trick */}
        <div
          className="rounded-3xl p-[2px] shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #B85C38 0%, #D77FA0 25%, #8B7DC9 50%, #6BA4D9 75%, #6FA89C 100%)',
          }}
        >
        <div
          className="rounded-[22px] overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1C1917 0%, #3B2418 50%, #2A1C2E 100%)' }}
        >
          <div className="p-10 md:p-14 text-center">
            <div className="inline-block mb-4 px-4 py-1 rounded-full bg-[#D4A574]/20 text-[#D4A574] text-xs uppercase tracking-widest font-semibold">
              For Multi-Location Businesses
            </div>
            <h2 className="font-['Cormorant_Garamond'] text-3xl md:text-5xl text-white font-bold mb-4">
              Got multiple stores? Let's talk.
            </h2>
            <p className="text-[#D4A574] text-base md:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              If you run several locations and want one loyalty platform for all of them — unified
              customers, shared tiers, consolidated analytics, and per-branch reports — we'll set
              everything up for you, migrate your existing data, and train your staff.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto text-left">
              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'rgba(107,164,217,0.08)', borderColor: 'rgba(107,164,217,0.30)' }}>
                <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6BA4D9' }} />
                  Unified customer base
                </p>
                <p className="text-[#C4B5A0] text-xs">One customer card works at every store.</p>
              </div>
              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'rgba(127,163,124,0.08)', borderColor: 'rgba(127,163,124,0.30)' }}>
                <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#7FA37C' }} />
                  Per-branch analytics
                </p>
                <p className="text-[#C4B5A0] text-xs">Compare performance across locations.</p>
              </div>
              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'rgba(139,125,201,0.08)', borderColor: 'rgba(139,125,201,0.30)' }}>
                <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8B7DC9' }} />
                  Dedicated onboarding
                </p>
                <p className="text-[#C4B5A0] text-xs">We handle setup & staff training.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href="mailto:contact@fidelitour.fr?subject=Multi-store%20enquiry"
                className="inline-block text-[#1C1917] font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: 'linear-gradient(135deg, #FFD7A8 0%, #D4A574 100%)' }}
              >
                Contact Us
              </a>
              <span className="text-[#8A8575] text-sm">or call <span className="text-white font-semibold">+33 2 47 00 00 00</span></span>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* FOOTER — colorful gradient accent strip on top */}
      <footer className="relative bg-white border-t border-[#EFE9E0] py-14">
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: 'linear-gradient(90deg, #B85C38 0%, #D77FA0 16%, #8B7DC9 33%, #6BA4D9 50%, #6FA89C 66%, #88B27E 83%, #E3A869 100%)',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 text-center text-[#57534E]">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #B85C38 0%, #D77FA0 100%)' }}
            >
              F
            </div>
            <p className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#B85C38]">FidéliTour</p>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} FidéliTour Platforms Inc. Architected for local excellence.</p>
          {/* Tiny colorful divider dots */}
          <div className="flex justify-center gap-2 mt-6">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#B85C38' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#D77FA0' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7DC9' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#6BA4D9' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#6FA89C' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#88B27E' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#E3A869' }} />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
