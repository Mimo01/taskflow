# Phase 62: Tempo Worklog Viewer UI — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 6 (4 new, 2 modified)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `taskflow/src/routes/worklogs/WorklogsPage.tsx` | page component | request-response (TanStack Query) | `taskflow/src/routes/dashboard/SprintProgressTab.tsx` | exact |
| `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` | test | — | `taskflow/src/components/app/Sidebar.test.tsx` | role-match |
| `taskflow/src/components/app/sidebar-items.ts` | config | — | self (modify) | self |
| `taskflow/src/components/app/Sidebar.tsx` | component | — | self (modify) | self |
| `taskflow/src/components/app/Sidebar.test.tsx` | test | — | self (extend) | self |
| `taskflow/src/routes/routes.tsx` | config/routing | — | self (modify) | self |

---

## Pattern Assignments

### `taskflow/src/routes/worklogs/WorklogsPage.tsx` (page component, request-response)

**Analog:** `taskflow/src/routes/dashboard/SprintProgressTab.tsx`

**Imports pattern** (lines 1–29 of SprintProgressTab.tsx):
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
```
For WorklogsPage, replace `BarChart3` with `Clock`, remove `StaleDataBanner`/`useDelayedLoading`/`useIsActiveRoute`, and add `useMemo`, `useRef`, `Badge` from `@/components/ui/badge`, `Skeleton` from `@/components/ui/skeleton`, and `fetchWorklogs` from `@/services/tempo`.

**Auth token pattern** (SprintProgressTab.tsx lines 43–52):
```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
```
Copy exactly. WorklogsPage uses `jiraBaseUrl` from `useAuthStore()` and `tempoEnabled` from `useSettingsStore((s) => s.tempoEnabled)`.

**TanStack Query pattern** (SprintProgressTab.tsx lines 54–62):
```typescript
const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
  enabled: isActive && !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
  refetchInterval: POLL_INTERVAL_MS,
  refetchIntervalInBackground: false,
  staleTime: STALE_TIME_MS,
});
```
For WorklogsPage, the query key must be `['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? '']`. The `enabled` guard must be `!!jiraBaseUrl && !!jiraToken && tempoEnabled && !!from && !!to`. No polling — omit `refetchInterval`. `queryFn` calls `fetchWorklogs(jiraBaseUrl!, jiraToken!, selectedUsername ? [selectedUsername] : [], from, to)`.

**`formatSeconds` utility** (SprintProgressTab.tsx lines 31–38 — copy verbatim with one change):
```typescript
function formatSeconds(secs: number): string {
  if (secs === 0) return '';   // D-08: blank for zero (SprintProgressTab returns '0h' — change to '' here)
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```
**IMPORTANT:** SprintProgressTab returns `'0h'` for zero (line 32: `if (secs === 0) return '0h'`). WorklogsPage MUST return `''` per D-08. All other branches are identical.

**Error/Empty state pattern** (SprintProgressTab.tsx lines 229–258):
```typescript
{isError && !data && (
  <ErrorState
    error={error}
    onRetry={() => queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })}
    viewName="sprint progress"
  />
)}

{!showSkeleton && !isError && data && data.length === 0 && (
  <EmptyState
    icon={BarChart3}
    title="No sprint data yet"
    subtitle="Sprint progress will appear once a sprint is active"
  />
)}
```
For WorklogsPage: `viewName="worklogs"`, `icon={Clock}`, `title="No worklogs found"`, `subtitle="No hours were logged in the selected date range."` (or with person name when filter active — see UI-SPEC).

**Data table pattern** (SprintProgressTab.tsx lines 316–351):
```typescript
<table className="w-full text-sm" data-testid="assignee-breakdown">
  <thead>
    <tr className="text-xs text-muted-foreground border-b">
      <th className="pb-2 text-left font-normal">Assignee</th>
      <th className="pb-2 text-right font-normal">Stories</th>
      ...
    </tr>
  </thead>
  <tbody>
    {computed.assigneeRows.map(([name, buckets]) => (
      <tr key={name} data-testid="assignee-row" className="hover:bg-muted/50">
        <td className="py-1.5 text-sm">{name}</td>
        ...
      </tr>
    ))}
  </tbody>
</table>
```
WorklogsPage extends this pattern with: sticky `<thead>` (`className="sticky top-0 bg-muted"`), multiple day columns, a `<tfoot>` totals row, and `border border-border` on every cell instead of `border-b` on the header row only. Row hover is `hover:bg-accent/50` (per UI-SPEC) vs SprintProgressTab's `hover:bg-muted/50`.

---

### `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` (test)

**Analog:** `taskflow/src/components/app/Sidebar.test.tsx`

**Test file structure** (Sidebar.test.tsx lines 1–96):
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level variables for mutable mock state (vi.mock is hoisted)
let mockTempoEnabled = true;

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
  }),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/tempo', () => ({
  fetchWorklogs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { tempoEnabled: mockTempoEnabled };
    return selector ? selector(state) : state;
  },
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
```
Follow the module-level mutable variable pattern (`let mockTempoEnabled`) so individual `it()` blocks can flip state before dynamic import of the component.

**Test helper pattern** (Sidebar.test.tsx lines 98–101):
```typescript
function renderSidebar(aioEnabled: boolean, selectedAioProjectKey: string | null = null) {
  mockAioEnabled = aioEnabled;
  mockSelectedAioProjectKey = selectedAioProjectKey;
}
```
For WorklogsPage tests, use a similar `function renderWorklogs(opts)` that sets `mockTempoEnabled` and mock return data before calling `render(...)`.

---

### `taskflow/src/components/app/sidebar-items.ts` (config — modify)

**Self-analog.** Add to `SIDEBAR_NAV_ITEMS` array (after `releases`, before the Testing section — lines 74–75):
```typescript
// Tracking (continued)
{ id: 'worklogs', label: 'Worklogs', path: '/worklogs', iconName: 'Clock', section: 'tracking' },
```

**`getDefaultSidebarItems` pattern** (sidebar-items.ts lines 93–120). Add `'worklogs'` to both `devVisible` and `pmVisible` sets:
```typescript
const devVisible = new Set([
  'dashboard', 'my-tasks', 'sprint-board', 'backlog', 'epics',
  'merge-requests', 'aio-projects',
  'worklogs',  // ADD
]);
const pmVisible = new Set([
  'dashboard', 'my-tasks', 'sprint-board', 'backlog', 'epics',
  'merge-requests', 'sprint-progress', 'releases', 'aio-projects',
  'worklogs',  // ADD
]);
```

---

### `taskflow/src/components/app/Sidebar.tsx` (component — modify)

**Two changes needed:**

**1. Add `Clock` to ICON_MAP** (Sidebar.tsx lines 9–25, 50–61):
```typescript
// Add to lucide-react import block (line ~10):
import {
  BarChart2,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,        // ADD
  FlaskConical,
  ...
} from 'lucide-react';

