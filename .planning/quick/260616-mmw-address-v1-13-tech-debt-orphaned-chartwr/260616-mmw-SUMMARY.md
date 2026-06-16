---
phase: quick-260616-mmw
plan: 01
subsystem: codebase-hygiene
tags: [dead-code, tech-debt, requirements, comments, v1.13-audit]
dependency_graph:
  requires: []
  provides: [clean-v1.13-codebase]
  affects: [taskflow/src/components, taskflow/src/services/jira, taskflow/src/lib, taskflow/src/routes/dashboard, .planning/REQUIREMENTS.md]
tech_stack:
  added: []
  patterns: []
key_files:
  deleted:
    - taskflow/src/components/chart-wrapper.tsx
    - taskflow/src/components/chart-wrapper.test.tsx
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/greenhopper/types.ts
    - taskflow/src/lib/my-tasks-sort.ts
    - taskflow/src/lib/my-tasks-sort.test.ts
    - taskflow/src/routes/dashboard/MyIssuesCard.tsx
    - taskflow/src/routes/dashboard/HoursCommitsChart.tsx
    - .planning/REQUIREMENTS.md
decisions:
  - W-02 (jira-release-issues cold-cache in UpcomingReleasesTimeline) explicitly deferred — requires query key/endpoint shape change that carries real behavioral risk
metrics:
  duration: ~15 minutes
  completed: 2026-06-16
---

# Phase quick-260616-mmw Plan 01: v1.13 Tech Debt — Orphaned Dead Code Cleanup Summary

**One-liner:** Deleted ChartWrapper component + burndown types + deriveCounts (all zero live consumers), corrected two Phase-86-stale cache-sharing comments, and reconciled REQUIREMENTS.md with INSIGHT-01/02 retirements and Phase 82 UAT reductions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete orphaned ChartWrapper, burndown types, deriveCounts | 34937814, b3c2bba1 | chart-wrapper.tsx (del), chart-wrapper.test.tsx (del), jira.ts, greenhopper/types.ts, my-tasks-sort.ts, my-tasks-sort.test.ts |
| 2 | Rewrite two stale cache-sharing comments | 299e6844 | MyIssuesCard.tsx, HoursCommitsChart.tsx |
| 3 | Reconcile REQUIREMENTS.md traceability + run full gate | 02312626 | .planning/REQUIREMENTS.md |

## What Was Done

### Task 1 — Dead Code Deletions (W-01, W-05, Phase 82 debt)

**W-01 (ChartWrapper):** Deleted `chart-wrapper.tsx` and `chart-wrapper.test.tsx` outright. The component had zero live consumers after the Phase 86 dashboard redesign replaced all uses with direct `ChartContainer` (shadcn) usage. Removing 4 test cases (loading, success, error, recharts integration).

**W-05 (Burndown types):** Removed `BurndownChangeEntry` and `GreenHopperBurndown` from the `export type { ... } from './jira/greenhopper'` re-export block in `jira.ts`. Deleted both interface definitions (plus their leading doc-comment blocks, ~89 lines) from `greenhopper/types.ts`. Their sole former consumer (`BurndownChart.tsx` + `parseBurndownChanges`) was deleted in Phase 86 D-01. The `greenhopper/index.ts` barrel uses `export * from './types'` (wildcard) — no edit needed there.

**Phase 82 debt (deriveCounts):** Deleted the `MyTaskCounts` interface and `deriveCounts` export function (~59 lines) from `my-tasks-sort.ts`. Removed the `deriveCounts` import and the entire `// --- deriveCounts ---` describe block (7 test cases, ~72 lines) from `my-tasks-sort.test.ts`. The function was superseded when `MyTasksPage` adopted inline count derivation in Phase 82.

Post-deletion biome format fixes committed separately (b3c2bba1): collapsed 4-name import to single line, removed trailing blank lines.

### Task 2 — Stale Cache-Sharing Comments (W-03, W-04)

**W-04 (MyIssuesCard.tsx):** Two comments named `SprintHealthSection / SprintBoardTab` as the cache-share partner. SprintHealthSection was deleted in Phase 86; SprintBoardTab uses a different key. Rewrote both the file-header doc-comment and the inline comment to correctly name `dashboard/index.tsx` warm-up query as the cache producer.

**W-03 (HoursCommitsChart.tsx):** Header comment claimed commits query was "same as ActivityStrip". ActivityStrip was deleted in Phase 86. Rewrote header and inline comment to accurately describe cold-cache commit queries (useQueries × 7) that only incidentally share key structure with StandupNotesPage — no warm-cache guarantee. No query keys or runtime behavior changed.

### Task 3 — REQUIREMENTS.md Reconciliation

- **INSIGHT-01/02:** Changed `- [ ]` to `- [~]`, struck through original text, appended RETIRED note. Updated traceability table status cells from "Pending (Conditional)" to "Retired (Phase 86 D-01)".
- **MYTASK-06:** Added inline note that right-click context menu was removed at Phase 82 UAT; inline actions retained.
- **MYTASK-08:** Added inline note that grouping switcher was removed at Phase 82 UAT; always My Day grouping; scope preference still persists.
- Coverage totals unchanged (20/20 mapped). Updated last-updated line with v1.13 audit reconciliation note.

## Gate Results

- `npm run check` (biome + tsc): GREEN — 0 errors, 17 pre-existing warnings (all in `chart.tsx` and `MyTasksPage.tsx`, unrelated to this task)
- `npm test` (vitest): GREEN — 163 test files passed, 1997 tests passed, 2 skipped, 13 todo

## Deviations from Plan

None — plan executed exactly as written.

W-02 (`jira-release-issues` cold-cache in UpcomingReleasesTimeline) is intentionally deferred per plan objective. Not touched.

## Known Stubs

None. All deletions are pure dead-code removal with zero behavior change to shipped components.

## Threat Flags

None. All changes are dead-code deletions, comment corrections, and documentation metadata edits. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check

### Files deleted
- [x] `taskflow/src/components/chart-wrapper.tsx` — confirmed deleted (git rm)
- [x] `taskflow/src/components/chart-wrapper.test.tsx` — confirmed deleted (git rm)

### Zero references
- [x] `grep -rn "ChartWrapper|GreenHopperBurndown|BurndownChangeEntry|deriveCounts|MyTaskCounts" taskflow/src` → exit 1 (no matches)
- [x] `grep -rln "SprintHealthSection|same as ActivityStrip" MyIssuesCard.tsx HoursCommitsChart.tsx` → exit 1 (no matches in target files)

### Commits exist
- [x] 34937814 — Task 1 dead-code deletions
- [x] b3c2bba1 — Task 1 biome format fixes
- [x] 299e6844 — Task 2 comment corrections
- [x] 02312626 — Task 3 REQUIREMENTS.md reconciliation

## Self-Check: PASSED
