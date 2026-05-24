# Phase 70: Standup Notes — Today Section - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 8 (6 new + 1 modified + 1 test)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/routes/standup-notes/TodayColumn.tsx` | component (column) | request-response, 4 queries | `YesterdayColumn.tsx` + `StandupNotesPage.tsx` | exact |
| `src/routes/standup-notes/TodayInProgressSection.tsx` | component (section) | CRUD | `DashboardInProgressCard.tsx` row pattern | role-match |
| `src/routes/standup-notes/TodayUpNextSection.tsx` | component (section) | CRUD | `DashboardInProgressCard.tsx` row pattern | role-match |
| `src/routes/standup-notes/TodayMrsSection.tsx` | component (section) | request-response | `MrRow.tsx` review-state rendering | role-match |
| `src/routes/standup-notes/TodayPinnedSection.tsx` | component (section) | CRUD | `YesterdayColumn.tsx` issue group pattern | role-match |
| `src/routes/standup-notes/filterSprintItems.ts` | utility | transform | `DashboardInProgressCard.tsx` lines 57-62 filter | exact |
| `src/routes/standup-notes/StandupNotesPage.tsx` (modify) | component (page) | request-response | itself (lines 321-324 swap) | exact |
| `src/routes/standup-notes/TodayColumn.test.ts` | test | unit + render | `YesterdayColumn.test.ts` + `YesterdayColumn.tempo-disabled.test.tsx` | exact |

---

## Pattern Assignments

### `src/routes/standup-notes/TodayColumn.tsx` (column, request-response)

**Analogs:** `YesterdayColumn.tsx` (section rendering pattern) + `StandupNotesPage.tsx` (token loading + query structure)

**Imports pattern** — copy from `StandupNotesPage.tsx` lines 15-31, adapt:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchReviewerMRs } from '@/services/gitlab';
import { fetchIssueMeta, fetchSprintIssues } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { readSecret } from '@/services/stronghold';
import { fetchWorklogs } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useSettingsStore } from '@/stores/settings.store';
```

**Settings selectors pattern** — fine-grained, from `StandupNotesPage.tsx` line 92:

```typescript
// IN-01: one selector per field — never destructure whole store (Phase 68 rule)
const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
```

**Auth store pattern** — from `StandupNotesPage.tsx` lines 79-89:

```typescript
const {
  jiraBaseUrl,
  gitlabBaseUrl,
  activeJiraProject,
  jiraUsername,
  gitlabUserId,
} = useAuthStore();
// jiraUserDisplayName is NOT in the page's current destructure — access separately:
const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);
```

**Token loading pattern (T-62-06)** — from `StandupNotesPage.tsx` lines 97-115; tokens loaded into local state, never into queryKey:

```typescript
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

**Sprint issues query** — distinct key from shared sprint-board to avoid cache contamination (RESEARCH.md Pitfall 1):

```typescript
const sprintQuery = useQuery({
  queryKey: ['jira-issues', 'sprint-board-mine', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, true, storyPointsFieldKey),
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  staleTime: 30_000,
});
```

**Today Tempo worklogs query** — new query; shares prefix `'standup'` with page's other queries:

```typescript
// TZ-safe today string (same pattern as LogWorkPopover.todayString — NOT exported)
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayStr = useMemo(() => todayString(), []);

const todayTempoQuery = useQuery({
  queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
  queryFn: () =>
    fetchWorklogs(jiraBaseUrl!, jiraToken!, [jiraUsername!], todayStr, todayStr),
  enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!jiraUsername,
  staleTime: 5 * 60 * 1000,
});
```

**Reviewer MRs query** — from RESEARCH.md verified signature:

```typescript
const reviewerMrsQuery = useQuery({
  queryKey: ['standup', 'reviewer-mrs', gitlabBaseUrl, gitlabUserId],
  queryFn: async () => {
    const token = await readSecret('gitlab-pat').catch(() => null);
    if (!token) throw new Error('No GitLab token');
    return fetchReviewerMRs(gitlabBaseUrl!, token, gitlabUserId!);
  },
  enabled: !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId,
  staleTime: 5 * 60 * 1000,
});
```

**Pinned meta query** — from `StandupNotesPage.tsx` `issueMetaQuery` pattern (lines 235-244), adapted for pinned keys:

```typescript
const { pinnedKeys, pinnedCycleMeta } = usePinnedTabsStore();
const pinnedJiraKeys = pinnedKeys.filter((k) => !(k in pinnedCycleMeta));
const sortedJiraKeys = useMemo(() => [...pinnedJiraKeys].sort(), [pinnedJiraKeys]);

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

**LogWorkPopover onSuccess invalidation pattern** — from RESEARCH.md + `StandupNotesPage.tsx` query key conventions:

```typescript
const queryClient = useQueryClient();
// Pass to each LogWorkPopover instance:
const handleLogWorkSuccess = () => {
  void queryClient.invalidateQueries({
    queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
  });
};
```

**Column heading structure** — from `TodayColumnPlaceholder.tsx` lines 39-44 + `YesterdayColumn.tsx` lines 419-422:

```tsx
<div className="flex flex-col h-full px-6 py-4">
  <div className="mb-2">
    <h2 className="text-xl font-semibold">Today</h2>
    <p className="text-xs text-muted-foreground">{formatTodayDate()}</p>
  </div>
  {/* sections */}
</div>
```

**Full-column empty state pattern** — from `YesterdayColumn.tsx` lines 434-452:

```tsx
{!hasAnyData &&
  !sprintQuery.isLoading &&
  !reviewerMrsQuery.isLoading &&
  !pinnedMetaQuery.isLoading &&
  !sprintQuery.isError &&
  !reviewerMrsQuery.isError && (
    <EmptyState
      icon={Clock}
      title="Nothing planned for today"
      subtitle="No items in progress, nothing up next, no MRs awaiting review, and no pinned items."
    />
  )}
```

**useDelayedLoading pattern** — from `DashboardInProgressCard.tsx` line 51:

```typescript
const showSprintSkeleton = useDelayedLoading(sprintQuery.isLoading);
const showMrsSkeleton = useDelayedLoading(reviewerMrsQuery.isLoading);
```

**AIO cycle navigation** — from `main.tsx` lines 524-526, needs `useNavigate()`:

```typescript
const navigate = useNavigate();
// In pinned row click handler:
if (key in pinnedCycleMeta) {
  const meta = pinnedCycleMeta[key];
  if (meta) navigate(`/aio-cycle/${meta.projectKey}/${key}`);
} else {
  onIssueClick(key);
}
```

---

### `src/routes/standup-notes/TodayInProgressSection.tsx` (section, CRUD)

**Analog:** `DashboardInProgressCard.tsx` (row button pattern) + `YesterdayColumn.tsx` (section skeleton/error/empty pattern)

**Section wrapper + header pattern** — matches UI-SPEC Section Anatomy:

```tsx
<div className="mb-4">
  <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
    IN PROGRESS
  </h3>
  {showSkeleton && <LoadingSkeletons />}
  {isError && (
    <ErrorState error={error} onRetry={() => void query.refetch()} viewName="In Progress items" />
  )}
  {!showSkeleton && !isError && items.length > 0 && (
    <div className="divide-y divide-border">{/* rows */}</div>
  )}
</div>
```

**Row button pattern** — from `DashboardInProgressCard.tsx` lines 127-137, adapted per UI-SPEC Row Anatomy:

```tsx
<button
  type="button"
  className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
  onClick={() => onIssueClick(issue.key)}
>
  <IssueTypeIcon typeName={issue.fields.issuetype.name} className="size-4 shrink-0" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">{issue.key}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{issue.fields.summary}</span>
  {storyPoints != null && (
    <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
      {storyPoints} pts
    </span>
  )}
  {loggedSeconds > 0 && (
    <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground ml-1">
      {formatDuration(loggedSeconds)}
    </span>
  )}
  <span onClick={(e) => e.stopPropagation()}>
    <LogWorkPopover
      issueKey={issue.key}
      jiraBaseUrl={jiraBaseUrl}
      initialDate={todayStr}
      onSuccess={onLogWorkSuccess}
    />
  </span>
