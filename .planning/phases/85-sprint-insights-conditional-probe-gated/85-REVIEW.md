---
phase: 85-sprint-insights-conditional-probe-gated
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - taskflow/src/lib/concurrency.ts
  - taskflow/src/routes/dashboard/BurndownChart.tsx
  - taskflow/src/routes/dashboard/VelocityChart.tsx
  - taskflow/src/routes/dashboard/WeeklyTrendChart.tsx
  - taskflow/src/routes/dashboard/dashboardMetrics.test.ts
  - taskflow/src/routes/dashboard/dashboardMetrics.ts
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/burndown.ts
  - taskflow/src/services/jira/greenhopper/index.ts
  - taskflow/src/services/jira/greenhopper/types.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 85: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 85 adds two probe-gated Jira charts (personal velocity INSIGHT-01, sprint burndown INSIGHT-02), a closed-sprint pagination fetcher, a dedicated velocity concurrency limiter, and a GreenHopper scope-change burndown parser. The token-hygiene work is solid: no token appears in any queryKey, auth is loaded once in `index.tsx` and threaded as props, and `staleTime` choices are deliberate (Infinity for immutable closed data, 30s for live sprint data). The concurrency-limiter isolation is correct.

However, the **burndown line is computed incorrectly** — it does not represent remaining work, and the one unit test that "covers" it asserts only ordering/non-negativity, never the actual values, so the defect is masked. There is also a **silent error-degradation gap** in the velocity fan-out where failed per-sprint fetches are indistinguishable from empty sprints and never surface an error. Several warnings concern dead/misleading chart wiring (an `ideal` series with no data, a cap that can truncate the burndown timeline, an SP-field mismatch that can silently zero the velocity chart).

## Critical Issues

