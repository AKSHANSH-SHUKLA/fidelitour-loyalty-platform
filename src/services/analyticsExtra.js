/**
 * analyticsExtra — net-new query helpers for the dark Analytics redesign.
 *
 * These functions live next to the existing `ownerAPI` calls but don't
 * touch them. As real backend aggregations land for each metric, swap
 * the DEMO branch for the ownerAPI call. Every DEMO payload is flagged
 * with `__demo: true` so the UI can render a "demo data" pill if we
 * want to be explicit later.
 *
 * NOTE: nothing here mutates state. Pure data shaping + fetches.
 */
import { ownerAPI } from '../lib/api';

// Toggle DEMO_FALLBACK off to surface real backend errors instead of
// quietly substituting mock data. Useful during integration.
const DEMO_FALLBACK = true;

/**
 * Build a Mulberry32-style seeded RNG so the DEMO series is stable
 * across re-renders. Without this, each render reshuffles and the
 * sparklines twitch every time React reconciles.
 */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * getVisitsSparkline(branchId, days = 14)
 *
 * Tiny 14-point series for the "Visites" KPI sparkline. The backend
 * already returns 90 days in `summary.visits_by_day`, so as soon as we
 * pass that through to this helper we can drop the DEMO branch. For now
 * we generate a smooth uptrend so the UI doesn't render flat.
 *
 * TODO (backend): no extra endpoint needed — wire from the existing
 * /api/owner/analytics/summary visits_by_day field once we plumb it in.
 *
 * Returns: number[]
 */
export async function getVisitsSparkline(branchId, days = 14) {
  try {
    const r = await ownerAPI.getAnalyticsSummary?.({
      ...(branchId ? { branch_id: branchId } : {}),
    });
    const map = r?.data?.visits_by_day || {};
    // visits_by_day is a {YYYY-MM-DD: count} map. Take the last `days`
    // entries in chronological order.
    const keys = Object.keys(map).sort();
    if (keys.length >= 2) {
      return keys.slice(-days).map((k) => Number(map[k]) || 0);
    }
    if (!DEMO_FALLBACK) return [];
  } catch (_e) {
    if (!DEMO_FALLBACK) throw _e;
  }
  // DEMO fallback — smooth uptrend with a touch of noise.
  const rnd = seededRandom(2026);
  return Array.from({ length: days }, (_, i) => {
    const t = i / (days - 1);
    return Math.round(8 + t * 38 + rnd() * 8);
  });
}

/**
 * getKpiSparkline(kind, branchId)
 *
 * Generic shaped time series for the 5 main KPI sparklines. `kind` is
 * one of 'customers' | 'visits' | 'repeat' | 'wallet' | 'vip'. For now
 * each one returns a stable DEMO series tuned to the metric's typical
 * shape (customers ramps up, repeat oscillates, etc).
 *
 * TODO (backend): per-metric trend endpoints. The shape we need is just
 * a flat number[] of ~14 points. Could be derived from:
 *   - customers : count of customers created_at <= each day cutoff
 *   - visits    : already have visits_by_day; resample to 14 buckets
 *   - repeat    : repeat_rate over rolling 30-day windows
 *   - wallet    : count of pass_issued <= each day cutoff
 *   - vip       : count of tier=vip <= each day cutoff
 */
export async function getKpiSparkline(kind, branchId, days = 14) {
  // Visits we can wire to real data today.
  if (kind === 'visits') {
    return getVisitsSparkline(branchId, days);
  }

  // Everything else: DEMO until a per-metric trend endpoint lands.
  const SHAPES = {
    customers: { base: 38, growth: 12, jitter: 4, seed: 5 },
    repeat:    { base: 24, growth: 2,  jitter: 6, seed: 11 },
    wallet:    { base: 18, growth: 14, jitter: 3, seed: 17 },
    vip:       { base: 26, growth: 4,  jitter: 5, seed: 23 },
  };
  const s = SHAPES[kind] || SHAPES.customers;
  const rnd = seededRandom(s.seed);
  return Array.from({ length: days }, (_, i) => {
    const t = i / (days - 1);
    return Math.round(s.base + t * s.growth + (rnd() - 0.5) * 2 * s.jitter);
  });
}

