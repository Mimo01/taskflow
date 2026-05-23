# Phase 53: Cycle Detail + Header Pinning - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full cycle detail page (`/aio-cycle/:projectKey/:cycleKey`) showing: an execution progress bar with pass/fail/blocked/not-run counts, a filterable test run list (test case name, status, last run date), and a deduplicated defects section (if defect data is available inline from the API). Also wire cycle pinning into the existing header tab strip so pinned cycles appear alongside pinned issues, persist across restarts, and can be unpinned from the header.

Phase 52 built the route path and navigation link — Phase 53 implements the route's content and pinning.

</domain>

<decisions>
## Implementation Decisions

### Header Tab Integration (Claude's discretion)
- **D-01:** Extend the existing `PinnedTabStrip` rather than adding a separate strip. All drag/reorder/unpin/ghost infrastructure is reused. Cycle keys (`PROJ-CY-N`) are structurally distinct from issue keys (`PROJ-N`) — detected by `/CY-/` pattern in the key string.
- **D-02:** `usePinnedTabsStore` gains a new persisted field: `pinnedCycleMeta: Record<string, { name: string; projectKey: string }>`. Cycle metadata is stored at pin time (the detail page has both values — no extra API fetch needed). Requires a version bump (currently v0) with migration: `if (version < 1) { s.pinnedCycleMeta = {}; }`.
- **D-03:** `PinnedTabStrip` prop `resolvedIssues` is replaced by a discriminated union map: `resolvedTabs: Map<string, IssueTab | CycleTab>` where `IssueTab = { type: 'issue'; summary: string; issueTypeName: string }` and `CycleTab = { type: 'cycle'; name: string; projectKey: string }`. Tab rendering switches on `type` — cycle tabs show a `FlaskConical` icon + cycle key (font-mono) + cycle name.
- **D-04:** In `main.tsx`: cycle keys skip `useQueries` (metadata read from store, no API call). Issue keys use the existing `useQueries` → `fetchIssueSummary` flow unchanged.
- **D-05:** Active tab detection extended: current URL `/aio-cycle/:projectKey/:cycleKey` → extract `cycleKey` as `activeCycleKey`. The `activeKey` prop passed to `PinnedTabStrip` is `activeIssueKey ?? activeCycleKey` (whichever matches the current route).
- **D-06:** Tab click handler: if key matches `/CY-/` → navigate to `/aio-cycle/${meta.projectKey}/${key}`. Otherwise → existing `handleIssueClick(key, true)`.
- **D-07:** Reordering is free — issue and cycle tabs can be interleaved arbitrarily. No grouping constraint.
- **D-08:** Pin button on cycle detail page: calls both `togglePin(cycleKey)` and, if pinning (not unpinning), `setPinnedCycleMeta(cycleKey, { name: cycle.name, projectKey: cycle.projectKey })`. On unpin (`removePin`), also clear the meta entry.

### Progress Bar Data Source (Claude's discretion)
- **D-09:** Progress bar counts are derived client-side from the test runs already fetched for AIOC-02. After all paginated pages are loaded, reduce over `AioTestRun.status` strings. Zero extra API calls. Progress bar renders after runs load (same timing as the run list — skeleton covers both). No `/summary` or `/detail` endpoint needed.

### Test Run List Data Shape
- **D-10:** Researcher must verify the full `AioTestRun` response shape against AIO REST API docs (link in canonical refs). Expected fields to confirm: test case name (possibly `testCaseName` or equivalent), and a run date field (possibly `executedOn` or `updatedAt`). Update `AioTestRun` in `types.ts` with confirmed additional fields.
- **D-11:** If test case name is NOT a field on `AioTestRun`: fallback is to fetch `/rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testcase` in parallel (already a confirmed endpoint from Phase 51 D-17). Build `Map<testCaseKey, string>` from `AioTestCase[]` and join by key for display. Researcher decides which branch applies based on API docs.
- **D-12:** Status filter chips use normalized display labels — not raw API strings:
  - `NOT_EXECUTED` → `Not Run`
  - `PASS` → `Pass`
  - `FAIL` → `Fail`
  - `BLOCKED` → `Blocked`
  Unknown statuses pass through as-is. Filter logic compares against normalized labels.
