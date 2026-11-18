# Roadmap: Taskflow

## Milestones

- 🚧 **v1.15 Rich Wiki Editor** — Phases 96-102 (in progress)
- ✅ **v1.14 Release Management** — Phases 87-95 (shipped 2026-08-13, extended through Phase 95 and closed 2026-11-16)
- ✅ **v1.13 Personal Workspace** — Phases 81-86 (shipped 2026-06-16)
- ✅ **v1.12 Jira Experience Improvements** — Phases 76-80 (shipped 2026-06-07)
- ✅ **v1.11 GreenHopper API Migration** — Phases 71-75 (shipped 2026-06-01)
- ✅ **v1.10 Cleanup, Roles Removal & Standup Notes** — Phases 65-70 (shipped 2026-05-25)
- ✅ **v1.9 Tempo, Dashboard Redesign & Cleanup** — Phases 59-64 (shipped 2026-05-23)
- ✅ **v1.8 AIO Test Management** — Phases 50-58 (shipped 2026-05-19)
- ✅ **v1.7 Performance & Perceived Speed** — Phases 42-49 (shipped 2026-04-05)
- ✅ **v1.6.3 Release & Auto-Update Pipeline** — Phases 38-41 (shipped 2026-03-29)
- ✅ **v1.5 Dashboard Redesign & Feature Parity** — Phases 31-37 (shipped 2026-03-24)
- ✅ **v1.4 Internal Quality & Performance** — Phases 25-30 (shipped 2026-03-20)
- ✅ **v1.3 UX & Branding** — Phases 18-24 (shipped 2026-03-19)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)

## Phases

**Phase Numbering:**

