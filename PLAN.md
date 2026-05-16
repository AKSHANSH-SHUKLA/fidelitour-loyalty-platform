# Analytics Dark Redesign — Implementation Plan

Branch: `feat/analytics-dark-redesign`
Target: `fidelitour-deploy/src/pages/AnalyticsPage.jsx` only (plus shared tokens, primitives, and chart components needed by that page).

## Stack translation (important)

The original prompt assumes Next.js 15 + TypeScript + shadcn/ui + Supabase. This
codebase is actually Vite + React JSX + plain Tailwind + custom CSS + FastAPI +
MongoDB. The design intent translates directly; the toolchain does not.

| Prompt term                          | This project's equivalent                                       |
|--------------------------------------|-----------------------------------------------------------------|
| `app/(dashboard)/analytics/page.tsx` | `src/pages/AnalyticsPage.jsx`                                   |
| `app/(dashboard)/layout.tsx`         | `src/pages/DashboardLayout.jsx`                                 |
| Tailwind config `theme.extend`       | `src/index.css` CSS variables + `tailwind.config.js` (existing) |
| shadcn `<Button>`, `<Select>`        | Plain HTML buttons + selects styled via existing utility classes |
| Supabase query in a server component | `ownerAPI` client calls + `useTileMetric` hook                   |
| `lib/analytics/getX.ts`              | New `src/services/analyticsExtra.js` functions                   |
| `lucide-react` (already in stack)    | Keep — replaces "Tabler outline" mentioned in the preview         |
| `pnpm`                               | `npm` (existing)                                                 |
| TypeScript types                     | Plain JS; JSDoc for prop docs                                    |
| Recharts                             | Already in stack — keep                                          |

## Theme-scope decision (chosen by the owner)

Dark Analytics + dark sidebar when on `/dashboard/analytics`. The rest of the
app stays on its current cream theme. Implementation: add a
`data-route-dark="true"` attribute on the dashboard layout root whenever the
location matches `/dashboard/analytics`. Dark token CSS variables apply only
under that selector, and a small additional rule swaps the sidebar's surface
and text colours when that attribute is present.

## Files to add / modify

### Add
- `PLAN.md` — this file (repo root).
- `ANALYTICS_REDESIGN.md` — written at the end of Phase 7.
- `src/components/analytics/Sparkline.jsx` — recharts AreaChart, no axes/grid.
- `src/components/analytics/KpiCard.jsx` — accent variants `purple|pink|cyan|emerald|orange`.
- `src/components/analytics/ChartCard.jsx` — generic dark card with title + optional chip.
- `src/components/analytics/VisitsBarLineChart.jsx` — ComposedChart, bars + line for uniques.
- `src/components/analytics/ChannelDonut.jsx` — gradient PieChart + side legend.
- `src/components/analytics/NewVsReturningDonut.jsx` — parameterised variant of `ChannelDonut`.
- `src/components/analytics/RfmHeatmap.jsx` — 3×3 grid, purple alpha intensity.
- `src/components/analytics/HoursHeatmap.jsx` — 7 × 13 grid, purple alpha intensity.
- `src/components/analytics/WeekdayBars.jsx` — 7 vertical bars, tall variant for top.
- `src/components/analytics/RevenueAreaChart.jsx` — area + headline number.
- `src/components/analytics/TopProductsList.jsx` — ranked list, gradient progress bars.
- `src/components/analytics/AutomationCard.jsx` — strip card with accent + status pill.
- `src/components/analytics/AutomationEmpty.jsx` — dashed CTA tile.
- `src/components/analytics/RightAiPanel.jsx` — Score + Insights + Quick actions + Assistant stub.
- `src/components/analytics/ScoreWidget.jsx` — radial bar with mini ring.
- `src/services/analyticsExtra.js` — new queries: `getVisitsSparkline`, `getRfmMatrix`, `getHourlyMatrix`, `getWeekdayCounts`, `getTopProducts`, `getNewVsReturning`. Each function notes its backend status (real or DEMO).

### Modify
- `src/index.css` — add HSL dark tokens scoped to `.fdt-analytics-v2` (NOT applied globally).
- `src/pages/AnalyticsPage.jsx` — replace JSX return with the dark shell. Keep existing data hooks and `summary`/`branchId` wiring intact at the top.
- `src/pages/DashboardLayout.jsx` — add `data-route-dark` attribute on the layout root when `location.pathname.startsWith('/dashboard/analytics')`. Keep all other routing logic untouched.

