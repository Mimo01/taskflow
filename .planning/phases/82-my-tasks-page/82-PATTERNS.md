# Phase 82: My Tasks Page - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/routes/my-tasks/MyTasksPage.tsx` | page component | request-response (react-query) | `src/routes/dashboard/SubtasksPanel.tsx` | role-match |
| `src/routes/my-tasks/MyTaskRow.tsx` | component | request-response | `src/routes/dashboard/BacklogRow.tsx` | exact |
| `src/lib/my-tasks-sort.ts` | utility (pure fn) | transform | `src/lib/issueDisplayUtils.ts` | role-match |
| `src/lib/my-tasks-sort.test.ts` | test | — | `src/lib/issueDisplayUtils.test.ts` | exact |
| `src/stores/my-tasks.store.ts` | store | — | `src/stores/pinned-tabs.store.ts` | exact |
| `src/stores/my-tasks.store.test.ts` | test | — | `src/stores/pinned-tabs.store.test.ts` | exact |
| `src/services/jira.ts` (modify) | service | CRUD + pagination | `src/services/jira.ts` lines 483–601 | self |
| `src/components/app/sidebar-items.ts` (modify) | config | — | `src/components/app/sidebar-items.ts` | self |
| `src/routes/routes.tsx` (modify) | config (routing) | — | `src/routes/routes.tsx` | self |
| `src/components/app/Sidebar.tsx` (modify) | component | — | `src/components/app/Sidebar.tsx` | self |

---

## Pattern Assignments

### `src/routes/my-tasks/MyTasksPage.tsx` (page component, request-response)

**Analog:** `src/routes/dashboard/SubtasksPanel.tsx`

**Imports pattern** (SubtasksPanel.tsx lines 1–13):
```typescript
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores/settings.store';
import { fetchMyTasksHierarchy } from '@/services/jira';
// Add for MyTasksPage:
import { useAuthStore } from '@/stores/auth.store';
import { readSecret } from '@/services/stronghold';
import { useMyTasksStore } from '@/stores/my-tasks.store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAllAssignedHierarchy, fetchMyTasksHierarchy } from '@/services/jira';
```

**react-query pattern for fetchMyTasksHierarchy** (SubtasksPanel.tsx lines 42–48):
```typescript
const { data: taskData, isLoading } = useQuery({
  queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchMyTasksHierarchy(jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
});
// taskData?.issues: JiraIssue[]   taskData?.myIssueKeys: Set<string>
```

**All-Assigned scope query pattern** (from RESEARCH.md §Progressive Loading Pattern):
```typescript
const { data, isLoading, isFetching } = useQuery({
  queryKey: ['jira-issues', 'my-tasks-all', activeJiraProject, storyPointsFieldKey],
  queryFn: () => fetchAllAssignedHierarchy(jiraBaseUrl, jiraToken, activeJiraProject, flaggedFieldKey, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: scope === 'all-assigned' && !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
  placeholderData: (prev) => prev,  // keeps old data visible while refetching
});
```

**Settings store selectors** (fine-grained — Sidebar.tsx pattern, lines 76–84):
```typescript
// Use fine-grained selectors to avoid re-rendering on unrelated store mutations
const { jiraBaseUrl, activeJiraProject } = useAuthStore();
const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);
```

**Transient filter state** (D-01 — component useState only, never in store):
```typescript
// activeFilter resets on reload — NEVER included in my-tasks.store.ts
const [activeFilter, setActiveFilter] = useState<string | null>(null);
function handleFilterClick(key: string) {
  setActiveFilter((prev) => (prev === key ? null : key));
}
```

---

### `src/routes/my-tasks/MyTaskRow.tsx` (component, request-response)

**Analog:** `src/routes/dashboard/BacklogRow.tsx`

**Imports pattern** (BacklogRow.tsx lines 14–36):
```typescript
import { Flag } from 'lucide-react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { OverdueBadge } from '../dashboard/issue-detail/OverdueBadge';
// Add for MyTaskRow:
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import StatusPopover from '../dashboard/StatusPopover';
import LogWorkPopover from '../dashboard/issue-detail/LogWorkPopover';
```

