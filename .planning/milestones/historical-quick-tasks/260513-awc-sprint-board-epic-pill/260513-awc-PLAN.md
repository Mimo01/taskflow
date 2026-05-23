---
phase: quick
plan: 260513-awc
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Sprint board swimlane headers show an epic pill between the status badge and assignee"
    - "Epic pill displays the epic name in its Jira color (same style as BacklogRow)"
    - "Clicking the epic pill opens the epic's detail sheet (same as onEpicClick in BacklogRow)"
    - "Pill is not rendered when the story has no epic link"
    - "Sticky overlay header also shows the epic pill"
  artifacts:
    - path: "taskflow/src/routes/dashboard/StoryHeaderRow.tsx"
      provides: "StoryHeaderRow with epicKey, epicName, epicColorResult props and clickable pill"
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "Passes epic data into StoryHeaderRow and sticky overlay header"
  key_links:
    - from: "SprintBoardTab.tsx"
      to: "StoryHeaderRow.tsx"
      via: "epicKey, epicName, epicColorResult props"
      pattern: "epicKey.*epicName.*epicColorResult"
    - from: "StoryHeaderRow pill button"
      to: "onEpicClick handler in main.tsx"
      via: "onEpicClick prop -> handleIssueClick(epicKey)"
      pattern: "onEpicClick.*epicKey"
---

<objective>
Add an epic name pill to sprint board swimlane task headers. The pill appears between the status badge and the assignee, uses Jira epic coloring (same as BacklogRow), and navigates to the epic's detail sheet on click.

Purpose: Developers need to see which epic a story belongs to at a glance on the sprint board without opening the detail sheet.
Output: Updated StoryHeaderRow + SprintBoardTab. No new files.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md

<interfaces>
<!-- Existing types the executor needs. Extracted from codebase. -->

From taskflow/src/routes/dashboard/StoryHeaderRow.tsx — current props interface:
```typescript
interface StoryHeaderRowProps {
  storyKey: string;
  summary: string;
  statusName: string;
  statusCategoryKey: string;
  subtaskCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDetail: (key: string) => void;
  transitions?: JiraTransition[];
  onTransition?: (...) => void;
  transitionError?: string | null;
  assigneeAvatarUrl?: string | null;
  assigneeDisplayName?: string;
}
```

Current header row layout order (left to right):
  chevron | key+summary (flex-1) | assignee avatar+name | status badge | subtask count

Target layout order after this change:
  chevron | key+summary (flex-1) | EPIC PILL | status badge | assignee avatar+name | subtask count

From taskflow/src/lib/epicColors.ts:
```typescript
export function epicColorToTailwind(
  jiraColor: string | null | undefined,
  epicKey?: string,
): EpicColorResult;
// EpicColorResult = { className: string; style?: { backgroundColor, color, borderColor } }
```

From taskflow/src/routes/dashboard/BacklogRow.tsx — existing epic pill rendering pattern:
```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onIssueClick(epicKey); }}
  className={cn(
    'inline-flex items-center rounded-full border px-1.5 py-0 text-[11px] font-medium hover:opacity-80 transition-opacity',
    epicColorResult.className,
  )}
  style={epicColorResult.style}
  title={`${epicKey}: ${epicName}`}
>
  {epicName}
</button>
```

From taskflow/src/routes/dashboard/SprintBoardTab.tsx — existing epic data already available:
- `epicNameMap: Map<string, string>` — epicKey -> epicName (built from epicsBasic query)
- `epicLinkFieldKey` from useSettingsStore — field key to read epic link on issue.fields
- `epicColorFieldKey` from useSettingsStore — field key for epic color
- `epicsBasic` query result includes `{ key, epicName, color }` per epic
- Both StoryHeaderRow call sites: the `renderSwimlane` function and the sticky overlay
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add epic pill props to StoryHeaderRow and render between status and assignee</name>
  <files>taskflow/src/routes/dashboard/StoryHeaderRow.tsx</files>
  <action>
Add three optional props to StoryHeaderRowProps: `epicKey?: string | null`, `epicName?: string | null`, `epicColorResult?: ReturnType<typeof epicColorToTailwind> | null`, and `onEpicClick?: (key: string) => void`.

Import `epicColorToTailwind` from `@/lib/epicColors` (for the return type) and `cn` is already imported.

In the row layout, insert the epic pill between the status badge and the assignee block (i.e., after the status `<span>` and before the assignee `<div>`). Render the pill only when `epicKey && epicName && epicColorResult` are all truthy:

