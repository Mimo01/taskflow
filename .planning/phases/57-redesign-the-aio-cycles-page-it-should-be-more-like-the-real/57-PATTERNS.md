# Phase 57: Redesign AIO Cycles Page — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | component (page) | request-response | `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (itself — rewrite) | self |
| `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` | test | request-response | `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` (itself — rewrite) | self |
| `taskflow/src/services/aio/cycles.ts` | service | request-response | `taskflow/src/services/aio/cycles.ts` (itself — extend) | self |
| `taskflow/src/services/aio/cycles.test.ts` | test | request-response | `taskflow/src/services/aio/cycles.test.ts` (itself — extend) | self |
| `taskflow/src/services/aio/types.ts` | model | — | `taskflow/src/services/aio/types.ts` (itself — extend) | self |
| `taskflow/src/services/jira/users.ts` | service | request-response | `taskflow/src/services/jira/users.ts` (itself — extend) | self |
| `taskflow/src/services/jira/users.test.ts` | test | request-response | `taskflow/src/services/aio/cycles.test.ts` | role-match |
| `taskflow/src/lib/aioUtils.ts` | utility | transform | `taskflow/src/lib/aioUtils.ts` (itself — extend) | self |
| `taskflow/src/lib/aioUtils.test.ts` | test | transform | `taskflow/src/services/aio/cycles.test.ts` | role-match |

---

## Pattern Assignments

### `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (component/page, request-response) — COMPLETE REWRITE

**Analog:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (existing file is the primary source; preserve all patterns, replace structure)

**Imports pattern** (lines 1–15 of existing file):
```typescript
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FlaskConical } from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioCycleStatusBadgeClass } from '@/lib/statusStyles';
import { normalizeStatus } from '@/lib/aioUtils';
import type { AioCycle, AioTestRun } from '@/services/aio';
import { fetchAioCycles, fetchAioTestRunsForCycle } from '@/services/aio';
import { useAuthStore } from '@/stores/auth.store';
```
For the rewrite, keep the same import path aliases (`@/`) and add:
```typescript
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { normalizeStatusById, AIO_STATUS_MAP } from '@/lib/aioUtils';
import type { AioFolder, AioCycleDetailItem, AioCycleSummaryItem } from '@/services/aio/types';
import {
  fetchAioFolderTree,
  fetchAioFolderCycleCounts,
  fetchAioCyclesWithDetail,
  fetchAioCycleSummaries,
} from '@/services/aio';
import { fetchJiraUserByUsername } from '@/services/jira/users';
```

**Credential gate pattern** (lines 111–119 of existing file):
```typescript
const { projectKey } = useParams<{ projectKey: string }>();
const { jiraBaseUrl } = useAuthStore();
const { token, isLoading: tokenLoading } = useAioCredentials();

// All useQuery calls gate on this enabled expression — never put token in queryKey
enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey
```

**Query key prefix pattern** (line 117 of existing file — mandatory):
```typescript
// Established prefix for ALL AIO queries — never omit jiraBaseUrl as second element
queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey]
// New queries follow the same prefix:
queryKey: ['aio', jiraBaseUrl, 'folders', projectKey]
queryKey: ['aio', jiraBaseUrl, 'cycle-count', projectKey]
queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey]
queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, allIDs.join(',')]
// Jira user queries use 'jira' prefix (different service):
queryKey: ['jira', jiraBaseUrl, 'user-by-username', ownedByID]
```

**Page shell pattern** (lines 139–144 of existing file):
```typescript
// REWRITE: change from flex flex-col to flex flex-row for the content area
return (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
      <h1 className="text-xl font-semibold">Cycles — {projectKey ?? ''}</h1>
      {/* NEW: Switch goes here, right-aligned */}
    </div>
    {/* NEW: content area is flex-row instead of flex-col */}
    <div className="flex flex-row flex-1 overflow-hidden">
      {/* LEFT PANEL: w-64 shrink-0 overflow-y-auto border-r border-border bg-muted/10 */}
      {/* RIGHT PANEL: flex-1 overflow-auto */}
    </div>
  </div>
);
```

