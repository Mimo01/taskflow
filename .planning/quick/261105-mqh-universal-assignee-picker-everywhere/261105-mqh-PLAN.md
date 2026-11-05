---
phase: quick-261105-mqh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/users.ts
  - taskflow/src/components/ui/use-assignable-user-search.ts
  - taskflow/src/components/ui/person-picker.tsx
  - taskflow/src/components/ui/person-picker.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
  - taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
  - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx
  - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
autonomous: true
requirements: [QUICK-261105-mqh]

must_haves:
  truths:
    - "Every place in the app where a person is chosen (issue-detail assignee, Create/Edit issue assignee, required user custom fields, subtask template/bulk-create rows, Standup 'Showing:' picker, Worklogs person selector) opens the same popover: avatar rows, filter input, 'Assign to me' shortcut where relevant, dashed Unassign card where relevant"
    - "Typing in any picker searches Jira server-side (debounced 200ms, username= param), so users beyond the first page are findable — no client-side filtering of a capped user page anywhere"
    - "Create/Edit issue: picking a user saves it as assignee; picking Unassign in edit mode still calls assignIssue(null) and sends no fields.assignee; closing the popover without a pick leaves the assignee unchanged"
    - "Subtask template rows can pick @inherit / @current / @unassigned OR a real person from the same picker (no free-text username input)"
    - "Issue-detail sidebar assignee looks and behaves exactly as before (testids assignee-edit, assignee-unassign, assignee-assign-to-me preserved)"
  artifacts:
    - path: "taskflow/src/components/ui/person-picker.tsx"
      provides: "Shared PersonPicker (inline + field triggers) and PersonPickerPanel"
      exports: ["PersonPicker", "PersonPickerPanel"]
    - path: "taskflow/src/components/ui/use-assignable-user-search.ts"
      provides: "Debounced server-side assignable-user search hook"
      exports: ["useAssignableUserSearch"]
    - path: "taskflow/src/components/ui/person-picker.test.tsx"
      provides: "Picker behaviour tests"
  key_links:
    - from: "taskflow/src/components/ui/use-assignable-user-search.ts"
      to: "fetchAssignableUsers"
      via: "useQuery keyed on debounced term"
      pattern: "fetchAssignableUsers\\("
    - from: "FieldsSection / CreateEditIssueModal / CustomFieldsSection / SubtaskTemplateRow / WatchedPersonPicker / WorklogsPage"
      to: "taskflow/src/components/ui/person-picker.tsx"
      via: "import { PersonPicker | PersonPickerPanel }"
      pattern: "from '@/components/ui/person-picker'"
---

<objective>
Make the issue-detail assignee popover (FieldsSection) the single, universal person picker and use it at every person-selection site in the app, replacing the plain combobox/Select/free-text pickers and their fetch-once capped user queries.

Purpose: User request — "Use the nice picker everywhere you find in the app. Make it universal and optimized everywhere, I want uniformity."
Output: `components/ui/person-picker.tsx` + `use-assignable-user-search.ts` (+ tests), all call sites migrated, dead plain-picker code and duplicate `assignable-users` queries deleted.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Repo layout: `.planning` + git at outer `taskflow/`; source, npm, vitest, biome run from inner `taskflow/taskflow/` (all `src/...` paths below are relative to the inner dir).

## Call-site inventory (found by grep — all must be migrated)

| # | Site | Currently uses | Problem |
|---|------|----------------|---------|
| 1 | `src/routes/dashboard/issue-detail/FieldsSection.tsx:189-198` (state/debounce), `:274-297` (query), `:567-586` (handlers), `:802-892` (JSX) | THE nice picker: Popover + CachedAvatar rows + filter Input + "Assign to me →" + dashed UserX "Unassign" card; server-side `issueKey=&username=` search, debounced 200ms, inline `AssignableUser` type at `:109` | Source of truth, but not reusable |
| 2 | `src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:493-582` + reducer `useCreateEditForm.ts:38-44,130-134,166-199` + query `useCreateEditQueries.ts:140-156` | Plain `Input role=combobox` + inline listbox, "Name (username)" text rows, no avatars, blur-timer (`assigneeBlurTimer` `:67`) | Fetch-once `maxResults=200` + client-side fuzzy filter (page-cap bug) |
| 3 | `src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx:41-56` (user branch of `fetchAutoComplete`), `:106-187` (JSX) | Required user-type custom fields: generic autocomplete Input over `allAssignees` | Same capped list, text-only rows |
| 4 | `src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx:227-261` | `Select` of `@inherit/@current/@unassigned` OR free-text `Input` for a username; `assignees` prop unused (`_assignees` `:157`) | No real person search at all |
| 5 | `src/routes/dashboard/BulkCreateSubtasksModal.tsx:373-390` (query), `:198,207,231,716` (prop threading) | Fetch-once `maxResults=200` `assignable-users` query passed to #3/#4 | Dead after migration |
| 6 | `src/routes/standup-notes/WatchedPersonPicker.tsx:40-170` | Own Popover + debounced `fetchAssignableUsers` + "Me" row; different row styling | Duplicate implementation, non-uniform look |
| 7 | `src/routes/worklogs/WorklogsPage.tsx:455-463` (query), `:618-643` (handlers), `:856-885` (JSX) | Plain `<input role=combobox>` + `<ul>` text-only rows, blur timer | Non-uniform, no avatars |

