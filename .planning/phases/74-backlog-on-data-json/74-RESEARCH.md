# Phase 74: Backlog on `data.json` - Research

**Researched:** 2026-05-29
**Domain:** GreenHopper data-layer migration for `BacklogPage.tsx` (data fetch + cache + mutation invalidation rewrite)
**Confidence:** HIGH (all critical claims verified against in-repo fixture + Phase 71/72/73 shipped code)

## Summary

Phase 74 is a **mechanical port of the Phase 73 pattern** (`useGhAllData` / `getGhAllData` / `invalidateGhAllData`) to the backlog surface, replacing three React Query queries in `BacklogPage.tsx` (`jira-sprint-list`, `jira-backlog-sprint-stories`, `jira-backlog-issues`) with one `useGhBacklogData(boardId)` query against the existing Phase 71 `fetchBacklogData` fetcher. The single load-bearing piece of new research is the **`GhBacklogResponse` widening (D-04a)** — `types.ts:160-166` declares `{ issues: GhIssue[] }` with a misleading comment claiming "does NOT carry entity maps", but the real fixture (`__fixtures__/data.real.json`, 8198 lines) demonstrably carries `entityData`, `sprints[]` with `issuesIds[]`, `rankCustomFieldId`, `projects`, `versionData`, `canManageSprints`, `canCreateIssue`, `cardColorStrategy`, `emptyFilterBoard`, `supportsPages`, `hasBulkChangePermission`, `issueArchivingEnabled`. Every architectural decision — adapter pass, sprint membership reverse-index, mutation invalidation key swap, Sidebar prefetch collapse, legacy fetcher deletion — was either locked in CONTEXT.md or has a one-to-one Phase 73 precedent.

