import React from 'react';
import { C as C_PS } from './PageShell';

/**
 * Reusable time-range selector — dropdown of presets PLUS a custom
 * "<number> <unit>" input where unit is days | weeks | months | years.
 *
 * Drop into any page that filters data by time:
 *
 *   const [range, setRange] = useState({ unit: 'days', count: 30 });
 *   <TimeRangeSelector value={range} onChange={setRange} />
 *
 * Then turn it into days when calling the backend:
 *   const days = TimeRangeSelector.toDays(range);
 *   api.get('/owner/analytics/visits', { params: { days } })
 *
 * Or, for endpoints that accept unit+count natively:
 *   api.get('/owner/analytics/history/new-customers', { params: range })
 *
 * Pass `allowAllTime` if you want an "All time" option.
 *
 * Component does not own state — it's controlled by the parent's value/onChange.
 */
const PRESETS = [
  { unit: 'days',   count: 7,   label: 'Last 7 days' },
  { unit: 'days',   count: 30,  label: 'Last 30 days' },
  { unit: 'days',   count: 90,  label: 'Last 90 days' },
  { unit: 'months', count: 6,   label: 'Last 6 months' },
  { unit: 'months', count: 12,  label: 'Last 12 months' },
  { unit: 'years',  count: 2,   label: 'Last 2 years' },
];

const TimeRangeSelector = ({
  value,                                   // { unit, count } | { unit: 'all' }
  onChange,                                // (newValue) => void
  allowAllTime = true,
  presets = PRESETS,
  className = '',
  size = 'md',                             // 'sm' | 'md'
}) => {
  const padding = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const isAll = value?.unit === 'all';

  const selectedKey = isAll ? 'all' : presets.find(
    (p) => p.unit === value?.unit && p.count === value?.count
  )?.label;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <select
        className={`border rounded-lg ${padding} bg-white`}
        style={{ borderColor: C_PS.hairline }}
        value={selectedKey || 'custom'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'all') return onChange({ unit: 'all' });
          if (v === 'custom') return; // keep current value, just signal intent
          const preset = presets.find((p) => p.label === v);
          if (preset) onChange({ unit: preset.unit, count: preset.count });
        }}
      >
        {presets.map((p) => (
          <option key={p.label} value={p.label}>{p.label}</option>
        ))}
        {allowAllTime && <option value="all">All time</option>}
        <option value="custom">Custom…</option>
      </select>

      {!isAll && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={9999}
            value={value?.count ?? 30}
            onChange={(e) => {
              const n = Math.max(1, parseInt(e.target.value || '1', 10));
              onChange({ unit: value?.unit || 'days', count: n });
            }}
            className={`w-20 border rounded-lg ${padding}`}
            style={{ borderColor: C_PS.hairline }}
            aria-label="Time range count"
          />
          <select
            className={`border rounded-lg ${padding} bg-white`}
            style={{ borderColor: C_PS.hairline }}
            value={value?.unit || 'days'}
            onChange={(e) => onChange({ unit: e.target.value, count: value?.count ?? 30 })}
            aria-label="Time range unit"
          >
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
            <option value="years">years</option>
          </select>
        </div>
      )}
    </div>
  );
};

// Static utility: convert a {unit, count} value into a day count.
// Useful for endpoints that only accept `?days=N`.
TimeRangeSelector.toDays = (value) => {
  if (!value || value.unit === 'all') return null;
  const c = value.count || 0;
  switch (value.unit) {
    case 'days':   return c;
    case 'weeks':  return c * 7;
    case 'months': return c * 31;
    case 'years':  return c * 365;
    default: return c;
  }
};

// Default initial value for callers that want a sensible starting point.
TimeRangeSelector.DEFAULT = { unit: 'days', count: 30 };

export default TimeRangeSelector;
