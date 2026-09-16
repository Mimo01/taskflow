# Quick Task 260916-sak: Insert attachments into descriptions/comments — Research

**Researched:** 2026-09-16
**Domain:** Jira wiki markup round-trip + textarea editor insert UX (taskflow)
**Confidence:** HIGH (all findings verified by reading the actual working tree + git history)

## Summary

**The CONTEXT.md premise is wrong and must be corrected before planning.** CONTEXT.md (and
the `[[project_wiki_editor]]` memory note) assume issue descriptions and comments are edited
through a shared TipTap v3 `WikiEditor` with `jiraToTiptap.ts` / `jiraWikiSerializer.ts`.
**None of that exists in the current tree.** There is no `@tiptap` dependency in
`taskflow/package.json`, no `node_modules/@tiptap`, no `src/components/wiki-editor/`, and no
converter files. The WikiEditor work exists only on an unmerged commit reachable from the tag
`backup/wiki-editor-before-revert-260531` — it was **reverted** and never landed on `main`
(`git merge-base --is-ancestor 7ab5c7a8 main` → NO). All editing today is **plain `<textarea>`
+ `insertAtCursor`/`applyMarkup` toolbars + a `WikiRenderer` preview**. Any plan written
against a TipTap custom node will not compile. [VERIFIED: working tree + git history]

**The good news: the rendering half of this task is already built and tested.**
`preprocessJiraMarkup` in `WikiRenderer.tsx` already resolves both Jira attachment syntaxes
against an `attachments` filename→URL map: `!filename!` (with `|options` stripped) → `<img>`,
and `[^filename]` → `<a href>`. There is a resolved debug note
(`.planning/debug/resolved/wiki-attachment-link-render.md`) documenting exactly why `[^file]`
needs the raw-HTML-anchor treatment. So inline images **already render as thumbnails** and
non-image refs **already render as links** wherever an `attachmentMap` is passed.

**So the actual work is the insertion UX plus chip styling**, not a markup round-trip.

**Primary recommendation:** Scope this as (1) a shared `AttachmentPicker` modal + toolbar
button that inserts `!file.png!` / `[^file.txt]` at the textarea cursor via the existing
`insertAtCursor` pattern, (2) paste/drop handlers that call the existing `uploadAttachment`
service then insert the ref, and (3) a CSS-only chip upgrade to the existing `[^filename]`
anchor in `WikiRenderer`. Do **not** introduce TipTap.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Toolbar "Insert attachment" button opening a picker modal of the issue's current attachments; selection inserts a reference at the cursor.
- Image attachments insert as `!filename!` Jira wiki image markup, rendering inline.
- Non-image attachments render as a styled chip/link with file-type icon + filename, not a bare link.
- Paste/drop of a new file uploads it to the issue AND inserts its reference in one motion.

### Claude's Discretion
- Exact API/upload flow for new-file uploads (reuse existing attach-file service call).
- Exact node/mark implementation for the attachment reference.
- Picker modal UI details (search/filter, thumbnails, sort order).
- How refs round-trip through the load/save pipeline for image and non-image cases.

### Constraint conflicts to resolve with the user
| CONTEXT.md says | Reality | Impact |
|---|---|---|
| "the shared TipTap WikiEditor" | Does not exist; reverted 2026-05-31 | The "custom TipTap node" discretion item is moot — use textarea + markup insertion |
| "inline images render as thumbnails" in the editor | Textarea is plain text; thumbnails appear only in the **Preview** tab / rendered view | Either accept preview-only rendering, or re-land WikiEditor (much larger scope) |

## Architectural Responsibility Map

| Capability | Owner | Rationale |
|---|---|---|
| Wiki markup → HTML for attachments | `preprocessJiraMarkup` (WikiRenderer.tsx) | Already implemented; shared by render + preview. Do not fork it. |
| Chip styling for `[^file]` | `preprocessJiraMarkup` emit + `markdownComponents.a` | `className` is already allowlisted on `a` in the sanitize schema |
| Cursor insertion of markup | `insertAtCursor` / `applyMarkup` in editor components | Existing pattern, 4 call sites |
| Picker data | `['jira-issue-detail', issueKey, jiraBaseUrl]` query (`issue.fields.attachment`) | No separate attachments endpoint exists; detail query already carries them |
| New-file upload | `uploadAttachment()` in `services/jira/attachments.ts` | Existing, used by 2 call sites |

## Key File Paths

All paths relative to `/Users/mimo/Documents/Projects/taskflow/taskflow/src/`.

### Rendering (already handles attachments)
| File | Lines | What |
|---|---|---|
| `routes/dashboard/WikiRenderer.tsx` | 780–799 | `!filename!` → `<img src>` via attachment map; strips `\|options`; `+`→`%20` |
| `routes/dashboard/WikiRenderer.tsx` | 831–838 | `[^filename]` → `<a href="url">filename</a>`; unknown → `` `filename` `` code span |
| `routes/dashboard/WikiRenderer.tsx` | 44–66 | `wikiSanitizeSchema` — `a` allows `href` + `className`; `img` allows `src` + `alt` |
| `routes/dashboard/WikiRenderer.tsx` | 68–69 | `export type AttachmentMap = Record<string, string>` (filename → URL) |
| `routes/dashboard/WikiRenderer.tsx` | 1211–1215 | `img` component → `<AuthImage>` (Jira attachment URLs need the PAT) |
| `routes/dashboard/WikiRenderer.test.tsx` | 1999, 2217–2273 | Existing tests for both syntaxes — extend these |

