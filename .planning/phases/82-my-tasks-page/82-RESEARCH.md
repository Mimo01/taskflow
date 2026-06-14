# Phase 82: My Tasks Page — Research

**Researched:** 2026-06-14
**Domain:** React + react-query + Zustand/Tauri-Store + Jira REST pagination + in-memory pure sort
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single-select, transient filter. Clicking a count filters the list; only one active at a time. Active filter resets on reload.
- **D-02:** Active filter applies on top of the current grouping mode and scope (narrows, not replaces).
- **D-03:** Subtasks always render nested (indented, `pl-8`) under their parent in every grouping mode.
- **D-04:** My Day smart-sort: a parent's sort position = highest-attention item in its subtree, against the band order: flagged/blocked → overdue → in-review-with-my-MR → in-progress → to-do → done.
- **D-05:** All-Assigned group ordering (By Sprint & Parent): active sprint(s) first, then closed sprints newest-first, then Backlog last.
- **D-06:** Progressive/lazy loading for All-Assigned. No client-side page cap. Loading indicator shown while streaming. Criterion 6 mandates a unit test: 250 results when total=250 and first page returns 50.
- **D-07:** Right-click context menu: Log Work (opens `LogWorkPopover`) and Copy issue key / link only. Flag/Unflag and Open-in-browser are deferred.
- **D-08:** Row body click → `PeekPanel`; issue-key click → full-page detail; status-pill click → `StatusPopover`.
- **D-09:** Default grouping on first load = My Day; default scope = Current Sprint. Restored from store after first use.
- **D-10:** New `stores/my-tasks.store.ts` (Zustand + Tauri Store `my-tasks.json`). Persists grouping mode and scope only.
- **D-11:** Reuse `EmptyState` / `ErrorState` / `Skeleton` from `components/ui/`. Empty cases: My Day nothing urgent, active filter zero rows, All Assigned empty.

### Claude's Discretion

- Exact loading-indicator placement/style for progressive All-Assigned paging (within D-06).
- Precise component decomposition for the row (reusing/adapting `TaskCard` / `BacklogRow` anatomy vs. a new `MyTaskRow`) — as long as the row shows the full anatomy in criterion/MYTASK-05.
- Precise store shape and selector design within D-10.
- Whether the collapse/expand affordance on sprint/parent groups is added (not required this phase; allowed if cheap).

### Deferred Ideas (OUT OF SCOPE)

- Flag/Unflag and Open-in-browser context-menu actions.
- Rank-order priority-stripe coloring (`priority-stripe-rest-rank.md`).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MYTASK-01 | User can open a dedicated "My Tasks" page from the sidebar | Route registration pattern (React.lazy + withLazy), sidebar-items.ts + ICON_MAP extension |
| MYTASK-02 | Summary/filter strip with counts (To Do / In Progress / In Review / Done this sprint / Overdue / MRs awaiting me) doubling as filters | Counts derived from loaded dataset; filter = transient `useState`; strip is a row of count-pill buttons |
| MYTASK-03 | Three grouping modes — My Day, By Status, By Sprint & Parent | Pure grouping functions over `fetchMyTasksHierarchy` return; shadcn `Tabs` |
| MYTASK-04 | My Day smart sort (flagged/blocked → overdue → in-review-with-my-MR → in-progress → to-do → done) | `isIssueFlagged` + `duedate` + `status.statusCategory.key` + `OverdueBadge` logic; concrete algorithm below |
| MYTASK-05 | Each row: type, key, priority, summary, status pill, due date (overdue highlighted), SP, MR health badge, time logged/remaining | `MyTaskRow` adapts `BacklogRow` anatomy; `statusPillClass`; `OverdueBadge`; `Progress` component |
| MYTASK-06 | Inline actions: peek / open full / status transition / log work / right-click context menu | `PeekPanel`, `StatusPopover`, `LogWorkPopover`, `context-menu.tsx` — all existing, no new primitives |
| MYTASK-07 | Scope toggle: current sprint ↔ all assigned; all-assigned via server-side pagination, no page cap | `fetchMyTasksHierarchy` (sprint scope) + new `fetchAllAssignedHierarchy` wrapping exported `fetchAllSearchPages` from `jira/client.ts`; useQuery streaming with `placeholderData` pattern |
| MYTASK-08 | Grouping and scope preferences persist across sessions | `my-tasks.store.ts` — Zustand + `createTauriStorage('my-tasks.json')` + `persist` middleware; pattern mirrors `pinned-tabs.store.ts` |
</phase_requirements>

---

## Summary

Phase 82 delivers a personal command-center page. All required UI primitives, data-fetching functions, and persistence infrastructure already exist in the codebase. The work is primarily composition — wiring existing pieces into a new page tree — plus three new items: the `MyTaskRow` component, the `my-tasks.store.ts` persisted store, and a `fetchAllAssignedHierarchy` service function for the All-Assigned scope.

The highest-risk piece is the My Day smart-sort algorithm (D-04), which must evaluate a parent's sort band from its whole subtree (all subtasks), not the parent alone. This is a pure function and is fully unit-testable. The second-highest risk is the All-Assigned pagination correctness (D-06 / criterion 6): the project already has `fetchAllSearchPages` in `jira/client.ts` that is provably complete (loops until `startAt >= total`), so the risk is avoiding a single-page-capped call at the new query layer.

