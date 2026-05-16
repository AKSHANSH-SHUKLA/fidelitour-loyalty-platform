/**
 * WeekdayBars — 7 vertical bars. The peak day gets a brighter gradient
 * + soft purple glow underneath ("tall" variant in the spec).
 */
import React from 'react';

const WeekdayBars = ({ counts = [], days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], height = 110 }) => {
  if (!counts.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height, color: 'hsl(228 11% 41%)', fontSize: 12 }}>
        Aucune donnée par jour.
      </div>
    );
  }
  const max = Math.max(1, ...counts);
  const peakIdx = counts.indexOf(max);
  const total = counts.reduce((s, n) => s + n, 0);

  return (
    <div role="img" aria-label={`Visites par jour de la semaine, total ${total}`}>
      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 5, alignItems: 'end', height,
        }}
      >
        {counts.map((v, i) => {
          const pct = Math.max(0.06, v / max);
          const isPeak = i === peakIdx;
          return (
            <div
              key={i}
              title={`${days[i]} — ${v} visites`}
              style={{
                height: `${pct * 100}%`,
                borderRadius: 4,
                background: isPeak
                  ? 'linear-gradient(180deg, hsl(258 90% 66%), hsl(258 90% 66% / .5))'
                  : `hsl(258 90% 66% / ${(0.22 + pct * 0.36).toFixed(2)})`,
                boxShadow: isPeak ? '0 0 12px hsl(258 90% 66% / .35)' : 'none',
                transition: 'height 250ms cubic-bezier(.2,.7,.3,1)',
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 5, marginTop: 6, fontSize: 9.5, color: 'hsl(228 11% 60%)',
          textAlign: 'center',
        }}
      >
        {days.map((d, i) => (
          <span key={i} style={{ color: i === peakIdx ? 'hsl(252 95% 85%)' : undefined, fontWeight: i === peakIdx ? 500 : 400 }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
};

export default WeekdayBars;
