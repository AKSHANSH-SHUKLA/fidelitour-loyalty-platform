import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, User, Mail, Lock, Phone, MapPin, Coffee, ArrowRight } from 'lucide-react';
import {
  passwordRules, passwordValid, passwordStrength,
  STRENGTH_LABELS, STRENGTH_COLORS,
} from '../lib/passwordPolicy';

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
 *
 * Every visible string flows through `react-i18next` so the form follows
 * the language selected in Settings (FR / EN / AR).
 */
const SECTOR_KEYS = [
  { value: 'cafe',       i18nKey: 'auth.sector_cafe' },
  { value: 'restaurant', i18nKey: 'auth.sector_restaurant' },
  { value: 'pizzeria',   i18nKey: 'auth.sector_pizzeria' },
  { value: 'bakery',     i18nKey: 'auth.sector_bakery' },
  { value: 'bar',        i18nKey: 'auth.sector_bar' },
  { value: 'spa',        i18nKey: 'auth.sector_spa' },
  { value: 'salon',      i18nKey: 'auth.sector_salon' },
  { value: 'gym',        i18nKey: 'auth.sector_gym' },
  { value: 'retail',     i18nKey: 'auth.sector_retail' },
  { value: 'other',      i18nKey: 'auth.sector_other' },
];

// IconField — flex-based input row with the icon in its own column.
//
// Why this exists: the previous design overlaid an absolute-positioned
// icon on top of an input with extra left padding, and the icon kept
// bleeding into the placeholder text no matter how much padding was
// applied. Stroke icons on Retina, browser-specific rendering, font
// sub-pixel positioning — too many variables.
//
// This rebuild puts the icon in its OWN flex column with a vertical
// divider. The input is the next flex item. Geometrically impossible
// for them to overlap, regardless of icon size, browser, or zoom level.
function IconField({ icon: Icon, children }) {
  return (
    <div className="flex items-stretch border border-[#E7E5E4] rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#B85C38]/20 focus-within:border-[#B85C38] transition">
      <div
        className="flex items-center justify-center px-3 text-[#B85C38] bg-[#FAF5F2] border-r border-[#E7E5E4] shrink-0"
        style={{ width: 44 }}
        aria-hidden="true"
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// Input/select className used inside IconField. No left padding — the
// icon column handles spacing. No border — the parent IconField owns
// the border and focus ring.
const INNER_INPUT =
  'w-full px-3 py-3 text-sm bg-transparent outline-none placeholder:text-[#A8A29E]';

const RegisterPage = () => {
  const { t } = useTranslation();
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

  // Live password feedback (S3 policy) — recomputed on each keystroke.
  const pwRules = passwordRules(formData.password);
  const pwStrength = passwordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Lightweight client-side validation — clearer than waiting for the API
    if (!formData.business_name.trim()) return setError(t('auth.business_name_required'));
    if (!formData.email.trim())         return setError(t('auth.email_required'));
    // S3 password policy — the same rules the server enforces. Checked here so
    // the user gets the message instantly instead of after a round-trip.
    if (!passwordValid(formData.password)) {
      const missing = passwordRules(formData.password).filter((r) => !r.ok).map((r) => r.label);
      return setError(`Mot de passe trop faible — il manque : ${missing.join(', ')}.`);
    }

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
      const detail = err?.response?.data?.detail || err?.message || t('auth.register_failed');
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
            {t('auth.register_title')}
          </h2>
          <p className="text-[#57534E] mt-1 text-sm">
            {t('auth.register_subtitle')}
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
              {t('auth.your_company')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Business name */}
              <div className="md:col-span-2">
                <IconField icon={Building2}>
                  <input required type="text" placeholder={t('auth.business_name_placeholder')}
                         className={INNER_INPUT} value={formData.business_name} onChange={set('business_name')} />
                </IconField>
              </div>
              {/* Sector */}
              <IconField icon={Coffee}>
                <select className={INNER_INPUT + ' appearance-none cursor-pointer pr-10'}
                        value={formData.sector} onChange={set('sector')}>
                  {SECTOR_KEYS.map((s) => (
                    <option key={s.value} value={s.value}>{t(s.i18nKey)}</option>
                  ))}
                </select>
              </IconField>
              {/* Postal code */}
              <IconField icon={MapPin}>
                <input type="text" inputMode="numeric" maxLength="5" placeholder={t('auth.postal_code_placeholder')}
                       className={INNER_INPUT} value={formData.postal_code} onChange={set('postal_code')} />
              </IconField>
            </div>
          </div>

          {/* SECTION 2 — Account */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B8680] mb-2 mt-2">
              {t('auth.your_account')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Owner name */}
              <div className="md:col-span-2">
                <IconField icon={User}>
                  <input type="text" placeholder={t('auth.owner_name_placeholder')}
                         className={INNER_INPUT} value={formData.owner_name} onChange={set('owner_name')} />
                </IconField>
              </div>
              {/* Email */}
              <IconField icon={Mail}>
                <input required type="email" placeholder={t('auth.email_pro_placeholder')}
                       className={INNER_INPUT} value={formData.email} onChange={set('email')} />
              </IconField>
              {/* Phone */}
              <IconField icon={Phone}>
                <input type="tel" placeholder={t('auth.phone_optional_placeholder')}
                       className={INNER_INPUT} value={formData.phone} onChange={set('phone')} />
              </IconField>
              {/* Password — with a live rule checklist (S3 policy).
                  Rules appear only once typing starts, so the form never scolds
                  someone before they have had a chance. */}
              <div className="md:col-span-2">
                <IconField icon={Lock}>
                  <input required type="password" placeholder="Mot de passe (10 caractères minimum)"
                         className={INNER_INPUT} value={formData.password} onChange={set('password')} />
                </IconField>
                {formData.password.length > 0 && (
                  <div className="mt-2.5 px-1">
                    {/* strength bar */}
                    <div className="flex gap-1 mb-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-1.5 flex-1 rounded-full transition-colors"
                             style={{ background: i < pwStrength ? STRENGTH_COLORS[pwStrength] : '#EFE9E0' }} />
                      ))}
                    </div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: STRENGTH_COLORS[pwStrength] }}>
                      {STRENGTH_LABELS[pwStrength]}
                    </div>
                    {/* live checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      {pwRules.map((r) => (
                        <div key={r.id} className="flex items-center gap-1.5 text-[11px]"
                             style={{ color: r.ok ? '#2F7A52' : '#8B8680' }}>
                          <span className="w-3.5 text-center">{r.ok ? '✓' : '○'}</span>
                          {r.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
                  className="w-full text-white py-3.5 rounded-full font-semibold text-sm mt-6 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #B85C38 0%, #E8917C 100%)', boxShadow: '0 8px 22px -8px rgba(184,92,56,0.55)' }}>
            {loading ? t('auth.creating') : <>{t('auth.create_account')} <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-center mt-6 text-[#57534E] text-sm">
          {t('auth.have_account')}{' '}
          <Link to="/login" className="text-[#B85C38] font-semibold hover:underline">{t('auth.sign_in')}</Link>
        </p>
      </div>
    </div>
  );
};
export default RegisterPage;
