# Technology Stack: Rich Wiki Editor (v1.15)

**Project:** Taskflow
**Researched:** 2026-11-16
**Scope:** Only additions/changes for the WYSIWYG + source-toggle Jira wiki markup editor. Existing stack (Tauri 2, React 19 + React Compiler, Vite 8, Tailwind v4, Base UI, WikiRenderer pipeline) is unchanged and not re-researched.
**Overall confidence:** MEDIUM-HIGH (versions verified against the npm registry on 2026-11-16; bundle sizes and WebKit behaviour are estimates, flagged below)

## Recommendation in one paragraph

Use **TipTap v3 (ProseMirror) as the editing engine** and **write our own Jira-wiki tokenizer/parser (wiki to ProseMirror JSON) and serializer (ProseMirror JSON to wiki)**, with an explicit `rawWiki` fallback node for anything not modelled. Do **not** reuse the prior art's load path. Keep **source mode as a plain auto-sized textarea** (no CodeMirror). Add no new parser library: `jira2md` stays for WikiRenderer only and must not be on the editor's load path.

The engine choice is the easy part and matches the prior art. The hard, fidelity-critical part is the wiki to doc parser. The reverted build routed load through `preprocessJiraMarkup` then `jira2md` then markdown to HTML then `generateJSON`. That path is lossy by construction. For example, the preprocessor turns `(/)` and `(x)` into emoji, so the old code had to guess task lists back out of emoji paragraphs ("CR-04" hack in the prior `jiraToTiptap.ts`). The revert reason is unrecorded, so that is a hypothesis, not a fact. It is nonetheless the clearest structural weakness in the prior art.

## Recommended Stack (NEW dependencies only)

### Editor engine

| Technology | Version (npm 2026-11-16) | Purpose | Why |
|---|---|---|---|
| `@tiptap/react` | ^3.34.0 | React binding (`useEditor`, `EditorContent`) | MIT. Peer React `^17 \|\| ^18 \|\| ^19`. Prior art already ran on 3.24 in this repo. |
| `@tiptap/core` | ^3.34.0 | Extension/node/mark API | Lets us declare custom nodes with `renderHTML` that emit the same class/DOM shape as WikiRenderer output. |
| `@tiptap/pm` | ^3.34.0 | Single pinned ProseMirror bundle | Avoids duplicate `prosemirror-*` copies (the classic "Unknown node type" / duplicate-plugin-key bug). Always import PM from here, never from `prosemirror-*` directly. |
| `@tiptap/starter-kit` | ^3.34.0 | Paragraph, headings, lists, bold/italic/strike/underline, code, codeBlock, blockquote, link, history, hardBreak, hr | v3 starter kit includes underline and link. Configure `codeBlock` and `link` off if replaced by custom nodes. |
| `@tiptap/extension-table` (+ `-row`, `-cell`, `-header`) | ^3.34.0 | Tables with `|\|header\|\|` and `|cell|` | MIT, mature, column ops, tab navigation. v3 exports all four from the one package in recent versions; verify at install time. |
| `@tiptap/extension-mention` + `@tiptap/suggestion` | ^3.34.0 | `@mention` node and trigger popup | Serializes to `[~username]` / `[~accountid:...]`. Reuse existing `MentionPopover` data/search, only the popup rendering changes. |
| `@tiptap/extension-image` | ^3.34.0 | Inline image node | Needed for `!image.png!` and attachment images. Custom attrs (`filename`, `width`, `align`) required. May be simpler as a custom node since src is resolved via the auth-proxied attachment map. |
| `@tiptap/extension-placeholder`, `@tiptap/extensions` (Placeholder/CharacterCount as needed) | ^3.34.0 | Empty-state hint | Optional, trivial. |

Not needed: `@tiptap/html` (the prior art used it for `generateJSON`; with our own parser we emit JSON directly, so it is dead weight), `@tiptap/markdown` (Markdown, wrong format), task-list extensions (Jira wiki has no task list; `(/)` `(x)` are emoticons, not checkboxes; do not model them as tasks).

### Wiki parser/serializer (own code, no new dependency)

| Piece | Where | Approach |
|---|---|---|
| `parseWiki(text): JSONContent` | `lib/wiki-editor/` (new) | Line-oriented block tokenizer (headings `hN.`, lists `* # - ** ##`, `bq.`, tables, `{panel}`/`{info}`/`{note}`/`{warning}`/`{tip}`/`{code}`/`{noformat}`/`{quote}`/`{color}`, `----`) plus an inline tokenizer (`*b*`, `_i_`, `+u+`, `-s-`, `{{m}}`, `[link]`, `[~user]`, `!img!`, `[^file]`, emoticons). Anything unrecognised becomes a `rawWiki` node/mark holding the exact source slice. |
| `serializeWiki(doc): string` | same | Pure function over JSONContent (no DOM). Prior art's 400-line serializer is a reasonable starting point; salvage it. |
| Fixture-corpus test | vitest | For each fixture: `render(wiki)` equals `render(serialize(parse(wiki)))` by DOM-snapshot comparison through the real `WikiRenderer`. This is the milestone's stated safety net. |

