# Phase 72: Workflow Transitions via GreenHopper - Research

**Researched:** 2026-05-28
**Domain:** React Query cache layer + adapter over an existing typed GreenHopper fetcher; swap of 4 call sites; legacy REST GET deletion.
**Confidence:** HIGH

## Summary

Phase 72 is a **pure cache-layer-plus-adapter phase** with a hard-cutover at four call sites. Phase 71 already shipped `fetchGhTransitions` (typed envelope) and the `warnOnce` pattern; this phase composes a React Query layer (`['gh-transitions', projectId]` + `['jira-statuses']`, both `staleTime: Infinity` / `gcTime: Infinity`), exposes three public APIs (`useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`), synthesizes the legacy `JiraTransition` shape so the four call sites do not need rendering changes, and deletes the two duplicated `fetchTransitions` definitions (legacy `jira.ts:678-711` and modular `jira/transitions.ts:12-45`).

All design decisions are locked in CONTEXT.md (D-01 through D-08b). The user constraints layer below is verbatim. Every implementation primitive (`apiFetch`, `ApiError`, `warnOnce`, `staleTime: Infinity` queries, the sprint-board refresh button shape, the dual-file re-export in `jira.ts`) already exists in the codebase. There are no unknowns and no external library decisions.

**Primary recommendation:** Build per the CONTEXT.md decision matrix exactly. The single planner judgement call is the **manual-refresh UX surface**: CONTEXT.md D-07 says "toast", but the codebase has **no toast library installed**. Recommend an inline lastRefreshed-style success label next to the existing sprint-board RefreshCw button, or surface errors via the existing `ErrorState` / `StaleDataBanner` patterns — not a new dependency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cache Storage**
- **D-01:** React Query holds the cache. `useQuery({ queryKey: ['gh-transitions', projectId], queryFn: () => fetchGhTransitions(baseUrl, token, projectId), staleTime: Infinity, gcTime: Infinity })`. Session-scoped. Manual refresh = `queryClient.invalidateQueries({ queryKey: ['gh-transitions', projectId] })`.
- **D-01a:** Imperative call sites (`BulkActionBar`) read via `queryClient.ensureQueryData(...)`.

**Resolver Shape**
- **D-02:** Public resolver returns **`JiraTransition[]`** (legacy shape from `jira.ts:183-191`). Synthesizes `to.id`, `to.name`, `to.statusCategory` from a status-id map (D-06); maps `GhTransition.transitionId` → `JiraTransition.id` (stringified) and `GhTransition.name` → `JiraTransition.name`.
- **D-02a:** No `__gh` escape hatch. GH-only flags unused by any current call site.

**Lookup Contract**
- **D-03:** Public exports added to `src/services/jira.ts` (re-exported from `services/jira/greenhopper/index.ts`):
  - `useGhTransitions(projectId: number, issueTypeId: string)` — React hook.
  - `getGhTransitions(queryClient, baseUrl, token, projectId, issueTypeId)` — imperative; uses `ensureQueryData` internally.
  - `invalidateGhTransitions(queryClient, projectId?)` — one project or all.
