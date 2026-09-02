import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Code128Barcode from './Code128Barcode';
import { deriveCardTheme } from '../lib/cardTheme';

/**
 * WalletPassPreview — a pkpass-FAITHFUL render of the merchant's card, shown
 * inside the designer's iPhone frame.
 *
 * This is deliberately NOT the PWA card (WalletCard.jsx). The merchant is
 * going to launch with real Apple Wallet passes, so what they see while
 * designing must be what PassKit will actually render — same geometry, same
 * constraints, none of the PWA-only liberties. Concretely:
 *
 *   - storeCard anatomy: logo row (logo capped at Apple's 160×50pt box) +
 *     organization name, ONE header field top-right as label/value TEXT
 *     (Wallet renders no coloured chips)
 *   - strip: edge-to-edge, Apple's exact 375:144 ratio. The stamps are
 *     composited INTO the strip, because that is how they will really ship —
 *     PassKit has no stamp element, so the server generates a strip.png per
 *     customer state (the Loopy Loyalty technique)
 *   - fields: secondary row (≤4 per Apple), auxiliary row for reward progress
 *     as TEXT — a real pass cannot draw a progress bar
 *   - barcode: exactly ONE (Wallet never shows two), centred on a white
 *     rounded block with altText beneath — code_type 'both' collapses to QR
 *   - colours: backgroundColor / foregroundColor / labelColor semantics via
 *     deriveCardTheme — the same three knobs pass.json actually has
 *
 * Scaled to `width` px for a 375pt-wide pass, so proportions stay exact.
 */
