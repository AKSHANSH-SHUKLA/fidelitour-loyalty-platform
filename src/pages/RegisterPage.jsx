import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, User, Mail, Lock, Phone, MapPin, Coffee, ArrowRight } from 'lucide-react';

/**
 * RegisterPage — proper multi-field business signup.
 *
 * Asks for: business name, sector, owner name, email, password, phone,
 * postal code. Backend now accepts all of these on /api/auth/register and
 * stamps the tenant doc with sensible defaults so the dashboard greets
 * the user with their real business name from the first second.
 *
 * After a successful create, we auto-login (so the user lands directly on
 * the dashboard instead of being bounced to /login to type the same
 * credentials again).
 */
const SECTORS = [
  { value: 'cafe',       label: '☕ Café / salon de thé' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'pizzeria',   label: '🍕 Pizzeria' },
  { value: 'bakery',     label: '🥐 Boulangerie / pâtisserie' },
  { value: 'bar',        label: '🍷 Bar / cave à vin' },
  { value: 'spa',        label: '💆 Spa / institut de beauté' },
  { value: 'salon',      label: '✂️ Salon de coiffure' },
  { value: 'gym',        label: '💪 Salle de sport' },
  { value: 'retail',     label: '🛍️ Boutique / commerce' },
  { value: 'other',      label: '📌 Autre' },
];

const FIELD_BASE =
  'w-full border border-[#E7E5E4] rounded-xl pl-11 pr-4 py-3 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#B85C38]/20 focus:border-[#B85C38] ' +
  'placeholder:text-[#A8A29E] transition';

const RegisterPage = () => {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    business_name: '',
    sector: 'cafe',
    owner_name: '',
    email: '',
    password: '',
    phone: '',
    postal_code: '',
    role: 'business_owner',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setFormData({ ...formData, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Lightweight client-side validation — clearer than waiting for the API
    if (!formData.business_name.trim()) return setError('Le nom de l\'entreprise est requis.');
    if (!formData.email.trim())         return setError('Email requis.');
    if (formData.password.length < 6)   return setError('Mot de passe trop court (6 caractères minimum).');

    setLoading(true);
    try {
      await register(formData);
      // Auto-login so the new user lands directly on /dashboard.
      try {
        const me = await login({ email: formData.email, password: formData.password });
        if (me?.role === 'staff')      navigate('/dashboard/scan');
        else if (me?.role === 'super_admin') navigate('/admin');
        else                            navigate('/dashboard');
      } catch (_e) {
        // Fall back to manual login if auto-login fails
        navigate('/login');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Inscription échouée.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'radial-gradient(circle at 30% 0%, #FCE3DC 0%, transparent 50%), radial-gradient(circle at 100% 100%, #FDE7C7 0%, transparent 60%), #FDFBF7' }}>
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-[#E7E5E4] w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="font-['Cormorant_Garamond'] text-3xl font-bold ft-gradient-text">
            FidéliTour
          </Link>
          <h2 className="text-3xl font-bold text-[#1C1917] mt-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Créez votre programme de fidélité
          </h2>
          <p className="text-[#57534E] mt-1 text-sm">
            ✨ Essai gratuit 30 jours · Aucune carte bancaire · Mise en place en 2 minutes
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl text-sm mb-4">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SECTION 1 — Business identity */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B8680] mb-2">
              Votre entreprise
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Business name */}
              <div className="relative md:col-span-2">
                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38]" />
                <input required type="text" placeholder="Nom de l'entreprise · ex. Café Lumière"
                       className={FIELD_BASE} value={formData.business_name} onChange={set('business_name')} />
              </div>
              {/* Sector */}
              <div className="relative">
                <Coffee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38] z-10" />
                <select className={FIELD_BASE + ' appearance-none cursor-pointer'} value={formData.sector} onChange={set('sector')}>
                  {SECTORS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* Postal code */}
              <div className="relative">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38]" />
                <input type="text" inputMode="numeric" maxLength="5" placeholder="Code postal · ex. 37000"
                       className={FIELD_BASE} value={formData.postal_code} onChange={set('postal_code')} />
              </div>
            </div>
          </div>

          {/* SECTION 2 — Account */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B8680] mb-2 mt-2">
              Votre compte
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Owner name */}
              <div className="relative md:col-span-2">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38]" />
                <input type="text" placeholder="Votre nom · ex. Marie Dupont"
                       className={FIELD_BASE} value={formData.owner_name} onChange={set('owner_name')} />
              </div>
              {/* Email */}
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38]" />
                <input required type="email" placeholder="Email professionnel"
                       className={FIELD_BASE} value={formData.email} onChange={set('email')} />
              </div>
              {/* Phone */}
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38]" />
                <input type="tel" placeholder="Téléphone (optionnel)"
                       className={FIELD_BASE} value={formData.phone} onChange={set('phone')} />
              </div>
              {/* Password */}
              <div className="relative md:col-span-2">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B85C38]" />
                <input required type="password" placeholder="Mot de passe (6 caractères minimum)"
                       className={FIELD_BASE} value={formData.password} onChange={set('password')} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
                  className="w-full text-white py-3.5 rounded-full font-semibold text-sm mt-6 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #B85C38 0%, #E8917C 100%)', boxShadow: '0 8px 22px -8px rgba(184,92,56,0.55)' }}>
            {loading ? 'Création en cours…' : <>Créer mon compte <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-center mt-6 text-[#57534E] text-sm">
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="text-[#B85C38] font-semibold hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
};
export default RegisterPage;
