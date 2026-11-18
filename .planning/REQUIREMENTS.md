# Requirements: Taskflow v1.15 Rich Wiki Editor

**Defined:** 2026-11-16
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## v1.15 Requirements

### Round-trip Safety (SAFE)

- [x] **SAFE-01**: WikiRenderer's parse pipeline is extracted into `lib/wiki/` with zero behaviour change and its existing tests passing unchanged
- [x] **SAFE-02**: A placeholder-only fixture corpus asserts in CI that every fixture renders identically through WikiRenderer after load → save (semantic equivalence)
- [x] **SAFE-03**: Opening text in the editor and saving without edits writes it back byte-identical
- [x] **SAFE-04**: Constructs the editor can't model (unknown macros, unparseable spans) are shown read-only as rendered blocks and saved verbatim
- [x] **SAFE-05**: If a text fails the round-trip check on load, the editor opens it in source mode with a quiet notice, so no rich edit can corrupt it
- [x] **SAFE-06**: Emoticons, `[~username]` mentions, escaping, `\\` line breaks and CRLF/trailing whitespace survive round-trip with their original spelling

### Editor Core (EDIT)

- [x] **EDIT-01**: User edits text in a rich view that looks like WikiRenderer output (shared prose styles)
- [x] **EDIT-02**: User can toggle between rich and raw Jira wiki source at any time without losing content
- [x] **EDIT-03**: User sees a side-by-side WikiRenderer preview while in source mode
- [x] **EDIT-04**: User can apply bold, italic, underline, strikethrough, monospace, sub/superscript from a toolbar and with keyboard shortcuts
- [x] **EDIT-05**: User can create headings, bullet/numbered lists (incl. mixed nesting), block quotes, horizontal rules and line breaks
- [x] **EDIT-06**: User can insert and edit links, and pasting a URL onto a selection makes it a link
- [x] **EDIT-07**: User can type wiki/markdown-style shortcuts (e.g. `*bold*`, `- `, `# `, `{code}`) that format in place, with IME composition respected
- [x] **EDIT-08**: Undo/redo works across all edits, including mode toggles
- [x] **EDIT-09**: The editor loads lazily with an equal-height skeleton and never rebuilds or loses the caret while typing

### Rich Blocks (BLOCK)

- [ ] **BLOCK-01**: User can insert a table and add/remove rows, columns and header cells
- [ ] **BLOCK-02**: User can insert and edit `{code}` blocks with a language, and `{noformat}` blocks
- [ ] **BLOCK-03**: User can insert and edit `{panel}`/`{info}`/`{note}`/`{warning}`/`{tip}` panels, incl. titles
- [x] **BLOCK-04**: User can colour text with `{color}` from a validated palette (CSS-injection safe)
- [x] **BLOCK-05**: User can open a `/` slash menu to insert any block type

### Mentions, Media & Smart Input (INPUT)

- [x] **INPUT-01**: User can @mention a person via server-side search, saved as `[~username]`
- [x] **INPUT-02**: User can embed an existing attachment (`!file!` / `[^file]`) from the attachment picker
- [x] **INPUT-03**: User can paste or drop an image/file into the editor, and it uploads (or stages on create) and embeds
- [x] **INPUT-04**: Pasting rich HTML (web, Word, Jira) keeps the supported formatting and drops everything else
- [x] **INPUT-05**: User gets issue-key autocomplete, and issue keys are decorated while typing
- [x] **INPUT-06**: User can type `:` to autocomplete Jira emoticons
- [x] **INPUT-07**: Compact comment hosts use a floating selection (bubble) menu instead of a fixed toolbar

### Editing Workflow (FLOW)

- [x] **FLOW-01**: An unsent comment or description edit is kept as a local draft across closing the peek or modal and restarting the app
- [x] **FLOW-02**: User is warned before unsaved edits are discarded by an explicit Cancel or Esc in a comment edit or the Edit Issue modal; closing the peek or modal (X/backdrop), navigating away or quitting keeps the text as a local draft silently. The Create Issue modal is the exception: it auto-saves a draft (DRAFT-01)
- [x] **FLOW-03**: Cmd+Enter submits and Esc cancels in every editor host, deferring to open popovers
- [x] **FLOW-04**: Global keyboard shortcuts are suppressed while typing in the editor (contenteditable)

### Issue Drafts (DRAFT)

- [x] **DRAFT-01**: Closing the Create Issue modal (Story, Epic, Subtask or any type) with content auto-saves it as a draft without a prompt
- [x] **DRAFT-02**: User can keep several independent issue drafts at once
- [x] **DRAFT-03**: A header "Drafts" chip with a count, styled differently from the pinned tabs, appears whenever drafts exist and opens a list of them (type icon, summary or "Untitled", parent/epic, last edited, Resume/Discard)
- [x] **DRAFT-04**: User can resume a draft from anywhere in the app, and the modal reopens with every field restored (type, summary, description, assignee, priority, labels, custom fields, parent/epic)
- [x] **DRAFT-05**: Staged attachments are kept with the draft (copied to app storage) and upload when the issue is created
- [x] **DRAFT-06**: Drafts persist across app restarts until the issue is created or the draft is discarded
- [x] **DRAFT-07**: User can discard a draft from the list, and a successful create removes its draft automatically

