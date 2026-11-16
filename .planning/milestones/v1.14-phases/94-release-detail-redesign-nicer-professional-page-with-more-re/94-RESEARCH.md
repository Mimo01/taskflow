# Phase 94: Release detail redesign - Research

**Researched:** 2026-10-30
**Domain:** Internal React 19 / Tailwind v4 / recharts UI refactor of `/release/:versionId` (no new packages, no new endpoints)
**Confidence:** HIGH (everything below was verified by reading the codebase in this session; no external library research was needed)

All paths below are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` unless they start with `.planning` or `.claude` (outer repo root).

<user_constraints>
## User Constraints (from 94-CONTEXT.md)

### Locked Decisions
- **D-01 (user):** Four graphs: burnup over time, issues by type, issues by assignee, MR state. The header done/in-progress/to-do bar still owns the done figure (P93 D-13/D-14).
- **D-02 (user):** Every graph counts issues; story points only in tooltips. No Issues/SP toggle.
- **D-03 (user):** Burnup x-axis starts at the previous version's release date (the fix version immediately before this one by date, released or not). Fallback: earliest issue `created`. Axis ends at this release's date; if that is past while unreleased, or undated, it ends today. Add `created` + `resolutiondate` additively to `fetchFixVersionIssues` (JQL/order unchanged, 261014-eym precedent). No changelog. Done = `statusCategory = done`, dated by `resolutiondate`. Scope = `created`, clamped to axis start. Removals from the version are not tracked.
- **D-04:** Burnup has no forecast and no ideal line. Scope + done lines, TODAY marker, release-date marker.
- **D-05:** Each graph a different visual form; colour = status only. Burnup: recharts area/line (EpicTimeBurnup pattern). MR state: donut (AioDonut pattern). Assignee: avatar rows (`CachedAvatar` + name + slim segmented bar + done/total; Unassigned own row). Type: compact stacked status shape different from the assignee rows (sketch chose waffle). All segments use `RELEASE_SEGMENT_CLASS`/shared colours. No legends; tooltips <= 4 rows.
- **D-06 (user):** Fold the sidebar count rows into graphs; each figure appears once. Per-status Issues breakdown becomes tooltip detail; MRs counts become the donut; neither repeated as text. Story points total moves to the facts strip.
- **D-07 (user):** Full width, no sidebar. Remove `ReleaseDetailSidebar` as a column, `useResizable` wiring on this page, `releaseDetailPanelWidth` setting + store migration handling. Order: header, facts strip, graphs, label summary / deployment mismatches, unified task table.
- **D-08:** Sidebar GitLab facts become a one-line strip in the header area (Milestone, Branch, Merged back, MR labels, Story points); status tone only on problems; Create branch / Create milestone / Retry branch check + links live inside; tooltips <= 4 rows; every sidebar state stays reachable; keep testids or map one-to-one so `ReleaseDetailSidebar.test.tsx` coverage carries over; chips wrap, state words never truncate.
- **D-09:** Descriptions (Jira version description; GitLab milestone description only when it differs) as muted paragraph under title, clamped to 2 lines with "more" toggle.
- **D-10:** Sketch before planning (DONE: sketches 003 B / 004 / 005; packaged in `.claude/skills/sketch-findings-taskflow/`).
- **D-11:** Header mirrors shipped `ReleasesHero`... **superseded where the UI-SPEC says the sketch wins** (UI-SPEC: CycleHeader-style header, `text-lg` title, `Name: value` meta line, no `border-b`). UI-SPEC is the approved contract.
- **D-12:** Timing from the pill; no separate countdown figure.
- **D-13 (user):** AIO cycle detail scroll model: breadcrumb bar fixed, everything else scrolls as one page; header/facts/graphs scroll away; unified task table column header sticks (`--aio-sticky-top`). No extra sticky bar.
- **D-14:** Keep `EditReleaseModal` as built; no inline field editing.

### Claude's Discretion
- Graph-area loading: fixed-size skeleton slots; issue graphs render when `jira-fixversion-issues` resolves; MR donut streams with MR channels; header renders from list cache on first paint.
- Empty states: no issues -> compact muted "No issues"; no GitLab/no MRs -> muted "No MRs" (or hidden when GitLab not configured); burnup < 2 points -> muted placeholder.
- Narrow widths: responsive grid via container queries on an inner wrapper.
- Graph sizes / arrangement (decided by sketch + UI-SPEC).
- `ReleaseDetailSkeleton` rebuilt to mirror the new layout.

### Deferred Ideas (OUT OF SCOPE)
- Inline field editing (date / released toggle in place).
- Projected-finish forecast on the burnup.
- Changes to the unified task table's anatomy/behaviour (only its column header becomes sticky).
- New release capabilities / new drift checks.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped (ROADMAP: "Requirements: TBD"). Coverage is derived from CONTEXT decisions; the planner should use D-xx IDs as the traceability keys.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01/02/05 | Four issue-count graphs | Data derivations + component patterns below (burnup, donut, assignee rows, type waffle) |
| D-03 | Burnup axis rules | `jira-fix-versions` cache gives previous version; `created`/`resolutiondate` already typed on `JiraIssue` |
| D-04 | No forecast | Do not import `projectFinish` / `deriveProjection`; no ideal line |
| D-06 | Fold count rows | Sidebar rows `MRs`, `Issues` deleted; tooltips use `releaseTooltipRows` |
| D-07 | Remove sidebar + setting | Store/migration/test changes enumerated |
| D-08 | Facts strip | Full state inventory from `ReleaseDetailSidebar.tsx` (testids list) |
| D-09 | Descriptions | `DescriptionsSection` currently lives only in the sidebar |
| D-11/12 | Header | `ReleaseHeader.tsx` rewrite per UI-SPEC |
| D-13 | Scroll model | `AioCycleDetailPage.tsx` pattern; sticky `ColumnHeaderStrip` |
| D-14 | Edit modal unchanged | `useEditRelease` / `EditReleaseModal` untouched |
</phase_requirements>

## Summary

This is a pure frontend re-composition. Every data source the new page needs already exists in `useReleaseDetail` (the single data hook, P87 D-07), with exactly three small data-layer gaps: (1) `fetchFixVersionIssues` does not request `created`/`resolutiondate` (but `JiraIssue.fields.created`/`resolutiondate` are already typed, so only the `fields` string changes); (2) `computeMrStateCounts` folds draft MRs into `opened` and has no `draft` split (`GitLabMR.draft: boolean` exists on the milestone-MR list data, so the donut's draft slice is derivable without new fetches); (3) the detail page has no Refresh / "Refreshed" plumbing today (the list has `refreshReleaseList`; detail needs an upstream-first `refreshReleaseDetail`). Everything else (type, assignee, status counts, story points, previous-version date, label coverage, merge-back verdict, branch state) is derivable from queries already running.

The page work is: rewrite `ReleaseDetailPage.tsx` layout (scroll wrapper, no sidebar), rewrite `ReleaseDetailHeader` in `ReleaseHeader.tsx` (CycleHeader style + facts strip), replace `ReleaseDetailSidebar.tsx` with a facts-strip component that preserves every testid, add four graph components, move `DescriptionsSection` content into the header, make `UnifiedTaskTable`'s `ColumnHeaderStrip` sticky, rebuild `ReleaseDetailSkeleton`, and delete the `releaseDetailPanelWidth` setting with a persist-version bump.

**Primary recommendation:** Add pure derivation modules first (burnup series, previous-version resolver, assignee/type buckets, MR-state with draft) with unit tests, expose them through `useReleaseDetail` as additive return fields, then build presentational graph components against those, then swap the page layout and delete the sidebar last (so the old `ReleaseDetailSidebar.test.tsx` can be ported test-by-test to the facts-strip before deletion).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Burnup / bucket derivation | Browser (pure TS in `lib/` or `release-detail/`) | — | Derived client-side from the already-fetched issue list; no server/changelog (D-03) |
| Issue data (created/resolutiondate) | API (Jira REST, via `services/jira.ts`) | Browser cache (react-query) | Additive `fields=` param only |
| Previous-version date | Browser (`jira-fix-versions` cache) | — | Same cache the page already reads; no new request |
| MR state counts | Browser (derive from `milestoneMRs`) | — | `GitLabMR.draft`/`state` already on list data |
| Facts strip states | Browser (existing derived verdicts) | — | `branchState`, `mergeBackVerdict`, `gitlabMatch`, `labelCoverage` already computed in the hook |
| Persisted panel width removal | Browser (zustand persist migration) | — | `settings.store.ts` version bump |
| Scroll/sticky behaviour | Browser (CSS) | — | AIO cycle detail pattern |

## Standard Stack

No new dependencies. Everything is in the repo.

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| recharts | already installed (used by `EpicTimeBurnup`, `AioDonut`, `CycleBurndown`) | burnup line/area, donut | `[VERIFIED: codebase]` `components/ui/chart.tsx` (`ChartContainer`, `ChartTooltip`) is the wrapper |
| @tanstack/react-query | installed | queries + cache | `[VERIFIED: codebase]` |
| lucide-react | installed | icons | `[VERIFIED: codebase]` |
| tailwindcss v4 | installed | `@container` / `@max-[Npx]/name:` variants | `[VERIFIED: codebase]` used in `ReleaseDetailPage` today |
| vitest 4 + @testing-library | installed | tests | `[VERIFIED: package.json]` `"test": "vitest run"`, jsdom, setup `src/test/setup.ts` |
| biome | installed | lint/format | `npm run check` = `biome check ./src && tsc --noEmit` |

### Package Legitimacy Audit
No external packages are recommended; none to audit. **Packages removed: none. Flagged [SUS]: none.**

### Reusable components / helpers (exact paths)

| Need | Reuse | Path | Notes |
|------|-------|------|-------|
| Status segments / colours / order | `RELEASE_SEGMENT_CLASS`, `RELEASE_SEGMENT_ORDER`, `releaseTooltipRows`, `breakdownTotal`, `StatusBreakdown` | `src/lib/release-list.ts` | `StatusBreakdown = {new, indeterminate, done}`; tooltip rows give Done / In Progress / To Do with colours |
| Header done bar | `ReleaseIssueGraph` | `src/components/release/ReleaseIssueGraph.tsx` | Already has loading/error/empty/tooltip; has `max-w-xl` wrapper -> UI-SPEC wants full-width: add a `className`/width prop or drop the cap for the detail header. Test file exists (`ReleaseIssueGraph.test.tsx`) |
| Status pill | `ReleaseStatusPill`; `releaseHeaderPill(version, today)` | `src/components/release/ReleaseStatusPill.tsx`, `src/lib/release-agenda.ts` | |
| RM package | `ReleasePackageCell` | `src/components/release/ReleasePackageCell.tsx` | currently wrapped `w-44`; UI-SPEC shows package icon + `WEEK45 RM-14` in meta line (check cell's variants) |
| Date text | `dateStamp(key).inline` | `src/lib/release-agenda.ts` | |
| Segmented bar | `SegmentedBar` is a **private** function in `routes/dashboard/releases-list/ReleaseAgendaParts.tsx:43` | — | CONTEXT lists it as reusable, but it is not exported. Export it (or extract to `components/release/SegmentedBar.tsx`) for assignee rows. Same pattern also inline in `ReleaseIssueGraph` |
| Donut | `AioDonut`, `AioDonutSkeleton`, `DONUT_SIZE` | `src/routes/dashboard/aio-cycle/AioDonut.tsx` | Props: `slices: ChartSlice[]`, `size`, `testId`, `ariaLabel`, `center`. `ChartSlice` type is in `src/lib/aio-cycle-charts.ts` (`{label,value,color,rows}` — verify exact shape). Fixed-size (no ResponsiveContainer — WebKit). Ring INNER 0.36/OUTER 0.48 = UI-SPEC |
| Burnup scaffolding | `ChartContainer`, `ChartTooltip`; `dateKeyMs`, `timeTicks`, `addCalendarDays`, `formatDateKey` | `src/components/ui/chart.tsx`, `src/lib/epic-progress.ts` | `EpicTimeBurnup.tsx` is the pattern (numeric `t` x-axis with `scale="time"`, explicit `ticks`). `PLOT_MARGIN`/`Y_AXIS_WIDTH`/`useElementWidth` in `routes/dashboard/issue-detail/EpicChartZoom.tsx` (zoom machinery NOT needed) |
| Burnup TODAY marker | `ReferenceLine` | `routes/dashboard/aio-cycle/CycleBurndown.tsx:232` | pattern for marker lines |
| Tooltip | `Tooltip/TooltipTrigger/TooltipContent`, `TooltipBody`, `TooltipRow`, `TOOLTIP_SURFACE` | `src/components/ui/tooltip.tsx`, `src/components/ui/tooltip-body.tsx` | `TooltipTrigger` takes `delay={0}` and `render={<div/>}` as in `ReleaseIssueGraph` |
| Burnup chart tooltip | `EpicChartTooltip` | `routes/dashboard/issue-detail/EpicChartTooltip.tsx` | It is epic-metric specific (`metric`, `finish`, `clippedAfter` props). Prefer a small dedicated recharts tooltip using `TOOLTIP_SURFACE` + `TooltipBody`/`TooltipRow` (as `AioDonut`'s `SliceTooltip` does) rather than bending `EpicChartTooltip` |
| Avatar | `CachedAvatar({url,name,size,className})` | `src/components/ui/cached-avatar.tsx` (verify; found via grep, line 54) | explicit px `size` |
| Issue type icon | `IssueTypeIcon({typeName,className})` | `src/components/ui/issue-type-icon.tsx` | Returns **coloured** icons (red Bug, green Story...). UI-SPEC wants muted type icon + "colour = status only" -> override with `className="... text-muted-foreground"`; the component's per-icon colour classes come AFTER the passed class so the override may lose; verify (twMerge not applied: it concatenates strings). Either add a `muted` prop or wrap in a `[&_svg]:!text-muted-foreground` container |
| Per-assignee / per-status buckets | `deriveAssigneeBuckets(stories, 'count', spKey)`, `deriveStatusBuckets` | `src/lib/epic-progress.ts:167` | Returns `{id,name,done,inProgress,todo,avatarUrl,...}` keyed by DC username with a distinct `'unassigned'` id, avatar url extraction included. Reusable as-is for D-05 assignee rows (metric `'count'`); sort order there is by remaining desc — UI-SPEC wants total desc, so re-sort. Needs story points per assignee for tooltip -> call also with `'sp'` or add a small local reducer |
| Status category of an issue | `catOf(issue)` | `src/lib/epic-progress.ts:83` | |
| Facts-row primitives | `RowAction`, `RowUnavailable`, `BranchRowContent`, `formatEvidenceDate`, `formatVerdictDate` | `release-detail/ReleaseDetailSidebar.tsx` (private) | Move into the new facts-strip module; `BranchRowContent` has an exhaustive switch (`assertNeverBranchState`) — keep it |
| Edit modal, create dialogs | unchanged | `release-detail/EditReleaseModal.tsx`, `CreateBranchDialog.tsx`, `CreateMilestoneDialog.tsx` | state stays in page |
| Sticky list header | pattern `sticky top-(--aio-sticky-top) z-10 bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))]` | `routes/dashboard/aio-cycle/ExecutionsList.tsx:364` | |
| Scroll model | `className="min-h-0 flex-1 overflow-auto [--aio-sticky-top:2.75rem]"` | `routes/dashboard/AioCycleDetailPage.tsx:174` | In AIO, `2.75rem` = tab bar height. The release page has no tab bar -> use `[--release-sticky-top:0px]` (or reuse the variable name set to `0`) |
| Refresh pattern | `refreshReleaseList` | `src/lib/release-refresh.ts` | Add `refreshReleaseDetail` beside it |
| Relative time | `relativeTime` | `src/lib/relative-time.ts` | |

## Current-state inventory (what exists today)

### Page and components
- `src/routes/dashboard/ReleaseDetailPage.tsx` (445 lines): breadcrumb header; `isLoading || !version` -> `ReleaseDetailSkeleton`; else `flex flex-1 overflow-hidden` row with left `@container flex-1 overflow-auto` column (`ReleaseDetailHeader`, `LabelSummarySection`, `DeploymentPackageSection`, `UnifiedTaskTable`) + `ReleaseDetailSidebar`; then `EditReleaseModal`, `CreateBranchDialog`, `CreateMilestoneDialog`. Owns: pin toggling (`REL-{versionId}` via `usePinnedTabsStore`, `setPinnedReleaseMeta`), breadcrumb seeding (`seedReleaseBreadcrumb`, `openIssueFull`), `jiraVersionUrl`, `useResizable` wiring (lines 143-161, REMOVE), create dialog open state. **Has no test file** (no `ReleaseDetailPage.test.tsx`).
- `release-detail/ReleaseHeader.tsx` (144 lines): `ReleaseBreadcrumbHeader` (keep verbatim) and `ReleaseDetailHeader` (`data-testid="release-detail-header"`, h2 `text-xl`, pill, date, package `w-44`, Pin/Edit/Open in Jira outline buttons, `ReleaseIssueGraph`). Test: `ReleaseHeader.test.tsx` (134 lines; asserts `release-status-pill` count 1, `release-detail-header`, `row-deployment-package` presence/absence).
- `release-detail/ReleaseDetailSidebar.tsx` (545 lines) + `ReleaseDetailSidebar.test.tsx` (539 lines): the read-only metadata column. Rows and testids (must all survive):
  - Milestone: `gitlab-link-exact` (link or plain span), `gitlab-link-fuzzy` (dashed underline, `title="Fuzzy match: {name}"`), `gitlab-link-none` wrapping either `Create milestone` `RowAction` (when `canCreateMilestone = !!version.releaseDate && !milestonesFailed`) or `RowUnavailable` "Set a release date first".
  - Branch (`BranchRowContent`, exhaustive over `BranchState`): `branch-status-blocked` ("Create the milestone first"), `branch-status-unresolvable`, `branch-status-invalid-ref`, `branch-status-check-failed` (+ Retry branch check), `branch-status-exists` + `branch-name`, `branch-status-released` (+ `branch-status-tag-pending`, `branch-status-tag-failed`, sr-only `branch-status-released-description`), `branch-status-missing` (+ Create branch).
  - Merged back (hidden when `mergeBackVerdict.kind === 'hidden'`): `merge-back-loading`, `merge-back-merged` (tracking-mr and content-compare variants with `title` evidence), `merge-back-likely-not-merged`, `merge-back-couldnt-verify` (reason-specific `title`).
  - MR Labels: `—` when `gitlabMatch.type === 'none'`; "Loading..." until `milestoneMRsLoaded && labelCoverage`; all-labeled green; or `N/M missing` orange **with an inline list of unlabeled MRs (`!iid` link via `openExternal` + `LinkContextMenu`, title)** — NOTE: this is interactive content (links) that the UI-SPEC proposes folding into a <=4-row tooltip. See Open Question 1.
  - MRs row (counts merged/open/closed Badges), Issues row (new/in progress/done Badges): REMOVED by D-06.
  - Story points row (`hasStoryPoints`): `{completed} / {total}`.
  - `sidebar-descriptions` -> `DescriptionsSection` (Jira description plain `whitespace-pre-wrap`; GitLab description rendered with ReactMarkdown + remark-gfm; "No description" italic empty states). `DescriptionsSection.tsx` and `MetaRow.tsx` under `release-detail/` are used **only** by the sidebar (grep verified); `issue-detail/MetaRow.tsx` is a different file.
- `release-detail/LabelSummarySection.tsx`: label chips; returns null until `milestoneMRsLoaded` and non-empty. Heading is `text-base font-semibold` -> UI-SPEC wants `h3 text-sm font-semibold` + muted icon, side column.
- `release-detail/DeploymentPackageSection.tsx` (269 lines, test exists): mismatch rows; renders nothing without an RM project.
- `release-detail/UnifiedTaskTable.tsx` (1225 lines, 1963-line test): `<section className="@container">` root (line 994); `ColumnHeaderStrip` (line 378) rendered inside a fragment right before `<div data-testid="task-list">`; has its own banners/badges above. Anatomy locked.
- `release-detail/ReleaseDetailSkeleton.tsx` (27 lines): old two-column skeleton (`data-testid="release-detail-skeleton"`, 288px sidebar). Rebuild.
- `release-detail/useReleaseDetail.ts` (700 lines; test 1252 lines): returns all of the data listed in the `ReleaseDetailPage` destructure plus `fixVersionIssues`, `storyPointsFieldKey`, `milestones`, `milestoneWindow` (unused by page).

### Data sources already available (no new fetch needed)
| Need | Source in `useReleaseDetail` | Query key |
|------|------------------------------|-----------|
| Issues (status, assignee, type, SP) | `releaseIssues` / `fixVersionIssues` | `['jira-fixversion-issues', versionId, storyPointsFieldKey]` |
| All fix versions (previous-version date) | internal `fixVersions` (NOT currently returned; only `version` is). Return `fixVersions` (or a derived `previousVersion`) | `['jira-fix-versions', activeJiraProject]` |
| MR list for donut | `releaseMrs` (= `milestoneMRs ?? []`, channel B) | `mrChannelKeys.milestone(...)` |
| MR streaming flag | `isLoadingDrift` mixes 4 inputs (A,B,C, milestones); donut should key off channel B alone: `milestoneMRs` presence, `gitlabMatch.type !== 'none'`; add `isLoadingChannelB` to the return if needed | |
| Header breakdown (seeded) | `headerBreakdown/Loading/Error` | seed key `releaseBreakdownSeedKey` |
| Facts | `gitlabMatch`, `matchedMilestone`, `branchState`, `mergeBackVerdict`, `labelCoverage`, `storyPoints`, `hasStoryPoints`, `canCreateMilestone` (computed in page) | |
| Updated timestamp | not exposed. Use `dataUpdatedAt` from the fix-versions/issues queries (add to return) or a local `lastRefreshed` state like `AioCycleDetailPage` | |

### Phase 93 list code the detail must match
- `routes/dashboard/releases-list/ReleasesHero.tsx`: `Stat` pattern (icon `size-3.5 opacity-70` + `font-medium` text, status-only tone), header `border-b px-6 py-4`, `text-3xl` title, "Updated {relativeTime}" + "Refresh" (`RefreshCw size-3`, `animate-spin` while refreshing). **The UI-SPEC overrides this for the detail page:** CycleHeader style (`text-lg`, no `border-b`, "Refreshed: HH:MM:SS", icon-only refresh). Follow the UI-SPEC.
- `routes/dashboard/releases-list/ReleaseAgendaParts.tsx`: `SegmentedBar` (private), `ReleaseIssuesSlot`, `ReleaseTeam` (assignees), `NextReleaseCard`.
- `lib/release-refresh.ts` `refreshReleaseList`; list `ReleasesTab.tsx:93` `handleRefresh` with `refreshing` state.
- `aio-cycle/CycleHeader.tsx` (the approved header model): meta items array with `<Fragment>` + `·` separators, every item conditional so absent data renders no element AND no separator; `CalendarDays size-3.5`; overdue in red. Copy this items-array pattern for the meta line.

## Architecture Patterns

### Data flow
```
Jira REST  -> fetchFixVersionIssues (+created,+resolutiondate) -> ['jira-fixversion-issues',vid,spKey]
Jira REST  -> fetchFixVersions                                  -> ['jira-fix-versions',project]
GitLab REST-> milestone MRs (ch.B) / project MRs (ch.A) / branch MRs (ch.C) / branch / tags / compare
                         |
                  useReleaseDetail (single hook)
      +------------------+-----------------------------+
      | pure derivations (new, unit-tested)            |
      |  previousVersionDate(fixVersions, version)     |
      |  deriveReleaseBurnup(issues, axis, today)      |
      |  deriveTypeBuckets / assignee buckets          |
      |  computeMrStateCounts(+draft)                  |
      +------------------+-----------------------------+
                         v
 ReleaseDetailPage  (scroll wrapper, container-type inline-size, named `page`)
   Header (title, pill, actions, meta line + facts, description)
   DoneBar (ReleaseIssueGraph)
   Graph grid: [ quad: Burnup | MR donut ; Assignee | Type ]  [ side: Labels, Deployment mismatches ]
   UnifiedTaskTable (sticky ColumnHeaderStrip)
   dialogs: Edit / CreateBranch / CreateMilestone
