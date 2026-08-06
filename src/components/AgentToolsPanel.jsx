/**
 * AgentToolsPanel — the autonomous work the agent does for ONE dossier:
 *   Chapter 4  OCR (read a supplier invoice photo) + Saisie (propose the entry)
 *   Chapter 8  La Mémoire (dossier notes) + Le Conseiller (advisory drafts)
 *   TVA/CA3    draft VAT declaration
 *
 * Self-contained: it fetches its own data via cabinetOsAPI so the parent modal
 * doesn't need to thread a dozen extra props. Every agent action is a DRAFT a
 * human then validates — the buttons say so.
 */
import { useEffect, useState } from 'react';
import { cabinetOsAPI } from '../lib/api';
import GuideBox from './GuideBox';

const CARD = { borderColor: '#F2ECE0' };
const PLUM = { borderColor: '#D8CBB8', color: '#4E1F44' };
const GREY = { borderColor: '#E7E1D5', color: '#57534E' };

function money(n) { return (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'; }

export default function AgentToolsPanel({ tenantId, onToast, onCounts }) {
  const [saisie, setSaisie] = useState([]);
  const [conseils, setConseils] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tva, setTva] = useState([]);
  const [lettrage, setLettrage] = useState([]);
  const [findings, setFindings] = useState([]);
  const [revision, setRevision] = useState(null);
  const [paList, setPaList] = useState([]);
  const [pa, setPa] = useState('');
  const [busy, setBusy] = useState('');

  const toast = (ok, msg) => onToast && onToast(ok, msg);

  const refresh = async () => {
    try {
      const [se, co, me, tv, lt, gd, rv, pp] = await Promise.all([
        cabinetOsAPI.saisieEntries(tenantId).catch(() => ({ data: { entries: [] } })),
        cabinetOsAPI.conseils(tenantId).catch(() => ({ data: { conseils: [] } })),
        cabinetOsAPI.memoire(tenantId).catch(() => ({ data: { notes: [] } })),
        cabinetOsAPI.tvaDeclarations(tenantId).catch(() => ({ data: { declarations: [] } })),
        cabinetOsAPI.lettrageMatches(tenantId).catch(() => ({ data: { matches: [] } })),
        cabinetOsAPI.gardienFindings(tenantId).catch(() => ({ data: { findings: [] } })),
        cabinetOsAPI.revisionReports(tenantId).catch(() => ({ data: { reports: [] } })),
        cabinetOsAPI.paProviders().catch(() => ({ data: { providers: [] } })),
      ]);
      setPaList(pp.data.providers || []);
      setSaisie(se.data.entries || []);
      setConseils(co.data.conseils || []);
      setNotes(me.data.notes || []);
      setTva(tv.data.declarations || []);
      setLettrage(lt.data.matches || []);
      setFindings(gd.data.findings || []);
      setRevision((rv.data.reports || [])[0] || null);
      if (onCounts) {
        onCounts((se.data.entries || []).filter((x) => x.status === 'proposed').length
          + (lt.data.matches || []).filter((x) => x.status === 'proposed').length
          + (co.data.conseils || []).filter((x) => x.status === 'open').length
          + (gd.data.findings || []).filter((x) => x.status === 'open').length);
      }
    } catch { /* non-fatal */ }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [tenantId]);

  // ---- OCR upload ----
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy('ocr');
    try {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const r = await cabinetOsAPI.ocrIngest(tenantId, { image: dataUrl });
      const c = Math.round((r.data.confidence || 0) * 100);
      toast(true, r.data.needs_review
        ? `Lu (confiance ${c} %) — à vérifier avant saisie.`
        : `Lu (confiance ${c} %) — prêt pour la saisie.`);
      await refresh();
    } catch (err) {
      toast(false, err?.response?.data?.detail || 'Lecture impossible (OCR non configuré ?).');
    }
    setBusy('');
  };

  const runSaisie = async () => {
    setBusy('saisie');
    try {
      const r = await cabinetOsAPI.runSaisie(tenantId);
      toast(true, `Agent : ${r.data.entries_proposed} écriture(s) proposée(s) à valider.`);
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Action impossible.'); }
    setBusy('');
  };

  const validate = async (id) => {
    try {
      await cabinetOsAPI.validateSaisie(id);
      toast(true, 'Écriture validée par vous — comptabilisée.');
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Validation impossible.'); }
  };

  const runConseiller = async () => {
    setBusy('conseil');
    try {
      const r = await cabinetOsAPI.runConseiller(tenantId);
      toast(true, r.data.conseils_created > 0
        ? `Le Conseiller : ${r.data.conseils_created} opportunité(s) détectée(s).`
        : 'Le Conseiller : rien de nouveau à signaler.');
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Analyse impossible.'); }
    setBusy('');
  };

  const dismiss = async (id) => {
    try { await cabinetOsAPI.dismissConseil(id); await refresh(); }
    catch (err) { toast(false, err?.response?.data?.detail || 'Action impossible.'); }
  };

  const addNote = async () => {
    const text = window.prompt('Note sur ce dossier (ex. « le gérant préfère WhatsApp ») :');
    if (!text) return;
    try { await cabinetOsAPI.addMemoire(tenantId, { text }); await refresh(); toast(true, 'Note ajoutée à La Mémoire.'); }
    catch (err) { toast(false, err?.response?.data?.detail || 'Ajout impossible.'); }
  };

  const runTva = async () => {
    const start = window.prompt('Début de période (AAAA-MM-JJ) :', '2026-07-01');
    if (!start) return;
    const end = window.prompt('Fin de période (AAAA-MM-JJ) :', '2026-07-31');
    if (!end) return;
    setBusy('tva');
    try {
      const r = await cabinetOsAPI.runTva(tenantId, { period_start: start, period_end: end });
      const d = r.data.declaration;
      toast(true, d.sens === 'a_payer'
        ? `TVA à payer : ${money(d.tva_nette)} (brouillon).`
        : `Crédit de TVA : ${money(d.credit_a_reporter)} (brouillon).`);
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Calcul impossible.'); }
    setBusy('');
  };

  const runLettrage = async () => {
    setBusy('lettrage');
    try {
      const r = await cabinetOsAPI.runLettrage(tenantId);
      toast(true, `Le Lettrage : ${r.data.matches_proposed} rapprochement(s) proposé(s).`);
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Action impossible.'); }
    setBusy('');
  };
  const validateLettrage = async (id) => {
    try { await cabinetOsAPI.validateLettrage(id); toast(true, 'Rapprochement validé — facture payée.'); await refresh(); }
    catch (err) { toast(false, err?.response?.data?.detail || 'Validation impossible.'); }
  };
  const runGardien = async () => {
    setBusy('gardien');
    try {
      const r = await cabinetOsAPI.runGardien(tenantId);
      toast(true, r.data.findings_created > 0
        ? `Le Gardien : ${r.data.findings_created} point(s) de vigilance.`
        : 'Le Gardien : aucune anomalie détectée.');
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Analyse impossible.'); }
    setBusy('');
  };
  const resolveFinding = async (id) => {
    try { await cabinetOsAPI.resolveGardien(id); await refresh(); }
    catch (err) { toast(false, err?.response?.data?.detail || 'Action impossible.'); }
  };
  const runRevision = async () => {
    setBusy('revision');
    try {
      const r = await cabinetOsAPI.runRevision(tenantId);
      const rep = r.data.report;
      toast(true, `Le Réviseur : ${rep.ready} prête(s), ${rep.to_fix} à corriger.`);
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Revue impossible.'); }
    setBusy('');
  };

  const changePa = async (provider) => {
    setPa(provider);
    if (!provider) return;
    try {
      await cabinetOsAPI.setDossierPa(tenantId, provider);
      toast(true, `Plateforme du client : ${provider}. FidClic y routera automatiquement.`);
    } catch (err) { toast(false, err?.response?.data?.detail || 'Changement impossible.'); }
  };

  const _readText = (file) => new Promise((res, rej) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej;
    fr.readAsText(file);
  });
  const _ext = (name) => (name.split('.').pop() || '').toLowerCase();

  const onImportInvoices = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    setBusy('imp-inv');
    try {
      let r;
      if (_ext(f.name) === 'xlsx') {
        const b64 = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej;
          fr.readAsDataURL(f);
        });
        r = await cabinetOsAPI.importInvoicesXlsx(tenantId, b64);
      } else if (_ext(f.name) === 'xml') {
        const text = await _readText(f);
        r = await cabinetOsAPI.importEinvoiceXml(tenantId, text);
      } else {
        const text = await _readText(f);
        const fmt = _ext(f.name) === 'txt' || text.includes('EcritureNum') ? 'fec' : 'csv';
        r = await cabinetOsAPI.importInvoices(tenantId, text, fmt);
      }
      toast(true, r.data.duplicate ? 'Déjà importée (doublon ignoré).'
        : `${r.data.imported} facture(s) importée(s).`);
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Import impossible.'); }
    setBusy('');
  };
  const onImportBank = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    setBusy('imp-bank');
    try {
      const text = await _readText(f);
      const fmt = _ext(f.name) === 'ofx' || text.toUpperCase().includes('<STMTTRN>') ? 'ofx' : 'csv';
      const r = await cabinetOsAPI.importBank(tenantId, text, fmt);
      toast(true, `${r.data.imported} transaction(s) importée(s). Lancez « Rapprocher ».`); await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Import impossible.'); }
    setBusy('');
  };
  const onSyncReceived = async () => {
    setBusy('sync');
    try {
      const r = await cabinetOsAPI.syncReceived(tenantId);
      toast(true, `${r.data.synced} facture(s) fournisseur récupérée(s) (PA : ${r.data.pa_provider}).`);
      await refresh();
    } catch (err) { toast(false, err?.response?.data?.detail || 'Synchronisation impossible.'); }
    setBusy('');
  };

  const btn = (extra) => ({ ...extra });
  const pendingSaisie = saisie.filter((s) => s.status === 'proposed');
  const pendingLettrage = lettrage.filter((x) => x.status === 'proposed');
  const openFindings = findings.filter((f) => f.status === 'open');
  const openConseils = conseils.filter((c) => c.status === 'open');

  return (
    <div className="px-5 pt-4 pb-4 border-b" style={CARD}>
      <div className="text-sm font-bold text-[#1C1917] mb-3">
        L'agent FidClic <span className="text-[11px] font-normal text-[#8B8680]">— il prépare, vous validez</span>
      </div>

      <GuideBox
        title="Comment utiliser cette section ? (guide rapide)"
        steps={[
          '📷 Lire une facture : photographiez une facture fournisseur (même un ticket de caisse Metro/Carrefour) — l\'agent lit les montants.',
          '🤖 Proposer les écritures : l\'agent pré-remplit l\'écriture comptable ; vous cliquez « Valider ✓ ».',
          '🤖 Rapprocher : importez le relevé bancaire (bouton ci-dessus), l\'agent relie chaque virement à sa facture.',
          '🤖 Analyser / Contrôler / Réviser : l\'agent détecte opportunités et anomalies — vous décidez.',
          '🤖 Calculer la TVA : indiquez la période, l\'agent prépare le brouillon de CA3.',
        ]}
        example="lundi matin : importez le relevé de la semaine → Rapprocher → Valider les 12 rapprochements proposés → 10 minutes au lieu de 2 heures." />


      {/* Multi-PA — chaque client sur SA plateforme agréée */}
      {paList.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#57534E]">Plateforme (PA) du client :</span>
          <select value={pa} onChange={(e) => changePa(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1" style={{ borderColor: '#D8CBB8', color: '#4E1F44' }}>
            <option value="">— choisir —</option>
            {paList.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="text-[10px] text-[#8B8680]">FidClic route chaque client vers SA PA automatiquement.</span>
        </div>
      )}

      {/* Import / récupération de données */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-[#57534E] mb-2">Données du dossier</div>
        <div className="flex gap-2 flex-wrap">
          <label className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer" style={PLUM}>
            {busy === 'imp-inv' ? 'Import…' : '⬆︎ Importer factures (CSV/FEC/XLSX/XML)'}
            <input type="file" accept=".csv,.txt,.xlsx,.xml" className="hidden" onChange={onImportInvoices} />
          </label>
          <label className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer" style={PLUM}>
            {busy === 'imp-bank' ? 'Import…' : '⬆︎ Importer relevé (CSV/OFX)'}
            <input type="file" accept=".csv,.ofx" className="hidden" onChange={onImportBank} />
          </label>
          <button onClick={onSyncReceived} disabled={busy === 'sync'}
                  className="text-xs px-2.5 py-1.5 rounded-lg border" style={GREY}>
            {busy === 'sync' ? 'Sync…' : '🔄 Synchroniser factures reçues'}
          </button>
        </div>
      </div>

      {/* Chapter 4 — OCR + Saisie */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#57534E]">Factures fournisseurs (OCR + saisie)</div>
          <div className="flex gap-2">
            <label className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer"
                   style={PLUM}>
              {busy === 'ocr' ? 'Lecture…' : '📷 Lire une facture'}
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={onFile} />
            </label>
            <button onClick={runSaisie} disabled={busy === 'saisie'}
                    className="text-xs px-2.5 py-1.5 rounded-lg border" style={GREY}>
              🤖 Proposer les écritures
            </button>
          </div>
        </div>
        {pendingSaisie.length === 0 ? (
          <div className="text-xs text-[#8B8680]">Aucune écriture en attente. Lisez une facture, puis « Proposer les écritures ».</div>
        ) : (
          <div className="space-y-1.5">
            {pendingSaisie.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-semibold text-[#1C1917]">{e.supplier || 'Fournisseur'}</span>
                <span className="text-[#8B8680]">{e.piece_ref}</span>
                <span className={e.balanced ? 'text-[#2F7A52]' : 'text-[#C0392B]'}>
                  {e.balanced ? 'équilibrée' : 'déséquilibrée'} · {money(e.total_debit)}
                </span>
                <button onClick={() => validate(e.id)}
                        className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-lg border"
                        style={{ borderColor: 'rgba(63,156,107,.4)', color: '#2F7A52' }}>
                  Valider ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chapter 8 — Le Conseiller + La Mémoire */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#57534E]">Le Conseiller (opportunités) &amp; La Mémoire</div>
          <div className="flex gap-2">
            <button onClick={addNote} className="text-xs px-2.5 py-1.5 rounded-lg border" style={GREY}>+ Note</button>
            <button onClick={runConseiller} disabled={busy === 'conseil'}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={PLUM}>
              🤖 Analyser
            </button>
          </div>
        </div>
        {openConseils.length === 0 ? (
          <div className="text-xs text-[#8B8680]">Aucune opportunité en attente.</div>
        ) : (
          <div className="space-y-1.5">
            {openConseils.map((c) => (
              <div key={c.id} className="text-xs rounded-lg p-2" style={{ background: 'rgba(224,169,43,.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1C1917]">{c.title}</span>
                  <button onClick={() => dismiss(c.id)} className="ml-auto text-[10px] text-[#8B8680]">Ignorer</button>
                </div>
                <div className="text-[#57534E] mt-0.5">{c.message}</div>
              </div>
            ))}
          </div>
        )}
        {notes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notes.map((n) => (
              <span key={n.id} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(87,83,78,.08)', color: '#57534E' }}
                    title={n.kind}>📌 {n.text}</span>
            ))}
          </div>
        )}
      </div>

      {/* Le Lettrage — rapprochement bancaire */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#57534E]">Le Lettrage (rapprochement bancaire)</div>
          <button onClick={runLettrage} disabled={busy === 'lettrage'}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={PLUM}>
            🤖 Rapprocher
          </button>
        </div>
        {pendingLettrage.length === 0 ? (
          <div className="text-xs text-[#8B8680]">Aucun rapprochement en attente.</div>
        ) : (
          <div className="space-y-1.5">
            {pendingLettrage.map((x) => (
              <div key={x.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-semibold text-[#1C1917]">{x.invoice_number}</span>
                <span className="text-[#8B8680]">{money(x.amount)} · {x.basis} · {Math.round((x.confidence || 0) * 100)}%</span>
                <button onClick={() => validateLettrage(x.id)}
                        className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-lg border"
                        style={{ borderColor: 'rgba(63,156,107,.4)', color: '#2F7A52' }}>
                  Valider ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Le Gardien — points de vigilance */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#57534E]">Le Gardien (points de vigilance)</div>
          <button onClick={runGardien} disabled={busy === 'gardien'}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={PLUM}>
            🤖 Contrôler
          </button>
        </div>
        {openFindings.length === 0 ? (
          <div className="text-xs text-[#8B8680]">Aucune anomalie signalée.</div>
        ) : (
          <div className="space-y-1.5">
            {openFindings.map((f) => (
              <div key={f.id} className="text-xs rounded-lg p-2"
                   style={{ background: f.severity === 'warning' ? 'rgba(192,57,43,.07)' : 'rgba(224,169,43,.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1C1917]">{f.title}</span>
                  <button onClick={() => resolveFinding(f.id)} className="ml-auto text-[10px] text-[#8B8680]">Résoudre</button>
                </div>
                <div className="text-[#57534E] mt-0.5">{f.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Le Réviseur — revue avant validation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#57534E]">Le Réviseur (revue avant validation)</div>
          <button onClick={runRevision} disabled={busy === 'revision'}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={PLUM}>
            🤖 Réviser
          </button>
        </div>
        {!revision ? (
          <div className="text-xs text-[#8B8680]">Aucune revue lancée.</div>
        ) : (
          <div className="text-xs text-[#57534E]">
            {revision.reviewed} facture(s) revue(s) · <b className="text-[#2F7A52]">{revision.ready} prête(s)</b> ·
            <b className="text-[#C0392B]"> {revision.to_fix} à corriger</b>
          </div>
        )}
      </div>

      {/* TVA / CA3 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#57534E]">TVA / CA3</div>
          <button onClick={runTva} disabled={busy === 'tva'}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={PLUM}>
            🤖 Calculer la TVA
          </button>
        </div>
        {tva.length === 0 ? (
          <div className="text-xs text-[#8B8680]">Aucune déclaration calculée.</div>
        ) : (
          <div className="space-y-1.5">
            {tva.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-[#8B8680]">{d.period_start} → {d.period_end}</span>
                <span className="text-[#8B8680]">collectée {money(d.tva_collectee)} · déductible {money(d.tva_deductible)}</span>
                <span className="font-semibold ml-auto"
                      style={{ color: d.sens === 'a_payer' ? '#C0392B' : '#2F7A52' }}>
                  {d.sens === 'a_payer' ? `à payer ${money(d.tva_nette)}` : `crédit ${money(d.credit_a_reporter)}`}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,134,128,.12)', color: '#57534E' }}>brouillon</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
