---
phase: quick-260519-fgq
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: true
requirements: [FLAG-FIX-01, FLAG-FIX-02, FLAG-FIX-03]
tags: [flagged, sprint-board, backlog, issue-detail, context-menu, polish]

must_haves:
  truths:
    - "In the issue detail sidebar, the Flagged row appears between Fix Versions and Created (not after Priority)"
    - "Right-clicking a story (swimlane header) on the sprint board exposes a Flag/Unflag action and toggles the flag exactly like right-clicking a subtask card"
    - "In the right-click context menu on sprint board cards, on swimlane story headers, and on backlog rows, the Flag/Unflag action sits in a visually separate section under its own 'Flag' header — not blended into the Move-to list"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Flagged MetaRow rendered between Fix Versions and Created"
    - path: "taskflow/src/routes/dashboard/StoryHeaderRow.tsx"
      provides: "isFlagged + onToggleFlag props with a Flag context-menu section"
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "isFlagged + onToggleFlag wired through swimlane StoryHeaderRow (virtual, fallback, sticky overlay)"
    - path: "taskflow/src/routes/dashboard/TaskCard.tsx"
      provides: "Flag/Unflag inside its own labeled ContextMenuGroup with 'Flag' label"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Flag/Unflag inside its own labeled ContextMenuGroup with 'Flag' label"
  key_links:
    - from: "SprintBoardTab.tsx"
      to: "StoryHeaderRow.tsx"
      via: "isFlagged + onToggleFlag props passed at all three call sites"
      pattern: "isFlagged=\\{isIssueFlagged\\(.*flaggedFieldKey\\)\\}"
    - from: "StoryHeaderRow.tsx"
      to: "handleToggleFlag (SprintBoardTab)"
      via: "ContextMenu 'Flag' section onClick"
      pattern: "onToggleFlag"
---

<objective>
Polish the Jira "Flagged (Impediment)" feature shipped in quick task 260519-eol. Three small UX fixes:

1. Reorder the Flagged row in the issue detail sidebar so it sits between Fix Versions and Created (not directly after Priority).
2. Make right-click flag toggle work for stories on the sprint board, not only subtasks. Currently `StoryHeaderRow` has no flag wiring, so the flag action is invisible on swimlane headers.
3. Reorganize the context menus on TaskCard, StoryHeaderRow, and BacklogRow so Flag/Unflag lives in its own visually separated section with a "Flag" label, instead of being a bare item appended after the "Move to..." list.

Purpose: Improve discoverability and visual hierarchy of the flag affordance, and fix a regression where stories can't be flagged from the sprint board.
Output: Updated FieldsSection.tsx, StoryHeaderRow.tsx, SprintBoardTab.tsx, TaskCard.tsx, BacklogRow.tsx.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260519-eol-in-sprint-view-and-backlog-view-i-want-t/260519-eol-SUMMARY.md
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/StoryHeaderRow.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
@taskflow/src/routes/dashboard/TaskCard.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx

<interfaces>
Key existing exports the executor needs (already in the codebase from quick 260519-eol):

From taskflow/src/services/jira.ts:
- export function isIssueFlagged(issue: JiraIssue, flaggedFieldKey: string): boolean
- export function setIssueFlagged(baseUrl, token, issueKey, flagged: boolean, flaggedFieldKey): Promise<void>

From settings store (useSettingsStore): flaggedFieldKey: string (default 'customfield_10021')

ContextMenu primitives used everywhere (from '@/components/ui/context-menu'):
- ContextMenu, ContextMenuContent, ContextMenuTrigger
- ContextMenuGroup, ContextMenuLabel, ContextMenuSeparator, ContextMenuItem

Existing "Move to..." section pattern (TaskCard.tsx lines 196-226) shows the labeled-section style we want to mirror for Flag:
- A ContextMenuGroup wrapping ContextMenuLabel('Move to...')
- ContextMenuSeparator
- The list of items

