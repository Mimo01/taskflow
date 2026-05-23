# Phase 57: Redesign the AIO Cycles Page - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign `AioProjectOverviewPage.tsx` (the AIO cycles list) to match the real AIO application's layout and data model, using 4 example API responses provided in `/Users/user/Downloads` as the schema source.

Three concrete changes:

1. **Layout: left sidebar folder tree + right cycle list** — Replace the current full-page accordion with a two-panel layout: a left panel renders the full nested folder hierarchy (all levels), clicking a folder loads its cycles in the right panel.
2. **Stats: switch from N+1 run fetches to the summary endpoint** — Use the per-cycle summary API (which returns `totalTests` + `testRunDistribution: { statusID: count }`) instead of fetching all test runs per cycle. The researcher must probe and confirm the status ID → status name mapping (known IDs: 51, 53, 54, 55, 901).
3. **Cycle columns: Key | Name | Owner | Total tests | Progress bar** — Add an owner column (resolved from `ownedByID` via Jira user API) and total test count (from `summary.totalTests`).

No changes to `AioCycleDetailPage`, `AioTestRunDetailPage`, or the AIO service layer endpoints beyond adding new ones for folder tree, count, and summary.

</domain>

<decisions>
## Implementation Decisions

### Layout
- **D-01:** Two-panel layout — left panel = folder tree, right panel = cycle list for the selected folder.
  - Left panel renders the full folder hierarchy at all levels (no depth cap). The `folder` endpoint returns a tree of `{ ID, name, parentID, children[] }` nodes; render it recursively.
  - Right panel shows cycles belonging to the selected folder. The researcher must confirm whether this is a `?folderID=N` filter on the existing `/testcycle` endpoint or a dedicated `/folder/{ID}/testcycle` endpoint.
  - On first load, auto-select the first non-empty folder (or root if all are non-empty). *(Claude's discretion)*
- **D-02:** The left panel shows the cycle count per folder from the `count` endpoint (`{ folderID: count }` map). Display as a small badge next to the folder name (e.g., `"2023 - DONE (3)"`). The `-1` key in the count map represents ungrouped cycles; show as an "Ungrouped" root entry if non-zero.

### Summary API (replacing N+1 run fetches)
- **D-03:** Use the summary endpoint that returns `{ ID, detail: null, summary: { totalTests, testRunDistribution: { statusID: count } } }` per cycle. This is the `paged2` response shape. The researcher must confirm the URL (likely `/project/{projectKey}/testcycle?projection=summary` or a batch POST with IDs from `allIDs`).
- **D-04:** The `paged` (detail) response has an `allIDs` field (array of ALL cycle numeric IDs). This can be used to fetch summaries for all cycles in one shot — pass all IDs to the summary endpoint rather than page-by-page fetching. Researcher must verify whether the summary endpoint accepts an `ids` param.
- **D-05:** Status ID → name mapping: the researcher must probe a AIO status/configuration endpoint or inspect the `testRunDistribution` keys against known run statuses (`PASS`, `FAIL`, `NOT_EXECUTED`, `BLOCKED`). Hardcode the mapping in a new `AIO_STATUS_MAP` constant in `aioUtils.ts` once confirmed. The progress bar continues to use the same green/red/orange/muted color scheme.

### Cycle columns
- **D-06:** Cycle row columns in the right panel: **Key** (monospace) | **Name** (NavLink to cycle detail) | **Owner** (display name) | **Total tests** (from `summary.totalTests`) | **Progress bar** (from `testRunDistribution` after ID mapping).
- **D-07:** Owner resolution — `ownedByID` is a raw Jira username (e.g., `"JIRAUSER23429"`, `"ext94772"`). Fetch display name via Jira user API (`/rest/api/2/user?username={ownedByID}`). Deduplicate: collect unique `ownedByID` values across all cycles in the folder, fire one `useQuery` per unique ID. The researcher should confirm the endpoint accepts `username` param (Jira DC uses `name` not `accountId`).
- **D-08:** Owner loading state: show a skeleton or the raw ID as fallback while the user query resolves. If the user lookup returns 404 or errors, show the raw `ownedByID` string.

### Closed cycle handling
- **D-09:** Show all cycles (open + closed) by default. Add a **"Show closed"** toggle in the right panel header. When off (default), filter out cycles where `detail.isClosed === true`. Toggle state is remembered per session (sessionStorage or URL param — planner picks simplest approach). Selected folder is also persisted the same way.
- **D-10:** Closed cycles that ARE shown get a visual indicator — planner picks (e.g., muted text, "Closed" badge appended after name, or strikethrough on name).

### Claude's Discretion
- Left panel width: follow the visual rhythm of the app — something like `w-56` or `w-64`. Resizable is out of scope.
- Folder tree expand/collapse: all folders start collapsed; the first folder auto-expands on load. Toggling a folder in the left panel also clears the selected folder if it was inside the collapsed one. *(Planner picks the simplest UX.)*
- Progress bar rendering: same `h-1.5 rounded-full overflow-hidden flex` bar from Phase 56, now fed from `testRunDistribution` counts instead of per-cycle run data.
- Whether to use a single `useQuery` for folder tree + one for cycle list + one batch summary query, or separate queries — planner picks the cleanest arrangement consistent with existing AIO query key patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API schema examples (PRIMARY — read before any service code)
- `/Users/user/Downloads/folder` — Real AIO folder tree response: `[ { ID, name, parentID, children[] } ]`. This is the shape to type and fetch. New endpoint — URL unknown, researcher must probe.
- `/Users/user/Downloads/count` — Real AIO folder cycle count map: `{ "folderID": cycleCount }`. Note: `-1` = ungrouped. New endpoint — URL unknown, researcher must probe.
- `/Users/user/Downloads/paged` — Real AIO cycle list with detail: `{ items: [{ ID, jiraProjectID, detail: { key, title, ownedByID, folder, isClosed, ... }, summary: null }], allIDs, startAt, maxResults, isLast }`. Note: `detail.folder` is `null` for all sampled cycles — folder association comes from the folder endpoint, not embedded in cycle detail.
- `/Users/user/Downloads/paged2` — Real AIO cycle summary response: `[ { ID, detail: null, summary: { totalTests, testRunDistribution: { "statusID": count } } } ]`. Status IDs in the sample: `51, 53, 54, 55, 901`. Researcher must resolve these to PASS/FAIL/NOT_EXECUTED/BLOCKED.

### Prior AIO phase contexts
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — `aioFetch()` base paths (`AIO_API_PATH = /rest/aio-tcms-api/1.0`), `['aio', jiraBaseUrl, ...]` query key prefix, credential loading.
- `.planning/phases/52-aio-navigation-project-pages/52-CONTEXT.md` — routing conventions, breadcrumb push pattern.
- `.planning/phases/53-cycle-detail-header-pinning/53-CONTEXT.md` — cycle detail page patterns, pin/unpin.
- `.planning/phases/56-redesign-aio-cycles-page-optimize-aio-loading-performance-ad/56-CONTEXT.md` — `useAioCredentials()` hook, `normalizeStatus`, progress bar color scheme, `<Tabs>` usage pattern. **Read this first** — Phase 56 work is fully merged and the current codebase already has these patterns.

### Files under edit (primary)
- `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` — complete redesign target. Current folder grouping logic (`groupCyclesByFolder`) and `CycleStatsCell` component will be replaced.
- `taskflow/src/services/aio/cycles.ts` — add new fetch functions for: folder tree, folder cycle count, cycle list with detail projection, and cycle summary batch. Do not break existing `fetchAioCycles` — it may still be used by other consumers.
- `taskflow/src/services/aio/types.ts` — add new types: `AioFolder` (tree node), `AioCycleSummary` (per-cycle summary with `testRunDistribution`), `AioCycleDetail` (the full detail wrapper from `paged`).
- `taskflow/src/lib/aioUtils.ts` — add `AIO_STATUS_MAP` constant mapping numeric status IDs to normalized status names once researcher confirms the mapping.

### Jira user lookup
- `taskflow/src/services/jira/users.ts` — `fetchAssignableUsers` uses `?username=` search. A direct user-by-name lookup may need a new function: `GET /rest/api/2/user?username={ownedByID}`. Researcher must confirm.
- `taskflow/src/services/jira/types.ts` — `JiraAssignableUser { displayName, name }`. The `name` field is the Jira DC username — this is what `ownedByID` matches.

### UI primitives (existing, reuse directly)
- `taskflow/src/components/ui/skeleton.tsx` — loading states for folder tree and cycle list.
- `taskflow/src/components/ui/badge.tsx` — cycle count badges on folder labels; "Closed" badge on closed cycle rows.
- `taskflow/src/components/ui/empty-state.tsx` — "No cycles in this folder" state for the right panel.
- `taskflow/src/hooks/useAioCredentials.ts` — shared credential hook (built in Phase 56). All AIO queries gate on `{ token, isLoading }` from this hook.
- `taskflow/src/hooks/useDelayedLoading.ts` — 200ms flicker prevention for folder tree and cycle list loading states.

### Routing (read-only)
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — target of NavLink from cycle rows. Route: `/aio-cycle/:projectKey/:cycleKey`. No changes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAioCredentials()` (`hooks/useAioCredentials.ts`): returns `{ token, isLoading }`. All new AIO queries gate on `!!token && !isLoading`. Built in Phase 56.
- `aioFetch(baseUrl, token, path)` (`services/aio/client.ts`): the shared fetch wrapper. All new endpoints use this.
- `normalizeStatus(status: string)` (`lib/aioUtils.ts`): maps AIO status strings to `'pass' | 'fail' | 'blocked' | 'notRun'`. Needs extension to also handle numeric status IDs via `AIO_STATUS_MAP`.
- `aioCycleStatusBadgeClass(status)` (`lib/statusStyles.ts`): status badge CSS. Reuse for cycle status column.
- `<Skeleton>`, `<Badge>`, `<EmptyState>`, `<NavLink>` — all available and used in existing AIO pages.
- `fetchAioCycles(baseUrl, token, projectKey)` (`services/aio/cycles.ts`): existing paginated cycle fetcher. The new endpoint may replace or supplement it — researcher must clarify if the existing endpoint is the same as `paged` but with different query params.

### Established Patterns
- **Query key prefix:** `['aio', jiraBaseUrl, ...]` — mandatory for all AIO queries (Phase 51). New queries: `['aio', jiraBaseUrl, 'folders', projectKey]`, `['aio', jiraBaseUrl, 'cycle-count', projectKey]`, `['aio', jiraBaseUrl, 'cycle-summaries', projectKey, folderID]`.
- **Credential gate:** `enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey`.
- **useDelayedLoading + skeleton:** all AIO pages use `useDelayedLoading(isLoading)` for 200ms flicker prevention. Apply to both folder tree and cycle list loading states.
- **`aioEnabled` guard:** sidebar and pages are gated on `aioEnabled` from settings store. No change needed — existing guard covers new page.
- **NavLink to cycle detail:** `/aio-cycle/${projectKey}/${cycle.key}`. No change to this pattern.

### Integration Points
- `AioProjectOverviewPage.tsx` is reached via the existing `/aio-project/:projectKey` route. No route changes needed.
- The left-right panel layout fits inside the existing `flex flex-col h-full` page shell — switch to `flex flex-row h-full` with a fixed-width left panel.
- Pinned tab strip: cycles are already pinnable. Pin key format `aio:projectId:cycleId` from Phase 53 is unaffected by this redesign.
- Owner user fetches use Jira auth credentials (`jiraBaseUrl` + `token` from `useAuthStore`) — same pattern as all other Jira service calls.

</code_context>

<specifics>
## Specific Ideas

- The 4 files in `/Users/user/Downloads/` are real API response snapshots from the live AIO instance. The researcher should use them to determine exact endpoint URLs by cross-referencing with browser network logs or AIO API docs. File names (`folder`, `count`, `paged`, `paged2`) are suggestive of the endpoint purpose but not the URL.
- The `allIDs` field in `paged` (array of all numeric cycle IDs) enables a one-shot batch summary fetch — rather than paginating through summaries, pass all IDs at once. The researcher should check if the summary endpoint accepts `?ids=12478,12505,...` or a POST body.
- `detail.folder` is `null` for all 7 cycles in the `paged` sample. This is a significant divergence from the current `AioCycle.folder` string (derived from `raw.testSet`). The researcher must investigate: does folder association only come from the folder endpoint (not embedded in cycle detail), or is there another field in the raw response?
- Owner IDs in the sample: `"JIRAUSER23429"`, `"ext94772"`. These look like Jira DC internal usernames. The `/rest/api/2/user?username=JIRAUSER23429` endpoint likely resolves to `displayName`. Batch-fetch all unique owner IDs once per cycle list load.
- Status IDs in `testRunDistribution`: `53, 54, 55, 901, 51`. From the data: ID `53` has the highest counts (up to 228 in a cycle) — likely `NOT_EXECUTED` since cycles tend to be mostly unexecuted. ID `901` appears alongside `53` in active cycles — possibly `PASS`. IDs `51, 54, 55` have very small counts — possibly `FAIL`, `BLOCKED`, or other statuses. Researcher must confirm from AIO status API or docs.

</specifics>

<deferred>
## Deferred Ideas

- **Resizable left panel** — fixed width is sufficient for v1.8. Drag-to-resize would add complexity.
- **Folder search/filter** — finding a specific folder in a large tree could use a search input; deferred to a future phase if the tree grows unwieldy.
- **Cycle creation from the page** — AIO write actions deferred to AIOWR-02 in REQUIREMENTS.md.
- **Export/download cycle data** — out of scope for v1.8.
- **Pre-loading AIO token into `useAuthStore` at app startup** — deferred from Phase 56 per prior discussion; `useAioCredentials()` hook is the chosen approach.

</deferred>

---

*Phase: 57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real*
*Context gathered: 2026-05-14*
