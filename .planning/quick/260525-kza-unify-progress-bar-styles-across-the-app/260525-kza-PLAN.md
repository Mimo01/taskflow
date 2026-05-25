---
phase: quick-260525-kza
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/progress.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/BulkProgressIndicator.tsx
autonomous: false
requirements: [QUICK-260525-kza]

must_haves:
  truths:
    - "Single-value completion progress bars across the app share one visual style matching the releases detail page (h-2 track, bg-muted, green rounded fill)"
    - "The shared Progress component is the single source of truth for single-value bars"
    - "The releases detail page issue-progress bar and the bulk operation progress bar both render via the shared Progress component"
    - "Multi-segment breakdown bars (AIO test status, sprint todo/inprogress/done) and upload/storage indicators are intentionally left unchanged"
  artifacts:
    - path: "taskflow/src/components/ui/progress.tsx"
      provides: "Unified single-value progress bar (releases-detail style)"
      contains: "bg-green-500"
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "Issue progress bar rendered via shared Progress component"
      contains: "Progress"
    - path: "taskflow/src/routes/dashboard/BulkProgressIndicator.tsx"
      provides: "Bulk-operation progress bar rendered via shared Progress component"
      contains: "Progress"
  key_links:
    - from: "taskflow/src/routes/dashboard/DashboardReleaseCard.tsx"
      to: "taskflow/src/components/ui/progress.tsx"
      via: "import { Progress }"
      pattern: "from '@/components/ui/progress'"
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "taskflow/src/components/ui/progress.tsx"
      via: "import { Progress }"
      pattern: "from '@/components/ui/progress'"
---

<objective>
Unify single-value progress bar styling across the app to match the releases detail
page reference. Today the same visual concept is implemented three ways:

1. The shared `Progress` component (`@base-ui/react` based) — used by DashboardReleaseCard,
   DashboardSprintCard, TodayInProgressSection, TodayUpNextSection. Renders an `h-1`,
   `bg-primary` fill.
2. An inline hand-rolled div bar in `ReleaseDetailPage.tsx` (the visual the user wants as
   the reference) — `h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden` track with
   an `h-full rounded-full bg-green-500 transition-all` fill.
3. An inline hand-rolled div bar in `BulkProgressIndicator.tsx` — `h-1.5`, `bg-primary` fill.

Purpose: One consistent look for "% complete" bars, with a single source of truth so future
bars stay consistent.

Output: The shared `Progress` component restyled to the releases-detail reference, and the
two inline single-value bars migrated to use it.

SCOPE NOTE — intentionally NOT changed (different semantics, not single-value completion bars):
- Multi-segment / stacked breakdown bars: `AioProjectOverviewPage.tsx`, `AioCycleDetailPage.tsx`,
  `SprintProgressTab.tsx` (categorical pass/fail/blocked or todo/inprogress/done segments).
- Upload / storage / determinate-task indicators with distinct meaning: `Sidebar.tsx`,
  `UpdateDialog.tsx`, `issue-detail/AttachmentUpload.tsx`, `issue-detail/AttachmentsSection.tsx`,
  `issue-detail/TimeTrackingSummary.tsx`.
These are out of scope by design — the user asked to unify progress bars to the releases
detail *single-value* completion style, which these multi-segment/utility bars are not.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- Reference style: ReleaseDetailPage.tsx lines 519-528 (the target look) -->
Track:  className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden mb-4"
Fill:   className="h-full rounded-full bg-green-500 transition-all"
        style={{ width: `${pct}%` }}

<!-- Shared component to restyle: src/components/ui/progress.tsx -->
<!-- Built on @base-ui/react/progress. Subcomponents: Progress (Root), ProgressTrack,
     ProgressIndicator, ProgressLabel, ProgressValue.
     Root renders children + ProgressTrack(ProgressIndicator) automatically.
     Width is driven by the CSS var: w-[calc(var(--progress-value)*1%)].
     base-ui Progress.Root provides the ARIA role="progressbar" + aria-valuenow/min/max
     automatically from the `value` prop — manual ARIA wrappers are not needed and the
     existing DashboardReleaseCard/DashboardSprintCard tests that assert getByRole('progressbar')
     + aria-valuenow keep passing. -->
Current ProgressTrack:     'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted'
Current ProgressIndicator: 'h-full bg-primary transition-all w-[calc(var(--progress-value)*1%)]'

<!-- Consumers of <Progress value={n} /> (auto-inherit the restyle): -->
<!-- DashboardReleaseCard.tsx:113, DashboardSprintCard.tsx:116,
     TodayInProgressSection.tsx:74 (className="max-w-[180px]"),
     TodayUpNextSection.tsx:77 -->

