---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
plan: "03"
subsystem: ui
tags: [react, tanstack-query, jira, gitlab, dashboard]

# Dependency graph
requires:
  - phase: 07-story-subtask-hierarchy-mr-subtask-filter
    provides: fetchMyTasksHierarchy service function (plan 07-02) and MrAttentionTab query foundation (plan 05-03)
provides:
  - MrRow with optional viaSubtaskKey prop rendering muted "via [key]" label
  - MrAttentionTab cache-first subtask derivation via my-tasks cache
  - MrAttentionTab extended MR list including reviewer MRs linked to user's subtask stories
  - Subtask-linked MRs bypass reviewer unresolved-discussion filter
affects: [mr-attention, my-tasks-tab, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache-first + fallback query: queryClient.getQueryData for hot path, useQuery with enabled: !cached for cold path"
    - "Query returns {filtered, merged} to expose pre-filter pool to downstream memos without re-fetching"
    - "mrViaSubtaskKey map: only marks MRs that entered list exclusively via subtask path (not sprint-linked)"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/MrRow.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx

key-decisions:
  - "queryFn return shape changed from MR[] to {filtered: MR[], merged: MR[]} so subtask extension memo can access pre-filter pool without re-fetching"
  - "Subtask story key detection uses issue.fields.issuetype.subtask boolean (not name) per project convention"
  - "viaSubtaskKey only set when linkMRToTask(mr, sprintIssueKeySet) returns null — MRs already sprint-linked show no via label"
  - "Test helper renderWithQueryAndUser pre-populates gitlab-current-user cache to ensure userId is available on first MR query run"
  - "First-alphabetical subtask key used as viaSubtaskKey when user has multiple subtasks under same story"

patterns-established:
  - "Cache-first subtask data: read from queryClient cache first, fire fallback query only when cache empty"
  - "Memo extension pattern: extend base query data in a useMemo rather than inside queryFn to avoid stale closure issues"

requirements-completed: [MRAT-01, MRAT-02]

# Metrics
duration: 10min
completed: 2026-03-13
---

# Phase 7 Plan 03: Story/Subtask Hierarchy MR Filter Summary

**MrAttentionTab now includes reviewer MRs linked to stories where the user has subtasks, with cache-first my-tasks data and muted "via [subtask-key]" labels on subtask-only-path MRs**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-13T00:34:00Z
- **Completed:** 2026-03-13T00:44:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- MrRow extended with optional `viaSubtaskKey` prop rendering muted "via PROJ-101" label after linked task badge
- MrAttentionTab reads my-tasks cache (shared with MyTasksTab) first; fires fallback `fetchMyTasksHierarchy` query only when cache is empty
- Reviewer MRs linked to subtask-story keys are included unconditionally (bypass unresolved-discussion filter)
- "via" label only appears on MRs that entered the list exclusively via subtask path — sprint/assigned-path MRs are unaffected
- 4 new MRAT-02 tests covering inclusion, via label, no-via on sprint path, and graceful fallback — all green

## Task Commits

1. **Task 1: Add viaSubtaskKey prop to MrRow** - `5b6f59b` (feat)
2. **Task 2 RED: Add failing MRAT-02 tests** - `fbdd0a5` (test)
3. **Task 2 GREEN: MrAttentionTab MRAT-02 implementation** - `61f7650` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/MrRow.tsx` - Added `viaSubtaskKey?: string` prop and muted label render
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` - Cache-first subtask derivation, extended MR list, mrViaSubtaskKey memo, viaSubtaskKey prop passed to MrRow
- `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` - 4 new MRAT-02 tests, renderWithQueryAndUser helper, storyPointsFieldKey in settings mock

## Decisions Made
- Changed queryFn return type from `MR[]` to `{filtered: MR[], merged: MR[]}` so the post-query subtask extension memo can access the full pre-filter pool without re-fetching. This avoids stale closure issues if subtask keys were captured inside the queryFn.
- Test helper `renderWithQueryAndUser` pre-populates the `gitlab-current-user` query cache so `userId` is available on the first MR query run. Without this, reviewer MRs would be skipped on the first fetch (userId undefined) and never retrieved.
- `viaSubtaskKey` check: `linkMRToTask(mr, sprintIssueKeySet) === null` before checking subtask link — ensures sprint-linked MRs never get the "via" label even if their story is also a subtask parent.

## Deviations from Plan

None — plan executed exactly as written, with one test infrastructure addition (renderWithQueryAndUser helper) to handle the async userId initialization behavior discovered during TDD.

## Issues Encountered
- Reviewer MRs require `userId` to be fetched before they appear. In tests, the `validateGitLab` query resolves asynchronously and `userId` is undefined on first render. The fix was a test-side `renderWithQueryAndUser` helper that pre-populates the userId cache — this reflects real app behavior where MyTasksTab always loads before MrAttentionTab.

## Next Phase Readiness
- MRAT-01 and MRAT-02 requirements complete
- MrRow viaSubtaskKey prop ready for any future subtask-path labeling use
- MyTasksTab cache sharing pattern established and working

---
*Phase: 07-story-subtask-hierarchy-mr-subtask-filter*
*Completed: 2026-03-13*
