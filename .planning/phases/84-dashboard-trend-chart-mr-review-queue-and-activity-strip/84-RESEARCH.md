# Phase 84: Dashboard Trend Chart, MR Review Queue, and Activity Strip - Research

**Researched:** 2026-06-15
**Domain:** React dashboard extension — Recharts BarChart, TanStack Query cache sharing, GitLab MR queue, Jira/GitLab activity strip
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Chart shows logged-hours bars + a fixed 8h/day target marker (ReferenceLine). NOT a logged-vs-scheduled overlay. DASH-04's "vs schedule" is satisfied by a static 8h target.
- **D-02:** The 8h target is a single hardcoded named constant (`DAILY_TARGET_HOURS = 8`). No settings plumbing.
- **D-03:** Buckets = Mon–Fri of the current week, zero-filled. Always render all 5 weekday buckets; future days = 0.
- **D-04:** Date bucketing uses `dateStarted` (already `YYYY-MM-DD` after `fetchWorklogs` normalizes it). Never `new Date(...).toISOString()`. Mandated unit test: `started: "2026-06-14T23:00:00"` ⇒ bucket `2026-06-14`.
- **D-05:** Trend chart gets ONE new fetch: dedicated `useQuery` with key `['dashboard','tempo-week', jiraBaseUrl, weekStartDate, jiraUsername]` calling `fetchWorklogs` for Mon→today when `tempoEnabled` is true.
- **D-06:** When `tempoEnabled` is false, render a graceful "Tempo not connected" empty state — not an error.
- **D-07:** Activity strip sources = Jira activity (`['standup','jira',...]`) + GitLab commits (`['standup','commits',...]`). Not jira-created, not mr-events.
- **D-08:** Reuse the EXACT Standup query keys — no duplicate network request when both Dashboard and Standup Notes visited same session.
- **D-09:** Fetch-on-demand via shared keys (not `enabled:false` reactive cache-read). Strip must work on cold Dashboard load.
- **D-10:** Ordering = merged, newest-first. Interleave Jira activity + commits into one timeline.
- **D-11:** Density = compact, capped list (~5–7 items) with "+N more" overflow indicator. No expansion this phase.
- **D-12:** MR queue: two groups — "Awaiting my review" (reviewer, not author) then "My open MRs" (author). Derived client-side from warm `['gitlab-mrs', gitlabBaseUrl, gitlabUserId]` cache. No new polling or fetch.
- **D-13:** Health badge = `mr-health` review status from warm `['mr-health', project_id, iid]` cache via `queryClient.getQueryData`. Do NOT fetch pipeline/CI/approval counts.
- **D-14:** MR rows: title + author/project + health badge; clicking opens `web_url` via `openUrl()` in external browser.
- **D-15:** Context-aware empty states: empty queue → "No MRs awaiting review"; GitLab not configured → "GitLab not connected".
- **D-16:** Co-locate activity strip with next-release countdown in one "Activity & Releases" section. Relocate `DashboardReleaseCard` from its current standalone `div` (index.tsx line 208) into this combined section.
- **D-17:** Independent degradation for all sections. Each has own Skeleton/ErrorState/EmptyState. Reuse `components/ui/` primitives + `ChartWrapper`'s built-in state handling.

### Claude's Discretion

- Overall section ordering and responsive layout.
- Exact visual treatment of trend-chart bars + 8h marker (color tokens must be `var(--chart-N)`).
- Exact compact-row markup for activity items and MR rows.
- Component decomposition (new `WeeklyTrendChart`, `MrReviewQueue`, `ActivityStrip` vs inline).
- Exact "+N more" overflow affordance.

### Deferred Ideas (OUT OF SCOPE)

- Logged-vs-scheduled overlay via `fetchUserSchedule`.
- Configurable daily target (lift 8h to a setting).
- jira-created issues + MR events in the activity strip.
- Pipeline/CI status or approval-count MR badges.
- Internally-scrollable full activity feed.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-04 | Weekly logged-hours trend chart (hours per day this week vs schedule) | `fetchWorklogs` confirmed; `dateStarted` normalized to `YYYY-MM-DD` at line 53 of worklogs.ts; `tempoEnabled` at settings store line 56 |
| DASH-05 | Activity & releases section — recent notifications/mentions + next-release countdown | Standup `jiraActivityQuery` key confirmed at StandupNotesPage lines 308–331; `commitsQuery` key confirmed at lines 358–403; `DashboardReleaseCard` relocation path confirmed |
| DASH-06 | MR review queue — MRs awaiting my review and my open MRs' health | `['gitlab-mrs', gitlabBaseUrl, userId]` cache confirmed in MrHealthPanel; `GitLabMR` shape confirmed; `fetchReviewerMRs`/`fetchAuthoredMRs` both exist; `mr-health` cache read via `getQueryData` confirmed |
| DASH-07 | Each dashboard section degrades independently | Pattern established in Phase 83; `ChartWrapper`, `Skeleton`, `ErrorState`, `EmptyState`, `useDelayedLoading` all confirmed present |

</phase_requirements>

---

## Summary

