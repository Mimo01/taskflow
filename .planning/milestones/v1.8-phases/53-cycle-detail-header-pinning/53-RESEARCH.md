# Phase 53: Cycle Detail + Header Pinning - Research

**Researched:** 2026-05-13
**Domain:** React / Zustand / AIO TCMS REST API / Tauri
**Confidence:** HIGH (all findings verified against live codebase; AioTestRun field resolution carried from UI-SPEC.md web research with LOW confidence on `executedDate` field name)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extend existing `PinnedTabStrip` — reuse drag/reorder/unpin/ghost infrastructure. Cycle keys (`PROJ-CY-N`) detected by `/CY-/` pattern.
- **D-02:** `usePinnedTabsStore` gains `pinnedCycleMeta: Record<string, { name: string; projectKey: string }>`. Version 0 → 1 with migration: `if (version < 1) { s.pinnedCycleMeta = {}; }`.
- **D-03:** `PinnedTabStrip` prop `resolvedIssues` → `resolvedTabs: Map<string, IssueTab | CycleTab>` discriminated union. `IssueTab = { type: 'issue'; summary: string; issueTypeName: string }`, `CycleTab = { type: 'cycle'; name: string; projectKey: string }`.
- **D-04:** Cycle keys skip `useQueries` — metadata read from store at paint time. Issue keys use existing `useQueries` → `fetchIssueSummary` flow.
- **D-05:** Active tab: extract `cycleKey` from `/aio-cycle/:projectKey/:cycleKey`. `activeKey = activeIssueKey ?? activeCycleKey`.
- **D-06:** Tab click: `/CY-/` match → `navigate('/aio-cycle/${meta.projectKey}/${key}')`. Otherwise → `handleIssueClick(key, true)`.
- **D-07:** Reordering is free — issue and cycle tabs interleave arbitrarily.
- **D-08:** Pin button calls `togglePin(cycleKey)` + `setPinnedCycleMeta(...)` on pin, `removePin(cycleKey)` + clear meta on unpin.
- **D-09:** Progress bar derived client-side from already-fetched runs. Zero extra API calls.
- **D-12:** Status filter labels normalized: `NOT_EXECUTED` → "Not Run", `PASS` → "Pass", `FAIL` → "Fail", `BLOCKED` → "Blocked".
- **D-13:** Four chips (Not Run / Pass / Fail / Blocked). Multiple active simultaneously (OR logic). Default: all active.
- **D-16:** Page layout order: heading + pin button → progress bar → filter chips + run list → defects section.
- **D-17:** `AioCycleDetailSkeleton.tsx` sibling — same pattern as `AioCyclesSkeleton.tsx`.
- **D-18:** Pin button label: "Pin cycle" / "Unpin cycle".

### Claude's Discretion
- **D-10/D-11:** Researcher verifies AioTestRun field names. UI-SPEC.md resolved: use `testCase.title` for test case name. Run-level date field name (`executedDate`?) must be confirmed by executor against live endpoint.
- **D-14:** Defects inline on run object (`defects?: string[]`). AIOC-03 remains in scope.
- **D-15:** Deduplicated defects from all runs (not just FAIL). Links to `/issue/:key`.

### Deferred Ideas (OUT OF SCOPE)
- Per-run defect fetch (if not inline) — descoped; not applicable since D-14 resolved inline.
- Cycle burndown / trend charts (AIOCH-01/AIOCH-02).
- Real-time status updates / polling.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AION-04 | User can view a full-page cycle detail page (progress, test runs, defects) | AioCycleDetailPage.tsx with `fetchAioTestRunsForCycle`, progress bar derived from runs, defects section |
| AIOC-01 | User can see an execution progress bar with pass/fail/blocked/not-run counts and percentages | Client-side reduce over `AioTestRun.status`; 4 colored segments; labels below |
| AIOC-02 | User can see the test run list for a cycle (test case name, status, last run date) | `testCase.title` for name; `executedDate`/fallback for date; status badge |
| AIOC-03 | User can see the defects list (Jira issues linked from failed runs, clickable to issue detail) | `defects?: string[]` inline on run object (D-14 resolved); deduplicated; NavLink to `/issue/:key` |
| AIOP-01 | User can pin a test cycle to the header tab strip | Pin button on detail page; `togglePin` + `setPinnedCycleMeta`; PinnedTabStrip extended |
| AIOP-02 | User can unpin a pinned cycle from the header tab strip | `removePin` + clear meta; context menu "Unpin" on tab |
| AIOP-03 | Pinned cycle tabs persist across app restarts | `pinnedCycleMeta` persisted via `createTauriStorage`; version 0 → 1 migration |
</phase_requirements>