## Excluded (not person-assignment pickers)
- `src/components/UnifiedFilterBar.tsx:577`, `src/routes/dashboard/BacklogFilterBar.tsx`, `src/routes/dashboard/SprintBoardTab.tsx:44` — multi-select facet filters over already-loaded issues via `lib/assignee-filter.ts` (Unassigned sentinel). Different concern; leave untouched.
- `src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx` — chart filter rows.
- `src/routes/dashboard/MentionPopover.tsx` — caret-anchored @mention autocomplete inside the comment textarea; different interaction (keyboard-in-textarea). Already server-side. Leave as is.
- Display-only: FieldsSection Reporter row (`:894`, reporter is not editable), `aio-cycle/UserChip.tsx` / `RunSidebar.tsx:70`, `CompleteParentDialog.tsx:236`, BacklogRow/TaskCard avatars.

## Existing interfaces (use directly, do not re-explore)
- `src/services/jira/types.ts:285` — `JiraAssignableUser { displayName; name; key?; avatarUrls?: {'48x48'?;'24x24'?;'16x16'?} }`. Use this type everywhere; delete FieldsSection's local `AssignableUser`.
- `src/services/jira/users.ts` — `fetchAssignableUsers(baseUrl, token, projectKey, query)` (project-scoped, returns [] on error); `fetchJiraUserByName(baseUrl, token, name)` (GET /user?username=).
- `readSecret('jira-pat')` for token (token NEVER in a query key — T-62-06 convention).
- `CachedAvatar` (`@/components/ui/cached-avatar`) props `url`, `name`, `size`, `className`.
- `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover` (Base UI; content is portalled — works inside dialogs).
- `useAuthStore` selectors: `jiraUsername`, `jiraUserDisplayName`, `jiraUserAvatarUrl` (check exact name in `src/stores/auth.store.ts:50`), `activeJiraProject`.
- `EditInitialValues` in `useCreateEditForm.ts:7` — built in `IssueDetailContent.tsx:492` (edit) and `:513` (clone).
- `resolveAssignee(row.assignee, ctx)` in `src/routes/dashboard/resolveRowPlaceholders.ts:26` returns `{ payloadName, displayHint }`; `PlaceholderChip` in SubtaskTemplateRow.tsx:51.

## Project rules
- Pre-commit hook runs full vitest + biome + tsc; one commit per task including its tests; commit with `git commit -- <paths>` and check `git log -1 --stat` (a failed hook leaves files staged).
- No `biome --write` on all of `src`; run `npx biome check <changed files>` only. Biome baseline drifts: gate on "no NEW files flagged".
- Don't bulk find-replace identifiers that appear in labels/testids.
- Fetch-once page-cap pitfall: never fetch a capped page and filter client-side — always pass the typed term to the server.
- React Compiler is on in the app but not in vitest: no module-level mutable reads in render.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract shared PersonPicker + search hook, migrate the issue-detail sidebar</name>
  <files>src/services/jira/users.ts, src/components/ui/use-assignable-user-search.ts, src/components/ui/person-picker.tsx, src/components/ui/person-picker.test.tsx, src/routes/dashboard/issue-detail/FieldsSection.tsx</files>
  <behavior>
    - Typing "bo" then waiting 200ms calls fetchAssignableUsers once with query "bo" (debounced; intermediate keystrokes not fetched); no client-side filtering of results
    - With issueKey scope the request uses issueKey= instead of project=
    - Rows render CachedAvatar + displayName for each server result; clicking a row calls onChange(user) and closes the popover
    - allowUnassign + non-null value shows the dashed "Unassign / Remove {name}" card (only when filter text is empty or a prefix of "unassigned"); clicking calls onChange(null)
    - showAssignToMe shows "Assign to me →" only when value.name !== current jiraUsername; clicking calls onChange with the current user
    - extraOptions render as leading rows (selectable, highlighted when selected via selectedOptionId)
    - ArrowDown/ArrowUp move the active row, Enter selects it, Escape closes without calling onChange
    - Loading shows "Loading users..."; empty shows "No users match" (with term) / "No assignable users found"
  </behavior>
  <action>
