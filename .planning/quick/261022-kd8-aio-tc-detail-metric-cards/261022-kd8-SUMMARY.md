# Quick 261022-kd8: AIO cycle step-level KPI tiles - Summary

Replaced Ready to retest / Unlinked failures / Re-runs on the AIO cycle detail page with Step pass rate, Steps executed and Steps per case, fed by a throttled (pLimit 4) per-run run-detail fan-out that shares the run-detail page's query key.

## Commits
- a811be06: pure `aggregateStepStats` + 7 unit tests (`taskflow/src/lib/aio-step-stats.ts`)
- b9dc256e: `useCycleStepStats` hook (useQueries + combine, key `['aio', base, 'run-detail', pk, ck, runId]`, no staleTime override)
- 125944d3: CycleKpiTiles rewrite, page wiring, test updates (AioCycleDetailPage.test, CycleBurndown.test)

## Deviations
None. Pass rate tile untouched and gated only on countsLoading. Old retest/unlinked/re-run code and testIds removed; two obsolete page tests deleted; three new page tests added (order/values, pass rate renders while steps pending, empty steps).

## UAT (not run, needs live app)
See PLAN Task 3 human-check: confirm Not Run executions carry steps (assumption A1); if not, steps-executed / steps-per-case undercount and the testcase-detail fallback is a follow-up.

## Self-Check: PASSED
