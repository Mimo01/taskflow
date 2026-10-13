---
phase: 261013-jl3
reviewed: 2026-10-13T00:00:00Z
depth: quick
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/lib/aio-cycle-list.ts
  - taskflow/src/routes/dashboard/AioCycleList.tsx
  - taskflow/src/routes/dashboard/AioFolderPanel.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/services/aio/cycles.ts
  - taskflow/src/services/aio/types.ts
  - taskflow/src/stores/aio-cycles-selection.store.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 261013-jl3: Code Review Report

**Depth:** quick (targeted reads of the focus areas; tests not reviewed)

## Summary

The focus areas hold up in most places. `fetchAioCyclesWithDetail` always terminates. The query keys for 0 (All) and -1 (Ungrouped) are distinct. Folder rows and overlay buttons have no nested interactive elements. The warnings below are real behavioural defects. None is a security issue and none loses data.

Checked and found sound:
- **Pagination termination.** The loop breaks on `isLast !== false`, an empty page, or a page that adds no new IDs. Otherwise `startAt` advances by the page length. Duplicate IDs are deduplicated by `seen`.
- **Query keys.** 0, -1 and a folder ID are separate cache entries. `activeFolderIds` is `[]` for 0, `[-1]` for -1, and the subtree for a folder.
- **Aggregation.** `aggregateFolderCounts` is correct if the count endpoint returns own-folder counts rather than rollups. That assumption is not documented, so verify it.

## Warnings

### WR-01: Empty-state flash before the delayed skeleton appears
**File:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx:~213`, `AioCycleList.tsx` body selection
**Issue:** `isLoading` is `useDelayedLoading(...)`, which stays false for the first 200 ms of every pending period. The query has no `placeholderData` and `data` is undefined, so `items` is `[]`. During that window `AioCycleList` falls through to `items.length === 0` and shows "No cycles in this folder". This happens on first load and on every folder switch. It is wrong information, and it flickers on fast loads.
**Fix:** Pass the real pending state to the list so it can suppress the empty state, and use the delayed flag only for the skeleton. For example, add an `isPending` prop and render `null` (or the skeleton) when `isPending && !showSkeleton`. Alternatively use `placeholderData: keepPreviousData` in the query.

### WR-02: Folder filter drops the children of a matching parent
**File:** `taskflow/src/lib/aio-cycle-list.ts:~173-186` (`filterFolderTree`)
**Issue:** When a folder's name matches the query but none of its children do, `kids` is empty. The node is emitted with `children: []`, so its subtree disappears and the chevron vanishes. A user who searches for a parent folder cannot expand it.
**Fix:** When the node itself matches, keep its original children:
```ts
const selfMatch = n.name.toLowerCase().includes(q);
if (selfMatch || kids.length > 0) {
  out.push({ ...n, children: selfMatch && kids.length === 0 ? n.children : kids });
}
```

### WR-03: Unknown or stale folder ID falls back to a one-element filter that may be wrong
**File:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx:~30-46, ~145-149`
**Issue:** `collectSubtreeIDs` returns `[rootID]` when the folder is not in the tree. If the tree refetches without the folder (deleted), the list keeps showing that folder's cycles with an empty label (`folderLabel` = `''`). The one-shot validation effect runs only once, so the stale selection is never reset. Separately, `activeFolderIds` is not part of the query key. When the tree changes (a child folder is added), the same key keeps serving the old subtree.
**Fix:** Include the joined IDs in the key (`activeFolderIds.join(',')`) or derive the key from them. Reset the selection to ALL when a selected folder ID > 0 is no longer found in the refreshed tree.

### WR-04: Paged fetch silently truncates on mid-pagination 404 and hides partial results
**File:** `taskflow/src/services/aio/cycles.ts:~258-261`
**Issue:** A 404 on a page after the first does `break` and returns the partial list with `isLast: true`. Truncated data looks complete. In addition, `page.isLast !== false` treats a missing `isLast` as "last", so a response without the field is silently capped at one page of 500.
**Fix:** Throw on a non-first 404, or compare `items.length` against `allIDs.length` after the loop and surface a warning or error if fewer items arrived than `allIDs` promised.

### WR-05: Contradictory and misplaced doc comment on `fetchAioCyclesWithDetail`
**File:** `taskflow/src/services/aio/cycles.ts:~188-196`
**Issue:** The JSDoc says "folderID param causes 500", but the function now sends `folderID` (including `[-1]` for Ungrouped). The comment is also attached to `PAGED_COLUMNS`, not the function. It is unclear whether the `IN [-1]` Ungrouped filter has been verified against the live API (it is the riskiest path).
**Fix:** Move and update the comment. Confirm the Ungrouped behaviour against the probe results, and cite them.

### WR-06: Progress math can produce nonsense when totals disagree
**File:** `taskflow/src/lib/aio-cycle-list.ts:~92-115`, `AioCycleList.tsx` ProgressCell
**Issue:** `total` is `summary.totalTests`, but the counts come from `testRunDistribution`. If the distribution sums to more than `total`, the segment widths exceed 100%. If `total` is 0 or undefined while counts are > 0, the tooltip shows `r.value / 0` as "Infinity%" or "NaN%". `passPct` can exceed 100.
**Fix:** Use `total = Math.max(summary.totalTests ?? 0, sumOfCounts)` and guard the tooltip percentage with `total > 0`.

## Info

### IN-01: Key cell blocks the row-click overlay
**File:** `taskflow/src/routes/dashboard/AioCycleList.tsx:~268-276`
**Issue:** The key cell uses `relative z-10 select-text cursor-text`, which sits above the overlay button. Clicking the key does nothing, although it is the most natural click target. This is probably intended so the key can be copied, but it is surprising. The progress tooltip trigger (`z-10`) intercepts clicks the same way. The tooltip is also hover-only and not keyboard reachable. The overlay button itself is correctly a sibling with an `aria-label`, so there is no nested interactive element.
**Fix:** Document the choice, or make the key cell `pointer-events-none` and offer copy on the detail page.

### IN-02: Header and column layout shifts as summaries load
**File:** `taskflow/src/routes/dashboard/AioCycleList.tsx:~223-228`
**Issue:** `hasEffort` depends on async summaries, so the Effort column appears after load and shifts the other columns. The dates and effort columns are `hidden @[...]:flex`, but the key column (`w-28`, nowrap) has no truncation, so long keys can overflow into the name cell.
**Fix:** Reserve the Effort column while `summariesLoading`, and add `truncate` or `overflow-hidden` to the key cell.

### IN-03: Store details
**File:** `taskflow/src/stores/aio-cycles-selection.store.ts:~36-38`
**Issue:** `version: 0` with a pass-through `migrate` adds nothing, and `statusFilter` was added without a version bump. This works because persist merges shallowly, but the invalid values `'open'|'all'` are not validated on rehydrate. `getSelectedFolder` is read through a getter inside effects, which is fine.
**Fix:** Drop the no-op `migrate`, or validate `statusFilter` in `merge`.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
