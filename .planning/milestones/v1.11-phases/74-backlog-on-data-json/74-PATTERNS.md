# Phase 74: Backlog on `data.json` — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 9 (3 new, 6 modified/deleted-from)
**Analogs found:** 9 / 9
**Primary precedent:** Phase 73 (`useGhAllData` / SprintBoardTab / Sidebar prefetch swap / "Reload board" toolbar)

This phase is a near-verbatim mirror of Phase 73 onto the backlog surface. The strongest single analog is `taskflow/src/services/jira/greenhopper/useGhAllData.ts` for the new hook, with `taskflow/src/services/jira/greenhopper/useGhAllData.test.ts` for the test, and `SprintBoardTab.tsx:610-642, 776-810, 1190-1206` for the call-site adapter + Reload toolbar.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/services/jira/greenhopper/useGhBacklogData.ts` | service / hook | request-response (cached) | `taskflow/src/services/jira/greenhopper/useGhAllData.ts` | **exact** (Phase 73 sibling) |
| `taskflow/src/services/jira/greenhopper/useGhBacklogData.test.ts` | test | request-response | `taskflow/src/services/jira/greenhopper/useGhAllData.test.ts` | **exact** |
| `taskflow/src/services/jira/greenhopper/types.ts` (modify) | type module | n/a | `GhAllDataResponse` (same file, lines 125-157) | **exact** — extend `GhBacklogResponse` to match fixture |
| `taskflow/src/services/jira/greenhopper/types.test.ts` (new, optional) | test | n/a | (no precedent — derive from fixture) | new pattern (small) |
| `taskflow/src/services/jira/greenhopper/adapter.test.ts` (extend) | test | n/a | self — add backlog-shape case | role-match |
| `taskflow/src/services/jira/greenhopper/index.ts` (modify) | barrel | n/a | self (line 15: `export * from './useGhAllData'`) | **exact** |
| `taskflow/src/services/jira.ts` (modify) | re-export barrel | n/a | self (lines 2643-2664: existing GH block) | **exact** — add 3 symbols; delete 3 legacy fns + `BacklogViewData` interface |
| `taskflow/src/services/jira/backlog.ts` (modify) | service | request-response | self — delete `fetchBacklogIssues`, `fetchBacklogSprintStories`; KEEP `fetchSprintList` | **exact** |
| `taskflow/src/routes/dashboard/BacklogPage.tsx` (rewrite data layer) | route component | request-response + mutations | `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | **exact** — Phase 73 call-site model |
| `taskflow/src/components/app/Sidebar.tsx` (modify lines 38-42, 179-246) | UI / prefetch | request-response (warm) | self lines 127-142 (`/sprint-board` branch already swapped Phase 73) | **exact** — direct port |

---

## Pattern Assignments

### `useGhBacklogData.ts` (NEW — service / hook)

**Analog:** `taskflow/src/services/jira/greenhopper/useGhAllData.ts` (verbatim model — copy and rename).

**Key deltas vs analog (per RESEARCH §"Primary recommendation"):**
1. Drop `refetchInterval` + `refetchIntervalInBackground` lines (D-02 — backlog is opened-on-demand, no polling).
2. Route literal `/backlog` instead of `/sprint-board`.
3. Import `fetchBacklogData` from `./data`, type `GhBacklogResponse` from `./types`.
4. Cache key `['gh-backlog', boardId]`.

**Imports pattern** (copy verbatim, swap module names) — `useGhAllData.ts:27-35`:
```typescript
import { type QueryClient, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useIsActiveRoute } from '../../../hooks/useIsActiveRoute';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '../../../lib/query-constants';   // ← drop POLL_INTERVAL_MS
import { useAuthStore } from '../../../stores/auth.store';
import { readSecret } from '../../stronghold';
import { fetchAllData } from './allData';                                          // → fetchBacklogData from './data'
import type { GhAllDataResponse } from './types';                                  // → GhBacklogResponse
```

**Hook body** — clone `useGhAllData.ts:44-75` with these line-precise changes:
- Line 65: `useIsActiveRoute('/sprint-board')` → `useIsActiveRoute('/backlog')`
- Line 68: `queryKey: ['gh-all-data', boardId]` → `['gh-backlog', boardId]`
- Line 69: `fetchAllData(...)` → `fetchBacklogData(jiraBaseUrl as string, token as string, boardId as number)`
- Lines 70-71: **DELETE** `refetchInterval: POLL_INTERVAL_MS,` and `refetchIntervalInBackground: false,` (D-02)