**Explicit-px icon pattern — MANDATORY for WebKit/Tauri** (BacklogRow.tsx lines 99–107 and 133–145):
```typescript
{/* Issue-type icon — explicit px style prevents 0-width collapse in WebKit */}
<span
  className="flex items-center justify-center"
  style={{ width: 18, height: 18 }}
  aria-hidden={!issue.fields.issuetype}
>
  {issue.fields.issuetype?.name && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
</span>

{/* Priority icon — same explicit-px pattern */}
<span
  className="flex items-center justify-center"
  style={{ width: 18, height: 18 }}
  aria-hidden={!issue.fields.priority}
>
  <PriorityIcon priority={issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined} />
</span>
```

**Issue-key button with stopPropagation — PEEK-05 pattern** (BacklogRow.tsx lines 109–123, TaskCard.tsx lines 153–169):
```typescript
{/* Key cell: PEEK-05 — inner <button> navigates full-page; stopPropagation prevents outer body click */}
<button
  type="button"
  className={cn(
    'font-mono text-xs text-muted-foreground cursor-pointer hover:underline',
    doneSummaryClass(issue.fields.status.statusCategory),
  )}
  onClick={(e) => {
    e.stopPropagation();
    onIssueClick(issue.key);  // navigate to /issue/:key
  }}
>
  {issue.key}
</button>
```

**Flagged row background** (BacklogRow.tsx lines 280–287):
```typescript
const rowClassName = cn(
  'border-b border-border transition-colors cursor-pointer',
  isFlagged
    ? 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40'
    : 'hover:bg-muted/30',
);
```

**Summary cell with flag icon and OverdueBadge** (BacklogRow.tsx lines 147–157):
```typescript
<span className="inline-flex items-center gap-2 text-sm text-left">
  {isFlagged && <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />}
  <span className="truncate">{issue.fields.summary}</span>
  <OverdueBadge
    duedate={(issue.fields.duedate as string | null) ?? null}
    statusCategoryKey={issue.fields.status.statusCategory?.key}
  />
</span>
```

**Story points badge** (BacklogRow.tsx lines 187–198):
```typescript
{storyPoints !== null ? (
  <span className="inline-flex w-7 items-center justify-center rounded border border-border bg-muted px-1 py-0.5 text-xs font-medium text-foreground">
    {storyPoints}
  </span>
) : (
  <span className="inline-flex w-7 items-center justify-center rounded border border-border bg-muted px-1 py-0.5 text-xs font-medium text-muted-foreground">
    ?
  </span>
)}
```

**ContextMenu wrapping the row** (BacklogRow.tsx lines 321–396):
```typescript
<ContextMenu>
  <ContextMenuTrigger
    render={
      <div
        role="button"
        tabIndex={0}
        className={rowClassName}
        onClick={() => onOpenIssue(issue.key)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenIssue(issue.key); }}
      >
        {/* row cells */}
      </div>
    }
  />
  <ContextMenuContent>
    <ContextMenuGroup>
      <ContextMenuLabel>Actions</ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => setLogWorkOpen(true)}>
        Log Work
      </ContextMenuItem>
      <ContextMenuItem onClick={() => navigator.clipboard.writeText(issue.key)}>
        Copy issue key
      </ContextMenuItem>
      <ContextMenuItem onClick={() => navigator.clipboard.writeText(`${jiraBaseUrl}/browse/${issue.key}`)}>
        Copy link
      </ContextMenuItem>
    </ContextMenuGroup>
  </ContextMenuContent>
</ContextMenu>
```

**Status pill — MUST wrap in flex div** (from RESEARCH.md §Pitfall 4 + lib/statusStyles.ts line 75):
```typescript
// statusPillClass() returns layout + color — wrap in flex div, never bare <span>
// STATUS_PILL_LAYOUT_CLASS = 'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium'
<div className="flex">
  <button
    type="button"
    className={statusPillClass(issue.fields.status.statusCategory?.key)}
    onClick={(e) => { e.stopPropagation(); setStatusPopoverOpen(true); }}
  >
    {issue.fields.status.name}
  </button>
</div>
```

**Subtask indent** (D-03 — `pl-8` on nested rows):
```typescript
<div className={cn('flex items-center gap-2', isSubtask && 'pl-8')}>
  {/* same row anatomy */}
</div>
```

**CachedAvatar with explicit size** (BacklogRow.tsx line 203):
```typescript
<CachedAvatar
  url={issue.fields.assignee?.avatarUrls['48x48'] || null}
  name={issue.fields.assignee?.displayName || 'Unassigned'}
  size={24}
/>
```

---

### `src/lib/my-tasks-sort.ts` (utility, transform)

**Analog:** `src/lib/issueDisplayUtils.ts`