```

### Recommended structure (new/changed files)
```
src/routes/dashboard/release-detail/
  ReleaseHeader.tsx            # rewrite ReleaseDetailHeader (keep ReleaseBreadcrumbHeader)
  ReleaseFacts.tsx             # NEW: facts items (ex-sidebar rows), exports RowAction etc.
  ReleaseDescription.tsx       # NEW: clamp + more/less (replaces DescriptionsSection)
  graphs/
    ReleaseBurnup.tsx          # NEW ('use no memo')
    ReleaseMrDonut.tsx         # NEW
    ReleaseAssigneeRows.tsx    # NEW
    ReleaseTypeWaffle.tsx      # NEW
    GraphSlot.tsx              # NEW: fixed-size slot w/ skeleton / dashed empty / error
  releaseBurnup.ts             # NEW pure: axis + series + previousVersionDate
  releaseBuckets.ts            # NEW pure: type buckets (+ assignee wrapper)
  ReleaseDetailSkeleton.tsx    # rebuild
  (delete) ReleaseDetailSidebar.tsx, DescriptionsSection.tsx, MetaRow.tsx after porting tests
src/lib/release-refresh.ts     # + refreshReleaseDetail
src/services/jira.ts           # + 'created','resolutiondate' in fetchFixVersionIssues fields
src/stores/settings.store.ts   # remove releaseDetailPanelWidth, bump persist version
```
Place pure modules next to existing pure modules (`releaseSummaries.ts` pattern) and keep `useReleaseDetail` as the single entry; expose new derivations as additive return fields so existing `useReleaseDetail.test.tsx` stays valid.

### Burnup derivation (D-03/D-04), prescriptive
- `previousVersionDate(fixVersions, version)`: among versions with a valid `releaseDate`, `id !== version.id`, `releaseDate <` this version's `releaseDate`, take the max date (released or not). Undated current version -> `null`. Ties/same date: strictly-less comparison means a same-day sibling is not "previous" (consistent with spec "immediately before by date"); document this.
- Axis start = previous date, else earliest valid `created` day (`validKey` logic: `slice(0,10)` + regex; `validKey` is **private** in `lib/epic-progress.ts` — export it or reimplement in the new pure module). Axis end = `releaseDate` if `>= today`... precisely: end = releaseDate when set and (released or releaseDate >= today); else today (undated, or past & unreleased). Released releases end at release date with no TODAY marker; overdue shows dashed RELEASE marker before TODAY (UI-SPEC state table).
- Series: one point per calendar day over [start, end∩<=today]. `scope(d)` = count of issues with `clamp(created, start, ...) <= d`; `done(d)` = count of issues with category `done` and `doneDay <= d` where `doneDay = clamp(resolutiondate day, start, today)`. If a done issue lacks `resolutiondate`, fallback to `doneDateKey()` semantic (`epic-progress.ts:125`: uses `statuscategorychangedate`/`updated`, which the fetch does NOT request) -> practical fallback: date it at axis start? or today? Recommend: undated done issue counted as done at **today** only if data lacks resolutiondate (it keeps done count consistent with the header bar at the right edge). Flag as assumption A2.
- Final point must reconcile with the header bar: `done(today)` = `issueStatusCounts.done` and `scope(today)` = total (unit test this invariant; issues created after the axis start are clamped at start, issues created in the future are impossible).
- Story points in the tooltip: cumulative SP of done issues at that day (`issueStoryPoints`, exported from `releaseSummaries.ts`).
- Fewer than 2 points -> slot placeholder "Not enough history yet - the burnup starts after the first day".
- Date handling: Jira `created`/`resolutiondate` carry the server offset; slice(0,10) gives the server-local day (the epic code already accepts this, `doneDateKey` comment). `today` for the page = `toLocalDateString(new Date())` (already used by `releaseHeaderPill`). Use UTC-safe `dateKeyMs`/`timeTicks` (memory: timeTicks is UTC not local).

### Pattern: fixed-size graph slots
Each graph is wrapped in a `GraphSlot` with a fixed height and three states: skeleton (`Skeleton` at final size), dashed-border muted empty ("No issues"/"No MRs in this milestone"), and error ("Couldn't load issues. Refresh to try again." per UI-SPEC copy). Loading flag for issue graphs = `isLoadingIssues`; error = query `isError` (NOT currently exported from the hook as such: `headerBreakdownError` is `!fixVersionIssues && !seedBreakdown && isIssuesError`; export a plain `issuesError` for slots).

### Pattern: React Compiler vs recharts
The app uses babel-plugin-react-compiler 1.0.0; every chart file in the repo that touches recharts / refs-driven width opts out with `'use no memo';` on line 1 (`EpicTimeBurnup`, `EpicCfdChart`, `CycleBurndown`, `HoursCommitsChart`, `UpcomingReleasesTimeline`, ...). `[VERIFIED: grep]` Put `'use no memo'` at the top of `ReleaseBurnup.tsx` (and the donut file if it measures width). Avoid hidden module-level reads in render (memory: React Compiler vs module reads). Vitest does NOT run the compiler, so a compiler-only bug will not show in tests - verify by rendering in the app.

### Pattern: container queries
Wrapper = scroll element with `container-type: inline-size` named `page` (Tailwind v4: `@container/page` and children `@max-[980px]/page:...`). Memory: container variants never style the container itself, so the breakpoints must be applied on children, never on the scroll wrapper. `UnifiedTaskTable`'s root `<section className="@container">` is its own container — its internal `@max-[860px]` / `@max-[520px]` classes continue to work independent of the page container. The UI-SPEC's "<=860px drops assignee name" row is that existing table behaviour (no change).

### Pattern: sticky table header
`ColumnHeaderStrip` (and `SecondaryHeaderStrip`? UI-SPEC says "its column header") -> add `sticky top-(--release-sticky-top,0px) z-10` and an opaque background (currently `bg-muted/30`, translucent: scrolling rows would show through; use the `color-mix(...)` opaque background used by `ExecutionsList`). Caveats to check at render: (a) its containing block is the `<section class="@container">` which also holds banners — fine; (b) `container-type` on the section applies layout containment, which is OK for sticky relative to an outer scroller but verify in WebKit/Tauri; (c) no ancestor between the strip and the scroll wrapper may have `overflow` other than visible. The old page had `overflow-auto` wrappers; the new one must have exactly one scroll container.

### Anti-patterns to avoid
- Re-introducing `Card` panels, `StatTile`, `ChartWrapper` (deleted; guard test exists) - detail pages use plain sections.
- Colour for non-status meaning (type icon colours, per-assignee colours).
- Showing a figure twice (status counts as text + bar; MR counts as text + donut centre/values: UI-SPEC allows donut centre total + side values as one chart, but no extra text elsewhere).
- Adding Recharts `Legend`.
- Duplicating the done figure outside the header bar.
- Editing JQL / ORDER BY in `fetchFixVersionIssues`: other consumers' ordering and the cache key depend on it.
- `useReleaseDetail` signature changes that break destructuring in tests: add fields only.
- Inline find-replace of identifiers that also appear in labels; no `biome --write` over all of `src` (memory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status colours/segments | new colour map | `RELEASE_SEGMENT_CLASS/ORDER`, `releaseTooltipRows` | single source, matches list + header |
| Assignee grouping + avatar url | new reducer | `deriveAssigneeBuckets` (`lib/epic-progress.ts`) | handles DC username keying, Unassigned, avatar extraction |
| Axis ticks | custom tick math | `timeTicks`, `dateKeyMs` | calendar-aligned, UTC-safe, tested |
| Donut | custom SVG arcs | `AioDonut` (+ `AioDonutSkeleton`) | fixed-size recharts, tooltip z-index handled |
| Avatars | `<img>` | `CachedAvatar` with explicit px size | caching + 0-width collapse gotcha |
| Tooltips | custom popover | `Tooltip` + `TooltipBody/TooltipRow` | consistent surface, <=4 rows |
| Dialog confirm flows | new dialogs | existing `CreateBranchDialog`/`CreateMilestoneDialog` | confirm-gated, close-on-success behaviour (P88) |
| Refresh orchestration | ad-hoc invalidations | new `refreshReleaseDetail` modelled on `refreshReleaseList` / `refreshAioCycleDetail` (upstream-first, staged awaits) | children keyed by upstream ids |
| Markdown for GitLab description | custom parser | existing `ReactMarkdown` + `remark-gfm` (as `DescriptionsSection`) | already used |

## Runtime State Inventory

Partial removal (a persisted setting), so for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | zustand persisted settings contain `releaseDetailPanelWidth` for existing users (localStorage/Tauri store) | Bump persist `version` 31 -> 32; in migrate `if (version < 32) delete s.releaseDetailPanelWidth`. Keep older blocks (v14 assigns 288, v31 narrows 288->256) — harmless in sequence, and `settings.store.test.ts:505` greps the v31 block text |
| Live service config | None - verified: setting is client-local | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | None | none |

Code edits for the removal (`[VERIFIED: grep]`): `stores/settings.store.ts` lines 56 (default), 160 (type), 273 (setter `setReleaseDetailPanelWidth`), 437 & 499 (migrations, keep); `stores/settings.store.test.ts` lines 82, 106-107, 127 (tests to delete/adjust), 505 (v31 text assertion - keep valid) and the `persist version is 31` assertion at ~line 503 (update to 32). `hooks/useResizable.ts` stays (used by Sidebar, PeekPanel). Check `Settings` UI or backup/export code for other references (grep found none outside the store + page).

## Common Pitfalls

### 1. `SegmentedBar` is not exported
**What goes wrong:** plan assumes CONTEXT's "reuse SegmentedBar"; import fails. **Fix:** export it from `ReleaseAgendaParts.tsx` or extract to `components/release/`; keep list tests green (`ReleaseAgenda.test.tsx`).

### 2. Burnup final point disagrees with the header bar
Created-date clamping and `statusCategory=done` + `resolutiondate` can drift from the status buckets (done issue without `resolutiondate`, reopened issue with stale `resolutiondate`, issue moved back from done). **Avoid:** derive the *last* point from `issueStatusCounts` truth (done today = category done count) and assert in a test; reopened issues (category not done but have a resolutiondate) must not count as done.

### 3. Recharts/WebKit specifics
`interval={0}` or explicit `ticks` or ticks vanish; `timeTicks` is UTC-based; tooltip needs explicit `z-index` over overlays; donut must be fixed-size (no `ResponsiveContainer`, 0-size measurement in WebKit/Tauri); chart label end-flip at right edge is hand-made (custom `label` on last point).

### 4. React Compiler: `'use no memo'` for chart files; no module-level reads.

### 5. Query-key churn / blink
Do not derive any query key from a loading query (previous-version date is derived *after* `fixVersions` resolves and is used only in pure derivation, not in any key). Disabled v5 queries have `isPending` forever: use presence of data, not `isLoading`, for GitLab-off cases (`gitlabReady` false -> donut slot removed, burnup `col-span-full`).

### 6. Cache-key contracts
`['jira-fixversion-issues', versionId, spKey]` is invalidated by `FieldsSection`, `useFieldMutation`, `useDeploymentPackageSync`, `parentCompletion`: adding two fields to the response only changes payload. Only one caller of `fetchFixVersionIssues` (`useReleaseDetail`); `useReleaseDetail.test.tsx` mocks it. Add a service-level URL test asserting `created,resolutiondate` are present AND JQL/order unchanged (no existing test for the URL: `services/jira*.test.ts` has none for this function).

### 7. Facts-strip regressions
The old `MR Labels` row with N unlabeled MRs rendered a clickable list. A <=4-row tooltip cannot hold links or >4 MRs. Decide explicitly (Open Question 1). Also: `gitlabMatch.type === 'none'` with GitLab configured shows "Create milestone"/"Set a release date first" (NOT hidden); "No GitLab" in the UI-SPEC means GitLab **not configured** (`!gitlabBaseUrl || !activeGitlabProject`) -> hide Milestone/Branch/Merged back/MR labels. Derive `gitlabConfigured` in the page from `useReleaseDetail`'s `gitlabBaseUrl`/`activeGitlabProject`.

### 8. Descriptions
Jira description is plain text, GitLab description is markdown. A 2-line `line-clamp` over rendered markdown (lists/paragraphs) clamps visually but `-webkit-line-clamp` only works on a single block-level box; render the GitLab markdown inside the clamped wrapper with `[&_p]:inline`-style resets or clamp the plain-text variant only and expand to full markdown on "more". "More/less toggle only when it overflows": measure `scrollHeight > clientHeight` in a layout effect/ResizeObserver (compiler-safe: refs + effect, not render-time DOM reads). "No description" states from the sidebar disappear (nothing rendered when absent) - acceptable per UI-SPEC ("hidden facts hide with separator").

### 9. IssueTypeIcon colours
It hard-codes colours per type; "colour = status only" -> muted wrapper; check cascade (class string concat, not tailwind-merge).

### 10. Squashed layout traps
- `statusPillClass` needs a flex parent (the header pill wrapper).
- Italic text inside `truncate` needs `pr-0.5` (branch tag-pending/failed italics).
- Tailwind v4 `space-y-*` + child `-my` collapses gaps - use `gap-*` grids.
- `CachedAvatar` explicit px sizing in grid cells (0-width collapse).
- Tooltip trigger inside a row with overlay button: z-index (`relative z-10`) as `ReleaseIssueGraph` does.

### 11. Pre-commit runs the full vitest suite + biome
Combine RED/GREEN into one commit per task; Biome baseline has ~16 pre-existing diagnostics (do not gate on an absolute count; gate on no NEW files flagged); lint `biome check` not `biome lint`.

### 12. Sketch/UI-SPEC vs CONTEXT conflicts (resolved by UI-SPEC)
Header size/style (UI-SPEC wins over D-11), fact chips -> `Name: value` inline meta (UI-SPEC wins over D-08's chip icons; behavioural requirements of D-08 remain), "Refreshed: HH:MM:SS" wording vs ReleasesHero "Updated". Planner should follow the UI-SPEC.

## Code Examples

### Additive fields (D-03) - `src/services/jira.ts` `fetchFixVersionIssues`
```typescript
const fields = [
  'summary', 'status', 'assignee', 'issuetype',
  ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  'customfield_15725', 'fixVersions', 'project',
  // Release burnup (P94): additive only, JQL/order unchanged.
  'created', 'resolutiondate',
].join(',');
```
(`JiraIssue.fields.created?: string` and `resolutiondate?: string | null` already exist, `services/jira.ts:188`.)

### MR state with draft (donut) - extend `computeMrStateCounts`
```typescript
// releaseSummaries.ts: keep {merged, opened, closed} contract for existing tests; add a sibling
export function computeMrDonutCounts(mrs: GitLabMR[]) {
  let merged = 0, open = 0, draft = 0, closed = 0;
  for (const mr of mrs) {
    if (mr.state === 'merged') merged++;
    else if (mr.state === 'opened') (mr.draft ? draft++ : open++);
    else closed++;            // closed + locked, as today
  }
  return { merged, open, draft, closed };
}
```
Prefer adding a new function over changing `computeMrStateCounts` (existing `releaseSummaries.test.ts` asserts its shape; the sidebar consumer goes away anyway, so either is fine - pick one and update the test).

### Refresh (upstream-first) - `src/lib/release-refresh.ts`
```typescript
export async function refreshReleaseDetail(qc: QueryClient, args: {
  activeJiraProject?: string | null; activeGitlabProject?: number | null; versionId: string;
}) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['jira-fix-versions', args.activeJiraProject] }),
    qc.invalidateQueries({ queryKey: ['gitlab-milestones', args.activeGitlabProject] }), // match useEditRelease invalidations
  ]);
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['jira-fixversion-issues', args.versionId] }),
    qc.invalidateQueries({ queryKey: mrChannelKeys.channelForProject('gitlab-milestone-mrs', args.activeGitlabProject) }),
    qc.invalidateQueries({ queryKey: ['gitlab-branch', args.activeGitlabProject] }),
    /* + channel A/C prefixes, tags, compare as useEditRelease does (lines ~160-180) */
  ]);
}
```
Model the exact prefix set on `useEditRelease.ts` lines 164-174 and `mrChannelKeys.ts` (WR-06: keys declared once there). Must stay upstream-first because the milestone/branch/MR keys derive from `fix-versions` + milestones (query-key churn).

### Sticky strip
```tsx
<div className="sticky top-(--release-sticky-top,0px) z-10 flex items-center gap-2 border-b bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))] ...">
```

## State of the Art

| Old (current page) | New | Impact |
|--------------------|-----|--------|
| Resizable right sidebar with Details | Full-width page, facts as inline `Name: value` meta | delete `useResizable` wiring + `releaseDetailPanelWidth` |
| Text counts for MR/issue states | Graphs with tooltips | remove Badge rows |
| Header `text-xl` echo of list row | CycleHeader-style `text-lg` + meta line | `ReleaseDetailHeader` rewrite; `ReleaseHeader.test.tsx` updates |
| Left column own scroller | Single page scroll wrapper + sticky table header | one scroll container |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ChartSlice` shape in `lib/aio-cycle-charts.ts` is `{label,value,color,rows[]}`-like and the donut can take MR slices unchanged | Reusable components | Small adapter needed; read the file when planning |
| A2 | A done issue with no `resolutiondate` is dated "today" (or, alternatively, axis start) in the burnup | Burnup derivation | Burnup shows a step at the right edge; user may prefer another rule - confirm or accept |
| A3 | Same-day sibling versions are not "previous" (strict `<`) | Burnup derivation | Axis could start at a same-date version; edge case only |
| A4 | `cached-avatar.tsx` lives at `src/components/ui/cached-avatar.tsx` (grep matched `export function CachedAvatar` at line 54 of an unnamed file) | Reusable components | Wrong import path; verify with grep |
| A5 | `IssueTypeIcon` can be muted with a wrapper class | Pitfall 9 | Needs a prop; small |
| A6 | `ReleaseStatusPill` / `ReleasePackageCell` render acceptably in the CycleHeader meta line without changes | Reusable components | May need a `compact`/layout prop |

