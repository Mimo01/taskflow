# Phase 99: Mentions, Media & Smart Input - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 30 new/modified
**Analogs found:** 27 / 30

All paths below are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` (so `src/...`). `.planning` is at the outer repo root.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/wiki-editor/host.ts` (host type, storage bridge) | config/types | request-response | `src/components/wiki-editor/types.ts` + `WikiEditor.tsx` `cbRef` pattern | role-match |
| `src/components/wiki-editor/types.ts` (add optional `host` prop) | types | n/a | itself (lines 23-31) | exact |
| `src/components/wiki-editor/WikiEditor.tsx` (modify: host bridge, bubble/footer, notice row, exitSuggestion on toggle) | component | event-driven | itself (lines 47-375) | exact |
| `src/components/wiki-editor/extensions.ts` / `rich-extensions.ts` (modify: new extensions, Color/Panel/Emoticon/Mention/Image parse fixes, node views) | config | transform | itself (`buildEditorExtensions`, lines 41-157) | exact |
| `src/components/wiki-editor/suggestion/create-suggestion.ts` | utility (factory) | event-driven | `link-paste.ts` (Extension + Plugin shape) + RESEARCH Pattern 1 | role-match |
| `src/components/wiki-editor/suggestion/SuggestionPopover.tsx` | component | event-driven | `src/routes/dashboard/MentionPopover.tsx` (rows) + `src/components/ui/person-picker.tsx` | role-match |
| `src/components/wiki-editor/suggestion/mention-suggestion.ts` | extension | request-response (server search) | `src/components/ui/use-assignable-user-search.ts` | exact (query) |
| `src/components/wiki-editor/suggestion/key-suggestion.ts` | extension | request-response | `searchJiraForLink` in `src/services/jira.ts:1609` | role-match |
| `src/components/wiki-editor/suggestion/emoticon-suggestion.ts` + `emoticon-data.ts` | extension/data | transform | `JIRA_EMOTICON_TOKENS` in `src/lib/wiki/preprocess.ts:404-440` | role-match |
| `src/components/wiki-editor/suggestion/slash-suggestion.ts` | extension | event-driven | `src/components/wiki-editor/insert-items.ts` + `text-style.ts` | exact (data) |
| `src/components/wiki-editor/input-rules.ts` (modify: emoticon token rule) | extension | transform | itself (lines 19-54) | exact |
| `src/components/wiki-editor/media/upload-plugin.ts` (+ `upload-state.ts`, `embed-removal.ts`) | extension/utility | file-I/O | `routes/dashboard/CommentComposer.tsx:114-215` (upload) + `gap-keeper.ts` (Plugin) | role-match |
| `src/components/wiki-editor/nodeviews/MentionView.tsx`, `ImageView.tsx`, `AttachmentChip.tsx`, `EmoticonView.tsx` | component (node view) | request-response | `nodeviews/RawInlineChip.tsx` + `routes/dashboard/AuthImage.tsx` | exact |
| `src/components/wiki-editor/paste/html-normalise.ts`, `jira-html.ts`, `word-html.ts` | utility | transform | none in repo for DOM allowlist; contract from `extensions.ts` parseHTML tags | no analog |
| `src/components/wiki-editor/paste/wiki-text.ts` | utility | transform | `canLoadRich`/`loadWiki` in `editor-session.ts` | role-match |
| `src/components/wiki-editor/paste/paste-plugin.ts` | extension | event-driven | `src/components/wiki-editor/link-paste.ts` | exact |
| `src/components/wiki-editor/issue-key-decoration.ts` + `src/lib/issue-key.ts` | extension/utility | transform | `WikiRenderer.tsx:106-160` (regex, `isKnownPrefix`, skip rules) | role-match |
| `src/components/wiki-editor/toolbar/BubbleToolbar.tsx`, `CompactFooter.tsx` | component | event-driven | `toolbar/Toolbar.tsx` + `ColourPopover.tsx` + `ModeToggle.tsx` | role-match |
| `src/components/wiki-editor/source/SourceView.tsx` (modify: suggestion + paste upload in source) | component | event-driven | `CommentComposer.tsx:35-72, 180-260` (caret mirror, mention flow) | role-match |
| `src/lib/shortcuts.ts` (modify: `editor-paste-plain` + informational rows) | config | n/a | itself (lines 191-262) | exact |
| `src/stores/settings.store.ts` (modify: recent slash items, `version 39`) | store | CRUD | itself (`version: 38`, line 387, `wikiEditorMode` line 37/114/327) | exact |
| `src/routes/dev-tools/EditorTab.tsx` (modify: host context row, paste sample) | component | request-response | itself | exact |
| Tests (`*.test.ts[x]` under suggestion/media/paste, `issue-key.test.ts`, `toolbar/compact.test.tsx`) | test | n/a | `link.test.ts`, `input-rules.test.ts`, `shell-test-utils.tsx`, `test-utils.ts` | exact |
| `src/routes/dashboard/WikiRenderer.tsx` (modify: import shared issue-key const) | component | transform | itself (lines 106-107, 249) | exact |

