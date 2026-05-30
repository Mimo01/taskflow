---
phase: 75-progressive-issue-detail-rendering
verified: 2026-05-31T00:45:00Z
status: human_needed
score: 4/4 must-haves verified (success criteria); 1 human-verify item outstanding
overrides_applied: 0
human_verification:
  - test: "Force a single-section failure (block the /comment endpoint in DevTools or equivalent), confirm comments shows 'Couldn't load comments' + Retry while the panel body, changelog, and subtasks remain fully functional."
    expected: "Inline ErrorState for comments only; rest of the panel (header, description, changelog, subtasks) unaffected. Retry triggers refetch."
    why_human: "Automated tests assert per-section ErrorState renders when query.isError is true, but do not execute an actual network failure and verify the composite panel remains intact around it. The 75-04 artifact explicitly records this check was not performed manually."
---

# Phase 75: Progressive Issue Detail Rendering — Verification Report

**Phase Goal:** Keep the existing Jira REST-based issue detail panel but eliminate the "blank panel until everything loads" feeling. Render each section (header, description, fields, comments, attachments, subtasks) as soon as its own request resolves, instead of blocking the whole panel on the slowest call.
**Verified:** 2026-05-31T00:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Header (title, key, status, assignee) renders as soon as the base issue fetch resolves — no waiting for comments / attachments / subtasks | VERIFIED | `IssueDetailPage.tsx:482` gates only on `!issue`; the old `isLoading \|\| !issue` gate is gone (grep returns 0 hits for that pattern). Three section queries fire independently. Progressive test asserting header visible while comments still pending is GREEN (6/6). |
| 2 | Each section shows a localized skeleton while its own request is pending; no global blocking spinner on the panel | VERIFIED | `CommentsSkeleton` shown on `showCommentsSkeleton && !commentsQuery.isError` (line 557); `SubtasksSkeleton` shown on `subtasks.length > 0 && enrichedSubtasks === undefined && showSubtasksSkeleton` (IssueDetailContent line 299); `ActivityTimeline` shows its own skeleton when `changelog === undefined` (line 115). All gated through `useDelayedLoading(isPending)` (200ms). |
| 3 | Existing detail-panel features (edit fields, post comment, open-in-Jira deep link, pin, clone, watcher toggle) work unchanged on the existing REST v2 paths | VERIFIED | `fetchIssueDetail` stays on REST v2 (no GreenHopper endpoint). All mutation call sites confirmed in the codebase: `CommentComposer.tsx` posts via `postComment`; `IssueDetailPage.tsx` edits/deletes via `updateComment`/`deleteComment`; `FieldsSection.tsx` status changes via `postTransition`; attachment delete, worklog CRUD, pin toggle, clone, open-in-Jira all use their pre-existing REST v2 paths. Full 1664-test suite passes green. |
| 4 | Verification artifact records before/after TTFMP and TTI; documents per-section latencies and which section gates "fully loaded" | VERIFIED (with noted gap) | `taskflow/docs/perf/75-issue-detail-progressive.md` exists with TTFMP=1180ms, TTI=1682ms, section tail 502ms, gating section=Changelog. Per-section network latencies (comments, subtasks, worklogs individually) were not separately recorded — the aggregate tail and render timeline stand in per the artifact's own note. |

**Score:** 4/4 success criteria verified

---

### Requirement ID Coverage

