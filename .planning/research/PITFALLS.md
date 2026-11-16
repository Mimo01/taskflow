# Domain Pitfalls

**Domain:** WYSIWYG + source-toggle editor over Jira DC wiki markup, added to Taskflow (Tauri 2, WKWebView / WebView2 / WebKitGTK, React 19 + React Compiler)
**Milestone:** v1.15 Rich Wiki Editor
**Researched:** 2026-11-16
**Overall confidence:** MEDIUM. Prior-art findings come from the repo (HIGH). Jira-syntax and WebKit behaviours come from project memory plus general knowledge and need verifying against the live instance in the phase that touches them.

## What the 2026-05-31 TipTap attempt tells us (prior art)

The tag `backup/wiki-editor-before-revert-260531` holds 3 commit groups: `260531-saz` (build), `260531-ucj` (source-view sizing), and a few UX fixes (padding, click-to-focus). No commit message, SUMMARY or VERIFICATION records why it was reverted, and the revert commit itself is not on main. The user verification report ended `human_needed`: 5 live-app checks were never confirmed in the SUMMARY. The code review (`260531-saz-REVIEW.md`) found 4 critical and 5 warning issues. The causes below are inferred from the artefacts, not recorded.

| Likely cause (inferred) | Evidence on the tag | Lesson for v1.15 |
|---|---|---|
| **Two parsers.** Load path was `preprocessJiraMarkup` → `jira2md` → markdown → `md_to_html` → `generateJSON`. Save path was a bespoke ProseMirror→wiki serializer. The load path was lossy and the save path guessed. | `jiraToTiptap.ts`, `jiraWikiSerializer.ts`, 27-case matrix | Round-trip fidelity can't be tested with a handful of cases. Needs a corpus (see Pitfall 1). |
| **Task lists invented as `(/)`/`(x)`.** Jira has no checkbox syntax, so the editor re-mapped emoticons to checkboxes (CR-04). Real emoticons got corrupted into task items. | review CR-04, RESEARCH Pitfall 1, assumption A3 flagged "confirm UX" | Don't add constructs Jira doesn't have. Drop task lists. |
| **Extensions rebuilt every render** (`buildExtensions()` outside `useMemo`) and `useEditor(..., [disabled])` destroyed the editor when saving. Lost focus, selection, and typed text. | CR-02, WR-05 | Editor lifecycle and React Compiler need care (Pitfall 9). |
| **Hand-rolled mention popup on `document.body`** leaked DOM and threw on `removeChild`. Also conflicts with modal focus traps. | CR-03, WR-03 | Use the project's `PersonPicker` / Base UI Popover plumbing, not a bespoke popup. |
| **Source/WYSIWYG state sync** with dirty refs. External `value` changes were ignored in Source mode. | WR-04, `D-source-authority` | Make one canonical state (the wiki string) and derive everything else. |
| **Scope: no fixtures, 4 surfaces swapped at once**, then 1701 tests green but live behaviour unverified. | Task 6 swapped all call sites; VERIFICATION `human_needed` | Gate on the corpus plus a live-instance check before swapping hosts. |

Not found: any evidence that bundle size, WebKit IME, or performance was the cause. Treat those as untested risks, not as known causes.

---

## Critical Pitfalls

