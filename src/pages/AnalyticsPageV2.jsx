/**
 * AnalyticsPageV2 — dark-themed wrapper around the full OwnerDashboard.
 *
 * Per the owner's brief: keep EVERY section the dashboard already shows
 * (AI banner, Idées & actions, KPI grid, Customer Status, Charts row,
 * Hours heatmap, Churn, LTV, Plan usage, right rail Alertes / Résumé
 * rapide) — apply the new dark/purple theme on top, do NOT delete or
 * replace any content.
 *
 * Implementation: render <OwnerDashboard /> exactly as it is, wrapped
 * in a single class. All visual flips live in src/index.css under the
 * `.av2-dark-skin .fdt-dash` cascade. The dashboard's data hooks,
 * event handlers, navigation and component tree are entirely untouched.
 *
 * Rollback: swap the legacy AnalyticsPage import back in App.jsx
 * (one-line revert as documented at the top of App.jsx).
 */
import React from 'react';
import OwnerDashboard from './OwnerDashboard';

export default function AnalyticsPageV2() {
  return (
    <div className="av2-dark-skin">
      <OwnerDashboard />
    </div>
  );
}
