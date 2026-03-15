# Requirements: Taskflow

**Defined:** 2026-03-15
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.3 Requirements

Requirements for the v1.3 UX & Branding milestone. Each maps to roadmap phases.

### Branding

- [ ] **BRAND-01**: App has a new abstract/geometric icon on all platforms (macOS Dock, Windows taskbar, Linux)

### Header & Tabs

- [ ] **HEADER-01**: App header is redesigned with consistent branding (logo + app name) visible on all routes
- [ ] **HEADER-02**: User can pin any open issue to the tab strip from the issue detail panel header
- [ ] **HEADER-03**: Pinned issue tabs are displayed in a tab strip below the top bar
- [ ] **HEADER-04**: User can close a pinned tab by clicking its × button
- [ ] **HEADER-05**: Pinned tabs persist across app restarts
- [ ] **HEADER-06**: Tab strip shows a +N overflow indicator when more than 7 issues are pinned
- [ ] **HEADER-07**: Clicking a pinned tab opens the issue detail panel for that issue

### Settings

- [x] **SETTINGS-01**: Settings has sidebar navigation with Connections, Appearance, Notifications, and Workflow sections
- [x] **SETTINGS-02**: Connections section displays Jira and GitLab credentials with test connection buttons
- [x] **SETTINGS-03**: Appearance section includes theme toggle and display density options
- [x] **SETTINGS-04**: Notifications section includes poll interval and per-event desktop notification toggles
- [x] **SETTINGS-05**: Workflow section includes stale MR threshold and sprint board preferences

### Command Palette

- [ ] **PALETTE-01**: User can open the command palette with Cmd+K (macOS) / Ctrl+K (Windows/Linux) from anywhere
- [ ] **PALETTE-02**: Palette searches cached Jira tasks and GitLab MRs by title/key with fuzzy matching
- [ ] **PALETTE-03**: Palette includes navigation actions (Go to Sprint Board, Backlog, Notifications, Settings sections)
- [ ] **PALETTE-04**: Palette includes app actions (Create issue, Mark all read, Toggle theme)
- [ ] **PALETTE-05**: Palette shows a "Search Jira for X" tail item that fires a live query for typed text ≥2 chars
- [ ] **PALETTE-06**: Palette default state (before typing) shows recent items
- [ ] **PALETTE-07**: User can dismiss the palette with Escape

### Keyboard Shortcuts

- [ ] **KEYS-01**: User can open a keyboard shortcuts reference panel with the ? key from anywhere in the app
- [ ] **KEYS-02**: Shortcuts panel is dismissable with Escape
- [ ] **KEYS-03**: Global navigation shortcuts: G+S = Sprint Board, G+B = Backlog, G+N = Notifications
- [ ] **KEYS-04**: J/K navigation works in My Tasks list (J/K moves focus, Enter opens detail)
- [ ] **KEYS-05**: J/K navigation works in Notifications list (J/K moves focus, Enter opens detail)
- [ ] **KEYS-06**: J/K navigation works in Backlog list (J/K moves focus, Enter opens detail)
- [ ] **KEYS-07**: Keyboard shortcuts do not fire when focus is inside any text input or contenteditable

### Recent Items

- [ ] **RECENT-01**: User can view the last 10 recently opened issues/MRs from a header popover
- [ ] **RECENT-02**: Clicking a recent item opens the issue detail panel for that issue

### Empty & Error States

- [ ] **POLISH-01**: All list views show an illustrated empty state with headline and CTA when there is no data
- [ ] **POLISH-02**: All data views show an actionable error state with plain-language message and retry button on fetch failure
- [ ] **POLISH-03**: Authentication errors include a re-connect CTA navigating to Settings > Connections

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
| BRAND-01 | Phase 18 | Pending |
| SETTINGS-01 | Phase 18 | Complete |
| SETTINGS-02 | Phase 18 | Complete |
| SETTINGS-03 | Phase 18 | Complete |
| SETTINGS-04 | Phase 18 | Complete |
| SETTINGS-05 | Phase 18 | Complete |
| KEYS-01 | Phase 19 | Pending |
| KEYS-02 | Phase 19 | Pending |
| KEYS-07 | Phase 19 | Pending |
| PALETTE-01 | Phase 20 | Pending |
| PALETTE-02 | Phase 20 | Pending |
| PALETTE-03 | Phase 20 | Pending |
| PALETTE-04 | Phase 20 | Pending |
| PALETTE-05 | Phase 20 | Pending |
| PALETTE-06 | Phase 20 | Pending |
| PALETTE-07 | Phase 20 | Pending |
| RECENT-01 | Phase 20 | Pending |
| RECENT-02 | Phase 20 | Pending |
| KEYS-03 | Phase 20 | Pending |
| HEADER-01 | Phase 21 | Pending |
| HEADER-02 | Phase 21 | Pending |
| HEADER-03 | Phase 21 | Pending |
| HEADER-04 | Phase 21 | Pending |
| HEADER-05 | Phase 21 | Pending |
| HEADER-06 | Phase 21 | Pending |
| HEADER-07 | Phase 21 | Pending |
| KEYS-04 | Phase 21 | Pending |
| KEYS-05 | Phase 21 | Pending |
| KEYS-06 | Phase 21 | Pending |
| POLISH-01 | Phase 22 | Pending |
| POLISH-02 | Phase 22 | Pending |
| POLISH-03 | Phase 22 | Pending |

**Coverage:**
- v1.3 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
