---
phase: 260916-ta1
reviewed: 2026-09-17T08:32:23Z
depth: quick
files_reviewed: 9
files_reviewed_list:
  - taskflow/src/lib/attachment-markup.test.ts
  - taskflow/src/lib/attachment-markup.ts
  - taskflow/src/routes/dashboard/DescriptionEditor.attachments.test.tsx
  - taskflow/src/routes/dashboard/DescriptionEditor.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.attachments.test.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 260916-ta1: Code Review Report

**Reviewed:** 2026-09-17T08:32:23Z
**Depth:** quick (escalated to targeted reading of call chains where a pattern-match alone was inconclusive)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the story create/edit attachment-staging feature: the `attachment-markup.ts` wiki-ref helper, `DescriptionEditor`'s paste/drop/picker wiring, and `CreateEditIssueModal`'s create-mode staging vs. edit-mode immediate-upload split (plus the mutation hooks backing both). The wiki-markup escaping logic itself is sound and well-tested. The most serious issue is a silent-data-loss bug in edit mode: the attach-file button lives outside the `Tabs` component and is clickable while the Preview tab is active, but `DescriptionEditorHandle.insertRef` writes through a ref to the (now-unmounted) textarea, so a successfully uploaded attachment's markup reference can be silently dropped with no error shown to the user. There are also a few lower-severity robustness gaps (duplicate-submit risk after a partial staged-upload failure, silent multi-file drop truncation, and an asymmetric whitespace comparison in the edit-mode diff).

## Critical Issues

### CR-01: Attachment reference silently lost when uploaded while the Preview tab is active

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:88-113` (interacts with `taskflow/src/routes/dashboard/DescriptionEditor.tsx:28-51,72-76`)

**Issue:** In edit mode, `uploadMutation.onSuccess` inserts the attachment reference via `descriptionRef.current?.insertRef(attachmentRef(att))` (CreateEditIssueModal.tsx:107). `insertRef` (DescriptionEditor.tsx:72-76) forwards to `insertAtCursor`, which does `const el = textareaRef.current; if (!el) return;` (DescriptionEditor.tsx:35-36) — a pure no-op when the textarea isn't mounted.

The "Attach file" button and its hidden `<input type="file">` (CreateEditIssueModal.tsx:326-341) sit **outside** the `<DescriptionEditor>`/`<Tabs>` tree, so they remain clickable regardless of which `TabsContent` (`edit` vs `preview`) is currently active. `TabsContent` is built on Base UI's `Tabs.Panel`, whose `keepMounted` prop defaults to `false` (`node_modules/@base-ui/react/tabs/panel/TabsPanel.js:37,65,109`: `shouldRender = keepMounted || mounted`), meaning the inactive panel — including the `edit` panel's `<Textarea>` — is unmounted, not merely hidden, whenever the `preview` tab is selected.

Reproduction: open an existing issue for edit → switch to the Preview tab → click "Attach file" → pick a file. `handleFileSelected` sees `mode === 'edit'` and immediately calls `uploadMutation.mutate(file)` (an async network call) without checking or forcing the active tab. By the time the upload resolves, the textarea is unmounted (user is still on Preview), so `insertRef` silently does nothing. The file *is* uploaded to Jira (mutation `onSuccess` also invalidates `['jira-issue-detail', ...]`, so it will show up in the Attachments section on next refetch/reopen), but the wiki markup reference the user expected to see inserted into the description is permanently lost — with zero error surfaced. The same failure mode applies to a slow paste/drop upload if the user switches tabs before it resolves.

**Fix:** Don't rely on the DOM ref surviving an async gap. Either keep the edit panel mounted (`<TabsContent value="edit" keepMounted>`) so `textareaRef.current` stays valid, or — more robustly — insert the ref through the `value`/`onChange` state instead of the DOM element when the target textarea isn't available:

```tsx
// DescriptionEditor.tsx
useImperativeHandle(ref, () => ({
  insertRef(refText: string) {
    const el = textareaRef.current;
    if (!el) {
      // Textarea unmounted (e.g. Preview tab active) — append via state instead
      // of silently dropping the reference.
      onChange(value ? `${value}\n${refText}` : refText);
      return;
    }
    insertAtCursor(textareaRef, refText, '', onChange, value);
  },
}));
```

## Warnings

### WR-01: Partial staged-upload failure leaves a fully re-submittable form, risking duplicate issue creation

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:255-267`
**Issue:** When `createMutation` succeeds but one or more staged attachments fail to upload, `onSuccess` intentionally keeps the modal open (`stagedUploadErrorRef.current` branch, lines 261-265) so the failure message stays visible. However nothing disables or resets the "Create" button/form afterward: `state.summary` is still populated, `requiredCustomFieldsFilled` is still true, and `isPending` is `false` again. If the user clicks "Create" a second time (e.g. reflexively, thinking the first click didn't register because the modal didn't close), `createMutation.mutate()` runs again and a **second Jira issue is created** with the same summary/fields.
**Fix:** After a successful create (regardless of staged-upload outcome), disable further submission of the same form instance — e.g. track a `hasCreated` flag and disable the submit button, or route the "partial failure" case through a state that swaps the form for a read-only "created as PROJ-9, N attachment(s) failed" summary instead of leaving the original editable form active.

