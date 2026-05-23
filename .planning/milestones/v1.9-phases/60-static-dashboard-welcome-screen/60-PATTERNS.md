# Phase 60: Static Dashboard / Welcome Screen - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 7 (4 new components + 3 test files)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/dashboard/index.tsx` | component (orchestrator) | request-response | `taskflow/src/routes/dashboard/ReleasesTab.tsx` | exact — thin orchestrator with `readSecret` + store reads + props-to-children |
| `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` | component | CRUD / request-response | `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` | exact — same two queries, same cache keys, same computation helpers |
| `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` | component | CRUD / request-response | `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` + `MyTasksTab.tsx` | role-match — same sprint-board query key; `useDelayedLoading` skeleton pattern from both |
| `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` | component | CRUD / request-response | `taskflow/src/routes/dashboard/ReleasesTab.tsx` | exact — same `fetchFixVersions` query, `getReleaseTimingLabel`, `Badge tone=` pattern |
| `taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx` | test | — | `taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx` | exact — same mock structure, same fixture builder pattern |
| `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx` | test | — | `taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx` | exact — same mock structure |
| `taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx` | test | — | `taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx` | exact — same mock structure |

---

## Pattern Assignments

### `taskflow/src/routes/dashboard/index.tsx` (component orchestrator, request-response)

**Analog:** `taskflow/src/routes/dashboard/ReleasesTab.tsx` (PAT loading pattern) + `taskflow/src/routes/dashboard/MyTasksTab.tsx` (jiraBaseUrl keyed effect)

**Imports pattern** (ReleasesTab.tsx lines 14–33 reduced to what index.tsx needs):
```typescript
import { useEffect, useState } from 'react';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
```

**Token loading pattern** (ReleasesTab.tsx lines 115–121, MyTasksTab.tsx lines 56–66):
```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
```

**Store reads pattern** (ReleasesTab.tsx line 96, auth.store.ts lines 15–32):
```typescript
const { jiraBaseUrl, activeJiraProject, jiraUsername, jiraUserDisplayName } = useAuthStore();
const { storyPointsFieldKey } = useSettingsStore();
```

**Props-to-children pattern** (derived from D-16; modelled on ReleasesTab structure):
```typescript
// index.tsx passes everything as props — no card calls readSecret or useAuthStore directly
<DashboardSprintCard
  jiraBaseUrl={jiraBaseUrl ?? ''}
  jiraToken={jiraToken ?? ''}
  activeJiraProject={activeJiraProject ?? ''}
  storyPointsFieldKey={storyPointsFieldKey}
/>
<DashboardInProgressCard
  jiraBaseUrl={jiraBaseUrl ?? ''}
  jiraToken={jiraToken ?? ''}
  activeJiraProject={activeJiraProject ?? ''}
  jiraUserDisplayName={jiraUserDisplayName ?? ''}
  storyPointsFieldKey={storyPointsFieldKey}
/>
<DashboardReleaseCard
  jiraBaseUrl={jiraBaseUrl ?? ''}
  jiraToken={jiraToken ?? ''}
  activeJiraProject={activeJiraProject ?? ''}
/>
```

**Hero section pattern** (RESEARCH.md code examples):
```tsx
const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}); // → "Thursday, 21 May 2026"

<section className="bg-gradient-to-br from-primary/5 to-background dark:from-primary/10 dark:to-background px-6 py-10">
  <h1 className="text-3xl font-semibold tracking-tight">
    Welcome back, {jiraUserDisplayName ?? 'there'}
  </h1>
  <p className="text-sm text-muted-foreground mt-1">{today}</p>
</section>
```

**Card grid layout** (RESEARCH.md code examples + UI-SPEC breakpoints):
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
  <DashboardSprintCard ... />
  <DashboardInProgressCard ... />
  <DashboardReleaseCard ... />
