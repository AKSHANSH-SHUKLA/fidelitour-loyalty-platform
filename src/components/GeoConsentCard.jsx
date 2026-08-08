import React, { useEffect, useState } from 'react';
import { MapPin, X, Check, AlertCircle } from 'lucide-react';
import { publicAPI } from '../lib/api';

/**
 * GeoConsentCard — friendly, opt-in geolocation prompt with a clear "why".
 *
 * Browsers grant the `geolocation: always` permission stingily. The trick
 * to higher grant rates isn't begging — it's making the value crystal clear
 * before the prompt fires, and giving the user a one-tap retry path if they
 * accidentally hit Block.
 *
 * Behaviour:
 *   1. Reads current permission state (granted/denied/prompt) on mount.
 *   2. If granted → renders nothing (we already have it).
 *   3. If denied → shows a "you've blocked location, here's how to undo it"
 *      message with browser-specific guidance.
 *   4. If prompt → shows a soft pre-prompt explaining the benefit, then
 *      triggers the real browser prompt only when the user taps the CTA.
 *      This is how all serious consent UX is built — never call
 *      getCurrentPosition() unsolicited; the second time the user denies,
 *      most browsers permanently block the origin.
 *
 * After we get a position fix once, we ping the backend so:
 *   - the customer's home postal code is captured for analytics
 *   - the proximity-push system has a baseline coordinate
 *
 * Props:
 *   - customerId?: string  if present, also persist the captured location
 *                          to the customer record via the proximity ping endpoint.
 *   - tenantSlug?: string  needed alongside customerId for the ping.
 *   - barcodeId?: string   when set, we update prefs.geo_enabled = true after grant.
 *   - onGranted?: (coords) => void
 *   - onDenied?: () => void
 *   - variant?: 'card' | 'inline'
 */
