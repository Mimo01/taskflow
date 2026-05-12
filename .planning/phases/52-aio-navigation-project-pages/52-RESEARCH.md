# Phase 52: AIO Navigation + Project Pages — Research

**Researched:** 2026-05-13
**Domain:** React Router lazy routes, Zustand persist migration, Lucide icons, React Query data pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sidebar — "Testing" section**
- D-01: Add `{id: 'testing', label: 'Testing'}` to `SIDEBAR_SECTIONS` after `'tracking'` in `sidebar-items.ts`.
- D-02: Add `{id: 'aio-projects', label: 'AIO Projects', path: '/aio-projects', iconName: 'FlaskConical', section: 'testing'}` to `SIDEBAR_NAV_ITEMS`. Add `FlaskConical` to `ICON_MAP` in `Sidebar.tsx`.
- D-03: Add `aio-projects` to `getDefaultSidebarItems` with `visible: true` for both `'dev'` and `'pm'` presets. Settings store v15 → v16 migration: `if (version < 16) { s.sidebarItems = appendAioItemIfMissing(s.sidebarItems); }`.
- D-04: `Sidebar.tsx` filters Testing section items by `aioEnabled`. When `aioEnabled === false`, the entire Testing section is absent from the DOM. Filter `sectionedItems` to exclude items where `nav.section === 'testing' && !aioEnabled`.

**Project list page (`/aio-projects`)**
- D-05: Calls `fetchAioProjects(baseUrl, token)` — returns `AioProject[]`. No additional API calls.
- D-06: Table layout (same as `EpicsPage`). Columns: project name (clickable row → `/aio-project/:projectKey`) + project key (`font-mono` badge).
- D-07: Skeleton: `AioProjectsSkeleton.tsx` sibling using `<Skeleton>` rows.
- D-08: Empty: `<EmptyState>`. Error: `<ErrorState>` with retry.

**Project overview page (`/aio-project/:projectKey`)**
- D-09: Calls `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle` with pagination loop (same pattern as `fetchAioTestRunsForCycle` in `issue-runs.ts`).
- D-10: Shows cycle name + status only. No pass/fail counts. No N+1 fetches.
- D-11: Table layout. Columns: cycle key (`font-mono`) + cycle name (NavLink) + status badge.
- D-12: Cycle name NavLink → `/aio-cycle/:projectKey/:cycleKey` (404 until Phase 53).
- D-13: Skeleton: `AioCyclesSkeleton.tsx`. Empty + error states same pattern.

**Routing**
- D-14: Flat route convention:
  - `/aio-projects` → `AioProjectsPage` (lazy)
  - `/aio-project/:projectKey` → `AioProjectOverviewPage` (lazy)
  - `/aio-cycle/:projectKey/:cycleKey` → Phase 52 planner decides stub or defer
- D-15: Both pages wrapped in `withLazy()`. Separate lazy imports, separate `ChunkErrorBoundary`.

**AIO cycles service module**
- D-16: Add `src/services/aio/cycles.ts` with `fetchAioCycles(baseUrl, token, projectKey): Promise<AioCycle[]>`. Pagination loop mirrors `issue-runs.ts`. Export from `aio/index.ts` barrel.

### Claude's Discretion

None — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Per-cycle pass/fail counts on overview — Phase 53.
- Cycle detail route stub decision left to Phase 52 planner.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AION-01 | User can access AIO Test Management from a new sidebar section | D-01–D-04 locked; `FlaskConical` icon confirmed in lucide-react |
| AION-02 | User can view a list of all AIO test projects | D-05–D-08 locked; `fetchAioProjects` already built in Phase 51 |
| AION-03 | User can view a project overview page showing all cycles | D-09–D-13 locked; `cycles.ts` service module must be added; `AioCycle` type already exists |
</phase_requirements>

---

## Summary

Phase 52 adds a "Testing" sidebar section gated by `aioEnabled` and two lazy-loaded full-page routes — an AIO Projects list and an AIO Project Overview page listing cycles. All architectural decisions are fully locked in CONTEXT.md, leaving the planner with implementation sequencing rather than design choices.

