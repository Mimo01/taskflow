# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- 🚧 **v1.3 UX & Branding** — Phases 18-22 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-12</summary>

- [x] Phase 1: Foundation (6/6 plans) — completed 2026-03-11
- [x] Phase 2: Developer Dashboard (7/7 plans) — completed 2026-03-11
- [x] Phase 3: Notifications Hub (2/2 plans) — completed 2026-03-12
- [x] Phase 4: PM Dashboard + Search (5/5 plans) — completed 2026-03-12

See archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Polish (Phases 5-8) — SHIPPED 2026-03-13</summary>

- [x] Phase 5: API Foundation + Quick Wins (8/8 plans) — completed 2026-03-12
- [x] Phase 6: Workload + Sprint Progress Enrichment (3/3 plans) — completed 2026-03-12
- [x] Phase 7: Story/Subtask Hierarchy + MR Subtask Filter (5/5 plans) — completed 2026-03-13
- [x] Phase 8: Dashboard Enrichment (8/8 plans) — completed 2026-03-13

See archive: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Jira Parity (Phases 9-17) — SHIPPED 2026-03-15</summary>

- [x] Phase 9: Custom Field Discovery + Issue Detail Foundation (8/8 plans) — completed 2026-03-14
- [x] Phase 10: Sprint Board Redesign (4/4 plans) — completed 2026-03-14
- [x] Phase 11: Create/Edit Issue Form (5/5 plans) — completed 2026-03-14
- [x] Phase 12: Backlog View (4/4 plans) — completed 2026-03-14
- [x] Phase 13: Epic Management (5/5 plans) — completed 2026-03-14
- [x] Phase 14: Fix v1.2 Wiring and Credential Bugs (3/3 plans) — completed 2026-03-15
- [x] Phase 15: Fix BOARD-04 statusId Bug — completed 2026-03-15
- [x] Phase 16: Write Missing Phase 10 + 11 VERIFICATION.md — completed 2026-03-15
- [x] Phase 17: Nyquist Validation — Phases 9–14 — completed 2026-03-15

See archive: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### 🚧 v1.3 UX & Branding (In Progress)

**Milestone Goal:** Elevate visual identity and usability — new icon, redesigned header with pinned-issue tabs, multi-page settings, command palette, keyboard shortcuts, recent items, and improved empty/error states.

- [x] **Phase 18: App Icon + Multi-Page Settings** - New brand icon on all platforms and Settings restructured with sidebar navigation across four sections (completed 2026-03-15)
- [x] **Phase 19: Keyboard Foundation** - Shortcut registry, global keydown hook, and `?` help panel that serves as the reference for all subsequent shortcut consumers (completed 2026-03-15)
- [ ] **Phase 20: Command Palette + Recent Items** - Cmd+K overlay with fuzzy search across cached issues/MRs/nav actions, recent items popover in TopBar, and Cmd+Shift+S/B/N nav shortcuts
- [ ] **Phase 21: Header Redesign + Pinned Issue Tabs** - Redesigned TopBar with branding, pinned-issue tab strip below the top bar, and J/K keyboard navigation in list views
- [ ] **Phase 22: Polish — Empty States + Error Recovery** - Illustrated empty states and actionable error recovery applied consistently across all data views

## Phase Details

### Phase 18: App Icon + Multi-Page Settings
**Goal**: The app has a distinctive visual identity and Settings is navigable across four logical sections
**Depends on**: Phase 17 (v1.2 complete)
**Requirements**: BRAND-01, SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05
**Success Criteria** (what must be TRUE):
  1. The app icon in the macOS Dock, Windows taskbar, and Linux is the new abstract/geometric design — not the Tauri default
  2. Settings shows a persistent sidebar with Connections, Appearance, Notifications, and Workflow links
  3. Clicking each sidebar link reveals only that section's content without a page reload or route change
  4. Connections section shows Jira and GitLab credential fields with working test-connection buttons
  5. Appearance, Notifications, and Workflow sections each contain their respective controls (theme toggle + density; poll interval + per-event toggles; stale MR threshold + sprint board prefs)
