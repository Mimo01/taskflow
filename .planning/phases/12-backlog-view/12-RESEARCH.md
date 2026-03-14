# Phase 12: Backlog View - Research

**Researched:** 2026-03-14
**Domain:** Jira Agile REST API (backlog JQL, sprint move), React full-page route, optimistic update with rollback, client-side filtering, bulk action bar
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full-page route: `/backlog`
- Visible to both Developer and PM roles
- Position: Developer section after Sprint Board, before MR Attention; PM section after Workload, before Releases
- Stories only in backlog list — no subtasks (subtasks appear in issue detail)
- Each row: issue key + summary + story points + assignee avatar + epic badge (colored chip)
- Epic badge matches Jira's backlog style — colored chip with epic name
- Clicking any row opens IssueDetailSheet (BACK-05 — already solved by Phase 9)
- Checkbox per row; selecting any row reveals sticky bulk action bar at page bottom
- Action bar: "Move X issues to active sprint" button + deselect count
- On click: optimistic immediate removal from backlog list + API call
- On failure: rollback (issues reappear) + inline error in action bar
- If no active sprint: button disabled with tooltip "No active sprint in this project"
- Horizontal filter bar below page header: [Epic] [Label] [Assignee] dropdowns
- Active filters shown as dismissible chips in same bar
- Multiple active filters use AND logic
- Filters applied client-side after fetching full backlog (no new JQL per filter change)
- "+ Create Story" button in page header (top-right)
- Opens Phase 11 CreateEditIssueModal with issue type pre-set to Story
- On successful create: invalidate backlog cache, new story appears in list

### Claude's Discretion
- Exact epic badge color assignment (derive from epic key hash, or cycle through a palette)
- Checkbox placement within the row (left edge vs. hover-reveal)
- Exact sticky action bar position and animation
- Skeleton placeholder while backlog loads
- Empty state copy when backlog is empty or filters match nothing

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BACK-01 | User can view all backlog issues (issues not in any active or future sprint) in a paginated list | `fetchAllSearchPages` + compound JQL confirmed; backlog query function pattern documented below |
| BACK-02 | User can move one or more backlog issues into the active sprint | Jira Agile REST `POST /rest/agile/1.0/sprint/{id}/issue` confirmed; `fetchActiveSprint` already returns sprint ID; optimistic removal + rollback pattern mirrored from SprintBoardTab |
| BACK-03 | User can create a new story directly from the backlog view | `CreateEditIssueModal` already accepts `defaultIssueType="Story"`; AppLayout owns modal state; backlog triggers via `openCreateStory` callback passed through Outlet context |
| BACK-04 | User can filter the backlog by epic, label, and assignee | Client-side filter documented; epic name via `epicNameFieldKey`, label via `fields.labels`, assignee via `fields.assignee.displayName` |
| BACK-05 | User can open the issue detail panel from any backlog row | `IssueDetailSheet` is mounted at AppLayout; row click calls `onIssueClick(issue.key)` via Outlet context — zero new infrastructure |
</phase_requirements>

---

## Summary

Phase 12 is primarily a UI composition phase. The heavy infrastructure (paginated Jira search, active sprint discovery, issue detail sheet, create modal) already exists and is verified working. The new work is: a new full-page route at `/backlog`, a `fetchBacklogIssues()` function in jira.ts, a new `addIssuesToSprint()` API call, a `BacklogRow` component, a bulk action bar, and a client-side filter bar.

The backlog JQL is a compound clause (`sprint is EMPTY OR sprint not in (openSprints(), futureSprints())`) validated in prior research and documented in STATE.md. The `fetchAllSearchPages` private function in jira.ts handles pagination already — the new `fetchBacklogIssues` function follows the same internal pattern as `fetchSprintIssues`. The move-to-sprint API is Jira Agile REST, the same subsystem used by `fetchActiveSprint` — no new auth or transport work required.

The optimistic update + rollback pattern is well-established in SprintBoardTab (drag-and-drop status change). The backlog move follows the same shape: capture pre-move state in a local variable, update query cache immediately, call API, rollback on catch. Client-side filtering is a straightforward `useMemo` over the raw result array.

