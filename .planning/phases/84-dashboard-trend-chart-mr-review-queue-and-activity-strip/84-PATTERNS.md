# Phase 84: Dashboard Trend Chart, MR Review Queue, and Activity Strip - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 7 (3 new components, 1 extended metrics module, 1 extended test file, 1 new test files, 1 extended root)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/routes/dashboard/WeeklyTrendChart.tsx` | component | request-response | `src/routes/dashboard/SprintHealthSection.tsx` | exact |
| `src/routes/dashboard/MrReviewQueue.tsx` | component | CRUD (cache-derived) | `src/routes/dashboard/MrHealthPanel.tsx` | exact |
| `src/routes/dashboard/ActivityStrip.tsx` | component | event-driven (cache-shared) | `src/routes/standup-notes/YesterdayColumn.tsx` | role-match |
| `src/routes/dashboard/dashboardMetrics.ts` | utility | transform | `src/routes/dashboard/dashboardMetrics.ts` (extend) | exact |
| `src/routes/dashboard/dashboardMetrics.test.ts` | test | — | `src/routes/dashboard/dashboardMetrics.ts` | exact |
| `src/routes/dashboard/index.tsx` | controller | request-response | `src/routes/dashboard/index.tsx` (extend) | exact |

---

## Pattern Assignments

### `src/routes/dashboard/WeeklyTrendChart.tsx` (component, request-response)

**Analog:** `src/routes/dashboard/SprintHealthSection.tsx`

**Imports pattern** (SprintHealthSection.tsx lines 1–35):
```typescript
'use no memo';

import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchWorklogs } from '@/services/tempo/worklogs';
import { useSettingsStore } from '@/stores/settings.store';
import { buildWeekBuckets } from './dashboardMetrics';
```

**`'use no memo'` directive:** Required at the top of the file — same as every component in `src/routes/dashboard/` (SprintHealthSection.tsx line 1, StatTile.tsx line 1, index.tsx line 1).

**Props-only pattern** (SprintHealthSection.tsx lines 37–44):
```typescript
// Props only — no readSecret, no useAuthStore inside the component.
// Auth values loaded once in index.tsx and passed down as props (D-16 pattern).
interface WeeklyTrendChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  jiraUsername: string;
  tempoEnabled: boolean;
}
```

**useQuery pattern with staleTime + enabled guard** (SprintHealthSection.tsx lines 60–71):
```typescript
const {
  data: worklogs,
  isLoading,
  error,
  refetch,
} = useQuery({
  queryKey: ['dashboard', 'tempo-week', jiraBaseUrl, weekStartDate, jiraUsername],
  queryFn: () =>
    fetchWorklogs(jiraBaseUrl, jiraToken, [jiraUsername], weekStartDate, todayDate),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUsername && tempoEnabled,
});

const showSkeleton = useDelayedLoading(isLoading);
```

**ChartWrapper + ChartContainer + BarChart pattern** (SprintHealthSection.tsx lines 150–184):
```typescript
// ChartWrapper handles loading / error / isEmpty entirely — no manual branching needed.
// Pass isEmpty={!tempoEnabled} for the "Tempo not connected" graceful state (D-06).
// Pass isEmpty={false} when tempoEnabled but array is empty — render all-zero bars (D-06 Pitfall 6).
<ChartWrapper
  title="Hours logged this week"
  description="Mon – Fri · 8 h/day target"
  height={240}
  isLoading={showSkeleton}
  error={!tempoEnabled ? undefined : error}
  isEmpty={!tempoEnabled}
  onRetry={refetch}
>
  <div style={{ height: 240 }} className="w-full">
    <ChartContainer
      config={chartConfig}
      className="h-full w-full"
      aria-label="Weekly logged hours bar chart"
    >
      <BarChart data={buckets} responsive>
        <XAxis dataKey="label" />
        <YAxis domain={[0, 12]} tickFormatter={(v) => `${v}h`} />
        <Bar dataKey="hours" fill="var(--chart-1)" isAnimationActive={false} />
        <ReferenceLine
          y={DAILY_TARGET_HOURS}
          stroke="var(--chart-2)"
          label={{ value: 'Target', position: 'right', fontSize: 11 }}
        />
      </BarChart>
    </ChartContainer>
  </div>
</ChartWrapper>
```

