# Phase 94: Release detail redesign - Pattern Map

**Mapped:** 2026-10-30
**Files analyzed:** 22 new/modified
**Analogs found:** 21 / 22

All paths are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` (so `src/...`). `.planning` is at the outer root. The UI-SPEC (94-UI-SPEC.md) wins over CONTEXT D-08/D-11 where they conflict (CycleHeader-style header, `Name: value` meta line).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/services/jira.ts` (`fetchFixVersionIssues` fields) | service | request-response | same function, the 261014-eym additive block (lines 1408-1418) | exact |
| `src/routes/dashboard/release-detail/releaseBurnup.ts` (+test) | utility | transform | `src/lib/epic-progress.ts` (`deriveTimeBurnup`, `doneDateKey`, `validKey`) | role-match |
| `src/routes/dashboard/release-detail/releaseBuckets.ts` (+test) | utility | transform | `src/lib/epic-progress.ts` `deriveAssigneeBuckets` / `deriveStatusBuckets` | exact |
| `src/routes/dashboard/release-detail/releaseSummaries.ts` (add `computeMrDonutCounts`) | utility | transform | `computeMrStateCounts` (same file, line 167) | exact |
| `src/routes/dashboard/release-detail/useReleaseDetail.ts` (additive returns) | hook | request-response | itself | exact |
| `src/lib/release-refresh.ts` (`refreshReleaseDetail`) | utility | batch | `refreshReleaseList` (same file) + `refreshAioCycleDetail` (`src/lib/aio-refresh.ts:36`) | exact |
| `src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx` | component | transform | `src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx` | role-match |
| `.../graphs/ReleaseMrDonut.tsx` | component | transform | `src/routes/dashboard/aio-cycle/AioDonut.tsx` | exact |
| `.../graphs/ReleaseAssigneeRows.tsx` | component | transform | `SegmentedBar` in `releases-list/ReleaseAgendaParts.tsx:43` + `ReleaseIssueGraph.tsx` | role-match |
| `.../graphs/ReleaseTypeWaffle.tsx` | component | transform | `ReleaseIssueGraph.tsx` (tooltip/segments) | partial |
| `.../graphs/GraphSlot.tsx` | component | request-response | `ReleaseIssuesSlot` (`ReleaseAgendaParts.tsx:~66`) | role-match |
| `src/routes/dashboard/release-detail/ReleaseHeader.tsx` (rewrite `ReleaseDetailHeader`) | component | request-response | `src/routes/dashboard/aio-cycle/CycleHeader.tsx` | exact |
| `src/routes/dashboard/release-detail/ReleaseFacts.tsx` (replaces Sidebar) | component | request-response | `release-detail/ReleaseDetailSidebar.tsx` (move) + `ReleasesHero` `Stat` | exact (move) |
| `src/routes/dashboard/release-detail/ReleaseDescription.tsx` | component | transform | `release-detail/DescriptionsSection.tsx` | role-match |
| `src/routes/dashboard/ReleaseDetailPage.tsx` | component (page) | request-response | `src/routes/dashboard/AioCycleDetailPage.tsx` | exact |
| `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` (`ColumnHeaderStrip` sticky) | component | transform | `aio-cycle/ExecutionsList.tsx:364` | exact |
| `src/routes/dashboard/release-detail/LabelSummarySection.tsx`, `DeploymentPackageSection.tsx` (heading restyle) | component | transform | themselves | exact |
| `src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx` | component | transform | itself (rebuild) + `AioDonutSkeleton` | role-match |
| `src/components/release/ReleaseIssueGraph.tsx` (drop `max-w-xl` via prop) | component | transform | itself | exact |
| `src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx` (export `SegmentedBar`) | component | transform | itself | exact |
| `src/stores/settings.store.ts` (+test) (remove `releaseDetailPanelWidth`, bump v32) | store | CRUD | its own migrate blocks (lines 376-502) | exact |
| `src/components/ui/issue-type-icon.tsx` (muted option) | component | transform | itself | exact |
| Tests: `ReleaseFacts.test.tsx` (port), `ReleaseHeader.test.tsx`, `ReleaseDetailPage.test.tsx`, `jira.fixVersionIssues.test.ts`, `release-refresh.test.ts` | test | n/a | `ReleaseDetailSidebar.test.tsx`, `ReleaseHeader.test.tsx` | exact / no analog for page test |

