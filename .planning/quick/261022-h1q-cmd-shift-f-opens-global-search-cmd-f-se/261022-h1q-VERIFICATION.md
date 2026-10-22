---
quick_id: 261022-h1q
verified: 2026-10-22
status: human_needed
score: 8/8 must-haves verified in code; runtime/UI checks pending
human_verification:
  - test: "npm run tauri dev (Rust rebuild required): Cmd+Shift+F opens the palette; Cmd+F does not"
    expected: "Palette opens only on Cmd+Shift+F. Cmd+F shows the find bar. No native WKWebView find appears."
    why_human: "Native menu accelerators and WKWebView key handling cannot be checked in jsdom"
  - test: "Cmd+F on Backlog or an issue page; type 'zluty' or 'cafe'"
    expected: "Bar appears top-right of the content area. Accented text is highlighted. Sidebar and pinned-tab labels are never highlighted."
    why_human: "Real layout, the Highlight API in WebKit, and visibility checks"
  - test: "Peek panel open, then an attachment preview or Dialog open, then Cmd+F; press Esc"
    expected: "Peek panel is searched. Inside a modal the bar sits inside it. Esc closes only the bar."
    why_human: "Layered Base UI dialog and Esc propagation behaviour"
  - test: "Navigate to another route with the bar open; check highlight colours in light and dark themes"
    expected: "Bar closes on route change. Both colours are readable."
    why_human: "Visual check"
---

# Quick 261022-h1q Verification

**Goal:** Cmd+Shift+F opens the palette. Cmd+F is a custom find-in-page over page content only (not the sidebar or pinned bar). It is case-insensitive, live and accent-insensitive.

**Status:** human_needed. All code-level truths are verified and no gaps were found. The plan's own human-check (tauri dev) is still outstanding, as the SUMMARY admits.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cmd+Shift+F opens the palette; Cmd+F does not | VERIFIED | `main.tsx:292`: capture handler on `e.code === 'KeyF'`, shift opens the palette, otherwise `openFind()`. The old `e.key === 'f'` is gone. `lib.rs` palette accelerator is `CmdOrCtrl+Shift+F`. |
| 2 | Cmd+F searches only main, the topmost modal or Peek, never the sidebar or pinned bar | VERIFIED | `resolveFindScope` returns modal, then `[data-find-scope="peek"]`, then `[data-find-scope="main"]`. `data-find-scope="main"` is on `<main>` and `"peek"` is on the PeekPanel root. The sidebar and pinned bar are outside both. `collectRuns` walks only the scope. |
| 3 | Case- and accent-insensitive matching | VERIFIED | `foldText` does lowercase, NFD, and strips `\p{M}`, with an offset map. `findInRuns` uses indexOf, not a RegExp. 17 engine tests pass. |
| 4 | Live updates, with no scroll on background recompute | VERIFIED | `FindBar` has a debounced (150 ms) MutationObserver that ignores `[data-find-bar]` mutations. A `'mutation'` recompute never calls `scrollRangeIntoView`. |
| 5 | Counter, Enter, Shift+Enter, Esc, and Cmd+F re-focus | VERIFIED | The counter is `n/m`, `+` when capped, or "No results". `onKeyDown` handles Enter, Shift+Enter and Escape with stopPropagation. A `focusSignal` effect focuses and selects. Highlights are cleared on unmount. |
| 6 | Current match is stronger and scrolled into view | VERIFIED | `find-current` has priority 1 and a solid orange CSS rule. `step()` and a query change call `scrollRangeIntoView`. |
| 7 | Closes on route change; Cmd+F is a no-op while the palette is open | VERIFIED | A `[location.pathname]` effect clears `findState`. `openFind` returns early on `paletteOpenRef`. |
| 8 | Shortcuts registry lists both | VERIFIED | `shortcuts.ts` has `open-palette` as `mod+shift+f` with ⌘⇧F, and a new `find-in-page` as `mod+f` with ⌘F. `shortcuts.test.ts` covers it. |

## Artifacts and wiring

- `find-in-page.ts`, `FindBar.tsx` and the `index.css` highlight rules exist, are substantive and are wired. `main.tsx` imports and renders `FindBar`, and `listen('menu-find')` calls `openFind`.
- `lib.rs`: the Find item (`menu-find`, `CmdOrCtrl+F`) is in the Edit menu and in the `on_menu_event` arm. The SUMMARY's explanation for 2 occurrences of `menu-find` instead of 3 is accurate (`.id` plus the match arm).
- No other code binds `mod+f`. `useHotkeys` is not used for it, so there is no conflicting binding.

## Spot-checks run

- `vitest` on find-in-page, FindBar and shortcuts: 3 files, 28 tests pass.
- `tsc --noEmit`: clean.
- `biome check` on 4 touched source files: clean.

## Anti-patterns

- None blocking. No TODO, FIXME or TBD markers in the touched files.
- Info: a decomposed (NFD) `e` plus a combining mark ends the match at the base letter, so the mark is left outside the highlight. Cosmetic only. The test uses a precomposed string despite its "decomposed" title.
- Info: whitespace-only text nodes are dropped from runs, so a space-only sibling between two text nodes is lost. Accepted limitation.
- Info (documented limitations): matches across inline element boundaries are not found, and virtualized off-screen rows are not searched.
- Info (deviation): literal oklch highlight colours are used instead of chart tokens. This is justified because both chart tokens are blue.

## Gaps

None.