### Pitfall 1: Editor-model round trip drifts from what WikiRenderer shows
**What goes wrong:** Load → edit → save changes how WikiRenderer renders the text, even when the user changed nothing. WikiRenderer has ~50 targeted fixes (underscores in links, `+` underline corruption, strikethrough dashes near bold, issue-key linkify, `{{{}TEXT{}}}`, entity decoding in code, `[^file]` chips). Any second parser re-introduces each of those bugs.
**Why it happens:** The prior attempt used `jira2md` → markdown → HTML for loading, which is the pipeline WikiRenderer had to patch in many places. A different serializer then guessed at the inverse.
**Consequences:** Silent corruption of Jira issues in a shared production Jira. Hard to notice because the editor view looks fine.
**Prevention:**
- The contract is "rendered output equal", not "string equal". Build a **corpus harness first**: for each fixture, assert `render(load→save(x))` has the same DOM as `render(x)`. Use neutral placeholder fixtures (no customer data) and start from the existing ~2700 LOC of WikiRenderer tests as seed input.
- Mine constructs from existing WikiRenderer test inputs and the debug knowledge base (`.planning/debug/`) so each past renderer bug becomes a fixture.
- **Untouched content must be saved byte-for-byte.** Keep the original string; only re-serialize when the doc actually changed (compare doc JSON, not a dirty flag set by focus or toggle). Better: preserve source per block and only re-serialize edited blocks.
- Prefer a **block-level model with a verbatim fallback**: anything the editor can't model confidently becomes an opaque raw block/inline atom holding the original text.
- Do not reuse the `jira2md` → markdown path to feed the editor. Parse Jira wiki directly into the editor model with one purpose-built parser, and write the serializer as that parser's inverse, tested against each other (`parse(serialize(parse(x))) == parse(x)`).
**Detection:** Corpus diffs; no-op open+save changes the string; the Changes tab shows description diffs for issues nobody edited.
**Phase:** Phase 1 (corpus + parser/serializer + passthrough), before any UI.

### Pitfall 2: Inventing syntax Jira doesn't have
**What goes wrong:** Checkboxes, strikethrough variants, underline via `+text+`, nested-block-in-list, or `==` headings that real Jira renders differently or not at all. The prior attempt mapped checkboxes to `(/)`/`(x)`, which corrupted real emoticons (CR-04).
**Prevention:** Only offer toolbar actions with a native Jira DC wiki form: bold `*`, italic `_`, strike `-`, underline `+`, sup `^`, sub `~`, mono `{{}}`, headings `h1.`-`h6.`, `bq.`/`{quote}`, lists, `{code}`, `{noformat}`, `{panel}`, `{color}`, tables, links, images, `----`. No task lists. Emoticons stay literal text or atoms.
**Detection:** A toolbar button with no row in the corpus.
**Phase:** Phase 1 (scope list) and Phase 3 (toolbar).

### Pitfall 3: Lossy constructs: tables, nested lists, panels, macros
**What goes wrong:** Real descriptions contain things a naive editor model cannot hold.
- Tables with merged/odd cells, `||` header cells in the body, cell content with lists, inline `{code}` or multi-line content inside a cell, `|` inside links or macros within cells.
- Nested lists mixing `*` and `#` (`*#`, `#*`), list items followed by `{code}` (the existing "drop empty list bullet before `{code}`" fix), blank-line-separated list items, list items with continued paragraphs.
- Panels: titles containing `|` or `}` (review WR-02), `{panel:title=…|borderStyle=…|bgColor=…}`, nested macros, `{expand}`, `{noformat}`, `{code:java|title=x}`, `{anchor}`, `{toc}`, `{jira:…}`, `{chart}`.
- `{color:#hex}` including multi-paragraph spans and nested with bold; CSS-injection via unvalidated colour (review CR-01).
- Emoticons `(/) (x) (!) (i) (?) :) ;)` vs literal parentheses or checkbox ideas; links `[text|url]`, `[text|url|tip]`, `[#anchor]`, `[^file]`, `!image.png|width=..!`, `[~user]` vs `[~accountid:…]` (DC uses usernames; keep whatever the source had).
**Prevention:** Whitelist what the editor models faithfully. For everything else use a verbatim passthrough atom that shows a labelled chip with an "edit as source" affordance. Each unsupported shape needs a fixture proving the original bytes survive. Escape on write only where the text would otherwise be read as markup, and only for chars the user typed (not for source text carried through verbatim).
**Detection:** Fixture where a table cell has a list, a panel title with `}`/`|`, or `*#` nesting fails render-equality.
**Phase:** Phase 1 (modelling decisions), Phase 4 (tables and panels UI).

