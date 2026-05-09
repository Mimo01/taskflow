# Phase 50: Draggable Sidebar Resize - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add drag-to-resize dividers to all pages with sidebars. Users can drag the border/divider to set sidebar width. Width is persisted to localStorage and restored on next app launch. Does NOT add any new navigation, features, or UI surfaces — only resize behaviour on existing sidebar borders.

</domain>

<decisions>
## Implementation Decisions

### Main Navigation Sidebar + Collapse Interaction
- **D-01:** Collapse toggle and drag-resize are **independent**. Dragging sets the expanded width; the collapse toggle (Cmd+B / chevron button) still collapses to 64px. Uncollapsing restores the last drag-set width.
- **D-02:** The drag handle is only present (and the edge is only draggable) when the sidebar is in **expanded** mode. No drag affordance in collapsed (icon-only) state.

### Detail Page Right Panels — Scope & Persistence
- **D-03:** All three detail pages get drag-to-resize: **Issue detail**, **MR detail**, and **Release detail**. Each has its own independently persisted width (three separate storage keys).

### Drag Handle Visual Design
- **D-04:** Claude's discretion — see "Claude's Discretion" below.

### Width Bounds
- **D-05:** Claude's discretion — see "Claude's Discretion" below.

### Claude's Discretion
- **Drag handle visual:** Resize cursor (`ew-resize`) on hover over the border zone, plus a subtle border highlight (border-color change). No permanent visual element. Matches the app's clean, minimal aesthetic.
- **Main nav sidebar bounds:** 160px minimum / 320px maximum. 160px keeps nav labels and icons readable; 320px is the natural upper bound before the sidebar dominates the screen.
- **Detail panel bounds:** 240px minimum / 50% of the container width maximum. 240px keeps form fields and metadata readable; 50% cap ensures the main content area is never squeezed below half.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sidebar Component
- `taskflow/src/components/app/Sidebar.tsx` — Main nav sidebar. Currently renders `<aside className="... w-16 md:w-56 ... shrink-0 transition-all duration-200">`. Width is hardcoded Tailwind classes; collapse state comes from `useSettingsStore`.

### Layout Root
- `taskflow/src/main.tsx` — `AppLayout` function (line ~470). Renders `<Sidebar />` alongside the main content area in a `flex h-screen overflow-hidden` container. This is where the sidebar width CSS class is applied and where the drag resize integration point lives.

### Settings Store (Persistence)
- `taskflow/src/stores/settings.store.ts` — Zustand store with `persist` middleware. Already stores `sidebarCollapsed: boolean`. Add `sidebarWidth`, `issueDetailPanelWidth`, `mrDetailPanelWidth`, and `releaseDetailPanelWidth` here for localStorage persistence.

### Detail Page Layouts
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — Right panel currently `w-[42%]`. Needs to become a resizable width driven by persisted state.
- `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` — Right panel currently `w-72` (288px). Needs same treatment.
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — Right panel mirrors MR detail layout. Needs same treatment.

No external specs referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSettingsStore` (settings.store.ts): Zustand persist store — add width fields here rather than creating a separate storage mechanism.
- Collapse toggle pattern (Sidebar.tsx): The hover-chevron button + `sidebarCollapsed` state is the existing interaction model that resize must coexist with.

### Established Patterns
- **Tailwind dynamic widths via inline style:** The app uses Tailwind utility classes for layout, but dynamic user-controlled widths can't be Tailwind classes. Use `style={{ width: px }}` for the resized element; use Tailwind for everything else.
- **`shrink-0` on sidebar:** Currently present; must be preserved so the sidebar doesn't flex-shrink during resize.
- **Zustand persist versioning:** `settings.store.ts` uses a `version` migration pattern. Incrementing the store version is required when adding new fields.

### Integration Points
- The drag divider lives on the right edge of each sidebar. For the main nav sidebar, this is the border between `<Sidebar />` and the main content `div` in `AppLayout`.
- For detail pages, it's the border between the `flex-1` main column and the `w-[42%]` / `w-72` right panel inside each detail page component.
- Mouse event handling for drag: `mousedown` on the divider, `mousemove` + `mouseup` on `document` during drag (standard resize-handle pattern). No library required.

</code_context>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments from discussion — open to standard approaches for the drag implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 50-Draggable Sidebar Resize*
*Context gathered: 2026-05-09*
