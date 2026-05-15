---
name: aio-run-not-found-in-cycle
status: resolved
trigger: When I click on aio cycle execution run it doest find the run detail
created: 2026-05-14
updated: 2026-05-14
---

## Symptoms

- **Expected:** Clicking an AIO cycle execution run navigates to the run detail page
- **Actual:** "Run not found — No run with ID 184382 in cycle" error shown
- **Errors:** API 404 — run not found in cycle
- **Timeline:** Not sure when it started
- **Reproduction:** Open any cycle → click any execution run — fails consistently for all cycles and runs

## Current Focus

- hypothesis: "RESOLVED"
- test: ""
- expecting: ""
- next_action: done
- reasoning_checkpoint: ""
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-14T10:00:00Z
  file: taskflow/src/services/aio/issue-runs.ts
  line: 107
  content: "id: String(raw.ID ?? raw.id ?? '')"
  significance: "normalizeTestRun used top-level raw.ID (test case assignment ID) as run.id. The detail endpoint requires runs[0].ID (execution run ID)."

- timestamp: 2026-05-14T10:01:00Z
  file: .planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md
  line: 57
  content: "testRun.ID = 263794 (numeric run ID, usable directly for run-detail fetch)"
  significance: "Confirmed the detail endpoint uses execution run IDs (from traceability testRun.ID). The list endpoint returns assignment wrappers with nested runs[0].ID as the execution ID."

## Eliminated

- cycleKey missing in URL: ruled out
- Route definition mismatch: ruled out
- Navigation code in openRun: ruled out

## Resolution

- root_cause: "normalizeTestRun in issue-runs.ts used raw.ID (the test case assignment ID from the cycle testrun list endpoint items) as AioTestRun.id. The GET /testrun/{runId} detail endpoint requires the execution run ID (raw.runs[0].ID). The list endpoint returns test case assignment objects with a nested runs[] array — the top-level ID is the assignment ID, not the execution run ID. The traceability path (issue detail page) was unaffected because it sources runId from testRun.ID in the traceability response, which IS the execution run ID."
- fix: "In normalizeTestRun, changed id to prefer latestRun?.ID (runs[0].ID — execution run ID) over raw.ID (assignment ID): const runId = String(latestRun?.ID ?? raw.ID ?? raw.id ?? ''). Falls back to raw.ID for flat API response shapes that omit the runs[] wrapper."
- verification: "42 unit tests pass (npx vitest run src/services/aio/). Two new regression tests added: 'uses runs[0].ID as run.id (execution run ID, not assignment ID)' and 'falls back to raw.ID when runs[] is absent (flat response shape)'."
- files_changed:
  - taskflow/src/services/aio/issue-runs.ts
  - taskflow/src/services/aio/issue-runs.test.ts
