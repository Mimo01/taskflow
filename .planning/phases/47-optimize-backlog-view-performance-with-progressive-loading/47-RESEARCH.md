# Phase 47: Optimize Backlog View Performance with Progressive Loading - Research

**Researched:** 2026-03-31
**Domain:** React performance refactor — TanStack Query progressive rendering, @tanstack/react-virtual div-based virtualization, per-row Skeleton loading
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Split `fetchBacklogView` into separate per-section queries — active sprint issues, future sprint issues, and backlog (unsprinted) issues. Each section renders independently as its query resolves.
- **D-02:** Sprint sections reuse the shared `jira-sprint-stories` query cache already used by SprintBoardTab. If the user visited the sprint board first, backlog sprint sections render instantly from cache with zero extra API calls.
- **D-03:** The backlog-only section gets its own dedicated query for unsprinted issues (no longer bundled with sprint data).
- **D-04:** Replace `<table>`/`<tr>` rendering in `VirtualizedBacklogTable` with div-based rows using CSS grid or flex to mimic table layout. This fixes the `position: absolute` on `<tr>` overlap bug that currently forces `useVirtual = false`.
- **D-05:** All sections use the same div-based virtualized table component — no threshold-based conditional virtualization.
- **D-06:** Load all backlog issues upfront (no pagination or infinite scroll), rely on virtualization to keep DOM light. Works well for typical backlog sizes (up to ~500-1000 issues).
- **D-07:** ADVN-02 (infinite scroll) remains deferred — not in scope for this phase.
- **D-08:** Add per-row Skeleton placeholders in each row's epic column until the `allEpics` query resolves. Replaces the current header-only Skeleton with a more polished per-row progressive feel.
- **D-09:** Once `allEpics` resolves, epic badge skeletons swap to actual epic name/color badges without layout shift.

### Claude's Discretion

- Whether the backlog-only query uses JQL via REST API (`sprint is EMPTY`) or the Agile board backlog endpoint — pick based on reliability and board-level JQL filter preservation
- Exact CSS grid/flex column widths for the div-based table replacement
- Virtualizer configuration (overscan count, estimated row size)
- How to handle the transition from `VirtualizedBacklogTable` to the new div-based component (rename vs new component)
- Whether future sprint sections need their own query or can derive from the board API

### Deferred Ideas (OUT OF SCOPE)

- ADVN-02: Infinite scroll replacing pagination in backlog — remains a future requirement, not addressed in this phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-04 | User sees backlog issue list immediately while epic metadata loads progressively — currently partial (header-level only). Phase 47 completes it with per-row epic badge Skeletons. | Per-row Skeleton pattern documented in Architecture Patterns. BacklogRow prop addition and layout-shift prevention fully researched. |
</phase_requirements>

---

## Summary

Phase 47 is a focused refactor of the existing backlog page with three distinct sub-problems: (1) split the monolithic `fetchBacklogView` query into independent per-section queries so sections render progressively, (2) replace `<table>`/`<tr>` DOM structure with `<div>`-based CSS grid rows to enable `position: absolute` virtualization, and (3) add per-row Skeleton placeholders in the epic column to complete LOAD-04.

The codebase already has all the infrastructure needed: `useVirtualizer` is imported in `BacklogPage.tsx` but disabled (`useVirtual = false`) due to the `<tr>` position bug. The `jira-sprint-stories` query key is shared with `SprintBoardTab` — sprint section data is already in cache on return visits. The `allEpics` query is already separate and its `isPending` flag is already passed down to `VirtualizedBacklogTable` as `epicsLoading`, but only used for a header-level Skeleton. The `BacklogRow` component is a `forwardRef` wrapping `<tr>` — it must be converted to a `<div>` row while preserving all existing props and the ref contract.

The main complexity is the query split: `fetchBacklogView` currently handles active sprint issues, future sprint issues, backlog issues, and sprint list ordering in one monolithic function. After the split, the sprint sections will read from the shared `jira-sprint-stories` cache (D-02), while the backlog section gets its own dedicated query using the existing JQL (`sprint is EMPTY AND issuetype != Sub-task`) from `fetchBacklogIssues`. Sprint list ordering (for empty sprints) still requires one `agile/1.0/board/{id}/sprint` call — this belongs in the sprint section query or a shared sprint list query, not in `fetchBacklogIssues`.

