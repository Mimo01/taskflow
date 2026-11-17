# Phase 98: Editor Shell - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 33 new/modified (src paths relative to `taskflow/src/`)
**Analogs found:** 27 / 33 (the other 6 are TipTap-specific and have no codebase analog)

Note: the repo has no existing TipTap UI. Analogs below are for the app-side wiring (Radix/Base UI primitives, dev-tools tabs, settings store, shortcut registry, listener guards, lazy routes). For TipTap APIs, use the code in 98-RESEARCH.md Patterns 1-7.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `lib/wiki/editor/engine.ts` (modify: schema-identity fix) | service | transform | itself (`saveWiki`, lines 96-107) | exact |
| `lib/wiki/editor/schema.ts` (modify: export node consts + STARTER_KIT_OPTIONS) | config | transform | itself (lines 79-209) | exact |
| `lib/wiki/editor/parse/tables.ts`, `preprocess.ts` (modify: WR-02, parseCell escape-aware) | utility | transform | `lib/wiki/preprocess.ts` line ~708 even-run lookbehind | exact |
| `lib/wiki/prose.ts` (new) | utility/config | none | `routes/dashboard/WikiRenderer.tsx` lines 256-263 and 527-546 | exact (extract) |
| `routes/dashboard/WikiRenderer.tsx` (modify: import prose constants) | component | transform | itself | exact |
| `lib/typing-target.ts` (new) | utility | event-driven | `useImageViewer.ts` lines 29-33 `isEditableTarget` | exact |
| `routes/dashboard/useImageViewer.ts`, `AttachmentPreviewModal.tsx`, `AioTestRunDetailPage.tsx` (modify) | hook/component | event-driven | `AttachmentPreviewModal.tsx` lines 401-436 | exact |
| `components/wiki-editor/WikiEditorLazy.tsx` | component | request-response (lazy load) | `routes/routes.tsx` lines 10-26 (`lazy` + `Suspense`) | role-match |
| `components/wiki-editor/WikiEditor.tsx` | component | CRUD (value/onChange) | none (use RESEARCH Patterns 2-4) | no analog |
| `components/wiki-editor/editor-session.ts` | utility | transform | none (RESEARCH Pattern 3) | no analog |
| `components/wiki-editor/extensions.ts`, `input-rules.ts`, `keymap.ts` | config | event-driven | `lib/wiki/editor/schema.ts` (module-scope constants) | partial |
| `components/wiki-editor/insert-items.ts`, `palette.ts`, `languages.ts` | config (data) | none | `lib/shortcuts.ts` (typed static array) | role-match |
| `components/wiki-editor/nodeviews/*.tsx` | component | event-driven | `WikiRenderer.tsx` `calloutStyles`; `searchable-select.tsx` | partial |
| `components/wiki-editor/toolbar/Toolbar.tsx`, `OverflowMenu.tsx` | component | event-driven | `components/ui/page-header.tsx` (container queries) | role-match |
| `components/wiki-editor/toolbar/*Menu.tsx`, `ColourPopover`, `LinkPopover`, `TableGridPicker`, `TableToolbar` | component | request-response | `components/ui/popover.tsx` + `dropdown-menu.tsx` | role-match |
| `components/wiki-editor/toolbar/ToolbarButton` (tooltip + keycaps) | component | event-driven | `AioCyclesScopeBar.tsx` 38-62 + `KeyboardShortcutsPanel.tsx` 24-29 | role-match |
| `components/wiki-editor/source/SourceView.tsx` | component | request-response | `routes/dashboard/DescriptionEditor.tsx` (textarea + WikiRenderer preview) | role-match |
| `routes/dev-tools/EditorTab.tsx` | component | request-response | `routes/dev-tools/NotificationsTab.tsx` | exact |
| `routes/dev-tools/DevToolsPage.tsx` (modify) | component | request-response | itself (lines 55-74) | exact |
| `stores/settings.store.ts` (modify: `wikiEditorMode`, v38) | store | CRUD | itself (lines 36, 111, 322, 382-536) | exact |
| `lib/shortcuts.ts` + `components/app/KeyboardShortcutsPanel.tsx` (modify: 'Editor' category) | config | none | itself | exact |
| `lib/wiki/editor/bundle-guard.test.ts` (modify) | test | batch | itself | exact |
| `components/wiki-editor/*.test.ts(x)` | test | - | `routes/dev-tools/NotificationsTab.test.tsx`; `lib/wiki/editor/*.test.ts` | role-match |
| `lib/typing-target.test.ts` | test | event-driven | existing `useImageViewer` tests | role-match |

