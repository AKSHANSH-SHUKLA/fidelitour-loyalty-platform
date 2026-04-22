import React, { useState, useEffect, useMemo } from 'react';
import { ownerAPI } from '../lib/api';
import {
  X, MapPin, Users, Euro, TrendingUp, TrendingDown, Award,
  Search, ChevronRight, ChevronDown, Building2, Activity,
} from 'lucide-react';
import TierBadge from '../components/TierBadge';

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
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);     // e.g. "37"
  const [expandedPostals, setExpandedPostals] = useState(new Set()); // postal codes whose customer list is open
  const [tierFilter, setTierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await ownerAPI.getCustomerMap();
        setCustomers(res.data || []);
      } catch (err) {
        setError(err?.message || 'Failed to load customer map');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Apply tier / source / search filters *before* grouping
  const filteredAll = useMemo(() => {
    return customers.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (sourceFilter !== 'all' && c.acquisition_source !== sourceFilter) return false;
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
  }, [customers, tierFilter, sourceFilter, search]);

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
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-[#8B8680]" />
          <input
            type="text"
            placeholder="Search customer name, email or postal code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded text-sm outline-none focus:border-[#B85C38]"
          />
        </div>
        <div>
          <label className="block text-xs mb-1 text-[#57534E]">Tier</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 rounded border border-[#E7E5E4] text-sm"
          >
            <option value="all">All tiers</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1 text-[#57534E]">Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded border border-[#E7E5E4] text-sm"
          >
            <option value="all">All sources</option>
            {Object.entries(SOURCE_BADGES).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
        </div>
        {selectedDept && (
          <button
            onClick={() => { setSelectedDept(null); setExpandedPostals(new Set()); }}
            className="px-3 py-2 rounded border border-[#B85C38] text-[#B85C38] text-sm flex items-center gap-1 bg-white hover:bg-[#FEF2F0]"
          >
            <X size={14} /> Clear {selectedDept}
          </button>
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
              <TopCustomersCard customers={filteredAll} />
            </>
          )}
        </div>
      </div>
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

function DepartmentDetail({ dept, postalList, expandedPostals, togglePostal }) {
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
        <div className="flex items-center gap-3 mb-1">
          <span className="px-2 py-1 rounded bg-[#B85C38] text-white font-bold text-sm">
            {dept.code}
          </span>
          <h2 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            {dept.name}
          </h2>
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
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#F3EFE7]"
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
              </div>
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
                  <div className="divide-y divide-[#E7E5E4]">
                    {p.customers
                      .sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0))
                      .map((c) => {
                        const src = SOURCE_BADGES[c.acquisition_source];
                        return (
                          <div
                            key={c.id}
                            className="p-3 flex items-center justify-between text-sm"
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
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
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

function TopCustomersCard({ customers }) {
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
          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F3EFE7]">
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
          </div>
        ))}
      </div>
    </div>
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
