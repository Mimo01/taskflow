# Phase 35: Restore Saved Filters - Research

**Researched:** 2026-03-24
**Domain:** Jira saved filter CRUD, Zustand store, React component restoration
**Confidence:** HIGH

## Summary

Phase 35 restores the saved filters feature that was fully implemented in Phase 33 and then entirely deleted by commit `81d976d`. The deleted code is well-documented in git history and can be recovered verbatim or with minor adjustments to match any API changes since Phase 33. This is a restoration task, not a greenfield build -- the exact code that was deleted (878 lines across 12 files) is available via `git show 81d976d^` for each file.

The work breaks into four areas: (1) recreate the service layer (`filters.ts`, `JiraSavedFilter` type), (2) recreate the Zustand store (`saved-filter.store.ts`), (3) recreate the UI components (`SaveFilterDialog`, `EditFilterDialog`, `SavedFilterList`), and (4) re-wire the integration points (`UnifiedFilterBar`, `Sidebar`, `CommandPalette`, `SprintBoardTab`). An additional integration fix wires the `onDelete` prop for attachment deletion in `IssueDetailContent.tsx`.

**Primary recommendation:** Restore the deleted code from git history with targeted adjustments for the current Sidebar architecture (now data-driven via `sidebar-items.ts` and sectioned, unlike the hardcoded layout at Phase 33 time).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILT-01 | User can save current search as a named filter (synced to Jira server) | Restore `filters.ts` service with `createJiraFilter()`, `SaveFilterDialog` component, and "Save Filter" button in `UnifiedFilterBar` |
| FILT-02 | User can view and execute saved/favourite filters from Jira | Restore `saved-filter.store.ts`, `SavedFilterList` component, `fetchFavouriteFilters` service, wire into Sidebar and SavedFiltersWidget |
| FILT-03 | User can edit and delete saved filters | Restore `EditFilterDialog`, `updateJiraFilter`, `deleteJiraFilter` services, context menu in `SavedFilterList` |
| FILT-04 | User can access saved filters from sidebar and command palette | Re-wire `SavedFilterList` into Sidebar, add "Saved Filters" CommandGroup to CommandPalette |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 | Saved filter store (session-only, no persist) | Already used for all stores in the project |
| @tanstack/react-query | ^5.90.21 | Fetch favourite filters with staleTime caching | Already used for all Jira data fetching |
| lucide-react | ^0.577.0 | Icons (Bookmark, Pencil, Trash2, Check, etc.) | Already used throughout the project |

### Supporting (already available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @base-ui/react Dialog | existing | SaveFilterDialog and EditFilterDialog modals | Already used via shadcn Dialog wrapper |
| @base-ui/react ContextMenu | existing | Right-click edit/delete on filter items | Already used in SavedFilterList |
| @base-ui/react Popover | existing | Delete confirmation popover | Already used in SavedFilterList |

**Installation:** None needed. All dependencies already installed.

## Architecture Patterns

### Deleted Files to Restore

```
taskflow/src/
  services/jira/
    filters.ts              # CRUD: create, fetchFavourite, update, delete, buildJqlFromFilters
    filters.test.ts         # Service tests
    types.ts                # Add back JiraSavedFilter interface
  stores/
    saved-filter.store.ts   # Session-only Zustand store
  components/
    SaveFilterDialog.tsx     # Modal: save current filter to Jira
    EditFilterDialog.tsx     # Modal: edit existing filter name/JQL/description
    SavedFilterList.tsx      # Sidebar section: list, click-to-apply, context menu
    SavedFilterList.test.tsx # Component test stub
```

### Integration Points to Re-wire

```
taskflow/src/
  components/
    UnifiedFilterBar.tsx    # Add "Save Filter" button + SaveFilterDialog + handleSaveJiraFilter
    app/
      Sidebar.tsx           # Add SavedFilterList section (adapt for new data-driven architecture)
      CommandPalette.tsx     # Add "Saved Filters" CommandGroup
  routes/dashboard/
    SprintBoardTab.tsx      # Add saved filter JQL evaluation to board filtering
    widgets/
      SavedFiltersWidget.tsx # Upgrade from local quickFilters to Jira saved filters
    IssueDetailContent.tsx  # Wire onDelete prop to AttachmentsSection (integration fix)
```

### Pattern 1: Jira Filter CRUD Service

**What:** REST API calls to `/rest/api/2/filter` for create, update, delete, and `/rest/api/2/filter/favourite` for listing.
**When to use:** All saved filter operations.
**Key detail:** Uses the existing `apiFetch()` wrapper for instrumented logging, timeout, and auth error handling.

