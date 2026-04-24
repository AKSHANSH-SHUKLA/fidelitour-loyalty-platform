import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { publicAPI } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';

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

  const requestGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
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
      const res = await publicAPI.joinProgram(slug, payload);
      setSuccess(res.data);
    } catch (err) {
      alert('Error joining program');
    }
  };

  if (!tenant) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-['Manrope'] flex flex-col items-center py-20 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-md border border-[#E7E5E4]">
        <h1 className="font-['Cormorant_Garamond'] text-3xl font-bold text-center text-[#B85C38] mb-2">{tenant.name}</h1>
        <p className="text-center text-[#57534E] mb-8">Join our loyalty program</p>
        
        {success ? (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold text-[#4A5D23]">Welcome!</h2>
            <p className="text-[#57534E]">Your unique loyalty card is ready.</p>
            <div className="flex justify-center p-4 bg-white rounded-xl border border-[#E7E5E4]">
              <QRCodeSVG value={success.barcode_id} size={200} />
            </div>
            <p className="font-mono bg-gray-100 p-2 rounded">{success.barcode_id}</p>
            <div className="bg-[#E3A869]/20 text-[#1C1917] p-3 rounded-lg text-sm">
              Wallet passes are in simulation mode.
            </div>
            <div className="space-y-3">
              <Link
                to={`/card/${success.barcode_id}`}
                className="block text-center w-full bg-[#B85C38] text-white py-3 rounded-xl font-medium hover:bg-[#9C4E2F] transition-colors"
              >
                Ouvrir ma carte de fidélité →
              </Link>
              <button className="w-full bg-black text-white py-3 rounded-xl font-medium">Add to Apple Wallet</button>
              <button className="w-full bg-[#1C1917] text-white py-3 rounded-xl font-medium">Add to Google Wallet</button>
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
              <p className="text-sm font-medium text-[#1C1917] mb-2">📍 Share your location (optional)</p>
              <p className="text-xs text-[#57534E] mb-3">
                Helps us send more relevant offers from nearby businesses. Your location is never shared publicly.
              </p>
              {geoStatus === 'idle' && (
                <button
                  type="button"
                  onClick={requestGeolocation}
                  className="text-sm px-3 py-1.5 bg-white border border-[#B85C38] text-[#B85C38] rounded-lg font-medium hover:bg-[#B85C38] hover:text-white transition-colors"
                >
                  Share my location
                </button>
              )}
              {geoStatus === 'requesting' && <p className="text-xs text-[#57534E]">Requesting location…</p>}
              {geoStatus === 'granted' && (
                <p className="text-xs text-[#065F46] font-medium">
                  ✓ Location shared ({geoCoords.latitude.toFixed(3)}°, {geoCoords.longitude.toFixed(3)}°)
                </p>
              )}
              {geoStatus === 'denied' && <p className="text-xs text-[#92400E]">Permission denied. You can still join.</p>}
              {geoStatus === 'unsupported' && <p className="text-xs text-[#92400E]">Location not supported on this browser.</p>}
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
