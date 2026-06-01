---
phase: 75-progressive-issue-detail-rendering
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/75-progressive-issue-detail-rendering/75-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 75: Code Review Fix Report

**Fixed at:** 2026-05-31
**Source review:** .planning/phases/75-progressive-issue-detail-rendering/75-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 .. WR-05; Info findings IN-01..IN-04 and carried-forward prior-INFO items intentionally out of scope)
- Fixed: 5
- Skipped: 0

Each fix was applied in an isolated git worktree, type-checked with `tsc --noEmit`
(no new errors in the touched files), Biome-checked (0 errors / 0 warnings), and
committed atomically. The fix commits were fast-forwarded onto `main`.

## Fixed Issues

### WR-01: CommentsSkeleton and ActivityTimeline empty-state can render simultaneously

**Files modified:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx`
**Commit:** a695af76
**Applied fix:** Converted the sibling `{showCommentsSkeleton && ...}<CommentsSkeleton />`
plus always-rendered `<ActivityTimeline>` into a single mutually-exclusive ternary:
while comments are pending (and not errored) only the `CommentsSkeleton` renders;
otherwise the merged `ActivityTimeline` renders. This removes the "skeleton + No
activity yet" flash that occurred when changelog/worklog had already settled.
The per-section error banners (comments/changelog) remain rendered above the
ternary so error isolation is unchanged.

### WR-04: Subtask enrichment query key omits subtask identity

**Files modified:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx`
**Commit:** 909445c9
**Applied fix:** Added a stable `subtaskSignature` derived from
`(issue?.fields.subtasks ?? []).map(s => s.key).join(',')` and appended it to the
`subtaskEnrichmentQuery` cache key (`['jira-subtask-enrichment', issueKey, jiraBaseUrl, subtaskSignature]`).
A changed subtask set now produces a fresh cache entry rather than reusing stale
enrichment within the 30s staleTime. The two `invalidateQueries` calls that target
this query use the 3-element prefix, which TanStack Query partial-matches against the
longer key, so invalidation behaviour is unchanged. `tsc` confirms `s.key` is a valid
property on the subtask shape.
**Note:** Cache-keying behaviour — recommend a quick manual confirmation that adding/
removing a subtask within the staleTime window now refreshes assignees correctly.
(requires human verification)

### WR-02: Worklog edit/delete mutations do not invalidate the changelog/activity timeline

**Files modified:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx`
**Commit:** 92b1ebc3
**Applied fix:** Added
`queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] })`
to the `onSuccess` handlers of both `worklogEditMutation` and `worklogDeleteMutation`,
matching the transition mutation in FieldsSection. Worklog-related changelog history
in the merged timeline now refreshes after a worklog edit/delete.

### WR-05: Worklog query failure is silently swallowed with no error UI

**Files modified:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx`
**Commit:** ee9de11f
**Applied fix:** Refactored the destructured `{ data: worklogs = [] }` query into a
named `worklogsQuery` (with `const worklogs = worklogsQuery.data ?? [];` preserving the
existing default) and added an inline `<ErrorState viewName="worklogs" ...>` banner gated
on `worklogsQuery.isError`, placed alongside the comments/changelog banners with a retry
that invalidates `['jira-worklogs', issueKey, jiraBaseUrl]`. A failed worklog fetch is now
distinguishable from an issue with genuinely no worklogs, completing the per-section error
isolation contract for all three timeline sources.

### WR-03: `aria-activedescendant` is hardcoded to option 0 and never tracks the highlighted mention

**Files modified:** `taskflow/src/routes/dashboard/MentionPopover.tsx`, `taskflow/src/routes/dashboard/CommentComposer.tsx`
**Commit:** 74412dc1
**Applied fix:** Added an optional `onActiveChange?: (index: number) => void` prop to
`MentionPopover` and a `useEffect` that calls it whenever the internal `activeIndex`
changes (covering Arrow-key navigation, query-reset, and mouse-hover updates). In
`CommentComposer`, added `mentionActiveIndex` state updated via a `useCallback`-stabilised
`handleMentionActiveChange`, wired through the `onActiveChange` prop, and changed
`activeDescendant` from the hardcoded `mention-option-0` to
`mention-option-${mentionActiveIndex}`. The textarea's `aria-activedescendant` now matches
the visually highlighted option for screen readers.

---

_Fixed: 2026-05-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