The `fetchMyTasksHierarchy` function returns `{ issues: JiraIssue[], myIssueKeys: Set<string> }`. Its `fields` string includes `duedate` for parent stories but **not** for subtasks (subtaskFields is narrower). The `flaggedFieldKey` (`customfield_10021`) is **also not included** in the existing fields query — `fetchMyTasksHierarchy` must be extended to add `flaggedFieldKey` to both `fields` and `subtaskFields` so that My Day band classification can detect flagged items.

**Primary recommendation:** Compose the page from existing primitives. Extend `fetchMyTasksHierarchy` to include the flagged field. Write `fetchAllAssignedHierarchy` as a thin wrapper around `fetchAllSearchPages`. Implement the smart-sort as a pure function with co-located unit tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page routing + sidebar entry | Frontend (Vite/React Router) | — | Client-side SPA routing; `routes.tsx` + `sidebar-items.ts` |
| Data fetch — current sprint | Service layer (`jira.ts`) | react-query cache | `fetchMyTasksHierarchy` already implements this |
| Data fetch — all assigned | Service layer (`jira.ts` / `jira/client.ts`) | react-query cache | New `fetchAllAssignedHierarchy` wrapping exported `fetchAllSearchPages` |
| My Day smart sort | Pure function (lib or page component) | — | No I/O; deterministic; unit-testable in isolation |
| Summary strip counts | Derived in component (memo) | — | Computed from loaded dataset; no new API needed |
| Transient filter state | Component `useState` | — | Per D-01: resets on reload; never persisted |
| Grouping/scope persistence | `my-tasks.store.ts` (Zustand + Tauri Store) | — | Per D-10; pattern from `pinned-tabs.store.ts` |
| Status transition | `StatusPopover` (existing) | GH transitions cache | Requires `projectId`, `issueTypeId`, `currentStatusId` from issue fields |
| Log Work | `LogWorkPopover` (existing) | — | Context menu trigger only; no new logic |
| Peek navigation | `PeekPanel` (existing) | — | Row body click; already established pattern |

---

## Standard Stack

No new packages required. All dependencies are already installed.

### Core (existing, reused)

| Library | Purpose | Source |
|---------|---------|--------|
| `@tanstack/react-query` | Data fetching, caching, stale-while-revalidate | Already used throughout |
| `zustand` + `zustand/middleware` (`persist`) | Store + persistence middleware | Already used in `stores/*.store.ts` |
| `@tauri-apps/plugin-store` (`LazyStore`) | Tauri-native JSON persistence backend | Already used via `createTauriStorage` |
| `react-router-dom` | Route registration, `NavLink` | Already used in `routes.tsx` |
| shadcn `Tabs` (`components/ui/tabs.tsx`) | Grouping mode tabs | Already installed |
| `lucide-react` | Icons (e.g. `CheckSquare` for My Tasks icon) | Already used |

### No New Packages

The Package Legitimacy Audit section is omitted — this phase installs zero external packages. All required primitives (`context-menu`, `progress`, `badge`, `skeleton`, `popover`, `tabs`) are already present in `taskflow/src/components/ui/`.

---

## Architecture Patterns

### System Architecture Diagram

```
User opens /my-tasks
        │
        ▼
MyTasksPage (routes/my-tasks/MyTasksPage.tsx)
  ├─ reads my-tasks.store (groupingMode, scope)
  ├─ fires useQuery for data:
  │    ├─ scope=CurrentSprint  → fetchMyTasksHierarchy(...)
  │    │    returns { issues: JiraIssue[], myIssueKeys: Set<string> }
  │    └─ scope=AllAssigned    → fetchAllAssignedHierarchy(...)
  │         wraps fetchAllSearchPages (jira/client.ts) — fully paginated
  │
  ├─ Summary/Filter Strip
  │    derives counts from issues array (useMemo)
  │    transient filter = useState (not persisted)
  │
  ├─ Grouping Tabs (Tabs component)
  │    ├─ My Day  → groupByMyDay(issues) → sorted bands
  │    ├─ By Status → groupByStatus(issues)
  │    └─ By Sprint & Parent → groupBySprintAndParent(issues)
  │
  └─ Rendered rows (filter applied on top of grouping)
       each group section:
         group header (band label / status name / sprint+parent)
         parent row: MyTaskRow
           └─ subtask rows: MyTaskRow (pl-8 indent)
```

```
MyTaskRow interactions:
  div[role=button] onClick → PeekPanel
  issue-key <button> stopPropagation → navigate /issue/:key
  status pill click → StatusPopover (uses issue.fields.project.id, issuetype.id, status.id)
  right-click → ContextMenu
    ├─ "Log Work" → LogWorkPopover
    ├─ "Copy issue key" → clipboard
    └─ "Copy link" → clipboard
```

### Recommended Project Structure

```
taskflow/src/
├── routes/
│   └── my-tasks/
│       ├── MyTasksPage.tsx       # Page root: strip + tabs + list
│       └── MyTaskRow.tsx         # Adapted BacklogRow (no dnd-kit)
├── stores/
│   └── my-tasks.store.ts         # Zustand + Tauri Store (groupingMode, scope)
├── services/
│   └── jira.ts                   # Add fetchAllAssignedHierarchy; extend fetchMyTasksHierarchy fields
└── lib/
    └── my-tasks-sort.ts          # Pure smart-sort functions (testable in isolation)
```

### Pattern 1: Route Registration (Phase 81 lazy-route pattern)

