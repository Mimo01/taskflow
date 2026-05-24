# Phase 70: Standup Notes — Today Section — Research

**Researched:** 2026-05-25
**Domain:** React / TanStack Query data wiring in a Tauri app — sprint issues, reviewer MRs, pinned tabs, LogWorkPopover
**Confidence:** HIGH (all signatures verified from live source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: Today column renders four sections in fixed order: (1) In Progress, (2) Up Next, (3) MRs Awaiting You, (4) Pinned.
- D-02: MRs Awaiting You is in-scope-by-user-decision; cut before the three locked requirements if needed.
- D-03: Hide a section entirely when 0 items; inline error + retry when fetch fails; full-column empty state when all sections empty.
- D-04: Issue scope = leaf-level work items assigned to me (subtasks AND childless tasks/stories/bugs with no children). Exclude parent stories that have subtasks.
- D-05: Status split by statusCategory.key: indeterminate = In Progress, new = Up Next. Done excluded. Flat list per section.
- D-06: Log Work per-row (both In Progress and Up Next) opens LogWorkPopover pre-filled with initialDate=today and issueKey=that issue. No separate section.
- D-07: Whole row click → onIssueClick(key). Log Work button is secondary — must stop propagation.
- D-08: Pinned = read-only; no pin/unpin controls on this page.
- D-09: Pinned: Jira issues resolved via fetchIssueMeta; AIO cycles from pinnedCycleMeta. Click → onIssueClick (Jira) or navigate(`/aio-cycle/${meta.projectKey}/${key}`) (AIO).
- D-10: MRs Awaiting You from fetchReviewerMRs; show MR title/IID and review state consistent with existing MR review-health logic.

### Claude's Discretion

- Status-split + grouping: locked to flat list (statusCategory); planner may refine row layout.
- LogWorkPopover trigger styling per row (icon-only vs labeled).
- Whether to query via fetchSprintIssues(assignedToMe=true) or shared sprint-board cache + client-side filter.
- Whether MRs review-state badge derives from existing review-health util or lightweight inline computation.
- Whether Today column extends "Copy markdown" output (not required; planner may include if cheap).
- Story-points field key resolution (reuse storyPointsFieldKey plumbing).

### Deferred Ideas (OUT OF SCOPE)

- Manual curated worklog-targets list (own persisted store with add/remove UI).
- Extending "Copy markdown" to include Today section (not required by STAND-07/08/09).
- Grouping sprint subtasks under parent story (flat list chosen per mockup).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAND-07 | Today section shows my open subtasks/tasks in the current sprint (assignee = me) | fetchSprintIssues(assignedToMe=true) returns subtasks + parents; client-side leaf filter maps to D-04/D-05 |
| STAND-08 | Today section shows pinned issues (read-only) | usePinnedTabsStore pinnedKeys + pinnedCycleMeta; fetchIssueMeta for Jira pins |
| STAND-09 | Today section shows planned worklog targets — issues I plan to log time against today | LogWorkPopover per-row; invalidate ['standup', 'tempo', ...] on success |

</phase_requirements>

---

## Summary

Phase 70 is nearly entirely a wiring phase. Every data service, UI primitive, and auth value it needs exists in the codebase and has been verified in this session. The research task is confirming exact signatures and identifying the few genuine decisions the planner must make.

**The three concrete decisions the planner must make** (not pre-decided in CONTEXT.md):

1. **Sprint-issues query strategy**: use the existing shared sprint-board cache key `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` with `assignedToMe=false` and filter client-side by `jiraUserDisplayName`, OR use a separate query with `assignedToMe=true` (different cache key, no sharing). Recommendation is given in the "In Progress / Up Next Data Path" section below.

2. **Review state on fetchReviewerMRs**: the `GitLabMR` interface does NOT include a `review_state` field — only the full `GitLabMRDetail` has approval data, and computing it requires extra API calls per MR. The UI-SPEC's review-state derivation (`review_state === null` vs `'changes_requested'`) does not match what the API actually returns. See "Critical Discrepancy" section.

3. **Logged-time chip for In Progress rows**: there is no pre-existing "today's worklog per issue" query. The today Tempo worklogs must be a new `useQuery` in TodayColumn or in the parent page; the UI-SPEC references invalidating `['standup', 'tempo', ...]` but that key uses `yesterdayDate`, not today. A separate today-scoped query is required.

**Primary recommendation:** Use a separate `fetchSprintIssues(…, true, …)` query with a dedicated cache key so the Today column does not depend on the sprint board being warm. MRs Awaiting You should derive review state from `review_state` field if present on the base MR object (verify at runtime), or fall back to showing "awaiting review" for all non-filtered MRs. Logged-time chip requires a new today-scoped Tempo query in TodayColumn.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sprint issue fetch + filter | Frontend (TodayColumn) | Jira REST API | TanStack Query caches; filter is client-side on already-fetched issues |
| Status-category split | Frontend (TodayColumn) | — | Pure client-side filter on `statusCategory.key`; no server involvement |
| Leaf item detection | Frontend (TodayColumn) | — | `issuetype.subtask` flag + `subtasks.length === 0` check client-side |
| Logged-time chip | Frontend (TodayColumn) | Tempo REST API | New today-scoped useQuery wrapping fetchWorklogs |
| Log Work submit | LogWorkPopover | Jira REST API | Already encapsulated; TodayColumn only passes issueKey + initialDate |
| Log Work invalidation | TodayColumn (onSuccess) | TanStack QueryClient | Must invalidate today-worklogs query key after LogWorkPopover.onSuccess |
| Pinned keys read | Frontend (TodayColumn) | Zustand store | usePinnedTabsStore — no API call; already persisted |
| Pinned Jira meta fetch | Frontend (TodayColumn) | Jira REST API | fetchIssueMeta batch; similar to issueMetaQuery in StandupNotesPage |
| AIO cycle navigation | Frontend (TodayColumn) | React Router | navigate(`/aio-cycle/${meta.projectKey}/${key}`) per main.tsx pattern |
| Reviewer MRs fetch | Frontend (TodayColumn) | GitLab REST API | fetchReviewerMRs; review state derivation is client-side |
| Review state derivation | Frontend (TodayColumn) | — | Filter client-side on MR object fields (see discrepancy below) |

---

## Verified Signatures

### fetchSprintIssues [VERIFIED: source file]

**File:** `taskflow/src/services/jira.ts` line 354

```typescript
export async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = true,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<JiraIssue[]>
```

**What it returns:** `JiraIssue[]` — a flat array that includes BOTH parent issues AND subtasks. The function does its own two-query strategy internally: first fetches parents (`issuetype not in subtaskIssueTypes()`), then fetches subtasks for those parents in 50-key chunks. When `assignedToMe=true`, the assignee clause is added to BOTH the parent query AND the subtask query.

**Fields included in response:** `summary, status, assignee, issuetype, parent, subtasks, timetracking` — and story-point fields. The `issuetype.subtask` boolean is present. `statusCategory` is on `status.statusCategory.key` (type: `'new' | 'indeterminate' | 'done'`).

**Cache key used by DashboardInProgressCard (and SprintBoardTab/SprintHealthPanel):**
```
['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]
```
This key uses `assignedToMe=false`. If TodayColumn calls `fetchSprintIssues(…, true, …)`, the cache key would need to include an `assignedToMe` discriminator — otherwise it would pollute the shared sprint-board cache. **Recommendation: use a separate query key** (`['jira-issues', 'sprint-board-mine', activeJiraProject, storyPointsFieldKey]`) with `assignedToMe=true` to avoid cache cross-contamination.

---

### Leaf Item Filter [VERIFIED: source file]

From `DashboardInProgressCard.tsx` line 57:
```typescript
const myInProgressSubtasks = sprintIssues.filter(
  (issue) =>
    issue.fields.issuetype.subtask &&
    issue.fields.status.statusCategory?.key === 'indeterminate' &&
    issue.fields.assignee?.displayName === jiraUserDisplayName,
);
```

**Phase 70 adaptation for D-04** (leaf items = subtasks + childless tasks):
```typescript
const isLeaf = (issue: JiraIssue) =>
  issue.fields.issuetype.subtask ||
  (!issue.fields.issuetype.subtask && (issue.fields.subtasks?.length ?? 0) === 0);

const isAssignedToMe = (issue: JiraIssue) =>
  issue.fields.assignee?.displayName === jiraUserDisplayName;

const inProgress = sprintIssues.filter(
  (i) => isLeaf(i) && isAssignedToMe(i) && i.fields.status.statusCategory?.key === 'indeterminate',
);
const upNext = sprintIssues.filter(
  (i) => isLeaf(i) && isAssignedToMe(i) && i.fields.status.statusCategory?.key === 'new',
);
```

**`jiraUserDisplayName` comes from:** `useAuthStore((s) => s.jiraUserDisplayName)` (verified in `auth.store.ts` line 24 and line 40). It is distinct from `jiraUsername` — use `jiraUserDisplayName` for the filter, matching `DashboardInProgressCard`.

---

### Story Points [VERIFIED: source file]

`storyPointsFieldKey` lives in `useSettingsStore((s) => s.storyPointsFieldKey)` (verified in `settings.store.ts` line 27). It defaults to `'customfield_10016'`. The `JiraIssue.fields` interface has `[key: string]: unknown` index signature, so `issue.fields[storyPointsFieldKey] as number | null` is valid. The sprint-issues response also always includes `customfield_10016` and `customfield_10028` regardless of the passed field key (see `fetchSprintIssues` line 367-369 — deduplicated union of the three keys).

---

### LogWorkPopover [VERIFIED: source file]

**File:** `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` line 20

```typescript
interface LogWorkPopoverProps {
  issueKey: string;
  jiraBaseUrl: string;
  onSuccess?: () => void;
  /** Pre-fill the date input with this YYYY-MM-DD value. Defaults to today. */
  initialDate?: string;
}
```

**Export:** Named export — `export function LogWorkPopover(...)`. Import path: `@/routes/dashboard/issue-detail/LogWorkPopover`.

**Trigger rendered by:** The component renders its own `<PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>` with a `Clock` icon + "Log Work" text (line 93). No custom trigger needed; the built-in trigger is the `outline` variant Button.

**On success invalidates:** `['jira-issue-detail', issueKey, jiraBaseUrl]` and `['jira-worklogs', issueKey, jiraBaseUrl]` internally. It does NOT invalidate the Tempo worklogs query. The `onSuccess` callback prop is where TodayColumn must trigger its today-worklogs invalidation.

**`todayString()` helper:** Defined locally in `LogWorkPopover.tsx` (line 28). It is NOT exported. TodayColumn must replicate the same pattern:
```typescript
// TZ-safe YYYY-MM-DD (same pattern as LogWorkPopover.todayString)
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

---

### fetchIssueMeta [VERIFIED: source file]

**File:** `taskflow/src/services/jira.ts` line 1014

```typescript
export async function fetchIssueMeta(
  baseUrl: string,
  token: string,
  keys: string[],
): Promise<Record<string, StandupIssueMeta>>
```

Returns a map `issueKey → { type?, isSubtask?, summary?, parentKey?, parentSummary?, parentType? }`. Returns `{}` on any failure (graceful degradation). Returns `{}` immediately when `keys.length === 0`.

**Already imported in StandupNotesPage.tsx** (line 24). TodayColumn will need to call it directly with the pinned Jira keys.

**Pinned-items query key (recommended):**
```
['standup', 'pinned-meta', jiraBaseUrl, sortedPinnedJiraKeys]
```
where `sortedPinnedJiraKeys` is the alphabetically sorted list of Jira-only pinned keys (to keep the key stable regardless of insertion order). This avoids re-fetching when no keys changed.

---

### fetchReviewerMRs [VERIFIED: source file]

**File:** `taskflow/src/services/gitlab.ts` line 362

```typescript
export async function fetchReviewerMRs(
  baseUrl: string,
  token: string,
  userId: number,
): Promise<GitLabMR[]>
```

Returns `GitLabMR[]` — the same base MR interface. Note `userId` is typed `number` (not `string`). `gitlabUserId` in `useAuthStore` is `number | null` (verified from auth store usage in `useNotificationPolling.ts` and `MrHealthPanel.tsx`).

**GitLabMR interface** (line 186 in gitlab.ts) does NOT have a `review_state` field. The existing `ReviewHealth` type (`'approved' | 'changes_requested' | 'waiting_for_review'`) comes from `deriveReviewHealth(approvals, discussions)` in `linkEngine.ts` — it requires fetching per-MR approvals and discussions, which is expensive.

---

## Critical Discrepancy: MR Review State

**What UI-SPEC says:** Derive review state from `review_state` field on the MR object (`review_state === null` = "awaiting review"; `review_state === 'changes_requested'` = "changes requested").

**What the code actually has:** `GitLabMR` (the type returned by `fetchReviewerMRs`) does NOT contain a `review_state` field. This field does not exist on the base `GitLabMR` interface. It is not in the GitLab API `/merge_requests?reviewer_id=...` response at the list endpoint level.

**Resolution options the planner must choose between:**

A. **Lightweight approach (recommended):** Treat all MRs returned by `fetchReviewerMRs` as "awaiting review" (since the GitLab list endpoint does not return per-reviewer state). Show all as "awaiting review" label. This is consistent with "open MRs where I'm a reviewer" — if they're open and I'm a reviewer, I haven't approved yet (GitLab removes approved MRs from the reviewer's list by convention, though this depends on GitLab version). Filter: show only `state === 'opened'` (already filtered by the API call). No extra per-MR API calls.

B. **Full derivation:** For each returned MR, call `fetchMRApprovals` + `fetchMRDiscussions`, then use `deriveReviewHealth`. This is O(N) extra API calls and inappropriate for a standup column. Too expensive.

C. **Check for GitLab `reviewers[].state` sub-field:** Some GitLab EE/SaaS versions include reviewer-level approval state in the MR list endpoint (the `reviewers` array on `GitLabMR` has `{ id, name, username }` — no `state` sub-field in the current interface). Would need to verify against the actual GitLab instance at runtime.

**Planner recommendation: use Option A.** Show all returned MRs as "awaiting review" (the `review_state === null` case from the UI-SPEC). The "changes requested" state is aspirational for this phase but requires per-MR extra calls not compatible with the standup column's load budget. If desired in a future phase, a `fetchMRApprovals` enrichment step can be added. This aligns with the UI-SPEC which says "When `review_state === 'approved'`, filter it out" — since we can't detect approved at list level, we show all opened non-approved MRs, which is the correct conservative behavior.

---

## Logged-Time Chip Data Path

**What the UI-SPEC requires:** Show today's logged time (from Tempo) per issue as a chip on In Progress rows.

**Existing `['standup', 'tempo', ...]` query key** in StandupNotesPage is scoped to `yesterdayDate`, not today:
```typescript
queryKey: ['standup', 'tempo', jiraBaseUrl, yesterdayDate, jiraUsername ?? ''],
```
This is the *Yesterday* column's query. TodayColumn needs today's worklogs.

**Required: new TodayColumn-owned query:**
```typescript
const todayStr = todayString(); // YYYY-MM-DD, TZ-safe
const todayTempoQuery = useQuery({
  queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
  queryFn: () =>
    fetchWorklogs(jiraBaseUrl!, jiraToken!, [jiraUsername!], todayStr, todayStr),
  enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!jiraUsername,
  staleTime: 5 * 60 * 1000,
});
```

**Building the per-issue logged seconds map:**
```typescript
const todayLoggedByIssue = useMemo(() => {
  const map = new Map<string, number>();
  for (const w of todayTempoQuery.data ?? []) {
    map.set(w.issue.key, (map.get(w.issue.key) ?? 0) + w.timeSpentSeconds);
  }
  return map;
}, [todayTempoQuery.data]);
```

**Invalidation after LogWorkPopover success:**
```typescript
// In TodayColumn, pass onSuccess to LogWorkPopover:
onSuccess={() => {
  void queryClient.invalidateQueries({
    queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
  });
}}
```

**Import path for fetchWorklogs:** `@/services/tempo` (re-exported from `taskflow/src/services/tempo/worklogs.ts`; already imported in StandupNotesPage).

**When Tempo is disabled:** Do not render the logged-time chip at all (gate on `tempoEnabled`). The `todayTempoQuery` is disabled when `!tempoEnabled`, so `todayLoggedByIssue` will be empty — chips simply don't render.

---

## Pinned Resolution Pattern

```typescript
// In TodayColumn:
const { pinnedKeys, pinnedCycleMeta } = usePinnedTabsStore();

const pinnedJiraKeys = pinnedKeys.filter((k) => !(k in pinnedCycleMeta));
const pinnedCycleKeys = pinnedKeys.filter((k) => k in pinnedCycleMeta);

const sortedJiraKeys = [...pinnedJiraKeys].sort(); // stable query key

const pinnedMetaQuery = useQuery({
  queryKey: ['standup', 'pinned-meta', jiraBaseUrl, sortedJiraKeys],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No Jira token');
    return fetchIssueMeta(jiraBaseUrl!, token, sortedJiraKeys);
  },
  enabled: !!jiraBaseUrl && !!jiraToken && sortedJiraKeys.length > 0,
  staleTime: 60 * 60 * 1000,
});
```

**AIO cycle click navigation (verified from `main.tsx` line 524-526):**
```typescript
// Exact pattern from main.tsx — reuse directly:
if (key.includes('-CY-')) {
  const meta = pinnedCycleMeta[key];
  if (meta) navigate(`/aio-cycle/${meta.projectKey}/${key}`);
}
```
TodayColumn receives `onIssueClick` from outlet context. For cycle navigation, TodayColumn needs `useNavigate()` directly (since `onIssueClick` only handles Jira issues). This is consistent with the existing pattern.

**Cycle key identification:** AIO cycle keys always contain `-CY-` (verified from main.tsx line 167-168). The presence of the key in `pinnedCycleMeta` is the primary discriminator per D-09.

---

## StandupNotesPage Integration Point

**Exact replacement (verified from file, line 321-324):**

```tsx
// BEFORE (line 321-324):
{/* Right column — Today placeholder (50%) */}
<div className="w-1/2 overflow-auto">
  <TodayColumnPlaceholder />
