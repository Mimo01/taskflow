# Architecture Research: AIO TCMS Integration

**Domain:** Adding AIO Test Management to existing Tauri 2 / React 18 desktop app (Taskflow v1.8)
**Researched:** 2026-05-12
**Approach:** Exact fit to existing patterns — no new patterns introduced unless strictly required

---

## New Modules / Files

### Service layer — `taskflow/src/services/aio/`

| File | Purpose |
|------|---------|
| `services/aio/client.ts` | Shared AIO fetch helper — mirrors `jira/client.ts`. Wraps `apiFetch` with `source: 'jira'` (AIO runs on the same Jira host, same Bearer PAT). Exports `aioFetch(url, headers)` to centralize auth header construction. |
| `services/aio/types.ts` | All AIO REST response shapes: `AioProject`, `AioCycle`, `AioCycleSummary`, `AioTestRun`, `AioTestStep`, `AioAttachment`. Single source of truth, mirrors `jira/types.ts` discipline. |
| `services/aio/projects.ts` | `fetchAioProjects(baseUrl, token)` — GET `/rest/aio-tcms/1.0/project` returns paginated project list. |
| `services/aio/cycles.ts` | `fetchAioCycles(baseUrl, token, projectId)` — GET `/rest/aio-tcms/1.0/project/{projectId}/cycle`. `fetchAioCycleSummary(baseUrl, token, projectId, cycleId)` — GET `/rest/aio-tcms/1.0/project/{projectId}/cycle/{cycleId}/summary` (progress counts, defect count). |
| `services/aio/runs.ts` | `fetchAioTestRuns(baseUrl, token, projectId, cycleId)` — GET `/rest/aio-tcms/1.0/project/{projectId}/cycle/{cycleId}/testrun`. Returns test run list with step/expected/actual. |
| `services/aio/issue-runs.ts` | `fetchAioRunsForIssue(baseUrl, token, issueKey)` — GET `/rest/aio-tcms/1.0/testrun?issueKey={issueKey}`. Used by the Jira issue detail page to render the AIO test run table. |
| `services/aio/index.ts` | Barrel re-export: `export * from './projects'`, `./cycles`, `./runs`, `./issue-runs`, `./types`. Same pattern as `jira/index.ts`. |

### Route pages — `taskflow/src/routes/aio/`

| File | Purpose |
|------|---------|
| `routes/aio/index.tsx` | Lazy-loaded entry. Re-exports `AioProjectsPage` as default for `routes.tsx`. |
| `routes/aio/AioProjectsPage.tsx` | `/aio` — project list view. `useQuery(['aio-projects', jiraBaseUrl])` with skeleton. NavLink to `/aio/projects/:id`. |
| `routes/aio/AioProjectDetailPage.tsx` | `/aio/projects/:id` — project overview: cycles list with progress ring per cycle. `useQuery(['aio-cycles', projectId, jiraBaseUrl])`. NavLink to `/aio/cycles/:projectId/:cycleId`. |
| `routes/aio/AioCycleDetailPage.tsx` | `/aio/cycles/:projectId/:cycleId` — cycle detail: progress summary, defect count, test run table. Two queries: `['aio-cycle-summary', ...]` + `['aio-test-runs', ...]`. Pin button calls `usePinnedTabsStore.togglePin`. |
| `routes/aio/AioCycleSkeleton.tsx` | Skeleton for cycle detail (consistent with `SprintBoardSkeleton`, `WorkloadSkeleton`). |
| `routes/aio/TestRunTable.tsx` | Table component rendering step / expected / actual / status. Status cells use colored badges (pass=green, fail=red, blocked=amber, untested=muted). |

### Issue detail extension — existing directory `routes/dashboard/issue-detail/`

| File | Purpose |
|------|---------|
| `routes/dashboard/issue-detail/AioRunsSection.tsx` | New section component dropped into `IssueDetailPage`. `useQuery(['aio-issue-runs', issueKey, jiraBaseUrl])`. Renders `TestRunTable` (re-used from `routes/aio/`). Shows skeleton while loading, collapses if no runs. |

