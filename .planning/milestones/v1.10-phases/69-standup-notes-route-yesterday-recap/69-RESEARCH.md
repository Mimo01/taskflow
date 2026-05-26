# Phase 69: Standup Notes — Route + Yesterday Recap - Research

**Researched:** 2026-05-24
**Domain:** React route + multi-source data aggregation (Tempo, Jira, GitLab commits, GitLab MR Events)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Jira activity scope — `activeJiraProject` only. JQL: `project = {activeJiraProject} AND updated >= {yesterdayDate}` (maxResults=50).
- **D-02:** Fetch status transitions + comments, each filtered to entries authored by `jiraUsername` on the last working day. Issues fetched with `expand=changelog`; comments fetched per issue (separate call after JQL result).
- **D-03:** Cap JQL result at 50 issues (maxResults=50).
- **D-04:** MR activity via GitLab User Events API `/api/v4/users/:gitlabUserId/events`. Two event types: `action=commented` (target_type=merge_request) and `action=approved` (target_type=merge_request), each filtered to `after={yesterdayDate}`.
- **D-05:** Merge both MR event types into a single "MR Activity" list. Each entry labeled "Commented on !N" or "Approved !N" with MR title.
- **D-06:** Two-column layout — Yesterday (left) | Today (right), 50/50. Phase 69 builds complete shell; Today column renders as placeholder.
- **D-07:** Yesterday entries grouped by Jira issue. Group header: `[IssueKey] [Summary] [TotalTempoHours right-aligned]`. Sub-items use distinct icons per type.
- **D-08:** Commit grouping fallback: (1) extract Jira key from commit message, (2) from branch name, (3) "Other commits" catch-all.
- **D-09:** MRs not linked to any issue appear as standalone groups (MR IID as heading).
- **D-10:** Summary stat line beneath column heading: `7.5h logged across 3 stories · 7 commits · 2 MR events`.
- **D-11:** Page header: title + date + `synced Xm ago · Refresh` + Copy markdown button (top right, primary style).
- **D-12:** Copy markdown is in scope. Format is planner's discretion.
- **D-13:** Author filter for Git commits: use `gitlabUsername` from auth store as `author` param.
- **D-14:** Git commits project scope and branch resolution: Claude's discretion.
- **D-15:** "Yesterday" = last working day. Monday → Friday. Weekends always skipped. When Tempo enabled, additionally skip public holidays from `fetchUserSchedule()`.

### Claude's Discretion

- Git commits project scope (D-14): researcher/planner decides `activeGitlabProject` only vs. all projects.
- Branch name → Jira key resolution strategy: per-commit `/refs` calls vs. batch branch listing.
- Today placeholder content in Phase 69: static text, skeleton UI, or empty state with Phase 70 note.
- Exact icons for each activity type in sub-items (use Lucide consistent with app).
- Exact markdown format for Copy markdown output.
- Whether "synced Xm ago" timestamp tracks per-section or globally.

### Deferred Ideas (OUT OF SCOPE)

- Today column content (STAND-07, STAND-08, STAND-09) — Phase 70 scope; the Today column shell is built in Phase 69 but content deferred.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAND-01 | New `/standup-notes` route + sidebar entry "Standup Notes" (visible to everyone) | Routes.tsx + sidebar-items.ts + main.tsx routeLabel() patterns documented |
| STAND-02 | "Yesterday" = last working day — Monday shows Friday; weekends skipped; Tempo holidays skipped when enabled | Existing `getLastWorkingDay()` in WorklogsPage.tsx covers weekends only; new `resolveYesterdayDate()` utility needed with Tempo holiday extension |
| STAND-03 | Yesterday recap shows Tempo worklogs (issue key, duration, comment) — empty section when Tempo disabled | `fetchWorklogs()` in tempo/worklogs.ts ready to use; TempoWorklog type documented |
| STAND-04 | Yesterday recap shows Jira changelog activity I authored — status transitions + comments | No existing `fetchYesterdayJiraActivity()` function; needs a new function calling `/rest/api/2/search` with `expand=changelog` + per-issue comment fetch |
| STAND-05 | Yesterday recap shows Git commits I authored on the configured GitLab project | No existing user commit fetch function; needs `fetchUserCommits()` added to gitlab.ts |
| STAND-06 | Yesterday recap shows MR activity I performed — comments + approvals | No existing MR events function; needs `fetchUserMREvents()` added to gitlab.ts using GitLab User Events API |

</phase_requirements>

---

## Summary

Phase 69 ships the `/standup-notes` route with a two-column page shell (Yesterday left, Today right placeholder). The Yesterday column aggregates the last working day's activity from four independent data sources. All major patterns (route registration, useQuery, token loading, Tempo fetch, error/empty states) already exist in the codebase and are well-documented. The two key gaps are: (1) new service functions for GitLab commits and MR events, and (2) a new Jira "daily activity" fetch that combines JQL search + per-issue changelog + comments filtered by author and date.

The "yesterday date" logic requires extending the existing `getLastWorkingDay()` (weekend-skip only) to also check the Tempo schedule API for public holidays. This logic should be extracted into a reusable utility function used by the StandupNotesPage.

