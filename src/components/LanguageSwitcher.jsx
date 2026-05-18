/**
 * LanguageSwitcher — three-button row that flips the active language
 * for the entire platform. Persists choice in localStorage via
 * i18next-browser-languagedetector. Flipping to AR auto-sets
 * <html dir="rtl"> via the i18n.on('languageChanged') hook in lib/i18n.js.
 *
 * Used in two places:
 *   • Sidebar (compact variant, icon-only flags)
 *   • Settings → Langue de l'interface (full variant with hint)
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
];

export default function LanguageSwitcher({ variant = 'full' }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'fr').slice(0, 2);

  const change = (code) => {
    if (code === current) return;
    i18n.changeLanguage(code);
  };

  if (variant === 'compact') {
    return (
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Language">
        {LANGS.map((lng) => {
          const active = lng.code === current;
          return (
            <button
              key={lng.code}
              type="button"
              onClick={() => change(lng.code)}
              aria-pressed={active}
              title={lng.label}
              style={{
                padding: '3px 8px',
                fontSize: 13,
                borderRadius: 6,
                border: active ? '1px solid #B85C38' : '1px solid #E7E5E4',
                background: active ? '#FFF1EA' : 'white',
                cursor: 'pointer',
                font: 'inherit',
                lineHeight: 1,
              }}
            >
              {lng.flag}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E7E5E4',
      borderRadius: 12,
      padding: 18,
    }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1C1917' }}>
        {t('settings.language_title')}
      </h3>
      <p style={{ margin: '4px 0 12px', fontSize: 12.5, color: '#57534E' }}>
        {t('settings.language_subtitle')}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {LANGS.map((lng) => {
          const active = lng.code === current;
          return (
            <button
              key={lng.code}
              type="button"
              onClick={() => change(lng.code)}
              aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 10,
                border: active ? '1px solid #B85C38' : '1px solid #E7E5E4',
                background: active ? '#FFF1EA' : 'white',
                cursor: 'pointer',
                color: '#1C1917', font: 'inherit', fontSize: 13.5, fontWeight: 500,
                minWidth: 120,
                justifyContent: 'flex-start',
              }}
            >
              <span style={{ fontSize: 18 }}>{lng.flag}</span>
              <span>{lng.label}</span>
              {active && <span style={{ marginLeft: 'auto', color: '#B85C38' }}>✓</span>}
            </button>
          );
        })}
      </div>
      {current === 'ar' && (
        <p style={{ marginTop: 12, fontSize: 11.5, color: '#A04A1F', background: '#FFF1EA', padding: '6px 10px', borderRadius: 8 }}>
          ⚠ {t('settings.language_ar_hint')}
        </p>
      )}
    </div>
  );
}