**Key rules (from SprintHealthSection.tsx + Phase 81 contract):**
- `responsive` prop on `BarChart` — never `<ResponsiveContainer>` (WebKit / React Compiler guard)
- `isAnimationActive={false}` on every `<Bar>` and `<Pie>` (Phase 81 D-06)
- Colors as `var(--chart-N)` CSS-var strings — never hardcoded hex
- Outer `<div style={{ height }}>` wrapping `ChartContainer` — 0×0 WebKit guard
- `'use no memo'` at top of file — React Compiler conflict guard (Phase 81 D-07)

**ChartConfig pattern** (SprintHealthSection.tsx lines 46–50):
```typescript
const chartConfig = {
  hours: { label: 'Hours logged', color: 'var(--chart-1)' },
} satisfies ChartConfig;
```

**role/aria pattern** (SprintHealthSection.tsx line 109):
```typescript
<div role="region" aria-label="Weekly hours logged" className="...">
```

---

### `src/routes/dashboard/MrReviewQueue.tsx` (component, CRUD cache-derived)

**Analog:** `src/routes/dashboard/MrHealthPanel.tsx`

**Imports pattern** (MrHealthPanel.tsx lines 1–14):
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, Plugin } from 'lucide-react';
import type { GitLabMR } from '@/services/gitlab';
import { fetchAssignedMRs, fetchReviewerMRs } from '@/services/gitlab';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useAuthStore } from '@/stores/auth.store';
```

**Props interface with tokenLoading guard** (MrHealthPanel.tsx lines 16–21):
```typescript
// tokenLoading prop distinguishes "Stronghold still reading" from "GitLab not configured".
// Without it, the component briefly shows "GitLab not connected" on every mount
// before the async readSecret() resolves. (Pitfall 4 from RESEARCH.md)
export interface MrReviewQueueProps {
  gitlabBaseUrl: string;
  gitlabToken: string;
  tokenLoading?: boolean;
}
```

**useAuthStore for gitlabUserId** (MrHealthPanel.tsx lines 30–32):
```typescript
// Use persisted GitLab user ID from auth store — avoids a validateGitLab round-trip.
const userId = useAuthStore((s) => s.gitlabUserId) ?? undefined;
```

**Cache-shared useQuery for gitlab-mrs** (MrHealthPanel.tsx lines 34–50):
```typescript
// CACHE KEY MUST MATCH MrHealthPanel exactly: ['gitlab-mrs', gitlabBaseUrl, userId]
// queryFn is the same: fetchAssignedMRs + fetchReviewerMRs deduped into { filtered, merged }
const { data: mrQueryData, isLoading } = useQuery({
  queryKey: ['gitlab-mrs', gitlabBaseUrl, userId],
  queryFn: async () => {
    const token = gitlabToken ?? '';
    const [assigned, reviewer] = await Promise.all([
      fetchAssignedMRs(gitlabBaseUrl ?? '', token),
      userId ? fetchReviewerMRs(gitlabBaseUrl ?? '', token, userId) : Promise.resolve([]),
    ]);
    const seen = new Set<number>();
    const merged = [...assigned, ...reviewer].filter(
      (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
    );
    return { filtered: merged, merged };
  },
  staleTime: 30_000,
  enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId,
});
```

**MR grouping derivation** (RESEARCH.md Pattern 3 — derived from MrHealthPanel.tsx lines 52–60):
```typescript
// Two client-side groups from the warm cache payload (mrQueryData?.filtered).
// "Awaiting my review": reviewer, NOT author (Pitfall 3 — exclude self-authored)
// "My open MRs": I am author
const allMrs: GitLabMR[] = mrQueryData?.filtered ?? [];

const awaitingReview = allMrs.filter(
  (mr) => mr.reviewers.some((r) => r.id === userId) && mr.author.id !== userId,
);
const myOpenMRs = allMrs.filter((mr) => mr.author.id === userId);
```

**Per-MR health badge via getQueryData** (MrHealthPanel.tsx lines 55–59):
```typescript
// Imperative getQueryData is acceptable here because MrReviewQueue renders
// at mount time — no need for reactive re-render when health changes.
const queryClient = useQueryClient();

for (const mr of awaitingReview) {
  const health = queryClient.getQueryData<string>(['mr-health', mr.project_id, mr.iid]);
  // health: 'approved' | 'changes_requested' | undefined  → treat undefined as 'needs_review'
}
```

**Skeleton pattern for tokenLoading OR query loading** (MrHealthPanel.tsx lines 68–75):
```typescript
{(tokenLoading || isLoading) && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-5 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

**Card container pattern** (MrHealthPanel.tsx lines 63–64 + StatTile.tsx lines 34–37):
```typescript
// min-h-[160px] matches MrHealthPanel; use DashboardReleaseCard's p-4 variant (not p-6 ChartWrapper)
<div
  role="region"
  aria-label="MR review queue"
  className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]"
>
```

**Group label style** (StatTile.tsx line 42, MrHealthPanel.tsx line 64):
```typescript
<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
  Awaiting my review
</span>
```

**MR row click — overlay button pattern** (per `project_overlay_button_nested_interactive` memory):
```typescript
// Full-row-click + no nested interactive: use relative container + absolute inset-0 button
// so the health badge (a non-interactive span) is a sibling, not nested inside the button.
<div className="relative flex items-center gap-2 py-2 hover:bg-muted/50 rounded cursor-pointer">
  <button
    type="button"
    className="absolute inset-0 rounded"
    aria-label={mr.title}
    onClick={() => openUrl(mr.web_url)}
  />
  <span className="text-sm truncate flex-1">{mr.title}</span>
  {/* health badge — rendered AFTER the overlay button (sibling, not child) */}
  <HealthBadge status={health} />
</div>
```

**External URL open** (RESEARCH.md Code Examples — confirmed from ReleaseDetailPage.tsx line 968):
```typescript
import { openUrl } from '@tauri-apps/plugin-opener';
// In click handler:
onClick={() => openUrl(mr.web_url)}
```

**Empty states** (EmptyState usage from SprintHealthSection.tsx lines 115–120):
```typescript
// GitLab not configured (tokenLoading resolved but no gitlabBaseUrl):
<EmptyState
  icon={Plugin}
  title="GitLab not connected"
  subtitle="Connect GitLab in Settings to see your MR queue."
/>

// No MRs in either group:
<EmptyState
  icon={GitMerge}
  title="No MRs awaiting review"
  subtitle="You're all caught up."
/>
```

---

### `src/routes/dashboard/ActivityStrip.tsx` (component, event-driven cache-shared)

**Analog:** `src/routes/standup-notes/YesterdayColumn.tsx` + `src/routes/standup-notes/StandupNotesPage.tsx`

**Imports pattern**:
```typescript
'use no memo';

import { useQuery } from '@tanstack/react-query';
import { Activity, GitCommitHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { readSecret } from '@/services/stronghold';
import { fetchYesterdayJiraActivity } from '@/services/jira';
import { fetchUserCommits } from '@/services/gitlab';
import { mergeActivityEntries } from './dashboardMetrics';
```

**Exact Jira activity query key** (StandupNotesPage.tsx lines 308–331):
```typescript
// MUST MATCH StandupNotesPage.tsx EXACTLY for cache sharing (D-08, criterion 2).
// Token MUST NOT appear in queryKey (T-62-06 rule). Token lives inside queryFn via readSecret().
const jiraActivityQuery = useQuery({
  queryKey: [
    'standup', 'jira',
    jiraBaseUrl,
    activeJiraProject,
    yesterdayDate,
    jiraUsername ?? '',
  ],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No Jira token');
    return fetchYesterdayJiraActivity(
      jiraBaseUrl ?? '',
      token,
      activeJiraProject ?? '',
      yesterdayDate,
      jiraUsername ?? '',
    );
  },
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!jiraUsername && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});
```

**Exact commits query key** (StandupNotesPage.tsx lines 358–403):
```typescript
// CRITICAL: sixth element must be gitlabUsername || gitlabName || '' for the self-user path.
// On Dashboard there is no watch mode so resolvedAccountsKey is always ''.
// Using any other field (gitlabUserId, etc.) breaks cache sharing — fires a duplicate request.
// (RESEARCH.md Pitfall 1)
const commitsQuery = useQuery({
  queryKey: [
    'standup', 'commits',
    gitlabBaseUrl,
    activeGitlabProject,
    yesterdayDate,
    gitlabUsername || gitlabName || '',  // self-user path of StandupNotesPage
  ],
  queryFn: async () => {
    const token = await readSecret('gitlab-pat').catch(() => null);
    if (!token) throw new Error('No GitLab token');
    return fetchUserCommits(
      gitlabBaseUrl ?? '',
      token,
      activeGitlabProject ?? 0,
      yesterdayDate,
      [gitlabUsername ?? ''],
      [gitlabName ?? ''],
      [gitlabEmail],
    );
  },
  enabled:
    !!gitlabBaseUrl &&
    !!gitlabToken &&
    !!activeGitlabProject &&
    !!yesterdayDate &&
    (!!gitlabUsername || !!gitlabName),
  staleTime: 5 * 60 * 1000,
});
```

**NOT `enabled: false`** (D-09 — strip must fetch on cold Dashboard load):
```typescript
// DO NOT use enabled: false (reactive cache-read pattern).
// DO use the full enabled guard above — warm cache hits immediately; cold load fires fetch.
// The reactive cache-read (enabled:false) pattern is reserved for truly prefetched data
// (e.g. SprintHealthSection's active-sprint query where Sidebar prefetches it).
```

**yesterdayDate derivation** (RESEARCH.md Pitfall 2 — use en-CA, not toISOString):
```typescript
// en-CA locale yields ISO-style YYYY-MM-DD from local calendar — no UTC shift.
// toISOString() shifts date west of UTC in the evening.
const yesterdayDate = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
```

**Activity merge + sort in useMemo** (pattern from YesterdayColumn.tsx lines 591–608):
```typescript
// Merge and sort inside useMemo — stable reference, pure derivation.
const entries = useMemo(
  () => mergeActivityEntries(jiraActivityQuery.data ?? [], commitsQuery.data ?? [], CAP),
  [jiraActivityQuery.data, commitsQuery.data],
);
```

**Compact row rendering pattern** (UI-SPEC ActivityStrip + YesterdayColumn.tsx):
```typescript
// py-1 (4px) intentionally tighter than MR rows (py-2) — "strip" density
<div className="flex items-start gap-2 py-1">
  <Activity className="size-4 shrink-0 text-sky-500 mt-0.5" aria-hidden />
  <span className="text-sm text-foreground truncate flex-1">{entry.description}</span>
  <span className="text-xs text-muted-foreground shrink-0">{entry.relativeTime}</span>
</div>
```

**"+N more" overflow indicator** (UI-SPEC Interaction Contract):
```typescript
// Button renders but has no expand handler this phase (deferred).
// min touch target: 32px height.
{overflow > 0 && (
  <button
    type="button"
    className="text-xs text-muted-foreground hover:text-foreground mt-1 min-h-[32px]"
  >
    +{overflow} more
  </button>
)}
```

**Per-source error handling** (YesterdayColumn.tsx lines 796–820):
```typescript
// Each query's error handled independently — strip never goes fully blank on one failure.
{jiraActivityQuery.isError && (
  <ErrorState
    error={jiraActivityQuery.error}
    onRetry={() => void jiraActivityQuery.refetch()}
    viewName="Jira activity"
  />
)}
{commitsQuery.isError && (
  <ErrorState
    error={commitsQuery.error}
    onRetry={() => void commitsQuery.refetch()}
    viewName="Git commits"
  />
)}
```

**Card container + region pattern**:
```typescript
<div
  role="region"
  aria-label="Recent activity"
  className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
>
```

---

### `src/routes/dashboard/dashboardMetrics.ts` (utility extension, transform)

**Analog:** `src/routes/dashboard/dashboardMetrics.ts` (extend in-place)

**Module pattern** (dashboardMetrics.ts lines 1–10):
```typescript
/**
 * dashboardMetrics.ts — Phase 83 DASH-02/03/04/05/07/08/09
 *
 * Pure derivation functions for Dashboard stat tiles and sprint health chart.
 * NO React, NO hooks. Importable in unit tests without any DOM environment.
 */
```

**Add `buildWeekBuckets` following the same pure-function signature style** (dashboardMetrics.ts lines 62–82 for reference shape):
```typescript
export interface WeekBucket {
  day: string;   // YYYY-MM-DD
  label: string; // 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
  hours: number;
}

const DAILY_TARGET_HOURS = 8;

/**
 * Build Mon–Fri bucket array for the current week, zero-filled.
 * Bucketing uses worklog.dateStarted (already YYYY-MM-DD from fetchWorklogs).
 * Never constructs new Date() from raw timestamps — timezone-safe (D-04, criterion 1).
 *
 * @param worklogs   Array of TempoWorklog with dateStarted pre-normalized to YYYY-MM-DD
 * @param weekStart  Monday of the current week as YYYY-MM-DD string
 */
export function buildWeekBuckets(worklogs: TempoWorklog[], weekStart: string): WeekBucket[] { ... }
```

**Add `mergeActivityEntries` pure function** (RESEARCH.md Code Examples):
```typescript
type ActivityEntry =
  | { type: 'jira'; at: string; item: JiraActivityItem }
  | { type: 'commit'; at: string; item: GitLabCommit };

/**
 * Merge Jira activity + GitLab commits into a single newest-first timeline, capped.
 */
export function mergeActivityEntries(
  jiraItems: JiraActivityItem[],
  commits: GitLabCommit[],
  cap: number,
): ActivityEntry[] { ... }
```

**Date arithmetic rule** (dashboardMetrics.ts line 109 + D-04):
```typescript
// All date comparisons use YYYY-MM-DD string comparison (ISO sort order).
// Never new Date(...).toISOString() — use .slice(0, 10) on pre-normalized dateStarted.
// Week-day offset: pure string arithmetic via padded date construction, not Date objects.
```

---

### `src/routes/dashboard/dashboardMetrics.test.ts` (test extension)

**Analog:** existing `src/routes/dashboard/dashboardMetrics.test.ts` (extend)

**Mandated test fixture** (RESEARCH.md Validation Architecture):
```typescript
// Criterion 1 mandated unit test — timezone-safe bucketing.
// fetchWorklogs already normalizes dateStarted; this tests the post-normalization path.
it('timezone-safe: dateStarted "2026-06-14" (pre-normalized from "2026-06-14T23:00:00") buckets correctly', () => {
  const worklogs = [{ dateStarted: '2026-06-14', timeSpentSeconds: 3600 }] as TempoWorklog[];
  const buckets = buildWeekBuckets(worklogs, '2026-06-09'); // Mon of week containing 2026-06-14
  const friday = buckets.find((b) => b.day === '2026-06-14');
  expect(friday?.hours).toBe(1);
});

it('future days this week render as 0-hour buckets', () => {
  const buckets = buildWeekBuckets([], '2026-06-09');
  expect(buckets).toHaveLength(5);
  expect(buckets.every((b) => b.hours === 0)).toBe(true);
});
```

**Test run command** (RESEARCH.md Validation):
```
cd taskflow && npm run test -- --run src/routes/dashboard/dashboardMetrics.test.ts
```

---

### `src/routes/dashboard/index.tsx` (controller extension)

**Analog:** `src/routes/dashboard/index.tsx` (extend in-place)

**Add gitlab auth reads alongside existing Jira reads** (index.tsx lines 40–55):
```typescript
// Existing:
const { jiraBaseUrl, activeJiraProject, jiraUserDisplayName } = useAuthStore();

// Add these for Phase 84 (mirroring MrHealthPanel.tsx pattern):
const { gitlabBaseUrl, gitlabUserId, gitlabUsername, gitlabName, jiraUsername, activeGitlabProject } =
  useAuthStore();

// Existing jiraToken load via useEffect:
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat').then((t) => setJiraToken(t)).catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);

// Add gitlabToken load — same pattern:
const [gitlabToken, setGitlabToken] = useState<string | null>(null);
const [gitlabTokenLoading, setGitlabTokenLoading] = useState(true);

useEffect(() => {
  if (gitlabBaseUrl) {
    setGitlabTokenLoading(true);
    readSecret('gitlab-pat')
      .then((t) => setGitlabToken(t))
      .catch(() => setGitlabToken(null))
      .finally(() => setGitlabTokenLoading(false));
  } else {
    setGitlabTokenLoading(false);
  }
}, [gitlabBaseUrl]);
```

**New section mounts pattern** (index.tsx lines 196–214 for reference):
```typescript
// Each section wrapped in: <div className="relative px-6 pb-6">
// Sprint health + WeeklyTrendChart side-by-side (UI-SPEC layout order §3):
<div className="relative px-6 pb-6">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SprintHealthSection ... />
    <WeeklyTrendChart
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      jiraUsername={jiraUsername ?? ''}
      tempoEnabled={tempoEnabled}
    />
  </div>
</div>

{/* MR review queue — full width */}
<div className="relative px-6 pb-6">
  <MrReviewQueue
    gitlabBaseUrl={gitlabBaseUrl ?? ''}
    gitlabToken={gitlabToken ?? ''}
    tokenLoading={gitlabTokenLoading}
  />
</div>

{/* Activity & Releases — two-column grid (D-16: DashboardReleaseCard relocated here) */}
<div className="relative px-6 pb-6">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <ActivityStrip
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      activeJiraProject={activeJiraProject ?? ''}
      jiraUsername={jiraUsername ?? ''}
      gitlabBaseUrl={gitlabBaseUrl ?? ''}
      gitlabToken={gitlabToken ?? ''}
      activeGitlabProject={activeGitlabProject ?? 0}
      gitlabUsername={gitlabUsername}
      gitlabName={gitlabName}
    />
    <DashboardReleaseCard
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      activeJiraProject={activeJiraProject ?? ''}
    />
  </div>
</div>
// NOTE: Remove the standalone DashboardReleaseCard div (current index.tsx lines 207–214).
```

---

## Shared Patterns

### `'use no memo'` directive
**Source:** Every file under `src/routes/dashboard/` (index.tsx line 1, SprintHealthSection.tsx line 1, StatTile.tsx line 1)
**Apply to:** `WeeklyTrendChart.tsx`, `MrReviewQueue.tsx`, `ActivityStrip.tsx`
```typescript
'use no memo';
```
Required at top of every component file — React Compiler conflict guard (Phase 81 D-07).

### Props-only auth pattern (no useAuthStore / readSecret inside child components)
**Source:** `src/routes/dashboard/SprintHealthSection.tsx` lines 37–44 + `src/routes/dashboard/DashboardReleaseCard.tsx` lines 19–23
**Apply to:** `WeeklyTrendChart.tsx`, `ActivityStrip.tsx`
```typescript
// Auth values loaded once in index.tsx, passed as props (dashboard D-16 pattern).
// Exception: MrReviewQueue reads gitlabUserId via useAuthStore (same as MrHealthPanel) because
// userId is not a token — it is safe to read from the store inside the component.
```

### useDelayedLoading for skeleton delay guard
**Source:** `src/routes/dashboard/SprintHealthSection.tsx` line 93, `DashboardReleaseCard.tsx` line 51
**Apply to:** `WeeklyTrendChart.tsx`, `MrReviewQueue.tsx`, `ActivityStrip.tsx`
```typescript
const showSkeleton = useDelayedLoading(isLoading);
// 300ms delay prevents skeleton flash for fast cache hits.
```

### Token MUST NOT appear in queryKey (T-62-06 rule)
**Source:** `src/routes/standup-notes/StandupNotesPage.tsx` lines 308–331
**Apply to:** All three new components
```typescript
// WRONG: queryKey: ['dashboard', 'tempo-week', jiraBaseUrl, jiraToken, ...]
// RIGHT: jiraToken lives inside queryFn via readSecret() or from the prop closure.
// enabled guard uses !!jiraToken (boolean) — token string never enters the key.
```

### Skeleton rows pattern for list-type components
**Source:** `src/routes/dashboard/MrHealthPanel.tsx` lines 68–75, `src/routes/dashboard/DashboardReleaseCard.tsx` lines 83–89
**Apply to:** `MrReviewQueue.tsx`, `ActivityStrip.tsx`
```typescript
{showSkeleton && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-5 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

### Card container shell
**Source:** `src/routes/dashboard/MrHealthPanel.tsx` line 63, `DashboardReleaseCard.tsx` line 75
**Apply to:** `MrReviewQueue.tsx`, `ActivityStrip.tsx` (non-ChartWrapper cards)
```typescript
<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
```

### Section header label style
**Source:** `src/routes/dashboard/StatTile.tsx` line 42, `MrHealthPanel.tsx` line 64
**Apply to:** `MrReviewQueue.tsx` group labels, `ActivityStrip.tsx` card header
```typescript
<span className="text-xs text-muted-foreground uppercase tracking-wide">...</span>
```

### External URL open
**Source:** `ReleaseDetailPage.tsx` line 968 (confirmed by RESEARCH.md)
**Apply to:** `MrReviewQueue.tsx` MR row click
```typescript
import { openUrl } from '@tauri-apps/plugin-opener';
// window.open() is blocked in Tauri webview — always use openUrl().
onClick={() => openUrl(mr.web_url)}
```

### Independent degradation per section
**Source:** `src/routes/dashboard/index.tsx` lines 148–194 (stat tiles) + `SprintHealthSection.tsx` lines 107–186
**Apply to:** All three new components — each manages its own loading/error/empty independently
```typescript
// No section's failure propagates to another. Each component owns:
// - showSkeleton via useDelayedLoading
// - error prop or ErrorState
// - EmptyState for context-aware empty (not generic)
```

---

## No Analog Found

All files have close matches in the codebase. No files are without an analog.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/routes/standup-notes/`, `taskflow/src/services/tempo/`, `taskflow/src/components/`
**Files scanned:** 9 source files read in full
**Pattern extraction date:** 2026-06-15

**Critical anti-patterns to surface for planner:**
1. `new Date(worklog.started).toISOString().slice(0,10)` for bucketing — use `worklog.dateStarted` (pre-normalized by `fetchWorklogs` line 53)
2. `enabled: false` on the ActivityStrip queries — strip must fetch on cold load (D-09)
3. Wrong sixth element in commits query key — must be `gitlabUsername || gitlabName || ''`, not `gitlabUserId`
4. `<ResponsiveContainer>` — use `responsive` prop on `<BarChart>` (Phase 81)
5. `isEmpty={true}` on ChartWrapper when Tempo is enabled but worklogs array is empty — render all-zero bars instead (RESEARCH.md Pitfall 6)
6. Nesting a `<button>` inside an MR row `div[role=button]` — use overlay button sibling pattern