### Pitfall 4: Escaping and the Jira character minefield
**What goes wrong:** Typed `*`, `_`, `-`, `+`, `^`, `~`, `{`, `}`, `[`, `]`, `|`, `\\`, `!` become markup after save. Over-escaping instead puts visible backslashes in Jira's own UI (Jira DC does support `\*` escaping, but backslash-before-letter shows the backslash). Intra-word underscore and `snake_case_words` are a repeat renderer bug (see 724452e5, 8e5d96c4). `\\` is a line break, so a Windows path like `C:\\temp` changes meaning. `{{ ` followed by a plain space is literal; real teletype content is `{{{}TEXT{}}}` and entities must be decoded inside inline code only (45a3c446).
**Prevention:** Implement escaping in one module with a table-driven test per character in each context (text, link label, table cell, code, mono, panel title). Reuse the exact rules from WikiRenderer's monospace/underscore handling rather than re-deriving. Never escape inside `{code}`, `{noformat}`, `{{mono}}`. Add a fuzz-ish test: random printable strings typed into the editor, serialized, rendered, compared as text with the typed string.
**Phase:** Phase 1.

### Pitfall 5: Line breaks, blank lines, CRLF, trailing whitespace
**What goes wrong:** Jira treats a single newline inside a paragraph as a soft break rendered as `<br>` only in some contexts; blank-line paragraph semantics differ from Markdown; `\\` forces a break. Jira API often returns `\r\n`. A doc model that normalises to `\n` or trims trailing whitespace rewrites every untouched description and makes the Changes tab show a diff.
**Prevention:** Detect the dominant line ending on load and write it back; preserve it on save. Never trim trailing whitespace of untouched blocks. Model paragraph breaks exactly like WikiRenderer (the renderer defines the truth: remark-breaks makes single newlines `<br>`). Test: CRLF fixture, trailing-space fixture, leading blank lines, three consecutive blank lines.
**Phase:** Phase 1.

### Pitfall 6: Controlled-value editing, cursor jumps, undo
**What goes wrong:** Passing `value` back into the editor on each change resets the selection (cursor jumps to the end) and wipes the undo stack. External refetches (query invalidation, optimistic rollback) overwrite what the user is typing. Source→rendered toggle replaces the doc and kills undo.
**Prevention:**
- The editor is **uncontrolled while focused**: seed once (and on explicit "reset"), push changes out via `onChange`, and ignore incoming `value` while the user has a dirty draft. Surface a "changed on server" banner instead of silently overwriting (also fixes draft loss).
- Keep one canonical state. Source mode is a plain textarea or CodeMirror over the same string; toggling re-parses once.
- Test with `rerender` and a changing prop mid-edit (project lesson: static-prop tests hide this class of bug).
**Detection:** Typing in the editor while a background poll refreshes the issue.
**Phase:** Phase 2 (editor core).

### Pitfall 7: Losing unsaved drafts
**What goes wrong:** Closing a modal, switching peek to another issue, navigating a pinned tab, a credential save (`queryClient.clear()`), or a failed save wipes the text a user spent minutes writing. The prior attempt destroyed the editor on `disabled` flips (WR-05).
**Prevention:** Persist drafts keyed by (issue key, field, comment id) in memory or localStorage with debounced writes; restore on mount; clear on successful save. Confirm-on-close when dirty. Never unmount the editor while a save is pending. On save failure keep the content and show the error inline.
**Phase:** Phase 5 (host adoption), design in Phase 2.

### Pitfall 8: IME and composition in WebKit
**What goes wrong:** WKWebView and WebKitGTK composition events differ from Chromium. Dead-key accents on macOS, CJK input, and the macOS emoji picker produce duplicated or dropped characters when the editor transforms text during composition (input rules, auto-formatting like typing `*bold*`, mention triggers, onChange serialization on every keystroke).
**Prevention:** Don't serialize or run input rules while `isComposing`; commit on `compositionend`. Test manually on macOS with Czech/Slovak dead keys (users are in that locale, caron and acute are common) and the emoji picker, plus a Windows WebView2 spot check. Don't rely on jsdom for any of this.
**Detection:** Doubled diacritics, lost characters after accent input.
**Phase:** Phase 2, manual UAT checklist.

