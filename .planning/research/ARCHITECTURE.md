# Architecture Patterns

**Domain:** Shared WYSIWYG + source-toggle Jira wiki editor, integrated into an existing wiki renderer
**Milestone:** v1.15 Rich Wiki Editor
**Researched:** 2026-11-16
**Overall confidence:** MEDIUM-HIGH (codebase facts HIGH; TipTap API details not re-verified this pass, see Gaps)

## Verdict

Choose **option (c): a hybrid of (a) and (b)**.

- **Parse (load) path:** reuse the renderer's own pipeline, extracted into a pure shared module. Do NOT write a second wiki parser, and do NOT use `jira2md.md_to_html` (marked) the way the reverted attempt did.
- **Serialize (save) path:** a bespoke, deliberately *canonical-subset* ProseMirror-JSON to wiki emitter. Wiki is emitted only in forms the renderer's pipeline is known to handle.
- **Safety net:** (1) the fixture-corpus equivalence harness in CI, and (2) a cheap runtime equivalence guard at load, with raw-atom fallback and no-op-save byte preservation.

Why not pure (b), a dedicated bidirectional AST parser: WikiRenderer's ~1800 LOC are a pile of Jira-parity preprocessing hacks (table merging, panel-in-list, code-body placeholders, bold/italic fixes, entity decoding). A second parser would have to re-derive all of them and would drift from the renderer. Parity with the renderer is the guarantee, so the renderer pipeline must BE the parser.

Why not pure (a): the existing (a) idea only covers load. Save is the hard half and has no pipeline to reuse. The reverted attempt's `jiraWikiSerializer.ts` (400 LOC, a walker over TipTap JSON) was the right shape for save.

**Evidence for the load-path warning.** The reverted `jiraToTiptap.ts` ran `preprocessJiraMarkup` then `j2m.to_markdown` then `j2m.md_to_html` (marked). WikiRenderer instead runs remark-parse + remark-gfm + remark-breaks + rehype-raw + custom rehype plugins. Two different markdown parsers over the same markdown means the editor's doc is not what the renderer shows (GFM tables, breaks, autolinks, nested lists all differ). It also kept a private copy of `fixMarkdownLinkUnderscores`. The reason for the revert is unrecorded, so it cannot be named as the cause, but this divergence is the structural weakness to design out. I could not confirm the revert reason from git history or memory notes.

## Recommended Architecture

```
                 wiki string (storage format, unchanged)
                          |
   +----------------------+-----------------------------+
   |  NEW lib/wiki/  (pure, no React, no stores)         |
   |                                                     |
   |  preprocessJiraMarkup  (MOVED from WikiRenderer)    |
   |  wikiToMarkdown(wiki, {attachments, users})         |  <- extracted body of the
   |       = preprocess + j2m.to_markdown                |     current useMemo-less block
   |         + fixMarkdownLinkUnderscores                |     (WikiRenderer.tsx:1524-1535)
   |         + CODEBODY restore                          |
   |  wikiToHast / wikiToHtml(wiki, opts)                |  <- unified().use(remarkParse,
   |       = unified chain with the SAME plugins list    |     remarkGfm, remarkBreaks,
   |         WikiRenderer uses (shared constant)         |     remarkRehype, rehypeRaw, ...)
   |  wikiRenderPlugins  (exported array, one source)    |
   +----------------------+-----------------------------+
         |                              |
         v                              v
  WikiRenderer.tsx               NEW components/wiki-editor/
  (react-markdown consumes       |
   the same plugin array;        |  wikiToDoc(wiki)      HTML -> generateJSON(schema)
   components map stays here)    |                       + atom-raw wrapping
                                 |  docToWiki(doc)       canonical emitter
                                 |  schema/extensions    TipTap nodes + marks
                                 |  <WikiEditor>         rich view + source view
```

