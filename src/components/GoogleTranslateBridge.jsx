/**
 * GoogleTranslateBridge — thin React adapter around lib/translator.js.
 *
 * The actual translation logic lives in `lib/translator.js` (custom DOM
 * walker + Google free translation endpoint + MutationObserver). This
 * file just bootstraps the translator on mount with the user's saved
 * language, and re-applies it on every route change so deep pages
 * (Insights, AI Assistant, etc.) translate as soon as they mount.
 *
 * Why we kept the filename "GoogleTranslateBridge": other components
 * (LanguageSwitcher) import `applyGoogleTranslate` from this path, and
 * re-exporting from here means zero changes to those callsites.
 */
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyTranslation, getActiveLanguage } from '../lib/translator';

// Backward-compatible export — LanguageSwitcher already calls this name.
export function applyGoogleTranslate(lang) {
  applyTranslation(lang);
}

export default function GoogleTranslateBridge() {
  useEffect(() => {
    // Translate everything that's on the page at boot.
    const lang = getActiveLanguage();
    if (lang && lang !== 'fr') {
      // Small delay so React has painted the initial route first.
      const id = setTimeout(() => applyTranslation(lang), 50);
      return () => clearTimeout(id);
    }
  }, []);
  return null;
}

/**
 * Mounted inside <Router> in App.jsx. Re-applies the active language
 * whenever the route changes. The custom translator handles new content
 * via its own MutationObserver, but we re-fire on navigation as a belt-
 * and-suspenders measure so even slow renders get caught.
 */
export function RouteAwareRetranslator() {
  const location = useLocation();
  useEffect(() => {
    const lang = getActiveLanguage();
    if (lang && lang !== 'fr') {
      // Multiple passes so we catch: initial paint (100ms), deferred
      // chart renders (600ms), and very-late async content (1500ms).
      // Each pass is mostly cache hits after the first, so cheap.
      const ids = [
        setTimeout(() => applyTranslation(lang), 100),
        setTimeout(() => applyTranslation(lang), 600),
        setTimeout(() => applyTranslation(lang), 1500),
      ];
      return () => ids.forEach(clearTimeout);
    }
  }, [location.pathname]);
  return null;
}
