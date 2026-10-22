# Quick 261022-kd8: AIO cycle step-level KPI tiles - Research

**Researched:** 2026-10-22
**Domain:** AIO TCMS step data fan-out + TanStack Query v5 (`useQueries` + `combine`)
**Confidence:** HIGH for code and cache facts; MEDIUM for the not-run step behaviour (needs one live check)

<user_constraints>
## User Constraints (from CONTEXT.md)

Locked: keep **Pass rate** as it is. Replace Ready to retest / Unlinked failures / Re-runs with
**Step pass rate** (passed ÷ executed steps, sub `of executed steps`, tooltip Passed/Failed/Blocked
steps in green-500/red-500/orange-400, `—` when none executed), **Steps executed** (executed ÷ all as `%`,
sub `N of M steps`), and **Steps per case** (average to 1 decimal, sub `M steps total`, tooltip min/max).
Order: Pass rate | Step pass rate | Steps executed | Steps per case. Reuse `Tile`/`TileSkeleton`/`VALUE_CLASS`
and TooltipBody/TooltipRow. No coloured numbers, at most 4 tooltip rows, one skeleton per tile with matching geometry.
Distinct non-circle lucide icons, neutral tints. Fetching the steps must be bounded and must not block the
case Pass rate tile or the donuts.
Discretion: fetch strategy, caching, concurrency, cache reuse; dropping the retest/unlinked/re-run code
(keep `defects`, which the donuts still use); updating the doc comment and tests.
Out of scope: donuts, burndown, block layout, other AIO pages.
</user_constraints>

## Summary

**There is no bulk or cycle-level step endpoint anywhere in the repo or the probes.** Each source was checked:
- `testcasewithrun/paged` (P2) returns, per item, `latestTestRun{ID, createdDate, updatedDate, executedByID, testRunStatusID, allDefects, jiraProjectID}`. That is the case status only, with no step fields. The app sends `columns: ['rank','key','title','testRunStatusID','defectCount']` (`cycles.ts:520`). Adding extra columns (P2b) returned keys with unverified values, and the probe note says not to rely on them. [VERIFIED: 261013-mnc-PROBE-RESULTS.md P2]
- `summary/paged` (P5 and API-EXAMPLES `paged2`) returns only `testRunDistribution` and `totalTests`. [VERIFIED: PROBE P5, 57/API-EXAMPLES.md:370-506]
- A grep of `.planning` and `src` for `noOfSteps|stepCount|totalSteps|stepsCount` found nothing outside the per-run step parsing.

So the only evidenced source is the **per-run detail fan-out**: `GET /rest/aio-tcms-api/1.0/project/{pk}/testcycle/{ck}/testrun/{runId}?assignSteps=true`. It returns `testRunSteps[]` with `testRunStepStatus{ID,name}` (P3, P54B). Without `assignSteps=true`, `testRunSteps` is always empty. [VERIFIED: issue-steps.ts:183, 54-PROBE-FINDINGS B]

