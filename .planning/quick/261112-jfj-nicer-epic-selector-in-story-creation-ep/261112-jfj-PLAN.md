---
phase: quick-261112-jfj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/epics.ts
  - taskflow/src/services/jira/epics.test.ts
  - taskflow/src/components/ui/use-epic-search.ts
  - taskflow/src/components/ui/epic-picker.tsx
  - taskflow/src/components/ui/epic-picker.test.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
  - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
autonomous: true
requirements: [QUICK-261112-jfj]

must_haves:
  truths:
    - "In the create/edit modal, the Epic Link field is a Popover picker with a 'Search epics…' input, a 'No epic' row at the top, and one-line rows that show a coloured epic pill (name, falling back to summary) with the muted key right-aligned and a check on the selected row (D: option row content)"
    - "Typing in the picker runs a debounced SERVER-SIDE Jira search limited to open epics (statusCategory != Done) in the project. It matches name/summary text or the key. An empty query lists the most recently updated open epics (D: search scope)"
    - "The trigger shows the correct coloured pill even when the linked epic is Done or missing from the results, because it resolves the epic itself via ['jira-issue-name', key, base] (D: search scope)"
    - "On a story's detail sidebar, clicking the Epic row value opens the same EpicPicker. Choosing an epic or 'No epic' changes or removes the link through useFieldMutation, with an optimistic update. An 'Open <KEY>' footer item navigates to the epic (D: sidebar interaction)"
    - "The sidebar Epic row appears for stories only, never for epics or subtasks"
    - "After a change, the epic stories sections (['jira-epic-stories']) and epic progress queries refresh"
  artifacts:
    - path: "taskflow/src/services/jira/epics.ts"
      provides: "searchOpenEpics, fetchEpicSummary, buildEpicSearchJql, EpicOption type"
      exports: ["searchOpenEpics", "fetchEpicSummary", "buildEpicSearchJql", "EpicOption"]
    - path: "taskflow/src/components/ui/epic-picker.tsx"
      provides: "Shared EpicPicker (inline + field variants) and EpicPill"
      exports: ["EpicPicker", "EpicPill"]
    - path: "taskflow/src/components/ui/use-epic-search.ts"
      provides: "Debounced server search hook keyed ['jira-epic-search', projectKey, base, debouncedQuery]"
  key_links:
    - from: "taskflow/src/components/ui/use-epic-search.ts"
      to: "searchOpenEpics"
      via: "useQuery queryFn"
      pattern: "jira-epic-search"
    - from: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      to: "mutation.mutate({ fieldName: epicLinkFieldKey"
      via: "EpicPicker onChange"
      pattern: "fieldName: epicLinkFieldKey"
    - from: "taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx"
      to: "EpicPicker"
      via: "variant='field' with id='modal-epic-link'"
      pattern: "<EpicPicker"
    - from: "taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts"
      to: "['jira-epic-stories']"
      via: "onSettled invalidation"
      pattern: "jira-epic-stories"
---

<objective>
Replace the hand-rolled Epic Link combobox in the create/edit modal with a shared, server-searching EpicPicker. Use the same picker to make the story detail sidebar's Epic row editable.

Purpose: the current selector filters one capped 50-item page on the client (the fetch-once page-cap pitfall), looks plain, and the sidebar can't change epics at all.

Output:
- services/jira/epics.ts with tests;
- components/ui/use-epic-search.ts;
- components/ui/epic-picker.tsx with tests;
- the picker wired into CreateEditIssueModal and FieldsSection;
- invalidations so related views refresh after a change.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261112-jfj-nicer-epic-selector-in-story-creation-ep/261112-jfj-CONTEXT.md
@.planning/quick/261112-jfj-nicer-epic-selector-in-story-creation-ep/261112-jfj-RESEARCH.md

Repo root (.planning, git): /Users/mimo/Documents/Projects/taskflow. The app is in /Users/mimo/Documents/Projects/taskflow/taskflow: run npm, vitest and biome from there.