---

## Summary

Phase 53 builds on Phase 52's completed navigation layer. The route `/aio-cycle/:projectKey/:cycleKey` was NOT added in Phase 52 — the codebase currently ends at `/aio-project/:projectKey`. Phase 53 must add the route, the `AioCycleDetailPage` component, extend `usePinnedTabsStore` with a new persisted field and version bump, and refactor `PinnedTabStrip` to handle a discriminated union of issue and cycle tabs.

The `fetchAioTestRunsForCycle` function already exists in `issue-runs.ts` and is production-ready with pagination, error handling, and tests. Phase 53 does NOT need to create a new service function — it can use this existing one. The `AioTestRun` interface needs field additions: `testCase?: { title: string; updatedDate?: string }` and `defects?: string[]`. The run-level date field name (`executedDate`) is unconfirmed from public docs; executor must probe live endpoint and use `testCase.updatedDate` as fallback.

Main.tsx wiring is the most surgical change: the existing `useQueries` block must be split so cycle keys bypass it entirely, and the `resolvedPinnedTabs` map must be rebuilt as a discriminated union map. These are ~25-30 line changes in an already-working 500+ line file; the exact lines are documented below.

**Primary recommendation:** Follow the locked decisions exactly. The codebase patterns are mature — no new abstractions needed; the work is extension, not invention.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cycle detail page (progress bar, run list, defects) | Frontend (lazy route) | AIO REST API | All rendering client-side; API data fetched via React Query |
| Cycle run fetching with pagination | AIO Service Layer (`issue-runs.ts`) | — | Existing `fetchAioTestRunsForCycle` function — no new module needed |
| Progress bar computation | Frontend (AioCycleDetailPage) | — | Client-side reduce over fetched runs; D-09 confirmed zero extra API calls |
| Status filter chips | Frontend (AioCycleDetailPage) | — | Local `useState` for active filters; OR logic filter on runs array |
| Pinned tab persistence | Zustand persist store | Tauri storage (JSON file) | `createTauriStorage('pinned-tabs.json')` — cross-restart persistence |
| Active tab highlight detection | Frontend (main.tsx) | — | URL pattern matching; `useLocation()` already wired there |
| Tab click routing | Frontend (main.tsx `onTabClick`) | — | Discriminate by `/CY-/` pattern; cycle → navigate; issue → handleIssueClick |

---

## What Phase 52 Actually Built

**Verified against `taskflow/src/routes/routes.tsx` (current state):**

Phase 52 added these lazy routes: [VERIFIED: codebase read]
```tsx
const AioProjectsPage = lazy(() => import('./dashboard/AioProjectsPage'));
const AioProjectOverviewPage = lazy(() => import('./dashboard/AioProjectOverviewPage'));
// ...
{ path: '/aio-projects', element: withLazy(AioProjectsPage) },
{ path: '/aio-project/:projectKey', element: withLazy(AioProjectOverviewPage) },
```

**The `/aio-cycle/:projectKey/:cycleKey` route was NOT added by Phase 52.** Phase 52 D-14 explicitly left this as "stub or deferred to Phase 53 — Phase 52 planner decides." The planner chose to defer. Phase 53 must add:
```tsx
const AioCycleDetailPage = lazy(() => import('./dashboard/AioCycleDetailPage'));
// in routes array:
{ path: '/aio-cycle/:projectKey/:cycleKey', element: withLazy(AioCycleDetailPage) },
```

**What Phase 52 did build that Phase 53 consumes directly:** [VERIFIED: codebase read]
- `AioProjectOverviewPage.tsx` — direct predecessor pattern to mirror
- `AioCyclesSkeleton.tsx` — skeleton pattern (5 `<Skeleton>` rows in a flex-col gap-2 div)
- `cycles.ts` + `fetchAioCycles()` with pagination loop — exact mirror for `fetchCycleTestRuns` (but see below: this function already exists in `issue-runs.ts`)
- `aioCycleStatusBadgeClass()` in `statusStyles.ts` — AIO status badge pattern
- `FlaskConical` icon already imported in `Sidebar.tsx`

---

## Current State of `usePinnedTabsStore`

**File:** `taskflow/src/stores/pinned-tabs.store.ts` [VERIFIED: codebase read]

**Current version:** `0`

