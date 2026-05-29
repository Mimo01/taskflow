---
status: complete
phase: 73-sprint-board-on-alldata-json
source: [73-01-SUMMARY.md, 73-02-SUMMARY.md, 73-03-SUMMARY.md]
started: 2026-05-29T11:03:02Z
updated: 2026-05-29T11:12:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sprint Board Loads via Unified Fetch
expected: Navigate to Sprint Board for an active sprint. Stories render in To Do / In Progress / Done columns; subtasks nest under parents. Loading shows briefly; empty sprint renders empty board without crash.
result: pass

### 2. Time-in-Column Badge on TaskCards
expected: Each TaskCard shows a compact time-ago badge (e.g. "30s", "1m", "1h", "1d") between the story-points chip and the status badge. Hovering shows a native tooltip "Entered status N ago". Badge updates as time passes / status changes.
result: pass

### 3. Single "Reload Board" Toolbar Button
expected: Toolbar shows ONE button with the refresh (RefreshCw) icon and aria-label "Reload board" — not two separate buttons (Refresh + Reload workflow transitions). Icon spins while fetching; button disabled during in-flight reload.
result: pass

### 4. Reload Board Success / Failure Feedback
expected: Click "Reload board". On success, aria-live region announces "Board reloaded"; data refreshes (stories, subtasks, transitions, statuses, quick filters, active sprint all re-fetch). On failure, announces "Failed to reload board". Message auto-clears after ~3s.
result: pass

### 5. Status Transitions Still Work After Rewrite
expected: Drag a card to a different column (or use a transition action). The transition completes, the card moves, and time-in-column badge resets. No errors related to missing projectId / sentinel issue.
result: pass
note: initially failed (no transitions); fixed inline in commit d5e1c1ad (adapter.ts: populate issuetype.id from gh.typeId); re-verified pass

### 6. Sidebar Prefetch Warms Sprint Board
expected: From a non-sprint-board page, hover/focus the Sprint Board sidebar link. Then click it. The board appears with cached data (no visible loading spinner, or only a very brief one) — faster than a cold load.
result: pass

### 7. Polling Keeps Board Fresh
expected: Leave the Sprint Board tab open and active. Make a change in Jira directly (or have a teammate move a card). Within the polling interval, the board updates without manual refresh.
result: pass

### 8. Subtask Orphan Warning Handled Gracefully
expected: If a subtask has no matching parent in the sprint, the board does not crash — orphan subtasks are skipped silently and a single console warning (warnOnce) is emitted, not a per-subtask flood.
result: skipped
reason: scenario not reproducible in current sprint state

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Status transitions are available on TaskCards and successfully move a card to a new column after rewrite onto useGhAllData"
  status: resolved
  reason: "User reported: there are no transitions available (bug), cant test this"
  severity: major
  test: 5
  root_cause: "adapter.ts:124-127 built fields.issuetype as { name, subtask } and omitted id; peekGhTransitions(qc, projectId, issue.fields.issuetype?.id ?? '') hit empty-string guard and returned undefined for every card"
  artifacts:
    - path: "taskflow/src/services/jira/greenhopper/adapter.ts"
      issue: "issuetype object missing id field"
    - path: "taskflow/src/services/jira/greenhopper/adapter.test.ts"
      issue: "test enforced incorrect prior invariant (no id)"
  fix_commit: "d5e1c1ad"
  fix: "Added `id: gh.typeId` to adaptedIssuetype; updated test to assert id IS populated from gh.typeId"
  debug_session: ".planning/debug/phase73-no-transitions.md"
