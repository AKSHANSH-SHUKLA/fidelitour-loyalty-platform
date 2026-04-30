import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { C as C_PS } from './PageShell';

/**
 * Drop-in chart for AnalyticsPage: shows new-customer acquisition over a
 * configurable time range — far beyond the existing 12-week chart.
 *
 * Talks to the additive backend module `features/analytics_history.py`.
 * The existing 12-week chart is left untouched.
 */
const HistoricalAcquisitionChart = () => {
  const [unit, setUnit] = useState('weeks');
  const [count, setCount] = useState(52);
  const [data, setData] = useState([]);
  const [bucketUnit, setBucketUnit] = useState('weeks');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = unit === 'all' ? { unit } : { unit, count };
        const res = await api.get('/owner/analytics/history/new-customers', { params });
        setData(res.data?.series || []);
        setBucketUnit(res.data?.bucket_unit || unit);
        setTotal(res.data?.total_new_customers || 0);
      } catch (e) {
        console.error('Historical acquisition load failed', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [unit, count]);

  const presets = [
    { unit: 'weeks',  count: 12,  label: 'Last 12 weeks' },
    { unit: 'weeks',  count: 26,  label: 'Last 6 months' },
    { unit: 'weeks',  count: 52,  label: 'Last 12 months' },
    { unit: 'months', count: 24,  label: 'Last 24 months' },
    { unit: 'all',    count: null, label: 'All time' },
  ];

  return (
    <div className="rounded-xl bg-white p-6 mt-6" style={{ border: `1px solid ${C_PS.hairline}` }}>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${C_PS.sage}1A`, color: C_PS.sage }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: C_PS.inkDeep }}>
              Customer acquisition history
            </h2>
            <p className="text-sm mt-1" style={{ color: C_PS.inkMute }}>
              See further back than the default 12 weeks. Bucketing adapts automatically — days, weeks, or months — based on the range.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border rounded-lg px-3 py-1.5 text-sm"
            style={{ borderColor: C_PS.hairline }}
            value={`${unit}:${count ?? ''}`}
            onChange={(e) => {
              const [u, c] = e.target.value.split(':');
              setUnit(u);
              setCount(c === '' ? null : Number(c));
            }}
          >
            {presets.map((p) => (
              <option key={p.label} value={`${p.unit}:${p.count ?? ''}`}>{p.label}</option>
            ))}
          </select>
          {unit !== 'all' && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={520}
                value={count || 0}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-20 border rounded-lg px-2 py-1.5 text-sm"
                style={{ borderColor: C_PS.hairline }}
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm"
                style={{ borderColor: C_PS.hairline }}
              >
                <option value="days">days</option>
                <option value="weeks">weeks</option>
                <option value="months">months</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        <KPI label="Total new customers" value={total} />
        <KPI label="Buckets shown" value={data.length} />
        <KPI label="Granularity" value={bucketUnit} />
      </div>

      <div className="h-72">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: C_PS.inkMute }}>
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: C_PS.inkMute }}>
            No customer signups in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="label" stroke="#57534E" fontSize={11}
                interval={data.length > 30 ? Math.floor(data.length / 12) : 0} />
              <YAxis stroke="#57534E" fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill={C_PS.sage} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const KPI = ({ label, value }) => (
  <div className="rounded-lg p-3" style={{ background: '#F3EFE7' }}>
    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C_PS.inkMute }}>{label}</p>
    <p className="text-lg font-bold" style={{ color: C_PS.inkDeep }}>{value}</p>
  </div>
);

export default HistoricalAcquisitionChart;