```
{epicKey && epicName && epicColorResult && (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onEpicClick?.(epicKey); }}
    className={cn(
      'shrink-0 inline-flex items-center rounded-full border px-1.5 py-0 text-[11px] font-medium hover:opacity-80 transition-opacity',
      epicColorResult.className,
    )}
    style={epicColorResult.style}
    title={`${epicKey}: ${epicName}`}
  >
    {epicName}
  </button>
)}
```

The `e.stopPropagation()` prevents the row's own click from firing. All new props are optional so existing callers that don't pass them render unchanged.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | grep StoryHeaderRow</automated>
  </verify>
  <done>StoryHeaderRow accepts epicKey, epicName, epicColorResult, onEpicClick props; renders a colored clickable pill between status and assignee when epic data is present; no TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Pass epic data from SprintBoardTab into StoryHeaderRow at both call sites</name>
  <files>taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
Two call sites need updating: `renderSwimlane` inside `VirtualizedSwimlanes` and the sticky overlay header in `SprintBoardTab`.

For the `renderSwimlane` call site, `epicNameMap` is defined in `SprintBoardTab` scope but `VirtualizedSwimlanes` does not receive it. Add it as a prop:
- Add `epicNameMap: Map<string, string>` and `epicColors: Map<string, string>` to the `VirtualizedSwimlanes` props interface
- Pass them from the `<VirtualizedSwimlanes .../>` JSX: `epicNameMap={epicNameMap}` and `epicColors={epicColorMap}` (build the color map alongside epicNameMap below)
- Build `epicColorMap` alongside `epicNameMap` where `epicNameMap` is currently constructed: `const epicColorMap = new Map<string, string>(); for (const e of epicsBasic ?? []) epicColorMap.set(e.key, e.color ?? '');`
- In `renderSwimlane`, derive epic data from the story: `const epicKey = story.fields[epicLinkFieldKey] as string | null;`, `const epicName = epicKey ? (epicNameMap.get(epicKey) ?? epicKey) : null;`, `const epicColorResult = epicKey ? epicColorToTailwind(epicColorMap.get(epicKey) ?? null, epicKey) : null;`
- Pass to StoryHeaderRow: `epicKey={epicKey}`, `epicName={epicName}`, `epicColorResult={epicColorResult}`, `onEpicClick={setSelectedIssueKey}` (opens the epic's detail sheet via the existing onIssueClick/onEpicClick = handleIssueClick wiring in main.tsx)

For the sticky overlay header call site (in `SprintBoardTab` JSX), derive the same values from `stickyHeader.story` using the same `epicLinkFieldKey`, `epicNameMap`, `epicColorMap` already in scope. Pass the four props to that `<StoryHeaderRow />`.

Import `epicColorToTailwind` at the top of SprintBoardTab.tsx from `@/lib/epicColors`.

The `epicLinkFieldKey` is already destructured from `useSettingsStore` in SprintBoardTab — use it directly.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Both StoryHeaderRow usages (renderSwimlane and sticky overlay) pass epicKey, epicName, epicColorResult, onEpicClick. TypeScript compiles clean. Running the app shows the epic pill in story headers on the sprint board.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API -> epicNameMap | Epic name/color data fetched externally and rendered in DOM |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-awc-01 | Information Disclosure | Epic name pill | accept | Epic name is already visible to the user on the epics page; no new data surface |
| T-awc-02 | Tampering | onClick stopPropagation | accept | Standard UI pattern; no security boundary crossed |
</threat_model>

<verification>
1. Sprint board story headers show an epic pill between the status badge and the assignee section
2. Pill uses Jira epic color (matching the color in EpicsPage and BacklogRow)
3. Clicking the pill opens the epic's detail sheet (same behavior as clicking an epic in BacklogRow)
4. Stories with no epic link show no pill (no layout shift)
5. Sticky swimlane overlay header also shows the pill
6. TypeScript compiles with no errors: `cd taskflow && npx tsc --noEmit`
</verification>

<success_criteria>
Epic pill is visible in sprint board story headers between the status badge and assignee. Pill renders epic name in Jira color. Click opens epic detail. No TypeScript errors. No regression in existing board behavior.
</success_criteria>

<output>
After completion, create `.planning/quick/260513-awc-sprint-board-epic-pill/260513-awc-SUMMARY.md` using the summary template.
</output>
