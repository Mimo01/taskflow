# Phase 73: Sprint Board on allData.json - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/jira/greenhopper/useGhAllData.ts` | hook | request-response | `src/services/jira/greenhopper/transitions.ts:307-358` (`useGhTransitions`) | exact |
| `src/services/jira/greenhopper/index.ts` | config (barrel) | — | current `index.ts` (additive only) | exact |
| `src/services/jira.ts` | config (re-export) | — | `src/services/jira.ts:2688-2706` (Phase 72 GH block) | exact |
| `src/routes/dashboard/SprintBoardTab.tsx` | component | request-response + CRUD | itself (data-layer swap) | exact |
| `src/routes/dashboard/TaskCard.tsx` | component | transform | `TaskCard.tsx:144-158` story-points chip slot | exact |
| `src/components/app/Sidebar.tsx` | component | request-response | `Sidebar.tsx:207-214` boardId async chain | exact |

---

## Pattern Assignments

### `src/services/jira/greenhopper/useGhAllData.ts` (hook, request-response)

**Analog:** `src/services/jira/greenhopper/transitions.ts` lines 307–358 (`useGhTransitions`)

**Imports pattern** (transitions.ts lines 28–46, adapt for useGhAllData):
```typescript
import {
  type QueryClient,
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useIsActiveRoute } from '../../../hooks/useIsActiveRoute';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '../../../lib/query-constants';
import { readSecret } from '../../stronghold';
import { useAuthStore } from '../../../stores/auth.store';
import { fetchAllData } from './allData';
import type { GhAllDataResponse } from './types';
```

**Secret-read + enabled guard pattern** (transitions.ts lines 313–330):
```typescript
const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  // Re-read the secret whenever the Jira instance changes (login rotation,
  // instance switch). An empty dep array leaves the hook with a stale token.
  let cancelled = false;
  readSecret('jira-pat')
    .then((t) => { if (!cancelled) setToken(t); })
    .catch(() => { if (!cancelled) setToken(null); });
  return () => { cancelled = true; };
}, [jiraBaseUrl]);
```

**Core useQuery pattern** (transitions.ts lines 332–357, adapted to allData shape):
```typescript
export function useGhAllData(boardId: number | null) {
  // ... (secret-read block above) ...
  const isActive = useIsActiveRoute('/sprint-board');

  return useQuery<GhAllDataResponse>({
    queryKey: ['gh-all-data', boardId],
    queryFn: () => fetchAllData(jiraBaseUrl as string, token as string, boardId as number),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!boardId && !!jiraBaseUrl && !!token,
  });
}
```
Note: unlike `useGhTransitions`, this hook does NOT use `staleTime: Infinity` — it uses `STALE_TIME_MS` (30 s) to match the board's polling cadence.

**`getGhAllData` imperative twin pattern** — mirror `getGhTransitions` from transitions.ts. Uses `queryClient.ensureQueryData`:
```typescript
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
```

**`invalidateGhAllData` pattern** — mirror `invalidateGhTransitions` from transitions.ts:
```typescript
export function invalidateGhAllData(queryClient: QueryClient, boardId?: number): void {
  if (boardId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-all-data'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-all-data', boardId] });
  }
}
```

---

### `src/services/jira/greenhopper/index.ts` (barrel, additive)

**Analog:** current `index.ts` (lines 1–14)

**Current barrel** (index.ts lines 1–14):
```typescript
export * from './adapter';
export * from './allData';
export * from './data';
export * from './details';
export * from './entityMaps';
export * from './transitions';
export * from './types';
```

**Addition required:** append one line:
```typescript
export * from './useGhAllData';
```

`warnOnce` is intentionally NOT barrel-exported (internal to greenhopper/); do not add it.

---

### `src/services/jira.ts` (re-export surface, additive + delete)

**Analog:** `src/services/jira.ts` lines 2688–2706 (Phase 72 GH export block)

**Current GH re-export block** (jira.ts lines 2688–2706):
```typescript
export {
  adaptIssue,
  buildEntityMaps,
  createAdapter,
  fetchAllData,
  fetchBacklogData,
  fetchGhTransitions,
  fetchIssueDetails,
  filterTransitionsForStatus,
  getGhTransitions,
  invalidateGhTransitions,
  peekGhTransitions,
  resolveEpic,
  resolveParent,
  resolvePriority,
  resolveStatus,
  resolveType,
  useGhTransitions,
} from './jira/greenhopper';
```

