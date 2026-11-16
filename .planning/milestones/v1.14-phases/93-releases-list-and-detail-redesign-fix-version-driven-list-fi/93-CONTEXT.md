# Phase 93: Releases list and detail redesign - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the **Releases list** (`ReleasesTab.tsx`) as a fix-version-driven list. Each row shows the fix version, its matched Release Management (RM) deployment package, its date, its status and a small graph of its issues. GitLab milestones and release branches are **removed from the list**. The list should look polished and consistent with the app, and load fast.

Restyle the **release detail page** (`ReleaseDetailPage.tsx`) to match the list. It **keeps all of its current information** (milestone, branch, merge-back, MR labels, drift and fix cells, deployment-package section, unified task table, edit, pin) but presents it in the new visual language.

Out of scope: new release capabilities, new drift checks, changes to the unified task table's anatomy and behaviour (locked by P90/P91.1).

</domain>

<decisions>
## Implementation Decisions

### List: what is removed (reverses P88 D-17, intentionally)
- **D-01 (user, from phase title):** GitLab **milestone** and **release-branch** indicators are removed from list rows. This intentionally reverses P88 D-17 (the user then asked for missing-branch/milestone icons on rows). Do not keep them "just in case". Milestone and branch status still live on the detail page sidebar.
- **D-02:** Since the list no longer needs them, the list's GitLab fetches are dropped: `fetchProjectMilestonesInRange` (windowed `gitlab-milestones` query) and `fetchProjectBranches` (`gitlab-release-branches`). Their "GitLab unavailable" chips go too. The list makes **no GitLab requests**. The detail page keeps its own queries. Do not change the windowed milestone query key used by `useReleaseDetail` / `UpcomingReleasesTimeline` (P87 D-11 / P88 D-05 cache contract); only the list stops subscribing to it.

