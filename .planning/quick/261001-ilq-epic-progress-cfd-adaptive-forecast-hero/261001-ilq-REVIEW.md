---
phase: 261001-ilq
reviewed: 2026-10-01T00:00:00Z
depth: quick
files_reviewed: 13
files_reviewed_list:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira-changelog.ts
  - taskflow/src/lib/statusStyles.ts
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/components/ui/tooltip.tsx
  - taskflow/src/routes/dashboard/EpicProgressCells.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts
findings:
  critical: 0
  warning: 8
  info: 3
  total: 11
status: issues_found
---

# Phase 261001-ilq: Code Review Report

**Reviewed:** 2026-10-01
**Depth:** quick (targeted read of all changed source files; tests skipped)
**Status:** issues_found

## Summary

The forecast core is sound. I found no division by zero, NaN or Infinity path:
`mu > 0` is guaranteed before the division, and the working-day math holds on weekends.
The JQL path is safe: keys are regex-validated and the query string is URL-encoded.
The query keys and lazy enabling are correct.

The real defects are in data semantics:
- The CFD can disagree with current Jira state.
- The epic-join detection matches substrings.
- Two forecast edge states show misleading text.
- The projection line is not anchored to the chart's "today" value.

There are no blockers.

## Warnings

### WR-01: `Epic Link` join detection uses substring match (wrong epic matches)

**File:** `taskflow/src/services/jira.ts:2849`
**Issue:** `(item.toString ?? '').includes(epicKey)` makes epic `PROJ-1` match a story linked to `PROJ-10`, `PROJ-12` and so on. That story's `joinedAt` is then set to the wrong date. Its CFD entry date is shifted later, and the stacked totals on earlier days drop below scope. A story that moved away from the epic later is also still treated as joined. `from`/`to` carry the key on Data Center, so compare exactly.
**Fix:**
```ts
} else if (item.field === 'Epic Link' && (item.to === epicKey || item.toString === epicKey)) {
```
Also clear `joinedAt` when a later `Epic Link` item moves the story to a different epic.

### WR-02: CFD "today" can disagree with the story's current status category

**File:** `taskflow/src/lib/epic-progress.ts:884-889`, `taskflow/src/lib/epic-progress.ts:764-774`
**Issue:** The final category comes purely from the replayed transitions. An unknown or renamed status (id or name not in the status list or stories) falls back to `'new'`. Truncated changelogs have the same effect. The chart's last point then shows Done/In progress/To do values that differ from the hero and summary (which use `catOf`). The stacked total still equals scope, but the categories are wrong. `withProjection` then pins the forecast to this `remaining`, while the future points use `forecast.remaining` (from current state). The result is a kink at the today point.
**Fix:** After building `segs` for a story with history, if the last segment's category is not `catOf(s)`, append `{ day: today, cat: catOf(s) }`. That anchors the CFD to current truth. Optionally use `forecast.remaining` in the today point, or rescale the projection from the chart's `remaining`.

### WR-03: Unestimated remaining work shows "Finish: <today>" as a date

**File:** `taskflow/src/lib/epic-progress.ts:443-456`, `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:279-282`
**Issue:** `remaining <= 0 && !allDone` returns `state: 'ok'` with `likely` set to today. That happens in SP mode when all open stories have no SP, or in Time mode when open stories have zero estimate. The Finish tile then renders today's date as the value, with the sub-text "Remaining work is unestimated". It reads as "finishes today". The state should not be `'ok'`.
**Fix:** Add a distinct state such as `'unestimated'`, or return `too-early` with that explanation, so no date is shown. The `nLikely === 0` special-casing in `FinishTile` can then go.

### WR-04: Idle epic at age 10 working days is mislabelled "not-converging" with "Scope grew 0/wk vs 0/wk"

**File:** `taskflow/src/lib/epic-progress.ts:535-549`
**Issue:** The stall check requires `since >= 10 && age >= 10`. With zero completions, `since = firstOffset = age - 1`. So at `age == 10`, `since` is 9, the stall check fails, `muD = 0`, `mu <= 0`, and the result is `not-converging`. The explanation reads "Scope grew 0/wk vs 0/wk done". The Risks tile shows "scope growing", which is false.
**Fix:** Use `since + 1 >= FORECAST_STALL_WD`, or treat `muD === 0` as `stalled`. Only emit `not-converging` when `muS > 0`.

### WR-05: Status history top-up does not fix Cloud truncation and fails silently