---

## Modified Files

### `taskflow/src/lib/apiFetch.ts`

**Change:** AIO uses the same Jira host and same Bearer PAT. Route AIO calls through `apiFetch` with `source: 'jira'`. This requires no code change — `aio/client.ts` simply calls `apiFetch('jira', url, headers)`. Document the decision in `aio/client.ts` as a comment. If the team later wants AIO calls labelled separately in Dev Tools logs, add `'aio'` to the source union — but do not do so preemptively.

### `taskflow/src/stores/auth.store.ts`

**Change:** Add `aioBaseUrl: string | null` and `setAioBaseUrl(url: string | null)`. AIO's REST API lives at the same Jira host but the team may run AIO on a different subdomain. Store the URL separately. The PAT is reused from Stronghold key `'jira-pat'` — on-premise AIO uses the same Jira PAT.

Default `aioBaseUrl` to `null`; the service modules fall back to `jiraBaseUrl` when `aioBaseUrl` is null (the overwhelmingly common case).

### `taskflow/src/components/app/sidebar-items.ts`

**Change:** Add new section `'testing'` to `SIDEBAR_SECTIONS` and one new nav item:

```typescript
// Add to SIDEBAR_SECTIONS:
{ id: 'testing', label: 'Testing' }

// Add to SIDEBAR_NAV_ITEMS:
{
  id: 'aio-tests',
  label: 'Test Management',
  path: '/aio',
  iconName: 'FlaskConical',
  section: 'testing',
}
```

Update `getDefaultSidebarItems`: add `'aio-tests'` to both `devVisible` and `pmVisible` sets. Update `DEV_SIDEBAR_PRESET` and `PM_SIDEBAR_PRESET` constants used in tests.

### `taskflow/src/components/app/Sidebar.tsx`

**Change:** Add `FlaskConical` to the Lucide import and to `ICON_MAP`. One import line + one map entry. No structural change.

### `taskflow/src/routes/routes.tsx`

**Change:** Add three lazy-loaded AIO routes:

```typescript
const AioProjectsPage = lazy(() => import('./aio/index'));
const AioProjectDetailPage = lazy(() => import('./aio/AioProjectDetailPage'));
const AioCycleDetailPage = lazy(() => import('./aio/AioCycleDetailPage'));

{ path: '/aio', element: withLazy(AioProjectsPage) },
{ path: '/aio/projects/:projectId', element: withLazy(AioProjectDetailPage) },
{ path: '/aio/cycles/:projectId/:cycleId', element: withLazy(AioCycleDetailPage) },
```

### `taskflow/src/components/app/PinnedTabStrip.tsx`

**Change:** `PinnedTabStrip` currently assumes all pinned keys are Jira issue keys and routes all clicks to `onTabClick(key)`. AIO cycle tabs use a prefixed key format: `"aio:42:7"` (projectId:cycleId).

The component is key-agnostic — it does not interpret key format. The only change needed is in the rendering:

1. Rename `ResolvedIssue` interface to `ResolvedTab`, rename field `issueTypeName` to `typeLabel` (domain-neutral).
2. Rename `IssueTypeIcon` to `TabIcon` and add a case for `typeLabel === 'aio-cycle'` that renders `FlaskConical`.
3. The `resolvedIssues` prop is renamed to `resolvedTabs: Map<string, ResolvedTab>`.

All Jira type cases in `TabIcon` carry over unchanged — only the interface field names change.

### `taskflow/src/main.tsx` (AppLayout)

**Changes — five touch points:**

1. **`pinnedQueries` (`useQueries`):** Detect `aio:` prefix. For AIO keys, call `fetchAioCycleSummary` and map result to `{ summary: cycle.name, typeLabel: 'aio-cycle' }`. For Jira keys, existing path unchanged.

2. **`handleTabClick` (new unified handler):** Replaces direct `handleIssueClick` call in `onTabClick` prop:
   ```typescript
   const handleTabClick = (key: string) => {
     if (key.startsWith('aio:')) {
       const [, projectId, cycleId] = key.split(':');
       navigate(`/aio/cycles/${projectId}/${cycleId}`);
     } else {
       handleIssueClick(key, true);
     }
   };
   ```

