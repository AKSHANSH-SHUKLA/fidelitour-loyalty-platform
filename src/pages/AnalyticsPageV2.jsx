/**
 * AnalyticsPageV2 — dark redesign (Phase 0 scaffold)
 *
 * Three-column shell. Left sidebar lives in DashboardLayout and flips to a
 * dark surface via the [data-route-dark] attribute that DashboardLayout
 * sets on this route. This file owns only the centre + right rail.
 *
 * Phase 0 is scaffold-only: empty placeholder cards inside the dark shell.
 * Phases 1-6 progressively wire in real components. Phase 7 is a11y / QA.
 */
import React from 'react';
import { useBranch } from '../contexts/BranchContext';

const Eyebrow = ({ children }) => (
  <span className="av2-eyebrow">{children}</span>
);

const Placeholder = ({ label }) => (
  <div className="av2-placeholder">{label}</div>
);

export default function AnalyticsPageV2() {
  // Branch context is wired so future phases can pass branch_id into queries.
  // Phase 0 doesn't use it; kept here to flag for Phase 1+.
  const { branchId } = useBranch();

  return (
    <div className="fdt-analytics-v2">
      {/* Page header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="av2-h1">Analytics</h1>
          <p className="av2-sub">
            Vue d'ensemble · <span className="av2-mono">14 Avr — 13 Mai</span>
            {branchId ? <span style={{ marginLeft: 8, opacity: 0.6 }}>· branche actuelle</span> : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Placeholder label="DateRangePicker — phase 1" />
        </div>
      </header>

      {/* Three-column shell — main grid + sticky right rail. */}
      <div className="av2-shell">
        {/* ─── MAIN COLUMN ─── */}
        <main className="av2-main">
          {/* Phase 1 — KPI row */}
          <section aria-labelledby="kpi-row-heading">
            <Eyebrow>Phase 1 · KPI cards</Eyebrow>
            <h2 id="kpi-row-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>Indicateurs principaux</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Placeholder key={i} label={`KPI ${i + 1}`} />
              ))}
            </div>
          </section>

          {/* Phase 2 — Visits chart + Channels donut */}
          <section aria-labelledby="phase-2-heading">
            <Eyebrow>Phase 2 · Visites + Canaux</Eyebrow>
            <h2 id="phase-2-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>Visites dans le temps et canaux d'acquisition</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginTop: 8 }}>
              <Placeholder label="VisitsBarLineChart" />
              <Placeholder label="ChannelDonut" />
            </div>
          </section>

          {/* Phase 3 — RFM + Revenue + Top products */}
          <section aria-labelledby="phase-3-heading">
            <Eyebrow>Phase 3 · RFM, revenu, top produits</Eyebrow>
            <h2 id="phase-3-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>Segments RFM, revenu et top produits</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12, marginTop: 8 }}>
              <Placeholder label="RfmHeatmap" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Placeholder label="RevenueAreaChart" />
                <Placeholder label="TopProductsList" />
              </div>
            </div>
          </section>

          {/* Phase 4 — Hours, weekday, new vs returning */}
          <section aria-labelledby="phase-4-heading">
            <Eyebrow>Phase 4 · Heures, jours, nouveau vs récurrent</Eyebrow>
            <h2 id="phase-4-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>Heures de pointe, jours, nouveau vs récurrent</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.8fr 0.8fr', gap: 12, marginTop: 8 }}>
              <Placeholder label="HoursHeatmap" />
              <Placeholder label="WeekdayBars" />
              <Placeholder label="NewVsReturningDonut" />
            </div>
          </section>

          {/* Phase 5 — Automations */}
          <section aria-labelledby="phase-5-heading">
            <Eyebrow>Phase 5 · Automatisations</Eyebrow>
            <h2 id="phase-5-heading" style={{ position: 'absolute', left: -10000, top: 'auto' }}>Automatisations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }}>
              <Placeholder label="AutomationCard" />
              <Placeholder label="AutomationCard" />
              <Placeholder label="AutomationCard" />
              <Placeholder label="AutomationEmpty" />
            </div>
          </section>
        </main>

        {/* ─── RIGHT AI RAIL ─── */}
        <aside className="av2-rail" aria-label="Assistant IA et insights">
          <Eyebrow>Phase 6 · Right AI panel</Eyebrow>
          <Placeholder label="ScoreWidget" />
          <Placeholder label="Insights IA" />
          <Placeholder label="Actions rapides" />
          <Placeholder label="Assistant IA" />
        </aside>
      </div>
    </div>
  );
}
