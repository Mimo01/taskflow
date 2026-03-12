---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: MVP
status: archived
stopped_at: Completed quick-1-01-PLAN.md (navigation restructure)
last_updated: "2026-03-12T09:32:00.000Z"
last_activity: 2026-03-12 — quick task 1 complete — 6 flat routes, role-aware sidebar, dashboard overview cards
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 20
  completed_plans: 20
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Planning next milestone — run `/gsd:new-milestone` to start v2.0

## Current Position

Phase: 4 of 4 (PM Dashboard & Search) — COMPLETE
Plan: 5 of 5 in current phase — COMPLETE
Status: Phase 4 Plan 05 done — ADF description fix + GitLab linked key chip clickable
Last activity: 2026-03-12 - Completed quick task 1: Restructure navigation: move Dashboard header nav to sidebar, keep Dashboard as overview page

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~9.4 min
- Total execution time: ~75 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01-foundation | 6 | ~49 min | ~8.2 min |
| Phase 02-developer-dashboard | 2 | ~22 min | ~11 min |

**Recent Trend:**
- Last 8 plans: 14min, 9min, 15min, 7min, 5min, 1min, 9min, 13min
- Trend: Consistent

*Updated after each plan completion*
| Phase 01-foundation P01 | 14 | 2 tasks | 25 files |
| Phase 01-foundation P02 | 9 | 2 tasks | 23 files |
| Phase 01-foundation P03 | 15 | 2 tasks | 16 files |
| Phase 01-foundation P04 | 7 | 2 tasks | 6 files |
| Phase 01-foundation P05 | 5 | 2 tasks | 4 files |
| Phase 01-foundation P06 | 1 | 2 tasks | 2 files |
| Phase 02-developer-dashboard P01 | 9 | 2 tasks | 7 files |
| Phase 02-developer-dashboard P02 | 13 | 3 tasks | 13 files |
| Phase 02-developer-dashboard P03 | 6 | 1 tasks | 7 files |
| Phase 02-developer-dashboard P04 | 5 | 1 tasks | 5 files |
| Phase 03-notifications-hub P01 | 8 | 2 tasks | 13 files |
| Phase 03-notifications-hub P02 | 6 | 2 tasks | 8 files |
| Phase 02-developer-dashboard P05 | 1 | 1 tasks | 3 files |
| Phase 02-developer-dashboard P07 | 2 | 1 tasks | 1 files |
| Phase 02-developer-dashboard P06 | 5 | 2 tasks | 3 files |
| Phase 04-pm-dashboard-search P01 | 5 | 2 tasks | 9 files |
| Phase 04-pm-dashboard-search P02 | 10 | 2 tasks | 8 files |
| Phase 04-pm-dashboard-search P03 | 4 | 2 tasks | 5 files |
| Phase 04-pm-dashboard-search P04 | 4 | 1 tasks | 2 files |
| Phase 04-pm-dashboard-search P05 | 4 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
All v1.0 decisions captured in PROJECT.md after milestone close.
Recent decisions affecting current work:

- Architecture: Tauri 2 portable build (no installer) — eliminates CORS against on-premise Jira; OS keychain for PATs via Tauri Stronghold; required before any feature code
- Auth: PAT-only (no OAuth) — tokens stored in OS keychain, never plaintext; 401 must surface re-auth banner not generic error
- Polling: Single poll coordinator, minimum 60s background / 30s notification-critical, cursor-based incremental fetches — must be established in Phase 2 before notification work
- Jira API: Server REST v2 only (not Cloud) — use `name` not `accountId`, offset pagination, per-issue transitions, Bearer PAT auth — validate with GET /rest/api/2/myself on real instance
- [Phase 01-foundation]: createHashRouter (not createBrowserRouter) for Tauri SPA routing — BrowserRouter breaks production builds
- [Phase 01-foundation]: Stronghold vault password: random 32-byte hex key on first launch stored in Tauri Store — migration path is replacing stronghold.ts with tauri-plugin-keyring in Tauri v3
- [Phase 01-foundation]: Single tauriService abstraction boundary for @tauri-apps/api/core — enables testing without Tauri runtime; only tauri.ts imports from there
- [Phase 01-foundation]: Bearer auth for Jira (not Basic) — Jira Server 8.14+ supports Bearer PAT; Basic fallback deferred to Phase 2
- [Phase 01-foundation]: Plain fetch() works in Tauri renderer — tauri-plugin-http not needed for outbound API calls
- [Phase 01-foundation]: storeSecret called in useMutation onSuccess — after validation confirmed, before goNext()
- [Phase 01-foundation P03]: Settings page uses sections layout (not tabs) — 3 sections don't warrant tab navigation; simpler scrollable layout
- [Phase 01-foundation P03]: Sidebar is vertical — scales better for Phase 2 role-based nav expansion
- [Phase 01-foundation P03]: Token reveal uses local component state only — token evaporates on unmount, never touches Zustand
- [Phase 01-foundation P03]: AppLayout uses onboardingComplete from settings store as proxy for post-onboarding layout
- [Phase 01-foundation P04]: stronghold readSecret throws Error('Secret not found: key') on null — explicit over silent crash
- [Phase 01-foundation P04]: Project list fetched on Settings mount via useEffect(jiraBaseUrl) — Select pre-populated when user opens Settings
- [Phase 01-foundation P04]: queryClient.clear() called synchronously in handleProjectChange alongside setActiveJiraProject
- [Phase 01-foundation]: tauri-plugin-http fetch required in renderer — plain fetch() causes CORS errors in Tauri 2 webview; prior STATE.md note was incorrect
- [Phase 01-foundation]: Tauri capabilities scope must include https://** and http://** for on-premise Jira/GitLab instances
- [Phase 01-foundation P06]: vi.mock('@tauri-apps/plugin-http') at module scope required to intercept named ES module import binding — vi.stubGlobal only patches globalThis.fetch which production services no longer use
- [Phase 01-foundation P06]: vi.mocked(mockFetch).mockReset() in beforeEach instead of vi.restoreAllMocks() — restoreAllMocks only resets spies, not module mocks
- [Phase 02-developer-dashboard]: Plain fetch() enforced by linter (not @tauri-apps/plugin-http) — vi.stubGlobal pattern for tests
- [Phase 02-developer-dashboard]: Negative lookbehind in ticket key regex: (?<![A-Za-z0-9-]) prevents PREFIX-FEAT-1 from matching FEAT-1
- [Phase 02-developer-dashboard P02]: DashTab type extended to include mr-attention — Plan 01 store was missing the third tab value required by the UI spec
- [Phase 02-developer-dashboard P02]: @tauri-apps/plugin-opener (openUrl) used for external links — plugin-shell not installed; openUrl is the correct API
- [Phase 02-developer-dashboard]: MrAttentionTab fetches sprint issues directly via useQuery (not only from cache) to ensure data is available regardless of tab visit order
- [Phase 02-developer-dashboard]: SprintBoardTab reads health from queryClient cache only — health queries owned by MyTasksTab/MrAttentionTab to avoid double-fetching
- [Phase 02-developer-dashboard]: TaskRow prop renamed from linkedMrs to linkedMrResults: Array<{mr, health}> — breaking change contained within dashboard package (Plan 02 stub passed [])
- [Phase 02-developer-dashboard P04]: PopoverTrigger renders text directly (not asChild) — base-ui asChild wraps in outer button creating nested buttons, breaking accessibility and tests
- [Phase 02-developer-dashboard P04]: Per-row inline errors keyed by issueKey-transition and issueKey-comment in MyTasksTab state map — scoped errors without prop drilling complex error objects
- [Phase 03-notifications-hub]: readIds stored as string[] not Set in notifications store — Zustand JSON persist serializes Set as empty object, losing read state on restart
- [Phase 03-notifications-hub]: LazyStore vi.mock requires class constructor syntax — vi.fn().mockImplementation is not a constructor and throws when used with new
- [Phase 03-notifications-hub]: useNotificationPolling extracted from TopBar — TopBar tests render without QueryClientProvider; polling runs in AppLayout via custom hook where QueryClient is always available
- [Phase 03-notifications-hub]: NotificationPopover is pure UI (no useQuery) — clean separation enables independent testability without query providers
- [Phase 02-developer-dashboard]: Tailwind v4 requires no postcss.config.js or tailwind.config.js — @tailwindcss/vite in vite.config.ts is the sole CSS pipeline entry point
- [Phase 02-developer-dashboard]: Selector visibility gated on baseUrl presence (not list length) in TokenSection — ensures selector always reachable when integration is configured
- [Phase 02-developer-dashboard]: TaskRow manages commentOpen locally; MyTasksTab owns mutations and error strings — clean separation of UI state vs server state
- [Phase 02-developer-dashboard]: Comment pane closes optimistically on submit in TaskRow onSubmit callback — openCommentKey in MyTasksTab removed as redundant
- [Phase 04-pm-dashboard-search P01]: statusCategory on JiraIssue.fields.status is optional (?) — Jira Server on-prem may omit it; callers use ?.key with fallback
- [Phase 04-pm-dashboard-search P01]: Date-only strings forced to UTC midnight (T00:00:00Z suffix) to prevent UTC+14 timezone drift in date matching
- [Phase 04-pm-dashboard-search P01]: searchJira and searchGitLabMRs return empty array on non-200 to not block parallel search
- [Phase 04-pm-dashboard-search P01]: Wave 0 scaffolds use vi.mock + it.todo to document component contracts before implementation
- [Phase 04-pm-dashboard-search]: SprintProgressTab + WorkloadTab share ['jira-issues', 'sprint-board', projectKey] cache key — zero duplicate fetches
- [Phase 04-pm-dashboard-search]: findByText in tests must target computed values not bucket labels — disabled-query initial render shows labels with 0 counts before token resolves
- [Phase 04-pm-dashboard-search]: vi.clearAllMocks() clears mockResolvedValue implementations; async beforeEach with dynamic re-import required to restore mocks
- [Phase 04-pm-dashboard-search]: data-testid attributes on overlay backdrop and loading skeleton for testability — aria roles insufficient for backdrop click detection in tests
- [Phase 04-pm-dashboard-search]: SearchOverlay useQuery enabled guard checks tokens AND baseUrls AND projectKey — prevents queries with partial auth state
- [Phase 04-pm-dashboard-search]: fetchFixVersions returns (data.values ?? []) — GET /rest/api/2/version returns paginated envelope not a bare array; defensive fallback for malformed/empty responses
- [Phase 04-pm-dashboard-search P05]: adfToPlainText handles null/string/ADF-object defensively — Jira Server returns strings, Jira Cloud returns ADF; cast to unknown at call site avoids changing jira.ts canonical type
- [Phase 04-pm-dashboard-search P05]: GitLab linked key chip changed from span to button with aria-label — enables role-based test queries and provides keyboard/click accessibility

### Pending Todos

None.

### Blockers/Concerns

- Phase 2: Must validate Jira Server auth header format (Bearer vs Basic) against actual on-premise instance before writing polling interceptor
- Phase 2: GitLab self-hosted rate limit may differ from GitLab.com 2000 req/min — validate before setting polling intervals
- Phase 2: Gather 20+ real MR titles from team GitLab history before writing ticket-key regex (silent linking failures destroy trust)

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 1 | Restructure navigation: move Dashboard header nav to sidebar, keep Dashboard as overview page | 2026-03-12 | 82f7778 | Needs Review | [1-restructure-navigation-move-dashboard-he](./quick/1-restructure-navigation-move-dashboard-he/) |
| 2 | Fix nav layout: add p-4 page margins to 6 tabs, live Dashboard cards, Sidebar Work section | 2026-03-12 | 6163cac | Complete | [2-fix-nav-layout-add-page-margins-live-das](./quick/2-fix-nav-layout-add-page-margins-live-das/) |

## Session Continuity

Last session: 2026-03-12T09:45:00.000Z
Stopped at: Completed quick-2-01-PLAN.md (margins + live dashboard + sidebar Work section)
Resume file: None
