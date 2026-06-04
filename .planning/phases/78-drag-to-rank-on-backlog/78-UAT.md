---
status: diagnosed
phase: 78-drag-to-rank-on-backlog
source: [78-01-SUMMARY.md, 78-02-SUMMARY.md, 78-03-SUMMARY.md, 78-04-SUMMARY.md]
started: 2026-06-04T12:12:42Z
updated: 2026-06-04T12:13:30Z
---

## Current Test

number: 3
name: No-flicker during background refetch + autoscroll-during-drag (re-verify after fix)
expected: |
  Drag a row near the top/bottom edge so the list auto-scrolls during the drag.
  The layout stays intact and the dragged clone stays under the cursor. Also: a
  background refetch does not make the list jump or revert.
awaiting: user response (re-verification of fix 4f0cfdd3)

## Tests

### 1. Intra-section drag-to-rank + persistence
expected: Press-hold ~150ms, drag a row within its section; siblings slide to open a gap, a solid clone follows the cursor, source row hidden. On drop the row stays in the new spot (no jump-back) and the order persists after reload.
result: pass

### 2. Click vs drag disambiguation
expected: A quick click on a row still opens the issue peek panel. A drag (past the 150ms press-hold) does NOT open the peek on release.
result: pass

### 3. No-flicker during background refetch
expected: After dropping a row (or during a drag), a background refetch (e.g. window refocus) does not make the list jump or revert — the new order holds steady.
result: issue
reported: "when i drag and the page auto scrolls, the layout gets a little broken and the drag is not happening where the cursor is"
severity: major

### 4. Failure rollback banner
expected: If the rank save fails (offline / 403), the list rolls back to the pre-drag order and an inline banner "Couldn't save new order — reverted" appears.
result: skipped
reason: user skipped

### 5. Cross-section drag is a no-op
expected: Dragging a row into a different section does nothing — the row returns to its original position, no confirm dialog appears, and no sprint-membership change happens. (Moving between sprint/backlog is done via right-click "Move to Sprint / Move to Backlog".)
result: pass

## Summary

total: 5
passed: 3
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "During a drag, the page can auto-scroll without breaking layout or desyncing the dragged clone from the cursor"
  status: failed
  reason: "User reported: when i drag and the page auto scrolls, the layout gets a little broken and the drag is not happening where the cursor is"
  severity: major
  test: 3
  root_cause: "DragOverlay (BacklogPage.tsx:1284-1307) is rendered inline inside the inner overflow-auto scroll container (scrollRef div, line 1200) instead of being portaled to document.body. dnd-kit deliberately omits the scroll-delta from the overlay transform when a DragOverlay is used (core.cjs:2993: usesDragOverlay ? modifiedTranslate : add(..., activeNodeScrollDelta)), assuming the overlay lives in viewport/fixed coordinate space. Because the overlay is an in-flow child of the scrolling container, dnd-kit's built-in autoScroll scrolls the clone WITH the content while the pointer stays fixed — the clone drifts from the cursor by exactly the scroll delta. Compounded by missing measuring config: default droppable strategy is MeasuringStrategy.WhileDragging (rects cached at drag-start, never re-measured during scroll) → stale drop gap / collision targets = 'layout gets a little broken'. Virtualization ruled out (useVirtual hard-coded false at line 143)."
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      issue: "DragOverlay (lines 1284-1307) rendered inline inside DndContext, which sits inside the inner overflow-auto scroll container (scrollRef, line 1200); not portaled to body, so it translates relative to a scrolling ancestor."
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      issue: "DndContext props (lines 1251-1257) have no measuring config → droppable rects default to WhileDragging (cached at drag start, stale after autoScroll)."
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      issue: "Two nested overflow-auto containers (outer line 1131, inner line 1200); the inner scrollRef container is the one dnd-kit autoScrolls and is the overlay's scrolling ancestor."
  missing:
    - "Portal the DragOverlay content to document.body (createPortal) so the clone is positioned in viewport coordinates and stays under the cursor during autoScroll — primary fix."
    - "Add measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} to DndContext (import MeasuringStrategy from @dnd-kit/core) so row rects re-measure during scroll."
    - "Optional: collapse nested overflow-auto containers into one for deterministic autoScroll. Not required once overlay is portaled. Do NOT change virtualization or restrictToVerticalAxis (both ruled out)."
  debug_session: ".planning/debug/backlog-drag-autoscroll-desync.md"
  fix_applied: "commit 4f0cfdd3 — portaled DragOverlay to document.body + measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}. npm run check clean; vitest dashboard+jira 810 passed."
  reverify_result: "PARTIAL — during-drag clone now tracks the cursor (primary symptom fixed), but a RESIDUAL remains: after releasing a drag that auto-scrolled the page, the pointer is desynced and subsequent clicks select rows NOT under the pointer (visual position != hit-test position post-drop). New diagnosis below."