```typescript
// Source: taskflow/src/routes/routes.tsx — existing withLazy pattern
const MyTasksPage = lazy(() => import('./my-tasks/MyTasksPage'));

// In routes array:
{ path: '/my-tasks', element: withLazy(MyTasksPage) }
```

### Pattern 2: Sidebar Entry

```typescript
// Source: taskflow/src/components/app/sidebar-items.ts
// Add to SIDEBAR_NAV_ITEMS:
{
  id: 'my-tasks',
  label: 'My Tasks',
  path: '/my-tasks',
  iconName: 'CheckSquare',   // ← add CheckSquare to ICON_MAP in Sidebar.tsx
  section: 'main',
}
```

Note: `CheckSquare` must be added to both the `ICON_MAP` in `Sidebar.tsx` and the import block. The ICON_MAP is keyed by string and looked up at render time.

### Pattern 3: Persisted Zustand Store

```typescript
// Source: taskflow/src/stores/pinned-tabs.store.ts (verified pattern)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

type GroupingMode = 'my-day' | 'by-status' | 'by-sprint-parent';
type Scope = 'current-sprint' | 'all-assigned';

interface MyTasksState {
  groupingMode: GroupingMode;
  scope: Scope;
  setGroupingMode: (mode: GroupingMode) => void;
  setScope: (scope: Scope) => void;
}

export const useMyTasksStore = create<MyTasksState>()(
  persist(
    (set) => ({
      groupingMode: 'my-day',  // D-09 default
      scope: 'current-sprint', // D-09 default
      setGroupingMode: (mode) => set({ groupingMode: mode }),
      setScope: (scope) => set({ scope }),
    }),
    {
      name: 'my-tasks-store',
      storage: createTauriStorage('my-tasks.json'),
      version: 0,
      migrate: (persisted, _version) => persisted as MyTasksState,
    },
  ),
);
```

Test: mock `@tauri-apps/plugin-store` (same global mock in `src/test/setup.ts`); use `useMyTasksStore.setState({...})` in `beforeEach`.

### Pattern 4: react-query for fetchMyTasksHierarchy (from SubtasksPanel.tsx)

```typescript
// Source: taskflow/src/routes/dashboard/SubtasksPanel.tsx (verified usage)
const { data: taskData, isLoading } = useQuery({
  queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchMyTasksHierarchy(jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
});
// taskData?.issues: JiraIssue[]
// taskData?.myIssueKeys: Set<string>
```

For All-Assigned scope, a new query key such as `['jira-issues', 'my-tasks-all', activeJiraProject]` avoids colliding with the sprint-scope cache.

### Pattern 5: StatusPopover — Required Props from JiraIssue

`StatusPopover` requires:
- `projectId: number` → `parseInt(issue.fields.project?.id ?? '0')`
- `issueTypeId: string` → `issue.fields.issuetype.id ?? ''`
- `currentStatusId: string` → `issue.fields.status.id`
- `currentStatus: string` → `issue.fields.status.name`

Both `project` and `issuetype.id` are included in `fetchMyTasksHierarchy`'s `fields` query string (verified: `fields = '...issuetype,project,...'`). No additional fields needed.

### Anti-Patterns to Avoid

- **Single-page-capped call for All Assigned:** Never call `fetch(...&maxResults=50)` without looping. Always use `fetchAllSearchPages` from `jira/client.ts` or the private equivalent in `jira.ts`. The unit test (criterion 6) will catch this.
- **Client-side filtering as a substitute for server-side pagination:** Fetching one page and slicing to 50 results. The recurring `project_fetch_once_pagecap_pitfall` memory documents this exact failure mode.
- **Nested `<button>` inside `<button>`:** Row body is `div[role=button]`; issue key is a sibling `<button>` with `stopPropagation`. Do not nest a `<button>` inside the outer `<button>`. See `project_overlay_button_nested_interactive` memory.
- **Bare `<span>` for status pill:** `statusPillClass()` returns layout + color; wrap in a `flex div` — see `project_statuspill_needs_flex_parent` memory.
- **Icon/priority columns without explicit px size:** Use `style={{ width: 18, height: 18 }}` on icon wrapper spans. Tailwind class sizes collapse to 0 in WebKit/Tauri virtualized table rows — see `project_virtualized_table_zero_width_col` memory.
- **Evaluating parent band from parent-only status:** D-04 requires evaluating the whole subtree (parent + all its subtasks). The sort key is `min(bandIndex of parent, min(bandIndex of each subtask))`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side Jira pagination | Custom while-loop | `fetchAllSearchPages` (jira/client.ts) | Already tested, handles partial page, ApiError for auth failures |
| Status badge styling | Local constant map | `statusPillClass()` from `lib/statusStyles.ts` | Single source of truth; matches sprint board reference |
| Overdue detection | Custom date comparison | `OverdueBadge` from `routes/dashboard/issue-detail/OverdueBadge.tsx` | Handles null duedate, excludes done issues |
| Issue type icon | Custom icon map | `IssueTypeIcon` from `components/ui/issue-type-icon.tsx` | Already handles all Jira issue type names |
| Priority icon | Custom priority display | `PriorityIcon` from `components/ui/priority-icon.tsx` | Handles null/empty iconUrl |
| Tauri JSON persistence | Direct LazyStore calls | `createTauriStorage('my-tasks.json')` via `persist` middleware | Handles async get/set/save, race conditions |
| Flagged state detection | `issue.fields[key]?.length > 0` inline | `isIssueFlagged(issue, flaggedFieldKey)` from `services/jira.ts` | Correct duck-typing (null vs [] vs [{value}]) |

