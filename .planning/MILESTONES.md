# Milestones

## v1.5 Dashboard Redesign & Feature Parity (Shipped: 2026-03-24)

**Phases completed:** 7 phases, 25 plans, 46 tasks

**Key accomplishments:**

- Changelog timeline merge/filter utilities and watcher CRUD with expand=changelog on fetchIssueDetail, 22 passing tests
- OverdueBadge component with pure isOverdue utility integrated into 3 views, Clone Issue button opening create-mode modal with pre-filled fields
- Unified activity timeline replacing CommentThread with merged changelog + comments, filter chips with counts, and self-contained watcher toggle widget with optimistic updates
- Worklog CRUD, attachment upload/delete, duration parser, user search, and timeline extension with worklog entries -- 35 tests covering all service functions
- Sidebar time tracking summary with progress bar, log work popover with natural language duration input, worklog entries in activity timeline with inline edit/delete CRUD
- Collapsible attachments section with 80x80 thumbnail grid, lightbox with keyboard prev/next, file list with download, and drag-drop upload with indeterminate progress
- Cursor-anchored @mention popover with debounced user search, keyboard navigation, and [~username] wiki markup insertion
- Restored all 15 original Jira type exports destroyed by Plan 01, merged with 3 phase-32 types for 18 total exports
- 58 vitest todo stubs across 6 test files covering all Phase 33 board and filter requirements (Wave 0 Nyquist)
- Board quick filter API, saved filter CRUD, extended filter store with Jira QF toggles, board selection store with range select, and saved filter store
- Sprint goal accent banner and Jira board quick filter chip row with client-side JQL evaluation wired into SprintBoardTab
- Multi-select checkboxes on sprint board cards with floating bulk action bar for status/assignee/priority changes, parallel API execution with concurrency limit of 5, and per-issue optimistic rollback
- SaveFilterDialog, EditFilterDialog, and SavedFilterList components with Save Filter button wired into UnifiedFilterBar for Jira filter CRUD
- Saved filters wired into sidebar and command palette with board JQL filtering, sticky headers fixed, SprintGoalBanner redesigned, bulk edit UI removed
- Sidebar nav registry (10 items), widget registry (11 types), settings store extended with layout state/actions/presets, v9 migration, 15 tests passing
- Data-driven sidebar rendering from store with drag-reorder settings list, visibility toggles, and Dev/PM preset buttons
- react-grid-layout responsive dashboard with drag/resize, widget picker dialog, and 3 existing panels wired as self-contained widgets
- 8 compact widget components built and wired into registry, completing all 11 dashboard widget types with self-contained data fetching and config persistence
- Jira saved filter CRUD service with 4 API functions, JiraSavedFilter type, session-only Zustand store, and 8 passing unit tests
- SaveFilterDialog, EditFilterDialog, and SavedFilterList components with context menu, delete confirmation, and 5 passing tests
- Wired saved filter components into UnifiedFilterBar, Sidebar, CommandPalette, and dashboard widget; fixed attachment delete button rendering in IssueDetailContent
- dnd-kit sortable integration restored in SidebarItemsList with GripVertical drag handles, cross-section reorder, and DragOverlay feedback
- SprintBoardTab subscribes to useSavedFilterStore, fetches saved filter JQL results via fetchAllSearchPages, intersects with sprint swimlanes, and shows an active filter banner with Clear button

---

## v1.4 Internal Quality & Performance (Shipped: 2026-03-20)

**Phases completed:** 6 phases (25–30), 21 plans
**Timeline:** 2026-03-19 → 2026-03-20 (2 days)
**Codebase:** ~37,520 lines TypeScript
**Git range:** 268b909..e5ca8b6 (141 commits, 505 files changed, +29,115/−47,892 lines)

**Key accomplishments:**

1. Biome linter/formatter configured with CI-ready scripts; all 162 source files auto-formatted with consistent code style
2. All pre-existing test regressions fixed — test suite went from 489 to 615+ passing tests with zero failures and zero warnings
3. jira.ts monolith decomposed into 14 focused domain modules; CreateEditIssueModal and IssueDetailSidebar split into composable sub-components
4. Zero `any` types and zero double-casts remain in production code; strict Biome noExplicitAny enabled as error
5. Virtualized rendering for backlog, notifications, and sprint board via @tanstack/react-virtual — handles 200+ items without scroll jank
6. Unified Developer Tools page with operation profiling, performance waterfall visualization, and granular debug settings (hidden from main Settings, accessible via Cmd+Shift+D)

**Known Tech Debt:** 10 non-blocking items — DevToolsSettings.tsx dead code, DebugModeSection still in Settings.tsx, debug-logs/ dead directory, operation-profiler.store.ts untested, stale test descriptions, placeholder return-null components (DescriptionSection/SubtasksSection).

---

## v1.3 UX & Branding (Shipped: 2026-03-19)

**Phases completed:** 7 phases (18–24), 27 plans
**Timeline:** 2026-03-15 → 2026-03-19 (5 days)
**Codebase:** ~32,173 lines TypeScript
**Git range:** v1.2..HEAD (409 commits, 159 files changed, +11,471/−2,296 lines)

