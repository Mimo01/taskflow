# Project Research Summary

**Project:** Taskflow
**Domain:** Cross-platform developer/PM dashboard — on-premise Jira REST API v2 + GitLab integration
**Researched:** 2026-03-10
**Confidence:** MEDIUM (stack/architecture HIGH, features MEDIUM, Tauri plugin versions MEDIUM)

## Executive Summary

Taskflow is a client-only API-aggregation desktop dashboard that unifies a team's Jira (on-premise, legacy Server/Data Center) and GitLab workflows into a single interface. The target audience is a small team of developers and PMs who are blocked by the absence of cross-tool notifications, the inability to see task-to-MR relationships at a glance, and the friction of context-switching between two browser tabs. The recommended approach is Tauri 2 + React 18 + TypeScript + TanStack Query — a lightweight desktop shell (no bundled Chromium) with a React frontend, where TanStack Query's polling and cache-invalidation mechanism drives all data fetching, including the notification loop. There is no backend; all API calls flow directly from the client to Jira and GitLab using Personal Access Tokens stored in the OS keychain.

The architecture is explicitly client-only and must stay that way. A backend would add operational overhead with no benefit at this scale. The core technical challenge is building a reliable polling layer that handles on-premise Jira's quirks (no rate limits but limited capacity, Server API differences from Cloud, per-issue workflow transition IDs) alongside GitLab's rate-limiting (2000 req/min on .com, lower on self-hosted) without hammering either server. The notification hub — the primary pain point being solved — requires cursor-based incremental polling, deduplication by stable event IDs, and a fallback in-app badge that works even when OS notifications are blocked.

The top risks in order of severity are: (1) referencing Jira Cloud API docs instead of the Server REST v2 spec — this will cause silent auth failures and wrong field shapes from the start; (2) storing PATs in plaintext — must use the OS keychain via Tauri Stronghold from day one; (3) overaggressive polling — the single poll coordinator with 60-second minimum intervals and exponential backoff must be established as an architectural constraint before feature work begins, not retrofitted later. If these three are handled correctly in the first two phases, the rest of the build follows established patterns with moderate complexity.

---

## Key Findings

### Recommended Stack

The stack centers on Tauri 2 as the desktop shell (macOS, Windows, Linux), React 18 + TypeScript for the UI, and TanStack Query v5 as the single most important library — it manages all polling, caching, background refetch, and cache invalidation without any custom interval management. Zustand handles the small set of non-server UI state (theme, active role, selected project). shadcn/ui + Tailwind CSS provides accessible, fully-owned component primitives. Axios handles HTTP with interceptor-based PAT injection. Tauri Stronghold encrypts PATs at rest using the OS keychain.

The abstraction layer between the UI and Tauri APIs is architecturally required: the same React codebase must run in both a Tauri desktop shell and a plain Vite dev server (for development and testing). Components must never call Tauri APIs directly.

**Core technologies:**
- **Tauri 2 (^2.1):** Desktop shell — ~10 MB installers vs ~150 MB for Electron; OS keychain access; no bundled Chromium
- **React 18 (^18.3) + TypeScript (^5.4):** UI framework + type safety; Jira and GitLab API response shapes are complex and partially documented — TypeScript interfaces prevent entire categories of runtime bugs
- **TanStack Query v5:** All API data fetching, polling, and cache management — `refetchInterval` drives the notification loop without manual `setInterval`
- **Zustand (^4.5):** Theme, active role, PAT session config — kept strictly separate from server-derived data (which lives only in TanStack Query cache)
- **Axios (^1.6):** HTTP client with interceptors for PAT injection and consistent error shapes
- **shadcn/ui + Tailwind CSS (^3.4):** Copy-paste component primitives, fully owned and customizable; dark/light mode via one `dark:` class on `html`
- **Tauri Stronghold (^2.x):** OS keychain-backed encrypted PAT storage — the only acceptable storage mechanism
- **Tauri Notification plugin (^2.x):** OS-native desktop notifications triggered by the polling loop
- **Vitest + MSW (^2.x):** Testing without Tauri — mock Jira + GitLab API responses in fast unit tests
- **React Router v6 (^6.22) with `createHashRouter`:** Avoid file-path issues with Tauri webview asset serving

**Critical version note:** Tailwind CSS v4 (released early 2025) is a breaking change from v3. Pin to ^3.4 for v1 and verify shadcn/ui compatibility before upgrading.

### Expected Features