**Auth/token bootstrap** (copy verbatim from `useGhAllData.ts:45-63`):
```typescript
const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  // WR-05: re-read the secret whenever the Jira instance changes
  let cancelled = false;
  readSecret('jira-pat')
    .then((t) => { if (!cancelled) setToken(t); })
    .catch(() => { if (!cancelled) setToken(null); });
  return () => { cancelled = true; };
}, [jiraBaseUrl]);
```

**Imperative twin (`getGhBacklogData`)** — clone `useGhAllData.ts:84-95` verbatim, swap key + fn:
```typescript
export async function getGhBacklogData(
  queryClient: QueryClient, baseUrl: string, token: string, boardId: number,
): Promise<GhBacklogResponse> {
  return queryClient.ensureQueryData({
    queryKey: ['gh-backlog', boardId],
    queryFn: () => fetchBacklogData(baseUrl, token, boardId),
    staleTime: STALE_TIME_MS,
  });
}
```

**Invalidator (`invalidateGhBacklogData`)** — clone `useGhAllData.ts:103-109` verbatim, swap key:
```typescript
export function invalidateGhBacklogData(queryClient: QueryClient, boardId?: number): void {
  if (boardId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-backlog'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-backlog', boardId] });
  }
}
```

**JSDoc style:** Mirror the file-header docblock at `useGhAllData.ts:1-25` — note the differences (no polling, route is `/backlog`, mirrors Phase 73 D-01/D-02 carry-forward).

---

### `useGhBacklogData.test.ts` (NEW — test)

**Analog:** `taskflow/src/services/jira/greenhopper/useGhAllData.test.ts` (full copy, rename references).

**Imports pattern** (`useGhAllData.test.ts:1-23`) — copy verbatim, swap module names:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./allData', () => ({ fetchAllData: vi.fn() }));     // → './data' / fetchBacklogData
vi.mock('../../stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('../../../hooks/useIsActiveRoute', () => ({ useIsActiveRoute: vi.fn() }));
```

**Wrapper helper** (`useGhAllData.test.ts:42-46`) — copy verbatim:
```typescript
function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}
```

**Test cases to port** (`useGhAllData.test.ts:48-150`):
1. `does NOT call fetchBacklogData when boardId is null` (lines 56-65)
2. `does NOT call fetchBacklogData when route is inactive` (lines 67-77)
3. `does NOT call fetchBacklogData when token is missing` (lines 79-89)
4. `calls fetchBacklogData once with (baseUrl, token, boardId) when enabled; returns raw envelope` (lines 91-106)
5. `getGhBacklogData → ensureQueryData warms cache key ['gh-backlog', boardId]` (lines 114-127)
6. `invalidateGhBacklogData invalidates all boards when boardId is undefined` (lines 131-139)
7. `invalidateGhBacklogData invalidates a specific board when boardId is provided` (lines 141-149)

**Factory pattern** (`useGhAllData.test.ts:33-40`) — adapt to backlog shape:
```typescript
function makeBacklogResponse(): GhBacklogResponse {
  return {
    issues: [],
    entityData: { statuses: {}, priorities: {}, types: {}, epics: {} },
    sprints: [],
    rankCustomFieldId: 0,
    /* …other widened fields with zero/empty defaults… */
  } as unknown as GhBacklogResponse;
}
```

---

### `types.ts` (MODIFY — widen `GhBacklogResponse`)

**Analog:** Same file, `GhAllDataResponse` declaration at `types.ts:125-157` is the structural model for the entity-data sub-shape reuse.

**Current declaration to replace** (`types.ts:159-167`):
```typescript
/**
 * Full response of GET /rest/greenhopper/1.0/xboard/plan/backlog/data.json.
 * Backlog issues — does NOT carry entity maps (consumers combine with a    // ← REMOVE comment, it is WRONG
 * prior allData fetch for resolvers).
 */