**Primary recommendation:** Mirror `useGhAllData.ts` exactly for `useGhBacklogData.ts`. Differences are limited to: (1) no `refetchInterval` (backlog isn't polled — confirmed by reading existing BacklogPage queries which use `staleTime: STALE_TIME_MS` with no `refetchInterval`); (2) the route check is `/backlog` instead of `/sprint-board`; (3) the fetcher and response type are `fetchBacklogData` / `GhBacklogResponse`. Widen `GhBacklogResponse` from the fixture before the hook lands, otherwise the adapter call site cannot type-resolve `data.entityData` and `data.sprints[]`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-BACKLOG-01 | Backlog view fetches the flat issue list via a **single `data.json` call** (replaces paginated REST + per-issue lookups). | The fixture proves a single `data.json` response carries everything BacklogPage needs (issues, sprints with membership, entityData for status/type/epic/priority resolution, rankCustomFieldId for ordering). Net request count: 3→1 for the page; 3→1 for Sidebar prefetch. Verifiable via network-log invariant (Validation Architecture below). |
| GH-BACKLOG-02 | Existing backlog features (move-to-sprint, create story, filter by epic/label/assignee, virtualized rendering) work **unchanged** on the new data source. | Move-to-sprint / create story / rank: stay REST per D-06 (Phase 72 D-08 precedent). Filter by epic: works via `entityData.epics` resolution in the adapter. Filter by assignee: works via synthesized `fields.assignee` (D-05). Filter by label: **degraded** — `GhIssue` has no `labels[]`; D-05a hides the chip. Virtualized rendering: BacklogPage's `useVirtualizer` is data-source-agnostic. |
| GH-CUT-01 | Hard cutover per surface; no coexistence flag. | Delete `fetchBacklogIssues`, `fetchBacklogSprintStories`, and `fetchBacklogView` from `services/jira/backlog.ts` + `services/jira.ts` re-exports. `fetchBacklogView` has **zero non-test callers** in current code (grep confirmed) — safe to delete. |
| GH-CUT-02 | Performance verification recorded in the final phase's verification artifact (Phase 75), not here. | Phase 74 only ships the network-log invariant (1 `data.json` request, 0 legacy backlog REST). Full perf delta captured at milestone close. |
</phase_requirements>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full page rewrite onto `data.json`. One `useGhBacklogData(boardId)` call replaces all three current queries. Sprint sections from `data.sprints[]`; backlog = issues not in any `sprints[i].issuesIds[]`.
- **D-01a:** Sprint ordering follows `data.sprints[]` array order. Filter to `state === 'ACTIVE' | 'FUTURE'` for display.
- **D-02:** React Query holds the cache. `queryKey: ['gh-backlog', boardId]`, `staleTime: STALE_TIME_MS`, `enabled: isActive && !!boardId && !!baseUrl && !!token`. **No `refetchInterval`** (backlog is opened-on-demand).
- **D-03:** Three exports: `useGhBacklogData(boardId)`, `getGhBacklogData(qc, baseUrl, token, boardId)` (uses `ensureQueryData`), `invalidateGhBacklogData(qc, boardId?)`.
- **D-04:** Entity maps come from the same `data.json` payload (`data.entityData.{statuses,priorities,types,epics}`).
- **D-04a:** `GhBacklogResponse` type widening required — derive from `__fixtures__/data.real.json`. The current type at `types.ts:160-166` is wrong.
- **D-04b:** Sprint membership via `data.sprints[i].issuesIds: number[]` — build reverse index `issueId → sprintId` in adapter pass; synthesize `fields.sprint = { id }` per issue.
- **D-05:** Adapter synthesizes assignee, story points, status, type, epic, priority. Reuse Phase 71 `adaptIssue`.
- **D-05a:** Drop label filter chip (no `labels[]` on `GhIssue`).
- **D-05b:** Drop subtask count chip on backlog rows (no `subtasks[]`).
- **D-05c:** Drop `flagged` indicator on backlog rows (no flagged field on `GhIssue`).
- **D-06:** Mutations stay REST. Only cache invalidation keys change.
- **D-06a:** Optimistic updates ported onto `['gh-backlog', boardId]` — mutate `data.issues[]` + `data.sprints[i].issuesIds[]`.
- **D-07:** "Reload backlog" toolbar action invalidates `['gh-backlog', boardId]` + `['jira-epics-basic', projectKey]` + `['jira-statuses']`.
- **D-07a:** Remove per-section `refetchBacklog` / `refetchStories` callbacks.
- **D-07b:** Reuse `STALE_TIME_MS = 30s` from `lib/query-constants.ts`.
- **D-08:** Sidebar prefetch collapses 3→1: `getGhBacklogData(boardId)`.
- **D-08a:** Skip prefetch if `boardId` not yet known.
- **D-09:** Delete `fetchBacklogIssues`, `fetchBacklogSprintStories`, `fetchBacklogView` + their `jira.ts` re-exports + query keys `['jira-backlog-issues', ...]` / `['jira-backlog-sprint-stories', ...]`.
- **D-09a:** Keep `fetchSprintList` (`FieldsSection.tsx` still uses it), `fetchProjectStatuses`, `fetchEpicsBasic`.
- **D-09b:** All three new symbols re-exported through `src/services/jira.ts` (memory `[[project_jira_ts_dual_file]]`).

### Claude's Discretion
- Hook returns raw envelope vs. derived shape (`{ backlog, sprints, entityMaps }`). Default: raw envelope (parity with Phase 73 `useGhAllData`).
- Extract `useReloadBacklog` shared hook vs. inline `invalidateQueries` in handler.
- Extend Phase 71 adapter vs. backlog-specific variant. Default: reuse Phase 71 — `GhIssue` is a strict subset of `GhBoardIssue` minus `timeInColumn`.
- Show closed sprints as collapsed section. Default: keep current behavior (hidden).
- "Reload backlog" toolbar placement — mirror SprintBoardTab from Phase 73.
- Drop `flagged` from backlog rows in this phase, or chase via secondary REST query.

### Deferred Ideas (OUT OF SCOPE)
- Label filtering on backlog (D-05a accepted loss).
- Subtask chips on backlog cards.
- `flagged` indicator on backlog rows.
- GH-side mutation endpoints (move-to-sprint, rank, create).
- Caching `details.json` (Phase 75).
- Performance verification (final phase per GH-CUT-02).
- Closed/completed sprint section.
- `useReloadBacklog` shared hook unless second consumer emerges.
- Issue-detail sprint picker swap (Phase 75 scope).
- `fetchBacklogView` deletion contingent on zero callers — **CONFIRMED zero callers** (grep run during research; only test file references it; `epics.ts:84` mentions it in a comment but doesn't import).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Backlog payload fetch | Service layer (`services/jira/greenhopper/data.ts`) | — | Already shipped Phase 71. No tier change. |
| React Query cache + hook | Service layer (`services/jira/greenhopper/useGhBacklogData.ts`) | — | Mirrors `useGhAllData.ts`. Hook is a thin React adapter over the service fetcher + QueryClient. |
| Public re-export | Service barrel (`services/jira.ts`) | — | Dual-file rule: all 60 imports use `jira.ts`. |
| Adapter (`GhIssue → JiraIssue`) | Service layer (`services/jira/greenhopper/adapter.ts`) | Route component (call-site `useMemo`) | Phase 71 adapter is pure + reused. Call site memoizes over `data.issues` + `data.entityData`. |
| Sprint membership reverse-index | Route component (`useMemo` in BacklogPage) | — | Cheap derivation from `data.sprints[]`; lives at the call site so the cache stays a 1:1 echo of the API. |
| Mutations (move/create/rank) | Service layer (existing REST modules) | — | Unchanged surface; only invalidation keys swap. |
| Cache invalidation on mutation | Route component (BacklogPage handlers) | — | Calls `invalidateGhBacklogData(qc, boardId)`. |
| Prefetch warm | UI layer (`Sidebar.tsx`) | — | Already the established Phase 73 pattern; one call to `getGhBacklogData`. |
| "Reload backlog" toolbar | Route component (BacklogPage toolbar) | — | Inline handler invalidates three keys + refetch. |

## Standard Stack

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 | Cache + hook + invalidation | Already in use; Phase 73 hook uses identical surface (`useQuery`, `ensureQueryData`, `invalidateQueries`) `[VERIFIED: package.json]`. |
| `@tanstack/react-virtual` | ^3.13.23 | Virtualized backlog rows | Already in use in BacklogPage; no change `[VERIFIED: package.json]`. |
| `react` | ^19.1.0 | Hook host | `[VERIFIED: package.json]`. |
| `lucide-react` | (existing) | `RefreshCw` icon for Reload button | UI-SPEC mandates Lucide; matches Phase 73. |

### Supporting
| Module | Path | Purpose |
|--------|------|---------|
| `fetchBacklogData` | `services/jira/greenhopper/data.ts` | Phase 71 fetcher — REUSE, do not duplicate. |
| `adaptIssue` / `createAdapter` | `services/jira/greenhopper/adapter.ts` | Phase 71 adapter — REUSE for `GhIssue → JiraIssue`. |
| `resolveStatus` / `resolveType` (and others as needed) | `services/jira/greenhopper/entityMaps.ts` | Already consumed by `adaptIssue`. |
| `warnOnce` | `services/jira/greenhopper/warnOnce.ts` | Adapter uses on entity-map miss; no change. |
| `useIsActiveRoute` | `hooks/useIsActiveRoute.ts` | Hook reads `/backlog` route guard. |
| `useAuthStore` + `readSecret('jira-pat')` | Existing | Token bootstrap pattern — copy verbatim from `useGhAllData.ts:44-63`. |
| `STALE_TIME_MS` | `lib/query-constants.ts` | 30s; reuse, do not modify (D-07b). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw envelope + call-site `useMemo` | Hook returns derived `{ backlog, sprints, entityMaps }` | Lower verbosity at call site, but breaks parity with Phase 73 and forces the hook to know view-shape. Stick with default. |
| Inline invalidation in toolbar handler | `useReloadBacklog(boardId, projectKey)` shared hook | Premature abstraction; defer until a second consumer appears (deferred idea). |

**Installation:** None — every dependency is already installed.

**Version verification:**
```
@tanstack/react-query ^5.90.21        [VERIFIED: package.json]
@tanstack/react-virtual ^3.13.23      [VERIFIED: package.json]
react ^19.1.0                         [VERIFIED: package.json]
```
No new npm installs in this phase. **Skipping** the Package Legitimacy Audit section.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────┐
                     │       Sidebar (mount/hover)         │
                     │  prefetch: getGhBacklogData(boardId)│
                     └──────────────┬──────────────────────┘
                                    │ warm cache
                                    ▼
   ┌───────────────────┐    ┌────────────────────────────┐
   │  /backlog route   │───▶│  useGhBacklogData(boardId) │
   │  BacklogPage.tsx  │    │  cacheKey: ['gh-backlog',  │
   │                   │    │             boardId]       │
   └───────┬───────────┘    │  staleTime: 30s            │
           │                │  no refetchInterval        │
           │                └──────────────┬─────────────┘
           │                               │ fetchBacklogData(baseUrl,token,boardId)
           │                               ▼
           │                ┌──────────────────────────────────────────┐
           │                │ GET /rest/greenhopper/1.0/xboard/plan/   │
           │                │     backlog/data.json?rapidViewId=...    │
           │                │ → GhBacklogResponse (widened) carrying:  │
           │                │   issues[], sprints[] (issuesIds[]),     │
           │                │   entityData, rankCustomFieldId,         │
           │                │   projects, versionData, can*, …         │
           │                └──────────────────────────────────────────┘
           │
           ▼ useMemo
   ┌────────────────────────────────────────────────────────────────┐
   │ Derivations at the call site:                                  │
   │  1. issueIdToSprintId = Map from data.sprints[].issuesIds[]    │
   │  2. adapted = data.issues.map(adaptIssue(_, entityMaps, spk))  │
   │     - synthesizes fields.sprint = { id } via reverse-index     │
   │  3. backlogIssues   = adapted.filter(no sprint)                │
   │  4. sprintSections  = data.sprints                             │
   │       .filter(s => s.state === 'ACTIVE' || 'FUTURE')           │
   │       .map(s => ({ sprint: s, issues: adapted in s }))         │
   │  5. filterDropdownOptions for epic + assignee (no label)       │
   └────────────────────────────────────────────────────────────────┘
                       │
                       ▼ rendered by
   ┌────────────────────────────────────────────────────────────────┐
   │ BacklogPage UI:                                                │
   │  - Toolbar: "Reload backlog" (RefreshCw) + filter chips        │
   │  - Sticky active sprint section                                │
   │  - Future sprint sections (one per sprint, empty allowed)      │
   │  - Backlog section (virtualized)                               │
   │  - Context-menu: move-to-sprint / move-to-backlog              │
   └────────────────────────────────────────────────────────────────┘
                       │
                       ▼ user action (REST mutation)
   ┌────────────────────────────────────────────────────────────────┐
   │ addIssuesToSprint / moveIssuesToBacklog / createStory / rank   │
   │   → REST POST (unchanged)                                      │
   │   → optimistic update on ['gh-backlog', boardId]               │
   │   → on settle: invalidateGhBacklogData(qc, boardId)            │
   └────────────────────────────────────────────────────────────────┘
```

### Recommended File Layout (additions only)
```
src/services/jira/greenhopper/
├── useGhBacklogData.ts            # NEW — hook + getGhBacklogData + invalidateGhBacklogData
├── useGhBacklogData.test.ts       # NEW — mirrors useGhAllData.test.ts
├── types.ts                       # MODIFY — widen GhBacklogResponse (D-04a)
└── index.ts                       # MODIFY — add `export * from './useGhBacklogData';`

src/services/jira.ts               # MODIFY — add 3 re-exports; delete 3 legacy fetcher re-exports + BacklogViewData
src/services/jira/backlog.ts       # MODIFY — delete fetchBacklogIssues / fetchBacklogSprintStories; KEEP fetchSprintList
src/routes/dashboard/BacklogPage.tsx  # REWRITE data layer (lines ~217-347, 595-806)
src/components/app/Sidebar.tsx     # MODIFY lines 39-41 (imports), 180-245 (collapse 3 prefetches → 1)
```

### Pattern 1: Hook + imperative twin + invalidator (Phase 73 mirror)
**What:** Three sibling exports keyed on `['gh-backlog', boardId]`. Hook for components, `ensureQueryData` twin for prefetch, invalidator for mutations.
**Source:** `services/jira/greenhopper/useGhAllData.ts` (verbatim model).
**Example (sketch):**
```typescript
// useGhBacklogData.ts
export function useGhBacklogData(boardId: number | null): UseQueryResult<GhBacklogResponse> {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    readSecret('jira-pat').then(t => !cancelled && setToken(t)).catch(() => !cancelled && setToken(null));
    return () => { cancelled = true; };
  }, [jiraBaseUrl]);
  const isActive = useIsActiveRoute('/backlog');
  return useQuery<GhBacklogResponse>({
    queryKey: ['gh-backlog', boardId],
    queryFn: () => fetchBacklogData(jiraBaseUrl as string, token as string, boardId as number),
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!boardId && !!jiraBaseUrl && !!token,
    // NO refetchInterval — backlog is opened-on-demand (matches current BacklogPage behavior).
  });
}