## Pattern Assignments

### `lib/wiki/editor/engine.ts` (service, transform) - schema-identity fix

**Analog:** itself, lines 96-107. Replace lines 97-102 so `current` is normalised to `wikiSchema` (RESEARCH "Engine fix"):

```ts
export function saveWiki(loaded: Extract<WikiLoad, { doc: unknown }>, current: PMNode): WikiSave {
  if (current.eq(wikiSchema.nodeFromJSON(loaded.doc))) {   // <- always false for editor.state.doc
    return { kind: 'unchanged', text: loaded.original };
  }
  try {
    const emitted = emitWiki(current);
    const reason = checkSaved(current.toJSON(), emitted);
```

Normalise first: `const cur = current.type.schema === wikiSchema ? current : wikiSchema.nodeFromJSON(current.toJSON());` and use `cur` in `eq`, `emitWiki`, `checkSaved`. Keep the never-throws contract (put the nodeFromJSON inside the try, return `failed` with `errorMessage(err)`). Test goes in `lib/wiki/editor/engine.test.ts`: new `Editor({extensions: wikiExtensions})` over `loadWiki(text).doc` gives `unchanged`.

### `lib/wiki/editor/schema.ts` (config) - export consts for `.extend()`

**Analog:** itself. `Panel`, `RawBlock`, `RawInline` (lines 79-115) are `const` and unexported; the StarterKit options are an inline literal (lines 182-190). Export `Panel`, `RawBlock`, `RawInline` and hoist the options object to `export const STARTER_KIT_OPTIONS = { code: false, link: {...}, undoRedo: false, dropcursor: false, gapcursor: false, trailingNode: false, listKeymap: false }`. Keep array order in `wikiExtensions` (mark ranks). Module-scope only; no React imports (bundle-guard).

### `lib/wiki/prose.ts` (new) + `WikiRenderer.tsx` (modify)

**Analog:** `routes/dashboard/WikiRenderer.tsx` lines 256-263 (callout classes) and 526-546 (`prose ...` class list inside `cn(...)`). Move both verbatim into `lib/wiki/prose.ts` as `export const calloutStyles` and `export const WIKI_PROSE_CLASSES` (string array or joined), imports nothing from `editor/` or tiptap. WikiRenderer then does `cn(WIKI_PROSE_CLASSES, className)`. Keep as plain string literals so the Tailwind v4 scanner finds them. The WikiRenderer pipeline tests must stay green (output unchanged). Callout excerpt:

```ts
const calloutStyles: Record<string, string> = {
  info: 'border-l-4 border-blue-500 bg-blue-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  tip: 'border-l-4 border-green-600 bg-green-600/10 ...',
  warning: 'border-l-4 border-amber-500 bg-amber-500/10 ...',
  note: 'border-l-4 border-yellow-500 bg-yellow-500/10 ...',
  panel: 'border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2 ...',
};
```

PanelView uses `calloutStyles[node.attrs.type]` so the rich panel looks identical to the renderer. Note: WikiRenderer's public prop is `wikiText` (line 293: `WikiRenderer({ wikiText, className, attachments, users })`), NOT `markdown` as RESEARCH's diagrams say. Use `<WikiRenderer wikiText={...} />` for the source preview and raw-atom node views.

