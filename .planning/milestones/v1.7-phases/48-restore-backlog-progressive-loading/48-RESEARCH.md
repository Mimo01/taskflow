# Phase 48: Restore Backlog Progressive Loading - Research

**Researched:** 2026-04-04
**Domain:** React / TanStack Query — re-integrating per-section query architecture into BacklogPage
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-01 | User sees layout-matched skeleton screens instead of spinners | BacklogSkeleton component exists at `BacklogSkeleton.tsx` but is not imported by BacklogPage; the page currently uses raw `animate-pulse` divs. Wire BacklogSkeleton into BacklogPage and gate it with useDelayedLoading. |
| LOAD-04 | User sees backlog issue list immediately while epic metadata loads progressively; per-row epic badge shows Skeleton while allEpics query is pending | BacklogRow already supports `epicsLoading` prop pattern (per Phase 47 Plan 01 context). The current BacklogRow does NOT have that prop — it was reverted. Must re-add it alongside the per-section query split. |
| LOAD-05 | User does not see skeleton flicker when data loads within 200ms | `useDelayedLoading` hook exists and is used by 6 other views. BacklogPage uses raw `isLoading` without the hook. Fix: replace `isLoading` guard with `useDelayedLoading(isLoading)`. |
| QOPT-02 | Backlog loads faster by parallelizing independent queries; handleMoveToSprint invalidates correct cache key | BacklogPage currently invalidates `['jira-issues','sprint-board']` (pre-Phase 45 key). SprintBoardTab uses `['jira-sprint-stories']`. Fix: change invalidation to `['jira-sprint-stories']`. The per-section query split also enables parallel data fetching. |
</phase_requirements>

---

## Summary

Phase 48 is a re-integration, not a greenfield build. All the pieces already exist in the codebase — the regression was introduced by post-milestone commit `702ff84` (context menu feature for backlog) which rewrote BacklogPage from scratch without carrying over the Phase 47 progressive loading architecture. The goal is to re-integrate the per-section query architecture alongside the existing context menu functionality.

The current `BacklogPage.tsx` uses: one monolithic `fetchBacklogView` query (`jira-backlog-view` key), raw `isLoading` for skeleton gating (no flicker prevention), inline `animate-pulse` divs (ignores the existing `BacklogSkeleton` component), and invalidates the wrong cache key on move-to-sprint. The `BacklogSkeleton` component, `useDelayedLoading` hook, `fetchSprintList`, `fetchFutureSprintIssues`, and `fetchBacklogIssues` are all fully implemented but currently orphaned.

**Primary recommendation:** Re-wire BacklogPage to use per-section queries (`jira-sprint-stories`, `jira-sprint-list`, `jira-backlog-issues`), import and display `BacklogSkeleton` gated by `useDelayedLoading`, add `epicsLoading` prop to `BacklogRow`, and fix the `handleMoveToSprint` invalidation key — without touching any UI structure, context menu, or filter behavior. The existing context menu (`ContextMenu`/`ContextMenuTrigger` in `BacklogRow`) must be preserved verbatim.

---

## Standard Stack

This phase uses no new libraries. All infrastructure is already present.

### Core (all already installed)
| Library | Version | Purpose | Already Used By |
|---------|---------|---------|----------------|
| `@tanstack/react-query` | existing | Per-section queries, cache sharing | BacklogPage, SprintBoardTab, all views |
| `@tanstack/react-virtual` | existing | Row virtualization in BacklogPage | BacklogPage (disabled), SprintBoardTab |
| `useDelayedLoading` | local hook | 200ms flicker prevention | EpicsPage, WorkloadTab, ReleasesTab, SprintBoardTab, MyTasksTab, SprintProgressTab |
| `BacklogSkeleton` | local component | Layout-matched loading skeleton for backlog | Exists, zero imports |
| `Skeleton` (shadcn) | local component | Per-row epic badge skeleton | Used by BacklogSkeleton, various views |

**No new installations needed.**

---

## Architecture Patterns

### Pattern 1: Per-Section Query Split (the Phase 47 design)

The architecture that was reverted. Three independent queries replace the monolithic `fetchBacklogView`:

**Query 1 — Sprint stories** (shared cache with SprintBoardTab):
```typescript
// Source: SprintBoardTab.tsx line 536 (canonical reference)
queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
queryFn: () => fetchSprintStories(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey, epicLinkFieldKey),
staleTime: STALE_TIME_MS, // 30_000
```
This is the key insight: BacklogPage and SprintBoardTab share this cache. If the user visited sprint board first, backlog sprint sections render from cache with zero API calls.

