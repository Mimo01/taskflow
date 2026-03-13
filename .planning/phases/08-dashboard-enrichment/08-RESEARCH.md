# Phase 8: Dashboard Enrichment - Research

**Researched:** 2026-03-13
**Domain:** React dashboard layout, TanStack Query cache sharing, Jira Agile REST API, Zustand store reads
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Replace** the 3 count cards entirely — do not keep them at the top
- Dev dashboard: 4 richer panels (2x2 grid recommended)
- PM dashboard is enriched in this phase: sprint health panel + notifications panel added (existing cards replaced/upgraded)
- My Subtasks: each row = Jira key + title + status badge + parent story name; max 5; "View all" link to My Tasks tab; rows clickable to open Jira URL in browser; orphan subtasks (parent not in sprint) hidden; empty state: "No open subtasks in the current sprint"
- MR Health Summary: breakdown by Needs Review / Approved / Changes Requested (counts); data from `assignedMrs` query; empty state: "No open MRs"
- Sprint Health (Dev + PM): shows "5 days left · 47% done · 2 at-risk"; at-risk items listed below summary (titles, not just count); sprint days remaining requires endDate — audit existing data first, add minimal Jira sprint API call if unavailable; uses `['jira-issues', 'sprint-board', activeJiraProject]` cache; no new Jira fetch unless end date is missing
- Notifications inline widget (Dev + PM): last 3 unread from `useNotificationsStore`; each row = source icon + entity title + body preview (~60 chars); clicking opens detail inline (not navigation); same pattern as NotificationPopover; empty state: "No unread notifications" (widget stays visible); "View all notifications" link to Notifications route; reads from store directly (no new fetch)

### Claude's Discretion
- Developer dashboard panel arrangement (2x2 grid recommended)
- Dashboard scroll vs fixed-height behavior
- At-risk heuristic implementation (recommended: in-progress + timeSpentSeconds == 0)
- Sprint end date strategy (audit existing data first; add minimal API call if unavailable)
- Exact panel header styling, spacing, and widget borders

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dashboard shows current user's open subtasks from the current sprint | `my-tasks` cache already exists; filter by `issuetype.subtask === true` + `myIssueKeys` set; parent name from `fields.parent.fields.summary`; deep-link pattern established |
| DASH-02 | Dashboard shows current user's open MR health summary (needs review / approved / changes requested) | `assignedMrs` data from `['gitlab-mrs', gitlabBaseUrl]` cache; `deriveReviewHealth` from linkEngine gives per-MR state; aggregate into three counts |
| DASH-03 | Dashboard shows sprint health (days left, % points done, at-risk in-progress items) | Sprint-board cache available; endDate NOT in current data — `fetchActiveSprint` function must be added; days remaining = floor((endDate - now) / msPerDay); done% from existing statusCategory derivation; at-risk = in-progress issues with `timeSpentSeconds == 0` |
| DASH-04 | Dashboard shows last 3 unread Jira/GitLab notifications inline | `useNotificationsStore` exposes `items` + `readIds`; unread = items where id not in readIds; sort newest-first; slice first 3; `NotificationRow` + `NotificationDetail` components reusable as-is |
</phase_requirements>

---

## Summary

Phase 8 replaces both the Developer and PM dashboards' simple count cards with four information-dense panel widgets. All required data is already being fetched by existing TanStack Query caches or available from Zustand stores — no net-new API calls are required for three of the four widgets. The one genuine data gap is **sprint end date**: the current `fetchSprintIssues` result contains issue fields only, not sprint metadata. The Jira Agile REST API exposes `endDate` on `GET /rest/agile/1.0/board/{boardId}/sprint?state=active`, but `boardId` is not currently stored in the auth store and the endpoint path has not been implemented. A `fetchActiveSprint` service function must be added, along with a boardId discovery call or a cache-friendly query keyed on `activeJiraProject`.

The dashboard component (`routes/dashboard/index.tsx`) is a clean replace: swap the `devCards`/`pmCards` array + grid for four panel components. Each panel is a self-contained component reading from the same query keys the tabs already use. The notifications widget reuses `NotificationRow` and `NotificationDetail` without modification, using the same inline-detail pattern as `NotificationPopover`.