</div>

// AFTER:
<div className="w-1/2 overflow-auto">
  <TodayColumn onIssueClick={onIssueClick} />
</div>
```

TodayColumn reads stores directly (does NOT need auth/settings props drilled from the page). The page already reads `jiraToken` and `gitlabToken` via `useState + useEffect + readSecret`. TodayColumn should replicate that local token-loading pattern OR read tokens inside query functions via `readSecret()` (the Pattern established in Phase 69: T-62-06).

**`jiraUserDisplayName` availability:** `useAuthStore()` in `StandupNotesPage.tsx` line 79-89 currently destructures: `jiraBaseUrl, gitlabBaseUrl, activeJiraProject, activeGitlabProject, jiraUsername, jiraUserKey, gitlabUserId, gitlabUsername`. It does NOT destructure `jiraUserDisplayName` — but it exists in the store. TodayColumn will access it via `useAuthStore((s) => s.jiraUserDisplayName)`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/routes/standup-notes/
├── StandupNotesPage.tsx        (modify: replace TodayColumnPlaceholder with TodayColumn)
├── TodayColumnPlaceholder.tsx  (delete or keep for reference)
├── TodayColumn.tsx             (NEW: top-level column; owns 3 useQuery calls)
├── TodayInProgressSection.tsx  (NEW: In Progress rows)
├── TodayUpNextSection.tsx      (NEW: Up Next rows)
├── TodayMrsSection.tsx         (NEW: MRs Awaiting You rows)
├── TodayPinnedSection.tsx      (NEW: Pinned rows — Jira + AIO)
├── YesterdayColumn.tsx         (unchanged)
└── ...                         (existing Phase 69 files)
```