TaskCard.tsx already accepts: isFlagged?: boolean, onToggleFlag?: () => void.
BacklogRow.tsx already accepts: isFlagged?: boolean, onToggleFlag?: (issueKey: string) => void.
StoryHeaderRow.tsx does NOT currently accept any flag props — must be added.

SprintBoardTab.tsx already has handleToggleFlag(issueKey: string) and flaggedFieldKey from useSettingsStore; it's passed to TaskCard already but NOT to StoryHeaderRow. There are THREE StoryHeaderRow call sites:
- Inside VirtualizedSwimlanes virtual path (around line 330)
- Inside VirtualizedSwimlanes fallback path (around line 437)
- Inside the sticky overlay in SprintBoardTab body (around line 1117)
All three must receive isFlagged + onToggleFlag.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move Flagged MetaRow in FieldsSection and add Flag section to TaskCard + BacklogRow context menus</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/TaskCard.tsx, taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
Three independent UI edits in a single task — all small, all local:

(a) FieldsSection.tsx — relocate the Flagged MetaRow.
- Cut the entire IIFE block that renders the Flagged MetaRow (the `{(() => { const isFlagged = isIssueFlagged(...); return (<MetaRow label="Flagged">...</MetaRow>); })()}` block currently positioned immediately after the Priority MetaRow and its comment `{/* Flagged -- toggle impediment flag */}`).
- Paste it immediately AFTER the Fix Versions MetaRow closing `</MetaRow>` and BEFORE the `<MetaRow label="Created">` line. Keep the existing leading comment `{/* Flagged -- toggle impediment flag */}` with the moved block.
- Do not change the contents of the Flagged block — only its position. Preserve the existing button label, classes, mutation call, error rendering, and the `isIssueFlagged` call.

(b) TaskCard.tsx — wrap Flag/Unflag in its own labeled section.
- In the ContextMenuContent block, replace the existing `{onToggleFlag && ( <> {onTransition && <ContextMenuSeparator />} <ContextMenuItem onClick={onToggleFlag}> ... </ContextMenuItem> </> )}` fragment with a labeled-section structure that mirrors the existing "Move to..." block: when `onTransition` is also present render a `<ContextMenuSeparator />` first, then a `<ContextMenuGroup>` containing a `<ContextMenuLabel>Flag</ContextMenuLabel>` followed by a `<ContextMenuSeparator />`, then the existing `<ContextMenuItem onClick={onToggleFlag}>` with the Flag icon + `{isFlagged ? 'Unflag' : 'Flag'}` text.
- Keep the existing guard so that when neither `onTransition` nor `onToggleFlag` is provided, the bare card content is returned without a ContextMenu wrapper.

(c) BacklogRow.tsx — wrap Flag/Unflag in its own labeled section.
- In the ContextMenuContent block, replace the existing `{onToggleFlag && ( <> {(onMoveToSprint || onMoveToBacklog) && <ContextMenuSeparator />} <ContextMenuItem onClick={() => onToggleFlag(issue.key)}> ... </ContextMenuItem> </> )}` fragment with a labeled-section structure mirroring the existing "Move to..." group: when `onMoveToSprint || onMoveToBacklog` is present render a `<ContextMenuSeparator />` first, then a `<ContextMenuGroup>` containing a `<ContextMenuLabel>Flag</ContextMenuLabel>` followed by a `<ContextMenuSeparator />`, then the existing `<ContextMenuItem onClick={() => onToggleFlag(issue.key)}>` with Flag icon + `{isFlagged ? 'Unflag' : 'Flag'}` text.
- Keep the existing fast-path return that bypasses the ContextMenu wrapper when no `onMoveToSprint`, `onMoveToBacklog`, or `onToggleFlag` is provided.

No imports need to be added — `ContextMenuGroup`, `ContextMenuLabel`, and `ContextMenuSeparator` are already imported in both TaskCard.tsx and BacklogRow.tsx.
  </action>
  <verify>
    <automated>cd taskflow && pnpm exec tsc --noEmit 2>&1 | tail -20 && pnpm test -- --run src/routes/dashboard/issue-detail/FieldsSection.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>
