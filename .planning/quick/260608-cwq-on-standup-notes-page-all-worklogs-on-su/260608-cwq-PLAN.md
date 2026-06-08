---
phase: quick-260608-cwq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Each individual Tempo worklog appears as its own row under the issue — no aggregation into a single summed row"
    - "Each worklog row shows its duration on the first line"
    - "Each worklog row shows its description text below the duration; worklog with no description shows '(no description)'"
    - "The header stat line (total hours logged) is unchanged"
    - "Worklog rows for subtasks remain clickable to the subtask (issueKey click-through preserved)"
  artifacts:
    - path: "taskflow/src/routes/standup-notes/IssueActivityGroup.tsx"
      provides: "SubItem.description optional field + two-line worklog render in SubItemList"
    - path: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      provides: "Flat per-worklog push in buildGroups() replacing the worklogByGroup accumulation map"
  key_links:
    - from: "buildGroups() in YesterdayColumn.tsx"
      to: "SubItem.description in IssueActivityGroup.tsx"
      via: "worklog.comment ?? undefined passed as description field"
      pattern: "description.*worklog\\.comment"
---

<objective>
Display each Tempo worklog as its own row under the issue on the standup notes page, with a description line showing the worklog comment.

Purpose: Users want to see individual log entries (with their descriptions) rather than a single aggregated duration.
Output: Modified YesterdayColumn.tsx (flat push per worklog) and IssueActivityGroup.tsx (description field + two-line render).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/standup-notes/YesterdayColumn.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add description field to SubItem and update SubItemList render</name>
  <files>taskflow/src/routes/standup-notes/IssueActivityGroup.tsx</files>
  <action>
    Add an optional `description` field to the `SubItem` interface (after the existing `transition?` field):

      /** Worklog description text; present on 'worklog' sub-items only. */
      description?: string;

    In `SubItemList`, update all three render branches (isClickableMr button, isClickableIssue button, plain div) to use a two-column layout for worklog items. The icon column stays as-is. The text column becomes a flex-col div when `item.kind === 'worklog'`:

    For the plain div branch: change the icon alignment from `items-center` to `items-start` and wrap the text in a `div className="flex-1 min-w-0 flex flex-col"`. Inside: a `span className="text-sm text-foreground"` for `item.label`, and conditionally when `item.kind === 'worklog'` a `p className="text-xs text-muted-foreground truncate"` containing `item.description ?? '(no description)'`.

    Apply the same two-line pattern to the isClickableIssue button branch (the branch where `issueKey` is set — this is used for subtask worklog rows that are click-through to the subtask). Change its `items-center` to `items-start`, replace the single `span` with the same two-line `div`.

    The isClickableMr button branch is NOT used for worklogs (worklogs never have mrProjectId) — no change needed there.

    The transition branch inside the plain div path is also unchanged — it uses its own `item.kind === 'transition'` guard, so the worklog guard is complementary.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TypeScript compiles clean; SubItem interface has description field; SubItemList renders a second line for worklog items in both plain and clickable-issue branches.</done>
</task>

<task type="auto">
  <name>Task 2: Replace worklog accumulation map with flat per-worklog push in buildGroups</name>
  <files>taskflow/src/routes/standup-notes/YesterdayColumn.tsx</files>
  <action>
    In `buildGroups()` (currently lines ~307–340 in YesterdayColumn.tsx), replace the entire `worklogByGroup` map section — from the `const worklogByGroup = new Map(...)` declaration through the closing brace of the second `for...of` loop — with a single flat loop:

      // One sub-item per raw worklog entry — duration + description, no aggregation.
      for (const worklog of tempoData ?? []) {
        const group = ensureGroup(
          worklog.issue.key,
          worklog.issue.summary,
          worklog.issue.issueType?.name,
        );
        group.totalSeconds += worklog.timeSpentSeconds;  // stat line unchanged

        const rollupKey = group.issueKey;
        const originKey = worklog.issue.key;
        group.subItems.push({
          kind: 'worklog',
          label: formatDuration(worklog.timeSpentSeconds),
          description: worklog.comment || undefined,
          issueKey: originKey !== rollupKey ? originKey : undefined,
          originKey,
        });
      }

    Also update `generateMarkdown()` (the function that builds the markdown export string): wherever a worklog sub-item's label is rendered into the markdown output, append the description so the exported text is human-readable. Find the markdown line that emits `item.label` for sub-items and change it to:
      item.description ? `${item.label} · ${item.description}` : item.label
    (only for kind === 'worklog' items; other kinds remain label-only).

    The sub-task partition pass (lines ~494–519) reads `item.originKey` — unchanged, this continues to work correctly since `originKey` is still set per worklog.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TypeScript compiles clean; worklogByGroup map is gone; each TempoWorklog becomes its own SubItem with description field populated from worklog.comment.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Each Tempo worklog now appears as its own row under the issue on the standup notes page. Each row shows the duration on the first line and the worklog comment on a second muted line. Worklogs with no comment show "(no description)".
  </what-built>
  <how-to-verify>
    1. Open the app and navigate to the standup notes page for a day where you logged multiple worklogs on the same issue or subtask.
    2. Verify each worklog appears as a separate row (not aggregated into one summed entry).
    3. Verify each row shows: Clock icon | duration | description text below.
    4. Find a worklog with no description — confirm it shows "(no description)" in muted text.
    5. If a worklog is on a subtask, confirm clicking the row still navigates to the subtask.
    6. Confirm the total-hours stat line in the group header is unchanged (still shows the sum).
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues found.</resume-signal>
</task>

</tasks>

<verification>
npm run check passes (biome + tsc clean). Each Tempo worklog renders as its own SubItem row. Description field flows from TempoWorklog.comment through SubItem.description to the rendered second line.
</verification>

<success_criteria>
- Multiple worklogs on the same issue are no longer merged into one aggregated row
- Each row: Clock icon, duration (first line), description or "(no description)" (second line, muted, text-xs)
- Subtask click-through preserved for worklogs where issue key != group rollup key
- Group header total-seconds stat unchanged
- TypeScript and biome both clean
</success_criteria>

<output>
Create `/Users/mimo/Documents/Projects/taskflow/.planning/quick/260608-cwq-on-standup-notes-page-all-worklogs-on-su/260608-cwq-SUMMARY.md` when done.
</output>