export async function getGhBacklogData(qc, baseUrl, token, boardId): Promise<GhBacklogResponse> {
  return qc.ensureQueryData({
    queryKey: ['gh-backlog', boardId],
    queryFn: () => fetchBacklogData(baseUrl, token, boardId),
    staleTime: STALE_TIME_MS,
  });
}

export function invalidateGhBacklogData(qc: QueryClient, boardId?: number): void {
  if (boardId === undefined) qc.invalidateQueries({ queryKey: ['gh-backlog'] });
  else qc.invalidateQueries({ queryKey: ['gh-backlog', boardId] });
}
```

### Pattern 2: Sprint membership reverse-index
**What:** `GhIssue` has no `sprintId`/`sprint` field. Build `Map<issueId, sprintId>` from `data.sprints[i].issuesIds[]`. Attach `fields.sprint = { id }` during adapter mapping so downstream grouping logic (which expects Agile-shaped `fields.sprint`) works unchanged.
**Example:**
```typescript
const issueIdToSprintId = useMemo(() => {
  const m = new Map<number, number>();
  for (const s of data?.sprints ?? []) {
    for (const id of s.issuesIds) m.set(id, s.id);
  }
  return m;
}, [data?.sprints]);

const adapted = useMemo<JiraIssue[]>(() => {
  if (!data) return [];
  const entityMaps = data.entityData; // already the EntityMaps shape
  return data.issues.map(gh => {
    const base = adaptIssue(gh, entityMaps, storyPointsFieldKey);
    const sprintId = issueIdToSprintId.get(gh.id);
    return sprintId !== undefined
      ? { ...base, fields: { ...base.fields, sprint: { id: sprintId } } as JiraIssue['fields'] }
      : base;
  });
}, [data, issueIdToSprintId, storyPointsFieldKey]);
```

### Pattern 3: Optimistic update on the new single cache
**What:** D-06a — optimistic update mutates `data.issues[]` + `data.sprints[i].issuesIds[]` inside a single cached `GhBacklogResponse` instead of two separate caches.
**Example:**
```typescript
queryClient.setQueryData<GhBacklogResponse>(['gh-backlog', boardId], (old) => {
  if (!old) return old;
  return {
    ...old,
    sprints: old.sprints.map(s =>
      s.id === sprintId
        ? { ...s, issuesIds: [...s.issuesIds, Number(issueId)] }
        : { ...s, issuesIds: s.issuesIds.filter(id => id !== Number(issueId)) }
    ),
  };
});
```

### Anti-Patterns to Avoid
- **Trusting `GREENHOPPER-API.md §"data.json"`** — that doc is INCOMPLETE. Always trust `__fixtures__/data.real.json`.
- **Importing from `@/services/jira/greenhopper` directly in BacklogPage / Sidebar** — must go through `@/services/jira` (`[[project_jira_ts_dual_file]]`).
- **Deleting `fetchSprintList`** — `FieldsSection.tsx:32,153` still depends on it. Keep.
- **Adding `refetchInterval`** — backlog is not polled today. D-02 explicit.
- **Building a separate `useBacklogEntityMaps` hook** — entity maps come from the same payload. No second query.
- **Two query keys for the same payload** — one `['gh-backlog', boardId]` only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache freshness / dedup | Custom `useState` + `useEffect` data fetch | React Query `useQuery` with shared `queryClient` | Phase 73 precedent; dedup + invalidation already work. |
| Imperative prefetch | `void fetchBacklogData(...)` orphan call | `qc.ensureQueryData({ queryKey, queryFn, staleTime })` | Warmed cache key must match what the hook reads, or the prefetch is wasted (Phase 73 D-08). |
| Entity-map building | Re-deriving from `data.entityData` shape | Existing `EntityMaps` type (alias of `data.entityData`) + `resolveStatus`/`resolveType` | Phase 71 already covers this; `data.entityData` is structurally compatible. |
| `GhIssue → JiraIssue` mapping | Backlog-specific adapter | `adaptIssue` (Phase 71) | Identical shape; `GhIssue` is `GhBoardIssue` minus `timeInColumn`. |
| Sprint reverse-index | Per-issue scan of `data.sprints` | One `Map<issueId, sprintId>` built in `useMemo` over `data.sprints` | O(n+m) once vs. O(n·m) per render. |
| Type for `GhBacklogResponse` | Hand-writing every nested field by inspection | Derive from the fixture (TS literal + `typeof JSON.parse(...)` in a type test) | Avoids drift; the fixture is the contract. |

**Key insight:** Phase 73 already solved 80% of this problem. Phase 74 is a port, not a redesign.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no IndexedDB / localStorage keys reference `jira-backlog-issues` / `jira-backlog-sprint-stories` / `jira-sprint-list` (React Query cache is in-memory only). | None. |
| Live service config | None — no n8n / Datadog / external service has `jira-backlog-*` query keys baked in. | None. |
| OS-registered state | None — no scheduled jobs / launchd / pm2 references these query keys. | None. |
| Secrets / env vars | `jira-pat` (Stronghold secret name) — unchanged. No env var rename. | None. |
| Build artifacts | None — no compiled output names tied to the deleted symbols. Biome will catch unused-import errors after deletion (auto-fixable). | Run `npm run lint` after deletion; rebuild dev server. |

**Why this is a "nothing found" case:** The deleted symbols are React Query keys + module exports — all live in memory or source code. No external system caches them.

## Common Pitfalls

### Pitfall 1: Importing from `@/services/jira/greenhopper` in route components
**What goes wrong:** Half the codebase reads from `@/services/jira` (60 imports), the other half from the modular path. Mixed imports cause re-render mismatches when the dual file diverges.
**Why it happens:** Convenient to import from the deeper path while editing greenhopper modules.
**How to avoid:** All three new symbols re-exported from `services/jira.ts` (D-09b). Route components and Sidebar import from `@/services/jira` only. Adapter / entityMaps tests can still import the deeper path.
**Warning signs:** ESLint/Biome doesn't catch this — code review must. Memory `[[project_jira_ts_dual_file]]` is the canonical reference.

### Pitfall 2: `GhBacklogResponse` widening missed before the hook lands
**What goes wrong:** `data.entityData` and `data.sprints[i].issuesIds` won't type-resolve at the call site; TypeScript compile fails or `as any` casts proliferate.
**Why it happens:** `types.ts:160-166` declares `{ issues: GhIssue[] }` only; the comment "does NOT carry entity maps" is wrong but reads authoritative.
**How to avoid:** Widen `GhBacklogResponse` in the FIRST task of the wave, before any hook code is written. Sprint/issue/version shapes can be lifted from `data.real.json`. Reuse `GhAllDataResponse['entityData']` for the `entityData` field (same shape).
**Warning signs:** Adapter call site has `as any` or `// @ts-expect-error` near `data.entityData`.

