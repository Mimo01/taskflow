# Phase 98: Editor Shell - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase builds one shared, lazily loaded `<WikiEditor>`. It has two views:

- a rich (TipTap v3) view, styled like WikiRenderer output;
- a raw Jira-wiki source view: a plain textarea with a side-by-side WikiRenderer preview.

The rich view covers the core constructs: marks, headings, mixed lists, quotes, rules, line breaks, links, tables, `{code}`/`{noformat}`, the panel family with titles, and palette-validated `{color}`. It also covers the toolbar, keyboard shortcuts, and wiki/markdown input rules with IME respected. Undo works across mode toggles.

The editor is wired to the Phase 97 engine (`loadWiki`/`saveWiki`). A text that fails the round-trip check opens in source mode with a quiet notice (SAFE-05). App shortcuts are suppressed while typing in contenteditable (FLOW-04).

Everything is shown only in a new **dev-tools "Editor" tab**. No production host adopts the editor in this phase.

Requirements: EDIT-01..09, SAFE-05, BLOCK-01..04, FLOW-04.

Not in this phase:
- the `/` slash menu (BLOCK-05), mentions popover, attachment/image nodes, paste and drop (Phase 99);
- host adoption, drafts, dirty guards, Cmd+Enter/Esc (FLOW-01..03, Phase 100);
- the large Create/Edit modal and polished surfaces (Phases 101–102);
- source↔rich caret-offset mapping (EDIT-F1, future);
- per-block source-slice re-emit (SAFE-F1, future).

</domain>

<decisions>
## Implementation Decisions

### Toolbar & insert controls
- **D-01:** The toolbar is **sticky at the top, inside a single bordered editor frame**. Content scrolls under it once it passes the max height. Rich and source modes share the same frame. Watch the sr-only/`relative` scroller gotcha.
- **D-02:** At narrow widths the toolbar **stays on one row**, and lower-priority buttons move into a `⋯` overflow menu. Use container queries, as the PageHeader primitive does. The mode toggle (D-09) never moves into the overflow.
- **D-03:** **Two presets now, set by a prop:**
  - `full`, for descriptions;
  - `compact`, for comments: marks, lists, link, insert and source toggle.

  Both can be exercised in the dev-tools tab, so Phase 100 only has to choose one.
- **D-04:** Toolbar tooltips show the **label plus keycaps** (e.g. "Bold ⌘B"), using the app's tooltip and keycap style.