All features resolve into two groups: things that make the app worth opening daily (table stakes), and things that justify it over just having two browser tabs (differentiators). Everything else is explicitly deferred or excluded.

**Must have (table stakes) — v1 scope:**
- PAT authentication + OS keychain credential storage — gates everything
- My open tasks list (filtered to current user + current sprint)
- Sprint board view (column-per-status; drag-and-drop deferred)
- MR list filtered to "needs my attention" (assigned + reviewer with unresolved threads)
- Task-to-MR linking display (bidirectional: linked MRs on task card, linked task on MR row)
- Unified notification feed (Jira comment mentions + GitLab MR thread activity, chronological)
- Task status update via workflow transitions (fetch transitions per-issue — not hardcoded)
- Add comment on Jira task and on GitLab MR thread
- MR approve / request-changes action
- PM sprint progress overview + team workload view
- Desktop OS notifications + in-app badge (unread count)
- Dark / light mode
- Role-based routing: Developer dashboard vs PM dashboard

**Should have (differentiators) — high value, some v1, some post-v1:**
- Automatic task-to-MR linking from MR title, branch name, and description — no admin plugin required (v1)
- MR review health indicator on sprint board cards (derived from linking — v1 if linking is solid)
- Notification read/unread tracking per item (v1)
- Stale MR detection — flag by `updated_at` age (v1, low effort)
- "Ready to merge" checklist on MR card (approvals, CI, thread resolution) (v1)
- Notification digest with smart grouping by parent entity (post-v1)
- Keyboard shortcuts for power users (post-v1)
- Release readiness score — requires releases view to be stable (post-v1)

**Defer (v2+):**
- Releases / fix-version view — high correlation complexity between Jira fix versions and GitLab milestones/tags
- Global search — Jira JQL + GitLab search API; URL deep-link to Jira/GitLab is acceptable fallback for v1
- Create Jira task — lower-frequency action; Jira UI fallback acceptable for v1
- Inline MR diff preview — enormous effort for marginal gain; deep-link to GitLab instead

**Explicit anti-features (never build):**
- Historical velocity / burndown / DORA metrics — LinearB/Swarmia exist; out of scope
- OAuth / SSO — unnecessary complexity; PATs match team practice
- Multi-project aggregation — exponentially increases data model complexity
- Webhooks / two-way sync — requires a server; conflicts with client-only architecture
- Full Jira issue editor (all custom fields, attachments) — on-premise custom field schemas vary wildly

### Architecture Approach

Taskflow is a client-only, API-aggregation dashboard with four layers: UI Layer (React components, role-based views), State Layer (TanStack Query cache + Zustand for UI state), API Client Layer (typed Jira and GitLab repository modules), and Persistence Layer (Tauri Stronghold for PATs, Tauri Store for preferences and last-seen cursors). A Linking Engine sits in the State Layer and joins Jira issues to GitLab MRs via regex parsing of ticket IDs from MR titles, branch names, and descriptions. A Notification Engine diffs polling results against last-seen cursors, deduplicates by stable event ID, and dispatches OS notifications and in-app badge updates.

All Jira and GitLab fetches are independent and parallel — Jira latency must never block the GitLab MR panel from rendering. Write actions use optimistic UI updates (update state immediately, revert on API error) to compensate for slow on-premise Jira response times.

**Major components:**
1. **API Client Layer (Jira + GitLab repositories)** — typed wrappers around REST APIs; only these modules import axios; PATs injected once at initialization and never re-exposed to UI layer
2. **State Layer (TanStack Query + Zustand)** — query cache is the source of truth for all server data; Zustand holds only user preferences and session config; polling is managed here via `refetchInterval`, not per-component
3. **Linking Engine** — regex extracts ticket IDs (`/\b([A-Z][A-Z0-9]+-\d+)\b/gi`, case-insensitive, word-boundary) from MR title → branch name → description in order of cheapness; joins issues to MRs in the cache
4. **Notification Engine** — cursor-based delta polling; deduplication via stable IDs (`jira-comment-{id}`, `gitlab-note-{id}`); OS notification dispatch + in-app badge update; in-app badge is the reliable fallback path
5. **Persistence Layer (Tauri Stronghold + Store)** — PATs encrypted at rest in OS keychain; last-seen timestamps and user preferences in Tauri Store
6. **UI Layer (React + shadcn/ui)** — dev dashboard, PM dashboard, notification hub, settings/onboarding; role-based routing via React Router hash mode

### Critical Pitfalls