## Pattern Assignments

### `src/services/jira.ts` `fetchFixVersionIssues` (service, request-response)

**Analog:** same function, lines 1407-1418. Add the two fields in the same additive style; JQL and `ORDER BY created ASC, key ASC` stay byte-identical (`JiraIssue.fields.created` / `resolutiondate` are already typed).
```typescript
const jql = `fixVersion = ${versionId} ORDER BY created ASC, key ASC`;
const fields = [
  'summary', 'status', 'assignee', 'issuetype',
  ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  // Deployment-package sync (261014-eym): additive fields only, JQL/order unchanged.
  'customfield_15725',
  'fixVersions',
  'project',
  // P94 release burnup: additive only.
  'created',
  'resolutiondate',
].join(',');
```
Test (new `src/services/jira.fixVersionIssues.test.ts`): mock `apiFetch` (called as `apiFetch('jira', url, { headers }, 'Load Release Issues')`), assert the decoded `fields=` contains `created,resolutiondate` and that `jql` equals the unchanged string.

---

### `release-detail/releaseBurnup.ts`, `releaseBuckets.ts` (utility, transform)

**Analog:** `src/lib/epic-progress.ts`.

Imports/helpers to reuse (export what is private): `catOf` (line 83, exported), `dateKeyMs`, `timeTicks`, `addCalendarDays`, `formatDateKey` (exported). `validKey` (lines 67-71) is PRIVATE; export it or reimplement:
```typescript
function validKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const k = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : null;
}
```
Done-date rule to mirror (lines 124-134), with the D-16 deviation (no resolutiondate -> today, no `statuscategorychangedate`/`updated` fallback since those fields are not fetched; reopened = category not done => never counted):
```typescript
export function doneDateKey(s: JiraIssue, today: string): string | null {
  if (catOf(s) !== 'done') return null;
  const k = validKey(s.fields.resolutiondate) ?? /* ... */ today;
  // Jira timestamps carry the server offset; clamp so a late-night resolve can't land past local today.
  return k > today ? today : k;
}
```
Invariant to unit-test: last burnup point `done === issueStatusCounts.done` and `scope === total`. Scope = `max(createdKey, axisStart)`. Previous-version resolver: strict `<` on `releaseDate`, max date, any `released` state, `id !== version.id`.

Assignee buckets: reuse `deriveAssigneeBuckets(issues, 'count', spKey)` (lines 167-203): returns `{id,name,done,inProgress,todo,remaining,avatarUrl}`, keyed `user:${a.name||a.displayName}` with a distinct `'unassigned'` id. It sorts by `remaining` desc; UI-SPEC wants total desc, Unassigned last, so re-sort in `releaseBuckets.ts`. Type buckets: model on `deriveStatusBuckets` (lines 136-160) (Map keyed by `issuetype.name`, `catOf` per issue, `weightOf(s,'sp',spKey)` for tooltip SP).

---

### `release-detail/releaseSummaries.ts` (add `computeMrDonutCounts`) (utility, transform)

**Analog:** `computeMrStateCounts` lines 167-181 (keep it unchanged so its existing test stays green; add a sibling):
```typescript
export function computeMrStateCounts(releaseMrs: GitLabMR[]): { merged: number; opened: number; closed: number } {
  let merged = 0; let opened = 0; let closed = 0;
  for (const mr of releaseMrs) {
    if (mr.state === 'merged') merged += 1;
    else if (mr.state === 'opened') opened += 1;
    else closed += 1;
  }
  return { merged, opened, closed };
}
```
New function splits `opened` by `mr.draft` (RESEARCH "Code Examples"). Input = channel B `milestoneMRs` only.