The key refactor (Phase 1 of the milestone) is **pure extraction, no behavior change**: move `preprocessJiraMarkup` and its helpers into `lib/wiki/`, extract `wikiToMarkdown`, and export one `wikiRenderPlugins` array that both `WikiRenderer` (react-markdown `remarkPlugins`/`rehypePlugins`) and the new `wikiToHtml` use. The `components={markdownComponents}` map (IssueKeyLink, mention, attachment chip, OlRenderer) stays in WikiRenderer because it is React-only.

Keeping the renderer untouched behind its tests:
- `WikiRenderer.tsx` keeps re-exporting `preprocessJiraMarkup`, `splitInlineSingleLineTables`, `mergeOpenTableRows`, `injectHeaderlessTableSeparators`, `JIRA_EMOTICON_MAP`, `AttachmentMap`, `UserMap`. WikiRenderer.test.tsx (~2700 LOC) imports them from `./WikiRenderer` today, so the tests keep passing with zero edits. Verify with `git diff --stat` that WikiRenderer.test.tsx is not in the diff.
- The refactor commit must be test-only-green: run the full vitest suite; the pre-commit hook already does (memory: full suite runs on commit).
- Two renderer-only plugins matter for the editor: `rehypeIssueKeys` (turns bare keys into `<issuekeylink>`; must NOT run for editor load, or keys become non-text nodes) and `rehypeDecodeInlineCodeEntities` (should run, it affects what inline-code text is). So the shared array is split: `corePlugins` (parse-affecting, shared) and `presentationPlugins` (issue keys, sanitize; renderer-only). The editor path uses sanitize too (it protects against script tags in pasted HTML), but not issue keys.
- React Compiler caveat (memory: compiler vs module reads): `lib/wiki/` functions must stay pure and not read module-level mutable state.

## Component Boundaries

| Component | New/Mod | Responsibility | Talks to |
|-----------|---------|----------------|----------|
| `lib/wiki/preprocess.ts` (+ helpers) | NEW (moved) | Wiki to preprocessed text. All the table/panel/code/emoticon hacks | WikiRenderer, wikiToHast |
| `lib/wiki/pipeline.ts` | NEW | `wikiToMarkdown`, `wikiToHast`, `wikiToHtml`, `corePlugins` | preprocess, jira2md, unified |
| `routes/dashboard/WikiRenderer.tsx` | MODIFIED (extraction only) | Presentation: React components, lightbox, issue-key links | lib/wiki |
| `components/wiki-editor/schema/*` | NEW | TipTap nodes and marks, each with `parseHTML` matching the renderer's HTML output and a `wiki` emit rule | wikiToDoc, docToWiki |
| `components/wiki-editor/wikiToDoc.ts` | NEW | `wikiToHtml` then `generateJSON` then raw-atom wrapping | lib/wiki, schema |
| `components/wiki-editor/docToWiki.ts` | NEW | Canonical emitter. Pure JSON walker, no DOM | schema |
| `components/wiki-editor/equivalence.ts` | NEW | `normalizeHtml`, `isEquivalent(a, b)`. Shared by CI harness and runtime guard | lib/wiki |
| `components/wiki-editor/RawWikiNode` (atom, block + inline) | NEW | Verbatim passthrough, NodeView renders `<WikiRenderer wikiText={raw}>` read-only | WikiRenderer |
| `components/wiki-editor/WikiEditor.tsx` | NEW | Public component, mode state, controlled value sync, shortcuts | all above |
| `components/wiki-editor/SourceView.tsx` | NEW (or resurrect) | Plain textarea, `field-sizing-content`, same min-height | WikiEditor |
| `components/wiki-editor/Toolbar.tsx` | NEW | Formatting buttons, source toggle, attach button | WikiEditor |
| `components/wiki-editor/mention/*` | NEW | TipTap suggestion adapter around the existing `MentionPopover` and `useMentionUserMap` | MentionPopover, hooks |
| `components/wiki-editor/attachments/*` | NEW | Paste/drop handlers, image node, chip node, picker bridge | `lib/attachment-markup.ts`, AttachmentPickerModal |
| `DescriptionEditor.tsx`, `CommentComposer.tsx`, `InlineComment.tsx` | MODIFIED then largely deleted | Become thin hosts (or are replaced) once WikiEditor lands | WikiEditor |
| `lib/attachment-markup.ts` | KEPT | `attachmentRef` / `stagedAttachmentRef` remain the single source of attachment wiki text; docToWiki must use them | WikiEditor |
| `stores/composer-focus.store.ts` | KEPT | Host calls `editorRef.focus()` instead of textarea focus | CommentComposer |