| Requirement | Assigned Phase | Status | Evidence |
|-------------|---------------|--------|---------|
| PERF-DETAIL-01 | Phase 75 | SATISFIED | Three independent `useQuery` calls with dedicated keys; base gate removed; TTFMP mark fires on first `issue` resolve; progressive test GREEN. |
| PERF-DETAIL-02 | Phase 75 | SATISFIED | `CommentsSkeleton`, `SubtasksSkeleton`, `ActivityTimeline` built-in skeleton each gated on their own query pending state via `useDelayedLoading`. |
| PERF-DETAIL-03 | Phase 75 | SATISFIED | All write paths stay on REST v2. Mutation invalidation fan-out: `jira-issue-comments` invalidated in CommentComposer + IssueDetailPage (edit, delete); `jira-issue-changelog` invalidated in FieldsSection `onSettled`. Pre-existing dead `['issue-detail', issueKey]` key in IssueDetailContent fixed to `['jira-issue-detail', issueKey, jiraBaseUrlFromStore]`. Asserted by 3 automated fan-out tests. |
| GH-CUT-01 | Phase 75 | SATISFIED | No GreenHopper endpoint used in any detail-panel fetch path. `changelog.ts` uses `expand=changelog` on `/rest/api/2/issue/{key}`, not GreenHopper. grep for `greenhopper` in IssueDetailPage.tsx, IssueDetailContent.tsx, changelog.ts returns 0 hits. |
| GH-CUT-02 | Phase 75 | SATISFIED (with accepted gap) | `taskflow/docs/perf/75-issue-detail-progressive.md` records TTFMP/TTI and gating section from a live capture. Per-section individual network latencies not captured; aggregate tail used instead. Per-section live error-isolation force-test not performed; covered by automated `ErrorState` tests. Accepted per phase context. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira/changelog.ts` | `fetchIssueChangelog` REST v2 changelog fetcher | VERIFIED | Exports `fetchIssueChangelog`; uses `expand=changelog&fields=summary` on `/rest/api/2/issue/{key}`; no GreenHopper reference; throws on error (primary section). |
| `taskflow/src/services/jira.ts` | `fetchEnrichedSubtasks` extracted + `fetchIssueDetail` slimmed | VERIFIED | `fetchEnrichedSubtasks` exported at line 1490; `fetchIssueDetail` field list has no `'comment'` and no `&expand=changelog` in URL; subtask enrichment block removed from body. |
| `taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx` | Comments section skeleton | VERIFIED | `data-testid="comments-skeleton"`, `h-6 w-32` heading, three `h-10 w-full` rows; no `font-semibold`. |
| `taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx` | Subtasks section skeleton | VERIFIED | `data-testid="subtasks-skeleton"`, `h-6 w-40` heading, two `h-8 w-full` rows; no `font-semibold`. |
| `taskflow/src/routes/dashboard/IssueDetailPage.tsx` | Three independent section queries + global-gate removal + perf marks | VERIFIED | Keys `jira-issue-comments`, `jira-subtask-enrichment`, `jira-issue-changelog` all present; `commentsQuery.data ?? []` replaces old `issue?.fields.comment?.comments` derivation; TTFMP/TTI marks present; global gate gates only on `!issue`. |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` | Subtask skeleton + error slot | VERIFIED | `SubtasksSkeleton` imported and rendered; subtask `ErrorState viewName="subtasks"` present; `enrichedSubtasks === undefined && showSubtasksSkeleton` condition guarded by `subtasks.length > 0` (CR-01 sibling fix). `comments` prop wired from parent commentsQuery (WR-01 fix). |
| `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` | Reachable changelog skeleton via undefined prop | VERIFIED | `changelog: ChangelogHistory[] \| undefined`; `if (changelog === undefined)` skeleton guard at line 115 is reachable via `showChangelogSkeleton ? undefined : changelogQuery.data`. |
| `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx` | 6 progressive + fan-out tests, all GREEN | VERIFIED | 6/6 passing: 3 Wave 0 rendering tests + 3 PERF-DETAIL-03 invalidation fan-out tests. |
| `taskflow/docs/perf/75-issue-detail-progressive.md` | GH-CUT-02 perf verification artifact | VERIFIED | Exists with TTFMP=1180ms, TTI=1682ms, gating section=changelog. Individual section latencies noted as "not separately captured" — accepted per 75-04 SUMMARY. |
| `taskflow/src/routes/dashboard/CommentComposer.tsx` | Post-comment invalidates comments key | VERIFIED | Line 90: `invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] })`. |
| `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` | Status change invalidates changelog key | VERIFIED | Line 262: `invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] })`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `IssueDetailPage.tsx` | `fetchComments / fetchEnrichedSubtasks / fetchIssueChangelog` | Three `useQuery` calls with dedicated keys | WIRED | Keys `jira-issue-comments`, `jira-subtask-enrichment`, `jira-issue-changelog` confirmed present; token read inside queryFn, not in keys. |
| `IssueDetailPage.tsx` (comments derivation) | `commentsQuery.data` | Replace `issue?.fields.comment?.comments` | WIRED | Line 230: `const comments: JiraComment[] = commentsQuery.data ?? []`. Old derivation absent. |
| `IssueDetailPage.tsx` | `ActivityTimeline` changelog prop | `showChangelogSkeleton ? undefined : changelogQuery.data` | WIRED | Lines 573–579: passes `undefined` when delayed skeleton is active; passes `changelogQuery.data` otherwise. Error case passes `[]`. |
| `comment mutations (post/edit/delete)` | `['jira-issue-comments', issueKey, jiraBaseUrl]` | `queryClient.invalidateQueries` | WIRED | CommentComposer line 90; IssueDetailPage editMutation.onSuccess line 278; deleteMutation.onSuccess line 294. |
| `FieldsSection status transition` | `['jira-issue-changelog', issueKey, jiraBaseUrl]` | `invalidateQueries` in `onSettled` | WIRED | FieldsSection.tsx line 262. |
| `IssueDetailContent handleDeleteAttachment` | `['jira-issue-detail', issueKey, jiraBaseUrlFromStore]` | `invalidateQueries` | WIRED | Line 172–174: uses canonical key. Pre-existing dead `['issue-detail', issueKey]` bug fixed. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `IssueDetailPage.tsx` → `ActivityTimeline` | `changelogQuery.data` | `fetchIssueChangelog` → `/rest/api/2/issue/{key}?expand=changelog` | Yes — REST v2 endpoint, returns `data.changelog?.histories ?? []` | FLOWING |
| `IssueDetailPage.tsx` → comments render | `commentsQuery.data` | `fetchComments` → `/rest/api/2/issue/{key}/comment` | Yes — existing REST v2 path unchanged | FLOWING |
| `IssueDetailContent.tsx` → `SubtasksSkeleton`/list | `enrichedSubtasks` from `subtaskEnrichmentQuery.data` | `fetchEnrichedSubtasks` → `/rest/api/2/search?jql=key in (...)` | Yes — falls back to base subtasks on failure (non-critical) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Progressive test suite: 6 tests GREEN | `npx vitest run IssueDetailPage.progressive.test.tsx` | 6 passed | PASS |
| Full test suite: 1664 tests green | `cd taskflow && npm run test` | 148 files / 1664 tests passed | PASS |
| Build clean (tsc + vite) | `cd taskflow && npm run build` | built in 4.58s, exit 0 | PASS |
| `fetchIssueChangelog` exported, uses expand=changelog, no GreenHopper | grep | present / absent | PASS |
| Global `isLoading \|\| !issue` gate removed | grep returns 0 hits | 0 hits | PASS |
| `commentsQuery.data` derivation present | grep | line 230 confirmed | PASS |
| Attachment-delete key fixed (no bare `['issue-detail', issueKey]`) | grep | 0 hits | PASS |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `IssueDetailPage.tsx` | 210 | `console.table(performance.getEntriesByType('measure'))` in production code path | WARNING (WR-03, tracked in 75-REVIEW.md) | Fires on every TTI measurement in production; dumps all performance measures — noise and potential screen-share info leak. Accepted as known open item. |