**Primary recommendation:** Build four new panel components (`SubtasksPanel`, `MrHealthPanel`, `SprintHealthPanel`, `NotificationsPanel`), replace the card grid in `dashboard/index.tsx` with a 2x2 CSS grid layout, and add `fetchActiveSprint` to `jira.ts` using a TanStack Query with key `['jira-active-sprint', activeJiraProject]`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 18.x (existing) | Panel component authoring | Already in use throughout codebase |
| TanStack Query (`@tanstack/react-query`) | v5 (existing) | Cache reading; optional new sprint query | All tabs share this; no new client needed |
| Zustand (`zustand`) | existing | Read notifications store directly | `useNotificationsStore` already wired; TopBar polling keeps it fresh |
| shadcn/ui Badge | existing | Status chips on subtask rows | Used since Phase 5; consistent with existing rows |
| Tailwind CSS | existing | 2x2 grid layout, panel borders, spacing | All UI uses Tailwind already |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-router-dom` Link / `useNavigate` | existing | "View all" deep-links to `/my-tasks` and `/notifications` | Prefer `<Link>` for navigation; `window.open` for external Jira URLs |
| `apiFetch` (`lib/apiFetch`) | existing | Jira Agile sprint API call | Same pattern as all other Jira calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `useQuery` for sprint endDate | Embed endDate in `fetchSprintIssues` response | Embedding would require changing the return type + all callers; separate query is cleaner |
| Polling notifications in dashboard | Read from store directly | Store is already polled by TopBar; polling again wastes requests |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/routes/dashboard/
├── index.tsx                # MODIFIED: replace card grid with 2x2 panel grid
├── SubtasksPanel.tsx        # NEW: DASH-01
├── MrHealthPanel.tsx        # NEW: DASH-02
├── SprintHealthPanel.tsx    # NEW: DASH-03 (used by both Dev and PM)
├── NotificationsPanel.tsx   # NEW: DASH-04 (used by both Dev and PM)
├── TaskRow.tsx              # UNCHANGED
├── MrRow.tsx                # UNCHANGED
├── NotificationRow.tsx      # UNCHANGED (reused inside NotificationsPanel)
├── NotificationDetail.tsx   # UNCHANGED (reused inside NotificationsPanel)
└── [other existing files unchanged]

src/services/
└── jira.ts                  # ADD: fetchActiveSprint function
```

### Pattern 1: 2x2 Panel Grid Layout
**What:** Replace the `grid-cols-1 sm:grid-cols-3` card grid in `dashboard/index.tsx` with a `grid-cols-2` layout containing four panel components.
**When to use:** Dashboard is now the entry point; each panel is always visible (scrollable page for smaller screens).
**Example:**
```tsx
// dashboard/index.tsx — new layout zone
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <SubtasksPanel jiraBaseUrl={jiraBaseUrl} jiraToken={jiraToken} activeJiraProject={activeJiraProject} />
  <MrHealthPanel gitlabBaseUrl={gitlabBaseUrl} gitlabToken={gitlabToken} userId={currentUser?.id} />
  <SprintHealthPanel jiraBaseUrl={jiraBaseUrl} jiraToken={jiraToken} activeJiraProject={activeJiraProject} />
  <NotificationsPanel />
</div>
```

### Pattern 2: Panel Component Shape
**What:** Each panel is a contained component with a header label, loading skeleton, empty state, and content area.
**When to use:** All four widgets follow this shape.
**Example:**
```tsx
// Consistent panel shell pattern (all four panels)
<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
    My Subtasks
  </h2>
  {/* loading / empty / content */}
</div>
```

### Pattern 3: Cache-Read Without Re-Fetching
**What:** Panels read from TanStack Query cache keys already populated by tab components. Dashboard's own queries use the same keys, so cache hits are immediate.
**When to use:** SubtasksPanel reads `['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey]`; MrHealthPanel reads `['gitlab-mrs', gitlabBaseUrl, userId]` + per-MR health entries; SprintHealthPanel reads `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`.

The dashboard's existing query setup must be kept or migrated to the panels — panels should own their own `useQuery` calls with the correct shared keys so cache is populated even when the user visits the dashboard before any tab.

```tsx
// SubtasksPanel — reuse my-tasks cache key exactly
const { data: taskData, isLoading } = useQuery({
  queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
  queryFn: () => fetchMyTasksHierarchy(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
});
// Filter to subtasks where myIssueKeys.has(issue.key) and !isOrphan
```