**Primary recommendation:** Scaffold the route, implement `fetchBacklogIssues` + `addIssuesToSprint` in jira.ts, build `BacklogRow` + `BacklogPage`, add filter bar and bulk action bar. All integration points (Sidebar, main.tsx, Outlet context, AppLayout modal) are one-line or prop changes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | Existing (project) | Data fetching, query cache, optimistic updates | Already used everywhere; `useQueryClient` for cache manipulation |
| react-router-dom | Existing | Full-page route `/backlog`, `useOutletContext` | Project router; all routes use this |
| zustand | Existing | `useAuthStore` (credentials), `useSettingsStore` (field keys) | Project state layer |
| lucide-react | Existing | Icons (Checkbox, Filter, X, etc.) | Project icon library |
| @base-ui/react | Existing | Popover for filter dropdowns | Already used for StatusPopover and CreateEditIssueModal |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn` from `@/lib/utils` | Existing | Conditional className composition | All component styling |
| `readSecret` from stronghold | Existing | PAT read on mount | Token read pattern (identical to SprintBoardTab) |
| `apiFetch` from `@/lib/apiFetch` | Existing | Tauri HTTP — avoids CORS | All Jira API calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side filtering | New JQL per filter | Client-side is correct per locked decision; avoids API round-trip per filter change |
| `@base-ui/react/popover` for dropdowns | Native `<select>` | Popover gives dismissible chip UX and matches StatusPopover pattern |

**Installation:** No new dependencies needed — all libraries already in project.

---

## Architecture Patterns

### Recommended Project Structure

The backlog route follows the existing tab/route pattern: a flat file in `src/routes/dashboard/` rather than its own subdirectory, since all current routes are co-located there.

```
src/routes/dashboard/
├── BacklogPage.tsx          # New — full-page component (route entry point)
├── BacklogPage.test.tsx     # New — BACK-01..05 test file
├── BacklogRow.tsx           # New — single backlog issue row with checkbox + epic badge
└── BacklogFilterBar.tsx     # New — horizontal filter bar with dropdown + chips
src/services/
└── jira.ts                  # Modified — add fetchBacklogIssues() + addIssuesToSprint()
src/components/app/
└── Sidebar.tsx              # Modified — add /backlog NavLink in dev + PM sections
src/main.tsx                 # Modified — add /backlog route entry
```

### Pattern 1: Fetch Backlog Issues (new jira.ts function)

**What:** Wraps `fetchAllSearchPages` with backlog-specific JQL, stories only, fields needed for the backlog row.
**When to use:** Called by `BacklogPage` on mount and after create/move success.

```typescript
// Mirrors fetchSprintIssues — same pagination infrastructure, different JQL
export async function fetchBacklogIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const spFields = [...new Set(['customfield_10016', storyPointsFieldKey])].join(',');
  // Epic name field needed for the epic badge chip
  const epicFields = [...new Set(['customfield_10014', 'customfield_10015', epicLinkFieldKey, epicNameFieldKey])].join(',');
  const fields = `summary,status,assignee,issuetype,labels,${spFields},${epicFields}`;
  const jql = encodeURIComponent(
    `project = ${projectKey} AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints())) AND issuetype not in subtaskIssueTypes() ORDER BY created DESC`
  );
  const baseSearchUrl = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`;
  return fetchAllSearchPages(baseSearchUrl, headers);
}
```

**Confidence:** HIGH — JQL validated in prior research (STATE.md); `fetchAllSearchPages` is internal but called by multiple existing functions in the same file; field pattern mirrors `fetchIssueDetail`.

### Pattern 2: Add Issues to Sprint (new jira.ts function)

**What:** POST to Jira Agile REST to move one or more issues into a sprint.
**When to use:** Called by `BacklogPage` when user confirms bulk action bar.

```typescript
// Jira Agile REST — POST /rest/agile/1.0/sprint/{sprintId}/issue
// Body: { issues: string[] }  — array of issue keys
// Response: 204 No Content on success (same as bulkUpdateIssue pattern)
export async function addIssuesToSprint(
  baseUrl: string,
  token: string,
  sprintId: number,
  issueKeys: string[],
): Promise<void> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await apiFetch(
    'jira',
    `${base}/rest/agile/1.0/sprint/${sprintId}/issue`,
    { method: 'POST', headers, body: JSON.stringify({ issues: issueKeys }) },
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(`Move to sprint failed: ${res.status}`);
  }
}
```

