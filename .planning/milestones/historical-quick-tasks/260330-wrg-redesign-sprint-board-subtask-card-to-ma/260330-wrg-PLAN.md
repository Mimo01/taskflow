---
phase: quick
plan: 260330-wrg
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/TaskCard.tsx
autonomous: true
requirements: [QUICK-wrg]
must_haves:
  truths:
    - "The meaningless gray dot in the bottom-right corner of cards is removed"
    - "Subtask cards show issue type name (e.g. 'Sub-task') for context"
    - "Cards show story points when available (parent cards only, not subtasks)"
    - "Card layout matches Jira style: key + type on top row, summary in middle, avatar + metadata on bottom"
  artifacts:
    - path: "taskflow/src/routes/dashboard/TaskCard.tsx"
      provides: "Redesigned card component matching Jira card style"
  key_links:
    - from: "TaskCard.tsx"
      to: "JiraIssue type"
      via: "issue.fields.issuetype.name, issue.fields.customfield_10016"
      pattern: "issuetype\\.name|customfield_10016"
---

<objective>
Redesign the sprint board TaskCard to match Jira's card style and improve content clarity.

Purpose: The current card has a meaningless gray dot (health dot placeholder that is never populated) and doesn't show useful metadata like issue type or story points. Redesigning to match Jira's familiar card layout improves scannability and removes confusion.

Output: Updated TaskCard.tsx with Jira-style layout
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/TaskCard.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
@taskflow/src/services/jira/issues.ts (lines 25-55 for fetchSprintStories fields, lines 76-106 for fetchSprintSubtasks fields)

<interfaces>
From taskflow/src/services/jira.ts (JiraIssue):
```typescript
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { id: string; name: string; statusCategory?: { key: 'new' | 'indeterminate' | 'done' } };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    customfield_10016: number | null; // story points
    issuetype: { name: string; subtask: boolean };
    parent?: { id: string; key: string; fields: { summary: string } };
    [key: string]: unknown;
  };
}
```

From taskflow/src/routes/dashboard/TaskCard.tsx (current props):
```typescript
interface TaskCardProps {
  issue: JiraIssue;
  healthDot?: ReviewHealth;       // NEVER passed from sprint board -- remove
  subtaskCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  isSubtask?: boolean;
  showStatus?: boolean;
  onClick?: () => void;
  transitions?: JiraTransition[];
  onTransition?: (...) => void;
  transitionError?: string;
}
```
</interfaces>

## Investigation Result: The Mystery Dot

The gray dot in the bottom-right corner is a **health dot placeholder** (line 134 of TaskCard.tsx). It is designed to show MR review health (approved=green, changes_requested=red, waiting=amber), but `healthDot` is **never passed** from SprintBoardTab. The dot always renders with the fallback color `bg-muted-foreground/40` (gray), making it a meaningless visual element.

**Decision:** Remove the health dot entirely. If MR review health is implemented later, it can be re-added with actual data.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign TaskCard to Jira-style layout and remove mystery dot</name>
  <files>taskflow/src/routes/dashboard/TaskCard.tsx</files>
  <action>
Redesign the TaskCard component layout to match Jira's card style:

1. **Remove the health dot entirely:**
   - Remove the `healthDot` prop from TaskCardProps
   - Remove the `ReviewHealth` import and `HEALTH_COLORS` map
   - Remove the `<span className="inline-block size-1.5 rounded-full ...">` element (line 134)
   - Remove the `dotColor` variable

2. **Restructure the card layout to match Jira's card style:**

   Current layout (top to bottom):
   - Issue key
   - Summary (2-line clamp)
   - [Optional] Status badge
   - Bottom row: avatar | health dot
   - [Optional] Subtask count + chevron

   New layout (top to bottom):
   - **Top row:** Issue key (left) + issue type name in muted text (right) -- e.g. "PROJ-123" left, "Sub-task" right
   - **Summary** (2-line clamp, same as current)
   - **Bottom row:** Assignee avatar (left) + metadata right-aligned:
     - Story points badge (if available and non-null, show as small rounded badge like "3 SP")
     - Status badge (when `showStatus` is true)
   - [Optional] Subtask count + chevron (unchanged)

3. **Show story points for parent cards:**
   - Access `issue.fields.customfield_10016` for story points
   - Also check `issue.fields[storyPointsFieldKey]` -- but since we don't have the dynamic key in this component, use `customfield_10016` directly (this is the most common Jira field key, and it's always fetched)
   - Render as a small muted badge: e.g. `<span className="text-xs text-muted-foreground bg-muted rounded px-1">3</span>`
   - Only show when value is non-null and > 0
   - Subtasks typically don't have story points (not fetched), so this gracefully handles that

4. **Show issue type name on subtask cards:**
   - Display `issue.fields.issuetype.name` in the top row, right-aligned, in muted/small text
   - This gives context like "Sub-task", "Bug", "Story" etc.

5. **Keep all existing functionality intact:**
   - Context menu wrapping (onTransition)
   - Subtask count chip + chevron toggle
   - isSubtask left border styling
   - onClick / keyboard handling
   - transitionError display
   - Density variants (density-compact, density-comfortable)

6. **Updated bottom row structure:**
```tsx
{/* Bottom row: avatar + metadata */}
<div className="flex items-center justify-between mt-1">
  <div className="flex items-center">
    {assignee && (
      <CachedAvatar url={avatarUrl} name={displayName} size={20} />
    )}
  </div>
  <div className="flex items-center gap-1.5">
    {/* Story points badge */}
    {storyPoints != null && storyPoints > 0 && (
      <span className="text-xs text-muted-foreground bg-muted rounded px-1 font-mono">
        {storyPoints}
      </span>
    )}
    {/* Status badge */}
    {showStatus && (
      <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', statusCategoryBadgeClass(...))}>
        {issue.fields.status.name}
      </span>
    )}
  </div>
</div>
```
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - The gray health dot is gone from all cards
    - Issue type name (e.g. "Sub-task", "Bug", "Story") appears in top-right of every card
    - Story points appear as a small badge on parent cards that have points assigned
    - Assignee avatar still shows bottom-left
    - Status badge moved to bottom-right row alongside story points
    - All existing functionality (context menu, subtask expand, click handling) preserved
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Redesigned TaskCard with Jira-style layout: removed mystery gray dot, added issue type label, added story points badge, reorganized bottom row with avatar left and metadata right</what-built>
  <how-to-verify>
    1. Open the app and navigate to the Sprint Board tab
    2. Verify the gray dot is no longer visible on any card
    3. Check that each card shows its issue type (e.g. "Sub-task", "Story", "Bug") in the top-right area
    4. Check that parent story cards with story points show a small points badge (number) in the bottom row
    5. Verify subtask cards still show the indented left border
    6. Right-click a card to confirm the context menu still works
    7. Click a card to confirm the detail sheet still opens
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` passes (no type errors)
- Visual inspection confirms Jira-style card layout
- No references to `healthDot` or `ReviewHealth` remain in TaskCard.tsx
</verification>

<success_criteria>
- Gray mystery dot removed from all sprint board cards
- Cards show issue type name for quick identification
- Story points visible on cards that have them
- Card layout follows Jira's familiar pattern (key+type top, summary middle, avatar+metadata bottom)
- All interactive features (click, context menu, expand subtasks) still work
</success_criteria>

<output>
After completion, create `.planning/quick/260330-wrg-redesign-sprint-board-subtask-card-to-ma/260330-wrg-SUMMARY.md`
</output>
