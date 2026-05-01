import React from 'react';

/**
 * AppleWalletFrame — wraps any loyalty-card preview in a recognisable
 * iPhone + Apple-Wallet shell so what the merchant sees in the designer
 * matches what their customer sees on a real phone.
 *
 * Pure presentational. Just renders its `children` (typically the
 * <AuchanPreview/>) inside the Wallet card slot.
 *
 * Usage:
 *   <AppleWalletFrame width={460}>
 *     <AuchanPreview layout={L} ctx={ctx} width={420} />
 *   </AppleWalletFrame>
 */
const AppleWalletFrame = ({ width = 460, children, time = '9:41' }) => {
  const bezel = 10;
  const innerW = width - bezel * 2;
  return (
    <div
      className="relative mx-auto"
      style={{
        width,
        // dynamic height — let the card decide; min height keeps proportions
        minHeight: width * 1.85,
      }}
    >
      {/* Outer phone bezel */}
      <div
        className="absolute inset-0 rounded-[42px] shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #1A1A1F 0%, #2A2A30 50%, #0E0E12 100%)',
          boxShadow: '0 30px 60px -15px rgba(0,0,0,0.45), 0 10px 25px -5px rgba(0,0,0,0.25), inset 0 0 0 2px #303035',
        }}
      />

      {/* Inner screen */}
      <div
        className="absolute rounded-[32px] overflow-hidden"
        style={{
          top: bezel, left: bezel, right: bezel, bottom: bezel,
          // Apple Wallet always uses a near-black background — that's how
          // every wallet card looks on a real iPhone.
          background: 'linear-gradient(180deg, #0F0F12 0%, #18181C 100%)',
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
          style={{
            width: Math.min(innerW * 0.36, 110),
            height: 22,
            background: '#0E0E12',
            borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
          }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#1A1A1F', boxShadow: '0 0 0 1px #2A2A30' }} />
        </div>

        {/* Status bar */}
        <div className="absolute top-1 left-0 right-0 z-20 flex items-center justify-between px-5 text-[10px] font-bold"
          style={{ color: 'white' }}>
          <span>{time}</span>
          <span className="invisible">·</span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-end gap-[2px]">
              {[3, 5, 7, 9].map((h, i) => (
                <span key={i} className="rounded-sm" style={{ width: 2.5, height: h, background: 'white' }} />
              ))}
            </span>
            <span className="inline-flex items-center">
              <span className="rounded-[3px]" style={{ width: 18, height: 9, border: '1.2px solid white' }}>
                <span className="block rounded-sm" style={{ width: '70%', height: '100%', background: 'white' }} />
              </span>
              <span className="ml-[1px] rounded-r-[1px]" style={{ width: 1.5, height: 4, background: 'white' }} />
            </span>
          </span>
        </div>

        {/* Apple Wallet header — back chevron, "Wallet" title, ⋯ button */}
        <div className="absolute left-0 right-0 z-10 flex items-center justify-between px-4"
          style={{ top: 30, height: 36, color: 'white' }}>
          <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: '#FF9F0A' }}>
            <svg width="11" height="14" viewBox="0 0 11 14" fill="none">
              <path d="M9 1L3 7L9 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cartes
          </span>
          <span className="text-[14px] font-semibold">Wallet</span>
          <span className="text-[18px] leading-none" style={{ color: '#FF9F0A' }}>⋯</span>
        </div>

        {/* "Stacked cards" effect — fake cards peeking above and below the active one,
             so the preview reads like a real Apple Wallet rather than an isolated card. */}
        <FakeStackedCard
          style={{ top: 70, left: 18, right: 18, height: 24, transform: 'scale(0.92)' }}
          gradient="linear-gradient(135deg, #1B1F3A 0%, #3D3567 60%, #6B5B95 100%)"
          label="ID"
        />
        <FakeStackedCard
          style={{ top: 86, left: 14, right: 14, height: 22, transform: 'scale(0.96)' }}
          gradient="linear-gradient(135deg, #DCB46B 0%, #B8924E 100%)"
          label="DISCOVER"
        />
        <FakeStackedCard
          style={{ top: 100, left: 11, right: 11, height: 20 }}
          gradient="linear-gradient(135deg, #1C1917 0%, #2A2A30 100%)"
          label="Apple Cash"
        />

        {/* Card slot — the merchant's real loyalty card, the focus of the preview */}
        <div className="absolute left-0 right-0 flex justify-center px-3 z-10"
          style={{ top: 116, bottom: 88 }}>
          {children}
        </div>

        {/* More fake cards peeking up from the bottom of the wallet */}
        <FakeStackedCard
          style={{ bottom: 72, left: 14, right: 14, height: 26 }}
          gradient="linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)"
          label="Dunkin' · Balance €5"
          flipped
        />
        <FakeStackedCard
          style={{ bottom: 56, left: 18, right: 18, height: 22, transform: 'scale(0.96)' }}
          gradient="linear-gradient(135deg, #2D5F3F 0%, #1F4530 100%)"
          label="Carrefour"
          flipped
        />
        <FakeStackedCard
          style={{ bottom: 42, left: 22, right: 22, height: 18, transform: 'scale(0.92)' }}
          gradient="linear-gradient(135deg, #003D7A 0%, #0066CC 100%)"
          label="Air France"
          flipped
        />

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: '36%', height: 4, background: 'rgba(255,255,255,0.4)' }} />
      </div>
    </div>
  );
};

/* Tiny fake card that peeks above or below the focused loyalty card —
   makes the preview feel like a real Apple Wallet stack, not a standalone card. */
const FakeStackedCard = ({ style = {}, gradient, label, flipped }) => (
  <div
    aria-hidden="true"
    className="absolute rounded-[14px] flex items-center px-3"
    style={{
      background: gradient,
      boxShadow: flipped
        ? '0 -2px 8px rgba(0, 0, 0, 0.25)'
        : '0 2px 8px rgba(0, 0, 0, 0.25)',
      ...style,
    }}
  >
    <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
      {label}
    </span>
  </div>
);

export default AppleWalletFrame;
