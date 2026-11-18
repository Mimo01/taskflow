# Phase 102: Polished Surfaces - Pattern Map

**Mapped:** 2026-11-18
**Files analyzed:** 16 (new and modified)
**Analogs found:** 16 / 16

All paths are relative to `taskflow/taskflow/src/` (inner app dir). `.planning/` and git are at the outer `taskflow/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `routes/dashboard/create-edit-issue/ModalShell.tsx` (new) | component (dialog shell) | request-response | `CreateEditIssueModal.tsx:633-892` | exact (extract) |
| `routes/dashboard/comment-editor/CommentActionRow.tsx` (new) | component | event-driven | action rows in `CommentComposer.tsx:126-152` + `IssueDetailView.tsx:1122-1169` | exact (merge) |
| `routes/dashboard/comment-editor/useExpandOnFocus.ts` (new) | hook | event-driven | `CommentComposer.tsx:58-71`, `:109-110` (focus/blur wrapper) | role-match |
| `routes/dashboard/CommentComposer.tsx` (mod) | component | event-driven | itself | self |
| `routes/dashboard/IssueDetailView.tsx` (mod, edit branch ~1106-1170) | component | event-driven | `CommentComposer.tsx` | exact |
| `routes/dashboard/CreateEpicDialog.tsx` (mod, rewrite) | component | CRUD (create + staged upload) | `create-edit-issue/CreateEditIssueModal.tsx` | role-match |
| `routes/dashboard/create-edit-issue/ModalSidebar.tsx` (mod: epic variant) | component | CRUD | itself | self |
| `routes/dashboard/create-edit-issue/useCreateEditQueries.ts` (mod) | hook | request-response | itself, `:101-107` | self |
| `routes/dashboard/create-edit-issue/useCreateEditForm.ts` (mod: widen `IssueType`) | hook/reducer | CRUD | itself, `:36` | self |
| `stores/issue-drafts.store.ts` (mod: `EpicDraftSnapshot` + sanitizer) | store | CRUD | `IssueDraftSnapshot` `:30-47`, `sanitizePersistedDrafts` `:112` | exact |
| `lib/issue-draft-snapshot.ts` (check/mod) | utility | transform | itself | self |
| `routes/dashboard/BulkCreateSubtasksModal.tsx` (mod) | component | batch | `CreateEditIssueModal.tsx` shell | role-match |
| `routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx` (mod) | component | CRUD | `Input` use at `:235` | self |
| `routes/dashboard/release-detail/EditReleaseModal.tsx` (mod) | component (pure view) | request-response | itself + `ModalSidebar` `Row` | role-match |
| `components/wiki-editor/WikiEditor.tsx:447` + `WikiEditorLazy.tsx:10` (mod) | component | n/a | `components/ui/input.tsx:12` | exact |
| Tests: `CommentComposer.test.tsx`, `CreateEpicDialog.test.tsx` (update); `ModalShell.test.tsx`, `CommentActionRow.test.tsx`, `EditReleaseModal.test.tsx` (new) | test | n/a | `create-edit-issue/CreateEditIssueModal.layout.test.tsx`, `CommentComposer.test.tsx` | role-match |

## Pattern Assignments

### `create-edit-issue/ModalShell.tsx` (component, request-response)

**Analog:** `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` lines 625-700 (shell) and ~840-895 (footer).

**Shell and header** (copy exactly):
```tsx
<Dialog.Portal>
  <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
  <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(1080px,94vw)] h-[88vh] min-h-[480px] max-h-[calc(100vh-2rem)] overflow-hidden bg-background border rounded-lg shadow-xl flex flex-col">
    <div className="@container flex min-h-0 flex-1 flex-col">
      <form ref={formRef} onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            trySubmitRef.current();
          }
        }}
        className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <Dialog.Title className="text-lg font-semibold leading-tight">Create issue</Dialog.Title>
          <Dialog.Close render={
            <button type="button" className="ml-auto rounded p-1 hover:bg-accent" aria-label="Close">
              <X className="h-4 w-4" />
            </button>} />
        </div>
        <div className="flex min-h-0 flex-1 max-[720px]:flex-col max-[720px]:overflow-y-auto">
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 max-[720px]:overflow-visible">
```
Sidebar `aside` classes: `w-[300px] shrink-0 overflow-y-auto border-l bg-muted/30 p-4 min-[721px]:@max-[900px]:w-[240px] max-[720px]:w-full max-[720px]:overflow-visible max-[720px]:border-l-0 max-[720px]:border-t` (from UI-SPEC; confirm against the file when extracting).

**Field label pattern** (`:688-692`):
```tsx
<label htmlFor="issue-summary" className="text-xs font-semibold text-muted-foreground">
  Summary <span className="text-destructive">*</span>