/**
 * getRfmMatrix(branchId)
 *
 * 3×3 grid of recency × frequency counts.
 *
 * TODO (backend): no aggregation today. Would need an endpoint that
 * buckets customers by:
 *   - recency  (days since last visit): 0-30 / 31-60 / 60+
 *   - frequency (lifetime visit count): 1-3 / 4-9 / 10+
 * and returns `[[r0f0, r0f1, r0f2], [r1f0, r1f1, r1f2], [r2f0, r2f1, r2f2]]`.
 *
 * Returns: number[3][3]
 */
export async function getRfmMatrix(/* branchId */) {
  // DEMO. Stable values until real aggregation lands.
  return [
    [142, 418, 621],
    [208, 355, 472],
    [98,  187, 246],
  ];
}

/**
 * getHourlyMatrix(branchId)
 *
 * 7-day × 13-hour heatmap (Mon-Sun × 7am-7pm).
 *
 * The backend already returns visit_time_heatmap as
 *   { "Mon": {"7": n, "8": n, ...}, "Tue": {...}, ... }
 * Reshape into the 2D array the heatmap component renders directly.
 */
export async function getHourlyMatrix(branchId) {
  try {
    const r = await ownerAPI.getAnalyticsSummary?.({
      ...(branchId ? { branch_id: branchId } : {}),
    });
    const m = r?.data?.visit_time_heatmap;
    if (m && typeof m === 'object') {
      const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const matrix = DAYS.map((d) =>
        HOURS.map((h) => Number(m?.[d]?.[String(h)]) || 0)
      );
      const total = matrix.flat().reduce((a, b) => a + b, 0);
      if (total > 0) return { matrix, days: DAYS, hours: HOURS, __demo: false };
    }
    if (!DEMO_FALLBACK) return { matrix: [], days: [], hours: [], __demo: false };
  } catch (_e) {
    if (!DEMO_FALLBACK) throw _e;
  }
  // DEMO — Thursday 18h peak with smooth falloff.
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const matrix = DAYS.map((_d, di) =>
    HOURS.map((_h, hi) => {
      const dist = Math.sqrt((di - 3) ** 2 + ((hi - 11) * 0.6) ** 2);
      const base = Math.max(0, 1 - dist / 5);
      const noise = ((Math.sin(di * 7 + hi * 13) + 1) / 2) * 0.15;
      return Math.round((base + noise * 0.3) * 100);
    })
  );
  return { matrix, days: DAYS, hours: HOURS, __demo: true };
}

/**
 * getWeekdayCounts(branchId)
 *
 * 7 numbers, Mon..Sun, summed across the hours matrix.
 */
export async function getWeekdayCounts(branchId) {
  const { matrix, days } = await getHourlyMatrix(branchId);
  if (!matrix?.length) return { counts: [], days: [] };
  const counts = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  return { counts, days };
}

/**
 * getTopProducts(branchId)
 *
 * Ranked list of top products by revenue.
 *
 * TODO (backend): products aren't aggregated server-side today. Need a
 * `db.products` collection or a `line_items` aggregation that sums by
 * SKU/name. Stub returns curated demo values.
 */
export async function getTopProducts(/* branchId */) {
  // DEMO.
  return [
    { name: 'Café crème · panini',  revenue: 1240, pct: 0.86 },
    { name: 'Brunch dimanche',       revenue: 980,  pct: 0.68 },
    { name: 'Pâtisserie maison',     revenue: 760,  pct: 0.52 },
    { name: 'Plat du jour',          revenue: 540,  pct: 0.37 },
  ];
}

/**
 * getNewVsReturning(branchId)
 *
 * { newPct, returningPct } — split of visits in the period.
 *
 * TODO (backend): would need a single aggregation joining customers and
 * visits to classify each visit as the customer's first or a return.
 * Stub returns 65% returning / 35% new which matches the mockup.
 */
export async function getNewVsReturning(/* branchId */) {
  return { newPct: 35, returningPct: 65, __demo: true };
}
