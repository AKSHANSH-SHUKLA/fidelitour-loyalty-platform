import { useEffect, useState, useCallback } from 'react';
import { ownerAPI } from '../lib/api';

/**
 * useTileMetric — small hook that lets a single KPI tile own its own period.
 *
 * Returns { value, loading, days, period, setPeriod }.
 * `period` is { value, unit }. Calling `setPeriod` triggers a refetch.
 *
 * Example:
 *   const { value, loading, period, setPeriod } = useTileMetric({
 *     metric: 'new_customers',
 *     branchId,
 *     initial: { value: 7, unit: 'day' },
 *   });
 */
const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const toDays = (v, u) => Math.max(1, Math.round((Number(v) || 1) * (UNIT_DAYS[u] || 1)));

export default function useTileMetric({ metric, branchId, initial = { value: 30, unit: 'day' }, fallback = 0 }) {
  const [period, setPeriodState] = useState(initial);
  const [days, setDays] = useState(toDays(initial.value, initial.unit));
  const [value, setValue] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({});

  const setPeriod = useCallback((nextDays, nextPeriod) => {
    setDays(nextDays);
    setPeriodState(nextPeriod);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    ownerAPI
      .getAnalyticsMetric({ metric, days, ...(branchId ? { branch_id: branchId } : {}) })
      .then((r) => {
        if (!alive) return;
        setValue(r.data?.value ?? fallback);
        setMeta(r.data || {});
      })
      .catch(() => {
        if (!alive) return;
        setValue(fallback);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [metric, days, branchId, fallback]);

  return { value, loading, days, period, setPeriod, meta };
}
