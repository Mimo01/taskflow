---
phase: 72
plan: 01
subsystem: services/jira/greenhopper
tags: [greenhopper, react-query, cache, transitions, jira, status-map]
requires:
  - Phase 71 (entityMaps warn-once pattern, fetchGhTransitions)
provides:
  - useGhTransitions hook (project × type → JiraTransition[])
  - getGhTransitions imperative twin
  - invalidateGhTransitions namespace invalidator
  - fetchAllJiraStatuses + JiraStatus type
  - Shared warnOnce helper for the GH folder
affects:
  - taskflow/src/services/jira.ts (re-exports added; legacy fetchTransitions untouched)
  - taskflow/src/services/jira/greenhopper/entityMaps.ts (refactored to consume shared warnOnce)
tech-stack:
  added: []
  patterns:
    - "React Query two-layer cache: envelope key + adapted per-type key"
    - "queryClient.ensureQueryData for imperative deduping callers"
    - "Shared module-level seenMissing Set for cross-resolver warn-once"
key-files:
  created:
    - taskflow/src/services/jira/greenhopper/warnOnce.ts
    - taskflow/src/services/jira/greenhopper/warnOnce.test.ts
    - taskflow/src/services/jira/statuses.ts
    - taskflow/src/services/jira/statuses.test.ts
  modified:
    - taskflow/src/services/jira/greenhopper/transitions.ts
    - taskflow/src/services/jira/greenhopper/transitions.test.ts
    - taskflow/src/services/jira/greenhopper/entityMaps.ts
    - taskflow/src/services/jira.ts
decisions:
  - "Two-layer cache (envelope + per-type adapted) per RESEARCH §3 planner note; honours D-01 most literally and saves adapter cost on repeat reads."
  - "Adapter helpers exported with `__` prefix for testability without polluting the public surface (re-exports through jira.ts only list the public trio + fetchAllJiraStatuses + type)."
  - "entityMaps.ts re-exports __resetWarnOnce so the existing Phase 71 test imports stay stable; new code can also import from './warnOnce' directly."
metrics:
  duration: ~6 minutes
  completed: 2026-05-28
---

# Phase 72 Plan 01: GreenHopper Transitions Cache Infrastructure Summary

Shipped the GreenHopper transitions cache + status-map infrastructure that Plans 02 (call-site swap) and 03 (cutover) depend on: a React Query two-layer cache around `fetchGhTransitions`, a `JiraTransition`-shape adapter backed by a session-cached global Jira status list, and a shared `warnOnce` helper that the Phase 71 entity-map resolvers and the Phase 72 transitions adapter now both consume from one module-level `seenMissing` Set.

## What Shipped

### Task 1: Shared `warnOnce` helper + entityMaps refactor — `55371c27`

- New `src/services/jira/greenhopper/warnOnce.ts` exporting `warnOnce(kind, id)` and `__resetWarnOnce()` against a single module-level `seenMissing: Set<string>` keyed by `${kind}:${id}`.
- Warn message format preserved verbatim from the original entityMaps implementation (`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`) so no existing console output changes.
- `entityMaps.ts` no longer defines its own `seenMissing`/`warnOnce` — it imports both from `./warnOnce` and re-exports `__resetWarnOnce` to keep the Phase 71 public surface stable (entityMaps.test.ts imports it from `./entityMaps`).
- 5 new `warnOnce.test.ts` cases (same key → one warn, distinct keys → two warns, same id different kinds → two warns, verbatim message format, reset re-warns).
- All 10 Phase 71 `entityMaps.test.ts` cases remain green.

### Task 2: `fetchAllJiraStatuses` module — `6b596847`

