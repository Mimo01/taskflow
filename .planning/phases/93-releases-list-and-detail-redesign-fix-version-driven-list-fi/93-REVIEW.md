---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
reviewed: 2026-10-30T08:54:02Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - taskflow/src/components/ambient-curves.tsx
  - taskflow/src/components/release/ReleaseIssueGraph.test.tsx
  - taskflow/src/components/release/ReleaseIssueGraph.tsx
  - taskflow/src/components/release/ReleasePackageCell.test.tsx
  - taskflow/src/components/release/ReleasePackageCell.tsx
  - taskflow/src/components/release/ReleaseStatusPill.tsx
  - taskflow/src/hooks/useReleaseBreakdowns.test.tsx
  - taskflow/src/hooks/useReleaseBreakdowns.ts
  - taskflow/src/hooks/useReleasePackages.ts
  - taskflow/src/lib/release-agenda.test.ts
  - taskflow/src/lib/release-agenda.ts
  - taskflow/src/lib/release-list.test.ts
  - taskflow/src/lib/release-list.ts
  - taskflow/src/lib/release-refresh.test.ts
  - taskflow/src/lib/release-refresh.ts
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
  - taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/useEditRelease.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.test.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasedPanel.test.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasesHero.test.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
  - taskflow/src/routes/dashboard/ReleasesSkeleton.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.deploymentPackage.test.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.test.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.versionsBreakdown.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 93: Code Review Report

**Reviewed:** 2026-10-30T08:54:02Z
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase 93 diff (`ffffb793..HEAD`) for these areas: the fix-version-driven Releases list (agenda model, batched breakdown hook, RM package hook, refresh staging), the new `fetchVersionsStatusBreakdown` JQL search, and the detail-page header redesign with its seeded breakdown.

`tsc --noEmit` passes with no errors. `biome check` on the changed files is clean. I compiled the hooks and pages with `babel-plugin-react-compiler`. `ReleasesTab` bails out of compilation, so its `today` read is not frozen. The hooks memoize on their reactive inputs, and I found no stale module-level reads.

The pure logic held up when I traced the edge cases: agenda ordering, the today marker and month headers, cadence and median, the chunk planner's key stability, pagination, and the seed key being fetch-disabled and therefore immune to `['jira-version-counts']` prefix invalidations. I found no blockers.

The four warnings share a pattern: failure and loading states that render the same as a genuine "no data" state, plus two UI affordances that silently do nothing or disagree with each other.

## Warnings

### WR-01: Breakdown fetch errors are computed but never surfaced. A failed chunk looks identical to "no data"

**File:** `taskflow/src/routes/dashboard/ReleasesTab.tsx:86`, `taskflow/src/hooks/useReleaseBreakdowns.ts:106-107`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx:74-83`, `taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx:47-51`, `taskflow/src/components/release/ReleaseIssueGraph.tsx:14-24`
**Issue:** `useReleaseBreakdowns` builds `errorIds`, but `ReleasesTab` only destructures `{ breakdowns, loadingIds, teams }`. When a chunk fails, its rows get no breakdown and are not loading. Causes include a 401, a network drop, or a Jira 400 on one id in the `fixVersion in (...)` list, which fails the whole chunk of up to 50 versions. In that case:
- agenda rows render the idle `–`, the same as a version that was never fetched;
- quiet planned rows never get promoted to full rows, because promotion needs a breakdown, so releases that have work stay visually quiet;
- Released panel rows render an empty cell;
- the next-release card shows `–` with no team.

The detail page has the same gap. `ReleaseIssueGraph` declares an `error` prop and the header passes `headerBreakdownError`, but the component never destructures or uses it. A failed issues fetch with no seed therefore looks like the idle dash.

The user gets no signal that anything failed and no retry other than the page-level Refresh.
**Fix:** Thread `errorIds` through and give the slot an error state. For example, in `ReleaseIssuesSlot`:
```tsx
// ReleasesTab
const { breakdowns, loadingIds, errorIds, teams } = useReleaseBreakdowns({...});
// ReleaseIssuesSlot / ReleaseIssueGraph
if (!breakdown) {
  if (error) return <div className={wrapper}><span className="text-xs text-destructive" title="Couldn't load issue counts">!</span></div>;
  ...
}
```
In `ReleaseIssueGraph`, also destructure `error` and render it.

### WR-02: The RM package shows a "week, no app task" state while children or projects are still loading, and permanently if they fail

**File:** `taskflow/src/hooks/useReleasePackages.ts:30-40`, `taskflow/src/components/release/ReleasePackageCell.tsx:16`
**Issue:** `packageFor` returns `{ week, child: null }` as soon as the light week list resolves. The week's children (from `useRmWeekIndex`) or the `jira-projects-rm` query may still be in flight; while `projectsQuery` is pending, `activeProjectName` is `null`, so `child` is forced to `null`.

`ReleasePackageCell` only shows its skeleton when `loading && !pkg`. Because `pkg` is already non-null, the cell renders the muted week label instead, which is the "no RM task for this application" state. A moment later it flips to the child key.

If the children query or the projects query errors, the cell stays in that misleading "no package task" state for good. Neither `useReleasePackages` nor `useRmWeekIndex` exposes the child or project error. This affects every non-quiet list row, the next-release card and the detail header.
**Fix:** Treat "child unresolved because inputs are still loading" as loading:
```tsx
// ReleasePackageCell
if (loading && (!pkg || !pkg.child)) return <Skeleton .../>;
```
Alternatively, have `useReleasePackages` return `null` from `packageFor` until both the children and `projectsQuery` have settled. Separately, surface `projectsQuery.isError` so a failed lookup is not shown as "no task".

### WR-03: The `title` tooltips on truncated release names never appear (inherited `pointer-events: none`)

**File:** `taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx:101-107`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx:223-226`
**Issue:** The name `<span title={version.name} className="... truncate">` sits inside a `pointer-events-none` wrapper. That wrapper is there so clicks fall through to the overlay button. `pointer-events` is inherited, so the span is never a hit-test target and the browser never shows its `title` tooltip.

