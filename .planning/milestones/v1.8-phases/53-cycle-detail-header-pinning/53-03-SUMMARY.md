---
phase: 53-cycle-detail-header-pinning
plan: "03"
subsystem: header-pinning
tags: [zustand, react-query, discriminated-union, pinned-tabs, navigation]
dependency_graph:
  requires:
    - "53-01 (AioCycleDetailPage route + setPinnedCycleMeta calls)"
    - "53-02 (pinnedCycleMeta store field + PinnedTabStrip resolvedTabs prop)"
  provides:
    - "main.tsx wiring: cycle keys bypass useQueries, resolvedPinnedTabs discriminated union, activeCycleKey derivation, cycle tab click navigation"
  affects:
    - taskflow/src/main.tsx
tech-stack:
  added: []
  patterns:
    - "Key-type discrimination via k.includes('-CY-') filter for issue vs cycle routing"
    - "Index alignment: issuePinnedKeys.forEach((key, i) => pinnedQueries[i]) — i maps into filtered array not full pinnedKeys"
    - "Null-coalescing active key: activeIssueKey ?? activeCycleKey for multi-route tab highlight"

key-files:
  created: []
  modified:
    - taskflow/src/main.tsx

key-decisions:
  - "Local IssueTab/CycleTab type aliases defined in main.tsx (not imported) — PinnedTabStrip does not export them"
  - "Cycle keys filter uses includes('-CY-') per D-01 (structural distinction from issue keys)"
  - "activeCycleKey uses split('/')[3] — pathname /aio-cycle/:projectKey/:cycleKey gives index 3 as cycleKey"

patterns-established:
  - "Pinned key split pattern: issuePinnedKeys/cyclePinnedKeys derived via filter before any query hooks"

requirements-completed: [AIOP-01, AIOP-02, AIOP-03]

duration: ~5min
completed: 2026-05-13
---

# Phase 53 Plan 03: Header Tab Strip Wiring Summary

**Six targeted edits to main.tsx integrate cycle tabs into the pinned header strip: cycle keys bypass useQueries, discriminated union map feeds PinnedTabStrip's resolvedTabs prop, activeCycleKey enables tab highlight on /aio-cycle/ routes, and click handler navigates to the correct cycle detail route.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T13:00:00Z
- **Completed:** 2026-05-13T13:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Cycle keys are now split out of `pinnedKeys` via `issuePinnedKeys`/`cyclePinnedKeys` filter before `useQueries` — no React Query request fires for cycle keys
- `resolvedPinnedTabs` is now a `Map<string, IssueTab | CycleTab>` discriminated union; issue tab index `i` correctly aligns with `issuePinnedKeys` (not `pinnedKeys`) preventing query misalignment
- `activeCycleKey` derived from `location.pathname.split('/')[3]` highlights the correct tab when on `/aio-cycle/:projectKey/:cycleKey`
- `PinnedTabStrip` receives `activeKey={activeIssueKey ?? activeCycleKey}` and `resolvedTabs={resolvedPinnedTabs}` — old `resolvedIssues` prop is fully gone
- Click handler on cycle tabs navigates to `/aio-cycle/${meta.projectKey}/${key}` using store metadata; issue tab clicks unchanged

## Task Commits

1. **Task 1: Six surgical changes to main.tsx** - `329177e` (feat)

## Files Created/Modified

- `taskflow/src/main.tsx` — Added pinnedCycleMeta selector, issuePinnedKeys/cyclePinnedKeys split, IssueTab/CycleTab local types, discriminated union resolvedPinnedTabs map, activeCycleKey derivation, updated PinnedTabStrip props and onTabClick handler

## Decisions Made

- `IssueTab` and `CycleTab` types defined locally in main.tsx (lines before resolvedPinnedTabs) rather than imported from PinnedTabStrip — the component does not export them
- Cycle key detection uses `k.includes('-CY-')` string test, consistent with the pattern established in D-01 and used throughout the codebase
- `activeCycleKey` uses `split('/')[3]` (not a regex or replace) — simplest correct derivation for the fixed route shape `/aio-cycle/:projectKey/:cycleKey`

## Deviations from Plan

None — plan executed exactly as written. All six change points applied in the order specified.

## Issues Encountered

None. TypeScript compiled clean on all implementation files. The single test failure (`UpdateDialog.test.tsx` — `plugin:process|relaunch` vs `restart`) is a pre-existing failure present before this plan and unrelated to these changes (documented in 53-02 SUMMARY).

## Known Stubs

None. All six wiring points are fully implemented. The `resolvedIssues` prop reference that was the intentional Wave 2 gap (noted in 53-02 SUMMARY) is now resolved.

## Threat Flags

No new security surface. `activeCycleKey` is used only for tab highlight comparison (no API call). The `navigate()` call in the click handler uses store-resident metadata set at pin time by an authenticated user action (T-53-03-01 mitigated as designed).

## Next Phase Readiness

Phase 53 Wave 2 is complete. The full cycle pinning feature is wired end-to-end:
- 53-01: AioCycleDetailPage with pin button calling setPinnedCycleMeta
- 53-02: Store with pinnedCycleMeta field + PinnedTabStrip with resolvedTabs prop
- 53-03: main.tsx wiring connecting all three layers

Pinned cycle tabs appear in the header strip, persist across restarts (Zustand persist v1), highlight on the cycle detail page, and navigate correctly on click.

## Self-Check: PASSED

- [x] `taskflow/src/main.tsx` contains `issuePinnedKeys` and `cyclePinnedKeys` — CONFIRMED (lines 164–165)
- [x] `useQueries` drives off `issuePinnedKeys.map(` — CONFIRMED (line 172)
- [x] `issuePinnedKeys.forEach((key, i) =>` in resolvedPinnedTabs build — CONFIRMED (line 193)
- [x] `cyclePinnedKeys.forEach((key) =>` in resolvedPinnedTabs build — CONFIRMED (line 205)
- [x] `activeCycleKey` derived from `split('/')[3]` — CONFIRMED (line 299)
- [x] `activeKey={activeIssueKey ?? activeCycleKey}` in PinnedTabStrip JSX — CONFIRMED (line 513)
- [x] `resolvedTabs={resolvedPinnedTabs}` in PinnedTabStrip JSX — CONFIRMED (line 524)
- [x] `key.includes('-CY-')` in onTabClick handler — CONFIRMED (line 516)
- [x] `resolvedIssues` count in main.tsx = 0 — CONFIRMED
- [x] TypeScript compiles without errors on implementation files — CONFIRMED (pre-existing test file warning only)
- [x] Commit `329177e` exists — CONFIRMED

---
*Phase: 53-cycle-detail-header-pinning*
*Completed: 2026-05-13*
