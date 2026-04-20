import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { X, MapPin } from 'lucide-react';

const POSTAL_CODE_CENTROIDS = {
  '37000': { x: 250, y: 200, name: 'Tours Centre' },
  '37100': { x: 450, y: 150, name: 'Saint-Cyr' },
  '37200': { x: 250, y: 400, name: 'Tours Sud' },
  '37300': { x: 450, y: 400, name: 'Tours Est' },
};

const TIER_COLORS = {
  bronze: '#B85C38',
  silver: '#A0A0A0',
  gold: '#D4A574',
};

const SOURCE_BADGES = {
  'qr_store': { emoji: '📱', label: 'QR in store' },
  'instagram': { emoji: '📸', label: 'Instagram' },
  'tiktok': { emoji: '🎵', label: 'TikTok' },
  'facebook': { emoji: '👥', label: 'Facebook' },
  'website': { emoji: '🌐', label: 'Website' },
  'friend': { emoji: '💬', label: 'Referral' },
  'other': { emoji: '—', label: 'Other' },
};

export default function CustomerMapPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPostalCode, setSelectedPostalCode] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await ownerAPI.post('/owner/customers/map', {});
        setCustomers(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
    if (sourceFilter !== 'all' && c.acquisition_source !== sourceFilter) return false;
    if (selectedPostalCode && c.postal_code !== selectedPostalCode) return false;
    return true;
  });

  // Calculate stats by postal code
  const getStatsByPostalCode = () => {
    const stats = {};
    const allFiltered = customers.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (sourceFilter !== 'all' && c.acquisition_source !== sourceFilter) return false;
      return true;
    });

    Object.keys(POSTAL_CODE_CENTROIDS).forEach((code) => {
      const custs = allFiltered.filter((c) => c.postal_code === code);
      const totalRevenue = custs.reduce((sum, c) => sum + (c.total_amount_paid || 0), 0);
      const tierDist = {
        bronze: custs.filter((c) => c.tier === 'bronze').length,
        silver: custs.filter((c) => c.tier === 'silver').length,
        gold: custs.filter((c) => c.tier === 'gold').length,
      };

      stats[code] = {
        count: custs.length,
        totalRevenue,
        avgPerCustomer: custs.length > 0 ? totalRevenue / custs.length : 0,
        tierDist,
      };
    });

    return stats;
  };

  const stats = getStatsByPostalCode();
  const weakestRegion = Object.entries(stats).reduce(
    (min, [code, s]) => (min === null || s.count < min.stats.count ? { code, stats: s } : min),
    null
  ) || { code: '37000', stats: { count: 0, totalRevenue: 0, avgPerCustomer: 0, tierDist: { bronze: 0, silver: 0, gold: 0 } } };

  if (loading) {
    return (
      <div
        className="p-8"
        style={{ backgroundColor: '#FDFBF7' }}
      >
        <p style={{ color: '#57534E' }}>Loading map...</p>
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
      <div className="mb-8">
        <h1
          className="text-4xl font-semibold mb-2"
          style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}
        >
          Tours Customer Map
        </h1>
        <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>
          Visualize customer distribution by region and acquisition source
        </p>
      </div>

      {/* Filters */}
      <div
        className="mb-6 p-4 rounded-lg border"
        style={{
          backgroundColor: '#F3EFE7',
          borderColor: '#E7E5E4',
        }}
      >
        <div className="flex gap-4 flex-wrap">
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Tier Filter
            </label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            >
              <option value="all">All Tiers</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>
          </div>
          <div>
            <label
              className="block text-sm mb-2"
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Source Filter
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: '#FDFBF7',
                borderColor: '#E7E5E4',
                color: '#1C1917',
                fontFamily: 'Manrope',
              }}
            >
              <option value="all">All Sources</option>
              <option value="qr_store">QR in store</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="website">Website</option>
              <option value="friend">Referral</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* SVG Map */}
        <div className="lg:col-span-3">
          <div
            className="rounded-lg border p-6"
            style={{
              backgroundColor: 'white',
              borderColor: '#E7E5E4',
            }}
          >
            <SVGMap
              customers={customers}
              filteredCustomers={filteredCustomers}
              stats={stats}
              selectedPostalCode={selectedPostalCode}
              onSelectPostalCode={setSelectedPostalCode}
              onSelectCustomer={setSelectedCustomer}
              tierFilter={tierFilter}
              sourceFilter={sourceFilter}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: 'white',
            borderColor: '#E7E5E4',
          }}
        >
          {selectedCustomer ? (
            <CustomerDetail
              customer={selectedCustomer}
              onClose={() => setSelectedCustomer(null)}
            />
          ) : selectedPostalCode ? (
            <RegionDetail
              postalCode={selectedPostalCode}
              stats={stats[selectedPostalCode]}
              filteredCustomers={filteredCustomers.filter((c) => c.postal_code === selectedPostalCode)}
              onClose={() => setSelectedPostalCode(null)}
            />
          ) : (
            <OverviewPanel
              stats={stats}
              weakestRegion={weakestRegion}
              filteredCustomers={filteredCustomers}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div
        className="rounded-lg border p-4"
        style={{
          backgroundColor: 'white',
          borderColor: '#E7E5E4',
        }}
      >
        <h3
          style={{
            color: '#1C1917',
            fontFamily: 'Manrope',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          Legend
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
                marginBottom: '8px',
                fontWeight: '600',
              }}
            >
              Tier Colors
            </p>
            <div className="flex flex-col gap-2">
              {Object.entries(TIER_COLORS).map(([tier, color]) => (
                <div key={tier} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    style={{
                      color: '#57534E',
                      fontFamily: 'Manrope',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
                marginBottom: '8px',
                fontWeight: '600',
              }}
            >
              Marker Size
            </p>
            <p
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '12px',
              }}
            >
              Larger = more spending
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SVGMap({
  customers,
  filteredCustomers,
  stats,
  selectedPostalCode,
  onSelectPostalCode,
  onSelectCustomer,
  tierFilter,
  sourceFilter,
}) {
  return (
    <svg width="100%" height="600" viewBox="0 0 800 600" style={{ border: '1px solid #E7E5E4' }}>
      {/* Background river curve (Loire) */}
      <defs>
        <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </linearGradient>
      </defs>

      {/* River path (diagonal curve) */}
      <path
        d="M 100 50 Q 300 200, 600 500"
        stroke="url(#riverGradient)"
        strokeWidth="40"
        fill="none"
        opacity="0.5"
      />

      {/* City name label */}
      <text
        x="400"
        y="30"
        fontSize="24"
        fontWeight="bold"
        textAnchor="middle"
        fill="#1C1917"
        fontFamily="Cormorant Garamond"
      >
        Tours, France
      </text>

      {/* Postal code regions with heatmap */}
      {Object.entries(POSTAL_CODE_CENTROIDS).map(([code, pos]) => {
        const regionStats = stats[code] || { count: 0, totalRevenue: 0, avgPerCustomer: 0, tierDist: { bronze: 0, silver: 0, gold: 0 } };
        const counts = Object.values(stats).map((s) => s.count);
        const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
        const density = maxCount > 0 ? regionStats.count / maxCount : 0;
        const backgroundColor = density > 0.7 ? '#B85C3825' : density > 0.4 ? '#B85C3815' : '#B85C380A';

        return (
          <g key={code}>
            {/* Region circle background */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r="80"
              fill={backgroundColor}
              stroke="#B85C38"
              strokeWidth="2"
              opacity="0.6"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectPostalCode(code === selectedPostalCode ? null : code)}
            />

            {/* Region label */}
            <text
              x={pos.x}
              y={pos.y - 10}
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
              fill="#1C1917"
              fontFamily="Manrope"
            >
              {code}
            </text>

            {/* Customer count */}
            <text
              x={pos.x}
              y={pos.y + 15}
              fontSize="12"
              textAnchor="middle"
              fill="#57534E"
              fontFamily="Manrope"
            >
              {regionStats.count} customers
            </text>

            {/* Customers in this region */}
            {filteredCustomers
              .filter((c) => c.postal_code === code)
              .map((customer, idx) => {
                // Scatter points in a circle around the centroid
                const angle = (idx / Math.max(1, filteredCustomers.filter((c) => c.postal_code === code).length)) * Math.PI * 2;
                const radius = 40 + (idx % 3) * 15;
                const cx = pos.x + Math.cos(angle) * radius;
                const cy = pos.y + Math.sin(angle) * radius;

                // Size based on spending
                const maxSpending = Math.max(...customers.map((c) => c.total_amount_paid || 0));
                const size = 4 + ((customer.total_amount_paid || 0) / Math.max(1, maxSpending)) * 6;

                return (
                  <circle
                    key={`${customer.id}-${idx}`}
                    cx={cx}
                    cy={cy}
                    r={size}
                    fill={TIER_COLORS[customer.tier]}
                    stroke="white"
                    strokeWidth="1"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCustomer(customer);
                    }}
                  >
                    <title>{customer.name}</title>
                  </circle>
                );
              })}
          </g>
        );
      })}
    </svg>
  );
}

function OverviewPanel({ stats, weakestRegion, filteredCustomers }) {
  return (
    <div>
      <h3
        style={{
          color: '#1C1917',
          fontFamily: 'Manrope',
          fontWeight: '600',
          marginBottom: '12px',
        }}
      >
        Overview
      </h3>

      <div className="space-y-4">
        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            Total Customers
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '20px',
              fontWeight: '600',
            }}
          >
            {filteredCustomers.length}
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#FFFBEB',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #FCD34D',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '11px',
              marginBottom: '8px',
              fontWeight: '600',
            }}
          >
            Weakest Region
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '4px',
            }}
          >
            {weakestRegion.code} ({weakestRegion.stats.count} customers)
          </p>
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '11px',
              marginBottom: '8px',
            }}
          >
            Consider running a targeted Instagram campaign or partnering with a local business for cross-promotion in this area.
          </p>
        </div>

        <div>
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '12px',
              marginBottom: '8px',
              fontWeight: '600',
            }}
          >
            Customers by Region
          </p>
          <div className="space-y-2">
            {Object.entries(stats).map(([code, s]) => (
              <div key={code} className="flex justify-between items-center text-xs">
                <span style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                  {code}
                </span>
                <span style={{ color: '#1C1917', fontFamily: 'Manrope', fontWeight: '600' }}>
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegionDetail({ postalCode, stats, filteredCustomers, onClose }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <h3
          style={{
            color: '#1C1917',
            fontFamily: 'Manrope',
            fontWeight: '600',
          }}
        >
          Region {postalCode}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            Total Customers
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '18px',
              fontWeight: '600',
            }}
          >
            {stats.count}
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            Total Revenue
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '18px',
              fontWeight: '600',
            }}
          >
            €{stats.totalRevenue.toFixed(2)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            Avg per Customer
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            €{stats.avgPerCustomer.toFixed(2)}
          </p>
        </div>

        <div>
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '11px',
              marginBottom: '6px',
              fontWeight: '600',
            }}
          >
            Tier Distribution
          </p>
          <div className="space-y-1">
            {Object.entries(stats.tierDist).map(([tier, count]) => (
              <div key={tier} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <span
                    style={{
                      color: '#57534E',
                      fontFamily: 'Manrope',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tier}
                  </span>
                </div>
                <span
                  style={{
                    color: '#1C1917',
                    fontFamily: 'Manrope',
                    fontWeight: '600',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerDetail({ customer, onClose }) {
  const badge = SOURCE_BADGES[customer.acquisition_source] || SOURCE_BADGES.other;

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <h3
          style={{
            color: '#1C1917',
            fontFamily: 'Manrope',
            fontWeight: '600',
          }}
        >
          {customer.name}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '11px',
              marginBottom: '4px',
            }}
          >
            POSTAL CODE
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            <MapPin size={14} className="inline mr-1" />
            {customer.postal_code}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            style={{
              backgroundColor: '#F3EFE7',
              padding: '12px',
              borderRadius: '8px',
            }}
          >
            <p
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '11px',
                marginBottom: '4px',
              }}
            >
              TIER
            </p>
            <p
              style={{
                color: TIER_COLORS[customer.tier],
                fontFamily: 'Manrope',
                fontSize: '14px',
                fontWeight: '600',
                textTransform: 'capitalize',
              }}
            >
              {customer.tier}
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#F3EFE7',
              padding: '12px',
              borderRadius: '8px',
            }}
          >
            <p
              style={{
                color: '#57534E',
                fontFamily: 'Manrope',
                fontSize: '11px',
                marginBottom: '4px',
              }}
            >
              VISITS
            </p>
            <p
              style={{
                color: '#1C1917',
                fontFamily: 'Manrope',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {customer.total_visits}
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '11px',
              marginBottom: '4px',
            }}
          >
            TOTAL SPENT
          </p>
          <p
            style={{
              color: '#B85C38',
              fontFamily: 'Manrope',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            €{customer.total_amount_paid.toFixed(2)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#F3EFE7',
            padding: '12px',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              color: '#57534E',
              fontFamily: 'Manrope',
              fontSize: '11px',
              marginBottom: '4px',
            }}
          >
            ACQUISITION SOURCE
          </p>
          <p
            style={{
              color: '#1C1917',
              fontFamily: 'Manrope',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {badge.emoji} {badge.label}
          </p>
        </div>
      </div>
    </div>
  );
}
