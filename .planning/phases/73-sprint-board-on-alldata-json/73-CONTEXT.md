# Phase 73: Sprint Board on `allData.json` - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `SprintBoardTab`'s six-query fetch path (`fetchSprintStories`, `fetchSprintSubtasks`, `fetchEpicsBasic`, `fetchActiveSprint`, `fetchBoardQuickFilters`, `fetchProjectStatuses`) with a **single `useQuery` against `fetchGhAllData(boardId)`** (shipped Phase 71). Bucket issues into the existing 3-column UI via `statusCategory` (resolved from `allData.entityData.statuses`), group subtasks under stories via `parentId`, surface `timeInColumn.enteredStatus` as a small badge on each card, and preserve every existing feature (drag-to-transition + StatusPopover fallback, QuickCreate per column, epic / quick-filter / label filters, sprint goal banner). Hard cutover per `GH-CUT-01`.

**In scope:**
- New cache layer + `useGhAllData(boardId)` React Query hook (key: `['gh-all-data', boardId]`), with `POLL_INTERVAL_MS = 60s` and `STALE_TIME_MS = 30s`, mirroring today's cadence.
- Public exports added to `src/services/jira.ts` (re-exported from `services/jira/greenhopper/index.ts`): `useGhAllData`, `getGhAllData`, `invalidateGhAllData`.
- Rewrite `SprintBoardTab.tsx` data layer: replace six queries with one; derive stories vs subtasks vs orphans from `allData.issuesData.issues[]`.
- Card badge: small `formatDistanceToNowStrict(enteredStatus)` chip (e.g. `"3d"`) on each card when `timeInColumn` is present.
- New "Reload board" toolbar action: invalidates `['gh-all-data', boardId]` + `['gh-transitions', projectId]` + `['jira-statuses']`; **replaces** Phase 72's "Reload workflow transitions" item (single discoverable refresh).
- Sidebar prefetch swap: `Sidebar.tsx:137` `fetchSprintStories` prefetch becomes `fetchGhAllData(boardId)` prefetch so the warm cache matches what the board reads.
- Delete board-only legacy fetchers: `fetchSprintSubtasks`, `fetchBoardQuickFilters` and their re-exports from `jira.ts`.

**Out of scope:**
- Caching `data.json` (Phase 74) and `details.json` (Phase 75).
- Deleting `fetchEpicsBasic`, `fetchActiveSprint`, `fetchProjectStatuses` — still used by Sidebar / BacklogPage / EpicsPage / DashboardSprintCard.
- Deleting `fetchSprintStories` — still used by Sidebar prefetch (which we swap, but the function itself stays if any other caller exists; planner re-checks).
- Replacing the column LAYOUT (still 3 buckets To Do / In Progress / Done — see Decisions §D-03 for the explicit interpretation of GH-BOARD-03).
- New "time in status" UI beyond the small per-card badge (e.g. stale-warning thresholds, board-wide dashboards).
- `postTransition` migration (still REST; Phase 72 D-08).
- Performance verification with before/after request counts — recorded in the verification artifact of the final phase per `GH-CUT-02`.

</domain>

<decisions>
## Implementation Decisions

### Cache & Hook Shape (carries forward Phase 72 D-01 / D-03 patterns)
- **D-01:** **React Query** holds the allData cache. `useQuery({ queryKey: ['gh-all-data', boardId], queryFn: () => fetchGhAllData(baseUrl, token, boardId), refetchInterval: POLL_INTERVAL_MS, refetchIntervalInBackground: false, staleTime: STALE_TIME_MS, enabled: isActive && !!boardId && !!baseUrl && !!token })`. Adapt issues via the existing Phase 71 adapter at the cache boundary (or in a `useMemo` over `data.issuesData.issues`).
- **D-02:** Public exports added to `src/services/jira.ts` (re-exported from `services/jira/greenhopper/index.ts`):
  - `useGhAllData(boardId: number): { data: GhAllDataResponse | undefined, isLoading, isFetching, error, dataUpdatedAt, refetch }` — React hook for `SprintBoardTab`.
  - `getGhAllData(queryClient, baseUrl, token, boardId): Promise<GhAllDataResponse>` — imperative for Sidebar prefetch warm; uses `ensureQueryData`.
  - `invalidateGhAllData(queryClient, boardId?: number): void` — invalidates one board or all boards; used by the "Reload board" action.