### `lib/typing-target.ts` (utility, event-driven) + the three raw listeners

**Analog:** `routes/dashboard/useImageViewer.ts` lines 29-33 (duplicate in `issue-detail/AttachmentPreviewModal.tsx` 403-408 and `AioTestRunDetailPage.tsx`):

```ts
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
```

Extract to `lib/typing-target.ts` as `isTypingTarget` (add `SELECT`). Replace the three inline copies. **AttachmentPreviewModal fix (RESEARCH audit):** the guard currently only wraps the font-zoom keys (line 412); the arrow navigation at lines 431-435 is unguarded. Add `if (isTypingTarget(e.target)) return;` before the `ArrowLeft/ArrowRight` branch (after the `defaultPrevented` line 411). Note jsdom does not implement `isContentEditable`; in tests set it via `Object.defineProperty(el, 'isContentEditable', {value: true})`.

### `components/wiki-editor/WikiEditorLazy.tsx` (component, lazy load)

**Analog:** `routes/routes.tsx` lines 10-13 and 24-26:

```tsx
const Dashboard = lazy(() => import('./dashboard/index'));
...
<Suspense fallback={<RouteSpinner />}>
```

Copy: `const WikiEditor = lazy(() => import('./WikiEditor'));` with a `Suspense` fallback built from `components/ui/skeleton.tsx` (`<Skeleton className="..."/>`, uses `bg-accent animate-pulse rounded-md`), identical in height to toolbar (40px) + min-height (160 full / 96 compact). Wrap in an error boundary (no existing class-based boundary pattern was searched here; check `components/ui/error-state.tsx` for the visual) with the spec copy "The editor couldn't load...". This file is the only eager entry; it must not statically import tiptap.

### `components/wiki-editor/toolbar/Toolbar.tsx` + `OverflowMenu.tsx` (container-query collapse)

**Analog:** `components/ui/page-header.tsx` lines 19-23 and 60-64. Pattern: `@container` on the OUTER element, padding/styling on an INNER row, variants as plain string literals:

```ts
export const headerActionLabel = 'hidden @[44rem]:inline';
export const headerActionButton = '@max-[44rem]:w-7 @max-[44rem]:px-0';
...
<header className={cn('@container shrink-0 border-b border-border', className)}>
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
```

Apply: frame outer = `@container relative`; toolbar row inside is `flex flex-nowrap` (D-02: one row, never wrap); low-priority buttons get `hidden @[Nrem]:inline-flex`, and the same items appear in the `⋯` menu with the inverse `@[Nrem]:hidden` so they never render twice. The mode toggle is the last, `flex-none` child and is never in the menu. Sticky: toolbar `sticky top-0 z-10 bg-background` inside a scroller that has `relative` (sr-only scroller gotcha).

### `components/wiki-editor/toolbar/ToolbarButton` (tooltip with label + keycaps, D-04)

**Analog 1:** `routes/dashboard/AioCyclesScopeBar.tsx` lines 38-62 (Base UI tooltip with `render` prop):

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
<Tooltip>
  <TooltipTrigger delay={0} render={<Badge .../>}>...</TooltipTrigger>
  <TooltipContent><TooltipBody title="...">...</TooltipBody></TooltipContent>
