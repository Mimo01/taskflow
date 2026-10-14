# Quick Task 261014-lgn: Unassign assignee from issue detail - Research

**Researched:** 2026-10-14
**Domain:** Jira Server/DC REST v2 assignee semantics + Edit Issue modal form state
**Confidence:** HIGH for code sites, MEDIUM-HIGH for the payload (endpoint confirmed by Atlassian KB + forum, but not probed against this Jira instance)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add an explicit "Unassigned" option at the top of the assignee dropdown; selecting it unassigns.
- An empty/blurred field with no pick must keep the current assignee (no accidental unassign). Note existing onFocus handler clears selectedAssigneeName — that must not turn into an implicit unassign.
- Edit modal only; no separate inline sidebar control.

### Claude's Discretion
- Payload shape for unassign (verify against Jira Server/DC semantics; likely `{ name: null }`), post-save cache invalidation so the detail view shows "Unassigned" (watch stale fallbacks like `fresh?.assignee ?? sub.fields.assignee` in `services/jira.ts` ~L1940), tests.

### Deferred Ideas (OUT OF SCOPE)
- None listed.
</user_constraints>

## Summary

**No assign/unassign helper exists in the app.** Grepping `src/services/jira.ts` and `src/services/jira/` turns up no `/assignee` endpoint call. The only path is `bulkUpdateIssue` (PUT `/rest/api/2/issue/{key}` with `{fields}`, jira.ts L2754-2778), and `useIssueMutations.ts` L173-175 sends `fields.assignee = null` when `selectedAssigneeName` is falsy. [VERIFIED: codebase grep]

**There is a latent accidental-unassign bug today.** `onFocus` (CreateEditIssueModal.tsx L512-518) and `onChange` (L503-511) both set `selectedAssigneeName = null`. If a user focuses the field and blurs or saves without picking, `null !== initialValues.assigneeName` is true, so `fields.assignee = null` gets sent. Whether that actually unassigns depends on how Jira treats `null` inside `fields`, and the user's report suggests it doesn't do so reliably. Either way, the locked decision says this path must become a **no-op**, not an unassign.

**Primary recommendation:** Add `assignIssue(baseUrl, token, issueKey, name: string | null)` to legacy `services/jira.ts`, calling **PUT `/rest/api/2/issue/{key}/assignee` with body `{"name": null}`** to unassign. Track "explicitly Unassigned" as its own boolean in form state, separate from `selectedAssigneeName === null`. Stop the focus and typing handlers from erasing the committed selection, and restore the input label on blur through a reducer action.

## Payload decision (Focus 1)

| Option | Server/DC behaviour | Verdict |
|--------|--------------------|---------|
| PUT `/rest/api/2/issue/{key}/assignee` `{"name": null}` | Atlassian KB says "A null name will remove the assignee". `"-1"` means the default assignee, and `"Unassigned"` errors as "not an assignable user". A forum thread confirms `{"name": null}` on this v2 endpoint was the one that worked on Server/DC. [CITED: support.atlassian.com/jira/kb/how-to-set-assignee-to-unassigned-via-rest-api-in-jira] [CITED: community.developer.atlassian.com/t/set-issue-to-unassigned-via-api/82622] | **USE** |
| PUT `/issue/{key}` `{fields:{assignee:null}}` | One DC user reports it works. Another source says it only works when assignee is on the edit screen. The current code already does this, and the user still can't unassign. [LOW: WebSearch summary only] | Don't rely on it |
| PUT `/issue/{key}` `{fields:{assignee:{name:null}}}` | Reported **not** to work inside `fields`. [LOW: WebSearch summary] | Reject. The CONTEXT guess `{name:null}` is right only for the `/assignee` endpoint |

Why the dedicated endpoint: it needs only the Assign Issues permission and skips edit-screen field validation. The app has hit edit-screen rejections before (see the flag field via GreenHopper and resolution via transition, both in MEMORY). It returns **204 No Content** on success. [ASSUMED: 204, matching the other v2 PUT endpoints. Treat any `response.ok` as success, and 401/403 as `ApiError`, the same as `bulkUpdateIssue`.]

