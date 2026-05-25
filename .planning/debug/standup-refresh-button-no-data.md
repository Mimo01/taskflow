---
name: standup-refresh-button-no-data
status: resolved
trigger: On standup notes page the refresh button doesn't work, it doesn't refetch all data
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- expected: All data refreshes (issues, MRs, notes) when clicking the refresh button
- actual: Nothing happens (no visible change) after clicking the refresh button
- errors: No errors visible in browser console
- timeline: Unsure when it stopped working
- reproduction: Click the refresh icon button on the standup notes page — data stays stale; navigating away and back to the page DOES load fresh data

## Current Focus

- hypothesis: handleRefresh only refetches the 4 yesterday-column queries; TodayColumn owns its own 4 queries internally and is never told to refresh
- test: code inspection confirmed
- expecting: fix by using queryClient.invalidateQueries on shared key prefixes
- next_action: apply fix
- reasoning_checkpoint: Navigation away/back triggers a full remount which re-runs all queries. The refresh button only calls .refetch() on tempoQuery, jiraActivityQuery, commitsQuery, mrEventsQuery — none of which belong to TodayColumn.

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  lines: 262-267
  note: handleRefresh only refetches 4 yesterday queries; TodayColumn queries are unreachable

- timestamp: 2026-05-25T00:00:01Z
  file: taskflow/src/routes/standup-notes/TodayColumn.tsx
  lines: 231-270
  note: TodayColumn owns sprintQuery (key prefix 'jira-issues'/'sprint-board-today-full') and 3 standup queries; no onRefresh prop or imperative handle exposed

- timestamp: 2026-05-25T00:00:02Z
  file: taskflow/src/routes/standup-notes/TodayColumn.tsx
  lines: 85-94
  note: todayQueryKeys exported — queryClient.invalidateQueries can reach all 4 TodayColumn queries via prefix matching

## Eliminated

- button wiring: StandupPageHeader correctly calls onRefresh; the handler fires but doesn't cover TodayColumn queries

## Resolution

- root_cause: handleRefresh in StandupNotesPage only calls .refetch() on the 4 yesterday-column queries; TodayColumn's 4 queries (sprint, today-tempo, reviewer-mrs, participating-mrs) are owned internally and never triggered
- fix: Replace individual .refetch() calls with queryClient.invalidateQueries on the 'standup' prefix (covers all 7 standup-namespaced queries) plus the 'jira-issues'/'sprint-board-today-full' key (covers the sprint query); drop the now-unused query object refs from handleRefresh
- verification: After clicking Refresh, network tab shows new requests for all 8 query keys; "synced Xm ago" timestamp resets
- files_changed: taskflow/src/routes/standup-notes/StandupNotesPage.tsx
