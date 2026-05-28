# Phase 72: Workflow Transitions via GreenHopper - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the per-issue REST `/transitions` path with a **cached per-project workflow map** sourced from `GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=...` (typed fetcher already exists from Phase 71: `fetchGhTransitions`). Wire the cache into all four current consumer call sites and delete the legacy REST path.

**In scope:**
- Cache layer + resolver hook for GH transitions, keyed by `projectId × issueTypeId → workflow → GhTransition[]`.
- Status-map fetcher (one extra session-scoped Jira REST call) used to synthesize legacy `JiraTransition.to.{name, statusCategory}` for callers that read those fields.
- Swap the four legacy `fetchTransitions(...)` call sites: `StatusPopover.tsx`, `SprintBoardTab.tsx`, `BulkActionBar.tsx`, `QuickCreateInput.tsx`.
- Manual refresh action on the sprint-board toolbar (invalidate + refetch + toast).
- Delete `src/services/jira/transitions.ts` `fetchTransitions` + re-export from `jira.ts`.

**Out of scope:**
- Caching `allData.json` / `data.json` / `details.json` (Phases 73-75).
- Replacing `postTransition` (the POST path is still REST; only the GET path moves to GH).
- Changing how transition selection is rendered (UI shape unchanged from user perspective).
- New refresh affordances beyond the single sprint-board action.

</domain>

<decisions>
## Implementation Decisions

### Cache Storage
- **D-01:** **React Query** holds the cache. `useQuery({ queryKey: ['gh-transitions', projectId], queryFn: () => fetchGhTransitions(baseUrl, token, projectId), staleTime: Infinity, gcTime: Infinity })`. The cache is session-scoped (cleared on page reload, satisfying "refresh on session start"). Manual refresh = `queryClient.invalidateQueries({ queryKey: ['gh-transitions', projectId] })`.
- **D-01a:** Imperative call sites (`BulkActionBar` action handler) read via `queryClient.ensureQueryData(...)` — fetches on miss, returns cached value on hit, no hook required.

### Resolver Shape (Adapter at the Cache Boundary)
- **D-02:** The public resolver returns **`JiraTransition[]`** (the existing legacy shape from `src/services/jira.ts:183-191`). It synthesizes `to.id`, `to.name`, and `to.statusCategory` from a status-id map (D-06), and uses `GhTransition.transitionId` → `JiraTransition.id` (stringified) and `GhTransition.name` → `JiraTransition.name`. This keeps the four call sites' rendering code (`transition.to.name`, `transition.to.statusCategory?.key`) unchanged. Mirrors Phase 71 D-01's "JiraIssue-compatible superset" philosophy.
- **D-02a:** No `__gh` escape hatch — GH-only flags (`hasScreen`, `hasConditions`, `isGlobal`, `isInitial`, `fromStatusId`) are unused by any current call site. If a future phase needs them, it can extend the adapter then. (YAGNI.)

### Lookup Contract (Caller API)
- **D-03:** Public exports added to `src/services/jira.ts` (re-exported from `services/jira/greenhopper/index.ts`):
  - `useGhTransitions(projectId: number, issueTypeId: string): { data: JiraTransition[] | undefined, isLoading, error, refetch }` — React hook for the three component call sites.
  - `getGhTransitions(queryClient, baseUrl, token, projectId: number, issueTypeId: string): Promise<JiraTransition[]>` — imperative helper for `BulkActionBar`. Uses `ensureQueryData` internally.
  - `invalidateGhTransitions(queryClient, projectId?: number): void` — invalidates one project or all projects. Used by the toolbar refresh action.
- **D-03a:** Indexing logic (lookup from the raw `GhTransitionsResponse` envelope): `workflowName = response.projectAndIssueTypeToWorkflow[String(projectId)]?.[issueTypeId]`; `ghTransitions = response.workflowToTransitions[workflowName] ?? []`. If `workflowName` is undefined → return `[]` and emit `console.warn` **once per unique `(projectId, issueTypeId)` per session** (matches Phase 71 D-07 warn-once pattern).

### Multi-Project Handling
- **D-04:** **Per-`projectId` cache entries with no eviction.** `gcTime: Infinity`. Workflow envelopes are small (low-KB) and `BulkActionBar` can legitimately operate on issues from multiple projects in one flow. React Query's natural key-based caching handles this without bespoke eviction logic.

### projectId / issueTypeId Source at Call Sites
- **D-05:** Pre-cutover (Phase 72), the four call sites read `projectId` and `issueTypeId` from the existing REST `JiraIssue` shape:
  - `issue.fields.project.id` → `projectId` (string in REST; cast `Number(...)` before passing).
  - `issue.fields.issuetype.id` → `issueTypeId` (string).
  - For `QuickCreateInput`, projectId comes from the create context (already known); `issueTypeId` from the type picker; result issue's key is consumed only after POST.