```ts
// services/jira.ts — place next to bulkUpdateIssue (legacy file; all imports use jira.ts per MEMORY)
export async function assignIssue(
  baseUrl: string, token: string, issueKey: string, name: string | null,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/assignee`;
  const response = await apiFetch('jira', url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }), // null => Unassigned; never send "-1" or "Unassigned"
  }, 'Create/Edit Issue');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new ApiError(`Failed to assign ${issueKey}`, response.status, 'jira');
    const body = await response.json().catch(() => ({}));
    throw new Error(flattenJiraError(body) ?? `Failed to assign ${issueKey}: ${response.status}`);
  }
}
```

Scope recommendation: use `assignIssue(..., null)` **only for unassign**, and leave the proven `fields.assignee = {name}` path for assigning a user. This is the minimum behaviour change. Call it after `bulkUpdateIssue` succeeds, and only when the issue actually had an assignee (`initialValues.assigneeName !== null`).

## Code sites (Focus 2)

| File | Lines | Change |
|------|-------|--------|
| `src/routes/dashboard/create-edit-issue/useCreateEditForm.ts` | `FormState` L34-54, `buildInitialState` L123-125, reducer | Add `assigneeUnassignPicked: boolean` (default false) and `assigneeCommittedLabel: string` (initial `initialValues?.assigneeName ?? ''`). Add reducer actions `ASSIGNEE_PICK {name, label}`, `ASSIGNEE_PICK_UNASSIGNED`, `ASSIGNEE_BLUR` (sets `assigneeInputValue = state.assigneeCommittedLabel`, `showAssigneeResults=false`). |
| `src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` | combobox L496-581 | **onChange:** set input and show results only. Remove the `selectedAssigneeName=null` dispatch (L509). **onFocus:** clear the input text so the full list shows and open results. Do **not** touch `selectedAssigneeName` (remove L515). **onBlur:** `setTimeout(() => dispatch({type:'ASSIGNEE_BLUR'}), 150)`. **Listbox:** when `mode === 'edit'`, render an `Unassigned` `role="option"` button first (`aria-selected={state.assigneeUnassignPicked}`, onMouseDown dispatches `ASSIGNEE_PICK_UNASSIGNED`). Show it even when `allAssignees` is empty, which means adjusting the L529 render condition. User option onMouseDown (L559-575) dispatches `ASSIGNEE_PICK`. |
| `src/routes/dashboard/create-edit-issue/useIssueMutations.ts` | L173-175, L199, onSuccess L218-227 | Replace the block with: `if (!state.assigneeUnassignPicked && state.selectedAssigneeName && state.selectedAssigneeName !== initialValues.assigneeName) fields.assignee = { name: state.selectedAssigneeName };`. After `bulkUpdateIssue`: `if (state.assigneeUnassignPicked && initialValues.assigneeName) await assignIssue(jiraBaseUrl, token, initialValues.issueKey, null);`. **Never** send `fields.assignee = null` again. |
| Same file, create path L67 | `if (state.selectedAssigneeName) options.assignee = …` | Leave as is. The Unassigned option is edit-only, so create and clone are unaffected. |
| `src/services/jira.ts` | after L2778 | Add `assignIssue` (above). |
| `src/routes/dashboard/IssueDetailContent.tsx` | L528 (`onEdit`) | Optional: also pass `assigneeDisplayName` so the input shows the display name rather than the username. If you do this, add the field to `EditInitialValues` and fall back to the name. The existing test at L175 asserts `'janesmith'` and passes no display name, so it keeps passing with the fallback. |

**Representing state:**
- `assigneeUnassignPicked === true`: unassign (explicit).
- `selectedAssigneeName` non-null and different from the initial value: reassign.
- Anything else: untouched, so send nothing.

The mutation is the safety net, and blur-restore keeps the UI honest so the field never shows empty while the assignee is kept.

## Cache invalidation and stale fallbacks (Focus 3)

- `editMutation.onSuccess` already invalidates `['jira-issue-detail', key, base]` and `['gh-backlog']` (L218-226). The detail sidebar reads `issue.fields.assignee` from that query (IssueDetailContent L244, L528), so it will show Unassigned once the refetch lands. [VERIFIED: codebase]
- **Add** `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` and `{ queryKey: ['jira-parent-detail'] }`, both as prefix matches. When the edited issue is a subtask, the parent's subtask-row avatar comes from `['jira-subtask-enrichment', parentKey, …]` (IssueDetailView.tsx L163) with `staleTime` 30s. When it is a parent, child pages' Parent row reads `['jira-parent-detail', parentKey, …]` (L185).
- **Fix the stale fallback at jira.ts L1940:** `assignee: fresh?.assignee ?? sub.fields.assignee`. The search API returns `assignee: null` for unassigned issues, and `??` then falls back to the cached parent-sourced value. Change it to `assignee: fresh ? (fresh.assignee ?? null) : sub.fields.assignee`. `status` and `timetracking` on the next lines are never legitimately null, so leave them. This is the same class of bug as MEMORY "Enrichment invalidation no-op".

## Tests to extend (Focus 4)

| File | Add |
|------|-----|
| `src/routes/dashboard/CreateEditIssueModal.test.tsx` (mocks `@/services/jira` via `importOriginal` spread L26-41) | Add `assignIssue: vi.fn().mockResolvedValue(undefined)` to the mock. Cases: (a) edit mode shows an `Unassigned` option first when focused, (b) pick Unassigned, then Save, calls `assignIssue(…, 'PROJ-42', null)` and `bulkUpdateIssue` fields have **no** `assignee` key, (c) focus, then blur, then Save with no pick: `bulkUpdateIssue` fields have no `assignee` key, `assignIssue` not called, and the input is restored to the original label, (d) pick another user, then Save: `fields.assignee = {name}`, `assignIssue` not called, (e) create mode shows no Unassigned option. |
| `src/services/jira.test.ts` (bulkUpdateIssue block ~L1347) | `assignIssue`: URL `/rest/api/2/issue/PROJ-5/assignee`, method PUT, body `{"name":null}`. Throws `ApiError` on 403 and a flattened error on 400. `fetchEnrichedSubtasks`: fresh `assignee: null` overrides a non-null `sub.fields.assignee`. |
| `src/routes/dashboard/create-edit-issue/CreateEditIssueModal.attachments.test.tsx` | No change expected. Confirm it still passes, since it builds `assigneeName: null` initial values (L149). |

Commands: quick `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/services/jira.test.ts`, full `npm test` (from `taskflow/`).

## Common Pitfalls

1. **Stale closure in the blur timeout.** The existing `setTimeout` in onBlur captures render-time state. Restoring the label from a closure can overwrite a pick made in onMouseDown. Do the restore inside the reducer (`ASSIGNEE_BLUR` reads `state.assigneeCommittedLabel`).
2. **Treating `null` as unassign.** `selectedAssigneeName === null` also means "the issue started unassigned" and "the user is mid-typing". Only the explicit flag may trigger unassign.
3. **Sending `"Unassigned"` or `"-1"`.** `"Unassigned"` returns 400 "not an assignable user", and `"-1"` assigns the project default (possibly the lead). [CITED: Atlassian KB]
4. **Fuzzy filter hiding the option.** The Unassigned row should always render in edit mode regardless of `assigneeInputValue`, or filter it with the same fuzzy match. Don't let L529 `allAssignees.length > 0` gate it.
5. **Pre-commit runs the full vitest suite.** Combine RED and GREEN into one commit (MEMORY). Lint gate: `biome check` on the touched files only. Don't run `--write` on all of `src`.

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | `/assignee` PUT returns 204 on this Jira DC | Low. The helper treats any `ok` as success. |
| A2 | The user has the Assign Issues permission (implied, since they can already assign) | Low |
| A3 | `fields.assignee=null` is unreliable on this instance (inferred from the user report, not probed) | None. The recommendation avoids it either way. |

## Open Questions

- Should picking Unassigned on an already-unassigned issue be hidden or shown as selected? Recommendation: render it with `aria-selected` true when `initialValues.assigneeName === null` and nothing else is picked, and make it a no-op on save.

## Project Constraints

No `CLAUDE.md` exists at the repo root or in `taskflow/`. The constraints come from MEMORY instead: edit legacy `services/jira.ts`, not the `jira/` modules; use scoped edits with no bulk find-replace; the biome gate is "no NEW files flagged"; pre-commit runs the full suite.

## Sources
- [How to Set Assignee to Unassigned via REST API in JIRA (Atlassian KB)](https://support.atlassian.com/jira/kb/how-to-set-assignee-to-unassigned-via-rest-api-in-jira/)
- [Set Issue to 'Unassigned' via API - Jira Server (Atlassian Developer Community)](https://community.developer.atlassian.com/t/set-issue-to-unassigned-via-api/82622)
- [untaped PR #345: assign via the assignee endpoint (edit-screen limitation)](https://github.com/alexisbeaulieu97/untaped/pull/345) (LOW, secondary)
- Codebase: `useIssueMutations.ts`, `CreateEditIssueModal.tsx`, `useCreateEditForm.ts`, `services/jira.ts` L1889-1945 and L2754-2778, `IssueDetailView.tsx` L160-190, `IssueDetailContent.tsx` L515-535
