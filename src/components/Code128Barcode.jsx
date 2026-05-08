import React, { useEffect, useRef, useState } from 'react';

/**
 * Code128Barcode — 1D Code 128 barcode rendered to <canvas> via JsBarcode
 * loaded from CDN. Sits below the wallet card's QR so old 1D laser POS
 * scanners can still read the customer ID.
 *
 * Why <canvas> + polling (not <svg>):
 *   - JsBarcode emits exact pixel dimensions; CSS scaling against an SVG
 *     fights with those attributes and produces an invisible bar strip.
 *   - The CDN script can finish loading before our `load` event listener
 *     attaches (race), so we poll for `window.JsBarcode` instead.
 */
const SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';

const ensureJsBarcode = () => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') return reject(new Error('no window'));
  if (window.JsBarcode) return resolve(window.JsBarcode);
  let s = document.querySelector(`script[data-jsbarcode]`);
  if (!s) {
    s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.dataset.jsbarcode = '1';
    document.head.appendChild(s);
  }
  // Poll for window.JsBarcode for up to 10s — covers the load-race case.
  const t0 = Date.now();
  (function tick() {
    if (window.JsBarcode) return resolve(window.JsBarcode);
    if (Date.now() - t0 > 10000) return reject(new Error('JsBarcode load timeout'));
    setTimeout(tick, 80);
  })();
});

const Code128Barcode = ({ value, height = 56, barWidth = 2, fontSize = 13 }) => {
  const ref = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    let cancelled = false;
    ensureJsBarcode()
      .then((JsBarcode) => {
        if (cancelled || !ref.current) return;
        try {
          JsBarcode(ref.current, String(value), {
            format: 'CODE128',
            width: barWidth,
            height,
            displayValue: true,
            fontSize,
            font: 'monospace',
            textMargin: 4,
            margin: 8,
            background: '#ffffff',
            lineColor: '#000000',
          });
        } catch (e) {
          setError(e?.message || 'render failed');
        }
      })
      .catch((e) => setError(e?.message || 'load failed'));
    return () => { cancelled = true; };
  }, [value, height, barWidth, fontSize]);

  if (error) {
    // Graceful fallback — the QR above still works.
    return (
      <p className="text-[10px] font-mono text-center" style={{ color: '#8B8680' }}>
        Barcode: {value}
      </p>
    );
  }
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`Barcode for ${value}`}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
    />
  );
};

export default Code128Barcode;
