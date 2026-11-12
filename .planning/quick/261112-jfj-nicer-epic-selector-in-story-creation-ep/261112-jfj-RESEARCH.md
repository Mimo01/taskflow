# Quick 261112-jfj: Shared EpicPicker (create modal + story sidebar) - Research

**Researched:** 2026-11-12
**Domain:** In-app React UI and Jira Server/DC REST. No new packages.
**Confidence:** HIGH for codebase findings. MEDIUM for Jira write behaviour (not probed live).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- One-line rows: the epic shown as the coloured pill (same `epicColorToTailwind` styling as the sidebar Epic pill) holding the epic name (Epic Name field, falling back to summary), with the muted epic key right-aligned.
- A check mark on the selected row. A "No epic" row at the top.
- A search input at the top of the popup ("Search epics…").
- The same component in both the create modal and the sidebar: one shared EpicPicker, like components/ui/person-picker.tsx.
- Only open epics (statusCategory != Done) in the project.
- Typing runs a SERVER-SIDE Jira search (debounced, matching key or text), not a client filter over a single capped page. An empty query shows the most recently updated open epics.
- The search response must include name and colour (epicNameFieldKey, epicColorFieldKey).
- If the currently linked epic is Done or not in the results, the trigger still renders it correctly by resolving its own data.

### Claude's Discretion (chosen in CONTEXT)
- Sidebar: clicking the Epic row value opens the picker. The trigger shows the coloured pill, or a muted "No epic" when empty. A footer item "Open <KEY>" appears when an epic is set. "No epic" removes the link. Use an optimistic update plus invalidations. Stories only.
- Popup size, keyboard navigation, debounce timing, loading and empty states ("No open epics match").
- Build on Popover-based autocomplete, not Base UI Select.

### Deferred Ideas
None.
</user_constraints>

## Summary

Model EpicPicker one-to-one on `PersonPicker`. That component is a Base UI `Popover` wrapping a `*Panel`. A separate `use-*-search` hook debounces the term (200ms) into a `useQuery` key, and the PAT is read inside the queryFn.

No code in the app changes an epic today, apart from the edit modal. That modal does a plain field PUT through `bulkUpdateIssue` (`useIssueMutations.ts:190-192`, `services/jira.ts:3000`). The repo never calls the Agile `/epic/{key}/issue` endpoints (grep: zero hits).

The sidebar can reuse `useFieldMutation` unchanged for the write: `fieldName = epicLinkFieldKey`, `value = key | null`. Two things must be added on top of it:
1. Invalidate `['jira-epic-stories']`. `useFieldMutation` does not do this today.
2. Seed `['jira-issue-name', newKey, base]` so the new pill doesn't flash as a bare key.

**Primary recommendation:**
- Create `components/ui/epic-picker.tsx`, `components/ui/use-epic-search.ts` and `services/jira/epics.ts` (`searchOpenEpics`, `fetchEpicSummary`) under a NEW query key.
- Do not touch `fetchEpicsBasic` or `['jira-epics-basic']`.

## 1. PersonPicker pattern (template to copy)

| Piece | Where | Notes |
|---|---|---|
| Debounced server search hook | `components/ui/use-assignable-user-search.ts:20-48` | `useState(debounced)` + `setTimeout` 200ms; key `['jira-assignable-users', scope, base, debouncedQuery]`; `enabled: open && …`; `staleTime 60_000`; `readSecret('jira-pat')` inside queryFn, never in the key. |
| Panel (body) | `person-picker.tsx:52-238` | Resets `query`/`activeIndex` when `open` turns false (L72-77). ArrowUp/Down/Enter in `handleKeyDown` on the Input (L92-104). Escape is left to Popover. `rowBase` classes L115-116. List `max-h-64 overflow-y-auto` (L172). Loading and empty text L155-160. |
| Wrapper | `person-picker.tsx:254-320` | `variant: 'inline' \| 'field'`. Field trigger classes match SelectTrigger (L291-294). `PopoverContent className="w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-2"` (L304-310). Closes on select by wrapping `onChange` (L313-316). |
| Popover primitive | `components/ui/popover.tsx` | Base UI `@base-ui/react/popover`. It already works inside the create Dialog: the PersonPicker field variant sits at `CreateEditIssueModal.tsx:495`. |
| Tests | `components/ui/person-picker.test.tsx` | Mocks `@/services/stronghold`, `@/services/jira/users` (the fetcher module) and a fresh QueryClient. Cases: debounce→server term (L72), click selects+closes (L93), keyboard ArrowDown+Enter (L156), Escape no-onChange (L167), loading/empty (L177). Copy this structure for `epic-picker.test.tsx`, mocking `@/services/jira/epics`. |

