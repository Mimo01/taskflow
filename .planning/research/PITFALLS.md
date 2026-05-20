# Pitfalls Research

**Domain:** Tempo Timesheets integration + react-grid-layout removal + dashboard redesign
**Researched:** 2026-05-20
**Confidence:** HIGH (codebase verified) / MEDIUM (Tempo API auth specifics — external sources contradict each other; probe required)

---

## Critical Pitfalls

### Pitfall 1: Tempo REST API auth is NOT the Jira Bearer PAT

**What goes wrong:**
The existing `aioFetch` and `jira.ts` both use `Authorization: Bearer <jira-pat>`. Developers assume the same Jira PAT token works for Tempo's REST API. It does not. Community reports consistently document that sending a Jira PAT to `/rest/tempo-timesheets/4/worklogs` returns HTTP 401. Tempo Timesheets on Jira DC uses either its own OAuth 2.0 token (generated in Tempo → Settings → API Integration) or Basic Auth — depending on the Tempo version and instance configuration. There is no public documentation confirming Bearer PAT works for this endpoint.

**Why it happens:**
AIO TCMS on the same Jira host accepted the Jira Bearer PAT (confirmed in Phase 51 probe). Developers carry this expectation into Tempo. Tempo is a third-party plugin with its own auth layer that is distinct from Jira's native token system.

**How to avoid:**
Treat Tempo auth as a new credential type requiring a dedicated probe. Write a `probeTempoAuth` function that tries `Authorization: Bearer <jira-pat>` and reports success or failure. If 401, surface a `tempoToken` input in Settings → Integrations (same pattern as `aioEnabled`). Store the Tempo token in Stronghold under key `tempo-pat`. Create a `tempoFetch` wrapper that reads from `tempo-pat` and never shares with `jiraFetch`. Do not assume the Jira PAT grants access to Tempo endpoints.

**Warning signs:**
- All Tempo API calls return 401 despite valid Jira PAT
- Tempo UI can be opened in the browser but API calls from the app fail

**Phase to address:**
Tempo service layer phase — first task. Auth must be probe-confirmed before writing any worklog fetch logic. Do not build the UI until the probe resolves auth.

---

### Pitfall 2: Tempo API base path varies by plugin version

**What goes wrong:**
The Tempo Server API has at minimum three documented base paths: `/rest/tempo-timesheets/1/`, `/rest/tempo-timesheets/3/`, `/rest/tempo-timesheets/4/`, and an undocumented internal path. Community members have confirmed that paths documented as current return 404 on actual instances. There is no standard discovery endpoint. The specific instance in this project (Orange eshop Jira DC v10.3.15) may use a different path than the documentation describes, and Tempo's own documentation is acknowledged to be outdated and misleading for DC/Server.

**Why it happens:**
Tempo's official documentation does not clearly map plugin version to API path. The AIO probe pattern succeeded because there were two distinct path prefixes; Tempo has at least three and they are not all simultaneously active. Guessing the correct path without probing produces silent 404s that look like "no data" rather than "wrong endpoint."

**How to avoid:**
Use the same probe-first pattern as AIO (`AIO_API_PATH` / `AIO_PROJECTS_API_PATH` in `aio/client.ts`). Write a `probeTempoEndpoints` function that tries candidate paths in sequence and records which one responds with a non-404. Gate all worklog fetches on probe success. Store the confirmed base path as a constant with a comment citing the probe result and Tempo plugin version observed.

**Warning signs:**
- API call returns 404 with an HTML error page (Jira "page not found") rather than JSON
- Worklog table shows an empty state error rather than "no worklogs found"

**Phase to address:**
Tempo service layer phase — first task, immediately after auth probe.

---

### Pitfall 3: Worklog timestamps cause off-by-one day errors across timezones

