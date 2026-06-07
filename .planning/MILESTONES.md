# Milestones

## v1.12 Jira Experience Improvements (Shipped: 2026-06-07)

**Phases completed:** 5 phases (76-80), 19 plans, 29 tasks
**Timeline:** 6 days (2026-06-01 → 2026-06-07)
**Codebase:** 434 files changed (+46,310/−3,051 lines), 441 commits
**Git range:** 7f02e71c (chore: archive v1.11 phase directories) → ea0fa34a (fix(standup): widen watched-person picker popover)

**Key accomplishments:**

1. **Visual consistency + shared display primitives (Phase 76)** — `lib/issueDisplayUtils.ts` (`isDoneStatus`, `doneSummaryClass`, `issueTypeStripeClass`) gives the whole app one done-state treatment: done current-sprint stories render struck-through on the Backlog list, Standup Today, and Dashboard, matching the kanban board. Sprint-board cards gained a left-edge issue-type color stripe (Bug=red, Story=green, Subtask/Task=blue, Epic=purple), WCAG-tuned for both themes; priority moved to a `PriorityIcon` footer image (Jira `iconUrl`). Settings store bumped to v25 (`rankFieldKey`).
2. **Universal non-blocking issue peek (Phase 77)** — clicking any issue body anywhere (board, backlog, standup, dashboard, search, command palette) opens a right-edge CSS-squeeze slideover that keeps the underlying view fully interactive (no Dialog, no backdrop, no focus trap); clicking the issue key still navigates full-page. Built on a shared `IssueDetailView` extraction (full queries/mutations/composer) mounted at `AppLayout`, with a resizable persisted divider, Escape/X/open-full-page dismissal, route-change close, and issue-swap without closing. Folded in DETAIL-01 (subtask parent moved to main content) and DETAIL-02 (cursor-pointer sweep).
3. **Drag-to-rank on the Backlog (Phase 78)** — `@dnd-kit` installed (shared with Phase 79); Backlog rows are sortable with an optimistic rank mutation persisting to Jira via `PUT /rest/agile/1.0/issue/rank` using the `rankCustomFieldId` read from the cached GreenHopper response (never hardcoded). A flicker gate (`cancelQueries` + drag-gated local order) holds order through background polling; failures roll back with an inline banner; cross-section moves gate behind a confirm dialog.
4. **Drag-to-transition on the Sprint Board (Phase 79)** — cards drag between columns to fire workflow transitions; multi-status columns split into labelled per-transition drop zones during the drag via a pure `sprintBoardDragHelpers.ts` seam (`buildDropModel`/`filterDroppableTransitions`/`resolveDropTransitionId`). `hasScreen`/`hasValidators` propagated through `__adaptToJiraTransition`; optimistic move with rollback and board refresh on settle.
5. **Subtask templates + bulk creation (Phase 80)** — Settings-managed named templates (`subtask-templates.json` store) where each line requires a title plus createmeta-driven optional fields (assignee, priority, labels, estimate, story points, due date, components, custom fields) and parent-inheritance placeholders (`@inherit`/`@current`/`@unassigned`). From a parent issue, a Bulk Create modal applies a template or builds an ad-hoc list, previews/inline-edits/reorders rows, then creates all subtasks sequentially with per-row progress and retry-failed-only (no duplicates) on partial failure.

Plus a heavy quick-task polish layer (~30 tasks) refining the peek header/elevation, priority + issue-type icons across backlog/board/epics, unassigned-avatar styling, an "Unassigned" assignee filter, and a substantial Standup Notes pass (status-pill transitions, subtask sub-grouping, overridable recap day, watched-person picker, clear-app-cache setting).