</div>
```

---

### `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` (component, CRUD)

**Analog:** `taskflow/src/routes/dashboard/SprintHealthPanel.tsx`

**Imports pattern** (SprintHealthPanel.tsx lines 13–16):
```typescript
import { useQuery } from '@tanstack/react-query';
import type { JiraIssue } from '@/services/jira';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';
// Add for Progress component after shadcn install:
import { Progress } from '@/components/ui/progress';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
```

**Props interface pattern** (SprintHealthPanel.tsx lines 18–22):
```typescript
export interface DashboardSprintCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  storyPointsFieldKey: string;
}
```

**Dual query pattern with exact cache keys** (SprintHealthPanel.tsx lines 38–51):
```typescript
// MUST match exactly — shared cache with SprintBoardTab + SprintProgressTab
const { data: sprintIssuesRaw, isLoading: issuesLoading } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});

const { data: activeSprint, isLoading: sprintLoading } = useQuery({
  queryKey: ['jira-active-sprint', activeJiraProject],
  queryFn: () => fetchActiveSprint(jiraBaseUrl!, jiraToken!, activeJiraProject!),
  staleTime: 5 * 60_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});

const isLoading = issuesLoading || sprintLoading;
```

**getDaysRemaining helper** (SprintHealthPanel.tsx lines 24–29):
```typescript
function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
```

**Story point % computation with zero-denominator guard** (SprintHealthPanel.tsx lines 60–72):
```typescript
const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];
const stories = sprintIssues.filter((i) => !i.fields.issuetype.subtask);

