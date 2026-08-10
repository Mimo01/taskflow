# Taskflow

## What This Is

Taskflow is a cross-platform Tauri 2 desktop app for Orange's eshop development team. It unifies Jira (on-premise), Jira Tempo Timesheets, GitLab, and AIO Test Management into a single fast, focused interface — replacing the need to juggle multiple slow tools. It ships as a portable executable (no installer, no admin rights), stores credentials in the OS keychain, and serves both developers and project managers with a graph-driven personal dashboard, a dedicated My Tasks command center, sprint board, backlog, global search, notifications, AIO test execution visibility, and Tempo worklog tracking.

## Current Milestone: v1.14 Release Management

**Goal:** Turn the Releases view from a read-only Jira↔GitLab match into a working release-coordination surface that detects git-flow drift and lets the user fix it per-MR.

**Target features:**
- **Release branch awareness** — resolve `release/<milestone name>` (milestone is the tag source, `release/` prefix hardcoded), detect whether it exists, warn at release level when it doesn't, and offer to create it off the GitLab project default branch behind a confirm dialog
- **Three-channel MR discovery + drift flagging** — union MRs found via (A) Jira-key linkage to fix-version issues, (B) carrying the GitLab milestone, (C) targeting the release branch; the disagreements between channels are the signal (wrong target branch, missing milestone, task not in fix version)
- **Per-MR corrective actions** — retarget to the release branch and assign the release milestone, applied directly with optimistic update + rollback, per-row inline status and retry (v1.12 bulk-subtask row pattern, no "fix all")
- **Milestone creation** — create a missing GitLab milestone from the release view (format `1.1.0` / `2.0.0`), latest milestones listed for reference, user types the final name, behind a confirm dialog
- **Post-release merge-back check** — once the Jira fix version is marked released, verify `release/[tag]` has been merged into the default branch; surface the release as unfinished until it lands

**Key context:** Builds on `releaseLinker.ts` (date-only matching), `fetchMilestoneMRs`, and `updateMilestone` — the only pre-existing GitLab write. New GitLab API surface: create branch, create milestone, update MR target branch, assign MR milestone, branch merge-status check. The `develop` branch is the GitLab project default branch — read it from the API, no configuration.

## Latest Shipped Milestone: v1.13 Personal Workspace (shipped 2026-06-16)

**Goal:** Give each person a focused home in Taskflow — a real "My Tasks" command center, the app's first charting capability, and a redesigned graph-driven Dashboard that surfaces what matters at a glance. **17/18 committed requirements delivered (DASH-06 descoped, INSIGHT-01/02 retired by design); milestone audit `tech_debt` with 0 blockers.**

**Delivered features:**
- **Charting foundation** — the app's first charting dependency: Recharts v3 wired through the shadcn `chart` primitive, theme-token aware (`--chart-1..5`), Tauri WebKit/WebView2-safe (explicit-height + responsive wrapper, animations off), lazy-loaded chart card.
- **My Tasks page** — a dedicated `/my-tasks` sidebar route: My Day smart sort (flagged/blocked → overdue → in-review-with-my-MR → in-progress → to-do), a count/filter strip, rich rows (type, key, priority, status pill, due date, SP, MR health, time logged), inline actions (peek, open, transition, log work), and a sprint↔all-assigned scope toggle with proper server-side pagination. A v27 store migration injects the sidebar entry for existing installs.
- **Dashboard redesign** — a clean-slate rewrite to the 3 approved screenshot regions: gradient hero with a `· Sprint day X of N` subline, a top row of MY ISSUES (segmented sprint-progress + counts) + UPCOMING RELEASES (up-to-3-dot readiness), and a full-width PAST 7 DAYS dual-axis hours/commits chart — all from existing data sources, with every prior widget deleted and zero dead code.

