/**
 * AnalyticsPageV2 — dark redesign.
 *
 * Phase 0 — shell scaffold + dark tokens.
 * Phase 1 (this commit) — page header + 5 KPI cards with real Sparkline.
 *
 * Data wiring:
 *   - getAnalyticsSummary() — total customers, total visits, repeat rate,
 *     wallet passes, VIP count, visits_by_day.
 *   - getKpiSparkline(kind, branchId) — per-metric 14-point trend. Visits
 *     uses the real visits_by_day series; the other 4 are DEMO until
 *     per-metric trend endpoints land (see services/analyticsExtra.js).
 */
import React, { useEffect, useState } from 'react';
import { Users, Activity, TrendingUp, Smartphone, Award, Calendar, Filter, Bell } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { ownerAPI } from '../lib/api';
import {
  getKpiSparkline,
  getRfmMatrix,
  getTopProducts,
  getHourlyMatrix,
  getNewVsReturning,
} from '../services/analyticsExtra';
import KpiCard from '../components/analytics/KpiCard';
import ChartCard from '../components/analytics/ChartCard';
import VisitsBarLineChart from '../components/analytics/VisitsBarLineChart';
import ChannelDonut from '../components/analytics/ChannelDonut';
import RfmHeatmap from '../components/analytics/RfmHeatmap';
import RevenueAreaChart from '../components/analytics/RevenueAreaChart';
import TopProductsList from '../components/analytics/TopProductsList';
import HoursHeatmap from '../components/analytics/HoursHeatmap';
import WeekdayBars from '../components/analytics/WeekdayBars';

const Eyebrow = ({ children }) => (
  <span className="av2-eyebrow">{children}</span>
);

const Placeholder = ({ label }) => (
  <div className="av2-placeholder">{label}</div>
);

/** Stylised pill — date range chip + filter / bell icon buttons.
 *  Phase 1 keeps them static; Phase 7 wires the calendar popover. */
const HeaderChip = ({ icon: Icon, children, dot = false, label }) => (
  <button
    type="button"
    aria-label={label || (typeof children === 'string' ? children : 'Filtre')}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: children ? '6px 11px' : 0,
      width: children ? undefined : 32, height: 32,
      justifyContent: 'center',
      background: 'hsl(228 30% 12%)',
      border: '1px solid hsl(230 32% 18%)',
      borderRadius: children ? 99 : 10,
      color: 'hsl(228 14% 81%)',
      fontSize: 12, fontWeight: 500,
      cursor: 'pointer', position: 'relative',
      font: 'inherit',
    }}
  >
    {Icon ? <Icon size={14} aria-hidden="true" /> : null}
    {children}
    {dot && (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 6, right: 6, width: 6, height: 6,
          borderRadius: '50%', background: 'hsl(352 89% 60%)',
        }}
      />
    )}
  </button>
);

