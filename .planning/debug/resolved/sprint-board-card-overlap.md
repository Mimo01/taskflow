---
slug: sprint-board-card-overlap
status: resolved
trigger: "on sprint board on smaller screens the cards of subtasks get misaligned out of their columns"
created: 2026-06-01
updated: 2026-06-01
---

# Debug: sprint-board-card-overlap

## Symptoms

- expected: On the sprint board, at narrow browser widths all cards stay contained within their status column boundaries.
- actual: At narrow browser widths cards overlap/bleed into the adjacent column visually.
- reproduction: Resize the desktop browser window narrower until columns get tight.
- scope: Affects all cards (not only subtask cards), per user observation.
- timeline: Always / unsure — no known good state reported.
- errors: None reported (visual/layout bug).

## Current Focus

- hypothesis: Confirmed — flexbox `min-width: auto` on the three `flex-1` column cells prevents them shrinking below intrinsic content width at narrow viewports.
- test: Inspect column-cell flex classes in SprintBoardTab for a missing `min-w-0`.
- expecting: Column cells use `flex-1` without `min-w-0`, so unbreakable content keeps them from shrinking.
- next_action: (resolved)
- reasoning_checkpoint: (none)

## Evidence

- timestamp: 2026-06-01 — Swimlane body columns rendered as `<div className="flex bg-muted/10">` with three children each `className="flex-1 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20"` (SprintBoardTab.tsx lines 367-373 virtualized path, 479-485 fallback path). No `min-w-0` on the flex children.
- timestamp: 2026-06-01 — TaskCard root is `w-full` (TaskCard.tsx line 95) and contains unbreakable content: monospace issue key span (`text-xs font-mono`, not truncated, line 111-120), issue-type name, and a status pill. These establish an intrinsic minimum content width.
- timestamp: 2026-06-01 — Per CSS flexbox spec, a flex item defaults to `min-width: auto`, which is the larger of its content's min-content size. With three such siblings sharing a container, the columns cannot shrink below their combined content min-width, so when the viewport narrows past that threshold the columns overflow the container and bleed into one another.
- timestamp: 2026-06-01 — Header row column cells (lines 1075-1083) had the same `flex-1` without `min-w-0`, with the label "In Progress" as the widest unbreakable text, so headers desynced from body columns under width pressure too.

## Eliminated

- timestamp: 2026-06-01 — Subtask-specific styling ruled out: `isSubtask && 'border-l-2 border-l-muted'` only adds a left border; user confirmed all cards (not just subtasks) overlap, consistent with a column-level layout cause rather than a card-type cause.
- timestamp: 2026-06-01 — Virtualizer transform offsets ruled out as the cause: overflow is horizontal (column width) not vertical (row positioning), and reproduces independent of scroll.

## Resolution

- root_cause: The three status-column cells inside each swimlane are `flex-1` flex items with the default `min-width: auto`. Unbreakable card content (monospace issue key, issue-type label, status pill) sets an intrinsic minimum width, so at narrow viewport widths the columns refuse to shrink below their content and overflow/overlap into adjacent columns. The matching fixed header cells had the same omission.
- fix: Added `min-w-0` to all status-column flex cells (both the virtualized render path and the non-virtualized fallback path) and to the fixed header column cells, allowing them to shrink below content width. Made the header label `truncate` and the count `shrink-0` so the header text yields gracefully under the same width pressure.
- verification: `npm run check` (biome check + tsc --noEmit) passes clean — 438 files, no fixes/errors. Layout fix is purely additive Tailwind classes; existing line-clamp/truncate inside TaskCard now takes effect once parent columns can shrink.
- files_changed:
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx (column body cells x2, header cell + label/count spans)
</content>
</invoke>