### TodayColumn Query Architecture

TodayColumn owns **four** independent queries:

| Query | Key | Purpose |
|-------|-----|---------|
| Sprint issues | `['jira-issues', 'sprint-board-mine', activeJiraProject, storyPointsFieldKey]` | In Progress + Up Next items |
| Today Tempo worklogs | `['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername]` | Logged-time chips |
| Reviewer MRs | `['standup', 'reviewer-mrs', gitlabBaseUrl, gitlabUserId]` | MRs Awaiting You |
| Pinned Jira meta | `['standup', 'pinned-meta', jiraBaseUrl, sortedPinnedJiraKeys]` | Pinned section |

The In Progress + Up Next sections share the single sprint-issues query result (split client-side). This is 4 queries total — consistent with the page's existing 4-query pattern in YesterdayColumn.

### Pattern: Per-section error/loading (from YesterdayColumn)

YesterdayColumn (lines 488-574) establishes the pattern: per-section `isLoading` renders `<LoadingSkeletons />`, `isError` renders `<ErrorState ... onRetry={() => void query.refetch()} />`, empty data hides the section. TodayColumn follows the same pattern per the UI-SPEC.

```typescript
// LoadingSkeletons — copy from YesterdayColumn (same structure):
function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
```

### Pattern: useDelayedLoading