export interface GhBacklogResponse {
  issues: GhIssue[];
}
```

**New shape (from RESEARCH §"Code Examples — Widening `GhBacklogResponse`"):**
```typescript
export interface GhSprintBacklog {
  id: number;
  sequence: number;
  rapidViewId: number;
  name: string;
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
  autoStartStop: boolean;
  synced: boolean;
  startDate: string;
  endDate: string;
  activatedDate: string;
  completeDate: string;
  canUpdateSprint: boolean;
  canStartStopSprint: boolean;
  canUpdateDates: boolean;
  remoteLinks: unknown[];
  daysRemaining: number;
  timeRemaining?: { text: string; isFuture: boolean };
  goal?: string;
  issuesIds: number[];
}

export interface GhBacklogResponse {
  issues: GhIssue[];
  entityData: GhAllDataResponse['entityData'];   // REUSE — same shape per fixture (RESEARCH A3)
  rankCustomFieldId: number;
  sprints: GhSprintBacklog[];
  supportsPages: boolean;
  projects: Array<{ id: number; key: string; name: string }>;
  canManageSprints: boolean;
  canCreateIssue: boolean;
  versionData: {
    versionsPerProject: Record<string, Array<{ id: number; name: string; released: boolean }>>;
    canCreateVersion: boolean;
    isLinkToDevStatusVersionAvailable: boolean;
  };
  hasBulkChangePermission: boolean;
  issueArchivingEnabled: boolean;
  emptyFilterBoard: boolean;
  cardColorStrategy: string;
}
```

**JSDoc rewrite:** Update file-header reference list (lines 14-18) is fine; delete the obsolete "does NOT carry entity maps" comment.

---

### `index.ts` (MODIFY — barrel export)

**Analog:** Same file, line 15 (`export * from './useGhAllData';`).

**Change:** add one line after line 15:
```typescript
export * from './useGhBacklogData';
```

That single re-export covers `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData` (mirrors how the `useGhAllData` barrel covers all three Phase 73 symbols).

---

### `services/jira.ts` (MODIFY — public re-export surface; legacy delete)

**Analog (additions):** Existing GH re-export block at `services/jira.ts:2643-2664` (Phase 71+72+73 symbols).

**Add three symbols to the alphabetically-sorted block (`services/jira.ts:2643-2664`):**
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
  getGhAllData,
  getGhBacklogData,         // ← ADD (alphabetical: between getGhAllData and getGhTransitions)
  getGhTransitions,
  invalidateGhAllData,
  invalidateGhBacklogData,  // ← ADD
  invalidateGhTransitions,
  // …
  useGhAllData,
  useGhBacklogData,         // ← ADD
  useGhTransitions,
} from './jira/greenhopper';
```

**Deletions (legacy backlog REST surface, per D-09):**

1. `fetchBacklogIssues` — `services/jira.ts:2048-2105` — delete entire function body.
2. `BacklogViewData` interface — `services/jira.ts:2149-2154` — delete (verified single consumer at `services/jira/backlog.ts:8` which also goes away).
3. `fetchBacklogView` — `services/jira.ts:2177` onward — delete entire function (grep-confirmed zero non-test callers per RESEARCH §"Common Pitfalls #3").
4. Audit (planner) for any explicit re-export lines naming these functions (e.g. a `export { fetchBacklogIssues }` block) — there are none in the inspected range, but a final grep is required before merge.

---

### `services/jira/backlog.ts` (MODIFY — delete two functions, KEEP one)

**Analog:** Self.

**Delete:**
- `fetchBacklogIssues` (line 20 onward — JSDoc at lines 10-19 deletes with it). Only callers are `BacklogPage.tsx` and `Sidebar.tsx`, both swap this phase.
- `fetchBacklogSprintStories` (line 132 onward). Same callers, same swap.
- `fetchBacklogView` (line 195 onward, if defined here too — planner verifies). `BacklogViewData` import at line 8 dies with these.

**Keep:**
- `fetchSprintList` (line 83 onward) — still consumed by `FieldsSection.tsx:32, 153` (issue-detail sprint picker) per D-09a.

**Post-delete check:** `import type { BacklogViewData, JiraActiveSprint, JiraIssue }` at line 8 — drop `BacklogViewData`; keep the other two if `fetchSprintList` uses them.

---

### `BacklogPage.tsx` (REWRITE data layer)

