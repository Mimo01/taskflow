# Taskflow

## What This Is

Taskflow is a cross-platform Tauri 2 desktop app for Orange's eshop development team. It unifies Jira (on-premise), Jira Tempo Timesheets, GitLab, and AIO Test Management into a single fast, focused interface — replacing the need to juggle multiple slow tools. It ships as a portable executable (no installer, no admin rights), stores credentials in the OS keychain, and serves both developers and project managers with a minimal static dashboard, sprint board, backlog, global search, notifications, AIO test execution visibility, and Tempo worklog tracking.

## Current Milestone: v1.12 Jira Experience Improvements

**Goal:** Make day-to-day Jira work in Taskflow faster and more direct — consistent done-state visuals, drag-driven ranking and transitions, a non-blocking universal issue peek, tighter issue-detail interactions, and templated bulk subtask creation.

**Target features:**
- Done-state strikethrough for done current-sprint stories on the Backlog active-sprint list, Dashboard sprint card, and Standup Today (matching the kanban board's existing treatment)
- Drag-to-rank stories on the Backlog active-sprint list (drag changes Jira rank; list ordered by rank)
- Drag-to-transition on the sprint board; columns spanning multiple workflow statuses split into per-transition drop boxes during drag
- Universal issue slideover (peek): works for any issue type app-wide, non-blocking (underlying view stays interactive), swap the peeked issue by clicking issues in the underlying view, click-anywhere opens the peek except the issue key (which opens full page), explicit "open full page" affordance
- Issue-detail refinements: move a subtask's parent from the sidebar into main content (like subtasks-under-story); fix `cursor-pointer` on clickable areas
- Card colors: left-edge color stripe on board cards driven by priority / issue type
- Subtask templates & bulk creation: Settings-managed named templates (title required + createmeta-driven rich optional fields: description, assignee, priority, labels, original estimate, story points, due date, components, custom fields, with parent-inheritance placeholders); from a parent issue, pick/build a list, preview & inline-edit, create all subtasks at once in order

**Dropped after audit:** Flags/impediments and swimlanes (already fully built — fixed parent-story grouping + complete `customfield_10021` flag integration); rapid sequential subtask entry (superseded by subtask templates).

**Out of scope for v1.12:** Sprint-board swimlane group-by switcher (epic/assignee); priority of subtasks treated as anti-pattern stays optional; batch-create REST endpoint (bulk creation loops `createIssue` in order).

**Latest milestone shipped:** v1.11 GreenHopper API Migration — 5 phases (71-75), 22 plans, 284 commits, shipped 2026-06-01.

## Core Value

Developers and PMs can see everything they need — tasks, merge requests, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## Requirements

### Validated

- ✓ PAT-based onboarding: Jira and GitLab credentials stored in OS keychain — v1.0
- ✓ Role selection (Developer / Project Manager) with settings change — v1.0
- ✓ Developer dashboard: My Tasks (current sprint), Sprint Board (columns by status), MR Attention list — v1.0
- ✓ Automatic task-to-MR linking via Jira ticket key in MR titles and commit messages — v1.0
- ✓ MR review health badges (waiting / approved / changes requested) on sprint board cards — v1.0
- ✓ Stale MR flagging with configurable threshold — v1.0
- ✓ Jira write actions: status transitions (optimistic update + rollback), inline comments — v1.0
- ✓ Unified notifications hub: Jira mentions + GitLab MR thread activity, delta polling — v1.0
- ✓ OS desktop notifications (macOS, Windows, Linux) with permission-denied in-app banner — v1.0
- ✓ In-app unread badge with mark-as-read and mark-all-read — v1.0
- ✓ PM dashboard: sprint progress (status buckets + story points), team workload, releases view — v1.0
- ✓ Releases view: Jira fix versions with date-matched GitLab milestones/tags — v1.0
- ✓ Global search across Jira tasks and GitLab MRs, grouped results with detail panel — v1.0
- ✓ Dark/light/system theme toggle with persistence — v1.0
- ✓ Last-refreshed timestamps and loading/error states on all data views — v1.0
- ✓ Releases ordered newest→oldest with released/unreleased/overdue/countdown badges — v1.1
- ✓ Workload correctly counts story points per assignee (subtasks excluded) with time tracking columns — v1.1
- ✓ Sprint progress shows points by status breakdown, time totals, and per-assignee breakdown table — v1.1
- ✓ Developer dashboard shows my open subtasks, MR health summary, sprint health, and recent notifications — v1.1
- ✓ My Tasks and Sprint Board group subtasks under parent story (collapsible hierarchy) — v1.1
- ✓ MR Attention shows only open MRs assigned to me or linked to stories with my subtasks — v1.1
- ✓ Full-page /notifications route with Bell sidebar link — v1.1
- ✓ Full issue detail panel with rich text, editable fields (assignee/priority/story points/labels), subtask list, linked issues, comment thread, post comment, and Open in Jira deep link — v1.2
- ✓ Sprint board redesigned: subtasks as first-class kanban cards grouped under collapsible parent story headers, all team members visible, drag-to-move status transitions with optimistic rollback, QuickCreateInput per column — v1.2
- ✓ Backlog view: paginated unassigned issues, move-to-sprint, create new story, filter by epic/label/assignee — v1.2
- ✓ Epic management: epic list with metrics, sprint board + backlog epic filter, epic detail slide-over (via IssueDetailSheet isEpic branch), create epic dialog — v1.2
- ✓ Create/edit Jira issues with dynamically discovered fields from createmeta (account + all required custom fields), issue links with type selection — v1.2
- ✓ New abstract/geometric app icon across all platforms — v1.3
- ✓ Multi-page Settings with sidebar navigation (Connections, Appearance, Notifications, Workflow) — v1.3
- ✓ Keyboard shortcuts system with centralized registry, Cmd+/ help panel, J/K list navigation, input suppression — v1.3
- ✓ Command palette (Cmd+K) with fuzzy search across issues, MRs, nav actions, live Jira search — v1.3
- ✓ Redesigned header with branding and pinned-issue tab strip with persistence — v1.3
- ✓ Recent items quick-access popover in header — v1.3
- ✓ Illustrated empty states and actionable error recovery across all data views — v1.3

- ✓ Codebase hardened with comprehensive test coverage (615+ tests), Biome linting, and consistent patterns — v1.4
- ✓ API services decomposed into focused domain modules (jira.ts → 14 modules) — v1.4
- ✓ Unified Developer Tools with request logging, operation profiling, and granular settings — v1.4
- ✓ All dependencies updated to latest compatible versions — v1.4
- ✓ Virtualized rendering for long lists (backlog, notifications, sprint board) — v1.4
- ✓ Zero `any` types and zero double-casts in production code — v1.4
- ✓ Unified activity timeline with changelog, comments, and worklogs merged chronologically with type filter chips — v1.5
- ✓ Comment editing and deletion for own comments on issues — v1.5
- ✓ Watcher toggle with count display and overdue badge on issues past due date — v1.5
- ✓ Clone issue with one-click (copies summary, description, labels, priority, assignee) — v1.5
- ✓ Time tracking with worklog CRUD (log, edit, delete), natural language duration input, sidebar summary with progress bar — v1.5
- ✓ File attachments with upload (button + drag-drop), image thumbnails, lightbox with keyboard navigation, download — v1.5
- ✓ @mention autocomplete in comment composer with cursor-anchored popover and Jira wiki markup insertion — v1.5
- ✓ Sprint goal banner on sprint board header — v1.5
- ✓ Board quick filter chips (Jira QFs + label toggles) with AND logic — v1.5
- ✓ Saved filter management: save/edit/delete Jira filters, sidebar list, command palette search, sprint board JQL integration with active filter banner — v1.5
- ✓ Customizable sidebar with visibility toggles, drag-and-drop reorder, and Dev/PM presets — v1.5
- ✓ Widget-based dashboard with 11 widget types, drag/resize grid layout, and role presets — v1.5
- ✓ GitHub Actions CI pipeline: tag push → cross-platform builds (macOS/Windows/Linux) → publish to public repo — v1.6.3
- ✓ Automatic version sync: app version derived from git tag at build time via inject-version.cjs — v1.6.3
- ✓ Build-time metadata (commit SHA, build date) injected and accessible at runtime — v1.6.3
- ✓ Tauri updater integration: in-app download + automatic install with restart — v1.6.3
- ✓ Configurable update check frequency (1h/6h/12h/24h/manual) in Settings — v1.6.3
- ✓ Update prompt dialog with rendered markdown changelog and "Update Now" / "Later" actions — v1.6.3
- ✓ What's New dialog shown on first launch after update — v1.6.3
- ✓ Version history section in Settings showing all releases with changelogs — v1.6.3
- ✓ Two-tier force-update policy: soft minimum (nag banner) and hard minimum (blocking overlay) with fail-open — v1.6.3
- ✓ Version policy file on public repo defining soft/hard minimum versions — v1.6.3
- ✓ About dialog with version, build date, commit SHA, platform/arch, and update status via macOS menu bar — v1.6.3
- ✓ Skeleton screens replacing spinners across all 8 major data views with 200ms flicker prevention — v1.7
- ✓ Progressive/streaming data population — sprint board subtasks and backlog epic metadata load progressively — v1.7
- ✓ Stale-while-revalidate with gcTime: Infinity — cached data shown instantly on navigation — v1.7
- ✓ Route-level code splitting for 9 lazy-loaded route chunks with error boundaries — v1.7
- ✓ Prefetching on hover/focus for sidebar links pre-warms cache for instant navigation — v1.7
- ✓ Query parallelization for sprint board and backlog — sequential API chains eliminated — v1.7
- ✓ Smart polling with route-aware pause for inactive views and minimize/restore detection — v1.7
- ✓ React Compiler auto-memoization — all manual useMemo/useCallback/React.memo removed — v1.7
- ✓ Avatar caching with in-memory blob URLs and disk persistence across app restarts — v1.7
- ✓ Bundle analysis tooling (rollup-plugin-visualizer) and dead code elimination — v1.7
- ✓ `aioEnabled` toggle in Settings → Integrations (persists via Tauri Store, gates all AIO calls, default false) — v1.8 Phase 51
- ✓ AIO service module (`src/services/aio/`) with probe-confirmed dual base paths, paginated response handling, `fetchAioProjects`, `fetchAioTestRunsForCycle` — v1.8 Phase 51
- ✓ AIO sidebar "Testing" section with FlaskConical icon (gated on aioEnabled + selectedAioProjectKey); two-panel project overview with recursive folder tree (expand/collapse, cycle count badges), 5-column cycle table from batch summary endpoint — v1.8 Phases 52, 57
- ✓ Cycle detail page: execution progress bar (decoupled from run list via batch summary endpoint, ~0.4s), tabbed Executions+Defects layout, clickable run rows, Jira-enriched defect table with sort/filter; pin/unpin cycles to header tab strip with Tauri Store persistence — v1.8 Phases 53, 56, 58
- ✓ AIO project selection in Settings → Integrations: single configured project drives the app, sidebar deep-links to selected project overview, legacy list page deleted — v1.8 Phase 55
- ✓ AIO test runs section on Jira issue detail: impacted executions with per-run status chips, step table with Step/Expected/Actual columns and failure markers via WikiRenderer, AIO attachments grid with authenticated lightbox, cross-project run navigation — v1.8 Phase 54
- ✓ Cycle detail data-fetch redesign: progress bar from `fetchAioCycleSummaries` (one POST) independent of paginated runs; per-defect-key `useQuery` dedup eliminating N+1 Jira fetches; credential gate preventing first-load 401 flash on all AIO pages — v1.8 Phase 58

- ✓ Tempo worklog viewer: configurable day-column table (Phase 62) evolved into Epic→Story→Subtask hierarchy with sticky headers + sticky first column + clickable rows + cell popover CRUD (Phase 64) — v1.9 Phases 62, 64
- ✓ Tempo service layer: Bearer PAT probe-confirmed on Jira DC + `src/services/tempo/` module (client/types/worklogs/schedule) + `tempoEnabled` v20 settings toggle — v1.9 Phase 61
- ✓ Tempo saved filters: persist across sessions via Zustand + Tauri Store; right-click ContextMenu pill UX (save, load, rename, reorder, delete) — v1.9 Phase 63
- ✓ Remove Workload page and all related dashboard widgets — v1.9 Phase 59
- ✓ Remove widget-based customizable dashboard system (react-grid-layout, 11 widget types) — v1.9 Phase 59
- ✓ New minimal static dashboard: gradient hero with personalised greeting + en-GB date + responsive 3-card grid (sprint health, my in-progress subtasks with breadcrumb-chain navigation, next release countdown with live progress bar) — v1.9 Phase 60
- ✓ Per-cell worklog CRUD via popover: WorklogCellPopover + EditWorklogForm + duration validation + trash delete + LogWorkPopover reuse for Add — v1.9 Phase 64
- ✓ Full test suite passing, zero regressions (1356 passing, 0 failing, 0 warnings) — v1.10 Phase 65
- ✓ Tech-debt cleanup of carried v1.9 + v1.8 items (CLEAN-01..07): WorklogsPage timer/error/fragment fixes, DatePreset type move, stale sidebar test mock, AIO TESTCASE_STATUS_MAP 51/52, runtime AIO status map from /config — v1.10 Phase 65
- ✓ Dead code sweep: zero stale widget/workload imports after v1.9 removals — v1.9 Phase 63
- ✓ Remove Developer/PM role concept across settings, wizard, sidebar, and store: `getDefaultSidebarItems` no-arg all-visible, settings store at v22, onboarding wizard 4 steps, PresetButtons/RoleSection/RoleStep deleted — v1.10 Phase 66
- ✓ Settings → Sidebar tightened to visibility-only: `SidebarItemsList` rewritten 180→50 LOC checkbox list, `reorderSidebarItem` removed, sidebar-items panel gone from Appearance, all four `@dnd-kit/*` packages uninstalled — v1.10 Phase 67
- ✓ Onboarding wizard Integrations step: shared `AioBlock` (AIO toggle + project picker, reused by Settings) + Tempo toggle, both written directly to the settings store as single source of truth — v1.10 Phase 68
- ✓ Standup Notes Yesterday recap: `/standup-notes` route + all-visible sidebar entry, last-working-day resolution (weekends + Tempo-schedule holidays skipped), four independently-degrading sections (Tempo worklogs, Jira changelog, Git commits, MR activity) — v1.10 Phase 69
- ✓ Standup Notes Today section: open sprint subtasks/tasks (assignee = me) grouped by parent story with nested participating MRs — v1.10 Phase 70

- ✓ GreenHopper typed adapter layer: `services/jira/greenhopper/` module with typed fetchers, entity-map resolvers, and `adaptIssue` wired into the `services/jira.ts` barrel — v1.11 Phase 71
- ✓ Workflow transitions cached per-project via `transitions.json` (`projectId × issueTypeId → workflow → transitions[]`); per-issue REST `/transitions` GET deleted — v1.11 Phase 72
- ✓ Sprint board reads from a single `allData.json` call with `timeInColumn` badge per card; `fetchSprintSubtasks` deleted — v1.11 Phase 73
- ✓ Backlog reads from a single `data.json` call; legacy REST fetchers hard-deleted with static-grep guard — v1.11 Phase 74
- ✓ Progressive issue detail rendering: header visible at TTFMP 1180ms, per-section skeletons, per-section inline error/retry isolation; TTI 1682ms — v1.11 Phase 75

### Active

<!-- v1.12 Jira Experience Improvements — see REQUIREMENTS.md for REQ-IDs -->

- [ ] Done-state strikethrough for done current-sprint stories on Backlog sprint list, Dashboard sprint card, and Standup Today
- [ ] Drag-to-rank stories on the Backlog active-sprint list (ordered by Jira rank)
- [ ] Drag-to-transition on the sprint board; multi-status columns split into per-transition drop boxes
- [x] Universal non-blocking issue slideover (peek) for any issue type, with issue-key → full page and explicit open-full-page affordance — validated Phase 77
- [x] Issue-detail: subtask parent moved to main content; cursor-pointer on clickable areas — validated Phase 77
- [ ] Card colors: left-edge stripe by priority / issue type
- [ ] Subtask templates & bulk creation (Settings-managed, createmeta-driven rich fields, create-all-at-once from parent)

### Out of Scope

- Historical analytics / burndown charts — no daily-use value; complex data pipeline; LinearB/Swarmia exist for this
- OAuth / SSO login — team uses PATs; OAuth adds server-side requirements conflicting with no-server architecture
- Multi-project aggregation — exponentially increases data model complexity; one project sufficient
- Create Jira task from GitLab MR — workflow confusion; task creation always explicit
- Two-way sync / webhooks — requires server component to receive webhooks
- Email or Slack notifications — external service dependencies
- Inline MR diff / full code review UI — GitLab's UI is mature; deep-link for full review
- Bulk operations on sprint board issues — components built but user-deferred during v1.5 review; files on disk, not wired
- GitLab write actions (approve, comment, request changes) — deferred to v2.0
- Full JQL editor with syntax highlighting — months of work; plain text JQL input sufficient
- Pinned-issues section on Standup Notes Today (STAND-08) — descoped by user during v1.10 Phase 70; pinning surface stays on the issue itself
- Planned-worklog-targets / Log Work action on Standup Notes Today (STAND-09) — built in Phase 70 then removed in the standup redesign (commit c5b19544); Log Work stays on the Worklogs page and issue detail

## Current State

**v1.10 shipped 2026-05-25** — 6 phases (65-70), 15 plans, 17 quick tasks, 271 commits, 432 files changed (+30,286/−1,489 lines) over 3 days. Codebase: ~80,895 lines TypeScript / 136 test files.

v1.8/v1.9 tech debt paid down (WorklogsPage timer/error/fragment fixes, `DatePreset` relocation, AIO status map from live `/config`). The Developer/PM role concept was removed app-wide — universal access, no presets, no gating, settings store at v22 then v23. Settings → Sidebar reduced to visibility-only toggles (all four `@dnd-kit/*` packages uninstalled). The onboarding wizard gained an Integrations step (shared `AioBlock` + Tempo toggle writing to the settings store). The Standup Notes page (`/standup-notes`) shipped with a last-working-day Yesterday recap (Tempo worklogs, Jira changelog, Git commits, MR activity) and a Today section (open sprint subtasks grouped by story with nested participating MRs). Pinned-issues (STAND-08) and Log Work targets (STAND-09) on the standup page were descoped during the Phase 70 redesign.

**Milestone closed with tech debt:** Phase 69 has no `VERIFICATION.md` (compensated by 12/12 UAT + nyquist-green VALIDATION); Phases 68/70 verification at `human_needed`; minor code-review items WR-05 (unguarded SP cast) and IN-01 (uncleared setTimeout). See `.planning/milestones/v1.10-MILESTONE-AUDIT.md`. v2.0 scope TBD.

**v1.11 shipped 2026-06-01** — 5 phases (71-75), 22 plans, 284 commits, 308 files changed (+48,340/−16,981 lines) over 4 days. Eliminated Jira API n+1 bottlenecks: sprint board and backlog now each load via a single GreenHopper API call; workflow transitions cached per-project; issue detail panel renders progressively with TTFMP 1180ms. 17/17 requirements satisfied. 10 non-blocking tech-debt items acknowledged. Milestone closed `tech_debt` — run `release.sh` to cut the v1.11.x release.

## Context

- **Shipped v1.0:** 2026-03-12 — 4 phases, 20 plans, ~11,017 lines TypeScript
- **Shipped v1.1:** 2026-03-13 — 4 phases, 24 plans, ~15,856 lines TypeScript
- **Shipped v1.2:** 2026-03-15 — 9 phases, 29 plans, ~23,607 lines TypeScript
- **Shipped v1.3:** 2026-03-19 — 7 phases, 27 plans, ~32,173 lines TypeScript
- **Shipped v1.4:** 2026-03-20 — 6 phases, 21 plans, ~37,520 lines TypeScript
- **Shipped v1.5:** 2026-03-24 — 7 phases, 25 plans, 415 files changed (+54,227/−4,827 lines)
- **Shipped v1.6.3:** 2026-03-29 — 4 phases, 10 plans, 13 quick tasks, 334 files changed (+25,443/−2,497 lines)
- **Shipped v1.7:** 2026-04-05 — 9 phases, 23 plans, 254 commits, 339 files changed (+38,812/−4,890 lines)
- **Shipped v1.8:** 2026-05-19 — 8 phases (51–58), 45 plans, 464 commits, 367 files changed (+62,924/−2,759 lines)
- **Shipped v1.9:** 2026-05-23 — 6 phases (59-64), 20 plans, 258 commits, 230 files changed (+26,283/−3,085 lines)
- **Shipped v1.10:** 2026-05-25 — 6 phases (65-70), 15 plans, 17 quick tasks, 271 commits, 432 files changed (+30,286/−1,489 lines)
- **Shipped v1.11:** 2026-06-01 — 5 phases (71-75), 22 plans, 284 commits, 308 files changed (+48,340/−16,981 lines)
- **Tech stack:** Tauri 2, React 18, TypeScript, Zustand, TanStack Query, shadcn/ui, Tailwind v4, Vitest, Biome, @dnd-kit/core, @dnd-kit/sortable, @tanstack/react-virtual, jira2md, react-markdown, react-hotkeys-hook, cmdk, babel-plugin-react-compiler (react-grid-layout removed v1.9)
- **Jira instance:** On-premise (Jira Data Center v10.3.15) — REST API v2 with Bearer PAT auth; createmeta/workflow/transitions APIs used for issue management
- **GitLab:** Self-hosted or gitlab.com — personal access token
- **Team:** Orange eshop project — developers + project managers using the same app with role-based views
- **Scale:** One Jira project + one GitLab project at a time
- **Build:** Portable executable — no installer, no admin rights; `createHashRouter` for SPA routing in production
- **Test suite:** ~1358 tests passing, zero failures, zero warnings; Vitest with LazyStore mock
- **Codebase:** ~80,895 lines TypeScript / 136 test files
- **Settings store:** persist version 23 (v22 dropped `role`; v23 appended the standup-notes sidebar item for upgrading users)
- **Known caveats:** Phase 69 missing VERIFICATION.md (UAT 12/12 — run `/gsd:verify-work 69`); phases 53, 57, 58 missing VERIFICATION.md (all UAT-verified); Bulk operations (BOARD-04–07) components on disk, not wired; Cmd+Shift nav shortcut deviation needs product owner sign-off; Apple/Windows code signing deferred to future release

## Constraints

- **Auth:** Personal access tokens only — no OAuth, no server-side credential storage
- **Cross-platform:** macOS, Windows, Linux via Tauri 2 portable build
- **Jira API:** Jira Data Center REST API v2 — not Cloud APIs; `name` not `accountId`, offset pagination, Bearer PAT
- **No analytics:** Real-time/live only — no historical data processing
- **Distribution:** Portable executable only — no system installer, no UAC/admin elevation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 desktop app (portable build) | No CORS with on-premise Jira; no admin rights needed; ~10MB; OS keychain for PATs | ✓ Good — CORS eliminated, keychain works on all platforms |
| PAT-based auth only | Simple, no server needed, matches team's current practice | ✓ Good — PATs stable and sufficient |
| Task-MR linking via ticket number parsing | No formal integration; MR titles/commits contain ticket IDs | ✓ Good — automatic linking works reliably |
| Role-based dashboards (dev vs PM) | Different needs, same data sources | ✓ Good — clean separation with shared data layer |
| createHashRouter (not createBrowserRouter) | BrowserRouter breaks Tauri production SPA routing | ✓ Good — hash routing works correctly in portable build |
| Stronghold vault password from Tauri Store | Random 32-byte hex key on first launch; migration path is plugin-keyring in Tauri v3 | ✓ Good — secure, no user friction |
| Single tauriService abstraction (tauri.ts) | Enables testing without Tauri runtime | ✓ Good — test isolation clean |
| tauri-plugin-http fetch in renderer | Plain fetch() causes CORS in Tauri 2 webview for on-premise instances | ✓ Good — CORS resolved; vi.stubGlobal pattern for tests |
| Single poll coordinator (TanStack Query) | No per-component polling; minimum 60s dashboard / 30s notification-critical | ✓ Good — no redundant fetches |
| readIds as string[] (not Set) in notifications store | Zustand JSON persist serializes Set as empty object, losing read state on restart | ✓ Good — persistence works |
| Tailwind v4 with @tailwindcss/vite only | No postcss.config.js or tailwind.config.js; v4 CSS pipeline is sole entry point | ✓ Good — build output correct |
| StatusPopover with optimistic update + rollback | Loading feedback and error recovery without toast/modal clutter | ✓ Good — per-row inline errors |
| fetchFixVersions returns (data.values ?? []) | Jira returns paginated envelope not bare array; defensive fallback | ⚠️ Revisit — v1.1 found Jira Server returns bare array, not envelope; fixed with Array.isArray guard |
| adfToPlainText handles null/string/ADF defensively | Jira Server returns strings, Cloud returns ADF; cast to unknown at call site | ✓ Good — no runtime crashes |
| Two-query subtask strategy for fetchSprintIssues | `sprint in openSprints()` excludes subtasks on Jira DC; second query: `issuetype in subtaskIssueTypes() AND parent in (...)` | ✓ Good — subtasks reliably fetched; SUBTASK_CHUNK_SIZE=50 |
| discoverStoryPointsField() for story point field ID | `customfield_10016` is default but not guaranteed on DC; field discovery is the safe path | ✓ Good — field resolved dynamically |
| GitLab switched from group selection to project selection | Group-level MR fetches hit permission limits; project-level is more precise and reliable | ✓ Good — MR-to-Jira linking improved |
| userId in gitlab-mrs queryKey + enabled guard | Prevents stale empty-array cache when userId resolves from undefined after validateGitLab | ✓ Good — no more empty reviewer MR lists |
| WorkloadTab conditional increment (not guard skip) for done stories | Done stories appear as sub-rows; excluded from count/pts only — matched UAT expectation | ✓ Good — done stories visible without inflating counts |
| Dashboard panels receive props from thin index.tsx | Token loading centralized; panels own their queries — avoids prop drilling and keeps index.tsx testable | ✓ Good — clean separation |
| Notifications store sanitized on rehydration | Numeric/null id values coerced to string — prevents row-click failures after store migration | ✓ Good — no crashes on existing persisted stores |
| Global IssueDetailSheet lifted to AppLayout (not Dashboard) | Search and notifications live in TopBar (global shell), not inside a route — sheet must be at the same level | ✓ Good — all entry points accessible without context |
| Prop threading for onIssueClick (not React context) | Codebase uses zero createContext/useContext — kept consistent with explicit prop threading | ✓ Good — data flow explicit; consistent with existing patterns |
| EpicDetailSheet implemented as IssueDetailSheet isEpic=true branch | User approved during Phase 13 — avoids duplicate sheet component; epic issues are still issues | ✓ Good — user approved; reduces component surface area |
| discoverCustomFields() + createmeta for issue creation | Hardcoded field IDs fail across Jira DC instances; createmeta returns required fields dynamically | ✓ Good — account field and all required custom fields discovered at runtime |
| @dnd-kit for drag-and-drop (not react-beautiful-dnd) | react-beautiful-dnd deprecated and unmaintained; @dnd-kit has active support and better Tauri webview compat | ✓ Good — drag-and-drop works reliably |
| jira2md + react-markdown pipeline for wiki markup | Jira DC stores descriptions as wiki markup (not ADF); jira2md converts to CommonMark for rendering | ✓ Good — rich text rendering without ADF editor complexity |
| useAuthStore (not useSettingsStore) for Jira credentials in mutations | useSettingsStore holds UI preferences only; auth credentials live in useAuthStore + Stronghold | ✓ Good — fixed EPIC-04 credential bug; clear store separation |
| EpicsPage uses fetchEpicsBasic (not fetchEpicsWithEnrichment) | Enrichment requires N story-count queries — too slow for list view per user preference | ✓ Good — user accepted trade-off; detail available on click |
| react-hotkeys-hook for keyboard shortcuts | Centralized registry + global hook; avoids manual addEventListener management | ✓ Good — clean shortcut system, input suppression works |
| cmdk (shadcn command) for command palette | Accessible primitives, fuzzy search built-in, works with React 18 | ✓ Good — palette responsive, no conflicts with base-ui |
| LazyStore persistence for pinned tabs + recent items | Same Tauri Store pattern as settings store; consistent, no new deps | ✓ Good — persistence works across restarts |
| ApiError class + three-state detection pattern | Structured HTTP errors with isAuthError; EmptyState vs ErrorState vs StaleDataBanner | ✓ Good — consistent error UX across 10+ views |
| Full-page route for issue detail (not slide-over sheet) | Quick task 260316-r0x — better navigation, breadcrumbs; resolves J/K guard | ✓ Good — eliminated J/K guard complexity entirely |
| Cmd+Shift+S/B/N (not G-chord) for nav shortcuts | G-chord pattern unfamiliar; Cmd+Shift more discoverable | ⚠️ Revisit — needs product owner sign-off |
| Biome as single lint+format tool (replacing ESLint+Prettier) | One tool, faster execution, simpler config; CSS excluded (Tailwind v4 syntax unsupported) | ✓ Good — zero lint errors, CI-ready scripts |
| In-memory Map-based LazyStore mock for tests | Real LazyStore requires Tauri runtime; Map mock sufficient for all store test scenarios | ✓ Good — 615+ tests pass with clean teardown |
| jira.ts decomposed into 14 domain modules with barrel re-export | 1,200+ line monolith → focused modules; barrel preserves all 48+ import paths | ✓ Good — no import changes needed in consumers |
| @tanstack/react-virtual for list virtualization | Lightweight, composable, works with existing DOM; jsdom fallback renders all rows | ✓ Good — handles 200+ items; graceful test fallback |
| Granular dev tools toggles replacing single debugMode boolean | 6 independent toggles (request logging, response body, operation profiling, waterfall, retention) | ✓ Good — fine-grained control without all-or-nothing |
| Per-operation scoped timelines in waterfall (not global) | Global timeline made short operations invisible as thin slivers | ✓ Good — each operation readable regardless of total timeline |
| noExplicitAny as Biome error (not warn) | Zero-any policy enforced at lint level; single cast from unknown safe for Zustand migrate | ✓ Good — prevents regression |
| react-grid-layout for dashboard widgets | Mature grid library with drag/resize; CJS interop via type-cast default import | ✓ Good — responsive grid with persistent layouts |
| Widget wrappers load tokens internally from Stronghold | Eliminates prop-drilling from Dashboard; each widget self-contained | ✓ Good — clean architecture, easy to add new widgets |
| Session-only Zustand store for saved filters (no persist) | Filters fetched fresh from Jira each session; avoids stale filter state | ✓ Good — always reflects server state |
| Saved filter JQL results as Set<string> for sprint board | O(1) intersection with sprint swimlane issue keys | ✓ Good — efficient filtering without re-fetching sprint data |
| Inline delete confirmation for filters (not nested dialog) | Avoids dialog-in-dialog UX; simpler interaction pattern | ✓ Good — cleaner UX |
| Sidebar fetches favourite filters with useQuery (2min staleTime) | Syncs to Zustand store for cross-component access | ✓ Good — automatic refresh, shared state |
| Tempo saved filters use createTauriStorage('tempo-filters.json') + Zustand persist | Exact same pattern as pinned-tabs.store.ts; no new concepts introduced | ✓ Good — consistent persistence pattern across stores |
| Tempo filter pill UX: right-click ContextMenu (not hover-× / double-click) | Matches UnifiedFilterBar/SavedFilterList established pattern; user-approved during phase checkpoint | ✓ Good — consistent cross-feature interaction model |
| TempoFilter shape excludes customFrom/customTo | Date range is represented by DatePreset enum; custom range not supported in v1.9 | ✓ Good — simpler shape; custom range deferred |
| inject-version.cjs for git-tag-to-runtime version sync | No hardcoded versions in config; single source of truth from git tags | ✓ Good — version always matches release tag |
| #[cfg(desktop)] guard on updater plugin registration | Mobile/web targets don't need updater; compile-time exclusion | ✓ Good — clean platform separation |
| invoke('plugin:process\|relaunch') instead of @tauri-apps/plugin-process | Package not in project dependencies; invoke() is lighter | ✓ Good — no extra dependency |
| compare-versions library for semver comparison | Handles pre-release tags correctly; lightweight | ✓ Good — reliable version comparison |
| version-policy.json safe defaults (0.0.0/0.0.0) | No enforcement until intentionally bumped; fail-open design | ✓ Good — safe default, no accidental lockouts |
| Local release.sh + husky hooks replacing GitHub Actions CI | Full control over build process; no CI runner costs; cross-platform builds from local machine | ✓ Good — simpler, faster iteration |
| git-cliff for changelog generation | Convention-based changelog from git commits; cliff.toml for categorization | ✓ Good — automated, consistent changelogs |
| Ed25519 signing for Tauri updater | Required by Tauri updater plugin; keys generated and backed up | ✓ Good — update integrity verified |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

| React Compiler auto-memoization | Eliminates all manual useMemo/useCallback/React.memo; babel-plugin-react-compiler handles memoization at IR level | ✓ Good — 35 files cleaned, zero manual memos remaining |
| AIO uses same Bearer PAT auth as Jira (source: 'jira') | AIO plugin lives on the same host as Jira; adding a third credential type was unnecessary complexity | ✓ Good — no extra credentials; aioFetch shares the Jira PAT |
| AIO dual base paths (`aio-tcms-api/1.0` + `rest/aio-tcms/1.0`) | Probe confirmed two distinct path prefixes; legacy endpoint for runs, new path for folder/summary/count endpoints | ✓ Good — probe-first approach prevented hardcoded wrong paths |
| AIO query keys use `['aio', jiraBaseUrl, ...]` prefix | Prevents Jira invalidation sweeps from clearing AIO cache; avoids cross-contamination between jira/aio queries | ✓ Good — invalidation scoped correctly |
| aioEnabled defaults to false, gates all AIO calls | Users without AIO installed see no AIO UI and fire zero AIO requests | ✓ Good — clean opt-in; no noise for non-AIO teams |
| Settings → Integrations as AIO project selection surface (not a list page) | List page required navigation to select a project; Settings picker is single global state with immediate sidebar effect | ✓ Good — one-click setup; sidebar deep-links instantly |
| Folder-tree cycle organization with server-side `?folderID=` filter | Probe A5 confirmed server-side filtering; avoids fetching all cycles on mount and client-filtering | ✓ Good — zero unnecessary fetches on folder switch |
| Batch summary endpoint (`POST paged2`) for cycle progress stats | Eliminates N+1 per-cycle run fetches on project overview page; single POST returns all stats | ✓ Good — overview loads in ~1s vs minutes for N+1 approach |
| Progress bar from summary endpoint, decoupled from run list | `fetchAioCycleSummaries` resolves ~0.4s; `fetchAioTestRunsForCycle` resolves ~11s — visible progress before runs table | ✓ Good — dramatically improves perceived load time |
| Per-defect-key `useQuery` in DefectRow (not service-level N+1) | TanStack Query deduplicates same key across rows; service layer returns raw IDs | ✓ Good — identical defect IDs across runs fire exactly one Jira fetch |
| Token never in AIO queryKey | Following same convention as Jira; token rotation should not bust cache; credential is read inside queryFn | ✓ Good — cache stable across token refreshes |
| gcTime: Infinity for session-persistent cache | Users see cached data instantly on back-navigation; no gc during session | ✓ Good — stale-while-revalidate works correctly |
| useIsActiveRoute hook for polling pause | Route-aware polling prevents background queries from burning CPU/network | ✓ Good — 5 views pause correctly |
| useDelayedLoading with 200ms threshold | Prevents skeleton flash on fast cache hits while showing feedback on slow loads | ✓ Good — smooth UX on all 8 views |
| Per-section backlog queries (not monolithic) | Independent queries for sprint stories, sprint list, backlog issues enable parallel fetch and progressive rendering | ✓ Good — backlog loads progressively |
| CachedAvatar with blob URL Map + LazyStore disk persistence | Avatars cached in memory and on disk; 30-day TTL eviction; inflight dedup | ✓ Good — no repeated avatar fetches |
| Atomic widget+store deletion in one commit (v1.9 Phase 59) | `settings.store.ts` hard-imports `registry.ts`; deleting widgets without removing the import would break compile — must be coordinated in one atomic step | ✓ Good — single commit kept tree green throughout |
| Verify cleanup with `npm run build`, not `tsc` (v1.9 Phase 59) | `react-grid-layout` CSS imports fail silently in TypeScript checks; only the full build catches them | ✓ Good — caught dangling CSS imports immediately |
| Tempo Bearer PAT shares Jira credentials (v1.9 Phase 61) | Same on-prem host as Jira; introducing a third credential type would create UX friction without security benefit | ✓ Good — single PAT, sidebar gate handles auth boundary |
| Worklog date bucketing uses `.slice(0, 10)` on local-date components, never `toLocaleDateString()` (v1.9 Phase 62) | `toLocaleDateString()` returns locale-formatted strings that don't sort or compare; ISO date-key slicing is timezone-stable | ✓ Good — TZ-independent grouping verified in tests |
| Tempo single-select people filter, not multi-select (v1.9 Phase 62, D-01 override) | User documented preference during phase discussion (62-DISCUSSION-LOG.md); REQUIREMENTS wording predates the override | ✓ Good — simpler UX; verifier accepted override |
| Tempo `jiraToken` excluded from TanStack Query keys (v1.9 Phase 62, T-62-06) | Tokens in queryKey would bust cache on every rotation and expose creds in dev tools cache inspector; token lives only in `queryFn` closure | ✓ Good — cache stable across token refreshes |
| WorklogsPage replaced person×day pivot with Epic→Story→Subtask hierarchy (v1.9 Phase 64) | User feedback: pivot table lost issue context; hierarchy reflects how worklogs map to actual work breakdown | ✓ Good — clearer mental model; cell popover preserves entry-level CRUD |
| Sticky-table via CSS `position: sticky` (top + left), not virtualized scrolling (v1.9 Phase 64) | Hierarchy datasets are bounded by sprint scope; sticky CSS works without intersection-observer plumbing | ✓ Good — sticky header + first column both pin correctly |
| Zero-hour cells DO open the WorklogCellPopover (v1.9 Phase 64, override of Plan 02 spec) | User confirmed "useful for adding new entries" — clicking an empty day to log work is faster than navigating elsewhere | ✓ Good — user-confirmed UX win |
| Broad-prefix `['tempo', 'worklogs']` invalidation on popover CRUD (v1.9 Phase 64) | Single mutation can affect multiple cells (cell totals, row totals, column totals, grand total); broad invalidation guarantees consistency | ✓ Good — totals always reconcile post-mutation |
| 145 pre-v1.9 quick-task dirs archived to milestones/historical-quick-tasks/ at milestone close | Scanner couldn't read status from older SUMMARY frontmatter convention; rather than retrofit 145 files, archive bucket clears the audit and preserves history | ✓ Good — audit-open went 161→17, all 17 benign |
| AIO status map fetched from live `/config` endpoint, not hardcoded (v1.10 Phase 65) | Hardcoded `AIO_STATUS_MAP` broke on non-standard AIO instances; runtime fetch + `normalizeStatusById` adapts per-instance | ✓ Good — resilient to instance variation (CLEAN-07) |
| Roles removed entirely → universal access (v1.10 Phase 66) | The Dev/PM split added gating complexity for no real benefit; same team uses the same app | ✓ Good — zero role-gated conditionals remain; v22 migration resets all users to all-visible |
| Settings → Sidebar reduced to visibility-only, drag-reorder dropped (v1.10 Phase 67) | Reorder added `@dnd-kit` weight + UI complexity rarely used; visibility toggles cover the real need | ✓ Good — 180→50 LOC, four `@dnd-kit/*` packages uninstalled |
| Wizard Integrations step binds directly to settings store, no wizard-local state (v1.10 Phase 68) | A separate wizard state would need reconciliation on completion; single source of truth avoids drift | ✓ Good — shared `AioBlock` reused by Settings; selections persist across nav |
| "Yesterday" = last working day, not calendar day (v1.10 Phase 69) | Monday standups need Friday's work; weekends + Tempo-schedule holidays must be skipped | ✓ Good — schedule-aware resolution; degrades gracefully when Tempo off |
| Standup sources each load independently with per-section states (v1.10 Phase 69) | One slow/failed integration shouldn't blank the whole recap | ✓ Good — four sections degrade to empty-state in isolation |
| Pinned issues + Log Work dropped from Standup Today during redesign (v1.10 Phase 70) | User decided the standup page is read/plan-oriented; pinning + logging belong on their own surfaces | ✓ Good — user-confirmed; STAND-08/09 descoped, Today shows sprint subtasks + nested MRs |
| Hard cutover per surface — REST paths deleted alongside GreenHopper replacement (v1.11) | No coexistence flag; simpler codebase; user chose clean cutover over staged rollout | ✓ Good — codebase cleaner; static-grep guard prevents reintroduction |
| `CATEGORY_COLUMNS` 3-bucket over `columnsData.columns[]` for sprint board (v1.11 Phase 73) | `columnsData.columns[]` mapped to backend workflow statuses, not the app's 3-bucket UI; accepted per D-03/D-03a | ✓ Good — user-accepted; board renders correctly with ACTIVE/FUTURE/DONE buckets |
| GreenHopper `details.json` migration descoped from v1.11 (Phase 75 rescoped) | Issue detail stay on REST v2; progressive rendering delivers the UX win without the API migration complexity | ✓ Good — PERF-DETAIL-01/02/03 delivered equal perceived-performance gain at lower risk |
| `FieldsSection.transitionMutation.onSettled` calls `invalidateGhAllData` (v1.11 Phase 73/75) | Status change from issue detail must refresh the sprint board; the cache invalidation was missing at Phase 73 merge time | ✓ Good — wired in `2ac516c7`; sprint board stays live after issue-detail status change |
| `jira-board-quickfilters` system removed post-Phase 73 verification (v1.11 quick task `e1c098f0`) | GH `allData.json` doesn't return quickfilter data; the Jira-loaded quickfilters were replaced by app's own saved filters | ✓ Good — app's saved filter system is the correct replacement; no functionality lost |

---
*Last updated: 2026-06-03 after completing Phase 77 (Universal Peek Slideover and Issue-Detail Refinements)*
