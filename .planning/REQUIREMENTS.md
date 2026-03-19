# Requirements: Taskflow

**Defined:** 2026-03-15
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.3 Requirements

Requirements for the v1.3 UX & Branding milestone. Each maps to roadmap phases.

### Branding

- [x] **BRAND-01**: App has a new abstract/geometric icon on all platforms (macOS Dock, Windows taskbar, Linux)

### Header & Tabs

- [x] **HEADER-01**: App header is redesigned with consistent branding (logo + app name) visible on all routes
- [x] **HEADER-02**: User can pin any open issue to the tab strip from the issue detail panel header
- [x] **HEADER-03**: Pinned issue tabs are displayed in a tab strip below the top bar
- [x] **HEADER-04**: User can close a pinned tab by clicking its × button
- [x] **HEADER-05**: Pinned tabs persist across app restarts
- [x] **HEADER-06**: Tab strip shows a +N overflow indicator when more than 7 issues are pinned
- [x] **HEADER-07**: Clicking a pinned tab opens the issue detail panel for that issue

### Settings

- [x] **SETTINGS-01**: Settings has sidebar navigation with Connections, Appearance, Notifications, and Workflow sections
- [x] **SETTINGS-02**: Connections section displays Jira and GitLab credentials with test connection buttons
- [x] **SETTINGS-03**: Appearance section includes theme toggle and display density options
- [x] **SETTINGS-04**: Notifications section includes poll interval and per-event desktop notification toggles
- [x] **SETTINGS-05**: Workflow section includes stale MR threshold and sprint board preferences

### Command Palette

- [x] **PALETTE-01**: User can open the command palette with Cmd+K (macOS) / Ctrl+K (Windows/Linux) from anywhere
- [x] **PALETTE-02**: Palette searches cached Jira tasks and GitLab MRs by title/key with fuzzy matching
- [x] **PALETTE-03**: Palette includes navigation actions (Go to Sprint Board, Backlog, Notifications, Settings sections)
- [x] **PALETTE-04**: Palette includes app actions (Create issue, Mark all read, Toggle theme)
- [x] **PALETTE-05**: Palette shows a "Search Jira for X" tail item that fires a live query for typed text ≥2 chars
- [x] **PALETTE-06**: Palette default state (before typing) shows recent items
- [x] **PALETTE-07**: User can dismiss the palette with Escape

### Keyboard Shortcuts

- [x] **KEYS-01**: User can open a keyboard shortcuts reference panel with the ? key from anywhere in the app
- [x] **KEYS-02**: Shortcuts panel is dismissable with Escape
- [x] **KEYS-03**: Global navigation shortcuts: ⌘⇧S = Sprint Board, ⌘⇧B = Backlog, ⌘⇧N = Notifications
- [x] **KEYS-04**: J/K navigation works in My Tasks list (J/K moves focus, Enter opens detail)
- ~~**KEYS-05**: J/K navigation works in Notifications list (J/K moves focus, Enter opens detail)~~ — **descoped** (notifications route intentionally removed)
- [x] **KEYS-06**: J/K navigation works in Backlog list (J/K moves focus, Enter opens detail)
- [x] **KEYS-07**: Keyboard shortcuts do not fire when focus is inside any text input or contenteditable

### Recent Items

- [x] **RECENT-01**: User can view the last 10 recently opened issues/MRs from a header popover
- [x] **RECENT-02**: Clicking a recent item opens the issue detail panel for that issue

### Empty & Error States

- [x] **POLISH-01**: All list views show an illustrated empty state with headline and CTA when there is no data
- [x] **POLISH-02**: All data views show an actionable error state with plain-language message and retry button on fetch failure
- [x] **POLISH-03**: Authentication errors include a re-connect CTA navigating to Settings > Connections

## Future Requirements

### Header & Tabs

- **HEADER-F1**: User can reorder pinned tabs by dragging — deferred, marginal UX value
- **HEADER-F2**: Tab session restore with issue data pre-loaded — deferred, complex cache coordination

### Command Palette

- **PALETTE-F1**: Customizable keyboard shortcuts — disproportionate complexity for v1.3
- **PALETTE-F2**: Frecency ranking (usage-weighted recency) — recency ordering sufficient for now

### Keyboard Shortcuts

- **KEYS-F1**: J/K navigation in Sprint Board cards — 2D kanban grid makes direction ambiguous; defer

## Out of Scope

| Feature | Reason |
|---------|--------|
| Customizable keyboard shortcuts | Conflict detection + persistence + settings UI is disproportionate complexity |
| Tab drag-and-drop reordering | DnD on narrow flex header with overflow is fiddly for marginal value |
| Live API search on every keystroke | Latency + on-premise Jira load; cache-first + tail item is the right pattern |
| Lottie/animated empty states | Static SVGs are correct — zero runtime cost, consistent with Linear's style |
| Tauri global shortcuts (system-wide) | In-window shortcuts sufficient; global plugin only needed for window-closed shortcuts |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 18 | Complete |
| SETTINGS-01 | Phase 18 | Complete |
| SETTINGS-02 | Phase 18 | Complete |
| SETTINGS-03 | Phase 18 | Complete |
| SETTINGS-04 | Phase 18 | Complete |
| SETTINGS-05 | Phase 18 | Complete |
| KEYS-01 | Phase 19 | Complete |
| KEYS-02 | Phase 19 | Complete |
| KEYS-07 | Phase 19 | Complete |
| PALETTE-01 | Phase 20 | Complete |
| PALETTE-02 | Phase 20 | Complete |
| PALETTE-03 | Phase 20 | Complete |
| PALETTE-04 | Phase 20 | Complete |
| PALETTE-05 | Phase 20 | Complete |
| PALETTE-06 | Phase 20 | Complete |
| PALETTE-07 | Phase 20 | Complete |
| RECENT-01 | Phase 20 | Complete |
| RECENT-02 | Phase 20 | Complete |
| KEYS-03 | Phase 20 | Complete |
| HEADER-01 | Phase 21 | Complete |
| HEADER-02 | Phase 21 | Complete |
| HEADER-03 | Phase 21 | Complete |
| HEADER-04 | Phase 21 | Complete |
| HEADER-05 | Phase 21 | Complete |
| HEADER-06 | Phase 21 | Complete |
| HEADER-07 | Phase 21 | Complete |
| KEYS-04 | Phase 23 | Complete |
| KEYS-05 | — | Descoped |
| KEYS-06 | Phase 23 | Complete |
| POLISH-01 | Phase 24 | Complete |
| POLISH-02 | Phase 24 | Complete |
| POLISH-03 | Phase 24 | Complete |

**Coverage:**
- v1.3 requirements: 32 total
- Mapped to phases: 31
- Descoped: 1 (KEYS-05)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
