# Phase 37: Wire Saved Filters to Sprint Board - Research

**Researched:** 2026-03-24
**Domain:** Zustand store integration / Jira JQL client-side filtering
**Confidence:** HIGH

## Summary

Phase 37 closes the integration gap where `activeFilterId` is set by the sidebar and command palette but never consumed by SprintBoardTab. The saved filter store (`useSavedFilterStore`) already has `activeFilterId` and `setActiveFilter()` fully implemented. The command palette and sidebar both call `setActiveFilter(filter.id)` when a saved filter is clicked. However, SprintBoardTab never reads from `useSavedFilterStore` -- it only reads from `useFilterStore` (the local epic/label/assignee/status filter store).

The core task is: when `activeFilterId` is set, look up the corresponding `JiraSavedFilter`, extract its `jql` string, and use it to constrain the board view. There are two viable approaches: (1) client-side JQL parsing against already-fetched sprint issues (extending the existing `parseSimpleJql` pattern), or (2) server-side by passing the saved filter's JQL as an additional clause to `fetchSprintIssues`. Given that saved filters can contain arbitrary JQL that is hard to parse client-side, but the sprint board already fetches all sprint issues and filters them locally, the pragmatic approach is a **hybrid**: use the saved filter's JQL to make a Jira API search call, then intersect the resulting issue keys with the locally loaded sprint issues.

**Primary recommendation:** Subscribe SprintBoardTab to `useSavedFilterStore.activeFilterId`, fetch the saved filter's JQL results via the existing `fetchAllSearchPages` infrastructure, and filter the local swimlanes to only show issues present in the JQL result set. Clear the active filter to restore the default view.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILT-02 | User can view and execute saved/favourite filters from Jira | SprintBoardTab must read activeFilterId from useSavedFilterStore, look up the filter's JQL, execute it against Jira API, and constrain displayed issues to the intersection of sprint issues and JQL results |
| FILT-04 | User can access saved filters from sidebar and command palette | Already implemented -- Sidebar renders SavedFilterList which calls setActiveFilter; CommandPalette renders saved filters and calls setActiveFilter + navigates to '/'. This phase wires the consumption side. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | existing | State management for activeFilterId | Already used for both filter stores |
| @tanstack/react-query | existing | Data fetching for JQL search | Already used throughout SprintBoardTab |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Test runner | Unit tests for new filtering logic |

**No new dependencies needed.** This phase only wires existing infrastructure together.

## Architecture Patterns

### Current Data Flow (gap)
```
Sidebar/CommandPalette
  -> useSavedFilterStore.setActiveFilter(filterId)
  -> activeFilterId is set in store
  -> NOTHING reads it in SprintBoardTab  <-- THE GAP
```

### Target Data Flow
```
Sidebar/CommandPalette
  -> useSavedFilterStore.setActiveFilter(filterId)
  -> activeFilterId is set in store
  -> SprintBoardTab subscribes to activeFilterId
  -> Looks up JiraSavedFilter.jql from savedFilters array
  -> Uses useQuery to fetch issue keys matching that JQL
  -> Intersects with local sprint issues to filter swimlanes
  -> Clearing activeFilterId (null) restores default view
```

### Key Files to Modify
```
taskflow/src/
  routes/dashboard/SprintBoardTab.tsx    # Subscribe to saved filter store, add JQL query, filter swimlanes
  stores/saved-filter.store.ts           # No changes needed (already complete)
```

### Pattern: JQL-Based Filtering in SprintBoardTab

SprintBoardTab already has a pattern for server-side data + client-side filtering:
1. `fetchSprintIssues` fetches all sprint issues via JQL
2. `applyFilters()` filters issues client-side using `useFilterStore` state
3. `filteredSwimlanes` memo computes the visible swimlanes

The saved filter integration follows the same pattern but adds a server-side JQL call:
1. Read `activeFilterId` from `useSavedFilterStore`
2. Look up the filter's `jql` string from `savedFilters` array
3. Use a `useQuery` to call Jira's search API with that JQL
4. Extract the resulting issue keys into a `Set<string>`
5. Add a check in the `filteredSwimlanes` memo (or `applyFilters`): if saved filter is active, only include issues whose key is in the JQL result set

### Anti-Patterns to Avoid
- **Client-side JQL parsing for arbitrary filters:** The existing `parseSimpleJql` only handles `field = value` / `field != value`. Saved filters can have complex JQL (IN, NOT IN, functions like `currentUser()`, nested AND/OR). Do NOT try to parse arbitrary JQL client-side.
- **Replacing the sprint issue fetch entirely:** The saved filter's JQL may return issues outside the active sprint. Always intersect with the sprint issues, not replace them.
- **Forgetting to clear `useFilterStore` when a saved filter activates:** Consider whether the two filter systems (local quick filters vs. saved Jira filters) should coexist or be mutually exclusive. Recommendation: let them coexist (AND logic) -- the saved filter narrows the set, local filters narrow further.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JQL execution | Client-side JQL parser | Jira REST API search endpoint | JQL is complex; Jira server is the authoritative executor |
| Paginated search | Manual pagination loop | Existing `fetchAllSearchPages` from `client.ts` | Already handles pagination, auth, error handling |
| Filter state management | New state store | Existing `useSavedFilterStore` | Already has activeFilterId, setActiveFilter, savedFilters |

## Common Pitfalls

### Pitfall 1: Saved Filter JQL Returns Issues Outside Sprint
**What goes wrong:** Saved filter JQL like `assignee = currentUser()` returns all user's issues across all sprints/projects, not just the active sprint.
**Why it happens:** Saved filters are general-purpose JQL queries, not sprint-scoped.
**How to avoid:** Always intersect the JQL result keys with the already-fetched sprint issues. Never replace the sprint issue set.
**Warning signs:** Board shows issues from other sprints or projects.

