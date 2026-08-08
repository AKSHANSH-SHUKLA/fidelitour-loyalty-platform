/**
 * BranchSelectorBar — global branch picker that lives in the dashboard
 * top bar (visible on every page).
 *
 * Reads + writes to BranchContext, so picking a branch here automatically
 * refilters Analytics, Insights, Customers, Campaigns, Customer Map, etc.
 *
 * Renders:
 *   - "All branches" pill (active = no filter)
 *   - One pill per branch
 *   - A small "currently filtered" hint when a specific branch is picked
 *
 * If the tenant has only 1 branch, the bar hides itself (no useful pick).
 */
import React, { useEffect } from 'react';
import { Building2, Check, Globe } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { ownerAPI } from '../lib/api';

const BranchSelectorBar = () => {
  const { branchId, setBranchId, branches, setBranches } = useBranch();

  // Hydrate the branch list once. The dashboard does this too — safe to do
  // again because BranchContext.setBranches is idempotent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await ownerAPI.getBranches();
        if (!cancelled) setBranches(Array.isArray(r.data) ? r.data : []);
      } catch (_e) { /* ignore — most likely tenant has no branches feature */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!branches || branches.length < 2) {
    return null;        // single-branch tenant — nothing to switch between
  }

  const activeBranchName = branchId
    ? (branches.find((b) => b.id === branchId)?.name || 'Branch')
    : null;

  return (
    <div
      className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap"
      style={{
        background: branchId
          ? 'linear-gradient(135deg, #FCE3DC 0%, #FBE0E8 100%)'
          : 'linear-gradient(135deg, white 0%, #F5EFE5 100%)',
        border: `1.5px solid ${branchId ? '#B85C3866' : '#E9E5E0'}`,
        boxShadow: branchId ? '0 6px 18px -10px #B85C3866' : '0 2px 6px -2px rgba(28,25,23,0.06)',
      }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: branchId ? '#B85C38' : '#171412',
            color: branchId ? 'white' : '#E3A869',
          }}
        >
          {branchId ? <Building2 size={16} /> : <Globe size={16} />}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: branchId ? '#B85C38' : '#8D857D' }}>
            {branchId ? `Showing data for : ${activeBranchName}` : 'Showing data for : All branches'}
          </p>
          <p className="text-[10px]" style={{ color: '#57504A' }}>
            {branchId
              ? 'Every page is filtered to this branch. Click "All" to see the whole network.'
              : 'Pick a branch below to see only its customers, visits, campaigns and analytics.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 ml-auto">
        {/* "All branches" pill */}
        <button
          type="button"
          onClick={() => setBranchId(null)}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
          style={{
            background: branchId === null
              ? 'linear-gradient(135deg, #171412, #2A1C2E)'
              : 'white',
            color: branchId === null ? 'white' : '#3D2820',
            border: `1px solid ${branchId === null ? 'transparent' : '#E9E5E0'}`,
            boxShadow: branchId === null ? '0 4px 12px -4px rgba(28,25,23,0.4)' : 'none',
          }}
        >
          {branchId === null && <Check size={11} />}
          All branches
        </button>

        {/* One pill per branch */}
        {branches.map((b) => {
          const isActive = branchId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchId(b.id)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, #B85C38, #D77FA0)'
                  : 'white',
                color: isActive ? 'white' : '#3D2820',
                border: `1px solid ${isActive ? 'transparent' : '#E9E5E0'}`,
                boxShadow: isActive ? '0 4px 12px -4px #B85C3866' : 'none',
              }}
            >
              {isActive ? <Check size={11} /> : <Building2 size={11} />}
              {b.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BranchSelectorBar;