**Primary recommendation:** add a new hook `aio-cycle/useCycleStepStats.ts`. It calls `useQueries` with one query per navigable run, **using exactly the run-detail page's query key and fetcher** so the two share a cache. Each `queryFn` goes through a dedicated module-level `pLimit(4)`. A `combine` step aggregates the results into one stats object. The case Pass rate tile and the donuts stay on their existing flags. Only the three step tiles wait on `stepStats.loading`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| Per-run step fetch | API client (`services/aio/issue-steps.ts`, existing `fetchAioTestRunDetail`) | — | No new service function needed |
| Fan-out, throttle, cache | Client query layer (new `useCycleStepStats`) | `p-limit` | Shared TanStack cache with the run-detail page |
| Aggregation (counts, avg, min/max) | Pure function (`lib/aio-step-stats.ts` or inside the hook's `combine`) | — | Unit-testable without React |
| Rendering | `CycleKpiTiles.tsx` | `AioTile.tsx` | Presentational only |

## Standard Stack (already installed, nothing new)

| Lib | Installed | Use |
|---|---|---|
| `@tanstack/react-query` | 5.91.2 [VERIFIED: node_modules] | `useQueries({ queries, combine })` |
| `p-limit` | 7.3.0 [VERIFIED: node_modules; already used in `src/lib/concurrency.ts`] | Throttle the fan-out |
| `lucide-react` | ^0.577 | `ListChecks`, `ListTodo`, `Footprints`, `Layers`, `ListOrdered`, `Rows3` all exist [VERIFIED: d.ts] |

**Package Legitimacy Audit:** no new packages are installed in this task, so there is nothing to audit.

## Fetch Strategy (answers focus 1)

**Existing fetcher:** `fetchAioTestRunDetail(baseUrl, token, projectKey, cycleKey, runId)` returns `{run, steps} | null` (`services/aio/issue-steps.ts:255`).
- It is exported through the `@/services/aio` barrel.
- Steps come back sorted by `stepOrder`, and `status` is normalised to `PASS | FAIL | BLOCKED | NOT_EXECUTED` by `toStepStatus` (line 63).
- A 404 returns `null`, a 401 throws `ApiError`, and any other non-OK status throws.

**Query key to reuse (do not invent a new one):**
```ts
['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId]   // AioTestRunDetailPage.tsx:72
```
With the same key and the same `queryFn` result shape, the run page opens instantly after the tiles have loaded. It also works the other way: a run already opened seeds the tiles. The global defaults are `staleTime 5 min`, `gcTime Infinity`, `retry 1` (`main.tsx:58`). Use the default staleTime and do not override it. A different staleTime on a shared key causes surprising refetches from the other consumer. [VERIFIED: codebase]

**Concurrency:** AIO calls go through `aioFetch` → `apiFetch` and are **not** throttled. `getJiraLimit()` (`lib/concurrency.ts`, `pLimit(6)`) wraps only `services/jira` calls. AIO runs on the same on-prem Jira DC host, so an unbounded fan-out of 100–500 GETs would hit that server all at once.
- Use a **dedicated module-level `const stepLimit = pLimit(4)`** in the hook file and wrap the call: `queryFn: () => stepLimit(() => fetchAioTestRunDetail(...))`.
- Do not reuse `getJiraLimit()`. Queueing 500 step fetches on the shared Jira limiter would starve defect resolution (`useCycleDefects`) and every other Jira call in the app. 4 AIO + 6 Jira = 10 concurrent requests to the host, which is acceptable.
- The limiter is only touched inside `queryFn`, never during render, so the React Compiler module-read issue does not apply.
- Rough cost: 300 runs × ~250 ms / 4 ≈ 19 s [ASSUMED latency]. That is why only the step tiles may wait on this.

**Which runs to query:** use `runs.filter(r => !!r.id)` (the same rule as `navigableRuns`). P2 found 0 items without `latestTestRun`, so in practice this is every case. A case with an empty id gets no query and counts as "no data". Do not count it as 0 steps.

**Partial failures:** a failed or null result is left out of the aggregates.
- Expose `failed: number` and `coverage = loaded / queried`.
- When `failed > 0`, the Steps executed tooltip has room for a 3rd row such as "Unavailable N cases" (still at most 4 rows).
- When everything failed or nothing loaded: Step pass rate `—`, Steps executed `—`, Steps per case `—`.
- Do not render an ErrorState in a tile. With `retry: 1` per query, transient errors self-heal.

**Freshness caveat** (memory: enrichment-invalidation no-op). The runs list and each run-detail entry age on their own clocks. If the runs list refetches with a newer `latestTestRun.updatedDate` (`AioTestRun.executedDate`) than the cached detail's `run.executedDate`, the steps for that run are stale.
- Cheap fix: inside the hook, collect the runIds where `detail.run.executedDate !== listRun.executedDate`.
- Then invalidate exactly those keys in a `useEffect` keyed on the joined id string.
- Both values come from `updatedDate`, so they are comparable [VERIFIED: cycles.ts:574, issue-steps.ts:275]. The planner may treat this as optional, but it is cheap.

**Live verification needed** (Tauri app; no creds here). The user should open the cycle detail page with dev-tools → Operations tab and confirm:
- the "Load AIO Execution Detail" requests number about the case count;
- at most 4 are in flight at once;
- the totals match one or two run pages checked by hand ("x/y passed" on the run detail header, `AioTestRunDetailPage.tsx:362`).

## Not-run Cases (answers focus 2)

- P2 found **0 cycle items without `latestTestRun`**. AIO creates a run (status 51 "Not Run") when a case is added to a cycle, so a never-executed case still has a `runId` and a run detail. [VERIFIED: PROBE P2]
- Whether that run's detail returns `testRunSteps[]` filled in, with each step's `testRunStepStatus` = "Not Run", is **not explicitly probed**. [ASSUMED, MEDIUM]
  - The parameter name `assignSteps=true` (without it, steps are always empty) strongly suggests the server assigns the case's steps to the run on read.
  - The run-detail page already renders steps for any run. The user can confirm in 10 seconds by opening a Not Run execution in the app and checking whether step cards appear.
- **Fallback if steps are empty for not-run runs:** P4 `GET /project/{pk}/testcase/{tcKey}/detail` returns `steps[]{ID,step,expectedResult,stepType}` [VERIFIED: PROBE P4]. However, the current normaliser `fetchAioTestCaseDetail` **drops `steps`** (`testcases.ts:50-61`).
  - The fallback would need `stepCount: raw.steps?.length` added to the normaliser and type.
  - It would also need a second fan-out keyed `['aio', jiraBaseUrl, 'testcase-detail', projectKey, tcKey]`, which is the same key the run page uses at line 98, with `staleTime 5 min`.
  - Only fire it for runs whose run-detail returned `steps.length === 0 && status === 'NOT_EXECUTED'`.
  - Do not build this unless the live check shows it is needed.
- Step status mapping:
  - `toStepStatus` maps pass/passed, fail/failed and blocked. **Everything else, including "In Progress" and "N/A", maps to `NOT_EXECUTED`**.
  - At run level, `toRunChipStatus` maps N/A to `PASS`, and the case Pass rate counts 901 (N/A) as passed via the status map.
  - So a step marked N/A would count as not executed, while an N/A case counts as passed. This inconsistency is minor. Flag it, and do not change `toStepStatus` without live evidence that step N/A exists. [VERIFIED: code; whether step N/A exists live is unknown]
- Classify steps with `normalizeStatus(step.status)` from `lib/aioUtils.ts`, as the run page does at line 174, so both pages agree.

## Recommended Hook Shape (answers focus 4)

```ts
// aio-cycle/useCycleStepStats.ts
const stepLimit = pLimit(4); // AIO step fan-out; separate from the Jira limiter

export interface CycleStepStats {
  passed: number; failed: number; blocked: number; notRun: number; // step counts
  executed: number;   // passed + failed + blocked
  total: number;      // all steps across loaded cases
  cases: number;      // cases with a loaded run detail (the denominator for steps per case)
  minPerCase: number; maxPerCase: number;
  unavailable: number; // queried runs that errored or returned null
  loading: boolean;
}

export function useCycleStepStats({ runs, projectKey, cycleKey, jiraBaseUrl, token, tokenLoading }): CycleStepStats {
  const ids = (runs ?? []).filter((r) => !!r.id).map((r) => r.id);
  const enabled = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey;
  return useQueries({
    queries: ids.map((runId) => ({
      queryKey: ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId],
      queryFn: () => stepLimit(() => fetchAioTestRunDetail(jiraBaseUrl ?? '', token ?? '', projectKey ?? '', cycleKey ?? '', runId)),
      enabled,
    })),
    combine: (results) => aggregateStepStats(results, runs === undefined), // pure fn in lib/, unit-tested
  });
}
```
- `loading = runsUndefined || results.some(r => r.isPending)`. This is OK here because `runs` is already undefined while creds are missing, so a permanently disabled query (v5 `isPending` forever, memory) cannot occur unless creds disappear after runs load. For extra safety, use `r.isPending && r.fetchStatus !== 'idle'` OR `!enabled`. An empty runs list gives `loading=false` and all zeros, which renders as `—`.
- `combine` keeps the component re-render to one aggregate object. Write `aggregateStepStats` as a pure function in `src/lib/aio-step-stats.ts`, operating on `{data, isPending, isError}[]`, and unit-test it directly.
- Wire it in `AioCycleDetailPage.tsx` next to `useCycleDefects`. Pass `stepStats` to `CycleKpiTiles`. Remove the `runs`-based retest/unlinked/re-run computations. `defects` stays because the donuts use it, and `runs` stays because the burndown uses it.

## Common Pitfalls (answers focus 3)

1. **Test mock factory is missing the fetcher.** `AioCycleDetailPage.test.tsx:17` mocks `@/services/aio` with only 5 functions. If `fetchAioTestRunDetail` is not added (`vi.fn()` plus a fixture with steps in `setupDefaultMocks`), the hook's queryFn calls `undefined` → TypeError → every query errors and the tiles show `—`. Add it to the factory. Tests asserting on the tiles must also wait for the step tiles to resolve.
2. **Removed testIds that tests reference:** `kpi-retest`, `kpi-unlinked`, `kpi-reruns` at `AioCycleDetailPage.test.tsx:190, 272, 321, 756-765, 782-783, 801`. Two whole tests become obsolete and should be deleted, not rewritten: "failing denominators come from the runs list" (774-785) and "Ready to retest counts…" (787-803). The `kpi-unlinked` assertions at 190/272/321 are side-checks inside pass-rate tests, so replace them with a step-tile assertion or drop them. Skeleton ids `kpi-skeleton-retest|unlinked|reruns` are not referenced elsewhere [VERIFIED: grep]. New ids: `kpi-step-pass-rate`, `kpi-steps-executed`, `kpi-steps-per-case`, plus `kpi-skeleton-step-pass|steps-executed|steps-per-case`.
3. **React Compiler vs module reads** (memory 3f45fcd2). Do not read any module-level mutable state during render (for example `normalizeStatusById`). Aggregation must depend only on query data. `normalizeStatus` is pure (string → key), so it is safe. vitest does not run the compiler, so this class of bug only shows in the app.
4. **Query-key churn blink.** The key must use the `runId` from the stable `runs` data, not anything derived from a loading query. Never put `executedDate` in the key: it breaks sharing with the run page, and any runs refetch would re-key every query → mass refetch and skeleton blink.
5. **Do not gate the case tile on steps.** The Pass rate tile keeps `countsLoading`, and the donuts keep `countsLoading || !runs`. Only the three step tiles use `stepStats.loading`. The step tiles may reveal after the donuts. That is intended, because CONTEXT.md says the step fetch must not block the case data.
6. **Skeleton geometry.** Use `TileSkeleton` (3 rows: h-3.5 w-16 / h-7 w-14 / h-3.5 w-24) with the same icon and tint as the final tile, so nothing shifts on load.
7. **Average denominator.** For Steps per case, divide by `cases` (loaded details), not by `runs.length`. Otherwise failed fetches drag the average down. Format with `toFixed(1)`. When `cases === 0`, show `—`.
8. **Percent rounding.** `pctOf` rounds, so 99.6% shows as 100% while 1 step is still unexecuted. Match the case tile (it rounds too) and accept this, or floor below 100. Flag for UAT, do not over-engineer.
9. **Cache weight.** With `gcTime: Infinity`, every opened cycle keeps N run-detail entries (step text) for the whole session. This is acceptable for hundreds of entries, but note it.

## Tile Spec Suggestion

| Tile | Icon | Tint | Value | Sub | Tooltip rows |
|---|---|---|---|---|---|
| Step pass rate | `ListChecks` | green | `pctOf(passed, executed)%` or `—` | `of executed steps` | Passed (green-500), Failed (red-500), Blocked (orange-400) |
| Steps executed | `Footprints` (or `ListTodo`) | blue | `pctOf(executed, total)%` or `—` | `${executed} of ${total} steps` | Executed, Not run, (+ Unavailable N cases if > 0) |
| Steps per case | `Layers` | amber | `(total / cases).toFixed(1)` or `—` | `${total} steps total` | Min, Max |

Tints come from the existing `AMBIENT_TINT` palette (blue/red/amber/green). Red is not needed now that Unlinked failures is gone.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest (inner `taskflow/taskflow`) |
| Quick run | `cd taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx src/lib/aio-step-stats.test.ts` |
| Full suite | `cd taskflow && npx vitest run` (also runs on the pre-commit hook; combine RED+GREEN in one commit) |

| Behaviour | Test |
|---|---|
| Aggregation: pass/fail/blocked/notRun, executed, total, min/max, null/error excluded, empty → zeros | new unit `src/lib/aio-step-stats.test.ts` |
| Tiles render the 4 labels in order; step values from mocked `fetchAioTestRunDetail` | update `AioCycleDetailPage.test.tsx` "KPI tiles" |
| Pass rate tile renders before step fetches resolve (never-resolving mock) | new page test |
| Old testIds gone | `queryByTestId('kpi-retest')` is null |

Wave 0: add `fetchAioTestRunDetail: vi.fn()` to the `@/services/aio` mock factory, plus a step fixture.

## Security Domain

Read-only GETs with an existing bearer PAT through `aioFetch`. There is no new input surface. V5 does not apply beyond the existing `encodeURIComponent` on path segments. The concurrency limit protects the host (DoS-by-self).

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | A Not Run run's detail with `assignSteps=true` returns its steps (status Not Run) | Steps executed/per case would under-count M. Then build the P4 testcase-detail fallback (normaliser must start keeping `steps.length`) |
| A2 | ~250 ms per run-detail request | Step tiles stay in skeleton longer on big cycles. Raise the limit to 6 if the host copes |
| A3 | Step statuses other than pass/fail/blocked (In Progress, N/A) are rare | The N/A step vs N/A case mismatch shows up in the numbers |

## Open Questions

1. Do not-run runs carry steps? Verify live by opening a Not Run execution. This decides whether the fallback is needed.
2. Should step N/A count as passed, matching the case level? Leave as is unless seen live.

## Sources

- Codebase: `services/aio/issue-steps.ts` (fetchAioTestRunDetail, toStepStatus), `services/aio/cycles.ts:485-610`, `services/aio/testcases.ts`, `routes/dashboard/AioTestRunDetailPage.tsx:72-98,174`, `aio-cycle/{CycleKpiTiles,AioTile,useAioCycleData,useCycleDefects}.ts(x)`, `lib/concurrency.ts`, `main.tsx:58`, `AioCycleDetailPage.test.tsx`
- `.planning/quick/261013-mnc-*/261013-mnc-PROBE-RESULTS.md` (P2, P3, P4, P5 live)
- `.planning/milestones/v1.8-phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md` (Probe B steps)
- `.planning/milestones/v1.8-phases/57-*/API-EXAMPLES.md` (summary shape)
- TanStack Query v5 `useQueries` `combine` option [CITED: tanstack.com/query/v5/docs/framework/react/reference/useQueries]

**Valid until:** 2026-11-21
