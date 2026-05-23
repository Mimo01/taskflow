---
phase: quick-260405-tci
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/utils.ts
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/components/ui/confirm-sprint-move-dialog.tsx
autonomous: true
requirements: [QUICK-TCI]

must_haves:
  truths:
    - "User can click the Sprint field in issue detail sidebar and select a different sprint"
    - "Selecting a sprint in issue detail shows a confirmation dialog before executing the move"
    - "Moving a sprint from backlog context menu also shows a confirmation dialog before executing"
    - "After confirming, the issue moves to the selected sprint and caches invalidate"
    - "User can cancel the confirmation dialog without moving the issue"
  artifacts:
    - path: "taskflow/src/components/ui/confirm-sprint-move-dialog.tsx"
      provides: "Reusable confirmation dialog for sprint moves"
      exports: ["ConfirmSprintMoveDialog"]
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Sprint field as clickable picker with sprint options"
      contains: "sprintPickerOpen"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Context menu wired to confirmation dialog"
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      provides: "Confirmation state management for backlog sprint moves"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      to: "taskflow/src/services/jira/sprints.ts"
      via: "addIssuesToSprint call on confirm"
      pattern: "addIssuesToSprint"
    - from: "taskflow/src/components/ui/confirm-sprint-move-dialog.tsx"
      to: "taskflow/src/components/ui/dialog.tsx"
      via: "Dialog components import"
      pattern: "import.*Dialog"
    - from: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      to: "taskflow/src/components/ui/confirm-sprint-move-dialog.tsx"
      via: "ConfirmSprintMoveDialog rendered with pending move state"
      pattern: "ConfirmSprintMoveDialog"
---

<objective>
Add sprint change capability to the issue detail sidebar and add confirmation dialogs to both the issue detail sprint picker and the backlog view's context menu sprint moves.

Purpose: Users need to change an issue's sprint from the issue detail view (currently read-only), and all sprint moves (both from issue detail and backlog context menu) should require confirmation to prevent accidental reassignment.

Output: Editable sprint picker in issue detail sidebar, shared confirmation dialog component, confirmation flow in backlog context menu.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
@taskflow/src/routes/dashboard/issue-detail/utils.ts
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/BacklogPage.tsx
@taskflow/src/services/jira/sprints.ts
@taskflow/src/components/ui/dialog.tsx
@taskflow/src/hooks/useBoardId.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From taskflow/src/services/jira/sprints.ts:
```typescript
export async function addIssuesToSprint(baseUrl: string, token: string, sprintId: number, issueKeys: string[]): Promise<void>;
export async function moveIssuesToBacklog(baseUrl: string, token: string, issueKeys: string[]): Promise<void>;
export async function fetchSprintsForBoard(baseUrl: string, token: string, boardId: number): Promise<JiraActiveSprint[]>;
```

From taskflow/src/hooks/useBoardId.ts:
```typescript
export function useBoardId(jiraBaseUrl: string | null, jiraToken: string | null, projectKey: string | null): { boardId: number | null; isLoading: boolean };
```

From taskflow/src/routes/dashboard/issue-detail/utils.ts:
```typescript
export function extractSprintName(raw: unknown): string | null;
// Also extracts sprint from various Jira formats (array of objects, toString strings, single object)
```

Sprint field format in Jira issue detail (rawSprint = f[sprintFieldKey]):
- Array of objects: [{id, name, state, ...}] -- prefer active sprint
- Can extract current sprint ID from: (rawSprint as Array<{id: number}>)?.[0]?.id

From taskflow/src/components/ui/dialog.tsx:
```typescript
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle };
// Uses @base-ui/react/dialog primitives
```

BacklogRow context menu currently calls onMoveToSprint directly without confirmation.
FieldsSection Sprint row (line 500) is currently read-only: `<MetaRow label="Sprint">{sprintName ?? 'No sprint'}</MetaRow>`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shared ConfirmSprintMoveDialog and add sprint picker to issue detail sidebar</name>
  <files>
    taskflow/src/components/ui/confirm-sprint-move-dialog.tsx,
    taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx,
    taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx,
    taskflow/src/routes/dashboard/issue-detail/utils.ts
  </files>
  <action>
**1. Create `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx`:**

A reusable confirmation dialog for sprint moves, using the existing Dialog components from `@/components/ui/dialog`.

Props:
```typescript
interface ConfirmSprintMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: string;
  fromSprintName: string | null;  // null means "Backlog"
  toSprintName: string;
  onConfirm: () => void;
  isPending?: boolean;
}
```

Dialog content:
- Title: "Move Issue"
- Description: "Move {issueKey} from {fromSprintName || 'Backlog'} to {toSprintName}?"
- Footer with Cancel button (DialogClose) and Confirm button (calls onConfirm, shows loading state when isPending)
- Use `Dialog` with `open`/`onOpenChange` controlled props (base-ui dialog supports this via the `open` prop on Root)