// Add to ICON_MAP record (line ~61):
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CheckSquare,
  KanbanSquare,
  List,
  BookOpen,
  FlaskConical,
  GitMerge,
  BarChart2,
  Users,
  Tag,
  Clock,        // ADD
};
```

**2. Add `tempoEnabled` selector and gate** (Sidebar.tsx lines 74–91 and 283–291):
```typescript
// Add fine-grained selector (after aioEnabled at line 79 — follow IN-01 comment pattern):
const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);

// Modify sectionedItems filter (lines 283-291):
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter(
    (nav) =>
      nav.section === section.id &&
      visibleIds.has(nav.id) &&
      !(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)) &&
      !(nav.id === 'worklogs' && !tempoEnabled),   // ADD THIS LINE
  ),
})).filter((section) => section.items.length > 0);
```

---

### `taskflow/src/components/app/Sidebar.test.tsx` (test — extend)

**Extend the existing mock state object and add new describe block.**

**Mock state extension** (Sidebar.test.tsx lines 63–92):
```typescript
// Add module-level variable at top (after existing mock variables):
let mockTempoEnabled = false;

// Add to state object in useSettingsStore mock:
const state = {
  devToolsEnabled: false,
  aioEnabled: mockAioEnabled,
  selectedAioProjectKey: mockSelectedAioProjectKey,
  tempoEnabled: mockTempoEnabled,    // ADD
  sidebarItems: [
    ...existing items...,
    { id: 'worklogs', visible: true },   // ADD
  ],
  ...
};
```

**New describe block pattern** — mirror the existing `describe('Sidebar — aioEnabled gate', ...)` block (lines 103–176):
```typescript
describe('Sidebar — tempoEnabled gate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('D-06: shows Worklogs link when tempoEnabled=true', async () => {
    mockTempoEnabled = true;
    const { default: Sidebar } = await import('./Sidebar');
    const { getByText } = render(<QueryClientProvider client={makeClient()}><MemoryRouter><Sidebar /></MemoryRouter></QueryClientProvider>);
    expect(getByText('Worklogs')).toBeDefined();
  });

  it('D-06: hides Worklogs link when tempoEnabled=false', async () => {
    mockTempoEnabled = false;
    const { default: Sidebar } = await import('./Sidebar');
    const { queryByText } = render(<QueryClientProvider client={makeClient()}><MemoryRouter><Sidebar /></MemoryRouter></QueryClientProvider>);
    expect(queryByText('Worklogs')).toBeNull();
  });
});
```
Note: `renderSidebar()` sets `mockAioEnabled` + `mockSelectedAioProjectKey`. Add a parallel setter for `mockTempoEnabled` or inline the assignment before each test.

---

### `taskflow/src/routes/routes.tsx` (routing config — modify)

**Lazy import pattern** (routes.tsx lines 12–22):
```typescript
// Follow this exact pattern for all non-critical routes:
const SprintProgressTab = lazy(() => import('./dashboard/SprintProgressTab'));
const AioProjectOverviewPage = lazy(() => import('./dashboard/AioProjectOverviewPage'));