The codebase was read in full. Every integration point has an exact verified pattern to follow: `EpicsPage.tsx` for page layout, `EpicsSkeleton.tsx` for skeleton components, `issue-runs.ts` for the pagination loop that `cycles.ts` must mirror, and `settings.store.ts` migration guards for the v15→v16 bump. The only net-new code requiring original design work is the `aioCycleStatusBadgeClass` helper in `statusStyles.ts` and the `appendAioItemIfMissing` migration helper.

Test suite is at 929 passing / 1 pre-existing failure (UpdateDialog — unrelated). Phase 52 must add test files for `cycles.ts` (unit) and both page components (rendering). Pattern is well-established: mock `apiFetch`, mock stores, `QueryClientProvider + MemoryRouter` wrapper.

**Primary recommendation:** Implement in this sequence — (1) `cycles.ts` service + tests, (2) `statusStyles.ts` helper, (3) `sidebar-items.ts` + `Sidebar.tsx` + store migration, (4) `AioProjectsPage` + skeleton + test, (5) `AioProjectOverviewPage` + skeleton + test, (6) `routes.tsx` lazy additions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Testing" sidebar section | Frontend (Sidebar.tsx) | Settings store | Nav structure lives in client component; `aioEnabled` gate read from Zustand |
| Sidebar visibility persistence | Settings store (Zustand persist) | — | `sidebarItems` already persisted; migration adds new item |
| Route registration | Frontend router (routes.tsx) | — | React Router flat route array; lazy imports in same file |
| AIO cycles fetch | Service layer (aio/cycles.ts) | API (AIO_API_PATH) | Pure service function, no React; calls `aioFetch` |
| AIO projects list page | Frontend page component | React Query | `fetchAioProjects` already built; page owns loading states |
| AIO project overview page | Frontend page component | React Query | `fetchAioCycles` to be built; page owns loading states |
| Status badge styling | Utility (statusStyles.ts) | — | Follows existing `statusCategoryBadgeClass` pattern |

---

## Standard Stack

All libraries are already installed. No new packages required for this phase.

### Core (already installed)
| Library | Purpose | Why Used |
|---------|---------|---------|
| `react-router-dom` | Routing, `NavLink`, `useParams` | Existing routing solution |
| `@tanstack/react-query` | `useQuery`, `useQueryClient` | Existing data-fetching solution |
| `zustand` (with `persist`) | Settings store | Existing state management |
| `lucide-react` | Icons including `FlaskConical` | Existing icon library per UI-SPEC |

### Supporting (already installed)
| Library | Purpose |
|---------|---------|
| `vitest` + `@testing-library/react` | Unit tests for service + page components |
| `@testing-library/jest-dom` | DOM matchers (configured in `src/test/setup.ts`) |

**No npm installs needed for this phase.** [VERIFIED: codebase grep of package.json, node_modules, vitest.config.ts]

---

## Architecture Patterns

### System Architecture Diagram

```
User hover over sidebar nav item
        │
        ▼
  Sidebar.tsx
  ┌─────────────────────────────────┐
  │ sectionedItems filter           │
  │ • visibleIds (from sidebarItems)│
  │ • aioEnabled gate               │
  │   (section==='testing' →        │
  │    skip if aioEnabled===false)  │
  └────────────┬────────────────────┘
               │ nav link click
               ▼
         React Router
    ┌─────────────────────┐
    │  /aio-projects      │──→ withLazy(AioProjectsPage)
    │  /aio-project/:key  │──→ withLazy(AioProjectOverviewPage)
    └─────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  Page Component      │
    │  useEffect →         │
    │    readSecret(       │
    │      'jira-pat')     │
    │  useAuthStore →      │
    │    jiraBaseUrl       │
    │  useQuery →          │
    │    fetchAioProjects  │  ──→  aio/projects.ts → aioFetch → apiFetch('jira')
    │    fetchAioCycles    │  ──→  aio/cycles.ts  → aioFetch → apiFetch('jira')
    │  useDelayedLoading   │
    └──────────────────────┘
               │
        ┌──────┴───────┐
    skeleton         data table
    (200ms gate)     │
                     ▼
               <table w-full text-sm>
               <thead bg-muted/10>
               <tbody>
                 rows / NavLink → /aio-cycle/:pk/:ck
               </tbody>
```

### Recommended File Layout (new files only)

