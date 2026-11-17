# Phase 101: Issue Drafts & Large Create/Edit Modal - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase covers two things:
1. The Create/Edit Issue modal becomes a large two-column dialog (UI-01), with a "Create another" option (UI-02).
2. Issue creation gets auto-saved, multiple, persistent drafts. Users resume them from a header Drafts chip (DRAFT-01..07).

The other editor hosts (comment hosts, and the Create Epic, Bulk Subtasks and Edit Release restyle) are Phase 102. Comment and Edit-description drafts already exist from Phase 100 and are not reworked here.

</domain>

<decisions>
## Implementation Decisions

### Modal layout (UI-01)
- **D-01:** The dialog is **large and fixed-size**, so it doesn't jump as content grows. The target is about `min(1080px, 94vw)` × `88vh`.
  - The main column scrolls on its own.
  - The fields sidebar is about 300px.
  - The footer is sticky.

  The user's words were "large and well usable, you decide", so exact sizes and the narrow-window behaviour are Claude's call (see Discretion).
- **D-02:** **Main column:** issue-type selector and title in the header, then Summary, the editor (`full` toolbar, 100 D-02), the staged-files strip, and **Links** (the existing `LinkRowsSection`).
- **D-03:** **There are no subtasks in the modal, in Create or Edit mode.** The user doesn't need subtask creation or a subtask list there.
  - Update REQUIREMENTS.md UI-01 to remove "subtasks" from the main column.
  - Update ROADMAP.md Phase 101 success criterion 1 the same way.
  - Do this as a docs change in the first plan, like Phase 100 D-01. It is not a code task.
- **D-04:** **Sidebar:** all metadata fields, with the label above a full-width control. Field order is Claude's call (see Discretion).
- **D-05:** **Sticky footer:**
  - left side: "Create another" checkbox (Create mode only) and the status line (D-08 / D-15);
  - right side: Cancel, then the primary button with the ⌘↵ tooltip (100 D-14/D-15).

  The Edit footer has no "Create another".

### Create another (UI-02)
- **D-06:** "Create another" **resets to unticked every time the modal opens**. It is not persisted.
- **D-07:** Which fields carry over after a create is Claude's call (see Discretion).
- **D-08:** Success feedback is Claude's call. There is no toast library, so the feedback goes inline, in the modal (see Discretion).
- **D-09:** Each create in a "Create another" run is its own draft lifecycle. The submitted draft is removed on success (DRAFT-07). The next form is a fresh draft.

### Draft lifecycle (DRAFT-01, 02, 04, 06, 07)
- **D-10:** **Continuous autosave:**
  - debounced writes while typing;
  - a flush on close or blur;
  - a crash or force-quit mid-typing loses nothing.

  This matches the Phase 100 drafts behaviour.
- **D-11:** **Every close keeps the draft, with no prompt.** That covers X, the backdrop, Cancel, Esc and navigating away. The Create modal never shows "Discard changes?" (this is the FLOW-02 exception). Discarding is only ever explicit (D-14, D-18). Esc still defers to open popovers first (100 D-11).
- **D-12:** A draft is created only when there is **user-entered content**: summary text, description text, a staged attachment, or a filled link row. Changing only the type, assignee, priority or other prefilled defaults doesn't create a draft. Once a draft exists, every field is saved with it.
- **D-13:** **Opening Create while drafts exist opens a blank form**, which starts a new independent draft (DRAFT-02). Whether to also show a subtle "You have N drafts · Resume" hint is Claude's call. The user said "whatever feels right, we might change this", so keep it cheap to add or remove, and expect it to be revisited at UAT.
- **D-14:** **A resumed draft** reopens with every field restored: type, project, summary, description, assignee, priority, labels, custom fields, parent/epic, links and staged files.
  - The footer shows the muted note "Draft saved · Discard", the same style as 100 D-04.
  - Discard removes the draft and closes the modal.
- **D-15:** **Stale draft on resume:**
  - Restore everything that is still valid.
  - Clear each invalid piece and show a muted inline note next to its field. Examples: "Epic ABC-12 no longer exists", "photo.png is missing", a custom field no longer on the screen.
  - Never block the user.

  This mirrors 100 D-05.
- **D-16:** Drafts persist across restarts until a successful create or an explicit discard (DRAFT-06/07). They have no expiry, and they are cleared on credential change (100 D-21).
- **D-17:** **Create Epic is included.** DRAFT-01 says "Story, Epic, Subtask or any type", and epics are created through the separate `CreateEpicDialog` (`EpicsPage.tsx:334`). That dialog must auto-save into the same drafts list (type icon Epic), and resuming one reopens `CreateEpicDialog`. Subtask drafts keep their parent key. This follows from the requirement and was not asked as a new choice.

### Staged attachments (DRAFT-05)
- Staged files are **copied into app storage** (under `appDataDir`) when they are staged.
  - The draft stores references to the copies, not `File` objects.
  - On create, they upload as today (99 D-09).
  - On discard or after a successful create, the copies are deleted.
  - Previews follow the WKWebView blob gotcha (data: URIs, not blob: in iframes).

### Drafts chip & list (DRAFT-03)
- **D-18:** The chip is in the **TopBar, left of Search**.
  - It is a labelled pill, "✎ Drafts 2", visible on every page and shown only when drafts exist.
  - It reads as a control, not a tab, and is visually distinct from `PinnedTabStrip`.
