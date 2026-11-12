---
phase: quick-261112-eep
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx
  - taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx
autonomous: true
requirements: [QUICK-261112-eep]

must_haves:
  truths:
    - "A story/task detail always shows a 'Subtasks' heading, with '(N)' only when it has N > 0 subtasks"
    - "A story with no subtasks shows a muted italic 'No subtasks' line under the heading"
    - "'No subtasks' never shows while subtasks exist (including while enrichment is loading and the skeleton is shown)"
    - "The heading line has a right-aligned split control: 'Add subtask' primary button + chevron opening a menu with 'Bulk create subtasks…'"
    - "Clicking 'Add subtask' calls onAddSubtask(issueKey); choosing 'Bulk create subtasks…' opens BulkCreateSubtasksModal"
    - "The header row is the same height with or without subtasks; the old button row below the list is gone"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx"
      provides: "Isolated split control (Add subtask + chevron menu)"
      exports: ["SubtaskCreateControl"]
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Always-rendered Subtasks header row + empty state"
      contains: "SubtaskCreateControl"
    - path: "taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx"
      provides: "Skeleton without the heading placeholder bar"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "SubtaskCreateControl"
      via: "onAdd -> onAddSubtask?.(issueKey); onBulk -> setBulkCreateOpen(true)"
      pattern: "<SubtaskCreateControl"
    - from: "taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx"
      to: "components/ui/dropdown-menu"
      via: "DropdownMenuTrigger render={<Button variant=\"outline\" size=\"icon-sm\" />} + DropdownMenuContent align=\"end\""
      pattern: "DropdownMenuTrigger"
---

<objective>
In story/task issue detail, make the Subtasks section always present: a heading row ("Subtasks" / "Subtasks (N)")
with a right-aligned split create control on the same line, a muted "No subtasks" line when empty, and the old
full-width button row below the list removed.

Purpose: subtask creation is discoverable and visually consistent with the other detail-page sections
(Activity / Progress heading-with-controls precedent) and the local outline button row.
Output: new `SubtaskCreateControl` component + reworked Subtasks section + trimmed skeleton, with tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261112-eep-subtask-create-buttons-in-story-detail-s/261112-eep-CONTEXT.md
@.planning/quick/261112-eep-subtask-create-buttons-in-story-detail-s/261112-eep-RESEARCH.md

Repo layout: git + .planning at /Users/mimo/Documents/Projects/taskflow; npm/vitest/biome run in
/Users/mimo/Documents/Projects/taskflow/taskflow (inner dir). Paths below are relative to the outer repo.

Read first (source of truth for patterns):
- taskflow/src/routes/dashboard/IssueDetailContent.tsx — `subtaskListContent` (~L108-150), Subtasks section (~L332-379), "Open in Jira | Copy link" split precedent (~L494-520), `space-y-6` container (~L265)
- taskflow/src/components/ui/button.tsx (sizes `sm`=h-7, `icon-sm`=size-7; outline `aria-expanded:` styling)
- taskflow/src/components/ui/dropdown-menu.tsx (Base UI `render` prop, no `asChild`; `align` prop)
- taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx:457-483 (outline Button as menu trigger) and DeploymentPackageSection.test.tsx:318-321 (opening the menu in tests)
- taskflow/src/routes/dashboard/IssueDetailContent.test.tsx (`makeStoryIssue` ~L96, `wrapper`, DETAIL-02 ~L237)
- taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx

