---
phase: quick-260531-saz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/package.json
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/components/wiki-editor/jiraWikiSerializer.ts
  - taskflow/src/components/wiki-editor/jiraWikiSerializer.test.ts
  - taskflow/src/components/wiki-editor/extensions/RawJiraNode.ts
  - taskflow/src/components/wiki-editor/extensions/JiraColorMark.ts
  - taskflow/src/components/wiki-editor/extensions/JiraCalloutNode.ts
  - taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx
  - taskflow/src/components/wiki-editor/jiraToTiptap.ts
  - taskflow/src/components/wiki-editor/wikiEditorExtensions.ts
  - taskflow/src/components/wiki-editor/SourceView.tsx
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/WikiEditor.test.tsx
  - taskflow/src/components/wiki-editor/index.ts
  - taskflow/src/routes/dashboard/DescriptionEditor.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/InlineComment.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
autonomous: false
requirements: [WIKI-EDIT-01]
user_setup: []

must_haves:
  truths:
    - "Every supported Jira style edits as true WYSIWYG (bold renders bold, headings render as headings, lists/tables/code blocks render natively)"
    - "A Source toggle shows and edits the canonical raw Jira wiki markup; both views stay in sync"
    - "Jira wiki markup that the WYSIWYG cannot model is preserved verbatim (not dropped) on round-trip"
    - "A single <WikiEditor> replaces the textarea editors in DescriptionEditor, CommentComposer, InlineComment, and CommentCard edit mode"
    - "@mention autocomplete still works and serializes to [~username] / [~accountId:XXX]"
    - "Opening then saving an unchanged field does not rewrite/normalize the markup (no spurious diff)"
    - "The rehype-sanitize XSS allowlist in WikiRenderer is unchanged and its guard test still passes"
  artifacts:
    - path: "taskflow/src/components/wiki-editor/jiraWikiSerializer.ts"
      provides: "ProseMirror doc -> Jira wiki markup serializer (the save path)"
      exports: ["serializeToJiraWiki"]
    - path: "taskflow/src/components/wiki-editor/jiraWikiSerializer.test.ts"
      provides: "Jira->editor->Jira round-trip matrix covering every style + rawJira passthrough + mentions"
    - path: "taskflow/src/components/wiki-editor/WikiEditor.tsx"
      provides: "Shared controlled WYSIWYG + Source-toggle editor component"
      exports: ["WikiEditor"]
    - path: "taskflow/src/components/wiki-editor/extensions/RawJiraNode.ts"
      provides: "Atom passthrough node holding verbatim unsupported Jira markup"
    - path: "taskflow/src/components/wiki-editor/jiraToTiptap.ts"
      provides: "Jira wiki -> HTML (reusing WikiRenderer pipeline) -> TipTap JSON load path"
  key_links:
    - from: "taskflow/src/components/wiki-editor/jiraToTiptap.ts"
      to: "taskflow/src/routes/dashboard/WikiRenderer.tsx"
      via: "imports exported preprocessJiraMarkup + jira2md pipeline (no second parser)"
      pattern: "preprocessJiraMarkup"
    - from: "taskflow/src/components/wiki-editor/WikiEditor.tsx"
      to: "taskflow/src/components/wiki-editor/jiraWikiSerializer.ts"
      via: "serializes doc -> Jira wiki on change/toggle"
      pattern: "serializeToJiraWiki"
    - from: "taskflow/src/routes/dashboard/DescriptionEditor.tsx"
      to: "taskflow/src/components/wiki-editor/WikiEditor.tsx"
      via: "renders <WikiEditor> in place of textarea"
      pattern: "WikiEditor"
    - from: "taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx"
      to: "taskflow/src/services/jira/users.ts"
      via: "suggestion.items wired to fetchAssignableUsers"
      pattern: "fetchAssignableUsers"
---

<objective>
Replace the four duplicated `<textarea>`+toolbar wiki editors (DescriptionEditor,
CommentComposer, InlineComment composer/edit, and CommentCard edit mode) with a
single reusable WYSIWYG `<WikiEditor>` built on TipTap v3, plus a Source toggle
for editing raw Jira wiki markup. The canonical value in and out stays **Jira
wiki markup** — the editor converts Jira→TipTap on load and TipTap→Jira on save.

