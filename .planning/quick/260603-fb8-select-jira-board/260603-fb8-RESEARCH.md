# Quick Task 260603-fb8: Select Jira Board (fix wrong rapidViewId) - Research

**Researched:** 2026-06-03
**Domain:** Jira Agile REST board discovery + Zustand/Tauri persistence + React Query funnel
**Confidence:** HIGH (all anchors verified in codebase; API shape confirmed by CONTEXT real-world sample + existing code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Fallback:** keep auto-first-board fallback. When no board id is stored for the active project, resolve to `values[0]` exactly as today. No "block until selected" gate on Sprint Board / Backlog.
- `useBoardId` MUST prefer the stored board id, fall back to fetched first board only when nothing stored.
- **Wizard:** after project selection, fetch boards. Auto-pick silently when exactly one board. Require a choice when multiple boards before continue. Allow continue when no board found (fallback applies).
- **Storage:** per-project map `jiraBoardIds: Record<projectKey, number>` (+ setter) in `auth.store.ts`, persisted via existing Tauri storage. Switching active project keeps each project's own chosen board.
- **Picker UX:** show name + id (e.g. `Eshop Scrum Board (163)`); auto-select single board and present read-only; spinner while loading; clear error + retry on fetch failure.

### Claude's Discretion
- React Query keys / staleTime for the new "list boards" query.
- Shared board-picker component shape (reuse between wizard and settings if clean).
- Whether to remove legacy duplicate `fetchActiveSprint` in `jira.ts` — **prefer fixing both call sites** so the wrong board can't sneak back in.
- Match existing project-picker visual patterns in JiraStep.tsx and ConnectionsSection.tsx.

### Deferred Ideas
None.
</user_constraints>

## Summary

The board-id bug has **three** `values?.[0]?.id` sites, not two: `fetchBoardId` (sprints.ts:38) feeds the `useBoardId` funnel (good — one place to add the stored-board override), but **`fetchActiveSprint` does its OWN internal board discovery** and exists in BOTH `jira.ts:1106` (legacy) and `sprints.ts:78`. `fetchActiveSprint` is consumed independently of `useBoardId` by SprintBoardTab (line 709), DashboardSprintCard (line 56), and Sidebar prefetch (line 140). Fixing only `fetchBoardId` leaves the active-sprint path still picking the wrong board's active sprint.

**The clean fix:** add an optional `boardId?: number` parameter to `fetchActiveSprint` so callers that already have a resolved board id (from `useBoardId`) pass it in and skip the internal `values[0]` discovery; only fall back to internal discovery when no boardId is supplied. Then route the stored-board preference through `useBoardId` as the single source of truth, and have it read `jiraBoardIds[activeJiraProject]` from the auth store before falling back to the fetched first board.

**Primary recommendation:** (1) Add `listProjectBoards()` to sprints.ts returning `{id,name,type}[]` (paginated). (2) Add `jiraBoardIds: Record<string, number>` + `setJiraBoardId(projectKey, boardId)` to auth.store. (3) Make `useBoardId` prefer the stored id. (4) Add optional `boardId` param to BOTH `fetchActiveSprint` copies and thread the resolved boardId from the 3 active-sprint callers. (5) Build one shared `<BoardPicker>` used by JiraStep + ConnectionsSection.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| List boards for a project | API service (`sprints.ts`) | mirrors `fetchBoardId`, reuses `apiFetch('jira', …)` |
| Persist chosen board id | Client store (`auth.store.ts`) | per-project, survives restart via Tauri storage |
| Resolve effective board id | Hook (`useBoardId`) | single funnel for sprint/backlog consumers |
| Board picker UI | Route components (Jira step + Settings) | shared presentational component |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FB8-1 | List all boards for a project | `listProjectBoards()` in sprints.ts (below) |
| FB8-2 | Persist chosen board per project | `jiraBoardIds` map in auth.store (below) |
| FB8-3 | Prefer stored board, fall back to first | `useBoardId` change + `fetchActiveSprint` boardId param |
| FB8-4 | Board picker in wizard + settings | shared `<BoardPicker>` (below) |

## API Shape (VERIFIED — code + CONTEXT sample)

`GET /rest/agile/1.0/board?projectKeyOrId={key}&type=scrum` returns:
```json
{ "maxResults": 50, "startAt": 0, "total": 2, "isLast": true,
  "values": [ { "id": 6708, "name": "Copy of Eshop Scrum Board", "type": "scrum" },
              { "id": 163,  "name": "Eshop Scrum Board", "type": "scrum" } ] }
```
[CITED: CONTEXT.md real-world sample + Jira Agile REST v1.0 board search]

**Pagination:** The endpoint IS paginated (`startAt`/`maxResults`/`total`/`isLast`, default `maxResults` 50). [ASSUMED — Jira Agile board search default is 50 per page]
- **Recommendation: do NOT paginate the board list for this task.** A single project rarely has >50 scrum boards; the existing `fetchBoardId` already reads only page 0 and the motivating bug is "wrong board among 2," not "board on page 2." The recurring fetch-once page-cap pitfall (MEMORY) applies to large entity lists (discussions, users) — a per-project scrum-board count is small. If defensiveness is wanted cheaply, raise `&maxResults=100` on the URL rather than implementing a pagination loop. Flag in plan as a known limit, not a blocker.

## Service Function (NEW — lives in `sprints.ts`)

Reuse the exact fetch/auth pattern already in `fetchBoardId` (`apiFetch('jira', url, { headers }, 'Discover Board')`, `Authorization: Bearer ${token}`, trailing-slash strip).

```ts
export interface JiraBoard { id: number; name: string; type: string; }

/** List scrum boards for a project. Returns [] on any failure (graceful-hide). */
export async function listProjectBoards(
  baseUrl: string, token: string, projectKey: string,
): Promise<JiraBoard[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const res = await apiFetch('jira',
      `${base}/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=scrum&maxResults=100`,
      { headers }, 'List Boards');
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.values ?? []).map((b: { id: number; name: string; type: string }) =>
      ({ id: b.id, name: b.name, type: b.type }));
  } catch { return []; }
}
```
Note: `JiraBoard` could also live in `services/jira/types.ts` next to `JiraProject` (id/key/name pattern) for import symmetry. Discretion.

## Auth Store change (`auth.store.ts`)

Add to **three** places (the file uses a single `initialAuthState` object that drives both defaults and `resetAuth`):
1. `initialAuthState`: `jiraBoardIds: {} as Record<string, number>,`
2. `AuthState` interface: `jiraBoardIds: Record<string, number>;` and `setJiraBoardId: (projectKey: string, boardId: number) => void;`
3. Action impl: `setJiraBoardId: (projectKey, boardId) => set((state) => ({ jiraBoardIds: { ...state.jiraBoardIds, [projectKey]: boardId } })),`

**Migration / existing auth.json safety (HIGH confidence):**
- `persist` from zustand merges persisted state over the store's initial state on rehydrate. An existing `auth.json` with NO `jiraBoardIds` key → the field falls back to the `{}` default from the store initializer. **No explicit migration needed.** Reading `jiraBoardIds[key]` on a missing map is safe because the default is `{}`, never `undefined`.
- `partialize` strips only `_hasHydrated`; `jiraBoardIds` will persist automatically. No `partialize` change required.
- `resetAuth` already spreads `initialAuthState`, so it will reset `jiraBoardIds` to `{}` for free once added to that object — verify it's included there (it will be).
- Defensive read in `useBoardId`: `const stored = useAuthStore.getState().jiraBoardIds?.[projectKey ?? ''];` — keep the optional chain in case a very old persisted blob somehow lacks the merged default.

## useBoardId change (`useBoardId.ts`)

Prefer stored id, else fetch+first. Subscribe to the store so a settings change re-renders consumers:

```ts
export function useBoardId(jiraBaseUrl, jiraToken, projectKey) {
  const storedBoardId = useAuthStore(
    (s) => (projectKey ? s.jiraBoardIds[projectKey] : undefined));
  const { data: fetchedBoardId, isLoading } = useQuery({
    queryKey: ['jira-board-id', projectKey, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl ?? '', jiraToken ?? '', projectKey ?? ''),
    staleTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraToken && !!projectKey && storedBoardId == null,
  });
  return { boardId: storedBoardId ?? fetchedBoardId ?? null,
           isLoading: storedBoardId != null ? false : isLoading };
}
```
- `enabled: … && storedBoardId == null` avoids a useless board-discovery network call when a choice is stored (perf win + guarantees stored value can never be overridden by the fetch).

## Downstream consumer impact (VERIFIED via grep)

| Consumer | Uses | Action |
|----------|------|--------|
| `BacklogPage.tsx:231` | `useBoardId` | ✅ no change — inherits stored preference |
| `SprintBoardTab.tsx:535` | `useBoardId` (for greenhopper boardId) | ✅ inherits |
| `FieldsSection.tsx:157` | `useBoardId` | ✅ inherits |
| `IssueDetailSidebar.tsx:120` | `useBoardId` | ✅ inherits |
| **`SprintBoardTab.tsx:709`** | `fetchActiveSprint(... projectKey)` directly | ⚠️ **bypasses choice** — pass resolved `boardId` |
| **`DashboardSprintCard.tsx:56`** | `fetchActiveSprint` (from `jira.ts`) directly | ⚠️ **bypasses choice** — pass resolved `boardId` |
| **`Sidebar.tsx:140`** prefetch | `fetchActiveSprint` directly | ⚠️ **bypasses choice** — thread boardId after the boardId fetch resolves (line 129–136 already resolves it) |
| `Sidebar.tsx:129,183` prefetch | `fetchBoardId` via same `['jira-board-id',…]` key | ✅ shares useBoardId cache key; but stored override lives in store not query — see note |

**Key cross-cutting fix:** give `fetchActiveSprint` an optional final param `boardId?: number`. When provided, skip internal board discovery (the `values[0]` lines at jira.ts:1106 and sprints.ts:78) and go straight to `/board/{boardId}/sprint?state=active`. The 3 active-sprint callers each already have (or can cheaply get) the resolved boardId from `useBoardId` / the prefetch chain. This is the ONLY way to stop the active-sprint path from re-deriving the wrong board.

**Sidebar prefetch nuance:** Sidebar uses `queryClient.fetchQuery` with key `['jira-board-id', …]` and `fetchBoardId` — it does NOT consult the store. To honor the stored choice in prefetch, read `useAuthStore.getState().jiraBoardIds[activeJiraProject]` first and use it directly (skip the fetchQuery) when present; otherwise fall back to the existing fetchQuery. Then pass that boardId into both `getGhAllData`/`getGhBacklogData` AND the new `fetchActiveSprint(…, boardId)`.

## UI insertion points (VERIFIED)

Both files already use the same primitive set: `Select, SelectContent, SelectItem, SelectTrigger` from `@/components/ui/select`, `Label`, `Loader2` spinner, inline error text (`text-destructive` / `XCircle`). The project picker renders a custom `SelectTrigger` showing `${key} — ${name}` and maps options.

**Shared component is worth extracting** (both insertion points are near-identical). Proposed:
```
src/components/jira/BoardPicker.tsx
  props: { boards: JiraBoard[]; value: number | null; onChange: (id:number)=>void;
           isLoading: boolean; error?: string | null; onRetry?: ()=>void; }
  - isLoading → Loader2 + "Loading boards…"
  - error → text-destructive + Retry button
  - boards.length === 1 → read-only line "Board: {name} ({id})" + auto-call onChange(boards[0].id) once
  - boards.length > 1 → Select with options labelled `${name} (${id})`
  - boards.length === 0 → nothing (fallback applies; wizard still allows continue)
```

**JiraStep.tsx wiring:** after `selectedProject` is chosen, fetch boards (React Query keyed on `['jira-boards', selectedProject, jiraUrl]`). Render `<BoardPicker>` below the project Select. Gate `handleContinue`: block only when `boards.length > 1 && !chosenBoard`. On continue, call `setJiraBoardId(selectedProject, chosenBoardId)` (and auto-set when exactly one). Boards state can live in `useOnboardingStore` for back-nav persistence (mirrors `jiraProjects`), or local — discretion; onboarding store already holds `jiraProjects` so adding `jiraBoards`/`jiraBoardId` there is consistent.

**ConnectionsSection.tsx wiring:** inside `JiraConnectionCard`, after a successful test + project pick, fetch boards and render `<BoardPicker>`. On change call a new `onBoardSelected(boardId)` prop wired to `setJiraBoardId(activeJiraProject, boardId)` in the section root. Reuse the existing `testStatus` machinery for loading/error.

## Common Pitfalls

1. **Active-sprint path re-derives wrong board (PRIMARY TRAP).** Fixing `fetchBoardId` alone is insufficient — `fetchActiveSprint` (×2 files) and its 3 callers must thread the resolved boardId. This is the dual-file `jira.ts` gotcha (MEMORY: `project_jira_ts_dual_file`): both `jira.ts:1106` and `sprints.ts:78` carry the bug. Prefer adding the `boardId?` param to BOTH rather than deleting one now (lower risk; 60 imports still hit `jira.ts`).
2. **Stale React Query cache when board choice changes.** Changing the stored board does NOT auto-invalidate `['gh-backlog', boardId]`, `['jira-active-sprint', …]`, or greenhopper allData keys (they're keyed by boardId, so a new boardId is a fresh key — usually self-correcting). BUT `['jira-active-sprint', projectKey, baseUrl]` is keyed by **projectKey, not boardId** — changing the board will NOT refetch it. After `setJiraBoardId`, call `queryClient.invalidateQueries({ queryKey: ['jira-active-sprint'] })` (and optionally `['jira-board-id']`). SprintBoardTab.tsx:718 already has a `useEffect` keyed on boardId to reset its banner, confirming board-switch is an expected runtime event.
3. **Existing users with no stored board.** Default `jiraBoardIds: {}` + `storedBoardId ?? fetchedBoardId` guarantees the current behavior (first board) for anyone who never opened the picker. Verify the `enabled` guard still fires the fetch when `storedBoardId == null`.
4. **`useBoardId` not reactive to settings change.** Use the `useAuthStore((s) => s.jiraBoardIds[key])` selector form (not `getState()`) inside the hook so a Settings change re-renders board consumers without a remount.

## Validation

No automated test framework change needed beyond matching existing patterns. Manual UAT:
- Project with 2 boards (the Eshop case): wizard requires choice; pick `Eshop Scrum Board (163)`; verify Sprint Board + Backlog + Dashboard sprint card all use 163.
- Project with 1 board: auto-selected, read-only, continue allowed.
- Existing auth.json (no `jiraBoardIds`): app loads, falls back to first board, no crash.
- Switch chosen board in Settings → Sprint Board/Dashboard active-sprint refresh (invalidation works).

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Board endpoint default `maxResults` 50 / paginated | Low — recommendation is to skip pagination + raise to 100; a project with >100 scrum boards is implausible |
| A2 | zustand `persist` merges new `{}` default over old auth.json without migration | Low — standard zustand merge behavior; defensive `?.` read included |

## Sources

- VERIFIED (codebase): sprints.ts, useBoardId.ts, auth.store.ts, JiraStep.tsx, ConnectionsSection.tsx, Sidebar.tsx, SprintBoardTab.tsx, DashboardSprintCard.tsx, greenhopper/data.ts, jira.ts:1088-1117, jira/types.ts
- CITED: CONTEXT.md real-world board sample
- MEMORY: project_jira_ts_dual_file, project_fetch_once_pagecap_pitfall

**Confidence:** Standard stack HIGH, architecture HIGH, pitfalls HIGH. Valid until codebase changes.