**Key insight:** This phase is almost entirely composition. The only genuinely new logic is the My Day smart-sort pure function and the `fetchAllAssignedHierarchy` service call.

---

## Critical Gap: fetchMyTasksHierarchy Fields

**[VERIFIED: source code read]** The current `fetchMyTasksHierarchy` at `jira.ts:495` builds:
```
fields = 'summary,status,assignee,issuetype,project,customfield_10016,customfield_10028,<storyPointsFieldKey>,parent,subtasks,timetracking,duedate'
subtaskFields = 'summary,status,assignee,issuetype,project,parent,timetracking'
```

**Two gaps that block My Day band classification:**

1. **Flagged field missing from both `fields` and `subtaskFields`:** `isIssueFlagged` reads `issue.fields[flaggedFieldKey]` (default `customfield_10021`). If this field is not in the JQL `fields=` list, Jira omits it from the response. The "flagged/blocked" band (D-04) silently fails — all issues appear unflagged.

2. **`duedate` missing from `subtaskFields`:** The overdue band classification for subtasks requires `duedate`. Currently subtasks have `duedate` absent, so a subtask that is overdue would not pull its parent into the overdue band.

**Required fix:** `fetchMyTasksHierarchy` must accept `flaggedFieldKey` as a parameter and append it (plus `duedate`) to both `fields` and `subtaskFields`. This is a non-breaking change (new parameter with default). The All-Assigned fetch must apply the same field list.

---

## My Day Smart-Sort Algorithm (D-04)

This is the highest-risk piece in the phase. Here is a concrete, testable algorithm.

### Band Enumeration

```typescript
// Source: lib/my-tasks-sort.ts (new file)
// Lower index = higher attention
export const MY_DAY_BANDS = [
  'flagged-blocked',   // 0 — flagged OR status name contains "blocked" (case-insensitive)
  'overdue',           // 1 — duedate < today AND statusCategory !== 'done'
  'in-review-my-mr',   // 2 — status name contains "review" AND issue has my linked open MR
  'in-progress',       // 3 — statusCategory === 'indeterminate' (not review)
  'to-do',             // 4 — statusCategory === 'new'
  'done',              // 5 — statusCategory === 'done'
] as const;

export type MyDayBand = typeof MY_DAY_BANDS[number];
```

### Band Classification of a Single Issue

```typescript
export function classifyBand(
  issue: JiraIssue,
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,   // issue keys that have an open MR authored by me
  today: Date = new Date(),
): number {
  const category = issue.fields.status.statusCategory?.key;
  
  // Band 5: done
  if (category === 'done') return 5;
  
  // Band 0: flagged or blocked
  const flagged = isIssueFlagged(issue, flaggedFieldKey);
  const statusName = issue.fields.status.name.toLowerCase();
  if (flagged || statusName.includes('block')) return 0;
  
  // Band 1: overdue (duedate in past, not done)
  const duedate = issue.fields.duedate as string | null | undefined;
  if (duedate) {
    const due = new Date(duedate);
    due.setHours(23, 59, 59, 999);
    if (due < today) return 1;
  }
  
  // Band 2: in-review with my MR
  if (statusName.includes('review') && myOpenMRIssueKeys.has(issue.key)) return 2;
  
  // Band 3: in-progress (indeterminate but not review above)
  if (category === 'indeterminate') return 3;
  
  // Band 4: to-do (new)
  return 4;
}
```

### Subtree Sort Key for a Parent

```typescript
export function subtreeBand(
  parent: JiraIssue,
  subtasks: JiraIssue[],
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): number {
  const parentBand = classifyBand(parent, flaggedFieldKey, myOpenMRIssueKeys, today);
  const subtaskBands = subtasks.map((s) =>
    classifyBand(s, flaggedFieldKey, myOpenMRIssueKeys, today)
  );
  // A parent floats to the rank of its most-urgent child (lowest band index = most urgent)
  return Math.min(parentBand, ...subtaskBands, 5);
}
```

### Grouping by My Day

```typescript
export function groupByMyDay(
  issues: JiraIssue[],
  myIssueKeys: Set<string>,
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): Array<{ band: MyDayBand; parents: Array<{ parent: JiraIssue; subtasks: JiraIssue[] }> }> {
  // Separate parents from subtasks
  const subtasksByParent = new Map<string, JiraIssue[]>();
  const parents: JiraIssue[] = [];
  for (const issue of issues) {
    if (issue.fields.issuetype.subtask) {
      const parentKey = issue.fields.parent?.key;
      if (parentKey) {
        const arr = subtasksByParent.get(parentKey) ?? [];
        arr.push(issue);
        subtasksByParent.set(parentKey, arr);
      }
    } else {
      // Only show parents that are mine OR have at least one subtask that is mine
      const mySubtasks = (subtasksByParent.get(issue.key) ?? []).filter((s) =>
        myIssueKeys.has(s.key)
      );
      if (myIssueKeys.has(issue.key) || mySubtasks.length > 0) {
        parents.push(issue);
      }
    }
  }

  // Assign each parent to a band using subtree evaluation
  const bandedParents = parents.map((parent) => {
    const subtasks = subtasksByParent.get(parent.key) ?? [];
    const bandIndex = subtreeBand(parent, subtasks, flaggedFieldKey, myOpenMRIssueKeys, today);
    return { parent, subtasks, bandIndex };
  });

  // Sort within bands (stable sort — keep server rank order)
  bandedParents.sort((a, b) => a.bandIndex - b.bandIndex);

  // Group consecutive entries by band
  const result: Array<{ band: MyDayBand; parents: Array<{ parent: JiraIssue; subtasks: JiraIssue[] }> }> = [];
  for (const bp of bandedParents) {
    const band = MY_DAY_BANDS[bp.bandIndex];
    const last = result[result.length - 1];
    if (last && last.band === band) {
      last.parents.push({ parent: bp.parent, subtasks: bp.subtasks });
    } else {
      result.push({ band, parents: [{ parent: bp.parent, subtasks: bp.subtasks }] });
    }
  }
  return result;
}
```

