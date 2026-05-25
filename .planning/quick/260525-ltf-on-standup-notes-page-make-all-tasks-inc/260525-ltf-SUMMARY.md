---
phase: quick-260525-ltf
plan: 01
subsystem: standup-notes
tags: [navigation, mr-click, standup, outlet-context]
dependency_graph:
  requires: []
  provides: [onMRClick in Outlet context, clickable MR rows on Standup page]
  affects: [StandupNotesPage, TodayColumn, YesterdayColumn, all standup section components]
tech_stack:
  added: []
  patterns: [role=button clickable row pattern (hover/cursor/focus-ring), Outlet context prop threading]
key_files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/standup-notes/mrMatching.ts
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
    - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
    - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
    - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
    - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
decisions:
  - Reused the existing handleMRClick handler from main.tsx via Outlet context rather than re-implementing per page
  - Added projectId to NestedMr (mrMatching.ts) to carry project context through nested MR rows
  - Applied the existing IssueRow clickable pattern (role=button, tabIndex=0, hover/cursor/focus-ring) identically to all MR rows
metrics:
  duration: ~15 minutes
  completed: 2026-05-25
  tasks_completed: 3
  tasks_total: 3
  files_modified: 10
---

# Phase quick-260525-ltf Plan 01: Clickable MR Rows on Standup Notes Page Summary

All MR rows on the Standup Notes page are now clickable, navigating to `/mr/:projectId/:iid` using the shared `handleMRClick` handler exposed through the Outlet context.

## What Was Built

- **onMRClick in Outlet context** (`main.tsx`): The existing `handleMRClick` handler (which already powered the TopBar MR search) is now also passed as `onMRClick` in the `<Outlet context={...}>` object, making it accessible to all child routes including standup pages.

- **NestedMr.projectId** (`mrMatching.ts`): Added `projectId: number` to the `NestedMr` interface. Populated from `mr.project_id` for reviewer MRs and `mr.projectId` for participating MRs. This allows nested MR rows under sprint stories to construct the correct navigation path.

- **Today column — nested MR rows** (`TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`): `NestedMrRow` converted from a static div to a `role="button"` with `tabIndex={0}`, hover/cursor/focus-ring classes, and click/keydown handlers calling `onMRClick(`${mr.projectId}/${mr.iid}`)`.

- **Today column — MRs Awaiting You** (`TodayMrsSection.tsx`): Each reviewer MR row is now a clickable button calling `onMRClick(`${mr.project_id}/${mr.iid}`)`. Review state label and icon preserved.

- **Today column — Participating MRs** (`TodayParticipatingSection.tsx`): Each participating MR row is now a clickable button calling `onMRClick(`${mr.projectId}/${mr.mrIid}`)`. Open-threads / not-approved labels preserved.

- **Yesterday column — standalone MR groups** (`YesterdayColumn.tsx`, `StandaloneMrGroup.tsx`): `StandaloneMrGroupData` gains `projectId: number` sourced from `event.project_id`. The group header row (the `!{iid} {title}` line) is now a clickable button calling `onMRClick(`${projectId}/${iid}`)`. Collapsed comment/approval sub-items remain non-interactive.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Expose onMRClick in Outlet context; add projectId to NestedMr | a3aa7141 |
| 2 | Make all Today-column MR rows clickable | c40eb71b |
| 3 | Make Yesterday standalone MR groups clickable | 0d984cdd |

## Verification

- `tsc --noEmit`: exit 0, no type errors
- `vitest run src/routes/standup-notes`: 8 test files, 60 tests, all passed
- `npm run build`: succeeded (4.37s)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all MR rows are fully wired to navigate using real `projectId` and `iid` values from the data sources.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check

- [x] taskflow/src/main.tsx — exists, contains `onMRClick: handleMRClick`
- [x] taskflow/src/routes/standup-notes/mrMatching.ts — exists, NestedMr has `projectId`
- [x] taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx — exists, header row is role=button
- [x] Commits a3aa7141, c40eb71b, 0d984cdd — present in git log

## Self-Check: PASSED