### Pitfall 3: `fetchBacklogView` re-export deletion breaks `BacklogViewData` consumers
**What goes wrong:** `services/jira.ts:2149` declares `BacklogViewData`. If any non-route consumer imports it, deletion breaks them.
**Why it happens:** Easy to delete the function without searching for the interface.
**How to avoid:** Grep run during research: `BacklogViewData` is imported in exactly one place — `services/jira/backlog.ts:8` (where the legacy `fetchBacklogView` lives). **Safe to delete both** (function + interface, in both `jira.ts` and `backlog.ts`). Planner should re-grep before final delete to catch any new consumers added after this research.
**Warning signs:** `tsc --noEmit` fails after delete.

### Pitfall 4: Sidebar prefetch races boardId discovery
**What goes wrong:** If `getGhBacklogData(boardId)` is called before `boardId` is known, the cache key is `['gh-backlog', null]` — never read by the page.
**Why it happens:** Sidebar mounts before `useBoardId` resolves.
**How to avoid:** D-08a — skip prefetch when `boardId == null`. Mirror the existing `boardId ?? return` guard in Sidebar.

### Pitfall 5: Optimistic update writes to the old cache key
**What goes wrong:** Mutation handlers still call `setQueryData(['jira-backlog-issues', ...], ...)` after the rewrite, silently writing to a dead cache.
**Why it happens:** BacklogPage.tsx has ~10 separate `setQueryData` / `invalidateQueries` calls with the long composite key; mechanical search-replace can miss occurrences.
**How to avoid:** Delete ALL references to `['jira-backlog-issues'` and `['jira-backlog-sprint-stories'` and `['jira-sprint-list'` (constrained to BacklogPage.tsx). Replace optimistic updates with the single-cache pattern (Pattern 3 above). Audit with `grep -n "jira-backlog-issues\|jira-backlog-sprint-stories\|jira-sprint-list" BacklogPage.tsx` — should return zero hits after the rewrite.

