---
phase: quick-261027-iz9
plan: 01
status: complete
commits: [a747ce50, 701e17d8]
---

# Quick 261027-iz9: AIO cycle Executions/Defects Not done / Done split

Executions and Defects tabs now render two stacked sections (Not done, then Done), each with a `SectionHeading` count, its own sticky column header, and a compact empty state. One shared toolbar and sort state drive both.

## Commits
- a747ce50: compact `EmptyState` prop + Executions split (Done = Pass only)
- 701e17d8: Defects split (Done = statusCategory done; loading/unresolved stay in Not done)

## Notes
- Testids: `executions-section-open|done`, `defects-section-open|done`.
- Empty vs no-match copy decided by unfiltered totals; no-match shows "Clear filters".
- Whole-tab empty states and skeletons unchanged.
- Existing loading-row test (T1-02) still passes; it asserts the row renders, not explicitly its section.

## Deviations
None of substance. Defects "Clear filters" reuses `clearAllFilters`.

## Pending human verification (Task 3)
1. Run the app, open an AIO cycle with mixed passed/unpassed runs.
2. Executions tab: Not done (n) above Done (n), one-line rows; scroll and confirm the Not done column header sticks under the tab bar then hands over to Done's header without overlap.
3. Select the Pass chip: Not done shows "No open runs match the filters" + Clear filters; click it, both tables return.
4. Cycle through all three densities and narrow the window; columns hide, headings stay one line.
5. Defects tab: repeat 2-3; open defects in Not done, resolved in Done.
6. A cycle with no defects shows the single "No defects" state, not two empty sections.
