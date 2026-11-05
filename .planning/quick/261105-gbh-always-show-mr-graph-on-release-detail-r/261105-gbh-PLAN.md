---
phase: quick-261105-gbh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBuckets.test.ts
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.test.tsx
  - taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx
autonomous: true
requirements: [QUICK-261105-gbh]

must_haves:
  truths:
    - "The Merge requests donut is always rendered on release detail, including when no GitLab milestone matches (D: MR graph visibility)"
    - "MR donut state derives from the three-channel union: ready when the union has MRs, error on a failed channel, skeleton while channels load, otherwise empty with text 'No merge requests yet' (never 'in this milestone')"
    - "MR labels row shows under the graphs whenever the union has MRs, regardless of milestone"
    - "The 'No merge requests in this milestone yet' paragraph is gone"
    - "A By status ring donut is always rendered: 3 slices max (Done / In progress / To do), status colours, issue total + 'issues' in the centre, tooltip lists exact Jira status names with counts (at most 4 rows, '+N more' collapses the rest), no legend"
    - "Status and MR donuts read as an identical, side-by-side pair (same size, ring, centre typography, GraphSlot heading, vertical alignment) at every width"
    - "Graph section looks deliberate and does not overflow at 1440, 1280, 1180, 900, 600 and 400 px (verified by screenshots)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.tsx"
      provides: "By status donut (AioDonut, 3 category slices)"
      exports: ["ReleaseStatusDonut"]
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.tsx"
      provides: "Band / 2x2 / single-column graph layout incl. the donut pair"
      exports: ["ReleaseGraphGrid"]
    - path: "taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts"
      provides: "statusDonutSlices(rows)"
      contains: "export function statusDonutSlices"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "ReleaseGraphGrid"
      via: "graph section render, passing burnup/status/mr/type/assignee elements + band"
      pattern: "<ReleaseGraphGrid"
    - from: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.tsx"
      to: "AioDonut"
      via: "shared donut component (no fork)"
      pattern: "AioDonut"
---

<objective>
Release detail graphs: (1) the MR donut is always shown, its state driven by the three-channel MR union
instead of the milestone match; (2) "By status" becomes its own always-shown ring donut (To do / In
progress / Done) that pairs visually with the MR donut; (3) the graph section gets a 5-slot layout that
stacks cleanly at every width tier, verified by screenshots.

Purpose: MRs are matched before a milestone exists, so hiding the MR graph without a milestone hid real
data; and the status breakdown deserves a permanent slot rather than being a fallback.
Output: ReleaseStatusDonut + ReleaseGraphGrid components, statusDonutSlices helper, rewired page, removed
ReleaseStatusRows, updated tests, screenshot evidence.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261105-gbh-always-show-mr-graph-on-release-detail-r/261105-gbh-CONTEXT.md
@taskflow/CLAUDE.md
@.claude/skills/sketch-findings-taskflow/references/release-detail-page.md

Paths: .planning and git live at repo root /Users/mimo/Documents/Projects/taskflow; npm, vitest, biome,
tsc run from the inner app dir /Users/mimo/Documents/Projects/taskflow/taskflow. The pre-commit hook runs
the full vitest suite + biome + tsc, so every task is ONE green commit (write tests and implementation
together; no separate RED commit). Commit with explicit paths (`git commit -- <paths>`) and check
`git log -1 --stat` afterwards (a failed hook leaves files staged). Do not run `biome --write` over all of
src; only on the files you touch. CONTEXT.md decisions override any older sketch-findings decision (the
sketch had By status only as the MR-slot fallback).

