# Phase 102: Polished Surfaces - Context

**Gathered:** 2026-11-18
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase restyles the remaining editing surfaces so they look and behave like the Phase 101 Create/Edit Issue modal:

- **Comment hosts (UI-03):** the new-comment composer and the comment edit. Each gets an expanding editor and one consistent, clean action row.
- **Modals (UI-05):** Create Epic, Bulk Create Subtasks and Edit Release become larger and visually consistent with the Create/Edit Issue modal. Edit Release keeps plain-text/Markdown fields, with no wiki editor.

UI-04 (inline description editing) stays dropped (Phase 100 D-01). New capabilities are out of scope. The one approved exception is that Create Epic gains the shared sidebar fields (D-08).

</domain>

<decisions>
## Implementation Decisions

### Cross-cutting: one field look across the app
- **D-01:** The user's words: **"I want the inputs and editors to feel consistent across the app."** Every text input, textarea and wiki editor frame touched by this phase shares one field surface:
  - border colour, radius, padding and background (light and dark);
  - focus treatment;
  - placeholder colour, disabled and invalid states;
  - labels above the control, in the Issue modal style (`text-xs font-semibold text-muted-foreground`, with a red `*` when required).

  Known mismatch today:
  - The wiki editor frame (`WikiEditor.tsx:447`) uses `rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring`.
  - `Input`/`Textarea` (`components/ui/input.tsx`, `textarea.tsx`) use `focus-visible:border-ring ring-3 ring-ring/50`, `bg-transparent` and `dark:bg-input/30`.
  - Reconcile them to a single treatment and apply it in both places. The Create/Edit Issue modal is the visual reference.
- **D-02:** Every surface in scope uses the shared primitives:
  - `Input`, `Textarea`, `Button` and `Switch` from `components/ui`, plus the Issue modal's label style;
  - no raw `<input className="border rounded…">`, hand-rolled buttons or hand-rolled switches (Create Epic and the Edit Release "Released" toggle have these today);
  - sentence case everywhere ("Create epic", "Epic name", "Edit release", "Bulk create subtasks").

### Comment editor growth (UI-03)
- **D-03:** **The composer is collapsed while idle and expands on focus.**
  - Idle: a single-line "Add a comment…" field with no toolbar and no action row.
  - On focus, or whenever it holds text or a draft: it grows into the compact editor (bubble menu preset, 100 D-02) and shows the action row.
  - Blurred while empty: it collapses back.
  - Blurred with text: it stays expanded.
  - The notification "Reply" action (`useComposerFocus`) must expand it and focus it.
- **D-04:** **The comment edit uses the same sizing as the composer**, opened already expanded.

### Comment action row (UI-03)
- **D-05:** **The layout is the draft note on the left, then Attach and the buttons on the right.**
  - Left: the muted "Draft saved · Discard" note (100 D-04).
  - Right: a quiet paperclip Attach icon button, then Cancel (edit only), then the primary button ("Comment" for the composer, 100 D-19; "Save" for an edit). Keycap tooltips stay (⌘↵, Esc).
  - The user's note: "make it feel consistent across the app". Build one shared action-row component, used by both the composer and the comment edit, and align its spacing and button sizes with the modal footers.
- **D-06:** The composer has **no Cancel button**. Esc blurs it and keeps the text (100 D-12). Discard lives in the draft note.
- **D-07:** The composer's action row is **visible only while the composer is expanded** (D-03).

### Create Epic modal (UI-05)
- **D-08:** **Create Epic uses the two-column Issue modal shell with the Issue sidebar reused.**
  - Shell: the same size (`min(1080px,94vw)` × `88vh`), header bar, blurred backdrop, main column that scrolls on its own, and sticky footer as `CreateEditIssueModal`.
  - Main column: Epic name (required), then the large `full` description editor with Attach, then staged files.
  - Sidebar: `ModalSidebar` driven by the **Epic issue type's createmeta**, with the same field set and order as Create Issue (Assignee, Priority, Labels, Fix version, custom fields…). The user chose this explicitly, accepting the new fields for consistency.
  - The Epic Name custom field (`epicNameFieldKey`) is filled from the main-column Epic name input and must not appear twice in the sidebar.
  - The values must be sent in the create payload.
- **D-09:** **Epic drafts store the sidebar fields too.** The Phase 101 D-17 epic drafts gain the new fields, and resume restores them with the stale-field handling of 101 D-15.
- **D-10:** **Create Epic has no "Create another".** The footer uses the Issue footer layout: the status/draft line on the left, then Cancel and "Create epic" (⌘↵ tooltip) on the right.
- **D-11:** The copy and controls are fully aligned with the Issue modal, per D-01 and D-02.

### Bulk Create Subtasks (UI-05)
- **D-12:** The user said "you decide". The choice is **the Issue modal shell in one column**:
  - the same fixed size, header bar (title "Bulk create subtasks" with "Parent: KEY" under it), backdrop and sticky footer;
  - the template/type toolbar pinned under the header, with only the row list scrolling between toolbar and footer;
  - one column, because rows need the width;
  - controls and copy aligned per D-01 and D-02, including the inputs inside `SubtaskTemplateRow`.

### Edit Release (UI-05)
- **D-13:** **Edit Release becomes two-column** in the Issue modal shell.
  - Main column: Name, then the Jira version description (tall, filling the height), then the GitLab milestone section with Title and Description, shown only when a milestone is matched, as today.
  - Sidebar: Release date (`DatePicker`) and the Released `Switch`.
  - Sticky footer: per-source errors or a status line on the left, then Cancel and Save on the right.
- **D-14:** The descriptions stay **plain textareas: no wiki editor, no preview and no toolbar** (UI-05). They auto-grow or fill the height, and are styled per D-01 to look like the editor surface without its toolbar.

