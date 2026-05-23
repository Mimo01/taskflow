---
phase: 56
plan: "05"
subsystem: aio
tags: [gap-closure, defects-tab, service-layer-fix, aioc-03]
dependency_graph:
  requires: [56-03, 56-04]
  provides: [aioc-03-defects-populated]
  affects: [AioCycleDetailPage defects tab]
tech_stack:
  added: []
  patterns:
    - resolveJiraDefectKeys: post-process AIO runs via Jira REST v2 numeric ID lookup
    - resolveDefectsForRuns: Promise.all over all normalized runs after full pagination
key_files:
  created: []
  modified:
    - taskflow/src/services/aio/issue-runs.ts
    - taskflow/src/services/aio/issue-runs.test.ts
    - taskflow/src/services/aio/types.ts
decisions:
  - "Branch B chosen: no string keys on raw.defects — resolved jiraDefectIDs via fetchJiraIssueByKey"
  - "resolveDefectsForRuns post-processes after all pages collected — keeps normalizeTestRun synchronous"
  - "resolveDefectsForRuns placed after fetchAioTestRunsForCycle body to keep related logic together"
metrics:
  duration: "4 minutes"
  completed: "2026-05-14"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
---

# Phase 56 Plan 05: Defects Tab Fix (Gap 3 Closure) Summary

**One-liner:** Service-layer fix resolving `jiraDefectIDs: number[]` to Jira issue keys via Jira REST v2, populating `AioTestRun.defects[]` so the Defects tab shows real data instead of an always-empty state.

## What Was Built

Gap 3 from Plan 56-04 verification: the Defects tab on `AioCycleDetailPage` was always empty because `normalizeTestRun` mapped `defects` from `raw.defects` — a field the AIO API never populates. The real defect data lives in `jiraDefectIDs: number[]` on the latest `RawRunExecution`, but those are numeric Jira internal IDs, not the string keys (`PROJ-42`) that the page's `allDefects` derivation expects.

The fix is entirely in the service layer. No page changes were needed.

## Probe Findings

**Branch taken: B/C — resolve via Jira API**

- **Probe A:** `raw.defects` on `RawTestRun` is absent/always `[]`. Confirmed from live AIO testing during Plan 56-04 (Gap 3 root cause). No `jiraDefects`, `defectKeys`, or `jiraDefectKeys` field with string keys exists at the `RawTestRun` level. `raw.runs[0].jiraDefectIDs` is `number[]` (confirmed in production).
- **Probe B/C:** `GET /rest/api/2/issue/{numericId}` returns `{ key: 'PROJ-NNN', ... }`. Jira REST API v2 accepts both the issue key and the numeric internal ID in the URL path. The existing `fetchJiraIssueByKey(baseUrl, token, String(numericId))` resolves to `{ key, fields }` and returns `null` on any error — null-safe by design.
- **Fast path (A) not available** because `raw.defects` is never populated by this AIO instance.

## Resolution Strategy

Two new functions added to `issue-runs.ts`:

**`resolveJiraDefectKeys(baseUrl, token, numericIds)`:**
- Calls `fetchJiraIssueByKey` per numeric ID using `String(numericId)` as the key
- Uses `Promise.all` for parallel resolution (typical: <5 defects per cycle)
- Filters out `null` results (404, auth, network errors) — returns only successfully resolved keys

**`resolveDefectsForRuns(baseUrl, token, runs)`:**
- Post-processes all normalized `AioTestRun` objects after full pagination completes
- Skips runs with no `jiraDefectIDs` (no-op, no API calls)
- Mutates `run.defects[]` in place — type-safe since `defects?: string[]` on `AioTestRun`
- Called at both return points in `fetchAioTestRunsForCycle` (paginated `isLast` path and direct-array path)

`normalizeTestRun` remains **synchronous** — no async cascade required.

## Test Delta

| Metric | Before | After |
|--------|--------|-------|
| issue-runs tests | 5 | 8 (+3) |
| AioCycleDetailPage tests | 21 | 21 (unchanged) |
| Full suite | 1080 | 1083 |

New tests added to `issue-runs.test.ts`:
1. `resolves jiraDefectIDs to string Jira keys in run.defects[]` — verifies `fetchJiraIssueByKey` called with `String(numericId)`, result stored in `run.defects`
2. `returns run with defects: [] when jiraDefectIDs is absent or empty` — no-op path, `fetchJiraIssueByKey` not called
3. `gracefully skips defect resolution when fetchJiraIssueByKey returns null` — null-safe path, result is `[]` not `[null]`

## Deviations from Plan

None — plan executed exactly as written. Branch B was the expected path based on Gap 3 root cause analysis in 56-04-SUMMARY.

## Known Stubs

None. The fix is complete: `AioTestRun.defects[]` will be populated with real Jira issue keys for cycles with linked defects. The `AioCycleDetailPage` Defects tab (`allDefects` derivation at line 143) already reads from `run.defects[]` — no page change needed.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. `resolveJiraDefectKeys` passes numeric IDs (from AIO API JSON, TypeScript `number` type) to the existing `fetchJiraIssueByKey` — same Jira API path already used by the defects tab enrichment. Token path unchanged.

## Self-Check: PASSED

Files exist:
- taskflow/src/services/aio/issue-runs.ts: FOUND
- taskflow/src/services/aio/issue-runs.test.ts: FOUND
- taskflow/src/services/aio/types.ts: FOUND

Commits:
- 4b520a2: docs(56-05): add probe findings comment to issue-runs.ts — FOUND
- 1b22a58: fix(56-05): resolve jiraDefectIDs to Jira keys in normalizeTestRun — FOUND

Test results: 1083 passed, 0 failed, full suite green.
TypeScript: 0 errors in files modified by this plan (2 pre-existing errors in AioCycleDetailPage.tsx and AioProjectOverviewPage.tsx are out of scope).
