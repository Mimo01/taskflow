---
phase: quick-261103-bfx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx
autonomous: true
requirements: [QUICK-261103-bfx]

must_haves:
  truths:
    - "MR labels and the 'N MRs without label' warning render in their own full-width strip below the graph grid, not inside the Merge requests cell (D-labels)"
    - "The warning chip comes first in the strip, then every label pill (no '+N more'); both toggle the task table label filter with aria-pressed"
    - "The Merge requests cell shows only the 120px ring (no legend, no labels), centred in band, 2x2, <=640 and <=440 layouts"
    - "Header, done bar, graphs and label strip read as one bordered stats block (header pt-3 pb-2, section border-y px-6 py-4) like AIO CycleHeader + CycleKpiTiles"
    - "Meta line stays two lines (MetaLine + PropertyStrip) and the description stays below it, with tightened spacing"
    - "At every container width the title row never wraps: title truncates, actions go icon-only under 640 and stay on the same row; the label strip wraps; no horizontal page scroll"
    - "Loading skeleton matches the new header/stats geometry and the ring-only MR slot (no fake legend bars)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx"
      provides: "Full-width flex-wrap label strip (warning chip first, all pills), UNLABELED_FILTER export kept"
      contains: "flex-wrap"
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx"
      provides: "Ring-only MR donut slot (no label props)"
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "release-stats section wrapping done bar + graph grid + MrLabels strip"
      contains: "release-stats"
    - path: "taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx"
      provides: "AIO-aligned header (non-wrapping title row) and block-less done bar"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "MrLabels"
      via: "<MrLabels labelSummary coverage activeLabel={labelFilter} onToggleLabel={toggleLabelFilter}> inside release-stats, after release-graph-grid, gated by showDonut && donutState === 'ready'"
      pattern: "<MrLabels"
    - from: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      to: "graphs/MrLabels.tsx"
      via: "UNLABELED_FILTER import (must keep resolving)"
      pattern: "UNLABELED_FILTER"
---

<objective>
Polish the top of the release detail page to match the shipped AIO cycle detail (CycleHeader + bordered CycleKpiTiles stats block), move the MR labels and the "N MRs without label" warning out of the Merge requests donut cell into their own full-width strip under the graphs, and make header / done bar / graphs / strip behave at band (>=1180), 2x2, <=640 and <=440 container widths.

Purpose: user request — header should feel like AIO cycle detail; label placement inside the donut cell is disliked; must work at every screen size.
Output: updated ReleaseHeader, MrLabels, ReleaseMrDonut, ReleaseDetailSkeleton, ReleaseDetailPage and their tests; a scratchpad screenshot check at four widths.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261103-bfx-polish-release-detail-header-to-match-ai/261103-bfx-CONTEXT.md
@.planning/quick/261103-bfx-polish-release-detail-header-to-match-ai/261103-bfx-RESEARCH.md
@.claude/skills/sketch-findings-taskflow/SKILL.md

Reference (read, do not modify):
@taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
@taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx

Working rules (from project memory, binding):
- App code, npm, vitest, biome live in `taskflow/taskflow/`; `.planning` and git at the outer root. Run test/lint commands from `/Users/mimo/Documents/Projects/taskflow/taskflow`.
- Pre-commit hook runs full vitest + biome + tsc: each task is ONE commit (test changes + implementation together) and must be green.
- Run `npx biome check <touched files>` only — never `biome --write` on all of src. Gate on "no new files flagged", not an absolute count.
- If editing via scripts/sed, grep every site afterwards (silent no-op after reformat).
- Container queries: `/page` variants only on descendants of `release-detail-scroll` (`@container/page`), never on that div itself. `ReleaseBreadcrumbHeader` is outside the container — leave it alone.
- `ReleaseStatusPill` stays inside its `flex flex-none` wrapper.
- Hover states change colour/brightness only; active state uses ring-2 (no layout shift).
- Pass label state as props from page hook state (React Compiler module-read pitfall).