</Tooltip>
```

**Analog 2 (keycap look):** `components/app/KeyboardShortcutsPanel.tsx` lines 24-29, where `keycapClass` and `Keycap` are module-private. Export them (or move into `components/ui/keycap.tsx`) rather than duplicating the string:

```tsx
const keycapClass = 'inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 text-[11px] font-medium font-mono bg-gradient-to-b from-muted to-muted/80 text-muted-foreground border border-border/80 rounded-[4px] shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]';
function Keycap({ children }) { return <kbd className={keycapClass}>{children}</kbd>; }
```

Toolbar buttons should use `onMouseDown={(e) => e.preventDefault()}` so the editor keeps focus. Icon-button style reference: `DescriptionEditor.tsx` ~line 128 `className="rounded p-1 hover:bg-accent disabled:opacity-50"` with lucide icons `h-4 w-4`.

### Popovers/menus (Colour, Link, Table grid, floating TableToolbar, TextStyle/Insert/Overflow menus)

**Analog:** `components/ui/popover.tsx` (lines 17-61). Already portals to body (`PopoverPrimitive.Portal`), `z-50` positioner, and passes `anchor` through:

```tsx
function PopoverContent({ className, keepMounted, side, align, sideOffset, alignOffset, anchor, collisionAvoidance, ...props })
```

For the floating table toolbar use `<Popover open={inTable}><PopoverContent anchor={() => tableDom} side="top" initialFocus={false} className="p-1">`. Default content padding is `p-4`; override with `className`. Menus: `components/ui/dropdown-menu.tsx` (not read here; planner should read it before writing menu items). Code-language picker: `components/ui/searchable-select.tsx` props `{ value?, onValueChange, options, pinnedOption?, placeholder?, searchPlaceholder?, emptyText?, disabled?, 'aria-label'?, testIdPrefix?, className? }`; "None" goes in `pinnedOption`. Inside a React node view, the SearchableSelect trigger must not steal ProseMirror selection: wrap in `contentEditable={false}`.

### `components/wiki-editor/nodeviews/*.tsx` (React node views)

No in-repo analog for `NodeViewWrapper`. Use RESEARCH Pattern 1/7. For look, reuse `calloutStyles` from `lib/wiki/prose.ts` (PanelView) and, for raw atoms, `<WikiRenderer wikiText={node.attrs.raw} />` inside a `border border-dashed` frame. Module-scope components only (React Compiler).

### `components/wiki-editor/insert-items.ts`, `palette.ts`, `languages.ts` (typed data lists)

**Analog:** `lib/shortcuts.ts` lines 1-60: an interface plus a typed exported static array with stable `id` slugs:

```ts
export interface ShortcutEntry { id: string; defaultKey: string; description: string; category: ShortcutCategory; displayKeys?: string[]; navMeta?: NavMeta; }
export const SHORTCUTS: ShortcutEntry[] = [ { id: 'show-shortcuts', defaultKey: '⌘/', description: '...', category: 'General', displayKeys: ['⌘', '/'] }, ...
```

Model `InsertItem { id; label; icon; keywords; run(editor) }` the same way (Phase 99's slash menu reads it). Every `palette.ts` entry and `languages.ts` option must be validated by a test through `isSafeColor` / `parseWiki('{code:LANG}\nx\n{code}')`.

### `lib/shortcuts.ts` + `KeyboardShortcutsPanel.tsx` (register Editor shortcuts, D-09 Cmd+Shift+M)

**Analog:** `lib/shortcuts.ts` line 12 `export type ShortcutCategory = 'Navigation' | 'Lists' | 'Actions' | 'General';` and entries like (lines 133-140):

```ts
{ id: 'nav-merge-requests', defaultKey: 'mod+shift+m', description: 'Go to Merge Requests', category: 'Navigation', displayKeys: ['⌘', '⇧', 'M'], navMeta: {...} },
```

Add `'Editor'` to the `ShortcutCategory` union and a `{ key: 'Editor', icon: ... }` row in `KeyboardShortcutsPanel.tsx` `CATEGORIES` (lines 17-21; the panel only renders categories listed there, so without this the entries are invisible). Editor entries must omit `navMeta`, use descriptions that say "while editing", and note that `mod+shift+m` / `mod+shift+b` / `mod+shift+s` collide with Navigation entries (safe only because react-hotkeys-hook ignores contenteditable and textarea). Check whether any code iterates `SHORTCUTS` for hotkey registration (a nav-only filter on `navMeta` is expected; verify so the editor entries are not registered as global hotkeys). Update `KeyboardShortcutsPanel.test.tsx` if it asserts the category list.

### `routes/dev-tools/EditorTab.tsx` (component) + `DevToolsPage.tsx` (modify)

**Analog:** `routes/dev-tools/NotificationsTab.tsx` (header comment style lines 1-8; imports lines 9-17; gating on `useSettingsStore((s) => s.devToolsEnabled)` with a "Developer Tools are disabled" message, asserted by `NotificationsTab.test.tsx`; small preview components like `OsNotificationPreview` for "rendered previews, not raw JSON"). Outcome-chip helper style to copy for the loadWiki/saveWiki kind chips:

```ts
function outcomeClass(outcome) {
  const base = 'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold';
  if (outcome === 'sent') return `${base} text-green-600 dark:text-green-400`;
  if (...) return `${base} bg-muted text-muted-foreground`;
  return `${base} bg-red-500/15 text-red-600 dark:text-red-400`;
}
```

**DevToolsPage edit** (file lines 55-74): add `<TabsTrigger value="editor">Editor</TabsTrigger>` after the notifications trigger, a `<TabsContent value="editor"><EditorTab /></TabsContent>`, update the header subtitle (lines 35-37) and the file doc comment ("four tabs"). `routes.tsx` imports `DevTools` eagerly (line 6: `import DevTools from './dev-tools/index'`), so `EditorTab` must only reach the editor via `WikiEditorLazy` and must load fixtures via a LAZY `import.meta.glob('../../lib/wiki/__fixtures__/**/*.wiki', { query: '?raw', import: 'default' })` (NOT eager, NOT `corpus.fixtures.ts`). Check the `__fixtures__` extension before writing the glob (`ls lib/wiki/__fixtures__`). Tests: copy `NotificationsTab.test.tsx` (`act(() => useSettingsStore.setState({ devToolsEnabled: true }))` in `beforeEach`).