- **D-05a:** This keeps Phase 72 a pure swap with no GH-adoption at the call sites. Phases 73-75 will swap to GH-native `projectId`/`typeId` as those surfaces flip to GH issues.

### Status-Name / Category Resolution
- **D-06:** Fetch the global Jira status list once per session from `GET /rest/api/2/status` (returns `[{id, name, statusCategory: {id, key, name}}]`). Cache via React Query under `queryKey: ['jira-statuses']`, `staleTime: Infinity`, `gcTime: Infinity`. Resolver builds a `Map<statusId, {name, statusCategory}>` on first read. Used by **D-02** to synthesize `to.name` and `to.statusCategory`.
- **D-06a:** New module: `src/services/jira/statuses.ts` (legacy-style sibling of `transitions.ts`), public surface re-exported through `jira.ts`. Fetcher: `fetchAllJiraStatuses(baseUrl, token): Promise<JiraStatus[]>`.
- **D-06b:** Same warn-once-on-miss pattern as D-03a: if `toStatusId` is not in the map, synthesize `{id: String(toStatusId), name: \`Status ${toStatusId}\`, statusCategory: { key: 'indeterminate', id: 0, name: 'Unknown' }}` and warn once per missing id.

### Manual Refresh UX
- **D-07:** Action lives on the **sprint-board toolbar** as a menu item labeled **"Reload workflow transitions"**. On click: invalidate `['gh-transitions', currentProjectId]` AND `['jira-statuses']`, refetch both, toast `"Workflow transitions reloaded"` on success / `"Failed to reload workflow"` on error.
- **D-07a:** Action is visible whenever a sprint board is shown. Not bundled into a board-wide reload (Phase 73 may introduce that; this phase ships its own focused action).
- **D-07b:** No keyboard shortcut, no settings-page duplicate. One discoverable trigger.

### Cutover
- **D-08:** Hard cutover in a single phase per the milestone's `GH-CUT-01` policy. The four call sites are swapped, `fetchTransitions` in `src/services/jira/transitions.ts` (the GET, not `postTransition`) is deleted along with its re-export from `jira.ts`. `postTransition` stays.
- **D-08a:** Tests for the four call sites get their `fetchTransitions` mocks replaced with React Query test wrappers or `getGhTransitions`/`useGhTransitions` mocks; remove now-dead mocks.

### Claude's Discretion
The user said "you decide" on all four selected areas. The decisions above are anchored to:
- The Phase 71 hard-cutover-per-surface policy (D-01 adapter superset philosophy).
- The existing React Query usage in `StatusPopover.tsx:48` (`['transitions', issueKey]`) — the migration is a queryKey swap, not a paradigm shift.
- The legacy `JiraTransition` shape at `jira.ts:183-191` matching what the four call sites read today.
- The `[[project_jira_ts_dual_file]]` memory note: re-export the new surface through `jira.ts` (not just `jira/`).

The planner has flexibility on:
- Internal naming inside `greenhopper/transitions.ts` (e.g., the indexing helper could be `indexTransitions(...)` or inlined into the hook).
- Whether `useGhTransitions` accepts the issue object and pulls `projectId`/`typeId` itself, or takes the IDs directly. The decision above is "takes IDs"; the planner may pivot to an `(issue: JiraIssue)` overload if it reads cleaner at call sites.
- Whether `invalidateGhTransitions` invalidates `['jira-statuses']` too as a side effect, or whether the toolbar action does both invalidations explicitly. The decision above is "explicit at the toolbar".
- Whether `fetchAllJiraStatuses` lives in `src/services/jira/statuses.ts` (D-06a) or inside `services/jira/greenhopper/statusResolver.ts`. The decision above is "legacy sibling, re-exported"; the planner may prefer the GH-folder location if it keeps the dependency direction cleaner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & API surface
- `.planning/research/GREENHOPPER-API.md` §"transitions.json" — Endpoint contract; envelope shape (`projectAndIssueTypeToWorkflow`, `workflowToTransitions`); behaviour notes.
- `.planning/REQUIREMENTS.md` — `GH-TRANS-01`, `GH-TRANS-02`, `GH-TRANS-03`, `GH-CUT-01`.
- `.planning/ROADMAP.md` §"v1.11 GreenHopper API Migration" Phase 72 — Goal, requirements, success criteria.
- `.planning/phases/71-greenhopper-adapter-foundation/71-CONTEXT.md` — Carried decisions (adapter shape, warn-once pattern, re-export through `jira.ts`).