---

### `src/lib/release-refresh.ts` (add `refreshReleaseDetail`) (utility, batch)

**Analog:** `refreshReleaseList` (file lines 9-22) and `refreshAioCycleDetail` (`src/lib/aio-refresh.ts:36-82`). Pattern: two awaited stages, upstream first (sources keyed by fix-versions/milestones), then dependents.
```typescript
export async function refreshReleaseList(queryClient: QueryClient, activeJiraProject: string | null | undefined): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] }),
    queryClient.invalidateQueries({ queryKey: ['rm-week-list'] }),
  ]);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['rm-week-children'] }),
  ]);
}
```
Stage 2 prefix set: copy from `release-detail/useEditRelease.ts` ~lines 160-180 and `mrChannelKeys.ts` (keys declared once there; do not hand-write channel keys). Keep `['jira-fixversion-issues', versionId]` as a prefix invalidation (key is `[versionId, spKey]`).

---

### `release-detail/graphs/ReleaseBurnup.tsx` (component, transform)

**Analog:** `src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx`. Takeaways: line 1 `'use no memo';`; `ChartContainer`/`ChartTooltip` from `@/components/ui/chart`; numeric `t` x-axis with explicit ticks; `isAnimationActive={false}`; error / not-fetching / loading branching.

**Imports pattern** (lines 11-14, 18-22):
```typescript
'use no memo';
import { useMemo, useRef } from 'react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { dateKeyMs, timeTicks } from '@/lib/epic-progress';
import { PLOT_MARGIN, useElementWidth, Y_AXIS_WIDTH } from '../issue-detail/EpicChartZoom'; // no zoom machinery
```
**Chart core** (lines 172-198):
```tsx
<div ref={plotRef} style={{ height: PLOT_HEIGHT }}>
  <ChartContainer config={{}} className="aspect-auto h-full w-full" aria-label="Epic time burnup chart">
    <ComposedChart data={view} responsive margin={PLOT_MARGIN}>
      <XAxis type="number" dataKey="t" scale="time"
        domain={[dateKeyMs(range.from), dateKeyMs(range.to)]} allowDataOverflow
        ticks={ticks.map((x) => x.t)}
        tickFormatter={(v) => ticks.find((x) => x.t === Number(v))?.label ?? tickLabel(v)}
        tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={Y_AXIS_WIDTH} />
      <ChartTooltip cursor={BAR_CURSOR} content={...} />
      <Line dataKey="logged" type="stepAfter" stroke={...} strokeWidth={...} dot={false} isAnimationActive={false} />
```
Use `type="stepAfter"` lines/areas for scope and done. NO forecast/`projectFinish`/band (D-04). TODAY / release-date markers: `ReferenceLine` as in `aio-cycle/CycleBurndown.tsx:232`. Tooltip: do NOT reuse `EpicChartTooltip` (epic-metric-specific); use the `SliceTooltip` shape from `AioDonut` (`TOOLTIP_SURFACE` + `TooltipBody` + `TooltipRow`, at most 4 rows). Error/empty copy style (lines 114-143): muted text, `italic` + `pr-0.5`, min-height set from slot height. Recharts gotchas: explicit `ticks` (otherwise hidden), `timeTicks` is UTC, tooltip `wrapperStyle={{ zIndex: 50 }}`.

---

### `graphs/ReleaseMrDonut.tsx` (component, transform)

**Analog:** `src/routes/dashboard/aio-cycle/AioDonut.tsx`. Reuse the component directly; only build `ChartSlice[]` for merged/open/draft/closed.