1. `users.ts`: extend `fetchAssignableUsers` with an optional 5th param `opts?: { issueKey?: string; maxResults?: number }`. When `opts.issueKey` is set, use `issueKey=` instead of `project=`; append `&maxResults=` (default 50). Keep the existing 4-arg signature working (MentionPopover, WorklogsPage test mock rely on it).

2. `use-assignable-user-search.ts`: export `useAssignableUserSearch({ jiraBaseUrl, projectKey?, issueKey?, query, enabled })` returning `{ users: JiraAssignableUser[], isLoading, debouncedQuery }`. Debounce `query.trim()` by 200ms (useEffect+setTimeout, as FieldsSection does now). `useQuery` key `['jira-assignable-users', issueKey ?? projectKey ?? '', jiraBaseUrl, debouncedQuery]`, `staleTime: 60_000`, queryFn reads the PAT via `readSecret('jira-pat')` and calls `fetchAssignableUsers(..., { issueKey })`. Enabled only when `enabled && jiraBaseUrl && (issueKey || projectKey)`. Token never in key.

3. `person-picker.tsx`: lift FieldsSection's popover body (lines 826-891) verbatim in look into `PersonPickerPanel` and wrap it in `PersonPicker`:
   - Value type `PersonValue = { name: string; displayName: string; avatarUrl?: string | null }` (export it plus a `toPersonValue(user: JiraAssignableUser)` helper that picks 48x48 → 24x24 → 16x16).
   - `PersonPickerPanel` props: `value`, `onChange(user: JiraAssignableUser | null)`, `jiraBaseUrl`, `projectKey?`, `issueKey?`, `open` (gates the query), `allowUnassign?`, `showAssignToMe?`, `extraOptions?: { id: string; label: ReactNode; avatar?: ReactNode }[]`, `selectedOptionId?`, `onSelectOption?(id)`, `placeholder?` (default "Filter users..."), `footer?: ReactNode` (used for FieldsSection's "Save failed" line), `testIdPrefix?` (default `'assignee'` → `assignee-unassign`, `assignee-assign-to-me`). Visuals exactly as the current sidebar: `w-80 p-2` content, h-7 text-xs filter Input with autoFocus, "Assign to me →" muted link + divider, dashed UserX Unassign card + divider, text-xs rows with CachedAvatar size 20 + displayName (add `truncate`, and muted `name` right-aligned for disambiguation). Wrap the result rows in `max-h-64 overflow-y-auto` and render all server results (drop the `.slice(0, 10)` cap — server returns ≤50). Highlight the selected user (`bg-accent/40`) and the keyboard-active row (`bg-accent`); handle ArrowUp/ArrowDown/Enter on the filter Input over the flattened list [extraOptions..., users...]. Reset filter text whenever `open` becomes false.
   - `PersonPicker` props = panel props (minus `open`) + `variant: 'inline' | 'field'`, `disabled?`, `id?`, `aria-label?`, `triggerTestId?`, `triggerContent?: ReactNode` (override, for template placeholders), `emptyLabel?` (default "Unassigned"), `contentClassName?`. Owns `open` state. `inline` trigger = the current FieldsSection trigger classes (`hover:bg-accent rounded px-1 -ml-1 ... inline-flex items-center gap-1.5`, avatar 20 + name, "Unassigned" avatar when null). `field` trigger = full-width form control matching `SelectTrigger` look (read `src/components/ui/select.tsx` for its trigger classes and reuse them: border, rounded-lg, h-8, px, text-sm), avatar 20 + truncated name (or muted `emptyLabel`/placeholder) + trailing `ChevronDown` size-4 opacity-50. Selecting anything closes the popover. Popover content `align="start"`.

4. `person-picker.test.tsx`: cover every `<behavior>` bullet with `vi.mock('@/services/jira/users')`, `vi.mock` of the secret reader (copy the mocking pattern from `src/routes/dashboard/issue-detail/FieldsSection.test.tsx`), fake timers for the debounce, QueryClientProvider wrapper.

5. `FieldsSection.tsx`: delete the local `AssignableUser` interface, assignee state/debounce (189-198), `assigneeUsersQuery` + `filteredAssignees` (274-297), and the inline popover (804-891); render `<PersonPicker variant="inline" triggerTestId="assignee-edit" issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} value={f.assignee ? toPersonValue(f.assignee) : null} allowUnassign showAssignToMe footer={mutation.isError && <p ...>Save failed — changes reverted</p>} onChange={...}/>` inside the same `MetaRow`. onChange maps user → `mutation.mutate({ fieldName: 'assignee', value: { name: user.name } })` (DC format, NOT accountId) and null → `value: null`. Keep `title="Click to change assignee"` on the trigger. Remove now-unused imports (`UserX`, `apiFetch` if unused, etc.). Existing `FieldsSection.test.tsx` "Assignee unassign" tests must pass unchanged.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/components/ui/person-picker.test.tsx src/routes/dashboard/issue-detail/FieldsSection.test.tsx && npx tsc --noEmit -p . && npx biome check src/components/ui/person-picker.tsx src/components/ui/use-assignable-user-search.ts src/components/ui/person-picker.test.tsx src/services/jira/users.ts src/routes/dashboard/issue-detail/FieldsSection.tsx</automated>
  </verify>
  <done>Shared picker + hook exist with passing tests; FieldsSection renders it and contains no assignable-user fetch or local AssignableUser type (`grep -c "user/assignable/search" src/routes/dashboard/issue-detail/FieldsSection.tsx` = 0); FieldsSection tests green; committed as one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create/Edit issue modal — assignee + user custom fields use PersonPicker</name>
  <files>src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx, src/routes/dashboard/create-edit-issue/useCreateEditForm.ts, src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts, src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx, src/routes/dashboard/IssueDetailContent.tsx, src/routes/dashboard/CreateEditIssueModal.test.tsx</files>
  <behavior>
    - Edit mode: trigger shows current assignee's avatar + display name (not raw username)
    - Picking a different user then Save sends fields.assignee {name}
    - Edit mode, picking Unassign then Save calls assignIssue(null) and sends no fields.assignee
    - Opening the picker, typing, then pressing Escape keeps the assignee (no fields.assignee on Save)
    - Create mode: after picking a user, the Unassign card clears it (no assignee in create payload)
    - Edit mode with no assignee: no Unassign card, Save sends no fields.assignee
    - Required user-type custom field: picking a person stores the username as the field value and shows avatar + name in the trigger
  </behavior>
  <action>
1. `useCreateEditForm.ts`: add optional `assigneeDisplayName?: string | null` and `assigneeAvatarUrl?: string | null` to `EditInitialValues`. Replace state fields `assigneeInputValue`, `assigneeCommittedLabel`, `showAssigneeResults` with `selectedAssignee: PersonValue | null` (from `@/components/ui/person-picker`), keeping `selectedAssigneeName` (derived/kept in sync — `useIssueMutations.ts:68,177-181,208` reads it; leave useIssueMutations untouched) and `assigneeUnassignPicked`. Initial state: build `selectedAssignee` from initialValues name/displayName (fallback displayName = name)/avatar. `ASSIGNEE_PICK` now carries `user: PersonValue`; `ASSIGNEE_PICK_UNASSIGNED` sets `selectedAssignee: null`, `selectedAssigneeName: null`, `assigneeUnassignPicked: true`. Delete `ASSIGNEE_BLUR` action and its type entry.

2. `IssueDetailContent.tsx:492` and `:513`: also pass `assigneeDisplayName: issue.fields.assignee?.displayName ?? null` and `assigneeAvatarUrl: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null`.

3. `CreateEditIssueModal.tsx`: replace the block at 493-582 with label + `<PersonPicker variant="field" id="modal-assignee" aria-label="Assignee" projectKey={projectKey} jiraBaseUrl={jiraBaseUrl} value={state.selectedAssignee} allowUnassign={mode === 'edit' ? !!initialValues?.assigneeName || !!state.selectedAssignee : !!state.selectedAssignee} showAssignToMe disabled={isPending} emptyLabel={mode === 'create' ? 'Select assignee (optional)' : 'Unassigned'} onChange={...}/>` dispatching ASSIGNEE_PICK / ASSIGNEE_PICK_UNASSIGNED. Delete `assigneeBlurTimer` (`:67`), and stop destructuring `allAssignees`/`assigneeLoading`. Keep the `<label htmlFor="modal-assignee">` (field trigger gets the id).

4. `useCreateEditQueries.ts`: delete the `allAssignees` query (140-156) and its return entries (188-189); remove now-unused imports/types.

5. `CustomFieldsSection.tsx`: remove the `allAssignees` prop and the user branch of `fetchAutoComplete` (the `isUserField` block at 47-56; keep the `autoCompleteUrl` branch). In the render, add a branch before `hasAutocomplete`: when `isUserField`, render `<PersonPicker variant="field" id={fid} projectKey={state/project key prop} ...>` with value built from `state.customFieldValues[fid]` (name) + `state.customFieldInputValues[fid]` (label, already pre-filled from edit initial values at useCreateEditForm.ts:117-123); onChange dispatches `SET_CUSTOM_FIELD_VALUE` (user.name) and `SET_CUSTOM_FIELD_INPUT` (user.displayName). Add a `projectKey` + `jiraBaseUrl` prop (pass from the modal, which already has both). `hasAutocomplete` becomes `!!field.autoCompleteUrl` for non-user fields. Update the call site at CreateEditIssueModal.tsx:656.

6. `CreateEditIssueModal.test.tsx`: rewrite the assignee tests at 175-335 to drive the new picker (click the trigger `getByLabelText('Assignee')` / role button, type into the "Filter users..." input, click a row by name, `Escape` to dismiss). Mock fetch so `/user/assignable/search` responds to the `username=` param (server-side), with fake-timer/`waitFor` for the 200ms debounce. Preserve every scenario's intent per `<behavior>`; the line-177 assertion becomes "trigger shows Jane Smith".
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/dashboard/create-edit-issue && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/create-edit-issue src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/CreateEditIssueModal.test.tsx</automated>
  </verify>
  <done>`grep -rn "allAssignees\|assigneeInputValue\|ASSIGNEE_BLUR\|Search assignee" src/routes/dashboard/create-edit-issue src/routes/dashboard/IssueDetailContent.tsx` returns nothing; modal assignee + user custom fields render PersonPicker; tests green; one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Subtask templates / bulk create, Standup watched-person, Worklogs person selector</name>
  <files>src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx, src/routes/dashboard/BulkCreateSubtasksModal.tsx, src/routes/standup-notes/WatchedPersonPicker.tsx, src/routes/worklogs/WorklogsPage.tsx, src/routes/worklogs/WorklogsPage.test.tsx</files>
  <behavior>
    - Template row picker lists @inherit, @current, @unassigned as leading options (with resolved hints in preview mode) followed by searched people; picking a person stores the username in row.assignee; picking a placeholder stores the placeholder string
    - A row whose assignee is a concrete username shows that user's avatar + display name in the trigger (resolved via fetchJiraUserByName, cached)
    - Standup picker keeps its "Showing: {name}" trigger and "Me" row but its popover is the shared panel
    - Worklogs: choosing a person in the picker sets the worklog filter user; trigger shows the selected person (placeholder "Filter by person" when none)
  </behavior>
  <action>
1. `SubtaskTemplateRow.tsx` (227-261): replace the Select / free-text Input pair with one `<PersonPicker variant="field">` in all modes (settings and preview), `projectKey = useAuthStore(activeJiraProject)`, `jiraBaseUrl` from the auth store (check how the row's parents get it; add a prop if the store does not hold it). `extraOptions` = the three placeholders, each label rendering the existing `PlaceholderChip` (preview mode, with `resolveAssignee(...).displayHint`) or the plain token (settings mode); `selectedOptionId = isPlaceholder ? row.assignee : undefined`; `onSelectOption(id)` → `onChange({ assignee: id })`; user pick → `onChange({ assignee: user.name })`. For the trigger: placeholder values use `triggerContent` = the PlaceholderChip/token; concrete usernames resolve display name + avatar via a `useQuery(['jira-user-by-name', jiraBaseUrl, name], fetchJiraUserByName)` with `staleTime: Infinity` (fallback to the raw username while loading/on null). No allowUnassign (the @unassigned option covers it). Respect `disabled={isDisabled}`. Remove the `assignees` prop from the interface and destructure.

2. `BulkCreateSubtasksModal.tsx`: delete the `allAssignees` query (373-390) and the `allAssignees`/`assignees` threading at 198, 207, 231, 716; drop unused imports (`JiraUser` if unused). `SubtaskTemplatesSection.tsx:81` passes no `assignees` — confirm it still type-checks.

3. `WatchedPersonPicker.tsx`: keep the component, its props, and its `PopoverTrigger` ("Showing:" + ChevronDown) exactly; replace the `PopoverContent` body, its own debounce/query, and the row markup with `<PersonPickerPanel open={open} projectKey={projectKey} jiraBaseUrl={jiraBaseUrl} value={value ? toPersonValue(value) : null} extraOptions={[{ id: 'me', label: `Me (${meDisplayName})`, avatar: <CachedAvatar url={meAvatarUrl} .../> }]} selectedOptionId={value === null ? 'me' : undefined} onSelectOption={() => handleSelect(null)} onChange={(u) => u && handleSelect(u)} placeholder="Search people…"/>` inside `PopoverContent`. Update the header doc comment.

4. `WorklogsPage.tsx`: delete the people query (455-463), `query`/`open`/`closeTimer` combobox state and handlers (`handleComboboxFocus/Blur/Change`, 618-635) and `filteredPeople` (695), and the input+`<ul>` block (856-885). Render `<PersonPicker variant="field" aria-label="Filter by person" emptyLabel="Filter by person" projectKey={activeJiraProject ?? undefined} jiraBaseUrl={jiraBaseUrl ?? ''} value={selectedUsername ? { name: selectedUsername, displayName: selectedDisplayName ?? selectedUsername } : null} onChange={(u) => u && handlePersonSelect(u)} contentClassName=.../>` in a `w-52` wrapper with the trigger sized to the header (h-7 text-xs — add a `size?: 'sm' | 'default'` prop to PersonPicker's field variant if needed, editing person-picker.tsx in this task). Keep `handlePersonSelect` (sets username, display name, `userTouchedFilter.current = true`) and saved-filter logic unchanged; remove any leftover references to the deleted state.

5. `WorklogsPage.test.tsx`: update the combobox tests (~325-490, ~1385) to open the picker trigger (`getByRole('button', { name: /filter by person/i })` or by label), type in the panel filter input, and click the person row; the existing `fetchAssignableUsers` mock (line 81) keeps serving results — assert it is called with the typed term. Keep every test's intent (placeholder text, selection updates the worklog query, saved filter load shows the name).

Run the full suite at the end (`npx vitest run`) since StandupNotesPage/StandupPageHeader tests also render WatchedPersonPicker; if person-picker.tsx got a `size` prop, re-run its test file.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx src/routes/dashboard/BulkCreateSubtasksModal.tsx src/routes/standup-notes/WatchedPersonPicker.tsx src/routes/worklogs/WorklogsPage.tsx src/routes/worklogs/WorklogsPage.test.tsx src/components/ui/person-picker.tsx</automated>
  </verify>
  <done>`grep -rn "user/assignable/search" src --include='*.ts*' | grep -v test` lists only `services/jira/users.ts`; `grep -rln "'assignable-users'" src` is empty; template rows, Standup, and Worklogs use the shared picker; full vitest suite, tsc, and biome (changed files) clean; one commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → Jira REST | user-typed search term sent as a query param to /user/assignable/search |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-mqh-01 | Tampering | fetchAssignableUsers URL building | mitigate | `encodeURIComponent` on query, projectKey and issueKey (issueKey was previously interpolated raw in FieldsSection) |
| T-mqh-02 | Information disclosure | useAssignableUserSearch query key | mitigate | PAT read inside queryFn via readSecret; never part of the query key |
| T-mqh-03 | Denial of service | per-keystroke search | mitigate | 200ms debounce + 60s staleTime cache per term; query enabled only while popover open |
</threat_model>

<verification>
- Issue detail sidebar assignee: unchanged look; assign, assign-to-me, unassign all work.
- Create Story / Create Subtask / Edit / Clone modals: assignee is the avatar picker; search finds a user not in the first 50/200.
- Bulk create subtasks + Settings → Subtask templates: rows pick placeholders or real people from the same picker.
- Standup "Showing:" and Worklogs "Filter by person" open the same panel.
- No remaining fetch-once `assignable-users` queries; `grep -rn "maxResults=200" src` shows no user-search hits.
</verification>

<success_criteria>
One shared PersonPicker drives all 7 person-selection sites; all searches are server-side and debounced; dead plain-picker code removed; full test suite, tsc, and biome on changed files pass; 3 atomic commits.
</success_criteria>

<output>
Create `.planning/quick/261105-mqh-universal-assignee-picker-everywhere/261105-mqh-SUMMARY.md` when done
</output>
