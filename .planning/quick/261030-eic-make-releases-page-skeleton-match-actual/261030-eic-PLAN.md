---
phase: quick-261030-eic
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/ReleasesSkeleton.tsx
  - taskflow/src/routes/dashboard/ReleasesSkeleton.test.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasesHero.test.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
autonomous: true
requirements: [QUICK-261030-eic]

must_haves:
  truths:
    - "While fix versions load, the Releases page skeleton shows the same structure as the loaded page: Today marker row, month label, a Next-release card, one full row, a second month label, quiet rows on the rail, then a muted Released panel with 3 rows and a 'Show older' line"
    - "Skeleton rows use the same grid (74px stamp / 24px rail / 1fr body), the same rail line, the same dot sizes and the same vertical padding as the real ReleaseAgenda rows, so the rows land at the same heights when data arrives"
    - "The header summary line has a placeholder while loading, so the header does not grow when the summary appears"
    - "Cached revisits still render no skeleton (existing D-10 test stays green)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/ReleasesSkeleton.tsx"
      provides: "Skeleton mirroring ReleaseAgenda + ReleasedPanel DOM"
      contains: "ROW_GRID"
    - path: "taskflow/src/routes/dashboard/ReleasesSkeleton.test.tsx"
      provides: "Structural tests for the skeleton"
    - path: "taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx"
      provides: "loading prop rendering a summary-line placeholder"
      contains: "releases-summary-skeleton"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleasesSkeleton.tsx"
      to: "taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx"
      via: "imports shared ROW_GRID / RAIL_LINE / LABEL_CLASS constants"
      pattern: "import \\{.*ROW_GRID.*\\} from './releases-list/ReleaseAgenda'"
    - from: "taskflow/src/routes/dashboard/ReleasesTab.tsx"
      to: "ReleasesHero"
      via: "loading={showSkeleton}"
      pattern: "loading=\\{showSkeleton\\}"
---

<objective>
Make the Releases list's first-load skeleton match the real page closely enough that there is almost no layout shift when the fix versions arrive.

Right now `ReleasesSkeleton` is just six identical rail rows. The loaded page looks different: a Today marker, month labels, a tall Next-release card, full and quiet rows with different padding, and a separate muted Released panel. The header also grows by one line when its summary appears.

Purpose: avoid the visible jump on the first visit to the Releases page.
Output: a rebuilt `ReleasesSkeleton` with tests, and a summary-line placeholder in `ReleasesHero` wired from `ReleasesTab`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Repo layout: .planning and git root at /Users/mimo/Documents/Projects/taskflow. App source, npm, vitest and biome live in /Users/mimo/Documents/Projects/taskflow/taskflow (run every command from there).

Facts the planner checked (code is the source of truth):
- The list does NOT render `UpcomingReleasesTimeline`. Only the home dashboard (`src/routes/dashboard/index.tsx`) uses it. It is out of scope, and so is `release-detail/ReleaseDetailSkeleton.tsx`.
- `ReleasesTab` always renders `<ReleasesHero>` (the standard header bar, `border-b px-6 py-4`). Below it, inside `<div className="px-6">`, it renders `{showSkeleton && <ReleasesSkeleton />}`. When loaded it renders `<div className="@container min-w-0"><ReleaseAgenda/><ReleasedPanel/></div>`. `showSkeleton = useDelayedLoading(loadingVersions) && !fixVersions`.
- The only existing test that touches the skeleton is `ReleasesTab.test.tsx:261`, which expects `queryAllByTestId('skeleton-row')` to have length 0 on a cached revisit. Keep `data-testid="skeleton-row"` on the skeleton's rail release rows.
- `ReleasedPanel` shows `RELEASED_PAGE_SIZE = 3` rows at first.

@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/ReleasesSkeleton.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/ReleasesTab.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/release/ReleasePackageCell.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/release/ReleaseStatusPill.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/EpicsSkeleton.test.tsx (analog for skeleton test style)
@/Users/mimo/Documents/Projects/taskflow/.claude/skills/sketch-findings-taskflow/references/releases-page-layout.md

