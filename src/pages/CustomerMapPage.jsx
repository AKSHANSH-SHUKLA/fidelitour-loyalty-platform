import React, { useState, useEffect, useMemo } from 'react';
import { ownerAPI } from '../lib/api';
import { X, MapPin, Navigation, TrendingDown, Users, Euro } from 'lucide-react';
import TierBadge from '../components/TierBadge';

const TIER_COLORS = {
  bronze: '#B85C38',
  silver: '#A0A0A0',
  gold: '#D4A574',
};

const SOURCE_BADGES = {
  qr_store: { emoji: '📱', label: 'QR in store' },
  instagram: { emoji: '📸', label: 'Instagram' },
  tiktok: { emoji: '🎵', label: 'TikTok' },
  facebook: { emoji: '👥', label: 'Facebook' },
  website: { emoji: '🌐', label: 'Website' },
  friend: { emoji: '💬', label: 'Referral' },
  other: { emoji: '—', label: 'Other' },
};

// France bounding box for lat/lng → SVG projection
const FRANCE_BOUNDS = {
  minLat: 41.3, // Corsica south
  maxLat: 51.2, // Dunkirk north
  minLng: -5.2, // Brittany west
  maxLng: 9.7, // Strasbourg / Nice east
};
const SVG_WIDTH = 800;
const SVG_HEIGHT = 900;
const PADDING = 40;

function projectToSVG(lat, lng) {
  const { minLat, maxLat, minLng, maxLng } = FRANCE_BOUNDS;
  const x = PADDING + ((lng - minLng) / (maxLng - minLng)) * (SVG_WIDTH - 2 * PADDING);
  const y = PADDING + ((maxLat - lat) / (maxLat - minLat)) * (SVG_HEIGHT - 2 * PADDING);
  return { x, y };
}

export default function CustomerMapPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await ownerAPI.getCustomerMap();
        setCustomers(res.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load customer map');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (sourceFilter !== 'all' && c.acquisition_source !== sourceFilter) return false;
      if (selectedDept && c.department_code !== selectedDept) return false;
      return true;
    });
  }, [customers, tierFilter, sourceFilter, selectedDept]);

  // Aggregate stats by department
  const deptStats = useMemo(() => {
    const pool = customers.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (sourceFilter !== 'all' && c.acquisition_source !== sourceFilter) return false;
      return true;
    });
    const map = {};
    for (const c of pool) {
      const key = c.department_code || 'unknown';
      if (!map[key]) {
        map[key] = {
          code: key,
          name: c.department_name || 'Unknown',
          count: 0,
          revenue: 0,
          visits: 0,
          lat: c.lat,
          lng: c.lng,
          tierDist: { bronze: 0, silver: 0, gold: 0 },
        };
      }
      map[key].count += 1;
      map[key].revenue += c.total_amount_paid || 0;
      map[key].visits += c.total_visits || 0;
      if (map[key].tierDist[c.tier] !== undefined) map[key].tierDist[c.tier] += 1;
    }
    return map;
  }, [customers, tierFilter, sourceFilter]);

  const weakestDept = useMemo(() => {
    const entries = Object.values(deptStats);
    if (entries.length === 0) return null;
    return entries.reduce((min, d) => (d.count < min.count ? d : min), entries[0]);
  }, [deptStats]);

  const strongestDept = useMemo(() => {
    const entries = Object.values(deptStats);
    if (entries.length === 0) return null;
    return entries.reduce((max, d) => (d.count > max.count ? d : max), entries[0]);
  }, [deptStats]);

  if (loading) {
    return (
      <div className="p-8" style={{ backgroundColor: '#FDFBF7' }}>
        <p style={{ color: '#57534E' }}>Loading France customer map…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" style={{ backgroundColor: '#FDFBF7' }}>
        <p style={{ color: '#B85C38', fontFamily: 'Manrope' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#FDFBF7' }}>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-4xl font-semibold mb-2"
          style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}
        >
          Customer Map — France
        </h1>
        <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>
          Visualize your customer base across French departments and regions.
        </p>
      </div>

      {/* Filters */}
      <div
        className="mb-6 p-4 rounded-lg border flex gap-4 flex-wrap items-end"
        style={{ backgroundColor: '#F3EFE7', borderColor: '#E7E5E4' }}
      >
        <div>
          <label className="block text-xs mb-1" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
            Tier
          </label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 rounded border text-sm outline-none"
            style={{ backgroundColor: '#FDFBF7', borderColor: '#E7E5E4', color: '#1C1917', fontFamily: 'Manrope' }}
          >
            <option value="all">All Tiers</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
            Acquisition Source
          </label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded border text-sm outline-none"
            style={{ backgroundColor: '#FDFBF7', borderColor: '#E7E5E4', color: '#1C1917', fontFamily: 'Manrope' }}
          >
            <option value="all">All Sources</option>
            {Object.entries(SOURCE_BADGES).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
        </div>
        {selectedDept && (
          <button
            onClick={() => setSelectedDept(null)}
            className="px-3 py-2 rounded border text-sm flex items-center gap-2"
            style={{ backgroundColor: '#FDFBF7', borderColor: '#B85C38', color: '#B85C38' }}
          >
            <X size={14} /> Clear department filter ({selectedDept})
          </button>
        )}
        <div className="ml-auto text-sm" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
          {filteredCustomers.length} of {customers.length} customers
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* SVG map */}
        <div className="lg:col-span-3">
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'white', borderColor: '#E7E5E4' }}
          >
            <FranceSVGMap
              customers={filteredCustomers}
              deptStats={deptStats}
              selectedDept={selectedDept}
              onSelectDept={setSelectedDept}
              onSelectCustomer={setSelectedCustomer}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'white', borderColor: '#E7E5E4' }}>
          {selectedCustomer ? (
            <CustomerDetail customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
          ) : selectedDept && deptStats[selectedDept] ? (
            <DepartmentDetail
              dept={deptStats[selectedDept]}
              customers={filteredCustomers.filter((c) => c.department_code === selectedDept)}
              onClose={() => setSelectedDept(null)}
              onSelectCustomer={setSelectedCustomer}
            />
          ) : (
            <OverviewPanel
              deptStats={deptStats}
              filteredCustomers={filteredCustomers}
              weakestDept={weakestDept}
              strongestDept={strongestDept}
              onSelectDept={setSelectedDept}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'white', borderColor: '#E7E5E4' }}>
        <h3 style={{ color: '#1C1917', fontFamily: 'Manrope', fontWeight: 600, marginBottom: '12px' }}>
          Legend
        </h3>
        <div className="grid grid-cols-3 gap-4 text-xs" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '6px' }}>Tier colors</p>
            {Object.entries(TIER_COLORS).map(([tier, color]) => (
              <div key={tier} className="flex items-center gap-2 mb-1">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ textTransform: 'capitalize' }}>{tier}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '6px' }}>Marker size</p>
            <p>Larger circle = higher total spend</p>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '6px' }}>Department bubbles</p>
            <p>Ring size = customer count. Click to drill down.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------- France SVG map component -------
