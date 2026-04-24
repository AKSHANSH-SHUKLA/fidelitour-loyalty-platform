import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerAPI } from '../lib/api';
import {
  X, MapPin, Users, Euro, TrendingUp, TrendingDown, Award,
  Search, ChevronRight, ChevronDown, Building2, Activity,
  Compass, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Megaphone,
} from 'lucide-react';
import TierBadge from '../components/TierBadge';

// --------------------- Quadrant helpers ---------------------
// Given a set of customers (each with lat/lng) and a reference "city center"
// point (center_lat, center_lng), classify each customer into N / S / E / W
// based on which axis dominates the delta. Returns {N,S,E,W, total}.
function computeQuadrants(customers, center) {
  const out = { N: [], S: [], E: [], W: [] };
  for (const c of customers) {
    if (c.lat == null || c.lng == null) continue;
    const dLat = c.lat - center.lat;
    const dLng = c.lng - center.lng;
    if (Math.abs(dLat) < 1e-6 && Math.abs(dLng) < 1e-6) continue; // city-center dwellers
    if (Math.abs(dLat) >= Math.abs(dLng)) {
      if (dLat > 0) out.N.push(c); else out.S.push(c);
    } else {
      if (dLng > 0) out.E.push(c); else out.W.push(c);
    }
  }
  return out;
}

function centroid(customers) {
  let lat = 0, lng = 0, n = 0;
  for (const c of customers) {
    if (c.lat != null && c.lng != null) {
      lat += c.lat; lng += c.lng; n++;
    }
  }
  return n ? { lat: lat / n, lng: lng / n } : null;
}

const TIER_COLORS = { bronze: '#B85C38', silver: '#A0A0A0', gold: '#D4A574' };

const SOURCE_BADGES = {
  qr_store: { emoji: '📱', label: 'QR in store' },
  instagram: { emoji: '📸', label: 'Instagram' },
  facebook: { emoji: '👥', label: 'Facebook' },
  tiktok: { emoji: '🎵', label: 'TikTok' },
};

// --------------------- France bounding box for SVG mini-map ---------------------
const FRANCE_BOUNDS = { minLat: 41.3, maxLat: 51.2, minLng: -5.2, maxLng: 9.7 };
const SVG_W = 520, SVG_H = 580, PAD = 24;
const projectToSVG = (lat, lng) => {
  const { minLat, maxLat, minLng, maxLng } = FRANCE_BOUNDS;
  return {
    x: PAD + ((lng - minLng) / (maxLng - minLng)) * (SVG_W - 2 * PAD),
    y: PAD + ((maxLat - lat) / (maxLat - minLat)) * (SVG_H - 2 * PAD),
  };
};

