---
phase: 75-progressive-issue-detail-rendering
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
  - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
  - taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/changelog.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
resolved:  # prior review cycle, fixed in 7f28b704
  - "prior CR-01 — TTI gate fixed for zero-subtask issues"
  - "prior CR-02 — delete-comment error gated on deletingCommentId === comment.id"
  - "prior WR-01 — live comments passed from parent query into IssueDetailContent"
  - "prior WR-04 — per-section error banners; changelog survives a comments failure"
carried_open:  # prior-review items still open, not re-surfaced this pass
  - "prior INFO-01 — duplicate comment fns in jira.ts vs jira/comments.ts (== see also WR-?)"
  - "prior INFO-02 — fetchIssueChangelog changelog cap 100 on Jira DC (no pagination)"
status: issues_found
---

> **Re-review (2026-05-31):** This report supersedes the initial phase-75 review. The 2 prior
> criticals (CR-01, CR-02) and the 2 goal-undermining warnings (prior WR-01, prior WR-04) were
> fixed inline during execute-phase (commit `7f28b704`) and are **confirmed resolved** in this
> pass — no criticals remain. Two prior open items carry forward under new IDs (prior WR-02
> subtask-key → **WR-04** below; prior WR-03 console.table → **IN-02** below). Two prior Info
> items (duplicate comment fns, changelog pagination cap) were not re-surfaced this pass but
> remain open — see _Previous Review History_ at the end.

# Phase 75: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 75 splits the monolithic `fetchIssueDetail` into a slim base fetch plus three
independent section queries (comments, subtask enrichment, changelog) so the issue
header can paint before secondary data resolves. The decomposition is sound: error
isolation per section, 200ms-gated skeletons, and mutation invalidation fan-out are all
correctly wired, and the progressive-rendering test suite covers the header-before-comments
and skeleton-while-pending contracts.

No BLOCKER-class defects were found — no injection, secret, crash, or data-loss issues.
However several correctness and quality defects remain in the progressive-rendering paths
that were touched this phase: a double-rendered loading/empty state, a stale @mention
`aria-activedescendant`, a worklog timeline-refresh gap, an enrichment query that ignores
subtask identity in its cache key, and duplicated user/attachment-map construction across
parent and child. None block ship, but all degrade correctness or maintainability.

## Warnings

### WR-01: CommentsSkeleton and ActivityTimeline empty-state can render simultaneously

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:557-579`
**Issue:** The comments skeleton renders as a sibling *above* `ActivityTimeline`, gated only
on `showCommentsSkeleton && !commentsQuery.isError`. While comments are still pending,
`comments` resolves to `[]` and is passed straight into `ActivityTimeline`. If the changelog
and worklog queries have already settled (the common case — comments are usually the slowest
section), `mergeTimeline([], changelog, worklogs)` produces `noActivity === true` and
`ActivityTimeline` renders the "No activity yet" empty state *at the same time* as the
`CommentsSkeleton` above it. The user sees a skeleton and "No activity yet" stacked together,
then the skeleton vanishes and real comments appear — a confusing flash.
**Fix:** Suppress the timeline empty/changelog content while comments are still pending, e.g.
pass `changelog={undefined}` (forcing the timeline's own skeleton) when `showCommentsSkeleton`
is true, or hoist the loading decision so only one of {skeleton, timeline} renders:
```tsx
{showCommentsSkeleton && !commentsQuery.isError ? (
  <CommentsSkeleton />
) : (
  <ActivityTimeline comments={commentsQuery.isError ? [] : comments} ... />
)}
```

### WR-02: Worklog edit/delete mutations do not invalidate the changelog/activity timeline

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:388-409`
**Issue:** `worklogEditMutation` and `worklogDeleteMutation` invalidate `jira-issue-detail`
and `jira-worklogs`, but not `jira-issue-changelog`. The phase-75 ActivityTimeline merges
worklogs into the same feed as changelog entries. After deleting/editing a worklog the
worklog list refreshes, but any worklog-related history shown via the changelog section will
be stale until an unrelated refetch. The status-transition mutation in `FieldsSection.tsx:262`
was correctly updated this phase to add the `jira-issue-changelog` invalidation; the worklog
mutations were missed.
**Fix:** Add `queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] })`
to both worklog mutations' `onSuccess`/`onSettled` handlers, matching the transition mutation.

### WR-03: `aria-activedescendant` is hardcoded to option 0 and never tracks the highlighted mention

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:173`
**Issue:** `const activeDescendant = mentionActive ? 'mention-option-0' : undefined;` always
points at the first option. `MentionPopover` maintains its own `activeIndex` state and
renders option ids `mention-option-${index}` (MentionPopover.tsx:103), advancing as the user
presses Arrow keys. The textarea's `aria-activedescendant` therefore lies to screen readers —
it announces option 0 regardless of which option is visually highlighted. (Pre-existing in
this file, but the file is in scope and the @mention path is exercised by the phase-75
comment flow.)
**Fix:** Expose the active index from `MentionPopover` (via its handle or an `onActiveChange`
callback) and compute `mention-option-${activeIndex}`, or drop the attribute entirely if the
combobox pattern is not fully implemented.

### WR-04: Subtask enrichment query key omits subtask identity, serving stale assignees after edits

> _Carried forward from prior review WR-02 — confirmed still open._

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:138-154`
**Issue:** `subtaskEnrichmentQuery` keys on `['jira-subtask-enrichment', issueKey, jiraBaseUrl]`
but its `queryFn` reads `issue?.fields.subtasks` at call time. If the base issue is refetched
with a different subtask set (subtask added/removed/reordered) within the 30s `staleTime`,
the cached enrichment result keyed only on `issueKey` is reused and will not match the new
subtask list — enriched assignees can be applied to the wrong subtasks or dropped. The
`enabled` guard reacts to the count, but the cache key does not encode subtask identity.
**Fix:** Include a stable subtask signature in the key, e.g.
`['jira-subtask-enrichment', issueKey, jiraBaseUrl, (issue?.fields.subtasks ?? []).map(s => s.key).join(',')]`,
so a changed subtask set produces a fresh cache entry.