### Column Rendering (interpretation of GH-BOARD-03)
- **D-03:** Keep the existing **3-bucket UI** (To Do / In Progress / Done). Bucketing is driven by **per-status `statusCategory.key`** (`new` / `indeterminate` / `done`), resolved via the Phase 71 entity-map (`allData.entityData.statuses[statusId].statusCategory`). `columnsData.columns` is NOT used for layout; it MAY be consulted to validate that a drag-drop target status belongs to the bucket the user dropped into.
- **D-03a:** **Explicit interpretation of GH-BOARD-03** — the requirement says "render columns from GreenHopper `columnsData` (not hardcoded status buckets)". We interpret this as "consume GH as the data source for status/column information" (statuses come from `allData.entityData.statuses`, not REST `fetchProjectStatuses`). The 3-bucket UI is preserved by user decision; additional GH columns beyond To Do/Done are bucketed via their statuses' `statusCategory`. The planner / verifier should treat this as the intended interpretation; do NOT replan toward N-column layout.

### Subtask Grouping
- **D-04:** Group subtasks under their parent story via `parentId` (numeric id from `allData.issuesData.issues[].parentId` → another in-sprint issue's `.id`). The adapter's existing JiraIssue-compatible shape keeps `fields.parent.key` available for downstream group-rendering code; planner verifies whether the existing render path uses `parentId` directly or `parent.key`.
- **D-04a:** **Scope shift accepted:** `allData` returns ONLY issues in the sprint, so subtasks of in-sprint stories that are NOT themselves in the sprint **stop appearing** on the board. This matches Jira's own sprint-board behavior and aligns with the single-call goal. Today's `fetchSprintSubtasks(parentKeys)` over-fetched; that path is deleted.
- **D-04b:** **Orphan subtasks** (subtask in sprint, parent absent from `issuesData.issues[]`) → **render as standalone cards** in their `statusCategory` bucket (same rendering path as stories). No synthetic "Other subtasks" parent. Emit `warnOnce(\`orphan-subtask:${parentId}\`)` for observability (reuses the Phase 71 `warnOnce` helper at `services/jira/greenhopper/warnOnce.ts`).

### timeInColumn UX
- **D-05:** Small unobtrusive badge on each card rendering `formatDistanceToNowStrict(enteredStatus)` (e.g. `"3d"`, `"5h"`). Placement: card chrome (planner picks the exact slot — likely beside the status pill or in a corner). Show only when `timeInColumn` is present on the adapted Issue (already exposed by Phase 71 adapter at `adapter.ts:52, 155`).
- **D-05a:** No stale-warning threshold logic, no hover tooltip beyond a native `title` attribute (`"Entered status N ago"`). Keeps the surface minimal; richer UX (thresholds, board-wide aging dashboards) is a future phase.

### Refresh
- **D-06:** Keep `POLL_INTERVAL_MS = 60s` and `STALE_TIME_MS = 30s` from `lib/query-constants.ts`. Net cost is a strict improvement (1 request per cycle vs ~6 today), so cadence stays the same.
- **D-07:** **Bundled "Reload board" toolbar action** (subsumes Phase 72's deferred "bundled board-wide reload"). On click: invalidate `['gh-all-data', boardId]` + `['gh-transitions', currentProjectId]` + `['jira-statuses']`; refetch; toast `"Board reloaded"` on success / `"Failed to reload board"` on error.
- **D-07a:** **Removes** Phase 72's narrower "Reload workflow transitions" menu item — replaced by the single "Reload board" action to avoid two redundant controls. Phase 72 explicitly deferred to this phase for the bundle; this fulfills that deferral.

### Sidebar Prefetch Warm
- **D-08:** `Sidebar.tsx:137` prefetch swaps from `fetchSprintStories(...)` to `fetchGhAllData(boardId)` (via `getGhAllData`). The warmed cache key matches the key `SprintBoardTab` reads — the existing UX (board opens instantly when user has hovered the sidebar) is preserved.
- **D-08a:** Sidebar prefetch needs `boardId`. If Sidebar already has `activeJiraProject` but not `boardId`, planner uses the existing `useBoardId` hook or its underlying lookup. If `boardId` is not yet known at Sidebar mount, skip the prefetch (don't block sidebar render).

### Legacy Cleanup Scope
- **D-09:** **Delete** (board-only callers): `fetchSprintSubtasks` (services/jira.ts) and its module, plus the `['jira-board-quickfilters', boardId]` query path — `boardQuickFilters` come from `allData` (planner verifies the exact GH field — typically `customSwimlanesData` / column-level filter metadata). Re-exports from `jira.ts` deleted.
- **D-09a:** **Keep** (used elsewhere): `fetchEpicsBasic` (Sidebar, BacklogPage, EpicsPage), `fetchActiveSprint` (Sidebar, DashboardSprintCard, SprintBoardTab still uses for goal text — planner verifies whether `allData` carries the sprint goal; if yes, SprintBoardTab can also drop this query in-phase), `fetchProjectStatuses` (Sidebar, BacklogPage), `fetchSprintStories` (Sidebar prefetch swaps to allData; the function stays available for any other caller).
- **D-09b:** **Conditional cleanup** — if `allData` exposes the sprint goal banner text (likely yes — GH endpoints typically include sprint metadata), SprintBoardTab's `fetchActiveSprint` query is also removed from the board (cache key `['jira-active-sprint', ...]` dropped). The fetcher stays as a module export for Sidebar/DashboardSprintCard.

### Claude's Discretion
The user said "you decide" on the done-detection refactor (Q3 of Area 1), orphan subtask UX (Area 2 follow-up), and timeInColumn UX level (Area 3). The decisions above anchor to:
- **Done-detection (allDoneFingerprint at SprintBoardTab.tsx:890):** keep using `statusCategory.key === 'done'` — Phase 71 adapter still provides `statusCategory` via entity-map resolution, so the existing fingerprint code keeps working unchanged. Aligns with D-03's "statusCategory drives bucketing" choice.
- **Orphan subtasks (D-04b):** standalone-card rendering is the minimum-surprise behavior — work assigned to the sprint stays visible. `warnOnce` provides observability without UI noise.
- **timeInColumn badge (D-05):** small always-visible badge satisfies criterion #3's "surfaced on the card" literally. Simplest path; we can soften or thresholdize in a follow-up if UAT finds it noisy.

The planner has flexibility on:
- Exact placement of the `timeInColumn` badge in card chrome (top-right vs beside status pill vs separate row).
- Whether `useGhAllData` does its own adapter pass internally (returning `JiraIssue[]`) or returns the raw GH envelope and lets `SprintBoardTab` adapt via `useMemo`. The decision above is "return raw envelope" (D-02), but planner may pivot if the call-site adapter becomes verbose.
- Whether to factor a shared `useReloadBoard(boardId, projectId)` hook for the toolbar action, or inline `invalidateQueries` in the action handler.
- Whether to swap the SprintBoardTab's `fetchActiveSprint` query in this phase (D-09b) — depends on whether `allData` carries the sprint goal; planner checks the `.planning/research/GREENHOPPER-API.md` allData schema and `__fixtures__/` samples.
- Exact StatusPopover reuse for drag-drop with multiple legal transitions — anchored to dropped card position, pre-filtered to the bucket's legal targets.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/REQUIREMENTS.md` — `GH-BOARD-01`, `GH-BOARD-02`, `GH-BOARD-03`, `GH-BOARD-04`, `GH-CUT-01`, `GH-CUT-02`.
- `.planning/ROADMAP.md` §"v1.11 GreenHopper API Migration" Phase 73 — Goal, requirements, success criteria.
- `.planning/research/GREENHOPPER-API.md` §"allData.json — Active Sprint Board" — Endpoint contract; envelope shape (`columnsData.columns[].statusIds`, `swimlanesData`, `entityData.{statuses,priorities,types,epics}`, `issuesData.issues[]` with `timeInColumn.enteredStatus`, `parentId`, `epicId`); ID-resolution diagram.
- `.planning/phases/71-greenhopper-adapter-foundation/71-CONTEXT.md` — Adapter philosophy (JiraIssue-compatible superset), entity-map resolvers, warn-once pattern.
- `.planning/phases/72-workflow-transitions-via-greenhopper/72-CONTEXT.md` — Carried decisions (React Query cache key shape, `jira.ts` re-export rule, hard cutover policy, deferred "bundled board reload" that lands in this phase).

### Existing code the planner / executor MUST read
- `taskflow/src/services/jira/greenhopper/allData.ts` — Fetcher (`fetchGhAllData`), already shipped Phase 71.
- `taskflow/src/services/jira/greenhopper/adapter.ts:49-160` — JiraIssue adapter that already attaches `timeInColumn` (line 155). Reuse, do not duplicate.
- `taskflow/src/services/jira/greenhopper/entityMaps.ts` — `statusId → Status` (with `statusCategory`), `priorityId`, `typeId`, `epicId` resolvers used for D-03 bucketing and card rendering.
- `taskflow/src/services/jira/greenhopper/types.ts` — `GhAllDataResponse`, `GhBoardIssue`, `GhColumn` interfaces.
- `taskflow/src/services/jira/greenhopper/warnOnce.ts` — Shared `warnOnce(key)` helper, used by D-04b orphan-parent warnings.
- `taskflow/src/services/jira/greenhopper/index.ts` — Source exports for the GH-side surface (add `useGhAllData`, `getGhAllData`, `invalidateGhAllData` here).
- `taskflow/src/services/jira.ts` — Public re-export surface (memory `[[project_jira_ts_dual_file]]` — ALL 60 imports use legacy `jira.ts`, not `jira/` modules; must re-export new GH surface here).
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — The single rewrite target. Read lines 590–730 (query layer), 61–63 (column constants to delete/rewrite), 737 (Phase 72 transitions call site), 890 (allDoneFingerprint — keeps working under D-03), 938 (savedFilterIssueKeys — verify whether allData affects this).
- `taskflow/src/components/app/Sidebar.tsx:137-180` — Prefetch warm to swap (D-08).
- `taskflow/src/routes/dashboard/SprintGoalBanner.tsx` — Consumer of `activeSprint`; verify whether allData carries sprint goal (D-09b).
- `taskflow/src/lib/query-constants.ts` — `POLL_INTERVAL_MS`, `STALE_TIME_MS` (do NOT modify; D-06 reuses).
- `taskflow/src/services/jira/greenhopper/__fixtures__/` — Sample allData payloads — planner consults to verify schema for sprint goal, board quick filters, column legal targets.

### Project conventions
- Memory `[[project_jira_ts_dual_file]]` — Re-export new public surface through `jira.ts`.
- Memory `[[project_biome_state]]` — 0 errors, 0 warnings baseline; no lint/a11y regressions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`fetchGhAllData(baseUrl, token, boardId)`** — Already shipped Phase 71; returns typed `GhAllDataResponse`. This phase wraps it in `useGhAllData` + adapter.
- **Phase 71 JiraIssue adapter (`adapter.ts`)** — Already produces JiraIssue-compatible items with `timeInColumn?` attached. Card-rendering code can read `issue.timeInColumn?.enteredStatus` directly.
- **`entityMaps.ts`** — Resolves `statusId → Status` (with `statusCategory`) used by D-03 bucketing.
- **`warnOnce` helper** (`services/jira/greenhopper/warnOnce.ts`) — Phase 71. Reused for D-04b orphan-parent warnings.
- **Phase 72 `useGhTransitions` + `['gh-transitions', projectId]` cache** — The "Reload board" action (D-07) invalidates this alongside allData.
- **React Query `useQuery` + `refetchInterval` pattern** — `SprintBoardTab.tsx:625` is the current example; D-01 mirrors it.

### Established Patterns
- **Cache key shape `['gh-<resource>', primaryKey]`** — Phase 72 D-01 uses `['gh-transitions', projectId]`. Phase 73 extends with `['gh-all-data', boardId]`.
- **Re-export through `jira.ts`** — Memory-enforced.
- **Hard cutover per surface** — `GH-CUT-01`. No coexistence flag.
- **Warn-once on entity-map / lookup miss** — Phase 71 D-07, Phase 72 D-03a / D-06b. Phase 73 extends to orphan parentIds (D-04b).
- **Toolbar action invalidates one or more queryKeys + toast** — Phase 72 D-07.

### Integration Points
- `SprintBoardTab.tsx` — Rewrite the data layer (lines ~600–730). Existing render code below that point should be largely untouched if the adapted issues match JiraIssue shape.
- Sprint-board toolbar — Add "Reload board" menu item (D-07); **remove** Phase 72's "Reload workflow transitions" item.
- `Sidebar.tsx:137` — Swap prefetch to `getGhAllData(boardId)`.
- `src/services/jira/greenhopper/index.ts` — Add `useGhAllData`, `getGhAllData`, `invalidateGhAllData` exports.
- `src/services/jira.ts` — Re-export the three new symbols; delete `fetchSprintSubtasks`, `fetchBoardQuickFilters` re-exports (and source modules if no other callers).

</code_context>

<specifics>
## Specific Ideas

- **Network-log verification** (criterion #1: "exactly one `allData.json` request"): UAT/verify step opens the sprint board, clears the network panel, reloads, asserts exactly one `/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=...` GET and zero legacy REST calls from the six replaced queries.
- **Drag-to-transition with multiple legal targets** (Area 1 Q2): on drop into a bucket where the issue has >1 legal transition, anchor the existing `StatusPopover` to the dropped card position, pre-filtered to transitions whose target's `statusCategory.key` matches the bucket. Single legal target → apply immediately.
- **Sprint goal banner data source** (D-09b): planner inspects `__fixtures__/` allData samples; if `sprint.goal` is present, drop SprintBoardTab's `fetchActiveSprint` query in-phase. If not, leave it and add a deferred note.
- **`timeInColumn` formatting:** `formatDistanceToNowStrict(new Date(enteredStatus))` (date-fns is already in the dependency graph — planner verifies via package.json).
- **Polling invariant** (`query-constants.ts` comment): `STALE_TIME_MS < POLL_INTERVAL_MS` must hold. Reused values respect this; do not change.

</specifics>

<deferred>
## Deferred Ideas

- **N-column board layout** — Rendering the full set of GH columns (e.g. "In Review", "QA") as separate visual columns. User explicitly chose to keep the 3-bucket UI for this phase. Could land as a future UX phase if Jira power users request finer granularity.
- **Stale-card warning thresholds** — Visual warning when `timeInColumn` exceeds N days. Phase 73 ships only the raw badge; thresholds + configurability are a separate UX phase.
- **Board-wide "aging" dashboards / reports** — Aggregate views over `timeInColumn` across sprints. Out of scope.
- **Persisted "last status picked" per bucket** — Auto-pick most-recently-used target for a multi-status drop instead of opening StatusPopover. Considered (Area 1 Q2 option 3), rejected to keep behavior predictable.
- **`postTransition` migration to GH** — Out of scope per Phase 72 D-08; the POST stays on REST.
- **Performance verification (request counts before/after)** — Per `GH-CUT-02`, recorded in the verification artifact of the **final** milestone phase (Phase 75), not here.
- **Deleting `fetchEpicsBasic` / `fetchActiveSprint` / `fetchProjectStatuses`** — Still used by Sidebar / BacklogPage / EpicsPage / DashboardSprintCard. Can be revisited after Phases 74–75 when more REST paths fall off.
- **Synthetic "Other subtasks" parent for orphans** — Considered, rejected in favor of standalone-card rendering (D-04b).
- **Slower polling cadence for big payloads** — Considered (Area 4 Q1), rejected because allData is net cheaper than today's 6-query path.

</deferred>

---

*Phase: 73-sprint-board-on-alldata-json*
*Context gathered: 2026-05-29*