**What `myOpenMRIssueKeys` contains:** A `Set<string>` of Jira issue keys linked to the current user's open MRs. Derived from `fetchAuthoredMRs` (exists in `gitlab.ts`) + `linkMRToTask` (exists in `linkEngine.ts`). This Set is computed once when the page loads (a separate `useQuery` or derived from an existing cache entry). If GitLab is not configured, the Set is empty — band 2 is skipped and those issues fall to band 3 or 4.

---

## fetchAllAssignedHierarchy — Specification

For the All-Assigned scope, no function currently exists. The plan must add one to `jira.ts`.

```typescript
// Add to jira.ts
export async function fetchAllAssignedHierarchy(
  baseUrl: string,
  token: string,
  projectKey: string,
  flaggedFieldKey: string,
  storyPointsFieldKey = 'customfield_10016',
): Promise<{ issues: JiraIssue[]; myIssueKeys: Set<string> }> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const spFields = [...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey])].join(',');
  const sprintField = 'customfield_10020';
  const fields = `summary,status,assignee,issuetype,project,${spFields},parent,subtasks,timetracking,duedate,${flaggedFieldKey},${sprintField}`;
  
  // All stories assigned to me — no sprint filter
  const jql = encodeURIComponent(
    `project = ${projectKey} AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() ORDER BY rank ASC`
  );
  // Uses the exported fetchAllSearchPages from jira/client.ts (fully paginated, no page cap)
  const issues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`,
    headers,
  );
  const myIssueKeys = new Set(issues.map((i) => i.key));
  return { issues, myIssueKeys };
}
```

Note: `fetchAllSearchPages` from `jira/client.ts` is **already exported** and can be imported in `jira.ts` directly, or the existing private copy in `jira.ts` (line 283, identical implementation) can be called. The plan must verify this import path is clean. The returned `issues` array is flat (no subtask nesting at the service layer); grouping logic in the component tree handles the hierarchy.

---

## Progressive Loading Pattern (D-06)

The All-Assigned query can return hundreds of items across multiple pages. The architecture uses a single `useQuery` that resolves when `fetchAllSearchPages` has looped through all pages. The progressive indicator is a UX affordance shown via `isLoading` / `isFetching`:

```typescript
const { data, isLoading, isFetching } = useQuery({
  queryKey: ['jira-issues', 'my-tasks-all', activeJiraProject, storyPointsFieldKey],
  queryFn: () => fetchAllAssignedHierarchy(...),
  staleTime: 30_000,
  enabled: scope === 'all-assigned' && enabled,
  placeholderData: (prev) => prev,  // keeps old data visible while refetching
});

