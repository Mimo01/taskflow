# Architecture Patterns

**Project:** Taskflow
**Researched:** 2026-03-10
**Confidence:** HIGH (well-established patterns for this class of app)

## Recommended Architecture

Taskflow is a **client-only, API-aggregation dashboard**. There is no backend server. All API calls happen directly from the client process to Jira and GitLab, credentials live only on the local machine, and state is maintained in memory plus a local persistence layer (for credentials and user preferences).

This is the correct architecture given the PAT-only auth constraint and the single-team scale. A backend would add operational complexity with no benefit for this use case.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Taskflow Client                           │
│                                                                  │
│  ┌─────────────┐   ┌───────────────┐   ┌──────────────────────┐ │
│  │   UI Layer  │   │  State Layer  │   │   Persistence Layer  │ │
│  │  (React)    │◄──│  (Zustand /   │   │  (local keychain /   │ │
│  │             │   │   TanStack    │   │   config file)       │ │
│  │  Dev View   │   │   Query)      │   │                      │ │
│  │  PM View    │   │               │   │  - PATs              │ │
│  │  Notifs     │   │  - Cache      │   │  - Prefs (theme)     │ │
│  │  Search     │   │  - Polling    │   │  - Last-seen cursors │ │
│  └──────┬──────┘   │  - Linking    │   └──────────────────────┘ │
│         │          └───────┬───────┘                             │
│         │                  │                                     │
│  ┌──────▼──────────────────▼──────┐                             │
│  │          API Client Layer      │                             │
│  │                                │                             │
│  │  ┌─────────────┐  ┌──────────┐ │                             │
│  │  │ Jira Client │  │ GitLab   │ │                             │
│  │  │  (REST v2)  │  │ Client   │ │                             │
│  │  │             │  │ (REST)   │ │                             │
│  │  └──────┬──────┘  └────┬─────┘ │                             │
│  └─────────┼──────────────┼───────┘                             │
└────────────┼──────────────┼────────────────────────────────────┘
             │              │
             ▼              ▼
     [On-prem Jira]   [GitLab.com or
      REST API v2       self-hosted]
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **UI Layer** | Render dev/PM views, notifications, search results, actions | State Layer (read), Action Handlers (write) |
| **State Layer** | In-memory cache of fetched data; polling orchestration; linked entity resolution | API Client Layer (fetch), Persistence Layer (read prefs), UI Layer (push updates) |
| **API Client Layer - Jira** | All Jira REST v2 calls: issues, sprints, comments, transitions, search | Jira on-prem instance only |
| **API Client Layer - GitLab** | All GitLab REST calls: MRs, comments, approvals, milestones, commits | GitLab instance only |
| **Linking Engine** | Parse Jira ticket IDs (e.g., `PROJ-123`) from MR titles and commit messages; join Jira issues to GitLab MRs | State Layer (bidirectional) |
| **Notification Engine** | Detect new activity (Jira comment mentions, GitLab MR threads); dispatch OS notifications and in-app badges | State Layer (read diffs), OS notification API |
| **Persistence Layer** | Store PATs securely (OS keychain on desktop, localStorage encrypted on web); store user prefs | State Layer (read/write on startup and settings change) |
| **Action Handlers** | Encapsulate write operations: update Jira status, add comment, approve MR, etc. | API Client Layer (write), State Layer (invalidate/update cache) |

---

## Data Flow

### Read Path (Dashboard Render)

```
App Start
  └─► Load PATs from Persistence Layer
        └─► Initialize API Clients with PATs
              └─► State Layer triggers initial fetch
                    ├─► Jira Client: fetch assigned issues, sprint, fix versions
                    ├─► GitLab Client: fetch open MRs, milestones, recent commits
                    └─► Linking Engine: match ticket IDs from MR titles/commits
                              └─► State Layer: merge into unified data model
                                        └─► UI Layer: render dashboards
```

### Write Path (User Actions)

```
User Action (e.g., "Move task to In Progress")
  └─► Action Handler
        └─► API Client (POST/PUT to Jira or GitLab)
              ├─► On success: optimistic update in State Layer
              └─► On failure: revert + show error toast
```

### Notification Path (Polling Loop)

```
Every N seconds (polling interval):
  ├─► Jira Client: fetch comments/activity since last-seen cursor
  ├─► GitLab Client: fetch MR events since last-seen cursor
  └─► Notification Engine:
        ├─► Compare against last-known state
        ├─► Filter: only mentions/replies for current user (Jira)
        │           only MR thread activity on user's MRs (GitLab)
        ├─► Dispatch OS notification (desktop) or in-app badge
        └─► Update last-seen cursors in Persistence Layer
```

### Task-MR Linking Flow

```
GitLab MR fetched (title: "PROJ-123: Add payment gateway")
  └─► Linking Engine: regex extract ticket IDs → ["PROJ-123"]
        └─► Look up PROJ-123 in Jira issue cache
              ├─► Found: attach MR reference to Jira issue in state
              └─► Not found: queue a targeted Jira fetch for PROJ-123
                              └─► Cache result, attach MR reference
```