### WR-05: Worklog query failure is silently swallowed with no error UI

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:352-361`
**Issue:** Unlike the comments and changelog sections — which render explicit `ErrorState`
banners on `isError` (lines 544-570) — the worklogs query has no error surface. `worklogs`
defaults to `[]` via destructuring (`{ data: worklogs = [] }`), so a failed worklog fetch is
indistinguishable from an issue that genuinely has no worklogs. The "per-section error
isolation" contract documented at line 541 is applied to two of the three timeline sources
but not the third.
**Fix:** Render an inline `ErrorState` (or at minimum a non-blocking banner) when
`worklogsQuery.isError`, consistent with the comments/changelog sections, so users know the
worklog data is missing rather than empty.

## Info

### IN-01: Duplicated user-map and attachment-map construction in parent and child

**File:** `taskflow/src/routes/dashboard/IssueDetailContent.tsx:191-215` and `taskflow/src/routes/dashboard/IssueDetailPage.tsx:233-258`
**Issue:** Both components build a `attachmentMap` (filename → URL) and an `initialUserMap`
(name → displayName, seeded from assignee/reporter/comments) with near-identical logic. The
parent's maps feed `ActivityTimeline`; the child's feed the description renderer. The
seeding logic (including the `c.author as { displayName; name? }` cast) is copy-pasted.
**Fix:** Extract a shared `buildUserMap(assignee, reporter, comments)` and
`buildAttachmentMap(attachments)` helper and call from both sites.

### IN-02: `console.table` perf instrumentation ships in the render path

> _Carried forward from prior review WR-03 — confirmed still open._

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:210`
**Issue:** The TTI effect calls `console.table(performance.getEntriesByType('measure'))` on
every fully-loaded issue. This is debug instrumentation that will run in production builds.
**Fix:** Gate behind `import.meta.env.DEV` (or a debug flag) so it does not log in shipped
builds.

### IN-03: `fetchEnrichedSubtasks` uses `subtasks.length` as `maxResults`, risking silent truncation

**File:** `taskflow/src/services/jira.ts:1505`
**Issue:** `maxResults=${subtasks.length}` assumes the search returns exactly one row per
requested key. This is normally true, but if Jira returns fewer rows than requested (e.g. a
subtask the user cannot view), the `assigneeMap` simply misses those keys and falls back to
the base assignee — acceptable — but the coupling of `maxResults` to input length is fragile
and undocumented.
**Fix:** Add a brief comment, or use a fixed safe cap (`Math.min(subtasks.length, 100)`), and
note the silent-fallback contract.

### IN-04: `changelog.ts` maps both timeout and DNS failures to a generic "check the base URL" message

**File:** `taskflow/src/services/jira/changelog.ts:25-27`
**Issue:** The bare `catch {}` around `apiFetch` rethrows a single `Cannot reach ${baseUrl} —
check the base URL` message for any thrown error (network down, timeout, abort). This loses
the underlying cause, which can mislead users when the real problem is a transient timeout
rather than a misconfigured URL.
**Fix:** Preserve the original error as `cause` (`new Error(msg, { cause: e })`) or branch on
error type so genuinely different failures produce distinguishable messages.

---

## Previous Review History

The initial phase-75 review (commits `158d3162`, `2e50a448`) found **2 Critical + 4 Warning +
2 Info**. Status of those findings as of this re-review:

**Resolved in commit `7f28b704` (confirmed this pass):**
- **CR-01** — TTI measurement never fired for zero-subtask issues (`isPending` gate on a disabled query). Fixed: gate now accounts for subtasks presence.
- **CR-02** — Delete-comment errors silently discarded (`deleteError` gated on `isEditing`). Fixed: gated on `deletingCommentId === comment.id`.
- **prior WR-01** — `IssueDetailContent` read the no-longer-fetched `issue.fields.comment`. Fixed: live comments passed from the parent query.
- **prior WR-04** — A comments-query failure hid the entire changelog/activity panel. Fixed: per-section error banners; the timeline renders surviving sections.

**Still open (re-surfaced this pass under new IDs):**
- **prior WR-02** (subtask enrichment key omits subtask list) → now **WR-04** above.
- **prior WR-03** (`console.table` in production path) → now **IN-02** above.

**Still open (NOT re-surfaced this pass — remain valid):**
- **prior INFO-01** — Duplicate `fetchComments`/`postComment`/`updateComment`/`deleteComment` in `jira.ts` (lines ~660-729, 951-1018) and `jira/comments.ts`. Risk of divergence; barrel still ships its own copies. Fix: remove from `jira.ts`, re-export from `./jira/comments` (mind the 60 barrel importers — see project memory on the jira.ts dual-file pattern).
- **prior INFO-02** — `fetchIssueChangelog` reads inline `expand=changelog`, capped at 100 histories on Jira DC; long-history issues silently truncate. Fix: use `/rest/api/2/issue/{key}/changelog` with `startAt`/`maxResults` pagination.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
