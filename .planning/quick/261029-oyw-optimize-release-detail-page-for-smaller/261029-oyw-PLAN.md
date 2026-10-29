---
phase: quick-261029-oyw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
  - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/hooks/useResizable.ts
  - taskflow/src/hooks/useResizable.test.ts
autonomous: false
requirements: [QUICK-261029-oyw]

must_haves:
  truths:
    - "At every table width the task rows stay on ONE line and the summary column stays visible (no horizontal scroll of the left column)"
    - "Below 860px table width, Assignee shows avatar only and the MR column is compact (short visible state text), with full names still in the accessible tree"
    - "Below 640px the type icon and Assignee columns drop; below 520px the MR column drops; below 400px Status drops; header strip stays aligned with rows at every tier"
    - "The release sidebar stays side-by-side at all widths but its rendered width is capped (never more than 50% of the body, leaves the main column >= 30rem, never below 12.5rem) and reacts to peek open/window resize without changing the persisted width"
    - "Dragging the capped sidebar starts from its rendered width (no dead-zone)"
    - "Sidebar metadata rows, branch and tag names fit/truncate at the narrow sidebar width; breadcrumb truncates instead of being silently clipped"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      provides: "Container-query tiered COL_* constants, @container section, compact MR/assignee cells"
      contains: "@max-[860px]:w-5"
    - path: "taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx"
      provides: "CSS maxWidth cap on sidebar root, @container inner wrapper, truncating branch/tag"
      contains: "min(50%"
    - path: "taskflow/src/routes/dashboard/release-detail/MetaRow.tsx"
      provides: "Label stacks over value below 240px sidebar content width"
      contains: "@max-[240px]:flex-col"
    - path: "taskflow/src/hooks/useResizable.ts"
      provides: "Optional getStartWidth option used at drag start"
      contains: "getStartWidth"
  key_links:
    - from: "UnifiedTaskTable.tsx COL_* constants"
      to: "ColumnHeaderStrip and TaskRow cells"
      via: "shared class constants (header/row alignment)"
      pattern: "const COL_PERSON = .*@max-\\[640px\\]:hidden"
    - from: "UnifiedTaskTable <section>"
      to: "row descendants"
      via: "@container on section (variants only style descendants)"
      pattern: "<section className=\"@container"
    - from: "ReleaseDetailPage.tsx useResizable call"
      to: "ReleaseDetailSidebar root element"
      via: "getStartWidth reads sidebar root offsetWidth through a ref"
      pattern: "getStartWidth"
---

<objective>
Make the Release detail page usable at narrow widths (small windows and when the peek panel is open) per the locked decisions in 261029-oyw-CONTEXT.md and the measured tiers in 261029-oyw-RESEARCH.md.

Purpose: today only windows >= 1440px without peek work; at the default 1100px Tauri window the task rows overflow and the summary is crushed to negative width.
Output: tiered container-query columns in UnifiedTaskTable, a CSS-capped side-by-side sidebar with narrow-safe content, truncating breadcrumb, and class-string tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261029-oyw-optimize-release-detail-page-for-smaller/261029-oyw-CONTEXT.md
@.planning/quick/261029-oyw-optimize-release-detail-page-for-smaller/261029-oyw-RESEARCH.md
@taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
@taskflow/src/routes/my-tasks/MyTaskRow.tsx
@taskflow/src/routes/my-tasks/MyTaskRow.test.tsx

Repo layout: .planning and git live at /Users/mimo/Documents/Projects/taskflow; src, npm, vitest, biome run from /Users/mimo/Documents/Projects/taskflow/taskflow.