**What goes wrong:**
Jira's native worklog API returns `started` as `"2024-03-15T09:30:00.000+0200"` — local server time with an offset. Tempo's own API may return epoch milliseconds, a date-only string `"YYYY-MM-DD"`, or a different format depending on the endpoint version. When the frontend assigns a worklog to a calendar day column using `new Date(started).toLocaleDateString()`, DST boundaries and timezone differences cause assignments to shift by one day. A worklog logged at 23:30 CET (UTC+1) appears as the next day in UTC. For the Orange team, Jira server likely runs in CET/CEST — users running the app from UTC machines would see all late-evening worklogs on the wrong day.

**Why it happens:**
`new Date("2024-03-15T23:30:00.000+0100")` converts to UTC as March 15 22:30:00 UTC — correct. But `new Date("2024-03-15").toLocaleDateString()` on a UTC machine produces March 14 in UTC-offset environments due to midnight-UTC parsing. The safe pattern for day bucketing is to use the date string portion directly, not a converted `Date` object.

**How to avoid:**
For day-column bucketing: parse the date portion of the timestamp as `started.slice(0, 10)` (produces `"YYYY-MM-DD"`) rather than converting through a `Date` object. If the response returns epoch milliseconds, convert using `new Date(ms).toISOString().slice(0, 10)` (UTC date) — then confirm whether the Jira server intends UTC or server-local date for the worklog's "day." Add tests with fixtures timestamped at 23:00 and 01:00 across a DST boundary (last Sunday of October for CET/CEST) and verify day assignment does not shift.

**Warning signs:**
- Worklogs appear on the wrong day for users in timezones other than CET
- Totals match but day-column distribution differs from Tempo's own web UI
- Off-by-one on DST changeover dates

**Phase to address:**
Tempo worklog viewer phase. Write timezone fixtures before writing rendering logic — not after.

---

### Pitfall 4: Persisted `dashboardLayout` and widget store actions survive in Zustand if migration is skipped

**What goes wrong:**
`settings.store.ts` currently persists `dashboardLayout: DashboardLayoutItem[]` at version 18. It exposes `addDashboardWidget`, `removeDashboardWidget`, `setDashboardLayout`, and `updateWidgetConfig`. More critically, the store imports `getDefaultDashboardLayout` and `WIDGET_REGISTRY` directly from `@/routes/dashboard/widgets/registry`:

```typescript
import { getDefaultDashboardLayout, WIDGET_REGISTRY } from '@/routes/dashboard/widgets/registry';
```

When `registry.ts` is deleted, the entire store module fails to compile — the app does not start. This is a hard dependency, not an optional one. If the widget fields are removed from the store interface but the migration version is not bumped, existing users keep stale `dashboardLayout` data in their `settings.json` that the new code never reads, causing type inconsistencies on rehydration.

**Why it happens:**
The store initializes its `dashboardLayout` default from `getDefaultDashboardLayout()` and uses `WIDGET_REGISTRY` in `addDashboardWidget` to look up widget size constraints. These are used at store initialization time, so the import is load-order critical. Deleting the registry without updating the store causes an immediate module resolution failure.

**How to avoid:**
1. Remove `dashboardLayout`, `addDashboardWidget`, `removeDashboardWidget`, `setDashboardLayout`, `updateWidgetConfig` from the store interface and implementation in the same commit as deleting the registry.
2. Remove the `import { getDefaultDashboardLayout, WIDGET_REGISTRY }` line from `settings.store.ts`.
3. Update `applyPreset` to remove the `dashboardLayout: getDefaultDashboardLayout(preset)` line (line 369 in current code).
4. Bump the store version (19) and add a migration step that `delete`s `s.dashboardLayout` from persisted state.
5. Delete the `DashboardLayoutItem` interface from the store file.

**Warning signs:**
- TypeScript error: `Cannot find module '@/routes/dashboard/widgets/registry'`
- App fails to start after registry deletion but before store update

**Phase to address:**
Dashboard removal phase. Store and registry must be modified atomically in the same commit. This is the single highest-risk operation in v1.9.

---

### Pitfall 5: `settings.store.test.ts` imports deleted symbols and crashes the entire test file

