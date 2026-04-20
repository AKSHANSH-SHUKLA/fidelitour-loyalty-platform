import React, { useState, useEffect } from 'react';
import { Search, UserCircle, Filter, MapPin, Award, Hash, X, Download, Map } from 'lucide-react';
import { ownerAPI } from '../lib/api';

export default function CustomersPage() {
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

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await ownerAPI.getCustomers();
        setAllCustomers(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

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

    // Tier filter
    if (tierFilter !== 'All') {
      filtered = filtered.filter((customer) => customer.tier === tierFilter);
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

    // Source filter
    if (sourceFilter !== 'All') {
      const sourceMap = {
        'QR in store': 'qr_store',
        'Instagram': 'instagram',
        'TikTok': 'tiktok',
        'Facebook': 'facebook',
        'Website': 'website',
        'Referral': 'friend',
        'Other': 'other',
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
      'tiktok': { emoji: '🎵', label: 'TikTok', bg: '#E0F7F4' },
      'facebook': { emoji: '👥', label: 'Facebook', bg: '#F3EFFF' },
      'website': { emoji: '🌐', label: 'Website', bg: '#FFFBEB' },
      'friend': { emoji: '💬', label: 'Referral', bg: '#E7F8F0' },
      'other': { emoji: '—', label: 'Other', bg: '#F3F3F2' },
    };
    return badges[source] || badges['other'];
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
    <div
      className="min-h-screen p-8"
      style={{ backgroundColor: '#FDFBF7' }}
    >
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-4xl font-semibold mb-2"
            style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}
          >
            Customers
          </h1>
          <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>
            Manage and view your customer database
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/dashboard/map'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: '#B85C38',
              color: '#FDFBF7',
              fontFamily: 'Manrope',
            }}
          >
            <Map size={18} />
            View on Map
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: '#57534E',
              color: '#FDFBF7',
              fontFamily: 'Manrope',
            }}
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

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
              <option>TikTok</option>
              <option>Facebook</option>
              <option>Website</option>
              <option>Referral</option>
              <option>Other</option>
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
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: getTierBadgeColor(customer.tier).bg,
                      color: getTierBadgeColor(customer.tier).text,
                      fontFamily: 'Manrope',
                    }}
                  >
                    {customer.tier}
                  </span>
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
