---
phase: quick-261014-lgn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx
autonomous: true
requirements: [QUICK-261014-lgn]

must_haves:
  truths:
    - "In the Edit Issue modal the assignee dropdown shows an explicit 'Unassigned' option as its first entry (edit mode only)"
    - "Picking 'Unassigned' and saving removes the assignee in Jira via PUT /rest/api/2/issue/{key}/assignee with body {\"name\":null}"
    - "Focusing, typing in, or blurring the assignee field without picking keeps the current assignee: no assignee change is sent and the input label is restored"
    - "Picking a different user still reassigns via fields.assignee = {name}"
    - "After unassigning, the issue detail view (and the parent's subtask row) shows Unassigned without a stale fallback"
    - "fields.assignee = null is never sent from the edit path"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "assignIssue(baseUrl, token, issueKey, name|null) helper; fixed subtask-enrichment assignee fallback"
      contains: "export async function assignIssue"
    - path: "taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts"
      provides: "assigneeUnassignPicked + assigneeCommittedLabel state and ASSIGNEE_PICK / ASSIGNEE_PICK_UNASSIGNED / ASSIGNEE_BLUR actions"
      contains: "ASSIGNEE_PICK_UNASSIGNED"
    - path: "taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx"
      provides: "Unassigned option in assignee listbox; focus/change no longer clear the committed selection"
      contains: "Unassigned"
    - path: "taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts"
      provides: "Explicit-only unassign via assignIssue; extra cache invalidation"
      contains: "assignIssue"
  key_links:
    - from: "taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts"
      to: "assignIssue in services/jira.ts"
      via: "called after bulkUpdateIssue when state.assigneeUnassignPicked && initialValues.assigneeName"
      pattern: "assignIssue\\("
    - from: "taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx"
      to: "useCreateEditForm reducer"
      via: "dispatch ASSIGNEE_PICK_UNASSIGNED / ASSIGNEE_PICK / ASSIGNEE_BLUR"
      pattern: "ASSIGNEE_(PICK|PICK_UNASSIGNED|BLUR)"
    - from: "taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts"
      to: "react-query caches"
      via: "invalidateQueries on jira-issue-detail, jira-subtask-enrichment, jira-parent-detail"
      pattern: "jira-subtask-enrichment"
---

<objective>
Let the user unassign an issue from the Edit Issue modal on issue detail. Today they can only add or change the assignee. The work has three parts. First, add an explicit "Unassigned" option to the assignee combobox (per CONTEXT locked decision "Unassign UX"). Second, close the latent bug where focusing the field and then blurring without a pick sends `fields.assignee = null` (locked decision: "empty/blurred field with no pick must keep the current assignee"). Third, unassign through the dedicated Jira Server/DC endpoint `PUT /rest/api/2/issue/{key}/assignee {"name":null}`, chosen at Claude's discretion after research (Atlassian KB). The edit modal is the only entry point; no sidebar control (locked decision "Entry point").

Purpose: unassigning is a basic Jira operation, and it is currently impossible in-app.
Output: an `assignIssue` service helper, a fixed enrichment fallback, the combobox and form-state changes, explicit-only unassign in the mutation, and tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261014-lgn-issue-detail-unassign-assignee/261014-lgn-CONTEXT.md
@.planning/quick/261014-lgn-issue-detail-unassign-assignee/261014-lgn-RESEARCH.md