**Primary recommendation:** Keep `fetchBacklogIssues` as the backlog section's query function (it already exists and is correct). Add a new `fetchSprintList` function for the sprint list + issue grouping. Sprint issues come from the shared `jira-sprint-stories` cache with no new API calls.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-virtual` | ^3.13.23 (installed) | Row virtualization | Already imported in BacklogPage, just needs div-based container |
| `@tanstack/react-query` | ^5.90.21 (installed) | Per-section query isolation | Shared cache, `isPending` per query, `useDelayedLoading` integration |
| shadcn `Skeleton` | Existing in project | Per-row epic column placeholder | Already used for header-level epic Skeleton |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useDelayedLoading` hook | Project hook | 200ms flicker prevention per section | Apply to each section's `isLoading` independently |
| `useBoardId` hook | Project hook | Board ID for sprint list fetch | Already shared with SprintBoardTab |
| CSS grid (`grid-cols`) via Tailwind | n/a | Div-based table layout | Required for `position: absolute` virtualization to work |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS grid for div table | CSS `display: table-cell` with divs | Grid is more reliable for fixed-width column layout; table-display on divs has same stacking context issues |
| `fetchBacklogIssues` for backlog query | Agile board backlog endpoint | REST JQL is simpler and already tested; Agile board backlog endpoint would respect board-level JQL but adds complexity |
| Per-section skeleton via `BacklogSkeleton` | Full-page skeleton until all sections load | Per-section is the point of the split — monolithic skeleton would defeat progressive rendering |

**Installation:** No new packages needed — all dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
taskflow/src/routes/dashboard/
├── BacklogPage.tsx          # Replace monolithic query with 3 per-section queries; div-based rendering
├── BacklogRow.tsx           # Add epicsLoading?: boolean prop; convert <tr> → <div> row
├── BacklogSkeleton.tsx      # No structural change needed (used per-section now)
taskflow/src/services/jira/
├── backlog.ts               # Add fetchSprintList() function; keep fetchBacklogIssues()
```

### Pattern 1: Per-Section Query with Independent Loading State

**What:** Each section (active sprint, future sprints, backlog) has its own `useQuery` call. Sections render as each resolves. `useDelayedLoading` applied to each query's `isLoading` independently.

**When to use:** When a page has logically independent data sections that can be displayed without waiting for each other.

**How it maps to this phase:**

- **Sprint sections:** Reuse the existing `jira-sprint-stories` query (D-02). This query is already fired by `SprintBoardTab` — on return visits, the data is in cache and sections render instantly. No new query function needed for sprint issues.
- **Sprint list (ordering + empty sprints):** New `fetchSprintList()` function calling `agile/1.0/board/{boardId}/sprint?state=active,future`. This is a separate query keyed by `['jira-sprint-list', projectKey, boardId]`. It merges the sprint list order with the sprint stories to produce ordered sprint sections including empty ones.
- **Backlog section:** Uses existing `fetchBacklogIssues` function with query key `['jira-backlog-issues', projectKey, jiraBaseUrl]`. Completely independent — renders as soon as its query resolves.

**Example (BacklogPage query structure):**
```typescript
// Source: project pattern — TanStack Query v5
// Sprint issues — shared cache with SprintBoardTab
const { data: sprintStories, isLoading: sprintStoriesLoading } = useQuery({
  queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
  queryFn: () => fetchSprintStories(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey, epicLinkFieldKey),
  staleTime: STALE_TIME_MS,
  enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});

// Sprint list — for ordering + empty sprints
const { data: sprintList, isLoading: sprintListLoading } = useQuery({
  queryKey: ['jira-sprint-list', activeJiraProject, jiraBaseUrl, boardId],
  queryFn: () => fetchSprintList(jiraBaseUrl!, jiraToken!, boardId!),
  staleTime: 5 * 60_000,
  enabled: !!jiraBaseUrl && !!jiraToken && boardId !== null,
});

// Backlog issues — independent section
const { data: backlogIssues, isLoading: backlogLoading, isError: backlogError } = useQuery({
  queryKey: ['jira-backlog-issues', activeJiraProject, jiraBaseUrl],
  queryFn: () => fetchBacklogIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey),
  staleTime: 60_000,
  enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});

const showSprintSkeleton = useDelayedLoading(sprintStoriesLoading || sprintListLoading);
const showBacklogSkeleton = useDelayedLoading(backlogLoading);
```

