import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Users, DollarSign, Eye, Activity, ChevronRight, X } from 'lucide-react';
import api, { adminAPI } from '../lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [enhancedAnalytics, setEnhancedAnalytics] = useState(null);
  const [planDistribution, setPlanDistribution] = useState([]);
  const [tenantGrowth, setTenantGrowth] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [businessHealth, setBusinessHealth] = useState({
    regular: { count: 0, list: [] },
    growing: { count: 0, list: [] },
    declining: { count: 0, list: [] },
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState('operational');
  const [selectedModal, setSelectedModal] = useState(null);
  const [modalData, setModalData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // allSettled so one slow/failing endpoint doesn't zero out the whole page
      const [statsRes, detailedRes, enhancedRes] = await Promise.allSettled([
        adminAPI.getAnalytics(),
        adminAPI.getDetailedAnalytics(),
        adminAPI.getEnhancedAnalytics(),
      ]);

      let anyFailed = false;

      if (statsRes.status === 'fulfilled') {
        const d = statsRes.value.data;
        setStats({
          totalBusinesses: d.total_tenants || 0,
          totalCustomers: d.total_customers || 0,
          monthlyRevenue: d.monthly_revenue || 0,
          activeBusinesses30Days: d.active_tenants_30d || 0,
          avgCustomersPerBusiness: d.total_tenants > 0
            ? Math.round(d.total_customers / d.total_tenants)
            : 0,
          platformVisitCount: d.total_visits || 0,
        });
      } else {
        anyFailed = true;
        console.error('getAnalytics failed:', statsRes.reason);
      }

      if (detailedRes.status === 'fulfilled') {
        setPlanDistribution(detailedRes.value.data.plans_distribution || []);
        setTenantGrowth((detailedRes.value.data.growth || []).map(g => ({ date: g.month, count: g.tenants })));
      } else {
        anyFailed = true;
        console.error('getDetailedAnalytics failed:', detailedRes.reason);
      }

      if (enhancedRes.status === 'fulfilled') {
        const d = enhancedRes.value.data;
        setEnhancedAnalytics(d);
        setTopPerformers(d.top_performers || []);
        setBusinessHealth({
          regular: {
            count: d.business_health?.regular || 0,
            list: d.business_health?.regular_list || [],
          },
          growing: {
            count: d.business_health?.growing || 0,
            list: d.business_health?.growing_list || [],
          },
          declining: {
            count: d.business_health?.declining || 0,
            list: d.business_health?.declining_list || [],
          },
        });
      } else {
        anyFailed = true;
        console.error('getEnhancedAnalytics failed:', enhancedRes.reason);
      }

      // Mock recent activity (in production, this would come from a real endpoint)
      setRecentActivity([
        { id: 1, action: 'New business registered', detail: 'Café Milano', timestamp: '2 hours ago' },
        { id: 2, action: 'Customer tier upgraded', detail: '5 customers upgraded to Gold', timestamp: '4 hours ago' },
        { id: 3, action: 'Campaign sent', detail: 'Loyalty boost campaign', timestamp: '6 hours ago' },
        { id: 4, action: 'Plan upgraded', detail: 'Basic → Gold', timestamp: '1 day ago' },
        { id: 5, action: 'Customer joined', detail: '12 new customers across platform', timestamp: '1 day ago' },
      ]);

      setSystemStatus(anyFailed ? 'degraded' : 'operational');
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setSystemStatus('degraded');
    } finally {
      setLoading(false);
    }
  };

  const PLAN_COLORS = {
    'Basic': '#4A5D23',
    'Gold': '#E3A869',
    'VIP': '#B85C38',
  };

  const BUSINESS_HEALTH_COLORS = {
    regular: '#2D7D9A',
    growing: '#4A5D23',
    declining: '#B85C38',
  };

  const handleKPIClick = (type) => {
    setSelectedModal(type);
    switch (type) {
      case 'businesses':
        setModalData(enhancedAnalytics?.top_performers?.map(p => ({ name: p.name, value: 1 })) || []);
        break;
      case 'customers':
        setModalData([{ name: 'Total Customers', value: stats?.totalCustomers || 0 }]);
        break;
      case 'visits':
        setModalData([{ name: 'Total Platform Visits', value: stats?.platformVisitCount || 0 }]);
        break;
      case 'regular':
        setModalData(businessHealth.regular.list);
        break;
      case 'growing':
        setModalData(businessHealth.growing.list);
        break;
      case 'declining':
        setModalData(businessHealth.declining.list);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8 flex items-center justify-center">
        <div className="text-[#57534E]">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: 'Cormorant Garamond' }}>
          Admin Dashboard
        </h1>
        <p className="text-[#57534E]">Overview of FidéliTour platform performance</p>
      </div>

      {/* System Status */}
      <div className="mb-8 p-4 bg-[#F3EFE7] border border-[#E7E5E4] rounded-lg flex items-center gap-2">
        <AlertCircle size={20} className={systemStatus === 'operational' ? 'text-[#4A5D23]' : 'text-[#B85C38]'} />
        <span className="text-[#57534E]">
          System Status: <span className="font-semibold capitalize">{systemStatus}</span>
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Total Businesses */}
        <div
          onClick={() => handleKPIClick('businesses')}
          className="bg-white border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-[#B85C38] transition-all"
        >
          <p className="text-[#57534E] text-sm mb-2 flex items-center gap-2">
            <Users size={16} className="text-[#B85C38]" />
            Total Businesses
          </p>
          <h3 className="text-3xl font-bold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond' }}>
            {stats?.totalBusinesses || 0}
          </h3>
          <p className="text-xs text-[#57534E]">All active and inactive businesses registered</p>
        </div>

        {/* Total Customers */}
        <div
          onClick={() => handleKPIClick('customers')}
          className="bg-white border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-[#B85C38] transition-all"
        >
          <p className="text-[#57534E] text-sm mb-2 flex items-center gap-2">
            <Users size={16} className="text-[#E3A869]" />
            Total Customers
          </p>
          <h3 className="text-3xl font-bold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond' }}>
            {stats?.totalCustomers || 0}
          </h3>
          <p className="text-xs text-[#57534E]">All unique end-users across all businesses</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
          <p className="text-[#57534E] text-sm mb-2 flex items-center gap-2">
            <DollarSign size={16} className="text-[#4A5D23]" />
            Monthly Platform Revenue
          </p>
          <h3 className="text-3xl font-bold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond' }}>
            €{(stats?.monthlyRevenue || 0).toLocaleString()}
          </h3>
          <p className="text-xs text-[#57534E]">Total subscription revenue this month</p>
        </div>

        {/* Active Businesses (30 days) */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
          <p className="text-[#57534E] text-sm mb-2 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#2D7D9A]" />
            Active Businesses (30d)
          </p>
          <h3 className="text-3xl font-bold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond' }}>
            {stats?.activeBusinesses30Days || 0}
          </h3>
          <p className="text-xs text-[#57534E]">Businesses with activity in past 30 days</p>
        </div>

        {/* Avg Customers Per Business */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
          <p className="text-[#57534E] text-sm mb-2 flex items-center gap-2">
            <Activity size={16} className="text-[#6B4C8A]" />
            Avg Customers/Business
          </p>
          <h3 className="text-3xl font-bold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond' }}>
            {stats?.avgCustomersPerBusiness || 0}
          </h3>
          <p className="text-xs text-[#57534E]">Average customers per business</p>
        </div>

        {/* Platform Visit Count */}
        <div
          onClick={() => handleKPIClick('visits')}
          className="bg-white border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-[#B85C38] transition-all"
        >
          <p className="text-[#57534E] text-sm mb-2 flex items-center gap-2">
            <Eye size={16} className="text-[#8B6914]" />
            Platform Visit Count
          </p>
          <h3 className="text-3xl font-bold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond' }}>
            {(stats?.platformVisitCount || 0).toLocaleString()}
          </h3>
          <p className="text-xs text-[#57534E]">Total visits across all businesses</p>
        </div>
      </div>

      {/* Business Health Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Regular */}
        <div
          onClick={() => handleKPIClick('regular')}
          className="bg-white border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-[#2D7D9A] transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              Regular
            </h3>
            <div className="w-10 h-10 rounded-full bg-[#2D7D9A]/10 flex items-center justify-center">
              <span className="text-[#2D7D9A] font-bold">{businessHealth.regular.count}</span>
            </div>
          </div>
          <p className="text-sm text-[#57534E]">Active in last 14 days</p>
          <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
            <p className="text-xs text-[#57534E]">Click to see all {businessHealth.regular.count} businesses</p>
          </div>
        </div>

        {/* Growing */}
        <div
          onClick={() => handleKPIClick('growing')}
          className="bg-white border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-[#4A5D23] transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              Growing
            </h3>
            <div className="w-10 h-10 rounded-full bg-[#4A5D23]/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-[#4A5D23]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#4A5D23] mb-2">{businessHealth.growing.count}</p>
          <p className="text-sm text-[#57534E]">New customers increasing</p>
          <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
            <p className="text-xs text-[#57534E]">Click to see all {businessHealth.growing.count} businesses</p>
          </div>
        </div>

        {/* Declining */}
        <div
          onClick={() => handleKPIClick('declining')}
          className="bg-white border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-[#B85C38] transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              Declining
            </h3>
            <div className="w-10 h-10 rounded-full bg-[#B85C38]/10 flex items-center justify-center">
              <TrendingDown size={18} className="text-[#B85C38]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#B85C38] mb-2">{businessHealth.declining.count}</p>
          <p className="text-sm text-[#57534E]">Fewer visits this period</p>
          <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
            <p className="text-xs text-[#57534E]">Click to see all {businessHealth.declining.count} businesses</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Plan Distribution Pie Chart */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Businesses by Subscription Plan
          </h2>
          <div className="h-80 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PLAN_COLORS[entry.name] || '#B85C38'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
            <span className="font-semibold">What does this mean?</span> This shows how many businesses are using each subscription plan. More VIP customers means higher revenue.
          </p>
        </div>

        {/* Business Growth Line Chart */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
            Business Growth Over Time
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tenantGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="date" stroke="#57534E" />
                <YAxis stroke="#57534E" />
                <Tooltip contentStyle={{ backgroundColor: '#F3EFE7', border: '1px solid #E7E5E4' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#B85C38"
                  dot={{ fill: '#B85C38' }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
            <span className="font-semibold">What does this mean?</span> This tracks how many new businesses have joined the platform over time. An upward trend shows growth.
          </p>
        </div>
      </div>

      {/* Top 5 Performing Businesses Bar Chart */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
          Top 5 Performing Businesses
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topPerformers.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="name" stroke="#57534E" angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#57534E" label={{ value: 'Total Visits', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#F3EFE7', border: '1px solid #E7E5E4' }} />
              <Bar dataKey="total_visits" fill="#B85C38" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-4">
          <span className="font-semibold">What does this mean?</span> These are the businesses with the highest number of customer visits, indicating strong engagement and loyalty program usage.
        </p>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
          Recent Activity
        </h2>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-[#E7E5E4] last:border-b-0">
              <div className="w-2 h-2 rounded-full bg-[#B85C38] mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1C1917]">{activity.action}</p>
                <p className="text-sm text-[#57534E]">{activity.detail}</p>
              </div>
              <p className="text-xs text-[#A8A29E] whitespace-nowrap">{activity.timestamp}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for KPI Details */}
      {selectedModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-[#E7E5E4] p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                {selectedModal === 'businesses' && 'All Businesses'}
                {selectedModal === 'customers' && 'Total Customers'}
                {selectedModal === 'visits' && 'Platform Visits'}
                {selectedModal === 'regular' && 'Regular Businesses'}
                {selectedModal === 'growing' && 'Growing Businesses'}
                {selectedModal === 'declining' && 'Declining Businesses'}
              </h2>
              <button
                onClick={() => setSelectedModal(null)}
                className="text-[#A8A29E] hover:text-[#1C1917]"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {selectedModal === 'customers' || selectedModal === 'visits' ? (
                <div className="text-center py-8">
                  <p className="text-3xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                    {modalData[0]?.value || 0}
                  </p>
                  <p className="text-[#57534E] mt-2">{modalData[0]?.name}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E7E5E4]">
                        <th className="py-3 px-4 font-semibold text-[#57534E]">Business Name</th>
                        <th className="py-3 px-4 font-semibold text-[#57534E]">Customers</th>
                        <th className="py-3 px-4 font-semibold text-[#57534E]">Visits</th>
                        <th className="py-3 px-4 font-semibold text-[#57534E]">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedModal === 'businesses' ? enhancedAnalytics?.top_performers || [] : modalData).map((item, idx) => (
                        <tr key={idx} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7]">
                          <td className="py-3 px-4 text-[#1C1917]">{item.name}</td>
                          <td className="py-3 px-4 text-[#57534E]">{item.customer_count || 0}</td>
                          <td className="py-3 px-4 text-[#57534E]">{item.total_visits || 0}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                              ${item.plan === 'vip' ? 'bg-[#B85C38] text-white' :
                                item.plan === 'gold' ? 'bg-[#E3A869] text-[#1C1917]' :
                                'bg-[#4A5D23] text-white'}`}>
                              {item.plan}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
