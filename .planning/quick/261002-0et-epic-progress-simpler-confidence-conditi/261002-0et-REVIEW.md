---
phase: 261002-0et
reviewed: 2026-10-02T00:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 261002-0et: Code Review Report

**Depth:** quick (with targeted reads of the summary, zoom and risk code)

Biome: `npx biome check` on the 8 files, run from `taskflow/`, reports 0 errors and 0 warnings. Running it with paths prefixed `taskflow/` from inside `taskflow/` fails with "No files processed". Use paths relative to `taskflow/`.

The render-phase `setZoom` reset is loop-safe. After one reset the condition `preset !== 'all' || range !== null` is false, so React re-renders once and stops. `visiblePresets` always includes `'all'` and returns `[]` unless a second preset survives.

## Warnings

### WR-01: Overdue risk lost its issue list
**File:** `taskflow/src/lib/epic-progress.ts:1465-1471`
**Issue:** The `overdue` risk used `...keysOf(open)`. It now sets `issues: []`, so its popover shows only the detail text ("Due X with N open items") and no rows. Every other count-based risk lists issues. If this was not an intentional descope, it is a regression. The popover trigger also still looks clickable.
**Fix:** Use `...issuesOf(open)` for `overdue`. If it is intentionally empty, document that and render the popover without an empty list.

### WR-02: Blank summary renders an empty row
**File:** `taskflow/src/lib/epic-progress.ts:1438`, `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:279-281`
**Issue:** `summary ?? ''` only covers null/undefined. An empty or whitespace summary renders a row with only the key. The row is still clickable, but its accessible name is just the key.
**Fix:** Use `s.fields.summary?.trim() || s.key`, or `'(no summary)'` in the UI.

### WR-03: Confidence reason is truncated in the tooltip
**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:196-201`
**Issue:** The reason `div` has `max-w-64 truncate`. A 60-character reason is wider than 16rem at text-xs. The reason that this iteration moved into the Finish tooltip can therefore be clipped, and the tooltip surface gives no way to read the rest. It is also not announced as part of the confidence row.
**Fix:** Drop `truncate` and use `whitespace-normal` (or `max-w-72`). Alternatively, enforce a smaller `CONFIDENCE_REASON_MAX`.

### WR-04: Popover keyboard handling is incomplete
**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:222-232`
**Issue:**
- Home and End are not handled.
- When `onOpenIssue` is absent the popover has no focusable content. `initialFocus` falls back to `true`, which focuses the popup container.
- The `button[data-testid=...]` selector ties behaviour to a test id.
- There is no roving tabindex, so Tab walks all rows. This is acceptable, but `max-h-48` scrolling relies on `focus()` scrolling the row into view.
**Fix:** Add Home/End cases. Query by `'li > button'`, or use a ref list.

## Info

### IN-01: Stale header comment
**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:4-5, 59`
**Issue:** The comment "the Risks tile opens an one-line risk buttons" is garbled. The `onOpenIssue` doc still says "risk keys call it" and refers to "Stories rows".
**Fix:** Reword the comments.

### IN-02: Zoom-reset state during render lacks a guard comment on the epoch
**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:259-262`
**Issue:** `setZoom` is called inline in render, which is valid for the component's own state. However, it uses a functional updater that bumps `epoch`, so a concurrent or StrictMode double-render queues two bumps. This is harmless, but a `useEffect`-free guard such as `zoom.epoch` is not needed because the condition is idempotent. Consider setting an absolute value (`epoch: zoom.epoch + 1`) to keep the update idempotent.
**Fix:** Optional. Use a non-functional update.

### IN-03: Minor duplication and unused-ish API
**File:** `taskflow/src/lib/epic-progress.ts:1718`, `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:279-290`
**Issue:**
- `CONFIDENCE_REASON_MAX` is used only by tests.
- The two row bodies (button and div) duplicate the key and summary spans.
- `ZoomPresets` re-checks `enabled` and domain validity. `visiblePresets` already guarantees `enabled`.
**Fix:** Extract a `RowContent` component. Keep the guards or drop the duplicate check.

No leftovers were found of `RISK_VISIBLE_KEYS`, `issueKeys` or `brushIndexes` in `src`. The `issueKeys` hits in `services/jira.ts` are unrelated.

_Reviewer: Claude (gsd-code-reviewer)_

---

## Disposition (orchestrator)

Fixed in the commit after e957e20a (which also fixed the sqm source-flag biome error found during this round).

| ID | Disposition |
|----|-------------|
| WR-01 | Fixed — overdue lists open items (tests updated intentionally; proven to fail pre-fix) |
| WR-02 | Fixed — trimmed summary, "(no summary)" placeholder (new test, proven to fail pre-fix) |
| WR-03 | Fixed — reason wraps (truncate removed; reason already capped at 60 chars) |
| WR-04 | Fixed — Home/End added; plain-text rows (no opener) intentionally have no focus targets |
| IN-01 | Fixed — header comment |
| IN-02, IN-03 | Not changed |