- **D-03a:** Indexing: `workflowName = response.projectAndIssueTypeToWorkflow[String(projectId)]?.[issueTypeId]`; `ghTransitions = response.workflowToTransitions[workflowName] ?? []`. If `workflowName` undefined → return `[]` + `warnOnce(`unique `(projectId, issueTypeId)`)`.

**Multi-Project Handling**
- **D-04:** Per-`projectId` cache entries, no eviction. `gcTime: Infinity`.

**ID Source at Call Sites**
- **D-05:** Pre-cutover, call sites read `projectId` from `issue.fields.project.id` (cast to `Number`) and `issueTypeId` from `issue.fields.issuetype.id`. `QuickCreateInput` already has both from create context.
- **D-05a:** Phase 72 is a pure swap; no GH-adoption at call sites.

**Status Name / Category Resolution**
- **D-06:** Fetch global Jira status list once per session via `GET /rest/api/2/status` → `[{id, name, statusCategory: {id, key, name}}]`. Cache under `['jira-statuses']`, `staleTime: Infinity`, `gcTime: Infinity`. Resolver builds `Map<statusId, {name, statusCategory}>`.
- **D-06a:** New module: `src/services/jira/statuses.ts`. Public re-export through `jira.ts`. Fetcher: `fetchAllJiraStatuses(baseUrl, token): Promise<JiraStatus[]>`.
- **D-06b:** Same warn-once-on-miss; synthesize `{id: String(toStatusId), name: \`Status ${toStatusId}\`, statusCategory: { key: 'indeterminate', id: 0, name: 'Unknown' }}` on miss.

**Manual Refresh UX**
- **D-07:** Action on sprint-board toolbar labeled **"Reload workflow transitions"**. On click: invalidate `['gh-transitions', currentProjectId]` AND `['jira-statuses']`, refetch both, toast on success/error.
- **D-07a:** Visible whenever a sprint board is shown.
- **D-07b:** No keyboard shortcut, no settings-page duplicate.

**Cutover**
- **D-08:** Hard cutover in a single phase per `GH-CUT-01`. Four call sites swapped, legacy `fetchTransitions` deleted along with its re-export. `postTransition` stays.
- **D-08a:** Tests at the four call sites get `fetchTransitions` mocks replaced with React Query test wrappers or `getGhTransitions`/`useGhTransitions` mocks.

### Claude's Discretion
- Internal naming inside `greenhopper/transitions.ts` (e.g., `indexTransitions(...)` helper vs inlined).
- Whether `useGhTransitions` takes IDs directly or accepts an `(issue: JiraIssue)` overload.
- Whether `invalidateGhTransitions` invalidates `['jira-statuses']` as a side effect, or toolbar does both explicitly (CONTEXT says explicit at toolbar).
- Whether `fetchAllJiraStatuses` lives in `src/services/jira/statuses.ts` or `services/jira/greenhopper/statusResolver.ts` (CONTEXT says legacy sibling).

### Deferred Ideas (OUT OF SCOPE)
- Bundled board-wide reload (Phase 73 may subsume).
- `postTransition` migration to GH (no GH equivalent; POST stays REST).
- GH-only transition flags (`hasScreen`, `hasConditions`, `isGlobal`, `isInitial`, `fromStatusId`).
- Performance verification — recorded in Phase 75's verification artifact per `GH-CUT-02`.
- Per-project `/rest/api/2/project/{id}/statuses` fallback — only if `/rest/api/2/status` proves insufficient.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-TRANS-01 | `transitions.json` fetched once per project and cached; keyed by `projectId × issueTypeId → workflow → transitions[]` | React Query `['gh-transitions', projectId]` with `staleTime: Infinity` provides session cache. Indexing in adapter per D-03a uses the documented envelope (`projectAndIssueTypeToWorkflow` + `workflowToTransitions`) — see "Code Examples" §1. |
| GH-TRANS-02 | Sprint-board drag-to-transition and issue-detail status change read transitions from cache (no per-issue REST `/transitions`) | Four call sites use `useGhTransitions` (hook) or `getGhTransitions` (imperative via `ensureQueryData`). Legacy `fetchTransitions` is deleted, so a regression would fail TypeScript. Verification: zero network calls to `/rest/api/2/issue/*/transitions` during drag/status change. |
| GH-TRANS-03 | Cache invalidated on project/workflow change (re-fetch on session start; manual refresh action available) | Session-scoped via React Query (cleared on reload). Manual: `invalidateGhTransitions` + toolbar action (D-07). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetching `transitions.json` | API Service (`services/jira/greenhopper/transitions.ts`) | — | Already exists; this phase does not touch the fetcher. |
| Fetching `/rest/api/2/status` | API Service (`services/jira/statuses.ts` — new) | — | New legacy-sibling module per D-06a; same `apiFetch('jira', ...)` pattern as `fetchProjectStatuses`. |
| Caching + indexing transitions | React Query layer inside `services/jira/greenhopper/transitions.ts` (hook + helpers) | — | Per D-01/D-03; co-located with the GH fetcher so the cache and the indexer ship as one unit. |
| Adapter `GhTransition[] → JiraTransition[]` | `services/jira/greenhopper/transitions.ts` (private helper) | — | Per D-02; consumes the status-id map (D-06) at adapter time. |
| Status-id → `{name, statusCategory}` map | `services/jira/greenhopper/` (or co-located helper inside transitions.ts) | `services/jira/statuses.ts` (raw fetch) | Map building is pure; isolation per Phase 71 entity-map convention. |
| Re-exporting public surface | `src/services/jira.ts` (legacy dual-file) | `src/services/jira/greenhopper/index.ts` | Per `[[project_jira_ts_dual_file]]` memory; all 60 consumers import from `jira.ts`. |
| Manual refresh action | `routes/dashboard/SprintBoardTab.tsx` (existing toolbar) | — | Toolbar host already exists at lines 1102-1117 (current `RefreshCw` button); add a sibling button or menu item. |
| Cutover (delete legacy) | `services/jira.ts:678-711` + `services/jira/transitions.ts:12-45` (delete) | Tests at the 4 call sites + jira.test.ts + jira/transitions.test.ts (update) | Hard cutover per `GH-CUT-01`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | already-installed | Cache for transitions envelope and global statuses | Already the project's data layer; used by all 4 call sites already; `staleTime: Infinity` idiom is established. `[VERIFIED: codebase grep]` |
| Existing `apiFetch('jira', url, init, op)` | n/a | HTTP wrapper for Jira | All `services/jira/*` modules use it; `fetchGhTransitions` and `fetchProjectStatuses` use it. `[VERIFIED: codebase grep src/services/jira/]` |
| `ApiError` (`lib/api-error`) | n/a | 401/403 propagation to `setJiraConnected(false)` | Pattern reused from `services/jira/transitions.ts` and `services/jira/greenhopper/transitions.ts`. `[VERIFIED: codebase grep]` |
| `warnOnce` helper | n/a | Once-per-key console.warn for cache misses | Already implemented in `services/jira/greenhopper/entityMaps.ts:41-46` (module-level `Set<string>` guard). Phase 72 may reuse the same helper or copy the pattern. `[VERIFIED: codebase read]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `useQuery` / `useQueryClient` from `@tanstack/react-query` | bundled | Hook for `useGhTransitions`, imperative for `getGhTransitions` | Standard idiom; matches `StatusPopover.tsx:42-55` and `SprintBoardTab.tsx:710-716`. `[VERIFIED: codebase read]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Query session cache | Module-level `Map<projectId, Promise<...>>` | Saves Query devtools visibility + invalidation idioms; CONTEXT.md D-01 picks RQ — sticks with project convention. |
| Toast for refresh feedback (D-07) | Inline label like the existing `lastRefreshed` text next to the toolbar refresh button; or `<Alert>` if error | **No toast library is installed** (grep finds zero `sonner`/`react-hot-toast`/`react-toastify`/`@radix-ui/react-toast`). Adding one for one notification is overkill. Inline status text or the existing `StaleDataBanner` / `ErrorState` patterns match the codebase. `[VERIFIED: codebase grep package.json + src/components/ui/]` |

**Installation:**

No new npm packages required. Adding a toast library is **NOT** recommended for this phase (see "Toast UX" caveat in Open Questions).

**Version verification:** `@tanstack/react-query` is already pinned in `package.json`. No version bump needed.

## Package Legitimacy Audit

This phase installs **zero** external packages. The Package Legitimacy Gate protocol does not apply.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
                       │  Sprint board mount / call-site mount   │
                       └────────────────────┬────────────────────┘
                                            │
                       ┌────────────────────┴────────────────────┐
                       │                                         │
              useGhTransitions(pid, tid)              getGhTransitions(qc, ...)
              [hook — StatusPopover,                  [imperative — BulkActionBar,
               SprintBoardTab prefetch]                QuickCreateInput post-create]
                       │                                         │
                       └────────────────────┬────────────────────┘
                                            │
                          ┌─────────────────┴──────────────────┐
                          │  React Query                        │
                          │  ['gh-transitions', projectId]      │
                          │  staleTime/gcTime: Infinity         │
                          └─────────────────┬──────────────────┘
                                            │  miss
                                            ▼
                       fetchGhTransitions(baseUrl, token, projectId)
                       (Phase 71 — already shipped)
                                            │
                                            ▼
                       GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N
                                            │
                                            ▼
                       GhTransitionsResponse envelope
                                            │
                                            ▼
                       Indexer: response.projectAndIssueTypeToWorkflow[pid][tid]
                                  → workflowName
                                  → response.workflowToTransitions[workflowName]
                                  → GhTransition[]
                                  (miss → [] + warnOnce)
                                            │
                                            ▼
                       Adapter: GhTransition[] → JiraTransition[]
                                  reads ['jira-statuses'] cache via queryClient
                                  synthesizes to.{id, name, statusCategory}
                                  (status-id miss → 'Status N' fallback + warnOnce)
                                            │
                                            ▼
                       JiraTransition[] returned to call site
                                  (same shape consumed today — no UI changes)

                ┌──────────────────────────────────────────────────────────┐
                │  Parallel single-fetch for the global status map         │
                │  ['jira-statuses'] — first useGhTransitions() triggers   │
                │  prefetch via the adapter; queryClient.ensureQueryData   │
                └─────────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                              fetchAllJiraStatuses(baseUrl, token)
                                              │
                                              ▼
                              GET /rest/api/2/status

                ┌──────────────────────────────────────────────────────────┐
                │  Sprint-board toolbar "Reload workflow transitions"      │
                │  → invalidateQueries(['gh-transitions', projectId])      │
                │  → invalidateQueries(['jira-statuses'])                  │
                │  → refetch both                                          │
                └──────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| File | Role | Public Surface |
|------|------|----------------|
| `src/services/jira/greenhopper/transitions.ts` (extend) | Fetcher (existing) + cache hook + imperative helper + invalidator + private indexer + private adapter | `fetchGhTransitions` (existing), `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions` |
| `src/services/jira/statuses.ts` (new, per D-06a) | `fetchAllJiraStatuses(baseUrl, token)` against `/rest/api/2/status` | `fetchAllJiraStatuses`, `JiraStatus` type |
| `src/services/jira/greenhopper/index.ts` (extend) | Barrel export | re-exports new public surface (already does for existing) |
| `src/services/jira.ts` (extend) | Dual-file re-export per `[[project_jira_ts_dual_file]]` | `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`, `fetchAllJiraStatuses`, `JiraStatus` |
| `src/services/jira.ts:678-711` (DELETE) | Legacy `fetchTransitions` GET — per D-08 | — |
| `src/services/jira/transitions.ts:12-45` (DELETE) | Modular legacy `fetchTransitions` — per D-08 | `postTransition` stays |
| `src/routes/dashboard/StatusPopover.tsx` (modify) | Swap `useQuery(['transitions', issueKey])` → `useGhTransitions(projectId, typeId)` | unchanged |
| `src/routes/dashboard/SprintBoardTab.tsx` (modify) | Replace prefetch effect (line 730-742) with a single `useGhTransitions(projectId)` call; replace `getTransitions(issueKey)` (line 744-746) with cache read by `(projectId, issueTypeId)`; add toolbar refresh action (line 1101 area) | unchanged |
| `src/routes/dashboard/BulkActionBar.tsx` (modify) | Replace inline `fetchTransitions(...)` (line 161) with `await getGhTransitions(queryClient, baseUrl, token, projectId, issueTypeId)` per-issue | unchanged |
| `src/routes/dashboard/QuickCreateInput.tsx` (modify) | Replace `fetchTransitions(...)` (line 51) with `await getGhTransitions(...)`; needs `projectId` + `issueTypeId` props passed in | small prop additions |

### Recommended Project Structure
```
src/services/jira/
├── greenhopper/
│   ├── transitions.ts     # extend: + useGhTransitions, getGhTransitions, invalidateGhTransitions,
│   │                      #         indexTransitions (private), buildJiraTransitions (private adapter)
│   ├── transitions.test.ts # extend: hook + helper + indexer + adapter tests
│   ├── index.ts           # extend: barrel re-exports the new public names
│   └── (existing files)
├── statuses.ts            # NEW per D-06a: fetchAllJiraStatuses + JiraStatus type
├── statuses.test.ts       # NEW: success / 401 / 403 / network error
├── transitions.ts         # DELETE fetchTransitions; keep postTransition
└── transitions.test.ts    # DELETE fetchTransitions tests; keep postTransition tests

src/services/jira.ts       # DELETE fetchTransitions def (lines 678-711) + its old test;
                           # ADD re-exports of useGhTransitions / getGhTransitions /
                           #     invalidateGhTransitions / fetchAllJiraStatuses + JiraStatus type
```

### Pattern 1: `staleTime: Infinity` session cache
**What:** React Query entry with no expiry, no GC, refetched only on explicit `invalidateQueries`.
**When to use:** Per-session immutable references (board id, project field schema, project statuses). CONTEXT.md D-01 picks this for both transitions and statuses.
**Example:**
```typescript
// Source: src/hooks/useBoardId.ts:17-22 (existing project pattern)
useQuery({
  queryKey: ['board-id', baseUrl, projectKey],
  queryFn: () => fetchBoardId(...),
  staleTime: Infinity,
  enabled: !!baseUrl && !!projectKey,
});
```

### Pattern 2: `queryClient.ensureQueryData` for imperative reads
**What:** Returns cached data if present, fetches + caches if not. Single call per `(queryKey, queryFn)` thanks to RQ's in-flight dedupe.
**When to use:** Imperative call sites (`BulkActionBar.tsx:161`, `QuickCreateInput.tsx:51`) that need the data inside an async event handler, not via a hook.
**Example:**
```typescript
// Reference: https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientensurequerydata
const transitions = await queryClient.ensureQueryData({
  queryKey: ['gh-transitions', projectId],
  queryFn: () => fetchGhTransitions(baseUrl, token, projectId),
  staleTime: Infinity,
});
```

### Pattern 3: warn-once-on-miss (Phase 71 D-07)
**What:** Module-level `Set<string>` guard; one `console.warn` per unique key per session.
**When to use:** When an entity-map lookup misses but the system continues with a safe fallback. CONTEXT.md D-03a (missing workflow) and D-06b (missing status id) reuse this.
**Example:**
```typescript
// Source: src/services/jira/greenhopper/entityMaps.ts:38-46
const seenMissing = new Set<string>();
function warnOnce(kind: string, id: string): void {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}
```

**Planner note:** The existing `warnOnce` lives in `entityMaps.ts` and is **module-private** (not exported, only `__resetWarnOnce` for tests). Phase 72 should either (a) export `warnOnce` (and `__resetWarnOnce`) from a shared module like `greenhopper/warnOnce.ts`, or (b) duplicate the small (7-line) pattern in `transitions.ts`. Option (a) is cleaner; option (b) avoids cross-module side effects on the shared `Set`. Planner picks; if (a), refactor `entityMaps.ts` to consume the shared helper to keep one Set.

### Pattern 4: dual-file re-export (project memory)
**What:** Every new public service surface must be re-exported through `src/services/jira.ts` because all 60 consumers import from that path.
**When to use:** Always, for `services/jira/**` public APIs.
**Example:** Already done for Phase 71 at `jira.ts:2743-2758`.

### Anti-Patterns to Avoid
- **Per-issue cache keys for transitions.** `['transitions', issueKey]` (the current pattern in `StatusPopover.tsx:48` and `SprintBoardTab.tsx:736`) defeats the entire phase — it forces one fetch per issue. The new keyspace MUST be `['gh-transitions', projectId]` so a single envelope serves an entire project.
- **Adding a toast library for one notification.** `package.json` confirms no toast library is installed. Reuse `StaleDataBanner` / `ErrorState` / inline `lastRefreshed` text instead.
- **Calling `fetchGhTransitions` from call sites directly.** Always go through `useGhTransitions` / `getGhTransitions`; the cache layer is the contract.
- **Indexing in the call site.** The indexer (`projectAndIssueTypeToWorkflow → workflowToTransitions`) lives once, inside the hook/helper. Call sites consume `JiraTransition[]`.
- **Treating `projectId` as a string at the React Query key boundary.** The fetcher takes `number`; the envelope keys are stringified. Be explicit: `queryKey: ['gh-transitions', projectId as number]` and `response.projectAndIssueTypeToWorkflow[String(projectId)]`.
- **Forgetting `gcTime: Infinity`.** `staleTime: Infinity` alone allows GC after 5 minutes (RQ default `gcTime`); transitions would silently re-fetch after the cache is garbage-collected.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cache | Custom `Map<projectId, Promise>` | React Query (`staleTime: Infinity`) | RQ already handles dedupe, suspense, devtools, invalidation. CONTEXT.md D-01 locks RQ. |
| In-flight dedupe | Manual `Map<key, Promise>` | RQ does it automatically inside `useQuery` / `ensureQueryData` | Saves race-condition bugs when multiple call sites trigger simultaneously. |
| HTTP fetch | New fetcher with `window.fetch` | `apiFetch('jira', url, init, op)` (`lib/apiFetch.ts`) | Provides auth-failure side effects (`setJiraConnected(false)`) used by every Jira call. |
| 401/403 handling | Custom error class | `ApiError` from `lib/api-error` | Phase 71 reuses; legacy `transitions.ts` reuses. |
| Warn-once tracking | New `Set` per module | Share/duplicate the existing `warnOnce` from `entityMaps.ts:38-46` | Avoid divergent warn semantics. |
| Toast notification | New dependency for one button | Inline last-refreshed label OR existing `StaleDataBanner`/`ErrorState` | Zero current toast surface in the app. |

**Key insight:** Phase 72 is a **wiring phase**, not a primitive-building phase. Every piece of infrastructure already exists; the work is composing them and updating four call sites.

## Runtime State Inventory

This is a refactor / cutover phase, so the inventory is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — React Query cache is in-memory only; no localStorage / IndexedDB persistence detected for transitions. | None. |
| Live service config | None — no n8n / external system embeds transition data. | None. |
| OS-registered state | None. | None. |
| Secrets / env vars | None — `jira-pat` (Stronghold) is unaffected; same auth used by GH endpoint and `/rest/api/2/status`. | None. |
| Build artifacts | None — TypeScript-only changes; no native build artifact to refresh. | None. |
| **In-memory caches (this codebase)** | `['transitions', issueKey]` entries are written by `SprintBoardTab.tsx:736` (`queryClient.fetchQuery`) and `StatusPopover.tsx:48` (`useQuery`). After the swap, those keys are dead; the cutover commit removes the writers, but pre-existing entries in a long-running session are harmless (no reader remains). | No code action needed — verify in tests that the new code never reads from `['transitions', *]`. |

**Canonical question — "After every file is updated, what runtime systems still have the old string cached, stored, or registered?":** Nothing persistent. The only in-memory state is the React Query cache, which is reset on page reload (= session start, per GH-TRANS-03). Once the four call sites switch keys, the old entries become unreachable and are GC'd.

## Environment Availability

This phase has no new external runtime dependencies. The Jira host already serves both `/rest/greenhopper/1.0/xboard/work/transitions.json` (Phase 71 verified) and `/rest/api/2/status` (used by `fetchProjectStatuses` neighbors). Stronghold-stored `jira-pat` works for both.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `/rest/greenhopper/1.0/xboard/work/transitions.json` | Cache fetcher | ✓ (Phase 71) | n/a | — |
| `/rest/api/2/status` | Global status map (D-06) | ✓ (assumed; used by neighbors) | n/a | Per-project `/rest/api/2/project/{id}/statuses` (deferred per CONTEXT) `[ASSUMED]` |
| `@tanstack/react-query` | Cache layer | ✓ | bundled | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Common Pitfalls

### Pitfall 1: `projectId` type mismatch at the queryKey
**What goes wrong:** Caller passes `projectId` as string ("10042") from `issue.fields.project.id` (REST is string), envelope keys are also strings ("10042"), but `fetchGhTransitions` signature takes `number`. Forgetting to `Number()` produces a fetcher TypeScript error; forgetting to `String()` at the envelope index produces an undefined lookup.
**Why it happens:** REST returns string ids; GH envelope keys are also strings; the fetcher signature in Phase 71 takes a number for URL composition.
**How to avoid:** Document the boundary clearly. Public hook signature: `useGhTransitions(projectId: number, issueTypeId: string)`. Call sites do `Number(issue.fields.project.id)`. Indexer does `String(projectId)` when reading the envelope.
**Warning signs:** Cache key contains `"10042"` vs `10042` — different cache entries; or envelope lookup returns `undefined` despite the project being valid.

### Pitfall 2: Forgetting `gcTime: Infinity`
**What goes wrong:** React Query GCs the cache 5 minutes after the last observer unmounts; next call to `useGhTransitions` re-fetches even though `staleTime: Infinity`.
**Why it happens:** `staleTime` controls re-fetch decisions, `gcTime` controls cache retention.
**How to avoid:** Always pair `staleTime: Infinity` with `gcTime: Infinity` for these two keys. Add explicit comment.
**Warning signs:** Network logs show repeat `transitions.json` fetches across navigation away/back to the sprint board within one session.

### Pitfall 3: Status-id is `number` in GH, `string` in REST
**What goes wrong:** `GhTransition.toStatusId` is a number; `JiraTransition.to.id` is a string. The adapter must stringify. The status map keyed by `string` (REST `id`) requires `String(toStatusId)` lookup.
**Why it happens:** GreenHopper schemas use numeric ids; REST v2 status schema uses string ids.
**How to avoid:** In the adapter, always `String(ghTransition.toStatusId)` for both `to.id` and the map lookup.
**Warning signs:** `to.statusCategory.key` resolves to the "Unknown" fallback for every transition despite statuses being present in the map.

### Pitfall 4: Warn-once Set is shared across modules
**What goes wrong:** If `transitions.ts` and `entityMaps.ts` both maintain separate `seenMissing` sets, a single missing status id can warn twice (once from each module).
**Why it happens:** Module-level state is per-module.
**How to avoid:** Centralize the helper in a shared module (`greenhopper/warnOnce.ts`) and import from both, or accept the small duplication and document it.
**Warning signs:** Console shows two `[greenhopper] missing status id=...` lines per id.

### Pitfall 5: Toast UX referenced in D-07 but no toast library installed
**What goes wrong:** Planner writes a task "show toast on refresh success" without checking the codebase, ends up installing `sonner` (or similar) — adds a dep, configures a `<Toaster />` mount, for a single notification.
**Why it happens:** CONTEXT.md D-07 says "toast"; this is colloquial.
**How to avoid:** Use the existing `lastRefreshed` text label idiom next to the new button (already used at `SprintBoardTab.tsx:1103`), or render a transient `<Alert>` inline. Surface errors via `ErrorState` / `StaleDataBanner`. If the user truly wants a global toast system, that is its own phase.
**Warning signs:** A new dependency appears in the plan; a `<Toaster />` mount appears in `App.tsx`.

### Pitfall 6: `QuickCreateInput` doesn't have `issueTypeId` at fetch time
**What goes wrong:** `QuickCreateInput` calls `fetchTransitions(newKey)` **after** `createIssue` — it currently does not know the issue type id until the response. But the new flow needs `issueTypeId` to index the envelope.
**Why it happens:** Old flow keyed by issue key; new flow keys by project+type.
**How to avoid:** Either (a) extract the issue type from the `createIssue` response (it returns `{key}`, may need to widen to include `issueType.id`), or (b) pass the project's default issue type id as a prop (the create flow already knows the column/status; the default issue type is typically Story or Task). Decision is the planner's; CONTEXT.md D-05 says "from the type picker" — confirm the type picker exists and exposes the id.
**Warning signs:** Planner blocks at the QuickCreateInput task asking "where does issueTypeId come from?".

### Pitfall 7: `SprintBoardTab` prefetch loop fires `useGhTransitions` once per issue
**What goes wrong:** Naively replacing the per-issue prefetch effect (lines 730-742) with one `useGhTransitions(projectId, typeId)` call per issue collapses to one underlying fetch (RQ dedupes), but creates one observer per issue — fine, but unnecessary.
**Why it happens:** Mechanical port from per-key to per-project.
**How to avoid:** The board needs ONE `useGhTransitions(projectId)` call total — index lookups by issue type happen at consumption (a small helper `selectTransitionsForType(envelope, projectId, typeId)`). Or call `useGhTransitions` once with a sentinel type ("0") and provide a cache selector `getTransitionsForType(qc, projectId, typeId)` for per-issue reads. Planner picks.
**Warning signs:** N `useGhTransitions(projectId, typeId)` observers per board open; or repeat `transitions.json` requests despite cache.

## Code Examples

### Example 1: indexer (private helper)
```typescript
// Reference: src/services/jira/greenhopper/types.ts:192-195 (envelope shape)
// Reference: CONTEXT.md D-03a (lookup contract)
function indexTransitions(
  envelope: GhTransitionsResponse,
  projectId: number,
  issueTypeId: string,
): GhTransition[] {
  const workflowName = envelope.projectAndIssueTypeToWorkflow[String(projectId)]?.[issueTypeId];
  if (!workflowName) {
    warnOnce('gh-transitions-workflow', `${projectId}:${issueTypeId}`);
    return [];
  }
  return envelope.workflowToTransitions[workflowName] ?? [];
}
```

### Example 2: adapter (private helper)
```typescript
// Reference: src/services/jira.ts:183-191 (JiraTransition shape)
// Reference: CONTEXT.md D-02 + D-06
function adaptToJiraTransition(
  gh: GhTransition,
  statusMap: Map<string, { name: string; statusCategory: { id: number; key: string; name: string } }>,
): JiraTransition {
  const toId = String(gh.toStatusId);
  const status = statusMap.get(toId);
  if (!status) {
    warnOnce('gh-transitions-status', toId);
    return {
      id: String(gh.transitionId),
      name: gh.name,
      to: {
        id: toId,
        name: `Status ${toId}`,
        statusCategory: { id: 0, key: 'indeterminate', name: 'Unknown' },
      },
    };
  }
  return {
    id: String(gh.transitionId),
    name: gh.name,
    to: { id: toId, name: status.name, statusCategory: status.statusCategory },
  };
}
```

### Example 3: `useGhTransitions` hook
```typescript
// Reference: src/hooks/useBoardId.ts:17-22 (project staleTime: Infinity idiom)
export function useGhTransitions(
  projectId: number,
  issueTypeId: string,
): UseQueryResult<JiraTransition[]> {
  const queryClient = useQueryClient();
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat').then(setToken).catch(() => setToken(null));
  }, []);

  return useQuery({
    queryKey: ['gh-transitions', projectId, issueTypeId],
    queryFn: async () => {
      const envelope = await queryClient.ensureQueryData({
        queryKey: ['gh-transitions-envelope', projectId],
        queryFn: () => fetchGhTransitions(jiraBaseUrl!, token!, projectId),
        staleTime: Infinity,
        gcTime: Infinity,
      });
      const statusMap = await ensureStatusMap(queryClient, jiraBaseUrl!, token!);
      const ghTransitions = indexTransitions(envelope, projectId, issueTypeId);
      return ghTransitions.map((t) => adaptToJiraTransition(t, statusMap));
    },
    enabled: !!jiraBaseUrl && !!token && Number.isFinite(projectId) && !!issueTypeId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
```

**Planner note:** Two-layer cache (`['gh-transitions-envelope', projectId]` + `['gh-transitions', projectId, issueTypeId]`) keeps the underlying envelope dedupe at project level while letting consumers read pre-adapted `JiraTransition[]` per type. Alternative: store only the envelope, and let `selectTransitionsForType(...)` adapt on read — saves one cache layer but pushes adapter cost to every read. Planner picks; the two-layer model matches CONTEXT.md D-01 most literally.

### Example 4: `getGhTransitions` imperative helper
```typescript
// Reference: CONTEXT.md D-01a + D-03
export async function getGhTransitions(
  queryClient: QueryClient,
  baseUrl: string,
  token: string,
  projectId: number,
  issueTypeId: string,
): Promise<JiraTransition[]> {
  const envelope = await queryClient.ensureQueryData({
    queryKey: ['gh-transitions-envelope', projectId],
    queryFn: () => fetchGhTransitions(baseUrl, token, projectId),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const statusMap = await ensureStatusMap(queryClient, baseUrl, token);
  return indexTransitions(envelope, projectId, issueTypeId)
    .map((t) => adaptToJiraTransition(t, statusMap));
}
```

### Example 5: `invalidateGhTransitions`
```typescript
export function invalidateGhTransitions(
  queryClient: QueryClient,
  projectId?: number,
): void {
  if (projectId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-transitions-envelope'] });
    queryClient.invalidateQueries({ queryKey: ['gh-transitions'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-transitions-envelope', projectId] });
    queryClient.invalidateQueries({ queryKey: ['gh-transitions', projectId] });
  }
}
```

### Example 6: `fetchAllJiraStatuses` (new module)
```typescript
// New file: src/services/jira/statuses.ts
// Pattern source: src/services/jira/fields.ts:127-159 (fetchProjectStatuses)
import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: { id: number; key: string; name: string };
}

export async function fetchAllJiraStatuses(
  baseUrl: string,
  token: string,
): Promise<JiraStatus[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/status`;
  const response = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    'Load Statuses',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch Jira statuses', response.status, 'jira');
    }
    throw new Error(`Failed to fetch Jira statuses: ${response.status}`);
  }
  return (await response.json()) as JiraStatus[];
}
```

### Example 7: Toolbar action in SprintBoardTab
```typescript
// Anchor: src/routes/dashboard/SprintBoardTab.tsx:1101-1117 (existing RefreshCw button)
// Add a sibling button (label visible on hover; matches existing icon-only refresh):
<button
  type="button"
  onClick={async () => {
    invalidateGhTransitions(queryClient, Number(activeJiraProject)); // or by project id, not key
    queryClient.invalidateQueries({ queryKey: ['jira-statuses'] });
    // Optional inline label update via state, OR rely on RQ isFetching for feedback.
  }}
  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
  aria-label="Reload workflow transitions"
  title="Reload workflow transitions"
