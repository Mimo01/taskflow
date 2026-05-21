# Taskflow

## What This Is

Taskflow is a cross-platform Tauri 2 desktop app for Orange's eshop development team. It unifies Jira (on-premise), Jira Tempo Timesheets, GitLab, and AIO Test Management into a single fast, focused interface — replacing the need to juggle multiple slow tools. It ships as a portable executable (no installer, no admin rights), stores credentials in the OS keychain, and serves both developers and project managers with a minimal static dashboard, sprint board, backlog, global search, notifications, AIO test execution visibility, and Tempo worklog tracking.

## Current Milestone: v1.9 Tempo, Dashboard Redesign & Cleanup

**Goal:** Add Tempo Timesheets worklog viewer, replace the complex widget dashboard with a minimal static dashboard, remove the Workload view, and harden the codebase with a full cleanup pass.

**Target features:**
- Tempo worklog viewer: configurable day-column table, epic/story/subtask row hierarchy, saved filters (people + date presets)
- Remove Workload page and all its references/widgets
- Remove entire customizable widget dashboard system
- New minimal static dashboard: sprint health bar + my in-progress subtasks + next release countdown
- Full test suite passing (zero regressions)
- Thorough code cleanup: dead code, unused components, type safety, consistency

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

### Active

<!-- v1.9 in progress -->

- [ ] Tempo worklog viewer with configurable day columns, epic/story/subtask row hierarchy, and saved filters
- [ ] Remove Workload page and all related dashboard widgets
- [ ] Remove widget-based customizable dashboard system (react-grid-layout, 11 widget types)
- [ ] New minimal static dashboard: sprint health + my in-progress subtasks + next release countdown
- [ ] All tests passing, zero regressions
- [ ] Thorough code cleanup pass (dead code, unused imports, type safety, consistency)

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

## Current State

**Executing v1.9 Tempo, Dashboard Redesign & Cleanup** — started 2026-05-20. Phase 60 complete: static dashboard with personalized greeting, sprint health card, in-progress subtasks card, and release countdown card — all backed by existing query cache, no widget system. Next: Phase 61 Tempo Probe + Service Layer.

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
- **Tech stack:** Tauri 2, React 18, TypeScript, Zustand, TanStack Query, shadcn/ui, Tailwind v4, Vitest, Biome, @dnd-kit/core, @dnd-kit/sortable, @tanstack/react-virtual, react-grid-layout, jira2md, react-markdown, react-hotkeys-hook, cmdk, babel-plugin-react-compiler
- **Jira instance:** On-premise (Jira Data Center v10.3.15) — REST API v2 with Bearer PAT auth; createmeta/workflow/transitions APIs used for issue management
- **GitLab:** Self-hosted or gitlab.com — personal access token
- **Team:** Orange eshop project — developers + project managers using the same app with role-based views
- **Scale:** One Jira project + one GitLab project at a time
- **Build:** Portable executable — no installer, no admin rights; `createHashRouter` for SPA routing in production
- **Test suite:** 983+ tests, zero failures, zero warnings; Vitest with LazyStore mock
- **Codebase:** ~68,000+ lines TypeScript
- **Known caveats (v1.8):** 3 phases (53, 57, 58) missing VERIFICATION.md — all UAT-verified, retroactive production deferred; hardcoded AIO_STATUS_MAP (non-standard instances may mis-bucket); TESTCASE_STATUS_MAP missing IDs 51/52 (in-progress runs show as NOT_EXECUTED); Bulk operations (BOARD-04–07) components on disk, not wired; Cmd+Shift nav shortcut deviation needs product owner sign-off; Apple/Windows code signing deferred to future release

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

---
*Last updated: 2026-05-21 — Phase 60 complete (static dashboard / welcome screen)*