## Open Questions (RESOLVED)

1. **Unlabeled-MR list in the MR labels fact.**
   - Known: sidebar shows an inline clickable list (`!iid` link + title) for each unlabeled MR; UI-SPEC says "tooltip lists unlabeled MRs, <= 4 rows".
   - Unclear: behaviour for > 4 unlabeled MRs and loss of click-through (links inside a tooltip are not reachable).
   - Recommendation: tooltip shows first 3 + "+N more"; and make the fact a `Popover` (click) listing all unlabeled MRs with links if the planner wants zero information loss ("every state reachable" in D-08). Surface to user/planner as a decision; default = Popover on click, tooltip on hover.
   - RESOLVED: D-15 (user) — hover tooltip only, first 3 + "+N more", no popover/links.
2. **Page-level "Refresh" scope** - detail has no refresh today; define it as refresh of fix versions, issues, GitLab milestone/MR/branch channels (not RM package queries unless the pkg hook is keyed by something stale).
   - RESOLVED: plan 94-02 `refreshReleaseDetail` (upstream-first: fix versions, issues, GitLab channels).
3. **Draft MR slice** - UI-SPEC says "Requires adding a draft flag to `mrStateCounts`". Confirm that donut classifies from channel B (`milestoneMRs`) only (matches what the old MRs row showed).
   - RESOLVED: plan 94-01 `computeMrDonutCounts` classifies channel B (`milestoneMRs`) only.
