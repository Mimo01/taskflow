# Milestones

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