### Pattern 2: Div-Based CSS Grid Row for Virtualization

**What:** Replace `<table>/<thead>/<tbody>/<tr>/<td>` with a `<div>` container using CSS grid. The virtualizer wraps `<div style={{ height: totalSize, position: 'relative' }}>` and each row is `<div style={{ position: 'absolute', transform: 'translateY(...)' }}>`.

**Why it fixes the bug:** CSS `position: absolute` on `<tr>` is undefined behavior per spec and causes rows to overlap. On `<div>`, `position: absolute` works exactly as intended.

**Column layout (6 columns matching current `<td>` widths):**

```typescript
// Source: BacklogPage.tsx existing column definitions, UI-SPEC column widths
const GRID_COLS = 'grid-cols-[32px_96px_auto_1fr_56px_40px]';
// checkbox | key | epic | summary | points | assignee
```

**Row structure:**
```tsx
// Source: BacklogRow.tsx existing cell content, converted to div
// Header row (non-virtualized, sticky):
<div className={`grid ${GRID_COLS} border-b bg-muted/10 text-xs font-medium text-muted-foreground`}>
  <div className="w-8 px-3 py-2" />
  <div className="px-2 py-2">Key</div>
  <div className="px-2 py-2">{epicsLoading ? <Skeleton className="h-4 w-16" /> : 'Epic'}</div>
  <div className="px-2 py-2">Summary</div>
  <div className="px-2 py-2 text-right">Points</div>
  <div className="px-2 py-2">Assignee</div>
</div>

// Data row (virtualized, position: absolute):
<div
  className={cn(`grid ${GRID_COLS} border-b border-border hover:bg-muted/30 transition-colors cursor-pointer`, isFocused && 'bg-muted border-l-2 border-primary')}
  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
>
  {/* cells */}
</div>
```

**Virtualizer setup (per section):**
```typescript
// Source: @tanstack/react-virtual v3 API — useVirtualizer
const density = useSettingsStore(s => s.density);
const estimateSize = useCallback(() => {
  if (density === 'compact') return 28;
  if (density === 'comfortable') return 44;
  return 36;
}, [density]);

const rowVirtualizer = useVirtualizer({
  count: filteredIssues.length,
  getScrollElement: () => scrollElement,
  estimateSize,
  overscan: 5,
});
```

### Pattern 3: Per-Row Epic Badge Skeleton (LOAD-04 completion)

**What:** Pass `epicsLoading` down to each `BacklogRow` (or the new div-based row). When `true` and the issue has an epic key, render a Skeleton in the epic cell instead of the badge.

**Layout shift prevention:** The Skeleton must match the badge height. From UI-SPEC: `<Skeleton className="h-4 w-14 rounded-full" />` — `h-4` = 16px matches the `text-[11px]` badge height with `py-0` padding.

**Logic in BacklogRow epic cell:**
```tsx
// Source: BacklogRow.tsx existing epic cell logic + UI-SPEC
{epicKey ? (
  epicsLoading ? (
    <Skeleton className="h-4 w-14 rounded-full" />
  ) : epicName && epicColorResult ? (
    <button type="button" /* existing badge */ >
      {epicName}
    </button>
  ) : null
) : null}
```

**Key insight:** Only show Skeleton when `epicKey` is truthy (issue has an epic). Issues without epics render nothing in either state — no layout shift from Skeleton appearing/disappearing where there was no content.

### Pattern 4: Optimistic Mutation Cache Update (refactor target)

The existing `handleMoveToSprint` performs an optimistic cache update against the `jira-backlog-view` query key. After the split, this must update the correct new query keys:

