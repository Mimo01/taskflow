---
phase: quick-260519-eol-flag
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/fields.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/sprints.ts
  - taskflow/src/services/jira/backlog.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Flagged issues are visibly distinguishable in sprint view (yellow background + flag icon) and backlog view (yellow row + flag icon)"
    - "Right-clicking a sprint card or backlog row reveals a Flag/Unflag menu item that toggles the issue's flagged state"
    - "Toggling flag updates Jira via PUT /rest/api/2/issue/{key} with the configured flagged customfield and refreshes the affected lists optimistically"
    - "Issue detail sidebar shows a Flagged row with the current state and a button to flag/unflag the issue"
    - "Discovered flaggedFieldKey persists in settings and falls back to customfield_10021 when discovery does not return a match"
  artifacts:
    - path: "taskflow/src/services/jira/fields.ts"
      provides: "discoverCustomFields returns flaggedFieldKey alongside other custom field keys"
      contains: "flaggedFieldKey"
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "Persistent flaggedFieldKey with default customfield_10021 and setter"
      contains: "flaggedFieldKey"
    - path: "taskflow/src/services/jira.ts"
      provides: "setIssueFlagged(baseUrl, token, issueKey, flagged, fieldKey) helper using updateIssueField"
      contains: "setIssueFlagged"
    - path: "taskflow/src/routes/dashboard/TaskCard.tsx"
      provides: "Yellow background + Flag icon when issue is flagged; Flag/Unflag context-menu item that calls onToggleFlag"
      contains: "isFlagged"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Yellow row background + Flag icon when issue is flagged; Flag/Unflag context-menu item that calls onToggleFlag"
      contains: "isFlagged"
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "handleToggleFlag with optimistic update + rollback; wires onToggleFlag into TaskCard"
      contains: "handleToggleFlag"
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      provides: "handleToggleFlag with optimistic update for both backlog and sprint-stories caches; wires onToggleFlag into BacklogRow"
      contains: "handleToggleFlag"
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Flagged MetaRow with toggle button, using flaggedFieldKey through useFieldMutation"
      contains: "Flagged"
  key_links:
    - from: "taskflow/src/services/jira/sprints.ts"
      to: "Jira fields array (sprint stories query)"
      via: "field list includes flaggedFieldKey"
      pattern: "customfield_10021|flaggedFieldKey"
    - from: "taskflow/src/services/jira/backlog.ts"
      to: "Jira fields array (backlog + backlog-sprint-stories queries)"
      via: "field list includes flaggedFieldKey"
      pattern: "customfield_10021|flaggedFieldKey"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "taskflow/src/services/jira.ts setIssueFlagged"
      via: "handleToggleFlag mutation"
      pattern: "setIssueFlagged"
    - from: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      to: "taskflow/src/services/jira.ts setIssueFlagged"
      via: "handleToggleFlag mutation"
      pattern: "setIssueFlagged"
---

<objective>
Add Jira "Flagged" support to sprint view, backlog view, and issue detail. Flagged issues render with a yellow background and a flag icon in both list views; right-clicking opens a Flag/Unflag menu item; the issue detail sidebar gets a Flagged row with a toggle button.

Purpose: Surface impediments inline so the user can spot blocked work at a glance and toggle the flag without leaving the list.
Output: Discovered flaggedFieldKey threaded through queries + a setIssueFlagged helper + UI affordances on TaskCard, BacklogRow, and the IssueDetail sidebar.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/services/jira.ts
@taskflow/src/services/jira/types.ts
@taskflow/src/services/jira/fields.ts
@taskflow/src/services/jira/sprints.ts
@taskflow/src/services/jira/backlog.ts
@taskflow/src/stores/settings.store.ts
@taskflow/src/routes/dashboard/TaskCard.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
@taskflow/src/routes/dashboard/BacklogPage.tsx
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
@taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx

<interfaces>
<!-- Key types / contracts the executor will rely on. -->

From taskflow/src/services/jira.ts:
- `interface JiraIssue { id; key; fields: { summary; status; assignee; issuetype; ...; [key: string]: unknown } }` — index signature lets us read `issue.fields[flaggedFieldKey]` without casting.
- `updateIssueField(baseUrl, token, issueKey, fieldName, value): Promise<void>` — PUTs `{ fields: { [fieldName]: value } }`. Reuse this; do not invent a new endpoint helper.
- `fetchSprintStories(...)` builds `fields = "summary,status,assignee,issuetype,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking,duedate"`. The flag field must be appended here too.