**Query 2 — Sprint list** (canonical board order, includes empty sprints):
```typescript
// Source: backlog.ts fetchSprintList (already implemented)
queryKey: ['jira-sprint-list', boardId, jiraBaseUrl],
queryFn: () => fetchSprintList(jiraBaseUrl!, jiraToken!, boardId!),
staleTime: STALE_TIME_MS,
enabled: !!boardId,
```

**Query 3 — Backlog issues** (unassigned to any sprint):
```typescript
// Source: backlog.ts fetchBacklogIssues (already implemented)
queryKey: ['jira-backlog-issues', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey],
queryFn: () => fetchBacklogIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey),
staleTime: STALE_TIME_MS,
enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
```

### Pattern 2: useDelayedLoading for Flicker Prevention (LOAD-05)

The established pattern across 6 views in the project:
```typescript
// Source: EpicsPage.tsx line 128, SprintBoardTab.tsx line 571, etc.
const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;
```
Apply the same to BacklogPage: `const showSkeleton = useDelayedLoading(isLoading)` (no polling in backlog, so no `isRefreshing`).

### Pattern 3: BacklogSkeleton as Layout-Matched Loading State (LOAD-01)

`BacklogSkeleton` component already exists at `taskflow/src/routes/dashboard/BacklogSkeleton.tsx`. It renders a `Skeleton` for the section header row plus 6 row skeletons. It must replace the current inline `animate-pulse` divs in BacklogPage:
```typescript
// Instead of:
<div className="p-4 space-y-2">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="h-10 animate-pulse rounded bg-muted" />
  ))}
</div>

// Use:
import { BacklogSkeleton } from './BacklogSkeleton';
// ...
{showSkeleton ? <BacklogSkeleton /> : ...}
```

### Pattern 4: Per-Row Epic Skeleton (LOAD-04)

`BacklogRow` currently has NO `epicsLoading` prop. The prop must be added:

```typescript
// Add to BacklogRowProps:
epicsLoading?: boolean;

// In the epic badge cell, gate the skeleton:
{epicKey ? (
  epicsLoading ? (
    <Skeleton className="h-4 w-14 rounded-full" />
  ) : epicName && epicColorResult ? (
    <button ...>{epicName}</button>
  ) : null
) : null}
```

BacklogPage passes `epicsLoading={isEpicsLoading}` where `isEpicsLoading` comes from the `allEpics` query's `isLoading` state (the `jira-epics-basic` query already present in BacklogPage).

### Pattern 5: handleMoveToSprint Cache Key Fix (QOPT-02)

Current (broken):
```typescript
queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
queryClient.invalidateQueries({ queryKey: ['jira-backlog-view'] });
```

Correct (after per-section split):
```typescript
// Invalidate sprint stories so SprintBoardTab refreshes
queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
// Invalidate new backlog issues key
queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
// Invalidate sprint list if needed
queryClient.invalidateQueries({ queryKey: ['jira-sprint-list'] });
```

Optimistic update target changes from `jira-backlog-view` to `jira-backlog-issues`.

### Pattern 6: useBoardId for Sprint List Query

The sprint list query requires a `boardId`. `useBoardId` hook is already imported in some views and caches the board ID with `staleTime: Infinity`. BacklogPage must add it:

```typescript
import { useBoardId } from '@/hooks/useBoardId';
// ...
const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);
```

The sprint list and future sprint sections are gated on `!!boardId`.

### Recommended File Changes

```
taskflow/src/routes/dashboard/
├── BacklogPage.tsx          — Primary change: per-section queries, useDelayedLoading,
│                              BacklogSkeleton, fix handleMoveToSprint, add useBoardId
├── BacklogRow.tsx           — Add epicsLoading prop and conditional Skeleton in epic cell
├── BacklogPage.test.tsx     — Update mocks: replace fetchBacklogView mock with
│                              fetchSprintStories + fetchSprintList + fetchBacklogIssues mocks
└── BacklogSkeleton.tsx      — No changes needed (already correct)
```

### Anti-Patterns to Avoid