- `jira-sprint-list` + `jira-sprint-stories` for sprint sections
- `jira-backlog-issues` for the backlog section

The simplest approach: invalidate all three query keys on success (the existing invalidation pattern), and for the optimistic update, manipulate `jira-backlog-issues` directly (remove selected keys from backlog array) plus update `jira-sprint-stories` via `queryClient.setQueryData`.

### Anti-Patterns to Avoid

- **Keeping `useVirtual = false` flag:** The entire point of D-04/D-05. Remove the flag after converting to div-based rows.
- **Threshold-based virtualization (`filteredIssues.length > N`):** D-05 forbids this — all sections use the virtualizer regardless of count.
- **Skeleton shown when issue has no epic:** Show Skeleton only when `epicKey` is truthy. Otherwise the Skeleton appears and disappears in an otherwise empty cell, creating a visual artifact for issues without epics.
- **Single `estimateSize` value ignoring density:** The virtualizer's `estimateSize` should read from `useSettingsStore` so compact/comfortable density variants produce correct scroll calculations.
- **Forgetting the scroll container:** `getScrollElement` must point to the outer `scrollRef` div (the page scroll container), not the section's local container. All sections share the same page scroll.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row virtualization | Custom windowing logic | `useVirtualizer` from `@tanstack/react-virtual` | Already imported; handles overscan, size estimation, scroll tracking |
| Per-row loading placeholders | Custom pulsing divs | shadcn `Skeleton` primitive | Already in project; animate-pulse, correct color token (`bg-accent`) |
| 200ms flicker prevention | `setTimeout` in component body | `useDelayedLoading` hook | Already in project, tested, consistent behavior |
| Sprint board cache reuse | Second sprint API call | Read from `jira-sprint-stories` query cache | TanStack Query's shared cache; zero extra API calls if SprintBoardTab visited first |

**Key insight:** The table-to-div conversion does not require any new CSS technique. CSS grid with `grid-cols-[...]` arbitrary values is idiomatic Tailwind and is already used extensively in the project.

---

## Common Pitfalls

### Pitfall 1: Shared Scroll Container Reference

**What goes wrong:** Each section's `VirtualizedBacklogTable` (now div-based) creates its own `useVirtualizer` instance. If `getScrollElement` points to a local section wrapper instead of the page scroll container (`scrollRef`), the virtualizer reads scroll position from the wrong element and renders nothing or renders incorrectly.

**Why it happens:** The pattern looks natural — "each section scrolls itself." But the page is one long scrollable div; sections don't have independent scroll regions.

**How to avoid:** Pass `scrollRef` (the outer `ref={scrollRef}` div in BacklogPage) down to each section's table component as `scrollElement`, exactly as it is today. No change needed — just preserve the existing prop threading.

**Warning signs:** Virtual rows don't appear, or all rows overlap at the top of each section.

### Pitfall 2: BacklogPage Test Breakage from Query Split

**What goes wrong:** `BacklogPage.test.tsx` mocks `fetchBacklogView` with a hardcoded return value containing `sprints` and `backlog`. After the split, BacklogPage no longer calls `fetchBacklogView` — it calls `fetchSprintStories`, `fetchSprintList`, and `fetchBacklogIssues`. All existing test mocks break.

**Why it happens:** The tests mock at the service layer, not at the query layer. When the query functions change, all mocks must update.

**How to avoid:** Update all BacklogPage test mocks as part of this phase. The new mock structure is:
- `fetchSprintStories` → returns sprint story issues
- `fetchSprintList` → returns sprint list (ordered sprint objects)
- `fetchBacklogIssues` → returns unsprinted issues
- Remove `fetchBacklogView` mock entirely

**Warning signs:** Test suite fails with "fetchBacklogView is not called" or sections never render in tests because no mock matches the new query function.

### Pitfall 3: `<tr>` `ref` Contract in BacklogRow

**What goes wrong:** `BacklogRow` is declared as `React.forwardRef<HTMLTableRowElement, BacklogRowProps>`. After converting to `<div>`, the ref type must change to `HTMLDivElement`. Any test or parent that passes a `ref` and type-checks it against `HTMLTableRowElement` will have a TypeScript error.

