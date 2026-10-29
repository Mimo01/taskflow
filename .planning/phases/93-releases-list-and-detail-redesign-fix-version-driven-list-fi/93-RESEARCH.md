# Phase 93: Releases list and detail redesign - Research

**Researched:** 2026-10-29
**Domain:** Internal React/TanStack Query UI refactor (no new libraries)
**Confidence:** HIGH (all findings come from reading the codebase; no external packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Remove GitLab milestone and release-branch indicators from list rows (reverses P88 D-17). They stay on the detail sidebar.
- D-02: List drops `fetchProjectMilestonesInRange` (`gitlab-milestones` windowed key) and `fetchProjectBranches` (`gitlab-release-branches`) plus their "GitLab unavailable" chips. The list makes no GitLab requests. Do not change the windowed milestone key used by `useReleaseDetail` / `UpcomingReleasesTimeline`.
- D-03: Grouped sections "Upcoming" / "Released", hairline separated, AioCycleList-style column grid with header strip. Columns: version, RM package, date, status, issue graph.
- D-04: Keep ordering: Upcoming = undated first, then dated by date descending; Released = date descending. No re-sort.
- D-05: One status pill per row via `STATUS_PILL_LAYOUT_CLASS` + `tonePillClass`: Released green, Overdue red, Due today blue, In N days neutral(muted), No date amber. Pill needs a flex parent.
- D-06: Keep issue progress as a small graph per row, fetched lazily for visible rows, streaming in.
- D-07: "A nice list": rows may be taller, small graph, professional, not overwhelming; colour = status only, tooltips <= 4 rows, no legends.
- D-08: Released paging stays: 5 most recent, then "Show N more" adds 10. Graph data fetched only once rows are revealed.
- D-09: Only `fetchFixVersions` blocks first paint; RM package cell and graph fill fixed-size skeleton slots.
- D-10: Revisits instant from cache; background revalidate with no skeleton; Refresh control matching quick 261029-qez, upstream sources first.
- D-11: One batched Jira search for all visible versions (`fixVersion in (...)`, `fields=status,fixVersions`, fully paginated, no page cap), grouped client-side. Replaces the `useQueries` fan-out. Revealing more rows fetches only new versions. Query key stable per version set.
- D-12: RM package keeps `useRmWeekIndex({ dates })`; package column hidden entirely when no RM project configured.
- D-13: Detail header echoes the list row (name, same pill, date, RM package; wide graph with "N / M done" below; Pin/Edit/Open in Jira move to header right). Action row at bottom of left column goes away.
- D-14: Header owns each figure once. Unified task table header drops progress bar and "N / M done" badge, keeps flagged-MR count. Sidebar drops Status and Date rows; keeps Milestone, Branch, Merged back, MR Labels, MRs, Issues breakdown, Story points, Descriptions.
- D-15: Body: polish only (section headings/spacing/type scale). Table anatomy from P89/P90/P91.1 untouched. No card panels on detail.

### Claude's Discretion
- Row anatomy (widths, height, second muted line vs columns), calmest option, "one row = one line" preference.
- RM cell states: child -> week label + mono child key + tooltip; week no child -> muted label + tooltip; no week -> muted dash.
- Issue graph form: slim segmented status-category bar + `done/total` + <=4-row tooltip; zero issues -> muted track / "No issues".
- Detail first paint: render header from cached data when coming from list; sections stream under placeholders; deep link w/o cache may skeleton.
- Pill tone for "In N days" (muted).
- Empty/error/stale states keep `EmptyState` / `ErrorState` / `StaleDataBanner`, restyled.

### Deferred Ideas (OUT OF SCOPE)
None. (Todo `priority-stripe-rest-rank` reviewed, not folded.)
</user_constraints>

## Summary

This is a pure in-repo refactor; there are no new dependencies. Everything needed already exists: `AioCycleList` column/overlay-button pattern, `PROGRESS_SEGMENT_CLASS`, `STATUS_PILL_LAYOUT_CLASS` + `tonePillClass`, `useRmWeekIndex`, `refreshAioCycleList` upstream-first helper pattern, `useDelayedLoading`. The substantive new work is (a) one batched, fully paginated Jira search that replaces the per-version `fetchVersionIssueCounts` fan-out, (b) a pure helper for the status pill and the three-category graph model, (c) rebuilding `ReleasesTab` rows, and (d) moving figures/actions on the detail page without disturbing the unified task table.

The main traps are cache-contract ones: `['jira-version-counts', versionId]` is shared between the list (today), `useReleaseDetail`, `useEditRelease`, `useFieldMutation`, `FieldsSection` and `parentCompletion`; the batched query must use a key that is still reached by the existing prefix invalidations (`['jira-version-counts']`) but must not collide with the per-version key shape. Also `useEditRelease` invalidates `['jira-version-counts', versionId]` specifically, which will NOT hit a batch key, so it needs an added prefix/batch invalidation or the list graph goes stale after editing a release.

**Primary recommendation:** Add `fetchVersionsStatusBreakdown(baseUrl, token, versionIds[])` to `src/services/jira.ts` (legacy file), key `['jira-version-counts', 'batch', <chunk ids joined>]` with chunked-by-reveal keys; build a pure `lib/release-list.ts` (pill model, grouping/ordering, breakdown reducer) with unit tests; rebuild `ReleasesTab` on the AioCycleList grid; add a shared `ReleaseStatusPill` + `ReleaseIssueGraph` used by list and detail header.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fix version list, ordering, pill state | Browser (React) | Jira REST (data) | Data from `/project/{key}/versions`; grouping and pill derived client-side |
| Per-version issue status breakdown | Jira REST (batched search) | Browser (group by version) | Jira DC has no batch count endpoint; one search, client-side grouping |
| RM package cell | Browser (existing `useRmWeekIndex`) | Jira REST | Already lazy; unchanged |
| Cache/revalidate/refresh | Browser (TanStack Query) | — | Session-scoped cache (staleTime 5 min, gcTime Infinity) |
| Detail header/pin/edit | Browser | — | Layout move only; pinned-tab store unchanged |

## Standard Stack

No new packages. Existing, in use: React, `@tanstack/react-query` (v5), `react-router-dom`, `lucide-react`, Tailwind v4, Base UI via shadcn, vitest 4 + jsdom + Testing Library, biome. [VERIFIED: package.json, source files] No installs required, so no Package Legitimacy Audit is needed (no packages recommended).

Reused internal primitives [VERIFIED: codebase read]:
- `STATUS_PILL_LAYOUT_CLASS`, `tonePillClass(tone)` (`src/lib/statusStyles.ts`); tones: blue, green, red, orange, amber, purple, muted.
- `PROGRESS_SEGMENT_CLASS` (`src/lib/aio-cycle-list.ts`) is keyed by AIO `StatusKey` (pass/inProgress/notRun...). Map Jira categories onto it: done -> `pass` (green-500), indeterminate -> `inProgress` (blue-500), new -> `notRun` (bg-muted). `progressTooltipRows` is hardwired to AIO labels ("Passed", "Not run"), so write a small release-specific tooltip rows helper (Done / In progress / To do / Total) rather than reuse it.
- `refreshAioCycleList` in `src/lib/aio-refresh.ts` is the staged-await invalidate pattern to mirror (`await Promise.all([upstream...])` then `await` dependents). Release Refresh button visual: ghost button, `RefreshCw size-3`, `animate-spin` while refreshing, `disabled={refreshing}` (see `AioProjectOverviewPage.tsx:333-366`).
- `useRmWeekIndex({dates})` returns `{weeks, enabled, isLoading, isError}`; `enabled` false when no RM project -> hide column.
- `useDelayedLoading`, `EmptyState`, `ErrorState`, `StaleDataBanner`, `Skeleton`, `Tooltip` + `TooltipBody`/`TooltipRow`.

## Architecture Patterns

### Data flow
```
/releases -> ReleasesTab
  ['jira-fix-versions', project] --(blocks first paint)--> group/order (lib/release-list.ts)
        |                                                         |
        |                                    visible ids (upcoming + released.slice(0,n))
        |                                                         v
        |                        chunked batch search  ['jira-version-counts','batch',ids]
        |                        (fixVersion in (...), fields=status,fixVersions, paged)
        |                                     -> Map<versionId, {new,indeterminate,done}>
        v
  useRmWeekIndex({dates: visible release dates}) -> package cell (skeleton until list/children load)
  rows: overlay button -> handleReleaseClick (breadcrumb reset + push, navigate /release/:id)

/release/:id -> ReleaseDetailPage / useReleaseDetail (unchanged data)
  header: pill + date + RM pkg + wide graph (from detail issues / cached batch) + Pin/Edit/Open in Jira
```

### Recommended structure
```
src/lib/release-list.ts            # pure: releasePill(version, today), groupReleases(), breakdown helpers, tooltip rows
src/components/release/ (or routes/dashboard/release-shared/)
  ReleaseStatusPill.tsx            # flex-parent-safe pill
  ReleaseIssueGraph.tsx            # role="img" aria-label bar, size variants list/detail
src/routes/dashboard/ReleasesTab.tsx   # rebuilt
src/routes/dashboard/ReleasesSkeleton.tsx  # restyled to header strip + groups
src/services/jira.ts               # + fetchVersionsStatusBreakdown
src/lib/release-refresh.ts         # upstream-first refresh (mirror aio-refresh.ts)
```

### Pattern: batched, chunked, fully paginated search
JQL `fixVersion in (id1,id2,...)` with ids validated `/^\d+$/` (same guard as `fetchVersionIssueCounts`), `fields=status,fixVersions`, `maxResults=200`, loop on `startAt` until `issues.length >= total` or a page adds nothing (same loop as `fetchFixVersionIssues`, `services/jira.ts`). Group client-side: an issue counts toward every one of its `fixVersions` that is in the requested set. Count `status.statusCategory.key` (`new|indeterminate|done`); an unknown/missing category counts as `new`. No subtask exclusion (must match `fetchVersionIssueCounts` semantics so list and detail agree; `ReleasesTab.versionCountsParity.test.tsx` documents this contract). Chunk by reveal: chunk 0 = all Upcoming ids (cap ~50 ids per request, split further if more), then released ids in the same 5 / 10 / 10 steps as the UI, so each reveal adds one new chunk and earlier chunk keys never change (satisfies D-11 "stable per version set", avoids the query-key churn blink). Rows whose chunk is pending render the graph skeleton slot; a chunk error renders muted `–` per UI-SPEC.

Pitfall resolved here: the fetch-once page-cap trap. Never pass a single capped page. Do not set `maxResults=0` count-only for this (that was the old 2-search approach).

### Pattern: status pill model (pure, testable)
`releasePill(version, todayKey)` precedence per UI-SPEC: released > no date > overdue > due today > in N days. Compute `today` with local date helper (`toLocalDateString` in `src/lib/local-date.ts`), not `toISOString().slice(0,10)` as the current `getReleaseTimingLabel` does (UTC; wrong near midnight in non-UTC zones; see memory "timeTicks is UTC not local"). Day diff: compute from date keys with integer day arithmetic (`addDaysKey` exists in `aio-cycle-list.ts`) to avoid DST drift from `Math.round(ms/86400000)`. "In 1 day" singular.

### Pattern: no-blank refresh (D-10)
Remove `isRefreshing`-driven `ReleasesSkeleton`. Skeleton only when `useDelayedLoading(isLoading)` and no cached `fixVersions`. `isLoading` in v5 is `isFetching && isPending`, so cached data never blanks. Refresh: `refreshing` state + staged invalidate: stage 1 `['jira-fix-versions']`, `['rm-week-list']` (parallel); stage 2 `['rm-week-children']`, `['jira-version-counts']` (the batch chunks are keyed by ids from stage 1, and RM children by weeks from the week list). Await each stage so dependents do not refetch against stale inputs (memory: enrichment invalidation no-op).

### Pattern: overlay row button
Copy `AioCycleList` row: container `relative`, sibling `<button className="absolute inset-0" aria-label="Open release {name}">`, content cells `pointer-events-none relative`. Replaces the invalid button-containing-links row. Cells: explicit-px `flex-none` (`w-44`, `w-28`, `w-28`, `w-44`), version `flex-1 min-w-0`. Pill inside a flex div (memory: statusPillClass needs flex parent). Container-query hiding of Package/Date: container on an outer wrapper, never the element itself (memory: container query not on self). Use `CELL_PADDING` classes from AioCycleList for density. Note `STATUS_PILL_LAYOUT_CLASS` has `min-w-[5.5rem]`; status column `w-28` (7rem) fits it.

### Detail page changes
- Replace `ReleaseTitleHeading` (in `release-detail/ReleaseHeader.tsx`) with a header component taking version, pill, RM package node, graph, and action props. Move Pin (currently ~lines 300-330 of `ReleaseDetailPage.tsx`, uses `usePinnedTabsStore` togglePin/removePin/setPinnedReleaseMeta), Edit (sidebar `onStartEditing`, line ~308) and Open in Jira (existing ExternalLink button) into the header. Keep the `aria-label`s consistent with existing tests unless intentionally changed (current Pin aria-label is 'Pin release'/'Unpin release'; UI-SPEC says visible labels Pin/Unpin).
- Header graph source: the detail already computes `issueStatusCounts` (new/indeterminate/done) for the sidebar and `issueCounts` (`['jira-version-counts', versionId]`). Prefer the detail's own `issueStatusCounts` once loaded; for instant first paint from the list, read the cached batch via a fetch-disabled `useQuery({enabled:false})` over the same key (memory: reactive cache-read; imperative `getQueryData` in render is non-reactive) or accept a brief graph skeleton. Header figure must be derived from one source to avoid disagreeing with the sidebar breakdown.
- UnifiedTaskTable header (`UnifiedTaskTable.tsx` ~line 1002): delete the `issueCounts` Badge ("N / M done") and any progress bar there; keep the flagged-MR badges (`flagged-br-badge`, `flagged-ms-badge`). Check whether the `issueCounts` prop becomes unused and remove it through the call site and tests.
- Sidebar: delete `MetaRow label="Status"` and `MetaRow label="Date"` (lines ~315-330) and the Edit button in the Details heading; remove the `onStartEditing` prop if unused.
- `ReleaseDetailSkeleton` restyle to header shape; render header from cached `fixVersions` when present (`version` already derived from the `jira-fix-versions` cache, so the page need only stop gating on whole-hook `isLoading` for header content).

### Anti-Patterns to Avoid
- Editing `fetchVersionIssueCounts` or the `['jira-version-counts', versionId]` shape: detail and mutations depend on it. Add a new function instead; keep the old one (detail still uses it).
- Using `jira/` module files: imports use legacy `services/jira.ts` (memory). Add the new fetcher there.
- Negative margins in `space-y` containers (Tailwind v4 :where specificity memory).
- Wrapping the pill in a bare inline `<span>`/`<td>`.
- Fetching the batch for all versions (hidden released ones included); fetch only visible chunks.
- Keying the batch by an unstable array (unsorted ids, or ids that shift as released rows reveal).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status pill colours | custom classes | `STATUS_PILL_LAYOUT_CLASS` + `tonePillClass` | shared geometry/palette |
| Segment colours | new colour map | `PROGRESS_SEGMENT_CLASS` via category mapping | consistent with AIO bars |
| RM package lookup | new fetch | `useRmWeekIndex` + `findWeekForDate`/`findChildForProject`/`formatWeekLabel` | lazy, cached, shared |
| Row click | nested button/links | overlay-button pattern | valid a11y markup |
| Local date key | `toISOString().slice` | `toLocalDateString`, `addDaysKey` | UTC bug |
| Upstream-first refresh | ad-hoc invalidate-all | staged awaits like `aio-refresh.ts` | stale inputs |
| Tooltip | custom popover | `Tooltip` + `TooltipBody`/`TooltipRow` | consistent |

## Runtime State Inventory

Not a rename/migration phase: omitted. (Query caches are in-memory and session-scoped; no persisted state, no data migration. Cache key changes need no migration.)

## Common Pitfalls

1. **Stale list graph after editing a release or changing an issue's fix version.** Existing invalidations: `useFieldMutation` / `FieldsSection` / `parentCompletion` invalidate prefix `['jira-version-counts']` (reaches a batch key that starts with that prefix); `useEditRelease` invalidates only `['jira-version-counts', versionId]` (misses batch). Fix: make batch key `['jira-version-counts', 'batch', ...]` and add a prefix invalidation of `['jira-version-counts','batch']` to `useEditRelease` (release rename/released toggle affects grouping/pill via `jira-fix-versions`, already invalidated there; add batch only if the edit can change membership - it cannot, so low risk; verify in code). Warning sign: graph unchanged after a status transition from issue detail.
2. **Key collision.** A versionId equal to the literal `'batch'` cannot happen (ids numeric), but prefix invalidation `['jira-version-counts', versionId]` must not equal the batch key's first two elements. Keep `'batch'` string non-numeric.
3. **Query-key churn blink.** Do not derive the batch key from a still-loading query's data and do not use one key over all visible ids that grows on each reveal; use per-chunk keys (above) or `placeholderData: keepPreviousData`.
4. **Disabled query isPending forever.** Chunk queries `enabled: !!token && ids.length>0`; guard loading flags so skeleton slots do not spin when disabled (memory).
5. **jira token race.** The list reads the PAT with `readSecret` in an effect (`jiraToken` state). Queries are `enabled` on it, so first paint of versions waits for the token read; keep that, but do not add the GitLab token read any more (no GitLab on list).
6. **`jira-fix-versions` shape.** Shared by many hooks; do not add `select`-less transformations or change the queryFn. Group/sort client-side with `useMemo`/plain derivation.
7. **React Compiler vs vitest.** No module-level mutable reads in render; `today` must be computed inside the component/hook from a call, not a module constant (a module-level `today` goes stale across midnight and under the compiler).
8. **WebKit flex quirks.** Explicit-px flex-none cells; `min-w-0` on flex-1 version cell; italic truncation (`pr-0.5`) if any italic.
9. **Pre-commit gate.** Full vitest + biome run on commit: delete/adjust obsolete tests in the same commit as the code removing the behaviour (ReleasesTab tests with testids `gitlab-link-*`, `row-missing-*`, `row-branch-present`, `branches-error-chip`; `ReleasesTab.versionCountsParity.test.tsx`; `ReleaseHeader.test.tsx`; `ReleaseDetailSidebar.test.tsx` Status/Date; `UnifiedTaskTable.test.tsx` header progress). RED+GREEN in one commit per TDD task. Do not run `biome --write` over all of `src`.
10. **Count semantics divergence.** Detail sidebar counts per-status from `fetchFixVersionIssues` (no subtask exclusion) and list batch must also have no subtask exclusion, else "N / M" differs between list and detail.
11. **Large versions.** A version may have thousands of issues; `fields=status,fixVersions` keeps pages small, 200/page. Jira DC may cap `maxResults` at 1000; 200 is safe.
12. **Releases with zero issues** -> "No issues" empty track, not 0/0.

## Code Examples

Batched fetch skeleton (mirrors `fetchFixVersionIssues` loop in `services/jira.ts`):
```typescript
export type StatusBreakdown = { new: number; indeterminate: number; done: number };

export async function fetchVersionsStatusBreakdown(
  baseUrl: string, token: string, versionIds: string[],
): Promise<Record<string, StatusBreakdown>> {
  for (const id of versionIds) if (!/^\d+$/.test(id)) throw new Error(`Invalid versionId: ${id}`);
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const wanted = new Set(versionIds);
  const out: Record<string, StatusBreakdown> = Object.fromEntries(
    versionIds.map((id) => [id, { new: 0, indeterminate: 0, done: 0 }]),
  );
  const jql = `fixVersion in (${versionIds.join(',')})`;
  let startAt = 0; let seen = 0;
  while (true) {
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=status,fixVersions&maxResults=200&startAt=${startAt}`;
    const resp = await apiFetch('jira', url, { headers }, 'Load Release Issue Status');
    if (!resp.ok) throw new Error(`Failed to fetch release issues: status ${resp.status}`);
    const data = (await resp.json()) as { issues: JiraIssueLite[]; total: number };
    for (const issue of data.issues) {
      const cat = issue.fields.status?.statusCategory?.key;
      const k = cat === 'done' ? 'done' : cat === 'indeterminate' ? 'indeterminate' : 'new';
      for (const fv of issue.fields.fixVersions ?? []) if (wanted.has(fv.id)) out[fv.id][k] += 1;
    }
    seen += data.issues.length;
    if (seen >= data.total || data.issues.length === 0) break;
    startAt = seen;
  }
  return out;
}
```
Pill model:
```typescript
export type ReleasePill = { tone: 'green'|'red'|'blue'|'muted'|'amber'; label: string };
export function releasePill(v: {released:boolean; releaseDate?:string}, today: string): ReleasePill {
  if (v.released) return { tone: 'green', label: 'Released' };
  if (!v.releaseDate) return { tone: 'amber', label: 'No date' };
  if (v.releaseDate < today) return { tone: 'red', label: 'Overdue' };
  if (v.releaseDate === today) return { tone: 'blue', label: 'Due today' };
  const n = daysBetween(today, v.releaseDate);
  return { tone: 'muted', label: `In ${n} ${n === 1 ? 'day' : 'days'}` };
}
```

## State of the Art

| Old | New | Impact |
|-----|-----|--------|
| 2 count-only searches per fix version (all versions) | 1 paged search per visible chunk | far fewer requests on projects with many historic versions |
| Whole-row `<button>` w/ nested links | overlay button | valid markup |
| Refresh blanks list | staged invalidate, no skeleton | instant revisit |
| Stacked Unreleased+Overdue+No date badges | single pill | calmer |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira DC accepts `fixVersion in (id,id,...)` with numeric ids and returns `status.statusCategory.key` with `fields=status` | Patterns | Low; same JQL family already used with `fixVersion = id` and statusCategory keys read elsewhere in `jira.ts`. Verify once against live instance in plan (probe) |
| A2 | Jira search `maxResults=200` is honoured (not capped lower) | Pitfalls | Loop terminates on `total`/empty page anyway, so only more requests |
| A3 | ~50 ids per JQL chunk is safe for URL length | Patterns | Low; ids are short; reduce chunk size if a 414 appears |
| A4 | `useEditRelease` edits cannot change issue membership, so batch invalidation is optional | Pitfalls | Low; adding prefix invalidation is cheap, recommended anyway |

## Open Questions

1. **Header graph first paint source** - batch cache via disabled `useQuery` vs detail's own `issueStatusCounts`. Recommendation: use detail's `issueStatusCounts` as the authority and the batch cache only as an instant seed; show a graph skeleton if neither is present.
2. **Hidden Package column when RM enabled but the active project name is unresolved** - recommendation: keep column (enabled), cell falls to week-only/dash states.

## Environment Availability

Step skipped (no external tools beyond the existing app toolchain; Jira instance only needed for optional live probe of A1).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4 (jsdom, Testing Library), setup `src/test/setup.ts` |
| Config file | `taskflow/taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run <path>` |
| Full suite command | `cd taskflow && npm test` (also `npm run check` = biome check + tsc) |

(Repo root is `/Users/mimo/Documents/Projects/taskflow`; run npm/vitest in inner `taskflow/`.)

### Decision -> Test Map
| Decision | Behavior | Type | Command | Exists? |
|----------|----------|------|---------|---------|
| D-01/D-02 | List renders no milestone/branch UI and makes no GitLab calls (gitlab mock functions not called) | component | `npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` | update (remove old testids) |
| D-03/D-04 | Group labels; ordering undated first, dated desc, released desc | unit (`lib/release-list`) + component | `npx vitest run src/lib/release-list.test.ts` | Wave 0 |
| D-05 | Pill precedence/labels/tone, singular "In 1 day", local-date boundary | unit | same | Wave 0 |
| D-06/D-11 | Batch fetch: pagination across pages, grouping across multiple fixVersions, id validation, category mapping, no subtask exclusion in JQL | unit (mock apiFetch) | `npx vitest run src/services/jira.versionsBreakdown.test.ts` | Wave 0 |
| D-08 | 5 released, "Show N more" adds 10; only new chunk fetched | component | ReleasesTab test | update |
| D-09 | Names/pills render before counts/RM resolve; skeleton slots present | component | ReleasesTab test | update |
| D-10 | Cached data renders with no skeleton on refetch; Refresh calls staged invalidation and button disabled/spinning | component + unit (`release-refresh`) | `npx vitest run src/lib/release-refresh.test.ts` | Wave 0 |
| D-12 | Package column absent when RM disabled; states (child / week only / none) | component | `ReleasesTab.deploymentPackage.test.tsx` | update |
| D-13 | Header shows pill/date/package/graph, Pin/Edit/Open in Jira in header, bottom action row gone, pin toggles store | component | `ReleaseHeader.test.tsx`, `ReleaseDetailPage` tests | update |
| D-14 | Table header has no "done" badge/progress, keeps flagged badges; sidebar lacks Status/Date rows, keeps rest | component | `UnifiedTaskTable.test.tsx`, `ReleaseDetailSidebar.test.tsx` | update |
| Graph a11y | `role="img"` aria-label "{done} of {total} issues done"; zero issues -> "No issues" | component | `ReleaseIssueGraph.test.tsx` | Wave 0 |
| Cache contract | `useEditRelease`/mutations still invalidate list batch; detail `['jira-version-counts', id]` untouched | unit | existing `useReleaseDetail.test.tsx` + new | partial |

### Sampling Rate
- Per task commit: the touched file's vitest + `npx biome check <files>` (pre-commit runs full suite anyway).
- Per wave merge: `npm test` and `npm run check` (gate on no NEW biome-flagged files, not an absolute count).
- Phase gate: full suite green; visual UAT of list and detail header (throwaway vite page + cached Chromium) before verify.

### Wave 0 Gaps
- [ ] `src/lib/release-list.ts` + `.test.ts` (pill, grouping/order, breakdown reducer, tooltip rows)
- [ ] `src/services/jira.versionsBreakdown.test.ts` for the new fetcher
- [ ] `src/lib/release-refresh.ts` + test
- [ ] Shared `ReleaseStatusPill` / `ReleaseIssueGraph` + tests
- [ ] Remove/rewrite obsolete ReleasesTab tests (listed in Pitfall 9); `versionCountsParity` test needs rewriting since the list no longer produces the per-version key (assert instead that list batch semantics match `fetchVersionIssueCounts` totals on a shared fixture)

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input validation | yes | version ids validated `/^\d+$/` before JQL interpolation (never interpolate names); `encodeURIComponent` on JQL |
| V2/V3/V4 | no change | PAT via Stronghold `readSecret`, unchanged; no new auth surface |
| V6 | no | none |

Threats: JQL injection via unvalidated id (mitigate with the numeric guard, as `fetchVersionIssueCounts` does); token leakage (use `apiFetch`, never log headers). `security_enforcement` config not set to false, so section included.

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` found in repo root or `taskflow/`; no `.claude/skills`. Binding directives come from user memory: edit legacy `services/jira.ts`; do not bulk find-replace or `biome --write` all of `src`; no `git stash` for comparisons; verify scripted edits; no customer data in fixtures; colour = status only; one row = one line; detail pages no card panels; pre-commit full vitest; keep repo-root vs app-dir split in commands.

## Sources

### Primary (HIGH confidence, direct code read)
- `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `ReleaseDetailPage.tsx`, `release-detail/{ReleaseHeader,ReleaseDetailSidebar,UnifiedTaskTable,useReleaseDetail}.tsx`
- `taskflow/src/services/jira.ts` (`fetchFixVersions`, `fetchVersionIssueCounts`, `fetchFixVersionIssues`)
- `taskflow/src/lib/{aio-cycle-list,aio-refresh,statusStyles}.ts`, `src/hooks/useRmWeekIndex.ts`
- `AioProjectOverviewPage.tsx` refresh control (quick 261029-qez, commits 84b44c34 / d500ca2c)
- 93-CONTEXT.md, 93-UI-SPEC.md

### Secondary / Tertiary
- None; Jira DC JQL behaviours (A1-A3) rest on in-repo precedent, flagged as assumptions.

## Metadata

**Confidence:** Standard stack HIGH (no new deps); Architecture HIGH; Pitfalls HIGH (grounded in grep of consumers); live Jira batch JQL behaviour MEDIUM (A1).

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 (stable internal code; re-grep consumers if other phases land first)
