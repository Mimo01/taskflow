---
phase: 75-progressive-issue-detail-rendering
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/changelog.ts
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx
  - taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 75: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 75 split the monolithic `fetchIssueDetail` call into three independent parallel queries
(comments, subtask enrichment, changelog) with per-section skeletons, per-section error/retry UI,
and TTFMP/TTI perf instrumentation. The structural split is sound and the query key shapes are
consistent across invalidation call sites. Two critical defects were found: the TTI measurement
permanently blocks for issues with zero subtasks (TanStack Query v5 `isPending` semantics for
disabled queries), and delete-comment errors are silently swallowed by a wrong gate in
`ActivityTimeline`. Four warnings cover a stale `comment` field reference in `IssueDetailContent`,
a missing subtask list in the enrichment query key, a `console.table` left in production code, and
comments failure hiding the changelog panel entirely.

---

## Critical Issues

### CR-01: TTI measurement never fires for issues with zero subtasks

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:185-202`

**Issue:** In TanStack Query v5, a `useQuery` with `enabled: false` and no cached data has
`status: 'pending'` (confirmed: `getDefaultState` returns `status: hasData ? "success" : "pending"`
and the query never transitions out of that state while disabled). The `subtaskEnrichmentQuery` is
disabled when `issue.fields.subtasks.length === 0`, so `subtaskEnrichmentQuery.isPending` stays
`true` permanently for issues with no subtasks. The TTI `useEffect` gates on
`!subtaskEnrichmentQuery.isPending`, so `performance.measure('TTI', ...)` never executes and
`performance.mark('issue-detail-fully-loaded')` is never written. This silently breaks all TTI
measurements on the majority of issues (stories with no subtasks, epics, bugs, etc.).

**Fix:**
```tsx
// Replace the isPending gate with fetchStatus:
// A disabled query has fetchStatus='idle'; a running query has fetchStatus='fetching'.
// isPending only means "no data yet", not "currently loading".

const subtaskDone =
  (issue?.fields.subtasks?.length ?? 0) === 0   // no subtasks — skip enrichment
  || !subtaskEnrichmentQuery.isPending;          // or enrichment has data/error

useEffect(() => {
  if (
    issue &&
    !commentsQuery.isPending &&
    !changelogQuery.isPending &&
    subtaskDone &&
    !ttiFiredRef.current
  ) {
    ttiFiredRef.current = true;
    performance.mark('issue-detail-fully-loaded');
    try {
      performance.measure('TTI', 'issue-detail-start', 'issue-detail-fully-loaded');
    } catch {
      // HMR / missing start mark
    }
  }
}, [issue, commentsQuery.isPending, changelogQuery.isPending, subtaskDone]);
```

---

### CR-02: Delete-comment errors are silently discarded

**File:** `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx:217`

**Issue:** `ActivityTimeline` passes `deleteError` to each `CommentCard` gated on `isEditing`:

```tsx
deleteError={isEditing ? deleteError : null}
```

`isEditing` is `editingCommentId === comment.id` — it is `true` only when the user has opened the
_edit_ form for that comment. A delete failure sets `deleteError` (via `deleteMutation.onError`) but
never sets `editingCommentId`, so `isEditing` is `false` and `deleteError` is passed as `null` to
every `CommentCard`. `CommentCard` then gates the error display on `deleteError && deletingCommentId
=== comment.id` (line 748), which is also dead because `deleteError` is always `null` here. The
user receives no feedback when deleting a comment fails.

**Fix:**
```tsx
// In ActivityTimeline, pass deleteError independently of the edit state:
deleteError={deletingCommentId === comment.id ? deleteError : null}
```
`deletingCommentId` (`deleteMutation.variables ?? null`) already identifies the target comment
correctly.

---

## Warnings

### WR-01: `IssueDetailContent` reads `issue.fields.comment` that is no longer fetched

**File:** `taskflow/src/routes/dashboard/IssueDetailContent.tsx:155`

**Issue:** Phase 75 removed `'comment'` from the `fields=` list in `fetchIssueDetail`
(confirmed via `git diff`). `JiraIssueDetail` still declares `comment: { comments: JiraComment[] }`
in its type, but the field will be absent from the API response. Line 155 reads:

```tsx
const comments = issue.fields.comment?.comments ?? [];
```

This safely falls back to `[]`, but the resulting `comments` array is used to seed `initialUserMap`
(lines 193-200) with comment author names for the description `WikiRenderer`'s `@mention` resolution.
An empty comment list means `@mention` expansion in issue descriptions will silently fail for any
author whose name is not already in the map from assignee/reporter. This is a functional regression
in wiki rendering for issues with author mentions.

**Fix:** Feed the live `commentsQuery.data` into `IssueDetailContent` via prop (it is already
available in `IssueDetailPage`) and remove the stale `issue.fields.comment?.comments` fallback, or
re-add `'comment'` to `fetchIssueDetail`'s field list if the inline payload is still desired for
the description user map. The `IssueDetailContentProps` interface already has all the machinery;
this is a one-prop addition.

---

### WR-02: Subtask enrichment query key does not encode the subtask list

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:133`