Why own parser rather than a library: see "Existing wiki parser libraries" below. Short version: none is both bidirectional and faithful to Jira DC rendering; WikiRenderer's quirks (inline single-line tables, headerless tables, `{{{}TEXT{}}}`, entity handling, issue-key linking) live in your own preprocessor and only a parser you own can be made to agree with them.

### Source mode

| Choice | Why |
|---|---|
| **Plain `<textarea>`, auto-sized, monospace** (existing `SourceView` pattern from prior art, 33 lines) | Source mode is an escape hatch for edge cases. A textarea has zero bundle cost, native WebKit behaviour (undo, IME, spellcheck), and the app already ships one. |
| **Do NOT add CodeMirror 6 now** | CM6 is MIT and current (`codemirror` 6.0.2, `@codemirror/view` 6.43.15, `@codemirror/state` 6.7.6, `@codemirror/language` 6.13.1), but there is **no Jira wiki language package** (npm has no `codemirror-lang-jira`; `@codemirror/legacy-modes` 6.5.5 has no Jira mode). Highlighting would mean writing a StreamLanguage ourselves, plus a theme matched to the app's light/dark tokens, for a rarely used mode. Revisit only if user feedback asks for highlighting. If added later: `@uiw/react-codemirror` ^4.25 (React >=17) or raw `@codemirror/*` in a small ref-managed wrapper. |

### Supporting (already installed, reuse)

| Library | Use in editor |
|---|---|
| `highlight.js` ^11 | Code block highlighting inside the editor (via a NodeView or decoration), same theme as WikiRenderer. |
| `@base-ui/react` | Toolbar buttons, link popover, macro picker menus. No separate toolbar lib. |
| `@dnd-kit/*` | Not needed for the editor (image drop uses native DOM drop + existing attachment upload in `lib/attachment-markup.ts`). Do not use it for block drag handles. |
| `lucide-react` | Toolbar icons. |

## Comparison (the asked-for matrix)

Legend: Good / OK / Weak / n.a. Versions and licenses from npm on 2026-11-16.

| Criterion | **TipTap 3** (3.34.0, MIT) | Raw ProseMirror (view 1.42.9, MIT) | Lexical (0.53.0, MIT) | BlockNote (0.57.0, **MPL-2.0**) | Milkdown (7.23.0, MIT) | Plate/Slate (platejs 53.x, slate 0.147.4, MIT) | Custom contentEditable |
|---|---|---|---|---|---|---|---|
| Wiki round-trip control | Good: schema + own parse/serialize; JSON doc | Good (same engine, more boilerplate) | OK: custom nodes + own import/export; transforms are less documented | Weak: fixed block model, own JSON; macros fight the block schema | Weak: Markdown/remark centric, wrong source format | OK: Slate JSON, own (de)serializers | Weak: you rebuild a doc model |
| Tables | Good (maintained ext, MIT) | Good (`prosemirror-tables`) | OK (`@lexical/table`) | OK | OK | OK | Weak: very hard |
| Custom block macros (panel/info/note/code/color/quote/noformat) | Good: `Node.create` with `content`, attrs, NodeView | Good | Good | Weak | Weak | Good | Weak |
| Mentions | Good (official ext + suggestion) | OK (DIY) | OK (typeahead plugin) | OK (built-in, own UX) | Weak | OK | Weak |
| Image/attachment nodes | Good | Good | Good | Good | OK | Good | Weak |
| Paste handling | Good: PM `transformPastedHTML`/`handlePaste` hooks, clipboard parse by schema | Good | OK | OK | OK | OK | Weak: DIY sanitising |
| WebKit contentEditable | Good: ProseMirror has the longest track record incl. Safari/WebKit composition, selection and mutation handling (MEDIUM; general reputation, no WebKit-specific source verified) | Good | OK: 0.x, younger; Safari issue history exists (LOW; not verified) | Good (PM underneath) | Good (PM underneath) | OK: Slate historically weaker on IME/selection | Weak |
| React 19 / Compiler | OK: peer React 19 declared; some open v3 `useEditor`/NodeView lifecycle issues (see Pitfalls); no known Compiler-specific issue found | n.a. (no React layer; DIY) | Good: `@lexical/react` peer `>=18` | OK | OK | OK: peer `>=18` | n.a. |
| Bundle (gzip, estimate) | ~60-90 KB with starter-kit + table + mention (LOW: not measured; measure with the installed `rollup-plugin-visualizer`) | ~45-60 KB (LOW) | ~25-45 KB core (LOW) | Large (Mantine/own UI deps) | Large | Large (Slate + Plate plugins) | 0 but huge dev cost |
| License | MIT (core, table, mention, starter-kit) | MIT | MIT | MPL-2.0 core; XL packages GPL/commercial | MIT | MIT | n.a. |

