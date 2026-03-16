---
phase: quick
plan: 260316-wfe
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/filter.store.ts
  - taskflow/src/components/UnifiedFilterBar.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogFilterBar.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/stores/settings.store.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Backlog and sprint board show the same three filters: Epic, Label, Assignee (all multi-select)"
    - "Switching between backlog and sprint board preserves active filter selections"
    - "User can save current filter selections as a named quickfilter"
    - "User can apply a saved quickfilter with one click"
    - "User can delete a saved quickfilter"
    - "Sprint board cards are filtered within their columns (not hidden swimlanes)"
    - "Quickfilters persist across app restarts"
  artifacts:
    - path: "taskflow/src/stores/filter.store.ts"
      provides: "Shared filter state (activeEpics, activeLabels, activeAssignees) + quickfilter CRUD"
    - path: "taskflow/src/components/UnifiedFilterBar.tsx"
      provides: "Shared filter bar with multi-select comboboxes and quickfilter save/apply/delete"
  key_links:
    - from: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      to: "taskflow/src/stores/filter.store.ts"
      via: "useFilterStore() hook replaces local useState filter state"
      pattern: "useFilterStore"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "taskflow/src/stores/filter.store.ts"
      via: "useFilterStore() hook replaces single-select epicFilter"
      pattern: "useFilterStore"
    - from: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      to: "taskflow/src/components/UnifiedFilterBar.tsx"
      via: "renders UnifiedFilterBar instead of BacklogFilterBar"
      pattern: "UnifiedFilterBar"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "taskflow/src/components/UnifiedFilterBar.tsx"
      via: "renders UnifiedFilterBar replacing the select dropdown"
      pattern: "UnifiedFilterBar"
---

<objective>
Unify filters across backlog and sprint board views with shared state and saveable quickfilters.

Purpose: Both views currently have divergent filter implementations (backlog has 3 multi-select comboboxes with local state; sprint has a single-select epic dropdown). Users need consistent filtering across views that persists when switching tabs, plus the ability to save filter presets for one-click application.

Output: Shared filter store, unified filter bar component, quickfilter persistence, both views wired up.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/stores/settings.store.ts
@taskflow/src/routes/dashboard/BacklogFilterBar.tsx
@taskflow/src/routes/dashboard/BacklogPage.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
@taskflow/src/services/jira.ts

<interfaces>
<!-- Existing filter bar interface (to be replaced by UnifiedFilterBar) -->
From taskflow/src/routes/dashboard/BacklogFilterBar.tsx:
```typescript
export interface BacklogFilterBarProps {
  filterOptions: {
    epics: Map<string, string>  // epicKey -> epicName
    labels: string[]
    assignees: string[]
  }
  activeEpics: Set<string>
  activeLabels: Set<string>
  activeAssignees: Set<string>
  onEpicsChange: (epics: Set<string>) => void
  onLabelsChange: (labels: Set<string>) => void
  onAssigneesChange: (assignees: Set<string>) => void
}
```

From taskflow/src/services/jira.ts (JiraIssue fields index signature):
```typescript
export interface JiraIssue {
  id: string; key: string;
  fields: {
    summary: string;
    status: { id: string; name: string; statusCategory?: { key: 'new' | 'indeterminate' | 'done' } };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    issuetype: { name: string; subtask: boolean };
    [key: string]: unknown;  // dynamic fields
  };
}
```

