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

## Follow-up after UAT (2026-10-22)

- Step data was slow (one run-detail request per case). Live checks showed the `testcasewithrun/paged` step fields are always null and no cycle-level GET carries steps.
- AIO's own cycle-summary dashboard gadget uses `POST /rest/aio-tcms/1.0/project/{jiraProjectId}/report/multicycle/summary/open` (`additionalInsight: 'STEP'`), which returns the cycle's step distribution by step status ID in one request. `fetchAioCycleStepSummary` now feeds the step tiles. The per-run fan-out, `p-limit` throttle and `aio-step-stats.ts` were removed (4653e598 → eeda7384).
- The Steps per case tooltip shows Cases / With steps, because the report has no per-case step counts.
- The "do Not Run executions return steps?" question is moot: totals come from AIO itself.
- UAT approved.
