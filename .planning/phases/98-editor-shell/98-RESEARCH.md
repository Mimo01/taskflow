# Phase 98: Editor Shell - Research

**Researched:** 2026-11-17
**Domain:** TipTap v3 (ProseMirror) rich editor shell over the Phase 97 wiki round-trip engine, React 19 + React Compiler, Tauri/WKWebView
**Confidence:** HIGH on engine/TipTap/app-code findings (verified in this repo and in the installed packages); MEDIUM on UI-library composition (Popover anchor for the table toolbar); LOW on Jira-specific lists (palette, languages) which are `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The toolbar is **sticky at the top, inside a single bordered editor frame**. Content scrolls under it once it passes the max height. Rich and source modes share the same frame. Watch the sr-only/`relative` scroller gotcha.
- **D-02:** At narrow widths the toolbar **stays on one row**, and lower-priority buttons move into a `⋯` overflow menu. Use container queries, as the PageHeader primitive does. The mode toggle (D-09) never moves into the overflow.
- **D-03:** **Two presets now, set by a prop:** `full`, for descriptions; `compact`, for comments: marks, lists, link, insert and source toggle. Both can be exercised in the dev-tools tab, so Phase 100 only has to choose one.
- **D-04:** Toolbar tooltips show the **label plus keycaps** (e.g. "Bold ⌘B"), using the app's tooltip and keycap style.
- **D-05:** The source-mode preview is **on by default and can be hidden** with a toolbar control. The textarea is on the left and a live WikiRenderer preview on the right. It stacks or auto-hides at narrow widths.
- **D-06:** The rich/source choice is **remembered per user, globally** (settings store). If the user prefers source, every editor opens in source. A text that fails the round-trip check still forces source for that text only. It does not change the saved preference.
- **D-07:** **SAFE-05 notice:** one quiet, muted line under the toolbar, e.g. "This text uses formatting the rich editor can't keep safely, so it opens in source." The rich side of the toggle is disabled for that text, with a tooltip. There is no "try rich anyway".
- **D-08:** **When `saveWiki` returns `failed`:** keep the rich doc, never write, and show an inline error that names the problem (the engine's `reason`). Offer a "Fix in source" action that switches to source mode. Research/planning decides what text source mode shows here. The edit could not be emitted safely, so it might be the last safe emit or the original plus a note. Never silently drop the user's edit.
- **D-10:** The dev-tools **"Editor" tab** (in `routes/dev-tools`, gated by `devToolsEnabled`) includes: a fixture picker for the Phase 96/97 corpus (placeholder-only) plus a blank doc; a live panel showing the `saveWiki` output and its kind (unchanged/saved/failed), and the `loadWiki` kind with the demoted block indexes; a preset switcher (full/compact) and a width switcher (narrow/wide); a paste-your-own-wiki textarea that loads arbitrary text, local only, never saved anywhere. Claude may add further dev aids. Show rendered previews where possible, not raw JSON dumps.
- Folded todo `wiki-roundtrip-phase97-followups.md` (WR-01, table-cell `{code}`/`{noformat}`, WR-02, IN-01) must be closed before the editor ships.

### Claude's Discretion
- Headings/quote picker: default "Normal text ▾" dropdown (Paragraph, H1-H6, Quote).
- Block insertion before the slash menu: single "+ Insert" dropdown (table, code, noformat, panel/info/note/warning/tip, rule) driven by a data structure Phase 99's slash menu can reuse.
- D-09 (toggle): right-aligned segmented "Rich | Source" with ⌘⇧M registered in `src/lib/shortcuts.ts`; a single icon toggle is acceptable in the compact preset.
- Undo across toggles (EDIT-08): keep the rich history; switching back from source is one transaction; textarea keeps native undo in source mode. No fine-grained cross-mode history.
- Tables: floating table toolbar while the caret is in a table (add row above/below, add column left/right, delete row/column, toggle header row/column, delete table); Tab/Shift+Tab move cells, Tab in last cell adds a row; grid-size insert picker (up to ~6x6) with header row default; header-less attr must round-trip.
- Panels: render like WikiRenderer panel; editable title line in header; corner control to switch type or remove; editable body.
- Code blocks: SearchableSelect of Jira's supported languages plus "none" in the block header; `{noformat}` has no language.
- Colour: swatch popover with Jira's standard text palette plus "remove colour"; validate via the Phase 97 `{color}` guard; off-palette existing colours kept and shown as-is.
- Raw atoms: render read-only through WikiRenderer with a faint dashed frame and "Edit in source" hover affordance; inline raw atoms as a quiet chip; both selectable/deletable as a unit. Demoted load: frames only, no banner.
- Remaining: link editing UI (popover vs inline), placeholder text, min/max height and autosize values. Follow existing app patterns.

### Deferred Ideas (OUT OF SCOPE)
- None new. The slash menu (BLOCK-05), mentions popover, attachment/image nodes, paste and drop (Phase 99); host adoption, drafts, dirty guards, Cmd+Enter/Esc (Phase 100); the large Create/Edit modal (101-102); source<->rich caret-offset mapping (EDIT-F1); per-block source-slice re-emit (SAFE-F1).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from phase scope) | Research Support |
|----|-------------|------------------|
| EDIT-01 | Rich view styled like WikiRenderer output | Extract shared prose class constant; `lib/wiki/prose.ts`; panel/code classes in WikiRenderer.tsx |
| EDIT-02 | Raw source view | Plain textarea + live WikiRenderer preview; source text rules (Pattern 3) |
| EDIT-03 | Side-by-side preview in source mode | `@container` width gating, preview toggle |
| EDIT-04 | Toolbar + keyboard shortcuts | Keymap extension; shortcut collisions table; `@tiptap/extensions` UndoRedo |
| EDIT-05 | Headings, mixed lists, quotes, rules, line breaks | StarterKit nodes already in `wikiExtensions`; commands + input rules |
| EDIT-06 | Links | Link mark config; popover; paste-URL-over-selection (linkOnPaste is off in schema) |
| EDIT-07 | Marks (bold/italic/underline/strike/mono/sub/sup) | Marks exist in schema; mono/sub/sup need shortcuts + commands (custom marks have none) |
| EDIT-08 | Toggle rich/source without losing content or undo | Single-tr `replaceWith` + `setDocAttribute` + `closeHistory` (verified experiment) |
| EDIT-09 | Single frame, sticky toolbar, overflow | Container-query pattern, sticky/`relative` gotchas |
| SAFE-05 | Failing round-trip opens source with quiet notice | `loadWiki` kinds; forced-source state machine |
| BLOCK-01 | Tables insert/edit | extension-table commands + built-in Tab keymap (verified) |
| BLOCK-02 | Code/noformat blocks | codeBlock attrs `language/open/close`; parser language regex `[a-z]+` |
| BLOCK-03 | Panels with titles | `panel` node attrs `type/params`; `title=` only modelled |
| BLOCK-04 | Palette-validated coloured text | `isSafeColor` guard; `color` mark |
| FLOW-04 | App shortcuts suppressed while typing in contenteditable | Listener audit table; react-hotkeys-hook behaviour verified |
</phase_requirements>

## Summary

The Phase 97 engine is shaped well for a shell: `wikiExtensions` is a pure, module-scope array with no node views or plugins, `loadWiki` returns `rich | rich-demoted | failed`, and `saveWiki` is no-op-safe. Everything the shell needs is in the installed TipTap 3.34 packages except `@tiptap/react` (add at exactly `3.34.0`, because its peer deps pin `@tiptap/core`/`@tiptap/pm` to the exact version) and `@tiptap/extensions` (which holds `UndoRedo`, `Placeholder`; it is already in `node_modules` as a transitive dependency of starter-kit and should become a direct dependency). Phase 97 deliberately turned `undoRedo`, `dropcursor`, `gapcursor` off, so the editor array must add them back.

**Two engine-level findings must be fixed in the first plan, before any UI**:

1. **`saveWiki(loaded, current)` can never return `unchanged` for a TipTap doc.** `editor.schema` is a different `Schema` instance than `wikiSchema` (`getSchema()` builds a new one per call), and ProseMirror `Node.eq` compares `type` by identity. Verified experimentally: `saveWiki(loaded, editor.state.doc)` returns `saved`, while `saveWiki(loaded, wikiSchema.nodeFromJSON(editor.getJSON()))` returns `unchanged`. That breaks the D-04 no-op contract (the original string would be replaced by a re-emit on the first keystroke-free blur). Fix inside the engine: normalise `current` to `wikiSchema` (via `nodeFromJSON(current.toJSON())`) when `current.type.schema !== wikiSchema`, and add a regression test.
2. **Undo across toggles works as a single transaction, but only with the right history calls.** Verified experimentally: dispatch one `tr.replaceWith(0, doc.content.size, next.content)` plus `tr.setDocAttribute(k, v)` for each changed doc attr (`eol`, `tail` live on the doc node and a content replace does not touch them), wrapped in `closeHistory(tr)` and followed by an empty `closeHistory(state.tr)`. Result: one Cmd+Z reverts the whole source session including doc attrs, and a further Cmd+Z reaches the earlier typing. `tr.setMeta('closeHistory', true)` is a no-op (the meta key is a `PluginKey`, not a string); use the exported `closeHistory()` helper. Without it, a source toggle merges with the preceding typing group.

**Primary recommendation:** Build `<WikiEditor>` as one lazy chunk under `src/components/wiki-editor/` with a pure, headless-testable "session" module (rich<->source transitions, echo guard, forced-source state machine) separated from React components; extend the Phase 97 nodes with `.extend({ addNodeView })` using React node views for panel/code/raw atoms; fix the engine schema-identity issue and the folded todo items first; and make the dev-tools tab the UAT surface.

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` or `taskflow/CLAUDE.md` exists in the repo (checked). Constraints come from the user's memory index and CONTEXT.md; the planner must honor them:

- **Repo layout:** `.planning/` and git at outer `taskflow/`; `src`, npm, vitest, biome in inner `taskflow/taskflow/`. [VERIFIED: repo]
- **React Compiler runs in the app (vite) but not in vitest** (vitest.config.ts uses plain `react()`). Module-level mutable reads go stale only in the app. [VERIFIED: vite.config.ts, vitest.config.ts]
- **Pre-commit hook runs the full vitest suite**; combine RED/GREEN in one commit per TDD task. Biome lint now blocks commits.
- **No `git stash` to A/B compare; no bulk find-replace of identifiers; no `biome --write` over all of `src`.**
- **Overlays inside the `isolate` `<main>` must portal to `body`** (table toolbar, colour/link/insert popovers, language select).
- **Fixtures placeholder-only** (no customer data).
- **sr-only escapes scroller:** a non-positioned `overflow-auto` scroller with an abspos `sr-only` child over-scrolls; the sticky-toolbar scroller must be `relative`.
- **Container-query gotcha:** `@container` variants never style the container itself; put styles on an inner wrapper.
- **Visual bugs:** inspect rendered DOM before iterating CSS; screenshot before restyling. Dev-tools means the in-app page (store + tab), not the webview console.
- **Wizard/Settings:** settings-store changes need a persist `version` bump + migration; a source-string test reads the version.
- **Shortcut registry:** `src/lib/shortcuts.ts` feeds the Cmd+/ panel; the panel has a fixed `CATEGORIES` array.
- **Keep scripted edits verified** (python replace silently no-ops after biome reindent).

## Architectural Responsibility Map

Desktop app (Tauri, single webview). Tiers map to: Webview UI (React), Pure lib (no React), Persistence (Zustand/Tauri store).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse/emit/verify wiki text | Pure lib (`lib/wiki/editor`) | - | Already built; shell only calls `loadWiki`/`saveWiki` |
| Rich<->source transitions, echo guard, forced-source state | Pure lib (new `editor-session.ts`) | React hook wraps it | Headless-testable in vitest with `new Editor(...)`; keeps React Compiler out of the logic |
| ProseMirror schema, keymaps, input rules | Pure lib (TipTap extensions) | - | Extensions are module-scope constants |
| Node views (panel, code block, raw atoms) | Webview UI (React node views) | - | Need Popover/SearchableSelect/WikiRenderer |
| Toolbar, menus, popovers, table toolbar | Webview UI | - | Base UI primitives, portaled to body |
| Rich/source preference | Persistence (settings store) | - | D-06, persisted with migration |
| Dev-tools Editor tab | Webview UI (lazy route child) | - | Gated by `devToolsEnabled`; imports editor lazily |
| App-shortcut suppression | Webview UI (listeners) | - | Per-listener `isContentEditable` guard; react-hotkeys-hook already guards |
| Bundle isolation | Build/test | - | Extend bundle-guard test; dynamic import only |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/core` | ^3.34.0 (installed 3.34.0) | Editor, Extension/Node/Mark, input-rule helpers | Phase 96 decision; already in schema.ts |
| `@tiptap/pm` | ^3.34.0 (installed) | ProseMirror re-exports (`history`, `state`, `tables`, `transform`) | Single PM instance; bundle-guard forbids elsewhere |
| `@tiptap/starter-kit` | ^3.34.0 (installed) | Base nodes/marks (already inside `wikiExtensions`) | Reuse, do not recompose |
| `@tiptap/extension-table` | ^3.34.0 (installed) | Table + built-in Tab/Shift-Tab/last-cell-add-row keymap | [VERIFIED: node_modules/@tiptap/extension-table/src/table/table.ts:576-594] |
| `@tiptap/react` | **3.34.0 (add; exact)** | `useEditor`, `EditorContent`, `useEditorState`, `ReactNodeViewRenderer`, `NodeViewWrapper`, `NodeViewContent` | Official React binding; peerDeps pin core/pm to `3.34.0` exactly [VERIFIED: npm registry, tarball inspected] |
| `@tiptap/extensions` | ^3.34.0 (add as direct dep; already hoisted) | `UndoRedo`, `Placeholder` | `UndoRedo` was turned off in `wikiExtensions`; editor must add it. Same monorepo release, already in lockfile via starter-kit |

### Supporting (already in the app)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@base-ui/react` Popover via `components/ui/popover.tsx` (supports `anchor`) | Colour, link, table-grid, floating table toolbar | Portal to body already (`PopoverPrimitive.Portal`) |
| `components/ui/dropdown-menu.tsx` | Text style, Insert, overflow, panel-type menu | |
| `components/ui/searchable-select.tsx` | Code language, dev-tools fixture picker | Language `pinnedOption` for "None" |
| `components/ui/tooltip.tsx` + `tooltip-body.tsx` | Label + keycaps | |
| `react-hotkeys-hook` ^5.2.4 | Existing app shortcuts | Already ignores contenteditable by default |
| `@babel/core` + `babel-plugin-react-compiler` 1.0.0 (installed) | Compiler-compat vitest check | Dev only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Popover+`anchor` for the table toolbar | `BubbleMenu` from `@tiptap/react/menus` (floating-ui, optional deps of `@tiptap/react`) | BubbleMenu is TipTap-native but adds floating-ui code to the chunk and its own portal/z-index handling; recommended only if the Popover prototype steals focus |
| React node views | Plain-DOM node views | Plain DOM is lighter, but panel (menu), code (SearchableSelect) and raw atoms (WikiRenderer) all need React UI, so React node views are justified here |
| `@tiptap/markdown`, `@tiptap/html`, task-list, Pro | - | **Forbidden** by STACK.md; do not add |

**Installation:**
```bash
cd taskflow && npm install @tiptap/react@3.34.0 @tiptap/extensions@^3.34.0
```
**Version verification:** `npm view @tiptap/react version` -> `3.34.0` (modified 2026-11-13); `scripts.postinstall` empty; dependencies `fast-equals`, `use-sync-external-store`; optionalDependencies `@tiptap/extension-bubble-menu`, `@tiptap/extension-floating-menu` (only bundled if `@tiptap/react/menus` is imported). [VERIFIED: npm registry]

## Package Legitimacy Audit