### `stores/settings.store.ts` (store, CRUD) - `wikiEditorMode`

**Analog:** itself. Touch points: initial state (line ~36 `devToolsEnabled: false,`), interface (line ~111 `devToolsEnabled: boolean;`), setter (line 322 `setDevToolsEnabled: (v) => set({ devToolsEnabled: v }),`), `version: 37` (line 382), and append after the `version < 37` block (ends ~line 536):

```ts
if (version < 37) {
  if (s.onboardingVersion === undefined) {
    s.onboardingVersion = s.onboardingComplete === true ? 1 : 0;
  }
}
return persisted as SettingsState;
```

New: `wikiEditorMode: 'rich' | 'source'` (default `'rich'`), `setWikiEditorMode`, `version: 38`, `if (version < 38) { if (s.wikiEditorMode === undefined) s.wikiEditorMode = 'rich'; }`. Extend `settings.store.test.ts` (it reads the version from source text).

### `lib/wiki/editor/bundle-guard.test.ts` (modify)

**Analog:** itself. `collectStaticImports(entry, srcRoot)` (lines ~38-70) is private; `specifiersOf` (lines 14-24) deliberately ignores `import type` and dynamic `import()`. Export the walker into a helper module and add entries for `routes/dev-tools/index`, `routes/dev-tools/DevToolsPage.tsx` and `main.tsx`, asserting no bare specifier starts with `@tiptap/` or `prosemirror` and no file path starts with `components/wiki-editor/` or `lib/wiki/editor/` (except through dynamic import). Also assert `lib/wiki/prose.ts` stays clean. Caution: `main.tsx` may already statically reach `lib/wiki/*` that is allowed; only forbid the editor dir and tiptap/pm.

### Test files in `components/wiki-editor/`

