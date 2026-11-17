# Phase 100: Host Adoption & Editing Workflow - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Every wiki text box in the app is swapped, one host at a time, to the Phase 98/99 `WikiEditor`:
- the Create Epic description;
- the Create/Edit Issue description;
- comment edit;
- the comment composer.

On top of that the phase adds:
- local drafts for unsent text;
- a discard warning on explicit cancel;
- Cmd+Enter submit and Esc cancel in every host;
- deletion of the old textarea editing code.

**Scope change made in this discussion:** inline description editing on issue detail and peek is **not built**. The description stays read-only there and is edited only in the Edit Issue modal. HOST-02 is dropped, and Phase 102's UI-04 (inline description in place, larger) is dropped with it. See D-01.

Issue-creation drafts, the Drafts chip and the large two-column modal stay in Phase 101.

</domain>

<decisions>
## Implementation Decisions

### Description editing
- **D-01:** The description is edited **only in the Edit Issue modal**. Issue detail and peek keep rendering it read-only through WikiRenderer, as today (`IssueDetailContent.tsx:188`). There is **no pencil and no click-to-edit**.
  - Update REQUIREMENTS.md: HOST-02 → dropped (by user decision, 2026-11-17), UI-04 → dropped.
  - Update ROADMAP.md: Phase 100 success criterion 1 no longer lists "inline description (detail and peek)". Phase 102 criterion 2 is removed.
  - Do this through the planning docs in the first plan (or as a docs commit), not as a code task.
- **D-02:** Presets carry forward without re-asking:
  - descriptions (Create/Edit Issue, Create Epic) use the `full` toolbar;
  - comment hosts (composer, comment edit) use the compact preset with the bubble menu (98 D-03, 99 INPUT-07).

### Local drafts (FLOW-01)
- **D-03:** Three kinds of unsent text keep a **local draft** that survives closing the peek or modal and restarting the app:
  1. the **new-comment composer**, per issue;
  2. an **in-progress comment edit**, per comment id;
  3. the **Edit Issue modal's description**, per issue.

  The Create Issue modal is excluded: its drafts are Phase 101 (DRAFT-01..07). Drafts are local only, with no autosave to Jira (REQUIREMENTS Out of Scope).
- **D-04:** **Restore:**
  - The editor reopens prefilled with the draft text.
  - A **muted note "Draft saved · Discard"** sits in the host's action row.
  - A comment-edit draft reopens that comment in edit mode when the issue is opened.
  - There are no banners or toasts (the app has no toast library).
