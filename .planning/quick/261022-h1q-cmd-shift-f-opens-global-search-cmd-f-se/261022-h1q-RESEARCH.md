# Quick Task 261022-h1q: Cmd+Shift+F global search / Cmd+F find-in-page - Research

**Researched:** 2026-10-22
**Domain:** Custom find-in-page (CSS Custom Highlight API, DOM text walking, keyboard and menu routing in Tauri)
**Confidence:** HIGH (codebase facts verified by grep/probe), MEDIUM (WebKit specifics)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Matching: case-insensitive; live (recompute on typing AND on content change via debounced MutationObserver); accent/diacritic-insensitive ("cafe" matches "café", "zluty" matches "žlutý"). Normalize NFD and strip combining marks, with a per-character index map back to the original text offsets.
- Highlighting: CSS Custom Highlight API (`CSS.highlights`, `::highlight(name)`), no DOM mutation. Two highlights: all matches and the current match.
- Native find is not usable (WKWebView has no find bar, Tauri has no find API). Custom implementation.

### Claude's Discretion
- Find bar: small floating bar at the top-right of the searched region, no layout shift. Input, "n/m" counter or "No results", prev/next, close. Enter = next, Shift+Enter = prev, Esc = close and clear. Cmd+F while open re-focuses and selects the input. The current match gets a stronger highlight and is scrolled into view. Use existing tokens/primitives, theme-aware.
- Scope: `<main>` by default (excludes sidebar and pinned bar). The topmost layer wins: a modal dialog or the Peek panel. Exclude the find bar, hidden elements, aria-hidden subtrees, script/style, and form-control values.
- Virtualized lists: only rendered text is searched (accepted limitation).

### Deferred Ideas (OUT OF SCOPE)
- None listed.

### Specifics
- Update the `open-palette` entry in shortcuts.ts to ⌘⇧F and add a "Find in page" entry (⌘F). Cmd+Shift+F is free among the mod+shift nav bindings.
</user_constraints>

## Project Constraints (from CLAUDE.md)
There is no CLAUDE.md at the repo root or in the app directory. Project rules from memory that apply here:
- `.planning`/git live at `/Users/mimo/Documents/Projects/taskflow`. `src`, npm, vitest and biome live in `taskflow/`.
- The pre-commit hook runs the full vitest suite plus biome and tsc. RED commits are blocked, so make one commit per TDD task.
- Don't run `biome --write` on all of `src`. Gate on "no NEW files flagged", not on a diagnostic count.
- React Compiler runs in the app but not in vitest. Hidden module-level reads go stale only in the app. Keep the find state in React state or a store, not in module variables that render reads.
- Don't bulk find-replace identifiers that also appear in labels.

## Summary

**Primary recommendation:** Do the Cmd+F rebind in three places: the JS capture handler, the shortcuts registry, and the **native Tauri menu accelerator**. Build find-in-page from three parts:
- a pure, unit-tested matcher (`src/lib/find-in-page.ts`)
- a DOM collector and highlighter (TreeWalker, live `Range`s, `CSS.highlights`)
- a `FindBar` component in `AppLayout`. Portal it into the active modal popup when a modal is the scope. Otherwise it is `position: fixed` and placed from the scope's bounding rect.

### Key findings
1. **Native menu owns Cmd+F.** `src-tauri/src/lib.rs:328-329` binds Help > "Command Palette" with `.accelerator("CmdOrCtrl+F")`, which emits `menu-command-palette` (listened to in `main.tsx`). Today the menu path and the JS handler both open the palette, so it doesn't matter which one fires. After the change:
   - Set the palette accelerator to `CmdOrCtrl+Shift+F`.
   - Add a "Find…" menu item (Edit menu, `CmdOrCtrl+F`, id `menu-find`). Add it to the `on_menu_event` match arm and listen for it in `main.tsx`.
   - Keep the JS capture handlers too.
   - Make both actions idempotent ("open or refocus") so it is harmless if both fire. [VERIFIED: codebase grep] Whether an NSMenu key equivalent stops the webview keydown from reaching JS is [ASSUMED]. Handling both paths avoids depending on it.
