---
phase: 102-polished-surfaces
reviewed: 2026-11-18T13:18:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/WikiEditorLazy.tsx
  - taskflow/src/components/wiki-editor/suggestion/slash-items.ts
  - taskflow/src/components/wiki-editor/toolbar/BubbleToolbar.tsx
  - taskflow/src/components/wiki-editor/toolbar/CompactFooter.tsx
  - taskflow/src/lib/issue-draft-snapshot.ts
  - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/comment-editor/CommentActionRow.tsx
  - taskflow/src/routes/dashboard/comment-editor/comment-editor-sizing.ts
  - taskflow/src/routes/dashboard/comment-editor/useExpandOnFocus.ts
  - taskflow/src/routes/dashboard/comment-editor/useKeepContentAboveSticky.ts
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/ModalShell.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/epic-create-fields.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
  - taskflow/src/routes/dashboard/create-edit-issue/usePriorityOptions.ts
  - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
  - taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx
  - taskflow/src/stores/issue-drafts.store.ts
findings:
  critical: 1
  warning: 2
  info: 7
  total: 10
status: issues_found
---

# Phase 102: Code Review Report

**Reviewed:** 2026-11-18T13:18:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

I reviewed the diff `133ee9f7..HEAD` for the 25 listed files. Most of the modal work is a mechanical extraction into `ModalShell` and looks sound. That covers Create/Edit Issue, Bulk create, Edit release and the shell itself. Mod-Enter double submit is guarded: WikiEditor calls stopPropagation. The priority hook was extracted unchanged. The epic draft sanitiser is strict and only drops malformed pieces.

The main problems are in the new collapse-on-blur composer and in the Create Epic resume path:

- **Composer collapse (CR-01):** an empty, expanded composer collapses when focus goes to `null`. WebKit, the app's runtime, does not focus a `<button>` on click. So a click on the new Attach button blurs the editor with `relatedTarget === null`. The composer then unmounts the button before the click lands. Opening the native file panel causes the same collapse.
- **Create Epic resume (WR-01):** it ignores the draft's `projectKey`. Since this phase, epic drafts carry project-specific sidebar values, so this now matters.

## Critical Issues

### CR-01: An empty composer collapses before Attach can act (WebKit click and file panel blur)

**File:** `taskflow/src/routes/dashboard/comment-editor/useExpandOnFocus.ts:29-34`, `taskflow/src/routes/dashboard/comment-editor/CommentActionRow.tsx:48-79`, `taskflow/src/routes/dashboard/CommentComposer.tsx:115,141-158`

**Issue:** `wrapperProps.onBlur` collapses whenever `relatedTarget` is not inside the wrapper and `hasContent` is false. The test file asserts this explicitly ("blur to null with no content collapses"). Two paths break the new action row:

1. **WebKit click (Tauri on macOS).** Clicking a native `<button>` does not focus it in WebKit. On `mousedown`, the contenteditable blurs with `relatedTarget === null`. The composer has no text, so `setOpen(false)` runs. `CommentActionRow` unmounts before `click` fires, so the paperclip does nothing. In Chromium and jsdom the button takes focus and `relatedTarget` is inside the wrapper, which is why the tests pass. The editor's own toolbar buttons avoid this with `onMouseDown={(e) => e.preventDefault()}` (`ToolbarButton.tsx:47`). The new Attach button lacks that.
2. **Native file panel.** Even if the button gets focus, opening the OS file panel makes the window resign key. The focused element then gets a `blur` with `relatedTarget === null`, and the composer collapses. The hidden `<input type="file">` lives inside `CommentActionRow` and unmounts with it. When the user picks files, the `onChange` and `handleRef.current?.insertFiles` are gone, so the files are silently dropped.

"Attach a screenshot first, then type" is a normal flow and is the reason D-05 adds this button.

**Fix:** Keep focus in the editor on mousedown, and do not collapse when the document has lost focus or a picker is pending:
```tsx
// CommentActionRow: keep editor focus like ToolbarButton does
<Button ... onMouseDown={(e) => e.preventDefault()} onClick={() => inputRef.current?.click()} />

// useExpandOnFocus
onBlur: (e) => {
  onBlur?.();
  const next = e.relatedTarget as Node | null;
  if (next === null && !document.hasFocus()) return; // window/panel blur, not a user leave
  if (!e.currentTarget.contains(next) && !hasContent) setOpen(false);
},
```
Alternatively, lift the file `<input>` out of the collapsible subtree and keep the composer expanded until its `change`/`cancel` event fires. Add a test for a `relatedTarget: null` blur while `document.hasFocus()` is false.

## Warnings

### WR-01: Resuming an epic draft ignores the draft's project, so sidebar values go to the wrong project

**File:** `taskflow/src/routes/dashboard/CreateEpicDialog.tsx:62-64,121-129,165-176,187,257-259,309-315`

**Issue:** `DraftsChip` lists drafts from every project and does no project filtering. The Issue modal resumes into the draft's own project (`useDraftResume` → `resumedProjectKey`, 101 D-14). `CreateEpicDialog` always uses `activeJiraProject`, for all of these:

- createmeta;
- the fix-version validation query;
- the autosave `projectKey`, which silently re-homes the draft;
- `createIssue`.

Before this phase an epic draft held only a name and a description, so this was mostly harmless. Epic drafts now carry fix-version ids, custom-field option ids, labels and an assignee from project A. Resuming one while project B is active has two results. First, A's fix versions are cleared with the misleading note "… is no longer an option". Second, A's custom-field values are checked against B's Epic createmeta and sent to B.

