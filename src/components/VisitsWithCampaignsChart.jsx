import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { Megaphone, Send, Eye, MousePointerClick, Users, X } from 'lucide-react';
import {
  ComposedChart, Bar, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { C as C_PS } from './PageShell';
import TimeRangeSelector from './TimeRangeSelector';

/**
 * Visits-by-day chart with campaign send markers overlaid.
 *
 * - Bars = daily visit counts (last N days, default 30)
 * - Scatter dots in a contrasting purple = days a campaign was sent
 * - Click a dot to see that campaign's details + performance below
 *
 * Data comes from the additive backend endpoint
 *   GET /api/owner/analytics/history/visits-with-campaigns?days=N
 *
 * Existing visits/analytics endpoints are NOT touched.
 */
const CAMPAIGN_COLOR = '#7C3AED';   // distinct vivid purple — different from any other chart on the platform

const VisitsWithCampaignsChart = () => {
  const [range, setRange] = useState({ unit: 'days', count: 30 });
  const [data, setData] = useState({ visit_series: [], campaign_markers: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  const days = TimeRangeSelector.toDays(range) ?? 30;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/owner/analytics/history/visits-with-campaigns', { params: { days } });
        setData(res.data || { visit_series: [], campaign_markers: [] });
      } catch (e) {
        console.error('visits-with-campaigns load failed', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  // Merge visits + campaign markers into a single dataset Recharts can render.
  // Each row has both a `visits` bar value and (if a campaign was sent that day)
  // a `campaign_y` scatter value pinned to a constant — visible above all bars.
  const chartData = useMemo(() => {
    const sentSet = new Set((data.campaign_markers || []).map((c) => c.sent_date));
    const maxVisit = Math.max(1, ...(data.visit_series || []).map((d) => d.visits || 0));
    const markerY = Math.ceil(maxVisit * 1.15) + 1;
    return (data.visit_series || []).map((d) => ({
      date: d.date,
      visits: d.visits,
      campaign_y: sentSet.has(d.date) ? markerY : null,
    }));
  }, [data]);

  const fmtTickDate = (s) => {
    if (!s) return '';
    const [, m, day] = s.split('-');
    return `${day}/${m}`;
  };
  const fmtFullDate = (d) => {
    if (!d) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Find which campaign was sent on a given day (for click + tooltip)
  const campaignsOnDate = (date) =>
    (data.campaign_markers || []).filter((c) => c.sent_date === date);

  const selectedCampaign = (data.campaign_markers || []).find((c) => c.id === selectedCampaignId);

  // Custom tooltip — when hovering on a day with campaigns, show their names too
  const TooltipContent = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const visits = payload.find((p) => p.dataKey === 'visits')?.value ?? 0;
    const camps = campaignsOnDate(label);
    return (
      <div className="rounded-lg p-3 shadow-md text-xs"
        style={{ background: 'white', border: `1px solid ${C_PS.hairline}` }}>
        <p className="font-bold mb-1" style={{ color: C_PS.inkDeep }}>{fmtFullDate(label)}</p>
        <p style={{ color: C_PS.inkMute }}>Visits: <span className="font-bold" style={{ color: C_PS.terracotta }}>{visits}</span></p>
        {camps.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: C_PS.hairline }}>
            <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: CAMPAIGN_COLOR }}>
              Campaign{camps.length > 1 ? 's' : ''} sent
            </p>
            {camps.map((c) => (
              <p key={c.id} className="font-semibold" style={{ color: CAMPAIGN_COLOR }}>• {c.name}</p>
            ))}
            <p className="text-[10px] mt-1" style={{ color: C_PS.inkMute }}>Click the marker to inspect.</p>
          </div>
        )}
      </div>
    );
  };

  const onScatterClick = (point) => {
    if (!point || !point.date) return;
    const camps = campaignsOnDate(point.date);
    if (camps.length === 0) return;
    setSelectedCampaignId(camps[0].id);
  };

  return (
    <div className="rounded-xl bg-white p-6 mt-6" style={{ border: `1px solid ${C_PS.hairline}` }}>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${CAMPAIGN_COLOR}1A`, color: CAMPAIGN_COLOR }}>
            <Megaphone size={18} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: C_PS.inkDeep }}>
              Visits with campaign markers
            </h2>
            <p className="text-sm mt-1" style={{ color: C_PS.inkMute }}>
              Daily visits, with a purple marker on every day a campaign was sent.
              Click a marker to inspect that campaign's performance.
            </p>
          </div>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} allowAllTime={false} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <KPI label="Visits in range" value={data.totals?.visits ?? 0} />
        <KPI label="Campaigns sent" value={data.totals?.campaigns_sent ?? 0} accent={CAMPAIGN_COLOR} />
        <KPI label="Range" value={`${days} days`} />
      </div>

      <div className="h-80">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: C_PS.inkMute }}>Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="date" tickFormatter={fmtTickDate} stroke="#57534E" fontSize={11}
                interval={Math.max(0, Math.floor(chartData.length / 12))} />
              <YAxis stroke="#57534E" fontSize={11} allowDecimals={false} />
              <Tooltip content={<TooltipContent />} />
              <Legend
                payload={[
                  { value: 'Visits', type: 'square', color: C_PS.terracotta },
                  { value: 'Campaign sent', type: 'circle', color: CAMPAIGN_COLOR },
                ]}
              />
              <Bar dataKey="visits" fill={C_PS.terracotta} radius={[4, 4, 0, 0]} />
              <Scatter
                name="Campaign sent"
                dataKey="campaign_y"
                fill={CAMPAIGN_COLOR}
                shape="circle"
                onClick={onScatterClick}
                cursor="pointer"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Campaign chips (click to inspect) */}
      {(data.campaign_markers || []).length > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: C_PS.hairline }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C_PS.inkMute }}>
            Campaigns in this range — click to inspect
          </p>
          <div className="flex flex-wrap gap-2">
            {data.campaign_markers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCampaignId(c.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition"
                style={{
                  background: selectedCampaignId === c.id ? CAMPAIGN_COLOR : `${CAMPAIGN_COLOR}1A`,
                  color: selectedCampaignId === c.id ? 'white' : CAMPAIGN_COLOR,
                  border: `1px solid ${CAMPAIGN_COLOR}55`,
                }}
              >
                <Send size={11} /> {c.name} · {fmtFullDate(c.sent_at)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected campaign details */}
      {selectedCampaign && (
        <div className="mt-4 rounded-xl p-4 relative"
          style={{ background: `${CAMPAIGN_COLOR}0D`, border: `1px solid ${CAMPAIGN_COLOR}33` }}>
          <button
            type="button"
            aria-label="Close campaign details"
            onClick={() => setSelectedCampaignId(null)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/40"
            style={{ color: CAMPAIGN_COLOR }}
          >
            <X size={14} />
          </button>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: CAMPAIGN_COLOR }}>
            Campaign details
          </p>
          <h3 className="text-lg font-bold mb-1" style={{ color: C_PS.inkDeep }}>{selectedCampaign.name}</h3>
          <p className="text-xs mb-3" style={{ color: C_PS.inkMute }}>
            Sent {fmtFullDate(selectedCampaign.sent_at)} · status {selectedCampaign.status}
          </p>
          {selectedCampaign.content_preview && (
            <p className="text-sm mb-3 italic" style={{ color: C_PS.inkSoft }}>
              "{selectedCampaign.content_preview}"
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Metric label="Targeted" value={selectedCampaign.targeted_count} icon={Users} />
            <Metric label="Delivered" value={selectedCampaign.delivered_count} icon={Send} />
            <Metric label="Opens" value={selectedCampaign.opens} icon={Eye} />
            <Metric label="Clicks" value={selectedCampaign.clicks} icon={MousePointerClick} />
            <Metric
              label="Visits attributed"
              value={selectedCampaign.visits_from_campaign}
              icon={Megaphone}
              hint="Visits within 15 days of send"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const KPI = ({ label, value, accent }) => (
  <div className="rounded-lg p-3" style={{ background: '#F3EFE7' }}>
    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C_PS.inkMute }}>{label}</p>
    <p className="text-lg font-bold" style={{ color: accent || C_PS.inkDeep }}>{value}</p>
  </div>
);

const Metric = ({ label, value, icon: Icon, hint }) => (
  <div className="rounded-lg p-2.5 bg-white" style={{ border: `1px solid ${C_PS.hairline}` }}>
    <div className="flex items-center gap-1.5 mb-0.5" style={{ color: CAMPAIGN_COLOR }}>
      <Icon size={12} />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-base font-bold" style={{ color: C_PS.inkDeep }}>{value ?? 0}</p>
    {hint && <p className="text-[10px] mt-0.5" style={{ color: C_PS.inkMute }}>{hint}</p>}
  </div>
);

export default VisitsWithCampaignsChart;