2. **The JS handler checks `e.key === 'f'` and `!e.shiftKey`** (`main.tsx:249`). With Shift held, `e.key` can be `'F'`. Match on `e.code === 'KeyF'`, which is layout-stable (the file already uses code names for react-hotkeys-hook #1125). Use one capture-phase listener that branches on `shiftKey`.
3. **CSS Custom Highlight API:**
   - TS typings ship in TypeScript 5.9 `lib.dom.d.ts` (`Highlight`, `HighlightRegistry`, `CSS.highlights`). The project lib is `["ES2020","DOM","DOM.Iterable"]`, so no extra typings are needed. [VERIFIED: node_modules/typescript/lib/lib.dom.d.ts]
   - jsdom 29 has `CSS` but no `CSS.highlights`, no `Highlight`, no `checkVisibility`, no `scrollIntoView`. `getClientRects()` returns 0 for every element. [VERIFIED: vitest probe]
   - Safari supports the API from 17.2. [CITED: MDN ::highlight, "Baseline 2026"; Safari version ASSUMED]
4. **Base UI popovers also render `role="dialog"`.** `useRole` defaults to `'dialog'`. Base UI Dialog/Sheet popups do NOT set `aria-modal`. So `[role=dialog][aria-modal]` misses real modals, and `[role=dialog]` wrongly catches popovers. Use the explicit selector below. [VERIFIED: node_modules/@base-ui/react 1.3.0]
5. **Base UI modal dialogs trap focus and `markOthers` sets aria-hidden on everything outside**, which includes `<main>`. Clicking outside the popup dismisses it. A find bar mounted outside the dialog would lose focus and close the dialog, so it must be **portaled inside the popup** when a dialog is the scope. [VERIFIED: FloatingFocusManager.js:370]

## Architectural Responsibility Map

| Capability | Primary Tier | Notes |
|---|---|---|
| Shortcut dispatch (Cmd+F, Cmd+Shift+F) | Tauri native menu + Browser capture listener | Both paths call the same idempotent open functions |
| Scope resolution, text walking, highlighting | Browser (DOM) | Imperative module driven by a React hook |
| Normalization and matching | Pure TS lib | Unit-tested, no DOM |
| Find bar UI | React component in `AppLayout` | State in `useState` or a small store |

## Standard Stack
No new packages. Uses existing React 19, Base UI 1.3.0, Tailwind v4, lucide-react, existing `Button`/`Input` in `src/components/ui/`. **Package Legitimacy Audit:** not applicable, because nothing is installed.

Existing helpers: `src/lib/search-text.ts` has `lowerSameLength` (not exported) but **no accent folding**, and its `matchText` is fuzzy/token-based, which is wrong for find. Write a new, separate pure module. Don't change `search-text.ts`, which the palette ranking depends on.

## Architecture Patterns

### Data flow
```
Cmd+F (capture keydown)  ─┐
Menu "Find…" (menu-find) ─┴─> openFind(): if open → focus+select input; else resolve scope, open
                                   │
query change / MO tick (150ms) ──> collect text runs in scope (TreeWalker)
                                   → normalize + match per run (pure)
                                   → visibility-check ONLY runs that matched
                                   → build Range[] → CSS.highlights 'find-all' / 'find-current'
Enter / Shift+Enter / query change ──> set current idx → scrollRangeIntoView(current)
Esc / close ──> CSS.highlights.delete(both), disconnect MO, restore focus
```

### Recommended files
- `src/lib/find-in-page.ts`: pure functions `foldText(str) → { folded, starts[], ends[] }` and `findInRuns(runs: string[][], query) → Match[]`. The DOM side lives here or in `find-in-page-dom.ts`: `resolveFindScope()`, `collectRuns(scope, exclude)`, `scrollRangeIntoView(range)`.
- `src/lib/find-in-page.test.ts`
- `src/components/app/FindBar.tsx` (+ test)
- `src/main.tsx`: rebinding and mounting
- `src/lib/shortcuts.ts`: registry entries
- `src-tauri/src/lib.rs`: menu accelerators
- `src/index.css`: `::highlight()` rules

### Pattern 1: Accent folding with offset map (pure)
Iterate code points. For each original char, fold it with `ch.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')`. For each UTF-16 unit of the folded output, push `starts.push(i)` and `ends.push(i + ch.length)`, where `i` is the original UTF-16 index. A match `[a, b)` in folded space maps to original `[starts[a], ends[b-1])`. Keeping both start and end per unit handles chars that expand (for example `Ǆ` → `dz`) and chars that fold to empty (standalone combining marks). An optional polish: extend the end over trailing combining marks so a grapheme is never split. Fold the query the same way and trim it. An empty query means no matches.
```ts
// verified in vitest: 'žlutý café'.normalize('NFD').replace(/\p{M}/gu,'') === 'zluty cafe'
export function foldText(text: string) {
  let folded = ''; const starts: number[] = []; const ends: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = ch.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    for (let k = 0; k < f.length; k++) { starts.push(i); ends.push(i + ch.length); }
    folded += f; i += ch.length;
  }
  return { folded, starts, ends };
}
```

### Pattern 2: Matching granularity: per sibling text-node run (recommended)
- **Don't concatenate the whole scope.** Adjacent cells or badges ("Status""Done") would create false matches across element boundaries. Inserting separators properly needs computed display per element, which is too expensive.
- **Don't do strictly one text node at a time either.** React splits `{n} items` and `{a} {b}` into sibling text nodes in the same parent, and per-node matching misses those.
- **Use runs:** a run is a maximal sequence of consecutive sibling **text nodes** with no element between them. Concatenate the run, with a segment table mapping run offsets to (node, offset). A `Range` can start and end in different nodes.
- Accepted limitation: no matches across inline elements (`foo <strong>bar</strong>`, `HighlightedText` `<mark>` splits). Document this in the summary.
- Cap the total at 1000 matches and show "1000+". Non-overlapping matches: after a hit, advance the search position by the query length.

### Pattern 3: Scope resolution (topmost layer)
```ts
const MODAL_SEL = '[data-slot="dialog-content"],[data-slot="sheet-content"],[role="dialog"][aria-modal="true"],[role="alertdialog"]';
// last matching connected element in document order = topmost (portals append to body in open order)
const modals = [...document.querySelectorAll<HTMLElement>(MODAL_SEL)].filter(el => el.isConnected && !el.closest('[data-closed],[inert]'));
scope = modals.at(-1) ?? peekEl ?? mainEl;
```
- **Modal sources:**
  - Base UI `Dialog` (`ui/dialog.tsx`, `data-slot="dialog-content"`)
  - Base UI `Sheet` (`ui/sheet.tsx`, `data-slot="sheet-content"`)
  - Custom modals: `ImageLightbox.tsx:30` and `AttachmentPreviewModal.tsx:425` (`role="dialog"`; Lightbox has `aria-modal="true"`. Check that AttachmentPreviewModal has it too, and add it if missing)
  - AlertDialog
- **Base UI popovers, menus and selects** have `role="dialog"`/`listbox` without data-slot dialog-content, so the selector excludes them.
- **CommandPalette is not a dialog.** It is a custom `fixed inset-0 z-50` div with `role="button"`. While `paletteOpen`, make Cmd+F a no-op (or close the palette first). Recommend no-op.
- **PeekPanel has no role and no ref.** The root is `<div className="relative ... overflow-hidden flex flex-col">` (`PeekPanel.tsx:117`), rendered as a sibling of `<main>` inside `<div className="flex flex-row flex-1 overflow-hidden min-h-0">` (`main.tsx:652-683`). Add `data-find-scope="peek"` to the Peek root and `data-find-scope="main"` to `<main>`, and query by attribute. Avoid prop-drilling refs. "Peek wins over main" follows the decision. Note that Peek is non-modal and main is still visible next to it.
- **Scope changes while open:** on each MO tick, if `!scope.isConnected` or `resolveFindScope() !== scope`, close the find bar. Simpler and more predictable than silently re-scoping.

### Pattern 4: Mounting the find bar
- **Dialog scope:** `createPortal(<FindBar/>, scopeEl)` with `absolute top-2 right-12 z-10`. Use `right-12` to clear the `top-2 right-2` close button in `ui/dialog.tsx:61`. The dialog popup is `fixed ... -translate-x-1/2 -translate-y-1/2`, so it is the containing block for absolute and fixed children. Inside the popup, focus trap and outside-press both work.
- **Main/Peek scope:** `createPortal(<FindBar/>, document.body)` with `position: fixed`. Set `top = rect.top + 8` and `right = innerWidth - rect.right + 16` from `scope.getBoundingClientRect()`. Recompute on window resize, and with a ResizeObserver on the scope because the Peek width drags and the sidebar toggles. Don't make `<main>` `relative`: it is `overflow-auto` and scrolls on some pages, so an absolute child would scroll away. On `h-full` pages inner containers scroll instead. Fixed positioning handles both.
- Mark the bar root `data-find-bar` and exclude it in the walker.

### Pattern 5: Text collection and the cost of hidden-element filtering
- `document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode })`.
- **Elements:** return `FILTER_REJECT`, which prunes the whole subtree, for:
  - `SCRIPT/STYLE/NOSCRIPT/TEMPLATE/TEXTAREA/INPUT/SELECT/svg`
  - `[hidden]`, `[aria-hidden="true"]`, `[inert]`, `[data-find-bar]`
  - optionally `.sr-only`
  These are attribute checks only, so they are cheap.
- **Text nodes:** skip whitespace-only nodes.
- **Visibility (display:none, visibility:hidden, collapsed `<details>`):** check it only for runs that produced a match, not for every element. Cache the result per parent element in a `Map` for the duration of one pass. Use `el.checkVisibility?.({ visibilityProperty: true, opacityProperty: false })`. Safari 17.4+ supports it [ASSUMED]. Fall back to `getClientRects().length > 0`.
- **jsdom caveat:** it returns 0 rects and lacks `checkVisibility`. Inject the visibility predicate as a parameter (default = real check) and pass `() => true` in tests. Otherwise every DOM test returns zero matches.

### Pattern 6: Highlights
```ts
const supported = typeof Highlight !== 'undefined' && 'highlights' in CSS;
const all = new Highlight(...ranges); const cur = new Highlight(ranges[idx]);
cur.priority = 1; // current wins over all where they overlap
CSS.highlights.set('find-all', all); CSS.highlights.set('find-current', cur);
```
In `src/index.css`, `::highlight()` accepts only `color`, `background-color`, `text-decoration*`, `text-shadow`, and `-webkit-text-stroke/fill`. `background-image`, padding, border and border-radius are ignored. [CITED: developer.mozilla.org/en-US/docs/Web/CSS/::highlight]
```css
::highlight(find-all) { background-color: color-mix(in oklch, var(--chart-4) 35%, transparent); }
::highlight(find-current) { background-color: var(--chart-3); color: var(--primary-foreground); }
```
Pick tokens that read well in both themes and check them at UAT. If `supported` is false, the counter still works and nothing paints. Never fall back to DOM-mutating `<mark>`, because it fights React.

### Pattern 7: Scrolling the current match
There is no `Range.scrollIntoView`. Use `range.startContainer.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' })`. This handles nested scroll containers (main, the Peek inner area, dialog bodies) natively. For long blocks, such as a wiki paragraph or code block taller than the viewport, follow it with a refinement: find the nearest scrollable ancestor (`overflow-y` auto/scroll and `scrollHeight > clientHeight`). If `range.getBoundingClientRect()` is outside that ancestor's rect, adjust `scrollTop` by the delta to centre it. Guard `scrollIntoView` with `?.`, since jsdom lacks it (or stub it in the test).
**Only scroll on user navigation or query change, never on MO-driven recomputes.** Otherwise background React Query refetches jump the page.

### Pattern 8: MutationObserver
- `observe(scope, { childList: true, subtree: true, characterData: true })`.
- Debounce with a trailing 150 ms timer.
- In the callback, drop records whose `target` is inside `[data-find-bar]`. This matters for the dialog case, where the bar's counter text lives inside the scope. If no records remain, do nothing.
- The Highlight API itself produces no mutations.
- After a recompute, keep the current match stable: pick the first new match whose start is at or after the old current range's start (compare with `range.compareBoundaryPoints`). Otherwise clamp the index.
- Disconnect the observer and clear the timer on close and unmount.
- Live `Range`s whose nodes React replaced collapse silently, and the next tick repairs them.
- Virtualized tables re-render rows on scroll, so counts change while scrolling. This is the accepted limitation.

## Keyboard conflicts (verified inventory)

| Listener | Location | Interaction with find bar |
|---|---|---|
| Palette Cmd+F capture | `main.tsx:246-256` | Replace with one capture handler: `code==='KeyF' && mod && !alt` → shift ? palette : find. Both call `preventDefault`. |
| Native menu `CmdOrCtrl+F` | `src-tauri/src/lib.rs:329` | Change to `CmdOrCtrl+Shift+F`. Add a `menu-find` item with `CmdOrCtrl+F` and add it to the `on_menu_event` match list (`lib.rs:375-391`). |
| PeekPanel `useHotkeys('escape', onClose, {enableOnFormTags:false})` | `PeekPanel.tsx:106` | Doesn't fire while focus is in the find input. Good. |
| Base UI `useDismiss` Escape | document **bubble** keydown | Call `e.stopPropagation()` in the input's React `onKeyDown` for Escape, Enter and Shift+Enter. React's root listener runs before the document bubble, so Esc closes only the find bar and not the dialog. |
| ImageLightbox / AttachmentPreviewModal document keydown | `ImageLightbox.tsx:17`, `AttachmentPreviewModal.tsx:338` | Document bubble. Stopping propagation in React handles them too. |
| AioTestRunDetailPage window ArrowLeft/Right | `AioTestRunDetailPage.tsx:107-117` | Ignores INPUT. No conflict. |
| CommandPalette / KeyboardShortcutsPanel / UnifiedFilterBar / CommentComposer etc. `useHotkeys` escape | various | Scoped to their own open state or form tags. No conflict found. |

Cmd+F inside a focused text input (for example the comment composer) must still open find. The capture listener on `document` handles this regardless of the focused element, which is the existing behaviour. After closing, restore focus to `document.activeElement` as it was before opening, if it is still connected.

## Common Pitfalls
1. **Menu accelerator not updated.** Cmd+F would keep opening the palette through `menu-command-palette` even with the JS fixed. Change the Rust code, then rebuild the Tauri app; Vite HMR is not enough.
2. **`e.key` casing with Shift.** Use `e.code === 'KeyF'`.
3. **Using a role selector for modals.** Base UI popovers are `role="dialog"`. Use the data-slot selector.
4. **Find bar outside a focus-trapped modal.** Focus gets stolen and an outside press dismisses the dialog. Portal it into the popup.
5. **Scrolling on live recompute.** The page jumps during refetches.
6. **jsdom gaps:** no Highlight, no `CSS.highlights`, no `checkVisibility`, no `scrollIntoView`, zero rects. Use feature detection, an injected visibility predicate, and stubs in tests.
7. **React Compiler:** don't read module-level mutable state (for example a `let matches` in the lib) during render. The counter must come from `useState` set by the engine callback.
8. **Own mutations feeding the MO** (dialog case). Filter `[data-find-bar]` records.
9. **Highlight leak.** Always delete both registry entries on close, unmount and route change. Highlights would otherwise keep painting stale ranges after navigation. Close the find bar on `location.pathname` change, which is the simplest option.

## Existing tests and docs to update
- **No test asserts Cmd+F → palette or the `open-palette` displayKeys.** grep for `open-palette|mod+f|'⌘', 'F'` in `*.test.*` finds nothing. `KeyboardShortcutsPanel.test.tsx` checks only the ⌘/ entry and the "General" heading. [VERIFIED]
- **Registry:** `shortcuts.ts:64-69` `open-palette` (`defaultKey: 'mod+f'`, `displayKeys: ['⌘','F']`) becomes `'mod+shift+f'`, `['⌘','⇧','F']`. Add `{ id: 'find-in-page', defaultKey: 'mod+f', description: 'Find in page', category: 'General', displayKeys: ['⌘','F'] }`. Don't give it `navMeta`, so it stays out of `NAV_SHORTCUTS` (`shortcuts.ts:181`) and the palette nav list.
- Update the comment at `main.tsx:246` (PALETTE-01). TopBar's Search button has no shortcut hint, so no change there.
- Consider a small `shortcuts.test.ts` asserting the two entries, so the registry can't drift again.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest 4.1 + jsdom 29 + @testing-library/react (`taskflow/vitest.config.ts`, setup `src/test/setup.ts`) |
| Quick run | `cd taskflow && npx vitest run src/lib/find-in-page.test.ts src/components/app/FindBar.test.tsx` |
| Full suite | `cd taskflow && npx vitest run` (also runs in pre-commit) |

| Behavior | Test type | File |
|---|---|---|
| Fold/offset map: "žlutý"/"café"/decomposed `é`/`İ`/expanding chars map back correctly | unit | `src/lib/find-in-page.test.ts` (new) |
| Case- and accent-insensitive matches, non-overlapping, cap 1000, empty query | unit | same |
| Run matching across sibling text nodes, not across elements | unit (jsdom DOM) | same |
| Walker excludes `[hidden]`, `aria-hidden`, script/style, `[data-find-bar]`, inputs; visibility predicate injected | unit (jsdom) | same |
| Scope resolution: dialog-content > peek > main; popover `role=dialog` ignored | unit (jsdom) | same |
| FindBar keys: Enter/Shift+Enter cycle the counter, Esc closes + `stopPropagation`, "No results" | component | `src/components/app/FindBar.test.tsx` (new). Stub `globalThis.Highlight` (class storing ranges) + `CSS.highlights = new Map()`, `Element.prototype.scrollIntoView = vi.fn()` |
| Registry entries ⌘⇧F palette / ⌘F find | unit | `src/lib/shortcuts.test.ts` (new) |
| Real highlight paint, scroll-into-view, menu accelerator routing, dialog focus trap | manual UAT in the Tauri app | not reproducible in jsdom |

Wave 0: none. The infrastructure exists. Put the Highlight/`CSS.highlights` stubs in the test file, not in global setup.

## Security Domain
Client-only UI with no new input sinks. The query is used only as a plain substring (`indexOf`), never as a RegExp. If a regex is ever used, escape it to avoid ReDoS and syntax errors. Rendering uses `textContent`/React only. ASVS V5: no other categories apply.

## Environment Availability
Rust/Tauri toolchain needed to rebuild for the menu accelerator change (`npm run tauri dev`). Otherwise no external dependencies.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The NSMenu key equivalent may swallow the webview keydown | Low. The design handles both paths idempotently |
| A2 | WKWebView supports Highlight API (Safari 17.2+) and `checkVisibility` (17.4+) on target macOS | Low. Feature-detected with fallbacks |
| A3 | Opening portals append to body in open order, so the last match is the topmost | Low. Nested Base UI dialogs follow this |
| A4 | `AttachmentPreviewModal` lacks `aria-modal` (only `role="dialog"` seen at :425) | Low. Add the attribute or match it by an explicit `data-find-scope` |

## Open Questions
1. Should Cmd+F while the palette is open be a no-op or close the palette and open find? Recommend no-op.
2. Should find close on route change or re-run on the new page? Recommend close (simplest, no stale ranges).

## Sources
- Codebase (verified): `taskflow/src/main.tsx:246-256, 652-683`; `src/lib/shortcuts.ts:48-69,181`; `src-tauri/src/lib.rs:326-391`; `src/components/app/PeekPanel.tsx:101-121`; `src/components/ui/dialog.tsx:49-61`, `sheet.tsx:51`; `node_modules/@base-ui/react` 1.3.0 (`DialogStore.js:76`, `useRole.js:20`, `useDismiss.js:399`, `FloatingFocusManager.js:370`); `node_modules/typescript/lib/lib.dom.d.ts:17811-17837,37534`
- vitest/jsdom probe run 2026-10-22: `CSS` object present; `CSS.highlights`, `Highlight`, `checkVisibility`, `scrollIntoView` undefined; `getClientRects().length === 0`; NFD fold of "žlutý café" = "zluty cafe"
- [MDN ::highlight](https://developer.mozilla.org/en-US/docs/Web/CSS/::highlight): allowed properties, Baseline 2026

**Valid until:** 2026-11-22