Project rules (from memory, binding):
- The pre-commit hook runs the full vitest suite + biome lint: put tests and implementation in ONE commit per task (no RED-only commits).
- Run biome only on touched files (npx biome check <files>); never `--write` on all of src. Gate on "no NEW diagnostics in touched files", not an absolute count.
- jsdom cannot evaluate container queries: tests assert class strings / DOM structure / style attributes only; the visual check is the human checkpoint.
- Container variants never style the @container element itself; put @container on an ancestor and the variants on descendants.
- Inline style width beats variant classes: never move a tiered width into style={{}}.
- statusPillClass must keep its flex parent; do not add geometry to the pill. Italic text + truncate needs pr-0.5. Every narrow cell keeps an explicit width (WebKit 0-width collapse). No duplicated visible labels (getByText throws on multiple matches); sr-only / hidden text still counts in textContent.
- After any scripted/regex edit, grep each site to confirm it applied (biome reindent can make python replaces silently no-op).
- One row = one line at every width: drop columns, never wrap rows.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Container-query column tiers in UnifiedTaskTable (compact, then drop)</name>
  <files>taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</files>
  <behavior>
    - The table section element carries the `@container` class.
    - Header strip and a task row both carry the tier classes from the shared constants: person cell has `@max-[860px]:w-5` and `@max-[640px]:hidden`; icon cell has `@max-[640px]:hidden`; MR cell has `@max-[860px]:w-[5.5rem]` and `@max-[520px]:hidden`; state cell has `@max-[400px]:hidden`.
    - The assignee name / "Unassigned" span is wrapped in (or carries) `@max-[860px]:sr-only`; the header "Assignee" label is a single `@max-[860px]:sr-only` span (getByText('Assignee') still finds exactly one).
    - The selected-MR state Badge sits inside an `@max-[860px]:sr-only` wrapper; slot states (failed/none/unavailable) render a short aria-hidden visible variant (`hidden @max-[860px]:inline`) alongside the long text in `@max-[860px]:sr-only`, and existing assertions (/unknown/i, /milestone/i, /not checked/i, queryByText('No merge request'), title attributes) keep passing.
    - The Issues header count badges hide their words below 520 (`@max-[520px]:hidden` spans) while counts and aria-labels stay; existing toHaveTextContent('2') still passes.
    - Secondary MR table header still has exactly Key / Merge request / BR / MS (WR-06 tests unchanged and passing).
  </behavior>
  <action>
    Implements the CONTEXT "Table columns" locked decision (tiered container-query degradation: compact first, then drop; summary keeps priority; one line at every width) using RESEARCH section 3 tiers, which follow the My Tasks `@max-[...]` convention (Claude's discretion on thresholds).

    1. Add `@container` to the `<section>` at UnifiedTaskTable.tsx ~line 980 (the section itself gets no other variant classes).
    2. Rewrite the shared constants at ~lines 77-82 so header strip and rows stay aligned: COL_ICON gains `@max-[640px]:hidden`; COL_PERSON gains `@max-[860px]:w-5 @max-[640px]:hidden`; COL_STATE gains `@max-[400px]:hidden`; COL_MR gains `@max-[860px]:w-[5.5rem] @max-[520px]:hidden`. COL_KEY and COL_SUMMARY unchanged. Confirm each constant is actually consumed by both ColumnHeaderStrip (~:380) and TaskRow cells; if any row cell hardcodes the width instead of using the constant, switch it to the constant. Do not put tiered widths in inline style (the TaskRow icon cell's inline width/height style ~:879 sets no display and stays).
    3. Header strip: make "Assignee" a single span with `@max-[860px]:sr-only` (do NOT render a second short label). Leave Key/Summary/Status/MR/BR/MS labels single-instance; if "Status" or "MR" header text overflows its column at a tier it is hidden together with the column anyway.
    4. Assignee cell (~:897-915): put the name (`line-clamp-1`) and "Unassigned" spans under `@max-[860px]:sr-only`; CachedAvatar keeps explicit size={20}. The cell is pointer-events-none, so do not rely on title.
    5. TaskMrCell (~:619-831): wrap the selected-MR state Badge (~:769) in a span with `@max-[860px]:sr-only` (no geometry added to the Badge; the `!iid` link colour from stateLinkClass ~:722 still conveys state). For the four pointer-events-none slot states, keep the long text in a `@max-[860px]:sr-only` span and add a short `aria-hidden` span with `hidden @max-[860px]:inline`: pending = spinner only (no short text), failed = "— unknown", none = existing warning icon + "No MR", unavailable = "— not checked". Add `truncate min-w-0` to the slot text containers as an 88px guard.
    6. Issues header row (~:981-1015): wrap the descriptive words of the "x / y done", "N wrong branch", "N no milestone" badges in `@max-[520px]:hidden` spans so icon + count remain; add a `title` equal to the existing aria-label on each interactive badge button; add `flex-wrap gap-y-1` to that header row (header, not a list row).
    7. Secondary table key cell (~:1175): add `overflow-hidden` so icon + key + "+1" cannot spill; keep SecondaryHeaderStrip labels exactly as-is.
    8. Do NOT add overflow-hidden to TaskRow (would clip the overlay button focus ring at ~:869). Do NOT touch statusPillClass / STATUS_PILL_LAYOUT_CLASS geometry; Status is dropped at the last tier instead (RESEARCH A3).
    9. Add a "responsive container tiers" describe block in UnifiedTaskTable.test.tsx mirroring MyTaskRow.test.tsx: assert the classes listed in <behavior> via toHaveClass on the header-strip cells and on one rendered TaskRow's cells (locate via existing testids or closest() from known text), the sr-only wrappers around the assignee name and MR badge, the short slot variant text presence, and `@container` on the section.
    Format/lint only the two touched files. Commit tests + implementation together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx && npx biome check src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx && npx tsc --noEmit -p .</automated>
  </verify>
  <done>All existing UnifiedTaskTable tests pass unchanged; new tier tests pass; `grep -n "^const COL_" UnifiedTaskTable.tsx` shows the four tiered constants; the section has `@container`; biome reports no diagnostics in the touched files; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Capped side-by-side sidebar, drag start from rendered width, narrow-safe sidebar content and breadcrumb</name>
  <files>taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx, taskflow/src/routes/dashboard/release-detail/MetaRow.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/hooks/useResizable.ts, taskflow/src/hooks/useResizable.test.ts</files>
  <behavior>
    - Sidebar root `style.maxWidth` contains `min(50%` (cap expression `max(12.5rem, min(50%, 100% - 30rem))`) and `style.width` still equals the hook width.
    - The sidebar inner wrapper carries `@container`; MetaRow root carries `@max-[240px]:flex-col` and its label carries `@max-[240px]:w-auto`; `meta-row-*` testids unchanged.
    - Branch name and tag name elements carry `truncate` and a `title` with the full name.
    - useResizable: when `getStartWidth` is provided, a mousedown + mousemove drag computes the new width from getStartWidth() rather than the stored width; without it, behaviour is unchanged (existing tests pass).
  </behavior>
  <action>
    Implements the CONTEXT "Sidebar" locked decision (side-by-side at all widths, no stacking, no collapse toggle; shrinks at narrow widths via a clamp; content still fits/truncates) using RESEARCH section 4, plus the page-chrome discretion items from RESEARCH section 5.

    1. ReleaseDetailSidebar.tsx root (~:274-276): change style to include `maxWidth: 'max(12.5rem, min(50%, 100% - 30rem))'` next to `width`. Do not change the hook's `max` option (would persist narrow widths for wide screens). Accept a new optional `rootRef` prop (React.RefObject of HTMLDivElement or null) attached to the root div; add it to ReleaseDetailSidebarProps.
    2. useResizable.ts: add optional `getStartWidth?: () => number` to UseResizableOptions; in handleMouseDown (~:79) use `getStartWidth?.() ?? widthRef.current` for startRef width. Non-breaking for the other callers (PeekPanel, Sidebar, MergeRequestDetailPage, IssueDetailView, AioTestRunDetailPage). Add a test in useResizable.test.ts that a drag starts from getStartWidth's value (follow the existing test's mousedown/mousemove pattern).
    3. ReleaseDetailPage.tsx (~:140-146): create a `sidebarRef` with useRef, pass `getStartWidth: () => sidebarRef.current?.offsetWidth ?? width` (if referencing `width` before declaration is awkward, fall back to `releaseDetailPanelWidth`), and pass `rootRef={sidebarRef}` to ReleaseDetailSidebar. Optional discretion item: add `@container` to the left-column div (~:234) and `@max-[480px]:p-4` to the padded div (~:235) to return 16px to the table at the narrowest width.
    4. Sidebar inner wrapper (~:287): add `@container`. MetaRow.tsx: row gets `@max-[240px]:flex-col @max-[240px]:gap-0.5`, label gets `@max-[240px]:w-auto` (label stacks over value below 240px sidebar content width; the one-line rule applies to list rows, not metadata). Keep the data-testid unchanged. This MetaRow is only imported by ReleaseDetailSidebar (issue-detail has its own copy; do not touch it).
    5. Branch name (~:143-144) and tag name (~:175): wrapper gets `inline-flex max-w-full min-w-0`, the name span gets `truncate` + `title` with the full name. Italic tag-state texts (~:177, ~:181) that get truncate also get `pr-0.5`.
    6. ReleaseHeader.tsx ReleaseBreadcrumbHeader (~:19-41): add `min-w-0` to the container; `shrink-0` to the back button and every `/` separator; crumb link spans get `min-w-0` and the labels `truncate`; the trailing version name span gets `truncate min-w-0` and `title={versionName}`. Run ReleaseHeader.test.tsx to confirm unchanged behaviour.
    7. ReleaseDetailSidebar.test.tsx: add assertions for maxWidth containing `min(50%`, `@container` on the inner wrapper, MetaRow `@max-[240px]:flex-col`, and truncate + title on the branch name.
    Lint/format only touched files. Commit tests + implementation together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/ src/hooks/useResizable.test.ts && npx biome check src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/routes/dashboard/release-detail/MetaRow.tsx src/routes/dashboard/release-detail/ReleaseHeader.tsx src/routes/dashboard/ReleaseDetailPage.tsx src/hooks/useResizable.ts src/hooks/useResizable.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>All release-detail and useResizable tests pass (existing + new); `grep -n "maxWidth" ReleaseDetailSidebar.tsx` shows the cap; `grep -n getStartWidth` hits useResizable.ts and ReleaseDetailPage.tsx; no new biome diagnostics in touched files; tsc clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Tauri width sweep of the Release detail page</name>
  <files>none (verification only)</files>
  <action>No code changes. Pause for the user to run the width sweep described in how-to-verify; if issues are reported, fix them in the Task 1/2 files and re-run their automated verify commands.</action>
  <verify><automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/ src/hooks/useResizable.test.ts</automated></verify>
  <done>User replies "approved" after the sweep at 1440/1280/1100/1024px with and without peek.</done>
  <what-built>Tiered container-query columns in the release task table, CSS-capped side-by-side sidebar with drag starting from rendered width, narrow-safe sidebar metadata/branch/tag, truncating breadcrumb. jsdom cannot evaluate container queries, so this visual sweep is the real proof.</what-built>
  <how-to-verify>
    1. From /Users/mimo/Documents/Projects/taskflow/taskflow run `npm run tauri dev` and open a release with tasks, MRs, and a release branch/tag.
    2. Resize the window to roughly 1440, 1280, 1100 and 1024px wide; at each width check with the peek panel closed, then open a task peek.
    3. At every width: each task row is ONE line, the summary text is visible, the left column never scrolls sideways, and header labels sit above their columns.
    4. Narrowing progressively: Assignee becomes avatar only and MR becomes compact (short state text visible), then type icon + Assignee disappear, then MR, then Status; BR/MS buttons remain.
    5. Sidebar stays beside the content, shrinks when the peek opens and grows back when it closes; drag the sidebar handle while capped and confirm it moves immediately (no dead-zone).
    6. In a narrow sidebar, metadata labels stack above values, branch/tag names truncate with a tooltip; the breadcrumb truncates the release name instead of cutting it off.
    7. Optionally repeat one width at the largest text-size setting (px thresholds vs rem columns, RESEARCH A2).
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (e.g. preferred drop order, thresholds too early/late)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira/GitLab data -> React render | Issue summaries, assignee names, branch/tag names rendered as text (already escaped by React) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-oyw-01 | Information disclosure | title attributes on branch/tag/version names | accept | Same data already visible on the page; React escapes attribute values |
| T-oyw-02 | Tampering | CSS-only layout changes | accept | No new inputs, endpoints, storage or packages; persisted panel width semantics unchanged (hook max untouched) |
</threat_model>

<verification>
- `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/ src/hooks/useResizable.test.ts` passes.
- Biome clean on all touched files; `npx tsc --noEmit -p .` clean.
- Pre-commit hook (full vitest + lint) passes on each task commit.
- Human Tauri sweep (Task 3) approved.
</verification>

<success_criteria>
- At the default 1100px Tauri window and at 1280px with the peek open, task rows are one line with a readable summary and no horizontal scroll.
- Sidebar remains side-by-side, capped responsively, persisted width unchanged, drag responsive while capped.
- All existing tests pass unchanged; new class-string tests lock the tiers.
</success_criteria>

<output>
Create `.planning/quick/261029-oyw-optimize-release-detail-page-for-smaller/261029-oyw-SUMMARY.md` when done.
</output>