Purpose: Give users true rich-text editing (bold renders bold, headings/lists/
tables/code/panels/mentions all render in place) while guaranteeing lossless
round-trip back to the exact format the Jira API stores. Round-trip fidelity is
the #1 risk, so the serializer + its test matrix are built and proven FIRST,
before any UI is wired.

Output: `src/components/wiki-editor/*` (serializer, load path, TipTap extensions,
shared component, tests) and the four call sites swapped to `<WikiEditor>`.

Implements decision D: WYSIWYG via TipTap, Source toggle, shared component,
all styles, lossless round-trip — all per CONTEXT.md (LOCKED).
</objective>

<decisions>
Recorded decisions for the RESEARCH Open Questions (made here, not blocking):

- **D-OQ1 (task-list round-trip):** Serialize TipTap task list items to the Jira
  emoticon-prefix convention `(/) ` (checked) / `(x) ` (unchecked) inside a
  bullet item, because `WikiRenderer` already maps `(/)`→✅ and `(x)`→❌ on the
  render path, giving a clean visible round-trip. Round-trip test asserts this.
- **D-OQ2 (panels/color):** Model `{color:#hex}` as an editable `JiraColorMark`
  (inline mark — low risk, maps 1:1) and model `{panel}/{info}/{warning}/{note}`
  callouts as a `JiraCalloutNode` block that is **editable for its body but
  preserves the callout type/title in attrs**. Any panel variant or macro the
  node cannot faithfully reproduce falls through to `RawJiraNode` passthrough.
- **D-OQ3 (Preview tab):** Drop DescriptionEditor's Edit/Preview tabs — the
  WYSIWYG view IS the preview, and the Source toggle covers raw editing.
- **D-source-authority:** Source-view text is authoritative while the user is in
  Source mode. WYSIWYG re-serializes to `value` only when the doc was actually
  edited since the last load (dirty flag) — a no-op open+save must NOT rewrite
  the markup (RESEARCH Pitfall 2).
- **D-source-view:** Source view = styled `font-mono` `<textarea>` (zero new
  deps). CodeMirror is explicitly deferred.
</decisions>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260531-saz-i-want-to-enhance-the-wiki-editing-input/260531-saz-CONTEXT.md
@.planning/quick/260531-saz-i-want-to-enhance-the-wiki-editing-input/260531-saz-RESEARCH.md
@taskflow/src/routes/dashboard/WikiRenderer.tsx
@taskflow/src/routes/dashboard/DescriptionEditor.tsx
@taskflow/src/routes/dashboard/CommentComposer.tsx
@taskflow/src/routes/dashboard/InlineComment.tsx
@taskflow/src/routes/dashboard/MentionPopover.tsx
@taskflow/src/services/jira/users.ts

