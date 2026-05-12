---
phase: 52-aio-navigation-project-pages
plan: "00"
subsystem: testing
tags: [vitest, tdd, aio, react, react-query, react-router, zustand]

# Dependency graph
requires:
  - phase: 51-aio-service-layer
    provides: AioProject, AioCycle, AioPage<T> types; fetchAioProjects; aioFetch; apiFetch mock pattern
provides:
  - 4 Wave 0 RED test stubs establishing Nyquist contract before any Phase 52 implementation
  - cycles.test.ts — 5 failing stubs for fetchAioCycles (pagination, multi-page, 401, 404, network)
  - AioProjectsPage.test.tsx — 3 failing stubs for AION-02 (render rows, empty state, error state)
  - AioProjectOverviewPage.test.tsx — 3 failing stubs for AION-03 (render rows, empty state, error state)
  - Sidebar.test.tsx — 2 failing stubs for AION-01 aioEnabled gate (visible/absent)
affects:
  - 52-01 (cycles.ts service — must turn cycles.test.ts GREEN)
  - 52-02 (sidebar + settings — must turn Sidebar.test.tsx GREEN)
  - 52-03 (AioProjectsPage — must turn AioProjectsPage.test.tsx GREEN)
  - 52-04 (AioProjectOverviewPage — must turn AioProjectOverviewPage.test.tsx GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Wave 0 stub pattern: vi.mock hoisted before imports; every it() body expect(true).toBe(false)"
    - "AIO service test pattern: vi.mock('../../lib/apiFetch') + vi.mocked(apiFetch) + constants BASE/TOKEN/PROJECT_KEY"
    - "Page test pattern: makeClient() + QueryClientProvider + MemoryRouter + dynamic import in each it()"
    - "AioProjectOverviewPage uses initialEntries=['/aio-project/PROJ'] + Route path='/aio-project/:projectKey'"

key-files:
  created:
    - taskflow/src/services/aio/cycles.test.ts
    - taskflow/src/routes/dashboard/AioProjectsPage.test.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
    - taskflow/src/components/app/Sidebar.test.tsx
  modified: []

key-decisions:
  - "Stub bodies use expect(true).toBe(false) — simplest guaranteed RED; assertions added in GREEN phase"
  - "vi.mock hoisting mirrors projects.test.ts exactly — consistent pattern across all AIO service tests"
  - "Page tests use dynamic import() per it() block to get fresh module instances with mocked dependencies"
  - "Sidebar.test.tsx mocks all Sidebar dependencies (useResizable, jira services, stronghold) to isolate aioEnabled gate test"

patterns-established:
  - "Pattern 1: AIO service test — vi.mock apiFetch hoisted, constants at top, 5-case coverage (200 page, multi-page, 401, 404, network)"
  - "Pattern 2: AIO page test — vi.mock @/services/aio barrel, makeClient(), MemoryRouter, dynamic import in each it()"
  - "Pattern 3: Sidebar gate test — mock useSettingsStore with aioEnabled field + sidebarItems array"

requirements-completed:
  - AION-01
  - AION-02
  - AION-03

# Metrics
duration: 4min
completed: 2026-05-12
---

# Phase 52 Plan 00: Wave 0 Test Stubs Summary

**13 RED test stubs across 4 files establishing the Nyquist sampling contract for AIO navigation (sidebar gate, projects list, project overview, cycles service)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-12T22:52:45Z
- **Completed:** 2026-05-12T22:57:14Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created `cycles.test.ts` with 5 stubs covering the full fetchAioCycles contract (pagination loop, multi-page accumulation, 401/404/network error handling)
- Created `AioProjectsPage.test.tsx` and `AioProjectOverviewPage.test.tsx` with 3 stubs each, mirroring EpicsPage.test.tsx mock pattern
- Created `Sidebar.test.tsx` with 2 stubs covering the `aioEnabled` gate for the Testing section visibility
- All 13 stubs confirmed RED (exit non-zero); no production files created or modified

## Task Commits

Each task was committed atomically:

1. **Task 1: cycles.test.ts stub (RED)** - `e9b5075` (test)
2. **Task 2: AioProjectsPage + AioProjectOverviewPage stubs (RED)** - `d580539` (test)
3. **Task 3: Sidebar.test.tsx stub (RED)** - `b2dbd67` (test)

## Files Created/Modified

- `taskflow/src/services/aio/cycles.test.ts` — 5 RED stubs for fetchAioCycles; mirrors projects.test.ts pattern with vi.mock hoisting
- `taskflow/src/routes/dashboard/AioProjectsPage.test.tsx` — 3 RED stubs for AION-02 render/empty/error states
- `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` — 3 RED stubs for AION-03 render/empty/error states; MemoryRouter initialEntries for useParams
- `taskflow/src/components/app/Sidebar.test.tsx` — 2 RED stubs for AION-01 aioEnabled gate (visible/absent)

## Decisions Made

- Stub bodies use `expect(true).toBe(false)` — simplest guaranteed RED; no conditional logic needed
- Page test files use `vi.mock('@/services/aio', ...)` against the barrel import to match future production usage
- `AioProjectOverviewPage.test.tsx` sets `MemoryRouter initialEntries={['/aio-project/PROJ']}` with `Route path="/aio-project/:projectKey"` so `useParams` will resolve `projectKey` when the component is implemented
- `Sidebar.test.tsx` mocks `useResizable` and all jira service imports to prevent module-not-found cascade failures during the GREEN phase

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The worktree was created from commit `a9f30f5` which predates Phase 51's `aio/` service layer. As a result:
- `taskflow/src/services/aio/` directory did not exist — created it to house `cycles.test.ts`
- `@tanstack/react-query`, `@testing-library/react`, and other deps are not resolvable from the worktree's `taskflow/` subdirectory (no `node_modules` there)
- Page test files and Sidebar.test.tsx fail at import resolution — this counts as RED per plan spec: "import will resolve at test run time (currently causes module-not-found but that counts as failing RED)"
- `cycles.test.ts` runs correctly (5 assertion failures) because vitest resolves the test runner from the worktree root's `node_modules`

All failure modes are the correct RED state for Wave 0.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 0 contract established — 13 RED stubs ready to be turned GREEN by Wave 1 plans
- Plan 52-01 (cycles.ts service) turns `cycles.test.ts` GREEN
- Plan 52-02 (sidebar + settings migration) turns `Sidebar.test.tsx` GREEN
- Plan 52-03 (AioProjectsPage) turns `AioProjectsPage.test.tsx` GREEN
- Plan 52-04 (AioProjectOverviewPage) turns `AioProjectOverviewPage.test.tsx` GREEN

---
*Phase: 52-aio-navigation-project-pages*
*Completed: 2026-05-12*