slopcheck and ctx7 are not installed in this environment (`which` returned nothing). Mitigation: `@tiptap/react` is named by the official install guide (tiptap.dev/docs/editor/getting-started/install/react, fetched this session), is published by the same publisher as the four `@tiptap/*` packages already in the lockfile, and was approved by the user at the Phase 96 Plan 02 gate. `@tiptap/extensions` is already installed transitively.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tiptap/react` | npm | long-lived (3.34.0 published 2026-11-13) | not measured | github.com/ueberdosis/tiptap | unavailable | Approved: user-approved at Phase 96 gate, official docs name it, no postinstall |
| `@tiptap/extensions` | npm | same monorepo | not measured | github.com/ueberdosis/tiptap | unavailable | Approved: already installed (`node_modules/@tiptap/extensions`), becomes direct dep |

**Packages removed due to slopcheck [SLOP]:** none (slopcheck unavailable)
**Packages flagged [SUS]:** none. Because slopcheck could not run, the planner should still keep the one-time install behind the normal user approval already recorded for Phase 96; no extra checkpoint needed beyond noting the exact-version pin.

## Architecture Patterns

### System Architecture Diagram

```
 host / dev-tools tab
   value: string, onChange(text), preset, forceSource?
          |
          v
 [WikiEditorLazy]  --lazy(import)-->  [WikiEditor chunk]
   Suspense skeleton (toolbar 40px + min-height)       |
   ErrorBoundary: "The editor couldn't load..."        |
                                                       v
                          +---------------- editor-session (pure) ----------------+
 value ---> loadWiki(value) ----> kind?                                           |
              rich / rich-demoted: mode = settings.wikiEditorMode                 |
              failed:              mode = source (forced), notice, Rich disabled  |
                                                                                  |
   RICH MODE                                  SOURCE MODE                         |
   useEditor(extensions const)                textarea (native undo) + Preview    |
   EditorContent + node views                 text = toSourceText()               |
   onUpdate --> saveWiki(loaded, doc)         onChange(text) direct (no engine)   |
      unchanged -> onChange(original)         preview = <WikiRenderer markdown>   |
      saved     -> onChange(text)                                                 |
      failed    -> keep doc, inline error + "Fix in source"                       |
                                                                                  |
   toggle rich->source: text = saved|unchanged|best-effort emit (D-08)            |
   toggle source->rich: loadWiki(text); same text => no tr; else ONE tr           |
        replaceWith + setDocAttribute, closeHistory before+after                  |
   echo guard: lastEmittedRef; effect(value) only applies true external changes   |
                          +-------------------------------------------------------+
