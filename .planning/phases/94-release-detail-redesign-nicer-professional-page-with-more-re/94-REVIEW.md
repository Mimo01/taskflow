---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
reviewed: 2026-10-30T16:55:49Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - taskflow/src/components/release/ReleaseIssueGraph.tsx
  - taskflow/src/components/ui/cached-avatar.tsx
  - taskflow/src/components/ui/issue-type-icon.tsx
  - taskflow/src/lib/release-refresh.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDescription.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseFacts.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/labelColor.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts
  - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/stores/settings.store.ts
findings:
  critical: 3
  warning: 8
  info: 8
  total: 19
status: issues_found
---

# Phase 94: Code Review Report

**Reviewed:** 2026-10-30T16:55:49Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase-94 diff (`4764175416b6..HEAD`). For `jira.ts` and `settings.store.ts` I looked only at the changed hunks. I compiled the main files with `babel-plugin-react-compiler` to check how the compiler treats them, and I traced the page's state machines (issue graph state, donut state, milestone fact) through `useReleaseDetail`.

The derivation modules are generally sound: `releaseBuckets.ts`, `releaseBurnup.ts`, `labelColor.ts` and `computeMrDonutCounts` are pure functions with their edge cases handled. `today` in `useReleaseDetail` is *not* frozen by the compiler. The compiled output recomputes it on every render.

The serious problems are in the page-level state branching. Two of them bring back the defect this codebase has already fixed many times: a check that did not run, or that failed, shows up as a settled negative or as a spinner that never ends. These are the donut on an MR-channel failure, and the new "Missing" milestone label. The third problem: the new empty-release branch hides the package-orphan fix list and the unmatched-MR table, which are exactly what you need when a fix version is empty.

Two other notable problems:
- `ReleaseDetailPage` no longer compiles under React Compiler. The old page compiled.
- The burnup measures its width with an effect that only runs once, so on a first visit it keeps the 640px fallback width forever.

## Critical Issues

### CR-01: MR donut shows a loading skeleton forever when the milestone-MR fetch (Channel B) fails

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:256-261, 283`
**Issue:** `donutState` returns `'empty'` or `'loading'`, and returns `'loading'` whenever `milestoneMRs` is undefined. When `fetchMilestoneMRs` rejects (401/5xx/timeout), `milestoneMRs` stays `undefined` and `isError` is true. The hook already has `channelBFailed` for this, but it is not returned and not consulted here. The result is `donutState === 'loading'` and `showDonut === true`, so `ReleaseMrDonut` shows its skeleton indefinitely. `ReleaseMrDonut`'s `state` type also has no `'error'` member, so it cannot represent the failure at all. This is the CR-03 defect class (a failed check that looks like it is still in flight), which `useReleaseDetail.ts` documents as closed three times.
**Fix:** Return the failure from the hook, branch on it, and let the donut render the GraphSlot error state:
```ts
// useReleaseDetail.ts — return value
milestoneMrsFailed: channelBFailed && !milestoneMRs,

// ReleaseDetailPage.tsx
const donutState: 'loading' | 'error' | 'empty' | 'ready' =
  gitlabMatch.type === 'none' || (milestoneMRs && releaseMrs.length === 0)
    ? 'empty'
    : milestoneMrsFailed
      ? 'error'
      : !milestoneMRs
        ? 'loading'
        : 'ready';
// ReleaseMrDonut: widen `state` to GraphSlotState and pass an errorLabel such as
// "Couldn't load merge requests. Refresh to try again."
```

### CR-02: Milestone fact says "Missing" when the lookup failed, is still loading, or never ran

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseFacts.tsx:351-365` (callers: `ReleaseDetailPage.tsx:405`, `useReleaseDetail.ts:146-164`)
**Issue:** `milestoneValue` treats every `gitlabMatch.type === 'none'` as a verified absence and renders the orange `Missing` label in both arms. This phase added that label; the old sidebar rendered only the action or the reason. But `resolveGitLabMatch` returns `'none'` in three other situations too:
1. **While loading.** `milestones` is `undefined` while `['gitlab-milestones', p, 'all']` is in flight. On every cold visit the header says "Missing / Create milestone" and then flips to the milestone name, which is a blink and a false claim. Clicking Create during that window runs `findDuplicateMilestone` over an empty list.
2. **On failure.** With `milestonesFailed`, the row shows "Missing" plus "Set a release date first", a remedy that does nothing for a dated release. The CR-06 comment in `useReleaseDetail.ts:140-145` names this exact outcome as a defect.
3. **Without a token.** If `readSecret('gitlab-pat')` rejects, `gitlabToken` is null and the query is disabled, not errored. `milestonesFailed` stays false, `canCreateMilestone` is true, and the user is offered a Create button whose mutation throws "GitLab project not configured". The branch fact then follows with "Create the milestone first".
**Fix:** Return the lookup state from the hook and make the fact exhaustive over it:
```ts
// useReleaseDetail.ts
const milestoneLookup: 'pending' | 'failed' | 'unavailable' | 'resolved' =
  !gitlabReady ? 'unavailable'
  : milestonesFailed ? 'failed'
  : allProjectMilestones === undefined ? 'pending'
  : 'resolved';

// ReleaseFacts.tsx milestoneValue, before the 'none' arm:
if (props.milestoneLookup === 'pending') return <span className="text-muted-foreground">Loading...</span>;
if (props.milestoneLookup !== 'resolved')
  return <span className={PROBLEM}>Couldn't check</span>; // no "Missing", no Create
// canCreateMilestone must also require milestoneLookup === 'resolved'.
```