**Required changes:**
1. Add three new symbols to this block: `getGhAllData`, `invalidateGhAllData`, `useGhAllData`
2. Delete `fetchSprintSubtasks` from its existing re-export elsewhere in jira.ts (board-only caller is removed)
3. Keep `fetchBoardQuickFilters` import in SprintBoardTab unchanged — it imports directly from `@/services/jira/board-config` (not through jira.ts), so no jira.ts change needed for it (R-01)

---

### `src/routes/dashboard/SprintBoardTab.tsx` (component, data-layer swap)

**Analog:** itself — this is a targeted rewrite of the data-fetch block.

**Imports to change** (lines 14–57):

Remove from `@/services/jira` import block:
- `fetchSprintStories` (board query removed)
- `fetchSprintSubtasks` (D-04a deleted)

Add to `@/services/jira` import block:
- `useGhAllData`
- `invalidateGhAllData`
- `buildEntityMaps` (for useMemo adapter)
- `createAdapter` (for useMemo adapter)
- `AdaptedIssue` type

Remove from lucide-react:
- `Workflow` (toolbar icon no longer needed — grep confirms only usage is line 1160)

**Query block replacement** (lines 599–734):

Replace lines 599–641 (stories + subtasks queries) with:
```typescript
const {
  data: allData,
  isLoading,
  isFetching,
  isError,
  error,
  dataUpdatedAt,
} = useGhAllData(boardId);

// Adapt raw GH issues → AdaptedIssue[] (JiraIssue-superset) once per data ref change.
// D-01: raw envelope returned by useGhAllData; adaptation is caller-side via useMemo.
const entityMaps = useMemo(
  () => (allData ? buildEntityMaps(allData.entityData) : null),
  [allData],
);
const adapt = useMemo(
  () => (entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null),
  [storyPointsFieldKey, entityMaps],
);
const adaptedIssues = useMemo<AdaptedIssue[]>(() => {
  if (!allData || !adapt) return [];
  return allData.issuesData.issues.map((gh) => {
    // D-04b: orphan-subtask observability
    if (gh.parentId !== undefined && gh.parentKey === undefined) {
      warnOnce('orphan-subtask', String(gh.parentId));
    }
    return adapt(gh);
  });
}, [allData, adapt]);
```

Keep lines 643–734 (epics, activeSprint, boardQuickFilters, projectStatuses queries) **unchanged** — these four queries stay per R-01 and R-02.

Replace `setLocalIssues(data ?? [])` effect (line 721–723) with `setLocalIssues(adaptedIssues)`.

**sentinelProjectId for useGhTransitions warm** (line 731): After the swap, `localIssues[0]?.fields.project?.id` is undefined (adapter does not set `fields.project`). Source projectId from raw data instead:
```typescript
// R-04: source projectId from raw GH envelope (fields.project not in AdaptedIssue)
const sentinelProjectId = allData?.issuesData.issues[0]?.projectId ?? 0;
const sentinelIssueTypeId = localIssues[0]?.fields.issuetype?.id ?? '';
useGhTransitions(sentinelProjectId, sentinelIssueTypeId);
```

**Subtask grouping** (lines 876–886): **NO CHANGE NEEDED.** Adapter synthesizes `fields.parent.key` when both `parentId` and `parentKey` are present on the GH issue. Grouping by `fields.parent?.key` continues to work unchanged.

**allDoneFingerprint** (line 890): **NO CHANGE NEEDED.** `categoryOf(issue)` uses `issue.fields.status.statusCategory?.key` which the adapter already sets correctly via entity-map resolution.

**"Reload board" handler** (replaces `handleReloadWorkflowTransitions` at lines 761–774):
```typescript
// Renamed state: reloadTransitionsStatus → reloadBoardStatus
const [reloadBoardStatus, setReloadBoardStatus] = useState<string | null>(null);
useEffect(() => {
  if (!reloadBoardStatus) return;
  const t = setTimeout(() => setReloadBoardStatus(null), 3000);
  return () => clearTimeout(t);
}, [reloadBoardStatus]);

// R-04: projectId sourced from raw GH envelope (not adapted issues)
async function handleReloadBoard() {
  const pid = allData?.issuesData.issues[0]?.projectId ?? 0;
  const activeSprintId = activeSprint?.id;
  try {
    if (boardId) invalidateGhAllData(queryClient, boardId);
    if (pid > 0) invalidateGhTransitions(queryClient, pid);
    await queryClient.invalidateQueries({ queryKey: ['jira-statuses'] });
    await queryClient.invalidateQueries({ queryKey: ['jira-board-quickfilters', boardId] });
    if (activeSprintId) {
      await queryClient.invalidateQueries({ queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl] });
    }
    setReloadBoardStatus('Board reloaded');
  } catch {
    setReloadBoardStatus('Failed to reload board');
  }
}
```