## Data Flow

**Load / mode flip to rich**
1. Host passes `value` (wiki).
2. `wikiToDoc(value, {attachments, users})`: `preprocessJiraMarkup`, `to_markdown`, remark/rehype to HTML (same plugins as renderer), `generateJSON(html, schema)`.
3. Unmodelable constructs become `rawWiki` atoms (see below).
4. **Runtime guard:** `isEquivalent(wikiToHtml(value), wikiToHtml(docToWiki(doc)))`. This is a pure string comparison on pipeline HTML, no React render, so it is cheap. If it fails, do not open rich mode. Open in source mode with a quiet one-line notice (or degrade the offending block to a raw atom). This turns a silent data-change bug into a visible fallback.

**Edit**
- ProseMirror transaction with `docChanged` sets `dirty = true` and calls `onChange(docToWiki(doc))`. Throttle with rAF or ~150 ms trailing for long docs.
- **No-op rule (carried over from the prior attempt, correct and keep):** if the user never edited, `onChange` is never called and the original string is untouched. Opening and closing an editor must not rewrite stored markup.

**Save**
- Host saves `value` (the last emitted wiki string) exactly as today. Storage format and API calls are unchanged, so `useIssueMutations`, comment POST/PUT, etc. need no change.

## Handling Unmodelable Constructs

Three tiers, in order of preference:
1. **Model it** (first-class node/mark): bold, italic, strike, underline, sub/sup, headings h1-h6, bullet/ordered/mixed nested lists, links, blockquote (`bq.` and `{quote}`), `{{mono}}`, `{code:lang}` and `{noformat}`, tables (including header-less and `||` header rows), panels (`{panel}`, `{info}`, `{note}`, `{warning}`, `{tip}`), `{color}`, mentions, attachment images/chips, horizontal rule, line breaks, emoticons (as text).
2. **Raw atom** (`rawWiki`): unknown macros (`{jira}`, `{toc}`, `{anchor}`, `{section}`/`{column}`, `{status}`, ...), exotic image attributes, table cells holding constructs the cell schema cannot hold. Stores `attrs.raw` (exact original substring) and is emitted verbatim.
   - **Block and inline variants** are both needed. The prior attempt had only a block atom, so inline macros got hoisted to paragraph level.
   - **NodeView renders `<WikiRenderer wikiText={raw}>`** inside a bordered, non-editable box. This is pixel-faithful for free and needs no per-macro editor UI. Double-click or a small "Edit source" affordance opens an inline textarea for that raw chunk only.
   - **Detection must be source-driven, not output-driven.** The prior attempt scanned the *original wiki* with a regex for `{macro}...{macro}` and patched the JSON afterwards (`wrapUnknownMacros`). That is fragile for nested and mismatched macros. Better: a small **segmenter** in `lib/wiki/` run BEFORE the pipeline. It scans the wiki for top-level macro spans and unknown/unsupported spans, swaps each for an opaque placeholder token that survives preprocess, markdown and HTML (an HTML comment or custom element, as the CODEBODY null-byte placeholder already does), and records the raw text. After `generateJSON` the placeholder becomes a `rawWiki` node. This mirrors the existing CODEBODY technique, so the mechanism is already proven in this codebase.
3. **Whole-document fallback:** if the guard fails, open source mode. Never auto-"fix" the content.