### CR-03: An empty fix version hides the package-orphan fix list and the unmatched-MR table

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:293, 434-535`
**Issue:** When `releaseIssues.length === 0` (`noIssues`), the whole block containing `DeploymentPackageSection` and `UnifiedTaskTable` is replaced by the "No issues in this fix version yet" placeholder. Neither of those components depends only on fix-version issues:
- `DeploymentPackageSection` separately fetches `fetchStoriesWithPackageNoFixVersion`. These are stories in this release's RM week that have *no* fix version (state `pkg-only`, fix = "set fix version"). A fix version that is empty because its stories were never tagged is exactly when that list is useful, and it is now unreachable. That is the scenario quick 261014-eym built it for.
- `UnifiedTaskTable` renders `secondaryRows`: MRs in the milestone, or targeting the release branch, that no task covers. With zero issues, every milestone or branch MR lands there. The old page always rendered the table, which already handles an empty primary list with "No issues in this fix version".

The page also tells the user the fix is "once issues are added", while hiding the Apply buttons that would add them.
**Fix:** Gate only the graphs and the done bar on `noIssues`, and keep the action surfaces:
```tsx
{noIssues ? <EmptyIssuesNotice .../> : <>{graph grid}</>}
<DeploymentPackageSection stories={releaseIssues} ... />
<div className="px-6 pt-6 pb-6"><UnifiedTaskTable key={versionId} ... /></div>
```

## Warnings

### WR-01: Burnup keeps the 640px fallback width when it mounts before the issues load

**File:** `taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx:147-148, 163, 193`
**Issue:** `useElementWidth(plotRef)` attaches its ResizeObserver in an effect with deps `[ref]`, and that effect runs only once. `plotRef` is attached only in the chart branch. On a first visit the page renders as soon as the fix versions load, while issues are still loading, so the burnup mounts in `state: 'loading'` (or in the timeline branch). `ref.current` is null at that point, the effect returns early and never runs again. `width` stays 640 for the life of the component, so `timeTicks(axis.start, axis.end, 640)` chooses tick density for 640px. Combined with `interval={0}`, which forces every tick to render, a ~300px band plot gets overlapping date labels. It only measures correctly on a cached revisit. `ReleaseTypeWaffle.tsx:49-63` hit the same problem and fixed it with a callback ref; the burnup did not.
**Fix:** Use the callback-ref pattern from `ReleaseTypeWaffle`:
```tsx
const [plotEl, setPlotEl] = useState<HTMLDivElement | null>(null);
const [width, setWidth] = useState(640);
useEffect(() => { if (!plotEl) return; /* measure + ResizeObserver, as in the waffle */ }, [plotEl]);
<div ref={setPlotEl} ...>
```
Alternatively, make `useElementWidth` accept an element instead of a ref object.

### WR-02: Wide windows first paint the 2x2 layout, then switch to the band and remount every graph

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:265-278, 462-482`
**Issue:** `pageWidth` starts at `0`, so the first commit always renders the 2x2 grid. Measurement happens in `useEffect`, after paint, so on any window of 1180px or wider the user sees one 2x2 frame before the band replaces it. That is a layout shift on every mount, which the GraphSlot design ("the page never shifts") is meant to avoid. The two branches place `burnupEl`/`mrSlotEl`/... under different parents, so every graph also unmounts and remounts: measured widths reset, tooltips close, and the remount also re-triggers WR-01.
**Fix:** Measure in `useLayoutEffect`. Better, avoid JS layout switching: keep one grid element and switch `grid-cols` with a container-query variant (`@min-[1180px]/page:grid-cols-[...]`), passing `compact` through a CSS-driven flag or a single stable tree.