**Current interface:**
```ts
interface PinnedTabsState {
  pinnedKeys: string[];
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  isPinned: (key: string) => boolean;
}
```

**Current persist config:**
```ts
{
  name: 'pinned-tabs-store',
  storage: createTauriStorage('pinned-tabs.json'),
  version: 0,
  migrate: (persisted, _version) => persisted as PinnedTabsState,
}
```

**Changes required for Phase 53 (D-02, D-08):**

1. Add `pinnedCycleMeta: Record<string, { name: string; projectKey: string }>` to the state interface
2. Add `setPinnedCycleMeta: (key: string, meta: { name: string; projectKey: string }) => void` action
3. Add `clearCycleMeta: (key: string) => void` action (called on unpin)
4. Bump `version: 0` to `version: 1`
5. Replace the migrate stub with real migration:
   ```ts
   migrate: (persisted, version) => {
     const s = persisted as PinnedTabsState;
     if (version < 1) {
       s.pinnedCycleMeta = {};
     }
     return s;
   }
   ```

**Existing tests** (`pinned-tabs.store.test.ts`) cover: `togglePin`, `isPinned`, `removePin`, `reorder`. New tests must cover `setPinnedCycleMeta`, `clearCycleMeta`, and the v0→v1 migration.

---

## Current State of `PinnedTabStrip`

**File:** `taskflow/src/components/app/PinnedTabStrip.tsx` [VERIFIED: codebase read]

**Current props interface:**
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

**Current tab rendering (lines 263–280):** When `resolved` exists, renders `<IssueTypeIcon>` + two-line text (key in `font-mono text-[9px]`, summary in `text-[11px]`). When `resolved` is null/undefined (loading), renders `<Loader2>` spinner + key string.

**Current ghost rendering (lines 173–191):** Same two paths — resolved/unresolved.

**Current `aria-label`:** `"Pinned issues"` (line 201 — needs updating to "Pinned tabs").

**Changes required for Phase 53 (D-03):**

1. Add `FlaskConical` to lucide-react imports
2. Rename `resolvedIssues` prop to `resolvedTabs` throughout
3. Replace `ResolvedIssue` interface with discriminated union:
   ```ts
   type IssueTab = { type: 'issue'; summary: string; issueTypeName: string };
   type CycleTab = { type: 'cycle'; name: string; projectKey: string };
   type ResolvedTab = IssueTab | CycleTab;
   ```
4. Update `resolvedIssues.get(key)` → `resolvedTabs.get(key)` at two call sites (ghost + main render)
5. Update tab rendering to switch on `resolved.type`:
   - `type === 'issue'`: existing `<IssueTypeIcon>` + key + summary (unchanged)
   - `type === 'cycle'`: `<FlaskConical className="w-3.5 h-3.5 shrink-0 text-muted-foreground">` + key + name (same two-line layout)
6. Update ghost rendering with same switch
7. Update `aria-label="Pinned issues"` → `aria-label="Pinned tabs"`
8. Cycle tabs never show `<Loader2>` — metadata is always present from store at paint time; the `!resolved` branch renders `<Loader2>` for issue tabs only (or keep as-is since cycle tabs will always have resolved data)

**No changes needed:** drag/reorder state, pointer event handlers, drop target logic, context menu, tab dimensions/styling classes.

---

## Exact `main.tsx` Lines That Need Modification

**File:** `taskflow/src/main.tsx` [VERIFIED: codebase read, lines 140–190, 269–273, 481–489]

### Change 1: Import `usePinnedTabsStore` new actions (line ~140–142)

Current:
```ts
const pinnedKeys = usePinnedTabsStore((s) => s.pinnedKeys);
const removePin = usePinnedTabsStore((s) => s.removePin);
const reorderPins = usePinnedTabsStore((s) => s.reorder);
```

Add:
```ts
const pinnedCycleMeta = usePinnedTabsStore((s) => s.pinnedCycleMeta);
```

### Change 2: `useQueries` block (lines 166–178) — split issue keys from cycle keys

Current: every `pinnedKey` feeds into `useQueries`.

Required: split `pinnedKeys` into `issuePinnedKeys` (no `/CY-/`) and `cyclePinnedKeys` (has `/CY-/`). Only `issuePinnedKeys` go into `useQueries`.

