import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// Initialise the translation layer BEFORE the React tree mounts so the
// first paint already shows the chosen language. The import has the
// side effect of bootstrapping i18next with FR/EN/AR resources.
import './lib/i18n';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ---------------------------------------------------------------------------
// PWA service-worker registration.
//
// Why we do it from main.jsx (not the SW itself):
//   - The SW lives at /sw.js (top-level scope), but it doesn't register itself.
//     The page must call navigator.serviceWorker.register() once on load.
//   - Without this, push notifications never fire because there's no active
//     SW to receive the push event.
//
// The SW is required for:
//   1. Receiving Web Push payloads (even when the tab is closed).
//   2. iOS PWA push (only works once the page is added to home screen AND
//      a SW is registered — both are non-negotiable on iOS Safari).
//   3. Offline-shell-style "open the wallet card even on flaky LTE".
//
// We register on the first page-load 'load' event so it doesn't compete with
// initial paint. We also no-op gracefully on browsers without SW support
// (very old Safari / desktop IE-equivalents).
// ---------------------------------------------------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Re-check for SW updates whenever the user comes back to the tab.
        // This way a deploy that ships a new sw.js is picked up without the
        // user having to hard-reload.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        // Don't crash the app if SW registration fails — push just won't work.
        // eslint-disable-next-line no-console
        console.warn('[FidéliTour] Service worker registration failed:', err);
      });
  });
}