1. **Jira Cloud API docs vs Server REST v2** — the default Atlassian developer portal shows Cloud docs. On Server: use `name` not `accountId` for users, use offset-based pagination (not cursor), fetch workflow transitions per-issue (not globally), auth with `Bearer <PAT>`. Test against the actual on-premise instance from day one with `GET /rest/api/2/myself`.

2. **PATs in plaintext** — never store in `localStorage`, config files, or unencrypted Tauri Store. Tauri Stronghold (OS keychain) is required from Phase 1. Any 401 response must surface a clear re-auth banner — not a generic error.

3. **Overaggressive polling hammering on-premise Jira** — a single poll coordinator (not per-component polling) with minimum 60-second intervals for background data and 30-second for notification-critical paths. Cursor-based incremental fetches only — never re-fetch full lists. Exponential backoff on errors; respect GitLab's `Retry-After` and `X-RateLimit-Remaining` headers.

4. **Task-to-MR linking regex misses real formats** — gather 20+ real MR titles from team history before writing the regex. Handle `PROJ-123`, `[PROJ-123]`, `feat/PROJ-123`, branch names, MR descriptions, and lowercase project keys. A missed link is a silent failure that destroys trust in the feature.

5. **Desktop OS notifications silent failure** — macOS works; Windows with Focus Assist and Linux with non-GNOME desktops often don't. The in-app notification hub and badge must work independently of OS notification permission. Always handle `denied` permission state with an actionable in-app banner.

---

## Implications for Roadmap

The architecture research provides a clear 7-phase build order driven by data dependencies: nothing works without PATs, the data model must stabilize before the UI is built on it, and the notification system can only be proven after the polling pattern is established in the core dashboard phase.

### Phase 1: Foundation — Auth, Credentials, Tauri Shell

**Rationale:** PAT storage gates every other feature. This is also the only phase where the wrong decision (plaintext storage, web-only architecture) causes a rewrite. The desktop-vs-web architecture question must be resolved before writing a line of feature code — CORS makes a pure web app impossible against the on-premise Jira instance without a proxy.
**Delivers:** Working Tauri 2 app shell; PAT entry/validation onboarding screen; Tauri Stronghold credential storage; PAT health check on startup; 401 → re-auth banner for all subsequent phases; role preference storage keyed by resolved Jira username
**Addresses:** PAT authentication table-stakes feature; dark/light mode infrastructure
**Avoids:** Pitfall 2 (plaintext PATs), Pitfall 9 (CORS), Pitfall 10 (no PAT expiry recovery), Pitfall 13 (role state bleeding between users)

### Phase 2: API Client Layer + Data Models

**Rationale:** The internal data model (normalized `Task` and `MR` interfaces) must be stable before UI components are built against it. Changing the model mid-UI is expensive. Both Jira and GitLab clients must be tested against real API responses before feature work begins.
**Delivers:** `jiraRepository` and `gitlabRepository` modules (typed, axios-backed, PAT-injected); normalized `Task`, `MR`, `Sprint`, `User` internal interfaces (adapter layer); MSW mock handlers for both APIs; Jira Server quirks locked in (fields param, per-issue transitions, Server auth header, `name` not `accountId`)
**Uses:** axios, TypeScript, Vitest, MSW
**Implements:** API Client Layer + Adapter Layer (architecture components)
**Avoids:** Pitfall 1 (Cloud vs Server API), Pitfall 6 (non-portable transition IDs), Pitfall 7 (missing fields param), Pitfall 8 (GitLab pagination)

### Phase 3: Developer Dashboard + Core Write Actions

**Rationale:** The developer view delivers immediate daily value and validates the data model before the PM view or notification system is built. Write actions (status transitions, comments, MR approval) must follow immediately — a read-only dashboard does not serve the use case.
**Delivers:** TanStack Query integration with single poll coordinator; Developer dashboard: my tasks list, sprint board (column-per-status), MR "needs attention" list; optimistic UI for all write actions; loading skeletons and error states per panel (independent Jira/GitLab failure modes); Jira task status update, add comment; GitLab MR approve, request changes, add comment
**Addresses:** My tasks, sprint board, MR list, task status update, add comment, MR approve (all table stakes)
**Avoids:** Pitfall 3 (aggressive polling — single coordinator established here), Anti-Pattern 1 (fetching in components), Anti-Pattern 4 (coupled Jira/GitLab fetches)

### Phase 4: Task-to-MR Linking Engine

