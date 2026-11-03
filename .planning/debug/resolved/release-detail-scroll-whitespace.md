---
status: resolved
trigger: "on release detail page, i think there is invalid html. sometimes it allows me to scroll down past content into white space"
created: 2026-11-03
updated: 2026-11-03
---

# Debug: release-detail-scroll-whitespace

## Symptoms

DATA_START
- **Expected:** Release detail page scroll ends at the bottom of its content.
- **Actual:** The whole page (main scroll area, not an inner panel) can be scrolled past the content into roughly one screen (~viewport height) of blank white space.
- **Errors:** None reported. User suspects invalid HTML (e.g. invalid nesting) as cause.
- **Timeline:** Not stated; intermittent ("sometimes").
- **Reproduction:** Intermittent. Seen after switching tabs on the page and after expanding/collapsing rows/sections; otherwise no clear pattern.
DATA_END

## Context hints

- App is a Tauri (macOS WKWebView) React app; src/npm/vitest live in inner `taskflow/taskflow/`.
- Memory: "main.overflow-auto never scrolls on h-full pages" (scroll restore reverted) — layout uses an `main` overflow-auto container.
- Memory: release task table header is sticky z-20; release detail uses expanding rows, tabs, MR donuts, tables.
- ~1 viewport of overscroll suggests an element sized h-full/100vh/min-h-screen sitting below content, an absolutely-positioned element (tooltip/popover/virtualizer/sr-only) extending scrollHeight, or stale height from a tab panel/collapsible kept mounted.
- Per user feedback: for layout bugs, inspect the rendered DOM before iterating on CSS.

## Current Focus

hypothesis: CONFIRMED - sr-only abspos spans escape the non-positioned scroller and stretch the document scroll height
next_action: user verifies in Tauri app

## Evidence

- Harness (throwaway vite page + real ReleaseDetailPage + stubbed hook, WebKit and Chromium via playwright, 40 rows/12 secondary): at container widths where `@max-[860px]:sr-only` applies, document.scrollHeight = 2221 vs viewport 750. Setting position:relative on [data-testid=release-detail-scroll] -> 750; hiding .sr-only -> 750. Wide (1500px) -> 750 already.
- Inner scroller is not positioned and computed contain is none, so abspos sr-only spans resolve against the viewport; scroller overflow does not clip them; their static positions deep in the table extend the root scrollable overflow.

## Eliminated

## Resolution

root_cause: sr-only (position:absolute) spans in table cells have the viewport as containing block because the release-detail-scroll container was not positioned; they escape its overflow clip and extend the document scroll height to the table length, so the window scrolls past the app into blank space (width- and content-dependent => intermittent).
fix: add `relative` to the release-detail-scroll container in ReleaseDetailPage.tsx; regression test in ReleaseDetailPage.test.tsx.
verification: user confirmed fixed in Tauri app; harness document.scrollHeight 750 at 700/900/1100/1300/1500px in WebKit and Chromium after fix (2221 before at 1100); vitest ReleaseDetailPage 30 passed; biome clean.
files_changed: [taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx]
