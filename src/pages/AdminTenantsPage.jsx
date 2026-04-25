import React, { useEffect, useState } from 'react';
import api, { adminAPI } from '../lib/api';
import { Search, Filter, MoreVertical, ChevronDown, X, Download, Mail, TrendingUp, Users, BarChart3 } from 'lucide-react';
import TierBadge from '../components/TierBadge';

const AdminTenantsPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [minCustomers, setMinCustomers] = useState('');
  const [maxCustomers, setMaxCustomers] = useState('');
  const [minNewCustomers, setMinNewCustomers] = useState('');
  const [newCustomersDays, setNewCustomersDays] = useState('30');
  const [minAvgPoints, setMinAvgPoints] = useState('');
  const [minTotalVisits, setMinTotalVisits] = useState('');
  const [maxTotalVisits, setMaxTotalVisits] = useState('');
  const [filterByTier, setFilterByTier] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // UI states
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [tenantCustomers, setTenantCustomers] = useState([]);
  const [tenantAnalytics, setTenantAnalytics] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [newPlan, setNewPlan] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getTenants();
      setTenants(data);
    } catch (error) {
      console.error('Failed to fetch tenants', error);
    } finally {
      setLoading(false);
    }
  };

  // Advanced filtering logic
  const filteredTenants = tenants.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       (t.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = planFilter === 'all' || t.plan === planFilter;

    // Customer count range filter
    const customerCount = t.customer_count || 0;
    const matchMinCustomers = minCustomers === '' || customerCount >= parseInt(minCustomers);
    const matchMaxCustomers = maxCustomers === '' || customerCount <= parseInt(maxCustomers);

    // New customers filter
    const newCustomersCount = t.new_customers_count || 0;
    const matchNewCustomers = minNewCustomers === '' || newCustomersCount >= parseInt(minNewCustomers);

    // Average points filter
    const avgPoints = t.avg_points || 0;
    const matchAvgPoints = minAvgPoints === '' || avgPoints >= parseFloat(minAvgPoints);

    // Total visits filter
    const totalVisits = t.total_visits || 0;
    const matchMinVisits = minTotalVisits === '' || totalVisits >= parseInt(minTotalVisits);
    const matchMaxVisits = maxTotalVisits === '' || totalVisits <= parseInt(maxTotalVisits);

    // Status filter (active/declining/growing)
    const isActive = totalVisits > 0;
    const matchStatus = statusFilter === 'all' ||
                       (statusFilter === 'active' && isActive) ||
                       (statusFilter === 'inactive' && !isActive);

    // Tier filter (e.g., show businesses with >50% Gold customers)
    let matchTier = true;
    if (filterByTier !== '') {
      const tierDist = t.tier_distribution || {};
      const tierPercentage = (tierDist[filterByTier.toLowerCase()] || 0) * 100;
      matchTier = tierPercentage >= 50;
    }

    return matchSearch && matchPlan && matchMinCustomers && matchMaxCustomers &&
           matchNewCustomers && matchAvgPoints && matchMinVisits && matchMaxVisits &&
           matchStatus && matchTier;
  });

  // Sorting logic
  const sortedTenants = [...filteredTenants].sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'customers':
        aVal = a.customer_count || 0;
        bVal = b.customer_count || 0;
        break;
      case 'visits':
        aVal = a.total_visits || 0;
        bVal = b.total_visits || 0;
        break;
      case 'points':
        aVal = a.avg_points || 0;
        bVal = b.avg_points || 0;
        break;
      case 'created':
        aVal = new Date(a.created_at);
        bVal = new Date(b.created_at);
        break;
      default:
        return 0;
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleActionClick = (tenant, e) => {
    e.stopPropagation();
    setSelectedTenant(tenant);
    setOpenMenuId(openMenuId === tenant.id ? null : tenant.id);
  };

  const handleViewDetails = () => {
    setShowDetailModal(true);
    setOpenMenuId(null);
  };

  const handleChangePlan = () => {
    setNewPlan(selectedTenant.plan);
    setShowPlanModal(true);
    setOpenMenuId(null);
  };

  const handleDisableTenant = () => {
    setShowDisableModal(true);
    setOpenMenuId(null);
  };

  const handleSendCampaign = () => {
    setCampaignSubject('');
    setCampaignBody('');
    setShowCampaignModal(true);
    setOpenMenuId(null);
  };

  const handleViewCustomers = async () => {
    setOpenMenuId(null);
    setShowCustomersModal(true);
    setModalLoading(true);
    try {
      const { data } = await adminAPI.getTenantCustomers(selectedTenant.id);
      setTenantCustomers(data || []);
    } catch (e) {
      console.error('Failed to fetch tenant customers:', e);
      setTenantCustomers([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleViewAnalytics = async () => {
    setOpenMenuId(null);
    setShowAnalyticsModal(true);
    setModalLoading(true);
    try {
      const { data } = await adminAPI.getTenantAnalytics(selectedTenant.id, { days: 30 });
      setTenantAnalytics(data);
    } catch (e) {
      console.error('Failed to fetch tenant analytics:', e);
      setTenantAnalytics(null);
    } finally {
      setModalLoading(false);
    }
  };

  const confirmChangePlan = async () => {
    try {
      await adminAPI.updateTenant(selectedTenant.id, { plan: newPlan });
      setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, plan: newPlan } : t));
      setShowPlanModal(false);
      setSelectedTenant(null);
    } catch (error) {
      console.error('Failed to change plan:', error);
    }
  };

  const confirmDisableTenant = async () => {
    try {
      await adminAPI.deleteTenant(selectedTenant.id);
      setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, disabled: true } : t));
      setShowDisableModal(false);
      setSelectedTenant(null);
    } catch (error) {
      console.error('Failed to disable tenant:', error);
    }
  };

  const confirmSendCampaign = async () => {
    try {
      await adminAPI.sendBusinessCampaign({
        tenant_id: selectedTenant.id,
        subject: campaignSubject,
        body: campaignBody,
      });
      alert('Campaign sent successfully!');
      setShowCampaignModal(false);
      setSelectedTenant(null);
    } catch (error) {
      console.error('Failed to send campaign:', error);
      alert('Failed to send campaign');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Business Name', 'Plan', 'Customers', 'Visits', 'Avg Points/Customer', 'Status', 'Created'];
    const rows = sortedTenants.map(t => [
      t.name,
      t.plan,
      t.customer_count || 0,
      t.total_visits || 0,
      (t.avg_points || 0).toFixed(1),
      t.total_visits > 0 ? 'Active' : 'Inactive',
      new Date(t.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'businesses.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) return <div className="p-8 bg-[#FDFBF7] min-h-screen text-[#57534E]">Loading businesses...</div>;

  return (
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen">
      <div>
        <h1 className="text-4xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: 'Cormorant Garamond' }}>
          Manage Businesses
        </h1>
        <p className="text-[#57534E]">Search, filter, and manage individual businesses on the platform.</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-[#E7E5E4]">
        {/* Search and Basic Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              placeholder="Search by business name or ID..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E7E5E4] focus:ring-2 focus:ring-[#B85C38]/20 focus:border-[#B85C38] outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-3 rounded-lg border border-[#E7E5E4] focus:ring-2 focus:ring-[#B85C38]/20 focus:border-[#B85C38] outline-none bg-white"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="all">All Plans</option>
            <option value="basic">Basic</option>
            <option value="gold">Gold</option>
            <option value="vip">VIP</option>
          </select>
          <select
            className="px-4 py-3 rounded-lg border border-[#E7E5E4] focus:ring-2 focus:ring-[#B85C38]/20 focus:border-[#B85C38] outline-none bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Advanced Filters - Collapsible Section */}
        <details className="mb-6">
          <summary className="cursor-pointer text-sm font-semibold text-[#1C1917] flex items-center gap-2 p-4 bg-[#F3EFE7] rounded-lg hover:bg-[#E7E5E4]">
            <Filter size={16} />
            Advanced Filters
          </summary>

          <div className="mt-4 space-y-4">
            {/* Customer Count Range */}
            <div className="p-4 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
              <p className="text-sm font-semibold text-[#1C1917] mb-3">Total Customers</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#57534E] block mb-1">Min</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 10"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                    value={minCustomers}
                    onChange={(e) => setMinCustomers(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#57534E] block mb-1">Max</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 1000"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                    value={maxCustomers}
                    onChange={(e) => setMaxCustomers(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* New Customers */}
            <div className="p-4 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
              <p className="text-sm font-semibold text-[#1C1917] mb-3">New Customers (Last N Days)</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#57534E] block mb-1">Minimum New Customers</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 5"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                    value={minNewCustomers}
                    onChange={(e) => setMinNewCustomers(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#57534E] block mb-1">Days</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g., 30"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                    value={newCustomersDays}
                    onChange={(e) => setNewCustomersDays(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Average Points Per Customer */}
            <div className="p-4 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
              <label className="text-sm font-semibold text-[#1C1917] block mb-2">Average Points Per Customer (Min)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g., 50.5"
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                value={minAvgPoints}
                onChange={(e) => setMinAvgPoints(e.target.value)}
              />
            </div>

            {/* Total Visits Range */}
            <div className="p-4 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
              <p className="text-sm font-semibold text-[#1C1917] mb-3">Total Visits</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#57534E] block mb-1">Min</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 100"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                    value={minTotalVisits}
                    onChange={(e) => setMinTotalVisits(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#57534E] block mb-1">Max</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 10000"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                    value={maxTotalVisits}
                    onChange={(e) => setMaxTotalVisits(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Tier Distribution Filter */}
            <div className="p-4 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
              <label className="text-sm font-semibold text-[#1C1917] block mb-2">Filter by Tier ({'>'} 50%)</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20 bg-white"
                value={filterByTier}
                onChange={(e) => setFilterByTier(e.target.value)}
              >
                <option value="">No tier filter</option>
                <option value="Gold">Gold (&gt;50%)</option>
                <option value="VIP">VIP (&gt;50%)</option>
                <option value="Basic">Basic (&gt;50%)</option>
              </select>
            </div>
          </div>
        </details>

        {/* Export Button */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
          >
            <Download size={16} />
            Export as CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E7E5E4]">
                <th
                  className="py-4 px-4 font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                  onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  Business Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-4 px-4 font-semibold text-[#57534E]">Plan</th>
                <th
                  className="py-4 px-4 font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                  onClick={() => { setSortBy('customers'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  Customers {sortBy === 'customers' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="py-4 px-4 font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                  onClick={() => { setSortBy('visits'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  Visits {sortBy === 'visits' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="py-4 px-4 font-semibold text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                  onClick={() => { setSortBy('points'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  Avg Points/Cust {sortBy === 'points' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-4 px-4 font-semibold text-[#57534E]">Status</th>
                <th className="py-4 px-4 font-semibold text-[#57534E] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTenants.map(t => (
                <tr key={t.id} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7] transition-colors relative">
                  <td className="py-4 px-4 font-medium text-[#1C1917]">{t.name}</td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                      ${t.plan === 'vip' ? 'bg-[#B85C38] text-white' :
                        t.plan === 'gold' ? 'bg-[#E3A869] text-[#1C1917]' :
                        'bg-[#4A5D23] text-white'}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#57534E]">{t.customer_count || 0}</td>
                  <td className="py-4 px-4 text-[#57534E]">{t.total_visits || 0}</td>
                  <td className="py-4 px-4 text-[#57534E]">{(t.avg_points || 0).toFixed(1)}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold
                      ${(t.total_visits || 0) > 0 ? 'bg-[#4A5D23]/10 text-[#4A5D23]' : 'bg-[#A8A29E]/10 text-[#57534E]'}`}>
                      {(t.total_visits || 0) > 0 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right relative">
                    <button
                      onClick={(e) => handleActionClick(t, e)}
                      className="p-2 text-[#A8A29E] hover:text-[#1C1917] transition-colors rounded-full hover:bg-[#E7E5E4]"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {openMenuId === t.id && selectedTenant?.id === t.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-[#E7E5E4] shadow-lg z-10">
                        <button
                          onClick={handleViewDetails}
                          className="w-full text-left px-4 py-2 text-sm text-[#57534E] hover:bg-[#F3EFE7] transition-colors"
                        >
                          View Details
                        </button>
                        <button
                          onClick={handleViewCustomers}
                          className="w-full text-left px-4 py-2 text-sm text-[#57534E] hover:bg-[#F3EFE7] transition-colors border-t border-[#E7E5E4] flex items-center gap-2"
                        >
                          <Users size={14} />
                          View Customers
                        </button>
                        <button
                          onClick={handleViewAnalytics}
                          className="w-full text-left px-4 py-2 text-sm text-[#57534E] hover:bg-[#F3EFE7] transition-colors border-t border-[#E7E5E4] flex items-center gap-2"
                        >
                          <BarChart3 size={14} />
                          View Analytics
                        </button>
                        <button
                          onClick={handleChangePlan}
                          className="w-full text-left px-4 py-2 text-sm text-[#57534E] hover:bg-[#F3EFE7] transition-colors border-t border-[#E7E5E4]"
                        >
                          Change Plan
                        </button>
                        <button
                          onClick={handleSendCampaign}
                          className="w-full text-left px-4 py-2 text-sm text-[#57534E] hover:bg-[#F3EFE7] transition-colors border-t border-[#E7E5E4] flex items-center gap-2"
                        >
                          <Mail size={14} />
                          Send Campaign
                        </button>
                        <button
                          onClick={handleDisableTenant}
                          className="w-full text-left px-4 py-2 text-sm text-[#B85C38] hover:bg-[#F3EFE7] transition-colors border-t border-[#E7E5E4]"
                        >
                          Disable Business
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {sortedTenants.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-[#57534E]">
                    No businesses match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-[#57534E]">
          Showing {sortedTenants.length} of {tenants.length} businesses
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                Business Details
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="text-[#A8A29E] hover:text-[#1C1917]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Name</p>
                    <p className="text-[#1C1917]">{selectedTenant.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Slug</p>
                    <p className="text-[#1C1917]">{selectedTenant.slug}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Plan</p>
                    <p className="text-[#1C1917]">{selectedTenant.plan}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Created</p>
                    <p className="text-[#1C1917]">{new Date(selectedTenant.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Analytics */}
              <div>
                <h3 className="text-lg font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
                  Analytics
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-[#F3EFE7] p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Total Customers</p>
                    <p className="text-2xl font-bold text-[#1C1917]">{selectedTenant.customer_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Total Visits</p>
                    <p className="text-2xl font-bold text-[#1C1917]">{selectedTenant.total_visits || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Avg Points/Customer</p>
                    <p className="text-2xl font-bold text-[#1C1917]">{(selectedTenant.avg_points || 0).toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#57534E] font-semibold uppercase">Status</p>
                    <p className={`text-lg font-bold ${(selectedTenant.total_visits || 0) > 0 ? 'text-[#4A5D23]' : 'text-[#A8A29E]'}`}>
                      {(selectedTenant.total_visits || 0) > 0 ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Geolocalisation — SUPER ADMIN ONLY. Controls the real-time
                   proximity-push feature. The "VIP only" toggle here restricts
                   pushes to VIP-tier customers for this business. Owners cannot
                   change any of this from their side. */}
              <div>
                <h3 className="text-lg font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
                  Geolocalisation (admin only)
                </h3>
                <div className="space-y-3 bg-[#FEF9E7] border border-[#E3A869]/40 p-4 rounded-lg">
                  <p className="text-xs text-[#7B3F00]">
                    Real-time proximity push — the customer's wallet card page sends their GPS when opened;
                    if they're within the geofence of a branch, they receive a "You're just nearby!" push.
                    Toggle "VIP only" to restrict this to VIP-tier customers exclusively.
                  </p>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-sm font-semibold text-[#1C1917]">Geolocalisation enabled</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedTenant.geo_enabled)}
                      onChange={async (e) => {
                        try {
                          const res = await adminAPI.updateTenantGeo(selectedTenant.id, { geo_enabled: e.target.checked });
                          setSelectedTenant({ ...selectedTenant, ...res.data });
                          setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, ...res.data } : t));
                        } catch (err) { alert('Failed: ' + (err?.response?.data?.detail || err.message)); }
                      }}
                      className="w-5 h-5 accent-[#B85C38]"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-sm font-semibold text-[#1C1917]">
                      VIP-only proximity push
                      <span className="block text-xs font-normal text-[#57534E]">
                        Only VIP-tier customers will receive proximity pushes. Bronze/Silver/Gold get nothing.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      disabled={!selectedTenant.geo_enabled}
                      checked={Boolean(selectedTenant.vip_geo_only)}
                      onChange={async (e) => {
                        try {
                          const res = await adminAPI.updateTenantGeo(selectedTenant.id, { vip_geo_only: e.target.checked });
                          setSelectedTenant({ ...selectedTenant, ...res.data });
                          setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, ...res.data } : t));
                        } catch (err) { alert('Failed: ' + (err?.response?.data?.detail || err.message)); }
                      }}
                      className="w-5 h-5 accent-[#B85C38] disabled:opacity-40"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E3A869]/40">
                    <div>
                      <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Radius (m)</label>
                      <input
                        type="number"
                        min={50}
                        max={5000}
                        value={selectedTenant.geo_radius_meters ?? 500}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant, geo_radius_meters: parseInt(e.target.value, 10) || 500 })}
                        onBlur={async (e) => {
                          try {
                            const val = parseInt(e.target.value, 10) || 500;
                            const res = await adminAPI.updateTenantGeo(selectedTenant.id, { geo_radius_meters: val });
                            setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, ...res.data } : t));
                          } catch (err) { alert('Failed: ' + (err?.response?.data?.detail || err.message)); }
                        }}
                        className="w-full px-2 py-1 border border-[#E7E5E4] rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Cooldown (days)</label>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={selectedTenant.geo_cooldown_days ?? 1}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant, geo_cooldown_days: parseInt(e.target.value, 10) || 1 })}
                        onBlur={async (e) => {
                          try {
                            const val = parseInt(e.target.value, 10) || 1;
                            const res = await adminAPI.updateTenantGeo(selectedTenant.id, { geo_cooldown_days: val });
                            setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, ...res.data } : t));
                          } catch (err) { alert('Failed: ' + (err?.response?.data?.detail || err.message)); }
                        }}
                        className="w-full px-2 py-1 border border-[#E7E5E4] rounded text-sm"
                      />
                    </div>
                  </div>
                  {selectedTenant.geo_enabled && selectedTenant.vip_geo_only && (
                    <div className="p-2 rounded bg-[#7B3F00] text-white text-xs">
                      🎯 Active: only VIPs within {selectedTenant.geo_radius_meters ?? 500}m will be pinged,
                      at most once every {selectedTenant.geo_cooldown_days ?? 1} day(s).
                    </div>
                  )}
                </div>
              </div>

              {/* Tier Distribution */}
              {selectedTenant.tier_distribution && (
                <div>
                  <h3 className="text-lg font-semibold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
                    Customer Tier Distribution
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(selectedTenant.tier_distribution).map(([tier, percentage]) => (
                      <div key={tier} className="flex items-center gap-3">
                        <span className="w-24 text-sm text-[#57534E]">{tier}</span>
                        <div className="flex-1 bg-[#E7E5E4] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              tier === 'Gold' ? 'bg-[#E3A869]' :
                              tier === 'VIP' ? 'bg-[#B85C38]' :
                              'bg-[#4A5D23]'
                            }`}
                            style={{ width: `${(percentage || 0) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-semibold text-[#1C1917]">
                          {((percentage || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetailModal(false)}
              className="mt-6 w-full py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showPlanModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
              Change Subscription Plan
            </h2>
            <p className="text-sm text-[#57534E] mb-4">Current plan: <span className="font-semibold">{selectedTenant.plan}</span></p>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20 mb-6 bg-white"
            >
              <option value="">Select new plan</option>
              <option value="basic">Basic</option>
              <option value="gold">Gold</option>
              <option value="vip">VIP</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPlanModal(false)}
                className="flex-1 py-2 border border-[#E7E5E4] text-[#1C1917] rounded-lg font-semibold hover:bg-[#F3EFE7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmChangePlan}
                className="flex-1 py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Modal */}
      {showCampaignModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
              Send Campaign
            </h2>
            <p className="text-sm text-[#57534E] mb-4">To: <span className="font-semibold">{selectedTenant.name}</span></p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-semibold text-[#1C1917] block mb-2">Subject</label>
                <input
                  type="text"
                  placeholder="Campaign subject"
                  className="w-full px-4 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                  value={campaignSubject}
                  onChange={(e) => setCampaignSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1C1917] block mb-2">Message</label>
                <textarea
                  placeholder="Campaign message"
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border border-[#E7E5E4] outline-none focus:ring-2 focus:ring-[#B85C38]/20"
                  value={campaignBody}
                  onChange={(e) => setCampaignBody(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCampaignModal(false)}
                className="flex-1 py-2 border border-[#E7E5E4] text-[#1C1917] rounded-lg font-semibold hover:bg-[#F3EFE7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendCampaign}
                className="flex-1 py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customers Modal */}
      {showCustomersModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[85vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                  Customers — {selectedTenant.name}
                </h2>
                <p className="text-sm text-[#57534E]">{tenantCustomers.length} customers</p>
              </div>
              <button onClick={() => setShowCustomersModal(false)} className="text-[#A8A29E] hover:text-[#1C1917]">
                <X size={20} />
              </button>
            </div>

            {modalLoading ? (
              <p className="text-[#57534E] py-12 text-center">Loading customers…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E5E4]">
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Name</th>
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Email</th>
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Tier</th>
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Visits</th>
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Total Paid (€)</th>
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Postal</th>
                      <th className="py-2 px-2 font-semibold text-[#57534E]">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantCustomers.map((c) => (
                      <tr key={c.id} className="border-b border-[#F3EFE7] hover:bg-[#F3EFE7]/40">
                        <td className="py-2 px-2 text-[#1C1917] font-medium">{c.name}</td>
                        <td className="py-2 px-2 text-[#57534E]">{c.email}</td>
                        <td className="py-2 px-2"><TierBadge tier={c.tier} size="xs" /></td>
                        <td className="py-2 px-2 text-[#57534E]">{c.visits || 0}</td>
                        <td className="py-2 px-2 text-[#57534E]">{(c.total_amount_paid || 0).toFixed(2)}</td>
                        <td className="py-2 px-2 text-[#57534E]">{c.postal_code || '—'}</td>
                        <td className="py-2 px-2 text-[#57534E]">{c.acquisition_source || '—'}</td>
                      </tr>
                    ))}
                    {tenantCustomers.length === 0 && (
                      <tr><td colSpan="7" className="py-10 text-center text-[#57534E]">No customers yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={() => setShowCustomersModal(false)}
              className="mt-4 w-full py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[85vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                Analytics — {selectedTenant.name}
              </h2>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-[#A8A29E] hover:text-[#1C1917]">
                <X size={20} />
              </button>
            </div>

            {modalLoading ? (
              <p className="text-[#57534E] py-12 text-center">Loading analytics…</p>
            ) : !tenantAnalytics ? (
              <p className="text-[#57534E] py-12 text-center">No analytics available.</p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Customers" value={tenantAnalytics.total_customers} />
                  <StatCard label={`Visits (${tenantAnalytics.period_days}d)`} value={tenantAnalytics.total_visits_period} />
                  <StatCard label="Revenue (all-time)" value={`€${tenantAnalytics.total_revenue.toFixed(0)}`} />
                  <StatCard label="Cards Filled" value={tenantAnalytics.cards_filled} />
                </div>

                <div>
                  <h3 className="font-semibold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond', fontSize: '18px' }}>Tier Distribution</h3>
                  <div className="flex gap-2">
                    {Object.entries(tenantAnalytics.tier_distribution).map(([tier, n]) => (
                      <div key={tier} className="flex-1 p-3 rounded-lg text-center border border-[#E7E5E4]">
                        <TierBadge tier={tier} size="sm" />
                        <p className="text-2xl font-bold text-[#1C1917] mt-2">{n}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond', fontSize: '18px' }}>
                      Top Spenders
                    </h3>
                    <div className="space-y-1">
                      {(tenantAnalytics.top_spenders || []).map((c) => (
                        <div key={c.id} className="flex justify-between items-center py-1 px-2 rounded hover:bg-[#F3EFE7]">
                          <div>
                            <p className="text-sm text-[#1C1917] font-medium">{c.name}</p>
                            <TierBadge tier={c.tier} size="xs" />
                          </div>
                          <p className="text-sm text-[#B85C38] font-bold">€{(c.total_amount_paid || 0).toFixed(0)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond', fontSize: '18px' }}>
                      Top Visitors
                    </h3>
                    <div className="space-y-1">
                      {(tenantAnalytics.top_visitors || []).map((c) => (
                        <div key={c.id} className="flex justify-between items-center py-1 px-2 rounded hover:bg-[#F3EFE7]">
                          <div>
                            <p className="text-sm text-[#1C1917] font-medium">{c.name}</p>
                            <TierBadge tier={c.tier} size="xs" />
                          </div>
                          <p className="text-sm text-[#B85C38] font-bold">{c.visits} visits</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-[#1C1917] mb-3" style={{ fontFamily: 'Cormorant Garamond', fontSize: '18px' }}>
                    Acquisition Sources
                  </h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                    {Object.entries(tenantAnalytics.acquisition_breakdown || {}).map(([k, n]) => (
                      <div key={k} className="text-center p-2 bg-[#F3EFE7] rounded-lg">
                        <p className="text-xs text-[#57534E] capitalize">{k || 'unknown'}</p>
                        <p className="text-lg font-bold text-[#1C1917]">{n}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowAnalyticsModal(false)}
              className="mt-4 w-full py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Disable Confirmation Modal */}
      {showDisableModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-[#1C1917] mb-4" style={{ fontFamily: 'Cormorant Garamond' }}>
              Disable Business?
            </h2>
            <p className="text-[#57534E] mb-6">Are you sure you want to disable <span className="font-semibold">{selectedTenant.name}</span>? This business will no longer be able to access the platform.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisableModal(false)}
                className="flex-1 py-2 border border-[#E7E5E4] text-[#1C1917] rounded-lg font-semibold hover:bg-[#F3EFE7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisableTenant}
                className="flex-1 py-2 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StatCard({ label, value }) {
  return (
    <div className="p-4 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
      <p className="text-xs text-[#57534E] uppercase font-semibold">{label}</p>
      <p className="text-2xl font-bold text-[#1C1917] mt-1">{value}</p>
    </div>
  );
}

export default AdminTenantsPage;