function FranceSVGMap({ customers, deptStats, selectedDept, onSelectDept, onSelectCustomer }) {
  const maxCustomers = Math.max(1, ...customers.map((c) => c.total_amount_paid || 0));
  const deptCounts = Object.values(deptStats).map((d) => d.count);
  const maxDeptCount = Math.max(1, ...deptCounts);

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      height="auto"
      style={{ maxHeight: '720px', border: '1px solid #E7E5E4', backgroundColor: '#F8FAFC' }}
    >
      <defs>
        <radialGradient id="franceBg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#EFF6FF" />
          <stop offset="100%" stopColor="#E0F2FE" />
        </radialGradient>
      </defs>

      {/* Simplified France outline (approximation) */}
      <path
        d="M 200 120 L 280 100 L 380 90 L 470 100 L 540 130 L 620 180 L 680 260 L 710 340 L 720 430 L 700 520 L 680 600 L 640 680 L 580 740 L 490 780 L 400 790 L 320 780 L 240 750 L 180 700 L 140 620 L 120 540 L 110 440 L 120 360 L 140 280 L 170 200 Z"
        fill="url(#franceBg)"
        stroke="#B85C38"
        strokeWidth="2"
        strokeOpacity="0.5"
      />

      {/* Corsica island */}
      <ellipse cx="720" cy="770" rx="30" ry="50" fill="url(#franceBg)" stroke="#B85C38" strokeWidth="1.5" strokeOpacity="0.5" />
      <text x="720" y="775" fontSize="9" textAnchor="middle" fill="#57534E" fontFamily="Manrope">Corse</text>

      {/* Major city anchor labels */}
      {[
        { name: 'Paris', lat: 48.86, lng: 2.35 },
        { name: 'Lyon', lat: 45.76, lng: 4.84 },
        { name: 'Marseille', lat: 43.30, lng: 5.37 },
        { name: 'Toulouse', lat: 43.60, lng: 1.44 },
        { name: 'Bordeaux', lat: 44.84, lng: -0.58 },
        { name: 'Lille', lat: 50.63, lng: 3.06 },
        { name: 'Nantes', lat: 47.22, lng: -1.55 },
        { name: 'Strasbourg', lat: 48.57, lng: 7.75 },
        { name: 'Tours', lat: 47.39, lng: 0.69 },
        { name: 'Nice', lat: 43.71, lng: 7.26 },
      ].map((city) => {
        const { x, y } = projectToSVG(city.lat, city.lng);
        return (
          <g key={city.name}>
            <circle cx={x} cy={y} r="2" fill="#57534E" opacity="0.4" />
            <text x={x + 6} y={y + 3} fontSize="9" fill="#57534E" opacity="0.7" fontFamily="Manrope">
              {city.name}
            </text>
          </g>
        );
      })}

      {/* Department aggregated bubbles */}
      {Object.values(deptStats).map((dept) => {
        if (!dept.lat || !dept.lng) return null;
        const { x, y } = projectToSVG(dept.lat, dept.lng);
        const bubbleR = 10 + (dept.count / maxDeptCount) * 24;
        const isSelected = selectedDept === dept.code;
        return (
          <g key={dept.code} style={{ cursor: 'pointer' }} onClick={() => onSelectDept(isSelected ? null : dept.code)}>
            <circle
              cx={x}
              cy={y}
              r={bubbleR}
              fill="#B85C38"
              fillOpacity={isSelected ? 0.35 : 0.15}
              stroke="#B85C38"
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={x}
              y={y + 3}
              fontSize="11"
              textAnchor="middle"
              fill="#1C1917"
              fontWeight="600"
              fontFamily="Manrope"
              style={{ pointerEvents: 'none' }}
            >
              {dept.count}
            </text>
          </g>
        );
      })}

      {/* Individual customer markers */}
      {customers.map((c) => {
        if (!c.lat || !c.lng) return null;
        const { x, y } = projectToSVG(c.lat, c.lng);
        const size = 3 + ((c.total_amount_paid || 0) / maxCustomers) * 4;
        return (
          <circle
            key={c.id}
            cx={x}
            cy={y}
            r={size}
            fill={TIER_COLORS[c.tier] || TIER_COLORS.bronze}
            stroke="white"
            strokeWidth="0.5"
            fillOpacity="0.85"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCustomer(c);
            }}
          >
            <title>{c.name} — {c.postal_code}</title>
          </circle>
        );
      })}

      {/* Title */}
      <text x={SVG_WIDTH / 2} y={30} fontSize="20" fontWeight="600" textAnchor="middle" fill="#1C1917" fontFamily="Cormorant Garamond">
        France — Customer Distribution
      </text>
    </svg>
  );
}

