import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

/**
 * PeriodPicker — compact inline window selector.
 *
 * Renders a numeric input and a unit dropdown. Calls `onChange(days, { value, unit })`
 * whenever the user commits a new value (Enter or blur, or unit change).
 *
 * Usage:
 *   <PeriodPicker value={7} unit="days" onChange={(days, { value, unit }) => ...} />
 *
 * Units → days conversion:
 *   day    : 1
 *   week   : 7
 *   month  : 30
 *   year   : 365
 */
const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const UNIT_LABEL = { day: 'jours', week: 'semaines', month: 'mois', year: 'années' };

const toDays = (value, unit) => Math.max(1, Math.round((Number(value) || 1) * (UNIT_DAYS[unit] || 1)));

const PeriodPicker = ({
  value: initialValue = 30,
  unit: initialUnit = 'day',
  onChange,
  accent = '#B85C38',
  compact = true,
  onDark = false, // when true, render glassy white-on-translucent (for use on colorful tiles)
}) => {
  const [val, setVal] = useState(initialValue);
  const [draft, setDraft] = useState(String(initialValue));
  const [unit, setUnit] = useState(initialUnit);

  useEffect(() => { setDraft(String(val)); }, [val]);

  const commit = (v, u) => {
    const n = Math.max(1, Math.min(999, Math.round(Number(v) || 1)));
    setVal(n);
    setDraft(String(n));
    onChange?.(toDays(n, u), { value: n, unit: u });
  };

  // Two visual modes: on-light (uses accent color) and on-dark (white glass)
  const containerStyle = onDark
    ? { borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.18)' }
    : { borderColor: `${accent}55`, background: 'rgba(255,255,255,0.9)' };
  const fgColor = onDark ? '#FFFFFF' : accent;
  const inputBg = onDark ? 'rgba(255,255,255,0.15)' : 'transparent';
  const optionBg = onDark ? '#3A2418' : '#FFFFFF';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
      style={containerStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar size={compact ? 11 : 13} style={{ color: fgColor }} />
      <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-wider`} style={{ color: fgColor, opacity: onDark ? 0.85 : 1 }}>
        Last
      </span>
      <input
        type="number"
        min="1"
        max="999"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft, unit)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(draft, unit); e.currentTarget.blur(); }
        }}
        className={`${compact ? 'w-10 text-[11px]' : 'w-12 text-xs'} font-bold outline-none text-center rounded-md`}
        style={{ color: fgColor, background: inputBg }}
      />
      <select
        value={unit}
        onChange={(e) => { setUnit(e.target.value); commit(draft, e.target.value); }}
        className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold bg-transparent outline-none cursor-pointer`}
        style={{ color: fgColor }}
      >
        <option value="day"   style={{ color: '#1C1917', background: optionBg }}>{UNIT_LABEL.day}</option>
        <option value="week"  style={{ color: '#1C1917', background: optionBg }}>{UNIT_LABEL.week}</option>
        <option value="month" style={{ color: '#1C1917', background: optionBg }}>{UNIT_LABEL.month}</option>
        <option value="year"  style={{ color: '#1C1917', background: optionBg }}>{UNIT_LABEL.year}</option>
      </select>
    </div>
  );
};

export default PeriodPicker;
export { toDays as periodToDays, UNIT_DAYS, UNIT_LABEL };