Locked decisions from CONTEXT.md, referenced below as:
- D-01 Labels strip: own full-width strip directly under graph section, warning chip first then every pill (no cap), both keep filter-toggle (UNLABELED_FILTER, aria-pressed); donut slot ring only; strip renders nothing when no labels and no unlabeled MRs, and only under today's conditions (milestone/donut shown and ready).
- D-02 Stats block: keep full-width done bar (no KPI tiles); header + done bar + graphs read as one coherent block like AIO's `border-b py-4` stats block.
- D-03 Meta line: keep two lines (MetaLine + PropertyStrip); align spacing/type with CycleHeader.
- D-04 Description: keep position below meta line; tighten spacing.
- D-05 Responsive (LOCKED): design and check band (>=BAND_MIN_WIDTH), 2x2, @max-[640px]/page, @max-[440px]/page using `@container/page` queries; actions icon-only, title never pushed off, meta and strip wrap, no horizontal page scroll, compact.

Orchestrator resolutions:
- Label strip goes INSIDE the bordered stats block, after the graph grid, separated by a subtle top hairline (`border-t pt-3`) so header -> done bar -> graphs -> labels read as one block.
- `mr-labels-divider` testid may be dropped; replace coverage deliberately (placement outside release-graph-mrs, warning first, all pills shown, toggles filter).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Move MR labels into a full-width strip; MR donut becomes ring-only</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx, taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.test.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx</files>
  <behavior>
    - MrLabels root `mr-labels` is a single `flex flex-wrap` row (no `border-l`, no `mr-labels-grid`, no grid-template-rows style).
    - With unlabelled MRs, `mr-labels-unlabeled` is the first interactive child of the strip, is a compact chip (h-5, orange tint bg-orange-500/10, NOT `border-l-[3px]`, NOT `w-full`), reads "N MR(s) without label", has aria-pressed and toggles UNLABELED_FILTER on click.
    - All pills render for 12 labels (no `mr-labels-more`); clicking a pill calls onToggleLabel(name); active pill aria-pressed=true.
    - Warning-only case (no labels, missing>0): strip renders with chip and zero pills. No labels + no missing: returns null.
    - ReleaseMrDonut renders no `mr-labels` and has no label props; skeleton shows the ring skeleton only (no legend bars); centre total and no-legend tests stay.
    - ReleaseDetailPage: `mr-labels` is NOT inside `release-graph-mrs`, comes after `release-graph-grid` in document order (compareDocumentPosition FOLLOWING) and before the task table; still absent when the By-status fallback replaces the MR cell (existing L475-486 test kept); clicking a pill in the strip filters the task table (aria-pressed true).
  </behavior>
  <action>
Per D-01. In MrLabels.tsx: delete MAX_LABEL_ROWS, the maxRows/rows computation and the `grid grid-flow-col` pill grid with its inline gridTemplateRows/gridAutoColumns style, the `<hr data-testid="mr-labels-divider">`, and the root `border-l pl-3` column hairline. Root becomes `data-testid="mr-labels"` with `flex min-w-0 flex-wrap items-center gap-1.5 text-xs` plus className. Leading element: a muted `Tag` lucide icon (size-3.5, aria-hidden) followed by a "Labels" caption span (`text-xs text-muted-foreground`, add `@max-[440px]/page:sr-only` so it collapses at very narrow widths; do not use not-sr-only). Then the warning as an inline chip (keep `mr-labels-unlabeled` testid, keep button-when-interactive / div-otherwise, keep aria-pressed and existing active-ring treatment, keep TriangleAlert icon and text): classes `inline-flex h-5 flex-none items-center gap-1 rounded px-1.5 font-medium bg-orange-500/10 text-orange-800 dark:bg-orange-400/10 dark:text-orange-200`, hover only `hover:bg-orange-500/15`. If the chip and at least one pill are both present, place a small `aria-hidden` vertical hairline span (`h-4 border-l`) between them (no testid needed). Then every LabelPill directly in the flex row (no cap). In LabelPill drop `self-start justify-self-start` (grid leftovers) and cap the name span with `max-w-[16rem]` beside its existing `truncate` so a single long label cannot cause horizontal scroll. Keep the `UNLABELED_FILTER` export in this file (UnifiedTaskTable imports it). The `mr-labels-all` check branch is unreachable with the null-return guard — remove it and the Check import. Update the doc comment to describe the strip.

