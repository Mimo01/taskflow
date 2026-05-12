# Phase 52: AIO Navigation + Project Pages — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 10 (4 new, 6 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `taskflow/src/services/aio/cycles.ts` | service | request-response + pagination | `taskflow/src/services/aio/issue-runs.ts` | exact |
| `taskflow/src/services/aio/index.ts` | config/barrel | — | `taskflow/src/services/aio/index.ts` (self) | n/a (modify) |
| `taskflow/src/components/app/sidebar-items.ts` | config | — | self (modify) | n/a (modify) |
| `taskflow/src/components/app/Sidebar.tsx` | component | event-driven | self (modify) | n/a (modify) |
| `taskflow/src/stores/settings.store.ts` | store | — | self (modify) | n/a (modify) |
| `taskflow/src/routes/routes.tsx` | config/route | — | self (modify) | n/a (modify) |
| `taskflow/src/routes/dashboard/AioProjectsPage.tsx` | component/page | request-response | `taskflow/src/routes/dashboard/EpicsPage.tsx` | exact |
| `taskflow/src/routes/dashboard/AioProjectsSkeleton.tsx` | component | — | `taskflow/src/routes/dashboard/EpicsSkeleton.tsx` | exact |
| `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | component/page | request-response + params | `taskflow/src/routes/dashboard/EpicsPage.tsx` | role-match |
| `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` | component | — | `taskflow/src/routes/dashboard/EpicsSkeleton.tsx` | exact |

---

## Pattern Assignments

### `taskflow/src/services/aio/cycles.ts` (service, pagination)

**Analog:** `taskflow/src/services/aio/issue-runs.ts`

**Imports pattern** (lines 12–14):
```typescript
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioTestRun } from './types';
```
For `cycles.ts`, replace `AioTestRun` with `AioCycle`:
```typescript
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioCycle } from './types';
```

**Core pagination loop pattern** (lines 30–68 of issue-runs.ts — copy structure verbatim):
```typescript
export async function fetchAioCycles(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<AioCycle[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcycle`;
  const allCycles: AioCycle[] = [];
  let startAt = 0;

  for (;;) {
    const path = `${basePath}?startAt=${startAt}`;
    let response: Response;
    try {
      response = await aioFetch(baseUrl, token, path);
    } catch {
      throw new Error(`Cannot reach AIO at ${baseUrl}`);
    }
    if (response.ok) {
      const data = (await response.json()) as AioPage<AioCycle> | AioCycle[];
      if (Array.isArray(data)) return data;
      allCycles.push(...(data.items ?? []));
      if (data.isLast) return allCycles;
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return [];
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}
```

**Key differences from issue-runs.ts:**
- Function signature has 3 params (`baseUrl, token, projectKey`) instead of 4 (no `cycleKey`)
- `basePath` is `/project/{projectKey}/testcycle` (no `/testcycle/{cycleKey}/testrun` suffix)
- Accumulator is `allCycles: AioCycle[]` not `allRuns: AioTestRun[]`
- `aioFetch` is called with 3 args — no 4th `apiPath` arg (uses default `AIO_API_PATH`)

**Error handling pattern** (lines 60–67 of issue-runs.ts):
```typescript
if (response.status === 401) {
  throw new ApiError('Invalid token or token has expired', 401, 'jira');
}
if (response.status === 404) {
  return []; // project not found or no cycles
}
throw new Error(`AIO request failed with status ${response.status}`);
```

---

### `taskflow/src/services/aio/index.ts` (barrel, modify)

**Analog:** current file content (lines 1–11):
```typescript
/**
 * AIO TCMS service submodules barrel export.
 *
 * client.ts is intentionally NOT exported — it is internal to aio/.
 * Domain modules (projects, issue-runs) import aioFetch directly from './client'.
 */

export * from './types';
export * from './projects';
export * from './issue-runs';
```

**Modification:** append one line after `export * from './issue-runs';`:
```typescript
export * from './cycles';
```

---

### `taskflow/src/components/app/sidebar-items.ts` (config, modify)

**Analog:** current file content (lines 24–29 for sections, lines 31–75 for items, lines 81–108 for presets):

**SIDEBAR_SECTIONS addition** — append after `{ id: 'tracking', label: 'Tracking' }` (line 28):
```typescript
export const SIDEBAR_SECTIONS: { id: string; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'planning', label: 'Planning' },
  { id: 'code', label: 'Code' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'testing', label: 'Testing' },   // ADD THIS
];
```

**SIDEBAR_NAV_ITEMS addition** — append after the last `releases` entry (line 73–74):
```typescript
// Testing (AIO)
{
  id: 'aio-projects',
  label: 'AIO Projects',
  path: '/aio-projects',
  iconName: 'FlaskConical',
  section: 'testing',
},
```

**getDefaultSidebarItems presets** — both `devVisible` and `pmVisible` sets (lines 82–99) must include `'aio-projects'`. Pattern from existing sets:
```typescript
const devVisible = new Set([
  'dashboard', 'my-tasks', 'sprint-board', 'backlog', 'epics', 'merge-requests',
  'aio-projects',  // ADD
]);
const pmVisible = new Set([
  'dashboard', 'my-tasks', 'sprint-board', 'backlog', 'epics', 'merge-requests',
  'sprint-progress', 'workload', 'releases',
  'aio-projects',  // ADD
]);
```

---

### `taskflow/src/components/app/Sidebar.tsx` (component, modify)

**Analog:** current file (self)

**ICON_MAP addition** (lines 45–55) — add `FlaskConical` to both the lucide-react import block and the map object:

Import block (lines 10–24) — add `FlaskConical` to the named imports:
```typescript
import {
  BarChart2,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FlaskConical,   // ADD
  GitMerge,
  KanbanSquare,
  LayoutDashboard,
  List,
  Settings,
  Tag,
  Users,
} from 'lucide-react';
```

ICON_MAP object (lines 45–55):
```typescript
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CheckSquare,
  KanbanSquare,
  List,
  BookOpen,
  GitMerge,
  BarChart2,
  Users,
  Tag,
  FlaskConical,   // ADD
};
```

**aioEnabled gate in sectionedItems** (lines 68–69 destructure, lines 269–272 sectionedItems):

Destructure addition — line 68 currently reads:
```typescript
const { devToolsEnabled, sidebarItems } = useSettingsStore();
```
Change to:
```typescript
const { devToolsEnabled, sidebarItems, aioEnabled } = useSettingsStore();
```

sectionedItems filter (lines 269–272) — current pattern:
```typescript
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter((nav) => nav.section === section.id && visibleIds.has(nav.id)),
})).filter((section) => section.items.length > 0);
```
New pattern with aioEnabled gate:
```typescript
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter(
    (nav) =>
      nav.section === section.id &&
      visibleIds.has(nav.id) &&
      !(nav.section === 'testing' && !aioEnabled),
  ),
})).filter((section) => section.items.length > 0);
```

---

### `taskflow/src/stores/settings.store.ts` (store, modify)

**Analog:** current file (self)

**Version bump** (line 360): `version: 15` → `version: 16`

**Migration guard addition** — append after the `if (version < 15)` block (lines 428–430), before `return persisted as SettingsState;` (line 431):
```typescript
if (version < 16) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = appendAioItemIfMissing(s.sidebarItems as SidebarItem[]);
  }
}
```

**Helper function** — add near top of file (after imports, before `useSettingsStore`). Uses the store-local `SidebarItem` interface (line 21–24), NOT the one from sidebar-items.ts:
```typescript
function appendAioItemIfMissing(items: SidebarItem[]): SidebarItem[] {
  if (items.some((i) => i.id === 'aio-projects')) return items;
  return [...items, { id: 'aio-projects', visible: true }];
}
```

**Existing migration guard pattern to match** (lines 428–430 for v15):
```typescript
if (version < 15) {
  if (s.aioEnabled === undefined) s.aioEnabled = false;
}
```

---

### `taskflow/src/routes/routes.tsx` (config, modify)

**Analog:** current file (self)

**Lazy imports** (lines 12–20) — add two entries after `MergeRequestDetailPage`:
```typescript
const AioProjectsPage = lazy(() => import('./dashboard/AioProjectsPage'));
const AioProjectOverviewPage = lazy(() => import('./dashboard/AioProjectOverviewPage'));
```

**Route entries** (lines 32–48) — add two flat routes after the `/mr/:projectId/:iid` entry. Pattern from existing flat routes:
```typescript
{ path: '/aio-projects', element: withLazy(AioProjectsPage) },
{ path: '/aio-project/:projectKey', element: withLazy(AioProjectOverviewPage) },
```

**withLazy helper** (lines 22–30) — do not modify:
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

---

### `taskflow/src/routes/dashboard/AioProjectsPage.tsx` (page component, request-response)

**Analog:** `taskflow/src/routes/dashboard/EpicsPage.tsx`

**Imports pattern** (lines 8–27 of EpicsPage.tsx) — adapted for AIO Projects:
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchAioProjects } from '@/services/aio';
import type { AioProject } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { AioProjectsSkeleton } from './AioProjectsSkeleton';
```

**Core data-fetching pattern** (lines 94–129 of EpicsPage.tsx) — adapted:
```typescript
export default function AioProjectsPage() {
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery<AioProject[]>({
    queryKey: ['aio', jiraBaseUrl, 'projects'],
    queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
    enabled: !!jiraBaseUrl && !!token,
  });

  const showSkeleton = useDelayedLoading(isLoading);
```

**Render pattern — skeleton/error/empty/data** (lines 139–229 of EpicsPage.tsx) — adapted:
```tsx
return (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
      <h1 className="text-xl font-semibold">AIO Projects</h1>
    </div>
    <div className="flex-1 overflow-auto">
      {isError && !data && (
        <div className="p-4">
          <ErrorState
            error={error}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'projects'] })}
            viewName="AIO projects"
          />
        </div>
      )}
      {showSkeleton ? (
        <div className="p-4">
          <AioProjectsSkeleton />
        </div>
      ) : !isError ? (
        <>
          {(data ?? []).length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                  <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Key</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/aio-project/${project.projectKey}`)}
                  >
                    <td className="px-4 py-3">{project.name}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{project.projectKey}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {data !== undefined && data.length === 0 && (
            <EmptyState
              icon={FlaskConical}
              title="No AIO test projects found"
              subtitle="AIO projects will appear once AIO Test Management is configured"
            />
          )}
        </>
      ) : null}
    </div>
  </div>
);
```

**Note:** AioProjectsPage does NOT use `useOutletContext` (no outlet needed) and does NOT need `StaleDataBanner` — simpler than EpicsPage. No create dialog. Use `useNavigate` + `onClick` for row navigation (D-06 says clickable row → `/aio-project/:projectKey`).

---

### `taskflow/src/routes/dashboard/AioProjectsSkeleton.tsx` (component)

**Analog:** `taskflow/src/routes/dashboard/EpicsSkeleton.tsx`

**EpicsSkeleton exact content** (lines 1–11):
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function EpicsSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

**CRITICAL DEVIATION — no internal `p-4`:** EpicsSkeleton has `p-4` internally AND EpicsPage wraps it in `<div className="p-4">`, causing double padding. AioProjectsSkeleton must NOT replicate this. The page wrapper (`<div className="p-4">`) provides all padding:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function AioProjectsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

---

### `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (page component, request-response + URL params)

**Analog:** `taskflow/src/routes/dashboard/EpicsPage.tsx` (role-match)

**Imports pattern** — adapted for cycles with `useParams`:
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchAioCycles } from '@/services/aio';
import type { AioCycle } from '@/services/aio';
import { aioCycleStatusBadgeClass } from '@/lib/statusStyles';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { AioCyclesSkeleton } from './AioCyclesSkeleton';
```

**useParams guard pattern** (addresses Pitfall 3 from RESEARCH.md):
```typescript
export default function AioProjectOverviewPage() {
  const { projectKey } = useParams<{ projectKey: string }>();
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<AioCycle[]>({
    queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
    queryFn: () => fetchAioCycles(jiraBaseUrl!, token!, projectKey!),
    enabled: !!jiraBaseUrl && !!token && !!projectKey,
  });

  const showSkeleton = useDelayedLoading(isLoading);
```

**Table render pattern — cycle columns per D-11:**
```tsx
<table className="w-full text-sm">
  <thead className="border-b bg-muted/10">
    <tr>
      <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Key</th>
      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
    </tr>
  </thead>
  <tbody>
    {(data ?? []).map((cycle) => (
      <tr key={cycle.key} className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{cycle.key}</td>
        <td className="px-4 py-3">
          {/* D-12: NavLink on Name cell only — NOT full-row click */}
          <NavLink
            to={`/aio-cycle/${projectKey}/${cycle.key}`}
            className="hover:underline"
          >
            {cycle.name}
          </NavLink>
        </td>
        <td className="px-3 py-3">
          <span
            className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioCycleStatusBadgeClass(cycle.status)}`}
          >
            {cycle.status}
          </span>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Note on full-row NavLink:** D-12 specifies NavLink on Name cell only. The cycle detail route (`/aio-cycle/:projectKey/:cycleKey`) does not exist in Phase 52 — using NavLink instead of `onClick` + `navigate` is intentional so the link renders but 404s until Phase 53.

---

### `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` (component)

**Analog:** `taskflow/src/routes/dashboard/EpicsSkeleton.tsx`

Same as `AioProjectsSkeleton` — no internal `p-4`, same 5-row pattern:
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function AioCyclesSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

---

## Shared Patterns

### Authentication / Secret Loading
**Source:** `taskflow/src/routes/dashboard/EpicsPage.tsx` lines 97–102
**Apply to:** `AioProjectsPage.tsx`, `AioProjectOverviewPage.tsx`
```typescript
const [token, setToken] = useState<string | null>(null);
useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, []);
```

### Delayed Loading / Skeleton Gate
**Source:** `taskflow/src/routes/dashboard/EpicsPage.tsx` line 128
**Apply to:** `AioProjectsPage.tsx`, `AioProjectOverviewPage.tsx`
```typescript
const showSkeleton = useDelayedLoading(isLoading);
// Usage: {showSkeleton ? <div className="p-4"><SkeletonComponent /></div> : ...}
```

### Error State with Retry
**Source:** `taskflow/src/routes/dashboard/EpicsPage.tsx` lines 156–166
**Apply to:** `AioProjectsPage.tsx`, `AioProjectOverviewPage.tsx`
```typescript
{isError && !data && (
  <div className="p-4">
    <ErrorState
      error={error}
      onRetry={() => queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, '...'] })}
      viewName="AIO ..."
    />
  </div>
)}
```
Query keys to use verbatim (from CONTEXT.md):
- Projects page: `['aio', jiraBaseUrl, 'projects']`
- Overview page: `['aio', jiraBaseUrl, 'cycles', projectKey]`

### Table Layout
**Source:** `taskflow/src/routes/dashboard/EpicsPage.tsx` lines 189–213
**Apply to:** `AioProjectsPage.tsx`, `AioProjectOverviewPage.tsx`
```tsx
<table className="w-full text-sm">
  <thead className="border-b bg-muted/10">
    <tr>
      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">...</th>
    </tr>
  </thead>
  <tbody>
    {items.map((item) => (
      <tr key={item.key} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
        <td className="px-4 py-3">...</td>
      </tr>
    ))}
  </tbody>
</table>
```

### Status Badge
**Source:** `taskflow/src/lib/statusStyles.ts` lines 10–25
**Apply to:** `AioProjectOverviewPage.tsx`, `taskflow/src/lib/statusStyles.ts` (add new function)

Existing lookup map + fallback pattern to replicate for AIO cycles:
```typescript
const BADGE_STYLES: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  indeterminate: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
};

