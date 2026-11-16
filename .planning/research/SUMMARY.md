# Research Summary: v1.15 Rich Wiki Editor

**Synthesized:** 2026-11-16 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** MEDIUM

## Executive Summary

v1.15 replaces textarea wiki editing in every host with one shared `<WikiEditor>`, a rich (WYSIWYG) view plus a plain-textarea source view. Jira wiki markup stays the only stored format. The contract is **semantic equivalence**: saved text must render the same through WikiRenderer as the original. A no-edit open and close must leave the stored string byte-identical.

All four research files agree that the fixture corpus and round-trip safety are the real work, not the library. The engine is **TipTap v3 (ProseMirror, MIT, 3.34.x)**.

The revert reason for the 2026-05-31 TipTap build is unrecorded. Its artefacts point to these likely causes:
- a lossy load path (jira2md → markdown → `marked` HTML → `generateJSON`) whose markdown parser differed from the renderer's remark/rehype;
- invented task lists (`(/)`/`(x)` → checkboxes), which corrupted real emoticons;
- extensions rebuilt on every render, and the editor destroyed on `disabled` changes;
- a hand-rolled mention popup that leaked DOM;
- source mode that ignored external value changes;
- four hosts swapped at once with no corpus, and live verification left at `human_needed`.

## Resolved Tension: where the editor document comes from

**Recommendation: a source-level tokenizer for load, a canonical emitter for save, and the extracted WikiRenderer pipeline used only as the equivalence oracle.**