Settings store persist pattern (version + migrate):
```typescript
persist(store, { name: 'settings-store', storage: tauriStorage, version: 4, migrate: ... })
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shared filter store, UnifiedFilterBar component, and quickfilter persistence</name>
  <files>
    taskflow/src/stores/filter.store.ts,
    taskflow/src/components/UnifiedFilterBar.tsx,
    taskflow/src/stores/settings.store.ts
  </files>
  <action>
**1. Create `taskflow/src/stores/filter.store.ts`** — a Zustand store (NO persist, session-only) that holds shared filter state:
- `activeEpics: Set<string>` (epic display names, like backlog currently uses)
- `activeLabels: Set<string>`
- `activeAssignees: Set<string>`
- `setActiveEpics`, `setActiveLabels`, `setActiveAssignees` setters
- `toggleEpic(name: string)`, `toggleLabel(label: string)`, `toggleAssignee(name: string)` — toggle helpers that create new Set (same pattern as BacklogFilterBar's `toggle` function)
- `clearAll()` — resets all three Sets to empty
- `applyQuickFilter(filter: QuickFilter)` — sets all three at once from a saved preset

Export a `QuickFilter` type:
```typescript
export interface QuickFilter {
  id: string       // nanoid or Date.now().toString()
  name: string
  epics: string[]
  labels: string[]
  assignees: string[]
}
```

**2. Add quickfilter persistence to `taskflow/src/stores/settings.store.ts`:**
- Add `quickFilters: QuickFilter[]` to SettingsState (default: `[]`)
- Add `addQuickFilter: (qf: QuickFilter) => void` — appends to array
- Add `removeQuickFilter: (id: string) => void` — filters by id
- Bump `version` to `5` and add migration: `if (version < 5) { if (s.quickFilters === undefined) s.quickFilters = [] }`
- Import `QuickFilter` type from `filter.store.ts`

**3. Create `taskflow/src/components/UnifiedFilterBar.tsx`:**
- Reuse the `MultiFilterCombobox` component pattern from `BacklogFilterBar.tsx` (copy it into this file as a private sub-component)
- Props interface:
```typescript
interface UnifiedFilterBarProps {
  filterOptions: {
    epics: Map<string, string>  // epicKey -> epicName (passed by parent which has issue data)
    labels: string[]
    assignees: string[]
  }
}
```
- Reads filter state from `useFilterStore()` (no prop-threading for filter state — store is the source of truth)
- Renders 3 MultiFilterCombobox instances for Epic, Label, Assignee (same styling as BacklogFilterBar)
- Renders active filter chips with dismiss buttons (same pattern as BacklogFilterBar)
- Renders a quickfilter row below the filter inputs:
  - Left side: saved quickfilter pills (from `useSettingsStore().quickFilters`). Each pill is a button that calls `applyQuickFilter()`. Each pill has a small X to delete.
  - Right side: "Save filter" button (only enabled when at least one filter is active). On click, prompts for name via a small inline text input that appears, then calls `addQuickFilter()`.
  - Quickfilter pills should have a distinct visual style (e.g., `bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-xs`) to distinguish from active filter chips (which use `bg-muted`).
- Include a "Clear all" button that appears when any filter is active, calls `clearAll()`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - filter.store.ts exports useFilterStore with all filter state + toggle/clear/apply methods
    - settings.store.ts has quickFilters array with add/remove, version bumped to 5 with migration
    - UnifiedFilterBar renders 3 multi-select comboboxes, filter chips, quickfilter pills row with save/delete
    - All files compile with zero TS errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire UnifiedFilterBar into BacklogPage and SprintBoardTab, add labels to sprint fetch</name>
  <files>
    taskflow/src/routes/dashboard/BacklogPage.tsx,
    taskflow/src/routes/dashboard/SprintBoardTab.tsx,
    taskflow/src/services/jira.ts,
    taskflow/src/routes/dashboard/BacklogFilterBar.tsx
  </files>
  <action>
**1. Add `labels` to sprint board fetch in `taskflow/src/services/jira.ts`:**
- In `fetchSprintIssues` (line ~301), add `labels` to the `fields` string. Currently:
  ```
  const fields = `summary,status,assignee,issuetype,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking`;
  ```
  Change to:
  ```
  const fields = `summary,status,assignee,issuetype,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking`;
  ```

**2. Refactor `taskflow/src/routes/dashboard/BacklogPage.tsx`:**
- Remove local filter state: delete `const [activeEpics, setActiveEpics]`, `[activeLabels, setActiveLabels]`, `[activeAssignees, setActiveAssignees]` useState calls
- Import `useFilterStore` from `@/stores/filter.store`
- Add: `const { activeEpics, activeLabels, activeAssignees } = useFilterStore()`
- Replace `<BacklogFilterBar ... />` with `<UnifiedFilterBar filterOptions={filterOptions} />`
- Import `UnifiedFilterBar` from `@/components/UnifiedFilterBar`
- Remove `BacklogFilterBar` import
- The `applyFilters` function and `filterOptions` memo stay unchanged — they already read from variables named `activeEpics`, `activeLabels`, `activeAssignees`

**3. Refactor `taskflow/src/routes/dashboard/SprintBoardTab.tsx`:**
- Remove: `const [activeEpicFilter, setActiveEpicFilter] = useState<string | null>(null)` and `epicOptions` memo
- Import `useFilterStore` from `@/stores/filter.store`
- Add: `const { activeEpics, activeLabels, activeAssignees } = useFilterStore()`
- Import `useSettingsStore` to get `epicNameFieldKey` (already imported for other keys) — need it for epic name resolution
- Build `filterOptions` memo (same pattern as BacklogPage):
  ```typescript
  const filterOptions = useMemo(() => {
    const epics = new Map<string, string>()
    const labels = new Set<string>()
    const assignees = new Set<string>()
    for (const issue of localIssues) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null
      if (epicKey) epics.set(epicKey, epicKey) // Sprint board uses epicKey as display (no epicNames map available)
      for (const label of (issue.fields.labels as string[] | undefined) ?? []) labels.add(label)
      if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName)
    }
    return { epics, labels: Array.from(labels), assignees: Array.from(assignees) }
  }, [localIssues, epicLinkFieldKey])
  ```
- Add `applyFilters` function (same logic as BacklogPage):
  ```typescript
  function applyFilters(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => {
      const epicMatch = activeEpics.size === 0 || (() => {
        const epicKey = issue.fields[epicLinkFieldKey] as string | null
        const epicName = filterOptions.epics.get(epicKey ?? '') ?? epicKey ?? ''
        return Array.from(activeEpics).some(q => epicName.toLowerCase().includes(q.toLowerCase()))
      })()
      const labelMatch = activeLabels.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some(l => activeLabels.has(l))
      const assigneeMatch = activeAssignees.size === 0 || (() => {
        const name = issue.fields.assignee?.displayName ?? ''
        return Array.from(activeAssignees).some(q => name.toLowerCase().includes(q.toLowerCase()))
      })()
      return epicMatch && labelMatch && assigneeMatch
    })
  }
  ```
- Replace the existing epic filter bar (the `<div data-testid="sprint-epic-filter">` block, lines ~391-411) with:
  ```tsx
  <UnifiedFilterBar filterOptions={filterOptions} />
  ```
- Update `filteredSwimlanes` memo to use `applyFilters` on cards within each swimlane instead of the old single-epic filter:
  ```typescript
  const filteredSwimlanes = useMemo(() => {
    if (activeEpics.size === 0 && activeLabels.size === 0 && activeAssignees.size === 0) return swimlanes
    return swimlanes
      .map(({ story, subtasks }) => ({
        story,
        subtasks: applyFilters(subtasks.length > 0 ? subtasks : [story]).length > 0
          ? { story, subtasks: subtasks.length > 0 ? applyFilters(subtasks) : [] }
          : null,
      }))
      .filter(Boolean) // ... needs refinement
  }, [swimlanes, activeEpics, activeLabels, activeAssignees])
  ```
  More precisely: filter the swimlanes to only show stories where either the story itself matches OR at least one subtask matches. For matching swimlanes, filter the cards (subtasks) shown in each column. If a story has subtasks, filter the subtasks. If a story has no subtasks, check if the story itself matches.
  ```typescript
  const filteredSwimlanes = useMemo(() => {
    if (activeEpics.size === 0 && activeLabels.size === 0 && activeAssignees.size === 0) return swimlanes
    return swimlanes
      .map(({ story, subtasks }) => {
        if (subtasks.length > 0) {
          const filtered = applyFilters(subtasks)
          if (filtered.length === 0) return null
          return { story, subtasks: filtered }
        }
        // No subtasks — check story itself
        if (applyFilters([story]).length === 0) return null
        return { story, subtasks }
      })
      .filter((s): s is { story: JiraIssue; subtasks: JiraIssue[] } => s !== null)
  }, [swimlanes, activeEpics, activeLabels, activeAssignees])
  ```

**4. Keep `BacklogFilterBar.tsx` as-is** (do NOT delete — it may be imported elsewhere). The import in BacklogPage.tsx is simply removed.

**Important:** Do NOT use React context or createContext. The filter store is a Zustand store accessed via hook — consistent with the project's prop-threading + store pattern.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - BacklogPage uses useFilterStore() and renders UnifiedFilterBar (no local filter state)
    - SprintBoardTab uses useFilterStore() and renders UnifiedFilterBar with 3 multi-select filters (replacing single-select epic dropdown)
    - Sprint board fetch now includes labels field
    - Switching between backlog and sprint tabs preserves filter selections (shared store)
    - Sprint board swimlanes filtered by epic, label, AND assignee (AND across categories, OR within)
    - All files compile with zero TS errors
  </done>
</task>

</tasks>

<verification>
1. `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` — zero errors
2. `cd /Users/mimo/Desktop/Tasker/taskflow && npm run build` — successful build
3. Visual: Backlog view shows UnifiedFilterBar with Epic, Label, Assignee comboboxes + quickfilter row
4. Visual: Sprint board shows same UnifiedFilterBar replacing the old epic dropdown
5. Functional: Select a filter in backlog, switch to sprint board — same filter is active
6. Functional: Save a quickfilter, reload app, quickfilter pill still appears
7. Functional: Click a quickfilter pill — filters apply immediately in both views
</verification>

<success_criteria>
- Single UnifiedFilterBar component renders in both backlog and sprint views
- Filter state shared via Zustand store — switching views preserves selections
- All three filter categories (Epic, Label, Assignee) work as multi-select in both views
- Quickfilters can be saved, applied with one click, and deleted
- Quickfilters persist across app restarts (settings store)
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260316-wfe-unify-filters-in-backlog-and-sprint-view/260316-wfe-SUMMARY.md`
</output>