### Pitfall 6: Story-points field key not threaded into the adapter pass
**What goes wrong:** `adaptIssue` returns `customfield_10016: null` for every issue if `storyPointsFieldKey` doesn't match `gh.estimateStatistic.statFieldId`.
**Why it happens:** Phase 71 D-02 — the gate is exact-match. The fixture uses `"customfield_10106"`; the project may use a different key per project's settings.
**How to avoid:** Use `useSettingsStore().storyPointsFieldKey` as today. Validate in QA that story-point chips render.

## Code Examples

### Widening `GhBacklogResponse` (from fixture)
```typescript
// types.ts — D-04a widening
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
  entityData: GhAllDataResponse['entityData']; // same shape — REUSE
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
Source: `__fixtures__/data.real.json` lines 6674-8197.

### Type test loading the real fixture
```typescript
// types.test.ts (new) — pins the shape to the fixture
import fixture from './__fixtures__/data.real.json';
import type { GhBacklogResponse } from './types';

it('GhBacklogResponse is structurally compatible with the real fixture', () => {
  const _typed: GhBacklogResponse = fixture as unknown as GhBacklogResponse;
  expect(_typed.entityData.statuses).toBeDefined();
  expect(_typed.sprints.every(s => Array.isArray(s.issuesIds))).toBe(true);
  expect(typeof _typed.rankCustomFieldId).toBe('number');
});
```

### Network-log invariant test (UAT)
```typescript
// e2e or manual: open /backlog, clear network panel, reload
// Assert exactly 1 GET to /rest/greenhopper/1.0/xboard/plan/backlog/data.json
// Assert 0 GET to /rest/agile/1.0/board/{boardId}/backlog (or whatever legacy path was)
// Assert 0 GET to /rest/agile/1.0/board/{boardId}/sprint
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3 React Query queries on BacklogPage (`jira-sprint-list`, `jira-backlog-sprint-stories`, `jira-backlog-issues`) | 1 query `['gh-backlog', boardId]` | This phase | 3→1 network requests on backlog open; 1 cache to invalidate on mutations. |
| 3 Sidebar prefetches | 1 prefetch (`getGhBacklogData`) | This phase | 3→1 warm-up requests. |
| Entity map resolution via separate REST (`fetchProjectStatuses`, `fetchEpicsBasic`) bound into the page | Entity maps inline in `data.entityData` (read locally), with `fetchEpicsBasic` retained for the toolbar epic filter dropdown's broader "all project epics" set | This phase | Backlog rows resolve status/type/epic without a separate fetch. |
| Optimistic update on 2 separate caches | Optimistic update on 1 unified `GhBacklogResponse` | This phase | Simpler rollback path. |

