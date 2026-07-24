import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReceiptText, ShieldCheck, ArrowLeft, Plus, Send, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { facturationAPI } from '../lib/api';

/**
 * FacturationHome — the Facturation module's home screen.
 *
 * Two states:
 *  - NOT enabled -> activation gate: capture legal identity (SIREN…) + opt in.
 *  - Enabled     -> dashboard: Bouclier Fiscal (coherence), counts, invoice
 *                   list + a "Nouvelle facture" quick-create (create + send via
 *                   the PdpConnector — Mock by default, so it works end-to-end
 *                   today without a PA/SIREN).
 *
 * The Bouclier Fiscal score is an INFORMATIONAL indicator, not tax advice /
 * not an ECF — the disclaimer is shown under it.
 */

const BAND = {
  green: { c: '#2F7A52', bg: 'rgba(63,156,107,.12)', label: 'Conforme' },
  amber: { c: '#B8860B', bg: 'rgba(224,169,43,.14)', label: 'À vérifier' },
  red: { c: '#C0392B', bg: 'rgba(192,57,43,.12)', label: 'Action requise' },
};

export default function FacturationHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState(null);
  const [coh, setCoh] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [acctEmail, setAcctEmail] = useState('');
  const [acctMsg, setAcctMsg] = useState('');

  const loadDashboard = useCallback(async () => {
    const [st, co, inv] = await Promise.all([
      facturationAPI.status().catch(() => null),
      facturationAPI.coherence().catch(() => null),
      facturationAPI.listInvoices().catch(() => null),
    ]);
    setStatus(st?.data || null);
    setCoh(co?.data || null);
    setInvoices(inv?.data?.invoices || []);
  }, []);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const a = await facturationAPI.availability();
      const on = !!a.data?.enabled;
      setEnabled(on);
      if (on) await loadDashboard();
    } finally {
      setLoading(false);
    }
  }, [loadDashboard]);

  useEffect(() => { boot(); }, [boot]);

  if (loading) {
    return (
      <Shell>
        <div className="text-center text-[#8B8680] py-24 text-sm">Chargement…</div>
      </Shell>
    );
  }

  if (!enabled) return <ActivationGate onDone={boot} onBack={() => navigate('/modules')} />;

  const band = BAND[coh?.band] || BAND.amber;

  const activateDGFiP = async () => {
    await facturationAPI.activate({ start_date: '2026-09-01', type_operation: 'services', enterprise_size: 'pme' }).catch(() => {});
    await loadDashboard();
  };
  const simulateReceived = async () => {
    await facturationAPI.seedReceived({ supplier_name: 'Fournisseur Test SARL', total_ht: 900 }).catch(() => {});
    await loadDashboard();
  };
  const testEreporting = async () => {
    await facturationAPI.sendEreporting({ period_start: '2026-07-01', period_end: '2026-07-31', totals_by_vat: { '20': 5000, '10': 2000 } }).catch(() => {});
    await loadDashboard();
  };
  const makeAvoir = async (inv) => {
    await facturationAPI.creditNote(inv.id, { reason: 'Correction (test)' }).catch(() => {});
    await loadDashboard();
  };
  const inviteAccountant = async () => {
    setAcctMsg('');
    try {
      const r = await facturationAPI.inviteAccountant(acctEmail);
      const tp = r.data?.temp_password;
      setAcctMsg(tp
        ? `Comptable invité. Mot de passe temporaire : ${tp} (à transmettre une seule fois)`
        : 'Comptable lié à votre dossier.');
      setAcctEmail('');
    } catch (e) {
      setAcctMsg("Échec de l'invitation (email déjà utilisé ?).");
    }
  };

  return (
    <Shell onBack={() => navigate('/modules')}>
      {/* Bouclier Fiscal */}
      <div
        className="rounded-3xl bg-white border p-6 mb-5"
        style={{ borderColor: '#ECE3D2' }}
      >
        <div className="flex items-start gap-5">
          <div className="shrink-0 text-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(${band.c} ${(coh?.score ?? 0)}%, #EEF1F4 0)` }}
            >
              <div className="w-[74px] h-[74px] rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold" style={{ color: band.c }}>
                  {coh?.score ?? '—'}
                </span>
                <span className="text-[10px] text-[#8B8680]">/100</span>
              </div>
            </div>
            <div className="mt-2 text-xs font-bold" style={{ color: band.c }}>
              <ShieldCheck size={12} className="inline mr-1" />{band.label}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold" style={{ color: '#1C1917' }}>Bouclier Fiscal</h2>
              <button onClick={loadDashboard} className="text-[#8B8680] hover:text-[#1C1917]">
                <RefreshCw size={16} />
              </button>
            </div>
            {(coh?.alerts || []).length === 0 ? (
              <div className="text-sm text-[#2F7A52]">✅ Aucune incohérence détectée.</div>
            ) : (
              <ul className="space-y-2">
                {coh.alerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span style={{ color: BAND[a.level]?.c || '#B8860B' }}>
                      <AlertTriangle size={15} className="mt-0.5" />
                    </span>
                    <span className="text-[#44403C]">{a.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-[#A8A29E] mt-3 italic">
              Indicateur informatif de cohérence — ni conseil fiscal, ni ECF.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Kpi label="Factures émises" value={status?.counts?.issued ?? 0} />
        <Kpi label="Factures reçues" value={status?.counts?.received ?? 0} />
        <Kpi label="Conformité DGFiP" value={status?.dgfip_activated ? 'Activée' : 'Non activée'}
             tone={status?.dgfip_activated ? '#2F7A52' : '#B8860B'} />
      </div>

      {/* Actions & tests */}
      <div className="flex flex-wrap gap-2 mb-5">
        {!status?.dgfip_activated && (
          <button onClick={activateDGFiP}
            className="text-sm font-semibold px-3 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#3F9C6B,#2F7A52)' }}>
            Activer conformité DGFiP
          </button>
        )}
        <button onClick={simulateReceived}
          className="text-sm px-3 py-2 rounded-xl border" style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
          Simuler une facture reçue
        </button>
        <button onClick={testEreporting}
          className="text-sm px-3 py-2 rounded-xl border" style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
          Envoyer un e-reporting (test)
        </button>
      </div>

      {/* Invoices */}
      <div className="rounded-3xl bg-white border" style={{ borderColor: '#ECE3D2' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F2ECE0' }}>
          <h3 className="font-bold text-[#1C1917]">Factures émises</h3>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-3.5 py-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}
          >
            <Plus size={16} /> Nouvelle facture
          </button>
        </div>
        {invoices.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#8B8680]">
            Aucune facture pour l'instant. Créez votre première facture.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
            {invoices.map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <span className="font-semibold text-[#1C1917] w-28">{inv.number}</span>
                <span className="flex-1 text-[#57534E] truncate">{inv.buyer?.name || '—'}</span>
                <span className="text-[#1C1917] w-24 text-right">{(inv.total_ttc ?? 0).toFixed(2)} €</span>
                <StatePill state={inv.state} />
                <button onClick={() => makeAvoir(inv)}
                  className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: '#E7E1D5', color: '#8B8680' }}>
                  Avoir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mon comptable */}
      <div className="rounded-3xl bg-white border mt-5 p-5" style={{ borderColor: '#ECE3D2' }}>
        <h3 className="font-bold text-[#1C1917] mb-1">Mon comptable</h3>
        <p className="text-sm text-[#57534E] mb-3">
          Donnez accès à votre expert-comptable — il verra votre conformité depuis son Espace Cabinet.
        </p>
        <div className="flex gap-2">
          <input className="fld-a flex-1" value={acctEmail} inputMode="email"
                 onChange={(e) => setAcctEmail(e.target.value)}
                 placeholder="email@cabinet-comptable.fr" />
          <button onClick={inviteAccountant} disabled={!acctEmail.includes('@')}
                  className="text-sm font-semibold px-4 rounded-xl text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            Inviter
          </button>
        </div>
        {acctMsg && <div className="text-xs mt-2" style={{ color: '#2F7A52' }}>{acctMsg}</div>}
        <style>{`.fld-a{border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#1C1917;background:#FCFAF5;outline:none}.fld-a:focus{border-color:#7A3E70}`}</style>
      </div>

      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await loadDashboard(); }}
        />
      )}
    </Shell>
  );
}

