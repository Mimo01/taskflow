---
phase: 75-progressive-issue-detail-rendering
plan: "02"
subsystem: issue-detail-ui
tags: [progressive-rendering, independent-queries, skeletons, perf-instrumentation, tdd-green]
dependency_graph:
  requires:
    - fetchEnrichedSubtasks (taskflow/src/services/jira.ts) — from 75-01
    - fetchIssueChangelog (taskflow/src/services/jira/changelog.ts) — from 75-01
    - CommentsSkeleton / SubtasksSkeleton — from 75-01
    - IssueDetailPage.progressive.test.tsx RED scaffold — from 75-01
  provides:
    - Three independent section queries in IssueDetailPage (comments, subtasks, changelog)
    - Per-section delayed skeletons (200ms gate via useDelayedLoading)
    - Per-section inline ErrorState with retry
    - Global gate removed — only base-fetch failure blanks the panel (D-08)
    - ActivityTimeline changelog prop accepts undefined (skeleton reachable)
    - TTFMP / TTI performance instrumentation
    - Progressive test scaffold turned GREEN (PERF-DETAIL-01/02)
  affects:
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query v5 isPending + useDelayedLoading(isPending) per-section gate
    - Token-outside-key convention (readSecret inside queryFn, never in queryKey)
    - AioTestRunsSection error/skeleton gating order (skeleton → error → content)
    - performance.mark/measure TTFMP and TTI instrumentation
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
decisions:
  - Tasks 1 and 2 committed together because noUnusedLocals=true blocks Task 1 alone (showCommentsSkeleton etc. unused until Task 2 JSX wires them)
  - IssueDetailPage passes enrichedSubtasks={...as never} cast because fetchEnrichedSubtasks return type uses statusCategory:unknown while IssueDetailContent props use statusCategory?:{key:string}; cast is narrowly scoped to the prop boundary
  - ActivityTimeline undefined guard moved before mergeTimeline call (was after) to satisfy TypeScript ChangelogHistory[]|undefined narrowing
  - subtaskListContent() extracted as a free function to avoid IIFE ReactNode inference issue in TypeScript
  - Progressive test stubs IssueDetailSidebar + AioTestRunsSection + CommentComposer — deep sub-trees have unmet mock deps; stubs are additive (no assertions removed)
metrics:
  duration_minutes: 13
  completed_date: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 4
---

# Phase 75 Plan 02: Independent Section Queries + Progressive Rendering — Summary

**One-liner:** Removed global `isLoading || !issue` gate; wired three independent `useQuery` calls (comments, subtasks, changelog) each with a 200ms-gated `useDelayedLoading` skeleton and inline `ErrorState` retry; added TTFMP/TTI performance marks; turned all 3 Wave 0 RED tests GREEN.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1+2 | Three independent queries + global gate removal | a63b58a6 | `IssueDetailPage.tsx`, `ActivityTimeline.tsx` |
| 3 | Subtask skeleton+error in IssueDetailContent; tests GREEN | 02b99708 | `IssueDetailContent.tsx`, `IssueDetailPage.progressive.test.tsx` |

## What Was Built

**Tasks 1+2 — IssueDetailPage.tsx:**
- Added `commentsQuery` (key `['jira-issue-comments', issueKey, jiraBaseUrl]`), `subtaskEnrichmentQuery` (key `['jira-subtask-enrichment', ...]`, enabled only when base has subtasks), `changelogQuery` (key `['jira-issue-changelog', ...]`).
- All three: `staleTime: 30_000`, token read inside `queryFn`, `enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected`.
- `const comments = commentsQuery.data ?? []` replaces `issue?.fields.comment?.comments ?? []`.
- `showCommentsSkeleton`, `showSubtasksSkeleton`, `showChangelogSkeleton` via `useDelayedLoading(query.isPending)`.
- Global gate changed from `isLoading || !issue` to `!issue` (only base failure shows `IssueDetailSkeleton`; base not-found shows panel-level `ErrorState viewName="issue"`).
- `changelog={showChangelogSkeleton ? undefined : changelogQuery.data}` — passes undefined while pending to unlock ActivityTimeline's built-in skeleton.
- `commentsQuery.isError` → inline `ErrorState viewName="comments"` before ActivityTimeline.
- `changelogQuery.isError` → inline `ErrorState viewName="activity"` wrapping ActivityTimeline.
- `performance.mark('issue-detail-start')` on mount; TTFMP mark+measure fires once on first `issue` resolve; TTI mark+measure fires once when all three sections resolve.

**Task 2 partial — ActivityTimeline.tsx:**
- `changelog` prop type changed from `ChangelogHistory[]` to `ChangelogHistory[] | undefined`.
- `changelog === undefined` skeleton guard moved before `mergeTimeline` call (previously unreachable).

**Task 3 — IssueDetailContent.tsx:**
- New props: `enrichedSubtasks`, `showSubtasksSkeleton`, `subtaskError`, `onSubtaskRetry`.
- Subtask section: `SubtasksSkeleton` shown when `enrichedSubtasks === undefined && showSubtasksSkeleton`; `ErrorState viewName="subtasks"` when `subtaskError`; `subtaskListContent()` helper renders enriched data (falls back to base `subtasks`).
- `SubtasksSkeleton` and `ErrorState` imported.
- Pre-existing `queryClient.invalidateQueries({ queryKey: ['issue-detail', issueKey] })` bug not in scope of this plan (tracked separately).

