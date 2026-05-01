import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, TrendingUp, Repeat, Award, DollarSign, Clock,
  ArrowUpRight, ArrowDownRight, UserPlus, Activity, AlertCircle, CheckCircle2, Gift, AlertTriangle, Star
} from 'lucide-react';
import TierBadge from '../components/TierBadge';
import { PageHeader, StatCard, Section, C } from '../components/PageShell';

const TIER_COLORS = { bronze: '#8B6914', silver: '#A8A8A8', gold: '#E3A869' };

const OwnerDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [cardsFilled, setCardsFilled] = useState(null);
  const [recovered, setRecovered] = useState(null);
  const [topSpender, setTopSpender] = useState(null);
  const [highestPaying, setHighestPaying] = useState([]);
  const [rankingMode, setRankingMode] = useState('max_spent'); // max_spent | min_spent | max_visits | min_visits
  const [showSendOfferModal, setShowSendOfferModal] = useState(null);
  const [sendOfferMessage, setSendOfferMessage] = useState('');
  const [sendOfferLoading, setSendOfferLoading] = useState(false);
  // Multi-store franchise analytics — populated only for tenants with ≥2 branches.
  const [branchPerformance, setBranchPerformance] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranch]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Branches first (lightweight, may affect selectedBranch)
      let branchList = [];
      try {
        const branchRes = await ownerAPI.getBranches();
        branchList = branchRes.data || [];
        setBranches(branchList);
      } catch (e) {
        console.warn('Branches fetch failed:', e?.message);
      }

      const analyticsParams = selectedBranch ? { branch_id: selectedBranch } : {};

      // Fetch all in parallel. ONE failure must NOT blank the whole dashboard.
      // Branch performance is the multi-store rollup — only meaningful when
      // the tenant actually has 2+ branches, but it's cheap (single query),
      // so we always request it and conditionally render below.
      const [analyticsRes, cardsRes, recoveredRes, topRes, summaryRes, branchPerfRes] = await Promise.allSettled([
        ownerAPI.getAnalytics(analyticsParams),
        ownerAPI.getCardsFilled(analyticsParams),
        ownerAPI.getRecovered({ inactive_days: 30, window_days: 30, ...analyticsParams }),
        ownerAPI.getHighestPaying(analyticsParams),
        ownerAPI.getAnalyticsSummary(analyticsParams),
        ownerAPI.getBranchPerformance({ period_days: 30 }),
      ]);

      if (analyticsRes.status === 'fulfilled') {
        setMetrics(analyticsRes.value.data);
      } else {
        console.warn('Analytics fetch failed:', analyticsRes.reason?.message);
        // Provide an empty scaffold so the page still renders (with zeroed KPIs)
        setMetrics({
          total_customers: 0, total_visits: 0, repeat_rate: '0%',
          tier_distribution: {}, visits_by_day: {}, new_customers_by_week: {},
          campaign_performance: [], visit_time_heatmap: {},
        });
      }
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (cardsRes.status === 'fulfilled') setCardsFilled(cardsRes.value.data);
      if (recoveredRes.status === 'fulfilled') setRecovered(recoveredRes.value.data);
      if (topRes.status === 'fulfilled') {
        const topList = topRes.value.data || [];
        setHighestPaying(topList);
        if (topList.length > 0) setTopSpender(topList[0]);
      }
      if (branchPerfRes.status === 'fulfilled') {
        setBranchPerformance(branchPerfRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendOfferToCustomer = async () => {
    if (!showSendOfferModal || !sendOfferMessage.trim()) return;
    try {
      setSendOfferLoading(true);
      await ownerAPI.sendCampaignToGroup({
        customer_ids: [showSendOfferModal.id],
        message: sendOfferMessage,
      });
      setSendOfferMessage('');
      setShowSendOfferModal(null);
    } catch (error) {
      console.error('Error sending offer:', error);
      alert('Failed to send offer');
    } finally {
      setSendOfferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3" style={{ color: C.inkMute }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.ochre }} />
          <span className="text-sm font-medium">Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm" style={{ color: C.terracotta }}>
          Failed to load analytics. Please refresh the page.
        </p>
      </div>
    );
  }

  // Parse metrics
  const totalCustomers = metrics.total_customers || 0;
  const totalVisits = metrics.total_visits || 0;
  const repeatRate = metrics.repeat_rate || '0%';
  const tierDist = metrics.tier_distribution || {};

  // Compute additional KPIs
  const goldCustomers = tierDist.gold || 0;
  const silverCustomers = tierDist.silver || 0;
  const bronzeCustomers = tierDist.bronze || 0;
  const avgVisitsPerCustomer = totalCustomers > 0 ? (totalVisits / totalCustomers).toFixed(1) : '0';

  // Visits by day chart data (last 30 days)
  const visitsByDay = metrics.visits_by_day || {};
  const visitChartData = Object.entries(visitsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, visits]) => ({
      date: date.substring(5),
      visits
    }));

  // New customers by week
  const newByWeek = metrics.new_customers_by_week || {};
  const newCustomersData = Object.entries(newByWeek)
    .map(([week, count]) => ({ week, count }))
    .reverse();

  // Tier distribution pie
  const tierPieData = [
    { name: 'Bronze', value: bronzeCustomers, fill: TIER_COLORS.bronze },
    { name: 'Silver', value: silverCustomers, fill: TIER_COLORS.silver },
    { name: 'Gold', value: goldCustomers, fill: TIER_COLORS.gold },
  ].filter(t => t.value > 0);

  // Campaign performance
  const campaignPerf = metrics.campaign_performance || [];

  // Visit heatmap
  const heatmap = metrics.visit_time_heatmap || {};

  const KPICard = ({ icon: Icon, title, value, subtitle, color = '#B85C38', bgColor = 'white', isAccent = false }) => (
    <div
      className="p-6 rounded-2xl border shadow-sm transition hover:shadow-md"
      style={{ backgroundColor: bgColor, borderColor: isAccent ? bgColor : '#E7E5E4' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: isAccent ? 'rgba(255,255,255,0.2)' : `${color}15` }}>
          <Icon size={20} style={{ color: isAccent ? '#FDFBF7' : color }} />
        </div>
        <p className="text-sm font-medium uppercase tracking-wider" style={{ fontFamily: 'Manrope', color: isAccent ? 'rgba(255,255,255,0.8)' : '#57534E' }}>
          {title}
        </p>
      </div>
      <p className="text-3xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: isAccent ? '#FDFBF7' : '#1C1917' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-2" style={{ fontFamily: 'Manrope', color: isAccent ? 'rgba(255,255,255,0.7)' : '#8B8680' }}>{subtitle}</p>
      )}
    </div>
  );

  const newThisMonth = Object.values(newByWeek).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Smart Alerts Banner */}
      {recovered && recovered.percentage > 10 && (
        <div
          className="relative p-4 rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${C.meadow} 0%, white 100%)`,
            border: `1px solid ${C.sage}55`,
          }}
        >
          <div className="flex items-center gap-3 relative">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${C.sage}33`, color: C.sage }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: C.inkDeep }}>
                Great news — {recovered.count} customers came back recently!
              </p>
              <p className="text-xs mt-0.5" style={{ color: C.inkMute }}>
                They were inactive for 30+ days but visited in the last 30 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {topSpender && topSpender.last_visit_date && (() => {
        const lastVisit = new Date(topSpender.last_visit_date);
        const now = new Date();
        const daysSince = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));
        return daysSince > 14 ? (
          <div
            className="relative p-4 rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, #FFF5E5 0%, white 100%)`,
              border: `1px solid ${C.ochre}55`,
            }}
          >
            <div className="flex items-center gap-3 relative">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${C.ochre}33`, color: C.ochre }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: C.inkDeep }}>
                  Your top customer hasn't visited in {daysSince} days — send them a thank-you offer?
                </p>
                <p className="text-xs mt-0.5" style={{ color: C.inkMute }}>
                  {topSpender.name} is your biggest supporter with €{topSpender.total_amount_paid} spent.
                </p>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <PageHeader
        eyebrow="Operational Overview"
        title="Welcome back"
        description="A live view of your loyalty programme — customers, visits, tiers, and what's working this week."
        role="business_owner"
        actions={
          branches.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedBranch(null)}
                className="px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedBranch === null
                    ? `linear-gradient(135deg, ${C.ochre}, ${C.terracotta})`
                    : 'white',
                  color: selectedBranch === null ? 'white' : C.inkSoft,
                  border: `1px solid ${selectedBranch === null ? 'transparent' : C.hairline}`,
                }}
              >
                All branches
              </button>
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranch(branch.id)}
                  className="px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: selectedBranch === branch.id
                      ? `linear-gradient(135deg, ${C.ochre}, ${C.terracotta})`
                      : 'white',
                    color: selectedBranch === branch.id ? 'white' : C.inkSoft,
                    border: `1px solid ${selectedBranch === branch.id ? 'transparent' : C.hairline}`,
                  }}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Total Customers"      value={totalCustomers.toLocaleString()} sublabel="Enrolled loyalty members"    icon={Users}      color={C.sky} />
        <StatCard label="Total Visits"         value={totalVisits.toLocaleString()}    sublabel="All-time recorded visits"    icon={Activity}   color={C.sage} />
        <StatCard label="Repeat Rate"          value={repeatRate}                       sublabel="Customers who returned"      icon={Repeat}     color={C.ochre} variant="dark" />
        <StatCard label="Gold Members"         value={goldCustomers}                    sublabel={`${totalCustomers > 0 ? Math.round((goldCustomers / totalCustomers) * 100) : 0}% of customers`} icon={Award} color={C.amber} />
        <StatCard label="Avg Visits / Cust."   value={avgVisitsPerCustomer}             sublabel="Higher = stronger loyalty"   icon={TrendingUp} color={C.lavender} />
        <StatCard label="New This Month"       value={newThisMonth}                     sublabel="Joined in the last 4 weeks"  icon={UserPlus}   color={C.teal} />
        {cardsFilled && (
          <StatCard label="Cards Filled"       value={cardsFilled.total_cards_filled || 0} sublabel="Complete rewards cycles earned" icon={Gift} color={C.sage} />
        )}
        {recovered && (
          <StatCard label="Recovered"          value={`${recovered.count}`}             sublabel={`${recovered.percentage}% came back after a quiet period`} icon={TrendingUp} color={C.teal} />
        )}
        {topSpender && (
          <StatCard label="Top Spender"        value={topSpender.name}                  sublabel={`€${topSpender.total_amount_paid} · ${topSpender.total_visits} visits`} icon={Users} color={C.terracotta} />
        )}
        {summary?.total_reviews > 0 && (
          <StatCard label="Avg Rating"
                    value={summary.average_rating != null ? `${summary.average_rating}/10` : '—'}
                    sublabel={`${summary.total_reviews} review${summary.total_reviews === 1 ? '' : 's'} · ${summary.negative_review_rate_pct}% negative`}
                    icon={Star} color={C.amber} />
        )}
      </div>

      {/* Multi-store franchise panel — visible only when the tenant has 2+
          branches. Lifted to its own section so a chain owner sees their
          location-by-location breakdown right after the topline KPIs, before
          the trend charts. */}
      {branchPerformance && Array.isArray(branchPerformance.branches) && branchPerformance.branches.length >= 2 && (
        <div className="rounded-2xl p-6 relative overflow-hidden"
             style={{ background: 'white', border: `1px solid ${C.hairline}`, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }}>
          <div aria-hidden="true" className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-15 pointer-events-none"
               style={{ background: C.lavender }} />
          <div aria-hidden="true" className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-10 pointer-events-none"
               style={{ background: C.ochre }} />

          <header className="relative flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.terracotta }}>
                Multi-Store · Last {branchPerformance.period_days || 30} days
              </p>
              <h2 className="font-['Cormorant_Garamond'] text-3xl font-bold mt-1" style={{ color: C.inkDeep }}>
                Branch Performance
              </h2>
              <p className="text-sm mt-1" style={{ color: C.inkMute }}>
                Side-by-side view of every location with period-over-period growth.
              </p>
            </div>
            {branchPerformance.tenant_total && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.inkMute }}>
                  Network Total
                </p>
                <p className="font-['Cormorant_Garamond'] text-3xl font-bold leading-none mt-1" style={{ color: C.inkDeep }}>
                  €{(branchPerformance.tenant_total.revenue_period || 0).toLocaleString('fr-FR')}
                </p>
                <p className="text-xs mt-0.5" style={{ color: C.inkMute }}>
                  {branchPerformance.tenant_total.visits_period} visits · €{branchPerformance.tenant_total.avg_ticket || 0} avg
                </p>
              </div>
            )}
          </header>

          <div className="relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {branchPerformance.branches.map((b, idx) => {
              // Rank-aware accent: leader = ochre, second = sky, others = sage/teal/lavender.
              const accents = [C.ochre, C.sky, C.sage, C.lavender, C.teal, C.rose];
              const accent = accents[idx % accents.length];
              const positive = (b.visits_delta_pct || 0) >= 0;
              const networkVisits = branchPerformance.tenant_total?.visits_period || 0;
              const sharePct = networkVisits > 0
                ? Math.round((b.visits_period / networkVisits) * 100)
                : 0;
              return (
                <div
                  key={b.id}
                  className="relative p-5 rounded-2xl overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${accent}0D 0%, white 60%)`,
                    border: `1px solid ${accent}33`,
                  }}
                >
                  {idx === 0 && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                         style={{ background: accent, color: 'white' }}>
                      Top branch
                    </div>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${accent}1A`, color: accent, border: `1px solid ${accent}33` }}
                    >
                      <Activity size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-['Cormorant_Garamond'] text-xl font-bold leading-tight" style={{ color: C.inkDeep }}>
                        {b.name}
                      </h3>
                      {b.address && (
                        <p className="text-[11px] truncate" style={{ color: C.inkMute }}>{b.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: C.inkMute }}>Visits</p>
                      <p className="font-['Cormorant_Garamond'] text-2xl font-bold leading-none mt-1" style={{ color: C.inkDeep }}>
                        {b.visits_period}
                      </p>
                      <p className="text-[10px] mt-1 font-semibold inline-flex items-center gap-0.5"
                         style={{ color: positive ? C.sage : C.terracotta }}>
                        <span>{positive ? '↑' : '↓'}</span>
                        <span>{Math.abs(b.visits_delta_pct || 0)}%</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: C.inkMute }}>Revenue</p>
                      <p className="font-['Cormorant_Garamond'] text-2xl font-bold leading-none mt-1" style={{ color: C.inkDeep }}>
                        €{Math.round(b.revenue_period || 0).toLocaleString('fr-FR')}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: C.inkMute }}>
                        €{b.avg_ticket_period || 0} avg
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: C.inkMute }}>Customers</p>
                      <p className="font-['Cormorant_Garamond'] text-2xl font-bold leading-none mt-1" style={{ color: C.inkDeep }}>
                        {b.customers}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: C.inkMute }}>
                        {b.active_customers} active
                      </p>
                    </div>
                  </div>

                  {/* Share of network visits — visual rail */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: C.inkMute }}>
                      <span className="font-semibold">Share of network visits</span>
                      <span style={{ color: accent }}>{sharePct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${accent}1A` }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${sharePct}%`,
                          background: `linear-gradient(90deg, ${accent}, ${accent}AA)`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Visits Over Time */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
            Visits Over Time (Last 30 Days)
          </h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitChartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid stroke="#F3EFE7" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#57534E', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Date', position: 'insideBottomRight', offset: -5, fill: '#8B8680', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: '#57534E', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Visits', angle: -90, position: 'insideLeft', fill: '#8B8680', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E7E5E4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'Manrope' }}
                />
                <Line type="monotone" dataKey="visits" stroke="#B85C38" strokeWidth={2.5} dot={{ r: 2, fill: '#B85C38' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Customers by Week */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
            New Customers by Week
          </h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newCustomersData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid stroke="#F3EFE7" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#57534E', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#57534E', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'New Signups', angle: -90, position: 'insideLeft', fill: '#8B8680', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E7E5E4', fontFamily: 'Manrope' }}
                />
                <Bar dataKey="count" fill="#2D7D9A" radius={[6, 6, 0, 0]} name="New Customers" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Customers with ranking tabs */}
      {highestPaying.length > 0 && (() => {
        const sorted = [...highestPaying].sort((a, b) => {
          switch (rankingMode) {
            case 'max_spent': return (b.total_amount_paid || 0) - (a.total_amount_paid || 0);
            case 'min_spent': return (a.total_amount_paid || 0) - (b.total_amount_paid || 0);
            case 'max_visits': return (b.total_visits || 0) - (a.total_visits || 0);
            case 'min_visits': return (a.total_visits || 0) - (b.total_visits || 0);
            default: return 0;
          }
        });
        const titleMap = {
          max_spent: 'Top Spenders',
          min_spent: 'Lowest Spenders',
          max_visits: 'Most Frequent Visitors',
          min_visits: 'Least Frequent Visitors',
        };
        return (
          <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                {titleMap[rankingMode]}
              </h2>
              <div className="flex rounded-lg border border-[#E7E5E4] overflow-hidden text-xs" style={{ fontFamily: 'Manrope' }}>
                {[
                  { key: 'max_spent', label: 'Max €' },
                  { key: 'min_spent', label: 'Min €' },
                  { key: 'max_visits', label: 'Max Visits' },
                  { key: 'min_visits', label: 'Min Visits' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setRankingMode(tab.key)}
                    className="px-3 py-1.5 border-r border-[#E7E5E4] last:border-r-0 transition-colors"
                    style={{
                      backgroundColor: rankingMode === tab.key ? '#B85C38' : 'white',
                      color: rankingMode === tab.key ? 'white' : '#57534E',
                      fontWeight: rankingMode === tab.key ? 600 : 500,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {sorted.slice(0, 5).map((customer, idx) => (
                <div key={customer.id || idx} className="flex items-center justify-between p-4 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-2xl font-bold text-[#B85C38]">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[#1C1917]" style={{ fontFamily: 'Manrope' }}>{customer.name}</p>
                        <TierBadge tier={customer.tier} size="xs" />
                      </div>
                      <p className="text-sm text-[#8B8680]">{customer.total_visits} visits</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="font-bold text-[#1C1917]">€{(customer.total_amount_paid || 0).toFixed(0)}</p>
                      <p className="text-xs text-[#8B8680]">spent</p>
                    </div>
                    <button
                      onClick={() => setShowSendOfferModal(customer)}
                      className="px-4 py-2 rounded-lg bg-[#B85C38] text-white font-semibold hover:bg-[#9C4E2F] transition text-sm"
                    >
                      Send offer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bottom Row — Tier Distribution + Campaign Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tier Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
            Customer Tier Distribution
          </h2>
          <div className="flex items-center gap-8">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    dataKey="value"
                    /* No on-slice labels — the side legend already shows
                       Gold/Silver/Bronze with counts. The previous labels
                       were colliding inside a 96px-wide donut. */
                  >
                    {tierPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontFamily: 'Manrope' }} formatter={(v, n) => [`${v} customers`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 flex-1">
              {[
                { name: 'Gold', count: goldCustomers, color: TIER_COLORS.gold },
                { name: 'Silver', count: silverCustomers, color: TIER_COLORS.silver },
                { name: 'Bronze', count: bronzeCustomers, color: TIER_COLORS.bronze },
              ].map(tier => (
                <div key={tier.name} className="flex items-center justify-between p-3 rounded-lg bg-[#F3EFE7]">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                    <span className="text-sm font-medium text-[#1C1917]" style={{ fontFamily: 'Manrope' }}>{tier.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#1C1917]">{tier.count}</span>
                    <span className="text-xs text-[#8B8680] ml-1">
                      ({totalCustomers > 0 ? Math.round((tier.count / totalCustomers) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Campaign Performance */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
              Campaign Performance
            </h2>
            <span className="text-[11px] text-[#8B8680]">
              Opens & visits per campaign, tagged by publishing channel.
            </span>
          </div>
          {campaignPerf.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>No campaigns sent yet</p>
            </div>
          ) : (() => {
            // Aggregate per channel for the KPI strip at top
            const perSource = {};
            let totalDelivered = 0, totalOpens = 0, totalVisits = 0;
            campaignPerf.forEach((c) => {
              const src = c.source || 'push';
              const row = perSource[src] || { count: 0, delivered: 0, opens: 0, visits: 0 };
              row.count += 1;
              row.delivered += c.delivered_count || 0;
              row.opens += c.opens_unique || c.opens || 0;
              row.visits += c.visits_after_send || 0;
              perSource[src] = row;
              totalDelivered += c.delivered_count || 0;
              totalOpens += c.opens_unique || c.opens || 0;
              totalVisits += c.visits_after_send || 0;
            });
            const sourceRows = Object.entries(perSource).sort((a, b) => b[1].delivered - a[1].delivered);
            const globalOpenPct = totalDelivered > 0 ? Math.round((totalOpens / totalDelivered) * 100) : 0;
            const globalVisitPct = totalDelivered > 0 ? Math.round((totalVisits / totalDelivered) * 100) : 0;
            return (
              <div className="space-y-4">
                {/* Aggregate KPI row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
                    <p className="text-[10px] text-[#8B8680] uppercase tracking-wider">Total delivered</p>
                    <p className="text-xl font-bold text-[#1C1917]">{totalDelivered}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
                    <p className="text-[10px] text-[#8B8680] uppercase tracking-wider">Opens</p>
                    <p className="text-xl font-bold text-[#B85C38]">{totalOpens} <span className="text-xs text-[#8B8680] font-normal">({globalOpenPct}%)</span></p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
                    <p className="text-[10px] text-[#8B8680] uppercase tracking-wider">Visits after</p>
                    <p className="text-xl font-bold text-[#4A5D23]">{totalVisits} <span className="text-xs text-[#8B8680] font-normal">({globalVisitPct}%)</span></p>
                  </div>
                </div>

                {/* Per-channel breakdown */}
                {sourceRows.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold text-[#57534E] uppercase tracking-wider mb-2">By channel</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {sourceRows.map(([src, row]) => {
                        const openPct = row.delivered > 0 ? Math.round((row.opens / row.delivered) * 100) : 0;
                        const visitPct = row.delivered > 0 ? Math.round((row.visits / row.delivered) * 100) : 0;
                        const label = src === 'push' ? 'Wallet Push' : src[0].toUpperCase() + src.slice(1);
                        return (
                          <div key={src} className="p-2.5 rounded bg-[#F3EFE7] border border-[#E7E5E4]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#1C1917]">{label}</span>
                              <span className="text-[10px] text-[#8B8680]">{row.count} sent</span>
                            </div>
                            <div className="text-[11px] text-[#57534E] mt-1">
                              Opens <b>{openPct}%</b> · Visits <b>{visitPct}%</b>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Latest campaigns list (limit 5) */}
                <div className="space-y-2">
                  {campaignPerf.slice(0, 5).map((camp, i) => {
                    const openPct = camp.delivered_count > 0
                      ? Math.round(((camp.opens_unique || camp.opens || 0) / camp.delivered_count) * 100)
                      : 0;
                    const visitPct = camp.delivered_count > 0
                      ? Math.round(((camp.visits_after_send || 0) / camp.delivered_count) * 100)
                      : 0;
                    const src = camp.source || 'push';
                    const srcLabel = src === 'push' ? 'Wallet Push' : src[0].toUpperCase() + src.slice(1);
                    return (
                      <div key={camp.id || i} className="p-3 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
                        <div className="flex justify-between items-center mb-1.5 gap-2">
                          <h3 className="font-semibold text-[#1C1917] text-sm truncate" style={{ fontFamily: 'Manrope' }}>{camp.name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#E7E5E4] text-[#57534E] font-medium whitespace-nowrap">
                            {srcLabel}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-[#57534E] flex-wrap" style={{ fontFamily: 'Manrope' }}>
                          <span>Delivered: <strong className="text-[#1C1917]">{camp.delivered_count}</strong></span>
                          <span>Opens: <strong className="text-[#B85C38]">{camp.opens_unique || camp.opens || 0}</strong> ({openPct}%)</span>
                          <span>Visits: <strong className="text-[#4A5D23]">{camp.visits_after_send}</strong> ({visitPct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Heatmap — When Do Customers Visit */}
      <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
          When Do Your Customers Usually Come In?
        </h2>
        <p className="text-sm text-[#8B8680] mb-6" style={{ fontFamily: 'Manrope' }}>
          Darker cells = more visits. Use this to time your campaigns for maximum impact.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: 'Manrope' }}>
            <thead>
              <tr className="bg-[#F3EFE7]">
                <th className="text-left py-3 px-3 text-[#57534E] font-semibold">Hour</th>
                {Object.keys(heatmap).map(day => (
                  <th key={day} className="text-center py-3 px-2 text-[#57534E] font-semibold">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(heatmap).length > 0 && Object.keys(Object.values(heatmap)[0] || {}).sort((a, b) => parseInt(a) - parseInt(b)).map(hour => {
                const maxCount = Math.max(...Object.values(heatmap).flatMap(d => Object.values(d)), 1);
                // Vibrant warm ramp (heat-map style): cream → butter → orange
                // → crimson. Each cell interpolates between adjacent stops so
                // cool/quiet hours stay light and busy hours pop in red.
                const STOPS = [
                  { p: 0.00, c: [0xFD, 0xFB, 0xF7] }, // cream
                  { p: 0.33, c: [0xFE, 0xF3, 0xC7] }, // butter
                  { p: 0.66, c: [0xF5, 0x9E, 0x0B] }, // orange
                  { p: 1.00, c: [0xB9, 0x1C, 0x1C] }, // crimson
                ];
                const lerpRamp = (t) => {
                  for (let i = 1; i < STOPS.length; i++) {
                    const a = STOPS[i - 1], b = STOPS[i];
                    if (t <= b.p) {
                      const span = b.p - a.p;
                      const local = span > 0 ? (t - a.p) / span : 0;
                      const lerp = (x, y) => Math.round(x + (y - x) * local);
                      return [lerp(a.c[0], b.c[0]), lerp(a.c[1], b.c[1]), lerp(a.c[2], b.c[2])];
                    }
                  }
                  return STOPS[STOPS.length - 1].c;
                };
                return (
                <tr key={hour} className="border-b border-[#F3EFE7]">
                  <td className="py-2 px-3 font-medium text-[#57534E]">{hour}:00</td>
                  {Object.keys(heatmap).map(day => {
                    const count = heatmap[day]?.[hour] || 0;
                    const intensity = count / maxCount;
                    const [r, g, bb] = lerpRamp(intensity);
                    const bgColor = count === 0 ? '#FDFBF7' : `rgb(${r}, ${g}, ${bb})`;
                    // Flip to white text once cells get dark enough.
                    const textColor = intensity > 0.55 ? '#FDFBF7' : '#1C1917';
                    return (
                      <td
                        key={day}
                        className="text-center py-2 px-2 font-semibold transition-colors"
                        style={{ backgroundColor: bgColor, color: textColor }}
                        title={`${count} visit${count === 1 ? '' : 's'}`}
                      >
                        {count || ''}
                      </td>
                    );
                  })}
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Offer Modal */}
      {showSendOfferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6" style={{ backgroundColor: '#FDFBF7' }}>
            <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
              Send Offer to {showSendOfferModal.name}
            </h3>
            <textarea
              value={sendOfferMessage}
              onChange={(e) => setSendOfferMessage(e.target.value)}
              placeholder="Enter your offer message..."
              className="w-full px-4 py-3 border-2 border-[#E7E5E4] rounded-lg focus:border-[#B85C38] focus:ring-0 outline-none resize-none"
              rows={4}
              style={{ fontFamily: 'Manrope', color: '#1C1917' }}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSendOfferModal(null);
                  setSendOfferMessage('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-[#E7E5E4] text-[#57534E] font-semibold hover:bg-[#F3EFE7] transition"
              >
                Cancel
              </button>
              <button
                onClick={sendOfferToCustomer}
                disabled={sendOfferLoading || !sendOfferMessage.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#B85C38] text-white font-semibold hover:bg-[#9C4E2F] disabled:opacity-50 transition"
              >
                {sendOfferLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