</label>
```

**Footer pattern** (~840-895): left slot is a flex-1 div (`data-testid="modal-footer-status"`), then:
```tsx
<Tooltip>
  <TooltipTrigger render={<Button type="button" variant="outline" onClick={requestCancel} disabled={isPending} />}>Cancel</TooltipTrigger>
  <TooltipContent><span className="flex items-center gap-2"><span className="font-medium">Cancel</span><Keycap>Esc</Keycap></span></TooltipContent>
</Tooltip>
<Tooltip>
  <TooltipTrigger render={<Button type="submit" disabled={!canSubmit} className="gap-1.5" />}>
    {isPending && <Loader2 className="size-3.5 animate-spin" />}
    ...
```
Draft note slot (footer left): `<DraftNote state="draft" onDiscard={...} onUseJira={() => {}} />`; failure text `<span className="min-w-0 truncate text-xs text-muted-foreground">Couldn't save your draft</span>`.

**Esc contract** (just above line 625): `onOpenChange(open, details)`; on `details.reason === 'escape-key'` call `details.cancel()` then `requestCancel()` unless `details.event?.defaultPrevented`. The shell must pass `details` through. Bulk keeps `if (!o && !creating) onClose()` and Close `disabled={creating}` (add a `closeDisabled` prop). Render `<form>` only when `onSubmit` is provided (Bulk and Edit Release use `onClick`).

---

### `comment-editor/CommentActionRow.tsx` (component, event-driven)

**Analog (merge of two):** `routes/dashboard/CommentComposer.tsx` 126-152 and `routes/dashboard/IssueDetailView.tsx` 1122-1169.

**Left note + right buttons** (CommentComposer 126-151):
```tsx
<div className="flex items-center justify-end gap-2">
  <DraftNote state={text.trim() ? draft.state : null} onDiscard={handleDiscard} onUseJira={() => {}} className="mr-auto" />
  <Tooltip>
    <TooltipTrigger render={<Button size="sm" disabled={!text.trim() || mutation.isPending} onClick={() => send()} />}>
      {mutation.isPending ? 'Saving…' : 'Comment'}
    </TooltipTrigger>
    <TooltipContent><TooltipBody>Comment <Keycap>⌘</Keycap><Keycap>↵</Keycap></TooltipBody></TooltipContent>
  </Tooltip>
</div>
```
**Cancel tooltip** (IssueDetailView 1133-1148): `<Button variant="outline" size="sm" onClick={onCancelEdit} disabled={editPending} />` with tooltip body `<span className="font-medium">Cancel</span><Keycap>Esc</Keycap>`.

**Attach** (no analog inside comments; copy from `CreateEpicDialog.tsx:252-272`): hidden `<input type="file" multiple>` + `editorRef.current?.insertFiles(files)` and `e.target.value = ''`. Use `Button variant="ghost" size="icon-sm"` (the `icon-sm` size EXISTS in `components/ui/button.tsx:30`; assumption A2 is resolved) with lucide `Paperclip` and `aria-label="Attach files"`.

Imports: `Button`, `DraftNote`, `Keycap`, `Tooltip*`, `TooltipBody` from `@/components/ui/...`. Pending labels: "Posting…" (composer; the current "Saving…" must change, update the test) and "Saving…" (edit; the current "Saving..." with three dots changes to the ellipsis character).

---

### `comment-editor/useExpandOnFocus.ts` and `CommentComposer.tsx` (UI-03 expand)

**Analog:** `CommentComposer.tsx` itself.

**Existing wrapper that flushes on blur** (109-110, extend rather than replace):
```tsx
{/* biome-ignore lint/a11y/noStaticElementInteractions: focusout bubbles to flush the draft */}
<div onBlur={draft.flush}>
```
Extend with containment (from RESEARCH):
```tsx
onFocus={() => setFocused(true)}
onBlur={(e) => { draft.flush(); if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
```
`expanded = focused || text.trim() !== ''` (collapse only when text is empty).