// Add WorklogsPage alongside these:
const WorklogsPage = lazy(() => import('./worklogs/WorklogsPage'));
```

**Route registration pattern** (routes.tsx lines 41–43):
```typescript
// Follow this pattern (line 42):
{ path: '/sprint-progress', element: withLazy(SprintProgressTab) },

// Add:
{ path: '/worklogs', element: withLazy(WorklogsPage) },
```
Place after `/releases` in the route array to match the sidebar `tracking` section order.

---

## People Filter (SingleFilterCombobox — inline in WorklogsPage)

**Analog:** `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` — `MultiFilterCombobox` (lines 27–101)

**Core combobox mechanics** (BacklogFilterBar.tsx lines 36–59):
```typescript
const [query, setQuery] = useState('');
const [open, setOpen] = useState(false);
const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const filtered = options.filter((o) => !query || o.toLowerCase().includes(query.toLowerCase()));

function handleFocus() {
  if (closeTimer.current) clearTimeout(closeTimer.current);
  setOpen(true);
}

const handleBlur = () => {
  closeTimer.current = setTimeout(() => setOpen(false), 150);
};

function handleSelect(option: string) {
  onToggle(option);
  setQuery('');
}
```
Copy the 150ms blur debounce and `onMouseDown` (not `onClick`) on dropdown items exactly. These prevent the blur from firing before selection completes.

**Input element pattern** (BacklogFilterBar.tsx lines 66–82):
```typescript
<input
  id={id}
  role="combobox"
  aria-label={label}
  aria-autocomplete="list"
  aria-expanded={open}
  value={query}
  placeholder={placeholder}
  onChange={handleChange}
  onFocus={handleFocus}
  onBlur={handleBlur}
  className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-32"
