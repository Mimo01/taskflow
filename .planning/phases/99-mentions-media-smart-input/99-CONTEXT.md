# Phase 99: Mentions, Media & Smart Input - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds the input features of the shared `<WikiEditor>` (Phase 98) on top of its existing schema nodes (`mention`, `image`, `attachment`, `emoticon`):

- `@` mentions with server-side search, saved as `[~username]` (INPUT-01);
- embedding an existing attachment from the picker (INPUT-02);
- paste or drop of images and files that upload, or stage on create, and embed (INPUT-03);
- rich HTML paste from web, Word and Jira, mapped to supported nodes (INPUT-04);
- issue-key autocomplete and decoration (INPUT-05);
- `:` Jira emoticon autocomplete (INPUT-06);
- a floating selection (bubble) menu for compact hosts (INPUT-07);
- the `/` slash menu (BLOCK-05).

Popovers inside dialogs must close with Esc before the dialog does. A manual WKWebView drag/drop and caret check is required (success criterion 5).

As in Phase 98, everything is exercised in the dev-tools "Editor" tab. Host adoption, drafts, dirty guards and Cmd+Enter/Esc submit/cancel belong to Phase 100. Hosts are not swapped here.

</domain>

<decisions>
## Implementation Decisions

### Mentions & issue keys
- **D-01:** The `@` search covers **assignable users for the issue's project, as today** (`fetchAssignableUsers` in `services/jira/users`, debounced, server-side). It is not widened to all Jira users.
- **D-02:** A mention whose user can't be resolved (deleted, or missing from `useMentionUserMap`) shows as **the same pill, muted, showing the raw username**. It is kept verbatim and never dropped (97 D-10). There is no warning icon.
- **D-03:** Mentions are always emitted as `[~username]` (carried from 97 D-08).
- **D-04:** Issue keys are **decorated only** (ProseMirror decorations matching WikiRenderer's issue-key link look). No markup is written around a key, because Jira auto-links plain keys.

### Images & file uploads
- **D-05:** Embedded images display **as WikiRenderer shows them**. Parity with WikiRenderer (which ignores `|thumbnail` and `|width=`): images are capped to the column width, and the params are kept verbatim on the node and on save. *(Amended 2026-11-17 at planning: research showed WikiRenderer ignores these params; user chose parity.)* Clicking an image in the editor selects it and does not open the lightbox.
- **D-06:** **Upload state:**
  - A pasted or dropped file inserts an inline placeholder chip at the caret, with the filename and a spinner. On success it turns into the image or attachment node.
  - On failure the placeholder is removed, and an inline error line under the editor names the file.
  - Uploading never blocks typing.
  - The placeholder must never be emitted into the saved wiki string.
- **D-07:** **Multi-file** paste or drop uploads and embeds **all files, in order** (today only the first is used). Images become `!name!` and other files `[^name]`.
- **D-08:** A **non-image file** is uploaded and inserted as a `[^file]` attachment chip, as Jira does. Generic-MIME images are classified by extension (existing attachments memory).
- **D-09:** **Create flow (staged):** a staged image shows a **real preview from the local file** (blob/data URL, mind the WKWebView blob gotcha) exactly like an uploaded one. It also appears in the existing staged-files strip and uploads on create. The markup keeps its filename so it resolves once uploaded.
- **D-10:** **Removing an embed:**
  - When the user deletes the embed of a file **uploaded in this editing session**, offer a quiet **inline notice row** in the editor footer: "Also delete attachment?" with a delete action, dismissible. *(Amended 2026-11-17 at planning: the app has no toast library; user chose an inline notice over adding sonner.)* Otherwise nothing happens and the attachment stays.
  - Guard: don't offer it if the same file is still referenced elsewhere in the text, or in the issue's description or comments when that is cheaply known.
  - Removing a staged (create-flow) embed leaves the file staged.
- **D-11:** A pasted clipboard image with no filename is named **`image-YYYYMMDD-HHMMSS.png`** (use the real extension for the MIME type).

### Rich & wiki paste
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

### Slash menu, emoticons & bubble menu
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Editor shell (Phase 98 output this phase extends)
- `.planning/phases/98-editor-shell/98-CONTEXT.md`: toolbar presets (D-03), insert-menu reuse, portaled overlays, the dev-tools Editor tab as the UAT surface.
- `.planning/phases/98-editor-shell/98-HUMAN-UAT.md`: WKWebView findings from the shell UAT (focus after node-view menus, sticky toolbar).
- `taskflow/src/components/wiki-editor/WikiEditor.tsx`, `rich-extensions.ts`, `insert-items.ts`, `input-rules.ts`, `link-paste.ts`, `toolbar/*`, `nodeviews/*`: the shell to extend.
- `taskflow/src/lib/wiki/editor/schema.ts`: the existing `emoticon`, `mention`, `image` and `attachment` node specs. Their attributes must round-trip.
- `taskflow/src/lib/wiki/editor/bundle-guard.test.ts`: the editor chunk stays lazy.

### Engine
- `.planning/phases/97-round-trip-engine/97-CONTEXT.md`: D-08 (canonical forms for new nodes, `[~username]`), D-09 (image atom keeps its raw params), D-10 (missing attachments and unknown users stay as their own atoms).

### Milestone research
- `.planning/research/FEATURES.md`: table-stakes rows for mentions (L36), issue keys (L37), attachments (L38), image paste/drop (L39), emoticons (L40), paste handling (L43), slash menu (L57), bubble menu (L58), Cmd+Shift+V (L69), anti-features (L86–L92), source-toggle UX (L96–L103).
- `.planning/research/PITFALLS.md`: the leaking mention popup and lifecycle rules from the reverted 2026-05-31 build.
- `.planning/research/SUMMARY.md` and `ARCHITECTURE.md`: React Compiler/TipTap lifecycle rules and NodeView rendering.
- `.planning/research/STACK.md`: the allowed packages (`@tiptap/suggestion` is fine if listed; no Pro extensions).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md`: INPUT-01..07, BLOCK-05.
- `.planning/ROADMAP.md` §Phase 99: success criteria 1–5. Research is flagged: rich HTML paste samples and the Tauri drop path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `routes/dashboard/MentionPopover.tsx` and `hooks/useMentionUserMap.ts`: today's mention search (debounced `fetchAssignableUsers`) and the username→display-name map. Port the search, and replace the textarea pixel math with caret anchoring.
- `routes/dashboard/CommentComposer.tsx` and `DescriptionEditor.tsx`: the existing paste/drop upload mutation (`attachmentRef`, `insertRef`, `stopPropagation` against the AttachmentsSection drop handler), the staged-files strip (`stagedFiles`, `onRemoveStagedFile`) and the attachment picker.
- `lib/attachment-markup.ts`: builds `!file!` and `[^file]` references. `lib/internalLinks.ts`: Jira URL and issue-key handling for paste mapping and decoration.
- `routes/dashboard/WikiRenderer.tsx`: the `mention-badge` pill, issue-key link styling, emoticon rendering and `JIRA_EMOTICON_MAP`, which is the look to match in the editor.
- `components/ui/person-picker.tsx` and `searchable-select.tsx`: row styling for suggestion popovers.

### Established Patterns
- Tauri `dragDropEnabled: false` (`src-tauri/tauri.conf.json:18`), so DOM drop events reach the webview. Verify drop on a real WKWebView build.
- Use data: URIs rather than blob: URLs where WKWebView blanks (PDF memory). Check that image previews from blob URLs render in `<img>`.
- Overlays inside the `isolate` `<main>` portal to body. Base UI popups get a collision shift.
- Fetch suggestions server-side per query, never one capped page filtered client-side.
- React Compiler runs in the app, not in vitest. Create extensions once at module scope, with no module-level mutable reads in render.
- The pre-commit hook runs the full vitest suite, so RED and GREEN go in one commit. Fixtures are placeholder-only.

### Integration Points
- The `<WikiEditor>` props must gain an upload/staging contract (an `onUploadFiles` callback that returns created attachments, or a staged mode) and the issue/project context for mentions and keys. Phase 100 hosts wire these up.
- `src/lib/shortcuts.ts`: Cmd+Shift+V and any new editor shortcuts.

</code_context>

<specifics>
## Specific Ideas

- Emoticon autocomplete: "simple and easy to use". Few keystrokes, few false triggers, a short readable list.
- Mentions look the same in the editor as in the read view.
- Deleting an embed of a just-uploaded file should offer cleanup without nagging. Only files from this session get the offer.

</specifics>

<deferred>
## Deferred Ideas

- None new. Host adoption, drafts and Cmd+Enter/Esc stay in Phase 100.

### Reviewed Todos (not folded)
- `notifications-highlight-you-mention.md`, `notifications-due-date-overdue.md`, `priority-stripe-rest-rank.md` and `notifications-status-category-colours.md` matched only on generic keywords. As in Phase 98, they are unrelated and stay in the backlog.

</deferred>

---

*Phase: 99-mentions-media-smart-input*
*Context gathered: 2026-11-17*
