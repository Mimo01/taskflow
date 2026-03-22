# Stack Research

**Domain:** Desktop app feature expansion (dashboard widgets, sidebar persistence, activity timeline, attachments preview, mention autocomplete, bulk operations)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Context: Existing Stack (DO NOT re-add)

These are already installed and validated. Listed here only to prevent duplicate recommendations:

- Tauri 2 + tauri-plugin-http/store/stronghold/notification/opener
- React 19.1, React DOM 19.1, React Router DOM 7.13
- TypeScript 5.9, Vite 8, Vitest 4
- Zustand 5, TanStack Query 5, TanStack React Virtual 3
- shadcn/ui (via @base-ui/react 1.2), Tailwind v4, tailwind-merge 3, CVA 0.7, clsx 2
- @dnd-kit/core 6.3, @dnd-kit/utilities 3.2 (used in SprintBoardTab)
- lucide-react 0.577 (icons)
- react-markdown 10.1, jira2md 3.0, rehype-raw 7, remark-gfm 4
- react-hotkeys-hook 5.2, cmdk 1.1
- Biome 2.4, @testing-library/react 16.3

## Recommended New Dependencies

### Widget Dashboard Layout

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-grid-layout | ^2.2.2 | Drag-and-drop resizable widget grid | Purpose-built for dashboard widget layouts. Provides 12-column responsive grid with drag, resize, snap, and serializable layout state. Peer dep `react >= 16.3.0` covers React 19. Includes TypeScript types. 20K+ GitHub stars, active maintenance. The alternative of building grid layout on top of @dnd-kit would require reimplementing collision detection, resize handles, and grid snapping -- weeks of work that react-grid-layout provides out of the box. |

**Integration notes:**
- Layout state serializes to JSON -- persist to Tauri Store (same pattern as pinned tabs / settings)
- @dnd-kit remains for sprint board card dragging; react-grid-layout handles only the dashboard widget grid -- no conflict, different DOM trees
- Responsive breakpoints via `WidthProvider(Responsive)` wrapper
- CSS import required: `react-grid-layout/css/styles.css` + `react-resizable/css/styles.css`

### Attachments Preview

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-pdf | ^10.4.1 | PDF rendering in attachments viewer | Lightweight wrapper around PDF.js for React. 309 kB bundle (most is PDF.js worker). Supports React 16.8+. Renders individual pages with zoom control. 10K+ GitHub stars, actively maintained by wojtekmaj. |
| yet-another-react-lightbox | ^3.29.1 | Image lightbox for attachment thumbnails | Modern lightbox with keyboard nav, touch support, zoom plugin. Works with React 16.8+ including 19. Zero-dependency core (14 kB gzip). Plugin architecture means only load what you need (zoom, thumbnails, download). |

**Integration notes:**
- Image attachments: render `<img>` thumbnails, click opens yet-another-react-lightbox
- PDF attachments: render first page thumbnail via react-pdf `<Page>`, click opens full PDF viewer modal
- Other file types (zip, doc, etc.): show file icon + download link via Tauri opener plugin
- Jira attachment URLs require auth headers -- fetch blob via tauri-plugin-http, create object URL for rendering

