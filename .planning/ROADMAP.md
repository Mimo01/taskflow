# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- ✅ **v1.3 UX & Branding** — Phases 18-24 (shipped 2026-03-19)
- ✅ **v1.4 Internal Quality & Performance** — Phases 25-30 (shipped 2026-03-20)
- 🚧 **v1.5 Dashboard Redesign & Feature Parity** — Phases 31-34 (in progress)

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

<details>
<summary>✅ v1.3 UX & Branding (Phases 18-24) — SHIPPED 2026-03-19</summary>

- [x] Phase 18: App Icon + Multi-Page Settings (6/6 plans) — completed 2026-03-15
- [x] Phase 19: Keyboard Foundation (6/6 plans) — completed 2026-03-15
- [x] Phase 20: Command Palette + Recent Items (6/6 plans) — completed 2026-03-16
- [x] Phase 21: Header Redesign + Pinned Issue Tabs (5/5 plans) — completed 2026-03-16
- [x] Phase 22: Polish — Empty States + Error Recovery (3/3 plans) — completed 2026-03-16
- [x] Phase 23: Fix J/K Guard (architecturally resolved) — completed 2026-03-19
- [x] Phase 24: Verify Phase 22 (1/1 plan) — completed 2026-03-19

See archive: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.4 Internal Quality & Performance (Phases 25-30) — SHIPPED 2026-03-20</summary>

- [x] Phase 25: Tooling & Dependencies (2/2 plans) — completed 2026-03-19
- [x] Phase 26: Test Regression Fixes (3/3 plans) — completed 2026-03-19
- [x] Phase 27: Refactoring & Type Safety (5/5 plans) — completed 2026-03-19
- [x] Phase 28: Test Coverage, Performance & Accessibility (5/5 plans) — completed 2026-03-20
- [x] Phase 29: Developer Tools (3/3 plans) — completed 2026-03-20
- [x] Phase 30: Fix A11Y-01 Test Regression & Checkbox Cleanup (1/1 plan) — completed 2026-03-20

See archive: `.planning/milestones/v1.4-ROADMAP.md`

</details>

### v1.5 Dashboard Redesign & Feature Parity (In Progress)

**Milestone Goal:** Make Taskflow feel like a real power tool — customizable layout, issue activity history, and key Jira/GitLab features that users expect.

- [x] **Phase 31: Issue Detail Enrichment** - Activity timeline, comment editing, watchers, and quality-of-life enhancements (completed 2026-03-22)
- [x] **Phase 32: Time Tracking, Attachments & Mentions** - Worklog CRUD, file attachments, and @mention autocomplete (completed 2026-03-22)
- [ ] **Phase 33: Board, Sprint & Filters** - Sprint goal, quick filters, bulk operations, and saved filter management
- [ ] **Phase 34: Layout Customization** - Customizable sidebar and widget-based dashboard

## Phase Details

### Phase 31: Issue Detail Enrichment
**Goal**: Users have full visibility into issue history and can manage comments, watchers, and issue lifecycle from the detail page
**Depends on**: Phase 30 (v1.4 complete)
**Requirements**: DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, DETAIL-10, DETAIL-11
**Success Criteria** (what must be TRUE):
  1. User can view a chronological activity timeline on issue detail showing field changes, status transitions, and comments merged by timestamp
  2. User can filter the activity timeline to show only field changes, only comments, or all activity types
  3. User can edit and delete their own comments on any issue
  4. User can watch/unwatch an issue and see the current watcher count
  5. User can see overdue badges on issues past their due date and clone an issue with one click
**Plans:** 4/4 plans complete
Plans:
- [x] 31-01-PLAN.md — Jira service layer: changelog types, timeline merge/filter utilities, watchers CRUD, expand=changelog
- [x] 31-02-PLAN.md — OverdueBadge component (3 locations) and Clone Issue button in action bar
- [x] 31-03-PLAN.md — ActivityTimeline UI (replaces CommentThread), TimelineFilterChips, ChangelogEntry, WatcherToggle
- [x] 31-04-PLAN.md — Visual verification checkpoint for all Phase 31 features
**UI hint**: yes