**Reuse** (AioDonut lines 56-98): props `{ slices, size = DONUT_SIZE, testId, ariaLabel, center }`; fixed-size `PieChart` (no ResponsiveContainer), `hover:z-50`, `Tooltip wrapperStyle={{ zIndex: 50 }}`, ring `INNER 0.36 / OUTER 0.48`, centre overlay via `center`. Loading/empty: `AioDonutSkeleton` (lines 104-128, `pulse` and a short child note).

`ChartSlice` shape (`src/lib/aio-cycle-charts.ts:12-21`): `{ key, label, value, share /* integer pct */, color, rows: ChartRow[] /* <=4 */ }`. Colours as literal `var(--color-...)` strings (lines 33-39: `'var(--color-green-500)'`, so Tailwind JIT emits them). Build slices following `executionSlices` (lines 50+): filter zero values, compute `share` via `pct`. Merged = green, open = blue, draft = muted gray, closed = red (status colours only; confirm against UI-SPEC).

---

### `graphs/ReleaseAssigneeRows.tsx` / `graphs/ReleaseTypeWaffle.tsx` (component, transform)

**Analog:** `SegmentedBar` (`routes/dashboard/releases-list/ReleaseAgendaParts.tsx:43-58`, PRIVATE: export it or extract to `components/release/SegmentedBar.tsx`; keep `ReleaseAgenda.test.tsx` green) and tooltip scaffolding of `components/release/ReleaseIssueGraph.tsx`.
```tsx
function SegmentedBar({ breakdown, className }: { breakdown: StatusBreakdown; className: string }) {
  const total = breakdownTotal(breakdown);
  return (
    <div data-testid="release-issues-bar" className={cn('flex flex-none overflow-hidden rounded-full bg-muted', className)}>
      {RELEASE_SEGMENT_ORDER.filter((k) => breakdown[k] > 0).map((k) => (
        <div key={k} className={cn('h-full', RELEASE_SEGMENT_CLASS[k])} style={{ width: `${(breakdown[k] / total) * 100}%` }} />
      ))}
    </div>
  );
}
```
Tooltip with SP detail (ReleaseIssueGraph lines 78-110): `<Tooltip><TooltipTrigger delay={0} render={<div />} role="img" aria-label=... className="relative z-10 ..."><TooltipContent><TooltipBody title=...>{rows.map(r => <TooltipRow key color label value sub />)}`. Segment colours/labels only via `RELEASE_SEGMENT_CLASS`, `RELEASE_SEGMENT_ORDER`, `releaseTooltipRows` (`src/lib/release-list.ts:38-64`).

Avatar: `CachedAvatar({ url, name, size = 32, className })` in `src/components/ui/cached-avatar.tsx:54`; pass explicit px `size` (0-width collapse gotcha). Type icon: `IssueTypeIcon` (`components/ui/issue-type-icon.tsx`) concatenates `${className} text-red-500` etc., so a passed muted class cannot win; add a `muted` prop (or `[&_svg]:!text-muted-foreground` wrapper) because colour = status only. Use `gap-*` grids, not `space-y-*` with negative margins.

---

### `graphs/GraphSlot.tsx` (component, request-response)

**Analog:** `ReleaseIssuesSlot` (`ReleaseAgendaParts.tsx` ~lines 66-110) + `ReleaseIssueGraph` states: fixed-height wrapper in every state so skeleton / empty / data occupy the same box (D-09 spirit); loading `Skeleton`, error muted + title (see `BreakdownErrorDash`, `ReleaseIssueGraph.tsx:19-31`), empty muted text (`"No issues yet"` style). Disabled v5 queries are `isPending` forever, so branch on data presence / `isFetching`, not `isPending`.

---

### `release-detail/ReleaseHeader.tsx` `ReleaseDetailHeader` (component, request-response)

**Analog:** `src/routes/dashboard/aio-cycle/CycleHeader.tsx`. Keep `ReleaseBreadcrumbHeader` verbatim.

