/**
 * GoogleTranslateBridge — full-page translation layer.
 *
 * WHY THIS EXISTS:
 *   Our i18next `t()` calls translate only the strings we've explicitly
 *   wrapped — sidebar, page titles, a few forms. Everything else (deep
 *   form labels, API-rendered text, modal copy, error toasts, ~80% of the
 *   surface area) stays in French regardless of the language picked.
 *
 *   This component embeds Google Translate's free `Element` widget,
 *   hides its UI, and exposes a programmatic hook so our own
 *   LanguageSwitcher can drive it. The net effect for the user: pick
 *   English → every visible word, including dynamic API content, flips
 *   to English. Pick Arabic → every word becomes Arabic. No code-side
 *   t() wrapping required.
 *
 * HOW IT WORKS:
 *   1. Inject the Google Translate script ONCE per page load.
 *   2. Initialise it in "manual" mode (no visible language bar).
 *   3. Set `pageLanguage: 'fr'` so Google treats every untranslated
 *      string as French (the source language the app was authored in).
 *      Strings we already translated via i18next pass through cleanly —
 *      English text sent through "FR→EN" is a no-op.
 *   4. The widget creates a hidden <select class="goog-te-combo"> on
 *      page load. Calling `applyGoogleTranslate(lang)` sets its value
 *      and dispatches a `change` event → Google walks the DOM and
 *      retranslates every text node. It also installs a MutationObserver
 *      internally, so React re-renders and async-loaded modals get
 *      translated automatically.
 *   5. We force `<html dir="ltr">` even when target is Arabic — the
 *      owner explicitly asked the layout NOT to flip RTL, only the
 *      text content should change.
 *
 * RACE NOTES:
 *   The Google script loads async. Our LanguageSwitcher may call
 *   applyGoogleTranslate() before the .goog-te-combo select exists.
 *   We handle that by queuing the requested language and replaying it
 *   as soon as the select appears (MutationObserver on <body>).
 */
import React, { useEffect } from 'react';

const SCRIPT_ID = 'google-translate-script';
const ELEMENT_ID = 'google_translate_element';
const CALLBACK_NAME = 'fdtGoogleTranslateInit';

// Languages we offer in the LanguageSwitcher. Map our internal codes to
// the codes Google Translate Element uses. They happen to match for
// fr/en/ar but listing them explicitly future-proofs the bridge.
const LANG_MAP = { fr: 'fr', en: 'en', ar: 'ar' };

// One-shot queue: if applyGoogleTranslate() is called before the
// widget is ready, we stash the request here and flush it on init.
let pendingLang = null;

/**
 * Programmatically tell Google Translate to retranslate the page into
 * `lang` (one of 'fr', 'en', 'ar'). Safe to call before the script
 * finishes loading — the request will be replayed when ready.
 *
 * Exported so LanguageSwitcher can call it on every language change.
 */
export function applyGoogleTranslate(lang) {
  const target = LANG_MAP[lang] || 'fr';
  pendingLang = target;
  tryFlush();
}

function tryFlush() {
  if (pendingLang == null) return;
  const select = document.querySelector('select.goog-te-combo');
  if (!select) return; // widget not yet mounted — observer will retry
  // Only fire if the value actually changes — saves a flicker.
  if (select.value !== pendingLang) {
    select.value = pendingLang;
    select.dispatchEvent(new Event('change'));
  }
  pendingLang = null;
  // Keep layout LTR even when Google flips it to Arabic.
  document.documentElement.setAttribute('dir', 'ltr');
}

export default function GoogleTranslateBridge() {
  useEffect(() => {
    // Idempotent — multiple mounts (StrictMode, route remounts) must
    // not append the script twice or Google's init callback throws.
    if (document.getElementById(SCRIPT_ID)) {
      // Script already loaded by a previous mount. Just try to apply
      // any pending lang in case React re-mounted us mid-flight.
      tryFlush();
      return;
    }

    // Define the init callback BEFORE injecting the script — Google's
    // bootstrap immediately calls window[callbackName] on load.
    window[CALLBACK_NAME] = () => {
      try {
        // eslint-disable-next-line no-new
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'fr',
            includedLanguages: 'fr,en,ar',
            // 0 = SIMPLE (just a select). We hide it via CSS anyway.
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          ELEMENT_ID,
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[GoogleTranslateBridge] init failed:', e);
      }
      // The TranslateElement constructor inserts the .goog-te-combo
      // select asynchronously. Watch for it and flush any pending lang
      // change the moment it appears.
      const observer = new MutationObserver(() => {
        if (document.querySelector('select.goog-te-combo')) {
          tryFlush();
          // Done — but don't disconnect: Google sometimes re-creates
          // the select on route changes. Keep watching, cheap.
        }
        // Also keep <html dir="ltr"> sticky — Google sets dir="rtl"
        // for Arabic targets, which the owner explicitly rejected.
        if (document.documentElement.getAttribute('dir') !== 'ltr') {
          document.documentElement.setAttribute('dir', 'ltr');
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['dir'],
      });
    };

    // Inject the script. The cb=... query param tells Google's
    // loader which window function to call when the widget is ready.
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = `https://translate.google.com/translate_a/element.js?cb=${CALLBACK_NAME}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      // Network blocked / extension blocked the script. Fall back
      // silently — our existing t() translations still cover headers.
      // eslint-disable-next-line no-console
      console.warn('[GoogleTranslateBridge] script failed to load — falling back to i18next-only.');
    };
    document.body.appendChild(s);
  }, []);

  // The Element widget renders into the div with the well-known id.
  // We hide it with CSS rather than rendering it conditionally because
  // Google's script searches for it by id on load.
  return (
    <div
      id={ELEMENT_ID}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    />
  );
}