```ts
const issuePinnedKeys = pinnedKeys.filter((k) => !k.includes('-CY-'));
const cyclePinnedKeys = pinnedKeys.filter((k) => k.includes('-CY-'));

const pinnedQueries = useQueries({
  queries: issuePinnedKeys.map((issueKey) => ({
    queryKey: ['jira-pinned-summary', issueKey, jiraBaseUrl],
    queryFn: async () => { /* unchanged */ },
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraConnected,
  })),
});
```

### Change 3: `resolvedPinnedTabs` map construction (lines 181–190)

Current builds `Map<string, { summary, issueTypeName }>`.

Replace with discriminated union map:
```ts
const resolvedPinnedTabs = new Map<string, IssueTab | CycleTab>();

// Issue tabs — from useQueries
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

// Cycle tabs — from store (always available at paint time)
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

### Change 4: Active key derivation (lines 269–272)

Current:
```ts
const activeIssueKey = location.pathname.startsWith('/issue/')
  ? location.pathname.replace('/issue/', '')
  : null;
```

Add `activeCycleKey` derivation below:
```ts
const activeCycleKey = location.pathname.startsWith('/aio-cycle/')
  ? location.pathname.split('/')[3] ?? null  // /aio-cycle/:projectKey/:cycleKey → index 3
  : null;
```

Note: `location.pathname` for `/aio-cycle/PROJ/PROJ-CY-2` splits to `['', 'aio-cycle', 'PROJ', 'PROJ-CY-2']` → index 3 is the cycle key.

### Change 5: `onTabClick` handler update (line ~285, `PinnedTabStrip` call)

Current: `onTabClick={(key) => handleIssueClick(key, true)}`

Replace with:
```ts
onTabClick={(key) => {
  if (key.includes('-CY-')) {
    const meta = pinnedCycleMeta[key];
    if (meta) navigate(`/aio-cycle/${meta.projectKey}/${key}`);
  } else {
    handleIssueClick(key, true);
  }
}}
```

### Change 6: `PinnedTabStrip` render (lines 481–489)

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

Required changes:
- `activeKey={activeIssueKey}` → `activeKey={activeIssueKey ?? activeCycleKey}`
- `resolvedIssues={resolvedPinnedTabs}` → `resolvedTabs={resolvedPinnedTabs}`
- `onTabClick` → updated handler from Change 5

---

## `AioTestRun` Field Resolution

**File:** `taskflow/src/services/aio/types.ts` [VERIFIED: codebase read]

**Current interface (minimal — needs extension):**
```ts
export interface AioTestRun {
  id: string;
  status: string;       // "PASS" | "FAIL" | "NOT_EXECUTED" | "BLOCKED"
  testCaseKey: string;
  cycleKey: string;
}
```

**Required additions for Phase 53:**

The UI-SPEC.md resolved D-10, D-11, D-14 from AIO REST API web research (2026-05-13): [CITED: 53-UI-SPEC.md §API Shape Decisions]

- `testCase.title` — test case display name (nested object on run response)
- `defects?: string[]` — Jira issue keys inline on run object (D-14 confirmed in scope)
- Run-level date: field name NOT confirmed from public docs — executor must probe live endpoint

**Updated interface to add in `types.ts`:**
```ts
export interface AioTestRun {
  id: string;
  status: string;           // "PASS" | "FAIL" | "NOT_EXECUTED" | "BLOCKED"
  testCaseKey: string;
  cycleKey: string;
  testCase?: {              // nested object — verify field names against live endpoint (D-10)
    title: string;          // display name for the test run list
    updatedDate?: string;   // ISO date — fallback run date if executedDate absent
  };
  defects?: string[];       // Jira issue keys, e.g. ["PROJ-42"] (D-14 confirmed)
  executedDate?: string;    // run-level date — executor must confirm field name vs live endpoint
}
```

**Confidence:** `testCase.title` and `defects?: string[]` — MEDIUM (from UI-SPEC.md web research). `executedDate` field name — LOW (unconfirmed; executor probes live endpoint; fallback to `testCase.updatedDate`).

**Executor action required:** Before writing `AioCycleDetailPage`, fetch one real run object from the live endpoint and log the full JSON. Confirm `testCase` field exists with `title`, and identify the actual date field name. Update `AioTestRun` accordingly.

---

## `fetchCycleTestRuns` — Already Exists

**Critical finding:** Phase 53 does NOT need to write a new service function. [VERIFIED: codebase read]

`fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)` already exists in `taskflow/src/services/aio/issue-runs.ts` and is already exported from `aio/index.ts`. It is production-ready with:
- Full pagination loop (mirrors `fetchAioCycles` exactly)
- `ApiError` on 401
- Empty array on 404
- 5 passing unit tests in `issue-runs.test.ts`

Phase 53 uses this function directly. No new `cycles-detail.ts` or `runs.ts` module needed.

**Query key for the detail page:**
```ts
queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]
```

---

## Filter Chips Implementation Decision

**QuickFilterChipRow.tsx** is NOT directly reusable for the AIO status filter chips. [VERIFIED: codebase read]

`QuickFilterChipRow` is tightly coupled to `useFilterStore` (Jira quick filter store), `JiraBoardQuickFilter` types, and JQL evaluation. Reusing it would require extracting those dependencies.

**Recommendation:** Build the 4 status filter chips inline in `AioCycleDetailPage` using the same visual pattern:
- `<Badge variant={isActive ? 'default' : 'outline'}>` for each chip
- Local `useState<Set<string>>(new Set(['NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKED']))` for active statuses (default: all active)
- `role="switch"` + `aria-checked` on each `<Badge>`
- `ArrowLeft`/`ArrowRight` keyboard navigation with `useRef` array

The chip visual pattern (Badge variant toggle) is verified from `QuickFilterChipRow.tsx`. The implementation is self-contained and simpler than pulling in `QuickFilterChipRow`'s store coupling.

---

## Standard Stack

All libraries are already installed in the project. No new packages required. [VERIFIED: codebase read]

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.x | Component rendering |
| React Router | 6.x | `useParams`, `NavLink`, `useNavigate` |
| @tanstack/react-query | 5.x | `useQuery` for runs fetch |
| Zustand | 5.x | `usePinnedTabsStore` extension |
| lucide-react | latest | `FlaskConical`, `PinOff` icons |
| shadcn `<Badge>` | installed | Filter chips, status badges |
| shadcn `<Button>` | installed | Pin/Unpin button |
| shadcn `<Skeleton>` | installed | `AioCycleDetailSkeleton` |

---

## Architecture Patterns

### Page Structure (mirror `AioProjectOverviewPage`)

```
AioCycleDetailPage
├── useParams({ projectKey, cycleKey })
├── useAuthStore → jiraBaseUrl
├── useState(token) + useEffect(readSecret)
├── useQuery({ queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey], queryFn: fetchAioTestRunsForCycle, enabled })
├── useDelayedLoading(isLoading)
├── usePinnedTabsStore({ isPinned, togglePin, removePin, setPinnedCycleMeta, clearCycleMeta, pinnedCycleMeta })
├── useState(activeFilters: Set<string>) — default: all 4 statuses
└── render:
    ├── showSkeleton → AioCycleDetailSkeleton
    ├── isError → ErrorState
    ├── data.length === 0 → EmptyState (FlaskConical icon)
    └── data present:
        ├── Page header (cycle.name + status badge + Pin/Unpin button)
        ├── Progress bar (derived from data via reduce)
        ├── Filter chip row (local state)
        ├── Test run table (filtered data)
        └── Defects section (if any run has defects.length > 0)