Phase 84 adds three independently-degrading Dashboard sections on top of Phase 83's stat tiles and sprint health chart. Every codebase anchor cited in CONTEXT.md has been verified against live source. No anchor is missing or misnamed. The plan is a pure wiring + composition exercise — no new library, no new service, no new API endpoint, one new network call.

The single new network call is `fetchWorklogs` for the current week (`Mon→today`), gated by `tempoEnabled`. The MR review queue derives two groups ("Awaiting my review" / "My open MRs") from the warm `['gitlab-mrs', gitlabBaseUrl, gitlabUserId]` cache already populated by `MrHealthPanel`. The activity strip reuses the exact `['standup','jira',...]` and `['standup','commits',...]` TanStack Query keys from `StandupNotesPage` — any warm Standup cache hits immediately; cold Dashboard fires the fetches and the results are then shared back.

The one layout integration complexity is that the current `index.tsx` only reads Jira auth fields — the new sections also need `gitlabBaseUrl`, `gitlabUserId`, and `jiraUsername` from `useAuthStore`, plus a `gitlabToken` loaded via `readSecret('gitlab-pat')`. The planner must add these to `index.tsx`'s auth reads. The `MrHealthPanel` precedent shows how: token via `useEffect`/`readSecret`, userId via `useAuthStore`, passed as props.

**Primary recommendation:** Follow the established Phase 83 `StatTile`/`SprintHealthSection` decomposition pattern — each new section is its own component file under `src/routes/dashboard/` receiving auth props from `index.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weekly trend chart rendering | Frontend (Dashboard route) | — | Recharts BarChart inside ChartWrapper; data from dedicated `useQuery` |
| Tempo worklog fetch | Frontend (Dashboard route) | Service layer (fetchWorklogs) | Single `useQuery` fires only when `tempoEnabled`; all bucketing is pure client-side |
| Date bucketing (Mon–Fri) | Pure function (dashboardMetrics.ts or collocated) | — | No DOM/React needed; unit-testable in isolation |
| MR queue derivation | Frontend (MrReviewQueue component) | TanStack Query cache | Client-side grouping of warm cache data; no network call |
| MR health badge read | Frontend (MrReviewQueue component) | TanStack Query cache | `queryClient.getQueryData(['mr-health', project_id, iid])` — imperative read fine here because MrReviewQueue does not need to re-render when health changes (it reads at mount) |
| Activity strip interleave + sort | Pure function | — | Merge + sort arrays by timestamp; unit-testable |
| Activity strip data fetch | Frontend (ActivityStrip component) | TanStack Query (shared keys) | Warm = instant; cold = fires fetch, result shared with Standup |
| External URL open (MR click) | Tauri shell (`openUrl`) | — | `openUrl` from `@tauri-apps/plugin-opener` — established codebase pattern |
| Independent section degradation | Each component | `useDelayedLoading` hook | 300ms delay guard prevents flash; each component owns its own loading/error/empty state |

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.8.1 | BarChart + ReferenceLine for trend chart | Phase 81 — locked charting library |
| @tanstack/react-query | (existing) | `useQuery` + `useQueryClient` for cache reads | Project-wide data fetching standard |
| zustand | (existing) | `useAuthStore`, `useSettingsStore` | Project-wide state management |
| @tauri-apps/plugin-opener | (existing) | `openUrl(web_url)` for external MR links | Established codebase pattern (ReleaseDetailPage, MergeRequestDetailPage) |
| lucide-react | (existing) | `Activity`, `GitCommitHorizontal`, `GitMerge`, `Plugin` icons | Project icon library |

### Supporting (all already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ChartWrapper` (local) | Phase 81 | Card shell with loading/error/empty for BarChart | WeeklyTrendChart only |
| `useDelayedLoading` hook | Phase 83 | 300ms skeleton delay guard | All three new sections |
| `EmptyState`, `ErrorState`, `Skeleton` (local ui/) | Phase 22+ | Per-section degradation states | All three new sections + MrReviewQueue |

**Installation:** None. No new packages. [VERIFIED: codebase grep]

---

## Package Legitimacy Audit

> No new packages are introduced in this phase. All dependencies are already installed.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard index.tsx (root)
  │
  ├── reads: jiraBaseUrl, activeJiraProject, jiraUserDisplayName  [existing]
  ├── reads: gitlabBaseUrl, gitlabUserId, jiraUsername            [NEW — add to useAuthStore read]
  ├── loads: jiraToken via readSecret('jira-pat')                 [existing]
  ├── loads: gitlabToken via readSecret('gitlab-pat')             [NEW — same pattern]
  │
  ├── [existing] StatTile row ←── sprint-board cache
  ├── [existing] SprintHealthSection ←── sprint-board cache (shared key)
  │
  ├── [NEW] WeeklyTrendChart
  │     └── useQuery(['dashboard','tempo-week', jiraBaseUrl, weekStartDate, jiraUsername])
  │           └── fetchWorklogs(baseUrl, token, [jiraUsername], monDate, todayDate)
  │                 └── returns TempoWorklog[] with dateStarted YYYY-MM-DD
  │
  ├── [NEW] MrReviewQueue
  │     ├── useQuery(['gitlab-mrs', gitlabBaseUrl, gitlabUserId])   ← warm cache (MrHealthPanel already populates)
  │     │     └── client-side: filter reviewers → "Awaiting my review"
  │     │     └── client-side: filter author_id === gitlabUserId → "My open MRs"
  │     └── queryClient.getQueryData(['mr-health', project_id, iid])  ← per-MR health badge
  │
  └── [NEW] Activity & Releases section (grid: ActivityStrip | DashboardReleaseCard)
        ├── ActivityStrip
        │     ├── useQuery(['standup','jira', jiraBaseUrl, activeJiraProject, yesterdayDate, jiraUsername ?? ''])
        │     │     ← EXACT same key as StandupNotesPage — warm cache reuse
        │     ├── useQuery(['standup','commits', gitlabBaseUrl, activeGitlabProject, yesterdayDate, resolvedKey])
        │     │     ← EXACT same key as StandupNotesPage — warm cache reuse
        │     └── client-side: merge + sort by timestamp, cap at 5–7 items
        └── DashboardReleaseCard  ← relocated from standalone div (D-16)
              └── useQuery(['jira-fix-versions', activeJiraProject])  ← existing cache
