# Phase 100: Host Adoption & Editing Workflow - Research

**Researched:** 2026-11-17
**Domain:** Swapping four textarea hosts to the shared TipTap `WikiEditor`; local drafts (persisted zustand); discard guard; Cmd+Enter / Esc; deletion of old editing code
**Confidence:** HIGH (everything below was read from the codebase in this session; Base UI behaviour read from installed 1.3.0 typings)

## Summary

The Phase 98/99 `WikiEditor` is a self-contained, controlled-by-string component (`value`/`onChange`, `preset`, `host`, `onVerdict`). Four hosts need swapping: Create Epic, Create/Edit Issue description, comment edit, comment composer. **The editor does not yet expose what Phase 100 needs.** It has no imperative handle (focus / insert), no `onSubmit` / `onCancel` / `autoFocus` props, and the placeholder is hard-coded ("Write a description…"). The first plan must add a small, additive host API to the editor before any host swap, otherwise the composer Reply-focus (`useComposerFocus`), Cmd+Enter, Esc, "focus after send" and the "Use Jira version / Discard returns focus" behaviours cannot be built.

Drafts are a new persisted zustand store using `createTauriStorage` (same as `pinned-tabs.store.ts`). The Tauri adapter writes the whole JSON blob and calls `store.save()` on every `setItem`, hydration is async, and the app can be killed before a debounce fires. So: debounce writes, flush on blur/unmount/`visibilitychange`, and gate "draft exists" reads on hydration.

Navigation blocking is **not needed**. The router is `createHashRouter` (react-router-dom 7). Per D-08 only explicit Cancel/Esc warns; navigation, peek close, X and backdrop keep a silent draft. FLOW-02 is therefore a pure Cancel/Esc confirm dialog. Note that ROADMAP criterion 3 ("warned ... by Esc, close or navigation") contradicts D-08 and must be reworded in the docs commit.