**Analog:** `lib/wiki/editor/*.test.ts` (headless, pure) and `routes/dev-tools/NotificationsTab.test.tsx` (RTL + `act` + store reset). Headless-Editor helper `makeEditor(text)`: `new Editor({ extensions: editorExtensions, content: loadWiki(text).doc })`; jsdom needs no polyfills for transaction/undo tests (RESEARCH Pitfall 10). The compiler-compat test uses `@babel/core` + `babel-plugin-react-compiler` (`panicThreshold: 'all_errors'`).

## Shared Patterns

### Module-scope constants (React Compiler safety)
**Source:** `lib/wiki/editor/schema.ts` lines 5-12 (header comment) and 181-211.
**Apply to:** `extensions.ts`, node-view components, palette/languages/insert-items, `editorProps` objects. Create extensions, schema and node-view components once at module scope; never in render.

### Portal + z-index for overlays
**Source:** `components/ui/popover.tsx` lines 38-47 (`Portal` + `Positioner className="z-50"`); `components/ui/tooltip.tsx` lines 34-36 same.
**Apply to:** every toolbar popover/menu/tooltip, table toolbar, language select. Never render custom `fixed z-50` overlays inside the `isolate` `<main>`.

### Tooltip with label + keycaps
**Source:** `components/ui/tooltip.tsx` + `components/ui/tooltip-body.tsx` (`TooltipBody`, `TOOLTIP_SURFACE`) + `KeyboardShortcutsPanel.tsx` `keycapClass`.
**Apply to:** all toolbar buttons.

### Typing-target guard (FLOW-04)
**Source:** `useImageViewer.ts` lines 29-33 (to become `lib/typing-target.ts`).
**Apply to:** any raw `window`/`document` `keydown` listener. react-hotkeys-hook already ignores contenteditable (no `enableOnContentEditable` use in `src`).

### Settings persist + migration
**Source:** `stores/settings.store.ts` lines 382-536.
**Apply to:** `wikiEditorMode` only; bump `version` and add a `< 38` default.

### Sanitised rendering
**Source:** `WikiRenderer` (never `dangerouslySetInnerHTML`); `isSafeColor` in `lib/wiki/editor/parse/color.ts`.
**Apply to:** raw-atom node views, source preview, colour mark `style`.

### Pre-commit gate
Full vitest suite runs on commit; put RED and GREEN tests in the same commit. Biome lint blocks commits; run `biome check` only on changed files, never `--write` on all of `src`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `components/wiki-editor/WikiEditor.tsx` | component | value/onChange binding | No TipTap or ProseMirror UI exists; use RESEARCH Patterns 2, 4 |
| `components/wiki-editor/editor-session.ts` | utility | transform | New; RESEARCH Pattern 3 (`replaceDoc`, `closeHistory`, echo guard) |
| `components/wiki-editor/keymap.ts` | config | event-driven | No existing PM keymaps; RESEARCH Pitfall 6 and Shortcut Table |
| `components/wiki-editor/input-rules.ts` | config | event-driven | RESEARCH Pattern 5 |
| `components/wiki-editor/nodeviews/*` (`NodeViewWrapper`) | component | event-driven | Only styling analogs exist (`calloutStyles`, WikiRenderer) |
| Error boundary in `WikiEditorLazy.tsx` | component | - | Not searched exhaustively; check `components/ui/error-state.tsx` for visuals and grep `componentDidCatch` before writing a new class component |

## Metadata

**Analog search scope:** `taskflow/src/lib/wiki`, `lib/shortcuts.ts`, `components/ui`, `components/app`, `routes/dev-tools`, `routes/dashboard` (listeners, WikiRenderer, DescriptionEditor), `routes/routes.tsx`, `stores/settings.store.ts`
**Files scanned:** about 25 read or grepped
**Not read, planner should read before use:** `components/ui/dropdown-menu.tsx`, `components/ui/error-state.tsx`, `lib/wiki/editor/parse/{tables,color}.ts`, `lib/wiki/preprocess.ts` near line 708, `98-UI-SPEC.md` (visual contract: sizes, copy)
**Pattern extraction date:** 2026-11-17