- truth: "After a drag that auto-scrolled the page, releasing returns the page to a consistent state — subsequent clicks select the row actually under the pointer"
  status: failed
  reason: "User reported (re-verify): when letting the drag handle go after drag, if the drag included scroll of the page, the pointer gets desynced and is selecting rows not under the pointer"
  severity: major
  test: 3
  root_cause: "After a drag that auto-scrolled the inner overflow-auto container, dnd-kit's drag-start active-node rect diverges from the post-scroll DOM layout (dnd-kit re-measures only droppables via MeasuringStrategy.Always, not the active node; its layout-shift compensation runs once and can't track continuous autoScroll). The no-op / early-return paths in handleDragEnd (lines 939/950/956/966) performed no state update, leaving rows' hit-test boxes unreconciled with their visual positions — subsequent native clicks selected the wrong row."
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      issue: "handleDragEnd early-return paths performed no reconciliation after a scrolled drag; dnd-kit DraggableMeasuring has no strategy toggle so the active-node rect can't be force-re-measured."
  missing:
    - "Force a reconciliation re-render on every drag-end exit path (setLocalOrder clone) so rows re-render and reset transforms/rects against the scrolled layout."
    - "FINAL FIX: remove the DragOverlay and drag the real row in place — dnd-kit's non-overlay path adds activeNodeScrollDelta to the transform, keeping the dragged row + drop target synced during autoScroll. The overlay path inherently skips that compensation, which no amount of measuring/re-render could fix."
  debug_session: ".planning/debug/backlog-drag-autoscroll-residual.md"
  fix_attempts: "1) commit 4f0cfdd3 portal overlay + droppable MeasuringStrategy.Always. 2) commit f4ecf9d9 forced drag-end reconcile re-render. 3) commit 738e1c2c single scroll container (outer overflow-hidden). 4) commit 9fd20297 autoScroll={false} (worked but user wanted autoscroll kept; reverted). 5) quick task 260604-knq commit 2a2a4c30: removed DragOverlay + createPortal, drag real row in place. 6) commit 9f7fd7d8 (dnd-kit#1108 root cause): autoScroll={{ canScroll: (el) => el === scrollRef.current }} — dnd-kit treated all 6 overflow auto/hidden ancestors (scrollRef + <main> + 4 nested shell wrappers in main.tsx) as scroll containers; pinning autoScroll to scrollRef alone fixed the FUNCTIONAL desync."
  resolution: "FUNCTIONAL desync RESOLVED (human-confirmed round 6): drop lands on the correct row and post-drop clicks hit the row under the cursor. Residual is COSMETIC ONLY — while the list is ACTIVELY autoscrolling, the dragged row trails the cursor by ~one frame (dnd-kit applies scroll-delta transform compensation one frame behind its rAF scroll); it self-corrects the instant scrolling stops or on drop. Inherent dnd-kit limitation; only mitigation is slowing autoScroll speed (tradeoff). Severity downgraded major→cosmetic."
