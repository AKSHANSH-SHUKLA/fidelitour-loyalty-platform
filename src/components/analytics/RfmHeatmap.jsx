/**
 * RfmHeatmap — 3×3 grid of recency × frequency buckets.
 *
 * Each cell is rendered as a flat div with purple alpha scaling with the
 * cell's value relative to the matrix max. Matches the mockup formula:
 *   alpha = .12 + (value / max) * .68
 *
 * Props:
 *   matrix:      number[3][3] — rows: recency (recent, tepid, dormant)
 *                              cols: frequency (low, mid, high)
 *   rowLabels:   override row labels (default Récent / Tiède / Dormant)
 *   colLabels:   override col labels (default Faible / Moyen / Fort)
 */
import React from 'react';

const DEFAULT_ROWS = ['Récent', 'Tiède', 'Dormant'];
const DEFAULT_COLS = ['Faible', 'Moyen', 'Fort'];

const RfmHeatmap = ({
  matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  rowLabels = DEFAULT_ROWS,
  colLabels = DEFAULT_COLS,
}) => {
  const flat = matrix.flat();
  const max = Math.max(1, ...flat);
  const summary = `RFM segments: ${flat.reduce((a, b) => a + b, 0)} clients répartis sur ${matrix.length}×${matrix[0]?.length || 0} segments`;

  return (
    <div role="img" aria-label={summary}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto repeat(3, 1fr)',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {/* Header row — empty corner + column labels */}
        <span aria-hidden="true" />
        {colLabels.map((c) => (
          <div
            key={c}
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'hsl(228 11% 45%)',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {c}
          </div>
        ))}

        {matrix.map((row, ri) => (
          <React.Fragment key={ri}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'hsl(228 11% 45%)',
                fontWeight: 500,
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                textAlign: 'center',
                alignSelf: 'center',
              }}
            >
              {rowLabels[ri] || ''}
            </div>
            {row.map((v, ci) => {
              const intensity = (Number(v) || 0) / max;
              const alpha = (0.12 + intensity * 0.68).toFixed(2);
              const txtCol = intensity > 0.55 ? 'hsl(228 28% 14%)' : 'hsl(228 14% 35%)';
              return (
                <div
                  key={ci}
                  title={`${rowLabels[ri]} × ${colLabels[ci]} — ${v} clients`}
                  className="av2-num"
                  style={{
                    aspectRatio: '1 / 1',
                    minHeight: 60,
                    borderRadius: 10,
                    background: `rgba(139, 92, 246, ${alpha})`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 14,
                    fontWeight: 500,
                    color: txtCol,
                    transition: 'transform 150ms cubic-bezier(.2,.7,.3,1)',
                  }}
                >
                  {v}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default RfmHeatmap;
