---
phase: 71-greenhopper-adapter-foundation
plan: 01
subsystem: testing
tags: [greenhopper, fixtures, capture-script, redaction, vitest, jira]

requires:
  - phase: 70 (or earlier baseline)
    provides: existing Jira REST adapter pattern in src/services/jira.ts
provides:
  - one-shot Node CLI that pulls four GreenHopper endpoints and redacts PII before write
  - four committed redacted JSON fixtures usable directly by vitest (resolveJsonModule)
affects: [71-03, 71-04, 71-05, 72, 73, 74, 75]

tech-stack:
  added: []
  patterns:
    - Node 18+ ES-module CLI under taskflow/scripts/*.mjs (mirrors bump-version.mjs)
    - Whole-field HTML redaction (placeholder literal — never regex over HTML)
    - Stable PROJ-{n} key remap shared across all four fixtures via Map

key-files:
  created:
    - taskflow/scripts/capture-greenhopper.mjs
    - taskflow/src/services/jira/greenhopper/__fixtures__/allData.real.json
    - taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json
    - taskflow/src/services/jira/greenhopper/__fixtures__/details.real.json
    - taskflow/src/services/jira/greenhopper/__fixtures__/transitions.real.json
  modified: []

key-decisions:
  - "Use raw global fetch (Node 18+), NOT apiFetch — renderer-only side effects (RESEARCH Pitfall 8)"
  - "Whole-field HTML replacement, not regex (RESEARCH Pitfall 7)"
  - "Stable issue-key remap via shared Map so PROJ-{n} matches across all four fixtures"

patterns-established:
  - "scripts/*.mjs CLI shape: shebang + env-validate + helper fetch + write — mirrors bump-version.mjs"
  - "fixtures live under <module>/__fixtures__/ for vitest auto-resolution"
  - "secrets policy: PAT comes from env only; script never logs JIRA_PAT value"

requirements-completed: [GH-ADAPT-01, GH-ADAPT-03]

duration: ~5min
completed: 2026-05-28
---

# Phase 71 Plan 01: Fixture Infrastructure Summary

**Redacting Node CLI that captures four GreenHopper endpoints and four committed real-capture fixtures ready for vitest in plans 71-03/04/05.**

## Performance

- **Duration:** ~5 min (Task 1 auto, Task 2 human-action)
- **Started:** 2026-05-28
- **Completed:** 2026-05-28
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `taskflow/scripts/capture-greenhopper.mjs` ships per D-10 redaction map (no PAT echo, no apiFetch, no HTML regex)
- Four redacted `__fixtures__/*.real.json` files committed (`allData`, `data`, `details`, `transitions`)
- Redaction verified: zero real domains, stable `PROJ-{n}` key remap, 19 `<!-- redacted by capture script -->` placeholders in `details.real.json`

## Task Commits

1. **Task 1: Implement scripts/capture-greenhopper.mjs** — `126598cd` (feat)
2. **Task 2: Capture redacted GreenHopper fixtures** — `23fd3d7a` (test)

## Files Created/Modified
- `taskflow/scripts/capture-greenhopper.mjs` — one-shot env-driven CLI; reads JIRA_BASE_URL/JIRA_PAT/BOARD_ID/ISSUE_KEY/PROJECT_ID; redacts and writes four fixtures
- `taskflow/src/services/jira/greenhopper/__fixtures__/allData.real.json` — GhAllDataResponse capture
- `taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json` — GhBacklogResponse capture
- `taskflow/src/services/jira/greenhopper/__fixtures__/details.real.json` — GhDetailsResponse capture (HTML placeholdered)
- `taskflow/src/services/jira/greenhopper/__fixtures__/transitions.real.json` — GhTransitionsResponse capture

## Decisions Made
- None beyond the locked CONTEXT.md decisions (D-10 redaction map, D-06 client isolation).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None — capture script is a one-shot dev utility; fixtures live in-repo for future test runs.

## Next Phase Readiness
- Fixtures unblock 71-03 (fetchers), 71-04 (entityMaps), 71-05 (adapter tests).
- Wave 1 (71-02 client + types) can start immediately.

---
*Phase: 71-greenhopper-adapter-foundation*
*Completed: 2026-05-28*