The UI-SPEC is approved and provides the full component inventory, icon assignments, typography, spacing, and copywriting contract. No new npm packages are required — all UI components (Button, Skeleton, EmptyState, ErrorState, Badge) are already installed. Clipboard writes use `navigator.clipboard.writeText()` (no Tauri clipboard plugin is installed or needed; the web API works in the Tauri webview).

**Primary recommendation:** Build four independent `useQuery` hooks in StandupNotesPage (one per data source), add two new service functions to `gitlab.ts` and one new function to `jira.ts` or a new `jira-standup.ts`, extract yesterday-date resolution into a `resolveYesterdayDate()` utility, and render the grouping/aggregation logic in the YesterdayColumn component. Follow the `WorklogsPage.tsx` patterns exactly for token loading, staleTime, and queryKey discipline.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route + sidebar registration | Frontend (Tauri webview) | — | routes.tsx / sidebar-items.ts / main.tsx |
| Yesterday date resolution | Frontend utility | Tempo API (holiday data) | Client-side computation with optional Tempo schedule lookup |
| Tempo worklog fetch | Service (tempo/worklogs.ts) | — | Already exists; call with [yesterdayDate, yesterdayDate] range |
| Jira changelog + comments fetch | Service (jira.ts new fn) | — | JQL search + expand=changelog + per-issue comments |
| GitLab commits fetch | Service (gitlab.ts new fn) | — | New `fetchUserCommits()` function |
| GitLab MR events fetch | Service (gitlab.ts new fn) | — | New `fetchUserMREvents()` function; GitLab User Events API |
| Issue grouping + aggregation | Frontend (YesterdayColumn.tsx) | — | Client-side data join; no server-side aggregation needed |
| Copy markdown generation | Frontend (StandupNotesPage.tsx) | navigator.clipboard | Client-side string composition + browser clipboard API |
| 2-column layout shell | Frontend (StandupNotesPage.tsx) | — | CSS flexbox/grid, no specialized library |

---

## Standard Stack

### Core (all already installed) [VERIFIED: npm registry]

| Library | Version (installed) | Purpose | Why Standard |
|---------|-------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 (latest: 5.100.14) | Data fetching, caching, refetch | Project-wide pattern; all data pages use useQuery |
| `lucide-react` | ^0.577.0 (latest: 1.16.0) | Icons | Project icon library; UI-SPEC specifies exact icon names |
| `zustand` | ^5.0.11 | Auth + settings store access | useAuthStore, useSettingsStore |
| `react-router-dom` | ^7.13.1 | Route registration | withLazy() + RouteObject pattern in routes.tsx |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-http` | ^2.5.7 | Network requests via `apiFetch` | All API calls (bypasses CORS in Tauri webview) |
| `@tauri-apps/plugin-stronghold` | ^2.3.1 | `readSecret('jira-pat')` / `readSecret('gitlab-pat')` | Token retrieval before useQuery |

### No New Packages Required

No new npm or Cargo packages are needed for Phase 69. The clipboard write uses `navigator.clipboard.writeText()` which is available in the Tauri 2 webview without any additional plugin. [VERIFIED: codebase scan — `tauri-plugin-clipboard-manager` is absent from Cargo.toml and package.json]

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies already present in the project.

| Package | Status |
|---------|--------|
| All dependencies | Already installed and in use across the codebase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
StandupNotesPage
  ├─ [useEffect] readSecret('jira-pat')  → jiraToken state
  ├─ [useEffect] readSecret('gitlab-pat') → gitlabToken state
  ├─ [useMemo]   resolveYesterdayDate(tempoEnabled, scheduleData)
  │
  ├─ useQuery(tempoWorklogs)    ──► fetchWorklogs(baseUrl, token, [jiraUsername], date, date)
  ├─ useQuery(tempoSchedule)    ──► fetchUserSchedule(baseUrl, token, lookback, today, userKey)
  ├─ useQuery(jiraActivity)     ──► fetchYesterdayJiraActivity(baseUrl, token, project, date, jiraUsername)
  ├─ useQuery(gitCommits)       ──► fetchUserCommits(baseUrl, token, projectId, date, gitlabUsername)
  └─ useQuery(mrEvents)         ──► fetchUserMREvents(baseUrl, token, gitlabUserId, date)
  
  ├─ StandupPageHeader (title, date, sync status, Refresh, Copy markdown)
  ├─ YesterdayColumn
  │    ├─ [data join] group activity by Jira issue key
  │    ├─ IssueActivityGroup × N  (one per touched issue)
  │    ├─ OtherCommitsGroup       (commits without Jira key)
  │    └─ StandaloneMrGroup × N   (MRs without linked issue)
  └─ TodayColumnPlaceholder
```

### Recommended Project Structure

```
src/routes/standup-notes/
├── StandupNotesPage.tsx       # Top-level page; owns 2-column shell + all useQuery hooks
├── StandupPageHeader.tsx      # Title + date + sync status + Copy markdown + Refresh
├── YesterdayColumn.tsx        # Left column; stat line + issue group list; data join logic
├── TodayColumnPlaceholder.tsx # Right column shell (Phase 70 content)
├── IssueActivityGroup.tsx     # Single issue group: header + sub-item list
├── OtherCommitsGroup.tsx      # Catch-all group for commits with no Jira key
└── StandaloneMrGroup.tsx      # MR group for MRs not linked to any issue

src/services/
├── jira.ts                    # Add fetchYesterdayJiraActivity() here
└── gitlab.ts                  # Add fetchUserCommits() and fetchUserMREvents() here

src/lib/
└── standup-date.ts            # New: resolveYesterdayDate() utility (pure function, testable)
```

