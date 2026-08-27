# Quick Task 260827-f6e: Right-click menu for links (open in browser / copy) - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Task Boundary

We have recently added an option to open links in different browsers. Expand this: add a right-click context menu on links throughout the app offering "open in [browser]" for each detected browser, plus "copy link to clipboard".

</domain>

<decisions>
## Implementation Decisions

### Link scope
- Apply the right-click context menu to ALL existing `openExternal` call sites, not just the WikiRenderer wiki/markdown links:
  - `WikiRenderer.tsx` (rendered links in descriptions/comments)
  - `BacklogPage.tsx`, `SubtasksPanel.tsx`, `SprintBoardTab.tsx`, `UnifiedTaskTable.tsx`, `NotificationRow.tsx`, `NotificationPopover.tsx`
- Existing click behavior (opening in the configured default browser) stays as-is on left-click; the right-click menu is additive, not a replacement.
- Given the repeated pattern across 7 files, extract a shared `LinkContextMenu` (or similar) component/hook wrapping the existing `ContextMenu` primitives (`src/components/ui/context-menu.tsx`) so each call site doesn't duplicate browser-listing/copy logic.

### Browser list
- Call `list_browsers()` (Tauri command, `src-tauri/src/lib.rs:96`) and render one menu item per detected browser (e.g. "Open in Chrome", "Open in Firefox"), plus an "Open in System Default" item — flat list, not a submenu.
- Reuse `openExternal`'s existing browser-selection/fallback logic (`src/lib/openExternal.ts`) where applicable rather than reimplementing browser launch.

### Copy feedback
- Claude's discretion: keep it simple and consistent with the existing codebase pattern — reuse the same lightweight "Copied!" inline flash-state pattern already used in `IssueDetailContent.tsx` (`handleCopyJiraLink`) and `StandupNotesPage.tsx`, rather than introducing a new toast system. The app has no app-wide toast library; `openExternal.ts` explicitly follows a "fail quietly, no toast" convention, which this should stay consistent with.

### Claude's Discretion
- Exact menu item ordering/labels, icon choices, and whether "Open in System Default" appears first or last.
- Whether the shared component is a component (`<LinkContextMenu href>`) or a hook (`useLinkContextMenu`) — pick whichever best fits each of the 7 call sites with minimal churn.

</decisions>

<specifics>
## Specific Ideas

No specific mockups or exact copy provided — open to standard approaches consistent with the existing `ContextMenu` primitive usage (see `TaskCard.tsx` lines 430-487 for the established pattern).

</specifics>

<canonical_refs>
## Canonical References

- `src/lib/openExternal.ts` — existing open-in-browser logic and fallback chain
- `src-tauri/src/lib.rs` (`list_browsers`, `BrowserInfo` struct) — browser detection
- `src/stores/settings.store.ts` (`externalBrowser`) — persisted default browser selection
- `src/components/ui/context-menu.tsx` — shared context-menu primitives (base-ui, not Radix)
- `src/routes/dashboard/TaskCard.tsx:430-487` — established context-menu usage pattern
- `src/routes/dashboard/IssueDetailContent.tsx` (`handleCopyJiraLink`) — existing copy-to-clipboard + flash-confirmation pattern

</canonical_refs>
