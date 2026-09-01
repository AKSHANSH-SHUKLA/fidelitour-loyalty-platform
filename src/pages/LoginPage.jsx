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
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

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
    <div className="min-h-screen bg-[var(--canvas,_#F1F5FA)] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-[var(--border,_#ECEFF4)] w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-['Cormorant_Garamond'] text-3xl font-bold ft-gradient-text">FidéliTour</Link>
          <h2 className="text-2xl font-bold text-[var(--ink-head,_#030E1D)] mt-6">{t('auth.login_title')}</h2>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--ink-body,_#556272)]">{t('auth.email')}</label>
            <input required type="email" className="w-full border border-[var(--border-strong,_#CBD3DC)] rounded-lg p-3 focus:ring-[#0F6FDE]/20 focus:border-[var(--blue,_#0F6FDE)]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--ink-body,_#556272)]">{t('auth.password')}</label>
            <input required type="password" className="w-full border border-[var(--border-strong,_#CBD3DC)] rounded-lg p-3 focus:ring-[#0F6FDE]/20 focus:border-[var(--blue,_#0F6FDE)]" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          {/* Forgot password — honest v1. Email-based reset needs a mail
              provider (S3 backlog); until then this panel routes each kind of
              user to the recovery path that ALREADY works, instead of a dead
              link or a fake "check your inbox". */}
          <div className="text-right">
            <button type="button" onClick={() => setShowForgot(!showForgot)}
                    className="text-xs font-medium text-[var(--blue-deep,_#1453BD)] hover:underline">
              Mot de passe oublié ?
            </button>
          </div>
          {showForgot && (
            <div className="rounded-xl border p-3 text-xs space-y-2"
                 style={{ borderColor: 'var(--border, #ECEFF4)', background: 'var(--surface-2, #F8F9FC)', color: 'var(--ink-body, #556272)' }}>
              <div>
                <span className="font-semibold text-[var(--ink-head,_#030E1D)]">Employé d'un cabinet ?</span>{' '}
                Demandez à votre expert-comptable : page Équipe → « Réinitialiser MDP ».
                Vous recevrez un mot de passe temporaire à changer à la connexion.
              </div>
              <div>
                <span className="font-semibold text-[var(--ink-head,_#030E1D)]">Employé d'un commerce ?</span>{' '}
                Votre gérant peut recréer votre accès depuis ses Paramètres.
              </div>
              <div>
                <span className="font-semibold text-[var(--ink-head,_#030E1D)]">Gérant ou expert-comptable ?</span>{' '}
                Recevez un lien de réinitialisation par email (valable 30 min) :
                {resetSent ? (
                  <div key="reset-sent" className="mt-1.5 font-semibold" style={{ color: 'var(--green-deep, #087A31)' }}>
                    ✓ Si un compte existe pour cette adresse, l'email est parti — vérifiez
                    votre boîte (et les spams).
                  </div>
                ) : (
                  <div className="flex gap-1.5 mt-1.5">
                    <input type="email" value={resetEmail}
                           onChange={(e) => setResetEmail(e.target.value)}
                           placeholder="votre@email.fr"
                           className="flex-1 border border-[var(--border-strong,_#CBD3DC)] rounded-lg px-2 py-1.5 text-xs" />
                    <button type="button"
                            disabled={!resetEmail.includes('@')}
                            onClick={async () => {
                              try {
                                const api = (await import('../lib/api')).default;
                                await api.post('/auth/forgot-password', { email: resetEmail });
                              } catch (e) { /* neutral by design */ }
                              setResetSent(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-40"
                            style={{ background: 'var(--blue, #0F6FDE)' }}>
                      Envoyer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-[var(--blue,_#0F6FDE)] text-white py-3 rounded-full font-medium hover:bg-[var(--blue-pressed,_#0D62C4)] transition-colors mt-6">
            {t('auth.login_button')}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[var(--border,_#ECEFF4)] text-center">
          <p className="text-[var(--ink-body,_#556272)] text-sm mb-2">{t('auth.no_account')}</p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 w-full text-white px-5 py-3 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, var(--blue, #0F6FDE) 0%, var(--blue-deep, #1453BD) 100%)', boxShadow: '0 6px 18px -6px rgba(15,111,222,0.45)' }}
          >
            ✨ {t('auth.sign_up')}
          </Link>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
