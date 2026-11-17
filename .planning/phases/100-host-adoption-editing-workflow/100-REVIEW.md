---
phase: 100-host-adoption-editing-workflow
reviewed: 2026-11-17T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - taskflow/src/components/ui/discard-changes-dialog.tsx
  - taskflow/src/components/ui/draft-note.tsx
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/source/source-edits.ts
  - taskflow/src/components/wiki-editor/types.ts
  - taskflow/src/hooks/useDraftsAccountGuard.ts
  - taskflow/src/hooks/useEditorDraft.ts
  - taskflow/src/lib/draft-keys.ts
  - taskflow/src/lib/shortcuts.ts
  - taskflow/src/lib/upload-staged-files.ts
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/StagedFilesStrip.tsx
  - taskflow/src/routes/dashboard/SubtasksPanel.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
  - taskflow/src/routes/dashboard/issue-detail/useIssueEditorHost.ts
  - taskflow/src/routes/settings/ConnectionsSection.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/stores/drafts.store.ts
  - taskflow/src/test/wiki-editor-stub.tsx
findings:
  critical: 1
  warning: 5
  info: 1
  total: 7
status: issues_found
---

# Phase 100: Code Review Report

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

The draft store, debounce hook and discard dialog are mostly sound. The main problems are in the hosts. `IssueDetailView` and `CommentComposer` are reused across issue swaps with no reset, so editor state leaks between issues. The "Discard draft" action on a stale draft restores the old Jira text. Error handling hides the real server message.

## Critical Issues

### CR-01: Composer and comment-edit state leak when the issue changes (cross-issue post / mislabelled drafts)

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:41-52` (also `taskflow/src/routes/dashboard/IssueDetailView.tsx:348-361`)
**Issue:** `PeekPanel` renders `<IssueDetailView issueKey={issueKey}>` with no `key`. In-peek issue links call `setPeekIssueKey(key)`, so the same instance receives a new `issueKey`. `CommentComposer` keeps `text` in `useState`, and `seededRef` stays `true`. After a swap, issue A's unsent comment text stays in issue B's editor. The draft hook now points at B's key, and "Comment" posts A's text to B. B's stored draft is never loaded. The same applies to `editingCommentId`, `editText` and `editBase` in `IssueDetailView`. The edit draft hook keeps the old comment id as its key but writes `issueKey: B`. `pruneCommentEdits(B, ...)` then deletes it. The D-04 reopen effect is also blocked, because `editingCommentId !== null`.
**Fix:** Reset per-issue state on issue change. The simplest way is to key the subtree.
```tsx
// IssueDetailView
<CommentComposer key={issueKey} ... />
// and reset edit state when issueKey changes, or key the whole view at the call sites:
<IssueDetailView key={issueKey} ... />   // PeekPanel.tsx:90, IssueDetailPage.tsx:68
```

## Warnings

### WR-01: "Discard" on a stale draft restores the old base, so saving overwrites newer Jira text

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:452-457` and `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:196-200`
**Issue:** `handleDiscardDraft` resets the text to `editBase` / `descriptionBase`. For a stale draft, that base is the old Jira text stored with the draft. The user clicks Discard and sees outdated text. The next Save silently reverts the remote change. `dirty` is also false at that point, so Esc skips the confirm.
**Fix:** Reset to the live text and re-base, as the "Use Jira version" handler does.
```ts
const live = liveEditBody ?? editBase;
draft.discard(); setEditBase(live); setEditText(live);
```
Do the equivalent with `liveDescription.data?.description ?? descriptionBase` in the modal.

### WR-02: Real server error is replaced by a generic message

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:386-394` and `taskflow/src/routes/dashboard/IssueDetailView.tsx:379-381`
**Issue:** The modal replaces `msg` with "Your text is kept as a draft" whenever `dirty`. This hides actionable Jira errors, such as a missing required field or a permission error, that have nothing to do with the description. The comment edit `onError` drops `err.message` entirely.
**Fix:** Append the draft note instead of replacing the error, for example `` `${msg}. Your text is kept as a draft.` ``.

### WR-03: Cmd+Enter on comment edit has no in-flight guard

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:465-469`
**Issue:** The Save button is disabled while `editPending`. The keyboard path (`onSubmit` -> `handleSaveEdit`) is not guarded, so repeated Cmd+Enter fires several `updateComment` calls. The composer's `send` does guard on `mutation.isPending`.
**Fix:** Add `if (editPending) return;`. Check how `editPending` is exposed, or use the mutation's `isPending` through a ref.

### WR-04: Edit-save success can resurrect the draft through a pending debounce

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:371-374`
**Issue:** `onSuccess` clears the store entry directly but does not clear the hook's `pendingRef` or timer. If the save finishes within 500 ms of the last keystroke, a pending write remains. When `editingCommentId` becomes null, the key-change effect cleanup calls `flush()`. That re-writes a draft (old `base`, new text) after a successful save, and D-04 reopens it later.
**Fix:** Call `draft.discard()` (it clears the timer and pending write) before or instead of `clearDraft`, while the key is still the edited comment.

### WR-05: CreateEpicDialog keeps its form after a partial failure, so reopening can create a duplicate epic

**File:** `taskflow/src/routes/dashboard/CreateEpicDialog.tsx:36-43, 76-85`
**Issue:** When the epic is created but an upload fails, the name and description are kept and `hasCreatedWithError` blocks resubmit. Closing and reopening the dialog resets `hasCreatedWithError` and the staged files, but not `epicName` or `description`. The user can submit the same epic again.
**Fix:** Clear `epicName` and `description` in the open-reset effect, or clear them in the failed-upload branch of `onSuccess`.

## Info

### IN-01: Host identity churns because of inline `?? []` attachments

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:483-488` (the `useIssueEditorHost` call and the `<CommentComposer attachments=...>` prop) and `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:245-251`
**Issue:** `issue?.fields.attachment ?? []` and `initialValues?.attachments ?? []` create a new array on every render when no attachments exist. `useIssueEditorHost` lists `attachments` in its `useMemo` deps, so it returns a new host every render, which contradicts its "stable identity" contract.
**Fix:** Use module-level empty constants, as `CommentComposer` does with `NO_ATTACHMENTS`.

---

_Reviewed: 2026-11-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
