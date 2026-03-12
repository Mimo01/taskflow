---
status: resolved
trigger: "Sprint progress assignee story points don't add up — story/subtask counters only count not-done items instead of all items, and points are split incorrectly."
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

hypothesis: CONFIRMED — fetchSprintIssues parent query has no maxResults parameter so Jira defaults to 50 issues. In sprints with many stories, ORDER BY updated DESC causes recently-inactive (often Done) stories to fall off the end of the first page. Those missing stories then don't appear in parent key list so their subtasks are also never fetched.
test: Verified by reading jira.ts line 192: `const url = \`${base}/rest/api/2/search?jql=${jql}&fields=${fields}\`` — no maxResults.
expecting: Adding maxResults=200 to parent query will include all sprint stories up to 200.
next_action: Apply fix — add maxResults=200 to parent stories query in fetchSprintIssues

## Symptoms

expected: |
  - Stories counter: ALL stories regardless of status
  - Subtasks counter: ALL subtasks regardless of status
  - ToDo pts: story points for todo items only
  - In Progress pts: story points for in-progress items only
  - Done pts: story points for done items only
actual: |
  - Story counter appears to only count not-done stories
  - Subtask counter appears to only count not-done subtasks
  - Story points don't add up correctly across assignees in the sprint progress view
errors: none (silent data correctness bug)
reproduction: Open sprint view, look at per-assignee breakdown in sprint progress — story/subtask counts and point totals are wrong
started: present in current implementation

## Eliminated

- hypothesis: Frontend aggregation loop filters out done issues when counting stories/subtasks
  evidence: stories loop (lines 69-95) increments row.stories++ for every story regardless of cat; subtask loop (lines 98-105) has no status filter. Frontend logic is correct — all 15 tests pass.
  timestamp: 2026-03-13

- hypothesis: storyPointsFieldKey mismatch causes wrong point totals
  evidence: spFields correctly deduplicates and includes storyPointsFieldKey; story.fields[storyPointsFieldKey] accesses the right field. Points bug is a consequence of missing stories, not a field key issue.
  timestamp: 2026-03-13

## Evidence

- timestamp: 2026-03-13
  checked: fetchSprintIssues parent query URL construction (jira.ts line 192)
  found: `const url = \`${base}/rest/api/2/search?jql=${jql}&fields=${fields}\`` — no maxResults param. Jira REST API defaults to maxResults=50.
  implication: Sprints with 50+ non-subtask issues will silently return only the first 50, sorted by updated DESC. Done/inactive stories are least recently updated and appear last, so they get truncated.

- timestamp: 2026-03-13
  checked: Subtask query in fetchSprintIssues (line 241)
  found: Subtask query uses `parent in (chunk)` built from parentKeys derived from parentIssues. If done stories are missing from parentIssues due to truncation, their subtasks are never fetched.
  implication: Both story counts AND subtask counts for done issues are zero — matches the symptom exactly.

- timestamp: 2026-03-13
  checked: SprintProgressTab.test.tsx — all 15 tests including SPPG-07 Test A (done story counted in stories=2)
  found: All 15 tests pass. Frontend aggregation logic is correct.
  implication: Bug is in the data layer (fetchSprintIssues), not the UI layer.

- timestamp: 2026-03-13
  checked: Subtask query maxResults (line 241)
  found: Subtask query has `&maxResults=200` — correct. Parent query has no maxResults — missing.
  implication: Inconsistency confirms the parent query maxResults was accidentally omitted.

## Resolution

root_cause: fetchSprintIssues parent stories query (jira.ts line 192) has no maxResults parameter. Jira defaults to 50 issues. In sprints with 50+ stories, ORDER BY updated DESC causes recently-inactive (done) stories to be truncated. These missing stories are then absent from the parent key list, so their subtasks are also never fetched. Result: done stories and all their subtasks appear absent from per-assignee breakdown counts and point totals.
fix: Added &maxResults=200 to the parent stories query URL in fetchSprintIssues (jira.ts line 192), matching the existing subtask query. Added regression test in jira.test.ts verifying the parameter is present.
verification: All 49 tests pass (34 jira.test.ts + 15 SprintProgressTab.test.tsx). New regression test confirms maxResults=200 is in the parent query URL.
files_changed: [taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts]