In ReleaseMrDonut.tsx: remove props labelCoverage, labelSummary, activeLabel, onToggleLabel and the MrLabels/LabelCoverage imports. Child becomes `my-auto flex justify-center` wrapping the AioDonut only (drop flex-wrap and the compact gap branch; keep `compact` selecting COMPACT_DONUT_SIZE). Skeleton: the AioDonutSkeleton alone in a `flex justify-center` (delete the three Skeleton bars and the Skeleton import if unused).

In ReleaseDetailPage.tsx: stop passing label props to ReleaseMrDonut. Import MrLabels. Directly after the graph grid (both the band and 2x2 branches, inside the non-noIssues fragment), render `<MrLabels labelSummary={labelSummary} coverage={labelCoverage} activeLabel={labelFilter} onToggleLabel={toggleLabelFilter} />` only when `showDonut && donutState === 'ready'` (same visibility as today). Task 1 commits on its own, so give the strip className `mx-6 mt-4 border-t pt-3` for now; Task 2 wraps grid + strip in the stats section and reduces it to `border-t pt-3`.

Tests: rewrite MrLabels.test.tsx L45-52, L64-80, L109-136 per behavior (replace grid/row-cap/divider assertions with flex-wrap strip, chip-first, chip geometry, no-cap assertions; keep the toggle/aria-pressed/no-more tests). Invert the "ReleaseMrDonut labels column" test (L139-154) to assert no `mr-labels` in the MR cell. Add a ReleaseMrDonut.test skeleton case asserting the loading state contains `release-mr-donut-skeleton` and no extra Skeleton bars. Update ReleaseDetailPage.test L457-473 (rename, assert not-inside + after grid + before table) and add a pill-click filter assertion if not already covered there.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/graphs src/routes/dashboard/ReleaseDetailPage.test.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/release-detail/graphs/MrLabels.tsx src/routes/dashboard/release-detail/graphs/MrLabels.test.tsx src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx src/routes/dashboard/ReleaseDetailPage.tsx src/routes/dashboard/ReleaseDetailPage.test.tsx</automated>
  </verify>
  <done>Labels/warning render only in the strip after the graph grid; MR cell is ring-only; grep shows no `MAX_LABEL_ROWS`, `mr-labels-grid`, `gridTemplateRows` in MrLabels.tsx and no `MrLabels` import in ReleaseMrDonut.tsx; targeted tests, tsc and biome on touched files pass; one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: AIO-aligned header + one bordered stats block (done bar, graphs, label strip) + skeleton in lockstep</name>
  <files>taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx</files>
  <behavior>
    - `release-detail-header` has `pt-3 pb-2`, still no `border-b`; its title row has `justify-between` and `gap-3` and does NOT have `flex-wrap`; the title group has `gap-3`; h1 keeps `min-w-0 truncate text-lg font-semibold`.
    - Every action Button has `flex-none`; LABEL spans keep `@max-[640px]/page:sr-only`; the Refreshed span has `@max-[640px]/page:hidden` and no viewport `sm:` class; pin accessible names "Pin release"/"Unpin release" unchanged.
    - `release-done-bar` no longer has `border-t`, `px-6`, `pt-4`; on the page it is inside `release-stats`.
    - `release-stats` section has `border-y px-6 py-4` and contains, in order, `release-done-bar`, `release-graph-grid`, `mr-labels` (when shown); `release-graph-grid` no longer has `px-6`/`pt-5`; noIssues renders no `release-stats` at all.
    - Skeleton header/stats mirror the live classes (header pt-3 pb-2; stats section border-y px-6 py-4; graph grid gaps gap-x-4 gap-y-5) and the MR skeleton slot has no legend bars.
  </behavior>
  <action>