```typescript
// Exact pattern from deleted code (commit 81d976d^)
export async function createJiraFilter(
  baseUrl: string, token: string,
  name: string, jql: string, description?: string,
): Promise<JiraSavedFilter> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter`;
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, jql, description: description ?? '', favourite: true }),
  }, 'Save Filter');
  if (!response.ok) throw new Error(`Failed to create filter: ${response.status}`);
  return response.json();
}
```

### Pattern 2: Session-Only Zustand Store

**What:** `useSavedFilterStore` manages filter list, active filter ID, and loading state.
**Key detail:** NO persistence (no `persist` middleware). Filter list is refreshed from Jira on each session via `useQuery` in Sidebar.

```typescript
// Deleted store shape (restore as-is)
interface SavedFilterState {
  savedFilters: JiraSavedFilter[];
  activeFilterId: string | null;
  isLoading: boolean;
  setSavedFilters: (filters: JiraSavedFilter[]) => void;
  addSavedFilter: (filter: JiraSavedFilter) => void;
  updateSavedFilter: (filterId: string, updated: JiraSavedFilter) => void;
  removeSavedFilter: (filterId: string) => void;
  setActiveFilter: (filterId: string | null) => void;
  setLoading: (loading: boolean) => void;
}
```

### Pattern 3: Sidebar Architecture Change

**What:** Sidebar.tsx was refactored in Phase 34 to be data-driven via `sidebar-items.ts` with section grouping. The old Phase 33 code rendered `SavedFilterList` as a hardcoded section after nav items.
**Impact:** The `SavedFilterList` cannot simply be re-inserted at the same code location. It should be added after the sectioned nav items but before the bottom settings area, matching the visual hierarchy. Since `SavedFilterList` is not a nav link (it's a collapsible section with interactive items), it should remain a custom component rendered outside the data-driven loop.

### Anti-Patterns to Avoid

- **Do NOT add SavedFilterList to the sidebar-items.ts registry.** It is not a NavLink -- it's a complex interactive section with context menus, inline editing, and its own data fetching. Treat it as a standalone section below the nav items.
- **Do NOT persist saved filter state.** The store is session-only because the source of truth is Jira server. Persisting would cause stale data.
- **Do NOT use `useQuery` inside SavedFilterList.** Data fetching should happen in Sidebar.tsx and sync to the store, matching the original pattern (separation of fetching from rendering).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter CRUD API calls | Custom fetch wrapper | `apiFetch()` from `lib/apiFetch.ts` | Instrumented logging, timeout, auth error handling already built |
| Modal dialogs | Custom overlay | shadcn Dialog component | Consistent with all other dialogs in the app |
| Context menu (edit/delete) | Custom right-click handler | shadcn ContextMenu | Already used in filter list, consistent UX |
| JQL building from filters | String concatenation | `buildJqlFromFilters()` helper | Handles edge cases (empty arrays, quoting) |

## Common Pitfalls

### Pitfall 1: Sidebar Architecture Mismatch
**What goes wrong:** Attempting to re-insert the old Sidebar code verbatim, which assumed hardcoded nav items and no section grouping.
**Why it happens:** The old code used `useState` for `jiraToken`, `useQuery` for fetching filters, and rendered `SavedFilterList` directly. The new Sidebar is data-driven.
**How to avoid:** Add the `SavedFilterList` and its data-fetching hooks to the current Sidebar component, placing it after the `<nav>` element but before the bottom settings section. Keep the data-driven nav loop unchanged.
**Warning signs:** Sidebar failing to render, section groups disappearing.

### Pitfall 2: ContextMenu Render Prop API
**What goes wrong:** The old `SavedFilterList` used `ContextMenuTrigger render={<button>}` syntax which is a @base-ui/react pattern, not standard Radix.
**Why it happens:** Project uses @base-ui/react, not Radix, for primitives. The `render` prop pattern is correct for this project.
**How to avoid:** Verify the `render` prop pattern matches the current ContextMenu component API in `components/ui/context-menu.tsx`.

### Pitfall 3: SprintBoardTab Filter Evaluation
**What goes wrong:** Saved filter JQL is evaluated client-side by parsing simple clauses. Complex JQL (nested OR, functions like `currentSprint()`) will silently fail to match.
**Why it happens:** The original implementation used `parseSimpleJql` and `evaluateQfCondition` helpers for AND-joined clauses only.
**How to avoid:** Accept this limitation -- it was the original design. The filter still narrows results for simple JQL. Complex JQL filters should be run server-side via the full search API if needed (out of scope for this phase).

### Pitfall 4: Missing JiraSavedFilter Type
**What goes wrong:** The `JiraSavedFilter` interface was deleted from `types.ts` -- any component importing it will fail to compile.
**Why it happens:** Commit `81d976d` removed it along with the filter service.
**How to avoid:** Re-add the interface to `types.ts` as the first step before restoring any components.

### Pitfall 5: Attachment Delete Button (Integration Fix)
**What goes wrong:** `IssueDetailContent.tsx` renders `<AttachmentsSection>` without passing the `onDelete` prop. The `AttachmentFileRow` component conditionally renders the delete button only when `onDelete` is provided.
**Why it happens:** The `onDelete` prop was never wired when `AttachmentsSection` was first integrated.
**How to avoid:** Create a `handleDeleteAttachment` function in `IssueDetailContent.tsx` that calls `deleteAttachment()` from `services/jira/attachments.ts`, invalidates the issue detail query, and pass it as the `onDelete` prop.

## Code Examples

### JiraSavedFilter Type (to restore in types.ts)

```typescript
// Source: git show 81d976d^ -- taskflow/src/services/jira/types.ts
export interface JiraSavedFilter {
  id: string;
  name: string;
  jql: string;
  description?: string;
  owner?: { displayName: string };
  favourite?: boolean;
}
```

### Sidebar Filter Fetching (adapt for current architecture)

```typescript
// Original pattern from Sidebar.tsx before deletion
// Must be adapted: new Sidebar uses sidebarItems from store + SIDEBAR_SECTIONS
const { jiraBaseUrl } = useAuthStore();
const [jiraToken, setJiraToken] = useState<string | null>(null);
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);