```
taskflow/src/
├── services/aio/
│   └── cycles.ts                          # NEW — fetchAioCycles + pagination loop
├── routes/dashboard/
│   ├── AioProjectsPage.tsx                # NEW — /aio-projects route page
│   ├── AioProjectsSkeleton.tsx            # NEW — 5-row skeleton for projects list
│   ├── AioProjectOverviewPage.tsx         # NEW — /aio-project/:projectKey route page
│   └── AioCyclesSkeleton.tsx             # NEW — 5-row skeleton for cycles list
└── [modified files]
    ├── services/aio/index.ts              # MODIFY — add cycles export
    ├── lib/statusStyles.ts               # MODIFY — add aioCycleStatusBadgeClass
    ├── components/app/sidebar-items.ts   # MODIFY — add Testing section + aio-projects item
    ├── components/app/Sidebar.tsx        # MODIFY — add FlaskConical to ICON_MAP, aioEnabled filter
    ├── stores/settings.store.ts          # MODIFY — version 15→16, migration guard
    └── routes/routes.tsx                 # MODIFY — two new lazy imports + route entries
```

### Pattern 1: cycles.ts service module (mirrors issue-runs.ts exactly)

```typescript
// Source: taskflow/src/services/aio/issue-runs.ts (verified)
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioCycle } from './types';

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
    if (response.status === 401) throw new ApiError('Invalid token or token has expired', 401, 'jira');
    if (response.status === 404) return [];
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}
```

[VERIFIED: pattern matches issue-runs.ts read directly from codebase]

### Pattern 2: AIO page component structure (mirrors EpicsPage.tsx)

```typescript
// Source: taskflow/src/routes/dashboard/EpicsPage.tsx (verified)
export default function AioProjectsPage() {
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat').then(setToken).catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<AioProject[]>({
    queryKey: ['aio', jiraBaseUrl, 'projects'],
    queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
    enabled: !!jiraBaseUrl && !!token,
  });

  const showSkeleton = useDelayedLoading(isLoading);
  // ... skeleton / error / empty / data render
}
```

### Pattern 3: Settings store v16 migration guard

```typescript
// Source: taskflow/src/stores/settings.store.ts migrate() chain (verified)
// Current version: 15. Phase 52 bumps to 16.

// Helper (add near top of file or inline):
function appendAioItemIfMissing(items: SidebarItem[]): SidebarItem[] {
  if (items.some((i) => i.id === 'aio-projects')) return items;
  return [...items, { id: 'aio-projects', visible: true }];
}

// In migrate():
if (version < 16) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = appendAioItemIfMissing(s.sidebarItems as SidebarItem[]);
  }
}
// Also bump: version: 16 in persist() options
```

### Pattern 4: Sidebar aioEnabled gate (filter in sectionedItems)

```typescript
// Source: taskflow/src/components/app/Sidebar.tsx sectionedItems derivation (verified)
// Current code:
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter((nav) => nav.section === section.id && visibleIds.has(nav.id)),
})).filter((section) => section.items.length > 0);

// Phase 52 change — add aioEnabled from useSettingsStore:
const { devToolsEnabled, sidebarItems, aioEnabled } = useSettingsStore();
// ...
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

### Pattern 5: aioCycleStatusBadgeClass (extends statusStyles.ts)

```typescript
// Source: taskflow/src/lib/statusStyles.ts (verified)
// Existing function uses a lookup map with fallback. Same pattern for AIO:

const AIO_CYCLE_BADGE_STYLES: Record<string, string> = {
  Active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Closed: 'bg-muted text-muted-foreground',
};

export function aioCycleStatusBadgeClass(status: string): string {
  return AIO_CYCLE_BADGE_STYLES[status] ?? 'bg-muted text-muted-foreground';
}
```

[VERIFIED: matches pattern from UI-SPEC.md and existing statusStyles.ts]

### Pattern 6: Lazy route registration (mirrors existing routes.tsx)

```typescript
// Source: taskflow/src/routes/routes.tsx (verified)
const AioProjectsPage = lazy(() => import('./dashboard/AioProjectsPage'));
const AioProjectOverviewPage = lazy(() => import('./dashboard/AioProjectOverviewPage'));

