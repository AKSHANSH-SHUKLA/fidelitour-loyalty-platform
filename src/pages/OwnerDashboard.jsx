import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Activity, TrendingUp, Smartphone, BadgeCheck, CreditCard, Trash2, Award,
  Plus, AlertTriangle, Moon, UserPlus, Bell, Sparkles, ChevronRight, X,
  Sun, RefreshCw, Clock, CheckCircle2, Calendar, Download, Settings as SettingsIcon, Info, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ownerAPI } from '../lib/api';
import { useBranch } from '../contexts/BranchContext';
import useTileMetric from '../hooks/useTileMetric';

/**
 * OwnerDashboard — premium loyalty dashboard.
 *
 * Faithful rebuild of the HTML mockup the client uploaded
 * (loyalty-dashboard-premium.html). Same layout, same colour palette,
 * same pixel rhythm — wired to the real backend data feeds.
 *
 * Sections (top to bottom in the main column):
 *   1. Real-time banner with branch chips
 *   2. AI recommendation panel
 *   3. Page header (Welcome back + LIVE pill + Nouvelle campagne)
 *   4. 8 pastel KPI tiles
 *   5. Customer status panel (Active / Dormant / At Risk / New + bar)
 *   6. Charts row 1: Visits twin chart + Acquisition weekly
 *   7. Charts row 2: Sources donut + Tier donut
 *   8. Churn & rétention panel
 *   9. LTV panel with breakdown table
 *  10. Plan usage panel
 *  11. Actions recommandées (4 tiles)
 *
 * Side column (right):
 *   - Alertes (4 cards)
 *   - Résumé rapide (4 rows)
 *   - Time filter pill
 *
 * Sidebar + top-toolbar live in DashboardLayout — this page only
 * controls the page contents.
 */