const { data: favouriteFilters } = useQuery({
  queryKey: ['jira-favourite-filters', jiraBaseUrl],
  queryFn: () => fetchFavouriteFilters(jiraBaseUrl!, jiraToken!),
  staleTime: 2 * 60 * 1000,
  enabled: !!jiraBaseUrl && !!jiraToken,
});

const { setSavedFilters } = useSavedFilterStore();
useEffect(() => {
  if (favouriteFilters) setSavedFilters(favouriteFilters);
}, [favouriteFilters, setSavedFilters]);
```

### UnifiedFilterBar Save Button (to restore)

```typescript
// Add back to UnifiedFilterBar after "Save as quickfilter" section
{hasActiveFilters && !savingName && (
  <Button
    variant="ghost"
    size="xs"
    onClick={() => setSaveDialogOpen(true)}
    className="text-muted-foreground gap-1"
  >
    <BookmarkPlus className="size-3" />
    <span className="text-[11px]">Save Filter</span>
  </Button>
)}
```

### Attachment Delete Wiring (integration fix)

```typescript
// In IssueDetailContent.tsx, add handler and pass to AttachmentsSection
async function handleDeleteAttachment(attachment: JiraAttachment) {
  const token = await readSecret('jira-pat');
  await deleteAttachment(jiraBaseUrl, token, attachment.id);
  queryClient.invalidateQueries({ queryKey: ['issue-detail', issueKey] });
}

<AttachmentsSection
  attachments={issue.fields.attachment ?? []}
  issueKey={issueKey}
  jiraBaseUrl={jiraBaseUrl}
  onDelete={handleDeleteAttachment}
/>
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILT-01 | createJiraFilter calls POST /rest/api/2/filter | unit | `cd taskflow && npx vitest run src/services/jira/filters.test.ts -x` | Wave 0 |
| FILT-02 | fetchFavouriteFilters returns filter array | unit | `cd taskflow && npx vitest run src/services/jira/filters.test.ts -x` | Wave 0 |
| FILT-03 | updateJiraFilter PUT, deleteJiraFilter DELETE | unit | `cd taskflow && npx vitest run src/services/jira/filters.test.ts -x` | Wave 0 |
| FILT-04 | SavedFilterList renders filters, click applies | unit | `cd taskflow && npx vitest run src/components/SavedFilterList.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/services/jira/filters.test.ts -x`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/services/jira/filters.test.ts` -- restore from git (covers FILT-01, FILT-02, FILT-03)
- [ ] `taskflow/src/components/SavedFilterList.test.tsx` -- restore from git (covers FILT-04)

## Sources

### Primary (HIGH confidence)
- Git history: `git show 81d976d` -- exact diff of all deleted code (878 lines, 12 files)
- Git history: `git show 81d976d^` -- pre-deletion state of all affected files
- v1.5 Milestone Audit: `.planning/v1.5-MILESTONE-AUDIT.md` -- gap analysis and tech debt items
- Current codebase: direct inspection of all integration point files

### Secondary (MEDIUM confidence)
- Jira REST API v2 `/rest/api/2/filter` -- standard CRUD endpoints (well-established, unchanged for years)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages needed, all existing
- Architecture: HIGH -- exact deleted code available in git, integration points inspected
- Pitfalls: HIGH -- Sidebar architecture change is the only non-trivial adaptation needed

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- this is a restoration task with no external dependency changes)
