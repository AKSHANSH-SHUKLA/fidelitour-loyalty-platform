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

  // Hero image — opacity slider (0–100) controls how prominent it is.
  const heroOpacity     = typeof card.hero_opacity === 'number'
    ? Math.max(0, Math.min(100, card.hero_opacity)) / 100
    : 0.85;

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

  // ── Wallet-pass layout (3 bands) ───────────────────────────────────
  // Renders the GÉMO / Maison 123 / Fnac adhérent style: top strip with
  // logo + identifier, promotional middle band (image OR colour), bottom
  // strip with member fields + barcode. Top and bottom share the same
  // background colour to read as one continuous surface.
  if (card.layout_style === 'wallet_pass') {
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
    const trLabel    = card.top_right_label  || '';
    const trValue    = card.top_right_value  || '';
    const showTr     = card.show_top_right !== false;
    const showMember = card.show_member_id !== false;
    const memberLbl  = card.member_id_label || 'Membre';
    const fullName   = card.use_full_name
      ? (customer?.name || firstName).toUpperCase()
      : firstName;
    const showCntr   = card.show_counter !== false;
    const cntrLbl    = card.counter_label || 'Mon compteur';
    const showOffsCt = card.show_offers_count !== false;
    const offsCtLbl  = card.offers_count_label || 'Mes offres';
    const visits     = customer?.visits ?? 0;
    const cycle      = (customer?.reward_threshold || 10);

    return (
      <div
        className="rounded-3xl overflow-hidden shadow-2xl relative isolate"
        style={{ background: cardBg, maxWidth: 420, margin: '0 auto' }}
      >
        {/* ── Top strip ─────────────────────────────────────────── */}
        <div className="px-5 py-4 flex items-start justify-between gap-2" style={{ color: cardInk, background: cardBg }}>
          <div className="flex items-center gap-2 min-w-0">
            {card.logo_url ? (
              <img src={card.logo_url} alt="" className="h-7 w-auto object-contain" style={{ maxWidth: 90 }} />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: stripColor, color: stripInk }}
              >
                {(tenant?.name || 'F').charAt(0)}
              </div>
            )}
            {!card.logo_url && (
              <span className="text-[15px] font-semibold" style={{ color: cardInk, letterSpacing: '-0.01em' }}>
                {tenant?.name || 'FidéliTour'}
              </span>
            )}
          </div>
          {showTr && (
            <div className="text-right leading-tight">
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: cardInk, opacity: 0.55 }}>
                {trLabel}
                <span className="ml-1">↗</span>
              </p>
              {showMember && (
                <p className="text-[12px] mt-0.5 font-medium" style={{ color: cardInk }}>
                  {fullName}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Middle promotional band ──────────────────────────── */}
        <div
          className="relative px-5 py-5"
          style={{
            background: stripType === 'image' && card.hero_image_url
              ? `url(${card.hero_image_url}) center/cover no-repeat`
              : stripColor,
            color: stripInk,
            minHeight: 110,
          }}
        >
          {/* Readability scrim only when image is used */}
          {stripType === 'image' && card.hero_image_url && (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.45) 100%)` }}
            />
          )}
          <div className="relative z-10 text-center">
            <p
              className="uppercase font-semibold"
              style={{
                color: stripInk,
                fontFamily: `'${titleFont}', Georgia, serif`,
                fontStyle: titleItalic ? 'italic' : 'normal',
                fontSize: 18,
                letterSpacing: '0.06em',
                textShadow: stripType === 'image' ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
              }}
            >
              {stripTitle}
            </p>
            {stripSub && (
              <p className="text-[11.5px] mt-1" style={{ color: stripInk, opacity: 0.9 }}>
                {stripSub}
              </p>
            )}
            {/* Offer box callout */}
            {showOffer && offerText && (
              <div
                className="inline-block mt-3 px-4 py-2 rounded-sm"
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

        {/* ── Bottom strip — member fields + barcode ───────────── */}
        <div className="px-5 py-4" style={{ color: cardInk, background: cardBg }}>
          {/* Stats row */}
          {(showCntr || showOffsCt) && (
            <div className="grid grid-cols-2 gap-4 mb-5">
              {showCntr && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: cardInk, opacity: 0.5 }}>
                    {cntrLbl}
                  </p>
                  <p className="text-[18px] font-medium mt-0.5" style={{ color: cardInk }}>
                    {Math.min(visits, cycle)} / {cycle}
                  </p>
                </div>
              )}
              {showOffsCt && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: cardInk, opacity: 0.5 }}>
                    {offsCtLbl}
                  </p>
                  <p className="text-[18px] font-medium mt-0.5" style={{ color: cardInk }}>
                    {customer?.offers_count ?? 0}
                  </p>
                </div>
              )}
            </div>
          )}
          {/* Barcode at the bottom */}
          {showBarcode && (
            <div className="mt-2 flex flex-col items-center">
              <Code128Barcode
                value={customer?.barcode_id || ''}
                height={compact ? 44 : 54}
                barWidth={2}
                fontSize={11}
              />
            </div>
          )}
          {showCardNumber && !showBarcode && (
            <div className="mt-2 text-center font-mono text-[12px]" style={{ color: cardInk }}>
              {customer?.barcode_id}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Default: Hero layout (existing premium card) ───────────────────
  return (
    <div
      className="rounded-3xl overflow-hidden shadow-2xl relative isolate"
      style={{ background: '#FFFFFF', maxWidth: 420, margin: '0 auto' }}
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

      {/* ── QR section (always white for max scanner contrast) ──────────── */}
      <div className="px-5 py-5 bg-white">
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

        {/* Code 128 barcode strip — owner can hide it if their POS scans QR only */}
        {showBarcode && (
          <div className="mt-4">
            <Code128Barcode
              value={customer?.barcode_id || ''}
              height={compact ? 44 : 54}
              barWidth={2}
              fontSize={11}
            />
          </div>
        )}

        {/* Card number footer — owner can hide if they prefer the QR-only minimal look */}
        {showCardNumber && (
          <div
            className="mt-4 pt-3 flex items-center justify-between text-[11px]"
            style={{ borderTop: '1px dashed rgba(0,0,0,0.12)', color: '#6B635E' }}
          >
            <span className="uppercase tracking-[0.14em]">N° Carte</span>
            <span
              className="font-mono font-semibold"
              style={{ color: '#1C1917', letterSpacing: '0.06em' }}
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