// Loading indicator: show Skeleton rows + "Loading more tasks…" while isFetching
```

The skeleton-based loading indicator (UI-SPEC §Progressive Loading Indicator) renders at the bottom of the list while `isLoading || isFetching` is true. This satisfies D-06's "loading indicator while streaming" requirement without requiring streaming infrastructure.

**Pagination unit test (criterion 6):** The test mocks `fetch` to return `{ total: 250, issues: [50 items] }` on the first call and subsequent calls for pages 2–5, asserting the resolved array has 250 items. This test exercises `fetchAllSearchPages` directly (it is already exported from `jira/client.ts`), so the test lives in `services/jira/client.test.ts` or a new `services/jira/fetchAllAssigned.test.ts`.

---

## Summary Strip — Count Derivation

All six counts derive from the loaded `issues` array using `useMemo`. No additional API calls.

```typescript
const counts = useMemo(() => {
  const today = new Date();
  let toDo = 0, inProgress = 0, inReview = 0, doneSprint = 0, overdue = 0, mrAwaiting = 0;
  for (const issue of issues) {
    const cat = issue.fields.status.statusCategory?.key;
    const name = issue.fields.status.name.toLowerCase();
    if (cat === 'new') toDo++;
    else if (cat === 'indeterminate' && !name.includes('review')) inProgress++;
    else if (cat === 'indeterminate' && name.includes('review')) inReview++;
    else if (cat === 'done') doneSprint++;
    
    const duedate = issue.fields.duedate as string | null | undefined;
    if (duedate && cat !== 'done') {
      const due = new Date(duedate);
      due.setHours(23, 59, 59, 999);
      if (due < today) overdue++;
    }
    
    if (mrAwaitingMeKeys.has(issue.key)) mrAwaiting++;
  }
  return { toDo, inProgress, inReview, doneSprint, overdue, mrAwaiting };
}, [issues, mrAwaitingMeKeys]);
```

"Done this sprint" count: for Current Sprint scope, all done issues are sprint-scoped by `fetchMyTasksHierarchy`'s JQL. For All Assigned scope, only closed-in-current-sprint issues would be needed — but the CONTEXT.md does not restrict "Done this sprint" to All Assigned; the filter strip label simply shows what's done in the loaded dataset.

---

## Common Pitfalls

### Pitfall 1: Single-Page Cap on All Assigned
**What goes wrong:** Calling `fetch(...&maxResults=50)` once and using the results as the full dataset. The summary strip counts are wrong; only 50 issues appear.
**Why it happens:** Developers copy a single-fetch pattern from another part of the codebase.
**How to avoid:** Always use `fetchAllSearchPages`. The unit test (criterion 6) is the enforcement gate — write it first.
**Warning signs:** `data?.length === 50` always; "MRs awaiting me" count is 0 when MRs exist.

### Pitfall 2: Missing Flagged Field in JQL fields=
**What goes wrong:** `isIssueFlagged(issue, flaggedFieldKey)` returns `false` for all issues because `issue.fields[flaggedFieldKey]` is `undefined` (Jira omits fields not in the `fields=` query parameter).
**Why it happens:** `fetchMyTasksHierarchy` was built for another purpose; the flagged field was never needed.
**How to avoid:** The plan must include a task to extend `fetchMyTasksHierarchy` to accept `flaggedFieldKey` and include it in both `fields` and `subtaskFields`. Add a unit test: mock response where `customfield_10021: [{ value: 'Impediment' }]` → `classifyBand` returns 0.
**Warning signs:** My Day "Flagged / Blocked" band is always empty.

### Pitfall 3: Parent-Only Band Evaluation (D-04 violation)
**What goes wrong:** Sorting parents by `classifyBand(parent)` alone, ignoring subtask bands.
**Why it happens:** The "parent floats to its most urgent child" rule is easy to miss.
**How to avoid:** `subtreeBand(parent, subtasks)` must be the sort key. Unit test: parent is "To Do" but has an overdue subtask → `subtreeBand` returns 1 (overdue), parent sorts into Overdue band.
**Warning signs:** A parent with an overdue subtask appears in the "To Do" band.

### Pitfall 4: Status Pill on Bare Span
**What goes wrong:** `statusPillClass()` output on a bare `<span>` collapses because `min-w-[5.5rem]` and `text-center` don't resolve on inline elements.
**Why it happens:** `statusPillClass()` is designed for a `flex` container.
**How to avoid:** Wrap the status pill in a `<div className="flex">` or ensure the cell is already a flex context. See `project_statuspill_needs_flex_parent` memory.
**Warning signs:** Status pill text is left-aligned; pill is narrower than minimum width.

### Pitfall 5: Transient Filter Accidentally Persisted
**What goes wrong:** The active filter is included in `my-tasks.store.ts` or its key appears in the Tauri Store.
**Why it happens:** It's tempting to put all UI state in the store.
**How to avoid:** Per D-01/D-10, only `groupingMode` and `scope` persist. The active filter is `useState` in the page component. Per D-09, it resets on reload.

### Pitfall 6: Icon Column 0-Width Collapse (WebKit/Tauri)
**What goes wrong:** `IssueTypeIcon` and `PriorityIcon` columns collapse to 0px width in the flex-based MyTaskRow on WebKit.
**Why it happens:** Tailwind `w-4 h-4` does not contribute to min-content in some WebKit layouts.
**How to avoid:** Use `style={{ width: 18, height: 18 }}` on the icon wrapper span, matching `BacklogRow.tsx`'s pattern exactly. See `project_virtualized_table_zero_width_col` memory.

---

## Code Examples

### Existing: isIssueFlagged
```typescript
// Source: taskflow/src/services/jira.ts:234
export function isIssueFlagged(issue: JiraIssue, fieldKey: string): boolean {
  const val = issue.fields[fieldKey];
  return Array.isArray(val) && val.length > 0;
}
```

### Existing: statusPillClass
```typescript
// Source: taskflow/src/lib/statusStyles.ts:75
export function statusPillClass(categoryKey: string | undefined): string {
  return `${STATUS_PILL_LAYOUT_CLASS} ${statusCategoryBadgeClass(categoryKey)}`;
}
// STATUS_PILL_LAYOUT_CLASS = 'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium'
```

### Existing: fetchAllSearchPages (jira/client.ts)
```typescript
// Source: taskflow/src/services/jira/client.ts:58
// PAGE_SIZE = 200; loops until startAt >= total
export async function fetchAllSearchPages(
  baseSearchUrl: string,
  headers: Record<string, string>,
): Promise<JiraIssue[]>
```

### Existing: createTauriStorage (tauri-storage.ts)
```typescript
// Source: taskflow/src/lib/tauri-storage.ts:4
export function createTauriStorage(filename: string) // returns ZustandStorage
// Usage: storage: createTauriStorage('my-tasks.json')
```

### Existing: ContextMenu with Log Work wiring pattern
```typescript
// Source: taskflow/src/routes/dashboard/BacklogRow.tsx:321-396
// Wrap row in <ContextMenu><ContextMenuTrigger render={<rowElement />} /><ContextMenuContent>...</ContextMenuContent></ContextMenu>
// LogWorkPopover: <LogWorkPopover issueKey={issue.key} jiraBaseUrl={jiraBaseUrl} />
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Nested `<button>` inside `<button>` for key+body split | `div[role=button]` outer + sibling `<button>` key (PEEK-05 pattern from Phase 77) | Must follow PEEK-05; test with overlay button |
| Inline `fetch` with page cap | `fetchAllSearchPages` fully-paginated loop | Criterion 6 enforces this |
| Per-component status color constants | `statusPillClass()` / `statusCategoryBadgeClass()` from `lib/statusStyles.ts` | All pils must use this helper |
| Re-fetch on every mount | react-query `staleTime: 30_000` | Warm cache from SubtasksPanel re-used |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "In Review" detection via `status.name.toLowerCase().includes('review')` is sufficient for band 2 | Smart-Sort Algorithm | If the project uses a non-standard status name (e.g. "Code Review", "Review Pending"), this may under-match or not match at all. Low risk for the project's known Jira setup; add a note for the planner to verify the actual review-status names. |
| A2 | `fetchAuthoredMRs` returns enough data to build `myOpenMRIssueKeys` via `linkMRToTask` | Smart-Sort Algorithm | If GitLab is not configured, the Set is empty and band 2 never fires — acceptable fallback per D-07 (MR read, not write, this phase) |
| A3 | The private `fetchAllSearchPages` in `jira.ts` (line 283) and the exported one in `jira/client.ts` (line 58) are functionally identical | fetchAllAssignedHierarchy | If they diverge (e.g. error handling), the All Assigned query may have different behavior. Use the `client.ts` export to be safe. |
| A4 | "Blocked" detection via `status.name.toLowerCase().includes('block')` is sufficient for band 0 alongside flagging | Smart-Sort Algorithm | Projects with "Blocking" status names might false-match. Planner should confirm the project's actual status vocabulary. |

