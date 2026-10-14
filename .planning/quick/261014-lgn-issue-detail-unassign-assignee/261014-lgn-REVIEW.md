---
phase: 261014-lgn-issue-detail-unassign-assignee
reviewed: 2026-10-14T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 261014-lgn: Code Review Report

**Depth:** quick (diff 4c3f2a25..HEAD, read in full)

## Summary

The edit-mode unassign path is sound. `assignIssue` sends `PUT /rest/api/2/issue/{key}/assignee` with `{"name":null}`, which is correct for Jira Server/DC. `fields.assignee = null` is never sent. Unassign fires only when `assigneeUnassignPicked` is true and the issue had an assignee. Focus, blur and typing cannot trigger an unassign, because the committed selection is only changed by the PICK actions. The Create-mode path is not fully unchanged, though (WR-01).

## Warnings

### WR-01: Create mode can no longer clear or deselect an assignee

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:509-517`
**Issue:** The change removed the `selectedAssigneeName = null` dispatch from `onChange`. It also made `onFocus` clear only the text. The new `ASSIGNEE_BLUR` restores the committed label. This applies to both modes. The old behaviour in Create was that editing or focusing the field dropped the selection, so a user could back out of a chosen assignee. Now, once a user is picked in Create mode, focusing, clearing the text and blurring silently restores and keeps that assignee. There is no "Unassigned" option in Create mode (`mode === 'edit'` only), so there is no way to undo the choice. This conflicts with the requirement that Create stays unchanged. A user can end up creating an issue assigned to someone they thought they had cleared.
**Fix:** In Create mode, keep the old semantics. For example, in `onChange`, when `mode === 'create'`, dispatch `selectedAssigneeName: null` and set `assigneeCommittedLabel` to `''`. Alternatively, make `ASSIGNEE_BLUR` in create mode commit the empty text as a clear. Alternatively, show an "Unassigned/None" option in Create mode too.

### WR-02: Non-atomic save when the update succeeds but `assignIssue` fails

**File:** `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts:206-210`
**Issue:** `bulkUpdateIssue` runs first, then `assignIssue`. If the unassign call fails (403, or 400 for a permission or workflow condition), the other fields are already persisted. The mutation then errors and `onSuccess` and cache invalidation are skipped. The UI shows stale data while Jira holds the new values. The link-creation loop after it is skipped as well, so those links are lost until the user retries.
**Fix:** Run `assignIssue` in a `try/finally` so invalidation always happens, or catch the error and surface a specific "fields saved, unassign failed" message. Also invalidate the queries on the error path.

### WR-03: Pending blur timer can wipe typed text and hide the list after a quick refocus

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:517`
**Issue:** The `setTimeout(..., 150)` is never cleared. If the user refocuses and starts typing within 150 ms, `ASSIGNEE_BLUR` fires. It resets `assigneeInputValue` to the committed label and closes the dropdown mid-typing. Before this change the timer only hid the list. Now it also destroys user input. The timer can also fire after unmount or after a RESET.
**Fix:** Store the timer id in a ref, clear it in `onFocus`, and clear it on unmount.

## Info

### IN-01: `issueKey` interpolated into the URL path without encoding

**File:** `taskflow/src/services/jira.ts:2796`
**Issue:** `${issueKey}` is not passed through `encodeURIComponent`. Keys come from Jira, so the risk is low, and this is probably consistent with the neighbouring functions. Still, it is a path-injection hygiene gap.
**Fix:** Use `encodeURIComponent(issueKey)`.

### IN-02: Assignee input shows the username rather than the display name for the initial value

**File:** `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts:130-133`
**Issue:** `assigneeInputValue` and `assigneeCommittedLabel` are initialised from `assigneeName` (a username such as "janesmith"). After a pick, the label becomes the display name. This is inconsistent, though it is pre-existing and the tests assert it.
**Fix:** Pass `assigneeDisplayName` through `initialValues` if available.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