## Pattern Assignments

### `src/components/wiki-editor/suggestion/create-suggestion.ts` and the four trigger files (extension, event-driven)

**Analog:** `src/components/wiki-editor/link-paste.ts` (Extension that returns ProseMirror plugins, editor captured via `this.editor`).

**Extension shell** (`link-paste.ts` lines 1-24):
```typescript
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const WikiLinkPaste = Extension.create({
  name: 'wikiLinkPaste',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('wikiLinkPaste'),
        props: { handlePaste: (view, event) => { /* ... */ } },
      }),
    ];
  },
});
```
Copy: `name`, one `PluginKey` per trigger (`wikiMention`, `wikiKey`, `wikiEmoticon`, `wikiSlash`), plugins built inside `addProseMirrorPlugins()` (not module-level mutable). Register each extension in `buildEditorExtensions` next to `WikiLinkPaste`/`WikiGapKeeper` (`extensions.ts:150-153`).

**Host bridge:** `extensions.ts` is built once at module scope (comment at lines 36-40, EDIT-09), so extensions cannot close over props. Use `addStorage()` returning `{ current: null }` and read it at call time; assign it from `WikiEditor` the same way `cbRef` is kept fresh (`WikiEditor.tsx:86-91`):
```typescript
const cbRef = useRef({ onChange, onVerdict });
useEffect(() => {
  cbRef.current = { onChange, onVerdict };
  stateRef.current = { mode, forced };
});
```

**Server-side search (D-01, no fetch-once page cap):** mirror the query key and queryFn from `src/components/ui/use-assignable-user-search.ts:35-46`, but call `queryClient.fetchQuery` from `items({query, signal})`:
```typescript
queryKey: ['jira-assignable-users', issueKey ?? projectKey ?? '', jiraBaseUrl, debouncedQuery],
queryFn: async () => {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token) return [];
  return fetchAssignableUsers(jiraBaseUrl, token, projectKey ?? '', debouncedQuery, { issueKey });
},
staleTime: 60_000,
```
PAT is read inside `queryFn`, never in the key. Imports: `fetchAssignableUsers` from `@/services/jira/users`, `readSecret` from `@/services/stronghold`.

**Issue-key search:** `searchJiraForLink(baseUrl, token, projectKey, query)` (`src/services/jira.ts:1609-1639`), returns up to 15 `JiraIssue`, `[]` on error, key-aware. Edit `jira.ts`, never `jira/` modules, if a change is needed.

