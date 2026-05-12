import React from 'react';

/**
 * PhoneFrame — iPhone-style mock that wraps any child component so the
 * patron sees their card in the exact context the customer will: rounded
 * device chrome, dynamic-island notch, real status bar with time + signal,
 * and a soft drop shadow that anchors the frame to the page.
 *
 * Used in Card Designer to show the PremiumLoyaltyCard preview as it will
 * actually appear when a customer opens /card/<id> on their iPhone.
 *
 * Props:
 *   - children: ReactNode — what goes inside the screen
 *   - width?: number      — frame width in px (default 280)
 *   - time?: string       — clock label (default "9:41" — the universal Apple demo time)
 *   - label?: string      — caption under the phone
 */
export default function PhoneFrame({ children, width = 280, time = '9:41', label }) {
  const screenW = width - 16;        // body padding
  const screenH = Math.round(width * 2.1);
  return (
    <div className="inline-flex flex-col items-center">
      <div
        style={{
          width,
          padding: 8,
          borderRadius: 40,
          background: '#0F0F10',
          boxShadow:
            '0 0 0 2px #2A2421, 0 0 0 3px #0F0F10, 0 20px 40px rgba(0,0,0,0.18), 0 6px 12px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            width: screenW,
            minHeight: screenH,
            background: '#F5F0E6',
            borderRadius: 32,
            position: 'relative',
            overflow: 'hidden',
            paddingTop: 28,
            paddingBottom: 16,
          }}
        >
          {/* Dynamic island notch */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 96,
              height: 26,
              background: '#0F0F10',
              borderRadius: 14,
              zIndex: 10,
            }}
          />
          {/* Status bar — time on left, cellular/wifi/battery on right */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 22,
              right: 22,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#1F1B1A',
              fontSize: 12,
              fontWeight: 500,
              zIndex: 9,
            }}
          >
            <span>{time}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Cellular bars */}
              <svg width="16" height="10" viewBox="0 0 16 10">
                <rect x="0"  y="6" width="2.5" height="4" rx="0.5" fill="#1F1B1A" />
                <rect x="4"  y="4" width="2.5" height="6" rx="0.5" fill="#1F1B1A" />
                <rect x="8"  y="2" width="2.5" height="8" rx="0.5" fill="#1F1B1A" />
                <rect x="12" y="0" width="2.5" height="10" rx="0.5" fill="#1F1B1A" />
              </svg>
              {/* Wifi */}
              <svg width="14" height="10" viewBox="0 0 14 10">
                <path d="M7 9.5a1 1 0 100-2 1 1 0 000 2zm0-3a3 3 0 012.1.9l1-1A4.4 4.4 0 007 5.4a4.4 4.4 0 00-3.1 1l1 1A3 3 0 017 6.5zm0-3a6 6 0 014.3 1.8l1-1A7.4 7.4 0 007 1.4a7.4 7.4 0 00-5.3 2.4l1 1A6 6 0 017 3.5z" fill="#1F1B1A"/>
              </svg>
              {/* Battery */}
              <svg width="22" height="10" viewBox="0 0 22 10">
                <rect x="0.5" y="0.5" width="18" height="9" rx="2" fill="none" stroke="#1F1B1A" strokeOpacity="0.5"/>
                <rect x="2" y="2" width="14" height="6" rx="1" fill="#1F1B1A"/>
                <rect x="20" y="3" width="1.5" height="4" rx="0.5" fill="#1F1B1A" fillOpacity="0.5"/>
              </svg>
            </div>
          </div>

          {/* Browser-like URL chip — the customer is on Safari/Chrome */}
          <div
            style={{
              margin: '8px 22px 6px',
              padding: '4px 10px',
              background: 'rgba(0,0,0,0.06)',
              borderRadius: 10,
              fontSize: 10,
              color: '#4A4441',
              textAlign: 'center',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            fidelitour.fr/card/…
          </div>

          {/* Content — the wallet card itself */}
          <div style={{ padding: '4px 12px 12px' }}>
            {children}
          </div>
        </div>
      </div>
      {label && (
        <p
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--ink-mute, #7A716C)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
