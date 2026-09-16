---
phase: 260916-sak
reviewed: 2026-09-16T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - taskflow/src/lib/attachment-markup.test.ts
  - taskflow/src/lib/attachment-markup.ts
  - taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 260916-sak: Code Review Report

**Reviewed:** 2026-09-16
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the attachment-reference feature added to `CommentComposer` (picker modal, paste/drop upload, `attachmentRef` markup helper) and its `WikiRenderer` rendering support (`[^filename]` chip resolution). The `attachment-markup.ts` module's hazard-character sanitization strips only one occurrence of a hazardous character instead of all occurrences, which can leave the wiki-markup delimiters unbalanced for filenames with two or more hazardous characters. Separately, the new drag-and-drop upload path on `CommentComposer`'s textarea omits the `onDragOver` handler that the sibling `AttachmentsSection` implementation relies on — without it, the browser will reject the native drop before `onDrop` ever fires, so the feature likely does not work outside of the synthetic-event test harness. Both are correctness-blocking. A handful of smaller robustness/UX issues are noted below as warnings/info.

## Critical Issues

### CR-01: `attachmentRef` only strips the first hazardous character, not all of them

**File:** `taskflow/src/lib/attachment-markup.ts:37-40`
**Issue:** `HAZARDOUS_FILENAME_CHARS` is a non-global regex (`/[!|\]]/`). `att.filename.replace(HAZARDOUS_FILENAME_CHARS, '')` therefore removes only the **first** matching character in the filename. For a filename with two or more hazardous characters (e.g. `weird||name.pdf`, `report]v2]final.pdf`, `a!b!c.png`), the sanitized display name still contains a stray `|` or `]`.

That stray character is then embedded directly inside the `[sanitized|content-url]` wiki-link markup this function builds for the fallback case. A leftover `|` shifts where Jira/jira2md interprets the display-text/href boundary (e.g. `[weird|name.pdf|url]` parses as display=`weird`, href=`name.pdf|url` — a broken link to a garbage URL). A leftover `]` prematurely closes the bracket (e.g. `[report]v2]final.pdf|url]` truncates the link at the first `]`, leaving `v2]final.pdf|url]` as trailing literal text). Both produce corrupted, non-functional attachment references in the comment body that the user cannot visually predict from the picker/paste UI.

The existing unit tests only exercise filenames with a single hazardous character (`weird!name.png`, `weird|name.pdf`, `weird]name.txt`), so this regression is untested.

**Fix:**
```ts
const HAZARDOUS_FILENAME_CHARS = /[!|\]]/g; // add the missing global flag

export function attachmentRef(att: JiraAttachment): string {
  const hazardous = HAZARDOUS_FILENAME_CHARS.test(att.filename);
  ...
```
Note: since the regex is now stateful (`g` flag), reuse `HAZARDOUS_FILENAME_CHARS.test(...)` carefully — either reset `.lastIndex = 0` before each `.test()` call, or use a fresh `RegExp` instance / `.some()` check instead of a shared global regex, to avoid the classic `lastIndex`-carries-over-between-calls bug. Add a regression test with a filename containing 2+ hazardous characters.

### CR-02: Drag-and-drop upload on the comment textarea is missing `onDragOver`, so the native `drop` event will never fire in a real browser

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:307-318`
**Issue:** The `Textarea` wires `onDrop={handleDrop}` but has no `onDragOver` handler. Per the HTML5 drag-and-drop spec, a `drop` event is only dispatched on an element if that element's `dragover` (or `dragenter`) handler calls `event.preventDefault()`; otherwise the browser treats the element as a non-drop-target and the drop is rejected before `ondrop` runs (the OS/browser instead opens or navigates to the dropped file). The sibling implementation this code explicitly claims to mirror — `AttachmentsSection.tsx` (referenced in the comment at line 120-122: *"mirrors AttachmentsSection.tsx:48-64's mutationFn verbatim"*) — wires both `onDragOver={handleDragOver}` and `onDrop={handleDrop}` (`AttachmentsSection.tsx:138,140`).

Because `CommentComposer.attachments.test.tsx`'s drop test uses `fireEvent.drop(textarea, ...)` directly (a synthetic DOM event dispatch that bypasses the browser's native `dragover`-gate), the test suite passes even though the feature is very likely non-functional for real mouse-driven drag-and-drop in Tauri's webview / any real browser.

**Fix:**
```tsx
<Textarea
  ref={textareaRef}
  value={text}
  onChange={handleTextChange}
  onKeyDown={handleKeyDown}
  onPaste={handlePaste}
  onDragOver={(e) => e.preventDefault()}
  onDrop={handleDrop}
  ...