```

### Recommended Project Structure
```
taskflow/src/
├── lib/wiki/
│   ├── prose.ts                    # NEW shared WIKI_PROSE_CLASSES + callout classes (no editor imports)
│   └── editor/                     # Phase 97 engine (+ schema-identity fix in engine.ts, exported node consts)
├── components/wiki-editor/         # NEW lazy chunk root (nothing in WikiRenderer's graph imports this)
│   ├── WikiEditorLazy.tsx          # lazy + Suspense skeleton + error boundary (the ONLY eager entry)
│   ├── WikiEditor.tsx              # default export; props contract
│   ├── editor-session.ts           # pure: toSource/toRich/replaceDoc/echo guard/forced-source
│   ├── extensions.ts               # module-scope editorExtensions (wikiExtensions + UI nodes + keymap + rules)
│   ├── input-rules.ts              # wiki/markdown rules
│   ├── keymap.ts                   # WikiKeymap extension + SHORTCUT ids
│   ├── insert-items.ts             # data-driven Insert list (reused by Phase 99 slash menu)
│   ├── palette.ts / languages.ts   # colour swatches, Jira languages (validated against parser)
│   ├── nodeviews/ PanelView.tsx CodeBlockView.tsx RawBlockView.tsx RawInlineChip.tsx
│   ├── toolbar/ Toolbar.tsx TextStyleMenu.tsx InsertMenu.tsx ColourPopover.tsx LinkPopover.tsx TableGridPicker.tsx TableToolbar.tsx OverflowMenu.tsx ModeToggle.tsx
│   └── source/ SourceView.tsx
├── routes/dev-tools/EditorTab.tsx  # NEW; lazy imports the editor + lazy fixture glob
└── stores/settings.store.ts        # + wikiEditorMode, version 38 migration
```

### Pattern 1: Extend, never duplicate, the Phase 97 schema
**What:** `wikiExtensions` stays the schema source of truth. Export the node/mark consts (`Panel`, `RawBlock`, `RawInline`, ...) from `schema.ts` and build the editor array in `extensions.ts` by replacing entries with `.extend({ addNodeView })`, plus appending UI-only extensions (UndoRedo, Dropcursor/Gapcursor, Placeholder, keymap, input rules).
**Why safe:** `.extend` with `addNodeView`/`addKeyboardShortcuts`/`addInputRules` does not alter the schema spec. Add a vitest `schema parity` test: `getSchema(editorExtensions)` node/mark names, attrs defaults, content expressions, group, and mark order equal `wikiSchema`. Mark order matters (ranks), so keep the original array order and only substitute in place.
**StarterKit-internal nodes** (codeBlock, link, strike): they are inside the single `StarterKit` entry. To add a code-block node view, use `CodeBlock.extend(...)` and `StarterKit.configure({ ...STARTER_KIT_OPTIONS, codeBlock: false })` then insert the extended CodeBlock at the same position; export `STARTER_KIT_OPTIONS` from schema.ts and have the parity test guard order. Alternative with less schema risk: attach the code-block node view through a small extension that `addNodeView` for name `'codeBlock'` is NOT possible (one node, one definition), so the substitution route is required.

```ts
// Source: @tiptap/core v3 Node.extend + @tiptap/react ReactNodeViewRenderer (verified in package source)
import { ReactNodeViewRenderer } from '@tiptap/react';
export const PanelWithView = Panel.extend({
  addNodeView() { return ReactNodeViewRenderer(PanelView); },
});
```
PanelView is a module-scope component using `NodeViewWrapper` + `NodeViewContent` (body is the content hole) and `updateAttributes` for title/type.

### Pattern 2: `useEditor` lifecycle (React Compiler safe)
```tsx
// Source: @tiptap/react 3.34.0 src/useEditor.ts (read from the published tarball)
const editor = useEditor({
  extensions: editorExtensions,      // MODULE-SCOPE const; compared by element identity on every render
  content: initialDoc,               // initial only; never re-fed
  immediatelyRender: true,           // client-only app, no SSR
  shouldRerenderOnTransaction: false,// default; "legacy, will be removed"
  editorProps: { attributes: { class: PROSE_CLASSES } },  // constant
  onUpdate: ({ editor }) => handleUpdate(editor),          // callbacks are not compared; latest is always called
}); // deps omitted => editor created once per mount
```
Facts verified in `useEditor.ts`: with empty deps the editor is created once; on later renders only `setOptions` runs if non-callback options changed (so an inline `extensions` array of *new* objects would re-run setOptions every render, a module constant avoids it); destruction is scheduled two ticks after unmount and cancelled if remounted (StrictMode safe); `shouldRerenderOnTransaction` defaults to `false`. Read toolbar state through `useEditorState({ editor, selector })` (isActive flags, current text style, in-table), never `editor.state` during render (mutable, non-reactive; same class of bug as the "reactive cache-read badge" note). Toggle `editable` with `editor.setEditable(...)` in an effect, never as a deps change (pitfall from the reverted 2026-05-31 build: editor destroyed on `disabled`).

### Pattern 3: Source text and mode transitions (editor-session.ts)
- **Keep the TipTap `Editor` alive across mode switches.** `Editor.unmount()` caches `editorState`, so even unmounting `EditorContent` retains history state [VERIFIED: core Editor.ts:202-216]. Simplest and safest: keep `EditorContent` mounted and hide it with `hidden` while in source mode; `editor.commands.focus()` on return.
- **rich -> source:** compute `res = saveWiki(loaded, current)`. `unchanged` -> `loaded.original` (byte-identical, satisfies "if not dirty show the original string"); `saved` -> `res.text`. `failed` (D-08 decision): show a best-effort **unchecked** `emitWiki(current)` inside try/catch so the user's edit is visible and fixable in source (typical cause: a spelling the engine refuses; the notice carries `reason`). If `emitWiki` throws, fall back to the last safe text (`lastEmitted`) with the notice "the latest edit couldn't be carried over". Never silently drop an edit. This is Claude's discretion per D-08; flag to the user at plan review. [ASSUMED]
- **source -> rich:** `next = loadWiki(sourceText)`. If `sourceText === textAtToggle` do nothing (no tr, no history entry, original string preserved). Else `failed` -> stay in source with the forced-source notice; `rich`/`rich-demoted` -> dispatch the single replace transaction below, then set `loaded = next` and `lastEmitted = sourceText` (do **not** call `onChange` again; the text is already the value).
- **Source mode emission:** the textarea string is the value (`onChange(text)` directly, no engine); the engine only runs on entering rich.
- **Forced source (SAFE-05):** `loadWiki(value).kind === 'failed'` -> mode source, `forcedSource = true`, Rich segment disabled, notice line; saved preference untouched. If the user edits the text in source until it loads cleanly, re-evaluate on every change (debounced ~250 ms) and enable Rich; do not auto-switch.

```ts
// Verified experimentally in this session (vitest, jsdom, new Editor({extensions:[...wikiExtensions, UndoRedo]}))
import { closeHistory } from '@tiptap/pm/history';
export function replaceDoc(editor: Editor, nextJSON: WikiDocJSON) {
  const { state, view } = editor;
  const next = editor.schema.nodeFromJSON(nextJSON);          // editor's schema, not wikiSchema
  const tr = state.tr.replaceWith(0, state.doc.content.size, next.content);
  for (const [k, v] of Object.entries(next.attrs)) {          // doc attrs eol/tail: content replace does not touch them
    if (state.doc.attrs[k] !== v) tr.setDocAttribute(k, v);   // prosemirror-transform 1.12.5 has setDocAttribute
  }
  tr.setMeta('wikiToggle', true);                              // onUpdate ignores it (echo guard)
  view.dispatch(closeHistory(tr));                             // new history group BEFORE
  view.dispatch(closeHistory(editor.state.tr));                // and close AFTER so typing doesn't merge into it
}
```
Experiment result: typed X, toggle, type Y: undo1 -> `plain lfsecond` (Y removed), undo2 -> `Hellobold textX` (toggle reverted incl. `eol/tail` attrs), undo3 -> typing reverted. One toggle = one step.

### Pattern 4: Value binding and the no-op contract
- Props: `value: string`, `onChange(text: string)`. Keep `loadedRef` (WikiLoad), `lastEmittedRef` (string, initial = `value`).
- `onUpdate` (skip if transaction has `wikiToggle` meta): `res = saveWiki(loadedRef.current, editor.state.doc)` (after the schema-identity fix). `unchanged` -> `emit(res.text)` only if `!== lastEmittedRef.current`; `saved` -> `emit(res.text)`; `failed` -> store error state, do **not** call `onChange`.
- External changes: `useEffect(() => { if (value === lastEmittedRef.current) return; apply loadWiki(value) }, [value])`. This is a true external reset (draft restore, refetch), not a per-keystroke `setContent`. Apply with `replaceDoc` and `addToHistory:false` (history cleared), and refresh `loadedRef`. The milestone rule "no `setContent` in effects" is about re-feeding every value change; the echo guard is what makes this effect safe. In source mode the same effect must update the textarea (the 2026-05-31 pitfall: source ignored external changes). Hosts that switch entity (issue key) should remount with `key`.
- Cost: `saveWiki` runs emit + a re-parse check on every transaction. Start synchronous, measure with the largest corpus fixture in the dev tab (verdict panel timing), and add a trailing debounce (~150 ms) plus flush on blur/unmount only if a transaction exceeds roughly one frame. [ASSUMED: threshold]

### Pattern 5: Input rules and IME
- TipTap's InputRule runner bails out during composition (`@tiptap/core/src/InputRule.ts:223 if (view.composing)`), and prosemirror-inputrules does the same (`dist/index.js:93`). [VERIFIED: node_modules] No custom composition code is needed; add a regression test that dispatches a text input with `view.composing = true` and asserts no rule fires. Real IME stays a manual WKWebView check (success criterion 5); Phase 96 already showed Japanese/Pinyin pass in TipTap.
- **Wiki vs markdown conflicts (decide and document):** TipTap defaults conflict with wiki meaning: `*x*` is italic in TipTap's Italic star rule but **bold** in wiki; `# ` is a markdown H1 but a **numbered list** in wiki. Recommended: wiki wins. Disable Italic's `*x*` rule and Bold's rules by configuring `bold:false, italic:false` in a replacement of those marks (`Bold.extend({ addInputRules })`) with: `*x*` and `**x**` -> bold, `_x_` -> italic, `-x-` strike, `+x+` underline, `^x^` sup, `~x~` sub, `{{x}}` mono. `# ` -> ordered list; `h1. `..`h6. ` -> heading (custom `textblockTypeInputRule` with `/^h([1-6])\.\s$/`); `## `..`###### ` keep TipTap's markdown heading rule; `-`/`*`/`+ ` bullet and `1. ` ordered already exist; `{code}` / `{code:lang}` / `{noformat}` typed at line start -> codeBlock (regex `^\{code(?::([a-z]+))?\}$`, `^\{noformat\}$`). Created marks use `open/close = null` (canonical spelling, Phase 97 D-08). [ASSUMED: conflict resolution; confirm with user]
- Keep `listKeymap:false`-style decisions from schema.ts; confirm Backspace at list start and Enter-in-empty-item behaviours in tests.

### Pattern 6: Table keyboard and toolbar
- `Table` keymap already gives: `Tab` -> `goToNextCell`, else `addRowAfter` + `goToNextCell`; `Shift-Tab` -> `goToPreviousCell`; Backspace/Delete delete the table when all cells are selected. [VERIFIED: table.ts:576-594] Do not re-implement; assert in tests.
- Toolbar commands come from the Table extension (`addRowBefore/After`, `addColumnBefore/After`, `deleteRow/Column/Table`, `toggleHeaderRow/Column`, `insertTable({rows, cols, withHeaderRow})`). Header-less tables: Phase 97 uses a `headerless` table attr; `insertTable` creates a header row by default (matches the "header on by default" decision), and `toggleHeaderRow` must be checked against the `headerless` attr (a table whose header row is toggled off by the user should set `headerless: true`; add a test through `saveWiki`). [ASSUMED: toggle/attr interplay needs a test]
- Floating toolbar: controlled `<Popover open={inTable}>` with `<PopoverContent anchor={() => tableDom} side="top" initialFocus={false}>` (portals to body; `anchor` is passed through the wrapper). Buttons use `onMouseDown={e => e.preventDefault()}` so the editor keeps focus. Recompute `tableDom` via `editor.view.nodeDOM(pos)` inside `useEditorState`. [MEDIUM: prototype in Wave 0; fall back to `BubbleMenu` + `getReferencedVirtualElement` + `appendTo: document.body`]

