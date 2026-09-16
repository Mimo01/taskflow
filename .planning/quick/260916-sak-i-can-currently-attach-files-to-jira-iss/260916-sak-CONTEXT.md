# Quick Task 260916-sak: I can currently attach files to jira issues but I cant add them to description/comments. Add a nice dynamic way to include attachments in the descriptions/comments - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Task Boundary

Users can already attach files to a Jira issue in taskflow, but have no way to reference/embed those attachments inside comment text. **Correction from research:** the TipTap WikiEditor referenced by prior project memory does not exist in the current codebase — it was built and then reverted (survives only on unmerged tag `backup/wiki-editor-before-revert-260531`). Editing today is a plain `<textarea>` with toolbar buttons that insert wiki markup (`insertAtCursor`/`applyMarkup`), plus a separate `WikiRenderer` preview tab. `WikiRenderer.tsx`'s `preprocessJiraMarkup` already resolves `!filename!` → inline `<img>` and `[^filename]` → `<a href>` against a filename→URL map — that half is already built and tested.

Scope: add a toolbar button + picker modal to the **comment composer only** (not the description editor — description is only edited via the Create/Edit modal, and create mode has no issueKey to attach to) that inserts `!filename!` or `[^filename]` markup at the cursor for an existing attachment, plus upload-on-paste/drop of new files. Inline images render when the user switches to the Preview tab — no live-while-typing rendering (that would require re-landing TipTap, out of scope).

</domain>

<decisions>
## Insert UX
- Add an "Insert attachment" toolbar button to the `CommentComposer` toolbar (comments only, not the description editor) that opens a picker modal listing the issue's current attachments; selecting one inserts a reference at the textarea cursor.

## Image rendering
- Image attachments insert as `!filename!` wiki image markup at the cursor. This renders as an inline thumbnail when the user switches to the Preview tab (already implemented in `WikiRenderer.tsx`'s `preprocessJiraMarkup`) — not live while typing in the textarea, which is acceptable per user confirmation.

## Non-image file rendering
- Non-image attachments (PDF, zip, log, etc.) insert as `[^filename]` wiki link markup, which `preprocessJiraMarkup` already resolves to an `<a href>`; render that link as a styled attachment chip with a file-type icon and filename (CSS-only change — `className` is already allowlisted on `a` in the sanitize schema).

## New uploads (upload-on-paste/drop)
- Pasting or dropping a new file directly into the `CommentComposer` textarea uploads it as an attachment on the issue (reusing `AttachmentsSection`'s upload mutation) AND inserts its `!filename!`/`[^filename]` reference into the text in one motion, in addition to the toolbar/picker flow for already-attached files.

## Scope boundary (confirmed)
- Comments only. The description editor (`DescriptionEditor`, used only inside the Create/Edit Issue modal) is out of scope for this task — create mode has no issueKey to attach to, and the detail-page description is read-only outside that modal.
- No live-while-typing inline image rendering. Textarea + Preview tab is the accepted UX; re-landing the reverted TipTap editor is out of scope.

### Claude's Discretion
- Exact API/upload flow used for new-file uploads inside the editor: reuse `AttachmentsSection`'s existing upload mutation.
- Picker modal UI details (search/filter, thumbnails, sort order) — keep consistent with existing attachments panel styling; feed it from the existing `['jira-issue-detail', issueKey, jiraBaseUrl]` query (attachments already ride along — no new endpoint needed).
- Whether to extract a shared `WikiToolbar` component now (Bold/Italic/Code/List buttons are already duplicated between `DescriptionEditor` and `CommentComposer`) or just add the new button to `CommentComposer` directly — prefer extracting if it doesn't blow the quick-task budget, since it removes duplication the new button would otherwise triplicate.
- Non-image chip styling: `className` is already allowlisted on `a` in the sanitize schema used by `WikiRenderer`, so this is a CSS-only addition, not a schema change.

</decisions>

<specifics>
## Specific Ideas

No specific visual references given — follow the existing WikiEditor toolbar and attachments panel conventions already in the codebase.

</specifics>

<canonical_refs>
## Canonical References

[[project_wiki_editor]] is STALE — describes a TipTap WikiEditor that was reverted and does not exist in the current codebase (see Task Boundary correction above). Do not plan against it. Current reality: plain `<textarea>` editors + `WikiRenderer.tsx` preview with `preprocessJiraMarkup` already handling `!filename!` and `[^filename]` markup.

</canonical_refs>
