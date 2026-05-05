/**
 * Visits-over-time chart with day/week/month/year selector.
 *
 * Mirrors HistoricalAcquisitionChart but reads /history/visits and shows
 * both total visits AND unique visitors per bucket.
 */
import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Activity, Users, Repeat } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { C as C_PS } from './PageShell';

const PRESETS = [
  { unit: 'days',   count: 7,  label: '7 derniers jours' },
  { unit: 'days',   count: 14, label: '14 derniers jours' },
  { unit: 'days',   count: 30, label: '30 derniers jours' },
  { unit: 'weeks',  count: 12, label: '12 dernières semaines' },
  { unit: 'weeks',  count: 26, label: '26 dernières semaines' },
  { unit: 'weeks',  count: 52, label: '52 dernières semaines' },
  { unit: 'months', count: 6,  label: '6 derniers mois' },
  { unit: 'months', count: 12, label: '12 derniers mois' },
  { unit: 'months', count: 24, label: '24 derniers mois' },
  { unit: 'years',  count: 3,  label: '3 dernières années' },
  { unit: 'years',  count: 5,  label: '5 dernières années' },
  { unit: 'all',    count: null, label: 'Depuis le début' },
];

const VisitsOverTimeChart = () => {
  const [presetIdx, setPresetIdx] = useState(2); // default 30 days
  const [data, setData] = useState([]);
  const [bucketUnit, setBucketUnit] = useState('days');
  const [total, setTotal] = useState(0);
  const [avgPerBucket, setAvgPerBucket] = useState(0);
  const [loading, setLoading] = useState(true);

  const preset = PRESETS[presetIdx];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = preset.unit === 'all'
          ? { unit: 'all' }
          : { unit: preset.unit, count: preset.count };
        const res = await api.get('/owner/analytics/history/visits', { params });
        setData(res.data?.series || []);
        setBucketUnit(res.data?.bucket_unit || preset.unit);
        setTotal(res.data?.total_visits || 0);
        setAvgPerBucket(res.data?.average_per_bucket || 0);
      } catch (e) {
        console.error('Visits history load failed', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [presetIdx]);

  const avgLabel = (() => {
    if (bucketUnit === 'days')   return 'Visites par jour';
    if (bucketUnit === 'weeks')  return 'Visites par semaine';
    if (bucketUnit === 'months') return 'Visites par mois';
    if (bucketUnit === 'years')  return 'Visites par année';
    return 'Visites par période';
  })();

  // Total unique visitors across the range (sum of bucket-level uniques is approximate, but useful)
  const uniqueVisitorsTotal = data.reduce((s, b) => s + (b.unique_visitors || 0), 0);

  return (
    <div className="rounded-xl bg-white p-6 mt-6" style={{ border: `1px solid ${C_PS.hairline}` }}>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: `${C_PS.terracotta}1A`, color: C_PS.terracotta }}>
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: C_PS.inkDeep }}>
              Visites dans le temps
            </h2>
            <p className="text-sm mt-1" style={{ color: C_PS.inkMute }}>
              Visualisez vos visites par jour, semaine, mois ou année — avec le nombre
              de clients uniques qui se sont déplacés à chaque période.
            </p>
          </div>
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm font-medium"
          style={{ borderColor: C_PS.hairline, background: 'white', minWidth: 220 }}
          value={presetIdx}
          onChange={(e) => setPresetIdx(parseInt(e.target.value, 10))}
        >
          {PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        <KPI label="Visites totales sur la période" value={total} accent={C_PS.terracotta} icon={Activity} />
        <KPI label={avgLabel} value={avgPerBucket} accent={C_PS.sage} icon={Repeat} />
        <KPI label="Granularité" accent={C_PS.lavender}
             value={({ days: 'jours', weeks: 'semaines', months: 'mois', years: 'années' })[bucketUnit] || bucketUnit} />
      </div>

      <div className="h-72">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: C_PS.inkMute }}>
            Chargement…
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: C_PS.inkMute }}>
            Aucune visite enregistrée sur cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="label" stroke="#57534E" fontSize={11}
                interval={data.length > 30 ? Math.floor(data.length / 12) : 0} />
              <YAxis stroke="#57534E" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar  name="Visites totales"  dataKey="count"            fill={C_PS.terracotta} radius={[6, 6, 0, 0]} />
              <Line name="Clients uniques"  dataKey="unique_visitors"  stroke={C_PS.sage}     strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const KPI = ({ label, value, accent, icon: Icon }) => (
  <div
    className="rounded-xl p-3 flex items-center gap-3"
    style={{
      background: `linear-gradient(135deg, white 0%, ${accent ? accent + '12' : '#F3EFE7'} 100%)`,
      border: `1px solid ${accent ? accent + '33' : C_PS.hairline}`,
    }}
  >
    {Icon && (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'white', boxShadow: `0 4px 10px ${accent || C_PS.terracotta}33` }}
      >
        <Icon size={16} style={{ color: accent || C_PS.terracotta }} />
      </div>
    )}
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: C_PS.inkMute }}>{label}</p>
      <p className="text-lg font-bold leading-tight" style={{ color: C_PS.inkDeep }}>{value}</p>
    </div>
  </div>
);

export default VisitsOverTimeChart;