From taskflow/src/services/jira/backlog.ts:
- `fetchBacklogIssues` and `fetchBacklogSprintStories` build their own field lists. Both need the flag field appended.

From taskflow/src/services/jira/fields.ts:
- `discoverCustomFields(baseUrl, token)` returns `{ storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, epicColorFieldKey }`. We extend the return type with `flaggedFieldKey: string` and detect it via `f.schema?.custom === 'com.pyxis.greenhopper.jira:gh-lexo-rank' || f.name === 'Flagged'`. The standard Jira "Flagged" customfield uses `custom: 'com.atlassian.jirafisheyeplugin:...'` in some installs — match by `f.name === 'Flagged'` as the primary signal, falling back to `customfield_10021`.

From taskflow/src/stores/settings.store.ts:
- Fields are added as a top-level string in `SettingsState`, with default + setter + persisted migration step. Mirror the existing `epicColorFieldKey` pattern exactly (including the migration block around line 393 that backfills the default for older persisted states).

From taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts:
- `useFieldMutation(issueKey, jiraBaseUrl)` already mutates arbitrary fields via `updateIssueField` with optimistic update + rollback, then invalidates `jira-issue-detail`, `jira-sprint-stories`, `jira-backlog-sprint-stories`, `jira-backlog-issues`, etc. Use this for the sidebar toggle by calling `mutation.mutate({ fieldName: flaggedFieldKey, value: <flagged|null> })`.

From taskflow/src/routes/dashboard/TaskCard.tsx:
- Existing ContextMenu wraps the card only when `onTransition` is provided. Extend so that `onToggleFlag` independently triggers ContextMenu rendering; both menu sections can coexist (Move to... + Flag/Unflag, separated by ContextMenuSeparator).

From taskflow/src/routes/dashboard/BacklogRow.tsx:
- Existing ContextMenu wraps the row only when `onMoveToSprint || onMoveToBacklog`. Extend the predicate to include `onToggleFlag`. Render a Flag/Unflag ContextMenuItem after the sprint-move group.
</interfaces>