### Pattern 1: Route + Sidebar Registration

Three files must be updated atomically:

```typescript
// routes.tsx — add lazy import
const StandupNotesPage = lazy(() => import('./standup-notes/StandupNotesPage'));

// In routes array:
{ path: '/standup-notes', element: withLazy(StandupNotesPage) },
```

```typescript
// sidebar-items.ts — add to SIDEBAR_NAV_ITEMS array (after my-tasks, in 'main' section)
{
  id: 'standup-notes',
  label: 'Standup Notes',
  path: '/standup-notes',
  iconName: 'ClipboardList',
  section: 'main',
},
```

```typescript
// main.tsx routeLabel() — add case before the default return
if (pathname.startsWith('/standup-notes')) return 'Standup Notes';
```

[VERIFIED: codebase scan — all three files confirmed, exact patterns above match existing code]

### Pattern 2: Token Loading (established pattern)

```typescript
// Source: MergeRequestListPage.tsx + WorklogsPage.tsx patterns
const [jiraToken, setJiraToken] = useState<string | null>(null);
const [gitlabToken, setGitlabToken] = useState<string | null>(null);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);

useEffect(() => {
  if (gitlabBaseUrl) {
    readSecret('gitlab-pat')
      .then((t) => setGitlabToken(t))
      .catch(() => setGitlabToken(null));
  }
}, [gitlabBaseUrl]);
```

[VERIFIED: codebase scan — pattern identical across MergeRequestListPage.tsx line 54, WorklogsPage.tsx line 308]

### Pattern 3: Independent useQuery Per Data Source

**CRITICAL RULE (T-62-06):** Token strings MUST NOT appear in `queryKey`. [VERIFIED: codebase — WorklogsPage.tsx comment at line 11 and line 352]

```typescript
// Source: WorklogsPage.tsx lines 353-364
const tempoQuery = useQuery({
  queryKey: ['standup', 'tempo', jiraBaseUrl, yesterdayDate, jiraUsername ?? ''],
  queryFn: () => fetchWorklogs(jiraBaseUrl!, jiraToken!, [jiraUsername!], yesterdayDate, yesterdayDate),
  enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!jiraUsername && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});

const jiraActivityQuery = useQuery({
  queryKey: ['standup', 'jira', jiraBaseUrl, activeJiraProject, yesterdayDate, jiraUsername ?? ''],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return fetchYesterdayJiraActivity(jiraBaseUrl!, token, activeJiraProject!, yesterdayDate, jiraUsername!);
  },
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!jiraUsername && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});

const commitsQuery = useQuery({
  queryKey: ['standup', 'commits', gitlabBaseUrl, activeGitlabProject, yesterdayDate, gitlabUsername ?? ''],
  queryFn: async () => {
    const token = await readSecret('gitlab-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return fetchUserCommits(gitlabBaseUrl!, token, activeGitlabProject!, yesterdayDate, gitlabUsername!);
  },
  enabled: !!gitlabBaseUrl && !!gitlabToken && !!activeGitlabProject && !!gitlabUsername && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});

const mrEventsQuery = useQuery({
  queryKey: ['standup', 'mr-events', gitlabBaseUrl, gitlabUserId, yesterdayDate],
  queryFn: async () => {
    const token = await readSecret('gitlab-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return fetchUserMREvents(gitlabBaseUrl!, token, gitlabUserId!, yesterdayDate);
  },
  enabled: !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});
```

### Pattern 4: Yesterday Date Resolution

The existing `getLastWorkingDay()` in WorklogsPage.tsx (line 182) handles weekends-only. Phase 69 needs an enhanced version that additionally skips Tempo holidays. Extract to a reusable utility:

```typescript
// src/lib/standup-date.ts
// STAND-02: Returns last working day, skipping weekends and optionally Tempo holidays.

import type { ScheduleDayType } from '@/services/tempo';

/**
 * Resolve the "yesterday" date for standup purposes.
 * 
 * Algorithm (D-15):
 * 1. Start from today - 1 calendar day
 * 2. While result is Saturday (6) or Sunday (0), subtract one more day
 * 3. If tempoSchedule provided, additionally skip days marked HOLIDAY
 * 
 * @param tempoSchedule  Map of YYYY-MM-DD -> ScheduleDayType (from fetchUserSchedule)
 *                       Pass undefined/empty Map when Tempo is disabled.
 * @returns YYYY-MM-DD string for the last working day
 */
export function resolveYesterdayDate(
  tempoSchedule?: Map<string, ScheduleDayType>,
): string {
  const today = new Date();
  let candidate = new Date(today);
  candidate.setDate(today.getDate() - 1);

  for (let i = 0; i < 14; i++) { // safety cap: never loop forever
    const dow = candidate.getDay();
    const dateStr = candidate.toISOString().slice(0, 10);
    
    if (dow === 0 || dow === 6) {
      candidate.setDate(candidate.getDate() - 1);
      continue;
    }
    
    if (tempoSchedule?.get(dateStr) === 'HOLIDAY') {
      candidate.setDate(candidate.getDate() - 1);
      continue;
    }
    
    return dateStr;
  }
  
  // Fallback: shouldn't happen in practice (14-day cap)
  return candidate.toISOString().slice(0, 10);
}

/**
 * Returns a date range for fetching the Tempo schedule.
 * Covers up to 14 days back so holiday detection works across long weekends.
 */
export function getScheduleLookbackRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 14);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}
```