**Fix:** Capture `draft.projectKey` on resume. Use it instead of `activeJiraProject` for `useCreateEditQueries`, `usePriorityOptions`, `useProjectFixVersions`, the autosave `projectKey` and the `createIssue` project, mirroring `useDraftResume`:
```ts
const [resumedProjectKey, setResumedProjectKey] = useState<string | null>(null);
// in the open effect: setResumedProjectKey(draft.projectKey)
const projectKey = resumedProjectKey ?? activeJiraProject ?? '';
```

### WR-02: Story points can be hidden yet still submitted when Epic createmeta is empty or unknown

**File:** `taskflow/src/routes/dashboard/CreateEpicDialog.tsx:140-141`, `taskflow/src/routes/dashboard/create-edit-issue/epic-create-fields.ts:31-43`

**Issue:** The dialog and the payload builder read an empty createmeta differently:

- **Dialog:** `storyPointsOffered` is `false` when `creatmetaFields` is undefined or empty (loading or fetch failed), so the Story points row is hidden.
- **Payload builder:** `buildEpicCreateFields` treats an empty createmeta as "unknown" (`offered = null`) and sends `storyPoints` whenever it is non-empty.

A resumed epic draft with `storyPoints` therefore submits a value the user cannot see or clear when createmeta failed. While createmeta loads, the row also appears late and shifts the sidebar.

**Fix:** Use one rule. Either show the row when createmeta is unknown (`!creatmetaFields || creatmetaFields.length === 0 || creatmetaFields.some(...)`, as `labelsOffered` does), or have the builder drop story points when `offered` is null.

## Info

### IN-01: `buildEpicCreateFields` docstring says only offered fields are sent, but assignee and priority are never gated

**File:** `taskflow/src/routes/dashboard/create-edit-issue/epic-create-fields.ts:13-15,28-29`

**Issue:** `assignee` and `priority` are sent whenever they are set, without checking `offered`. The Issue mutation does the same, so this is consistent. However, Epic create screens often omit Priority, and `createIssue` reports only `Failed to create issue: 400`. The user then sees the generic "Check your connection" message (`CreateEpicDialog.tsx:369-374`) with no hint of which field failed.

**Fix:** Gate priority on `!offered || offered.has('priority')`, or correct the docstring. Consider surfacing a status-specific message for a 400.

### IN-02: `ModalShell` swallows ⌘↵ when no submit shortcut is provided

**File:** `taskflow/src/routes/dashboard/create-edit-issue/ModalShell.tsx:55-60`

**Issue:** `handleKeyDown` calls `preventDefault()` even when `onSubmitShortcut` is undefined (Bulk create). ⌘↵ inside the row inputs is eaten and does nothing.

**Fix:** `if (!onSubmitShortcut) return;` before `preventDefault()`, or wire Bulk's ⌘↵ to `handleCreate`.

### IN-03: The epic "Couldn't save your draft" uses destructive colour, while the Issue modal uses muted

**File:** `taskflow/src/routes/dashboard/CreateEpicDialog.tsx:381-382` vs `CreateEditIssueModal.tsx` footer

**Issue:** D-10 and D-11 ask for the Issue footer layout and copy, but the epic footer renders this message in `text-destructive` and the Issue modal uses `text-muted-foreground truncate`.

**Fix:** Use the same classes as the Issue modal.

### IN-04: Epic draft sanitiser can keep `selectedAssigneeName` after dropping a malformed `selectedAssignee`

**File:** `taskflow/src/stores/issue-drafts.store.ts:134-148`

**Issue:** If `selectedAssignee` is an object without a string `name`, it is dropped but `selectedAssigneeName` is kept. On resume, the picker shows nobody while `buildEpicCreateFields` still sends `assignee: { name }`.

**Fix:** Keep `selectedAssigneeName` only if `out.selectedAssignee` was accepted, or set it to `out.selectedAssignee?.name ?? null`.

### IN-05: `useKeepContentAboveSticky` scrolls on every growth, including the lazy editor's first paint and when the user is at the top

**File:** `taskflow/src/routes/dashboard/comment-editor/useKeepContentAboveSticky.ts:22-27`

**Issue:** Any height increase scrolls the pane by the delta. This includes:

- the Suspense fallback being replaced by the real editor on page load when a draft exists;
- a notification "Reply" while the user reads the top of the issue.

In both cases the reading position shifts, even though nothing near the strip needed protecting.

**Fix:** Scroll only when the container was at, or near, the bottom before the growth (`scrollHeight - scrollTop - clientHeight < threshold`), or only while the composer has focus.

### IN-06: Whitespace-only composer text is saved as a draft but hidden on collapse

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:63,96-101,147`

**Issue:** `hasContent` uses `text.trim()`, but `handleChange` schedules a draft for any non-empty value. A whitespace-only draft is persisted, the composer collapses over it, and no draft note is shown, so the user cannot discard it.

**Fix:** In `handleChange`, discard when `value.trim() === ''`.

### IN-07: The `apiFetch` context label changed in Bulk create

**File:** `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx:294`

**Issue:** The sentence-case pass also rewrote the network-log label from `'Bulk Create Subtasks'` to `'Bulk create subtasks'`. That label is a log/category key, not UI copy. Other call sites (`'Create/Edit Issue'`, `'Load Parent Fields'`) keep title case, so the dev-tools network view now groups inconsistently.

**Fix:** Revert the label, or normalise all `apiFetch` labels together.

---

_Reviewed: 2026-11-18T13:18:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