/>
```

**Dropdown list pattern** (BacklogFilterBar.tsx lines 83–100):
```typescript
{open && filtered.length > 0 && (
  <ul className="absolute z-20 mt-1 w-max min-w-full max-h-48 overflow-y-auto rounded border border-border bg-background shadow-md">
    {filtered.map((option) => (
      <li key={option}>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
          onMouseDown={() => handleSelect(option)}  // onMouseDown NOT onClick
        >
          {option}
        </button>
      </li>
    ))}
  </ul>
)}
```
For single-select: remove the `✓` checkmark span from BacklogFilterBar, remove `aria-selected`, and on selection call `setSelectedUsername(username)` + `setSelectedDisplayName(displayName)` instead of toggling a Set.

**Active chip pattern** (BacklogFilterBar.tsx lines 169–185):
```typescript
{Array.from(activeEpics).map((epic) => (
  <Badge key={epic} tone="muted" data-testid={`epic-chip-${epic}`} className="gap-1">
    {epic}
    <button
      type="button"
      aria-label={`Clear epic filter`}
      onClick={() => onEpicsChange(toggle(activeEpics, epic))}
      className="ml-0.5 hover:text-destructive transition-colors"
    >×</button>
  </Badge>
))}
```
For WorklogsPage single-select chip: `aria-label="Remove {selectedDisplayName} filter"` (per UI-SPEC copywriting contract). On click: `setSelectedUsername(null)` + `setSelectedDisplayName(null)`.

---

## Shared Patterns

### Authentication — readSecret in useEffect
**Source:** `taskflow/src/routes/dashboard/SprintProgressTab.tsx` lines 43–52
**Apply to:** `WorklogsPage.tsx`
```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
```

### Fine-Grained Store Selector (IN-01 Pattern)
**Source:** `taskflow/src/components/app/Sidebar.tsx` lines 74–84 (IN-01 comment)
**Apply to:** `Sidebar.tsx` (when adding `tempoEnabled` selector), `WorklogsPage.tsx`
```typescript
// IN-01: fine-grained selectors avoid re-rendering on every unrelated settings-store mutation
const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
```

### TanStack Query with Feature-Gate `enabled`
**Source:** `taskflow/src/routes/dashboard/SprintProgressTab.tsx` lines 54–62
**Apply to:** `WorklogsPage.tsx`
The `enabled` guard pattern: `!!jiraBaseUrl && !!jiraToken && <featureEnabled> && <other conditions>`.

### Sidebar Feature-Gate Filter
**Source:** `taskflow/src/components/app/Sidebar.tsx` lines 283–291
**Apply to:** `Sidebar.tsx` (adding the `tempoEnabled` gate)
```typescript
!(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)) &&
!(nav.id === 'worklogs' && !tempoEnabled)
```
The new condition is ANDed into the existing filter predicate.

### withLazy Route Registration
**Source:** `taskflow/src/routes/routes.tsx` lines 24–32 and 39–54
**Apply to:** `routes.tsx`
```typescript
function withLazy(Component: ComponentType) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        <Component />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
```
`withLazy` is already defined — just add `const WorklogsPage = lazy(...)` and register `{ path: '/worklogs', element: withLazy(WorklogsPage) }`.

### Error + Empty State
**Source:** `taskflow/src/routes/dashboard/SprintProgressTab.tsx` lines 229–258
**Apply to:** `WorklogsPage.tsx`
```typescript
// Error (no cached data):
{isError && !data && <ErrorState error={error} onRetry={refetch} viewName="worklogs" />}
// Empty:
{!isLoading && !isError && data?.length === 0 && (
  <EmptyState icon={Clock} title="No worklogs found" subtitle="..." />
)}
```

### Vitest Mock Structure
**Source:** `taskflow/src/components/app/Sidebar.test.tsx` lines 1–92
**Apply to:** `WorklogsPage.test.tsx`, `Sidebar.test.tsx` (extension)
Module-level mutable variables closed over by hoisted `vi.mock` factories. Use `await import('./ComponentName')` inside each `it()` to pick up the updated mock state.

---

## No Analog Found

All files have a strong analog in the codebase. No files require falling back to RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/components/app/`, `taskflow/src/services/tempo/`, `taskflow/src/routes/routes.tsx`
**Files read:** 10
**Pattern extraction date:** 2026-05-21