- **D-13:** Four filter chips (Not Run / Pass / Fail / Blocked) appear above the run list. Multiple chips can be active simultaneously (OR logic — show runs matching any selected status). Default: all chips active (show all runs).

### Defects Display
- **D-14:** Researcher must verify if defect Jira issue keys are a field on `AioTestRun` (e.g., `defects: string[]` or `bugs: string[]`). Check AIO REST API docs.
  - **If inline (defect keys are a field on the run object):** Proceed. Update `AioTestRun` type. Collect all non-empty defect arrays from failed runs, deduplicate, render as a separate "Defects" section below the run list.
  - **If separate per-run endpoint required:** Descope AIOC-03 entirely from Phase 53. Do not add defect fetching — note in plan that AIOC-03 requires a separate endpoint and belongs in a future phase.
- **D-15:** If defects are inline: deduplicated list of unique Jira issue keys from ALL runs with non-empty defects (not just "FAIL" status — any run that references a defect). Each entry renders as a clickable link navigating to the existing `/issue/:key` route (full-page issue detail). Displayed in a "Defects" section card below the run list table.

### Cycle Detail Page Layout
- **D-16:** Page layout top-to-bottom: (1) page heading with cycle name + status badge + pin/unpin button, (2) progress bar section (pass/fail/blocked/not-run counts + percentage bars), (3) filter chips + test run list, (4) defects section (if applicable). All within a single lazy-loaded route chunk.
- **D-17:** Skeleton: `AioCycleDetailSkeleton.tsx` sibling component, same pattern as `AioCyclesSkeleton.tsx` from Phase 52.
- **D-18:** Pin button label: "Pin cycle" when not pinned, "Unpin cycle" when pinned. Check `usePinnedTabsStore.isPinned(cycleKey)` for current state. Same page, inline button near the heading.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 52 decisions (navigation, routes, cycle list)
- `.planning/phases/52-aio-navigation-project-pages/52-CONTEXT.md` — D-09 (cycle summary endpoint deferred), D-12 (route path `/aio-cycle/:projectKey/:cycleKey` locked), D-14 (routing conventions). **MUST READ** before building the cycle detail route.

### Phase 51 decisions (probe findings, AIO service layer)
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — D-13–D-17: dual base paths, auth scheme, AioCycle type, AioPage<T>, confirmed endpoints. **MUST READ** before writing any AIO service code.

### AIO REST API docs (for researcher: verify AioTestRun field names)
- https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025619567 — Verify: (a) full `AioTestRun` field list (name, date fields), (b) whether defect/bug keys are a field on test runs, (c) `AioTestCase` field names for the fallback join. D-10, D-11, D-14 depend on these docs.

### AIO service layer (existing modules)
- `taskflow/src/services/aio/types.ts` — `AioTestRun`, `AioCycle`, `AioPage<T>`. Update `AioTestRun` with confirmed additional fields.
- `taskflow/src/services/aio/client.ts` — `aioFetch()`, `AIO_API_PATH` constant. Do NOT modify.
- `taskflow/src/services/aio/cycles.ts` — `fetchAioCycles()` (built in Phase 52). Phase 53 adds a `fetchCycleTestRuns()` function (mirrors `fetchAioCycles` pagination loop).
- `taskflow/src/services/aio/index.ts` — Barrel. Add new Phase 53 exports here.

### Pinned tab strip (extend for cycle tabs)
- `taskflow/src/stores/pinned-tabs.store.ts` — Add `pinnedCycleMeta` field. Bump version 0 → 1 with migration.
- `taskflow/src/components/app/PinnedTabStrip.tsx` — Extend `resolvedIssues` prop to discriminated union. Add cycle tab rendering path with `FlaskConical` icon.
- `taskflow/src/main.tsx` — Lines ~140–190: `useQueries` for pinned issues, `resolvedPinnedTabs` map construction. Extend to handle cycle keys. Lines ~269: active key derivation — extend for `/aio-cycle/` URL pattern. Lines ~481–489: PinnedTabStrip render — update prop names.

### Routing
- `taskflow/src/routes/routes.tsx` — `withLazy()` pattern. Add `/aio-cycle/:projectKey/:cycleKey` → `AioCycleDetailPage` (lazy-loaded). Phase 52 may have added a stub — check before adding.

