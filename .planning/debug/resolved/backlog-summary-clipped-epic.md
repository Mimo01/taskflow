---
slug: backlog-summary-clipped-epic
status: resolved
trigger: "in backlog view, the summary title gets overriden in the ui by the epic, even though the epic is not that long. the longest epic is taken as the width of the column"
created: 2026-05-31
updated: 2026-05-31
---

# Debug Session: backlog-summary-clipped-epic

## Symptoms

- **Expected:** In the backlog view, the summary/title column should get the room it needs; the epic column should size to its own content, not steal width from the summary.
- **Actual:** The summary title is truncated/clipped because the column is too narrow. The longest epic value is being taken as the width of the (epic) column, squeezing the summary title.
- **Error messages:** None (visual/layout bug).
- **Timeline:** Unknown — user not sure if it ever rendered correctly.
- **Reproduction:** Open the backlog view; rows where the epic value is long cause the summary title to be clipped.

## Current Focus

- hypothesis: Backlog `<table>` uses default `table-auto` layout; the epic `<td>`/`<th>` are `whitespace-nowrap` with no max-width, so the epic column grows to fit the longest epic name and steals width from the Summary column.
- test: Inspected BacklogPage.tsx table element and BacklogRow.tsx cell classes.
- expecting: Epic column unbounded under auto layout → confirmed.
- next_action: (resolved)
- reasoning_checkpoint: (none)

## Evidence

- timestamp: 2026-05-31 — `BacklogPage.tsx:157` renders `<table className="w-full text-sm">` with NO `table-fixed`, so the browser uses automatic table layout (columns sized to widest cell content).
- timestamp: 2026-05-31 — `BacklogRow.tsx` Summary `<td>` uses `max-w-0 w-full ... truncate` — a trick that only constrains correctly when sibling columns are bounded.
- timestamp: 2026-05-31 — `BacklogRow.tsx` Epic `<td>` was `whitespace-nowrap` with NO max-width; under auto layout it expands to the longest epic name, squeezing the Summary column → clipped summary.

## Eliminated

- Not an overlap/z-index issue — confirmed visual squeeze, no error messages.
- Not a data/field-mapping issue — epic name resolution (`BacklogRow.tsx:166-170`) is correct.

## Resolution

- root_cause: The backlog `<table>` uses automatic layout (`table-auto`, no `table-fixed`), and the Epic column cells/header were `whitespace-nowrap` with no max-width, so the column grew to fit the longest epic name and stole width from the Summary column, clipping the summary title.
- fix: Capped the Epic column at `max-w-[12rem]` on the epic `<td>` and made the epic badge truncate its label (`max-w-full overflow-hidden` on the button + `truncate` span around the name, full text preserved in the existing `title` tooltip). Summary cell continues to absorb remaining space and truncate.
- verification: `npm run check` (biome + tsc) clean; `tsc --noEmit` exit 0; `vitest run src/routes/dashboard` → 405 passed / 2 skipped / 13 todo, 0 failures.
- files_changed: taskflow/src/routes/dashboard/BacklogRow.tsx

## Specialist Review

- typescript-expert (inline): LOOKS_GOOD — `max-w-[N]` cap on the cell is the correct lever under `table-auto`; truncation pattern (`max-w-full overflow-hidden` + `truncate` span) is idiomatic Tailwind; full epic text preserved via `title` tooltip so no a11y regression. No clipping for short epics since the cap only engages past 12rem.