### WR-03: `ReleaseDetailPage` no longer compiles under React Compiler

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:231-243`
**Issue:** The new `handleRefresh` uses `try { ... } finally { ... }` without a `catch`. The compiler bails out of the whole component: `CompileError: (BuildHIR::lowerStatement) Handle TryStatement without a catch clause`. The pre-phase page compiled (`_c(138)`). The component now re-derives everything on each render and rebuilds every child prop, including the inline `factItems` array, `fix={{...}}` and the graph elements. Every ResizeObserver tick (`setPageWidth`) re-renders the full page and the `UnifiedTaskTable` subtree. The compiler fails silently, so nothing in the build reports this.
**Fix:** Add a catch clause (or move the logic into a small hook), and add a compile assertion to the test suite:
```ts
const handleRefresh = async () => {
  if (!versionId) return;
  setRefreshing(true);
  try {
    await refreshReleaseDetail(queryClient, { activeJiraProject, activeGitlabProject, versionId });
  } catch {
    // invalidateQueries does not throw by default; nothing to surface
  }
  setRefreshing(false);
};
```

### WR-04: The Refresh button does not refresh the deployment-package data the page shows

**File:** `taskflow/src/lib/release-refresh.ts:41-75`
**Issue:** `refreshReleaseDetail` invalidates fix versions, fix-version issues, MR channels and GitLab dependents. It does not touch any query behind the header's package cell or `DeploymentPackageSection`:
- `['jira-projects-rm', ...]`
- `['rm-week-list', ...]`
- `['rm-week-children', ...]`
- `['rm-package', ...]`
- `['jira-package-no-fixversion', ...]`
- the per-project `['jira-fix-versions', otherProjectKey]` used for cross-project stories

After a user fixes a package in Jira and clicks Refresh, the mismatch list and package cell stay stale for up to 5 minutes, even though the "Refreshed: hh:mm" label has just updated.
**Fix:** Add a stage-1 invalidation of the RM week sources, then invalidate `['jira-package-no-fixversion', activeJiraProject]` and `['rm-package']` in stage 2. Invalidate `['jira-fix-versions']` without the project segment so cross-project lists refresh too.

### WR-05: Skeleton container queries never match, and the skeleton describes a layout that no longer exists

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx:27, 60`
**Issue:** The skeleton uses `@max-[980px]/page:` variants, but the `@container/page` element is only the scroll wrapper in the loaded branch (`ReleaseDetailPage.tsx:374`). The skeleton renders instead of that wrapper, so it has no `page` container ancestor and the narrow-layout rules never apply. The skeleton also draws a "quad + side column" (`skeleton-side`), but the real page has no side column: it is a 4-column band at 1180px or wider, otherwise a 2x2 grid. Its header block (title row plus one meta line) also omits the property strip. The skeleton-to-content swap therefore shifts the layout on every load.
**Fix:** Wrap the skeleton in `@container/page`, or render both branches inside the same container element. Make the skeleton mirror the band/2x2 grid and drop the side column.

### WR-06: A paused (offline) issues query renders as a settled "No issues in this fix version yet"

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:248-255, 293`
**Issue:** `issueGraphState` treats anything that is not `isLoading` and not `issuesError` as resolved. With TanStack's default `networkMode: 'online'`, an offline first fetch has `fetchStatus: 'paused'`, so `isLoading` is false, there is no data and no error. The state becomes `'empty'` and `noIssues` hides the graphs, the done bar and (per CR-03) the task table, all behind a confident "No issues" message. This is a settled negative for a check that never ran.
**Fix:** Use data presence plus a non-error query status: `!fixVersionIssues ? (issuesError ? 'error' : 'loading') : fixVersionIssues.length === 0 ? 'empty' : 'ready'`. This relies on `fixVersionIssues` being undefined until the first success, and it also removes the redundant `isLoadingIssues && !fixVersionIssues`.

### WR-07: Links in the milestone description navigate the Tauri webview away from the app

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDescription.tsx:72`
**Issue:** `ReactMarkdown` renders plain `<a href>` elements for GitLab milestone markdown. The app has no global anchor interceptor (searched `src` and `src-tauri`). Clicking a link inside the clamped description loads the external page in the main window, replacing the app with no way back. This behaviour came over from the deleted `DescriptionsSection`, but the description now sits in the always-visible header, inline in the collapsed two-line clamp, which makes it far easier to click by accident.
**Fix:** Override the anchor:
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    a: ({ href, children }) => (
      <a href={href} onClick={(e) => { e.preventDefault(); if (href) openExternal(href); }}
         className="text-primary hover:underline">{children}</a>
    ),
  }}
