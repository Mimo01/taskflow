---
phase: 261001-g5q
reviewed: 2026-10-01T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/components/ui/tooltip.tsx
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/services/jira.ts
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 261001-g5q: Code Review Report

**Reviewed:** 2026-10-01
**Depth:** quick (diff-focused; tests skimmed, not reviewed)
**Status:** issues_found

## Summary

Seconds vs hours units are handled consistently: all values stay in seconds and `formatDuration` takes seconds. The `% logged` guard on `estimated > 0` is correct. No security issues. The problems are the burnup Y axis in time mode and tooltip trigger accessibility and markup.

## Warnings

### WR-01: Time-mode Y axis ticks are misleading or duplicated

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:246-250`
**Issue:** Recharts picks "nice" tick values in seconds (for example 0, 1000, 2000, 5000). The formatter then does `Math.round(v/3600)h`. That yields repeated or wrong labels ("0h","1h","1h","3h"). `allowDecimals={false}` only constrains seconds, so it does nothing useful here. Small epics (under 1h of estimate) show all ticks as "0h".
**Fix:** In time mode, pass explicit hour-aligned ticks or a tick count. Format with one decimal when the domain max is under 10h.
```tsx
const maxSec = Math.max(...burnup.map((p) => p.scope), 0);
const ticks = timeMode ? hourTicks(maxSec) : undefined; // multiples of 3600, deduped
<YAxis ticks={ticks} tickFormatter={(v) => timeMode ? formatDuration(Number(v)) : String(v)} />
```

### WR-02: Invalid HTML, `<p>` inside `<button>`

**File:** `EpicProgressSection.tsx:61-69` (Tile)
**Issue:** `TooltipTrigger type="button"` renders a `<button>` containing `<p>` elements. Only phrasing content is allowed inside a button. Some browsers and a11y tools mishandle this.
**Fix:** Use `<span className="block ...">` for the label and value.

### WR-03: Many non-actionable tab stops

**File:** `EpicProgressSection.tsx:61, 331, 357`
**Issue:** Tiles, every legend item, and two buttons per assignee row (name and total) are focusable `type="button"` elements that do nothing except show a tooltip. This adds dozens of tab stops. The two assignee buttons also show identical tooltip content. Screen readers announce them as "button" with no action.
**Fix:** Make only one trigger per row focusable. Make the others non-focusable by rendering them as a span or div, or set `tabIndex={-1}`. Alternatively expose the tooltip text via `aria-label` or `aria-describedby`.

### WR-04: Hover-only segment triggers, with zero-width segments

**File:** `EpicProgressSection.tsx:313-319, 372-381`
**Issue:** The `render={<div />}` triggers are not keyboard-focusable, so their tooltips are mouse-only. This is acceptable only because the legend and name buttons duplicate the info. In the status bar a zero-value bucket renders a 0%-width trigger, which is useless but still in the tree. In time mode, stories with no estimate give `value=0`, so they vanish from the bar while still appearing in the legend.
**Fix:** Filter `statuses` with `b.value > 0` for the bar segments.

### WR-05: Time-mode assignee total can be truncated

**File:** `EpicProgressSection.tsx:392-396`
**Issue:** The fixed `w-28` (112px) column with `truncate` holds `"120h 30m / 200h 15m"` (about 19 chars at text-xs, over 112px). The value is silently clipped, and users must hover to see it. This violates the "one row = one line" convention in a lossy way.
**Fix:** Widen to `w-36`, or show only `logged / estimate` in hours.

## Info

### IN-01: Sub-minute durations show "0m"

**File:** `taskflow/src/lib/epic-progress.ts:279` (via `formatDuration`)
**Issue:** A nonzero logged or estimate under 60s displays as "0m", which looks like no data. This is an edge case.
**Fix:** None needed unless sub-minute values are expected.

### IN-02: Time mode mixes two estimate bases

**File:** `taskflow/src/lib/epic-progress.ts:96-100, 263-275`
**Issue:** Burnup, status, and assignee bars weight by `aggregatetimeoriginalestimate`. The Remaining tile uses `aggregatetimeestimate`. This is correct but not labeled, so Estimated minus Logged does not equal Remaining. A tooltip note would help. Also `% logged` is unclamped (over 100% is allowed), which is fine.
**Fix:** Optionally add a hint to the Remaining tooltip.

---

_Reviewed: 2026-10-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
