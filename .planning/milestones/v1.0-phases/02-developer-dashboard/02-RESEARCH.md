# Phase 2: Developer Dashboard - Research

**Researched:** 2026-03-11
**Domain:** TanStack Query v5 polling, Jira Server REST v2 + Agile REST, GitLab REST v4, Base UI components, Zustand store extension
**Confidence:** HIGH (core APIs verified against official docs; two areas are MEDIUM — see Pitfalls)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three tabs at the top of the main content area: **My Tasks | Sprint Board | MR Attention**
- Sidebar keeps a single 'Dashboard' nav entry (no sub-items)
- Default tab on open: **My Tasks**
- Each tab has its own last-refreshed timestamp + manual refresh button in the **top-right corner** of the content area (per-tab, independent refresh state)
- Sprint board columns: show **all Jira workflow statuses as columns** (one column per distinct status found in the current sprint)
- Board scrolls horizontally when there are more columns than fit the viewport
- Sprint board cards are **compact**: Jira key + task summary + assignee avatar + MR health badge (colored dot icon)
- No story points, no status badge on board cards (status is implied by the column)
- My Tasks list is **richer**: key | summary | status badge | assignee | story points | linked MR chips
- MR chip format: `[MR !42 🟡]` — MR number + review health badge; tasks with no linked MR show `[— no MR]`
- **Status transitions (JACT-01)**: click the status badge on any My Tasks row → inline popover with available workflow transitions fetched per-issue at runtime → select to update optimistically
- **Add comment (JACT-02)**: click comment icon on a My Tasks row → textarea expands inline below that row → Submit / Cancel
- **Write actions are only in My Tasks list** — sprint board cards are read-only
- **Error handling**: on API failure, revert optimistic update immediately + show inline error message on that specific card/row ("Failed to update — try again"); no toast, no modal
- MR Attention list shows MRs **assigned to the developer** or where they are a **reviewer with open threads**
- Stale MRs flagged with an **amber badge showing age**: `🟠 Stale•5d`
- Stale threshold default: **3 days** of no activity
- Stale threshold is **configurable in the Settings page** (user sets it once, applies globally)

### Claude's Discretion
- Exact MR health badge color mapping (waiting for review / approved / changes requested)
- Loading skeleton design for each tab
- Empty state illustrations and copy for no-tasks / no-MRs
- Column min-width and scroll behavior for the sprint board
- Exact typography, spacing, and Tailwind classes

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEV-01 | Developer sees a list of their open Jira tasks filtered to the current sprint | Jira Agile REST `/rest/agile/1.0/board/{id}/sprint` → active sprint → `/rest/agile/1.0/sprint/{id}/issue?jql=assignee=currentUser() AND resolution=Unresolved` |
| DEV-02 | Developer sees a sprint board with tasks grouped by workflow status (columns per status) | Same sprint issue set; derive column list from `issue.fields.status.name`; group in-memory; no extra API call needed |
| DEV-03 | Developer sees a list of GitLab MRs assigned to them or where they are a reviewer with open threads | `GET /api/v4/merge_requests?scope=assigned_to_me&state=opened` + `GET /api/v4/merge_requests?reviewer_id={userId}&state=opened`; filter reviewer MRs by discussion thread count |
| DEV-04 | Sprint board cards show an MR review health badge derived from linked MRs | Computed from task-MR link (LINK-01/02) + GitLab approval state; approval state inferred from `approved_by` list or `detailed_merge_status` |
| DEV-05 | MRs with no activity for a configurable number of days are flagged as stale | Compare `updated_at` on MR object against `staleMrThresholdDays` from settings store; pure client-side calculation |
| LINK-01 | Automatically links Jira tasks to GitLab MRs by parsing the Jira ticket key from MR title | Regex `[A-Z]+-\d+` applied to `merge_request.title`; matched keys looked up in sprint issue cache |
| LINK-02 | Falls back to scanning commit messages when ticket key is absent from MR title | `GET /api/v4/projects/{id}/merge_requests/{iid}/commits`; apply same regex to each commit title |
| LINK-03 | Linked MRs are displayed on the task card (title, status, author) | Client-side join; MR data already fetched for DEV-03 |
| LINK-04 | Linked Jira task is displayed on the MR card (key, summary, status) | Client-side join; Jira data already fetched for DEV-01 |
| JACT-01 | User can update a Jira task's status by selecting from available workflow transitions | `GET /rest/api/2/issue/{key}/transitions` at popover open; `POST /rest/api/2/issue/{key}/transitions` with `{"transition":{"id":"..."}}` |
| JACT-02 | User can add a comment to a Jira task from the app | `POST /rest/api/2/issue/{key}/comment` with `{"body":"..."}` |
| UI-02 | App shows last-refreshed timestamp on all data views | TanStack Query `dataUpdatedAt` field on query result; format as "Updated X min ago" |
| UI-03 | App shows a loading state during API calls and a meaningful error message on failure | TanStack Query `isLoading`, `isError`, `error.message`; skeleton components during load; inline error string on failure |
</phase_requirements>

