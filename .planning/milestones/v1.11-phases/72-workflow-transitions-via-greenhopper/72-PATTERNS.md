# Phase 72: Workflow Transitions via GreenHopper - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 10 (2 new modules + 2 new test files + 6 modified)
**Analogs found:** 10 / 10

This phase is a wiring + cutover phase. Every required primitive (React Query `staleTime: Infinity` hook, `apiFetch` Jira call, `ApiError` 401/403 propagation, warn-once helper, dual-file re-export, sprint-board toolbar button) already exists in the repo. The planner's job is to point each new/modified file at the right existing analog and copy its shape.

All file paths below are absolute. Line ranges are from the current `main` branch (verified during pattern extraction).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/jira/greenhopper/transitions.ts` (extend) | service (cache hook + adapter) | request-response (cached) | `src/hooks/useBoardId.ts` (hook pattern) + `src/services/jira/greenhopper/entityMaps.ts` (resolver+warnOnce) | exact (both halves) |
| `src/services/jira/statuses.ts` (NEW) | service (fetcher) | request-response | `src/services/jira/fields.ts:127-159` (`fetchProjectStatuses`) | exact |
| `src/services/jira/statuses.test.ts` (NEW) | test | request-response | `src/services/jira/greenhopper/transitions.test.ts` (existing fetcher test) | exact |
| `src/services/jira/greenhopper/transitions.test.ts` (extend) | test | request-response | itself + `src/services/jira/greenhopper/entityMaps.test.ts` warn-once tests | exact |
| `src/services/jira/greenhopper/index.ts` (extend) | barrel | n/a | itself (line 13 already barrel-exports `transitions.ts`) | exact |
| `src/services/jira.ts` (re-export region 2743-2758 + delete 678-711) | dual-file barrel | n/a | itself (lines 2743-2758 — existing GH re-export block) | exact |
| `src/services/jira/transitions.ts` (delete `fetchTransitions`) | service deletion | n/a | itself (lines 12-45) | exact |
| `src/routes/dashboard/StatusPopover.tsx` (modify) | component (hook consumer) | request-response | itself, lines 42-55 (existing `useQuery(['transitions', issueKey])`) | exact |
| `src/routes/dashboard/SprintBoardTab.tsx` (modify prefetch + add toolbar button) | component (imperative consumer + toolbar) | request-response + event-driven | itself, lines 710-716 (existing `staleTime: Infinity` query) + lines 1101-1117 (existing RefreshCw button) | exact |
| `src/routes/dashboard/BulkActionBar.tsx` (modify) | component (imperative in async handler) | request-response | itself, lines 156-190 (existing parallel batch loop) | exact (in-file) |
| `src/routes/dashboard/QuickCreateInput.tsx` (modify) | component (imperative post-create) | request-response | itself, lines 41-65 (existing create→transition→post flow) | exact (in-file) |

## Pattern Assignments

### `src/services/jira/greenhopper/transitions.ts` (extend) — cache hook + helpers + adapter

**Existing file already contains** `fetchGhTransitions` (lines 26-57). Add to the SAME file: `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`, private `indexTransitions`, private `adaptToJiraTransition`, private `ensureStatusMap` helper, and a module-private `warnOnce` (or import from a shared module — see Shared Patterns §1).

**Analog #1 — staleTime/gcTime: Infinity hook**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/hooks/useBoardId.ts:11-23`
```typescript
export function useBoardId(
  jiraBaseUrl: string | null,
  jiraToken: string | null,
  projectKey: string | null,
): { boardId: number | null; isLoading: boolean } {
  const { data: boardId, isLoading } = useQuery({
    queryKey: ['jira-board-id', projectKey, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl ?? '', jiraToken ?? '', projectKey ?? ''),
    staleTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraToken && !!projectKey,
  });
  return { boardId: boardId ?? null, isLoading };
}
```
Copy directly. Notes for new `useGhTransitions`:
- ADD `gcTime: Infinity` (this analog only sets staleTime — see Pitfall 2 in RESEARCH).
- queryKey must be `['gh-transitions', projectId, issueTypeId]` (per-type adapted) and the underlying envelope read MUST be `queryClient.ensureQueryData({ queryKey: ['gh-transitions-envelope', projectId], ... })`.
- `useBoardId` accepts token directly as a string. For Phase 72, token lookup pattern from `StatusPopover.tsx:50` (`readSecret('jira-pat')`) is the more apt analog.