>
```

### WR-08: In band mode, "By status" drops the in-progress and to-do statuses first

**File:** `taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx:33, 90-92`; `releaseBuckets.ts:143-159`
**Issue:** Rows are sorted done, then in progress, then to do, and the band view shows only the first 5. A project with several done-category statuses (Done, Closed, Resolved, Deployed, Released...) fills all 5 rows with finished work. The actionable statuses fall into an inert "+N more statuses" line with no tooltip, unlike the assignee and label overflow rows, which list their hidden entries. This slot replaces the MR donut precisely so that it "always carries information".
**Fix:** In compact mode, reserve rows for non-done categories (for example, collapse all done statuses into a single "Done (n)" row when there are more rows than fit). Give the overflow row a tooltip listing the hidden statuses, as `ReleaseAssigneeRows` does.

## Info

### IN-01: Orphaned JSDoc in settings store

**File:** `taskflow/src/stores/settings.store.ts:158`
**Issue:** `/** Release detail right panel width in px. Default: 288 (w-72). */` was left behind when `releaseDetailPanelWidth` was removed. It now documents `aioRunDetailPanelWidth`, wrongly.
**Fix:** Delete the line, or replace it with the AIO run panel's own description.

### IN-02: Dead export and stale references to the deleted sidebar

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseFacts.tsx:499-501`; `mergeBackVerification.ts:8`; `AioTestRunDetailPage.tsx:391`
**Issue:** The `ReleaseFacts` component has no production caller; only `releaseFactItems`, `MetaLine` and `PropertyStrip` are imported. Two comments still point readers at `ReleaseDetailSidebar.tsx`, which this phase deleted.
**Fix:** Remove `ReleaseFacts` (or keep it only if tests need it), and update both comments.

### IN-03: `lib/` now imports from `routes/`

**File:** `taskflow/src/lib/release-refresh.ts:2-5`
**Issue:** A shared lib module now depends on a route-private module (`routes/dashboard/release-detail/mrChannelKeys`), which inverts the layering.
**Fix:** Move `mrChannelKeys.ts` to `src/lib/` (or `src/services/`) and import it from both sides.

### IN-04: Unreachable `'empty'` state in `ReleaseMrDonut`

**File:** `taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx:22, 41`
**Issue:** The page renders the donut only when `donutState !== 'empty'`, so the `'empty'` state and its "No MRs in this milestone" label can never show. Meanwhile the `'error'` state the donut does need is missing (CR-01).
**Fix:** Replace `'empty'` with `'error'` in the prop type.

### IN-05: Constants that do not match their comments or actual use

**File:** `taskflow/src/routes/dashboard/release-detail/graphs/labelColor.ts:79`; `graphs/ReleaseBurnup.tsx:51, 68-71`
**Issue:**
- The `labelPillColors` doc says "on the 15% tint", but `TINT_ALPHA` is 0.18.
- `burnupEndLabelDy` computes pixel gaps against a hardcoded `PLOT_PX = 110`. The non-compact plot is 196/160px and the compact plot fills its row height, so the label-collision maths runs against the wrong height.
**Fix:** Correct the comment. Pass the measured plot height (WR-01's measurement) into `burnupEndLabelDy`.

### IN-06: Unassigned placeholder is wider than its compact grid column

**File:** `taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx:17, 74`
**Issue:** The dashed placeholder is always `size-[22px]`, but the compact grid's first column is `20px`, so the circle overflows into the gap and sits misaligned with the 20px avatars above it.
**Fix:** Use `compact ? 'size-5' : 'size-[22px]'`.

### IN-07: Collapsed milestone description inlines only `p`/`ul`/`li`

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDescription.tsx:64-70`
**Issue:** Headings, `ol`, `pre`, `blockquote` and GFM tables remain block elements in the collapsed state. A milestone description that starts with `## Release notes` breaks the "icon + inline text" line and uses up one of the two clamped lines.
**Fix:** Add `[&_h1]:inline ... [&_h6]:inline [&_ol]:inline [&_blockquote]:inline`, or render a plain-text excerpt when collapsed.

### IN-08: Timeline wording edge cases

**File:** `taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx:29-38, 72, 113-122`
**Issue:**
- A released version with no release date shows "No release date / Set one to see a countdown".
- The track ignores `axis.showToday`, so when today is past the axis end, "Today" is drawn at the end of the track, on the release position.
**Fix:** Check `released` before the missing-date branch. Hide the Today marker when `!axis.showToday`.

---

_Reviewed: 2026-10-30T16:55:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
