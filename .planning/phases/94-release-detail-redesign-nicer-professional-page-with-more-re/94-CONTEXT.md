# Phase 94: Release detail redesign - Context

**Gathered:** 2026-10-30
**Status:** Ready for sketching (`/gsd-sketch`), then planning

<domain>
## Phase Boundary

Redesign the **release detail page** (`/release/:versionId`, `ReleaseDetailPage.tsx`) so it fits the redesigned Releases list.
- It should look cleaner, more professional and easier to read.
- It adds **more graphs about the release**.
- It keeps **all information the page shows today**: header pill, date, package and done bar; milestone, branch, merged-back state, MR labels, MR and issue counts, story points, descriptions, label summary, deployment-package mismatches and the unified task table.
- The **existing actions** stay easy to reach: Pin, Edit (modal), Open in Jira, Create branch, Create milestone, and the per-MR fix cells.

Out of scope:
- New release capabilities and new drift checks.
- Changes to the unified task table's anatomy and behaviour (locked by P89/P90/P91.1).
- New edit surfaces (no inline field editing; see D-14).

</domain>

<decisions>
## Implementation Decisions

### Release graphs
- **D-01 (user):** Add **four graphs**, with the header's done/in-progress/to-do bar still owning the done figure (P93 D-13/D-14):
  1. a **burnup over time**;
  2. **issues by type**;
  3. **issues by assignee**;
  4. an **MR state** graph.
- **D-02 (user):** **Every graph counts issues**, and story points appear only in tooltips. The page uses one unit throughout. There is no Issues/SP toggle.
- **D-03 (user):** The **burnup x-axis starts at the previous version's release date**: the fix version immediately before this one by date, **whether or not it is released**.
  - Fallback (Claude): if no earlier dated version exists, use the earliest issue `created` date.
  - The axis ends at this release's date. If that date is in the past while the release is still unreleased, or if the release is undated, the axis ends today.
  - The burnup needs `created` and `resolutiondate`, which `fetchFixVersionIssues` does not request today.
    - Add them **additively** (JQL and order stay unchanged), following the 261014-eym additive-fields precedent.
    - Do **not** use the changelog.
  - Done means `statusCategory = done`, dated by `resolutiondate`. Scope means the issue's `created` date, clamped to the axis start.
  - Removals from the version are not tracked (no changelog); accept that limitation.
- **D-04 (Claude, user said "you decide"):** The burnup has **no forecast and no ideal line**. It shows scope and done lines, a **TODAY** marker and a **release-date** marker.
  - This keeps it calm, and no second forecast can disagree with the epic forecast (memory: forecast is time-led / one shared forecast).
- **D-05 (user: "you decide, I want variety"):** Each graph uses a **different visual form**, and **colour still encodes status only**.
  - **Burnup:** recharts area/line chart, following the `EpicTimeBurnup` pattern.
  - **MR state:** a **donut** (merged / open / draft / closed). The MR state is a status, so donut colours are legitimate. Reuse `AioDonut` or follow its pattern.
  - **Issues by assignee:** **avatar rows** (`CachedAvatar` + name) with a **slim segmented done/in-progress/to-do bar** and `done/total`. Unassigned issues get their own row.
  - **Issues by type:** **compact stacked status bars** (one per issue type, type icon + label) in a different shape from the assignee rows; for example short vertical columns or a single stacked bar per type in a grid. The sketch should choose.
  - All segments use the shared `RELEASE_SEGMENT_CLASS` / `SegmentedBar` colours.
  - No legends; tooltips have 4 rows or fewer (memory: dashboard UI preferences).
- **D-06 (user):** **Fold the sidebar's count rows into the graphs** so each figure appears once.
  - The per-status **Issues** breakdown becomes graph tooltip detail. Exact status names (finer than categories) appear in the header bar's or type graph's tooltips.
  - The **MRs** state counts become the MR donut.
  - Neither is repeated as text anywhere else.
  - **Story points** total moves to the facts strip (D-08).

### Page layout
- **D-07 (user):** **Full-width layout with no sidebar.**
  - Remove the resizable right sidebar (`ReleaseDetailSidebar` as a column, `useResizable`, and the `releaseDetailPanelWidth` setting together with its store migration handling).
  - Top to bottom: header → facts strip → graphs area → label summary / deployment-package mismatches → unified task table (full width).
