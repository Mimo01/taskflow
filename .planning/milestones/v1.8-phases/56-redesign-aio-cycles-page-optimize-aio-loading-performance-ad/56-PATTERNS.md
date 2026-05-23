# Phase 56: Redesign AIO Cycles Page, Optimize AIO Loading Performance, Add Defects and Executions Views — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 5 (3 modified, 1 new, 1 reviewed)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/hooks/useAioCredentials.ts` | hook | request-response | `taskflow/src/hooks/useDelayedLoading.ts` | role-match |
| `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | page/component | CRUD + progressive | `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | exact |
| `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | page/component | CRUD + event-driven | `taskflow/src/routes/dashboard/DescriptionEditor.tsx` (Tabs pattern) + self | exact |
| `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` | component | — | `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` skeleton pattern | role-match |
| `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` | page/component | request-response | self (read-only, no changes — nav target only) | reference |

---

## Pattern Assignments

### `taskflow/src/hooks/useAioCredentials.ts` (hook, new)

**Analog:** `taskflow/src/hooks/useDelayedLoading.ts` (hook structure) + inline pattern from all three AIO pages

**Imports pattern** — copy from `useDelayedLoading.ts` lines 1-1, then add:
```typescript
import { useEffect, useState } from 'react';
import { readSecret } from '@/services/stronghold';
```

**Existing inline pattern to extract** — from `AioProjectOverviewPage.tsx` lines 18-24:
```typescript
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, []);
```

**Full hook implementation** — D-14 specifies this exactly:
```typescript
export function useAioCredentials(): { token: string | null; isLoading: boolean } {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  return { token, isLoading };
}
```

**Key difference from existing inline pattern:** adds `isLoading` state with `.finally(() => setIsLoading(false))`. The existing pattern in pages has no `isLoading` flag — it just uses `!!token`. The new `!isLoading` guard in `enabled` prevents the flash-fire-with-null-token pitfall.

**No hooks barrel exists** — `taskflow/src/hooks/` has no `index.ts`. Do not create one; just add the file directly.

**Test pattern** — from `AioProjectOverviewPage.test.tsx` lines 19-21, after extraction tests should mock the hook:
```typescript
// Current (stronghold mock):
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// After extraction, tests for useAioCredentials.test.ts mock stronghold the same way.
// Callers of the hook (page tests) can instead mock the hook directly:
vi.mock('@/hooks/useAioCredentials', () => ({
  useAioCredentials: () => ({ token: 'test-jira-token', isLoading: false }),
}));
```

---

### `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (page, CRUD + progressive)

**Analog:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — exact same data flow, same query key conventions, same skeleton + error patterns.

**Imports pattern** — from `AioProjectOverviewPage.tsx` lines 1-13 (current), replace `readSecret`/`useEffect`/`useState` block with the new hook:
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioCycleStatusBadgeClass } from '@/lib/statusStyles';
import type { AioCycle, AioTestRun } from '@/services/aio';
import { fetchAioCycles, fetchAioTestRunsForCycle } from '@/services/aio';
import { useAuthStore } from '@/stores/auth.store';
import { AioCyclesSkeleton } from './AioCyclesSkeleton';
```

**Credential + query enabled guard** — replaces the current `useState + useEffect + readSecret` block (lines 18-32):
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();

const { data, isLoading, isError, error } = useQuery<AioCycle[]>({
  queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
  queryFn: () => fetchAioCycles(jiraBaseUrl!, token!, projectKey!),
  enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey,
  //                              ^^^^^^^^^^^^^^^^^^^^ new: !isLoading guard
});
```

**Per-row stats query pattern** — new addition, one `useQuery` per cycle row. Copy `normalizeStatus` from `AioCycleDetailPage.tsx` lines 19-30 into a shared location (see Shared Patterns section) or duplicate inline. Each cycle row:
```typescript
const runsQuery = useQuery<AioTestRun[]>({
  queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycle.key],
  queryFn: () => fetchAioTestRunsForCycle(jiraBaseUrl!, token!, projectKey!, cycle.key),
  enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey,
});

const counts = (runsQuery.data ?? []).reduce(
  (acc, run) => { const norm = normalizeStatus(run.status); acc[norm]++; return acc; },
  { pass: 0, fail: 0, blocked: 0, notRun: 0 },
);
const total = runsQuery.data?.length ?? 0;
```

