# Phase 93: Releases list and detail redesign - Pattern Map

**Mapped:** 2026-10-29
**Files analyzed:** 14 new/modified (plus tests)
**Analogs found:** 13 / 14

All paths below are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` (so `src/...` = `taskflow/taskflow/src/...`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/release-list.ts` (new) | utility (pure) | transform | `src/lib/aio-cycle-list.ts` | role-match |
| `src/lib/release-list.test.ts` (new) | test | transform | `src/lib/aio-cycle-list.ts` sibling test (same dir) | role-match |
| `src/services/jira.ts` (+`fetchVersionsStatusBreakdown`) | service | batch / paginated request-response | `fetchFixVersionIssues` (jira.ts:1345-1387) | exact |
| `src/lib/release-refresh.ts` (new) | utility | request-response (staged invalidate) | `src/lib/aio-refresh.ts` | exact |
| `src/components/release/ReleaseStatusPill.tsx` (new) | component | transform | `AioCycleList.tsx:339-349` | exact |
| `src/components/release/ReleaseIssueGraph.tsx` (new) | component | transform | `AioCycleList.tsx` `ProgressCell` (89-165) | exact |
| `src/routes/dashboard/ReleasesTab.tsx` (rewrite) | component (list page) | request-response, lazy streaming | `src/routes/dashboard/AioCycleList.tsx` + current ReleasesTab | exact (grid), self (data) |
| `src/routes/dashboard/ReleasesSkeleton.tsx` (restyle) | component | transform | `AioCycleList.tsx` `SkeletonRows` (167-188) | exact |
| `src/routes/dashboard/release-detail/ReleaseHeader.tsx` (replace `ReleaseTitleHeading`) | component | request-response | `ReleasesTab` row + `ReleaseDetailPage.tsx:303-351` action row | role-match |
| `src/routes/dashboard/ReleaseDetailPage.tsx` (modify) | component (page) | request-response | self | self |
| `src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` (modify) | component | transform | self (lines 295-335) | self |
| `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` (modify ~L37, 951, 1000-1060) | component | transform | self | self |
| `src/routes/dashboard/release-detail/useEditRelease.ts` (modify ~L165) | hook | mutation / cache invalidation | self | self |
| Tests: `ReleasesTab*.test.tsx`, `ReleaseHeader.test.tsx`, `ReleaseDetailSidebar.test.tsx`, `UnifiedTaskTable.test.tsx`, `jira.versionsBreakdown.test.ts`, `release-refresh.test.ts`, graph/pill tests | test | - | sibling tests of the file being changed | role-match |

No analog needed: none truly missing. Closest to "no analog": the batch query hook shape (chunked per-reveal keys) has no existing example; use RESEARCH.md "Pattern: batched, chunked, fully paginated search".

## Pattern Assignments

### `src/services/jira.ts` - add `fetchVersionsStatusBreakdown` (service, paginated batch)

**Analog:** `fetchFixVersionIssues`, `src/services/jira.ts:1345-1387`. Edit this legacy file, not `services/jira/` modules (memory: jira.ts dual-file). Do NOT change `fetchVersionIssueCounts` (1295-1328); detail still uses it.

**Id guard + headers + no-subtask-exclusion comment** (1296-1309):
```typescript
const base = baseUrl.replace(/\/$/, '');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
if (!/^\d+$/.test(versionId)) throw new Error(`Invalid versionId: ${versionId}`);
// No subtask exclusion here ... a subtask carrying this fix version directly must be counted like any other issue.
const baseJql = `fixVersion = ${versionId}`;
```

