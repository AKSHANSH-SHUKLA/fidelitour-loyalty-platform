import React from 'react';
import { Bell, MapPin } from 'lucide-react';

/**
 * PhonePushPreview — renders an iOS-style phone with a single push
 * notification banner. Updates live as `title` / `body` change.
 *
 * Usage: drop next to any push-message editor (campaigns, auto-campaigns,
 * geo proximity) so the owner sees what the customer will see.
 *
 * Props:
 *   businessName   — sender name shown in the notification (small caps line)
 *   title          — bold first line of the message
 *   body           — second line, ~2-line max
 *   primaryColor   — hex (matches the brand colour from the card template)
 *   logoChar       — single letter logo. Defaults to first char of businessName
 *   logoUrl        — optional logo image URL
 *   width          — phone width in px (default 240, set 200 for tighter cards)
 *   variant        — 'lockscreen' (default) | 'geo'  (geo adds a 📍 corner badge)
 *   caption        — optional small label above the phone
 */
const PhonePushPreview = ({
  businessName = 'Votre commerce',
  title = '',
  body = '',
  primaryColor = '#B85C38',
  logoChar,
  logoUrl,
  width = 240,
  variant = 'lockscreen',
  caption,
}) => {
  const initial = (logoChar || (businessName || 'F').charAt(0)).toUpperCase();
  const height = Math.round(width * 1.78);  // 9:16-ish phone aspect

  return (
    <div className="flex flex-col items-center">
      {caption && (
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8D857D' }}>
          {caption}
        </p>
      )}
      {/* Phone body */}
      <div
        className="relative rounded-[36px] p-2"
        style={{
          width,
          height,
          background: 'linear-gradient(180deg, #171412 0%, #2A1C2E 100%)',
          boxShadow: '0 18px 44px rgba(28,25,23,0.32)',
        }}
      >
        {/* Notch */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: width * 0.28, height: 16, background: '#0A0A0A', top: 8 }}
        />
        {/* Screen */}
        <div
          className="w-full h-full rounded-[28px] overflow-hidden flex flex-col items-center pt-10 px-2.5 relative"
          style={{ background: 'linear-gradient(180deg, #2C3E5C 0%, #15233D 100%)' }}
        >
          {/* Status bar */}
          <div className="absolute left-0 right-0 px-5 flex justify-between text-[9px] font-semibold"
               style={{ color: 'rgba(255,255,255,0.85)', top: 6 }}>
            <span>9:41</span>
            <span>📶 🔋</span>
          </div>

          {/* Big clock / date */}
          <div className="text-center mt-3 mb-5">
            <p className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Friday 8 May
            </p>
            <p className="font-bold leading-none mt-1"
               style={{ color: 'white', fontFamily: 'Cormorant Garamond', fontSize: width * 0.21 }}>
              9:41
            </p>
          </div>

          {/* Notification card */}
          <div
            className="w-full rounded-2xl p-2 flex items-start gap-2 transition-all"
            style={{
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
            }}
          >
            {/* Logo */}
            <div
              className="rounded-md flex items-center justify-center font-bold text-white text-[10px] shrink-0 overflow-hidden"
              style={{
                background: variant === 'geo' ? `linear-gradient(135deg, ${primaryColor}, #4A90E2)` : primaryColor,
                width: 22, height: 22,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : variant === 'geo' ? (
                <MapPin size={11} className="text-white" />
              ) : (
                initial
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold leading-tight truncate" style={{ color: '#171412' }}>
                  {businessName}
                </p>
                <p className="text-[8px] shrink-0" style={{ color: '#57504A' }}>now</p>
              </div>
              <p className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: '#171412' }}>
                {title || (variant === 'geo' ? '📍 You\'re just nearby!' : 'Notification title')}
              </p>
              <p className="text-[9px] mt-0.5 leading-snug" style={{ color: '#57504A' }}>
                {body || (variant === 'geo'
                  ? 'Drop by — we\'ve got something for you.'
                  : 'Your message will appear here…')}
              </p>
            </div>
          </div>

          {/* Bottom hint */}
          <div className="mt-auto mb-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
               style={{ background: 'rgba(255,255,255,0.12)' }}>
            {variant === 'geo' ? (
              <MapPin size={9} style={{ color: 'white' }} />
            ) : (
              <Bell size={9} style={{ color: 'white' }} />
            )}
            <span className="text-[9px] font-medium" style={{ color: 'white' }}>
              {variant === 'geo' ? 'Proximity notification' : 'Live preview · updates as you type'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhonePushPreview;