const donePoints = stories
  .filter((i) => i.fields.status.statusCategory?.key === 'done')
  .reduce(
    (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
    0,
  );

const totalPoints = stories.reduce(
  (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
  0,
);

// Division-by-zero guard — MUST include this check
const donePct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
const daysLeft = getDaysRemaining(activeSprint?.endDate);
```

**useDelayedLoading skeleton pattern** (ReleasesTab.tsx line 244, SprintHealthPanel.tsx lines 97–103):
```typescript
const showSkeleton = useDelayedLoading(isLoading);

{showSkeleton && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-4 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

**Card shell + header pattern** (SprintHealthPanel.tsx lines 92–95, UI-SPEC card anatomy):
```tsx
<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
  {/* Header */}
  <div className="flex items-center gap-2">
    <Zap className="size-4 text-amber-500" aria-hidden />
    <span className="text-xs text-muted-foreground uppercase tracking-wide">Sprint Health</span>
  </div>
  {/* Body: sprint name, days remaining, Progress bar */}
  ...
</div>
```

**Empty state when no active sprint** (D-07 copy; pattern from SprintHealthPanel.tsx lines 105–107):
```tsx
{!showSkeleton && noData && (
  <p className="text-sm text-muted-foreground">No active sprint</p>
)}
```

---

### `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` (component, CRUD)

**Analog:** `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` (query + cache key) and `taskflow/src/routes/dashboard/ReleasesTab.tsx` (row click-through + hover pattern)

**Imports pattern**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { JiraIssue } from '@/services/jira';
import { fetchSprintIssues } from '@/services/jira';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
```

**Props interface**:
```typescript
export interface DashboardInProgressCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  jiraUserDisplayName: string;
  storyPointsFieldKey: string;
}
```

**Shared cache key — MUST match exactly** (SprintHealthPanel.tsx line 39):
```typescript
const { data: sprintIssuesRaw, isLoading } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
```

**Assignee filter — Option B, displayName comparison** (RESEARCH.md Pattern 6, lines 301–305):
```typescript
// Use displayName comparison — avoids type cast, matches InlineComment.tsx + ActivityTimeline.tsx
const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];
const myInProgressSubtasks = sprintIssues.filter(
  (issue) =>
    issue.fields.issuetype.subtask &&
    issue.fields.status.statusCategory?.key === 'indeterminate' &&
    issue.fields.assignee?.displayName === jiraUserDisplayName,
);
const displayed = myInProgressSubtasks.slice(0, 3);
const overflow = myInProgressSubtasks.length - displayed.length;
```

**Subtask row with click-through** (RESEARCH.md code example lines 435–447, ReleasesTab.tsx row pattern lines 333–338):
```tsx
<button
  type="button"
  key={issue.key}
  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
  onClick={() => navigate(`/issue/${issue.key}`)}
  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/issue/${issue.key}`); }}
>
  <span className="text-xs text-muted-foreground font-mono shrink-0">{issue.key}</span>
  <span className="text-sm truncate">{issue.fields.summary}</span>
</button>
{overflow > 0 && (
  <p className="text-xs text-muted-foreground px-2">and {overflow} more</p>
)}
```

**Empty state copy** (D-11):
```tsx
{!showSkeleton && myInProgressSubtasks.length === 0 && (
  <p className="text-sm text-muted-foreground">No subtasks in progress — nice work!</p>
)}
```

**Card header icon** (UI-SPEC color contract):
```tsx
<CheckCircle2 className="size-4 text-green-500" aria-hidden />
<span className="text-xs text-muted-foreground uppercase tracking-wide">My In Progress</span>
```

---

### `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` (component, CRUD)

**Analog:** `taskflow/src/routes/dashboard/ReleasesTab.tsx`

**Imports pattern** (ReleasesTab.tsx lines 14–33 trimmed):
```typescript
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import type { JiraFixVersion } from '@/services/jira';
import { fetchFixVersions } from '@/services/jira';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
```

**Props interface**:
```typescript
export interface DashboardReleaseCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
}
```

**Query with matching cache key** (ReleasesTab.tsx lines 132–143):
```typescript
const { data: fixVersions, isLoading } = useQuery({
  queryKey: ['jira-fix-versions', activeJiraProject],
  queryFn: () => fetchFixVersions(jiraBaseUrl!, jiraToken!, activeJiraProject!),
  enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
  staleTime: 5 * 60_000,
});
```

**Soonest unreleased sort — ascending** (RESEARCH.md Pitfall 6 — ReleasesTab sorts descending, dashboard needs ascending):
```typescript
// ReleasesTab sorts descending (newest first) — dashboard MUST sort ascending (soonest first)
const soonest = (fixVersions ?? [])
  .filter((v) => !v.released && !!v.releaseDate)
  .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))[0] ?? null;
```

**getReleaseTimingLabel helper — copy verbatim** (ReleasesTab.tsx lines 82–90):
```typescript
type TimingLabel = 'overdue' | 'due-today' | { daysUntil: number } | null;

function getReleaseTimingLabel(releaseDate: string | undefined, released: boolean): TimingLabel {
  if (released || !releaseDate) return null;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}
```

**Timing badge rendering** (ReleasesTab.tsx lines 344–395, RESEARCH.md code examples lines 453–466):
```tsx
const timing = soonest ? getReleaseTimingLabel(soonest.releaseDate, soonest.released) : null;

{timing === 'due-today' && (
  <Badge tone="blue">Today</Badge>
)}
{timing === 'overdue' && (
  <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
    {/* compute overdue days: */}
    {Math.round(
      (new Date(new Date().toISOString().slice(0, 10)).getTime() -
        new Date(soonest!.releaseDate!).getTime()) / 86_400_000,
    )} days overdue
  </span>
)}
{timing && typeof timing === 'object' && 'daysUntil' in timing && (
  <span className="text-sm text-muted-foreground">{timing.daysUntil} days away</span>
)}
```

**Empty state** (D-14):
```tsx
{!showSkeleton && !soonest && (
  <p className="text-sm text-muted-foreground">No upcoming releases</p>
)}
```

**Card header icon** (UI-SPEC color contract):
```tsx
<Calendar className="size-4 text-blue-500" aria-hidden />
<span className="text-xs text-muted-foreground uppercase tracking-wide">Next Release</span>
```

---

### Test files: `DashboardSprintCard.test.tsx`, `DashboardInProgressCard.test.tsx`, `DashboardReleaseCard.test.tsx`

**Analog:** `taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx`

**Module mock block** (SprintHealthPanel.test.tsx lines 15–48):
```typescript
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));
```

**Fixture builder pattern** (SprintHealthPanel.test.tsx lines 52–79):
```typescript
function makeSprintIssue(
  key: string,
  statusCategoryKey: 'done' | 'indeterminate' | 'new',
  isSubtask = false,
  displayName: string | null = null,
  storyPoints: number | null = null,
) {
  return {
    id: key,
    key,
    fields: {
      summary: `Task ${key}`,
      status: {
        id: '3',
        name: statusCategoryKey === 'done' ? 'Done' : statusCategoryKey === 'indeterminate' ? 'In Progress' : 'To Do',
        statusCategory: { key: statusCategoryKey },
      },
      assignee: displayName ? { displayName, avatarUrls: {} } : null,
      issuetype: { name: isSubtask ? 'Sub-task' : 'Story', subtask: isSubtask },
      customfield_10016: storyPoints,
      timetracking: { timeSpentSeconds: 0 },
    },
  };
}
```

**renderWithQuery wrapper** (SprintHealthPanel.test.tsx lines 81–86):
```typescript
function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
```

**useQuery mock sequence for dual-query components** (SprintHealthPanel.test.tsx lines 104–115):
```typescript
vi.mocked(useQuery)
  .mockReturnValueOnce({
    data: issues,          // first call → sprint-board issues
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useQuery>)
  .mockReturnValueOnce({
    data: activeSprint,    // second call → active sprint
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useQuery>);
```

---

## Shared Patterns

### Token Loading
**Source:** `taskflow/src/routes/dashboard/ReleasesTab.tsx` lines 115–121 and `taskflow/src/routes/dashboard/MyTasksTab.tsx` lines 56–66
**Apply to:** `index.tsx` only — all other new files receive token as prop
```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
```

### Query Enabled Guard
**Source:** `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` lines 43, 50
**Apply to:** All three card components
```typescript
enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
```

### useDelayedLoading Skeleton
**Source:** `taskflow/src/routes/dashboard/ReleasesTab.tsx` line 244, `taskflow/src/hooks/useDelayedLoading.ts`
**Apply to:** All three card components
```typescript
const showSkeleton = useDelayedLoading(isLoading);
// Skeleton: 3 stacked muted blocks
{showSkeleton && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-4 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

### Card Shell
**Source:** `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` line 92
**Apply to:** All three card components
```typescript
// Base card class — use on the root div of every Dashboard card
"rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]"
```

### Badge Tone Usage
**Source:** `taskflow/src/components/ui/badge.tsx` lines 36–63, `taskflow/src/routes/dashboard/ReleasesTab.tsx` lines 348–384
**Apply to:** `DashboardReleaseCard.tsx`
```typescript
// Available tones (from statusStyles.ts ChipTone):
// 'blue' | 'green' | 'red' | 'orange' | 'amber' | 'purple' | 'muted'
<Badge tone="blue">Today</Badge>
<Badge tone="red">Overdue</Badge>
```

### Issue Row Hover + Focus + Keyboard
**Source:** `taskflow/src/routes/dashboard/ReleasesTab.tsx` lines 333–339
**Apply to:** `DashboardInProgressCard.tsx` subtask rows
```typescript
// Row interaction pattern — consistent across all clickable rows in the app
className="... hover:bg-muted/50 cursor-pointer"
onKeyDown={(e) => { if (e.key === 'Enter') /* navigate */; }}
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Cache Key Reference (Critical)

These keys must be copied verbatim from the analogs — any deviation creates a separate TanStack Query cache entry and fires a duplicate API request.

| Query | Key Array | Source |
|-------|-----------|--------|
| Sprint board issues | `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` | SprintHealthPanel.tsx line 39 |
| Active sprint | `['jira-active-sprint', activeJiraProject]` | SprintHealthPanel.tsx line 47 |
| Fix versions | `['jira-fix-versions', activeJiraProject]` | ReleasesTab.tsx line 139 |

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/components/ui/`, `taskflow/src/hooks/`, `taskflow/src/stores/`
**Files scanned:** 7 source files read in full
**Pattern extraction date:** 2026-05-21