User preferences:
- One row is one line.
- No bulk find-replace.
- Run biome --write only on the files you touch, never on all of src.
- The pre-commit hook runs full vitest + biome + tsc, so put tests and implementation in one commit per task.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rebuild ReleasesSkeleton to mirror ReleaseAgenda + ReleasedPanel</name>
  <files>taskflow/src/routes/dashboard/ReleasesSkeleton.tsx, taskflow/src/routes/dashboard/ReleasesSkeleton.test.tsx, taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx</files>
  <behavior>
    - Renders exactly one `agenda-today`-shaped row (data-testid="skeleton-today"), two month-label rows (data-testid="skeleton-month"), one next card (data-testid="skeleton-next-card"), and 5 rail release rows (data-testid="skeleton-row"): the next row, 1 full row and 3 quiet rows.
    - Every rail row and label row root carries the shared `ROW_GRID` classes (assert className contains `grid-cols-[74px_24px_minmax(0,1fr)]`).
    - Quiet rows use body padding `py-1.5`. The full row uses `py-[9px]`. Dots are the real `AgendaDot` (data-testid="agenda-dot"), 5 in total.
    - Renders a `section` with aria-label "Released loading" (or data-testid="skeleton-released") that contains 3 rows (data-testid="skeleton-released-row") and a 'show older' placeholder line.
    - All placeholder blocks use the shared `Skeleton` primitive (`[data-slot="skeleton"]` present). The whole skeleton root is `aria-hidden="true"`, so no text and no buttons get exposed.
  </behavior>
  <action>
In ReleaseAgenda.tsx, add `export` to the existing `ROW_GRID`, `RAIL_LINE` and `LABEL_CLASS` constants. Change nothing else there, so the skeleton and the real rail can never drift apart.

Rewrite ReleasesSkeleton.tsx so it mirrors the loaded DOM from ReleasesTab, ReleaseAgenda and ReleasedPanel. Import `Skeleton` from '@/components/ui/skeleton', `AgendaDot` from './releases-list/ReleaseAgendaParts', `Card` from '@/components/ui/card', and the three constants. Use `cn` for class merging.

Text placeholder technique (use it everywhere):
- Wrap each placeholder in an element with the SAME typography and padding classes as the real element (for example `text-sm font-semibold` or `text-[12.5px]`).
- Put a `Skeleton` with `inline-block align-middle` and an explicit height and width inside the wrapper.
- The wrapper's line box (font-size × line-height) then sets the row height, not the Skeleton height. Pick each Skeleton height a little below the font size (h-2.5 for 10–12px text, h-3 for xs/12.5px, h-3.5 for sm, h-4 for base).

Structure, top to bottom:
- Root: `<div aria-hidden="true" className="@container min-w-0">`, matching the ReleasesTab loaded wrapper.
- Agenda block: `<div className="mt-5 min-w-0">`, the same as the ReleaseAgenda root.
- Row 1, Today row:
  - Root: `cn(ROW_GRID, 'items-center py-1.5')`.
  - Stamp: a `pr-3 text-right text-[10px] font-semibold` wrapper with a w-9 placeholder.
  - Rail: a `cn(RAIL_LINE, 'self-stretch')` cell with the same absolute `h-0.5 w-3` tick span as the real row, but in `bg-muted-foreground/40`.
  - Body: `flex items-center gap-2.5 pl-3` with a `text-[11.5px]` w-16 placeholder followed by `<span className="h-px flex-1 bg-border" />`.
- Row 2, month label:
  - Root: `ROW_GRID` with an empty div, a `RAIL_LINE` div, and a `LABEL_CLASS` div holding a w-16 placeholder.
