---
slug: worklog-entry-listed-twice
status: resolved
trigger: "On jira issue detail when I log work, in worklogs my entry is listed twice. It is posted fine, reload fixes it"
created: 2026-05-25
updated: 2026-05-26
---

## Symptoms

- **Expected:** After logging work on a Jira issue, the new worklog entry should appear exactly once in the worklogs list.
- **Actual:** The newly logged entry appears twice in the worklogs list immediately after submission.
- **Error messages:** None reported.
- **Timeline:** Uncertain when it started. The server-side POST is correct (reload shows one entry), so it's a client-side state issue.
- **Reproduction:** Navigate to Jira issue detail → log work → submit → observe two identical entries in worklogs section. Full page reload shows only one (correct) entry.

## Current Focus

hypothesis: "resolved"
test: "resolved"
expecting: "resolved"
next_action: "none"
reasoning_checkpoint: ""
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
  lines: 48-53
  note: "onSuccess invalidated BOTH ['jira-issue-detail'] AND ['jira-worklogs'] simultaneously. The issue-detail invalidation is not needed to show the new worklog — worklogs come from the separate jira-worklogs query. The parallel dual-invalidation caused a race condition: both refetches arrived at the ActivityTimeline in rapid sequence, resulting in the new entry appearing twice before both fetches settled."

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/IssueDetailPage.tsx
  lines: 247-256
  note: "worklogs state comes exclusively from useQuery(['jira-worklogs', issueKey, jiraBaseUrl]). ActivityTimeline receives worklogs from this single source (line 414). No second worklog source exists."

- timestamp: 2026-05-25
  file: taskflow/src/services/jira/worklogs.ts
  lines: 24-57
  note: "fetchFullWorklogs pagination is correct. No off-by-one that would cause duplication."

- timestamp: 2026-05-25
  note: "No optimistic updates (onMutate), no setQueryData on jira-worklogs, no useEffect appending to worklogs on issue change. Root cause is purely the dual invalidation in LogWorkPopover.onSuccess."

## Eliminated

- Server-side double POST: reload shows one entry, so server state is correct.
- Optimistic update + refetch duplication: no onMutate/setQueryData on worklog queries.
- fetchFullWorklogs pagination bug: pagination logic is correct for all total/PAGE_SIZE combinations.
- Two LogWorkPopover instances on the page: confirmed only one in IssueDetailContent.
- ActivityTimeline receiving worklogs from two props: only one worklogs prop, from the jira-worklogs query.
- FieldsSection still having LogWorkPopover: removed in commit f4789d49.

## Resolution

root_cause: "fetchFullWorklogs paginates while startAt < total. Some Jira Server instances report an inflated total (e.g. total=51 for a single worklog). When startAt=50 < 51, a second page request fires and the API returns the same worklog again, so allWorklogs becomes [718864, 718864]. ActivityTimeline then renders two <li key='worklog-718864'> elements and React fires the duplicate-key warning. The bug only triggers after the first worklog is created — before that, total=0 and the loop breaks immediately."
fix: "Added deduplication by worklog ID at the end of fetchFullWorklogs (jira/worklogs.ts line 54-55): const seen = new Set<string>(); return allWorklogs.filter(w => !seen.has(w.id) && !!seen.add(w.id)). The earlier 'dual invalidation race condition' theory (Session 1) was incorrect — separating the two invalidateQueries calls did not resolve the warning because the duplicate data came from the API pagination layer, not from React Query state."
verification: "Log work on an issue and confirm the React duplicate-key warning no longer appears and only one entry shows in the timeline."
files_changed: "taskflow/src/services/jira/worklogs.ts"
