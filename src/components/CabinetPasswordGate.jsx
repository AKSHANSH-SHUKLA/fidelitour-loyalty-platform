import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { cabinetOsAPI } from '../lib/api';
import { passwordRules } from '../lib/passwordPolicy';
import LiveText from './LiveText';

/**
 * CabinetPasswordGate — first-login password change for cabinet employees.
 *
 * WHY THIS EXISTS
 *   The admin (Rousseau) creates Léa's account and hands her the password by
 *   whatever channel — SMS, verbal, a sticky note. That password is therefore
 *   KNOWN TO SOMEONE ELSE from the moment it exists. Any action Léa takes with
 *   it is technically deniable ("Rousseau knew my password"), which destroys
 *   the value of the audit log.
 *
 *   So the account is usable exactly once: to set a password only Léa knows.
 *   Everything else is blocked behind this screen until she does.
 *
 * WHY IT'S A WRAPPER AND NOT A ROUTE
 *   A route can be skipped by typing a different URL. A wrapper around every
 *   cabinet page cannot. Enforcement lives on the server too (the membership
 *   still carries must_change_password), this is just the honest front door.
 */
export default function CabinetPasswordGate({ children }) {
  const [state, setState] = useState('checking'); // checking | forced | ok
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cabinetOsAPI.me()
      .then((r) => setState(r?.data?.membership?.must_change_password ? 'forced' : 'ok'))
      // No membership at all = legacy comptable account (email-linked, pre-S5).
      // Those still work, so failing open here is correct, not lazy.
      .catch(() => setState('ok'));
  }, []);

  const rules = passwordRules(pwd);
  const allOk = rules.every((r) => r.ok);
  const matches = pwd.length > 0 && pwd === confirm;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await cabinetOsAPI.changePassword({ new_password: pwd });
      setState('ok');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Changement impossible.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'checking') return null;
  if (state === 'ok') return children;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'radial-gradient(1200px 500px at 85% -10%, rgba(107,46,90,.08), transparent 60%), #FBF7EF',
    }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white border p-6"
            style={{ borderColor: '#E9E5E0' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
             style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
          <KeyRound size={18} color="#fff" />
        </div>
        <LiveText as="h1" className="text-xl font-extrabold text-[#171412]">
          Choisissez votre mot de passe
        </LiveText>
        <LiveText as="p" className="text-sm text-[#57504A] mt-1 mb-5">
          Votre compte a été créé par votre cabinet. Pour que vos actions vous soient
          attribuées de façon fiable, choisissez un mot de passe que vous seul connaissez.
        </LiveText>

        {/* Rules are visible BEFORE typing: a rule you discover only after failing
            is a trap, not a rule. */}
        <ul className="mb-4 space-y-1">
          {rules.map((r) => (
            <li key={r.id + (r.ok ? '-ok' : '-no')} className="text-[12px] flex items-center gap-2"
                style={{ color: r.ok ? '#2F7A52' : '#8D857D' }}>
              <span>{r.ok ? '✓' : '○'}</span>
              <LiveText>{r.label}</LiveText>
            </li>
          ))}
        </ul>

        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
               placeholder="Nouveau mot de passe" autoFocus className="fld w-full mb-2" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
               placeholder="Confirmez le mot de passe" className="fld w-full" />
        {confirm.length > 0 && !matches && (
          <LiveText as="div" className="text-[12px] mt-1.5" style={{ color: '#C0392B' }}>
            Les deux mots de passe ne correspondent pas.
          </LiveText>
        )}
        {error && (
          <LiveText as="div" className="text-[12px] mt-2" style={{ color: '#C0392B' }}>{error}</LiveText>
        )}

        <button type="submit" disabled={busy || !allOk || !matches}
                className="w-full mt-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
          {busy ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>

        <style>{`.fld{border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#171412;background:#FCFAF5;outline:none}.fld:focus{border-color:#7A3E70}`}</style>
      </form>
    </div>
  );
}