// --------------------- Main page ---------------------
export default function CustomerMapPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);     // e.g. "37"
  const [expandedPostals, setExpandedPostals] = useState(new Set()); // postal codes whose customer list is open
  // Filters
  const [tierFilter, setTierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');   // 'all' | 'N' | 'S' | 'E' | 'W'
  const [minVisits, setMinVisits] = useState('');
  const [minAmountPaid, setMinAmountPaid] = useState('');
  const [search, setSearch] = useState('');
  // Branch selector
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');               // '' = all branches
  // Full details modal — set to a customer object to open
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Load branches once so the owner can narrow the map to a single location.
  useEffect(() => {
    (async () => {
      try {
        const r = await ownerAPI.getBranches();
        setBranches(r.data || []);
      } catch (_e) { /* single-branch tenant — fine */ }
    })();
  }, []);

  // Reload customers whenever the branch changes. Passing the branch to the
  // server keeps the payload honest for per-branch analytics.
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await ownerAPI.getCustomerMap(branchId ? { branch_id: branchId } : {});
        setCustomers(res.data || []);
      } catch (err) {
        setError(err?.message || 'Failed to load customer map');
      } finally {
        setLoading(false);
      }
    })();
  }, [branchId]);

  // Global centroid of all (visible) customers — used for N/S/E/W classification.
  const globalCenter = useMemo(() => {
    let lat = 0, lng = 0, n = 0;
    for (const c of customers) {
      if (c.lat != null && c.lng != null) { lat += c.lat; lng += c.lng; n++; }
    }
    return n ? { lat: lat / n, lng: lng / n } : { lat: 46.5, lng: 2.5 };
  }, [customers]);

  // Apply all filters *before* grouping so department/postal aggregates reflect them.
  const filteredAll = useMemo(() => {
    const cityQ = (cityFilter || '').trim().toLowerCase();
    const minV = Number(minVisits) || 0;
    const minP = Number(minAmountPaid) || 0;
    return customers.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (sourceFilter !== 'all' && c.acquisition_source !== sourceFilter) return false;
      if (cityQ) {
        const cityHit = (c.city || '').toLowerCase().includes(cityQ) ||
                        (c.department_name || '').toLowerCase().includes(cityQ);
        if (!cityHit) return false;
      }
      if (minV > 0 && (c.total_visits || 0) < minV) return false;
      if (minP > 0 && (c.total_amount_paid || 0) < minP) return false;
      if (regionFilter !== 'all' && c.lat != null && c.lng != null) {
        const dLat = c.lat - globalCenter.lat;
        const dLng = c.lng - globalCenter.lng;
        let reg;
        if (Math.abs(dLat) >= Math.abs(dLng)) reg = dLat > 0 ? 'N' : 'S';
        else reg = dLng > 0 ? 'E' : 'W';
        if (reg !== regionFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hit =
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.postal_code || '').includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [customers, tierFilter, sourceFilter, cityFilter, regionFilter, minVisits, minAmountPaid, search, globalCenter]);

  // Clear all filters in one click — handy for the send-campaign flow.
  const resetFilters = () => {
    setTierFilter('all');
    setSourceFilter('all');
    setCityFilter('');
    setRegionFilter('all');
    setMinVisits('');
    setMinAmountPaid('');
    setSearch('');
    setSelectedDept(null);
    setExpandedPostals(new Set());
  };

  // Hand off a list of customers to the CampaignsPage composer via sessionStorage.
  // Works for both the "send to filtered group" button and the per-customer
  // "Send campaign" button inside the details modal — caller picks the list.
  const handoffToCampaigns = (list, { skipConfirm = false, suggestedName, suggestedMessage } = {}) => {
    if (!list || list.length === 0) {
      alert('No customers to target.');
      return;
    }
    if (!skipConfirm) {
      const hasFilter =
        tierFilter !== 'all' || sourceFilter !== 'all' || cityFilter || regionFilter !== 'all' ||
        minVisits || minAmountPaid || search || selectedDept || branchId;
      const label = list.length === 1
        ? `Send a personal campaign to ${list[0].name || 'this customer'}?`
        : (hasFilter
            ? `Send campaign to ${list.length} filtered customer(s)?`
            : `No filters are active — this will target ALL ${list.length} customers. Continue?`);
      if (!window.confirm(label)) return;
    }
    const handoff = {
      customer_ids: list.map((c) => c.id),
      suggested_name: suggestedName || (list.length === 1
        ? `Un mot pour vous, ${(list[0].name || '').split(' ')[0] || '{first_name}'}`
        : 'Ciblage carte clients'),
      suggested_message: suggestedMessage || 'Bonjour {first_name}, une attention particulière vous attend chez {business_name} — à très vite !',
      source: 'push',
    };
    try {
      sessionStorage.setItem('campaignHandoff', JSON.stringify(handoff));
    } catch (_e) { /* private browsing — still navigate */ }
    navigate('/dashboard/campaigns');
  };

  const sendCampaignToFiltered = () => handoffToCampaigns(filteredAll);
  const sendCampaignToCustomer = (cust) => handoffToCampaigns([cust], { skipConfirm: false });

  // ---------- Group customers by department ----------
  const deptMap = useMemo(() => {
    const m = {};
    for (const c of filteredAll) {
      const code = c.department_code || '00';
      if (!m[code]) {
        m[code] = {
          code,
          name: c.department_name || 'Inconnu',
          lat: c.lat, lng: c.lng,
          customers: [],
          revenue: 0,
          visits: 0,
          tierDist: { bronze: 0, silver: 0, gold: 0 },
          postalGroups: {}, // postal_code -> { code, customers[], revenue, visits }
        };
      }
      m[code].customers.push(c);
      m[code].revenue += c.total_amount_paid || 0;
      m[code].visits += c.total_visits || 0;
      if (m[code].tierDist[c.tier] !== undefined) m[code].tierDist[c.tier] += 1;
      const p = c.postal_code || '00000';
      if (!m[code].postalGroups[p]) {
        m[code].postalGroups[p] = { code: p, customers: [], revenue: 0, visits: 0 };
      }
      m[code].postalGroups[p].customers.push(c);
      m[code].postalGroups[p].revenue += c.total_amount_paid || 0;
      m[code].postalGroups[p].visits += c.total_visits || 0;
    }
    return m;
  }, [filteredAll]);

  const deptList = useMemo(
    () => Object.values(deptMap).sort((a, b) => b.customers.length - a.customers.length),
    [deptMap]
  );

  const strongest = deptList[0];
  const weakest = deptList[deptList.length - 1];
  const totalRevenue = filteredAll.reduce((s, c) => s + (c.total_amount_paid || 0), 0);
  const totalVisits = filteredAll.reduce((s, c) => s + (c.total_visits || 0), 0);

  const activeDept = selectedDept ? deptMap[selectedDept] : null;
  const postalList = activeDept
    ? Object.values(activeDept.postalGroups).sort((a, b) => b.customers.length - a.customers.length)
    : [];

  const togglePostal = (p) => {
    setExpandedPostals((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  if (loading) {
    return <div className="p-8 min-h-screen bg-[#FDFBF7] text-[#57534E]">Loading customer map…</div>;
  }
  if (error) {
    return <div className="p-8 min-h-screen bg-[#FDFBF7] text-[#B85C38]">Error: {error}</div>;
  }

  return (
    <div className="p-8 bg-[#FDFBF7] min-h-screen space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="text-[#B85C38]" size={28} />
          <h1 className="text-4xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Customer Map
          </h1>
        </div>
        <p className="text-[#57534E] max-w-3xl">
          Your customer base by French <strong>département</strong>. Click a département to see
          customers grouped by postal code, with revenue, visits and top spenders per area.
        </p>
      </div>

      {/* Overview stat pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill icon={Users} label="Customers" value={filteredAll.length.toLocaleString()} />
        <StatPill icon={Euro} label="Total Revenue" value={`€${Math.round(totalRevenue).toLocaleString()}`} />
        <StatPill icon={Activity} label="Total Visits" value={totalVisits.toLocaleString()} />
        <StatPill icon={Building2} label="Départements Covered" value={deptList.length} />
      </div>

      {/* Filters row */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 space-y-3">
        {/* Row 1 — branch selector (if multi-branch) + search + send-campaign CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {branches.length > 1 && (
            <div className="flex items-center gap-2 bg-[#F3EFE7] border border-[#E7E5E4] rounded-lg px-3 py-2">
              <Building2 size={14} className="text-[#B85C38]" />
              <label className="text-xs font-bold text-[#57534E] uppercase tracking-wider">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="text-sm bg-transparent outline-none"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.id}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <Search size={16} className="text-[#8B8680]" />
            <input
              type="text"
              placeholder="Search customer name, email or postal code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded text-sm outline-none focus:border-[#B85C38]"
            />
          </div>
          <button
            onClick={sendCampaignToFiltered}
            disabled={filteredAll.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-40 transition"
            style={{ backgroundColor: '#B85C38' }}
            title="Send a campaign to the customers currently shown"
          >
            <Megaphone size={16} />
            Send campaign to {filteredAll.length}
          </button>
        </div>

        {/* Row 2 — tier / source / city / region / min visits / min paid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs mb-1 text-[#57534E]">Tier</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#E7E5E4] text-sm"
            >
              <option value="all">All tiers</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="vip">VIP</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-[#57534E]">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#E7E5E4] text-sm"
            >
              <option value="all">All sources</option>
              {Object.entries(SOURCE_BADGES).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-[#57534E]">City / département</label>
            <input
              type="text"
              placeholder="Paris, Lyon, Tours…"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#E7E5E4] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-[#57534E]">Region (vs. center)</label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#E7E5E4] text-sm"
            >
              <option value="all">All France</option>
              <option value="N">⬆ North</option>
              <option value="S">⬇ South</option>
              <option value="E">➡ East</option>
              <option value="W">⬅ West</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-[#57534E]">Min visits</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={minVisits}
              onChange={(e) => setMinVisits(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#E7E5E4] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-[#57534E]">Min amount paid (€)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={minAmountPaid}
              onChange={(e) => setMinAmountPaid(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#E7E5E4] text-sm"
            />
          </div>
        </div>

        {/* Row 3 — active filter summary + clear */}
        {(tierFilter !== 'all' || sourceFilter !== 'all' || cityFilter || regionFilter !== 'all' ||
          minVisits || minAmountPaid || search || selectedDept) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#57534E]">
            <span className="font-semibold">Showing {filteredAll.length} customer{filteredAll.length === 1 ? '' : 's'}:</span>
            {tierFilter !== 'all' && <Chip>Tier: {tierFilter}</Chip>}
            {sourceFilter !== 'all' && <Chip>Source: {SOURCE_BADGES[sourceFilter]?.label || sourceFilter}</Chip>}
            {cityFilter && <Chip>City: {cityFilter}</Chip>}
            {regionFilter !== 'all' && <Chip>Region: {regionFilter}</Chip>}
            {Number(minVisits) > 0 && <Chip>Min visits: {minVisits}</Chip>}
            {Number(minAmountPaid) > 0 && <Chip>Min paid: €{minAmountPaid}</Chip>}
            {search && <Chip>"{search}"</Chip>}
            {selectedDept && <Chip>Dept {selectedDept}</Chip>}
            <button onClick={resetFilters} className="ml-2 px-2 py-1 rounded border border-[#E7E5E4] hover:bg-[#FEF2F0]">
              <X size={12} className="inline -mt-0.5" /> Clear all
            </button>
          </div>
        )}
      </div>

      {/* Smart signals: strongest + weakest */}
      {!activeDept && deptList.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strongest && (
            <SignalCard
              tone="success"
              icon={TrendingUp}
              title={`Strongest: ${strongest.name} (${strongest.code})`}
              detail={`${strongest.customers.length} customers · €${Math.round(strongest.revenue).toLocaleString()} revenue`}
              action={() => setSelectedDept(strongest.code)}
            />
          )}
          {weakest && weakest.code !== strongest?.code && (
            <SignalCard
              tone="warning"
              icon={TrendingDown}
              title={`Quietest: ${weakest.name} (${weakest.code})`}
              detail={`Only ${weakest.customers.length} customers here. Consider a local Instagram or Facebook push.`}
              action={() => setSelectedDept(weakest.code)}
            />
          )}
        </div>
      )}

      {/* Body: two columns. Left = départements list + mini-map. Right = detail panel. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Départements list (takes 2/5) */}
        <div className="lg:col-span-2 bg-white border border-[#E7E5E4] rounded-xl p-5 min-h-[500px]">
          <h2 className="text-xl font-semibold mb-3 text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Départements {activeDept && <span className="text-sm font-normal text-[#8B8680]">({deptList.length})</span>}
          </h2>
          <p className="text-xs text-[#8B8680] mb-4">
            Click a département to drill into customers by postal code.
          </p>
          <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
            {deptList.length === 0 && (
              <p className="text-sm text-[#8B8680] italic">No customers match the current filters.</p>
            )}
            {deptList.map((d) => {
              const isActive = selectedDept === d.code;
              const pct = filteredAll.length
                ? Math.round((d.customers.length / filteredAll.length) * 100)
                : 0;
              return (
                <button
                  key={d.code}
                  onClick={() => {
                    setSelectedDept(isActive ? null : d.code);
                    setExpandedPostals(new Set());
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition flex items-center justify-between ${
                    isActive
                      ? 'bg-[#B85C38] text-white'
                      : 'bg-[#F3EFE7] text-[#1C1917] hover:bg-[#E7E5E4]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      isActive ? 'bg-white/20' : 'bg-white'
                    }`}>
                      {d.code}
                    </span>
                    <div>
                      <div className="font-semibold text-sm">{d.name}</div>
                      <div className={`text-xs ${isActive ? 'text-white/80' : 'text-[#8B8680]'}`}>
                        {d.customers.length} customers · €{Math.round(d.revenue).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-[#57534E]'}`}>
                      {pct}%
                    </span>
                    <ChevronRight size={16} className={isActive ? 'text-white' : 'text-[#8B8680]'} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right detail panel (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          {activeDept ? (
            <DepartmentDetail
              dept={activeDept}
              postalList={postalList}
              expandedPostals={expandedPostals}
              togglePostal={togglePostal}
              onSelectCustomer={setSelectedCustomer}
              onSendCampaign={(list) => handoffToCampaigns(list, {
                suggestedName: `Offre pour ${activeDept.name}`,
                suggestedMessage: `Bonjour {first_name}, une attention spéciale pour nos clients de ${activeDept.name} chez {business_name}. À très vite !`,
              })}
            />
          ) : (
            <>
              {/* Mini France map (decorative) */}
              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <h3 className="text-xl font-semibold mb-2 text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                  At a glance
                </h3>
                <p className="text-xs text-[#8B8680] mb-4">
                  Bubble size = customer count in that département. Click a département on the left list to drill in.
                </p>
                <FranceMiniMap deptList={deptList} selectedDept={selectedDept} onSelect={setSelectedDept} />
              </div>

              {/* Top 5 customers platform-wide */}
              <TopCustomersCard customers={filteredAll} onSelect={setSelectedCustomer} />
            </>
          )}
        </div>
      </div>

      {/* Full customer details modal */}
      {selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onSendCampaign={sendCampaignToCustomer}
        />
      )}
    </div>
  );
}

// --------------------- Subcomponents ---------------------

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1 text-[#57534E]">
        <Icon size={14} />
        <span className="text-xs uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#1C1917]">{value}</p>
    </div>
  );
}

function SignalCard({ tone, icon: Icon, title, detail, action }) {
  const styles = tone === 'success'
    ? 'bg-green-50 border-green-200 text-green-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';
  return (
    <div className={`p-4 rounded-xl border ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon size={20} />
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm opacity-80 mt-0.5">{detail}</p>
          {action && (
            <button
              onClick={action}
              className="text-xs font-semibold underline mt-2"
            >
              Open details →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentDetail({ dept, postalList, expandedPostals, togglePostal, onSelectCustomer, onSendCampaign }) {
  // Defensive no-ops so callers that don't pass these props still work.
  const selectCustomer = onSelectCustomer || (() => {});
  const sendCampaign = onSendCampaign || (() => {});
  const topSpenders = [...dept.customers]
    .sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0))
    .slice(0, 5);
  const avgSpend = dept.customers.length
    ? dept.revenue / dept.customers.length
    : 0;
  const avgVisits = dept.customers.length
    ? dept.visits / dept.customers.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded bg-[#B85C38] text-white font-bold text-sm">
              {dept.code}
            </span>
            <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              {dept.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => sendCampaign(dept.customers)}
            disabled={dept.customers.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: '#B85C38' }}
            title={`Send a campaign to all ${dept.customers.length} customer(s) in ${dept.name}`}
          >
            <Megaphone size={14} /> Send to these {dept.customers.length}
          </button>
        </div>
        <p className="text-sm text-[#8B8680] mb-4">
          {dept.customers.length} customer{dept.customers.length !== 1 ? 's' : ''}
          {' · '}
          {Object.keys(dept.postalGroups).length} postal code{Object.keys(dept.postalGroups).length !== 1 ? 's' : ''}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Customers" value={dept.customers.length} />
          <MiniStat label="Revenue" value={`€${Math.round(dept.revenue).toLocaleString()}`} />
          <MiniStat label="Avg spend" value={`€${avgSpend.toFixed(0)}`} />
          <MiniStat label="Avg visits" value={avgVisits.toFixed(1)} />
        </div>

        {/* Tier mix */}
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-[#57534E] mb-2">Tier mix</p>
          <div className="flex gap-2">
            {['gold', 'silver', 'bronze'].map((t) => {
              const n = dept.tierDist[t] || 0;
              const pct = dept.customers.length ? Math.round((n / dept.customers.length) * 100) : 0;
              return (
                <div
                  key={t}
                  className="flex-1 p-2 rounded text-center"
                  style={{ backgroundColor: TIER_COLORS[t] + '25' }}
                >
                  <div className="text-sm font-bold text-[#1C1917]">{n}</div>
                  <div className="text-xs text-[#57534E] capitalize">{t} ({pct}%)</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compass breakdown — where the département's customers are, geographically */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl">
        <div className="p-5 pb-0">
          <h3 className="text-xl font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Customer regions within {dept.name}
          </h3>
          <p className="text-xs text-[#8B8680]">
            Quickly see whether most of your {dept.code} customers live to the north, south, east or west of the département's center.
          </p>
        </div>
        <QuadrantBreakdown customers={dept.customers} label={dept.name} />
      </div>

      {/* Top spenders in department */}
      {topSpenders.length > 0 && (
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} className="text-[#B85C38]" />
            <h3 className="text-xl font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              Top spenders in {dept.name}
            </h3>
          </div>
          <div className="space-y-2">
            {topSpenders.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCustomer(c)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#F3EFE7] hover:bg-[#E7E5E4] transition text-left"
                title="Click to view full customer details"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[#B85C38] w-6">#{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1C1917]">{c.name}</span>
                      <TierBadge tier={c.tier} size="xs" />
                    </div>
                    <p className="text-xs text-[#8B8680]">
                      {c.postal_code} · {c.total_visits} visits
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1C1917]">€{(c.total_amount_paid || 0).toFixed(0)}</p>
                  <p className="text-xs text-[#8B8680]">spent</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Postal-code segmentation */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-xl font-semibold mb-1 text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
          Customers by postal code
        </h3>
        <p className="text-xs text-[#8B8680] mb-4">
          Each postal code (code postal) is one block or neighbourhood. Click to see the full list.
        </p>
        <div className="space-y-2">
          {postalList.map((p) => {
            const expanded = expandedPostals.has(p.code);
            const pct = dept.customers.length
              ? Math.round((p.customers.length / dept.customers.length) * 100)
              : 0;
            return (
              <div key={p.code} className="border border-[#E7E5E4] rounded-lg overflow-hidden">
                <button
                  onClick={() => togglePostal(p.code)}
                  className="w-full flex items-center justify-between p-3 bg-[#FDFBF7] hover:bg-[#F3EFE7] transition"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="font-bold text-[#1C1917]">{p.code}</span>
                    <span className="text-sm text-[#57534E]">
                      {p.customers.length} customer{p.customers.length !== 1 ? 's' : ''}
                      {' · '}
                      €{Math.round(p.revenue).toLocaleString()}
                      {' · '}
                      {p.visits} visit{p.visits !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#B85C38]">{pct}%</span>
                </button>
                {expanded && (
                  <>
                    <div className="px-3 py-2 bg-[#FDFBF7] border-t border-[#E7E5E4] flex items-center justify-between">
                      <p className="text-xs text-[#8B8680]">
                        Click any customer for full details, or message this postal-code cohort.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); sendCampaign(p.customers); }}
                        className="px-2.5 py-1 rounded text-xs font-bold text-white flex items-center gap-1.5"
                        style={{ backgroundColor: '#B85C38' }}
                        title={`Send a campaign to all customers in ${p.code}`}
                      >
                        <Megaphone size={12} /> Send to {p.customers.length}
                      </button>
                    </div>
                    <QuadrantBreakdown customers={p.customers} label={p.code} onSelectCustomer={selectCustomer} />
                    <div className="divide-y divide-[#E7E5E4]">
                      {p.customers
                        .sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0))
                        .map((c) => {
                          const src = SOURCE_BADGES[c.acquisition_source];
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className="w-full p-3 flex items-center justify-between text-sm hover:bg-[#F3EFE7] transition text-left"
                              title="Click to view full customer details"
                            >
                              <div className="flex items-center gap-3">
                                <TierBadge tier={c.tier} size="xs" />
                                <div>
                                  <p className="font-medium text-[#1C1917]">{c.name}</p>
                                  <p className="text-xs text-[#8B8680]">{c.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                {src && (
                                  <span className="text-xs text-[#57534E]" title={src.label}>
                                    {src.emoji}
                                  </span>
                                )}
                                <div className="text-right">
                                  <p className="font-semibold text-[#1C1917]">€{(c.total_amount_paid || 0).toFixed(0)}</p>
                                  <p className="text-xs text-[#8B8680]">{c.total_visits} visits</p>
                                </div>
                                <ChevronRight size={14} className="text-[#B85C38]" />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Shows "where do this city's customers live relative to the city center" as
// N / S / E / W counts. Clicking a quadrant reveals the list of customers
// in that direction. Center is the centroid of the city's customer lat/lng.
function QuadrantBreakdown({ customers, label, onSelectCustomer }) {
  const [active, setActive] = useState(null); // 'N' | 'S' | 'E' | 'W'
  const center = useMemo(() => centroid(customers), [customers]);
  const quads = useMemo(
    () => (center ? computeQuadrants(customers, center) : { N: [], S: [], E: [], W: [] }),
    [customers, center]
  );

  if (!center) {
    return (
      <div className="p-3 text-xs text-[#8B8680] italic">
        We don't have enough geolocation data to map compass directions for {label}.
      </div>
    );
  }

  const total = quads.N.length + quads.S.length + quads.E.length + quads.W.length;
  const tiles = [
    { key: 'N', label: 'North', icon: ArrowUp, color: '#4A5D23' },
    { key: 'E', label: 'East',  icon: ArrowRight, color: '#5B8DEF' },
    { key: 'S', label: 'South', icon: ArrowDown, color: '#B85C38' },
    { key: 'W', label: 'West',  icon: ArrowLeft, color: '#7B3F00' },
  ];

  const activeList = active ? quads[active] : [];

  return (
    <div className="p-3 border-t border-[#E7E5E4] bg-[#FDFBF7]">
      <div className="flex items-center gap-2 mb-2">
        <Compass size={14} className="text-[#B85C38]" />
        <p className="text-xs uppercase tracking-wide font-semibold text-[#57534E]">
          Where customers live (from {label}'s center)
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {tiles.map((t) => {
          const count = quads[t.key].length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(isActive ? null : t.key)}
              className={`p-3 rounded-lg border text-left transition ${
                isActive
                  ? 'bg-[#B85C38] text-white border-[#B85C38]'
                  : 'bg-white border-[#E7E5E4] hover:border-[#B85C38]'
              }`}
              style={isActive ? {} : { borderLeft: `4px solid ${t.color}` }}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-[#57534E]'}`}>{t.label}</span>
                <Icon size={14} className={isActive ? 'text-white' : ''} style={isActive ? {} : { color: t.color }} />
              </div>
              <div className={`text-2xl font-bold mt-1 ${isActive ? 'text-white' : 'text-[#1C1917]'}`}>{count}</div>
              <div className={`text-[11px] ${isActive ? 'text-white/80' : 'text-[#8B8680]'}`}>{pct}%</div>
            </button>
          );
        })}
      </div>
      {active && activeList.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] text-[#8B8680] mb-1">
            {activeList.length} customer{activeList.length !== 1 ? 's' : ''} in the {active === 'N' ? 'north' : active === 'S' ? 'south' : active === 'E' ? 'east' : 'west'} of {label}
          </p>
          <div className="max-h-56 overflow-y-auto divide-y divide-[#E7E5E4] border border-[#E7E5E4] rounded-lg bg-white">
            {activeList
              .sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0))
              .slice(0, 50)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCustomer && onSelectCustomer(c)}
                  className="w-full p-2.5 flex items-center justify-between text-sm hover:bg-[#F3EFE7] transition text-left"
                  title="Click to view full customer details"
                >
                  <div className="flex items-center gap-2">
                    <TierBadge tier={c.tier} size="xs" />
                    <div>
                      <p className="font-medium text-[#1C1917]">{c.name}</p>
                      <p className="text-[11px] text-[#8B8680]">{c.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1C1917]">€{(c.total_amount_paid || 0).toFixed(0)}</p>
                    <p className="text-[11px] text-[#8B8680]">{c.total_visits} visits</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
      <p className="text-[10px] uppercase tracking-wide text-[#57534E] font-semibold">{label}</p>
      <p className="text-lg font-bold text-[#1C1917]">{value}</p>
    </div>
  );
}

function TopCustomersCard({ customers, onSelect }) {
  const top = [...customers]
    .sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0))
    .slice(0, 5);
  if (top.length === 0) return null;
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Award size={18} className="text-[#B85C38]" />
        <h3 className="text-xl font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
          Your top 5 customers
        </h3>
      </div>
      <div className="space-y-2">
        {top.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect && onSelect(c)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-[#F3EFE7] hover:bg-[#E7E5E4] transition text-left"
            title="Click to view full customer details"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-[#B85C38] w-6">#{i + 1}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1C1917]">{c.name}</span>
                  <TierBadge tier={c.tier} size="xs" />
                </div>
                <p className="text-xs text-[#8B8680]">
                  {c.postal_code} · {c.department_name} · {c.total_visits} visits
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-[#1C1917]">€{(c.total_amount_paid || 0).toFixed(0)}</p>
              <p className="text-xs text-[#8B8680]">spent</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Full-detail customer modal shown when clicking any customer anywhere on this page.
// Covers all the fields the map API returns plus derived / humanised labels.
// `onSendCampaign` (optional) is called with the customer so the modal can offer
// a per-customer "send campaign" shortcut.
function CustomerDetailsModal({ customer, onClose, onSendCampaign }) {
  const c = customer || {};
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'history'
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null); // { visits, redemptions }
  const [historyError, setHistoryError] = useState(null);

  // Load visit history on first click of the "History" tab.
  useEffect(() => {
    if (activeTab !== 'history' || historyData || !c.id) return;
    let cancelled = false;
    (async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const res = await ownerAPI.customerVisitHistory(c.id, { limit: 60 });
        if (!cancelled) setHistoryData(res.data);
      } catch (e) {
        if (!cancelled) setHistoryError(e?.response?.data?.detail || e.message || 'Failed to load history');
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, c.id]);
  const fmt = (v) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleString(); } catch { return String(v); }
  };
  const fmtDate = (v) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString(); } catch { return String(v); }
  };
  const daysSinceLast = (() => {
    if (!c.last_visit_date) return null;
    const d = new Date(c.last_visit_date);
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  })();
  const src = SOURCE_BADGES[c.acquisition_source];
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose && onClose();
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-[#E7E5E4] flex items-start justify-between gap-3 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                {c.name || 'Customer'}
              </h2>
              <TierBadge tier={c.tier} />
            </div>
            <p className="text-xs text-[#8B8680] mt-1">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {onSendCampaign && (
              <button
                type="button"
                onClick={() => onSendCampaign(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition"
                style={{ backgroundColor: '#B85C38' }}
                title="Send a personalised campaign to just this customer"
              >
                <Megaphone size={14} />
                Send campaign
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#F3EFE7] transition"
              aria-label="Close"
            >
              <X size={20} className="text-[#57534E]" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[#E7E5E4] -mt-2">
            {[
              { key: 'details', label: 'Details' },
              { key: 'history', label: `Visit history${historyData?.visits ? ` (${historyData.visits.length})` : ''}` },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${
                  activeTab === t.key
                    ? 'border-[#B85C38] text-[#B85C38]'
                    : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'history' && (
            <div>
              {historyLoading && (
                <p className="text-sm text-[#8B8680]">Loading visits…</p>
              )}
              {historyError && (
                <p className="text-sm text-red-600">Error: {historyError}</p>
              )}
              {!historyLoading && !historyError && historyData && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat label="Total visits" value={historyData.total_visits ?? 0} />
                    <MiniStat label="Total paid" value={`€${(historyData.total_amount_paid || 0).toFixed(2)}`} />
                    <MiniStat label="Redemptions" value={historyData.redemptions?.length ?? 0} />
                  </div>
                  {(historyData.redemptions || []).length > 0 && (
                    <div className="p-3 rounded-lg bg-[#FEF9E7] border border-[#E3A869]/40">
                      <p className="text-xs font-semibold text-[#7B3F00] mb-2">🎁 Rewards redeemed</p>
                      <ul className="space-y-1 text-sm">
                        {historyData.redemptions.map((r, i) => (
                          <li key={r.id || i} className="flex justify-between">
                            <span>{r.reward_name || 'Reward'}{r.branch_id ? ` · ${r.branch_id}` : ''}</span>
                            <span className="text-[#8B8680]">{r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString() : '—'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="border border-[#E7E5E4] rounded-lg overflow-hidden">
                    <div className="bg-[#FDFBF7] px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[#8B8680] grid grid-cols-4 gap-2">
                      <span>Date & time</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Points</span>
                      <span className="text-right">Branch</span>
                    </div>
                    <div className="divide-y divide-[#E7E5E4] max-h-80 overflow-y-auto">
                      {(historyData.visits || []).length === 0 ? (
                        <p className="p-3 text-sm text-[#8B8680] italic">No visits recorded yet.</p>
                      ) : (
                        historyData.visits.map((v, i) => (
                          <div key={v.id || i} className="px-3 py-2 text-sm grid grid-cols-4 gap-2 items-center">
                            <span className="text-[#1C1917]">
                              {v.visit_time ? new Date(v.visit_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                            </span>
                            <span className="text-right text-[#1C1917]">
                              €{(v.amount_paid || 0).toFixed(2)}
                            </span>
                            <span className="text-right text-[#4A5D23] font-semibold">
                              +{v.points_awarded || 0}
                            </span>
                            <span className="text-right text-[#8B8680] text-xs">
                              {v.branch_id || '—'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Total spent" value={`€${(c.total_amount_paid || 0).toFixed(0)}`} />
            <MiniStat label="Visits" value={c.total_visits ?? 0} />
            <MiniStat label="Points" value={c.points ?? 0} />
            <MiniStat
              label="Avg ticket"
              value={c.total_visits > 0 ? `€${((c.total_amount_paid || 0) / c.total_visits).toFixed(2)}` : '—'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
              <p className="text-[10px] text-[#8B8680] uppercase tracking-wider font-semibold mb-2">Contact</p>
              <Row label="Name" value={c.name || '—'} />
              <Row label="Email" value={c.email || '—'} />
              <Row label="Phone" value={c.phone || '—'} />
              <Row label="Birthday" value={fmtDate(c.birthday)} />
            </div>
            <div className="p-4 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
              <p className="text-[10px] text-[#8B8680] uppercase tracking-wider font-semibold mb-2">Location</p>
              <Row label="Address" value={c.address || '—'} />
              <Row label="City" value={c.city || c.department_name || '—'} />
              <Row label="Postal code" value={c.postal_code || '—'} />
              <Row label="Département" value={c.department_code ? `${c.department_code} — ${c.department_name}` : (c.department_name || '—')} />
              <Row label="GPS" value={(c.lat != null && c.lng != null) ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}${c.has_real_gps ? '' : ' (approx.)'}` : '—'} />
            </div>
            <div className="p-4 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
              <p className="text-[10px] text-[#8B8680] uppercase tracking-wider font-semibold mb-2">Loyalty</p>
              <Row label="Tier" value={c.tier || '—'} />
              <Row label="Visits" value={c.total_visits ?? 0} />
              <Row label="Total paid" value={`€${(c.total_amount_paid || 0).toFixed(2)}`} />
              <Row label="Points" value={c.points ?? 0} />
              <Row label="Avg ticket" value={c.total_visits > 0 ? `€${((c.total_amount_paid || 0) / c.total_visits).toFixed(2)}` : '—'} />
            </div>
            <div className="p-4 rounded-lg bg-[#FDFBF7] border border-[#E7E5E4]">
              <p className="text-[10px] text-[#8B8680] uppercase tracking-wider font-semibold mb-2">Journey</p>
              <Row
                label="Acquired via"
                value={src ? `${src.emoji} ${src.label}` : (c.acquisition_source || '—')}
              />
              <Row label="Signed up" value={fmt(c.created_at)} />
              <Row label="Last visit" value={fmt(c.last_visit_date)} />
              <Row
                label="Days since last visit"
                value={daysSinceLast == null ? '—' : `${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'}`}
              />
              <Row label="Branch" value={c.branch_id || '—'} />
            </div>
          </div>

          {c.notes && (
            <div className="p-4 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
              <p className="text-[10px] text-[#8B8680] uppercase tracking-wider font-semibold mb-1">Notes</p>
              <p className="text-sm text-[#1C1917] whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-xs text-[#8B8680] min-w-[90px]">{label}</span>
      <span className="text-sm text-[#1C1917] text-right break-all">{value}</span>
    </div>
  );
}

// Small filter-chip used in the active-filters bar above the map.
function Chip({ children }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-[#F3EFE7] border border-[#E7E5E4] text-[11px]">
      {children}
    </span>
  );
}

function FranceMiniMap({ deptList, selectedDept, onSelect }) {
  const maxCount = Math.max(1, ...deptList.map((d) => d.customers.length));
  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto"
      style={{ maxHeight: 540, border: '1px solid #E7E5E4', background: '#F8FAFC', borderRadius: 8 }}
    >
      {/* Simplified France silhouette */}
      <path
        d="M 140 80 L 200 70 L 270 65 L 330 75 L 380 95 L 430 125 L 460 180 L 475 240 L 480 300 L 470 360 L 455 420 L 430 470 L 390 510 L 340 530 L 280 535 L 220 525 L 170 500 L 130 450 L 110 390 L 100 320 L 105 250 L 115 180 L 125 120 Z"
        fill="#E0F2FE"
        stroke="#B85C38"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <ellipse cx="470" cy="520" rx="18" ry="30" fill="#E0F2FE" stroke="#B85C38" strokeOpacity="0.4" strokeWidth="1" />

      {/* Department bubbles */}
      {deptList.map((d) => {
        if (!d.lat || !d.lng) return null;
        const { x, y } = projectToSVG(d.lat, d.lng);
        const r = 6 + (d.customers.length / maxCount) * 18;
        const isActive = selectedDept === d.code;
        return (
          <g
            key={d.code}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(isActive ? null : d.code)}
          >
            <circle
              cx={x}
              cy={y}
              r={r}
              fill="#B85C38"
              fillOpacity={isActive ? 0.7 : 0.28}
              stroke="#B85C38"
              strokeWidth={isActive ? 2 : 1.2}
            />
            <text
              x={x}
              y={y + 3}
              fontSize="9"
              textAnchor="middle"
              fill="#1C1917"
              fontWeight="700"
              style={{ pointerEvents: 'none' }}
            >
              {d.customers.length}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