**Plans**: 6 plans

Plans:
- [ ] 18-01-PLAN.md — Wave 0: settings store migration + test scaffolds
- [ ] 18-02-PLAN.md — App icon: node-graph SVG + tauri icon pipeline
- [ ] 18-03-PLAN.md — Settings shell (sidebar nav) + ConnectionsSection
- [ ] 18-04-PLAN.md — AppearanceSection + density infrastructure
- [ ] 18-05-PLAN.md — NotificationsSection + WorkflowSection
- [ ] 18-06-PLAN.md — Density rollout to all list/card surfaces + human verify

### Phase 19: Keyboard Foundation
**Goal**: A centralized shortcut registry and global keyboard hook exist, and users can discover all shortcuts via the Cmd+/ help panel
**Depends on**: Phase 18
**Requirements**: KEYS-01, KEYS-02, KEYS-07
**Success Criteria** (what must be TRUE):
  1. Pressing Cmd+/ (macOS) or Ctrl+/ (Windows/Linux) from any screen opens a dialog listing all registered keyboard shortcuts grouped by category
  2. The shortcuts panel closes when the user presses Escape
  3. Pressing Cmd+/ while typing in any text input or contenteditable does not open the panel
**Plans**: 6 plans

Plans:
- [ ] 19-01-PLAN.md — Install react-hotkeys-hook + write RED test scaffolds for panel and settings store
- [ ] 19-02-PLAN.md — Shortcut registry constants (src/lib/shortcuts.ts) + settings store keyboardOverrides migration
- [ ] 19-03-PLAN.md — KeyboardShortcutsPanel component + AppLayout wiring + SearchOverlay migration
- [ ] 19-04-PLAN.md — Gap closure: change show-shortcuts hotkey from ? to mod+/ (layout-independent)
- [ ] 19-05-PLAN.md — Gap closure: fix mod+/ to mod+slash binding (react-hotkeys-hook key-naming bug)
- [ ] 19-06-PLAN.md — Gap closure: native Help menu with Keyboard Shortcuts item + Tauri event wiring

### Phase 20: Command Palette + Recent Items
**Goal**: Users can reach any issue, MR, nav destination, or app action from the keyboard, and recently visited items are one click away in the header
**Depends on**: Phase 19 (shortcut registry), Phase 18 (Settings sections exist for palette actions)
**Requirements**: PALETTE-01, PALETTE-02, PALETTE-03, PALETTE-04, PALETTE-05, PALETTE-06, PALETTE-07, RECENT-01, RECENT-02, KEYS-03
**Success Criteria** (what must be TRUE):
  1. Pressing Cmd+K (macOS) / Ctrl+K (Windows/Linux) from any screen opens the command palette; Escape closes it
  2. Typing in the palette fuzzy-matches cached Jira tasks and GitLab MRs by title and key, with navigation actions (Go to Sprint Board, Backlog, Notifications, Settings sections) and app actions (Toggle theme, Mark all read) visible as groups
  3. When fewer than 2 characters are typed, the palette default state shows recently opened issues/MRs
  4. Typing 2 or more characters produces a "Search Jira for X" tail item that fires a live query
  5. A clock icon in the TopBar opens a popover listing the last 10 recently opened issues/MRs; clicking any item opens that issue's detail panel
  6. Pressing Cmd+Shift+S navigates to Sprint Board, Cmd+Shift+B to Backlog, and Cmd+Shift+N to Notifications from anywhere in the app
**Plans**: 4 plans

Plans:
- [ ] 20-01-PLAN.md — Foundation: shadcn command install + recent-items store + shortcut registry entries
- [ ] 20-02-PLAN.md — CommandPalette component with fuzzy search, groups, and live Jira search
- [ ] 20-03-PLAN.md — RecentItemsPopover component (clock icon + popover)
- [ ] 20-04-PLAN.md — TopBar + AppLayout wiring, nav shortcuts, recent item tracking, delete old search files