### WR-02: Drag/drop and paste silently discard all but the first file

**File:** `taskflow/src/routes/dashboard/DescriptionEditor.tsx:84-104`
**Issue:** `handlePaste` and `handleDrop` both do `const file = e.clipboardData.files?.[0]` / `e.dataTransfer.files?.[0]` and only ever act on that single file. If a user selects/drags multiple files at once (a very natural gesture), every file beyond the first is dropped with no error, warning, or staged chip — the user has no indication anything was lost.
**Fix:** Either loop over all files and call `onFileSelected` for each, or explicitly detect `files.length > 1` and surface a message ("Only one file at a time is supported; the rest were ignored") so the behavior isn't silently lossy.

### WR-03: Duplicate attachment filenames silently collide in the preview map

**File:** `taskflow/src/routes/dashboard/DescriptionEditor.tsx:78`
**Issue:** `Object.fromEntries(attachments.map((a) => [a.filename, a.content]))` keys by `filename`. Jira allows multiple attachments on the same issue with identical filenames (re-uploads of `screenshot.png`, etc.), each with a distinct `id`/`content` URL. When two attachments share a filename, this map silently keeps only the last one, so `!screenshot.png!` in the Preview tab can resolve to the wrong (unintended) image with no indication of the collision. This mirrors an existing pattern in `IssueDetailContent.tsx:252-255`, so it isn't a regression introduced here, but the new staged-attachment flow increases the chance of same-name re-uploads (stage → remove → re-stage → upload) hitting it.
**Fix:** Not blocking for this feature, but worth a follow-up: key by attachment `id` where possible, or de-dupe/warn when a new upload shares a filename with an existing attachment.

## Info

### IN-01: Asymmetric `trim()` comparison can trigger a spurious description PATCH in edit mode

**File:** `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts:170-172`
**Issue:** `if (state.description.trim() !== (initialValues.description ?? '')) { fields.description = state.description; }` trims the left side but not `initialValues.description`. If the original Jira description has leading/trailing whitespace (common with server-side content), an untouched form will still evaluate this as "changed" and send `fields.description = state.description` (which equals the original, untrimmed, value) on every save — a harmless but unnecessary PATCH that also means "no changes" saves aren't actually no-ops.
**Fix:** Compare consistently, e.g. `state.description !== (initialValues.description ?? '')` (no trim on either side), or trim both sides.

### IN-02: User-controlled filenames are interpolated unescaped into generated HTML downstream

**File:** `taskflow/src/lib/attachment-markup.ts:34-66` (consumed by `WikiRenderer.tsx`, not in this diff)
**Issue:** `attachmentRef`/`stagedAttachmentRef` strip only the three characters (`!`, `|`, `]`) that would break the Jira wiki-markup delimiters — that part is correct and well-tested. However the resulting `[^filename]` / `!filename!` tokens are later interpolated directly into raw HTML (`<a href="${url}">${filename}</a>`, `<img src="${url}" ...>`) by `WikiRenderer.tsx` without HTML-escaping the filename itself (e.g. `<`, `>`, `"` pass through untouched). This feature increases the number of places a user-supplied filename (from an arbitrary local file drag/dropped into the description) flows into that path. This is not a regression in the reviewed files and downstream `rehype-sanitize` may already neutralize it, but since attachment-markup.ts is the new entry point funneling more attacker-influenceable filenames into that renderer, it's worth an explicit check that `rehype-sanitize`'s schema can't be bypassed via a crafted filename (e.g. `"><script>...` or `" onerror="...`) before this ships broadly.
**Fix:** Out of scope to fix in this diff (WikiRenderer.tsx wasn't touched), but flag for a follow-up security check against the actual sanitize schema.

---

_Reviewed: 2026-09-17T08:32:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