### Pitfall 9: React Compiler and editor lifecycle
**What goes wrong:** The app is compiled with React Compiler, vitest is not. Hidden module-level reads and instance objects created in render (editor extensions, schema, `new Editor()`) go stale or get recreated only in the app. The prior attempt rebuilt extensions each render (CR-02).
**Prevention:** Create schema/extensions/parsers at module scope or in a stable ref; keep editor-instance creation in one hook with explicit deps. Add a test or build step that runs the compiler over the editor files (project lesson: compile and read `$[n]` guards). Don't read mutable module state in render.
**Phase:** Phase 2.

### Pitfall 10: Library choice made by default, not evaluated
**What goes wrong:** Picking TipTap again because it was built before. TipTap's value is a Markdown-shaped schema; Jira wiki is not Markdown-shaped, so the serializer and passthrough dominate effort whichever library is used. A heavier schema means more mapping code.
**Prevention:** Do a time-boxed spike (Phase 1) comparing ProseMirror/TipTap vs Lexical vs CodeMirror-6-with-decorations ("live preview" style source editing, where the stored string IS the document and cannot drift) against the corpus. The CodeMirror option removes the round-trip problem for untouched text by construction. Pick on corpus pass-rate and WebKit behaviour, not familiarity. Verify versions through Context7 at that time.
**Phase:** Phase 1 (decision gate).

---

## Moderate Pitfalls

### Pitfall 11: Paste from Word, HTML, Jira, other pages
**What goes wrong:** Pasted HTML brings inline styles, fonts, nested `div`s, `<br>`s. Pasting from the Jira web UI brings its HTML, not wiki. Pasting wiki markup text into WYSIWYG gets treated as literal text with escapes added (`*` becomes `\*`).
**Prevention:** Paste handler that (a) prefers `text/plain` when it looks like wiki markup, (b) runs HTML through an allowlist converter limited to the supported model, (c) strips styles. Tests with a Word fixture and a Jira-UI fixture. Never allow raw HTML into the doc (the WikiRenderer sanitize allowlist is a security boundary; do not widen it, its guard test must stay green).
**Phase:** Phase 3.

### Pitfall 12: Pasted and dropped images; Tauri DnD
**What goes wrong:** With `dragDropEnabled` on, Tauri swallows HTML5 drop events, so dropped files never reach the editor's `onDrop`. Generic-MIME images need extension classification. Clipboard images arrive as blobs with no name.
**Prevention:** Reuse the existing attachment upload flow and tile grid from 260916-ta1/260916-sak and the Tauri drag-drop event path (c392b0d7), not a new drop handler. Generate a filename (`image-<timestamp>.png`), upload, then insert `!name!` / `[^name]`; show an uploading placeholder and handle failure. Create mode (no issue yet) needs staged attachments (already built in ta1).
**Phase:** Phase 5, or Phase 4 if images are in scope there.

### Pitfall 13: Mentions
**What goes wrong:** A bespoke popup leaked DOM and fought modal focus traps (CR-03). Escape closing the popup also closes the surrounding modal or peek. Serialization must choose `[~username]` vs `[~accountid:…]` correctly for Jira DC (project history shows both appear). Mention autocomplete using one capped page fetch is a repeat bug in this repo.
**Prevention:** Use the shared `PersonPicker` with server-side search, rendered in a portal (overlays inside the `isolate` `<main>` otherwise sit under the sidebar border). Escape handling: capture at the popup, `stopPropagation`, do not let the dialog see it. Test inside the Create/Edit modal (Base UI focus trap) specifically.
**Phase:** Phase 4.