**Primary recommendation:** Plan order: (0) docs descope + editor host API (`ref` handle, `onSubmit`/`onCancel`, `placeholder`, `autoFocus`); (1) Create Epic; (2) Create/Edit Issue description; (3) draft store + Discard dialog + `useEditorDraft` hook; (4) comment edit; (5) composer; (6) keys/shortcuts/tooltips; (7) deletion + guard test.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The description is edited **only in the Edit Issue modal**. Issue detail and peek keep rendering it read-only through WikiRenderer, as today (`IssueDetailContent.tsx:188`). No pencil, no click-to-edit. Update REQUIREMENTS.md (HOST-02 dropped by user decision 2026-11-17, UI-04 dropped) and ROADMAP.md (Phase 100 criterion 1 no longer lists inline description; Phase 102 criterion 2 removed). Do this in the first plan or a docs commit, not a code task.
- **D-02:** Descriptions (Create/Edit Issue, Create Epic) use the `full` toolbar; comment hosts (composer, comment edit) use the compact preset with the bubble menu (98 D-03, 99 INPUT-07).
- **D-03:** Three kinds of unsent text keep a local draft surviving closing the peek/modal and app restart: (1) new-comment composer, per issue; (2) in-progress comment edit, per comment id; (3) Edit Issue modal description, per issue. Create Issue modal excluded (Phase 101). Local only, no autosave to Jira.
- **D-04:** Restore: editor reopens prefilled; muted note "Draft saved · Discard" in the host's action row; a comment-edit draft reopens that comment in edit mode when the issue is opened; no banners or toasts.
- **D-05:** Stale base: store original text (or Jira's `updated`) with each edit draft. If changed in Jira since the draft, still restore; muted line "Changed in Jira since your draft" with "Use Jira version". Saving overwrites. New-comment drafts have no base.
- **D-06:** Lifetime: until sent/saved or discarded, no expiry. Also removed when its issue or comment no longer exists (404 on load, comment deleted).
- **D-07:** Text is never silently lost. Only explicit Discard (note action or warning dialog) or successful save loses a draft.
- **D-08:** Warn only on explicit cancel with unsaved changes (Cancel button or Esc in a comment edit; Cancel button or Esc in Edit Issue modal). Never warn, keep draft silently: closing peek, navigating away, closing Edit Issue modal with X/backdrop, quitting.
- **D-09:** Small confirm dialog: title "Discard changes?", actions "Keep editing" and "Discard" (destructive), Esc = Keep editing. No `AlertDialog` primitive; build on `dialog.tsx` following `confirm-sprint-move-dialog.tsx`. Must stack over the Edit Issue dialog (nested Esc, 99 D-20).
- **D-10:** "Unsaved changes" = text differs from base after normalisation; use the editor's `unchanged` verdict and the byte-identical no-op save from Phase 97. Whitespace-only noise must never trigger a warning.
- **D-11:** Esc order: open suggestion popover / bubble menu / node-view menu consumes first; then the host.
- **D-12:** Esc in the composer blurs it and keeps the text as a draft. No warning. Clearing is via the draft note's Discard.
- **D-13:** Esc in comment edit or Edit Issue modal = cancel through D-08; warns only if changes.
- **D-14:** Cmd+Enter: composer sends; comment edit saves; Edit Issue / Create Issue / Create Epic modals submit the whole form from any field (same as footer primary). Enter alone never sends.
- **D-15:** Register Cmd+Enter / Esc in `src/lib/shortcuts.ts` so they show in the ⌘/ panel. Show hints in Save/Send button tooltips with keycaps (98 D-04 style).
- **D-16:** Delete `DescriptionEditor.tsx` (insertAtCursor toolbar, Edit/Preview tabs); CommentComposer `applyMarkup` / mirror-div caret code; the textarea-bound `MentionPopover` if nothing else uses it; the comment-edit `Textarea` in `IssueDetailView.tsx`.
- **D-17:** Also delete dead files `src/routes/dashboard/InlineComment.tsx`, `src/routes/dashboard/IssueDetailSheet.tsx` (only tests import them), their tests and test cases referencing them (e.g. `IssueDetailSheet.test.tsx`, `EpicDetailSheet.test.tsx` mentions), and placeholder `issue-detail/DescriptionSection.tsx`. Verify with grep that no prod code imports them.
- **D-18:** Criterion 5 must be provable: no `insertAtCursor`, no Preview `TabsTrigger`, no textarea toolbar remain in `src/`. A guard test like the StatTile/ChartWrapper deletion guard is welcome.

### Claude's Discretion
- Adoption order (suggested: Create Epic, Create/Edit Issue description, comment edit, comment composer, drafts/guards/keys, deletion last; planner may reorder for dependencies).
- Draft storage: persisted zustand store like `pinned-tabs.store.ts` / `recent-items.store.ts`, keyed `comment:new:<issueKey>`, `comment:edit:<commentId>`, `description:<issueKey>`; debounce writes; shape reusable for Phase 101 without building 101's features.
- Host wiring: each host passes `WikiEditorHost`; composer replaces `useComposerFocus` one-shot focus with the editor's focus API (notification Reply must still focus the composer).
- Focus after send stays in the cleared composer. Composer sizing/action-row look stay close to today (Phase 102 UI-03 restyles). Create Epic keeps its current dialog size (Phase 102 UI-05).

### Deferred Ideas (OUT OF SCOPE)
- None new. Inline description editing (HOST-02, UI-04) is dropped by decision, not deferred. Issue-creation drafts, Drafts chip and large two-column modal are Phase 101.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOST-01 | Create/Edit Issue description uses the new editor | Swap `DescriptionEditor` at `CreateEditIssueModal.tsx:380`; staged-file contract in "Host wiring"; RESET-on-open race pitfall |
| HOST-02 | Inline description edit on detail/peek | **Dropped (D-01).** Mark dropped in REQUIREMENTS.md; no code |
| HOST-03 | Composer, inline comment, comment edit use the new editor | `CommentComposer.tsx` (384 LOC) and `IssueDetailView.tsx:949` CommentCard; `InlineComment.tsx` is dead code (delete, not migrate) |
| HOST-04 | Create Epic description uses the new editor | `CreateEpicDialog.tsx:74` plain `<textarea>`; dialog is `max-w-md` (see pitfall) |
| HOST-05 | Old textarea toolbar and Preview-tab code gone | Deletion inventory + guard test below |
| FLOW-01 | Unsent text survives closing and restart | `drafts.store.ts` + `useEditorDraft` hook, Tauri store persistence |
| FLOW-02 | Warn before unsaved edits are discarded (Create Issue excepted) | Discard dialog + Base UI `escape-key` interception; scope per D-08 (no router blocker) |
| FLOW-03 | Cmd+Enter submits, Esc cancels in every host, deferring to popovers | New `onSubmit`/`onCancel` editor props via capture-phase keydown; existing popover Esc consumption |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Editing surface, keys inside editor | Browser/Client (WikiEditor) | — | Pure client, TipTap/ProseMirror |
| Draft persistence | Browser/Client (zustand + Tauri store plugin) | Tauri (disk JSON) | Local-only by decision; no backend |
| Save/post comment/description | API/Backend (Jira REST via existing `services/jira`) | — | Unchanged mutations (`postComment`, `updateComment`, `createIssue`, issue PUT) |
| Stale-base detection | Browser/Client | API (cached issue/comment query data) | Compare stored base to current fetched text |
| Discard confirm | Browser/Client (Base UI dialog) | — | UI only |

## Standard Stack

All libraries are already installed; **this phase adds no new packages**, so no slopcheck run is required. [VERIFIED: package.json]

| Library | Version | Purpose |
|---------|---------|---------|
| @tiptap/* | 3.34.0 | Editor engine (already in `components/wiki-editor`) |
| zustand + `persist` | ^5.0.11 | Drafts store (same pattern as `pinned-tabs.store.ts`) |
| `@tauri-apps/plugin-store` via `lib/tauri-storage.ts` `createTauriStorage('drafts.json')` | existing | Persistence across restart |
| @base-ui/react | installed 1.3.0 (`^1.2.0`) | Dialog; `onOpenChange(open, eventDetails)` with `reason` incl. `escape-key`, `eventDetails.cancel()` |
| @tanstack/react-query | ^5.90 | Existing mutations/queries; unchanged |
| vitest ^4 + jsdom + Testing Library | existing | Tests |

Package Legitimacy Audit: not applicable (no installs).

## Architecture Patterns

### Current host inventory (file:line)

| Host | File | Today | Notes |
|------|------|-------|-------|
| Create Epic description | `src/routes/dashboard/CreateEpicDialog.tsx:74` | raw `<textarea>`, `Dialog.Popup ... max-w-md p-6`, own `<form onSubmit>`; plain `<button>`s; epic name `<input>` | `description` state; submit passes `description \|\| undefined` |
| Create/Edit Issue description | `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:380` | `DescriptionEditor` + separate "Attach file" button/`fileInputRef` (~line 365) + `stagedFiles` chips; `descriptionRef.insertRef()` | Form state in `useCreateEditForm.ts` (`state.description`); modal mounted permanently in `main.tsx:803` (`<CreateEditIssueModal open=...>`), form `RESET`s in a `useEffect` on `open` (`useCreateEditForm.ts:269`); popup `w-[680px]`; footer Cancel (`onClick={onClose}`) + submit `Create`/`Save` |
| Comment composer | `routes/dashboard/CommentComposer.tsx` (props `issueKey, jiraBaseUrl, attachments`) | Textarea + applyMarkup + mirror-div + `MentionPopover` + `AttachmentPickerModal` + Edit/Preview Tabs; button label **"Comment"** (UI-SPEC says "Send (existing)": reconcile, see Open Questions); `useComposerFocus` one-shot | Mounted at `IssueDetailView.tsx:659` in a sticky bottom div for `timelineFilter in {comment, all}`; successful post clears text and invalidates `['jira-issue-detail', key, base]` + `['jira-issue-comments', key, base]` |
| Comment edit | `routes/dashboard/IssueDetailView.tsx:949` (`CommentCard`, memoized, ~line 830) | `Textarea` + Cancel/Save; state `editingCommentId`/`editText`/`editError` lifted in `IssueDetailView` (lines 338-427); `ActivityTimeline.tsx:225` passes `editText` only to the editing card | Save trims text and needs non-empty; `handleEdit` overwrites `editText` (see pitfall: switching edit target loses text) |
| Dead | `InlineComment.tsx`, `IssueDetailSheet.tsx`, `issue-detail/DescriptionSection.tsx`, `MentionPopover.tsx` (only `CommentComposer` + `InlineComment` import it) | — | Delete (D-16/D-17) |

Used in both the full page and the peek: `IssueDetailView` (peek = `layout="single-column"` inside `PeekPanel.tsx`). Edits therefore appear in peek and page from one code path.

### Phase 99 editor API (what exists)

`src/components/wiki-editor/types.ts`: `WikiEditorProps { value, onChange, preset?: 'full'|'compact', maxHeightClass?, className?, 'aria-label'?, onVerdict?, host? }`. `WikiEditorHost { issueKey?, projectKey?, attachments?, userMap?, staged?, uploadFile?(file)=>Promise<JiraAttachment>, stageFile?(file), deleteAttachment?(id), isReferencedElsewhere?(filename), onOpenIssue?(key) }`. Hosts import `WikiEditorLazy` (equal-height skeleton, error boundary). `routes/dev-tools/EditorTab.tsx` is the reference host wiring. [VERIFIED: codebase]

Behaviours that matter:
- Controlled by string with echo suppression: external `value` change resets the doc (no undo back); typing emits only when text differs from the last emitted. Typing then undoing back to the loaded doc makes `saveWiki` return `unchanged` with `text: load.original` (`lib/wiki/editor/engine.ts:106`), which is emitted via `onChange` if different from the last emit. **So the host can define `dirty = text !== baseText`** and D-10 is satisfied without extra editor API. Source mode emits raw text (a real textual edit is a real change).
- Esc: suggestion popovers stop propagation (`suggestion/create-suggestion.ts:152`), the bubble hides first (`toolbar/BubbleToolbar.tsx:86`, capture on `view.dom`), source suggest uses capture + `stopPropagation` (`source/SourceSuggest.tsx:222`). This delivers D-11 step 1 for dialogs/document listeners. **Reuse the same pattern** for the host-level Esc/Cmd+Enter: attach a capture `keydown` on the editor frame and act only if the event was not already `defaultPrevented`/stopped.
- Placeholder is hard-coded: `extensions.ts:202` `'data-wiki-placeholder': 'Write a description…'`. A `placeholder` prop is required ("Add a comment…" in the composer; "Optional description" in Create Epic).
- No `ref`, `autoFocus`, `onSubmit`, `onCancel`. `WikiEditor` is a plain function component; `SourceView` has `focus()` / `focusAt()` handle; the `editor` instance (`useEditor`) is internal.
- `global shortcuts`: react-hotkeys-hook ignores contenteditable/textarea (no `enableOnContentEditable` anywhere), `PeekPanel` Esc uses `enableOnFormTags:false`, so Esc inside the editor does not close the peek. After the composer blurs (D-12), the next Esc closes the peek, which is the intended behaviour. FLOW-04 already done in Phase 98 (`lib/typing-target.ts`).

### Required editor additions (plan 0, additive, back-compat)

```typescript
// types.ts (additions)
export interface WikiEditorHandle {
  focus(opts?: { toEnd?: boolean }): void;   // rich: view.focus + selection at end; source: SourceView.focusAt(end)
  blur(): void;
  insertWiki?(text: string): void;           // optional; Phase 99 types mention a handle but none exists
}
export interface WikiEditorProps {
  // ...existing
  placeholder?: string;
  autoFocus?: boolean;
  /** Cmd/Ctrl+Enter. Not called while a popover is open or an IME composition is active. */
  onSubmit?: () => void;
  /** Esc after popovers/bubble have had their turn. */
  onCancel?: () => void;
  ref?: React.Ref<WikiEditorHandle>;           // React 19: ref as prop; WikiEditorLazy must forward it
}
```

Implementation notes:
- React 19 (`react ^19.1`) allows `ref` as a normal prop, but `WikiEditor` is wrapped by `lazy()` + `Suspense` + an error boundary in `WikiEditorLazy`; the ref must be passed through `<WikiEditor {...props} />` (it will, since `ref` is in props in React 19). Test that a ref obtained through `WikiEditorLazy` resolves after the chunk loads (before that it is `null`: the composer Reply-focus effect must retry once the handle appears, e.g. `useEffect` on a `ready` state set from the handle callback ref, not on mount).
- Cmd+Enter and Esc go into the existing `onKeyDownCapture` on the frame (`WikiEditor.tsx` ~line 361) which already handles Mod-Shift-M / Mod-K. Guard: `e.isComposing`, `e.nativeEvent.isComposing`, and whether a suggestion/bubble is open (popover Esc has already `stopPropagation`'d at a deeper element, but capture on the frame runs *before* the target phase: so Esc must be handled in the **bubble** phase on the frame, or check a popover-open flag). Recommended: for Esc use `onKeyDown` (bubble) on the frame and skip if `e.defaultPrevented`; for Cmd+Enter use capture but skip when `exitAllSuggestions`-style "suggestion active" state is true (read the suggestion plugin state) so Enter in an open `@` popover still selects.
- Cmd+Enter must `preventDefault` so TipTap's `Mod-Enter` (hard break / code block exit) does not also fire. Check `keymap.ts`/StarterKit: `HardBreak` binds `Mod-Enter`; handling in capture + `stopPropagation` pre-empts it. Add a test.

### Draft store (FLOW-01)

```typescript
// src/stores/drafts.store.ts  (persist + createTauriStorage('drafts.json'), key 'drafts-store')
export type DraftKind = 'comment-new' | 'comment-edit' | 'description';
export interface Draft {
  text: string;
  /** Edit drafts: the Jira text (or `updated`) this draft started from. Undefined for new-comment drafts. */
  base?: string;
  baseUpdated?: string;
  issueKey: string;        // needed to enumerate comment-edit drafts for an issue (comment ids are not issue-scoped)
  updatedAt: number;
}
interface DraftsState {
  drafts: Record<string, Draft>;            // key = 'comment:new:PROJ-1' | 'comment:edit:10042' | 'description:PROJ-1'
  setDraft(key: string, d: Omit<Draft,'updatedAt'>): void;   // no-op when text === '' or equals base (not a draft)
  clearDraft(key: string): void;
  editDraftsFor(issueKey: string): Array<[string, Draft]>;
}
```

Rules:
- Key helpers in one module (`draftKey.commentNew(issueKey)` etc.) shared by hosts and tests; Phase 101 adds `issue:<id>` entries to the same store.
- Write only when `text !== (base ?? '')` and non-empty-after-trim for new comments; clearing text removes the draft (so the "Draft saved" note disappears for an empty composer).
- **Debounce 500 ms** (UI-SPEC) in a `useEditorDraft` hook, and **flush immediately** on editor blur, host unmount, `visibilitychange: hidden`, and before the hosting dialog closes. `createTauriStorage.setItem` does `store.set` + `store.save()` (writes the entire JSON each call), so never write per keystroke. `lib/tauri-storage.ts` documents a real race: the process can die before the async save completes (`persistChangelogBeforeRestart`); flush on blur/`visibilitychange` is the mitigation, and accept loss of the last <500 ms on a hard kill.
- Persist hydration is **async** (Tauri adapter returns promises). A host mounting before hydration sees no draft and may overwrite it. Use `useDraftsStore.persist.hasHydrated()` / `onFinishHydration` and delay seeding (or re-seed once on hydration if the user has not typed). Expose `useDraftsHydrated()`.
- Do not use `partialize` tricks; the whole `drafts` map is the persisted state; bump nothing in `settings.store` (different file, no migration).
- Cleanup (D-06): on a comment query load, drop `comment:edit:<id>` drafts whose id is absent from the loaded list (only when the comments query succeeded, never on error/loading); on issue 404, drop all keys for that issue. Do not run cleanup on a partially loaded/paginated comment list.
- Draft text may contain customer data: local only, never logged. (Project rule: no customer data in repo/fixtures.)

### `useEditorDraft` hook (shared by the three draft hosts)

Responsibilities: seed initial text from the draft (post-hydration), debounce+flush writes, expose `{ restored, hasDraft, discard(), stale, useJira() }`. Stale check (D-05): `draft.base !== currentJiraText` (comment: compare against `comment.body`; description: against `issue.fields.description`). **Caveat:** `initialValues.description` handed to the Edit modal comes from cached query data (`main.tsx handleOpenEdit`), which can be stale (project memory: cached-read pitfalls). Prefer refetching/using the live issue query when evaluating stale-ness, or at minimum compare against the value the modal was opened with and document the limitation.

### Discard dialog (FLOW-02)

New `src/components/ui/discard-changes-dialog.tsx` modelled exactly on `confirm-sprint-move-dialog.tsx` (`Dialog`, `DialogContent showCloseButton={false}`, `DialogHeader/Title/Description`, `DialogFooter`): title "Discard changes?", description "Your unsaved changes will be lost.", `Keep editing` (outline, autofocus) then `Discard` (destructive). Props `{ open, onKeepEditing, onDiscard }`; `onOpenChange(false)` (Esc/backdrop) = Keep editing. Base UI nests dialogs via its floating tree so Esc closes the topmost only; render it as a **React child** of the Edit modal tree (still portaled) so the tree relationship exists. Verify focus returns to the editor on Keep editing (use `WikiEditorHandle.focus`).

Intercepting the Edit Issue modal's own Esc/Cancel: the modal uses raw `Dialog.Root` with `onOpenChange={(o) => { if (!o) onClose(); }}`. Base UI 1.3 passes `(open, eventDetails)` where `eventDetails.reason` can be `'escape-key'`, `'outside-press'`, `'close-press'`, and `eventDetails.cancel()` prevents the close. [VERIFIED: node_modules/@base-ui/react/esm/dialog/root/DialogRoot.d.ts and utils/createBaseUIEventDetails.d.ts]. So: on `escape-key` and `dirty` -> `details.cancel()` and open the discard dialog; on `escape-key` and not dirty -> close; on `outside-press` and the X button -> close silently (draft kept; flush first). The footer Cancel button (`onClick={onClose}`) goes through the same `requestCancel()`.
Because the editor stops Esc propagation when a popover is open, a still-open popover never reaches Base UI. If the editor's own `onCancel` also calls `requestCancel()` there is a double-fire risk (Base UI's document handler plus the editor's): make the editor's `onCancel` the *only* Esc path in modal hosts by calling `preventDefault()+stopPropagation()` in the frame handler, or ignore the Base UI `escape-key` reason when focus is inside the editor. Test both Esc origins (focus in editor vs. focus on summary input).

### Cmd+Enter in modals (D-14)

Edit/Create Issue and Create Epic use a `<form onSubmit>`. Implement `requestSubmit()` on the form from (a) editor `onSubmit`, and (b) a `keydown` handler on the form element for other fields (bubble). Calling `formRef.current.requestSubmit()` runs the same validation as the footer button (disabled-state parity: also check the same disabled predicate because `requestSubmit` ignores a disabled submit button's state in some engines, so guard with the same condition: `!summary.trim() || !requiredCustomFieldsFilled || isPending || hasCreatedWithError` in the Issue modal; `!epicName.trim() || mutation.isPending` in Create Epic). UI-SPEC: invalid -> focus first invalid field (summary).

### Host wiring details

- `userMap`: `useMentionUserMap(initialMap, [text...], jiraBaseUrl)` (`hooks/useMentionUserMap.ts`); `IssueDetailContent.tsx:~181` is the existing consumer. Composer/comment edit can pass the same map derived in `IssueDetailView`.
- **Comment hosts (live issue):** `host = { issueKey, projectKey, attachments: issue.fields.attachment, userMap, uploadFile, deleteAttachment, isReferencedElsewhere, onOpenIssue }`. `uploadFile` = existing `uploadAttachment(jiraBaseUrl, token, issueKey, file)` via `readSecret('jira-pat')` (same as `CommentComposer.uploadMutation`) followed by `invalidateQueries(['jira-issue-detail', key, base])`; it must return the created `JiraAttachment` (`created[0]`). `deleteAttachment`/`isReferencedElsewhere`: reuse the issue-detail attachment delete helper (`handleDeleteAttachment` in `IssueDetailContent`); scope for comments is the whole issue's text (description + other comments), check how 99 defined it before wiring.
- **Create mode (Create Issue / Create Epic):** `host.staged = true`, `host.stageFile(file)` pushes to the modal's `stagedFiles` state; the editor inserts the staged ref itself (replaces `stagedAttachmentRef` call at `CreateEditIssueModal.tsx:136`). Create Epic: today it has no attachment support at all and `createIssue` is called with only a description; **omit upload/stage callbacks for Create Epic** (editor then rejects drops harmlessly, `paste-plugin.ts:80` checks `uploadFile || staged&&stageFile`), or add staging only if the planner wants parity. Recommend omit (scope).
- **Edit mode:** `uploadFile` as for comments but against `initialValues.issueKey`; `attachments` = `initialValues.attachments`. The separate "Attach file" button and file chips in the modal duplicate the editor's attach flow; remove the `DescriptionEditor`-only chip UI together with the component, keep or fold the "Attach file" button (check UI-SPEC: "attach/mention controls live in the editor footer"; full preset toolbar already has attach, `WIKI_OPEN_ATTACH_EVENT` -> `AttachmentPickerModal`). `AttachmentPickerModal` is already used inside `WikiEditor`.
- Composer after send: `mutation.onSuccess` sets `text ''` -> editor receives external value change and resets; then call `handle.focus()` (focus stays in cleared composer) and `clearDraft`. On error keep text and keep the draft (UI-SPEC copy "Failed to post comment — please try again").
- Notification Reply: `CommentComposer` effect `composerFocus === issueKey -> handle.focus(); clearComposerFocus()` must wait until the lazy editor mounted (handle non-null). Keep `composer-focus.store.ts` unchanged; only change the focus call. Existing tests (`CommentComposer.test.tsx` `composer focus request`) assert the store clears; rework to await the handle.
- Comment edit: lift `editText` state stays; replace `Textarea` with `WikiEditorLazy`; edit-mode entry seeds `editText = draft?.text ?? comment.body` and `base = comment.body`, saves draft per comment id; `onEditSave` trims (existing) and must also `clearDraft` in `onSuccess`; `onEditCancel` -> `requestCancel` (dialog if dirty). Cmd+Enter -> `onSaveEdit(comment.id)`; Esc -> cancel flow.
- **Auto-reopen edit drafts** (D-04): in `IssueDetailView`, once the comments query has data and `editingCommentId === null`, find `editDraftsFor(issueKey)` and `handleEdit(comment)` with the draft text; scroll the card into view (`scrollIntoView({block:'nearest'})`).

### Anti-Patterns to Avoid
- **Mirroring `value` into local editor state in hosts.** The editor already ignores echoes; keep a single string source (host state) and pass it through.
- **Writing the draft store from `onChange` per keystroke** (full-file Tauri write each time).
- **Branching a stateful cell on a value its own optimistic update flips** (project memory) – the "Draft saved" note must derive from `draft exists && text !== base`, not from a flag the save flips.
- **Imperative `getState()` reads in render** for drafts under React Compiler (project memory): subscribe with `useDraftsStore(selector)`.
- **Overlays in `<main>`** must portal to body (Discard dialog already does via `DialogContent`).
- **Pre-commit hook runs the full vitest suite**: do not commit RED tests; combine RED/GREEN per task.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Editor, toolbar, mentions, uploads, paste | Another textarea toolbar/mention popover | `WikiEditorLazy` + `WikiEditorHost` | Phases 97-99 built and tested it; reverted 2026-05-31 build is the cautionary tale |
| Persistence | `localStorage` / ad hoc `LazyStore` | zustand `persist` + `createTauriStorage` | App convention; mocked globally in `src/test/setup.ts` |
| Confirm dialog | Custom overlay / `window.confirm` | `dialog.tsx` primitives following `confirm-sprint-move-dialog.tsx` | Nested Esc, focus trap, portal handled by Base UI |
| Keycap tooltips | New hint chips | `components/ui/keycap.tsx` + `tooltip.tsx`, `lib/shortcuts.ts` `Editor` category | Existing 98 D-04 style |
| Nav blocking | `useBlocker` | nothing (D-08) | Navigation never warns; drafts persist silently |
| Dirty detection | Own normaliser / doc diff | `text !== base` using the editor's byte-identical `unchanged` emission | Phase 97 guarantee |
| Person lookups | Custom mention fetch | `useMentionUserMap` | Existing |

## Common Pitfalls

### Pitfall 1: Editor not ready when Reply/focus fires
`WikiEditorLazy` renders a skeleton first; `ref` is null until the chunk loads. **Avoid:** focus via handle only after it resolves (state-driven effect); test with the real lazy wrapper.

### Pitfall 2: Edit modal RESET-on-open vs draft seeding
`useCreateEditForm` dispatches `RESET` in an effect after `open` flips; the editor mounts with the previous `state.description`, then is reset externally. Seeding the draft with a second effect races it. **Avoid:** feed the draft into the same `RESET` (extend `RESET` action / `EditInitialValues` with `descriptionOverride`), and write drafts only after seed. Also the modal is permanently mounted: `Dialog.Popup` content unmounts on close, so the editor remounts on every open (value initial state is read once via `useState(() => loadWiki(value))`, so first render with stale text then external reset is handled but wasteful).

### Pitfall 3: Esc double handling in Edit Issue modal
Base UI document-level Esc + editor `onCancel` can both fire; or the editor's popover Esc leaks. **Avoid:** single Esc path (above) + tests with popover open (`@` menu) asserting dialog stays open and no discard dialog.

### Pitfall 4: `requestSubmit` on disabled/invalid form
Cmd+Enter bypassing the disabled primary button would create duplicate issues (`hasCreatedWithError` guard exists for exactly this, WR-01). Guard with the same predicate; never submit while `isPending`.

### Pitfall 5: Switching comment edit target loses text
`handleEdit(B)` while editing A overwrites `editText` silently (violates D-07). **Avoid:** persist A's draft before switching (flush), or disable other cards' Edit while editing.

### Pitfall 6: Same issue open in peek and full page
Both mount a composer for the same `comment:new:<key>`. Last writer wins; clearing in one leaves the other's text re-written on its next debounce. **Avoid:** write drafts only from a focused/dirty editor (skip writes when text equals last-seen store value), and on store change from elsewhere ignore (accept). Document as known limitation.

### Pitfall 7: Hydration race
See draft-store section: read after hydration, never overwrite a not-yet-hydrated draft with `''` (a mount `setDraft('')` effect would delete it).

### Pitfall 8: Create Epic width
`max-w-md` (448px) is too narrow for the `full` toolbar (CONTEXT says keep size; UI-SPEC says keep sizes). The toolbar is `@container`-responsive (`WikiEditor` root `@container`), so verify it collapses sensibly at 448 − 48px padding; if it does not, narrow overflow is a UAT item for Phase 102 (UI-05), not a Phase 100 resize.

### Pitfall 9: Tests mocking `./MentionPopover` and textarea roles
`CommentComposer.test.tsx`, `CommentComposer.attachments.test.tsx`, `DescriptionEditor.attachments.test.tsx`, `CreateEditIssueModal*.test.tsx`, `CreateEpicDialog.test.tsx`, `IssueDetailPage.progressive.test.tsx` use textarea/`getByRole('textbox')`/`fireEvent.change`. TipTap is a contenteditable; they must be rewritten against either a `vi.mock('@/components/wiki-editor/WikiEditorLazy')` textarea stub (fast, host-logic tests) plus a few real-editor integration tests using `shell-test-utils.tsx` (`installLayoutStubs`, `liveEditor`, `typeAt`).

### Pitfall 10: Deleting a test that carries unrelated coverage
`IssueDetailSheet.test.tsx` imports `CommentComposer` at lines 577/602 too; move those cases to `CommentComposer.test.tsx` before deleting the file. `EpicDetailSheet.test.tsx` only mentions the sheet in comments.

## Code Examples

### Base UI: veto Esc close when dirty
```typescript
// Source: @base-ui/react 1.3.0 DialogRoot.d.ts (onOpenChange eventDetails)
<Dialog.Root
  open={open}
  onOpenChange={(o, details) => {
    if (o) return;
    if (details.reason === 'escape-key' || details.reason === 'close-press') {
      if (dirty) { details.cancel(); setConfirmOpen(true); return; }
    }
    onClose(); // outside-press / X: silent, draft already flushed
  }}
