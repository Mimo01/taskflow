---
task: quick-261022-kd8
verified: 2026-10-22
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Open an AIO cycle with executed and Not Run executions; open one Not Run execution's run-detail page"
    expected: "Pass rate and donuts appear first; the 3 step tiles fill in from skeletons with no layout shift. Not Run executions return step cards (assumption A1); if not, Steps executed and Steps per case undercount and the testcase-detail fallback follow-up is needed."
    why_human: "Needs the live AIO API and the Tauri app; whether Not Run runs return steps cannot be checked from code."
  - test: "Dev tools > Operations during cycle load"
    expected: "About one AIO execution detail request per case, at most 4 in flight."
    why_human: "Runtime concurrency behaviour."
  - test: "Visual check of the 4 tiles (icons, tints, 2x2 / 4-across layout, tooltips)"
    expected: "Consistent with existing Pass rate tile; no coloured numbers."
    why_human: "Visual appearance."
---

# Quick 261022-kd8 Verification

**Goal:** AIO cycle detail KPI tiles: keep Pass rate; replace Ready to retest / Unlinked failures / Re-runs with Step pass rate, Steps executed, Steps per case.
**Status:** human_needed. All code-level must-haves are verified; only live-app checks remain.

## Must-haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 4 tiles in order Pass rate, Step pass rate, Steps executed, Steps per case | VERIFIED | `CycleKpiTiles.tsx` renders them in that order; the page test asserts DOM order via `compareDocumentPosition`. |
| 2 | Pass rate unchanged and not gated on step fetches | VERIFIED | Gated only on `countsLoading`. A test with a never-resolving `fetchAioTestRunDetail` shows `kpi-pass-rate` plus the 3 step skeletons. |
| 3 | Step pass rate: passed/executed %, sub "of executed steps", dash when 0 executed, tooltip Passed/Failed/Blocked in green-500/red-500/orange-400 | VERIFIED | `CycleKpiTiles.tsx` |
| 4 | Steps executed: executed/total %, sub "N of M steps", dash when total is 0, tooltip Executed / Not run, plus Unavailable only when > 0 | VERIFIED | `CycleKpiTiles.tsx` |
| 5 | Steps per case: total/cases to 1 decimal, sub "M steps total", dash when no case loaded, tooltip Min / Max | VERIFIED | `CycleKpiTiles.tsx`; the denominator is loaded cases (`cases`), not `runs.length`. |
| 6 | Old retest / unlinked / re-run tiles and computations removed | VERIFIED | No `kpi-retest`, `kpi-unlinked` or `kpi-reruns` in src, apart from the test's `queryByTestId(...)` null assertions. No retest or doneDefects logic remains in the tiles file. |
| 7 | Step data from per-run detail fetches sharing the run-detail key, throttled to 4 concurrent | VERIFIED | `useCycleStepStats.ts` uses key `['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId]`, identical to `AioTestRunDetailPage.tsx:70`. `pLimit(4)` wraps the fetch inside `queryFn`. The same fetcher and no staleTime override are used. |

## Wiring
- `AioCycleDetailPage.tsx` calls `useCycleStepStats` and passes `stepStats={stepStats}` to `CycleKpiTiles`. WIRED.
- `useCycleStepStats` `combine` calls `aggregateStepStats`; the lib classifies with `normalizeStatus`, treats in-progress and unknown as not run, excludes pending results, and counts error and null results as unavailable. Substantive and WIRED.
- Data flow: real `fetchAioTestRunDetail` results flow through to the tiles (FLOWING).

## Checks run
- `vitest`: `aio-step-stats.test.ts`, `AioCycleDetailPage.test.tsx`, `CycleBurndown.test.tsx`: 3 files, 85 tests, all pass.
- `tsc --noEmit`: clean.
- `biome check` on the touched files and `aio-cycle/`: clean.
- No TBD / FIXME / XXX markers in the touched files.

## Anti-patterns
None found.

## Human verification required
See the frontmatter. The main open risk is plan assumption A1: whether Not Run executions return steps from the run-detail endpoint. If they don't, the totals undercount, and the documented follow-up is a testcase-detail step-count fallback.