- **Splitting into multiple plans without need:** The changes are tightly coupled — BacklogPage, BacklogRow, and tests must all change together. A single plan (or at most two sequential plans) is appropriate.
- **Touching context menu logic:** `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuGroup`, etc. in `BacklogRow` must not be altered at all.
- **Touching UI section structure:** Section headers, badges (Active/Future), collapse behavior, filter bar, Create Story button — all unchanged.
- **Re-introducing table elements:** The current BacklogPage uses `<table>/<tr>/<td>`. Phase 47 Plan 01 wanted div-based rows, but that was part of enabling always-on virtualization. The current revision should keep `<table>` since the virtualization is already disabled with `const useVirtual = false`. **Key decision:** Phase 48 scope is re-integration of queries and loading UX only — the div-based table refactor from Phase 47 Plan 01 is a secondary concern. The success criteria does NOT require div-based rows; it requires per-section queries, useDelayedLoading, BacklogSkeleton, and the epicsLoading prop. The planner must decide whether to include the div-based refactor or keep the current table structure.
- **Removing fetchBacklogView:** The function should remain in `backlog.ts` (it may be used elsewhere or tested). BacklogPage just stops calling it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flicker prevention | Custom debounce | `useDelayedLoading` hook | Already tested, used in 6 views |
| Skeleton layout | New inline divs | `BacklogSkeleton` component | Already built for this exact purpose |
| Sprint list fetch | New API call | `fetchSprintList` in `backlog.ts` | Already implemented, just unwired |
| Backlog issues fetch | New service function | `fetchBacklogIssues` in `backlog.ts` | Already implemented, just unwired |
| Sprint stories query | New fetch function | `fetchSprintStories` from `@/services/jira/issues` | Shared cache with SprintBoardTab |
| Board ID discovery | Inline fetch | `useBoardId` hook | Shared hook, `staleTime: Infinity` |

---

## Common Pitfalls

### Pitfall 1: Mock Mismatch in Tests
**What goes wrong:** BacklogPage.test.tsx currently mocks `fetchBacklogView`. After the per-section split, BacklogPage no longer calls `fetchBacklogView` — it calls `fetchSprintStories`, `fetchSprintList`, and `fetchBacklogIssues`. Tests will fail because the old mock returns data but the new queries never receive it.
**Why it happens:** Each query must be independently mocked.
**How to avoid:** Update the test mock block from:
```typescript
vi.mock('@/services/jira', () => ({
  fetchBacklogView: vi.fn().mockResolvedValue({ sprints: [], backlog: [], ... }),
  ...
}));
```
To separate mocks for the three new functions, plus a mock for `fetchSprintList` from `@/services/jira/backlog` and `fetchSprintStories` from `@/services/jira/issues`.
**Warning signs:** Test output showing "No data shown" while mocks are set — the wrong query is being satisfied.

### Pitfall 2: useDelayedLoading on Which isLoading
**What goes wrong:** With per-section queries, there's no single `isLoading` — each query has its own. The top-level skeleton should gate on whether ANY required data is still loading. The backlog section specifically should show skeleton when backlog issues are loading; sprint sections when sprint data is loading.
**How to avoid:** Use a combined loading state for the global skeleton (for first load before any data): `const isAnyLoading = storiesLoading && backlogLoading`. Apply `useDelayedLoading` to this combined state for the top-level BacklogSkeleton. Per-section skeletons can use per-query loading states.

### Pitfall 3: Wrong Optimistic Update Target
**What goes wrong:** `handleMoveToSprint` currently optimistically updates the `jira-backlog-view` cache. After the split, the backlog issues are in `jira-backlog-issues`. Updating the wrong cache key means the UI doesn't reflect the move until refetch.
**How to avoid:** Change `setQueryData` target to `['jira-backlog-issues', ...]` and remove the issue from the appropriate sprint section by updating `jira-sprint-stories` cache if the issue was in a sprint section.

### Pitfall 4: boardId Gating
**What goes wrong:** `fetchSprintList` and `fetchSprintStories` require a `boardId`. If `boardId` is null (still loading from `useBoardId`), the sprint queries are disabled but the page may show an incorrect empty state.
**How to avoid:** Sprint sections remain collapsed or show section-level skeleton until `boardId` resolves. The backlog section (no boardId needed) can render independently and immediately.

### Pitfall 5: mergedSprints Logic Depends on backlogView
**What goes wrong:** The current `mergedSprints` memo merges sprint data from `backlogView.sprints` with `sprintIssues`. After the split, there is no `backlogView` — sprint data comes from `jira-sprint-stories` directly. The merge logic must be rewritten.
**How to avoid:** With per-section queries, `jira-sprint-stories` is the authoritative source for active sprint issues. The sprint list (`jira-sprint-list`) provides canonical ordering and empty sprint placeholders. Merge strategy: take sprint list order, fill in issues from `jira-sprint-stories` grouped by sprint ID.