**Confidence:** HIGH — Jira Agile REST `POST /rest/agile/1.0/sprint/{id}/issue` is a stable, long-standing endpoint on Jira DC. Documented at `https://developer.atlassian.com/cloud/jira/software/rest/api-group-sprint/#api-rest-agile-1-0-sprint-sprintid-issue-post`. The DC equivalent uses the same path. `fetchActiveSprint` already calls `/rest/agile/1.0/board` so the agile subsystem is confirmed available.

### Pattern 3: Optimistic Remove + Rollback (BacklogPage)

**What:** Captures the issue list before mutation, removes selected keys immediately, calls API, rolls back on error.
**When to use:** Move-to-sprint action.

```typescript
// In BacklogPage — mirrors SprintBoardTab handleDragEnd pattern
async function handleMoveToSprint() {
  if (!activeSprint || selectedKeys.size === 0) return;
  const keysToMove = Array.from(selectedKeys);
  // Snapshot pre-mutation state for rollback
  const previousIssues = queryClient.getQueryData<JiraIssue[]>(
    ['jira-backlog', activeJiraProject, jiraBaseUrl]
  );
  // Optimistic: remove moved issues from cache immediately
  queryClient.setQueryData<JiraIssue[]>(
    ['jira-backlog', activeJiraProject, jiraBaseUrl],
    (old) => (old ?? []).filter((i) => !selectedKeys.has(i.key))
  );
  setSelectedKeys(new Set());
  setBulkError(null);
  try {
    await addIssuesToSprint(jiraBaseUrl!, jiraToken!, activeSprint.id, keysToMove);
    // Invalidate both caches — sprint board picks up new issues too
    queryClient.invalidateQueries({ queryKey: ['jira-sprint-issues'] });
    queryClient.invalidateQueries({ queryKey: ['jira-backlog'] });
  } catch {
    // Rollback
    queryClient.setQueryData(
      ['jira-backlog', activeJiraProject, jiraBaseUrl],
      previousIssues
    );
    setSelectedKeys(new Set(keysToMove));
    setBulkError('Failed to move issues — changes reversed');
  }
}
```

### Pattern 4: Client-Side Filter

**What:** `useMemo` computes visible issues from raw query data + active filter state.
**When to use:** Any filter dropdown change.

```typescript
const visibleIssues = useMemo(() => {
  if (!issues) return [];
  return issues.filter((issue) => {
    const epicMatch =
      !activeEpic ||
      (issue.fields[epicLinkFieldKey] as string | null) === activeEpic;
    const labelMatch =
      activeLabels.size === 0 ||
      (issue.fields.labels as string[] ?? []).some((l) => activeLabels.has(l));
    const assigneeMatch =
      !activeAssignee ||
      issue.fields.assignee?.displayName === activeAssignee;
    return epicMatch && labelMatch && assigneeMatch;
  });
}, [issues, activeEpic, activeLabels, activeAssignee, epicLinkFieldKey]);
```

### Pattern 5: Epic Badge Color Assignment (Claude's Discretion)

**What:** Assigns a deterministic color from a fixed palette based on epic key hash.
**When to use:** Rendering the epic chip on each BacklogRow.

Recommendation: hash the epic key to an index into a 6-color palette using the same approach Jira's UI uses (modulo N palette).

```typescript
const EPIC_COLORS = [
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-teal-100 text-teal-800 border-teal-300',
] as const;

function epicColorClass(epicKey: string): string {
  let hash = 0;
  for (let i = 0; i < epicKey.length; i++) hash = (hash * 31 + epicKey.charCodeAt(i)) >>> 0;
  return EPIC_COLORS[hash % EPIC_COLORS.length];
}
```

This is deterministic (same epic always same color), stable across re-renders, and requires no external dependency.

### Pattern 6: Outlet Context Extension

`AppLayout` already passes `{ onIssueClick, openEdit, openAddSubtask }` via Outlet context. BacklogPage needs `openCreateStory` — add it to AppLayout's handleOpenCreate wrapper and the Outlet context object.

