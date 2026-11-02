---
phase: quick-261102-vuw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/taskTableFilters.ts
  - taskflow/src/routes/dashboard/release-detail/taskTableFilters.test.ts
  - taskflow/src/routes/dashboard/release-detail/useTaskIssueFilters.ts
  - taskflow/src/routes/dashboard/release-detail/useTaskIssueFilters.test.tsx
  - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBuckets.test.ts
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.test.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: [QUICK-261102-vuw]

must_haves:
  truths:
    - "Clicking a By status row adds that exact Jira status name to the task table's Status filter; clicking it again removes it"
    - "Clicking the merged 'Done' status row (overflow case) toggles every done status name it stands for as one group"
    - "Clicking a By type row toggles that issue type name in the table's Type filter"
    - "Clicking a By assignee row toggles that person's displayName (or the UNASSIGNED_FILTER sentinel for Unassigned) in the table's Assignee filter"
    - "Graph-driven toggles show up in the FilterPopover checkboxes, the active-filter chips, and 'Clear filters' clears them"
    - "Rows whose value is filtered show an active state (bg-muted, aria-pressed=true); other rows in that graph dim; row height/geometry is unchanged"
    - "Rows are real <button>s, keyboard focusable and activatable with Enter/Space; tooltips still work"
    - "Navigating to another release starts with empty issue filters"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/useTaskIssueFilters.ts"
      provides: "Lifted, release-scoped status/type/assignee filter Sets + toggle"
      exports: ["useTaskIssueFilters", "TaskIssueFilterState"]
    - path: "taskflow/src/routes/dashboard/release-detail/taskTableFilters.ts"
      provides: "Pure toggleFilterValues(set, values) group toggle"
      contains: "export function toggleFilterValues"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "useTaskIssueFilters"
      via: "one hook instance passed to UnifiedTaskTable (issueFilterState) and to the 3 graphs (activeValues/onToggle)"
      pattern: "useTaskIssueFilters\\(versionId\\)"
    - from: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      to: "issueFilterState prop"
      via: "issueFilterState ?? own useTaskIssueFilters() fallback"
      pattern: "issueFilterState \\?\\?"
---

<objective>
Make the "By type", "By status" and "By assignee" rows on the release detail page toggle the matching column filter of the Issues table (UnifiedTaskTable) below.

Purpose: the breakdown graphs become a fast way to drill into the table, the same way the MR label pills already filter it (labelFilter pattern in ReleaseDetailPage).
Output: lifted filter state hook, pure group-toggle helper, filter keys on bucket rows, interactive graph rows, page wiring, vitest coverage.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/dashboard/release-detail/taskTableFilters.ts
@taskflow/src/lib/assignee-filter.ts
@taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx

Repo layout: .planning/ and git at /Users/mimo/Documents/Projects/taskflow; npm/vitest/biome/tsc run from /Users/mimo/Documents/Projects/taskflow/taskflow.

Facts verified during planning (do not re-derive):
- Table filter state today: `UnifiedTaskTable.tsx` ~L1185-1188 holds `query`, `statusFilter`, `typeFilter`, `assigneeFilter` (`useState<Set<string>>`); FilterPopovers at ~L1449-1469 take `selected` + `setSelected: React.Dispatch<React.SetStateAction<Set<string>>>`; `dropFrom`/chips/`clearIssueFilters` use functional setter updates.
- `matchesTaskFilters` keys on: status = `issue.fields.status.name` (exact), type = `issue.fields.issuetype.name` (exact), assignee = `matchesAssigneeFilter` (UNASSIGNED_FILTER sentinel for null assignee, otherwise case-insensitive SUBSTRING of displayName).
- Graph rows: status rows keyed by exact status name (`deriveReleaseStatusRows`, fallback name 'Unknown' when missing); `fitStatusRows` on overflow collapses all done statuses into one synthetic row `{name:'Done', mergedStatuses:N}` that carries no member names. Type rows keyed by `issuetype.name || 'Other'`. Assignee rows: `id` = `user:<username>` or `'unassigned'`, `name` = displayName (`'Unassigned'` for the unassigned row, `unassigned: true`). So the assignee filter value must be `row.unassigned ? UNASSIGNED_FILTER : row.name` — NOT `row.id`.
- Graphs and table see the same issue set (`primaryRows` built from `releaseIssues` in useReleaseDetail.ts ~L632).
- Page already lifts the MR label filter keyed by versionId (ReleaseDetailPage.tsx ~L169-176) because the page does not remount between releases; the table is `key={versionId}` (remounts). Follow the same release-scoping for lifted issue filters.
- Graph rows are `TooltipTrigger render={<div />}` with `relative z-10 rounded px-1 hover:bg-muted/50`; they contain no nested interactive elements, so the trigger itself becomes the button (no overlay button needed).
- Pre-commit hook runs full vitest + biome + tsc: RED and GREEN go in ONE commit per task. Do not run `biome --write` on all of src; only the touched files.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lift issue filters into a release-scoped hook, add group toggle and filter keys on bucket rows</name>
  <files>taskflow/src/routes/dashboard/release-detail/taskTableFilters.ts, taskflow/src/routes/dashboard/release-detail/taskTableFilters.test.ts, taskflow/src/routes/dashboard/release-detail/useTaskIssueFilters.ts, taskflow/src/routes/dashboard/release-detail/useTaskIssueFilters.test.tsx, taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts, taskflow/src/routes/dashboard/release-detail/releaseBuckets.test.ts, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</files>
  <behavior>
    - toggleFilterValues(new Set(), ['A']) → {'A'}; toggleFilterValues({'A','B'}, ['A']) → {'B'}; returns a new Set (input not mutated)
    - Group: toggleFilterValues({'Closed'}, ['Closed','Released']) → {'Closed','Released'} (not all present → add all); toggleFilterValues({'Closed','Released','X'}, ['Closed','Released']) → {'X'} (all present → remove all); empty values array → set unchanged copy
    - isFilterGroupActive(set, values): true iff values non-empty and every value is in set
    - deriveReleaseStatusRows: each row has filterValues = [status name]; an issue with no status name yields the 'Unknown' row with filterValues = []
    - fitStatusRows overflow: merged 'Done' row has filterValues = all collapsed done status names
    - deriveReleaseTypeRows: row.filterValue = issuetype name; missing issuetype → 'Other' row with filterValue null
    - useTaskIssueFilters(scope): toggle('statuses', ['In Review']) adds then removes; setters accept functional updates; rerendering with a different scope returns empty sets
    - UnifiedTaskTable given issueFilterState with statuses={'Open'} renders only Open issues and shows the Status chip; without the prop it behaves exactly as before (existing tests untouched and passing)
  </behavior>
  <action>