**Analog #2 — fetcher already in the same file**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/greenhopper/transitions.ts:26-57`
The cache hook calls `fetchGhTransitions(baseUrl, token, projectId)` unchanged. JSDoc style and `ApiError` handling already established. Do NOT change `fetchGhTransitions`'s signature.

**Analog #3 — warn-once private helper + resolver fallback**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/greenhopper/entityMaps.ts:38-83`
```typescript
// Module-level guard for warnOnce semantics (D-07).
const seenMissing = new Set<string>();

function warnOnce(kind: string, id: string): void {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}

// Test-only escape hatch:
export function __resetWarnOnce(): void {
  seenMissing.clear();
}

// Resolver with fallback shape:
export function resolveStatus(
  id: string,
  maps: EntityMaps,
): { id: string; name: string; statusCategory: { key: StatusCategoryKey } } {
  const entry = maps.statuses[id];
  if (!entry) {
    warnOnce('status', id);
    return { id, name: 'Unknown', statusCategory: { key: 'indeterminate' } };
  }
  return {
    id,
    name: entry.status.name,
    statusCategory: { key: narrowStatusCategoryKey(entry.status.statusCategory.key) },
  };
}
```
Apply to:
- `indexTransitions(envelope, projectId, issueTypeId)` — `warnOnce('gh-transitions-workflow', \`${projectId}:${issueTypeId}\`)` on missing workflow, return `[]`.
- `adaptToJiraTransition(gh, statusMap)` — `warnOnce('gh-transitions-status', String(gh.toStatusId))` on missing status; synthesize per D-06b `{id, name: \`Status ${toStatusId}\`, statusCategory: {id: 0, key: 'indeterminate', name: 'Unknown'}}`.
- Export `__resetWarnOnce` for tests (mirrors entityMaps.ts:54-56).

**Type contract — `JiraTransition` shape the adapter MUST produce**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira.ts:183-191`
```typescript
export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory?: { id: number; key: string; name: string };
  };
}
```
Note `statusCategory` here is `{id, key, name}` — NOT the `{key}` shape that `resolveStatus` in entityMaps uses. The new adapter must produce the **JiraTransition** shape, not the EntityMaps `Status` shape. Reuse the resolver *pattern*, not its return type.

**Envelope type (already exists, no change)**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/greenhopper/types.ts:174-195`
```typescript
export interface GhTransition {
  transitionId: number;
  name: string;
  toStatusId: number;
  fromStatusId?: number;
  hasScreen: boolean;
  hasConditions: boolean;
  hasValidators: boolean;
  isInitial: boolean;
  isGlobal: boolean;
}

export interface GhTransitionsResponse {
  projectAndIssueTypeToWorkflow: Record<string, Record<string, string>>;
  workflowToTransitions: Record<string, GhTransition[]>;
}
```

---

### `src/services/jira/statuses.ts` (NEW)

**Analog:** `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/fields.ts:127-159` (`fetchProjectStatuses`)

**Imports + fetcher pattern** (lines 127-159):
```typescript
import { ApiError } from '../../lib/api-error';   // adjust relative path: '../../lib/api-error'
import { apiFetch } from '../../lib/apiFetch';

export async function fetchProjectStatuses(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraProjectStatus[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project/${projectKey}/statuses`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Fields',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch project statuses', response.status, 'jira');
    }
    throw new Error(`Failed to fetch project statuses: ${response.status}`);
  }
  const data: Array<{ statuses: JiraProjectStatus[] }> = await response.json();
  // ... flatten
}
```
Adaptations for `fetchAllJiraStatuses`:
- URL: `/rest/api/2/status` (no path params).
- Operation label: `'Load Statuses'` (matches existing one-word pattern).
- No flattening — response is already a flat `JiraStatus[]`.
- Export `JiraStatus` interface co-located: `{id: string; name: string; statusCategory: {id: number; key: string; name: string}}` (this is the exact shape required by `JiraTransition.to.statusCategory` at `jira.ts:189`).

---

### `src/services/jira/statuses.test.ts` (NEW)

**Analog:** `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/greenhopper/transitions.test.ts:1-80`

**Imports + mock + structure**:
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAllJiraStatuses } from './statuses';

const mockedFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('fetchAllJiraStatuses', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns the status array on 200', async () => { /* ... */ });
  it('calls /rest/api/2/status with Bearer auth', async () => { /* ... */ });
  it('throws ApiError on 401', async () => { /* ... */ });
  it('throws ApiError on 403', async () => { /* ... */ });
  it('throws generic Error on 500', async () => { /* ... */ });
});
```
Mirrors test naming conventions from `transitions.test.ts` (`'throws ApiError with "Invalid token" on 401'` style). Reuses the `mockResolvedValue({ ok, status, json } as unknown as Response)` idiom from `transitions.test.ts:44-48`.