```typescript
// In AppLayout — new handler
const handleOpenCreateStory = () => {
  setCreateModalMode('create');
  setCreateModalDefaultType('Story');
  setCreateModalInitialValues(undefined);
  setCreateModalDefaultParent(undefined);
  setCreateModalOpen(true);
};

// Outlet context — add openCreateStory:
<Outlet context={{ onIssueClick: setSelectedIssueKey, openEdit: handleOpenEdit, openAddSubtask: handleOpenAddSubtask, openCreateStory: handleOpenCreateStory }} />
```

BacklogPage receives it:
```typescript
const { onIssueClick, openCreateStory } = useOutletContext<{
  onIssueClick: (key: string) => void;
  openCreateStory: () => void;
}>();
```

### Pattern 7: Sidebar NavLink Placement

Add `/backlog` in both role sections — follows `navLinkClass` pattern exactly:

```typescript
// After Sprint Board (developer section):
<NavLink to="/backlog" className={navLinkClass}>
  <List className="h-4 w-4 shrink-0" />
  <span className="hidden md:block">Backlog</span>
</NavLink>

// After Workload (PM section):
<NavLink to="/backlog" className={navLinkClass}>
  <List className="h-4 w-4 shrink-0" />
  <span className="hidden md:block">Backlog</span>
</NavLink>
```

Lucide icon: `List` is the standard backlog icon. Import alongside existing icons.

### Pattern 8: Route Registration (main.tsx)

```typescript
// Add to router children array, alongside other flat routes:
{ path: '/backlog', element: <BacklogPage /> },

// Import at top with other route imports:
import BacklogPage from './routes/dashboard/BacklogPage';
```

### Anti-Patterns to Avoid

- **DO NOT re-fetch active sprint inside BacklogPage**: `fetchActiveSprint` is already called by SprintBoardTab. Use a shared query key `['jira-active-sprint', activeJiraProject, jiraBaseUrl]` so both routes share the cached result. If Sprint Board uses a different key today, BacklogPage should still define its own query with `staleTime: 5 * 60 * 1000` — it does not need real-time accuracy.
- **DO NOT apply filters with new JQL requests**: Locked decision says client-side only.
- **DO NOT use `JiraIssue` for the `labels` field without checking**: `fields.labels` is typed as `[key: string]: unknown` — always cast with `(issue.fields.labels as string[] | undefined) ?? []`.
- **DO NOT nest IssueDetailSheet inside BacklogPage**: It is mounted at AppLayout level and shared. Only call `onIssueClick(key)` from the row.
- **DO NOT call CreateEditIssueModal from BacklogPage**: The modal lives at AppLayout level. Call `openCreateStory()` from Outlet context.
- **DO NOT use `fetchAllPages` (it does not exist)**: The paginating helper is the private `fetchAllSearchPages`. The new `fetchBacklogIssues` function must live inside jira.ts to access it, just like `fetchSprintIssues`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Paginated backlog fetch | Custom loop | `fetchAllSearchPages` (private, call from within jira.ts) | Already handles partial-page rollup, 400 error surfacing |
| Active sprint discovery | New board/sprint query | `fetchActiveSprint()` — reuse or share query cache | Already tested; two-step board discovery done |
| Issue detail panel | New panel | `IssueDetailSheet` at AppLayout level | Zero cost — BACK-05 is free |
| Create story modal | New modal | `CreateEditIssueModal` with `defaultIssueType="Story"` | Phase 11 built and verified |
| Optimistic update | Manual re-fetch after action | `queryClient.setQueryData()` + rollback on catch | Pattern from SprintBoardTab — battle-tested |
| PAT token access | Store token in component state | `readSecret('jira-pat')` in `useEffect` on mount | Matches all existing tabs |
| Epic color hashing | External library | Inline hash mod palette | Zero dependency; deterministic |

---

## Common Pitfalls