Key facts already established (do not re-explore):
- ReleaseDetailPage.tsx: `donutState` (~line 276) returns 'empty' on `gitlabMatch.type === 'none'`;
  `hasMilestone` / `showDonut` (~304-307) gate both the MR donut and MrLabels (~535); `mrSlotEl` (~340)
  swaps in ReleaseStatusRows + the `release-mrs-none` paragraph; band grid (~505) is
  `grid-cols-[minmax(220px,1.1fr)_auto_minmax(250px,1.1fr)_minmax(260px,1.1fr)]`, 2x2 grid (~515) is
  `grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @max-[640px]/page:grid-cols-2 @max-[440px]/page:grid-cols-1`;
  `BAND_MIN_WIDTH = 1180`, `SLOT_COL = 'flex min-w-0 flex-col'`, `DIVIDER = 'border-l pl-4'` (~42-45).
  The page already destructures `isLoadingDrift`, `driftUnavailable`, `milestoneMRs`, `milestoneMrsFailed`,
  `mrDonutCounts`, `gitlabConfigured`, `labelSummary`, `labelCoverage` from useReleaseDetail.
- useReleaseDetail.ts: `mrDonutCounts = computeMrDonutCounts(unionMrs)` (union of channels A/B/C), so the
  sum of its four counts is the union MR count — no hook change needed.
- AioDonut (aio-cycle/AioDonut.tsx): fixed-size recharts ring, INNER 0.36 / OUTER 0.48, `center` slot,
  tooltip shows `slice.rows.slice(0, 4)`, no click support (so slice-click filtering is NOT built, per
  CONTEXT). `ChartSlice` = { key, label, value, share, color, rows } from lib/aio-cycle-charts.ts.
- Colours: `statusCategoryColor(cat)` / `STATUS_CATEGORY_COLOR` in lib/statusStyles.ts return literal
  CSS vars (done green-500, indeterminate blue-500, new gray-400) — usable as slice fills.
- releaseBuckets.ts: `deriveReleaseStatusRows(issues)` gives rows { name, cat, count, filterValues } sorted
  done → indeterminate → new, then count desc. `fitStatusRows` and `statusBarWidth` are used only by
  ReleaseStatusRows and releaseBuckets.test.ts.
- GraphSlot.tsx: `COMPACT_DONUT_SIZE = DONUT_GRAPH_SIZE = 120`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Status donut slices + ReleaseStatusDonut, matched to ReleaseMrDonut</name>
  <files>taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts, taskflow/src/routes/dashboard/release-detail/releaseBuckets.test.ts, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.test.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx, taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx</files>
  <behavior>
    - statusDonutSlices(rows): one slice per non-empty category in order done, indeterminate, new; keys 'done' / 'indeterminate' / 'new'; labels 'Done' / 'In progress' / 'To do'; value = summed count; share = integer percent of total; color = statusCategoryColor(cat)
    - Empty categories produce no slice; [] input gives []
    - Slice rows = exact Jira status names with counts, count desc then name; a category with ≤4 statuses lists all; with >4 lists the top 3 plus a 4th row labelled '+N more' whose value is the summed count of the rest (never more than 4 rows)
    - ReleaseStatusDonut ready: renders data-testid 'release-graph-status' GraphSlot titled 'By status', donut testId 'release-status-donut', centre shows the total and the caption 'issues', aria-label like 'Issues by status: 3 done, 2 in progress, 5 to do' (zero categories omitted)
    - ReleaseStatusDonut loading shows the AioDonutSkeleton (testId 'release-status-donut-skeleton'); empty shows 'No issues'
    - ReleaseMrDonut empty label is now 'No merge requests yet' (no 'milestone' wording)
  </behavior>
  <action>
In releaseBuckets.ts add `export function statusDonutSlices(rows: ReleaseStatusRow[]): ChartSlice[]`
(reuse the existing local `pct` helper and the existing ChartSlice import used by mrDonutSlices), built from
deriveReleaseStatusRows output so status names stay exact (per CONTEXT "By status redesign": 3 slices,
colour = status only, ≤4 tooltip rows with "+N more"). Rows of status 'Unknown' are counted in their
category like any other name.