### Pattern 4: Sprint End Date via Jira Agile API
**What:** `fetchActiveSprint` calls `GET /rest/agile/1.0/board/{boardId}/sprint?state=active` and returns `endDate`.
**Challenge:** `boardId` is not stored. Jira Agile API provides `GET /rest/agile/1.0/board?projectKeyOrId={projectKey}` to discover boards for a project — first board result's `id` is used.
**When to use:** SprintHealthPanel; query key `['jira-active-sprint', activeJiraProject]`; `staleTime: 5 * 60_000`.

```typescript
// jira.ts — new export
export interface JiraActiveSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  startDate?: string;  // ISO 8601
  endDate?: string;    // ISO 8601
  goal?: string;
}

export async function fetchActiveSprint(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraActiveSprint | null> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Step 1: discover boardId for projectKey
  const boardsUrl = `${base}/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=scrum`;
  let boardsRes: Response;
  try {
    boardsRes = await apiFetch('jira', boardsUrl, { headers });
  } catch {
    return null; // graceful — caller hides days-remaining
  }
  if (!boardsRes.ok) return null;
  const boardsData = await boardsRes.json();
  const boardId = boardsData.values?.[0]?.id;
  if (!boardId) return null;

  // Step 2: fetch active sprint
  const sprintUrl = `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active`;
  try {
    const sprintRes = await apiFetch('jira', sprintUrl, { headers });
    if (!sprintRes.ok) return null;
    const sprintData = await sprintRes.json();
    return (sprintData.values?.[0] ?? null) as JiraActiveSprint | null;
  } catch {
    return null;
  }
}
```

### Pattern 5: MR Health Counts from Existing Data
**What:** `MrHealthPanel` reads the `['gitlab-mrs', gitlabBaseUrl, userId]` cache and the per-MR `['mr-health', project_id, iid]` cache entries to derive three bucket counts. The `mr-health` entries are populated by `MyTasksTab` and `MrAttentionTab`.
**Key insight:** The dashboard already has a query for `assignedMrs` using key `['gitlab-mrs', gitlabBaseUrl]` — this is a DIFFERENT key than the one used by MrAttentionTab/MyTasksTab (`['gitlab-mrs', gitlabBaseUrl, userId]`). The MrHealthPanel must use the userId-scoped key to share cache with MrAttentionTab.

```tsx
// MrHealthPanel: derive counts from cache
const assignedMrs = queryClient.getQueryData<{filtered: GitLabMR[], merged: GitLabMR[]}>(
  ['gitlab-mrs', gitlabBaseUrl, userId]
)?.filtered ?? [];

// For each assigned MR, look up health from mr-health cache
const counts = { needsReview: 0, approved: 0, changesRequested: 0 };
for (const mr of assignedMrs) {
  const health = queryClient.getQueryData<ReviewHealth>(['mr-health', mr.project_id, mr.iid]);
  if (health === 'approved') counts.approved++;
  else if (health === 'changes_requested') counts.changesRequested++;
  else counts.needsReview++;
}
```

### Pattern 6: Notifications Widget — Inline Detail
**What:** Mirrors `NotificationPopover` pattern exactly: `useState<string | null>` for selected item ID; clicking a row calls `markAsRead` + sets `selectedItemId`; detail renders inline below the row.
**Key insight:** `NotificationRow` and `NotificationDetail` components are fully reusable without modification.

```tsx
// NotificationsPanel — inline detail pattern (same as NotificationPopover)
const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
const { items, readIds, markAsRead } = useNotificationsStore();
const readSet = new Set(readIds);
const unread = items
  .filter(i => !readSet.has(i.id))
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 3);
```

