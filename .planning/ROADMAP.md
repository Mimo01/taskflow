# Roadmap: Taskflow

## Overview

Taskflow is built in four phases that follow a strict dependency chain. Phase 1 locks in the security and architecture foundation before any feature code is written — PAT storage in the OS keychain and the Tauri desktop shell must be correct from the start or everything built on top requires rework. Phase 2 delivers the core daily-use flow: the developer dashboard with live task and MR data, bidirectional task-MR linking, and the Jira write actions that make the app useful rather than just a read-only view. Phase 3 adds the notifications hub — the primary pain point being solved — built on the polling infrastructure established in Phase 2. Phase 4 completes v1 by adding the PM dashboard, global search, and the remaining polish that makes the app shippable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri shell, PAT onboarding, OS keychain credential storage, and role selection
- [ ] **Phase 2: Developer Dashboard** - Developer view with live tasks, sprint board, MR attention list, task-MR linking, and Jira write actions
- [ ] **Phase 3: Notifications Hub** - Unified notification feed with polling, OS desktop notifications, in-app badge, and read/unread tracking
- [ ] **Phase 4: PM Dashboard + Search** - PM sprint and workload views, global search, and remaining UI polish

## Phase Details

### Phase 1: Foundation
**Goal**: A working Tauri desktop app where users can securely store credentials, connect to Jira and GitLab, and configure their role
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, ROLE-01, ROLE-02, UI-01
**Success Criteria** (what must be TRUE):
  1. User can enter Jira base URL and PAT, and GitLab base URL and PAT through an onboarding screen — credentials are stored in the OS keychain, never in plaintext
  2. User can select the active Jira project and GitLab group from a list that is fetched using the stored tokens
  3. App shows a clear, actionable error banner when a token is invalid or expired, not a generic failure message
  4. User can select Developer or Project Manager role during onboarding and change it from settings at any time
  5. User can switch between dark and light mode and the preference persists across app restarts
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md — Tauri 2 project scaffold: app shell, React 18 + TypeScript, routing, shadcn/ui, Tailwind v3, Zustand stores, Tauri abstraction layer, test infrastructure
- [x] 01-02-PLAN.md — PAT onboarding flow: credential entry form, Tauri Stronghold storage, Jira/GitLab validation calls with exact error messages, inline project/group selection, re-auth banner
- [x] 01-03-PLAN.md — Role selection + settings: role picker in onboarding and settings, dark/light/system theme toggle with persistence, token masking with eye-reveal, sidebar navigation
- [x] 01-04-PLAN.md — Gap closure: 5 TypeScript compile errors resolved, Jira project Select UI + queryClient.clear() wired to project switching in TokenSection
- [x] 01-05-PLAN.md — UAT gap closure: missing CSS import (no styles), CORS fix for Jira/GitLab API calls via tauri-plugin-http fetch + capabilities scope
- [ ] 01-06-PLAN.md — Verification gap closure: fix 9 failing unit tests in jira.test.ts and gitlab.test.ts by replacing vi.stubGlobal with vi.mock for @tauri-apps/plugin-http named fetch

