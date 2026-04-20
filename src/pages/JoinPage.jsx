import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';

const JoinPage = () => {
  const { slug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', postal_code: '', birthday: '', acquisition_source: 'qr_store' });
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    publicAPI.getJoinInfo(slug).then(res => setTenant(res.data)).catch(console.error);
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await publicAPI.joinProgram(slug, formData);
      setSuccess(res.data);
    } catch (err) {
      alert("Error joining program");
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
            <div>
              <label className="block text-sm font-medium mb-1 text-[#57534E]">How did you hear about us? (optional)</label>
              <select className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.acquisition_source} onChange={e => setFormData({...formData, acquisition_source: e.target.value})}>
                <option value="">Select...</option>
                <option value="qr_store">📱 QR code in the store</option>
                <option value="instagram">📸 Instagram</option>
                <option value="tiktok">🎵 TikTok</option>
                <option value="facebook">👥 Facebook</option>
                <option value="website">🌐 Website</option>
                <option value="friend">💬 A friend told me</option>
                <option value="other">✨ Somewhere else</option>
              </select>
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