---

## Summary

Phase 2 builds on the Phase 1 Tauri + React + Zustand + TanStack Query foundation and adds three major concerns: (1) fetching and displaying Jira sprint data via two API layers (standard REST v2 + Jira Agile REST), (2) fetching GitLab MR data and computing review health through a combination of the MR endpoint and the approvals endpoint, and (3) linking MRs to tasks via regex on MR titles with a commit-message fallback. All three concern areas are independent but converge in a client-side join at render time.

The most critical architecture decision is the **two-API Jira strategy**: sprint membership lives in the Jira Agile REST API (`/rest/agile/1.0/`), not in the standard REST v2 (`/rest/api/2/`). The board ID must be discovered first, then the active sprint ID, then the sprint issues. This is a three-hop fetch sequence. The standard search API (`/rest/api/2/search?jql=sprint in openSprints()`) provides a simpler single-hop alternative that avoids board ID discovery at the cost of returning issues across all active sprints, not just the selected board's sprint. Given the app targets a single active Jira project, the JQL approach is preferable.

GitLab review state ("approved" / "changes requested" / "waiting") is **not a first-class field** on the MR object. The `reviewers[]` array exposes only account `state` (active/blocked), not review outcome. The approvals endpoint `GET /projects/{id}/merge_requests/{iid}/approvals` provides `approved_by` (array of users who approved) and `user_has_approved` (bool), which is sufficient to determine "approved" vs "not yet approved." True "changes requested" state is not a structured API field — it must be inferred from unresolved reviewer discussion threads.

**Primary recommendation:** Use JQL `sprint in openSprints() AND project = {key} AND assignee = currentUser() AND resolution = Unresolved` via `/rest/api/2/search` for sprint tasks (simpler than board/sprint ID hops), derive sprint board columns from distinct status values in the result set, and use the GitLab `approved_by` array + unresolved discussion count to compute a three-state review health badge.

---

## Standard Stack

### Core (already installed — verified from package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 | Data fetching, caching, polling, optimistic updates | Already installed Phase 1; only query library with built-in polling coordinator |
| `@tauri-apps/plugin-http` | ^2.5.7 | All outbound HTTP calls — CORS bypass via Rust backend | Required for on-premise Jira/GitLab; confirmed pattern from Phase 1 |
| `zustand` | ^5.0.11 | Settings store extension (staleMrThresholdDays, dashboard active tab) | Already installed; existing stores use this pattern |
| `@base-ui/react` | ^1.2.0 | Popover (status transition picker), Tabs (dashboard tabs) | Already installed; tabs.tsx uses it; Popover is the missing component needed |
| `lucide-react` | ^0.577.0 | Icons (comment icon, refresh icon, stale badge, health dot) | Already installed in Phase 1 |
| `tailwind-merge` + `clsx` | ^3.5.0 / ^2.1.1 | Conditional class composition | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | ^0.7.1 | Variant-aware component styling | Badge variants (health states, stale indicator) |

### What Does NOT Need Installing
Everything needed is already in `package.json`. No new `npm install` steps required for Phase 2.

---

## Architecture Patterns

### Recommended Project Structure

