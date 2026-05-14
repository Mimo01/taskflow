# Phase 56: Redesign AIO Cycles Page, Optimize AIO Loading Performance, Add Defects and Executions Views — Research

**Researched:** 2026-05-14
**Domain:** React / TanStack Query / shadcn UI — AIO page refactor, credential hook extraction, tabbed layout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Mini progress bar + pass/fail/blocked/not-run counts per cycle row. Same green/red/orange/muted color scheme.
- D-02: Column layout: Key (mono) | Name (NavLink) | Status badge | Progress bar + counts. No date column.
- D-03: Progressive loading — cycle list renders immediately; each row fires its own `useQuery` for run stats; skeleton per row until resolved.
- D-04: Stats reduction reuses the exact `normalizeStatus` → `{ pass, fail, blocked, notRun }` accumulator from `AioCycleDetailPage.tsx`. Researcher to confirm `fetchAioTestRunsForCycle` is the correct call.
- D-05: Tab bar immediately below the progress section. Two tabs: Executions (default) | Defects.
- D-06: shadcn `<Tabs>` from `taskflow/src/components/ui/tabs.tsx`.
- D-07: Filter chips toolbar moves inside the Executions `<TabsContent>`.
- D-08: Executions tab = existing run table promoted to tab + clickable rows navigating to `AioTestRunDetailPage`.
- D-09: Run rows use `onClick` + `useNavigate()` (planner picks cleanest approach).
- D-10: Defects tab = Key (NavLink `/issue/:key`) | title (`fetchJiraIssueByKey`) | status chip | Triggered By (test case keys).
- D-11: Each defect row fires one `useQuery` for Jira issue data. Use `fetchJiraIssueByKey`.
- D-12: "Triggered by" = `testCaseKey` values from runs with that defect key. Derived from already-fetched runs. No extra API call.
- D-13: Empty Defects tab uses `<EmptyState>`: "No defects" / "No defects are linked to runs in this cycle."
- D-14: New hook `taskflow/src/hooks/useAioCredentials.ts` with `{ token: string | null; isLoading: boolean }`.
- D-15: All three AIO pages replace their inline `useEffect + readSecret` with `useAioCredentials()`.
- D-16: `useQuery.enabled` gates on `!!jiraBaseUrl && !!token && !isLoading`. New components use `useAioCredentials()` or receive token as prop — planner picks.

### Claude's Discretion
- Visual design of mini progress bar: narrow (h-1.5 or h-2) horizontal bar, same color scheme. Counts as small text below or to the right.
- Exact `Tabs.Root`/`Tabs.List` layout — follow visual rhythm of Settings pages.
- Whether run row click uses `<NavLink>` on `<tr>` or `useNavigate()` + `onClick` — planner picks (must not break keyboard navigation).
- `useAioCredentials` placement — `src/hooks/`. Add to barrel if one exists.