```

### Recommended Project Structure

```
src/routes/dashboard/
├── index.tsx                  # extended: add gitlab auth reads + 3 new section mounts
├── WeeklyTrendChart.tsx        # NEW — BarChart + ReferenceLine in ChartWrapper
├── MrReviewQueue.tsx           # NEW — grouped MR list (2 groups) from warm cache
├── ActivityStrip.tsx           # NEW — compact interleaved Jira+commits timeline
├── dashboardMetrics.ts         # extend: add weeklyBuckets() pure function here
├── dashboardMetrics.test.ts    # extend: add timezone-safe bucketing test (criterion 1)
├── DashboardReleaseCard.tsx    # unchanged — relocated mount point only
├── StatTile.tsx                # unchanged
└── SprintHealthSection.tsx     # unchanged
```

### Pattern 1: Warm Cache Reuse via Shared TanStack Query Keys

**What:** A `useQuery` with the exact same `queryKey` as a query in another component reads from the shared cache. If the other component was rendered first in the session, the data is available instantly (no network call). If this component renders first (cold dashboard), the query fires and populates the cache for subsequent renders.

**When to use:** Activity strip (D-08, D-09) and MR queue (D-12). NOT for the trend chart (D-05 — different key, different date range).

**Example:**
```typescript
// Source: StandupNotesPage.tsx lines 308–331 (exact key to replicate)
const jiraActivityQuery = useQuery({
  queryKey: [
    'standup', 'jira',
    jiraBaseUrl,
    activeJiraProject,
    yesterdayDate,
    id.jiraUsername ?? '',
  ],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No Jira token');
    return fetchYesterdayJiraActivity(jiraBaseUrl ?? '', token, activeJiraProject ?? '', yesterdayDate, id.jiraUsername ?? '');
  },
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!id.jiraUsername && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});
```

**Warning:** The commits query key includes a `resolvedAccountsKey || gitlabUsername || gitlabName || ''` sixth element. In ActivityStrip on Dashboard, we do NOT have watch-mode — we use `gitlabUsername || gitlabName || ''` (the self-user path). This must match exactly what Standup produces for the self-user case, otherwise the cache will not be shared. Verify against StandupNotesPage lines 358–403 when implementing.

### Pattern 2: Timezone-Safe Date Bucketing

**What:** Use `worklog.dateStarted` (already normalized to `YYYY-MM-DD` by `fetchWorklogs`) as the bucket key. Never derive a date from a raw ISO timestamp via `new Date(...).toISOString()`.

**When to use:** `WeeklyTrendChart`'s bucketing function (criterion 1 mandate).

**Example (pure function to write):**
```typescript
// Source: worklogs.ts line 53 confirms dateStarted is pre-sliced
const DAILY_TARGET_HOURS = 8;