>
```
(Footer Cancel `onClick` must also call `requestCancel()`; `close-press` is the X/Close part, where D-08 says silent, so branch on the element, not just the reason: the Close X sets a ref `closingViaX`.)

### Discard confirm (shape)
```typescript
// Source: src/components/ui/confirm-sprint-move-dialog.tsx pattern
<Dialog open={open} onOpenChange={(o) => { if (!o) onKeepEditing(); }}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Discard changes?</DialogTitle>
      <DialogDescription>Your unsaved changes will be lost.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" autoFocus onClick={onKeepEditing}>Keep editing</Button>
      <Button variant="destructive" onClick={onDiscard}>Discard</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Draft store skeleton
```typescript
// Source: pattern of src/stores/pinned-tabs.store.ts
export const useDraftsStore = create<DraftsState>()(
  persist((set, get) => ({ drafts: {}, /* setDraft, clearDraft, editDraftsFor */ }),
    { name: 'drafts-store', storage: createTauriStorage('drafts.json') }),
);
```

### Shortcut registry entries (D-15)
Append to `SHORTCUTS` in `src/lib/shortcuts.ts` with `category: 'Editor'` and the established documentation-only `defaultKey: 'editor:…'` prefix (see existing editor rows near line 188): `editor-submit` (`editor:⌘↵`, "Submit editor or form", displayKeys `['⌘','↵']`) and `editor-cancel` (`editor:Esc`, "Cancel editing / leave editor"). Never bind as global hotkeys.

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Textarea + `insertAtCursor` toolbar + Edit/Preview tabs | TipTap `WikiEditor` with Rich/Source toggle + side preview in source | Preview tab is replaced by Rich|Source (98) |
| Mirror-div caret + custom `MentionPopover` | Shared suggestion infrastructure (99 D-19) | Delete textarea-bound code |

