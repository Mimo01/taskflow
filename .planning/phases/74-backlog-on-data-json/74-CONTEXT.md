# Phase 74: Backlog on `data.json` - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `BacklogPage.tsx`'s three-query data layer (`fetchSprintList`, `fetchBacklogSprintStories`, `fetchBacklogIssues`) with a **single `useQuery` against `fetchBacklogData(boardId)`** (shipped Phase 71). Derive both backlog (unassigned) and active+future sprint sections from one GreenHopper `data.json` payload — which carries `issues[]`, `sprints[]` (with `issuesIds[]` for membership), and `entityData.{statuses,priorities,types,epics}` in the same response. Preserve every existing feature (move-to-sprint, create story, drag-to-rank, epic / label / assignee filters, virtualized rendering) using REST mutations against the GH cache. Hard cutover per `GH-CUT-01`.

**In scope:**
- New cache layer + `useGhBacklogData(boardId)` React Query hook (key: `['gh-backlog', boardId]`), with `STALE_TIME_MS = 30s`. No polling — backlog is opened-on-demand, not a live view.
- Public exports added to `src/services/jira.ts` (re-exported from `services/jira/greenhopper/index.ts`): `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData`.
- Rewrite `BacklogPage.tsx` data layer: replace three queries with one; derive `sprints[]` (active+future sections with empty-sprint support via `data.sprints[]`), `backlog[]` (issues not referenced by any sprint's `issuesIds[]`), `entityMaps` (from `data.entityData`) — all from one payload.
- Adapter pass at the cache boundary (or `useMemo` over `data.issues`) producing JiraIssue-compatible items via the existing Phase 71 adapter. Adapter synthesizes assignee (from `assignee`/`assigneeName`/`avatarUrl`), story points (from `estimateStatistic.statFieldValue.value`), status/type/epic via `entityData` resolvers.
- New "Reload backlog" toolbar action: invalidates `['gh-backlog', boardId]` + `['jira-epics-basic', projectKey]` + `['jira-statuses']`; replaces the existing per-section `refetchBacklog` / `refetchStories` ad-hoc reloads.
- Sidebar prefetch swap: `Sidebar.tsx:191/213/230` paths (which currently warm `fetchBacklogIssues` + `fetchSprintList` + `fetchBacklogSprintStories`) become a single `getGhBacklogData(boardId)` prefetch so the warm cache matches what the page reads.
- Mutations stay REST and invalidate the new GH cache key: existing move-to-sprint, create story, rank/reorder handlers in `BacklogPage.tsx` keep their existing POST paths; their `queryClient.invalidateQueries` calls swap from `['jira-backlog-issues']` / `['jira-backlog-sprint-stories']` to `['gh-backlog', boardId]`.
- Delete board-only legacy fetchers: `fetchBacklogIssues`, `fetchBacklogSprintStories`, and `fetchBacklogView` (if planner confirms zero callers) plus their re-exports from `jira.ts`. **Keep** `fetchSprintList` — still used by `FieldsSection.tsx` (issue-detail sprint picker).

**Out of scope:**
- Caching `details.json` (Phase 75).
- GH-side mutation endpoints (move/rank/create POSTs) — mutations stay REST per Phase 72 D-08 precedent. Investigating GH alternatives is a follow-on phase if needed.
- Label filtering parity — `GhIssue` has no `labels[]` field. Accept reduced filter fidelity (see D-05 + deferred). Probing for hidden label data is deferred to a future polish phase.
- Subtask grouping on backlog — backlog only renders stories (issuetype != Sub-task in current JQL). `GhIssue` also has no `subtasks[]`. No change in behavior; subtask count chip drops if present.
- Performance verification with before/after request counts — recorded in the verification artifact of the final phase per `GH-CUT-02`.
- Sidebar's separate paths beyond the prefetch swap (Sidebar already proven Phase 73 pattern).

</domain>

<decisions>
## Implementation Decisions

### Scope of the Swap
- **D-01:** **Full page rewrite onto `data.json`.** One `useGhBacklogData(boardId)` call replaces all three current queries (`jira-sprint-list`, `jira-backlog-sprint-stories`, `jira-backlog-issues`). Sprint sections derived from `data.sprints[]` (full sprint metadata including empty sprints) and `data.sprints[i].issuesIds[]` (membership). Backlog = issues whose `id` does not appear in any sprint's `issuesIds[]`. Single network request satisfies `GH-BACKLOG-01` literally.
- **D-01a:** Sprint ordering follows `data.sprints[]` array order, which matches Jira's canonical board order (same source `fetchSprintList` used). Filter sprints by `state === 'ACTIVE' | 'FUTURE'` for display sections. Closed sprints in `data.sprints[]` are ignored.

### Cache & Hook Shape (carries forward Phases 72/73 D-01 / D-02 patterns)
- **D-02:** **React Query** holds the backlog cache. `useQuery({ queryKey: ['gh-backlog', boardId], queryFn: () => fetchBacklogData(baseUrl, token, boardId), staleTime: STALE_TIME_MS, enabled: isActive && !!boardId && !!baseUrl && !!token })`. No `refetchInterval` (backlog is opened-on-demand; consistent with current page's lack of polling — only sprint-board polls today).
- **D-03:** Public exports added to `src/services/jira.ts` (re-exported from `services/jira/greenhopper/index.ts`):
  - `useGhBacklogData(boardId: number): { data, isLoading, isFetching, error, dataUpdatedAt, refetch }` — React hook for `BacklogPage`.
  - `getGhBacklogData(queryClient, baseUrl, token, boardId): Promise<GhBacklogResponse>` — imperative for Sidebar prefetch warm; uses `ensureQueryData`.
  - `invalidateGhBacklogData(queryClient, boardId?: number): void` — invalidates one board or all boards; used by mutations + the "Reload backlog" action.

### Entity-Map + Sprint-Grouping Source
- **D-04:** **Entity maps come from the same `data.json` payload.** The fixture (`__fixtures__/data.real.json`) confirms `data.entityData.{statuses,priorities,types,epics}` is present, contradicting the original research note in `GREENHOPPER-API.md §"data.json"` (which described only `{ issues: Issue[] }`). The adapter consumes these entity maps just like the Phase 73 allData path. No separate `['gh-all-data', boardId]` warm-up is required for backlog open.
- **D-04a:** **Type-level correction needed.** `services/jira/greenhopper/types.ts:160-166` declares `GhBacklogResponse = { issues: GhIssue[] }` and explicitly comments "does NOT carry entity maps". This is wrong per the real fixture. The planner/executor must extend `GhBacklogResponse` to include `entityData`, `sprints[]` (with full metadata + `issuesIds[]`), `rankCustomFieldId`, `projects`, `versionData`, `canCreateIssue`, `canManageSprints`, `cardColorStrategy`, `emptyFilterBoard`, `supportsPages`, `hasBulkChangePermission`, `issueArchivingEnabled`. Re-derive types from the fixture; do not trust GREENHOPPER-API.md for this endpoint.
- **D-04b:** Sprint membership is via `data.sprints[i].issuesIds: number[]` (array of issue numeric IDs), NOT via per-issue `sprintId` / `sprint` field (those fields are NOT present on `GhIssue` in `data.json`, unlike the Agile board `fields.sprint` pattern). Build a reverse index `issueId → sprintId` in the adapter pass so each issue gets `fields.sprint = { id }` for downstream grouping code that expects the Agile-shaped sprint object.

### Field Gaps in GhIssue (Adapter Synthesis)
- **D-05:** **Adapter synthesizes what it can; accept reduced filter fidelity for the rest.** Adapter maps `GhIssue → JiraIssue` with:
  - **Assignee:** synthesize `fields.assignee = { name: assignee, displayName: assigneeName, avatarUrls: { '48x48': avatarUrl } }` when `assignee` is present.
  - **Story points:** read `estimateStatistic.statFieldValue.value` and write to `fields[storyPointsFieldKey]` (key resolved from `useSettingsStore` like today).
  - **Status:** resolve via `entityData.statuses[statusId]` (already exposed by Phase 71 `resolveStatus`).
  - **Type:** resolve via `entityData.types[typeId]` (Phase 71 `resolveType`).
  - **Epic:** resolve via `entityData.epics[epicId]` — `epic` field on `GhIssue` already carries the parent epic key (e.g. `"PROJ-178"`); planner verifies Phase 71 adapter handles this.
  - **Priority:** resolve via `entityData.priorities[priorityId]`.
- **D-05a:** **Label filter loses fidelity in this phase.** `GhIssue` has no `labels[]` field. The current backlog filter-by-label chip / dropdown either: (a) hides the label filter UI on the backlog page entirely, or (b) shows it but with no options (degraded). Planner picks (a) for cleanness. Captured as a known UX delta — see Deferred Ideas.
- **D-05b:** **Subtasks chip drops** if currently rendered on backlog rows. `GhIssue` has no `subtasks[]`. Subtask counts on backlog cards were already a weak surface (backlog stories don't usually surface subtask state). Acceptable loss; surface in DISCUSSION-LOG.md so UAT can flag if it matters.
- **D-05c:** **`flagged` field** — `GhIssue` doesn't expose the `customfield_10021` style flag. If the backlog renders flagged indicators, planner checks whether the GH `color` field (hex string in fixture, e.g. `"#33db23"`) carries flagged semantics, or whether flagged is implicit in some other field. If neither, drop the flagged indicator on backlog rows (defer).

### Mutations (Move-to-Sprint, Create Story, Rank)
- **D-06:** **Keep existing REST mutations** — mirrors Phase 72 D-08 (`postTransition` stays REST) and Phase 73 pattern. Move-to-sprint POST, create-story POST, and rank/reorder PUT handlers in `BacklogPage.tsx` keep their existing REST paths. Only the cache invalidation changes: replace `queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] })` / `['jira-backlog-sprint-stories']` with `invalidateGhBacklogData(queryClient, boardId)`. Investigating GH-side mutation endpoints is deferred.
- **D-06a:** Optimistic updates on the new GH cache: planner reviews whether existing mutation handlers do optimistic updates on the REST queries and ports the same pattern onto `['gh-backlog', boardId]`. The cache shape changes (now a single `GhBacklogResponse`), so optimistic update logic must mutate `data.issues[]` + `data.sprints[i].issuesIds[]` instead of two separate query caches.

### Refresh & Reload Action
- **D-07:** **Bundled "Reload backlog" toolbar action** parallel to Phase 73's "Reload board". On click: invalidate `['gh-backlog', boardId]` + `['jira-epics-basic', projectKey]` + `['jira-statuses']`; refetch; toast `"Backlog reloaded"` on success / `"Failed to reload backlog"` on error.
- **D-07a:** Remove the per-section ad-hoc `refetchBacklog` / `refetchStories` callbacks now that one cache key drives both sections. Existing toolbar refresh buttons (if any) collapse into the single "Reload backlog" control.
- **D-07b:** `STALE_TIME_MS = 30s` reused from `lib/query-constants.ts` (matches current backlog staleTime; no change).

### Sidebar Prefetch Warm
- **D-08:** `Sidebar.tsx:191/213/230` prefetch (currently three calls: `fetchBacklogIssues` + `fetchSprintList` + `fetchBacklogSprintStories`) collapses to ONE: `getGhBacklogData(boardId)`. The warmed cache key matches the key `BacklogPage` reads. Net Sidebar prefetch cost drops from 3+ requests to 1.
- **D-08a:** Sidebar prefetch needs `boardId`. Reuse the existing `useBoardId` hook or its underlying lookup. If `boardId` is not yet known at Sidebar mount, skip the prefetch (don't block sidebar render). Same pattern as Phase 73 D-08a.

### Legacy Cleanup Scope
- **D-09:** **Delete** (no remaining callers after this phase):
  - `fetchBacklogIssues` (`services/jira/backlog.ts`) — only callers are `BacklogPage.tsx` and `Sidebar.tsx`, both swap in this phase.
  - `fetchBacklogSprintStories` (`services/jira/backlog.ts`) — same call sites.
  - `fetchBacklogView` — planner runs a final grep; if zero non-test callers, delete from `services/jira/backlog.ts` AND `services/jira.ts:2177` (duplicate definition in legacy dual file; both must go per `[[project_jira_ts_dual_file]]`).
  - Their re-exports from `src/services/jira.ts` (lines ~2048, ~2177 — planner verifies exact lines).
  - Query keys `['jira-backlog-issues', ...]` and `['jira-backlog-sprint-stories', ...]` — remove from BacklogPage + all invalidation call sites.
- **D-09a:** **Keep** (used elsewhere):
  - `fetchSprintList` — still consumed by `FieldsSection.tsx:32,153` (issue-detail sprint picker) and `Sidebar.tsx`. Sidebar swaps to `getGhBacklogData`, but `FieldsSection.tsx` keeps it. `data.sprints[]` is available there too but issue-detail is Phase 75's scope, not this one.
  - `fetchProjectStatuses`, `fetchEpicsBasic` — shared with EpicsPage / SprintBoardTab / Sidebar. Backlog stops calling them directly (entity maps now from `data.json`), but the modules stay.
- **D-09b:** `jira.ts` dual-file: every new symbol (`useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData`) MUST be re-exported through `src/services/jira.ts` per memory `[[project_jira_ts_dual_file]]`. Importers in `BacklogPage.tsx` and `Sidebar.tsx` use `@/services/jira`, not `@/services/jira/greenhopper`.

### Claude's Discretion
The planner has flexibility on:
- Whether `useGhBacklogData` does its own adapter pass internally (returning `{ backlog: JiraIssue[], sprints: Array<{sprint, issues}>, entityMaps }`) or returns the raw envelope and lets `BacklogPage` adapt via `useMemo`. D-02 leans toward returning the raw envelope (parity with Phase 73 D-01 hook shape), but the planner may pivot to a derived shape if the call-site `useMemo` chain becomes verbose given how many derived structures BacklogPage needs (sprint sections, backlog list, filter dropdown options, sprint ordering).
- Whether to factor a shared `useReloadBacklog(boardId, projectKey)` hook for the toolbar action, or inline `invalidateQueries` in the action handler.
- Whether to extend the Phase 71 adapter or write a backlog-specific adapter variant. The Phase 73 adapter already handles `entityData` resolution; if `GhIssue` (backlog) is a strict subset of `GhBoardIssue` (board) minus `timeInColumn`/`parentId`, the existing adapter should work as-is once `D-04a` widens `GhBacklogResponse` to carry `entityData`.
- Whether to also display the closed/completed sprints from `data.sprints[]` as a collapsed section, or keep the current active+future-only behavior. Default: keep current behavior; closed sprints stay hidden.
- Exact placement of the "Reload backlog" toolbar control — mirror the SprintBoardTab placement chosen in Phase 73.
- Whether to drop `flagged` from backlog rows in this phase or chase the field via a secondary REST query.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/REQUIREMENTS.md` — `GH-BACKLOG-01`, `GH-BACKLOG-02`, `GH-CUT-01`, `GH-CUT-02`.
- `.planning/ROADMAP.md` §"v1.11 GreenHopper API Migration" Phase 74 — Goal, requirements, success criteria.
- `.planning/research/GREENHOPPER-API.md` §"data.json — Backlog / Flat Issue List" — Endpoint URL and base `Issue` shape. **WARNING:** the response shape documented here is INCOMPLETE (says `{ issues: Issue[] }` only). The real fixture (`taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json`) carries `entityData`, `sprints[]`, `rankCustomFieldId`, `projects`, `versionData`, and more. Trust the fixture over the doc for this phase.
- `.planning/phases/71-greenhopper-adapter-foundation/71-CONTEXT.md` — Adapter philosophy (JiraIssue-compatible superset), entity-map resolvers, warn-once pattern.
- `.planning/phases/72-workflow-transitions-via-greenhopper/72-CONTEXT.md` — Carried decisions (React Query cache key shape, `jira.ts` re-export rule, hard cutover policy, mutations stay REST per D-08).
- `.planning/phases/73-sprint-board-on-alldata-json/73-CONTEXT.md` — Direct parent pattern: hook shape, adapter at cache boundary, "Reload board" bundle action, Sidebar prefetch swap, legacy cleanup scope. Phase 74 mirrors this pattern for backlog.

### Existing code the planner / executor MUST read
- `taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json` — **AUTHORITATIVE** response shape for `data.json`. Use this to derive the correct `GhBacklogResponse` TypeScript shape (D-04a).
- `taskflow/src/services/jira/greenhopper/data.ts` — Fetcher (`fetchBacklogData`), shipped Phase 71. Reuse, do not duplicate.
- `taskflow/src/services/jira/greenhopper/types.ts:160-166` — `GhBacklogResponse` declaration that needs widening (D-04a). Outdated comment "does NOT carry entity maps" is wrong per fixture.
- `taskflow/src/services/jira/greenhopper/adapter.ts` — Phase 71 JiraIssue adapter. Reuse for `GhIssue → JiraIssue` mapping (D-05).
- `taskflow/src/services/jira/greenhopper/entityMaps.ts` — Resolvers (`resolveStatus`, `resolvePriority`, `resolveType`, `resolveEpic`) used by the adapter against `data.entityData`.
- `taskflow/src/services/jira/greenhopper/warnOnce.ts` — Shared `warnOnce(key)` helper, used by adapter on entity-map / lookup misses.
- `taskflow/src/services/jira/greenhopper/index.ts` — Add `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData` exports here.
- `taskflow/src/services/jira.ts` — Public re-export surface (memory `[[project_jira_ts_dual_file]]` — ALL 60 imports use legacy `jira.ts`). Add the three new GH symbols; delete `fetchBacklogIssues`, `fetchBacklogSprintStories`, and possibly `fetchBacklogView` re-exports.
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — The rewrite target. Read lines 200–350 (auth + queries 1/2/3), 590–800 (mutation handlers + invalidations), and the filter-dropdown logic for epic/label/assignee chips.
- `taskflow/src/services/jira/backlog.ts` — Source of `fetchBacklogIssues` (lines 20-72), `fetchSprintList` (83-118, KEEP), `fetchBacklogSprintStories` (132-175), `fetchBacklogView` (195-364). Delete `fetchBacklogIssues`/`fetchBacklogSprintStories`/`fetchBacklogView` once swapped.
- `taskflow/src/components/app/Sidebar.tsx:39-41, 191, 213, 230` — Prefetch warm to collapse (D-08): three prefetch calls become one `getGhBacklogData(boardId)`.
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:32, 153` — `fetchSprintList` caller. Stays untouched (D-09a).
- `taskflow/src/lib/query-constants.ts` — `STALE_TIME_MS` (D-07b reuses; do not modify).
- `taskflow/src/services/jira/types.ts` — `JiraIssue`, `JiraActiveSprint`, `BacklogViewData` interfaces. Planner verifies `BacklogViewData` consumers; if BacklogPage was its only consumer, the type can be removed alongside `fetchBacklogView`.

### Project conventions
- Memory `[[project_jira_ts_dual_file]]` — Re-export new public surface through `jira.ts`. ALL 60 imports use the legacy file.
- Memory `[[project_biome_state]]` — 0 errors, 0 warnings baseline; no lint/a11y regressions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`fetchBacklogData(baseUrl, token, boardId)`** — Already shipped Phase 71; returns typed `GhBacklogResponse` (type needs widening per D-04a). This phase wraps it in `useGhBacklogData` + adapter.
- **Phase 71 JiraIssue adapter (`adapter.ts`)** — Already produces JiraIssue-compatible items from GhIssue + entity maps. Should work as-is once `D-04a` confirms `GhIssue` (backlog) is a strict subset of `GhBoardIssue` (board) minus `timeInColumn`/`parentId`.
- **`entityMaps.ts`** — Resolves `statusId/typeId/priorityId/epicId → entity`. Already used by Phase 73 against `allData.entityData`; works identically against `data.entityData` (D-04).
- **`warnOnce` helper** — Phase 71; reused by adapter on lookup misses.
- **Phase 73 `useGhAllData` hook shape** — Phase 74 mirrors it almost exactly, with `useGhBacklogData(boardId)` + `getGhBacklogData` + `invalidateGhBacklogData` (D-03).
- **React Query `useQuery` + `staleTime` pattern** — `BacklogPage.tsx:227-304` is the current example; D-02 mirrors it (minus `refetchInterval`).
- **Existing virtualized rendering (`useVirtualizer`)** — `BacklogPage.tsx` already virtualizes (per `STACK.md:208`). Unchanged; just feeds it the adapted issues from one cache instead of three.

### Established Patterns
- **Cache key shape `['gh-<resource>', primaryKey]`** — Phase 72 D-01 uses `['gh-transitions', projectId]`; Phase 73 uses `['gh-all-data', boardId]`; Phase 74 extends with `['gh-backlog', boardId]`.
- **Re-export through `jira.ts`** — Memory-enforced; all three new symbols flow through `src/services/jira.ts`.
- **Hard cutover per surface** — `GH-CUT-01`. No coexistence flag. Old REST paths deleted as the GH replacement ships.
- **Mutations stay REST** — Phase 72 D-08 precedent (`postTransition`). Phase 74 D-06 extends to backlog mutations (move-to-sprint, create story, rank).
- **Toolbar bundled-reload action** — Phase 73 D-07 ("Reload board"). Phase 74 D-07 ("Reload backlog") follows the same shape.
- **Adapter at cache boundary OR via `useMemo`** — Phase 73 D-01 default is "return raw envelope, adapt at call site". Phase 74 D-02 follows the same default with planner flexibility.
- **Warn-once on entity-map miss** — Phase 71 D-07; applies to backlog adapter too.

### Integration Points
- `BacklogPage.tsx` — Rewrite data layer (lines ~220-310). Mutation handlers (lines ~590-800) keep their REST POSTs but swap cache invalidations to `invalidateGhBacklogData`.
- `BacklogPage.tsx` filter dropdowns — Epic chips use `entityData.epics`; assignee chips use `assignee`/`assigneeName`; label chip DROPS (D-05a).
- Backlog toolbar — Add "Reload backlog" menu item (D-07); remove or fold any existing per-section refresh controls.
- `Sidebar.tsx:191-230` — Collapse 3 prefetch calls into 1 `getGhBacklogData(boardId)`.
- `src/services/jira/greenhopper/index.ts` — Add `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData` exports.
- `src/services/jira.ts` — Re-export the three new symbols; delete `fetchBacklogIssues`, `fetchBacklogSprintStories`, `fetchBacklogView` (if unused) re-exports.
- `services/jira/greenhopper/types.ts` — Widen `GhBacklogResponse` to match the real fixture (D-04a).

</code_context>

<specifics>
## Specific Ideas

- **Network-log verification** (criterion #1: "exactly one `data.json` request"): UAT/verify opens the backlog, clears the network panel, reloads, asserts exactly one `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId=...` GET and zero legacy REST calls for `jira-backlog-issues`, `jira-backlog-sprint-stories`, `jira-sprint-list`.
- **`GhBacklogResponse` widening** (D-04a): planner derives the type from the fixture, ideally by running `tsc`/inference against `__fixtures__/data.real.json` or hand-writing it. Key additions: `entityData`, `sprints[]` with `issuesIds[]`, `rankCustomFieldId`, `projects`, `canCreateIssue`, `canManageSprints`. Add a type unit test that loads the fixture and asserts shape.
- **Sprint-section derivation** (D-04b): build a `Map<issueId, sprintId>` from `data.sprints[].issuesIds[]` then attach `fields.sprint = { id }` per issue during the adapter pass. This preserves the existing `groupBySprint(issues)` rendering path in BacklogPage (or its equivalent) without rewriting render logic.
- **Empty-sprint support**: `data.sprints[]` includes sprints with empty `issuesIds[]`. Render them as empty sections (matches current `fetchSprintList`-driven UX where empty sprints still show headers).
- **`done` flag in `GhIssue`**: each issue has a top-level `done: boolean` field. May be useful for visual styling on backlog (e.g. struck-through completed items). Planner decides whether to surface this; not required by acceptance criteria.
- **`canCreateIssue` / `canManageSprints` flags**: top-level booleans in `data.json`. Could drive UI affordances (hide "Create story" / "Move to sprint" buttons when the user lacks permission). Out of scope for this phase unless trivially propagated.

</specifics>

<deferred>
## Deferred Ideas

- **Label filter on backlog** — `GhIssue` has no `labels[]`. The filter chip drops in this phase (D-05a). Restoring label filtering requires either: (a) a secondary REST call for label dimensions only, (b) a Greenhopper endpoint probe to see if labels exist on a less-obvious field, or (c) accepting permanently. Pick this up post-v1.11 if users complain.
- **Subtask chips on backlog cards** — `GhIssue` has no `subtasks[]`. Backlog historically showed subtask counts; this drops (D-05b). Low signal on backlog (subtasks usually only matter on the board), but flag for UAT.
- **`flagged` indicator on backlog rows** — Field absent in `GhIssue` (D-05c). Drop in this phase; if users miss it, revisit via either a probe or a small secondary REST call.
- **GH-side mutation endpoints** (move-to-sprint, rank/reorder, create story) — Investigated as future work. Phase 72 D-08 precedent: mutations stay REST. May land alongside the broader REST-to-GH POST migration if Atlassian provides documented endpoints.
- **Caching `details.json`** — Phase 75 scope.
- **Performance verification (request counts before/after)** — Per `GH-CUT-02`, recorded in the verification artifact of the **final** milestone phase (Phase 75), not here.
- **Closed/completed sprint section** — `data.sprints[]` may include `state === 'CLOSED'`. Current backlog hides closed sprints; we keep that. Could add a collapsed "Closed sprints" section in a future UX phase.
- **`useReloadBacklog` shared hook** — Inline `invalidateQueries` in the action handler for now; promote to a shared hook only if a second consumer appears.
- **Issue-detail sprint picker swap** — `FieldsSection.tsx` still uses `fetchSprintList`. Could swap to `data.sprints[]` derived from `getGhBacklogData(boardId)` — but issue-detail is Phase 75's scope, so defer.
- **`fetchBacklogView` deletion** — Planner confirms zero callers before deleting. If any test or legacy caller exists, defer cleanup to a follow-on chore.

</deferred>

---

*Phase: 74-backlog-on-data-json*
*Context gathered: 2026-05-29*
