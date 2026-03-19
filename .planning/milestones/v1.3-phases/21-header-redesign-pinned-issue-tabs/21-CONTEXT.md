# Phase 21: Header Redesign + Pinned Issue Tabs - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the app header with branding (logo + app name), add a persistent tab strip for pinned issues below the top bar, and implement J/K keyboard navigation in My Tasks, Notifications, and Backlog list views. Tab drag-and-drop reordering is deferred (HEADER-F1).

</domain>

<decisions>
## Implementation Decisions

### Header branding layout
- Logo + "Taskflow" text moved to the **left side of the TopBar** — small app icon (20-24px) + text
- Sidebar logo/branding **removed** to avoid duplication — sidebar keeps nav links only
- TopBar remains within the content column (right of sidebar), not full-width spanning above it
- Icons (search, clock, bell) stay right-aligned

### Tab strip position and visibility
- Tab strip is a **separate row below the top bar** — not inside the top bar
- **Hidden when no tabs are pinned** — no empty placeholder; content gets full height
- Strip appears as soon as the first tab is pinned

### Tab content and styling
- Each tab shows: **issue type icon + key + truncated summary** (ellipsis at ~20 chars)
- Issue type icons: small colored icons (Bug, Story, Subtask, etc.) before the key
- Each tab has an **× close button** to unpin
- Active tab styling: Claude's discretion (e.g., bottom border accent or background highlight)

### Overflow behavior
- First 7 tabs visible in the strip
- **+N badge** at the right end when >7 tabs pinned
- Clicking +N opens a **dropdown/popover** listing overflow tabs — each row clickable to open that issue
- **No hard cap** on pinned tabs — additional tabs go to overflow

### Pin interaction
- **Pin icon button in IssueDetailSheet header** row alongside edit and close buttons
- Visual state: **outline pin icon** (unpinned) → **filled/solid pin icon** (pinned) — click toggles
- Clicking a pinned tab opens the **IssueDetailSheet** (same slide-over panel used everywhere)
- Pinned tabs **persist across app restarts** — new Zustand persist store (same Tauri Store pattern)
- Store only issue keys (not titles) — resolve titles from cache at render time (stale title pitfall)
- Must bump store `version` + `migrate` for any new persisted fields

### J/K list navigation
- **Plain J/K keys** (no modifier) — standard Gmail/Linear/GitHub pattern
- Already safe from text input conflict — react-hotkeys-hook `enableOnFormTags: false` default (KEYS-07)
- **J = next row, K = previous row, Enter = open detail panel**
- Focus indicator: **subtle background highlight** on the focused row
- **Stop at edges** — J at last item and K at first item do nothing (no wrap-around)
- **Smooth scroll** focused row into view when it goes off-screen
- **Reset focus on navigation** — focus clears when leaving the route
- Applies to: My Tasks, Notifications, Backlog list views (KEYS-04, KEYS-05, KEYS-06)
- Add J, K, Enter shortcuts to `src/lib/shortcuts.ts` registry

### Claude's Discretion
- Active tab visual treatment (bottom border accent vs background highlight)
- Tab spacing, height, and typography
- Pin icon choice (lucide Pin icon variant)
- Exact focus highlight color for J/K navigation
- How to resolve issue type for tab icons (from cache or stored alongside key)
- Whether to show a brief animation when tab strip appears/disappears

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Header & Tabs — HEADER-01 through HEADER-07
- `.planning/REQUIREMENTS.md` §Keyboard Shortcuts — KEYS-04, KEYS-05, KEYS-06

### Prior phase context
- `.planning/phases/20-command-palette-recent-items/20-CONTEXT.md` — Recent items store pattern, handleIssueClick wrapper, TopBar integration points
- `.planning/phases/19-keyboard-foundation/19-CONTEXT.md` — react-hotkeys-hook patterns, shortcuts.ts registry design, KEYS-07 input guard
- `.planning/phases/18-app-icon-multi-page-settings/18-CONTEXT.md` — Settings store persist version+migrate pattern, app icon assets

### Existing code to understand
- `taskflow/src/components/app/TopBar.tsx` — Current header; will be redesigned with branding on left
- `taskflow/src/main.tsx` — AppLayout owns selectedIssueKey, handleIssueClick, IssueDetailSheet; tab strip integration point
- `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` — Pin button will be added to header row
- `taskflow/src/components/app/Sidebar.tsx` — Logo/branding to be removed from here
- `taskflow/src/stores/recent-items.store.ts` — Pattern reference for new pinned-tabs store (Zustand persist + Tauri Store)
- `taskflow/src/lib/shortcuts.ts` — Registry to extend with J, K, Enter shortcut entries
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — J/K navigation target
- `taskflow/src/routes/notifications/index.tsx` — J/K navigation target (Notifications page)
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — J/K navigation target

### Key constraints from STATE.md
- Store only issue keys in pinned-tabs store — never titles (stale title pitfall)
- Must bump store `version` + `migrate` for any new persisted fields
- No `createContext`/`useContext` — prop threading only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `recent-items.store.ts` — Zustand persist + Tauri Store pattern; direct template for pinned-tabs store
- `react-hotkeys-hook` — Already installed (Phase 19); use for J/K bindings
- `src/lib/shortcuts.ts` — Existing registry; append J, K, Enter entries
- `Popover` component — Reuse for +N overflow dropdown
- `RecentItemsPopover` — Reference for TopBar popover integration pattern
- `handleIssueClick` in AppLayout — Central issue-open handler; tab clicks should use same path

### Established Patterns
- Zustand persist with Tauri Store backend — version + migrate for new persisted fields
- No `createContext`/`useContext` — prop threading only
- `onIssueClick` prop threading from AppLayout through TopBar for IssueDetailSheet
- `useHotkeys` with `enableOnFormTags: false` default for keyboard shortcuts

### Integration Points
- `TopBar.tsx` — Add logo + app name on left side; icons stay right-aligned
- `Sidebar.tsx` — Remove logo/branding text from top
- `AppLayout` in `main.tsx` — Tab strip component between TopBar and ReAuthBanner/main content; wire pinned-tabs store
- `IssueDetailSheet` header — Add pin/unpin toggle button
- List view components (MyTasksTab, Notifications index, BacklogPage) — Add J/K focus management

</code_context>

<specifics>
## Specific Ideas

- Tab strip should feel like browser tabs or VS Code tabs — familiar, dense, with close buttons
- Issue type icons (Bug, Story, etc.) give at-a-glance context in the tab strip without taking much space
- +N overflow dropdown matches the existing popover patterns (notification popover, recent items popover)
- J/K plain keys follow Gmail/Linear convention — modifier-free for rapid list traversal

</specifics>

<deferred>
## Deferred Ideas

- Tab drag-and-drop reordering — HEADER-F1, deferred per requirements (fiddly DnD on narrow flex header)
- Tab session restore with pre-loaded issue data — HEADER-F2, complex cache coordination
- J/K navigation in Sprint Board cards — KEYS-F1, 2D kanban grid makes direction ambiguous

</deferred>

---

*Phase: 21-header-redesign-pinned-issue-tabs*
*Context gathered: 2026-03-16*
