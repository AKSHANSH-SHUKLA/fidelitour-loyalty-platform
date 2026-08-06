import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, ShieldCheck, AlertTriangle, Download, RefreshCw, X, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { comptableAPI, facturationAPI, cabinetExtraAPI, casesAPI, cabinetOsAPI } from '../lib/api';
import GrilleModal from '../components/GrilleModal';
import NewClientModal from '../components/NewClientModal';
import NewSubscriptionModal from '../components/NewSubscriptionModal';
import { CreateInvoiceModal } from './FacturationHome';
import LiveText from '../components/LiveText';
import AgentToolsPanel from '../components/AgentToolsPanel';
import WhatsAppIcon from '../components/WhatsAppIcon';
import GuideBox from '../components/GuideBox';

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
  const [openCases, setOpenCases] = useState(0);
  const [grilleFor, setGrilleFor] = useState(null);  // {tenant_id, name}
  const [teamMembers, setTeamMembers] = useState([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [invoiceFor, setInvoiceFor] = useState(null);   // tenant_id being invoiced
  const [docReqs, setDocReqs] = useState(null);         // {requests, reliability} for the drill
  const [subs, setSubs] = useState(null);               // subscriptions for the drill
  const [showNewSub, setShowNewSub] = useState(null);   // tenant_id
  const [runningAgent, setRunningAgent] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [canOnboard, setCanOnboard] = useState(false);
  const [me, setMe] = useState(null);                 // my membership (role, name)

  const load = useCallback(async () => {
    setLoading(true);
    const [c, a] = await Promise.all([
      comptableAPI.clients().catch(() => null),
      comptableAPI.alerts().catch(() => null),
    ]);
    setData(c?.data || { clients: [], totals: {} });
    setAlerts(a?.data?.alerts || []);
    // Open-case badge lives in the header so the queue is never out of sight.
    casesAPI.list({ status: 'open' })
      .then((r) => setOpenCases(r?.data?.counts?.open ?? 0))
      .catch(() => {});
    cabinetOsAPI.team()
      .then((r) => setTeamMembers(r?.data?.members || []))
      .catch(() => {});
    comptableAPI.reviewQueue()
      .then((r) => setReviewCount(r?.data?.count ?? 0))
      .catch(() => {});
    cabinetOsAPI.me()
      .then((r) => { setCanOnboard(!!r?.data?.can?.assign); setMe(r?.data || null); })
      .catch(() => {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openClient = async (tid) => {
    const r = await comptableAPI.client(tid).catch(() => null);
    if (r?.data) setDrill(r.data);
    cabinetOsAPI.docRequests(tid)
      .then((x) => setDocReqs(x?.data || null))
      .catch(() => setDocReqs(null));
    cabinetOsAPI.subscriptions(tid)
      .then((x) => setSubs(x?.data?.subscriptions || []))
      .catch(() => setSubs(null));
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
          <button onClick={() => navigate('/cabinet/revue')}
                  className="text-sm font-semibold text-[#57534E] hover:text-[#2F7A52] flex items-center gap-1.5">
            À valider
            {reviewCount > 0 && (
              <LiveText className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: 'white', background: '#2F7A52' }}>{String(reviewCount)}</LiveText>
            )}
          </button>
          <button onClick={() => navigate('/cabinet/cas')}
                  className="text-sm font-semibold text-[#57534E] hover:text-[#C0392B] flex items-center gap-1.5">
            <AlertTriangle size={15} /> Cas
            {openCases > 0 && (
              <LiveText className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: 'white', background: '#C0392B' }}>{String(openCases)}</LiveText>
            )}
          </button>
          <button onClick={() => navigate('/cabinet/equipe')}
                  className="text-sm font-semibold text-[#57534E] hover:text-[#7A3E70]">
            Équipe
          </button>
          {canOnboard && (
            <button disabled={runningAgent}
                    onClick={async () => {
                      setRunningAgent(true);
                      try {
                        const r = await cabinetOsAPI.runCollection();
                        setToast({ ok: true,
                                   msg: `Agent : ${r.data.emails_sent} email(s) envoyé(s), ${r.data.cases_opened} cas escaladé(s), ${r.data.waiting_not_due} en attente (pas encore l'heure de relancer).` });
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Relances impossibles.' });
                      } finally {
                        setRunningAgent(false);
                        setTimeout(() => setToast(null), 9000);
                      }
                    }}
                    className="text-sm font-semibold px-3 py-2 rounded-xl border disabled:opacity-50"
                    style={{ borderColor: '#57534E', color: '#57534E' }}>
              {runningAgent ? '🤖 …' : '🤖 Lancer les relances'}
            </button>
          )}
          {canOnboard && (
            <button onClick={() => setShowNewClient(true)}
                    className="text-sm font-semibold px-3 py-2 rounded-xl border"
                    style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}>
              + Nouveau client
            </button>
          )}
          {canOnboard && (
            <label className="text-sm font-semibold px-3 py-2 rounded-xl border cursor-pointer"
                   style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}
                   title="Importer plusieurs clients d'un coup (CSV : raison sociale, siren, email, pa)">
              ⬆︎ Importer clients
              <input type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => {
                const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
                try {
                  const text = await f.text();
                  const r = await cabinetOsAPI.importClients(text);
                  setToast({ ok: true, msg: `${r.data.created} client(s) importé(s)` + (r.data.skipped ? `, ${r.data.skipped} ignoré(s).` : '.') });
                  await load();
                } catch (err) {
                  setToast({ ok: false, msg: err?.response?.data?.detail || 'Import impossible.' });
                }
                setTimeout(() => setToast(null), 8000);
              }} />
            </label>
          )}
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
            <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
          </div>
        )}

        {/* totals */}
        {/* Ma journée — role-aware greeting. KEYED by its dynamic content so a
            change REMOUNTS the subtree — the page translator replaces text
            nodes in place, and React's insertBefore crashes if we patch them
            (same bug LiveText fixes; here the whole card is the unit). */}
        <div key={`hero-${me?.membership?.full_name || me?.full_name || ''}-${me?.membership?.role || me?.role || ''}-${reviewCount}`}
             className="bg-white border rounded-2xl p-4 mb-4 flex items-center gap-3 flex-wrap"
             style={{ borderColor: '#E7E1D5' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0"
               style={{ background: 'rgba(78,31,68,.08)', color: '#4E1F44' }}>
            <LiveText>{String(me?.membership?.full_name || me?.full_name || 'C').charAt(0).toUpperCase()}</LiveText>
          </div>
          <div className="flex-1 min-w-[180px]">
            <LiveText as="div" className="font-bold text-sm text-[#1C1917]">
              {`Bonjour ${me?.membership?.full_name || me?.full_name || ''} 👋`}
            </LiveText>
            <LiveText as="div" className="text-[11px] text-[#8B8680]">
              {`${{ expert_comptable: 'Expert-comptable', superviseur: 'Superviseur',
                    collaborateur: 'Collaborateur', assistant: 'Assistant' }[
                    me?.membership?.role || me?.role] || 'Cabinet'} · ${
                 new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
            </LiveText>
          </div>
          {(me?.membership?.role || me?.role) === 'assistant' ? (
            <LiveText as="span" className="text-xs text-[#57534E]">
              📷 Ouvrez un dossier et photographiez les factures — l'agent fait le reste.
            </LiveText>
          ) : reviewCount > 0 ? (
            <button onClick={() => navigate('/cabinet/revue')}
                    className="text-xs font-semibold px-3 py-2 rounded-xl text-white"
                    style={{ background: '#C0392B' }}>
              <LiveText>{`${reviewCount} facture(s) attendent votre validation →`}</LiveText>
            </button>
          ) : (
            <LiveText as="span" className="text-xs font-semibold" style={{ color: '#2F7A52' }}>
              ✓ Rien n'attend votre validation
            </LiveText>
          )}
        </div>

        <GuideBox
          title="Nouveau ici ? Le tour en 5 étapes"
          steps={[
            '⬆︎ Importer clients (en haut) : votre liste de clients en CSV → tous les dossiers se créent d\'un coup.',
            'Cliquez un dossier dans « Mes dossiers » : tout ce client est là (factures, pièces, agent).',
            'Dans le dossier : « + Demander une pièce » pour que l\'agent relance le client à votre place (email/WhatsApp).',
            '« À valider » (en haut) : la file des factures qui attendent votre validation — règle des 4 yeux.',
            '« Équipe » : créez les comptes de vos collaborateurs ; chacun ne voit que ses dossiers.',
          ]}
          example="votre stagiaire photographie 10 tickets fournisseurs → l'agent lit et propose 10 écritures → votre collaborateur les valide en 5 clics." />
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
                  <LiveText className="text-[#57534E]">{'— ' + a.message}</LiveText>
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
                    onToast={(ok, msg) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 7000); }}
                    onOcr={async (tid, file, vente) => {
                      try {
                        const dataUrl = await new Promise((res, rej) => {
                          const fr = new FileReader();
                          fr.onload = () => res(fr.result); fr.onerror = rej;
                          fr.readAsDataURL(file);
                        });
                        const r = vente
                          ? await cabinetOsAPI.ocrVente(tid, dataUrl)
                          : await cabinetOsAPI.ocrIngest(tid, { image: dataUrl });
                        const c = Math.round((r.data.confidence || 0) * 100);
                        setToast({ ok: true, msg: r.data.needs_review
                          ? `Lu (confiance ${c} %) — à vérifier.`
                          : `Lu (confiance ${c} %) — rangé ✓` });
                        await openClient(tid);
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Lecture impossible (OCR non configuré ?).' });
                      }
                      setTimeout(() => setToast(null), 7000);
                    }}
                    onSyncRec={async (tid) => {
                      try {
                        const r = await cabinetOsAPI.syncReceived(tid);
                        setToast({ ok: true, msg: `${r.data.synced} facture(s) fournisseur récupérée(s) (PA : ${r.data.pa_provider}).` });
                        await openClient(tid);
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Synchronisation impossible.' });
                      }
                      setTimeout(() => setToast(null), 7000);
                    }}
                    onReview={validateInvoice} reviewing={reviewing}
                    onActFor={actForClient} acting={acting}
                    onCreditNote={createCreditNote} crediting={crediting}
                    onOpenGrille={(tid, name) => setGrilleFor({ tenant_id: tid, name })}
                    onExportFec={async (tid, name) => {
                      try {
                        const resp = await comptableAPI.fec(tid);
                        const blob = new Blob([resp.data], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = (name || 'dossier') + '-FEC.txt';
                        document.body.appendChild(a); a.click(); a.remove();
                        URL.revokeObjectURL(url);
                        setToast({ ok: true, msg: 'FEC généré — importable dans Sage/Cegid.' });
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Export FEC impossible.' });
                      }
                      setTimeout(() => setToast(null), 6000);
                    }}
                    onNewInvoice={(tid) => setInvoiceFor(tid)}
                    docReqs={docReqs}
                    subs={subs}
                    onNewSub={(tid) => setShowNewSub(tid)}
                    onToggleSub={async (tid, id, active) => {
                      try {
                        await cabinetOsAPI.toggleSubscription(id, active);
                        setToast({ ok: true, msg: active ? 'Abonnement réactivé.' : 'Abonnement mis en pause.' });
                        await openClient(tid);
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Action impossible.' });
                      }
                      setTimeout(() => setToast(null), 6000);
                    }}
                    onRunBilling={async (tid) => {
                      try {
                        const r = await cabinetOsAPI.runBilling();
                        setToast({ ok: true,
                                   msg: `Agent : ${r.data.invoices_drafted} brouillon(s) préparé(s), ${r.data.skipped} pas encore dus.` });
                        await openClient(tid); await load();
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Exécution impossible.' });
                      }
                      setTimeout(() => setToast(null), 8000);
                    }}
                    onAskDoc={async (tid) => {
                      const label = window.prompt('Quelle pièce demander ? (ex. « Relevé bancaire juillet »)');
                      if (!label) return;
                      const email = window.prompt("Email du client (vide = compte client connu) :") || '';
                      const phone = window.prompt("Téléphone WhatsApp du client (optionnel, ex. 06 12 34 56 78) :") || '';
                      const channel = phone
                        ? (window.confirm("Relancer par WhatsApp si disponible ? (Annuler = email)") ? 'auto' : 'email')
                        : 'email';
                      try {
                        await cabinetOsAPI.createDocRequest(tid, {
                          label, client_email: email || undefined,
                          client_phone: phone || undefined, channel });
                        setToast({ ok: true, msg: `Demande enregistrée : « ${label} ». L'agent la relancera au bon moment${phone && channel !== 'email' ? ' (WhatsApp si actif, sinon email)' : ''}.` });
                        await openClient(tid);
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Demande impossible.' });
                      }
                      setTimeout(() => setToast(null), 7000);
                    }}
                    onDocReceived={async (tid, id) => {
                      try {
                        const r = await cabinetOsAPI.markDocReceived(id);
                        setToast({ ok: true, msg: r.data.on_time ? 'Pièce reçue — dans les temps ✓ (score du client ↑)' : 'Pièce reçue (en retard — le score du client s\'en souviendra).' });
                        await openClient(tid);
                      } catch (e) {
                        setToast({ ok: false, msg: e?.response?.data?.detail || 'Action impossible.' });
                      }
                      setTimeout(() => setToast(null), 7000);
                    }}
                    />
      )}
      {invoiceFor && (
        <CreateInvoiceModal
          tenantId={invoiceFor}
          seller={{ vat_regime: 'reel_normal' }}
          onClose={() => setInvoiceFor(null)}
          onCreated={async () => {
            setInvoiceFor(null);
            setToast({ ok: true, msg: 'Facture créée et transmise pour ce dossier.' });
            setTimeout(() => setToast(null), 6000);
            if (drill?.summary?.tenant_id) await openClient(drill.summary.tenant_id);
            await load();
          }} />
      )}
      {showNewSub && (
        <NewSubscriptionModal tenantId={showNewSub}
          onClose={() => setShowNewSub(null)}
          onCreated={async () => {
            setShowNewSub(null);
            setToast({ ok: true, msg: "Abonnement enregistré — l'agent facturera chaque mois au jour choisi, en brouillon à valider." });
            setTimeout(() => setToast(null), 8000);
            if (drill?.summary?.tenant_id) await openClient(drill.summary.tenant_id);
          }} />
      )}
      {showNewClient && (
        <NewClientModal members={teamMembers}
                        onClose={() => setShowNewClient(false)}
                        onCreated={async (res) => {
                          setShowNewClient(false);
                          setToast({ ok: true,
                                     msg: res.client_account
                                       ? `Dossier créé. Accès client : ${res.client_account.email} / ${res.client_account.temp_password} — transmettez-le, il ne sera plus affiché.`
                                       : 'Dossier client créé et mandat activé.' });
                          setTimeout(() => setToast(null), 12000);
                          await load();
                        }} />
      )}
      {grilleFor && (
        <GrilleModal tenantId={grilleFor.tenant_id} clientName={grilleFor.name}
                     members={teamMembers} onClose={() => setGrilleFor(null)} />
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
    <LiveText className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ color: c, background: bg }}>{label}</LiveText>
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
    <LiveText className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
              style={{ color: c, background: c + '1A' }}>{label}</LiveText>
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
                     onCreditNote, crediting, onOpenGrille, onExportFec, onNewInvoice,
                     docReqs, onAskDoc, onDocReceived, onToast, onOcr, onSyncRec,
                     subs, onNewSub, onToggleSub, onRunBilling }) {
  const s = data.summary || {};
  const b = BAND[s.band] || BAND.amber;
  // Hub navigation (façon MyFiteco): the dossier opens on CARDS, one per "room".
  // Clicking a card shows ONLY that room, with a back button. No more stacking.
  const [room, setRoom] = useState(null);
  const [agentN, setAgentN] = useState(0);
  const ROOM_TITLES = { agent: "L'agent a préparé", ventes: 'Ventes (factures client)',
                        pieces: 'Pièces attendues', abos: 'Abonnements',
                        achats: 'Achats (fournisseurs)', indicateurs: 'Indicateurs & alertes' };
  // Ventes: unpaid first — "à encaisser d'abord" (MyFiteco: impayés en un clin d'œil)
  const sortedInv = [...(data.invoices || [])].sort((a, b) =>
    ((a.payment_status === 'paid') - (b.payment_status === 'paid'))
    || ((a.review_status === 'validated') - (b.review_status === 'validated')));
  const unpaid = (data.invoices || []).filter(
    (i) => i.review_status === 'validated' && i.payment_status !== 'paid');
  const unpaidTot = unpaid.reduce((a, i) => a + (i.total_ttc || 0), 0);
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
              <ShieldCheck size={12} className="inline mr-1" />
              <LiveText>{b.label}</LiveText> · {s.score}/100
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenGrille && (
              <button onClick={() => onOpenGrille(s.tenant_id, s.name)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border"
                      style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
                Répartition des tâches
              </button>
            )}
            {onExportFec && (
              <button onClick={() => onExportFec(s.tenant_id, s.name)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border"
                      style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}
                      title="Fichier des Écritures Comptables — importable dans Sage, Cegid, etc.">
                Export FEC
              </button>
            )}
            <button onClick={onClose} className="text-[#8B8680]"><X size={20} /></button>
          </div>
        </div>

        {/* ── The HUB: cards with counters, one per room ─────────────────── */}
        {room !== null && (
          <div className="px-5 pt-3 pb-1 flex items-center gap-3">
            <button onClick={() => setRoom(null)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border"
                    style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}>
              ← Retour au dossier
            </button>
            <span className="text-sm font-bold text-[#1C1917]">{ROOM_TITLES[room]}</span>
          </div>
        )}
        {room === null && (
          <div className="p-5">
            {(s.alerts || []).length > 0 && (
              <ul className="space-y-1 mb-4">
                {s.alerts.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <AlertTriangle size={13} style={{ color: BAND[a.level]?.c }} />
                    <LiveText className="text-[#44403C]">{a.message}</LiveText>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <HubCard icon="🤖" title="L'agent a préparé" desc="écritures, rapprochements, conseils — à valider"
                       badge={agentN} accent onClick={() => setRoom('agent')} />
              <HubCard icon="📤" title="Ventes (factures client)" desc="créer, envoyer, suivre les paiements"
                       count={(data.invoices || []).length}
                       badge={(data.invoices || []).filter((i) => i.review_status !== 'validated').length}
                       onClick={() => setRoom('ventes')} />
              <HubCard icon="📥" title="Achats (fournisseurs)" desc="factures reçues + tickets photographiés"
                       count={(data.received || []).length} onClick={() => setRoom('achats')} />
              <HubCard icon="📨" title="Pièces attendues" desc="l'agent relance le client tout seul"
                       badge={(docReqs?.requests || []).filter((r) => r.status === 'pending').length}
                       onClick={() => setRoom('pieces')} />
              <HubCard icon="📊" title="Indicateurs & alertes" desc="bouclier fiscal, reconstitution, impayés"
                       badge={(s.alerts || []).length} onClick={() => setRoom('indicateurs')} />
              <HubCard icon="🔁" title="Abonnements" desc="« chaque mois, le X, facturer Y à Z »"
                       count={(subs || []).length} onClick={() => setRoom('abos')} />
            </div>
            <button onClick={() => setRoom('agent')}
                    className="mt-4 w-full text-sm font-semibold py-3 rounded-2xl text-white"
                    style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}>
              📷 Photographier une facture — l'agent la lit et la range
            </button>
            <div className="mt-3 text-center text-[11px] text-[#8B8680]">
              Chaque carte est une pièce du dossier — cliquez pour entrer, « Retour » pour ressortir.
            </div>
          </div>
        )}

        {/* S12 — pièces manquantes: what the agent is chasing for this client */}
        {room === 'pieces' && docReqs && (
          <div className="px-5 pt-4 pb-4 border-b" style={{ borderColor: '#F2ECE0' }}>
            <GuideBox
              title="Pièces manquantes — comment ça marche ?"
              steps={[
                '« + Demander une pièce » : dites ce qui manque (ex. relevé bancaire juillet) + l\'email (et WhatsApp si vous voulez) du client.',
                'L\'agent relance TOUT SEUL au bon moment — doux avec les clients fiables, insistant avec les retardataires.',
                'Quand la pièce arrive, cliquez « Reçu ✓ » — le score de fiabilité du client s\'ajuste.',
                'Après 3 relances sans réponse, un Cas s\'ouvre pour qu\'un humain prenne le relais.',
              ]}
              example="« Relevé bancaire juillet » demandé le 1er → l'agent relance le 5, le 9… → reçu le 10 → vous cliquez Reçu ✓. Zéro email écrit à la main." />
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-[#1C1917]">
                Pièces manquantes
                <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: docReqs.reliability >= 80 ? '#2F7A52' : docReqs.reliability >= 50 ? '#B8860B' : '#C0392B',
                               background: 'rgba(139,134,128,.10)' }}>
                  Fiabilité client : {docReqs.reliability}/100
                </span>
              </div>
              <button onClick={() => onAskDoc(s.tenant_id)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
                      style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}>
                + Demander une pièce
              </button>
            </div>
            {(docReqs.requests || []).length === 0 ? (
              <div className="text-xs text-[#8B8680]">Rien en attente.</div>
            ) : (
              <div className="space-y-1.5">
                {docReqs.requests.map((rq) => (
                  <div key={rq.id} className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: rq.status === 'received' ? '#3F9C6B'
                                   : rq.status === 'escalated' ? '#C0392B' : '#E0A92B' }} />
                    <span className="font-semibold text-[#1C1917]">{rq.label}</span>
                    <span className="text-[#8B8680]">pour le {rq.due_date}</span>
                    {(rq.reminders || []).length > 0 && rq.status === 'pending' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{ color: '#57534E', background: 'rgba(87,83,78,.08)' }}>
                        🤖 {rq.reminders.length} relance(s)
                        {(rq.reminders || []).some((rm) => rm.channel === 'whatsapp') && (
                          <WhatsAppIcon size={12} title="Relance envoyée par WhatsApp" />
                        )}
                      </span>
                    )}
                    {rq.status === 'escalated' && (
                      <span className="text-[10px] font-semibold" style={{ color: '#C0392B' }}>
                        escaladé — voir Cas
                      </span>
                    )}
                    {rq.status === 'pending' && (
                      <button onClick={() => onDocReceived(s.tenant_id, rq.id)}
                              className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-lg border"
                              style={{ borderColor: 'rgba(63,156,107,.4)', color: '#2F7A52' }}>
                        Reçu ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chapter 4 + 8 + TVA — the agent's autonomous work for this dossier.
            Always mounted (so the hub badge knows the count on first open),
            but only VISIBLE in the 'agent' room. */}
        {s.tenant_id && (
          <div style={{ display: room === 'agent' ? 'block' : 'none' }}>
            <AgentToolsPanel tenantId={s.tenant_id} onToast={onToast} onCounts={setAgentN} />
          </div>
        )}

        {/* S13 — abonnements: the standing instructions the agent executes */}
        {room === 'abos' && subs !== null && (
          <div className="px-5 pt-4 pb-4 border-b" style={{ borderColor: '#F2ECE0' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-[#1C1917]">Abonnements (facturation récurrente)</div>
              <div className="flex gap-2">
                <button onClick={() => onRunBilling(s.tenant_id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border"
                        style={{ borderColor: '#E7E1D5', color: '#57534E' }}
                        title="Exécute toutes les instructions dues — l'agent prépare des brouillons, il ne transmet rien.">
                  🤖 Exécuter maintenant
                </button>
                <button onClick={() => onNewSub(s.tenant_id)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
                        style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}>
                  + Nouvel abonnement
                </button>
              </div>
            </div>
            {subs.length === 0 ? (
              <div className="text-xs text-[#8B8680]">
                Aucune instruction permanente — « chaque mois, le X, facturer Y à Z ».
              </div>
            ) : (
              <div className="space-y-1.5">
                {subs.map((sb) => {
                  const ht = (sb.lines || []).reduce((a, l) => a + (l.quantity || 1) * (l.unit_price || 0), 0);
                  return (
                    <div key={sb.id} className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: sb.active ? '#3F9C6B' : '#8B8680' }} />
                      <span className="font-semibold text-[#1C1917]">{sb.label}</span>
                      <span className="text-[#57534E]">{ht.toFixed(2)} € HT · le {sb.day_of_month} du mois</span>
                      <span className="text-[#8B8680]">→ {sb.buyer?.name}</span>
                      {sb.last_run_ym && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ color: '#57534E', background: 'rgba(87,83,78,.08)' }}>
                          dernier : {sb.last_run_ym}
                        </span>
                      )}
                      <button onClick={() => onToggleSub(s.tenant_id, sb.id, !sb.active)}
                              className="ml-auto text-[10px] px-2 py-1 rounded-lg border"
                              style={{ borderColor: '#E7E1D5', color: '#57534E' }}>
                        {sb.active ? 'Mettre en pause' : 'Réactiver'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions the cabinet can perform FOR this client. The legal duty sits
            with the business, but in practice the accountant is the one who
            tracks the deadline — so both sides get the button, and the audit log
            records who actually pressed it. */}
        {room === 'ventes' && onActFor && (
          <div className="px-5 pt-4 flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: '#F2ECE0' }}>
            {onNewInvoice && (
              <button onClick={() => onNewInvoice(s.tenant_id)}
                      className="text-xs font-semibold px-3 py-2 rounded-xl text-white"
                      style={{ background: 'linear-gradient(135deg,#2F6FB3,#1E4E86)' }}>
                + Nouvelle facture
              </button>
            )}
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

        {room === 'ventes' && (
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl border p-3" style={{ borderColor: unpaid.length ? 'rgba(192,57,43,.35)' : '#E7E1D5' }}>
              <LiveText as="div" className="text-lg font-extrabold" style={{ color: unpaid.length ? '#C0392B' : '#2F7A52' }}>
                {`${unpaidTot.toFixed(0)} €`}
              </LiveText>
              <LiveText as="div" className="text-[10.5px] text-[#8B8680]">
                {`impayés (${unpaid.length} facture${unpaid.length > 1 ? 's' : ''})`}
              </LiveText>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: '#E7E1D5' }}>
              <LiveText as="div" className="text-lg font-extrabold text-[#1C1917]">{String((data.invoices || []).length)}</LiveText>
              <div className="text-[10.5px] text-[#8B8680]">factures émises</div>
            </div>
            <label className="rounded-xl border p-3 cursor-pointer text-center flex flex-col justify-center"
                   style={{ borderColor: '#D8CBB8', borderStyle: 'dashed' }}>
              <span className="text-lg">📷</span>
              <span className="text-[10.5px] font-semibold" style={{ color: '#4E1F44' }}>
                Photographier une facture de vente (papier)
              </span>
              <input type="file" accept="image/*" className="hidden"
                     onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = '';
                       if (f && onOcr) onOcr(s.tenant_id, f, true); }} />
            </label>
          </div>
          {(s.alerts || []).length > 0 && (
            <ul className="space-y-1.5 mb-4">
              {s.alerts.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <AlertTriangle size={14} style={{ color: BAND[a.level]?.c }} />
                  <LiveText className="text-[#44403C]">{a.message}</LiveText>
                </li>
              ))}
            </ul>
          )}
          <h4 className="text-sm font-bold text-[#1C1917] mb-2">Factures émises</h4>
          {(data.invoices || []).length === 0 ? (
            <div className="text-sm text-[#8B8680]">Aucune facture.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
              {sortedInv.map((inv) => {
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

        </div>
        )}

        {/* ── Room: ACHATS — photograph, sync, list supplier invoices ────── */}
        {room === 'achats' && (
        <div className="p-5">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <label className="rounded-xl border p-4 cursor-pointer text-center"
                   style={{ borderColor: '#2F6FB3', borderStyle: 'dashed' }}>
              <div className="text-xl">📷</div>
              <div className="text-xs font-bold" style={{ color: '#2F6FB3' }}>
                Photographier une facture fournisseur
              </div>
              <div className="text-[10px] text-[#8B8680]">même un ticket de caisse (Metro, Carrefour…)</div>
              <input type="file" accept="image/*" className="hidden"
                     onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = '';
                       if (f && onOcr) onOcr(s.tenant_id, f, false); }} />
            </label>
            <button onClick={() => onSyncRec && onSyncRec(s.tenant_id)}
                    className="rounded-xl border p-4 text-center" style={{ borderColor: '#E7E1D5' }}>
              <div className="text-xl">🔄</div>
              <div className="text-xs font-bold text-[#57534E]">Synchroniser les e-factures</div>
              <div className="text-[10px] text-[#8B8680]">récupère depuis la plateforme du client</div>
            </button>
          </div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-2">
            Factures reçues ({(data.received || []).length})
          </h4>
          {(data.received || []).length === 0 ? (
            <div className="text-xs text-[#8B8680]">
              Rien encore — photographiez un ticket ou synchronisez. Dès septembre 2026, les
              e-factures des fournisseurs arriveront ici toutes seules.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F2ECE0' }}>
              {data.received.map((r) => (
                <div key={r.id} className="py-2 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[#1C1917] w-28 shrink-0 truncate">{r.number || '—'}</span>
                  <span className="flex-1 text-[#57534E] truncate">{r.supplier?.name || '—'}</span>
                  {r.source === 'ocr' && <span className="text-[10px]">📷</span>}
                  <span className="text-[#1C1917] w-20 text-right">{(r.total_ttc ?? 0).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ── Room: INDICATEURS — the score, spelled out ─────────────────── */}
        {room === 'indicateurs' && (
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-extrabold" style={{ color: b.c }}>
              <LiveText>{String(s.score)}</LiveText><span className="text-base text-[#8B8680]">/100</span>
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: b.c }}><LiveText>{b.label}</LiveText></div>
              <div className="text-[11px] text-[#8B8680]">Bouclier fiscal — ce que verrait un contrôle. Indicateur informatif, ni conseil fiscal ni ECF.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl border p-3" style={{ borderColor: unpaid.length ? 'rgba(192,57,43,.35)' : '#E7E1D5' }}>
              <LiveText as="div" className="text-lg font-extrabold" style={{ color: unpaid.length ? '#C0392B' : '#2F7A52' }}>{`${unpaidTot.toFixed(0)} €`}</LiveText>
              <div className="text-[10.5px] text-[#8B8680]">impayés clients à encaisser</div>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: '#E7E1D5' }}>
              <LiveText as="div" className="text-lg font-extrabold text-[#1C1917]">{String((data.received || []).length)}</LiveText>
              <div className="text-[10.5px] text-[#8B8680]">pièces d'achat au dossier</div>
            </div>
          </div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-2">Points de vigilance ({(s.alerts || []).length})</h4>
          {(s.alerts || []).length === 0 ? (
            <div className="text-xs" style={{ color: '#2F7A52' }}>✓ Aucune anomalie — dossier cohérent.</div>
          ) : (
            <ul className="space-y-1.5">
              {s.alerts.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: BAND[a.level]?.c }} />
                  <LiveText className="text-[#44403C]">{a.message}</LiveText>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setRoom('agent')}
                  className="mt-4 text-xs font-semibold px-3 py-2 rounded-xl border"
                  style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}>
            🤖 Calculer la TVA / lancer les contrôles → L'agent a préparé
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

/** One "room" card on the dossier hub — icon, label, counter, badge. */
function HubCard({ icon, title, desc, count, badge, accent, onClick }) {
  return (
    <button onClick={onClick}
            className="flex items-center gap-3 text-left rounded-2xl border p-4 bg-white hover:shadow transition"
            style={{ borderColor: accent ? '#7A3E70' : '#E7E1D5', borderWidth: accent ? 2 : 1 }}>
      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: 'rgba(78,31,68,.08)' }}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-[#1C1917]">{title}</span>
        <span className="block text-[11px] text-[#8B8680] truncate">{desc}</span>
      </span>
      {badge > 0 && (
        <LiveText className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(192,57,43,.12)', color: '#C0392B' }}>{String(badge)}</LiveText>
      )}
      {!(badge > 0) && (count ?? null) !== null && (
        <LiveText className="text-xs font-semibold text-[#57534E] shrink-0">{String(count)}</LiveText>
      )}
      <ChevronRight size={16} style={{ color: '#C9C2B4' }} className="shrink-0" />
    </button>
  );
}