### Pattern 7: Panels, code blocks, colour
- **Panel:** `attrs { type, params, bodyLead, bodyTail }`. Only `params === null` or `title=<non-empty>` is modelled (`parse/panels.ts isPanelParams`); anything else is a rawBlock. Title input maps to `params = title ? 'title=' + title : null`. Sanitise the title: strip `}` and newlines at input time (the opener regex is `\{...:([^}]*)\}`), otherwise `saveWiki` fails closed. Type switch = `updateAttributes({ type })`; "Remove panel" = lift contents (`tr.replaceWith(pos, pos+nodeSize, node.content)`), one undo step. Panel body `content: 'block+'`; nested panels/tables are allowed by schema.
- **Code block:** attrs `language`, `open`, `close`, `bodyLead`, `bodyTail`. `{noformat}` is the same node with `open`/`close = '{noformat}'` and `language = null` (not a separate node). Emit uses `open` only if `codeOpenHolds(open, close, language)`; otherwise canonical `{code:lang}`. Changing language must therefore also reset `open` to `null` (let canonical win). The parser models only `^\{code:([a-z]+)\}$` languages, so **exclude `c#`/`c++` from the language list** and test every option by `parseWiki('{code:LANG}\nx\n{code}')` -> `language === LANG`. Insert "Code block" -> attrs default; "Noformat" -> `open/close '{noformat}'`.
- **Colour:** mark `color { value, open, span }`. Swatch -> `setMark('color', { value })`; remove -> `unsetMark('color')`. Gate with `isSafeColor` (exported from `parse/color.ts`) and render `style` only from the validated value. Off-palette existing values are displayed as "Custom (kept)" and never rewritten. New marks use `open: null` (canonical `{color:x}`). Multi-block `span` marks remain intact because applying a colour creates a fresh mark per inline run.
- **Raw atoms:** `rawBlock`/`rawInline` (`attrs.raw`). The milestone notes call them `rawWiki`; the real names are `rawBlock`/`rawInline`. Block node view renders `<WikiRenderer markdown=...>` read-only inside a dashed frame; "Edit in source" calls the host's `switchToSource({ blockIndex })` (scroll to the corresponding source slice is best-effort; caret mapping is EDIT-F1). Use `selectable: true` (already), `contenteditable=false` on the wrapper, `data-drag-handle` absent.

### Anti-Patterns to Avoid
- **Building `extensions` or node-view components inside render.** Rebuilt editor = lost caret (the reason the earlier build was reverted). Module scope only.
- **Passing `editor.state.doc` straight to `saveWiki` without the schema fix.** Always `saved`; breaks no-op.
- **`tr.setMeta('closeHistory', true)`.** Silent no-op; use the helper.
- **Reading `editor.state`/`editor.isActive` in render.** Non-reactive under React Compiler; use `useEditorState`.
- **Duplicating prose styles.** Extract `lib/wiki/prose.ts`; WikiRenderer and the editor both import it (guard: the new file imports nothing from `editor/`).
- **A bespoke tooltip/keycap.** Reuse `tooltip-body`.
- **Importing `lib/wiki/corpus.fixtures.ts` from dev-tools.** It uses `import.meta.glob(..., { eager: true })` and `routes.tsx` imports dev-tools eagerly (`import DevTools from './dev-tools/index'`), which would pull the whole corpus into the main bundle. Use a lazy `import.meta.glob('.../__fixtures__/**/*.wiki', { query: '?raw', import: 'default' })` inside `EditorTab`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo/redo | custom stack | `UndoRedo` (`@tiptap/extensions`) + `closeHistory` | Grouping, doc-attr invertibility verified |
| Table keyboard nav/cell ops | key handlers | extension-table keymap + commands | Verified built-in, incl. last-cell add row |
| Input-rule composition guard | `compositionstart` flags | built-in `view.composing` check | Verified in core and prosemirror-inputrules |
| Mark/block toggles | manual tr building | `toggleMark`-style TipTap commands | |
| Popovers/menus/tooltips/language select | new overlays | `popover`, `dropdown-menu`, `tooltip`, `searchable-select` | Already portal, themed |
| Colour injection safety | new regex | `isSafeColor` / `COLOR_VALUE` | Phase 97 gate, T-97-27 |
| Round-trip safety | new serializer | `loadWiki`/`saveWiki` | Whole point of Phase 97 |
| Source preview | second renderer | `<WikiRenderer>` | Parity by construction |
| Prose styling | copied class strings | shared `WIKI_PROSE_CLASSES` | EDIT-01 parity |
| Keycap display | custom | existing keycap rendering in `KeyboardShortcutsPanel`/tooltip pattern | |

**Key insight:** every hard correctness problem (round-trip, history grouping, composition, table nav) is already solved by the engine or ProseMirror; the phase's risk is in wiring (schema identity, lifecycle, listeners), not in building primitives.

## Folded Todo: WR-01 / table-cell / WR-02 / IN-01

| Item | Finding | Recommended action |
|------|---------|--------------------|
| **WR-01** (escaped bare URLs) | 97-HUMAN-UAT test 1 is still `[pending]` (needs a real Jira test issue), so the "does Jira keep the backslashes" question cannot be answered by research. | First plan: add a failing test through the real pipeline for `http://a.com/_a_ and _b_` typed in rich and saved; then make the emitter **not escape inside bare URLs** only if UAT says Jira keeps backslashes, otherwise fix the renderer to restore entities in autolinks. Make the UAT a `checkpoint:human-verify` blocking the choice; default to emitter-side no-escape if the user cannot test (safe in both worlds: a literal underscore inside a URL is never emphasis in Jira). [ASSUMED] |
| **Table-cell `{code}`/`{noformat}`** | `parseCell` (`parse/tables.ts`) treats any cell containing `{code`/`{noformat` as raw, escaped or not; `saveWiki` then fails closed. | Make the check escape-aware with the same even/odd backslash-run rule as `preprocess.ts` (line 708 uses `(?<!(?<!\\)(?:\\\\)*\\)`), then verify how the renderer handles `\{code}` in a cell (render a fixture via `wikiToHtml`). Add a table test + save-check test. |
| **WR-02** | `tables.ts:134` uses `(?<!\\)\{(panel|...)` which skips an opener after **any** backslash; `preprocess.ts` treats an even-length run as real. | Replace with the same even-run lookbehind; add a test with `\\{panel}` in a cell. |
| **IN-01** (lookbehind) | `tauri.conf.json` has no `minimumSystemVersion`. Lookbehind regexes already ship in the **main bundle** since 2026-10-05 (`git log -S'(?<![_' -- preprocess.ts/WikiRenderer.tsx` -> 724452e5) and in `services/linkEngine.ts` (2026-11-12). Phase 97 adds no new platform risk. | Close as accepted: document in the plan summary that lookbehind is already relied on by shipped code; no rewrite. Optionally pin `bundle.macOS.minimumSystemVersion` in a later release, not here. WKWebView Safari-16.4-equivalent availability by macOS version is `[ASSUMED]`. |

## Common Pitfalls

### Pitfall 1: Schema instance identity
**What goes wrong:** `saveWiki(loaded, editor.state.doc)` always `saved`. **Why:** `getSchema(extensions)` creates a fresh Schema; `Node.eq` compares `type` by identity. **Avoid:** normalise inside `saveWiki`; unit test: new `Editor` -> `saveWiki(load, editor.state.doc).kind === 'unchanged'`. **Warning sign:** `onChange` fires on focus/blur with an unedited doc.

### Pitfall 2: Doc attributes are not content
**What goes wrong:** replacing the doc content leaves `eol`/`tail` from the old text (CRLF text round-trips as LF, or the reverse). **Avoid:** `tr.setDocAttribute` for each changed attr (verified).

### Pitfall 3: History merging
**What goes wrong:** toggle merges with preceding typing, or following typing merges into the toggle step. **Avoid:** `closeHistory(tr)` before and an empty `closeHistory` tr after; never the string meta.

### Pitfall 4: Wiki vs markdown input-rule conflicts
`*x*`, `# `, `-` rules behave differently between TipTap defaults and wiki semantics; see Pattern 5. Test each shortcut produces the *wiki-canonical* emit (`*bold*`, `# item`).

### Pitfall 5: Shortcut collisions with global app hotkeys (see Shortcut Table)
Cmd+Shift+B (Quote) and Cmd+Shift+M (Toggle source) equal the global Backlog and Merge-requests navigation; they are only safe because react-hotkeys-hook ignores contenteditable/form tags. Pressing Cmd+Shift+M with focus **outside** the editor navigates away. Register editor shortcuts under a new `'Editor'` category and say "while editing" in the description, add `'Editor'` to `KeyboardShortcutsPanel`'s fixed `CATEGORIES` array.

### Pitfall 6: Strike shortcut mismatch
StarterKit Strike binds `Mod-Shift-s`; the UI contract wants `Mod-Shift-x`. Mono (`Mod-e`), sub/sup, link (`Mod-k`), quote (`Mod-Shift-b`) have no defaults for custom marks. Provide one `WikiKeymap` extension (priority above StarterKit) that binds the contract keys and swallows `Mod-Shift-s` (`() => true`) so the editor does not do two things.