</button>
```

**IssueTypeIcon import** — from `DashboardInProgressCard.tsx` line 20:

```typescript
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
```

**LogWorkPopover import** — from RESEARCH.md (named export):

```typescript
import { LogWorkPopover } from '@/routes/dashboard/issue-detail/LogWorkPopover';
```

**formatDuration import** — from `YesterdayColumn.tsx` line 32:

```typescript
import { formatDuration } from '@/services/jira/duration';
```

**Story points field access** — from RESEARCH.md:

```typescript
const storyPoints = issue.fields[storyPointsFieldKey] as number | null;
```

**Props interface** (receive filtered data from TodayColumn, not raw query):

```typescript
interface TodayInProgressSectionProps {
  items: JiraIssue[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  todayLoggedByIssue: Map<string, number>;   // issueKey → seconds
  todayStr: string;
  onIssueClick: (key: string) => void;
  onLogWorkSuccess: () => void;
}
```

---

### `src/routes/standup-notes/TodayUpNextSection.tsx` (section, CRUD)

**Analog:** Same as `TodayInProgressSection.tsx` — identical structure without the logged-time chip.

Section header label: `UP NEXT`. No `loggedSeconds` chip rendered. Log Work popover is present (all open sprint work is loggable per D-06). `viewName` for error state: `"Up Next items"`.

Props interface is identical to `TodayInProgressSectionProps` minus `todayLoggedByIssue`.

---

### `src/routes/standup-notes/TodayMrsSection.tsx` (section, request-response)

**Analog:** `MrRow.tsx` (amber color for `changes_requested`) + `YesterdayColumn.tsx` (section error/loading pattern)

**Review state label pattern** — from UI-SPEC Row Anatomy and `MrRow.tsx` line 16 / line 68 (amber for `changes_requested`):

```tsx
// MR row — non-interactive div (no button wrapper per UI-SPEC)
<div className="flex items-center gap-2 py-2 px-2">
  <GitBranch className="size-4 shrink-0 text-muted-foreground" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">!{mr.iid}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{mr.title}</span>
  {/* Option A: all returned MRs are "awaiting review"; no per-MR API call */}
  <span className="text-xs text-muted-foreground shrink-0">awaiting review</span>
</div>
```

When a future phase adds `review_state` enrichment, the conditional label becomes:

```tsx
// Future: when review_state field is available
<span
  className={
    mr.review_state === 'changes_requested'
      ? 'text-xs text-amber-600 dark:text-amber-400 font-semibold shrink-0'
      : 'text-xs text-muted-foreground shrink-0'
  }
>
  {mr.review_state === 'changes_requested' ? 'changes requested' : 'awaiting review'}
</span>
```

**GitBranch import:**

```typescript
import { GitBranch } from 'lucide-react';
```

Section header label: `MRS AWAITING YOU`. Hidden when GitLab not connected (no `gitlabBaseUrl`). `viewName` for error state: `"MRs awaiting you"`.

**Props interface:**

```typescript
interface TodayMrsSectionProps {
  mrs: GitLabMR[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
}
```

---

### `src/routes/standup-notes/TodayPinnedSection.tsx` (section, CRUD)

**Analog:** `StandupNotesPage.tsx` `issueMetaQuery` pattern + `TodayColumnPlaceholder.tsx` heading structure

**Two-variant row pattern** — from UI-SPEC Pinned Row Anatomy:

```tsx
// Jira issue pinned row
<button
  type="button"
  className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
  onClick={() => onIssueClick(key)}
>
  <IssueTypeIcon typeName={meta?.type ?? 'Task'} className="size-4 shrink-0" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{meta?.summary ?? key}</span>
</button>

// AIO cycle pinned row
<button
  type="button"
  className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
  onClick={() => onCycleClick(key)}
>
  <ListChecks className="size-4 shrink-0 text-muted-foreground" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">{cycleMeta.projectKey}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{cycleMeta.name}</span>
</button>
```

**ListChecks import:**

```typescript
import { ListChecks } from 'lucide-react';
```

Section header label: `PINNED`. `viewName` for error state: `"Pinned items"`. No Log Work trigger (D-08: read-only). Hidden when no `pinnedKeys` exist.

**Props interface:**

```typescript
interface TodayPinnedSectionProps {
  pinnedJiraKeys: string[];
  pinnedCycleKeys: string[];
  pinnedCycleMeta: Record<string, { name: string; projectKey: string }>;
  pinnedMeta: Record<string, StandupIssueMeta>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
  onCycleClick: (key: string) => void;  // calls navigate(`/aio-cycle/...`) in TodayColumn
}
```

---

### `src/routes/standup-notes/filterSprintItems.ts` (utility, transform)

**Analog:** `DashboardInProgressCard.tsx` lines 57-62 (filter) — extract and extend.

**Full implementation pattern** — lift and extend per D-04/D-05:

```typescript
import type { JiraIssue } from '@/services/jira';

export interface FilteredSprintItems {
  inProgress: JiraIssue[];
  upNext: JiraIssue[];
}

/**
 * Filters a flat sprint issues list to the current user's leaf items,
 * split by Jira status category.
 *
 * Leaf items = subtasks (issuetype.subtask === true) OR childless tasks/stories/bugs
 * (issuetype.subtask === false && subtasks.length === 0). Excludes parent stories
 * that have subtasks (they are coordinated, not directly worked — D-04).
 *
 * inProgress: statusCategory.key === 'indeterminate'
 * upNext:     statusCategory.key === 'new'
 * Done (statusCategory.key === 'done') is excluded from both.
 */
export function filterSprintItems(
  issues: JiraIssue[],
  jiraUserDisplayName: string,
): FilteredSprintItems {
  const isLeaf = (issue: JiraIssue) =>
    issue.fields.issuetype.subtask ||
    (!issue.fields.issuetype.subtask && (issue.fields.subtasks?.length ?? 0) === 0);

  const isAssignedToMe = (issue: JiraIssue) =>
    issue.fields.assignee?.displayName === jiraUserDisplayName;

  return {
    inProgress: issues.filter(
      (i) => isLeaf(i) && isAssignedToMe(i) && i.fields.status.statusCategory?.key === 'indeterminate',
    ),
    upNext: issues.filter(
      (i) => isLeaf(i) && isAssignedToMe(i) && i.fields.status.statusCategory?.key === 'new',
    ),
  };
}
```

**Note on subtasks field availability:** `subtasks` is present on parent issues (Tasks, Stories, Bugs) because `fetchSprintIssues` includes it in the parent query fields string (jira.ts line 370). On subtask issues, `issuetype.subtask === true` short-circuits the `subtasks.length` check, so no `undefined` risk.

---

### `src/routes/standup-notes/StandupNotesPage.tsx` (modify)

**Analog:** Itself — lines 321-324 only.

**Exact swap** — from UI-SPEC StandupNotesPage Integration section:

```tsx
// BEFORE (lines 321-324):
{/* Right column — Today placeholder (50%) */}
<div className="w-1/2 overflow-auto">
  <TodayColumnPlaceholder />
</div>

// AFTER:
<div className="w-1/2 overflow-auto">
  <TodayColumn onIssueClick={onIssueClick} />
</div>
```

Import changes needed:

```typescript
// Remove:
import TodayColumnPlaceholder from './TodayColumnPlaceholder';

// Add:
import TodayColumn from './TodayColumn';
```

`TodayColumn` reads auth and settings stores internally — no other prop changes required. `onIssueClick` is the only prop (it comes from `useOutletContext` which is already destructured at line 95).

---

### `src/routes/standup-notes/TodayColumn.test.ts` (test)

**Analog:** `YesterdayColumn.test.ts` (pure unit tests on exported helper) + `YesterdayColumn.tempo-disabled.test.tsx` (render tests with `@testing-library/react`)

**Pure unit test structure** — from `YesterdayColumn.test.ts` lines 1-16:

```typescript
import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { filterSprintItems } from './filterSprintItems';

describe('filterSprintItems', () => {
  // Build minimal JiraIssue fixtures inline — same pattern as
  // YesterdayColumn.test.ts TempoWorklog fixture builders (lines 103-110)
  function makeIssue(overrides: { statusKey: string; isSubtask: boolean; subtasksLen?: number; displayName?: string }): JiraIssue {
    // ... minimal stub with fields.issuetype.subtask, fields.status.statusCategory.key,
    // fields.assignee.displayName, fields.subtasks
  }

  it('includes subtask with indeterminate status in inProgress', () => { ... });
  it('includes childless task with new status in upNext', () => { ... });
  it('excludes task-with-subtasks (parent)', () => { ... });
  it('excludes done items from both lists', () => { ... });
  it('excludes items not assigned to me', () => { ... });
});
```

**Render test structure** — from `YesterdayColumn.tempo-disabled.test.tsx` lines 1-19:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
// Mock TanStack Query + router as needed
import TodayColumn from './TodayColumn';
```

Test IDs for `TodayColumn.test.ts` (from RESEARCH.md test map):
- `filterSprintItems` pure unit tests (STAND-07)
- Render: Log Work button present on In Progress rows (STAND-09)
- Render: Log Work button click does NOT trigger row navigation (STAND-09)
- Render: MRs section hidden when `!gitlabBaseUrl` (MRs scope addition)
- Render: Pinned section shows no pin/unpin controls (STAND-08)

---

## Shared Patterns

### Loading Skeletons
**Source:** `YesterdayColumn.tsx` lines 348-356
**Apply to:** All section components (TodayInProgressSection, TodayUpNextSection, TodayMrsSection, TodayPinnedSection)

```tsx
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

Import: `import { Skeleton } from '@/components/ui/skeleton';`

### Per-Section Error State
**Source:** `YesterdayColumn.tsx` lines 494-499
**Apply to:** All section components

```tsx
<ErrorState
  error={query.error}
  onRetry={() => void query.refetch()}
  viewName="In Progress items"  // vary per section
/>
```

Import: `import { ErrorState } from '@/components/ui/error-state';`

### Full-Column Empty State
**Source:** `YesterdayColumn.tsx` lines 443-452
**Apply to:** `TodayColumn.tsx` only

```tsx
<EmptyState
  icon={Clock}
  title="Nothing planned for today"
  subtitle="No items in progress, nothing up next, no MRs awaiting review, and no pinned items."
/>
```

Import: `import { EmptyState } from '@/components/ui/empty-state';`

### Token Pattern (T-62-06)
**Source:** `StandupNotesPage.tsx` lines 97-115 (for local state loading) and `StandupNotesPage.tsx` lines 161-165 (for `readSecret` inside queryFn)
**Apply to:** `TodayColumn.tsx` — replicate both patterns: local token state for `enabled` guards; `readSecret()` inside async queryFns.
**Rule:** Tokens NEVER appear as a queryKey segment.

### Section Hidden-When-Empty Rule
**Source:** `YesterdayColumn.tsx` rendering logic + UI-SPEC Per-section section
**Apply to:** All four section components
**Rule:** When `items.length === 0` and `!isLoading` and `!isError`, return `null` from the section component. The full-column empty state in `TodayColumn.tsx` fires only when all sections return null AND all queries have settled.

### Jira Not Connected Inline Notice
**Source:** `YesterdayColumn.tsx` lines 489-491
**Apply to:** `TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`, `TodayPinnedSection.tsx` when `!jiraBaseUrl`:

```tsx
<p className="text-xs text-muted-foreground">
  Jira not connected. Configure Jira in Settings → Integrations.
</p>
```

---

## No Analog Found

All files have at least a role-match analog in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/standup-notes/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/dashboard/issue-detail/`, `taskflow/src/hooks/`, `taskflow/src/stores/`
**Files scanned:** 8 source files read in full
**Pattern extraction date:** 2026-05-25

---

## PATTERN MAPPING COMPLETE

**Phase:** 70 - standup-notes-today-section
**Files classified:** 8
**Analogs found:** 8 / 8

### Coverage
- Files with exact analog: 3 (`TodayColumn.tsx`, `filterSprintItems.ts`, `StandupNotesPage.tsx` modification)
- Files with role-match analog: 5 (`TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`, `TodayMrsSection.tsx`, `TodayPinnedSection.tsx`, `TodayColumn.test.ts`)
- Files with no analog: 0

### Key Patterns Identified
- All four query types follow `StandupNotesPage.tsx` pattern: tokens in local state for `enabled` guards, `readSecret()` inside async queryFns, never in queryKey (T-62-06)
- Sprint query uses distinct key `['jira-issues', 'sprint-board-mine', ...]` with `assignedToMe=true` to avoid contaminating the shared sprint-board cache used by `DashboardInProgressCard` and `SprintBoardTab`
- All sections follow `YesterdayColumn.tsx` three-state pattern: `useDelayedLoading(isLoading)` → skeleton; `isError` → `<ErrorState onRetry={...} />`; `items.length === 0` → return null (hidden)
- Issue rows copy `DashboardInProgressCard.tsx` button structure: `w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring`
- `filterSprintItems` is a pure function extracted from `DashboardInProgressCard.tsx` filter — highest-value unit test target
- `LogWorkPopover` is a named export from `@/routes/dashboard/issue-detail/LogWorkPopover`; its trigger must be wrapped in `<span onClick={(e) => e.stopPropagation()}>` to prevent row navigation

### File Created
`/Users/mimo/Documents/Projects/taskflow/.planning/phases/70-standup-notes-today-section/70-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