3. **`activeTabKey` derivation:** Extend to cover AIO cycle routes:
   ```typescript
   const activeTabKey = location.pathname.startsWith('/issue/')
     ? location.pathname.replace('/issue/', '')
     : location.pathname.startsWith('/aio/cycles/')
       ? 'aio:' + location.pathname.replace('/aio/cycles/', '').replace('/', ':')
       : null;
   ```

4. **Breadcrumb reset guard:** Add `/aio/` to the exclusion list so drilling down within AIO does not reset the trail:
   ```typescript
   if (!pathname.startsWith('/issue/') &&
       !pathname.startsWith('/mr/') &&
       !pathname.startsWith('/release/') &&
       !pathname.startsWith('/aio/')) {
     breadcrumbReset();
   }
   ```

5. **`routeLabel`:** Add case `if (pathname.startsWith('/aio')) return 'Test Management';`.

### `taskflow/src/routes/dashboard/issue-detail/IssueDetailPage.tsx`

**Change:** Import and render `AioRunsSection` below `AttachmentsSection`. Pass `issueKey` and `jiraBaseUrl`. `AioRunsSection` owns its own query — no additional props needed.

### `taskflow/src/routes/dashboard/WikiRenderer.tsx`

**No code change required.** AIO attachment URLs served from the same Jira host pass through `AuthImage`'s existing `needsAuth` check (`src.startsWith(jiraBaseUrl)`). The `preprocessJiraMarkup` function already handles `!http://...!` references by outputting them as `<img src="..." />` tags. `AuthImage` then fetches with Bearer token and converts to a blob URL.

If AIO is deployed at a different subdomain from Jira: add `aioBaseUrl` check to `AuthImage.needsAuth` — one additional `||` condition.

---

## Data Flow

```
AIO REST API (same Jira host, /rest/aio-tcms/1.0/...)
  |
  | tauri-plugin-http fetch (Bearer PAT from Stronghold 'jira-pat')
  |
services/aio/client.ts  →  apiFetch(source: 'jira', url, headers)
  |
  +-- services/aio/projects.ts    →  fetchAioProjects()
  +-- services/aio/cycles.ts      →  fetchAioCycles(), fetchAioCycleSummary()
  +-- services/aio/runs.ts        →  fetchAioTestRuns()
  +-- services/aio/issue-runs.ts  →  fetchAioRunsForIssue()
  |
TanStack Query  (gcTime: Infinity, staleTime per table below)
  |
  +-- AioProjectsPage       useQuery(['aio-projects', jiraBaseUrl])
  +-- AioProjectDetailPage  useQuery(['aio-cycles', projectId, jiraBaseUrl])
  +-- AioCycleDetailPage    useQuery(['aio-cycle-summary', projectId, cycleId, jiraBaseUrl])
  |                         useQuery(['aio-test-runs', projectId, cycleId, jiraBaseUrl])
  +-- AioRunsSection        useQuery(['aio-issue-runs', issueKey, jiraBaseUrl])
  |
  +-- AppLayout pinnedQueries (useQueries for aio: prefixed keys)
        → fetchAioCycleSummary → resolvedPinnedTabs Map
        → PinnedTabStrip (renders cycle name + FlaskConical icon)
```

### Query Key Conventions

All AIO query keys follow the same tuple pattern as Jira: `[discriminator, ...params, jiraBaseUrl]`. The `jiraBaseUrl` tail prevents stale cache across server switches — same invariant enforced throughout Jira queries.