**Key accomplishments:**

1. Custom abstract/geometric app icon generated across all platforms (macOS .icns, Windows .ico, Linux PNG, Android/iOS)
2. Multi-page Settings with sidebar navigation: Connections (test-connection), Appearance (theme + density), Notifications (poll interval + per-event toggles), Workflow (stale MR threshold + sprint prefs)
3. Keyboard shortcuts system: centralized registry, react-hotkeys-hook global listener, Cmd+/ help panel, J/K list navigation in My Tasks and Backlog, input suppression
4. Command palette (Cmd+K) with fuzzy search across cached issues/MRs, navigation actions, app actions, live Jira search tail item, and recent items default state
5. Header redesign with Taskflow branding in sidebar, pinned-issue tab strip with persistence across restarts, overflow indicator
6. Recent items quick-access popover (clock icon) showing last 10 opened issues/MRs
7. Illustrated empty states and actionable error recovery (ApiError class, ErrorState with auth detection, StaleDataBanner) across 10+ data views

**Known Tech Debt:** 10 non-blocking items — icon background color needs human check, KEYS-03 binding deviation (Cmd+Shift vs G-chords) needs product owner sign-off, 8 pre-existing LazyStore teardown warnings, Phase 23 missing VERIFICATION.md (architecturally resolved), 2 pre-existing test file TS errors.

---

## v1.2 Jira Parity (Shipped: 2026-03-15)

**Phases completed:** 9 phases (9–17), 29 plans
**Timeline:** 2026-03-13 → 2026-03-15 (2 days)
**Codebase:** ~23,607 lines TypeScript
**Git range:** 3001850..a84417a (173 commits, 222 files changed, +28,330/−1,730 lines)

**Key accomplishments:**

1. Full issue detail panel accessible from all app entry points (sprint board, my tasks, search, notifications) with inline field editing and comment posting
2. Rebuilt sprint board with Jira-workflow columns, story swimlane layout, drag-and-drop status transitions, and inline issue creation from any column
3. Create/edit Jira issue form with dynamically discovered fields from `createmeta` API — account and all required custom fields, no hardcoded field IDs
4. Backlog view with paginated list, move-to-sprint, story creation, and epic/label/assignee filters
5. Epic management — list with metrics, sprint board filter, epic detail slide-over, and create epic dialog
6. Fixed 3 broken E2E flows post-integration: QuickCreateInput wiring (BOARD-04), cache invalidation key (BACK-03), CreateEpicDialog credentials (EPIC-04)

**Known Tech Debt:** Pre-existing Phase 8 test regressions (6 tests); 13 live Jira human verification items deferred; EPIC-01 story counts removed per user decision (performance trade-off).

---

## v1.1 Polish (Shipped: 2026-03-13)

**Phases completed:** 4 phases (5-8), 24 plans
**Timeline:** 2026-03-12 → 2026-03-13 (2 days)
**Codebase:** ~15,856 lines TypeScript
**Git range:** feat(05-01) → docs(quick-20)

**Key accomplishments:**

1. Extended Jira data layer with parent/subtask/time-tracking fields and two-query subtask strategy; fixed Releases tab with correct server endpoint, newest-to-oldest sort, released/unreleased/overdue badges
2. WorkloadTab rewrite: subtasks excluded from story point totals, time tracking columns (original estimate, time spent, remaining), done stories shown as expandable sub-rows
3. SprintProgressTab enriched with stacked status breakdown (To Do / In Progress / Done with counts and %), sprint-wide time totals, and per-assignee breakdown table
4. Story/subtask hierarchy in My Tasks and Sprint Board: subtasks grouped under collapsible parent story headers; orphan subtasks show parent context badge
5. MR Attention fixed: only open MRs shown; includes MRs linked to stories where current user has assigned subtasks (subtask-linked inclusion)
6. Developer dashboard enriched with SubtasksPanel, MrHealthPanel, SprintHealthPanel, and NotificationsPanel; full-page /notifications route with accordion expand and Bell sidebar link

---

## v1.0 MVP (Shipped: 2026-03-12)

**Phases completed:** 4 phases, 20 plans
**Timeline:** 2026-03-10 → 2026-03-12 (2 days)
**Codebase:** ~11,017 lines TypeScript, 348 files
**Git range:** feat(01-01) → style(04)

**Key accomplishments:**

1. Tauri 2 portable desktop app with OS keychain PAT storage (Stronghold), CORS-free Jira/GitLab access, and cross-platform portable build
2. Developer dashboard: My Tasks, Sprint Board, and MR Attention tabs with live 60s polling and last-refreshed timestamps
3. Automatic task-to-MR linking via Jira ticket key parsing from MR titles and commit messages, with review health badges
4. Jira write actions: workflow status transitions (optimistic update + rollback) and inline comments with per-row error recovery
5. Unified notifications hub: Jira mentions + GitLab MR thread activity, OS desktop notifications, in-app badge, read/unread state
6. PM dashboards (sprint progress, team workload, releases with GitLab milestone links) and global search across all Jira tasks and MRs

---