// In routes array:
{ path: '/aio-projects', element: withLazy(AioProjectsPage) },
{ path: '/aio-project/:projectKey', element: withLazy(AioProjectOverviewPage) },
```

### Pattern 7: Skeleton component (mirrors EpicsSkeleton.tsx)

```typescript
// Source: taskflow/src/routes/dashboard/EpicsSkeleton.tsx (verified)
// EpicsSkeleton wraps 5 rows in a p-4 container. Note: EpicsSkeleton.tsx adds p-4
// internally; EpicsPage.tsx ALSO wraps it in <div className="p-4">. The AIO
// skeleton components should NOT add their own p-4 — the page wrapper handles it,
// matching the existing page → skeleton nesting pattern.
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

**CAUTION — EpicsSkeleton double-padding:** `EpicsSkeleton` adds `p-4` internally AND `EpicsPage` wraps it in `<div className="p-4">` — resulting in `p-8` effective padding. The AIO skeleton components should NOT replicate this double-padding. Each AIO page wraps the skeleton in `<div className="p-4">` and the skeleton component itself has no padding, matching the UI-SPEC intent.

### Anti-Patterns to Avoid

- **Double `p-4` on skeleton**: Do not add `p-4` inside skeleton components if the page wrapper already applies `p-4`. Check the exact nesting from EpicsPage — it has `<div className="p-4"><EpicsSkeleton /></div>` and `EpicsSkeleton` internally also has `p-4`. Replicate the page-level-only pattern for AIO (skeleton has no internal padding).
- **Full-row NavLink on cycles page**: The overview page uses `<NavLink>` on the Name cell only — NOT a full-row click. This is intentional because the cycle detail route doesn't exist in Phase 52.
- **aioEnabled check inside the page components**: The `aioEnabled` gate belongs in `Sidebar.tsx` (navigation visibility). The pages themselves do NOT need to check `aioEnabled` — if the user navigates directly to `/aio-projects`, it should work regardless.
- **Hardcoding query stale time**: Use `useQuery` defaults (no explicit `staleTime`). AIO data is no more volatile than Jira data; no special staleness handling needed.
- **Forgetting to export from barrel**: `cycles.ts` must be added to `aio/index.ts` barrel. Missing export causes silent import failures in page components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flicker-free skeleton | Custom setTimeout logic | `useDelayedLoading(isLoading)` | Already handles cleanup, 200ms threshold |
| Error display with retry | Custom alert component | `<ErrorState error={e} onRetry={...} viewName="...">` | Handles auth vs. generic errors, consistent UI |
| Empty state | Custom empty message | `<EmptyState icon={...} title="..." subtitle="..." />` | Consistent icon + copy layout |
| Chunk load failure | Raw `<Suspense>` | `withLazy(Component)` from `routes.tsx` | `ChunkErrorBoundary` handles network failures during code split |
| Status badge class derivation | Switch statement | `aioCycleStatusBadgeClass(status)` in `statusStyles.ts` | Centralised, testable, consistent with existing badge pattern |
| Pagination across pages | Manual loop | Same `for(;;)` loop from `issue-runs.ts` | Handles `isLast`, accumulates, guards direct-array fallback |

---

## Common Pitfalls

### Pitfall 1: Settings store version mismatch — `sidebarItems` missing new item
**What goes wrong:** Existing users have a persisted v15 `sidebarItems` array that doesn't include `aio-projects`. The page is rendered but the sidebar item is absent on first launch.
**Why it happens:** Zustand `persist` rehydrates from stored JSON; new fields not in stored data use Zustand initial state, but `sidebarItems` is already present as an array.
**How to avoid:** The `appendAioItemIfMissing` migration guard in `if (version < 16)` appends the item if absent. Must also bump `version: 16` in the `persist()` options object (not just the migrate guard).
**Warning signs:** Item visible in Settings → Sidebar list but absent from sidebar in live app; store version in Tauri Store JSON still reads 15.

### Pitfall 2: Importing `SidebarItem` from wrong location
**What goes wrong:** `settings.store.ts` re-declares `SidebarItem` locally (`export interface SidebarItem`). `sidebar-items.ts` also exports `SidebarItem`. They are identical but distinct types.
**Why it happens:** Historical duplication. The store's `sidebarItems: SidebarItem[]` field uses the store-local type.
**How to avoid:** The migration helper `appendAioItemIfMissing` should type its parameter as `SidebarItem[]` using the store-local import (`import type { SidebarItem } from ...` — or inline the type). Don't cross-import between the two files.