```typescript
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
// ...
const showSprintSkeleton = useDelayedLoading(sprintQuery.isLoading);
```
`useDelayedLoading(isPending, delayMs = 200)` — delay defaults to 200ms; no arg needed for standard use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Story point display | Custom field resolution | `issue.fields[storyPointsFieldKey] as number \| null` | fetchSprintIssues already requests this field |
| Duration formatting | Custom "1h 30m" formatter | `formatDuration(seconds)` from `@/services/jira/duration` | Already tested; handles 0, negative, sub-minute |
| Today date string | `new Date().toLocaleDateString()` | `todayString()` pattern (YYYY-MM-DD) | Phase 62 rule: never toLocaleDateString() for comparisons |
| Skeleton bar | Custom loading div | `<Skeleton className="h-4 w-full" />` from `@/components/ui/skeleton` | Matches existing column patterns |
| Error state | Custom error div | `<ErrorState error={...} onRetry={...} viewName="..." />` from `@/components/ui/error-state` | Matches YesterdayColumn pattern |
| Empty state | Custom empty div | `<EmptyState icon={...} title="..." subtitle="..." />` from `@/components/ui/empty-state` | Already used in TodayColumnPlaceholder |
| Issue type icon | Custom icon lookup | `<IssueTypeIcon typeName={...} />` from `@/components/ui/issue-type-icon` | Used by both DashboardInProgressCard and YesterdayColumn |
| MR review health logic | Custom approval check | Show "awaiting review" for all opened reviewer MRs (Option A above) | Per-MR approval fetch is too expensive for standup column |
| Token reading | useState + token prop | `await readSecret('jira-pat')` inside queryFn closure | T-62-06: tokens never in queryKey |

