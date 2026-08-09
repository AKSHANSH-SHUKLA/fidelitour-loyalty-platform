/**
 * DaypartConfigCard — owner-editable time segmentation periods.
 *
 * A bakery doesn't have "dinner". A wine bar doesn't have "breakfast".
 * Each business defines their own time periods. Persisted on the tenant doc.
 */
import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Clock, Save, Plus, Trash2 } from 'lucide-react';
import { C as C_PS } from './PageShell';

const PRESETS = {
  cafe:        [{ name: 'Breakfast', start: 7, end: 11 }, { name: 'Lunch', start: 11, end: 14 }, { name: 'Afternoon', start: 14, end: 19 }],
  boulangerie: [{ name: 'Morning', start: 6, end: 11 }, { name: 'Lunch', start: 11, end: 14 }, { name: 'Afternoon', start: 14, end: 19 }],
  restaurant:  [{ name: 'Lunch', start: 12, end: 15 }, { name: 'Afternoon', start: 15, end: 18 }, { name: 'Dinner', start: 18, end: 23 }],
  salon:       [{ name: 'Morning', start: 9, end: 12 }, { name: 'Afternoon', start: 12, end: 17 }, { name: 'Evening', start: 17, end: 20 }],
  retail:      [{ name: 'Morning', start: 10, end: 13 }, { name: 'Afternoon', start: 13, end: 17 }, { name: 'Evening', start: 17, end: 20 }],
};

const DaypartConfigCard = () => {
  const [dayparts, setDayparts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    api.get('/owner/settings/dayparts')
      .then((res) => setDayparts(res.data?.dayparts || []))
      .catch(() => setDayparts(PRESETS.cafe));
  }, []);

  const updatePart = (i, patch) => {
    setDayparts((curr) => curr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const addPart = () => setDayparts([...dayparts, { name: 'Nouvelle période', start: 8, end: 12 }]);
  const removePart = (i) => setDayparts(dayparts.filter((_, idx) => idx !== i));
  const usePreset = (key) => setDayparts(PRESETS[key].map((p) => ({ ...p, raw: p.name.toLowerCase().replace(/ /g, '_') })));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/owner/settings/dayparts', {
        dayparts: dayparts.map((p) => ({
          name: p.name,
          raw: (p.raw || p.name || 'period').toString().toLowerCase().replace(/ /g, '_'),
          start: parseInt(p.start, 10) || 0,
          end:   parseInt(p.end,   10) || 24,
        })),
      });
      setSavedAt(new Date());
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 mt-6" style={{ border: `1px solid ${C_PS.hairline}` }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: `${C_PS.terracotta}1A`, color: C_PS.terracotta }}>
          <Clock size={18} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: C_PS.inkDeep }}>
            Périodes de la journée
          </h2>
          <p className="text-sm mt-1" style={{ color: C_PS.inkMute }}>
            Définissez les périodes qui font sens pour votre commerce. Une boulangerie n'a pas
            besoin de "dîner", un bar à vin n'a pas besoin de "petit-déjeuner". L'analytics se
            calculera selon vos propres tranches horaires.
          </p>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="text-[10px] font-bold uppercase tracking-widest self-center" style={{ color: C_PS.inkMute }}>
          Modèles rapides :
        </span>
        {Object.keys(PRESETS).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => usePreset(k)}
            className="px-3 py-1 text-xs rounded-full border transition"
            style={{ borderColor: C_PS.hairline, background: 'var(--flc-card, #FFFFFF)', color: C_PS.inkSoft }}
          >
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {dayparts.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg" style={{ background: 'var(--flc-paper2, #FAFAF8)', border: `1px solid ${C_PS.hairline}` }}>
            <input
              className="col-span-4 border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: C_PS.hairline }}
              value={p.name}
              onChange={(e) => updatePart(i, { name: e.target.value })}
              placeholder="Nom (ex: Brunch)"
            />
            <div className="col-span-3 flex items-center gap-1.5">
              <span className="text-[10px] font-bold" style={{ color: C_PS.inkMute }}>de</span>
              <input
                type="number" min={0} max={23}
                className="w-full border rounded-lg px-2 py-2 text-sm text-center"
                style={{ borderColor: C_PS.hairline }}
                value={p.start}
                onChange={(e) => updatePart(i, { start: e.target.value })}
              />
              <span className="text-[10px]" style={{ color: C_PS.inkMute }}>h</span>
            </div>
            <div className="col-span-3 flex items-center gap-1.5">
              <span className="text-[10px] font-bold" style={{ color: C_PS.inkMute }}>à</span>
              <input
                type="number" min={0} max={30}
                className="w-full border rounded-lg px-2 py-2 text-sm text-center"
                style={{ borderColor: C_PS.hairline }}
                value={p.end}
                onChange={(e) => updatePart(i, { end: e.target.value })}
              />
              <span className="text-[10px]" style={{ color: C_PS.inkMute }}>h</span>
            </div>
            <button
              type="button"
              onClick={() => removePart(i)}
              className="col-span-2 text-xs rounded-lg py-2 transition"
              style={{ background: '#FEF2F2', color: '#991B1B', border: `1px solid #FECACA` }}
            >
              <Trash2 size={12} className="inline mr-1" /> Retirer
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={addPart}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border"
          style={{ borderColor: C_PS.hairline, color: C_PS.inkSoft, background: 'var(--flc-card, #FFFFFF)' }}
        >
          <Plus size={12} /> Ajouter une période
        </button>
      </div>

      <div className="flex items-center gap-3 mt-5 pt-5 border-t" style={{ borderColor: C_PS.hairline }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
          style={{ background: C_PS.terracotta }}
        >
          <Save size={14} />
          {saving ? 'Enregistrement…' : 'Enregistrer mes périodes'}
        </button>
        {savedAt && (
          <span className="text-xs" style={{ color: '#4A5D23' }}>
            ✓ Enregistré à {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
};

export default DaypartConfigCard;
