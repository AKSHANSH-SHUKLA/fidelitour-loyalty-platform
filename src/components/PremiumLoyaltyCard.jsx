import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Code128Barcode from './Code128Barcode';

/**
 * PremiumLoyaltyCard — KFC-grade wallet card.
 *
 * What this looks like:
 *   - Brand-colored full-bleed hero block with the business logo top-left,
 *     points badge top-right ("PTS 725"), and a big editorial title
 *     ("TA CARTE FIDÉLITÉ") set in serif.
 *   - Hero photography fills the right half of the brand block (optional —
 *     falls back to a gradient if no hero_image_url is set).
 *   - "BONJOUR {first_name}" greeting + "DÉTAILS DES RÉCOMPENSES Au dos →"
 *     affordance, exactly like the KFC reference.
 *   - Centered big QR (the modern scan path) on a white surface inside the
 *     brand panel — high contrast, easy for any phone camera.
 *   - Below the brand block: a clean white section with the Code 128 strip
 *     and a formatted "N° Carte: A618" identifier, the parts old POS lasers
 *     need.
 *
 * Designed to:
 *   - Look premium on first glance, even before the patron customises a logo
 *     (brand-coloured + serif title = "expensive" feel by default).
 *   - Stay responsive — the card lives inside MyWalletCardPage's two-column
 *     layout on desktop and stacks naturally on mobile.
 *   - Be theme-driven: every colour is read from `card` so the Card Designer
 *     in Settings continues to control the look without code changes.
 *
 * Props:
 *   - customer: { name, barcode_id, points, tier, first_name? }
 *   - tenant:   { name }
 *   - card:     { primary_color, secondary_color, accent_color,
 *                 logo_url?, hero_image_url?, title_label?, points_label? }
 *
 * The component is deliberately self-contained (no state, no effects) so it
 * can be embedded inside HeroPhoneShowcase for the landing-page demo as well.
 */
