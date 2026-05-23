# Phase 53: Cycle Detail + Header Pinning - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 8 (6 new/modified source files + 2 new test files)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | component (page) | request-response | `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | exact |
| `taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx` | component (skeleton) | — | `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` | exact |
| `taskflow/src/stores/pinned-tabs.store.ts` | store (MODIFY) | event-driven | itself (current state read) | self |
| `taskflow/src/components/app/PinnedTabStrip.tsx` | component (MODIFY) | event-driven | itself (current state read) | self |
| `taskflow/src/main.tsx` | wiring / layout (MODIFY) | request-response | itself (current state read) | self |
| `taskflow/src/routes/routes.tsx` | config (MODIFY) | — | itself (current state read) | self |
| `taskflow/src/services/aio/types.ts` | model (MODIFY) | — | itself + `cycles.ts` type pattern | self |
| `taskflow/src/services/aio/index.ts` | barrel (MODIFY) | — | itself (current state read) | self |

---

## Pattern Assignments

### `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` (NEW — component, request-response)

**Analog:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (lines 1–120)

**Imports pattern** (lines 1–13):
```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioCycleStatusBadgeClass } from '@/lib/statusStyles';
import { fetchAioCycles } from '@/services/aio';
import type { AioCycle } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { AioCyclesSkeleton } from './AioCyclesSkeleton';
```

Phase 53 additions to this import pattern:
- Replace `useParams<{ projectKey: string }>` with `useParams<{ projectKey: string; cycleKey: string }>`
- Add `fetchAioTestRunsForCycle` and `AioTestRun` imports from `@/services/aio`
- Add `usePinnedTabsStore` import from `@/stores/pinned-tabs.store`
- Add `{ Button }` from `@/components/ui/button`, `{ Badge }` from `@/components/ui/badge`
- Add `{ PinOff }` or other pin icon from `lucide-react`
- Import `AioCycleDetailSkeleton` instead of `AioCyclesSkeleton`

**Credential loading pattern** (lines 17–24 of analog):
```tsx
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, []);
```

**Query key + queryFn pattern** (lines 28–32 of analog):
```tsx
const { data, isLoading, isError, error } = useQuery<AioCycle[]>({
  queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
  queryFn: () => fetchAioCycles(jiraBaseUrl!, token!, projectKey!),
  enabled: !!jiraBaseUrl && !!token && !!projectKey,
});
```

For Phase 53, mirror exactly:
```tsx
const { data: runs, isLoading, isError, error } = useQuery<AioTestRun[]>({
  queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
  queryFn: () => fetchAioTestRunsForCycle(jiraBaseUrl!, token!, projectKey!, cycleKey!),
  enabled: !!jiraBaseUrl && !!token && !!projectKey && !!cycleKey,
});
```

**Skeleton flicker guard pattern** (line 34 of analog):
```tsx
const showSkeleton = useDelayedLoading(isLoading);
```

**Outer layout shell pattern** (lines 36–42 of analog):
```tsx
return (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
      <h1 className="text-xl font-semibold">...</h1>
    </div>
    <div className="flex-1 overflow-auto">
```

**Error state pattern** (lines 43–55 of analog):
```tsx
{isError && !data && (
  <div className="p-4">
    <ErrorState
      error={error}
      onRetry={() =>
        queryClient.invalidateQueries({
          queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
        })
      }
      viewName="cycle detail"
    />
  </div>
)}
```

**Skeleton / data branch pattern** (lines 57–116 of analog):
```tsx
{showSkeleton ? (
  <div className="p-4">
    <AioCycleDetailSkeleton />
  </div>
) : !isError ? (
  <>
    {(runs ?? []).length > 0 ? (
      /* ... table / progress bar / filter chips / defects ... */
    ) : null}

    {runs !== undefined && runs.length === 0 && (
      <EmptyState
        icon={FlaskConical}
        title="No test runs found"
        subtitle="No test runs have been recorded for this cycle yet."
      />
    )}
  </>
) : null}
```

**AIO status badge pattern** (lines 97–100 of analog):
```tsx
<span
  className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioCycleStatusBadgeClass(cycle.status)}`}
>
  {cycle.status}
