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

export default function useTileMetric({ metric, branchId, initial = { value: 30, unit: 'day' }, fallback = 0, withSeries = false, controlledDays = null }) {
  const [period, setPeriodState] = useState(initial);
  // When controlledDays is provided, the parent component owns the time
  // window — the hook just consumes it and re-fetches whenever it changes.
  // Falls back to internal state when controlledDays === null.
  const [internalDays, setDays] = useState(toDays(initial.value, initial.unit));
  const days = (controlledDays != null && Number.isFinite(controlledDays)) ? Math.max(1, Math.round(controlledDays)) : internalDays;
  const [value, setValue] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({});
  // Sparkline series + percentage delta returned alongside the value when
  // withSeries is enabled. The premium KPI tiles read these to render
  // their inline trendlines and ±% pill.
  const [series, setSeries] = useState(null);
  const [deltaPct, setDeltaPct] = useState(null);

  const setPeriod = useCallback((nextDays, nextPeriod) => {
    setDays(nextDays);
    setPeriodState(nextPeriod);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    ownerAPI
      .getAnalyticsMetric({
        metric,
        days,
        ...(branchId ? { branch_id: branchId } : {}),
        ...(withSeries ? { series: true } : {}),
      })
      .then((r) => {
        if (!alive) return;
        const data = r.data || {};
        setValue(data.value ?? fallback);
        setMeta(data);
        if (withSeries) {
          setSeries(Array.isArray(data.series) ? data.series : null);
          setDeltaPct(typeof data.delta_pct === 'number' ? data.delta_pct : null);
        }
      })
      .catch(() => {
        if (!alive) return;
        setValue(fallback);
        setSeries(null);
        setDeltaPct(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [metric, days, branchId, fallback, withSeries]);

  return { value, loading, days, period, setPeriod, meta, series, deltaPct };
}
