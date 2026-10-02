---
phase: 261002-0xf-epic-progress-polish-zoom-slider-consist
reviewed: 2026-10-02T00:00:00Z
depth: quick
files_reviewed: 13
files_reviewed_list:
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicStatCard.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/services/jira/duration.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Quick 261002-0xf: Code Review Report

**Reviewed:** 2026-10-02
**Depth:** quick (targeted read of the navigator, zoom hook, lib helpers, section and summary; EpicBands, IssueDetailContent and EpicCfdChart skimmed only)
**Biome:** `npx biome check` on all 13 files: no diagnostics.

## Summary

No blockers found. Offset math (rangeToOffsets/offsetsToRange, panRange clamping, clampRange min-span, rebaseRange pin-to-end) and tick generation (Monday test, even-week test, year labels) trace correctly. The risk rules hold: at most 4 risks, no duplicated Finish messages, and the neither-rule is applied. The issues below are behavioural rough edges.

## Warnings

### WR-01: A plain click on the selection commits an unchanged range and drops the active preset

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx:104-118`
**Issue:** `onPanDown` arms `pan.current`, and `onPanEnd` always calls `onCommit(p.last)`. `p.last` is initialised to `range`, so a click with no movement still commits. `onCommit` calls `zoom.onRange`, which sets `preset: null` and records `domainTo`. The active preset button (for example "1M") therefore loses `aria-pressed`, and the range now tracks the domain end instead of "today". A double-click makes it worse: two commits, then a reset.
**Fix:** track whether the pointer moved and only commit when it did.
```ts
const onPanEnd = () => {
  const p = pan.current;
  pan.current = null;
  if (p && (p.last.from !== p.range.from || p.last.to !== p.range.to)) onCommit(p.last);
  else onLive(p.range) // or just let live clear
};
```
If no commit happens, make sure a pending live state is cleared (call `onCommit` only when the range changed, and have the hook cancel its rAF otherwise).

### WR-02: Live drag state can stick if the gesture ends without a commit

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx:80-104`
**Issue:** `live` is cleared only inside `onCommit`. If base-ui never fires `onValueCommitted` (pointer cancel, blur or Escape during a thumb drag, or a pan that ends without `pointerup`), the chart keeps showing the stale live range while the section state is different. The next preset click will also appear to do nothing visible, because `live ?? zoom.range` still prefers `live`.
**Fix:** clear `live` when `zoom.range.from/to` change, for example with an effect keyed on `zoom?.range.from` and `zoom?.range.to`. Alternatively, also clear it in an `onPointerUp` or blur handler on the Slider.

### WR-03: Stale `domainTo` and pin logic misfire when the domain end moves back and forth

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:262-285` with `taskflow/src/lib/epic-progress.ts:1773-1781`
**Issue:** `domainTo` is recorded once, at commit time, and `rebaseRange` is applied to the stored range on every render. A range committed while the domain end was the (clipped) cap stays pinned to that cap. When the forecast later shortens (the domain end drops to today), the range is clamped. It is not re-pinned when the domain grows again, because `range.to` no longer equals the stored `domainTo`. The "pinned follows growth" feature therefore works only for monotonic growth. Also, `range.to` is checked against `prevDomainTo` only. A range ending exactly at a past "today" that happens to equal the old domain end gets pinned unintentionally on day rollover.
**Fix:** persist a boolean `pinnedToEnd` (`range.to === domain.to` at commit) instead of comparing dates later, and apply it in `rebaseRange`.

### WR-04: `formatDateRange` omits the start year when the range crosses a year

**File:** `taskflow/src/lib/epic-progress.ts` (`formatDateRange`), shown in `EpicRangeNavigator.tsx:200`
**Issue:** The year suffix is derived only from the end date vs today. A range like Dec 28, 2025 to Jan 3, 2026 viewed in 2026 reads "Dec 28 – Jan 3" with no year, which is ambiguous. If both ends are in a past year, only the end gets a `'25` suffix. Also, the start day's year is never shown at all.
**Fix:** add the suffix to the start as well when `ay !== by`, or when `ay` differs from today's year.

## Info

### IN-01: `MONTHS` and `longDate` are duplicated between the navigator and `lib/epic-progress.ts`

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx:41-46`
**Issue:** The navigator redefines the month names and a long-date formatter that already exist in the lib (`MONTHS`, `formatDateKey`, `formatFinishDate`).
**Fix:** export and reuse the lib helper.

### IN-02: Double cast `as unknown as` in `useChartView` overview

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx:131-140`
**Issue:** The generic `T extends { date; t }` is cast through `unknown` to read `remaining` and `forecast`, which defeats type checking. A rename of either series key fails silently as a flat sparkline.
**Fix:** constrain `T` with `{ remaining?: number | null; forecast?: number | null }`.

### IN-03: `timeTicks` fallback can exceed the tick target

**File:** `taskflow/src/lib/epic-progress.ts` (`timeTicks` ladder loop)
**Issue:** If no coarser unit yields at least one hit within the range (for example about 10 months with no Jan 1 or Jul 1), `picked` stays on the last unit that had hits, which may be far above `target`. The result is crowded or overlapping labels on narrow charts.
**Fix:** after the loop, if `picked.length > target`, thin it evenly (`picked.filter((_, i) => i % Math.ceil(picked.length / target) === 0)`).

---

_Reviewed: 2026-10-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---

## Disposition (orchestrator)

| ID | Disposition |
|----|-------------|
| WR-01 | Fixed — no commit when the pan moved 0 days (test proven to fail pre-fix) |
| WR-02 | Fixed — live range cleared on shared-range change (not unit-tested; base-ui cancel paths need a browser) |
| WR-03 | Not changed — rare (forecast shrinks then regrows / past today equal to old domain end); listed for UAT |
| WR-04 | Fixed — both years when a range crosses years (existing test updated intentionally; proven to fail pre-fix) |
| IN-01..03 | Not changed |

Execution note: Task 2's executor was interrupted (usage limit + two stream stalls); the orchestrator completed its test updates and the planned contract tests inline and committed a7aac0a6.