4. **"Updated" source** - use `max(dataUpdatedAt)` of issues + fix-versions queries vs a local timestamp; AIO uses a `lastRefreshed` string.
   - RESOLVED: plan 94-07 uses the issues query's `dataUpdatedAt` for "Refreshed: HH:MM:SS".

## Environment Availability

Skipped: no external tools beyond the repo toolchain (node/npm/vitest/biome/tsc already used by the project). Visual verification uses the throwaway vite page + cached Chromium recipe (memory: context-parent-rows) or the sketch HTML at `.claude/skills/sketch-findings-taskflow/sources/003-release-detail-page/index.html` as the reference to compare against.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18, jsdom, globals, `@testing-library/react`; React Compiler NOT applied in tests |
| Config file | `vitest.config.ts` (inner app dir), setup `src/test/setup.ts` |
| Quick run command | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/components/release src/lib/release-list src/lib/release-refresh` |
| Full suite command | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm test && npm run check` (also run by the pre-commit hook) |

### Phase Decisions -> Test Map
| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-03 | `fetchFixVersionIssues` requests `created,resolutiondate`; JQL/order unchanged | unit (service) | `npx vitest run src/services/jira.fixVersionIssues.test.ts` | ❌ Wave 0 |
| D-03 | previous-version resolver (released/unreleased, undated, ties, none) | unit | `npx vitest run src/routes/dashboard/release-detail/releaseBurnup.test.ts` | ❌ Wave 0 |
| D-03/D-04 | burnup series: clamp scope to start, done by resolutiondate, reopened not done, missing resolutiondate rule, final point == `issueStatusCounts`, axis end rules (released / future / overdue / undated), <2 points | unit | same file | ❌ Wave 0 |
| D-05 | MR donut counts incl. draft; type buckets order done->progress->todo; assignee rows sort total desc, Unassigned last | unit | `npx vitest run src/routes/dashboard/release-detail/releaseBuckets.test.ts src/routes/dashboard/release-detail/releaseSummaries.test.ts` | ❌ Wave 0 (releaseSummaries test exists) |
| D-05/D-06 | Graph components: loading skeleton / empty "No issues" / "No MRs" / error copy / aria-label summaries / tooltip rows <= 4 / no legend | component | `npx vitest run src/routes/dashboard/release-detail/graphs` | ❌ Wave 0 |
| D-06 | Sidebar count rows gone; no duplicated figure | component | `ReleaseDetailPage` render test | ❌ Wave 0 |
| D-07 | `releaseDetailPanelWidth` removed; persist version 32; old persisted state migrates (field deleted) | unit | `npx vitest run src/stores/settings.store.test.ts` | ✅ (update) |
| D-07/D-13 | Page renders without sidebar / resizer; single scroll wrapper; `UnifiedTaskTable` header has sticky class | component | `npx vitest run src/routes/dashboard/ReleaseDetailPage.test.tsx` | ❌ Wave 0 |
| D-08 | Every sidebar state reachable from facts strip with same testids (milestone exact/fuzzy/none+create/set-date-first; all branch kinds; merge-back 4 kinds + hidden; labels all/N-M missing/loading; SP) | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseFacts.test.tsx` (port of `ReleaseDetailSidebar.test.tsx`) | ❌ Wave 0 (source test exists) |
| D-08 | No GitLab configured hides GitLab facts, keeps Story points | component | same | ❌ |
| D-09 | Description clamp + more/less only on overflow; milestone description only when it differs | component | `ReleaseDescription.test.tsx` | ❌ Wave 0 |
| D-11/D-12 | Header: title, pill, date, package (hidden when RM off), Pin/Edit/Open in Jira, Refresh; red overdue date; "No release date" amber | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseHeader.test.tsx` | ✅ (update) |
| D-13 | `refreshReleaseDetail` staged invalidation order | unit | `npx vitest run src/lib/release-refresh.test.ts` | ❌ (create/extend) |
| D-14 | EditReleaseModal still opens from Edit and saves | existing | `useEditRelease` / page test | partial |
| Skeleton | `ReleaseDetailSkeleton` mirrors layout (slots present, no sidebar) | component | `ReleaseDetailSkeleton.test.tsx` | ❌ Wave 0 |
| Locked | Table anatomy untouched | existing | `npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx` | ✅ |
| Locked | Data hook contracts untouched (additive fields only) | existing | `npx vitest run src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | ✅ (extend for `fixVersions`/new returns) |

Manual / visual (cannot be unit-tested): sticky header in WebKit, recharts tick/marker rendering, React-Compiler-only bugs, narrow-width breakpoints (980/640/440), container-query behaviour. Verify by rendering the real page (throwaway vite page + cached Chromium or the Tauri app) against the sketch HTML at each width; and screenshot-compare burnup states (released / undated / overdue).

### Sampling Rate
- **Per task commit:** quick run command above (pre-commit also runs the full suite + biome).
- **Per wave merge:** `npm test && npm run check`.
- **Phase gate:** full suite green + visual check before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/services/jira.fixVersionIssues.test.ts` (mock `apiFetch`; assert `fields=` and `jql`)
- [ ] `release-detail/releaseBurnup.test.ts`, `releaseBuckets.test.ts`
- [ ] `release-detail/graphs/*.test.tsx`
- [ ] `release-detail/ReleaseFacts.test.tsx` (port of sidebar tests), `ReleaseDescription.test.tsx`, `ReleaseDetailSkeleton.test.tsx`
- [ ] `src/routes/dashboard/ReleaseDetailPage.test.tsx` (none exists today)
- [ ] `src/lib/release-refresh.test.ts` (check for an existing file first)
- No framework install needed.

