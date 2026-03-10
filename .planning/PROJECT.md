# Taskflow

## What This Is

Taskflow is a cross-platform work hub for Orange's eshop development team. It unifies Jira (on-premise) and GitLab into a single fast, focused interface — replacing the need to juggle multiple slow tools. It serves both developers and project managers with role-specific dashboards, automatic task-to-MR linking, and a unified notifications hub that fills the gap left by an old Jira instance with no notification support.

## Core Value

Developers and PMs can see everything they need — tasks, merge requests, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Developer dashboard: my tasks, sprint board, and MRs needing attention
- [ ] PM dashboard: sprint progress, release readiness, team workload
- [ ] Unified notifications hub: Jira comment mentions/replies + GitLab MR thread activity
- [ ] Automatic task-to-MR linking via Jira ticket numbers in MR titles and commit messages
- [ ] Jira task actions: update status, move through workflow, add comments
- [ ] GitLab MR actions: approve, request changes, leave comments
- [ ] Create new Jira tasks from the app
- [ ] Releases view: Jira fix versions linked to GitLab milestones/tags
- [ ] Global search across tasks and MRs
- [ ] Dark/light mode toggle per user
- [ ] Connection via personal access tokens (Jira + GitLab)
- [ ] Desktop OS notifications + in-app badges for new activity

### Out of Scope

- Historical analytics/reporting (burndown, velocity) — not needed for v1, live view is sufficient
- Create Jira task from a GitLab MR — keep task creation separate
- Multiple simultaneous Jira projects or GitLab groups — one project at a time
- OAuth login flows — personal access tokens are sufficient

## Context

- **Jira instance**: Old on-premise (non-cloud) Jira — no built-in notifications, cluttered UI, slow. API access via personal access token.
- **GitLab**: gitlab.com or self-hosted — accessed via personal access token.
- **Existing convention**: MR titles and commit messages contain Jira ticket numbers (e.g., `PROJ-123`) — this is the linking mechanism to auto-associate tasks with MRs.
- **Team**: Orange eshop project — developers + project managers using the same app with different role-based views.
- **Scale**: One Jira project + one GitLab group at a time (not multi-project aggregation).

## Constraints

- **Auth**: Personal access tokens only — no OAuth, no server-side credential storage
- **Cross-platform**: Must run on macOS, Windows, Linux (web-based or cross-platform native)
- **Jira API**: Must work with old on-premise Jira REST API (v2) — not Jira Cloud APIs
- **No analytics**: v1 is real-time/live only — no historical data processing or chart generation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cross-platform (web or native TBD) | Team is mixed OS, need it to run everywhere | — Pending |
| Role-based dashboards (dev vs PM) | Different needs, same data sources | — Pending |
| PAT-based auth only | Simple, no server needed, matches team's current practice | — Pending |
| Task-MR linking via ticket number parsing | No formal integration exists; MR titles/commits contain ticket IDs | — Pending |

---
*Last updated: 2026-03-10 after initialization*