**Analog:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx` lines 41 (import), 610-642 (hook + adapter `useMemo` chain), 776-810 (Reload handler), 1190-1206 (Reload toolbar button).

**Imports to change** (`BacklogPage.tsx:20-48`):
```typescript
// REMOVE these from imports:
import { fetchBacklogIssues, fetchBacklogSprintStories, fetchSprintList } from '...';   // lines 46-48

// ADD via @/services/jira (D-09b — no @/services/jira/greenhopper direct imports):
import {
  buildEntityMaps,
  createAdapter,
  invalidateGhBacklogData,
  useGhBacklogData,
} from '@/services/jira';
```

**Hook + adapter `useMemo` chain** — mirror `SprintBoardTab.tsx:612-642`:
```typescript
const {
  data: backlog,
  isLoading: backlogLoading,
  isFetching: backlogFetching,
  isError,
  error,
} = useGhBacklogData(boardId ?? null);

const entityMaps = useMemo(
  () => (backlog ? buildEntityMaps(backlog) : null),
  [backlog],
);
const adapt = useMemo(
  () => (entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null),
  [storyPointsFieldKey, entityMaps],
);

// Sprint membership reverse-index (D-04b) — Pattern 2 in RESEARCH
const issueIdToSprintId = useMemo(() => {
  const m = new Map<number, number>();
  for (const s of backlog?.sprints ?? []) {
    for (const id of s.issuesIds) m.set(id, s.id);
  }
  return m;
}, [backlog?.sprints]);

const adaptedIssues = useMemo<JiraIssue[]>(() => {
  if (!backlog || !adapt) return [];
  return backlog.issues.map((gh) => {
    const base = adapt(gh) as JiraIssue;
    const sprintId = issueIdToSprintId.get(gh.id);
    return sprintId !== undefined
      ? { ...base, fields: { ...base.fields, sprint: { id: sprintId } } as JiraIssue['fields'] }
      : base;
  });
}, [backlog, adapt, issueIdToSprintId]);

// D-01: backlog = issues NOT in any sprint
const backlogIssuesAdapted = useMemo(
  () => adaptedIssues.filter((i) => !i.fields.sprint),
  [adaptedIssues],
);

// D-01a: ACTIVE+FUTURE sprint sections, ordered by data.sprints[] array
const sprintSections = useMemo(() => {
  if (!backlog) return [];
  return backlog.sprints
    .filter((s) => s.state === 'ACTIVE' || s.state === 'FUTURE')  // RESEARCH A5: uppercase!
    .map((s) => ({
      sprint: s,
      issues: adaptedIssues.filter((i) =>
        (i.fields.sprint as { id?: number } | undefined)?.id === s.id),
    }));
}, [backlog, adaptedIssues]);
```

**Mutation invalidation swap** (BacklogPage.tsx:634-637, 685-687, 775-778):
- **BEFORE** (Pattern A — current pattern, ~10 occurrences):
```typescript
queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
queryClient.invalidateQueries({ queryKey: ['jira-sprint-list'] });
queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
```
- **AFTER:**
```typescript
invalidateGhBacklogData(queryClient, boardId);
// keep ['jira-sprint-stories'] / ['jira-issue-detail'] only if still relevant
// to non-backlog surfaces (issue-detail flag rollback, etc.)
```

**Optimistic-update rewrite** (BacklogPage.tsx:606-617, 619-630, 669-680 — Pattern 3 from RESEARCH):
- **BEFORE:** `setQueryData<JiraIssue[]>(['jira-backlog-issues', …composite key…], (old) => old?.filter(...))`
- **AFTER:**
```typescript
queryClient.setQueryData<GhBacklogResponse>(['gh-backlog', boardId], (old) => {
  if (!old) return old;
  return {
    ...old,
    sprints: old.sprints.map((s) =>
      s.id === sprintId
        ? { ...s, issuesIds: [...s.issuesIds, Number(issueId)] }
        : { ...s, issuesIds: s.issuesIds.filter((id) => id !== Number(issueId)) },
    ),
  };
});
```

**"Reload backlog" toolbar action** — port `SprintBoardTab.tsx:776-810` verbatim with these swaps:
- `invalidateGhAllData(queryClient, boardId)` → `invalidateGhBacklogData(queryClient, boardId)`
- Remove `gh-transitions` invalidation block (lines 794-795 in SprintBoardTab) — not relevant to backlog.
- Keep `jira-statuses` + `jira-epics-basic` invalidation per UI-SPEC D-07.
- Drop `jira-board-quickfilters` + `jira-active-sprint` (board-only).
- Status message strings per UI-SPEC: `'Backlog reloaded'` / `'Failed to reload backlog'`.

**Reload button JSX** — port `SprintBoardTab.tsx:1186-1207`:
```jsx
<span aria-live="polite" className="sr-only">{reloadBacklogStatus ?? ''}</span>
<button
  type="button"
  onClick={() => { setIsRefreshing(true); void handleReloadBacklog(); }}
  disabled={backlogFetching}
  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
  aria-label="Reload backlog"
  title="Reload backlog"