### List: structure and styling
- **D-03 (user):** **Grouped sections.** Show a small **"Upcoming"** group label and a **"Released"** group label, separated by hairlines, using an **AioCycleList-style column grid** with a header strip. Columns: version · RM package · date · status · issue graph.
- **D-04 (user):** **Keep today's ordering inside Upcoming:** undated versions first, then dated unreleased versions by date **descending**. Released: date descending. The user rejected "soonest first". Do not re-sort.
- **D-05 (user):** **One status pill per row**, built on the shared pill layout (`STATUS_PILL_LAYOUT_CLASS` / `tonePillClass`): **Released** green, **Overdue** red, **Due today** blue, **In N days** neutral, **No date** amber. This replaces today's stacked Unreleased + Overdue + "⚠ No date set" badges. A pill needs a flex parent (see memory: statusPillClass needs a flex parent).
- **D-06 (user):** **Keep issue progress as a small graph** in each row (today's "N / M done" text becomes a graph). It must be fetched lazily, only for visible rows, and stream in (see D-11/D-12).
- **D-07 (user, free text):** The user wants **"a nice list"**:
  - Rows **may be taller** than today's single line if that helps.
  - Each row gets a **small graph of the issues in the release** ("small, nothing big").
  - It must look **professional, polished and consistent with the app's design**.
  - Claude may be **creative**, but the list must **not be overwhelming**.
  - Apply the user's recorded dashboard preferences: colour encodes status only, tooltips of 4 rows or fewer, no legends, identical treatment across rows.
- **D-08 (user):** **Released paging stays:** show the 5 most recent released versions, then a "Show N more" row that adds 10 at a time. Graph data is fetched only once rows are revealed.

### List: loading
- **D-09 (user):** **Only the fix-version request blocks first paint.** Name, date and status pill render as soon as `fetchFixVersions` returns. The RM package cell and the issue graph fill **fixed-size slots** with a quiet skeleton, so nothing shifts when they arrive.
- **D-10 (user):** **Revisits are instant from cache.** The cached list renders immediately and revalidates in the background with **no skeleton** (today's Refresh sets `isRefreshing` and blanks the list; that changes). A **Refresh control matching the one added to the AIO cycles pages in quick 261029-qez** forces a reload, refreshing upstream sources first (see memory: enrichment invalidation no-op).
- **D-11 (Claude, technical):** Issue-graph data comes from **one batched Jira search for all visible versions** (`fixVersion in (…)`, `fields=status,fixVersions`, **fully paginated with no page cap**), grouped by version client-side. This replaces today's `useQueries` fan-out of `fetchVersionIssueCounts`, which issues 2 searches for **every** fix version, including the hidden released ones. Revealing more released rows fetches only the new versions' issues. Avoid the fetch-once page-cap trap. The planner may choose the exact query-key shape, but must keep it per-version-set stable so it does not churn (see memory: query-key churn blink).
- **D-12 (Claude, technical):** RM package data keeps the existing lazy `useRmWeekIndex({ dates })` path: one shared week list, with children only for the visible rows' weeks. When no RM project is configured, the package column is **hidden entirely**, not shown as empty dashes.

### Detail page restyle
- **D-13 (user):** **Header that echoes the list row.**
  - It shows the version name, the **same status pill**, the date and the RM package.
  - Under that sits a **wider version of the same issue status graph** with "N / M done".
  - **Pin, Edit and Open in Jira move up into the header's right side.** The action-button row at the bottom of the left column goes away, and Edit no longer lives only in the sidebar's Details heading.
  - The rocket icon / `v{id}` mono line can be dropped or demoted.
- **D-14 (user):** **The header owns each figure, shown once** (consistent with the "no figure shown twice" preference).
  - The **unified task table header drops its progress bar and the "N / M done" badge** but **keeps the flagged-MR count**. This refines P91.1 D-14: readiness moves to the page header and drift health stays on the table.
  - The **sidebar drops its Status and Date rows** and keeps Milestone, Branch, Merged back, MR Labels, MRs, Issues (per-status breakdown), Story points and Descriptions.
  - The sidebar's per-status Issues breakdown is finer than the header graph's category segments, so it is not a duplicate.
  - No information is lost from the page.
- **D-15 (user):** **Body: polish, don't restructure.** Label summary, deployment-package mismatches and the unified task table get consistent section headings, spacing and type scale matching the new header and list. Table anatomy, columns, row and sub-line behaviour, drift/fix cells, ordering and loading states from P89/P90/P91.1 stay **exactly as built**. Respect the "detail pages: no card panels" preference: sections use h3/rows, and cards are only for KPI tiles.

### Claude's Discretion
- **Row anatomy** (the user did not select this area): exact column widths, row height, and whether the RM package and date sit on a second muted line inside a taller row versus separate columns. Pick the calmest option that passes D-07, keeping in mind the user's "one row = one line" preference from P91.2. Taller rows are explicitly allowed here, but do not cram.
- **RM cell states:** with a matched child, show the formatted week label plus the child key (as today, `formatWeekLabel` + mono key, with a tooltip giving the full summaries). With a week but no child, show the week label muted plus a tooltip. With no week, show a muted dash.
- **Issue graph form (user said "you decide"):** Claude leans towards a **slim segmented status-category bar** (To Do / In Progress / Done) with a `done / total` figure and a tooltip of 4 rows or fewer, reusing `PROGRESS_SEGMENT_CLASS` / `progressTooltipRows` styling from `lib/aio-cycle-list.ts`. A mini donut was the alternative and is acceptable if it reads calmer. Zero issues → a muted empty track or "No issues", not a 0/0 bar.
- **Detail first paint (user said "you decide"):** coming from the list, render the header immediately from the cached fix version and graph data rather than the full-page `ReleaseDetailSkeleton`. Sections stream in under their own placeholders (P91.1 D-17 already does this for MRs). A deep link or pinned tab without cache may still show a skeleton.
- Pill tone for "In N days" ("neutral" here means the muted/grey tone in `tonePillClass`).
- Empty, error and stale-data states keep today's `EmptyState` / `ErrorState` / `StaleDataBanner`, restyled to fit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current implementation (being redesigned)
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — current list: fix versions, milestone/branch fetches to delete, per-version count fan-out to replace, RM package derivation to keep
- `taskflow/src/routes/dashboard/ReleasesSkeleton.tsx` — list skeleton to restyle
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — detail layout and the action-button row moving to the header
- `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx` — `ReleaseTitleHeading` to replace with the row-echo header
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` — Status/Date rows to drop, Edit button to relocate
- `taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` (~line 1002) — progress bar + done badge to remove from the table header; flagged count stays
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — detail data hook (P87 D-07 single-hook rule)

### Design reference (the "app-consistent" target)
- `taskflow/src/routes/dashboard/AioCycleList.tsx` — column grid (`COL`), header strip, `CELL_PADDING` density classes, overlay-button row click, `border-b` rows, segmented progress bar
- `taskflow/src/lib/aio-cycle-list.ts` — `PROGRESS_SEGMENT_CLASS`, `cycleProgress`, `progressTooltipRows`
- `taskflow/src/lib/statusStyles.ts` — `STATUS_PILL_LAYOUT_CLASS`, `tonePillClass`
- Quick task 261029-qez (commits `84b44c34`, `d500ca2c`) — Refresh control and upstream-first refresh helpers to mirror

### Prior phase decisions that still bind
- `.planning/milestones/v1.14-phases/91.1-unified-release-detail-task-table/91.1-CONTEXT.md` — task table anatomy/behaviour (D-01…D-18) stays; D-14 is refined by this phase's D-14
- `.planning/milestones/v1.14-phases/89-three-channel-drift-detection/89-CONTEXT.md` — drift semantics on detail; D-14/D-15 (list-row drift count) is moot because the list drops drift (memory: Phase 89 DRIFT-09 descoped)
- `.planning/milestones/v1.14-phases/88-release-branch-milestone-creation/88-CONTEXT.md` — D-17 (list-row branch/milestone icons) reversed by D-01; D-05 milestone query-key contract still applies to the detail page

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRmWeekIndex({ dates })` + `findWeekForDate` / `findChildForProject` / `formatWeekLabel` (`lib/deployment-package.ts`): the RM package cell already works lazily; reuse it as is.
- `fetchFixVersions` (`services/jira.ts:1239`): the one request that blocks first paint.
- `fetchVersionIssueCounts` (`services/jira.ts:1295`): to be superseded on the list by one batched status search. Check for other consumers before deleting it (`useEditRelease` / `useReleaseDetail` may use the `jira-version-counts` key).
- `useDelayedLoading`, `EmptyState`, `ErrorState`, `StaleDataBanner`, `Tooltip` + `TooltipBody` / `TooltipRow`.
- Breadcrumb seeding in `handleReleaseClick` (reset + push Releases): keep it.

### Established Patterns
- Rows are `div` + flex with explicit-px `flex-none` cells, not `<table>`. Narrow columns collapse to 0 in WebKit/Tauri (memories: table vs flex rows, virtualized 0-width column).
- Full-row click uses the overlay-button pattern (`absolute inset-0` sibling button). Today's whole-row `<button>` contains nested `<a>` links, which is invalid; the overlay pattern fixes this.
- Query client: `staleTime` 5 min, `gcTime: Infinity`, no persistence across app restarts. "Instant revisit" is session-scoped.
- The app uses React Compiler and vitest does not. Avoid hidden module-level reads in render (memory: React Compiler vs module reads).
- Pre-commit runs the full vitest suite and biome. Combine RED and GREEN steps into one commit per TDD task.

### Integration Points
- `/releases` route → `ReleasesTab`; `/release/:versionId` → `ReleaseDetailPage`; pinned release tabs (`REL-{id}`, `usePinnedTabsStore`) must keep working once Pin moves to the header.
- `jira-fix-versions` key is shared with `useEditRelease`, `useReleaseDetail`, `DeploymentPackageSection`, `FieldsSection`, `DeploymentPackageWarning`, `useFieldMutation`, `parentCompletion`. Do not change its shape (memory: shared fetcher cache key).
- Existing tests that will change: `ReleasesTab` tests (testids `gitlab-link-*`, `row-missing-*`, `row-branch-present`, `branches-error-chip` go away), `ReleaseHeader.test.tsx`, `ReleaseDetailSidebar.test.tsx` (Status/Date rows), `UnifiedTaskTable.test.tsx` (header progress).

</code_context>

<specifics>
## Specific Ideas

- The user's words: "I want a nice list. the rows can be bigger if needed. I want a graph of the issues in the release (small, nothing big). Make it look professional, polished and match the design of the app. You can be creative. But make sure it is not overwhelming."
- Visual judgement happens at UAT. Render the list and header (throwaway vite page + cached Chromium, per the context-parent-rows memory) before calling it done.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope.

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md`: colour the priority stripe by Jira priority-scheme rank. Matched only on generic keywords and is unrelated to releases.

</deferred>

---

*Phase: 93-releases-list-and-detail-redesign*
*Context gathered: 2026-10-29*