### Anti-Patterns to Avoid
- **Using the old `['gitlab-mrs', gitlabBaseUrl]` (no userId) query key:** The dashboard's current `assignedMrs` query uses this two-element key. MrHealthPanel must switch to the three-element key `['gitlab-mrs', gitlabBaseUrl, userId]` to share cache with MrAttentionTab where health data was fetched. Using the old key creates a parallel cache that never gets health populated.
- **Re-fetching notifications in the dashboard:** The store is already populated by TopBar's polling query. Read the store directly — no `useQuery` for notifications in the dashboard.
- **Calling `fetchSprintIssues` with `assignedToMe=true` for sprint health:** Sprint health needs all sprint issues (not just mine). Use the `sprint-board` cache key with `assignedToMe=false`.
- **Hardcoding boardId:** BoardId varies per Jira instance. Always discover via `/rest/agile/1.0/board?projectKeyOrId=...`.
- **Crashing when sprint endDate is absent:** The Jira Agile endpoint may return a sprint without `endDate` if it was created without one. Guard: `sprint?.endDate ? computeDays() : null` and hide the "days left" segment when null (graceful-hide pattern).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification unread detection | Custom filtering logic | `readIds` array from `useNotificationsStore` + `Set` lookup | Store already maintains this; duplicating creates stale reads |
| MR health state | Custom approvals parsing | `deriveReviewHealth` from `linkEngine.ts` | Handles all edge cases already; already called by MrAttentionTab |
| Subtask detection | Name-comparison `issuetype.name === 'Sub-task'` | `issuetype.subtask === true` boolean | Admins can rename issue types; boolean is reliable (project-wide decision since Phase 5) |
| Relative timestamps | Custom `Date.now()` arithmetic | `getRelativeTime` from `NotificationRow.tsx` | Already tested; handles secs/mins/hours/days |
| Inline notification detail open/close | Custom modal or drawer | `selectedItemId` useState pattern from `NotificationPopover` | Two components already implement this correctly; just replicate the pattern |
| Deep-link to Jira | Custom URL builder | `window.open(jiraBaseUrl + '/browse/' + issue.key)` | Established pattern used throughout app (same as My Tasks tab) |

**Key insight:** All data transformation and display helpers are already built. Phase 8 is primarily composition — reading existing data and rendering it in new panel shapes.

---

## Common Pitfalls

### Pitfall 1: Cache Key Mismatch for MR Data
**What goes wrong:** `MrHealthPanel` reads `['gitlab-mrs', gitlabBaseUrl]` (two-element key, from the old dashboard query) instead of `['gitlab-mrs', gitlabBaseUrl, userId]` (three-element key, used by MrAttentionTab). The three-element cache is where `mr-health` entries are associated. The health map stays empty, all MRs appear as "Needs Review" even when approved.
**Why it happens:** The existing `dashboard/index.tsx` uses the old two-element key for its `assignedMrs` query. The MrAttentionTab/MyTasksTab use a three-element key.
**How to avoid:** Remove the old `['gitlab-mrs', gitlabBaseUrl]` query from dashboard; use `['gitlab-mrs', gitlabBaseUrl, userId]` exclusively. Requires `userId` from `validateGitLab` (already fetched via `['gitlab-current-user', gitlabBaseUrl]`).
**Warning signs:** All MR counts show only in "Needs Review" bucket; `queryClient.getQueryData(['mr-health', ...])` always returns `undefined`.

### Pitfall 2: Sprint endDate Missing or Board Discovery Fails
**What goes wrong:** `fetchActiveSprint` returns `null` (no boards found, or sprint has no `endDate`). If the component crashes or shows "NaN days left" instead of hiding gracefully, the panel breaks.
**Why it happens:** Jira instances may have only Kanban boards (no scrum), sprints without configured end dates, or Agile API disabled.
**How to avoid:** Apply graceful-hide: when `sprint === null` or `sprint.endDate == null`, hide the "days left" segment entirely — show only the "% done" and "at-risk" segments. Never show `NaN` or negative values.
**Warning signs:** `Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)` returns `NaN` — add null guard before computing.

### Pitfall 3: Orphan Subtask Leak
**What goes wrong:** SubtasksPanel shows subtasks whose parent story is NOT in the current sprint (orphans), violating the CONTEXT decision that orphans are hidden.
**Why it happens:** The `my-tasks` cache contains orphans (they were fetched in `fetchMyTasksHierarchy` Step 4). In `MyTasksTab`, the `groupedData` memo silently drops them from rendering but they remain in the issue list.
**How to avoid:** In SubtasksPanel, filter: keep only subtasks where `issue.fields.issuetype.subtask === true` AND `myIssueKeys.has(issue.key)` AND `issue.fields.parent?.key` is in the sprint issue key set.
**Warning signs:** Subtasks appear whose parent story key is not visible elsewhere in the sprint board.

### Pitfall 4: Points Percentage Denominator Zero
**What goes wrong:** Division by zero when sprint has no issues (new sprint, or sprint board empty). `donePct = donePoints / totalPoints * 100` → `NaN / 0`.
**Why it happens:** Fresh sprint, or API fails to return issues.
**How to avoid:** Guard: `const pct = totalPoints > 0 ? Math.round(donePoints / totalPoints * 100) : 0`.
**Warning signs:** Sprint health shows "NaN% done" or percentage bar renders as negative width.

