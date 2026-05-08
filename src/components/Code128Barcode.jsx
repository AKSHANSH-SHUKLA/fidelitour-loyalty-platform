import React, { useEffect, useRef, useState } from 'react';

/**
 * Code128Barcode — renders a 1D Code 128 barcode using JsBarcode loaded
 * from a CDN. Used alongside the QR code on the wallet card so even a
 * vintage 1D laser POS scanner can read the customer's ID.
 */
const Code128Barcode = ({ value, height = 50, width = 1.6, fontSize = 12, displayValue = true }) => {
  const ref = useRef(null);
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.JsBarcode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.JsBarcode) { setReady(true); return; }
    const SRC = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.code128.min.js';
    let s = document.querySelector(`script[src="${SRC}"]`);
    if (!s) {
      s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    const onLoad = () => setReady(true);
    s.addEventListener('load', onLoad);
    return () => s.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    if (!ready || !ref.current || !value) return;
    try {
      window.JsBarcode(ref.current, String(value), {
        format: 'CODE128',
        width,
        height,
        displayValue,
        fontSize,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (e) {
      // Bad value (rare) — fall through, the SVG just stays empty
      // and the QR above is still scannable.
      console.warn('Code128 render failed', e);
    }
  }, [ready, value, height, width, fontSize, displayValue]);

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`Barcode for ${value}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
};

export default Code128Barcode;
