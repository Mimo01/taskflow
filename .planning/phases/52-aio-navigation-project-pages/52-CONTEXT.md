# Phase 52: AIO Navigation + Project Pages - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Testing" sidebar section (gated by `aioEnabled`) and two lazy-loaded full-page routes: an AIO projects list page (`/aio-projects`) and a project overview page (`/aio-project/:projectKey`) listing all cycles for a project. No cycle detail, no pass/fail counts, no header pinning — those are Phase 53+.

</domain>

<decisions>
## Implementation Decisions

### Sidebar — "Testing" section
- **D-01:** Add a new `SIDEBAR_SECTION` with `{id: 'testing', label: 'Testing'}` after the existing `'tracking'` section in `sidebar-items.ts`.
- **D-02:** Add one nav item: `{id: 'aio-projects', label: 'AIO Projects', path: '/aio-projects', iconName: 'FlaskConical', section: 'testing'}`. Icon must be added to `ICON_MAP` in `Sidebar.tsx`.
- **D-03:** The AIO item participates in the sidebar customization system (Settings → Sidebar). Add it to `SIDEBAR_NAV_ITEMS` and include it in `getDefaultSidebarItems` with `visible: true` for both presets. Settings store version bump (v15 → v16) with migration: `if (version < 16) { s.sidebarItems = appendAioItemIfMissing(s.sidebarItems); }`.
- **D-04:** Sidebar.tsx filters AIO items by both `visibleIds` AND `aioEnabled`. When `aioEnabled = false`, the "Testing" section is hidden even if the item is marked visible in settings. Implementation: filter `sectionedItems` to exclude items where `nav.section === 'testing' && !aioEnabled`.

### Project list page (`/aio-projects`)
- **D-05:** Calls `fetchAioProjects(baseUrl, token)` — returns `AioProject[]` with `{id, projectKey, name}`. No additional API calls.
- **D-06:** Layout: table rows (same pattern as `EpicsPage`). Columns: project name (clickable → navigates to project overview) + project key (`font-mono` badge).
- **D-07:** Skeleton: `AioProjectsSkeleton.tsx` sibling component, using `<Skeleton>` rows as per v1.7 pattern.
- **D-08:** Empty state: `<EmptyState>` with a message like "No AIO test projects found." Error state: `<ErrorState>` with retry.

### Project overview page (`/aio-project/:projectKey`)
- **D-09:** Calls `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle` (AIO_API_PATH) — returns `AioPage<AioCycle>`. Pagination loop required (same as `fetchAioTestRunsForCycle` pattern in Phase 51).
- **D-10:** Shows cycle name + status only. Pass/fail counts and run date are **deferred to Phase 53**. No N+1 fetches per cycle.
- **D-11:** Layout: table rows. Columns: cycle key (`font-mono`) + cycle name (clickable) + status badge.
- **D-12:** Clicking a cycle row navigates to `/aio-cycle/:projectKey/:cycleKey` — this route is NOT implemented in Phase 52 (Phase 53 builds it). The link renders now; it will 404 until Phase 53 ships.
- **D-13:** Skeleton: `AioCyclesSkeleton.tsx` sibling. Empty + error states follow the same pattern as the projects page.

### Routing
- **D-14:** Flat route convention — matches existing pattern (`/merge-requests` + `/mr/:id`):
  - `/aio-projects` → `AioProjectsPage` (lazy-loaded)
  - `/aio-project/:projectKey` → `AioProjectOverviewPage` (lazy-loaded)
  - `/aio-cycle/:projectKey/:cycleKey` → `AioCycleDetailPage` (added as a stub or deferred to Phase 53 — Phase 52 planner decides; the route path is locked here)
- **D-15:** Both pages wrapped in `withLazy()` from `routes.tsx`. Separate lazy import, separate `ChunkErrorBoundary`.

### AIO cycles service module
- **D-16:** Phase 51 built `projects.ts` and `issue-runs.ts` but NOT a `cycles.ts` module. Phase 52 must add `src/services/aio/cycles.ts` with `fetchAioCycles(baseUrl: string, token: string, projectKey: string): Promise<AioCycle[]>`. Follows the pagination loop pattern in `issue-runs.ts`. Export from `aio/index.ts` barrel.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 51 decisions (probe findings + service layer)
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — D-13–D-17: dual base paths, auth scheme, AioCycle type, AioPage<T> wrapper, confirmed endpoints. **MUST READ** before writing any AIO service code.

### Sidebar system
- `taskflow/src/components/app/sidebar-items.ts` — `SIDEBAR_SECTIONS`, `SIDEBAR_NAV_ITEMS`, `getDefaultSidebarItems`, `SidebarItem`. Add Testing section and AIO item here.
- `taskflow/src/components/app/Sidebar.tsx` — `ICON_MAP`, `sectionedItems` filter logic, nav rendering. Add `aioEnabled` AND gate for the Testing section.