```
taskflow/src/
├── services/
│   ├── jira.ts                    # EXTEND: add fetchSprintIssues, fetchTransitions, postTransition, postComment
│   ├── gitlab.ts                  # EXTEND: add fetchAssignedMRs, fetchReviewerMRs, fetchMRCommits, fetchMRApprovals, fetchMRDiscussions
│   └── linkEngine.ts              # NEW: ticket key extraction, task-MR join, review health derivation
├── stores/
│   ├── settings.store.ts          # EXTEND: add staleMrThresholdDays field
│   └── dashboard.store.ts         # NEW: activeTab, per-tab lastRefreshed timestamps
├── routes/
│   └── dashboard/
│       ├── index.tsx              # REPLACE placeholder with DashboardPage (tabs layout)
│       ├── MyTasksTab.tsx         # My Tasks list — rich cards + write actions
│       ├── SprintBoardTab.tsx     # Sprint board — horizontal scroll columns
│       ├── MrAttentionTab.tsx     # MR Attention list — stale badges, linked task
│       ├── TaskRow.tsx            # Single task row (My Tasks)
│       ├── TaskCard.tsx           # Single task card (Sprint Board)
│       ├── MrRow.tsx              # Single MR row (MR Attention)
│       ├── StatusPopover.tsx      # Transition picker popover (JACT-01)
│       └── InlineComment.tsx      # Inline comment expand (JACT-02)
└── components/ui/
    ├── tabs.tsx                   # EXISTING — use as-is
    ├── button.tsx                 # EXISTING — use as-is
    ├── select.tsx                 # EXISTING — use as-is
    └── popover.tsx                # NEW — wrap Base UI Popover (same pattern as tabs.tsx)
```

### Pattern 1: TanStack Query Polling Coordinator