**Insert command shape (single undo):** `editor.chain().focus().deleteRange(range).insertContent(...).run()` as `insert-items.ts` `panelItem.run` does (lines 53-58):
```typescript
run: (editor) =>
  editor.chain().focus()
    .insertContent({ type: 'panel', attrs: { type: id }, content: [{ type: 'paragraph' }] })
    .run(),
```
Mention insert attrs come from `schema.ts:132-139`: `{ type: 'mention', attrs: { id: user.name, src: null } }` then a text space.

---

### `src/components/wiki-editor/suggestion/SuggestionPopover.tsx` (component, event-driven)

**Analog:** `src/routes/dashboard/MentionPopover.tsx` (rows, a11y, active-index logic). Do NOT copy its absolute/pixel positioning (lines 101-107), its own `document` mousedown listener (lines 56-65), or its `useQuery` (data comes from the plugin `items`).

**Row markup to copy** (lines 114-148):
```tsx
<div key={user.name} id={optionId} role="option" tabIndex={-1} aria-selected={isActive}
  data-mention-index={index}
  className={`flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm ${
    isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
  }`}
  onClick={() => onSelect(user)}
  onMouseEnter={() => setActiveIndex(index)}>
  <CachedAvatar url={avatarUrl} name={user.displayName} size={20} className="shrink-0" />
  <span className="truncate">{user.displayName}</span>
  <span className="text-muted-foreground text-xs ml-auto truncate">{user.name}</span>
</div>
```
Container: `role="listbox"`, `bg-popover border rounded-md shadow-lg p-1 min-w-[200px] max-h-[240px] overflow-y-auto` (line 105). Loading and empty copy from lines 108-113 ("No matching users"). Active-index wrap logic and `scrollIntoView({ block: 'nearest' })` from lines 67-96. `CachedAvatar` gets explicit px `size` (memory: no 0-width collapse). Add `onMouseDown={(e) => e.preventDefault()}` on items so the editor keeps focus (RESEARCH Pitfall 7).

**Keyboard/Esc (D-20)** from RESEARCH code example: `onKeyDown` returns `true` and calls `event.stopPropagation()` for Escape; Up/Down/Enter/Tab delegate to the component ref. `onExit` must call `unmount()` and `root.destroy()`; tag the element `data-suggestion` so tests assert no leak. Mount into `editor.view.dom.closest('[role="dialog"]') ?? document.body`.

---

### `src/components/wiki-editor/suggestion/slash-suggestion.ts` (extension, event-driven)

**Analog:** `src/components/wiki-editor/insert-items.ts` (the data source; header comment at lines 15-19 says it is "consumed by Phase 99's slash menu: keep ids stable").

**Item shape to reuse** (lines 31-39):
```typescript
export interface InsertItem {
  id: InsertItemId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  source: { before: string; after: string };
  run: (editor: Editor, opts?: { rows: number; cols: number }) => boolean;
}
```
Filter on `label` + `keywords`. Add text-style items (H1-H6, quote, lists) by reusing `applyTextStyle` from `text-style.ts`, and Mention/Attachment/Emoticon items with the same `{id,label,icon,keywords,run}` shape (extend, do not fork, the type). Recent items persist in the settings store (see below).

---

### `src/components/wiki-editor/input-rules.ts` (modify: emoticon token rule)

**Analog:** itself. Add a rule beside `textblockTypeInputRule`/`markInputRule` entries (lines 23-52). Per RESEARCH C2, only the 16 `JIRA_EMOTICON_TOKENS` convert, on the closing `)`; do not invent `:)`/`(y)`. Import tokens from `@/lib/wiki/preprocess` (`JIRA_EMOTICON_TOKENS`, line 429). Add the rule's extension name `wikiInputRules` is already whitelisted in `EDITOR_RULE_OPTIONS` (`extensions.ts:160-170`), so no option change is needed. Test with `typeText` from `test-utils.ts:35-44`.

---

### `src/components/wiki-editor/media/upload-plugin.ts` (extension, file-I/O)

