import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { cabinetOsAPI, comptableAPI } from '../lib/api';
import LiveText from '../components/LiveText';
import { passwordRules, passwordValid } from '../lib/passwordPolicy';
import CabinetShell from '../components/cabinet/CabinetShell';
import { MC, glass } from '../components/cabinet/mc';
import { Panel, Pill, McButton, Rise } from '../components/cabinet/Primitives';

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
 *
 * Destructive steps go through an in-app confirmation card rather than
 * window.confirm: the consequence ("ses dossiers passeront en non assignés")
 * has to be readable at the moment of the decision.
 */

// Roles v2 (S8) — a responsibility CHAIN (produce → validate → sign), not a
// permission ladder. "admin" is kept as an alias so pre-migration rows render.
const ROLE_LABELS = {
  expert_comptable: { label: 'Expert-comptable', hint: 'Voit tout · valide · seul à pouvoir signer (n° Ordre requis)', c: MC.plum },
  admin: { label: 'Expert-comptable', hint: 'Voit tout · valide · seul à pouvoir signer', c: MC.plum },
  superviseur: { label: 'Superviseur', hint: 'Chef de mission — voit tout, valide, attribue · ne signe pas', c: MC.green },
  collaborateur: { label: 'Collaborateur', hint: 'Ses dossiers · produit et valide sous seuil', c: MC.cyan },
  assistant: { label: 'Assistant', hint: 'Ses dossiers · produit (saisie, lettrage), ne valide pas', c: MC.amber },
  agent: { label: 'Agent FidClic', hint: 'Produit seulement — chaque action passe en revue humaine', c: MC.ink3 },
};

const DOMAIN_LABELS = { compta: 'Compta', social: 'Paie', juridique: 'Juridique' };

/** In-app confirmation — states the consequence, not just "êtes-vous sûr ?". */
function ConfirmModal({ title, body, confirmLabel, danger, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,6,15,.82)', backdropFilter: 'blur(6px)' }} onClick={onCancel}>
      <div className="w-full max-w-md" style={{ ...glass(danger ? 'danger' : 'accent'), padding: 20 }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, color: MC.ink, fontSize: 15.5 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: MC.ink2, marginTop: 6, lineHeight: 1.6 }}>{body}</div>
        <div className="flex gap-2 mt-5">
          <McButton variant="ghost" size="sm" onClick={onCancel}>Annuler</McButton>
          <McButton size="sm" variant={danger ? 'danger' : 'primary'} style={{ marginLeft: 'auto' }}
                    disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>
            {busy ? '…' : confirmLabel}
          </McButton>
        </div>
      </div>
    </div>
  );
}

