import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, UserPlus, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cabinetOsAPI, comptableAPI } from '../lib/api';
import LiveText from '../components/LiveText';
import { passwordRules, passwordValid } from '../lib/passwordPolicy';

/**
 * CabinetTeam — the firm's people, their workload, and who owns which dossier.
 *
 * WHY THE WORKLOAD COLUMN MATTERS
 *   Every number here is derived from the data (assigned dossiers, open cases),
 *   never from something a person has to report. Nobody fills in a timesheet;
 *   working IS the report. That is the whole reason the audit log exists.
 *
 * ACCOUNT CREATION
 *   The admin sets an initial password and shares it themselves (founder
 *   decision). It is safe because the employee MUST change it on first login —
 *   after which the admin no longer knows their working password, which is what
 *   keeps "Léa validated this" actually meaning Léa.
 */

// Roles v2 (S8) — a responsibility CHAIN (produce → validate → sign), not a
// permission ladder. "admin" is kept as an alias so pre-migration rows render.
const ROLE_LABELS = {
  expert_comptable: { label: 'Expert-comptable', hint: 'Voit tout · valide · seul à pouvoir signer (n° Ordre requis)', c: '#7A3E70', bg: 'rgba(122,62,112,.12)' },
  admin: { label: 'Expert-comptable', hint: 'Voit tout · valide · seul à pouvoir signer', c: '#7A3E70', bg: 'rgba(122,62,112,.12)' },
  superviseur: { label: 'Superviseur', hint: 'Chef de mission — voit tout, valide, attribue · ne signe pas', c: '#2F7A52', bg: 'rgba(63,156,107,.12)' },
  collaborateur: { label: 'Collaborateur', hint: 'Ses dossiers · produit et valide sous seuil', c: '#2F6FB3', bg: 'rgba(47,111,179,.12)' },
  assistant: { label: 'Assistant', hint: 'Ses dossiers · produit (saisie, lettrage), ne valide pas', c: '#B8860B', bg: 'rgba(184,134,11,.12)' },
  agent: { label: 'Agent FidClic', hint: 'Produit seulement — chaque action passe en revue humaine', c: '#57534E', bg: 'rgba(87,83,78,.12)' },
};

const DOMAIN_LABELS = { compta: 'Compta', social: 'Paie', juridique: 'Juridique' };