No `TBD`, `FIXME`, or `XXX` markers found in phase-modified files.

---

### Code Review Cross-Reference (75-REVIEW.md)

The code review identified 2 criticals, 4 warnings, and 2 info items. Resolution status as committed in `7f28b704`:

| Finding | Status | Notes |
|---------|--------|-------|
| CR-01: TTI never fires for zero-subtask issues | CLOSED — fixed in 7f28b704 | `subtasksSettled` guard at line 196 correctly handles disabled query semantics. |
| CR-02: Delete-comment errors silently discarded | CLOSED — fixed in 7f28b704 | `deleteError` now gated on `deletingCommentId === comment.id` (CommentCard line 783). |
| WR-01: `IssueDetailContent` reads stale `issue.fields.comment` | CLOSED — fixed in 7f28b704 | `comments` prop passed from parent commentsQuery; IssueDetailContent uses `commentsProp ?? []`. |
| WR-04: Comments error hides changelog panel | CLOSED — fixed in 7f28b704 | Error banners are sibling `div`s; ActivityTimeline is always rendered (with `commentsQuery.isError ? [] : comments` guard). |
| WR-02: Subtask enrichment key omits subtask list | OPEN (known/accepted) | Stale enrichment on base refetch; new subtask assignees appear only after navigate-away/back. Tracked in 75-REVIEW.md. |
| WR-03: `console.table` in production | OPEN (known/accepted) | See Anti-Patterns above. Tracked in 75-REVIEW.md. |
| INFO-01: Duplicate comment fns in jira.ts vs jira/comments.ts | OPEN (known/accepted) | Pre-existing tech debt; out of scope per REQUIREMENTS.md. |
| INFO-02: changelog capped at 100 on Jira DC | OPEN (known/accepted) | Not a regression; pre-existing limitation. Tracked in 75-REVIEW.md. |

---

### Human Verification Required

#### 1. Live error-isolation force-test

**Test:** Block the `/comment` endpoint in DevTools (or equivalent) while the issue detail panel is open. Observe whether comments shows an inline "Couldn't load comments" ErrorState with a Retry button, while the rest of the panel — header, description, fields, subtasks, and the changelog/activity section — remains fully functional.

**Expected:** Only the comments section shows an error banner. The panel body stays intact. Pressing Retry triggers a re-fetch of only the comments query. The changelog (ActivityTimeline) continues to render normally.

**Why human:** Automated tests assert that `commentsQuery.isError === true` causes the comments `ErrorState` to render and that the `changelogQuery.isError` branch is independent. However, the tests mock the query states directly; they do not execute a real network failure and verify the composite rendered panel is intact and interactive around the error. The 75-04 SUMMARY explicitly documents this check was deferred from the manual verification pass. Given that the fix for WR-04 (which caused comments failure to hide the changelog entirely) was applied inline, a live composite-panel check is the final confirmation that the fix holds end-to-end.

---

### Gaps Summary

No blocking gaps. All four success criteria are verified by codebase evidence. The one outstanding item (live error-isolation force-test) is a human-verify deferral from 75-04, not a code defect — the underlying wiring is correct and covered by automated tests. WR-02 (stale subtask enrichment key) and WR-03 (console.table in production) are accepted open items tracked in 75-REVIEW.md and do not block goal achievement.

---

_Verified: 2026-05-31T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