const fmtPct = (n, d = 1) => `${(typeof n === 'number' ? n : 0).toFixed(d)}%`;
const fmtNum = (n) => (n ?? 0).toLocaleString('fr-FR');
const fmtEUR = (n) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Vibrant Octoboard-style tier palette — saturated and joyful while
// still semantically aligned with the metal/level concept.
const TIER_COLORS = {
  bronze: '#D27A3E',
  silver: '#9AA6B3',
  gold:   '#E8A53B',
  vip:    '#9A6DBF',
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { branchId, setBranchId, branches } = useBranch();
  const [summary, setSummary] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [acqSources, setAcqSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAiStrip, setShowAiStrip] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      ownerAPI.getAnalyticsSummary?.({ ...(branchId ? { branch_id: branchId } : {}) }).catch(() => null),
      ownerAPI.getTenant?.().catch(() => null),
      ownerAPI.getAcquisitionSources?.({ ...(branchId ? { branch_id: branchId } : {}) }).catch(() => null),
    ]).then(([s, t, a]) => {
      if (!alive) return;
      setSummary(s?.data || null);
      setTenant(t?.data || null);
      setAcqSources(a?.data?.breakdown || a?.data?.acquisition_breakdown || a?.data || null);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [branchId]);

  // Per-metric live counts with sparkline series (for delta tracking).
  const newCustomers = useTileMetric({ metric: 'new_customers',    branchId, initial: { value: 7,  unit: 'day' }, withSeries: true });
  const activeCust   = useTileMetric({ metric: 'active_customers', branchId, initial: { value: 30, unit: 'day' }, withSeries: true });
  const inactive     = useTileMetric({ metric: 'inactive_customers', branchId, initial: { value: 30, unit: 'day' }, withSeries: true });
  const aboutToLose  = useTileMetric({ metric: 'about_to_lose',    branchId, initial: { value: 14, unit: 'day' }, withSeries: true });

  // Lifetime totals from summary
  const totalCustomers = summary?.total_customers ?? 0;
  const totalVisits    = summary?.total_visits ?? 0;
  const repeatRate     = summary?.repeat_rate ?? 0;
  const walletPasses   = summary?.wallet_passes_count ?? summary?.wallet_active_count ?? 0;
  const activeCards    = summary?.wallet_active_count ?? 0;
  const neverAdded     = summary?.wallet_never_added_count ?? 0;
  const deletedCards   = summary?.wallet_deleted_count ?? 0;
  const tierDist       = summary?.tier_distribution || {};
  const vipCount       = tierDist.vip ?? 0;
  const goldCount      = tierDist.gold ?? 0;
  const silverCount    = tierDist.silver ?? 0;
  const bronzeCount    = tierDist.bronze ?? 0;
  const pct = (n, total) => total > 0 ? Math.round((n / total) * 100) : 0;

  // Customer status segments
  const activeCustomers = activeCust.value || 0;
  const dormantCustomers = inactive.value || 0;
  const atRiskCustomers = aboutToLose.value || 0;
  const newWithoutVisits = Math.max(0, totalCustomers - activeCustomers - dormantCustomers - atRiskCustomers);

  // Visits twin chart data (last 12 buckets)
  const visitsTwin = useTileMetric({ metric: 'total_visits', branchId, initial: { value: 30, unit: 'day' }, withSeries: true });
  const uniquesTwin = useTileMetric({ metric: 'new_customers', branchId, initial: { value: 30, unit: 'day' }, withSeries: true });
  const visitsChartData = useMemo(() => {
    const vs = visitsTwin.series || [];
    const us = uniquesTwin.series || [];
    const n = Math.max(vs.length, us.length, 1);
    return Array.from({ length: n }, (_, i) => ({
      idx: i + 1,
      visits:  vs[i] ?? 0,
      uniques: us[i] ?? 0,
    }));
  }, [visitsTwin.series, uniquesTwin.series]);

  // Acquisition weekly — 26 buckets
  const acqWeekly = useTileMetric({ metric: 'new_customers', branchId, initial: { value: 7 * 26, unit: 'day' }, withSeries: true });
  const acqChartData = useMemo(() => (acqWeekly.series || []).map((v, i) => ({ idx: i + 1, value: v })), [acqWeekly.series]);
  const acqTotal = acqChartData.reduce((s, p) => s + p.value, 0);
  const acqAvg = acqChartData.length ? acqTotal / acqChartData.length : 0;
  const acqBest = acqChartData.length ? Math.max(...acqChartData.map(p => p.value)) : 0;

  // Sources donut
  const sources = useMemo(() => {
    if (!acqSources) return [];
    // Vibrant multi-color palette — joyful but each source stays distinct.
    const palette = {
      direct:    '#3FA9D9', // teal-blue
      qr_store:  '#3FA9D9',
      instagram: '#E15A47', // coral-red
      google:    '#3FA86A', // green
      facebook:  '#2F77C7', // blue
      tiktok:    '#1F1B1A', // ink
      manual:    '#9A6DBF', // mauve
      website:   '#E8A53B', // gold
    };
    const labels = {
      direct: 'Direct', qr_store: 'QR in-store',
      instagram: 'Instagram', google: 'Google',
      facebook: 'Facebook', tiktok: 'TikTok',
      manual: 'Saisie staff', website: 'Website',
    };
    return Object.entries(acqSources)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([k, v]) => ({
        key: k,
        name: labels[k] || k,
        value: v,
        color: palette[k] || '#B5B0A8',
      }))
      .sort((a, b) => b.value - a.value);
  }, [acqSources]);
  const sourcesTotal = sources.reduce((s, p) => s + p.value, 0);

  // Tier donut
  const tierData = ['gold', 'silver', 'bronze', 'vip']
    .map((k) => ({ key: k, name: k.charAt(0).toUpperCase() + k.slice(1), value: tierDist[k] || 0, color: TIER_COLORS[k] }))
    .filter((t) => t.value > 0);
  const tiersTotal = tierData.reduce((s, p) => s + p.value, 0);

  // Plan usage
  const planName = (tenant?.plan || 'gold').toUpperCase();
  const planLimit = ({ basic: 500, gold: 2000, vip: 10000, chain: 50000 })[tenant?.plan || 'gold'] || 2000;
  const planUsedPct = planLimit > 0 ? Math.min(100, (totalCustomers / planLimit) * 100) : 0;

  // Open campaign composer with a preset
  const openCampaign = (preset = {}) => {
    const q = new URLSearchParams();
    if (preset.name) q.set('preset_name', preset.name);
    if (preset.content) q.set('preset_content', preset.content);
    navigate(`/dashboard/campaigns${q.toString() ? '?' + q : ''}`);
  };

  // Vibrant multi-colour palette shared with the sources donut so the
  // dashboard reads as one joyful product.
  const statusDonut = [
    { key: 'active',  name: 'Actifs',     value: activeCustomers,  color: '#3FA86A' },
    { key: 'dormant', name: 'Dormants',   value: dormantCustomers, color: '#E8A53B' },
    { key: 'risk',    name: 'À risque',   value: atRiskCustomers,  color: '#E15A47' },
    { key: 'new',     name: 'Nouveaux',   value: newWithoutVisits, color: '#3FA9D9' },
  ].filter(d => d.value > 0);

  const churnDonut = [
    { key: 'engaged', name: 'Engagés',         value: Math.max(0, totalCustomers - (summary?.one_visit_count || 0) - dormantCustomers - (summary?.churned_90d_count || 0)), color: '#3FA86A' },
    { key: 'one',     name: '1 visite',        value: summary?.one_visit_count || 0,    color: '#3FA9D9' },
    { key: 'dormant', name: 'Inactifs 30j',    value: dormantCustomers,                 color: '#E8A53B' },
    { key: 'churned', name: 'Churned 90j',     value: summary?.churned_90d_count || 0,  color: '#E15A47' },
  ].filter(d => d.value > 0);

  // Plan usage radial data
  const planUsed = Math.min(totalCustomers, planLimit);
  const planRemaining = Math.max(0, planLimit - planUsed);
  const planDonut = [
    { key: 'used', name: 'Utilisé',    value: planUsed,      color: '#4F7A36' },
    { key: 'free', name: 'Disponible', value: planRemaining, color: '#E8E4D8' },
  ];

  return (
    <div className="fdt-dash">
      <div className="fd-page">

        {/* ═════════════ MAIN COLUMN ═════════════ */}
        <div className="fd-main">

          {/* AI recommendation strip — top, dismissible */}
          {showAiStrip && (
            <div className="fd-ai">
              <div className="fd-ai-ico"><Sparkles size={20} /></div>
              <div className="fd-ai-content">
                <div className="fd-ai-eyebrow">Notre recommandation IA pour vous</div>
                <div className="fd-ai-title">
                  {atRiskCustomers > 0
                    ? `${atRiskCustomers} customers about to lose`
                    : `${newCustomers.value || 0} nouveaux clients à fidéliser`}
                </div>
                <div className="fd-ai-text">
                  {atRiskCustomers > 0
                    ? "They were regulars but haven't visited in 14–29 days. Send a soft \"we miss you\" offer this week before they go silent for 30+ days."
                    : "Activez une campagne de bienvenue pour transformer vos nouveaux visiteurs en habitués."}
                </div>
              </div>
              <button
                className="fd-btn-purple"
                onClick={() => openCampaign(atRiskCustomers > 0
                  ? { name: 'Vous nous manquez', content: '{first_name}, ça fait un moment ! Une attention vous attend chez {business_name}.' }
                  : { name: 'Bienvenue', content: 'Bienvenue {first_name} ! Une attention vous attend lors de votre prochain passage.' })}
              >
                Voir les suggestions <ArrowRight size={13} />
              </button>
              <button
                type="button"
                className="fd-ai-close"
                onClick={() => setShowAiStrip(false)}
                aria-label="Fermer la recommandation"
                title="Fermer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Idées & actions recommandées — pinned at top */}
          <div className="fd-actions-head">
            <div className="fd-panel-h">Idées &amp; actions recommandées</div>
            <div className="fd-panel-sub">4 actions à fort impact sélectionnées par notre IA</div>
          </div>
          <div className="fd-actions-grid fd-actions-grid-top">
            <ActionTile
              icon={<RefreshCw size={14} />}
              color="#B26344"
              title="Relance inactifs 14–29j"
              desc={`Envoyez une campagne "We miss you" à ${atRiskCustomers} clients.`}
              cta="Créer la campagne"
              onClick={() => openCampaign({ name: 'Vous nous manquez', content: '{first_name}, ça fait un moment ! Une attention vous attend.' })}
            />
            <ActionTile
              icon={<Award size={14} />}
              color="#7E5E84"
              title="Segmentez vos VIP"
              desc={`${vipCount} clients VIP génèrent une part importante de vos revenus.`}
              cta="Voir les VIP"
              onClick={() => navigate('/dashboard/customers?tier=vip')}
            />
            <ActionTile
              icon={<UserPlus size={14} />}
              color="#4A7BA8"
              title="Boostez les nouveaux clients"
              desc={`${newCustomers.value || 0} nouveaux cette semaine. Activez une campagne d'acquisition.`}
              cta="Créer une campagne"
              onClick={() => openCampaign({ name: 'Bienvenue', content: 'Bienvenue {first_name} ! Une attention vous attend lors de votre prochain passage.' })}
            />
            <ActionTile
              icon={<Sparkles size={14} />}
              color="#4A7861"
              title="Voir plus d'insights"
              desc="Explorez plus d'opportunités pour votre croissance."
              cta="Explorer"
              onClick={() => navigate('/dashboard/insights')}
            />
          </div>

          {/* Welcome back header */}
          <div className="fd-h">
            <div>
              <h1 className="fd-title">
                Welcome back
                <span className="fd-live">LIVE</span>
              </h1>
              <p className="fd-sub">
                Chaque chiffre est live. Cliquez sur n'importe quel KPI pour voir la liste de clients correspondante.
              </p>
            </div>
            <button className="fd-btn-primary" onClick={() => openCampaign({})}>
              <Plus size={14} /> Nouvelle campagne
            </button>
          </div>

          {/* KPI GRID — 8 cards */}
          <div className="fd-kpi-grid">
            <Kpi color="k-pos" icon={<Users size={18} />}        label="Total Customers"  value={fmtNum(totalCustomers)} sub="Toute la base"
                 delta={newCustomers.deltaPct}
                 onClick={() => navigate('/dashboard/customers')} />
            <Kpi color="k-pos" icon={<Activity size={18} />}     label="Total Visits"    value={fmtNum(totalVisits)}   sub="Toutes les visites enregistrées"
                 delta={visitsTwin.deltaPct} />
            <Kpi color="k-pos" icon={<TrendingUp size={18} />}   label="Repeat Rate"     value={fmtPct(repeatRate)}    sub="Clients revenus au moins 2 fois" />
            <Kpi color="k-pos" icon={<Smartphone size={18} />}   label="Wallet Passes"   value={fmtNum(walletPasses)}  sub={`${pct(walletPasses, totalCustomers)}% des clients`} />

            <Kpi color="k-pos" icon={<BadgeCheck size={18} />}   label="Active Cards"    value={fmtNum(activeCards)}   sub="Dans Apple/Google Wallet"
                 onClick={() => navigate('/dashboard/customers?wallet_state=active')} />
            <Kpi color="k-neg" icon={<CreditCard size={18} />}   label="Never Added"     value={fmtNum(neverAdded)}    sub="Inscrits, mais carte non ajoutée"
                 onClick={() => navigate('/dashboard/customers?wallet_state=never_added')} />
            <Kpi color="k-neg" icon={<Trash2 size={18} />}       label="Deleted Cards"   value={fmtNum(deletedCards)}  sub="Carte retirée du wallet"
                 onClick={() => navigate('/dashboard/customers?wallet_state=deleted')} />
            <Kpi color="k-pos" icon={<Award size={18} />}        label="VIP Customers"   value={fmtNum(vipCount)}      sub="Top tier — 40+ visites ou panier €60+"
                 onClick={() => navigate('/dashboard/customers?tier=vip')} />
          </div>

          {/* Customer Status */}
          <div className="fd-panel">
            <div className="fd-panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fd-panel-title">Customer Status</span>
                <span title="État détaillé de chaque segment client" style={{ width: 16, height: 16, borderRadius: 8, background: '#F4EEE0', color: '#8A8A8A', display: 'inline-grid', placeItems: 'center', fontSize: 10, fontStyle: 'italic', fontWeight: 600 }}>i</span>
              </div>
              <button onClick={() => navigate('/dashboard/customers')} style={{ color: 'var(--fd-primary)', fontSize: 13, fontWeight: 500, border: 0, background: 'transparent', cursor: 'pointer' }}>
                Voir tous les clients →
              </button>
            </div>
            <div className="fd-status-row">
              <div className="fd-status-grid">
                <StatusCell label="Active"          value={activeCustomers}    total={totalCustomers} icon={<Users size={16} />} ink="#2D7A3E" />
                <StatusCell label="Dormant"         value={dormantCustomers}   total={totalCustomers} icon={<Moon size={16} />}  ink="#A8862D" />
                <StatusCell label="At Risk"         value={atRiskCustomers}    total={totalCustomers} icon={<AlertTriangle size={16} />} ink="#C84A1F" />
                <StatusCell label="New (no visits)" value={newWithoutVisits}   total={totalCustomers} icon={<UserPlus size={16} />} ink="#5984AC" />
              </div>
              <div className="fd-status-donut">
                <div className="fd-mini-donut">
                  {statusDonut.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusDonut} dataKey="value" innerRadius={38} outerRadius={56} stroke="white" strokeWidth={3} startAngle={90} endAngle={-270}>
                          {statusDonut.map((d) => <Cell key={d.key} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="fd-mini-center">
                    <div className="fd-mini-val">{totalCustomers}</div>
                    <div className="fd-mini-lbl">Total</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="fd-status-bar">
              <div style={{ width: `${pct(activeCustomers, totalCustomers)}%`, background: '#3FA86A' }} />
              <div style={{ width: `${pct(dormantCustomers, totalCustomers)}%`, background: '#E8A53B' }} />
              <div style={{ width: `${pct(atRiskCustomers, totalCustomers)}%`, background: '#E15A47' }} />
              <div style={{ width: `${pct(newWithoutVisits, totalCustomers)}%`, background: '#3FA9D9' }} />
            </div>
          </div>

          {/* CHARTS ROW 1 — Visits + Acquisition */}
          <div className="fd-charts-grid">
            {/* Visits chart */}
            <div className="fd-chart">
              <div className="fd-ch-head">
                <span className="fd-ch-title">Visites dans le temps</span>
                <select className="fd-ch-select" defaultValue="30">
                  <option value="30">30 derniers jours</option>
                  <option value="90">90 derniers jours</option>
                </select>
              </div>
              <div className="fd-ch-legend">
                <span><span className="fd-ch-dot" style={{ background: '#3FA9D9' }} />Visites totales</span>
                <span><span className="fd-ch-dot" style={{ background: '#E8A53B' }} />Clients uniques</span>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={visitsChartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#F0E8D6" vertical={false} />
                    <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#8A8A8A' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8A8A8A' }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #ECE3D2' }} />
                    <Bar dataKey="visits" fill="#3FA9D9" radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Line type="monotone" dataKey="uniques" stroke="#E8A53B" strokeWidth={2} dot={{ r: 3, fill: '#E8A53B' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="fd-pt-grid">
                <div className="fd-pt-cell">
                  <div className="fd-pt-lbl">Visites totales</div>
                  <div className="fd-pt-val">{fmtNum(totalVisits)}</div>
                  <div className="fd-pt-delta">↑ {fmtPct(repeatRate)} taux retour</div>
                </div>
                <div className="fd-pt-cell">
                  <div className="fd-pt-lbl">Clients uniques</div>
                  <div className="fd-pt-val">{fmtNum(totalCustomers)}</div>
                  <div className="fd-pt-delta">{newCustomers.value > 0 ? `↑ ${newCustomers.value} nouveaux` : 'Stable'}</div>
                </div>
              </div>
            </div>

            {/* Acquisition weekly */}
            <div className="fd-chart">
              <div className="fd-ch-head">
                <span className="fd-ch-title">Acquisition de clients</span>
                <select className="fd-ch-select"><option>26 dernières semaines</option></select>
              </div>
              <div className="fd-chart-stats">
                <div>
                  <div className="fd-cs-lbl">Nouveaux clients</div>
                  <div className="fd-cs-val">{fmtNum(acqTotal)}</div>
                  <div className="fd-cs-sub">Total</div>
                </div>
                <div>
                  <div className="fd-cs-lbl">Moy. / sem.</div>
                  <div className="fd-cs-val">{acqAvg.toFixed(1)}</div>
                  <div className="fd-cs-sub">→ stable</div>
                </div>
                <div>
                  <div className="fd-cs-lbl">Meilleure sem.</div>
                  <div className="fd-cs-val">{acqBest}</div>
                  <div className="fd-cs-sub">Record</div>
                </div>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={acqChartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#F0E8D6" vertical={false} />
                    <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#8A8A8A' }} tickLine={false} axisLine={false} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: '#8A8A8A' }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #ECE3D2' }} />
                    <Bar dataKey="value" fill="#3FA86A" radius={[3, 3, 0, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="fd-ch-foot">
                <span style={{ fontSize: 12, color: 'var(--fd-text-2)' }}>Tendance</span>
                <span style={{ fontWeight: 700, color: 'var(--fd-green-ico)' }}>En croissance régulière</span>
                <TrendingUp size={20} color="#4F7A36" />
              </div>
            </div>
          </div>

          {/* CHARTS ROW 2 — Sources + Tier donuts */}
          <div className="fd-charts-grid">
            <div className="fd-chart">
              <div className="fd-ch-head">
                <span className="fd-ch-title">Top Sources d'acquisition</span>
                <span style={{ fontSize: 11.5, color: 'var(--fd-text-3)', fontWeight: 600, letterSpacing: 0.5 }}>À VIE</span>
              </div>
              <div className="fd-donut-block">
                <div className="fd-donut-wrap">
                  {sourcesTotal > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sources} dataKey="value" innerRadius={48} outerRadius={62} stroke="white" strokeWidth={3} startAngle={90} endAngle={-270}>
                          {sources.map((d) => <Cell key={d.key} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="fd-donut-center">
                    <div className="fd-donut-val">{sourcesTotal || totalCustomers}</div>
                    <div className="fd-donut-lbl">Total Clients</div>
                  </div>
                </div>
                <div className="fd-donut-legend">
                  {sources.slice(0, 4).map((d) => (
                    <div className="fd-dl-row" key={d.key}>
                      <div className="fd-dl-left">
                        <span className="fd-dl-dot" style={{ background: d.color }} />
                        {d.name}
                      </div>
                      <div>
                        <span className="fd-dl-val">{d.value}</span>
                        <span className="fd-dl-pct">({pct(d.value, sourcesTotal)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fd-chart">
              <div className="fd-ch-head">
                <span className="fd-ch-title">Répartition par palier</span>
                <span style={{ fontSize: 11.5, color: 'var(--fd-text-3)', fontWeight: 600, letterSpacing: 0.5 }}>À VIE</span>
              </div>
              <div className="fd-donut-block">
                <div className="fd-donut-wrap">
                  {tiersTotal > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tierData} dataKey="value" innerRadius={48} outerRadius={62} stroke="white" strokeWidth={3} startAngle={90} endAngle={-270}>
                          {tierData.map((d) => <Cell key={d.key} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="fd-donut-center">
                    <div className="fd-donut-val">{tiersTotal}</div>
                    <div className="fd-donut-lbl">Paliers</div>
                  </div>
                </div>
                <div className="fd-donut-legend">
                  {['gold', 'silver', 'bronze', 'vip'].map((k) => (
                    <div className="fd-dl-row" key={k}>
                      <div className="fd-dl-left">
                        <span className="fd-dl-dot" style={{ background: TIER_COLORS[k] }} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </div>
                      <div>
                        <span className="fd-dl-val">{tierDist[k] || 0}</span>
                        <span className="fd-dl-pct">({pct(tierDist[k] || 0, tiersTotal)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Churn & rétention */}
          <div className="fd-panel">
            <div className="fd-panel-head">
              <div>
                <div className="fd-panel-h">Churn & rétention</div>
                <div className="fd-panel-sub">Comprenez la perte et la rétention de vos clients</div>
              </div>
            </div>
            <div className="fd-churn-row">
              <div className="fd-churn-grid">
                <div className="fd-churn-card">
                  <div className="fd-cc-lbl">Clients Total</div>
                  <div className="fd-cc-val">{totalCustomers}</div>
                  <div className="fd-cc-sub">100% de la base</div>
                </div>
                <div className="fd-churn-card">
                  <div className="fd-cc-lbl">1 visite seulement</div>
                  <div className="fd-cc-val">{fmtPct(pct(summary?.one_visit_count || 0, totalCustomers))}</div>
                  <div className="fd-cc-sub">{summary?.one_visit_count || 0} clients</div>
                </div>
                <div className="fd-churn-card">
                  <div className="fd-cc-lbl">Inactifs 30j</div>
                  <div className="fd-cc-val warn">{fmtPct(pct(dormantCustomers, totalCustomers))}</div>
                  <div className="fd-cc-sub">{dormantCustomers} clients</div>
                </div>
                <div className="fd-churn-card">
                  <div className="fd-cc-lbl">Churned 90j</div>
                  <div className="fd-cc-val">{fmtPct(pct(summary?.churned_90d_count || 0, totalCustomers))}</div>
                  <div className="fd-cc-sub">{summary?.churned_90d_count || 0} clients</div>
                </div>
              </div>
              <div className="fd-churn-donut">
                <div className="fd-mini-donut">
                  {churnDonut.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={churnDonut} dataKey="value" innerRadius={38} outerRadius={56} stroke="white" strokeWidth={3} startAngle={90} endAngle={-270}>
                          {churnDonut.map((d) => <Cell key={d.key} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="fd-mini-center">
                    <div className="fd-mini-val">{fmtPct(100 - pct((summary?.churned_90d_count || 0) + dormantCustomers, totalCustomers), 0)}</div>
                    <div className="fd-mini-lbl">Rétention</div>
                  </div>
                </div>
                <div className="fd-mini-legend">
                  {churnDonut.map(d => (
                    <div key={d.key} className="fd-ml-row">
                      <span className="fd-ml-dot" style={{ background: d.color }} />
                      <span className="fd-ml-name">{d.name}</span>
                      <span className="fd-ml-val">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* LTV */}
          <div className="fd-panel">
            <div className="fd-panel-head">
              <div>
                <div className="fd-panel-h">Lifetime Value (LTV)</div>
                <div className="fd-panel-sub">Analysez la valeur générée par vos clients sur la durée</div>
              </div>
            </div>
            <div className="fd-ltv-cards">
              <div className="fd-ltv-card">
                <div className="fd-lc-lbl">LTV moyenne</div>
                <div className="fd-lc-val">{fmtEUR(summary?.ltv_mean || 0)}</div>
              </div>
              <div className="fd-ltv-card">
                <div className="fd-lc-lbl">LTV médiane</div>
                <div className="fd-lc-val">{fmtEUR(summary?.ltv_median || 0)}</div>
              </div>
              <div className="fd-ltv-card high">
                <div className="fd-lc-lbl">Top 10% LTV</div>
                <div className="fd-lc-val">{fmtEUR(summary?.ltv_p90 || 0)}</div>
              </div>
            </div>
            <table className="fd-ltv-table">
              <thead>
                <tr><th>Palier</th><th>Clients</th><th>LTV moyenne</th><th>Revenus total</th></tr>
              </thead>
              <tbody>
                {['gold', 'silver', 'bronze', 'vip'].map((k) => {
                  const cnt = tierDist[k] || 0;
                  const ltv = summary?.ltv_by_tier?.[k] || 0;
                  return (
                    <tr key={k}>
                      <td><span className="fd-tier-dot" style={{ background: TIER_COLORS[k] }} />{k.charAt(0).toUpperCase() + k.slice(1)}</td>
                      <td>{cnt}</td>
                      <td>{fmtEUR(ltv)}</td>
                      <td>{fmtEUR(ltv * cnt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Plan usage */}
          <div className="fd-panel">
            <div className="fd-panel-head">
              <div>
                <div className="fd-panel-h">Cartes de fidélité actives</div>
                <div className="fd-panel-sub">Utilisation de votre plan</div>
              </div>
            </div>
            <div className="fd-plan-grid">
              <div className="fd-plan-gauge">
                <div className="fd-mini-donut fd-plan-donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planDonut} dataKey="value" innerRadius={50} outerRadius={70} stroke="white" strokeWidth={2} startAngle={90} endAngle={-270}>
                        {planDonut.map((d) => <Cell key={d.key} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="fd-mini-center">
                    <div className="fd-mini-val">{planUsedPct.toFixed(0)}%</div>
                    <div className="fd-mini-lbl">utilisé</div>
                  </div>
                </div>
                <div className="fd-plan-meta">
                  <div className="fd-plan-num">{totalCustomers} <span className="fd-plan-num-total">/ {planLimit}</span></div>
                  <div className="fd-plan-tag-row">
                    <span className="fd-plan-chip">{planName}</span>
                    <span className="fd-plan-pct">{planUsedPct.toFixed(1)}% utilisé</span>
                  </div>
                </div>
              </div>
              <div className="fd-plan-aside">
                <div className="fd-pa-h"><Info size={13} /> À savoir</div>
                <ul className="fd-pa-list">
                  <li><span>Cartes actives</span><b>{activeCards}</b></li>
                  <li><span>Cartes inactives</span><b>{neverAdded}</b></li>
                  <li><span>Supprimées</span><b>{deletedCards}</b></li>
                </ul>
                <button className="fd-pa-btn" onClick={() => navigate('/dashboard/settings#settings-billing')}>
                  <SettingsIcon size={12} /> Gérer mon plan
                </button>
              </div>
            </div>
          </div>


        </div>

        {/* ═════════════ SIDE COLUMN ═════════════ */}
        <div className="fd-side">
          {/* Alertes */}
          <div className="fd-side-panel">
            <div className="fd-sp-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={15} />
                <span className="fd-sp-title">Alertes</span>
              </div>
              <div className="fd-sp-count">4</div>
            </div>
            <Alert color="yellow" icon={<AlertTriangle size={16} />} title="Taux de retour"      sub={`${fmtPct(repeatRate)} ce mois-ci`} time="Il y a 2 heures" />
            <Alert color="purple" icon={<Sparkles size={16} />}    title={`${atRiskCustomers} clients à risque`} sub="Inactifs 14–29 jours"    time="Il y a 1 heure" />
            <Alert color="blue"   icon={<UserPlus size={16} />}     title={`${newCustomers.value || 0} nouveaux`} sub="Sur les 7 derniers jours" time="Il y a 3 heures" />
            <Alert color="green"  icon={<Clock size={16} />}        title="Objectif mensuel"      sub={`${Math.round(planUsedPct)}% atteint`}  time="Il reste 9 jours" />
            <button className="fd-sp-cta" onClick={() => navigate('/dashboard/insights')}>Voir toutes les alertes →</button>
          </div>

          {/* Résumé rapide */}
          <div className="fd-side-panel">
            <div className="fd-sp-head">
              <span className="fd-sp-title">Résumé rapide</span>
            </div>
            <SummaryRow label="Nouveaux clients (30j)" value={newCustomers.value || 0} delta={newCustomers.deltaPct} />
            <SummaryRow label="Clients actifs (30j)"   value={activeCustomers}         delta={activeCust.deltaPct} />
            <SummaryRow label="Inactifs depuis 30j+"   value={dormantCustomers}        delta={inactive.deltaPct} />
            <SummaryRow label="Sur le point de partir" value={atRiskCustomers}         delta={aboutToLose.deltaPct} />
            <button className="fd-sp-cta" style={{ marginTop: 18 }} onClick={() => navigate('/dashboard/analytics')}>
              Voir le rapport complet →
            </button>
          </div>

          {/* Filter strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--fd-border)', padding: '10px 14px', borderRadius: 12, fontSize: 12.5, color: 'var(--fd-text-2)' }}>
            <Calendar size={14} />
            <span style={{ letterSpacing: 1.1, fontWeight: 700, fontSize: 11, color: 'var(--fd-text-3)', textTransform: 'uppercase', marginRight: 'auto' }}>
              Filtre temps
            </span>
            <select style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--fd-text)', fontWeight: 600, cursor: 'pointer', outline: 0 }}>
              <option>30 derniers jours</option>
              <option>7 jours</option>
              <option>90 jours</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function Kpi({ color, icon, label, value, sub, onClick, delta }) {
  const hasDelta = typeof delta === 'number' && isFinite(delta);
  const isUp = hasDelta && delta >= 0;
  return (
    <div className={`fd-kpi ${color}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="fd-kpi-head">
        <span className="fd-kpi-label">{label}</span>
        <span className="fd-kpi-ico">{icon}</span>
      </div>
      <div className="fd-kpi-value">{value}</div>
      <div className="fd-kpi-foot">
        <span className="fd-kpi-sub">{sub}</span>
        {hasDelta && (
          <span className={`fd-kpi-delta ${isUp ? 'pos' : 'neg'}`}>
            {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function StatusCell({ label, value, total, icon, ink }) {
  const p = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="fd-sc-head">
        <span className="fd-sc-label">{label}</span>
        <span style={{ color: ink, width: 18, height: 18 }}>{icon}</span>
      </div>
      <div className="fd-sc-value">{value}</div>
      <div className="fd-sc-sub">{p}% de la base</div>
    </div>
  );
}

function ActionTile({ icon, color, title, desc, cta, onClick }) {
  return (
    <div className="fd-action">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="fd-at-ico" style={{ background: color }}>{icon}</span>
        <span className="fd-at-title">{title}</span>
      </div>
      <div className="fd-at-desc">{desc}</div>
      <button className="fd-at-btn" style={{ background: color }} onClick={onClick}>{cta}</button>
    </div>
  );
}

function Alert({ color, icon, title, sub, time }) {
  return (
    <div className="fd-alert">
      <div className={`fd-alert-ico ${color}`}>{icon}</div>
      <div>
        <div className="fd-alert-title">{title}</div>
        <div className="fd-alert-sub">{sub}</div>
        <div className="fd-alert-time">{time}</div>
      </div>
      <ChevronRight size={14} color="#8A8A8A" style={{ alignSelf: 'center' }} />
    </div>
  );
}

function SummaryRow({ label, value, delta }) {
  const d = typeof delta === 'number' ? delta : null;
  const sign = d == null ? '' : (d >= 0 ? 'pos' : 'neg');
  return (
    <div className="fd-summary-row">
      <span style={{ color: 'var(--fd-text-2)' }}>{label}</span>
      <span className="fd-sm-val">
        {value}
        {d != null && (
          <span className={`fd-sm-delta ${sign}`}>
            {d >= 0 ? '↑' : '↓'} {Math.abs(d).toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  );
}