>
  <Workflow className="size-3" />
</button>
```

**Planner note:** `activeJiraProject` from `useAuthStore` is a **project KEY**, not a project ID. The toolbar needs the project id. Either (a) read it from any sprint-board issue's `fields.project.id`, (b) derive from the existing `useQuery(['project-statuses', activeJiraProject, ...])` data (line 710-716) which fetches by key but the result objects carry the id, or (c) pass `projectId` through context. This is a small surface for the planner to decide.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-issue `GET /rest/api/2/issue/{key}/transitions` (N requests per board open) | One `GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N` per project per session | This phase (Phase 72) | Drops board-open transitions requests from O(N issues) to O(projects). |
| Two duplicated `fetchTransitions` (legacy `jira.ts:678-711` + modular `jira/transitions.ts:12-45`) | Both deleted; `postTransition` stays | This phase | Removes the dual-file split for transitions GET. The general `jira.ts` dual-file gotcha for the rest of the surface remains. |

**Deprecated/outdated:**
- `fetchTransitions` (both copies) — replaced by `useGhTransitions` / `getGhTransitions`.
- The `['transitions', issueKey]` queryKey namespace — replaced by `['gh-transitions', projectId, issueTypeId]` (and `['gh-transitions-envelope', projectId]`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/rest/api/2/status` returns the global list of statuses with `statusCategory.{id,key,name}` for every status the Jira instance defines. | Standard Stack / Example 6 | If insufficient (heavily customized projects with project-only statuses not in the global list), some `to.statusCategory` synthesizes the "Unknown" fallback. Deferred fallback to `/rest/api/2/project/{id}/statuses` is documented in CONTEXT.md `<deferred>`. |
| A2 | `@tanstack/react-query` is already pinned in `package.json` (verified by codebase usage in `StatusPopover.tsx:48` and `SprintBoardTab.tsx:14`). Version not re-verified against npm registry. | Standard Stack | None — already installed. `[VERIFIED: codebase grep]` for presence; version assumed current. |
| A3 | `createIssue` in `services/jira` returns sufficient info for `QuickCreateInput` to know `issueTypeId` post-create, OR a type picker exists in the QuickCreate flow exposing the id. | Pitfall 6 | If neither, planner needs a small surface change to widen `createIssue`'s response or to pass the issue type id down as a prop. |
| A4 | `activeJiraProject` from `useAuthStore` is a project **key** (string like "PROJ"), not a numeric id. | Example 7 / Toolbar note | If it's actually the id, the toolbar action is simpler. Planner verifies. |
| A5 | No toast library installed. `[VERIFIED: grep package.json + src/components/ui/]` | Standard Stack Alternatives + Pitfall 5 | None. |