**What goes wrong:**
`settings.store.test.ts` imports `WIDGET_REGISTRY`, `DEV_DASHBOARD_PRESET`, and `PM_DASHBOARD_PRESET` from `@/routes/dashboard/widgets/registry`. When `registry.ts` is deleted, this import fails before the first test runs. Vitest reports the entire file as a suite-level failure — all tests in the file are marked as failed — which can obscure which specific change caused the failure and lead to incorrect diagnosis.

The test file also contains a `describe('settings.store — layout customization (Phase 34)')` block with 9 tests for `addDashboardWidget`, `removeDashboardWidget`, `setDashboardLayout`, `updateWidgetConfig`, and the dashboard portion of `applyPreset`. These tests must be deleted — not commented out — because Biome will report unreachable code as an error.

**Why it happens:**
When removing a feature, the instinct is to delete component files and then rely on the test suite to identify what broke. But failing imports prevent the test file from loading at all, so the test suite reports failures rather than guiding cleanup.

**How to avoid:**
Delete the entire `describe('settings.store — layout customization')` block from `settings.store.test.ts` in the same commit as deleting the registry. Run `npx vitest run src/stores/settings.store.test.ts` directly to verify the file loads and all remaining tests pass before calling the phase done.

**Warning signs:**
- `Error: Cannot find module '@/routes/dashboard/widgets/registry'` in test output
- All 20+ tests in `settings.store.test.ts` reported as failed (not individual failures)

**Phase to address:**
Dashboard removal phase. Test cleanup is a required deliverable, not an afterthought.

---

### Pitfall 6: `react-grid-layout` CSS imports break `vite build` after package uninstall

**What goes wrong:**
`WidgetGrid.tsx` imports:
```typescript
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
```
When `react-grid-layout` and `react-resizable` are uninstalled, Vite fails to resolve these CSS imports at build time. TypeScript (`tsc --noEmit`) does not process CSS imports and reports no error — making it possible to pass the TypeScript check while the build is broken. The test suite (`vitest`) also does not catch this because test module resolution differs from Vite's production bundler.

**Why it happens:**
CSS imports in component files are resolved by Vite's build graph, not by TypeScript. Deleting the component file but forgetting to run `npm run build` after uninstalling the package means the build is broken but tests pass — creating a false sense of completeness.

**How to avoid:**
Delete `WidgetGrid.tsx` and all files in `src/routes/dashboard/widgets/` before running `npm uninstall react-grid-layout react-resizable`. Also remove `"@types/react-grid-layout"` from devDependencies. Include `npm run build` as an explicit step in the phase verification checklist — not just `vitest`.

**Warning signs:**
- `vite build` error: `Cannot resolve 'react-grid-layout/css/styles.css'`
- Tests pass but CI build job fails

**Phase to address:**
Dashboard removal phase. Include `npm run build` in the verification step explicitly.

---

### Pitfall 7: `WorkloadTab.test.tsx` left in place with 15+ tests after component deletion

**What goes wrong:**
`WorkloadTab.test.tsx` contains at minimum 15 tests that all `import('./WorkloadTab')`. When `WorkloadTab.tsx` is deleted, every test in the file fails with a module-not-found error. The test suite appears to have ~15 new failures, which can be alarming if the developer doesn't immediately recognize these as expected cleanup failures rather than regressions.

Additionally, `WorkloadSkeleton.tsx` is referenced by `WorkloadTab.tsx` — deleting `WorkloadTab.tsx` but leaving `WorkloadSkeleton.tsx` leaves a dead component on disk that Biome may not flag (no imports means no lint error, but the file adds to dead code count).

**Why it happens:**
Test files for a deleted component are easy to overlook because they are not in the component's import graph — nothing imports the test file, so no compilation error surfaces until the test runner loads it.

**How to avoid:**
Delete `WorkloadTab.test.tsx`, `WorkloadTab.tsx`, and `WorkloadSkeleton.tsx` as a group in the same commit. Run `vitest run --reporter=verbose` to confirm zero failures from this batch before proceeding.

**Warning signs:**
- 15+ test failures all reporting `Cannot find module './WorkloadTab'`
- Dead `WorkloadSkeleton.tsx` file on disk with no imports

