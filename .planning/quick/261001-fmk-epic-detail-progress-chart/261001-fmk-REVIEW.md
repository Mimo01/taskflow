---
phase: 261001-fmk-epic-detail-progress-chart
reviewed: 2026-10-01T00:00:00Z
depth: quick
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 261001-fmk: Code Review Report

**Reviewed:** 2026-10-01
**Depth:** quick (hunks read in full; tests not deeply reviewed)
**Status:** issues_found

## Summary

No security issues or crashes found. Division by zero is guarded (total, perWeek, statusTotal, maxAssignee). Several correctness and consistency defects exist around date handling, key collisions, and burnup/forecast disagreement.

## Warnings

### WR-01: Jira timestamps sliced to a date without timezone normalisation

**File:** `taskflow/src/lib/epic-progress.ts:53-57`
**Issue:** `validKey` takes the first 10 chars of strings like `2026-09-30T23:30:00.000-0700`. That is the date in the Jira offset, while `today` comes from `toLocalDateString` (browser-local). Near midnight, or when the Jira offset is ahead of the user's, a story resolved "today" can get key `today+1`. The burnup excludes it (last point is `today`), but `deriveForecast` still counts it in `doneTotal` (`dk <= today` fails, so it is also dropped from the velocity window). The result is a done story that is missing from the burnup and the velocity but present in % done.
**Fix:** Parse with `new Date(v)` and convert via `toLocalDateString`. Fall back to the slice only for date-only strings. Also clamp `dk` to `today` in `doneDateKey`.

### WR-02: Burnup and forecast disagree on future-dated done items

**File:** `taskflow/src/lib/epic-progress.ts:120-129, 198-203`
**Issue:** Done items with `k > today` are never counted in any burnup point (last date is `today`) but are counted in `doneTotal`. The chart's final done value can therefore differ from % done.
**Fix:** Clamp the key to `today` in `doneDateKey` (`k > today ? today : k`).

### WR-03: Done-date fallback to `updated` / `today` distorts velocity

**File:** `taskflow/src/lib/epic-progress.ts:85-93`
**Issue:** A done-category story with no `resolutiondate` is dated by `statuscategorychangedate`, then `updated`, then `today`. Any later edit to an old done story (a comment, say) moves it into the 28-day window. This inflates velocity and pulls the projected finish date earlier. The `today` fallback always lands in the window.
**Fix:** Prefer `statuscategorychangedate` before `updated`. Consider excluding stories with no real done date from the velocity window.

### WR-04: Bucket keys collide on name

**File:** `taskflow/src/lib/epic-progress.ts:141-143, 164-165`
**Issue:** Statuses are keyed by name only, so two same-named statuses with different categories merge and keep the first story's `cat`. Assignees are keyed by `displayName`, so two users with the same name merge. A real user named "Unassigned" merges with the unassigned bucket.
**Fix:** Key by `status.id` or `${name}|${cat}`. Key assignees by `accountId`, `name`, or `key`, with a separate sentinel for null.

### WR-05: Zero-value segments in SP mode render as an empty bar, and the legend ignores the toggle

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:92, 182, 190, 214-221`
**Issue:** When no story has SP, `statusTotal` is 0 and the status bar renders every segment at 0% width, so the bar is blank. The assignee bars are empty in the same case, and there is no explanation. The legend always shows count and SP regardless of the toggle, which is acceptable but inconsistent with the bar above it. Zero-width segments are also still rendered.
**Fix:** Show a "No story points" note when `metric === 'sp'` and the total is 0. Filter out `b.value <= 0` segments.

### WR-06: Duplicate x-axis labels across years and weekly "Jan 5" ambiguity

**File:** `taskflow/src/lib/epic-progress.ts:59-62, 130`; `EpicProgressSection.tsx:145`
**Issue:** `label` omits the year and is used as the category `dataKey`. Epics spanning more than a year produce duplicate category values, so Recharts tooltips and points can map to the wrong bucket. The final weekly step can also fall 1 day after the previous bucket.
**Fix:** Use `date` as `dataKey` and a `tickFormatter` with `formatDateKey`. Include the year in the tooltip `labelFormatter`.

## Info

### IN-01: Forecast ignores scope growth and uses a fixed 28-day window

**File:** `taskflow/src/lib/epic-progress.ts:193, 216-217`
**Issue:** `perWeek = windowValue/4` assumes a full 4-week window even when the epic is younger than 4 weeks, which underestimates velocity. `windowItems < 2` is counted in items regardless of metric. Unestimated stories carry weight 0 in SP mode, so remaining work is understated.
**Fix:** Divide by `min(4, epic age in weeks)`. Document the assumptions in the tile tooltip.

### IN-02: `fetchEpicStories` swallows errors

**File:** `taskflow/src/services/jira.ts:2705-2708`
**Issue:** The `.catch(() => [])` is pre-existing, but the new section now returns `null` on failure, so a failed fetch renders as "no progress" with no signal to the user.
**Fix:** Let the error propagate to react-query and show an error state.
