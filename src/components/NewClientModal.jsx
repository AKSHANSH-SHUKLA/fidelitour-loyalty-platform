import React, { useState } from 'react';
import { X, Building2, Search } from 'lucide-react';
import { cabinetOsAPI } from '../lib/api';

/**
 * NewClientModal — S6, cabinet-initiated onboarding.
 *
 * ONE SIREN, THE STATE FILLS THE REST
 *   The EC types a SIREN; the public annuaire (recherche-entreprises
 *   .api.gouv.fr) returns name, address and NAF — like a plate number
 *   pulling the full RTO record. Fields stay editable because the annuaire
 *   can lag reality by a few weeks (moves, renames).
 *
 *   The client never has to register first. Optionally the EC creates their
 *   login here — same one-time-password ritual as team accounts.
 */
export default function NewClientModal({ members, onClose, onCreated }) {
  const [siren, setSiren] = useState('');
  const [company, setCompany] = useState(null);   // lookup result (editable)
  const [owner, setOwner] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [looking, setLooking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(false);

  const digits = siren.replace(/\D/g, '');

  const lookup = async () => {
    setLooking(true); setErr('');
    try {
      const r = await cabinetOsAPI.sirenLookup(digits);
      setCompany({ ...r.data.company });
      setManual(false);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Recherche impossible.';
      setErr(msg);
      // Annuaire down or company not listed? Manual entry stays possible —
      // the lookup is a convenience, never a gate.
      if (e?.response?.status === 502 || e?.response?.status === 404) {
        setManual(true);
        setCompany({ siren: digits, legal_name: '', siret: '', naf_code: '',
                     address: '', postal_code: '', city: '' });
      }
    } finally { setLooking(false); }
  };

  const create = async () => {
    setCreating(true); setErr('');
    try {
      const r = await cabinetOsAPI.createClient({
        siren: digits,
        legal_name: company.legal_name,
        siret: company.siret, naf_code: company.naf_code,
        address: company.address, postal_code: company.postal_code,
        city: company.city,
        owner_membership_id: owner || null,
        client_email: clientEmail.trim() || null,
      });
      onCreated(r.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Création impossible.');
    } finally { setCreating(false); }
  };

  const activeMembers = (members || []).filter((m) => m.status === 'active' && m.role !== 'agent');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(28,25,23,.45)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-auto p-6"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
              <Building2 size={16} color="#fff" />
            </div>
            <h3 className="text-lg font-bold text-[#1C1917]">Nouveau client</h3>
          </div>
          <button onClick={onClose} className="text-[#8B8680] hover:text-[#1C1917]"><X size={18} /></button>
        </div>
        <p className="text-xs text-[#8B8680] mb-4">
          Saisissez le SIREN — l'annuaire officiel remplit le reste. Le client n'a
          rien à faire : dossier et mandat sont créés immédiatement.
        </p>

        <div className="flex gap-2">
          <div className="flex-1">
            <input className="fld" value={siren} maxLength={11}
                   onChange={(e) => setSiren(e.target.value)}
                   placeholder="SIREN (9 chiffres)" />
            <div className="text-[10px] mt-0.5"
                 style={{ color: digits.length === 9 ? '#2F7A52' : '#A8A29E' }}>
              {digits.length}/9 chiffres
            </div>
          </div>
          <button onClick={lookup} disabled={digits.length !== 9 || looking}
                  className="h-[42px] px-4 rounded-xl text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            <Search size={14} /> {looking ? '…' : 'Rechercher'}
          </button>
        </div>

        {company && (
          <div className="mt-4 space-y-2.5">
            {!manual && (
              <div className="rounded-xl px-3 py-2 text-[11px]"
                   style={{ background: 'rgba(63,156,107,.08)', color: '#2F7A52' }}>
                ✓ Entreprise trouvée dans l'annuaire officiel — vérifiez et complétez si besoin.
              </div>
            )}
            <label className="block">
              <span className="lbl">Raison sociale *</span>
              <input className="fld" value={company.legal_name || ''}
                     onChange={(e) => setCompany({ ...company, legal_name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="lbl">SIRET (siège)</span>
                <input className="fld" value={company.siret || ''}
                       onChange={(e) => setCompany({ ...company, siret: e.target.value })} />
              </label>
              <label className="block">
                <span className="lbl">Code NAF</span>
                <input className="fld" value={company.naf_code || ''}
                       onChange={(e) => setCompany({ ...company, naf_code: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="lbl">Adresse</span>
              <input className="fld" value={company.address || ''}
                     onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </label>

            <label className="block">
              <span className="lbl">Responsable du dossier</span>
              <select className="fld" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Non attribué (pool « Non assignés »)</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="lbl">Email du client (optionnel — crée son accès)</span>
              <input className="fld" type="email" value={clientEmail}
                     onChange={(e) => setClientEmail(e.target.value)}
                     placeholder="patron@boulangerie.fr" />
              <span className="text-[10px] text-[#A8A29E]">
                Sans email, le dossier vit quand même — vous agissez pour le client via le mandat.
              </span>
            </label>
          </div>
        )}

        {err && <div className="text-sm mt-3" style={{ color: '#C0392B' }}>{err}</div>}

        {company && (
          <button onClick={create} disabled={creating || !(company.legal_name || '').trim()}
                  className="w-full mt-4 py-3 rounded-2xl text-white font-semibold disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            {creating ? 'Création…' : 'Créer le dossier client'}
          </button>
        )}

        <style>{`.lbl{font-size:11px;font-weight:500;color:#57534E}.fld{width:100%;border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#1C1917;background:#FCFAF5;outline:none;margin-top:3px}.fld:focus{border-color:#7A3E70}`}</style>
      </div>
    </div>
  );
}
