# Phase 58: Redesign Data Fetch of AIO Cycle Detail Executions List and Execution Detail — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 4 (modified) + 1 (test update)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | component (page) | request-response, multi-query | `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | exact — both are AIO pages using parallel TanStack queries with credential gate |
| `taskflow/src/services/aio/cycles.ts` | service | request-response | `taskflow/src/services/aio/cycles.ts` itself (add function) | self-analog — new `fetchAioTestRunsPaged` (if probe finds endpoint) mirrors `fetchAioCyclesWithDetail` |
| `taskflow/src/services/aio/issue-runs.ts` | service | request-response | `taskflow/src/services/aio/issue-runs.ts` itself (modify) | self-analog — `resolveDefectsForRuns` removal mirrors existing service refactoring pattern |
| `taskflow/src/services/aio/types.ts` | types | — | `taskflow/src/services/aio/types.ts` itself (possibly extend) | self-analog |
| `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` | test (component) | — | `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` (update) | self-analog |
| `taskflow/src/services/aio/issue-runs.test.ts` | test (service) | — | `taskflow/src/services/aio/issue-runs.test.ts` (update) | self-analog |
| `taskflow/src/services/aio/cycles.test.ts` | test (service) | — | `taskflow/src/services/aio/cycles.test.ts` (update if new fn added) | self-analog |

---

## Pattern Assignments

### `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` (component, request-response)

**Analog:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx`

**Imports pattern** (AioProjectOverviewPage.tsx lines 1-23):
```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { AioCycleSummaryItem } from '@/services/aio/types';
import type { AioTestRunStatusConfig } from '@/services/aio/types';
import {
  fetchAioCycleSummaries,
  fetchAioCyclesWithDetail,
  fetchAioProjectConfig,
} from '@/services/aio';
import { fetchJiraProjectNumericId } from '@/services/jira/projects';
import { useAuthStore } from '@/stores/auth.store';
```

**Credential gate pattern** (AioProjectOverviewPage.tsx lines 267, 277, 290):
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
const { jiraBaseUrl } = useAuthStore();
// ...
const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey;

// Resolve numeric Jira project ID (required by AIO folder/count/paged endpoints)
const jiraProjectIdQuery = useQuery({
  queryKey: ['jira', jiraBaseUrl, 'project-numeric-id', projectKey],
  queryFn: () => fetchJiraProjectNumericId(jiraBaseUrl!, token!, projectKey!),
  enabled: credGate,
  staleTime: 60 * 60 * 1000,
});
const jiraProjectId = jiraProjectIdQuery.data ?? null;
const aioGate = credGate && !!jiraProjectId;
```

**Decoupled summary query pattern** (AioProjectOverviewPage.tsx lines 334-338):
```typescript
// Summaries — separate query driven by IDs; does not block the list
const cycleSummariesQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, allIDs.join(',')],
  queryFn: () => fetchAioCycleSummaries(jiraBaseUrl!, token!, jiraProjectId!, allIDs),
  enabled: aioGate && allIDs.length > 0,
});
```

**Progress bar from summary (not from full run list)** (AioProjectOverviewPage.tsx ProgressBarCell, lines 199-260):
```typescript
// Summary drives the progress bar — testRunDistribution keys are numeric strings
function ProgressBarCell({ summary, isLoading, statusMap }) {
  if (isLoading && !summary) {
    return <Skeleton className="h-1.5 w-full rounded-full" />;
  }
  const counts = { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 };
  for (const [idStr, count] of Object.entries(summary.testRunDistribution)) {
    const status = statusMap[Number(idStr)] ?? 'notRun'; // PITFALL: always Number(idStr)
    counts[status] += count;
  }
  const total = summary.totalTests;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  // ...render progress bar segments
}
```

**DefectRow component-level query** (AioCycleDetailPage.tsx lines 44-48 — already correct):
```typescript
// ONE useQuery per defect key — benefits from TanStack cache dedup
const issueQuery = useQuery<JiraIssue | null>({
  queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey],
  queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectKey),
  enabled: !!jiraBaseUrl && !!token && !tokenLoading,
});
```

