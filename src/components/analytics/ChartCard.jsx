/**
 * ChartCard — dark surface card with header (title + optional chip/select)
 * and children body. Used to wrap every chart panel in the v2 Analytics.
 */
import React from 'react';

const ChartCard = ({ title, chip, action, children, padding = 16, glow = false }) => (
  <div
    className={`av2-card${glow ? ' av2-glow' : ''}`}
    style={{
      padding,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {title ? (
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: 'hsl(228 28% 14%)',
            letterSpacing: '-0.005em',
          }}
        >
          {title}
        </h3>
      ) : <span />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {chip}
        {action}
      </div>
    </div>
    {children}
  </div>
);

export default ChartCard;