| Query Key | staleTime | Rationale |
|-----------|-----------|-----------|
| `['aio-projects', jiraBaseUrl]` | `5 * 60 * 1000` | Project list rarely changes during a session |
| `['aio-cycles', projectId, jiraBaseUrl]` | `5 * 60 * 1000` | Cycle list changes only when PMs create/archive cycles |
| `['aio-cycle-summary', projectId, cycleId, jiraBaseUrl]` | `STALE_TIME_MS` (30s) | Execution progress updates during active test runs — use polling interval to stay current |
| `['aio-test-runs', projectId, cycleId, jiraBaseUrl]` | `STALE_TIME_MS` | Same reasoning as cycle summary |
| `['aio-issue-runs', issueKey, jiraBaseUrl]` | `5 * 60 * 1000` | Per-issue run data; refresh on focus is sufficient |
| `['aio-pinned-summary', cycleKey, jiraBaseUrl]` | `5 * 60 * 1000` | Pinned tab cycle name; matches jira-pinned-summary pattern |

`gcTime: Infinity` on all AIO queries — consistent with the session-persistent cache policy (v1.7 LOAD-02).

`refetchInterval` on `aio-cycle-summary` and `aio-test-runs`: use `POLL_INTERVAL_MS` (60s) when the user is on the cycle detail route, using the same `useIsActiveRoute` hook pattern already established for sprint board and workload views.

### AIO Attachment Auth Flow

AIO attachment URLs are served from the Jira host. `AuthImage` already checks `src.startsWith(jiraBaseUrl)` and fetches with Bearer token — no new authenticated fetch mechanism needed for the common deployment case.

If AIO is at a different subdomain: one additional `||` condition in `AuthImage.needsAuth`.

---

## Route Structure

```
/aio                              AioProjectsPage       (lazy chunk: aio-projects)
/aio/projects/:projectId          AioProjectDetailPage  (lazy chunk: aio-project-detail)
/aio/cycles/:projectId/:cycleId   AioCycleDetailPage    (lazy chunk: aio-cycle-detail)
```

All three use `withLazy(...)` — consistent with all non-dashboard routes in `routes.tsx`.

Route naming uses plural resource nouns matching the REST API path segments (`/project/`, `/cycle/`) to make the URL ↔ API mapping obvious.

**Breadcrumb trail for AIO:**
- Navigating `/aio` → `/aio/projects/:id`: push `/aio` as "Test Management" breadcrumb
- Navigating `/aio/projects/:id` → `/aio/cycles/:p/:c`: push project page as breadcrumb
- Navigating away from any `/aio/` path: breadcrumb resets

---

## Pinned Tab Extension

### How it works today

`pinnedKeys: string[]` stores Jira issue keys (e.g. `"PROJ-42"`). `AppLayout` runs `useQueries` to resolve each key to `{ summary, issueTypeName }`. `PinnedTabStrip` receives `resolvedIssues: Map<string, ResolvedIssue>` and renders icon + summary for each tab. Tabs are key-agnostic — the `onTabClick` callback routes navigation.

### Extension strategy

**Storage:** No change to `usePinnedTabsStore`. AIO cycle tabs use prefixed keys: `"aio:42:7"` (projectId:cycleId). The store persists them alongside Jira keys transparently.

**Resolution in AppLayout:** `useQueries` maps over `pinnedKeys`. When a key starts with `'aio:'`, the query calls `fetchAioCycleSummary` and maps to `{ summary: cycle.name, typeLabel: 'aio-cycle' }`.

**PinnedTabStrip interface change:** Rename `ResolvedIssue` → `ResolvedTab`, `issueTypeName` → `typeLabel`. Add `'aio-cycle'` case to `TabIcon` (formerly `IssueTypeIcon`). All Jira type cases unchanged.

**Pin action in AioCycleDetailPage:**
```typescript
const { togglePin, isPinned } = usePinnedTabsStore();
const key = `aio:${projectId}:${cycleId}`;
togglePin(key);
```

Consistent with how issue detail pages pin Jira keys.

---

## Suggested Build Order

### Phase 1: Service layer + types

Build service modules and types before any UI. Everything downstream depends on correct API shapes.

1. `services/aio/types.ts`
2. `services/aio/client.ts`
3. `services/aio/projects.ts`, `cycles.ts`, `runs.ts`, `issue-runs.ts`
4. `services/aio/index.ts`
5. Unit tests for each module (mock `apiFetch` with `vi.stubGlobal` — same pattern as `jira/*.test.ts`)