/>
```

## Warnings

### WR-01: No guard against overlapping paste/drop uploads

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:122-139, 157-178`
**Issue:** Neither `handlePaste` nor `handleDrop` checks `uploadMutation.isPending` before starting a new upload, and the toolbar/textarea are not disabled while an upload is in flight. If a user pastes a file and then immediately drops (or pastes) another before the first completes, `uploadingName` is silently overwritten and two `uploadAttachment` calls race concurrently. The single "uploading…" status line can no longer accurately reflect which file is in flight, and if one of the two uploads fails, the error message attributes the fixed `uploadingName ?? 'file'` text to whichever upload's name is in state at the time — potentially the wrong file.
**Fix:** Short-circuit both handlers when `uploadMutation.isPending`, e.g.:
```ts
function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
  const file = e.clipboardData.files?.[0];
  if (file && !uploadMutation.isPending) { ... }
}
```
and disable the Paperclip button / show a spinner while `uploadMutation.isPending`.

### WR-02: Freshly uploaded attachment is not resolvable in Preview immediately after upload

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:94, 128-134, 350-355`
**Issue:** `attachmentMap` (used to resolve `!filename!` / `[^filename]` references in the Preview tab) is derived from the `attachments` prop, which is owned by the parent (`IssueDetailView`) and only updates after the `['jira-issue-detail', ...]` query invalidation triggered in `uploadMutation.onSuccess` actually refetches and re-renders. Immediately after a successful paste/drop upload, `insertRef(attachmentRef(att))` inserts e.g. `!diagram.png!` into the textarea, but if the user switches to the Preview tab before the parent's refetch resolves, `WikiRenderer`'s `preprocessJiraMarkup` will not find `diagram.png` in the (stale) attachment map and will fall through to the "no attachment map" branch, rendering a broken image reference instead of the just-uploaded image.
**Fix:** Seed the local preview attachment map with the upload response (`created`) in `uploadMutation.onSuccess`, e.g. maintain a small local `Record<string, string>` of just-uploaded attachments merged over the prop-derived map, so Preview is correct even before the parent refetch lands.

### WR-03: Attachment filename collisions silently resolve to the wrong content

**File:** `taskflow/src/routes/dashboard/CommentComposer.tsx:94`, `taskflow/src/lib/attachment-markup.ts:32-42`
**Issue:** `attachmentMap` is built with `Object.fromEntries(attachments.map((a) => [a.filename, a.content]))` — when two attachments on the same issue share a filename (Jira does not require attachment filenames to be unique), the map keeps only the last entry. Since `attachmentRef` also emits references by filename alone (`!filename.png!` / `[^filename]`) rather than a stable ID, a user who deliberately picks the *older* same-named attachment from the picker will have their comment silently render/link to the *newer* one's content once posted and re-rendered elsewhere. This is a pre-existing pattern shared with `IssueDetailView.tsx`'s attachment map, but the new picker/insert flow actively encourages users to attach multiple similarly-named files (e.g. repeated `screenshot.png` uploads) and reference them individually, making the collision more likely to be user-triggered now.
**Fix:** Out of scope for a full redesign, but consider disambiguating the picker list (e.g. append `(2)`, or show upload date) when duplicate filenames are present, or resolving `attachmentRef` against the attachment `id` rather than filename where the markup format allows it.

## Info

### IN-01: `AttachmentPickerModal`'s filter text is not reset on close

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx:28-39`
**Issue:** `filter` state lives in `AttachmentPickerModal`, which is mounted once inside `CommentComposer` and toggled via `open`. Closing the dialog (via selection or explicit close) does not clear `filter`, so reopening the picker later in the same comment session shows the previous filter text and pre-filtered list rather than the full attachment list.
**Fix:** Reset `filter` in `handleSelect` / on `onOpenChange(false)`, or clear it in a `useEffect` keyed on `open` transitioning to `false`.

### IN-02: `AttachmentPickerModal` file rows have no keyboard-visible affordance beyond default browser focus ring

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx:80-93`
**Issue:** The non-image rows are plain `<button>` elements relying entirely on the default focus outline (no explicit `focus-visible` styling), which is inconsistent with the rest of the app's interactive-element conventions seen elsewhere in this codebase (e.g. explicit hover/focus classes). Minor consistency nit, not a functional bug.
**Fix:** Add an explicit `focus-visible:ring-2 focus-visible:ring-ring` (or equivalent project convention) class to the row buttons for consistency.

---

_Reviewed: 2026-09-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