export default function AnalyticsPageV2() {
  const { branchId } = useBranch();
  const [summary, setSummary] = useState(null);
  const [acqSources, setAcqSources] = useState(null);
  const [loading, setLoading] = useState(true);
  // 5 sparkline series, one per KPI. Empty arrays render flat.
  const [sparks, setSparks] = useState({
    customers: [], visits: [], repeat: [], wallet: [], vip: [],
  });
  // Phase 3 data — RFM matrix and top-products list. Both DEMO today.
  const [rfmMatrix, setRfmMatrix] = useState([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  const [topProducts, setTopProducts] = useState([]);
  // Phase 4 data — hours heatmap (real) + new-vs-returning split (DEMO).
  const [hours, setHours] = useState({ matrix: [], days: [], hours: [] });
  const [nvr, setNvr] = useState({ newPct: 0, returningPct: 0 });

  // Fetch summary + acquisition sources + 5 sparklines in parallel on
  // mount and on branch change.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = branchId ? { branch_id: branchId } : {};

    Promise.all([
      ownerAPI.getAnalyticsSummary?.(params).catch(() => null),
      ownerAPI.getAcquisitionSources?.(params).catch(() => null),
      getKpiSparkline('customers', branchId).catch(() => []),
      getKpiSparkline('visits',    branchId).catch(() => []),
      getKpiSparkline('repeat',    branchId).catch(() => []),
      getKpiSparkline('wallet',    branchId).catch(() => []),
      getKpiSparkline('vip',       branchId).catch(() => []),
      getRfmMatrix(branchId).catch(() => [[0,0,0],[0,0,0],[0,0,0]]),
      getTopProducts(branchId).catch(() => []),
      getHourlyMatrix(branchId).catch(() => ({ matrix: [], days: [], hours: [] })),
      getNewVsReturning(branchId).catch(() => ({ newPct: 0, returningPct: 0 })),
    ]).then(([s, a, c, v, r, w, vip, rfm, top, hrs, nv]) => {
      if (!alive) return;
      setSummary(s?.data || null);
      setAcqSources(a?.data?.breakdown || a?.data?.acquisition_breakdown || a?.data || null);
      setSparks({ customers: c, visits: v, repeat: r, wallet: w, vip });
      setRfmMatrix(rfm);
      setTopProducts(top);
      setHours(hrs);
      setNvr(nv);
    }).finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [branchId]);

  // ─── Phase 2 — derive visits chart series + channels donut data ───────
  //
  // Visits chart: take the last 30 days from summary.visits_by_day and
  // approximate "unique customers per day" as 60-75% of visits. Real
  // uniques would need a backend join; using a stable ratio here makes
  // the line readable without inventing data shape.
  const visitsChartData = React.useMemo(() => {
    const map = summary?.visits_by_day || {};
    const keys = Object.keys(map).sort();
    if (!keys.length) return [];
    const last = keys.slice(-30);
    return last.map((iso) => {
      const visits = Number(map[iso]) || 0;
      // Synthetic uniques: 65% of visits as a stable approximation.
      const uniques = Math.max(0, Math.round(visits * 0.65));
      // Short DD/MM label, only render every ~5th to avoid clutter.
      const d = new Date(iso + 'T00:00:00');
      const label = isFinite(d) ? `${d.getDate()}/${d.getMonth() + 1}` : iso;
      return { label, visits, uniques };
    });
  }, [summary]);

  // Channels donut: take the acquisition breakdown if present, sort by
  // value desc, keep the top 5 channels, fold the rest into "Autres".
  const channelDonutData = React.useMemo(() => {
    const raw = Array.isArray(acqSources) ? acqSources : [];
    if (!raw.length) return [];
    // Normalize: { source, count } or { name, value } -> { name, value }
    const norm = raw.map((row) => ({
      name: String(row.label || row.name || row.source || row.channel || 'Autres'),
      value: Number(row.count ?? row.value ?? 0) || 0,
    })).filter((r) => r.value > 0);
    norm.sort((a, b) => b.value - a.value);
    const top = norm.slice(0, 4);
    const rest = norm.slice(4);
    if (rest.length > 0) {
      const restTotal = rest.reduce((s, r) => s + r.value, 0);
      if (restTotal > 0) top.push({ name: 'Autres', value: restTotal });
    }
    return top;
  }, [acqSources]);

  const channelsTotal = channelDonutData.reduce((s, r) => s + r.value, 0);

  // ─── Phase 3 — Revenue series + headline.
  //
  // No backend revenue series today; derive a stand-in by multiplying
  // visits_by_day by an average ticket of €3.20 (typical café spend).
  // When a real revenue_by_day field lands we just swap this useMemo.
  const revenueSeries = React.useMemo(() => {
    const map = summary?.visits_by_day || {};
    const keys = Object.keys(map).sort();
    if (!keys.length) return [];
    const AVG_TICKET = 3.2; // EUR, demo
    return keys.slice(-30).map((iso) => ({
      x: iso,
      value: Math.round((Number(map[iso]) || 0) * AVG_TICKET),
    }));
  }, [summary]);
  const revenueTotal = revenueSeries.reduce((s, p) => s + (p.value || 0), 0);
  const revenueDelta = (() => {
    if (revenueSeries.length < 14) return null;
    const half = Math.floor(revenueSeries.length / 2);
    const a = revenueSeries.slice(0, half).reduce((s, p) => s + p.value, 0);
    const b = revenueSeries.slice(half).reduce((s, p) => s + p.value, 0);
    if (a <= 0) return null;
    return ((b - a) / a) * 100;
  })();

  // ─── Phase 4 — Weekday bars derived from hours matrix.
  // Sum each row of `hours.matrix` to get the total visits per weekday.
  // Short labels for the bar chart (L M M J V S D).
  const weekdayCounts = React.useMemo(() => {
    return (hours.matrix || []).map((row) => row.reduce((a, b) => a + b, 0));
  }, [hours]);
  const SHORT_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  // ─── Phase 4 — New vs Returning donut data shape.
  const nvrSegments = (nvr.newPct > 0 || nvr.returningPct > 0) ? [
    { name: 'Récurrent', value: Number(nvr.returningPct) || 0,
      gradientFrom: 'hsl(258 90% 66%)', gradientTo: 'hsl(263 70% 50%)' },
    { name: 'Nouveau',   value: Number(nvr.newPct) || 0,
      gradientFrom: 'hsl(187 85% 53%)', gradientTo: 'hsl(189 94% 43%)' },
  ] : [];

  // KPI values — fall back to safe defaults when summary is loading.
  const totalCustomers = summary?.total_customers ?? 0;
  const totalVisits = summary?.total_visits ?? 0;
  const repeatRatePct = typeof summary?.repeat_rate_pct === 'number'
    ? summary.repeat_rate_pct
    : Number((summary?.repeat_rate || '').toString().replace('%', '')) || 0;
  const walletPasses = summary?.wallet_passes_issued ?? 0;
  const vipCount = summary?.tier_distribution?.vip ?? 0;
  const walletPct = totalCustomers > 0 ? Math.round((walletPasses / totalCustomers) * 100) : 0;

  // Format helpers — thin & local so we don't pull in the heavy
  // PageShell helpers (which carry cream-theme color refs).
  const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');
  const fmtPct = (n) => `${Number(n || 0).toFixed(1)}`;

  return (
    <div className="fdt-analytics-v2">
      {/* Page header */}
      <header
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 18,
        }}
      >
        <div>
          <h1 className="av2-h1">Analytics</h1>
          <p className="av2-sub">
            Vue d'ensemble · <span className="av2-mono">14 Avr — 13 Mai</span>
            {branchId ? <span style={{ marginLeft: 8, opacity: 0.6 }}>· branche actuelle</span> : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <HeaderChip icon={Calendar}>14 Avr — 13 Mai</HeaderChip>
          <HeaderChip icon={Filter} label="Filtres" />
          <HeaderChip icon={Bell} label="Alertes" dot />
        </div>
      </header>

      {/* Three-column shell */}
      <div className="av2-shell">
        {/* ─── MAIN COLUMN ─── */}
        <main className="av2-main">
          {/* Phase 1 — KPI row, real data */}
          <section aria-labelledby="kpi-row-heading">
            <h2 id="kpi-row-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>
              Indicateurs principaux
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 12,
              }}
            >
              <KpiCard
                icon={Users}
                label="Clients"
                value={fmtNum(totalCustomers)}
                accent="purple"
                sparklineData={sparks.customers}
                loading={loading}
              />
              <KpiCard
                icon={Activity}
                label="Visites"
                value={fmtNum(totalVisits)}
                accent="cyan"
                sparklineData={sparks.visits}
                loading={loading}
              />
              <KpiCard
                icon={TrendingUp}
                label="Taux de retour"
                value={fmtPct(repeatRatePct)}
                unit="%"
                accent="pink"
                sparklineData={sparks.repeat}
                loading={loading}
              />
              <KpiCard
                icon={Smartphone}
                label="Wallet"
                value={fmtNum(walletPasses)}
                accent="emerald"
                sublabel={`${walletPct}% des clients`}
                sparklineData={sparks.wallet}
                loading={loading}
              />
              <KpiCard
                icon={Award}
                label="VIP"
                value={fmtNum(vipCount)}
                accent="orange"
                sparklineData={sparks.vip}
                loading={loading}
              />
            </div>
          </section>

          {/* Phase 2 — Visits chart + Channels donut */}
          <section aria-labelledby="phase-2-heading">
            <h2 id="phase-2-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>
              Visites dans le temps et canaux d'acquisition
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
              <ChartCard
                title="Visites dans le temps"
                chip={
                  <span
                    style={{
                      fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: 'hsl(228 11% 60%)', fontWeight: 500,
                    }}
                  >
                    30 derniers jours
                  </span>
                }
              >
                <VisitsBarLineChart data={visitsChartData} height={200} />
              </ChartCard>

              <ChartCard
                title="Canaux d'acquisition"
                chip={
                  channelsTotal > 0 ? (
                    <span
                      style={{
                        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'hsl(228 11% 60%)', fontWeight: 500,
                      }}
                    >
                      À vie
                    </span>
                  ) : null
                }
              >
                {channelDonutData.length > 0 ? (
                  <ChannelDonut
                    data={channelDonutData}
                    centerNum={channelsTotal.toLocaleString('fr-FR')}
                    centerLabel="Total"
                    size={140}
                  />
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: 180, color: 'hsl(228 11% 41%)', fontSize: 12 }}>
                    {loading ? 'Chargement…' : 'Aucune source d\'acquisition pour cette branche.'}
                  </div>
                )}
              </ChartCard>
            </div>
          </section>

          {/* Phase 3 — RFM + Revenue + Top products */}
          <section aria-labelledby="phase-3-heading">
            <h2 id="phase-3-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>
              Segments RFM, revenu et top produits
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12 }}>
              <ChartCard
                title="RFM Segments"
                chip={
                  <span style={{ fontSize: 10, color: 'hsl(228 11% 60%)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Récence × Fréquence
                  </span>
                }
              >
                <RfmHeatmap matrix={rfmMatrix} />
              </ChartCard>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <ChartCard padding={14}>
                  <RevenueAreaChart
                    total={fmtNum(revenueTotal)}
                    unit="€"
                    delta={revenueDelta}
                    data={revenueSeries}
                    label="Revenu — 30 derniers jours"
                    height={70}
                  />
                </ChartCard>
                <ChartCard title="Top produits">
                  <TopProductsList items={topProducts} />
                </ChartCard>
              </div>
            </div>
          </section>

          {/* Phase 4 — Hours, weekday, new vs returning */}
          <section aria-labelledby="phase-4-heading">
            <h2 id="phase-4-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>
              Heures de pointe, jours, nouveau vs récurrent
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.8fr 0.8fr', gap: 12 }}>
              <ChartCard title="Heures de pointe">
                <HoursHeatmap matrix={hours.matrix} days={hours.days} hours={hours.hours} />
              </ChartCard>

              <ChartCard title="Par jour">
                <WeekdayBars counts={weekdayCounts} days={SHORT_DAYS} height={110} />
              </ChartCard>

              <ChartCard title="Nouveau vs récurrent">
                {nvrSegments.length > 0 ? (
                  <ChannelDonut
                    data={nvrSegments}
                    centerNum={`${Math.round(nvr.returningPct)}%`}
                    centerLabel="Récurrent"
                    size={120}
                  />
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: 120, color: 'hsl(228 11% 41%)', fontSize: 12 }}>
                    Aucune donnée.
                  </div>
                )}
              </ChartCard>
            </div>
          </section>

          {/* Phase 5 — Automations */}
          <section aria-labelledby="phase-5-heading">
            <Eyebrow>Phase 5 · Automatisations</Eyebrow>
            <h2 id="phase-5-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>
              Automatisations
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }}>
              <Placeholder label="AutomationCard" />
              <Placeholder label="AutomationCard" />
              <Placeholder label="AutomationCard" />
              <Placeholder label="AutomationEmpty" />
            </div>
          </section>
        </main>

        {/* ─── RIGHT AI RAIL ─── */}
        <aside className="av2-rail" aria-label="Assistant IA et insights">
          <Eyebrow>Phase 6 · Right AI panel</Eyebrow>
          <Placeholder label="ScoreWidget" />
          <Placeholder label="Insights IA" />
          <Placeholder label="Actions rapides" />
          <Placeholder label="Assistant IA" />
        </aside>
      </div>
    </div>
  );
}