## Security Domain

Applicable ASVS categories (frontend refactor, no new endpoints, no new auth surface):

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4 | no | unchanged (PAT via Stronghold `readSecret`) |
| V5 Input Validation | yes (render of remote text) | GitLab milestone description rendered by `ReactMarkdown` (no `rehype-raw`; keep it that way, do not use `dangerouslySetInnerHTML`); Jira description rendered as text; `versionId` validated `^\d+$` in the fetcher (keep) |
| V6 Cryptography | no | none |

Threat patterns: XSS via markdown/description (mitigate: no raw HTML plugin); external links open via `openExternal` + `LinkContextMenu` (existing). No new credentials, no new network targets (only extra Jira fields).

## Sources

### Primary (HIGH confidence) - codebase reads in this session
- `.planning/phases/94-.../94-CONTEXT.md`, `94-UI-SPEC.md`; `.claude/skills/sketch-findings-taskflow/SKILL.md` (+ references/release-detail-page.md, release-detail-states.md named there)
- `src/routes/dashboard/ReleaseDetailPage.tsx`, `release-detail/{ReleaseHeader,ReleaseDetailSidebar,DescriptionsSection,LabelSummarySection,ReleaseDetailSkeleton,UnifiedTaskTable,useReleaseDetail,releaseSummaries}.ts(x)`
- `src/services/jira.ts` (`fetchFixVersionIssues`, `JiraIssue`, `JiraFixVersion`), `src/services/gitlab.ts` (`GitLabMR.draft`)
- `src/lib/{release-list,release-agenda,release-refresh,aio-refresh,epic-progress}.ts`
- `src/routes/dashboard/{AioCycleDetailPage,releases-list/ReleasesHero,releases-list/ReleaseAgendaParts,aio-cycle/AioDonut,aio-cycle/CycleHeader,aio-cycle/CycleBurndown,issue-detail/EpicTimeBurnup}.tsx`
- `src/stores/settings.store.ts` + test; `package.json`, `vitest.config.ts`, `.planning/config.json` (nyquist_validation true)

### Secondary / Tertiary
- None (no external docs were needed; no web research performed).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; all reused assets located in code.
- Architecture: HIGH - hook/data flow read end-to-end; sketch + UI-SPEC are approved contracts.
- Pitfalls: MEDIUM-HIGH - codebase-derived plus project memory; WebKit sticky/container-type interplay and the unlabeled-MR UX are unverified until rendered.

**Research date:** 2026-10-30
**Valid until:** ~30 days (internal code; invalidated if Phase 93 gap work lands in the touched files)
