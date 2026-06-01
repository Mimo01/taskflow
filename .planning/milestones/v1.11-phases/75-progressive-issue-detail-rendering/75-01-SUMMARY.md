---
phase: 75-progressive-issue-detail-rendering
plan: "01"
subsystem: jira-service / issue-detail-ui / test-scaffold
tags: [service-decomposition, progressive-rendering, skeletons, tdd-red]
dependency_graph:
  requires: []
  provides:
    - fetchIssueChangelog (taskflow/src/services/jira/changelog.ts)
    - fetchEnrichedSubtasks (taskflow/src/services/jira.ts)
    - slimmed fetchIssueDetail (no comment, no expand=changelog, no inline enrichment)
    - CommentsSkeleton (taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx)
    - SubtasksSkeleton (taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx)
    - Wave0 RED test scaffold (IssueDetailPage.progressive.test.tsx)
  affects:
    - taskflow/src/services/jira.ts (fetchIssueDetail slimmed)
    - consumers of fetchIssueDetail (will see no comment/changelog in response after 75-02)
tech_stack:
  added: []
  patterns:
    - apiFetch + ApiError pattern (mirrors comments.ts exactly)
    - UI-SPEC skeleton dimensions (h-6 heading + section rows)
    - vi.mock-first TDD RED scaffold (mirrors AioTestRunsSection.test.tsx)
key_files:
  created:
    - taskflow/src/services/jira/changelog.ts
    - taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx
    - taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  modified:
    - taskflow/src/services/jira.ts
decisions:
  - fetchIssueChangelog lives in jira/changelog.ts (mirrors comments.ts / worklogs.ts pattern) and imports ChangelogHistory from the existing jira-changelog.ts type file
  - fetchEnrichedSubtasks stays in jira.ts (not a separate module) to keep the extraction minimal; plan D-04 says do not over-split
  - Test scaffold imports fetchComments from @/services/jira/comments (the existing function) and fetchIssueChangelog from @/services/jira/changelog (the new file) — both are mocked so the test structure is correct regardless of page wiring
metrics:
  duration_minutes: 22
  completed_date: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 75 Plan 01: Data-Layer Decomposition — Summary

**One-liner:** Extracted `fetchIssueChangelog` (REST v2 expand=changelog), `fetchEnrichedSubtasks` (JQL assignee lookup), and slimmed `fetchIssueDetail` (no comment/changelog/inline enrichment), plus two UI-SPEC skeletons and a Wave 0 RED test scaffold.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Decompose fetchIssueDetail | 98052cca | `jira/changelog.ts` (new), `jira.ts` (modified) |
| 2 | Create CommentsSkeleton and SubtasksSkeleton | da11dac1 | `CommentsSkeleton.tsx` (new), `SubtasksSkeleton.tsx` (new) |
| 3 | Wave 0 failing progressive-rendering test scaffold | 69c058b9 | `IssueDetailPage.progressive.test.tsx` (new) |

## What Was Built

**Task 1 — Service decomposition:**
- `taskflow/src/services/jira/changelog.ts`: exports `fetchIssueChangelog(baseUrl, token, issueKey): Promise<ChangelogHistory[]>`. Uses REST v2 `?expand=changelog&fields=summary`. Mirrors `comments.ts` exactly: try/catch around apiFetch for network errors; 401/403 → ApiError; throws on all failures (primary section). Imports `ChangelogHistory` from the existing `../jira-changelog` module (type re-used, not redefined).
- `taskflow/src/services/jira.ts`: added `fetchEnrichedSubtasks(baseUrl, token, subtasks)` — extracted verbatim from the inline block, returns unenriched subtasks on `!ok` (non-critical). `fetchIssueDetail` had `'comment'` removed from fields array and `&expand=changelog` removed from URL; the inline `if (issue.fields.subtasks?.length > 0)` enrichment block removed. `'subtasks'` field remains in the base fetch (keys + count for skeletons).

**Task 2 — Skeletons:**
- `CommentsSkeleton`: `space-y-3`, `data-testid="comments-skeleton"`, `h-6 w-32` heading + three `h-10 w-full` rows. No font-semibold.
- `SubtasksSkeleton`: `space-y-2`, `data-testid="subtasks-skeleton"`, `h-6 w-40` heading + two `h-8 w-full` rows. No font-semibold.

**Task 3 — Wave 0 RED test scaffold:**
- `IssueDetailPage.progressive.test.tsx`: vi.mock-first structure, three RED tests covering PERF-DETAIL-01 (header renders when base resolves, comments pending) and PERF-DETAIL-02 (comments-skeleton and subtasks-skeleton shown when queries pending + useDelayedLoading true). All 3 fail as expected.

## Wave 0 RED Test Output

```
 FAIL  src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  IssueDetailPage — progressive rendering (Wave 0 RED gate)
    × renders issue title when base query resolves but comments query is still pending
    × renders comments-skeleton when comments query is pending and useDelayedLoading returns true
    × renders subtasks-skeleton when subtask enrichment query is pending and useDelayedLoading returns true

 Test Files  1 failed (1)
       Tests  3 failed (3)
    Duration  3.86s
```

Failure reason: `Unable to find an element with the text: Test issue title` — the page still uses the global `isLoading || !issue` gate and does not have independent queries for comments/subtasks/changelog. These tests turn GREEN after 75-02 wires the independent queries.

Rest of suite: 147 files / 1658 tests — all passing, unaffected.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates service functions and UI primitives; no data is flowing to consumers yet (that is 75-02).

## Self-Check

- [x] `taskflow/src/services/jira/changelog.ts` exists and exports `fetchIssueChangelog`
- [x] `taskflow/src/services/jira.ts` exports `fetchEnrichedSubtasks`; `fetchIssueDetail` has no `'comment'` field, no `expand=changelog`, no inline enrichment block
- [x] `CommentsSkeleton.tsx` and `SubtasksSkeleton.tsx` exist at correct dimensions
- [x] `IssueDetailPage.progressive.test.tsx` exists, mocks `@/services/jira/comments` and `@/services/jira/changelog`, asserts `comments-skeleton` and `subtasks-skeleton`, all 3 tests RED
- [x] Build green (tsc + vite) after Task 1 and Task 2
- [x] No greenhopper reference in `jira/changelog.ts` (GH-CUT-01)
- [x] Commits: 98052cca, da11dac1, 69c058b9