Dependency: none.

### Phase 2: Sidebar nav + routing scaffolding

Wire nav item and empty route stubs. Establishes navigation before content is built.

1. Add `'testing'` section and `'aio-tests'` item to `sidebar-items.ts`
2. Add `FlaskConical` to `Sidebar.tsx` ICON_MAP
3. Add three routes to `routes.tsx` (placeholder page components)
4. Create `routes/aio/` directory with stub files
5. Update `SidebarItemsList` tests for the new preset entries

Dependency: Phase 1 (service imports in page stubs).

### Phase 3: AIO project list + project detail pages

Build the first two levels of the navigation hierarchy.

1. `AioProjectsPage`: query + render + skeleton + empty/error states
2. `AioProjectDetailPage`: cycle list + progress display per cycle + skeleton
3. `AioCycleSkeleton.tsx`

Dependency: Phase 2.

### Phase 4: AIO cycle detail + pinned tab support

Build the deepest view and pinning together — they share the same data shape.

1. `TestRunTable.tsx`: step/expected/actual columns, colored status badges
2. `AioCycleDetailPage`: two queries, `TestRunTable`, pin button
3. Extend `PinnedTabStrip`: rename interfaces, add `'aio-cycle'` to `TabIcon`
4. Extend `AppLayout`: `useQueries` for `aio:` keys, `handleTabClick` dispatcher, `activeTabKey` derivation, breadcrumb guard, `routeLabel`
5. Tests for updated `PinnedTabStrip` and `handleTabClick` dispatch

Dependency: Phase 3.

### Phase 5: AIO test runs on Jira issue detail

Integrate the test run table into the existing issue detail view.

1. `AioRunsSection.tsx`: query + `TestRunTable` + loading/empty handling
2. Mount `AioRunsSection` in `IssueDetailPage` below `AttachmentsSection`
3. Tests for `AioRunsSection`

Dependency: Phase 1 (service), Phase 4 (`TestRunTable` component lives in `routes/aio/`).

### Phase 6: AIO attachment auth verification

Validate that AIO attachment URLs render correctly through `AuthImage` / `WikiRenderer`.

1. Confirm AIO attachment URL prefix matches `jiraBaseUrl` (likely true for on-premise AIO)
2. If AIO uses a different host: extend `AuthImage` `needsAuth` and add `aioBaseUrl` to `auth.store.ts`
3. Optionally: add AIO connection card to `ConnectionsSection.tsx` in Settings (only if AIO URL differs from Jira URL)

Dependency: Phase 5 (need real AIO attachment URLs from test runs to verify the auth path).

---

## Component Boundaries Summary

| Component | Owns | Does Not Own |
|-----------|------|-------------|
| `AioProjectsPage` | Project list query, empty/error states | Cycle data |
| `AioProjectDetailPage` | Cycle list query, progress display | Cycle execution data |
| `AioCycleDetailPage` | Cycle summary + run queries, pin state | Project-level data |
| `TestRunTable` | Step/expected/actual rendering, status badges | Data fetching |
| `AioRunsSection` | Issue-runs query, TestRunTable mounting | Issue detail page layout |
| `PinnedTabStrip` | Tab rendering, drag reorder | Routing decisions (caller owns onClick) |
| `AppLayout` | Pin key dispatch, query resolution for tabs | Rendering logic |

---

## Sources

- Codebase: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/` — all service, store, route, and component files examined directly
- Existing patterns: `services/jira/` domain module structure, `PinnedTabStrip.tsx`, `main.tsx` AppLayout, `sidebar-items.ts`, `apiFetch.ts`, `AuthImage.tsx`, `WikiRenderer.tsx`, `stores/auth.store.ts`, `routes/routes.tsx`
- AIO TCMS API base path (`/rest/aio-tcms/1.0/`) inferred from AIO Test Management for Jira documentation conventions; exact endpoint paths must be confirmed against the live Jira instance before Phase 1 implementation