Create graphs/ReleaseStatusDonut.tsx as a sibling of ReleaseMrDonut with the SAME structure: props
`{ rows: ReleaseStatusRow[]; state: GraphSlotState; compact?: boolean; className?: string }`, GraphSlot
title 'By status' with the ListChecks icon (the old ReleaseStatusRows icon), `height={DONUT_GRAPH_SIZE}`,
emptyLabel 'No issues', default (issue) errorLabel, the same skeleton wrapper as ReleaseMrDonut, and the
same `my-auto flex justify-center` body with AioDonut at `compact ? COMPACT_DONUT_SIZE : DONUT_GRAPH_SIZE`
and the identical centre markup (`text-lg font-semibold tabular-nums` total + `text-xs text-muted-foreground`
caption 'issues'). Do NOT fork AioDonut (per CONTEXT user note). If anything in the shared look needs
polish for the pair (e.g. centre line-height so total+caption sit optically centred, tooltip title/rows),
change it in AioDonut / both donut wrappers together so the pair stays identical; keep AIO cycle usage
working (aio-cycle tests must still pass).

Extract the centre markup into one small shared piece if that is the cleanest way to guarantee identical
typography (e.g. a `DonutCentre({ total, caption })` exported from GraphSlot.tsx or ReleaseMrDonut.tsx) and
use it in both donuts.

In ReleaseMrDonut change emptyLabel to 'No merge requests yet' (per CONTEXT "MR graph visibility") and
update its test. Add releaseBuckets tests for statusDonutSlices (cases in behavior) and a
ReleaseStatusDonut.test.tsx covering ready (centre total, 'issues', aria-label), loading skeleton and
empty. Leave ReleaseStatusRows, fitStatusRows and statusBarWidth in place in this task (the page still
imports them; Task 2 deletes them) so this commit is green.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/aio-cycle && npx tsc --noEmit && npx biome check src/routes/dashboard/release-detail src/routes/dashboard/aio-cycle/AioDonut.tsx</automated>
  </verify>
  <done>statusDonutSlices and ReleaseStatusDonut exist with passing tests; ReleaseMrDonut says 'No merge requests yet'; both donuts share size, ring and centre typography; one green commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Always-on MR + status donuts, ReleaseGraphGrid layout, remove ReleaseStatusRows</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.test.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.test.tsx, taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts, taskflow/src/routes/dashboard/release-detail/releaseBuckets.test.ts</files>
  <behavior>
    - Without GitLab configured: both 'release-graph-status' and 'release-graph-mrs' render; MR slot shows 'release-graph-mrs-empty' with 'No merge requests yet'; no 'release-mrs-none' anywhere; no milestone fact (existing assertion kept)
    - gitlabMatch.type 'none' but mrDonutCounts non-zero (union MRs without milestone): MR donut 'release-mr-donut' renders and 'mr-labels' shows when labelSummary is non-empty
    - Milestone with zero union MRs and settled channels: MR slot empty state, status donut present
    - milestoneMrsFailed or driftUnavailable with no union MRs: 'release-graph-mrs-error' (existing CR-01 test kept green)
    - Channels in flight (isLoadingDrift, or matched milestone with milestoneMRs undefined and not failed) with no union MRs: 'release-graph-mrs-skeleton'
    - Band layout: 'release-graph-grid' holds burnup, a donut pair 'release-graph-donuts' (status then MRs), type, assignee in that order; existing band/2x2 class assertions updated to the new templates
    - 'mr-labels' still sits outside 'release-graph-mrs' and after the grid (existing ordering tests kept)
  </behavior>
  <action>
Per CONTEXT "MR graph visibility", rewrite `donutState` in ReleaseDetailPage.tsx from the union count
(`unionMrTotal` = sum of mrDonutCounts.merged/open/draft/closed), first match wins:
`!gitlabConfigured` → 'empty'; `unionMrTotal > 0` → 'ready'; `milestoneMrsFailed || driftUnavailable` →
'error'; `isLoadingDrift || (gitlabMatch.type !== 'none' && !milestoneMRs)` → 'loading'; else 'empty'.
Keep the 94-REVIEW CR-01 comment intent (a failed fetch is an error, never a skeleton forever). Delete
`hasMilestone`, `showDonut`, `statusRows`-as-fallback, the `release-mrs-none` paragraph and the unused
GitMerge import. Render MrLabels whenever `donutState === 'ready'` (per CONTEXT: shows whenever the union
has MRs). Build `statusEl = <ReleaseStatusDonut rows={deriveReleaseStatusRows(releaseIssues)}
state={issueGraphState} compact />` and `mrEl = <ReleaseMrDonut ... compact />`.

