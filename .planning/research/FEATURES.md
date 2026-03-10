# Feature Landscape

**Domain:** Developer/PM dashboard — Jira + GitLab integration (cross-platform)
**Researched:** 2026-03-10
**Confidence note:** Web search tools were unavailable for this session. Findings are based on training knowledge (cutoff August 2025) covering LinearB, Swarmia, Axify, Jira+GitLab native integrations, and the broader developer productivity tooling space. Confidence is MEDIUM overall — well-established patterns, but not verified against live product pages today.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or users revert to using Jira + GitLab directly.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| My open tasks list (filtered to current user) | Core reason to open the app — what do I need to do today? | Low | Filter by assignee, open status, sprint membership |
| Current sprint board view | Standard Jira usage pattern — sprint is the unit of work | Med | Column-per-status, drag not required for v1 |
| MR list filtered to "needs my attention" | Developer's most common GitLab use case outside of coding | Med | Open MRs assigned to me + MRs where I'm a reviewer with unresolved threads |
| Task status update from the app | Useless dashboard if you still need Jira to update anything | Med | Must hit on-premise Jira REST API v2; workflow transitions, not free-form status |
| Task-to-MR linking display | Core differentiator of unified dashboards — show the MR next to its ticket | Med | Parse Jira ticket number (e.g., PROJ-123) from MR title/branch/commits |
| Unified notification feed | Explicitly called out as the primary pain point (old Jira has zero notifications) | High | Merge Jira comment mentions + GitLab MR thread activity into one chronological feed |
| MR approve / request-changes action | Developers live in code review — can't omit MR actions | Med | GitLab MR approval API; request-changes via review comment |
| Add comment on task | Async communication happens in Jira comments; read-only is insufficient | Low | POST to Jira comment endpoint |
| Add comment on MR thread | Same — read-only MR view is not enough for daily use | Low | GitLab note API |
| Personal access token auth (Jira + GitLab separately) | Matches team's existing practice; no server-side credential storage needed | Low | Store tokens in OS keychain or local encrypted storage |
| Role-based dashboard (dev vs PM) | Devs and PMs have fundamentally different daily views | Med | Same data sources, different layouts and widgets |
| PM: sprint progress overview | PMs need at-a-glance sprint health — story points done/remaining, blockers | Med | Aggregate Jira sprint data |
| PM: team workload view | Are people overloaded or idle? | Med | Count open tasks + story points per team member |
| Desktop / OS notifications | Push model — don't make users poll the app for updates | High | OS notification APIs (macOS, Windows, Linux) + in-app badge counts |
| Dark / light mode | Universal expectation for any developer-facing desktop/web app | Low | CSS custom properties / theme context |
| Global search (tasks + MRs) | Users remember ticket numbers and MR titles — need fast lookup | Med | Debounced search hitting Jira issue search API + GitLab MR search API |
| Releases / fix-version view | PMs track delivery against releases; linked to GitLab milestones or tags | High | Jira fix versions + GitLab milestones/tags — correlation logic needed |
| Create new Jira task | If you can view and update tasks but not create, workflow is broken | Low | POST to Jira issues endpoint; minimum: summary, type, assignee, sprint |
| In-app badge for unread notifications | Users need passive awareness without full UI focus | Low | Depends on notification system being implemented |

---

## Differentiators

Features that set Taskflow apart from just having two browser tabs open. Not universally expected, but high perceived value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automatic task-to-MR linking (bidirectional display) | No other tool does this automatically for on-premise Jira + GitLab without an admin plugin | High | Parse ticket ID from MR title, branch name, and commit messages; show linked MRs on task card and linked task on MR card |
| MR review health indicator on sprint board | See at a glance which sprint tasks are blocked waiting for code review | Med | Derived from linked MRs — if all MRs for a task are "needs review", flag the task |
| Notification digest with smart grouping | Reduce noise: group thread activity by MR/task rather than showing every individual comment as a separate notification | Med | Group by parent entity; collapse consecutive activity from same author |
| Notification read/unread tracking per item | Users can mark items read without losing history | Med | Local state or lightweight backend; critical for notification UX quality |
| Quick-action keyboard shortcuts | Power users (developers) love keyboard-first workflows | Med | Focus mode: j/k for navigation, enter to open, a to approve, etc. |
| Release readiness score (PM view) | Single number summarizing sprint-to-release linkage health | High | % of release-tagged tasks with merged MRs; requires task-MR linking + release view |
| Inline MR diff preview | See the core changes without opening GitLab — triage reviews faster | Very High | GitLab diffs API; syntax highlighting; not recommended for v1 |
| Stale MR detection | Flag MRs open longer than N days with no activity | Low | Derived from MR updated_at; surfaced as a warning badge |
| My review queue with priority ordering | Show reviewer's MRs sorted by age + urgency signals | Low | Sort by created_at + unresolved thread count |
| "Ready to merge" checklist on MR card | All approvals? CI passing? All threads resolved? One card, one glance | Med | Aggregate GitLab MR metadata: approvals, pipeline status, thread resolution |

---

## Anti-Features