**File structure pattern** (issueDisplayUtils.ts lines 1–9):
```typescript
/**
 * my-tasks-sort — Pure sort/classify functions for the My Tasks page My Day view.
 *
 * All functions are side-effect-free and accept `today: Date` for testability.
 * No imports from react, react-query, or any store — pure data transforms.
 */
import type { JiraIssue } from '@/services/jira';
import { isIssueFlagged } from '@/services/jira';
```

**Pure function signature pattern** (issueDisplayUtils.ts lines 14–16, 24–26):
```typescript
// All functions: named exports, pure, no side-effects
export function classifyBand(
  issue: JiraIssue,
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): number { ... }

export function subtreeBand(
  parent: JiraIssue,
  subtasks: JiraIssue[],
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): number { ... }
```

**as const band enum pattern** (from RESEARCH.md §Band Enumeration):
```typescript
export const MY_DAY_BANDS = [
  'flagged-blocked',   // 0
  'overdue',           // 1
  'in-review-my-mr',   // 2
  'in-progress',       // 3
  'to-do',             // 4
  'done',              // 5
] as const;

export type MyDayBand = typeof MY_DAY_BANDS[number];
```

---

### `src/lib/my-tasks-sort.test.ts` (test)

**Analog:** `src/lib/issueDisplayUtils.test.ts`

**Test file pattern** (issueDisplayUtils.test.ts lines 1–5):
```typescript
import { describe, expect, it } from 'vitest';
import { classifyBand, subtreeBand, groupByMyDay, MY_DAY_BANDS } from './my-tasks-sort';
```

**Describe/it structure** (issueDisplayUtils.test.ts lines 5–25):
```typescript
describe('classifyBand', () => {
  it('returns 5 (done) for issue with statusCategory.key === "done"', () => { ... });
  it('returns 0 (flagged-blocked) for flagged issue', () => { ... });
  it('returns 1 (overdue) for past-duedate non-done issue', () => { ... });
});

describe('subtreeBand — D-04 subtree evaluation', () => {
  it('parent To Do + overdue subtask → band 1 (overdue)', () => { ... });
  it('parent Done + In Progress subtask → band 3 (in-progress)', () => { ... });
  it('flagged parent → band 0 regardless of subtask bands', () => { ... });
});
```

**Minimal JiraIssue stub helper** (pattern from issueDisplayUtils.test.ts):
```typescript
// Helper to build minimal JiraIssue stubs for testing
function makeIssue(overrides: {
  key?: string;
  statusCategoryKey?: string;
  statusName?: string;
  duedate?: string | null;
  flaggedFieldKey?: string;
  flaggedValue?: unknown;
  isSubtask?: boolean;
  parentKey?: string;
}): JiraIssue {
  return {
    key: overrides.key ?? 'PROJ-1',
    fields: {
      summary: 'Test issue',
      status: {
        name: overrides.statusName ?? 'To Do',
        id: '1',
        statusCategory: { key: overrides.statusCategoryKey ?? 'new' },
      },
      duedate: overrides.duedate ?? null,
      issuetype: { subtask: overrides.isSubtask ?? false, name: 'Story', id: '10001' },
      parent: overrides.parentKey ? { key: overrides.parentKey } : undefined,
      // flagged field key set dynamically in test
      ...(overrides.flaggedFieldKey
        ? { [overrides.flaggedFieldKey]: overrides.flaggedValue ?? [] }
        : {}),
    },
  } as unknown as JiraIssue;
}
```

---

### `src/stores/my-tasks.store.ts` (store)

**Analog:** `src/stores/pinned-tabs.store.ts`