### Existing code to read
- `taskflow/src/services/jira/greenhopper/transitions.ts` — Fetcher (`fetchGhTransitions`), already shipped in Phase 71.
- `taskflow/src/services/jira/greenhopper/types.ts:170-195` — `GhTransition` and `GhTransitionsResponse` interfaces.
- `taskflow/src/services/jira.ts:183-191` — `JiraTransition` shape the resolver must produce.
- `taskflow/src/services/jira.ts:678-712` — Legacy `fetchTransitions` (to be deleted).
- `taskflow/src/services/jira/transitions.ts:12-50` — The module the GET fetcher lives in (the `postTransition` POST path stays; only the GET fetcher leaves).
- `taskflow/src/routes/dashboard/StatusPopover.tsx:17,48-52` — Call site #1 (React hook, uses `useQuery(['transitions', issueKey])`).
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx:36,737` — Call site #2 (imperative `queryFn`).
- `taskflow/src/routes/dashboard/BulkActionBar.tsx:20,161` — Call site #3 (imperative inside an action handler; will use `getGhTransitions` / `queryClient.ensureQueryData`).
- `taskflow/src/routes/dashboard/QuickCreateInput.tsx:17,51` — Call site #4 (imperative, post-create flow).

### Project conventions
- Memory `[[project_jira_ts_dual_file]]` — All 60 imports use legacy `jira.ts`, not `jira/` modules. The new GH-transitions public surface must be re-exported through `jira.ts`.
- Memory `[[project_biome_state]]` — 0 errors, 0 warnings baseline; do not introduce a11y or lint regressions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`fetchGhTransitions(baseUrl, token, projectId)`** — Already shipped Phase 71; returns the typed `GhTransitionsResponse` envelope. This phase wraps it in cache + indexing + adapter.
- **React Query `useQuery` pattern** — `StatusPopover.tsx:48-52` shows the existing per-issue pattern; D-01 mirrors it with the project-scoped queryKey.
- **`apiFetch('jira', url, init, operation)`** — Used by both `services/jira/transitions.ts` (legacy) and `services/jira/greenhopper/client.ts` (Phase 71). New `fetchAllJiraStatuses` (D-06a) uses it directly.
- **`ApiError` pattern** — Phase 71 `transitions.ts` propagates `ApiError` for 401/403 and wraps network failures; reuse for the new statuses fetcher.

### Established Patterns
- **`useQuery` + `staleTime: Infinity` for session-scoped caches** — Already used elsewhere in the codebase (verify in planner research).
- **`queryClient.invalidateQueries` for manual refresh** — Standard React Query refresh idiom.
- **Warn-once-per-unique-key on entity-map miss** — Phase 71 D-07; reused for transitions miss (D-03a) and status-id miss (D-06b).

### Integration Points
- `src/services/jira.ts` — Re-export `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`, `fetchAllJiraStatuses`.
- `src/services/jira/greenhopper/index.ts` — Source exports for the GH-side surface (D-03).
- `src/services/jira/statuses.ts` — New module (D-06a).
- Sprint-board toolbar component — Add the "Reload workflow transitions" menu item (D-07). Planner should identify the exact toolbar host (likely `SprintBoardTab.tsx` or a sibling header component).

</code_context>

<specifics>
## Specific Ideas

- Network-log verification (criterion #2: "no per-issue REST `/transitions` call in the network log") must be checked during Phase 72 verification — open the sprint board, change a status, confirm zero `/rest/api/2/issue/*/transitions` GETs but one `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N` per project encountered (or zero on cache hit).
- The warn-once pattern (D-03a, D-06b) is the same mechanism — planner may factor a tiny `warnOnce(key)` helper shared between this phase and Phase 71's entity-map resolver if both live in the GH folder.

</specifics>

<deferred>
## Deferred Ideas

- **Bundled board-wide reload** — Phase 73 (`Sprint Board on allData.json`) may introduce a single "reload board" action that bundles transitions + allData + statuses invalidations. Phase 72 ships its own focused action; Phase 73 can subsume it.
- **`postTransition` migration to GH** — Out of scope. The GreenHopper API used for transitions only covers the GET; the POST stays on REST `/rest/api/2/issue/{key}/transitions`.
- **GH-only transition flags (`hasScreen`, `hasConditions`, `isGlobal`, `isInitial`, `fromStatusId`)** — Not exposed in Phase 72. If a future phase needs screen-aware transition UX, the adapter can be extended then.
- **Performance verification (request counts before/after)** — Per `GH-CUT-02`, recorded in the verification artifact of the final phase of the milestone, not here.
- **Per-project Jira REST `/rest/api/2/project/{id}/statuses` fallback** — If the global `/rest/api/2/status` proves insufficient (e.g., heavily customized workflows with project-scoped statuses), fall back to per-project. Not anticipated; noted for the planner if research surfaces evidence.

</deferred>

---

*Phase: 72-workflow-transitions-via-greenhopper*
*Context gathered: 2026-05-28*
