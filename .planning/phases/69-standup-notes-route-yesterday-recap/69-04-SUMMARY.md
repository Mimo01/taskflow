---
phase: 69-standup-notes-route-yesterday-recap
plan: "04"
subsystem: standup-notes
tags: [data-wiring, useQuery, data-join, grouping, navigation, uat-fixes]
dependency_graph:
  requires:
    - standup-date.ts (resolveYesterdayDate, getScheduleLookbackRange)
    - fetchYesterdayJiraActivity, fetchIssueMeta (jira.ts)
    - fetchUserCommits, fetchUserMREvents (gitlab.ts)
    - fetchWorklogs, fetchUserSchedule (tempo)
    - StandupNotesPage shell + StandupPageHeader (Plan 03)
  provides:
    - YesterdayColumn (four-source data-join + per-section states + Copy markdown)
    - IssueActivityGroup (clickable issue header + worklog/transition/comment/MR sub-items)
    - StandaloneMrGroup (per-MR comment count + approvals)
    - fetchIssueMeta (key -> type/subtask/parent map for icons + rollup)
  affects:
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
    - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
    - taskflow/src/services/jira.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/lib/standup-date.ts
tech_stack:
  added: []
  patterns:
    - "Four independent useQuery hooks (tempo/jira/commits/mr-events) keyed without tokens (T-62-06)"
    - "Per-issue comment fetches fan out via getJiraLimit() bounded concurrency"
    - "Parent-story rollup: sub-task activity grouped under parent via fetchIssueMeta"
    - "Issue navigation via useOutletContext onIssueClick (breadcrumb trail in store)"
    - "Local date components for last-working-day (never toISOString — UTC off-by-one)"
---

# Phase 69 Plan 04: Yesterday Recap Data Wiring + Group Components Summary

All four plans of Phase 69 executed and merged; this plan wired the live data
into the `/standup-notes` Yesterday column and passed the human-verify checkpoint
after a round of UAT fixes.

## What shipped

- **Four independent data queries** in `StandupNotesPage` — Tempo worklogs, Jira
  activity, Git commits, MR events — each gated/degrading independently, plus a
  schedule query driving the holiday-aware `yesterdayDate`, and a fifth
  `fetchIssueMeta` query for issue type/parent metadata.
- **`YesterdayColumn` data-join** producing issue groups (rolled up to parent
  story), standalone MR groups, and "Other commits".
- **Group components**: `IssueActivityGroup` (clickable header → issue detail,
  type icon, worklog/transition/comment/commit/MR-comment sub-items) and
  `StandaloneMrGroup` (per-MR comment count + approval).
- **Copy markdown** + **Refresh-all** wired to the same data.

## Checkpoint UAT fixes (Task 3)

| Finding | Fix |
|---|---|
| Jira section stuck → 15s timeout | JQL scoped to `status CHANGED BY <user> DURING (day)`; per-issue comments parallelized via `getJiraLimit()` |
| MR comments not grouping (each = own line) | Group by `note.noteable_iid` (MR), not `target_iid` (note id) |
| MR comment count too high | Collapse to per-MR count; label by MR name; count only the user's own (event + note author guard) |
| Story icon wrong (generic circle) | Resolve type for all sources via `fetchIssueMeta`; render via shared `IssueTypeIcon`; removed type pill |
| Sub-task work not visible under story | Roll sub-task activity to parent story; list logged sub-tasks with hours |
| Empty sections above data | Reordered: populated groups first, empty/loading notices below |
| Tasks not clickable | Header → `onIssueClick` (issue detail + breadcrumb); added `cursor-pointer` |
| Last working day off by one (Thursday vs Friday) | `resolveYesterdayDate`/lookback use local date components, not `toISOString()` |

## Tests

- `jira-standup.test.ts` — `fetchYesterdayJiraActivity` (user+day JQL scope, parallel comments) + `fetchIssueMeta` (batch, parent, graceful degrade)
- `gitlab.test.ts` — `fetchUserMREvents` note.noteable_type + author-scope filters (repaired pre-existing broken mocks)
- `YesterdayColumn.test.ts` (new) — MR comment grouping/count-by-name, parent-story rollup, per-issue fallback
- `standup-date.test.ts` — existing 24 pass with local-date-component formatting

## Commit

- `af2e2dcf` — fix(69-04): standup Yesterday recap — query scope, grouping, navigation

## Known unrelated issue

- `WorklogsPage.test.tsx` has 5 pre-existing date-bomb failures (hardcoded
  2026-05-18/19 dates fall outside the page's current-week range as of
  2026-05-25). Fails identically on clean HEAD — not introduced by this plan.