- **D-05:** **Stale base:** store the original text (or Jira's `updated`) with each edit draft.
  - If the comment or description changed in Jira since the draft was taken, the draft is still restored.
  - A muted line "Changed in Jira since your draft" appears with a **"Use Jira version"** action.
  - Saving overwrites, as today.
  - New-comment drafts have no base and need no check.
- **D-06:** **Lifetime:** a draft lives **until it is sent/saved or discarded**, with no expiry. It is also removed when its issue or comment no longer exists (e.g. a 404 on load, or the comment was deleted).
- **D-07:** Text is never silently lost. The only ways to lose a draft are the explicit Discard (note action or warning dialog) or a successful save.

### Discard warnings (FLOW-02)
- **D-08:** Warn **only on explicit cancel with unsaved changes**:
  - the Cancel button, or Esc, in a comment edit;
  - the Cancel button, or Esc, in the Edit Issue modal.

  The following **never warn**, and the text is kept as a draft silently:
  - closing the peek;
  - navigating away;
  - closing the Edit Issue modal with X or the backdrop;
  - quitting the app.
- **D-09:** The warning is a small **confirm dialog**:
  - title "Discard changes?";
  - actions "Keep editing" and "Discard" (destructive);
  - Esc = Keep editing.

  There is no `AlertDialog` primitive in `components/ui`. Build it on `dialog.tsx`, following `confirm-sprint-move-dialog.tsx`. It must stack correctly over the Edit Issue dialog (nested Esc handling, 99 D-20).
- **D-10:** "Unsaved changes" means the text differs from its base after normalisation. Use the editor's `unchanged` verdict and the byte-identical no-op save from Phase 97. Whitespace-only noise from load/save must never trigger a warning.

### Keys (FLOW-03)
- **D-11:** **Esc order everywhere:**
  1. an open suggestion popover, bubble menu or node-view menu consumes Esc first;
  2. then the host acts on it (99 D-20).
- **D-12:** **Esc in the new-comment composer blurs it and keeps the text** (as a draft). There is no warning. Clearing is done with the draft note's Discard.
- **D-13:** **Esc in a comment edit or the Edit Issue modal** = cancel. It goes through D-08 and warns only if there are changes.
- **D-14:** **Cmd+Enter:**
  - the composer sends;
  - a comment edit saves;
  - in the Edit Issue / Create Issue / Create Epic modals it **submits the whole form**, the same as the footer's primary button, from any field.

  Enter alone never sends (Out of Scope: Enter-to-send).
- **D-15:** Register the Cmd+Enter / Esc behaviours in `src/lib/shortcuts.ts` so they show in the ⌘/ panel. Show the hints in the Save/Send button tooltips with keycaps (98 D-04 style).

### Cleanup (HOST-05)
- **D-16:** Delete all of the old textarea editing code:
  - `DescriptionEditor.tsx` (`insertAtCursor` toolbar, Edit/Preview tabs);
  - the CommentComposer `applyMarkup` / mirror-div caret code;
  - the textarea-bound `MentionPopover`, if nothing else uses it;
  - the comment-edit `Textarea` in `IssueDetailView.tsx`.
- **D-17:** Also delete **dead files**:
  - `src/routes/dashboard/InlineComment.tsx` and `src/routes/dashboard/IssueDetailSheet.tsx`, which only tests import;
  - their tests and the test cases referencing them (e.g. `IssueDetailSheet.test.tsx`, `EpicDetailSheet.test.tsx` mentions);
  - the placeholder `issue-detail/DescriptionSection.tsx` (a no-op).

  Verify with grep that nothing in prod imports them before deleting.
- **D-18:** Success criterion 5 must be provable: no `insertAtCursor`, no Preview `TabsTrigger` and no textarea toolbar remain in `src/`. A guard test, like the StatTile/ChartWrapper deletion guard, is welcome.

### Claude's Discretion
- **Adoption order:** the user said "you decide". Suggested order, lowest risk first, each step shippable:
  1. Create Epic;
  2. Create/Edit Issue description;
  3. comment edit;
  4. comment composer;
  5. drafts, guards and keys layered on;
  6. deletion last.

  The planner may reorder for dependency reasons.
- **Draft storage:** a persisted zustand store, like `pinned-tabs.store.ts` and `recent-items.store.ts`, keyed by `comment:new:<issueKey>`, `comment:edit:<commentId>` and `description:<issueKey>`. Debounce the writes. Phase 101 issue drafts will need a similar store, so keep the shape reusable without building 101's features.
- **Host wiring:** each host passes `WikiEditorHost` (issueKey, projectKey, attachments, userMap, uploadFile/deleteAttachment/isReferencedElsewhere, onOpenIssue). The composer replaces the `useComposerFocus` one-shot focus with the editor's focus API (the notification Reply action must still focus the composer).
- **Focus after send:** keep focus in the cleared composer, as today.
- **Composer sizing and the action-row look** stay as close to today as possible. Phase 102 (UI-03) restyles them.
- **Create Epic:** keep its current dialog size. Phase 102 (UI-05) enlarges it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md`: HOST-01..05, FLOW-01..03, and Out of Scope (no Enter-to-send, no autosave to Jira). HOST-02 and UI-04 are to be marked dropped per D-01.
- `.planning/ROADMAP.md` §Phase 100, §Phase 101 (draft boundary), §Phase 102 (UI-03/UI-05 restyle later).

### Prior phase decisions
- `.planning/phases/98-editor-shell/98-CONTEXT.md`: presets (D-03), keycap tooltips (D-04), Rich|Source preference (D-06), save-failed behaviour (D-08).
- `.planning/phases/99-mentions-media-smart-input/99-CONTEXT.md`: host contract, uploads/staging (D-06..D-10), Esc nesting (D-20), compact bubble host.
- `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md`, `.planning/research/ARCHITECTURE.md`: v1.15 research (drafts, host adoption, pitfalls of the reverted 2026-05-31 editor).

### Editor API
- `taskflow/src/components/wiki-editor/types.ts`: `WikiEditorProps`, `WikiEditorHost` ("Phase 100 hosts wire it").
- `taskflow/src/components/wiki-editor/WikiEditorLazy.tsx`: the lazy wrapper hosts should import.
- `taskflow/src/components/wiki-editor/host.ts`: the host store bridge.
- `taskflow/src/routes/dev-tools/EditorTab.tsx`: the dev harness host wiring example.

</canonical_refs>

<code_context>
## Existing Code Insights

### Hosts to swap
- `taskflow/src/routes/dashboard/CreateEpicDialog.tsx:74`: plain Textarea description.
- `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:380`: `DescriptionEditor` (textarea + insertAtCursor toolbar + Edit/Preview tabs, imperative `DescriptionEditorHandle` for attachment insert). `useCreateEditForm.ts` holds the form state.
- `taskflow/src/routes/dashboard/CommentComposer.tsx` (384 LOC): Textarea, applyMarkup, mirror-div caret, MentionPopover, AttachmentPickerModal, Edit/Preview tabs, `useComposerFocus`. Mounted sticky at the bottom of the activity column in `IssueDetailView.tsx:659`.
- `taskflow/src/routes/dashboard/IssueDetailView.tsx:947`: the comment edit Textarea with Cancel/Save (editText state lifted into IssueDetailView/ActivityTimeline).

### Reusable assets
- `components/ui/dialog.tsx` + `confirm-sprint-move-dialog.tsx`: base for the Discard changes? dialog.
- Persisted zustand stores (`pinned-tabs.store.ts`, `recent-items.store.ts`, `settings.store.ts`): the pattern for draft persistence.
- `components/ui/keycap.tsx` and `lib/shortcuts.ts`: shortcut registry and tooltip keycaps.
- `useMentionUserMap`: userMap for the host.

### Established patterns / gotchas (memory)
- A failed pre-commit hook leaves staged files. The full vitest suite runs on commit, so combine RED/GREEN.
- The React Compiler runs in the app, not in vitest. Module-level reads go stale only in the app.
- Overlays inside `isolate` `<main>` must portal to body. Nested dialog Esc must not close the parent.
- The Detail-page sections use SectionHeader. No card panels.

### Dead code (D-17)
- `InlineComment.tsx`: only `IssueDetailSheet.test.tsx` imports it.
- `IssueDetailSheet.tsx`: referenced only in comments and tests.
- `issue-detail/DescriptionSection.tsx`: a no-op placeholder.

</code_context>

<specifics>
## Specific Ideas

- The draft note wording is "Draft saved · Discard". The stale line is "Changed in Jira since your draft" with "Use Jira version". Both are muted, in the action row. No banners.
- Warning dialog copy: "Discard changes?" with "Keep editing" / "Discard".

</specifics>

<deferred>
## Deferred Ideas

- None new.
- Dropped by decision rather than deferred: inline description editing (HOST-02, UI-04).

### Reviewed Todos (not folded)
- `notifications-highlight-you-mention.md`, `priority-stripe-rest-rank.md`, `notifications-due-date-overdue.md` and `notifications-status-category-colours.md` matched only on generic keywords. As in Phases 98 and 99, they are unrelated and stay in the backlog.

</deferred>

---

*Phase: 100-host-adoption-editing-workflow*
*Context gathered: 2026-11-17*