### Pitfall 7: React node view + React Compiler
Node-view components must be module-scope; props come from TipTap (`node`, `updateAttributes`, `selected`). Do not close over component state from the parent. Verify the real build compiles them (see Compiler smoke test).

### Pitfall 8: Sticky toolbar scroll
Scroller needs `relative`; frame is `@container` and styles go on an inner wrapper; skeleton must have identical dimensions (toolbar 40px + min-height 160/96px) to avoid layout jump.

### Pitfall 9: Overlay stacking
Popovers inside `isolate` `<main>` sit under the sidebar border unless portaled; `PopoverContent` already portals. A BubbleMenu fallback must set `appendTo: document.body`.

### Pitfall 10: jsdom limits
jsdom lacks layout; ProseMirror calls `getClientRects`/`scrollIntoView` in some paths. Headless `new Editor(...)` worked in this session without polyfills for transaction/undo tests. For `EditorContent` rendering tests, add `Range.prototype.getClientRects/getBoundingClientRect` and `Element.prototype.scrollIntoView` stubs to a test-local setup, not the global one. IME, caret, and layout stay manual.

## Shortcut Table and Collisions (EDIT-04, FLOW-04)

| Action | Key (contract) | TipTap default | Global app hotkey on same chord | Note |
|--------|---------------|----------------|--------------------------------|------|
| Bold | Mod-B | yes | `mod+b` sidebar toggle (`main.tsx:341`) | Safe in editor: react-hotkeys-hook ignores contenteditable and textarea |
| Italic | Mod-I | yes | none (`mod+shift+i` exists, different) | |
| Underline | Mod-U | yes | none | |
| Strikethrough | Mod-Shift-X | no (default `Mod-Shift-s`) | `mod+shift+s` sprint board | Override per Pitfall 6 |
| Monospace | Mod-E | no (`Mod-e` is code, which is disabled here) | none | Custom mark: add binding |
| Link | Mod-K | no | none | |
| Bullet / Numbered | Mod-Shift-8 / 7 | yes | none | |
| Quote | Mod-Shift-B | verify | `mod+shift+b` backlog | Only safe when focus is inside the editor |
| Toggle source | Mod-Shift-M | no | `mod+shift+m` merge requests | Needs its own keydown handler on the **textarea** and the contenteditable; global hotkey is inert in both |
| Undo/Redo | Mod-Z / Mod-Shift-Z | yes (UndoRedo) | none | Textarea keeps native undo |

## FLOW-04 Listener Audit

`react-hotkeys-hook` 5.2.4 drops events where `target.isContentEditable` unless `enableOnContentEditable` is set; a grep of `src` finds no `enableOnContentEditable` usage, so all `useHotkeys` calls (main.tsx navigation, `mod+b`, `mod+slash`, `useListNavigation` j/k/enter, `escape` in CommandPalette/PeekPanel) are already inert while typing. [VERIFIED: dist/index.js:194, grep] Raw listeners:

| File:line | Handler | Contenteditable guard today | Action |
|-----------|---------|-----------------------------|--------|
| `main.tsx:322` | `document` capture Cmd+F / Cmd+Shift+F (find, palette) | none; `preventDefault` on any target | Intentional global (modifier chords, also fires in inputs). Leave; document. Note it intercepts Cmd+F inside the editor by design |
| `main.tsx:680` | `document` capture Escape (fullscreen guard) | none; only `preventDefault` when fullscreen and no overlay | No text effect; leave (Phase 100 will handle Esc-cancel) |
| `useImageViewer.ts:226` | `window` capture; `isEditableTarget` includes `isContentEditable` (line 29) | yes | Verify the guard is applied to every plain-key branch (+, -, 0, f, 1, r, R, arrows); add a test |
| `usePreviewEscape.ts:27` | `window` capture Escape | n/a (Escape closes the topmost overlay, `isComposing` ignored) | Leave |
| `AioTestRunDetailPage.tsx:137` | `window` ArrowLeft/Right | yes (`INPUT`, `TEXTAREA`, `isContentEditable`) | Leave; add regression test |
| `AttachmentPreviewModal.tsx:436` | `document` ArrowLeft/Right navigate + font zoom | **partial**: `isEditable` only wraps the font-zoom keys (+/-/0); arrow navigation is unguarded | **Fix**: skip arrows when `isEditable(e.target)`; add a test (cheap, makes the audit true everywhere) |
| `NotificationList.tsx:248` | React key handler, `closest('input,textarea,[contenteditable="true"]')` | yes (ProseMirror sets `contenteditable="true"`) | Leave; consider `[contenteditable]:not([contenteditable="false"])` |

Add a single shared helper `isTypingTarget(target)` (INPUT/TEXTAREA/SELECT/`isContentEditable`) in `src/lib/` and use it in the three duplicated inline checks; plus one test that dispatches a `keydown` from a `contenteditable` div through each listener. `onKeyDown` React handlers on ancestors were grep-listed (many files); none attach to a prospective editor host in this phase (the editor is only in the dev-tools tab), so the exhaustive audit of React `onKeyDown` handlers belongs to Phase 100 host adoption; note it in the plan.

## Dev-tools Tab and Settings

- **Tab:** `routes/dev-tools/DevToolsPage.tsx` uses `Tabs` with four triggers; add `<TabsTrigger value="editor">Editor</TabsTrigger>` + `<TabsContent value="editor"><EditorTab/></TabsContent>`. DevToolsPage is eagerly imported by `routes.tsx`, so `EditorTab` must `lazy()` the editor and the fixture glob. Update the header subtitle text. `NotificationsTab.test.tsx` shows the existing test pattern.
- **Verdict panel:** compute `loadWiki(text)` (kind + `demoted` indexes as numbered chips) and `saveWiki` output on each `onChange` (also expose `onVerdict`-style callback props or a dev-only `onSaveVerdict` from the editor so the tab can show `unchanged/saved/failed` and timing); render emitted text beside a `<WikiRenderer>` preview.
- **Dev aids worth adding:** `editor.created` counter and `renders` counter (feeds the React Compiler smoke test: must stay 1 while typing), history depth (`undoDepth`), current mode/forced flag.
- **Settings:** add `wikiEditorMode: 'rich' | 'source'` (default `'rich'`) + setter to `initialSettings`, the state interface and actions in `stores/settings.store.ts`; bump persist `version` 37 -> 38 with `if (version < 38) { if (s.wikiEditorMode === undefined) s.wikiEditorMode = 'rich'; }`. The store has no `partialize` (whole state persisted) and `resetSettings` spreads `initialSettings`, so no further wiring. `settings.store.test.ts` asserts the version by reading the source string (`>= 19`); add a case for the new key and the migration default.

## Lazy Chunk and Bundle Guard

- `WikiEditorLazy.tsx`: `const WikiEditor = lazy(() => import('./WikiEditor'))`; `Suspense` fallback = `Skeleton` frame with identical height (toolbar 40 + 160/96 min); an error boundary renders "The editor couldn't load. Reload the page to try again." (spec copy).
- Existing `bundle-guard.test.ts` only walks from `WikiRenderer.tsx`. Extend it: export `collectStaticImports` into a helper module (currently private to the test) and add entries for `routes/dev-tools/index`, `routes/dev-tools/DevToolsPage.tsx`, and `main.tsx`: static graph must contain no `@tiptap/`/`prosemirror` specifier and nothing under `components/wiki-editor/` or `lib/wiki/editor/` except via dynamic `import()` (the walker already ignores dynamic and type-only imports). `lib/wiki/prose.ts` must stay free of those.
- Add a build-level check (script or CI step, not necessarily vitest): `npm run build`, then assert the entry chunk contains no `prosemirror` string and a separate async chunk does (`grep -l prosemirror dist/assets/*.js`). `vite.config.ts` has no `manualChunks`, so dynamic import yields a natural chunk. Run `ANALYZE=true` visualizer once to record the chunk size in the SUMMARY.

## React Compiler Smoke Test

