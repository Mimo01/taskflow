---
phase: 83-dashboard-stat-tiles-and-sprint-health-chart
plan: 03
subsystem: ui
tags: [react, react-query, recharts, dashboard, jira]

# Dependency graph
requires:
  - phase: 83-01
    provides: dashboardMetrics.ts pure derivation module (tile counts, SP done, donut data, days remaining)
  - phase: 83-02
    provides: StatTile + SprintHealthSection presentational components
provides:
  - Rewritten Dashboard route composing hero + 4 stat tiles + Sprint Health section + release countdown
  - Removal of the legacy 3-card grid (DashboardSprintCard, DashboardInProgressCard) and the SmokeTestChart scaffold
  - Independent per-section loading/error/empty states (DASH-07 across stat tiles and sprint health)
affects: [Phase 84 dashboard trend chart / MR review queue / activity strip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-independent degradation: each Dashboard section owns its skeleton/error/empty state"
    - "Warm-cache read with cold-load fallback: enabled query keyed identically to a Sidebar prefetch dedups when warm, self-fetches once when cold"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/index.test.tsx
    - taskflow/src/routes/dashboard/SprintHealthSection.tsx
  deleted:
    - taskflow/src/routes/dashboard/SmokeTestChart.tsx
    - taskflow/src/routes/dashboard/SmokeTestChart.test.tsx
    - taskflow/src/routes/dashboard/DashboardSprintCard.tsx
    - taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx
    - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
    - taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx

key-decisions:
  - "Active-sprint query enabled (guarded on resolved boardId) instead of enabled:false — fixes a false 'No active sprint' empty state on cold load while preserving zero-new-calls when the Sidebar prefetch warmed the cache (UAT fix, commit ca98232d)"
  - "Single shared ['jira-issues','sprint-board',...] query feeds both the stat tiles and SprintHealthSection via identical cache key (dedup, no second fetch)"

patterns-established:
  - "Per-section independent degradation: stat-tile row and sprint-health section each render their own skeleton/error/empty, so one failing section never blanks the other (DASH-07)"
  - "Identical-key warm-read: a component query sharing key + staleTime with an upstream prefetch fires zero network calls when warm but self-heals (fetches once) when the prefetch never ran"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-07]

# Metrics
duration: ~25min
completed: 2026-06-15
---

# Phase 83 Plan 03: Dashboard Integration Summary

**The Dashboard now renders the hero, a 4-tile stat row, the Sprint Health donut, and the release countdown — the legacy 3-card grid and SmokeTestChart scaffold are gone, and each section degrades independently.**

## Performance

- **Duration:** ~25 min (incl. UAT fix)
- **Tasks:** 3 (2 implementation + 1 human UAT)
- **Files modified:** 3 modified, 6 deleted

## Accomplishments

- Rewrote `dashboard/index.tsx`: retained the gradient hero greeting + en-GB date and the next-release countdown; added the 4-tile stat grid (Open / In Progress / Overdue / SP Done — Overdue turns red when > 0) and the Sprint Health section.
- Deleted the legacy widgets (`SmokeTestChart`, `DashboardSprintCard`, `DashboardInProgressCard`) and their tests; the Phase 83 widget-removal guard assertions turned GREEN (10/10).
- Wired tile-row metrics through `dashboardMetrics` (`computePersonalTileCounts`, `computeSpDone`) and composed `StatTile` / `SprintHealthSection` / `DashboardReleaseCard` in the route body.
- Stat-tile row and Sprint Health section each own their skeleton/error/empty state (DASH-07).

## UAT outcome & fix

Human UAT (task 3) surfaced one real defect: the Sprint Health section rendered **"No active sprint"** even with an active sprint. Root cause: the active-sprint query was `enabled: false`, so it could only read the `['jira-active-sprint', …]` cache populated by the Sidebar prefetch — a key that nothing else in the app writes. When the dashboard loaded without that prefetch firing for the resolved `boardId`, the query stayed `undefined` and the empty state showed falsely.

**Fix (ca98232d):** enabled the query (guarded on a resolved `boardId`). The matching key + `staleTime` still dedups against a warm Sidebar prefetch (DASH-03 "zero new API calls when warm" preserved), but a cold load now self-fetches once instead of showing a false empty state. UAT re-verified: everything works.

## Verification

- Full suite: 1998/1998 passing at integration; dashboard dir 585 passing post-fix
- Widget-removal guard: 10/10 GREEN (Phase 83 block 4/4)
- `npm run check`: 0 errors (20 pre-existing warnings, none new)
- Human UAT in real Tauri WebKit: approved