/* ---------------- shell / small pieces ---------------- */

function Shell({ children, onBack }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(1200px 500px at 85% -10%, rgba(47,111,179,.06), transparent 60%),' +
          'radial-gradient(1000px 500px at -10% 110%, rgba(107,46,90,.05), transparent 60%), #FBF7EF',
      }}
    >
      <header className="flex items-center gap-3 px-6 py-4">
        {onBack && (
          <button onClick={onBack} className="text-[#57534E] hover:text-[#1C1917]">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}>
            <ReceiptText size={16} color="#fff" />
          </div>
          <span className="font-bold text-[#1C1917]">Facturation</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pb-16">{children}</main>
    </div>
  );
}

function Kpi({ label, value, tone = '#1C1917' }) {
  return (
    <div className="rounded-2xl bg-white border p-4" style={{ borderColor: '#ECE3D2' }}>
      <div className="text-xl font-bold" style={{ color: tone }}>{value}</div>
      <div className="text-xs text-[#8B8680] mt-0.5">{label}</div>
    </div>
  );
}

function StatePill({ state }) {
  const map = {
    draft: ['Brouillon', '#8B8680', 'rgba(139,134,128,.12)'],
    sent: ['Envoyée', '#2F6FB3', 'rgba(47,111,179,.12)'],
    received: ['Reçue', '#2F6FB3', 'rgba(47,111,179,.12)'],
    accepted: ['Acceptée', '#2F7A52', 'rgba(63,156,107,.12)'],
    refused: ['Refusée', '#C0392B', 'rgba(192,57,43,.12)'],
    paid: ['Payée', '#2F7A52', 'rgba(63,156,107,.14)'],
    error: ['Erreur', '#C0392B', 'rgba(192,57,43,.12)'],
  };
  const [label, c, bg] = map[state] || [state, '#8B8680', 'rgba(139,134,128,.12)'];
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: c, background: bg }}>
      {label}
    </span>
  );
}

