---
phase: quick-261105-nly
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.tsx
  - taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
autonomous: true
requirements: [QUICK-261105-nly]

must_haves:
  truths:
    - "On a narrow issue detail column (peek panel, narrow window), the Subtasks / Epic Stories / Parent row summary stays readable on one line instead of being squeezed to nothing"
    - "Below a 42rem row width the time progress bar is hidden; at 42rem and wider it shows as before"
    - "Below a 36rem row width the assignee collapses to the avatar only; the avatar is always shown and still has a tooltip and accessible name"
    - "Each row stays a single line at every density; the key and status pill never drop"
    - "All three relationship row sites (Epic→Stories, Story→Subtasks, Subtask→Parent) use one shared row component, so they behave the same way"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.tsx"
      provides: "Shared responsive relationship row (key, summary, assignee, optional time bar, status pill)"
      exports: ["RelatedIssueRow"]
      contains: "@container"
    - path: "taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.test.tsx"
      provides: "Asserts responsive classes + avatar always present + click handler"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "RelatedIssueRow"
      via: "import from ./issue-detail/RelatedIssueRow, used at 3 sites"
      pattern: "<RelatedIssueRow"
    - from: "RelatedIssueRow time bar wrapper"
      to: "StackedTimeBar testId story-time-bar"
      via: "wrapper span hidden @[42rem]:flex, bar keeps testId"
      pattern: "story-time-bar"
---

<objective>
Stop the issue-detail relationship rows (Epic→Stories, Story→Subtasks, Subtask→Parent) from crushing the
summary on narrow widths. Today every element except the summary is `shrink-0` (key, avatar + full
display name, 6rem time bar, status pill), so in the peek panel or a narrow window the summary is
truncated to almost nothing.

Fix: extract one shared `RelatedIssueRow` with container-query staging (per the user's request: hide the
time progress bar, collapse the assignee to the avatar) and use it at all three sites.

Purpose: task names stay readable in narrow layouts.
Output: `RelatedIssueRow.tsx` + test, IssueDetailContent.tsx rewired, the local `RowTimeBar` removed.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/dashboard/IssueDetailContent.tsx
@taskflow/src/components/ui/page-header.tsx
@taskflow/src/components/jira/StackedTimeBar.tsx
@taskflow/src/routes/dashboard/IssueDetailContent.test.tsx

Repo layout: `.planning/` and git live at the outer `taskflow/`; src, npm, vitest and biome run in the inner
`taskflow/taskflow/` (cd there for every command). The pre-commit hook runs the full vitest suite, biome and
tsc, so put the test and implementation in one commit per task. Do NOT run `biome --write` across all of
src; only format the files you touched.

Current row sites in IssueDetailContent.tsx (verified):
- `RowTimeBar` helper, lines ~106-116: StackedTimeBar with widthClassName "w-24", caption "none",
  testId "story-time-bar", alwaysShowTrack.
- Story→Subtasks rows inside `subtaskListContent`, lines ~141-172. Time bar = `timeBarIssues(sub, null, { isSubtask: true })`.
  Status category comes from `sub.fields.status.statusCategory as { key?: string } | undefined`.
- Epic→Stories rows, lines ~336-370. Time bar = `timeBarIssues(story)`.
- Subtask→Parent row, lines ~430-456. No time bar. Has `aria-label={`Open parent issue ${parent.key}`}`,
  padding `py-2 density-compact:py-1 density-comfortable:py-3` (the list rows use
  `py-1.5 density-compact:py-1 density-comfortable:py-2.5`). The status pill only renders when
  `parentStatus?.name` is set. Assignee is `parentAssignee` (may be null).
- Shared row button classes: `w-full flex items-center gap-2 px-2 <py…> rounded hover:bg-accent text-sm text-left cursor-pointer`.
- Assignee block: `div.flex.items-center.gap-1.5.shrink-0` with `title={displayName}`, a 20px CachedAvatar
  and a `span.text-xs.text-muted-foreground` holding the display name.

CachedAvatar already sets `role="img"` + `aria-label={name}` (fallback) / `alt={name}` (img), so the assignee
stays accessible when the name text is visually hidden. No sr-only duplicate is needed. Don't add one: it
would also break `getByText(displayName)` queries in IssueDetailSheet.test.tsx.

Other row components checked and left OUT of scope:
- `src/routes/my-tasks/MyTaskRow.tsx`: already avatar-only assignee, own container staging (`@max-[1024px]:hidden`).
- `src/routes/standup-notes/TodayInProgressSection.tsx` / `TodayUpNextSection.tsx`: already avatar-only
  assignee inside the `@container` TodayColumn; Today-row time-bar layout is a separately approved design (261102-fy2).
