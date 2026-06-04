---
status: diagnosed
trigger: "after releasing a drag that auto-scrolled, clicks select rows NOT under the pointer (visual != hit-test)"
created: 2026-06-04
updated: 2026-06-04
---

## Current Focus

hypothesis: No-op / same-index drop after autoScroll never fires the mutation, so the sortable sibling transforms applied during the drag are not cleared by a React re-render, and the source row's opacity:0 / transform state is left stale — rows render shifted from their hit-test boxes.
test: read handleDragEnd no-movement branch, resolveIntraRankFromDrop null path, dragStyle reset path in BacklogRow, dnd-kit scroll-compensation internals
expecting: confirm a path where over!=null but rank===null returns early with no state change
next_action: return diagnosis (root-cause-only mode)

## Symptoms

expected: After a drag that auto-scrolled, releasing returns the page to a consistent state where clicks hit the row under the cursor.
actual: After a drag THAT CAUSED AUTOSCROLL, clicking a row selects/peeks a DIFFERENT row than the one visually under the cursor. A drag with no scroll is fine.
errors: none (visual/interaction desync)
reproduction: Drag a row near top/bottom edge so list auto-scrolls; release; click any row -> wrong row selected.
started: After commit 4f0cfdd3 (portal + MeasuringStrategy.Always) fixed the during-drag clone drift.

## Resolution

root_cause: see ROOT CAUSE below
fix: not implemented (diagnose-only)
verification: empty
files_changed: []
