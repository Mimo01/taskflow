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

### Active

<!-- v1.2 Jira Parity — building toward these -->

- [ ] Full-page issue detail view with rich-text description, editable fields, subtask list, comments, and linked issues
- [ ] Sprint board redesigned: subtasks as kanban cards grouped under story headers, all team members visible, drag-to-move status transitions, inline issue detail
- [ ] Backlog view: unassigned stories/subtasks, move-to-sprint, create new stories, filter by epic/label
- [ ] Epic management: epic list, filter sprint/backlog by epic, epic detail page, create epics
- [ ] Create and edit Jira issues: summary, description, assignee, story points, epic link, issue type, account custom field, issue links

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
- **Shipped v1.1:** 2026-03-13 — 4 phases, 24 plans, ~15,856 lines TypeScript (+ quick tasks)
- **Tech stack:** Tauri 2, React 18, TypeScript, Zustand, TanStack Query, shadcn/ui, Tailwind v4, Vitest
- **Jira instance:** On-premise (Jira Data Center v10.3.15) — no built-in notifications, REST API v2 with Bearer PAT auth
- **GitLab:** Self-hosted or gitlab.com — personal access token
- **Team:** Orange eshop project — developers + project managers using the same app with role-based views
- **Scale:** One Jira project + one GitLab project at a time (switched from group selection in v1.1 quick tasks)
- **Build:** Portable executable — no installer, no admin rights; `createHashRouter` for SPA routing in production
- **Known caveats (v1.1):** Time tracking columns gracefully hidden when admin-disabled on Jira instance; subtask two-query strategy validated against DC v10.3.15

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

## Current Milestone: v1.2 Jira Parity

**Goal:** Replace the need to open Jira — full issue detail, backlog management, epic tracking, and task creation/editing from within the app.

**Target features:**
- Full-page issue detail view (rich text, editable fields, subtasks, comments, linked issues)
- Sprint board redesign (subtask-card layout, all team members, drag-to-move)
- Backlog view (unassigned issues, move-to-sprint, create/filter)
- Epic management (list, filter, detail, create)
- Create/edit tasks (all key fields including account custom field and issue links)

---
*Last updated: 2026-03-13 after v1.2 milestone start*
