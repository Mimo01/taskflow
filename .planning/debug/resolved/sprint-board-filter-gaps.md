---
slug: sprint-board-filter-gaps
status: resolved
trigger: "On sprint board, when I filter tasks there are gaps left in the UI. When I unfilter some tasks are not snapped to where they should be. Scrolling then fixes it. Make it consistent"
created: 2026-05-31T01:17:17Z
updated: 2026-05-31T01:30:00Z
---

# Debug Session: sprint-board-filter-gaps

## Symptoms

- **Expected:** Filtering the sprint board removes hidden tasks cleanly with no empty gaps; unfiltering snaps all tasks back to their correct positions immediately.
- **Actual:** Filtering leaves empty gaps in the UI where hidden tasks were. Unfiltering leaves some tasks not snapped to where they should be. Scrolling the board then corrects the layout.
- **Errors:** None — purely visual.
- **Timeline:** Unknown / possibly always present.
- **Reproduction:** Apply any filter on the sprint board (quick filter / search box, or assignee/label filter chips), then clear it. Triggered by any filtering mechanism.

## Current Focus

- hypothesis: itemSizeCache is keyed by index (default getItemKey); filtering remaps stories to indices that hold another story's cached height
- test: set getItemKey to the stable story.key so each story carries its own measured height across filter changes
- expecting: gaps disappear immediately after filtering AND unfiltering, no scroll needed
- next_action: RESOLVED (v2) — getItemKey fix applied after measure() band-aid failed
- reasoning_checkpoint: virtual-core/index.js:483,500 — measurements use `itemSizeCache.get(getItemKey(i))`; default getItemKey = (i)=>i. On filter, index N now points to a different story but reuses the prior occupant's cached px height → wrong start/end offsets → gaps + misalignment. Scroll calls _measureElement per visible row (reads data-index), fixing them one by one. The earlier `measure()` effect ran post-paint and wiped the whole cache (everything back to 120px estimate, then async re-measure) — unreliable, so the bug persisted. Real fix: getItemKey:(index)=>filteredSwimlanes[index]?.story.key — cache follows the story, correct on first paint.

## Evidence

- timestamp: 2026-05-31T01:18:00Z
  file: src/routes/dashboard/SprintBoardTab.tsx
  finding: useVirtualizer at line 129 uses estimateSize=120 and measureElement for actual heights; no cache invalidation on count change

- timestamp: 2026-05-31T01:19:00Z
  file: node_modules/@tanstack/virtual-core/dist/esm/index.d.ts line 154
  finding: Virtualizer exposes `measure(): void` — the public API for full cache invalidation

- timestamp: 2026-05-31T01:20:00Z
  finding: filteredSwimlanes is computed inline (not memoised) — changes every render when filters change; count passed to useVirtualizer will change but itemSizeCache is NOT cleared by the library on count change

## Eliminated

- React key issues — the VirtualizedSwimlanes component is not remounted on filter change; no key prop on the component
- CSS / grid issues — gridTemplateRows transition is correct; gaps are position-based not height-based
- Missing re-render — filteredSwimlanes prop is correctly updated; the virtualizer receives new count

## Resolution

- root_cause: @tanstack/react-virtual v3.13.23 keys its `itemSizeCache` by `getItemKey(index)`, which defaults to the index. The swimlane virtualizer used the default, so measured row heights were cached by position. When a filter changes which story occupies each index, the recomputed measurements (virtual-core/index.js:500) reuse the previous occupant's cached height for that index — producing wrong translateY offsets and total height, i.e. gaps and misaligned rows. `_measureElement` (data-index based) re-measures only visible rows on scroll, which is why scrolling corrected it one row at a time.
- fix (v1, FAILED): a post-paint `useEffect` calling `swimlaneVirtualizer.measure()` keyed on `filteredSwimlanes.length`. measure() wipes the whole cache → everything falls back to the 120px estimate → async ResizeObserver re-measure. Ran after the bad paint and relied on re-measure timing; bug persisted (user-confirmed).
- fix (v2, APPLIED): `getItemKey: (index) => filteredSwimlanes[index]?.story.key ?? index` on useVirtualizer; removed the measure() effect. Each story now carries its own measured height keyed by story.key, so offsets are correct on the first paint after any filter change — no scroll needed. Verified consistent with the library's _measureElement path (index → getItemKey → same key).
- verification: `npm run check` clean (438 files, 0 errors). Manual UAT pending: filter then clear on the sprint board — expect no gaps and immediate snap with no scroll.
- files_changed: taskflow/src/routes/dashboard/SprintBoardTab.tsx