**Issue:** The subtask enrichment query key is `['jira-subtask-enrichment', issueKey, jiraBaseUrl]`.
The `queryFn` reads `issue?.fields.subtasks` from the outer closure. If the base issue is refetched
(e.g. after a `postComment` or `updateField` mutation that calls `invalidateQueries` on
`jira-issue-detail`), the base issue data updates with a new subtask list, but the enrichment query
key is unchanged so React Query serves the stale cached enrichment result. A new subtask added from
another session or via `openAddSubtask` will appear with no assignee data until the user navigates
away and back.

**Fix:**
```tsx
queryKey: [
  'jira-subtask-enrichment',
  issueKey,
  jiraBaseUrl,
  // encode subtask ids so cache busts when the list changes
  (issue?.fields.subtasks ?? []).map((s) => s.id).join(','),
],
```

---

### WR-03: `console.table` left in TTI production code path

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:197`

**Issue:**
```tsx
console.table(performance.getEntriesByType('measure'));
```
This executes in the production build every time TTI is measured (first fully-loaded render of any
issue). It dumps all `performance.measure` entries accumulated during the session — including any
from other parts of the app — into the browser console. In production this is noise and a
potential information disclosure vector in screen-share/demo scenarios.

**Fix:** Remove the `console.table` call. The marks and measures are already written to the
`PerformanceObserver`/DevTools timeline and can be inspected there. The `try/catch` block's error
silencing is still needed for the HMR/missing-mark case; just delete the log line:
```tsx
try {
  performance.measure('TTI', 'issue-detail-start', 'issue-detail-fully-loaded');
} catch {
  // performance.measure may throw if start mark is missing (e.g. HMR)
}
```

---

### WR-04: Comments query error hides the changelog panel entirely

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:517-575`

**Issue:** The rendering tree nests the `changelogQuery.isError` branch and the `ActivityTimeline`
inside the `else` branch of `commentsQuery.isError`:

```tsx
{commentsQuery.isError ? (
  <ErrorState ... viewName="comments" />
) : (
  <>
    {changelogQuery.isError ? (
      <ErrorState ... viewName="activity" />
    ) : (
      <ActivityTimeline ... />
    )}
  </>
)}
```

When the comments query fails (e.g., a permissions issue on the `/comment` endpoint), the entire
activity section — including changelog (status transitions) and worklogs — is replaced by a single
"retry comments" error state. Users lose visibility of all issue history, not just comments. This is
a regression from the pre-phase-75 behavior where a comment fetch failure would not affect changelog
rendering.

**Fix:** Hoist the error states to be siblings, not parents:
```tsx
{commentsQuery.isError && (
  <div className="p-4">
    <ErrorState error={commentsQuery.error} onRetry={...} viewName="comments" />
  </div>
)}
{changelogQuery.isError ? (
  <div className="p-4">
    <ErrorState error={changelogQuery.error} onRetry={...} viewName="activity" />
  </div>
) : (
  <ActivityTimeline
    comments={commentsQuery.isError ? [] : comments}
    ...
  />
)}
```

---

## Info

### IN-01: Duplicate `fetchComments` implementation in `jira.ts` and `jira/comments.ts`

**File:** `taskflow/src/services/jira.ts:703` and `taskflow/src/services/jira/comments.ts:9`

**Issue:** `fetchComments`, `postComment`, `updateComment`, and `deleteComment` are each defined
independently in both `jira.ts` (lines 660–729, 951–1018) and `jira/comments.ts`. Phase 75 added
the submodule but did not remove the duplicates from the barrel. `IssueDetailPage` imports
`fetchComments` from `@/services/jira/comments` (the submodule) while `CommentComposer` imports
`postComment` from `@/services/jira` (the barrel's own copy). If either implementation diverges
(e.g., a pagination fix applied to one but not the other), the bug will appear in only some code
paths. The jira.ts copy of `fetchComments` is also re-exported from the same barrel, creating a
potential name conflict if downstream consumers do `import { fetchComments } from '@/services/jira'`
expecting the submodule version.

**Fix:** Remove the four comment functions from `jira.ts` and replace them with re-exports from
the submodule:
```ts
export { fetchComments, postComment, updateComment, deleteComment } from './jira/comments';
```
Per the project memory note on the jira.ts dual-file pattern, ensure all 60 barrel importers still
resolve correctly after the change.

---

### IN-02: `fetchIssueChangelog` does not paginate changelog histories

**File:** `taskflow/src/services/jira/changelog.ts:14`

**Issue:** The endpoint `GET /rest/api/2/issue/{key}?expand=changelog&fields=summary` returns
changelog histories inline. For Jira Data Center, the inline `changelog.histories` array is
capped at 100 entries by default (Jira DC paginates changelog via
`/rest/api/2/issue/{key}/changelog` with `startAt`/`maxResults`). For issues with extensive
history (>100 transitions), the `ActivityTimeline` will silently display an incomplete changelog
with no indication of truncation. The old `fetchIssueDetail` had the same limitation, so this is
not a regression introduced by phase 75, but it is now the sole source of truth for changelog data.

**Fix (recommended):** Switch to the dedicated pagination endpoint:
```ts
const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/changelog?maxResults=100&startAt=0`;
```
Then loop with `startAt += 100` until `startAt >= total`. For most issues a single page is
sufficient; the loop only fires when `total > 100`.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