**Rationale:** Linking is the core differentiator — it's what justifies the app over two browser tabs. It must follow Phase 3 because it requires both Jira issues and GitLab MRs to be in cache. It is architecturally isolated in the Linking Engine, so it can be built and tested independently before the UI integrates it.
**Delivers:** Ticket ID regex extraction (`/\b([A-Z][A-Z0-9]+-\d+)\b/gi`) from MR title → branch name → description; cross-entity join in TanStack Query cache; linked MR chips on task cards; linked task badge on MR rows; MR review health indicator on sprint board cards; stale MR detection; "ready to merge" checklist
**Addresses:** Task-to-MR linking display, bidirectional display, MR review health indicator (table stakes + differentiators)
**Avoids:** Pitfall 4 (regex misses real formats — gather real MR title corpus before building), Anti-Pattern 5 (greedy commit scanning)

### Phase 5: Notification Hub + OS Notifications

**Rationale:** Notifications require the polling infrastructure established in Phase 3. They are architecturally the most complex feature (deduplication, cursor management, cross-platform OS behavior, two independent dispatch channels) and must be built as a dedicated phase, not bolted onto the dashboard.
**Delivers:** Notification Engine with cursor-based delta polling and `lastSeenTimestamp` per source; deduplication by stable event IDs; in-app notification hub (chronological feed, read/unread per item, badge count); OS notification dispatch via Tauri Notification plugin; `denied` permission banner; in-app badge as primary reliable path; last-seen cursors persisted in Tauri Store
**Addresses:** Unified notification feed, in-app badge, desktop OS notifications (all table stakes — the primary pain point)
**Avoids:** Pitfall 3 (aggressive polling — notification polling uses same coordinator), Pitfall 5 (silent OS notification failure), Pitfall 14 (comment thread performance — delta polling with timestamps)

### Phase 6: PM Dashboard

**Rationale:** Additive to the existing data model and API clients. Can start after Phase 3 without blocking any other phase. Role-based routing is straightforward with React Router. The PM data (team workload, sprint progress) derives from already-fetched Jira data with aggregation.
**Delivers:** PM dashboard: sprint progress overview (story points done/remaining), team workload view (open tasks + points per member); role-based routing (dev vs PM view) via React Router hash mode; role preference persisted per user identity
**Addresses:** PM sprint progress, PM team workload, role-based dashboard (table stakes)
**Avoids:** Pitfall 13 (role preference keyed by Jira username, not global)

### Phase 7: Polish + Deferred Table Stakes

**Rationale:** Global search and create-task were deferred in the MVP recommendation but are still table stakes (missing = workflow broken for some users). Polish (dark mode persistence, error states, keyboard shortcuts) belongs last when the app's shape is stable.
**Delivers:** Global search (debounced Jira JQL + GitLab search API, unified results); create Jira task (summary, type, assignee, sprint — minimum fields only); dark/light mode persistence; keyboard shortcuts (j/k navigation, enter to open, a to approve); full error state coverage; Tauri build pipeline for distribution
**Addresses:** Global search, create Jira task, dark/light mode (deferred table stakes); quick-action keyboard shortcuts (differentiator)
**Avoids:** Shipping without a "test notification" button in settings (OS notification debuggability)

### Phase Ordering Rationale

- **Phase 1 before everything:** PAT storage is the sole dependency for all API calls; architecture decision (desktop vs web) must be locked before any feature code
- **Phase 2 before Phase 3:** Internal data model must be stable; changing it after UI is built is expensive; API quirks must be discovered against real endpoints before feature work
- **Phase 3 before Phase 4:** Linking requires both Jira issues and GitLab MRs in cache; linking UI requires sprint board and MR list to exist
- **Phase 3 before Phase 5:** Notification polling reuses the poll coordinator and TanStack Query patterns established in Phase 3; don't build notifications against an unproven polling foundation
- **Phase 6 parallel-eligible with Phase 5:** PM dashboard is additive and uses the same Jira data already fetched; it can begin as soon as Phase 3 is complete without waiting for Phase 5
- **Phase 7 last:** Search, create-task, and polish can only be prioritized correctly once the core daily-use flows are validated

### Research Flags

