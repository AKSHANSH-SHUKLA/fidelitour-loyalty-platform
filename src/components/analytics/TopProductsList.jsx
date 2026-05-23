/**
 * TopProductsList — ranked list of products with gradient progress bars.
 *
 * Props:
 *   items: [{ name, revenue, pct }]
 *     - pct is 0..1 (proportion of the top item's revenue)
 */
import React from 'react';

const GRADIENTS = [
  ['hsl(285 45% 42%)', 'hsl(295 50% 32%)'],
  ['hsl(215 65% 48%)', 'hsl(208 55% 40%)'],
  ['hsl(355 60% 48%)', 'hsl(355 65% 60%)'],
  ['hsl(105 30% 38%)', 'hsl(95 32% 50%)'],
  ['hsl(42 78% 52%)',  'hsl(32 80% 50%)'],
];

const fmtEUR = (n) =>
  Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';

const TopProductsList = ({ items = [] }) => {
  if (!items.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: 120, color: 'hsl(228 11% 55%)', fontSize: 12 }}>
        Aucun produit suivi pour l'instant.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => {
        const [from, to] = GRADIENTS[i % GRADIENTS.length];
        const pctClamped = Math.max(0.03, Math.min(1, Number(it.pct) || 0));
        return (
          <div key={`${it.name}-${i}`}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12, marginBottom: 4, color: 'hsl(228 14% 35%)',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, marginRight: 12 }}>
                {it.name}
              </span>
              <span className="av2-num" style={{ color: 'hsl(228 11% 45%)', flexShrink: 0 }}>
                {fmtEUR(it.revenue)}
              </span>
            </div>
            <div
              style={{
                height: 4, background: '#ECE3D2',
                borderRadius: 99, overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(pctClamped * 100).toFixed(1)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${from}, ${to})`,
                  transition: 'width 250ms cubic-bezier(.2,.7,.3,1)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TopProductsList;