### Source mode & toggle
- **D-05:** The source-mode preview is **on by default and can be hidden** with a toolbar control. The textarea is on the left and a live WikiRenderer preview on the right. It stacks or auto-hides at narrow widths.
- **D-06:** The rich/source choice is **remembered per user, globally** (settings store). If the user prefers source, every editor opens in source. A text that fails the round-trip check still forces source for that text only. It does not change the saved preference.
- **D-07:** **SAFE-05 notice:** one quiet, muted line under the toolbar, e.g. "This text uses formatting the rich editor can't keep safely, so it opens in source." The rich side of the toggle is disabled for that text, with a tooltip. There is no "try rich anyway".
- **D-08:** **When `saveWiki` returns `failed`:** keep the rich doc, never write, and show an inline error that names the problem (the engine's `reason`). Offer a "Fix in source" action that switches to source mode. Research/planning decides what text source mode shows here. The edit could not be emitted safely, so it might be the last safe emit or the original plus a note. Never silently drop the user's edit.

### Block editing
- All block-editing choices were left to Claude (see Claude's Discretion).

### Raw blocks & dev-tools tab
- **D-10:** The dev-tools **"Editor" tab** (in `routes/dev-tools`, gated by `devToolsEnabled`) includes:
  - a **fixture picker** for the Phase 96/97 corpus (placeholder-only) plus a blank doc;
  - a live panel showing the **`saveWiki` output and its kind** (unchanged/saved/failed), and the **`loadWiki` kind** with the demoted block indexes;
  - a **preset switcher** (full/compact) and a **width switcher** (narrow/wide) for testing the overflow toolbar;
  - a **paste-your-own-wiki** textarea that loads arbitrary text, local only, never saved anywhere.

  Claude may add further dev aids. Show rendered previews where possible, not raw JSON dumps (an existing dev-tools preference).

### Claude's Discretion
The user delegated these. Recommended defaults are listed. Planning may refine them, but should not change the intent without a reason.
- **Headings/quote picker:** default to a "Normal text ▾" text-style dropdown (Paragraph, H1–H6, Quote), like Jira and Confluence.
- **Block insertion before the slash menu:** default to a single "+ Insert" dropdown (table, code, noformat, panel/info/note/warning/tip, rule). Its item list should be a data structure that Phase 99's slash menu can reuse.
- **D-09 (toggle):** default to a right-aligned segmented "Rich | Source" control at the end of the toolbar, with the shortcut ⌘⇧M registered in `src/lib/shortcuts.ts` so it appears in the shortcuts panel. A single icon toggle is also acceptable if it fits the compact preset better.
- **Undo across toggles (EDIT-08):** default to keeping the rich history. When switching back from source, the whole source session becomes one undoable step (a single transaction). The textarea keeps its native undo while in source mode. Don't build fine-grained cross-mode history.
- **Tables:**
  - **Editing:** default to a floating table toolbar while the caret is in a table. It offers add row above/below, add column left/right, delete row/column, toggle header row/column and delete table. Tab and Shift+Tab move between cells, and Tab in the last cell adds a row. Hover handles were judged fiddly in WKWebView.
  - **Insert:** a grid-size picker (up to about 6×6) with a header row on by default. The header-less attribute from Phase 97 D-02 must still round-trip.
- **Panels:** default to rendering like the WikiRenderer panel, with:
  - the title as an editable line in the panel header;
  - a small corner control to switch type (panel/info/note/warning/tip) or remove the panel;
  - an editable body.
- **Code blocks:** default to a SearchableSelect of Jira's supported languages, plus "none", in the block header. `{noformat}` has no language.
- **Colour:** default to a swatch popover with Jira's standard text palette, plus "remove colour". Validate it through the Phase 97 `{color}` CSS-injection guard. Existing off-palette colours are kept and shown as-is, never rewritten.
- **Raw atoms in the rich view:**
  - **Look:** default to rendering them read-only through WikiRenderer, with a faint dashed frame and a small "Edit in source" affordance on hover. Inline raw atoms show as a quiet chip. Both can be selected and deleted as a unit.
  - **Notice:** for a `rich-demoted` load, the frames alone are enough by default, with no banner. A quiet one-line note in the D-07 style is acceptable if UAT shows the frames aren't noticed.
- **Remaining choices:** link editing UI (popover vs inline), empty placeholder text, and min/max height and autosize values. Follow existing app patterns (Popover, PersonPicker-style popovers, the compact density rules).

### Folded Todos
- **`wiki-roundtrip-phase97-followups.md`** (priority high, `resolves_phase: 98`). Close these before the editor ships, since Phase 98 is the first time users can type into the engine:
  - **WR-01:** escaped bare URLs render broken (`http://a.com/\_a\_` turns into an entity-mangled href). Either restore the entities inside autolinks in the renderer, or stop the emitter escaping inside bare URLs. Check the 97-HUMAN-UAT test 1 result first: if Jira keeps the backslashes, don't escape there.
  - **Table-cell `{code}`/`{noformat}`:** `parseCell` treats any cell containing `{code`/`{noformat` as a raw table, even when it's escaped, so `saveWiki` fails closed. Make `parseCell` escape-aware, and check how the renderer treats `\{code}` in a cell.
  - **WR-02:** the cell-panel regex in `editor/parse/tables.ts` skips an opener after any backslash run. preprocess.ts treats an even-length run as a real opener. Align the two.
  - **IN-01:** the lookbehind regexes need Safari 16.4+ in WKWebView. Confirm the minimum macOS target, or rewrite them without lookbehind.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Engine contract (Phase 97 output this phase consumes)
- `taskflow/src/lib/wiki/editor/types.ts`: the `WikiLoad` kinds (rich / rich-demoted / failed) and the `WikiSave` kinds (unchanged / saved / failed). These are the SAFE-05 and D-08 triggers.
- `taskflow/src/lib/wiki/editor/index.ts`: `loadWiki`, `saveWiki`, `parseWiki`, `emitWiki`, `wikiSchema`, `wikiExtensions`.
- `taskflow/src/lib/wiki/editor/schema.ts`: the node and mark schema that node views and the toolbar attach to.
- `taskflow/src/lib/wiki/editor/bundle-guard.test.ts`: TipTap and ProseMirror must stay out of WikiRenderer's import graph and the main bundle. The editor chunk must be lazy.
- `.planning/phases/97-round-trip-engine/97-CONTEXT.md`: D-04 (no-op returns the original), D-05 (spellings kept as attributes), D-08 (canonical forms for new nodes), D-10 (smallest raw span), D-11 (fallback ladder).
- `.planning/phases/97-round-trip-engine/97-HUMAN-UAT.md`: test 1 settles the WR-01 approach.
- `.planning/todos/pending/wiki-roundtrip-phase97-followups.md`: the folded todo.

### Phase 96 findings
- `.planning/phases/96-wiki-foundations-equivalence-harness/96-SPIKE-FINDINGS.md`: TipTap API notes, plus the WKWebView caret and IME smoke-test results.

### Milestone research
- `.planning/research/SUMMARY.md`: the React Compiler/TipTap lifecycle rules (extensions created once, no `setContent` in effects, a `lastEmittedRef` echo guard, plain-DOM node views where possible, lazy chunk with an equal-height skeleton).
- `.planning/research/FEATURES.md`: the toolbar table stakes, the shortcut list (L27), table UX (L33, L65), the Source Toggle UX section (L96–L103), per-host presets (L74) and anti-features.
- `.planning/research/PITFALLS.md`: why the 2026-05-31 build was reverted. The editor was rebuilt on every render and destroyed on `disabled`, source mode ignored external value changes, and the mention popup leaked DOM.
- `.planning/research/STACK.md`: the package list. Do NOT add `@tiptap/html`, `@tiptap/markdown`, task-list or Pro extensions.
- `.planning/research/ARCHITECTURE.md`: the raw-atom tiers and NodeView rendering through WikiRenderer.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md`: EDIT-01..09, SAFE-05, BLOCK-01..04, FLOW-04, EDIT-F1 (deferred), and the out-of-scope table.
- `.planning/ROADMAP.md` §Phase 98: success criteria 1–5. Criterion 5 requires a manual macOS WKWebView check for IME and caret.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/wiki/editor/*`: the complete engine (Phase 97). TipTap `@tiptap/core`, `pm`, `starter-kit` and `extension-table` are already installed at `^3.34.0`. `@tiptap/react` must be added at the same minor.
- `src/routes/dashboard/WikiRenderer.tsx`: the source-mode preview and the raw-atom NodeView rendering. Its prose styles must be shared with the rich view (EDIT-01).
- `src/routes/dashboard/DescriptionEditor.tsx` and `CommentComposer.tsx`: today's textarea toolbars. They supply the icon-button style, and `insertAtCursor` sets the canonical forms for new nodes. The hosts are not replaced in this phase.
- UI primitives in `src/components/ui/`: `searchable-select.tsx` (code language), `popover.tsx` (colour, link, insert menus), `tooltip.tsx`/`tooltip-body.tsx` (keycap tooltips), `page-header.tsx` (container-query collapse pattern), `empty-state.tsx`.
- `src/lib/shortcuts.ts`: the shortcut registry that feeds the ⌘/ panel. Add the editor shortcuts here.
- `src/routes/dev-tools/DevToolsPage.tsx`: tab list (Logs/Operations/Waterfall/Notifications). Add an "Editor" tab. `devToolsEnabled` is in `settings.store.ts`.
- `src/stores/settings.store.ts`: where the per-user rich/source preference (D-06) goes, with a migration default of rich.

### Established Patterns
- React Compiler runs in the app but not in vitest. Create the extensions and schema once at module scope, and do a smoke test in the real build. Module-level mutable reads go stale only in the app.
- App shortcuts use react-hotkeys-hook (`enableOnFormTags` default false, `src/main.tsx:253`). Raw `keydown` listeners in `main.tsx`, `useImageViewer.ts`, `usePreviewEscape.ts`, `AioTestRunDetailPage.tsx` and `AttachmentPreviewModal.tsx` need a contenteditable guard too (FLOW-04). Check each one's tag checks.
- Overlays inside the `isolate` `<main>` must portal to body (table toolbar, colour/link/insert popovers).
- Visual changes: screenshot or render before restyling, and get the rendered DOM before iterating on CSS for spacing bugs.
- The pre-commit hook runs the full vitest suite, so RED and GREEN go in one commit. Fixtures are placeholder-only (no customer data).

### Integration Points
- The `<WikiEditor>` props contract is consumed by Phase 99 (mentions, media, `insertWiki` handle) and Phase 100 (hosts, drafts, Cmd+Enter/Esc). Keep `value`/`onChange` on the wiki string, and keep the original string until the first user transaction (no-op contract).
- The insert-menu item list is reused by the Phase 99 slash menu.

</code_context>

<specifics>
## Specific Ideas

- Same frame in both modes. The toolbar stays put, the toggle is always visible, and the content area switches.
- The SAFE-05 notice stays quiet: a muted line, not a banner or toast.
- The dev-tools tab is the UAT surface for this phase. It should make the engine's verdicts visible, not just host the editor.

</specifics>

<deferred>
## Deferred Ideas

- None new. The discussion stayed within the phase. The slash menu, mentions, media (Phase 99), and host adoption and drafts (Phase 100) remain where the roadmap puts them.

### Reviewed Todos (not folded)
- `notifications-highlight-you-mention.md`, `notifications-due-date-overdue.md` and `priority-stripe-rest-rank.md` matched only on generic keywords. They are unrelated to the editor shell and stay in the backlog.

</deferred>

---

*Phase: 98-editor-shell*
*Context gathered: 2026-11-17*