Key ordering: The Tempo schedule query must run first (or in parallel), and `resolveYesterdayDate()` must be called after scheduleData is available. Use `useMemo` to derive `yesterdayDate` from scheduleData.

### Pattern 5: New Service Functions

#### `fetchYesterdayJiraActivity()` in `jira.ts`

```typescript
// Add to jira.ts after the existing fetchComments function
// Source: pattern from fetchAllSearchPages + fetchComments

export interface JiraActivityItem {
  issueKey: string;
  summary: string;
  transitions: Array<{ fromStatus: string; toStatus: string; at: string }>;
  comments: Array<{ body: string; at: string }>;
}

/**
 * Fetch Jira activity I authored yesterday: status transitions + comments.
 * 
 * Strategy (D-01, D-02):
 * 1. JQL search: project = {project} AND updated >= {date} (maxResults=50)
 * 2. For each issue: filter changelog.histories by author.name === jiraUsername AND date === yesterdayDate
 * 3. For each issue: fetch /rest/api/2/issue/{key}/comment and filter by author + date
 * 
 * Uses expand=changelog to get transitions inline with issue fetch.
 * The JQL result gives us candidate issues; author+date filter happens client-side.
 */
export async function fetchYesterdayJiraActivity(
  baseUrl: string,
  token: string,
  projectKey: string,
  date: string, // YYYY-MM-DD
  jiraUsername: string,
): Promise<JiraActivityItem[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  // Step 1: JQL search (D-01, D-03)
  const jql = encodeURIComponent(`project = ${projectKey} AND updated >= "${date}" ORDER BY updated DESC`);
  const url = `${base}/rest/api/2/search?jql=${jql}&maxResults=50&expand=changelog&fields=summary,status,issuetype`;
  
  const response = await apiFetch('jira', url, { headers }, 'Load Standup Jira Activity');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch Jira activity', response.status, 'jira');
    }
    throw new Error(`Jira activity fetch failed: ${response.status}`);
  }
  
  const data = await response.json();
  const issues = (data.issues ?? []) as Array<{
    key: string;
    fields: { summary: string };
    changelog?: { histories: ChangelogHistory[] };
  }>;
  
  const results: JiraActivityItem[] = [];
  
  for (const issue of issues) {
    // Step 2: filter transitions by author + date (D-02)
    const transitions = (issue.changelog?.histories ?? [])
      .filter(h => 
        h.author.name === jiraUsername &&
        h.created.slice(0, 10) === date &&
        h.items.some(i => i.field === 'status')
      )
      .map(h => {
        const statusItem = h.items.find(i => i.field === 'status')!;
        return { fromStatus: statusItem.fromString ?? '', toStatus: statusItem.toString ?? '', at: h.created };
      });
    
    // Step 3: fetch + filter comments (D-02) — separate call per issue
    let comments: Array<{ body: string; at: string }> = [];
    try {
      const commentsUrl = `${base}/rest/api/2/issue/${issue.key}/comment`;
      const commentsRes = await apiFetch('jira', commentsUrl, { headers }, 'Load Standup Jira Comments');
      if (commentsRes.ok) {
        const commentsData = (await commentsRes.json()) as { comments: JiraComment[] };
        comments = (commentsData.comments ?? [])
          .filter(c => (c.author.name === jiraUsername) && c.created.slice(0, 10) === date)
          .map(c => ({ body: c.body, at: c.created }));
      }
    } catch { /* graceful degradation */ }
    
    if (transitions.length > 0 || comments.length > 0) {
      results.push({ issueKey: issue.key, summary: issue.fields.summary, transitions, comments });
    }
  }
  
  return results;
}
```

#### `fetchUserCommits()` in `gitlab.ts`