A long release name truncated in a row or in the next-release card has no way to be read in full from the list. The `title` attributes are dead. The Released panel works because its `title` is on the `<button>` itself.
**Fix:** Put the `title` on the overlay button, which is the actual hover target:
```tsx
<button type="button" aria-label={`Open release ${version.name}`} title={version.name} className="absolute inset-0 ..." onClick={...} />
```
Do the same for the button in `NextReleaseCard`, and drop the dead `title` from the spans.

### WR-04: The detail header pill disagrees with the list row for the same release

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:252`, `taskflow/src/lib/release-list.ts:21-31`, `taskflow/src/lib/release-agenda.ts:21-29`
**Issue:** The list pill uses `releaseCountdown`, which produces `3 days late`, `Today`, `Tomorrow` and `In 3 weeks`. The detail header uses `releasePill`, which produces `Overdue`, `Due today`, `In 1 day` and `In 21 days`. Clicking a row labelled "In 3 weeks" or "3 days late" opens a header that says "In 21 days" or "Overdue".

`ReleaseDetailHeader` is documented as the header "that echoes the list row". The two helpers are now parallel, divergent implementations of the same concept. The detail header also shows the raw `2026-11-04` date, while the list uses the `Wed 04 Nov` stamp.
**Fix:** Have the detail header use the agenda wording, with `released` mapped to the green `Released` pill:
```tsx
pill={version.released ? { tone: 'green', label: 'Released' } : releaseCountdown(version.releaseDate, today)}
```
Then delete `releasePill` if nothing else uses it; today only `ReleaseDetailPage` does. Render the date with `dateStamp(...).inline`.

## Info

### IN-01: Dead `list` variant and unused `error` prop in `ReleaseIssueGraph`

**File:** `taskflow/src/components/release/ReleaseIssueGraph.tsx:14-24, 34, 54-55, 95`
**Issue:** The only consumer is `ReleaseDetailHeader`, which passes `variant="detail"`. The list now uses `ReleaseIssuesSlot`, so every `variant === 'list'` branch is unreachable. `error` is in the props type but is never destructured (see WR-01). `releaseTooltipRows` and the `RELEASE_SEGMENT_*` label and colour maps now exist only for this one tooltip.
**Fix:** Drop the `variant` prop and the list branches, and either implement `error` or remove it from the type.

### IN-02: `useEditRelease` still invalidates a key that no query uses

**File:** `taskflow/src/routes/dashboard/release-detail/useEditRelease.ts:165`
**Issue:** Phase 93 removed the `['jira-version-counts', versionId]` query (`fetchVersionIssueCounts`) from `useReleaseDetail`, but the invalidation of that key remains, alongside the new `'batch'` one. It is now a no-op, and it misleads readers into thinking a per-version counts query still exists. `fetchVersionIssueCounts` itself may now be unused outside its tests.
**Fix:** Remove the line, and remove `fetchVersionIssueCounts` if nothing else imports it.

### IN-03: Breakdown chunk and seed keys omit `jiraBaseUrl`

**File:** `taskflow/src/hooks/useReleaseBreakdowns.ts:13-18`
**Issue:** `['jira-version-counts', 'batch', ids]` and `['jira-version-counts', 'breakdown', id]` are not scoped to the Jira instance. The RM projects query is: `['jira-projects-rm', jiraBaseUrl]`. Suppose the user changes the Jira base URL in Settings and the new instance has overlapping numeric version ids. Within the 5-minute `staleTime`, the list and the detail seed could then show counts and teams from the previous instance.
**Fix:** Include `jiraBaseUrl` in both key helpers. The prefix invalidations elsewhere still match.

### IN-04: The Released panel renders "✓ 0 done" for released versions with no issues

**File:** `taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx:47-48`
**Issue:** For a released version with a zero-total breakdown, the panel prints a green `✓ 0 done`. For the same case the agenda shows `No issues yet`.
**Fix:** `b && breakdownTotal(b) === 0 ? <span className="text-muted-foreground">No issues</span> : ...`

---

_Reviewed: 2026-10-30T08:54:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