Project notes (from MEMORY; no CLAUDE.md exists):
- Edit legacy `taskflow/src/services/jira.ts`, NOT the `services/jira/` modules. All imports go through jira.ts.
- The pre-commit hook runs the full vitest suite plus biome plus tsc. Tests and code go into ONE commit per task, with no separate RED commit.
- Run `npx biome check <touched files>` only. Never run `biome --write` on all of src. The gate is "no NEW files flagged", not an absolute count.
- No bulk find-replace. Make scoped edits and grep afterwards to confirm each edit landed.
- All commands run from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Code anchors:
- `services/jira.ts`: `bulkUpdateIssue` at L2754-2778 (copy its apiFetch/ApiError/flattenJiraError error-handling pattern). Stale fallback at L1940: `assignee: fresh?.assignee ?? sub.fields.assignee,`
- `useCreateEditForm.ts`: FormState L34-54, FormAction union L57-71, buildInitialState L123-125, formReducer L144+. RESET goes through buildInitialState, so new fields must be initialised there.
- `CreateEditIssueModal.tsx`: assignee combobox L492-581, with onChange L503-511, onFocus L512-518, onBlur L519-525, the listbox gate `allAssignees.length > 0` at L529, and option onMouseDown L559-575.
- `useIssueMutations.ts`: edit assignee block L173-175, `bulkUpdateIssue` call ~L199, onSuccess ~L218-227. The create path at L67 stays unchanged.
- Tests: `src/routes/dashboard/CreateEditIssueModal.test.tsx` mocks `@/services/jira` through an importOriginal spread at L26-41. `src/services/jira.test.ts` has a bulkUpdateIssue block at ~L1347.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: assignIssue service helper + subtask-enrichment assignee fallback fix</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts</files>
  <behavior>
    - assignIssue('https://jira.x/', 'tok', 'PROJ-5', null) issues PUT to 'https://jira.x/rest/api/2/issue/PROJ-5/assignee' with Bearer auth, Content-Type application/json, body exactly '{"name":null}'
    - assignIssue with name 'jdoe' sends body '{"name":"jdoe"}'
    - 401/403 response rejects with ApiError (status preserved); 400 with Jira errorMessages body rejects with Error containing the flattened Jira message
    - 204 / any ok response resolves undefined
    - fetchEnrichedSubtasks: when the fresh search result has assignee: null and sub.fields.assignee is non-null, the enriched subtask's assignee is null; when no fresh entry exists, sub.fields.assignee is kept
  </behavior>
  <action>
    Implements the payload decision (Claude's discretion per CONTEXT; RESEARCH "Payload decision"). In legacy services/jira.ts, add `export async function assignIssue(baseUrl: string, token: string, issueKey: string, name: string | null): Promise<void>` directly after bulkUpdateIssue (~L2778). Build the URL as `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/assignee`. Call apiFetch('jira', url, {method 'PUT', Authorization Bearer, Content-Type application/json, body JSON.stringify({ name })}, 'Create/Edit Issue'), using the same apiFetch source label as bulkUpdateIssue. On !ok, throw ApiError(`Failed to assign ${issueKey}`, status, 'jira') for 401/403. For other statuses, parse the JSON body with a catch fallback and throw new Error(flattenJiraError(body) ?? `Failed to assign ${issueKey}: ${status}`), matching bulkUpdateIssue's existing helper names exactly (read L2754-2778 first and reuse what it uses). Add a doc comment saying null means Unassigned, and that the code must never send "-1" (that assigns the project default) or "Unassigned" (400 not assignable).
    Fix the stale fallback at L1940 (CONTEXT discretion note on `fresh?.assignee ?? sub.fields.assignee`). Change it to `assignee: fresh ? (fresh.assignee ?? null) : sub.fields.assignee,`. Leave the status and timetracking lines alone.
    In jira.test.ts, add a `describe('assignIssue')` block next to the bulkUpdateIssue block, using that block's existing fetch-mock style, covering the behaviours above. Add one fetchEnrichedSubtasks case for the null override, following the existing fetchEnrichedSubtasks tests (grep for them; if none exist, mock the search response the same way bulkUpdateIssue tests mock fetch). Commit tests and code together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira.test.ts && npx biome check src/services/jira.ts src/services/jira.test.ts && grep -c "fresh ? (fresh.assignee ?? null)" src/services/jira.ts</automated>
  </verify>
  <done>assignIssue is exported from services/jira.ts and its tests pass (URL, PUT, body {"name":null}, error mapping). The L1940 fallback no longer overrides a fresh null assignee. biome reports nothing new on the touched files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Explicit "Unassigned" option, no-op blur, explicit-only unassign in edit mutation</name>
  <files>taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts, taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx, taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts, taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx</files>
  <behavior>
    - (a) Edit mode with assignee 'janesmith': focusing the assignee input opens the listbox, and its first role="option" has the text 'Unassigned'. It renders even when the assignable-users list is empty or still loading, and even when the user has typed a query.
    - (b) Pick Unassigned, then Save: assignIssue is called with (base, token, 'PROJ-42', null), the fields object passed to bulkUpdateIssue has NO 'assignee' key, and the input shows 'Unassigned' after the pick.
    - (c) Focus, then blur, then Save with no pick (also focus, type 'xyz', blur): bulkUpdateIssue fields have no 'assignee' key, assignIssue is not called, and after blur the input value is restored to the original label ('janesmith').
    - (d) Pick a different user, then Save: fields.assignee equals {name: thatUser} and assignIssue is not called.
    - (e) Create mode: no 'Unassigned' option is rendered.
    - (f) Edit mode where the issue is already unassigned (initial assigneeName null): Unassigned has aria-selected true, and picking it then saving calls neither assignIssue nor sets fields.assignee.
  </behavior>
  <action>
    Implements the CONTEXT locked decisions "Unassign UX" (explicit Unassigned option at top; empty/blurred field keeps current assignee; onFocus clearing must not become an implicit unassign) and "Entry point" (edit modal only, so do not touch IssueDetailContent sidebar).
    useCreateEditForm.ts: add `assigneeUnassignPicked: boolean` (initial false) and `assigneeCommittedLabel: string` (initial `initialValues?.assigneeName ?? ''`) to FormState and buildInitialState. Add three actions to the FormAction union and reducer.
    - `{type:'ASSIGNEE_PICK'; name: string; label: string}` sets selectedAssigneeName=name, assigneeInputValue=label, assigneeCommittedLabel=label, assigneeUnassignPicked=false, showAssigneeResults=false.
    - `{type:'ASSIGNEE_PICK_UNASSIGNED'}` sets assigneeUnassignPicked=true, selectedAssigneeName=null, assigneeInputValue='Unassigned', assigneeCommittedLabel='Unassigned', showAssigneeResults=false.
    - `{type:'ASSIGNEE_BLUR'}` sets assigneeInputValue=state.assigneeCommittedLabel and showAssigneeResults=false. The restore must happen inside the reducer, reading current state, not from a closure; see RESEARCH pitfall 1, the stale setTimeout closure.
    CreateEditIssueModal.tsx combobox:
    - onChange: keep only the assigneeInputValue and showAssigneeResults=true dispatches, and remove the selectedAssigneeName=null dispatch.
    - onFocus: clear assigneeInputValue to '' so the full list shows, and set showAssigneeResults=true. Do not touch selectedAssigneeName.
    - onBlur: setTimeout(() => dispatch({type:'ASSIGNEE_BLUR'}), 150).
    - User option onMouseDown: dispatch a single ASSIGNEE_PICK with name user.name and label user.displayName.
    - Change the listbox render condition at L529 so that in edit mode it renders whenever showAssigneeResults is true. Use something like `state.showAssigneeResults && (mode === 'edit' || assigneeLoading || allAssignees.length > 0)`, matching the actual mode prop/variable name in the component.
    - As the first child of the listbox, when in edit mode, render a button with type="button", role="option", aria-selected `state.assigneeUnassignPicked || (!state.selectedAssigneeName && !initialValues?.assigneeName)` (adapt to how the modal reads initial values), the same className as the user options, italic text-muted-foreground styling plus pr-0.5 (italic truncate clip, per MEMORY), and text 'Unassigned'. Its onMouseDown dispatches ASSIGNEE_PICK_UNASSIGNED. It is NOT filtered by the fuzzy query, and it appears above the Loading row.
    useIssueMutations.ts edit path: replace L173-175 with: only when `!state.assigneeUnassignPicked && state.selectedAssigneeName && state.selectedAssigneeName !== initialValues.assigneeName`, set `fields.assignee = { name: state.selectedAssigneeName }`. Never assign `fields.assignee = null`. Import assignIssue from '@/services/jira' (same import as bulkUpdateIssue). Immediately after the bulkUpdateIssue await, add: if `state.assigneeUnassignPicked && initialValues.assigneeName`, await assignIssue(jiraBaseUrl, token, initialValues.issueKey, null). Let errors propagate to onError.
    In onSuccess, after the existing jira-issue-detail invalidation, add prefix invalidations `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` and `({ queryKey: ['jira-parent-detail'] })` so a parent's subtask row and children's Parent row drop the old avatar (CONTEXT discretion: post-save cache invalidation). Leave the create path (L67) unchanged.
    CreateEditIssueModal.test.tsx: add `assignIssue: vi.fn().mockResolvedValue(undefined)` to the @/services/jira mock (L26-41) and write cases (a) to (f) using the file's existing render helpers and assignable-users mock. Run the attachments test too to confirm it still passes untouched. Commit tests and code together in one commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/dashboard/create-edit-issue/CreateEditIssueModal.attachments.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx && npx biome check src/routes/dashboard/create-edit-issue/useCreateEditForm.ts src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx src/routes/dashboard/create-edit-issue/useIssueMutations.ts src/routes/dashboard/CreateEditIssueModal.test.tsx && npx tsc --noEmit && ! grep -n "fields.assignee = .*: null" src/routes/dashboard/create-edit-issue/useIssueMutations.ts</automated>
  </verify>
  <done>Cases (a) to (f) pass. Edit mode shows Unassigned first, and picking it and saving calls assignIssue(..., null) with no fields.assignee. Focus or blur without a pick sends nothing and restores the label. Reassign still uses fields.assignee={name}. Create mode is unchanged. tsc is clean, biome reports nothing new on touched files, and the full suite passes via pre-commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app -> Jira REST | Authenticated PUT with the user's PAT changes issue assignee |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lgn-01 | Tampering | useIssueMutations edit path | mitigate | Unassign only fires on the explicit assigneeUnassignPicked flag. Focus, blur, and typing never produce an assignee change (tests c and f). |
| T-lgn-02 | Tampering | assignIssue payload | mitigate | Body is always JSON.stringify({name}) with null for unassign. Never send "-1" (silently assigns the project default) or "Unassigned"; test asserts the exact body. |
| T-lgn-03 | Elevation | /assignee endpoint | accept | Jira enforces the Assign Issues permission server-side. A 401/403 surfaces as ApiError through onError. |
| T-lgn-04 | Information disclosure | PAT in header | accept | Same apiFetch/Bearer pattern as existing bulkUpdateIssue. No new storage or logging. |
</threat_model>

<verification>
- `npx vitest run src/services/jira.test.ts src/routes/dashboard/CreateEditIssueModal.test.tsx` passes.
- `npx tsc --noEmit` is clean, and biome on the touched files reports nothing new.
- `grep -n "assignIssue(" taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` shows exactly one call, guarded by assigneeUnassignPicked.
- Manual (optional, at UAT): open issue detail, Edit, focus Assignee, pick Unassigned, Save. The sidebar shows Unassigned after refetch.
</verification>

<success_criteria>
- The user can unassign from the Edit Issue modal through the explicit Unassigned option.
- No accidental unassign from focus, blur, or typing without a pick.
- Reassign behaviour is unchanged. Create and clone are unaffected.
- Detail view, subtask rows, and parent rows reflect Unassigned after save.
</success_criteria>

<output>
Create `.planning/quick/261014-lgn-issue-detail-unassign-assignee/261014-lgn-SUMMARY.md` when done
</output>
