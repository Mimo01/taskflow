# Phase 101: Issue Drafts & Large Create/Edit Modal - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 22 new/modified
**Analogs found:** 21 / 22 (paths below are relative to `taskflow/src/` unless prefixed `src-tauri/`)

Post-research user decision (overrides RESEARCH Pitfall 1 / A5 / Open Question 1): **Labels and Fix version controls appear in BOTH Create and Edit mode.** Edit must seed them from the existing issue and save them back without clobbering. See "Labels / Fix version in Edit mode" below.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `stores/issue-drafts.store.ts` (new) | store | CRUD, persisted | `stores/drafts.store.ts` | exact |
| `lib/issue-draft-files.ts` (new) | service | file-I/O | `services/stronghold.ts` (appDataDir) + RESEARCH `stageCopy` | partial (no fs usage in repo) |
| `lib/issue-draft-snapshot.ts` (new) | utility | transform (pure) | `routes/dashboard/create-edit-issue/useCreateEditForm.ts` (`buildInitialState`) | role-match |
| `hooks/useIssueDraft.ts` (new) | hook | event-driven (debounce) | `hooks/useEditorDraft.ts` | exact |
| `hooks/useDraftsAccountGuard.ts` (modify) | hook | event-driven | itself | exact |
| `stores/create-modal.store.ts` (new) | store | pub-sub (global open entry) | `stores/recent-items.store.ts` (zustand shape) + `main.tsx:132-145, 578-640` (state it replaces) | role-match |
| `main.tsx` (modify) | provider/layout | request-response | itself (`handleOpen*`, lines 132-145, 578-640, 805-812) | exact |
| `components/app/DraftsChip.tsx` (new) | component | CRUD (list + discard) | `components/app/RecentItemsPopover.tsx` | exact |
| `components/app/TopBar.tsx` (modify) | component | request-response | itself (lines 143-153) | exact |
| `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (modify) | component | CRUD | itself (774 LOC) | exact |
| `.../create-edit-issue/ModalSidebar.tsx` (new) | component | request-response | the field blocks in `CreateEditIssueModal.tsx:483-697` | role-match |
| `.../create-edit-issue/LabelsField.tsx` (new) | component | CRUD | `routes/dashboard/issue-detail/FieldsSection.tsx:942-990` | role-match |
| `.../create-edit-issue/FixVersionField.tsx` (new) | component | CRUD | `routes/dashboard/issue-detail/FieldsSection.tsx:996-1050` + 196-203, 254-290 | role-match |
| `.../create-edit-issue/useCreateEditForm.ts` (modify) | hook | transform (reducer) | itself | exact |
| `.../create-edit-issue/useIssueMutations.ts` (modify) | hook | CRUD | itself (`createMutation` / `editMutation`) | exact |
| `.../create-edit-issue/useCreateEditQueries.ts` (modify) | hook | request-response | itself | exact |
| `routes/dashboard/issue-detail/issue-actions.ts` (modify) | utility | transform | itself (`buildEditInitialValues`, lines 6-28) | exact |
| `services/jira.ts` `createIssue` (modify, minor type) | service | request-response | itself (lines 2455-2507) | exact |
| `routes/dashboard/CreateEpicDialog.tsx` (modify) | component | CRUD | `CreateEditIssueModal.tsx` (draft wiring) | role-match |
| `components/wiki-editor/types.ts` + `WikiEditor` handle (modify: `setLocalPreview`) | component | event-driven | `components/wiki-editor/host.ts:141`, `media/upload-plugin.ts:162` | role-match |
| `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (modify) | config | - | existing plugin entries | exact |
| `.planning/REQUIREMENTS.md`, `ROADMAP.md` (docs, D-03) | docs | - | Phase 100 D-01 docs change | n/a |
| Tests (all new `*.test.ts(x)`) | test | - | `stores/drafts.store.test.ts`, `CreateEditIssueModal.drafts.test.tsx` | exact |

## Pattern Assignments

### `stores/issue-drafts.store.ts` (store, persisted CRUD)

**Analog:** `stores/drafts.store.ts` (copy structure; do NOT extend it, its `setDraft` deletes empty-text entries).

**Imports + persist wrapper** (lines 1-5, 80-86):
```typescript
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
...
    {
      name: 'drafts-store',
      storage: createTauriStorage('drafts.json'),
      version: 1,
      partialize: (s) => ({ drafts: s.drafts, owner: s.owner }),
    },
```
Use `name: 'issue-drafts-store'`, `createTauriStorage('issue-drafts.json')`.

