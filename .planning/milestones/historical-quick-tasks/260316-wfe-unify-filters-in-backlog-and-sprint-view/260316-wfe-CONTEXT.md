# Quick Task 260316-wfe: Unify filters in backlog and sprint view with saveable quickfilters - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Unify filters in backlog and sprint view. They should be the same filters on both. User should be able to save filters as quickfilters to be applied in just one click.

</domain>

<decisions>
## Implementation Decisions

### Filter Location & Layout
- One shared `UnifiedFilterBar` component used in both backlog and sprint views
- Identical filters: Epic, Label, Assignee (all multi-select)
- Filter state shared so switching views preserves selections

### QuickFilter Storage
- Store quickfilters in the existing Zustand settings store with localStorage persistence
- Integrates with existing app state management
- User can save/delete named filter presets

### Sprint View Upgrade
- Sprint board gets full parity with backlog: all 3 filters (Epic, Label, Assignee) with multi-select
- Cards filtered within each column
- Replace current single-select epic dropdown with unified filter bar

### Claude's Discretion
- QuickFilter UI placement (within the unified filter bar vs separate row)
- Default quickfilter presets (e.g. "My Issues") vs starting empty

</decisions>

<specifics>
## Specific Ideas

- Current backlog has `MultiFilterCombobox` + `BacklogFilterBar` in `BacklogFilterBar.tsx`
- Current sprint has simple single-select epic dropdown in `SprintBoardTab.tsx`
- Backlog filter state lives in `BacklogPage.tsx` as local `useState` Sets
- Sprint filter state is `activeEpicFilter: string | null` in `SprintBoardTab.tsx`
- Settings store at `taskflow/src/stores/settings.store.ts` will hold quickfilters
- Filter logic uses AND across categories, OR within each category

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
