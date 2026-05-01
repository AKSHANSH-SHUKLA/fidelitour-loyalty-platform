import React, { useEffect, useRef, useState } from 'react';

/**
 * LeafletFranceMap — real interactive map of France using Leaflet + OSM tiles.
 *
 * Loaded via CDN (see index.html). On mount we wait for `window.L` to be
 * available, then initialise the map. Each département becomes a sized
 * circle marker — bigger circle = more customers. Clicking a marker
 * fires `onSelect(deptCode)` and zooms in to that département.
 *
 * Falls back gracefully to a "loading map" message if Leaflet isn't ready
 * (e.g. ad-blocker, offline). The page never errors — at worst it shows
 * the static SVG fallback rendered separately by the parent.
 */
const FRANCE_CENTER = [46.5, 2.5];
const FRANCE_ZOOM = 5.5;

const LeafletFranceMap = ({ deptList = [], selectedDept, onSelect }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.L);
  const [error, setError] = useState(null);

  // Wait for Leaflet to load if it isn't already.
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let attempts = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      attempts += 1;
      if (typeof window !== 'undefined' && window.L) {
        setReady(true);
        clearInterval(id);
      } else if (attempts > 60) {                  // 60 × 250ms = 15 s
        setError('Map library failed to load. Showing list view instead.');
        clearInterval(id);
      }
    }, 250);
    return () => { cancelled = true; clearInterval(id); };
  }, [ready]);

  // Initialise the map once Leaflet is available.
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(containerRef.current, {
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    // Sensible bounds so the user can't pan to Mongolia by accident.
    map.setMaxBounds([[40.0, -8.0], [52.5, 12.0]]);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      try { map.remove(); } catch (_) {}
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [ready]);

  // (Re)render the markers whenever deptList or selection changes.
  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;
    const L = window.L;
    layerRef.current.clearLayers();

    const counts = deptList.map((d) => d.customers?.length || 0);
    const maxCount = Math.max(1, ...counts);

    deptList.forEach((d) => {
      if (!d.lat || !d.lng) return;
      const n = d.customers?.length || 0;
      const radius = 10 + (n / maxCount) * 28;     // 10..38 px
      const isActive = selectedDept === d.code;
      const marker = L.circleMarker([d.lat, d.lng], {
        radius,
        color: '#B85C38',
        weight: isActive ? 3 : 1.4,
        fillColor: '#B85C38',
        fillOpacity: isActive ? 0.65 : 0.32,
      });
      const popupHtml = `
        <div style="font-family: 'Manrope', sans-serif; min-width: 180px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="background:#B85C38;color:white;font-weight:700;padding:2px 6px;border-radius:4px;font-size:11px;">${d.code}</span>
            <strong style="color:#1C1917;">${d.name || ''}</strong>
          </div>
          <div style="font-size:12px;color:#57534E;line-height:1.5;">
            <div><b>${n}</b> customer${n === 1 ? '' : 's'}</div>
            <div><b>€${Math.round(d.revenue || 0).toLocaleString()}</b> revenue</div>
            <div><b>${d.visits || 0}</b> visits</div>
          </div>
          <div style="margin-top:8px;">
            <button data-dept="${d.code}" class="leaflet-dept-drill"
              style="background:#B85C38;color:white;border:0;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
              Open details →
            </button>
          </div>
        </div>`;
      marker.bindPopup(popupHtml, { closeButton: true });
      marker.on('click', () => onSelect && onSelect(isActive ? null : d.code));
      marker.addTo(layerRef.current);
    });

    // Wire up the "Open details" button inside any popup that's currently open
    const wirePopupButtons = () => {
      document.querySelectorAll('.leaflet-dept-drill').forEach((btn) => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-dept');
          onSelect && onSelect(code);
          mapRef.current?.closePopup();
        });
      });
    };
    mapRef.current.on('popupopen', wirePopupButtons);

    // Auto-zoom to the active département so the live map mirrors the list selection.
    if (selectedDept) {
      const d = deptList.find((x) => x.code === selectedDept);
      if (d && d.lat && d.lng) {
        mapRef.current.setView([d.lat, d.lng], 9, { animate: true });
      }
    } else {
      mapRef.current.setView(FRANCE_CENTER, FRANCE_ZOOM, { animate: true });
    }

    return () => {
      mapRef.current?.off('popupopen', wirePopupButtons);
    };
  }, [ready, deptList, selectedDept, onSelect]);

  if (error) {
    return (
      <div className="rounded-lg p-4 text-sm" style={{ background: '#FEF3C7', color: '#92400E' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#E7E5E4' }}>
      {!ready && (
        <div className="p-6 text-sm text-center" style={{ color: '#57534E', background: '#F0F7FF' }}>
          Loading interactive map…
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: 540, display: ready ? 'block' : 'none' }}
      />
    </div>
  );
};

export default LeafletFranceMap;