In taskTableFilters.ts (stays pure, no React) add exported `toggleFilterValues(set: Set<string>, values: string[]): Set<string>` (all values present → remove all, else add all; always a new Set) and `isFilterGroupActive(set, values): boolean`. Add tests to taskTableFilters.test.ts.

Create useTaskIssueFilters.ts exporting `type TaskIssueDimension = 'statuses' | 'types' | 'assignees'`, `interface TaskIssueFilterState { statuses; types; assignees: Set<string>; setStatuses; setTypes; setAssignees: React.Dispatch<React.SetStateAction<Set<string>>>; toggle(dim: TaskIssueDimension, values: string[]): void }` and `useTaskIssueFilters(scope?: string): TaskIssueFilterState`. Store one useState object `{ scope, statuses, types, assignees }`; when `state.scope !== scope` the hook exposes empty sets (same stale-scope trick as the page's labelFilterState, so a new release never inherits filters and no effect/flash is needed). Each setter does a functional setState that first rebases onto an empty state for the current scope if the stored scope differs, then applies the SetStateAction (value or updater fn) to that dimension. `toggle` delegates to the matching setter with `prev => toggleFilterValues(prev, values)`. Test with renderHook in useTaskIssueFilters.test.tsx.

In releaseBuckets.ts: add `filterValues: string[]` to `ReleaseStatusRow` (set to `[issue.fields.status.name]` when present, `[]` for the 'Unknown' fallback — keep the row key/name logic as is) and populate the merged 'Done' row in fitStatusRows with the concatenated filterValues of the collapsed done rows. Add `filterValue: string | null` to `ReleaseTypeRow` (the real issuetype name, null for the 'Other' fallback). Update any existing test fixtures/literal row objects in releaseBuckets.test.ts and graph tests that construct these row types so tsc passes (add the new fields), and add the behaviour tests above.

In UnifiedTaskTable.tsx: add optional prop `issueFilterState?: TaskIssueFilterState` to UnifiedTaskTableProps (doc comment: lifted so the release graphs can toggle it, 261102-vuw). Replace the three `useState<Set<string>>` lines with `const ownIssueFilters = useTaskIssueFilters(); const f = issueFilterState ?? ownIssueFilters;` and alias `statusFilter = f.statuses`, `setStatusFilter = f.setStatuses`, etc., so all downstream code (issueFilters, chips, dropFrom, clearIssueFilters, FilterPopovers) is unchanged. `query` stays local. Add one UnifiedTaskTable.test.tsx case passing a controlled issueFilterState (build it via renderHook or a tiny wrapper component) asserting rows are filtered and the `task-filter-chip-status-<name>` chip renders.

Commit RED+GREEN together (pre-commit runs the full suite).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/ && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/release-detail/taskTableFilters.ts src/routes/dashboard/release-detail/useTaskIssueFilters.ts src/routes/dashboard/release-detail/releaseBuckets.ts src/routes/dashboard/release-detail/UnifiedTaskTable.tsx</automated>
  </verify>
  <done>New helpers and hook tested; status/type rows carry exact table filter keys; UnifiedTaskTable works both controlled (issueFilterState) and uncontrolled; all release-detail tests, tsc and biome on touched files pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Make graph rows toggle buttons and wire them to the lifted filters on the page</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.test.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.test.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.test.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <behavior>
    - ReleaseStatusRows with onToggle: clicking `status-row-In Review` calls onToggle(['In Review']); the merged Done row calls onToggle with all collapsed done names; the row is a button with aria-pressed reflecting activeValues
    - activeValues={'In Review'}: that row has aria-pressed="true" and the active class; another row carries the dim class; activeValues empty → no row dimmed
    - ReleaseTypeWaffle: click `type-row-Bug` → onToggle(['Bug']); the 'Other' row (filterValue null) is not a button and has no onClick
    - ReleaseAssigneeRows: click a named row → onToggle([row.name]) (displayName, not row.id); click Unassigned row → onToggle([UNASSIGNED_FILTER])
    - Keyboard: row is focusable (role button via native <button>), Enter triggers onToggle (userEvent keyboard)
    - Without onToggle (existing tests): rows render as before (div trigger, no aria-pressed) — existing assertions keep passing
  </behavior>
  <action>
For each of the three graph components add optional props `activeValues?: Set<string>` and `onToggle?: (values: string[]) => void`. Per row compute its filter values: status → `row.filterValues`; type → `row.filterValue ? [row.filterValue] : []`; assignee → `[row.unassigned ? UNASSIGNED_FILTER : row.name]` (import UNASSIGNED_FILTER from '@/lib/assignee-filter'; the table's assignee match is displayName substring, so displayName is the correct key — row.id is `user:<username>` and would match nothing). A row is interactive when `onToggle` is set and its values are non-empty.

Interactive rows: change the TooltipTrigger `render` to `<button type="button" />`, add `aria-pressed={isFilterGroupActive(activeValues, values)}`, `onClick={() => onToggle(values)}`, and add `w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` to the existing classes (keep ROW_GRID / grid template, height style, `relative z-10`, padding — geometry must not change; a button with display:grid lays out the same as the div; one row = one line). Non-interactive rows keep `render={<div />}` exactly as today. Active state (follow the MR label pill toggle pattern but no colour, colour = status only): active row adds `bg-muted`; when the graph's activeValues is non-empty, non-active rows add `opacity-50` (transition-opacity is fine). Only background/opacity change — no border/ring on active rows, so no layout shift. Leave the "+N more" overflow lines non-interactive (FilterPopover still covers hidden values). Write the behaviour tests above in each graph's existing test file (use fireEvent/userEvent; tooltip providers as the existing tests set them up).

In ReleaseDetailPage.tsx: `const issueFilters = useTaskIssueFilters(versionId);` next to the labelFilterState block (~L169). Pass `activeValues={issueFilters.statuses} onToggle={(v) => issueFilters.toggle('statuses', v)}` to ReleaseStatusRows (~L347), `issueFilters.types`/'types' to ReleaseTypeWaffle (~L370), `issueFilters.assignees`/'assignees' to ReleaseAssigneeRows (~L360), and `issueFilterState={issueFilters}` to UnifiedTaskTable (~L549). Do NOT add scroll-into-view of the table (optional; out of scope unless trivial — leave a note in the SUMMARY). Do not bulk find-replace identifiers; edit only these call sites.

Commit RED+GREEN together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/ && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/release-detail/graphs/ src/routes/dashboard/ReleaseDetailPage.tsx</automated>
    <human-check>Open a release detail page: click "In Review" in By status, a type in By type, a person and Unassigned in By assignee — table filters, popover checkboxes and chips update, clicked rows tint and others dim, re-click removes; row heights unchanged; Tab reaches rows and Enter toggles.</human-check>
  </verify>
  <done>All three graphs toggle the exact table filter values via one lifted, release-scoped state; active/dim states visible without geometry change; rows keyboard-accessible; dashboard tests, tsc and biome on touched files pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira data → UI filter | status/type/assignee names from Jira are used as Set keys and rendered as text only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vuw-01 | Tampering | assignee filter keys | mitigate | Unassigned goes through UNASSIGNED_FILTER sentinel (strict null match, existing T-s09-01 collision guard); never use the display label 'Unassigned' as a key |
| T-vuw-02 | Information disclosure | filter state | accept | client-only UI state, no persistence or network; scoped per release |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/` green; `npx tsc --noEmit` clean; biome clean on touched files (gate on no NEW diagnostics in touched files, not an absolute repo count).
- Grep: `grep -n "useTaskIssueFilters(versionId)" taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` returns 1 line; `grep -n "issueFilterState ??" taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` returns 1 line.
</verification>

<success_criteria>
Clicking a breakdown row toggles the matching table filter (multi-select, OR within dimension), reflected in FilterPopover and chips; merged Done row toggles its whole group; Unassigned uses the sentinel; active rows tinted, others dimmed, no layout shift; keyboard accessible; filters reset per release.
</success_criteria>

<output>
Create `.planning/quick/261102-vuw-release-detail-breakdown-rows-toggle-tab/261102-vuw-SUMMARY.md` when done. Note: assignee filter is displayName-substring (existing shared semantics), so a name that is a substring of another person's name also matches that person; scroll-to-table not added (optional follow-up).
</output>
