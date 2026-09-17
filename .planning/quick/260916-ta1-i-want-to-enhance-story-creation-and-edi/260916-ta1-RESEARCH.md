# Quick Task 260916-ta1: Story Create/Edit Attachments + Polish - Research

**Researched:** 2026-09-17
**Domain:** React form UX, Jira attachment upload, in-app codebase patterns
**Confidence:** HIGH (all findings from direct codebase reading, no external libs needed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reuse existing attachment infra (`AttachmentPickerModal`, `attachment-markup.ts`, `uploadAttachment`) — no parallel system.
- **Create mode (no issue key yet):** stage picked/dropped files locally in the modal, no upload yet. After issue is created and a key is returned, upload staged files to the new issue and insert `[^filename]` refs into the description.
- If a staged-file upload fails post-creation, the issue itself is still considered created — do not roll back; surface upload failure separately.
- **Edit mode:** upload immediately, same as `CommentComposer`'s pattern (issue key already exists).
- In scope: attachments-in-description (create + edit) + incidental low-risk form UX polish (spacing, validation feedback, loading states) in `CreateEditIssueModal.tsx` and subcomponents.
- Out of scope: unrelated redesigns, new fields, workflow changes.
- Keep it a quick task (1-3 focused execution tasks), not phase-sized.

### Claude's Discretion
- Exact list of polish items to include.
- Whether staged files (create mode) get a distinct visual treatment ("will upload on save" badge) vs. an uploaded chip — must be visually clear which is which.
- Attachment UX pattern should default to reusing `CommentComposer`'s exact pattern (paperclip toolbar + paste/drop + `AttachmentPickerModal` + `[^file]` markup), adapted only for create-mode staging.

### Deferred Ideas (OUT OF SCOPE)
None recorded.
</user_constraints>

## Summary

`CommentComposer.tsx` (`taskflow/src/routes/dashboard/CommentComposer.tsx`) is the complete reference implementation: a paperclip toolbar button opens `AttachmentPickerModal` (pick existing issue attachment → insert ref), plus `onPaste`/`onDrop` handlers that call `uploadAttachment` directly and insert the resulting ref via `attachmentRef()`. `DescriptionEditor.tsx` currently has the same toolbar/textarea/tabs skeleton (bold/italic/code/bullet) but no attachment button, no upload wiring, and — critically — its Preview tab calls `<WikiRenderer wikiText={value} />` **without an `attachments` map**, so any `!image.png!` ref inserted there won't resolve to an `<img>` (CommentComposer passes `attachments={attachmentMap}`).

The hard constraint is `uploadAttachment(baseUrl, token, issueKey, file)` in `taskflow/src/services/jira/attachments.ts:23` — it hard-requires a real `issueKey` (used directly in the URL path); there is no "upload without an issue" Jira endpoint being used here. This is exactly why CONTEXT.md's decision to stage-then-upload-after-create is correct and necessary — there is no way to attach in create mode before the issue exists.

**Primary recommendation:** Give `DescriptionEditor` an optional attachment affordance via new props (`attachments`, `onInsertRef`, staged-file state passed from the parent) rather than making it fetch/upload internally — `CreateEditIssueModal` already owns issue-key/mode context that the upload decision depends on. Keep the upload/staging logic in `CreateEditIssueModal.tsx` (or a new small hook colocated in `create-edit-issue/`), mirroring `CommentComposer`'s mutation pattern, not a shared cross-cutting hook — this is a quick task, and `CommentComposer`'s logic is not currently extracted into a hook either, so inlining keeps the diff local and low-risk.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attachment picker UI (existing issue attachments) | Frontend component (`AttachmentPickerModal`) | — | Already generic/reusable, takes `attachments` + `onSelect` props, no issue-key coupling |
| File staging (create mode, pre-issue) | Frontend state (`CreateEditIssueModal` / form state) | — | Purely local `File[]` array; no network call possible yet (no issue key) |
| File upload (edit mode, or post-create in create mode) | Frontend → Jira REST API (`uploadAttachment`) | — | Requires issue key; identical to `CommentComposer`'s `uploadMutation` |
| `[^filename]` ref insertion into description text | Frontend (`attachment-markup.ts` + textarea cursor logic) | — | Pure string transform, already shared/testable, no coupling to fetch state |
| Description preview rendering (resolving refs to chips/images) | Frontend (`WikiRenderer`) | — | Needs an `attachments` map (filename → content URL) to resolve `!file!`/`[^file]`; `DescriptionEditor` currently omits this |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Picking an existing attachment to reference | New picker/dialog | `AttachmentPickerModal` (`issue-detail/AttachmentPickerModal.tsx`) — already takes `attachments`/`onSelect`, works for description too since it's issue-key-agnostic | Zero coupling to comments; identical UI needed |
| Building the `!file!` / `[^file]` markup string | New markup formatter | `attachmentRef()` in `taskflow/src/lib/attachment-markup.ts:34` | Already handles image vs non-image, hazardous-filename fallback |
| Uploading a File to Jira | New fetch/FormData code | `uploadAttachment(baseUrl, token, issueKey, file)` in `services/jira/attachments.ts:23` | Already sets `X-Atlassian-Token: no-check`, handles 401/403 via `ApiError` |
| Detecting image vs non-image attachment | New MIME check | `isImageAttachment()` in `attachment-markup.ts:12` | Kept in sync with `AttachmentsSection.tsx:42` deliberately per its own doc comment |

**Key insight:** everything needed already exists except (a) staged-file state for create mode, (b) wiring the attachment button + paste/drop + `attachments` map into `DescriptionEditor`, and (c) a "flush staged files after create succeeds" step in the create mutation's `onSuccess`.

## Code Examples

### Reference pattern to copy: CommentComposer's upload + insert (edit-mode-equivalent path)
```typescript
// Source: taskflow/src/routes/dashboard/CommentComposer.tsx:120-139
const uploadMutation = useMutation({
  mutationFn: async (file: File) => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No Jira credentials');
    return uploadAttachment(jiraBaseUrl, token, issueKey, file);
  },
  onSuccess: (created) => {
    setUploadingName(null);
    setUploadError(null);
    queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    const att = created[0];
    if (att) insertRef(attachmentRef(att));
  },
  onError: () => {
    setUploadError(`Failed to upload ${uploadingName ?? 'file'}. Check file size and try again.`);
    setUploadingName(null);
  },
});
```
For **edit mode** (`initialValues.issueKey` present), this is directly reusable — same `issueKey`, same `attachmentRef()` call, same insert-into-description target (`state.description` via `dispatch({type:'SET_FIELD', field:'description', ...})` instead of `setText`).

For **create mode**, there is no `issueKey` yet, so the equivalent flow must be split:
```typescript
// Staging (create mode) — purely local, no network call
const [stagedFiles, setStagedFiles] = useState<File[]>([]);
// on paste/drop/picker-add: setStagedFiles(prev => [...prev, file])
// UI shows a "will upload on save" chip per staged file — visually distinct from an
// uploaded attachment chip (per CONTEXT.md's discretion note)

// Flush after createMutation succeeds (inside useIssueMutations.ts's createMutation)
const newIssue = await createIssue(...); // taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts:100
for (const file of stagedFiles) {
  try {
    const [att] = await uploadAttachment(jiraBaseUrl, token, newIssue.key, file);
    // insert att's ref into the description that was just submitted — requires a
    // second bulkUpdateIssue/description PATCH since createIssue already ran, OR
    // append refs to the description string BEFORE calling createIssue (see Pitfall below)
  } catch (e) {
    // do NOT throw — issue creation must not be rolled back (locked decision)
    onStagedUploadError(file.name);
  }
}
```

### DescriptionEditor preview gap (must fix regardless of attachment feature)
```typescript
// Source: taskflow/src/routes/dashboard/DescriptionEditor.tsx:104-108 — current (BROKEN for image refs)
{value ? (
  <WikiRenderer wikiText={value} className="min-h-[120px]" />
) : ( ... )}

// Needed (mirrors CommentComposer.tsx:360):
<WikiRenderer wikiText={value} attachments={attachmentMap} className="min-h-[120px]" />
```
`DescriptionEditor` has no `attachments` prop today — it must be added and threaded from `CreateEditIssueModal` (edit mode: `initialValues` doesn't currently carry attachments either — check whichever caller passes `initialValues` and thread the issue's `JiraAttachment[]` through, same shape as `CommentComposer`'s `attachments` prop).

## Common Pitfalls

### Pitfall 1: Insert-ref-then-upload ordering in create mode
**What goes wrong:** If staged files are uploaded *after* `createIssue()` already submitted the description text, any `[^file]` refs the user expects inserted at cursor position during staging won't be in the description that was actually saved (description was already sent to Jira before the file existed on the server).
**Why it happens:** Two-phase flow (create issue → upload files) means the description snapshot used for issue creation predates the real attachment refs.
**How to avoid:** Two viable strategies — (1) insert `[^filename]` refs into `state.description` optimistically at staging time (before upload), using the raw filename since `attachmentRef()` needs the real `JiraAttachment` object (with `content` URL) which doesn't exist yet for hazardous filenames — acceptable since non-hazardous filenames produce identical `[^filename]` output whether staged or uploaded; OR (2) upload files first inside the create mutation (before calling `createIssue`), collect real `JiraAttachment[]`, build refs, and interpolate them into the description string used in the `createIssue` call, then run `createIssue` once with the final description. Option 2 is cleaner since Jira attachments don't require an issue key... **but they do** (see Pitfall 2) — so option 2 must actually be "call `createIssue` first with a placeholder-free description, then a follow-up `bulkUpdateIssue` PATCH appending refs after uploads succeed." Recommend surfacing this as an explicit task-planning decision rather than resolving here.
**Warning signs:** Description shown in the issue after creation doesn't contain the attachment ref the user expects, even though the attachment itself uploaded successfully.

### Pitfall 2: uploadAttachment truly requires an existing issue key
**What goes wrong:** Assuming there's a "create with attachments" Jira endpoint.
**Why it happens:** Jira DC's `POST /rest/api/2/issue/{issueKey}/attachments` (used at `attachments.ts:29`) is the only attachment endpoint in this codebase, and it's issue-scoped by URL path — confirmed by reading the full function body, no alternate "attach to draft" path exists.
**How to avoid:** Staging in create mode is mandatory, not optional — matches the locked CONTEXT.md decision. Do not attempt to find a create-time attachment API.
**Warning signs:** N/A — already resolved by the locked decision; flagging only so the planner doesn't second-guess it.

### Pitfall 3: DescriptionEditor is used in exactly one place today
**What goes wrong:** Over-engineering a generic "attachable rich text field" abstraction.
**Why it happens:** `grep -rl DescriptionEditor src` shows only `CreateEditIssueModal.tsx` imports it (plus its own file) — it is not used in an issue-detail read/edit view elsewhere in this codebase snapshot.
**How to avoid:** Keep the new attachment props specific to what `CreateEditIssueModal` needs (staged vs. immediate upload mode flag), rather than building a fully generic reusable API surface for a hypothetical second consumer.
**Warning signs:** N/A — just scope discipline for a quick task.

### Pitfall 4: stopPropagation needed on drop, same as CommentComposer
**What goes wrong:** If `DescriptionEditor`'s textarea is ever rendered inside another drop-target ancestor, a drop that isn't `stopPropagation()`'d will double-fire (see `CommentComposer.tsx:174-185` comment referencing `AttachmentsSection.tsx:122`).
**How to avoid:** Copy the exact `handleDragOver`/`handleDrop` pattern including `e.stopPropagation()`, even though `CreateEditIssueModal`'s dialog is unlikely to have a conflicting outer drop handler today — cheap insurance, matches established convention.

## Test Patterns to Follow

- `taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx` (189 lines) is the direct template: mocks `@/services/jira/attachments` (`uploadAttachment`), `@/services/stronghold` (`readSecret`), `react-router-dom` (WikiRenderer needs `useNavigate`/`useLocation`), and `@/lib/useDetectedBrowsers` (Tauri command stub). Tests cover: opening picker from paperclip button, image-ref insertion at cursor, non-image ref insertion, paste-upload-insert, drop-upload-insert (asserts `stopPropagation`), inline error on upload failure (and that nothing is inserted), and Preview tab rendering `!name.png!` as an `<img>`.
- `taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx` (218 lines, test IDs `CREATE-01`..`CREATE-04`) mocks `@/stores/auth.store`, `@/stores/settings.store`, `@/services/jira` (partial mock via `importOriginal`), and `@/lib/apiFetch`. New attachment tests for this modal should follow this same mocking scaffold and add `vi.mock('@/services/jira/attachments', ...)` as the attachments test file does. Recommend a new `CreateEditIssueModal.attachments.test.tsx` sibling file rather than growing the existing 218-line file, matching the `CommentComposer` / `CommentComposer.attachments.test.tsx` split already established in this codebase.

## Concrete Polish Opportunities (brief, low-risk only)

- `CustomFieldsSection.tsx:98` — loading state (`creatmetaLoading && !creatmetaFields`) exists but only for custom fields; the top-level summary/description/assignee fields show no skeleton while `creatmetaLoading`/`assigneeLoading` are true — likely fine to leave, but note if executor wants a quick global "loading required fields…" banner.
- Submit button disable logic (`CreateEditIssueModal.tsx:546`) shows generic "Creating…/Saving…" text but there's no visible spinner icon — a `Loader2` icon (already used elsewhere in the codebase per lucide-react convention) next to the pending label would be a near-zero-risk polish item.
- `state.apiError` (`CreateEditIssueModal.tsx:534-538`) is the only error surface; there's no per-field validation feedback (e.g., malformed time estimate). Out of scope per CONTEXT.md unless trivial.
- Attachment staged-file chips (new) should visually reuse existing chip styling from `AttachmentFileRow.tsx`/`AttachmentThumbnail.tsx` (both already imported by `AttachmentPickerModal.tsx`) rather than inventing new chip markup — check those two files if executor needs a staged-chip visual reference.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest resolution to Pitfall 1 (ref-ordering) is a follow-up `bulkUpdateIssue` PATCH after upload, rather than resequencing `createIssue`, but this wasn't user-confirmed | Common Pitfalls | Planner may pick a different sequencing than the user expects; low risk since either approach satisfies the locked "don't roll back issue creation" constraint |
| A2 | No existing `initialValues` attachments prop is threaded to `CreateEditIssueModal` today (edit mode) — assumed based on `EditInitialValues` interface not listing `attachments`, not exhaustively traced from every caller | Code Examples | If some caller already fetches issue attachments elsewhere, the executor may find an existing source to wire instead of adding a new query |

## Open Questions

1. **Where should the staged-file → uploaded-ref reconciliation happen for create mode — before or after `createIssue()`?**
   - What we know: `uploadAttachment` needs a real issue key; `createIssue` returns the key.
   - What's unclear: whether a two-request flow (create then patch-description) is acceptable UX/latency-wise, vs. accepting that refs inserted at staging time use plain filenames without waiting for the real attachment ID.
   - Recommendation: since filenames are almost always the ref content anyway (`attachmentRef()` only diverges for hazardous chars), the simplest and lowest-risk approach is to insert `[^filename]`/`!filename!` refs into `state.description` at staging time (same as edit mode does after upload), then upload the actual files in `createMutation`'s `onSuccess` using the already-finalized description's filenames — no follow-up PATCH needed for the common case. Only diverge (extra PATCH) if a staged filename turns out hazardous, which is a rare edge case the planner can explicitly descope or handle with a PATCH.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed, all internal code read directly
- Architecture: HIGH — traced actual prop flow between `CreateEditIssueModal` → `DescriptionEditor` → `WikiRenderer`
- Pitfalls: MEDIUM — Pitfall 1's resolution is a design judgment call, not a verified fact

**Research date:** 2026-09-17
**Valid until:** No expiry concern — purely internal codebase research, stable until these files change