export default function WalletPassPreview({ customer, tenant, card = {}, width = 292 }) {
  const t = deriveCardTheme({
    brandColor: card.brand_color || card.card_bg_color || card.primary_color,
    surface: card.surface,
    surfaceColor: card.surface_color,
  });

  const s = width / 375; // 1pt at design scale → px
  const px = (v) => Math.round(v * s * 10) / 10;

  // ---- data (same derived-from-visits maths as everywhere else) ----------
  const firstName = (customer?.first_name || customer?.name || '').split(' ')[0] || 'Client';
  const displayName = card.use_full_name ? (customer?.name || firstName) : firstName;
  const visits = parseInt(customer?.visits, 10) || 0;
  const threshold = Math.max(1, parseInt(customer?.reward_threshold, 10)
    || parseInt(card.reward_threshold_stamps, 10) || 10);
  const pointsPerVisit = parseInt(card.points_per_visit, 10) || 10;
  const visitsPerStamp = Math.max(1, parseInt(card.visits_per_stamp, 10) || 1);
  const stamps = Math.min(threshold, Math.floor(visits / visitsPerStamp));
  const remaining = threshold - stamps;
  const meterMax = threshold * visitsPerStamp * pointsPerVisit;
  const earned = Math.min(visits * pointsPerVisit, meterMax);
  const tierKey = (customer?.tier || 'bronze').toLowerCase();
  const tierLabels = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', vip: 'VIP' };
  const barcodeId = customer?.barcode_id || '';

  const memberLabel = (card.greeting_label || 'Membre').toUpperCase();
  const pointsLabel = (card.points_label || 'Points').toUpperCase();
  const visitsLabel = (card.visits_label || 'Visites').toUpperCase();

  const showTier = card.show_tier_badge !== false && card.show_tier !== false;
  const showPoints = card.show_points !== false;
  const showVisits = card.show_visits !== false;
  const showStamps = card.show_stamps !== false && threshold > 0;
  const showMeter = card.show_meter !== false;
  const offerText = card.offer_box_text || '';
  const showOffer = card.show_offer_box !== false && !!offerText;

  // ONE barcode — a real pass never shows two. 'both' collapses to QR.
  const wantsBarcode = card.code_type === 'barcode'
    || (!card.code_type && card.show_qr === false && card.show_barcode !== false);
  const heroMode = card.hero_mode || (card.hero_image_url ? 'image' : 'brand');

  const label = {
    fontSize: px(10), fontWeight: 600, letterSpacing: '0.06em',
    color: t.label, textTransform: 'uppercase', lineHeight: 1.3,
  };
  const value = { fontSize: px(15), fontWeight: 500, color: t.ink, lineHeight: 1.25 };

  return (
    <div
      data-testid="wallet-pass-preview"
      style={{
        width, background: t.surface, borderRadius: px(12), overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
    >
      {/* ── logo row: logo (≤160×50pt box) + org name · header field ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: `${px(10)}px ${px(14)}px`, gap: px(10) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: px(8), minWidth: 0 }}>
          {card.logo_url ? (
            <img src={card.logo_url} alt=""
              style={{ maxHeight: px(30), maxWidth: px(96), borderRadius: px(4), objectFit: 'contain' }} />
          ) : null}
          <span style={{ fontSize: px(14), fontWeight: 600, color: t.ink,
                         whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tenant?.name || 'Votre commerce'}
          </span>
        </div>
        {showTier && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={label}>Statut</div>
            <div style={{ ...value, fontSize: px(14) }}>{tierLabels[tierKey] || 'Bronze'}</div>
          </div>
        )}
      </div>

      {/* ── strip: edge-to-edge 375×144, stamps composited in (this IS the
             server-generated strip the real pass will carry) ── */}
      {heroMode !== 'none' && (
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '375 / 144',
          background: heroMode === 'image' && card.hero_image_url
            ? `url(${card.hero_image_url}) center/cover`
            : t.brandRaw,
        }}>
          {showStamps && (
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: `${px(14)}px ${px(14)}px ${px(8)}px`,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.45))',
              display: 'flex', gap: px(5), alignItems: 'center',
            }}>
              {Array.from({ length: threshold }).map((_, i) => (
                <span key={i} style={{
                  width: px(11), height: px(11), borderRadius: '50%',
                  background: i < stamps ? t.brand : 'transparent',
                  border: i < stamps ? 'none' : `${Math.max(1, px(1.4))}px solid rgba(255,255,255,0.75)`,
                  boxSizing: 'border-box',
                  boxShadow: i < stamps ? '0 0 0 1px rgba(0,0,0,0.25)' : 'none',
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── secondary fields row (≤4) ── */}
      <div style={{ display: 'flex', gap: px(20), padding: `${px(10)}px ${px(14)}px 0` }}>
        <div style={{ minWidth: 0 }}>
          <div style={label}>{memberLabel}</div>
          <div style={value}>{displayName}</div>
        </div>
        {showPoints && (
          <div>
            <div style={label}>{pointsLabel}</div>
            <div style={value}>{earned}</div>
          </div>
        )}
        {showVisits && (
          <div>
            <div style={label}>{visitsLabel}</div>
            <div style={value}>{visits}</div>
          </div>
        )}
      </div>

      {/* ── auxiliary row: progress as TEXT (no bars on a real pass) ── */}
      {(showMeter || showOffer) && (
        <div style={{ display: 'flex', gap: px(20), padding: `${px(8)}px ${px(14)}px 0` }}>
          {showMeter && (
            <div>
              <div style={label}>{(card.meter_label || 'Prochaine récompense').toUpperCase()}</div>
              <div style={{ ...value, fontSize: px(13) }}>
                {remaining > 0
                  ? `${remaining} tampon${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`
                  : (card.reward_description || 'Récompense débloquée !')}
              </div>
            </div>
          )}
          {showOffer && (
            <div style={{ minWidth: 0 }}>
              <div style={label}>Offre</div>
              <div style={{ ...value, fontSize: px(13), whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis' }}>{offerText}</div>
            </div>
          )}
        </div>
      )}

      {/* ── barcode block: ONE code, white rounded rect, altText ── */}
      {barcodeId && (
        <div style={{ display: 'flex', justifyContent: 'center',
                      padding: `${px(18)}px 0 ${px(16)}px` }}>
          <div style={{ background: '#FFFFFF', borderRadius: px(8),
                        padding: `${px(8)}px ${px(10)}px`,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: px(4) }}>
            {wantsBarcode ? (
              <Code128Barcode value={barcodeId} height={px(40)} />
            ) : (
              <QRCodeSVG value={barcodeId} size={px(92)} bgColor="#FFFFFF"
                         fgColor="#111111" level="M" />
            )}
            <div style={{ fontSize: px(9), letterSpacing: '0.1em', color: '#63666B',
                          fontVariantNumeric: 'tabular-nums' }}>
              {barcodeId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