**Test fix — IssueDetailPage.progressive.test.tsx:**
- Added mocks for `IssueDetailSidebar`, `AioTestRunsSection`, `CommentComposer` (stubs returning null) — these sub-trees have deep unmet dependencies irrelevant to progressive rendering assertions.
- Added `isIssueFlagged`, `invalidateGhBacklogData`, `mergeTimeline`, `filterTimeline`, `countByType` to `@/services/jira` mock (needed by FieldsSection before sidebar was stubbed).
- All 3 PERF-DETAIL-01/02 assertions now pass.

## Progressive Test Results

```
PASS  src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  IssueDetailPage — progressive rendering (Wave 0 RED gate)
    ✓ renders issue title when base query resolves but comments query is still pending
    ✓ renders comments-skeleton when comments query is pending and useDelayedLoading returns true
    ✓ renders subtasks-skeleton when subtask enrichment query is pending and useDelayedLoading returns true

Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  605ms
```

Full suite: 148 files / 1661 tests — all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tasks 1+2 committed together**
- **Found during:** Task 1
- **Issue:** `noUnusedLocals: true` in tsconfig makes `showCommentsSkeleton`, `showSubtasksSkeleton`, `showChangelogSkeleton`, and `ErrorState` import cause TS6133 errors in Task 1 before Task 2 wires them into JSX.
- **Fix:** Implemented both tasks before committing, resulting in a single combined commit.
- **Files modified:** `IssueDetailPage.tsx`, `ActivityTimeline.tsx`
- **Commit:** a63b58a6

**2. [Rule 3 - Blocking] ActivityTimeline mergeTimeline call position**
- **Found during:** Task 2
- **Issue:** `mergeTimeline(comments, changelog, worklogs)` was called at line 114 before the `changelog === undefined` guard at line 122, causing TS2345 error since `ChangelogHistory[] | undefined` is not assignable to `ChangelogHistory[]`.
- **Fix:** Moved the `changelog === undefined` skeleton guard before the `mergeTimeline` call.
- **Files modified:** `ActivityTimeline.tsx`
- **Commit:** a63b58a6

**3. [Rule 3 - Blocking] IIFE ReactNode inference**
- **Found during:** Task 3
- **Issue:** TypeScript could not infer the return type of a JSX-returning IIFE as `ReactNode`, producing TS2322.
- **Fix:** Extracted the subtask list render as a `subtaskListContent()` free function with explicit parameter types.
- **Files modified:** `IssueDetailContent.tsx`
- **Commit:** 02b99708

**4. [Rule 3 - Blocking] Progressive test crashing on unmet mock dependencies**
- **Found during:** Task 3
- **Issue:** Removing the global gate causes `IssueDetailSidebar` → `FieldsSection` and `StatusPopover` to render, but those components import `isIssueFlagged`, `useGhTransitions`, etc. from `@/services/jira` — none of which were in the test mock. React threw and produced an empty `<div/>`, failing all 3 tests.
- **Fix:** Added mocks for `IssueDetailSidebar`, `AioTestRunsSection`, `CommentComposer` (null stubs) and added missing `@/services/jira` exports (`isIssueFlagged`, etc.) to the mock. This is additive — no existing assertions removed.
- **Files modified:** `IssueDetailPage.progressive.test.tsx`
- **Commit:** 02b99708

## Known Stubs

None — all three section queries fire real fetches; skeletons show during actual pending state; error states have real retry callbacks.

## Threat Flags

None — pure client-side query orchestration change. No new network endpoints or auth paths introduced. Token read pattern unchanged (inside queryFn, never in keys per T-75-04).

## Self-Check

- [x] `IssueDetailPage.tsx` contains `['jira-issue-comments', ...]`, `['jira-subtask-enrichment', ...]`, `['jira-issue-changelog', ...]` query keys
- [x] `commentsQuery.data ?? []` derivation present; old `issue?.fields.comment?.comments` derivation gone
- [x] `useDelayedLoading(commentsQuery.isPending)` etc. present
- [x] `performance.mark('issue-detail-start')`, `performance.measure('TTFMP'`, `'TTI'` present
- [x] No token in query keys
- [x] `isLoading || !issue` gate removed (0 grep hits)
- [x] `ActivityTimeline` changelog prop type is `ChangelogHistory[] | undefined`
- [x] `ErrorState viewName="comments"` and `viewName="activity"` present in IssueDetailPage
- [x] `SubtasksSkeleton` imported and rendered in IssueDetailContent under `enrichedSubtasks === undefined && showSubtasksSkeleton`
- [x] `ErrorState viewName="subtasks"` present in IssueDetailContent
- [x] All 3 progressive tests GREEN
- [x] `npm run build` passes (tsc + vite)
- [x] Full test suite: 148 files / 1661 tests passing
- [x] Commits: a63b58a6, 02b99708

## Self-Check: PASSED
