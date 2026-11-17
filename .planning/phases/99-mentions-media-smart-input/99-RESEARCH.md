# Phase 99: Mentions, Media & Smart Input - Research

**Researched:** 2026-11-17
**Domain:** TipTap 3 / ProseMirror editor input features (suggestions, upload, paste, bubble menu) inside a Tauri macOS WKWebView app
**Confidence:** MEDIUM-HIGH (code and installed-package findings are verified in this session; Jira's pasted-HTML shapes and WKWebView paste/drop behaviour are partly ASSUMED and need the UAT samples)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mentions & issue keys**
- **D-01:** The `@` search covers **assignable users for the issue's project, as today** (`fetchAssignableUsers` in `services/jira/users`, debounced, server-side). It is not widened to all Jira users.
- **D-02:** A mention whose user can't be resolved (deleted, or missing from `useMentionUserMap`) shows as **the same pill, muted, showing the raw username**. It is kept verbatim and never dropped (97 D-10). There is no warning icon.
- **D-03:** Mentions are always emitted as `[~username]` (carried from 97 D-08).
- **D-04:** Issue keys are **decorated only** (ProseMirror decorations matching WikiRenderer's issue-key link look). No markup is written around a key, because Jira auto-links plain keys.

**Images & file uploads**
- **D-05:** Embedded images display **as WikiRenderer shows them**. `|thumbnail` and `|width=` are respected, and otherwise the image is capped to the column width. Clicking an image in the editor selects it and does not open the lightbox.
- **D-06:** **Upload state:**
  - A pasted or dropped file inserts an inline placeholder chip at the caret, with the filename and a spinner. On success it turns into the image or attachment node.
  - On failure the placeholder is removed, and an inline error line under the editor names the file.
  - Uploading never blocks typing.
  - The placeholder must never be emitted into the saved wiki string.
- **D-07:** **Multi-file** paste or drop uploads and embeds **all files, in order** (today only the first is used). Images become `!name!` and other files `[^name]`.
- **D-08:** A **non-image file** is uploaded and inserted as a `[^file]` attachment chip, as Jira does. Generic-MIME images are classified by extension (existing attachments memory).
- **D-09:** **Create flow (staged):** a staged image shows a **real preview from the local file** (blob/data URL, mind the WKWebView blob gotcha) exactly like an uploaded one. It also appears in the existing staged-files strip and uploads on create. The markup keeps its filename so it resolves once uploaded.
- **D-10:** **Removing an embed:**
  - When the user deletes the embed of a file **uploaded in this editing session**, offer a quiet undo-style toast: "Also delete attachment?". Otherwise nothing happens and the attachment stays.
  - Guard: don't offer it if the same file is still referenced elsewhere in the text, or in the issue's description or comments when that is cheaply known.
  - Removing a staged (create-flow) embed leaves the file staged.
- **D-11:** A pasted clipboard image with no filename is named **`image-YYYYMMDD-HHMMSS.png`** (use the real extension for the MIME type).

**Rich & wiki paste**
- **D-12:** Plain-text paste that **clearly contains wiki markup** (`h2. `, `*bold*`, `{code}`, `||` tables …) is **parsed through the Phase 97 parser** into rich nodes. A single undo returns the literal text. Text with no wiki syntax pastes as plain paragraphs. Research defines the "clearly wiki" heuristic and avoids false positives (e.g. a lone `*` or `-`).
- **D-13:** **HTML paste (web/Word) keeps:**
  - structure: headings, lists, quotes, tables, code blocks, rules;
  - inline marks and links;
  - text colour, only when it maps onto the Jira palette through the 97 `{color}` guard;
  - images in the pasted HTML, uploaded as attachments (staged on create).

  Everything else is dropped. Raw HTML never passes through.
- **D-14:** **Jira's own HTML** is mapped back:
  - user-profile links become mentions;
  - `/browse/KEY` links become plain issue keys;
  - emoticon `<img>`s become emoticon nodes;
  - Jira panel markup becomes panel nodes.

  Research collects real paste samples (placeholder-only, no customer data) as fixtures.
- **D-15:** **Cmd+Shift+V** pastes as plain text. Register it in `src/lib/shortcuts.ts` so it shows in the ⌘/ panel.

**Slash menu, emoticons & bubble menu**
- **D-16:** `/` opens the slash menu **at the start of a line or after a space**. It doesn't fire inside URLs or paths (`a/b`). Esc, or a query with no matches, leaves a literal `/`.
- **D-17:** The slash menu lists **every block plus inserts**:
  - the Phase 98 insert-menu items (`insert-items.ts`: table, code, noformat, panel family, rule);
  - text styles (H1–H6, quote, bullet and numbered lists);
  - Mention, Attachment/image and Emoticon.

  It filters as you type and shows recent items first.
- **D-18:** `:` emoticon autocomplete must be **simple and easy to use**, as the user stressed:
  - It opens on `:` plus one letter at the start of a word. It never fires after a digit (`10:30`) or inside a URL (`http:`).
  - It shows a short list with each glyph, its name and its wiki token.
  - Typed tokens such as `:)` and `(y)` keep converting through the existing input rules.
  - Only the Jira emoticon set is offered (`JIRA_EMOTICON_MAP`), with no Unicode emoji.
- **D-19:** The `@`, `/`, `:` and issue-key autocompletes share one **suggestion-popover infrastructure** (caret-anchored, portaled to body, with arrow/Enter/Tab select and Esc dismiss). It must not leak DOM: the 2026-05-31 mention popup did (PITFALLS).
- **D-20:** **Esc nesting:** an open suggestion popover, bubble menu or node-view menu consumes Esc first. A dialog only closes on a later Esc (success criterion 5).

### Claude's Discretion
- **Mention chip look:** the user said to do "whatever looks nicest". The default is the same `mention-badge` pill as WikiRenderer, with the display name from `useMentionUserMap` and the username in a tooltip, so edit and read views match. A small avatar is acceptable only if it renders cleanly inline.
- **Issue-key autocomplete trigger:** the user said "you decide". The default is that typing a known project prefix plus a dash (`ABC-`) opens suggestions with key and summary. Picking one inserts the plain key. Reuse the global-search/command-palette query (server-side, not a fetch-once capped list, per the page-cap memory). A `#` trigger can be added only if it's cheap and doesn't collide.
- **Compact-host UI (INPUT-07):** the user said "you decide". The default is a selection bubble with B/I/U/S, code, link and colour, plus a slim footer row with attach, mention, emoticon and the Rich|Source toggle. This replaces the Phase 98 `compact` toolbar for compact hosts. Don't show the fixed toolbar and the bubble together (anti-feature). The `full` preset keeps its toolbar and gets no bubble.
- **Pasted HTML edge cases:** colour matching rules, and what to do when a remote image can't be fetched (Tauri/CSP). The default is to fall back to a link to the image URL and never block the paste.
- **Source mode:** mention and attachment inserts still work at the textarea caret, reusing the existing textarea logic (FEATURES Source Toggle UX). Pasted files in source mode upload and insert markup the same way.
- **Attachment picker (INPUT-02):** reuse the existing picker from DescriptionEditor/CommentComposer and insert an image or attachment node at the caret.
- Upload placeholder styling, the error-line wording, and the suggestion popover row design (follow PersonPicker and SearchableSelect rows).

### Deferred Ideas (OUT OF SCOPE)
- None new. Host adoption, drafts and Cmd+Enter/Esc stay in Phase 100.
- Reviewed todos not folded: `notifications-highlight-you-mention.md`, `notifications-due-date-overdue.md`, `priority-stripe-rest-rank.md`, `notifications-status-category-colours.md` (unrelated, stay in backlog).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INPUT-01 | `@mention` via server-side search, saved as `[~username]` | `@tiptap/suggestion` 3.34 (`items({query, signal})`, `debounce`), `useAssignableUserSearch` query key/`fetchAssignableUsers`, existing `mention` node emits `[~id]` |
| INPUT-02 | Embed an existing attachment from the picker | `AttachmentPickerModal` (a Dialog, not a popover) + `isImageAttachment`; insert `image`/`attachment` node via the same node attrs the emitter already spells |
| INPUT-03 | Paste/drop image or file uploads (or stages) and embeds | `handlePaste`/`handleDrop` plugin, decoration-based placeholder (NOT a schema node), `uploadAttachment`, host staging contract, `image-YYYYMMDD-HHMMSS.png` naming, `posAtCoords` for drop |
| INPUT-04 | Rich HTML paste keeps supported formatting only | `transformPastedHTML` allowlist normaliser to the schema's own parse tags; verified probe of what the default parser drops/keeps; wiki-text heuristic through `parseWiki`/`loadWiki` |
| INPUT-05 | Issue-key autocomplete and decoration | Suggestion plugin with a custom `findSuggestionMatch` + a `Decoration.inline` plugin; `searchJiraForLink`; class constant extracted from WikiRenderer |
| INPUT-06 | `:` Jira emoticon autocomplete | Suggestion plugin, 16-token set from `JIRA_EMOTICON_TOKENS`/`JIRA_EMOTICON_MAP`; needs a name table and a glyph NodeView |
| INPUT-07 | Bubble menu in compact hosts | `BubbleMenu` from `@tiptap/react/menus` (already installed) with `appendTo: body`; footer row |
| BLOCK-05 | `/` slash menu | Suggestion plugin over `INSERT_ITEMS` + text-style items; single-undo command pattern |
</phase_requirements>

## Summary

Everything in this phase is buildable on the TipTap 3.34 + ProseMirror stack already in the repo. The one new package is `@tiptap/suggestion@3.34.0`, which in 3.34 already supports `debounce`, an `AbortSignal` in `items()`, a `shouldShow`/`allow` gate, a managed `mount()` that portals and repositions the popup, `dismissOnOutsideClick`, and `exitSuggestion()`. One suggestion plugin per trigger (`@`, `/`, `:`, issue key) sharing a single React popover component is the right shape for D-19. `BubbleMenu` for INPUT-07 ships inside `@tiptap/react/menus` and its peer packages are already in `node_modules`; they only need to be declared as direct dependencies.

Research found several places where CONTEXT/UI-SPEC assumptions do not match the code, and the planner must resolve them rather than build on them (see "Contradictions found"). The biggest are: (1) a placeholder chip cannot be a schema node because `schema-parity.test.ts` pins the editor schema to the Phase 97 schema, so it must be a plugin-owned widget decoration; (2) the existing `Color` mark and `Panel` node do not parse from HTML correctly (a probe shows `span[data-color]` yields `value: ""`, and `<img>`/`div.panel` are dropped or flattened), so the HTML normaliser must emit the schema's own canonical parse markup; (3) typed emoticon input rules do not exist in Phase 98 and the emoticon set is only the 16 `(...)` tokens; (4) WikiRenderer does not honour `|width=`/`|thumbnail` (it strips them), so "as WikiRenderer shows them" means the options are ignored for display; (5) the app has no toast library; (6) the "attachment picker" is a modal Dialog.

The riskiest area is the interaction of body-portaled popovers with the Base UI modal Dialog (inert/outside-press) and WKWebView paste/drop. Base UI's Dialog listens for Escape on `document` in the bubble phase (verified in source), so an `event.stopPropagation()` in the editor's keydown handling reliably wins Esc nesting. Clicking a popover portaled outside the dialog element, however, can count as an outside press and the dialog marks outside content inert, so the suggestion popup should mount inside the nearest `[role="dialog"]` when there is one.

**Primary recommendation:** Add `@tiptap/suggestion@3.34.0` (+ declare `@tiptap/extension-bubble-menu` and `@floating-ui/dom`), build ONE `SuggestionPopover` + a `createSuggestion()` factory used by four triggers, drive all host context (project key, search, attachments, upload) through a module-scope-safe `editor.storage` host bridge, keep upload placeholders as plugin-state widget decorations, and implement HTML paste as a `transformPastedHTML` allowlist normaliser that emits the schema's own parse tags, verified by fixture tests that must all end in `saveWiki` kind `saved`.

## Contradictions found (planner must resolve; none block planning)

| # | CONTEXT / UI-SPEC says | Code says | Recommendation |
|---|------------------------|-----------|----------------|
| C1 | D-05: `\|thumbnail` and `\|width=` respected "as WikiRenderer shows them" | `preprocess.ts:944-975` strips image options; `WikiRenderer.tsx:312` renders `AuthImage` with `max-w-full` only. Options are ignored for display. [VERIFIED: codebase] | Parity wins (edit == read): ignore options for display, keep `params` verbatim on the node so they round-trip. Ask user only if they want real width support (would be a WikiRenderer change too). |
| C2 | D-18 / UI-SPEC: typed `:)` and `(y)` "keep converting through the existing input rules" | `input-rules.ts` has NO emoticon rule. Emoticons only arise at parse time (`parse/inline.ts:121`). `JIRA_EMOTICON_TOKENS` has 16 `(…)` tokens, no `:)`/`(y)`. [VERIFIED: codebase] | Add an input rule for the 16 tokens (convert on the closing `)`), cosmetic only (text `(/)` and the node both emit `(/)`). Do NOT invent `:)`/`(y)` nodes: they are not in the token set and would not round-trip. |
| C3 | UI-SPEC: "existing sonner/toast pattern" for the undo-style toast | No toast/sonner dependency exists; `ConnectionsSection.tsx` header says "No toast/sonner — all feedback is inline". [VERIFIED: package.json + grep] | Build the D-10 prompt as an inline notice row inside the editor frame (same slot/styling family as the upload error line), 6s auto-dismiss, one at a time. No new dependency. |
| C4 | UI-SPEC: attachment picker is a popover | `AttachmentPickerModal` is a `Dialog` (`routes/dashboard/issue-detail/AttachmentPickerModal.tsx`). [VERIFIED: codebase] | Reuse the modal as-is (decision: reuse existing picker). It is a Base UI Dialog opened over a possible host dialog; Base UI handles nested Esc. |
| C5 | UI-SPEC: popover error state "Couldn't search people" | `fetchAssignableUsers` swallows errors and returns `[]` (`users.ts:46`). [VERIFIED: codebase] | Error copy is unreachable for mentions unless the service is changed. Show the empty state; do not change the service in this phase. |
| C6 | D-09: image preview from blob/data URL, "mind the blob gotcha" | `AuthImage` already renders `<img src=blobUrl>` in production, so blob URLs work in `<img>`; the blanking gotcha is for iframe/embed PDFs. [VERIFIED: codebase + memory] | Use `URL.createObjectURL` (revoke on cleanup) for staged previews, data: URI only as a fallback. Still include the manual WKWebView check. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `@`/key/emoticon/`/` trigger detection | Browser (ProseMirror plugin) | - | Pure editor-state matching |
| Mention user search, issue search | Jira REST (via `services/jira*`, TanStack cache) | Browser (debounce, abort) | Server-side per query; never fetch-once-capped |
| Suggestion popover render | Browser (React, portaled to body/dialog) | - | Caret-anchored overlay |
| Attachment upload / delete | Jira REST (`uploadAttachment`/`deleteAttachment`) | Host (decides upload vs stage) | Editor only calls a host callback |
| Staged file previews | Browser (object URLs) | Host (owns `stagedFiles`) | No server yet in create flow |
| HTML paste conversion | Browser (`transformPastedHTML` + schema parser) | - | Must produce only schema nodes |
| Wiki-text paste detection/parse | Browser (`lib/wiki/editor` parser) | - | Reuses Phase 97 engine |
| Issue-key decoration | Browser (ProseMirror decoration) | - | No markup written (D-04) |
| Emoticon/mention/image display | Browser (React NodeViews) | Zustand/React Query for user map | Match WikiRenderer |
| Recent slash items | Settings store (persisted) | - | Needs a store migration |
| Source-mode inserts | Browser (textarea logic) | - | Same data sources as rich mode |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/suggestion` | 3.34.0 (npm latest, modified 2026-11-13) | Trigger/match/dismiss plugin for `@`, `/`, `:`, keys | Official TipTap utility; peer-pins `@tiptap/core`/`@tiptap/pm` to 3.34.0 (matches repo); `STACK.md` already lists it [VERIFIED: npm registry, tarball inspected] |
| `@tiptap/react/menus` `BubbleMenu` | 3.34.0 (inside installed `@tiptap/react`) | Floating selection menu (INPUT-07) | Already installed; uses `@floating-ui/dom`; `appendTo` option [VERIFIED: node_modules] |
| `@tiptap/extension-bubble-menu` | 3.34.0 | Peer of `@tiptap/react/menus` (currently only an *optional* dep, present in node_modules) | Declare explicitly so the install is reproducible [VERIFIED: node_modules] |
| `@floating-ui/dom` | ^1.7.6 (already in node_modules transitively) | Caret-anchored positioning for the popover | Peer of suggestion and bubble-menu; declare as a direct dep [VERIFIED: node_modules] |

### Supporting (already in repo, reuse)
| Library | Purpose |
|---------|---------|
| `@tanstack/react-query` (`queryClient.fetchQuery`) | Run server-side searches from the non-React `items()` callback with the same cache keys as `useAssignableUserSearch` |
| `lib/wiki/editor` (`parseWiki`, `loadWiki`, `saveWiki`) | Wiki-text paste parse and save-safety checks in tests |
| `components/ui/cached-avatar`, `person-picker.tsx` row styling | Mention rows |
| `lib/attachment-markup.ts` (`isImageAttachment`, `attachmentRef`, `stagedAttachmentRef`) | Image classification and hazardous-filename handling |
| `routes/dashboard/issue-detail/resolvePreviewKind.ts` | Extension-based image classification for generic MIME (c392b0d7) |
| `prosemirror-history` via `@tiptap/pm/history` (`closeHistory`) | Two-step undo for wiki-text paste |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tiptap/suggestion` | `@tiptap/extension-mention` | It is only a thin Node over suggestion and brings its own `mention` node, which would conflict with the Phase 97 `mention` schema. Use suggestion directly. |
| Own popover + floating-ui | Base UI `Popover` | Base UI Popover moves focus into the popup and runs its own dismiss; the editor must keep DOM focus. Use a plain portaled listbox. |
| In-frame inline notice | Add `sonner` | New dependency + new global mount for one prompt; app convention is inline feedback. |

**Installation (inner `taskflow/taskflow/` dir):**
```bash
npm install @tiptap/suggestion@3.34.0 @tiptap/extension-bubble-menu@3.34.0 @floating-ui/dom@^1.7.6
```

**Version verification:** `npm view @tiptap/suggestion version` returned 3.34.0 (repo https://github.com/ueberdosis/tiptap, same maintainer set as the installed `@tiptap/*`; no `postinstall` script). `@floating-ui/dom` 1.7.6 and `@tiptap/extension-bubble-menu` 3.34.0 are already in `node_modules`. [VERIFIED: npm registry, node_modules]

## Package Legitimacy Audit

slopcheck could not be installed in this environment (`pip3 install slopcheck` produced no binary), so per protocol the new packages are marked `[ASSUMED]` for the install gate even though they are first-party. The planner should add one cheap `checkpoint:human-verify` before `npm install`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tiptap/suggestion` | npm | multi-year (TipTap v1 era) | high (TipTap core family) | github.com/ueberdosis/tiptap | unavailable | Approved in practice, gate with human-verify [ASSUMED] |
| `@tiptap/extension-bubble-menu` | npm | multi-year | high | github.com/ueberdosis/tiptap | unavailable | Already in `node_modules` as optional dep of `@tiptap/react`; declare it [ASSUMED] |
| `@floating-ui/dom` | npm | multi-year | very high | github.com/floating-ui/floating-ui | unavailable | Already installed transitively (via Base UI) [ASSUMED] |

**Packages removed due to slopcheck [SLOP]:** none
**Packages flagged [SUS]:** none (slopcheck unavailable; no postinstall scripts found for `@tiptap/suggestion`)

## Architecture Patterns

### System Architecture Diagram

```
                           keyboard / paste / drop (WKWebView)
                                        │
                         ┌──────────────▼──────────────┐
                         │  ProseMirror view (rich)    │──── Esc: suggestion/bubble/menu
                         │  plugins at module scope    │     consume + stopPropagation
                         └─┬────────┬───────────┬──────┘     (Dialog sees only the next Esc)
        typed trigger      │        │           │
   (@  /  :  KEY-)         │        │paste      │drop (files)
                           │        │           │
           ┌───────────────▼─┐   ┌──▼─────────┐ │      ┌──────────────────────────────┐
           │ createSuggestion│   │handlePaste │ └─────▶│ media plugin                 │
           │ x4 (shared UI)  │   │ 1 files?   │        │  placeholders = widget deco  │
           └───────┬─────────┘   │ 2 html?    │        │  per-file host.uploadFiles() │
   items({query,signal})         │ 3 wiki txt?│        │  or host.stageFile()         │
                   │             └──┬────┬────┘        └──────────┬───────────────────┘
   queryClient.fetchQuery          │    │                        │ success
   (assignable users / issues)     │    │ normalise              ▼
                   │               │    ▼ (allowlist)     insert image/attachment node
          ┌────────▼────────┐      │  schema parse tags   (attrs = what emit.ts spells)
          │ SuggestionPopover│     │    ▼
          │ portal: dialog   │     │  ProseMirror slice ──▶ tr (paste meta)
          │ ancestor ?? body │     ▼
          └────────┬─────────┘   parseWiki/loadWiki ─▶ 2nd tr after closeHistory
                   ▼
           command() → tr: delete trigger range + insert node/block (single undo)
                                        │
                     onUpdate ─▶ evaluateSave (Phase 97) ─▶ onChange(wiki string)
                     (placeholders live in plugin state: never in doc, never emitted)

   host bridge:  WikiEditor ─ editor.storage.wikiHost.current = { projectKey, issueKey,
                 jiraBaseUrl, queryClient, attachments, stagedFiles, uploadFiles, userMap }
   source mode:  SourceView textarea ─ same SuggestionPopover (virtual anchor from caret
                 mirror measurement), same upload callbacks, inserts markup text
```

### Recommended Project Structure
```
src/components/wiki-editor/
├── host.ts                    # WikiEditorHost type + storage bridge + React context
├── suggestion/
│   ├── create-suggestion.ts   # factory: trigger -> Suggestion() plugin using SuggestionPopover
│   ├── SuggestionPopover.tsx  # listbox UI (portal), keyboard, loading/empty, a11y
│   ├── mention-suggestion.ts  # @
│   ├── key-suggestion.ts      # KEY- (custom findSuggestionMatch)
│   ├── emoticon-suggestion.ts # :
│   ├── slash-suggestion.ts    # /
│   └── emoticon-data.ts       # token -> {name, keywords, glyph}
├── media/
│   ├── upload-plugin.ts       # placeholders (decorations), paste/drop, naming, ordering
│   ├── upload-state.ts        # pure: names, classify (ext), mapping helpers
│   ├── embed-removal.ts       # D-10 detection (session-uploaded set, doc scan)
│   └── ImageView.tsx / AttachmentChip nodeview, MentionView.tsx, EmoticonView.tsx
├── paste/
│   ├── html-normalise.ts      # allowlist DOM->DOM normaliser (pure, jsdom-testable)
│   ├── jira-html.ts           # Jira-specific rewrites
│   ├── word-html.ts           # MsoList, mso- cleanup, Docs <b font-weight:normal>
│   ├── wiki-text.ts           # looksLikeWiki() heuristic (pure)
│   └── paste-plugin.ts        # handlePaste/transformPastedHTML, plain-text mode
├── issue-key-decoration.ts    # Decoration.inline plugin (no markup)
├── toolbar/BubbleToolbar.tsx, CompactFooter.tsx
└── __fixtures__/paste/*.html  # placeholder-only samples
src/lib/issue-key.ts           # shared regex + class constant (imported by WikiRenderer)
```

### Pattern 1: One factory, four suggestion plugins, host via editor storage
**What:** Extensions are built once at module scope (EDIT-09; React Compiler hazard), so they cannot close over props. Give a tiny extension `addStorage() { return { host: { current: null } } }`; `WikiEditor` assigns `editor.storage.wikiHost.current` in an effect, and every `items()`/`command()` reads it at call time.
**When to use:** All suggestion sources, the upload plugin, the paste plugin.
**Example:**
```typescript
// Source: @tiptap/suggestion 3.34.0 d.ts (SuggestionOptions) - inspected in this session
Suggestion({
  editor, pluginKey: new PluginKey('wikiMention'),
  char: '@', allowedPrefixes: [' ', '(', '['], startOfLine: false,   // not mid-word (a@b.com)
  debounce: 250,
  items: ({ query, signal }) => host().searchPeople(query, signal),
  shouldShow: ({ editor }) => !editor.isActive('codeBlock'),
  command: ({ editor, range, props }) =>
    editor.chain().focus().insertContentAt(range, [
      { type: 'mention', attrs: { id: props.name, src: null } }, { type: 'text', text: ' ' },
    ]).run(),
  render: () => popoverRenderer(),          // mount() -> portal; onKeyDown stops Esc propagation
});
```

### Pattern 2: Placeholder = plugin-state widget decoration (never a node)
**What:** `schema-parity.test.ts` asserts the editor schema equals `wikiSchema` node-for-node, and `saveWiki`/`checkSaved` would see an unknown node. Keep `{id, pos, name}` in a plugin state, map `pos` through every transaction (`tr.mapping.map(pos, 1)`), render `Decoration.widget(pos, toDOM, { key: id, side: 1, ignoreSelection: true })`. On completion, dispatch `tr.insert(mappedPos, node)` and remove the id.
**Why:** guarantees D-06 "never emitted", survives typing, no schema change, no undo-history noise (use `addToHistory: false` for the state-only transaction).
**Source mode:** no chip; insert the markup at the current caret when the upload resolves.

### Pattern 3: HTML paste as a normaliser that emits the schema's own parse tags
`transformPastedHTML(html)` parses with `DOMParser`, walks an allowlist, and rewrites to the markup the schema's `parseHTML` rules already accept (`span[data-wiki-mention][id]`, `span[data-wiki-emoticon][src]`, `span[data-wiki-image][name]`, `div[data-wiki-panel][type]`, plus StarterKit tags). Then ProseMirror's normal clipboard parser builds the slice. See Pitfalls 1-4 for the verified gaps this has to patch.

### Pattern 4: Single-undo command for slash and trigger selection
`editor.chain().focus().deleteRange(range).<apply block>().run()` is one transaction so one Cmd+Z reverts both (UI-SPEC requirement).

### Pattern 5: Two-step wiki-text paste (D-12)
Dispatch the literal paragraphs as transaction 1; call `closeHistory(tr)` on transaction 2 which replaces that range with the parsed slice. First Cmd+Z returns the literal text, second removes the paste. [ASSUMED: behaviour of `closeHistory` grouping; verify in a test with `undo()` twice]

### Anti-Patterns to Avoid
- **New schema nodes/marks for placeholders or key decoration:** breaks `schema-parity.test.ts` and Phase 97 round-trip.
- **Fetch-once capped page + client filter** for people/issues (repeat bug in memory). Use per-query server search with `signal`.
- **Esc handled only by the popover's own listener in a body portal.** Focus stays in the editor, so handle it in the ProseMirror `onKeyDown` and call `event.stopPropagation()`.
- **`document.createElement` popups appended by hand** (the 2026-05-31 leak). Use the plugin's `mount()` / React portal with cleanup in `onExit`, and assert no residual `[data-suggestion]` nodes.
- **Rebuilding extensions per render** (loses caret).
- **Both bubble menu and fixed toolbar in compact.** Render exactly one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trigger matching, query extraction, decoration, dismiss state, IME guard | A keydown/regex state machine in React | `@tiptap/suggestion` | Handles composition, dismissed ranges, range mapping, outside-click, `exitSuggestion()` |
| Popover positioning/flip/scroll tracking | Manual `getBoundingClientRect` + listeners | `props.mount()` (managed) or `@floating-ui/dom` `computePosition` + `autoUpdate` with `clientRect` | Flip, shift and re-anchor are subtle |
| Selection bubble | Custom selection listener + positioner | `BubbleMenu` (`@tiptap/react/menus`), `appendTo: () => document.body` | Settle delay, hide-on-scroll, virtual element |
| Wiki-text parse for paste | A second parser | `loadWiki`/`parseWiki` (Phase 97) | Same fidelity as load; saved-safety proof |
| HTML sanitising | Regex on HTML strings | `DOMParser` walk with allowlist, then PM schema parse | Schema parse already drops unknown nodes |
| Image-vs-file classification | New MIME table | `isImageAttachment` + `resolvePreviewKind` extension fallback | Fixes generic-MIME (c392b0d7) |
| Hazardous filename handling | New escaping | `attachmentRef`/`stagedAttachmentRef` rules (`! | ]`) | Already tested; image `name` attr must follow the same fallback |
| Auth image loading | `<img src=jiraUrl>` | `AuthImage` / `useAuthBlob` | Jira URLs need a Bearer header |
| Caret pixel position in the source textarea | New measurement | Extract the mirror-div helper from `CommentComposer.tsx:35-72` into a shared util | Already works; Phase 100 deletes that file |

**Key insight:** every hard part of this phase has an existing, tested building block; the work is wiring, plus patching four verified gaps in the Phase 98 node specs.

## Runtime State Inventory

Not a rename/migration phase. One persisted-state addition: "Recent" slash items need a field in `settings.store.ts` (current `version: 38`, so add a `version < 39` migration defaulting it to `[]`). No other stored data, services, OS registrations or env vars are touched. Build artifacts: none.

## Common Pitfalls

### Pitfall 1: `Color` mark does not parse from HTML (verified)
**What goes wrong:** A probe with `__parseFromClipboard` shows `<span data-color="#0052cc">` parses to a `color` mark with `value: ""` (TipTap reads an attribute named `value`, not `data-color`). Emitting `{color:}` would be invalid wiki.
**How to avoid:** In the normaliser emit `<span data-color="X" value="X">` after palette matching, or add `getAttrs` in `extensions.ts`. Test that no saved fixture contains `{color:}`.

### Pitfall 2: `<img>` and Jira `div.panel` are dropped/flattened (verified)
**What goes wrong:** The probe shows `<img>` vanishes and `div.panel > div.panelContent > p` flattens to a bare paragraph.
**How to avoid:** Normaliser rewrites `<img>` (after upload/classification) into `span[data-wiki-image][name]`/link, and panel divs into `div[data-wiki-panel][type=…]` (map `aui-message-info`→info etc., `class=panel`→panel).

### Pitfall 3: Pasted structures the emitter cannot spell make the save fail closed
**What goes wrong:** `emit.ts:525` throws "cannot emit a X inside a table cell"; cells can only hold paragraphs/limited raw blocks; blockquote is one paragraph for `bq.`. HTML tables from Word/web have nested lists, multiple paragraphs, colspan/rowspan, nested tables. The user would see "Couldn't save safely".
**How to avoid:** Flatten cell content to a single inline run joined by hard breaks, strip `colspan/rowspan`, flatten nested tables to text, unwrap block children of cells. Every paste fixture test must assert `saveWiki(...).kind === 'saved'`.

### Pitfall 4: Word and Google Docs HTML shapes
**What goes wrong:** Word lists are `<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">` (not `ul/li`) plus `<!--[if !supportLists]-->` comments and `<o:p>`; Google Docs wraps everything in `<b style="font-weight:normal" id="docs-internal-guid-…">` so naive `b`→bold makes everything bold; marks arrive as `span style="font-weight:700; font-style:italic; text-decoration:underline"`. [ASSUMED: training knowledge; capture real samples in UAT]
**How to avoid:** Normaliser steps: drop conditional comments and `o:*`, convert `mso-list` paragraphs to nested lists by level, treat `font-weight:normal` bold wrappers as transparent, map `style` font-weight>=600/italic/underline/line-through to marks.

### Pitfall 5: Default text colours get captured as `{color}`
**What goes wrong:** Web pages and Word set explicit `color: rgb(0,0,0)` / `windowtext` / white on dark themes; with exact palette matching, every pasted run would become black or white.
**How to avoid:** Normalise `rgb()/hex/named` to lowercase hex; keep only exact `TEXT_PALETTE` matches EXCEPT drop black (`#000000`), white (`#ffffff`) and the dark-grey body default. Do not snap to nearest.

### Pitfall 6: Clipboard carries both HTML and an image
**What goes wrong:** Copying from Word/Excel/Numbers/some pages puts a rendered PNG in `clipboardData.files` alongside `text/html`; treating files first uploads a screenshot instead of pasting text.
**How to avoid:** If `text/html` contains any non-`<img>` content (text), ignore `files`. If the HTML is only an `<img>` (copy image from a page) or there is no HTML, use the files path. [ASSUMED]

### Pitfall 7: Popover portaled outside a modal Dialog
**What goes wrong:** Base UI Dialog marks outside content inert and treats outside pointer events as dismiss. A body-portaled suggestion list can be unclickable or close the dialog on click.
**How to avoid:** Mount target = `editor.view.dom.closest('[role="dialog"]') ?? document.body`; items use `onMouseDown preventDefault`. Escape: Base UI listens on `document` keydown in the bubble phase (`useDismiss.js:404`), so `stopPropagation()` at the editor DOM prevents the dialog close. Test inside a real `Dialog`. If the dialog popup has a CSS transform, check `position:fixed` anchoring (floating-ui handles containing blocks; verify in WKWebView). [VERIFIED: Base UI source; transform behaviour ASSUMED]

### Pitfall 8: Suggestion and IME / mode switch / doc replace
**What goes wrong:** Popup stays after toggling to source, `replaceDoc`/`resetDoc` from an external value change, or editor destroy (leak). Typing during dead-key composition opens/closes it.
**How to avoid:** Call `exitSuggestion(view, key)` for all four keys on mode toggle and `WIKI_TOGGLE_META`; rely on the plugin's `composing` guard; cleanup in `onExit`; test asserts `document.body.querySelector('[data-suggestion]')` is null after destroy.

### Pitfall 9: D-10 removal prompt firing on non-user removals
**What goes wrong:** `replaceDoc`, mode toggle, external `value` reset, and Undo all remove/restore nodes; naive "node disappeared" detection shows the prompt wrongly.
**How to avoid:** Only evaluate transactions that are user edits (`docChanged`, not `WIKI_TOGGLE_META`, not the reset helpers, not `history$` undo/redo); dismiss the notice on undo; check the "session uploaded" set and that no other node/text in the doc references the name.

### Pitfall 10: jsdom has no `ClipboardEvent`; `view.pasteHTML` throws
**What goes wrong:** Tests calling `view.pasteHTML` fail with `ReferenceError: ClipboardEvent is not defined` (hit during this research).
**How to avoid:** Unit-test the pure normaliser and use `__parseFromClipboard(view, text, html, plain, $context)` from `@tiptap/pm/view` (verified to work); for handler tests build a fake `{clipboardData:{getData,files,types}}` as `link.test.ts` does.

### Pitfall 11: Emoticon node displays the raw token in the editor
`extensions.ts` renders `span[data-wiki-emoticon]` with the token text, but WikiRenderer shows the Unicode glyph. Provide a glyph via NodeView/`renderHTML` while keeping `src` the token. `parseHTML` must keep reading `src`.

### Pitfall 12: Cmd+Shift+V on WKWebView
ProseMirror already treats a paste with Shift held as plain text (`view.input.shiftKey && lastKeyCode != 45`, prosemirror-view `index.js:3784`), but whether WKWebView/Tauri's menu fires a `paste` event for Cmd+Shift+V is unverified. [ASSUMED] Treat as a manual UAT item; if no event fires, intercept keydown and read the clipboard through the Tauri clipboard path. Also make the wiki-text heuristic skip when plain mode is active.

### Pitfall 13: Shared drop zone double-handling
The host's `AttachmentsSection` has a section-level drop handler. The editor drop handler must `preventDefault()` + `stopPropagation()` only when `dataTransfer.files.length > 0` (as `DescriptionEditor`/`CommentComposer` do today). With `dragDropEnabled:false` (`tauri.conf.json:18`) DOM drop events arrive. [VERIFIED: config + debug doc]

### Pitfall 14: Staged image references
`stagedAttachmentRef` strips hazardous filename chars, so the node `name` for a staged file must use the same sanitised name that will be uploaded, or the reference will not resolve after create. Two staged files with the same name need a dedupe suffix before embedding.

### Pitfall 15: Existing-attachment name collisions on upload
Jira may rename a duplicate (`image-…(1).png`); embed the name from the upload response (`created[i].filename`), not the local name. Resolve pairing by order of the single-file request, not by name.

## Code Examples

### Suggestion render with managed mount and Esc consumption
```typescript
// Source: @tiptap/suggestion 3.34.0 types (SuggestionProps.mount, SuggestionKeyDownProps)
render: () => {
  let unmount: (() => void) | undefined;
  let root: ReactRenderer | undefined;
  return {
    onStart: (p) => {
      root = new ReactRenderer(SuggestionPopover, { props: toPopoverProps(p), editor: p.editor });
      unmount = p.mount(root.element);          // plugin appends + repositions
      (root.element as HTMLElement).setAttribute('data-suggestion', '');
    },
    onUpdate: (p) => root?.updateProps(toPopoverProps(p)),
    onKeyDown: ({ event }) => {
      if (event.key === 'Escape') { event.stopPropagation(); return true; } // plugin then dispatches exit
      return root?.ref?.onKeyDown(event) ?? false;                          // Up/Down/Enter/Tab
    },
    onExit: () => { unmount?.(); root?.destroy(); },
  };
},
```
Note: pass `container: editorDom.closest('[role="dialog"]') ?? document.body` through the option when available. [CITED: SuggestionOptions.container docs in the installed d.ts]

### Server-side search from a non-React callback
```typescript
// Mirrors useAssignableUserSearch keys so the cache is shared
queryClient.fetchQuery({
  queryKey: ['jira-assignable-users', issueKey ?? projectKey ?? '', jiraBaseUrl, query],
  queryFn: async () => { const t = await readSecret('jira-pat').catch(() => null);
    return t ? fetchAssignableUsers(jiraBaseUrl, t, projectKey, query, { issueKey }) : []; },
  staleTime: 60_000,
});
```
Issue keys: `searchJiraForLink(baseUrl, token, projectKey, query)` (key-aware: a full key matches in any project; returns up to 15, `[]` on error). Do not use `buildSearchIndex` (local GreenHopper snapshot).

### Issue-key match (decoration + trigger share one source)
Extract `/\b[A-Z][A-Z0-9_]+-\d+\b/` and the `text-primary hover:underline` class into `src/lib/issue-key.ts` and import in `WikiRenderer.tsx` (UI-SPEC: "extracted and imported, not copied"). Decorate only prefixes passing `isKnownPrefix(key, activeJiraProject)` semantics, skipping code blocks, `codeBlock`, links and `rawBlock/rawInline`. Trigger: custom `findSuggestionMatch` that matches `(?<![A-Za-z0-9_])PREFIX-\d*$` before the caret.

### Wiki-text heuristic (D-12)
```typescript
// strong signals (any one => wiki): macro openers {code}/{noformat}/{panel}/{info}/{note}/{warning}/{tip}/{quote}/{color:..},
//   ^h[1-6]\.\s, ^\|\|.+\|\|, ^bq\.\s, \[~[\w.\-]+\], \[\^[^\]\n]+\], !\S+!, ^----$
// weak signals (need >= 2 distinct): ^(\*+|#+)\s\S list lines (>=2 consecutive), *word*, _word_, +word+, {{mono}}, [text|url]
// never wiki on its own: a lone '*', '-', '#', a single '*word*', markdown '# Title' / '- item' / '**x**'
const accept = (text) => !plainMode && (strong(text) || weakDistinct(text) >= 2) && loadWiki(text).kind !== 'failed';
```
If `loadWiki` is `rich-demoted`, still accept (raw chips are lossless). Skip when the clipboard also has HTML with block structure (prefer HTML) EXCEPT when HTML is a code-editor wrapper (VS Code adds `vscode-editor-data` type; Jira's edit textarea gives text only). [ASSUMED: clipboard shapes]

### Image/placeholder naming
```typescript
const ts = (d = new Date()) => `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
const ext = { 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp' }[file.type] ?? 'png';
// file.name empty or generic ("image.png" from macOS screenshots is NOT unique) => `image-${ts()}.${ext}`
```
Two clipboard images within one second collide: append `-2`, `-3`.

## Jira rendered-HTML samples (D-14)

No authoritative public source documents the exact markup. Partially verified: user links are `<a class="user-hover user-avatar" rel="username" href="…/secure/ViewProfile.jspa?name=USERNAME">` ([CITED: github.com/xing/jira-bookmarklets test/index.html]). The rest is [ASSUMED] from training and must be confirmed with real samples (placeholder-only):

| Jira output | Map to | Confidence |
|-------------|--------|------------|
| `a.user-hover[rel=USERNAME]` or `ViewProfile.jspa?name=USERNAME` | `mention` id=USERNAME | MEDIUM |
| `a.issue-link[data-issue-key]` / href `…/browse/KEY` | plain text KEY (D-04) | MEDIUM |
| `img.emoticon[alt="(/)"]` (alt is the token) | `emoticon` src=alt if in `JIRA_EMOTICON_TOKENS` | ASSUMED |
| `div.panel > div.panelContent`, `div.panelHeader` | `panel` type panel (title -> params) | ASSUMED |
| `div.aui-message.information-macro` (info/note/warning/tip variants by `aui-message-*`/`icon-*`) | `panel` type info/note/warning/tip | ASSUMED |
| `div.code.panel > div.codeContent > pre.code-LANG` | `codeBlock` language | ASSUMED |
| `div.preformatted.panel pre` | noformat code block | ASSUMED |
| `img[src*="/secure/attachment/ID/NAME"]` or `/secure/thumbnail/…` | If NAME is in the issue's `attachments` list: `image` name=NAME (no re-upload) | ASSUMED (high value) |

Collecting real samples: `GET /rest/api/2/issue/KEY?expand=renderedFields` and `…/comment/ID?expand=renderedBody` return the rendered HTML (`renderedFields.description`, `renderedBody`) [CITED: github.com/arozumenko/sdlc-skills jira-wiki-server.md]. The user (or the planner via a manual step) can paste a rendered body of a throwaway test issue; commit only placeholder text. Word and web samples: create small synthetic fixtures that follow the shapes in Pitfall 4.

Remote `<img src="https://…">`: webview `fetch` is subject to CORS and `connect` is not proxied by `apiFetch` (Jira/GitLab only), so most third-party fetches fail. Convert only `data:` and (if same-origin Jira) attachment URLs into uploads/embeds; for other http(s) images try one `fetch` with a 5s timeout and on any failure insert a plain link to the URL. Never block the paste. `file://` images (Word local) cannot be read: drop silently or link text.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled textarea mention popup (`MentionPopover.tsx`) | `@tiptap/suggestion` + shared popover | v3.34 added managed `mount`, `debounce`, `signal`, `shouldShow` | Remove ~100 lines of pixel math; Phase 100 deletes the old files |
| `tippy.js` popups in TipTap docs | `@floating-ui/dom` + `mount()` | TipTap 3 | No `tippy.js` dependency |
| `BubbleMenu` from `@tiptap/react` | `@tiptap/react/menus` entry | TipTap 3 | Import path differs from v2 docs |

**Deprecated/outdated:** `@tiptap/extension-mention` as the mention node (conflicts with Phase 97 `mention` schema); markdown input rules (excluded by `EDITOR_RULE_OPTIONS`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira DC rendered-HTML class names beyond `user-hover` (issue-link, emoticon alt, panel, aui-message, code panel) | Jira samples | Mapping misses real Jira paste; mitigated by UAT samples and fallthrough to plain paragraphs |
| A2 | Word/Google Docs clipboard HTML shapes (MsoList, `<b font-weight:normal>`, mso- styles) | Pitfall 4 | Lists/bold wrong on Word paste; fixtures are synthetic until real samples exist |
| A3 | Word/Excel put both HTML and a PNG in `clipboardData.files` | Pitfall 6 | Could upload a screenshot instead of pasting text |
| A4 | `closeHistory` between two paste transactions yields two undo steps | Pattern 5 | D-12 "single undo returns the literal text" needs a different mechanism |
| A5 | Cmd+Shift+V fires a `paste` event in Tauri WKWebView | Pitfall 12 | Needs a keydown + clipboard-read fallback |
| A6 | Floating-ui `fixed` anchoring is correct inside a transformed Dialog popup | Pitfall 7 | Popover misplaced inside dialogs; verify in WKWebView |
| A7 | React node views get host React context (portals inside `EditorContent`) | Architecture | Mention/Image views would need props via `editor.storage` instead of context |
| A8 | Remote third-party `fetch` of pasted image URLs fails on CORS | Samples | If it works, more images upload (acceptable) |
| A9 | The three new packages are legitimate | Package audit | slopcheck unavailable; gate with a human-verify checkpoint |
| A10 | `|`-containing or very long pasted wiki > some size needs no cap | Wiki heuristic | Large paste parse cost; measure with a 50KB fixture |

## Open Questions

1. **Image width/thumbnail display (C1).**
   - Known: WikiRenderer ignores options; D-05 says they are respected.
   - Recommendation: parity (ignore, keep `params` verbatim). Confirm with the user in plan review; supporting width means touching WikiRenderer too.
2. **Undo-offer UI without a toast library (C3).**
   - Recommendation: inline notice row in the frame (no dependency). Alternative is adding `sonner`.
3. **Real Jira/Word paste samples.**
   - Recommendation: plan a Wave 1 task to build synthetic fixtures + a UAT step where the user pastes from real Jira/Word into the dev-tools tab; the "Paste sample" select doubles as the capture harness.
4. **Where does `host` data (issue key, project key, attachments, upload) come from before Phase 100?**
   - Recommendation: add an optional `host?: WikiEditorHost` prop on `WikiEditorProps` (types-only, bundle-guard safe) and wire it from the dev-tools "Host context" row; Phase 100 passes real values.
5. **Issue-key trigger source for projects other than the active one.**
   - Recommendation: known prefix = `activeJiraProject` plus the host `projectKey`; `searchJiraForLink` already resolves a full key in any project.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm | install, vitest | yes | (repo toolchain) | - |
| vitest + jsdom | all automated tests | yes | vitest 4.1.0 | - |
| Real WKWebView app build | drag/drop, caret, Cmd+Shift+V, popover-in-dialog UAT | needs the user's machine | - | Manual UAT checklist (success criterion 5) |
| slopcheck | package audit | no | - | `checkpoint:human-verify` before install |
| Real Jira rendered HTML samples | D-14 fixtures | not accessible to research | - | Synthetic placeholder fixtures + UAT capture |

**Missing with no fallback:** none. **Missing with fallback:** slopcheck, real samples.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0, jsdom, `globals: true`, setup `src/test/setup.ts` |
| Config file | `taskflow/taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/components/wiki-editor src/lib/wiki` |
| Full suite command | `cd taskflow && npm test` (also the pre-commit gate; RED and GREEN in one commit) |

Existing helpers: `test-utils.ts` (`makeEditor`, `typeText`, `saveText`, auto-destroy), `shell-test-utils.tsx` (`renderEditor`, `liveEditor`, layout stubs), `Range.getClientRects` stubs (needed for suggestion/bubble in jsdom).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INPUT-01 | `@` after space opens; not mid-word; select inserts mention + space; save emits `[~name]`; unresolved shows raw username | unit + component | `npx vitest run src/components/wiki-editor/suggestion/mention.test.ts` | No - Wave 0 |
| INPUT-01 | search is per-query (abort + fetchQuery key), not client filter | unit | `npx vitest run src/components/wiki-editor/suggestion/mention-search.test.ts` | No - Wave 0 |
| INPUT-02 | picker select inserts `image` (image MIME/ext) or `attachment` node, caret after; hazardous names use content URL | unit | `npx vitest run src/components/wiki-editor/media/embed.test.ts` | No - Wave 0 |
| INPUT-03 | multi-file paste: ordered placeholders, resolve out of order, failure removes chip + error line; placeholder never in `saveWiki` output; staged mode embeds without upload; clipboard naming; ext classification | unit | `npx vitest run src/components/wiki-editor/media/upload-plugin.test.ts` | No - Wave 0 |
| INPUT-03 | D-10 notice only for session uploads, not on resetDoc/toggle/undo, guarded by other references | unit | `npx vitest run src/components/wiki-editor/media/embed-removal.test.ts` | No - Wave 0 |
| INPUT-03 | drop uses `posAtCoords`, stops propagation only with files | unit | same file as upload-plugin | No - Wave 0 |
| INPUT-04 | normaliser fixtures (web, Word, Google Docs, Jira) -> allowed nodes only, every result `saveWiki` kind `saved`; colour palette rules; table flattening; no raw HTML | unit | `npx vitest run src/components/wiki-editor/paste/html-normalise.test.ts` | No - Wave 0 |
| INPUT-04 | wiki-text heuristic true/false table incl. lone `*`, `-`, markdown `# x`; parse to nodes; double-undo; plain mode (Shift) skips | unit | `npx vitest run src/components/wiki-editor/paste/wiki-text.test.ts` | No - Wave 0 |
| INPUT-04 | Cmd+Shift+V registered in `shortcuts.ts` | unit | `npx vitest run src/lib/shortcuts` | partial (registry tests exist) |
| INPUT-05 | decoration on known-prefix keys, none in code/link/raw; no markup in emitted text; trigger `ABC-`; not after a letter | unit | `npx vitest run src/components/wiki-editor/issue-key.test.ts` | No - Wave 0 |
| INPUT-06 | `:`+letter at word start only; not `10:30`, not `http:`, not code; no-match closes silently; select replaces with emoticon node, emits token; token-input rule | unit | `npx vitest run src/components/wiki-editor/suggestion/emoticon.test.ts` | No - Wave 0 |
| INPUT-07 | compact renders bubble+footer and not the toolbar; full unchanged; hides in code block / while suggestion open; Esc hides first | component | `npx vitest run src/components/wiki-editor/toolbar/compact.test.tsx` | No - Wave 0 |
| BLOCK-05 | `/` line start/after space only, not `a/b`; filter; Recent; every INSERT_ITEMS + text styles present; one undo reverts delete+apply; no match leaves `/` | unit | `npx vitest run src/components/wiki-editor/suggestion/slash.test.ts` | No - Wave 0 |
| D-19/D-20 | popover removed on destroy/mode switch/doc replace (`[data-suggestion]` absent); Esc consumed before an enclosing Dialog (render editor inside a real Base UI `Dialog`, press Esc once -> dialog still open, twice -> closed) | component | `npx vitest run src/components/wiki-editor/suggestion/lifecycle.test.tsx` | No - Wave 0 |
| Guards | `schema-parity.test.ts`, `bundle-guard.test.ts`, `compiler-compat.test.ts` stay green; `@tiptap/suggestion` only reachable from the lazy editor chunk | unit | `npx vitest run src/components/wiki-editor/schema-parity.test.ts src/lib/wiki/editor/bundle-guard.test.ts` | Yes |
| Manual | WKWebView: Finder drag/drop, clipboard image paste, caret after insert, Cmd+Shift+V, popover inside a modal, blob preview, Esc nesting | manual UAT | dev-tools "Editor" tab checklist | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/wiki-editor src/lib/wiki` (plus `npx biome check` on touched files)
- **Per wave merge:** `npm test` plus `npx tsc --noEmit`
- **Phase gate:** full suite green; manual WKWebView UAT recorded in `99-HUMAN-UAT.md`

### Wave 0 Gaps
- [ ] `src/components/wiki-editor/suggestion/*.test.*` (mention, emoticon, slash, lifecycle, popover keyboard)
- [ ] `src/components/wiki-editor/media/*.test.ts` (upload plugin, embed, removal)
- [ ] `src/components/wiki-editor/paste/*.test.ts` and `__fixtures__/paste/*.html` (placeholder-only web, Word, Google Docs, Jira)
- [ ] `src/components/wiki-editor/issue-key.test.ts`, `toolbar/compact.test.tsx`
- [ ] Test util: stub `ClipboardEvent` or fake clipboard events; `Range.getClientRects` stubs already in `installLayoutStubs`
- [ ] Framework install: none (vitest present); dependency install: `@tiptap/suggestion` + declared peers

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | PAT read via `readSecret` inside query functions only; never in query keys |
| V3 Session Management | no | - |
| V4 Access Control | no | Jira enforces assignable-user and attachment permissions |
| V5 Input Validation | yes | Paste: DOMParser allowlist then schema parse; `isSafeLinkUrl` for hrefs; `isSafeColor` + palette for colour; hazardous-filename rules; never insert raw HTML (WikiRenderer sanitize guard test must stay green) |
| V6 Cryptography | no | - |
| V12 Files | yes | Upload names sanitised via existing helpers; size/type errors surface as the error line |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Script/event-handler/style injection through pasted HTML | Tampering/EoP | Allowlist normaliser drops all attributes except the explicit ones it re-emits; PM schema rejects unknown nodes; no `innerHTML` of clipboard content outside the sandboxed `DOMParser` |
| `javascript:`/`data:` link hrefs from paste | Tampering | Reuse `isSafeLinkUrl`; keep only http(s)/mailto |
| Third-party image fetch leaks IP/referrer | Info disclosure | Do not auto-fetch remote images except the bounded fallback; default to a link |
| Mention/attachment text breaking out of markup delimiters | Tampering | `[~id]` id taken from Jira's username; `attachmentRef` hazard rules for names |
| Secret in cache key | Info disclosure | PAT only inside `queryFn`, matching `useAssignableUserSearch` |

## Project Constraints (from CLAUDE.md and memory)

No `CLAUDE.md` exists in the repo root or `taskflow/` (checked). Directives come from project memory, treated as locked:
- Repo layout: `.planning`/git at outer `taskflow/`; `src`, npm, vitest, biome in inner `taskflow/taskflow/`.
- Pre-commit hook runs the full vitest suite: commit RED and GREEN together. Biome blocks commits; never `biome --write` over all of `src`; never hardcode a biome baseline count.
- React Compiler runs in the app but not in vitest: extensions at module scope, no hidden module-level reads in render (see `compiler-compat.test.ts`).
- Overlays inside `<main>` (`isolate`) must be portaled to body (or the dialog); use `usePreviewEscape` pattern for custom overlays; Base UI collision shift can nudge tall popups.
- Server-side search only, no fetch-once-capped page filtered client-side.
- Shared `PersonPicker` / `use-assignable-user-search` row and query conventions for mentions; `CachedAvatar` explicit px sizing.
- jira.ts legacy file: `searchJiraForLink` lives in `services/jira.ts`; edit that file, not `jira/` modules, if a change is needed.
- Fixtures placeholder-only (no customer data). New persisted settings need a store migration and version bump.
- Tailwind v4: `@container` variants never style the container itself; `space-y` vs negative margin; `not-sr-only` resets truncate; italic needs `pr-0.5` under `truncate`.
- WKWebView: no blob in iframe/embed, no `::highlight` on flex/grid/button; verify caret/focus on a real build (Phase 98 UAT: focus after node-view menus).
- Scrutinise executor deviations; verify scripted edits; prove each regression test fails pre-fix.
- Shortcut registry: add `editor-paste-plain` (`editor:⌘⇧V`, category `Editor`) to `src/lib/shortcuts.ts`; informational rows for `@`, `/`, `:` per UI-SPEC.

## Sources

### Primary (HIGH confidence)
- Installed packages inspected in this session: `@tiptap/suggestion@3.34.0` tarball (`dist/index.d.ts`, `dist/index.js` for `SuggestionOptions`, `mount`, Esc handling), `@tiptap/extension-bubble-menu` (`dist/index.js`, `appendTo`, `hide` meta), `@tiptap/react/menus` d.ts, `@base-ui/react@1.3.0` `useDismiss.js` (document-level Escape, bubble phase), `prosemirror-view` (`shiftKey` plain paste, `posAtCoords`).
- Repo code: `wiki-editor/*`, `lib/wiki/editor/schema.ts|emit.ts|save-check.ts`, `lib/wiki/preprocess.ts`, `WikiRenderer.tsx`, `CommentComposer.tsx`, `DescriptionEditor.tsx`, `AttachmentPickerModal.tsx`, `services/jira/users.ts|attachments.ts`, `services/jira.ts:1609`, `use-assignable-user-search.ts`, `lib/shortcuts.ts`, `settings.store.ts`, `tauri.conf.json`, debug doc `attachments-dnd-preview.md`.
- Executed probe (temp test, deleted): `__parseFromClipboard` over a sample HTML showing the Color/img/panel gaps.
- npm registry: `npm view @tiptap/suggestion` (version, repo, maintainers, no postinstall).

### Secondary (MEDIUM confidence)
- github.com/xing/jira-bookmarklets `test/index.html` (real Jira `user-hover` markup).
- github.com/arozumenko/sdlc-skills `jira-wiki-server.md` (`renderedBody`, `renderedFields` expansion).

### Tertiary (LOW confidence)
- Word/Google Docs/Jira macro HTML shapes and clipboard behaviours (training knowledge, ASSUMED; see Assumptions Log).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, packages and APIs inspected in `node_modules`/tarball.
- Architecture: HIGH for suggestion/bubble/placeholder-decoration/host-bridge; MEDIUM for popover-inside-dialog and `closeHistory` behaviour.
- Pitfalls: HIGH for the verified code gaps (C1-C6, Pitfalls 1-3, 7, 10); MEDIUM-LOW for clipboard/Word/Jira shapes (need real samples).

**Research date:** 2026-11-17
**Valid until:** 2026-12-17 (TipTap 3 is moving; re-check `@tiptap/suggestion` if the minor changes before implementation)
