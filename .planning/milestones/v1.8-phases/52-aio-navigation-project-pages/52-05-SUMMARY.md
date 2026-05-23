---
plan: 52-05
phase: 52-aio-navigation-project-pages
status: complete
path_taken: B
completed: 2026-05-13
---

# Plan 52-05: Gap Closure — Resolve Truth 9 (ROADMAP SC-3 / per-cycle stats)

## What Was Built

No code changes. This was a documentation-only gap closure via Path B.

### Path Decision

The live AIO probe found that the `/testcycle` list endpoint returns **no stats fields inline** (`items[]` entries contain only `key`, `name`, `status`, `projectKey`). Stats are available via a per-cycle sub-endpoint:

```
GET /project/{projectKey}/testcycle/{cycleKey}/summary
→ { ID, totalTests, totalRuns, actualEffort, testRunDistribution: { [statusId]: count } }
```

This endpoint requires:
1. **N+1 calls** — one per cycle in the list (prohibited by D-10)
2. **Project-specific status ID resolution** — `GET /project/{projectKey}/config` → `runStatuses: [{ID, name}]` to map numeric IDs to names (IDs differ per project)

Per plan constraint T-52G-03 and D-10, stats via sub-endpoint = Path B.

### Artifacts Amended

**ROADMAP.md Phase 52 SC-3** (surgical single-line change):
- Old: "listing all cycles with per-cycle summary stats (pass/fail counts, run date)"
- New: "listing all cycles with cycle key, name, and status (per-cycle summary stats deferred to Phase 53 cycle detail — AIO testcycle list endpoint does not return stats fields)"

**52-CONTEXT.md D-10** (enriched with probe findings):
- Added probe confirmation: list endpoint returns no stats inline
- Documented `/summary` sub-endpoint shape for Phase 53 benefit
- Documented status ID resolution pattern (`/config` → `runStatuses`)
- Reaffirmed N+1 prohibition and Phase 53 deferral

**52-VERIFICATION.md**:
- `status: gaps_found` → `status: complete`
- `score: 8/9` → `score: 9/9`
- `gaps_remaining` cleared
- Gap Truth 9: `status: failed` → `status: resolved_by_roadmap_amendment`
- Added `resolution:` field documenting the probe-based rationale

## Verification

| Check | Result |
|-------|--------|
| ROADMAP SC-3 no longer requires "pass/fail counts, run date" as bare requirement | PASS |
| ROADMAP SC-3 contains "deferred to Phase 53" | PASS |
| CONTEXT.md D-10 contains "confirmed by Phase 52 probe" | PASS |
| VERIFICATION.md `status: complete` | PASS |
| VERIFICATION.md `score: 9/9` | PASS |
| VERIFICATION.md gap `status: resolved_by_roadmap_amendment` | PASS |
| No TypeScript files modified | PASS |
| All 13 Phase 52 tests GREEN (npx vitest run — 4 files, 13 tests) | PASS |
| UpdateDialog.test.tsx failure is pre-existing (confirmed via stash-isolate) | N/A |

## Phase 53 Handoff Notes

The `/summary` sub-endpoint is the correct implementation target for cycle stats in Phase 53. The recommended fetch pattern:

1. `GET /project/{key}/config` → build `Map<statusId, statusName>`
2. `GET /project/{key}/testcycle` → paginated cycle list
3. Per selected cycle: `GET /project/{key}/testcycle/{cycleKey}/summary` → distribution
4. Map distribution keys through status map → named buckets (Passed/Failed/Blocked/…)
5. "Not yet run" = `totalTests − sum(distribution.values())` (no run record)

Status ID examples from probe: ESHOP uses 51=NotRun, 53=Passed, 54=Failed, 55=Blocked; VATA uses 1/3/4/5. **Never hardcode these.**

## Self-Check: PASSED

All acceptance criteria met. Truth 9 definitively resolved. Phase 52 has zero open gaps.