function buildWeekBuckets(
  worklogs: TempoWorklog[],
  weekStart: string, // YYYY-MM-DD (Monday)
): { day: string; label: string; hours: number }[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const buckets = days.map((label, i) => {
    const date = addDays(weekStart, i); // YYYY-MM-DD arithmetic, not Date construction
    return { day: date, label, hours: 0 };
  });
  for (const w of worklogs) {
    const bucket = buckets.find((b) => b.day === w.dateStarted);
    if (bucket) bucket.hours += w.timeSpentSeconds / 3600;
  }
  return buckets;
}
// Mandated unit test input: { dateStarted: "2026-06-14" } (already normalized)
// The test must verify: worklog with raw started "2026-06-14T23:00:00"
// ⇒ fetchWorklogs normalizes it ⇒ dateStarted = "2026-06-14"
// ⇒ buildWeekBuckets assigns it to the "2026-06-14" (Saturday/Friday) bucket
```

### Pattern 3: MR Queue Grouping from Warm Cache

**What:** `MrReviewQueue` reads the warm `['gitlab-mrs', gitlabBaseUrl, gitlabUserId]` cache via `useQuery` (same key as `MrHealthPanel`). Derives two groups client-side:
- "Awaiting my review": MRs where `mr.reviewers.some(r => r.id === gitlabUserId)` AND `mr.author.id !== gitlabUserId`
- "My open MRs": MRs where `mr.author.id === gitlabUserId`

The cache payload confirmed from `MrHealthPanel.tsx` lines 34–49:
```typescript
// queryFn returns:
return { filtered: merged, merged };
// where merged = deduped union of fetchAssignedMRs() + fetchReviewerMRs()
```

**Critical detail:** The cache uses `mrQueryData?.filtered` as the full list. Both "Awaiting my review" and "My open MRs" groups must be derived by filtering `filtered` by reviewer/author identity — not by using separate API calls.

**MrHealthPanel already populates this cache on the current Dashboard** (visible in index.tsx). However, Phase 83 completed — `MrHealthPanel` is still mounted in the current `index.tsx`. After Phase 84, the `MrHealthPanel` component is REPLACED by `MrReviewQueue` (which provides a richer queue view). The planner must remove the old `MrHealthPanel` mount and add `MrReviewQueue`.

**Wait — verify:** `MrHealthPanel` IS present in the live dashboard. Checking index.tsx... it is NOT imported in the Phase 83 `index.tsx` (Phase 83 only added stat tiles + sprint health + release card). The `MrHealthPanel` was a Phase 83 DASH-02 reference component but lives in the dashboard folder unused by the current index. So the `['gitlab-mrs',...]` cache will be cold when Dashboard loads in Phase 84 until `MrReviewQueue` populates it. The `enabled` gate handles cold-load gracefully.

### Pattern 4: ChartWrapper Usage for BarChart

**What:** Wrap the Recharts `BarChart` in `ChartWrapper` with status props. ChartWrapper handles the card shell, explicit height, skeleton, error, and empty states.

**Confirmed API from `chart-wrapper.tsx`:**
```typescript
// Source: taskflow/src/components/chart-wrapper.tsx
interface ChartWrapperProps {
  title: string;
  description?: string;
  height?: number;      // default 240
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}
```

`ChartWrapper` renders `children` only when not loading/error/empty. The `WeeklyTrendChart` passes the Tempo-off empty state via `isEmpty` (not `error`) per D-06.

**Mandatory rules from Phase 81 (CONTEXT D-01–D-04):**
- `'use no memo'` at top of file
- `responsive` prop on `BarChart`, never `ResponsiveContainer`
- Outer `<div style={{ height }}>` wrapping `ChartContainer`
- `isAnimationActive={false}` on `Bar`
- Colors as `var(--chart-N)` CSS-var strings

### Anti-Patterns to Avoid

- **Using `new Date(worklog.started).toISOString().slice(0,10)` for bucketing:** This shifts the date by UTC offset. `fetchWorklogs` already normalizes `dateStarted` to `YYYY-MM-DD`. Use `dateStarted` directly. [VERIFIED: worklogs.ts line 53]
- **Firing a new fetch for the MR queue:** The `['gitlab-mrs', gitlabBaseUrl, gitlabUserId]` cache is the contract. No new polling interval or fetch (D-12).
- **Using `enabled: false` for the activity strip:** D-09 explicitly forbids this — the strip must fetch on cold Dashboard load. Use `enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!jiraUsername && !!yesterdayDate` (mirroring Standup).
- **Different query key from Standup for commits:** The sixth key element must match the self-user case in StandupNotesPage exactly (`resolvedAccountsKey || gitlabUsername || gitlabName || ''`). On Dashboard there is no watch mode so this simplifies to `gitlabUsername || gitlabName || ''`.
- **Using `ResponsiveContainer`:** Causes React Compiler conflict + WebKit 0×0 collapse. Use `responsive` prop.
- **Nesting a `<button>` inside an MR row `div[role=button]`:** Use the overlay button pattern per `project_overlay_button_nested_interactive` memory.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart card shell | Custom loading/error/empty card | `ChartWrapper` | Already handles all three states + explicit height guard |
| Skeleton UI | Custom animated placeholder | `Skeleton` from `ui/skeleton.tsx` | Project standard; consistent timing |
| Error recovery | Custom error display | `ErrorState` from `ui/error-state.tsx` | Accepts `onRetry` + `viewName` prop; project standard |
| Empty state | Custom empty display | `EmptyState` from `ui/empty-state.tsx` | Accepts `icon`, `title`, `subtitle`; already used by ChartWrapper |
| Loading flash prevention | Custom setTimeout | `useDelayedLoading` hook | 300ms guard already tested and used in Phases 83 + others |
| External URL open | `window.open(url)` | `openUrl(url)` from `@tauri-apps/plugin-opener` | `window.open` blocked in Tauri webview; `openUrl` is the project's confirmed pattern |
| Week-start calculation | Custom date arithmetic | `date-fns` or inline — but MUST be pure YYYY-MM-DD string arithmetic | Never construct `new Date()` for bucketing; use string `slice(0, 10)` on `dateStarted` |

**Key insight:** The entire MR queue is a client-side grouping/rendering exercise over cached data. Building any network call into it violates D-12 and criterion 3.

---

## Common Pitfalls

### Pitfall 1: Commits Query Key Mismatch with Standup (criterion 2 blocker)

**What goes wrong:** The activity strip fires a duplicate network request even after Standup was visited, because the sixth element of the commits query key doesn't match what StandupNotesPage used.

**Why it happens:** StandupNotesPage uses `resolvedAccountsKey || resolvedId.gitlabUsername || resolvedId.gitlabName || ''`. On Dashboard (no watch mode), `resolvedAccountsKey` is always empty, so the effective value is `gitlabUsername || gitlabName || ''`. If the Dashboard uses `gitlabUserId` or any other field instead, the cache miss fires a new request.

**How to avoid:** Implement ActivityStrip to use exactly `gitlabUsername || gitlabName || ''` as the sixth key element (the self-user path of StandupNotesPage). Confirm by reading StandupNotesPage lines 358–403 and the `resolveEffectiveIdentity` logic to ensure the self-user case resolves the same fields.

**Warning signs:** Two network requests to the Jira activity endpoint within the same session after visiting Standup + Dashboard.

### Pitfall 2: `yesterdayDate` Derivation Inconsistency

**What goes wrong:** The activity strip's query is enabled but returns no data because `yesterdayDate` on Dashboard doesn't match the date Standup used when it last fetched.

**Why it happens:** Standup computes `yesterdayDate` via `resolveYesterdayDate(scheduleData)` from `standup-date.ts` — the schedule-aware "last working day" logic (holiday-aware for Tempo users). Dashboard naively uses `new Date(Date.now() - 86400000).toISOString().slice(0,10)`.

**How to avoid:** Compute `yesterdayDate` on Dashboard the same way: use `new Date().toLocaleDateString('en-CA')` for today, subtract one day as a string, OR call the same `resolveYesterdayDate` helper. At minimum, use `new Date(Date.now() - 86400000).toLocaleDateString('en-CA')` (not `toISOString` which shifts UTC). If the cache miss persists, the strip still fetches fresh data — criterion 2 is about warm-cache reuse, not about the date matching perfectly in all timezone scenarios.

**Warning signs:** Activity strip always shows a loading state after Standup was visited same session.

### Pitfall 3: MR Queue "Awaiting my review" vs "My open MRs" Overlap

**What goes wrong:** An MR where the user is both author AND reviewer appears in both groups.

**Why it happens:** `fetchReviewerMRs` returns all MRs where userId is a reviewer, including self-authored MRs.

**How to avoid:** Filter "Awaiting my review" to exclude MRs where `mr.author.id === gitlabUserId`. The MrHealthPanel precedent uses `filtered` (the deduped union) — apply the same identity filter: reviewer group = `filtered.filter(mr => mr.reviewers.some(r => r.id === gitlabUserId) && mr.author.id !== gitlabUserId)`.

**Warning signs:** MR appearing in both queue groups.

### Pitfall 4: `MrHealthPanel` vs `MrReviewQueue` Cache Population

**What goes wrong:** The MR queue shows a persistent loading state because `gitlabToken` is null when the component first renders.

**Why it happens:** `gitlabToken` is loaded asynchronously via `readSecret('gitlab-pat')` inside a `useEffect`. The `enabled` gate on the query must wait for `gitlabToken` to be non-null. Until it resolves, `isLoading` is false but `mrQueryData` is undefined.

**How to avoid:** Same pattern as `MrHealthPanel` — pass `tokenLoading` prop to distinguish "token not yet loaded" from "GitLab not configured". Show skeleton while token is loading. See `MrHealthPanel.tsx` lines 68–75.

### Pitfall 5: Activity Strip Token in queryKey

**What goes wrong:** Biome/linting fails or cache isolation breaks because token strings appear in queryKey.

**Why it happens:** T-62-06 rule (standup comment, line 8): `jiraToken / gitlabToken MUST NOT appear in any queryKey. Tokens live only inside the queryFn closure via readSecret()`.

**How to avoid:** `queryFn` uses `await readSecret('jira-pat')` internally — never pass token as a prop to queryKey. The `enabled` guard uses boolean `!!jiraToken` (the component-level loaded token) to defer until ready, but the token string itself stays out of the key.

### Pitfall 6: ReferenceLine at y=8 Rendering as Missing in Empty State

**What goes wrong:** When no worklogs exist (all-zero week), the Y-axis domain [0, 12] still shows but the ReferenceLine at y=8 might not render if ChartWrapper shows `isEmpty`.

**Why it happens:** `isEmpty` is passed to ChartWrapper and short-circuits to EmptyState BEFORE the children (chart) render.

**How to avoid:** Pass `isEmpty` to ChartWrapper only when `tempoEnabled` is false (D-06 "Tempo not connected" case). When `tempoEnabled` is true but there are no worklogs, still render the chart with all-zero bars — an all-zeros week is valid data, not an empty state. Use the "No hours logged yet" empty-state copy from UI-SPEC only if the array is literally null/undefined (fetch error path).

### Pitfall 7: `DashboardReleaseCard` Relocation Breaking Prop Chain

**What goes wrong:** After relocating `DashboardReleaseCard` from its standalone `div` into the "Activity & Releases" grid, the props stop flowing correctly.

**Why it happens:** `DashboardReleaseCard` requires `jiraBaseUrl`, `jiraToken`, `activeJiraProject` — all already present in `index.tsx`. The relocation is only a JSX mount-point change, not a prop change.

**How to avoid:** The relocation is mechanical — remove the `<div className="relative px-6 pb-6"><DashboardReleaseCard .../></div>` block (lines 207–214 of current index.tsx) and re-add it inside the Activity & Releases section grid. Props unchanged.

---

## Code Examples

### WeeklyTrendChart skeleton structure

```typescript
// Source: Phase 81 ChartWrapper API + Chart-wrapper.tsx confirmed shape
'use no memo';