Features to explicitly NOT build — they add cost, complexity, or scope creep without matching Taskflow's actual value proposition.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Historical velocity / burndown charts | Out of scope per PROJECT.md; complex data pipeline; adds no daily-use value for the target team | Live sprint progress view only — current sprint state, not trends |
| OAuth / SSO login flows | Unnecessary complexity; team uses PATs; adds server-side requirements | Personal access token entry in settings; store in OS keychain |
| Multi-project aggregation (multiple Jira projects or GitLab groups simultaneously) | Exponentially increases data model complexity; target team has one project | Single project + single group; configuration switch if needed later |
| Create Jira task from a GitLab MR | Creates workflow confusion about which direction the relationship runs | Task creation is always explicit from Taskflow's task creation flow |
| Full Jira issue editor (all fields, custom fields, watchers, attachments) | Long tail of edge cases; on-premise Jira has wildly varied custom field configurations | Edit core fields only: status, assignee, comment, sprint |
| Two-way sync / webhooks from Jira or GitLab | Requires a server component to receive webhooks; conflicts with PAT-only, no-server architecture | Poll on interval (configurable, e.g., 30s–5min); show last-refreshed timestamp |
| Built-in time tracking | Jira has its own; duplicating creates sync problems | Link to Jira's time tracking UI if users need it |
| Code editor / IDE integration | Out of scope; the IDE is the developer's primary tool — Taskflow is the peripheral | Keep Taskflow as a companion app, not a replacement for the IDE |
| Custom dashboard builder (drag-and-drop widgets) | High UX complexity; premature generalization for a focused internal tool | Opinionated, role-specific layouts that cover 90% of use cases |
| Team-level analytics and DORA metrics | Requires long-term data retention, complex aggregation, privacy considerations | Out of scope for v1; LinearB/Swarmia exist for this use case |
| Push notifications via email or Slack | Adds external service dependencies; scope creep from core OS notification model | OS desktop notifications are sufficient |
| Comment reactions / emoji responses | Low value relative to implementation cost for a work-focused tool | Plain comment text only |
| Inline code review (full review UI inside Taskflow) | GitLab's review UI is mature; replicating it is enormous effort for marginal gain | Deep-link to GitLab for full review; show thread summary in-app |

---

## Feature Dependencies

```
PAT storage (Jira + GitLab)
  └── ALL other features (nothing works without authenticated API access)

Jira API connection
  ├── My tasks list
  ├── Sprint board view
  ├── Task status update
  ├── Add comment on task
  ├── Create Jira task
  ├── PM sprint progress view
  ├── PM team workload view
  ├── Releases view (Jira fix versions side)
  └── Global search (tasks side)

GitLab API connection
  ├── MR list (needs attention)
  ├── MR approve / request-changes
  ├── Add comment on MR thread
  ├── Releases view (GitLab milestones/tags side)
  └── Global search (MRs side)

Task-to-MR linking (ticket ID parsing)
  ├── MR review health indicator on sprint board
  ├── Release readiness score (PM view)
  └── Bidirectional display (task shows linked MRs; MR shows linked task)

Notification feed
  ├── In-app badge (unread count)
  ├── Desktop OS notifications
  └── Notification read/unread tracking

Sprint board view
  └── MR review health indicator (overlay on sprint cards)

Releases view (Jira fix versions + GitLab milestones)
  └── Release readiness score (PM view)
```

---

## Competitor Feature Map

| Feature | Jira native | GitLab native | LinearB | Swarmia | Axify | Taskflow target |
|---------|-------------|---------------|---------|---------|-------|-----------------|
| Unified task+MR view | No | No | Yes | Yes | Partial | Yes (core) |
| On-premise Jira support | Yes | No | Yes | Limited | Yes | Yes (required) |
| Notification hub | Partial (cloud only) | Yes | No | No | No | Yes (core gap) |
| Auto task-MR linking | Plugin required | No | Yes (cloud) | Yes (cloud) | No | Yes (no plugin) |
| DORA / velocity metrics | No | Partial | Yes (core) | Yes (core) | Yes (core) | No (anti-feature) |
| PAT-only auth, no server | N/A | N/A | No (OAuth) | No (OAuth) | No (OAuth) | Yes (constraint) |
| Role-based dev/PM dashboards | Partial | No | Partial | No | No | Yes |
| OS desktop notifications | No | No | No | No | No | Yes |

---

## MVP Recommendation

Prioritize for v1 (in dependency order):

1. **PAT authentication + credential storage** — gates everything else
2. **My tasks list + sprint board (dev view)** — immediate daily value for developers
3. **MR list "needs my attention"** — second most common daily use case for devs
4. **Task-to-MR linking display** — the core differentiator that justifies the app existing
5. **Unified notification feed** — addresses the explicit pain point (old Jira has no notifications)
6. **Task status update + add comment (Jira)** — makes the app actionable, not read-only
7. **MR approve + add comment (GitLab)** — closes the action loop on code review
8. **PM sprint progress + team workload view** — serves the PM role
9. **Desktop OS notifications + in-app badge** — moves from pull to push model
10. **Dark/light mode** — polish, low effort, high perception value

Defer to post-v1:

- **Releases view** — higher complexity (Jira fix versions + GitLab milestone correlation); v1 live view is sufficient
- **Global search** — useful but not blocking daily use; URL deep-linking to Jira/GitLab works as fallback
- **Create Jira task** — lower frequency action; Jira UI fallback is acceptable for v1
- **Stale MR detection / review health indicators** — derived features; base features must exist first
- **Release readiness score** — requires releases view + task-MR linking both stable

---

## Sources

- Training knowledge of LinearB feature set (product pages, blog posts, documentation; knowledge cutoff August 2025) — MEDIUM confidence
- Training knowledge of Swarmia feature set (same) — MEDIUM confidence
- Training knowledge of Axify feature set (same) — MEDIUM confidence
- Jira Server REST API v2 documentation (well-established, stable API) — HIGH confidence
- GitLab REST API documentation (well-established, stable API) — HIGH confidence
- PROJECT.md (authoritative source for Taskflow scope, constraints, and out-of-scope decisions) — HIGH confidence
- Web search and WebFetch tools were unavailable during this session — findings not verified against current product pages