### Do NOT touch
- `src/pages/OwnerDashboard.jsx`
- `src/pages/CustomersPage.jsx`, `CampaignsPage.jsx`, `CardDesignerPage.jsx`, `SettingsPage.jsx`, all others.
- `api/server.py`, backend endpoints, schemas, MongoDB queries.
- `tailwind.config.js` — extend only if a phase actually requires it (likely Phase 0 to add font tokens).
- All marketing / auth / landing pages.

## Phases (one commit per phase, conventional-commit format)

### Phase 0 — Scaffold (this commit)
- `PLAN.md` at repo root.
- Dark HSL tokens added to `src/index.css` under `.fdt-analytics-v2 { ... }`.
- Inter + JetBrains Mono loaded via Google Fonts (if not already).
- `AnalyticsPage.jsx` rewritten with an empty three-column shell (left nav placeholder, main with `<h1>` heading, right rail placeholder). Keep all existing data hooks at the top so Phase 1+ can wire them in.
- `DashboardLayout.jsx` adds `data-route-dark` attribute + a small CSS rule that flips the sidebar surface to the dark token palette when that attribute is present.
- The Analytics route renders the new dark page; every other route is untouched.

### Phase 1 — Page header + 5 KPI cards
- Build `KpiCard` + `Sparkline` primitives.
- Wire real metric values from existing `summary` and `useTileMetric` hooks.
- Sparkline series stub (`getVisitsSparkline`) returns mock data flagged `__DEMO__`.

### Phase 2 — Visits chart + Channels donut
- `VisitsBarLineChart` (real `visits_by_day` series) + `ChannelDonut` (real `acquisitionChart`).
- Both inside `ChartCard`.

### Phase 3 — RFM + Revenue area + Top products
- `RfmHeatmap` (new `getRfmMatrix` query — DEMO stubbed until schema lands).
- `RevenueAreaChart` (real `summary?.revenue_by_day` if present; DEMO otherwise).
- `TopProductsList` (new `getTopProducts` — likely DEMO; backend may not have products yet).

### Phase 4 — Hours heatmap + Weekday bars + New vs Returning
- `HoursHeatmap` reuses backend `visit_time_heatmap`.
- `WeekdayBars` from the same data summed by day-of-week.
- `NewVsReturningDonut` from `summary` (real if available, else `getNewVsReturning` DEMO).

### Phase 5 — Automations strip
- `AutomationCard` × 3 (real auto-campaign data from existing endpoints) + `AutomationEmpty` CTA.

### Phase 6 — Right AI panel
- `RightAiPanel` with `ScoreWidget`, Insights list, Quick actions, Assistant stub.
- Insights pull from the same alerts source the dashboard uses.
- Assistant input is a stub — wiring to a real model is a follow-up ticket.

### Phase 7 — Responsive + a11y + QA
- Breakpoints: <1500 tighten side widths, <1280 hide right rail, <900 single column + sidebar drawer.
- aria-labels on every icon button.
- 2px purple focus rings, offset 2px.
- `prefers-reduced-motion` kills the rise entrance animation.
- ARIA labels on every `ResponsiveContainer`.
- Run `npm run build`, fix anything red.
- Write `ANALYTICS_REDESIGN.md`.

## Risks

- `fidelitour-v2.html` reference HTML was NOT provided. Layout, gradients, and
  exact spacing are interpreted from the prompt's token table and component
  inventory. Pixel-level fidelity will need that file (or a fresh round of
  iterations against screenshots).
- The codebase has no TypeScript and no shadcn/ui. Component files will be
  `.jsx` and primitives will be hand-rolled where shadcn was assumed.
- Several new queries (`getRfmMatrix`, `getTopProducts`) reference data the
  backend may not aggregate yet. Those queries will be stubbed with DEMO data,
  flagged with a `// TODO: backend aggregation` comment, and the SQL/Mongo
  pipeline I'd write to populate them documented in the function header.
- The Recharts version pinned in the project is fixed; if any chart type
  needs a newer version we'll surface it before bumping.

## Done criteria

- `/dashboard/analytics` renders the dark redesign with all eight phases on
  the branch, every phase reviewable in its own commit.
- The Vercel preview of `feat/analytics-dark-redesign` shows the new page.
- `npm run build` passes locally.
- `ANALYTICS_REDESIGN.md` exists at repo root.
- No other route's appearance has changed.
