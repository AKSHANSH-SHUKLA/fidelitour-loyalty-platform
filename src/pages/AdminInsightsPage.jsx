import React, { useEffect, useState } from 'react';
import { adminAPI } from '../lib/api';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  AlertCircle, Sparkles, Users, Euro, TrendingDown, Award, Store,
  CreditCard, Building2, Activity,
} from 'lucide-react';
import { PageHeader, C as C_PS } from '../components/PageShell';

const TIER_COLORS = { bronze: '#CADFF8', silver: '#93BEF0', gold: '#5297E7' };
const ACCENT = 'var(--blue, #0F6FDE)';

const StatPill = ({ label, value, sublabel, tone = 'default' }) => {
  const toneMap = {
    default: 'bg-white border-[var(--border,_#ECEFF4)] text-[var(--ink-head,_#030E1D)]',
    danger: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };
  return (
    <div className={`p-4 rounded-xl border ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</p>
      <p className="text-2xl font-bold leading-tight mt-1">{value}</p>
      {sublabel && <p className="text-xs opacity-75 mt-1">{sublabel}</p>}
    </div>
  );
};

const Card = ({ icon: Icon, title, hint, children }) => (
  <div className="bg-white p-6 rounded-xl border border-[var(--border,_#ECEFF4)]">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={18} className="text-[var(--blue-deep,_#1453BD)]" />}
      <h2 className="text-xl font-semibold text-[var(--ink-head,_#030E1D)]" style={{ fontFamily: 'Cormorant Garamond' }}>{title}</h2>
    </div>
    {hint && <p className="text-xs text-[var(--ink-muted,_#626F7E)] mb-4">{hint}</p>}
    {children}
  </div>
);

const AdminInsightsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await adminAPI.getInsights();
      setData(res.data);
    } catch (e) {
      setLoadError(
        e?.response?.status
          ? `Error ${e.response.status}: ${e.response.data?.detail || e.message}`
          : e?.message || 'Network error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInsights(); }, []);

  if (loading) return <div className="p-8 bg-[var(--surface-1,_#FFFFFF)] min-h-screen text-[var(--ink-body,_#556272)]">Loading Insights…</div>;

  if (loadError || !data) {
    return (
      <div className="p-8 bg-[var(--surface-1,_#FFFFFF)] min-h-screen">
        <div className="max-w-xl mx-auto bg-white border border-[var(--border,_#ECEFF4)] rounded-xl p-8 text-center">
          <AlertCircle className="mx-auto mb-2 text-[var(--blue-deep,_#1453BD)]" size={32} />
          <h2 className="text-2xl font-bold text-[var(--blue-deep,_#1453BD)] mb-2">Insights failed to load</h2>
          <p className="text-[var(--ink-body,_#556272)] text-sm mb-4">{loadError || 'No data'}</p>
          <button onClick={loadInsights} className="px-4 py-2 bg-[var(--blue,_#0F6FDE)] text-white rounded-lg font-medium hover:bg-[var(--blue-pressed,_#0D62C4)]">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totals = data.totals || {};
  const churn = data.churn || {};
  const ltv = data.ltv || {};
  const alerts = data.alerts || [];
  const top = data.top_performers || [];
  const atRisk = data.at_risk_performers || [];
  const sectors = data.sector_distribution || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform-Wide"
        title="Platform Insights"
        description="Smart alerts, churn signals, lifetime-value benchmarks and reactivation opportunities — aggregated across every business on FidéliTour."
        role="super_admin"
      />

      {/* Platform totals */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill label="Businesses" value={totals.tenants ?? 0} />
        <StatPill label="Customers" value={(totals.customers ?? 0).toLocaleString()} />
        <StatPill label="Total Visits" value={(totals.visits ?? 0).toLocaleString()} />
        <StatPill label="Active Wallet Cards" value={(totals.active_cards ?? 0).toLocaleString()} />
      </section>

      {/* Alerts */}
      <Card icon={AlertCircle} title="Platform Alerts" hint="Automatic warnings based on platform-wide behavior.">
        {alerts.length === 0 ? (
          <p className="text-sm text-[var(--ink-body,_#556272)]">No alerts right now — the platform is healthy.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  a.level === 'danger'
                    ? 'bg-red-50 border-red-200'
                    : a.level === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : a.level === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <span className="text-xl">{a.icon}</span>
                <div>
                  <p className="font-semibold text-[var(--ink-head,_#030E1D)]">{a.title}</p>
                  <p className="text-sm text-[var(--ink-body,_#556272)]">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Churn + LTV */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card icon={TrendingDown} title="Churn Across the Platform" hint="% of all customers in each risk bucket.">
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="One-visit only" value={`${churn.one_visit_only_pct ?? 0}%`} sublabel={`${churn.one_visit_only ?? 0} customers`} tone="warning" />
            <StatPill label="Inactive 30d" value={`${churn.inactive_30d_pct ?? 0}%`} sublabel={`${churn.inactive_30d ?? 0} customers`} tone="warning" />
            <StatPill label="Inactive 60d" value={`${churn.inactive_60d_pct ?? 0}%`} sublabel={`${churn.inactive_60d ?? 0} customers`} tone="danger" />
            <StatPill label="Churned (90d+)" value={`${churn.churned_90d_pct ?? 0}%`} sublabel={`${churn.churned_90d ?? 0} customers`} tone="danger" />
          </div>
        </Card>

        <Card icon={Euro} title="Lifetime Value (platform avg)" hint="Revenue per customer across every business.">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatPill label="Avg LTV" value={`€${(ltv.average_ltv ?? 0).toFixed(2)}`} tone="success" />
            <StatPill label="Median LTV" value={`€${(ltv.median_ltv ?? 0).toFixed(2)}`} />
            <StatPill label="Top-10% LTV" value={`€${(ltv.top_10_pct_ltv ?? 0).toFixed(2)}`} tone="success" />
          </div>
          {(ltv.by_tier || []).length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ltv.by_tier}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong, #CBD3DC)" />
                <XAxis dataKey="tier" stroke="var(--ink-body, #556272)" />
                <YAxis stroke="var(--ink-body, #556272)" />
                <Tooltip formatter={(v) => `€${Number(v).toLocaleString()}`} />
                <Bar dataKey="average_ltv" name="Avg LTV" radius={[8, 8, 0, 0]}>
                  {(ltv.by_tier || []).map((t, i) => (
                    <Cell key={i} fill={TIER_COLORS[t.tier] || ACCENT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </section>

      {/* Top performers + at-risk */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card icon={Award} title="Top Performing Businesses" hint="Ranked by total visits.">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-strong,_#CBD3DC)] text-[var(--ink-body,_#556272)]">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">Business</th>
                <th className="py-2 px-2">Plan</th>
                <th className="py-2 px-2 text-right">Customers</th>
                <th className="py-2 px-2 text-right">Visits</th>
                <th className="py-2 px-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t, i) => (
                <tr key={t.id} className="border-b border-[var(--border-strong,_#CBD3DC)] hover:bg-[var(--surface-2,_#F8F9FC)]">
                  <td className="py-2 px-2 text-[var(--ink-muted,_#626F7E)]">{i + 1}</td>
                  <td className="py-2 px-2 font-medium text-[var(--ink-head,_#030E1D)]">{t.name}</td>
                  <td className="py-2 px-2 uppercase text-xs font-bold">{t.plan}</td>
                  <td className="py-2 px-2 text-right">{t.customers}</td>
                  <td className="py-2 px-2 text-right">{t.visits}</td>
                  <td className="py-2 px-2 text-right">€{(t.revenue || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card icon={TrendingDown} title="Businesses at Risk" hint="Lowest visit counts among active tenants.">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-strong,_#CBD3DC)] text-[var(--ink-body,_#556272)]">
                <th className="py-2 px-2">Business</th>
                <th className="py-2 px-2">Plan</th>
                <th className="py-2 px-2 text-right">Customers</th>
                <th className="py-2 px-2 text-right">Visits</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border-strong,_#CBD3DC)] hover:bg-[var(--surface-2,_#F8F9FC)]">
                  <td className="py-2 px-2 font-medium text-[var(--ink-head,_#030E1D)]">{t.name}</td>
                  <td className="py-2 px-2 uppercase text-xs font-bold">{t.plan}</td>
                  <td className="py-2 px-2 text-right">{t.customers}</td>
                  <td className="py-2 px-2 text-right">{t.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Sector distribution */}
      <Card icon={Building2} title="Businesses by Sector" hint="Drives which reactivation template each commerce receives.">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sectors} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong, #CBD3DC)" />
            <XAxis type="number" stroke="var(--ink-body, #556272)" />
            <YAxis type="category" dataKey="sector" stroke="var(--ink-body, #556272)" width={120} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--green, #10BC4C)" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default AdminInsightsPage;