**Delayed loading + skeleton pattern** (lines 121–122 of existing file):
```typescript
// Apply useDelayedLoading to BOTH folder tree and cycle list loading states
const showFolderSkeleton = useDelayedLoading(folderTreeQuery.isLoading);
const showCycleSkeleton = useDelayedLoading(cycleListQuery.isLoading);
```

**Error + retry pattern** (lines 145–157 of existing file):
```typescript
{isError && !data && (
  <div className="p-4">
    <ErrorState
      error={error}
      onRetry={() =>
        queryClient.invalidateQueries({
          queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
        })
      }
      viewName="cycles"
    />
  </div>
)}
```

**Folder tree button pattern** (lines 174–188 of existing file — the accordion header is the direct ancestor of the new `FolderNode` button):
```typescript
// Existing folder button pattern — new FolderNode copies this structure with added indentation and Badge
<button
  type="button"
  className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/5 hover:bg-muted/20 transition-colors text-left"
  aria-expanded={expandedFolder === folderName}
  onClick={() => toggleFolder(folderName)}
  data-testid={`folder-toggle-${folderName}`}
>
  <ChevronRight
    className={`size-4 text-muted-foreground shrink-0 transition-transform ${expandedFolder === folderName ? 'rotate-90' : ''}`}
  />
  <span className="text-sm font-medium">{folderName}</span>
  <span className="text-xs text-muted-foreground ml-1">({folderCycles.length})</span>
</button>
```
New `FolderNode` adapts this to: `selected` → `bg-primary text-primary-foreground`, indentation via `pl-{3 + depth * 4}`, count via `<Badge variant="secondary">`.

**Cycle table pattern** (lines 192–246 of existing file):
```typescript
<table className="w-full text-sm">
  <thead className="border-b bg-muted/10">
    <tr>
      <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Key</th>
      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
      {/* NEW cols: Owner (w-32), Total (w-20 text-right), Progress (w-44) */}
    </tr>
  </thead>
  <tbody>
    {visibleCycles.map((cycle) => (
      <tr key={cycle.ID} className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{cycle.detail.key}</td>
        <td className="px-4 py-3">
          <NavLink to={`/aio-cycle/${projectKey}/${cycle.detail.key}`} className="hover:underline">
            {cycle.detail.title}
          </NavLink>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Progress bar pattern** (lines 87–99 of existing file — the bar structure to copy exactly, extended with `inProgress`):
```typescript
// EXISTING bar (copy structure, extend for inProgress):
<div className="h-1.5 rounded-full overflow-hidden flex">
  {counts.pass > 0 && <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />}
  {counts.fail > 0 && <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />}
  {counts.blocked > 0 && <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />}
  {counts.notRun > 0 && <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />}
</div>
// NEW: add inProgress segment between blocked and notRun:
{counts.inProgress > 0 && <div className="bg-blue-400 h-full" style={{ width: `${pct(counts.inProgress)}%` }} />}
// NEW: pct uses summary.totalTests as denominator, not runs.length
const pct = (n: number) => (summary.totalTests > 0 ? Math.round((n / summary.totalTests) * 100) : 0);
```

**"Show closed" toggle pattern** (new — copy Switch from shadcn):
```typescript
const [showClosed, setShowClosed] = useState(false);

const visibleCycles = (cycleList ?? []).filter(
  (cycle) => showClosed || !cycle.detail.isClosed
);

// In JSX (right-aligned in page header):
<div className="flex items-center gap-2">
  <Switch id="show-closed" checked={showClosed} onCheckedChange={setShowClosed} />
  <label htmlFor="show-closed" className="text-sm">Show closed</label>