**Design change for DefectRow — pass raw jiraDefectIDs, not resolved strings:**
The redesigned page should remove the service-level `resolveDefectsForRuns` call and instead pass `run.jiraDefectIDs` (numeric array) directly to DefectRow. DefectRow already resolves string keys via `fetchJiraIssueByKey(baseUrl, token, String(numericId))` — this matches the probe-confirmed pattern from `issue-runs.ts` lines 94-103. The change: `allDefects` derivation switches from `r.defects` (resolved strings) to `r.jiraDefectIDs?.map(String)`.

**Error handling pattern** (AioCycleDetailPage.tsx lines 233-250 — keep as-is):
```typescript
{(cycleQuery.isError || runsQuery.isError) && !cycleQuery.data && !runsQuery.data && (
  <ErrorState
    error={cycleQuery.error ?? runsQuery.error}
    onRetry={() => {
      void queryClient.invalidateQueries({
        queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey],
      });
      void queryClient.invalidateQueries({
        queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
      });
    }}
    viewName="cycle detail"
  />
)}
```

---

### `taskflow/src/services/aio/cycles.ts` — new fetch function (if probe finds endpoint)

**Analog:** `fetchAioCyclesWithDetail` in `taskflow/src/services/aio/cycles.ts` lines 236-272

**Imports pattern** (cycles.ts lines 10-19):
```typescript
import { ApiError } from '../../lib/api-error';
import { AIO_PROJECTS_API_PATH, aioFetch } from './client';
import type {
  AioCycleDetailPagedResponse,
  AioCycleSummaryItem,
  // ...add new type here if probe reveals one
} from './types';
```