### Phase 21: Header Redesign + Pinned Issue Tabs
**Goal**: The app header communicates Taskflow's brand identity and users can maintain quick access to multiple open issues via a persistent tab strip
**Depends on**: Phase 20 (TopBar layout and handleIssueClick wrapper settled)
**Requirements**: HEADER-01, HEADER-02, HEADER-03, HEADER-04, HEADER-05, HEADER-06, HEADER-07, KEYS-04, KEYS-05, KEYS-06
**Success Criteria** (what must be TRUE):
  1. The top bar on every route shows the Taskflow logo and app name consistently
  2. The issue detail panel header has a pin button; clicking it adds the issue to a tab strip rendered below the top bar
  3. Pinned tabs display the issue key and summary; clicking a tab opens that issue's detail panel
  4. Each tab has an × button that removes it from the strip; when more than 7 issues are pinned a +N overflow indicator appears
  5. Pinned tabs survive an app restart — the same tabs are visible after relaunching
  6. In My Tasks, Notifications, and Backlog list views, pressing J or K moves keyboard focus between rows; pressing Enter opens the focused item's detail panel
**Plans**: TBD

### Phase 22: Polish — Empty States + Error Recovery
**Goal**: Every data view communicates clearly when it has no content or has failed to load, and gives users a direct path to recover
**Depends on**: Phase 21 (all views exist and are stable)
**Requirements**: POLISH-01, POLISH-02, POLISH-03
**Success Criteria** (what must be TRUE):
  1. Every list view (My Tasks, Sprint Board columns, Backlog, Notifications, Search results, Releases, Workload) shows an illustrated empty state with a headline and a primary CTA when it contains no data
  2. Every data view shows a plain-language error message and a Retry button when a fetch fails
  3. When a request fails due to an authentication error, the error state includes a "Reconnect" button that navigates directly to Settings > Connections
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 18 → 19 → 20 → 21 → 22

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-03-11 |
| 2. Developer Dashboard | v1.0 | 7/7 | Complete | 2026-03-11 |
| 3. Notifications Hub | v1.0 | 2/2 | Complete | 2026-03-12 |
| 4. PM Dashboard + Search | v1.0 | 5/5 | Complete | 2026-03-12 |
| 5. API Foundation + Quick Wins | v1.1 | 8/8 | Complete | 2026-03-12 |
| 6. Workload + Sprint Progress Enrichment | v1.1 | 3/3 | Complete | 2026-03-12 |
| 7. Story/Subtask Hierarchy + MR Subtask Filter | v1.1 | 5/5 | Complete | 2026-03-13 |
| 8. Dashboard Enrichment | v1.1 | 8/8 | Complete | 2026-03-13 |
| 9. Custom Field Discovery + Issue Detail Foundation | v1.2 | 8/8 | Complete | 2026-03-14 |
| 10. Sprint Board Redesign | v1.2 | 4/4 | Complete | 2026-03-14 |
| 11. Create/Edit Issue Form | v1.2 | 5/5 | Complete | 2026-03-14 |
| 12. Backlog View | v1.2 | 4/4 | Complete | 2026-03-14 |
| 13. Epic Management | v1.2 | 5/5 | Complete | 2026-03-14 |
| 14. Fix v1.2 Wiring and Credential Bugs | v1.2 | 3/3 | Complete | 2026-03-15 |
| 15. Fix BOARD-04 statusId Bug | v1.2 | — | Complete | 2026-03-15 |
| 16. Write Missing Phase 10 + 11 VERIFICATION.md | v1.2 | — | Complete | 2026-03-15 |
| 17. Nyquist Validation — Phases 9–14 | v1.2 | — | Complete | 2026-03-15 |
| 18. App Icon + Multi-Page Settings | 6/6 | Complete    | 2026-03-15 | - |
| 19. Keyboard Foundation | 6/6 | Complete   | 2026-03-15 |
| 20. Command Palette + Recent Items | 2/4 | In Progress|  | - |
| 21. Header Redesign + Pinned Issue Tabs | v1.3 | 0/TBD | Not started | - |
| 22. Polish — Empty States + Error Recovery | v1.3 | 0/TBD | Not started | - |
