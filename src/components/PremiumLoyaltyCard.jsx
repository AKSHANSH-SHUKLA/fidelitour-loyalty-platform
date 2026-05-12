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
  const primary = card.primary_color || '#B85C38';
  const secondary = card.secondary_color || '#9C4427';
  const accent = card.accent_color || '#F4D8A8';
  const textOnBrand = card.text_on_brand || '#FFFFFF';
  const muted = 'rgba(255,255,255,0.78)';

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
        {/* Decorative hero image — washed behind content for depth */}
        {card.hero_image_url && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${card.hero_image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'right center',
              opacity: 0.22,
              mixBlendMode: 'screen',
            }}
          />
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
              {customer?.tier && (
                <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
                  Membre {customer.tier}
                </p>
              )}
            </div>
          </div>
          <div className="text-right leading-tight">
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
              {card.points_label || 'Points'}
            </p>
            <p className="text-2xl font-bold" style={{ color: textOnBrand, letterSpacing: '-0.02em' }}>
              {points.toLocaleString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Editorial title — the "TA CARTE FIDÉLITÉ" mark */}
        <div className="relative my-3">
          <p
            className="ft-card-title-font text-[28px] leading-[1.02] tracking-tight uppercase"
            style={{
              color: textOnBrand,
              fontStyle: 'italic',
              textShadow: '0 1px 0 rgba(0,0,0,0.04)',
            }}
          >
            {card.title_label || 'Ta carte fidélité'}
          </p>
        </div>

        {/* Greeting + back-of-card affordance */}
        <div className="relative flex items-end justify-between mt-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
              Bonjour,
            </p>
            <p className="text-lg font-semibold" style={{ color: textOnBrand }}>
              {firstName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: muted }}>
              Détails des récompenses
            </p>
            <p className="text-xs font-semibold" style={{ color: accent }}>
              Au dos&nbsp;→
            </p>
          </div>
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

        {/* Code 128 barcode strip below — visible always, sized for laser POS */}
        <div className="mt-4">
          <Code128Barcode
            value={customer?.barcode_id || ''}
            height={compact ? 44 : 54}
            barWidth={2}
            fontSize={11}
          />
        </div>

        {/* Card number footer — formatted like a real loyalty card */}
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
      </div>
    </div>
  );
}