### Phase 2: Developer Dashboard
**Goal**: A developer can open the app, see their current sprint tasks and MRs that need attention, understand which MRs are linked to which tasks, and take actions on Jira tasks without leaving the app
**Depends on**: Phase 1
**Requirements**: DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, LINK-01, LINK-02, LINK-03, LINK-04, JACT-01, JACT-02, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Developer sees their open Jira tasks filtered to the current sprint, and a sprint board with tasks grouped into columns by workflow status
  2. Developer sees GitLab MRs assigned to them or where they are a reviewer with open threads, with stale MRs (no activity beyond a configurable threshold) visibly flagged
  3. Each task card shows linked MRs (title, status, author) and each MR row shows the linked Jira task (key, summary, status) — linking is automatic via ticket key parsing from MR title then commit messages
  4. Sprint board cards show an MR review health badge (waiting for review / approved / changes requested) derived from linked MR state
  5. User can update a Jira task's status by selecting from available workflow transitions, and can add a comment to a Jira task — both with loading feedback and error recovery
  6. All data views show a last-refreshed timestamp and display a loading state during API calls with a meaningful error message on failure
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — API client layer: extend Jira + GitLab services with sprint/MR/transition/comment functions, create linkEngine.ts with pure linking logic, dashboard store, settings store extension (staleMrThresholdDays)
- [x] 02-02-PLAN.md — Dashboard UI shell: three-tab layout (My Tasks / Sprint Board / MR Attention), TanStack Query polling, loading skeletons, error states, last-refreshed timestamps, Base UI Popover primitive, TaskRow/TaskCard/MrRow display components
- [x] 02-03-PLAN.md — Task-MR linking integration: wire linkEngine into tab components, compute link maps from live data, render MR chips on TaskRow, linked task badge on MrRow, review health dot on TaskCard, commit scan fallback
- [x] 02-04-PLAN.md — Jira write actions: StatusPopover with lazy-fetched transitions + optimistic update + rollback, InlineComment with expand/collapse, per-row inline errors (no toast/modal)

### Phase 3: Notifications Hub
**Goal**: Users see a unified feed of Jira mentions and GitLab MR thread activity, receive OS desktop notifications for new items, and can manage read/unread state — the primary pain point of the on-premise Jira instance with no built-in notifications
**Depends on**: Phase 2
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06
**Success Criteria** (what must be TRUE):
  1. User sees a chronological unified feed combining Jira comment mentions/replies and GitLab MR thread activity, with individual read/unread state per notification
  2. Notifications are fetched via cursor-based delta polling on a configurable interval (minimum 30 seconds), using the same poll coordinator as the dashboard — no per-component polling
  3. User receives native OS desktop notifications on macOS, Windows, and Linux for new activity; when OS notification permission is denied, an actionable in-app banner explains the situation
  4. App shows a badge with the count of unread notifications that updates in real time as new items arrive
  5. User can mark individual notifications as read and can mark all notifications as read with a single action
**Plans**: TBD

Plans:
- [ ] 03-01: Notification engine — cursor-based delta polling, stable event ID deduplication (jira-comment-{id}/gitlab-note-{id}), last-seen timestamp persistence in Tauri Store
- [ ] 03-02: Notification hub UI — chronological feed, read/unread per item, mark-all-read, in-app badge, OS notification dispatch via Tauri Notification plugin, denied-permission banner

### Phase 4: PM Dashboard + Search
**Goal**: A project manager can see sprint progress, team workload, and release state; any user can search across tasks and MRs by keyword or ticket key
**Depends on**: Phase 2
**Requirements**: PM-01, PM-02, PM-03, PM-04, SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. Project Manager sees sprint progress: task counts by status (to do / in progress / done) and story points done vs remaining for the current sprint
  2. Project Manager sees team workload: open task count and story points per team member for the current sprint
  3. Project Manager sees a Releases view listing Jira fix versions with linked GitLab milestones or tags, showing task count and completion status per fix version
  4. Any user can search across Jira tasks and GitLab MRs by keyword or ticket key, with results grouped by type (tasks vs MRs) and each result linking to its detail view
**Plans**: TBD

Plans:
- [ ] 04-01: PM dashboard — sprint progress view (status counts + story points), team workload view (per-member task count + points), role-based routing to PM vs dev dashboard
- [ ] 04-02: Releases view — Jira fix versions list with linked GitLab milestones/tags, task count and completion status per version
- [ ] 04-03: Global search — debounced Jira JQL + GitLab search API, unified results grouped by type, deep-links to detail views

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 6/6 | Complete   | 2026-03-11 |
| 2. Developer Dashboard | 4/4 | Complete   | 2026-03-11 |
| 3. Notifications Hub | 0/2 | Not started | - |
| 4. PM Dashboard + Search | 0/3 | Not started | - |
