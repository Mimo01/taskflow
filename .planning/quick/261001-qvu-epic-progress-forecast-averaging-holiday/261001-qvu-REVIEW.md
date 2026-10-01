---
phase: 261001-qvu
reviewed: 2026-10-01T00:00:00Z
depth: quick
files_reviewed: 9
files_reviewed_list:
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 261001-qvu: Code Review Report

**Reviewed:** 2026-10-01
**Depth:** quick (diff read plus targeted checks)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

I found no blockers. The calendar maths holds up:

- `addWorkingDays` and `workingDaysBetween` handle holidays correctly. `holidaysBetween` only counts weekday holidays, because `buildWorkCalendar` filters weekend holidays out, so there is no double subtraction.
- A weekend start with a Monday holiday works.
- The `extra` loop is bounded by the finite holiday list, so a calendar where every day is a holiday cannot loop forever.
- An empty schedule falls back to `DEFAULT_CALENDAR`.
- The projection point cap holds. Stride 1 gives at most 260 points. Larger horizons give at most about 256 plus today plus the 3 key dates.
- `averageForecasts` keeps `nOpt <= nLikely <= nPess`, and its rounding and confidence downgrade are sound.

The findings below concern silent degradation, mismatches between the chart and the tile, and consistency.

## Warnings

### WR-01: Tempo failure is cached as an empty schedule for 24h, with no retry

**File:** `taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts:96-104` (with `services/tempo/schedule.ts`)
**Issue:** `fetchUserSchedule` returns `new Map()` on any non-ok response instead of throwing. React Query treats that as success and caches it for `CALENDAR_STALE_MS` (24h). A transient 401, 5xx or timeout therefore silently drops holidays for a day, and the Finish tooltip says "holidays unavailable" with no retry. The thrown "No credentials" path does retry. The two failure modes behave differently.
**Fix:** In `queryFn`, throw when the result is empty, so React Query retries and does not cache it as success.
```ts
const m = await fetchUserSchedule(...);
if (m.size === 0) throw new Error('Empty Tempo schedule');
return m;
```
Alternatively, set a short `staleTime` for empty data.

### WR-02: Holiday window silently truncates relative to the forecast horizon

**File:** `taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts:79-80`
**Issue:** The calendar covers today-120d to today+182d. Forecast dates can run past 182 days. The projection cap is only at least 60 days, and `nPess` is unbounded. Holidays past the horizon are ignored with no indication, so the likely or latest date is optimistic. `from` and `to` also change daily, so the query key changes at midnight and refetches. `today` is recomputed on every render, so a tab left open past midnight silently refetches.
**Fix:** Either extend the horizon to cover `nPess`, or mark the calendar line in the Finish tooltip as approximate when `finish.pessimistic > calendarEnd`. Consider anchoring the key to the month, not the day.

### WR-03: The chart projection and the Finish tile use different forecasts

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:303-310`
**Issue:** The CFD projection uses `metricForecast`, which is the count or SP forecast. The Finish tile and the "late" risk use the averaged forecast. A user can see a chart band ending on a different date than the tile's Likely or Latest. In Time mode, `projection` is also computed from the count forecast and then ignored, which is wasted work.
**Fix:** Add a visible chart or tile note that states the chart is per-metric. Better, skip `deriveProjection` when `timeMode`.

### WR-04: The unestimated risk is inconsistent between metrics

**File:** `taskflow/src/lib/epic-progress.ts` (`deriveRisks`, the `unestimated` block)
**Issue:** In Time mode it filters open stories only. In Count and SP mode it filters all stories, including done ones, by `spOf === null`. Completed unpointed items inflate "N unestimated". The listed issue keys can also point at already-done work. In Count mode, flagging missing story points is arguably irrelevant to the metric.
**Fix:** Use `open.filter((s) => spOf(s, spKey) === null)` for the non-time branch, and decide deliberately whether Count mode shows the risk at all.

## Info

### IN-01: Holiday count in the Finish note is misleading

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx` (`calendarLine`)
**Issue:** It counts holidays from today-42d to the latest date, which includes past holidays. It prints "Excludes weekends and N holidays", and also "1 holidays" and "0 holidays".
**Fix:** Count from today onward and pluralise. Omit the count when it is 0.

### IN-02: The scope risk reads only the count forecast

**File:** `taskflow/src/lib/epic-progress.ts` (`deriveRisks`, the else branch)
**Issue:** The info-level scope risk is derived solely from the `count` part. If count is unusable but SP or Time is fine, scope growth is never reported. The units string "items/wk" also assumes count.
**Fix:** Fall back to the first usable part, or document that the risk is count-only.

### IN-03: `var(--color-amber-500)` is referenced only from a JS string

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:328`
**Issue:** The Tailwind v4 theme variable is emitted only because other classes (`bg-amber-500/15`) happen to use it. If those are removed, the icon colour silently disappears. The same applies to `var(--color-muted-foreground)`, though that one is defined in the `@theme inline` block. The amber colour has no dark-mode variant (amber-500 on a dark tooltip is acceptable, but the light popover is untested).
**Fix:** Use a class-based colour (`text-amber-500`) via a `className` prop, or define the variable explicitly.

### IN-04: Redundant `Math.max(0, ...)` and an unused `deriveRisks` argument

**File:** `taskflow/src/lib/epic-progress.ts` (`deriveRisks` args, `workingDaysBetween`)
**Issue:** `deriveRisks` accepts `metric`, `spKey`, `today` and `dueDate` through an args object. A due date equal to today with open items never raises "overdue" or "late", which is fine, but this is undocumented. `workingDaysBetween` clamps with `Math.max(0, ...)`, which hides a calendar inconsistency instead of surfacing it.
**Fix:** Add a doc comment on the due-date boundary. Keep the clamp, but test a holiday on `a` itself and on a weekend boundary.

---

_Reviewed: 2026-10-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---

## Disposition (orchestrator)

Fixed in the commit after 95c5fe7f; regression tests for WR-01 and WR-04 proven to fail pre-fix.

| ID | Disposition |
|----|-------------|
| WR-01 | Fixed — staleTime 5 min when the schedule map is empty, 24 h otherwise |
| WR-02 | Fixed — horizon 365 days (midnight key change accepted: one cheap refetch per day) |
| WR-03 | Not changed — by design (CONTEXT): chart projection is per active metric, Finish/late risk use the average |
| WR-04 | Fixed — unestimated risk counts open items only in every metric |
| IN-01 | Pluralisation fixed; lookback count kept (note describes holidays across the forecast's window) |
| IN-02 | Not changed — scope growth is item-based by design |
| IN-03 | Not an issue — amber-500 is used as a utility class elsewhere, so the variable is emitted |
| IN-04 | Not changed |