**Structure to copy** (lines 125-181): outer `flex flex-none flex-col gap-1 px-6 pt-3 pb-2`; title row `h1 min-w-0 truncate text-lg font-semibold` + pill wrapper `<div className="flex flex-none">` (statusPillClass needs a flex parent); right cluster with refreshed label + icon-only refresh + outline `Button size="sm"` Pin:
```tsx
<span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
<button type="button" onClick={onRefresh} disabled={refreshing}
  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
  aria-label="Refresh cycle" title="Refresh cycle">
  <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
</button>
<Button variant="outline" size="sm" className="flex-none gap-1.5 text-xs" aria-label=... onClick={onTogglePin}>
  <Pin className={`size-3.5 ${pinned ? 'fill-current text-primary' : ''}`} />
```
**Meta line**: items array of `{ id, node }`, every item conditional so absent data renders neither element nor separator (lines 60-123, 163-179):
```tsx
{items.map((it, i) => (
  <Fragment key={it.id}>
    {i > 0 && <span aria-hidden className="text-border">·</span>}
    {it.node}
  </Fragment>
))}
```
with wrapper `flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground`; overdue date uses `text-red-600 dark:text-red-400` (line 88). Facts (ReleaseFacts) and RM package (hidden when RM unconfigured, P93 D-12) become items here. Reuse `ReleaseStatusPill`, `releaseHeaderPill(version, today)`, `dateStamp(key).inline`, `ReleasePackageCell`. "Refreshed" text: `` `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}` `` as in `AioCycleDetailPage.tsx:92-94`. Done bar: `ReleaseIssueGraph` (drop its `max-w-xl` wrapper, `ReleaseIssueGraph.tsx:47`, via a prop). Existing test `ReleaseHeader.test.tsx` asserts `release-status-pill` count 1, `release-detail-header`, `row-deployment-package` presence/absence: keep those testids.

---

### `release-detail/ReleaseFacts.tsx` (component, request-response)

**Analog:** `release-detail/ReleaseDetailSidebar.tsx` (move and adapt; port `ReleaseDetailSidebar.test.tsx` test-by-test BEFORE deleting). `Stat` look from `releases-list/ReleasesHero.tsx:23-38`:
```tsx
function Stat({ icon: Icon, className, children }: { icon: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span data-testid="releases-stat" className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
      <span className="font-medium">{children}</span>
    </span>
  );
}
```
Move verbatim (private in Sidebar): `RowAction` (lines 28-54, outline `h-6 gap-1 px-2 text-xs` Button), `RowUnavailable` (56-58), `assertNeverBranchState` + `BranchRowContent` (exhaustive switch, keep the `never` guard), `formatEvidenceDate` / `formatVerdictDate` imports from `./mergeBackVerification`. Milestone link pattern to keep (lines ~300-330): `LinkContextMenu href` wrapping `<button onClick={() => openExternal(url)} data-testid="gitlab-link-exact">`; fuzzy variant `border-b border-dashed border-muted-foreground` + `title="Fuzzy match: {name}"` + `data-testid="gitlab-link-fuzzy"`.

Testids that must survive: `gitlab-link-exact|fuzzy|none`, `branch-status-{blocked,unresolvable,invalid-ref,check-failed,exists,released,missing,tag-pending,tag-failed,released-description}`, `branch-name`, `merge-back-{loading,merged,likely-not-merged,couldnt-verify}`. Hidden when `mergeBackVerdict.kind === 'hidden'`. `canCreateMilestone = !!version.releaseDate && !milestonesFailed`. D-15: MR labels shows `N/M missing`, hover tooltip = first 3 unlabeled MRs (`!iid` + title) + "+N more", no links. Drop the `MRs` and `Issues` rows (D-06). Keep story points as a fact (`{completed} / {total}`, only when `hasStoryPoints`). GitLab not configured (`!gitlabBaseUrl || !activeGitlabProject`) hides the four GitLab facts, keeps Story points. Italic text under `truncate` needs `pr-0.5`.