// ------- Overview panel -------
function OverviewPanel({ deptStats, filteredCustomers, weakestDept, strongestDept, onSelectDept }) {
  const totalRevenue = filteredCustomers.reduce((sum, c) => sum + (c.total_amount_paid || 0), 0);
  const sortedDepts = Object.values(deptStats).sort((a, b) => b.count - a.count);

  return (
    <div>
      <h3 style={{ color: '#1C1917', fontFamily: 'Manrope', fontWeight: 600, marginBottom: '12px' }}>
        Overview
      </h3>

      <div
        style={{ backgroundColor: '#F3EFE7', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}
      >
        <div className="flex items-center gap-2 mb-1" style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '11px' }}>
          <Users size={12} /> <span>Total customers</span>
        </div>
        <p style={{ color: '#1C1917', fontFamily: 'Manrope', fontSize: '22px', fontWeight: 600 }}>
          {filteredCustomers.length}
        </p>
      </div>

      <div
        style={{ backgroundColor: '#F3EFE7', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}
      >
        <div className="flex items-center gap-2 mb-1" style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '11px' }}>
          <Euro size={12} /> <span>Total revenue</span>
        </div>
        <p style={{ color: '#1C1917', fontFamily: 'Manrope', fontSize: '22px', fontWeight: 600 }}>
          €{totalRevenue.toFixed(0)}
        </p>
      </div>

      {weakestDept && weakestDept.count > 0 && (
        <div
          style={{
            backgroundColor: '#FFFBEB',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #FCD34D',
            marginBottom: '12px',
          }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: '#92400E', fontFamily: 'Manrope', fontSize: '11px', fontWeight: 600 }}>
            <TrendingDown size={12} /> <span>Weakest department</span>
          </div>
          <p style={{ color: '#1C1917', fontFamily: 'Manrope', fontSize: '13px', fontWeight: 600 }}>
            {weakestDept.name} ({weakestDept.code}) — {weakestDept.count} customers
          </p>
          <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '10px', marginTop: '4px' }}>
            Consider a targeted Instagram or Facebook campaign here.
          </p>
        </div>
      )}

      {strongestDept && (
        <div style={{ backgroundColor: '#ECFDF5', padding: '12px', borderRadius: '8px', border: '1px solid #6EE7B7', marginBottom: '12px' }}>
          <p style={{ color: '#065F46', fontFamily: 'Manrope', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
            Strongest department
          </p>
          <p style={{ color: '#1C1917', fontFamily: 'Manrope', fontSize: '13px', fontWeight: 600 }}>
            {strongestDept.name} ({strongestDept.code}) — {strongestDept.count} customers
          </p>
        </div>
      )}

      <div>
        <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Top departments
        </p>
        <div className="space-y-1">
          {sortedDepts.slice(0, 10).map((d) => (
            <button
              key={d.code}
              onClick={() => onSelectDept(d.code)}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#F3EFE7] flex justify-between items-center"
              style={{ fontFamily: 'Manrope', fontSize: '12px' }}
            >
              <span style={{ color: '#1C1917' }}>{d.code} — {d.name}</span>
              <span style={{ color: '#B85C38', fontWeight: 600 }}>{d.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------- Department detail -------
function DepartmentDetail({ dept, customers, onClose, onSelectCustomer }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 style={{ color: '#1C1917', fontFamily: 'Manrope', fontWeight: 600 }}>
            {dept.name}
          </h3>
          <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '11px' }}>
            Department {dept.code}
          </p>
        </div>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div style={{ backgroundColor: '#F3EFE7', padding: '10px', borderRadius: '8px' }}>
          <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '10px' }}>Customers</p>
          <p style={{ color: '#1C1917', fontFamily: 'Manrope', fontSize: '18px', fontWeight: 600 }}>
            {dept.count}
          </p>
        </div>
        <div style={{ backgroundColor: '#F3EFE7', padding: '10px', borderRadius: '8px' }}>
          <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '10px' }}>Revenue</p>
          <p style={{ color: '#1C1917', fontFamily: 'Manrope', fontSize: '18px', fontWeight: 600 }}>
            €{dept.revenue.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
          Tier breakdown
        </p>
        <div className="flex gap-2">
          {Object.entries(dept.tierDist).map(([t, n]) => (
            <div key={t} className="flex-1 text-center py-2 rounded" style={{ backgroundColor: TIER_COLORS[t] + '33' }}>
              <p style={{ color: '#1C1917', fontSize: '14px', fontWeight: 600, fontFamily: 'Manrope' }}>{n}</p>
              <p style={{ color: '#57534E', fontSize: '10px', fontFamily: 'Manrope', textTransform: 'capitalize' }}>{t}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
          Customers in this department
        </p>
        <div className="space-y-1 max-h-60 overflow-auto">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCustomer(c)}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#F3EFE7] flex items-center justify-between"
              style={{ fontFamily: 'Manrope', fontSize: '12px' }}
            >
              <span style={{ color: '#1C1917' }}>{c.name}</span>
              <TierBadge tier={c.tier} size="xs" showLabel={false} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------- Individual customer detail -------
function CustomerDetail({ customer, onClose }) {
  const src = SOURCE_BADGES[customer.acquisition_source] || SOURCE_BADGES.other;
  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <h3 style={{ color: '#1C1917', fontFamily: 'Manrope', fontWeight: 600 }}>
          {customer.name}
        </h3>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      <div style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '12px' }}>
        <p className="mb-2">{customer.email}</p>
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={12} /> <span>{customer.postal_code} · {customer.department_name}</span>
        </div>
        <div className="mb-2"><TierBadge tier={customer.tier} size="sm" /></div>
        <div className="flex items-center gap-2 mb-2">
          <span>{src.emoji}</span> <span>{src.label}</span>
        </div>
        {customer.has_real_gps && (
          <div className="flex items-center gap-2 mb-2" style={{ color: '#065F46' }}>
            <Navigation size={12} /> <span>Real GPS captured</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div style={{ backgroundColor: '#F3EFE7', padding: '8px', borderRadius: '6px' }}>
          <p style={{ fontFamily: 'Manrope', fontSize: '10px', color: '#57534E' }}>Visits</p>
          <p style={{ fontFamily: 'Manrope', fontSize: '18px', fontWeight: 600, color: '#1C1917' }}>
            {customer.total_visits}
          </p>
        </div>
        <div style={{ backgroundColor: '#F3EFE7', padding: '8px', borderRadius: '6px' }}>
          <p style={{ fontFamily: 'Manrope', fontSize: '10px', color: '#57534E' }}>Total spent</p>
          <p style={{ fontFamily: 'Manrope', fontSize: '18px', fontWeight: 600, color: '#1C1917' }}>
            €{(customer.total_amount_paid || 0).toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
