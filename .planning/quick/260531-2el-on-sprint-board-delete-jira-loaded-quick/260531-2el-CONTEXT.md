# Quick Task 260531-2el: Remove Jira-loaded Sprint Board quick filters - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Task Boundary

On the Sprint Board, "quick filter" chips are currently loaded from Jira's
GreenHopper `editmodel` endpoint. Remove that Jira-sourced feature so the only
filters remaining are the app's own. Delete the dedicated editmodel fetcher and
clean up all code that exists solely to support it.

**Important clarification:** "editmodel.json" is NOT a local file on disk. It is
the GreenHopper REST endpoint `GET /rest/greenhopper/1.0/rapidviewconfig/editmodel.json?rapidViewId={boardId}`,
fetched by `taskflow/src/services/jira/board-config.ts`. "Delete the
editmodel.json" means delete the code that fetches/parses that endpoint.
</domain>

<decisions>
## Implementation Decisions

### Scope of removal — LOCKED
Surgical removal of the **Jira-loaded quick filters only**. The app's own
filters stay. Specifically:

- **DELETE entirely** (sole-purpose files, only consumer is SprintBoardTab):
  - `taskflow/src/services/jira/board-config.ts`
  - `taskflow/src/services/jira/board-config.test.ts`

- **KEEP** — these are app-native and must remain fully working:
  - The label-chip row inside `QuickFilterChipRow.tsx` (driven by
    `activeLabelFilters` / `toggleLabelFilter` over issue labels).
  - `UnifiedFilterBar` saved-preset filters (the `QuickFilter` type in
    `filter.store.ts` / `settings.store.ts` is the app's OWN saved-preset
    concept — DO NOT remove it; it is unrelated to the Jira editmodel filters).
  - All `activeEpics` / `activeLabels` / `activeAssignees` / `activeStatuses`
    filtering.

### Shared component handling — LOCKED
`QuickFilterChipRow.tsx` is SHARED: it renders Jira QF chips first, a divider,
then app label chips. Do NOT delete the component. Strip only the Jira parts:
- Remove the `quickFilters` prop, the Jira chip `.map()` block (lines ~140–171),
  and the divider that separated QF chips from label chips.
- Remove the JQL helpers that exist only for Jira QFs: `parseSimpleJql`,
  `evaluateCondition`, `evaluateQuickFilter`, and the QF branch of
  `useQuickFilteredIssues` (the hook is unused in production — simplify to
  label-only logic or remove it if truly unreferenced after the change).
- Re-index chip `tabIndex` / `chipRefs` so label chips become the first chips.

### filter.store.ts — LOCKED
Remove fields/actions that exist only for Jira QFs:
- `activeJiraQuickFilters` (decl line ~23, init ~53, reset ~87)
- `toggleJiraQuickFilter` (~33, ~65)
- `clearJiraQuickFilters` (~35, ~79)
Keep `activeLabelFilters`, `toggleLabelFilter`, `clearLabelFilters`.

### SprintBoardTab.tsx — LOCKED
Remove all Jira-QF wiring while leaving label/epic/assignee/status filters and
the `QuickFilterChipRow` usage (now label-only) intact:
- import `fetchBoardQuickFilters` (line ~44) and `JiraBoardQuickFilter` type
  (~48, remove only if no longer referenced after edits).
- `boardQuickFilters` `useQuery` (~712–717) and its query-invalidation block
  (~798–801, queryKey `['jira-board-quickfilters', boardId]`).
- `activeJiraQuickFilters` from the store destructure (~981).
- `qfMatch` block (~1056–1068) and `qfMatch` from the `applyFilters` return (~1077).
- `parseSimpleJql` (~1081) and `evaluateQfCondition` (~1088–1115) — used only by qfMatch.
- `activeJiraQuickFilters.size > 0` from the local-filters guard (~1137).
- The `quickFilters={boardQuickFilters ?? []}` prop on `<QuickFilterChipRow>` (~1299).
Keep the `QuickFilterChipRow` import and render (it still shows label chips).

### types.ts — LOCKED
Remove `JiraBoardQuickFilter` interface (~262–269) and its preceding comment
(~260). Verify no remaining references first.

### Tests — LOCKED
Update/trim affected tests so the suite passes:
- Delete `board-config.test.ts` (file deleted with its subject).
- `filter.store.test.ts` — remove Jira-QF cases, keep label cases.
- `QuickFilterChipRow.test.tsx` — remove Jira-QF chip cases, keep label cases.
- `SprintBoardTab.test.tsx` — remove/adjust Jira-QF expectations and mocks.
- `settings.store.test.ts` — INSPECT before touching; its "quickfilter" hits are
  the app's saved-preset filters (KEEP), almost certainly no change needed.

### Claude's Discretion
- Whether to fully delete `useQuickFilteredIssues` vs simplify it to label-only,
  based on whether anything still imports it after the SprintBoardTab edits.
- Exact line-by-line edits (line numbers above are approximate, pre-edit).
</decisions>

<specifics>
## Specific Ideas

The recent commit `79efbb39 "fix(board): load sprint board quick filters from
GreenHopper editmodel"` is the feature being reverted/removed. There is also a
debug note at `.planning/debug/sprint-board-quickfilter-404.md` — leave it (it is
historical record), but the executor may optionally note its obsolescence.

Verification of "called nowhere else" (already confirmed during discussion):
- `board-config.ts` exports `fetchBoardQuickFilters` + re-exports the type; the
  ONLY production caller is `SprintBoardTab.tsx`. Safe to delete.
</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Source of
truth is the live codebase in `taskflow/src/`.
</canonical_refs>
