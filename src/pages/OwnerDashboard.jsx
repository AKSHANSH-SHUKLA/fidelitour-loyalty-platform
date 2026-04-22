import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, TrendingUp, Repeat, Award, DollarSign, Clock,
  ArrowUpRight, ArrowDownRight, UserPlus, Activity, AlertCircle, CheckCircle2, Gift, AlertTriangle
} from 'lucide-react';
import TierBadge from '../components/TierBadge';

const TIER_COLORS = { bronze: '#8B6914', silver: '#A8A8A8', gold: '#E3A869' };

const OwnerDashboard = () => {
  const [metrics, setMetrics] = useState(null);
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

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranch]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch branches
      const branchRes = await ownerAPI.getBranches();
      const branchList = branchRes.data || [];
      setBranches(branchList);

      // If tenant has multiple branches and none selected, show selector
      if (branchList.length > 1 && !selectedBranch) {
        setSelectedBranch(null); // Show "All branches"
      } else if (branchList.length === 1 && !selectedBranch) {
        setSelectedBranch(branchList[0].id);
      }

      // Fetch main analytics with branch filter
      const analyticsParams = selectedBranch ? { branch_id: selectedBranch } : {};
      const analyticsRes = await ownerAPI.getAnalytics(analyticsParams);
      setMetrics(analyticsRes.data);

      // Fetch new KPIs
      const cardsRes = await ownerAPI.getCardsFilled(analyticsParams);
      setCardsFilled(cardsRes.data);

      const recoveredRes = await ownerAPI.getRecovered({ inactive_days: 30, window_days: 30, ...analyticsParams });
      setRecovered(recoveredRes.data);

      const topRes = await ownerAPI.getHighestPaying(analyticsParams);
      const topList = topRes.data || [];
      setHighestPaying(topList);
      if (topList.length > 0) {
        setTopSpender(topList[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
      <div className="p-8 min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <p className="text-[#57534E]">Loading dashboard...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8 min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <p className="text-[#B85C38]">Failed to load analytics. Please try again.</p>
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-[#FDFBF7] min-h-screen">
      {/* Smart Alerts Banner */}
      {recovered && recovered.percentage > 10 && (
        <div className="p-4 rounded-xl border-l-4 bg-green-50" style={{ borderColor: '#4A5D23' }}>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} style={{ color: '#4A5D23' }} />
            <div>
              <p className="font-semibold text-[#1C1917]">Great news — {recovered.count} customers came back recently!</p>
              <p className="text-sm text-[#57534E]">They were inactive for 30+ days but visited in the last 30 days.</p>
            </div>
          </div>
        </div>
      )}

      {topSpender && topSpender.last_visit_date && (() => {
        const lastVisit = new Date(topSpender.last_visit_date);
        const now = new Date();
        const daysSince = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));
        return daysSince > 14 ? (
          <div className="p-4 rounded-xl border-l-4 bg-amber-50" style={{ borderColor: '#E3A869' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} style={{ color: '#E3A869' }} />
              <div>
                <p className="font-semibold text-[#1C1917]">Your top customer hasn't visited in {daysSince} days — send them a thank-you offer?</p>
                <p className="text-sm text-[#57534E]">{topSpender.name} is your biggest supporter with €{topSpender.total_amount_paid} spent.</p>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Branch Selector (if multiple branches) */}
      {branches.length > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedBranch(null)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedBranch === null
                ? 'bg-[#B85C38] text-white'
                : 'bg-white border border-[#E7E5E4] text-[#57534E] hover:border-[#B85C38]'
            }`}
          >
            All branches
          </button>
          {branches.map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranch(branch.id)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                selectedBranch === branch.id
                  ? 'bg-[#B85C38] text-white'
                  : 'bg-white border border-[#E7E5E4] text-[#57534E] hover:border-[#B85C38]'
              }`}
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: 'Cormorant Garamond' }}>
          Operational Dashboard
        </h1>
        <p className="text-[#57534E]" style={{ fontFamily: 'Manrope' }}>
          A high-level view of your loyalty programme performance
        </p>
      </div>

      {/* KPI Cards — 6 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          icon={Users}
          title="Total Customers"
          value={totalCustomers.toLocaleString()}
          subtitle="All enrolled loyalty members"
          color="#2D7D9A"
        />
        <KPICard
          icon={Activity}
          title="Total Visits"
          value={totalVisits.toLocaleString()}
          subtitle="All-time recorded visits"
          color="#4A5D23"
        />
        <KPICard
          icon={Repeat}
          title="Repeat Rate"
          value={repeatRate}
          subtitle="Customers who came back more than once"
          color="#B85C38"
          bgColor="#B85C38"
          isAccent={true}
        />
        <KPICard
          icon={Award}
          title="Gold Members"
          value={goldCustomers}
          subtitle={`${totalCustomers > 0 ? Math.round((goldCustomers / totalCustomers) * 100) : 0}% of your customers`}
          color="#E3A869"
        />
        <KPICard
          icon={TrendingUp}
          title="Avg Visits / Customer"
          value={avgVisitsPerCustomer}
          subtitle="Higher means stronger loyalty"
          color="#6B4C8A"
        />
        <KPICard
          icon={UserPlus}
          title="New This Month"
          value={Object.values(newByWeek).reduce((a, b) => a + b, 0)}
          subtitle="Customers who joined in the last 4 weeks"
          color="#2D7D9A"
        />
        {cardsFilled && (
          <KPICard
            icon={Gift}
            title="Total Cards Filled"
            value={cardsFilled.total_cards_filled || 0}
            subtitle="Complete rewards cycles earned across all customers"
            color="#4A5D23"
          />
        )}
        {recovered && (
          <KPICard
            icon={TrendingUp}
            title="Recovered Customers"
            value={`${recovered.count} (${recovered.percentage}%)`}
            subtitle="Customers who came back after being quiet"
            color="#2D7D9A"
          />
        )}
        {topSpender && (
          <KPICard
            icon={Users}
            title="Top Spender"
            value={topSpender.name}
            subtitle={`€${topSpender.total_amount_paid} spent • ${topSpender.total_visits} visits`}
            color="#B85C38"
          />
        )}
      </div>

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
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {tierPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontFamily: 'Manrope' }} />
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
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
            Campaign Performance
          </h2>
          {campaignPerf.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>No campaigns sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaignPerf.map((camp, i) => (
                <div key={i} className="p-4 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-[#1C1917] text-sm" style={{ fontFamily: 'Manrope' }}>{camp.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#4A5D23] text-white font-medium">Sent</span>
                  </div>
                  <div className="flex gap-6 text-xs text-[#57534E]" style={{ fontFamily: 'Manrope' }}>
                    <span>Delivered: <strong className="text-[#1C1917]">{camp.delivered_count}</strong></span>
                    <span>Visits After: <strong className="text-[#4A5D23]">{camp.visits_after_send}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              {Object.keys(heatmap).length > 0 && Object.keys(Object.values(heatmap)[0] || {}).sort((a, b) => parseInt(a) - parseInt(b)).map(hour => (
                <tr key={hour} className="border-b border-[#F3EFE7]">
                  <td className="py-2 px-3 font-medium text-[#57534E]">{hour}:00</td>
                  {Object.keys(heatmap).map(day => {
                    const count = heatmap[day]?.[hour] || 0;
                    const maxCount = Math.max(...Object.values(heatmap).flatMap(d => Object.values(d)), 1);
                    const intensity = count / maxCount;
                    const bgColor = count === 0
                      ? '#F3EFE7'
                      : intensity > 0.6
                        ? '#B85C38'
                        : intensity > 0.3
                          ? '#E3A869'
                          : '#F3EFE7';
                    const textColor = intensity > 0.6 ? '#FDFBF7' : '#57534E';
                    return (
                      <td
                        key={day}
                        className="text-center py-2 px-2 font-semibold"
                        style={{ backgroundColor: bgColor, color: textColor }}
                      >
                        {count || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
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