</div>
```

**Auto-expand ref pattern** (lines 124–132 of existing file — copy the `useRef` guard):
```typescript
// Prevent double auto-expand on StrictMode double-render
const autoExpandedRef = useRef(false);
useEffect(() => {
  if (!autoExpandedRef.current && folderTree && folderTree.length > 0) {
    autoExpandedRef.current = true;
    setExpandedIDs(new Set([folderTree[0].ID]));
    // Auto-select first folder with non-zero count
    const firstWithCycles = folderTree.find(f => (countMap[String(f.ID)] ?? 0) > 0);
    if (firstWithCycles) setSelectedFolderID(firstWithCycles.ID);
  }
}, [folderTree, countMap]);
```

**EmptyState pattern** (lines 253–259 of existing file):
```typescript
<EmptyState
  icon={FlaskConical}
  title="No cycles in this folder"
  subtitle="This folder has no test cycles yet."
/>
// No folder selected:
<EmptyState
  icon={FlaskConical}
  title="Select a folder"
  subtitle="Choose a folder from the left to view its cycles."
/>
```

---

### `taskflow/src/services/aio/cycles.ts` (service, request-response) — ADD FUNCTIONS

**Analog:** `taskflow/src/services/aio/cycles.ts` (existing file — append new exports, do NOT modify `fetchAioCycles` or `fetchAioCycleDetail`)

**Imports pattern** (lines 1–12 of existing file):
```typescript
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioCycle, AioPage } from './types';
// ADD for new functions:
import type { AioFolder, AioCycleDetailPagedResponse, AioCycleSummaryItem } from './types';
```

**Core fetch pattern** (lines 75–105 of existing file — the paginated fetch loop):
```typescript
export async function fetchAioCycles(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<AioCycle[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcycle`;
  // ...
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) { /* ... */ }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) { return []; }
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

**New function signatures to add (copy the same 401/404/network error pattern):**
```typescript
// Fetches the folder tree for a project.
// URL assumed: GET /project/{projectKey}/folder — executor must verify in Wave 0.
export async function fetchAioFolderTree(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<AioFolder[]>

// Fetches folder → cycle count map for a project.
// URL assumed: GET /project/{projectKey}/testcycle/count — executor must verify in Wave 0.
export async function fetchAioFolderCycleCounts(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<Record<string, number>>

// Fetches cycles with detail projection (returns allIDs + items[]).
// URL: GET /project/{projectKey}/testcycle?startAt=0 with detail projection param.
// Executor must determine projection param in Wave 0.
export async function fetchAioCyclesWithDetail(
  baseUrl: string,
  token: string,
  projectKey: string,
  folderID?: number,
): Promise<AioCycleDetailPagedResponse>

// Fetches cycle summaries (testRunDistribution) for given cycle IDs.
// URL assumed: GET /project/{projectKey}/testcycle?projection=summary&ids=... — verify in Wave 0.
// Returns array (not paged wrapper) per API-EXAMPLES.md paged2 shape.
export async function fetchAioCycleSummaries(
  baseUrl: string,
  token: string,
  projectKey: string,
  ids: number[],
): Promise<AioCycleSummaryItem[]>
```

**Error handling pattern to copy verbatim** (lines 97–104 of existing file):
```typescript
if (response.status === 401) {
  throw new ApiError('Invalid token or token has expired', 401, 'jira');
}
if (response.status === 404) {
  return []; // project not found or no cycles
}
throw new Error(`AIO request failed with status ${response.status}`);
```

---

### `taskflow/src/services/aio/types.ts` (model) — ADD TYPES

**Analog:** `taskflow/src/services/aio/types.ts` (existing file — append new interfaces, do NOT modify existing ones)

**Interface style pattern** (lines 18–35 of existing file — JSDoc block + interface):
```typescript
/**
 * A single AIO test management project.
 * Returned by GET /rest/aio-tcms/1.0/project (direct array, not paginated — D-16).
 */
export interface AioProject {
  id: number;
  projectKey: string;
  name: string;
}
```

**New types to add (follow the same JSDoc + interface pattern):**
```typescript
/**
 * A single node in the AIO folder tree.
 * Returned by GET /project/{projectKey}/folder (assumed URL — confirm in Wave 0).
 * Shape confirmed from API-EXAMPLES.md folder response.
 */
export interface AioFolder {
  ID: number;
  name: string;
  description: string | null;
  parentID: number | null;
  rankOrder: number | null;
  children: AioFolder[];
}

/**
 * A cycle item from the detail-projection endpoint (paged response).
 * shape from API-EXAMPLES.md paged response.
 * NOTE: detail.folder is null on all sampled cycles — folder association
 * comes from the server-side folderID filter, not embedded detail.
 */
export interface AioCycleDetailItem {
  ID: number;
  jiraProjectID: number;
  detail: {
    key: string;
    title: string;
    ownedByID: string;
    folder: number | null;
    isClosed: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  summary: null;
}

/**
 * A cycle item from the summary-projection endpoint (array response, NOT paged).
 * Shape confirmed from API-EXAMPLES.md paged2 response.
 * testRunDistribution keys are numeric status IDs as JSON strings (e.g. "53", "901").
 */
export interface AioCycleSummaryItem {
  ID: number;
  detail: null;
  summary: {
    totalTests: number;
    testRunDistribution: Record<string, number>;
  };
}

/**
 * Paged response wrapper for the detail-projection cycle list endpoint.
 * Extends AioPage with the allIDs field (confirmed from API-EXAMPLES.md paged).
 * allIDs contains ALL cycle IDs for the project — used to drive the batch summary query.
 */
export interface AioCycleDetailPagedResponse {
  items: AioCycleDetailItem[];
  allIDs: number[];
  startAt: number;
  maxResults: number;
  isLast: boolean;
}
```

---

### `taskflow/src/services/jira/users.ts` (service, request-response) — ADD FUNCTION

**Analog:** `taskflow/src/services/jira/users.ts` (existing file — append one function)

**Imports pattern** (lines 1–9 of existing file):
```typescript
import { apiFetch } from '../../lib/apiFetch';
import type { JiraAssignableUser } from './types';
```

**Existing function pattern to copy** (lines 20–42 of existing file):
```typescript
export async function fetchAssignableUsers(
  baseUrl: string,
  token: string,
  projectKey: string,
  query: string,
): Promise<JiraAssignableUser[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?project=${encodeURIComponent(projectKey)}&username=${encodeURIComponent(query)}`;
  try {
    const response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return [];
    return (await response.json()) as JiraAssignableUser[];
  } catch {
    return [];
  }
}
```

**New function to add (follow exact same pattern):**
```typescript
/**
 * Fetch a single Jira user by their DC username (the `name` field).
 * Used to resolve AIO cycle `ownedByID` values to display names.
 *
 * Endpoint: GET /rest/api/2/user?username={username}
 * On Jira DC, the `username` param matches the `name` field (NOT accountId).
 *
 * @returns JiraAssignableUser on success; null on 404 or any error (D-08: show raw ownedByID as fallback)
 */
export async function fetchJiraUserByUsername(
  baseUrl: string,
  token: string,
  username: string,
): Promise<JiraAssignableUser | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/user?username=${encodeURIComponent(username)}`;
  try {
    const response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as JiraAssignableUser;
  } catch {
    return null;
  }
}
```

**Key differences from `fetchAssignableUsers`:**
- Returns `JiraAssignableUser | null` (single object, not array; `null` on failure per D-08)
- URL path is `/rest/api/2/user?username=` not `/rest/api/2/user/assignable/search?...`
- No `projectKey` param — direct lookup by username

---

### `taskflow/src/lib/aioUtils.ts` (utility, transform) — ADD CONSTANT + FUNCTION

**Analog:** `taskflow/src/lib/aioUtils.ts` (existing file — append after existing exports)

**Existing function pattern** (lines 15–26 of existing file):
```typescript
export function normalizeStatus(raw: string | undefined): 'pass' | 'fail' | 'blocked' | 'notRun' {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':   return 'pass';
    case 'FAIL':   return 'fail';
    case 'BLOCKED': return 'blocked';
    default:       return 'notRun';
  }
}
```

**New exports to append (confirmed from 57-UI-SPEC.md color table and 57-RESEARCH.md):**
```typescript
/**
 * Maps numeric AIO status IDs (from testRunDistribution keys) to the canonical
 * status union. ID values confirmed from 57-UI-SPEC.md color table.
 *
 * IMPORTANT: testRunDistribution keys are JSON strings (e.g. "53"), not numbers.
 * Always convert before lookup: normalizeStatusById(Number(idStr))
 */
export const AIO_STATUS_MAP: Record<number, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {
  901: 'pass',
  51:  'fail',
  55:  'blocked',
  53:  'notRun',
  54:  'inProgress',
};

/**
 * Maps a numeric AIO status ID to the canonical status union.
 * Returns 'notRun' for unknown IDs (safe fallback — unknown = not yet executed).
 */
export function normalizeStatusById(id: number): 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress' {
  return AIO_STATUS_MAP[id] ?? 'notRun';
}
```

---

### `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` (test) — COMPLETE REWRITE

**Analog:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` (existing file — copy test infrastructure, replace all test cases)

**Test infrastructure pattern** (lines 1–29 of existing file):
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ storyPointsFieldKey: 'customfield_10016' }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/aio', () => ({
  fetchAioFolderTree: vi.fn(),
  fetchAioFolderCycleCounts: vi.fn(),
  fetchAioCyclesWithDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(),
}));
vi.mock('@/services/jira/users', () => ({
  fetchJiraUserByUsername: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
```

**Render helper pattern** (lines 42–54 of existing file):
```typescript
// Copy this render wrapper for all test cases:
render(
  <QueryClientProvider client={makeClient()}>
    <MemoryRouter initialEntries={['/aio-project/PROJ']}>
      <Routes>
        <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
```

**Mock resolution pattern** (lines 36–41 of existing file):
```typescript
// Dynamic import after vi.mock to pick up the mocked module:
const { fetchAioFolderTree, fetchAioCyclesWithDetail } = await import('@/services/aio');
(fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([/* folder tree */]);
(fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
  items: [/* cycle items */], allIDs: [1001], startAt: 0, maxResults: 20, isLast: true,
});
```

**userEvent interaction pattern** (lines 361–385 of existing file):
```typescript
const user = userEvent.setup();
// Wait for data, then click a folder node:
await user.click(screen.getByTestId('folder-node-201'));
await waitFor(() => {
  expect(screen.getByText('Cycle Alpha 2026')).toBeDefined();
});
```

**Test cases to cover (replace old accordion tests entirely):**
- Folder tree renders root nodes from API data
- Clicking a folder node selects it and loads its cycles in right panel
- "Show closed" toggle: off by default hides `isClosed` cycles; toggling on reveals them with "Closed" badge
- Progress bar builds from `testRunDistribution` (numeric IDs → colored segments)
- Owner column: shows skeleton while user query pending; shows `displayName` on resolve; shows raw `ownedByID` on null return
- Cycle count badge shows `countMap[folderID]` next to folder name
- EmptyState shown when no folder selected
- EmptyState shown when selected folder has no cycles
- ErrorState shown when folder tree query rejects

---

### `taskflow/src/services/aio/cycles.test.ts` (test) — EXTEND

**Analog:** `taskflow/src/services/aio/cycles.test.ts` (existing file — append new describe blocks after line 79)

**Test file header pattern** (lines 1–11 of existing file):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioCycles } from './cycles';  // ADD new imports alongside this

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';
```

**Test block structure to copy** (lines 13–79 of existing file):
```typescript
describe('fetchAioFolderTree', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns AioFolder[] on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ ID: 201, name: '2023 - DONE', parentID: null, children: [] }],
    } as unknown as Response);
    const result = await fetchAioFolderTree(BASE, TOKEN, PROJECT_KEY);
    expect(result).toEqual([{ ID: 201, name: '2023 - DONE', parentID: null, children: [] }]);
  });

  it('throws ApiError with status 401 on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioFolderTree(BASE, TOKEN, PROJECT_KEY)).rejects.toMatchObject({
      status: 401, source: 'jira',
    });
  });

  it('returns [] on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioFolderTree(BASE, TOKEN, PROJECT_KEY);
    expect(result).toEqual([]);
  });
});

// Replicate the same describe/it pattern for fetchAioCycleSummaries:
describe('fetchAioCycleSummaries', () => { /* ... */ });
```

---

### `taskflow/src/services/jira/users.test.ts` (test — NEW FILE)

**Analog:** `taskflow/src/services/aio/cycles.test.ts` (role-match — copy the same mock + test structure)

**File to create from scratch (copy infrastructure from cycles.test.ts):**
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchJiraUserByUsername } from './users';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('fetchJiraUserByUsername', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns JiraAssignableUser on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ displayName: 'Alice', name: 'JIRAUSER23429' }),
    } as unknown as Response);
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'JIRAUSER23429');
    expect(result).toEqual({ displayName: 'Alice', name: 'JIRAUSER23429' });
  });

  it('returns null on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'UNKNOWN');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'JIRAUSER23429');
    expect(result).toBeNull();
  });

  it('calls correct URL with encoded username', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ displayName: 'Bob', name: 'ext94772' }),
    } as unknown as Response);
    await fetchJiraUserByUsername(BASE, TOKEN, 'ext94772');
    expect(mockedApiFetch).toHaveBeenCalledWith(
      'jira',
      'https://jira.example.com/rest/api/2/user?username=ext94772',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }),
    );
  });
});
```

---

### `taskflow/src/lib/aioUtils.test.ts` (test — NEW FILE)

**Analog:** `taskflow/src/services/aio/cycles.test.ts` (role-match — simple unit test, no mocks needed)

**File to create from scratch:**
```typescript
import { describe, expect, it } from 'vitest';
import { normalizeStatus, normalizeStatusById, AIO_STATUS_MAP } from './aioUtils';

