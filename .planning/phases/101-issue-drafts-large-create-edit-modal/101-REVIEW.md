---
phase: 101-issue-drafts-large-create-edit-modal
reviewed: 2026-11-18T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - taskflow/src-tauri/Cargo.toml
  - taskflow/src-tauri/capabilities/default.json
  - taskflow/src-tauri/src/lib.rs
  - taskflow/src/components/app/DraftsChip.tsx
  - taskflow/src/components/app/TopBar.tsx
  - taskflow/src/components/ui/issue-type-icon.tsx
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/host.ts
  - taskflow/src/components/wiki-editor/nodeviews/ImageView.tsx
  - taskflow/src/components/wiki-editor/types.ts
  - taskflow/src/hooks/useDraftStagedFiles.ts
  - taskflow/src/hooks/useDraftsAccountGuard.ts
  - taskflow/src/hooks/useIssueDraft.ts
  - taskflow/src/hooks/useProjectFixVersions.ts
  - taskflow/src/lib/fix-version-order.ts
  - taskflow/src/lib/issue-draft-files.ts
  - taskflow/src/lib/issue-draft-snapshot.ts
  - taskflow/src/lib/issueDisplayUtils.ts
  - taskflow/src/lib/relative-time.ts
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
  - taskflow/src/routes/dashboard/EpicsPage.tsx
  - taskflow/src/routes/dashboard/StagedFilesStrip.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/AutocompleteField.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/FixVersionField.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/IssueTypeSelector.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/LabelsField.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/field-styles.ts
  - taskflow/src/routes/dashboard/create-edit-issue/issue-field-diff.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useDraftResume.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/issue-actions.ts
  - taskflow/src/routes/settings/ConnectionsSection.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/stores/create-modal.store.ts
  - taskflow/src/stores/issue-drafts.store.ts
findings:
  critical: 2
  warning: 7
  info: 2
  total: 11
status: issues_found
---

# Phase 101: Code Review Report

**Reviewed:** 2026-11-18
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

The draft store, autosave hook, account guard and chip are generally sound (hydration gating, edit-tick keyed autosave, undo window). The real problems sit at the seams. A type switch leaves hidden-field values in the Create payload. Resume validation treats an empty or failed createmeta as authoritative and wipes draft data. Resumed Subtask drafts lose parent inheritance. Staged-file bookkeeping is keyed by file name only, which loses or resurrects attachments. No React Compiler stale-read issues were found in the changed code: `useLocalPreview` correctly uses `useSyncExternalStore`.

## Critical Issues

### CR-01: Hidden / off-screen field values are still sent after an issue-type switch (wrong Jira payload)

**File:** `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts:66-80` (also `issue-field-diff.ts:22-30`, `useCreateEditForm.ts:207-215`)
**Issue:** `SET_ISSUE_TYPE` only resets parent/epic. `customFieldValues`, `labels`, `fixVersions` and `priority` survive a Story to Bug/Defect switch. The create payload then sends every non-empty `state.customFieldValues` entry. If the field is absent from the new type's createmeta it goes through as a raw string (`fieldMeta ? wrap : v`). `labelsFixVersionsCreateFields` sends `fixVersions` whenever the array is non-empty and the type isn't Subtask, even when `fixVersionsOffered` is false for the new type. The sidebar hides that field (`ModalSidebar` `showFixVersion`). Jira returns 400 "Field cannot be set / not on the appropriate screen" and the user has no visible control to clear it. Resume validation has the same gap for fixVersions and labels: it only checks version ids, not whether the field is offered.
**Fix:** Gate the payload on the current createmeta.
```ts
const offered = new Set(creatmetaFields?.map((f) => f.fieldId));
for (const [k, v] of Object.entries(state.customFieldValues)) {
  if (v.trim() === '') continue;
  const fieldMeta = creatmetaFields?.find((f) => f.fieldId === k);
  if (!fieldMeta) continue; // not on this type's create screen
  options[k] = wrapCustomFieldValue(fieldMeta, v);
}
// and only add labels / fixVersions when offered.has('labels') / offered.has('fixVersions')
```

### CR-02: Resume validation treats an empty/failed createmeta as authoritative and wipes custom-field data

**File:** `taskflow/src/lib/issue-draft-snapshot.ts:112-135`, `taskflow/src/routes/dashboard/create-edit-issue/useDraftResume.ts:158-168`
**Issue:** `fetchCreatemeta` returns `[]` when both endpoints fail (non-ok, e.g. transient 5xx or 403) or the token is missing (`queryFn` returns `[]`). `validateSnapshot` only guards `if (ctx.createmetaFields)`. `[]` is truthy, so every custom field fails `byId.get(key)`. All values are deleted and a "no longer available" note is shown per field. `validatedRef` is then latched and the next edit autosaves the stripped snapshot over the stored draft. That is permanent data loss from a transient error. The paginated createmeta call (`maxResults=50`) has the same effect for fields past the first page.
**Fix:** Treat empty or errored createmeta as unknown. Pass `undefined` when `creatmetaFields?.length === 0` or the query errored. Page through the createmeta results. Also keep the original draft until the user edits, rather than rewriting from the cleaned state.

## Warnings

### WR-01: Removing a file while its disk copy is still being written resurrects it in the draft

**File:** `taskflow/src/hooks/useDraftStagedFiles.ts:39-62`
**Issue:** `remove()` filters `refs` immediately, but an in-flight `stageDraftFile(...).then` still adds the ref afterwards. `generationRef` only changes on `reset`. The removed file stays in the saved draft and is restored on resume. The disk copy is also never deleted on `remove`.
**Fix:** Track removed or in-flight names (or per-file tokens). Ignore the `.then` when the file is no longer in `files`. Optionally delete the disk copy on `remove`.

