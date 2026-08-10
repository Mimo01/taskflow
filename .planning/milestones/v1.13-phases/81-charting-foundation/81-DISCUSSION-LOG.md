# Phase 81: Charting Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 81-charting-foundation
**Areas discussed:** ChartWrapper API, Smoke-test chart fate, Lazy-loading strategy, Theme color access

---

## ChartWrapper API & State Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Status-prop card | Takes title/description + isLoading/error/isEmpty props; renders existing Skeleton/ErrorState/EmptyState primitives in a consistent card; children render only on success | ✓ |
| Render-prop / slots | Provides only sized card chrome + theming; caller passes state fallbacks explicitly | |
| Minimal sized box only | Just the explicit-height + 'use no memo' container; state handling left to callers | |

**User's choice:** Status-prop card
**Notes:** Maximizes reuse of existing UI state primitives and keeps downstream call sites lean.

---

## Smoke-Test Chart Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Temporary scaffold | Throwaway minimal chart to verify rendering; removed/replaced when Phase 83 rebuilds Dashboard | ✓ |
| First permanent chart | Build a real chart now (e.g. points-by-status) that survives into Phase 83 | |

**User's choice:** Temporary scaffold
**Notes:** Keeps Phase 81 pure foundation; avoids pulling Phase 83 product work forward.

---

## Lazy-Loading Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Convert Dashboard route to lazy | React.lazy() the Dashboard route in routes.tsx so its whole chunk (incl. recharts) splits from vendor/main | ✓ |
| Lazy-import the chart component only | Keep route static; lazy() just the chart/ChartWrapper at usage site | |

**User's choice:** Convert Dashboard route to lazy
**Notes:** Matches the "Dashboard lazy-loaded route chunk" success-criteria wording; sets a reusable lazy-route pattern. Scout finding: Dashboard route is currently a static import — must change.

---

## Theme Color Access

| Option | Description | Selected |
|--------|-------------|----------|
| CSS-var passthrough only | Rely on ChartContainer + var(--chart-N) strings; no JS theme hook | ✓ |
| Build useChartColors() now | Add Zustand-theme-reading hook as foundation for all downstream charts | |

**User's choice:** CSS-var passthrough only
**Notes:** Matches "zero theme code" research finding; --chart-1..5 tokens already in both themes. useChartColors() deferred until a chart genuinely needs JS-side colors.

---

## Claude's Discretion

- Bundle-analysis tooling/method for confirming the recharts chunk split.
- Exact ChartWrapper prop signature and card spacing (within the status-prop-card decision).
- Which minimal chart type to use for the throwaway smoke test.

## Deferred Ideas

- `useChartColors()` JS theme hook — add only if a downstream chart needs JS-side color values.
- Real product charts (points-by-status, burndown, logged-hours, sparklines, velocity) — Phases 83–85.
