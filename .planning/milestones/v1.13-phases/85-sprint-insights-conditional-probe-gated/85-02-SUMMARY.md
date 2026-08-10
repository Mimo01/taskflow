---
phase: 85-sprint-insights-conditional-probe-gated
plan: "02"
subsystem: data-layer
tags: [jira, sprint-insights, velocity, burndown, greenhopper, concurrency]
dependency_graph:
  requires: []
  provides:
    - fetchClosedSprints (services/jira.ts barrel)
    - fetchSprintIssuesBySprintId (services/jira.ts barrel)
    - getVelocityLimit (lib/concurrency.ts)
    - fetchBurndown (services/jira/greenhopper/burndown.ts + barrel)
    - GreenHopperBurndown type (services/jira/greenhopper/types.ts + barrel)
    - BurndownChangeEntry type (services/jira/greenhopper/types.ts + barrel)
  affects:
    - 85-03 (VelocityChart.tsx consumes fetchClosedSprints + fetchSprintIssuesBySprintId + getVelocityLimit)
    - 85-04 (BurndownChart.tsx consumes fetchBurndown + GreenHopperBurndown)
tech_stack:
  added: []
  patterns:
    - Closed-sprint tail paginator (startAt loop + slice(-n)) — Probe A ordering landmine mitigation
    - Dedicated pLimit(3) for velocity fan-out separate from global pLimit(6)
    - greenhopperFetch apiPath='' override for rapid-charts root (D-08)
    - domain-module error envelope: ApiError re-throw + network wrap + !ok throw
key_files:
  created:
    - taskflow/src/services/jira/greenhopper/burndown.ts
  modified:
    - taskflow/src/lib/concurrency.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/greenhopper/types.ts
    - taskflow/src/services/jira/greenhopper/index.ts
decisions:
  - fetchClosedSprints returns allSprints.slice(-n) — most-recent N from ascending list, never slice(0,n)
  - getVelocityLimit() returns a module-singleton pLimit(3) distinct from getJiraLimit()'s pLimit(6); unaffected by setJiraConcurrencyLimit
  - fetchBurndown throws on !ok (not return []) so TanStack Query surfaces error to BurndownChart error state (D-09/D-10)
  - BurndownChangeEntry all fields optional (MEDIUM-confidence shape A2); statC.{newValue,oldValue} assumed — live confirmation deferred to 85-01
  - apiPath='' override in greenhopperFetch prevents doubled /xboard prefix on rapid-charts endpoint
metrics:
  duration: "~18 minutes"
  completed: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 85 Plan 02: Data Layer (Closed-Sprint Fetch, Per-Sprint Issues, Burndown Fetcher) Summary

Added the Jira data-access layer for both Sprint Insights charts: closed-sprint tail pagination + per-sprint issue fetch (velocity INSIGHT-01), a dedicated pLimit(3) velocity concurrency limiter, and the GreenHopper scopechangeburndownchart fetcher with types (burndown INSIGHT-02). Pure network/service code — no React, no charting.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Closed-sprint tail paginator + per-sprint issue fetch + dedicated p-limit(3) | `7c31604d` | concurrency.ts, jira.ts |
| 2 | GreenHopper burndown fetcher (rapid-charts path override) + types | `bc3c94eb` | burndown.ts (new), types.ts, index.ts, jira.ts |

## What Was Built

### Task 1: Velocity data-access functions

**`fetchClosedSprints(baseUrl, token, boardId, n=6)`** — paginate `state=closed` endpoint, accumulate all sprints, return `allSprints.slice(-n)`. The LANDMINE comment is present directly above the slice explaining Probe A 2026-06-15: the endpoint returns sprints ASCENDING (oldest first, 2019 sprint ids 44/102/106/107/227 while active is 19562). Fetching the first page silently charts 2019 data. Pagination uses PAGE=50, startAt loop terminating on `data?.isLast` or short page.

**`fetchSprintIssuesBySprintId(baseUrl, token, sprintId, spKey)`** — fetch one sprint's issues. SP fields via the `new Set(['customfield_10016', 'customfield_10028', spKey])` dedup pattern — never hardcodes `customfield_10106` as sole field. Returns `[]` on `!res.ok`; treats response as external input (V5): `(data?.issues ?? []) as JiraIssue[]`.