/* ---------------- activation gate ---------------- */

function ActivationGate({ onDone, onBack }) {
  const [form, setForm] = useState({ legal_name: '', siren: '', vat_regime: 'reel_normal_mensuel' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await facturationAPI.enable({ plan: 'addon', ...form });
      await onDone();
    } catch (e) {
      setErr("L'activation a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell onBack={onBack}>
      <div className="rounded-3xl bg-white border p-7 mt-6" style={{ borderColor: '#ECE3D2' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
             style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}>
          <ReceiptText size={22} color="#fff" />
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1C1917' }}>
          Activer la Facturation électronique
        </h1>
        <p className="text-sm text-[#57534E] mb-6">
          Émettez des factures conformes à la réforme 2026, faites votre e-reporting,
          et suivez votre Bouclier Fiscal. Renseignez votre identité légale pour commencer.
        </p>

        <div className="space-y-3">
          <Field label="Raison sociale">
            <input className="fld" value={form.legal_name}
                   onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                   placeholder="Ex. Café Lumière SARL" />
          </Field>
          <Field label="SIREN (9 chiffres)">
            <input className="fld" value={form.siren} inputMode="numeric" maxLength={9}
                   onChange={(e) => setForm({ ...form, siren: e.target.value.replace(/\D/g, '') })}
                   placeholder="123456789" />
          </Field>
          <Field label="Régime de TVA">
            <select className="fld" value={form.vat_regime}
                    onChange={(e) => setForm({ ...form, vat_regime: e.target.value })}>
              <option value="reel_normal_mensuel">Réel normal (mensuel)</option>
              <option value="rsi">Régime simplifié</option>
              <option value="franchise">Franchise en base (auto-entrepreneur)</option>
            </select>
          </Field>
        </div>

        {err && <div className="text-sm text-[#C0392B] mt-3">{err}</div>}

        <button
          onClick={submit}
          disabled={busy || !form.legal_name}
          className="w-full mt-6 text-white font-semibold py-3 rounded-2xl disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}
        >
          {busy ? 'Activation…' : 'Activer le module'}
        </button>
        <p className="text-[11px] text-[#A8A29E] mt-3 text-center">
          La configuration exacte (PA, DGFiP) se fait ensuite depuis les paramètres.
        </p>
      </div>

      <style>{`.fld{width:100%;border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#1C1917;background:#FCFAF5;outline:none}.fld:focus{border-color:#2F6FB3}`}</style>
    </Shell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#57534E] mb-1 block">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- create invoice modal ---------------- */

function CreateInvoiceModal({ onClose, onCreated }) {
  const [buyer, setBuyer] = useState({ name: '', siren: '', is_company: true });
  const [line, setLine] = useState({ description: '', unit_price: '', vat_rate: 20 });
  const [simulate, setSimulate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await facturationAPI.createInvoice({
        buyer,
        lines: [{
          description: line.description || 'Prestation',
          quantity: 1,
          unit_price: parseFloat(line.unit_price || '0'),
          vat_rate: parseFloat(line.vat_rate || '20'),
        }],
        send: true,
        simulate: simulate ? 'reject' : undefined,
      });
      await onCreated();
    } catch (e) {
      setErr("La création a échoué. Vérifiez les champs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
         style={{ background: 'rgba(28,25,23,.45)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4" style={{ color: '#1C1917' }}>Nouvelle facture</h3>
        <div className="space-y-3">
          <Field label="Client (nom)">
            <input className="fld" value={buyer.name}
                   onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                   placeholder="Client SARL" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SIREN client">
              <input className="fld" value={buyer.siren} inputMode="numeric" maxLength={9}
                     onChange={(e) => setBuyer({ ...buyer, siren: e.target.value.replace(/\D/g, '') })}
                     placeholder="987654321" />
            </Field>
            <Field label="Type">
              <select className="fld" value={buyer.is_company ? '1' : '0'}
                      onChange={(e) => setBuyer({ ...buyer, is_company: e.target.value === '1' })}>
                <option value="1">Entreprise (B2B)</option>
                <option value="0">Particulier (B2C)</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <input className="fld" value={line.description}
                   onChange={(e) => setLine({ ...line, description: e.target.value })}
                   placeholder="Prestation de conseil" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant HT (€)">
              <input className="fld" value={line.unit_price} inputMode="decimal"
                     onChange={(e) => setLine({ ...line, unit_price: e.target.value })}
                     placeholder="1000" />
            </Field>
            <Field label="TVA (%)">
              <select className="fld" value={line.vat_rate}
                      onChange={(e) => setLine({ ...line, vat_rate: e.target.value })}>
                <option value="20">20 %</option>
                <option value="10">10 %</option>
                <option value="5.5">5,5 %</option>
                <option value="0">0 % (exonéré)</option>
              </select>
            </Field>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs text-[#8B8680] cursor-pointer">
          <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
          Simuler un rejet (test — voir le message + le bouton de correction)
        </label>
        {err && <div className="text-sm text-[#C0392B] mt-3">{err}</div>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border text-[#57534E]"
                  style={{ borderColor: '#E7E1D5' }}>Annuler</button>
          <button onClick={submit} disabled={busy || !buyer.name}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}>
            <Send size={15} /> {busy ? 'Envoi…' : 'Créer & envoyer'}
          </button>
        </div>
      </div>
      <style>{`.fld{width:100%;border:1px solid #E7E1D5;border-radius:12px;padding:10px 12px;font-size:14px;color:#1C1917;background:#FCFAF5;outline:none}.fld:focus{border-color:#2F6FB3}`}</style>
    </div>
  );
}