**Cardinal rule for tier 1:** a construct is only "modeled" if the corpus proves `render(emit(parse(x))) == render(x)` for it. If a construct is flaky in the corpus, demote it to tier 2 rather than shipping lossy editing. The roadmap should treat the corpus as the spec.

## Equivalence Test Harness

Goal: `render(serialize(parse(x))) == render(x)` over a fixture corpus.

- **Two layers.**
  1. *Pipeline-level (fast, the bulk):* compare `wikiToHtml(x)` with `wikiToHtml(docToWiki(wikiToDoc(x)))` after `normalizeHtml`. Pure functions, runs in node, thousands of cases cheap. This is the same function as the runtime guard, so CI and production check the same thing.
  2. *Component-level (small smoke set):* `renderToStaticMarkup` or RTL `container.innerHTML` of `<WikiRenderer wikiText=...>` for before and after, wrapped in the existing `renderWiki()` helper (QueryClient + MemoryRouter, see WikiRenderer.test.tsx:108). Catches anything the pipeline-level miss (React components map, IssueKeyLink).
- **`normalizeHtml`:** parse with the same hast/DOM tools, then: collapse whitespace runs outside `<pre>`, drop empty text nodes, sort attributes, strip generated ids, normalize `<br>` vs newline in paragraphs, normalize `<p>` wrappers inside `<li>` (tight vs loose), normalize entity forms. Keep the normalizer *small and justified per rule*; every rule is a place a real regression can hide. The user chose semantic, not byte, equivalence so some normalization is by design.
- **Additional assertions per fixture** (cheap, high value):
  - **Idempotence:** `docToWiki(wikiToDoc(docToWiki(wikiToDoc(x)))) === docToWiki(wikiToDoc(x))`. Catches emitter instability.
  - **No-op preservation:** open then save without edits returns the exact original string.
  - **Raw atoms verbatim:** every `rawWiki.raw` is a substring of the source.
  - **Edit-then-equivalence (property-ish):** apply a scripted edit (append a paragraph, bold a word) and assert the *untouched* blocks' HTML subsequence is unchanged.
- **Corpus sources.**
  - Seed from the inputs already in WikiRenderer.test.tsx (each `render(<WikiRenderer wikiText="...">)` literal is a regression the team already hit; extract them to `fixtures/*.wiki`).
  - Add real-shaped Jira descriptions and comments **anonymized with placeholders** (memory: no customer data in repo, placeholders only). Never paste live issue bodies into fixtures.
  - Add one fixture per construct in the mapping table, plus adversarial ones: `*` and `_` inside URLs, `|` inside code in table cells, `+` inside code, `{{{}x{}}}` teletype, nested lists with panels, CRLF input, a table directly after a list.
- **Known-divergence file:** if some construct cannot be made equivalent, record it in an explicit allow-list with a reason and demote it to raw-atom, so the list is reviewable rather than a silent skip.
- **Placement:** `src/components/wiki-editor/__tests__/equivalence.test.ts` driving `fixtures/` via `import.meta.glob('?raw')`. Vitest + jsdom already in the project (vitest 4, jsdom 29).

## Source Mode and Rich Mode Switching