**Toolbar replacement** (lines 1130–1162):
```tsx
{/* Replace two buttons (lines 1140-1161) with one */}
<span
  role="status"
  aria-live="polite"
  className="text-xs text-muted-foreground hidden sm:inline"
>
  {reloadBoardStatus ?? ''}
</span>
<button
  type="button"
  onClick={handleReloadBoard}
  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
  aria-label="Reload board"
  title="Reload board"
>
  <RefreshCw className={cn('size-3', isFetching && 'animate-spin')} />
</button>
```

---

### `src/routes/dashboard/TaskCard.tsx` (component, transform)

**Analog:** `TaskCard.tsx` lines 144–158 (story-points chip slot)

**Existing chip pattern** (lines 144–150):
```tsx
<div className="flex items-center gap-1.5 shrink-0">
  {/* Story points badge */}
  {storyPoints != null && storyPoints > 0 && (
    <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none">
      {storyPoints}
    </span>
  )}
  {/* Status badge ... */}
```

**New prop required** — Add a `timeInColumn` prop to the interface (option b from RESEARCH: separate prop preserves backward compatibility rather than widening `issue` type):
```typescript
// Add to TaskCardProps interface (line 36)
/** Time-in-column data from GH allData; present only on AdaptedIssue from sprint board */
timeInColumn?: { enteredStatus: number; durationPreviously?: number };
```

**Badge insertion** (after story-points chip, before `showStatus` chip — inside the `shrink-0` div):
```tsx
{timeInColumn?.enteredStatus && (
  <span
    className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none"
    title={`Entered status ${formatTimeAgo(timeInColumn.enteredStatus)} ago`}
  >
    {formatTimeAgoStrict(timeInColumn.enteredStatus)}
  </span>
)}
```

**Time formatting helpers** — Use `Intl.RelativeTimeFormat` pattern from `IssueDetailContent.tsx:37-45` (R-03: no date-fns). Add as module-level helpers or extract to `src/lib/formatTimeAgo.ts`:
```typescript
// Source: IssueDetailContent.tsx:37-45 — same pattern, adapted for unix ms input
function formatTimeAgoStrict(enteredStatusMs: number): string {
  const diffSecs = Math.floor((Date.now() - enteredStatusMs) / 1000);
  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h`;
  return `${Math.floor(diffSecs / 86400)}d`;
}

function formatTimeAgo(enteredStatusMs: number): string {
  // Full phrasing for title attribute (natural language)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffSecs = Math.floor((Date.now() - enteredStatusMs) / 1000);
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  return rtf.format(-Math.floor(diffSecs / 86400), 'day');
}
```
Output matches UI-SPEC examples: badge = `"3d"`, `"5h"`, `"2m"`; title = `"3 days ago"`.

---

### `src/components/app/Sidebar.tsx` (component, prefetch swap)

**Analog:** `Sidebar.tsx` lines 207–214 (boardId async-chain pattern for backlog)

**Existing async boardId chain pattern** (lines 207–214):
```typescript
queryClient
  .fetchQuery({
    queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
    staleTime: Infinity,
  })
  .then(async (boardId) => {
    if (boardId == null) return;
    // ... chain prefetch here ...
  });
