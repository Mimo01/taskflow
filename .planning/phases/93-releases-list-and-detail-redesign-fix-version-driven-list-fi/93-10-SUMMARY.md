---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 10
subsystem: releases-list
tags: [releases, f5, ui, gap-closure]
requires: [93-07, 93-08, 93-09]
provides:
  - F5 Releases page composition (hero, timeline band, agenda rail, Released panel)
affects: [93-11]
key-files:
  modified:
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/ReleasesSkeleton.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.deploymentPackage.test.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx
  deleted:
    - taskflow/src/routes/dashboard/releases-list/ReleaseListRow.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseListRow.test.tsx
    - taskflow/src/routes/dashboard/releases-list/columns.ts
decisions:
  - "Released first page is 3 (F5 supersedes D-08's 5); load-more stays 10 and fetches only newly revealed ids"
  - "RM package lookup uses upcoming release dates only; the Released panel shows no package"
metrics:
  completed: 2026-10-30
  tasks: 2
---

# Phase 93 Plan 10: Compose the F5 Releases page Summary

ReleasesTab now renders hero, timeline band, agenda rail, Released panel (F5). All 93-04 guarantees (D-01, D-02, D-09, D-10, D-11, D-12) are kept, and the column-header table code is deleted.

## Commits
- f19a52dd (task 1, task-start commit for task 2): `feat(93-10): F5 Releases page (hero, timeline, agenda rail, released panel)`
- c15d4a8d (task 2): `fix(93-10): F5 visual drift - next card pill/team to the right, quiet date stamp muted`

## What changed
- ReleasesTab: derives `buildAgenda(fixVersions, today)` (no breakdowns, so row weight is fixed before load), `releaseSummary`, `RELEASED_PAGE_SIZE = 3`, `useReleaseBreakdowns({ ..., releasedFirstPage })`. The `['jira-fix-versions', activeJiraProject]` key shape is unchanged. No GitLab references (`grep -ci gitlab` = 0).
- ReleasesSkeleton: band plus 6 rail-shaped rows, no `showPackage` prop.
- Tests rewritten (11 list cases, 3 deployment-package cases): empty state with hero, GitLab-free, agenda order, pills vs timing text, hero summary, 3 -> 13 paging with only revealed ids fetched, D-09 row weight stable across batch arrival, cached revisit, Refresh, navigation from rail row / chip / released row, D-12.
- Deleted ReleaseListRow (+test) and columns.ts; no other importers existed.

## Visual comparison against sketch 002 F5
Throwaway vite page in the scratchpad with placeholder data (not committed). Screenshots:
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-1100-light.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-1100-dark.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-640-light.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-640-dark.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/sketch-1100.png

Checklist:
1. Hero (curves, 34px title, summary line, no stat strip): pass.
2. Graph band (no card, controls top-right, only next chip has a bar, filled axis dots, no orange, clear space under lowest chip): pass.
3. Rail (grey line, hollow rings, TODAY line, month dividers, next card): fixed in c15d4a8d. The next card had the pill beside the title and the team on the left; the sketch puts the pill and team at the right. The quiet date stamp was bold/foreground; the sketch uses muted medium 12px. Columns 150/70/100 and pill-only-on-key-rows: pass.
4. Released panel (muted, green header, 3 rows, Show older releases): pass.
5. 640px (no in-cell wrapping, team column drops, graph shows 3 weeks): pass.
6. Dark mode (rings, pills, green text legible): pass.

Known fixture artifacts (not product drift): rows without a breakdown show a dash, and a duplicate axis date label appears because the placeholder overdue and released versions share 20 Oct.

## Deviations from Plan
- **[Setup]** Worktree base was reset to 45d2a933 (it started on 89f0de36, an ancestor). node_modules was symlinked.
- **[Rule 3]** `Show older releases` is asserted by role name regex; the paging test asserts the id sets by size and by matching the visible rows instead of by hard-coded id order, because the released list is sorted by date.
- No other deviations.

## Known Stubs
None.

## Threat Flags
None. Placeholder data only in the scratchpad; no `dangerouslySetInnerHTML`; no GitLab imports in ReleasesTab (T-93-26); only revealed released ids are fetched (T-93-27, asserted in test).

## Self-Check: PASSED
Full vitest suite passed in the pre-commit hook for both commits; tsc and biome clean on touched files; no PNG/HTML files were committed.