**Pagination loop** (1369-1386), copy exactly (terminates on `total` or empty page, no page cap):
```typescript
const maxResults = 200;
let startAt = 0;
const allIssues: JiraIssue[] = [];
while (true) {
  const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${maxResults}&startAt=${startAt}`;
  const resp = await apiFetch('jira', url, { headers }, 'Load Release Issues');
  if (!resp.ok) throw new Error(`Failed to fetch issues: status ${resp.status}`);
  const data = (await resp.json()) as { issues: JiraIssue[]; total: number };
  const before = allIssues.length;
  allIssues.push(...data.issues);
  if (allIssues.length >= data.total || allIssues.length === before) break;
  startAt = allIssues.length;
}
```
Adapt: `jql = fixVersion in (${ids.join(',')})`, `fields=status,fixVersions`, reduce each issue into `out[fv.id][new|indeterminate|done]` for every `fixVersions` entry in the requested set (full skeleton in RESEARCH.md "Code Examples"). Use a distinct `apiFetch` label, e.g. 'Load Release Issue Status'.

---

### `src/lib/release-refresh.ts` (utility, staged invalidate)

**Analog:** `src/lib/aio-refresh.ts:1-28` (`refreshAioCycleList`).

**Core pattern** (lines 12-28):
```typescript
export async function refreshAioCycleList(queryClient: QueryClient, jiraBaseUrl: Base, projectKey: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'folders', projectKey] }),
    ...
  ]);
  await queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey] });
  await queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey] });
}
```
Mirror: stage 1 `Promise.all([['jira-fix-versions', project], ['rm-week-list']])`; stage 2 `['rm-week-children']` and `['jira-version-counts','batch']` (batch keys depend on fix-version ids from stage 1). Keep the JSDoc explaining why stages are awaited. Verify the RM query keys in `src/hooks/useRmWeekIndex.ts` before hardcoding (`useQuery`/`useQueries` at lines ~50+).

**Refresh button / handler** (analog `src/routes/dashboard/AioProjectOverviewPage.tsx:333-341, 355-367`):
```tsx
const [refreshing, setRefreshing] = useState(false);
const handleRefresh = async () => {
  setRefreshing(true);
  try { await refreshAioCycleList(queryClient, jiraBaseUrl, projectKey); }
  finally { setRefreshing(false); }
};
...
<span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
<button type="button" onClick={() => { void handleRefresh(); }} disabled={refreshing}
  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
  aria-label="Refresh cycles" title="Refresh cycles">
  <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
</button>
```
Use aria-label "Refresh releases". This replaces today's `ReleasesTab.tsx:342-353` button, which sets `isRefreshing` and blanks the list (delete `isRefreshing` and its effect, lines 80, 309-313).

---

### `src/components/release/ReleaseStatusPill.tsx` + pill model in `src/lib/release-list.ts` (component / pure)

**Analog (render):** `AioCycleList.tsx:339-349` - pill inside a flex parent, shared layout + tone:
```tsx
<div className={cn(COL.status, CELL_PADDING, 'pointer-events-none relative')}>
  <div className="flex">
    ...
    <span className={`${STATUS_PILL_LAYOUT_CLASS} ${tonePillClass('red')}`}>Overdue</span>