**Descoped/retired during the milestone:** DASH-06 MR review queue (rejected at Phase 84 UAT); INSIGHT-01/02 velocity + burndown insights (built & verified in Phase 85, then deleted by the Phase 86 clean-slate redesign); the three-way grouping toggle and right-click context menu on My Tasks (Phase 82 UAT — always My Day grouping, inline actions retained).

**Previous milestone shipped:** v1.12 Jira Experience Improvements — 5 phases (76-80), 19 plans, 441 commits, shipped 2026-06-07 (app-wide done-state visuals, universal issue peek, drag-to-rank + drag-to-transition, subtask templates + bulk creation).

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

- ✓ Done-state strikethrough for done current-sprint stories on Backlog sprint list, Dashboard sprint card, and Standup Today — v1.12 Phase 76
- ✓ Sprint-board card left-edge stripe encodes issue TYPE (Bug/Story/Subtask/Epic), WCAG-tuned both themes; priority shown via PriorityIcon footer image — v1.12 Phase 76
- ✓ Universal non-blocking issue slideover (peek) for any issue type, with issue-key → full page and explicit open-full-page affordance — v1.12 Phase 77
- ✓ Issue-detail: subtask parent moved to main content; cursor-pointer on clickable areas — v1.12 Phase 77
- ✓ Drag-to-rank stories within Backlog sections (intra-section reorder → Jira rank PUT, optimistic with rollback + flicker gate; cross-section drag descoped — sprint moves stay on the right-click menu) — v1.12 Phase 78
- ✓ Drag-to-transition on the sprint board; multi-status columns split into per-transition drop boxes during the drag — v1.12 Phase 79
- ✓ Subtask templates & bulk creation (Settings-managed, createmeta-driven rich fields, create-all-at-once from parent with per-row progress + retry) — v1.12 Phase 80

- ✓ Charting foundation: Recharts v3 + shadcn `chart` primitive, theme-token aware, Tauri WebKit/WebView2-safe (explicit-height + responsive wrapper, animations off), lazy-loaded — v1.13 Phase 81
- ✓ My Tasks page: dedicated `/my-tasks` route with My Day smart sort, count/filter strip, rich rows, inline actions (peek/open/transition/log work), and sprint↔all-assigned scope toggle (server-side pagination) — v1.13 Phase 82
- ✓ My Tasks sidebar entry injected for existing installs via v27 settings-store migration (`appendMyTasksItemIfMissing`) — v1.13 Phase 82
- ✓ Dashboard redesign: 3-region screenshot layout (hero + sprint-day subline, MyIssuesCard + UpcomingReleasesTimeline top row, full-width dual-axis PAST 7 DAYS hours/commits chart) — all from warm caches, every prior widget removed, zero dead code — v1.13 Phases 83-86
- ✓ Dashboard sections degrade independently with own loading/empty/error state and warm-cache reuse — v1.13 Phases 83-84

### Active

<!-- Milestone v1.14 Release Management started 2026-08-10. -->

- [ ] Release branch resolved as `release/<milestone name>`; existence detected and surfaced as a release-level warning when missing
- [ ] Create the missing release branch off the GitLab project default branch, behind a confirm dialog
- [ ] Three-channel MR discovery for a release (Jira-key linkage, milestone-carrying, release-branch-targeting) unioned into one MR set
- [ ] Drift flagging: wrong target branch, missing milestone, and MRs whose Jira task isn't in the fix version
- [ ] Per-MR corrective actions (retarget to release branch, assign release milestone) with per-row status and retry
- [ ] Create a missing GitLab milestone from the release view (format `1.1.0`), latest milestones listed for reference, user types the name
- [ ] Post-release merge-back check: once the Jira fix version is released, verify `release/[tag]` merged into the default branch

### Out of Scope