### Pitfall 6: Test Skeleton Detection Assertion
**What goes wrong:** The test `renders skeleton/loading state while query is pending` checks `document.querySelectorAll('.animate-pulse')`. After switching to `BacklogSkeleton` + `useDelayedLoading`, the skeleton may not appear immediately (200ms delay). In tests with vitest fake timers, this works with timer advancement; without fake timers, the assert may pass or fail unpredictably.
**How to avoid:** Either keep using `animate-pulse` class in `BacklogSkeleton` (it already does via the `Skeleton` component) so the query still works, or update the test to advance fake timers before asserting skeleton visibility. The `Skeleton` component uses `animate-pulse` so the existing test assertion should still work.

---

## Code Examples

### Current State: What Exists and Is Orphaned

```typescript
// taskflow/src/services/jira/backlog.ts — ORPHANED, already implemented
export async function fetchSprintList(baseUrl, token, boardId): Promise<JiraActiveSprint[]>
export async function fetchFutureSprintIssues(baseUrl, token, projectKey, boardId, ...): Promise<JiraIssue[]>
export async function fetchBacklogIssues(baseUrl, token, projectKey, ...): Promise<JiraIssue[]>
// fetchBacklogView remains — still exported, just unused by BacklogPage after phase

// taskflow/src/routes/dashboard/BacklogSkeleton.tsx — ORPHANED, already implemented
export function BacklogSkeleton() { ... }  // no imports anywhere
```

### Current State: The Correct Cache Key (verified in SprintBoardTab.tsx)

```typescript
// SprintBoardTab.tsx line 536 — canonical cache key for sprint stories
queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey]

// SprintBoardTab.tsx line 697 — canonical invalidation (what BacklogPage MUST also use)
queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
```

### Current State: The Bug — Wrong Invalidation Key

```typescript
// BacklogPage.tsx line 479 — WRONG key (pre-Phase 45, not matched by SprintBoardTab)
queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
// Fix: change to ['jira-sprint-stories']
```

### fetchSprintStories Signature (from issues.ts)

```typescript
// taskflow/src/services/jira/issues.ts — import from '@/services/jira/issues'
export async function fetchSprintStories(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = false,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<JiraIssue[]>
```

### fetchBacklogIssues Signature (from backlog.ts)

```typescript
// taskflow/src/services/jira/backlog.ts
export async function fetchBacklogIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<JiraIssue[]>
```

### fetchSprintList Signature (from backlog.ts)

```typescript
// taskflow/src/services/jira/backlog.ts
export async function fetchSprintList(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraActiveSprint[]>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-section queries (Phase 47) | Monolithic fetchBacklogView | commit 702ff84 (2026-04-01) | Regression: all sections wait for single response |
| BacklogSkeleton component (Phase 44) | Inline animate-pulse divs | commit 702ff84 (2026-04-01) | Regression: not layout-matched |
| useDelayedLoading on isLoading (Phase 44) | Raw isLoading (no delay) | commit 702ff84 (2026-04-01) | Regression: skeleton flickers on sub-200ms cache hits |
| jira-sprint-stories invalidation (Phase 45) | jira-issues,sprint-board invalidation | commit 702ff84 (2026-04-01) | Bug: Sprint Board not refreshed when moving issue from backlog |

**Root cause:** All regressions trace to a single commit. The fix is surgical re-integration of the progressive loading architecture without touching the context menu feature that commit added.

---

## Open Questions

1. **Div-based rows vs. table rows**
   - What we know: Phase 47 Plan 01 wanted div-based CSS grid rows to enable always-on virtualization. The current BacklogPage uses `<table>/<tr>/<td>` with `const useVirtual = false`.
   - What's unclear: Phase 48 success criteria does NOT require div-based rows. The table approach works fine without virtualization for typical backlog sizes.
   - Recommendation: Keep `<table>/<tr>/<td>` structure in Phase 48. The div-based refactor is optional performance work that can be addressed separately. This reduces the diff and risk surface for Phase 48.

2. **fetchFutureSprintIssues vs. sprint list approach**
   - What we know: `fetchFutureSprintIssues` exists in `backlog.ts` and is orphaned. `fetchSprintList` also exists. Phase 47 Plan 02 chose to use `fetchSprintStories` (shared cache with SprintBoardTab) for active sprint and derive future sprints from the sprint list.
   - What's unclear: Which approach to use for future sprint issues in Phase 48.
   - Recommendation: Follow Phase 47's approach — use the shared `jira-sprint-stories` cache (includes active + does NOT include future sprint issues since the JQL filters `openSprints()`). Future sprint issues require a separate fetch. Use `fetchFutureSprintIssues` with its own query key, or include them in `fetchBacklogView`'s existing logic for future sprints. The simplest approach: use `fetchSprintStories` for active sprint section and the sprint list + agile board for future sprint sections, matching Phase 47's architecture.

3. **Per-section vs. global skeleton**
   - What we know: `BacklogSkeleton` renders a single block skeleton (not per-section).
   - What's unclear: Whether to show one global skeleton until all queries resolve, or per-section skeletons.
   - Recommendation: Show the global `BacklogSkeleton` for the initial load state (when NO data is available yet). Once any section has data, show that section's content and per-section loading states for others. This matches the LOAD-01 requirement for a layout-matched skeleton.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes with no external dependencies beyond the existing project stack.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `npx vitest`) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` |
