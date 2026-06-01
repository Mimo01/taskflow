# Phase 73: Sprint Board on allData.json - Research

**Researched:** 2026-05-29
**Domain:** React Query data-layer swap, GreenHopper allData.json, Sprint Board UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** React Query holds allData cache. `useQuery({ queryKey: ['gh-all-data', boardId], queryFn: () => fetchAllData(baseUrl, token, boardId), refetchInterval: POLL_INTERVAL_MS, refetchIntervalInBackground: false, staleTime: STALE_TIME_MS, enabled: isActive && !!boardId && !!baseUrl && !!token })`. Return raw `GhAllDataResponse` envelope; SprintBoardTab adapts via useMemo.
- **D-02:** Public exports: `useGhAllData(boardId): {...}`, `getGhAllData(qc, baseUrl, token, boardId)` via ensureQueryData, `invalidateGhAllData(qc, boardId?): void`. Re-exported through `jira.ts` per dual-file rule.
- **D-03:** Keep 3-bucket UI (To Do / In Progress / Done). Bucketing by `statusCategory.key` from `allData.entityData.statuses`. `columnsData` NOT used for layout.
- **D-03a:** GH-BOARD-03 interpreted as "consume GH as data source, not hardcoded REST statuses". 3-bucket preserved by user decision.
- **D-04:** Group subtasks by `parentId` (numeric id → another issue's `.id`). Adapter already provides `fields.parent.key` for grouping logic.
- **D-04a:** `allData` returns only sprint-scoped issues. Subtasks of in-sprint parents that are NOT themselves in the sprint stop appearing. `fetchSprintSubtasks` over-fetched; path deleted.
- **D-04b:** Orphan subtasks → standalone cards in their statusCategory bucket. `warnOnce(\`orphan-subtask:${parentId}\`)` for observability. No synthetic parent group.
- **D-05:** `timeInColumn` badge: `formatDistanceToNowStrict(enteredStatus)` chip on each card when `timeInColumn` is present.
- **D-05a:** No stale-warning threshold logic. `title` attribute only (`"Entered status N ago"`). No Radix Tooltip wrapper.
- **D-06:** Keep `POLL_INTERVAL_MS = 60s`, `STALE_TIME_MS = 30s` from `lib/query-constants.ts`. Do NOT modify.
- **D-07:** "Reload board" toolbar invalidates `['gh-all-data', boardId]` + `['gh-transitions', currentProjectId]` + `['jira-statuses']`. Toast "Board reloaded" / "Failed to reload board".
- **D-07a:** Removes Phase 72's "Reload workflow transitions" item. Single combined control.
- **D-08:** Sidebar `prefetchForPath('/sprint-board')` swaps from `fetchSprintStories` to `fetchAllData(boardId)` via `getGhAllData`.
- **D-08a:** If `boardId` not yet known at Sidebar mount, skip prefetch (don't block sidebar render).
- **D-09:** Delete `fetchSprintSubtasks`, `['jira-board-quickfilters', boardId]` query path, `fetchBoardQuickFilters` import. `boardQuickFilters` come from `allData` (planner verifies exact field — see D-09 research note below).
- **D-09a:** Keep `fetchEpicsBasic`, `fetchActiveSprint` (used elsewhere), `fetchProjectStatuses`, `fetchSprintStories`.
- **D-09b:** Conditional: if `allData` carries sprint goal, drop SprintBoardTab's `fetchActiveSprint` query in-phase.

### Claude's Discretion
- Exact placement of `timeInColumn` badge in card chrome.
- Whether `useGhAllData` adapts internally or returns raw envelope (D-01 says raw envelope).
- Whether to factor `useReloadBoard` hook or inline invalidation.
- Whether to swap SprintBoardTab's `fetchActiveSprint` in this phase (depends on allData sprint goal — research answers this definitively).
- Exact StatusPopover anchoring for multi-target drag-drop.

### Deferred Ideas (OUT OF SCOPE)
- N-column board layout.
- Stale-card warning thresholds.
- Board-wide aging dashboards.
- Persisted "last status picked" per bucket.
- `postTransition` migration to GH.
- Performance verification (GH-CUT-02, Phase 75).
- Deleting `fetchEpicsBasic` / `fetchActiveSprint` / `fetchProjectStatuses`.
- Synthetic "Other subtasks" parent for orphans.
- Slower polling cadence.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-BOARD-01 | Sprint board fetches all issues in a single allData.json call | `fetchAllData` already exists at `greenhopper/allData.ts:21`. Wrap in `useGhAllData` hook; replace 6 queries in SprintBoardTab. |
| GH-BOARD-02 | Per-issue `timeInColumn.enteredStatus` surfaced on card | Fixture confirms `timeInColumn.enteredStatus` is unix milliseconds. Adapter already passes it through at `adapter.ts:155`. Badge slot confirmed at `TaskCard.tsx:144`. |
| GH-BOARD-03 | Sprint board renders columns from GH `columnsData` (interpreted per D-03/D-03a as: GH is the data source; 3-bucket UI preserved) | `columnsData.columns[]` confirmed in fixture (3 columns). Status bucketing via `entityData.statuses[id].status.statusCategory.key`. |
| GH-BOARD-04 | Existing sprint-board features work unchanged on new data source | Data-layer swap keeps render path intact. Known breaking points documented in pitfalls below. |
</phase_requirements>

---

## Summary

Phase 73 is a **pure data-layer swap**: replace six React Query calls in `SprintBoardTab.tsx` with one `useGhAllData(boardId)` hook backed by `fetchAllData`. The render path below the query layer is mostly untouched because the Phase 71 adapter already produces a `JiraIssue`-compatible superset (`AdaptedIssue`) with `timeInColumn` attached.

**Three critical findings from fixture and code inspection:**

1. **Sprint goal is NOT in `allData`** — The fixture's `sprintsData.sprints[]` objects have `id`, `name`, `state`, `startDate`, `endDate`, `daysRemaining`, but no `goal` field. The REST `fetchActiveSprint` returns `JiraActiveSprint` which has `goal?: string` (from `GET /rest/agile/1.0/board/{id}/sprint`). `SprintBoardTab` uses `activeSprint?.goal` at line 1249 for `<SprintGoalBanner>`. **D-09b answer: NO — allData does not carry goal. `fetchActiveSprint` query stays in SprintBoardTab.** [VERIFIED: fixture inspection]

2. **Board quick filters are NOT in `allData`** — The fixture's `etagData` has `"quickFilters": "[]"` (a JSON-stringified empty array, not a structured object). The `issuesData.activeFilters` array is also empty. There is no structured `JiraBoardQuickFilter[]` in the allData envelope. **The `fetchBoardQuickFilters` REST call (`/rest/agile/1.0/board/{id}/quickfilter`) must be retained for the `boardQuickFilters` data**. D-09 says "delete board-only callers" — but the planner must verify whether `boardQuickFilters` can be dropped entirely or the REST call kept. Research finding: keep the REST call or accept loss of quick-filter feature. [VERIFIED: fixture inspection]

3. **`date-fns` is not installed** — `package.json` lists no `date-fns` dependency. The codebase uses `Intl.RelativeTimeFormat` for relative time (e.g. `IssueDetailContent.tsx:40`). The UI-SPEC and CONTEXT assume `formatDistanceToNowStrict`/`formatDistanceToNow`. **The planner must either (a) add `date-fns` to `package.json` or (b) use a small inline helper modeled on `IssueDetailContent.tsx:38-44`.** [VERIFIED: package.json inspection]

**Primary recommendation:** The data-layer swap is straightforward. The three findings above are the only structural surprises — every other CONTEXT decision is confirmed correct by code inspection.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `allData` fetch + cache | API/Backend (React Query) | — | GH endpoint, single source of truth |
| Issue→JiraIssue adaptation | API/Backend (adapter.ts) | Frontend (useMemo) | Pure transform; D-01 locks raw envelope return |
| Column bucketing | Frontend (SprintBoardTab) | — | statusCategory.key classification is UI-side logic |
| Subtask grouping | Frontend (SprintBoardTab) | — | `fields.parent?.key` grouping already exists at line 880 |
| `timeInColumn` badge | Frontend (TaskCard) | — | Per-card display; slot is inside `TaskCard.tsx:144` shrink-0 container |
| Sidebar prefetch | Frontend (Sidebar) | — | Warm cache before user navigates; `getGhAllData` imperative variant |
| "Reload board" invalidation | Frontend (SprintBoardTab toolbar) | — | Invalidates 3 query keys; inline or factored hook |
| Sprint goal banner | API/Backend (REST fetchActiveSprint) | Frontend (SprintGoalBanner) | allData has no goal; REST call stays |
| Board quick filters | API/Backend (REST fetchBoardQuickFilters) | Frontend (QuickFilterChipRow) | allData has no structured quick filters |

---

## Standard Stack

No new packages required **unless** the planner chooses `date-fns` for `formatDistanceToNowStrict`. All other work uses existing project dependencies.

### If adding date-fns

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^4.x or ^3.x | `formatDistanceToNowStrict`, `formatDistanceToNow` | UI-SPEC and CONTEXT reference it by name; widely used |

**Version verification:** `date-fns` is not in `package.json`. [ASSUMED] — if chosen, planner runs `npm view date-fns version` before pinning.

**Alternative (no new dependency):** Inline `formatTimeInColumn(ms: number): string` helper using the same `Intl.RelativeTimeFormat` pattern as `IssueDetailContent.tsx:38-44`. The existing helper produces strings like `"3 days ago"` — strip `" ago"` suffix to match the badge format expected by UI-SPEC (`"3 days"`). Produces subtly different output than `formatDistanceToNowStrict` but matches project conventions.

### Package Legitimacy Audit

> No net-new packages confirmed necessary (date-fns is optional). Audit is N/A for confirmed existing packages.

| Package | Registry | Notes | Disposition |
|---------|----------|-------|-------------|
| date-fns | npm | [ASSUMED] — only needed if planner doesn't use inline helper | Conditional — planner decides |

---

## Architecture Patterns

### System Architecture Diagram

```
Sidebar hover
    │
    ▼  getGhAllData (ensureQueryData)
React Query Cache ['gh-all-data', boardId]
    │
    │  fetchAllData(baseUrl, token, boardId)
    ▼
GreenHopper  GET /rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId={boardId}
    │
    │  GhAllDataResponse
    ▼
useGhAllData (SprintBoardTab)
    │
    │  useMemo → adaptIssue(issue, entityMaps, spfk) × N
    ▼
AdaptedIssue[] (JiraIssue-superset with timeInColumn)
    │
    ├── storyIssues / subtaskIssues / orphans
    │       grouped by fields.parent?.key (line 880 pattern)
    │
    ├── Column bucketing by statusCategory.key
    │
    ├── Filters (epic/label/assignee/status/quickFilter/savedFilter)
    │
    └── TaskCard (renders timeInColumn badge if present)
          ├── ContextMenu → getTransitions → postTransition (REST)
          └── Drag-drop → StatusPopover (if multiple legal transitions)

Parallel REST calls kept:
  fetchActiveSprint  → SprintGoalBanner (goal text)
  fetchBoardQuickFilters → QuickFilterChipRow
  fetchEpicsBasic    → epic filter options
  fetchProjectStatuses → status filter options
```

### Recommended Project Structure

```
src/
├── services/jira/greenhopper/
│   ├── useGhAllData.ts          # NEW: hook + getGhAllData + invalidateGhAllData
│   ├── allData.ts               # EXISTS: fetchAllData (export as-is, CONTEXT calls it fetchGhAllData — name differs)
│   ├── adapter.ts               # EXISTS: createAdapter / adaptIssue
│   ├── index.ts                 # ADD: re-export useGhAllData, getGhAllData, invalidateGhAllData
│   └── ...
├── services/jira.ts             # ADD: re-export 3 new symbols; DELETE fetchSprintSubtasks
├── routes/dashboard/
│   ├── SprintBoardTab.tsx       # REWRITE data layer (lines 599-730); add badge in TaskCard
│   └── TaskCard.tsx             # ADD timeInColumn badge at line 147 (after story-points chip)
└── components/app/
    └── Sidebar.tsx              # SWAP prefetch at line ~127
```

### Pattern 1: useGhAllData hook (mirrors useGhTransitions)

```typescript
// Source: services/jira/greenhopper/transitions.ts:307-358 (established pattern)
// Location: services/jira/greenhopper/useGhAllData.ts

import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useIsActiveRoute } from '../../../hooks/useIsActiveRoute';
import { useAuthStore } from '../../../stores/auth.store';
import { readSecret } from '../../stronghold';
import { fetchAllData } from './allData';
import type { GhAllDataResponse } from './types';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '../../../lib/query-constants';

export function useGhAllData(boardId: number | null) {
  const queryClient = useQueryClient();
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const [token, setToken] = useState<string | null>(null);
  const isActive = useIsActiveRoute('/sprint-board');

  useEffect(() => {
    let cancelled = false;
    readSecret('jira-pat')
      .then((t) => { if (!cancelled) setToken(t); })
      .catch(() => { if (!cancelled) setToken(null); });
    return () => { cancelled = true; };
  }, [jiraBaseUrl]);

  return useQuery<GhAllDataResponse>({
    queryKey: ['gh-all-data', boardId],
    queryFn: () => fetchAllData(jiraBaseUrl as string, token as string, boardId as number),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!boardId && !!jiraBaseUrl && !!token,
  });
}

export async function getGhAllData(
  queryClient: QueryClient,
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhAllDataResponse> {
  return queryClient.ensureQueryData({
    queryKey: ['gh-all-data', boardId],
    queryFn: () => fetchAllData(baseUrl, token, boardId),
    staleTime: STALE_TIME_MS,
  });
}

export function invalidateGhAllData(queryClient: QueryClient, boardId?: number): void {
  if (boardId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-all-data'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-all-data', boardId] });
  }
}
```

**Note:** The fetcher is named `fetchAllData` in the source module (`allData.ts:21`) but CONTEXT refers to it as `fetchGhAllData`. The `jira.ts` re-export is already as `fetchAllData` (line 2692). The hook internally calls `fetchAllData` — no rename needed. [VERIFIED: allData.ts + jira.ts inspection]

### Pattern 2: SprintBoardTab data layer replacement

Existing query block to remove (lines 599–720 in current file):

| Query key | Lines | Remove? |
|-----------|-------|---------|
| `['jira-sprint-stories', ...]` | 607-629 | YES — replaced by `useGhAllData` |
| `['jira-sprint-subtasks', ...]` | 636-641 | YES — D-04a |
| `['jira-epics-basic', ...]` | 671-683 | NO — kept per D-09a |
| `['jira-active-sprint', ...]` | 692-697 | NO — D-09b answer is NO (no sprint goal in allData) |
| `['jira-board-quickfilters', ...]` | 700-705 | SEE BELOW — critical finding |
| `['project-statuses', ...]` | 713-719 | NO — kept for filter options per D-09a |

**Critical finding on boardQuickFilters (D-09):** `allData` does NOT carry structured board quick filters. The `etagData.quickFilters` field is a JSON-stringified empty string `"[]"` — not a `JiraBoardQuickFilter[]`. The planner has two options:

1. **Keep** `['jira-board-quickfilters', boardId]` query and `fetchBoardQuickFilters` import in SprintBoardTab (the module `services/jira/board-config.ts` is NOT re-exported through `jira.ts` and has only one caller). This preserves quick-filter feature.
2. **Drop** the query and accept that Jira board quick filters (admin-defined filter chips) stop working this phase.

D-09 says "delete `['jira-board-quickfilters', boardId]` query path — `boardQuickFilters` come from `allData`." This is **incorrect** based on the fixture. The planner must choose option 1 (keep REST call) or treat it as an accepted feature regression. [VERIFIED: allData.real.json + board-config.ts inspection]

### Pattern 3: Subtask grouping (critical path)

Current grouping at `SprintBoardTab.tsx:876-882` uses `fields.parent?.key`:

```typescript
// EXISTING (line 876-882) — uses fields.parent?.key
const subtasksByParent = new Map<string, JiraIssue[]>();
for (const sub of subtaskIssues) {
  const pk = sub.fields.parent?.key;
  if (pk) subtasksByParent.set(pk, [...(subtasksByParent.get(pk) ?? []), sub]);
}
```

The Phase 71 adapter synthesizes `fields.parent` only when BOTH `parentId` AND `parentKey` are present on the GH issue (adapter.ts:104-112). From the fixture, subtask PROJ-22 has `"parentId": 364638, "parentKey": "PROJ-21"` — both fields present. So `fields.parent?.key` grouping continues to work unchanged. [VERIFIED: adapter.ts:104-112 + fixture sample]

**Orphan subtasks** (parentId present, parentKey absent, or parent not in issuesData): `fields.parent` will be `undefined`, subtask will fail the `issuetype.subtask` check (adapter derives `subtask` from `parent !== undefined`), and the issue will land in `storyIssues` instead of `subtaskIssues` — rendering as a standalone card. This is correct D-04b behavior. The `warnOnce` call should be added in the `useMemo` adapter pass, not in the adapter itself.

### Pattern 4: timeInColumn badge

```tsx
// Location: TaskCard.tsx inside the shrink-0 container at line 144
// After story-points chip (line 146-150), before showStatus badge

{issue.timeInColumn?.enteredStatus && (
  <span
    className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none"
    title={`Entered status ${formatTimeInColumn(issue.timeInColumn.enteredStatus)} ago`}
  >
    {formatTimeInColumnStrict(issue.timeInColumn.enteredStatus)}
  </span>
)}
```

Where `formatTimeInColumn` and `formatTimeInColumnStrict` are either:
- (a) `date-fns` imports (if added to package.json), or
- (b) Inline helpers using `Intl.RelativeTimeFormat` pattern from `IssueDetailContent.tsx:38-44`. Output difference: strict = `"3 days"`, non-strict = `"3 days ago"` (strip " ago" for badge).

**TaskCard currently accepts `issue: JiraIssue`** (line 36) — the `timeInColumn` property is on `AdaptedIssue` (a superset). SprintBoardTab passes `AdaptedIssue` values as `JiraIssue` (TypeScript structurally compatible for the existing props). To use `issue.timeInColumn`, the planner can either (a) widen the prop type to `JiraIssue & { timeInColumn?: ... }` or (b) add a separate `timeInColumn?: GhBoardIssue['timeInColumn']` prop. Option (b) is cleaner and preserves backward compatibility. [VERIFIED: TaskCard.tsx:36 + adapter.ts:51-56]

### Pattern 5: Sidebar prefetch swap

Current Sidebar at lines 127-146 prefetches `fetchSprintStories`. After swap:

```typescript
// Sidebar.tsx inside prefetchForPath('/sprint-board') block
// Need boardId — NOT available at Sidebar level currently (no useBoardId call in Sidebar)
// The backlog code at line 207-214 uses queryClient.fetchQuery(['jira-board-id', ...])
// For sprint-board path: same pattern needed (async boardId lookup before prefetch)

if (path === '/sprint-board' || path === '/dashboard') {
  // Swap: fetch boardId first, then prefetch allData
  queryClient.fetchQuery({
    queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
    staleTime: Infinity,
  }).then((boardId) => {
    if (boardId == null) return; // D-08a: skip if boardId unknown
    return getGhAllData(queryClient, jiraBaseUrl, jiraToken, boardId);
  });
  // Keep other sprint-board prefetches (activeSprint, epicsBasic, projectStatuses)
}
```

**Finding:** Sidebar does NOT currently call `useBoardId` — it has no boardId at mount. The backlog section already demonstrates the pattern: `queryClient.fetchQuery(['jira-board-id', ...]).then(async (boardId) => {...})` at lines 207-214. The sprint-board prefetch swap must follow the same async chain. [VERIFIED: Sidebar.tsx:127-170 + 207-214]

### Pattern 6: "Reload board" toolbar

Replace both buttons at `SprintBoardTab.tsx:1140-1161`:
- `<button onClick={...invalidate ['jira-sprint-stories', 'jira-sprint-subtasks']...}>RefreshCw</button>` (line 1140-1152)
- `<button onClick={handleReloadWorkflowTransitions}>Workflow icon</button>` (line 1153-1161)

With one button: `<button onClick={handleReloadBoard}>RefreshCw</button>`

The `reloadTransitionsStatus` state (line 754) and its 3-second timeout (line 756-758) are reused, just renamed to `reloadBoardStatus`. The `aria-live` span at line 1133 is unchanged.

Remove `Workflow` from the lucide-react import at line 16 (only if not used elsewhere — grep confirms it's only used at line 1160).

```typescript
// New handler replacing handleReloadWorkflowTransitions
async function handleReloadBoard() {
  const pid = Number(localIssues[0]?.fields.project?.id ?? 0);
  try {
    if (boardId) invalidateGhAllData(queryClient, boardId);
    if (Number.isFinite(pid) && pid > 0) invalidateGhTransitions(queryClient, pid);
    await queryClient.invalidateQueries({ queryKey: ['jira-statuses'] });
    setReloadBoardStatus('Board reloaded');
  } catch {
    setReloadBoardStatus('Failed to reload board');
  }
}
```

**Note:** UI-SPEC §2 says "No toast" — the project has no `sonner` Toaster setup. All feedback is inline via `aria-live` span. [VERIFIED: package.json + SprintBoardTab.tsx:1133]

### Anti-Patterns to Avoid

- **Calling `adaptIssue` outside a `useMemo`** — adaptation of 156 issues runs synchronously; must be memoized on `data` reference change only.
- **Importing from `@/services/jira/greenhopper`** directly — per `[[project_jira_ts_dual_file]]`, imports must go through `@/services/jira`.
- **Re-exporting `fetchAllData` as `fetchGhAllData`** — the existing re-export in `jira.ts:2692` is named `fetchAllData`. The hook internally uses `fetchAllData`. No rename needed — adding `useGhAllData` / `getGhAllData` / `invalidateGhAllData` is additive.
- **Using `fields.project.id` before it's available** — the new `useGhAllData` replaces the stories query; `localIssues` is populated from adapted issues. `issue.fields.project` is synthesized via `adaptIssue` — verify the adapter sets `fields.project`... actually `JiraIssue.fields` does NOT include `project` in the Phase 71 adapter (adapter.ts:137-148). See pitfall below.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative time display | Custom time formatter | `Intl.RelativeTimeFormat` (already used in IssueDetailContent) OR date-fns | Locale-aware, handles edge cases |
| allData fetch | Direct fetch in component | `fetchAllData` in `greenhopper/allData.ts` | Already ships Phase 71, error handling included |
| Issue adaptation | Re-implementing fields mapping | `createAdapter` / `adaptIssue` in `adapter.ts` | Already handles all edge cases (Phase 71) |
| Entity resolution | Inline statusId lookups | `buildEntityMaps` + `resolveStatus` in `entityMaps.ts` | Fallback shimming on miss included |
| Warn-once logging | `if (warned.has(key)) return; warned.add(key); console.warn(...)` | `warnOnce` in `warnOnce.ts` | Phase 71 helper, already tested |

---

## Critical Findings Summary

### Finding 1: No Sprint Goal in allData [VERIFIED: fixture]

`allData.real.json` contains `sprintsData.sprints[]` with these fields: `id`, `sequence`, `rapidViewId`, `name`, `state`, `autoStartStop`, `synced`, `startDate`, `endDate`, `activatedDate`, `completeDate`, `canUpdateSprint`, `canStartStopSprint`, `canUpdateDates`, `remoteLinks`, `daysRemaining`.

**No `goal` field is present.** The `GhAllDataResponse` TypeScript interface does not even model `sprintsData` (it's an untyped extra field in the real response). SprintBoardTab currently uses `activeSprint?.goal` (from REST `fetchActiveSprint`) at line 1249 for `<SprintGoalBanner>`. This query must stay.

**Consequence for D-09b:** SprintBoardTab does NOT drop its `fetchActiveSprint` query in this phase. Add a deferred note.

### Finding 2: No Board Quick Filters in allData [VERIFIED: fixture]

`allData.real.json` `etagData.quickFilters` = `"[]"` (string, not array). `issuesData.activeFilters` = `[]`. No `JiraBoardQuickFilter[]` structure exists in the envelope. The REST `GET /rest/agile/1.0/board/{id}/quickfilter` call via `fetchBoardQuickFilters` is the only source.

**Consequence for D-09:** D-09 states "boardQuickFilters come from allData" — this is incorrect. The planner must decide: keep the REST call (recommended, preserves feature) or drop quick-filter support (accepted regression). The `board-config.ts` module is NOT re-exported through `jira.ts` — it's imported directly in SprintBoardTab. Keeping the REST call requires NO cleanup work.

### Finding 3: date-fns not installed [VERIFIED: package.json]

`package.json` lists no `date-fns`. The UI-SPEC markup uses `formatDistanceToNowStrict` / `formatDistanceToNow`. Options:
- **Option A:** `npm install date-fns` (adds ~6KB gzipped for tree-shaken imports).
- **Option B:** Inline helper at `TaskCard.tsx` or a shared `lib/formatTimeAgo.ts` using `Intl.RelativeTimeFormat` pattern from `IssueDetailContent.tsx:38-44`. Output: `"3 days"` (strip " ago" from `rtf.format(-N, 'day')` is locale-specific — use manual string trimming or just format without `numeric: 'auto'`).

### Finding 4: fetchAllData naming [VERIFIED: allData.ts + jira.ts]

The Phase 71 function is `fetchAllData` (not `fetchGhAllData` as CONTEXT references). Already re-exported from `jira.ts:2692` as `fetchAllData`. CONTEXT's `getGhAllData` imperative helper will call `fetchAllData` internally — no ambiguity.

### Finding 5: fields.project not in AdaptedIssue [VERIFIED: adapter.ts]

`adaptIssue` builds `fields` with: `summary`, `status`, `assignee`, `issuetype`, `customfield_10016`, optionally `parent`. It does NOT set `fields.project`. The existing `handleReloadBoard` handler uses `localIssues[0]?.fields.project?.id` to get `projectId` for transition invalidation. After the swap to `AdaptedIssue`, this will be `undefined`.

**Fix:** Use `localIssues[0]?.fields.issuetype` is also absent — but `GhBoardIssue.projectId` is available on the raw issue. The adapted issue's raw GH data (`projectId: number`) is lost after adaptation. The planner must source `projectId` differently: either from `useSettingsStore` (project setting), from the `allData.rapidViewId`, or from `GhBoardIssue.projectId` preserved in the `useMemo`. The most reliable source is `Number(localIssues[0]?.fields.project?.id)` — but since it's absent post-adaptation, use `allData.issuesData.issues[0]?.projectId` from the raw `data` (available in SprintBoardTab's `data` variable from `useGhAllData`).

---

## Common Pitfalls

### Pitfall 1: boardQuickFilters data source assumption
**What goes wrong:** Planning deletes `fetchBoardQuickFilters` per D-09 and discovering at execution time that `boardQuickFilters` is always `undefined` — `QuickFilterChipRow` renders nothing, board quick-filter chips vanish.
**Why it happens:** D-09 incorrectly stated "boardQuickFilters come from allData".
**How to avoid:** Keep `fetchBoardQuickFilters` REST call in SprintBoardTab. The `board-config.ts` module is standalone (not through `jira.ts`), one caller only, no cleanup needed.
**Warning signs:** `quickFilters === undefined` in UI, `QuickFilterChipRow` renders empty.

### Pitfall 2: projectId sourcing after AdaptedIssue migration
**What goes wrong:** `Number(localIssues[0]?.fields.project?.id)` returns `NaN` — `handleReloadBoard` passes `projectId = 0`, `invalidateGhTransitions` warns and may not invalidate.
**Why it happens:** `adapter.ts` does not synthesize `fields.project`. Legacy REST issues did include `project` from the search API's `fields=...` param.
**How to avoid:** Source `projectId` from `data.issuesData.issues[0]?.projectId` (raw GH field, numeric) or from `useSettingsStore` project context.
**Warning signs:** Reload board doesn't refresh transitions; `warnOnce('workflow-miss')` fires.

### Pitfall 3: Subtask grouping breaks without parentKey
**What goes wrong:** Subtasks appear as standalone cards even when their parent IS in the sprint.
**Why it happens:** Grouping at line 880 uses `fields.parent?.key`. Adapter only synthesizes `parent` when BOTH `parentId` AND `parentKey` are present. If GH returns a subtask with `parentId` but no `parentKey` (edge case — not seen in fixture but theoretically possible), `fields.parent` is `undefined`, `issuetype.subtask` is `false`, and the issue lands in `storyIssues`.
**How to avoid:** Trust the fixture: all subtasks have both fields. Add a `warnOnce` if `parentId` is present but `parentKey` is absent.
**Warning signs:** More "story" rows than expected; orphan-subtask warn-once fires for known parents.

### Pitfall 4: import path for useGhAllData
**What goes wrong:** Executor imports `useGhAllData` from `@/services/jira/greenhopper` directly.
**Why it happens:** Forgetting `[[project_jira_ts_dual_file]]` rule.
**How to avoid:** Export from `greenhopper/index.ts`, re-export from `jira.ts`, import from `@/services/jira`.
**Warning signs:** Biome lint reports unused exports or duplicate imports.

### Pitfall 5: Sprint goal query removal
**What goes wrong:** Planner applies D-09b "if allData has sprint goal, remove fetchActiveSprint" — removes the query — `SprintGoalBanner` never renders.
**Why it happens:** D-09b is conditional and research now definitively answers NO.
**How to avoid:** Keep `['jira-active-sprint', ...]` query in SprintBoardTab. See Finding 1 above.

### Pitfall 6: storyPointsFieldKey for createAdapter
**What goes wrong:** `adaptIssue` requires `storyPointsFieldKey` (D-02 gate). If called with empty string, all story-point badges disappear (returns `null` for all issues).
**Why it happens:** The adapter is pure — caller threads the key. SprintBoardTab already has `storyPointsFieldKey` from `useSettingsStore` (line 515). Must be threaded into the `useMemo` adapter pass.
**How to avoid:** `const adapt = useMemo(() => createAdapter({ storyPointsFieldKey, entityMaps }), [storyPointsFieldKey, entityMaps])`.
**Warning signs:** All story-point badges show nothing.

---

## Code Examples

### allData fixture: timeInColumn shape
```json
// Source: taskflow/src/services/jira/greenhopper/__fixtures__/allData.real.json (line 454-457)
"timeInColumn": {
  "enteredStatus": 1779889245885,   // unix milliseconds (confirmed: ~2026-05-29 date)
  "durationPreviously": 1392675906
}
```

`enteredStatus` is a **unix milliseconds** integer, not an ISO string. Use `new Date(enteredStatus)` directly (works with both `date-fns` and `Intl` approaches). [VERIFIED: fixture]

### allData fixture: parentId shape
```json
// Source: allData.real.json — subtask PROJ-22 (line 462-466)
{
  "id": 364779,
  "parentId": 364638,     // numeric, matches parent issue's .id
  "parentKey": "PROJ-21", // string key, present alongside parentId
  ...
}
```

`parentId` is a **number** (not string). The adapter's `fields.parent.id` is `String(gh.parentId)` per `adapter.ts:106`. Grouping uses `fields.parent?.key` (string). No edge-case surprises in fixture. [VERIFIED: fixture + adapter.ts:104-112]

### Inline time-ago helper (if date-fns not added)
```typescript
// Source: pattern from IssueDetailContent.tsx:38-44
// For badge: strict output (no "ago"), mirroring formatDistanceToNowStrict
function formatTimeInColumnStrict(enteredStatusMs: number): string {
  const diffSecs = Math.floor((Date.now() - enteredStatusMs) / 1000);
  if (diffSecs < 60) return `${diffSecs} seconds`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} minutes`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours`;
  return `${Math.floor(diffSecs / 86400)} days`;
}

// For title attribute: natural phrasing (like formatDistanceToNow)
function formatTimeInColumn(enteredStatusMs: number): string {
  return formatTimeInColumnStrict(enteredStatusMs); // same output for title
}
```

Output matches UI-SPEC examples (`"3 days"`, `"5 hours"`) closely enough. Locale note: `Intl.RelativeTimeFormat` can be used for polish but is locale-dependent in numeric forms; the simple math above is deterministic.

### Sidebar prefetch boardId lookup
```typescript
// Source: Sidebar.tsx:207-214 (existing backlog pattern)
queryClient
  .fetchQuery({
    queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
    staleTime: Infinity,
  })
  .then((boardId) => {
    if (boardId == null) return; // D-08a: skip silently
    return getGhAllData(queryClient, jiraBaseUrl, jiraToken, boardId);
  });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 6 queries (stories + subtasks + epics + sprint + quickfilters + statuses) | 1 allData query + 3 supporting REST queries kept | Phase 73 | GH-BOARD-01: exactly one allData.json request; 3 REST calls remain for goal/quickfilters/epics |
| `fetchSprintSubtasks(parentKeys)` N+1 pattern | subtasks included in allData.issuesData.issues | Phase 73 | Sprint-scoped subtasks only (D-04a behavior change) |
| REST `fetchProjectStatuses` for status bucketing | `allData.entityData.statuses` for bucketing | Phase 73 | Status names/categories from GH entity map |

**Deprecated/outdated in this phase:**
- `['jira-sprint-stories', ...]` query: replaced by `['gh-all-data', boardId]`
- `['jira-sprint-subtasks', ...]` query: deleted (subtasks included in allData)
- `fetchSprintSubtasks` in `jira.ts`: deleted (only caller was SprintBoardTab)
- Phase 72's "Reload workflow transitions" toolbar button: replaced by "Reload board"
- Sidebar `fetchSprintStories` prefetch: replaced by `getGhAllData` prefetch

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | date-fns not needed if inline helper used; strict output `"3 days"` acceptable vs exact `formatDistanceToNowStrict` output | Standard Stack / Pattern 4 | UI-SPEC requires `formatDistanceToNowStrict` exactly — planner may need to add date-fns |
| A2 | `columnsData.columns` in fixture matches the 3-bucket expectation (To Do/In Progress/Done) — the live instance may have different column names | Architecture | Column name display derived from `CATEGORY_COLUMNS` constants, not from `columnsData.columns[].name` — no risk to rendering |
| A3 | `GhBoardIssue.projectId` (numeric) can be used to source projectId for transition invalidation in `handleReloadBoard` | Common Pitfalls | If projectId is wrong, invalidation silently misses; board transitions stale |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **boardQuickFilters: keep or drop?**
   - What we know: allData does NOT carry structured quick filters. REST `fetchBoardQuickFilters` is the only source. D-09 said to delete it.
   - What's unclear: Did the user intend to drop quick-filter support as a side-effect of the phase, or was D-09 based on an incorrect assumption?
   - Recommendation: **Keep the REST call**. The module is standalone, cleanup cost is zero, feature preservation is high value. Add a deferred note that GH provides no quick-filter endpoint and this REST call is permanent.

2. **date-fns vs inline helper for timeInColumn formatting?**
   - What we know: date-fns is not installed. Codebase uses `Intl.RelativeTimeFormat`.
   - What's unclear: Does the product require precise `formatDistanceToNowStrict` output, or is `"3 days"` from manual math acceptable?
   - Recommendation: Use inline helper (no new dependency). If exact date-fns phrasing is required, add `date-fns` — it's a well-known legitimate package.

3. **`fields.project` for projectId in handleReloadBoard?**
   - What we know: `AdaptedIssue.fields` does not include `project`. `GhBoardIssue.projectId` is available in raw `data`.
   - Recommendation: Use `data?.issuesData.issues[0]?.projectId` from the raw `useGhAllData` return value in SprintBoardTab.

---

## Environment Availability

Phase 73 is code/config only. No external tool dependencies beyond the existing Jira connection. **Step 2.6: SKIPPED (no new external dependencies).**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=dot` |
| Full suite command | `npm run test` |
| Setup file | `src/test/setup.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GH-BOARD-01 | `useGhAllData` hook fires one `fetchAllData` call | unit | `vitest run src/services/jira/greenhopper/useGhAllData.test.ts` | ❌ Wave 0 |
| GH-BOARD-01 | SprintBoardTab renders with `useGhAllData` mock returning issues | integration | `vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ exists (needs mock update) |
| GH-BOARD-02 | `timeInColumn` badge renders when `enteredStatus` present | unit | `vitest run src/routes/dashboard/TaskCard.test.tsx` (if exists) | ❌ Wave 0 check |
| GH-BOARD-03 | Issues bucket into 3 columns by statusCategory | integration | `vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ exists (needs new test case) |
| GH-BOARD-04 | Orphan subtask renders as standalone card | integration | `vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ exists (needs new test case) |
| GH-BOARD-04 | `invalidateGhAllData` called on reload board click | integration | `vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ exists (needs test update) |
| Network log | Exactly one allData.json request on board open | manual/E2E | DevTools Network panel | manual only |

### Sampling Rate

- **Per task commit:** `npm run test -- --reporter=dot`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/services/jira/greenhopper/useGhAllData.test.ts` — covers GH-BOARD-01 hook behavior, `getGhAllData`, `invalidateGhAllData`
- [ ] Update `src/routes/dashboard/SprintBoardTab.test.tsx` mock from `fetchSprintStories`/`fetchSprintSubtasks` to `useGhAllData`
- [ ] Check `src/routes/dashboard/TaskCard.test.tsx` — add `timeInColumn` badge render test if file exists

---

## Security Domain

Phase 73 is a read-only data-layer swap. No new auth surfaces, no new input vectors, no new cryptographic operations.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | GH response is server-controlled; no user-supplied input added |
| V6 Cryptography | no | — |

Bearer PAT is unchanged; GreenHopper endpoint reuses existing Jira auth (confirmed Phase 71/72). No new threat patterns introduced.

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/services/jira/greenhopper/__fixtures__/allData.real.json` — fixture inspection: timeInColumn shape, parentId/parentKey, sprintsData (no goal), columnsData structure, etagData.quickFilters
- `taskflow/src/services/jira/greenhopper/adapter.ts` — confirmed fields synthesized, timeInColumn passthrough at line 155, parent synthesis conditions
- `taskflow/src/services/jira/greenhopper/transitions.ts:307-358` — hook pattern to replicate
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx:599-730` — exact query list, lines confirmed
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx:1130-1162` — toolbar button locations
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx:876-882` — subtask grouping via `fields.parent?.key`
- `taskflow/src/routes/dashboard/TaskCard.tsx:144-158` — badge slot geometry
- `taskflow/src/components/app/Sidebar.tsx:127-214` — prefetch patterns, boardId async chain
- `taskflow/src/services/jira/board-config.ts` — fetchBoardQuickFilters module, only one caller
- `taskflow/package.json` — confirmed no date-fns dependency
- `taskflow/src/lib/query-constants.ts` — POLL_INTERVAL_MS=60000, STALE_TIME_MS=30000
- `taskflow/src/services/jira.ts:2688-2706` — current GH exports, fetchAllData name confirmed

### Secondary (MEDIUM confidence)
- `.planning/phases/73-sprint-board-on-alldata-json/73-CONTEXT.md` — decision rationale
- `.planning/phases/73-sprint-board-on-alldata-json/73-UI-SPEC.md` — badge placement, toolbar spec
- `.planning/research/GREENHOPPER-API.md` — API schema reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json
- Architecture: HIGH — all file locations and line numbers confirmed by code reading
- Pitfalls: HIGH — all three critical findings verified against fixtures and source
- Validation: HIGH — test framework and existing test file confirmed

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (30 days; stable tech stack)