describe('normalizeStatus (existing — regression guard)', () => {
  it('maps PASS → pass', () => expect(normalizeStatus('PASS')).toBe('pass'));
  it('maps FAIL → fail', () => expect(normalizeStatus('FAIL')).toBe('fail'));
  it('maps BLOCKED → blocked', () => expect(normalizeStatus('BLOCKED')).toBe('blocked'));
  it('maps unknown → notRun', () => expect(normalizeStatus('OTHER')).toBe('notRun'));
});

describe('AIO_STATUS_MAP', () => {
  it('has correct mappings for all 5 known IDs', () => {
    expect(AIO_STATUS_MAP[901]).toBe('pass');
    expect(AIO_STATUS_MAP[51]).toBe('fail');
    expect(AIO_STATUS_MAP[55]).toBe('blocked');
    expect(AIO_STATUS_MAP[53]).toBe('notRun');
    expect(AIO_STATUS_MAP[54]).toBe('inProgress');
  });
});

describe('normalizeStatusById', () => {
  it('maps 901 → pass', () => expect(normalizeStatusById(901)).toBe('pass'));
  it('maps 51 → fail', () => expect(normalizeStatusById(51)).toBe('fail'));
  it('maps 55 → blocked', () => expect(normalizeStatusById(55)).toBe('blocked'));
  it('maps 53 → notRun', () => expect(normalizeStatusById(53)).toBe('notRun'));
  it('maps 54 → inProgress', () => expect(normalizeStatusById(54)).toBe('inProgress'));
  it('maps unknown ID → notRun (safe fallback)', () => expect(normalizeStatusById(999)).toBe('notRun'));
  // Critical: testRunDistribution keys arrive as strings — verify Number() conversion
  it('handles numeric string conversion pattern: Number("53") → notRun', () => {
    expect(normalizeStatusById(Number('53'))).toBe('notRun');
    expect(normalizeStatusById(Number('901'))).toBe('pass');
  });
});
```

---

## Shared Patterns

### Credential Gate
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 110–112 + line 118
**Apply to:** All `useQuery` calls in `AioProjectOverviewPage.tsx`
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
const { jiraBaseUrl } = useAuthStore();
// Every useQuery:
enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey
```