export default function CabinetTeam() {
  const [team, setTeam] = useState(null);
  const [clients, setClients] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [confirm, setConfirm] = useState(null);
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

  const flash = (ok, msg) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 12000); };

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
    <CabinetShell
      title="Mon équipe"
      subtitle="Qui fait quoi, sur quels dossiers, avec quelle charge — chiffres calculés à partir du travail, jamais déclarés."
      headerRight={isAdmin && (
        <McButton size="sm" onClick={() => setShowCreate(true)}>
          <UserPlus size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
          Créer un compte
        </McButton>
      )}>

      {toast && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm"
             style={toast.ok
               ? { background: 'rgba(61,220,151,.12)', border: '1px solid rgba(61,220,151,.35)', color: MC.green }
               : { background: 'rgba(255,107,107,.10)', border: '1px solid rgba(255,107,107,.35)', color: MC.red }}>
          <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
        </div>
      )}

      {!isAdmin && (
        <div className="mb-4 rounded-2xl px-4 py-3"
             style={{ background: 'rgba(255,255,255,.05)', border: `1px solid ${MC.stroke}`,
                      fontSize: 12.5, color: MC.ink2 }}>
          Vue en lecture seule — seul l'expert-comptable du cabinet peut modifier l'équipe.
        </div>
      )}

      {/* Unassigned pool — surfaced deliberately so a dossier is never
          silently orphaned after someone leaves. */}
      {unassigned.length > 0 && (
        <Panel tone="warn" className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: MC.amber }} />
            <LiveText style={{ fontWeight: 700, fontSize: 13, color: MC.amber }}>
              {`${unassigned.length} dossier(s) non assigné(s)`}
            </LiveText>
          </div>
          <div className="space-y-1.5">
            {unassigned.map((d) => (
              <div key={d.tenant_id} className="flex items-center gap-2" style={{ fontSize: 12.5 }}>
                <LiveText className="flex-1" style={{ color: MC.ink2 }}>{d.name}</LiveText>
                {isAdmin && (
                  <select className="fld-mc" defaultValue=""
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
        </Panel>
      )}

      {/* Members */}
      <div className="space-y-3 mb-5">
        {(team?.members || []).map((m, i) => {
          const role = ROLE_LABELS[m.role] || ROLE_LABELS.assistant;
          const suspended = m.status === 'suspended';
          return (
            <Rise key={m.id} delay={i * 40}>
              <div style={{ ...glass(), padding: 15, opacity: suspended ? 0.6 : 1 }}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                       style={{ background: `linear-gradient(135deg, ${role.c}, rgba(0,0,0,.35))`,
                                color: '#fff', fontWeight: 800, fontSize: 15,
                                boxShadow: `0 8px 22px -12px ${role.c}` }}>
                    {(m.full_name || m.user_email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <LiveText style={{ fontWeight: 700, color: MC.ink, fontSize: 14 }}>{m.full_name}</LiveText>
                      <span key={role.label} style={{ fontSize: 10.5, fontWeight: 700, color: role.c,
                        background: 'rgba(255,255,255,.07)', borderRadius: 999, padding: '2px 9px' }}>
                        {role.label}
                      </span>
                      {suspended && <Pill tone="danger">Suspendu</Pill>}
                      {m.must_change_password && <Pill tone="warn">Mot de passe à changer</Pill>}
                    </div>
                    <LiveText as="div" style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2 }}>{m.user_email}</LiveText>
                    <div key={role.hint} style={{ fontSize: 11, color: MC.ink3, marginTop: 2 }}>{role.hint}</div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {(m.domains || []).map((d) => (
                        <span key={d} style={{ fontSize: 10.5, color: MC.ink2, border: `1px solid ${MC.stroke}`,
                          borderRadius: 999, padding: '2px 8px' }}>
                          {DOMAIN_LABELS[d] || d}
                        </span>
                      ))}
                      {(m.role === 'expert_comptable' || m.role === 'admin') && (
                        <Pill tone={m.ordre_number ? 'ok' : 'warn'}>
                          {m.ordre_number ? `Ordre n° ${m.ordre_number}` : 'N° Ordre manquant — signature bloquée'}
                        </Pill>
                      )}
                    </div>
                  </div>

                  {/* Workload — computed from the work itself, never reported */}
                  <div className="text-right shrink-0">
                    <LiveText as="div" style={{ fontSize: 13.5, fontWeight: 700, color: MC.ink }}>
                      {`${m.dossiers} dossier(s)`}
                    </LiveText>
                    <LiveText as="div" style={{ fontSize: 11.5, color: m.open_cases > 0 ? MC.red : MC.ink3 }}>
                      {`${m.open_cases} cas ouvert(s)`}
                    </LiveText>
                    {m.tasks > 0 && (
                      <LiveText as="div" style={{ fontSize: 11, color: MC.ink3 }}>
                        {`${m.tasks} tâche(s) attribuée(s)`}
                      </LiveText>
                    )}
                  </div>
                </div>

                {isAdmin && m.id !== team?.my_membership_id && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${MC.stroke}` }}>
                    <select className="fld-mc" value={m.role} disabled={busy === m.id}
                            onChange={(e) => changeMember(m.id, { role: e.target.value }, 'Rôle mis à jour.')}>
                      <option value="assistant">Assistant</option>
                      <option value="collaborateur">Collaborateur</option>
                      <option value="superviseur">Superviseur</option>
                      <option value="expert_comptable">Expert-comptable</option>
                    </select>
                    {/* Pôle toggles — a wrong wing is a data problem the founder
                        must be able to fix here, not by recreating the account. */}
                    <div className="flex items-center gap-1.5">
                      {Object.entries(DOMAIN_LABELS).map(([k, v]) => {
                        const has = (m.domains || []).includes(k);
                        return (
                          <button key={k} type="button" disabled={busy === m.id}
                                  onClick={() => {
                                    const next = has
                                      ? (m.domains || []).filter((d) => d !== k)
                                      : [...(m.domains || []), k];
                                    if (next.length === 0) return;   // at least one wing
                                    changeMember(m.id, { domains: next }, 'Pôles mis à jour.');
                                  }}
                                  className="cursor-pointer"
                                  style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 999,
                                    ...(has
                                      ? { border: `1px solid ${MC.indigo}`, color: MC.indigo, background: 'rgba(124,124,248,.14)', fontWeight: 700 }
                                      : { border: `1px solid ${MC.stroke}`, color: MC.ink3, background: 'none' }) }}>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                    <McButton size="sm" variant="ghost" disabled={busy === m.id}
                              onClick={() => setConfirm({
                                title: `Réinitialiser le mot de passe de ${m.full_name} ?`,
                                body: 'Un mot de passe temporaire sera généré et affiché une seule fois. Il devra le changer à sa prochaine connexion.',
                                confirmLabel: 'Réinitialiser',
                                run: async () => {
                                  setBusy(m.id);
                                  try {
                                    const r = await cabinetOsAPI.resetMemberPassword(m.id);
                                    flash(true, `Nouveau mot de passe temporaire pour ${m.full_name} : ${r.data.temp_password} — transmettez-le, il ne sera plus jamais affiché.`);
                                    await load();
                                  } catch (e) {
                                    flash(false, e?.response?.data?.detail || 'Réinitialisation impossible.');
                                  } finally { setBusy(null); }
                                },
                              })}>
                      Réinitialiser MDP
                    </McButton>
                    <McButton size="sm" variant="ghost" disabled={busy === m.id}
                              onClick={() => changeMember(m.id, { status: suspended ? 'active' : 'suspended' },
                                                          suspended ? 'Accès rétabli.' : 'Accès suspendu.')}>
                      {suspended ? 'Réactiver' : 'Suspendre'}
                    </McButton>
                    <McButton size="sm" variant="ghost" disabled={busy === m.id}
                              style={{ color: MC.red, borderColor: 'rgba(255,107,107,.35)' }}
                              onClick={() => setConfirm({
                                title: `Retirer ${m.full_name} du cabinet ?`,
                                body: 'Ses dossiers passeront en « Non assignés » et devront être réattribués. Son historique d\'actions est conservé — rien n\'est effacé.',
                                danger: true, confirmLabel: 'Retirer',
                                run: () => changeMember(m.id, { status: 'removed' }, 'Membre retiré.'),
                              })}>
                      Retirer
                    </McButton>
                  </div>
                )}
              </div>
            </Rise>
          );
        })}
      </div>

      {/* Dossier assignment table */}
      {canAssign && clients.length > 0 && (
        <Panel title="Attribution des dossiers" delay={120}>
          <div>
            {clients.map((c) => (
              <div key={c.tenant_id} className="flex items-center gap-3 py-2.5"
                   style={{ borderTop: `1px solid ${MC.stroke}`, fontSize: 12.5 }}>
                <LiveText className="flex-1 truncate" style={{ fontWeight: 600, color: MC.ink }}>{c.name}</LiveText>
                <select className="fld-mc" disabled={busy === c.tenant_id}
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
        </Panel>
      )}

      {confirm && (
        <ConfirmModal title={confirm.title} body={confirm.body} danger={confirm.danger}
                      confirmLabel={confirm.confirmLabel}
                      onCancel={() => setConfirm(null)}
                      onConfirm={async () => { const r = confirm.run; setConfirm(null); await r(); }} />
      )}

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

      <style>{`.fld-mc{border:1px solid ${MC.stroke};border-radius:10px;padding:6px 10px;font-size:12px;color:${MC.ink};background:rgba(255,255,255,.05);outline:none}.fld-mc:focus{border-color:${MC.indigo}}.fld-mc option{background:#0D1428;color:${MC.ink}}`}</style>
    </CabinetShell>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,6,15,.82)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-auto"
           style={{ ...glass('accent'), padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: MC.ink }}>Créer un compte</h3>
        <p style={{ fontSize: 11.5, color: MC.ink3, marginTop: 5, marginBottom: 16, lineHeight: 1.6 }}>
          Vous définissez un mot de passe initial et le transmettez vous-même.
          Le collaborateur devra le changer à sa première connexion — ensuite,
          vous ne connaîtrez plus son mot de passe.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.ink2 }}>Nom</span>
            <input className="fld-d" value={form.full_name}
                   onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                   placeholder="Léa Martin" />
          </label>
          <label className="block">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.ink2 }}>Email professionnel</span>
            <input className="fld-d" type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   placeholder="lea@cabinet-rousseau.fr" />
          </label>
          <label className="block">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.ink2 }}>Rôle</span>
            <select className="fld-d" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="assistant">Assistant — produit (saisie, lettrage), ne valide pas</option>
              <option value="collaborateur">Collaborateur — ses dossiers, produit et valide</option>
              <option value="superviseur">Superviseur — voit tout, valide, attribue</option>
              <option value="expert_comptable">Expert-comptable — voit tout, valide et signe</option>
            </select>
          </label>
          <div className="block">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.ink2 }}>Pôle(s)</span>
            <div className="flex gap-2 mt-1.5">
              {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                <button key={k} type="button" className="cursor-pointer"
                        onClick={() => setForm((f) => ({
                          ...f,
                          domains: f.domains.includes(k)
                            ? (f.domains.length > 1 ? f.domains.filter((d) => d !== k) : f.domains)
                            : [...f.domains, k],
                        }))}
                        style={{ fontSize: 12, padding: '6px 13px', borderRadius: 999,
                          ...(form.domains.includes(k)
                            ? { border: `1px solid ${MC.indigo}`, color: MC.indigo, background: 'rgba(124,124,248,.14)', fontWeight: 700 }
                            : { border: `1px solid ${MC.stroke}`, color: MC.ink3, background: 'none' }) }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: MC.ink3, marginTop: 6 }}>
              Un gestionnaire de paie = Collaborateur + pôle « Paie ».
            </div>
          </div>
          {form.role === 'expert_comptable' && (
            <label className="block">
              <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.ink2 }}>N° d'inscription à l'Ordre</span>
              <input className="fld-d" value={form.ordre_number}
                     onChange={(e) => setForm({ ...form, ordre_number: e.target.value })}
                     placeholder="140002200" />
              <div style={{ fontSize: 10.5, color: MC.ink3, marginTop: 5 }}>
                Sans numéro, le compte fonctionne mais ne peut pas signer (attestation, lettre de mission).
              </div>
            </label>
          )}
          <label className="block">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.ink2 }}>Mot de passe initial</span>
            <input className="fld-d" type="text" value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })}
                   placeholder="Cabinet-Rousseau2026!" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2">
              {rules.map((r) => (
                <div key={r.id + (form.password && r.ok ? '-ok' : '-no')}
                     style={{ fontSize: 10.5, color: form.password && r.ok ? MC.green : MC.ink3 }}>
                  {form.password && r.ok ? '✓' : '○'} {r.label}
                </div>
              ))}
            </div>
          </label>
        </div>

        {err && <div style={{ fontSize: 12.5, marginTop: 12, color: MC.red }}>{err}</div>}

        <div className="flex gap-3 mt-5">
          <McButton variant="ghost" onClick={onClose} style={{ flex: 1 }}>Annuler</McButton>
          <McButton onClick={submit} style={{ flex: 1,
                      ...(busy || !form.email || !passwordValid(form.password) ? { opacity: .45 } : {}) }}
                    disabled={busy || !form.email || !passwordValid(form.password)}>
            {busy ? 'Création…' : 'Créer le compte'}
          </McButton>
        </div>
        <style>{`.fld-d{width:100%;border:1px solid ${MC.stroke};border-radius:12px;padding:10px 12px;font-size:13.5px;color:${MC.ink};background:rgba(255,255,255,.05);outline:none;margin-top:5px}.fld-d:focus{border-color:${MC.indigo}}.fld-d option{background:#0D1428;color:${MC.ink}}.fld-d::placeholder{color:${MC.ink3}}`}</style>
      </div>
    </div>
  );
}