**Analogs:** `routes/dashboard/CommentComposer.tsx:114-165` (upload mutation) and `routes/dashboard/DescriptionEditor.tsx:90-110` (multi-file paste/drop). `gap-keeper.ts` for the plugin-with-state structure.

**Upload call to reuse (via the host callback, not directly)** (`CommentComposer.tsx:109-125`):
```typescript
mutationFn: async (file: File) => {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token) throw new Error('No Jira credentials');
  return uploadAttachment(jiraBaseUrl, token, issueKey, file);
},
onSuccess: (created) => {
  ...
  const att = created[0];
  if (att) insertRef(attachmentRef(att));
},
```
`uploadAttachment(baseUrl, token, issueKey, file)` returns `JiraAttachment[]` (`services/jira/attachments.ts:23-61`). Pitfall 15: embed `created[0].filename`, not the local name.

**Paste/drop handling to copy** (`DescriptionEditor.tsx:90-110`, the multi-file form; CommentComposer's form only uses `files[0]`):
```typescript
function handlePaste(e) {
  const files = e.clipboardData.files;
  if (files && files.length > 0) {
    e.preventDefault();
    for (const file of Array.from(files)) onFileSelected?.(file);
  }
}
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
function handleDrop(e) {
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    e.preventDefault();
    e.stopPropagation();   // stops AttachmentsSection's section-level drop handler (double upload)
    for (const file of Array.from(files)) onFileSelected?.(file);
  }
}
```
Only `preventDefault`+`stopPropagation` when `files.length > 0`. In the plugin use `props.handlePaste` / `props.handleDrop` (same placement as `link-paste.ts:14`) and `view.posAtCoords` for drop position.

**Markup / classification helpers:** `src/lib/attachment-markup.ts` — `isImageAttachment` (lines 12-14), `attachmentRef` (34-44), `stagedAttachmentRef` (61-66, hazard chars `!|]` stripped; staged node `name` must use the same sanitised name, Pitfall 14). Extension-based image fallback: `routes/dashboard/issue-detail/resolvePreviewKind.ts`.

**Placeholder:** plugin-state `Decoration.widget`, never a node (`schema-parity.test.ts:14-60` asserts the editor schema equals `wikiSchema` node for node). Node attrs for the final insert: `image` `{ name, params: null, src: null }`, `attachment` `{ name, label: null, src: null }` (`schema.ts:152-170`).

---

### `src/components/wiki-editor/paste/paste-plugin.ts` (extension, event-driven)

**Analog:** `src/components/wiki-editor/link-paste.ts` (exact shape; order matters since both register `handlePaste`: put files > html > wiki-text, and keep the single-safe-URL-over-selection branch first).

**Core pattern** (`link-paste.ts` lines 14-19):
```typescript
handlePaste: (view, event) => {
  if (view.state.selection.empty) return false;
  const text = event.clipboardData?.getData('text/plain')?.trim() ?? '';
  if (!isSafeLinkUrl(text)) return false;
  return editor.chain().setLink({ href: text }).run();
},
```
Return `false` to let the next handler run. Use `isSafeLinkUrl` from `./link-url` for every pasted href. Tests build a fake `{ clipboardData: { getData, files, types } }` (jsdom has no `ClipboardEvent`, Pitfall 10); see `link.test.ts`.

**Wiki-text parse:** use `loadWiki(text)` from `@/lib/wiki/editor` (the same call `WikiEditor.tsx:57` and `editor-session.ts` use) and accept `rich`/`rich-demoted`, reject `failed`; `canLoadRich` in `editor-session.ts` is the existing boolean wrapper.

---

### `src/components/wiki-editor/paste/html-normalise.ts`, `jira-html.ts`, `word-html.ts` (utility, transform)

**No analog** (no DOM allowlist normaliser exists). Target contract is the parse tags already declared in `extensions.ts`:
- `span[data-wiki-mention]` (line 88), `span[data-wiki-emoticon]` (84), `span[data-wiki-image]` (100), `span[data-wiki-attachment]` (108), `div[data-wiki-panel]` + `data-type` (57-61), `span[data-color]` (132-139), plus `sup`, `sub`, `cite`, `code`.

Known gaps to patch (RESEARCH Pitfalls 1-2): `Color.parseHTML` yields `value: ""` because TipTap reads attribute `value`, not `data-color`, so either emit both attributes or add `getAttrs` in `extensions.ts:131-139`; `<img>` and `div.panel` are dropped. Colour gate: `isSafeColor` from `@/lib/wiki/editor/parse/color` (`extensions.ts:6`) and `TEXT_PALETTE` from `components/wiki-editor/palette.ts`. Every fixture test must assert `saveWiki(...).kind === 'saved'` (helper `saveText` in `test-utils.ts:46-48`). Fixtures go in `src/components/wiki-editor/__fixtures__/paste/*.html`, placeholder text only.

---

### `src/components/wiki-editor/nodeviews/MentionView.tsx`, `ImageView.tsx`, `AttachmentChip.tsx`, `EmoticonView.tsx` (component, request-response)

**Analog:** `nodeviews/RawInlineChip.tsx` (inline atom node view, exact structure).

**Full pattern** (RawInlineChip.tsx lines 1-13):
```tsx
import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';

export function RawInlineChip({ node, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper as="span" contentEditable={false}
      className={`rounded bg-muted/40 px-1 text-xs${selected ? ' ring-1 ring-ring' : ''}`}>
      {String(node.attrs.raw)}
    </NodeViewWrapper>
  );
}
```
Wire like `rich-extensions.ts:9-14` (`ReactNodeViewRenderer(X)` in `buildEditorExtensions({ ... })`) and extend `WikiNodeViews` (`extensions.ts:30-32`). Because `buildEditorExtensions` only sets `addNodeView` when a view is passed, headless `editorExtensions` keep working for tests and the schema-parity test (add the new keys to that test's stub call, `schema-parity.test.ts:46-50`).

**Mention look (D-02/Discretion):** copy WikiRenderer's pill, `WikiRenderer.tsx:398`: `mention-badge inline-flex items-center rounded bg-primary/15 text-primary px-1.5 py-0.5 text-xs font-medium`; render `@{displayName}` with the username in `title`; muted variant when `useMentionUserMap` has no entry. Node views may not get React context (A7), so pass the user map through `editor.storage` host bridge if needed. `useMentionUserMap(initialMap, wikiTexts, jiraBaseUrl)` is in `src/hooks/useMentionUserMap.ts:12-61`.

**Image:** reuse `AuthImage` (`routes/dashboard/AuthImage.tsx`) with `className="max-w-full rounded-md"` as in `WikiRenderer.tsx:315-320`, but without the `onClick` lightbox (D-05: click selects). Staged previews use `URL.createObjectURL` and revoke in cleanup.

**Emoticon glyph:** `JIRA_EMOTICON_MAP` (`lib/wiki/preprocess.ts:404-421`, `[RegExp, glyph]`), `renderHTML` currently prints the token (`extensions.ts:85`); keep `src` as the token.

**Select + menu pattern (if a node view needs a menu):** `PanelView.tsx:58` uses `finalFocus={() => editor.view.dom}` on `DropdownMenuContent` to return focus to the editor (Phase 98 UAT finding).

---

### `src/components/wiki-editor/issue-key-decoration.ts` + `src/lib/issue-key.ts` (extension, transform)

**Analog:** `src/routes/dashboard/WikiRenderer.tsx:106-160` and link class at line 249.

**Regex and prefix rule to extract and import back into WikiRenderer** (lines 100-107):
```typescript
function isKnownPrefix(key: string, activeJiraProject: string | null): boolean {
  if (!activeJiraProject) return false;
  return key.split('-')[0] === activeJiraProject;
}
const ISSUE_KEY_GLOBAL_RE = /\b[A-Z][A-Z0-9_]+-\d+\b/g;
const ISSUE_KEY_EXACT_RE = /^[A-Z][A-Z0-9_]+-\d+$/;
```
Link class: `className={cn('text-primary hover:underline', doneClass)}` (line 249). The rehype plugin skips text under `<a>`, `<code>`, `<pre>` (comment at ~lines 112-118); the decoration plugin must skip `codeBlock`, links, `rawBlock`/`rawInline` likewise. Output is `Decoration.inline` only (D-04), nothing written to the doc.

---

### `src/components/wiki-editor/toolbar/BubbleToolbar.tsx`, `CompactFooter.tsx` (component, event-driven)

**Analog:** `toolbar/Toolbar.tsx` (command wiring, `useEditorState`, source-wrap table) with `ColourPopover.tsx`/`LinkPopover.tsx` for popovers and `ModeToggle.tsx` for the Rich|Source toggle.

**Imports and state pattern** (`Toolbar.tsx` lines 1-47): `useEditorState` from `@tiptap/react`, commands from `../inline-commands` (`applyColour`, `applyLink`, `currentColour`, `currentLink`, `removeColour`, `removeLink`), `TEXT_PALETTE` from `../palette`, `ToolbarButton` from `./ToolbarButton`, `TOOLBAR_ITEMS`/`ToolbarPreset` from `./toolbar-config`. Reuse `itemMeta` (lines 99-102) for labels/keys and the `ICON = 'size-4'` convention (line 81).

**Bubble:** `BubbleMenu` from `@tiptap/react/menus` with `options={{ appendTo: () => document.body }}` (isolate `<main>` portal rule). Render exactly one of Toolbar or Bubble per preset: in `WikiEditor.tsx:322-334` the `<Toolbar preset={preset} .../>` is the single mount point to branch (`full` keeps Toolbar; `compact` swaps in Bubble + footer). Do not show both.

**Popover base:** `ColourPopover` pattern (`@/components/ui/popover`, `initialFocus={false}`, `side="bottom" align="start"`, lines 28-40) to avoid stealing editor focus.

---

### `src/components/wiki-editor/WikiEditor.tsx` (modify)

**Analog:** itself. Extension points:
- Props destructure and `cbRef` (47-55, 86-91): add the `host` prop and mirror it into `editor.storage` in an effect.
- `useEditor({...})` (102-143): nothing changes for `extensions: richExtensions` (module scope).
- Mode toggle / external reset: `toSource` (210), `toRich` (232), reset effect (171-201): call `exitSuggestion(view, key)` for all four plugin keys here (Pitfall 8).
- Message strip (335-357): the D-06 error line and D-10 "Also delete attachment?" notice go in this slot with the same classes: `flex items-center gap-2 border-b border-border px-3 py-1 text-xs`, destructive text `text-destructive`, action button `rounded px-2 py-0.5 text-xs hover:bg-accent` (lines 336-349). No toast lib exists.
- `onKeyDownCapture` (297-308): existing Esc/Mod handling lives on the frame; add nothing that closes the dialog; suggestion Esc is stopped in the plugin `onKeyDown`.
- `onUpdate` guard (`WIKI_TOGGLE_META`, `isEditable`, lines 114-117): D-10 detection must skip these transactions and `replaceDoc`/`resetDoc` (Pitfall 9).

---

### `src/lib/shortcuts.ts` (modify)

**Analog:** itself, lines 191-262. Documentation-only editor rows, ids `editor-*`, `defaultKey` prefixed `editor:`:
```typescript
{
  id: 'editor-bold',
  defaultKey: 'editor:⌘B',
  description: 'Bold while editing',
  category: 'Editor',
  displayKeys: ['⌘', 'B'],
},
```
Add `editor-paste-plain` (`editor:⌘⇧V`, displayKeys `['⌘','⇧','V']`) plus informational rows for `@`, `/`, `:`. Do not add these to `WIKI_KEYMAP_KEYS` unless a TipTap shortcut is actually bound (`keymap.ts:5-12` feeds the app-shortcut conflict check). Cmd+Shift+V is a native paste with Shift held; PM already treats it as plain text.

---

### `src/stores/settings.store.ts` (modify: recent slash items)

**Analog:** itself. State field and setter next to `wikiEditorMode` (type line 114, default line 37, setter line 327: `setWikiEditorMode: (v) => set({ wikiEditorMode: v })`); bump `version: 38` (line 387) to 39 and add a `if (version < 39) { if (s.recentSlashItems === undefined) s.recentSlashItems = []; }` block following the existing `if (version < N)` migrations in `migrate` (line 388+; e.g. line 391 `s.density = 'default'`). Use `useSettingsStore.getState()` from non-React code as `WikiEditor.tsx:58,272` does.

---

### `src/components/wiki-editor/source/SourceView.tsx` (modify: source-mode suggestions and paste upload)

**Analog:** `routes/dashboard/CommentComposer.tsx`.
- Caret mirror measurement (lines 35-72): extract `getCursorPixelPosition` into a shared util (RESEARCH "Don't Hand-Roll"); Phase 100 deletes CommentComposer. Returns `{ bottom, left }` relative to the textarea wrapper; adapt to a virtual anchor `{ getBoundingClientRect }` for floating-ui.
- Mention trigger detection (lines 192-227): `@` valid only after space/newline/start; query is text between `@` and caret; closes on a space.
- Mention insertion (lines 229-248): emits `[~${user.name}]` text and restores the caret with `requestAnimationFrame` + `setSelectionRange`.
- `insertRef` (lines 97-106) and `applyMarkup` (lines 24-33): caret-based text insert for attachment refs.

---

### Test files (test, n/a)

**Analogs:** `link.test.ts` (fake clipboard event, `makeEditor` + `saveText`), `input-rules.test.ts` (`typeText`), `shell-test-utils.tsx` (`installLayoutStubs`, `renderEditor`, `liveEditor`, `typeAt`), `test-utils.ts` (`makeEditor(text, extensions)`, auto-destroy in `afterEach` lines 14-18). Suggestion and bubble tests need `installLayoutStubs()` (`Range.getClientRects` and `ResizeObserver` stubs, lines 9-37). Esc-nesting test: render the editor inside a real Base UI `Dialog` (`@/components/ui/dialog`).

**Existing guards that must stay green:** `schema-parity.test.ts`, `bundle-guard.test.ts` (`src/lib/wiki/editor/`), `compiler-compat.test.ts`. `@tiptap/suggestion` may only be imported from the lazy editor chunk (`WikiEditorLazy.tsx:5` lazy-imports `./WikiEditor`; `types.ts` must stay types-only).

---

## Shared Patterns

### Module-scope extensions + host via storage
**Source:** `src/components/wiki-editor/extensions.ts:36-41, 157` and `rich-extensions.ts:9`
**Apply to:** every new extension (suggestion x4, upload, paste, issue-key decoration). Create once at module scope; never close over props or read module-level mutable state in render (React Compiler runs in app, not vitest).

### Server-side search, PAT in queryFn only
**Source:** `src/components/ui/use-assignable-user-search.ts:15-49`
**Apply to:** mention search, issue-key search. Never fetch one capped page and filter client-side (recurring bug in memory).

### Portal and focus for overlays
**Source:** `routes/dashboard/MentionPopover.tsx` (rows only) and `toolbar/ColourPopover.tsx:28-40` (`initialFocus={false}`), `nodeviews/PanelView.tsx:58` (`finalFocus={() => editor.view.dom}`)
**Apply to:** SuggestionPopover, BubbleToolbar, any node-view menu. Portal to `document.body` or the nearest `[role="dialog"]`; keep DOM focus in the editor; Esc consumed first by the topmost overlay.

### Link/colour safety
**Source:** `src/components/wiki-editor/link-url.ts` (`isSafeLinkUrl`, `normalizeLinkUrl`), `@/lib/wiki/editor/parse/color` (`isSafeColor`), `palette.ts` (`TEXT_PALETTE`)
**Apply to:** html-normalise, paste-plugin, BubbleToolbar link/colour.

### Save-safety assertion
**Source:** `src/components/wiki-editor/test-utils.ts:46-48` (`saveText` -> `saveWiki`), `editor-session.ts` `evaluateSave`
**Apply to:** every paste, upload, and slash test: result kind must be `saved`; placeholders must never appear in output.

### Inline feedback, no toasts
**Source:** `WikiEditor.tsx:335-357` (message strip) and `ConnectionsSection.tsx` header ("No toast/sonner")
**Apply to:** D-06 upload error line, D-10 "Also delete attachment?" notice (6s auto-dismiss, one at a time).

### Attachment markup and classification
**Source:** `src/lib/attachment-markup.ts`
**Apply to:** upload-plugin, embed insert from picker, staged embeds.

### Attachment picker (INPUT-02)
**Source:** `routes/dashboard/issue-detail/AttachmentPickerModal.tsx:1-50` (props `open`, `onOpenChange`, `attachments`, `onSelect(att)`; it is a Dialog; copy text says "reference it in your comment", adjust for the editor). `DescriptionEditor.tsx:228` shows the mount. On select, insert an `image` node when `isImageAttachment(att)` else `attachment`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `paste/html-normalise.ts`, `jira-html.ts`, `word-html.ts` | utility | transform | No DOMParser allowlist or HTML-to-schema normaliser exists; use RESEARCH Pitfalls 1-5 and the schema parse tags in `extensions.ts` |
| `media/upload-plugin.ts` placeholder decoration | extension | file-I/O | No widget-decoration plugin with mapped positions exists (`gap-keeper.ts` is the only stateful-plugin analog and uses `appendTransaction`); follow RESEARCH Pattern 2 |
| `suggestion/*` use of `@tiptap/suggestion` | extension | event-driven | Package not yet installed; the old textarea `MentionPopover` is the only prior art and is being replaced. Needs `npm install @tiptap/suggestion@3.34.0 @tiptap/extension-bubble-menu@3.34.0 @floating-ui/dom@^1.7.6` in `taskflow/taskflow/` behind a human-verify checkpoint |

## Notes for the planner

- Amended decisions: D-05 (parity, params kept verbatim, no width support) and D-10 (inline notice row, no sonner) per CONTEXT; RESEARCH C1/C3 agree. RESEARCH.md `User Constraints` block still shows the pre-amendment wording; follow CONTEXT.
- `JIRA_EMOTICON_TOKENS` has 16 `(…)` tokens only; D-18's `:)`/`(y)` conversion has no existing rule (RESEARCH C2). Plan an input rule limited to those tokens.
- `fetchAssignableUsers` swallows errors (`users.ts:46`), so the popover error state is unreachable; show the empty state only.
- `MentionPopover.tsx` and `CommentComposer.tsx` are read-only references here; Phase 100 deletes them. Extract the caret-mirror helper rather than importing from CommentComposer.

## Metadata

**Analog search scope:** `src/components/wiki-editor/**`, `src/routes/dashboard/{CommentComposer,DescriptionEditor,MentionPopover,WikiRenderer,AuthImage}.tsx`, `src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx`, `src/components/ui/use-assignable-user-search.ts`, `src/services/jira/{users,attachments}.ts`, `src/services/jira.ts`, `src/lib/{attachment-markup,shortcuts}.ts`, `src/lib/wiki/{preprocess.ts,editor/schema.ts}`, `src/stores/settings.store.ts`, `src/routes/dev-tools/`
**Files scanned:** ~35
**Pattern extraction date:** 2026-11-17