- Row 3, next release (data-testid="skeleton-row"):
  - Root: `ROW_GRID`.
  - Full stamp: `pt-2 pr-3 text-right`, with two stacked placeholder lines, `text-sm font-semibold` (w-10) over `text-xs` (w-7), aligned right (`ml-auto` or `text-right` with inline-block).
  - Rail cell: `RAIL_LINE` with `<AgendaDot kind="planned" quiet={false} />`. Use a neutral kind for every dot so the loading state carries no status colour.
  - Body: `py-1.5 pl-3` wrapping `<Card size="sm" data-testid="skeleton-next-card" className="relative gap-1.5 px-3.5">`. Inside the card, four lines:
    - kicker: a `text-[11px] font-bold` wrapper with a w-20 placeholder
    - name + pill: `flex items-center justify-between gap-2.5` with a `text-base font-semibold` w-40 placeholder and a pill-sized Skeleton (h-5 w-16 rounded-full, the STATUS_PILL_LAYOUT size; read ReleaseStatusPill/statusPill layout for the exact height and match it)
    - package + team: `flex items-center justify-between gap-3 text-xs` with an h-3 w-28 Skeleton (the same as ReleasePackageCell's loading skeleton) and a right-aligned team of 3 overlapping `size-5 rounded-full` Skeletons (`-ml-1 first:ml-0 ring-2 ring-background`)
    - issues slot: an `h-5 flex items-center` div with an h-2 w-full Skeleton (the same as the ReleaseIssuesSlot card loading state)
- Row 4, one full row (data-testid="skeleton-row"):
  - Full stamp as in Row 3.
  - Dot: `AgendaDot quiet={false}`.
  - Body: `flex items-center gap-4 rounded-lg px-3 py-[9px]`, with four children:
    - a `min-w-0 flex-1` column holding a `text-sm font-medium` w-40 placeholder and a `mt-0.5 flex` line with an h-3 w-28 Skeleton (the package line; the real row shows it when showPackage, which is the usual case)
    - a `flex w-[150px] flex-none items-center` cell with an `h-5` slot holding an h-1.5 w-[92px] Skeleton
    - a `hidden w-[104px] flex-none @[640px]:flex` cell with 3 overlapping size-5 avatar Skeletons
    - a `flex w-[100px] flex-none justify-end` cell with the pill Skeleton
- Row 5, a second month label, the same as Row 2.
- Rows 6–8, three quiet rows (data-testid="skeleton-row"):
  - Quiet stamp: `pt-2 pr-3 text-right text-xs font-medium whitespace-nowrap`, one w-12 placeholder.
  - Dot: `AgendaDot quiet`.
  - Body: `flex items-center gap-4 rounded-lg px-3 py-1.5`, with:
    - a `min-w-0 flex-1` `text-sm` placeholder; vary the widths (w-36/w-44/w-32) so it doesn't read as a stripe
    - the same w-[150px] issues cell with an h-1.5 w-[92px] Skeleton
    - an empty `hidden w-[104px] flex-none @[640px]:flex` cell (quiet rows have no team)
    - a `w-[100px] justify-end` cell with a `pr-1.5 text-[12.5px]` w-14 placeholder (timing text, not a pill)
  - On the LAST rail row, add `before:bottom-[calc(100%-16px)]` to its rail cell, exactly as ReleaseAgenda does.
- Released block: mirror ReleasedPanel with `<section data-testid="skeleton-released" className="mt-7 rounded-xl bg-muted/55 px-2 pt-3 pb-2">`.
  - Header: `flex items-baseline gap-2 px-3 pb-2` with a `text-[11px] font-bold` w-16 placeholder and a `text-xs` w-20 placeholder.
  - 3 rows (data-testid="skeleton-released-row"), each a div with `grid w-full grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg px-3 py-[7px]` (the same as the real button row, minus the interactivity) holding:
    - a right-aligned `text-[12.5px]` w-12 date placeholder
    - a `text-[13.5px]` name placeholder (vary w-40/w-32/w-48)
    - a `text-[12.5px]` h-3 w-14 placeholder (the same size as the real loading Skeleton)
  - Then a `py-1.5 pr-3 pl-[100px] text-[12.5px]` line with a w-32 placeholder (the real 'Show older releases' button; it is usually present).

Keep the file comment as a one-line doc saying the skeleton mirrors the F5 agenda + Released panel DOM and shares ROW_GRID/RAIL_LINE/LABEL_CLASS with ReleaseAgenda. Use static arrays or explicit JSX. Use small local helper components (for example `Line`, `FullStamp`, `QuietRow`) if they keep the file readable; no exports beyond `ReleasesSkeleton`.

Write ReleasesSkeleton.test.tsx (vitest + @testing-library/react, following the EpicsSkeleton.test.tsx style) covering the behavior list. Put the test and the implementation in one commit, because the pre-commit hook blocks RED commits.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/ReleasesSkeleton.test.tsx src/routes/dashboard/ReleasesTab.test.tsx src/routes/dashboard/releases-list && npx biome check src/routes/dashboard/ReleasesSkeleton.tsx src/routes/dashboard/ReleasesSkeleton.test.tsx src/routes/dashboard/releases-list/ReleaseAgenda.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
- The skeleton renders the Today row, 2 month labels, the next card, 1 full row, 3 quiet rows, and the Released panel with 3 rows plus a show-older line.
- Its row classes come from the shared constants.
- The new tests and the existing ReleasesTab/releases-list tests pass.
- biome and tsc are clean on the touched files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Placeholder for the header summary line while loading</name>
  <files>taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx, taskflow/src/routes/dashboard/releases-list/ReleasesHero.test.tsx, taskflow/src/routes/dashboard/ReleasesTab.tsx</files>
  <behavior>
    - With `summary={null}` and `loading`, ReleasesHero renders `data-testid="releases-summary-skeleton"` with at least 3 `[data-slot="skeleton"]` children and no `releases-summary`.
    - With `summary={null}` and loading false or omitted, it renders neither (keeps current behaviour for the error and empty states).
    - With a summary, it renders `releases-summary` and no skeleton, even when loading is true.
  </behavior>
  <action>
Add an optional `loading?: boolean` prop to ReleasesHero.

When `!summary && loading`, render in the summary slot a `<p data-testid="releases-summary-skeleton" aria-hidden="true">` that copies the real summary `<p>` classes (`mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs`). Inside it, put three items shaped like `Stat`: an `inline-flex items-center gap-1.5` span holding a size-3.5 rounded Skeleton (icon) and an `inline-block align-middle h-3` Skeleton (text, widths w-16/w-20/w-28). The header then keeps the same height when the real summary replaces the placeholder.

Do not change the title, the right-hand Updated/Refresh cluster, or the header bar classes. The header is the standard top-left bar the user approved.

In ReleasesTab.tsx, pass `loading={showSkeleton}` to `<ReleasesHero>`, so the header placeholder and the body skeleton appear together after the same delay. Move the `showSkeleton` declaration above the return if needed; it already is above it.

Add the three behavior cases to ReleasesHero.test.tsx. Put tests and implementation in one commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/releases-list/ReleasesHero.test.tsx src/routes/dashboard/ReleasesTab.test.tsx && npx biome check src/routes/dashboard/releases-list/ReleasesHero.tsx src/routes/dashboard/releases-list/ReleasesHero.test.tsx src/routes/dashboard/ReleasesTab.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
- The header shows a summary-line placeholder while fix versions first load, and the real summary replaces it in the same line box.
- Hero and Tab tests pass.
- biome and tsc are clean on the touched files.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Presentational loading-state change only; no new data, input, network or storage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-q261030-01 | Information disclosure | ReleasesSkeleton | accept | Renders only static placeholder blocks, no customer data; aria-hidden |
</threat_model>

<verification>
- From /Users/mimo/Documents/Projects/taskflow/taskflow: `npx vitest run src/routes/dashboard` passes, and `npx tsc --noEmit` is clean.
- `npx biome check` reports no NEW diagnostics on the touched files (the baseline drifts; don't gate on an absolute count).
- Optional visual check: in the app, clear the `jira-fix-versions` cache (or do a cold start) and open Releases. The skeleton's Today row, next card, rows and Released panel should sit where the real content lands, and the header should not grow when the summary arrives.
</verification>

<success_criteria>
- The skeleton's sections, row grid, paddings, dot sizes and panel match ReleaseAgenda and ReleasedPanel. The rail constants are shared, not copied.
- The header height is stable across loading → loaded.
- All existing Releases tests and the new skeleton and hero tests pass.
</success_criteria>

<output>
Create `/Users/mimo/Documents/Projects/taskflow/.planning/quick/261030-eic-make-releases-page-skeleton-match-actual/261030-eic-SUMMARY.md` when done
</output>