```

### Progress Bar Computation Pattern

```ts
const counts = (runs ?? []).reduce(
  (acc, run) => {
    const normalized = normalizeStatus(run.status); // 'pass' | 'fail' | 'blocked' | 'notRun'
    acc[normalized]++;
    return acc;
  },
  { pass: 0, fail: 0, blocked: 0, notRun: 0 },
);
const total = runs?.length ?? 0;
const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
```

### Status Normalization

```ts
function normalizeStatus(raw: string): 'pass' | 'fail' | 'blocked' | 'notRun' {
  switch (raw.toUpperCase()) {
    case 'PASS': return 'pass';
    case 'FAIL': return 'fail';
    case 'BLOCKED': return 'blocked';
    default: return 'notRun'; // NOT_EXECUTED and unknowns
  }
}
```

### Defects Derivation

```ts
const allDefects = [...new Set(
  (runs ?? [])
    .flatMap((r) => r.defects ?? [])
    .filter(Boolean)
)];
const hasDefects = allDefects.length > 0;
```

### Recommended File Layout

```
taskflow/src/
├── routes/dashboard/
│   ├── AioCycleDetailPage.tsx        ← new (Phase 53)
│   └── AioCycleDetailSkeleton.tsx    ← new (Phase 53)
├── services/aio/
│   └── types.ts                      ← update AioTestRun interface
├── stores/
│   └── pinned-tabs.store.ts          ← add pinnedCycleMeta, setPinnedCycleMeta, clearCycleMeta, version 0→1
├── components/app/
│   └── PinnedTabStrip.tsx            ← rename prop, add CycleTab rendering
├── routes/routes.tsx                 ← add AioCycleDetailPage lazy route
└── main.tsx                          ← 6 targeted changes (documented above)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test run fetching with pagination | Custom fetch loop | `fetchAioTestRunsForCycle` (already in `issue-runs.ts`) | Already tested, production-ready |
| Skeleton flicker prevention | Custom debounce | `useDelayedLoading(isLoading)` | 200ms delay hook already in codebase |
| Tab persistence across restarts | Custom file I/O | `createTauriStorage` (Zustand persist) | Already used in pinned-tabs.store.ts |
| Status badge colors | Custom CSS | `aioCycleStatusBadgeClass()` in `statusStyles.ts` | Existing pattern; add AIO run status variant |
| Lazy route wrapping | Custom Suspense | `withLazy(Component)` in `routes.tsx` | Established pattern across all lazy routes |
| Chunk error boundary | Custom error UI | `withLazy()` includes `<ChunkErrorBoundary>` | Already handles chunk load failures |

