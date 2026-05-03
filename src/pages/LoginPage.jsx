import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage = () => {
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
          <h2 className="text-2xl font-bold text-[#1C1917] mt-6">Bon retour parmi nous</h2>
          <p className="text-[#57534E]">Connectez-vous pour accéder à votre tableau de bord</p>
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#57534E]">Email</label>
            <input required type="email" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[#57534E]">Password</label>
            <input required type="password" className="w-full border border-[#E7E5E4] rounded-lg p-3 focus:ring-[#B85C38]/20 focus:border-[#B85C38]" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <button type="submit" className="w-full bg-[#B85C38] text-white py-3 rounded-full font-medium hover:bg-[#9C4E2F] transition-colors mt-6">
            Sign In
          </button>
        </form>
        
        <p className="text-center mt-6 text-[#57534E] text-sm">
          Don't have an account? <Link to="/register" className="text-[#B85C38] font-medium hover:underline">Start free trial</Link>
        </p>
      </div>
    </div>
  );
};
export default LoginPage;