### Settings store (version migration)
- `taskflow/src/stores/settings.store.ts` — Currently at v15 (Phase 51). Bump to v16 to add AIO item to `sidebarItems`. Follow the existing migration chain pattern.

### Routing
- `taskflow/src/routes/routes.tsx` — `withLazy()` pattern, all lazy imports. Add `/aio-projects` and `/aio-project/:projectKey` here.

### AIO service (base layer from Phase 51)
- `taskflow/src/services/aio/client.ts` — `aioFetch()`, `AIO_PROJECTS_API_PATH`, `AIO_API_PATH` constants. Do NOT modify.
- `taskflow/src/services/aio/types.ts` — `AioProject`, `AioCycle`, `AioTestRun`, `AioPage<T>`. `AioCycle` already defined: `{key, name, status, projectKey}`.
- `taskflow/src/services/aio/projects.ts` — `fetchAioProjects()` — already built, use as-is.
- `taskflow/src/services/aio/index.ts` — Barrel export. Add `cycles.ts` exports here after creating the module.

### Existing page patterns to mirror
- `taskflow/src/routes/dashboard/EpicsPage.tsx` — Table layout, `readSecret`, `useAuthStore`, `useDelayedLoading`, `useQuery`, skeleton/error/empty states pattern.
- `taskflow/src/routes/dashboard/EpicsSkeleton.tsx` — Skeleton component pattern to mirror for `AioProjectsSkeleton.tsx` and `AioCyclesSkeleton.tsx`.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.8 — AION-01, AION-02, AION-03: sidebar, project list, project overview. Phase 52 scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchAioProjects(baseUrl, token)` (`aio/projects.ts`): Already built in Phase 51. Returns `AioProject[]` with `{id, projectKey, name}`. No changes needed.
- `AioCycle` type (`aio/types.ts`): `{key, name, status, projectKey}` — confirmed. Use as-is for the overview page.
- `AioPage<T>` type (`aio/types.ts`): Paginated wrapper. Cycles endpoint returns `AioPage<AioCycle>`.
- `withLazy()` helper (`routes.tsx`): Wraps lazy components with `ChunkErrorBoundary` + `Suspense`. Use for both AIO page routes.
- `useDelayedLoading` hook: 200ms flicker-prevention for skeleton display. Use in both AIO pages.
- `<EmptyState>` + `<ErrorState>` components: Already used across all data views. Use unchanged.
- `<Skeleton>` component (`components/ui/skeleton.tsx`): Base for skeleton row patterns.

### Established Patterns
- **Page structure:** `useQuery` → `useDelayedLoading` → render skeleton / error / empty / data. See `EpicsPage.tsx`.
- **Credential loading:** `readSecret('jira-pat')` in `useEffect` + `useAuthStore` for `jiraBaseUrl`. Same pattern for AIO pages.
- **Query key:** `['aio', jiraBaseUrl, ...]` prefix. Projects: `['aio', jiraBaseUrl, 'projects']`. Cycles: `['aio', jiraBaseUrl, 'cycles', projectKey]`.
- **Pagination loop:** See `fetchAioTestRunsForCycle` in `aio/issue-runs.ts` for the `AioPage<T>` iteration pattern. `fetchAioCycles` mirrors this.
- **Lazy loading:** `lazy(() => import('./path'))` + `withLazy()` in `routes.tsx`.
- **Sidebar customization version migration:** `settings.store.ts` sequential `if (version < N)` guards. V16 migration adds AIO item to `sidebarItems`.

### Integration Points
- `sidebar-items.ts`: New `SIDEBAR_SECTION` + `SIDEBAR_NAV_ITEMS` entry. `getDefaultSidebarItems` presets updated.
- `Sidebar.tsx`: `ICON_MAP` gets AIO icon. `sectionedItems` filter adds `aioEnabled` gate for `section === 'testing'`.
- `settings.store.ts`: Version bump v15 → v16 with `sidebarItems` migration.
- `routes.tsx`: Two new lazy imports + two new `RouteObject` entries.
- `aio/index.ts`: Export `fetchAioCycles` from new `cycles.ts` module.

</code_context>

<specifics>
## Specific Ideas

- Cycle rows on the overview page are clickable links to `/aio-cycle/:projectKey/:cycleKey` even though Phase 53 builds that route. Phase 52 just emits the `<NavLink>` — 404 is acceptable until Phase 53 ships.
- Pass/fail counts on the overview page are explicitly deferred to Phase 53 — do not add them here even if the API provides them.

</specifics>

<deferred>
## Deferred Ideas

- **Per-cycle pass/fail counts on overview** — deferred to Phase 53 (cycle detail phase). Requires N+1 fetches or `/testcycle/{key}/detail` calls; not worth the extra load for a list view.
- **Cycle detail route stub** — Phase 52 planner may choose to add `/aio-cycle/:projectKey/:cycleKey` as a placeholder route or leave it for Phase 53. Either is acceptable; the route path shape is locked here.

</deferred>

---

*Phase: 52-AIO Navigation + Project Pages*
*Context gathered: 2026-05-13*