export default function PremiumLoyaltyCard({ customer, tenant, card = {}, compact = false }) {
  // Colour palette — every key has a sensible fallback so a half-configured
  // card never crashes.
  const primary = card.primary_color || '#B85C38';
  const secondary = card.secondary_color || '#9C4427';
  const accent = card.accent_color || '#F4D8A8';
  const textOnBrand = card.text_on_brand || '#FFFFFF';
  const backLinkColor = card.back_link_color || accent;
  const muted = 'rgba(255,255,255,0.78)';

  // Text content — every visible label is owner-editable in Card Designer.
  const titleText    = card.title_label    || 'Ta carte fidélité';
  const pointsLabel  = card.points_label   || 'Points';
  const greetingLbl  = card.greeting_label || 'Bonjour';
  const backLabel    = card.back_label     || 'Détails récompenses';
  const backValue    = card.back_value     || 'Au dos →';

  // Typography
  const titleFont    = card.title_font || 'Cormorant Garamond';
  const titleItalic  = card.title_italic !== false;   // default true

  // Visibility toggles — each element can be hidden by the owner.
  // Default everything to TRUE so existing cards (without these flags
  // in the doc) keep showing all elements.
  const showTier        = card.show_tier        !== false;
  const showPoints      = card.show_points      !== false;
  const showTitle       = card.show_title       !== false;
  const showGreeting    = card.show_greeting    !== false;
  const showBackLink    = card.show_back_link   !== false;
  const showCardNumber  = card.show_card_number !== false;
  const showBarcode     = card.show_barcode     !== false;

  // Hero image fully opaque — opacity feature removed at owner request.
  const heroOpacity = 1;

  // First name only — feels personal, matches the KFC pattern ("Bonjour Julie")
  const firstName = (customer?.first_name || customer?.name || '').split(' ')[0] || 'Client';

  // Format the barcode_id as an elegant card number. "FT-1DFC4E62" → "A618"-style
  // short suffix, plus a long-form line for completeness.
  const cardSuffix = (() => {
    const raw = (customer?.barcode_id || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!raw) return '----';
    return raw.slice(-4);
  })();

  const points = customer?.points ?? 0;

  // ── 3-band Apple Wallet layout — the ONLY supported design ─────────
  // TOP STRIP:    business logo + name (top-left), "+ D'INFOS / N pts"
  //               (top-right), tier badge (optional). Uses card_bg_color.
  // MIDDLE STRIP: brand-coloured or image promo band, optionally with
  //               business logo overlaid centre. Independent strip_color.
  // BOTTOM STRIP: greeting + name (left), action prompt (right), then
  //               stamps grid, points meter, smaller QR code with
  //               customer ID + barcode + birthday. Same card_bg_color
  //               as the top so they read as one continuous surface.
  // (The legacy "hero" layout has been removed — one design, strictly
  // following the 3-patch rule.)
  {
    const cardBg     = card.card_bg_color   || '#FFFFFF';
    const cardInk    = card.card_ink_color  || '#1F1B1A';
    const stripType  = card.strip_type      || 'color';
    const stripColor = card.strip_color     || primary;
    const stripInk   = card.strip_text_color || '#FFFFFF';
    const stripTitle = card.strip_title     || titleText;
    const stripSub   = card.strip_subtitle  || '';
    const showOffer  = card.show_offer_box !== false;
    const offerText  = card.offer_box_text  || '';
    const offerSub   = card.offer_box_subtext || '';
    const offerBg    = card.offer_box_color || '#FFFFFF';
    const offerInk   = card.offer_box_ink_color || stripColor;
    const logoPos    = card.logo_position || 'top_left';
    const showPtsTR  = card.show_points_top_right !== false;
    const ptsTRLbl   = card.points_top_right_label || '+ D\'INFOS';
    const showActPr  = card.show_action_prompt !== false;
    const actPrTitle = card.action_prompt_title || 'Présentez votre carte fidélité';
    const actPrSub   = card.action_prompt_sub   || 'Et cumulez des points';
    const greetLbl   = (card.bottom_greeting_label || 'Bienvenue').toUpperCase();
    const showQr     = card.show_qr !== false;
    const qrSize     = Math.max(48, Math.min(140, parseInt(card.qr_size, 10) || 90));
    const showBday   = !!card.show_birthday;
    const bdayLbl    = card.birthday_label || 'Anniversaire';
    const showTier   = card.show_tier_badge !== false;
    const tierKey    = (customer?.tier || 'bronze').toLowerCase();
    const tierColor  = ({
      bronze: card.tier_badge_bronze || '#B26344',
      silver: card.tier_badge_silver || '#9AA6B3',
      gold:   card.tier_badge_gold   || '#E8A53B',
      vip:    card.tier_badge_vip    || '#9A6DBF',
    })[tierKey] || (card.tier_badge_bronze || '#B26344');
    const fullName   = card.use_full_name
      ? (customer?.name || firstName).toUpperCase()
      : firstName;
    const visits     = customer?.visits ?? 0;
    const cycle      = (customer?.reward_threshold || 10);

    return (
      <div
        className="rounded-2xl overflow-hidden shadow-xl relative isolate"
        style={{ background: cardBg, maxWidth: 380, margin: '0 auto' }}
      >
        {/* ── TOP STRIP ────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2" style={{ color: cardInk, background: cardBg }}>
          {/* Logo + tenant name top-left (unless logo_position overrides it) */}
          {logoPos !== 'middle_overlay' && (
            <div className={`flex items-center gap-2 min-w-0 ${logoPos === 'top_center' ? 'mx-auto' : ''}`}>
              {card.logo_url ? (
                <img src={card.logo_url} alt="" className="h-6 w-auto object-contain" style={{ maxWidth: 100 }} />
              ) : (
                <span className="text-[15px] font-semibold" style={{ color: cardInk, letterSpacing: '-0.01em' }}>
                  {tenant?.name || 'FidéliTour'}
                </span>
              )}
              {showTier && (
                <span
                  className="text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: tierColor, color: '#FFFFFF', letterSpacing: '0.12em' }}
                >
                  {tierKey}
                </span>
              )}
            </div>
          )}
          {/* Top-right: "+ D'INFOS / N pts" */}
          {showPtsTR && (
            <div className="text-right leading-tight shrink-0">
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: cardInk, opacity: 0.55 }}>
                {ptsTRLbl}
                <span className="ml-1">↗</span>
              </p>
              <p className="text-[14px] mt-0.5 font-semibold" style={{ color: cardInk }}>
                {points} pts
              </p>
            </div>
          )}
        </div>

        {/* ── MIDDLE STRIP — image OR colour with optional overlay ── */}
        <div
          className="relative"
          style={{
            background: stripType === 'image' && card.hero_image_url
              ? `url(${card.hero_image_url}) center/cover no-repeat`
              : stripColor,
            color: stripInk,
            minHeight: 130,
          }}
        >
          {/* Readability scrim when image is used */}
          {stripType === 'image' && card.hero_image_url && (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.35) 100%)' }}
            />
          )}
          {/* Middle-overlay logo option */}
          {logoPos === 'middle_overlay' && card.logo_url && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <img src={card.logo_url} alt="" className="h-7 w-auto object-contain" style={{ maxWidth: 120, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }} />
            </div>
          )}
          <div className="relative z-10 px-5 py-5 text-center flex flex-col items-center justify-center" style={{ minHeight: 130 }}>
            {stripTitle && (
              <p
                className="uppercase font-semibold"
                style={{
                  color: stripInk,
                  fontFamily: `'${titleFont}', Georgia, serif`,
                  fontStyle: titleItalic ? 'italic' : 'normal',
                  fontSize: 22,
                  letterSpacing: '0.06em',
                  textShadow: stripType === 'image' ? '0 1px 3px rgba(0,0,0,0.45)' : 'none',
                }}
              >
                {stripTitle}
              </p>
            )}
            {stripSub && (
              <p className="text-[11.5px] mt-1" style={{ color: stripInk, opacity: 0.92 }}>
                {stripSub}
              </p>
            )}
            {showOffer && offerText && (
              <div
                className="inline-block mt-3 px-4 py-2"
                style={{ background: offerBg, color: offerInk }}
              >
                <p className="text-[15px] font-bold uppercase" style={{ letterSpacing: '0.04em' }}>
                  {offerText}
                </p>
                {offerSub && (
                  <p className="text-[9.5px] mt-0.5 uppercase" style={{ letterSpacing: '0.12em', opacity: 0.8 }}>
                    {offerSub}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM STRIP — greeting + action prompt + stamps + meter + QR + barcode ── */}
        <div className="px-5 pt-4 pb-5" style={{ color: cardInk, background: cardBg }}>
          {/* Greeting (left) + Action prompt (right) — Maison 123 pattern */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.16em]" style={{ color: cardInk, opacity: 0.55 }}>
                {greetLbl}
              </p>
              <p className="text-[18px] font-semibold mt-0.5 truncate" style={{ color: cardInk }}>
                {fullName}
              </p>
            </div>
            {showActPr && (
              <div className="text-right min-w-0">
                <p className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: cardInk, opacity: 0.85 }}>
                  {actPrTitle}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: cardInk, opacity: 0.6 }}>
                  {actPrSub}
                </p>
              </div>
            )}
          </div>

          {/* Stamps grid */}
          {card.show_stamps_grid !== false && (
            <StampGrid
              count={cycle}
              filled={Math.min(visits, cycle)}
              shape={card.stamp_shape || 'circle'}
              fillColor={card.stamp_fill_color || primary}
              emptyColor={card.stamp_empty_color || '#E7E5E4'}
              inkColor={card.stamp_ink_color || '#FFFFFF'}
              customUrl={card.stamp_custom_url || ''}
              size={card.stamp_size || 26}
              label={card.stamps_label || ''}
              ink={cardInk}
            />
          )}

          {/* Progress meter */}
          {card.show_meter !== false && cycle > 0 && (
            <div className="mt-3 mb-4">
              {card.meter_label && (
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: cardInk, opacity: 0.55 }}>
                    {card.meter_label}
                  </p>
                  <p className="text-[10px] font-semibold" style={{ color: cardInk }}>
                    {Math.min(visits, cycle)} / {cycle}
                  </p>
                </div>
              )}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: card.meter_track_color || '#F2EDE3' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (Math.min(visits, cycle) / cycle) * 100)}%`,
                    background: card.meter_fill_color || primary,
                  }}
                />
              </div>
            </div>
          )}

          {/* Birthday line */}
          {showBday && customer?.birthday && (
            <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: cardInk, opacity: 0.55 }}>
                {bdayLbl}
              </p>
              <p className="text-[12px] font-medium" style={{ color: cardInk }}>
                {customer.birthday}
              </p>
            </div>
          )}

          {/* QR code (smaller) — only when enabled */}
          {showQr && (
            <div className="mt-3 flex flex-col items-center">
              <div className="rounded-lg p-2 bg-white" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                <QRCodeSVG
                  value={customer?.barcode_id || ''}
                  size={qrSize}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#0F0F0F"
                />
              </div>
            </div>
          )}

          {/* Barcode at the bottom */}
          {showBarcode && (
            <div className="mt-3 flex flex-col items-center">
              <Code128Barcode
                value={customer?.barcode_id || ''}
                height={compact ? 40 : 48}
                barWidth={2}
                fontSize={11}
              />
            </div>
          )}
          {showCardNumber && !showBarcode && !showQr && (
            <div className="mt-2 text-center font-mono text-[12px]" style={{ color: cardInk }}>
              {customer?.barcode_id}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* eslint-disable */
  // Dead-code keepers below — never reached because the 3-band block
  // above always returns. Kept until the next big cleanup so reviewers
  // can see what was removed. (Hero layout had top + bottom not
  // matching, which broke the user's strict 3-patch rule.)
  // eslint-disable-next-line no-unreachable
  if (false) return (
    <div
      className="rounded-3xl overflow-hidden shadow-2xl relative isolate"
      style={{ background: `linear-gradient(140deg, ${primary} 0%, ${secondary} 100%)`, maxWidth: 420, margin: '0 auto' }}
    >
      {/* ── Top brand block ─────────────────────────────────────────────── */}
      <div
        className="relative px-5 pt-5 pb-6"
        style={{
          background: `linear-gradient(140deg, ${primary} 0%, ${secondary} 100%)`,
          color: textOnBrand,
        }}
      >
        {/* Hero image — prominent by default, opacity owner-configurable. */}
        {card.hero_image_url && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${card.hero_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: heroOpacity,
              }}
            />
            {/* Readability scrim — fades the image from full-strength on
                the right to a brand-tinted overlay on the left so the
                logo + name + points stay legible. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(95deg, ${primary} 0%, ${primary}E6 38%, ${primary}66 65%, transparent 100%)`,
              }}
            />
          </>
        )}

        {/* Top row: logo + points badge */}
        <div className="relative flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {card.logo_url ? (
              <img
                src={card.logo_url}
                alt={tenant?.name || ''}
                className="w-11 h-11 rounded-lg object-cover ring-1 ring-white/30"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold ring-1 ring-white/30"
                style={{ background: accent, color: secondary }}
              >
                {(tenant?.name || 'F').charAt(0)}
              </div>
            )}
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-wide" style={{ color: textOnBrand }}>
                {tenant?.name || 'FidéliTour'}
              </p>
              {showTier && customer?.tier && (
                <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
                  Membre {customer.tier}
                </p>
              )}
            </div>
          </div>
          {showPoints && (
            <div className="text-right leading-tight">
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
                {pointsLabel}
              </p>
              <p className="text-2xl font-bold" style={{ color: textOnBrand, letterSpacing: '-0.02em' }}>
                {points.toLocaleString('fr-FR')}
              </p>
            </div>
          )}
        </div>

        {/* Editorial title — owner-configurable font + italic + text */}
        {showTitle && (
          <div className="relative my-3">
            <p
              className="text-[28px] leading-[1.02] tracking-tight uppercase"
              style={{
                color: textOnBrand,
                fontFamily: `'${titleFont}', Georgia, serif`,
                fontStyle: titleItalic ? 'italic' : 'normal',
                fontWeight: 700,
                textShadow: '0 1px 0 rgba(0,0,0,0.04)',
              }}
            >
              {titleText}
            </p>
          </div>
        )}

        {/* Greeting + back-of-card affordance — both independently hidable */}
        <div className="relative flex items-end justify-between mt-2 gap-2">
          {showGreeting ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
                {greetingLbl},
              </p>
              <p className="text-lg font-semibold" style={{ color: textOnBrand }}>
                {firstName}
              </p>
            </div>
          ) : <div />}
          {showBackLink && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
                {backLabel}
              </p>
              <p className="text-xs font-semibold" style={{ color: backLinkColor }}>
                {backValue}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom section — SAME brand gradient as the top block so top
           and bottom read as one continuous coloured surface (user
           requirement). The QR code itself sits inside a small white
           tile for scanner contrast. ─────────────────────────────────── */}
      <div className="px-5 py-5" style={{ color: textOnBrand }}>
        {/* Stamps grid — punch-card visual on the hero layout too */}
        {card.show_stamps_grid !== false && (
          <div className="mb-4">
            <StampGrid
              count={customer?.reward_threshold || 10}
              filled={Math.min(customer?.visits || 0, customer?.reward_threshold || 10)}
              shape={card.stamp_shape || 'circle'}
              fillColor={card.stamp_fill_color || accent}
              emptyColor={card.stamp_empty_color || 'rgba(255,255,255,0.18)'}
              inkColor={card.stamp_ink_color || primary}
              customUrl={card.stamp_custom_url || ''}
              size={card.stamp_size || 28}
              label={card.stamps_label || ''}
              ink={textOnBrand}
            />
          </div>
        )}

        {/* Progress meter — slim bar that mirrors stamps fill */}
        {card.show_meter !== false && (customer?.reward_threshold || 10) > 0 && (
          <div className="mb-4">
            {card.meter_label && (
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: textOnBrand, opacity: 0.7 }}>
                  {card.meter_label}
                </p>
                <p className="text-[10px] font-semibold" style={{ color: textOnBrand }}>
                  {Math.min(customer?.visits || 0, customer?.reward_threshold || 10)} / {customer?.reward_threshold || 10}
                </p>
              </div>
            )}
            <div className="h-2 rounded-full overflow-hidden" style={{ background: card.meter_track_color || 'rgba(255,255,255,0.18)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((customer?.visits || 0) / (customer?.reward_threshold || 10)) * 100)}%`,
                  background: card.meter_fill_color || accent,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-center">
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'white',
              boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)',
            }}
          >
            <QRCodeSVG
              value={customer?.barcode_id || ''}
              size={compact ? 140 : 180}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#0F0F0F"
            />
          </div>
        </div>

        {/* Code 128 barcode strip — owner can hide it if their POS scans QR only.
            Wrapped in a white tile so the bars stay scannable on the brand surface. */}
        {showBarcode && (
          <div className="mt-4 rounded-lg bg-white p-2">
            <Code128Barcode
              value={customer?.barcode_id || ''}
              height={compact ? 44 : 54}
              barWidth={2}
              fontSize={11}
            />
          </div>
        )}

        {/* Card number footer */}
        {showCardNumber && (
          <div
            className="mt-4 pt-3 flex items-center justify-between text-[11px]"
            style={{ borderTop: '1px dashed rgba(255,255,255,0.20)', color: textOnBrand, opacity: 0.85 }}
          >
            <span className="uppercase tracking-[0.14em]">N° Carte</span>
            <span
              className="font-mono font-semibold"
              style={{ color: textOnBrand, letterSpacing: '0.06em' }}
            >
              {cardSuffix}
              <span className="opacity-50 ml-2 text-[10px]">{customer?.barcode_id}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StampGrid — the classic punch-card visual.
 * Renders `count` slots; the first `filled` are marked "collected".
 * Owner-configurable: shape (circle, hexagon, octagon, square, custom image),
 * fill colour, empty colour, glyph colour, size, and an optional caption.
 *
 * The grid wraps automatically; for the typical 10-stamp cycle this means
 * one row of 10 on a wide card and two rows of 5 on a narrow one.
 */
function StampGrid({ count = 10, filled = 0, shape = 'circle', fillColor = '#B85C38', emptyColor = '#E7E5E4', inkColor = '#FFFFFF', customUrl = '', size = 28, label = '', ink = '#1F1B1A' }) {
  const slots = Array.from({ length: Math.max(1, count) }, (_, i) => i < filled);
  const clipPathFor = (s) => {
    switch (s) {
      case 'hexagon': return 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';
      case 'octagon': return 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)';
      case 'square':  return 'none';
      default:        return 'none';
    }
  };
  const isCircle = shape === 'circle';
  const isCustom = shape === 'custom' && !!customUrl;
  return (
    <div className="mt-2">
      {label && (
        <p className="text-[9px] uppercase tracking-[0.14em] mb-2" style={{ color: ink, opacity: 0.55 }}>
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {slots.map((isFilled, i) => {
          if (isCustom) {
            return (
              <div
                key={i}
                style={{
                  width: size,
                  height: size,
                  backgroundImage: `url(${customUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: isFilled ? 1 : 0.25,
                  filter: isFilled ? 'none' : 'grayscale(0.6)',
                  borderRadius: 4,
                }}
                aria-label={isFilled ? 'Tampon collecté' : 'Tampon vide'}
              />
            );
          }
          const baseStyle = {
            width: size,
            height: size,
            background: isFilled ? fillColor : emptyColor,
            display: 'grid',
            placeItems: 'center',
            color: inkColor,
            borderRadius: isCircle ? '50%' : (shape === 'square' ? 4 : 0),
            clipPath: isCircle || shape === 'square' ? 'none' : clipPathFor(shape),
            transition: 'background 200ms',
          };
          return (
            <div key={i} style={baseStyle} aria-label={isFilled ? 'Tampon collecté' : 'Tampon vide'}>
              {isFilled && (
                <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