- **Load:** a bespoke block and inline tokenizer, wiki → ProseMirror JSON. No `@tiptap/html` and no `generateJSON`. Loading through the renderer pipeline (ARCHITECTURE's option) would read *preprocessed* text, where `(/)` has already become an emoji and entities are decoded. The emitter could then write the rewritten form back. WikiRenderer would show the same thing and CI would pass, but real Jira would render it differently. Only a source-level parser keeps the source's own spellings.
- **Save:** a canonical-subset emitter, TipTap JSON → wiki. A table-driven escaping module, with CRLF and trailing whitespace preserved.
- **Oracle:** extract `preprocessJiraMarkup`, `wikiToMarkdown` and the shared plugin list into `lib/wiki/`. Behaviour must not change, and `WikiRenderer.test.tsx` stays untouched through re-exports. Presentation-only plugins such as `rehypeIssueKeys` stay out of the core list.
- **Guard:** `isEquivalent(wikiToHtml(orig), wikiToHtml(emit(parse(orig))))` runs in CI over the corpus and again at runtime when entering rich mode. On failure the editor opens in source mode with a quiet notice.
- **Safety extras:**
  - keep source slices per top-level block and re-emit only edited blocks;
  - unknown macros and unparseable spans become block or inline `rawWiki` atoms, rendered read-only through `<WikiRenderer>` in a NodeView and emitted verbatim;
  - a construct counts as "modeled" only once the corpus proves it, and anything flaky is demoted to raw.
- **Library spike:** a time-boxed (~1 day) gate in the first phase, comparing TipTap with a CodeMirror 6 live-preview on about 10 hard fixtures plus a WKWebView caret and IME smoke test. TipTap is the default. Lexical (0.x), BlockNote (MPL plus GPL XL packages), Milkdown (markdown-centric), Plate/Slate (heavy, 0.x) and a custom contentEditable build were rejected.

## Stack Additions

- `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-table` (+row/cell/header), `@tiptap/extension-mention`, `@tiptap/suggestion`, `@tiptap/extension-image`, all pinned to the same minor.
- Source mode is a plain auto-sized textarea. No CodeMirror (there is no Jira grammar for it), so a side-by-side WikiRenderer preview is optional.
- **Do NOT add:** `@tiptap/html`, `@tiptap/markdown`, task-list extensions, Pro/collab extensions, any `@atlaskit/*` (the wikimarkup transformer targets Cloud ADF; use it only as a grammar reference), or a second renderer.
- React Compiler / TipTap lifecycle (open issues #8400, #8661, #8516):
  - create the extensions array once, at module level or in a ref;
  - no `setContent` in effects, and use a `lastEmittedRef` echo guard;
  - prefer plain-DOM node views where possible;
  - lazy-load the editor chunk with an equal-height skeleton.

## Feature Landscape

**Table stakes:**
- a compact fixed toolbar and markdown/wiki input rules, suppressed during IME composition;
- keyboard shortcuts through the existing registry;
- core marks, headings, lists including mixed `*#` nesting, links (paste a URL onto a selection), quote, code blocks, monospace;
- tables, panels (`{panel}`, `{info}`, `{note}`, `{warning}`, `{tip}`), `{color}`, `{noformat}`;
- @mentions using an editor-anchored suggestion popover over `MentionPopover` search, server-side;
- attachment embeds, plus image paste and drop through the Tauri drop path;
- the source toggle, undo and redo;
- Cmd+Enter to submit and Esc to cancel, with a dirty guard;
- local drafts in a store that survives `queryClient.clear()`.

**Differentiators:**
- a `/` slash menu;
- issue-key autocomplete and decoration;
- `:` Jira emoticon autocomplete;
- a bubble menu only in compact hosts;
- source↔rich cursor mapping (v1 preserves the block and the scroll position instead);
- an optional side-by-side preview in source mode.

**Anti-features:**
- markdown or ADF as the stored format;
- Enter-to-send;
- a unicode emoji picker;
- task lists and checkboxes;
- Notion-style blocks;
- collaboration;
- Monaco;
- a toolbar and a bubble menu in the same host;
- bespoke editors per surface;
- autosaving to Jira.

## Host Format Audit (verified against code 2026-11-16)

| Host | Format | Editor |
|---|---|---|
| Create/Edit Issue description | Jira wiki | WikiEditor + large two-column modal |
| Inline description (detail + peek) | Jira wiki | WikiEditor |
| CommentComposer / InlineComment / comment edit | Jira wiki | WikiEditor (comment preset) |
| Create Epic description | Jira wiki | WikiEditor |
| Bulk Create Subtasks | no description field (template rows only) | layout/visual polish only |
| Edit Release: Jira version description | plain text | polish only, no wiki editor |
| Edit Release: GitLab milestone description | GitLab Markdown | polish only, no wiki editor |

Mentions are emitted today as `[~username]` (CommentComposer). Preserve the stored form through a node attribute, and don't invent `[~accountid:]`.

## Suggested Phase Structure (numbering continues after Phase 95)

1. **Foundations:**
   - extract `lib/wiki/` with no behaviour change;
   - a placeholder-only fixture corpus and the equivalence harness;
   - the library spike gate.
2. **Parser and canonical emitter: core constructs and raw atoms.**
   - Pure functions, tested in node.
   - Covers the escaping module, CRLF, emoticons and mentions.
3. **Hard constructs:**
   - tables (header-less, with a block-in-cell fallback);
   - the panel family;
   - `{color}` with a CSS-injection guard;
   - mixed nesting.
   - Demote anything flaky to raw.
4. **Editor shell:**
   - `WikiEditor`, SourceView, the toolbar, input rules and shortcuts;
   - the toggle with its runtime guard, the echo guard, autosize and shared prose styles;
   - a lazy chunk;
   - a dev-tools preview tab before any host adopts it.
5. **Mentions, attachments and paste:**
   - the suggestion adapter in a portal with Esc handled inside the dialog;
   - attachment and image nodes, the `insertWiki` handle and the Tauri drop path;
   - allowlisted HTML paste, issue-key decoration, the slash menu and emoticon autocomplete.
6. **Host adoption, one at a time:**
   - order: Create Epic, then Create/Edit description, then inline description, then the comment composer, then InlineComment and comment edit;
   - adds drafts, dirty guards, Cmd+Enter and Esc;
   - deletes the dead textarea code.
7. **Polished surfaces:**
   - the large two-column Create/Edit Issue modal: summary, editor, subtasks and links in the main column, a fields sidebar and a sticky footer with "Create another";
   - consistent restyling of Create Epic, Bulk Create Subtasks, Edit Release and the comment and inline hosts;
   - screenshot the layout before building it.

## Watch Out For

- **Silent corruption of production Jira text:** prevented by the corpus, the no-op byte-preserving save, raw atoms and the runtime guard.
- **WKWebView IME, caret and drag-drop behaviour:** jsdom can't test these, so every editor phase gets a manual macOS UAT checklist plus a WebView2 spot check.
- **React Compiler:** it isn't run in vitest, so stale module reads only show up in the app. Do a smoke test in the real build.
- **Portals:** overlays inside `isolate` `<main>` need them, and mention popovers inside modal focus traps need Esc ordering.
- **Shortcut suppression:** it covers only `input`/`textarea` today, so it must learn `contenteditable`.
- **Customer data:** none in fixtures. Author placeholder-only samples.

## Research Flags

- **Needs phase research:**
  - Foundations: plugin order, live Jira grammar checks, mention format.
  - Hard constructs: table and nested-list modelling.
  - Editor shell: the TipTap v3 API via Context7, and a React Compiler smoke test.
  - Mentions/paste: rich HTML paste samples and the Tauri drop path.
- **Standard patterns:** parser/emitter (once the corpus exists), host adoption, polished surfaces.

## Open Questions

- The revert reason for the 2026-05-31 build: the user doesn't remember, so treat the inferred causes above as the risks to design against.
- Source mode: a plain textarea, or with a side-by-side preview? Default to a plain textarea with a preview toggle.
