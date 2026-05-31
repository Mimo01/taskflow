---
status: resolved
phase: 74-backlog-on-data-json
source: [74-VERIFICATION.md]
started: 2026-06-01
updated: 2026-06-01
---

## Tests

### 1. Single `data.json` request on backlog open (SC-1 / GH-BACKLOG-01)
expected: Exactly one GET to `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId=N` per backlog open; zero paginated `/rest/api/2/search` calls for the backlog sections.
result: passed

### 2. Backlog feature parity sweep (SC-2 / GH-BACKLOG-02)
expected: Move-to-sprint, move-to-backlog, create story, filter by epic/assignee, and virtualized rendering all work on the new data source. Sprint name resolves correctly in move dialog including for closed-sprint issues.
result: passed

### 3. Mutation-driven cache invalidation freshness
expected: Post-mutation UI reflects new state immediately without manual reload across all five invalidation sites.
result: passed

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.
