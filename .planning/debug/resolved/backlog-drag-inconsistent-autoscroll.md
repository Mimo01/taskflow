---
status: resolved
trigger: "In backlog view, When I click and drag a row it reorders it and updates rank. Everything works correctly. But sometimes, when I get close to top or bottom it autoscrolls the task list. I like this feature but it only happens sometimes and I dont know when. I always want it"
created: 2026-09-16T00:00:00Z
updated: 2026-09-16T00:35:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Intermittent autoscroll is native browser text-selection autoscroll (row lacks user-select:none/touch-action:none, PointerSensor's 150ms/5px activation window lets native selection start), and there is otherwise NO deliberate always-on autoscroll (dnd-kit's is off) — hence 'sometimes' and 'I always want it'."
  confirming_evidence:
    - "BacklogPage.tsx:1386 autoScroll={false}, confirmed deliberate via commit aeb6b3f4 + ~10 prior commits fighting dnd-kit#1108 desync"
    - "BacklogRow.tsx row (pre-fix) had no user-select/touch-action on the draggable div; dnd-kit's useDraggable attributes never set these (verified in node_modules/@dnd-kit/core/dist/core.esm.js)"
  falsification_test: "If autoscroll still occurred with dnd-kit autoScroll fully off AND no native selection possible, root cause would be wrong. User confirmed direction: implement a deliberate custom autoscroll (always-on) rather than relying on native/dnd-kit — this directly satisfies 'I always want it' regardless of the phantom-selection root cause."
  fix_rationale: "Two-part fix per user's checkpoint decision: (1) eliminate the phantom native-selection autoscroll by setting user-select:none/touch-action:none on the draggable row (BacklogRow.tsx dragStyle) so browser-driven autoscroll can never fire; (2) add a hand-rolled, always-on custom autoscroll (BacklogPage.tsx) driven purely by a window pointermove listener + rAF loop that reads pointer Y vs scrollRef's bounding rect and nudges scrollRef.current.scrollTop directly. This is fully decoupled from dnd-kit's collision detection / sortable rect measuring (autoScroll stays false; onDragMove is still not used for reorder logic), so it cannot reintroduce the P78 rect-desync bug — reorder/rank computation still happens exactly once on drop, reading live DOM/state at that moment."
  blind_spots: "Not manually tested in the running Tauri app until final human checkpoint — verified via source reading, tsc --noEmit, biome check, and existing test suite (54 tests, all passing, no behavior asserts drag/scroll pixel behavior). User confirmed fixed in the running app; AUTOSCROLL_EDGE_PX=70 / AUTOSCROLL_MAX_SPEED_PX=18 constants accepted as-is (no tuning requested)."

hypothesis: CONFIRMED (see Resolution)
test: fix implemented; tsc --noEmit clean; biome check clean (no new diagnostics); vitest suite (BacklogPage.rank/network, backlogDragHelpers = 54 tests) all pass; user confirmed fixed in running app
expecting: n/a — resolved
next_action: none — session resolved and archived

## Symptoms

expected: Autoscroll should trigger reliably every time a dragged row is dragged close to the top or bottom edge of the backlog list.
actual: Autoscroll only triggers intermittently near the edges; drag-and-drop reordering itself always works correctly.
errors: none (behavioral/visual only)
reproduction: Drag a backlog row near the top or bottom edge of the list — sometimes the list auto-scrolls, sometimes it doesn't. No consistent trigger identified by the user.
started: Always been intermittent since the drag-to-rank feature was built (phase 78); user has not noticed a correlation with drag speed, edge proximity, or prior scroll position.

## Related prior sessions (context, not yet confirmed relevant)