### Editors (insertion targets — all plain textarea)
| File | Lines | Notes |
|---|---|---|
| `routes/dashboard/DescriptionEditor.tsx` | 12–35, 48–100 | `insertAtCursor(ref, before, after, setValue, currentValue)`; Edit/Preview `Tabs`; toolbar Bold/Italic/Code/List |
| `routes/dashboard/CommentComposer.tsx` | 17–24, 180–235 | `applyMarkup(textarea, prefix, suffix) → {newValue, cursorPos}`; has toolbar + `MentionPopover` |
| `routes/dashboard/InlineComment.tsx` | ~269 | Bare `Textarea`, **no toolbar** |
| `routes/dashboard/IssueDetailView.tsx` | ~853 | CommentCard edit-mode `Textarea`, **no toolbar** |

### Attachments service + UI
| File | Signature / note |
|---|---|
| `services/jira/attachments.ts` | `uploadAttachment(baseUrl, token, issueKey, file: File): Promise<JiraAttachment[]>` — POST `/rest/api/2/issue/{key}/attachments`, FormData field `file`, header `X-Atlassian-Token: no-check`, no Content-Type |
| `services/jira/attachments.ts` | `deleteAttachment(baseUrl, token, attachmentId): Promise<void>` |
| `services/jira.ts:1633` | `JiraAttachment { id, filename, content, thumbnail?, mimeType, size? }` |
| `routes/dashboard/issue-detail/AttachmentsSection.tsx` | Drop-to-upload precedent: `useMutation` → `readSecret('jira-pat')` → `uploadAttachment` → invalidate `['jira-issue-detail', issueKey, jiraBaseUrl]` |
| `routes/dashboard/issue-detail/AttachmentUpload.tsx` | Same mutation shape behind an `Attach file` button + hidden file input |
| `routes/dashboard/issue-detail/AttachmentFileRow.tsx` | Icon + filename + size chip styling to mirror; `getFileIcon(mimeType)` returns `FileText` for `text/*` and `application/pdf`, else `File` |
| `routes/dashboard/issue-detail/AttachmentThumbnail.tsx` | Image thumbnail cell for the picker grid |
| `routes/dashboard/MentionPopover.tsx` | **Model for the picker**: `forwardRef` + imperative `handleKeyDown`, debounced query, click-outside dismiss, `onSelect` callback, `aria-activedescendant` wiring |

## Jira Wiki Markup — Verified Syntax

| Purpose | Markup | Status in codebase |
|---|---|---|
| Inline image attachment | `!filename.png!` | Handled, WikiRenderer:780 [VERIFIED: codebase + tests] |
| Image with options | `!filename.png\|thumbnail!`, `!f.png\|width=200!` | Options **stripped** by the regex `(?:\|[^!\n]*)?` — rendered full-size regardless [VERIFIED] |
| Non-image attachment link | `[^filename.txt]` | Handled, WikiRenderer:831 [VERIFIED: codebase + resolved debug note] |
| Remote image by URL | `!https://…!` | Handled → raw `<img>` [VERIFIED] |

**Insertion rule for the picker:** branch on `mimeType.startsWith('image/')` — exactly the
predicate `AttachmentsSection.tsx` already uses to split `images` / `nonImages`. Emit
`!${filename}!` for images, `[^${filename}]` for everything else.

**Filename gotcha:** filenames containing `!`, `|`, or `]` will break the respective regex.
Jira itself has no escape for this. Recommend: if `/[!|\]]/.test(filename)`, insert the
resolved URL form `!${att.content}!` for images, or a `[text|url]` link for non-images.
[ASSUMED — not covered by existing tests]

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---|---|---|
| Jira wiki → HTML for attachments | A second parser / TipTap node | `preprocessJiraMarkup` — already correct, shared with rendering, sanitize-allowlist is security-sensitive |
| Authenticated image loading | Raw `<img src>` with a Jira URL | `AuthImage` (WikiRenderer already maps `img` → it) |
| File upload | New fetch | `uploadAttachment()` |
| Cursor-anchored picker | New popover | `MentionPopover` pattern |
| Secret access | Direct store read | `readSecret('jira-pat')` |

## Common Pitfalls

### 1. `preprocessJiraMarkup` is shared and security-sensitive
The memory note is explicit: do not modify it for editor-only needs; its rehype-sanitize XSS
allowlist must stay intact. Adding a `className` to the `[^file]` anchor is safe (`a` already
allows `className` at WikiRenderer:65) — but adding a new tag name requires a schema change
plus an XSS guard test (precedent: `issuekeylink`).