- New `src/services/jira/statuses.ts` exporting `fetchAllJiraStatuses(baseUrl, token): Promise<JiraStatus[]>` and the `JiraStatus` interface (`{ id, name, statusCategory: { id, key, name } }`).
- Mirrors `fetchProjectStatuses` (`fields.ts:127-159`): `apiFetch('jira', ...)`, 401/403 → `ApiError('Failed to fetch Jira statuses', status, 'jira')`, other non-OK → generic `Error` with status in message, trailing slash stripped from baseUrl.
- `JiraStatus` shape matches `JiraTransition.to.statusCategory` at `jira.ts:183-191` so the Plan 02 adapter can copy `statusCategory` through by reference.
- 6 test cases covering 200 success, URL+headers+operation label, trailing-slash strip, 401/403 `ApiError`, 500 generic error.

### Task 3: `transitions.ts` cache + adapter + jira.ts re-exports — `3f280269`

- `fetchGhTransitions` (Phase 71) preserved unchanged.
- Private helpers (exported with `__` prefix for tests, not re-exported through `jira.ts`):
  - `__indexTransitions(envelope, projectId, issueTypeId)` — looks up `workflowName = projectAndIssueTypeToWorkflow[String(projectId)]?.[issueTypeId]`, returns `workflowToTransitions[workflowName] ?? []`. Miss → `[]` + `warnOnce('gh-transitions-workflow', ...)`.
  - `__adaptToJiraTransition(gh, statusMap)` — produces the legacy `JiraTransition` shape. Status hit → copies `to.statusCategory` from the map; status miss → `{ name: 'Status ${id}', statusCategory: { id: 0, key: 'indeterminate', name: 'Unknown' } }` + `warnOnce('gh-transitions-status', ...)`.
  - `__ensureStatusMap(qc, baseUrl, token)` — `queryClient.ensureQueryData` on `['jira-statuses']` with `staleTime: Infinity`, `gcTime: Infinity`; builds `Map<statusId, { name, statusCategory }>`.
- Public surface:
  - `useGhTransitions(projectId, issueTypeId): UseQueryResult<JiraTransition[]>` — two-layer cache. queryKey `['gh-transitions', projectId, issueTypeId]`; inner `ensureQueryData` on `['gh-transitions-envelope', projectId]`. Reads `jiraBaseUrl` from `useAuthStore`, loads token via `readSecret('jira-pat')` in `useEffect` with a cancel guard. `enabled` is false until both are ready.
  - `getGhTransitions(qc, baseUrl, token, projectId, issueTypeId)` — imperative twin sharing the envelope + status-map caches.
  - `invalidateGhTransitions(qc, projectId?)` — `projectId` provided invalidates both `['gh-transitions-envelope', projectId]` and `['gh-transitions', projectId]`; omitted invalidates the bare namespaces.
- `jira.ts` re-export block (lines 2744-2762) extended with `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`, a new sibling block re-exports `fetchAllJiraStatuses` and `type JiraStatus` from `./jira/statuses`. The leading comment now reads "Phase 71 + Phase 72".
- 18 new test cases in `transitions.test.ts`:
  - `__indexTransitions`: hit + miss returns [] + warns once on repeat miss.
  - `__adaptToJiraTransition`: hit (statusCategory copied through) + miss (exact `Status N` / `Unknown` fallback shape, warn).
  - `__ensureStatusMap`: `ensureQueryData` called with the exact `{ queryKey: ['jira-statuses'], staleTime: Infinity, gcTime: Infinity }` shape.
  - `getGhTransitions`: dedupe across two `(pid, type)` calls — exactly one `fetchGhTransitions` and one `fetchAllJiraStatuses` invocation.
  - `invalidateGhTransitions`: one project → two `invalidateQueries` calls with both keys; no project → two namespace-level calls.
  - `useGhTransitions` hook: two `renderHook` consumers of same `projectId` with different `issueTypeId` → exactly one `fetchGhTransitions` call (validates project-level dedupe via the envelope layer); also asserts the hook stays disabled when token is empty.
- All 6 pre-existing `fetchGhTransitions` cases retained.

## Verification

- `npx vitest run` for the 4 touched test files: **4 files passed, 39 tests passed**.
- Full repo `vitest run` (pre-commit hook): **1643 tests passed, 35 todo, 2 skipped, 0 failures**.
- `npx tsc --noEmit -p taskflow/.`: clean.
- `npx biome check` on touched files: clean (autoformat applied; no remaining errors/warnings).

