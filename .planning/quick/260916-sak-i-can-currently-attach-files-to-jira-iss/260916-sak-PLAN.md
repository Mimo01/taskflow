---
phase: quick-260916-sak
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/attachment-markup.ts
  - taskflow/src/lib/attachment-markup.test.ts
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.test.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
autonomous: true
requirements: [SAK-01, SAK-02, SAK-03, SAK-04]

must_haves:
  truths:
    - "A Paperclip 'Insert attachment' button in the comment composer toolbar opens a picker listing the issue's current attachments"
    - "Selecting an image attachment inserts !filename! at the textarea cursor; selecting a non-image inserts [^filename]"
    - "Switching the composer to its Preview tab renders inserted image references as inline thumbnails and non-image references as file chips"
    - "Pasting or dropping a new file into the composer uploads it to the issue and inserts its reference in one motion"
    - "A resolved [^filename] reference renders as a styled chip with a file-type icon, not a bare link"
  artifacts:
    - path: "taskflow/src/lib/attachment-markup.ts"
      provides: "attachmentRef(attachment) -> Jira wiki markup string"
      exports: ["attachmentRef"]
    - path: "taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx"
      provides: "Dialog picker over JiraAttachment[] with filename filter"
      exports: ["AttachmentPickerModal"]
    - path: "taskflow/src/routes/dashboard/CommentComposer.tsx"
      provides: "Toolbar attachment button, Edit/Preview tabs, paste/drop upload+insert"
      contains: "AttachmentPickerModal"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "CommentComposer"
      via: "attachments prop from issue.fields.attachment"
      pattern: "attachments=\\{issue"
    - from: "taskflow/src/routes/dashboard/CommentComposer.tsx"
      to: "services/jira/attachments.uploadAttachment"
      via: "paste/drop mutation"
      pattern: "uploadAttachment"
    - from: "taskflow/src/routes/dashboard/WikiRenderer.tsx"
      to: "markdownComponents.a"
      via: "wiki-attachment-chip className emitted by preprocessJiraMarkup"
      pattern: "wiki-attachment-chip"
---

<objective>
Let users reference issue attachments from inside comment text: an "Insert attachment" toolbar
button + picker modal that inserts Jira wiki markup at the cursor, upload-on-paste/drop that
attaches a new file and inserts its reference in one motion, and a styled file chip for resolved
`[^filename]` references.

Purpose: attachments can be uploaded today but cannot be referenced in comment bodies.
Output: one shared markup helper, one picker modal, composer wiring, and chip styling in the renderer.

Scope is LOCKED to the comment composer. The description editor (`DescriptionEditor`, used only by
`CreateEditIssueModal`) is explicitly out of scope — create mode has no issueKey to attach to.
Do NOT introduce TipTap; the WikiEditor referenced by `[[project_wiki_editor]]` was reverted and
does not exist in this tree (RESEARCH, HIGH confidence).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260916-sak-i-can-currently-attach-files-to-jira-iss/260916-sak-CONTEXT.md
@.planning/quick/260916-sak-i-can-currently-attach-files-to-jira-iss/260916-sak-RESEARCH.md

Existing code you must read before editing (all under `taskflow/src/`):
@taskflow/src/routes/dashboard/CommentComposer.tsx
@taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.tsx
@taskflow/src/routes/dashboard/issue-detail/AttachmentThumbnail.tsx
@taskflow/src/services/jira/attachments.ts

Interfaces you are building against (verified, do not re-derive):
- `JiraAttachment { id, filename, content, thumbnail?, mimeType, size? }` (services/jira.ts:1633)
- `uploadAttachment(baseUrl, token, issueKey, file): Promise<JiraAttachment[]>` (services/jira/attachments.ts:23)
- `applyMarkup(textarea, prefix, suffix) => { newValue, cursorPos }` (CommentComposer.tsx:16)
- `export type AttachmentMap = Record<string, string>` filename→URL (WikiRenderer.tsx:69)
- `preprocessJiraMarkup` already resolves `!filename!` → `<img src>` (WikiRenderer.tsx:780) and
  `[^filename]` → `<a href>` / code-span fallback (WikiRenderer.tsx:831)