Move the graph layout out of the page into graphs/ReleaseGraphGrid.tsx (this makes the layout testable and
previewable in Task 3): props `{ band: boolean; burnup; status; mrs; type; assignee: ReactNode }`; move
SLOT_COL and DIVIDER there. It renders `data-testid="release-graph-grid"` and a donut pair
`<div data-testid="release-graph-donuts">` = flex row (status slot, then MR slot with an internal
`border-l pl-4` divider, `gap-x-4`, `items-stretch`, each slot `flex-1 min-w-0` with the donut centred) so
the two donuts are vertically aligned, same width and never separated at any tier (per CONTEXT Layout:
matched pair, no orphaned/lopsided cells). Layout per tier:
- Band (page ≥ BAND_MIN_WIDTH): [Burnup][Status|MRs pair][Type][Assignee] — the pair takes an `auto`
  column, e.g. `grid-cols-[minmax(220px,1.1fr)_auto_minmax(250px,1.1fr)_minmax(260px,1.1fr)]`, keep
  `items-stretch`. The pair adds ~150px over the old single donut, so raise BAND_MIN_WIDTH (keep it in
  ReleaseDetailPage.tsx) from 1180 to 1280 so the lists keep their previous slack; adjust after the Task 3
  screenshots if needed.
- 2x2 (640 ≤ container < band): row 1 burnup | pair, row 2 assignee | type (current order). The right
  column must fit the pair (~2×120px + divider + gap ≈ 290px), so give it a floor, e.g.
  `grid-cols-[minmax(0,1fr)_minmax(300px,auto)]` or similar — no horizontal overflow at 641px.
- Below 640 (`@max-[640px]/page:`): single column — burnup, pair (still side by side, centred across the
  row), type, assignee; drop the outer cell dividers (border-l-0 pl-0) but keep the pair's internal one.
- Below 440: same single column; the pair still fits side by side (≈290px).
Keep the burnup/assignee className props the page currently passes only if still needed under the new
grid; remove dead `col-span-full`/`order-4` classes otherwise. Page keeps measuring `pageWidth` and passes
`band`.

Delete ReleaseStatusRows.tsx and its test; remove `fitStatusRows` and `statusBarWidth` plus their tests
from releaseBuckets(.test).ts (confirm with grep that nothing else imports them; `MoreRowsPopover` /
rowToggle stay — other graphs use them).

Update ReleaseDetailPage.test.tsx: replace the tests "without GitLab: By status takes the MR slot",
"milestone without MRs: By status plus one friendly line" and "shows no label line when By status replaces
the MR cell" with the behavior cases above; update the grid-template class assertions (~407, ~438, ~589)
to the new layout. Add ReleaseGraphGrid.test.tsx asserting slot order in band and non-band, that the pair
wraps both donuts, and that the non-band grid carries the 640/440 single-column classes.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard && npx tsc --noEmit && npx biome check src/routes/dashboard/ReleaseDetailPage.tsx src/routes/dashboard/ReleaseDetailPage.test.tsx src/routes/dashboard/release-detail && ! grep -rn "ReleaseStatusRows\|fitStatusRows\|statusBarWidth\|release-mrs-none\|in this milestone yet" src</automated>
  </verify>
  <done>MR donut and status donut render on every release with issues; MR state follows the union; labels follow the union; ReleaseStatusRows and its helpers are gone; layout lives in ReleaseGraphGrid; full suite green in one commit.</done>
</task>

