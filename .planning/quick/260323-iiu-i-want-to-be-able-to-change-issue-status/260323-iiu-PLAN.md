---
phase: quick-260323-iiu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
autonomous: true
requirements: [STATUS-CHANGE]

must_haves:
  truths:
    - "User can click the status badge on the issue detail sidebar to see available transitions"
    - "User can select a transition and the issue status updates immediately (optimistic)"
    - "If the transition fails, the status reverts and an error message appears"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Clickable status with transition dropdown"
  key_links:
    - from: "FieldsSection.tsx status click"
      to: "fetchTransitions"
      via: "react-query useQuery on popover open"
      pattern: "fetchTransitions"
    - from: "FieldsSection.tsx transition select"
      to: "postTransition"
      via: "useMutation with optimistic update"
      pattern: "postTransition"
---

<objective>
Make the issue status editable from the issue detail sidebar. Clicking the status badge opens a popover listing available Jira transitions. Selecting a transition fires the Jira transition API and optimistically updates the displayed status.

Purpose: Users can change issue status without leaving the app.
Output: Updated FieldsSection.tsx with interactive status control.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
@taskflow/src/services/jira/transitions.ts
@taskflow/src/services/jira/types.ts

<interfaces>
From taskflow/src/services/jira/transitions.ts:
```typescript
export async function fetchTransitions(baseUrl: string, token: string, issueKey: string): Promise<JiraTransition[]>;
export async function postTransition(baseUrl: string, token: string, issueKey: string, transitionId: string): Promise<void>;
```

From taskflow/src/services/jira/types.ts:
```typescript
export interface JiraTransition {
  id: string;
  name: string;
  to: { id: string; name: string };
}
```

From taskflow/src/services/jira.ts (barrel re-exports):
```typescript
export async function fetchTransitions(...): Promise<JiraTransition[]>;
export async function postTransition(...): Promise<void>;
```

Current status display in FieldsSection.tsx (lines 169-171):
```tsx
<MetaRow label="Status">
  <Badge variant="outline">{f.status.name}</Badge>
</MetaRow>
```

Existing patterns in FieldsSection.tsx:
- Priority uses Select component with inline editing state
- Assignee uses Popover with search
- Both use the shared `mutation` from useFieldMutation for optimistic updates
- Error shown with `mutation.isError` inline messages
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add status transition popover to FieldsSection</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</files>
  <action>
Replace the static status Badge (lines 169-171) with a clickable status control that opens a Popover listing available transitions, following the same pattern used by the Assignee popover in the same file.

Implementation details:

1. Add imports:
   - `import { fetchTransitions, postTransition } from '@/services/jira/transitions';` (import from jira/ submodule path per Phase 32 decision)
   - `import type { JiraTransition } from '@/services/jira/types';`
   - `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';` (useQuery and useMutation already available via existing imports -- just add what's missing)

2. Add state: `const [statusOpen, setStatusOpen] = useState(false);`

3. Add a useQuery for transitions that fetches when the popover opens:
   ```tsx
   const { data: transitions, isLoading: transitionsLoading } = useQuery({
     queryKey: ['jira-transitions', issueKey, jiraBaseUrl],
     queryFn: async () => {
       const token = await readSecret('jira-pat').catch(() => null);
       if (!token) return [] as JiraTransition[];
       return fetchTransitions(jiraBaseUrl, token, issueKey);
     },
     enabled: statusOpen && !!jiraBaseUrl,
     staleTime: 30_000,
   });
   ```

4. Add a dedicated useMutation for transitions (cannot reuse useFieldMutation since transitions use a different API endpoint -- POST /transitions not PUT /issue):
   ```tsx
   const queryClient = useQueryClient();
   const transitionMutation = useMutation({
     mutationFn: async ({ transitionId, toName }: { transitionId: string; toName: string }) => {
       const token = await readSecret('jira-pat').catch(() => null);
       if (!token) throw new Error('No token');
       return postTransition(jiraBaseUrl, token, issueKey, transitionId);
     },
     onMutate: async ({ toName }) => {
       await queryClient.cancelQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
       const previous = queryClient.getQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl]);
       queryClient.setQueryData<JiraIssueDetail>(
         ['jira-issue-detail', issueKey, jiraBaseUrl],
         (old) => {
           if (!old) return old;
           return { ...old, fields: { ...old.fields, status: { ...old.fields.status, name: toName } } };
         },
       );
       return { previous };
     },
     onError: (_err, _vars, context) => {
       if (context?.previous) {
         queryClient.setQueryData(['jira-issue-detail', issueKey, jiraBaseUrl], context.previous);
       }
     },
     onSettled: () => {
       queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
       queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
       queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });
       queryClient.invalidateQueries({ queryKey: ['jira-transitions', issueKey] });
     },
   });
   ```

5. Add handler:
   ```tsx
   function handleTransition(t: JiraTransition) {
     setStatusOpen(false);
     transitionMutation.mutate({ transitionId: t.id, toName: t.to.name });
   }
   ```

6. Replace the Status MetaRow with a Popover (same pattern as Assignee):
   ```tsx
   <MetaRow label="Status">
     <Popover open={statusOpen} onOpenChange={setStatusOpen}>
       <PopoverTrigger
         data-testid="status-edit"
         className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer"
         title="Click to change status"
       >
         <Badge variant="outline">{f.status.name}</Badge>
       </PopoverTrigger>
       <PopoverContent className="w-48 p-2">
         {transitionsLoading && (
           <p className="text-xs text-muted-foreground px-1">Loading...</p>
         )}
         {!transitionsLoading && transitions?.length === 0 && (
           <p className="text-xs text-muted-foreground px-1">No transitions available</p>
         )}
         {transitions?.map((t) => (
           <button
             key={t.id}
             type="button"
             onClick={() => handleTransition(t)}
             className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded"
           >
             {t.to.name}
           </button>
         ))}
         {transitionMutation.isError && (
           <p className="text-xs text-destructive mt-1 px-1">Transition failed</p>
         )}
       </PopoverContent>
     </Popover>
   </MetaRow>
   ```

Note: queryClient is already used in useFieldMutation but we need it in FieldsSection too. Add `const queryClient = useQueryClient();` at the top of the component. Import `useQueryClient` from `@tanstack/react-query` if not already imported. Check existing imports first -- `useMutation` and `useQueryClient` may need to be added.

IMPORTANT: Do NOT use the existing `mutation` (from useFieldMutation) for transitions -- that hook calls `updateIssueField` (PUT to /issue) which is wrong for transitions. Transitions require POST to /issue/{key}/transitions via `postTransition`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && npx tsc --noEmit --project taskflow/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Status badge in issue detail sidebar is clickable, opens a popover with available Jira transitions, selecting one fires the transition API with optimistic UI update, errors show inline and revert the status.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Status badge shows a pointer cursor on hover
- Clicking status opens popover with transition options
- Selecting a transition optimistically updates the badge text
- On failure, status reverts to previous value
</verification>

<success_criteria>
- User can change issue status from the detail page sidebar
- Transitions are fetched from Jira API (available transitions only)
- Optimistic update pattern matches existing field mutations
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260323-iiu-i-want-to-be-able-to-change-issue-status/260323-iiu-SUMMARY.md`
</output>
