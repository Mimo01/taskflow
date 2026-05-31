---
slug: save-btn-duplicate-filter
status: resolved
trigger: "When I am filtering stories and I use a saved filter exactly, it shows the save button so I can save a new filter that is exactly the same. When I filter a saved filter I shouldnt be able to save another one exactly the same"
created: 2026-05-31T00:46:13Z
updated: 2026-05-31T01:00:00Z
---

# Debug Session: save-btn-duplicate-filter

## Symptoms

- **Expected behavior:** When the active story filter exactly matches an existing saved filter, the "Save" button should be HIDDEN (no ability to save a duplicate identical filter).
- **Actual behavior:** The Save button still appears even when the current filter state is identical to an already-saved filter, allowing the user to save a duplicate.
- **Error messages:** None (logic/UI bug, not a runtime error).
- **Timeline:** Not specified.
- **Reproduction:** Occurs in BOTH cases — (a) clicking/applying a saved filter from the saved-filters list, and (b) manually re-picking the same criteria so the active filter equals a saved one. Reproduces across ALL story filter views (Sprint Board and Backlog — shared filter behavior).

## Current Focus

- hypothesis: CONFIRMED — Save button render condition never checked against existing saved filters
- test: n/a
- expecting: Save button hidden when activeFilterMatchesSaved is true
- next_action: DONE
- reasoning_checkpoint: The `isQuickFilterActive` function already performed the correct per-filter comparison (epics/labels/assignees/statuses set-equality). It was used only to highlight active filter pills, not to gate the Save button. Adding `const activeFilterMatchesSaved = quickFilters.some(isQuickFilterActive)` and threading it into both Save button conditions is the complete fix.

## Evidence

- timestamp: 2026-05-31T01:00:00Z
  file: taskflow/src/components/UnifiedFilterBar.tsx
  finding: >
    Line 484 — "Save as quickfilter" button condition was `hasActiveFilters && !savingName`.
    Line 497 — "Save to Jira" button condition was `hasActiveFilters && !savingName && jiraBaseUrl`.
    Neither condition checked whether the active filter state already matched an existing saved filter.
    The `isQuickFilterActive(qf)` function (line 266) already implemented the correct set-equality
    comparison across all four filter dimensions (epics, labels, assignees, statuses). It was only
    called inside the `quickFilters.map()` render loop to style the active pill — never to gate Save.

## Eliminated

- Runtime error / store mutation bug — no, the store state is correct; the problem is purely render logic
- Missing `statuses` field handling — `isQuickFilterActive` already handles `qf.statuses ?? []` fallback

## Resolution

- root_cause: The "Save" (quickfilter) and "Save Filter" (Jira) buttons were rendered based solely on `hasActiveFilters && !savingName`, with no check against the existing `quickFilters` list. The `isQuickFilterActive` helper already existed and performed exact set-equality matching, but was only wired to highlight saved-filter pills — not to suppress the Save button.
- fix: Added `const activeFilterMatchesSaved = quickFilters.some(isQuickFilterActive)` immediately after the `isQuickFilterActive` function declaration. Added `&& !activeFilterMatchesSaved` to both Save button render conditions (lines 484 and 497). Both Save buttons now hide whenever the current active filter state exactly matches any existing saved quickfilter.
- verification: `npm run check` (biome + tsc) passes clean with no errors or warnings.
- files_changed: taskflow/src/components/UnifiedFilterBar.tsx