Interface the executor creates (Task 1) and consumes (Task 2):
  export function SubtaskCreateControl(props: { onAdd: () => void; onBulk: () => void }): JSX.Element
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Isolated SubtaskCreateControl split button</name>
  <files>taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx, taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx</files>
  <behavior>
    - Renders a button named "Add subtask"; clicking it calls onAdd once and not onBulk
    - Renders a button with accessible name "More subtask actions"; clicking it opens a menu whose menuitem "Bulk create subtasks…" is found via findAllByRole('menuitem')
    - Clicking that menuitem calls onBulk once and not onAdd
  </behavior>
  <action>
    Create `SubtaskCreateControl({ onAdd, onBulk })` per CONTEXT "Create control" decision (split control, user-selected), kept in its own file so a UAT switch to two separate buttons is a one-file change.
    Structure copies the in-file "Open in Jira | Copy link" seam exactly (Claude's discretion: seam styling): wrapper `div` with `inline-flex items-stretch`; left half is the shared `Button` with `type="button" variant="outline" size="sm"`, className `gap-1.5 rounded-r-none border-r-0 text-xs`, contents lucide `Plus` (`size-3.5`) + text "Add subtask", onClick=onAdd. Right half is `DropdownMenu` > `DropdownMenuTrigger` using the Base UI `render` prop (no `asChild`) with a `Button type="button" variant="outline" size="icon-sm"` className `rounded-l-none`, `aria-label` and `title` both "More subtask actions"; trigger child is lucide `ChevronDown` with `size-3.5` and `aria-hidden="true"`. `DropdownMenuContent align="end"` holds one `DropdownMenuItem` with className `cursor-pointer text-xs`, onClick=onBulk, contents lucide `LayoutList` (`size-3.5`, explicit so the item's default size-4 rule does not apply) + text "Bulk create subtasks…" (real ellipsis character U+2026).
    Use size `sm`/`icon-sm` per research recommendation (matches the action row and the Jira split). No @container label collapse (control is ~130px). Do not use `-ml-px` or negative margins.
    Write the test file with @testing-library/react following DeploymentPackageSection.test.tsx menu-opening pattern (fireEvent.click trigger, await findAllByRole('menuitem')), vi.fn() for onAdd/onBulk. Tests and implementation go in ONE commit (pre-commit hook runs full vitest and blocks RED-only commits).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx && npx biome check src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx</automated>
  </verify>
  <done>Three behavior tests pass; biome clean on both files; component exported as `SubtaskCreateControl`; committed with `git commit -- <the two paths>` (check `git log -1 --stat` contains only these files).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Always-rendered Subtasks header row + empty state in IssueDetailContent</name>
  <files>taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx, taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx</files>
  <behavior>
    - makeStoryIssue([]) with no enrichedSubtasks: text "Subtasks" (exact) and "No subtasks" are visible; no "Subtasks (" text; "Add subtask" button present (fails on current code, which renders no heading)
    - Story with one subtask + enrichedSubtasks: heading "Subtasks (1)" visible; queryByText('No subtasks') is null
    - Story with one subtask, enrichedSubtasks undefined, showSubtasksSkeleton=true: getByTestId('subtasks-skeleton') present, "Subtasks (1)" heading present, no "No subtasks"
    - Clicking "Add subtask" calls onAddSubtask with 'PROJ-20'
    - Clicking "More subtask actions" then menuitem "Bulk create subtasks…" opens the bulk-create modal (mock './BulkCreateSubtasksModal' with vi.mock to a stub rendering e.g. data-testid="bulk-modal" when open is true, so its queries don't run; assert it appears)
    - Existing DETAIL-02 and IssueDetailPage.progressive.test.tsx 'subtasks-skeleton' test still pass
  </behavior>
  <action>
    In the `!isEpic && !isSubtask` section (per CONTEXT "Empty state" + "Create control" decisions):
    1. Add a header row as the first child of `<section>`: `div` with className `flex h-7 items-center justify-between mb-1` (fixed h-7 so height is identical empty vs non-empty; sized for size="sm" buttons per research §3). Inside: `h3` with className `text-sm font-medium text-muted-foreground` reading "Subtasks" plus ` (N)` only when `subtasks.length > 0` — compute N from the base `subtasks` field, NOT from enriched/display data, so the label does not shift when enrichment lands. Right side: `<SubtaskCreateControl onAdd={() => onAddSubtask?.(issueKey)} onBulk={() => setBulkCreateOpen(true)} />` imported from './issue-detail/SubtaskCreateControl'.
    2. Remove the `h3` from `subtaskListContent` (it now only renders the `ul`), and remove its "No subtasks." branch: when displaySubtasks is empty it returns null.
    3. Render `<p className="text-sm text-muted-foreground italic">No subtasks</p>` (no trailing period, matches epic's "No stories in this epic") iff `subtasks.length === 0` — independent of enrichment, because the enrichment query is disabled for subtask-less issues and `enrichedSubtasks` stays undefined forever.
    4. Delete the old bottom `div.mt-1 flex items-center gap-2` row with the two outline buttons. Keep `<BulkCreateSubtasksModal open={bulkCreateOpen} onClose=… parentKey={issueKey} parentIssue={issue} />` wiring unchanged. Remove the `Plus` / `LayoutList` lucide imports from IssueDetailContent.tsx only if no other usage remains (grep first).
    5. Keep the skeleton and subtask-error blocks and their guards unchanged, after the header row. Put no margin class on `<section>` itself (it's a direct child of `space-y-6`; Tailwind v4 space-y pitfall).
    6. In SubtasksSkeleton.tsx drop the first `Skeleton className="h-6 w-40"` heading-placeholder bar (the real heading now always renders above it); keep `data-testid="subtasks-skeleton"` and the two `h-8 w-full` rows.
    Add the behavior tests to IssueDetailContent.test.tsx in a `describe('Subtasks section header (261112-eep)')` block using `makeStoryIssue` and `wrapper`. Use exact-text queries so "Subtasks" doesn't collide with "Bulk create subtasks…" or the "More subtask actions" label. Tests + implementation in ONE commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx && npx biome check src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx && npx tsc --noEmit -p . && test "$(grep -c 'Bulk Create Subtasks' src/routes/dashboard/IssueDetailContent.tsx)" = "0"</automated>
  </verify>
  <done>All new and existing tests in the listed files pass; biome clean on touched files; tsc clean; old bottom button row and "Bulk Create Subtasks" label gone from IssueDetailContent.tsx; committed via `git commit -- <the three paths>` and `git log -1 --stat` shows only those files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Presentational re-layout; existing onAddSubtask / BulkCreateSubtasksModal paths unchanged |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-eep-01 | Tampering | SubtaskCreateControl / IssueDetailContent | accept | No new input, data path, or package; existing create flows reused unchanged |
</threat_model>

<verification>
- Full commands in each task's verify pass (vitest files, biome on touched files only, tsc).
- Pre-commit hook (full vitest + biome + tsc) passes on both commits.
- Manual UAT (after execution): open a story with 0 subtasks and one with N subtasks in the app — heading row height identical in both, split control right-aligned on the heading line, menu opens right-aligned under the chevron, "No subtasks" muted italic only on the empty story, skeleton shows no double heading.
</verification>

<success_criteria>
- Subtasks heading always renders on story/task detail; "(N)" only when N > 0
- "No subtasks" only when the base subtasks field is empty
- Split control (Add subtask + chevron menu → Bulk create subtasks…) right-aligned on heading line, outline sm style
- Old below-list button row removed; modal and onAddSubtask behaviour unchanged
- Control lives in its own component file
</success_criteria>

<output>
Create `.planning/quick/261112-eep-subtask-create-buttons-in-story-detail-s/261112-eep-SUMMARY.md` when done.

Notes for UAT (include in SUMMARY):
- Header uses `size="sm"` / `icon-sm` with a fixed `h-7` row (+4px vs other section headings). UAT-swappable alternative for exact parity: `size="xs"` / `icon-xs` (keep explicit `text-xs` + `size-3.5` icons) with the row at `h-6 mb-1`.
- Switching to two separate buttons is a change confined to `issue-detail/SubtaskCreateControl.tsx`.
</output>
