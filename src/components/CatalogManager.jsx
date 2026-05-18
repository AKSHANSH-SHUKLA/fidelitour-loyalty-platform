/**
 * CatalogManager — owner-facing editor for the product / service catalog
 * that staff pick from on the scan page.
 *
 * Designed as a Settings section, not a wizard step (the owner can come
 * back and edit anytime). Layout: name + price + category per row, plus
 * an "+ Ajouter" button to add a row and a "Enregistrer" button to commit
 * all rows at once with a single PUT /api/owner/catalog call.
 *
 * The server assigns UUIDs to new rows, so the IDs are stable across
 * edits and visit records can reference items by ID forever.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { ownerAPI } from '../lib/api';

const blankRow = () => ({ id: null, name: '', price: '', category: '' });

export default function CatalogManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    ownerAPI.getCatalog?.()
      .then((r) => {
        if (!alive) return;
        const list = Array.isArray(r?.data?.items) ? r.data.items : [];
        // Seed with one blank row so the table is never empty.
        setItems(list.length > 0 ? list.map(it => ({ ...it, price: String(it.price ?? '') })) : [blankRow()]);
      })
      .catch((e) => { if (alive) setError(e?.response?.data?.detail || e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const updateRow = (i, field, value) => {
    setItems((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  };
  const addRow = () => setItems((prev) => [...prev, blankRow()]);
  const deleteRow = (i) => {
    setItems((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [blankRow()];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Skip rows where name is empty — they're scaffolding, not real items.
      const cleaned = items
        .filter((r) => (r.name || '').trim())
        .map((r) => ({
          id: r.id || undefined,
          name: r.name.trim(),
          price: Number(String(r.price).replace(',', '.')) || 0,
          category: (r.category || '').trim() || null,
        }));
      const r = await ownerAPI.putCatalog?.(cleaned);
      const list = Array.isArray(r?.data?.items) ? r.data.items : [];
      setItems(list.map((it) => ({ ...it, price: String(it.price ?? '') })));
      setSavedAt(new Date());
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Erreur d\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#8B8680' }}>
        Chargement du catalogue…
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E7E5E4', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1C1917' }}>
          🧾 Catalogue produits &amp; services
        </h3>
        {savedAt && (
          <span style={{ fontSize: 11, color: '#4F7A36' }}>
            ✓ Enregistré à {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#57534E', lineHeight: 1.5 }}>
        Listez ici tout ce que vous vendez avec son prix. Lors du scan,
        votre équipe sélectionnera les articles du panier dans cette
        liste — pas de saisie manuelle de montant, et les rapports
        analytiques (panier moyen, chiffre d'affaires, top produits)
        se rempliront automatiquement.
      </p>

      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1.2fr 36px',
        gap: 8, alignItems: 'center', marginBottom: 6,
        fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: '#8B8680', fontWeight: 600,
      }}>
        <span>Nom du produit / service</span>
        <span>Prix (€)</span>
        <span>Catégorie (optionnel)</span>
        <span></span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((row, i) => (
          <div key={row.id || `new-${i}`} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 36px',
            gap: 8, alignItems: 'center',
          }}>
            <input
              type="text"
              value={row.name}
              onChange={(e) => updateRow(i, 'name', e.target.value)}
              placeholder="Ex: Café crème"
              style={{ padding: '7px 10px', border: '1px solid #E7E5E4', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
            />
            <input
              type="text"
              inputMode="decimal"
              value={row.price}
              onChange={(e) => updateRow(i, 'price', e.target.value)}
              placeholder="2,50"
              style={{ padding: '7px 10px', border: '1px solid #E7E5E4', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}
            />
            <input
              type="text"
              value={row.category || ''}
              onChange={(e) => updateRow(i, 'category', e.target.value)}
              placeholder="Boisson"
              style={{ padding: '7px 10px', border: '1px solid #E7E5E4', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              type="button"
              onClick={() => deleteRow(i)}
              aria-label="Supprimer cette ligne"
              title="Supprimer"
              style={{
                width: 36, height: 36, borderRadius: 8,
                border: '1px solid #E7E5E4', background: 'white', cursor: 'pointer',
                display: 'grid', placeItems: 'center', color: '#B85C38',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={addRow}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: '1px solid #E7E5E4', background: 'white',
            cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: '#1C1917',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={14} /> Ajouter une ligne
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: 'none', background: saving ? '#B85C3855' : '#B85C38',
            color: 'white', cursor: saving ? 'wait' : 'pointer',
            fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
            marginLeft: 'auto',
          }}
        >
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer le catalogue'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 8,
          background: '#FCE3DC', color: '#7A2E20', fontSize: 12,
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