# Interface notes for executor:
# - WikiRenderer.tsx exports preprocessJiraMarkup(wiki, attachments?, users?) and
#   jira2md is imported there as `j2m` (j2m.to_markdown). Reuse these — do NOT
#   write a second Jira->markdown parser (MEMORY: jira.ts dual-file gotcha).
# - WikiRenderer's wikiSanitizeSchema / rehype-sanitize allowlist must remain
#   byte-for-byte unchanged. WikiRenderer.test.tsx contains the XSS guard.
# - fetchAssignableUsers(baseUrl, token, projectKey, query) -> JiraAssignableUser[]
#   (JiraAssignableUser = { displayName, name, key?, avatarUrls? }). Mentions
#   currently insert `[~${user.name}]`. readSecret('jira-pat') gets the token.
# - CommentComposer is created/instantiated as <CommentComposer issueKey jiraBaseUrl/>
#   (IssueDetailPage:646). InlineComment is <InlineComment .../> in TaskRow:171.
#   DescriptionEditor is <DescriptionEditor id value onChange disabled/> in
#   CreateEditIssueModal:201. CommentCard edit mode is in IssueDetailPage ~789
#   (Textarea value={editText} onChange={onEditTextChange}).
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 1: Verify + install TipTap packages (legitimacy gate)</name>
  <what-built>RESEARCH could not run slopcheck; all @tiptap/* packages are
  [ASSUMED] real (official @tiptap npm org, coordinated v3.24.0). Before relying
  on them, confirm authenticity and peer-deps against this repo's React 19.1.
  This gate covers the ENTIRE @tiptap/* set Task 2 installs, INCLUDING
  `@tiptap/html` (used by Task 3 for `generateJSON`).</what-built>
  <how-to-verify>
    1. Open https://www.npmjs.com/package/@tiptap/react — confirm published by
       the `tiptap`/`ueberdosis` org, latest 3.x exists, peerDependency `react`
       allows `^19`.
    2. Spot-check https://www.npmjs.com/package/@tiptap/starter-kit,
       https://www.npmjs.com/package/@tiptap/extension-mention, and
       https://www.npmjs.com/package/@tiptap/html exist at a matching 3.x.
    3. Run: `cd taskflow && npm view @tiptap/react version @tiptap/starter-kit version @tiptap/extension-mention version @tiptap/html version`
       — all should resolve to the same 3.x minor.
    4. If versions drifted from 3.24.0, pin to the current matching 3.x set instead.
    5. NOTE for Task 2: before adding `@tiptap/html` as a separate dependency,
       confirm whether `generateJSON` is already re-exported from `@tiptap/core`
       or `@tiptap/react` in this 3.x set (`npm view @tiptap/core` / check the
       package's exports). If it is re-exported, the separate `@tiptap/html`
       install is unnecessary — drop it and import `generateJSON` from there.
  </how-to-verify>
  <resume-signal>Type "approved" (and the confirmed version) or describe the issue</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Install TipTap deps + scaffold module + RawJiraNode</name>
  <files>taskflow/package.json, taskflow/src/components/wiki-editor/extensions/RawJiraNode.ts, taskflow/src/components/wiki-editor/index.ts</files>
  <action>
  After the Task 1 gate is approved, install the confirmed version set (default
  3.24.0): `cd taskflow && npm install @tiptap/react@<v> @tiptap/starter-kit@<v>
  @tiptap/pm@<v> @tiptap/html@<v> @tiptap/extension-table@<v> @tiptap/extension-table-row@<v>
  @tiptap/extension-table-cell@<v> @tiptap/extension-table-header@<v>
  @tiptap/extension-task-list@<v> @tiptap/extension-task-item@<v>
  @tiptap/extension-mention@<v>` (single coordinated minor for all).
  IMPORTANT: `@tiptap/html` is included because Task 3 imports `generateJSON`
  from it. FIRST verify (per the Task 1 gate note) whether `generateJSON` is
  already re-exported from `@tiptap/core` or `@tiptap/react` in this 3.x set; if
  it is, DROP `@tiptap/html@<v>` from the install command and have Task 3 import
  `generateJSON` from the re-exporting package instead — do not add a redundant
  dependency.
  Create the `src/components/wiki-editor/` directory tree per RESEARCH structure.
  Implement `RawJiraNode` as a ProseMirror atom node: `name: 'rawJira'`,
  `group: 'block'`, `atom: true`, `selectable: true`, with a single string attr
  `raw`. `parseHTML` matches `[data-raw-jira]` reading the attr from
  `data-raw-jira`; `renderHTML` emits a read-only chip element
  (`<div data-raw-jira="..." class="...">`) labelled "Raw Jira macro — edit in
  Source". Use `addNodeView` returning a non-editable DOM node so the user cannot
  type into it. Export the node. Create `index.ts` as the public barrel (will
  re-export WikiEditor later; for now export RawJiraNode).
  Do NOT touch the rehype-sanitize schema in WikiRenderer.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './WikiEditor'" | grep -c "error TS" | grep -qx 0 && echo OK</automated>
  </verify>
  <done>All listed @tiptap packages appear in package.json dependencies at one
  matching minor (with `@tiptap/html` present UNLESS `generateJSON` was confirmed
  re-exported from @tiptap/core or @tiptap/react, in which case it is intentionally
  omitted); RawJiraNode.ts compiles and exports an atom node with a `raw` string
  attr; module directory exists.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: jiraWikiSerializer (ProseMirror doc -> Jira wiki) + round-trip test matrix</name>
  <files>taskflow/src/components/wiki-editor/jiraWikiSerializer.ts, taskflow/src/components/wiki-editor/jiraWikiSerializer.test.ts, taskflow/src/components/wiki-editor/jiraToTiptap.ts, taskflow/src/routes/dashboard/WikiRenderer.tsx</files>
  <behavior>
    Round-trip matrix (Jira wiki string -> jiraToTiptap -> TipTap JSON doc ->
    serializeToJiraWiki -> Jira wiki string), asserting semantic equality for:
    - bold `*x*`, italic `_x_`, strike `-x-`, inline code `{{x}}`
    - headings `h1.`..`h6.`
    - bullet list `* `/`** ` nesting; ordered list `# `/`## ` nesting
    - task list -> `(/) `/`(x) ` prefix convention (D-OQ1)
    - blockquote (`bq.` single / `{quote}` multi), code block `{code:lang}...{code}`
    - horizontal rule `----`, links `[text|url]` and bare `[url]`
    - table `||h||h||` + `|c|c|`
    - mention `[~username]` and `[~accountId:XXX]` -> mention node -> same form
    - `{color:#hex}x{color}` round-trips via JiraColorMark
    - `{panel:title=T}body{panel}` round-trips via JiraCalloutNode
    - UNKNOWN macro e.g. `{unknownmacro}stuff{unknownmacro}` is captured into a
      rawJira node and emitted VERBATIM (the #1 lossless guarantee)
    - no-op: a doc loaded and serialized with no edits equals the input (modulo
      documented normalization) — assert idempotence of load->serialize->load
  </behavior>
  <action>
  Import `generateJSON` from `@tiptap/html` (OR from `@tiptap/core`/`@tiptap/react`
  if Task 2 confirmed it is re-exported there and dropped the separate install —
  use whichever package actually provides it; do NOT import from a package not in
  package.json).
  First refactor WikiRenderer minimally: extract a pure exported function
  `jiraWikiToHtml(wiki, attachments?, users?): string` that runs
  `fixMarkdownLinkUnderscores(j2m.to_markdown(preprocessJiraMarkup(...)))` and
  then markdown->HTML so the load path is shared (do NOT change rendering output
  or the sanitize schema; WikiRenderer keeps using its existing internals — just
  expose the shared step). If extracting markdown->HTML is heavy, instead export
  `preprocessJiraMarkup` (already exported) plus a small `jiraWikiToMarkdown`
  wrapper and let jiraToTiptap feed markdown to TipTap. Pick whichever keeps the
  parser single-sourced.
  Build `jiraToTiptap.ts`: Jira wiki -> (reused pipeline) -> HTML -> TipTap JSON
  via `generateJSON(html, extensions)`, with custom node
  parseHTML rules mapping `<mention data-id>`, `<span data-color>`,
  `<div data-callout data-title>` to mention/JiraColorMark/JiraCalloutNode, and
  any residual unrecognized `{macro}` block to a rawJira node. Export
  `jiraToTiptap(wiki, opts)`.
  Build `jiraWikiSerializer.ts`: `serializeToJiraWiki(doc): string`, a recursive
  ProseMirror node/mark walker implementing the full mapping table in RESEARCH
  "Round-Trip Mapping". RawJiraNode emits `attrs.raw` verbatim. Mentions:
  account-id-shaped id -> `[~accountId:id]` else `[~id]`. Tasklist -> `(/) `/`(x) `.
  Write the test FIRST (RED) using Vitest, mirroring fixtures from
  WikiRenderer.test.tsx, then implement until GREEN. Tests must NOT mount a live
  editor — operate on TipTap JSON / a headless `Editor`/schema for serialize.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/components/wiki-editor/jiraWikiSerializer.test.ts</automated>
  </verify>
  <done>HARD GATE — execution MUST NOT proceed to Task 4 (extension wiring) until
  this passes. The round-trip test passes for every style row above, the
  unknown-macro verbatim-preservation case passes, AND the no-op idempotence case
  passes (these are the MEDIUM-confidence critical path per RESEARCH; a serializer
  stall must surface here, not cascade into T4). WikiRenderer.test.tsx still green
  (sanitize schema untouched). If the round-trip matrix is not fully green, stop
  and resolve the serializer before any further task.</done>
</task>

<task type="auto">
  <name>Task 4: JiraColorMark, JiraCalloutNode, mention config, extension set</name>
  <files>taskflow/src/components/wiki-editor/extensions/JiraColorMark.ts, taskflow/src/components/wiki-editor/extensions/JiraCalloutNode.ts, taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx, taskflow/src/components/wiki-editor/wikiEditorExtensions.ts</files>
  <action>
  PRECONDITION: Task 3's round-trip matrix must be fully green before starting
  this task (see Task 3 hard gate).
  `JiraColorMark`: an inline TipTap Mark `name: 'jiraColor'` with attr `color`,
  parseHTML matching `span[data-color]` and `strong[data-color]`, renderHTML
  `<span data-color>` with inline `style="color:..."`. The serializer (Task 3)
  already maps it to `{color:#hex}...{color}`.
  `JiraCalloutNode`: a block Node `name: 'jiraCallout'`, attrs
  `{ kind: 'panel'|'info'|'warning'|'note', title?: string }`, `content: 'block+'`,
  parseHTML matching `div[data-callout]` reading `data-callout`/`data-title`,
  renderHTML `<div data-callout data-title>`. Body is editable.
  `mentionConfig.tsx`: configure `@tiptap/extension-mention` `suggestion` with
  `char: '@'`, `items` calling `fetchAssignableUsers(jiraBaseUrl, token,
  projectKey, query)` (token via `readSecret('jira-pat')`), and a React-rendered
  suggestion popup REUSING the existing MentionPopover row markup (CachedAvatar +
  displayName + name). Mention node stores `attrs.id = user.name` and
  `attrs.label = user.displayName`. Export a factory
  `createMentionExtension({ projectKey, jiraBaseUrl })`.
  `wikiEditorExtensions.ts`: export `buildExtensions(opts)` returning StarterKit
  (configured: keep link, underline, code, codeBlock, lists, blockquote,
  horizontalRule, headings) + Table/TableRow/TableCell/TableHeader +
  TaskList/TaskItem + RawJiraNode + JiraColorMark + JiraCalloutNode + (optional)
  the mention extension when `opts.mention` is provided. This is the single
  source of the schema used by BOTH jiraToTiptap (Task 3) and WikiEditor (Task 5).
  Wire jiraToTiptap (Task 3) to call buildExtensions so load and serialize share
  one schema.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/components/wiki-editor/jiraWikiSerializer.test.ts && npx tsc --noEmit 2>&1 | grep -v "WikiEditor" | grep -c "error TS" | grep -qx 0 && echo OK</automated>
  </verify>
  <done>Color, callout, mention extensions compile and are included in
  buildExtensions; the round-trip test (which exercises color/panel/mention)
  still passes; mention suggestion calls fetchAssignableUsers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: WikiEditor component + SourceView (toggle, controlled value, dirty flag)</name>
  <files>taskflow/src/components/wiki-editor/SourceView.tsx, taskflow/src/components/wiki-editor/WikiEditor.tsx, taskflow/src/components/wiki-editor/WikiEditor.test.tsx, taskflow/src/components/wiki-editor/index.ts</files>
  <behavior>
    - Mounting with a Jira-wiki `value` renders WYSIWYG content (bold text appears
      inside a `<strong>`).
    - Toggling to Source shows a textarea whose value equals the canonical Jira
      wiki markup; editing it and toggling back updates the doc.
    - No-op: mount with `value`, toggle to Source and back, with NO edit -> the
      emitted `onChange` value (if any) is byte-equal to the original `value`
      (dirty-flag guard, D-source-authority).
    - Typing in WYSIWYG fires `onChange` with serialized Jira wiki markup.
    - `disabled` makes the editor non-editable.
  </behavior>
  <action>
  `SourceView.tsx`: a controlled styled `<textarea>` (`font-mono text-sm`,
  min-height from variant) — extracted so WYSIWYG/Source share layout.
  `WikiEditor.tsx`: implement the props interface from RESEARCH "Shared
  <WikiEditor> Component Shape" (`value`, `onChange`, `variant`, `placeholder`,
  `disabled`, `minHeight`, `mention?`, `attachments?`, `users?`, `autoFocus?`,
  `onSubmit?`, `submitOnEnter?`, `showSourceToggle?` default true, `id?`).
  Use `useEditor` from `@tiptap/react` with `buildExtensions(opts)`; initialize
  content from `jiraToTiptap(value, opts)` ONCE. Track a `dirty` ref set true on
  the first real `onUpdate`/transaction that changed the doc. Emit `onChange`
  with `serializeToJiraWiki(editor.state.doc)` on update. On toggle to Source,
  use the dirty ref: if not dirty, show the original `value` untouched; if dirty,
  serialize. On toggle back to WYSIWYG, `setContent(jiraToTiptap(sourceText))`.
  Only call `setContent` on external `value` change when it differs from the last
  serialized output (controlled-sync, RESEARCH Pitfall 5). Render a small toolbar
  (bold/italic/code/lists/etc. via editor commands) sized by `variant`, plus the
  Source/WYSIWYG toggle button. Honor `submitOnEnter` (Cmd/Ctrl+Enter -> onSubmit
  for comment/inline variants). Rely on TipTap schema to drop unknown pasted tags
  (no `<script>` survives) — note this in a comment; do not weaken any sanitizer.
  Re-export `WikiEditor` from `index.ts`.
  Write WikiEditor.test.tsx (jsdom + @testing-library/react) covering the
  behaviors above; mock `readSecret` and `fetchAssignableUsers` like existing tests.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/components/wiki-editor/WikiEditor.test.tsx</automated>
  </verify>
  <done>WikiEditor renders WYSIWYG, toggles to/from Source, the no-op-no-rewrite
  test passes, typing emits serialized Jira wiki, and `disabled` is respected.</done>
</task>

<task type="auto">
  <name>Task 6: Swap all four call sites to <WikiEditor> + remove old toolbars</name>
  <files>taskflow/src/routes/dashboard/DescriptionEditor.tsx, taskflow/src/routes/dashboard/CommentComposer.tsx, taskflow/src/routes/dashboard/InlineComment.tsx, taskflow/src/routes/dashboard/IssueDetailPage.tsx</files>
  <action>
  Replace each duplicated textarea+toolbar with the shared `<WikiEditor>` as a
  near drop-in (it is controlled: `value`/`onChange` emit Jira wiki markup,
  exactly replacing the old `<Textarea value onChange>`). Keep all parent
  Save/Comment/Submit/Cancel buttons and mutations UNCHANGED.
  - DescriptionEditor: delete the Tabs/Edit/Preview UI and `insertAtCursor`
    toolbar; render `<WikiEditor variant="description" id value onChange disabled
    showSourceToggle />`. (D-OQ3: WYSIWYG is the preview.)
  - CommentComposer: remove `applyMarkup`/`getCursorPixelPosition`/manual @mention
    state and the MentionPopover wiring; render `<WikiEditor variant="comment"
    value={text} onChange={setText} mention={{ projectKey, jiraBaseUrl }}
    onSubmit={() => mutation.mutate(text.trim())} />`. Keep the "Comment" button +
    mutation. (Mention now lives in the editor via mentionConfig.)
  - InlineComment: replace the composer textarea+toolbar AND the inline edit-mode
    `<Textarea>` with `<WikiEditor variant="inline" ... submitOnEnter mention=.../>`.
    Keep the comment list, edit/delete menu, and mutations. Preserve `userMap`
    passing for mention display resolution.
  - IssueDetailPage CommentCard edit mode (~789): replace the `<Textarea
    value={editText} onChange={onEditTextChange}>` with `<WikiEditor
    variant="comment" value={editText} onChange={onEditTextChange} />`. Keep
    Save/Cancel + editMutation. Pass `users={userMap}` for mention labels.
  Preserve the existing `[~username]`/`[~accountId:XXX]` behavior end to end.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/CommentComposer.test.tsx src/routes/dashboard/IssueDetailSheet.test.tsx</automated>
  </verify>
  <done>All four surfaces render `<WikiEditor>`; no old `applyMarkup`/
  `insertAtCursor`/manual-mention code remains in those files; existing
  CommentComposer + IssueDetailSheet tests pass (update mocks/assertions only if
  they asserted on removed toolbar markup).</done>
</task>

<task type="auto">
  <name>Task 7: Full gate — lint, typecheck, tests, build</name>
  <files>taskflow/src/components/wiki-editor/index.ts</files>
  <action>
  Run the project gates and fix any fallout (import paths, unused old imports in
  the four swapped files, biome assist suppressions per MEMORY — fix via
  biome.json override, never by deleting suppressions). Do not weaken the
  rehype-sanitize schema or any test to make gates pass.
  </action>
  <verify>
    <automated>cd taskflow && npm run check && npm test && npm run build</automated>
  </verify>
  <done>`npm run check` (biome + tsc), `npm test` (full vitest suite incl.
  WikiRenderer XSS guard + new round-trip + WikiEditor tests), and `npm run build`
  all pass clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 8: Manual WYSIWYG + round-trip verification</name>
  <what-built>A shared WYSIWYG <WikiEditor> with Source toggle replacing all four
  Jira-wiki editors; lossless Jira-wiki round-trip via a bespoke serializer.</what-built>
  <how-to-verify>
    1. `cd taskflow && npm run tauri dev` (or the usual dev launch).
    2. Open an issue, click Edit description: confirm existing rich content
       (bold, headings, lists, a table, a panel, a mention, code block) renders
       as true WYSIWYG, editable in place.
    3. Toggle Source: confirm raw Jira wiki markup shows; toggle back: content
       unchanged.
    4. Save WITHOUT editing -> reopen: confirm the stored markup did not change
       (no spurious diff in Jira).
    5. Add a comment with @mention (autocomplete), bold, a bullet list, and a
       code block; submit; confirm it renders correctly and the mention resolves.
    6. Edit an existing comment (both InlineComment list and IssueDetailPage
       CommentCard) and confirm WikiEditor loads/saves it.
    7. Confirm a comment containing an unusual macro you did not edit is preserved
       verbatim after a save.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user paste -> TipTap editor | External HTML pasted into contenteditable |
| editor output -> Jira API | Serialized wiki markup persisted as comment/description |
| stored markup -> WikiRenderer | Untrusted body re-rendered to HTML |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-saz-01 | Tampering/Elevation | TipTap paste of `<script>`/`<iframe>` | mitigate | TipTap schema only keeps registered nodes/marks; unknown tags dropped on paste. Saved output is Jira-wiki text, re-sanitized by WikiRenderer's existing rehype-sanitize allowlist on render. |
| T-saz-02 | Tampering | Stored XSS in comment/description | accept(existing control) | WikiRenderer `wikiSanitizeSchema` unchanged — strips `<script>`/`on*`/`<iframe>`; guard test T-54-07-01 must stay green. |
| T-saz-SC | Tampering | npm installs of @tiptap/* incl. @tiptap/html (slopcheck unavailable) | mitigate | Task 1 blocking-human legitimacy gate (verify npmjs.com + `npm view`, covering @tiptap/html) before install. |
</threat_model>

<verification>
- `npm run check` (biome + tsc) clean.
- `npm test` full suite green, including: existing WikiRenderer XSS guard,
  the new jiraWikiSerializer round-trip matrix, and WikiEditor toggle/no-op tests.
- `npm run build` succeeds (CSS imports + production bundle).
- Manual WYSIWYG + round-trip checkpoint (Task 8) approved.
</verification>

<success_criteria>
- A single `<WikiEditor>` powers DescriptionEditor, CommentComposer, InlineComment
  (composer + edit), and CommentCard edit mode — no duplicated textarea toolbars remain.
- All locked styles edit as WYSIWYG and round-trip losslessly to Jira wiki markup;
  unsupported markup is preserved verbatim via RawJiraNode.
- Source toggle shows/edits canonical raw markup; no-op open+save does not rewrite it.
- @mention works and serializes to `[~username]`/`[~accountId:XXX]`.
- rehype-sanitize allowlist and XSS guard unchanged and green.
- Out-of-scope fields (release/milestone descriptions, worklog comments) untouched.
</success_criteria>

<output>
Create `.planning/quick/260531-saz-i-want-to-enhance-the-wiki-editing-input/260531-saz-SUMMARY.md` when done.
</output>
</content>
</invoke>
