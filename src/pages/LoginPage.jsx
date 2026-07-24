import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await login(formData);
      if (res.role === 'super_admin') navigate('/admin');
      else if (res.role === 'staff') navigate('/dashboard/scan');
      else if (res.role === 'business_owner') navigate('/modules');
      else if (res.role === 'comptable') navigate('/cabinet');
      else navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E7E5E4] w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-['Cormorant_Garamond'] text-3xl font-bold ft-gradient-text">FidéliTour</Link>
          <h2 className="text-2xl font-bold text-[#1C1917] mt-6">{t('auth.login_title')}</h2>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#57534E]">{t('auth.email')}</label>
            <input required type="email" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[#57534E]">{t('auth.password')}</label>
            <input required type="password" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <button type="submit" className="w-full bg-[#B85C38] text-white py-3 rounded-full font-medium hover:bg-[#9C4E2F] transition-colors mt-6">
            {t('auth.login_button')}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E7E5E4] text-center">
          <p className="text-[#57534E] text-sm mb-2">{t('auth.no_account')}</p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 w-full text-white px-5 py-3 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #B85C38 0%, #E8917C 100%)', boxShadow: '0 6px 18px -6px rgba(184,92,56,0.55)' }}
          >
            ✨ {t('auth.sign_up')}
          </Link>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