---

### `src/services/jira/greenhopper/transitions.test.ts` (extend)

**Analog:** itself (existing fetcher tests, lines 1-200+) + `entityMaps.test.ts` for warn-once test idiom.

**Hook test pattern** — use the React Query test wrapper. Add tests:
- `indexTransitions` — workflow hit, workflow miss (returns `[]` + warns), multi-type same project.
- `adaptToJiraTransition` — status hit, status miss (fallback shape + warns), `String(toStatusId)` conversion.
- `useGhTransitions` — caches by `projectId`, dedupes across (projectId, typeIdA) and (projectId, typeIdB).
- `getGhTransitions` — `ensureQueryData` returns cache on hit, fetches on miss.
- `invalidateGhTransitions(qc, projectId)` — invalidates one project; `invalidateGhTransitions(qc)` — invalidates all.
- warn-once invariant: two misses of same `(projectId, typeId)` → ONE `console.warn`.
- cache config invariant: assert `staleTime === Infinity` AND `gcTime === Infinity`.

Use `__resetWarnOnce()` in `beforeEach` (mirrors `entityMaps.test.ts`). Use `vi.spyOn(console, 'warn').mockImplementation(() => {})`.

---

### `src/services/jira/greenhopper/index.ts` (extend)

**Analog:** itself, lines 1-15.
```typescript
export * from './adapter';
export * from './allData';
export * from './data';
export * from './details';
export * from './entityMaps';
export * from './transitions';   // ← already exports the new public symbols via `export *`
export * from './types';
```
**No change needed** if new symbols (`useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`) are top-level exports of `transitions.ts`. They will flow through `export *`. Verify barrel match after edit.

---

### `src/services/jira.ts` (re-export region + delete legacy)

**Analog #1 — existing GH re-export block (the exact pattern to extend):**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira.ts:2743-2758`
```typescript
// GreenHopper (Phase 71) — re-exported here per D-05 (legacy dual-file convention; consumers import from 'services/jira').
export {
  adaptIssue,
  buildEntityMaps,
  createAdapter,
  fetchAllData,
  fetchBacklogData,
  fetchGhTransitions,
  fetchIssueDetails,
  resolveEpic,
  resolveParent,
  resolvePriority,
  resolveStatus,
  resolveType,
} from './jira/greenhopper';
```
Add (alphabetically): `getGhTransitions`, `invalidateGhTransitions`, `useGhTransitions`. Update comment to reference "Phase 71 + Phase 72".

For `fetchAllJiraStatuses` + `JiraStatus` (NEW from `./jira/statuses`), add a new sibling export block — see the existing `./jira/fields` re-exports elsewhere in `jira.ts` for the pattern (grep `from './jira/` to find the prior art).

**Analog #2 — DELETION target:**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira.ts:670-711` (40-line block from JSDoc through closing brace)
```typescript
/**
 * Fetch available transitions for a Jira issue.
 * ...
 */
export async function fetchTransitions(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraTransition[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;
  // ... entire body ...
  return data.transitions as JiraTransition[];
}
```
DELETE this block entirely. `JiraTransition` interface at lines 183-191 STAYS (used by GH adapter and consumers).

---

### `src/services/jira/transitions.ts` (delete `fetchTransitions`, keep `postTransition`)