Each tab has a `useQuery` with `refetchInterval`. A single QueryClient (already configured in Phase 1's `main.tsx`) coordinates all queries. Minimum poll interval: 60 seconds (from STATE.md architecture decision).

```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
const { data: issues, dataUpdatedAt, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['sprint-issues', activeJiraProject],
  queryFn: () => fetchSprintIssues(jiraBaseUrl, token, activeJiraProject),
  refetchInterval: 60_000,           // 60s background poll — minimum per STATE.md
  refetchIntervalInBackground: true, // continue when tab is not focused
  staleTime: 30_000,                 // data fresh for 30s — prevents unnecessary refetch on tab switch
  enabled: !!activeJiraProject && !!jiraBaseUrl,
});
// dataUpdatedAt is a timestamp (ms) — use for "Last refreshed X min ago" (UI-02)
```

**Per-tab independent refresh:** Each tab uses its own `useQuery`. Tabs not currently visible still poll (background refresh) but their `refetch()` is not called from the UI. The manual refresh button calls `refetch()` explicitly.

### Pattern 2: Three-State Review Health Badge

```typescript
// Source: GitLab API docs (https://docs.gitlab.com/api/merge_request_approvals/)
// Source: GitLab Discussions API (https://docs.gitlab.com/api/discussions/)
type ReviewHealth = 'approved' | 'changes_requested' | 'waiting_for_review';

function deriveReviewHealth(
  mr: GitLabMR,
  approvals: MRApprovals,     // from GET /projects/{id}/merge_requests/{iid}/approvals
  discussions: Discussion[],   // from GET /projects/{id}/merge_requests/{iid}/discussions
): ReviewHealth {
  if (approvals.approved_by.length > 0) return 'approved';
  // "changes_requested" = reviewer has unresolved threads (no native API field)
  const hasUnresolved = discussions.some(d =>
    d.notes.some(n => n.resolvable && !n.resolved)
  );
  if (hasUnresolved) return 'changes_requested';
  return 'waiting_for_review';
}
```

**Recommended badge colors (Claude's discretion):**
- `approved` → green dot (Tailwind `bg-green-500`)
- `changes_requested` → red dot (`bg-red-500`)
- `waiting_for_review` → yellow dot (`bg-yellow-400`)

### Pattern 3: Optimistic Status Transition (JACT-01)

```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
const { mutate: updateStatus } = useMutation({
  mutationFn: ({ issueKey, transitionId }: TransitionArgs) =>
    postTransition(jiraBaseUrl, token, issueKey, transitionId),

  onMutate: async ({ issueKey, transitionId }) => {
    // 1. Cancel in-flight refetches
    await queryClient.cancelQueries({ queryKey: ['sprint-issues', activeJiraProject] });
    // 2. Snapshot
    const previousIssues = queryClient.getQueryData(['sprint-issues', activeJiraProject]);
    // 3. Apply optimistic update
    queryClient.setQueryData(['sprint-issues', activeJiraProject], (old: JiraIssue[]) =>
      old.map(issue =>
        issue.key === issueKey
          ? { ...issue, fields: { ...issue.fields, status: { name: targetStatusName } } }
          : issue
      )
    );
    return { previousIssues };
  },

  onError: (_err, { issueKey }, context) => {
    // Rollback
    queryClient.setQueryData(['sprint-issues', activeJiraProject], context?.previousIssues);
    setInlineError(issueKey, 'Failed to update — try again');
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['sprint-issues', activeJiraProject] });
  },
});
```

### Pattern 4: Ticket Key Regex Linking Engine

```typescript
// LINK-01: Extract ticket keys from MR title
const TICKET_KEY_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

function extractTicketKeys(text: string): string[] {
  return [...text.matchAll(TICKET_KEY_REGEX)].map(m => m[1]);
}

// LINK-01: Title scan first
function linkMRToTask(mr: GitLabMR, sprintIssueKeys: Set<string>): string | null {
  for (const key of extractTicketKeys(mr.title)) {
    if (sprintIssueKeys.has(key)) return key;
  }
  return null;
}

// LINK-02: Fallback — scan commit messages (only if title scan fails)
async function linkMRToTaskViaCommits(
  mr: GitLabMR,
  sprintIssueKeys: Set<string>,
  gitlabBaseUrl: string,
  token: string,
): Promise<string | null> {
  const commits = await fetchMRCommits(gitlabBaseUrl, token, mr.project_id, mr.iid);
  for (const commit of commits) {
    for (const key of extractTicketKeys(commit.title)) {
      if (sprintIssueKeys.has(key)) return key;
    }
  }
  return null;
}
```

### Pattern 5: Base UI Popover for Status Transition Picker

```typescript
// Source: https://base-ui.com/react/components/popover
import { Popover } from '@base-ui/react/popover';

// StatusPopover.tsx — wraps Base UI Popover (same pattern as tabs.tsx wraps TabsPrimitive)
function StatusPopover({ issueKey, currentStatus, transitions, onSelect }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <StatusBadge status={currentStatus} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="rounded-lg border border-border bg-background p-1 shadow-lg">
            {transitions.map(t => (
              <button key={t.id} onClick={() => onSelect(t.id, t.to.name)}>
                → {t.name}
              </button>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

### Pattern 6: Jira API — Sprint Issues via JQL

Two approaches exist. Use the **JQL search approach** — simpler, avoids board ID discovery.

```typescript
// GET /rest/api/2/search
// JQL: project = {KEY} AND sprint in openSprints() AND assignee = currentUser() AND resolution = Unresolved
// Source: https://community.atlassian.com/forums/Jira-questions/REST-API-for-issues-under-current-sprint/qaq-p/2576113

async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraIssue[]> {
  const jql = `project = ${projectKey} AND sprint in openSprints() AND assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`;
  const fields = 'summary,status,assignee,story_points,priority,issuetype';
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${fields}`;
  // ... fetch with Bearer token, tauri-plugin-http, pagination via startAt
}
```

**For Sprint Board (DEV-02):** Use the same query but WITHOUT the `assignee = currentUser()` filter to get all sprint issues. Derive columns from distinct `issue.fields.status.name` values in the result.

### Pattern 7: Jira Transitions Endpoints

```typescript
// GET per-issue transitions (lazy — only fetch when popover opens)
// GET /rest/api/2/issue/{key}/transitions
// Response: { transitions: [{ id: "21", name: "In Review", to: { name: "In Review" } }] }

// POST to execute a transition
// POST /rest/api/2/issue/{key}/transitions
// Body: { "transition": { "id": "21" } }
// Response: 204 No Content on success
```

### Pattern 8: GitLab MR Fetch Strategy

```typescript
// GET /api/v4/merge_requests?scope=assigned_to_me&state=opened
// GET /api/v4/merge_requests?reviewer_id={currentUserId}&state=opened&state=opened

// Merge and deduplicate by MR iid
// Filter reviewer MRs to only those where reviewer has open (unresolved) threads:
//   GET /api/v4/projects/{project_id}/merge_requests/{iid}/discussions
//   Keep MR if any discussion.notes[].resolvable && !discussion.notes[].resolved

// Stale check — pure client side:
const isStale = (mr: GitLabMR, thresholdDays: number): boolean => {
  const msPerDay = 86_400_000;
  return Date.now() - new Date(mr.updated_at).getTime() > thresholdDays * msPerDay;
};
```

### Anti-Patterns to Avoid

- **Using board-ID-based sprint discovery for My Tasks:** `GET /rest/agile/1.0/board?projectKeyOrId=X` → find board → get active sprint → get issues is three round trips. The JQL `openSprints()` approach does it in one. Use JQL.
- **Caching per-issue transitions globally:** Transitions are per-issue and change when the issue moves status. Only fetch when the popover opens for that specific issue; do NOT cache in a global store.
- **Mutating TanStack Query cache data in-place:** The optimistic update must use `setQueryData` with a new array/object, never mutating the cached object reference. In-place mutation breaks React rendering and cache integrity.
- **Using `Authorization: Bearer` for GitLab:** GitLab uses `PRIVATE-TOKEN` header. Bearer auth works for OAuth tokens, not PATs. (Pattern confirmed in Phase 1 gitlab.ts.)
- **Polling at less than 60s:** STATE.md locks minimum background poll at 60s. Phase 3 notifications (30s critical) will add a second coordinator. Do not reuse Phase 2 queries for notification polling.
- **Fetching MR approvals eagerly for all MRs:** Fetching `approvals` and `discussions` for every MR on load is O(N) extra requests. Only fetch these for MRs in the attention list (already filtered). For the linking health badge on task cards, derive from the linked MR's data already fetched.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data caching and stale-while-revalidate | Custom cache object | TanStack Query `useQuery` with `staleTime` | Race conditions, memory leaks, no deduplication |
| Polling with pause on tab hide | `setInterval` in useEffect | TanStack Query `refetchInterval` + `refetchIntervalInBackground` | Handles visibility API, unmount cleanup, exponential backoff |
| Optimistic updates with rollback | Manual state snapshot | TanStack Query `onMutate` / `onError` context pattern | Concurrency safety, in-flight cancellation |
| Accessible floating popover | Custom positioned div | Base UI `Popover` | Focus trapping, keyboard navigation, positioning against viewport edge |
| Date formatting for "last refreshed" | Custom date math | `Intl.RelativeTimeFormat` or simple arithmetic on `dataUpdatedAt` | Handles locale, no extra dependency |
| Ticket key regex | Loose string search | `\b([A-Z][A-Z0-9]+-\d+)\b` with word boundary | Prevents false positives like "FEAT-1" matching inside "PREFIX-FEAT-1" |

**Key insight:** The linking engine is custom (no library does Jira-GitLab key matching), but the underlying pieces (regex, cache join) are trivial. The complexity is in the fetch orchestration, which TanStack Query handles.

---

## Common Pitfalls

### Pitfall 1: `openSprints()` JQL function may require Jira Software license
**What goes wrong:** Some Jira Server configurations have the Agile/Software module as a separate add-on. `openSprints()` is a JQL function provided by Jira Software. If the instance only has Jira Core, the JQL call returns a 400 with "Function not supported."
**Why it happens:** Jira Server has multiple product tiers; the function is in Jira Software, not Jira Core.
**How to avoid:** Document this in error handling — surface the JQL 400 response as "Sprint filtering unavailable — ensure Jira Software is installed" rather than a generic API error.
**Warning signs:** 400 response from `/rest/api/2/search` with message containing "function" or "not recognized."

### Pitfall 2: GitLab review state is not a first-class field
**What goes wrong:** Code tries to read `reviewer.review_state` or `mr.review_status` — these fields do not exist. The `reviewers[]` array only has user account `state` (active/blocked), not review outcome.
**Why it happens:** GitLab's UI shows "changes requested" but the API does not surface this as a structured field on the MR object.
**How to avoid:** Use the two-step approach: `GET .../approvals` for `approved_by` (approved state), then `GET .../discussions` + check `resolved` fields (changes_requested heuristic). Accept that "changes requested" is inferred, not authoritative.
**Warning signs:** `reviewers[n].state` is always `"active"` — that field means account status, not review outcome.

### Pitfall 3: `currentUser()` JQL function returns the authenticated API user
**What goes wrong:** `currentUser()` in JQL resolves to the PAT owner. This is correct behavior — but if the user enters someone else's PAT during onboarding, the My Tasks list will show that person's tasks.
**Why it happens:** Jira Server JQL `currentUser()` resolves to the token's owner identity.
**How to avoid:** Document this as expected behavior. The JiraUser fetched during onboarding (`GET /rest/api/2/myself`) is the person whose tasks appear. No workaround needed — this is correct for the use case.
**Warning signs:** N/A — this is correct behavior, not a bug.

### Pitfall 4: TanStack Query cache key collisions between tabs
**What goes wrong:** `useQuery({ queryKey: ['sprint-issues'] })` in two different components creates one shared query. If Sprint Board uses all-issues and My Tasks uses assignee-filtered issues, they must have different query keys.
**Why it happens:** TanStack Query deduplicates by query key. Same key = same cache entry.
**How to avoid:** Include the filter parameters in the query key:
  - My Tasks: `['jira-issues', 'my-tasks', projectKey]`
  - Sprint Board: `['jira-issues', 'sprint-board', projectKey]`
**Warning signs:** Changing a filter in one tab affects data in another tab.

### Pitfall 5: Stale MR threshold comparison timezone issues
**What goes wrong:** Comparing `mr.updated_at` (ISO 8601 UTC from GitLab) against `Date.now()` (local ms). If done incorrectly (string comparison, wrong parse), stale detection fails.
**Why it happens:** `updated_at` is a string — it must be parsed via `new Date(mr.updated_at).getTime()` before arithmetic.
**How to avoid:** Always parse with `new Date()` constructor before numeric comparison. `Date.now() - new Date(mr.updated_at).getTime() > thresholdDays * 86_400_000`.

### Pitfall 6: Commit scan for LINK-02 is N extra API calls
**What goes wrong:** Fetching commits for every MR at load time when title scan would have found the link.
**Why it happens:** Eager loading of commit data.
**How to avoid:** Apply commit scan lazily — only for MRs where title scan returned no match. Order: title scan first (synchronous, no API call), commits only on miss (one extra API call per unlinked MR).

### Pitfall 7: `dataUpdatedAt` is in milliseconds since epoch, not a human string
**What goes wrong:** Displaying raw `dataUpdatedAt` number as the timestamp.
**Why it happens:** TanStack Query's `dataUpdatedAt` field is a Unix timestamp in ms.
**How to avoid:**
  ```typescript
  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : 'Never';
  ```

---

## Code Examples

### Jira Sprint Issues Fetch (DEV-01)

```typescript
// services/jira.ts extension
// Source: Jira Server REST API v2 — https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { id: string; name: string };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    story_points: number | null;   // customfield_10016 on most instances
    issuetype: { name: string };
  };
}

export async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = true,
): Promise<JiraIssue[]> {
  const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';
  const jql = `project = ${projectKey} AND sprint in openSprints()${assigneeClause} AND resolution = Unresolved ORDER BY updated DESC`;
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/search`;
  const response = await fetch(`${url}?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,status,assignee,story_points,issuetype`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });
  if (!response.ok) throw new Error(`Jira search failed: ${response.status}`);
  const data = await response.json();
  return data.issues as JiraIssue[];
}
```

### Jira Transitions (JACT-01)

```typescript
// Source: https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
export interface JiraTransition {
  id: string;
  name: string;
  to: { id: string; name: string };
}

export async function fetchTransitions(baseUrl: string, token: string, issueKey: string): Promise<JiraTransition[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });
  if (!response.ok) throw new Error(`Transitions fetch failed: ${response.status}`);
  const data = await response.json();
  return data.transitions as JiraTransition[];
}