### Pitfall 2: Race Condition Between Filter Fetch and Sprint Data
**What goes wrong:** Saved filter JQL query completes but sprint issues haven't loaded yet, or vice versa.
**Why it happens:** Two independent async data sources.
**How to avoid:** Use react-query's enabled flag to only fetch filter results when sprint data is available. The `filteredSwimlanes` memo naturally handles this -- if JQL results are loading, show a loading indicator or the full sprint.
**Warning signs:** Flash of unfiltered content followed by filtered content.

### Pitfall 3: Stale Filter Selection After Filter Deletion
**What goes wrong:** User deletes a saved filter that was active -- board stays filtered with no way to clear.
**Why it happens:** `removeSavedFilter` already clears `activeFilterId` if the deleted filter was active (line 35 of saved-filter.store.ts). This is already handled correctly.
**Warning signs:** None -- existing code handles this.

### Pitfall 4: Command Palette Navigation Side Effect
**What goes wrong:** Command palette calls `setActiveFilter(filter.id)` then `onNavigate('/')` -- if user is already on '/', the navigation is a no-op but the filter should still apply.
**Why it happens:** React Router `navigate('/')` when already at '/' does nothing.
**How to avoid:** This is fine -- the store update is synchronous and SprintBoardTab will re-render from the store change regardless of navigation.

## Code Examples

### Reading from useSavedFilterStore in SprintBoardTab
```typescript
// Source: existing pattern from SavedFilterList.tsx
import { useSavedFilterStore } from '@/stores/saved-filter.store';

// Inside SprintBoardTab component:
const activeFilterId = useSavedFilterStore((s) => s.activeFilterId);
const savedFilters = useSavedFilterStore((s) => s.savedFilters);
const activeFilter = activeFilterId
  ? savedFilters.find((f) => f.id === activeFilterId)
  : null;
```

### Fetching JQL Results with useQuery
```typescript
// Source: follows existing pattern from SprintBoardTab's useQuery calls
const { data: savedFilterIssueKeys } = useQuery({
  queryKey: ['saved-filter-results', activeFilter?.jql],
  queryFn: async () => {
    const results = await fetchAllSearchPages(
      `${jiraBaseUrl!.replace(/\/$/, '')}/rest/api/2/search?jql=${encodeURIComponent(activeFilter!.jql)}&fields=key`,
      { Authorization: `Bearer ${jiraToken!}` },
    );
    return new Set(results.map((issue) => issue.key));
  },
  enabled: !!activeFilter?.jql && !!jiraBaseUrl && !!jiraToken,
  staleTime: 30_000,
});
```

### Integrating into filteredSwimlanes
```typescript
// Add saved filter key intersection to the existing filteredSwimlanes memo
const filteredSwimlanes = useMemo(() => {
  let result = swimlanes;

  // Saved filter: intersect with JQL result keys
  if (savedFilterIssueKeys && savedFilterIssueKeys.size > 0) {
    result = result
      .map(({ story, subtasks }) => {
        const storyMatches = savedFilterIssueKeys.has(story.key);
        const filteredSubtasks = subtasks.filter((s) => savedFilterIssueKeys.has(s.key));
        if (!storyMatches && filteredSubtasks.length === 0) return null;
        return { story, subtasks: filteredSubtasks };
      })
      .filter(Boolean);
  }

  // Then apply existing local filters...
  // (existing applyFilters logic)

  return result;
}, [swimlanes, savedFilterIssueKeys, /* existing deps */]);
```

### Active Filter Banner (UX indicator)
```typescript
// Show which saved filter is active so user knows why view is constrained
{activeFilter && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-primary/20">
    <Bookmark className="size-3.5 text-primary" />
    <span className="text-xs text-primary font-medium">
      Filter: {activeFilter.name}
    </span>
    <button onClick={() => setActiveFilter(null)} className="text-xs text-primary/70 hover:text-primary">
      Clear
    </button>
  </div>
)}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | taskflow/vitest.config.ts |
| Quick run command | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILT-02 | Saved filter JQL constrains displayed sprint board issues | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -t "saved filter"` | Wave 0 |
| FILT-02 | Clearing saved filter restores default view | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -t "clear saved filter"` | Wave 0 |
| FILT-04 | Sidebar filter click sets activeFilterId (already works) | unit | `cd taskflow && npx vitest run src/components/SavedFilterList.test.tsx` | Exists |
| FILT-04 | Command palette filter click sets activeFilterId (already works) | unit | N/A (CommandPalette has no test file but behavior is trivial) | N/A |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add saved filter integration tests to `SprintBoardTab.test.tsx` -- covers FILT-02
- [ ] Mock `useSavedFilterStore` in SprintBoardTab test setup -- required for new tests

## Sources

### Primary (HIGH confidence)
- Direct code reading of all relevant source files in the codebase
- `taskflow/src/stores/saved-filter.store.ts` -- activeFilterId store shape
- `taskflow/src/stores/filter.store.ts` -- local filter store shape
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` -- current filtering implementation
- `taskflow/src/components/app/Sidebar.tsx` -- favourite filter fetching and store sync
- `taskflow/src/components/app/CommandPalette.tsx` -- saved filter activation
- `taskflow/src/services/jira/filters.ts` -- Jira filter CRUD API
- `taskflow/src/services/jira/types.ts` -- JiraSavedFilter type (id, name, jql, description)
- `taskflow/src/services/jira/client.ts` -- fetchAllSearchPages pagination helper

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - clear gap identified, single integration point, well-understood data flow
- Pitfalls: HIGH - examined all edge cases in existing code, race conditions accounted for

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- internal project wiring, no external API changes)
