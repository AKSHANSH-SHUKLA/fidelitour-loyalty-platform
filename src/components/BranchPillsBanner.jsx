import React, { useEffect, useState } from 'react';
import { Sun } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import { useBranch } from '../contexts/BranchContext';

/**
 * BranchPillsBanner — the "DONNÉES EN TEMPS RÉEL · TOUTES VOS BRANCHES"
 * panel that sits at the top of the Analytics / Dashboard pages.
 *
 * Visual: warm-cream gradient surface, a dark icon chip on the left, a
 * two-line title ("eyebrow + subtitle"), and a row of branch pills on
 * the right. The first pill is always "Toutes les branches" (network-wide).
 *
 * Behaviour:
 *   - Pulls the branch list from the same context as BranchSelectorBar so
 *     picking a pill filters every chart on the page in lockstep.
 *   - Hides itself entirely if the tenant has only one branch (single-shop
 *     account doesn't need the noise).
 *   - Active pill carries the brand colour; idle pills carry a hairline.
 */
export default function BranchPillsBanner({ compact = false } = {}) {
  const { branchId, setBranchId, branches: ctxBranches, setBranches } = useBranch();
  const [localBranches, setLocalBranches] = useState(ctxBranches || []);

  // Branches may not be in context yet on the first paint (the Dashboard
  // populates it). Fetch directly as a fallback so the banner can render
  // independently of page-load order.
  useEffect(() => {
    if (ctxBranches && ctxBranches.length > 0) {
      setLocalBranches(ctxBranches);
      return;
    }
    let alive = true;
    ownerAPI.getBranches?.()
      .then((r) => {
        if (!alive) return;
        const list = Array.isArray(r?.data) ? r.data : (r?.data?.branches || []);
        setLocalBranches(list);
        if (typeof setBranches === 'function') setBranches(list);
      })
      .catch(() => { /* silent — banner will fall back to empty pills */ });
    return () => { alive = false; };
  }, [ctxBranches, setBranches]);

  // Single-branch tenants don't need a banner taking up vertical space.
  if (!Array.isArray(localBranches) || localBranches.length < 2) return null;

  const activeBranch = localBranches.find((b) => b.id === branchId);
  const isAll = !branchId;

  // Compact variant — single line, lives inside the top toolbar between
  // the search and the bell. No background, no subtitle, smaller chips.
  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: '#2D7A3E', boxShadow: '0 0 0 3px rgba(45,122,62,0.18)' }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.16em] shrink-0"
          style={{ color: '#9C4427', fontWeight: 700 }}
        >
          Live · {isAll ? 'Toutes les branches' : (activeBranch?.name || 'branche')}
        </span>
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => setBranchId('')}
            title="Toutes les branches"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-all"
            style={
              isAll
                ? { background: '#1F1B1A', color: '#FFFFFF', fontWeight: 500 }
                : { background: '#FFFFFF', color: '#1F1B1A', border: '1px solid #E2DAC4', fontWeight: 400 }
            }
          >
            Toutes
          </button>
          {localBranches.slice(0, 3).map((b) => {
            const isActive = branchId === b.id;
            const short = (b.name || b.id || '').split('-').pop().trim() || b.name || b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBranchId(b.id)}
                title={b.name || b.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-all max-w-[140px] truncate"
                style={
                  isActive
                    ? { background: '#9C4427', color: '#FFFFFF', fontWeight: 500 }
                    : { background: '#FFFFFF', color: '#1F1B1A', border: '1px solid #E2DAC4', fontWeight: 400 }
                }
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap"
      style={{
        background: 'linear-gradient(135deg, #F8E8E2 0%, #FCE3DC 60%, #F7D9CF 100%)',
        border: '1px solid #DD9F8B',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#1F1B1A', color: '#F4D8A8' }}
        >
          <Sun size={18} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase"
            style={{ color: '#9C4427', fontWeight: 600, letterSpacing: '0.16em' }}
          >
            Données en temps réel · {isAll ? 'toutes vos branches' : activeBranch?.name || 'branche'}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: '#4A4441' }}>
            Suivez vos performances, comprenez vos clients, optimisez vos campagnes.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* "All branches" master pill — dark when active, hairline when idle */}
        <button
          type="button"
          onClick={() => setBranchId('')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all"
          style={
            isAll
              ? { background: '#1F1B1A', color: '#FFFFFF', fontWeight: 500 }
              : { background: '#FFFFFF', color: '#1F1B1A', border: '1px solid #E2DAC4', fontWeight: 400 }
          }
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Toutes les branches
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Individual branch pills — terracotta when active, hairline when idle.
            Limit to the first 4 so the banner doesn't wrap on busy chains. */}
        {localBranches.slice(0, 4).map((b) => {
          const isActive = branchId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchId(b.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all"
              style={
                isActive
                  ? { background: '#9C4427', color: '#FFFFFF', fontWeight: 500 }
                  : { background: '#FFFFFF', color: '#1F1B1A', border: '1px solid #E2DAC4', fontWeight: 400 }
              }
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              {b.name || b.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