**EpicPicker shape (recommended):**
- `EpicPicker({ variant, value: string | null, onChange(epic: EpicOption | null), projectKey, jiraBaseUrl, footer?, triggerTestId, id, aria-label, disabled })`.
- `EpicOption = { key, name, summary, color }`.
- Keyboard index 0 is "No epic". The epic rows follow. Add `aria-selected` and a `Check` icon (lucide) on the row whose key equals `value`. For the "No epic" row the check shows when `value === null`.
- Put an `ml-auto` muted key span on each row, like the username span at `person-picker.tsx:194-196`. Inside the pill, use `truncate min-w-0` so long names never wrap ([memory: one row = one line]).
- Field and key settings: read `epicNameFieldKey`/`epicColorFieldKey` with `useSettingsStore((s) => s.x)` selectors in the hook/component. Never call `getState()` in render ([React Compiler module-read pitfall]).

## 2. Current epic plumbing

**Create/Edit modal**
- Local state: `epicLinkKey`, `epicOpen`, `epicFilter` in the form reducer (`useCreateEditForm.ts:18,50-52,143-145,192`). The type switch resets `epicLinkKey` (L190-192).
- UI: a hand-rolled combobox (`CreateEditIssueModal.tsx:395-489`). It uses an onBlur `setTimeout` close and a client filter over `epics`.
- Data: `useCreateEditQueries.ts:107-126`, key `['epics', projectKey]`, `maxResults=50`, `fields=summary,status`. This is exactly the capped fetch-once pitfall. It is the only user of that key, so it can be deleted outright (also remove `epics` from the return at L165 and the destructure at Modal L151).
- Write on create: `options[epicLinkFieldKey] = state.epicLinkKey` (`useIssueMutations.ts:79`). Write on edit: `fields[epicLinkFieldKey] = state.epicLinkKey` (L190-192). The edit path already sends `null` to clear the link.
- After the swap, `epicOpen`/`epicFilter` reducer fields are dead and can be removed. The picker owns its own open state.
- Create `onSuccess` (L147-153) and edit `onSuccess` (L237-246) do NOT invalidate `['jira-epic-stories']`. Add a prefix invalidation in both, so an epic's Stories section shows a newly created or re-parented story.

**Sidebar**
- `IssueDetailSidebar.tsx:56-75` derives `epicLink` and fetches `epicIssue` under `['jira-issue-name', epicLink, base]`, with `fields=summary,{epicName},{epicColor}`. This key is used ONLY here (grep), so seeding it is safe if the shape `{ fields: { summary, [nameKey], [colorKey] } }` is kept.
- `FieldsSection.tsx:148` gives `epicLink`, L543-545 gives `epicName`, and L832-851 renders the read-only pill (`onOpenIssue(epicLink)`). Gating is `isStory` (L143-145). Keep it.
- `useFieldMutation.ts:28-98`:
  - `mutationFn` falls through to `updateIssueField` (single-field PUT) for any field except flagged and assignee.
  - `onMutate` optimistically sets `fields[fieldName] = value` on `['jira-issue-detail', key, base]`. `onError` rolls back.
  - `onSettled` invalidates: issue detail, the lightweight issue, `['jira-subtask-enrichment']`, gh-all-data and gh-backlog (board scoped), `['jira-epics-basic']`, fixversion and version counts, and `['jira-issues']`.
  - It is **missing `['jira-epic-stories']`**, which is needed so the old and new epic's stories lists refresh.
  - It also lacks `['jira-epic-worklogs']` / `['jira-epic-status-history']` (epic progress). Add all three by prefix. Either do it unconditionally, as `invalidateAfterTransition` in `services/jira/parentCompletion.ts:121-139` already does for epic-stories, or only when `fieldName === epicLinkFieldKey`.