Commit messages in MR diff are a secondary source. Scan MR title first (cheaper), fall back to commit messages if title yields no ticket ID. Deduplicate — one MR can link to one ticket only (first match wins, per project convention).

---

## API Polling vs Webhooks

**Use polling. Do not attempt webhooks.**

Rationale:
- On-premise Jira (old instance) may not support outbound webhooks reliably or at all without admin access the team may not have.
- A client-only app has no public URL to receive webhook callbacks.
- GitLab webhooks require a server endpoint. Even with GitLab.com, a client cannot receive webhooks directly.
- Polling is sufficient for notification latency acceptable to this team (60–120 second interval is fine for "someone mentioned you in a comment").

Polling strategy:
- **Foreground (app focused):** Poll every 30–60 seconds.
- **Background (app open but unfocused):** Poll every 90–120 seconds to reduce API load.
- **Idle (app minimized):** Poll every 3–5 minutes.
- Use cursor-based incremental fetches (Jira: `updatedDate > [last-check]`; GitLab: `updated_after` parameter) — never re-fetch full lists on each poll.

Rate limit awareness: Jira on-prem REST v2 has no documented rate limit but may be slow. GitLab.com enforces 2000 req/min per user. Batch requests where possible. Cache aggressively.

---

## Token Storage

| Deployment | Storage Mechanism | Threat Model |
|------------|-------------------|--------------|
| Desktop (Electron/Tauri) | OS keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux) | PATs not in plaintext on disk; protected by OS user session |
| Web app (if chosen) | localStorage (AES-256 encrypted with a session-derived key, or sessionStorage only) | Weaker — acceptable for internal team tool with no external exposure |

Never store PATs in plain config files. Never log them. Redact from error reports.

On first launch: prompt for both PATs (Jira URL + PAT, GitLab URL + PAT), validate by making a test API call (e.g., `GET /rest/api/2/myself` on Jira, `GET /api/v4/user` on GitLab), then persist.

---

## Notification Delivery

**Two channels, unified source of truth:**

1. **OS native notifications** — triggered by the Notification Engine when new activity is detected. On desktop: use the platform's native notification API (Electron `Notification`, Tauri `tauri-plugin-notification`). On web: use the Web Notifications API (requires user permission grant on first run).

2. **In-app notification hub** — a persistent list of all notifications with read/unread state. Stored in State Layer (memory) + last-seen cursors in Persistence Layer. Survives page navigation but resets on app restart unless persisted to local storage.

**Deduplication:** Assign a stable ID to each notification event (`jira-comment-{commentId}`, `gitlab-note-{noteId}`). Check against seen-IDs set before dispatching OS notification. This prevents duplicate pings on repeated polls.

**Badge count:** Unread notification count shown in app header and (on desktop) in dock/taskbar badge. Clear on notification hub open.

---

## Patterns to Follow

### Pattern 1: Repository per API Domain

Isolate all Jira calls in a `JiraRepository` module and all GitLab calls in a `GitLabRepository` module. Neither the UI nor the state layer imports raw `fetch`/`axios` — only these repositories do. This makes API changes (e.g., migrating to Jira Cloud someday) a single-file change.

```typescript
// src/api/jira/repository.ts
export const jiraRepository = {
  getMyIssues: (params) => jiraClient.get('/rest/api/2/search', { jql: `assignee = currentUser() AND sprint in openSprints()` }),
  transitionIssue: (issueKey, transitionId) => jiraClient.post(`/rest/api/2/issue/${issueKey}/transitions`, { transition: { id: transitionId } }),
  addComment: (issueKey, body) => jiraClient.post(`/rest/api/2/issue/${issueKey}/comment`, { body }),
  // ...
}
```

### Pattern 2: Optimistic UI for Write Actions

When a user performs an action (e.g., move task to "Done"), update the local state immediately and show the new state in the UI, then fire the API call. On failure, revert the state and show an error. This makes the app feel fast on slow on-prem Jira instances.

### Pattern 3: Cursor-Based Incremental Polling

Never fetch all issues on every poll. Use timestamps or pagination cursors:

```
// Jira: JQL with updatedDate filter
GET /rest/api/2/search?jql=project=PROJ AND updatedDate > "2026-03-10 12:00" ORDER BY updated DESC

// GitLab: updated_after parameter
GET /api/v4/projects/:id/merge_requests?updated_after=2026-03-10T12:00:00Z
```

Store `lastPolledAt` timestamp in Persistence Layer. Update after each successful poll.

### Pattern 4: Unified Data Model (Adapter Layer)

Both Jira and GitLab return different response shapes. Normalize them at the API client boundary into a shared internal model before passing to the State Layer. UI components never deal with raw API responses.