**Phase to address:**
Workload removal phase. Treat test file deletion as part of the component deletion step.

---

### Pitfall 8: Sidebar and route entries left behind after WorkloadTab deletion

**What goes wrong:**
Workload removal is a three-file operation: `WorkloadTab.tsx`, `routes.tsx`, and `sidebar-items.ts`. If any one is missed:
- `routes.tsx` still has `const WorkloadTab = lazy(() => import('./dashboard/WorkloadTab'))` and `{ path: '/workload', element: withLazy(WorkloadTab) }`. This causes a runtime chunk-loading error on navigation to `/workload`. The `ChunkErrorBoundary` swallows the error and shows an error state — silent but broken.
- `sidebar-items.ts` still has `{ id: 'workload', label: 'Workload', path: '/workload', ... }`. The sidebar renders a link to a broken route.
- `PM_SIDEBAR_PRESET` includes `'workload'` in the visible set. If tests call `applyPreset('pm')` and check the sidebar items count or content, they fail because the preset references a removed item.

**Why it happens:**
Route and sidebar definitions live in separate files from the component. They are not in the compile-time dependency graph of `WorkloadTab.tsx`, so deleting the component does not trigger any TypeScript error that points to the stale references.

**How to avoid:**
Treat workload removal as an atomic four-file operation: `WorkloadTab.tsx`, `WorkloadTab.test.tsx`, `WorkloadSkeleton.tsx`, plus the entries in `routes.tsx` and `sidebar-items.ts`. Update `getDefaultSidebarItems` to remove `'workload'` from the `pmVisible` set. Run a global search for the string `'workload'` across all non-test source files before calling the phase done.

**Warning signs:**
- `ChunkErrorBoundary` shown at `/workload` route
- Sidebar shows a Workload link that leads to an error
- `applyPreset('pm')` test fails with unexpected sidebar item count

**Phase to address:**
Workload removal phase. Route + sidebar cleanup is step one.

---

### Pitfall 9: Sidebar and Settings test mocks reference removed `workload` item

**What goes wrong:**
After `workload` is removed from `sidebar-items.ts` and presets, two test files contain stale mock data:
- `Sidebar.test.tsx` line 77: `{ id: 'workload', visible: true }` in the mock `sidebarItems` array
- `Settings.test.tsx` line 131: `{ id: 'workload', visible: false }` in the mock `sidebarItems` array

These mocks don't cause import errors (they're plain objects), so the tests will still load. But any test that validates sidebar item count, renders the sidebar with the mock, or calls `applyPreset` and checks results against the mock structure will fail with a value mismatch.

**Why it happens:**
Test mock arrays are static snapshots of the real data structure. When the real data changes, the mocks don't update automatically, and the mismatch doesn't produce a compile error.

**How to avoid:**
After removing `workload` from `sidebar-items.ts`, run `grep -rn "'workload'" src/ --include="*.test.*"` to find all test files that reference the workload item. Update every mock array that includes it. Run the full test suite to verify zero failures before proceeding.

**Warning signs:**
- `Sidebar.test.tsx` fails with unexpected array element count
- `Settings.test.tsx` fails on sidebar-related assertions

**Phase to address:**
Workload removal phase. Search for mock references as a completion check.

---

### Pitfall 10: Tempo pagination defaults to 50 records — full date range silently truncated

**What goes wrong:**
The Tempo Server API defaults to paginating at 50 worklogs. A single month of worklogs for a 15-person team exceeds this. If the fetch function does not pass `paginate=false` (v1 path) or loop with offset/limit (v4 path), the viewer silently displays incomplete data. Users see hours that don't match Tempo's own reports and assume the data is wrong.

**Why it happens:**
The AIO batch summary endpoint returns a total count, making truncation obvious. Tempo's worklog endpoint returns a list without a clearly visible "there are more" indicator in the first response. Developers test with small date ranges (1 week, few users) where 50 records is sufficient, and the bug only surfaces in production with larger teams.