**Skeleton per row** — from UI-SPEC (loading state):
```typescript
// While runsQuery.isLoading:
<Skeleton className="h-1.5 w-full rounded-full" />
<Skeleton className="h-3 w-24" />
// When loaded:
<div className="h-1.5 rounded-full overflow-hidden flex">
  {counts.pass > 0 && <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />}
  {counts.fail > 0 && <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />}
  {counts.blocked > 0 && <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />}
  {counts.notRun > 0 && <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />}
</div>
<p className="text-xs text-muted-foreground mt-0.5">
  {counts.pass}P {counts.fail}F {counts.blocked}B {counts.notRun}N
</p>
```

**Table structure** — extend existing 3-column thead (lines 65-76) with a 4th column:
```typescript
// Current: Key | Name | Status
// New: Key | Name | Status | Progress (add this <th>)
<th className="w-40 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
  Progress
</th>
```

**Row hover pattern** — from `AioProjectOverviewPage.tsx` lines 82-85, existing pattern unchanged:
```typescript
className="border-b border-border hover:bg-muted/30 transition-colors"
```

**Error handling pattern** — from `AioProjectOverviewPage.tsx` lines 43-55, unchanged:
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

---

### `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` (page, CRUD + tabs)

**Analog:** Self (existing file to be modified) + `taskflow/src/routes/dashboard/DescriptionEditor.tsx` (tabs layout pattern)

**Credential migration** — remove lines 60-76 (`useState + useEffect + readSecret`), replace with:
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
```

Update both `useQuery` calls' `enabled` guard (lines 83, 88-89):
```typescript
enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey,
```

**Tabs import** — from `DescriptionEditor.tsx` line 3 (exact import to copy):
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

**Tabs layout pattern** — from `DescriptionEditor.tsx` lines 43-47 (minimal), adapted to the cycle detail structure per RESEARCH.md Pattern 3:
```typescript
<Tabs defaultValue="executions" className="flex-1 flex flex-col min-h-0">
  <TabsList className="mx-6 my-1.5">
    <TabsTrigger value="executions">Executions</TabsTrigger>
    <TabsTrigger value="defects">Defects</TabsTrigger>
  </TabsList>

  <TabsContent value="executions" className="flex-1 overflow-auto">
    {/* filter chips toolbar (moved from outer scope) */}
    {/* run table */}
  </TabsContent>

  <TabsContent value="defects" className="flex-1 overflow-auto">
    {/* defect enrichment table or EmptyState */}
  </TabsContent>
</Tabs>
```

**Important layout change:** The existing `<div className="flex-1 overflow-auto">` wrapper (line 197) becomes the `<Tabs>` root. The progress section (`px-6 py-4 border-b border-border` div, lines 222-269) stays ABOVE the `<TabsList>`, inside the `<Tabs>` root but outside any `<TabsContent>`.

**Filter chips moved into Executions tab** — the entire `role="toolbar"` div (lines 272-332) moves inside `<TabsContent value="executions">`.

**Run table clickable rows** — existing `<tr>` (lines 361-391) gains `onClick`, `role="button"`, `tabIndex`, `onKeyDown`. Pattern from RESEARCH.md Pattern 4 and breadcrumb pattern from `AioTestRunDetailPage.tsx` lines 59-67:
```typescript
<tr
  key={run.id}
  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
  role="button"
  tabIndex={0}
  onClick={() => {
    useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
      navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
    }
  }}
>
```
Add `useLocation` to the import from `react-router-dom` to get `location.pathname`.

**`allDefects` derivation** — already exists at line 121, unchanged:
```typescript
const allDefects = [...new Set((runs ?? []).flatMap((r) => r.defects ?? []).filter(Boolean))];
```

**Defects tab — per-row query** — replaces the existing plain `allDefects.map((defectKey) => <NavLink>)` section (lines 395-410). Each row fires one query:
```typescript
// Per defect row (inline or extracted sub-component):
const issueQuery = useQuery<JiraIssue | null>({
  queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey],
  queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectKey),
  enabled: !!jiraBaseUrl && !!token && !tokenLoading,
});
// Note: use 'issue-lightweight' prefix to avoid collision with fetchIssueDetail cache
```

**Defects tab — title cell skeleton** — from UI-SPEC:
```typescript
{issueQuery.isLoading
  ? <Skeleton className="h-4 w-32" />
  : <span>{issueQuery.data?.fields.summary ?? defectKey}</span>
}
```

**Defects tab — status chip** — same inline badge pattern as existing run status chip (line 369):
```typescript
<span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold`}>
  {issueQuery.data?.fields.status.name ?? '—'}
</span>
```