- **D-19:** The chip opens a **popover, newest first**. Each row shows: type icon, summary or "Untitled", parent/epic key, and "edited 5m ago".
  - Clicking a row resumes the draft.
  - Discard is a hover/trailing action.
  - Row styling follows `RecentItemsPopover` / `RecentItemRow`.
- **D-20:** How discard works from the list is Claude's call (see Discretion).

### Claude's Discretion
- **Exact dialog size and narrow-window behaviour.** Per the narrow-layout memory, the sidebar stays side-by-side and shrinks rather than stacking. Collapse only when the window is really too narrow.
- **Sidebar field order.** Suggested order:
  1. Assignee
  2. Priority
  3. Epic / Parent
  4. Labels
  5. Fix version (if offered by createmeta)
  6. Story points
  7. Estimate
  8. Custom fields

  DRAFT-04 lists labels. A dedicated labels input is allowed if labels aren't already covered by `CustomFieldsSection`. Check createmeta first.
- **Create another, kept fields.** Suggested:
  - keep: issue type, project, epic/parent, assignee, priority, labels, fix version and other "context" custom fields;
  - clear: summary, description, estimate, story points, links and staged files;
  - then focus Summary.
- **Create another, feedback.** Suggested: a muted footer line "✓ Created ABC-123 · Open", where Open opens the issue in the peek. It is replaced on each create.
- **Resume hint on a blank form (D-13).**
- **Discard from the list.** Suggested: inline "Draft discarded · Undo" for a few seconds. Staged copies are deleted only once the undo expires. Alternatives are an immediate discard or reusing the 100 D-09 dialog.
- **Draft store shape.** Phase 100 kept `drafts.store.ts` reusable. Either extend it with an `issue-create` kind, or add a sibling persisted store keyed by draft id (uuid). Issue drafts are structured (all fields plus file refs), not one text string. Debounce the writes. Never log draft content (no customer data).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, DRAFT-01..07, FLOW-02 (Create modal exception). Edit UI-01 per D-03.
- `.planning/ROADMAP.md` §Phase 101 — success criteria (edit criterion 1 per D-03).

### Prior phase decisions carried forward
- `.planning/phases/100-host-adoption-editing-workflow/100-CONTEXT.md`:
  - D-02: presets;
  - D-04: draft note style;
  - D-05: stale-base pattern;
  - D-09: confirm dialog;
  - D-11/D-14/D-15: Esc and Cmd+Enter;
  - D-20: Create Epic staging;
  - D-21: clear drafts on credential change;
  - draft-store discretion.
- `.planning/phases/99-mentions-media-smart-input/99-CONTEXT.md`:
  - D-09: staged images with local preview;
  - D-10: removing a staged embed leaves the file staged;
  - D-20: Esc nesting.
- `.planning/phases/100-host-adoption-editing-workflow/100-UI-SPEC.md` — current host visuals and the draft-note copy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (774 LOC): today a single 680px column. It already has the Base UI `Dialog`, `stagedHost` / `liveHost` `WikiEditorHost`, the Phase 100 description draft (`draft.flush` on blur), `requestCancel`, and `StagedFilesStrip`.
- `useCreateEditForm.ts`: a reducer (`SET_FIELD` …). It is the natural place to serialise and hydrate draft state.
- `useIssueMutations.ts`: create plus the staged upload. On success, clear the draft and its staged copies there.
- `useCreateEditQueries.ts`: createmeta and link types, used for the stale-field check on resume.
- `LinkRowsSection.tsx`, `CustomFieldsSection.tsx`, `IssueTypeSelector.tsx` (Story / Subtask / Bug).
- `src/stores/drafts.store.ts`: a persisted zustand store via `createTauriStorage`, with owner reconcile (D-21) and debounced writes.
- `src/routes/dashboard/CreateEpicDialog.tsx`: a separate Epic create host (D-17).
- `src/components/app/TopBar.tsx`: Search, RecentItemsPopover and the bell. The chip goes before Search.
- `src/components/app/RecentItemsPopover.tsx` / `RecentItemRow.tsx`: the row pattern for the drafts list.
- `src/services/stronghold.ts`: an `appDataDir()` usage example for app-storage file copies.

### Established Patterns
- Persisted zustand stores (`pinned-tabs`, `recent-items`, `drafts`).
- No toast library: feedback is an inline muted line.
- Esc and Cmd+Enter are registered in `src/lib/shortcuts.ts`.
- Custom overlays must portal to body (main isolate memory).

### Integration Points
- Create is opened from `main.tsx`, `CommandPalette`, `IssueDetailView`/`IssueDetailHeader`, `issue-actions.ts`, `PeekPanel` and others. "Resume from anywhere" needs a global open-create entry point (store or context) that accepts a draft id.
- Credential-save reset (`queryClient.clear()` + `credentialsRevision`): clear issue drafts and delete their staged copies.

</code_context>

<specifics>
## Specific Ideas

- The user stressed "large and well usable" for the modal.
- The new-vs-resume behaviour (D-13) is explicitly provisional: "we might change this".

</specifics>

<deferred>
## Deferred Ideas

- Subtasks in the Create/Edit modal were **dropped by user decision** rather than deferred (D-03).

### Reviewed Todos (not folded)
- `notifications-due-date-overdue.md`, `notifications-highlight-you-mention.md` and `notifications-status-category-colours.md` matched only on generic keywords. As in Phases 98–100, they are unrelated and stay in the backlog.

</deferred>

---

*Phase: 101-issue-drafts-large-create-edit-modal*
*Context gathered: 2026-11-17*