### CR-01: Burndown series is a cumulative-delta line, not "remaining work" — chart is wrong

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.ts:348-381`

**Issue:** `parseBurndownChanges` seeds the series at `{ t: startTime, remaining: 0 }` and then accumulates `running += newValue - oldValue` across all change entries. A burndown chart must START at the full committed sprint scope and decrease toward zero. This implementation does the opposite:

- The anchor point is `remaining: 0`. At sprint start, remaining work is the full estimate, never zero.
- `running` begins at 0 and *climbs up* as issues are added to scope (`newValue - oldValue > 0`), then descends as work is completed. The resulting line goes UP from zero and back down — it is a net-cumulative-change line, not a remaining-work line.
- The `Math.max(0, running)` clamp then masks the problem further: early in the sprint, before scope is added, partial completions can drive `running` negative and get clamped to 0, flattening the line.

The net effect: the area chart in `BurndownChart.tsx` renders a shape that resembles neither a burndown nor remaining hours. Probe C confirmed `statisticField=timeestimate` (seconds remaining), so the correct computation is to establish the initial remaining total (sum of `newValue` for the initial scope, or seed from the time-estimate baseline) and subtract completed work, OR — more robustly — track running remaining as `sum over entries of (newValue - oldValue)` but seed `running` with the actual starting remaining total rather than 0, and seed the anchor point with that same total.

The unit test (`dashboardMetrics.test.ts:521-539`) only asserts timestamp ordering and `remaining >= 0`; it never asserts the remaining values are correct, so this ships green.

**Fix:**
```typescript
export function parseBurndownChanges(
  changes: Record<string, Array<{ key: string; statC?: { newValue: number; oldValue: number }; added?: boolean }>>,
  startTime: number,
): BurndownPoint[] {
  const safe = changes ?? {};
  const timestamps = Object.keys(safe).map(Number).sort((a, b) => a - b);

  // Running remaining must reflect TOTAL remaining time, decreasing as work completes.
  // Seed running with the initial committed scope so the line starts at full scope, not 0.
  let running = 0;
  // First pass: establish the initial remaining baseline from the earliest entries
  // (added-to-sprint deltas where oldValue is 0). Then anchor at that baseline.
  // ... compute initialRemaining ...
  const points: BurndownPoint[] = [{ t: startTime, remaining: initialRemaining }];
  running = initialRemaining;
  for (const ts of timestamps) {
    for (const entry of safe[String(ts)] ?? []) {
      if (entry.statC) running += (entry.statC.newValue ?? 0) - (entry.statC.oldValue ?? 0);
    }
    points.push({ t: ts, remaining: Math.max(0, running) });
  }
  return points;
}
```
At minimum, add a unit test that asserts concrete `remaining` values (e.g. start = committed total, end ≈ 0) so the curve shape is pinned, not just its monotonic timestamps.

### CR-02: Velocity fan-out swallows per-sprint fetch failures — error never surfaces, data silently wrong

**File:** `taskflow/src/routes/dashboard/VelocityChart.tsx:74-107` (with `taskflow/src/services/jira.ts:2570`)

**Issue:** `fetchSprintIssuesBySprintId` returns `[]` on any non-OK response (`jira.ts:2570`). In `VelocityChart`, the fan-out (`useQueries`) wires **only** `sprintsError` (the closed-sprint list query) into `ChartWrapper`; the per-sprint `sprintIssueQueries[i].error` values are never inspected. Two failure modes result:

1. A 500/timeout on one or more per-sprint fetches makes those sprints contribute 0 committed/0 completed. They drop out of `qualifyingSprints` (`committed > 0 || completed > 0`), silently lowering the count. The user sees either a distorted chart or the "Not enough sprint data" empty state — never an error or retry affordance. This violates the D-10 "section degrades with an error+retry" intent for partial failures.
2. `allQueriesSettled = sprintIssueQueries.every((q) => !q.isLoading)` treats an **errored** query as settled (`isLoading` is false on error). So the chart computes and renders over partial/empty data as if the load succeeded.

**Fix:** Surface fan-out errors and gate on success, not just non-loading:
```typescript
const fanoutError = sprintIssueQueries.find((q) => q.error)?.error;
const allQueriesSettled = sprintIssueQueries.every((q) => !q.isLoading);
// pass a combined error to ChartWrapper:
error={sprintsError ?? fanoutError}
onRetry={() => { refetchSprints(); sprintIssueQueries.forEach((q) => q.refetch()); }}
```
Additionally, consider distinguishing "fetch failed" from "empty sprint" — returning `[]` on `!res.ok` (`jira.ts:2570`) is the root cause that makes a failed sprint indistinguishable from an empty one upstream.

## Warnings

### WR-01: BurndownChart renders an `ideal` guideline series that has no data — dead chart element

**File:** `taskflow/src/routes/dashboard/BurndownChart.tsx:146-154`

**Issue:** The `<Line dataKey="ideal" .../>` and its comment claim the ideal series comes "from workRateData derivation in parseBurndownChanges." But `parseBurndownChanges` (`dashboardMetrics.ts:348-381`) returns `BurndownPoint` objects with only `{ t, remaining }` — there is no `ideal` key, and `workRateData` is never parsed anywhere. The ideal line silently renders nothing. This is dead UI wiring plus a misleading comment pointing at a derivation that does not exist.

**Fix:** Either implement the `workRateData` → ideal-guideline derivation and add `ideal` to each `BurndownPoint`, or remove the `<Line dataKey="ideal">` element and its comment until the guideline is actually computed.

### WR-02: Burndown timeline truncated to 200 issues silently — undercounts remaining work

**File:** `taskflow/src/services/jira.ts:2553-2574`

**Issue:** `fetchSprintIssuesBySprintId` caps at `maxResults=200` with no pagination and no warning (the doc comment acknowledges this as a known limitation). For the velocity chart this undercounts committed/completed SP for any sprint exceeding 200 issues. Because subtasks are included in the fetch and only excluded later in the pure layer, the 200 cap is consumed partly by subtasks, lowering the effective parent-issue ceiling well below 200. A sprint with many subtasks could silently drop real stories from the velocity sum. This is a correctness risk for large sprints, not just a perf note.

**Fix:** Add a pagination loop mirroring `fetchClosedSprints` (`jira.ts:2511-2525`), or at minimum detect `data.total > 200` and propagate a "truncated" signal so the chart can warn rather than chart wrong numbers.

### WR-03: Velocity SP-field mismatch can silently zero the chart

**File:** `taskflow/src/routes/dashboard/VelocityChart.tsx:76-99` (with `settings.store.ts:27`, `VelocityChart.tsx:11`)

**Issue:** `fetchSprintIssuesBySprintId` requests a dedup set `['customfield_10016', 'customfield_10028', spKey]` (`jira.ts:2563`), but `computePersonalVelocitySeries` reads SP exclusively from `i.fields[storyPointsFieldKey]` (`dashboardMetrics.ts:310,316`). The probe comment (`VelocityChart.tsx:11`) states this DC's SP field is `customfield_10106`, while `settings.store.ts:27` defaults `storyPointsFieldKey` to `customfield_10016`. If field discovery has not run / failed and the default is still in effect, every issue's `fields['customfield_10016']` is null on this instance, so committed/completed are all 0, `qualifyingSprints` is empty, and the chart shows "Not enough sprint data" despite valid sprints existing. The fetch fetching multiple candidate fields does not help because the compute only reads one.

**Fix:** Have the compute layer fall back across the same candidate set the fetch requests (e.g. `i.fields[spKey] ?? i.fields['customfield_10106'] ?? i.fields['customfield_10016'] ?? i.fields['customfield_10028']`), or guarantee `storyPointsFieldKey` is the discovered field before this component mounts and assert it is non-default.

### WR-04: `firstName` greeting derivation can throw on an all-bracket display name

**File:** `taskflow/src/routes/dashboard/index.tsx:99-102`

**Issue:** `tokens.find((t) => t !== t.toUpperCase())` calls `.toUpperCase()` per token — fine. But the bracket/paren filters (`/^\[.*\]$/`, `/^\(.*\)$/`) only strip tokens that are *entirely* a bracketed group. A display name like `"(ext.)"` alone yields `tokens = []`, then `firstName = tokens[0] ?? null = null`, which is handled (`?? 'there'`). That path is safe. The real fragility: empty-string tokens cannot occur (split on `\s+`), so no throw — downgrade noted. Remaining concern is purely that an all-uppercase + bracket display name produces a surprising greeting, not a crash.

**Fix:** Low priority; consider documenting that `firstName` is best-effort and may fall back to `'there'`. No code change strictly required — flagged for awareness because the surrounding comment implies more robustness than the regex delivers (it does not strip mid-token punctuation like `ACME,`).

### WR-05: `XAxis interval={2}` hard-codes tick density independent of point count

**File:** `taskflow/src/routes/dashboard/BurndownChart.tsx:109`

**Issue:** `interval={2}` shows every 3rd tick regardless of how many burndown points exist. Probe C reported ~496 change entries; `parseBurndownChanges` emits one point per distinct timestamp, so the X-axis could carry hundreds of points. `interval={2}` then renders ~165 overlapping date labels — illegible. Conversely, a short sprint with 4 points shows only 2 labels. The tick density should adapt to point count (or use `interval="preserveStartEnd"`).

**Fix:** Use `interval="preserveStartEnd"` or compute interval from `burndownPoints.length` so labels stay readable across sprint sizes.

### WR-06: `allSprints.slice(-n)` assumes server-side ascending order with no validation

**File:** `taskflow/src/services/jira.ts:2527-2529`

**Issue:** `fetchClosedSprints` relies entirely on the documented Probe-A observation that the `state=closed` endpoint returns ascending (oldest-first) order, then takes `slice(-n)` to get the most recent. There is no defensive sort by `startDate`/`id`. If a future Jira upgrade or a differently-configured board returns a different order (the doc itself notes "there is no orderBy parameter"), `slice(-n)` silently returns the wrong sprints and the velocity chart shows stale/wrong sprints with no error. This is the exact "Probe A landmine" the code comments warn about, but the mitigation (trust ordering) is itself fragile.

**Fix:** Sort defensively before slicing, keyed on a monotonic field:
```typescript
allSprints.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)); // or by completeDate/startDate
return allSprints.slice(-n);
```

## Info

### IN-01: `setJiraConcurrencyLimit` is not idempotent across module-level capitalization conventions

**File:** `taskflow/src/lib/concurrency.ts:12-13,29-34`

**Issue:** Module-level mutable singletons `Limit`/`Current` use PascalCase, which reads like a type/class. This is a naming-convention smell only — behavior is correct, and the velocity limiter isolation (`velocityLimit` is a separate const, unaffected by `setJiraConcurrencyLimit`) is implemented and documented correctly.

**Fix:** Rename to `currentLimit` / `currentN` for clarity. No behavioral change.

### IN-02: Y-axis rounds seconds→hours with `Math.round`, losing sub-hour resolution on the axis

**File:** `taskflow/src/routes/dashboard/BurndownChart.tsx:114`

**Issue:** `tickFormatter={(v) => \`${Math.round(v / 3600)}h\`}` rounds to whole hours on the axis while the tooltip (`formatHoursMinutes(v / 3600)`) shows `h m` precision. For low-remaining sprints (< 1h) the axis collapses ticks to `0h`. Cosmetic inconsistency between axis and tooltip granularity.

**Fix:** Acceptable for an axis, but consider `formatHoursMinutes` or one decimal for small domains.

### IN-03: Burndown comment claims `remaining` is SECONDS but `BurndownPoint` doc and parser are ambiguous

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.ts:327-332` / `BurndownChart.tsx:111-119`

**Issue:** `BurndownPoint.remaining` is documented as seconds, and the chart divides by 3600 — internally consistent. But the `types.ts` `GreenHopperBurndown` doc (`types.ts:345`) says "the burndown unit is HOURS REMAINING," contradicting the seconds interpretation used everywhere downstream. Conflicting unit documentation across files invites a future divide-by-3600 bug.

**Fix:** Make the unit statement consistent — pick "seconds (timeestimate native)" in all three locations (`types.ts`, `dashboardMetrics.ts`, `BurndownChart.tsx`).

### IN-04: Burndown test does not exercise the `?? 0` malformed-field guard or the clamp

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.test.ts:521-539`

**Issue:** The single `parseBurndownChanges` test uses only well-formed `statC` with both `newValue` and `oldValue` present. It never sends an entry missing `statC`, an entry with a missing `newValue`/`oldValue` (the `?? 0` path), or a delta sequence that would drive `running` negative (the `Math.max(0, …)` clamp). The defensive code branches that the spec emphasizes are untested, and CR-01's value-correctness gap is entirely uncovered.

**Fix:** Add cases for: entry without `statC` (skipped), partial `statC` (`?? 0` applied), and a negative-driving sequence asserting clamp to 0 plus concrete remaining values.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