**How to avoid:**
For the v1 path: add `&paginate=false` to the query string. For the v4 path: implement a pagination loop that continues fetching until `offset + limit >= total`. Write a test fixture that simulates a 50-item first page with `total: 73` and verify the service function makes a second request.

**Warning signs:**
- Worklog table shows exactly 50 entries regardless of date range
- PM reports hours don't match Tempo's own report
- No obvious error — data appears present but is incomplete

**Phase to address:**
Tempo service layer phase. Pagination must be verified in a service test, not assumed correct.

---

### Pitfall 11: Worklog table renders N people × M day columns with no performance guard

**What goes wrong:**
A worklog viewer with people as rows and days as columns generates `people × days` cells. For a 30-day range with 20 people, that is 600 cells per render. Without a column count limit, users selecting a 90-day range with 30 team members produce 2700 cells. React Compiler handles memoization automatically, but re-renders from filter changes (date range update, assignee filter toggle) still reconcile all cells.

**Why it happens:**
The team already has `@tanstack/react-virtual` for row virtualization (backlog, notifications). The worklog table is two-dimensional — row virtualization alone leaves all columns rendered per row. Full 2D virtualization with `@tanstack/react-virtual` requires a flat-array mapping approach that is significantly more complex than the existing usage.

**How to avoid:**
Cap the date range selector at 31 days maximum in the UI. For 31 days × 20 people = 620 cells, full DOM rendering is acceptable at ~100-200 bytes per cell (no virtualization needed). Use an overflow-x scroll container with a sticky first column for the person/issue label. Do not attempt 2D virtualization in v1.9 — the cap makes it unnecessary. If the cap is later lifted, revisit.

**Warning signs:**
- React DevTools profiler shows >16ms render time on date range changes
- UI input lag when typing in date range fields

**Phase to address:**
Tempo worklog viewer phase. Define the maximum date range in the product spec before building the table.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode Tempo base path without probe | Saves 1-2 hours | Breaks on instances with different Tempo plugin versions | Never — probe is cheap, inconsistency is expensive |
| Assume Jira PAT works for Tempo | No new credential UI | 401s on every Tempo request; blocks the entire feature | Never for shipping code |
| Leave `dashboardLayout` in store without migration version bump | Avoids boilerplate | Stale widget data in user `settings.json`; type inconsistencies | Never — migration is 3 lines |
| Comment out instead of delete widget tests | Faster cleanup | Biome errors on dead code; misleading test counts | Never |
| Use `new Date(timestamp).toLocaleDateString()` for day bucketing | Simplest code | Wrong day for users in non-server-timezone | Never — use `.slice(0, 10)` |
| Skip `npm run build` in removal phase verification | Faster | CSS import errors from deleted packages pass `tsc` but fail the build | Never — add it to the checklist |
| Delete `WorkloadTab.tsx` but not `WorkloadTab.test.tsx` | Faster commit | 15+ test failures masking as regressions | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tempo Timesheets DC | Reusing Jira Bearer PAT | Probe auth first; create `tempoFetch` wrapper; store Tempo token in Stronghold key `tempo-pat` |
| Tempo Timesheets DC | Using documented base path without probing | Probe `/rest/tempo-timesheets/{1,3,4}/worklogs` in sequence; store confirmed path as a documented constant |
| Tempo Timesheets DC | Trusting response date format without inspecting actual response | Log first raw response; confirm whether `started` is ISO string, epoch ms, or date-only string |
| Tempo Timesheets DC | Fetching without pagination exhaustion | Pass `paginate=false` (v1) or loop with offset (v4); test with exactly-50-item fixture |
| Tempo Timesheets DC | Assuming `timeSpent` is always seconds | v1 API may return `timeSpentSeconds` (int); v4 may return `"2h 30m"` string; verify before parsing |
| Zustand persist | Removing fields without migration version bump | Bump `version` to 19; `delete s.dashboardLayout` in migrate function |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all N×M worklog cells | Janky filter changes, input lag | Cap date range to 31 days; overflow-x scroll with sticky column | 20+ people × 30+ days |
| N+1 user-details fetches per worklog row | 20 Jira requests for 20 team members | Batch user lookup in one call; TanStack Query deduplication | Any team > 5 |
| Fetching full Tempo worklog response without pagination | Silently returns 50 records maximum | Always paginate to exhaustion | Default 50-record limit |
| Re-fetching Tempo on every keystroke in date range input | Multiple in-flight requests, stale data | `enabled: isValidDateRange` guard on `useQuery`; no debounce needed with TanStack Query's `enabled` pattern | Immediate on typing |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Tempo token in `settings.json` (Tauri Store, plaintext) | Token readable from disk | Store in Stronghold under key `tempo-pat`; same pattern as Jira PAT |
| Sending Tempo token to Jira endpoints by accident | Token exposure in network logs, potential auth confusion | `tempoFetch` wrapper is separate from `jiraFetch`; no shared token reads |
| Logging Tempo Authorization header in DevTools request log | Token visible in dev tools capture | Follow existing pattern: `source: 'tempo'`; dev tools must redact Authorization header same as Jira |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Empty worklog table with no error when Tempo is unreachable | User thinks they logged nothing this period | Show `ErrorState` with "Tempo Timesheets is unreachable — verify credentials" message; same pattern as AIO disabled state |
| Date range picker allows multi-month or open-ended ranges | 600+ cell render; table becomes unreadable | Preset shortcuts (This Week / This Month / Last Month) + 31-day max custom range |
| Dashboard route shows blank after widget removal but before static dashboard is built | Users see empty page on app open | Build static dashboard before removing widget system; do not delete Dashboard before its replacement is wired |
| Worklog table shows weekend columns with no hours | Visual noise; empty cells for Sat/Sun | Default to weekdays-only columns; optional "show weekends" toggle |

