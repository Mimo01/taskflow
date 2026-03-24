# Phase 33: Board, Sprint & Filters - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can work faster on the sprint board with a sprint goal banner, Jira board quick filters, label filter chips, bulk multi-select operations (status/assignee/priority), and saved filter management synced with Jira. Layout customization is Phase 34.

</domain>

<decisions>
## Implementation Decisions

### Sprint Goal Banner
- **D-01:** Display sprint goal as a colored accent banner strip below the sprint name header, above the filter area — always visible when a goal exists
- **D-02:** When no sprint goal is set in Jira (`goal` field is null/empty), hide the banner entirely — no placeholder text, board looks exactly like today
- **D-03:** Always show the full goal text regardless of length — banner grows to fit. No truncation or collapsing.
- **D-04:** `JiraActiveSprint.goal` field is already fetched by `fetchActiveSprint` — just needs rendering

### Quick Filters & Labels
- **D-05:** Jira board quick filters appear as toggle chips in a dedicated row above the existing `UnifiedFilterBar` — visually distinct from local filter dropdowns
- **D-06:** Quick filters fetched from Jira Agile REST API (`/rest/agile/1.0/board/{boardId}/configuration`) board config
- **D-07:** Label-based filter chips (BOARD-03) appear in the same chip row alongside Jira quick filters — one unified chip row for toggle-style filters
- **D-08:** Quick filters use AND logic with the existing filter bar — activating a Jira QF narrows results further on top of any epic/label/assignee/status selections. Both filter layers coexist.

### Bulk Operations
- **D-09:** Multi-select via checkboxes on sprint board cards — checkbox appears on hover (or always visible in selection mode). Shift+click for range selection.
- **D-10:** Floating bottom bar appears when >=1 issue is selected — shows selected count + action dropdowns for Status, Assignee, and Priority + close/deselect button
- **D-11:** Bulk operations execute in parallel against Jira API. Progress shown via toast notification: "Updating N issues..." with progress bar. Completion toast: "X succeeded, Y failed" with option to view failures.
- **D-12:** Cards update optimistically during bulk operations — rollback on individual failures

### Saved Filters (Jira Sync)
- **D-13:** Jira saved filters and local quickfilter presets coexist as separate systems — local quickfilters stay as-is (fast, offline), Jira saved filters are a separate feature synced to server
- **D-14:** "Saved Filters" section in the sidebar lists the user's favourite Jira filters. Click a filter to apply it as a constraint on the current sprint board view.
- **D-15:** "Save as filter" button appears in the `UnifiedFilterBar` when any filter is active. Opens a dialog with name + optional description. Saves to Jira via REST API (`/rest/api/2/filter`). Appears in sidebar immediately.
- **D-16:** Saved filters are also accessible via command palette (Cmd+K) for quick access (FILT-04)
- **D-17:** Users can edit (rename, update JQL) and delete saved filters they own (FILT-03)

### Claude's Discretion
- Quick filter chip styling and active state indicators
- Exact Jira Agile API endpoints for board configuration / quick filter discovery
- Bulk operation concurrency limit (parallel API calls)
- Toast component reuse vs new implementation
- How to translate local filter bar state (epics/labels/assignees/statuses) into JQL for Jira saved filter creation
- Checkbox visibility behavior (always visible vs hover-only)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sprint board (existing)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — Current sprint board implementation with DnD, virtualized swimlanes, column layout
- `taskflow/src/services/jira/sprints.ts` — `fetchActiveSprint` with board discovery and active sprint fetch (goal field available)
- `taskflow/src/services/jira/types.ts` — `JiraActiveSprint` interface with `goal?: string` field

### Filter system (existing)
- `taskflow/src/components/UnifiedFilterBar.tsx` — Shared filter bar with popover dropdowns, quickfilter presets, and save flow
- `taskflow/src/stores/filter.store.ts` — Filter state store with `QuickFilter` interface and `applyQuickFilter` method

### Requirements
- `.planning/REQUIREMENTS.md` §Board & Sprint — BOARD-01 through BOARD-07
- `.planning/REQUIREMENTS.md` §Filters — FILT-01 through FILT-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UnifiedFilterBar` component: Already has popover-based multi-select dropdowns, quickfilter preset system, and save flow — extend for Jira saved filter integration
- `filter.store.ts`: Zustand store with toggle/clear/applyQuickFilter — extend for Jira board quick filters
- `fetchActiveSprint` in `sprints.ts`: Already fetches board ID and active sprint with goal field — board ID can be reused for quick filter config fetch
- `DraggableCard` / `TaskCard` components: Existing card components to extend with checkbox selection
- `@dnd-kit/core`: Already imported for drag-and-drop — may need to coordinate with multi-select mode
- `settings.store.ts`: Persists quickfilter presets — local quickfilters continue to use this

### Established Patterns
- Filter state in Zustand store, UI in UnifiedFilterBar — new Jira QF state should follow same pattern
- Optimistic updates with rollback (used in drag-and-drop transitions) — reuse for bulk operations
- `apiFetch` wrapper with 15s timeout and operation logging — use for all new Jira API calls
- Toast notifications likely via existing pattern (check for sonner or similar)

### Integration Points
- Sprint board header: Add goal banner between sprint name and filter area
- UnifiedFilterBar: Add Jira QF chip row above existing filter dropdowns + "Save as filter" button
- Sidebar (`Sidebar.tsx`): Add "Saved Filters" section with dynamic filter list
- Command palette (`shortcuts.ts` / command palette component): Register saved filters as searchable actions
- Sprint board cards: Add checkbox overlay for multi-select mode
- Sprint board container: Add floating bottom toolbar for bulk actions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-board-sprint-filters*
*Context gathered: 2026-03-22*
