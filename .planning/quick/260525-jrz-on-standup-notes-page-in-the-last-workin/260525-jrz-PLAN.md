---
phase: quick-260525-jrz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
autonomous: true
requirements: [QUICK-260525-jrz]

must_haves:
  truths:
    - "Per-source empty notices in YesterdayColumn are visually compact (not full-height cards)"
    - "Multiple empty notices flow side-by-side on wide columns and wrap gracefully at narrow widths"
    - "The full-column 'Nothing to recap' EmptyState (when all sources empty) is unchanged"
    - "Error states and loading skeletons are unchanged"
    - "Tempo-disabled inline text is unchanged"
  artifacts:
    - path: taskflow/src/routes/standup-notes/YesterdayColumn.tsx
      provides: "CompactEmptyNotice local component + flex-wrap notice container replacing per-source EmptyState blocks"
      contains: "CompactEmptyNotice"
  key_links:
    - from: "YesterdayColumn.tsx per-source empty sections (lines 503–574)"
      to: "CompactEmptyNotice component"
      via: "inline local function component"
      pattern: "CompactEmptyNotice"
---

<objective>
Replace the four tall per-source `EmptyState` blocks in `YesterdayColumn` with compact inline notices that flow side-by-side, dramatically reducing vertical footprint when one or more sources return no data for the last working day.

Purpose: Four stacked `EmptyState` cards (~160px each) dominate the column when there is little data, making the page feel broken. Compact inline pills reduce all four notices to ~24px total.
Output: `YesterdayColumn.tsx` with a `CompactEmptyNotice` local component and a `flex-wrap` container grouping the per-source empty notices.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/260525-jrz-on-standup-notes-page-in-the-last-workin/260525-jrz-RESEARCH.md

<interfaces>
<!-- From taskflow/src/routes/standup-notes/YesterdayColumn.tsx -->

Imports already available (no new imports needed):
  Clock, GitBranch, MessageSquare  — from 'lucide-react'
  EmptyState                        — kept for full-column case
  type LucideIcon                   — available via lucide-react (import as needed)

Per-source empty state blocks to replace (lines 503–574):
  - Tempo empty:     EmptyState icon=Clock,         title="No worklogs on {day}"
  - Jira empty:      EmptyState icon=MessageSquare,  title="No Jira activity on {day}"
  - Commits empty:   EmptyState icon=GitBranch,      title="No commits on {day}"
  - MR empty:        EmptyState icon=MessageSquare,  title="No MR activity on {day}"

Full-column empty state (keep unchanged — already guarded by !hasAnyData):
  EmptyState icon=Clock title="Nothing to recap" — NOT touched
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace per-source EmptyState blocks with CompactEmptyNotice</name>
  <files>taskflow/src/routes/standup-notes/YesterdayColumn.tsx</files>
  <action>
Add a private `CompactEmptyNotice` component at the top of the file (before the main export, after the imports). Import `type { LucideIcon }` from `lucide-react` to type the `icon` prop:

```
function CompactEmptyNotice({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
```

Replace the four individual `<div className="mb-3"><EmptyState .../></div>` blocks (lines 503–574 for Tempo/Jira/Commits/MR empty cases) with a single collected container. The container must:
- Only render when at least one per-source notice is active (i.e., at least one of the four empty conditions is true)
- Use `flex flex-wrap gap-x-5 gap-y-1.5 mt-2 mb-3` as its className
- Contain one `<CompactEmptyNotice>` per empty source, conditionally rendered

Keep the logic guard for each source exactly as-is (same conditions: `tempoQuery.data?.length === 0`, `jiraActivityQuery.data?.length === 0`, `commitsQuery.data?.length === 0`, `mrEventsQuery.data?.length === 0`). Do NOT change error state (`isError`) blocks, loading blocks, Tempo-disabled text, or the full-column EmptyState (`!hasAnyData`).

Use short labels matching the existing title text but without the subtitle: "No worklogs on {day}", "No Jira activity on {day}", "No commits on {day}", "No MR activity on {day}" — where `{day}` is `getColumnHeading(yesterdayDate)` (already in scope).

The `LucideIcon` import: lucide-react exports this type — add `type { LucideIcon }` to the existing lucide-react import line.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | grep -i "YesterdayColumn" || echo "No TS errors in YesterdayColumn"</automated>
  </verify>
  <done>
    YesterdayColumn.tsx has a CompactEmptyNotice component; per-source empty blocks use it inside a flex-wrap container; tsc reports no type errors on the file; EmptyState is still used for the full-column empty state.
  </done>
</task>

</tasks>

<verification>
1. Open Standup Notes page and navigate to Yesterday column
2. With one or more data sources returning no data: notices appear as compact single-line pills (icon + label), not tall centered cards
3. With all data sources empty AND all resolved: the full-column "Nothing to recap" EmptyState is still shown (not replaced by pills)
4. Resize the window narrow: notices wrap to multiple lines without overflow or breakage
5. TypeScript: `npx tsc --noEmit` passes with no new errors
</verification>

<success_criteria>
- All four per-source empty conditions render as `CompactEmptyNotice` pills inside a `flex-wrap` container
- Multiple active notices appear side-by-side at normal column widths
- Total vertical footprint of all four notices combined is under ~40px (vs ~640px previously)
- Full-column "Nothing to recap" EmptyState untouched
- No TypeScript errors introduced
</success_criteria>

<output>
Create `.planning/quick/260525-jrz-on-standup-notes-page-in-the-last-workin/260525-jrz-SUMMARY.md` when done
</output>