>
  <RefreshCw className={backlogFetching ? 'size-3 animate-spin' : 'size-3'} />
</button>
```

**Status auto-clear** — port `SprintBoardTab.tsx:781-786`:
```typescript
const [reloadBacklogStatus, setReloadBacklogStatus] = useState<string | null>(null);
useEffect(() => {
  if (!reloadBacklogStatus) return;
  const t = setTimeout(() => setReloadBacklogStatus(null), 3000);
  return () => clearTimeout(t);
}, [reloadBacklogStatus]);
```

**Deletions inside BacklogPage.tsx:**
- The three `useQuery` blocks at lines 227-304 (`jira-sprint-list`, `jira-backlog-sprint-stories`, `jira-backlog-issues`).
- The `refetchStories` + `refetchBacklog` callbacks (lines 250, 281, 344-347) — replaced by `handleReloadBacklog`.
- Any label-filter chip in toolbar (D-05a) — remove the control entirely; no replacement copy.
- Subtask-count chip on backlog rows (D-05b) — remove if rendered.
- `flagged` indicator path (D-05c) — remove on backlog rows; the existing `handleToggleFlag` at line 705 can stay if it serves other surfaces, otherwise delete.

---

### `Sidebar.tsx` (MODIFY — collapse 3 prefetches to 1)

**Analog (in-file):** Lines 127-142 — the Phase 73 `/sprint-board` branch that already implements the `boardId → getGhAllData(...)` chain. The `/backlog` branch is the direct mirror.

**Imports to change** (`Sidebar.tsx:32-43`):
```typescript
// REMOVE:
import {
  fetchBacklogIssues,
  fetchBacklogSprintStories,
  fetchSprintList,
} from '@/services/jira/backlog';

// ADD (alongside existing getGhAllData):
import { getGhBacklogData } from '@/services/jira';
```

**Replace the `/backlog` prefetch block (`Sidebar.tsx:179-246`):**

The current code (lines 181-200) prefetches `fetchBacklogIssues`, then chains (lines 203-245) `fetchBoardId → fetchSprintList → fetchBacklogSprintStories`. Replace with the **exact pattern from lines 131-141** of the same file (the `/sprint-board` branch):

```typescript
if (path === '/backlog') {
  queryClient
    .fetchQuery({
      queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
      queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
      staleTime: Infinity,
    })
    .then((boardId) => {
      if (boardId == null) return;   // D-08a guard
      return getGhBacklogData(queryClient, jiraBaseUrl, jiraToken, boardId);
    })
    .catch(() => {});
}
```

Keep the surrounding `jira-epics-basic` prefetch (lines 167-178) — backlog still uses it for the epic filter dropdown's "all project epics" set per RESEARCH Open Question #2.

---

## Shared Patterns

### Pattern S1: Cache key shape `['gh-<resource>', primaryKey]`

**Source:** Phase 72 D-01 (`['gh-transitions', projectId]`), Phase 73 (`['gh-all-data', boardId]`).
**Apply to:** New `useGhBacklogData` hook + `getGhBacklogData` + `invalidateGhBacklogData`.
**Excerpt** (`useGhAllData.ts:68`):
```typescript
queryKey: ['gh-all-data', boardId],   // → ['gh-backlog', boardId]
```

### Pattern S2: Dual-file re-export through `services/jira.ts`

**Source:** Memory `[[project_jira_ts_dual_file]]` + `services/jira.ts:2643-2664` (existing GH re-export block).
**Apply to:** All three new symbols. Importers in `BacklogPage.tsx` and `Sidebar.tsx` use `@/services/jira`, NEVER `@/services/jira/greenhopper`.
**Excerpt** (`services/jira.ts:2652-2662`):
```typescript
getGhAllData,
getGhTransitions,
invalidateGhAllData,
// ← add: getGhBacklogData, invalidateGhBacklogData
useGhAllData,
// ← add: useGhBacklogData
useGhTransitions,
```

### Pattern S3: Adapter at the call site via `useMemo` chain

**Source:** `SprintBoardTab.tsx:624-642`.
**Apply to:** BacklogPage. Hook returns raw `GhBacklogResponse`; route adapts.
**Excerpt:**
```typescript
const entityMaps = useMemo(() => (raw ? buildEntityMaps(raw) : null), [raw]);
const adapt = useMemo(
  () => (entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null),
  [storyPointsFieldKey, entityMaps],
);
const adapted = useMemo(() => {
  if (!raw || !adapt) return [];
  return raw.issues.map((gh) => adapt(gh) as JiraIssue);
}, [raw, adapt]);
```

### Pattern S4: Sidebar prefetch warm — boardId chain

**Source:** `Sidebar.tsx:131-141` (`/sprint-board` branch, Phase 73).
**Apply to:** `/backlog` branch in same file.
**Excerpt:**
```typescript
queryClient
  .fetchQuery({ queryKey: ['jira-board-id', ...], queryFn: ..., staleTime: Infinity })
  .then((boardId) => {
    if (boardId == null) return;          // D-08a silent skip
    return getGhBacklogData(queryClient, jiraBaseUrl, jiraToken, boardId);
  })
  .catch(() => {});