### Pitfall 1: JQL futureSprints() availability
**What goes wrong:** Jira DC instances without Jira Software license may not have `futureSprints()` JQL function, returning a 400.
**Why it happens:** `futureSprints()` is a Jira Software extension function.
**How to avoid:** STATE.md explicitly flags "Validate compound backlog JQL against Orange instance" as a pending concern. The existing `fetchSprintIssues` already handles 400 errors with a specific error message ("Sprint filtering unavailable — ensure Jira Software is installed"). `fetchBacklogIssues` must implement the same 400 handler, offering graceful fallback or clear error message.
**Warning signs:** User sees a 400 error on the backlog page but sprint board works — indicates `openSprints()`/`futureSprints()` restriction.

### Pitfall 2: Epic fields not in JiraIssue type
**What goes wrong:** `JiraIssue.fields` has `[key: string]: unknown` for dynamic fields. The `epicLinkFieldKey` and `epicNameFieldKey` values are dynamic — never hardcode `customfield_10014` or `customfield_10015` as field names in the type.
**Why it happens:** Epic field IDs are instance-specific (discovered via `discoverCustomFields`).
**How to avoid:** Always read epic fields as `issue.fields[epicLinkFieldKey] as string | null` and `issue.fields[epicNameFieldKey] as string | null`. Both keys come from `useSettingsStore()`.
**Warning signs:** Epic badge always shows empty, or TypeScript error accessing the field directly.

### Pitfall 3: fetchAllSearchPages is private
**What goes wrong:** Trying to call `fetchAllSearchPages` from BacklogPage directly — it's not exported from jira.ts.
**Why it happens:** It's an internal helper (lowercase, not exported).
**How to avoid:** Add `fetchBacklogIssues` as a new exported function inside jira.ts so it has lexical access to the private helper. This matches the pattern of `fetchSprintIssues`.
**Warning signs:** TypeScript "not exported" error at import.

### Pitfall 4: Outlet context type mismatch
**What goes wrong:** BacklogPage uses `useOutletContext` but doesn't get `openCreateStory` because it wasn't added to AppLayout's context value.
**Why it happens:** AppLayout's Outlet context object must be updated before BacklogPage can consume the new callback.
**How to avoid:** Update Outlet context in main.tsx's AppLayout in the same task that adds the BacklogPage route. Keep the type in sync — export a named type for the outlet context if it's referenced in multiple routes.
**Warning signs:** `openCreateStory is not a function` runtime error when clicking "+ Create Story".

### Pitfall 5: Sprint ID type (number, not string)
**What goes wrong:** `addIssuesToSprint` uses `sprintId` in the URL path. `JiraActiveSprint.id` is typed as `number`. Using it as a string (template literal without coercion) is fine, but if the caller accidentally passes a string it may create an invalid URL.
**Why it happens:** Jira sprint IDs are integers.
**How to avoid:** Keep `sprintId: number` in the function signature. `fetchActiveSprint` returns `JiraActiveSprint` with `id: number` — pass `activeSprint.id` directly.

### Pitfall 6: Label field not included in JiraIssue type
**What goes wrong:** `labels` is not a named field in the `JiraIssue` interface — it's accessed via `[key: string]: unknown`.
**Why it happens:** The interface was built for sprint board use, which doesn't need labels.
**How to avoid:** Cast `issue.fields.labels as string[] | undefined` in the filter logic and BacklogRow. Do not attempt to add `labels` to the JiraIssue interface — this creates a conflict with the index signature unless typed as `unknown`.