**Defects tab — triggered by** — derived from already-fetched `runs` data, no extra query:
```typescript
const triggeredBy = (runs ?? [])
  .filter((r) => (r.defects ?? []).includes(defectKey))
  .map((r) => r.testCaseKey)
  .filter(Boolean)
  .join(', ');
```

**Defects tab — empty state** — from UI-SPEC copywriting contract, uses `<EmptyState>` (already imported):
```typescript
{allDefects.length === 0 && (
  <EmptyState
    icon={FlaskConical}
    title="No defects"
    subtitle="No defects are linked to runs in this cycle."
  />
)}
```

**New imports needed** — add to existing import block:
```typescript
import { useLocation } from 'react-router-dom';            // for location.pathname in run row click
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import type { JiraIssue } from '@/services/jira/types';
import { fetchJiraIssueByKey } from '@/services/jira';
// Remove: useEffect, useState (replaced by useAioCredentials)
// Remove: readSecret import
```

---

### `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` (component, reviewed)

**Analog:** Self (current file is 11 lines — trivially small)

**Current implementation** (lines 1-11) — renders 5 full-width skeleton rows with no column structure:
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function AioCyclesSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

**Required update** — the new 4-column layout (Key w-28 | Name flex-1 | Status w-32 | Progress w-40) causes a layout jump between skeleton and loaded state if the skeleton stays as a single full-width bar. Update to a row-structured skeleton:
```typescript
export function AioCyclesSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3">
          <Skeleton className="h-4 w-20 shrink-0" />       {/* Key */}
          <Skeleton className="h-4 flex-1" />               {/* Name */}
          <Skeleton className="h-5 w-20 shrink-0" />       {/* Status badge */}
          <div className="flex flex-col gap-1 w-32 shrink-0">
            <Skeleton className="h-1.5 w-full rounded-full" />  {/* Progress bar */}
            <Skeleton className="h-3 w-24" />                   {/* Counts text */}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Shared Patterns

### Credential loading (replaces inline `useEffect + readSecret`)

**Source:** New `taskflow/src/hooks/useAioCredentials.ts` (to be created)
**Apply to:** `AioProjectOverviewPage.tsx`, `AioCycleDetailPage.tsx`, `AioTestRunDetailPage.tsx`

Before (each page, ~7 lines):
```typescript
const [token, setToken] = useState<string | null>(null);
useEffect(() => {
  readSecret('jira-pat').then(setToken).catch(() => setToken(null));
}, []);
// enabled: !!jiraBaseUrl && !!token && ...
```

After (each page, 1 line + updated enabled guard):
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
// enabled: !!jiraBaseUrl && !!token && !tokenLoading && ...
```

### AIO query key convention

**Source:** `AioCycleDetailPage.tsx` lines 81-89 (verified pattern)
**Apply to:** All new `useQuery` calls in this phase

```typescript
// Cycle list:     ['aio', jiraBaseUrl, 'cycles', projectKey]
// Runs per cycle: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]
// Cycle detail:   ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey]
// Run detail:     ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId]
// Jira issue:     ['jira', jiraBaseUrl, 'issue-lightweight', defectKey]
//   ^^ 'issue-lightweight' avoids collision with fetchIssueDetail which uses a different key prefix
```

Token is never included in query keys (confirmed: existing pattern, security requirement).

### Status badge inline pattern

**Source:** `AioCycleDetailPage.tsx` lines 96-99 (cycle badge) and lines 367-372 (run badge)
**Apply to:** Defects tab Jira status chip

```typescript
// Cycle status badge:
<span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioCycleStatusBadgeClass(cycle.status)}`}>
  {cycle.status}
</span>

// Run status badge (also used for Jira status on defect rows):
<span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(run.status)}`}>
  {normalizeStatusLabel(run.status)}
</span>
```

For Jira status chips on the Defects tab (no `aioRunStatusBadgeClass` — use raw styling):
```typescript
<span className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
  {issueQuery.data?.fields.status.name ?? '—'}
</span>
```

### `normalizeStatus` extraction