- tsc --noEmit exits 0.
- All FieldsSection.test.tsx tests pass (the Flagged tests pass regardless of row position).
- In FieldsSection.tsx the Flagged MetaRow appears between the Fix Versions MetaRow and the Created MetaRow (verified by grep: the Flagged block is now after the closing `</MetaRow>` that follows `fix-version-edit` PopoverTrigger and before `<MetaRow label="Created">`).
- In TaskCard.tsx the Flag/Unflag item is wrapped by a ContextMenuGroup containing a ContextMenuLabel with the text "Flag".
- In BacklogRow.tsx the Flag/Unflag item is wrapped by a ContextMenuGroup containing a ContextMenuLabel with the text "Flag".
  </done>
</task>

<task type="auto">
  <name>Task 2: Add flag wiring to StoryHeaderRow and pass it from SprintBoardTab at all three call sites</name>
  <files>taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
Goal: stories rendered as swimlane headers must support right-click flag toggle, with the same labeled "Flag" section pattern used in TaskCard / BacklogRow (Task 1).

(a) StoryHeaderRow.tsx — extend props + context menu.
- Add two optional props to `StoryHeaderRowProps`: `isFlagged?: boolean` and `onToggleFlag?: () => void`.
- Destructure both in the function signature alongside the existing props.
- Import `Flag` from `lucide-react` (currently only `ChevronRight` is imported from it).
- In the `rowContent` JSX, prepend a `Flag` icon inside the existing key-and-summary button group when `isFlagged` is true. Place it BEFORE the storyKey `<span>`. Use the same classes used in TaskCard/BacklogRow: `className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0"`. This gives stories the same visual flag indicator as cards.
- Apply a yellow row-background tint when `isFlagged` is true. Adjust the outer wrapper `className` (the `cn(...)` call): when `isFlagged`, replace the muted background classes (`bg-muted/40 hover:bg-muted/60`) with `bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40`. Keep border, padding, and gap classes unchanged. The mb-px branch (collapsed state) should likewise switch to the yellow tint when flagged.
- Update the ContextMenu return: the current early-return `if (!onTransition) return rowContent;` skips the menu when there are no transitions, which would prevent the flag toggle from appearing on flag-only contexts. Change the guard to `if (!onTransition && !onToggleFlag) return rowContent;`.
- Inside `<ContextMenuContent>` keep the existing "Move to..." block but gate it behind `onTransition && (...)`. After it, when `onToggleFlag` is provided, render the same labeled-section pattern from Task 1: a `<ContextMenuSeparator />` (only if `onTransition` was also rendered), then a `<ContextMenuGroup>` containing `<ContextMenuLabel>Flag</ContextMenuLabel>`, then a `<ContextMenuSeparator />`, then a `<ContextMenuItem onClick={onToggleFlag}>` with `<Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />` and `{isFlagged ? 'Unflag' : 'Flag'}` text.