**POST paged fetch pattern** (cycles.ts lines 236-272 — copy structure exactly):
```typescript
export async function fetchAioTestRunsPaged(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
  cycleNumericId: number,
): Promise<AioTestRunPagedResponse> {   // shape determined by probe
  const path = `/project/${jiraProjectId}/testcycle/${cycleNumericId}/testrun/paged?c_pId=${jiraProjectId}&t=${Date.now()}`;
  const body = JSON.stringify({ startAt: 0, maxResults: 500 }); // body shape: probe-confirmed
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, AIO_PROJECTS_API_PATH, { method: 'POST', body });
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return (await response.json()) as AioTestRunPagedResponse;
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return { items: [], allIDs: [], startAt: 0, maxResults: 0, isLast: true };
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

**If probe finds no new endpoint** — no new function in cycles.ts. The runs list retains `fetchAioTestRunsForCycle` from `issue-runs.ts`.

**fetchAioCycleSummaries POST body shape** (cycles.ts lines 291-293 — critical, do not change):
```typescript
// Body MUST be a raw JSON array, not a keyed object — confirmed Pitfall 4
response = await aioFetch(baseUrl, token, path, AIO_PROJECTS_API_PATH, {
  method: 'POST',
  body: JSON.stringify(cycleIds),   // JSON.stringify([cycleNumericId]) for single cycle
});
```

---

### `taskflow/src/services/aio/issue-runs.ts` — remove/relocate resolveDefectsForRuns

**Analog:** Self — current `issue-runs.ts` lines 191-204

**Pattern being removed** (issue-runs.ts lines 191-204):
```typescript
// resolveDefectsForRuns — called inside fetchAioTestRunsForCycle before return.
// REMOVAL PLAN: stop calling resolveDefectsForRuns inside fetchAioTestRunsForCycle.
// Return runs with jiraDefectIDs[] intact and defects: [] (or raw.defects ?? []).
// DefectRow will resolve numeric IDs to string keys via per-key useQuery hooks.
async function resolveDefectsForRuns(baseUrl, token, runs) {
  return Promise.all(runs.map(async (run) => {
    const ids = run.jiraDefectIDs ?? [];
    if (ids.length === 0) return run;
    const defects = await resolveJiraDefectKeys(baseUrl, token, ids);
    return { ...run, defects };
  }));
}
```

**After removal** — `normalizeTestRun` (lines 105-127) returns `defects: raw.defects ?? []` unchanged. `fetchAioTestRunsForCycle` returns runs without resolving defects. `jiraDefectIDs` remains populated for the component to use.

**Guard:** `resolveJiraDefectKeys` (lines 94-103) can be kept or removed depending on whether any other caller needs it. If removed, import of `fetchJiraIssueByKey` from `issue-runs.ts` is also removed.

---

### `taskflow/src/services/aio/types.ts` — possible AioTestRun extension

**Analog:** Self — current `types.ts` lines 47-60

**Existing AioTestRun** (types.ts lines 47-60):
```typescript
export interface AioTestRun {
  id: string;
  status: string;
  testCaseKey: string;
  cycleKey: string;
  testCase?: { title: string; updatedDate?: string; };
  defects?: string[];         // resolved string keys (may become empty after refactor)
  jiraDefectIDs?: number[];   // raw numeric IDs — used by component after refactor
  executedDate?: string;
}
```

**If probe finds new endpoint with different run shape** — add a new type (e.g., `AioTestRunPaged`) here with probe-confirmed fields. Do not modify `AioTestRun` unless required — breaking the existing type will ripple into `AioTestRunDetailPage` and `AioTestRunsSection`.

---

### Test files

**`AioCycleDetailPage.test.tsx` update analog** (existing file, lines 1-50 — structure to copy):
```typescript
// Mock structure — copy for new test cases
vi.mock('@/services/aio', () => ({
  fetchAioCycles: vi.fn(),
  fetchAioTestRunsForCycle: vi.fn(),
  fetchAioCycleDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(), // ADD after refactor
}));
// ...
function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
```

New test cases needed (add inside existing describe blocks):

```typescript
// NEW: progress bar renders from summaryQuery even before runsQuery resolves
it('progress bar renders from cycle summary while runs are still loading', async () => {
  const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } = await import('@/services/aio');
  (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
  (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([{
    ID: 10134,
    jiraProjectID: 10134,
    detail: null,
    summary: { totalTests: 3, testRunDistribution: { '53': 1, '901': 1, '54': 1 } },
  }]);
  // runs query never resolves — simulates slow runs endpoint
  (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  // ...render and assert progress bar is visible before runs table
});
```

**`issue-runs.test.ts` update analog** (existing file lines 130-163 — defect resolution tests):
```typescript
// EXISTING test (line 130): 'resolves jiraDefectIDs to string Jira keys in run.defects[]'
// After refactor: UPDATE this test to verify runs return raw jiraDefectIDs[] and defects: []
// The service must NOT call fetchJiraIssueByKey any more.

it('after refactor: returns run with jiraDefectIDs populated and defects: [] (resolution moved to component)', async () => {
  // mock apiFetch to return run with jiraDefectIDs: [186227]
  // assert result[0].jiraDefectIDs === [186227]
  // assert result[0].defects === []
  // assert fetchJiraIssueByKey was NOT called
  expect(mockedFetchJiraIssueByKey).not.toHaveBeenCalled();
});
```

**`cycles.test.ts` update** (only if new endpoint function is added):
Copy pattern from existing `fetchAioCycleSummaries` describe block (lines 218-260):
```typescript
describe('fetchAioTestRunsPaged', () => {  // new function name TBD from probe
  beforeEach(() => { vi.clearAllMocks(); });
  it('returns items[] on 200', async () => { /* ... */ });
  it('returns empty on 404', async () => { /* ... */ });
  it('throws ApiError on 401', async () => { /* ... */ });
  it('throws "Cannot reach AIO" on network error', async () => { /* ... */ });
});
```

---

## Shared Patterns

### Credential Gate (mandatory on every AIO query)
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 267, 277, 290
**Apply to:** All `useQuery` hooks in `AioCycleDetailPage.tsx`
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey;
const aioGate = credGate && !!jiraProjectId; // add when numeric ID is resolved
// Every useQuery must have: enabled: credGate (or aioGate if numeric ID needed)
// NEVER omit !tokenLoading — causes 401 flash on first render (Pitfall 6)
```

### AIO_STATUS_MAP / Number(idStr) conversion
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` ProgressBarCell lines 221-223
**Apply to:** Progress bar in `AioCycleDetailPage.tsx` when using summary endpoint
```typescript
for (const [idStr, count] of Object.entries(summary.testRunDistribution)) {
  const status = statusMap[Number(idStr)] ?? 'notRun'; // ALWAYS Number(idStr) — Pitfall 5
  counts[status] += count;
}
```

### fetchAioCycleSummaries POST body shape
**Source:** `taskflow/src/services/aio/cycles.ts` lines 291-293
**Apply to:** Any call to `fetchAioCycleSummaries` for a single cycle
```typescript
// Body is a raw JSON array — NOT { ids: [...] } — confirmed Pitfall 4 (57-UAT fix 3)
body: JSON.stringify([cycleNumericId])
```

### aioFetch POST pattern
**Source:** `taskflow/src/services/aio/cycles.ts` lines 255-258
**Apply to:** Any new fetch function if probe finds a POST endpoint
```typescript
response = await aioFetch(baseUrl, token, path, AIO_PROJECTS_API_PATH, {
  method: 'POST',
  body: JSON.stringify(bodyObj),
});
// AIO_PROJECTS_API_PATH = '/rest/aio-tcms/1.0' (new surface)
// AIO_API_PATH           = '/rest/aio-tcms-api/1.0' (old surface)
```

### 401/404/network error handling in service functions
**Source:** `taskflow/src/services/aio/cycles.ts` lines 143-151 (fetchAioCycleDetail)
**Apply to:** Any new fetch function added to `cycles.ts`
```typescript
if (response.status === 401) {
  throw new ApiError('Invalid token or token has expired', 401, 'jira');
}
if (response.status === 404) {
  return { items: [], allIDs: [], startAt: 0, maxResults: 0, isLast: true }; // or [] for arrays
}
throw new Error(`AIO request failed with status ${response.status}`);
```

### useQuery key conventions for AIO
**Source:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` lines 102-112
**Apply to:** New summary query in `AioCycleDetailPage.tsx`
```typescript
// Existing cycle detail key:
['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey]
// Existing runs key (keep or rename):
['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]
// New cycle summary key for single-cycle progress bar:
['aio', jiraBaseUrl, 'cycle-summaries', projectKey, String(cycleNumericId)]
// Matches AioProjectOverviewPage pattern — safe to share with overview cache
```

---

## No Analog Found

All Phase 58 files have close analogs. The one probe-gated scenario has no analog:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| New run-list endpoint type (if any) | types | — | Shape unknown until probe; `AioCycleDetailPagedResponse` is closest structural analog once fields confirmed |

---

## Critical Probe Dependencies

The following pattern decisions are **conditional on probe findings** (58-PROBE-FINDINGS.md):

| Decision | If probe finds endpoint | If no endpoint found |
|----------|------------------------|----------------------|
| New fetch function in `cycles.ts` | Add `fetchAioTestRunsPaged` (copy `fetchAioCyclesWithDetail` pattern) | No new function |
| `runsQuery` data source | New POST paged endpoint with numeric `cycleNumericId` | Retain `fetchAioTestRunsForCycle` from `issue-runs.ts` |
| `jiraDefectIDs` → `defects` resolution | Determined by whether new endpoint returns string keys or numeric IDs | Remove `resolveDefectsForRuns` from service; move to component |
| `cycleNumericId` resolution | Required for any `/rest/aio-tcms/1.0` run endpoint | Required for summary query (progress bar decoupling) |

The **progress bar decoupling** (`summaryQuery` driving progress bar independently of `runsQuery`) is a firm pattern regardless of probe outcome — it uses the already-confirmed `fetchAioCycleSummaries` + `jiraProjectId` resolution flow from `AioProjectOverviewPage.tsx`.

---

## Metadata

**Analog search scope:**
- `taskflow/src/routes/dashboard/` (AIO page components)
- `taskflow/src/services/aio/` (service + types)
- `taskflow/src/hooks/` (credential hook)

**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-05-15
