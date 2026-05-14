---
quick_id: 260514-k2u
phase: quick
plan: 260514-k2u
subsystem: WikiRenderer
tags: [bugfix, tailwind, prose, callout, panel]
dependency_graph:
  requires: []
  provides: [callout-prose-margin-reset]
  affects: [WikiRenderer, IssueDetailContent]
tech_stack:
  added: []
  patterns: [tailwind-arbitrary-variants, tdd]
key_files:
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
decisions:
  - "Surgical first/last-child reset chosen over prose-p:my-0 to preserve inter-paragraph spacing inside multi-paragraph panels"
  - "Fix applied uniformly to all four callout types (panel, info, warning, note) since all share the same calloutStyles formula and all had the same doubled-padding defect"
metrics:
  duration: ~5 minutes
  completed: 2026-05-14
---

# Quick Task 260514-k2u: Jira Panel Internal Padding Fix — Summary

**One-liner:** `prose-sm` paragraph margins cascade into callout `<div>`s, making the first/last `<p>` top/bottom margin stack on top of `p-3`, producing ~28-30px apparent padding; fixed by appending `[&>p:first-child]:mt-0 [&>p:last-child]:mb-0` to all four `calloutStyles` entries.

## Root Cause

`WikiRenderer` wraps all output in `<article class="prose prose-sm dark:prose-invert max-w-none">`. Tailwind Typography (`prose-sm`) injects approximately 1.14em top and bottom margin on every `<p>` element. When a `{panel}` (or `{info}` / `{warning}` / `{note}`) callout is rendered, its `<div>` lives inside `prose`, so its `<p>` children inherit those margins. The first `<p>` top margin (+~16px) stacks on top of the panel's own `p-3` top padding (+12px), and the last `<p>` bottom margin stacks on the bottom `p-3` — producing the "huge padding" the user saw (~28-30px vs the expected ~12px).

## Fix

In `taskflow/src/routes/dashboard/WikiRenderer.tsx`, appended `[&>p:first-child]:mt-0 [&>p:last-child]:mb-0` to all four entries in the `calloutStyles` map (`info`, `warning`, `note`, `panel`). These Tailwind arbitrary-variant utilities zero out the top margin of the first `<p>` child and the bottom margin of the last `<p>` child — surgically removing only the doubled-padding at the edges. Spacing between paragraphs inside a multi-paragraph panel is preserved (only first and last are zeroed). Non-callout prose is entirely unaffected.

The fix also covers the `<span data-callout>` variant used for callouts inside table cells, since both the `div` and `span` renderers consume the same `calloutStyles[calloutType]` string.

## TDD Gate

- **RED commit:** `5a72844` — test(260514-k2u): add failing regression test for callout first/last-child margin reset
- **GREEN commit:** `131f813` — feat(260514-k2u): zero first/last-child paragraph margins inside callout panels
- All 40 WikiRenderer tests pass after fix.

## Commits

| Phase | Hash | Message |
|-------|------|---------|
| RED | 5a72844 | test(260514-k2u): add failing regression test for callout first/last-child margin reset |
| GREEN | 131f813 | feat(260514-k2u): zero first/last-child paragraph margins inside callout panels |

## Task 2: Human Verification (Pending UAT)

**Status:** Pending human verification — not auto-executable per plan constraints.

**What to verify:**
1. Start dev server: `cd taskflow && npm run dev`
2. Navigate to any Jira issue with a `{panel}...{panel}` macro in its description
3. Confirm top padding inside the panel looks approximately equal to bottom padding (~12px from `p-3`)
4. Confirm first line of text sits close to the panel's top inner edge (no extra ~16px whitespace above)
5. Confirm last line of text sits close to the panel's bottom inner edge (no extra ~16px whitespace below)
6. If multiple paragraphs inside panel: confirm spacing between them still looks prose-like (not collapsed to zero)
7. Confirm description prose outside the panel still has normal `prose` spacing
8. Optionally check `{info}`, `{warning}`, `{note}` macros for same tightened spacing

**Resume signal:** Type "approved" or describe any residual spacing issue (e.g., "still too loose at top of panel" / "panel paragraphs now too tight").

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- taskflow/src/routes/dashboard/WikiRenderer.tsx: modified (calloutStyles map updated)
- taskflow/src/routes/dashboard/WikiRenderer.test.tsx: modified (regression test added)
- RED commit 5a72844: FOUND
- GREEN commit 131f813: FOUND
- All 40 tests pass
