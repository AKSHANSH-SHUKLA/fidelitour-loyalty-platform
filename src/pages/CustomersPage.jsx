import React, { useState, useEffect } from 'react';
import { Search, UserCircle, Filter, MapPin, Award, Hash, X, Download, Map, Clock, Gift, Calendar, TrendingDown, Zap, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ownerAPI } from '../lib/api';
import TierBadge from '../components/TierBadge';
import { PageHeader, C as C_PS } from '../components/PageShell';

// Pre-built segments that power one-click targeting. Server-side fields map to
// the extended GET /api/owner/customers filters.
const QUICK_SEGMENTS = [
  { key: 'vip',          label: 'VIPs',                 icon: Award,      serverParams: { tier: 'vip' } },
  { key: 'big_spenders', label: 'Big spenders €300+',   icon: Zap,        serverParams: { min_amount: 300 } },
  { key: 'loyal_5',      label: 'Loyal (5+ visits)',    icon: Award,      serverParams: { min_visits: 5 } },
  { key: 'birthday',     label: 'Birthday this month',  icon: Calendar,   serverParams: { has_birthday_this_month: true } },
  { key: 'one_and_done', label: 'One-and-done',         icon: TrendingDown, serverParams: { max_visits: 1 } },
  { key: 'dormant',      label: 'Dormant (30d+)',       icon: Clock,      serverParams: { inactive_days_min: 30 } },
  { key: 'at_risk',      label: 'At risk (14–29d)',     icon: Clock,      serverParams: { inactive_days_min: 14, inactive_days_max: 29 } },
  { key: 'lunch',        label: 'Lunch regulars',       icon: Clock,      serverParams: { time_segment: 'lunch' } },
  { key: 'evening',      label: 'Evening regulars',     icon: Clock,      serverParams: { time_segment: 'evening' } },
  { key: 'weekend',      label: 'Weekend regulars',     icon: Calendar,   serverParams: { time_segment: 'weekend' } },
  { key: 'weekday',      label: 'Weekday regulars',     icon: Calendar,   serverParams: { time_segment: 'weekday' } },
  { key: 'redeemed',     label: 'Has redeemed reward',  icon: Gift,       serverParams: { redeemed_reward: true } },
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const [allCustomers, setAllCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const [minVisits, setMinVisits] = useState('');
  const [maxVisits, setMaxVisits] = useState('');
  const [minAmountPaid, setMinAmountPaid] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [minTotalSpent, setMinTotalSpent] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [activeQuickSegment, setActiveQuickSegment] = useState(null); // which pill is pressed
  // Saved segments (owner's custom combos)
  const [savedSegments, setSavedSegments] = useState([]);
  const [savingSegment, setSavingSegment] = useState(false);
  const [segmentName, setSegmentName] = useState('');

  // Re-fetch customers with the current server-side filter set. Used both on
  // mount (no filters) and whenever a quick-pick segment toggles.
  const fetchCustomers = async (serverParams = {}) => {
    try {
      setLoading(true);
      const res = await ownerAPI.getCustomers(serverParams);
      setAllCustomers(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers + saved segments on mount
  useEffect(() => {
    fetchCustomers();
    (async () => {
      try {
        const r = await ownerAPI.listSavedSegments();
        setSavedSegments(r.data?.segments || []);
      } catch (_e) { /* non-fatal */ }
    })();
  }, []);

  const applyQuickSegment = (seg) => {
    // Tap the same pill again to clear it — restores full list.
    if (activeQuickSegment === seg.key) {
      setActiveQuickSegment(null);
      fetchCustomers();
      return;
    }
    setActiveQuickSegment(seg.key);
    fetchCustomers(seg.serverParams || {});
  };

  // Persist the current filter combo as a named segment.
  const saveCurrentAsSegment = async () => {
    const name = (segmentName || '').trim() || window.prompt('Name this segment (e.g. "VIPs in Paris"):');
    if (!name) return;
    try {
      setSavingSegment(true);
      const filters = {
        tier: tierFilter !== 'All' ? tierFilter.toLowerCase() : undefined,
        min_visits: minVisits ? Number(minVisits) : undefined,
        max_visits: maxVisits ? Number(maxVisits) : undefined,
        min_amount: minAmountPaid ? Number(minAmountPaid) : undefined,
        postal_codes: postalCode ? postalCode.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        source: sourceFilter !== 'All' ? sourceFilter : undefined,
        quick_segment: activeQuickSegment || undefined,
      };
      const res = await ownerAPI.createSavedSegment({ name, filters });
      setSavedSegments((cur) => [res.data, ...cur]);
      setSegmentName('');
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSavingSegment(false);
    }
  };

  const loadSavedSegment = (seg) => {
    const f = seg.filters || {};
    setTierFilter(f.tier ? f.tier.charAt(0).toUpperCase() + f.tier.slice(1) : 'All');
    setMinVisits(f.min_visits ?? '');
    setMaxVisits(f.max_visits ?? '');
    setMinAmountPaid(f.min_amount ?? '');
    setPostalCode(Array.isArray(f.postal_codes) ? f.postal_codes.join(',') : '');
    setSourceFilter(f.source || 'All');
    if (f.quick_segment) {
      const q = QUICK_SEGMENTS.find(s => s.key === f.quick_segment);
      if (q) applyQuickSegment(q); else fetchCustomers();
    } else {
      setActiveQuickSegment(null);
      fetchCustomers();
    }
  };

  const deleteSavedSegment = async (id) => {
    if (!window.confirm('Delete this saved segment?')) return;
    try {
      await ownerAPI.deleteSavedSegment(id);
      setSavedSegments((cur) => cur.filter(s => s.id !== id));
    } catch (e) { alert('Failed: ' + (e?.response?.data?.detail || e.message)); }
  };

  // Send a campaign to whoever is currently filtered on the page.
  const sendCampaignToFiltered = () => {
    if (!filteredCustomers.length) { alert('No customers in the current view.'); return; }
    if (!window.confirm(`Send a campaign to ${filteredCustomers.length} filtered customer(s)?`)) return;
    const activeLabel = activeQuickSegment
      ? (QUICK_SEGMENTS.find(s => s.key === activeQuickSegment)?.label || 'Segment')
      : 'Ciblage clients';
    try {
      sessionStorage.setItem('campaignHandoff', JSON.stringify({
        customer_ids: filteredCustomers.map(c => c.id),
        suggested_name: activeLabel,
        suggested_message: 'Bonjour {first_name}, une attention pour vous chez {business_name} — à très vite !',
        source: 'push',
      }));
    } catch (_e) {}
    navigate('/dashboard/campaigns');
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...allCustomers];

    // Search filter (name, email, barcode_id)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.email.toLowerCase().includes(query) ||
          customer.barcode_id.toLowerCase().includes(query)
      );
    }

    // Tier filter (case-insensitive — backend uses lowercase, UI uses Title-case)
    if (tierFilter !== 'All') {
      const t = tierFilter.toLowerCase();
      filtered = filtered.filter((customer) => (customer.tier || '').toLowerCase() === t);
    }

    // Min visits
    if (minVisits !== '') {
      const min = parseInt(minVisits, 10);
      filtered = filtered.filter((customer) => customer.visits >= min);
    }

    // Max visits
    if (maxVisits !== '') {
      const max = parseInt(maxVisits, 10);
      filtered = filtered.filter((customer) => customer.visits <= max);
    }

    // Min amount paid
    if (minAmountPaid !== '') {
      const min = parseFloat(minAmountPaid);
      filtered = filtered.filter((customer) => customer.total_amount_paid >= min);
    }

    // Postal code filter (supports comma-separated values)
    if (postalCode.trim()) {
      const codes = postalCode.split(',').map((code) => code.trim().toLowerCase());
      filtered = filtered.filter((customer) =>
        codes.includes(customer.postal_code.toLowerCase())
      );
    }

    // Min total spent
    if (minTotalSpent !== '') {
      const min = parseFloat(minTotalSpent);
      filtered = filtered.filter((customer) => (customer.total_amount_paid || 0) >= min);
    }

    // Source filter — only the 4 allowed sources
    if (sourceFilter !== 'All') {
      const sourceMap = {
        'QR in store': 'qr_store',
        'Instagram': 'instagram',
        'Facebook': 'facebook',
        'TikTok': 'tiktok',
      };
      const sourceValue = sourceMap[sourceFilter];
      filtered = filtered.filter((customer) => customer.acquisition_source === sourceValue);
    }

    setFilteredCustomers(filtered);
  }, [allCustomers, searchQuery, tierFilter, minVisits, maxVisits, minAmountPaid, postalCode, minTotalSpent, sourceFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter('All');
    setMinVisits('');
    setMaxVisits('');
    setMinAmountPaid('');
    setPostalCode('');
    setMinTotalSpent('');
    setSourceFilter('All');
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRelativeDate = (dateString) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getTierBadgeColor = (tier) => {
    switch (tier) {
      case 'Gold':
        return { bg: '#E3A86920', text: '#B85C38' };
      case 'Silver':
        return { bg: '#F3F3F2', text: '#57534E' };
      case 'Bronze':
        return { bg: '#F3EFE7', text: '#57534E' };
      default:
        return { bg: '#E7E5E4', text: '#57534E' };
    }
  };

  const getSourceBadge = (source) => {
    const badges = {
      'qr_store': { emoji: '📱', label: 'QR in store', bg: '#EBE5F5' },
      'instagram': { emoji: '📸', label: 'Instagram', bg: '#FCE7F3' },
      'facebook': { emoji: '👥', label: 'Facebook', bg: '#F3EFFF' },
      'tiktok': { emoji: '🎵', label: 'TikTok', bg: '#E0F7F4' },
    };
    return badges[source] || { emoji: '—', label: '—', bg: '#F3F3F2' };
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Postal Code', 'Tier', 'Total Visits', 'Points', 'Total Spent', 'Source', 'Join Date'];
    const rows = filteredCustomers.map((c) => {
      const sourceBadge = getSourceBadge(c.acquisition_source);
      return [
        c.name,
        c.email,
        c.phone || '',
        c.postal_code || '',
        c.tier || '',
        c.visits || 0,
        c.points || (c.visits || 0) * 10,
        (c.total_amount_paid || 0).toFixed(2),
        sourceBadge.label,
        c.join_date ? new Date(c.join_date).toLocaleDateString() : '',
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div
        className="p-8"
        style={{ backgroundColor: '#FDFBF7' }}
      >
        <p style={{ color: '#57534E' }}>Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-8"
        style={{ backgroundColor: '#FDFBF7' }}
      >
        <p style={{ color: '#B85C38' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Database"
        title="Customers"
        description="Browse, search, segment, and export your loyalty customer base."
        role="business_owner"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => window.location.href = '/dashboard/map'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition-all shadow-md hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${C_PS.ochre}, ${C_PS.terracotta})` }}
            >
              <Map size={16} /> Map View
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: 'white', border: `1px solid ${C_PS.hairline}`, color: C_PS.inkSoft }}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border"
          style={{
            backgroundColor: '#F3EFE7',
            borderColor: '#E7E5E4',
          }}
        >
          <Search size={20} style={{ color: '#57534E' }} />
          <input
            type="text"
            placeholder="Search by name, email, or barcode ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Quick-pick segments — one click to isolate a marketing target */}
      <div className="mb-6 p-4 rounded-lg border bg-white" style={{ borderColor: '#E7E5E4' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: '#B85C38' }} />
            <span className="font-bold text-[#1C1917]">Quick segments</span>
            <span className="text-xs text-[#8B8680]">One click → isolate a marketing target, then send a campaign</span>
          </div>
          <button
            onClick={sendCampaignToFiltered}
            disabled={!filteredCustomers.length}
            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: '#B85C38' }}
          >
            <Megaphone size={14} />
            Send campaign to {filteredCustomers.length}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_SEGMENTS.map((seg) => {
            const Icon = seg.icon;
            const active = activeQuickSegment === seg.key;
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() => applyQuickSegment(seg)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 border transition ${
                  active
                    ? 'bg-[#B85C38] text-white border-[#B85C38]'
                    : 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#B85C38]'
                }`}
              >
                <Icon size={13} />
                {seg.label}
              </button>
            );
          })}
          {activeQuickSegment && (
            <button
              type="button"
              onClick={() => { setActiveQuickSegment(null); fetchCustomers(); }}
              className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#E7E5E4] text-[#57534E] hover:bg-[#FEF2F0]"
            >
              <X size={12} className="inline -mt-0.5 mr-1" /> Clear
            </button>
          )}
        </div>

        {/* Saved segments — owner's custom combos */}
        <div className="mt-4 pt-3 border-t border-[#E7E5E4]">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-xs font-bold text-[#57534E] uppercase tracking-wider">Saved segments</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="Name this filter combo…"
                className="px-2 py-1 text-xs border border-[#E7E5E4] rounded"
              />
              <button
                onClick={saveCurrentAsSegment}
                disabled={savingSegment}
                className="px-2 py-1 text-xs rounded border border-[#B85C38] text-[#B85C38] font-bold hover:bg-[#FEF2F0] disabled:opacity-40"
              >
                {savingSegment ? 'Saving…' : '+ Save current'}
              </button>
            </div>
          </div>
          {savedSegments.length === 0 ? (
            <p className="text-xs text-[#8B8680] italic">
              Tune any filter combination and click "Save current" to reuse it later.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {savedSegments.map((s) => (
                <div key={s.id} className="flex items-center gap-1 border border-[#E7E5E4] rounded-full pl-3 pr-1 py-0.5 bg-[#FDFBF7]">
                  <button onClick={() => loadSavedSegment(s)} className="text-xs font-semibold text-[#1C1917]">
                    {s.name}
                  </button>
                  <button onClick={() => deleteSavedSegment(s.id)} className="text-[#8B8680] hover:text-red-600 p-1" title="Delete">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <div
        className="mb-6 p-4 rounded-lg border"
        style={{
          backgroundColor: '#F3EFE7',
          borderColor: '#E7E5E4',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} style={{ color: '#B85C38' }} />
          <span
            style={{
              color: '#1C1917',
              fontWeight: '600',
              fontFamily: 'Manrope',
              fontSize: '14px',
            }}
          >
            Filters
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-4">
          {/* Tier Filter */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Tier
            </label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            >
              <option>All</option>
              <option>Bronze</option>
              <option>Silver</option>
              <option>Gold</option>
              <option>VIP</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            >
              <option>All</option>
              <option>QR in store</option>
              <option>Instagram</option>
              <option>Facebook</option>
              <option>TikTok</option>
            </select>
          </div>

          {/* Min Visits */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Min Visits
            </label>
            <input
              type="number"
              placeholder="0"
              value={minVisits}
              onChange={(e) => setMinVisits(e.target.value)}
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            />
          </div>

          {/* Min Amount Paid */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Min Amount (EUR)
            </label>
            <input
              type="number"
              placeholder="0"
              value={minAmountPaid}
              onChange={(e) => setMinAmountPaid(e.target.value)}
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            />
          </div>

          {/* Postal Code */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Postal Code
            </label>
            <input
              type="text"
              placeholder="37000"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={clearFilters}
          className="px-4 py-2 rounded text-sm font-medium transition-colors hover:opacity-80"
          style={{
            backgroundColor: '#B85C38',
            color: '#FDFBF7',
            fontFamily: 'Manrope',
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* Customer Count */}
      <div className="mb-4">
        <p
          style={{
            color: '#57534E',
            fontFamily: 'Manrope',
            fontSize: '14px',
          }}
        >
          Showing <strong>{filteredCustomers.length}</strong> of{' '}
          <strong>{allCustomers.length}</strong> customers
        </p>
      </div>

      {/* Customer Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: '#E7E5E4' }}
      >
        <div
          style={{ backgroundColor: '#F3EFE7' }}
        >
          <div className="grid gap-4 px-6 py-3 text-sm font-semibold"
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              gridTemplateColumns: '3fr 2fr 1fr 1fr 1fr 1fr 1.2fr 1.2fr 1fr',
            }}
          >
            <div>Customer</div>
            <div>Barcode ID</div>
            <div className="text-center">Visits</div>
            <div className="text-center">Tier</div>
            <div>Postal Code</div>
            <div>Source</div>
            <div className="text-right">Amount Paid</div>
            <div className="text-right">Total Spent</div>
            <div>Last Visit</div>
          </div>
        </div>

        <div
          style={{ backgroundColor: '#FDFBF7' }}
        >
          {filteredCustomers.length === 0 ? (
            <div className="px-6 py-8 text-center"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
              }}
            >
              No customers found matching your filters.
            </div>
          ) : (
            filteredCustomers.map((customer, idx) => (
              <div
                key={customer.id}
                className="grid gap-4 px-6 py-4 border-t"
                style={{
                  borderColor: '#E7E5E4',
                  backgroundColor: idx % 2 === 0 ? '#FDFBF7' : '#F3EFE7',
                  gridTemplateColumns: '3fr 2fr 1fr 1fr 1fr 1fr 1.2fr 1.2fr 1fr',
                }}
              >
                {/* Customer Name, Email, Phone */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{
                      backgroundColor: '#B85C38',
                      color: '#FDFBF7',
                    }}
                  >
                    {getInitials(customer.name)}
                  </div>
                  <div>
                    <p
                      className="font-medium text-sm"
                      style={{
                        color: '#1C1917',
                        fontFamily: 'Manrope',
                      }}
                    >
                      {customer.name}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color: '#57534E',
                        fontFamily: 'Manrope',
                      }}
                    >
                      {customer.email}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color: '#57534E',
                        fontFamily: 'Manrope',
                      }}
                    >
                      {customer.phone}
                    </p>
                  </div>
                </div>

                {/* Barcode ID */}
                <div className="flex items-center"
                  style={{
                    color: '#1C1917',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  }}
                >
                  {customer.barcode_id}
                </div>

                {/* Visits */}
                <div
                  className="flex items-center justify-center font-bold text-sm"
                  style={{
                    color: '#1C1917',
                    fontFamily: 'Manrope',
                  }}
                >
                  {customer.visits}
                </div>

                {/* Tier */}
                <div className="flex items-center justify-center">
                  <TierBadge tier={customer.tier} size="sm" />
                </div>

                {/* Postal Code */}
                <div className="flex items-center"
                  style={{
                    color: '#57534E',
                    fontFamily: 'Manrope',
                    fontSize: '13px',
                  }}
                >
                  <MapPin size={14} className="mr-1" />
                  {customer.postal_code}
                </div>

                {/* Source Badge */}
                <div className="flex items-center">
                  {(() => {
                    const badge = getSourceBadge(customer.acquisition_source);
                    return (
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: badge.bg,
                          color: '#1C1917',
                          fontFamily: 'Manrope',
                        }}
                      >
                        {badge.emoji} {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Amount Paid */}
                <div
                  className="text-right flex items-center justify-end font-medium"
                  style={{
                    color: '#1C1917',
                    fontFamily: 'Manrope',
                    fontSize: '13px',
                  }}
                >
                  €{customer.total_amount_paid.toFixed(2)}
                </div>

                {/* Total Spent */}
                <div
                  className="text-right flex items-center justify-end font-semibold"
                  style={{
                    color: '#B85C38',
                    fontFamily: 'Manrope',
                    fontSize: '13px',
                  }}
                >
                  €{(customer.total_amount_paid || 0).toFixed(2)}
                </div>

                {/* Last Visit */}
                <div
                  className="flex items-center text-xs"
                  style={{
                    color: '#57534E',
                    fontFamily: 'Manrope',
                  }}
                >
                  {getRelativeDate(customer.last_visit_date)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