---

## Common Pitfalls

### Pitfall 1: useQueries index mismatch after pinnedKeys split
**What goes wrong:** If `pinnedKeys` is split into issue/cycle arrays but `useQueries` still uses the original `pinnedKeys` array, the `pinnedQueries[i]` index lookup becomes misaligned with `issuePinnedKeys`.
**Prevention:** `useQueries` must be driven by `issuePinnedKeys` (not `pinnedKeys`), and the `resolvedPinnedTabs` build loop must iterate `issuePinnedKeys.forEach((key, i)` — not `pinnedKeys`.

### Pitfall 2: Zustand persist migration not running on fresh install
**What goes wrong:** When `version: 0` → `version: 1`, the `migrate` function only runs if the persisted state was written at version 0. A fresh install (no existing data) skips migration and initializes from the `create()` factory. The factory must include `pinnedCycleMeta: {}` as a default value, not rely on migration to populate it.
**Prevention:** Add `pinnedCycleMeta: {}` as a default in the `create()` body, AND add the migration guard for persistence upgrades.

### Pitfall 3: Cycle key detection regex — `/CY-/` vs full format
**What goes wrong:** Using `.includes('-CY-')` is the agreed pattern (D-01, D-06). Do not use regex, do not use `.startsWith`. The AIO cycle key format is `{PROJ}-CY-{N}` (e.g., `PROJ-CY-Adhoc`, `PROJ-CY-2`) — the `-CY-` substring is always present.
**Prevention:** Use `key.includes('-CY-')` consistently in `main.tsx` (useQueries split, tab click handler) and in `PinnedTabStrip` if any local detection is needed.

### Pitfall 4: Progress bar empty state (zero runs)
**What goes wrong:** Rendering a segmented bar when `total === 0` causes division-by-zero or all-zero segments with no visual indication.
**Prevention:** When `total === 0`, render a single gray bar and text "No runs recorded" instead of the segmented bar (per UI-SPEC.md copywriting contract).

### Pitfall 5: executedDate field name not confirmed
**What goes wrong:** Hardcoding `run.executedDate` before probing the live endpoint yields `undefined` for all dates in the table.
**Prevention:** Executor must log the full JSON of at least one real AioTestRun object before writing the date display code. Use `run.executedDate ?? run.testCase?.updatedDate ?? '—'` as the defensive fallback.

### Pitfall 6: Defects section showing for empty defects arrays
**What goes wrong:** `run.defects` may be an empty array `[]` on runs with no defects (not `undefined`). `flatMap` over those yields nothing, but the section guard `defects.length > 0` must check `allDefects.length`, not whether `defects` field exists.
**Prevention:** Use `allDefects.length > 0` (after `flatMap` and dedup) as the render condition, not `some(r => r.defects !== undefined)`.

---

## Code Examples

### AioCycleDetailSkeleton (mirror AioCyclesSkeleton pattern)

```tsx
// Source: taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx (verified pattern)
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

### Progress Bar Segment Render

```tsx
// Source: UI-SPEC.md §Progress Bar — segment layout (verified pattern spec)
<div className="w-full h-2 rounded-full overflow-hidden flex">
  {counts.pass > 0 && (
    <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />
  )}
  {counts.fail > 0 && (
    <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />
  )}
  {counts.blocked > 0 && (
    <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />
  )}
  {counts.notRun > 0 && (
    <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />
  )}
