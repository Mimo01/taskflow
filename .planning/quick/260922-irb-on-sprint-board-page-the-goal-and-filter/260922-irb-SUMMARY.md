---
status: complete
---

# Quick Task 260922-irb: Sprint Board sticky header + goal restyle — Summary

**Date:** 2026-09-22
**Commits:** `309484a0`, `40890b3d`

## What changed

- Sprint name, goal, quick-filter chips, and the unified filter bar are now hoisted into fixed (`shrink-0`) chrome above the column headers on the Sprint Board, so they stay visible while the board scrolls. CSS `position: sticky` was deliberately avoided — it conflicts with the existing JS-driven sticky swimlane overlay and the virtualizer's transform-based positioning.
- New `SprintBoardHeader` component replaces the old `SprintGoalBanner`: shows the sprint name (`text-sm font-semibold`, matching Backlog section titles) with a state badge, and the goal as smaller de-emphasized text on the same line. No icon (removed after UAT feedback).
- Sprint name now renders whenever `activeSprint` exists, not gated on `activeSprint.goal` being truthy (fixed a gap where the name would disappear if no goal was set).
- Visual polish pass after UAT: Backlog-consistent `bg-muted/40` + solid `border-b` on the sprint header; elevation shadow at the fixed-chrome/scrollable-board boundary; matching but much subtler shadow treatment on story/task rows — inset top shadow on normal rows (visible against stacked opaque siblings), elevation shadow on the sticky/pinned row.

## Deviations from plan

- Tasks 1 and 2 were combined into a single commit (pre-commit hook runs the full test suite; an intermediate commit with `SprintGoalBanner` deleted but still imported would fail).
- Post-approval, several rounds of visual refinement were done inline (icon removed, text sizing matched to Backlog, shadow/border treatment added to both the header boundary and story rows) based on direct user feedback during UAT — no replanning needed, changes were small and line-precise.

## Verification

User manually verified in-app: sprint name visible, header/chips/filters stay fixed while scrolling, sticky swimlane header still pins/pushes correctly, one-line at all densities, drag-and-drop unaffected. Approved.
