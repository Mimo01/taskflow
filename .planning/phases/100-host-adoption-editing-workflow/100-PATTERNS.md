# Phase 100: Host Adoption & Editing Workflow - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 22 (new/modified/deleted)
**Analogs found:** 20 / 22

Paths are relative to `taskflow/taskflow/src/` unless stated. Line numbers are as read on 2026-11-17.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/wiki-editor/types.ts` (add `WikiEditorHandle`, `placeholder`, `autoFocus`, `onSubmit`, `onCancel`, `ref`) | model (types) | request-response | itself (extend `WikiEditorProps`) | exact |
| `components/wiki-editor/WikiEditor.tsx` (key handling, handle, placeholder) | component | event-driven | its own `onKeyDownCapture` (~L340-351) | exact |
| `components/wiki-editor/WikiEditorLazy.tsx` (forward ref) | component (wrapper) | request-response | itself | exact |
| `components/wiki-editor/extensions.ts` (placeholder prop, L202) | config | transform | itself | exact |
| `stores/drafts.store.ts` (new) | store | CRUD, persisted | `stores/pinned-tabs.store.ts` | exact |
| `hooks/useEditorDraft.ts` (new) | hook | event-driven (debounced write) | `stores/composer-focus.store.ts` + `useMentionUserMap` (hook shape) | partial |
| `components/ui/discard-changes-dialog.tsx` (new) | component | request-response | `components/ui/confirm-sprint-move-dialog.tsx` | exact |
| `lib/shortcuts.ts` (add `editor-submit`, `editor-cancel`) | config | n/a | existing `editor-*` rows L193-320 | exact |
| `routes/dashboard/CreateEpicDialog.tsx` (modify) | component | request-response | itself + `routes/dev-tools/EditorTab.tsx` host wiring | exact |
| `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (modify) | component | request-response | itself (`:312-336`, `:380`, `:556`) | exact |
| `routes/dashboard/create-edit-issue/useCreateEditForm.ts` (extend `RESET` w/ draft) | hook | CRUD | itself (`:269` RESET effect) | exact |
| `routes/dashboard/CommentComposer.tsx` (rewrite) | component | request-response | itself (mutation + focus parts kept) | role-match |
| `routes/dashboard/IssueDetailView.tsx` (CommentCard edit, auto-reopen) | component | request-response | itself (`:947-970`) | exact |
| `routes/dashboard/ActivityTimeline.tsx` (pass edit props) | component | request-response | itself (`:225`) | exact |
| `test/wiki-editor-stub.tsx` (new shared stub) | test util | n/a | `components/wiki-editor/shell-test-utils.tsx` | role-match |
| `stores/drafts.store.test.ts`, `hooks/useEditorDraft.test.tsx` (new) | test | CRUD | existing store tests (tauri store mocked in `test/setup.ts`) | role-match |
| `components/ui/discard-changes-dialog.test.tsx` (new) | test | n/a | `confirm-sprint-move-dialog` tests | role-match |
| `components/wiki-editor/host-keys.test.tsx` (new) | test | event-driven | `shell-test-utils.tsx` users (`mode-focus.test.tsx`, `keymap.test.ts`) | role-match |
| `routes/dashboard/editor-removal.guard.test.ts` (new) | test (guard) | file-I/O | `routes/dashboard/widget-removal.guard.test.ts` | exact |
| Credential reset hook (drafts clear, D-21) in `routes/settings/ConnectionsSection.tsx:513` | service | event-driven | `resetAfterCredentialSave` | exact |
| Deleted: `DescriptionEditor.tsx`, `MentionPopover.tsx`, `InlineComment.tsx`, `IssueDetailSheet.tsx`, `issue-detail/DescriptionSection.tsx` + tests | n/a | n/a | n/a | n/a |
| Docs: REQUIREMENTS.md / ROADMAP.md descope | docs | n/a | no code analog | none |