**Analog:** itself, lines 12-45 (DELETE) vs lines 50-83 (KEEP).
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/transitions.ts:12-45`
```typescript
export async function fetchTransitions(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraTransition[]> {
  // ... DELETE entire function ...
}
```
After deletion, `postTransition` (lines 50-83) remains as the only export. Update the file's top-level JSDoc comment to "Jira issue transition POST operation" (the GET is gone).

Verify the import `import type { JiraTransition } from './types';` (line 7) is still needed — `postTransition` does not use `JiraTransition`, so this import can be removed too.

---

### `src/routes/dashboard/StatusPopover.tsx` (modify)

**Analog (in-file):** lines 42-55 (existing `useQuery` block to be REPLACED).
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/StatusPopover.tsx:42-55`
```typescript
const {
  data: transitions,
  isLoading,
  isError,
  refetch,
} = useQuery({
  queryKey: ['transitions', issueKey],
  queryFn: async () => {
    const resolvedToken = token ?? (await readSecret('jira-pat').catch(() => null));
    if (!resolvedToken) return [];
    return fetchTransitions(jiraBaseUrl, resolvedToken, issueKey);
  },
  enabled: false, // Lazy — only fetch when popover opens
});
```
**Replace with**:
```typescript
const { data: transitions, isLoading, isError, refetch } = useGhTransitions(
  Number(issue.fields.project.id),
  issue.fields.issuetype.id,
);
```
This requires the prop surface to change from `issueKey` to passing the full `JiraIssue` (or `projectId: number` + `issueTypeId: string` directly). Per CONTEXT D-05, `projectId` is `Number(issue.fields.project.id)` and `issueTypeId` is `issue.fields.issuetype.id`. CONTEXT Discretion area allows the planner to choose between (a) accept IDs directly or (b) accept `(issue: JiraIssue)` — pick (a) to minimize the call-site contract change.

Remove `enabled: false` + manual `refetch()` on open — the cache is project-scoped so eager fetch is cheap and the popover gets data without delay. Keep the `refetch` returned by the hook for explicit retry on error UI.

**Import swap (line 17):**
- Remove: `import { fetchTransitions } from '@/services/jira';`
- Add: `import { useGhTransitions } from '@/services/jira';`
- The `readSecret` import (line 18) can be removed if no longer used after hook swap.

---

### `src/routes/dashboard/SprintBoardTab.tsx` (modify: prefetch loop + toolbar button)

**Analog #1 (in-file) — existing `staleTime: Infinity` query:**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/SprintBoardTab.tsx:709-716`
```typescript
const { data: workflowStatuses } = useQuery({
  queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
  queryFn: () =>
    fetchProjectStatuses(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
  staleTime: Infinity,
  enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});
```
**Use this exact shape** to fetch the project id once when the board mounts (via the existing `workflowStatuses` response which carries the project id — see RESEARCH Open Question #4), or derive `projectId` from the first issue (`localIssues[0]?.fields.project.id`).

**Analog #2 (in-file) — prefetch loop to REPLACE:**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/SprintBoardTab.tsx:729-746`
```typescript
// biome-ignore lint/correctness/useExhaustiveDependencies: ...
useEffect(() => {
  if (!jiraBaseUrl || !jiraToken || !localIssuesRef.current.length) return;
  const issues = localIssuesRef.current;
  void Promise.allSettled(
    issues.map((issue) =>
      queryClient.fetchQuery({
        queryKey: ['transitions', issue.key],
        queryFn: () => fetchTransitions(jiraBaseUrl, jiraToken ?? '', issue.key),
        staleTime: 5 * 60 * 1000,
      }),
    ),
  );
}, [jiraBaseUrl, jiraToken, localIssues.length, queryClient]);

function getTransitions(issueKey: string): JiraTransition[] | undefined {
  return queryClient.getQueryData<JiraTransition[]>(['transitions', issueKey]);
}
```
**Replace with** a single `useGhTransitions(projectId, sentinelTypeId)` call OR (recommended per RESEARCH Pitfall 7) a single envelope-level read plus a cache selector. Sketch:
```typescript
// Eagerly warm the envelope once per project mount:
const projectId = Number(localIssues[0]?.fields.project.id);
useGhTransitions(projectId, localIssues[0]?.fields.issuetype.id ?? '');
// (the underlying ['gh-transitions-envelope', projectId] cache feeds every per-type read below)

function getTransitions(issue: JiraIssue): JiraTransition[] | undefined {
  return queryClient.getQueryData<JiraTransition[]>([
    'gh-transitions',
    Number(issue.fields.project.id),
    issue.fields.issuetype.id,
  ]);
}
```
Then `getTransitions` callers (currently keyed by `issueKey`) must be updated to pass the full issue object. Audit call sites of `getTransitions` in `SprintBoardTab.tsx` and adjust signatures.

**Analog #3 (in-file) — toolbar button:**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/SprintBoardTab.tsx:1101-1117`
```typescript
<div className="absolute right-0 top-0 h-full px-3 flex items-center gap-2 bg-background border-l border-border/20">
  <span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
  <button
    type="button"
    onClick={() => {
      setIsRefreshing(true);
      setStickyHeader(null);
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-subtasks'] });
    }}
    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    aria-label="Refresh"
  >
    <RefreshCw className="size-3" />
  </button>
</div>
```
**Add a sibling button** in the same flex container. Use a distinct icon (e.g., `Workflow` from `lucide-react`) and `aria-label="Reload workflow transitions"`. Reuse the same className for visual consistency. On click:
```typescript
onClick={() => {
  const pid = Number(localIssues[0]?.fields.project.id);
  if (!Number.isFinite(pid)) return;
  invalidateGhTransitions(queryClient, pid);
  queryClient.invalidateQueries({ queryKey: ['jira-statuses'] });
}}
```
**Feedback UX caveat (RESEARCH Pitfall 5):** D-07 says "toast" but no toast library is installed. Use the existing `lastRefreshed` inline-text idiom on line 1103 for success, and surface error via the existing query `error` channel. Do NOT add a toast dependency.

**Import swaps (lines 30-40):**
- Remove `fetchTransitions` from the `@/services/jira` import.
- Add `useGhTransitions, invalidateGhTransitions` to the same import.
- `JiraTransition` type import (line 30) stays — the hook returns it.

---

### `src/routes/dashboard/BulkActionBar.tsx` (modify)

**Analog (in-file) — parallel batch loop to MODIFY:**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/BulkActionBar.tsx:156-190`
```typescript
if (targetStatus !== null) {
  await parallelBatch(
    keys,
    async (key) => {
      const transitions = await fetchTransitions(jiraBaseUrl, jiraToken, key);
      const transition = transitions.find(
        (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase(),
      );
      if (!transition) {
        throw new Error(`No transition to "${targetStatus}"`);
      }
      await postTransition(jiraBaseUrl, jiraToken, key, transition.id);
    },
    // ...
  );
}
```
**Replace** the inner `fetchTransitions` with `getGhTransitions`:
```typescript
async (key) => {
  const issue = issues.find((i) => i.key === key);
  if (!issue) throw new Error(`Issue ${key} not in selection`);
  const projectId = Number(issue.fields.project.id);
  const issueTypeId = issue.fields.issuetype.id;
  const transitions = await getGhTransitions(
    queryClient, jiraBaseUrl, jiraToken, projectId, issueTypeId,
  );
  const transition = transitions.find(
    (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase(),
  );
  if (!transition) throw new Error(`No transition to "${targetStatus}"`);
  await postTransition(jiraBaseUrl, jiraToken, key, transition.id);
}
```
This requires the parallelBatch handler to have access to the `issues` array (currently the loop iterates over `keys: string[]`). Audit the handler signature — `BulkActionBar.tsx:8-22` shows the component already receives `JiraIssue[]` via props; thread it through to the closure.

**Import swap (line 20):**
- Remove `fetchTransitions`, keep `postTransition`, `updateIssueField`.
- Add `getGhTransitions`.
- Add `useQueryClient` from `@tanstack/react-query` if not present; call `const queryClient = useQueryClient();` inside the component.

---

### `src/routes/dashboard/QuickCreateInput.tsx` (modify)

**Analog (in-file) — create→transition→post flow to MODIFY:**
Source: `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/QuickCreateInput.tsx:41-65`
```typescript
async function handleSubmit() {
  if (!value.trim()) return;
  setIsSubmitting(true);
  setError(null);
  try {
    const { key: newKey } = await createIssue(jiraBaseUrl, jiraToken, projectKey, value.trim());
    // Attempt to move the new issue to the target column
    const transitions = await fetchTransitions(jiraBaseUrl, jiraToken, newKey);
    const t = transitions.find((tr) => tr.to.id === statusId);
    if (t) {
      await postTransition(jiraBaseUrl, jiraToken, newKey, t.id);
    }
    // ...
  } catch (err) { /* ... */ }
}
```
**Replace** with `getGhTransitions`. Per RESEARCH Pitfall 6, this component does not currently know `projectId` (it has `projectKey`) or `issueTypeId`. Options:
- **Option A (recommended):** Add `projectId: number` and `issueTypeId: string` to `QuickCreateInputProps` and pass them from the parent (SprintBoardTab knows both from the column context). This is a small prop addition consistent with CONTEXT D-05.
- **Option B:** Widen `createIssue`'s return to include `issueTypeId` so the post-create flow can read it. Larger surface change.

Pick Option A. Updated handler:
```typescript
const { key: newKey } = await createIssue(jiraBaseUrl, jiraToken, projectKey, value.trim());
const transitions = await getGhTransitions(
  queryClient, jiraBaseUrl, jiraToken, projectId, issueTypeId,
);
const t = transitions.find((tr) => tr.to.id === statusId);
if (t) await postTransition(jiraBaseUrl, jiraToken, newKey, t.id);
```

**Import swap (line 17):**
- Remove `fetchTransitions`.
- Add `getGhTransitions`.
- Add `useQueryClient` from `@tanstack/react-query`.

---

## Shared Patterns

### 1. Warn-Once Helper
**Source:** `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/greenhopper/entityMaps.ts:38-56`
**Apply to:** `src/services/jira/greenhopper/transitions.ts` (new `indexTransitions` + new `adaptToJiraTransition`)

Decision per RESEARCH Pattern 3 planner note: prefer Option (a) — **extract** the helper into `src/services/jira/greenhopper/warnOnce.ts` and have both `entityMaps.ts` and `transitions.ts` import from it. This keeps the `seenMissing` Set unified so the same missing id never warns twice across modules (RESEARCH Pitfall 4).

If the planner picks Option (b) (duplicate the 7-line helper into `transitions.ts`), document the decision in PLAN.md and the divergence in JSDoc.

```typescript
// New file: src/services/jira/greenhopper/warnOnce.ts (if Option a)
const seenMissing = new Set<string>();

export function warnOnce(kind: string, id: string): void {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}

export function __resetWarnOnce(): void {
  seenMissing.clear();
}
```
Refactor `entityMaps.ts:38-56` to import from this module; remove its private copy. Update `entityMaps.test.ts` to import `__resetWarnOnce` from the new path.

### 2. Dual-File Re-Export
**Source:** `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira.ts:2743-2758` (existing Phase 71 GH re-export block)
**Apply to:** Every new public symbol in this phase.

Per memory `[[project_jira_ts_dual_file]]`, all 60 consumers import from `@/services/jira` (the legacy `jira.ts`), NOT from `@/services/jira/greenhopper` or `@/services/jira/statuses`. Add re-exports for:
- `useGhTransitions, getGhTransitions, invalidateGhTransitions` → from `./jira/greenhopper`
- `fetchAllJiraStatuses, type JiraStatus` → from `./jira/statuses`

Use the same comment style: `// GreenHopper transitions cache (Phase 72) — re-exported per dual-file convention.`

### 3. apiFetch + ApiError Error Envelope
**Source:** `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/fields.ts:133-146`
**Apply to:** `fetchAllJiraStatuses` (new).
Pattern: `apiFetch('jira', url, {headers: {Authorization: 'Bearer ...'}}, 'OperationLabel')` → if `!ok && (401||403)` → `throw new ApiError(message, status, 'jira')` → else `throw new Error(...)`. The `apiFetch` wrapper already drives `setJiraConnected(false)` on auth failure; do not duplicate that side-effect.

### 4. Vitest Mock-Then-Import Idiom
**Source:** `/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/greenhopper/transitions.test.ts:1-12`
**Apply to:** New `statuses.test.ts` and extended `transitions.test.ts`.
Pattern:
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./client', () => ({ greenhopperFetch: vi.fn(), GREENHOPPER_API_PATH: '...' }));
import { greenhopperFetch } from './client';
import { fetchGhTransitions } from './transitions';
const mockedGhFetch = vi.mocked(greenhopperFetch);
```
The `vi.mock(...)` call MUST appear before the `import` of the mocked module — Vitest hoists it. Mirror this exactly in new tests.

## No Analog Found

None. Every file in this phase maps to an existing analog within ≤2 hops in the codebase.

## Metadata

**Analog search scope:**
- `src/services/jira/**` (all files)
- `src/services/jira/greenhopper/**` (all files — Phase 71 deliverables)
- `src/hooks/**`
- `src/routes/dashboard/{StatusPopover,SprintBoardTab,BulkActionBar,QuickCreateInput}.tsx`
- `src/services/jira.ts` (lines 180-200, 670-720, 2735-2760)

**Files scanned:** 12 (read in full or targeted ranges per the "no re-reads" rule).
**Pattern extraction date:** 2026-05-28
