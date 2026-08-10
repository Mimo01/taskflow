---
phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
plan: "04"
subsystem: dashboard
tags: [integration, dashboard-root, human-uat, gitlab-auth, descope, uat-iteration]
dependency_graph:
  requires: ["84-02", "84-03"]
  provides: ["dashboard/index.tsx (wired sections)"]
  affects: []
tech_stack:
  added: []
  patterns:
    - "Single point of PAT load in index.tsx; sections receive token as prop (D-16)"
    - "Schedule-aware last-working-day date shared with StandupNotesPage (resolveYesterdayDate)"
    - "Per-bar recharts Cell coloring + LabelList value labels"
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/ActivityStrip.tsx
    - taskflow/src/routes/dashboard/ActivityStrip.test.tsx
    - taskflow/src/routes/dashboard/WeeklyTrendChart.tsx
  deleted:
    - taskflow/src/routes/dashboard/MrReviewQueue.tsx
    - taskflow/src/routes/dashboard/MrReviewQueue.test.tsx
decisions:
  - "DASH-06 DESCOPED: user rejected the MR review queue during UAT ('Remove the MR queue, I don't like that component'). Component, tests, and wiring removed; gitlabTokenLoading state dropped as unused."
  - "ActivityStrip empty-feed bug: it queried calendar-yesterday (Sunday on a Monday → empty) instead of the last working day. Replaced with resolveYesterdayDate() + shared ['standup','schedule',...] query — byte-identical to StandupNotesPage — restoring both the data and the zero-duplicate cache reuse (DASH-05 criterion 2, which was silently broken)."
  - "WeeklyTrendChart 'too plain' (UAT): added per-bar green/amber target coloring, value labels, today-bar outline, weekly total in header, softened dashed target line. User chose the 'color-coded + labels' direction."
metrics:
  completed: "2026-06-15"
  tasks_completed: 2
  files_changed: 6
  uat_rounds: 2
---

# Phase 84 Plan 04: Wire Sections into Dashboard + Human UAT Summary

Wired the three Phase 84 sections into the Dashboard root, relocated the next-release countdown into a combined "Activity & Releases" section (D-16), and added the gitlab-token load mirroring the jira-pat pattern. Human UAT then drove a second iteration that removed the MR queue, fixed an empty-activity date bug, and enriched the trend chart.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire sections + gitlab auth/token + relocate release card | `96b50472` | `dashboard/index.tsx` |
| 2 | Human UAT (real Tauri build) + apply UAT feedback | `053c96c8` | `index.tsx`, `ActivityStrip.tsx(+test)`, `WeeklyTrendChart.tsx`, `MrReviewQueue.*` (deleted) |

## UAT Outcome

Round 1 surfaced three issues; round 2 (approved) confirmed the fixes in a real Tauri build:

1. **MR review queue removed** — DASH-06 descoped per user preference.
2. **Recent activity populated** — date now resolves to the last working day (was empty on Mondays) and reuses the warm Standup cache with zero duplicate requests.
3. **Trend chart enriched** — color-coded bars (green met / amber under 8h), value labels, today highlight, weekly total, softened target line.

## Verification

- `npm run check` (biome + tsc): 0 errors, 22 pre-existing warnings.
- Dashboard test suite: 610 passing (MR-queue tests removed with the component).
- Human UAT: approved in a real Tauri build (layout, populated activity, cache reuse, richer chart, independent degradation).

## Requirement Impact

- **DASH-04** (WeeklyTrendChart) — delivered.
- **DASH-05 / DASH-07** (ActivityStrip newest-first feed, cache reuse, independent degradation) — delivered.
- **DASH-06** (MR review queue) — **descoped** by user decision during UAT (not a gap).

## Self-Check: PASSED