- Historical analytics / velocity & burndown charts — attempted as probe-gated insights in v1.13 Phase 85 (built and verified), then retired in the Phase 86 dashboard redesign as not earning their daily-use place; LinearB/Swarmia exist for this
- Customizable widget/grid dashboard — removed in v1.9 (react-grid-layout, 11 widget types); v1.13 ships a curated static redesign, not a return to widgets (revisit only if static proves insufficient — DASH-F1)
- OAuth / SSO login — team uses PATs; OAuth adds server-side requirements conflicting with no-server architecture
- Multi-project aggregation — exponentially increases data model complexity; one project sufficient
- Create Jira task from GitLab MR — workflow confusion; task creation always explicit
- Two-way sync / webhooks — requires server component to receive webhooks
- Email or Slack notifications — external service dependencies
- Inline MR diff / full code review UI — GitLab's UI is mature; deep-link for full review
- Bulk operations on sprint board issues — components built but user-deferred during v1.5 review; files on disk, not wired
- GitLab *review* write actions (approve, comment, request changes) — deferred to v2.0. Narrowed at v1.14: release-management writes (create branch, create milestone, retarget MR, assign milestone) are explicitly in scope; the exclusion now covers only code-review actions, where GitLab's own UI is mature
- Full JQL editor with syntax highlighting — months of work; plain text JQL input sufficient
- Pinned-issues section on Standup Notes Today (STAND-08) — descoped by user during v1.10 Phase 70; pinning surface stays on the issue itself
- Planned-worklog-targets / Log Work action on Standup Notes Today (STAND-09) — built in Phase 70 then removed in the standup redesign (commit c5b19544); Log Work stays on the Worklogs page and issue detail

## Current State

**v1.10 shipped 2026-05-25** — 6 phases (65-70), 15 plans, 17 quick tasks, 271 commits, 432 files changed (+30,286/−1,489 lines) over 3 days. Codebase: ~80,895 lines TypeScript / 136 test files.

v1.8/v1.9 tech debt paid down (WorklogsPage timer/error/fragment fixes, `DatePreset` relocation, AIO status map from live `/config`). The Developer/PM role concept was removed app-wide — universal access, no presets, no gating, settings store at v22 then v23. Settings → Sidebar reduced to visibility-only toggles (all four `@dnd-kit/*` packages uninstalled). The onboarding wizard gained an Integrations step (shared `AioBlock` + Tempo toggle writing to the settings store). The Standup Notes page (`/standup-notes`) shipped with a last-working-day Yesterday recap (Tempo worklogs, Jira changelog, Git commits, MR activity) and a Today section (open sprint subtasks grouped by story with nested participating MRs). Pinned-issues (STAND-08) and Log Work targets (STAND-09) on the standup page were descoped during the Phase 70 redesign.

**Milestone closed with tech debt:** Phase 69 has no `VERIFICATION.md` (compensated by 12/12 UAT + nyquist-green VALIDATION); Phases 68/70 verification at `human_needed`; minor code-review items WR-05 (unguarded SP cast) and IN-01 (uncleared setTimeout). See `.planning/milestones/v1.10-MILESTONE-AUDIT.md`. v2.0 scope TBD.

**v1.11 shipped 2026-06-01** — 5 phases (71-75), 22 plans, 284 commits, 308 files changed (+48,340/−16,981 lines) over 4 days. Eliminated Jira API n+1 bottlenecks: sprint board and backlog now each load via a single GreenHopper API call; workflow transitions cached per-project; issue detail panel renders progressively with TTFMP 1180ms. 17/17 requirements satisfied. 10 non-blocking tech-debt items acknowledged. Milestone closed `tech_debt` — run `release.sh` to cut the v1.11.x release.

**v1.12 shipped 2026-06-07** — 5 phases (76-80), 19 plans, 441 commits, 434 files changed (+46,310/−3,051 lines) over 6 days. Made day-to-day Jira work faster and more direct: app-wide done-state visuals + issue-type card stripes via shared `issueDisplayUtils`, a universal non-blocking issue peek slideover, drag-to-rank on the Backlog and drag-to-transition on the Sprint Board (both on `@dnd-kit`), and Settings-managed subtask templates with bulk creation. Plus a ~30-task quick-task polish layer (peek refinements, priority/issue-type icons, Standup Notes overhaul). 32/32 requirements satisfied; milestone audit passed. 7 non-blocking deferred items (Windows/live-DC UAT, accepted drag tech debt). Run `release.sh` to cut the v1.12.x release.