### Pitfall 7: Checkbox placement and pointer events with row click
**What goes wrong:** If the entire row has an `onClick` (for IssueDetailSheet), the checkbox click also triggers the row click, opening the issue detail unintentionally.
**Why it happens:** Event bubbling.
**How to avoid:** Add `e.stopPropagation()` in the checkbox `onChange` handler. The row click target should be the summary text (like TaskRow's button pattern), not the entire row container.

---

## Code Examples

### BacklogPage: TanStack Query pattern
```typescript
// Source: mirrors SprintBoardTab — same auth, query, staleTime pattern
const { data: issues, isLoading, isError } = useQuery({
  queryKey: ['jira-backlog', activeJiraProject, jiraBaseUrl],
  queryFn: () =>
    fetchBacklogIssues(
      jiraBaseUrl!,
      jiraToken!,
      activeJiraProject!,
      storyPointsFieldKey,
      epicLinkFieldKey,
      epicNameFieldKey,
    ),
  staleTime: 60_000,
  enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});
```

### Active sprint query (shared cache key)
```typescript
// Use a consistent query key so BacklogPage and SprintBoardTab share the cache
const { data: activeSprint } = useQuery({
  queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl],
  queryFn: () => fetchActiveSprint(jiraBaseUrl!, jiraToken!, activeJiraProject!),
  staleTime: 5 * 60 * 1000,
  enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});
```

### Bulk action bar: disabled state
```typescript
// Button disabled when no active sprint; tooltip via title attribute (no extra library)
<button
  type="button"
  disabled={!activeSprint || selectedKeys.size === 0}
  title={!activeSprint ? 'No active sprint in this project' : undefined}
  onClick={handleMoveToSprint}
>
  Move {selectedKeys.size} issue{selectedKeys.size !== 1 ? 's' : ''} to active sprint
</button>
```

### Filter: deriving filter options from data
```typescript
// Compute unique values for filter dropdowns from the full issue list
const filterOptions = useMemo(() => {
  const epics = new Map<string, string>(); // epicKey → epicName
  const labels = new Set<string>();
  const assignees = new Set<string>();
  for (const issue of issues ?? []) {
    const epicKey = issue.fields[epicLinkFieldKey] as string | null;
    const epicName = issue.fields[epicNameFieldKey] as string | null;
    if (epicKey && epicName) epics.set(epicKey, epicName);
    for (const label of (issue.fields.labels as string[] | undefined) ?? []) labels.add(label);
    if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName);
  }
  return { epics, labels: Array.from(labels), assignees: Array.from(assignees) };
}, [issues, epicLinkFieldKey, epicNameFieldKey]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JQL-per-filter (server-side) | Client-side filter after full fetch | Phase 12 locked decision | No API round-trip on filter change; all data in memory |
| Route per tab in its own directory | Flat files in `routes/dashboard/` | Phase 9 (IssueDetailSheet co-location) | Keep BacklogPage.tsx in `routes/dashboard/` |
| Separate modal per route | Shared modal at AppLayout level | Phase 11 | BacklogPage triggers modal via Outlet context callback |

**Note on route registration:** `main.tsx` currently uses `element: <Component />` (eager import), not lazy. Continue using eager imports to match existing pattern — no `lazy: () => import(...)` unless the CONTEXT.md had specified it (it did not; the code_context section mentions the lazy pattern as a possible approach, but all existing routes are eager).

---

## Open Questions

1. **futureSprints() JQL function availability on Orange instance**
   - What we know: Function is available on Jira Software-licensed instances. STATE.md flags this as a pending validation item.
   - What's unclear: Whether the Orange instance has Jira Software licensing at the project level that enables these functions.
   - Recommendation: Implement the same 400-error handler as `fetchSprintIssues`. If the full compound clause fails, surface a clear error message: "Backlog query unavailable — ensure Jira Software license is active for this project." The fallback is a simpler `sprint is EMPTY` JQL (which may include issues from future sprints but is better than nothing).

2. **Sprint Board query key mismatch**
   - What we know: SprintBoardTab uses `['jira-issues', 'sprint-board', ...]`. After a move-to-sprint, BacklogPage invalidates `['jira-sprint-issues']` (per CONTEXT.md specifics).
   - What's unclear: The actual query key SprintBoardTab uses is `['jira-issues', 'sprint-board', ...]` — not `['jira-sprint-issues']`. If BacklogPage invalidates the wrong key, SprintBoardTab won't refresh.
   - Recommendation: In the move-to-sprint success handler, invalidate with `queryKey: ['jira-issues', 'sprint-board']` (matching SprintBoardTab's actual key), not `['jira-sprint-issues']`. Verify by reading SprintBoardTab.tsx line 126 — confirmed key is `['jira-issues', 'sprint-board', ...]`.

3. **fetchActiveSprint query key for cache sharing**
   - What we know: `fetchActiveSprint` is not currently called with a TanStack Query wrapper in jira.ts — it's a plain function. SprintBoardTab does not appear to useQuery for active sprint separately.
   - What's unclear: If SprintBoardTab already queries active sprint under some key, BacklogPage should share it.
   - Recommendation: BacklogPage defines its own query with key `['jira-active-sprint', activeJiraProject, jiraBaseUrl]` and `staleTime: 5 * 60 * 1000`. This is safe — if SprintBoardTab later queries under the same key they'll share the cache automatically.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react + @testing-library/jest-dom |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-01 | Backlog issues render in list from mocked `fetchBacklogIssues` | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ❌ Wave 0 |
| BACK-01 | Loading skeleton shown while query pending | unit | same | ❌ Wave 0 |
| BACK-01 | Empty state shown when backlog has zero issues | unit | same | ❌ Wave 0 |
| BACK-02 | Selecting rows reveals bulk action bar | unit | same | ❌ Wave 0 |
| BACK-02 | "Move to sprint" button disabled when no active sprint | unit | same | ❌ Wave 0 |
| BACK-02 | Optimistic removal: selected issues disappear immediately on action | unit | same | ❌ Wave 0 |
| BACK-02 | Rollback: issues reappear + error shown on API failure | unit | same | ❌ Wave 0 |
| BACK-03 | "+ Create Story" button click calls `openCreateStory` from outlet context | unit | same | ❌ Wave 0 |
| BACK-04 | Epic filter narrows visible rows to matching epic only | unit | same | ❌ Wave 0 |
| BACK-04 | Assignee filter narrows visible rows | unit | same | ❌ Wave 0 |
| BACK-04 | Multiple active filters use AND logic | unit | same | ❌ Wave 0 |
| BACK-04 | Filter chip dismissal clears that filter | unit | same | ❌ Wave 0 |
| BACK-05 | Row click calls `onIssueClick` with issue key | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/routes/dashboard/BacklogPage.test.tsx` — covers all BACK-01..05 requirements
- [ ] No framework install needed — vitest already configured

The mock pattern for `BacklogPage.test.tsx` follows SprintBoardTab.test.tsx exactly:
- `vi.mock('@/services/jira', ...)` — mock `fetchBacklogIssues`, `addIssuesToSprint`, `fetchActiveSprint`
- `vi.mock('@/services/stronghold', ...)` — mock `readSecret`
- `vi.mock('@/stores/auth.store', ...)` — mock `useAuthStore`
- `vi.mock('@/stores/settings.store', ...)` — mock `useSettingsStore` with all four field keys
- `vi.mock('react-router-dom', ...)` — mock `useOutletContext` with `{ onIssueClick: vi.fn(), openCreateStory: vi.fn() }`
- `vi.mock('lucide-react', ...)` — avoid SVG rendering issues

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `taskflow/src/services/jira.ts`, `taskflow/src/routes/dashboard/SprintBoardTab.tsx`, `taskflow/src/main.tsx`, `taskflow/src/components/app/Sidebar.tsx`, `taskflow/src/routes/dashboard/CreateEditIssueModal.tsx`, `taskflow/src/stores/settings.store.ts`
- `.planning/phases/12-backlog-view/12-CONTEXT.md` — locked decisions, JQL, API endpoint, existing code context
- `.planning/STATE.md` — accumulated decisions, confirmed JQL pattern, futureSprints() validation flag
- `taskflow/vitest.config.ts`, `taskflow/src/test/setup.ts` — test infrastructure confirmed

### Secondary (MEDIUM confidence)
- Jira Agile REST API: `POST /rest/agile/1.0/sprint/{sprintId}/issue` — stable endpoint on Jira DC; same subsystem as `fetchActiveSprint` (confirmed active in Phase 9/10 research). URL pattern consistent with prior usage in jira.ts.

### Tertiary (LOW confidence — needs Orange instance validation)
- `futureSprints()` JQL function availability: confirmed in Jira Software docs but Orange instance has a pending validation flag in STATE.md.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use and verified working
- Architecture: HIGH — patterns directly copied from SprintBoardTab and Phase 11; no novel infrastructure
- API (move-to-sprint): MEDIUM-HIGH — endpoint is stable DC API; not called yet in this codebase
- Pitfalls: HIGH — derived from codebase inspection + prior research notes in STATE.md
- futureSprints() availability: LOW — pending Orange instance validation (flagged in STATE.md)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain — Jira DC APIs, established patterns)