### Existing page patterns to mirror
- `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` — Direct Phase 52 predecessor. Mirror structure for `AioCycleDetailPage.tsx`.
- `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` — Skeleton pattern to extend for `AioCycleDetailSkeleton.tsx`.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.8 — AION-04, AIOC-01, AIOC-02, AIOC-03, AIOP-01, AIOP-02, AIOP-03. Phase 53 scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePinnedTabsStore` (`stores/pinned-tabs.store.ts`): `pinnedKeys`, `togglePin`, `removePin`, `reorder`, `isPinned`. Extend with `pinnedCycleMeta`.
- `PinnedTabStrip` (`components/app/PinnedTabStrip.tsx`): Full drag/reorder/ghost/context-menu UI. Extend rendering to handle `CycleTab` discriminant — minimal change.
- `FlaskConical` icon (lucide-react): Already imported in Sidebar for the AIO nav item (Phase 52). Use as cycle tab icon.
- `fetchAioCycles` (`services/aio/cycles.ts`): Pagination loop pattern to mirror for `fetchCycleTestRuns`.
- `useDelayedLoading` hook: 200ms flicker-prevention. Use in `AioCycleDetailPage`.
- `<EmptyState>` + `<ErrorState>` components: Use unchanged for empty/error states.
- `<Skeleton>` component: Base for `AioCycleDetailSkeleton`.
- `/issue/:key` route: Existing issue detail route — cycle defect links navigate here.

### Established Patterns
- **Page structure:** `useQuery` → `useDelayedLoading` → skeleton / error / empty / data. See `AioProjectOverviewPage.tsx` (Phase 52 direct predecessor).
- **Credential loading:** `readSecret('jira-pat')` + `useAuthStore` for `jiraBaseUrl`.
- **Query key:** `['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]` for the test runs query.
- **Pagination loop:** See `fetchAioCycles` in `cycles.ts`. `fetchCycleTestRuns` mirrors this exactly.
- **Filter chips:** See `QuickFilterChipRow.tsx` for the chip toggle pattern (multi-select, active state).
- **Pinned tab store version migration:** Sequential `if (version < N)` guards — increment to v1.

### Integration Points
- `main.tsx`: Extend `pinnedKeys` split logic, `useQueries` guard, `resolvedPinnedTabs` map, active key derivation, and `PinnedTabStrip` prop. This is the central wiring file.
- `routes.tsx`: Add `AioCycleDetailPage` lazy import + route entry.
- `aio/types.ts`: Update `AioTestRun` interface with fields confirmed by researcher.
- `aio/index.ts`: Export `fetchCycleTestRuns` (and optionally `fetchCycleTestCases` if the name-join fallback is needed).

</code_context>

<specifics>
## Specific Ideas

- Cycle tab in the strip shows: `FlaskConical` icon (same as sidebar AIO item) + cycle key in `font-mono text-[9px]` + cycle name truncated. Same two-line layout as issue tabs (key line + name line).
- Pin button placement: near the cycle name heading, same row. Label toggles between "Pin cycle" and "Unpin cycle" based on `isPinned(cycleKey)`.
- Progress bar design: four colored segments (green = Pass, red = Fail, orange = Blocked, gray = Not Run) with count + percentage labels. Same visual language as existing status badges in the codebase.
- Status filter chips: use the same chip style as `QuickFilterChipRow`. Four chips. Multiple active (OR logic). Toggle individual chips.
- If AIOC-03 is descoped (defects require separate endpoint): note it explicitly in the plan as a deferred item with the reason.

</specifics>

<deferred>
## Deferred Ideas

- **Per-run defect fetch (if not inline):** AIOC-03 descoped to a future phase if defects require a separate per-run endpoint. Not worth the N+1 complexity when a single-field approach isn't available.
- **Cycle burndown / trend charts:** AIOCH-01/AIOCH-02 — explicitly out of scope per REQUIREMENTS.md (AIO REST API does not expose time-series data).
- **Real-time status updates on cycle detail:** Not planned — no polling for AIO pages in this milestone.

</deferred>

---

*Phase: 53-Cycle Detail + Header Pinning*
*Context gathered: 2026-05-13*
