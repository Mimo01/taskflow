---
status: resolved
trigger: "On sprint board this calls fails: /rest/agile/1.0/board/6708/quickfilter — HTTP 404 Not Found"
created: 2026-05-31
updated: 2026-05-31
---

# Debug Session: sprint-board-quickfilter-404

## Symptoms

DATA_START
- **Error**: GET `/rest/agile/1.0/board/6708/quickfilter` returns HTTP 404 Not Found
  ```xml
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <status><status-code>404</status-code><message>HTTP 404 Not Found</message></status>
  ```
- **Expected behavior**: Quick filters for the sprint board should load successfully.
- **Actual behavior**: The quickfilter request 404s. Board still loads, but quick filters are missing.
- **Impact**: Board renders fine; quick-filter chips/buttons are absent or non-functional.
- **Timeline**: Unknown — not sure whether it ever worked or recently regressed. Investigate.
- **Reproduction**: Open the sprint board for board 6708.
DATA_END

## Current Focus

- hypothesis: CONFIRMED — `/rest/agile/1.0/board/{boardId}/quickfilter` is a Jira Cloud / newer DC endpoint not present on this Jira Server instance
- test: 7 vitest cases in board-config.test.ts
- expecting: fallback to /configuration extracts columnConfig.quickFilters correctly
- next_action: DONE
- reasoning_checkpoint: XML 404 response format is characteristic of Jira Server's built-in 404 page (not app-level JSON), confirming the endpoint sub-resource does not exist at all on this instance

## Evidence

- timestamp: 2026-05-31T01:14
  finding: `board-config.ts` calls `/rest/agile/1.0/board/${boardId}/quickfilter` with no fallback
  source: taskflow/src/services/jira/board-config.ts:30
  confidence: confirmed

- timestamp: 2026-05-31T01:14
  finding: Phase 33 RESEARCH flagged the quickfilter endpoint as MEDIUM confidence, "not tested against live DC instance"; D-06 in CONTEXT.md originally referenced `/configuration` but implementation diverged to `/quickfilter`
  source: .planning/milestones/v1.5-phases/33-board-sprint-filters/33-RESEARCH.md (Metadata section)
  confidence: confirmed

- timestamp: 2026-05-31T01:14
  finding: XML response body (`<status><status-code>404</status-code>`) is Jira Server's servlet container 404, not an application-level JSON error — the sub-resource route simply does not exist
  source: symptom description
  confidence: confirmed

- timestamp: 2026-05-31T01:14
  finding: `/rest/agile/1.0/board/{boardId}/configuration` exists on Jira Server/DC and returns quick filters under `columnConfig.quickFilters[]` with the same field shape
  source: Jira Agile REST API 7.3.1 docs (referenced in 33-RESEARCH.md Sources)
  confidence: high

## Eliminated

- boardId wrong / missing: boardId 6708 is resolved by useBoardId hook; the 404 path contains the correct ID
- auth/token issue: board itself loads fine via GreenHopper; only the quickfilter sub-resource 404s
- network/CORS: other agile REST calls succeed on the same host

## Resolution

- root_cause: `/rest/agile/1.0/board/{boardId}/quickfilter` (collection) does not exist on this Jira Server instance — only `/quickfilter/{id}` for a single known id. CORRECTION (cycle 2): the first fix fell back to `/rest/agile/1.0/board/{boardId}/configuration` → `columnConfig.quickFilters`, but that field does not exist on Jira Server/DC (configuration returns column config only, no quick filters). That fallback silently returned `[]`, so the 404 was swallowed but no filters appeared — matching the user's "still fails" report. Confirmed via Atlassian docs: on Server/DC, a board's quick filters are only listable via the GreenHopper edit model `GET /rest/greenhopper/1.0/rapidviewconfig/editmodel.json?rapidViewId={boardId}` → `quickFilterConfig.quickFilters[]` (same endpoint the board-config UI reads).
- fix: `fetchBoardQuickFilters` now calls the GreenHopper editmodel endpoint directly and extracts `quickFilterConfig.quickFilters`, normalising GreenHopper's `query` field → `jql` and injecting `boardId`. Any non-OK response returns `[]`. CYCLE 3: dropped the leading `/quickfilter` (Cloud) attempt entirely — this app is Jira Server/DC only (GreenHopper xboard endpoints throughout), so `/quickfilter` always 404'd, producing a noisy (and user-visible) 404 in the debug request log before the fallback. Calling editmodel directly removes the guaranteed 404.
- verification: VERIFIED LIVE — user rebuilt and confirmed quick filters now load on board 6708. 7/7 vitest tests green (editmodel happy path, query→jql + boardId normalisation, missing query default, empty/absent quickFilterConfig, non-OK failure, no /quickfilter call, trailing-slash strip).
- files_changed:
    - taskflow/src/services/jira/board-config.ts (single editmodel fetch)
    - taskflow/src/services/jira/board-config.test.ts (7 tests, editmodel-only)