### Pitfall 14: Overlays, focus traps, and z-order
**What goes wrong:** Link dialogs, mention popups, colour pickers, image previews inside a Base UI Dialog or Sheet: focus returns to the wrong element, clicks outside close the dialog, or the overlay renders behind the sidebar.
**Prevention:** Portal to body with an explicit z-index; use Base UI Popover for toolbar popups; reuse `usePreviewEscape` and the backdrop attribute pattern for image viewers. Add a test per host that Escape closes only the topmost layer.
**Phase:** Phase 3 and 5.

### Pitfall 15: WebKit rendering quirks in the editing view
**What goes wrong:** Known in this repo: `::highlight` doesn't paint on flex/grid direct text, `<button>`, or `user-select:none`, so find-in-editor highlighting fails; italic glyph overhang is clipped by `truncate`/overflow hidden (add `pr-0.5`); `contenteditable` inside `overflow-auto` + abspos `sr-only` over-scrolls; `Space-y` with negative margins collapses; a 0-width column in virtualized tables.
**Prevention:** Editing surface is a normal block container (no flex/grid directly around text). Screenshot in a real WKWebView before iterating on CSS (project rule: inspect DOM first). Don't use `::highlight` for search in the editor; use overlay boxes like the existing FindBar if needed. Check WebView2 and WebKitGTK at least once per phase.
**Phase:** Phase 2 and 6.