</span>
```

For run status, add a `aioRunStatusBadgeClass()` to `statusStyles.ts` using the same structure:
```ts
const AIO_RUN_BADGE_STYLES: Record<string, string> = {
  PASS:         'bg-green-500/15 text-green-600 dark:text-green-400',
  FAIL:         'bg-red-500/15 text-red-600 dark:text-red-400',
  BLOCKED:      'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  NOT_EXECUTED: 'bg-muted text-muted-foreground',
};
export function aioRunStatusBadgeClass(status: string): string {
  return AIO_RUN_BADGE_STYLES[status] ?? 'bg-muted text-muted-foreground';
}
```

**Table thead pattern** (lines 64–77 of analog — copy directly):
```tsx
<table className="w-full text-sm">
  <thead className="border-b bg-muted/10">
    <tr>
      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
        Test Case
      </th>
      <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
        Status
      </th>
      <th className="w-36 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
        Date
      </th>
    </tr>
  </thead>
```

**Table row pattern** (lines 79–103 of analog):
```tsx
<tbody>
  {filteredRuns.map((run) => (
    <tr
      key={run.id}
      className="border-b border-border hover:bg-muted/30 transition-colors"
    >
      <td className="px-4 py-3">{run.testCase?.title ?? run.testCaseKey}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(run.status)}`}>
          {normalizeStatusLabel(run.status)}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {run.executedDate ?? run.testCase?.updatedDate ?? '—'}
      </td>
    </tr>
  ))}
</tbody>
```

**NavLink pattern for defects** (lines 88–90 of analog):
```tsx
<NavLink
  to={`/issue/${defectKey}`}
  className="hover:underline"
>
  {defectKey}
</NavLink>
```

**Filter chips pattern** (from `QuickFilterChipRow.tsx` lines 112–170 — visual only, not store-coupled):
```tsx
// Local state: all 4 active by default
const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
  new Set(['NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKED'])
);
const chipRefs = useRef<(HTMLElement | null)[]>([]);

const CHIPS = [
  { status: 'NOT_EXECUTED', label: 'Not Run' },
  { status: 'PASS',         label: 'Pass' },
  { status: 'FAIL',         label: 'Fail' },
  { status: 'BLOCKED',      label: 'Blocked' },
] as const;

// Render (Badge variant toggle pattern from QuickFilterChipRow.tsx lines 141–170):
<div role="toolbar" aria-label="Status filters" className="flex items-center gap-2 px-3 py-1.5">
  {CHIPS.map((chip, i) => {
    const isActive = activeStatuses.has(chip.status);
    return (
      <Badge
        key={chip.status}
        ref={(el: HTMLElement | null) => { chipRefs.current[i] = el; }}
        variant={isActive ? 'default' : 'outline'}
        role="switch"
        aria-checked={isActive}
        tabIndex={i === 0 ? 0 : -1}
        className="cursor-pointer select-none"
        onClick={() => {
          setActiveStatuses((prev) => {
            const next = new Set(prev);
            if (next.has(chip.status)) next.delete(chip.status);
            else next.add(chip.status);
            return next;
          });
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); /* toggle */ }
          // ArrowLeft/ArrowRight navigation same as QuickFilterChipRow
        }}
      >
        {chip.label}
      </Badge>
    );
  })}
</div>
```

**Pin/Unpin button pattern** (new — uses `usePinnedTabsStore`):
```tsx
const isPinned = usePinnedTabsStore((s) => s.isPinned);
const togglePin = usePinnedTabsStore((s) => s.togglePin);
const removePin = usePinnedTabsStore((s) => s.removePin);
const setPinnedCycleMeta = usePinnedTabsStore((s) => s.setPinnedCycleMeta);
const clearCycleMeta = usePinnedTabsStore((s) => s.clearCycleMeta);

const pinned = isPinned(cycleKey!);

// In the page header:
<Button
  variant="secondary"
  size="sm"
  onClick={() => {
    if (pinned) {
      removePin(cycleKey!);
      clearCycleMeta(cycleKey!);
    } else {
      togglePin(cycleKey!);
      setPinnedCycleMeta(cycleKey!, { name: cycleName, projectKey: projectKey! });
    }
  }}
>
  {pinned ? 'Unpin cycle' : 'Pin cycle'}
</Button>
```

Note: `cycleName` comes from the cycle detail query result (open question 2 in RESEARCH.md — a separate `useQuery` for the cycle detail endpoint, or from the first run's metadata). The simplest path is a second `useQuery` for `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/detail`.

---

### `taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx` (NEW — component)

**Analog:** `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` (lines 1–11)

**Full file pattern** (copy structure, add sections for heading, progress bar, chips):
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function AioCycleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-64" />          {/* heading */}
      <Skeleton className="h-2 w-full" />         {/* progress bar */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

The analog (`AioCyclesSkeleton.tsx`) uses:
- `import { Skeleton } from '@/components/ui/skeleton'`
- Named export (not default)
- `flex flex-col gap-2` container
- Array `.map()` over indices for row count

Phase 53 extends to `gap-4` and adds the heading/progress/chip skeleton rows before the table rows.

---

### `taskflow/src/stores/pinned-tabs.store.ts` (MODIFY — store, event-driven)

**Analog:** itself — current file is the only store using `createTauriStorage` + `persist`.

**Current full file** (`taskflow/src/stores/pinned-tabs.store.ts` lines 1–43):
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

interface PinnedTabsState {
  pinnedKeys: string[];
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  isPinned: (key: string) => boolean;
}

export const usePinnedTabsStore = create<PinnedTabsState>()(
  persist(
    (set, get) => ({
      pinnedKeys: [],
      togglePin: (key) =>
        set((s) => ({
          pinnedKeys: s.pinnedKeys.includes(key)
            ? s.pinnedKeys.filter((k) => k !== key)
            : [...s.pinnedKeys, key],
        })),
      removePin: (key) =>
        set((s) => ({
          pinnedKeys: s.pinnedKeys.filter((k) => k !== key),
        })),
      reorder: (fromIndex, toIndex) =>
        set((s) => {
          const next = [...s.pinnedKeys];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { pinnedKeys: next };
        }),
      isPinned: (key) => get().pinnedKeys.includes(key),
    }),
    {
      name: 'pinned-tabs-store',
      storage: createTauriStorage('pinned-tabs.json'),
      version: 0,
      migrate: (persisted, _version) => persisted as PinnedTabsState,
    },
  ),
);
```

**Required changes:**

1. Extend `PinnedTabsState` interface — add after `isPinned`:
```ts
pinnedCycleMeta: Record<string, { name: string; projectKey: string }>;
setPinnedCycleMeta: (key: string, meta: { name: string; projectKey: string }) => void;
clearCycleMeta: (key: string) => void;
```

2. Add default value in `create()` body — add after `pinnedKeys: []`:
```ts
pinnedCycleMeta: {},
```

3. Add action implementations — add after `isPinned`:
```ts
setPinnedCycleMeta: (key, meta) =>
  set((s) => ({
    pinnedCycleMeta: { ...s.pinnedCycleMeta, [key]: meta },
  })),
clearCycleMeta: (key) =>
  set((s) => {
    const next = { ...s.pinnedCycleMeta };
    delete next[key];
    return { pinnedCycleMeta: next };
  }),
```

4. Bump version and add real migration:
```ts
version: 1,
migrate: (persisted, version) => {
  const s = persisted as PinnedTabsState;
  if (version < 1) {
    s.pinnedCycleMeta = {};
  }
  return s;
},
```

**Pitfall:** `pinnedCycleMeta: {}` MUST appear as a default in the `create()` body, not only in the migration — fresh installs skip migration.

---

### `taskflow/src/components/app/PinnedTabStrip.tsx` (MODIFY — component, event-driven)

**Analog:** itself — current file (`taskflow/src/components/app/PinnedTabStrip.tsx` lines 1–315).

**Current props interface** (lines 34–46):
```ts
interface PinnedTabStripProps {
  pinnedKeys: string[];
  activeKey: string | null;
  onTabClick: (issueKey: string) => void;
  onTabClose: (issueKey: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  resolvedIssues: Map<string, ResolvedIssue>;
}

interface ResolvedIssue {
  summary: string;
  issueTypeName: string;
}
```

**Required changes (surgical — 8 touch points):**

1. Add `FlaskConical` to lucide-react import block (line 13):
```ts
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  BookOpen,
  Bug,
  CheckSquare,
  CornerDownRight,
  FlaskConical,  // ADD
  Loader2,
  PinOff,
} from 'lucide-react';
```

2. Replace `ResolvedIssue` interface + add discriminated union types (lines 43–46):
```ts
type IssueTab = { type: 'issue'; summary: string; issueTypeName: string };
type CycleTab = { type: 'cycle'; name: string; projectKey: string };
type ResolvedTab = IssueTab | CycleTab;
```

3. Replace `resolvedIssues: Map<string, ResolvedIssue>` in props interface (line 40):
```ts
resolvedTabs: Map<string, ResolvedTab>;
```

4. Update destructured prop in function signature (line 79):
```ts
resolvedTabs,   // was: resolvedIssues
```

5. Update ghost render (line 162 — `resolvedIssues.get(key)` → `resolvedTabs.get(key)`):
```ts
const resolved = resolvedTabs.get(key);
```

6. Update ghost content (lines 173–188) — add switch on `resolved.type`:
```tsx
{resolved?.type === 'cycle' ? (
  <>
    <FlaskConical className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    <div className="flex flex-col min-w-0 leading-none">
      <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">{key}</span>
      <span className="truncate text-[11px] leading-tight">{resolved.name}</span>
    </div>
  </>
) : resolved?.type === 'issue' ? (
  <>
    <IssueTypeIcon typeName={resolved.issueTypeName} />
    <div className="flex flex-col min-w-0 leading-none">
      <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">{key}</span>
      <span className="truncate text-[11px] leading-tight">{resolved.summary}</span>
    </div>
  </>
) : (
  <>
    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
    <span className="font-mono text-[11px] whitespace-nowrap">{key}</span>
  </>
)}
```

7. Update main tab render (lines 203 + 262–279) — same `resolved.type` switch, same structure as above.

8. Update `aria-label` (line 200):
```tsx
aria-label="Pinned tabs"   // was: "Pinned issues"
```

**No changes needed:** pointer event handlers, drag state, drop target logic, context menu items/variants, tab dimension classes, `cn()` calls for active/inactive/dragging states.

---

### `taskflow/src/main.tsx` (MODIFY — wiring, request-response)

**Analog:** itself — current file. Six surgical changes documented in RESEARCH.md.

**Change 1 — Add store selector** (after line 142):
```ts
const pinnedCycleMeta = usePinnedTabsStore((s) => s.pinnedCycleMeta);
```

**Change 2 — Split pinnedKeys before useQueries** (replace lines 166–178):

Current `useQueries` drives off `pinnedKeys` directly. Replace with:
```ts
const issuePinnedKeys = pinnedKeys.filter((k) => !k.includes('-CY-'));
const cyclePinnedKeys = pinnedKeys.filter((k) => k.includes('-CY-'));

const pinnedQueries = useQueries({
  queries: issuePinnedKeys.map((issueKey) => ({
    queryKey: ['jira-pinned-summary', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueSummary(jiraBaseUrl, token, issueKey);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraConnected,
  })),
});
```

**Pitfall:** `pinnedQueries[i]` must align with `issuePinnedKeys[i]`, not `pinnedKeys[i]`.

**Change 3 — Replace resolvedPinnedTabs map build** (replace lines 180–190):

Current type: `Map<string, { summary: string; issueTypeName: string }>`. Replace:
```ts
type IssueTab = { type: 'issue'; summary: string; issueTypeName: string };
type CycleTab = { type: 'cycle'; name: string; projectKey: string };

const resolvedPinnedTabs = new Map<string, IssueTab | CycleTab>();

issuePinnedKeys.forEach((key, i) => {
  const data = pinnedQueries[i]?.data;
  if (data?.fields) {
    resolvedPinnedTabs.set(key, {
      type: 'issue',
      summary: data.fields.summary,
      issueTypeName: data.fields.issuetype.name,
    });
  }
});

cyclePinnedKeys.forEach((key) => {
  const meta = pinnedCycleMeta[key];
  if (meta) {
    resolvedPinnedTabs.set(key, {
      type: 'cycle',
      name: meta.name,
      projectKey: meta.projectKey,
    });
  }
});
```

**Change 4 — Add activeCycleKey** (after line 272):

Current (lines 270–272):
```ts
const activeIssueKey = location.pathname.startsWith('/issue/')
  ? location.pathname.replace('/issue/', '')
  : null;
```

Add below:
```ts
const activeCycleKey = location.pathname.startsWith('/aio-cycle/')
  ? (location.pathname.split('/')[3] ?? null)  // ['', 'aio-cycle', 'PROJ', 'PROJ-CY-2'][3]
  : null;
```

**Change 5 — onTabClick handler** (replace inline `(key) => handleIssueClick(key, true)` at PinnedTabStrip call site):
```tsx
onTabClick={(key) => {
  if (key.includes('-CY-')) {
    const meta = pinnedCycleMeta[key];
    if (meta) navigate(`/aio-cycle/${meta.projectKey}/${key}`);
  } else {
    handleIssueClick(key, true);
  }
}}
```

**Change 6 — PinnedTabStrip props** (lines 481–489):

Current:
```tsx
{pinnedKeys.length > 0 && (
  <PinnedTabStrip
    pinnedKeys={pinnedKeys}
    activeKey={activeIssueKey}
    onTabClick={(key) => handleIssueClick(key, true)}
    onTabClose={removePin}
    onReorder={reorderPins}
    resolvedIssues={resolvedPinnedTabs}
  />
)}
```

Required:
```tsx
{pinnedKeys.length > 0 && (
  <PinnedTabStrip
    pinnedKeys={pinnedKeys}
    activeKey={activeIssueKey ?? activeCycleKey}
    onTabClick={(key) => { /* Change 5 handler */ }}
    onTabClose={removePin}
    onReorder={reorderPins}
    resolvedTabs={resolvedPinnedTabs}
  />
)}
```

---

### `taskflow/src/routes/routes.tsx` (MODIFY — config)

**Analog:** itself — current file (`taskflow/src/routes/routes.tsx` lines 1–52).

**Lazy import pattern** (lines 21–22 of analog — copy exactly):
```ts
const AioProjectOverviewPage = lazy(() => import('./dashboard/AioProjectOverviewPage'));
```

Add after line 22:
```ts
const AioCycleDetailPage = lazy(() => import('./dashboard/AioCycleDetailPage'));
```

**Route entry pattern** (line 51 of analog):
```ts
{ path: '/aio-project/:projectKey', element: withLazy(AioProjectOverviewPage) },
```

Add after line 51:
```ts
{ path: '/aio-cycle/:projectKey/:cycleKey', element: withLazy(AioCycleDetailPage) },
```

`withLazy()` is defined at lines 24–32 — do not modify. It wraps in `<ChunkErrorBoundary>` + `<Suspense fallback={<RouteSpinner />}>`.

---

### `taskflow/src/services/aio/types.ts` (MODIFY — model)

**Analog:** itself — current file (`taskflow/src/services/aio/types.ts` lines 1–58).

**Current AioTestRun interface** (lines 42–47):
```ts
export interface AioTestRun {
  id: string;           // Test run ID
  status: string;       // Run status, e.g. "PASS", "FAIL", "NOT_EXECUTED"
  testCaseKey: string;  // Associated test case key, e.g. "PROJ-TC-5"
  cycleKey: string;     // Owning cycle key, e.g. "PROJ-CY-2"
}
```

**Required additions** — replace with:
```ts
export interface AioTestRun {
  id: string;           // Test run ID
  status: string;       // Run status: "PASS" | "FAIL" | "NOT_EXECUTED" | "BLOCKED"
  testCaseKey: string;  // Associated test case key, e.g. "PROJ-TC-5"
  cycleKey: string;     // Owning cycle key, e.g. "PROJ-CY-2"
  testCase?: {          // Nested object — verify field names against live endpoint (D-10)
    title: string;      // Test case display name for run list
    updatedDate?: string; // ISO date fallback if executedDate absent
  };
  defects?: string[];   // Jira issue keys inline, e.g. ["PROJ-42"] (D-14 confirmed)
  executedDate?: string; // Run-level date — executor must confirm field name vs live endpoint (A2)
}
```

**JSDoc comment pattern** — match existing style in `types.ts`: single-line field comments after the field, `/** ... */` block before each interface.

---

### `taskflow/src/services/aio/index.ts` (MODIFY — barrel)

**Analog:** itself — current file (`taskflow/src/services/aio/index.ts` lines 1–11).

**Current barrel** (lines 8–11):
```ts
export * from './types';
export * from './projects';
export * from './issue-runs';
export * from './cycles';
```

**No new module is needed** (RESEARCH.md critical finding: `fetchAioTestRunsForCycle` is already exported via `'./issue-runs'`). The barrel requires NO changes for Phase 53.

If `aioRunStatusBadgeClass()` is added to `statusStyles.ts` (recommended above for AioCycleDetailPage), that is in `@/lib/statusStyles` — no barrel change needed.

---

## Shared Patterns

### Credential Loading
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 17–24
**Apply to:** `AioCycleDetailPage.tsx`
```tsx
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);
useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, []);
```

### Skeleton Flicker Prevention
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` line 34
**Apply to:** `AioCycleDetailPage.tsx`
```tsx
const showSkeleton = useDelayedLoading(isLoading);
```
The hook is `@/hooks/useDelayedLoading`. 200ms delay prevents flash on fast connections.

### AIO Status Badge Pattern
**Source:** `taskflow/src/lib/statusStyles.ts` lines 32–40
**Apply to:** `AioCycleDetailPage.tsx` for run status column + cycle heading badge
```ts
// Existing pattern to mirror for aioRunStatusBadgeClass():
const AIO_CYCLE_BADGE_STYLES: Record<string, string> = {
  Active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Closed: 'bg-muted text-muted-foreground',
};
export function aioCycleStatusBadgeClass(status: string): string {
  return AIO_CYCLE_BADGE_STYLES[status] ?? 'bg-muted text-muted-foreground';
}
```
Copy this structure, add `aioRunStatusBadgeClass()` to the same file.

### AioPage Pagination Loop
**Source:** `taskflow/src/services/aio/issue-runs.ts` lines 40–67 (or `cycles.ts` lines 31–58)
**Apply to:** Only if a new service function is needed (not required for Phase 53 — `fetchAioTestRunsForCycle` is complete)
```ts
for (;;) {
  const path = `${basePath}?startAt=${startAt}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as AioPage<T> | T[];
    if (Array.isArray(data)) return data;
    allItems.push(...(data.items ?? []));
    if (data.isLast) return allItems;
    startAt += data.maxResults;
    continue;
  }
  if (response.status === 401) throw new ApiError('Invalid token or token has expired', 401, 'jira');
  if (response.status === 404) return [];
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

### Zustand Persist + createTauriStorage
**Source:** `taskflow/src/stores/pinned-tabs.store.ts` lines 1–43
**Apply to:** `pinned-tabs.store.ts` (modify in place — same storage key, bump version)
```ts
persist(
  (set, get) => ({ /* state */ }),
  {
    name: 'pinned-tabs-store',
    storage: createTauriStorage('pinned-tabs.json'),
    version: 1,                    // bumped from 0
    migrate: (persisted, version) => {
      const s = persisted as PinnedTabsState;
      if (version < 1) { s.pinnedCycleMeta = {}; }
      return s;
    },
  },
)
```

### NavLink Pattern
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 88–90
**Apply to:** Defect links in `AioCycleDetailPage.tsx`
```tsx
<NavLink to={`/issue/${defectKey}`} className="hover:underline">
  {defectKey}
</NavLink>
```

### Store Test Setup Pattern
**Source:** `taskflow/src/stores/pinned-tabs.store.test.ts` lines 1–16
**Apply to:** Extension of the same test file for new actions
```ts
// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});
```
New tests must reset `pinnedCycleMeta: {}` in `beforeEach` via `usePinnedTabsStore.setState(...)`.

### withLazy Route Wrapping
**Source:** `taskflow/src/routes/routes.tsx` lines 24–32 + 50–51
**Apply to:** New `AioCycleDetailPage` route entry
```ts
// Pattern: lazy import + withLazy() in routes array
const AioCycleDetailPage = lazy(() => import('./dashboard/AioCycleDetailPage'));
{ path: '/aio-cycle/:projectKey/:cycleKey', element: withLazy(AioCycleDetailPage) },
```

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns only.

| File | Note |
|------|------|
| Progress bar segment render | No existing progress bar in the app — use RESEARCH.md + UI-SPEC.md code examples directly |
| Status normalization function | No existing AIO run status normalizer — write inline in `AioCycleDetailPage.tsx` per RESEARCH.md pattern |

---

## Key Pitfalls (from RESEARCH.md — include in plan actions)

1. **useQueries index mismatch:** `pinnedQueries[i]` must index into `issuePinnedKeys`, not `pinnedKeys`. The split must happen before `useQueries` is called.
2. **Fresh install skips migration:** `pinnedCycleMeta: {}` must be in the `create()` factory default, not only in `migrate`.
3. **Cycle key detection:** Use `key.includes('-CY-')` consistently — not regex, not `startsWith`.
4. **Progress bar zero state:** When `total === 0`, render "No runs recorded" text, not a zero-width bar.
5. **executedDate field name unconfirmed:** Executor must probe live endpoint before writing date display. Use `run.executedDate ?? run.testCase?.updatedDate ?? '—'` as defensive fallback.
6. **Defects empty array guard:** Use `allDefects.length > 0` (after `flatMap` + dedup), not presence of the `defects` field.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/stores/`, `taskflow/src/components/app/`, `taskflow/src/services/aio/`, `taskflow/src/routes/routes.tsx`, `taskflow/src/main.tsx`, `taskflow/src/lib/statusStyles.ts`
**Files read:** 13
**Pattern extraction date:** 2026-05-13