<flagged-field-shape>
Jira represents the Flagged customfield as an array of `{ value: string }` objects. To FLAG: `value = [{ value: "Impediment" }]`. To UNFLAG: `value = null` (preferred — clears the field). To READ: an issue is flagged iff `Array.isArray(issue.fields[flaggedFieldKey]) && (issue.fields[flaggedFieldKey] as Array<unknown>).length > 0`.
</flagged-field-shape>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire flaggedFieldKey discovery, settings, fetch fields, and toggle helper</name>
  <files>
    taskflow/src/services/jira/fields.ts,
    taskflow/src/services/jira/types.ts,
    taskflow/src/stores/settings.store.ts,
    taskflow/src/services/jira.ts,
    taskflow/src/services/jira/sprints.ts,
    taskflow/src/services/jira/backlog.ts
  </files>
  <action>
    Add Flagged custom field plumbing end-to-end with no UI yet.

    1. `taskflow/src/services/jira/fields.ts`:
       - Extend the return type and `defaults` object of `discoverCustomFields` with `flaggedFieldKey: 'customfield_10021'`.
       - Inside the field loop, set `result.flaggedFieldKey = f.id` when `f.name === 'Flagged'` (case-sensitive — Jira's system label). Do NOT match on `schema.custom` because different Jira versions ship the Flagged field under different custom keys; matching on the display name is the documented approach for this field.

    2. `taskflow/src/services/jira/types.ts` (and the mirrored `discoverCustomFields` signature in `jira.ts` if one exists — grep first; do not duplicate the return type): add `flaggedFieldKey` to whichever shape currently lists `storyPointsFieldKey` etc. Search for the existing type with `grep -n "epicColorFieldKey" taskflow/src/services/jira/types.ts taskflow/src/services/jira.ts` and extend the same interface(s).

    3. `taskflow/src/stores/settings.store.ts`:
       - Add `flaggedFieldKey: string` to `SettingsState` next to `epicColorFieldKey`.
       - Add `setFlaggedFieldKey: (key: string) => void` to the actions interface.
       - Default to `'customfield_10021'` in the initial state.
       - Wire the setter as `setFlaggedFieldKey: (key) => set({ flaggedFieldKey: key })`.
       - In the persisted-state migration around line 393, add `if (s.flaggedFieldKey === undefined) s.flaggedFieldKey = 'customfield_10021';`.
       - If `discoverCustomFields` is consumed anywhere to hydrate settings (grep for `discoverCustomFields(` usages), also forward the new key into that setter call.

    4. `taskflow/src/services/jira.ts`:
       - Add exported helper `setIssueFlagged(baseUrl, token, issueKey, flagged: boolean, fieldKey = 'customfield_10021'): Promise<void>` that calls `updateIssueField(baseUrl, token, issueKey, fieldKey, flagged ? [{ value: 'Impediment' }] : null)`. Single line of logic plus the call.
       - In `fetchSprintStories` extend the `fields` template literal to append `,${flaggedFieldKey}`. Update the signature to accept an optional `flaggedFieldKey = 'customfield_10021'` parameter (default keeps existing callers working).
       - Also export an `isIssueFlagged(issue: JiraIssue, fieldKey: string): boolean` utility per the `<flagged-field-shape>` block in `<context>`. Place it next to the JiraIssue type. This util will be reused by TaskCard, BacklogRow, and FieldsSection.

    5. `taskflow/src/services/jira/sprints.ts`: no functional change here — but if `fetchSprintStories` lives in `jira.ts` only, leave sprints.ts alone. (Verified above: it does.)

    6. `taskflow/src/services/jira/backlog.ts`:
       - `fetchBacklogIssues`: add `flaggedFieldKey = 'customfield_10021'` parameter, include it in the deduped `fields` array.
       - `fetchBacklogSprintStories`: add `flaggedFieldKey = 'customfield_10021'` parameter, append `,${flaggedFieldKey}` to the `fields` template literal.
       - `fetchBacklogView`: same treatment — add the parameter and include the key in `issueFields` and `agileFields`.

    Do not modify any UI components in this task. Keep all signature changes backwards-compatible via default values so existing callers still type-check.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    `discoverCustomFields` returns `flaggedFieldKey`; settings store persists it with `customfield_10021` default and a migration backfill; `setIssueFlagged` and `isIssueFlagged` exist and are exported from `taskflow/src/services/jira.ts`; sprint stories + backlog issues + backlog-sprint-stories queries include the flag field in their `fields=` payload. `npx tsc --noEmit` passes without errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Render flag in sprint view + backlog view with right-click toggle</name>
  <files>
    taskflow/src/routes/dashboard/TaskCard.tsx,
    taskflow/src/routes/dashboard/BacklogRow.tsx,
    taskflow/src/routes/dashboard/SprintBoardTab.tsx,
    taskflow/src/routes/dashboard/BacklogPage.tsx
  </files>
  <action>
    Surface the flag visually on both lists and add Flag/Unflag context-menu entries with optimistic updates.

    1. `taskflow/src/routes/dashboard/TaskCard.tsx`:
       - Add props `isFlagged?: boolean` and `onToggleFlag?: () => void` to `TaskCardProps`.
       - Import `Flag` from `lucide-react`.
       - When `isFlagged`, the card root div gets a yellow tint: append `'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40'` to its `cn(...)` (after the existing classes so it wins specificity). Keep all the other layout classes intact.
       - In the top row (where the issue key + issue type render), prepend a `<Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />` icon when `isFlagged`. Place it before the issue key span so it sits left of the key, matching the standard Jira convention.
       - Extend the ContextMenu wrapping predicate: render the ContextMenu when `onTransition || onToggleFlag`. When `onToggleFlag` is provided, after the transitions group add a `<ContextMenuSeparator />` then a `<ContextMenuItem onClick={onToggleFlag}>` whose label is `isFlagged ? 'Unflag' : 'Flag'` and which renders the `Flag` icon. If `onTransition` is absent but `onToggleFlag` is present, only the Flag/Unflag item shows (skip the "Move to..." header in that branch).

    2. `taskflow/src/routes/dashboard/BacklogRow.tsx`:
       - Add props `isFlagged?: boolean` and `onToggleFlag?: (issueKey: string) => void` to `BacklogRowProps`.
       - Import `Flag` from `lucide-react`.
       - When `isFlagged`, override `rowClassName` to include `'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40'` (replace the existing `hover:bg-muted/30` only for flagged rows so the yellow stays visible on hover). Keep the focus styling untouched (`isFocused && 'bg-muted border-l-2 border-primary'` still applies on top).
       - In `RowCells` Summary cell, prepend a small `<Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />` when `isFlagged`. Pass `isFlagged` into `RowCells` as a new prop.
       - Extend the ContextMenu rendering predicate to `onMoveToSprint || onMoveToBacklog || onToggleFlag`. Append a `<ContextMenuSeparator />` and `<ContextMenuItem onClick={() => onToggleFlag?.(issue.key)}>{isFlagged ? 'Unflag' : 'Flag'}</ContextMenuItem>` (with the Flag icon) after the SprintMoveMenuItems block. When `onToggleFlag` is the only handler provided, the menu still renders with just the Flag/Unflag item.

    3. `taskflow/src/routes/dashboard/SprintBoardTab.tsx`:
       - Pull `flaggedFieldKey` from `useSettingsStore()` alongside the other field keys.
       - Add the import of `setIssueFlagged` and `isIssueFlagged` from `@/services/jira`.
       - Add a `handleToggleFlag(issueKey: string)` function mirroring `handleTransition`'s optimistic pattern: read the current flag from `localIssues`, optimistically toggle `i.fields[flaggedFieldKey] = newValue ? [{ value: 'Impediment' }] : null`, then `await setIssueFlagged(jiraBaseUrl!, jiraToken!, issueKey, newFlagged, flaggedFieldKey)`. On error, rollback to the previous value and set a `cardErrors` entry similar to the transition rollback. On success, invalidate `['jira-sprint-stories']` and `['jira-sprint-subtasks']`.
       - Pass `isFlagged={isIssueFlagged(card, flaggedFieldKey)}` and `onToggleFlag={() => handleToggleFlag(card.key)}` into every `<TaskCard ... />` render site (there are two — the virtualized branch and the fallback branch). Do the same for the story header card if TaskCard is also used for stories (verify the call sites in the file).
       - Update `fetchSprintStories` call to pass `flaggedFieldKey` as the new optional parameter so the field is included in the query.
       - Update the React Query key for `'jira-sprint-stories'` to include `flaggedFieldKey` so it refetches if the key changes.

    4. `taskflow/src/routes/dashboard/BacklogPage.tsx`:
       - Pull `flaggedFieldKey` from `useSettingsStore()`.
       - Update calls to `fetchBacklogIssues` and `fetchBacklogSprintStories` to pass `flaggedFieldKey`, and add it to both query keys so cache buckets stay correct.
       - Add `handleToggleFlag(issueKey: string)` that:
         a. Reads the current flagged state from `allIssues` (search by key across `sprintStories ?? []` + `backlogIssues ?? []`).
         b. Optimistically updates BOTH `['jira-backlog-issues', ...]` and `['jira-backlog-sprint-stories', ...]` cached lists via `queryClient.setQueryData` — map over the cached array and replace `fields[flaggedFieldKey]` on the matching issue.
         c. Awaits `setIssueFlagged(jiraBaseUrl!, jiraToken!, issueKey, newFlagged, flaggedFieldKey)`.
         d. On success invalidates both cache keys plus `['jira-sprint-stories']` and `['jira-issue-detail']`.
         e. On error rolls back by restoring the previous cached arrays (use the same pattern as `confirmMoveToSprint`).
       - Pass `isFlagged` and `onToggleFlag={handleToggleFlag}` into every `<BacklogRow .../>` invocation via the `VirtualizedBacklogTable` props (add new props, thread them through).

    Notes: do not add new external dependencies. The Flag icon already ships with `lucide-react` (verified). Optimistic-update patterns already exist in both files — copy the structure verbatim rather than inventing a new approach.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | head -40 && npx vitest run src/routes/dashboard/TaskCard src/routes/dashboard/BacklogRow src/routes/dashboard/SprintBoardTab src/routes/dashboard/BacklogPage 2>&1 | tail -40</automated>
  </verify>
  <done>
    TaskCard renders the yellow background + Flag icon when `isFlagged`; BacklogRow does the same for the row; right-click on either reveals a Flag/Unflag item that calls the parent handler. SprintBoardTab and BacklogPage both wire `flaggedFieldKey` into their queries and run optimistic-update toggles that roll back on PUT failure. Existing tests in the four files still pass; `tsc --noEmit` is clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add Flagged row to issue detail sidebar</name>
  <files>
    taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx,
    taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx,
    taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
  </files>
  <action>
    Show a Flagged row in the issue detail sidebar with an inline toggle.

    1. `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx`:
       - Read `flaggedFieldKey` from `useSettingsStore()` (alongside `epicColorFieldKey`).
       - Pass `flaggedFieldKey` into `<FieldsSection .../>`. Extend the `FieldsSectionProps` interface in FieldsSection.tsx.

    2. `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx`:
       - Import `Flag` from `lucide-react` and `isIssueFlagged` from `@/services/jira`.
       - Add `flaggedFieldKey: string` to `FieldsSectionProps` and destructure it.
       - Compute `const isFlagged = isIssueFlagged(issue as unknown as JiraIssue, flaggedFieldKey);` (or read the field directly and check `Array.isArray && length > 0` — JiraIssueDetail extends the same `fields` index signature, so reuse the util to keep the source of truth in one place).
       - Render a new `<MetaRow label="Flagged">` placed immediately after the existing Priority row (the row order should match Jira's standard: Status, Priority, Flagged, then everything else). Inside the row:
         ```tsx
         <button
           type="button"
           onClick={() =>
             mutation.mutate({
               fieldName: flaggedFieldKey,
               value: isFlagged ? null : [{ value: 'Impediment' }],
             })
           }
           className="inline-flex items-center gap-1 rounded px-1 -ml-1 hover:bg-accent cursor-pointer text-left"
           title={isFlagged ? 'Unflag this issue' : 'Flag this issue as an impediment'}
         >
           {isFlagged ? (
             <>
               <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />
               <span>Flagged (Impediment)</span>
             </>
           ) : (
             <span className="text-muted-foreground">— Add flag</span>
           )}
         </button>
         ```
         (Inline the actual JSX directly; do not paste the snippet as a string literal.)
       - When `mutation.isError` is true and the last mutation targeted `flaggedFieldKey`, show the existing `'Save failed — changes reverted'` line below the button. The mutation already handles optimistic update + rollback via `useFieldMutation`.

    3. `taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx`:
       - Add one test for unflagged state ("renders Add flag when issue not flagged"): assert the button label.
       - Add one test for flagged state ("renders Flagged (Impediment) when customfield is set"): seed `issue.fields.customfield_10021 = [{ value: 'Impediment' }]` and assert the icon-bearing button content.
       - Add one click test: clicking the toggle button calls `mutation.mutate` with `{ fieldName: 'customfield_10021', value: [{ value: 'Impediment' }] }` for the unflagged → flagged direction. Use the existing test scaffolding/mocks in this file rather than introducing a new harness.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | head -40 && npx vitest run src/routes/dashboard/issue-detail/FieldsSection 2>&1 | tail -40</automated>
  </verify>
  <done>
    Issue detail sidebar shows a Flagged MetaRow that toggles via `useFieldMutation`. Three new tests pass. `tsc --noEmit` is clean and the FieldsSection vitest run is green.
  </done>
</task>

</tasks>

<verification>
- Run `cd taskflow && npx tsc --noEmit` — must be error-free.
- Run `cd taskflow && npx vitest run` for the four affected test paths listed in the task verify commands — all must pass.
- Manual smoke (not required for autonomous completion, but documented): open sprint board with a flagged issue → background is yellow, flag icon visible; right-click → Flag/Unflag visible; toggle and watch list update + Jira issue update. Repeat on backlog. Open issue detail → Flagged row reflects state and toggles round-trip.
</verification>

<success_criteria>
- All five `must_haves.truths` are observable in the running app.
- All listed artifacts contain the named exports/identifiers.
- Type check and the relevant vitest suites are green.
- No new runtime dependencies introduced (only `lucide-react` `Flag`, already in use elsewhere).
</success_criteria>

<output>
Create `.planning/quick/260519-eol-in-sprint-view-and-backlog-view-i-want-t/260519-eol-SUMMARY.md` when done, recording: files touched, the chosen `flaggedFieldKey` discovery heuristic, and any deviations from this plan.
</output>