**Full store pattern** (pinned-tabs.store.ts lines 1–79):
```typescript
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
      groupingMode: 'my-day',   // D-09: default
      scope: 'current-sprint',  // D-09: default
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

Key constraints from pinned-tabs.store.ts pattern:
- `version: 0` (first release — increment only when store shape changes)
- `migrate` is required even at v0 (pinned-tabs.store.ts shows the versioning contract)
- `createTauriStorage(filename)` is the ONLY persistence backend — never call `LazyStore` directly
- Filter state (`activeFilter`) must NOT be in this store (D-01/D-10)

---

### `src/stores/my-tasks.store.test.ts` (test)

**Analog:** `src/stores/pinned-tabs.store.test.ts`

**Mock and import pattern** (pinned-tabs.store.test.ts lines 1–16):
```typescript
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import { useMyTasksStore } from './my-tasks.store';
```

**Reset and mutation pattern** (pinned-tabs.store.test.ts lines 17–30):
```typescript
describe('my-tasks.store', () => {
  beforeEach(() => {
    act(() => {
      useMyTasksStore.setState({ groupingMode: 'my-day', scope: 'current-sprint' });
    });
  });

  it('setGroupingMode updates groupingMode', () => {
    act(() => { useMyTasksStore.getState().setGroupingMode('by-status'); });
    expect(useMyTasksStore.getState().groupingMode).toBe('by-status');
  });

  it('activeFilter is NOT in store (D-01/D-10)', () => {
    // Verify the store has no activeFilter key — it must never be persisted
    expect('activeFilter' in useMyTasksStore.getState()).toBe(false);
  });
});
```

---

### `src/services/jira.ts` (modify — add fetchAllAssignedHierarchy; extend fetchMyTasksHierarchy)

**Analog:** `src/services/jira.ts` lines 483–601 (fetchMyTasksHierarchy itself)

**fetchAllAssignedHierarchy function signature and pattern** (from RESEARCH.md §fetchAllAssignedHierarchy):
```typescript
// Add after fetchMyTasksHierarchy — imports fetchAllSearchPages from jira/client.ts
// The private copy at jira.ts:283 exists but use the exported client.ts version (A3)
import { fetchAllSearchPages } from './jira/client';

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

  const jql = encodeURIComponent(
    `project = ${projectKey} AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() ORDER BY rank ASC`
  );
  const issues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`,
    headers,
  );
  const myIssueKeys = new Set(issues.map((i) => i.key));
  return { issues, myIssueKeys };
}
```

**fetchMyTasksHierarchy fields extension** (jira.ts lines 494–496 — extend these two lines):
```typescript
// BEFORE (lines 495–496):
const fields = `summary,status,assignee,issuetype,project,${spFields},parent,subtasks,timetracking,duedate`;
const subtaskFields = 'summary,status,assignee,issuetype,project,parent,timetracking';

// AFTER — add flaggedFieldKey parameter and append to both field strings:
export async function fetchMyTasksHierarchy(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  flaggedFieldKey = 'customfield_10021',   // new parameter with safe default
): Promise<{ issues: JiraIssue[]; myIssueKeys: Set<string> }> {
  // ...
  const fields = `summary,status,assignee,issuetype,project,${spFields},parent,subtasks,timetracking,duedate,${flaggedFieldKey}`;
  const subtaskFields = `summary,status,assignee,issuetype,project,parent,timetracking,duedate,${flaggedFieldKey}`;
```

---

### `src/components/app/sidebar-items.ts` (modify — add My Tasks entry)

**Analog:** `src/components/app/sidebar-items.ts` (self — existing SIDEBAR_NAV_ITEMS array)

**Entry pattern** (sidebar-items.ts lines 34–60):
```typescript
// Add to SIDEBAR_NAV_ITEMS array, after Dashboard in the 'main' section:
{
  id: 'my-tasks',
  label: 'My Tasks',
  path: '/my-tasks',
  iconName: 'CheckSquare',   // must also be added to ICON_MAP in Sidebar.tsx
  section: 'main',
}
```

---

### `src/routes/routes.tsx` (modify — register /my-tasks route)

**Analog:** `src/routes/routes.tsx` lines 10–22 (existing lazy route declarations)

**lazy() + withLazy pattern** (routes.tsx lines 10–55):
```typescript
// Add alongside other lazy imports at top:
const MyTasksPage = lazy(() => import('./my-tasks/MyTasksPage'));

// Add to routes array:
{ path: '/my-tasks', element: withLazy(MyTasksPage) }
```

`withLazy` is defined at lines 24–32 and wraps in `<ChunkErrorBoundary>` + `<Suspense fallback={<RouteSpinner />}>`. Every page route uses this pattern — never add a route with a direct element (non-lazy) unless it is a trivial redirect or dev-only page.

---

### `src/components/app/Sidebar.tsx` (modify — add CheckSquare to ICON_MAP)

**Analog:** `src/components/app/Sidebar.tsx` lines 10–60

**ICON_MAP extension pattern** (Sidebar.tsx lines 10–60):
```typescript
// Add to import block:
import {
  // ... existing imports ...
  CheckSquare,   // new — for My Tasks sidebar entry
} from 'lucide-react';

// Add to ICON_MAP (lines 47–60):
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  // ... existing entries ...
  CheckSquare,   // new
};
```