**v1.13 shipped 2026-06-16** — 6 phases (81-86), 23 plans, 411 commits, 370 files changed (+41,255/−21,884 lines) over 9 days. Gave Taskflow its first charting capability (Recharts v3 via the shadcn `chart` primitive, Tauri-webview-safe), a dedicated My Tasks command center (`/my-tasks`, My Day smart sort, scope toggle with server-side pagination), and a graph-driven Dashboard redesign to a curated 3-region screenshot layout (hero + sprint-day subline, MyIssuesCard + UpcomingReleasesTimeline, full-width dual-axis hours/commits chart) — every prior dashboard widget deleted, zero dead code, `npm run check` GREEN. A v27 settings-store migration injects the My Tasks sidebar entry for existing installs. 17/18 committed requirements satisfied (DASH-06 MR review queue descoped at UAT; INSIGHT-01/02 velocity+burndown built in Phase 85 then retired by the Phase 86 redesign). Milestone audit `tech_debt` with 0 blockers; 81 cross-project historical-noise items acknowledged as deferred (see STATE.md). Run `release.sh` to cut the v1.13.x release.

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
- **Shipped v1.12:** 2026-06-07 — 5 phases (76-80), 19 plans, 441 commits, 434 files changed (+46,310/−3,051 lines)
- **Shipped v1.13:** 2026-06-16 — 6 phases (81-86), 23 plans, 411 commits, 370 files changed (+41,255/−21,884 lines)
- **Tech stack:** Tauri 2, React 18, TypeScript, Zustand, TanStack Query, shadcn/ui, Tailwind v4, Vitest, Biome, recharts@^3.8 + react-is (charting, added v1.13 via shadcn `chart` primitive), @dnd-kit/core + /sortable + /modifiers + /utilities (reinstalled v1.12 for drag-to-rank/transition), @tanstack/react-virtual, jira2md, react-markdown, react-hotkeys-hook, cmdk, babel-plugin-react-compiler (react-grid-layout removed v1.9)
- **Jira instance:** On-premise (Jira Data Center v10.3.15) — REST API v2 with Bearer PAT auth; createmeta/workflow/transitions APIs used for issue management
- **GitLab:** Self-hosted or gitlab.com — personal access token
- **Team:** Orange eshop project — developers + project managers using the same app with role-based views
- **Scale:** One Jira project + one GitLab project at a time
- **Build:** Portable executable — no installer, no admin rights; `createHashRouter` for SPA routing in production
- **Test suite:** ~1358 tests passing, zero failures, zero warnings; Vitest with LazyStore mock
- **Codebase:** ~80,895 lines TypeScript / 136 test files
- **Settings store:** persist version 27 (v25 added `rankFieldKey` for backlog drag-rank; v26 added `peekPanelWidth` for the peek slideover; v27 added `appendMyTasksItemIfMissing` to inject the My Tasks sidebar entry for existing installs)
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
| Peek as a CSS-squeeze panel, not a Dialog/Sheet (v1.12 Phase 77) | A modal Dialog traps focus + adds a backdrop that swallows clicks; PEEK-03 requires the underlying view stay interactive. A flex-row squeeze layout (no `position:fixed`, no `aria-hidden` on root) keeps the board/backlog live | ✓ Good — non-blocking peek with issue-swap; one shared `IssueDetailView` powers both peek and full page |
| Universal key-vs-body click split (v1.12 Phase 77, D-10) | Body click → peek, issue-key click → full page must hold on every list surface without nested-button HTML | ✓ Good — `div[role=button]` body + inner key `<button>` with `stopPropagation`; applied across 6 surfaces |
| `@dnd-kit` (Pointer Events) re-adopted for drag features (v1.12 Phase 78/79) | `pragmatic-drag-and-drop` uses HTML5 DnD which needs `dragDropEnabled=false`, breaking attachment drag-drop upload; `@dnd-kit` Pointer Events coexist | ✓ Good — one install powers backlog rank + board transition; was uninstalled in v1.10, reinstalled here |
| Drag flicker gate: `cancelQueries` + drag-gated local order as rendered source of truth (v1.12 Phase 78) | Background poll refetch mid-drag snaps the optimistic order back; risk is `refetchOnWindowFocus` after staleTime, not the 60s interval | ✓ Good — RANK-05 holds; no snap-back |
| `rankCustomFieldId` read from cached GreenHopper response, never hardcoded (v1.12 Phase 78) | The rank field id varies per Jira instance; hardcoding breaks portability | ✓ Good — unit-tested against fixture; `PUT /rest/agile/1.0/issue/rank` with integer id |
| dnd-kit `autoScroll` disabled on the backlog (v1.12 Phase 78, tech debt) | Upstream issue #1108 rect-desync against the autoscrolling virtualized container caused drop misplacement | ⚠️ Revisit — no auto-scroll while dragging; revisit when #1108 resolves |
| D-07 reversed: screen/validator transitions NOT pre-filtered from drop targets (v1.12 Phase 79) | The app has no transition-screen flow anywhere; rollback-on-rejection already covers "no silent snap-back" | ✓ Good — user-accepted during UAT; recorded in 79-CONTEXT.md |
| Bulk subtask creation loops `createIssue` sequentially, not `Promise.all` (v1.12 Phase 80) | Jira DC has no batch-create endpoint; sequential preserves listed order and makes per-row status trackable | ✓ Good — per-row progress + retry-failed-only (no duplicates) on partial failure |
| Subtask templates persist via `createTauriStorage('subtask-templates.json')` (v1.12 Phase 80) | Same Zustand + Tauri Store pattern as `tempo-filters.store.ts`; no new persistence concept | ✓ Good — consistent store pattern; survives restarts |
| Recharts v3 via shadcn `chart` primitive, `responsive` prop over `ResponsiveContainer` (v1.13 Phase 81) | All four researchers converged on Recharts; `ResponsiveContainer` conflicts with React Compiler (#4590/#5173); the `responsive` prop avoids it | ✓ Good — charts render across both Tauri webviews |
| Chart wrapper uses `'use no memo'` + explicit-height outer div (v1.13 Phase 81) | WebKit collapses charts to 0×0 without an explicit-height ancestor — same failure class as the virtualized-table-zero-width-col fix | ✓ Good — no 0×0 collapse; animations disabled for webview stability |
| My Tasks "all assigned" scope uses `fetchAllSearchPages`, two named functions (v1.13 Phase 82) | Server-side pagination avoids the fetch-once page-cap pitfall; named functions remove the client-side-filter temptation | ✓ Good — full result set; no silent truncation |
| `appendMyTasksItemIfMissing` v27 store migration (v1.13 Phase 82) | Existing installs persist their sidebar list; a new nav item is invisible without an explicit migration injecting it — same pattern as worklogs (v21) / standup (v23) | ✓ Good — closed audit blocker MYTASK-01; sidebar entry appears for all users |
| Phase 86 D-01 clean slate — delete the entire Phase 83-85 widget surface (v1.13 Phase 86) | The screenshot redesign superseded the incremental stat-tile/insights work; keeping dead widgets would violate the zero-dead-code goal | ✓ Good — 12 widget files + 4 orphaned helpers removed; velocity/burndown insights retired with them |
| Dashboard charts source from existing data only — no new API surface (v1.13 Phase 86) | Reuse warm caches (sprint data, Tempo worklogs, releases, commits); a redesign shouldn't add fetch cost | ✓ Good — dual-axis chart + cards built entirely on existing queries |

---
*Last updated: 2026-08-10 — after starting v1.14 Release Management milestone*
