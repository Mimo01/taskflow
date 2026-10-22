---
quick_id: 261022-h1q
status: complete
commits: [3337e2f9, 0437cb17, ed1061be]
---

# Quick 261022-h1q: Cmd+Shift+F palette, Cmd+F find-in-page

Cmd+Shift+F now opens the command palette. Cmd+F opens a custom find bar that searches only `<main>`, the Peek panel or the topmost modal. Matching is case- and accent-insensitive and updates live. Highlights use the CSS Custom Highlight API.

## Commits
- 3337e2f9 find-in-page engine (`src/lib/find-in-page.ts`, 17 tests)
- 0437cb17 `FindBar` component, highlight CSS (8 tests)
- ed1061be wiring: capture handler on `e.code === 'KeyF'`, `menu-find` and the native accelerators, registry entries (`open-palette` = mod+shift+f, new `find-in-page`), `data-find-scope` on `<main>` and the Peek root, `shortcuts.test.ts`

## Deviations
- Highlight colours are literal oklch values in `index.css`: translucent amber for all matches, solid orange for the current one. This follows the checker note, because `--chart-3` and `--chart-4` are both blue.
- The Rust file has 2 occurrences of `menu-find` (the `.id` and the match arm), not 3. The Edit-menu item variable is `find_item`. This is complete.
- AttachmentPreviewModal already had `aria-modal="true"`, so no change was needed.
- The bar root is a `<search>` element instead of `role="search"`, to satisfy biome a11y.
- The "Ǆ expands" test assertion was dropped. NFD does not expand it, and the mapping still holds.
- `cargo check` passes.

## Known limitations
- Virtualized off-screen rows are not rendered, so they are not searched.
- Matches that span inline element boundaries (`foo <strong>bar</strong>`) are not found. Only sibling text nodes are joined.
- Manual verification in `tauri dev` is still pending (the native menu accelerators need a Rust rebuild).

## Post-execution fixes (UAT, 2026-10-22)

- `2987f608` — code review hardening (scope removal closes bar, re-target on Cmd+F, whitespace runs, trailing throttle, `e.key` matching). See 261022-h1q-REVIEW.md.
- `aa844c94` — stale highlights when narrowing the query (superseded by next fix).
- `80214321` — **switched from CSS Custom Highlight API to overlay boxes.** WKWebView does not paint `::highlight` on text that is a direct child of a flex/grid container, inside a `<button>`, or `user-select:none` (verified with a Swift WKWebView snapshot probe) — badges, pills, assignee/field triggers were never highlighted. Matches are now drawn as boxes on a pointer-events-none fixed overlay from `range.getClientRects()`, clipped to overflow-clipping ancestors (`layoutMatchBoxes` in `src/lib/find-in-page.ts`), repainted on scroll/resize/mutation.

UAT: approved by user 2026-10-22.