- Sidebar call: `mutation.mutate({ fieldName: epicLinkFieldKey, value: epic?.key ?? null })`. Before calling it, run `queryClient.setQueryData(['jira-issue-name', epic.key, jiraBaseUrl], { fields: { summary, [epicNameFieldKey]: name, [epicColorFieldKey]: color } })`. This makes the optimistic pill render with its colour immediately.

## 3. How to write the epic link on this Jira

- **Use the field PUT (`updateIssueField` via `useFieldMutation`).** The edit modal already sets and clears Epic Link this way (`useIssueMutations.ts:190`). Inline backlog create sets it on create (`BacklogPage.tsx:466`). The repo has no Agile epic calls. [VERIFIED: codebase grep]
- Jira Software API fallback, if the field PUT 400s because Epic Link is not on the story edit screen (the same failure class as resolution and flag in memory):
  - `POST /rest/agile/1.0/epic/{epicKey}/issue` to add, and `POST /rest/agile/1.0/epic/none/issue` to remove.
  - Body for both: `{ "issues": ["KEY-1"] }`.
  - [CITED: docs.atlassian.com/jira-software/REST/9.12.0]
  - Only route Epic Link through it if UAT shows the PUT failing. Do not pre-build it. [ASSUMED: field PUT works live. No PROBE evidence found in git history; the edit-modal path has existed since 27-03 with no bug fixes logged against it.]
- Clearing: `{ fields: { customfield_X: null } }`. [ASSUMED: accepted by DC for Epic Link. If not, use `/epic/none/issue`.]

## 4. Epic search fetcher + colour

- `epicColorToTailwind(color, key)` (`lib/epicColors.ts:71`) returns `{ className, style }`. Pill classes come from `FieldsSection.tsx:843`: `inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium`. Extract a tiny `EpicPill` (in epic-picker.tsx) and reuse it in the trigger, the rows and the sidebar. The Color row at L855-868 may stay as is.
- **Do not extend `fetchEpicsBasic`** (`services/jira.ts:3216`). It fetches ALL pages (`fetchAllSearchPages`) under `['jira-epics-basic', project, base(, order)]`, which Sidebar, Backlog, SprintBoard, EpicsPage and main.tsx share ([shared fetcher cache key] pitfall). Changing its JQL or fields reorders every consumer.
- New `services/jira/epics.ts`. Follow the `services/jira/users.ts` subpath-module pattern so it avoids the jira.ts dual-file problem and is mockable in tests:
  - `searchOpenEpics(base, token, projectKey, query, { epicNameFieldKey, epicColorFieldKey, maxResults = 30 })` → `EpicOption[]`, via `GET /rest/api/2/search?jql=…&fields=summary,{name},{color}&maxResults=N`.
  - Empty query: `project = "P" AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`.
  - Text: tokenise like `buildBodySearchJql` (`services/jira.ts:1740-1764`). Reserved characters become separators, the last token gets a `*` suffix, and `esc()` handles quotes and backslashes. Use `summary ~` clauses ANDed, or `text ~` like that function.
  - Key-shaped term (`/^[A-Za-z][A-Za-z0-9_]*-\d+$/`) or bare number: OR in `key = "P-123"` (pattern at `searchJiraForLink`, `services/jira.ts:1617-1623`). [ASSUMED: Jira 400s on a JQL `key =` for a non-existent key. On `!resp.ok` with a key clause, retry without it rather than returning [].]
  - Map each issue to `{ key, name: fields[nameKey] ?? summary, summary, color: fields[colorKey] ?? null }`.
- Hook `use-epic-search.ts`: key `['jira-epic-search', projectKey, base, debouncedQuery]`, with `enabled: open && !!projectKey && !!base`.
- Trigger resolve for an off-list or Done epic: `useQuery(['jira-issue-name', value, base])` with the same queryFn shape as IssueDetailSidebar. The same cache serves both surfaces. Move that queryFn into `services/jira/epics.ts` as `fetchEpicSummary` and have IssueDetailSidebar import it, so the key has one owner. Prefer the resolved data over the list match so the colour is always right.
- projectKey: the modal has `projectKey`. In the sidebar, use `issue.fields.project?.key` (FieldsSection already reads `f.project?.key`, L551), not `activeJiraProject`. The story's own project is the right scope.

## 5. Pitfalls