Phases likely needing deeper research or on-premise validation during planning:
- **Phase 1:** Tauri Stronghold v2 plugin API — verify initialization pattern, Rust crate registration in Cargo.toml, and actual PAT read/write flow against a real Tauri 2 project (MEDIUM confidence on plugin API details)
- **Phase 2:** Validate actual on-premise Jira Server version — confirm whether Bearer PAT auth or Basic auth is required (depends on server version, pre/post 7.x), and whether any activity stream endpoints exist on this specific instance
- **Phase 4:** Gather 20+ real MR titles and branch names from the team's GitLab history before writing the regex — this corpus is the test suite; can't do this from research alone
- **Phase 5:** Cross-platform notification testing matrix must be defined and executed: macOS, Windows 11 (Focus Assist on/off), Ubuntu GNOME, and at least one KDE environment

Phases with standard patterns (skip research-phase):
- **Phase 3:** TanStack Query polling + React dashboard patterns are extremely well-documented; shadcn/ui component integration is standard; no novel decisions required
- **Phase 6:** PM dashboard is data aggregation on top of already-fetched Jira data; no novel API patterns
- **Phase 7:** Global search uses standard Jira JQL and GitLab search endpoints already validated in Phase 2; React Router patterns are standard

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core choices (React, TanStack Query, Zustand, axios) are HIGH; Tauri 2 plugin ecosystem and exact versions are MEDIUM; Tailwind v4 compatibility with shadcn/ui is LOW — pin to v3.4 |
| Features | MEDIUM | Well-established patterns from LinearB/Swarmia analysis; Jira Server + GitLab API capabilities are HIGH; competitor feature set from training knowledge, not live product pages |
| Architecture | HIGH | Client-only dashboard is a well-understood pattern; CORS constraint and polling vs webhook rationale are direct consequences of stated constraints; Jira/GitLab API patterns are authoritative |
| Pitfalls | HIGH (Jira/GitLab API, security) / MEDIUM (cross-platform packaging, notifications) | Jira Server API differences and GitLab rate-limiting headers are well-documented; code signing requirements may have changed post-Aug 2025; desktop notification platform differences are MEDIUM |

**Overall confidence:** MEDIUM-HIGH — sufficient to begin building with the architecture as specified; the main uncertainty is in Tauri plugin exact API surface and cross-platform notification behavior, both of which are validated by building Phase 1 and running the notification test matrix in Phase 5.

### Gaps to Address

- **Actual on-premise Jira version and auth mechanism:** Must test `GET /rest/api/2/myself` with Bearer PAT against the real instance in Phase 1 before any other Jira work. The auth header format (Bearer vs Basic) determines how the axios interceptor is configured.
- **Tailwind CSS v4 / shadcn/ui compatibility:** Pin to Tailwind ^3.4 for v1; do not assume v4 works until verified against current shadcn/ui release.
- **GitLab self-hosted rate limits:** The 2000 req/min rate limit applies to GitLab.com. The team's GitLab instance may have a different (lower) default. Validate in Phase 2 before setting polling intervals.
- **MR title corpus for linking:** Cannot be gathered from research — must pull real data from the team's GitLab history in Phase 4 planning.
- **Tauri Stronghold initialization pattern:** Plugin API details at the Rust crate registration level need live verification against current Tauri 2 + Stronghold v2 documentation.

---

## Sources

### Primary (HIGH confidence)
- Jira Server REST API v2: `{jira-base-url}/rest/api/2/` — all Server-specific behavior (accountId vs name, transition IDs, pagination, auth)
- GitLab REST API v4: https://docs.gitlab.com/ee/api/rest/ — rate limiting headers, pagination, MR endpoints, `updated_after` parameter
- PAT security / OS keychain: Tauri Stronghold plugin docs, Electron keytar docs — storage patterns
- CORS behavior: Web platform specification, Electron/Tauri architecture docs — desktop eliminates CORS entirely

### Secondary (MEDIUM confidence)
- Tauri 2.0 release notes: https://tauri.app/blog/tauri-2-0-0-released/ — feature set, plugin ecosystem
- TanStack Query v5 documentation: https://tanstack.com/query/latest — polling, cache invalidation, mutation patterns
- LinearB, Swarmia, Axify feature sets — training knowledge (not live product pages) — competitor feature map
- shadcn/ui documentation — component model, Tailwind integration
- Electron Notification class docs: https://www.electronjs.org/docs/latest/api/notification — cross-platform notification behavior (proxy for Tauri behavior)

### Tertiary (LOW confidence)
- Tailwind CSS v4 compatibility with shadcn/ui — verify against current releases before adopting; pin to v3.4 otherwise
- Code signing requirements (macOS notarization, Windows EV certificate) — may have changed post-Aug 2025; verify before Phase 7 distribution work

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