**Owner reconcile (D-21)** (lines 70-75):
```typescript
reconcileOwner: (owner) =>
  set((s) => {
    if (s.owner === owner) return s;
    if (s.owner === null) return { owner };
    return { drafts: {}, owner };
  }),
```
Extension: on owner change the file service must also purge `$APPDATA/issue-drafts` (keep Tauri imports out of the store; call the purge from the guard hook or take the removed ids from the store action's return).

**Hydration gate** (lines 100-107): copy `useDraftsHydrated` verbatim as `useIssueDraftsHydrated`.

**Comment to keep** (line 29): `// Never log draft text: it may contain customer data.`

**Shape:** `Record<string, IssueDraft>` keyed by `crypto.randomUUID()` (same uuid idiom as `issue-actions.ts:47`), `IssueDraft` per RESEARCH Pattern 1 (`kind: 'issue' | 'epic'`, `updatedAt`, `snapshot`, `files`).

**Selector pitfall:** select the record (`(s) => s.drafts`) and sort in `useMemo`; a selector returning a fresh sorted array loops under zustand v5 (RESEARCH Pitfall 13).

**Test analog:** `stores/drafts.store.test.ts` lines 1-15 (`beforeEach(() => useDraftsStore.setState({ drafts: {}, owner: null }))`, `const get = () => useX.getState()`). In-memory `LazyStore` mock is global in `src/test/setup.ts:14-39` (same filename shares backing, so re-import simulates restart for DRAFT-06).

---

### `hooks/useIssueDraft.ts` (hook, debounced autosave)

**Analog:** `hooks/useEditorDraft.ts` (mirror, adapt `text` to `snapshot`).

**Debounce constant + flush guard** (lines 10, 51-62):
```typescript
export const DRAFT_DEBOUNCE_MS = 500;   // reuse the exported constant, do not redefine
const flush = useCallback(() => {
  clearTimer();
  const p = pendingRef.current;
  if (!p) return;
  // Never write before hydration: an empty mount must not clobber a stored draft.
  if (!useDraftsStore.persist.hasHydrated()) return;
  pendingRef.current = null;
  const state = useDraftsStore.getState();
  if (state.drafts[p.key]?.text === p.text) return;   // -> compare JSON.stringify(snapshot)
  state.setDraft(p.key, { ... });
}, [clearTimer]);
```
**Latest-identity ref** (lines 41-43): `latestRef.current = {...}` so `schedule()` captures current ids.
**Flush on hide/unmount** (lines 82-92):
```typescript
useEffect(() => {
  const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onVisibility);
  return () => { document.removeEventListener('visibilitychange', onVisibility); flush(); };
}, [flush]);
```
Add the D-12 content gate: `draftIdRef` is allocated lazily only when `hasUserContent(...)` is true (RESEARCH Pattern 2); null it on create success, discard, and new open.

---

### `lib/issue-draft-snapshot.ts` (utility, pure transform)

**Analog:** `useCreateEditForm.ts` (`FormState` lines 38-58, `buildInitialState` 113-155). Persist only serialisable fields; exclude `apiError`, `customFieldAutoResults`, `customFieldShowResults` (RESEARCH Pattern 3). Include the new `labels` and `fixVersions` form fields. Pure functions to unit test: `hasUserContent`, `keptFieldsAfterCreate`, `validateSnapshot` (RESEARCH Code Examples). Stale checks use the same `['createmeta', ...]` data from `useCreateEditQueries` and the `['parent-fields', key]` query (404 -> `{}` today at `useCreateEditQueries.ts:130`; for the stale epic check you need a status-aware lookup, do not rely on `{}`).

---

### `lib/issue-draft-files.ts` (service, file-I/O)

**Analog (partial):** `services/stronghold.ts:19,49` for the `appDataDir` usage:
```typescript
import { appDataDir } from '@tauri-apps/api/path';
const vaultPath = `${await appDataDir()}/vault.hold`;
```
There is no `@tauri-apps/plugin-fs` usage in the repo. Use RESEARCH "Staging a copy" (`BaseDirectory.AppData`, `mkdir recursive`, `writeFile(new Uint8Array(await file.arrayBuffer()))`, `remove(..., {recursive:true}).catch(() => {})`). Keep it a mockable seam (`vi.mock('@/lib/issue-draft-files')`). File name must equal the editor-renamed name exactly (Pitfall 3); sanitise path segments.
**Rebuild `File` for upload:** read bytes, `new File([bytes], name, { type })`, then feed `uploadStagedFiles` (`lib/upload-staged-files.ts:7-23`, takes `readonly File[]`).

---

### `stores/create-modal.store.ts` (store, global open entry)

**Analog:** state to replace is `main.tsx:132-145`:
```typescript
const [createModalOpen, setCreateModalOpen] = useState(false);
const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
const [createModalInitialValues, setCreateModalInitialValues] = useState<...>
const [createModalDefaultType, ...] / DefaultParent / DefaultEpic
```
and the `handleOpen*` family at `main.tsx:578-640` (each sets mode + 5 fields + open). Plain (non-persisted) zustand `create<State>()((set) => ({...}))` as in `stores/recent-items.store.ts:1-3, 22-27`. Add `resumeDraftId`. Keep the `handleOpen*` call sites working by delegating to the store (RESEARCH Pattern 5). The `wasStoryCreate` ref at `main.tsx:~582` must stay coherent. Modal mount is `main.tsx:805-812`.

---

### `components/app/DraftsChip.tsx` (component, list + discard)

**Analog:** `components/app/RecentItemsPopover.tsx`.

**Imports** (lines 9-26) incl. `Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover`, `cn` from `@/lib/utils`.

**Trigger + pressed state** (lines 107-119):
```typescript
<PopoverTrigger
  className={`relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors ${open ? 'bg-muted text-foreground' : ''}`}
  data-active={open ? 'true' : undefined}
  aria-label="Recent Items"
>
```
The chip must be a labelled pill ("✎ Drafts 2", lucide `PenLine`), not the 32px icon square, so adapt widths (UI-SPEC wins).

**Popover content + list scroll** (lines 120-136): `className="p-0 w-[40rem] max-w-[calc(100vw-2rem)]"`, header `flex items-center justify-between p-3 border-b`, list `overflow-y-auto max-h-[420px]`.

**Row** (lines 62-86, `PopoverRecentRow`): `button` with `flex h-8 density-compact:h-7 density-comfortable:h-10 w-full items-center px-3 text-left hover:bg-muted`. Discard is a sibling trailing control, NOT a nested button (overlay-button memory: absolute inset-0 overlay button as sibling, or row as div with sibling buttons).
**Close on select** (lines 150-158): `setOpen(false)` before invoking the callback (Pitfall 11).
**Relative time:** `lib/relative-time.ts:1` `relativeTime(iso)` returns "5 minutes ago"; UI-SPEC wants "edited 5m ago", so add a short helper next to it.
**Hydration gate:** render nothing until `useIssueDraftsHydrated()` (Pitfall 7).

---

### `components/app/TopBar.tsx` (modify)

**Analog:** itself. Insert the chip between the `mr-auto` spacer and the Search button (lines 143-157):
```tsx
<header ref={headerRef} className="h-12 border-b flex items-center px-4 flex-shrink-0 gap-2">
  <div className="mr-auto" />
  {/* Search trigger ... */}
  <button type="button" onClick={onPaletteOpen} aria-label="Search" ...>
```
TopBar header comment (lines 1-10) states it is pure UI and must NOT use `useQuery`; reading a zustand store inside `DraftsChip` is fine. Pass `onResumeDraft` as a prop from `AppLayout`, or have the chip call the create-modal store.

---

### `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (modify, two-column shell)

**Analog:** itself. Keep and reuse:

- Dialog shell (lines 433-450): replace `w-[680px] max-h-[85vh] overflow-y-auto` with fixed `w-[min(1080px,94vw)] h-[88vh]` + `flex flex-col`, inner `min-h-0 overflow-y-auto` main column, ~300px sidebar, sticky footer. Container query goes on an inner wrapper, not the Popup (container-query memory). Keep `z-50` and `bg-black/40 backdrop-blur-sm` backdrop.
- Esc / close handling (lines 435-446): already routes X/backdrop to `closeSilently()` and Esc through `details.cancel()` + `defaultPrevented` check. For Create, make `requestCancel` always `flush; onClose()` (already true because `dirty` is edit-only, line 176).
- Cmd+Enter form handler (lines 467-472) and `trySubmit` (422-428): keep.
- Editor + blur flush (lines 520-537): `<div onBlur={draft.flush}>` around `WikiEditorLazy preset="full"` with `flushSync` in `onSubmit`.
- `stagedHost` (227-235) and `setStagedFiles` (95, 232): on stage, also call `issue-draft-files` to copy; resume repopulates `stagedFiles` from copies and registers previews.
- Field blocks to move into `ModalSidebar`: Epic Link (584-600), Assignee `PersonPicker` (602-625), Priority `Select` (627-649), Story Points (651-669), Time Estimate (671-686), `CustomFieldsSection` (688-697). `LinkRowsSection` (698-704) stays in the main column. Subtask block (557-582, Parent key) stays for the Subtask type; D-03 only removes a subtasks *list*, none exists today.
- Footer (712-756): keep the two `Tooltip`+`Keycap` buttons; rename to `Create Issue` / `Save Changes` per UI-SPEC; add left side "Create another" checkbox (create only) + status line + `DraftNote`-style "Draft saved · Discard" (`components/ui/draft-note.tsx`, `state="draft"`).
- Reset-on-open effect (110-116): extend with `createAnother=false` (D-06) and hydrate-from-draft-once-per-open via a `HYDRATE` action (never let draft writes flow back into `initialValues`, since the open effect at `useCreateEditForm.ts:278-288` RESETs on `initialValues` change).
- Post-create (390-404): `onSuccess` currently has no arg; `stagedUploadErrorRef` branch keeps the modal open. Add: remove the draft + copies, and if `createAnother` reset with `keptFieldsAfterCreate`, focus `summaryRef`, show "Created KEY · Open".
- `onError` (405-415) already `draft.flush()`; copy for the create error per UI-SPEC ("Your draft is kept").

---

### `useCreateEditForm.ts` (modify: add fields + HYDRATE + partial reset)

**Analog:** itself.
**Add to `FormState`** (after line 57): `labels: string[]`, `fixVersions: { id: string; name: string }[]` (keep `name` so the trigger can render without the versions query).
**Add to `buildInitialState`** (lines 113-155) so Edit seeds them:
```typescript
labels: initialValues?.labels ?? [],
fixVersions: initialValues?.fixVersions ?? [],
```
**Add to `EditInitialValues`** (lines 8-28): `labels?: string[]; fixVersions?: { id: string; name: string }[];`
**New actions** in `FormAction` (lines 60-80): `{ type: 'HYDRATE'; state: Partial<FormState> }` and `{ type: 'RESET_KEEP'; keep: Partial<FormState> }`, handled in `formReducer` (lines 159-244) with the same spread style as `SET_FIELD` (line 162). Reducer case style to copy (lines 226-228):
```typescript
case 'ADD_LINK_ROW':
  return { ...state, linkRows: [...state.linkRows, action.row] };
```

---

### `useIssueMutations.ts` (modify: create + edit PUT path)

**Analog:** itself.

**Create body: add labels/fixVersions** next to the other options (lines 65-71):
```typescript
const options: Record<string, unknown> = {};
if (state.description.trim()) options.description = state.description;
if (state.selectedAssigneeName) options.assignee = { name: state.selectedAssigneeName };
if (state.priority) options.priority = { name: state.priority };
// add:
if (state.labels.length > 0) options.labels = state.labels;                    // string[]
if (state.fixVersions.length > 0) options.fixVersions = state.fixVersions.map((v) => ({ id: v.id }));
```
`createIssue` (`services/jira.ts:2455-2507`) merges any defined `[fieldKey: string]: unknown`, so no signature change is required beyond optional doc/type additions. Do not send labels/fixVersions on Subtasks unless the Subtask createmeta lists them (Story-only today: `FieldsSection.tsx:998` `isStory` gate for Fix Versions; labels are shown for all types).

**Edit PUT path: send only when changed, never clobber.** Copy the changed-field pattern from `editMutation` (lines 183-192):
```typescript
if (state.priority !== initialValues.priority) {
  fields.priority = state.priority ? { name: state.priority } : null;
}
if (state.epicLinkKey !== initialValues.epicLinkKey && epicLinkFieldKey) {
  fields[epicLinkFieldKey] = state.epicLinkKey;
}
```
Add, comparing against `initialValues.labels` / `initialValues.fixVersions` (order-insensitive, by id):
```typescript
if (!sameSet(state.labels, initialValues.labels ?? [])) fields.labels = state.labels;
if (!sameIds(state.fixVersions, initialValues.fixVersions ?? []))
  fields.fixVersions = state.fixVersions.map((v) => ({ id: v.id }));
```
Both go through `bulkUpdateIssue` (`services/jira.ts:3023-3041`, `PUT /rest/api/2/issue/{key}` with `{ fields }`). Value shapes mirror the live-edit path in `FieldsSection.tsx:520-541` (`labels` -> `string[]`, `fixVersions` -> `[{ id }]`), which uses `updateIssueField` (`services/jira.ts:2324-2348`, body `{ fields: { [fieldName]: value } }`). Because the diff is guarded by `initialValues`, an Edit with untouched controls sends neither field; if initial values failed to load (`undefined`), skip the diff (never send an empty array over existing data). Note `fields.fixVersions` REPLACES the set (`addIssueFixVersion` at 3050-3078 documents this); acceptable only because the control is seeded with the existing set.

**Create-another needs the key:** change `onSuccess: () => {...; onSuccess(); }` (lines 140-155) to pass `(newIssue)`: `onSuccess: (newIssue) => {...; onSuccess(newIssue)}` and widen the prop type at line 34 (`onSuccess: (created?: { id: string; key: string }) => void`). `mutationFn` already returns `newIssue` (line 138).

---

### `LabelsField.tsx` and `FixVersionField.tsx` (components)

**Labels analog:** `routes/dashboard/issue-detail/FieldsSection.tsx:942-990`: `Badge variant="secondary"` chips with a `×` remove button, an `Input` that adds on Enter (trim, skip empty, Esc cancels), "+ Add" trigger. Convert from `mutation.mutate` to `dispatch({ type: 'SET_FIELD', field: 'labels', value })`. Add a dedupe (case-sensitive; Jira labels cannot contain spaces: split or reject on space). Handler excerpt to adapt (lines 520-532):
```typescript
const trimmed = labelInput.trim();
if (!trimmed) return;
mutation.mutate({ fieldName: 'labels', value: [...currentLabels, trimmed] });
```

**Fix version analog:** `FieldsSection.tsx`:
- query (lines 196-205): `useQuery({ queryKey: ['jira-fix-versions', activeJiraProject, jiraBaseUrl], queryFn: ... fetchFixVersions(jiraBaseUrl, token, activeJiraProject), enabled: ... })`. `fetchFixVersions` is in `services/jira/versions.ts:14-52`, returns `JiraFixVersion[]` (`{id,name,releaseDate?,released}` at `services/jira/types.ts:77-83`). Reuse the **same query key** so the cache is shared. This resolves RESEARCH A2: use the project versions endpoint, not createmeta `allowedValues`. Enable the query on `open` (the live control enables on popover open; in the modal enable when the modal is open so a resumed or edit value renders its name).
- ordering (lines 254-290, `filteredVersions`): unreleased first, then 10 most recent released plus any selected older ones. Consider extracting this into a shared helper rather than copying.
- popover list rows (lines 999-1050): `Popover`/`PopoverTrigger`/`PopoverContent className="w-60 p-2"`, row `button` with leading check slot `<span className="w-4 text-center">{isSelected ? '✓' : ''}</span>`, `released` / `no date` badges.
- Multi-select; trigger label is `names.join(', ')` or "None" (line 1007). Base UI Select needs Root `items` for labels (memory), so use Popover not Select.

---

### `issue-actions.ts` `buildEditInitialValues` (modify: load Edit initial values)

**Analog:** itself (lines 6-28). `JiraIssueDetail.fields` already carries `labels: string[]` and `fixVersions: Array<{id,name,releaseDate?}>` (`services/jira.ts:1996-1997`), so no extra fetch:
```typescript
return {
  issueKey: issue.key,
  ...
  customFields,
  attachments: issue.fields.attachment ?? [],
  // add:
  labels: issue.fields.labels ?? [],
  fixVersions: (issue.fields.fixVersions ?? []).map((v) => ({ id: v.id, name: v.name })),
};
```
`buildCloneInitialValues` (lines 31-52): decide explicitly whether Clone copies labels/fix versions (Clone uses `issueKey: ''` = create mode). Default recommendation: copy labels, skip fixVersions, and test it. Other `EditInitialValues` constructors: `IssueDetailHeader.tsx:139` calls `buildEditInitialValues`; `main.tsx handleOpenEdit` (588-596) stores whatever it is given. Tests with hand-built `initialValues` (`CreateEditIssueModal.drafts.test.tsx:61-70`, `routes/dashboard/CreateEditIssueModal.test.tsx`) must tolerate the new optional fields.

**Reload staleness caveat:** `initialValues` is a one-time snapshot taken when Edit opens; the edit open effect RESETs on identity change (`useCreateEditForm.ts:288`), so keep a stable identity (see test comment line 60 "Stable identity: the form re-RESETs whenever initialValues changes").

---

### `routes/dashboard/CreateEpicDialog.tsx` (modify, D-17)

**Analog:** `CreateEditIssueModal.tsx` draft wiring plus the dialog's own state (lines 22-31, 55-86). Add `useIssueDraft` with `kind: 'epic'`, snapshot `{ epicName, description }` + staged copies, hydrate on resume, gate on content (name/description/file). Today `onOpenChange` closes silently (line 112-114) and on success resets local state (lines 83-87); remove the draft there. Mounted only at `EpicsPage.tsx:334` (`<CreateEpicDialog open={createOpen} onClose={() => setCreateOpen(false)} />`); for "resume from anywhere" hoist it to `AppLayout` or drive it from the create-modal store. Do not restyle (Phase 102 owns that); keep the `z-40`/`z-50` and `max-w-md` classes.

---

### `components/wiki-editor/*` (modify: restored image previews)

**Analog:** `components/wiki-editor/host.ts:141` `setLocalPreview(editor, name, url)` called from `media/upload-plugin.ts:162,183,254` with `URL.createObjectURL(...)`. `WikiEditorHandle` (`components/wiki-editor/types.ts:43-48`) exposes only `focus`, `blur`, `insertFiles`. Add `setLocalPreview(name: string, url: string): void` to that interface and to the handle implementation, delegating to `host.ts`. Use blob URLs only for `<img>`; anything inside `iframe/embed` must use `data:` URIs (WKWebView blob PDF gotcha).

---

### Tauri native wiring (config)

**Analogs:**
- `src-tauri/capabilities/default.json` (permissions array, e.g. `"store:default"`, `"process:allow-restart"`): add `"fs:allow-appdata-read-recursive"`, `"fs:allow-appdata-write-recursive"` (verify `mkdir`/`remove` need explicit `fs:allow-*` entries with `{"path":"$APPDATA/issue-drafts/**"}`, per RESEARCH A3). Scoped permission object style copies `opener:allow-open-path` (`{ "identifier": ..., "allow": [{ "path": "$DOWNLOAD/**" }] }`).
- `src-tauri/Cargo.toml`: next to `tauri-plugin-store = "2"` etc. add `tauri-plugin-fs = "2"`.
- `src-tauri/src/lib.rs:241-245`: `.plugin(tauri_plugin_store::Builder::new().build())` style; add `.plugin(tauri_plugin_fs::init())`.
- `package.json`: `@tauri-apps/plugin-fs` (human-verify checkpoint before install, slopcheck unavailable).

---

### Test files

**Store test analog:** `stores/drafts.store.test.ts` (setup lines 1-15). **Modal test analog:** `routes/dashboard/create-edit-issue/CreateEditIssueModal.drafts.test.tsx` lines 1-100: mocks for `@/services/stronghold` (`readSecret`), `WikiEditorLazy` (`@/test/wiki-editor-stub`), `@/stores/auth.store`, `@/stores/settings.store`, partial `@/services/jira` (`fetchCreatemeta`, `fetchIssueLinkTypes`, `bulkUpdateIssue`, `createIssueLink`), `@/lib/apiFetch`, `@/services/jira/attachments`; `QueryClient` with `retry:false`; `flushDraft` using `DRAFT_DEBOUNCE_MS`. New edit-mode labels/fix-version tests: render with `initialValues.labels/fixVersions`, assert controls show them, assert `bulkUpdateIssue` is NOT called with `labels`/`fixVersions` when untouched, and IS called with `labels: [...]` / `fixVersions: [{id}]` when changed. Existing modal tests assert old copy and must be updated (`Create`/`Save` -> `Create Issue`/`Save Changes`, title text); files: `.drafts.test.tsx`, `.attachments.test.tsx`, `.epic-story.test.tsx`, plus `routes/dashboard/CreateEditIssueModal.test.tsx`.

## Shared Patterns

### Persisted store with owner reconcile and hydration gate
**Source:** `stores/drafts.store.ts` lines 70-86, 100-107; `hooks/useDraftsAccountGuard.ts` lines 14-26
**Apply to:** `issue-drafts.store.ts`, the account guard
```typescript
export function useDraftsAccountGuard() {
  ...
  useEffect(() => {
    if (!authHydrated || !draftsHydrated) return;
    const owner = draftOwnerFrom({ jiraBaseUrl, jiraUsername });
    if (owner) useDraftsStore.getState().reconcileOwner(owner);
  }, [jiraBaseUrl, jiraUsername, authHydrated, draftsHydrated]);
}
```
Extend the guard (invoked at `main.tsx:697`) to also reconcile `useIssueDraftsStore` and purge staged copies. The credential-save path is `routes/settings/ConnectionsSection.tsx:535-541` (`resetAfterCredentialSave(); const owner = draftOwnerFrom(useAuthStore.getState()); if (owner) useDraftsStore.getState().reconcileOwner(owner);`): add the same call for the issue-drafts store there.

### Persistence adapter
**Source:** `lib/tauri-storage.ts:4-20` (`createTauriStorage(filename)`, whole JSON blob rewritten and saved on each `setItem`, so debounce and skip unchanged writes).

### No customer data in logs
**Apply to:** every draft file. Only `console.error` errors, never snapshot content (existing precedent: `useIssueMutations.ts:121`, `upload-staged-files.ts:18`).

### Mutation error / partial-failure convention
**Source:** `CreateEditIssueModal.tsx:385-404`; `CreateEpicDialog.tsx:78-88`. A staged-upload failure never rolls back creation; keep the modal open with the message, disable submit (`hasCreatedWithError`), and (per RESEARCH Pitfall 8) still remove the draft because the issue exists.

### Inline feedback, no toast
**Source:** error paragraph classes `rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive` (`CreateEditIssueModal.tsx:707`); muted note style `flex min-h-6 min-w-0 items-center gap-1 text-xs text-muted-foreground` (`components/ui/draft-note.tsx:18-22`).

### Pickers
**Source:** `PersonPicker` (`CreateEditIssueModal.tsx:606-624`), `EpicPicker` (589-598), `Select` for priority (631-648). Sidebar uses the same controls with label above a full-width control.

### Overlay / dialog
**Source:** Base UI `Dialog` + `Dialog.Portal` (`CreateEditIssueModal.tsx:433-450`); chip popover via `components/ui/popover`. Both portal already, no custom fixed overlay needed.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/issue-draft-files.ts` (fs plugin calls) | service | file-I/O | No `@tauri-apps/plugin-fs` usage exists; use RESEARCH "Staging a copy" and the official Tauri docs, `appDataDir` precedent only in `services/stronghold.ts:19,49` |

## Notes for the planner

- Labels/Fix-version in Edit: the data path is Edit `initialValues` (from `buildEditInitialValues`) -> `FormState` -> diff in `editMutation` -> `bulkUpdateIssue`. The load, diff and PUT are all localized in `issue-actions.ts`, `useCreateEditForm.ts`, `useIssueMutations.ts`; no editmeta call is needed (the live detail view already writes these via `updateIssueField`).
- Draft snapshots and `keptFieldsAfterCreate` must include `labels` and `fixVersions`. Edit mode creates no draft (D-10/D-12 concern Create; Edit keeps the Phase 100 description draft and `DiscardChangesDialog`).
- Subtask type: do not send `fixVersions` for Subtask unless Subtask createmeta advertises it; consider hiding the Fix version control for Subtask (mirrors `isStory` gate at `FieldsSection.tsx:998`).
- `JiraIssueDetail.fields.labels` is typed non-optional but real payloads may omit it; default to `[]`.

## Metadata

**Analog search scope:** `taskflow/src/stores`, `hooks`, `lib`, `components/app`, `components/ui`, `components/wiki-editor`, `routes/dashboard` (create-edit-issue, issue-detail), `services/jira*`, `main.tsx`, `src-tauri/`
**Files scanned:** about 30 read in full or by range
**Pattern extraction date:** 2026-11-17