### Mention Autocomplete

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-mentions-ts | ^4.5.0 | @mention autocomplete in comment textarea | TypeScript-first fork of react-mentions, built for React 19. Supports multiple triggers (@user, #label), async data loading for user search, and Tailwind v4 styling. The original react-mentions (v4.4.10) is unmaintained for 3+ years and lacks React 19 support. |

**Integration notes:**
- Replace plain `<textarea>` in comment input with `<MentionsInput>`
- Data source: Jira project members from existing `fetchAssignableUsers` API
- Mention markup format: `[~accountId]` for Jira DC (wiki markup mention syntax)
- Style with Tailwind classes to match existing shadcn/ui form field aesthetics
- Falls back to plain text if no users match -- graceful degradation

## What NOT to Add (Build with Existing Stack Instead)

### Activity History Timeline

**Do NOT add:** react-chrono, react-vertical-timeline-component, or any timeline library.

**Why:** An activity timeline is a simple vertical list of timestamped entries with icons. The app already has shadcn/ui primitives (Card, Badge, ScrollArea), lucide-react icons, and Tailwind utilities. A custom `<ActivityTimeline>` component is ~50 lines of markup -- a library adds bundle weight and styling conflicts for no benefit.

**Build with:**
- Tailwind `border-l` for the vertical line
- lucide-react icons for event types (MessageSquare, ArrowRight, Edit, Clock)
- `@tanstack/react-virtual` for long histories
- Data source: Jira `/issue/{key}/changelog` API + existing comments

### Customizable Sidebar Persistence

**Do NOT add:** Any new library.

**Why:** Sidebar configuration is a settings object (ordered list of nav items + visibility flags). Persist to Tauri Store via existing `LazyStore` pattern (same as pinned tabs, settings, dev tools config). Zustand slice with persist middleware handles the in-memory state.

**Build with:**
- Zustand persist (already in use for 4+ stores)
- @tauri-apps/plugin-store LazyStore (already in use)
- @dnd-kit/core for sidebar item reordering (already installed)

### Bulk Operations UI

**Do NOT add:** Any new library.

**Why:** Bulk operations is a selection model (checkbox per row) + action toolbar. The app already has shadcn/ui Checkbox, DropdownMenu, Button, and Toast. Selection state is a `Set<string>` in component state or a lightweight Zustand slice.

**Build with:**
- shadcn/ui Checkbox for row selection
- shadcn/ui DropdownMenu for bulk action menu
- Shift+click range selection via existing react-hotkeys-hook
- Optimistic updates via existing TanStack Query mutation pattern

### Board Quick Filters

**Do NOT add:** Any new library.

**Why:** Quick filters are toggle buttons that filter the existing board data. The app already has shadcn/ui Toggle/ToggleGroup, and filtering is a query parameter or Zustand state that feeds into `useMemo` on the board data.

**Build with:**
- shadcn/ui ToggleGroup for filter chips
- Zustand for filter state persistence
- Existing TanStack Query `select` transforms for filtered views

### Saved Filters

**Do NOT add:** Any new library.

**Why:** Saved filters are serialized filter objects stored in Tauri Store. Same persistence pattern used 4+ times already.

**Build with:**
- Zustand persist + LazyStore
- shadcn/ui Dialog for save/edit filter

### Time Tracking / Worklogs

**Do NOT add:** Any new library.

**Why:** Worklog display is a table of time entries. Worklog input is hours/minutes fields. No specialized library needed.

**Build with:**
- shadcn/ui Input, Table, Dialog
- Jira REST API: `POST /issue/{key}/worklog`

### Watchers / Starring

**Do NOT add:** Any new library.

**Why:** Star is a toggle button. Watchers is a list with add/remove. Trivial UI.

**Build with:**
- lucide-react Star/Eye icons
- shadcn/ui Button, Popover

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| react-grid-layout | Build on @dnd-kit/core | @dnd-kit lacks grid snapping, resize handles, and responsive breakpoints. Would require 500+ lines of custom collision/layout logic to match react-grid-layout's out-of-box behavior. |
| react-grid-layout | gridstack.js | JavaScript-first library, clunky React integration, relies on DOM selectors rather than React component model. |
| react-pdf | @react-pdf/renderer | @react-pdf/renderer is for PDF *generation*, not viewing. Different use case entirely. |
| react-pdf | pdfme | Focused on PDF generation/template editing, not viewing. |
| yet-another-react-lightbox | react-image-lightbox | Deprecated, no React 18/19 support, unmaintained since 2021. |
| yet-another-react-lightbox | lightGallery | jQuery heritage, heavier bundle, commercial license for some features. |
| react-mentions-ts | react-mentions (original) | Last published 3+ years ago, no React 19 types, no Tailwind support. |
| react-mentions-ts | Draft.js + mention plugin | Massive bundle (300+ kB), Facebook deprecated Draft.js, overkill for a comment textarea. |
| react-mentions-ts | TipTap/ProseMirror | Full rich-text editor is overkill -- comments are plain text with @mentions, not WYSIWYG. Jira DC uses wiki markup, not HTML. |
| Custom timeline | react-chrono | 100+ kB bundle for what is a styled `<ul>`. Styling conflicts with Tailwind/shadcn. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| react-beautiful-dnd | Deprecated, unmaintained, no React 18/19 support | @dnd-kit/core (already installed) |
| Draft.js | Deprecated by Facebook, massive bundle, no React 19 support | react-mentions-ts for @mention; react-markdown for rendering |
| Slate.js / TipTap / ProseMirror | Overkill rich-text editors for a comment field that outputs Jira wiki markup | react-mentions-ts |
| react-image-lightbox | Unmaintained since 2021, broken with React 18+ | yet-another-react-lightbox |
| @react-pdf-viewer/core | Heavier than react-pdf, more complex API, commercial features gated | react-pdf |
| Any CSS-in-JS library (styled-components, emotion) | Project uses Tailwind v4 exclusively, mixing paradigms causes maintenance burden | Tailwind utility classes |

## Installation

```bash
# New dependencies for v1.5
npm install react-grid-layout react-pdf yet-another-react-lightbox react-mentions-ts

# No new dev dependencies needed -- existing Biome, Vitest, Testing Library cover all new code
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-grid-layout@2.2.2 | React >= 16.3.0 | Peer dep is permissive; React 19 works. Includes own TS types (no @types/ needed). |
| react-pdf@10.4.1 | React >= 16.8.0 | Uses PDF.js worker -- configure worker URL in Vite. Tauri CSP may need `worker-src` adjustment. |
| yet-another-react-lightbox@3.29.1 | React >= 16.8.0 | Zero-dep core. Plugins loaded via separate imports (tree-shakeable). |
| react-mentions-ts@4.5.0 | React >= 19.0.0 | TypeScript-first, Tailwind v4 compatible. Uses @testing-library/user-event for tests (already installed). |

## Tauri-Specific Considerations

| Concern | Approach |
|---------|----------|
| PDF.js worker in Tauri webview | Bundle worker inline via `pdfjs-dist/build/pdf.worker.min.mjs` import, or copy to public/ and set workerSrc. Test in both dev and production builds. |
| Attachment URLs behind auth | Fetch attachment content via tauri-plugin-http (bypasses CORS), convert to blob URL for react-pdf/lightbox. Do NOT use `<img src={jiraUrl}>` directly -- auth headers required. |
| CSP for PDF worker | May need to add `worker-src 'self' blob:` to Tauri CSP config in `tauri.conf.json`. |
| react-grid-layout CSS | Import CSS files in main entry point. Tailwind v4 PostCSS pipeline does not interfere with external CSS imports. |
| Widget layout persistence | Serialize react-grid-layout's `Layout[]` to Tauri Store. Same LazyStore pattern as settings. |

## Sources

- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) -- version 2.2.2, peer deps verified via package.json (React >= 16.3.0)
- [react-grid-layout npm](https://www.npmjs.com/package/react-grid-layout) -- published 3 months ago, includes TS types
- [react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) -- version 10.4.1, active maintenance
- [yet-another-react-lightbox](https://yet-another-react-lightbox.com/) -- version 3.29.1, React 16.8+ support
- [react-mentions-ts GitHub](https://github.com/hbmartin/react-mentions-ts) -- React 19 + TypeScript fork of react-mentions
- [ilert: Why React-Grid-Layout Was Our Best Choice](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) -- production dashboard use case
- [Shadcn Timeline template](https://www.shadcn.io/template/timdehof-shadcn-timeline) -- confirms timeline is trivial with shadcn primitives

---
*Stack research for: Taskflow v1.5 feature expansion*
*Researched: 2026-03-22*