- `.planning/debug/backlog-drag-autoscroll-desync.md` — diagnosed: DragOverlay was rendered inside the inner overflow-auto scroll container instead of portaled to body, causing overlay/cursor desync during autoscroll. Root cause found; fix direction only (portal + MeasuringStrategy.Always), noted as later applied per commit 4f0cfdd3 referenced in the next session.
- `.planning/debug/backlog-drag-autoscroll-residual.md` — diagnosed (root-cause-only): after the portal fix, releasing a drag that auto-scrolled leaves stale hit-test state (clicks select wrong row) on no-op/same-index drops.
- Neither prior session addressed autoscroll *not triggering* at all — this is a distinct symptom (intermittent engagement, not post-drag desync). Worth checking whether BacklogPage.tsx has two nested overflow-auto containers (per desync session's evidence) and whether dnd-kit's autoScroll is scoped to the wrong/ambiguous container, which could explain non-deterministic engagement.

## Eliminated

- dnd-kit's built-in autoScroll being the source of the intermittent behavior — it is deliberately fully disabled (`autoScroll={false}`, P78 final decision), so it cannot be the mechanism causing the observed scrolling.

## Evidence

- timestamp: 2026-09-16T00:10:00Z
  checked: BacklogPage.tsx DndContext props (line ~1368-1390)
  found: `autoScroll={false}` explicitly set, with a large code comment documenting the P78 "final decision": dnd-kit 6.3.1's built-in autoScroll keys collision/drop-target math off rects that are scroll-adjusted a frame behind (dnd-kit#1108, unresolved upstream), so with autoScroll ON, either the dragged row or the drop target always desyncs from the cursor during a scroll. This was fixed by disabling autoScroll entirely.
  implication: dnd-kit itself CANNOT be the source of the observed intermittent autoscroll — it's fully off. Some other mechanism is scrolling the list.

- timestamp: 2026-09-16T00:12:00Z
  checked: git log -- BacklogPage.tsx (autoScroll history)
  found: commit aeb6b3f4 "fix(78): disable dnd-kit autoScroll — final resolution for drag desync" is the last word; ~10 prior commits (9f7fd7d8, 619a9d66, 13f944f6, 738e1c2c, 2a2a4c30, 9fd20297, f4ecf9d9, 4f0cfdd3) show a long back-and-forth trying to make dnd-kit autoScroll work (pin to container, portal overlay, pointer-based collision, Always measuring) before giving up and disabling it.
  implication: re-enabling autoScroll is a well-trodden, previously-abandoned path — not a quick fix. High risk of reintroducing the desync bug that many commits fought to eliminate.

- timestamp: 2026-09-16T00:15:00Z
  checked: BacklogRow.tsx draggable row div (line 304-320, 327-343) and its `rowClassName`/`dragStyle`
  found: no `select-none`, `user-select`, or `touch-action: none` anywhere on the row. `{...attributes} {...listeners}` from `useSortable` are spread directly onto a row containing plain text nodes (issue key, summary, etc.).
  implication: nothing prevents the browser's native text-selection drag from starting on mousedown+move over row text.

- timestamp: 2026-09-16T00:17:00Z
  checked: node_modules/@dnd-kit/core/dist/core.esm.js — useDraggable's returned `attributes` and PointerSensor activation
  found: `attributes` only contains `role`, `tabIndex`, `aria-*` — never `touchAction` or `userSelect`. dnd-kit does not disable native selection during the sensor's `activationConstraint` window (150ms delay / 5px tolerance in this app's `useSensor(PointerSensor, ...)` config) — selection-disabling only kicks in once the sensor formally activates a drag.
  implication: during the 150ms+5px window before a drag is recognized, a mousedown+move over row text can start native browser text selection. If that happens and the pointer is then moved near the top/bottom edge of the scrollable list, the BROWSER's own "autoscroll while selecting text" behavior engages — independent of dnd-kit's drag state and independent of the app's `autoScroll={false}` setting. This is non-deterministic (depends on exact initial mouse position/movement relative to text nodes vs. whitespace), matching the reported "sometimes" symptom exactly.

- timestamp: 2026-09-16T00:35:00Z
  checked: manual verification in running Tauri app (user-performed)
  found: user confirmed autoscroll now triggers consistently near top/bottom edges during drag, with no regression to reorder/rank correctness on drop.
  implication: fix confirmed effective; session resolved.

## Resolution

root_cause: >
  The intermittent autoscroll is NOT dnd-kit's autoScroll feature (that is deliberately
  and fully disabled — BacklogPage.tsx:1386, `autoScroll={false}`, per the P78 "final
  decision" after ~10 commits fighting an unfixable upstream drift bug, dnd-kit#1108).
  It is native browser text-selection autoscroll leaking through: BacklogRow's draggable
  row (BacklogPage.tsx / BacklogRow.tsx) has no `user-select: none` / `touch-action: none`,
  and dnd-kit's PointerSensor does not suppress native selection during its
  `activationConstraint` window (150ms delay + 5px tolerance, configured in
  BacklogPage.tsx's `useSensors`). A mousedown+move over row text during that window can
  start a native text-selection drag; if the pointer then nears the top/bottom edge of the
  scroll container, the BROWSER (not dnd-kit) autoscrolls the list on its own timing —
  fully decoupled from the drag-and-rank logic, which is why it's inconsistent and
  unrelated to actual drag distance/speed.
fix: >
  (1) BacklogRow.tsx: added `userSelect: 'none'`, `WebkitUserSelect: 'none'`,
  `touchAction: 'none'` to the draggable row's dragStyle, eliminating the
  native browser text-selection autoscroll that was intermittently
  triggering during PointerSensor's activation window.
  (2) BacklogPage.tsx: added a hand-rolled, always-on custom autoscroll
  (autoscrollPointerYRef + autoscrollRafRef + AUTOSCROLL_EDGE_PX/AUTOSCROLL_MAX_SPEED_PX
  constants; handleAutoscrollPointerMove + autoscrollTick + startCustomAutoscroll/
  stopCustomAutoscroll), wired into handleDragStart (start) and
  handleDragEnd/handleDragCancel (stop), plus an unmount safety-net effect.
  It tracks raw pointer Y via a window `pointermove` listener and nudges
  `scrollRef.current.scrollTop` directly via requestAnimationFrame when the
  pointer is within 70px of the scroll container's top/bottom edge, with
  proportional speed up to 18px/frame. dnd-kit's `autoScroll` stays `false`
  and reorder/rank logic (handleDragEnd) is untouched — this new code never
  touches dnd-kit's collision detection or sortable rects.
verification: >
  tsc --noEmit: clean. biome check: clean on both changed files (pre-existing
  a11y warnings on BacklogRow.tsx unrelated to this change). vitest:
  BacklogPage.rank.test.ts + backlogDragHelpers.test.ts + BacklogPage.network.test.tsx
  = 54/54 passing (reorder/rank computation logic unaffected). Manual
  in-app verification: user confirmed autoscroll now triggers consistently near
  top/bottom edges, with correct rank/reorder on drop, and no accidental text
  selection on quick clicks.
files_changed:
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