**Deprecated/outdated:**
- `fetchBacklogIssues` / `fetchBacklogSprintStories` — REMOVE. No remaining callers after this phase.
- `fetchBacklogView` / `BacklogViewData` interface — REMOVE. Grep-confirmed zero non-test callers.
- Query keys `['jira-backlog-issues', ...]`, `['jira-backlog-sprint-stories', ...]` — REMOVE.
- Comment at `types.ts:163-164` claiming `data.json` "does NOT carry entity maps" — DELETE during widening.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GhIssue` (backlog) is a strict subset of `GhBoardIssue` (board) minus `timeInColumn` — making the Phase 71 adapter reusable as-is. | Don't Hand-Roll, Pattern 2 | If `GhIssue` carries extra fields the adapter doesn't expect, none are referenced — no fail path. Verified by inspecting both fixture entries (same fields minus `timeInColumn`/`parentId` per `types.ts:26-68`). LOW risk. `[VERIFIED: types.ts]` |
| A2 | `data.sprints[i].issuesIds` issue IDs are numeric (number, not string). | Pattern 2 | Adapter uses `Number(issueId)` so type mismatch surfaces in tests. Fixture confirms numeric (lines 7234-7240). LOW risk. `[VERIFIED: fixture]` |
| A3 | `data.entityData` shape is structurally identical to `GhAllDataResponse['entityData']` and the Phase 71 `EntityMaps` alias is compatible. | Pattern 1 widening | If structures differ, type errors at adapter call site. Fixture confirms identical shape (`statuses`, `priorities`, `types`, `epics` keyed by ID with same nested shape). LOW risk. `[VERIFIED: fixture]` |
| A4 | `BacklogViewData` has no consumer outside `services/jira/backlog.ts` and the legacy `jira.ts` definition. | Pitfall 3 | If new consumers exist, delete breaks them. Grep-confirmed only one import (`backlog.ts:8`). Planner re-grep before delete. LOW risk. `[VERIFIED: grep]` |
| A5 | `data.sprints[].state` is the literal string `'ACTIVE' \| 'CLOSED' \| 'FUTURE'` (uppercase). The current `fetchSprintList`-driven code compares against `'active'` / `'future'` (lowercase) — adapter or hook code must convert / compare uppercase. | Pattern 1, D-01a | Sprint section filter will silently produce empty arrays if the comparison is wrong. Fixture confirms uppercase (lines 7218, 7247, etc.). MEDIUM risk — easy to get wrong. Planner should add an explicit test. `[VERIFIED: fixture]` |
| A6 | `epicId` on `GhIssue` is a string in `types.ts:40` but appears as a string in the fixture too (`"357666"`) — adapter `resolveEpic` keying works. | Standard Stack | If runtime sends numeric epicId, lookups fail. Fixture confirms string. LOW risk. `[VERIFIED: fixture]` |
| A7 | The `/backlog` route literal for `useIsActiveRoute('/backlog')` matches the actual route path. | Pattern 1 | If route is `/dashboard/backlog`, hook stays disabled. Planner verifies route registration in `App.tsx` / router config. MEDIUM risk if unverified. `[ASSUMED]` |

## Open Questions

1. **Should optimistic updates also patch `data.issues[]` (not just `data.sprints[i].issuesIds[]`) when creating a story?**
   - What we know: Move-to-sprint only shifts membership (issue already exists in `data.issues`). Create-story adds a new issue.
   - What's unclear: Whether `addIssuesToSprint` API returns the full new `GhIssue` shape needed to prepend into `data.issues`, or whether we let the post-mutation `invalidateGhBacklogData` refetch handle it.
   - Recommendation: For create-story, skip optimistic and rely on invalidation refetch (avoids reconstructing a `GhIssue` from REST response). For move-to-sprint, patch `issuesIds[]` only (cheap, correct).

2. **Does the "Reload backlog" action's invalidation set need `['jira-statuses']` if entity maps now come from `data.json`?**
   - What we know: D-07 specifies the three-key invalidation set. `['jira-statuses']` would only matter if the legacy `fetchProjectStatuses` cache is still consulted elsewhere on backlog.
   - What's unclear: BacklogPage uses `projectStatuses` for the status filter dropdown (line 307). That still uses `fetchProjectStatuses` after this phase.
   - Recommendation: Keep `['jira-statuses']` (or whatever its actual key is — verify the existing one at line 307 is `['project-statuses', activeJiraProject, jiraBaseUrl]`) in the invalidation set, since the status filter still depends on it. The CONTEXT.md spec is correct.

3. **`flagged` indicator decision (D-05c).**
   - What we know: `GhIssue.flagged?: boolean` IS declared in `types.ts:39` (optional), but the fixture sample doesn't show it on any backlog issue.
   - What's unclear: Whether the field is just absent in the captured sample or actually never present on backlog responses.
   - Recommendation: Drop the indicator in this phase per D-05c default. The optional type is safe — adapter already collapses `undefined → false` (Phase 71 WR-06).

## Environment Availability

Skipped — no external dependencies beyond what's already installed. All required packages, runtimes, and services are in place (`@tanstack/react-query`, `@tanstack/react-virtual`, React 19, existing Jira Stronghold secret bootstrap).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (verified in repo: `useGhAllData.test.ts` uses `vi.mock`, `describe`, `expect`) |
| Config file | `vitest.config.ts` (existing — verified by sibling test files passing) |
| Quick run command | `npm run test -- src/services/jira/greenhopper/useGhBacklogData` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GH-BACKLOG-01 | Single `data.json` request when opening backlog (verified at hook level) | unit | `npm run test -- useGhBacklogData` | ❌ Wave 0 |
| GH-BACKLOG-01 | Hook key is `['gh-backlog', boardId]`; cache miss invokes `fetchBacklogData` exactly once | unit | same | ❌ Wave 0 |
| GH-BACKLOG-01 | Sidebar prefetch warms the same cache key | unit | `npm run test -- Sidebar` | ❌ Wave 0 |
| GH-BACKLOG-02 | Adapter maps `GhIssue` → JiraIssue with synthesized assignee, status, type, epic, priority | unit | `npm run test -- adapter` | ✅ existing (`adapter.test.ts`) — extend |
| GH-BACKLOG-02 | Sprint reverse-index attaches `fields.sprint.id` correctly | unit | `npm run test -- BacklogPage` | ❌ Wave 0 |
| GH-BACKLOG-02 | Move-to-sprint mutation invalidates `['gh-backlog', boardId]`, NOT the legacy keys | unit | `npm run test -- BacklogPage` | ❌ Wave 0 |
| GH-BACKLOG-02 | Virtualized rendering still feeds from adapted issues | manual UAT | open `/backlog` and scroll | manual |
| GH-CUT-01 | `fetchBacklogIssues` / `fetchBacklogSprintStories` / `fetchBacklogView` symbols removed | static | `! grep -q "fetchBacklogIssues\|fetchBacklogSprintStories\|fetchBacklogView" src` | ❌ Wave 0 (grep script) |
| GH-CUT-01 | Legacy query keys `['jira-backlog-issues'` etc. removed | static | `! grep -q "jira-backlog-issues\|jira-backlog-sprint-stories" src/routes src/components` | ❌ Wave 0 |
| (type pin) | `GhBacklogResponse` type compatible with the real fixture | unit | `npm run test -- types` | ❌ Wave 0 |
| (network invariant) | Exactly one `/rest/greenhopper/1.0/xboard/plan/backlog/data.json` request on backlog open, zero legacy backlog REST calls | manual UAT | DevTools Network panel | manual |

### Sampling Rate
- **Per task commit:** `npm run test -- src/services/jira/greenhopper/useGhBacklogData src/services/jira/greenhopper/types src/services/jira/greenhopper/adapter`
- **Per wave merge:** `npm run test` + `npm run lint` (Biome baseline: 0 errors, 0 warnings)
- **Phase gate:** Full suite green + manual network-log UAT + manual UAT scenarios (move-to-sprint, create story, rank, filter)

### Wave 0 Gaps
- [ ] `src/services/jira/greenhopper/useGhBacklogData.test.ts` — mirror `useGhAllData.test.ts` (8 tests: null boardId, disabled when no token, enabled when isActive + token + boardId, ensureQueryData behavior, invalidate by boardId, invalidate all, refetch on token rotation, error envelope passthrough).
- [ ] `src/services/jira/greenhopper/types.test.ts` — type pin against fixture (Code Examples §"Type test").
- [ ] `src/services/jira/greenhopper/adapter.test.ts` — **extend** with a backlog-shaped case: `GhIssue` (no `timeInColumn`, no `parentId`) maps through cleanly + sprint reverse-index attachment.
- [ ] `src/routes/dashboard/BacklogPage.test.tsx` — gate test: legacy query keys absent in invalidation calls; mutation handlers call `invalidateGhBacklogData`.
- [ ] `src/components/app/Sidebar.test.tsx` — verify single `getGhBacklogData` call instead of three legacy prefetches.
- [ ] Static grep script (CI or pre-commit) confirming deleted symbols never reappear.

## Security Domain

Not applicable — phase has no security surface. No new endpoint, no new auth, no new input validation. The existing Jira Stronghold PAT bootstrap (`readSecret('jira-pat')`) is unchanged.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (unchanged — Stronghold PAT) |
| V3 Session Management | no | (n/a) |
| V4 Access Control | no | (n/a — same Jira PAT, same scope) |
| V5 Input Validation | no | No user input changes; only cache key shape. |
| V6 Cryptography | no | (n/a) |

## Project Constraints (from CLAUDE.md)

No project-level `CLAUDE.md` was found at the repo root (verified — Read returned "File does not exist"). Constraints are inherited from project memory:
- `[[project_jira_ts_dual_file]]` — All public Jira service symbols MUST be re-exported through `src/services/jira.ts`. Importers in route components and Sidebar use `@/services/jira`. **Applies in this phase (D-09b).**
- `[[project_biome_state]]` — Maintain 0 errors / 0 warnings baseline. No new a11y regressions.
- `[[feedback_no_git_stash_for_lint_compare]]` — N/A for this phase.
- `[[feedback_visual_bugs_dom_first]]` — N/A; data-layer-only phase.

## Sources

### Primary (HIGH confidence)
- `taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json` (8198 lines) — authoritative `GhBacklogResponse` shape. Confirms `entityData`, `sprints[].issuesIds`, `rankCustomFieldId`, `projects`, `versionData`, `canManageSprints`, `canCreateIssue`, `supportsPages`, `cardColorStrategy`, `emptyFilterBoard`, `hasBulkChangePermission`, `issueArchivingEnabled`. Sprint state literals uppercase (`'ACTIVE'`, `'FUTURE'`).
- `taskflow/src/services/jira/greenhopper/useGhAllData.ts` — verbatim model for the new hook.
- `taskflow/src/services/jira/greenhopper/data.ts` — `fetchBacklogData` (Phase 71 shipped fetcher).
- `taskflow/src/services/jira/greenhopper/adapter.ts` — `adaptIssue` + `createAdapter` (reuse).
- `taskflow/src/services/jira/greenhopper/types.ts:160-166` — `GhBacklogResponse` declaration requiring widening.
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — current 3-query data layer + mutation handlers + optimistic update patterns.
- `taskflow/src/services/jira/backlog.ts` — legacy fetcher source for `fetchBacklogIssues` (line 20), `fetchSprintList` (line 83, KEEP), `fetchBacklogSprintStories` (line 132), `fetchBacklogView` (line 195).
- `taskflow/src/services/jira.ts:2048-2185` — dual-file re-exports to delete + `BacklogViewData` interface (line 2149).
- `taskflow/src/components/app/Sidebar.tsx:38-42, 180-245` — current 3-prefetch pattern.
- `taskflow/src/lib/query-constants.ts` — `STALE_TIME_MS = 30_000`, `POLL_INTERVAL_MS = 60_000`.
- `taskflow/package.json` — verified versions (react-query 5.90.21, react-virtual 3.13.23, react 19.1.0).
- `.planning/phases/74-backlog-on-data-json/74-CONTEXT.md` — locked decisions D-01 through D-09b.
- `.planning/phases/74-backlog-on-data-json/74-UI-SPEC.md` — toolbar contract + copy.
- `.planning/REQUIREMENTS.md` — GH-BACKLOG-01/02, GH-CUT-01/02.
- `.planning/phases/73-sprint-board-on-alldata-json/73-CONTEXT.md` — pattern parent.
- `.planning/phases/72-workflow-transitions-via-greenhopper/72-CONTEXT.md` — mutations-stay-REST precedent (D-08).
- `.planning/phases/71-greenhopper-adapter-foundation/71-CONTEXT.md` — adapter philosophy.

### Secondary (MEDIUM confidence)
- `.planning/research/GREENHOPPER-API.md` §"data.json" — **EXPLICITLY incomplete per CONTEXT.md**. Only used as a backstop for endpoint URL.

### Tertiary (LOW confidence)
- None — all critical claims verified against in-repo authoritative sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from package.json; no new installs.
- Architecture: HIGH — direct mirror of Phase 73 shipped pattern; references all locked CONTEXT.md decisions.
- Pitfalls: HIGH — derived from real code paths (BacklogPage mutation handlers, Sidebar prefetch chain, `jira.ts` dual-file rule).
- Fixture shape: HIGH — fixture file inspected at lines 1-100 (issues), 6674-7209 (entityData), 7210-7339 (sprints with issuesIds), 7340-8197 (envelope tail). All claimed fields confirmed.
- A7 (route literal `/backlog`): MEDIUM — assumed based on Sidebar's `PREFETCH_ROUTES` set (line 73) which includes `/backlog`. Planner verifies in router config.

**Research date:** 2026-05-29
**Valid until:** 2026-06-12 (14 days — only because the fixture is the ground truth; this expires only if a real-API capture differs from the fixture).