</div>
<div className="flex gap-4 mt-1">
  <span className="text-xs text-muted-foreground">Pass: {counts.pass} ({pct(counts.pass)}%)</span>
  <span className="text-xs text-muted-foreground">Fail: {counts.fail} ({pct(counts.fail)}%)</span>
  <span className="text-xs text-muted-foreground">Blocked: {counts.blocked} ({pct(counts.blocked)}%)</span>
  <span className="text-xs text-muted-foreground">Not Run: {counts.notRun} ({pct(counts.notRun)}%)</span>
</div>
```

### Cycle Tab Rendering in PinnedTabStrip

```tsx
// Source: UI-SPEC.md + CONTEXT.md D-03, specifics (verified against PinnedTabStrip.tsx layout)
{resolved?.type === 'cycle' ? (
  <>
    <FlaskConical className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    <div className="flex flex-col min-w-0 leading-none">
      <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
        {key}
      </span>
      <span className="truncate text-[11px] leading-tight">{resolved.name}</span>
    </div>
  </>
) : resolved?.type === 'issue' ? (
  <>
    <IssueTypeIcon typeName={resolved.issueTypeName} />
    <div className="flex flex-col min-w-0 leading-none">
      <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
        {key}
      </span>
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

---

## Environment Availability

Step 2.6: SKIPPED — Phase 53 is purely frontend code changes. All external dependencies (AIO API, Jira API) were verified in Phase 51 probe. No new CLI tools or services needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + React Testing Library 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AION-04 | AioCycleDetailPage renders with cycle data | component | `npm test -- AioCycleDetailPage` | ❌ Wave 0 |
| AIOC-01 | Progress bar shows correct counts (pass=3, fail=1, etc.) | unit | `npm test -- AioCycleDetailPage` | ❌ Wave 0 |
| AIOC-02 | Run list shows testCase.title, status, date | component | `npm test -- AioCycleDetailPage` | ❌ Wave 0 |
| AIOC-03 | Defects section renders deduped Jira links | component | `npm test -- AioCycleDetailPage` | ❌ Wave 0 |
| AIOP-01 | Pin button calls togglePin + setPinnedCycleMeta | component | `npm test -- AioCycleDetailPage` | ❌ Wave 0 |
| AIOP-02 | Unpin clears meta and removes key | store unit | `npm test -- pinned-tabs.store` | ❌ Wave 0 (extend existing) |
| AIOP-03 | pinnedCycleMeta persists (v0→v1 migration) | store unit | `npm test -- pinned-tabs.store` | ❌ Wave 0 (extend existing) |
| AIOP-01/02 | Cycle tab renders in PinnedTabStrip with FlaskConical | component | `npm test -- PinnedTabStrip` | ❌ Wave 0 |
| AIOC-01 | Filter chips toggle; OR logic; all-off shows inline message | component | `npm test -- AioCycleDetailPage` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test -- --reporter=dot`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` — covers AION-04, AIOC-01, AIOC-02, AIOC-03, AIOP-01
- [ ] `taskflow/src/components/app/PinnedTabStrip.test.tsx` — covers cycle tab rendering (new file; no existing PinnedTabStrip test)
- [ ] Extend `taskflow/src/stores/pinned-tabs.store.test.ts` — covers AIOP-02, AIOP-03, migration

**Existing tests to preserve (must stay green throughout):**
- `issue-runs.test.ts` (5 tests) — `fetchAioTestRunsForCycle`
- `cycles.test.ts` (5 tests) — `fetchAioCycles`
- `AioProjectOverviewPage.test.tsx` (3 tests)
- `pinned-tabs.store.test.ts` (5 tests — must extend, not replace)

---

## Security Domain

Phase 53 is read-only UI extension consuming existing authenticated service layer. No new auth paths, no new secret handling, no user input that reaches the API unfiltered.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (reuses Phase 51 Bearer PAT via `readSecret`) | — |
| V3 Session Management | No | — |
| V4 Access Control | No (read-only; AIO server enforces access) | — |
| V5 Input Validation | No (params from URL are passed to `encodeURIComponent` in `aioFetch`) | URL encoding already present in `fetchAioTestRunsForCycle` |
| V6 Cryptography | No | — |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `testCase.title` is the field name for test case display name on AioTestRun | AioTestRun Field Resolution | Run list shows `undefined` instead of test case name; executor must probe and correct |
| A2 | `executedDate` is the run-level date field name | AioTestRun Field Resolution | Date column shows `—` for all rows; fallback to `testCase.updatedDate` reduces impact |
| A3 | `defects?: string[]` contains Jira issue keys directly (not objects) | AioTestRun Field Resolution | Defect links render malformed; require type fix if defects are objects |
| A4 | Phase 52 did not add the `/aio-cycle/:projectKey/:cycleKey` stub route | What Phase 52 Built | If stub exists, Phase 53 must update rather than add the route entry |

**A4 is verified LOW-risk** — confirmed by reading `routes.tsx` directly; the route is absent.
**A1, A2, A3 are MEDIUM risk** — sourced from UI-SPEC.md web research (2026-05-13); executor must verify against live endpoint before writing type definitions.

---

## Open Questions (RESOLVED)

1. **`executedDate` field name on AioTestRun**
   - What we know: `testCase.updatedDate` exists as a fallback (UI-SPEC.md D-10)
   - What's unclear: whether the run object has its own date field and what it's named
   - Recommendation: Executor fetches one live run object, logs JSON, confirms before writing the `AioTestRun` type update. Use `run.executedDate ?? run.testCase?.updatedDate ?? '—'` as defensive render.

2. **`AioCycle` fetch needed for cycle name in page heading**
   - What we know: `AioCycleDetailPage` receives `cycleKey` from URL params; `cycle.name` is needed for the heading and pin metadata
   - What's unclear: Does the page need to re-fetch the cycle object, or can `cycle.name` come from a different source?
   - Recommendation: The simplest approach is to pass `cycle.name` from the already-loaded runs query (if runs include a cycle-level name field), OR add a separate `useQuery` for `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/detail` to get the cycle name and status for the heading. Phase 51 D-17 confirmed this detail endpoint exists. A single extra query for cycle-level metadata is acceptable and clean.

3. **`AioCycle.status` badge on detail page**
   - What we know: `aioCycleStatusBadgeClass()` exists in `statusStyles.ts` for "Active"/"Closed"
   - What's unclear: Whether the detail endpoint returns a cycle status
   - Recommendation: Fetch cycle detail for heading (open question 2 above) — this resolves status availability simultaneously.

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/stores/pinned-tabs.store.ts` — current version (0), state interface, persist config
- `taskflow/src/components/app/PinnedTabStrip.tsx` — full props interface, all render paths, aria-label
- `taskflow/src/main.tsx` lines 130–210, 269–273, 481–489 — useQueries block, resolvedPinnedTabs, activeIssueKey, PinnedTabStrip render
- `taskflow/src/routes/routes.tsx` — confirmed absence of `/aio-cycle` route
- `taskflow/src/services/aio/types.ts` — current AioTestRun interface (minimal)
- `taskflow/src/services/aio/issue-runs.ts` — `fetchAioTestRunsForCycle` exists and is complete
- `taskflow/src/services/aio/cycles.ts` — `fetchAioCycles` pattern (mirrors what runs function already does)
- `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` — predecessor page pattern
- `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` — skeleton pattern
- `taskflow/src/routes/dashboard/QuickFilterChipRow.tsx` — chip visual pattern (Badge variant toggle)
- `taskflow/src/lib/statusStyles.ts` — AIO badge style functions
- `taskflow/src/stores/pinned-tabs.store.test.ts` — existing test coverage
- `taskflow/src/stores/settings.store.ts` — confirmed v16 (Phase 52 completed)

### Secondary (MEDIUM confidence)
- `taskflow/.planning/phases/53-cycle-detail-header-pinning/53-UI-SPEC.md` — AioTestRun field resolution from web research 2026-05-13

### Tertiary (LOW confidence — marked for executor validation)
- AIO REST API field names (`testCase.title`, `defects?: string[]`, `executedDate`) — from UI-SPEC.md web research; not directly verified via tool in this session

---

## Metadata

**Confidence breakdown:**
- Phase 52 output (what was built): HIGH — verified from `routes.tsx` directly
- Store current state: HIGH — read file directly
- PinnedTabStrip current state: HIGH — read file directly
- main.tsx change points: HIGH — read exact lines
- AioTestRun field names: MEDIUM/LOW — sourced from UI-SPEC.md web research; confirmed MEDIUM for `defects` and `testCase.title`, LOW for `executedDate`
- Service layer reuse: HIGH — `fetchAioTestRunsForCycle` verified complete and tested

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (stable codebase; AIO API changes require re-probe)
