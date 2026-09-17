# Quick Task 260916-ta1: I want to enhance story creation and editing. Make the whole process more polished. Add option to add attachments to description and more - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Task Boundary

Enhance the story (issue) creation and editing flow (`CreateEditIssueModal.tsx` and its supporting files under `create-edit-issue/`). Primary ask: add the ability to attach files to the issue description while creating or editing a story, and generally polish the create/edit experience. Should reuse the attachment infrastructure already built for comments (`AttachmentPickerModal`, `attachment-markup.ts`, `uploadAttachment`) rather than inventing a parallel system.

</domain>

<decisions>
## Implementation Decisions

### Attachments during issue creation (no issue key yet)
- Stage picked/dropped files locally in the create modal (no upload yet — there is no issue key to attach to).
- After the issue is successfully created and a key is returned, upload the staged files to the new issue and insert `[^filename]` references into the description text (consistent with how attachment refs already resolve via `WikiRenderer`/`attachment-markup.ts`).
- If any staged-file upload fails after creation succeeds, the issue itself must still be considered created (do not roll back issue creation) — surface the upload failure separately so the user isn't confused about issue state.

### Edit mode (issue already has a key)
- Attachments can upload immediately (same as `CommentComposer`'s pattern) since the issue key already exists — no staging needed here.

### Scope of "more polished"
- In scope: attachments-in-description (create + edit), plus incidental, low-risk form UX polish noticed while implementing (spacing, validation feedback, loading states) in `CreateEditIssueModal.tsx` and its subcomponents.
- Out of scope: unrelated large redesigns, new fields, or workflow changes not tied to attachments/polish.
- Claude has discretion to decide which specific polish items are worth doing within this quick task's size — keep it a quick task (1-3 focused execution tasks), not a phase-sized rewrite.

### Attachment UX pattern
- Claude's discretion, but should default to reusing the exact `CommentComposer` pattern (paperclip toolbar button + paste/drop + `AttachmentPickerModal` + `[^file]` markup chips via `attachment-markup.ts`) for consistency across the app, adapted only as needed for the create-mode staging behavior above.

### Claude's Discretion
- Exact list of "form UX polish" items to include.
- Whether staged files (create mode) get a distinct visual treatment (e.g. "will upload on save" badge) vs. an uploaded chip — left to implementation, should be clear to the user which files are staged vs. already attached.

</decisions>

<specifics>
## Specific Ideas

No specific mockups or examples provided — follow the established `CommentComposer`/`AttachmentPickerModal`/`attachment-markup.ts` patterns already in the codebase (see `taskflow/src/routes/dashboard/CommentComposer.tsx`, `taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx`, `taskflow/src/lib/attachment-markup.ts`).

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` — modal being enhanced
- `taskflow/src/routes/dashboard/DescriptionEditor.tsx` — description field to extend with attachments
- `taskflow/src/routes/dashboard/CommentComposer.tsx` — reference implementation for attachment picker/paste/drop wiring
- `taskflow/src/lib/attachment-markup.ts` — `[^file]` reference markup helper
- `taskflow/src/services/jira/attachments.ts` — `uploadAttachment` service call (requires issue key)

</canonical_refs>
