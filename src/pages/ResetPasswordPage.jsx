import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { passwordRules, passwordValid } from '../lib/passwordPolicy';
import api from '../lib/api';

/**
 * ResetPasswordPage — /reinitialiser?token=…  (public)
 *
 * The landing point of the magic link. The token came by email, lives 30
 * minutes, works once. Same always-visible password rules + confirm as every
 * other password screen in the product — one ritual everywhere.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const rules = passwordRules(pwd);
  const matches = pwd.length > 0 && pwd === confirm;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/auth/reset-password', { token, new_password: pwd });
      setDone(true);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || 'Réinitialisation impossible.');
    } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <Shell>
        <p className="text-sm text-[#57534E]">
          Lien incomplet — ouvrez le lien reçu par email, ou redemandez-en un
          depuis la page de connexion.
        </p>
        <BackToLogin />
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-3xl mb-2">✓</div>
        <h1 className="text-xl font-bold text-[#1C1917] mb-1">Mot de passe changé</h1>
        <p className="text-sm text-[#57534E] mb-4">
          Vous pouvez vous connecter avec votre nouveau mot de passe.
        </p>
        <Link to="/login"
              className="inline-block w-full text-center text-white py-3 rounded-full font-medium"
              style={{ background: '#B85C38' }}>
          Se connecter
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-[#1C1917] mb-1">Nouveau mot de passe</h1>
      <p className="text-xs text-[#8B8680] mb-4">
        Ce lien est valable 30 minutes et ne peut servir qu'une fois.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {/* rules visible BEFORE typing; nodes keyed by state (translation bug) */}
        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.id + (pwd && r.ok ? '-ok' : '-no')} className="text-[11px] flex gap-2"
                style={{ color: pwd && r.ok ? '#2F7A52' : '#8B8680' }}>
              <span>{pwd && r.ok ? '✓' : '○'}</span>{r.label}
            </li>
          ))}
        </ul>
        <input type="password" autoFocus placeholder="Nouveau mot de passe"
               className="w-full border border-[#E7E5E4] rounded-lg p-3"
               value={pwd} onChange={(e) => setPwd(e.target.value)} />
        <input type="password" placeholder="Confirmez le mot de passe"
               className="w-full border border-[#E7E5E4] rounded-lg p-3"
               value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {confirm.length > 0 && (
          <div key={matches ? 'm-ok' : 'm-no'} className="text-[11px] font-semibold"
               style={{ color: matches ? '#2F7A52' : '#C0392B' }}>
            {matches ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
          </div>
        )}
        {err && <div className="text-sm" style={{ color: '#C0392B' }}>{err}</div>}
        <button type="submit" disabled={busy || !passwordValid(pwd) || !matches}
                className="w-full text-white py-3 rounded-full font-medium disabled:opacity-50"
                style={{ background: '#B85C38' }}>
          {busy ? '…' : 'Enregistrer'}
        </button>
      </form>
      <BackToLogin />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E7E5E4] w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

function BackToLogin() {
  return (
    <div className="text-center mt-4">
      <Link to="/login" className="text-xs text-[#B85C38] hover:underline">← Retour à la connexion</Link>
    </div>
  );
}