```

### Pattern S5: "Reload <surface>" toolbar action with 3s aria-live auto-clear

**Source:** `SprintBoardTab.tsx:776-810` (handler) + `1186-1207` (button JSX).
**Apply to:** BacklogPage toolbar.
**Excerpt — handler skeleton:**
```typescript
const [status, setStatus] = useState<string | null>(null);
useEffect(() => {
  if (!status) return;
  const t = setTimeout(() => setStatus(null), 3000);
  return () => clearTimeout(t);
}, [status]);

async function handleReload() {
  try {
    if (boardId) invalidateGhBacklogData(queryClient, boardId);
    await queryClient.invalidateQueries({ queryKey: ['jira-statuses'] });
    await queryClient.invalidateQueries({ queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl] });
    setStatus('Backlog reloaded');
  } catch {
    setStatus('Failed to reload backlog');
  }
}
```

### Pattern S6: Auth token bootstrap (re-read on baseUrl change)

**Source:** `useGhAllData.ts:45-63` (WR-05 — re-read secret on `jiraBaseUrl` change).
**Apply to:** New hook. Verbatim copy.

### Pattern S7: Test mocks for hook tests

**Source:** `useGhAllData.test.ts:6-16`.
**Apply to:** `useGhBacklogData.test.ts`.
**Excerpt:**
```typescript
vi.mock('./data', () => ({ fetchBacklogData: vi.fn() }));
vi.mock('../../stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('../../../hooks/useIsActiveRoute', () => ({ useIsActiveRoute: vi.fn() }));
```

---

## No Analog Found

None. Every new file has either an exact sibling in Phase 73 (`useGhAllData.*`) or a direct call-site model in `SprintBoardTab.tsx`. The `types.test.ts` file (optional, recommended by RESEARCH) has no in-repo precedent but is a trivial 3-line type-assertion test (RESEARCH §"Code Examples — Type test loading the real fixture") and does not require an analog.

---

## Metadata

**Analog search scope:**
- `taskflow/src/services/jira/greenhopper/` (all files)
- `taskflow/src/services/jira.ts` (lines 2040-2667)
- `taskflow/src/services/jira/backlog.ts`
- `taskflow/src/routes/dashboard/BacklogPage.tsx`
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
- `taskflow/src/components/app/Sidebar.tsx`

**Files scanned:** 7
**Pattern extraction date:** 2026-05-29
**Primary precedent:** Phase 73 (sprint-board-on-alldata-json) — one-to-one mapping for hook / call-site adapter / Sidebar prefetch / "Reload" toolbar / legacy cleanup.