- **D-08 (Claude, user said "you decide"):** The sidebar's GitLab facts become a **one-line strip of compact chips** in the header area: **Milestone · Branch · Merged back · MR labels · Story points**.
  - Each chip is an icon, a label and a short state word.
  - **Status tone appears only on problems** (missing, likely not merged, couldn't verify), following `ReleasesHero`'s `Stat` style.
  - The **Create branch / Create milestone** actions, retry-branch-check, and milestone/branch **links live inside their chips**.
  - Full detail goes in a tooltip of 4 rows or fewer: fuzzy-match candidate, tag pending/failed, merge-back reason, label coverage.
  - **Every state the sidebar renders today must stay reachable.** Keep the existing testids or map them one-to-one so `ReleaseDetailSidebar.test.tsx` coverage carries over.
  - The chips wrap on narrow widths and never truncate state words.
- **D-09 (Claude, user said "you decide"):** **Descriptions** (Jira version description, and the GitLab milestone description only when it differs) render as a **muted paragraph under the title**, line-clamped to 2 lines with a "more" toggle.
- **D-10 (user):** **Sketch before planning.** Run `/gsd-sketch` with 2–3 variants of the full-width page using realistic data:
  - graphs-area arrangement;
  - type-graph form;
  - facts-strip density;
  - whether the F5 next-release-card treatment (ambient rocket) suits the graphs area for unreleased releases.
  The winning variant becomes the source of truth, as sketch 002 F5 was for Phase 93.

### Header
- **D-11 (Claude, user said "see how we did the releases page"):** The header **mirrors the shipped Releases page header** (`ReleasesHero`), not the original F5 hero curves, which were departed from at UAT.
  - It uses the standard header bar: `border-b px-6 py-4`.
  - The **release name** is `text-3xl font-semibold`.
  - Under the name, an icon-stat summary line (`text-xs`, `Stat` style) holds:
    - the **status pill**;
    - the **absolute date**;
    - the **RM package** (hidden when no RM project is configured, P93 D-12);
    - the facts chips (D-08).
  - **Updated · Refresh** sits on the right, as on the list (upstream-first refresh, quick 261029-qez), next to **Pin · Edit · Open in Jira**.
  - The wide **done/in-progress/to-do bar with "N / M done"** stays (P93 D-13) and remains the sole owner of the done figure.
- **D-12 (Claude, user said "you decide"):** **Timing comes from the pill.** The pill reuses the list's text (In N days / Due today / Overdue / Released / No date), with the absolute date beside it. There is no separate big countdown figure.

### Actions and field edits
- **D-13 (user: "see how the rest of the app has it"):** Follow the **AIO cycle detail page** scroll model.
  - The breadcrumb bar stays fixed and the rest scrolls as one page.
  - The header (with Pin, Edit, Jira and Refresh), the facts strip and the graphs **scroll away**.
  - The unified task table's **column header sticks** (the `--aio-sticky-top` pattern).
  - There is no extra compact sticky bar and the header is not sticky.
- **D-14 (Claude, user said "you decide"):** **Keep `EditReleaseModal` as built**, opened from the header's Edit button.
  - The Jira and GitLab dual-save logic is unchanged.
  - Do not add inline field editing (that would be a new capability).

### Claude's Discretion
- How to show loading for the graphs area:
  - Every graph has a fixed-size slot with a quiet skeleton, so nothing shifts (P93 D-09 spirit).
  - Graphs whose data comes from issues render as soon as `jira-fixversion-issues` resolves.
  - The MR donut streams with the MR channels.
  - First paint from the list still renders the header from cache (P93 discretion).
- Empty states:
  - Release with no issues: the graphs show a compact muted "No issues", not 0/0 charts.
  - No GitLab configured or no MRs: the MR donut slot shows a muted "No MRs" (or is hidden when GitLab is not configured).
  - Burnup with fewer than 2 data points: show a muted placeholder.
- Narrow widths: the graphs area wraps into a responsive grid using container queries on an inner wrapper (memory: a container query does not apply to the container itself).
- Exact graph sizes, grid arrangement, and whether label summary / package mismatches sit beside the graphs or below them: decide during the sketch.
- `ReleaseDetailSkeleton` must be rebuilt to mirror the new full-width layout (lesson from quick 261030-eic: the skeleton matches the actual content).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current implementation (being redesigned)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`: layout, sidebar resize wiring to remove, dialogs, breadcrumb seeding (keep)
- `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx`: `ReleaseDetailHeader` (P93 row-echo header) and `ReleaseBreadcrumbHeader` (keep)
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx`: every milestone/branch/merge-back/labels state (and testids) that must survive as facts chips
- `taskflow/src/routes/dashboard/release-detail/DescriptionsSection.tsx`, `LabelSummarySection.tsx`, `DeploymentPackageSection.tsx`, `MetaRow.tsx`
- `taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx`: anatomy locked; only its column header becomes sticky in the page scroll
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`: single data hook (P87 D-07); source of `issueStatusCounts`, `mrStateCounts`, `storyPoints`, `labelCoverage`
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx`: rebuild to match the new layout
- `taskflow/src/services/jira.ts` `fetchFixVersionIssues` (~line 1393): add `created`, `resolutiondate` additively
- `taskflow/src/stores/settings.store.ts`: `releaseDetailPanelWidth` (remove with the sidebar)

### Design reference
- `taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx`: header to mirror (title size, `Stat` summary line, Updated · Refresh)
- `taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx`: `SegmentedBar`, `NextReleaseCard` (ambient rocket), issues slot
- `taskflow/src/components/release/`: `ReleaseIssueGraph`, `ReleaseStatusPill`, `ReleasePackageCell`
- `taskflow/src/lib/release-list.ts`: `RELEASE_SEGMENT_CLASS`, `RELEASE_SEGMENT_ORDER`, `releaseTooltipRows`, `StatusBreakdown`
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`: scroll model (header scrolls away, `--aio-sticky-top` sticky list headers), header with Pin/Refresh/Updated
- `taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx`: donut pattern for MR state
- `taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx`, `EpicChartTooltip.tsx`: burnup chart pattern
- `taskflow/src/components/ambient-curves.tsx`: only if the sketch keeps an ambient element
- `.claude/skills/sketch-findings-taskflow/`: F5 visual language (temporary skill; the new sketch's findings supersede it for the detail page)

### Prior phase decisions that still bind
- `.planning/phases/93-releases-list-and-detail-redesign-fix-version-driven-list-fi/93-CONTEXT.md`: D-05 pill tones, D-12 RM hidden when unconfigured, D-13/D-14 header owns the done figure, D-15 table anatomy untouched
- `.planning/milestones/v1.14-phases/91.1-unified-release-detail-task-table/91.1-CONTEXT.md`: task table behaviour
- `.planning/milestones/v1.14-phases/89-three-channel-drift-detection/89-CONTEXT.md`: drift semantics
- `.planning/milestones/v1.14-phases/88-release-branch-milestone-creation/88-CONTEXT.md`: create branch/milestone dialogs (confirm-gated, close only on success); D-05 milestone query-key contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ReleaseIssueGraph` / `SegmentedBar` / `RELEASE_SEGMENT_CLASS`: status segments for the header bar, assignee rows and type bars.
- `AioDonut`: the MR state donut.
- `EpicTimeBurnup` + `EpicChartTooltip` + `components/ui/chart.tsx`: recharts burnup scaffolding.
- `CachedAvatar`: assignee rows (explicit px sizing; memory: virtualized table 0-width column).
- `ReleasesHero` `Stat`: icon + text with status-only colour, for the facts chips.
- `Tooltip` + `TooltipBody` / `TooltipRow`: chip and graph tooltips (4 rows or fewer).
- `jira-fix-versions` cache: gives the previous version's date for the burnup start with no new request.

### Established Patterns
- The app uses React Compiler and vitest does not. Avoid hidden module-level reads in render.
- Recharts gotchas (memory: burndown axis gotchas): `interval=0` for ticks, UTC vs local time ticks, tooltip z-index.
- `statusPillClass` needs a flex parent.
- Italic text inside `truncate` needs `pr-0.5`.
- Pre-commit runs the full vitest suite and biome: one commit per TDD task.
- `jira-fixversion-issues` key is `[versionId, storyPointsFieldKey]`. Adding fields changes the payload, not the key, so check for consumers that rely on the exact field set.

### Integration Points
- Pinned release tabs (`REL-{id}`, `usePinnedTabsStore`, `setPinnedReleaseMeta`): Pin stays in the header.
- Breadcrumb seeding (`seedReleaseBreadcrumb`, `openIssueFull`) is unchanged.
- Tests that will change: `ReleaseDetailSidebar.test.tsx` (moves to facts-chip tests), `ReleaseHeader.test.tsx`, `useReleaseDetail.test.tsx` (new fields), and settings-store migration tests if `releaseDetailPanelWidth` is removed.

</code_context>

<specifics>
## Specific Ideas

- The user pointed to "how we did the Releases page in the app" for the header, and to "how the rest of the app has it" for scroll and actions. Consistency with existing shipped pages beats novelty.
- "I want variety" for the graphs: each graph has a different shape, but colour still means status.
- Visual judgement happens in the sketch and at UAT. Render the page before calling it done (throwaway vite page + cached Chromium, per the context-parent-rows memory).

</specifics>

<deferred>
## Deferred Ideas

- Inline field editing (date or released toggle in place): not requested; it would be a new edit surface.
- Projected-finish forecast on the burnup: rejected for now (D-04).

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md`: matched only on generic keywords ("phase", "jira") and is unrelated to release detail (also not folded in P93).

</deferred>

---

*Phase: 94-release-detail-redesign*
*Context gathered: 2026-10-30*