**Reply focus effect** (64-71, keep, but set `expanded` first because the editor only mounts when expanded):
```tsx
const composerFocus = useComposerFocus((s) => s.composerFocus);
const clearComposerFocus = useComposerFocus((s) => s.clearComposerFocus);
useEffect(() => {
  if (composerFocus !== issueKey || !editorReady) return;
  handleRef.current?.focus({ toEnd: true });
  clearComposerFocus();
}, [composerFocus, issueKey, editorReady, clearComposerFocus]);
```
Note: if `composerFocus === issueKey && !expanded`, call `setExpanded(true)` in an effect; `editorReady` then flips via `setEditorHandle` (58-62). Collapsed idle element: `Input` (h-8) with placeholder "Add a comment…". Esc stays `onCancel={() => handleRef.current?.blur()}` (line 120). Height cap: pass `maxHeightClass="max-h-[min(50vh,480px)]"` (WikiEditor already reads `maxHeightClass ?? sizes.max`, defaults at `WikiEditor.tsx:48-51`: compact `min-h-[96px]`/`max-h-[280px]`).

**Comment edit host** (`IssueDetailView.tsx:1106-1122`): keep `<div className="space-y-2" onBlur={onEditBlur}>`, `WikiEditorLazy ... preset="compact" aria-label="Edit comment" onSubmit={(t) => onSaveEdit(comment.id, t)} onCancel={onCancelEdit}`; add the same `maxHeightClass`, keep `{editError && <p className="text-xs text-destructive">{editError}</p>}`, replace the inline row (1124-1169) with `CommentActionRow`.

---

### `CreateEpicDialog.tsx` (component, CRUD with staged files)

**Analog 1 (itself, keep logic):** `routes/dashboard/CreateEpicDialog.tsx`.
Keep unchanged: props contract `{open, onClose, resumeDraftId}` (24-29); open-once effect with `openHandledRef` (60-92); preview restore retry loop (95-110); `latestRef` + `editTick` autosave (112-126); `finishDraft` (128-132); `flushSync(() => setDescription(text)); trySubmit();` editor `onSubmit` (285-288); `hasCreatedWithError` and `stagedUploadError` handling (51-53, 171-181, 300-304); invalidate `['jira-epics-basic']` (172).

Replace: shell (208-221, `max-w-md`, `z-40` backdrop, raw `<input>` at 235-245, raw buttons at 306-343) with `ModalShell`, `Input`, `Button` + the Issue footer tooltips. Title/copy to sentence case: "Create epic", "Epic name", "Create epic" CTA, pending "Creating…".

**Analog 2 (sidebar wiring):** `create-edit-issue/CreateEditIssueModal.tsx` — `useReducer(formReducer, buildInitialState(...))`, `useCreateEditQueries(...)`, `<ModalSidebar ... />` props at `ModalSidebar.tsx:16-47` (`mode, state, dispatch, isSubtask, isPending, projectKey, jiraBaseUrl, priorityOptions, creatmetaFields, creatmetaLoading, customRequiredFields, labelsRequired, labelsOffered, fixVersionsOffered, fixVersionsRequired, open, staleNotes`). Grep `priorityOptions` in `CreateEditIssueModal.tsx` for the priority source to extract/reuse (RESEARCH open question 1).

**Payload analog:** current epic payload at `CreateEpicDialog.tsx:160-164`:
```tsx
createIssue(jiraBaseUrl, jiraToken, activeJiraProject, epicName, {
  issuetype: 'Epic',
  description: description || undefined,
  [epicNameFieldKey]: epicName,
});
```
Extend with sidebar values using the same helpers as `useIssueMutations.ts` (`labelsFixVersionsCreateFields`, `wrapCustomFieldValue`, assignee `{name}`, priority `{name}`, `offered` filtering). Do not route through `createMutation` (it sends epic-link and links).