## Runtime State Inventory
Not a rename/migration phase. Only new persisted state: `drafts.json` (new file, no migration). Existing `settings.json` untouched. Nothing else stores the deleted components' names (they are code-only).

## Environment Availability
Step 2.6 SKIPPED: code-only changes, no new external tools. Existing toolchain (node, npm, vitest, biome, tsc) already in use; Tauri runtime is not needed for tests (`@tauri-apps/plugin-store` is mocked globally in `src/test/setup.ts`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4 + jsdom + @testing-library/react (+ user-event) |
| Config | `taskflow/vitest.config.ts` (setup `src/test/setup.ts`, mocks Tauri store) |
| Run from | inner dir `/Users/mimo/Documents/Projects/taskflow/taskflow` |
| Quick run | `npx vitest run src/components/wiki-editor src/stores/drafts.store.test.ts <touched test files>` |
| Full suite | `npm run test` (also runs in the pre-commit hook along with `biome check --staged` and `tsc --noEmit`) |
| Static | `npm run check` (`biome check ./src && tsc --noEmit`) |

Real-editor tests use `src/components/wiki-editor/shell-test-utils.tsx` (`installLayoutStubs()`, `renderEditor`, `liveEditor`, `typeAt`). Host-logic tests should `vi.mock('@/components/wiki-editor/WikiEditorLazy')` with a textarea stub exposing `onSubmit`/`onCancel`/ref.

### Phase Requirements -> Test Map
| Req | Behavior | Type | Automated command | Exists? |
|-----|----------|------|-------------------|---------|
| HOST-01 | Create/Edit modal renders WikiEditor (full preset), description round-trips into `createIssue`/edit PUT; staged files still uploaded after create | integration (host, stubbed editor) | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/dashboard/create-edit-issue` | rewrite (Wave 0) |
| HOST-03 | Composer posts via `postComment`, clears + keeps focus, invalidates both keys; comment edit saves via `updateComment` | integration | `npx vitest run src/routes/dashboard/CommentComposer.test.tsx src/routes/dashboard/CommentComposer.attachments.test.tsx` | rewrite (Wave 0) |
| HOST-04 | Create Epic submits `createIssue` with description from editor; Cmd+Enter submits | integration | `npx vitest run src/routes/dashboard/CreateEpicDialog.test.tsx` | rewrite |
| HOST-05 | No `insertAtCursor`, no `TabsTrigger value="preview"`, deleted files absent, no prod import of deleted modules | guard (fs) | `npx vitest run src/routes/dashboard/editor-removal.guard.test.ts` | ❌ Wave 0 (model on `widget-removal.guard.test.ts`) |
| FLOW-01 | Draft written (debounced), flushed on blur/unmount, restored on remount incl. after store rehydrate, cleared on send/save/discard, removed when comment deleted | unit + integration | `npx vitest run src/stores/drafts.store.test.ts src/hooks/useEditorDraft.test.tsx` | ❌ Wave 0 |
| FLOW-01 | Stale base shows "Changed in Jira since your draft" + Use Jira version | unit | same | ❌ Wave 0 |
| FLOW-02 | Dirty Cancel/Esc opens Discard dialog; Keep editing keeps text and focus; Discard clears draft and closes; clean Cancel/Esc closes without dialog; X/backdrop close silently and keep draft; Create Issue modal never warns | integration | `npx vitest run src/components/ui/discard-changes-dialog.test.tsx src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ Wave 0 |
| FLOW-03 | Editor `onSubmit` on Mod-Enter (not during IME, not with open popover, no hard break inserted); Esc order popover > host; composer Esc blurs and keeps text; Esc in comment edit cancel flow | unit (real editor) | `npx vitest run src/components/wiki-editor/host-keys.test.tsx` | ❌ Wave 0 |
| FLOW-03 | Shortcuts registered with `Editor` category and unique ids | unit | `npx vitest run src/lib/shortcuts.test.ts` | check existing |
| Reply focus | `useComposerFocus` request focuses the lazy editor once ready, then clears | integration | `npx vitest run src/routes/dashboard/CommentComposer.test.tsx` | rewrite |

### Sampling Rate
- Per task commit: the touched host's test file(s) + `src/components/wiki-editor` if the editor changed
- Per wave merge: `npm run test` and `npm run check`
- Phase gate: full suite green before `/gsd-verify-work`; manual UAT for IME, Tauri restart persistence, nested Esc over the Edit modal (WKWebView)

### Wave 0 Gaps
- [ ] `src/stores/drafts.store.test.ts`, `src/hooks/useEditorDraft.test.tsx` (FLOW-01)
- [ ] `src/components/ui/discard-changes-dialog.test.tsx` (FLOW-02)
- [ ] `src/components/wiki-editor/host-keys.test.tsx` (FLOW-03; ref handle, placeholder, autoFocus)
- [ ] `src/routes/dashboard/editor-removal.guard.test.ts` (HOST-05)
- [ ] Rewrite textarea-based host tests listed in Pitfall 9; move `CommentComposer` cases out of `IssueDetailSheet.test.tsx` before deleting it
- [ ] Shared stub for `WikiEditorLazy` in host tests (e.g. `src/test/wiki-editor-stub.tsx`)

Manual-only (justified): macOS IME composition with Cmd+Enter, true app-restart persistence (needs Tauri runtime), nested Esc stacking in WKWebView.

## Security Domain

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V2/V3 Authentication/Session | no | unchanged (`readSecret('jira-pat')`) |
| V4 Access Control | no | unchanged |
| V5 Input Validation | yes | Editor emits wiki text (97 round-trip engine); Jira sanitises server-side. Draft restore must treat stored text as untrusted data, run through `loadWiki` (already the editor path), never `dangerouslySetInnerHTML` |
| V6 Cryptography | no | n/a |
| V8 Data Protection | yes | Drafts are plaintext in app data dir `drafts.json`; may contain customer text; same exposure as other stores (`notifications.json`). Never log draft text; do not include in the debug-log store |

Threat patterns: stored XSS via restored draft (mitigated: editor schema parse, renderer sanitised); draft leakage across Jira accounts (clear drafts on credential reset: `credentialsRevision` / `queryClient.clear()` flow in `project_credential_save_cache_reset`; recommend clearing `drafts` on disconnect/logout if one exists, otherwise note as open question).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TipTap/StarterKit `Mod-Enter` hard-break binding exists and would double-fire; handling in capture + `stopPropagation` pre-empts it | Editor additions | Low; the added test catches it |
| A2 | `react-hotkeys-hook` v-current ignores contenteditable by default (so peek Esc doesn't fire from inside the editor). Based on repo comment in `shortcuts.ts:196`, not re-verified against the library | Editor API | Medium; Esc inside editor could also close the peek: verify in UAT |
| A3 | Base UI `Dialog.Close` X emits reason `close-press` and Esc emits `escape-key` (typed in d.ts; runtime emission per reason not exercised here) | Discard dialog | Medium; verify with a test before relying on reason-based branching |
| A4 | Edit-mode `deleteAttachment`/`isReferencedElsewhere` semantics for comments/description should reuse `IssueDetailContent.handleDeleteAttachment`; 99's exact contract not re-read | Host wiring | Low-Medium; read `99-CONTEXT` D-10 and `nodeviews` before wiring |
| A5 | Persist hydration is async with the Tauri adapter and `persist.hasHydrated()` is available on zustand ^5 | Draft store | Low |
| A6 | Clearing drafts on credential change/disconnect is desirable | Security | Low; product call |

## Open Questions (RESOLVED)

1. **Composer button label: "Comment" (code) vs "Send" (UI-SPEC, D-14 prose, tooltip "Send ⌘↵").** The spec calls "Send" "existing" but the code says `Comment`. Recommend keeping the current `Comment` label (spec says "as close to today as possible") and tooltip "Comment ⌘↵", or confirm with user. Existing tests query `/comment/i`. RESOLVED: D-19 keeps "Comment", tooltip "Comment ⌘↵" (plan 100-08).
2. **ROADMAP criterion 3 wording** ("Esc, close or navigation") conflicts with D-08; fix in the docs commit along with criterion 1 and Phase 102 criterion 2. RESOLVED: plan 100-01 Task 1 rewrites criteria 1 and 3 and removes Phase 102 criterion 2.
3. **Create Epic attachments:** no attachment support today; recommendation is none (omit host upload/stage). Confirm. RESOLVED: D-20 reverses this recommendation. Create Epic gets staging like Create Issue (plan 100-04).
4. **Stale-base source for the Edit modal** (cached `initialValues.description` vs fresh fetch). Recommend comparing against the live issue query on open (refetch if older than a threshold). RESOLVED: plan 100-07 adds a live `fetchIssueDescription` query (staleTime 0).
5. **Sticky composer and the "Draft saved · Discard" note** need a 24px reserved line; UI-SPEC says no layout shift: verify the sticky container height in peek. RESOLVED: reserved 24px DraftNote line in plans 100-06 and 100-08.
6. **Draft clearing on logout/credential change**: does a disconnect flow exist? If yes, hook it. RESOLVED: D-21, implemented in plan 100-02 (account guard + ConnectionsSection hook).

## Sources

### Primary (HIGH)
- Codebase reads: `components/wiki-editor/{types.ts,WikiEditor.tsx,WikiEditorLazy.tsx,host.ts,editor-session.ts,extensions.ts,suggestion/create-suggestion.ts,toolbar/BubbleToolbar.tsx,source/SourceView.tsx,source/SourceSuggest.tsx}`, `routes/dashboard/{CommentComposer,CreateEpicDialog,DescriptionEditor,IssueDetailView}.tsx`, `create-edit-issue/{CreateEditIssueModal.tsx,useCreateEditForm.ts}`, `components/app/PeekPanel.tsx`, `main.tsx` (hash router, modal mount, Esc capture), `stores/{composer-focus,pinned-tabs,recent-items}.store.ts`, `lib/{tauri-storage,shortcuts,typing-target}.ts`, `components/ui/{dialog,confirm-sprint-move-dialog}.tsx`, `routes/dashboard/{usePreviewEscape.ts,widget-removal.guard.test.ts}`
- `node_modules/@base-ui/react` 1.3.0 type definitions (`DialogRoot.d.ts`, `createBaseUIEventDetails.d.ts`)
- `.planning/phases/100-*/100-CONTEXT.md`, `100-UI-SPEC.md`, `.planning/research/PITFALLS.md` (Pitfall 7: losing unsent drafts)

### Secondary / Tertiary
- None (no web research was needed; library behaviour taken from installed sources).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new
- Architecture / host inventory: HIGH, read directly
- Editor API gaps: HIGH, confirmed by grep (no `forwardRef`/`useImperativeHandle`/`onSubmit` in `WikiEditor.tsx`)
- Esc/dialog interplay: MEDIUM, typed API verified, runtime behaviour needs tests (A2, A3)
- Pitfalls: HIGH/MEDIUM

**Research date:** 2026-11-17
**Valid until:** ~30 days (stable; depends on Phase 99 code not changing)