export default function GeoConsentCard({
  customerId,
  tenantSlug,
  barcodeId,
  onGranted,
  onDenied,
  variant = 'card',
}) {
  const [state, setState] = useState('unknown'); // unknown | granted | denied | prompt | unsupported | working
  const [hidden, setHidden] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) { setState('unsupported'); return; }
    if (!navigator.permissions?.query) {
      // Firefox <= 79 / older Safari — assume prompt and let getCurrentPosition decide.
      setState('prompt');
      return;
    }
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
      if (cancelled) return;
      setState(perm.state);
      // Listen for live changes (e.g. user opens browser settings and changes it).
      perm.onchange = () => { if (!cancelled) setState(perm.state); };
    }).catch(() => { if (!cancelled) setState('prompt'); });
    return () => { cancelled = true; };
  }, []);

  // Auto-hide if already granted, or recently dismissed.
  useEffect(() => {
    if (state === 'granted') {
      setHidden(true);
      return;
    }
    try {
      const dismissedAt = parseInt(localStorage.getItem('ft.geoConsent.dismissed') || '0', 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (dismissedAt && Date.now() - dismissedAt < sevenDays) setHidden(true);
    } catch (_e) {}
  }, [state]);

  const dismiss = () => {
    try { localStorage.setItem('ft.geoConsent.dismissed', String(Date.now())); } catch (_e) {}
    setHidden(true);
  };

  const requestLocation = () => {
    setState('working');
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        // Best-effort backend ping.
        if (customerId && tenantSlug) {
          try {
            await publicAPI.proximityPing({ customer_id: customerId, ...coords });
          } catch (_e) { /* ignore */ }
        }
        // Best-effort prefs flip if we know the barcode.
        if (barcodeId) {
          try {
            const api = (await import('../lib/api')).default;
            await api.put(`/card/${barcodeId}/prefs`, { geo_enabled: true });
          } catch (_e) { /* ignore */ }
        }
        setState('granted');
        setHidden(true);
        onGranted?.(coords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
          onDenied?.();
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setState('prompt');
          setErrorMsg("Position indisponible. Essayez en extérieur ou activez le GPS.");
        } else if (err.code === err.TIMEOUT) {
          setState('prompt');
          setErrorMsg("Délai dépassé. Réessayez.");
        } else {
          setState('prompt');
          setErrorMsg("Impossible d'obtenir la position.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  if (hidden) return null;
  if (state === 'unsupported') return null; // nothing to do
  if (state === 'granted') return null;     // already good

  // Browser-specific reset hint when blocked.
  const browserResetHint = (() => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad/.test(ua)) {
      return "Sur iPhone : Réglages → Safari → Localisation → Autoriser.";
    }
    if (/Android/.test(ua) && /Chrome/.test(ua)) {
      return "Sur Android Chrome : ⓘ à côté de l'URL → Autorisations → Localisation → Autoriser.";
    }
    if (/Firefox/.test(ua)) {
      return "Sur Firefox : icône de cadenas → Autorisations → Localisation → Autoriser.";
    }
    return "Ouvrez les paramètres du site (icône cadenas) et réautorisez la localisation.";
  })();

  const inlineCard = variant === 'inline';

  return (
    <div
      className={
        inlineCard
          ? "rounded-xl border border-[#B8AEDC] bg-[#EFEDF8] p-3 my-2 text-sm flex items-start gap-3"
          : "rounded-2xl border border-[#B8AEDC] bg-gradient-to-br from-[#EFEDF8] to-[#F5F3FA] p-4 my-3 relative"
      }
    >
      {!inlineCard && (
        <button
          aria-label="Fermer"
          onClick={dismiss}
          className="absolute top-2 right-2 text-[#6F60B0] hover:text-[#171412] p-1"
        >
          <X size={16} />
        </button>
      )}
      <div className={inlineCard ? "flex-shrink-0 mt-0.5" : "flex items-start gap-3"}>
        <div className={inlineCard ? "" : "rounded-xl bg-[#B85C38] text-white p-2 flex-shrink-0"}>
          <MapPin size={inlineCard ? 18 : 20} className={inlineCard ? "text-[#B85C38]" : "text-white"} />
        </div>
        {!inlineCard && (
          <div className="flex-1 min-w-0">
            {state === 'denied' ? (
              <>
                <p className="text-sm font-semibold text-[#171412] mb-1 flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-[#B85C38]" />
                  Localisation bloquée
                </p>
                <p className="text-xs text-[#57504A] mb-2 leading-relaxed">
                  Vous nous avez bloqué la localisation. Pour recevoir les offres
                  quand vous passez devant la boutique, réautorisez-la :
                </p>
                <p className="text-xs text-[#171412] bg-white rounded-lg p-2 border border-[#E9E5E0] mb-2">
                  {browserResetHint}
                </p>
                <button
                  onClick={requestLocation}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#B85C38] text-white hover:bg-[#6F60B0] transition-colors"
                >
                  Réessayer
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#171412] mb-1">
                  Recevez les offres quand vous êtes près
                </p>
                <p className="text-xs text-[#57504A] mb-3 leading-relaxed">
                  Quand vous passez près de la boutique, on peut vous envoyer une
                  petite attention. Aucune position n'est partagée avec d'autres :
                  seulement avec votre commerçant.
                </p>
                {errorMsg && (
                  <p className="text-xs text-[#B85C38] mb-2 flex items-center gap-1">
                    <AlertCircle size={12} /> {errorMsg}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={requestLocation}
                    disabled={state === 'working'}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-[#B85C38] text-white hover:bg-[#6F60B0] transition-colors disabled:opacity-50"
                  >
                    {state === 'working' ? 'Recherche…' : (
                      <>
                        <Check size={14} /> Activer la localisation
                      </>
                    )}
                  </button>
                  <button
                    onClick={dismiss}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#57504A] hover:bg-white/60 transition-colors"
                  >
                    Plus tard
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {inlineCard && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#171412] leading-relaxed">
              {state === 'denied'
                ? <>Localisation bloquée. <button onClick={requestLocation} className="underline text-[#6F60B0] font-medium">Réessayer</button></>
                : <>Activez la localisation pour recevoir les offres au bon moment. <button onClick={requestLocation} disabled={state === 'working'} className="underline text-[#6F60B0] font-medium disabled:opacity-50">Activer</button></>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