---

## "Looks Done But Isn't" Checklist

- [ ] **Tempo auth probe**: A real Tempo API call returns 200 (not TypeScript-clean with no actual request made)
- [ ] **Tempo pagination**: Service test fixture with exactly 50 worklogs verifies that a second page request is made when total > 50
- [ ] **Widget store cleanup**: `settings.store.ts` no longer imports `registry.ts`; store version bumped to 19; migration deletes `dashboardLayout` from persisted state
- [ ] **Dashboard removal build check**: `npm run build` passes (not just `tsc --noEmit` and `vitest`)
- [ ] **Workload route removal**: `grep -rn "'/workload'" src/ --include="*.tsx"` returns zero matches in `routes.tsx` and `sidebar-items.ts`
- [ ] **Workload sidebar preset**: `PM_SIDEBAR_PRESET` does not include `'workload'` in the visible set
- [ ] **Test mock cleanup**: `grep -rn "'workload'" src/ --include="*.test.*"` returns zero matches in any mock `sidebarItems` array
- [ ] **Test cleanup**: `grep -rn "dashboardLayout\|WIDGET_REGISTRY\|DEV_DASHBOARD_PRESET\|PM_DASHBOARD_PRESET\|addDashboardWidget\|removeDashboardWidget" src/ --include="*.test.*"` returns zero matches
- [ ] **Worklog day bucketing**: Unit tests verify a worklog timestamped at 23:30 CET (UTC+1) is assigned to the correct calendar day for a UTC consumer
- [ ] **Package removal**: `react-grid-layout` and `react-resizable` absent from `package.json`; `@types/react-grid-layout` absent from devDependencies
- [ ] **WorkloadTab test file deleted**: `src/routes/dashboard/WorkloadTab.test.tsx` does not exist on disk

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tempo auth wrong (Jira PAT rejected) | MEDIUM | Add `tempoToken` field to Settings → Integrations; store in Stronghold `tempo-pat`; update `tempoFetch` wrapper; re-probe |
| Tempo base path wrong (404s) | LOW | Update `TEMPO_API_PATH` constant; re-run probe; no UI changes |
| Store version not bumped after field removal | HIGH | Emergency patch release with correct migration; users with broken persisted state need store reset |
| `react-grid-layout` CSS import missed | LOW | One-line fix; caught immediately by `vite build` |
| Test suite broken by deleted registry import | LOW | Delete the `describe` block; 15-minute fix |
| Day bucketing timezone bug caught in production | MEDIUM | Hotfix: replace `new Date(s).toLocaleDateString()` with `s.slice(0, 10)` throughout |
| WorkloadTab test file left in place | LOW | Delete the file; run suite; 5-minute fix |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tempo auth (Jira PAT rejected) | Tempo service layer — probe is first task | `probeTempoAuth` returns 200 with actual credentials |
| Tempo base path version mismatch | Tempo service layer — probe is first task | Constant documented with probe citation; no 404s in dev tools log |
| Worklog timestamp timezone bug | Tempo worklog viewer phase | Service test: 23:30 CET timestamp assigned to correct calendar day |
| Tempo pagination truncation | Tempo service layer phase | Service test with 50-item fixture verifies second-page request |
| Dashboard store import from registry | Dashboard removal phase | `settings.store.ts` compiles without `registry.ts` on disk |
| Store version not bumped | Dashboard removal phase | `grep "version: 19"` in `settings.store.ts`; migration deletes `dashboardLayout` |
| `react-grid-layout` CSS build failure | Dashboard removal phase | `npm run build` passes in phase verification |
| `settings.store.test.ts` broken imports | Dashboard removal phase | `vitest run src/stores/settings.store.test.ts` passes before phase is complete |
| `WorkloadTab.test.tsx` left behind | Workload removal phase | `ls src/routes/dashboard/WorkloadTab.test.tsx` returns not-found |
| Workload route not removed | Workload removal phase | `grep "workload" src/routes/routes.tsx` returns zero matches |
| Sidebar test mocks reference removed item | Workload removal phase | Full suite passes; `grep "'workload'" src/ --include="*.test.*"` zero matches |
| N×M cell render performance | Tempo worklog viewer phase | Date range capped at 31 days in date picker component |

