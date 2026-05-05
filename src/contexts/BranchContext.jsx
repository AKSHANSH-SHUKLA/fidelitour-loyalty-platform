/**
 * BranchContext — app-wide selected-branch state.
 *
 * Per the v2 spec (item #18):
 *   "When the owner chooses a store on the dashboard, every page should
 *    automatically filter to that store. They should not have to re-select
 *    the branch on each page."
 *
 * Stored in localStorage (key: 'ft_selected_branch_v1') so reloads keep
 * the chosen branch. `null` means "all branches".
 *
 * Usage:
 *   const { branchId, setBranchId, branches, setBranches } = useBranch();
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'ft_selected_branch_v1';

const BranchContext = createContext({
  branchId: null,
  setBranchId: () => {},
  branches: [],
  setBranches: () => {},
});

export const BranchProvider = ({ children }) => {
  // Read once on mount; ignore if storage is unavailable (e.g. private mode)
  const [branchId, _setBranchId] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || raw === 'null' || raw === 'undefined') return null;
      return raw;
    } catch { return null; }
  });
  const [branches, setBranches] = useState([]);

  const setBranchId = (id) => {
    _setBranchId(id);
    try {
      if (id == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, id);
    } catch { /* ignore */ }
  };

  // If the selected branch disappears from the latest branch list, reset.
  useEffect(() => {
    if (branchId && branches.length > 0 && !branches.some((b) => b.id === branchId)) {
      setBranchId(null);
    }
  }, [branchId, branches]);

  return (
    <BranchContext.Provider value={{ branchId, setBranchId, branches, setBranches }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => useContext(BranchContext);