**Why it happens:** The generic type parameter in `forwardRef` is tied to the rendered element type.

**How to avoid:** Update the forwardRef type annotation to `React.forwardRef<HTMLDivElement, BacklogRowProps>` when converting the row. Update `rowRefs` in BacklogPage from `Map<string, HTMLTableRowElement>` to `Map<string, HTMLDivElement>`. The `scrollIntoView` call still works — it's a method on all `HTMLElement` subtypes.

**Warning signs:** TypeScript compile errors on `rowRefs.current.set(issue.key, el)` where `el` is typed as `HTMLDivElement | null` but the map expects `HTMLTableRowElement`.

### Pitfall 4: Optimistic Mutation Against Stale Query Keys

**What goes wrong:** `handleMoveToSprint` currently manipulates `queryClient.setQueryData(['jira-backlog-view', ...])`. After the split, that key no longer exists in cache. The optimistic update silently does nothing; issues don't disappear from the UI until the next refetch.

**Why it happens:** Query key references embedded in mutation handlers are not type-checked.

**How to avoid:** Update `handleMoveToSprint` to use `queryClient.setQueryData(['jira-backlog-issues', ...])` for backlog section optimism. Invalidate `jira-sprint-stories` and `jira-sprint-list` on success (no optimistic update needed for sprint sections since move-to-sprint goes from backlog → sprint, and the sprint stories query will naturally show the new issue on next refetch).

### Pitfall 5: `estimateSize` Not Accounting for Density

**What goes wrong:** A fixed `estimateSize: () => 44` causes scroll position errors when the user has compact density enabled (rows are ~28px, but virtualizer thinks 44px). The scroll container is the wrong height, causing items to appear at incorrect offsets.

**Why it happens:** The `estimateSize` callback is not reactive to density changes unless explicitly wired.

**How to avoid:** Read `density` from `useSettingsStore` inside the component that creates the virtualizer, and pass a `useCallback`-memoized `estimateSize` that branches on density. Values per UI-SPEC: compact=28px, default=36px, comfortable=44px.

---

## Code Examples

### fetchSprintList — new service function
```typescript
// Source: extracted from existing fetchBacklogView in backlog.ts
// Returns sprint list ordered by board order (Jira canonical), including empty sprints.
export async function fetchSprintList(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraActiveSprint[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await apiFetch(
    'jira',
    `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
    { headers },
    'Load Sprint List',
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.values ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as number,
    name: String(s.name ?? ''),
    state: String(s.state ?? '').toLowerCase() as 'active' | 'future' | 'closed',
    startDate: typeof s.startDate === 'string' ? s.startDate : undefined,
    endDate: typeof s.endDate === 'string' ? s.endDate : undefined,
    originBoardId: typeof s.originBoardId === 'number' ? s.originBoardId : undefined,
  }));
}
```

### useVirtualizer with div rows (per section)
```typescript
// Source: @tanstack/react-virtual v3 documentation pattern, adapted for this component
// Enable virtualization is now unconditional (D-05)
const rowVirtualizer = useVirtualizer({
  count: filteredIssues.length,
  getScrollElement: () => scrollElement,   // outer page scroll container
  estimateSize,                             // density-aware callback
  overscan: 5,
});