**2. Add `extractSprintId` helper to `taskflow/src/routes/dashboard/issue-detail/utils.ts`:**

```typescript
export function extractSprintId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return (raw as Record<string, unknown>).id as number ?? null;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (typeof first === 'object' && first !== null) {
      // Prefer active sprint
      const items = raw as Array<Record<string, unknown>>;
      const active = items.find(s => String(s.state).toLowerCase() === 'active');
      return ((active ?? items[0]).id as number) ?? null;
    }
  }
  return null;
}
```

**3. Make Sprint row editable in `FieldsSection.tsx`:**

Replace the read-only Sprint MetaRow (line ~500) with an interactive sprint picker:

- Add state: `const [sprintPickerOpen, setSprintPickerOpen] = useState(false);`
- Add state: `const [pendingMove, setPendingMove] = useState<{sprintId: number; sprintName: string} | null>(null);`
- Import `useBoardId` from `@/hooks/useBoardId`, `fetchSprintsForBoard` from `@/services/jira/sprints`, `readSecret` from `@/services/stronghold`, and `useAuthStore` for `activeJiraProject`.
- Get `jiraToken` via `readSecret('jira-pat')` inside a useQuery for available sprints.
- Use a Popover (already imported in FieldsSection) for the sprint picker. Trigger shows current sprint name (clickable like other fields). Content lists available sprints (active + future), excluding the current sprint ID (use `extractSprintId(rawSprint)`).
- Fetch sprints using useQuery with key `['jira-field-sprints', boardId]`, queryFn calls `fetchSprintsForBoard`, enabled when `sprintPickerOpen && !!boardId`. Use `useBoardId` hook to get boardId (needs `jiraBaseUrl`, token from readSecret, `activeJiraProject`).
- NOTE: `useBoardId` needs a token. Since FieldsSection doesn't have direct token access, add a local useQuery that reads the token via readSecret (pattern already used in FieldsSection for assignee search and fix versions). Store token in a ref or use the same pattern as doSearch. Actually, simplest: add a `useQuery` for the token: `const { data: jiraToken } = useQuery({ queryKey: ['jira-pat'], queryFn: () => readSecret('jira-pat'), staleTime: Infinity });` Then pass to useBoardId.
- When user clicks a sprint in the popover: close popover, set pendingMove, open ConfirmSprintMoveDialog.
- Also add a "Backlog" option at the bottom (separated) if the issue currently has a sprint.
- On confirm: call `addIssuesToSprint` (or `moveIssuesToBacklog` for backlog option) via a `useMutation`. On success, invalidate `jira-issue-detail`, `jira-sprint-stories`, `jira-backlog-sprint-stories`, `jira-backlog-issues`, `jira-sprint-list` caches (same pattern as transitionMutation.onSettled). Clear pendingMove.
- On cancel/close: clear pendingMove.
- Import and render `ConfirmSprintMoveDialog` at the bottom of FieldsSection's return JSX (inside the fragment).
- Only show sprint picker for stories (isStory), matching existing guard.

**4. Pass required props through IssueDetailSidebar if needed:**

The `IssueDetailSidebar` already passes `sprintFieldKey` to `FieldsSection`. No changes needed to IssueDetailSidebar unless new props are required -- `FieldsSection` can get `activeJiraProject` from `useAuthStore` (already imported) and boardId from `useBoardId`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Sprint field in issue detail sidebar is clickable and opens a popover with available sprints
    - Selecting a sprint opens a confirmation dialog showing issue key, source sprint, and target sprint
    - Confirming executes the move via Jira API and invalidates relevant caches
    - Canceling closes the dialog without side effects
    - "Backlog" option available when issue is currently in a sprint
    - ConfirmSprintMoveDialog is a reusable component in components/ui/
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire confirmation dialog into backlog view sprint moves</name>
  <files>
    taskflow/src/routes/dashboard/BacklogPage.tsx,
    taskflow/src/routes/dashboard/BacklogRow.tsx
  </files>
  <action>
**1. Add confirmation state to `BacklogPage.tsx`:**

Add state at the component level (near other state declarations around line 380+):
```typescript
const [pendingSprintMove, setPendingSprintMove] = useState<{
  issueKey: string;
  sprintId: number;
  sprintName: string;
  fromSprintName: string | null;
} | null>(null);

const [pendingBacklogMove, setPendingBacklogMove] = useState<{
  issueKey: string;
  fromSprintName: string;
} | null>(null);
```

**2. Modify `handleMoveToSprint` (line ~499):**