## Pattern Assignments

### `stores/drafts.store.ts` (store, persisted CRUD)

**Analog:** `stores/pinned-tabs.store.ts`

**Imports + persist shell** (L1-3, L62-66):
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
// ...
    {
      name: 'pinned-tabs-store',
      storage: createTauriStorage('pinned-tabs.json'),
      version: 2,
```
Use `name: 'drafts-store'`, `createTauriStorage('drafts.json')`, `version: 1`.

**Record-map mutation idiom** (L40-45, `clearCycleMeta`):
```typescript
clearCycleMeta: (key) =>
  set((s) => {
    const next = { ...s.pinnedCycleMeta };
    delete next[key];
    return { pinnedCycleMeta: next };
  }),
```
Copy for `clearDraft(key)`; `setDraft` follows `setPinnedCycleMeta` (`{ ...s.x, [key]: v }`).

**Persistence caveat** (`lib/tauri-storage.ts:5-17`): `setItem` does `store.set` + `await store.save()` on every call, so the hook must debounce (500 ms) and flush on blur/unmount/`visibilitychange`. Hydration is async: gate reads with `useDraftsStore.persist.hasHydrated()` / `onFinishHydration`.

**Credential clear (D-21):** copy the shape of `routes/settings/ConnectionsSection.tsx:513-517`:
```typescript
const resetAfterCredentialSave = () => {
  queryClient.clear();
  bumpCredentialsRevision();
};
```
Add `useDraftsStore.setState({ drafts: {} })` (or a `clearAll()` action) next to `queryClient.clear()`. Also check `routes/settings/TokenSection.tsx:206,214` and `DebugModeSection.tsx:72`, which also call `queryClient.clear()`; decide per site (only account/credential changes should clear drafts, not project switches). `bumpCredentialsRevision` lives in `stores/auth.store.ts:88,125`.

---

### `components/ui/discard-changes-dialog.tsx` (component, request-response)

**Analog:** `components/ui/confirm-sprint-move-dialog.tsx`

**Imports** (L1-10):
```typescript
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
```
**Core pattern** (L35-55): `<Dialog open onOpenChange><DialogContent showCloseButton={false}><DialogHeader>…<DialogFooter>`. Footer uses `<DialogClose render={<Button variant="outline" />}>` for cancel and `<Button onClick>` for confirm. For the discard dialog: props `{ open, onKeepEditing, onDiscard }`, `onOpenChange={(o) => { if (!o) onKeepEditing(); }}` (Esc and backdrop equal Keep editing), "Keep editing" outline autofocused, "Discard" `variant="destructive"`. Render it as a React child of the Edit modal tree so Base UI nests it (Esc closes topmost only).

---

### `components/wiki-editor/WikiEditor.tsx` + `types.ts` + `WikiEditorLazy.tsx` (editor host API)

**Analog:** the existing key capture at `WikiEditor.tsx:339-351`:
```typescript
const onKeyDownCapture = (e: React.KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();
  if (e.shiftKey && key === 'm') {
    e.preventDefault();
    e.stopPropagation();
    userToggle(stateRef.current.mode === 'rich' ? 'source' : 'rich');
  } else if (!e.shiftKey && key === 'k') {
    e.preventDefault();
    setLinkOpen(true);
  }
};
```
Add `!e.shiftKey && key === 'enter'` branch: guard `e.nativeEvent.isComposing`, skip when a suggestion is active, then `preventDefault(); stopPropagation(); onSubmit?.()` (pre-empts TipTap `Mod-Enter`). Esc: handle on bubble `onKeyDown` on the same frame (`frameRef` div at ~L358), skip if `e.defaultPrevented` so popovers/bubble (which stop propagation, `suggestion/create-suggestion.ts:152`, `toolbar/BubbleToolbar.tsx:86`, `source/SourceSuggest.tsx:222`) win (D-11).

**Props to extend** (`types.ts:46-55`): add after `host?`:
```typescript
placeholder?: string; autoFocus?: boolean;
onSubmit?: () => void; onCancel?: () => void;
ref?: React.Ref<WikiEditorHandle>;
```
and export `WikiEditorHandle { focus(opts?), blur(), insertWiki?() }`. Placeholder source: `extensions.ts:202` `'data-wiki-placeholder': 'Write a description…'` (hard-coded; thread the prop in). Rich focus: `view.focus()`; source mode: `SourceView` has `focus()`/`focusAt()`.

**Lazy wrapper** (`WikiEditorLazy.tsx:58-67`): `<WikiEditor {...props} />` already spreads props, so React 19 `ref` passes through; the handle is null until the chunk resolves, so hosts must use a callback ref + state (`ready`) rather than mount-time effects.

---

### `routes/dashboard/CreateEpicDialog.tsx` (component, request-response; D-20 adds staging)

**Analog:** itself (keep structure) + `routes/dev-tools/EditorTab.tsx` for host wiring (L181-200, L408-416).

**Host memo pattern** (`EditorTab.tsx:181-186`):
```typescript
const host = useMemo<WikiEditorHost>(
  () => ({ projectKey: ..., staged, userMap: {...}, attachments: [...], uploadFile: async (file) => {...} }), [...]);
```
**Mount pattern** (`EditorTab.tsx:408-416`):
```typescript
<WikiEditorLazy key={docKey} value={text} onChange={setText} preset={preset}
  onVerdict={setVerdict} host={host} maxHeightClass="max-h-[640px]" aria-label="Wiki editor" />
```
**Replace** the raw textarea at `CreateEpicDialog.tsx:70-77` (`description` state, `placeholder="Optional description"`) with `WikiEditorLazy preset="full" placeholder="Optional description" host={{ projectKey: activeJiraProject, staged: true, stageFile }}` plus `onSubmit={() => formRef.current?.requestSubmit()}`.

**D-20 staging:** copy the Create Issue staging path (`CreateEditIssueModal.tsx:73` `useState<File[]>([])`, `:136` staged ref, `:286` `stagedFiles` passed into submit, and the post-create upload step in `useCreateEditForm.ts`/modal submit). Mutation currently (`CreateEpicDialog.tsx:21-36`) calls only `createIssue(...)`; after it resolves, upload staged files to the returned key (reuse `uploadAttachment` as in `CommentComposer.tsx:132-137`).

**Submit guard parity (D-14):** the button predicate is `!epicName.trim() || mutation.isPending` (L99); Cmd+Enter must check the same before `requestSubmit()`. Add `onKeyDown` on the `<form>` for Cmd+Enter from the Epic Name input.

**Dialog shell:** raw `Dialog.Root` from `@base-ui/react/dialog` (L1, L46-52) with `onOpenChange={(o) => { if (!o) onClose(); }}`. Keep size `max-w-md` (UI-05 enlarges later).

---

### `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (component, request-response)

**Analog:** itself.

- Dialog shell `:312-316`: `Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}`. Change to `(o, details)` and branch on `details.reason === 'escape-key'` with `details.cancel()` when dirty (RESEARCH "Base UI: veto Esc close when dirty"). Verify the `escape-key`/`close-press` reasons with a test first (assumption A3).
- Footer Cancel `:556`: `<Button type="button" variant="outline" onClick={onClose} disabled={isPending}>` becomes `requestCancel()`.
- Form `:334`: `<form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">`: add `ref` and Cmd+Enter via `requestSubmit()` guarded by `!summary.trim() || !requiredCustomFieldsFilled || isPending || hasCreatedWithError`.
- Description `:380-390`: replace `<DescriptionEditor ref={descriptionRef} ... stagedFiles={stagedFiles} />` with `WikiEditorLazy preset="full"`; drop `descriptionRef.insertRef` calls (`:119`, `:136`) since the editor inserts refs itself via `host.stageFile` / `host.uploadFile`.
- Edit-mode draft seeding: extend the `RESET` dispatch in `useCreateEditForm.ts:269` rather than adding a second effect (Pitfall 2). Create mode never reads or writes drafts (Phase 101).

---

### `routes/dashboard/CommentComposer.tsx` (component, request-response)

**Analog:** itself; keep the mutation and focus-consumption shape, replace the textarea internals.

**Keep: post mutation** (L106-117):
```typescript
const mutation = useMutation({
  mutationFn: async (body: string) => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return postComment(jiraBaseUrl, token, issueKey, body);
  },
  onSuccess: () => {
    setText('');
    queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
  },
});
```
Add `clearDraft(draftKey.commentNew(issueKey))` and `handle.focus()` in `onSuccess`; on error keep text and draft.

**Keep: upload for `host.uploadFile`** (L132-143): `readSecret('jira-pat')` then `uploadAttachment(jiraBaseUrl, token, issueKey, file)`, invalidate `['jira-issue-detail', issueKey, jiraBaseUrl]`, and return `created[0]` to the editor.

**Change: Reply focus** (L81-88):
```typescript
const composerFocus = useComposerFocus((s) => s.composerFocus);
const clearComposerFocus = useComposerFocus((s) => s.clearComposerFocus);
useEffect(() => {
  if (composerFocus !== issueKey) return;
  textareaRef.current?.focus();
  clearComposerFocus();
}, [composerFocus, issueKey, clearComposerFocus]);
```
Replace `textareaRef.current?.focus()` with the editor handle; add `ready` state set from a callback ref and include it in deps so it retries after the lazy chunk resolves. `stores/composer-focus.store.ts` stays unchanged.

**Delete:** `applyMarkup`, mirror-div caret code, `mentionActive/mentionQuery/...` state (L90-95), `MentionPopover`, `AttachmentPickerModal`, Edit/Preview Tabs (the editor owns these). Button label stays "Comment" (D-19), tooltip "Comment ⌘↵". Esc = `handle.blur()` (D-12).

---

### `routes/dashboard/IssueDetailView.tsx` (CommentCard edit)

**Analog:** itself, L947-970:
```typescript
{isEditing ? (
  <div className="space-y-2">
    <Textarea value={editText} onChange={(e) => onEditTextChange(e.target.value)} className="min-h-[80px] resize-none" />
    {editError && <p className="text-xs text-destructive">{editError}</p>}
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={editPending}>Cancel</Button>
      <Button size="sm" onClick={() => onSaveEdit(comment.id)} disabled={!editText.trim() || editPending}>
        {editPending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  </div>
) : ( <WikiRenderer wikiText={comment.body} attachments={attachmentMap} users={userMap} /> )}
```
Swap `Textarea` for `WikiEditorLazy preset="compact" onSubmit={() => onSaveEdit(comment.id)} onCancel={requestCancel}`; put the "Draft saved · Discard" / "Changed in Jira since your draft · Use Jira version" muted line in the same action row (`flex ... justify-end`, reserve its height to avoid layout shift). Cancel goes through the dirty check (`editText !== comment.body`) then `DiscardChangesDialog`. Edit state is lifted at `IssueDetailView.tsx:338-427`; `ActivityTimeline.tsx:225` passes `editText` only to the editing card. Pitfall 5: flush draft before `handleEdit(B)` replaces `editText`. Auto-reopen: after comments query success and `editingCommentId === null`, `editDraftsFor(issueKey)` then `handleEdit`.

`userMap` source: `useMentionUserMap` (`hooks/useMentionUserMap.ts`), consumed at `IssueDetailContent.tsx:~181`; reuse the map `IssueDetailView` already has.

---

### `lib/shortcuts.ts` (config)

**Analog:** `editor-toggle-source` row (L274-280):
```typescript
{
  id: 'editor-toggle-source',
  defaultKey: 'editor:⌘⇧M',
  description: 'Toggle source view while editing',
  category: 'Editor',
  displayKeys: ['⌘', '⇧', 'M'],
},
```
Add `editor-submit` (`defaultKey: 'editor:⌘↵'`, displayKeys `['⌘','↵']`) and `editor-cancel` (`defaultKey: 'editor:Esc'`). Documentation-only, never bound as global hotkeys (see comment L193-199). Tooltip keycaps: `components/ui/keycap.tsx` + `tooltip.tsx` (98 D-04 style).

---

### `routes/dashboard/editor-removal.guard.test.ts` (guard test)

**Analog:** `routes/dashboard/widget-removal.guard.test.ts` (L1-30): `fs.existsSync(path.join(DASHBOARD_DIR, 'X.tsx'))` is `false`, and prod-source scan with comment lines stripped:
```typescript
const nonCommentLines = indexSrc.split('\n')
  .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
  .join('\n');
expect(nonCommentLines).not.toMatch(/SmokeTestChart/);
```
Assert absent: `DescriptionEditor.tsx`, `InlineComment.tsx`, `IssueDetailSheet.tsx`, `MentionPopover.tsx`, `issue-detail/DescriptionSection.tsx`; walk `src/` (non-test) for `insertAtCursor` and `TabsTrigger value="preview"`; no prod import of the deleted modules.

---

## Shared Patterns

### Persisted store + Tauri storage
**Source:** `stores/pinned-tabs.store.ts`, `lib/tauri-storage.ts`. **Apply to:** `drafts.store.ts`. Debounce and flush writes; never write per keystroke; subscribe with selectors (React Compiler: no `getState()` in render).

### Esc/Cmd+Enter inside editor
**Source:** `WikiEditor.tsx:339-351` + popover `stopPropagation` sites. **Apply to:** all four hosts via the new `onSubmit`/`onCancel` props.

### Modal Cmd+Enter submit
**Source:** each modal's own disabled predicate (Epic L99; Issue modal `!summary.trim() || !requiredCustomFieldsFilled || isPending || hasCreatedWithError`). **Apply to:** Create Epic, Create/Edit Issue. Never call `requestSubmit()` while pending.

### Host contract
**Source:** `types.ts:26-44` `WikiEditorHost` and `routes/dev-tools/EditorTab.tsx:181-200`. Live issue: `uploadFile` via `readSecret('jira-pat')` + `uploadAttachment` (CommentComposer L132-137). Create: `staged: true` + `stageFile`.

### Test strategy
**Source:** `components/wiki-editor/shell-test-utils.tsx` (`installLayoutStubs`, `liveEditor`, `typeAt`) for real-editor tests; `vi.mock('@/components/wiki-editor/WikiEditorLazy')` textarea stub for host logic. Tauri store is mocked globally in `test/setup.ts`. The pre-commit hook runs the full vitest suite: combine RED/GREEN per task.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `hooks/useEditorDraft.ts` | hook | event-driven | No existing debounced-persist-with-hydration-gate hook; follow RESEARCH "useEditorDraft hook" and the `drafts.store` rules |
| `WikiEditorHandle` (ref/imperative API) | component | event-driven | No `forwardRef`/`useImperativeHandle` in `WikiEditor.tsx` yet; only `SourceView.focus()/focusAt()` exist as a seed |
| REQUIREMENTS.md / ROADMAP.md descope (HOST-02, UI-04, Phase 100 criteria 1 and 3, Phase 102 criterion 2) | docs | n/a | Planning docs, not code |

## Metadata

**Analog search scope:** `stores/`, `components/ui/`, `components/wiki-editor/`, `routes/dashboard/`, `routes/dashboard/create-edit-issue/`, `routes/dev-tools/`, `routes/settings/`, `lib/`
**Files scanned:** about 20 read or grepped
**Pattern extraction date:** 2026-11-17