Three layers (all feasible in this repo):
1. **Compiler acceptance (automatable in vitest):** `@babel/core` and `babel-plugin-react-compiler@1.0.0` are installed. A test transforms each `components/wiki-editor/**/*.tsx` file with `babel-plugin-react-compiler` using `panicThreshold: 'all_errors'` and asserts no thrown diagnostics and that output contains `react/compiler-runtime`. This catches mutable-ref-read-in-render and other bail-outs without a full build.
2. **Real build:** `npm run build` (tsc + vite with `reactCompilerPreset`), then open the dev-tools Editor tab with `vite preview` (or `tauri dev`) and check counters: `editor.created === 1` after typing 100 characters, caret position preserved, `renders` of the shell bounded. Chromium is cached locally (`~/Library/Caches/ms-playwright/chromium-1223`) for a scripted check; WKWebView-specific caret/IME stays manual.
3. **Manual WKWebView (success criterion 5):** Japanese `にほん -> 日本`, Pinyin, dead key é in paragraph, list item, table cell; `*bold*`/`# `/`h1. ` rules during composition do not fire; Cmd+Left right after programmatic focus (Phase 96 found the first native Cmd+Left can no-op: bind `Mod-ArrowLeft/Right` explicitly in the keymap if it reproduces). Record in a 98-HUMAN-UAT.md.

## Code Examples

### Typed save wiring
```ts
// Source: engine contract (lib/wiki/editor/types.ts) + verified schema-identity behaviour
function handleUpdate(editor: Editor) {
  const res = saveWiki(loadedRef.current, editor.state.doc); // after engine fix normalises schema
  if (res.kind === 'failed') return setSaveError(res.reason);
  setSaveError(null);
  if (res.text !== lastEmittedRef.current) { lastEmittedRef.current = res.text; onChange(res.text); }
}
```

### Engine fix (schema identity)
```ts
// engine.ts saveWiki: accept a doc from any Schema instance
const cur = current.type.schema === wikiSchema ? current : wikiSchema.nodeFromJSON(current.toJSON());
if (cur.eq(wikiSchema.nodeFromJSON(loaded.doc))) return { kind: 'unchanged', text: loaded.original };
```
(Use `cur` for `emitWiki`/`checkSaved` as well.)

### Floating table toolbar
```tsx
<Popover open={inTable}>
  <PopoverContent anchor={() => tableDom} side="top" initialFocus={false} className="p-1">
    {/* ghost icon buttons; onMouseDown preventDefault; delete table last, destructive */}
  </PopoverContent>
</Popover>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEditor` re-rendering on each transaction | `shouldRerenderOnTransaction` defaults to `false`; use `useEditorState` | TipTap v3 | Required for React Compiler/caret stability |
| `BubbleMenu` from `@tiptap/react` | `@tiptap/react/menus` (floating-ui, optional deps) | TipTap v3 | Import path change if the fallback is used |
| `History` extension | `UndoRedo` in `@tiptap/extensions` (StarterKit option `undoRedo`) | TipTap v3 | Phase 97 has it off; editor adds it |
| `setContent` to swap doc | custom tr + `setDocAttribute` + `closeHistory` | - | Preserves single undo step and doc attrs |

**Deprecated/outdated:** `shouldRerenderOnTransaction: true` is documented in source as "legacy behavior that will be removed"; do not use.

## Runtime State Inventory

Not a rename/migration phase, except the settings key: new persisted key `wikiEditorMode` in the Tauri `settings.json` store (handled by the version-38 migration default). No other stored data, services, OS registrations, env vars or build artifacts are affected. Nothing else found.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-08 failed-save source text = best-effort unchecked `emitWiki(doc)` with fallback to last safe text | Pattern 3 | UX differs from user's intent; confirm at plan review |
| A2 | Wiki wins over markdown in input-rule conflicts (`*x*` bold, `# ` numbered list, `h1.` heading) | Pattern 5 | Users expecting markdown behaviour surprised |
| A3 | `toggleHeaderRow` must map to the `headerless` attr; needs a save test | Pattern 6 | Header-less tables could re-emit an empty `||` row |
| A4 | Jira standard text colour palette and the Jira code-language list (minus `c#`, `c++`) come from training knowledge; exact hexes/names unverified | Pattern 7 | Wrong swatches/languages; mitigated by validating against `isSafeColor` and the parser regex in tests |
| A5 | WR-01 default is emitter-side no-escape inside bare URLs if the UAT cannot be run | Folded todo | Could diverge from Jira if Jira treats `_a_` in URLs as emphasis |
| A6 | Debounce threshold for `saveWiki` per transaction (~1 frame) | Pattern 4 | Typing lag on very large docs |
| A7 | WKWebView lookbehind availability by macOS version | Folded todo IN-01 | None practical; shipped code already relies on it |
| A8 | Popover with `anchor` + `initialFocus={false}` does not steal editor focus | Pattern 6 | Fallback to BubbleMenu |

## Open Questions (RESOLVED)

1. **WR-01 direction (needs a human with Jira access).** Test 1 of 97-HUMAN-UAT is still pending. Recommendation: a `checkpoint:human-verify` at the start of the plan that closes WR-01; default per A5. RESOLVED: 98-02 Task 1 human checkpoint, A5 default if Jira is unavailable.
2. **Per-transaction `saveWiki` cost.** Unmeasured on the largest fixture. Recommendation: measure in the dev tab first; debounce only if needed. RESOLVED: measured in the 98-12 dev tab; 98-11 debounces only if measurement demands it.
3. **Does `Mod-Shift-B` have a TipTap blockquote default?** Not found in a grep of installed extension sources; bind explicitly regardless. RESOLVED: 98-05 keymap binds it explicitly.
4. **Jira palette hexes.** Need either the user's Jira instance render or an accepted constant set; tests will validate any chosen values through `isSafeColor`. RESOLVED: 98-09 `palette.ts` constant set, every entry tested through `isSafeColor`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | yes | 26.13.1 | - |
| npm registry access | install `@tiptap/react` | yes (`npm view` worked) | - | - |
| Chromium (Playwright cache) | scripted compiler smoke check | yes | chromium-1223 | manual dev-tools check |
| `@babel/core`, `babel-plugin-react-compiler` | compiler vitest | yes | installed, compiler 1.0.0 | build-only check |
| WKWebView (`tauri dev`) | IME/caret manual check | yes (macOS dev machine) | system | Swift WKWebView harness from Phase 96 (scratchpad only) |
| `ctx7` CLI / slopcheck | docs / legitimacy | no | - | WebFetch of tiptap.dev; package legitimacy covered by user approval |

