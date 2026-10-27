---
phase: 261027-iz9
reviewed: 2026-10-27T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/components/ui/empty-state.tsx
  - taskflow/src/routes/dashboard/aio-cycle/ExecutionsList.tsx
  - taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 261027-iz9: Code Review Report

**Depth:** quick (grep plus a full read of both list components, since the logic is small)

## Summary

The partition logic is sound. No rows are dropped from both sections.
- Executions: `normalizeStatus` maps every input to one of five keys, with a `notRun` default. Every run therefore lands in exactly one of `open` or `done`.
- Defects: `isDoneDefect` is a total boolean split.
- Hooks all run before the early returns.
- Sticky headers are wrapped per section, so each one releases at the end of its own section.
- `--aio-sticky-top` is defined on the scroll container in `AioCycleDetailPage.tsx:161`.
- No React Compiler hazards found. `renderSection` is a plain closure over render-scope values, and nothing reads module state.

Two warnings and three info items remain.

## Warnings

### WR-01: Undefined `runs` without loading or error shows false "All runs passed"

**File:** `taskflow/src/routes/dashboard/aio-cycle/ExecutionsList.tsx:495-528`
**Issue:** The skeleton renders only when `isLoading && !runs`. The empty state renders only when `runs !== undefined && runs.length === 0`. If `runs` is `undefined` and `isLoading` is false, the code falls into the sections branch. That can happen with a disabled query, a pending state before the first fetch, or an error that `isError` doesn't flag. In that case `counts` and `totalOpen` are 0, so the page shows "All runs passed" and "No passed runs yet" for data that was never loaded. I did not trace the caller to confirm which states it can pass.
**Fix:**
```tsx
) : runs === undefined ? null /* or skeleton */ : runs.length === 0 ? (
```
Alternatively, change the skeleton condition to `!runs && !isError`.

### WR-02: Clear-filters and no-match logic keyed on icon identity

**File:** `ExecutionsList.tsx:418` and `DefectsList.tsx:599`
**Issue:** `emptyIcon === ListFilter && anyFilterActive` uses the icon component as a proxy for "empty because of filters". The `emptyIcon`/`emptyTitle` ternaries are computed separately at the call sites (`ExecutionsList.tsx:517-525`, `DefectsList.tsx:685-694`). A later icon swap would silently drop the "Clear filters" button. The coupling is also hard to read.
**Fix:** Pass an explicit `filteredOut: boolean` (`total > 0`) to `renderSection` and derive the icon, title and action from it.

## Info

### IN-01: Defects still loading are counted in "Not done" and jump to "Done" on resolve

**File:** `DefectsList.tsx:51-53, 443-451`
**Issue:** Loading rows sit in Not done and then move to Done when their issue resolves. This is documented as D-02, but the section counts and row positions shift during load. It is acceptable, but a reviewer should be aware of it.
**Fix:** Optional: show a "resolving…" hint, or keep it as is.

### IN-02: Duplicate sort-header controls and test ids per tab

**File:** `ExecutionsList.tsx:364-400`, `DefectsList.tsx:547-578`
**Issue:** Each header renders twice (once per non-empty section) with identical `data-testid` values and identical accessible button names. Screen-reader users get two "Key" sort buttons, and any future `screen.getByTestId('executions-sort-key')` will throw on multiple matches. The tests already work around this with `within(...)` and `getAllBy...[0]`.
**Fix:** Section-scope the test ids, for example `${testId}-sort-key`, or render the header only in the first non-empty section.

### IN-03: Sort and filter state shared across sections (by design), with test fragility

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx:1924-1945`
**Issue:** Test 3 clicks `getAllByTestId('defects-sort-header-status')[0]` and then reuses that element handle across re-renders. This works only because the first section stays mounted. If the open section empties, the handle goes stale.
**Fix:** Re-query the element inside the `open` scope before each click.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
