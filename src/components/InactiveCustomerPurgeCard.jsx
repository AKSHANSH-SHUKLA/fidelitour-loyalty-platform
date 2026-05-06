import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import { C } from './PageShell';

/**
 * InactiveCustomerPurgeCard — Settings card for item 31.
 *
 * Two-step flow:
 *   1. Owner picks the inactivity threshold (days) → "Preview" button runs
 *      a dry-run on the backend and shows how many customers would be deleted.
 *   2. Owner clicks "Confirm soft delete" to actually run the purge. Deleted
 *      customers are restorable for 30 days.
 *
 * Trash list shows everything in the 30-day grace window with a Restore button.
 */
const InactiveCustomerPurgeCard = ({ id }) => {
  const [days, setDays] = useState(365);
  const [includeNeverVisited, setIncludeNeverVisited] = useState(false);
  const [preview, setPreview] = useState(null); // { would_delete, candidates, cutoff_date }
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trash, setTrash] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);

  const loadTrash = async () => {
    setTrashLoading(true);
    try {
      const r = await ownerAPI.getCustomerTrash();
      setTrash(r.data?.trash || []);
    } catch (e) {
      // non-fatal
    } finally {
      setTrashLoading(false);
    }
  };

  useEffect(() => { loadTrash(); }, []);

  const runPreview = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const r = await ownerAPI.purgeInactiveCustomers({
        days: Number(days),
        dry_run: true,
        include_never_visited: !!includeNeverVisited,
      });
      setPreview(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const commitDelete = async () => {
    if (!preview) return;
    setCommitting(true);
    setError('');
    try {
      const r = await ownerAPI.purgeInactiveCustomers({
        days: Number(days),
        dry_run: false,
        include_never_visited: !!includeNeverVisited,
      });
      setSuccess(`Soft-deleted ${r.data?.deleted || 0} customer(s). Restorable for 30 days.`);
      setPreview(null);
      loadTrash();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Delete failed');
    } finally {
      setCommitting(false);
    }
  };

  const restore = async (id) => {
    try {
      await ownerAPI.restoreCustomer(id);
      loadTrash();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Restore failed');
    }
  };

  return (
    <section
      id={id}
      className="rounded-2xl p-6 space-y-4"
      style={{
        background: 'white',
        border: `1px solid ${C.hairline}`,
        boxShadow: '0 1px 2px rgba(28,25,23,0.04)',
      }}
    >
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold" style={{ fontFamily: 'Cormorant Garamond', color: C.inkDeep }}>
            🧹 Nettoyer les clients inactifs
          </h2>
          <p className="text-sm mt-1" style={{ color: C.inkMute }}>
            Soft-supprime les clients qui ne sont pas revenus depuis longtemps.
            Restorable pendant 30 jours, puis effacement définitif.
          </p>
        </div>
        <div
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: '#FEF3C7', color: '#854F0B' }}
        >
          <AlertTriangle size={12} /> Action sensible — confirmation à 2 étapes
        </div>
      </header>

      {/* Threshold + preview */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs font-bold uppercase tracking-wider" style={{ color: C.inkMute }}>
          Inactif depuis (jours)
          <input
            type="number"
            min="30"
            max="3650"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="mt-1 w-32 px-3 py-2 rounded-lg border text-sm font-semibold"
            style={{ borderColor: C.hairline, color: C.inkDeep }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: C.inkSoft }}>
          <input
            type="checkbox"
            checked={includeNeverVisited}
            onChange={(e) => setIncludeNeverVisited(e.target.checked)}
          />
          Inclure les clients qui ne sont jamais venus
        </label>
        <button
          onClick={runPreview}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold border transition"
          style={{ borderColor: C.terracotta, color: C.terracotta }}
        >
          {loading ? 'Calcul…' : 'Aperçu'}
        </button>
      </div>

      {/* Preview result + commit */}
      {preview && (
        <div
          className="rounded-xl p-4"
          style={{
            background: '#FEF7EE',
            border: `1px solid ${C.ochre}55`,
          }}
        >
          <p className="text-sm" style={{ color: C.inkDeep }}>
            <strong>{preview.would_delete}</strong> client(s) seront soft-supprimés.
            Cutoff : {new Date(preview.cutoff_date).toLocaleDateString()}.
          </p>
          {preview.candidates && preview.candidates.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1" style={{ color: C.inkMute }}>
              {preview.candidates.slice(0, 20).map((c) => (
                <li key={c.id}>
                  • {c.name || 'Sans nom'} · {c.visits || 0} visites · dernière {c.last_visit_date ? new Date(c.last_visit_date).toLocaleDateString() : 'jamais'}
                </li>
              ))}
              {preview.candidates.length > 20 && (
                <li>… et {preview.candidates.length - 20} de plus</li>
              )}
            </ul>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={commitDelete}
              disabled={committing || preview.would_delete === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ background: preview.would_delete === 0 ? '#D6D3D1' : C.terracotta }}
            >
              {committing ? 'Suppression…' : `Confirmer la suppression (${preview.would_delete})`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold border"
              style={{ borderColor: C.hairline, color: C.inkSoft }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: C.terracotta }}>⚠ {error}</p>}
      {success && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: C.sage }}>
          <ShieldCheck size={13} /> {success}
        </p>
      )}

      {/* Trash list */}
      {trash.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#F4F4F0', border: `1px solid ${C.hairline}` }}
        >
          <p className="text-sm font-bold mb-2" style={{ color: C.inkDeep }}>
            🗑️ Corbeille ({trash.length}) — restorable pendant 30 jours
          </p>
          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {trash.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-xs gap-2 bg-white px-3 py-2 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold" style={{ color: C.inkDeep }}>
                    {c.name || c.phone || c.email || c.id}
                  </p>
                  <p className="truncate" style={{ color: C.inkMute }}>
                    {c.delete_reason} · supprimé {c.deleted_at ? new Date(c.deleted_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <button
                  onClick={() => restore(c.id)}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-md transition"
                  style={{ background: C.sage + '15', color: C.sage }}
                >
                  <RotateCcw size={12} /> Restaurer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default InactiveCustomerPurgeCard;