**Known deferred items at close:** 7 (see STATE.md Deferred Items) — Windows/WebView2 drag UAT + 3 live-Jira subtask UAT (need a Windows host / live DC; covered by unit tests), dnd-kit autoScroll disabled (upstream #1108), Phase 79 D-07 screen/validator pre-filter reversal, two non-blocking Phase 80 code-review items, and the priority-stripe-by-REST-rank backlog idea. All non-blocking; milestone audit passed 32/32 requirements.

---

## v1.11 GreenHopper API Migration (Shipped: 2026-06-01)

**Phases completed:** 5 phases (71-75), 22 plans
**Timeline:** 4 days (2026-05-28 → 2026-06-01)
**Codebase:** ~80,895+ lines TypeScript, 308 files changed (+48,340/−16,981 lines), 284 commits
**Git range:** 9a8ce377 (docs: start milestone v1.11) → 76f5b155 (chore(v1.11): fix stale reload doc)

**Key accomplishments:**

1. **GreenHopper typed adapter layer (Phase 71)** — `services/jira/greenhopper/` module with `greenhopperFetch` wrapper, 12 response interfaces, `buildEntityMaps` resolvers (statusId/priorityId/typeId/epicId → UI types), and `adaptIssue` + `createAdapter` — wired into the project's 60-import `services/jira.ts` barrel; 4 redacted real-world JSON fixtures committed as vitest test data
2. **Transitions cache (Phase 72)** — `transitions.json` fetched once per project, keyed by `projectId × issueTypeId → workflow → transitions[]`; legacy per-issue REST `/transitions` GET deleted from both `services/jira.ts` and `services/jira/transitions.ts`
3. **Sprint board single-call migration (Phase 73)** — `allData.json` replaces multi-call board fetch; `timeInColumn` badge per card; unified "Reload board" 4-key toolbar; `fetchSprintSubtasks` hard-deleted; Sidebar prefetch swapped to `getGhAllData`
4. **Backlog single-call migration (Phase 74)** — `data.json` replaces paginated REST + per-issue lookups; 5 mutation cache-invalidation sites migrated; `npm run check:legacy-backlog` static-grep guard prevents legacy symbol reappearance; legacy `fetchBacklogIssues` / `fetchBacklogSprintStories` / `fetchBacklogView` / `BacklogViewData` hard-deleted
5. **Progressive issue detail (Phase 75)** — monolithic `fetchIssueDetail` decomposed into slim base + 3 independent parallel section queries; TTFMP 1180ms (header visible); TTI 1682ms (changelog gates "fully loaded"); 200ms-gated per-section skeletons; fanned-out cache invalidation; perf artifact `docs/perf/75-issue-detail-progressive.md`

**Known Tech Debt (10 items — non-blocking):** `fetchIssueDetails` dead private module; 3 SUMMARY files missing `requirements-completed` frontmatter; `QuickCreateInput`/`BulkActionBar` orphaned; `73-VERIFICATION.md` truth #9 stale (correct code, stale doc); CATEGORY_COLUMNS vs `columnsData.columns[]` design note; 2 intentional Biome `useExhaustiveDependencies` suppressions; `sprintMoveMutation` doesn't refresh sprint board; subtask enrichment cache key staleness; duplicate comment functions pre-existing.

---

## v1.10 Cleanup, Roles Removal & Standup Notes (Shipped: 2026-05-25)

**Phases completed:** 6 phases (65-70), 15 plans, 17 quick tasks
**Timeline:** 3 days (2026-05-23 → 2026-05-25)
**Codebase:** ~80,895 lines TypeScript / 136 test files, 432 files changed (+30,286/−1,489 lines), 271 commits
**Git range:** 1cf34652 (feat(65-02): runtime AIO status map) → v1.10 tag

**Key accomplishments:**

1. **Tech-debt cleanup (CLEAN-01..07)** — WorklogsPage timer cleanup + cached-empty error distinction + keyed fragments, `DatePreset` moved to `services/tempo/types.ts`, stale sidebar test mock removed, AIO `TESTCASE_STATUS_MAP` gains 51/52 IDs, and `AIO_STATUS_MAP` replaced by a runtime map fetched from the live `/config` endpoint
2. **Developer/PM roles removed app-wide (ROLES-01..06)** — `getDefaultSidebarItems` becomes no-arg all-visible, settings store drops `role`/`setRole`/`applyPreset` with a v22 migration, onboarding wizard collapsed 5→4 steps, and PresetButtons/RoleSection/RoleStep deleted with zero role-gated conditionals remaining
3. **Settings → Sidebar tightened to visibility-only (SETUI-01..03)** — `SidebarItemsList` rewritten from a 180-LOC dnd-kit sortable to a 50-LOC checkbox list, `reorderSidebarItem` removed, all four `@dnd-kit/*` packages uninstalled
4. **Onboarding wizard Integrations step (WIZ-01..04)** — new step with a shared `AioBlock` (AIO toggle + project picker, reused by Settings) and Tempo toggle, writing both toggles + selected AIO project key directly into the settings store as the single source of truth
5. **Standup Notes — Yesterday recap (STAND-01..06)** — `/standup-notes` route + all-visible sidebar entry; "yesterday" resolves to the last working day (weekends + Tempo-schedule holidays skipped); four independently-loading sections (Tempo worklogs, Jira changelog, Git commits, MR activity) each degrading gracefully when its integration is off
6. **Standup Notes — Today section (STAND-07)** — open sprint subtasks/tasks (assignee = me) grouped by parent story with nested participating MRs; pinned issues (STAND-08) and Log Work targets (STAND-09) descoped by user during the Phase 70 redesign

**Known deferred items at close:** 20 (see STATE.md Deferred Items) — all benign: 17 quick-task SUMMARYs unreadable by the scanner (every one has a real commit), 1 archived debug session, and Phases 68/70 `VERIFICATION.md` at `human_needed`.

**Known Tech Debt (acknowledged at close):**

- Phase 69 had no `VERIFICATION.md` at close — the only milestone phase missing the artifact; compensated by 69-UAT 12/12 + nyquist-green VALIDATION + SECURITY present, all wiring re-confirmed in the milestone audit. **Resolved 2026-05-26: minted retroactively via gsd-verifier, status passed (4/4).**
- WR-05: unguarded `as number \| null` story-points cast in `TodayInProgressSection.tsx` / `TodayUpNextSection.tsx` — could render `[object Object]` if `storyPointsFieldKey` is misconfigured.
- IN-01: `setCopied` setTimeout not cleared on unmount in `StandupNotesPage.tsx` (benign under React 18).
- Doc drift: Phase 66/67 VERIFICATION docs reference settings store `version: 22`; actual current persist version is `23` (additive standup-notes sidebar migration).

---

## v1.9 Tempo, Dashboard Redesign & Cleanup (Shipped: 2026-05-23)

**Phases completed:** 6 phases (59-64), 20 plans, 10 quick tasks
**Timeline:** 4 days (2026-05-20 → 2026-05-23)
**Codebase:** ~73,264 lines TypeScript, 230 files changed (+26,283/−3,085 lines), 258 commits
**Git range:** 59d836d (feat(59-02): remove WorkloadTab lazy import) → v1.9 tag

**Key accomplishments:**

1. **Widget dashboard system removed atomically** — deleted 11 widget components, registry, `WorkloadTab`, `WorkloadSkeleton`, `WidgetGrid`/`WidgetCard`/`WidgetPicker`, settings store v19 layout state, and the `react-grid-layout` + `@types/react-grid-layout` packages in a single coordinated phase; `/workload` route and all sidebar/header references scrubbed; npm build green
2. **Static dashboard / welcome screen** — gradient hero with personalised greeting + en-GB date and a responsive 3-card grid (Sprint health with shadcn Progress, My In-Progress subtasks with outlet-context navigation + breadcrumb chain, Next Release with live `fetchReleaseIssues` progress bar showing N% complete · X/Y issues)
3. **Tempo service layer + Settings toggle** — live Bearer PAT probe confirmed on `jira.orange.sk` (`/rest/tempo-timesheets/3`), `src/services/tempo/` module with client/types/worklogs/schedule + 15 unit tests covering pagination/date-bucketing/error paths; `tempoEnabled` setting in v20 store with migration guard; Settings → Integrations toggle (default off, gates all Tempo fetches)
4. **Tempo Worklog Viewer UI** — `/worklogs` route gated by `tempoEnabled`, day-column pivot table with 6 date presets (This Week default, Last Week, This/Last Month, Last Working Day, Custom range with from≥to gate), single-select people filter (combobox + chip + clear), totals column per person + totals row per day + grand total, zero-hour cells blank, weekend/holiday columns colored via Tempo schedule API
5. **Saved Tempo filters + 3-level hierarchy redesign** — `tempo-filters.store.ts` (Zustand + Tauri Store persist) with save/load/rename/reorder/delete via right-click `ContextMenu` pills (matching `UnifiedFilterBar` pattern); WorklogsPage redone with Epic→Story→Subtask hierarchy (Layers/BookOpen/GitBranch icons, indented rows), sticky date header + sticky first column, dependent Jira enrichment query, "No Epic" group for orphaned stories, unresolvable keys rendered with strikethrough
6. **Per-cell worklog CRUD via popover** — `WorklogCellPopover` opens on any cell click (zero-cells included per user override), `WorklogEntryRow` shows entry list with author/comment, inline `EditWorklogForm` with duration validation (rejects `abc`/empty), trash delete with no confirmation, `LogWorkPopover` reused for Add entry; broad-prefix `['tempo','worklogs']` invalidation keeps totals + row/column sums consistent
7. **Quality + cleanup pass** — dead code sweep (zero stale `Workload`/`WidgetGrid`/`WidgetCard`/`WidgetPicker` references in `src/`), full test suite 1298 passing / 0 failing / 0 warnings, Biome lint clean, 145 historical pre-v1.9 quick-task directories archived to `.planning/milestones/historical-quick-tasks/`

**Known Tech Debt (acknowledged at close):**

- Phase 62 WR-01 timer cleanup + WR-02 cached-empty error swallow (WorklogsPage.tsx)
- Phase 62 / 64 INT-W1 unkeyed `<></>` fragments inside hierarchy row maps (`WorklogsPage.tsx:1050/1129/~1240`) — may misreconcile on saved-filter switch
- Phase 63 architectural inversion: `DatePreset` type imported by store from route component (should move to `src/services/tempo/types.ts`)
- TEMPO-03 + ROADMAP Phase 62 SC #1 spec drift (REQUIREMENTS still says "multi-select" / SC says "Tempo" label — implementation is single-select / "Worklogs" per documented user override D-01)
- Stale `{ id: 'workload' }` mock at `Sidebar.test.tsx:79` (cosmetic, test still passes from live store)
- `requirements_completed` SUMMARY frontmatter discipline still 1 of 17 plan summaries — verifications and traceability remain authoritative

---

## v1.8 AIO Test Management (Shipped: 2026-05-19)

**Phases completed:** 8 phases (51–58), 45 plans
**Timeline:** 7 days (2026-05-12 → 2026-05-19)
**Codebase:** 367 files changed (+62,924/−2,759 lines), 464 commits
**Git range:** a05cb2a (docs: start milestone v1.8) → fbbbf48 (docs(phase-58): validation strategy)

**Key accomplishments:**

1. AIO service layer — Bearer PAT probe confirmed on live instance, `src/services/aio/` module with dual base paths (`aio-tcms-api/1.0` legacy + `rest/aio-tcms/1.0` new endpoints), `aioEnabled` toggle in Settings → Integrations with Tauri Store persistence (default false, gates all AIO calls)
2. AIO sidebar + project overview — "Testing" sidebar section (FlaskConical icon, gated on aioEnabled + selectedAioProjectKey), two-panel project overview with recursive folder tree (expand/collapse + cycle count badges), 5-column cycle table driven by batch summary endpoint with zero N+1 fetches; owner column resolved via Jira user-lookup API
3. Cycle detail page — execution progress bar decoupled from run list (batch summary endpoint resolves ~0.4s before paginated runs), tabbed Executions+Defects layout with clickable run rows and Jira-enriched defect table; pin/unpin cycles to header tab strip with Tauri Store persistence across restarts
4. AIO on issue detail — lazy-loaded test runs section (gated on aioEnabled), impacted executions list with per-run status chips, step table with Step/Expected/Actual columns and failure markers via WikiRenderer, AIO attachments grid (in-cycle runs + description image refs, deduplicated by URL), cross-project run navigation; authenticated lightbox
5. Settings AIO project picker — single-project selection moved from `/aio-projects` list page into Settings → Integrations; sidebar deep-links directly to the configured project's overview; legacy list page and route deleted; settings store v17 migration
6. Cycle detail data-fetch redesign — progress bar driven by `fetchAioCycleSummaries` (one POST) independent of `fetchAioTestRunsForCycle`; per-defect-key `useQuery` in `DefectRow` eliminates N+1 Jira fetches and deduplicates duplicate defect IDs via TanStack Query cache; credential gate (`!!jiraBaseUrl && !!token && !tokenLoading`) on all queries prevents first-load 401 flash

**Known Gaps (acknowledged at close):**

- 3 phases missing VERIFICATION.md (Phases 53, 57, 58) — all UAT-verified (13/13, 15/15, 6/6 scenarios PASS); retroactive VERIFICATION.md deferred
- W-1: AioCycleDetailPage uses hardcoded AIO_STATUS_MAP; non-standard AIO instances may mis-bucket progress bar segments
- W-2: TESTCASE_STATUS_MAP missing IDs 51/52 — in-progress runs display as NOT_EXECUTED in Executions tab

---

## v1.7 Performance & Perceived Speed (Shipped: 2026-04-05)

**Phases completed:** 9 phases (42-49), 23 plans, 254 commits
**Timeline:** 8 days (2026-03-29 → 2026-04-05)
**Codebase:** ~57,000+ lines TypeScript, 339 files changed (+38,812/−4,890 lines)

**Key accomplishments:**

1. Route code-splitting for 6 heavy views with React.lazy(), skeleton fallbacks (RouteSpinner), and chunk error boundaries (ChunkErrorBoundary) — initial bundle reduced from 1,215 kB to 1,175 kB
2. React Compiler auto-memoization replacing all manual useMemo/useCallback/React.memo across 35 source files — zero manual memoization remaining
3. Session-persistent caching with gcTime: Infinity, route-aware smart polling via useIsActiveRoute hook — all 5 polling queries pause on inactive routes and stop on minimize
4. Layout-matched skeleton screens on all 8 major data views with 200ms flicker prevention (useDelayedLoading), progressive data loading for sprint board and backlog
5. Query parallelization for sprint board and backlog, sidebar hover prefetch for instant navigation on click — all stale query keys updated after backlog refactor
6. Avatar caching with in-memory blob URL Map + LazyStore disk persistence, 30-day TTL eviction, inflight dedup, and CachedAvatar component wired into all usage sites

**Known Tech Debt:** 7 doc-only items — VALIDATION.md body checklists unchecked in 3 phases, Phase 49 missing VALIDATION.md, ROUT-05 missing from 42-03 SUMMARY frontmatter, one test mock count mismatch (8 vs 9 invalidation calls).

---

## v1.6.3 Release & Auto-Update Pipeline (Shipped: 2026-03-29)

**Phases completed:** 4 phases (38-41), 10 plans, 13 quick tasks
**Timeline:** 6 days (2026-03-24 → 2026-03-29)
**Codebase:** ~51,536 lines TypeScript, 334 files changed (+25,443/−2,497 lines)

**Key accomplishments:**

1. Git-tag-to-runtime version pipeline: inject-version.cjs reads git tag, normalizes to SemVer, and Vite injects APP_VERSION/APP_COMMIT_SHA/APP_BUILD_DATE as typed import.meta.env constants
2. Tauri updater plugin with 6-state Zustand store, desktop guard, TypeScript service abstraction, and configurable TanStack Query polling (1h/6h/12h/24h/manual)
3. Update prompt dialog with rendered markdown changelog, download/install/restart flow, and What's New dialog on first launch after update
4. Two-tier version policy enforcement with fail-open semantics: soft minimum nag banner (dismissible per session) and hard minimum blocking overlay, backed by semver comparison service
5. About dialog with version/build/platform/update-status info, macOS menu bar integration, Updates settings section with frequency control and version history list
6. Full release pipeline: local release.sh with husky hooks, git-cliff changelog generation, cross-platform builds verified, Ed25519 signing keys configured

---

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
