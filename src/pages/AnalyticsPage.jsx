import React, { useEffect, useMemo, useState } from 'react';
import { ownerAPI } from '../lib/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, TrendingUp, Award, Smartphone, Gift, Calendar,
  Activity, X, Trophy, ArrowDown, ArrowUp, CreditCard,
  AlertCircle,
} from 'lucide-react';
import TierBadge from '../components/TierBadge';

const TIER_COLORS = { bronze: '#8B6914', silver: '#A8A8A8', gold: '#E3A869' };
const ACQ_COLORS = ['#B85C38', '#E3A869', '#4A5D23', '#7B3F00', '#5B8DEF', '#AA6EBE', '#8B6914'];

// ------------------------------------------------------------------
// Small presentational pieces
// ------------------------------------------------------------------
const KPICard = ({ icon: Icon, title, value, sublabel, onClick, accent = '#B85C38' }) => (
  <div
    onClick={onClick}
    className={`bg-white p-5 rounded-xl border border-[#E7E5E4] flex items-center gap-4 ${
      onClick ? 'cursor-pointer hover:shadow-md transition' : ''
    }`}
  >
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
      style={{ background: accent }}
    >
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-[#57534E] uppercase tracking-wide font-semibold truncate">{title}</p>
      <p className="text-2xl font-bold text-[#1C1917] leading-tight">{value}</p>
      {sublabel && <p className="text-xs text-[#8B8680] mt-0.5 truncate">{sublabel}</p>}
    </div>
  </div>
);

const ChartCard = ({ title, hint, children }) => (
  <div className="bg-white p-6 rounded-xl border border-[#E7E5E4]">
    <h2
      className="text-xl font-semibold text-[#1C1917]"
      style={{ fontFamily: 'Cormorant Garamond' }}
    >
      {title}
    </h2>
    {hint && <p className="text-xs text-[#8B8680] mt-1 mb-3">{hint}</p>}
    {children}
  </div>
);

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------
const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cardsFilled, setCardsFilled] = useState(null);
  const [highestPaying, setHighestPaying] = useState([]);
  const [recovered, setRecovered] = useState(null);
  const [acquisition, setAcquisition] = useState([]);

  const [recoveryInactiveDays, setRecoveryInactiveDays] = useState(30);
  const [recoveryWindowDays, setRecoveryWindowDays] = useState(30);
  const [rankingMode, setRankingMode] = useState('top_paying'); // top_paying | least_paying | max_visits | least_visits

  const [drill, setDrill] = useState(null); // { title, rows }

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        ownerAPI.getAnalytics(),
        ownerAPI.getAnalyticsSummary(),
        ownerAPI.getCardsFilled(),
        ownerAPI.getHighestPaying(),
        ownerAPI.getAcquisitionSources(),
      ]);
      const [a, s, cf, hp, acq] = results;
      if (a.status === 'fulfilled') setAnalytics(a.value.data);
      if (s.status === 'fulfilled') setSummary(s.value.data);
      if (cf.status === 'fulfilled') setCardsFilled(cf.value.data);
      if (hp.status === 'fulfilled') setHighestPaying(hp.value.data || []);
      if (acq.status === 'fulfilled') setAcquisition(acq.value.data?.sources || []);
      // If ALL failed, surface a single error
      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        const first = results[0];
        setLoadError(first.reason?.response?.status
          ? `Error ${first.reason.response.status}: ${first.reason.response.data?.detail || first.reason.message}`
          : first.reason?.message || 'Failed to load analytics');
      }
    } catch (e) {
      setLoadError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Refetch recovered when the filter changes
  useEffect(() => {
    (async () => {
      try {
        const r = await ownerAPI.getRecovered({
          inactive_days: recoveryInactiveDays,
          window_days: recoveryWindowDays,
        });
        setRecovered(r.data);
      } catch (e) {
        // ignore — keep previous value
      }
    })();
  }, [recoveryInactiveDays, recoveryWindowDays]);

  // ----------------------------------------------------------------
  // Derived values — canonical numbers only, no Math.random()
  // ----------------------------------------------------------------
  const totalCustomers = analytics?.total_customers ?? summary?.total_customers ?? 0;
  const totalVisits = analytics?.total_visits ?? 0;
  const repeatRate = analytics?.repeat_rate_pct ?? 0;
  const walletPasses = analytics?.wallet_passes_issued ?? 0;
  const activeCustomers = summary?.active_customers ?? 0;
  const newThisWeek = summary?.new_this_week ?? 0;
  const cardsFilledTotal = cardsFilled?.total_cards_filled ?? 0;
  const cardsFilledThisMonth = cardsFilled?.cards_filled_this_month ?? 0;

  const tierData = useMemo(() => {
    const td = analytics?.tier_distribution || {};
    return [
      { name: 'Bronze', value: td.bronze || 0, key: 'bronze' },
      { name: 'Silver', value: td.silver || 0, key: 'silver' },
      { name: 'Gold', value: td.gold || 0, key: 'gold' },
    ];
  }, [analytics]);

  const visitsByDay = useMemo(() => {
    if (!analytics?.visits_by_day) return [];
    return Object.entries(analytics.visits_by_day)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // show last 30 days in the chart
  }, [analytics]);

  const newCustomersByWeek = useMemo(() => {
    const w = analytics?.new_customers_by_week || {};
    return Object.entries(w).map(([week, count]) => ({ week, count }));
  }, [analytics]);

  const acquisitionChart = useMemo(
    () => (acquisition || []).map((a) => ({
      name: (a.source || 'unknown').replace(/_/g, ' '),
      value: a.count,
    })),
    [acquisition]
  );

  // Ranking tabs
  const rankedCustomers = useMemo(() => {
    const list = [...(highestPaying || [])];
    switch (rankingMode) {
      case 'top_paying':
        return list.sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0)).slice(0, 20);
      case 'least_paying':
        return list
          .filter((c) => (c.total_amount_paid || 0) > 0) // ignore zero-spend noise
          .sort((a, b) => (a.total_amount_paid || 0) - (b.total_amount_paid || 0))
          .slice(0, 20);
      case 'max_visits':
        return list.sort((a, b) => (b.total_visits || 0) - (a.total_visits || 0)).slice(0, 20);
      case 'least_visits':
        return list
          .filter((c) => (c.total_visits || 0) > 0)
          .sort((a, b) => (a.total_visits || 0) - (b.total_visits || 0))
          .slice(0, 20);
      default:
        return list.slice(0, 20);
    }
  }, [highestPaying, rankingMode]);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  if (loading) {
    return <div className="p-8 bg-[#FDFBF7] min-h-screen text-[#57534E]">Loading analytics…</div>;
  }

  if (loadError && !analytics) {
    return (
      <div className="p-8 bg-[#FDFBF7] min-h-screen">
        <div className="max-w-xl mx-auto bg-white border border-[#E7E5E4] rounded-xl p-8 text-center">
          <AlertCircle className="mx-auto mb-2 text-[#B85C38]" size={32} />
          <h2 className="text-2xl font-bold text-[#B85C38] mb-2">Analytics failed to load</h2>
          <p className="text-[#57534E] text-sm mb-4">{loadError}</p>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-[#B85C38] text-white rounded-lg font-medium hover:bg-[#9C4E2F]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen">
      <header>
        <h1
          className="text-4xl font-bold text-[#1C1917] mb-2"
          style={{ fontFamily: 'Cormorant Garamond' }}
        >
          Analytics
        </h1>
        <p className="text-[#57534E]">
          Every number on this page is live and matches Dashboard & Insights. Click any card to drill in.
        </p>
      </header>

      {/* Row 1 — canonical KPIs (same source of truth as Dashboard) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          title="Total Customers"
          value={totalCustomers.toLocaleString()}
          sublabel={`${newThisWeek} new this week`}
          accent="#B85C38"
        />
        <KPICard
          icon={Activity}
          title="Total Visits"
          value={totalVisits.toLocaleString()}
          sublabel="All time"
          accent="#4A5D23"
        />
        <KPICard
          icon={TrendingUp}
          title="Repeat Rate"
          value={`${repeatRate.toFixed(1)}%`}
          sublabel={`${activeCustomers} active (30d)`}
          accent="#E3A869"
        />
        <KPICard
          icon={Smartphone}
          title="Wallet Passes"
          value={walletPasses.toLocaleString()}
          sublabel={`${totalCustomers ? Math.round((walletPasses / totalCustomers) * 100) : 0}% of customers`}
          accent="#7B3F00"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={CreditCard}
          title="Cards Filled"
          value={cardsFilledTotal.toLocaleString()}
          sublabel={`${cardsFilledThisMonth} this month`}
          accent="#4A5D23"
        />
        <KPICard
          icon={Gift}
          title="Recovered Customers"
          value={(recovered?.count ?? summary?.recovered_count ?? 0).toLocaleString()}
          sublabel={`${recovered?.percentage ?? summary?.recovered_pct ?? 0}% of total`}
          onClick={() =>
            setDrill({
              title: 'Recovered Customers',
              rows: recovered?.customers || [],
              columns: [
                { key: 'name', label: 'Customer' },
                { key: 'email', label: 'Email' },
                { key: 'tier', label: 'Tier', render: (v) => <TierBadge tier={v} /> },
                { key: 'last_inactive_date', label: 'Gap started', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                { key: 'returned_date', label: 'Returned', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
              ],
            })
          }
          accent="#B85C38"
        />
        <KPICard
          icon={Award}
          title="Active Customers"
          value={activeCustomers.toLocaleString()}
          sublabel="Visited in last 30 days"
          accent="#E3A869"
        />
        <KPICard
          icon={Calendar}
          title="New This Week"
          value={newThisWeek.toLocaleString()}
          sublabel="Joined in last 7 days"
          accent="#5B8DEF"
        />
      </section>

      {/* Row 2 — visits by day + new customers by week */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Visits over the last 30 days" hint="Daily visits recorded by staff scans.">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={visitsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="date" stroke="#57534E" tick={{ fontSize: 10 }} />
              <YAxis stroke="#57534E" />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#B85C38" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="New customers by week" hint="Weekly registrations over the last 12 weeks.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={newCustomersByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="week" stroke="#57534E" tick={{ fontSize: 10 }} />
              <YAxis stroke="#57534E" />
              <Tooltip />
              <Bar dataKey="count" fill="#4A5D23" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Row 3 — tier + acquisition */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Customer Tier Distribution" hint="How your loyalty tiers are spread.">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={tierData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                dataKey="value"
                labelLine={false}
                label={({ name, value }) =>
                  totalCustomers
                    ? `${name}: ${value} (${Math.round((value / totalCustomers) * 100)}%)`
                    : `${name}: ${value}`
                }
              >
                {tierData.map((t, i) => (
                  <Cell key={i} fill={TIER_COLORS[t.key] || '#B85C38'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Acquisition Sources" hint="How customers found you in the last 90 days.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={acquisitionChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis type="number" stroke="#57534E" />
              <YAxis type="category" dataKey="name" stroke="#57534E" width={110} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {acquisitionChart.map((_, i) => (
                  <Cell key={i} fill={ACQ_COLORS[i % ACQ_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Row 4 — Recovered Customers Filter (PROPER LABELS + INPUTS) */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-6">
        <h3
          className="text-xl font-semibold text-[#1C1917] mb-2"
          style={{ fontFamily: 'Cormorant Garamond' }}
        >
          Customize Recovered Customers Filter
        </h3>
        <p className="text-sm text-[#57534E] mb-4">
          "Customers who were quiet for X days and came back in the last Y days"
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#57534E]">Inactive for</label>
            <input
              type="number"
              min="1"
              value={recoveryInactiveDays}
              onChange={(e) => setRecoveryInactiveDays(parseInt(e.target.value) || 30)}
              className="w-20 px-2 py-1 border border-[#E7E5E4] rounded text-center"
            />
            <span className="text-sm text-[#57534E]">days,</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#57534E]">came back in last</label>
            <input
              type="number"
              min="1"
              value={recoveryWindowDays}
              onChange={(e) => setRecoveryWindowDays(parseInt(e.target.value) || 30)}
              className="w-20 px-2 py-1 border border-[#E7E5E4] rounded text-center"
            />
            <span className="text-sm text-[#57534E]">days</span>
          </div>
          <div className="ml-auto text-sm text-[#1C1917] font-medium">
            <span className="text-[#B85C38] font-bold">{recovered?.count ?? 0}</span> customers match
            {' '}
            <span className="text-[#8B8680]">({recovered?.percentage ?? 0}% of base)</span>
          </div>
        </div>
      </section>

      {/* Row 5 — Customer Ranking Tabs */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3
            className="text-xl font-semibold text-[#1C1917]"
            style={{ fontFamily: 'Cormorant Garamond' }}
          >
            Customer Ranking
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'top_paying', label: 'Top Paying', icon: Trophy },
              { key: 'least_paying', label: 'Least Paying', icon: ArrowDown },
              { key: 'max_visits', label: 'Max Visits', icon: ArrowUp },
              { key: 'least_visits', label: 'Least Visits', icon: ArrowDown },
            ].map((t) => {
              const Icon = t.icon;
              const active = rankingMode === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setRankingMode(t.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-[#B85C38] text-white'
                      : 'bg-[#F3EFE7] text-[#57534E] hover:bg-[#E7E5E4]'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E7E5E4] text-[#57534E]">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Tier</th>
                <th className="py-2 px-3 text-right">Visits</th>
                <th className="py-2 px-3 text-right">Spent</th>
              </tr>
            </thead>
            <tbody>
              {rankedCustomers.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-[#8B8680]">No customers to rank yet.</td></tr>
              ) : (
                rankedCustomers.map((c, i) => (
                  <tr key={c.id || i} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7]">
                    <td className="py-2 px-3 text-[#8B8680]">{i + 1}</td>
                    <td className="py-2 px-3 font-medium text-[#1C1917]">{c.name || '—'}</td>
                    <td className="py-2 px-3 text-[#57534E] text-xs">{c.email || '—'}</td>
                    <td className="py-2 px-3"><TierBadge tier={c.tier} /></td>
                    <td className="py-2 px-3 text-right">{c.total_visits ?? 0}</td>
                    <td className="py-2 px-3 text-right">€{(c.total_amount_paid ?? 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drill-down modal */}
      {drill && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDrill(null)}
        >
          <div
            className="bg-white rounded-xl max-w-5xl w-full max-h-[85vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3
                className="text-2xl font-bold text-[#1C1917]"
                style={{ fontFamily: 'Cormorant Garamond' }}
              >
                {drill.title}
              </h3>
              <button
                onClick={() => setDrill(null)}
                className="text-[#A8A29E] hover:text-[#1C1917]"
              >
                <X size={22} />
              </button>
            </div>
            {(!drill.rows || drill.rows.length === 0) ? (
              <p className="text-[#57534E] py-8 text-center">No matching records.</p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E7E5E4] text-[#57534E]">
                    {drill.columns.map((c) => (
                      <th key={c.key} className="py-2 px-3">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drill.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[#E7E5E4]">
                      {drill.columns.map((c) => (
                        <td key={c.key} className="py-2 px-3 text-[#1C1917]">
                          {c.render ? c.render(r[c.key]) : (r[c.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
