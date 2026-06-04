---
status: investigating
trigger: "when i drag and the page auto scrolls, the layout gets a little broken and the drag is not happening where the cursor is"
created: 2026-06-04T00:00:00Z
updated: 2026-06-04T00:00:00Z
---

## Current Focus

hypothesis: DragOverlay/measuring/modifier desync vs. autoscrolling virtualized container
test: read DndContext config, scroll container, virtualizer positioning
expecting: identify which scroll container autoscrolls and whether measuring/modifier accounts for scroll delta
next_action: read BacklogPage.tsx, BacklogRow.tsx, backlogDragHelpers.ts fully

## Symptoms

expected: dragged clone tracks cursor; layout stable during autoscroll
actual: on autoscroll, layout breaks slightly AND clone/drop position desyncs from cursor
errors: none (visual)
reproduction: drag a backlog row near viewport edge to trigger dnd-kit autoScroll
started: phase 78 (drag-to-rank), only when autoscroll engages

## Eliminated

- hypothesis: Virtualization remount/offset shift causes desync (H2)
  evidence: VirtualizedBacklogTable sets useVirtual=false (BacklogPage.tsx:143). No rows are absolutely positioned; all rows render in normal flow. Virtualizer is instantiated but unused. So virtual remount is NOT the cause.
  timestamp: 2026-06-04
- hypothesis: restrictToVerticalAxis pins overlay Y ignoring scroll delta (H3)
  evidence: modifier only zeroes transform.x (modifiers cjs:76-83). It runs on `transform` BEFORE scrollAdjustment is added (core cjs:2956 vs 2980). It is not the mechanism; the overlay-vs-scroll-container nesting is (see Evidence).
  timestamp: 2026-06-04

## Evidence

- timestamp: 2026-06-04
  checked: DndContext config (BacklogPage.tsx:1251-1257)
  found: Only sensors, collisionDetection, modifiers=[restrictToVerticalAxis], onDragStart, onDragEnd. NO `measuring` prop, NO `autoScroll` prop.
  implication: droppable strategy defaults to WhileDragging (measured once at drag start, not re-measured during scroll); autoScroll defaults ON.
- timestamp: 2026-06-04
  checked: scroll container structure
  found: TWO nested overflow-auto containers — outer div.h-full.overflow-auto (line 1131) and inner div ref=scrollRef.flex-1.overflow-auto (line 1200). DndContext + DragOverlay render INSIDE the inner one (1251-1308). DragOverlay is NOT portaled to body.
  implication: autoScroll scrolls the inner container; the overlay's transform is relative to its in-flow parent inside that same scrolling container.
- timestamp: 2026-06-04
  checked: dnd-kit core overlay transform math (core.cjs.development.js:2974-2994)
  found: line 2993 `appliedTranslate = usesDragOverlay ? modifiedTranslate : add(modifiedTranslate, activeNodeScrollDelta)`. When a DragOverlay is used, scroll delta is NOT added to the overlay transform — dnd-kit assumes the overlay lives in a viewport/fixed coordinate space (portal at body) and stays under the pointer while content scrolls beneath it.
  implication: Because this DragOverlay is mounted inside the scrolling container (not portaled), it scrolls WITH the content during autoScroll while the pointer stays fixed in the viewport → clone drifts away from cursor by the scroll delta. ROOT CAUSE.
- timestamp: 2026-06-04
  checked: default measuring (core.cjs:2475-2487, 2060-2068)
  found: droppable.strategy = WhileDragging → isDisabled returns !dragging, so droppable rects are cached at drag start and not refreshed while scrolling.
  implication: Secondary desync — drop targets/collision use stale rects after the container scrolls, contributing to "drop not where cursor is" and the layout/gap appearing in the wrong place.

## Resolution

root_cause: DragOverlay is rendered inside the inner overflow-auto scroll container instead of being portaled to the document body. dnd-kit does NOT add scroll delta to the overlay transform when a DragOverlay is used (core.cjs:2993), assuming the overlay lives in viewport space. When dnd-kit autoScroll scrolls the inner container near the edge, the in-flow overlay scrolls with the content while the pointer stays fixed → cursor desync. Compounded by default measuring (droppable strategy WhileDragging → droppable rects cached at drag start, never re-measured during scroll → stale drop targets / misplaced gap = "layout broken").
fix: (direction only) 1) Render DragOverlay in a body portal so it is positioned in viewport coords (wrap with createPortal or use dnd-kit's portal pattern). 2) Set measuring={{droppable:{strategy:MeasuringStrategy.Always}}} on DndContext so droppable rects re-measure during scroll. Optionally collapse to a single scroll container.
verification:
files_changed: []