export async function postTransition(baseUrl: string, token: string, issueKey: string, transitionId: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: transitionId } }),
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });
  if (response.status !== 204) throw new Error(`Transition failed: ${response.status}`);
}
```

### Add Comment (JACT-02)

```typescript
// Source: https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
// POST /rest/api/2/issue/{key}/comment — body: { "body": "..." }
// Response: 201 Created with full comment object
export async function postComment(baseUrl: string, token: string, issueKey: string, body: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });
  if (response.status !== 201) throw new Error(`Comment failed: ${response.status}`);
}
```

### GitLab MR Fetch (DEV-03)

```typescript
// services/gitlab.ts extension
// Source: https://docs.gitlab.com/api/merge_requests/
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  author: { id: number; name: string; username: string; avatar_url: string };
  reviewers: Array<{ id: number; name: string; username: string }>;
  updated_at: string;   // ISO 8601 UTC
  web_url: string;
}

export async function fetchAssignedMRs(baseUrl: string, token: string): Promise<GitLabMR[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/merge_requests?scope=assigned_to_me&state=opened&per_page=100`;
  const response = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token },
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });
  if (!response.ok) throw new Error(`GitLab MR fetch failed: ${response.status}`);
  return response.json() as Promise<GitLabMR[]>;
}

export async function fetchReviewerMRs(baseUrl: string, token: string, userId: number): Promise<GitLabMR[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/merge_requests?reviewer_id=${userId}&state=opened&per_page=100`;
  const response = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token },
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });
  if (!response.ok) throw new Error(`GitLab reviewer MR fetch failed: ${response.status}`);
  return response.json() as Promise<GitLabMR[]>;
}
```

### Dashboard Store Extension

```typescript
// stores/settings.store.ts — add staleMrThresholdDays
// (extend the existing SettingsState interface and persist slice)
interface SettingsState {
  // ... existing fields ...
  staleMrThresholdDays: number;  // default: 3
  setStaleMrThresholdDays: (days: number) => void;
}

