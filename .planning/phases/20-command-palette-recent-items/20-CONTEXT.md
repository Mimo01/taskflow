# Phase 20: Command Palette + Recent Items - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Command palette (Cmd+K / Ctrl+K) that replaces the existing SearchOverlay as the single search entry point. Fuzzy-matches cached Jira issues and GitLab MRs, includes navigation actions and app actions, with a "Search Jira for X" live query tail item. Recent items tracked across the app and accessible via a clock-icon popover in TopBar. Navigation shortcuts (Cmd+Shift+S/B/N) for Sprint Board, Backlog, and Notifications. Header redesign, pinned tabs, and J/K list navigation belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Palette replaces SearchOverlay
- Command palette becomes the **single search entry point** — SearchOverlay is fully replaced
- Search icon in TopBar opens the palette (same as Cmd+K) — two trigger paths, one UI
- SearchOverlay.tsx, SearchResultPanel.tsx, and their test files are **deleted** as part of this phase
- Built with `cmdk@^1.1.1` + `npx shadcn add command` (decided during research)
- Cmd+K binding uses `react-hotkeys-hook` (not manual listener) to avoid macOS double-fire bug

### Issue/MR selection behavior
- Selecting a **Jira issue** in the palette opens the global IssueDetailSheet (existing pattern)
- Selecting a **GitLab MR** opens the MR URL in the default browser (deep link)
- Both actions close the palette after selection

### Palette result groups (search state — ≥2 chars typed)
- Results grouped **by source type**: Issues (Jira), Merge Requests (GitLab), Navigation, Actions
- "Search Jira for X" tail item at the bottom — fires a live query inline in the palette with loading skeleton
- App actions limited to requirements: **Toggle theme** and **Mark all read** (PALETTE-04)

### Palette default state (before typing / <2 chars)
- Shows two groups: **Recent Items** (last opened issues/MRs) and **Navigation** actions
- App actions only appear when user types a matching query

### Recent items tracking
- Track **any detail panel open** — IssueDetailSheet from sprint board, backlog, search, notifications, or any other entry point. GitLab MR browser opens also tracked
- Store entries with **key/ID only** (no cached title) — fetch title on render for freshness
- **Persist across app restarts** — new Zustand persist store (same Tauri Store pattern as settings)
- Cap at **10 most recent** items (RECENT-01)

### Recent items popover
- Clock icon in TopBar opens a popover matching the **notification popover style** (same width ~320px, same Popover component, similar list row layout)
- Clicking a recent Jira item opens IssueDetailSheet; clicking a recent MR opens browser

### Navigation shortcuts (replacing G+S/G+B/G+N chords)
- **Cmd+Shift+S** (macOS) / **Ctrl+Shift+S** (Windows/Linux) → Sprint Board
- **Cmd+Shift+B** / **Ctrl+Shift+B** → Backlog
- **Cmd+Shift+N** / **Ctrl+Shift+N** → Opens notification popover (not full /notifications page)
- No chord/sequence shortcuts — single modifier+key combos only
- **No visual feedback** for key press — navigation happens immediately
- Navigation actions in palette show keyboard shortcut hints right-aligned (e.g., "Sprint Board  ⌘⇧S")

### Shortcut registry updates
- Add all new shortcuts to `src/lib/shortcuts.ts`: open-palette (⌘K), nav-sprint (⌘⇧S), nav-backlog (⌘⇧B), nav-notifications (⌘⇧N)
- Categories: open-palette → General, nav shortcuts → Navigation

### Claude's Discretion
- Exact cmdk/Command component styling and theming integration
- Loading skeleton design for live Jira search
- Fuzzy matching configuration and scoring
- Recent items store name and internal structure
- How to trigger notification popover open from Cmd+Shift+N (may need lifting popover state)
- Whether to show empty-state text in palette when no recent items exist yet

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Command Palette — PALETTE-01 through PALETTE-07
- `.planning/REQUIREMENTS.md` §Recent Items — RECENT-01, RECENT-02
- `.planning/REQUIREMENTS.md` §Keyboard Shortcuts — KEYS-03 (navigation shortcuts)

### Prior phase context
- `.planning/phases/19-keyboard-foundation/19-CONTEXT.md` — Shortcut registry design, react-hotkeys-hook patterns, useSettingsStore keyboardOverrides field
- `.planning/phases/18-app-icon-multi-page-settings/18-CONTEXT.md` — Settings store patterns, Zustand persist version+migrate

### Existing code to understand
- `taskflow/src/components/app/SearchOverlay.tsx` — Being replaced; understand its search service calls (searchJira, searchGitLabMRs) to reuse in palette
- `taskflow/src/components/app/TopBar.tsx` — Integration point for search icon, clock icon, notification popover
- `taskflow/src/lib/shortcuts.ts` — Registry to extend with new shortcut entries
- `taskflow/src/stores/settings.store.ts` — Pattern reference for new recent-items store (Zustand persist + Tauri Store)

### Research notes
- `.planning/STATE.md` §Accumulated Context — cmdk@^1.1.1 + shadcn command, react-hotkeys-hook for Cmd+K, macOS double-fire bug note

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SearchOverlay.tsx` search logic — `searchJira()` and `searchGitLabMRs()` service calls can be reused for the "Search Jira for X" live query feature
- `Popover` component (`src/components/ui/popover.tsx`) — used for notification popover, reuse for recent items popover
- `NotificationPopover` — reference for popover list row styling in recent items popover
- `react-hotkeys-hook` — already installed (Phase 19); use for Cmd+K and Cmd+Shift+S/B/N bindings
- `src/lib/shortcuts.ts` — existing registry; append new entries

### Established Patterns
- Zustand persist with Tauri Store backend — version + migrate for any new persisted fields
- No `createContext`/`useContext` — prop threading only
- `onIssueClick` prop threading from AppLayout through TopBar for IssueDetailSheet integration
- `useHotkeys('escape', onClose, { enableOnFormTags: true })` for Escape handling in overlays

### Integration Points
- `TopBar.tsx` — Replace search icon handler (open palette instead of SearchOverlay), add clock icon + recent items popover
- `AppLayout` / `main.tsx` — Wire Cmd+K to open palette, wire Cmd+Shift+S/B/N navigation shortcuts
- `src/lib/shortcuts.ts` — Add 4 new entries (open-palette, nav-sprint, nav-backlog, nav-notifications)
- `settings.store.ts` — Reference pattern only; new `recent-items.store.ts` for recent items persistence
- Router `navigate()` — Used by Cmd+Shift+S (→ sprint board route) and Cmd+Shift+B (→ backlog route)

</code_context>

<specifics>
## Specific Ideas

- Palette should feel like Linear/GitHub command palettes — fast, grouped results, keyboard-navigable
- Navigation actions show keyboard chord hints right-aligned (e.g., "Sprint Board  ⌘⇧S") to teach users shortcuts through the palette
- Recent items popover matches notification popover visual style for TopBar consistency
- "Search Jira for X" fires inline in the palette — results replace cached results with loading skeleton during fetch

</specifics>

<deferred>
## Deferred Ideas

- Frecency ranking (usage-weighted recency) for palette results — PALETTE-F2, recency ordering sufficient for now
- Customizable keyboard shortcuts UI — PALETTE-F1 / KEYS-F1, foundation exists (keyboardOverrides in settings store) but UI is out of scope
- Create issue from palette — mentioned in PALETTE-04 requirements as an app action but user chose to limit to Toggle theme + Mark all read for this phase

</deferred>

---

*Phase: 20-command-palette-recent-items*
*Context gathered: 2026-03-16*