export function statusCategoryBadgeClass(categoryKey: string | undefined): string {
  return BADGE_STYLES[categoryKey ?? 'new'] ?? BADGE_STYLES.new;
}
```

New function to add to `statusStyles.ts`:
```typescript
const AIO_CYCLE_BADGE_STYLES: Record<string, string> = {
  Active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Closed: 'bg-muted text-muted-foreground',
};

export function aioCycleStatusBadgeClass(status: string): string {
  return AIO_CYCLE_BADGE_STYLES[status] ?? 'bg-muted text-muted-foreground';
}
```

### AIO Service Unit Test Scaffold
**Source:** `taskflow/src/services/aio/projects.test.ts` lines 1–47
**Apply to:** `taskflow/src/services/aio/cycles.test.ts`
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioCycles } from './cycles';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';

describe('fetchAioCycles', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  // Tests: 200 with paginated wrapper, accumulates across pages, 401 ApiError, 404 returns [], network error
});
```

### Page Component Unit Test Scaffold
**Source:** `taskflow/src/routes/dashboard/EpicsPage.test.tsx` lines 1–84
**Apply to:** `AioProjectsPage.test.tsx`, `AioProjectOverviewPage.test.tsx`
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ /* only fields the page reads */ }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/aio', () => ({ fetchAioProjects: vi.fn() }));  // or fetchAioCycles
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
```
For `AioProjectOverviewPage.test.tsx`, use `MemoryRouter initialEntries={['/aio-project/PROJ']}` and a `Route path="/aio-project/:projectKey"` so `useParams` resolves correctly.

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns only.

Note: `taskflow/src/lib/statusStyles.ts` is a modification (adding `aioCycleStatusBadgeClass`) — its own existing pattern is the analog.

---

## Critical Anti-Patterns (from RESEARCH.md — enforce at implementation)

| Risk | What to Avoid | What to Do Instead |
|---|---|---|
| Double `p-4` padding on skeletons | Adding `p-4` inside `AioProjectsSkeleton` / `AioCyclesSkeleton` (as EpicsSkeleton does) | No `p-4` in skeleton — page wrapper provides it |
| Missing `FlaskConical` in ICON_MAP | Only adding to import OR only adding to ICON_MAP | Add to both lucide-react import block AND ICON_MAP object |
| `useParams` null crash | Passing `projectKey!` without guard | `enabled: !!jiraBaseUrl && !!token && !!projectKey` in useQuery |
| Full-row NavLink on cycles table | Wrapping entire `<tr>` in NavLink | NavLink on Name cell only (D-12) |
| Missing barrel export | Forgetting to add `export * from './cycles'` to index.ts | Add as last line of aio/index.ts |
| Store version mismatch | Only adding migration guard without bumping `version: 15` to `version: 16` | Change both: `version:` option AND add `if (version < 16)` guard |
| Wrong SidebarItem type in migration | Cross-importing from sidebar-items.ts into settings.store.ts | Use store-local `SidebarItem` interface (already defined at line 21) |

---

## Metadata

**Analog search scope:** `taskflow/src/services/aio/`, `taskflow/src/routes/dashboard/`, `taskflow/src/components/app/`, `taskflow/src/stores/`, `taskflow/src/routes/`, `taskflow/src/lib/`
**Files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-05-13