- `wikiSanitizeSchema` already allowlists `className` on `a` (WikiRenderer.tsx:64) — NO schema change needed
- Image/non-image split predicate in use today: `(a.mimeType ?? '').startsWith('image/')` (AttachmentsSection.tsx:42)
- `getFileIcon(mimeType)` → `FileText` for `text/*` and `application/pdf`, else `File` (AttachmentFileRow.tsx:19)
- Upload mutation shape to mirror: `readSecret('jira-pat')` → `uploadAttachment` → invalidate
  `['jira-issue-detail', issueKey, jiraBaseUrl]` (AttachmentsSection.tsx:48-64)
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Markup helper + attachment picker modal</name>
  <files>taskflow/src/lib/attachment-markup.ts, taskflow/src/lib/attachment-markup.test.ts, taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx, taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.test.tsx</files>
  <behavior>
    attachment-markup.ts:
    - image attachment (mimeType starts with `image/`) → `!filename.png!`
    - non-image attachment → `[^report.pdf]`
    - missing/undefined mimeType → treated as non-image
    - hazardous filename (matches `/[!|\]]/`) → fall back to the resolved-URL form so the
      regexes in preprocessJiraMarkup cannot be broken: image → `!<content-url>!`,
      non-image → `[<sanitized filename with hazard chars stripped>|<content-url>]`
    AttachmentPickerModal:
    - renders nothing selectable when `attachments` is empty; shows an empty-state message
    - renders image attachments as a thumbnail grid and non-images as file rows
    - typing in the filter input narrows both lists by case-insensitive filename substring
    - clicking an entry calls `onSelect(attachment)` once and then `onOpenChange(false)`
  </behavior>
  <action>
    Create `taskflow/src/lib/attachment-markup.ts` exporting
    `attachmentRef(att: JiraAttachment): string` implementing the branching above (per D-02 for
    images and D-03 for non-images). Also export `isImageAttachment(att)` using the exact predicate
    already used in AttachmentsSection.tsx:42 so the two surfaces cannot drift. Keep the module
    free of React imports — it is pure string logic and must be unit-testable in isolation.

    Create `taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx` exporting
    `AttachmentPickerModal({ open, onOpenChange, attachments, onSelect })`. Build it on the existing
    `@/components/ui/dialog` primitives (Dialog/DialogContent/DialogHeader/DialogTitle) — follow the
    prop shape used by `routes/dashboard/release-detail/CreateBranchDialog.tsx`. Inside: an `Input`
    filter bound to local state, then the filtered image attachments rendered with the existing
    `AttachmentThumbnail` component and the filtered non-images rendered with the same icon +
    filename + size layout as `AttachmentFileRow` (reuse `formatFileSize`, exported at
    AttachmentFileRow.tsx:95; do NOT reuse AttachmentFileRow itself — it carries download/delete
    actions that make no sense in a picker). Each entry is a `<button type="button">` whose
    accessible name is the filename. Selection calls `onSelect(att)` then closes.
    Per D-01 this is the picker for the comment composer only; keep it presentational — it receives
    `attachments` as a prop and owns no query (the detail query is the caller's concern).

    Write tests in the two `.test.ts(x)` files covering every bullet in `<behavior>`. Per
    `[[project_precommit_blocks_red_commits]]`, commit RED and GREEN together as one commit for this
    task — the pre-commit hook runs the full vitest suite and would reject a RED-only commit.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/lib/attachment-markup.test.ts src/routes/dashboard/issue-detail/AttachmentPickerModal.test.tsx</automated>
  </verify>
  <done>Both test files pass; `attachmentRef` returns `!name!` for images, `[^name]` for non-images, and the URL fallback for hazardous filenames; the modal filters and emits `onSelect`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire picker, preview tab, and paste/drop upload into CommentComposer</name>
  <files>taskflow/src/routes/dashboard/CommentComposer.tsx, taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx, taskflow/src/routes/dashboard/IssueDetailView.tsx</files>
  <behavior>
    - Toolbar renders a Paperclip button titled "Insert attachment"; clicking it opens AttachmentPickerModal
    - Selecting an image from the picker inserts `!diagram.png!` at the current cursor position,
      preserving text before and after the cursor, and returns focus to the textarea
    - Selecting a non-image inserts `[^spec.pdf]`
    - Pasting a file (clipboardData.files non-empty) calls `uploadAttachment` and, on resolve,
      inserts the returned attachment's reference; the raw paste does not also insert file text
    - Dropping a file on the textarea uploads + inserts the same way and does not bubble to
      AttachmentsSection's section-level drop handler
    - Upload failure shows an inline error and inserts nothing
    - The Preview tab renders the current text through WikiRenderer with the attachment map, so an
      inserted `!name.png!` resolves to an image element
    - Existing behavior preserved: placeholder "Add a comment…", @mention popover, submit button
  </behavior>
  <action>
    Extend `CommentComposerProps` with `attachments: JiraAttachment[]` and update the single call
    site at `IssueDetailView.tsx:621` to pass `attachments={issue?.fields.attachment ?? []}` —
    `issue` is already in scope there (the same source feeds `attachmentMap` at IssueDetailView.tsx:264).
    Passing the array down as a prop (rather than reading the query cache imperatively inside the
    composer) keeps the picker reactive after an upload invalidation — see
    `[[project_reactive_cache_read_badge]]`.

    In CommentComposer:
    1. Add a Paperclip toolbar button (lucide `Paperclip`, `size-3.5`, same
       `p-1 rounded hover:bg-accent` classes as the existing Bold/Italic/Code/List buttons) with
       `title="Insert attachment"` that sets picker-open state. Per D-01 this button lives in the
       comment toolbar only — do NOT touch `DescriptionEditor.tsx`. Do not extract a shared
       WikiToolbar in this task: the CONTEXT discretion note permits extraction only if it fits the
       quick-task budget, and it does not; record the deferral in the SUMMARY.
    2. Insert via the existing `applyMarkup(textarea, ref, '')` path used by `handleMarkup`, so
       cursor restoration stays on the one code path already proven by tests.
    3. Wrap the editor in `Tabs` (`@/components/ui/tabs`) with `defaultValue="edit"` and Edit /
       Preview triggers, mirroring `DescriptionEditor.tsx:42-48`. The Preview tab renders
       `<WikiRenderer wikiText={text} attachments={attachmentMap} />` where `attachmentMap` is built
       from the new `attachments` prop (`filename -> att.content`). This is what makes D-02's
       "renders as an inline thumbnail in the Preview tab" true — the composer has no preview tab today.
       Keep the toolbar, textarea, mention popover, error line and submit button inside/under the
       Edit tab exactly as they are so the existing `IssueDetailSheet.test.tsx` comment tests
       (placeholder + `getByRole('button', { name: /comment/i })`) keep passing.
    4. Add `onPaste` / `onDrop` handlers on the Textarea implementing D-04. Read
       `e.clipboardData.files` / `e.dataTransfer.files`; if non-empty, `e.preventDefault()` and, for
       drop, `e.stopPropagation()` (AttachmentsSection.tsx:122 has a section-level drop handler that
       would otherwise double-upload). Use a `useMutation` whose `mutationFn` mirrors
       AttachmentsSection.tsx:48-64 verbatim (`readSecret('jira-pat')` → `uploadAttachment`), and in
       `onSuccess(created)` invalidate `['jira-issue-detail', issueKey, jiraBaseUrl]` and insert
       `attachmentRef(created[0])` at the cursor. Show an inline `text-xs text-destructive` message
       on error and a pending "<name> uploading…" line, matching the section's copy.
       Do NOT render an optimistic local preview — per `[[project_wkwebview_blob_pdf_gotcha]]`,
       `blob:` URIs blank out in the Tauri macOS webview; insert only after the upload resolves.

    Write `CommentComposer.attachments.test.tsx` covering every `<behavior>` bullet. Mock
    `@/services/jira/attachments` and `@/services/stronghold`; copy the QueryClientProvider `wrapper`
    and mock setup from `IssueDetailSheet.test.tsx:1-25`. Build paste/drop events with a
    `{ files: [new File([...], 'shot.png', { type: 'image/png' })] }` payload on
    `clipboardData` / `dataTransfer`. Commit RED+GREEN as one commit (pre-commit runs the full suite).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/CommentComposer.attachments.test.tsx src/routes/dashboard/IssueDetailSheet.test.tsx</automated>
  </verify>
  <done>New composer tests pass and the pre-existing IssueDetailSheet comment tests stay green; picker insertion, preview tab, and paste/drop upload+insert all work.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Render resolved [^filename] references as styled file chips</name>
  <files>taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx</files>
  <behavior>
    - `[^report.pdf]` with a matching attachment renders an anchor carrying class `wiki-attachment-chip`
      that survives rehype-sanitize
    - The chip renders a file-type icon plus the filename (icon chosen by the same rule as
      AttachmentFileRow's getFileIcon)
    - `[^unknown.txt]` with no matching attachment still renders the existing code-span fallback (regression)
    - A normal external link (no chip class) keeps its existing openExternal / internal-path behavior (regression)
    - XSS guard: a crafted `class` attribute in user wiki text cannot inject a new tag (existing guard test stays green)
  </behavior>
  <action>
    In `preprocessJiraMarkup` (WikiRenderer.tsx:831-837), change the resolved branch to emit
    `<a href="${url}" class="wiki-attachment-chip">${filename}</a>`. Leave the unresolved code-span
    fallback byte-identical. Do NOT touch `wikiSanitizeSchema` — `className` is already allowlisted on
    `a` (WikiRenderer.tsx:64); this is a CSS-only change per D-03. Do not add a new tag name; that
    would require a schema change plus an XSS guard test.

    In the `a` override inside `markdownComponents` (WikiRenderer.tsx:1314), add an early branch:
    when `rest.className` includes `wiki-attachment-chip`, render the anchor as an inline chip —
    `inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-xs no-underline
    hover:bg-muted` — containing a lucide icon and the filename children. Choose the icon with the
    same rule as `getFileIcon` (FileText for `.pdf`/`.txt`/`.log`/`.md`, else File); derive it from the
    filename extension here since the renderer has no mimeType. Preserve the existing click handling
    for this branch (the chip is still an external attachment URL and must keep routing through the
    same openExternal boundary) — extract or reuse the existing `handleClick`, do not fork it.

    Extend `WikiRenderer.test.tsx` near the existing attachment-reference tests (~lines 2217-2273)
    with cases for every `<behavior>` bullet. Commit RED+GREEN as one commit.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx</automated>
  </verify>
  <done>Chip class survives sanitize, chip renders icon + filename, and all pre-existing WikiRenderer tests (unknown-attachment code span, external-link routing, XSS guard) stay green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira issue content → WikiRenderer | Attachment filenames and comment bodies are attacker-influencable strings that reach raw-HTML emission |
| User filesystem → Jira API | Pasted/dropped files are uploaded to the issue under the user's PAT |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sak-01 | Tampering | `preprocessJiraMarkup` raw `<a class=...>` emission | mitigate | Emit only the literal constant `wiki-attachment-chip`; never interpolate user input into the class attribute. rehype-sanitize allowlist unchanged; existing XSS guard test must stay green (Task 3) |
| T-sak-02 | Tampering | `attachmentRef` filename interpolation | mitigate | Filenames containing `!`, `\|`, or `]` fall back to the resolved-URL form so they cannot break out of the markup regexes (Task 1) |
| T-sak-03 | Information disclosure | paste/drop upload | accept | Upload targets the same issue the user already has open and can attach to via the existing button; no new privilege or endpoint |
| T-sak-04 | Spoofing | Jira PAT read for upload | mitigate | Reuse `readSecret('jira-pat')` — no new secret path, no token logging |
| T-sak-SC | Tampering | npm/pip/cargo installs | n/a | No new packages — RESEARCH confirms zero dependencies added, so no legitimacy audit applies |
</threat_model>

<verification>
- `cd taskflow && npm test` — full vitest suite green (~1700 tests)
- `cd taskflow && npm run check` — biome + tsc clean; per `[[project_biome_state]]` gate on
  "no NEW files flagged", not an absolute diagnostic count
- `DescriptionEditor.tsx` untouched (`git diff --name-only` must not list it) — description is out of scope per CONTEXT
- No `@tiptap` import anywhere: `grep -rn "@tiptap" taskflow/src | grep -v '^#' | wc -l` returns 0
</verification>

<success_criteria>
- Comment toolbar has an "Insert attachment" button opening a filtered picker of the issue's attachments (D-01)
- Image selection inserts `!filename!`, non-image selection inserts `[^filename]`, both at the cursor (D-02, D-03)
- Composer Preview tab renders inserted image refs as inline images and non-image refs as file chips (D-02, D-03)
- Paste/drop of a new file uploads it to the issue and inserts its reference in one motion (D-04)
- Description editor and create-issue modal are unchanged (scope boundary)
- Full test suite and `npm run check` pass
</success_criteria>

<output>
Create `.planning/quick/260916-sak-i-can-currently-attach-files-to-jira-iss/260916-sak-SUMMARY.md` when done.
Record in the SUMMARY: the deliberate deferral of the shared `WikiToolbar` extraction, and the fact
that `InlineComment.tsx:298` / `MergeRequestDetailPage.tsx:236` still pass `attachments={{}}` (so
`[^file]` degrades to a code span there) — both known, out of scope, not gaps.
</output>
