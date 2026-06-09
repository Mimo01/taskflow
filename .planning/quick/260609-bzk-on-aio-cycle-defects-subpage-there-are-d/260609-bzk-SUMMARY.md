---
phase: quick-260609-bzk
plan: "01"
subsystem: aio-cycle-detail
tags: [peek-panel, aio, defects, outlet-context]
dependency_graph:
  requires: [phase-77-peek-panel, main.tsx-outlet-context]
  provides: [aio-defect-peek-row-click]
  affects: [AioCycleDetailPage]
tech_stack:
  added: []
  patterns: [useOutletContext for peek callback, DefectRow.onOpen delegation]
key_files:
  modified:
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
decisions:
  - "Used useOutletContext to obtain onOpenIssue — matches BacklogRow and SprintBoardTab pattern throughout the app"
  - "Removed openDefect (navigate to /issue/:key) entirely — PeekPanel handles navigation internally; no breadcrumb push needed at call site"
  - "Triggered By column left as plain text — values are AIO test case keys (e.g. PROJ-TC-42), not Jira issue keys; PeekPanel cannot handle them"
metrics:
  duration: "3min"
  completed: "2026-06-09"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase quick-260609-bzk Plan 01: Wire AIO Cycle Defects to PeekPanel Summary

**One-liner:** Replaced `openDefect` full-page navigate with `onOpenIssue` from OutletContext so defect row-body clicks open the PeekPanel side preview.

## What Was Built

`AioCycleDetailPage.tsx` updated to match the peek pattern used by BacklogRow and SprintBoardTab:

- Added `useOutletContext` to the react-router-dom import
- Extracted `onOpenIssue` from `useOutletContext<{ onOpenIssue: (issueKey: string) => void }>()` near the top of the component function body
- Removed the 4-line `openDefect` function that pushed a breadcrumb and called `navigate('/issue/...')`
- Changed `DefectRow`'s `onOpen` prop from `onOpen={openDefect}` to `onOpen={onOpenIssue}`

The `DefectRow` internal structure is unchanged — the `<tr>` onClick/onKeyDown triggers row-body peek and the key `<NavLink>` with `e.stopPropagation()` still navigates full-page. The "Triggered By" column remains plain text.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire DefectRow row-click to PeekPanel via onOpenIssue | f3bff74b | taskflow/src/routes/dashboard/AioCycleDetailPage.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run check` (biome + tsc): pre-existing errors only (gitlab.ts regex escapes, StandupNotesPage format, update.store/tempo-filters type gaps) — zero errors introduced by this change
- AioCycleDetailPage.tsx: no new biome or tsc errors
- Key NavLink: unchanged, still uses `e.stopPropagation()` for full-page navigate
- Triggered By column: unchanged plain text

## Known Stubs

None.

## Threat Flags

None — `onOpenIssue` is the stable OutletContext callback provided by AppLayout; `issueKey` originates from server-fetched defect data already validated on prior fetch.

## Self-Check: PASSED

- File modified: `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — confirmed exists
- Commit `f3bff74b` — confirmed in git log