---

### `release-detail/ReleaseDescription.tsx` (component, transform)

**Analog:** `release-detail/DescriptionsSection.tsx` (read it at plan time: Jira description is plain `whitespace-pre-wrap`; GitLab description via `ReactMarkdown` + `remark-gfm`, no `rehype-raw`). Add 2-line clamp with a more/less toggle shown only on overflow (ref + `ResizeObserver`/layout effect, not a render-time DOM read). GitLab description only when it differs from Jira's. Render nothing when both are absent. Fine to delete `DescriptionsSection.tsx` and `release-detail/MetaRow.tsx` afterwards (used only by the Sidebar; `issue-detail/MetaRow.tsx` is a different file).

---

### `src/routes/dashboard/ReleaseDetailPage.tsx` (page, request-response)

**Analog:** `src/routes/dashboard/AioCycleDetailPage.tsx`. Keep existing wiring: pin (`REL-{versionId}`, `setPinnedReleaseMeta`), breadcrumb seeding, `jiraVersionUrl`, create-dialog state, `EditReleaseModal`, `CreateBranchDialog`, `CreateMilestoneDialog`. REMOVE lines ~143-161 (`containerRef`, `sidebarRef`, `sidebarCap`, `useResizable`, `handleHovered`) and the `@container flex-1 overflow-auto` row layout (line 248) and `<ReleaseDetailSidebar>` (line 338); drop the `useResizable` and sidebar imports.

**Scroll model** (AioCycleDetailPage 135-179): fixed breadcrumb bar, then ONE scroll wrapper:
```tsx
<div className="flex flex-col h-full">
  {/* breadcrumb bar: px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0 */}
  <div className="min-h-0 flex-1 overflow-auto [--aio-sticky-top:2.75rem]" data-testid="aio-cycle-scroll">
    <CycleHeader ... />
```
For the release page use `[--release-sticky-top:0px]` (no tab bar). Page container for responsive grid: `@container/page` on a child wrapper (never rely on the container variant to style the container itself). Order: header (incl. facts) -> done bar -> graph grid -> labels/deployment mismatches -> `UnifiedTaskTable`. No ancestor between the sticky strip and the scroll wrapper may have `overflow` other than visible. Last-refreshed: `dataUpdatedAt` as in lines 92-94. Refresh handler: `refreshReleaseDetail(queryClient, ...)` with a local `refreshing` state (see `ReleasesTab.tsx:93` `handleRefresh`). Error state with no data: `ErrorState` (lines 195-209) pattern.

---

### `UnifiedTaskTable.tsx` `ColumnHeaderStrip` (component, sticky)

**Analog:** `aio-cycle/ExecutionsList.tsx:364`:
```tsx
<div className="sticky top-(--aio-sticky-top) z-10 flex w-full items-center border-b bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))]">
```
**Current** (`UnifiedTaskTable.tsx:378-381`):
```tsx
function ColumnHeaderStrip() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pl-2 py-1 density-compact:py-0.5 density-comfortable:py-2 bg-muted/30">
```
Change only classes: add `sticky top-(--release-sticky-top,0px) z-10 border-b`, replace translucent `bg-muted/30` with the opaque `color-mix` background. Anatomy, column constants and the rest stay locked. Rendered at line 1130 inside `<section className="@container">` (line 994); verify sticky works in WebKit (container-type containment) at render time.

---

### `src/stores/settings.store.ts` (+ `settings.store.test.ts`) (store)

**Analog:** its own migrate chain. Current: `version: 31` (line 375), default `releaseDetailPanelWidth: 256` (56), type (160), setter `setReleaseDetailPanelWidth` (273), migrations at 437 and 499. Add after the `version < 31` block (line 496-500):
```typescript
if (version < 32) {
  // P94: release detail is full-width, the sidebar width setting is gone.
  delete (s as Record<string, unknown>).releaseDetailPanelWidth;
}
```
and bump `version: 31` -> `32`. Remove default/type/setter; keep the old v14/v31 blocks (harmless). Update tests: `settings.store.test.ts` lines ~82, 106-107, 127 (remove), ~503 persist-version assertion (31 -> 32), line 505 v31 text assertion stays valid. `hooks/useResizable.ts` stays (other users).