```typescript
// Internal models — not Jira/GitLab shapes
interface Task { id: string; title: string; status: string; assignee: string; linkedMRs: MR[] }
interface MR   { id: string; title: string; state: string; linkedTaskKey: string | null }
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching in Components

**What:** React components calling the Jira/GitLab API directly (e.g., `useEffect` with `fetch` inside a component).
**Why bad:** Polling logic scattered everywhere, no deduplication, cache invalidation impossible, every re-render triggers API calls.
**Instead:** All fetching goes through the State Layer (TanStack Query or similar). Components only read from cache.

### Anti-Pattern 2: Re-fetching Full Lists on Every Poll

**What:** `GET /rest/api/2/search?jql=project=PROJ` (all issues) every 60 seconds.
**Why bad:** Slow on large projects, hammers the Jira instance, wastes bandwidth.
**Instead:** Use `updatedDate >` JQL filter and merge diffs into cache.

### Anti-Pattern 3: Storing PATs in App State / Component State

**What:** Keeping PATs in a React context or Zustand store accessible to the entire component tree.
**Why bad:** Any component can accidentally log or expose them. Vulnerable to accidental serialization (e.g., Redux DevTools, error reporting SDKs).
**Instead:** PATs live only in the API client modules. Pass through once on initialization, never re-expose.

### Anti-Pattern 4: Tight Coupling of Jira and GitLab Fetches

**What:** A single "load dashboard" function that calls Jira AND GitLab in sequence, fails entirely if either times out.
**Why bad:** Jira on-prem can be slow. GitLab timeout should not block the MR panel from rendering.
**Instead:** Fetch Jira and GitLab data independently, in parallel, with independent loading/error states per panel.

### Anti-Pattern 5: Greedy Commit Scanning for Ticket Links

**What:** Fetching all commits for every open MR to scan for ticket IDs on every poll.
**Why bad:** GitLab commit list API is paginated and expensive. MRs can have hundreds of commits.
**Instead:** Scan MR title only first (fast, one field). Scan MR description second. Only fall back to commits if the MR title has no ticket ID and the MR is authored by the current user (reducing scope).

---

## Scalability Considerations

This app is explicitly scoped to one Jira project + one GitLab group. Scalability here means "works smoothly as the project grows" not "handles 1000 teams."

| Concern | At current scale (1 project) | If scale grows |
|---------|-------------------------------|----------------|
| API rate limits | GitLab: well within 2000 req/min. Jira: no limit documented | Add exponential backoff; reduce polling frequency |
| Cache size | Hundreds of issues/MRs — fine in memory | Add LRU eviction if issue count exceeds ~5000 |
| Notification volume | Low — a team of ~10 devs | Already cursor-based; no changes needed |
| Linking engine | O(n) scan of open MRs against issue cache | Already bounded by single project scope |

---

## Suggested Build Order

Build order follows **data dependency**: you cannot render a dashboard until you can fetch data; you cannot link tasks to MRs until you have both; you cannot notify until you have a polling loop.

```
Phase 1: Foundation
  ├─► Persistence Layer — PAT storage and retrieval
  ├─► API Client Layer — Jira + GitLab clients with auth headers
  └─► Settings / onboarding screen — PAT entry + validation

Phase 2: Core Data
  ├─► Jira repository: issues, sprint, transitions
  ├─► GitLab repository: MRs, approvals
  └─► Unified data models (adapter layer)

Phase 3: Developer Dashboard
  ├─► State Layer: initial fetch + caching (TanStack Query or Zustand)
  ├─► Dev dashboard UI: my tasks, sprint board, MR panel
  └─► Write actions: status transitions, comments, MR approvals

Phase 4: Task-MR Linking
  ├─► Linking Engine: ticket ID extraction regex
  ├─► Cross-entity join in state (issues ↔ MRs)
  └─► Linked MR chips on task cards; linked task badge on MR rows

Phase 5: Notifications
  ├─► Polling loop (foreground + background intervals)
  ├─► Notification Engine: diff detection + deduplication
  ├─► In-app notification hub
  └─► OS notification dispatch

Phase 6: PM Dashboard + Releases View
  ├─► PM-specific data: team workload, sprint velocity proxy (open/closed ratio)
  ├─► Releases view: fix versions ↔ GitLab milestones/tags
  └─► Role-based routing (dev vs PM view)

Phase 7: Polish
  ├─► Global search (Jira JQL + GitLab search API)
  ├─► Dark/light mode persistence
  └─► Error states, loading skeletons, retry logic
```

**Key dependency constraints:**
- Phase 1 must complete before any API calls are possible.
- Phase 2 (data models) must be stable before Phase 3 UI is built — changing the internal model mid-UI is expensive.
- Phase 4 (linking) requires both Jira issues and GitLab MRs to be in cache — must follow Phase 2.
- Phase 5 (notifications) requires the polling infrastructure — build after the initial fetch pattern is proven in Phase 3.
- Phase 6 is additive — can start after Phase 3 without blocking.

---

## Sources

- Jira REST API v2 documentation: https://developer.atlassian.com/server/jira/platform/rest-apis/
- GitLab REST API documentation: https://docs.gitlab.com/ee/api/rest/
- Architecture patterns derived from well-established client-only dashboard apps (Linear, Refined GitHub, etc.) — HIGH confidence based on domain knowledge of this class of application.
- PAT storage patterns: OS keychain integration is the standard for Electron/Tauri desktop apps — HIGH confidence.
- Polling vs webhook rationale: direct consequence of client-only constraint + on-prem Jira limitations — HIGH confidence.
