# Taskflow

## What This Is

Taskflow is a cross-platform Tauri 2 desktop app for Orange's eshop development team. It unifies Jira (on-premise) and GitLab into a single fast, focused interface — replacing the need to juggle multiple slow tools. It ships as a portable executable (no installer, no admin rights), stores credentials in the OS keychain, and serves both developers and project managers with role-specific dashboards, automatic task-to-MR linking, a unified notifications hub, global search, and a developer dashboard enriched with subtask tracking, MR health, sprint health, and notifications at a glance.

## Core Value

Developers and PMs can see everything they need — tasks, merge requests, sprint state, and notifications — in one place, without switching between Jira and GitLab.

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

- ✓ Time tracking with worklog CRUD (log, edit, delete), duration parsing, sidebar summary with progress bar — v1.5
- ✓ File attachments with upload (button + drag-drop), image thumbnails, lightbox with keyboard navigation — v1.5
- ✓ @mention autocomplete in comment composer with cursor-anchored popover and Jira wiki markup insertion — v1.5
- ✓ Issue activity timeline extended with worklog entries and filter chips — v1.5
- ✓ API services decomposed into focused domain modules (jira.ts → 14 modules) — v1.4
- ✓ Unified Developer Tools with request logging, operation profiling, and granular settings — v1.4
- ✓ All dependencies updated to latest compatible versions — v1.4
- ✓ Virtualized rendering for long lists (backlog, notifications, sprint board) — v1.4
- ✓ Zero `any` types and zero double-casts in production code — v1.4

### Active

## Current Milestone: v1.5 Dashboard Redesign & Feature Parity

**Goal:** Make Taskflow feel like a real power tool — customizable layout, issue activity history, and key Jira/GitLab features that users expect.

**Target features:**
- Customizable sidebar with user-chosen items; Dev/PM roles become presets
- Configurable widget-based dashboard
- Issue activity history timeline (field changes, transitions, comments)
- Time tracking / work log support
- Watchers & starring for issues
- Saved filters across views
- Attachments viewer inline
- Mention autocomplete in comments
- Bulk operations on issues
- Board quick filters

### Out of Scope

- Historical analytics / burndown charts — no daily-use value; complex data pipeline; LinearB/Swarmia exist for this
- OAuth / SSO login — team uses PATs; OAuth adds server-side requirements conflicting with no-server architecture
- Multi-project aggregation — exponentially increases data model complexity; one project sufficient
- Create Jira task from GitLab MR — workflow confusion; task creation always explicit
- Full Jira issue editor (custom fields, attachments) — on-prem Jira has wildly varied custom field configs
- Two-way sync / webhooks — requires server component to receive webhooks
- Email or Slack notifications — external service dependencies
- Inline MR diff / full code review UI — GitLab's UI is mature; deep-link for full review
- GitLab write actions (approve, comment, request changes) — deferred to v2.0
- Create new Jira task from app — deferred to v2.0

## Context

- **Shipped v1.0:** 2026-03-12 — 4 phases, 20 plans, ~11,017 lines TypeScript, 348 files
- **Shipped v1.1:** 2026-03-13 — 4 phases, 24 plans, ~15,856 lines TypeScript (+ 20 quick tasks)
- **Shipped v1.2:** 2026-03-15 — 9 phases, 29 plans, ~23,607 lines TypeScript, 222 files changed (+28,330/−1,730 lines)
- **Shipped v1.3:** 2026-03-19 — 7 phases, 27 plans, ~32,173 lines TypeScript, 159 files changed (+11,471/−2,296 lines), 40+ quick tasks
- **Shipped v1.4:** 2026-03-20 — 6 phases, 21 plans, ~37,520 lines TypeScript, 505 files changed (+29,115/−47,892 lines — net reduction from refactoring)
- **Tech stack:** Tauri 2, React 18, TypeScript, Zustand, TanStack Query, shadcn/ui, Tailwind v4, Vitest, Biome, @dnd-kit/core, @tanstack/react-virtual, jira2md, react-markdown, react-hotkeys-hook, cmdk
- **Jira instance:** On-premise (Jira Data Center v10.3.15) — REST API v2 with Bearer PAT auth; createmeta/workflow/transitions APIs used for issue management
- **GitLab:** Self-hosted or gitlab.com — personal access token
- **Team:** Orange eshop project — developers + project managers using the same app with role-based views
- **Scale:** One Jira project + one GitLab project at a time
- **Build:** Portable executable — no installer, no admin rights; `createHashRouter` for SPA routing in production
- **Test suite:** 665+ tests, zero failures, zero warnings; Vitest with LazyStore mock
- **Known caveats (v1.4):** 10 non-blocking tech debt items (dead code in debug-logs/, DevToolsSettings.tsx unmounted, placeholder components); Cmd+Shift nav shortcut deviation needs product owner sign-off; 13 human verification items deferred to live Jira environment

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

---
*Last updated: 2026-03-22 after Phase 32 (time tracking, attachments, mentions) complete*