Verdicts:

- **TipTap 3: choose.** Strongest fit: schema-driven custom nodes for macros, mature table and mention extensions, ProseMirror WebKit track record, JSON doc in/out. Prior art already proved the integration and the repo's tooling (Biome, vitest/jsdom) handled it.
- **Raw ProseMirror: viable but not worth it.** Same engine; you would re-write the React binding, NodeView portals and extension composition that TipTap already provides. Keep it as the escape hatch (everything is reachable via `@tiptap/pm`).
- **Lexical: runner-up.** Smaller and good React integration, but still 0.x with API churn, tables/macros need more hand-rolling, and the team has zero Lexical history in this repo. Not worth a second engine evaluation.
- **BlockNote: reject.** Block-first UX (slash menu, drag handles) is the wrong shape for inline wiki constructs, MPL-2.0 file-level copyleft plus GPL/commercial XL packages, heavy UI deps (conflicts with Base UI/shadcn design system).
- **Milkdown: reject.** Markdown/remark model; our storage format is Jira wiki.
- **Plate/Slate: reject.** Heavy, Slate still 0.x, and its shadcn-flavoured UI would duplicate the existing Base UI components.
- **Custom contentEditable: reject.** Re-implements selection, IME, undo, paste, tables. WKWebView contentEditable quirks make this the highest-risk option.

## Existing Jira wiki parser/serializer libraries

| Library | Direction | Verdict |
|---|---|---|
| `jira2md` 3.0.1 (Apache-2.0) | Regex string-to-string, both ways, to Markdown | Already used by WikiRenderer. Not an AST, lossy for macros/tables, known italic/underscore corruption (the repo carries a `fixMarkdownLinkUnderscores` workaround). Keep for rendering; **keep off the editor load path**. |
| `@atlaskit/editor-wikimarkup-transformer` 12.2.4 (Apache-2.0) | **Bidirectional**: parser (wiki to ADF) plus `encoder` (ADF to wiki) | The only real AST-producing option, so worth a spike but **not recommended**: depends on `@atlaskit/adf-schema`, `@atlaskit/editor-prosemirror`, `@atlaskit/editor-json-transformer` (~860 KB unpacked itself; transitive size not measured), targets Jira **Cloud** ADF semantics (not Jira DC rendering, which is what WikiRenderer mirrors), and its ADF schema would need mapping to our TipTap schema anyway. Use at most as a **reference for edge-case grammar** (how it tokenises `{panel}` params, nested lists, table cell pipes). |
| `jira-prsr` | n/a | Not found on npm registry. |
| Any other maintained JS Jira wiki AST library | n/a | None found. Confidence MEDIUM (negative claim; npm and web search only). |

Therefore: write the parser. Keep it narrowly scoped (block + inline tokenizer, about 500-800 LOC) and fail safe to `rawWiki`.

## Integration points