Per D-02, D-03, D-04, D-05. ReleaseHeader.tsx (ReleaseDetailHeader): container `pt-3 pb-3` -> `pt-3 pb-2`. Title row: replace `flex flex-wrap items-center gap-x-3 gap-y-1` with `flex items-center justify-between gap-3` (no wrap per D-05 — title truncates, actions stay on the row). Title group `gap-2` -> `gap-3`; keep `title={name}` and the pill's `flex flex-none` wrapper. Actions group `ml-auto flex flex-none items-center gap-1.5` -> `flex flex-none items-center gap-2`; add `flex-none` to each action Button. Refreshed span: drop viewport `hidden ... sm:inline`, use `text-xs text-muted-foreground @max-[640px]/page:hidden`. Pin: switch to the single `Pin` icon with `fill-current text-primary` when pinned (AIO style; drop PinOff import if unused) but keep the text "Pin release"/"Unpin release" and LABEL sr-only pattern. Do not add a mono key (version id has no user meaning; a test asserts no v{id} line). MetaLine is already AIO-identical — leave ReleaseFacts.tsx untouched. PropertyStrip `className="mt-2"` -> `mt-1` (D-03). Description: keep position; at most `mt-0.5` (D-04). ReleaseDoneBar: remove `border-t px-6 pt-4` from its root (keep testid and internals).

ReleaseDetailPage.tsx: replace the separate `noIssues ? null : <ReleaseDoneBar/>` and the graph fragment with a single `noIssues ? null : <section data-testid="release-stats" aria-label="Release progress" className="flex flex-col gap-5 border-y px-6 py-4">` containing ReleaseDoneBar, then the band or 2x2 graph grid (remove `px-6 pt-5` from both grid classNames; keep every other grid/container-query class unchanged), then the MrLabels strip from Task 1 (className `border-t pt-3` only; remove any temporary `mx-6 mt-4`). Keep `release-no-issues` notice where it is (it renders when noIssues, so outside the section). The DeploymentPackageSection (mt-6) and the task table wrapper (pt-6) stay as-is below the section's border-b. Update the graph-section comment.

ReleaseDetailSkeleton.tsx: header `pt-3 pb-3` -> `pt-3 pb-2`; wrap the done-bar and graph skeletons in a `border-y px-6 py-4 flex flex-col gap-5` block mirroring release-stats (remove their own `border-t px-6 pt-4` / `px-6 pt-5`); graph grid gaps `gap-x-8 gap-y-7` -> `gap-x-4 gap-y-5`; remove the legend-like bars beside the MR donut skeleton. Keep its own `@container/page` root.

Tests: ReleaseHeader.test L79-87 keep (no border-b), add assertions for pb-2, title row no flex-wrap + justify-between, action buttons flex-none, Refreshed `@max-[640px]/page:hidden`; L185-193 rewrite to assert the done bar lacks border-t/px-6/pt-4. ReleaseDetailPage.test: add a test that `release-stats` has `border-y px-6 py-4` and contains done bar, graph grid and mr-labels in that DOM order, and that the noIssues case renders no `release-stats`. ReleaseDetailSkeleton.test: update any class assertions that referenced the old spacing; add one asserting no legend bars in the MR slot skeleton.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/release-detail/ReleaseHeader.tsx src/routes/dashboard/release-detail/ReleaseHeader.test.tsx src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx src/routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx src/routes/dashboard/ReleaseDetailPage.tsx src/routes/dashboard/ReleaseDetailPage.test.tsx</automated>
  </verify>
  <done>Header matches CycleHeader geometry; done bar + graphs + label strip live in one `release-stats` border-y section; skeleton mirrors it; all release-detail tests, tsc and biome on touched files pass; one commit.</done>
</task>