```typescript
// Add to gitlab.ts

export interface GitLabCommit {
  id: string;           // full SHA
  short_id: string;     // 8-char SHA
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string; // ISO 8601
  web_url: string;
}

/**
 * Fetch commits authored by a specific user on the given project for a date.
 * 
 * Uses GET /api/v4/projects/:projectId/repository/commits
 * with since/until params for the given date (full day window).
 * Author filter is applied client-side (GitLab 'author' param filters by email or name).
 * 
 * D-14 resolution: activeGitlabProject only (single project scope).
 * Branch resolution: not needed — we read branch from commit refs only if
 * the commit message has no Jira key (fallback handled client-side via refs API).
 */
export async function fetchUserCommits(
  baseUrl: string,
  token: string,
  projectId: number,
  date: string,        // YYYY-MM-DD
  authorUsername: string,
): Promise<GitLabCommit[]> {
  const base = baseUrl.replace(/\/$/, '');
  // Since/until cover the full calendar day in UTC
  const since = `${date}T00:00:00.000Z`;
  const until = `${date}T23:59:59.999Z`;
  const url = `${base}/api/v4/projects/${projectId}/repository/commits?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=100&with_stats=false`;

  let response: Response;
  try {
    response = await apiFetch('gitlab', url, {
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    }, 'Load Standup Commits');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch commits', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch commits: status ${response.status}`);
  }

  const data = (await response.json()) as GitLabCommit[];
  // Filter by author: GitLab username match (case-insensitive) or display name
  return data.filter(c => 
    c.author_name.toLowerCase() === authorUsername.toLowerCase() ||
    c.author_email.toLowerCase().includes(authorUsername.toLowerCase())
  );
}
```

#### `fetchUserMREvents()` in `gitlab.ts`

```typescript
// Add to gitlab.ts

export interface GitLabUserMREvent {
  id: number;
  action_name: 'commented' | 'approved';
  target_type: 'MergeRequest';
  target_id: number;
  target_iid: number;
  target_title: string;
  created_at: string; // ISO 8601
  project_id: number;
}

/**
 * Fetch MR activity events for a user on a given date.
 * 
 * D-04: Uses GitLab User Events API /api/v4/users/:userId/events
 * Fetches commented + approved events for MergeRequest targets.
 * Filters to the given date client-side (GitLab 'after' param is inclusive).
 */
export async function fetchUserMREvents(
  baseUrl: string,
  token: string,
  userId: number,
  date: string, // YYYY-MM-DD
): Promise<GitLabUserMREvent[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };
  
  // Fetch both action types in parallel
  const [commentedRes, approvedRes] = await Promise.allSettled([
    apiFetch('gitlab', `${base}/api/v4/users/${userId}/events?action=commented&target_type=merge_request&after=${date}&per_page=100`, { headers }, 'Load Standup MR Events'),
    apiFetch('gitlab', `${base}/api/v4/users/${userId}/events?action=approved&target_type=merge_request&after=${date}&per_page=100`, { headers }, 'Load Standup MR Events'),
  ]);
  
  const events: GitLabUserMREvent[] = [];
  
  for (const result of [commentedRes, approvedRes]) {
    if (result.status === 'fulfilled' && result.value.ok) {
      const data = (await result.value.json()) as GitLabUserMREvent[];
      // Filter to exact date (GitLab 'after' may include earlier events near midnight)
      events.push(...data.filter(e => e.created_at.slice(0, 10) === date && e.target_type === 'MergeRequest'));
    }
  }
  
  return events;
}
```

### Pattern 6: Jira Key Extraction from Commit (D-08)

```typescript
// Client-side utility — no API call needed for message extraction
const JIRA_KEY_REGEX = /[A-Z][A-Z0-9]+-\d+/g;

export function extractJiraKeyFromMessage(message: string): string | null {
  const match = JIRA_KEY_REGEX.exec(message);
  return match ? match[0] : null;
}

export function extractJiraKeyFromBranch(branchName: string): string | null {
  const match = JIRA_KEY_REGEX.exec(branchName);
  return match ? match[0] : null;
}
```

**Branch resolution decision (D-14):** Fetching branch names per commit requires a call to `/api/v4/projects/:id/repository/commits/:sha/refs?type=branch` for each commit with no Jira key in the message. This adds N API calls. For a daily standup with typically < 20 commits, this is acceptable. The planner should add a batch refs fetch (per-commit) only for commits that fail the message extraction step.

### Pattern 7: Copy Markdown (D-12)

```typescript
// navigator.clipboard is available in Tauri 2 webview — no plugin needed
// Source: confirmed absence of tauri-plugin-clipboard-manager in Cargo.toml

async function handleCopyMarkdown() {
  const text = generateMarkdown(yesterdayGroups, yesterdayDate);
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback: no-op (unlikely in Tauri webview)
  }
}