### AIO Query Key Prefix
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` line 117
**Apply to:** All AIO `useQuery` calls
**Rule:** `['aio', jiraBaseUrl, ...]` — token is NEVER in the key (security requirement confirmed Phase 56)

### aioFetch Pattern
**Source:** `taskflow/src/services/aio/client.ts` lines 30–43
**Apply to:** All new functions in `cycles.ts`
```typescript
// Always use aioFetch, not raw fetch. It handles Authorization header + base path.
response = await aioFetch(baseUrl, token, path);
// Network errors are caught at call site:
try {
  response = await aioFetch(baseUrl, token, path);
} catch {
  throw new Error(`Cannot reach AIO at ${baseUrl}`);
}
```

### apiFetch Pattern for Jira
**Source:** `taskflow/src/services/jira/users.ts` lines 29–33
**Apply to:** `fetchJiraUserByUsername` in `users.ts`
```typescript
const response = await apiFetch('jira', url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  },
});
```

### Error Handling (401/404/network)
**Source:** `taskflow/src/services/aio/cycles.ts` lines 97–104
**Apply to:** All new service functions in `cycles.ts`
```typescript
if (response.status === 401) {
  throw new ApiError('Invalid token or token has expired', 401, 'jira');
}
if (response.status === 404) {
  return []; // or appropriate zero-value per function return type
}
throw new Error(`AIO request failed with status ${response.status}`);
```

### Delayed Loading + Skeleton
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` line 121
**Apply to:** Both folder tree loading and cycle list loading in `AioProjectOverviewPage.tsx`
```typescript
const showSkeleton = useDelayedLoading(isLoading);
// Render skeleton only when showSkeleton is true (prevents 200ms flicker)
```