### Pitfall 5: storyPointsFieldKey Not Included in Sprint-Board Cache Key
**What goes wrong:** SprintHealthPanel reads `['jira-issues', 'sprint-board', activeJiraProject]` but `SprintProgressTab` and `SprintBoardTab` now use `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` (four-element key with the discovered field key). They share a different cache entry — SprintHealthPanel gets stale or empty data.
**Why it happens:** The dashboard's original `sprintIssues` query does not include `storyPointsFieldKey`. All other consumers upgraded to the four-element key.
**How to avoid:** Include `storyPointsFieldKey` from `useSettingsStore` in the SprintHealthPanel's cache key, exactly as `SprintProgressTab` does.
**Warning signs:** `sprintIssues` in the panel is undefined even when SprintProgressTab works fine.

---

## Code Examples

Verified patterns from the existing codebase:

### Subtask Row: Key + Title + Status Badge + Parent Name
```tsx
// SubtasksPanel subtask row — based on existing issue field shapes
<button
  type="button"
  onClick={() => window.open(`${jiraBaseUrl}/browse/${issue.key}`, '_blank')}
  className="w-full text-left flex items-center gap-2 py-1.5 hover:bg-muted/50 rounded px-1"
>
  <span className="font-mono text-xs text-muted-foreground w-20 flex-shrink-0">{issue.key}</span>
  <span className="flex-1 truncate text-sm">{issue.fields.summary}</span>
  <Badge variant="secondary" className="text-xs flex-shrink-0">{issue.fields.status.name}</Badge>
  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
    &lsaquo; {issue.fields.parent?.fields.summary}
  </span>
</button>
```

### Sprint Health: Days Remaining Computation
```tsx
// SprintHealthPanel — guard for missing endDate
function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
```

### At-Risk Detection: In Progress + No Time Logged
```tsx
// Recommended heuristic (from CONTEXT decisions)
const atRiskIssues = sprintIssues
  ?.filter(i =>
    i.fields.status.statusCategory?.key === 'indeterminate' &&
    (i.fields.timetracking?.timeSpentSeconds ?? 0) === 0 &&
    !i.fields.issuetype.subtask  // stories only, not subtasks
  ) ?? [];
```

### MR Health Buckets from Cache
```tsx
// MrHealthPanel — aggregate health across assigned MRs
// Source: MrAttentionTab pattern, adapted for count view
const assignedMrs = (mrQueryData?.filtered ?? []).filter(mr =>
  assignedIids.has(mr.iid)
);
const counts = assignedMrs.reduce(
  (acc, mr) => {
    const health = healthMap.get(mr.iid);
    if (health === 'approved') acc.approved++;
    else if (health === 'changes_requested') acc.changesRequested++;
    else acc.needsReview++;
    return acc;
  },
  { needsReview: 0, approved: 0, changesRequested: 0 }
);
```

### Notifications Panel: Unread Slice + Inline Detail
```tsx
// NotificationsPanel — mirrors NotificationPopover structure exactly
// Source: routes/notifications/NotificationPopover.tsx
const { items, readIds, markAsRead } = useNotificationsStore();
const readSet = new Set(readIds);
const unreadItems = [...items]
  .filter(i => !readSet.has(i.id))
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 3);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple count cards (3 cards) | 4 rich panels with content | Phase 8 | Dashboard becomes the primary overview, eliminating tab navigation for daily status |
| `['gitlab-mrs', gitlabBaseUrl]` (2-element key) | `['gitlab-mrs', gitlabBaseUrl, userId]` (3-element key) | Phase 7 / Quick-12 | Panel must use 3-element key to share health data |
| Sprint-board cache: 3-element key | Sprint-board cache: 4-element key with `storyPointsFieldKey` | Phase 6 | Panel must include storyPointsFieldKey in query key |

**Deprecated/outdated:**
- Old dashboard `assignedMrs` query using `['gitlab-mrs', gitlabBaseUrl]`: superseded by the userId-keyed variant; the old query should be removed.
- Old dashboard `sprintIssues` query without `storyPointsFieldKey`: all sprint data consumers now include this key; dashboard should follow suit.

---

## Open Questions

1. **boardId Discovery for Sprint endDate**
   - What we know: Jira Agile API endpoint is `GET /rest/agile/1.0/board?projectKeyOrId={key}` which returns boards. First board's `id` can be used.
   - What's unclear: Whether the Orange Jira DC v10.3.15 instance has an accessible scrum board for the active project, and whether the Agile REST API is enabled. Jira Server can have the Jira Software addon absent, which would return 404 on agile endpoints.
   - Recommendation: Implement `fetchActiveSprint` with double null-guard (board discovery failure + sprint endDate absence); hide days-remaining gracefully. Do NOT treat this as a hard requirement — the sprint health panel must work even without end date.

2. **MrHealthPanel Data Without Visiting MrAttentionTab**
   - What we know: `mr-health` entries are populated by `MrAttentionTab` and `MyTasksTab` via `useQueries`. If the user navigates directly to the dashboard without visiting these tabs, the health cache entries won't exist yet.
   - What's unclear: Whether MrHealthPanel should fire its own approval queries or simply show counts without health breakdown when cache is cold.
   - Recommendation: MrHealthPanel should fire the same `useQuery` for `['gitlab-mrs', gitlabBaseUrl, userId]` to populate assigned MRs, and can show health counts as "loading" indicator when `mr-health` cache entries are absent (show "—" for each bucket). Alternatively, fire health queries for assigned MRs only (not reviewer) directly in the panel — this is a small, bounded set.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard` |