return (
  <div>
    {/* Header row — NOT virtualized */}
    <div className="grid grid-cols-[32px_96px_auto_1fr_56px_40px] border-b bg-muted/10">
      {/* ... column headers ... */}
    </div>
    {/* Virtual scroll container */}
    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const issue = filteredIssues[virtualRow.index];
        return (
          <BacklogRow
            key={issue.key}
            ref={(el) => {
              if (el) rowRefs.current.set(issue.key, el);
              else rowRefs.current.delete(issue.key);
            }}
            issue={issue}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            // ... other props
          />
        );
      })}
    </div>
  </div>
);
```

### BacklogRow epic cell with per-row Skeleton
```tsx
// Source: BacklogRow.tsx existing epic cell + UI-SPEC Skeleton spec
{/* Epic badge cell — right after key */}
<div className="px-2 py-2 density-compact:py-1 density-comfortable:py-3 whitespace-nowrap">
  {epicKey ? (
    epicsLoading ? (
      <Skeleton className="h-4 w-14 rounded-full" />
    ) : epicName && epicColorResult ? (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onIssueClick(epicKey); }}
        className={cn('inline-flex items-center rounded-full border px-1.5 py-0 text-[11px] font-medium hover:opacity-80 transition-opacity', epicColorResult.className)}
        style={epicColorResult.style}
        title={`${epicKey}: ${epicName}`}
      >
        {epicName}
      </button>
    ) : null
  ) : null}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useVirtual = false` workaround | Div-based rows enabling actual virtualization | Phase 47 | DOM node count drops from O(n) to O(viewport/rowHeight + overscan) |
| Header-only epic Skeleton (`epicsLoading` → header cell) | Per-row epic cell Skeleton (LOAD-04 completion) | Phase 47 | Every row shows loading state for epic, not just the column header |
| Monolithic `fetchBacklogView` query | Three independent per-section queries | Phase 47 | First section renders ~2x faster; subsequent sections progressive |
| `<table>/<tr>/<td>` for backlog rows | `<div>` CSS grid rows | Phase 47 | Required for `position: absolute` virtualization to work |

**Deprecated/outdated in this phase:**
- `fetchBacklogView` (from `backlog.ts`): No longer called by BacklogPage after split. The function can remain exported for backward compatibility (it has tests) but is no longer the primary data fetcher.
- `BacklogViewData` type: Callers no longer receive this type from BacklogPage. Internal to `backlog.ts` or can be retained for `fetchBacklogView` test fixtures.

---

## Open Questions

1. **Sprint list query deduplication vs sprint stories**
   - What we know: `jira-sprint-stories` gives us the issues; `jira-sprint-list` gives us the ordered list of all sprints (including empty). These are two separate queries.
   - What's unclear: Whether to merge sprint list + sprint stories in the component or in a dedicated hook.
   - Recommendation: Merge in the component with a `useMemo` — derive `orderedSprints` from `sprintList` + `sprintStories` grouped by sprint ID. No new hook needed.

2. **Error state per section vs unified error**
   - What we know: UI-SPEC specifies an `ErrorState` component per section with retry affordance.
   - What's unclear: Which query should the retry button invalidate for sprint sections — `jira-sprint-list`, `jira-sprint-stories`, or both?
   - Recommendation: Invalidate both sprint queries on retry (they're small, fast, and related). Backlog section retry invalidates `jira-backlog-issues` only.

3. **`fetchBacklogView` test suite**
   - What we know: `backlog.test.ts` has comprehensive coverage of `fetchBacklogView`. After the split, the function is no longer called by BacklogPage.
   - What's unclear: Whether to delete `fetchBacklogView` or keep it.
   - Recommendation: Keep `fetchBacklogView` and its tests intact — it's a stable, tested function. Only BacklogPage stops calling it. The tests remain as regression coverage for the function itself.

---

## Environment Availability

Step 2.6: SKIPPED — this is a code/config-only refactor. No external tools, services, runtimes, or CLI utilities beyond the existing project stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Testing Library React 16.x |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx src/services/jira/backlog.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAD-04 | Per-row epic Skeleton shown while allEpics pending | unit (render) | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — needs new test case added |
| LOAD-04 | Epic badge replaces Skeleton without layout shift (same h-4 height) | unit (render) | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — needs new test case added |
| LOAD-04 | No Skeleton shown on rows with no epic key | unit (render) | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — needs new test case added |
| D-01/D-03 | Backlog section renders from `fetchBacklogIssues` independently | unit (render) | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — existing tests need mock update |
| D-02 | Sprint sections render from `fetchSprintStories` cache | unit (render) | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — existing tests need mock update |
| D-04 | Div-based rows render with `position: absolute` style | unit (render) | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ❌ — Wave 0 |

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx src/services/jira/backlog.test.ts`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test case in `BacklogPage.test.tsx` — verifies per-row Skeleton appears when `epicsLoading=true` and issue has an epic key (covers LOAD-04)
- [ ] New test case in `BacklogPage.test.tsx` — verifies no Skeleton when `epicsLoading=true` and issue has NO epic key
- [ ] New test case in `BacklogPage.test.tsx` — verifies div-based row renders correctly (no `<tr>` in DOM)
- [ ] Update all existing `BacklogPage.test.tsx` mocks: replace `fetchBacklogView` mock with `fetchSprintStories` + `fetchSprintList` + `fetchBacklogIssues` mocks
- [ ] New test for `fetchSprintList` in `backlog.test.ts` — covers the new service function

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in the project root. No project-level constraints file found. Constraints are sourced from CONTEXT.md (locked decisions above) and the established patterns visible in the codebase.