## Open Questions (RESOLVED)

1. **Two-layer cache vs single-layer with on-read adapt?**
   - What we know: CONTEXT.md D-01 specifies the envelope-level key; adapter output per type is a derived value.
   - What's unclear: Whether to materialize the per-type adapted list in its own cache entry (Example 3 / 4) or compute on read each time.
   - Recommendation: Two-layer (envelope + per-type). Negligible cost; better RQ observer behavior.
   - **Resolved in Plan 01 Task 3 — two-layer queryKeys adopted (`['gh-transitions-envelope', projectId]` + `['gh-transitions', projectId, issueTypeId]`).**

2. **Toast vs inline feedback for D-07 refresh action.**
   - What we know: D-07 says "toast"; no toast library installed.
   - What's unclear: Whether the user meant a transient notification specifically or just "feedback".
   - Recommendation: Inline label or `<Alert>`-style banner; flag in PLAN for user confirmation. Do not install a toast library in this phase.
   - **Resolved in Plan 02 Task 1 — inline `aria-live="polite"` label next to the existing `lastRefreshed` span; no toast dependency added.**

3. **Where does `QuickCreateInput` get `issueTypeId` from?**
   - What we know: Today it calls `createIssue` and then `fetchTransitions(newKey)`.
   - What's unclear: Whether `createIssue` already returns the issue type or whether a small response widening is needed.
   - Recommendation: Planner reads `createIssue` signature; if not returned, widen the return value (small change) or pass project default issue type id as a prop.
   - **Resolved in Plan 02 Task 2 — `projectId: number` + `issueTypeId: string` props added to `QuickCreateInput`, threaded from `SprintBoardTab`; `createIssue` signature is NOT widened.**