### Pitfall 16: "Looks like WikiRenderer" implemented as a second stylesheet
**What goes wrong:** Editing view CSS copied from the renderer then drifts; a density change (compact/comfortable prose variants from 260812-rx9) updates only one.
**Prevention:** Share the prose class set (the renderer's attach point and density variants) between renderer and editor. Add a screenshot comparison of a corpus fixture rendered in both (same height, same wrapping within a tolerance).
**Phase:** Phase 2.

### Pitfall 17: Refactoring WikiRenderer to share code
**What goes wrong:** Extracting `preprocessJiraMarkup` for the editor changes behaviour; its ~2700 LOC of tests only catch what they cover, and some fixes were driven by debug sessions not unit tests.
**Prevention:** Only refactor behind the existing tests; add the corpus render-equality check as a second net before touching it. Prefer adding exports over restructuring. Do it as its own commit/plan with no editor changes mixed in.
**Phase:** Phase 1.

### Pitfall 18: Bundle size and startup
**What goes wrong:** ProseMirror/CodeMirror add ~120-180 KB gz (prior estimate); loading the editor eagerly slows first paint of pages that never edit.
**Prevention:** Lazy-load the editor chunk at the first edit action with a skeleton of equal height (no layout shift). Measure before and after (`vite build` report).
**Phase:** Phase 2.

### Pitfall 19: Host-by-host adoption risk
**What goes wrong:** Replacing 8 editor hosts at once (Create/Edit modal, inline description in detail and peek, comment composer, inline comment, comment edit, Create Epic, Bulk Create Subtasks, Edit Release description) multiplies regressions. Differences: Cmd/Ctrl+Enter submit, Escape-to-cancel, autosize vs fixed height, create-mode attachment staging, release descriptions are GitLab milestone text (Markdown, not Jira wiki) — wrong format there would corrupt data.
**Prevention:** Confirm the storage format of every host before wiring (Release description edits a GitLab milestone, likely Markdown; the editor must either be Markdown-capable or that host stays out). Adopt one host at a time, starting with the lowest-stakes (new comments), behind the same props API. Keep a `variant` prop for size and shortcuts. Run the corpus gate before each swap.
**Phase:** Phase 5 (staged), with a format audit in Phase 1.

### Pitfall 20: Bigger modal redesign coupled to editor work
**What goes wrong:** The Create/Edit modal rework (editor in the main column, fields in a sidebar) is built at the same time as the editor, so UI feedback rounds block the correctness work. Project history shows many UAT restyle rounds on layouts.
**Prevention:** Separate phases. Build the modal layout after the editor passes the corpus gate. Screenshot a candidate layout before building (project rule).
**Phase:** Phase 6.

---

## Minor Pitfalls

### Pitfall 21: Keyboard shortcut collisions
Cmd+B/I/K, J/K list navigation, and `Cmd+/` registry shortcuts must be suppressed inside the editor (the existing input suppression only covers `input`/`textarea`, not `contenteditable`). Update the shared suppression check.

### Pitfall 22: Spellcheck, autocorrect, smart quotes
WKWebView applies smart quotes and autocorrect in `contenteditable`, which silently changes `"` and `--` into typographic characters in code. Set `spellcheck`/`autocorrect`/`autocapitalize` appropriately and disable substitution inside code nodes.

### Pitfall 23: Accessibility regressions
The old textarea had ARIA labels (phase 28). Give the editor a role, label, and `aria-describedby`; the toolbar needs roving focus and labels. Don't put `role="button"` on nested interactive elements.

### Pitfall 24: Testing in jsdom only
jsdom has no layout, no real selection, and no IME. Tests can pass while the app fails (the prior attempt: 1701 tests green, live checks unconfirmed). Keep a short manual UAT checklist per phase and use a Swift WKWebView snapshot probe or the cached-Chromium throwaway page for visuals.

### Pitfall 25: Preview tab and existing consumers
Removing the Preview tab (prior decision D-OQ3) drops a feature users may rely on. Keep source mode view and consider a read-only rendered preview in Source mode.

---

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Mitigation |
|---|---|---|
| Phase 1: Library spike, corpus, parser/serializer, passthrough | 1, 2, 3, 4, 5, 10, 17 | Corpus harness first; library chosen on corpus pass-rate; byte-exact no-op save; deeper research flag |
| Phase 2: Editor core, source toggle, styling, drafts | 6, 7, 8, 9, 15, 16, 18 | Uncontrolled-while-focused; stable extensions; manual IME UAT on macOS; shared prose classes |
| Phase 3: Toolbar, paste, links, shortcuts | 2, 11, 14, 21, 22 | Native-syntax-only buttons; allowlist paste; shortcut suppression |
| Phase 4: Tables, panels, colour, mentions, macros | 3, 13, 14 | Fixture per shape; PersonPicker in portal; verbatim chips for unknown macros |
| Phase 5: Attachments/images and host adoption | 7, 12, 19 | Reuse attachment flow and Tauri drop path; format audit per host; one host at a time |
| Phase 6: Modal redesign and UI polish | 15, 20 | Screenshots before building; separate from editor correctness |

**Research flags:**
- Phase 1: needs deeper research (library spike, Jira DC wiki grammar edge cases verified against the live instance, `[~username]` vs accountid on this server).
- Phase 4: needs deeper research on table and nested-list modelling.
- Phase 5: confirm Release description storage format before scoping.
- Phase 3, 6: standard patterns.

## Confidence

| Area | Level | Notes |
|---|---|---|
| Prior-art causes | MEDIUM | Inferred from review/verification artefacts; the revert reason is not recorded |
| Jira syntax hazards | MEDIUM | Project memory and renderer history (HIGH for those); general Jira grammar from training knowledge, verify live |
| WebKit/IME | MEDIUM-LOW | General knowledge; test on target platforms |
| Library comparison | LOW | Not researched here; Phase 1 spike |

## Sources

- `git show backup/wiki-editor-before-revert-260531:.planning/quick/260531-saz-i-want-to-enhance-the-wiki-editing-input/` (CONTEXT, RESEARCH, REVIEW, SUMMARY, VERIFICATION) and `260531-ucj-*`
- `git log` for WikiRenderer fixes (724452e5, 8e5d96c4, 45a3c446, c90221d3, f3a6a2a9, 14337fa2, 0b36b449)
- Project memory notes on WKWebView, Tauri DnD, React Compiler, overlays, PersonPicker, attachments