---

## Common Pitfalls

### Pitfall 1: Shared Sprint-Board Cache Contamination
**What goes wrong:** TodayColumn calls `fetchSprintIssues(…, true, …)` with the same cache key `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` — this overwrites the full sprint-board data with the assignee-filtered subset, breaking SprintBoardTab and DashboardSprintCard.
**Why it happens:** `DashboardInProgressCard` uses `assignedToMe=false` with that key. If TodayColumn uses the same key but `assignedToMe=true`, TanStack Query treats them as the same cache entry.
**How to avoid:** Use a distinct key: `['jira-issues', 'sprint-board-mine', activeJiraProject, storyPointsFieldKey]` for the Today column's sprint query.
**Warning signs:** Sprint board shows only the current user's issues; other users' tasks disappear.

### Pitfall 2: Tokens in QueryKey (T-62-06)
**What goes wrong:** Passing `jiraToken` or `gitlabToken` as a queryKey segment exposes the secret in React DevTools and logs, and creates a key that changes on every token rotation (unnecessary refetch).
**Why it happens:** Easy copy of naive patterns.
**How to avoid:** All tokens are read via `readSecret('jira-pat')` inside the `queryFn` closure. The `enabled` flag uses the pre-loaded token state (as in StandupNotesPage's `useEffect` token loading) to prevent the query from firing until a token is confirmed to exist.

### Pitfall 3: Date via toLocaleDateString
**What goes wrong:** `new Date().toLocaleDateString()` returns locale-formatted strings that vary by OS locale settings. Comparing them against YYYY-MM-DD API strings silently fails.
**Why it happens:** `toLocaleDateString()` looks like the right API.
**How to avoid:** Always use the explicit `todayString()` pattern: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`. Phase 62 standing rule.

### Pitfall 4: Log Work Button Triggers Row Navigation
**What goes wrong:** Clicking the "Log Work" button inside the issue row `<button>` triggers the outer button's `onClick` (navigation) as well as the popover open.
**Why it happens:** Event bubbling through nested interactive elements.
**How to avoid:** The LogWorkPopover trigger must be wrapped in a `<span onClick={(e) => e.stopPropagation()}>` or the `LogWorkPopover` itself must call `e.stopPropagation()` on its trigger click. The UI-SPEC shows `onClick={(e) => e.stopPropagation()}` on the LogWorkPopover element.

### Pitfall 5: Whole-Store Settings Destructure
**What goes wrong:** `const { storyPointsFieldKey, tempoEnabled, ... } = useSettingsStore()` causes re-render on every settings change, not just relevant fields.
**Why it happens:** Convenient but violates Phase 68 standing rule.
**How to avoid:** `const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey)` — one selector per field.

### Pitfall 6: AIO Cycle Navigation Without useNavigate
**What goes wrong:** Trying to call `onIssueClick(key)` for an AIO cycle key — `onIssueClick` routes to `/issue/KEY` which doesn't exist for cycles.
**Why it happens:** `onIssueClick` comes from outlet context and is Jira-only.
**How to avoid:** In TodayPinnedSection, detect cycle keys by `key in pinnedCycleMeta`, then call `navigate(`/aio-cycle/${meta.projectKey}/${key}`)` from `useNavigate()` instead of `onIssueClick`.

### Pitfall 7: fetchSprintIssues Does Not Return subtasks Field Populated
**What goes wrong:** The parent issues returned by the internal second query have `subtasks` in the fields list for the first-query parents, but the subtask rows themselves (second query) use `subtaskFields = 'summary,status,assignee,issuetype,parent,timetracking'` — `subtasks` is NOT included for the subtask issues themselves (they can't have subtasks anyway). The `issue.fields.subtasks` check for childlessness only applies to non-subtask issues (Stories, Tasks, Bugs). Subtasks are always leaf items via `issuetype.subtask === true`.
**How to avoid:** The leaf filter is: `issuetype.subtask === true` (always leaf) OR `issuetype.subtask === false && (issue.fields.subtasks?.length ?? 0) === 0` (childless task/story/bug). The second condition requires `subtasks` to be in the fields response — which it IS for parent issues (line 370 of jira.ts: `parent,subtasks,timetracking` in fields string).

---

## Validation Architecture

Nyquist validation is enabled (`nyquist_validation: true` in config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run | `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -30` |
| Full suite | `cd taskflow && npx vitest run` |
| Build verify | `cd taskflow && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Automated Command |
|--------|----------|-----------|------|-------------------|
| STAND-07 | Filter: leaf items assigned to me split by status category | unit | `TodayColumn.test.ts` (new) | `npx vitest run src/routes/standup-notes/TodayColumn.test.ts` |
| STAND-07 | In Progress shows `statusCategory.key === 'indeterminate'` items only | unit | `TodayColumn.test.ts` | same |
| STAND-07 | Up Next shows `statusCategory.key === 'new'` items only | unit | `TodayColumn.test.ts` | same |
| STAND-07 | Done items excluded from both sections | unit | `TodayColumn.test.ts` | same |
| STAND-07 | Leaf item detection: subtask = always leaf; childless task = leaf; task-with-subtasks = not leaf | unit | `TodayColumn.test.ts` | same |
| STAND-08 | Pinned section shows Jira keys (from pinnedKeys not in pinnedCycleMeta) | integration | `TodayColumn.test.ts` | same |
| STAND-08 | Pinned section shows AIO cycles (from pinnedCycleMeta keys) | integration | `TodayColumn.test.ts` | same |
| STAND-08 | Pinned: no pin/unpin controls rendered | unit | `TodayColumn.test.ts` | same |
| STAND-09 | Log Work button present on In Progress rows | render | `TodayColumn.test.ts` | same |
| STAND-09 | Log Work button present on Up Next rows | render | `TodayColumn.test.ts` | same |
| STAND-09 | Log Work button click does NOT trigger row navigation | interaction | `TodayColumn.test.ts` | same |
| STAND-09 | LogWorkPopover pre-filled with today's date | render | manual (popover state internal to LogWorkPopover) | manual |
| MRs (scope add) | MRs section hidden when GitLab not connected | render | `TodayColumn.test.ts` | same |
| MRs (scope add) | Review state label classes correct (amber for changes_requested) | unit | `TodayMrsSection.test.tsx` (new) | `npx vitest run src/routes/standup-notes/TodayMrsSection.test.tsx` |