- `src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx`: no assignee or time bar, so it doesn't have this problem.
- `src/routes/dashboard/issue-detail/SubtasksSection.tsx`: a no-op placeholder that renders null.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create shared RelatedIssueRow with container-query staging</name>
  <files>taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.tsx, taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.test.tsx</files>
  <behavior>
    - Root wrapper element has class `@container`. The flex row is a child `<button type="button">`, never the container itself (Tailwind `@container` variants don't style the container element).
    - With `timeBarIssues` given: an element with data-testid `story-time-bar` renders, and its wrapper has classes `hidden` and `@[42rem]:flex`.
    - Without `timeBarIssues`: no `story-time-bar` in the DOM.
    - With an assignee: the avatar (role img, accessible name = displayName) is present, and no ancestor up to the button has a `hidden` class. The display-name text span has `hidden` and `@[36rem]:block`. The assignee block keeps `title={displayName}`.
    - Without an assignee (null/undefined): no avatar and no name.
    - Summary span has `flex-1`, `min-w-0` and `truncate`. The key span has `shrink-0`.
    - The status pill renders with `statusPillClass(statusCategoryKey)` only when `statusName` is truthy.
    - Clicking the button calls `onClick` once. `ariaLabel` is forwarded as `aria-label` when provided.
    - `buttonClassName` is merged into the button classes (via cn), so a padding override applies.
  </behavior>
  <action>
Create `RelatedIssueRow` in `src/routes/dashboard/issue-detail/RelatedIssueRow.tsx` (named export). Props:
`issueKey: string`, `summary: string`, `assignee?: { displayName: string; avatarUrls?: { '48x48'?: string } } | null`,
`statusName?: string`, `statusCategoryKey?: string`, `timeBarIssues?: JiraIssue[]` (type from `@/services/jira`),
`onClick: () => void`, `ariaLabel?: string`, `buttonClassName?: string`.

Structure: a `div` with class `@container` wrapping a `button type="button"`. The button gets the existing row classes
`w-full flex items-center gap-2 px-2 rounded hover:bg-accent text-sm text-left cursor-pointer`, plus the default list padding
`py-1.5 density-compact:py-1 density-comfortable:py-2.5`, merged with `buttonClassName` via `cn` (tailwind-merge lets the
Parent row's py override win). Children in order:
1. Key span: `font-mono text-xs text-muted-foreground shrink-0`.
2. Summary span: `flex-1 min-w-0 truncate`.
3. Assignee block (only if assignee): `div.flex.items-center.gap-1.5.shrink-0` with `title={displayName}`, a CachedAvatar (size 20, url = avatarUrls?.['48x48'], name = displayName) that is ALWAYS visible (user preference: the avatar never drops), then the name span `hidden @[36rem]:block max-w-[9rem] truncate text-xs text-muted-foreground`. Use hidden/@[N]:block, not sr-only/not-sr-only toggling, because not-sr-only resets white-space/overflow and makes names wrap. The `max-w-[9rem]` cap stops a long display name from taking the summary's space when shown. The full name stays available via the title tooltip and the avatar aria-label.
4. Time bar (only if timeBarIssues): `span` wrapper `hidden @[42rem]:flex shrink-0` around StackedTimeBar with the exact props the old RowTimeBar used (widthClassName "w-24", caption "none", testId "story-time-bar", alwaysShowTrack). Keep the testId on the bar itself so the existing tests in IssueDetailContent.test.tsx keep finding it (jsdom ignores the CSS hiding).
5. Status pill (only if statusName): `span` with `statusPillClass(statusCategoryKey)`. The button is the flex parent the pill needs.

Breakpoint rationale: put a short comment block in the file. Measured against the ROW width (the `@container` div), not the viewport, because IssueDetailContent renders in both the full page and the resizable PeekPanel (default 480px = 30rem). Approximate fixed widths: key ~4.5rem, avatar 1.25rem, name ≤9rem, time bar 6rem, pill ~6rem, gaps + padding ~3rem. So all columns ≈ 30rem, and without the bar ≈ 24rem. Showing the bar from 42rem and the name from 36rem keeps the summary at least ~12rem at every stage. Below 36rem only key + avatar + pill (~13rem) are fixed. This follows the PageHeader `hidden @[Nrem]:inline` staging convention (page-header.tsx).

Write `RelatedIssueRow.test.tsx` first (RED) covering every bullet in <behavior>, using @testing-library/react. StackedTimeBar renders a Base UI Tooltip, so wrap renders the same way IssueDetailContent.test.tsx does: reuse its providers/wrapper or TooltipProvider if it uses one; check that file's render setup before writing. Then implement until GREEN. Commit test + implementation together, because the pre-commit hook blocks a red suite.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/RelatedIssueRow.test.tsx && npx biome check src/routes/dashboard/issue-detail/RelatedIssueRow.tsx src/routes/dashboard/issue-detail/RelatedIssueRow.test.tsx</automated>
  </verify>
  <done>RelatedIssueRow exported. The test file passes and asserts: time-bar wrapper `hidden @[42rem]:flex`, name `hidden @[36rem]:block`, avatar always present with accessible name, `@container` on the wrapper (not the button), conditional time bar, pill and assignee, onClick and aria-label forwarding. Biome is clean on both files.</done>
</task>

<task type="auto">
  <name>Task 2: Use RelatedIssueRow at all three IssueDetailContent row sites</name>
  <files>taskflow/src/routes/dashboard/IssueDetailContent.tsx</files>
  <action>
In IssueDetailContent.tsx, replace the three inline row buttons with `RelatedIssueRow` (import from `./issue-detail/RelatedIssueRow`):
- Story→Subtasks (`subtaskListContent`): inside each `<li key={sub.id}>`, render RelatedIssueRow with issueKey=sub.key, summary=sub.fields.summary, assignee=sub.fields.assignee, statusName=sub.fields.status.name, statusCategoryKey=statusCat?.key, timeBarIssues=`timeBarIssues(sub, null, { isSubtask: true })`, onClick=`() => onOpenIssue?.(sub.key)`.
- Epic→Stories: inside each `<li key={story.key}>`, render RelatedIssueRow with issueKey=story.key, summary=story.fields.summary, assignee=story.fields.assignee, statusName=story.fields.status.name, statusCategoryKey=story.fields.status.statusCategory?.key, timeBarIssues=`timeBarIssues(story)`, onClick=`() => onOpenIssue?.(story.key)`.
- Subtask→Parent: render RelatedIssueRow with issueKey=parent.key, summary=parent.fields.summary, assignee=parentAssignee, statusName=parentStatus?.name, statusCategoryKey=parentStatus?.statusCategory?.key, ariaLabel=`Open parent issue ${parent.key}`, buttonClassName `py-2 density-compact:py-1 density-comfortable:py-3` (keeps its current taller padding), and no timeBarIssues (the Parent row had no bar).

Keep the `<ul>` spacing classes, the section headings, and the "No subtasks." / loading / empty states unchanged. Delete the now-unused local `RowTimeBar` function. Remove imports that become unused (`StackedTimeBar`, `CachedAvatar`, `statusPillClass` if no other use remains in the file; grep before removing). Keep `timeBarIssues` and `cn`. Change only these regions; no other refactors in the file. Format only this file with biome.

If an existing test fails on a type mismatch (e.g. an assignee shape lacking `name`), widen the RelatedIssueRow prop type. Do not change production data shapes or test fixtures to fit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailSheet.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/routes/dashboard/issue-detail/RelatedIssueRow.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/IssueDetailContent.tsx && test "$(grep -c '<RelatedIssueRow' src/routes/dashboard/IssueDetailContent.tsx)" -eq 3 && test "$(grep -c 'function RowTimeBar' src/routes/dashboard/IssueDetailContent.tsx)" -eq 0</automated>
    <human-check>In the app, open a story with subtasks in the peek panel, then drag the panel narrow and wide. The summary stays readable. The time bar disappears below roughly 42rem row width, then the assignee name below roughly 36rem. The avatar, key and status pill stay, and the row never wraps to a second line. Repeat on an epic's Stories list and a subtask's Parent row.</human-check>
  </verify>
  <done>All three sites render through RelatedIssueRow (3 occurrences), RowTimeBar is gone, and no unused imports remain. The related test files, tsc and biome on the touched file pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → UI | Issue summary and assignee names are rendered as React text nodes (escaped) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nly-01 | Tampering | RelatedIssueRow text rendering | accept | Only React text children, no dangerouslySetInnerHTML. Same rendering as today, no new data flow |
| T-nly-02 | Information disclosure | Hidden assignee name | accept | Only CSS presentation changes. The data is already visible via the avatar tooltip/aria-label. No new exposure |
</threat_model>

<verification>
- `cd taskflow && npx vitest run src/routes/dashboard` passes.
- `npx tsc --noEmit` passes. Biome is clean on the 3 touched files (don't gate on the global biome count, which drifts).
- `grep -n "@container" src/routes/dashboard/issue-detail/RelatedIssueRow.tsx` shows it on the wrapper div, not the button.
</verification>

<success_criteria>
- The summary keeps about 12rem or more at every container stage; time bar hidden below 42rem, assignee name hidden below 36rem, avatar/key/pill always visible, one line per row.
- One shared component drives Epic Stories, Subtasks and Parent rows.
- Existing `story-time-bar` tests are unchanged and pass. The new RelatedIssueRow test asserts the responsive classes.
</success_criteria>

<output>
Create `.planning/quick/261105-nly-optimize-issue-detail-subtasks-rows-for-/261105-nly-SUMMARY.md` when done
</output>
