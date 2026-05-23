/**
 * RevenueAreaChart — headline number + dark area chart.
 *
 * Props:
 *   total:    number — headline (formatted by parent)
 *   unit:     "€" by default
 *   delta:    +/- percentage (optional)
 *   data:     [{ x, value }] — area series
 *   height:   px (default 80)
 *   label:    section label (default "REVENU MENSUEL")
 */
import React from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: '1px solid #E7E5E4',
  borderRadius: 10,
  color: 'hsl(228 28% 14%)',
  fontSize: 12,
  padding: '6px 10px',
  boxShadow: '0 12px 30px -12px rgba(0,0,0,.6)',
};

const RevenueAreaChart = ({ total, unit = '€', delta, data = [], height = 80, label = 'Revenu mensuel' }) => {
  const up = (delta ?? 0) >= 0;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(228 11% 45%)', fontWeight: 500 }}>
            {label}
          </div>
          <div className="av2-num" style={{ fontSize: 26, fontWeight: 500, color: 'hsl(228 28% 14%)', lineHeight: 1.05, marginTop: 2 }}>
            {total ?? '—'}
            {unit ? <span style={{ fontSize: 14, color: 'hsl(228 11% 45%)', marginLeft: 4 }}>{unit}</span> : null}
          </div>
        </div>
        {delta != null && isFinite(delta) ? (
          <span
            style={{
              fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
              color: up ? 'hsl(160 84% 50%)' : 'hsl(355 65% 60%)',
              background: up ? 'hsl(105 30% 38% / .12)' : 'hsl(355 60% 48% / .12)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {up ? '+' : '−'}{Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div role="img" aria-label={`Tendance du revenu, ${data.length} points`} style={{ height }}>
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="av2-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="hsl(285 45% 42%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(285 45% 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(252 90% 76%)"
                strokeWidth={2}
                fill="url(#av2-rev-grad)"
                isAnimationActive={false}
                dot={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: 'hsl(228 11% 45%)', fontSize: 11 }}
                cursor={{ stroke: 'hsl(252 90% 76% / .3)', strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 11, color: 'hsl(228 11% 55%)' }}>
            Pas assez de données pour tracer la tendance.
          </div>
        )}
      </div>
    </>
  );
};

export default RevenueAreaChart;