Instead of executing the move immediately, set the pending state:
```typescript
function requestMoveToSprint(issueKey: string, sprintId: number, sprintName: string) {
  // Find the issue's current sprint name for the confirmation dialog
  const allIssuesList = [...(sprintStories ?? []), ...(backlogIssues ?? [])];
  const issue = allIssuesList.find(i => i.key === issueKey);
  const currentSprintName = issue?.fields.sprint
    ? (issue.fields.sprint as { name?: string }).name ?? null
    : null;
  setPendingSprintMove({ issueKey, sprintId, sprintName, fromSprintName: currentSprintName });
}
```

Keep the existing `handleMoveToSprint` logic but rename it to `confirmMoveToSprint` and make it execute from the dialog confirm callback. It should also clear `pendingSprintMove` after execution.

**3. Similarly for `handleMoveToBacklog` (line ~532):**

Create `requestMoveToBacklog(issueKey: string)` that finds the issue's current sprint name and sets `pendingBacklogMove`. Rename existing logic to `confirmMoveToBacklog`.

**4. Update VirtualizedBacklogTable and renderSection calls:**

Pass `requestMoveToSprint` instead of `handleMoveToSprint` to `onMoveToSprint`.
Pass `requestMoveToBacklog` instead of `handleMoveToBacklog` to `onMoveToBacklog`.

**5. Render ConfirmSprintMoveDialog in BacklogPage:**

Import `ConfirmSprintMoveDialog` from `@/components/ui/confirm-sprint-move-dialog`.

At the bottom of the BacklogPage return JSX (after the main content div), render two dialog instances:

```tsx
{/* Sprint move confirmation */}
<ConfirmSprintMoveDialog
  open={!!pendingSprintMove}
  onOpenChange={(open) => { if (!open) setPendingSprintMove(null); }}
  issueKey={pendingSprintMove?.issueKey ?? ''}
  fromSprintName={pendingSprintMove?.fromSprintName ?? null}
  toSprintName={pendingSprintMove?.sprintName ?? ''}
  onConfirm={() => {
    if (pendingSprintMove) {
      confirmMoveToSprint(pendingSprintMove.issueKey, pendingSprintMove.sprintId, pendingSprintMove.sprintName);
      setPendingSprintMove(null);
    }
  }}
/>

{/* Move to backlog confirmation -- reuse dialog with toSprintName="Backlog" */}
<ConfirmSprintMoveDialog
  open={!!pendingBacklogMove}
  onOpenChange={(open) => { if (!open) setPendingBacklogMove(null); }}
  issueKey={pendingBacklogMove?.issueKey ?? ''}
  fromSprintName={pendingBacklogMove?.fromSprintName ?? null}
  toSprintName="Backlog"
  onConfirm={() => {
    if (pendingBacklogMove) {
      confirmMoveToBacklog(pendingBacklogMove.issueKey);
      setPendingBacklogMove(null);
    }
  }}
/>
```

**No changes needed to BacklogRow.tsx** -- it already calls `onMoveToSprint` and `onMoveToBacklog` which will now point to the request functions.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Right-clicking a backlog row and selecting a sprint opens confirmation dialog
    - Dialog shows issue key, current sprint (or "Backlog"), and target sprint
    - Confirming executes the move with existing optimistic update logic
    - Canceling closes dialog without moving the issue
    - Moving to backlog also shows confirmation
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Sprint picker in issue detail sidebar and confirmation dialogs for all sprint moves (issue detail + backlog context menu).
  </what-built>
  <how-to-verify>
    1. Open the app and navigate to any story's issue detail view
    2. Find the "Sprint" field in the sidebar -- it should now be clickable
    3. Click it -- a popover should show available sprints (active + future)
    4. Select a different sprint -- a confirmation dialog should appear showing "Move {KEY} from {current} to {target}?"
    5. Click Cancel -- nothing should happen
    6. Select again and click Confirm -- the issue should move and the sprint field should update
    7. Navigate to the Backlog view
    8. Right-click any issue row and select "Move to" a sprint
    9. A confirmation dialog should appear before the move executes
    10. Verify both Confirm and Cancel work correctly
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles without errors: `cd taskflow && npx tsc --noEmit`
- Sprint picker appears in issue detail sidebar for story-type issues
- Confirmation dialog appears for all sprint move operations
- Existing backlog context menu still works (with added confirmation step)
</verification>

<success_criteria>
- Sprint field in issue detail sidebar is interactive (clickable, shows sprint options)
- All sprint moves (issue detail + backlog) go through a confirmation dialog
- Confirmation dialog is a shared, reusable component
- Cancel dismisses without side effects; Confirm executes the move
- Cache invalidation happens on successful moves (same queries as existing patterns)
</success_criteria>

<output>
After completion, create `.planning/quick/260405-tci-change-sprint-of-a-story-from-issue-deta/260405-tci-SUMMARY.md`
</output>