// Markdown format (planner's discretion — suggested format):
function generateMarkdown(groups: IssueGroup[], date: string): string {
  const lines = [`## Yesterday (${date})`, ''];
  for (const group of groups) {
    lines.push(`### ${group.issueKey}: ${group.summary}`);
    for (const item of group.subItems) {
      lines.push(`- ${item.label}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

### Pattern 8: Integration-Disabled State

Per UI-SPEC: when an integration is disabled, show an inline muted notice, not `ErrorState`. This is a special conditional before the `isLoading` / `isError` / `data` rendering cascade.

```typescript
if (!tempoEnabled) {
  return <p className="text-xs text-muted-foreground">Tempo is disabled. Enable it in Settings → Integrations.</p>;
}
```

### Anti-Patterns to Avoid

- **Token in queryKey:** Never put `jiraToken` or `gitlabToken` in queryKey. [VERIFIED: WorklogsPage.tsx comment T-62-06]
- **toLocaleDateString() for date comparison:** Always use `.slice(0, 10)` on ISO strings. [VERIFIED: Phase 62 decision, WorklogsPage.tsx pattern]
- **Blocking all sections on one fetch:** Each section must use its own `useQuery` with its own `enabled` guard. A Tempo outage must not prevent Jira section from rendering.
- **Single combined fetch:** Do not combine all four data sources into one API call or one useQuery. The graceful degradation requirement (STAND-03..06) mandates independent loading.
- **Paginating commits without a cap:** The GitLab commits endpoint returns up to 100 per page. For a single day's commits, 100 is sufficient; no pagination needed.
- **Forgetting the `apiFetch` source parameter:** New GitLab functions must use `'gitlab'` as source; new Jira functions must use `'jira'`. This is required for the DevTools instrumentation and `markDisconnected()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching + caching | Custom fetch + useState | `useQuery` from @tanstack/react-query | Handles loading/error/stale states, refetch, cache invalidation |
| Token storage | Token in state/store | `readSecret('jira-pat')` / `readSecret('gitlab-pat')` | Stronghold is the established pattern; tokens never in Zustand |
| Error display | Custom error UI | `ErrorState` from `@/components/ui/error-state` | Handles auth error (session expired) vs. network error; includes Retry |
| Empty display | Custom empty UI | `EmptyState` from `@/components/ui/empty-state` | Consistent spacing and typography with the rest of the app |
| Loading display | Custom spinner | `Skeleton` from `@/components/ui/skeleton` | Per UI-SPEC: 3× `<Skeleton className="h-4 w-full" />` stacked |
| Clipboard | Tauri plugin | `navigator.clipboard.writeText()` | No clipboard plugin installed; browser API works in Tauri webview |

---

## Common Pitfalls

### Pitfall 1: Token in queryKey Causes Excessive Cache Misses
**What goes wrong:** Putting the token string in `queryKey` causes a new cache entry on every token refresh, defeating the cache and causing redundant API calls.
**Why it happens:** Tokens change (expired, rotated), so putting them in queryKey is tempting for correctness.
**How to avoid:** Follow T-62-06: token is NOT in queryKey. The `enabled` guard (`!!jiraToken`) ensures the query only runs when a token is available. `readSecret()` inside queryFn retrieves the fresh token.
**Warning signs:** useQuery fires repeatedly on page navigation.

### Pitfall 2: Yesterday Date Computed Before Schedule Data
**What goes wrong:** `resolveYesterdayDate()` is called before the Tempo schedule query completes, returning a weekend-skip-only date even when Tempo is enabled.
**Why it happens:** Component renders before async data is ready.
**How to avoid:** Use `useMemo` with `scheduleData` as a dependency:
```typescript
const yesterdayDate = useMemo(
  () => resolveYesterdayDate(scheduleData ?? undefined),
  [scheduleData]
);
```
The schedule query has `staleTime: 24 * 60 * 60 * 1000` — it resolves quickly from cache on subsequent visits.
**Warning signs:** Monday standup shows Sunday as "yesterday".

### Pitfall 3: Jira JQL `updated >=` Over-Fetches
**What goes wrong:** JQL `updated >= {date}` returns issues updated on or after the date, including today's activity if page is opened in the morning after already working.
**Why it happens:** The JQL filter is date-scoped, not time-scoped; all changelog + comment entries are filtered client-side to the exact `date`.
**How to avoid:** The client-side filter on `h.created.slice(0, 10) === date` is correct. The JQL acts as a pre-filter to reduce the result set; the real filter is per-entry on the client.
**Warning signs:** Jira section shows today's transitions instead of yesterday's.

### Pitfall 4: GitLab `after` Param Is Exclusive
**What goes wrong:** GitLab Events API uses `after={date}` which means "after this date" (exclusive), not "on or after". Passing yesterday's date filters out events from that day.
**Why it happens:** GitLab API documentation: `after` is exclusive for events.
**How to avoid:** Pass `after={dayBefore}` (the date before yesterday) to include yesterday's events, then filter client-side by `e.created_at.slice(0, 10) === yesterdayDate`.
**Warning signs:** MR events section always shows empty even when activity was done yesterday.

### Pitfall 5: Commit Author Matching Is Case-Sensitive
**What goes wrong:** `author_name` from GitLab doesn't always match `gitlabUsername` exactly (display name vs. username, capitalization differences).
**Why it happens:** GitLab commits store `author_name` (from git config) and `author_email`, not `username`.
**How to avoid:** Fetch commits using the GitLab `/repository/commits?author=` param which accepts both email and name, then additionally filter client-side with case-insensitive comparison as a fallback. The `gitlabUsername` from auth store is the login name (e.g. `johndoe`), not the display name.
**Warning signs:** Commits section empty even when commits were made.

### Pitfall 6: Missing `apiFetch` Source Parameter
**What goes wrong:** New functions added to `gitlab.ts` or `jira.ts` without the correct `source` parameter cause DevTools logging to attribute calls to the wrong service, and `markDisconnected()` won't fire correctly on 401.
**Why it happens:** Developer forgets the first argument to `apiFetch`.
**How to avoid:** All calls in `gitlab.ts` use `apiFetch('gitlab', ...)`. All calls in `jira.ts` use `apiFetch('jira', ...)`.

### Pitfall 7: Branch Name Fetch Adds Too Many API Calls
**What goes wrong:** Fetching branch refs for every commit (even those that have a Jira key in the message) multiplies API calls unnecessarily.
**Why it happens:** Naively applying the branch fallback to all commits.
**How to avoid:** Only call `/repository/commits/:sha/refs` for commits where message extraction returns null (D-08 fallback chain step 2). Message extraction first, branch fetch only on miss.

---

## Code Examples

### Verified: TempoWorklog type shape (STAND-03)

```typescript
// Source: taskflow/src/services/tempo/types.ts (verified)
export interface TempoWorklog {
  issue: {
    key: string;        // e.g. "PROJ-123"
    summary?: string;
  };
  author: { name: string; displayName?: string; };
  timeSpentSeconds: number;
  dateStarted: string;  // YYYY-MM-DD after normalize
  comment?: string;
}
```

### Verified: Seconds-to-hours formatting

```typescript
// Source: WorklogsPage.tsx (verified — local copy pattern for decoupling)
function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}
```

### Verified: getDefaultSidebarItems auto-includes new items

```typescript
// Source: sidebar-items.ts lines 95-100 (verified)
export function getDefaultSidebarItems(): SidebarItem[] {
  return SIDEBAR_NAV_ITEMS.map((item) => ({
    id: item.id,
    visible: true,
  }));
}
// Adding to SIDEBAR_NAV_ITEMS auto-includes the item in getDefaultSidebarItems()
// No settings store migration needed — new item gets visible: true by default
```

### Verified: withLazy pattern

```typescript
// Source: routes.tsx lines 25-33 (verified)
function withLazy(Component: ComponentType) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        <Component />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `toLocaleDateString()` for date comparison | `.slice(0, 10)` on ISO strings | Phase 62 decision — avoids timezone-shift bugs |
| Role-gated sidebar items | All items visible by default | Post-ROLES-06 — no role check needed for `standup-notes` |
| Global `useSettingsStore()` | Fine-grained selectors `useSettingsStore((s) => s.tempoEnabled)` | Phase 68 pattern — do not destructure wholesale |

**Deprecated/outdated:**
- Role-based visibility: All sidebar items are visible to all users since Phase 66. No `role` check needed.
- `toLocaleDateString()`: Never use for date comparison. All date comparisons via `.slice(0, 10)`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitLab User Events API `after` param is exclusive (filters events strictly after the date, not on-the-date) | Pitfall 4 + fetchUserMREvents | If inclusive, passing `yesterdayDate` directly works and the extra day subtraction creates a window that's too wide. Low risk — client-side filter corrects either way. |
| A2 | `navigator.clipboard.writeText()` works in Tauri 2 webview without special plugin | Pattern 7 | If blocked, need `tauri-plugin-clipboard-manager`. Risk: low — Tauri webview is Chromium-based and the web clipboard API works in secure contexts. Tauri apps are localhost contexts. |
| A3 | GitLab commits `/repository/commits` endpoint `since`/`until` params accept ISO 8601 UTC strings | fetchUserCommits | If params are rejected, fallback to date-only params (`since=YYYY-MM-DD`) and accept a slightly wider window with client-side date filter. |
| A4 | `ChangelogHistory.author.name` matches `jiraUsername` from auth store (both are the Jira server username, not display name) | fetchYesterdayJiraActivity | If they differ (e.g., LDAP vs. local user), transitions filter returns empty. The auth store `jiraUsername` is from `GET /rest/api/2/myself .name` which is the same field stored in changelog author. Low risk. |

**If this table is empty:** not applicable — assumptions are present and documented.

---

## Open Questions (RESOLVED)

1. **GitLab `after` param behavior**
   - What we know: GitLab Events API documentation states `after` is a date filter
   - What's unclear: Whether it is inclusive or exclusive at the date boundary
   - RESOLVED: Implement with `after={dayBeforeYesterday}` + client-side filter on exact date. This is safe regardless of API behavior.

2. **Commit author email vs. username matching**
   - What we know: GitLab commits store `author_email` and `author_name` from git config, not necessarily the GitLab login username
   - What's unclear: Whether `gitlabUsername` reliably appears in `author_email` or `author_name`
   - RESOLVED: Use GitLab API's `author=` param (accepts email or name) as primary filter, with case-insensitive username match as secondary client-side filter. This is the safest approach.

3. **Jira comments fetch volume**
   - What we know: D-02 requires a separate comments call per issue after JQL result (max 50 issues)
   - What's unclear: Whether 50 sequential comment fetches is acceptable latency
   - RESOLVED: Use `Promise.all()` with the existing `jiraConcurrencyLimit` pattern if available, or fire all 50 in parallel (Jira Server typically handles this). The Jira section will have its own loading state so latency is isolated.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build | ✓ | v25.9.0 | — |
| npm | Build | ✓ | 11.12.1 | — |
| Jira Server | STAND-04 | ✓ (configured) | — | Graceful empty section |
| GitLab | STAND-05, STAND-06 | ✓ (configured) | — | Graceful empty sections |
| Tempo plugin | STAND-03 | conditional (tempoEnabled flag) | — | Empty section with "disabled" notice |
| navigator.clipboard | Copy markdown | ✓ (Tauri webview is Chromium) | — | Silent no-op catch block |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** Tempo is optional; clipboard is best-effort.

---

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (version from package.json devDependencies) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm run test` (from `taskflow/` directory) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAND-01 | Route `/standup-notes` registered; sidebar item present | unit (routes.test.ts, sidebar-items check) | `npm run test -- routes` | ✅ routes.test.ts exists |
| STAND-02 | `resolveYesterdayDate()` skips weekends; skips holidays when scheduleData provided | unit | `npm run test -- standup-date` | ❌ Wave 0 |
| STAND-03 | Tempo section shows empty state when disabled | unit (component test) | `npm run test -- StandupNotesPage` | ❌ Wave 0 |
| STAND-04 | Jira activity filtering by author + date (client-side filter) | unit | `npm run test -- jira-standup` | ❌ Wave 0 |
| STAND-05 | Jira key extraction from commit message + branch name | unit | `npm run test -- standup-date` or `jira-key` | ❌ Wave 0 |
| STAND-06 | MR events fetching (service function exists, returns correct shape) | unit (mock fetch) | `npm run test -- gitlab` | ✅ gitlab.ts has no test file — ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test` (all tests, < 10 seconds typical)
- **Per wave merge:** `npm run test && npm run build` (full build verification per Phase 59 rule)
- **Phase gate:** Full suite green + `npm run build` passes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/standup-date.test.ts` — covers STAND-02 (resolveYesterdayDate weekend + holiday skip), STAND-05 (Jira key extraction)
- [ ] `src/services/jira-standup.test.ts` — covers STAND-04 (client-side author+date filtering logic)
- [ ] Component tests for StandupNotesPage integration-disabled states — covers STAND-03

*(Existing routes.test.ts likely covers route registration; verify STAND-01 can use it.)*

---

## Security Domain

> `security_enforcement` not explicitly disabled in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | PAT via Stronghold (`readSecret`) — established pattern, no change |
| V3 Session Management | No | Tauri app; no session tokens |
| V4 Access Control | No | Post-roles-removal; all routes visible to all users |
| V5 Input Validation | Yes | `yesterdayDate` must be validated as YYYY-MM-DD before inclusion in JQL/URL params |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JQL injection via date param | Tampering | Date is computed internally (`toISOString().slice(0, 10)`) — not from user input. Low risk. |
| Token leak via queryKey | Info Disclosure | T-62-06: tokens never in queryKey; tokens retrieved via readSecret inside queryFn |
| CORS bypass via apiFetch | — | `apiFetch` uses `@tauri-apps/plugin-http` which bypasses CORS — existing pattern; same as all other API calls |

---

## Sources

### Primary (HIGH confidence)

- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — useQuery pattern, token loading, T-62-06 rule, getLastWorkingDay(), staleTime conventions
- `taskflow/src/services/tempo/worklogs.ts` — fetchWorklogs signature (verified functional)
- `taskflow/src/services/tempo/schedule.ts` — fetchUserSchedule signature and ScheduleDayType values
- `taskflow/src/services/gitlab.ts` — apiFetch pattern, PRIVATE-TOKEN header, existing MR functions
- `taskflow/src/services/jira.ts` — JQL search pattern, fetchComments, expand=changelog, fetchAllSearchPages
- `taskflow/src/services/tempo/types.ts` — TempoWorklog type (field-level verified from Phase 61 probe)
- `taskflow/src/components/app/sidebar-items.ts` — SidebarNavDef interface, SIDEBAR_NAV_ITEMS array, getDefaultSidebarItems()
- `taskflow/src/routes/routes.tsx` — withLazy pattern, RouteObject array
- `taskflow/src/main.tsx` — routeLabel() function (line 285-299)
- `taskflow/src/stores/auth.store.ts` — all identity fields confirmed (jiraUsername, jiraUserKey, gitlabUserId, gitlabUsername, activeJiraProject, activeGitlabProject, jiraBaseUrl, gitlabBaseUrl)
- `taskflow/src/stores/settings.store.ts` — tempoEnabled confirmed at line 56
- `taskflow/.planning/phases/69-standup-notes-route-yesterday-recap/69-UI-SPEC.md` — approved UI contract (component list, icons, spacing, copy)
- `taskflow/src-tauri/Cargo.toml` — confirmed no clipboard plugin installed
- `taskflow/vitest.config.ts` — test framework confirmed

### Secondary (MEDIUM confidence)

- GitLab Events API `after` param behavior: ASSUMED exclusive (A1). Resolved via client-side date filter which is correct regardless.

### Tertiary (LOW confidence — see Assumptions Log)

- navigator.clipboard availability in Tauri 2: ASSUMED based on Chromium-based webview; not verified against Tauri 2 documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json and codebase
- Architecture: HIGH — patterns verified from existing route files
- New service functions: HIGH — APIs documented from existing service file patterns; function signatures derived from existing patterns in gitlab.ts / jira.ts
- Pitfalls: HIGH — pitfalls 1/2/3/6/7 verified from codebase; pitfall 4/5 are documented API behaviors (ASSUMED)
- Date resolution: HIGH — existing getLastWorkingDay() confirmed; extension pattern clear

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable stack; 30-day validity)
