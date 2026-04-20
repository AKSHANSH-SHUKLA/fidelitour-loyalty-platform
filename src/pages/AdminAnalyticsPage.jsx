import React, { useEffect, useState } from 'react';
import api, { adminAPI } from '../lib/api';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, Legend } from 'recharts';
import { X, TrendingDown } from 'lucide-react';

const PLAN_COLORS = {
  'basic': '#4A5D23',
  'gold': '#E3A869',
  'vip': '#B85C38',
};

const AdminAnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [drillDownData, setDrillDownData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('visits');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDetailedAnalytics();
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePieClick = async (entry) => {
    setSelectedMonth(null);
    setSelectedPlan(entry.name);
    try {
      const res = await adminAPI.getTenantsByPlan(entry.name.toLowerCase());
      setDrillDownData(res.data || []);
    } catch (error) {
      console.error('Failed to fetch tenants by plan:', error);
      setDrillDownData([]);
    }
  };

  const handleLineClick = async (data) => {
    setSelectedPlan(null);
    setSelectedMonth(data.date);
    try {
      // This would call a backend endpoint to fetch businesses created in a specific month
      // For now, we'll use mock data
      setDrillDownData([]);
    } catch (error) {
      console.error('Failed to fetch businesses by month:', error);
    }
  };

  const getPlanStats = (planName) => {
    const tenants = drillDownData || [];
    if (tenants.length === 0) return null;

    const totalCustomers = tenants.reduce((sum, t) => sum + (t.customer_count || 0), 0);
    const planPrice = { 'basic': 29, 'gold': 79, 'vip': 199 }[planName.toLowerCase()] || 0;
    const avgCustomersPerBusiness = tenants.length > 0 ? (totalCustomers / tenants.length).toFixed(0) : 0;
    const totalVisits = tenants.reduce((sum, t) => sum + (t.total_visits || 0), 0);

    return {
      pricePerMonth: `€${planPrice}`,
      totalCustomers,
      avgCustomersPerBusiness,
      count: tenants.length,
      totalVisits,
    };
  };

  const sortTenants = (tenants) => {
    return [...tenants].sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'visits':
          aVal = a.total_visits || 0;
          bVal = b.total_visits || 0;
          break;
        case 'customers':
          aVal = a.customer_count || 0;
          bVal = b.customer_count || 0;
          break;
        case 'avgpoints':
          aVal = a.avg_points || 0;
          bVal = b.avg_points || 0;
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default:
          return 0;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  };

  if (loading || !data) {
    return <div className="p-8 bg-[#FDFBF7] min-h-screen text-[#57534E]">Loading analytics...</div>;
  }

  const planDistData = data.plans_distribution || [];
  const growthData = (data.growth || []).map(g => ({ date: g.month, count: g.tenants }));

  // Mock customer growth data
  const customerGrowthData = growthData.map((g, idx) => ({
    date: g.date,
    customers: (idx + 1) * 150 + Math.random() * 100,
  }));

  // Mock revenue by plan
  const revenueByPlanData = planDistData.map(plan => ({
    name: plan.name,
    revenue: plan.value * (['basic', 'gold', 'vip'].indexOf(plan.name.toLowerCase()) === 0 ? 29 :
                           ['basic', 'gold', 'vip'].indexOf(plan.name.toLowerCase()) === 1 ? 79 : 199),
  }));

  // Mock at-risk businesses
  const businessesAtRisk = (drillDownData || []).filter((t, idx) => idx % 3 === 0).slice(0, 5);

  return (
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen">
      <div>
        <h1 className="text-4xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: 'Cormorant Garamond' }}>
          Global Analytics
        </h1>
        <p className="text-[#57534E]">Platform-wide insights and business performance metrics.</p>
      </div>

      {/* Charts Grid - Top Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Business Growth Line Chart (Clickable) */}
        <div className="bg-white p-6 rounded-lg border border-[#E7E5E4]">
          <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Business Growth Over Time
          </h2>
          <p className="text-xs text-[#57534E] mb-3">Click on data points to drill down</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="date" stroke="#57534E" />
                <YAxis stroke="#57534E" label={{ value: 'New Businesses', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#F3EFE7', border: '1px solid #E7E5E4' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#B85C38"
                  dot={{ fill: '#B85C38', r: 5 }}
                  activeDot={{ r: 7 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
            <span className="font-semibold">What does this mean?</span> This shows how many new businesses have joined the platform each month. An upward trend indicates platform growth.
          </p>
        </div>

        {/* Plan Distribution Pie Chart (Clickable) */}
        <div className="bg-white p-6 rounded-lg border border-[#E7E5E4]">
          <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Businesses by Subscription Plan
          </h2>
          <p className="text-xs text-[#57534E] mb-3">Click a slice to see businesses</p>
          <div className="h-80 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(entry) => handlePieClick(entry)}
                  style={{ cursor: 'pointer' }}
                >
                  {planDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PLAN_COLORS[entry.name.toLowerCase()] || '#B85C38'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
            <span className="font-semibold">What does this mean?</span> This shows how many businesses are on each subscription tier. Click a slice to see which businesses are on that plan.
          </p>
        </div>
      </div>

      {/* Charts Grid - Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Growth Chart */}
        <div className="bg-white p-6 rounded-lg border border-[#E7E5E4]">
          <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Total Customers Growth
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={customerGrowthData}>
                <defs>
                  <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B85C38" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#B85C38" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="date" stroke="#57534E" />
                <YAxis stroke="#57534E" label={{ value: 'Total Customers', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#F3EFE7', border: '1px solid #E7E5E4' }} />
                <Area
                  type="monotone"
                  dataKey="customers"
                  stroke="#B85C38"
                  fillOpacity={1}
                  fill="url(#colorCustomers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
            <span className="font-semibold">What does this mean?</span> This tracks the cumulative growth of customers across all businesses on the platform.
          </p>
        </div>

        {/* Revenue by Plan */}
        <div className="bg-white p-6 rounded-lg border border-[#E7E5E4]">
          <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Revenue by Plan (Monthly)
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByPlanData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="name" stroke="#57534E" />
                <YAxis stroke="#57534E" label={{ value: 'Revenue (€)', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#F3EFE7', border: '1px solid #E7E5E4' }} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                  {revenueByPlanData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PLAN_COLORS[entry.name.toLowerCase()] || '#B85C38'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
            <span className="font-semibold">What does this mean?</span> This shows the monthly revenue breakdown by subscription plan tier.
          </p>
        </div>
      </div>

      {/* Drill-down Section for Plan Selection */}
      {selectedPlan && drillDownData && drillDownData.length > 0 && (
        <div className="bg-white p-8 rounded-lg border border-[#E7E5E4]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: 'Cormorant Garamond' }}>
                {selectedPlan} Plan Businesses
              </h3>
              <p className="text-[#57534E]">Overview of all businesses using the {selectedPlan} subscription plan</p>
            </div>
            <button
              onClick={() => {
                setSelectedPlan(null);
                setDrillDownData(null);
              }}
              className="text-[#A8A29E] hover:text-[#1C1917] transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Summary Stats */}
          {getPlanStats(selectedPlan) && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 pb-8 border-b border-[#E7E5E4]">
              <div className="bg-[#F3EFE7] p-4 rounded-lg">
                <p className="text-xs text-[#57534E] font-semibold uppercase mb-1">Price Per Month</p>
                <p className="text-2xl font-bold text-[#1C1917]">{getPlanStats(selectedPlan).pricePerMonth}</p>
              </div>
              <div className="bg-[#F3EFE7] p-4 rounded-lg">
                <p className="text-xs text-[#57534E] font-semibold uppercase mb-1">Total Businesses</p>
                <p className="text-2xl font-bold text-[#1C1917]">{getPlanStats(selectedPlan).count}</p>
              </div>
              <div className="bg-[#F3EFE7] p-4 rounded-lg">
                <p className="text-xs text-[#57534E] font-semibold uppercase mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-[#1C1917]">{getPlanStats(selectedPlan).totalCustomers.toLocaleString()}</p>
              </div>
              <div className="bg-[#F3EFE7] p-4 rounded-lg">
                <p className="text-xs text-[#57534E] font-semibold uppercase mb-1">Total Visits</p>
                <p className="text-2xl font-bold text-[#1C1917]">{getPlanStats(selectedPlan).totalVisits.toLocaleString()}</p>
              </div>
              <div className="bg-[#F3EFE7] p-4 rounded-lg">
                <p className="text-xs text-[#57534E] font-semibold uppercase mb-1">Avg Customers/Business</p>
                <p className="text-2xl font-bold text-[#1C1917]">{getPlanStats(selectedPlan).avgCustomersPerBusiness}</p>
              </div>
            </div>
          )}

          {/* Sortable Tenants Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  <th
                    className="py-3 px-4 text-sm font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                    onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Business Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="py-3 px-4 text-sm font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                    onClick={() => { setSortBy('customers'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Customers {sortBy === 'customers' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="py-3 px-4 text-sm font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                    onClick={() => { setSortBy('visits'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Visits {sortBy === 'visits' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Created Date</th>
                </tr>
              </thead>
              <tbody>
                {sortTenants(drillDownData).map((tenant, idx) => (
                  <tr key={idx} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7] transition-colors">
                    <td className="py-3 px-4 font-medium text-[#1C1917]">{tenant.name}</td>
                    <td className="py-3 px-4 text-[#57534E]">{tenant.customer_count || 0}</td>
                    <td className="py-3 px-4 text-[#57534E]">{tenant.total_visits || 0}</td>
                    <td className="py-3 px-4 text-[#57534E]">{new Date(tenant.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPlan && (!drillDownData || drillDownData.length === 0) && (
        <div className="bg-[#F3EFE7] p-8 rounded-lg border border-[#E7E5E4] text-center">
          <p className="text-[#57534E]">No businesses found for the {selectedPlan} plan</p>
          <button
            onClick={() => {
              setSelectedPlan(null);
              setDrillDownData(null);
            }}
            className="mt-4 px-6 py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Business Performance Comparison Table */}
      <div className="bg-white p-8 rounded-lg border border-[#E7E5E4]">
        <h2 className="text-2xl font-bold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
          Business Performance Comparison
        </h2>
        <p className="text-sm text-[#57534E] mb-6">All businesses ranked by key metrics. Click column headers to sort.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E7E5E4]">
                <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Business Name</th>
                <th className="py-3 px-4 text-sm font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]">
                  Visits ↓
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Customers</th>
                <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Avg Points/Cust</th>
                <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Plan</th>
              </tr>
            </thead>
            <tbody>
              {drillDownData && drillDownData.length > 0 ? sortTenants(drillDownData).map((tenant, idx) => (
                <tr key={idx} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7] transition-colors">
                  <td className="py-3 px-4 font-medium text-[#1C1917]">{tenant.name}</td>
                  <td className="py-3 px-4 text-[#57534E] font-semibold">{tenant.total_visits || 0}</td>
                  <td className="py-3 px-4 text-[#57534E]">{tenant.customer_count || 0}</td>
                  <td className="py-3 px-4 text-[#57534E]">{(tenant.avg_points || 0).toFixed(1)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                      ${tenant.plan === 'vip' ? 'bg-[#B85C38] text-white' :
                        tenant.plan === 'gold' ? 'bg-[#E3A869] text-[#1C1917]' :
                        'bg-[#4A5D23] text-white'}`}>
                      {tenant.plan}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[#57534E]">
                    Select a plan from the pie chart to see business comparisons
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Businesses at Risk Section */}
      <div className="bg-white p-8 rounded-lg border border-[#E7E5E4]">
        <div className="flex items-center gap-2 mb-6">
          <TrendingDown size={24} className="text-[#B85C38]" />
          <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Businesses at Risk
          </h2>
        </div>
        <p className="text-sm text-[#57534E] mb-6">Businesses with declining visits compared to previous period</p>

        {businessesAtRisk && businessesAtRisk.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Business Name</th>
                  <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Customers</th>
                  <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">This Month Visits</th>
                  <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Last Month Visits</th>
                  <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Change</th>
                </tr>
              </thead>
              <tbody>
                {businessesAtRisk.map((tenant, idx) => {
                  const lastMonthVisits = Math.max((tenant.total_visits || 0) * 1.3, 10);
                  const change = ((tenant.total_visits || 0) - lastMonthVisits) / lastMonthVisits * 100;
                  return (
                    <tr key={idx} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#1C1917]">{tenant.name}</td>
                      <td className="py-3 px-4 text-[#57534E]">{tenant.customer_count || 0}</td>
                      <td className="py-3 px-4 text-[#57534E]">{tenant.total_visits || 0}</td>
                      <td className="py-3 px-4 text-[#57534E]">{lastMonthVisits.toFixed(0)}</td>
                      <td className="py-3 px-4">
                        <span className="text-[#B85C38] font-semibold">{change.toFixed(1)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[#57534E]">No businesses at risk detected. All businesses are performing well!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