4. **`activeJiraProject` key vs id at the toolbar action.**
   - What we know: The store exposes `activeJiraProject` used as a project key today.
   - What's unclear: Whether a numeric id is available without an additional fetch.
   - Recommendation: Reuse `useQuery(['project-statuses', activeJiraProject, ...])` result (already present at SprintBoardTab line 710) which contains the id; pass through.
   - **Resolved in Plan 02 Task 1 — `projectId` derived from the already-fetched `['project-statuses', activeJiraProject, jiraBaseUrl]` query data (no new fetch).**

## Validation Architecture

Nyquist validation is enabled (config `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing project convention) |
| Config file | `vite.config.ts` (vitest section) — existing |
| Quick run command | `npx vitest run src/services/jira/greenhopper/transitions.test.ts src/services/jira/statuses.test.ts src/routes/dashboard/StatusPopover.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx src/routes/dashboard/BulkActionBar.test.tsx src/routes/dashboard/QuickCreateInput.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GH-TRANS-01 | `useGhTransitions` fetches `transitions.json` once per `projectId` and serves all `(projectId, typeId)` reads from cache | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "fetched once per project"` | ❌ Wave 0 |
| GH-TRANS-01 | Indexer resolves `(projectId, issueTypeId) → workflow → GhTransition[]`; returns `[]` + warn-once on missing workflow | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "indexer"` | ❌ Wave 0 |
| GH-TRANS-01 | Adapter synthesizes `JiraTransition.to.{id,name,statusCategory}`; `Status N` fallback + warn-once on missing status id | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "adapter"` | ❌ Wave 0 |
| GH-TRANS-02 | `StatusPopover` opens and reads transitions from `['gh-transitions', ...]` cache (no `fetchTransitions` mock call) | integration | `npx vitest run src/routes/dashboard/StatusPopover.test.tsx -t "uses GH cache"` | ❌ Wave 0 (StatusPopover.test.tsx doesn't exist yet) |
| GH-TRANS-02 | `SprintBoardTab` prefetches `transitions.json` once per project (no per-issue REST `/transitions` fetches) | integration | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -t "single transitions fetch"` | ✅ exists, needs update |
| GH-TRANS-02 | `BulkActionBar` resolves transition via `getGhTransitions`; no per-issue REST fetches | integration | `npx vitest run src/routes/dashboard/BulkActionBar.test.tsx -t "uses GH cache"` | ⚠️ check; if absent → Wave 0 |
| GH-TRANS-02 | `QuickCreateInput` reads transitions from `getGhTransitions` post-create | integration | `npx vitest run src/routes/dashboard/QuickCreateInput.test.tsx -t "uses GH cache"` | ✅ exists, needs update |
| GH-TRANS-03 | `invalidateGhTransitions(qc, projectId)` refetches that project's envelope | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "invalidate one project"` | ❌ Wave 0 |
| GH-TRANS-03 | `invalidateGhTransitions(qc)` (no project) invalidates all | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "invalidate all"` | ❌ Wave 0 |
| GH-TRANS-03 | Sprint-board toolbar action triggers `invalidateGhTransitions` + `['jira-statuses']` invalidation | integration | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -t "Reload workflow transitions"` | ❌ Wave 0 |
| GH-CUT-01 | `fetchTransitions` (both copies) no longer exported from `@/services/jira` | static | `npx vitest run src/services/jira.test.ts` (existing `fetchTransitions` test must be deleted; verify export removed) | ✅ existing test must be deleted |
| GH-CUT-01 | `fetchTransitions` not imported from any call site | static / lint | `! grep -rn "fetchTransitions" src --include='*.ts' --include='*.tsx'` (expects zero hits) | n/a — shell check |
| Invariant | `warnOnce` emits once per unique `(projectId, issueTypeId)` and per missing `statusId` | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "warn-once"` | ❌ Wave 0 |
| Invariant | `staleTime` AND `gcTime` both `Infinity` on both keys | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts -t "cache config"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command above (focused on the modified files).
- **Per wave merge:** `npx vitest run src/services/jira src/routes/dashboard` (all GH + call-site tests).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/services/jira/greenhopper/transitions.test.ts` — extend to cover hook + helpers + indexer + adapter + invalidator + warn-once + cache config
- [ ] `src/services/jira/statuses.test.ts` — new (success / 401 / 403 / network failure)
- [ ] `src/routes/dashboard/StatusPopover.test.tsx` — new (component test verifying cache read, no `fetchTransitions` call)
- [ ] `src/routes/dashboard/BulkActionBar.test.tsx` — verify exists; if not, new
- [ ] Update `src/routes/dashboard/SprintBoardTab.test.tsx` mock map — remove `fetchTransitions`, add `useGhTransitions` mock
- [ ] Update `src/routes/dashboard/QuickCreateInput.test.tsx` mock map — replace `fetchTransitions` with `getGhTransitions`
- [ ] Delete `fetchTransitions` cases from `src/services/jira.test.ts` (lines ~213-225) and `src/services/jira/transitions.test.ts` (`describe('fetchTransitions', ...)`)

*(Framework install: none — vitest already configured.)*

## Security Domain

`security_enforcement` defaults to enabled; this phase touches network-attached cache reads/writes with no user-supplied content surfaces.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `Bearer <jira-pat>` from Stronghold; reused unchanged. `[VERIFIED: code]` |
| V3 Session Management | no | Cache is in-memory only; cleared on reload. |
| V4 Access Control | no | Jira enforces server-side per-token. |
| V5 Input Validation | yes (light) | `projectId` cast to `Number`; `issueTypeId` is a server-supplied string. URL composition uses template literal — value origin is the server. |
| V6 Cryptography | no | No new crypto. Token storage in Stronghold unchanged. |
| V7 Error Handling | yes | `ApiError` for 401/403 (existing pattern); generic `Error` for other failures, surfaced to UI via `useQuery.error`. |
| V9 Communications | yes | HTTPS to the Jira host (existing `apiFetch` enforces). |

### Known Threat Patterns for the stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token leakage via error message | Information Disclosure | `ApiError` does not include the token; `apiFetch` wraps errors consistently. |
| Cache poisoning across sessions | Tampering | Cache is in-memory only; cleared on page reload. No persistence layer added. |
| Logging PII via warn-once | Information Disclosure | Warn payloads include only entity ids (numeric), not user-identifiable strings. |
| Missing-status fallback masks a real failure | Repudiation / DoS | Warn-once surfaces in console; UI still renders functional fallback. Operator sees the warn in DevTools when needed. |

## Sources

### Primary (HIGH confidence)
- `src/services/jira/greenhopper/transitions.ts` (lines 1-57) — existing fetcher, error semantics, JSDoc
- `src/services/jira/greenhopper/types.ts` (lines 170-195) — `GhTransition` + `GhTransitionsResponse`
- `src/services/jira.ts` (lines 183-191, 678-711, 2743-2758) — `JiraTransition` shape, legacy `fetchTransitions` to delete, current GH re-exports
- `src/services/jira/transitions.ts` (lines 1-83) — modular legacy `fetchTransitions` + `postTransition`
- `src/services/jira/greenhopper/entityMaps.ts` (lines 38-46) — warn-once pattern
- `src/services/jira/fields.ts` (lines 120-159) — `fetchProjectStatuses` (template for new `fetchAllJiraStatuses`)
- `src/routes/dashboard/StatusPopover.tsx` — call site #1 with existing `useQuery(['transitions', issueKey])`
- `src/routes/dashboard/SprintBoardTab.tsx` (lines 14-46, 700-742, 1101-1117) — call site #2 + toolbar host + existing `staleTime: Infinity` example at line 714
- `src/routes/dashboard/BulkActionBar.tsx` (lines 19-20, 156-190) — call site #3
- `src/routes/dashboard/QuickCreateInput.tsx` — call site #4
- `src/hooks/useBoardId.ts` (lines 17-22) — project's canonical `staleTime: Infinity` idiom
- `.planning/research/GREENHOPPER-API.md` — endpoint contract for `transitions.json`
- `.planning/phases/72-workflow-transitions-via-greenhopper/72-CONTEXT.md` — locked decisions
- `.planning/phases/71-greenhopper-adapter-foundation/71-CONTEXT.md` — Phase 71 carried decisions

### Secondary (MEDIUM confidence)
- TanStack Query docs — `ensureQueryData`, `invalidateQueries`, `staleTime` / `gcTime` semantics. Referenced in Pattern 2.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive exists in-repo and was read.
- Architecture: HIGH — call sites and integration points read line-by-line.
- Pitfalls: HIGH for #1-#5 (verified against code); MEDIUM for #6 (depends on `createIssue` return shape — flagged as A3).
- Validation Architecture: HIGH — test files inventoried by grep; framework verified by existing tests.
- Security: HIGH for V2/V5/V7/V9; no novel surfaces.

**Research date:** 2026-05-28
**Valid until:** 2026-06-11 (14 days — codebase changes daily; locked decisions in CONTEXT.md are durable but call-site line numbers may drift)