1. **Optimistic unmount** ([memory]): today the row branches `epicLink ? <pill button> : '—'` (FieldsSection L835-850). The optimistic patch flips `epicLink`, which would unmount a picker mid-write. Always render `<EpicPicker value={epicLink}>`. The trigger renders the pill or "No epic" internally.
2. **Shared `mutation` error footer:** the Assignee and Story Points rows use `mutation.isError` as a footer (L747-750). Pass the same footer to EpicPicker for consistency. Note that it fires for any field's failure; that is existing behaviour.
3. **Footer "Open KEY":** `onOpenIssue?.(epicLink)` and close the popover. EpicPicker needs either a `footer` that receives `close()` or an `onOpen` prop. Prefer an `openAction?: { label, onSelect }` prop the wrapper closes on.
4. **React Compiler:** no module-level mutable reads. Settings come via store selectors or props.
5. **Popover inside Dialog:** fine (PersonPicker precedent). Keep `align="start"` and the `w-[max(20rem,var(--anchor-width))]` width so the field variant matches the modal input width.
6. **Hover affordance:** if a caret is added to the inline sidebar trigger, put it trailing inside the trigger with opacity only, so there is no layout shift ([memory]). Match the Sprint and Assignee inline triggers: `hover:bg-accent rounded px-1 -ml-1 cursor-pointer` ([match local button row]).
7. **Tests to update:**
   - `routes/dashboard/CreateEditIssueModal.test.tsx` only asserts the `Epic Link` label (L95, L101). Keep the label text and the `htmlFor="modal-epic-link"` → `id` on the trigger. Its `apiFetch` mock returns `{values: []}` for unknown URLs, so the new fetcher must tolerate a missing `issues` (use `?? []`).
   - `FieldsSection.test.tsx` has no epic-row assertions (it passes `epicIssue={null}` and `epicLinkFieldKey="customfield_10014"`). Add tests:
     - Story renders the picker trigger (`data-testid="epic-edit"`).
     - Epic and Sub-task do not render it (extend the `it.each` at L361).
     - Selecting a row calls `mutation.mutate({fieldName:'customfield_10014', value:'PROJ-9'})`.
     - "No epic" calls `mutate` with `value: null`.
     - The trigger stays mounted across a `rerender` with a flipped epicLink (unmount trap).
   - Mock `@/services/jira/epics`.
   - The pre-commit hook runs the full suite, so put RED and GREEN in one commit per TDD task.

## Validation

| Item | Command (run in /Users/mimo/Documents/Projects/taskflow/taskflow) |
|---|---|
| Quick | `npx vitest run src/components/ui/epic-picker.test.tsx src/routes/dashboard/issue-detail/FieldsSection.test.tsx src/routes/dashboard/CreateEditIssueModal.test.tsx` |
| Full | `npm test` then `npm run check` (gate on "no NEW biome files flagged", per the baseline-drift memory) |

Wave 0 creates `src/components/ui/epic-picker.test.tsx` and optionally `src/services/jira/epics.test.ts` for the JQL builder: the empty query, tokens, a key-shaped term, and escaping of `"` and `\`.

## Security
- V5 input validation: user text goes into JQL. Tokenise and escape as `buildBodySearchJql` does. Never interpolate the raw string. The project key comes from Jira data but should be quoted and escaped too.
- The PAT is read inside the queryFn only and never put in a query key (existing convention).

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The Epic Link field PUT (set and null) works on this DC instance | Sidebar change fails, so the Agile `/epic/{key}/issue` and `/epic/none/issue` fallback is needed |
| A2 | JQL `key = "X"` for a non-existent key returns 400 | It only costs one extra retry; harmless if wrong |
| A3 | `summary ~`/`text ~` with a trailing `*` finds epics by partial name | Weak matching; could also OR `cf[epicNameId] ~` if the Epic Name differs from the summary |

## Sources
- Codebase (VERIFIED by reading): person-picker.tsx, use-assignable-user-search.ts, person-picker.test.tsx, CreateEditIssueModal.tsx, useCreateEditQueries.ts, useIssueMutations.ts, useCreateEditForm.ts, FieldsSection.tsx, IssueDetailSidebar.tsx, useFieldMutation.ts, services/jira.ts (1600-1764, 2302, 3000, 3216), services/jira/parentCompletion.ts, lib/epicColors.ts.
- Jira Software Server REST 9.12 epic endpoints: https://docs.atlassian.com/jira-software/REST/9.12.0/ (CITED).