| Full suite command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |

**Current test status:** 835 passed, 39 todo, 5 skipped (0 failures) — verified 2026-04-04.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAD-01 | BacklogSkeleton renders during loading | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | Existing test "renders skeleton/loading state..." covers this |
| LOAD-04 | Per-row epic Skeleton while allEpics loads | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | Needs new test case in BacklogPage.test.tsx |
| LOAD-05 | No skeleton on sub-200ms loads (useDelayedLoading) | unit | `npx vitest run src/hooks/useDelayedLoading.test.ts` | useDelayedLoading.test.ts exists; BacklogPage integration test needed |
| QOPT-02 | handleMoveToSprint invalidates ['jira-sprint-stories'] | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | Existing BACK-02 tests; need assertion on correct invalidation |

### Sampling Rate
- **Per task commit:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx`
- **Per wave merge:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test case in `BacklogPage.test.tsx` — covers LOAD-04 (per-row epic Skeleton when allEpics is pending)
- [ ] Updated mock structure in `BacklogPage.test.tsx` — replace `fetchBacklogView` mock with `fetchSprintStories` + `fetchSprintList` + `fetchBacklogIssues` mocks

*(Existing test infrastructure is otherwise sufficient — no new test files needed.)*

---

## Project Constraints (from CLAUDE.md)

No CLAUDE.md found in working directory. Standard project conventions apply:
- TypeScript strict mode — all changes must pass `npx tsc --noEmit`
- All existing tests must pass after changes
- Follow existing import path conventions (`@/routes/dashboard/`, `@/hooks/`, `@/services/jira/`)
- Vitest for testing with `@testing-library/react`

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Current state; confirmed imports, query keys, handleMoveToSprint bug
- `taskflow/src/services/jira/backlog.ts` — Confirmed fetchSprintList, fetchFutureSprintIssues, fetchBacklogIssues are fully implemented
- `taskflow/src/routes/dashboard/BacklogSkeleton.tsx` — Confirmed component exists with no importers
- `taskflow/src/hooks/useDelayedLoading.ts` — Confirmed hook signature and behavior
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — Confirmed canonical `['jira-sprint-stories']` cache key and invalidation pattern
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — Confirmed current props interface (no epicsLoading, no style prop)
- `.planning/v1.7-MILESTONE-AUDIT.md` — Confirmed root cause analysis and specific gaps
- `taskflow/src/routes/dashboard/BacklogPage.test.tsx` — Confirmed existing test coverage and mock structure
- Vitest run output — 835 tests pass, 0 failures (baseline confirmed 2026-04-04)

### Secondary (MEDIUM confidence)
- `.planning/phases/47-optimize-backlog-view-performance-with-progressive-loading/47-01-PLAN.md` — Authoritative design reference for the architecture that was reverted
- `.planning/phases/47-optimize-backlog-view-performance-with-progressive-loading/47-02-PLAN.md` — Per-section query wiring details
- `.planning/phases/47-optimize-backlog-view-performance-with-progressive-loading/47-CONTEXT.md` — Decision log for Phase 47 architecture choices

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in codebase, no new installations
- Architecture: HIGH — confirmed by reading actual source files; the Phase 47 plans document the exact architecture to re-integrate
- Pitfalls: HIGH — derived from direct analysis of the regression commit's impact and test structure

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable codebase, no fast-moving dependencies)