### WR-02: Staged files are keyed by name only (clipboard images collide)

**File:** `taskflow/src/hooks/useDraftStagedFiles.ts:42,58`, `taskflow/src/lib/issue-draft-files.ts:27`
**Issue:** Pasted screenshots are all named `image.png`. They share the disk path `issue-drafts/<id>/image.png`, so the second write overwrites the first. `refs` dedupes by name. `remove()` drops the ref for every same-named file. On resume only one file comes back (silent loss). `safeDraftFileName` also collides `a..b` and `ab`, and case-insensitive APFS collides `A.png` and `a.png`.
**Fix:** Store under a unique segment (`${index or uuid}-${safeName}`) and key refs by that path, not by name.

### WR-03: Resumed Subtask drafts lose parent inheritance and show an editable parent input

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:308-313,781`
**Issue:** `inheritFromKey` for Subtasks uses `defaultParentKey`, which is undefined when resuming (the chip only supplies `resumeDraftId`). Required custom fields that the parent normally supplies (e.g. Account) are not inherited, so `requiredCustomFieldsFilled` blocks submit or the payload lacks them. `ModalSidebar` renders a free-text parent input instead of the fixed parent chip, and no parent summary is shown.
**Fix:** Use `state.parentKey` for the Subtask branch: `state.selectedIssueType === 'Subtask' ? (state.parentKey ?? undefined) : ...`. Derive the fixed-parent display from it as well.

### WR-04: Fix-version picker uses the active project, not the resumed draft's project

**File:** `taskflow/src/hooks/useProjectFixVersions.ts:7-19`, `FixVersionField.tsx:24`
**Issue:** The modal latches `projectKey` to the draft's project (D-14) and creates the issue there. `useProjectFixVersions` always reads `activeJiraProject`, so the picker lists the wrong project's versions. The draft's saved ids are kept unvalidated when `sameProject` is false, and a new pick is submitted against the draft's project. Jira rejects either case with a 400.
**Fix:** Give the hook a `projectKey` parameter and pass the modal's `projectKey`. Keep the cache key `['jira-fix-versions', projectKey, base]`, which is still shape-compatible with FieldsSection.

### WR-05: Draft-file path from the persisted store is used unvalidated

**File:** `taskflow/src/lib/issue-draft-files.ts:36-39`
**Issue:** `readDraftFile` reads `ref.path` straight from `issue-drafts.json`, and drafts are rehydrated without schema validation. A malformed or tampered entry (`issue-drafts/../..`) is only stopped by Tauri's scope matching. Write and remove paths use the regex'd id. The read path should not rely on the scope alone.
**Fix:** Require `/^issue-drafts\/[A-Za-z0-9-]+\/[^/\\]+$/` and no `..` segment before reading. Return `null` otherwise. Also shape-check persisted drafts on rehydrate (a malformed `snapshot.fixVersions` throws in `useDraftResume`).

### WR-06: Draft edits made before store hydration are silently dropped

**File:** `taskflow/src/hooks/useIssueDraft.ts:50-51`
**Issue:** `flush` returns early when the store isn't hydrated, after `clearTimer()`. `pendingRef` stays set but nothing re-schedules it. If the user types or pastes immediately after launch and closes the modal, the edit is never persisted.
**Fix:** Re-arm the timer (or subscribe to `onFinishHydration`) when `pendingRef` is non-null and the store isn't hydrated.

### WR-07: Uncommitted label text is lost on Cmd+Enter submit and on close

**File:** `taskflow/src/routes/dashboard/create-edit-issue/LabelsField.tsx:15-18,53-60`
**Issue:** Typed-but-uncommitted label text lives in local `useState` and is only committed on Enter, comma, Tab or blur. Cmd+Enter from the label input submits without a blur, so the label is dropped from the created issue. Labels may be required. The local text is also not part of the draft.
**Fix:** Commit pending text in the `Cmd/Ctrl+Enter` branch (or lift the pending text into form state), and commit on unmount.

## Info

### IN-01: JQL built by string interpolation without escaping

**File:** `taskflow/src/services/jira.ts:2686-2693`
**Issue:** `projectKey` and `issueTypeName` are interpolated into quoted JQL. For resumed drafts they come from unvalidated persisted JSON. The impact is limited to the user's own token, but a quote breaks the query and silently falls back to the global priority list.
**Fix:** Escape `"` and `\` (`s.replace(/(["\\])/g, '\\$1')`) or validate against `/^[A-Z][A-Z0-9_]+$/`.

### IN-02: Autosave is also triggered by non-user dispatches (autocomplete results)

**File:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:120-134,775-776`
**Issue:** `userDispatch` is passed to the whole sidebar, including `CustomFieldsSection`/`AutocompleteField`. Their `SET_CUSTOM_FIELD_AUTO_RESULTS` / `SET_CUSTOM_FIELD_SHOW_RESULTS` actions bump `editTick` and schedule a draft write on every search response, which contradicts the "user edits only" intent. The fingerprint check hides most of it, but a draft can be created by a search alone once summary has content.
**Fix:** Skip the tick for those action types (`if (a.type !== 'SET_CUSTOM_FIELD_AUTO_RESULTS' && a.type !== 'SET_CUSTOM_FIELD_SHOW_RESULTS') setEditTick(...)`).

---

_Reviewed: 2026-11-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