```

**Sprint-board prefetch swap** (lines 127–146 — replace `fetchSprintStories` prefetch):
```typescript
// Before (lines 127-146): prefetchQuery jira-sprint-stories
// After: async boardId lookup → getGhAllData
if (path === '/sprint-board' || path === '/dashboard') {
  // D-08: swap fetchSprintStories prefetch to getGhAllData
  // D-08a: if boardId not yet known, skip silently (don't block sidebar render)
  queryClient
    .fetchQuery({
      queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
      queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
      staleTime: Infinity,
    })
    .then((boardId) => {
      if (boardId == null) return; // D-08a: skip if boardId unknown
      return getGhAllData(queryClient, jiraBaseUrl, jiraToken, boardId);
    });

  // Keep these three prefetches unchanged (activeSprint, epicsBasic, projectStatuses)
  if (path === '/sprint-board') {
    // ... existing lines 147-169 unchanged ...
  }
}
```

Add imports at top of Sidebar.tsx:
- `getGhAllData` from `@/services/jira`
- `fetchBoardId` (likely already imported — verify; it's used at line 210)

---

## Shared Patterns

### React Query hook shape (auth + secret-read)
**Source:** `src/services/jira/greenhopper/transitions.ts` lines 307–358
**Apply to:** `useGhAllData.ts`
```typescript
// Pattern: read jiraBaseUrl from auth store; read token async in useEffect triggered by jiraBaseUrl change
const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
const [token, setToken] = useState<string | null>(null);
useEffect(() => {
  let cancelled = false;
  readSecret('jira-pat')
    .then((t) => { if (!cancelled) setToken(t); })
    .catch(() => { if (!cancelled) setToken(null); });
  return () => { cancelled = true; };
}, [jiraBaseUrl]);
```

### Cache key shape `['gh-<resource>', primaryKey]`
**Source:** Phase 72 `['gh-transitions', projectId]`; Phase 73 extends with `['gh-all-data', boardId]`
**Apply to:** `useGhAllData.ts`, `SprintBoardTab.tsx` reload handler
```typescript
// All GH hooks follow this key shape:
queryKey: ['gh-all-data', boardId]       // Phase 73 (this phase)
queryKey: ['gh-transitions', projectId]  // Phase 72 (keep intact)
```

### Re-export via jira.ts
**Source:** `src/services/jira.ts` lines 2688–2706
**Apply to:** All new GH surface additions (`useGhAllData`, `getGhAllData`, `invalidateGhAllData`)
```typescript
// Pattern: export from greenhopper/index.ts first, then re-export from jira.ts
// Memory [[project_jira_ts_dual_file]]: ALL 60 consumer imports use jira.ts
export { getGhAllData, invalidateGhAllData, useGhAllData } from './jira/greenhopper';
```

### Toolbar inline feedback (aria-live, 3-second timeout)
**Source:** `src/routes/dashboard/SprintBoardTab.tsx` lines 754–774, 1133–1138
**Apply to:** "Reload board" handler in `SprintBoardTab.tsx`
```typescript
const [reloadBoardStatus, setReloadBoardStatus] = useState<string | null>(null);
useEffect(() => {
  if (!reloadBoardStatus) return;
  const t = setTimeout(() => setReloadBoardStatus(null), 3000);
  return () => clearTimeout(t);
}, [reloadBoardStatus]);

// In JSX: <span role="status" aria-live="polite">{reloadBoardStatus ?? ''}</span>
// No toast library — inline only (confirmed: no sonner in package.json)
```

### warnOnce for orphan/miss observability
**Source:** `src/services/jira/greenhopper/warnOnce.ts` (exported `warnOnce(kind, id)`)
**Apply to:** `useMemo` adapter loop in `SprintBoardTab.tsx`
```typescript
// Pattern: call warnOnce before adapt() when an edge condition is detected
import { warnOnce } from '@/services/jira/greenhopper/warnOnce'; // internal import OK (same greenhopper folder)
// OR import through the adapter/index which re-exports it — verify

// D-04b usage:
if (gh.parentId !== undefined && gh.parentKey === undefined) {
  warnOnce('orphan-subtask', String(gh.parentId));
}
```

### createAdapter useMemo pattern
**Source:** `adapter.ts` lines 162–172 (`createAdapter` factory)
**Apply to:** `SprintBoardTab.tsx` data-layer section
```typescript
// Bind storyPointsFieldKey + entityMaps once; call adapt() per issue inside useMemo
const entityMaps = useMemo(() => allData ? buildEntityMaps(allData.entityData) : null, [allData]);
const adapt = useMemo(
  () => entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null,
  [storyPointsFieldKey, entityMaps],
);
// Pitfall 6 from RESEARCH: must thread storyPointsFieldKey; missing it zeros all story-point badges
```

---

## No Analog Found

All files have analogs in the codebase. No new patterns are needed from RESEARCH.md.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

---

## Critical Research Resolutions (planner must honor)

| ID | Override | Impact on files |
|----|----------|-----------------|
| R-01 | Keep `fetchBoardQuickFilters` REST call — allData has no structured quick filters | SprintBoardTab: do NOT remove boardQuickFilters query; do NOT delete board-config import |
| R-02 | Keep `fetchActiveSprint` in SprintBoardTab — allData has no sprint goal field | SprintBoardTab: do NOT remove activeSprint query |
| R-03 | Use `Intl.RelativeTimeFormat` pattern, NOT date-fns — not in package.json | TaskCard: inline helper or `src/lib/formatTimeAgo.ts`; no npm install needed |
| R-04 | Source projectId from `allData.issuesData.issues[0]?.projectId` (raw GH field) | SprintBoardTab handleReloadBoard: NOT `localIssues[0]?.fields.project?.id` |

---

## Metadata

**Analog search scope:** `taskflow/src/services/jira/greenhopper/`, `taskflow/src/routes/dashboard/`, `taskflow/src/components/app/`
**Files scanned:** 9 source files read directly
**Pattern extraction date:** 2026-05-29
