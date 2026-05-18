import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { publicAPI } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import Code128Barcode from '../components/Code128Barcode';

const ALLOWED_SOURCES = ['qr_store', 'instagram', 'facebook', 'tiktok'];

// Accept common synonyms so a marketer can write `?src=ig` or `?utm_source=fb` etc.
const SOURCE_ALIASES = {
  qr: 'qr_store', qr_store: 'qr_store', store: 'qr_store', instore: 'qr_store', in_store: 'qr_store',
  ig: 'instagram', insta: 'instagram', instagram: 'instagram',
  fb: 'facebook', facebook: 'facebook', meta: 'facebook',
  tt: 'tiktok', tik: 'tiktok', tiktok: 'tiktok',
};

function resolveSourceFromUrl(searchParams) {
  // Accept ?src=, ?source=, ?utm_source= — first one wins
  const raw = (
    searchParams.get('src') ||
    searchParams.get('source') ||
    searchParams.get('utm_source') ||
    ''
  ).trim().toLowerCase().replace(/[^a-z_]/g, '');
  if (!raw) return null;
  const resolved = SOURCE_ALIASES[raw] || raw;
  return ALLOWED_SOURCES.includes(resolved) ? resolved : null;
}

// Multi-touch attribution. Every time the visitor lands on /join/<slug>
// with a ?src=... param, append it to a per-tenant list in localStorage.
// On submit, the full chain travels with the form so the owner can see
// "joined via QR, but originally found us on Instagram a week earlier."
const TOUCHPOINTS_KEY = (slug) => `ft_touchpoints_${slug}`;

const loadTouchpoints = (slug) => {
  try {
    const raw = localStorage.getItem(TOUCHPOINTS_KEY(slug));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_e) { return []; }
};

const recordTouchpoint = (slug, source) => {
  if (!source) return;
  try {
    const list = loadTouchpoints(slug);
    // Don't double-record the same source twice in a row (refresh, etc.).
    const last = list[list.length - 1];
    if (last && last.source === source) return;
    list.push({ source, ts: new Date().toISOString() });
    // Cap at 10 entries — anything older is statistical noise.
    while (list.length > 10) list.shift();
    localStorage.setItem(TOUCHPOINTS_KEY(slug), JSON.stringify(list));
  } catch (_e) { /* private mode etc — silent */ }
};

const clearTouchpoints = (slug) => {
  try { localStorage.removeItem(TOUCHPOINTS_KEY(slug)); } catch (_e) { /* ignore */ }
};

const JoinPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const lockedSource = useMemo(() => resolveSourceFromUrl(searchParams), [searchParams]);
  const [tenant, setTenant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    postal_code: '',
    birthday: '',
    acquisition_source: lockedSource || 'qr_store',
  });
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | requesting | granted | denied | unsupported
  const [geoCoords, setGeoCoords] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    publicAPI.getJoinInfo(slug).then(res => setTenant(res.data)).catch(console.error);
  }, [slug]);

  // Multi-touch attribution: record this URL's source the moment the page loads,
  // even if the visitor never submits. So when they finally fill the form a week
  // later (with maybe a different ?src=...), we still have the original touch.
  useEffect(() => {
    if (lockedSource) recordTouchpoint(slug, lockedSource);
  }, [slug, lockedSource]);

  // On mount, check the persisted permission state so we render the
  // right CTA without bothering the user with a prompt that's already
  // been answered. Without this, a "denied" user kept seeing the
  // "Share my location" button and clicking it gave them a useless
  // instant-denied error.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGeoStatus('unsupported'); return; }
    if (!navigator.permissions?.query) return;  // older browsers — fall through to live request
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' })
      .then((perm) => {
        if (cancelled) return;
        if (perm.state === 'granted') setGeoStatus('granted');
        else if (perm.state === 'denied') setGeoStatus('denied');
        // else 'prompt' — keep status as 'idle' so the button shows
        perm.onchange = () => { if (!cancelled) setGeoStatus(perm.state); };
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const requestGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    // If the user already denied permission in the past, the browser
    // won't show the prompt again — getCurrentPosition fires the error
    // callback immediately. Skip the call entirely and surface the
    // unblock instructions right away.
    if (geoStatus === 'denied') return;
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus('granted');
      },
      (err) => {
        // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT.
        // The first one is permanent until the user changes settings;
        // the other two we can recover from with a retry.
        if (err && err.code === 1) setGeoStatus('denied');
        else setGeoStatus('idle');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (geoCoords) {
        payload.latitude = geoCoords.latitude;
        payload.longitude = geoCoords.longitude;
      }
      // Attach the full touchpoint history. The first item is FIRST-touch
      // (e.g. Instagram) — preserved even when the customer signs up later
      // from a different source (e.g. in-store QR). The last item is
      // LAST-touch (the URL they actually submitted from).
      const chain = loadTouchpoints(slug);
      // Belt-and-braces: if the visitor's CURRENT URL has a ?src= we haven't
      // recorded yet (e.g. they never refreshed), inject it.
      if (lockedSource && (!chain.length || chain[chain.length - 1].source !== lockedSource)) {
        chain.push({ source: lockedSource, ts: new Date().toISOString() });
      }
      // And if they manually picked a source from the dropdown that disagrees
      // with what we tracked, record it too — multi-touch with both signals.
      if (formData.acquisition_source && (!chain.length || chain[chain.length - 1].source !== formData.acquisition_source)) {
        chain.push({ source: formData.acquisition_source, ts: new Date().toISOString() });
      }
      payload.touchpoints_history = chain;
      const res = await publicAPI.joinProgram(slug, payload);
      clearTouchpoints(slug);  // chain has been persisted server-side, no need to keep it here
      setSuccess(res.data);
    } catch (err) {
      alert('Error joining program');
    }
  };

  if (!tenant) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-['Manrope'] flex flex-col items-center py-20 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-md border border-[#E7E5E4]">
        <h1 className="font-['Cormorant_Garamond'] text-3xl font-bold text-center mb-2 ft-gradient-text-slow">{tenant.name}</h1>
        <p className="text-center text-[#57534E] mb-8">Rejoignez notre programme de fidélité</p>
        
        {success ? (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold text-[#4A5D23]">Welcome!</h2>
            <p className="text-[#57534E]">Your unique loyalty card is ready.</p>
            <div className="p-4 bg-white rounded-xl border border-[#E7E5E4] space-y-3">
              <div className="flex justify-center">
                <QRCodeSVG value={success.barcode_id} size={200} level="M" />
              </div>
              <Code128Barcode value={success.barcode_id} height={60} barWidth={2.2} fontSize={14} />
            </div>
            <p className="font-mono bg-gray-100 p-2 rounded">{success.barcode_id}</p>
            <div className="space-y-3">
              <Link
                to={`/card/${success.barcode_id}`}
                className="block text-center w-full bg-[#B85C38] text-white py-3 rounded-xl font-medium hover:bg-[#9C4E2F] transition-colors"
              >
                Ouvrir ma carte de fidélité →
              </Link>
              <p className="text-xs text-center text-[#8B8680] pt-2">
                Une fois la carte ouverte, vous pouvez la partager, l'épingler à
                votre écran d'accueil, ou l'imprimer.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#57534E]">Full Name</label>
              <input required type="text" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#57534E]">Email</label>
              <input required type="email" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#57534E]">Phone</label>
              <input required type="tel" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[#57534E]">Postal Code</label>
                <input required type="text" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.postal_code} onChange={e => setFormData({...formData, postal_code: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[#57534E]">Birthday</label>
                <input required type="text" placeholder="MM-DD" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} />
              </div>
            </div>
            {lockedSource ? (
              // Source was deterministically tagged by the landing URL
              // (e.g. /join/<slug>?src=instagram). We hide the picker
              // entirely so it can't be changed — attribution stays clean.
              <input type="hidden" value={formData.acquisition_source} readOnly />
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1 text-[#57534E]">How did you hear about us? (optional)</label>
                <select className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.acquisition_source} onChange={e => setFormData({...formData, acquisition_source: e.target.value})}>
                  <option value="qr_store">📱 QR code in the store</option>
                  <option value="instagram">📸 Instagram</option>
                  <option value="facebook">👥 Facebook</option>
                  <option value="tiktok">🎵 TikTok</option>
                </select>
              </div>
            )}
            <div className="p-3 rounded-lg border border-[#E7E5E4] bg-[#F3EFE7]">
              <p className="text-sm font-medium text-[#1C1917] mb-2">📍 Partagez votre position (optionnel)</p>
              <p className="text-xs text-[#57534E] mb-3">
                Nous permet de vous envoyer des offres pertinentes près de chez vous. Votre position n'est jamais publiée.
              </p>
              {geoStatus === 'idle' && (
                <button
                  type="button"
                  onClick={requestGeolocation}
                  className="text-sm px-3 py-1.5 bg-white border border-[#B85C38] text-[#B85C38] rounded-lg font-medium hover:bg-[#B85C38] hover:text-white transition-colors"
                >
                  Partager ma position
                </button>
              )}
              {geoStatus === 'requesting' && <p className="text-xs text-[#57534E]">Demande de position en cours…</p>}
              {geoStatus === 'granted' && (
                <p className="text-xs text-[#065F46] font-medium">
                  ✓ Position partagée ({geoCoords.latitude.toFixed(3)}°, {geoCoords.longitude.toFixed(3)}°)
                </p>
              )}
              {geoStatus === 'denied' && (
                <div className="text-xs text-[#92400E] space-y-2">
                  <p className="font-medium">⚠ Permission bloquée par votre navigateur.</p>
                  <p>
                    Vous pouvez quand même vous inscrire — la position est facultative.
                    Pour la réactiver plus tard, suivez les étapes selon votre appareil :
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      <strong>iPhone (Safari)</strong> : Réglages → Safari → Position →
                      autoriser pour ce site. Puis recharger cette page.
                    </li>
                    <li>
                      <strong>Android (Chrome)</strong> : tapez le 🔒 dans la barre
                      d'adresse → Autorisations → Position → Autoriser.
                      Rechargez ensuite la page.
                    </li>
                    <li>
                      <strong>Ordinateur</strong> : cliquez sur le 🔒 dans la barre
                      d'adresse → Position → Autoriser → recharger.
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-1 text-[#B85C38] underline"
                  >
                    Recharger la page après l'avoir autorisée
                  </button>
                </div>
              )}
              {geoStatus === 'unsupported' && <p className="text-xs text-[#92400E]">Géolocalisation non supportée par ce navigateur.</p>}
            </div>

            <button type="submit" className="w-full bg-[#B85C38] text-white py-3 rounded-full font-medium hover:bg-[#9C4E2F] transition-colors mt-6">
              Join Program
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default JoinPage;