---

## Sources

- Codebase inspection: `settings.store.ts` (v18 persist migration, `dashboardLayout` fields, registry import), `sidebar-items.ts` (`workload` entry, `PM_SIDEBAR_PRESET`), `routes.tsx` (`WorkloadTab` lazy import), `WidgetGrid.tsx` (CSS imports), `registry.ts` (widget definitions), `settings.store.test.ts` (WIDGET_REGISTRY/DEV_DASHBOARD_PRESET imports), `Settings.test.tsx`, `Sidebar.test.tsx`, `WorkloadTab.test.tsx`, `aio/client.ts` (probe pattern reference)
- Tempo Server/DC REST API community: [Atlassian Community — Tempo API confusion](https://community.atlassian.com/forums/Jira-questions/Tempo-API-Documentation-is-Extra-confusing/qaq-p/2650722)
- Tempo worklog retrieval practical guide: [Retrieving Worklogs Using Jira Tempo REST API — Dario Djuric](https://dario-djuric.medium.com/retrieving-worklogs-using-jira-tempo-rest-api-f7a0c77c4832)
- Tempo official migration guide: [REST APIs for Jira Data Center — Tempo Help Center](https://help.tempo.io/cloudmigration/latest/rest-apis-for-jira-server-data-center)
- Tempo Server API documentation index: [tempo.io/server-api-documentation](https://www.tempo.io/server-api-documentation)
- Zustand persist migration patterns: [Persisting store data — Zustand docs](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data)
- JavaScript DST edge cases: [Say Goodbye to JavaScript's DST Date Confusion — DEV Community](https://dev.to/urin/say-goodbye-to-javascripts-dst-date-confusion-24mj)
- Business day vs calendar day pitfalls: [Business Days vs Calendar Days — DEV Community](https://dev.to/work_hau_cb718f47075930f9/business-days-vs-calendar-days-the-date-math-mistake-that-breaks-your-deadlines-174a)

---
*Pitfalls research for: Tempo Timesheets integration + dashboard/workload removal in Tauri 2 / React 18 / Zustand / Vitest stack*
*Researched: 2026-05-20*