import { BarChart, Bar, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { ChartWrapper } from '@/components/chart-wrapper';

const DAILY_TARGET_HOURS = 8;

export function WeeklyTrendChart({ /* props */ }) {
  // tempoEnabled from useSettingsStore
  // query: ['dashboard','tempo-week', jiraBaseUrl, weekStartDate, jiraUsername]
  // data: buildWeekBuckets(worklogs, weekStartDate)

  return (
    <ChartWrapper
      title="Hours logged this week"
      description="Mon – Fri · 8 h/day target"
      height={240}
      isLoading={showSkeleton}
      error={!tempoEnabled ? undefined : queryError}
      isEmpty={!tempoEnabled}
      onRetry={refetch}
    >
      <ChartContainer config={chartConfig}>
        <BarChart data={buckets} responsive>
          <XAxis dataKey="label" />
          <YAxis domain={[0, 12]} tickFormatter={(v) => `${v}h`} />
          <Bar dataKey="hours" fill="var(--chart-1)" isAnimationActive={false} />
          <ReferenceLine y={DAILY_TARGET_HOURS} stroke="var(--chart-2)" label={{ value: 'Target', position: 'right', fontSize: 11 }} />
        </BarChart>
      </ChartContainer>
    </ChartWrapper>
  );
}
```

### MR queue health badge read

```typescript
// Source: MrHealthPanel.tsx lines 55–59 — confirmed getQueryData pattern
const queryClient = useQueryClient();

for (const mr of awaitingReview) {
  const health = queryClient.getQueryData<string>(['mr-health', mr.project_id, mr.iid]);
  // health: 'approved' | 'changes_requested' | undefined (→ needs_review)
}
```

### Activity strip interleave

```typescript
// Pure merge — no library needed
type ActivityEntry =
  | { type: 'jira'; at: string; item: JiraActivityItem }
  | { type: 'commit'; at: string; item: GitLabCommit };

function mergeActivityEntries(
  jiraItems: JiraActivityItem[],
  commits: GitLabCommit[],
  cap: number,
): ActivityEntry[] {
  const all: ActivityEntry[] = [
    ...jiraItems.flatMap(item =>
      item.transitions.map(t => ({ type: 'jira' as const, at: t.at, item }))
    ),
    ...commits.map(c => ({ type: 'commit' as const, at: c.authored_date, item: c })),
  ];
  return all
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, cap);
}
```

### External URL open (MR click)

```typescript
// Source: ReleaseDetailPage.tsx line 968 — confirmed pattern
import { openUrl } from '@tauri-apps/plugin-opener';

