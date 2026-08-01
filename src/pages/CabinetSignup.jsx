import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { cabinetOsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { passwordRules, passwordValid } from '../lib/passwordPolicy';

/**
 * CabinetSignup — the front door for a NEW cabinet (route: /cabinet/inscription).
 *
 * WHO CREATES WHOM
 *   Nobody hands a cabinet its account. The founding expert-comptable creates
 *   it here, exactly like registering any SaaS — then creates every employee
 *   account personally from the Équipe page (founder decision: direct account
 *   creation, no invite links). This page therefore only ever creates ONE kind
 *   of account: the founding EC.
 *
 * WHY ASK THE ORDRE NUMBER AT SIGNUP
 *   Signing (attestation-level acts) is gated on role AND a registration
 *   number on file. Asking now — clearly marked optional — saves the EC from
 *   discovering a blocked signature at the worst possible moment later.
 */
export default function CabinetSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: '', full_name: '', email: '', ordre_number: '', siren: '',
    password: '', confirm: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const rules = passwordRules(form.password);
  const matches = form.password.length > 0 && form.password === form.confirm;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.name.trim()) return setErr('Le nom du cabinet est obligatoire.');
    if (!passwordValid(form.password)) return setErr('Le mot de passe ne respecte pas encore toutes les règles.');
    if (!matches) return setErr('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      await cabinetOsAPI.signup(payload);
      await login({ email: form.email, password: form.password });
      navigate('/cabinet');
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Création impossible — vérifiez les champs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{
      background: 'radial-gradient(1200px 500px at 85% -10%, rgba(107,46,90,.08), transparent 60%), #FBF7EF',
    }}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white border p-7"
            style={{ borderColor: '#ECE3D2' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
             style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
          <Building2 size={18} color="#fff" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#1C1917]">Créer mon espace cabinet</h1>
        <p className="text-sm text-[#57534E] mt-1 mb-6">
          Vous créez le compte de l'expert-comptable fondateur. Ensuite, vous créerez
          vous-même les comptes de vos collaborateurs depuis la page Équipe.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="lbl">Nom du cabinet *</span>
            <input className="fld" value={form.name} onChange={set('name')}
                   placeholder="Cabinet Rousseau & Associés" />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="lbl">Votre nom</span>
              <input className="fld" value={form.full_name} onChange={set('full_name')}
                     placeholder="Paul Rousseau" />
            </label>
            <label className="block">
              <span className="lbl">SIREN du cabinet (optionnel)</span>
              <input className="fld" value={form.siren} onChange={set('siren')}
                     placeholder="552100554" maxLength={9} />
            </label>
          </div>
          <label className="block">
            <span className="lbl">Email professionnel *</span>
            <input className="fld" type="email" value={form.email} onChange={set('email')}
                   placeholder="p.rousseau@cabinet.fr" />
          </label>
          <label className="block">
            <span className="lbl">N° d'inscription à l'Ordre (optionnel)</span>
            <input className="fld" value={form.ordre_number} onChange={set('ordre_number')}
                   placeholder="140002200" />
            <span className="text-[10px] text-[#A8A29E]">
              Nécessaire pour signer (attestation, lettre de mission). Ajoutable plus tard.
            </span>
          </label>

          <label className="block">
            <span className="lbl">Mot de passe *</span>
            <input className="fld" type="password" value={form.password} onChange={set('password')} />
            {/* Rules visible BEFORE typing; nodes keyed by state so translated
                browsers re-translate on every flip (stale-translation bug). */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
              {rules.map((r) => (
                <div key={r.id + (form.password && r.ok ? '-ok' : '-no')} className="text-[10px]"
                     style={{ color: form.password && r.ok ? '#2F7A52' : '#8B8680' }}>
                  {form.password && r.ok ? '✓' : '○'} {r.label}
                </div>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="lbl">Confirmer le mot de passe *</span>
            <input className="fld" type="password" value={form.confirm} onChange={set('confirm')} />
            {form.confirm.length > 0 && (
              <div key={matches ? 'm-ok' : 'm-no'} className="text-[11px] font-semibold mt-1"
                   style={{ color: matches ? '#2F7A52' : '#C0392B' }}>
                {matches ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
              </div>
            )}
          </label>
        </div>

        {err && <div className="text-sm mt-4" style={{ color: '#C0392B' }}>{err}</div>}

        <button type="submit" disabled={busy || !form.email || !passwordValid(form.password) || !matches}
                className="w-full mt-5 py-3 rounded-2xl text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
          {busy ? 'Création…' : <>Créer le cabinet <ArrowRight size={16} /></>}
        </button>

        <div className="text-xs text-[#8B8680] text-center mt-4">
          Déjà un compte ? <Link to="/login" className="font-semibold" style={{ color: '#7A3E70' }}>Se connecter</Link>
        </div>

        <style>{`.lbl{font-size:12px;font-weight:500;color:#57534E}.fld{width:100%;border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#1C1917;background:#FCFAF5;outline:none;margin-top:4px}.fld:focus{border-color:#7A3E70}`}</style>
      </form>
    </div>
  );
}