The ICON_MAP key must exactly match the `iconName` string in sidebar-items.ts. The map is looked up at render time on line 315: `const Icon = ICON_MAP[nav.iconName]`. Missing key → `Icon` is `undefined` → no icon renders (silent failure).

---

## Shared Patterns

### Authentication + Stronghold token loading
**Source:** `src/components/app/Sidebar.tsx` lines 95–107
**Apply to:** `MyTasksPage.tsx`
```typescript
const { jiraBaseUrl, activeJiraProject } = useAuthStore();
const [jiraToken, setJiraToken] = useState<string | null>(null);
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then(setJiraToken)
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
const enabled = !!jiraBaseUrl && !!activeJiraProject && !!jiraToken;
```

### Settings store fine-grained selectors
**Source:** `src/components/app/Sidebar.tsx` lines 76–84
**Apply to:** `MyTasksPage.tsx`
```typescript
// Fine-grained selectors — avoid re-rendering on unrelated store mutations
const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);
```

### Tauri Store persistence via createTauriStorage
**Source:** `src/stores/pinned-tabs.store.ts` lines 63–78
**Apply to:** `my-tasks.store.ts`
```typescript
{
  name: 'my-tasks-store',
  storage: createTauriStorage('my-tasks.json'),
  version: 0,
  migrate: (persisted, _version) => persisted as MyTasksState,
}
```

### Tauri plugin-store mock in tests
**Source:** `src/stores/pinned-tabs.store.test.ts` lines 3–13
**Apply to:** `my-tasks.store.test.ts`
```typescript
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});
```

### isIssueFlagged helper
**Source:** `src/services/jira.ts` line 234
**Apply to:** `my-tasks-sort.ts` (import + call, do not re-implement)
```typescript
// jira.ts:234
export function isIssueFlagged(issue: JiraIssue, fieldKey: string): boolean {
  const val = issue.fields[fieldKey];
  return Array.isArray(val) && val.length > 0;
}
```

### statusPillClass + flex div wrapper
**Source:** `src/lib/statusStyles.ts` lines 75+
**Apply to:** `MyTaskRow.tsx` status pill cell
```typescript
// Always wrap in flex div — never bare <span>
// STATUS_PILL_LAYOUT_CLASS = 'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium'
<div className="flex">
  <button type="button" className={statusPillClass(issue.fields.status.statusCategory?.key)}>
    {issue.fields.status.name}
  </button>
</div>
```

### fetchAllSearchPages — pagination loop
**Source:** `src/services/jira/client.ts` lines 58–99
**Apply to:** `jira.ts` (fetchAllAssignedHierarchy calls this — do NOT write a new loop)
```typescript
export async function fetchAllSearchPages(
  baseSearchUrl: string,
  headers: Record<string, string>,
): Promise<JiraIssue[]>
// PAGE_SIZE = 200; loops until startAt >= total or issues.length === 0
// Throws ApiError for 401/403 on first page; returns partial on subsequent-page failure
```

---

## No Analog Found

All files have close matches. No gaps.

---

## Metadata

**Analog search scope:** `taskflow/src/stores/`, `taskflow/src/routes/dashboard/`, `taskflow/src/lib/`, `taskflow/src/components/app/`, `taskflow/src/routes/routes.tsx`, `taskflow/src/services/jira.ts`, `taskflow/src/services/jira/client.ts`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-06-14

### Critical Anti-Patterns (from RESEARCH.md — planner must propagate to all plan actions)

| Anti-Pattern | Where It Bites | Enforcement |
|---|---|---|
| Single-page-capped All Assigned call | `fetchAllAssignedHierarchy` | Criterion 6 unit test — write it first |
| `activeFilter` in `my-tasks.store.ts` | Store | D-01/D-10 — filter is `useState` only |
| Parent-only band evaluation (D-04) | `subtreeBand()` | Unit test: overdue subtask → parent in overdue band |
| Status pill on bare `<span>` | `MyTaskRow.tsx` | Wrap in `<div className="flex">` always |
| Tailwind class icon size (WebKit collapse) | `MyTaskRow.tsx` | Use `style={{ width: 18, height: 18 }}` on all icon spans |
| Nested `<button>` inside `<button>` | `MyTaskRow.tsx` | Outer is `div[role=button]`; key is sibling `<button>` |
| Flagged field missing from `fetchMyTasksHierarchy` fields= | `jira.ts` modification | Must add `flaggedFieldKey` param + append to both `fields` and `subtaskFields` |