### What Is Realistically Unit-Testable

The filter logic (leaf detection, status-category split, assignee match) is pure client-side — **highest value unit test target**. Extract these into a helper function `filterSprintItems(issues, jiraUserDisplayName)` that returns `{ inProgress, upNext }`. This function is pure and trivially testable without mocking.

The Logged-time chip (`formatDuration`) is already tested in `src/services/jira/duration.test.ts`. No new tests needed there.

The MR review-state label derivation (Option A: all opened MRs = "awaiting review") has no computation — just a static label. The amber CSS class for "changes requested" can be tested in a render test if that path is implemented.

The pinned key discrimination (`key in pinnedCycleMeta`) is trivially testable.

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/routes/standup-notes/ --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full vitest suite green + `npm run build` with zero errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/routes/standup-notes/TodayColumn.test.ts` — covers STAND-07, STAND-08, STAND-09 filter/render tests
- [ ] `src/routes/standup-notes/TodayMrsSection.test.tsx` — covers MR review-state label rendering (optional; include if MRs section is non-trivial)

*(Existing test infrastructure: vitest + jsdom + @testing-library/react already configured. Phase 69 established the YesterdayColumn test pattern to mirror.)*

---

## Package Legitimacy Audit

No new packages are installed in this phase. All UI primitives (Skeleton, EmptyState, ErrorState, IssueTypeIcon, LogWorkPopover) and all services (fetchSprintIssues, fetchReviewerMRs, fetchIssueMeta, fetchWorklogs, formatDuration) already exist in the codebase.

**Packages removed due to slopcheck:** none  
**Packages flagged as suspicious:** none

---

## Environment Availability

Step 2.6: SKIPPED — this phase installs no new tools, packages, or external services. All dependencies are already in the codebase and confirmed to build (`npm run build` per STATE.md standing rule).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `toLocaleDateString()` for dates | `.slice(0,10)` / explicit formatting | Phase 62 | Required; TZ-safe comparisons |
| Whole-store `useSettingsStore()` destructure | Fine-grained per-field selectors | Phase 68 | Required; prevents unnecessary re-renders |
| Token in queryKey | Token read inside queryFn via readSecret() | T-62-06 (Phase 62) | Required; security + cache stability |

---

## Open Questions

1. **MR review_state field existence at runtime**
   - What we know: `GitLabMR` interface has no `review_state` field. GitLab list endpoint does not guarantee this field.
   - What's unclear: Some GitLab EE instances may include `reviewer[].state` in list responses.
   - Recommendation: Proceed with Option A (all opened reviewer MRs = "awaiting review"). Add a note in code comments that `review_state` could be added as optional enrichment in a future phase.

2. **`gitlabUserId` type in auth store**
   - What we know: `fetchReviewerMRs` takes `userId: number`. Auth store has `gitlabUserId`.
   - What's unclear: The exact TypeScript type of `gitlabUserId` in `useAuthStore` was not read directly.
   - Recommendation: Verify `gitlabUserId: number | null` (consistent with `MrHealthPanel.tsx` and `useNotificationPolling.ts` usages that pass it directly to `fetchReviewerMRs`). Use `!!gitlabUserId` as the enabled guard.

---

## Sources

### Primary (HIGH confidence — verified from source files)

- `taskflow/src/services/jira.ts` lines 354-433 — `fetchSprintIssues` exact signature + two-query strategy
- `taskflow/src/services/jira.ts` lines 1014-1051 — `fetchIssueMeta` signature + StandupIssueMeta type
- `taskflow/src/services/gitlab.ts` lines 362-394 — `fetchReviewerMRs` signature + GitLabMR type (line 186)
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` — Props interface, trigger rendering, onSuccess invalidations
- `taskflow/src/stores/pinned-tabs.store.ts` — PinnedTabsState shape, pinnedCycleMeta type
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — canonical cache key + filter pattern
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — exact integration point (line 321-324), existing query keys, token loading pattern
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — per-section loading/error/empty pattern to mirror
- `taskflow/src/main.tsx` lines 524-526 — AIO cycle navigation pattern
- `taskflow/src/stores/auth.store.ts` — `jiraUserDisplayName` field existence
- `taskflow/src/stores/settings.store.ts` — `storyPointsFieldKey` location
- `taskflow/src/services/linkEngine.ts` line 119-134 — `deriveReviewHealth` + `ReviewHealth` type
- `taskflow/vitest.config.ts` + existing test files — test framework configuration

### Secondary (MEDIUM confidence)

- `taskflow/src/services/jira/duration.ts` — `formatDuration` exists and is importable from `@/services/jira/duration`
- `taskflow/src/hooks/useDelayedLoading.ts` — signature `(isPending: boolean, delayMs = 200): boolean`

---

## Metadata

**Confidence breakdown:**
- Exact signatures: HIGH — read directly from source
- Cache keys: HIGH — verified against DashboardInProgressCard and StandupNotesPage
- MR review state: MEDIUM — GitLabMR interface confirmed; runtime API behavior is assumption
- Validation architecture: HIGH — based on verified test infrastructure and existing patterns

**Research date:** 2026-05-25  
**Valid until:** 2026-06-25 (stable codebase; these files change infrequently)