The pre-commit hook runs the full vitest suite plus lint. Commit the RED and GREEN steps of each tdd task together as ONE commit. Use `git commit -- <paths>` and check `git log -1 --stat` afterwards, because a failed hook leaves files staged.

Templates (read once; copy the patterns):
@taskflow/src/components/ui/person-picker.tsx
@taskflow/src/components/ui/use-assignable-user-search.ts
@taskflow/src/components/ui/person-picker.test.tsx
@taskflow/src/services/jira/users.ts

Existing epic plumbing:
- CreateEditIssueModal.tsx L395-490: the hand-rolled combobox.
- useCreateEditQueries.ts L107-126: the ['epics', projectKey] capped fetch.
- useCreateEditForm.ts: epicOpen/epicFilter.
- useIssueMutations.ts L79 and L190-192: epic link write.
- FieldsSection.tsx L832-851: read-only pill.
- IssueDetailSidebar.tsx L56-75: the ['jira-issue-name'] epic fetch.
- useFieldMutation.ts: onSettled invalidations.
- lib/epicColors.ts `epicColorToTailwind`.
- services/jira.ts `buildBodySearchJql` (~L1740-1764, tokenise/escape pattern) and `searchJiraForLink` (~L1617, key-shaped term pattern).

HARD CONSTRAINT: do NOT modify `fetchEpicsBasic` or the ['jira-epics-basic'] key in services/jira.ts. Sidebar, Backlog, SprintBoard, EpicsPage and main.tsx all share it.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Epic search fetcher + debounced search hook</name>
  <files>taskflow/src/services/jira/epics.ts, taskflow/src/services/jira/epics.test.ts, taskflow/src/components/ui/use-epic-search.ts</files>
  <behavior>
    - buildEpicSearchJql('PROJ', '') returns `project = "PROJ" AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`
    - buildEpicSearchJql('PROJ', 'pay rev') ANDs a text clause for each token. The LAST token gets a `*` suffix. The open-epic and project scope is still present, and it is ordered by updated DESC.
    - A term containing `"` or `\` is escaped. JQL reserved characters become token separators. The raw input never appears unescaped.
    - A key-shaped term ('PROJ-12') or a bare number ('12' → 'PROJ-12') ORs in `key = "PROJ-12"` alongside the text clause, inside the open-epic scope.
    - searchOpenEpics maps issues to EpicOption { key, name: fields[epicNameFieldKey] ?? summary, summary, color: fields[epicColorFieldKey] ?? null }. It tolerates a missing `issues` array (returns []).
    - When searchOpenEpics gets !resp.ok and the JQL had a key clause, it retries once without the key clause.
  </behavior>
  <action>
Create services/jira/epics.ts as a subpath module, following the services/jira/users.ts pattern so tests can mock it. Do not add anything to the legacy jira.ts. Use apiFetch('jira', …) with a Bearer token, like the existing fetchers.

Exports:
- `type EpicOption = { key: string; name: string; summary: string; color: string | null }`.
- `buildEpicSearchJql(projectKey, query, opts?: { withKey?: boolean })`:
  - pure function;
  - escape the project key too;
  - tokenise and escape exactly as buildBodySearchJql does;
  - use `text ~ "token"` clauses, with the last token `*`-suffixed.
- `searchOpenEpics(base, token, projectKey, query, { epicNameFieldKey, epicColorFieldKey, maxResults = 30 })`:
  - GET /rest/api/2/search with params jql, fields=summary,{name},{color} and maxResults (URL-encoded);
  - when the query had a key clause and the request fails, retry once without it (assumption A2);
  - otherwise return [] on failure.
- `fetchEpicSummary(base, token, key, epicNameFieldKey, epicColorFieldKey)`:
  - move the queryFn body out of IssueDetailSidebar.tsx L60-70 unchanged;
  - same URL and the same return shape `{ fields: { summary, [k]: unknown } } | null`, so the ['jira-issue-name'] cache shape stays identical.

Create components/ui/use-epic-search.ts. Model it line-for-line on use-assignable-user-search.ts:
- signature `useEpicSearch({ projectKey, query, open })`;
- 200ms debounce;
- key ['jira-epic-search', projectKey, base, debouncedQuery];
- `enabled: open && !!projectKey && !!base`;
- staleTime 60_000;
- readSecret('jira-pat') inside the queryFn only, never in the key;
- read base from the auth store, and epicNameFieldKey/epicColorFieldKey via useSettingsStore((s) => s.x) selectors. Do not call getState() in render (React Compiler module-read pitfall).

Tests in epics.test.ts cover the JQL builder and the mapping/retry behaviour, with apiFetch mocked. Per the server-side search decision, there is no client-side filtering anywhere.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira/epics.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>The epics.test.ts cases pass. tsc is clean. fetchEpicsBasic and ['jira-epics-basic'] are untouched (`git diff --stat src/services/jira.ts` is empty).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared EpicPicker component + create/edit modal swap</name>
  <files>taskflow/src/components/ui/epic-picker.tsx, taskflow/src/components/ui/epic-picker.test.tsx, taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx, taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts, taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts, taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts</files>
  <behavior>
    - Typing 'pay' calls searchOpenEpics with 'pay' after the debounce (server term, not a client filter)
    - Rows render the epic name inside a pill plus the muted key. The selected row has aria-selected=true and a check icon. 'No epic' is first and is checked when value is null.
    - Clicking an epic row calls onChange(EpicOption) and closes the popover. Clicking 'No epic' calls onChange(null).
    - ArrowDown + Enter selects. Index 0 is 'No epic' and epic rows follow.
    - Escape closes without calling onChange
    - Loading shows 'Searching…'. An empty result shows 'No open epics match'.
    - When value is a key that is not in the results, the trigger renders that epic's resolved name (from fetchEpicSummary), not the bare key
    - When openAction is provided, a footer item renders. Clicking it calls onSelect and closes the popover.
  </behavior>
  <action>
Create components/ui/epic-picker.tsx, modelled on person-picker.tsx (Popover + Panel split; the panel resets query/activeIndex when it closes).

EpicPill:
- small exported component `EpicPill({ name, epicKey, color, className? })`;
- uses epicColorToTailwind(color, epicKey);
- classes `inline-flex min-w-0 items-center rounded border px-1.5 py-0.5 text-xs font-medium`, with a `truncate` inner span so a long name stays on one line.

EpicPicker props:
- `variant: 'inline' | 'field'`;
- `value: string | null` (the epic key);
- `onChange(epic: EpicOption | null)`;
- `projectKey`;
- `id`, `aria-label`, `triggerTestId`, `disabled`;
- `openAction?: { label: string; onSelect: () => void }`;
- `footer?: ReactNode` (error text).

Trigger:
- Resolve the current epic with useQuery(['jira-issue-name', value, base]) and queryFn fetchEpicSummary, `enabled: !!value && !!base`, staleTime 60_000. This is the same key and shape as IssueDetailSidebar, so the cache is shared.
- Prefer the resolved data, and fall back to the matching search row, then the bare key.
- The trigger shows an EpicPill when there is a value, and a muted 'No epic' otherwise.
- Inline trigger classes match the sidebar Sprint/Assignee rows: `hover:bg-accent rounded px-1 -ml-1 cursor-pointer`. If a caret is added, it trails inside the trigger with opacity only, so there is no layout shift.
- Field variant classes and the ChevronDown come from PersonPicker's field trigger.

Popup and panel:
- PopoverContent `align="start"`, className `w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-2`.
- Panel layout from top to bottom: Search icon + Input placeholder 'Search epics…' (autofocus); list `max-h-64 overflow-y-auto` with role=listbox; then the 'No epic' row; then one row per epic (the row content is locked):
  - an EpicPill with the name;
  - an `ml-auto shrink-0 text-xs text-muted-foreground` key span;
  - a leading fixed-width Check slot, so rows don't shift when the check appears.
- Below the list, the optional openAction as a separated footer item ('Open PROJ-120'), then the footer slot.
- Keyboard handling uses the same handleKeyDown pattern as PersonPickerPanel. Escape is left to Popover.

Tests: epic-picker.test.tsx copies the person-picker.test.tsx structure. Mock @/services/stronghold and @/services/jira/epics, and use a fresh QueryClient.

Modal swap (CreateEditIssueModal.tsx L395-490):
- Replace the hand-rolled combobox with `<EpicPicker variant="field" id="modal-epic-link" value={state.epicLinkKey} projectKey={projectKey} onChange={(e) => dispatch set epicLinkKey to e?.key ?? null} />`.
- Keep the `<label htmlFor="modal-epic-link">Epic Link</label>` text and wrapper; CreateEditIssueModal.test.tsx asserts the label.
- Keep the `!isSubtask` gating.

Remove the dead pieces:
- the ['epics', projectKey] query in useCreateEditQueries.ts (its only consumer), together with `epics` in its return value and in the modal destructure;
- the `epicOpen`/`epicFilter` reducer fields and actions in useCreateEditForm.ts. Keep `epicLinkKey` and its reset when the type changes.

useIssueMutations.ts: in both the create and the edit onSuccess, add `queryClient.invalidateQueries({ queryKey: ['jira-epic-stories'] })`, so the epic's Stories section shows the new or re-parented story. Leave the existing epic-link write lines (L79, L190-192) unchanged.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/epic-picker.test.tsx src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/dashboard/create-edit-issue && npx tsc --noEmit -p . && test "$(grep -c "'epics', projectKey" src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts)" = "0"</automated>
  </verify>
  <done>
- The EpicPicker tests pass.
- The modal tests pass.
- tsc is clean.
- The modal renders EpicPicker. No epicFilter/epicOpen remain (`grep -rn "epicFilter\|epicOpen" src/routes/dashboard/create-edit-issue` is empty). The ['epics', projectKey] query is gone.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Editable Epic row in the story detail sidebar</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx, taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx, taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts</files>
  <behavior>
    - A Story renders the trigger data-testid="epic-edit". An Epic and a Sub-task do not (extend the existing it.each near L361).
    - Selecting the epic row PROJ-9 calls mutation.mutate({ fieldName: 'customfield_10014', value: 'PROJ-9' })
    - Selecting 'No epic' calls mutation.mutate({ fieldName: 'customfield_10014', value: null })
    - The 'Open PROJ-9' footer item calls onOpenIssue('PROJ-9') when an epic is set, and is absent when there is none
    - The trigger is still the same mounted element after rerender flips epicLink from 'PROJ-9' to null (optimistic-unmount trap)
  </behavior>
  <action>
FieldsSection.tsx Epic row (L832-851), per the sidebar-interaction decision:
- Keep the `isStory` gate.
- ALWAYS render `<EpicPicker variant="inline" triggerTestId="epic-edit" aria-label="Change epic" value={epicLink} projectKey={f.project?.key} … />` inside the MetaRow. Never branch on `epicLink ? … : '—'`: the optimistic patch flips epicLink and would unmount the picker in the middle of the write (optimistic-mark-unmount memory).
- openAction is `{ label: \`Open ${epicLink}\`, onSelect: () => onOpenIssue?.(epicLink) }` when epicLink is set, undefined otherwise.
- footer: the same `mutation.isError && mutation.variables?.fieldName === epicLinkFieldKey` error text style used by the other rows.
- onChange(epic):
  1. If epic is not null, first seed the pill cache with `queryClient.setQueryData(['jira-issue-name', epic.key, jiraBaseUrl], { fields: { summary: epic.summary, [epicNameFieldKey]: epic.name, [epicColorFieldKey]: epic.color } })`, so the optimistic pill shows its colour immediately. FieldsSection already has queryClient and jiraBaseUrl in scope or reachable; reuse what it uses for its other invalidations.
  2. Then call `mutation.mutate({ fieldName: epicLinkFieldKey, value: epic?.key ?? null })`.
  Remove the now-unused epicName/epicColor derivations only if nothing else reads them. Leave the epics-only Color row unchanged.

The write goes through the field PUT (updateIssueField) via the existing useFieldMutation path. Do NOT pre-build the Agile /epic/{key}/issue fallback; it is only needed if UAT shows the PUT failing (research A1).

IssueDetailSidebar.tsx: replace the inline epic queryFn with fetchEpicSummary from services/jira/epics. Keep the key, enabled and staleTime the same.

useFieldMutation.ts onSettled: add prefix invalidations for ['jira-epic-stories'], ['jira-epic-worklogs'] and ['jira-epic-status-history'], unconditionally, next to the existing ['jira-epics-basic'] line. This mirrors parentCompletion.ts invalidateAfterTransition and refreshes the old and new epic's Stories sections and progress.

FieldsSection.test.tsx: add the behavior tests above. Mock @/services/jira/epics; searchOpenEpics returns [{ key: 'PROJ-9', name: 'Payments', summary: 'Payments', color: 'ghx-label-4' }]. Pass a mutation mock with a spied mutate, the way the existing tests do.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/components/ui/epic-picker.test.tsx && npx tsc --noEmit -p . && npm test && npx biome check src/services/jira/epics.ts src/services/jira/epics.test.ts src/components/ui/epic-picker.tsx src/components/ui/epic-picker.test.tsx src/components/ui/use-epic-search.ts src/routes/dashboard/create-edit-issue src/routes/dashboard/issue-detail/FieldsSection.tsx src/routes/dashboard/issue-detail/FieldsSection.test.tsx src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx src/routes/dashboard/issue-detail/useFieldMutation.ts</automated>
  </verify>
  <done>
- The sidebar Epic row is an always-mounted EpicPicker for stories only. Selecting or clearing calls mutate with epicLinkFieldKey. The Open footer navigates.
- useFieldMutation invalidates ['jira-epic-stories'].
- The full vitest suite passes.
- biome reports no new diagnostics in the touched files: gate on "no NEW files flagged", never an absolute count.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user search text → Jira JQL | Free text typed in the picker is embedded in a JQL query |
| app → Jira REST | The PAT-authenticated search, issue GET and field PUT |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jfj-01 | Tampering | buildEpicSearchJql | mitigate | Tokenise, turn reserved characters into separators and escape `"`/`\` per token, as buildBodySearchJql does. Quote and escape the project key. Unit tests assert that the raw input never appears unescaped. |
| T-jfj-02 | Information disclosure | use-epic-search / epic-picker queries | mitigate | readSecret('jira-pat') runs only inside the queryFn. The token never goes into a query key or a log. |
| T-jfj-03 | Elevation | Epic link PUT | accept | Jira enforces edit permission server-side. A failure surfaces through the existing mutation error footer and rollback. |
</threat_model>

<verification>
- `npx vitest run src/services/jira/epics.test.ts src/components/ui/epic-picker.test.tsx src/routes/dashboard/issue-detail src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/dashboard/create-edit-issue` passes
- `npm test` passes (full suite; the pre-commit hook runs it as well)
- `git diff --stat src/services/jira.ts` is empty (shared fetchEpicsBasic untouched)
- `grep -rn "jira-epic-stories" src/routes/dashboard/issue-detail/useFieldMutation.ts src/routes/dashboard/create-edit-issue/useIssueMutations.ts` shows hits in both files
</verification>

<success_criteria>
- The create/edit modal uses a server-searching EpicPicker with coloured pill rows, a muted key, a check, 'No epic' and 'Search epics…'.
- The story sidebar Epic row opens the same picker. Users can set, change or clear the epic, with an optimistic pill and an 'Open KEY' footer.
- Only open epics are searched. A Done or off-list linked epic still renders correctly.
- No changes to fetchEpicsBasic or ['jira-epics-basic'].
</success_criteria>

<output>
Create `.planning/quick/261112-jfj-nicer-epic-selector-in-story-creation-ep/261112-jfj-SUMMARY.md` when done
</output>