(b) SprintBoardTab.tsx — pass isFlagged + onToggleFlag to all StoryHeaderRow call sites.
- The file imports `isIssueFlagged` from `@/services/jira` already. The existing `handleToggleFlag(issueKey: string)` function and `flaggedFieldKey` from `useSettingsStore` are also already present.
- Extend the `VirtualizedSwimlanes` component's prop interface so flag info is available inside `renderSwimlane` and the fallback path. (`flaggedFieldKey` and `onToggleFlag` are already in scope as props.) For each `<StoryHeaderRow ... />` call site (there are TWO inside VirtualizedSwimlanes — the virtualized `renderSwimlane` branch and the non-virtualized fallback branch), add `isFlagged={isIssueFlagged(story, flaggedFieldKey)}` and `onToggleFlag={() => onToggleFlag(story.key)}`. Use the appropriate local variable (`story` in both branches).
- For the THIRD call site in `SprintBoardTab` body (the sticky overlay `StoryHeaderRow` around the `stickyHeader.story` block), pass `isFlagged={isIssueFlagged(stickyHeader.story, flaggedFieldKey)}` and `onToggleFlag={() => handleToggleFlag(stickyHeader.story.key)}`. Use `handleToggleFlag` directly there (it's the local function in SprintBoardTab; the virtualizer was given `onToggleFlag={handleToggleFlag}` already).

No new state, queries, or mutations are required — `handleToggleFlag` already exists and already invalidates the right query keys; it already works for any issue in `localIssues`, including stories.
  </action>
  <verify>
    <automated>cd taskflow && pnpm exec tsc --noEmit 2>&1 | tail -20 && pnpm test -- --run src/routes/dashboard 2>&1 | tail -30</automated>
  </verify>
  <done>
- tsc --noEmit exits 0.
- All existing dashboard tests pass (no regressions in TaskCard.test, BacklogRow.test, BacklogPage.test, SprintBoardTab.test, FieldsSection.test).
- StoryHeaderRow accepts isFlagged + onToggleFlag and renders a Flag icon + yellow tint when isFlagged is true.
- StoryHeaderRow's context menu shows a "Flag" labeled section with the Flag/Unflag item whenever onToggleFlag is provided.
- All three StoryHeaderRow usages in SprintBoardTab pass isFlagged + onToggleFlag (verified by grep: `grep -c "onToggleFlag" taskflow/src/routes/dashboard/SprintBoardTab.tsx` returns at least 4 — the existing TaskCard wires plus three StoryHeaderRow wires).
- Right-clicking a story (visually unverified in this autonomous plan, but the wiring is identical to subtasks which already work) will trigger handleToggleFlag(storyKey) which optimistically updates localIssues and calls setIssueFlagged on the Jira REST API.
  </done>
</task>

</tasks>

<verification>
After both tasks:
- `cd taskflow && pnpm exec tsc --noEmit` exits 0
- `cd taskflow && pnpm test -- --run` passes the whole suite (no new tests required for this polish task — existing 48 flag-related tests in FieldsSection.test.tsx must still pass; SprintBoardTab.test.tsx must still pass)
- `cd taskflow && pnpm exec eslint src/routes/dashboard/issue-detail/FieldsSection.tsx src/routes/dashboard/StoryHeaderRow.tsx src/routes/dashboard/SprintBoardTab.tsx src/routes/dashboard/TaskCard.tsx src/routes/dashboard/BacklogRow.tsx` reports no new errors

Manual smoke (recorded as expectation for the user, NOT a checkpoint per workflow.human_verify_mode=end-of-phase):
- Open an issue in the sidebar → Flagged row appears between Fix Versions and Created.
- Right-click a story on the sprint board → context menu shows "Move to..." section and a separate "Flag" section.
- Click Flag on a story → row gets yellow tint and Flag icon, persists across refresh.
- Right-click a backlog row → context menu shows "Move to..." section then a separate "Flag" section.
</verification>

<success_criteria>
1. FieldsSection.tsx renders the Flagged MetaRow strictly between Fix Versions and Created.
2. StoryHeaderRow.tsx supports `isFlagged` + `onToggleFlag` props; renders yellow tint + Flag icon when flagged; right-click menu exposes Flag/Unflag.
3. SprintBoardTab.tsx passes flag props to StoryHeaderRow at all three call sites (virtual, fallback, sticky overlay).
4. TaskCard.tsx, BacklogRow.tsx, and StoryHeaderRow.tsx each render the Flag/Unflag context menu item inside its own `<ContextMenuGroup>` with a `<ContextMenuLabel>Flag</ContextMenuLabel>` header, visually separated from the "Move to..." section by a separator.
5. `pnpm exec tsc --noEmit` is clean.
6. Existing test suite passes.
</success_criteria>

<output>
Create `.planning/quick/260519-fgq-fix-flag-feature-move-flag-row-in-issue-/260519-fgq-SUMMARY.md` when done, following the standard quick-task summary template.
</output>