- **Single source of truth is the wiki `value` string.** Mode is local UI state (and may persist as a per-user preference in settings store; default rich).
- rich to source: textarea shows `value` as the host last received it (if clean, the original; if dirty, the last emitted). No re-serialize on toggle unless dirty.
- source to rich: run `wikiToDoc` and the guard; `editor.commands.setContent(doc, {emitUpdate:false})`. If the guard fails, stay in source and show the notice.
- **Source is authoritative while active** (prior attempt's D-source-authority, correct). While in source mode the rich editor is unmounted or `setEditable(false)`; edits flow `textarea -> onChange(text)`.
- Do not keep two live editors both emitting `onChange`. One emitter at a time prevents echo loops.
- **Controlled-value echo guard:** keep `lastEmittedRef`. Sync effect only resets editor content when `value !== lastEmittedRef.current` (external change such as form reset, clone, draft restore). The prior attempt hit this (its "Pitfall 5"); build it in from the start with a test that types while the parent re-renders.
- Selection is not mapped across modes (accepted). Put the caret at the end on switch.

## Single `<WikiEditor>` API

```ts
interface WikiEditorProps {
  value: string;                       // Jira wiki markup
  onChange: (wiki: string) => void;    // only fires on real edits
  variant?: 'description' | 'comment' | 'inline';   // density: toolbar, min/max height
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;                         // label association, test hooks

  // Rendering context (same maps WikiRenderer takes)
  attachments?: JiraAttachment[];      // host passes the objects; editor derives the filename->URL map
  users?: UserMap;

  // Mentions
  mentions?: { searchUsers: (q: string) => Promise<JiraAssignableUser[]>; issueKey?: string };
  // (wraps existing MentionPopover + useMentionUserMap; token emitted is [~name], current behavior)

  // Files: editor owns paste/drop/picker UX, host owns upload
  onFilesAdded?: (files: File[]) => void;        // paste, drop, picker "upload"
  stagedFiles?: File[];                          // create mode: render chips, emit stagedAttachmentRef
  onRemoveStagedFile?: (i: number) => void;
  uploading?: { name: string } | null; uploadError?: string | null;

  onSubmit?: () => void;               // Mod+Enter
  submitOnModEnter?: boolean;          // defaults true for comment/inline, false for description
  onCancel?: () => void;               // Escape (inline edit)
  mode?: 'rich' | 'source'; onModeChange?: (m) => void;   // optional controlled mode
}

interface WikiEditorHandle {           // forwardRef, replaces DescriptionEditorHandle
  focus(): void;
  insertWiki(ref: string): void;       // insertRef equivalent; parses ref into a node in rich mode
  insertAttachment(att: JiraAttachment): void;  // uses attachmentRef
}
```

Notes:
- `insertWiki` replaces `DescriptionEditorHandle.insertRef`; the post-upload flow in CreateEditIssueModal (which inserts a ref after the upload resolves) keeps working by calling `descriptionRef.current.insertWiki(ref)`. In rich mode, the ref is parsed through `wikiToDoc` so `!shot.png!` becomes an image node (not literal text). This also fixes the existing CR-01 fallback (append when the textarea is unmounted).
- **Autosize:** ProseMirror's contenteditable grows with content natively. Set `min-height` per variant and an optional `max-height` with `overflow-y-auto`. Source view uses `field-sizing-content` (established codebase pattern in `ui/textarea.tsx`; the prior attempt confirmed it). Both views share the same min-height so toggling does not jump layout.
- **Do not import hosts' stores in the editor.** Pass `searchUsers` and attachment lists as props so WikiEditor stays testable. `composer-focus.store` remains host-side: `useEffect` calls `editorRef.current?.focus()`.
- **Staged uploads:** the editor displays staged chips and emits `stagedAttachmentRef(file)` into the doc at insertion time (same as today). The host still swaps staged for real after issue creation, since the stored text is the same `!name!` / `[^name]` form either way (existing "known divergence" for hazardous filenames stays as-is and is documented in `attachment-markup.ts`).
- Mention emission stays `[~name]` (current CommentComposer behavior). The prior attempt invented `[~accountId:X]` handling. Whichever form is in the stored text must be preserved on round trip as a node attr (`mentionForm: 'name' | 'accountId'`). Add a corpus fixture for both.
- Dependency note: React Compiler is on in the app, not in vitest (memory). TipTap `useEditor` returns a mutable object; keep editor instance in a ref/`useEditor` and avoid render-time reads of `editor.getJSON()`.

## Patterns to Follow

### Pattern 1: Extract, then share one plugin list
**What:** One exported `corePlugins` constant used by both react-markdown and `unified()`.
**When:** Any change to rendering must automatically affect the editor load path.
**Why:** Eliminates the "second parser" drift that sank the previous design.

### Pattern 2: Placeholder-and-restore for opaque spans
**What:** Replace a span with a sentinel before the lossy pipeline, restore after (existing CODEBODY technique).
**When:** Raw macros, code bodies, anything jira2md would corrupt.
**Example:**
```typescript
// lib/wiki/segment.ts (sketch)
export function segmentUnmodelable(wiki: string): { text: string; raws: string[] } {
  // returns text with <div data-raw-wiki="N"></div> / <span data-raw-wiki="N"> sentinels
}
```

### Pattern 3: Canonical emitter
**What:** `docToWiki` always writes the *one* form the renderer is proven on (e.g. `*b*` never `{*}`, `h2. ` heading, `||` header rows, `#`/`*` nesting by repetition).
**When:** Always. The editor changes how markup is *written*; it must never use a rare form just because it is legal.

### Pattern 4: One corpus, two consumers
**What:** `isEquivalent` is the CI assertion and the runtime guard.
**When:** Always.

## Anti-Patterns to Avoid

### Anti-Pattern 1: `j2m.md_to_html` for editor load
Different parser than the renderer. Use the unified pipeline.

### Anti-Pattern 2: Output-scanning to find raw macros
Regexing the original wiki after the HTML pass and patching JSON (prior `wrapUnknownMacros`) breaks on nesting and inline macros. Segment before the pipeline.

### Anti-Pattern 3: Reconstructing state from emoji
Prior `reconvertTaskItems` re-derived task lists from paragraphs starting with the checkmark/cross emoji that the preprocessor substituted for `(/)` and `(x)`. In Jira those are emoticons, not task lists (`(/)` is a check icon). Treat them as plain inline text or emoticon atoms. Do not invent a task-list node unless Jira renders one, because the renderer will not render it back as a list and equivalence breaks.

### Anti-Pattern 4: Editor-owned fetching/stores
Keep WikiEditor presentational, as above.

### Anti-Pattern 5: Rewriting on open
Never emit `onChange` without a user transaction.

### Anti-Pattern 6: Weakening the sanitize schema to make the editor work
Keep `wikiSanitizeSchema` as is. If the editor needs an element, add it to the schema deliberately with a test (the schema comment already flags T-54-07-01).

## Migration Order Across Host Surfaces

Order by risk and by features exercised; each step shippable on its own and behind the unchanged storage format.

| # | Host | Why this position | Features it exercises |
|---|------|-------------------|-----------------------|
| 1 | **Dev-tools preview page (in-app, flag-gated)** | Dogfood the editor against the corpus on real content without touching a host (memory: "dev tools = in-app page") | everything |
| 2 | **Create Epic** (`CreateEpicDialog.tsx`) | Create-only, no existing text to corrupt, no mentions, no staged uploads | basic formatting, source toggle |
| 3 | **Create/Edit Issue modal** (`DescriptionEditor` host, with the larger two-column layout) | Highest value, exercises load of existing text (edit) AND staged uploads (create) | attachments, staged, `insertWiki` handle, large docs |
| 4 | **Inline description edit** (issue detail + peek) | Reuses the modal's description config; separate wiring (`IssueDetailView`/PeekPanel), Esc/cancel | `onCancel`, dirty guard |
| 5 | **Comment composer** | Mentions, Mod+Enter submit, `composer-focus` store, attachment picker; many tests exist (`CommentComposer.test.tsx`, `.attachments.test.tsx`) so port tests, do not rewrite behavior | mentions, submit, focus |
| 6 | **InlineComment + comment edit** (`IssueDetailView.tsx:949` textarea, `ActivityTimeline` edit) | Same editor, `variant="inline"`; editing existing comments is the riskiest load path, so it goes last after the corpus has grown | edit of existing comments |
| 7 | **Bulk Create Subtasks** | Verify there is any free-text wiki field first: the modal works from templates with no description editor visible in the code inspected. Likely a no-op or limited to template description | -- |
| 8 | **Edit Release** | See pitfall below: not Jira wiki | -- |

**Edit Release warning (needs a decision, flag for roadmap).** `EditReleaseModal.tsx` edits two descriptions: the Jira *version* description and the GitLab *milestone* description. Jira version descriptions are plain text (not wiki-rendered), and GitLab milestone descriptions are GitLab-flavored Markdown. Feeding them through a Jira-wiki editor would silently convert or escape their content (`*x*`, `h2.`, `|`, `{`). Either keep them plain textareas with the shared styling, or add a `format="plain" | "wiki"` prop. Recommend: do NOT use the wiki editor here, apply only the visual polish. Confirm with the user in requirements. (Confidence MEDIUM: Jira version-description rendering not verified against their on-prem instance this pass.)

## Suggested Build Order (dependency-driven)

1. **Pipeline extraction (no behavior change).** `lib/wiki/` with `preprocess`, `wikiToMarkdown`, `wikiToHast/Html`, `corePlugins`; WikiRenderer consumes them. Gate: WikiRenderer.test.tsx unchanged and green. Everything else depends on this.
2. **Equivalence harness skeleton + corpus extraction.** `normalizeHtml`, `isEquivalent`, fixtures harvested from existing renderer tests. Build it *before* the editor so the schema is test-driven (the corpus is the spec).
3. **Schema + `wikiToDoc` + `docToWiki` for core text** (marks, headings, lists, links, quote, code, hr), including the segmenter and `rawWiki` atom. Corpus green for these. No UI yet.
4. **Schema for hard constructs:** tables (header-less, merged rows), panels/callouts, `{color}`, nested lists with panels. Demote anything flaky to raw. (Most likely to need deeper per-phase research and time.)
5. **WikiEditor shell:** TipTap view, source view, toggle, no-op/dirty rule, echo guard, autosize, toolbar, shortcuts, runtime guard. Mount on the dev-tools page.
6. **Mentions** (adapter over `MentionPopover`/`useMentionUserMap`) and **attachments** (paste/drop images, picker, staged refs, `insertWiki`).
7. **Host migration** in the order above (Epic, Issue modal + layout, inline description, composer, inline comment/edit). The modal's layout polish (editor in main column, fields in a sidebar column) ships with step 3 of the host list because it is the editor's flagship surface.
8. **Cross-surface UI polish pass** and removal of dead code (`DescriptionEditor` tabs/preview, hand-rolled `insertAtCursor`, textarea mention-position math in CommentComposer).

Dependencies in one line: pipeline extraction -> harness -> schema/serializer -> editor shell -> mentions/attachments -> hosts -> polish.

## Scalability Considerations

| Concern | Typical (a few KB) | Long descriptions (50KB+) |
|---------|--------------------|---------------------------|
| `docToWiki` on every change | negligible | throttle (rAF / 150 ms trailing); serialize only when the host actually needs the value (still emit on blur and on submit) |
| Load parse + guard | few ms | do once on mount; keep guard pure-string; do not run per keystroke |
| Editor bundle | adds TipTap + ProseMirror + `@tiptap/html` | lazy-load `WikiEditor` (the app already code-splits routes, v1.7); keep `@tiptap/html` / unified chain off the initial chunk |
| Many editors on screen (Bulk, comment list in edit) | n/a | mount rich editor only for the item in edit; show `WikiRenderer` otherwise |

## Library Note

TipTap v3 (ProseMirror) remains the pragmatic choice for this architecture: schema-first nodes with `parseHTML` hooks (maps 1:1 to the renderer's HTML), React NodeViews (needed to host `WikiRenderer` inside raw atoms), table extension, suggestion utility for mentions, and `generateJSON`. The architecture above does not depend on that choice except for the `parseHTML`/NodeView hooks; the stack researcher owns the final call. Note `@tiptap/*`, `rehype-stringify`/`hast-util-to-html` are not in package.json today (`unified`, `remark-parse`, `remark-rehype` are present transitively via react-markdown; promote to direct dependencies, and the package-deps guard test pattern in `src/test/` suggests dependency changes are watched).

## Pitfalls Specific to This Integration (feed PITFALLS.md)

1. **Second-parser drift** (prior design): load via marked, render via remark. Fixed by pipeline sharing.
2. **Tight vs loose list / `<p>` in `<li>`** differences between the HTML the editor parses and what the renderer re-renders: normalize in harness, but emit canonical lists.
3. **Hard-break handling:** renderer uses `remark-breaks` (single newline is `<br>`); the emitter must write line breaks as single newline (or `\\`), and paragraph breaks as blank line, consistently.
4. **Jira wiki context sensitivity:** `{{ ` plain-space vs nbsp (memory), `{{{}TEXT{}}}` teletype, `|` in table cells, `+` in code, entity decoding. All are already encoded in preprocess; do not re-derive them in the emitter. Emit escapes only where the corpus shows need, and test each.
5. **Placeholder collisions:** sentinels must not occur in user text; use null-byte or a UUID-ish token like CODEBODY.
6. **Echo loops and cursor jumps** in controlled mode (value to setContent to onUpdate).
7. **WKWebView (Tauri macOS) contenteditable quirks:** memory notes record several WebKit rendering gaps (custom highlight, blob PDFs, truncate/overflow). Test caret, IME, paste-image (clipboard `files`) and drag-drop (Tauri `dragDropEnabled` swallows drops, see memory) inside the real Tauri webview, not just jsdom. jsdom has no layout/`contenteditable` fidelity, so TipTap unit tests will mock selection; rely on the corpus (pure functions) for correctness and a manual UAT checklist for interaction.
8. **Raw-atom UX:** an atom that cannot be edited frustrates users; the "Edit source" affordance on the atom and the full source toggle are the escape hatches.

## Gaps to Address

- Revert reason of the TipTap attempt is unrecorded; I could not find it in commit messages or memory. Recommend asking the user before Phase 3 and checking `git log` around 2026-06 for the revert commit message.
- Exact unified plugin order inside WikiRenderer (`remarkGfm, remarkBreaks`, `rehypeRaw`, `rehypeIssueKeys`, `rehypeDecodeInlineCodeEntities`, `rehypeSanitize`) was read, but the full `markdownComponents` interplay (e.g., `OlRenderer` depth context, attachment chip, mention element) needs a phase-level read to decide which element shapes `parseHTML` must accept.
- Jira version description format (plain vs wiki) unverified on the live instance.
- TipTap v3 current API (table extension packaging, `generateJSON` import path, NodeView React API) was not re-verified in this pass; check Context7 in the editor-shell phase.
- Whether `<ol>`/`<li>` task lists or other constructs appear in real corpora is unknown until anonymized samples are collected.

## Sources

- Codebase (HIGH): `taskflow/src/routes/dashboard/WikiRenderer.tsx` (pipeline at lines ~1511-1802), `WikiRenderer.test.tsx`, `DescriptionEditor.tsx`, `CommentComposer.tsx`, `MentionPopover.tsx`, `lib/attachment-markup.ts`, `stores/composer-focus.store.ts`, `release-detail/EditReleaseModal.tsx`, `IssueDetailView.tsx`, `BulkCreateSubtasksModal.tsx`
- Prior art (HIGH, read directly): tag `backup/wiki-editor-before-revert-260531`, `taskflow/src/components/wiki-editor/{WikiEditor.tsx,jiraToTiptap.ts,jiraWikiSerializer.ts,extensions/RawJiraNode.ts}`
- Project memory notes on wiki rules, WKWebView, React Compiler, attachments DnD (HIGH, project-specific)
- Not independently verified externally this pass: TipTap v3 docs (LOW-MEDIUM; confirm via Context7 later)