### Phase 32: Time Tracking, Attachments & Mentions
**Goal**: Users can log and manage work time, view and upload file attachments, and @mention teammates in comments
**Depends on**: Phase 31 (activity timeline must exist for worklog rendering)
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05, DETAIL-06, DETAIL-07, DETAIL-08, DETAIL-09
**Success Criteria** (what must be TRUE):
  1. User can log time on an issue using natural language input ("2h 30m") and see a time tracking summary (estimated, spent, remaining)
  2. User can view, edit, and delete their own worklog entries on the issue detail page
  3. User can view image thumbnails and file lists for issue attachments, download them, and upload new files
  4. User can type "@" in a comment to get an autocomplete popover of team members and insert a mention
**Plans:** 5 plans (4 complete + 1 gap closure)
Plans:
- [x] 32-01-PLAN.md — Service layer: types, duration parser, worklog CRUD, attachment upload/delete, user search, timeline extension
- [x] 32-02-PLAN.md — Time tracking UI: sidebar summary, log work popover, worklog timeline entries with CRUD
- [x] 32-03-PLAN.md — Attachments UI: collapsible section, thumbnails, lightbox, upload, download
- [x] 32-04-PLAN.md — @mention autocomplete: cursor-anchored popover in CommentComposer
- [ ] 32-05-PLAN.md — Gap closure: restore destroyed type exports in jira/types.ts
**UI hint**: yes

### Phase 33: Board, Sprint & Filters
**Goal**: Users can work faster on the sprint board with quick filters, bulk operations, and saved filter management synced with Jira
**Depends on**: Phase 31 (issue detail features stable before board-level changes)
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, FILT-01, FILT-02, FILT-03, FILT-04
**Success Criteria** (what must be TRUE):
  1. User sees the sprint goal displayed as a banner on the sprint board header
  2. User can toggle quick filter chips (from Jira board config) and label-based filters to narrow the sprint board view
  3. User can select multiple issues and bulk-change their status, assignee, or priority with a progress indicator showing success/failure counts
  4. User can save the current search as a named filter (synced to Jira), view and execute saved/favourite filters, and edit or delete them
  5. User can access saved filters from the sidebar and command palette
**Plans**: TBD
**UI hint**: yes

### Phase 34: Layout Customization
**Goal**: Users can personalize their workspace with a customizable sidebar and a widget-based dashboard that persists across restarts
**Depends on**: Phase 33 (all features must be stable before sidebar items and dashboard widgets are finalized)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, LAYOUT-06, LAYOUT-07
**Success Criteria** (what must be TRUE):
  1. User can choose which sidebar items are visible and reorder them via drag-and-drop
  2. User can apply a Dev or PM preset to restore default sidebar configuration
  3. User can add, remove, resize, and drag dashboard widgets in a grid layout
  4. Dashboard and sidebar layout persists across app restarts and can be reset to Dev or PM preset defaults
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 31 → 32 → 33 → 34

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
| 18. App Icon + Multi-Page Settings | v1.3 | 6/6 | Complete | 2026-03-15 |
| 19. Keyboard Foundation | v1.3 | 6/6 | Complete | 2026-03-15 |
| 20. Command Palette + Recent Items | v1.3 | 6/6 | Complete | 2026-03-16 |
| 21. Header Redesign + Pinned Issue Tabs | v1.3 | 5/5 | Complete | 2026-03-16 |
| 22. Polish — Empty States + Error Recovery | v1.3 | 3/3 | Complete | 2026-03-16 |
| 23. Fix J/K Guard | v1.3 | — | Complete | 2026-03-19 |
| 24. Verify Phase 22 | v1.3 | 1/1 | Complete | 2026-03-19 |
| 25. Tooling & Dependencies | v1.4 | 2/2 | Complete | 2026-03-19 |
| 26. Test Regression Fixes | v1.4 | 3/3 | Complete | 2026-03-19 |
| 27. Refactoring & Type Safety | v1.4 | 5/5 | Complete | 2026-03-19 |
| 28. Test Coverage, Performance & Accessibility | v1.4 | 5/5 | Complete | 2026-03-20 |
| 29. Developer Tools | v1.4 | 3/3 | Complete | 2026-03-20 |
| 30. Fix A11Y-01 Test Regression & Checkbox Cleanup | v1.4 | 1/1 | Complete | 2026-03-20 |
| 31. Issue Detail Enrichment | v1.5 | 4/4 | Complete    | 2026-03-22 |
| 32. Time Tracking, Attachments & Mentions | v1.5 | 4/5 | Gap closure | 2026-03-22 |
| 33. Board, Sprint & Filters | v1.5 | 0/? | Not started | - |
| 34. Layout Customization | v1.5 | 0/? | Not started | - |