<!-- BulkProgressIndicator.tsx — single-value inline bar to migrate.
     Has role="progressbar" aria-valuenow/min/max wrapper. pct = (completed/total)*100. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle the shared Progress component to the releases-detail reference</name>
  <files>taskflow/src/components/ui/progress.tsx</files>
  <action>
    Update `ProgressTrack` and `ProgressIndicator` default classes so the shared
    `Progress` component matches the releases detail reference bar.

    - In `ProgressTrack`: change track height from `h-1` to `h-2` and keep `rounded-full bg-muted`.
      Final base classes: `relative flex h-2 w-full items-center overflow-x-hidden rounded-full bg-muted`.
    - In `ProgressIndicator`: change the fill color from `bg-primary` to `bg-green-500` and add
      `rounded-full` so the fill matches the reference. Keep `transition-all` and the existing
      `w-[calc(var(--progress-value)*1%)]` width binding.
      Final base classes: `h-full rounded-full bg-green-500 transition-all w-[calc(var(--progress-value)*1%)]`.

    Do NOT change the `max-w-xs` constraint inside the component — width capping stays the
    responsibility of the caller (DashboardReleaseCard, ReleaseDetailPage, etc.) via the
    `className` prop, since different call sites cap at different widths (e.g.
    TodayInProgressSection passes `max-w-[180px]`). This preserves all current callers.
    Leave `ProgressLabel` and `ProgressValue` untouched.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "bg-green-500" src/components/ui/progress.tsx && grep -q "h-2 w-full" src/components/ui/progress.tsx && ! grep -q "bg-primary" src/components/ui/progress.tsx && echo OK</automated>
  </verify>
  <done>progress.tsx track is h-2/bg-muted and indicator is bg-green-500/rounded-full; no bg-primary remains; the four existing `<Progress>` consumers compile unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate the two inline single-value bars to the shared Progress component</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/BulkProgressIndicator.tsx</files>
  <action>
    Replace the two remaining hand-rolled single-value progress bars with the shared
    `Progress` component so there is one source of truth.

    ReleaseDetailPage.tsx (the bar at the "Progress bar (Jira-driven)" block, ~lines 519-528):
    - Add `import { Progress } from '@/components/ui/progress';` to the existing `@/components/ui/*`
      import group.
    - Replace the inline `<div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden mb-4">`
      wrapper and its inner fill `<div>` with `<Progress value={pct} className="max-w-xs mb-4" />`,
      where `pct` is the existing computed percentage
      `Math.round((issueCounts.issuesFixed / issueCounts.issuesTotal) * 100)`. Keep the same
      surrounding `{issueCounts && issueCounts.issuesTotal > 0 && ( ... )}` guard.

    BulkProgressIndicator.tsx (lines 60-71):
    - Add `import { Progress } from '@/components/ui/progress';`.
    - Replace the hand-rolled `<div role="progressbar" ...>` track + inner fill `<div>` with
      `<Progress value={pct} />` (the existing `pct = total > 0 ? (completed / total) * 100 : 0`).
      The base-ui Progress Root manages its own ARIA `progressbar` role and value attributes,
      so the manual `role`/`aria-valuenow`/`aria-valuemin`/`aria-valuemax` wrapper is no longer
      needed. Keep the surrounding `flex flex-col gap-2 w-full` container and the status text /
      details below unchanged.

    Both call sites now inherit the unified releases-detail style from Task 1.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "from '@/components/ui/progress'" src/routes/dashboard/ReleaseDetailPage.tsx && grep -q "from '@/components/ui/progress'" src/routes/dashboard/BulkProgressIndicator.tsx && ! grep -q "h-1.5 bg-primary" src/routes/dashboard/BulkProgressIndicator.tsx && npm run build >/tmp/kza-build.log 2>&1 && echo BUILD_OK</automated>
  </verify>
  <done>Both files import and render `<Progress>`; the inline div bars are removed; `npm run build` succeeds with no type errors.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Restyled the shared `Progress` component to the releases-detail look (h-2 track,
    bg-muted, green rounded fill) and migrated the two remaining inline single-value bars
    (ReleaseDetailPage issue progress, BulkProgressIndicator) to use it. Six single-value
    progress bars now share one style:
    - Release detail page → Issues section progress bar
    - Dashboard "Next Release" card
    - Dashboard "Sprint Health" card
    - Standup Notes → Today → In Progress rows
    - Standup Notes → Today → Up Next rows
    - Bulk-operation indicator (visible when bulk-updating issues)
  </what-built>
  <how-to-verify>
    Run `cd taskflow && npm run tauri dev` (or your usual dev command), then:
    1. Open a release detail page (/release/:id) with issues — confirm the Issues progress bar
       is the green h-2 rounded bar (this is the reference; it should look the same as before).
    2. Open the Dashboard — the "Next Release" and "Sprint Health" cards' progress bars should
       now be green and slightly thicker (h-2) instead of the old thin purple/primary h-1 bar.
    3. Open Standup Notes → Today — the In Progress and Up Next rows' time-logged bars should
       match the same green style.
    4. (Optional) Trigger a bulk status update on multiple issues — the progress indicator bar
       should be the same green style.
    5. Confirm the multi-segment AIO test-status bars and sprint todo/in-progress/done bars are
       UNCHANGED (still multi-color segmented) — these are intentionally out of scope.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any bar that looks off</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npm run build` passes (type-check + bundle).
- `cd taskflow && npm test` passes — no test asserts on the old `bg-primary`/`h-1` Progress
  classes; DashboardReleaseCard/DashboardSprintCard tests assert getByRole('progressbar') +
  aria-valuenow, which base-ui Progress.Root still provides.
- `grep -rn "<Progress " taskflow/src --include="*.tsx" | grep -v test` shows 6 single-value
  call sites all using the shared component (DashboardReleaseCard, DashboardSprintCard,
  TodayInProgressSection, TodayUpNextSection, ReleaseDetailPage, BulkProgressIndicator).
- No `bg-primary` remains in `progress.tsx`.
- Multi-segment bars in AioProjectOverviewPage / AioCycleDetailPage / SprintProgressTab are untouched.
</verification>

<success_criteria>
- All single-value completion bars render via the shared `Progress` component.
- Shared `Progress` matches the releases-detail reference: `h-2` track, `bg-muted`, `bg-green-500`
  `rounded-full` fill with `transition-all`.
- Build succeeds; existing tests still pass (no test asserts on the old `bg-primary`/`h-1` Progress classes).
- Out-of-scope multi-segment and utility bars are unchanged.
- Human verification confirms visual consistency across the six call sites.
</success_criteria>

<output>
Create `.planning/quick/260525-kza-unify-progress-bar-styles-across-the-app/260525-kza-SUMMARY.md` when done.
</output>