export default function CabinetTeam() {
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [clients, setClients] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const [t, c, u] = await Promise.all([
      cabinetOsAPI.team().catch(() => null),
      comptableAPI.clients().catch(() => null),
      cabinetOsAPI.unassigned().catch(() => null),
    ]);
    setTeam(t?.data || null);
    setClients(c?.data?.clients || []);
    setUnassigned(u?.data?.dossiers || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (ok, msg) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 6000);
  };

  const changeMember = async (id, patch, label) => {
    setBusy(id);
    try {
      const r = await cabinetOsAPI.updateMember(id, patch);
      const freed = r.data?.dossiers_unassigned;
      flash(true, label + (freed ? ` — ${freed} dossier(s) placé(s) en « Non assignés ».` : ''));
      await load();
    } catch (e) {
      flash(false, e?.response?.data?.detail || 'Action impossible.');
    } finally { setBusy(null); }
  };

  const assign = async (tenantId, membershipId) => {
    setBusy(tenantId);
    try {
      await cabinetOsAPI.assign(tenantId, membershipId || null);
      await load();
    } catch (e) {
      flash(false, e?.response?.data?.detail || 'Attribution impossible.');
    } finally { setBusy(null); }
  };

  const isAdmin = ['admin', 'expert_comptable'].includes(team?.my_role);
  const canAssign = ['admin', 'expert_comptable', 'superviseur'].includes(team?.my_role);

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(1200px 500px at 85% -10%, rgba(107,46,90,.06), transparent 60%), #FBF7EF',
    }}>
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/cabinet')} className="text-[#57534E] hover:text-[#1C1917] mr-1">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            <Users size={16} color="#fff" />
          </div>
          <span className="font-bold text-[#1C1917]">Mon équipe</span>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            <UserPlus size={15} /> Créer un compte
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16">
        {toast && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-sm border"
               style={toast.ok
                 ? { background: 'rgba(63,156,107,.10)', borderColor: 'rgba(63,156,107,.35)', color: '#2F7A52' }
                 : { background: 'rgba(192,57,43,.08)', borderColor: 'rgba(192,57,43,.30)', color: '#C0392B' }}>
            <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
          </div>
        )}

        {!isAdmin && (
          <div className="rounded-2xl p-4 mb-5 text-sm" style={{ background: '#F7F1E6', color: '#57534E' }}>
            Vue en lecture seule — seul l'administrateur du cabinet peut modifier l'équipe.
          </div>
        )}

        {/* Unassigned pool — surfaced deliberately so a dossier is never
            silently orphaned after someone leaves. */}
        {unassigned.length > 0 && (
          <div className="rounded-2xl border p-4 mb-5"
               style={{ background: 'rgba(224,169,43,.10)', borderColor: 'rgba(184,134,11,.35)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} style={{ color: '#B8860B' }} />
              <span className="font-bold text-sm" style={{ color: '#8A6508' }}>
                <LiveText>{`${unassigned.length} dossier(s) non assigné(s)`}</LiveText>
              </span>
            </div>
            <div className="space-y-1.5">
              {unassigned.map((d) => (
                <div key={d.tenant_id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-[#44403C]">{d.name}</span>
                  {isAdmin && (
                    <select className="fld-sm" defaultValue=""
                            onChange={(e) => assign(d.tenant_id, e.target.value)}>
                      <option value="">Attribuer à…</option>
                      {(team?.members || []).filter((m) => m.status === 'active').map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="space-y-3 mb-6">
          {(team?.members || []).map((m) => {
            const role = ROLE_LABELS[m.role] || ROLE_LABELS.assistant;
            const suspended = m.status === 'suspended';
            return (
              <div key={m.id} className="rounded-2xl bg-white border p-4"
                   style={{ borderColor: '#ECE3D2', opacity: suspended ? 0.6 : 1 }}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                       style={{ background: role.c }}>
                    {(m.full_name || m.user_email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <div className="font-bold text-[#1C1917] flex items-center gap-2 flex-wrap">
                      {m.full_name}
                      <LiveText className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ color: role.c, background: role.bg }}>{role.label}</LiveText>
                      {suspended && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ color: '#C0392B', background: 'rgba(192,57,43,.12)' }}>Suspendu</span>
                      )}
                      {m.must_change_password && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ color: '#B8860B', background: 'rgba(184,134,11,.12)' }}>
                          Mot de passe à changer
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8B8680]">{m.user_email}</div>
                    <div className="text-[11px] text-[#A8A29E] mt-0.5">{role.hint}</div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {(m.domains || []).map((d) => (
                        <span key={d} className="text-[10px] px-1.5 py-0.5 rounded-full border"
                              style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
                          {DOMAIN_LABELS[d] || d}
                        </span>
                      ))}
                      {(m.role === 'expert_comptable' || m.role === 'admin') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={m.ordre_number
                                ? { color: '#2F7A52', background: 'rgba(63,156,107,.12)' }
                                : { color: '#B8860B', background: 'rgba(184,134,11,.12)' }}>
                          {m.ordre_number ? `Ordre n° ${m.ordre_number}` : 'N° Ordre manquant — signature bloquée'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Workload — computed from the work itself, never reported */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#1C1917]">
                      <LiveText>{`${m.dossiers} dossier(s)`}</LiveText>
                    </div>
                    <div className="text-xs" style={{ color: m.open_cases > 0 ? '#C0392B' : '#8B8680' }}>
                      <LiveText>{`${m.open_cases} cas ouvert(s)`}</LiveText>
                    </div>
                    {m.tasks > 0 && (
                      <div className="text-[11px] text-[#8B8680]">
                        <LiveText>{`${m.tasks} tâche(s) attribuée(s)`}</LiveText>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && m.role !== 'admin' && m.role !== 'expert_comptable' && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#F2ECE0' }}>
                    <select className="fld-sm" value={m.role} disabled={busy === m.id}
                            onChange={(e) => changeMember(m.id, { role: e.target.value }, 'Rôle mis à jour.')}>
                      <option value="assistant">Assistant</option>
                      <option value="collaborateur">Collaborateur</option>
                      <option value="superviseur">Superviseur</option>
                      <option value="expert_comptable">Expert-comptable</option>
                    </select>
                    <button disabled={busy === m.id}
                            onClick={() => changeMember(m.id, { status: suspended ? 'active' : 'suspended' },
                                                        suspended ? 'Accès rétabli.' : 'Accès suspendu.')}
                            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                            style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
                      {suspended ? 'Réactiver' : 'Suspendre'}
                    </button>
                    <button disabled={busy === m.id}
                            onClick={() => {
                              if (window.confirm(`Retirer ${m.full_name} du cabinet ? Ses dossiers passeront en « Non assignés ». Son historique est conservé.`)) {
                                changeMember(m.id, { status: 'removed' }, 'Membre retiré.');
                              }
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                            style={{ borderColor: 'rgba(192,57,43,.4)', color: '#C0392B' }}>
                      Retirer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dossier assignment table */}
        {canAssign && clients.length > 0 && (
          <div className="rounded-3xl bg-white border" style={{ borderColor: '#ECE3D2' }}>
            <div className="px-5 py-3 border-b font-bold text-[#1C1917]" style={{ borderColor: '#F2ECE0' }}>
              Attribution des dossiers
            </div>
            <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
              {clients.map((c) => (
                <div key={c.tenant_id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <span className="flex-1 font-semibold text-[#1C1917] truncate">{c.name}</span>
                  <select className="fld-sm" disabled={busy === c.tenant_id}
                          value={c.assignee_membership_id || ''}
                          onChange={(e) => assign(c.tenant_id, e.target.value)}>
                    <option value="">Non assigné</option>
                    {(team?.members || []).filter((m) => m.status === 'active').map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateMemberModal
          onClose={() => setShowCreate(false)}
          onCreated={async (email, pw) => {
            setShowCreate(false);
            flash(true, `Compte créé pour ${email}. Transmettez-lui ce mot de passe : ${pw} — il devra le changer à sa première connexion.`);
            await load();
          }}
        />
      )}

      <style>{`.fld-sm{border:1px solid #E7E1D5;border-radius:10px;padding:6px 10px;font-size:12px;color:#1C1917;background:#FCFAF5;outline:none}.fld-sm:focus{border-color:#7A3E70}`}</style>
    </div>
  );
}

function CreateMemberModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'collaborateur', domains: ['compta'], ordre_number: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const rules = passwordRules(form.password);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await cabinetOsAPI.createMember(form);
      await onCreated(form.email, form.password);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Création impossible.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(28,25,23,.45)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-auto"
           onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1" style={{ color: '#1C1917' }}>Créer un compte</h3>
        <p className="text-xs text-[#8B8680] mb-5">
          Vous définissez un mot de passe initial et le transmettez vous-même.
          Le collaborateur devra le changer à sa première connexion — ensuite,
          vous ne connaîtrez plus son mot de passe.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-[#57534E]">Nom</span>
            <input className="fld" value={form.full_name}
                   onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                   placeholder="Léa Martin" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#57534E]">Email professionnel</span>
            <input className="fld" type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   placeholder="lea@cabinet-rousseau.fr" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#57534E]">Rôle</span>
            <select className="fld" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="assistant">Assistant — produit (saisie, lettrage), ne valide pas</option>
              <option value="collaborateur">Collaborateur — ses dossiers, produit et valide</option>
              <option value="superviseur">Superviseur — voit tout, valide, attribue</option>
              <option value="expert_comptable">Expert-comptable — voit tout, valide et signe</option>
            </select>
          </label>
          <div className="block">
            <span className="text-xs font-medium text-[#57534E]">Pôle(s)</span>
            <div className="flex gap-2 mt-1.5">
              {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                <button key={k} type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          domains: f.domains.includes(k)
                            ? (f.domains.length > 1 ? f.domains.filter((d) => d !== k) : f.domains)
                            : [...f.domains, k],
                        }))}
                        className="text-xs px-3 py-1.5 rounded-full border"
                        style={form.domains.includes(k)
                          ? { borderColor: '#7A3E70', color: '#7A3E70', background: 'rgba(122,62,112,.08)', fontWeight: 600 }
                          : { borderColor: '#E7E1D5', color: '#8B8680' }}>
                  {v}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[#A8A29E] mt-1">
              Un gestionnaire de paie = Collaborateur + pôle « Paie ».
            </div>
          </div>
          {form.role === 'expert_comptable' && (
            <label className="block">
              <span className="text-xs font-medium text-[#57534E]">N° d'inscription à l'Ordre</span>
              <input className="fld" value={form.ordre_number}
                     onChange={(e) => setForm({ ...form, ordre_number: e.target.value })}
                     placeholder="140002200" />
              <div className="text-[10px] text-[#A8A29E] mt-1">
                Sans numéro, le compte fonctionne mais ne peut pas signer (attestation, lettre de mission).
              </div>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-[#57534E]">Mot de passe initial</span>
            <input className="fld" type="text" value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })}
                   placeholder="Cabinet-Rousseau2026!" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
              {rules.map((r) => (
                <div key={r.id + (form.password && r.ok ? '-ok' : '-no')} className="text-[10px]"
                     style={{ color: form.password && r.ok ? '#2F7A52' : '#8B8680' }}>
                  {form.password && r.ok ? '✓' : '○'} {r.label}
                </div>
              ))}
            </div>
          </label>
        </div>

        {err && <div className="text-sm mt-3" style={{ color: '#C0392B' }}>{err}</div>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border text-[#57534E]"
                  style={{ borderColor: '#E7E1D5' }}>Annuler</button>
          <button onClick={submit}
                  disabled={busy || !form.email || !passwordValid(form.password)}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            {busy ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
        <style>{`.fld{width:100%;border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#1C1917;background:#FCFAF5;outline:none;margin-top:4px}.fld:focus{border-color:#7A3E70}`}</style>
      </div>
    </div>
  );
}