---

## Open Questions

1. **`myOpenMRIssueKeys` derivation — query overhead**
   - What we know: `fetchAuthoredMRs` exists and returns open MRs authored by the current user. `linkMRToTask` can map MR → Jira key. This requires knowing the GitLab userId and having a token.
   - What's unclear: The current user's GitLab userId is stored in `auth.store.ts` (check `gitlabUserId` field). Whether the My Tasks page should fire a separate query for authored MRs or reuse an existing cache.
   - Recommendation: Reuse any existing `['gitlab-authored-mrs', ...]` cache entry if it exists; otherwise fire a separate low-`staleTime` query enabled only when GitLab is configured. If GitLab is not configured, skip band 2 entirely (degrade gracefully).

2. **Subtask duedate in All Assigned scope**
   - What we know: `fetchAllAssignedHierarchy` only fetches parent stories. Subtasks are not separately fetched for All Assigned (unlike `fetchMyTasksHierarchy` which does a four-step process).
   - What's unclear: Whether MYTASK-04 (My Day sort) applies in the All Assigned scope at all — By Status and By Sprint & Parent are the more natural groupings for All Assigned.
   - Recommendation: My Day sort applies to both scopes (nothing in D-04 restricts it to Current Sprint). For All Assigned, the plan should decide whether to fetch subtasks too or accept that the subtree-band evaluation only uses parent data.

3. **Sprint field for By Sprint & Parent in All Assigned scope**
   - What we know: D-05 requires sprint ordering (active first, closed newest-first, Backlog last). Sprint data is in `customfield_10020` on each issue.
   - What's unclear: The sprint field contains an array of sprint objects. The exact shape (from the Jira DC sprint field) needs to be verified against what `fetchAllAssignedHierarchy` returns.
   - Recommendation: Include `customfield_10020` (the `sprintFieldKey`) in the `fields` query for `fetchAllAssignedHierarchy` and derive sprint ordering from `issue.fields[sprintFieldKey]`.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/component changes. No external CLI tools, databases, or services beyond the project's existing Jira + GitLab integration are required. The Tauri + Vite build environment is already confirmed working from prior phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vite.config.ts — `test.environment: 'jsdom'`) |
| Config file | `taskflow/vite.config.ts` (test section) |
| Setup file | `taskflow/src/test/setup.ts` (mocks `@tauri-apps/plugin-store`, `ResizeObserver`) |
| Quick run command | `npm run test -- --run` (from `taskflow/`) |
| Full suite command | `npm run check` (biome + tsc + vitest) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MYTASK-04 | Parent with overdue subtask sorts into Overdue band (not To Do) | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ❌ Wave 0 |
| MYTASK-04 | Parent is Done but subtask is In Progress → parent sorts into In Progress band | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ❌ Wave 0 |
| MYTASK-04 | Flagged parent always in band 0 regardless of subtask bands | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ❌ Wave 0 |
| MYTASK-07 | 250 results returned when total=250 and first page returns 50 (criterion 6) | unit | `npm run test -- --run src/services/jira/client.test.ts` | ❌ Wave 0 (test may exist; new assertion needed) |
| MYTASK-07 | All Assigned query uses `fetchAllSearchPages`, not a single-page call | unit | Same file | ❌ Wave 0 |
| MYTASK-08 | Store persists groupingMode and scope; filter state is NOT persisted | unit | `npm run test -- --run src/stores/my-tasks.store.test.ts` | ❌ Wave 0 |
| MYTASK-08 | Store restores groupingMode='by-status' after setState + re-create | unit | Same file | ❌ Wave 0 |
| MYTASK-02 | Filter strip counts: To Do / In Progress / In Review derive from dataset | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ❌ Wave 0 |
| MYTASK-01 | /my-tasks route renders MyTasksPage without crashing | smoke | `npm run test -- --run src/routes/my-tasks/MyTasksPage.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run src/lib/my-tasks-sort.test.ts src/stores/my-tasks.store.test.ts src/services/jira/client.test.ts` (fast unit tests)
- **Per wave merge:** `npm run test -- --run` (full vitest suite, no type-check)
- **Phase gate:** `npm run check` (biome + tsc + vitest) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/lib/my-tasks-sort.ts` — pure sort/classify functions (enables all MYTASK-04 unit tests)
- [ ] `taskflow/src/lib/my-tasks-sort.test.ts` — covers band classification, subtree-band, D-04 scenarios
- [ ] `taskflow/src/stores/my-tasks.store.test.ts` — covers MYTASK-08 (persist, restore, filter NOT persisted)
- [ ] Pagination assertion in `src/services/jira/client.test.ts` — covers criterion 6 (may need to add test, file may already exist)
- [ ] `taskflow/src/routes/my-tasks/MyTasksPage.test.tsx` — smoke render test

*(Existing test infrastructure — `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, global `@tauri-apps/plugin-store` mock — covers all these; no framework install needed)*