| Full suite command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | SubtasksPanel shows open subtasks with key + title + status + parent | unit | `npx vitest run src/routes/dashboard/SubtasksPanel.test.tsx` | Wave 0 |
| DASH-01 | SubtasksPanel hides orphan subtasks (parent not in sprint) | unit | same | Wave 0 |
| DASH-01 | SubtasksPanel shows empty state when no open subtasks | unit | same | Wave 0 |
| DASH-02 | MrHealthPanel shows correct bucket counts | unit | `npx vitest run src/routes/dashboard/MrHealthPanel.test.tsx` | Wave 0 |
| DASH-02 | MrHealthPanel shows empty state when no open MRs | unit | same | Wave 0 |
| DASH-03 | SprintHealthPanel shows % done correctly | unit | `npx vitest run src/routes/dashboard/SprintHealthPanel.test.tsx` | Wave 0 |
| DASH-03 | SprintHealthPanel hides days-remaining when endDate absent | unit | same | Wave 0 |
| DASH-03 | SprintHealthPanel lists at-risk items (in-progress + no time logged) | unit | same | Wave 0 |
| DASH-04 | NotificationsPanel shows last 3 unread notifications | unit | `npx vitest run src/routes/dashboard/NotificationsPanel.test.tsx` | Wave 0 |
| DASH-04 | NotificationsPanel shows "No unread notifications" when empty | unit | same | Wave 0 |
| DASH-04 | NotificationsPanel opens inline detail on row click | unit | same | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard`
- **Per wave merge:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/routes/dashboard/SubtasksPanel.test.tsx` — covers DASH-01
- [ ] `src/routes/dashboard/MrHealthPanel.test.tsx` — covers DASH-02
- [ ] `src/routes/dashboard/SprintHealthPanel.test.tsx` — covers DASH-03
- [ ] `src/routes/dashboard/NotificationsPanel.test.tsx` — covers DASH-04

Existing test infrastructure (vitest, jsdom, `@testing-library/react`, mock patterns) is sufficient — no new framework setup needed.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit — `dashboard/index.tsx`, `MyTasksTab.tsx`, `MrAttentionTab.tsx`, `SprintProgressTab.tsx`, `SprintBoardTab.tsx`, `TaskRow.tsx`, `NotificationRow.tsx`, `NotificationDetail.tsx`, `NotificationPopover.tsx`
- Direct store audit — `notifications.store.ts`, `auth.store.ts`, `settings.store.ts`
- Direct service audit — `jira.ts` (confirmed no `fetchActiveSprint` exists), `gitlab.ts`, `linkEngine.ts`
- Jira Agile Server 8.13.0 REST API Reference — confirmed `endDate` field in sprint response from `/rest/agile/1.0/board/{boardId}/sprint?state=active`

### Secondary (MEDIUM confidence)
- WebSearch + Atlassian official docs — Jira Agile API endpoint paths and response shape (`endDate`, `startDate` on sprint object)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already in use; no new dependencies
- Architecture: HIGH — all patterns derived from direct codebase inspection; widget shapes are compositions of existing components
- Sprint endDate API: MEDIUM — endpoint confirmed from official docs; real-instance behaviour on Orange Jira DC v10.3.15 not verified (boardId discovery may return empty)
- Pitfalls: HIGH — cache key mismatch, orphan subtask leak, and zero-denominator are verified against the actual codebase

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (stable — no external API churn expected; Jira DC field shapes well-established)
