# Requirements: Taskflow

**Defined:** 2026-03-10
**Core Value:** Developers and PMs can see tasks, MRs, sprint state, and notifications in one place without switching between Jira and GitLab.

---

## v1 Requirements

### Authentication & Setup

- [x] **AUTH-01**: User can enter Jira personal access token and Jira base URL during onboarding
- [x] **AUTH-02**: User can enter GitLab personal access token and GitLab base URL during onboarding
- [x] **AUTH-03**: PATs are stored in the OS keychain (not plaintext, not in app state)
- [x] **AUTH-04**: User can select the active Jira project and GitLab group/repo from a list after auth
- [x] **AUTH-05**: User can update or revoke stored tokens from settings
- [x] **AUTH-06**: App displays a clear error when a token is invalid or expired

### Role Selection

- [x] **ROLE-01**: User can select their role (Developer or Project Manager) during onboarding
- [x] **ROLE-02**: User can switch role from settings at any time

### Developer Dashboard

- [x] **DEV-01**: Developer sees a list of their open Jira tasks filtered to the current sprint
- [x] **DEV-02**: Developer sees a sprint board with tasks grouped by workflow status (columns per status)
- [x] **DEV-03**: Developer sees a list of GitLab MRs assigned to them or where they are a reviewer with open threads
- [x] **DEV-04**: Sprint board cards show an MR review health badge (e.g., "waiting for review", "approved", "changes requested") derived from linked MRs
- [x] **DEV-05**: MRs with no activity for a configurable number of days are flagged as stale

### Task-MR Linking

- [x] **LINK-01**: App automatically links Jira tasks to GitLab MRs by parsing the Jira ticket key (e.g., PROJ-123) from MR title
- [x] **LINK-02**: App falls back to scanning commit messages when ticket key is absent from MR title
- [x] **LINK-03**: Linked MRs are displayed on the task card (title, status, author)
- [x] **LINK-04**: Linked Jira task is displayed on the MR card (key, summary, status)

### Jira Actions

- [ ] **JACT-01**: User can update a Jira task's status by selecting from available workflow transitions
- [ ] **JACT-02**: User can add a comment to a Jira task from the app

### Notifications Hub

- [ ] **NOTF-01**: User sees a unified notification feed combining Jira comment mentions/replies and GitLab MR thread activity
- [ ] **NOTF-02**: Notifications are fetched via polling (configurable interval, minimum 30 seconds)
- [ ] **NOTF-03**: User receives native OS desktop notifications (macOS, Windows, Linux) for new activity
- [ ] **NOTF-04**: App shows an in-app badge with the count of unread notifications
- [ ] **NOTF-05**: User can mark individual notifications as read
- [ ] **NOTF-06**: User can mark all notifications as read

### PM Dashboard

- [ ] **PM-01**: Project Manager sees sprint progress: task counts by status (to do / in progress / done) and story points done vs remaining
- [ ] **PM-02**: Project Manager sees team workload: open task count and story points per team member for the current sprint
- [ ] **PM-03**: Project Manager sees a Releases view listing Jira fix versions with their linked GitLab milestone or tag
- [ ] **PM-04**: Releases view shows the count of tasks per fix version and their completion status

### Global Search

- [ ] **SRCH-01**: User can search across Jira tasks and GitLab MRs by keyword or ticket key
- [ ] **SRCH-02**: Search results are grouped by type (tasks vs MRs) and link to the detail view

### UI & Polish

- [x] **UI-01**: User can toggle between dark and light mode
- [x] **UI-02**: App shows last-refreshed timestamp on all data views
- [x] **UI-03**: App shows a loading state during API calls and a meaningful error message on failure

---

## v2 Requirements

### Jira Write Actions (deferred)

- **JACT-V2-01**: User can create a new Jira task (summary, type, assignee, sprint)

### GitLab Write Actions (deferred — v1 is read-only)

- **GACT-V2-01**: User can approve or request changes on a GitLab MR
- **GACT-V2-02**: User can add a comment to a GitLab MR thread

### Differentiators (deferred)

- **DIFF-V2-01**: Notification digest with smart grouping (collapse consecutive activity from same author on same entity)
- **DIFF-V2-02**: Quick-action keyboard shortcuts (j/k navigation, enter to open, etc.)
- **DIFF-V2-03**: Release readiness score (% of release-tagged tasks with merged MRs)
- **DIFF-V2-04**: My review queue sorted by age and urgency signals

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Historical analytics / burndown charts | No daily-use value; complex data pipeline; LinearB/Swarmia cover this use case |
| OAuth / SSO login | Team uses PATs; OAuth adds server-side requirements that conflict with no-server architecture |
| Multi-project aggregation | Exponentially increases data model complexity; one project is sufficient for target team |
| Create Jira task from GitLab MR | Creates workflow confusion; task creation is always explicit |
| Full Jira issue editor (custom fields, attachments, watchers) | On-premise Jira has wildly varied custom field configurations; edit core fields only |
| Two-way sync / webhooks | Requires server component to receive webhooks; conflicts with PAT-only architecture |
| Email or Slack notifications | External service dependencies; out of scope |
| Inline MR diff / full code review UI | GitLab's review UI is mature; deep-link to GitLab for full review |
| Custom drag-and-drop dashboard builder | Premature generalization; opinionated role layouts cover 90% of use cases |
| DORA metrics / velocity charts | Out of scope; LinearB/Swarmia exist for this |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| ROLE-01 | Phase 1 | Complete |
| ROLE-02 | Phase 1 | Complete |
| UI-01 | Phase 1 | Complete |
| DEV-01 | Phase 2 | Complete |
| DEV-02 | Phase 2 | Complete |
| DEV-03 | Phase 2 | Complete |
| DEV-04 | Phase 2 | Complete |
| DEV-05 | Phase 2 | Complete |
| LINK-01 | Phase 2 | Complete |
| LINK-02 | Phase 2 | Complete |
| LINK-03 | Phase 2 | Complete |
| LINK-04 | Phase 2 | Complete |
| JACT-01 | Phase 2 | Pending |
| JACT-02 | Phase 2 | Pending |
| UI-02 | Phase 2 | Complete |
| UI-03 | Phase 2 | Complete |
| NOTF-01 | Phase 3 | Pending |
| NOTF-02 | Phase 3 | Pending |
| NOTF-03 | Phase 3 | Pending |
| NOTF-04 | Phase 3 | Pending |
| NOTF-05 | Phase 3 | Pending |
| NOTF-06 | Phase 3 | Pending |
| PM-01 | Phase 4 | Pending |
| PM-02 | Phase 4 | Pending |
| PM-03 | Phase 4 | Pending |
| PM-04 | Phase 4 | Pending |
| SRCH-01 | Phase 4 | Pending |
| SRCH-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 — traceability complete after roadmap creation*