## Acceptance Assertions (all green)

| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -cE "^export (function \|async function \|const )?(useGhTransitions\|getGhTransitions\|invalidateGhTransitions)"` (transitions.ts) | 3 | 3 |
| `grep -c "'gh-transitions-envelope'"` (transitions.ts) | ≥ 2 | 6 |
| `grep -c "'gh-transitions'"` (transitions.ts) | ≥ 2 | 5 |
| `grep -c "gcTime: Infinity"` (transitions.ts) | ≥ 3 | 5 |
| `grep -cE "useGhTransitions\|getGhTransitions\|invalidateGhTransitions"` (jira.ts) | ≥ 3 | 3 |
| `grep -c "fetchAllJiraStatuses"` (jira.ts) | ≥ 1 | 1 |
| `grep -c "export async function fetchTransitions"` (jira.ts) | 1 | 1 (untouched — Plan 03 owns the deletion per D-08) |
| `grep -c "staleTime: 5"` (transitions.ts — W-04 footgun guard) | 0 | 0 |
| `grep -c "const seenMissing"` (entityMaps.ts) | 0 | 0 |
| `grep -c "from ['\"]\./warnOnce['\"]"` (entityMaps.ts) | 1 | 1 |

## Deviations from Plan

None. All three tasks were executed as written. Two minor in-line refinements within scope:

1. **Private helpers exported with `__` prefix.** The plan called for them to be "private" while also requiring test coverage. Mirroring the established `__resetWarnOnce` convention from `entityMaps.ts`, `__indexTransitions`, `__adaptToJiraTransition`, and `__ensureStatusMap` are exported but signalled as internals; they are **not** re-exported through `jira.ts`, so the public surface from a consumer's perspective is exactly the documented trio plus `fetchAllJiraStatuses` + `JiraStatus`.
2. **Pre-existing transitions tests required `vi.restoreAllMocks()` in nested `beforeEach`** to prevent the multi-`describe` console.warn spy from accumulating call counts across blocks. Added once per cache-layer describe; behavior preserved.

## Threat Surface

No new threat flags. The plan's `<threat_model>` covers all introduced surface (auth header reuse via `apiFetch('jira',...)`, in-memory React Query cache, `ApiError` propagation, `gcTime: Infinity` enforced by grep assertion, status-id fallback uses `key: 'indeterminate'` per D-06b).

## Known Stubs

None. This plan ships infrastructure (cache + adapter) consumed by Plan 02; there are no UI components rendered from this plan that could carry placeholder data.

## Legacy Code Status

- `fetchTransitions` at `src/services/jira.ts:678-711` — **intentionally untouched.** Deletion is scheduled for Plan 03 (D-08).
- `src/services/jira/transitions.ts` (`postTransition` + the REST GET fetcher) — untouched. `postTransition` is permanent; the REST GET fetcher is Plan 03's job.

## Self-Check: PASSED

Files verified to exist:
- FOUND: taskflow/src/services/jira/greenhopper/warnOnce.ts
- FOUND: taskflow/src/services/jira/greenhopper/warnOnce.test.ts
- FOUND: taskflow/src/services/jira/statuses.ts
- FOUND: taskflow/src/services/jira/statuses.test.ts
- FOUND: taskflow/src/services/jira/greenhopper/transitions.ts (extended)
- FOUND: taskflow/src/services/jira/greenhopper/transitions.test.ts (extended)
- FOUND: taskflow/src/services/jira/greenhopper/entityMaps.ts (refactored)
- FOUND: taskflow/src/services/jira.ts (re-exports added)

Commits verified in `git log`:
- FOUND: 55371c27 feat(72-01): extract shared warnOnce helper for greenhopper folder
- FOUND: 6b596847 feat(72-01): add fetchAllJiraStatuses module
- FOUND: 3f280269 feat(72-01): cache hook + helpers + adapter for GH transitions