**`getVelocityLimit()`** in `lib/concurrency.ts` — module-singleton `pLimit(3)`, separate from `getJiraLimit()`'s `pLimit(6)`. Not affected by `setJiraConcurrencyLimit`. Documented that this tighter cap scopes the velocity backfill fan-out so it never monopolizes the Jira connection.

### Task 2: Burndown fetcher + types

**`fetchBurndown(baseUrl, token, boardId, sprintId)`** in `greenhopper/burndown.ts` — calls `greenhopperFetch` with:
- path = `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${boardId}&sprintId=${sprintId}`
- 5th arg = `''` (apiPath override per D-08, prevents doubled `/xboard` prefix → 404)

Mirrors `data.ts` error envelope: ApiError re-thrown (auth → `setJiraConnected(false)` per D-04), network errors wrapped as `Cannot reach ${baseUrl}`, `!response.ok` throws so TanStack Query surfaces it to `BurndownChart.tsx`'s error state (D-09/D-10).

**`GreenHopperBurndown`** interface in `types.ts` — Probe C confirmed top-level keys: `activatedTime`, `changes`, `endTime`, `issueToParentKeys`, `issueToSummary`, `now`, `openCloseChanges`, `startTime`, `statisticField`, `workRateData`. `statisticField: 'timeestimate'` on this DC — burndown unit is HOURS REMAINING (not story points).

**`BurndownChangeEntry`** interface — all fields optional (MEDIUM-confidence shape A2). Fields: `key?`, `statC?: { newValue?: number; oldValue?: number }`, `added?`. Comment directs consumers to stay null-safe.

**Barrel wiring**: `export * from './burndown'` added to `greenhopper/index.ts`; `fetchBurndown`, `GreenHopperBurndown`, `BurndownChangeEntry` added to the `services/jira.ts` barrel re-exports. All three new functions are importable from `@/services/jira`.

## .changes Entry Shape — Live Read Status

**STATUS: LIVE READ UNAVAILABLE — 85-01 must re-confirm before relying on exact entry field names.**

No Jira credentials (`JIRA_BASE_URL`, `JIRA_PAT`) were available in this executor environment. The Probe C live probe could not be re-run to inspect a single `.changes` entry's field names or confirm value magnitude.

**What is known (Probe C, 2026-06-15, from CONTEXT.md):**
- `.changes` has ~496 entries (keyed by epoch-ms string)
- Top-level `statisticField = "timeestimate"` confirmed
- `workRateData` present (shape not fully inspected)

**What is assumed (RESEARCH A2 + A4, MEDIUM confidence):**
- Entry field: `statC: { newValue, oldValue }` — standard GreenHopper API pattern
- Value unit: SECONDS (Jira stores `timeestimate` in seconds; `28800` ≈ 8 hours)

**Action required for 85-01 (dashboardMetrics.ts `parseBurndownChanges`):**
Before finalizing the burndown parser, re-run probe.sh Probe C and inspect one `.changes` entry:
```bash
JIRA_BASE_URL=... JIRA_PAT=... PROJECT_KEY=... ./probe.sh
# Or direct curl:
curl -sS -H "Authorization: Bearer $JIRA_PAT" \
  "$JIRA_BASE_URL/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=6708&sprintId=19562" \
  | jq '.changes | to_entries[0]'
# Also check: jq '.statisticField'
```
If `statC.newValue`/`statC.oldValue` field names differ from assumption, update `BurndownChangeEntry` in `types.ts` AND `parseBurndownChanges` in `dashboardMetrics.ts` together. `BurndownChangeEntry` is all-optional so the type is already defensive regardless.

## Deviations from Plan

None — plan executed exactly as written. The live `.changes` entry read was anticipated as a possible skip ("if the live read is not possible (no creds in this environment), keep the defensive optional-field type as-is and flag in the SUMMARY") and is handled accordingly.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond the plan's `<threat_model>`. T-85-01 (Spoofing: no hardcoded boardId/sprintId literals), T-85-02 (Tampering: SP key from spKey param), T-85-03 (Input Validation: all-optional types, `?? []` fallbacks), T-85-04 (PAT flows only through apiFetch Authorization header) — all mitigated as designed.

## Self-Check: PASSED

All 6 files found. Both commits (`7c31604d`, `bc3c94eb`) present in git log.