**Shared-code traps** (must be planned as tasks):
- `useCreateEditForm.ts:36` `ISSUE_TYPES` / `IssueType` union: widen with `'Epic'` (`useCreateEditQueries.ts:79-81` resolves the type id by `t.name === selectedIssueType`).
- `useCreateEditQueries.ts:101-107` `customRequiredFields` filter: add an `epicNameFieldKey` exclusion beside the existing ones:
```ts
if (epicLinkFieldKey && f.fieldId === epicLinkFieldKey) return false;
if (storyPointsFieldKey && f.fieldId === storyPointsFieldKey) return false;
```
  (new option on the hook's args at `:24-26, 52-54`; also exclude it from the submit "required custom fields filled" check).
- `ModalSidebar.tsx`: add an epic variant that hides Issue type and Epic picker, and shows Story points only if offered. Row helper at `:41-62` is the label-above pattern.

---

### `stores/issue-drafts.store.ts` (store, CRUD)

**Analog:** `IssueDraftSnapshot` fields at lines 30-47 (`labels`, `fixVersions`, `customFieldValues`, `customFieldInputValues`, `customFieldNames`, assignee/priority) and `sanitizePersistedDrafts` at 112.
Current epic shape (39-42):
```ts
export interface EpicDraftSnapshot { epicName: string; description: string; }
```
Add the new fields as OPTIONAL so drafts on disk still load; sanitize each present field with explicit type checks (no `as` casts). `hasEpicContent(name, description, stagedCount)` in `lib/issue-draft-snapshot.ts:25` stays unchanged. Resume: reuse `validateSnapshot` + `snapshotToFormPatch` (see `create-edit-issue/useDraftResume.ts`, copy its `settled()` logic; validate once after createmeta settles).
Tests: extend the existing store/snapshot tests (check existence under `stores/` and `lib/`); add an old-shape draft case.

---

### `BulkCreateSubtasksModal.tsx` (component, batch)

**Analog:** itself (lines 590-769) plus the shell.
Keep: `onOpenChange={(o) => { if (!o && !creating) onClose(); }}` (590-592), Close `disabled={creating}`, DndContext/SortableContext/DragOverlay block (642-675), `BulkProgressIndicator` footer left slot (703-717), Retry/Create logic.
Change:
- Popup `w-[860px] max-h-[88vh] overflow-y-auto` (line 596) to the shell classes, no popup scroll.
- Header `h2` and `<p className="text-sm ...">Parent: {parentKey}</p>` (600-603) to `Dialog.Title` + `text-xs text-muted-foreground` subtitle.
- Toolbar (`flex items-center gap-3 px-6 py-3 border-b bg-muted/30`, 622) stays pinned (non-scrolling); the template and type `Select`s, the `role="status"` skipped badge stay.
- Row list wrapper (`flex flex-col gap-2 px-6 py-4 flex-1 min-h-0`, 663) becomes `min-h-0 flex-1 overflow-y-auto px-6 py-4`.
- Empty copy (`Add rows below, or choose a template above to pre-fill.`) becomes "No subtasks yet" / "Add a row or pick a template to start."
- Footer: drop `bg-muted/50 rounded-b-lg` (699); use default-size `Button`s; sentence case "Create subtasks", "Retry failed", "Bulk create subtasks".
- Replace the raw "Add row" `<button>` (680-689) with `Button variant="ghost"` if styling allows.
Gotchas (memory): keep `flex-none`/`min-w-0` in row layouts; one row = one line.

**`SubtaskTemplateRow.tsx`:** already uses `Input` (e.g. title at ~235); check remaining raw `<input>`/`<select>` (grep returned only a raw `<button>` drag handle at 224 and others); only convert real raw inputs.

---

### `release-detail/EditReleaseModal.tsx` (component, request-response)

**Analog:** itself (props interface at 8-30 is unchanged so `ReleaseDetailPage.tsx` and `useEditRelease.ts` need no edits) plus `ModalSidebar.tsx` `Row` for labels.
Already good: `Input`, `Textarea`, `DatePicker`, `Button` imports (3-6), `id`s `release-name`, `release-date`, `release-description`, `milestone-title`, `milestone-description` (keep for tests/labels), `showMilestoneSection` gate (138).
Change:
- Shell: two-column `ModalShell`; `h2` (61) to `Dialog.Title`; "Edit release".
- Labels from `text-xs text-muted-foreground` to `text-xs font-semibold text-muted-foreground` with red `*` on Name.
- Main description: `Textarea className="flex-1 min-h-40 resize-none"`; verify `field-sizing-content` (A5) fights `flex-1` visually, override with `field-sizing-fixed` if needed. Milestone section `border-t pt-4`, heading "GitLab milestone" `text-xs font-semibold text-muted-foreground`, Description `min-h-24`.
- Sidebar: `DatePicker` (93-98) and the hand-rolled switch (117-133, `bg-green-600`) replaced by shared `Switch`:
```tsx
<Switch checked={editReleased} onCheckedChange={setEditReleased} disabled={isSaving} aria-label="Released" />
```
  (`components/ui/switch.tsx` is a `role="switch"` button with `checked`/`onCheckedChange`; label "Released" fixed).
- Errors (173-182, `rounded-md bg-destructive/10 ... Jira: {jiraError}`) move into the footer left slot as `text-xs text-destructive` ("Couldn't update the Jira version: {reason}. Try again.").
- Footer buttons: remove `size="sm"` and the `Check` icon (186-203); keep `Loader2` pending, "Saving…".

---

### `WikiEditor.tsx:447` and `WikiEditorLazy.tsx:10` (field surface, D-01)

**Analog / reference:** `components/ui/input.tsx:12`, classes `rounded-lg border border-input bg-transparent ... transition-colors ... focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ... dark:bg-input/30`.

Current frame (`WikiEditor.tsx:447`):
```tsx
className="rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring"
```
Target: `rounded-lg border border-input bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50`. Skeleton `FRAME` (`WikiEditorLazy.tsx:10`: `'rounded-lg border border-input bg-background'`) must get the same surface so there is no flash. This is global (all hosts); screenshot light and dark before sign-off; check for tests that assert these classes.

---

### Tests

- `CommentComposer.test.tsx` and `CommentComposer.attachments.test.tsx` (exist): the wiki stub (`@/test/wiki-editor-stub`) renders only once expanded; expand first (focus the collapsed field) in each test; update the "Saving…" string to "Posting…"; add blur-with-`relatedTarget`-inside/outside cases.
- `CreateEpicDialog.test.tsx` and `EpicsPage.test.tsx` (exist): rewrite for the new copy ("Create epic"), sidebar fields, epic-name-excluded fixture, payload.
- New: `ModalShell.test.tsx`, `CommentActionRow.test.tsx`, `EditReleaseModal.test.tsx`. Model structure on `create-edit-issue/CreateEditIssueModal.layout.test.tsx` (class assertions) and keep the Issue modal tests green if it adopts the shell.
- Run with `cd taskflow/taskflow && npx vitest run <file>`; pre-commit runs the full suite, so commit RED+GREEN together per task.

## Shared Patterns

### Field surface and labels
**Source:** `components/ui/input.tsx:12`, `components/ui/textarea.tsx`, label style in `ModalSidebar.tsx:41-62` (`Row`).
**Apply to:** Create Epic, Bulk rows/toolbar, Edit Release, the WikiEditor frame, the collapsed composer field.
Label: `<label htmlFor=... className="text-xs font-semibold text-muted-foreground">Name <span className="text-destructive">*</span></label>` inside `flex flex-col gap-1`.

### Buttons with keycap tooltips
**Source:** `CreateEditIssueModal.tsx` footer (~856-895); `CommentComposer.tsx:133-151`.
**Apply to:** shell footer, `CommentActionRow`. Always `Button` from `components/ui/button` (sizes `default` in modal footers, `sm` and `icon-sm` in comment rows).

### Draft note
**Source:** `components/ui/draft-note.tsx` (`<DraftNote state onDiscard onUseJira className="mr-auto" />`; reserves `min-h-6`).
**Apply to:** composer, comment edit, Epic footer left slot.

### Esc / nested dialog handling
**Source:** `CreateEditIssueModal.tsx` `onOpenChange(open, details)` (just above line 625).
**Apply to:** ModalShell consumers. X and backdrop close silently (draft stays); Bulk ignores close while `creating`.

### Staged uploads
**Source:** `CreateEpicDialog.tsx:44-46, 143-150, 165-170` (`useDraftStagedFiles`, `host` with `staged: true`, `uploadStagedFiles`).
**Apply to:** Create Epic only (comments upload live via `insertFiles`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Collapsed single-line composer field (`useExpandOnFocus`) | hook | event-driven | No existing collapse/expand-on-focus editor; build from the focus/blur wrapper in `CommentComposer.tsx` plus the RESEARCH snippet. |
| `ModalSidebar` epic variant | component | CRUD | No Epic type path exists; derive from the existing `mode`/`isSubtask` branching in `ModalSidebar.tsx`. |

## Metadata

**Analog search scope:** `routes/dashboard/`, `routes/dashboard/create-edit-issue/`, `components/ui/`, `components/wiki-editor/`, `stores/`, `lib/`
**Files scanned:** about 20 read or grepped
**Pattern extraction date:** 2026-11-18