- Integer phases (96, 97, 98...): Planned milestone work
- Decimal phases (96.1, 96.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 96: Wiki Foundations & Equivalence Harness** - Extract lib/wiki/ with zero behaviour change and a placeholder-only corpus that proves round-trip equivalence in CI (completed 2026-11-16)
- [x] **Phase 97: Round-Trip Engine** - Source-level wiki parser and canonical emitter (incl. tables, panels, colour, nesting) with raw atoms and byte-identical no-op save (completed 2026-11-16)
- [ ] **Phase 98: Editor Shell** - Lazy TipTap WikiEditor with toolbar, shortcuts, input rules, blocks, source toggle and runtime guard, proven in a dev-tools preview tab
- [x] **Phase 99: Mentions, Media & Smart Input** - @mentions, attachments, image paste/drop, rich-HTML paste, issue keys, emoticons, slash menu, bubble menu (completed 2026-11-17)
- [x] **Phase 100: Host Adoption & Editing Workflow** - Swap every wiki host to the new editor one at a time, add local drafts, dirty guards and Cmd+Enter/Esc, delete the textarea code (completed 2026-11-17)
- [x] **Phase 101: Issue Drafts & Large Create/Edit Modal** - Two-column Create/Edit Issue modal with Create another, plus auto-saved multi-draft issue creation with a header Drafts chip (completed 2026-11-18)
- [ ] **Phase 102: Polished Surfaces** - Comment hosts, Create Epic, Bulk Subtasks and Edit Release restyled to match

<details>
<summary>✅ v1.14 Release Management (Phases 87-95) — SHIPPED 2026-08-13, closed 2026-11-16</summary>

- [x] Phase 87: Release Detail Decomposition (6/6 plans) — completed 2026-08-10
- [x] Phase 88: Release Branch & Milestone Creation (11/11 plans) — completed 2026-08-10
- [x] Phase 89: Three-Channel Drift Detection (5/5 plans) — completed 2026-08-11
- [x] Phase 90: Per-MR Corrective Actions (4/4 plans) — completed 2026-08-11
- [x] Phase 91: Post-Release Merge-Back Verification (9/9 plans) — completed 2026-08-11
- [x] Phase 91.1: Unified Release Detail Task Table (INSERTED) (10/10 plans) — completed 2026-08-12
- [x] Phase 91.2: Epics Page Redesign (INSERTED) (4/4 plans) — completed 2026-08-12
- [x] Phase 92: Advanced Global Search (6/6 plans) — completed 2026-10-16
- [x] Phase 93: Releases List Redesign (11/11 plans) — completed 2026-10-30
- [x] Phase 94: Release Detail Redesign (8/8 plans) — completed 2026-10-30
- [x] Phase 95: Notifications Redesign (6/6 plans) — completed 2026-11-11

See archive: `.planning/milestones/v1.14-ROADMAP.md`

</details>

<details>
<summary>✅ v1.13 Personal Workspace (Phases 81-86) — SHIPPED 2026-06-16</summary>

- [x] Phase 81: Charting Foundation (3/3 plans) — completed 2026-06-14
- [x] Phase 82: My Tasks Page (5/5 plans) — completed 2026-06-14
- [x] Phase 83: Dashboard Stat Tiles + Sprint Health (3/3 plans) — completed 2026-06-15
- [x] Phase 84: Dashboard Trend Chart + Activity Strip (4/4 plans) — completed 2026-06-15
- [x] Phase 85: Sprint Insights (Conditional, probe-gated) (4/4 plans) — completed 2026-06-15
- [x] Phase 86: Dashboard Redesign to Screenshot Layout (4/4 plans) — completed 2026-06-16

See archive: `.planning/milestones/v1.13-ROADMAP.md`

</details>

<details>
<summary>✅ v1.12 Jira Experience Improvements (Phases 76-80) — SHIPPED 2026-06-07</summary>

- [x] Phase 76: Visual Polish and Shared Primitives (4/4 plans) — completed 2026-06-03
- [x] Phase 77: Universal Peek Slideover and Issue-Detail Refinements (4/4 plans) — completed 2026-06-03
- [x] Phase 78: Drag-to-Rank on Backlog (4/4 plans) — completed 2026-06-04
- [x] Phase 79: Drag-to-Transition on Sprint Board (3/3 plans) — completed 2026-06-04
- [x] Phase 80: Subtask Templates and Bulk Creation (4/4 plans) — completed 2026-06-05

See archive: `.planning/milestones/v1.12-ROADMAP.md`

</details>

<details>
<summary>✅ v1.11 GreenHopper API Migration (Phases 71-75) — SHIPPED 2026-06-01</summary>

- [x] Phase 71: GreenHopper Adapter Foundation (6/6 plans) — completed 2026-05-28
- [x] Phase 72: Workflow Transitions via GreenHopper (3/3 plans) — completed 2026-05-29
- [x] Phase 73: Sprint Board on allData.json (3/3 plans) — completed 2026-05-29
- [x] Phase 74: Backlog on data.json (6/6 plans) — completed 2026-05-29
- [x] Phase 75: Progressive Issue Detail Rendering (4/4 plans) — completed 2026-05-30

See archive: `.planning/milestones/v1.11-ROADMAP.md`

</details>

<details>
<summary>✅ v1.0–v1.10 (Phases 1-70) — SHIPPED 2026-03-12 → 2026-05-25</summary>

Earlier milestones are collapsed. See per-milestone archives in `.planning/milestones/v{X.Y}-ROADMAP.md`:

- v1.0 MVP (Phases 1-4) — 2026-03-12
- v1.1 Polish (Phases 5-8) — 2026-03-13
- v1.2 Jira Parity (Phases 9-17) — 2026-03-15
- v1.3 UX & Branding (Phases 18-24) — 2026-03-19
- v1.4 Internal Quality & Performance (Phases 25-30) — 2026-03-20
- v1.5 Dashboard Redesign & Feature Parity (Phases 31-37) — 2026-03-24
- v1.6.3 Release & Auto-Update Pipeline (Phases 38-41) — 2026-03-29
- v1.7 Performance & Perceived Speed (Phases 42-49) — 2026-04-05
- v1.8 AIO Test Management (Phases 50-58) — 2026-05-19
- v1.9 Tempo, Dashboard Redesign & Cleanup (Phases 59-64) — 2026-05-23
- v1.10 Cleanup, Roles Removal & Standup Notes (Phases 65-70) — 2026-05-25

</details>

## Phase Details

### Phase 96: Wiki Foundations & Equivalence Harness

**Goal**: The existing wiki rendering pipeline is reusable outside WikiRenderer and a corpus can prove, in CI, that any text round-trips with the same rendering
**Depends on**: Nothing (first phase of v1.15)
**Requirements**: SAFE-01, SAFE-02
**Research**: Needs phase research (plugin order, live Jira grammar checks, mention format)
**Success Criteria** (what must be TRUE):

  1. Wiki issue descriptions and comments render exactly as before across the app, and the existing WikiRenderer tests pass without modification
  2. `lib/wiki/` exposes the preprocess, wiki-to-markdown and shared plugin pipeline plus a wikiToHtml helper, with presentation-only plugins kept out of the core list
  3. A placeholder-only fixture corpus (no customer data) covers the constructs in the grammar, including hard cases (nested lists, tables, panels, emoticons, mentions, CRLF)
  4. CI runs an equivalence assertion over the corpus and fails when a fixture renders differently after load and save

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 96-01-PLAN.md — Verbatim extraction of preprocess + core plugin pipeline into lib/wiki (WikiRenderer.test.tsx unmodified)
- [x] 96-03-PLAN.md — Placeholder-only fixture corpus (37 .wiki files), .gitattributes -text, raw glob loader, coverage gate

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 96-02-PLAN.md — Package legitimacy gate, direct unified deps + rehype-stringify, wikiToHtml with react-markdown parity test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 96-04-PLAN.md — isEquivalent + minimal normaliser, corpus harness with identity, mutation self-tests and negative controls
- [x] 96-05-PLAN.md — TipTap vs CodeMirror-6 WKWebView spike on throwaway worktree, SAFE-01 spot check, findings doc

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 96-06-PLAN.md — User-run live Jira render probe (D-11), mention format, text-only findings

### Phase 97: Round-Trip Engine

**Goal**: Wiki text can be parsed into an editor document and emitted back without changing what Jira shows, and an unedited text is saved byte-identical
**Depends on**: Phase 96
**Requirements**: SAFE-03, SAFE-04, SAFE-06
**Research**: Needs phase research (table and nested-list modelling)
**Success Criteria** (what must be TRUE):

  1. Every corpus fixture parsed and re-emitted renders identically through WikiRenderer, including header-less tables, panel family, `{color}` and mixed `*#` nesting
  2. Loading and saving a text with no edits returns the original string byte-for-byte, including CRLF and trailing whitespace
  3. Emoticons such as `(/)` and `(x)`, `[~username]` mentions, escapes and `\\` line breaks keep their original spelling after a round-trip
  4. Unknown macros and unparseable spans are carried as raw atoms that display as rendered read-only blocks and are saved verbatim
  5. Any construct that is not proven by the corpus is demoted to a raw atom rather than modelled

**Plans**: 17 plans (10 + 7 gap closure)
Plans:
**Wave 1**

- [x] 97-01-PLAN.md — Renderer fixes D-01 (mixed `*#` nesting) and D-02 (header-less tables)
- [x] 97-02-PLAN.md — 27 new fixtures, @tiptap deps, wiki schema + contract types, bundle guard

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 97-03-PLAN.md — Renderer fix D-12 (panel family, lists in panels) + visual Jira-parity check

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 97-04-PLAN.md — Lossless core: block scanner, macro segmenter/raw atoms, emitter, loadWiki/saveWiki no-op, corpus + fuzz tests

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 97-05-PLAN.md — Lists (mixed nesting) and block quotes modelled

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 97-06-PLAN.md — Panels (nested, in lists, in cells) and tables (headerless attr) modelled

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 97-07-PLAN.md — Inline atoms: emoticons, mentions, escapes, breaks, images, attachments, inline raw

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 97-08-PLAN.md — Formatting marks, links and typed-text escaping

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 97-09-PLAN.md — `{color}` marks (allowlisted), multi-block span proven or demoted

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 97-10-PLAN.md — D-11 fallback ladder, scripted edits (D-04..D-08), harness wiring

**Gap closure — Wave 1**

- [x] 97-11-PLAN.md — Renderer: mid-line panels keep their list item/paragraph (CR-01); attribute escaping + positional headerless marker (CR-02)
- [x] 97-12-PLAN.md — Emitter: typed atom look-alikes escaped, emoticon inner-char escapes, strict property oracle (CR-05)

**Gap closure — Wave 2** *(blocked on 97-12)*

- [x] 97-13-PLAN.md — Emitter on edited docs: raw atoms in items/cells, WikiEmitError (CR-03); empty cells and hard breaks (CR-04); edited attrs beat recorded spelling (WR-02)

**Gap closure — Wave 3** *(blocked on 97-11, 97-12, 97-13)*

- [x] 97-14-PLAN.md — saveWiki structural re-check with WikiSave result (WR-01); validation map; SAFE-04/SAFE-06 back to Complete

**Gap closure round 2 — Wave 1**

- [x] 97-15-PLAN.md — Renderer: Jira backslash escapes neutralised before jira2md, escaped code openers, inline-code entity decoding (gap 2 / CR-02)
- [x] 97-16-PLAN.md — Parser: mid-line live macro tokens as raw atoms so typed look-alikes escape; opening-delimiter escapes (gap 1 / CR-01, WR-04)

**Gap closure round 2 — Wave 2** *(blocked on 97-15, 97-16)*

- [x] 97-17-PLAN.md — End-to-end typed text → saveWiki → wikiToHtml battery; validation map; SAFE-06 → Complete

### Phase 98: Editor Shell

**Goal**: Users can edit wiki text in a rich view or in source with every core construct available, shown in a dev-tools preview tab before any host adopts it
**Depends on**: Phase 97
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, SAFE-05, BLOCK-01, BLOCK-02, BLOCK-03, BLOCK-04, FLOW-04
**Research**: Needs phase research (TipTap v3 API via Context7, React Compiler smoke test)
**Success Criteria** (what must be TRUE):

  1. User edits in a rich view styled like WikiRenderer output, formats with the toolbar and keyboard shortcuts, and creates headings, mixed lists, quotes, rules and links
  2. User can insert and edit tables, code/noformat blocks, panels with titles and palette-validated coloured text
  3. User toggles between rich and raw source without losing content or undo history, and sees a side-by-side WikiRenderer preview in source mode
  4. A text that fails the round-trip check opens in source mode with a quiet notice, so rich editing can't corrupt it
  5. Typing never loses the caret or rebuilds the editor, wiki/markdown shortcuts and IME composition behave on macOS WKWebView (manual check), and app shortcuts are suppressed while typing

**Plans**: 16 plans
Plans:
**Wave 1**

- [x] 98-01-PLAN.md — Engine fixes: saveWiki schema identity, schema exports, table-cell {code} escape, WR-02, IN-01
- [x] 98-02-PLAN.md — WR-01 bare-URL escaping (Jira UAT checkpoint, then fix; closes folded todo)
- [x] 98-03-PLAN.md — Install @tiptap/react + extensions, shared prose classes, wikiEditorMode setting, bundle guard
- [x] 98-04-PLAN.md — FLOW-04 typing-target guards, Editor shortcut category, Keycap, ToolbarButton

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 98-05-PLAN.md — Headless editor core: extension list, keymap, wiki-first input rules, safe links

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 98-06-PLAN.md — Session logic (undo-safe toggle, forced source, failed-save text), SourceView, ModeToggle
- [x] 98-07-PLAN.md — Panel/code/raw node views, Jira languages, panel commands, richExtensions
- [x] 98-08-PLAN.md — Insert list, text styles, InsertMenu, TableGridPicker, TextStyleMenu
- [x] 98-09-PLAN.md — Palette colour, link and table commands; ColourPopover, LinkPopover, TableToolbar

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 98-10-PLAN.md — Toolbar composition: presets, one-row overflow, source-mode actions

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 98-11-PLAN.md — WikiEditor shell (value binding, modes, notices, shortcuts) and lazy wrapper

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 98-12-PLAN.md — Dev-tools Editor tab, React Compiler acceptance test, async chunk check

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 98-13-PLAN.md — Manual macOS WKWebView UAT (IME, caret, input rules, visual pass)

**Gap closure (UAT 98-13)** *(wave 1, parallel)*

- [x] 98-14-PLAN.md — Enter keeps blank-line gaps; empty list items are transient (no false save failure)
- [x] 98-15-PLAN.md — Mode toggle moves focus, hidden rich editor read-only, Cmd+Left/Right line boundary
- [x] 98-16-PLAN.md — Narrow Full toolbar: list/underline overflow, More and Rich|Source never clipped

**UI hint**: yes

### Phase 99: Mentions, Media & Smart Input

**Goal**: Users can mention people, embed attachments and images, paste rich content and use smart autocompletes inside the editor
**Depends on**: Phase 98
**Requirements**: INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05, INPUT-06, INPUT-07, BLOCK-05
**Research**: Needs phase research (rich HTML paste samples, Tauri drop path)
**Success Criteria** (what must be TRUE):

  1. User types @ and picks a person from server-side search, and the text saves as `[~username]`
  2. User embeds an existing attachment from the picker, and can paste or drop an image or file that uploads (or stages on create) and embeds
  3. Pasting rich HTML from a web page, Word or Jira keeps supported formatting and drops everything else
  4. User can open a `/` slash menu to insert any block, get issue-key autocomplete and decoration, and type `:` for Jira emoticons
  5. Compact comment hosts show a floating selection menu instead of a toolbar, and popovers inside dialogs close with Esc before the dialog does (manual WKWebView drag/drop and caret check)

**Plans**: 14 plans in 7 waves
Plans:
**Wave 1**

- [x] 99-01-PLAN.md — Package legitimacy gate + install, WikiEditorHost contract and host storage bridge
- [x] 99-02-PLAN.md — Pure paste layer: allowlist HTML normaliser (web/Word/Docs/Jira) and wiki-text heuristic

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 99-03-PLAN.md — Shared suggestion popover + factory, leak and Esc-in-Dialog tests
- [x] 99-04-PLAN.md — Mention/image/attachment/emoticon node views matching WikiRenderer
- [x] 99-05-PLAN.md — Upload engine: placeholder decorations, staged mode, naming, picker embed

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 99-06-PLAN.md — @ mention and : emoticon autocompletes, emoticon token input rule
- [x] 99-07-PLAN.md — Shared issue-key module, key decoration and KEY- autocomplete
- [x] 99-09-PLAN.md — D-10 removal notice and upload error line in the live editor
- [x] 99-10-PLAN.md — Smart paste plugin (HTML, HTML images, wiki text, Cmd+Shift+V) + shortcut rows

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 99-08-PLAN.md — / slash menu with Recent (settings v39)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 99-11-PLAN.md — Compact bubble menu + footer, attachment picker mount
- [x] 99-12-PLAN.md — Register input extensions, end-to-end tests, dev-tools host/paste/dialog harness

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 99-13-PLAN.md — Source-mode mentions, emoticons and file paste/drop

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 99-14-PLAN.md — Gate run and manual WKWebView UAT

**UI hint**: yes

### Phase 100: Host Adoption & Editing Workflow

**Goal**: Every wiki text box in the app uses the new editor and unsent text is never lost or silently discarded
**Depends on**: Phase 99
**Requirements**: HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, FLOW-01, FLOW-02, FLOW-03
**Success Criteria** (what must be TRUE):

  1. Create Epic, Create/Edit Issue description, comment composer and comment edit all use the new editor, adopted one host at a time (inline description editing on detail and peek is dropped by decision D-01; the description stays read-only there)
  2. An unsent comment or description edit survives closing the peek or modal and restarting the app
  3. User is warned before unsaved edits are discarded by an explicit Cancel or Esc in a comment edit or the Edit Issue modal; closing the peek, X/backdrop, navigation and quitting keep the text as a draft silently (Create Issue modal excepted)
  4. Cmd+Enter submits and Esc cancels in every editor host, deferring to open popovers
  5. The old textarea toolbar and Preview-tab code no longer exists in the codebase

**Plans**: 9 plans
Plans:
**Wave 1**

- [x] 100-01-PLAN.md — Docs descope (D-01) + editor host API (handle, placeholder, onSubmit/onCancel) + shortcut rows + test stub
- [x] 100-02-PLAN.md — Drafts store (drafts.json), useEditorDraft hook, D-21 account-change clearing
- [x] 100-03-PLAN.md — Discard changes dialog, draft note, useIssueEditorHost, staged-files strip + upload helper

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 100-04-PLAN.md — Host 1: Create Epic on WikiEditor with staging (D-20) and Cmd+Enter
- [x] 100-05-PLAN.md — Host 2: Create/Edit Issue description on WikiEditor + form Cmd+Enter
- [x] 100-06-PLAN.md — Host 3: comment edit on WikiEditor with drafts, discard guard, keys

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 100-07-PLAN.md — Edit Issue modal drafts, stale base, Cancel/Esc discard guard
- [x] 100-08-PLAN.md — Host 4: comment composer on WikiEditor with draft, send, Esc blur, Reply focus

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 100-09-PLAN.md — Delete textarea editing code and dead components + removal guard test

**UI hint**: yes

### Phase 101: Issue Drafts & Large Create/Edit Modal

**Goal**: Users create issues in a large two-column modal and never lose a half-written issue
**Depends on**: Phase 100
**Requirements**: UI-01, UI-02, DRAFT-01, DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06, DRAFT-07
**Success Criteria** (what must be TRUE):

  1. Create/Edit Issue opens as a large dialog with summary, editor, staged files and links in the main column (no subtasks, D-03), a fields sidebar and a sticky footer
  2. User can tick "Create another" and the modal stays open for the next issue with common fields kept
  3. Closing the modal with content saves a draft without a prompt, and several independent drafts can exist at once
  4. A header Drafts chip with a count, styled apart from pinned tabs, appears whenever drafts exist and lists them (type icon, summary or "Untitled", parent/epic, last edited, Resume/Discard)
  5. Resuming from anywhere restores every field and staged attachment, drafts survive an app restart, and a successful create or a discard removes the draft

**Plans**: 12 plans
Plans:
**Wave 1**

- [x] 101-01-PLAN.md — D-03 docs; labels/fix versions in form state (Create + Edit, no-clobber diff); HYDRATE/RESET_KEEP; create returns key
- [x] 101-02-PLAN.md — fs plugin (legitimacy checkpoint), scoped capability, issue-draft-files service, editor setLocalPreview
- [x] 101-03-PLAN.md — issue-drafts store, useIssueDraft autosave hook, create-modal store, shortRelativeTime

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 101-04-PLAN.md — (TDD) snapshot rules: content gate, kept fields, round-trip, stale validation
- [x] 101-05-PLAN.md — LabelsField + FixVersionField, shared version ordering + versions hook
- [x] 101-06-PLAN.md — AppLayout on create-modal store, global CreateEpicDialog, account-change purge
- [x] 101-07-PLAN.md — TopBar Drafts chip + popover (resume, discard with undo)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 101-08-PLAN.md — large two-column modal shell + sidebar, UI-SPEC copy, Edit labels tests

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 101-09-PLAN.md — Create autosave, keep-on-close, draft note, staged copies, Create another

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 101-10-PLAN.md — resume into Create with stale-field notes and restored files
- [x] 101-11-PLAN.md — Epic drafts in CreateEpicDialog

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 101-12-PLAN.md — full gate + manual restart / Edit round-trip / visual check

**UI hint**: yes

### Phase 102: Polished Surfaces

**Goal**: The remaining editing surfaces look and behave consistently with the new modal
**Depends on**: Phase 101
**Requirements**: UI-03, UI-05 (UI-04 dropped, Phase 100 D-01)
**Success Criteria** (what must be TRUE):

  1. Comment hosts have an expanding editor and a consistent, clean action row
  2. Create Epic, Bulk Create Subtasks and Edit Release modals are larger and visually consistent with the Create/Edit Issue modal, and Edit Release keeps its plain-text/Markdown fields

**Plans**: 10 plans
Plans:
**Wave 1**

- [x] 102-01-PLAN.md — Shared field surface on the wiki editor frame + extracted ModalShell (wave 1)
- [x] 102-02-PLAN.md — Shared CommentActionRow + comment edit adoption and height cap (wave 1)
- [x] 102-04-PLAN.md — Epic data layer: IssueType 'Epic', sidebar-aware epic drafts + sanitizer, payload builder (wave 1)
- [x] 102-05-PLAN.md — Shared priority-options hook, epic-name exclusion, ModalSidebar epic variant (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 102-03-PLAN.md — Collapsible comment composer (expand on focus/Reply) (wave 2)
- [x] 102-06-PLAN.md — Create epic on the two-column shell with Epic sidebar and drafts (wave 2)
- [x] 102-07-PLAN.md — Bulk create subtasks on the one-column shell (wave 2)
- [x] 102-08-PLAN.md — Edit release on the two-column shell with plain textareas and shared Switch (wave 2)
- [x] 102-09-PLAN.md — Issue modal adopts ModalShell + sentence-case CTAs (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 102-10-PLAN.md — Full-suite gate + visual sign-off checkpoint (wave 3)

**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 96. Wiki Foundations & Equivalence Harness | 6/6 | Complete    | 2026-11-16 |
| 97. Round-Trip Engine | 17/17 | Complete    | 2026-11-16 |
| 98. Editor Shell | 15/16 | In Progress|  |
| 99. Mentions, Media & Smart Input | 14/14 | Complete    | 2026-11-17 |
| 100. Host Adoption & Editing Workflow | 9/9 | Complete    | 2026-11-17 |
| 101. Issue Drafts & Large Create/Edit Modal | 12/12 | Complete    | 2026-11-18 |
| 102. Polished Surfaces | 10/10 | Complete   | 2026-11-18 |

### Shipped milestones

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.14 Release Management | 11 (87-95) | 80 | 2026-11-16 |
| v1.13 Personal Workspace | 6 (81-86) | 23 | 2026-06-16 |
| v1.12 Jira Experience Improvements | 5 (76-80) | 19 | 2026-06-07 |
| v1.11 GreenHopper API Migration | 5 (71-75) | 22 | 2026-06-01 |
| v1.10 Cleanup, Roles Removal & Standup Notes | 6 (65-70) | 15 | 2026-05-25 |
| v1.9 Tempo, Dashboard Redesign & Cleanup | 6 (59-64) | 20 | 2026-05-23 |
| v1.8 AIO Test Management | 9 (50-58) | 45 | 2026-05-19 |
| v1.7 Performance & Perceived Speed | 9 (42-49) | 23 | 2026-04-05 |
| v1.6.3 Release & Auto-Update Pipeline | 4 (38-41) | 10 | 2026-03-29 |
| v1.5 Dashboard Redesign & Feature Parity | 7 (31-37) | 25 | 2026-03-24 |
| v1.4 Internal Quality & Performance | 6 (25-30) | 21 | 2026-03-20 |
| v1.3 UX & Branding | 7 (18-24) | 27 | 2026-03-19 |
| v1.2 Jira Parity | 9 (9-17) | 29 | 2026-03-15 |
| v1.1 Polish | 4 (5-8) | 24 | 2026-03-13 |
| v1.0 MVP | 4 (1-4) | 20 | 2026-03-12 |