### Pitfall 3: `useParams` returns `projectKey` as `string | undefined`
**What goes wrong:** `AioProjectOverviewPage` uses `useParams<{ projectKey: string }>()` but TypeScript types it as `string | undefined`. Passing `projectKey!` to `fetchAioCycles` without a guard crashes silently.
**Why it happens:** React Router v6 `useParams` types all params as `string | undefined`.
**How to avoid:** Guard with `enabled: !!jiraBaseUrl && !!token && !!projectKey` in `useQuery`. Optionally render a fallback if `projectKey` is missing (though this route only fires when the path matches, so it's a defensive measure).

### Pitfall 4: EpicsSkeleton double-p-4 replication
**What goes wrong:** Copying `EpicsSkeleton` verbatim (which includes `p-4 flex flex-col gap-2`) and then wrapping the skeleton in `<div className="p-4">` produces `p-8` effective padding.
**Why it happens:** `EpicsPage` wraps the skeleton in a `p-4` div, and `EpicsSkeleton` has internal `p-4`. The net is double-padded but not visually obvious during development.
**How to avoid:** AIO skeleton components have no internal `p-4`; the page's `<div className="p-4">` wrapper provides all padding.

### Pitfall 5: FlaskConical not imported in Sidebar.tsx
**What goes wrong:** `ICON_MAP` lookup returns `undefined` for `'FlaskConical'`; the nav item renders with no icon. No TypeScript error because `ICON_MAP` is typed as `Record<string, ComponentType>`.
**Why it happens:** `ICON_MAP` uses a plain object — missing keys return `undefined` silently. The render path `{Icon ? <Icon /> : null}` swallows the missing icon.
**How to avoid:** Add `FlaskConical` to both the lucide-react import and the `ICON_MAP` object in `Sidebar.tsx`. Verify with a test that renders the sidebar with the AIO nav item active.

### Pitfall 6: Query key mismatch between page and invalidation
**What goes wrong:** Projects page uses `['aio', jiraBaseUrl, 'projects']` but a future cache invalidation call uses a different prefix — stale data persists.
**Why it happens:** Query keys must be exact arrays for `invalidateQueries` to match.
**How to avoid:** Use the keys locked in CONTEXT.md verbatim: `['aio', jiraBaseUrl, 'projects']` for AioProjectsPage, `['aio', jiraBaseUrl, 'cycles', projectKey]` for AioProjectOverviewPage. The `onRetry` handler in `<ErrorState>` calls `queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'projects'] })`.

---

## Code Examples

### cycles.ts unit test scaffold (mirrors projects.test.ts exactly)

```typescript
// Source: taskflow/src/services/aio/projects.test.ts (verified pattern)
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../lib/apiFetch';
import { fetchAioCycles } from './cycles';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';

describe('fetchAioCycles', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns AioCycle[] on 200 with paginated wrapper', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        items: [{ key: 'PROJ-CY-2', name: 'Sprint 1', status: 'Active', projectKey: 'PROJ' }],
        startAt: 0, maxResults: 50, isLast: true,
      }),
    } as unknown as Response);
    const result = await fetchAioCycles(BASE, TOKEN, PROJECT_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('PROJ-CY-2');
  });

  it('accumulates across multiple pages', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({
        ok: true, json: async () => ({
          items: [{ key: 'PROJ-CY-1', name: 'Page 1', status: 'Closed', projectKey: 'PROJ' }],
          startAt: 0, maxResults: 1, isLast: false,
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({
          items: [{ key: 'PROJ-CY-2', name: 'Page 2', status: 'Active', projectKey: 'PROJ' }],
          startAt: 1, maxResults: 1, isLast: true,
        }),
      } as unknown as Response);
    const result = await fetchAioCycles(BASE, TOKEN, PROJECT_KEY);
    expect(result).toHaveLength(2);
  });

  it('throws ApiError on 401', async () => { /* same as projects.test.ts */ });
  it('returns [] on 404', async () => { /* same as projects.test.ts */ });
  it('throws "Cannot reach AIO" on network error', async () => { /* same */ });
});
```

### AioProjectsPage unit test scaffold (mirrors EpicsPage.test.tsx)

```typescript
// Source: taskflow/src/routes/dashboard/EpicsPage.test.tsx (verified pattern)
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ /* only fields the page reads */ }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/aio', () => ({ fetchAioProjects: vi.fn() }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('AioProjectsPage', () => {
  it('AION-02: renders project name and key for each project', async () => { /* ... */ });
  it('AION-02: shows empty state when no projects returned', async () => { /* ... */ });
  it('AION-02: shows error state on fetch failure', async () => { /* ... */ });
});
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Settings version 15 (Phase 51) | Version 16 (Phase 52) | Sequential migration chain — add `if (version < 16)` guard |
| No AIO nav item in sidebar | `aio-projects` item in Testing section | Gated by `aioEnabled` |
| No `fetchAioCycles` | `aio/cycles.ts` with pagination loop | Mirrors `issue-runs.ts` exactly |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 52 is pure code changes. No external CLI tools, databases, or services beyond the already-confirmed AIO REST endpoints (confirmed working in Phase 51 probe).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AION-01 | Testing sidebar section appears when aioEnabled=true | unit | `npx vitest run src/components/app/Sidebar.test.tsx` | ❌ Wave 0 |
| AION-01 | Testing sidebar section absent when aioEnabled=false | unit | same | ❌ Wave 0 |
| AION-02 | AioProjectsPage renders project rows | unit | `npx vitest run src/routes/dashboard/AioProjectsPage.test.tsx` | ❌ Wave 0 |
| AION-02 | AioProjectsPage shows empty state on empty list | unit | same | ❌ Wave 0 |
| AION-02 | AioProjectsPage shows error state on fetch failure | unit | same | ❌ Wave 0 |
| AION-03 | AioProjectOverviewPage renders cycle rows | unit | `npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ❌ Wave 0 |
| AION-03 | AioProjectOverviewPage shows empty state | unit | same | ❌ Wave 0 |
| AION-03 | fetchAioCycles pagination loop | unit | `npx vitest run src/services/aio/cycles.test.ts` | ❌ Wave 0 |
| AION-03 | fetchAioCycles 401/404/network error | unit | same | ❌ Wave 0 |
| (all) | Existing 929-test suite still passes | regression | `npx vitest run` | ✅ |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run` (full suite, ~6s — fast enough for per-commit gate)
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/services/aio/cycles.test.ts` — covers fetchAioCycles pagination + error paths
- [ ] `src/routes/dashboard/AioProjectsPage.test.tsx` — covers AION-02 render/empty/error
- [ ] `src/routes/dashboard/AioProjectOverviewPage.test.tsx` — covers AION-03 render/empty/error
- [ ] `src/components/app/Sidebar.test.tsx` — covers AION-01 aioEnabled gate (may already exist — verify)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — auth already handled by Phase 51 (`Bearer jira-pat`) | — |
| V3 Session Management | No — stateless PAT; no session in this phase | — |
| V4 Access Control | No — read-only AIO data; no write actions | — |
| V5 Input Validation | Yes — `projectKey` from URL params passed to fetch | `encodeURIComponent(projectKey)` in `aioFetch` path |
| V6 Cryptography | No — token from Stronghold (Phase 51), unchanged | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL path injection via `:projectKey` param | Tampering | `encodeURIComponent(projectKey)` in cycles.ts (same as issue-runs.ts) |
| Token exposure in error messages | Information Disclosure | `ApiError` never includes token in message (confirmed in existing ApiError class) |

---

## Open Questions

1. **Sidebar.test.tsx — does it exist?**
   - What we know: `Sidebar.tsx` doesn't have a `Sidebar.test.tsx` sibling in the codebase (checked by listing dashboard and component test files).
   - What's unclear: Whether the existing `SidebarItemsList.test.tsx` is sufficient for AION-01, or a separate `Sidebar.test.tsx` needs to be created.
   - Recommendation: Create `Sidebar.test.tsx` testing the `aioEnabled` gate specifically. The existing `SidebarItemsList.test.tsx` tests the Settings UI drag list, not the sidebar navigation rendering.

2. **EpicsSkeleton double-p-4 — intentional or legacy?**
   - What we know: `EpicsSkeleton` has `p-4` internally AND `EpicsPage` wraps it in `<div className="p-4">`, creating 32px effective padding.
   - What's unclear: Whether this was intentional design or accumulated padding from separate refactors.
   - Recommendation: AIO skeleton components should NOT replicate the double-padding. The planner should specify skeleton components with no internal padding, wrapped only by the page's `<div className="p-4">`. This matches the UI-SPEC spacing table (`p-4` skeleton wrapper, `h-10` row height).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `FlaskConical` exists as a named export in the installed version of `lucide-react` | Standard Stack | Icon renders as nothing; easy to fix by choosing another icon |

All other claims were verified directly from the codebase or CONTEXT.md locked decisions.

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `taskflow/src/components/app/sidebar-items.ts` — `SIDEBAR_SECTIONS`, `SIDEBAR_NAV_ITEMS`, `getDefaultSidebarItems` exact structure
- `taskflow/src/components/app/Sidebar.tsx` — `ICON_MAP`, `sectionedItems` derivation, `navLinkClassFn`, `useSettingsStore` destructuring
- `taskflow/src/stores/settings.store.ts` — version 15 confirmed, migrate chain, `aioEnabled` field already present
- `taskflow/src/routes/routes.tsx` — `withLazy()` pattern, all existing lazy imports, flat route array
- `taskflow/src/routes/dashboard/EpicsPage.tsx` — Full page pattern: `readSecret`, `useAuthStore`, `useQuery`, `useDelayedLoading`, skeleton/error/empty/data render
- `taskflow/src/routes/dashboard/EpicsSkeleton.tsx` — Skeleton component with internal `p-4` (pitfall documented)
- `taskflow/src/services/aio/client.ts` — `aioFetch`, `AIO_API_PATH`, `AIO_PROJECTS_API_PATH`
- `taskflow/src/services/aio/types.ts` — `AioCycle`, `AioProject`, `AioPage<T>` field names confirmed
- `taskflow/src/services/aio/issue-runs.ts` — Pagination loop pattern that `cycles.ts` must mirror
- `taskflow/src/services/aio/projects.ts` — `fetchAioProjects` signature for AioProjectsPage
- `taskflow/src/services/aio/projects.test.ts` — Unit test pattern for AIO service modules
- `taskflow/src/services/aio/issue-runs.test.ts` — Pagination test pattern
- `taskflow/src/lib/statusStyles.ts` — `statusCategoryBadgeClass` pattern for `aioCycleStatusBadgeClass`
- `taskflow/src/hooks/useDelayedLoading.ts` — 200ms threshold, exact signature
- `taskflow/src/components/ui/empty-state.tsx` — `EmptyState` props: `icon`, `title`, `subtitle`, `action`
- `taskflow/src/components/ui/error-state.tsx` — `ErrorState` props: `error`, `onRetry`, `viewName`
- `taskflow/src/routes/dashboard/EpicsPage.test.tsx` — Page test pattern: mocks, `makeClient()`, `MemoryRouter`
- `taskflow/src/routes/settings/SidebarItemsList.tsx` — Confirms `SIDEBAR_SECTIONS` used for section grouping
- `taskflow/vitest.config.ts` — jsdom, globals, `src/test/setup.ts` setup file
- `taskflow/src/test/setup.ts` — `@tauri-apps/plugin-store` global mock pattern

### Secondary (HIGH confidence — from CONTEXT.md locked decisions + Phase 51 probe)
- Phase 52 CONTEXT.md D-01 through D-16 — all locked decisions
- Phase 51 CONTEXT.md D-13–D-17 — API paths, auth scheme, `AioCycle` fields, pagination wrapper

### Tertiary
- UI-SPEC.md — spacing, color tokens, table column specs (approved, status: pending final check-off)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified as already installed
- Architecture patterns: HIGH — read from actual source files
- Service layer (cycles.ts): HIGH — pagination loop copied directly from issue-runs.ts
- Test patterns: HIGH — EpicsPage.test.tsx and projects.test.ts read in full
- Pitfalls: HIGH — identified from actual code reading (EpicsSkeleton double-p-4, ICON_MAP silent undefined)
- UI-SPEC alignment: HIGH — UI-SPEC read in full, cross-referenced with EpicsPage.tsx

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (30 days — stable codebase, no fast-moving dependencies)