```
Imports (AioCycleList.tsx:23-28): `import { STATUS_PILL_LAYOUT_CLASS, tonePillClass } from '@/lib/statusStyles';` Do not add geometry classes (statusStyles.ts:70-77 comment). Tones available: blue, green, red, orange, amber, purple, muted (statusStyles.ts:125-133). Wrap in a flex div or let the component render `<div className="flex"><span/></div>` itself (memory: statusPillClass needs flex parent). `STATUS_PILL_LAYOUT_CLASS` has `min-w-[5.5rem]`, so the status column is `w-28`.

**Analog (model):** the old `getReleaseTimingLabel` at `ReleasesTab.tsx:48-58` is the thing to replace; do not copy its `new Date().toISOString().slice(0,10)` (UTC bug). Use `toLocalDateString(new Date())` from `src/lib/local-date.ts:18` and `addDaysKey(dateKey, n)` from `src/lib/aio-cycle-list.ts:256` for integer day math. Compute `today` inside the component (React Compiler pitfall), pass into the pure `releasePill(v, today)`; RESEARCH.md has the exact precedence code.

**Pure ordering helper** - port from `ReleasesTab.tsx:267-278`, unchanged semantics (D-04):
```typescript
const dateDesc = (a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
const undated = versions.filter((v) => !v.released && !v.releaseDate);
const unreleased = versions.filter((v) => !v.released && !!v.releaseDate).sort(dateDesc);
const released = versions.filter((v) => v.released).sort(dateDesc);
```
Upcoming = `[...undated, ...unreleased]`. Note `.sort` mutates the filtered copy only (safe); do not sort `fixVersions` itself (shared cache object).

---

### `src/components/release/ReleaseIssueGraph.tsx` (component, transform)

**Analog:** `AioCycleList.tsx:89-165` `ProgressCell`.

**Skeleton / empty / loaded states** (98-115): loading with no data -> `<Skeleton className="h-1.5 w-20 rounded-full" />` inside the same fixed-width wrapper; no data -> `—`. Keep identical wrapper width in all states (D-09 no layout shift).

**Bar + tooltip** (124-163):
```tsx
<Tooltip>
  <TooltipTrigger delay={0} render={<div />} data-testid="progress-bar" role="img"
    aria-label={...} className="relative z-10 w-20 py-1 -my-1">
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {segments.map((k) => (
        <div key={k} className={cn('h-full', PROGRESS_SEGMENT_CLASS[k])}
             style={{ width: `${(counts[k] / total) * 100}%` }} />
      ))}
    </div>
  </TooltipTrigger>
  <TooltipContent>
    <TooltipBody title={`${total} tests`}>
      {rows.map((r) => <TooltipRow key={r.label} color={r.color} label={r.label} value={r.value} sub={`${Math.round((r.value / total) * 100)}%`} />)}
    </TooltipBody>
  </TooltipContent>
</Tooltip>
<span className="pointer-events-none relative w-9 text-right text-xs tabular-nums text-muted-foreground">
```
Imports (AioCycleList.tsx:10-11, 18-19): `Skeleton`, `Tooltip/TooltipContent/TooltipTrigger` from `@/components/ui/tooltip`, `TooltipBody/TooltipRow` from `@/components/ui/tooltip-body`, `PROGRESS_SEGMENT_CLASS` from `@/lib/aio-cycle-list`.

Map Jira categories onto `PROGRESS_SEGMENT_CLASS` (aio-cycle-list.ts:75-81): done -> `pass` (`bg-green-500`), indeterminate -> `inProgress` (`bg-blue-500`), new -> `notRun` (`bg-muted`). `progressTooltipRows` (142-159) is AIO-labelled ("Passed", "Not run"); write a small release tooltip-rows helper in `release-list.ts` returning the same `TooltipRowData { label, value, color }` shape (aio-cycle-list.ts:135-139) with colours `var(--color-green-500)`, `var(--color-blue-500)`, `var(--color-muted-foreground)`; max 3 rows plus optional title total (<= 4 rows). aria-label per RESEARCH: "{done} of {total} issues done"; zero issues -> "No issues" muted track. Provide a size/variant prop (list `w-20`, detail wide + "N / M done" text). Tooltip trigger needs `relative z-10` because rows use overlay buttons.

---

### `src/routes/dashboard/ReleasesTab.tsx` (rewrite; list page)

**Analog (grid / rows):** `src/routes/dashboard/AioCycleList.tsx`.

**Column + padding constants** (38-51), re-define locally for releases:
```typescript
const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';
const COL = {
  key: 'flex-none w-28 pl-4 pr-2',
  name: 'flex-1 min-w-0 px-2',
  status: 'flex-none w-28 px-2',
  progress: 'flex-none w-36 px-2 flex items-center gap-2',
  dates: 'flex-none w-32 px-2 hidden @[720px]:flex items-center',
} as const;
```
Release columns: version `flex-1 min-w-0`, package `flex-none w-44` (hide at narrow via `hidden @[..]:flex`, and omit entirely when `!rmEnabled`), date `flex-none w-28`, status `flex-none w-28`, graph `flex-none w-44`. Container-query root wrapper `@container min-w-0` is the OUTER element (AioCycleList.tsx:471, 478); never style the container itself with `@` variants.

**Header strip** (455-465):
```tsx
<div className="flex w-full items-center border-b border-border text-xs font-medium text-muted-foreground">
  <div className={cn(COL.key, CELL_PADDING)}>Key</div> ...
```
Group labels "Upcoming"/"Released" use the lighter sub-divider style from 438-444 (`flex min-h-9 items-center gap-2 px-4 py-1.5`, `border-b border-border/50`) with a count `text-xs tabular-nums text-muted-foreground`.

**Overlay-button row** (298-323, 333-338):
```tsx
<div key={...} className="group/row relative flex w-full items-center border-b border-border transition-colors hover:bg-muted/30">
  <button type="button" aria-label={`Open ${d.key} ${d.title}`}
    className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
    onClick={() => openCycle(d.key)} />
  <div className={cn(COL.name, CELL_PADDING, 'pointer-events-none relative truncate text-sm')} title={d.title}>
```
Every content cell: `pointer-events-none relative`. Row keeps `data-testid="release-row"` (existing tests). The tooltip trigger in the graph cell must NOT be pointer-events-none (see ProgressCell `relative z-10`). This replaces the current invalid button-containing-`<a>` row (ReleasesTab.tsx:413-614).

**Keep from current ReleasesTab** (do not rewrite):
- Breadcrumb seeding (ReleasesTab.tsx:66-73):
```typescript
const breadcrumbPush = useBreadcrumbStore((s) => s.push);
const breadcrumbReset = useBreadcrumbStore((s) => s.reset);
const handleReleaseClick = (versionId: string) => {
  breadcrumbReset();
  breadcrumbPush({ path: '/releases', label: 'Releases' });
  navigate(`/release/${versionId}`);
};
```
- Token read effect for Jira only (87-93); delete the GitLab token effect (95-101).
- Fix versions query (112-124), unchanged key/queryFn (shared cache key):
```typescript
queryKey: ['jira-fix-versions', activeJiraProject],
queryFn: () => fetchFixVersions(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
staleTime: 5 * 60_000,
```
- `jira-projects-rm` active project name query (104-110).
- RM lazy path (283-300): `useRmWeekIndex({ dates: [...visible].map(v => v.releaseDate) })` and `derivePackage` using `findWeekForDate`, `findChildForProject`, `formatWeekLabel`; cell markup 586-607 (`data-testid="row-deployment-package"`, week label + `font-mono text-muted-foreground` key, title tooltip). Add the "week, no child muted" and "no week dash" states per CONTEXT discretion.
- Released paging constants (60-61): `RELEASED_PAGE_SIZE = 5`, `RELEASED_LOAD_MORE = 10`; load-more button 619-628 (restyle to "Show N more"). The batch chunking must follow the same 5/10/10 steps.
- Error / stale / empty handling (359-380, 388-392): `ErrorState` (`viewName="releases"`), `StaleDataBanner`, `EmptyState icon={Rocket}`; skeleton gating `useDelayedLoading(isLoading)` only (drop `|| isRefreshing`).

**Delete**: all imports/uses of `fetchProjectMilestonesInRange`, `fetchProjectBranches`, `matchGitLabToFixVersion`, `ReleaseMatch`, `deriveReleaseBranchName`, `RELEASE_BRANCH_PREFIX`, `useQueries` count fan-out (190-198), `milestoneWindow` (126-140), `Badge`, `AlertTriangle`, `GitBranch`, "GitLab unavailable" chips (324-340), `gitlabBaseUrl/activeGitlabProject` from the store destructure.

**New batch hook (no direct analog):** per-chunk `useQuery`/`useQueries` with key `['jira-version-counts', 'batch', <sorted ids joined>]`, `enabled: !!jiraBaseUrl && !!jiraToken && ids.length > 0`, `staleTime: 5 * 60_000`. Chunk 0 = all Upcoming ids; then released ids in 5/10/10 reveal steps so earlier chunk keys never change (memory: query-key churn blink; disabled-query `isPending` forever -> guard loading flags with `isFetching`/`enabled`). Assemble `Map<versionId, StatusBreakdown>` from chunk results.

---

### `src/routes/dashboard/ReleasesSkeleton.tsx` (restyle)

**Analog:** `AioCycleList.tsx:167-188`:
```tsx
<div className="flex w-full items-center border-b border-border">
  <div className={cn(COL.key, CELL_PADDING)}><Skeleton className="h-4 w-16" /></div>
  <div className={cn(COL.name, CELL_PADDING)}><Skeleton className="h-4 w-2/3" /></div>
  <div className={cn(COL.status, CELL_PADDING)}><Skeleton className="h-5 w-16 rounded-full" /></div>
  <div className={cn(COL.progress, CELL_PADDING)}><Skeleton className="h-1.5 w-20 rounded-full" /></div>
</div>
```
Keep `data-testid="skeleton-row"` (current file uses it, `ReleasesSkeleton.tsx:8`). Share `COL` via an exported const from a small module so skeleton, header and rows line up.

---

### `src/routes/dashboard/release-detail/ReleaseHeader.tsx` (replace `ReleaseTitleHeading`, lines 48-63)

**Current:** `ReleaseBreadcrumbHeader` (1-46) stays untouched. `ReleaseTitleHeading` (53-63) is the rocket + `v{id}` + `<h2 className="text-xl font-semibold leading-snug">`.

**Actions to relocate** from `ReleaseDetailPage.tsx:303-351` (copy verbatim, then delete the old block):
```tsx
<Button variant="outline" size="sm" className="gap-1.5 text-xs"
  aria-label={pinned ? 'Unpin release' : 'Pin release'} title={pinned ? 'Unpin release' : 'Pin release'}
  onClick={() => {
    if (pinned) { removePin(releaseKey); clearReleaseMeta(releaseKey); }
    else {
      togglePin(releaseKey);
      setPinnedReleaseMeta(releaseKey, { name: version.name, versionId: versionId ?? '', projectKey: activeJiraProject ?? '' });
    }
  }}>
  <Pin className={`size-3.5${pinned ? ' fill-current text-primary' : ''}`} />
  {pinned ? 'Unpin' : 'Pin'}
</Button>
{jiraVersionUrl ? (<LinkContextMenu href={jiraVersionUrl}><Button ... onClick={handleOpenInJira}><ExternalLink className="size-3.5" />Open in Jira</Button></LinkContextMenu>) : (<Button ...>...)}
```
Edit button moves from sidebar `ReleaseDetailSidebar.tsx:303-312` (`variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={onStartEditing}` + `<Pencil className="size-3" />`). Keep Pin/Edit state logic in the page and pass handlers/props to the header (header stays presentational), keeping aria-labels 'Pin release'/'Unpin release' so existing tests hold. Header body reuses `ReleaseStatusPill`, date text (`text-xs tabular-nums text-muted-foreground`), the RM package node (extract the `derivePackage` cell from ReleasesTab into a shared `ReleasePackageCell`), and the wide `ReleaseIssueGraph`. Header actions container: `flex items-center gap-2` right-aligned, wrapping at narrow widths (container query on outer wrapper only).

---

### `src/routes/dashboard/ReleaseDetailPage.tsx` (modify)

- Line 246: replace `<ReleaseTitleHeading .../>` with the new header. 
- Lines 303-351: delete the "Action buttons" block (moved).
- Lines 238-240: gating `isLoading || !version ? <ReleaseDetailSkeleton/>`; render the header whenever `version` is derived from the cached `jira-fix-versions` data, and stream the sections beneath (per-section placeholders; P91.1 D-17 precedent).
- Line 274: remove `issueCounts={issueCounts}` from `<UnifiedTaskTable>` once the prop is dropped.
- Line 363: remove `onStartEditing={startEditing}` from the sidebar (pass to header instead). Keep `EditReleaseModal` (395-419) as is.
- `issueStatusCounts` (line 389 prop) is the single source for the header graph ("one source" rule); `issueCounts` currently passed to the table can seed nothing else, check `useReleaseDetail.ts` before removing its `['jira-version-counts', versionId]` query (still used by the detail and mutations).

---

### `src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` (modify, 295-335)

Delete the Edit button block (303-312, keep `<h3 className="text-sm font-medium">Details</h3>`), `MetaRow label="Status"` (315-321) and `MetaRow label="Date"` (323-331). Remove now-unused imports (`Pencil`, `Calendar`, `Badge` if unused) and the `onStartEditing` prop (line 234 type, 263 destructure). `MetaRow` rows from "Milestone" onward remain.

---

### `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` (modify)

- Line 37 type `issueCounts`, line 951 destructure: remove the prop.
- Lines 1000-1004: delete the `{issueCounts && (<Badge ...>N / M done</Badge>)}` block. KEEP `<h3 className="text-sm font-medium text-muted-foreground">Issues</h3>` (or restyle heading) and the flagged badges (`data-testid="flagged-br-badge"`, `"flagged-ms-badge"`, lines 1005-1049) exactly.
- Lines 1052-1060: delete the `{/* Progress bar (Jira-driven) */}` `<Progress ...>` block; remove the `Progress` import (line 8) if unused.
- Update `UnifiedTaskTable.test.tsx` in the same commit (pre-commit runs the full suite).

---

### `src/routes/dashboard/release-detail/useEditRelease.ts` (modify, ~163-166)

Existing:
```typescript
if (jiraPromise && jiraResult.status === 'fulfilled') {
  queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] });
  queryClient.invalidateQueries({ queryKey: ['jira-version-counts', versionId] });
}
```
Add `queryClient.invalidateQueries({ queryKey: ['jira-version-counts', 'batch'] });` (prefix), since the per-version key does not reach the batch key. Other invalidators (`FieldsSection`, `useFieldMutation`, `parentCompletion`) already use the bare prefix `['jira-version-counts']`, so `'batch'` as the second key element (non-numeric) is reached by them.

---

## Shared Patterns

### Shared fetcher cache key
**Source:** `ReleasesTab.tsx:120` / memory "Shared fetcher cache key".
**Apply to:** anything touching `['jira-fix-versions', project]`. Do not change shape or `select`; group/sort client-side. Keep `['jira-version-counts', versionId]` for the detail.

### Overlay row button + non-interactive cells
**Source:** `AioCycleList.tsx:318-338`. **Apply to:** list rows; any new clickable row.

### Fixed-width cells, flex rows (no table)
**Source:** `AioCycleList.tsx:43-51`. **Apply to:** list header, rows, skeleton. Explicit-px `flex-none` cells; `flex-1 min-w-0` on the expander (WebKit 0-width collapse memory).

### Loading without blanking
**Source:** `useDelayedLoading` use at `ReleasesTab.tsx:309`. **Apply to:** list. `isLoading` in TanStack v5 is `isFetching && isPending`, so cached data never skeletons; drop `isRefreshing`.

### Tooltips
**Source:** `AioCycleList.tsx:125-158`. **Apply to:** graph. <= 4 rows, no legends, colour = status only.

### Local date handling
**Source:** `src/lib/local-date.ts:18` (`toLocalDateString`), `src/lib/aio-cycle-list.ts:256` (`addDaysKey`). **Apply to:** pill model; never `toISOString().slice(0,10)`.

### Input validation
**Source:** `jira.ts:1303` `/^\d+$/` guard. **Apply to:** `fetchVersionsStatusBreakdown` (validate every id before JQL interpolation; `encodeURIComponent` the JQL).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Chunked per-reveal batch query hook (in `ReleasesTab.tsx` or `src/hooks/useReleaseIssueBreakdown.ts`) | hook | batch / lazy streaming | No existing chunk-per-reveal query. Use RESEARCH.md "Pattern: batched, chunked, fully paginated search" and the existing `useQueries` usage at `ReleasesTab.tsx:191-198` / `useRmWeekIndex.ts` as shape reference. |

## Tests to update/create (same-commit with code per pre-commit gate)

- Remove old list testids: `gitlab-link-*`, `row-missing-*`, `row-branch-present`, `branches-error-chip` (`src/routes/dashboard/ReleasesTab.test.tsx`). Add assertion that gitlab mocks are not called.
- Rewrite `src/routes/dashboard/ReleasesTab.versionCountsParity.test.tsx`: assert batch totals equal `fetchVersionIssueCounts` totals on a shared fixture.
- `ReleaseHeader.test.tsx`, `ReleaseDetailSidebar.test.tsx` (drop Status/Date), `UnifiedTaskTable.test.tsx` (drop "done" badge/progress, keep flagged badges), `ReleasesTab.deploymentPackage.test.tsx` (column hidden when RM disabled).
- New: `src/lib/release-list.test.ts`, `src/services/jira.versionsBreakdown.test.ts` (multi-page pagination, multi fixVersions grouping, id validation), `src/lib/release-refresh.test.ts`, graph/pill component tests.

## Metadata

**Analog search scope:** `src/routes/dashboard/`, `src/routes/dashboard/release-detail/`, `src/lib/`, `src/services/jira.ts`, `src/hooks/useRmWeekIndex.ts`, `src/components/ui`
**Files scanned/read:** ReleasesTab.tsx, AioCycleList.tsx, aio-refresh.ts, aio-cycle-list.ts (60-170), statusStyles.ts (70-160), jira.ts (1290-1387), ReleaseHeader.tsx, ReleaseDetailPage.tsx (200-464), ReleaseDetailSidebar.tsx (295-335), UnifiedTaskTable.tsx (990-1065), useEditRelease.ts (160-170), AioProjectOverviewPage.tsx (328-370), ReleasesSkeleton.tsx
**Pattern extraction date:** 2026-10-29