**Observed inviolable conventions from codebase:**

- All paginated queries MUST use `fetchAllSearchPages` — never a single `maxResults` call without checking `total` (Phase 45 D-10, explicitly stated as non-negotiable)
- `STALE_TIME_MS` and `POLL_INTERVAL_MS` from `query-constants.ts` must maintain `STALE_TIME_MS < POLL_INTERVAL_MS` invariant (comment in file)
- shadcn `Skeleton` primitive (`bg-accent, animate-pulse, rounded-md`) — never raw divs with `animate-pulse` (Phase 44 D-03)
- Density variants use Tailwind variant syntax `density-compact:` and `density-comfortable:` — not inline style checks (see `index.css` variant definitions)
- `useDelayedLoading` hook for all skeleton display decisions — no direct use of `isLoading` in render conditions for Skeletons
- TanStack Query v5 API: `isPending` (not `isLoading`) for queries that have never fetched; `isLoading` = `isPending && isFetching`

---

## Sources

### Primary (HIGH confidence)

- Direct source read — `taskflow/src/routes/dashboard/BacklogPage.tsx` — current query structure, disabled virtualization code, section renderer
- Direct source read — `taskflow/src/services/jira/backlog.ts` — `fetchBacklogView`, `fetchBacklogIssues` implementations
- Direct source read — `taskflow/src/routes/dashboard/BacklogRow.tsx` — current `<tr>` structure, epic cell logic, `forwardRef` signature
- Direct source read — `taskflow/src/hooks/useDelayedLoading.ts` — 200ms skeleton delay pattern
- Direct source read — `taskflow/src/lib/query-constants.ts` — `STALE_TIME_MS`, `POLL_INTERVAL_MS` values
- Direct source read — `taskflow/src/stores/settings.store.ts` — `Density` type, `density` state
- Direct source read — `taskflow/src/services/theme.ts` — `data-density` attribute application
- Direct source read — `taskflow/src/index.css` — `density-compact` / `density-comfortable` Tailwind variant definitions
- Direct source read — `.planning/phases/47-optimize-backlog-view-performance-with-progressive-loading/47-UI-SPEC.md` — column widths, Skeleton spec, density estimated heights
- Direct source read — `taskflow/src/routes/dashboard/BacklogPage.test.tsx` — existing test structure, mock patterns
- Direct source read — `taskflow/src/services/jira/backlog.test.ts` — existing backlog service test structure
- Direct source read — `taskflow/vitest.config.ts` + `taskflow/src/test/setup.ts` — test infrastructure
- Package.json — `@tanstack/react-virtual ^3.13.23`, `@tanstack/react-query ^5.90.21`, `vitest ^4.0.18`

### Secondary (MEDIUM confidence)

- Phase 44 CONTEXT.md — D-06 (backlog parallel render-as-resolves), D-07 (useDelayedLoading)
- Phase 45 CONTEXT.md — D-03 (useBoardId), D-04/D-05 (backlog parallelization, epic cache separation)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages already installed and in use, versions verified from package.json
- Architecture: HIGH — patterns directly derived from existing code; no speculation
- Pitfalls: HIGH — all pitfalls directly identified from reading the existing code (the bugs are visible)
- Test requirements: HIGH — existing test file structure read directly, gaps are concrete

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable libraries, internal refactor — no external API changes expected)