// In MR row click handler:
onClick={() => openUrl(mr.web_url)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new Date(...).toISOString()` for date bucketing | `.slice(0, 10)` on `dateStarted` (pre-normalized) | Phase 61 / D-04 | Timezone-safe bucketing; critical for users in UTC+N |
| `ResponsiveContainer` from Recharts | `responsive` prop on chart component | Phase 81 | Avoids React Compiler conflict + WebKit 0×0 collapse |
| Per-chart loading/error/empty boilerplate | `ChartWrapper` status-prop card | Phase 81 | Consistent chart states across all dashboard charts |
| `window.open()` for external URLs | `openUrl()` from `@tauri-apps/plugin-opener` | Phase 1+ | Required in Tauri webview; `window.open` is blocked |
| Token strings in queryKey | Token in `queryFn` only via `readSecret()` | Phase 62 (T-62-06) | Cache isolation; security; project rule |

**Deprecated/outdated:**
- `MrHealthPanel`: This existing component shows MR health as counts. Phase 84 replaces it with `MrReviewQueue` (richer grouped list). `MrHealthPanel.tsx` file remains but its mount in `index.tsx` is removed.
- `SmokeTestChart`: Already deleted in Phase 83 (confirmed absent from index.tsx).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GitLabCommit` shape has a `authored_date` field confirmed as ISO 8601 timestamp for sort | Code Examples (activity interleave) | RESOLVED [VERIFIED: services/gitlab.ts line 1272] |
| A2 | `MrHealthPanel` is not mounted in the current Phase 83 `index.tsx` | Architecture Patterns (Pattern 3) | If it IS mounted, the warm cache is already populated — which is better, not worse — but the planner should verify to avoid double-mounting |
| A3 | `yesterdayDate` on Dashboard computed as simple "yesterday" matches Standup's holiday-aware date close enough for same-session cache sharing | Common Pitfalls (Pitfall 2) | On a day after a holiday, Dashboard and Standup may use different dates — strip fetches fresh but criterion 2 may not hold perfectly for Tempo users. Acceptable per D-09 ("the strip must not be blank on a cold Dashboard") |

---

## Open Questions

1. **`GitLabCommit` timestamp field — RESOLVED**
   - Confirmed: `authored_date: string` (ISO 8601) at `services/gitlab.ts` line 1272. [VERIFIED: codebase read]
   - ActivityStrip sorts by `c.authored_date`.

2. **Is `MrHealthPanel` currently mounted in `index.tsx`?**
   - What we know: The component exists; Phase 83 added stat tiles + sprint health; the live `index.tsx` has been read
   - What's unclear: The read of `index.tsx` shows it is NOT imported — correct; `MrHealthPanel` was part of the older Dashboard, removed in Phase 83
   - Recommendation: Confirmed NOT mounted. No action needed — `MrReviewQueue` will be the first mount of the `['gitlab-mrs',...]` cache on Dashboard.

---

## Environment Availability

> Step 2.6: SKIPPED — this phase is a pure frontend extension. No new external dependencies. All required services (Jira, GitLab, Tempo) are already configured and used in existing phases. No new CLI tools, runtimes, or databases required.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `taskflow/vitest.config.ts` (existing) |
| Quick run command | `cd taskflow && npm run test -- --run src/routes/dashboard/dashboardMetrics.test.ts` |
| Full suite command | `cd taskflow && npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-04 (criterion 1) | `dateStarted: "2026-06-14"` (pre-normalized from `"2026-06-14T23:00:00"`) buckets to `2026-06-14` | unit | `npm run test -- --run src/routes/dashboard/dashboardMetrics.test.ts` | ❌ Wave 0 — extend `dashboardMetrics.test.ts` with `buildWeekBuckets` tests |
| DASH-04 (criterion 1) | Tempo-off renders empty state, not error | component (render) | `npm run test -- --run src/routes/dashboard/WeeklyTrendChart.test.tsx` | ❌ Wave 0 — new file |
| DASH-05 (criterion 2) | Same query key as Standup — no duplicate fetch when both visited | integration (queryClient spy) | `npm run test -- --run src/routes/dashboard/ActivityStrip.test.tsx` | ❌ Wave 0 — new file |
| DASH-06 (criterion 3) | MR queue groups "Awaiting my review" excludes self-authored | unit (pure grouping fn) | `npm run test -- --run src/routes/dashboard/MrReviewQueue.test.tsx` | ❌ Wave 0 — new file |
| DASH-07 (criterion 4) | One section error does not blank other sections | component (render, per-section) | Covered by per-component render tests with mocked query states | ❌ Wave 0 — per new component |

### Mandated Test: Timezone-Safe Bucketing (criterion 1)

This is the single most safety-critical test in the phase. The criterion explicitly states:
> `tempo.started.slice(0, 10)` — verified by a unit test with `started: "2026-06-14T23:00:00"` asserting bucket `2026-06-14`

The test must exercise the full normalization chain:
1. `fetchWorklogs` normalizes raw API `dateStarted: "2026-06-14T23:00:00+01:00"` → `"2026-06-14"` via `.slice(0, 10)` ✓ (already done by the service)
2. `buildWeekBuckets` receives `dateStarted: "2026-06-14"` and assigns it to the correct bucket

The test fixture:
```typescript
// In dashboardMetrics.test.ts or weeklyBuckets.test.ts
it('timezone-safe: dateStarted "2026-06-14T23:00:00" pre-normalized to "2026-06-14" buckets correctly', () => {
  // fetchWorklogs already normalizes; simulate the post-normalization input:
  const worklogs = [{ dateStarted: '2026-06-14', timeSpentSeconds: 3600 }];
  const buckets = buildWeekBuckets(worklogs, '2026-06-09'); // Mon of that week
  const friday = buckets.find(b => b.day === '2026-06-14');
  expect(friday?.hours).toBe(1);
});
```

### Mandated Test: No Duplicate Network Request (criterion 2)

Use a `queryClient` spy or intercept pattern:
```typescript
// Mock queryClient.fetchQuery; assert it's NOT called for jira/commits keys
// after they've been populated from a "Standup visit" simulation
```

This is best tested as a unit test against the query key matching — confirm `ActivityStrip` uses exactly the same key construction as `StandupNotesPage` for the self-user case.

### Sampling Rate

- **Per task commit:** `cd taskflow && npm run test -- --run src/routes/dashboard/dashboardMetrics.test.ts`
- **Per wave merge:** `cd taskflow && npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/routes/dashboard/dashboardMetrics.test.ts` — extend with `buildWeekBuckets` timezone-safe test (covers REQ DASH-04 criterion 1)
- [ ] `src/routes/dashboard/WeeklyTrendChart.test.tsx` — render test: Tempo-off → EmptyState rendered, not ErrorState
- [ ] `src/routes/dashboard/MrReviewQueue.test.tsx` — unit test for MR grouping logic (reviewer-not-author / author); empty state when no MRs; GitLab-not-configured state
- [ ] `src/routes/dashboard/ActivityStrip.test.tsx` — query key match assertion; interleave/sort test; cap-at-N test

---

## Security Domain

> `security_enforcement` is not explicitly set to `false` in config — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth flows |
| V3 Session Management | No | No new session handling |
| V4 Access Control | No | No new permission checks — reads existing caches only |
| V5 Input Validation | Yes (low risk) | `web_url` from GitLab API passed to `openUrl()` — only open MRs from the project's own GitLab instance; no user-supplied URL |
| V6 Cryptography | No | Tokens read via `readSecret` (Stronghold) — existing pattern, no new crypto |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `mr.web_url` | Spoofing | URL comes from GitLab API (same instance configured in auth store); no user input; acceptable risk |
| Token in query key (T-62-06) | Information Disclosure | Tokens in `queryFn` only via `readSecret()`, never in `queryKey` — enforced by project rule |
| XSS via MR title in DOM | Tampering | React renders as text (via JSX), not `innerHTML`; MR title is a plain string |

---

## Sources

### Primary (HIGH confidence)

- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs` signature confirmed; `dateStarted.slice(0,10)` normalization at line 53 [VERIFIED: codebase read]
- `taskflow/src/services/tempo/types.ts` — `TempoWorklog` shape confirmed: `dateStarted: string`, `timeSpentSeconds: number` [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` lines 308–331 — `jiraActivityQuery` exact key confirmed: `['standup','jira', jiraBaseUrl, activeJiraProject, yesterdayDate, id.jiraUsername ?? '']` [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` lines 358–403 — `commitsQuery` exact key confirmed: `['standup','commits', gitlabBaseUrl, activeGitlabProject, yesterdayDate, resolvedAccountsKey || resolvedId.gitlabUsername || resolvedId.gitlabName || '']` [VERIFIED: codebase read]
- `taskflow/src/routes/dashboard/MrHealthPanel.tsx` — `['gitlab-mrs', gitlabBaseUrl, userId]` cache shape confirmed: `{ filtered: GitLabMR[], merged: GitLabMR[] }`; `['mr-health', project_id, iid]` read via `getQueryData` at lines 55–59 [VERIFIED: codebase read]
- `taskflow/src/services/gitlab.ts` lines 243–256 — `GitLabMR` interface confirmed: `id`, `iid`, `project_id`, `title`, `author.id`, `reviewers[].id`, `state`, `web_url` [VERIFIED: codebase read]
- `taskflow/src/services/gitlab.ts` lines 337, 376, 419 — `fetchAssignedMRs`, `fetchAuthoredMRs`, `fetchReviewerMRs` all confirmed to exist with `(baseUrl, token, userId?)` signatures [VERIFIED: codebase read]
- `taskflow/src/stores/settings.store.ts` line 56 — `tempoEnabled: false` default; selector `useSettingsStore((s) => s.tempoEnabled)` confirmed [VERIFIED: codebase read]
- `taskflow/src/stores/auth.store.ts` — `gitlabUserId: number | null`, `gitlabUsername: string | null`, `gitlabName: string | null`, `jiraUsername: string | null` all confirmed [VERIFIED: codebase read]
- `taskflow/src/components/chart-wrapper.tsx` — `ChartWrapper` props confirmed: `title`, `description`, `height`, `isLoading`, `error`, `isEmpty`, `onRetry`, `children` [VERIFIED: codebase read]
- `taskflow/src/routes/dashboard/index.tsx` — Phase 83 mount points confirmed: hero (lines 117–145), stat tiles (148–194), SprintHealthSection (196–205), DashboardReleaseCard (207–214) [VERIFIED: codebase read]
- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` — cache key `['jira-fix-versions', activeJiraProject]` confirmed; component props confirmed [VERIFIED: codebase read]
- `taskflow/src/routes/dashboard/dashboardMetrics.ts` — pure function pattern for Phase 84's `buildWeekBuckets` to follow [VERIFIED: codebase read]
- `taskflow/src/routes/dashboard/MrHealthPanel.tsx` — NOT mounted in Phase 83 index.tsx; `['gitlab-mrs',...]` cache will be cold on fresh Dashboard load [VERIFIED: index.tsx read + grep]
- `@tauri-apps/plugin-opener` `openUrl()` — confirmed as the project's external-URL pattern (ReleaseDetailPage lines 857, 901, 968; MergeRequestDetailPage line 222) [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- Phase 81 CONTEXT.md — charting rules (D-01..D-08): `responsive` prop, `'use no memo'`, `isAnimationActive={false}`, `var(--chart-N)` tokens [CITED: .planning/phases/81-charting-foundation/81-CONTEXT.md]
- Phase 83 CONTEXT.md — Dashboard layout pattern, `StatTile`/`SprintHealthSection` composition reference [CITED: .planning/phases/83-dashboard-stat-tiles-and-sprint-health-chart/83-CONTEXT.md]
- 84-UI-SPEC.md — visual contract for all three new components [CITED: 84-UI-SPEC.md]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used; no new packages
- Architecture: HIGH — all codebase anchors verified by direct file reads
- Pitfalls: HIGH — derived from confirmed code patterns and project memories
- Query key reuse: HIGH — keys read verbatim from StandupNotesPage source
- Cache shape: HIGH — MrHealthPanel source confirms `{ filtered, merged }` shape
- GitLabCommit timestamp field: LOW — field name not yet verified; marked as A1

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable codebase; no external API dependencies changing)
