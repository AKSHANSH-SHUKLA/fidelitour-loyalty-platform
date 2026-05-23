/**
 * HoursHeatmap — 7-day × N-hour grid of visit intensity.
 *
 * Cells use the same purple-alpha intensity formula as the RFM heatmap:
 *   alpha = .12 + (value / max) * .68
 *
 * Props:
 *   matrix: number[7][N]   row index 0..6 = Mon..Sun, cols 0..N-1 = hours
 *   days:   ['Mon', 'Tue', ...]
 *   hours:  [7, 8, 9, ...]
 *   peak:   { dayIndex, hour } — optional, shown as headline above grid
 */
import React, { useMemo } from 'react';

const HoursHeatmap = ({ matrix = [], days = [], hours = [], peak }) => {
  const flat = matrix.flat();
  const max = Math.max(1, ...flat);

  const computedPeak = useMemo(() => {
    if (peak) return peak;
    if (!matrix.length) return null;
    let maxV = -1, di = 0, hi = 0;
    matrix.forEach((row, ri) => {
      row.forEach((v, ci) => {
        if (v > maxV) { maxV = v; di = ri; hi = ci; }
      });
    });
    return { dayIndex: di, hour: hours[hi] };
  }, [matrix, hours, peak]);

  const peakLabel = computedPeak && days[computedPeak.dayIndex]
    ? `${days[computedPeak.dayIndex]} ${String(computedPeak.hour).padStart(2, '0')}h00`
    : '—';

  if (!matrix.length || !hours.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: 140, color: 'hsl(228 11% 55%)', fontSize: 12 }}>
        Pas encore de visites.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(228 11% 45%)', fontWeight: 500 }}>
          Pic
        </div>
        <div className="av2-num" style={{ fontSize: 16, fontWeight: 500, color: 'hsl(228 28% 14%)' }}>
          {peakLabel}
        </div>
      </div>

      <div
        role="img"
        aria-label={`Heures de pointe: pic ${peakLabel}, ${flat.reduce((a, b) => a + b, 0)} visites au total`}
        style={{ display: 'grid', gridTemplateColumns: `28px repeat(${hours.length}, minmax(0, 1fr))`, gap: 3 }}
      >
        {/* Header row */}
        <span aria-hidden="true" />
        {hours.map((h) => (
          <div
            key={h}
            style={{
              fontSize: 9, color: 'hsl(228 11% 55%)', textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {h}
          </div>
        ))}
        {/* Body rows */}
        {matrix.map((row, ri) => (
          <React.Fragment key={ri}>
            <div
              style={{
                fontSize: 9.5, color: 'hsl(228 11% 45%)',
                textAlign: 'right', paddingRight: 4, fontWeight: 500,
                letterSpacing: '0.04em', alignSelf: 'center',
              }}
            >
              {days[ri] || ''}
            </div>
            {row.map((v, ci) => {
              const intensity = (Number(v) || 0) / max;
              const alpha = (0.12 + intensity * 0.68).toFixed(2);
              const isPeak = computedPeak && computedPeak.dayIndex === ri && hours[ci] === computedPeak.hour;
              return (
                <div
                  key={ci}
                  title={`${days[ri]} ${hours[ci]}h — ${v} visite${v > 1 ? 's' : ''}`}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 3,
                    background: `rgba(139, 92, 246, ${alpha})`,
                    outline: isPeak ? '1px solid hsl(285 45% 35%)' : 'none',
                    transition: 'transform 150ms cubic-bezier(.2,.7,.3,1)',
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default HoursHeatmap;