### 2. Create-mode has no issueKey
`DescriptionEditor` is used **only** by `CreateEditIssueModal` (line 233). In `mode: 'create'`
no issue exists yet, so there is nothing to attach to and nothing to pick. The toolbar button
must be hidden/disabled in create mode. In `mode: 'edit'`, `initialValues.issueKey` is
available. [VERIFIED: CreateEditIssueModal.tsx:33,97]

### 3. The issue-detail description is read-only
`IssueDetailContent.tsx:290` renders description through `WikiRenderer` with no edit affordance.
There is no inline description editor on the detail page — editing goes through the modal.
Clarify with the user whether "descriptions" means the modal only.

### 4. Two comment editors have no toolbar
`InlineComment` and the `IssueDetailView` CommentCard edit-mode textarea are bare. Adding the
button to all four sites means either duplicating toolbar markup or extracting a shared
`WikiToolbar` — extraction is the better call and is a natural step toward eventually
re-landing a real editor.

### 5. `attachments={{}}` passed in two places
`InlineComment.tsx:298` and `MergeRequestDetailPage.tsx:236` pass an **empty** attachment map,
so any `[^file]` in those bodies degrades to a code span. If inline comments get insertion,
they also need the real map threaded through.

### 6. Blob URL / WKWebView
Per `[[project_wkwebview_blob_pdf_gotcha]]`, `blob:` URIs blank out in Tauri's macOS webview.
If an optimistic pre-upload preview is shown for a pasted image, use a `data:` URI (FileReader
`readAsDataURL`), not `URL.createObjectURL`. Simpler and recommended: **do not preview
optimistically** — insert the markup only after `uploadAttachment` resolves and the detail
query is invalidated, matching `AttachmentsSection`'s existing behavior.

### 7. Pre-commit hook runs the full vitest suite
Per `[[project_precommit_blocks_red_commits]]`, combine RED/GREEN into one commit per TDD task.

## Recommended Implementation Shape

1. **`WikiToolbar`** (new, shared) — extract the Bold/Italic/Code/List buttons currently
   duplicated in `DescriptionEditor` and `CommentComposer`, add a `Paperclip` "Insert
   attachment" button. Props: `{ onMarkup(prefix, suffix), issueKey?, jiraBaseUrl }`. Hide the
   attachment button when `issueKey` is undefined (create mode).
2. **`AttachmentPickerModal`** (new) — reads `issue.fields.attachment` from the existing
   `['jira-issue-detail', issueKey, jiraBaseUrl]` query (no new endpoint). Image grid reusing
   `AttachmentThumbnail`, file list reusing `AttachmentFileRow` styling, filename filter input.
   `onSelect(att)` → parent inserts `!name!` or `[^name]` at the cursor.
3. **Paste/drop** — `onPaste` reads `e.clipboardData.files`; `onDrop` reads
   `e.dataTransfer.files`. Reuse the `AttachmentsSection` mutation shape verbatim; on success
   insert the ref for each returned `JiraAttachment`. Note the drop handler must
   `stopPropagation` or `AttachmentsSection`'s section-level drop handler will also fire.
4. **Chip styling** — in `preprocessJiraMarkup`, emit
   `<a href="${url}" class="wiki-attachment-chip">${filename}</a>`; style in
   `markdownComponents.a` by checking `className` and prepending a lucide icon chosen with the
   same `getFileIcon` logic. `className` is already allowlisted — no sanitize schema change.

## Validation

**Framework:** vitest (`npm run check` is the gate; ~1700 tests).

| Behavior | Test |
|---|---|
| Image pick inserts `!name.png!` | new picker unit test |
| Non-image pick inserts `[^name.txt]` | new picker unit test |
| Chip class survives sanitize | extend `WikiRenderer.test.tsx` (~2217) |
| Unknown attachment → code span | existing regression test, keep green |
| Paste uploads + inserts | mock `uploadAttachment` |
| Button hidden in create mode | `CreateEditIssueModal.test.tsx` |

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Filenames with `!`/`\|`/`]` break the regexes | Rare filenames render broken |
| A2 | User accepts thumbnails only in Preview, not while typing | Scope balloons to re-landing TipTap |
| A3 | "Descriptions" means the create/edit modal only | Missing an edit surface |

## Open Questions

1. **Re-land WikiEditor, or textarea-only?** The reverted TipTap branch exists at tag
   `backup/wiki-editor-before-revert-260531`. Textarea-only is far smaller and matches the
   current tree; true in-editor inline thumbnails require the TipTap path. **Recommend
   textarea-only** and confirm with the user.
2. **Which surfaces get the button?** Description modal (edit mode) + CommentComposer are the
   clear wins; `InlineComment` and CommentCard edit mode need toolbars added from scratch.
3. **Should the memory note `[[project_wiki_editor]]` be corrected?** It describes reverted
   code as current and actively misleads planning.

## Sources

- **HIGH:** Direct reads of the working tree (paths and line numbers above); `git log`/`git
  merge-base` for the revert; `.planning/debug/resolved/wiki-attachment-link-render.md`;
  `taskflow/package.json`.
- Memory notes `[[project_wiki_editor]]` (**now stale**), `[[project_wkwebview_blob_pdf_gotcha]]`,
  `[[project_precommit_blocks_red_commits]]`.

**No new packages required** — therefore no package legitimacy audit.