**Missing with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1 + jsdom 29 + @testing-library (React Compiler NOT applied in tests) |
| Config file | `taskflow/vitest.config.ts`, setup `src/test/setup.ts` |
| Quick run command | `cd taskflow && npx vitest run src/components/wiki-editor src/lib/wiki/editor` |
| Full suite command | `cd taskflow && npm test` (also the pre-commit gate) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Rich view uses shared prose classes; WikiRenderer imports the same constant | unit | `npx vitest run src/lib/wiki/prose.test.ts` | Wave 0 |
| EDIT-02/03 | Source textarea + live preview; preview toggle; narrow auto-hide | component | `npx vitest run src/components/wiki-editor/source` | Wave 0 |
| EDIT-04 | Keymap binds contract keys; `Mod-Shift-s` swallowed; registry entries exist | unit | `npx vitest run src/components/wiki-editor/keymap.test.ts` | Wave 0 |
| EDIT-05 | Heading/list/quote/rule/hardbreak commands emit wiki-canonical text; `h1.`, `# `, `*x*` rules | unit (headless `Editor`) | `npx vitest run src/components/wiki-editor/input-rules.test.ts` | Wave 0 |
| EDIT-06 | Link set/edit/remove; paste-URL-over-selection | unit | `npx vitest run src/components/wiki-editor/link.test.ts` | Wave 0 |
| EDIT-07 | Marks toggle incl. mono/sub/sup; canonical `open/close=null` | unit | `npx vitest run src/components/wiki-editor/marks-commands.test.ts` | Wave 0 |
| EDIT-08 | One undo reverts a source session incl. doc attrs; typing before/after stays separate; same-text toggle adds no history | unit | `npx vitest run src/components/wiki-editor/editor-session.test.ts` | Wave 0 |
| EDIT-09 | Toolbar presets, overflow order, one row; mode toggle never overflows | component | `npx vitest run src/components/wiki-editor/toolbar` | Wave 0 |
| SAFE-05 | `failed` load opens source, Rich disabled, preference unchanged; editing to valid enables Rich | unit+component | `npx vitest run src/components/wiki-editor/forced-source.test.tsx` | Wave 0 |
| D-04 / no-op | New `Editor` over `loadWiki` doc -> `saveWiki(...).kind === 'unchanged'`; onChange not called until a user transaction | unit | `npx vitest run src/lib/wiki/editor/engine.test.ts` (extend) | exists, extend |
| D-08 | `saveWiki` failed keeps doc, never calls onChange, shows reason + "Fix in source", source text per A1 | component | `npx vitest run src/components/wiki-editor/save-failed.test.tsx` | Wave 0 |
| BLOCK-01 | Insert 6x6 grid; Tab/Shift-Tab/last-cell add row; toggle header keeps `headerless` round-trip | unit | `npx vitest run src/components/wiki-editor/tables.test.ts` | Wave 0 |
| BLOCK-02 | Every language option parses (`language === value`); noformat has none; changing language resets `open` | unit | `npx vitest run src/components/wiki-editor/code-block.test.ts` | Wave 0 |
| BLOCK-03 | Panel title <-> `params`; `}` and newline stripped; type switch; remove panel lifts content; saves | unit | `npx vitest run src/components/wiki-editor/panel.test.ts` | Wave 0 |
| BLOCK-04 | Every palette entry passes `isSafeColor`; off-palette kept; remove colour | unit | `npx vitest run src/components/wiki-editor/colour.test.ts` | Wave 0 |
| Schema parity | `getSchema(editorExtensions)` equals `wikiSchema` (names, attrs, content, marks order) | unit | `npx vitest run src/components/wiki-editor/schema-parity.test.ts` | Wave 0 |
| FLOW-04 | `keydown` from a contenteditable does not trigger the five raw listeners; hotkeys inert | unit | `npx vitest run src/lib/typing-target.test.ts src/routes/dashboard/useImageViewer.test.ts` | Wave 0 / extend |
| Bundle | Static graphs of `main.tsx`, `dev-tools` reach no tiptap/prosemirror | unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts` | exists, extend |
| Compiler | Editor component files compile with `panicThreshold: all_errors` | unit | `npx vitest run src/components/wiki-editor/compiler-compat.test.ts` | Wave 0 |
| Settings | `wikiEditorMode` default/migration v38 | unit | `npx vitest run src/stores/settings.store.test.ts` | exists, extend |
| Folded todos | WR-01 bare URL, table-cell `{code}` escape, WR-02 even-run | unit | `npx vitest run src/lib/wiki/editor` | exists, extend |
| IME / caret / WKWebView | Manual only (jsdom cannot compose or lay out) | manual | 98-HUMAN-UAT.md checklist (Pattern: Compiler layer 3) | Wave 0 |

### Sampling Rate
- **Per task commit:** quick command above (the pre-commit hook also runs the full suite).
- **Per wave merge:** `cd taskflow && npm test && npx tsc --noEmit && npx biome check <changed files>`.
- **Phase gate:** full suite green, `npm run build` succeeds with an async editor chunk, then manual WKWebView UAT.

### Wave 0 Gaps
- [ ] Engine schema-identity fix + test (blocks everything else)
- [ ] `lib/wiki/prose.ts` extraction (+ WikiRenderer import, snapshot unchanged: WikiRenderer pipeline tests already lock output)
- [ ] `components/wiki-editor/` test files listed above; a headless-Editor test helper (`makeEditor(text)`)
- [ ] Extend `bundle-guard.test.ts`; export `collectStaticImports`
- [ ] Settings v38 + test; shortcut registry `'Editor'` category + panel `CATEGORIES`
- [ ] `npm install @tiptap/react@3.34.0 @tiptap/extensions@^3.34.0`

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies. The surface is a local desktop editor handling untrusted Jira text.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | no | - |
| V5 Input Validation | yes | `isSafeColor` for `{color}`; panel title sanitisation (no `}`/newline); link URL validation (allow `http(s):`, `mailto:`; reject `javascript:`); `loadWiki`/`saveWiki` fail-closed |
| V6 Cryptography | no | - |
| V10/V12 Output encoding | yes | Render user text through TipTap's schema (no `innerHTML`); node views render via WikiRenderer (sanitised pipeline); colour only via validated `style` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS injection via `{color:...}` | Tampering | `COLOR_VALUE` gate; unsafe values stay raw atoms (T-97-27); toolbar never writes unvalidated values |
| `javascript:` / data URLs in links | Tampering/Elevation | Validate scheme in the link popover and on paste-linkify; Link mark `openOnClick:false`; external open via the app's existing safe opener |
| Wiki-markup injection through panel title / code language | Tampering | Strip `}` and newlines; language from a fixed list |
| Content corruption via lossy round-trip | Tampering | `saveWiki` fail-closed + forced-source (SAFE-05/D-08) |
| Raw atom XSS | Tampering | Render only through sanitising WikiRenderer pipeline, never `dangerouslySetInnerHTML` |
| Customer data committed in fixtures | Information disclosure | Placeholder-only fixtures; the paste textarea is local and never persisted |

## Sources

### Primary (HIGH confidence)
- Repo code read this session: `lib/wiki/editor/{schema,engine,types,index,emit,parse/*,bundle-guard.test}.ts`, `WikiRenderer.tsx` (prose + callout classes), `main.tsx`, `useImageViewer.ts`, `usePreviewEscape.ts`, `AioTestRunDetailPage.tsx`, `AttachmentPreviewModal.tsx`, `NotificationList.tsx`, `settings.store.ts`, `shortcuts.ts`, `DevToolsPage.tsx`, `routes.tsx`, `components/ui/popover.tsx`, `vite.config.ts`, `vitest.config.ts`.
- `@tiptap/react@3.34.0` published tarball (src: `useEditor.ts`, `NodeViewWrapper.tsx`, `package.json` peer/optional deps) and installed `@tiptap/core`/`extension-table`/`extensions` sources (`InputRule.ts:223`, `Editor.ts:202`, `table.ts:576-594`); `prosemirror-inputrules` `dist/index.js:93`; `prosemirror-history` `closeHistory`; `prosemirror-transform` 1.12.5 `setDocAttribute`; `react-hotkeys-hook` 5.2.4 `dist/index.js:194`.
- Experiments run in this session (vitest, temp files removed, working tree clean): schema-identity `saveWiki` result; single-transaction replace + `setDocAttribute` + `closeHistory` undo behaviour.
- `npm view @tiptap/react` (version, postinstall, peer/optional deps).
- `.planning` docs: 98-CONTEXT, 98-UI-SPEC, 96-SPIKE-FINDINGS, 97-HUMAN-UAT, research SUMMARY/FEATURES.
- git log evidence for lookbehind already in shipped code (`724452e5`, `a1d56862`).

### Secondary (MEDIUM confidence)
- tiptap.dev React install guide (fetched): `useEditor` options, `immediatelyRender`, `useEditorState`, menus at `@tiptap/react/menus`. The performance guide URL returned 404, so performance claims rely on package source instead.

### Tertiary (LOW confidence)
- Jira text palette and code-language list (training knowledge, `[ASSUMED]`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, versions and peer pins verified from the registry tarball and node_modules.
- Architecture: HIGH for session/undo/value-binding (experimentally verified); MEDIUM for table-toolbar-via-Popover (prototype recommended).
- Pitfalls: HIGH, most reproduced or read from source.
- Jira-specific data (palette, languages): LOW.

**Research date:** 2026-11-17
**Valid until:** 2026-12-17 (TipTap 3.x moves quickly; re-check `@tiptap/react` latest before install)