<task type="auto">
  <name>Task 3: Screenshot the graph section at six widths and polish until every tier looks deliberate</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx</files>
  <action>
Per the user's added requirement ("make sure it looks good and stacks nicely on different screen sizes",
CONTEXT Layout), verify visually, not only via tests. Use the repo's established method: a throwaway vite
page — `taskflow/src/__preview/release-graphs.tsx` plus a root `taskflow/preview-release-graphs.html`
that imports `src/index.css` — rendering ReleaseGraphGrid with the real graph components (ReleaseBurnup,
ReleaseStatusDonut, ReleaseMrDonut, ReleaseTypeWaffle, ReleaseAssigneeRows, then MrLabels below) fed with
realistic placeholder fixture data (no customer data: generic names like 'Alice Example', statuses 'To Do',
'In Progress', 'Code Review', 'Done', 'Closed', a few MR labels), inside a `@container/page` wrapper with
the same `px-6` padding as the release-stats section, and `band` computed with the page's rule
(width ≥ BAND_MIN_WIDTH). Wrap in the app's TooltipProvider if the components need it. Start
`npx vite --port 5199` in the background from the app dir, then screenshot with the cached Playwright
Chromium (`~/Library/Caches/ms-playwright/chromium-1223/.../Chromium` with `--headless=new
--screenshot=<file> --window-size=<W>,900 --hide-scrollbars`) at widths 1440, 1280, 1180, 900, 600 and 400,
light theme plus one dark-theme shot at 1440 (toggle the `dark` class on html via a query param in the
preview). Save screenshots to the session scratchpad / $TMPDIR, never into the repo.

Read each screenshot and check: the two donuts are the same size, centre text aligned on one baseline,
headings on one line with the neighbouring graph headings; band columns all readable (no list truncated
harder than before, burnup not squeezed); 2x2 has no lopsided cell or empty half-row; below 640 and 440
the stack is single column with the pair side by side and centred; no horizontal scroll at any width; MR
labels row sits under the grid. Fix anything off in ReleaseGraphGrid / BAND_MIN_WIDTH / the shared donut
pieces (keep both donuts identical; adjust tests in the same commit if class strings change) and
re-screenshot until all tiers pass. Then delete the preview files (`git status` must show no __preview or
preview-*.html), stop the vite server, and commit any polish (skip the commit if nothing changed). List the
final screenshot paths in the SUMMARY so the user can review them.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && test ! -e src/__preview && test ! -e preview-release-graphs.html && npx vitest run src/routes/dashboard && npx tsc --noEmit</automated>
  </verify>
  <done>Screenshots at 1440/1280/1180/900/600/400 (+ dark 1440) show a matched donut pair and a clean, non-overflowing layout at every tier; paths listed in SUMMARY; preview files removed; suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira/GitLab API → UI | Status names and MR data already fetched by existing hooks are rendered as text |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gbh-01 | Tampering | ReleaseStatusDonut tooltip status names | accept | Rendered as React text nodes (auto-escaped); no new data sources, no HTML injection path |
| T-gbh-02 | Information disclosure | Preview fixture data | mitigate | Placeholder names only, preview files deleted before commit (verify gate checks absence) |
</threat_model>

<verification>
- Full vitest suite, tsc and biome pass via the pre-commit hook on every commit.
- grep finds no ReleaseStatusRows / fitStatusRows / statusBarWidth / release-mrs-none / "in this milestone yet".
- Screenshots at six widths reviewed and listed in SUMMARY.
</verification>

<success_criteria>
- MR donut always shown; state from the union MR set; MrLabels whenever the union has MRs.
- By status is a 3-slice ring donut with exact-status tooltips (≤4 rows), always shown, paired with the MR donut.
- Layout: band [Burnup][Status|MRs][Type][Assignee]; 2x2 and single-column tiers stack cleanly with no overflow.
</success_criteria>

<output>
Create `.planning/quick/261105-gbh-always-show-mr-graph-on-release-detail-r/261105-gbh-SUMMARY.md` when done
</output>