**Source:** `AioCycleDetailPage.tsx` lines 19-30 (currently module-scoped, not exported)
**Apply to:** `AioProjectOverviewPage.tsx` per-row stats computation

The function must be accessible from both pages. Planner decision: extract to `taskflow/src/lib/aioUtils.ts` (new shared util) and import from both pages, OR duplicate inline in `AioProjectOverviewPage.tsx`. Extracting is preferred (avoids divergence risk per RESEARCH.md Pitfall 3).

If extracting:
```typescript
// taskflow/src/lib/aioUtils.ts
export function normalizeStatus(raw: string | undefined): 'pass' | 'fail' | 'blocked' | 'notRun' {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':    return 'pass';
    case 'FAIL':    return 'fail';
    case 'BLOCKED': return 'blocked';
    default:        return 'notRun';
  }
}
```

Then both pages import: `import { normalizeStatus } from '@/lib/aioUtils';`

### Progress bar color pattern

**Source:** `AioCycleDetailPage.tsx` lines 227-252
**Apply to:** Per-row mini progress bars in `AioProjectOverviewPage.tsx`

Full-size bar (cycle detail, `h-2`):
```typescript
<div className="w-full h-2 rounded-full overflow-hidden flex">
  {counts.pass > 0 && <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />}
  {counts.fail > 0 && <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />}
  {counts.blocked > 0 && <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />}
  {counts.notRun > 0 && <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />}
</div>
```

Mini bar (cycles page, `h-1.5` per UI-SPEC) — same segments, height only changes:
```typescript
<div className="w-full h-1.5 rounded-full overflow-hidden flex">
  {/* same segment divs */}
</div>
```

### EmptyState usage

**Source:** `AioCycleDetailPage.tsx` lines 336-340 + `AioProjectOverviewPage.tsx` lines 108-113
**Apply to:** Defects tab empty state

```typescript
<EmptyState
  icon={FlaskConical}
  title="No defects"
  subtitle="No defects are linked to runs in this cycle."
/>
```

### Breadcrumb push before navigate

**Source:** `AioCycleDetailPage.tsx` lines 55-58 (store subscription) + `AioTestRunDetailPage.tsx` lines 59-67 (handleBack pattern)
**Apply to:** Clickable run rows in Executions tab

```typescript
// Push current cycle entry before navigating to run detail:
useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
```

`cycleName` = `cycleQuery.data?.name ?? cycleKey ?? ''` (already computed at line 123).

### Test mock setup

**Source:** `AioProjectOverviewPage.test.tsx` lines 1-25 (full mock setup block)
**Apply to:** New `useAioCredentials.test.ts` + updated page tests

After the hook is extracted, page tests should mock the hook rather than stronghold:
```typescript
vi.mock('@/hooks/useAioCredentials', () => ({
  useAioCredentials: () => ({ token: 'test-jira-token', isLoading: false }),
}));
```

The hook's own test (`useAioCredentials.test.ts`) mocks stronghold directly:
```typescript
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));
```

Test file structure follows `useDelayedLoading.test.ts` pattern (same directory, same `.test.ts` extension for a non-JSX hook).

---

## No Analog Found

All files have close analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:**
- `taskflow/src/hooks/` — all 17 hook files
- `taskflow/src/routes/dashboard/` — AioProjectOverviewPage, AioCycleDetailPage, AioTestRunDetailPage, AioCyclesSkeleton, DescriptionEditor
- `taskflow/src/components/ui/tabs.tsx`
- `taskflow/src/services/jira/issues.ts` (line 640–670)

**Files scanned:** 12
**Pattern extraction date:** 2026-05-14

**Key pitfall reminders for planner:**
1. `enabled` guard at every `useQuery` must include `!tokenLoading` — not just `!!token`
2. `<Tabs>` root needs `flex-1 flex flex-col min-h-0` to preserve page scroll; `<TabsContent>` needs `flex-1 overflow-auto`
3. Use `['jira', jiraBaseUrl, 'issue-lightweight', defectKey]` query key prefix for `fetchJiraIssueByKey` to avoid cache collision with `fetchIssueDetail`
4. `<NavLink>` on `<tr>` is invalid HTML — use `onClick` + `role="button"` + `tabIndex={0}` + `onKeyDown` pattern
5. Pass `token` as prop to any defect row sub-components rather than calling `useAioCredentials()` inside each row component (avoids N Stronghold reads)
