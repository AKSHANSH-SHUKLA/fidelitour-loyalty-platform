/**
 * TopProductsList — ranked list of products with gradient progress bars.
 *
 * Props:
 *   items: [{ name, revenue, pct }]
 *     - pct is 0..1 (proportion of the top item's revenue)
 */
import React from 'react';

const GRADIENTS = [
  ['hsl(258 90% 66%)', 'hsl(263 70% 50%)'],
  ['hsl(189 94% 43%)', 'hsl(187 85% 53%)'],
  ['hsl(352 89% 60%)', 'hsl(351 95% 71%)'],
  ['hsl(160 84% 39%)', 'hsl(158 64% 52%)'],
  ['hsl(38 92% 50%)',  'hsl(21 90% 53%)'],
];

const fmtEUR = (n) =>
  Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';

const TopProductsList = ({ items = [] }) => {
  if (!items.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: 120, color: 'hsl(228 11% 41%)', fontSize: 12 }}>
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
                fontSize: 12, marginBottom: 4, color: 'hsl(228 14% 81%)',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, marginRight: 12 }}>
                {it.name}
              </span>
              <span className="av2-num" style={{ color: 'hsl(228 11% 60%)', flexShrink: 0 }}>
                {fmtEUR(it.revenue)}
              </span>
            </div>
            <div
              style={{
                height: 4, background: 'hsl(230 32% 18%)',
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