### Host Adoption (HOST)

- [x] **HOST-01**: The Create/Edit Issue description uses the new editor
- [~] **HOST-02**: ~~Inline description edit on issue detail and peek uses the new editor~~ — Dropped by user decision 2026-11-17 (Phase 100 D-01): the description is edited only in the Edit Issue modal.
- [x] **HOST-03**: The comment composer and comment edit use the new editor (the unused InlineComment component is deleted under HOST-05)
- [x] **HOST-04**: The Create Epic description uses the new editor
- [x] **HOST-05**: The old textarea editing code (insertAtCursor toolbar, Preview tabs) is deleted

### Polished Surfaces (UI)

- [x] **UI-01**: The Create/Edit Issue modal is a large two-column dialog: summary, editor, staged files and links in the main column, a fields sidebar and a sticky footer (subtasks dropped by user decision 2026-11-17, Phase 101 D-03)
- [x] **UI-02**: User can tick "Create another" to keep the modal open for the next issue, with common fields kept
- [x] **UI-03**: Comment hosts have an expanding editor and a consistent, clean action row
- [~] **UI-04**: ~~Inline description editing is in place and larger, with sticky Save/Cancel~~ — Dropped by user decision 2026-11-17 (Phase 100 D-01).
- [x] **UI-05**: Create Epic, Bulk Create Subtasks and Edit Release modals are bigger and visually consistent with the new modal (Edit Release keeps its plain-text/Markdown fields, with no wiki editor)

## Future Requirements

- **SAFE-F1**: Per-block re-emit, so only edited blocks are re-serialized and untouched paragraphs keep their exact source
- **EDIT-F1**: Source ↔ rich caret-offset mapping (v1.15 preserves the block and scroll position)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Library comparison spike | TipTap v3 chosen from research; Lexical/BlockNote/Milkdown/Plate/custom rejected |
| Task lists / checkboxes | Not Jira wiki syntax; inventing them corrupted `(/)`/`(x)` emoticons in the reverted 2026-05-31 build |
| Markdown or ADF as storage | Jira DC stores wiki markup; any other format risks silent corruption |
| Wiki editor for release descriptions | The Jira version description is plain text and the GitLab milestone is Markdown, so a wiki editor would rewrite them |
| Enter-to-send in comments | Conflicts with multi-line editing; Cmd+Enter submits |
| Unicode emoji picker | Jira DC renders only its emoticon set |
| Real-time collaboration | No server component |
| Autosave to Jira | Drafts stay local until an explicit save/create |
| CodeMirror/Monaco source mode | No Jira grammar exists; a plain textarea plus preview is enough |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-01 | Phase 96 | Complete |
| SAFE-02 | Phase 96 | Complete |
| SAFE-03 | Phase 97 | Complete |
| SAFE-04 | Phase 97 | Complete |
| SAFE-05 | Phase 98 | Complete |
| SAFE-06 | Phase 97 | Complete |
| EDIT-01 | Phase 98 | Complete |
| EDIT-02 | Phase 98 | Complete |
| EDIT-03 | Phase 98 | Complete |
| EDIT-04 | Phase 98 | Complete |
| EDIT-05 | Phase 98 | Complete |
| EDIT-06 | Phase 98 | Complete |
| EDIT-07 | Phase 98 | Complete |
| EDIT-08 | Phase 98 | Complete |
| EDIT-09 | Phase 98 | Complete |
| BLOCK-01 | Phase 98 | Pending |
| BLOCK-02 | Phase 98 | Pending |
| BLOCK-03 | Phase 98 | Pending |
| BLOCK-04 | Phase 98 | Complete |
| BLOCK-05 | Phase 99 | Complete |
| INPUT-01 | Phase 99 | Complete |
| INPUT-02 | Phase 99 | Complete |
| INPUT-03 | Phase 99 | Complete |
| INPUT-04 | Phase 99 | Complete |
| INPUT-05 | Phase 99 | Complete |
| INPUT-06 | Phase 99 | Complete |
| INPUT-07 | Phase 99 | Complete |
| FLOW-01 | Phase 100 | Complete |
| FLOW-02 | Phase 100 | Complete |
| FLOW-03 | Phase 100 | Complete |
| FLOW-04 | Phase 98 | Complete |
| DRAFT-01 | Phase 101 | Complete |
| DRAFT-02 | Phase 101 | Complete |
| DRAFT-03 | Phase 101 | Complete |
| DRAFT-04 | Phase 101 | Complete |
| DRAFT-05 | Phase 101 | Complete |
| DRAFT-06 | Phase 101 | Complete |
| DRAFT-07 | Phase 101 | Complete |
| HOST-01 | Phase 100 | Complete |
| HOST-02 | Phase 100 | Dropped |
| HOST-03 | Phase 100 | Complete |
| HOST-04 | Phase 100 | Complete |
| HOST-05 | Phase 100 | Complete |
| UI-01 | Phase 101 | Complete |
| UI-02 | Phase 101 | Complete |
| UI-03 | Phase 102 | Complete |
| UI-04 | Phase 102 | Dropped |
| UI-05 | Phase 102 | Complete |

**Coverage:**
- v1.15 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-11-16*
*Last updated: 2026-11-16 after roadmap creation (traceability filled)*