### Claude's Discretion
- The expanded composer's minimum height and its **maximum-height cap**. The user said "you decide; it should feel consistent and easy to use".
  - The suggested cap is relative to the pane (about half the available height) rather than today's fixed `max-h-[280px]`, with internal scrolling past the cap.
  - The same cap applies to the composer and the comment edit.
  - The collapse/expand animation, if any, must not shift the activity list noticeably.
- Whether the comment edit opens fitted to its content or at a fixed expanded minimum. It should not make the comment card jump much.
- **How to share the modal shell:**
  - **Preferred:** extract a shared shell (header, two-column body, sticky footer) and reuse `ModalSidebar`, rather than copying classes into each dialog.
  - **Alternative:** run Create Epic as `CreateEditIssueModal` in an Epic mode. This is acceptable if it keeps epic drafts (101 D-17) and Create Epic staging (100 D-20) intact.
  - The planner picks after research.
- Narrow-window behaviour for the new two-column modals follows the Issue modal: the sidebar stays side-by-side and shrinks, and stacks only below about 720px (narrow-layout memory).
- Whether Bulk Create keeps a fixed height or shrinks for a few rows. Default to the fixed Issue-modal size for consistency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — UI-03 and UI-05 (UI-04 dropped).
- `.planning/ROADMAP.md` §Phase 102 — success criteria 1–2.

### Prior phase decisions
- `.planning/phases/101-issue-drafts-large-create-edit-modal/101-CONTEXT.md`:
  - D-01: modal size;
  - D-04: sidebar label-above;
  - D-05: footer;
  - D-15: stale draft fields;
  - D-17: Create Epic drafts;
  - Discretion: sidebar field order and narrow behaviour.
- `.planning/phases/100-host-adoption-editing-workflow/100-CONTEXT.md`:
  - D-02: presets;
  - D-04: draft note;
  - D-08/D-09: discard warnings;
  - D-11..D-15: Esc and ⌘↵;
  - D-19: the "Comment" label;
  - D-20: Create Epic staging.
- `.planning/phases/100-host-adoption-editing-workflow/100-UI-SPEC.md` — the current host visuals and the draft-note copy.
- `.planning/phases/101-issue-drafts-large-create-edit-modal/` — the 101 UI-SPEC, if present, is the modal visual reference.

No external specs. Requirements are fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Surfaces to restyle
- `taskflow/src/routes/dashboard/CommentComposer.tsx` (155 LOC): `WikiEditorLazy` compact, `DraftNote` + "Comment" button row, `useComposerFocus` one-shot focus. Mounted at `IssueDetailView.tsx:798`.
- `taskflow/src/routes/dashboard/IssueDetailView.tsx:1106-1170`: the comment edit editor and its DraftNote/Cancel/Save row.
- `taskflow/src/routes/dashboard/CreateEpicDialog.tsx` (349 LOC):
  - shell: `max-w-md p-6`, a `z-40` backdrop with no blur, a raw `<input>` and raw buttons;
  - payload: name + description only;
  - already in place: drafts (`epicDraft`), staging and the ⌘↵ tooltip.
- `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx:596`: `w-[860px] max-h-[88vh] overflow-y-auto` (the whole dialog scrolls), a toolbar, a dnd-kit row list and `SubtaskTemplateRow`.
- `taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx`: `w-[680px]`, `Textarea rows={4}`, a hand-rolled switch, an `h2` instead of `Dialog.Title`, and the header/footer pattern already present.

### Reference / reusable
- `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:633-…`: the shell classes (`w-[min(1080px,94vw)] h-[88vh] min-h-[480px] max-h-[calc(100vh-2rem)]`, `@container`, `max-[720px]:flex-col`), label style and footer.
- `taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx`, `CustomFieldsSection.tsx`, `LabelsField.tsx`, `FixVersionField.tsx`, `AutocompleteField.tsx`, `useCreateEditQueries.ts` (createmeta): the sidebar to reuse for Create Epic.
- `taskflow/src/components/wiki-editor/WikiEditor.tsx:48` (preset min/max heights) and `:447` (the frame classes); `WikiEditorLazy.tsx:10` (the fallback min-h).
- `taskflow/src/components/ui/input.tsx`, `textarea.tsx`, `switch.tsx`, `button.tsx`: the shared primitives (D-01/D-02).
- `DraftNote`, `StagedFilesStrip`, `Keycap`, `Tooltip*`.

### Established patterns / gotchas (memory)
- Detail-page sections: no card panels. Match the local button row (outline buttons next to each other).
- Overlays inside `isolate` `<main>` portal to body. Nested dialog Esc must not close the parent.
- The React Compiler runs in the app but not in vitest. Screenshot the result before restyling a rejected style.
- `statusPillClass`/truncate gotchas apply if the Bulk rows are touched.

### Integration Points
- Create Epic opens from `EpicsPage.tsx` and from draft resume (101 D-17). Both entry points must keep working.
- `useComposerFocus` (notification Reply) → composer expand + focus.

</code_context>

<specifics>
## Specific Ideas

- The user repeated "consistent" for the action row, the Create Epic modal and, as a mid-discussion message, every input and editor in the app. Visual sameness is the primary goal of this phase.

</specifics>

<deferred>
## Deferred Ideas

- A Markdown Write | Preview toggle for the GitLab milestone description. It was considered and not chosen (D-14).

### Reviewed Todos (not folded)
- `notifications-highlight-you-mention.md`, `notifications-status-category-colours.md`, `priority-stripe-rest-rank.md`: keyword-only matches on notifications and priority stripes, not related to this phase.

</deferred>

---

*Phase: 102-polished-surfaces*
*Context gathered: 2026-11-18*