---

### `ReleaseDetailSkeleton.tsx` (component)

**Analog:** itself (current: two-column with 288px sidebar, `data-testid="release-detail-skeleton"`) plus `AioDonutSkeleton`. Keep the testid; rebuild to mirror the new page: header rows, done-bar, graph slots at final sizes (same dimensions as `GraphSlot`), table rows. No sidebar column.

## Shared Patterns

### Tooltips (<= 4 rows, status colour only)
**Source:** `src/components/release/ReleaseIssueGraph.tsx:78-110`, `src/components/ui/tooltip-body.tsx` (`TooltipBody`, `TooltipRow`, `TOOLTIP_SURFACE`, `MarkerGlyph`).
**Apply to:** all four graphs, facts chips, header bar. Recharts content uses `<div className={TOOLTIP_SURFACE}>` (AioDonut lines 33-47); Radix-style uses `Tooltip/TooltipTrigger delay={0} render={<div />}/TooltipContent`.

### Status segments / colour
**Source:** `src/lib/release-list.ts:38-64` (`RELEASE_SEGMENT_ORDER = ['done','indeterminate','new']`, `RELEASE_SEGMENT_CLASS`, `releaseTooltipRows`, `breakdownTotal`, `StatusBreakdown`).
**Apply to:** assignee rows, type waffle, header bar. No new colour maps; no legends; colour = status only.

### React Compiler opt-out for recharts files
**Source:** `EpicTimeBurnup.tsx:1` (`'use no memo';`).
**Apply to:** `ReleaseBurnup.tsx` (and any graph file measuring width via refs). No hidden module-level reads in render; vitest does not run the compiler, so verify in the real app.

### Upstream-first refresh
**Source:** `src/lib/release-refresh.ts`, `src/lib/aio-refresh.ts`.
**Apply to:** `refreshReleaseDetail` and the page handler. Never derive a query key from a loading query (blink).

### Single data hook
**Source:** `release-detail/useReleaseDetail.ts` (P87 D-07).
**Apply to:** all new derived data. Add return fields only (`fixVersions` or `previousVersion`, `issuesError`, `isLoadingChannelB`, `dataUpdatedAt`, derived buckets/burnup/donut counts); do not change existing fields (the 1252-line `useReleaseDetail.test.tsx` destructures them).

### Empty / loading / error
**Source:** `ReleaseIssueGraph.tsx:49-71`, `EpicTimeBurnup.tsx:114-153`.
**Apply to:** `GraphSlot`. Fixed height in all states; copy from UI-SPEC ("No issues", "No MRs", "Couldn't load issues. Refresh to try again.").

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `graphs/ReleaseTypeWaffle.tsx` | component | transform | No waffle/grid-of-cells chart exists; compose from `SegmentedBar` colours + `ReleaseIssueGraph` tooltip, geometry per sketch 003 / UI-SPEC |
| `ReleaseDetailPage.test.tsx` | test | n/a | No page test exists today (no analog for the whole page); build on `ReleaseHeader.test.tsx` mocks and `ReleaseDetailSidebar.test.tsx` setup (`vi.mock('@tauri-apps/plugin-opener')`, `vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }))`) |

## Metadata

**Analog search scope:** `src/routes/dashboard/{release-detail,releases-list,aio-cycle,issue-detail}`, `src/components/{release,ui}`, `src/lib`, `src/stores`, `src/services/jira.ts`.
**Files scanned:** ~25 (read directly or by targeted grep).
**Pattern extraction date:** 2026-10-30
