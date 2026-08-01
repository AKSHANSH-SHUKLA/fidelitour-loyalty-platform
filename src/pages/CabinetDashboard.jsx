import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, ShieldCheck, AlertTriangle, Download, RefreshCw, X, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { comptableAPI, facturationAPI, cabinetExtraAPI } from '../lib/api';

/**
 * CabinetDashboard — the expert-comptable control tower.
 * One login → every linked client's compliance health (Bouclier), red-first,
 * with per-client drill-down, a combined alert feed, and a single CSV export.
 */

const BAND = {
  red: { c: '#C0392B', bg: 'rgba(192,57,43,.12)', dot: '#C0392B', label: 'Action requise' },
  amber: { c: '#B8860B', bg: 'rgba(224,169,43,.14)', dot: '#E0A92B', label: 'À vérifier' },
  green: { c: '#2F7A52', bg: 'rgba(63,156,107,.12)', dot: '#3F9C6B', label: 'Conforme' },
};

export default function CabinetDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [drill, setDrill] = useState(null); // {summary, invoices}
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);   // invoice id being validated
  const [acting, setActing] = useState(null);         // action running for a client
  const [toast, setToast] = useState(null);
  const [crediting, setCrediting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, a] = await Promise.all([
      comptableAPI.clients().catch(() => null),
      comptableAPI.alerts().catch(() => null),
    ]);
    setData(c?.data || { clients: [], totals: {} });
    setAlerts(a?.data?.alerts || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openClient = async (tid) => {
    const r = await comptableAPI.client(tid).catch(() => null);
    if (r?.data) setDrill(r.data);
  };

  /**
   * S1 — the accountant validates a document. This ONLY touches review_status
   * (and, through it, export readiness); the PA lifecycle and payment state are
   * left untouched, which is why a refused invoice can still be validated.
   */
  const validateInvoice = async (invoiceId, target) => {
    setReviewing(invoiceId);
    try {
      await facturationAPI.setReview(invoiceId, { target });
      if (drill?.summary?.tenant_id) await openClient(drill.summary.tenant_id);
      await load();       // portfolio counters refresh (workload view)
    } catch (e) {
      // 409 = illegal transition (e.g. two-step review required)
      alert(e?.response?.data?.detail || 'Action impossible');
    } finally {
      setReviewing(null);
    }
  };

  /**
   * Issue a credit note for a rejected invoice — the action that actually
   * clears the Tax Shield alert. Validating only records that the accountant
   * reviewed it; only an avoir corrects it, as French law requires.
   */
  const createCreditNote = async (invoiceId, number) => {
    setCrediting(invoiceId);
    try {
      const r = await facturationAPI.creditNote(invoiceId, { reason: 'Correction' });
      setToast({ ok: true,
                 msg: `Avoir ${r.data?.credit_note?.number || ''} créé pour ${number}. L'alerte du Bouclier disparaît.` });
      if (drill?.summary?.tenant_id) await openClient(drill.summary.tenant_id);
      await load();
    } catch (e) {
      setToast({ ok: false, msg: e?.response?.data?.detail || "Création de l'avoir impossible." });
    } finally {
      setCrediting(null);
      setTimeout(() => setToast(null), 6000);
    }
  };

  /**
   * Perform a facturation action ON BEHALF OF a client dossier.
   * The server re-verifies the mandate and stamps the audit entry with
   * "on_behalf_of", so the history never reads as if the owner did it.
   */
  const actForClient = async (action, tenantId) => {
    setActing(action);
    try {
      if (action === 'ereporting') {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        const r = await cabinetExtraAPI.ereportingFor(tenantId, {
          period_start: from, period_end: to, totals_by_vat: {},
        });
        setToast({ ok: true, msg: `E-reporting transmis — état : ${r.data?.ereport?.state || 'queued'}` });
      } else if (action === 'activate') {
        await cabinetExtraAPI.activateFor(tenantId, {
          start_date: '2026-09-01', type_operation: 'services',
        });
        setToast({ ok: true, msg: 'Conformité DGFiP activée pour ce dossier.' });
      } else if (action === 'received') {
        await cabinetExtraAPI.seedReceivedFor(tenantId, {
          supplier_name: 'Fournisseur Test SARL', total_ht: 900,
        });
        setToast({ ok: true, msg: 'Facture fournisseur simulée pour ce dossier.' });
      }
      await openClient(tenantId);
      await load();
    } catch (e) {
      setToast({ ok: false, msg: e?.response?.data?.detail || 'Action impossible.' });
    } finally {
      setActing(null);
      setTimeout(() => setToast(null), 6000);
    }
  };

  const totals = data?.totals || {};

  return (
    <div className="min-h-screen" style={{
      background:
        'radial-gradient(1200px 500px at 85% -10%, rgba(107,46,90,.06), transparent 60%), #FBF7EF',
    }}>
      {/* header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            <Building2 size={16} color="#fff" />
          </div>
          <span className="font-bold text-[#1C1917]">Espace Cabinet</span>
        </div>
        <div className="flex items-center gap-3">
          <a href={comptableAPI.exportUrl}
             className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl text-white"
             style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
            <Download size={15} /> Exporter tout (CSV)
          </a>
          <button onClick={() => { logout(); navigate('/login'); }}
                  className="text-sm text-[#57534E] hover:text-[#1C1917]">Se déconnecter</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16">
        {toast && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-sm border"
               style={toast.ok
                 ? { background: 'rgba(63,156,107,.10)', borderColor: 'rgba(63,156,107,.35)', color: '#2F7A52' }
                 : { background: 'rgba(192,57,43,.08)', borderColor: 'rgba(192,57,43,.30)', color: '#C0392B' }}>
            {toast.ok ? '✓ ' : '⚠ '}{toast.msg}
          </div>
        )}

        {/* totals */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <Stat label="Dossiers" value={totals.count ?? 0} />
          <Stat label="Action requise" value={totals.red ?? 0} tone="#C0392B" />
          <Stat label="À vérifier" value={totals.amber ?? 0} tone="#B8860B" />
          <Stat label="Conformes" value={totals.green ?? 0} tone="#2F7A52" />
        </div>

        {/* alerts feed */}
        {alerts.length > 0 && (
          <div className="rounded-2xl bg-white border p-4 mb-5" style={{ borderColor: '#ECE3D2' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-[#1C1917]">À traiter en priorité</h3>
              <button onClick={load} className="text-[#8B8680] hover:text-[#1C1917]"><RefreshCw size={15} /></button>
            </div>
            <ul className="space-y-1.5">
              {alerts.slice(0, 8).map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <AlertTriangle size={14} style={{ color: BAND[a.level]?.c }} />
                  <button onClick={() => openClient(a.tenant_id)}
                          className="font-semibold text-[#1C1917] hover:underline">{a.client}</button>
                  <span className="text-[#57534E]">— {a.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* client list */}
        <div className="rounded-3xl bg-white border" style={{ borderColor: '#ECE3D2' }}>
          <div className="px-5 py-3 border-b font-bold text-[#1C1917]" style={{ borderColor: '#F2ECE0' }}>
            Mes dossiers ({totals.count ?? 0})
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-[#8B8680]">Chargement…</div>
          ) : (data?.clients || []).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[#8B8680]">
              Aucun dossier lié. Vos clients vous ajoutent depuis leur espace Facturation.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
              {data.clients.map((c) => {
                const b = BAND[c.band] || BAND.amber;
                return (
                  <button key={c.tenant_id} onClick={() => openClient(c.tenant_id)}
                          className="w-full px-5 py-3 flex items-center gap-3 text-sm hover:bg-[#FCFAF5] text-left">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.dot }} />
                    <span className="font-semibold text-[#1C1917] flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: b.c, background: b.bg }}>{c.score}/100</span>
                    {/* S1 — pending work, so the cabinet sees WORKLOAD, not just health */}
                    {c.unreviewed > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                            style={{ color: '#B8860B', background: 'rgba(184,134,11,.12)' }}
                            title="Factures non revues">{c.unreviewed} à revoir</span>
                    )}
                    <span className="text-[#8B8680] w-24 text-right hidden md:block">{c.issued} émises · {c.received} reçues</span>
                    <ChevronRight size={16} className="text-[#C6BFB2]" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#A8A29E] mt-4 text-center italic">
          Indicateur informatif de cohérence — ni conseil fiscal, ni ECF.
        </p>
      </main>

      {drill && (
        <DrillModal data={drill} onClose={() => setDrill(null)}
                    onReview={validateInvoice} reviewing={reviewing}
                    onActFor={actForClient} acting={acting}
                    onCreditNote={createCreditNote} crediting={crediting} />
      )}
    </div>
  );
}

function Pill({ state }) {
  const map = {
    draft: ['Brouillon', '#8B8680', 'rgba(139,134,128,.12)'],
    sent: ['Envoyée', '#2F6FB3', 'rgba(47,111,179,.12)'],
    accepted: ['Acceptée', '#2F7A52', 'rgba(63,156,107,.12)'],
    refused: ['Refusée', '#C0392B', 'rgba(192,57,43,.12)'],
    error: ['Erreur', '#C0392B', 'rgba(192,57,43,.12)'],
    paid: ['Payée', '#2F7A52', 'rgba(63,156,107,.14)'],
    credited: ['Avoirée', '#2F7A52', 'rgba(63,156,107,.12)'],
  };
  const [label, c, bg] = map[state] || [state || '—', '#8B8680', 'rgba(139,134,128,.12)'];
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: c, background: bg }}>
      {label}
    </span>
  );
}

/** S1 — review + payment states, shown next to (not instead of) the PA state. */
const REVIEW_MAP = {
  unreviewed: ['Non revue', '#8B8680'],
  pending_validation: ['À valider', '#B8860B'],
  correction_required: ['À corriger', '#C0392B'],
  validated: ['Validée', '#2F7A52'],
};
const PAY_MAP = {
  unpaid: ['Impayée', '#8B8680'], partially_paid: ['Partielle', '#B8860B'],
  paid: ['Payée', '#2F7A52'], overdue: ['En retard', '#C0392B'],
  disputed: ['En litige', '#C0392B'],
};

function MiniChip({ value, map }) {
  const [label, c] = map[value] || [value || '—', '#8B8680'];
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{ color: c, background: c + '1A' }}>{label}</span>
  );
}

function Chan({ channel }) {
  const b2b = channel === 'e-invoicing';
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={b2b ? { color: '#2F6FB3', background: 'rgba(47,111,179,.10)' }
                 : { color: '#7A3E70', background: 'rgba(122,62,112,.10)' }}>
      {b2b ? 'e-invoicing' : 'e-reporting'}
    </span>
  );
}

function Stat({ label, value, tone = '#1C1917' }) {
  return (
    <div className="rounded-2xl bg-white border p-4 text-center" style={{ borderColor: '#ECE3D2' }}>
      <div className="text-2xl font-extrabold" style={{ color: tone }}>{value}</div>
      <div className="text-[11px] text-[#8B8680] mt-0.5">{label}</div>
    </div>
  );
}

function DrillModal({ data, onClose, onReview, reviewing, onActFor, acting,
                     onCreditNote, crediting }) {
  const s = data.summary || {};
  const b = BAND[s.band] || BAND.amber;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
         style={{ background: 'rgba(28,25,23,.45)' }} onClick={onClose}>
      {/* Wide enough that an invoice row fits on ONE line: number, customer,
          amount, three status chips and the action. At max-w-lg the chips
          wrapped onto their own lines, which read as broken rather than dense. */}
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: '#F2ECE0' }}>
          <div>
            <h3 className="text-lg font-bold text-[#1C1917]">{s.name}</h3>
            <span className="text-xs" style={{ color: b.c }}>
              <ShieldCheck size={12} className="inline mr-1" />{b.label} · {s.score}/100
            </span>
          </div>
          <button onClick={onClose} className="text-[#8B8680]"><X size={20} /></button>
        </div>
        {/* Actions the cabinet can perform FOR this client. The legal duty sits
            with the business, but in practice the accountant is the one who
            tracks the deadline — so both sides get the button, and the audit log
            records who actually pressed it. */}
        {onActFor && (
          <div className="px-5 pt-4 flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: '#F2ECE0' }}>
            <button onClick={() => onActFor('ereporting', s.tenant_id)}
                    disabled={acting === 'ereporting'}
                    className="text-xs font-semibold px-3 py-2 rounded-xl text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#7A3E70,#4E1F44)' }}>
              {acting === 'ereporting' ? 'Envoi…' : "Envoyer l'e-reporting"}
            </button>
            {!s.dgfip_activated && (
              <button onClick={() => onActFor('activate', s.tenant_id)}
                      disabled={acting === 'activate'}
                      className="text-xs font-semibold px-3 py-2 rounded-xl text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#3F9C6B,#2F7A52)' }}>
                {acting === 'activate' ? 'Activation…' : 'Activer conformité DGFiP'}
              </button>
            )}
            <button onClick={() => onActFor('received', s.tenant_id)}
                    disabled={acting === 'received'}
                    className="text-xs px-3 py-2 rounded-xl border disabled:opacity-50"
                    style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
              {acting === 'received' ? 'Simulation…' : 'Simuler une facture reçue'}
            </button>
            <span className="text-[10px] self-center" style={{ color: '#A8A29E' }}>
              Actions effectuées pour le compte du client — tracées dans l'historique.
            </span>
          </div>
        )}

        <div className="p-5">
          {(s.alerts || []).length > 0 && (
            <ul className="space-y-1.5 mb-4">
              {s.alerts.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <AlertTriangle size={14} style={{ color: BAND[a.level]?.c }} />
                  <span className="text-[#44403C]">{a.message}</span>
                </li>
              ))}
            </ul>
          )}
          <h4 className="text-sm font-bold text-[#1C1917] mb-2">Factures émises</h4>
          {(data.invoices || []).length === 0 ? (
            <div className="text-sm text-[#8B8680]">Aucune facture.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
              {data.invoices.map((inv) => {
                const credited = (data.credit_notes || []).some((c) => c.original_invoice_id === inv.id);
                const busy = reviewing === inv.id;
                return (
                  <div key={inv.id} className="py-2.5 flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-semibold text-[#1C1917] w-24 shrink-0">{inv.number}</span>
                    <span className="flex-1 min-w-[100px] text-[#57534E] truncate flex items-center gap-1.5">
                      {inv.buyer?.name || '—'} <Chan channel={inv.channel} />
                    </span>
                    <span className="text-[#1C1917] w-20 text-right shrink-0">{(inv.total_ttc ?? 0).toFixed(2)} €</span>
                    <Pill state={credited ? 'credited' : (inv.pa_status || inv.state)} />
                    <MiniChip value={inv.review_status} map={REVIEW_MAP} />
                    <MiniChip value={inv.payment_status} map={PAY_MAP} />
                    {/* Review action — works even on a REFUSED invoice, which is
                        exactly what the 4-status split unlocked. */}
                    {inv.review_status !== 'validated' && onReview && (
                      <button disabled={busy} onClick={() => onReview(inv.id, 'validated')}
                        className="text-[11px] font-semibold px-2 py-1 rounded-lg text-white disabled:opacity-50 shrink-0"
                        style={{ background: '#2F7A52' }}>
                        {busy ? '…' : 'Valider'}
                      </button>
                    )}
                    {/* A refused invoice is only truly fixed by a credit note —
                        validating it just records that the accountant looked at
                        it. This is the button that actually clears the alert. */}
                    {['refused', 'error'].includes(inv.pa_status || inv.state)
                      && !credited && onCreditNote && (
                      <button disabled={crediting === inv.id}
                              onClick={() => onCreditNote(inv.id, inv.number)}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg border disabled:opacity-50 shrink-0"
                              style={{ borderColor: '#C0392B', color: '#C0392B' }}>
                        {crediting === inv.id ? '…' : 'Créer un avoir'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(data.credit_notes || []).length > 0 && (
            <>
              <h4 className="text-sm font-bold text-[#1C1917] mt-4 mb-2">Avoirs émis</h4>
              <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
                {data.credit_notes.map((cn) => (
                  <div key={cn.id} className="py-2 flex items-center gap-2 text-sm">
                    <span className="font-semibold text-[#1C1917] w-28 shrink-0">{cn.number}</span>
                    <span className="flex-1 text-[#57534E] truncate">corrige {cn.original_number}</span>
                    <span className="w-20 text-right font-semibold" style={{ color: '#C0392B' }}>
                      −{Math.abs(cn.amount_ttc ?? 0).toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {(data.received || []).length > 0 && (
            <>
              <h4 className="text-sm font-bold text-[#1C1917] mt-4 mb-2">Factures reçues (fournisseurs)</h4>
              <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
                {data.received.map((r) => (
                  <div key={r.id} className="py-2 flex items-center gap-2 text-sm">
                    <span className="font-semibold text-[#1C1917] w-28 shrink-0">{r.number || '—'}</span>
                    <span className="flex-1 text-[#57534E] truncate">{r.supplier?.name || '—'}</span>
                    <span className="text-[#1C1917] w-20 text-right">{(r.total_ttc ?? 0).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