### URL Construction (base URL trailing slash)
**Source:** `taskflow/src/services/jira/users.ts` line 26 and `taskflow/src/services/aio/client.ts` line 37
**Apply to:** All new service functions
```typescript
// Always strip trailing slash from baseUrl:
baseUrl.replace(/\/$/, '')
// aioFetch does this internally — no need to strip in cycles.ts functions
// apiFetch callers (users.ts) must strip explicitly in the URL construction
```

---

## No Analog Found

All files have clear analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

However, these aspects have NO existing analog (planner must use RESEARCH.md patterns):

| Aspect | Reason |
|--------|--------|
| Recursive `FolderNode` component | No existing recursive tree component in codebase; use RESEARCH.md Pattern 1 |
| `buildProgressCounts()` helper | No existing `testRunDistribution` → counts converter; use RESEARCH.md Pattern 3 |
| `isDescendant()` tree utility | No tree traversal utilities exist; implement inline per RESEARCH.md Pitfall 6 |
| Two-panel `flex flex-row` layout | All existing AIO pages use `flex flex-col`; use UI-SPEC layout contract |
| Per-owner `useQuery` in row component | No existing per-row user query pattern; use RESEARCH.md Pattern 4 |

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/services/aio/`, `taskflow/src/services/jira/`, `taskflow/src/lib/`, `taskflow/src/hooks/`
**Files scanned:** 9 source files read in full
**Pattern extraction date:** 2026-05-14