<task type="auto">
  <name>Task 3: Responsive check at four container widths (band, 2x2, 640, 440)</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx</files>
  <action>
Per D-05. (a) Committed test coverage: in ReleaseDetailPage.test.tsx add a `describe('responsive classes')` block asserting the container-query contract (jsdom cannot lay out, so assert classes): `release-detail-scroll` has `@container/page` and no `@max-[` classes on itself; header LABEL spans carry `@max-[640px]/page:sr-only`; the 2x2 `release-graph-grid` carries `@max-[640px]/page:grid-cols-2` and `@max-[440px]/page:grid-cols-1`; the band grid is used when the mocked ResizeObserver width >= BAND_MIN_WIDTH (reuse the file's existing width-mock pattern) and the 2x2 grid below it; `mr-labels` has `flex-wrap` and its "Labels" caption carries `@max-[440px]/page:sr-only`; the title row lacks `flex-wrap`. (b) Visual check, NOT committed: in the scratchpad `/private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/06548ce5-cfbb-4680-9bf3-fe2f6e86c2fc/scratchpad`, build a throwaway vite entry (per memory "screenshot via throwaway vite page + cached Chromium") that renders ReleaseDetailHeader, a stats section with ReleaseDoneBar, a ReleaseMrDonut ring and MrLabels (12 labels incl. one very long name + 3 unlabelled MRs) inside an `@container/page` div, and screenshot it at container widths 1300, 1000, 600 and 400 px using the cached Playwright Chromium. Check for each: no horizontal overflow (document.scrollWidth <= clientWidth on the container), title single line and truncated not pushed off, actions on the title row (icon-only at 600/400), label strip wraps with chip first, ring centred. Fix any defect in the Task 1/2 files (amend via a new fix commit) and re-shoot. If no cached Chromium is found, record that in the SUMMARY and rely on (a). Report screenshot paths in the SUMMARY. Do not add the throwaway entry to the repo.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/ReleaseDetailPage.test.tsx -t "responsive" && npx biome check src/routes/dashboard/ReleaseDetailPage.test.tsx</automated>
    <!-- After the task-3 commit: `git status --porcelain -- taskflow/src` must be empty (no screenshot/throwaway files leaked into src). -->
  </verify>
  <done>Responsive class tests pass; screenshots at 1300/1000/600/400 show no horizontal overflow, non-wrapping title row, wrapping label strip, centred ring (or absence of Chromium noted); no throwaway files in the repo; full pre-commit suite green on commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitLab API -> UI | MR label names/colours are rendered as text and inline CSS colour values |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-bfx-01 | Tampering | MrLabels label name/colour rendering | accept | Unchanged from today: names rendered as React text (escaped); colours pass through existing labelPillColors; no new inputs or packages |
</threat_model>

<verification>
- `cd taskflow/taskflow && npx vitest run && npx tsc --noEmit` green (pre-commit runs it on each commit).
- `npx biome check` on touched files: no new files flagged.
- grep: `UNLABELED_FILTER` still exported from graphs/MrLabels.tsx and imported by UnifiedTaskTable.tsx; `release-stats` present in ReleaseDetailPage.tsx; no `mr-labels-grid`/`MAX_LABEL_ROWS` left anywhere in src.
- Screenshots at 1300/1000/600/400 reviewed.
</verification>

<success_criteria>
- Labels + warning chip live in a wrapping full-width strip at the bottom of the bordered stats block; MR cell is ring-only.
- Header geometry matches CycleHeader (pt-3 pb-2, non-wrapping title row with gap-3, flex-none actions, container-only Refreshed hiding); meta stays two lines; description in place.
- Done bar, graphs and strip form one `border-y px-6 py-4` section; skeleton mirrors it.
- No horizontal overflow at any of the four container widths; existing coverage replaced, not deleted.
</success_criteria>

<output>
Create `.planning/quick/261103-bfx-polish-release-detail-header-to-match-ai/261103-bfx-SUMMARY.md` when done (include screenshot paths and any deviations).
</output>