// stores/dashboard.store.ts — NEW (ephemeral, not persisted)
import { create } from 'zustand';

type DashTab = 'my-tasks' | 'sprint-board' | 'mr-attention';
interface DashboardState {
  activeTab: DashTab;
  setActiveTab: (tab: DashTab) => void;
}
export const useDashboardStore = create<DashboardState>()((set) => ({
  activeTab: 'my-tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jira REST v2 `startAt` pagination | Still valid for Jira Server/DC | Never changed for Server (Cloud moved to `nextPageToken`) | Use `startAt` + `maxResults` for Server |
| Radix UI for accessible primitives | Base UI (from same team, redesigned) | 2024 | Project already uses `@base-ui/react`; do not use Radix |
| `cacheTime` in TanStack Query v4 | `gcTime` in v5 | v5.0 (2023) | Use `gcTime` — `cacheTime` is deprecated |
| TanStack Query v4 `isLoading` only | v5 adds `isPending` distinction | v5.0 | `isLoading = isPending && isFetching`; use `isPending` for "no data yet" |
| `Authorization: Bearer` for Jira PAT | Bearer confirmed for Jira Server 8.14+ | Phase 1 decision | Existing jira.ts pattern is correct; Phase 2 extends it |

**Deprecated/outdated:**
- Jira Agile REST board discovery for sprint tasks: still works but unnecessary for single-project use case; JQL `openSprints()` is simpler
- GitLab `scope=created_by_me` default: must explicitly pass `scope=assigned_to_me` — the default creates confusion

---

## Open Questions

1. **Jira story points custom field name**
   - What we know: Story points are stored as a custom field (commonly `customfield_10016`) — the field name varies per Jira instance configuration
   - What's unclear: The exact field key for this specific Jira Server instance
   - Recommendation: Fetch `fields=*all` on one issue during development, identify the story points field, then hardcode or make configurable. As a fallback, try `story_points` and `customfield_10016`.

2. **GitLab user ID for `reviewer_id` filter**
   - What we know: `GET /api/v4/user` returns the authenticated user's `id` field (fetched during Phase 1 validation and stored in auth store as `GitLabUser.id`)
   - What's unclear: Whether `auth.store.ts` stores the user ID or only the connection boolean
   - Recommendation: Auth store currently stores only `jiraConnected`, `gitlabConnected`, URLs, and project/group strings. The Phase 2 API client layer must read the stored GitLab token, call `GET /api/v4/user`, and cache the user ID via TanStack Query (not in Zustand — it's dynamic auth data).

3. **Jira Server Bearer auth fallback for pre-8.14**
   - What we know: STATE.md notes "Must validate Jira Server auth header format (Bearer vs Basic) against actual on-premise instance before writing polling interceptor"
   - What's unclear: Whether the target instance is pre- or post-8.14
   - Recommendation: The Phase 2 plan should include a task to test against the real instance. If Bearer fails (401), implement Basic auth with empty username: `btoa(':' + token)`. Add an `authStrategy: 'bearer' | 'basic'` parameter to service functions.

4. **GitLab self-hosted rate limits**
   - What we know: STATE.md flags this as a concern; default poll is 60s minimum
   - What's unclear: The specific instance's rate limit configuration
   - Recommendation: At 60s polling with ~5 API calls per refresh cycle (MR list, discussions, approvals, commits for unlinked MRs), worst case is ~300 req/hour well under standard limits. Monitor in development but no pre-emptive throttling needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEV-01 | `fetchSprintIssues` returns issues for active sprint | unit | `npx vitest run src/services/jira.test.ts -t "sprint"` | ❌ Wave 0 |
| DEV-02 | Sprint board columns derived from distinct status values | unit | `npx vitest run src/services/linkEngine.test.ts -t "columns"` | ❌ Wave 0 |
| DEV-03 | `fetchAssignedMRs` and `fetchReviewerMRs` return MR arrays | unit | `npx vitest run src/services/gitlab.test.ts -t "MR"` | ❌ Wave 0 |
| DEV-04 | `deriveReviewHealth` returns correct badge state | unit | `npx vitest run src/services/linkEngine.test.ts -t "health"` | ❌ Wave 0 |
| DEV-05 | Stale detection based on `updated_at` and threshold | unit | `npx vitest run src/services/linkEngine.test.ts -t "stale"` | ❌ Wave 0 |
| LINK-01 | Ticket key regex extracts keys from MR title | unit | `npx vitest run src/services/linkEngine.test.ts -t "regex"` | ❌ Wave 0 |
| LINK-02 | Commit message fallback scan returns correct key | unit | `npx vitest run src/services/linkEngine.test.ts -t "commit"` | ❌ Wave 0 |
| LINK-03 | Task card renders linked MR chips | component | `npx vitest run src/routes/dashboard -t "MR chips"` | ❌ Wave 0 |
| LINK-04 | MR row renders linked task badge | component | `npx vitest run src/routes/dashboard -t "linked task"` | ❌ Wave 0 |
| JACT-01 | Status popover shows transitions; selecting one calls postTransition | component | `npx vitest run src/routes/dashboard -t "transition"` | ❌ Wave 0 |
| JACT-02 | Comment textarea expands; submitting calls postComment | component | `npx vitest run src/routes/dashboard -t "comment"` | ❌ Wave 0 |
| UI-02 | Last-refreshed timestamp renders from `dataUpdatedAt` | component | `npx vitest run src/routes/dashboard -t "refreshed"` | ❌ Wave 0 |
| UI-03 | Loading skeleton renders when `isLoading=true`; error message when `isError=true` | component | `npx vitest run src/routes/dashboard -t "loading\|error"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/services/jira.test.ts` — extend existing file to add DEV-01 tests for `fetchSprintIssues`, `fetchTransitions`, `postTransition`, `postComment`
- [ ] `taskflow/src/services/gitlab.test.ts` — extend existing file to add DEV-03 tests for `fetchAssignedMRs`, `fetchReviewerMRs`, `fetchMRCommits`, `fetchMRApprovals`, `fetchMRDiscussions`
- [ ] `taskflow/src/services/linkEngine.test.ts` — NEW file for LINK-01/02, DEV-02/04/05
- [ ] `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` — component tests for LINK-03, JACT-01, JACT-02, UI-02, UI-03
- [ ] `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` — component tests for LINK-04, DEV-03, DEV-05
- [ ] Test helper: `renderWithQuery` pattern already established in `JiraStep.test.tsx` — copy pattern to dashboard tests

---

## Sources

### Primary (HIGH confidence)
- TanStack Query v5 official docs — useQuery options, refetchInterval, refetchIntervalInBackground, optimistic updates pattern
- GitLab REST API docs (docs.gitlab.com/api/merge_requests/) — scope parameter, reviewer_id, reviewers[] fields
- GitLab Discussions API (docs.gitlab.com/api/discussions/) — `resolved`, `resolvable` fields on discussion notes
- GitLab MR Approvals API (docs.gitlab.com/api/merge_request_approvals/) — `approved_by`, `approved` fields, `GET .../approval_state`
- Jira Agile REST API reference (docs.atlassian.com/jira-software/REST/9.4.9/) — board, sprint, sprint/issue endpoints
- Base UI Popover docs (base-ui.com/react/components/popover) — component API and import path
- Phase 1 source code (taskflow/src/) — verified tauri-plugin-http pattern, auth header patterns, store conventions, Vitest mock patterns

### Secondary (MEDIUM confidence)
- Atlassian developer community — JQL `openSprints()` function, `currentUser()` function, sprint in JQL usage
- Atlassian Jira REST API examples — POST comment body shape, search endpoint response shape

### Tertiary (LOW confidence — flag for validation)
- GitLab "changes requested" inference via discussions: the API does not have a native field; inferring from unresolved threads is community practice, not documented as official pattern. **Validate against actual GitLab instance.**
- Jira story points custom field name: `customfield_10016` is common but not universal. **Validate against target instance.**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in Phase 1; APIs verified against official docs
- Architecture: HIGH — TanStack Query patterns from official docs; Jira/GitLab API shapes verified
- Pitfalls: MEDIUM — review state inference (LOW for changes_requested heuristic), story points field name (LOW) flagged for validation

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days — Jira Server v2 and GitLab v4 are stable APIs; TanStack Query v5 is stable)