### Deferred Ideas (OUT OF SCOPE)
- Pre-loading AIO token into `useAuthStore` at app startup.
- Route-level pre-loading (React Router loader pattern).
- Date column on cycles page — `AioCycle` doesn't carry a date field.
- Total run count column.
- Executions tab: executor/tester column.
- Multi-image lightbox for defect attachments.
- Write actions on defects (AIOWR-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AION-03 | User can view a project overview page showing all cycles with per-cycle summary stats | `fetchAioTestRunsForCycle` confirmed as correct call; per-row `useQuery` pattern verified from `AioCycleDetailPage` |
| AIOC-03 | User can see the defects list (Jira issues linked from failed runs, clickable to issue detail) | `fetchJiraIssueByKey` confirmed to return `fields.summary` and `fields.status.name`; `allDefects` derivation pattern exists in current page |
</phase_requirements>

---

## Summary

Phase 56 has three closely related work streams that share a single data source (`fetchAioTestRunsForCycle`) and a single credential path (`readSecret('jira-pat')`).

The **cycles page redesign** adds per-row stats via progressive `useQuery` calls — one per cycle, using the same query key prefix (`['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]`) already used by the cycle detail page. This means visiting a cycle detail first causes the cycles page stats rows to render instantly from cache on return, which is a desirable cache-warm effect.

The **tabbed cycle detail** wraps the existing content in `<Tabs>` from `@base-ui/react/tabs` (already installed as shadcn's `tabs.tsx`). The API for this component uses `TabsPrimitive.Root`, `TabsPrimitive.List`, `TabsPrimitive.Tab`, and `TabsPrimitive.Panel` via the re-exported `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` wrappers. The `defaultValue` prop drives the active tab. The existing defects "section" at the bottom of the page becomes the Defects tab with enrichment.

The **credential hook** is a pure `useState + useEffect` extract — no Zustand, no React Query. It maps one-to-one onto the existing inline pattern in all three pages. The `!isLoading` guard in the `enabled` condition is critical: without it, queries fire once with `token === null` (before the Stronghold read resolves), which causes a brief auth-error flash.

**Primary recommendation:** Implement in three independent tasks — (1) `useAioCredentials` hook + apply to all three pages, (2) cycles page stats rows, (3) cycle detail tabs + defects enrichment. The hook task should be first as the other two depend on it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-row cycle stats (progressive) | Browser/Client | — | Client-side `useQuery` per row, no server involvement |
| Tabbed layout on cycle detail | Browser/Client | — | Pure UI restructure using shadcn `<Tabs>` |
| Defects enrichment (Jira title/status) | Browser/Client | API/Backend (Jira) | Client calls `fetchJiraIssueByKey` per defect key; Jira DC is the data source |
| Credential loading hook | Browser/Client | — | Reads from Tauri Stronghold via `readSecret`; no network call |
| Run row navigation | Browser/Client | — | `useNavigate()` + `useBreadcrumbStore` push, no backend |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.1.0 | UI rendering | [VERIFIED: package.json] |
| @tanstack/react-query | ^5.90.21 | Server state, per-row queries | [VERIFIED: package.json] — already used throughout AIO pages |
| react-router-dom | ^7.13.1 | Navigation, `useNavigate`, `useParams`, `NavLink` | [VERIFIED: package.json] |
| @base-ui/react (via shadcn) | installed | Tab primitives (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) | [VERIFIED: components/ui/tabs.tsx] |
| zustand | installed | `useBreadcrumbStore` for breadcrumb push before navigate | [VERIFIED: breadcrumb.store.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/ui/skeleton` | installed | Loading placeholders on cycle rows, defect title cells | Per-row loading states |
| `@/components/ui/badge` | installed | Filter chip toggling (existing), status chips | Status display |
| `@/components/ui/empty-state` | installed | Empty Defects tab | Zero-data states |
| `@/lib/statusStyles` | local | `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass` | Status color classes |
| `@/hooks/useDelayedLoading` | local | 200ms skeleton flicker prevention | All AIO pages use it |

### No new installs required
All required components are already installed. [VERIFIED: 56-UI-SPEC.md Registry Safety section]

---

## Architecture Patterns

### System Architecture Diagram

```
User visits /aio-project/:projectKey
       │
       ▼
AioProjectOverviewPage
  ├─ useAioCredentials() ──────────────────► readSecret('jira-pat') [Stronghold]
  │    └─ { token, isLoading }
  ├─ useQuery(['aio', ..., 'cycles', key])─► fetchAioCycles()
  │    └─ renders cycle table rows
  └─ Per cycle row (N parallel):
       └─ useQuery(['aio', ..., 'runs', key, cycleKey])─► fetchAioTestRunsForCycle()
            ├─ pending: <Skeleton h-1.5 + h-3>
            └─ loaded: mini progress bar + counts text

User visits /aio-cycle/:projectKey/:cycleKey
       │
       ▼
AioCycleDetailPage
  ├─ useAioCredentials()
  ├─ useQuery cycle-detail ──────────────► fetchAioCycleDetail()
  ├─ useQuery runs (CACHE HIT if cycles page warmed it)
  │
  ├─ [Progress section — always visible above tabs]
  └─ <Tabs defaultValue="executions">
       ├─ <TabsContent value="executions">
       │    ├─ Filter chips toolbar
       │    └─ Run table (clickable rows → /run/:runId)
       │         └─ onClick: breadcrumbStore.push + navigate
       └─ <TabsContent value="defects">
            ├─ allDefects.length === 0 → <EmptyState>
            └─ Defect table (N rows):
                 └─ useQuery(['jira', ..., 'issue', defectKey]) ─► fetchJiraIssueByKey()
                      ├─ pending: <Skeleton h-4 w-32> in Title cell
                      └─ loaded: Key NavLink | Title | Status chip | Triggered By
```

### Recommended Project Structure
```
taskflow/src/
├── hooks/
│   ├── useAioCredentials.ts    # NEW — extracted credential hook
│   └── ...existing hooks
├── routes/dashboard/
│   ├── AioProjectOverviewPage.tsx  # EDIT — add per-row stats
│   ├── AioCycleDetailPage.tsx      # EDIT — add tabs + defects enrichment
│   └── AioCyclesSkeleton.tsx       # REVIEW — may need 4-column skeleton row
└── services/aio/
    └── types.ts                    # READ ONLY — AioCycle has no date field
```

### Pattern 1: useAioCredentials hook
**What:** Extracts the repeated `useState + useEffect + readSecret` pattern from three AIO pages into a single reusable hook.
**When to use:** Every AIO page/component that needs the PAT token.
**Example:**
```typescript
// Source: CONTEXT.md D-14 (exact implementation specified)
// taskflow/src/hooks/useAioCredentials.ts
import { useEffect, useState } from 'react';
import { readSecret } from '@/services/stronghold';

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

**Usage at call sites:**
```typescript
// Replaces the existing pattern in all 3 pages:
const { token, isLoading } = useAioCredentials();

// enabled guard must include !isLoading to prevent flash-fire with null token:
enabled: !!jiraBaseUrl && !!token && !isLoading
```

### Pattern 2: Progressive per-row stats query
**What:** Each cycle row fires its own `useQuery` after the cycle list renders. Uses the same query key as cycle detail, so cache is shared.
**When to use:** Cycles page only — do not block cycle list render on N parallel fetches.
**Example:**
```typescript
// Source: VERIFIED from AioCycleDetailPage.tsx runs query + types.ts
// Inline in AioProjectOverviewPage cycle row render, or extracted sub-component:

const runsQuery = useQuery<AioTestRun[]>({
  queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycle.key],
  queryFn: () => fetchAioTestRunsForCycle(jiraBaseUrl!, token!, projectKey!, cycle.key),
  enabled: !!jiraBaseUrl && !!token && !isLoading && !!projectKey,
});

const counts = (runsQuery.data ?? []).reduce(
  (acc, run) => { const norm = normalizeStatus(run.status); acc[norm]++; return acc; },
  { pass: 0, fail: 0, blocked: 0, notRun: 0 },
);
// Loading state: runsQuery.isLoading → show <Skeleton>
```

**The `normalizeStatus` function** can be imported from a shared location or copied verbatim from `AioCycleDetailPage.tsx`. If it stays in `AioCycleDetailPage.tsx`, the cycles page must duplicate it or extract it to a shared `lib/aioUtils.ts`. Planner decision.

### Pattern 3: Tabs layout on AioCycleDetailPage
**What:** Wrap existing content in shadcn `<Tabs>`. Progress section stays above the tab bar.
**When to use:** Reorganizing cycle detail into Executions + Defects tabs.
**Example:**
```typescript
// Source: VERIFIED from taskflow/src/components/ui/tabs.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Structure (existing progress section stays OUTSIDE TabsContent):
<Tabs defaultValue="executions" className="flex-1 flex flex-col">
  {/* Progress section — always visible */}
  <div className="px-6 py-4 border-b border-border">
    {/* ...existing progress bar JSX... */}
  </div>

  <TabsList className="mx-6 my-1.5">
    <TabsTrigger value="executions">Executions</TabsTrigger>
    <TabsTrigger value="defects">Defects</TabsTrigger>
  </TabsList>

  <TabsContent value="executions" className="flex-1 overflow-auto">
    {/* filter chips + run table */}
  </TabsContent>

  <TabsContent value="defects" className="flex-1 overflow-auto">
    {/* defect enrichment table or EmptyState */}
  </TabsContent>
</Tabs>
```

**Important:** The `TabsPrimitive.Root` (wrapped as `<Tabs>`) uses `data-slot="tabs"` and applies `flex flex-col` via the `data-horizontal` selector. The `flex-1 overflow-auto` on `<TabsContent>` is needed to maintain the page's scrollable layout.

### Pattern 4: Clickable run row (accessibility-correct)
**What:** `<tr>` with `onClick` + `useNavigate()` rather than `<NavLink>` on `<tr>` (invalid HTML). Use `role="button"` + `tabIndex={0}` for keyboard.
**When to use:** Executions tab run rows.
**Example:**
```typescript
// Source: CONTEXT.md D-09 + 56-UI-SPEC.md "Run row click" section
<tr
  key={run.id}
  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
  role="button"
  tabIndex={0}
  onClick={() => {
    useBreadcrumbStore.getState().push({ label: cycleName, path: currentPath });
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      useBreadcrumbStore.getState().push({ label: cycleName, path: currentPath });
      navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
    }
  }}
>
```

**`currentPath`:** `useLocation().pathname` from react-router-dom.

### Pattern 5: Defects tab enrichment
**What:** Each unique defect key fires one `useQuery` for Jira issue data. Loading state shows `<Skeleton>` in the title cell.
**When to use:** Defects tab content rendering.
**Example:**
```typescript
// Source: VERIFIED — fetchJiraIssueByKey exists at services/jira/issues.ts line 640
// JiraIssue shape: { key, fields: { summary: string, status: { name: string }, ... } }

// Per defect row (inline or sub-component):
const issueQuery = useQuery<JiraIssue | null>({
  queryKey: ['jira', jiraBaseUrl, 'issue', defectKey],
  queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectKey),
  enabled: !!jiraBaseUrl && !!token && !isLoading,
});

// Title cell:
{issueQuery.isLoading
  ? <Skeleton className="h-4 w-32" />
  : <span>{issueQuery.data?.fields.summary ?? defectKey}</span>
}

// Status chip:
{issueQuery.data && (
  <span className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold">
    {issueQuery.data.fields.status.name}
  </span>
)}
```

### Anti-Patterns to Avoid
- **`<NavLink>` on `<tr>`:** Invalid HTML. Use `onClick` + `role="button"` + `tabIndex={0}` pattern from Pattern 4.
- **Missing `!isLoading` in `enabled`:** Without this guard, `useQuery` fires once with `token === null` before Stronghold resolves, causing a brief auth-error flash visible to the user.
- **Blocking cycle list on run stats:** Do NOT await all N `fetchAioTestRunsForCycle` calls before rendering the cycle rows. Progressive loading per D-03.
- **Extracting `normalizeStatus` without checking both usages:** The function is defined inside `AioCycleDetailPage.tsx`. If the planner extracts it to a shared util, tests for both pages must still pass (the function is already tested indirectly via the counts assertions in `AioCycleDetailPage.test.tsx`).
- **Passing token as prop vs. calling `useAioCredentials()` in children:** D-16 defers to planner. Prefer prop-drilling from the parent page if the parent already has `useAioCredentials()` called — avoids N redundant Stronghold reads from child components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching UI | Custom tab state + conditional rendering | `<Tabs>` from `@/components/ui/tabs` | Already installed, keyboard accessible, ARIA compliant via @base-ui/react |
| Skeleton loading indicators | Custom shimmer CSS | `<Skeleton>` from `@/components/ui/skeleton` | Project standard, consistent style |
| Status badge colors | Custom color logic | `aioRunStatusBadgeClass` from `@/lib/statusStyles` | Already maps PASS/FAIL/BLOCKED/NOT_EXECUTED to correct Tailwind classes |
| Empty state UI | Custom "nothing here" JSX | `<EmptyState>` from `@/components/ui/empty-state` | Project standard with icon + title + subtitle props |
| Run stats reduction | New counting function | Copy/extract the exact `normalizeStatus + reduce` from `AioCycleDetailPage.tsx` | Identical business logic — don't diverge |

**Key insight:** Every component needed for this phase is already in the codebase. The planner's job is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: Token flash-fire (null token causes auth error)
**What goes wrong:** `useQuery` fires with `token === null` and `isLoading === true` simultaneously for one render tick, triggering an API call that returns 401.
**Why it happens:** The current inline pattern does not have an `isLoading` guard — it just checks `!!token`. The hook introduces `isLoading: true` as the initial state, and the `enabled` guard must block queries until `isLoading` becomes `false`.
**How to avoid:** Use `enabled: !!jiraBaseUrl && !!token && !isLoading` at every `useQuery` call site that uses `useAioCredentials()`. The `!isLoading` guard is the new addition.
**Warning signs:** Auth error flash visible in error state before data loads on first page visit.

### Pitfall 2: AioCyclesSkeleton does not reflect the new 4-column layout
**What goes wrong:** The existing `AioCyclesSkeleton` renders 5 `h-10 w-full` rows — a single flat skeleton per row with no column structure. After the redesign, each row has Key | Name | Status | Progress bar columns. The skeleton will appear disconnected from the real layout.
**Why it happens:** The skeleton was written for the 3-column layout.
**How to avoid:** Update `AioCyclesSkeleton` to reflect 4 columns (Key: w-20, Name: flex-1, Status: w-24, Progress: w-32) or keep the flat skeleton if the mismatch is acceptable. Planner decision on whether to update.
**Warning signs:** Layout jump between skeleton and loaded state.

### Pitfall 3: `normalizeStatus` duplication vs. extraction
**What goes wrong:** Cycles page needs `normalizeStatus` to compute per-row stats. The function currently lives inside `AioCycleDetailPage.tsx`. If the planner copies it inline to the cycles page, two copies exist and can diverge.
**Why it happens:** Function is module-scoped in the detail page, not exported.
**How to avoid:** Extract `normalizeStatus` to `taskflow/src/lib/aioUtils.ts` (or similar) in the same task that adds the cycles page stats. Import from both pages.
**Warning signs:** If PASS/FAIL counts disagree between the cycles page mini bar and the cycle detail full bar for the same cycle.

### Pitfall 4: Tabs `flex-1 overflow-auto` scroll conflict
**What goes wrong:** The `AioCycleDetailPage` uses `flex flex-col h-full` with a `flex-1 overflow-auto` wrapper div for the scrollable body. Wrapping the body in `<Tabs>` must preserve this structure or the page loses scroll.
**Why it happens:** `<Tabs>` (via `@base-ui/react`) applies `flex gap-2 data-horizontal:flex-col` to the root. Adding `flex-1 overflow-auto` to `TabsContent` is necessary to keep the scrollable region inside the tab.
**How to avoid:** Set `className="flex-1 overflow-auto"` on each `<TabsContent>`, and ensure the `<Tabs>` root has `className="flex-1 flex flex-col min-h-0"` so it participates in the page's flex layout.
**Warning signs:** Page body scrolls the entire window instead of the content area, or content is clipped.

### Pitfall 5: Defect query key collision with issue detail
**What goes wrong:** Using `['jira', jiraBaseUrl, 'issue', defectKey]` as the query key for `fetchJiraIssueByKey` in the Defects tab. If the issue detail page uses a different key shape for the same function, caches won't be shared.
**Why it happens:** No centralized query key registry.
**How to avoid:** Check how issue detail fetches Jira issues (the `fetchIssueDetail` function uses a broader field set). `fetchJiraIssueByKey` is a lightweight 5-field call and should have its own key prefix to avoid collision. Using `['jira-lightweight', jiraBaseUrl, 'issue', defectKey]` is safe.
**Warning signs:** Stale issue data in Defects tab when issue was updated and detail page was visited.

### Pitfall 6: `useAioCredentials` in child row components creates N Stronghold reads
**What goes wrong:** If per-row defect components call `useAioCredentials()` independently (per D-16's option), and each row is a separate component, each row triggers a `readSecret('jira-pat')` call.
**Why it happens:** Stronghold reads are async but not shared across hooks by default.
**How to avoid:** Call `useAioCredentials()` once at the page component level and pass `token` + `isLoading` as props to row components (prop-drilling). This is the planner's discretion per D-16.
**Warning signs:** N Stronghold calls visible in dev logs when defects tab has many rows.

---

## Code Examples

### Verified: `fetchJiraIssueByKey` return shape
```typescript
// Source: VERIFIED — taskflow/src/services/jira/issues.ts line 640-670
// Returns: Promise<JiraIssue | null>
// JiraIssue.fields.summary: string       ← use for Defects tab "Title" column
// JiraIssue.fields.status.name: string   ← use for Defects tab "Status" chip
// Returns null on any error (404, auth, network) — show defectKey fallback
```

### Verified: AioCycle type has no date field
```typescript
// Source: VERIFIED — taskflow/src/services/aio/types.ts
export interface AioCycle {
  key: string;
  name: string;
  status: string;
  projectKey: string;
  // No date fields — confirmed. D-02 is safe: no date column needed.
}
```

### Verified: `fetchAioTestRunsForCycle` is the correct call for per-row stats
```typescript
// Source: VERIFIED — taskflow/src/services/aio/issue-runs.ts
// Signature: fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey): Promise<AioTestRun[]>
// Already paginated (handles isLast). Returns [] on 404 (cycle has no runs).
// No lighter "count-only" endpoint exists on this AIO instance — full run fetch required.
// D-04 confirmed: use fetchAioTestRunsForCycle for stats computation.
```

### Verified: Tabs API (shadcn wrapper over @base-ui/react)
```typescript
// Source: VERIFIED — taskflow/src/components/ui/tabs.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Props:
// Tabs: { defaultValue: string; className?: string; orientation?: 'horizontal'|'vertical' }
// TabsList: { variant?: 'default'|'line'; className?: string }
// TabsTrigger: { value: string; className?: string }
// TabsContent: { value: string; className?: string }
```

### Verified: BreadcrumbStore push before navigate
```typescript
// Source: VERIFIED — taskflow/src/stores/breadcrumb.store.ts
// Pattern confirmed in AioCycleDetailPage.tsx and AioTestRunDetailPage.tsx

useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
```

### Verified: Route path for run detail
```typescript
// Source: VERIFIED — taskflow/src/routes/routes.tsx line 54
// path: '/aio-cycle/:projectKey/:cycleKey/run/:runId'
// Params: { projectKey, cycleKey, runId } (confirmed from AioTestRunDetailPage.tsx)
// run.id is the AioTestRun.id (string) used as runId param
```

### Verified: Existing tests mock pattern (for new test parity)
```typescript
// Source: VERIFIED — AioProjectOverviewPage.test.tsx + AioCycleDetailPage.test.tsx
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));
// After extracting useAioCredentials, tests should mock the hook instead:
vi.mock('@/hooks/useAioCredentials', () => ({
  useAioCredentials: () => ({ token: 'test-jira-token', isLoading: false }),
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `useEffect + readSecret` per page | `useAioCredentials()` shared hook | Phase 56 | 3 files simplified; single place to fix Stronghold credential bugs |
| Defects section = plain key list at bottom of page | Defects tab = enriched table with title/status/triggered-by | Phase 56 | AIOC-03 fully satisfied |
| Run table = flat list, no navigation | Run rows clickable → `AioTestRunDetailPage` | Phase 56 | Executions tab promotes discoverability of test run detail |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No lighter "count-only" endpoint exists on this AIO instance | Don't Hand-Roll, Code Examples | If a count endpoint exists, per-row stats could be faster; but the current approach works correctly |
| A2 | `AioTestRun.id` (string) is the correct value to pass as `runId` in the run detail URL | Pattern 4 | Run detail page would 404; should be verified at execution time |

---

## Open Questions

1. **`normalizeStatus` extraction vs. duplication**
   - What we know: Function exists in `AioCycleDetailPage.tsx`, not exported. Cycles page needs the same logic.
   - What's unclear: Whether the planner prefers extracting to `lib/aioUtils.ts` or duplicating inline.
   - Recommendation: Extract to shared util — two copies that can diverge is a maintenance risk.

2. **`AioCyclesSkeleton` 4-column update**
   - What we know: Current skeleton renders 5 `h-10 w-full` rows with no column structure.
   - What's unclear: Whether visual mismatch is acceptable or the skeleton should be updated.
   - Recommendation: Planner updates the skeleton to roughly match the 4-column layout to avoid layout jump.

3. **Defect query key prefix for `fetchJiraIssueByKey`**
   - What we know: No existing query key standard for lightweight issue fetches.
   - Recommendation: Use `['jira', jiraBaseUrl, 'issue-lightweight', defectKey]` to avoid collisions with `fetchIssueDetail` results.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 56 is a pure code/config change with no external tool dependencies beyond the existing Tauri + Vite development environment.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `taskflow/vite.config.ts` (vitest inline config) |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AION-03 | Cycles page renders per-row stats with skeleton + counts | unit | `cd taskflow && npm test -- AioProjectOverviewPage` | ✅ exists (needs new test cases) |
| AION-03 | Stats counts match normalizeStatus reduction | unit | `cd taskflow && npm test -- AioProjectOverviewPage` | ❌ Wave 0 gap |
| AIOC-03 | Defects tab renders enriched defect rows | unit | `cd taskflow && npm test -- AioCycleDetailPage` | ❌ Wave 0 gap |
| AIOC-03 | Defects tab shows EmptyState when no defects | unit | `cd taskflow && npm test -- AioCycleDetailPage` | ❌ Wave 0 gap |
| D-14/D-15 | `useAioCredentials` returns token + isLoading=false after readSecret resolves | unit | `cd taskflow && npm test -- useAioCredentials` | ❌ Wave 0 new file |
| D-08 | Executions tab run row click navigates to run detail | unit | `cd taskflow && npm test -- AioCycleDetailPage` | ❌ Wave 0 gap |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test -- --reporter=dot` (fast, confirms no regressions)
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `AioProjectOverviewPage.test.tsx` — per-row stats skeleton + loaded counts (AION-03)
- [ ] New test cases in `AioCycleDetailPage.test.tsx` — Executions tab structure, run row click navigation, Defects tab enrichment, Defects tab empty state (AIOC-03, D-08)
- [ ] New file `taskflow/src/hooks/useAioCredentials.test.ts` — token loading, isLoading flag transition, readSecret error path (D-14)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes — Stronghold PAT pattern unchanged |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | Read-only AIO integration, no write paths |
| V5 Input Validation | yes | Defect keys from AIO API (trusted source); passed to `fetchJiraIssueByKey` as URL path segment. Existing `encodeURIComponent` in apiFetch handles encoding. |
| V6 Cryptography | no | Token stored in Tauri Stronghold — no new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Defect key path injection | Tampering | `fetchJiraIssueByKey` passes key via URL path — `apiFetch` handles encoding [VERIFIED: jira/issues.ts] |
| Token exposure in query keys | Information Disclosure | Token NOT in query keys (confirmed: `['aio', jiraBaseUrl, ...]` never includes token) [VERIFIED: existing pattern] |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx] — current page implementation, inline credential pattern
- [VERIFIED: taskflow/src/routes/dashboard/AioCycleDetailPage.tsx] — normalizeStatus, counts reduction, progress bar, filter chips, existing defects section, breadcrumb pattern
- [VERIFIED: taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx] — run detail page params: `{ projectKey, cycleKey, runId }`
- [VERIFIED: taskflow/src/services/aio/types.ts] — AioCycle (no date field), AioTestRun shape
- [VERIFIED: taskflow/src/services/aio/issue-runs.ts] — fetchAioTestRunsForCycle signature + pagination behavior
- [VERIFIED: taskflow/src/services/jira/issues.ts] — fetchJiraIssueByKey signature and return shape (JiraIssue | null)
- [VERIFIED: taskflow/src/services/jira.ts] — fetchJiraIssueByKey re-exported from barrel
- [VERIFIED: taskflow/src/components/ui/tabs.tsx] — Tabs API (Tabs, TabsList, TabsTrigger, TabsContent + props)
- [VERIFIED: taskflow/src/stores/breadcrumb.store.ts] — push/pop API, TrailEntry shape
- [VERIFIED: taskflow/src/routes/routes.tsx] — `/aio-cycle/:projectKey/:cycleKey/run/:runId` route
- [VERIFIED: taskflow/src/hooks/useDelayedLoading.ts] — signature and behavior
- [VERIFIED: taskflow/src/services/jira/types.ts] — JiraIssue.fields.summary + fields.status.name confirmed
- [VERIFIED: .planning/config.json] — nyquist_validation: true (Validation Architecture section required)
- [CITED: 56-CONTEXT.md] — all locked decisions D-01 through D-16
- [CITED: 56-UI-SPEC.md] — visual specs, spacing, component inventory

### Secondary (MEDIUM confidence)
- [VERIFIED: AioProjectOverviewPage.test.tsx + AioCycleDetailPage.test.tsx] — existing test patterns for mock setup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json
- Architecture: HIGH — all patterns verified from existing source files
- Pitfalls: HIGH — derived from direct code inspection, not training data
- Test requirements: HIGH — existing test files read; gaps identified from feature requirements

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable stack — React 19, TanStack Query v5, react-router v7)