---

## Security Domain

This phase has no new authentication, session, or access-control surfaces. It reads Jira data using the existing Bearer PAT and GitLab PAT already in Tauri Stronghold. The `LogWorkPopover` uses `createWorklog` which is already implemented and tested. No new network endpoints, no new secret handling.

Applicable ASVS category for this phase:
- **V5 Input Validation:** Issue key copied to clipboard — no user-submitted content reaches Jira. `LogWorkPopover` already validates duration input with `parseDuration`. No new untrusted input paths.
- All other ASVS categories: not applicable to this phase (no new auth, session, crypto, or file upload).

---

## Sources

### Primary (HIGH confidence — verified by source code read)

- `taskflow/src/services/jira.ts:483-601` — `fetchMyTasksHierarchy` full implementation; return type `{ issues: JiraIssue[], myIssueKeys: Set<string> }`; fields string confirmed
- `taskflow/src/services/jira/client.ts:58-99` — `fetchAllSearchPages` exported function; `PAGE_SIZE = 200`; loop logic verified
- `taskflow/src/services/jira/types.ts:25-68` — `JiraIssue` type; `duedate`, `status.id`, `project.id`, `issuetype.id`, `parent`, `subtasks`, `timetracking` fields confirmed
- `taskflow/src/routes/dashboard/SubtasksPanel.tsx` — react-query usage pattern for `fetchMyTasksHierarchy`; query key `['jira-issues', 'my-tasks', projectKey, spFieldKey]`
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — full row anatomy; icon explicit-px pattern; flagged row colors; ContextMenu pattern
- `taskflow/src/routes/dashboard/TaskCard.tsx` — PEEK-05 `div[role=button]` + inner `<button>` key split
- `taskflow/src/routes/dashboard/StatusPopover.tsx:30-58` — required props: `projectId`, `issueTypeId`, `currentStatusId`, `currentStatus`
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx:26-34` — props: `issueKey`, `jiraBaseUrl`, `onSuccess`
- `taskflow/src/stores/pinned-tabs.store.ts` — persisted Zustand store pattern; `createTauriStorage`; `version` + `migrate`
- `taskflow/src/stores/recent-items.store.ts` — minimal persisted store pattern (no migrate complexity)
- `taskflow/src/lib/tauri-storage.ts` — `createTauriStorage` implementation using `LazyStore`
- `taskflow/src/components/app/sidebar-items.ts` — `SIDEBAR_NAV_ITEMS`; `ICON_MAP` extension required
- `taskflow/src/routes/routes.tsx` — `withLazy` pattern; `React.lazy()` for all route pages
- `taskflow/src/lib/statusStyles.ts` — `statusPillClass()`, `STATUS_PILL_LAYOUT_CLASS`
- `taskflow/src/services/jira.ts:234` — `isIssueFlagged(issue, fieldKey)`
- `taskflow/src/services/linkEngine.ts:16,119` — `ReviewHealth` type; `deriveReviewHealth`; `linkMRToTask`
- `taskflow/src/test/setup.ts` — global `@tauri-apps/plugin-store` LazyStore mock; `ResizeObserver` mock
- `taskflow/vite.config.ts` — vitest config: `environment: 'jsdom'`, `setupFiles`, `globals: true`
- `.planning/config.json` — `workflow.nyquist_validation: true` (confirmed present, treated as enabled)
- `82-CONTEXT.md` — D-01 through D-11 locked decisions
- `82-UI-SPEC.md` — row anatomy, spacing, color tokens, accessibility notes

### Secondary (MEDIUM confidence — cross-verified)

- `taskflow/src/services/gitlab.ts:376` — `fetchAuthoredMRs(baseUrl, token, userId)` exists and returns open MRs authored by userId
- `taskflow/src/stores/pinned-tabs.store.test.ts` — test pattern: mock LazyStore, `useStore.setState`, `act()`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified present; no new packages
- Architecture: HIGH — all referenced files read and signatures confirmed
- Smart-sort algorithm: HIGH — pure function, testable; gap re: `myOpenMRIssueKeys` derivation is an open question but has a graceful fallback
- Pitfalls: HIGH — all from verified memory entries or directly observed code gaps
- Validation architecture: HIGH — test framework config read; gap list is explicit

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable domain — Zustand, react-query, Tauri Store APIs are stable)