**File:** `taskflow/src/services/jira.ts:2937-2951`
**Issue:** The doc comment says Cloud caps embedded changelogs at 100, newest first. `/issue/{key}?expand=changelog` is capped the same way on Cloud. Only `/issue/{key}/changelog` pages. On any instance where the cap applies, the top-up returns the same truncated set (guarded by `full.length > ...`), so the oldest transitions are lost. The CFD then gets a wrong initial category, but `approximate` stays false and the note reads "From Jira status history". This app is Data Center (PAT Bearer), so impact is limited today. The note is still wrong whenever truncation survives.
**Fix:** Page `/rest/api/2/issue/{key}/changelog?startAt=&maxResults=100`, or mark the story as approximate when `total` still exceeds the histories obtained. Surface that in `EpicStatusHistory`, for example `truncated: boolean`.

### WR-06: Heavy changelog fetch refires on every refetch trigger

**File:** `taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts:35-44`
**Issue:** The query has `staleTime: 60_000` and default `refetchOnWindowFocus`. Each refetch re-runs the whole `expand=changelog` search for every story plus the top-ups. A story list change re-keys the query and also refetches everything. The query is also enabled in Count/SP mode even when the epic has no stories that need a chart (SP total 0).
**Fix:** Use a larger `staleTime` (for example 5 minutes) and `refetchOnWindowFocus: false`. Consider enabling only when the chart is actually rendered.

### WR-07: Tooltip trigger divs have `aria-label` but no role

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:379-388`, `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:424-430`
**Issue:** The `<div tabIndex=0 aria-label=...>` status and assignee bars have no role. `aria-label` on a role-less div is not reliably announced, and the focus stop is unlabelled for screen readers.
**Fix:** Add `role="img"` (or `role="group"`) to those triggers.

### WR-08: CFD is computed in Time mode even though it is unused

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:256-279`
**Issue:** `deriveCfd`, `deriveProjection`, `withProjection` and `buildStatusCategoryLookup` run on every render in Time mode, where their output is discarded. In Time mode `deriveAdaptiveForecast` is skipped but the CFD work is not. `EpicTimeBurnup` also recomputes `deriveTimeForecast` that the section already computed, so two forecasts can diverge. `useJiraStatusList` and `useEpicStatusHistory` are also re-enabled when the user leaves Time mode.
**Fix:** Guard the CFD derivation with `!timeMode`, and pass the section's forecast down to `EpicTimeBurnup`.

## Info

### IN-01: Hero percentage widths are rounded independently

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:132-136`
**Issue:** `pct()` is rounded per segment, so the widths can sum to 101 or more. `overflow-hidden` hides it, but the last segment is clipped. Use unrounded ratios for widths and keep rounding for the labels.

### IN-02: Projection spans weekends with linear interpolation

**File:** `taskflow/src/lib/epic-progress.ts:945-962`
**Issue:** Only the optimistic, likely and pessimistic dates are emitted. The forecast line is linear on calendar days between them, while the rate is per working day. The line therefore slopes through weekends, which is slightly off from the stated weekend-flat model. Emit weekly or Friday/Monday points if exactness matters.

### IN-03: Silent dropping of malformed story keys

**File:** `taskflow/src/services/jira.ts:2874`
**Issue:** Keys that fail the regex are silently dropped. The affected stories fall back to the approximation, but only the generic "Approximate for some items" note is shown. This is harmless for normal Jira keys. A debug log would help if lowercase or custom key formats ever appear.

---

_Reviewed: 2026-10-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---

## Disposition (orchestrator, fixed in 01f76114)

Findings verified against the code; regression tests for WR-01..04 proven to fail on the pre-fix code.

| ID | Disposition |
|----|-------------|
| WR-01 | Fixed — exact token match on Epic Link `toString`; latest change wins, a move away clears `joinedAt` |
| WR-02 | Fixed — CFD appends today's segment with the current `catOf` when replayed history disagrees |
| WR-03 | Fixed in UI — Finish shows "—" (sub: "Remaining work is unestimated") instead of today |
| WR-04 | Fixed — zero completions returns `too-early` before the not-converging check |
| WR-05 | Not fixed — Cloud-only truncation; app targets Data Center. Revisit if Cloud support is added |
| WR-06 | Fixed — status-history staleTime 5 min |
| WR-07 | Fixed — `role="img"` on focusable status/assignee bar triggers |
| WR-08 | Fixed — CFD derivation skipped in Time mode (double time-forecast left; negligible) |
| IN-01..03 | Not fixed — cosmetic (independent % rounding, weekend slope of projection, silent drop of malformed keys) |