1. **Editor component** `components/wiki-editor/` (new; may reuse prior art's file layout). Props: `value` (wiki string), `onChange(wiki)`, `attachments`, `users`, `onUploadFile`, density variants. Hosts: DescriptionEditor, CommentComposer, InlineComment, Create/Edit Issue modal, Create Epic, Bulk Create Subtasks, Edit Release description.
2. **Styling**: the editor content root must reuse WikiRenderer's prose classes (the density-variant attach point from quick 260812-rx9) so WYSIWYG looks like the rendered output. Do not write a second stylesheet.
3. **Attachments/images**: reuse `lib/attachment-markup.ts` for `[^file]` and `!file!` syntax; image `src` resolves via the existing `AttachmentMap` (Tauri HTTP plugin with auth), not a raw URL.
4. **Mentions**: reuse `MentionPopover` search; the TipTap suggestion renders it. Serializer maps to the same `[~user]` form WikiRenderer's `UserMap` expects.
5. **React Compiler**: keep the `Editor` instance in a ref/`useEditor` only; do not read `editor.getJSON()` or `editor.state` during render. Subscribe via `useEditorState` or `onUpdate` callbacks. The prior art needed fixes "CR-02/WR-04/WR-05: stabilise extensions + toggle + editability" (commit fa0c30d5): create the extensions array once at module scope or in `useMemo`/`useRef`, never inline per render. Compiler memoisation will not break that; unstable identity will.
6. **Raw fallback**: unknown macros and unparseable spans become a `rawWiki` atom (block) or mark (inline) displaying monospace source, serialised verbatim. This is the lossless guarantee.
7. **Vite**: no config change needed. Dynamic-import the editor (`React.lazy`) so the dashboard and list routes do not pay the bundle cost; the Create Issue modal and detail page load it on demand.

## Installation

```bash
cd taskflow
npm install @tiptap/react@^3.34.0 @tiptap/core@^3.34.0 @tiptap/pm@^3.34.0 \
  @tiptap/starter-kit@^3.34.0 @tiptap/extension-table@^3.34.0 \
  @tiptap/extension-mention@^3.34.0 @tiptap/suggestion@^3.34.0 \
  @tiptap/extension-image@^3.34.0
# Optionally: @tiptap/extension-placeholder@^3.34.0
```

Pin all `@tiptap/*` to the same minor (mixing minors is a known source of runtime breakage); consider exact versions via an `overrides` block if drift appears.

## What NOT to add

| Do not add | Reason |
|---|---|
| `@tiptap/html` | Only needed for the lossy HTML-to-JSON load path. |
| `@tiptap/markdown`, `marked`, `turndown`, `remark-*` in the editor path | Wrong format; adds a second lossy conversion. |
| `@tiptap/extension-task-list/-item` | Jira wiki has no checkboxes; prior art's task-list reconstruction was a workaround for emoticon substitution. |
| `@tiptap/extension-collaboration`, `y-*`, `@tiptap/extension-drag-handle` and other Pro/Cloud extensions | Out of scope; some are paid/cloud. |
| CodeMirror 6 (for now) | No Jira grammar exists; textarea suffices. |
| `@atlaskit/*` | Cloud/ADF semantics, heavy transitive tree. |
| BlockNote, Plate, Milkdown, Lexical | See verdicts above. |
| A second wiki-to-HTML renderer | WikiRenderer stays the only renderer; the editor's NodeViews mimic its output via shared classes. |

## Risks and verification flags

- **Parser fidelity is the milestone's main risk**, not the library. Build the fixture corpus (from real, de-identified issue text) before the editor UI, and drive parser development against it.
- **TipTap v3 React lifecycle issues** are open on GitHub as of 2026-11 (e.g. #8400 editor destroyed before first effect under Suspense/lazy; #8661 `flushSync` warning when calling `setContent` from a passive effect; #8516 node views built twice on mount). Mitigations: avoid `setContent` in effects (feed `content` at creation, re-key the editor on value identity change), avoid wrapping `EditorContent` in a Suspense boundary that suspends repeatedly, and prefer plain-DOM NodeViews (`renderHTML`) over `ReactNodeViewRenderer` unless interactivity requires it. No React Compiler-specific TipTap issue was found; **verify with a smoke test in the real Tauri WKWebView** (MEDIUM-LOW).
- **WebKit**: Tauri/WKWebView contentEditable behaviour could not be verified from authoritative sources. Plan a manual UAT pass on macOS for caret movement across tables/atoms, IME, drag-drop of images (note the existing Tauri `dragDropEnabled` gotcha swallows drops; see the attachments DnD memory) and clipboard image paste.
- **Bundle size** numbers above are estimates. Measure with the existing visualizer after the first integration.
- **Reverted-prior-art reason unknown**; the likely culprits (lossy load path, UX, instability fixes) are inferred from code and commit history only.

## Sources

- npm registry (queried 2026-11-16): `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-mention`, `@tiptap/markdown` all 3.34.0 MIT; `lexical`/`@lexical/react` 0.53.0 MIT; `prosemirror-view` 1.42.9; `@blocknote/core` 0.57.0 MPL-2.0; `@milkdown/kit` 7.23.0; `slate` 0.147.4; `@platejs/core` 53.5.2; `codemirror` 6.0.2; `@codemirror/view` 6.43.15; `@codemirror/legacy-modes` 6.5.5; `@uiw/react-codemirror` 4.25.12; `jira2md` 3.0.1 Apache-2.0; `@atlaskit/editor-wikimarkup-transformer` 12.2.4 Apache-2.0 (package contents inspected: `dist/esm/parser` and `dist/esm/encoder`). HIGH for versions/licenses.
- Prior art: git tag `backup/wiki-editor-before-revert-260531` (`jiraToTiptap.ts` 396 LOC, `jiraWikiSerializer.ts` 400 LOC, `WikiEditor.tsx` 414 LOC, `SourceView.tsx` 33 LOC; TipTap ^3.24.0). HIGH for what it contained.
- TipTap GitHub issues: https://github.com/ueberdosis/tiptap/issues/8400, https://github.com/ueberdosis/tiptap/issues/8661, https://github.com/ueberdosis/tiptap/issues/8516; changelog https://tiptap.dev/docs/resources/changelog/react. MEDIUM.
- Editor comparisons (general, dated): https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025, https://gist.github.com/stormwild/044e184f8ef9bf3062a1ca950d6c0569. LOW (WebKit claims not independently verified).
