# Phase 86: Dashboard Redesign — Research

**Researched:** 2026-06-15
**Domain:** Frontend redesign + dead-code removal; Recharts v3 dual-axis grouped bars
**Confidence:** HIGH (all findings verified against actual source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full clean slate — remove ALL current dashboard widgets including Phase 85 Velocity + Burndown.
- **D-02:** Issue COUNTS everywhere (not story points) for MY ISSUES.
- **D-03:** Bucket by `status.statusCategory.key` (`'new'` → To Do, `'indeterminate'` → In Progress, `'done'` → Done).
- **D-04:** Personal scope via `assignee.displayName === jiraUserDisplayName`; exclude subtasks (`!issuetype.subtask`).
- **D-05:** 0 issues → empty state. Reuse sprint-board cache key → 0 new network calls.
- **D-06:** Next 3 unreleased versions WITH a `releaseDate`, sorted soonest-first. No-date versions excluded.
- **D-07:** `donePct = doneCount/totalCount` by `statusCategory.key === 'done'`, issue count basis. Reuse `fetchReleaseIssues` + `['jira-fix-versions', activeJiraProject]` cache key.
- **D-08:** Fewer than 3 releases → render only what exists; 0%/100% render honestly; reuse `getReleaseTimingLabel`.
- **D-09:** Rolling 7 calendar days ending today (NOT Mon–Fri week). Weekday labels; today highlighted.
- **D-10:** Dual Y-axis grouped bars. Hours left (blue), commits right (green). Header totals. Dashed gridline at max.
- **D-11:** Hours from `fetchWorklogs` (`tempo.started.slice(0,10)` local-date bucketing). Commits from `fetchUserCommits`. No new endpoint.
- **D-12:** All-zero week renders flat bars with "0h"/"0" labels, NOT empty state.
- **D-13:** Reuse `getTimeGreeting()` + first-name parser; add sprint-position subline from `activeSprint.startDate`/`endDate`; hide sprint clause when no active sprint.
- **D-14:** Recharts v3 via `ChartWrapper` + shadcn `chart`; `responsive` prop (not `<ResponsiveContainer>`); explicit-height div; `isAnimationActive={false}`; `var(--chart-N)` tokens.

### Claude's Discretion

- Exact component decomposition (favor `MyIssuesCard`, `UpcomingReleasesTimeline`, `HoursCommitsChart`).
- Precise visual polish — match the screenshots.
- Whether `fetchClosedSprints`, `fetchSprintIssuesBySprintId`, `fetchBurndown`, GreenHopper rapid-charts call are deleted — delete IFF no other consumer (reference search below confirms delete).

### Deferred Ideas (OUT OF SCOPE)

- Personal velocity trend chart (removed from Dashboard surface).
- Sprint burndown chart (removed from Dashboard surface).
- Configurable 7-day window / N-day range.
- Releases with no due date on the timeline.
</user_constraints>

---

## Summary

Phase 86 is a full rewrite of `taskflow/src/routes/dashboard/index.tsx` to a 3-region layout (Hero / MY ISSUES + UPCOMING RELEASES / PAST 7 DAYS chart), combined with deletion of every old Phase 83–85 widget. All data sources already exist and are warm-cache-compatible. The key work is: (1) writing three new card components that lift data patterns from the files being deleted, (2) executing a precise deletion that leaves zero orphaned exports or imports, and (3) implementing the Recharts dual-axis ComposedChart following the locked Phase 81 charting contract.

The Sidebar prefetch of `['jira-active-sprint', ...]` MUST be retained as-is — it will continue to warm the cache for the new `HoursCommitsChart` and hero subline, even though `SprintHealthSection` (its original beneficiary) is deleted.

The `dashboardMetrics.ts` module survives the deletion but with 7 of its 11 exported functions becoming dead. The 4 survivors are: `filterNonSubtasks`, `buildWeekBuckets`, `formatHoursMinutes`, and a new `buildRolling7Buckets` (the rolling-7 equivalent of `buildWeekBuckets`). Everything else in that module becomes dead and must be deleted or the file slimmed to only surviving exports.

**Primary recommendation:** Deliver in 3 waves — (1) create new components + slim `dashboardMetrics.ts`, (2) rewrite `index.tsx` to compose only the 3 new components, (3) delete old files and extend `widget-removal.guard.test.ts`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hero greeting text + first-name parse | Frontend (index.tsx) | — | Pure local computation; no API |
| Sprint-day subline (elapsed/total) | Frontend (index.tsx) | API/cache | Derives from cached `activeSprint.startDate`/`endDate` |
| MY ISSUES counts + segmented bar | Frontend (MyIssuesCard) | API (jira-issues sprint-board cache) | Pure derivation from existing query; no new call |
| UPCOMING RELEASES timeline (3 dots) | Frontend (UpcomingReleasesTimeline) | API (jira-fix-versions cache) | Extends DashboardReleaseCard logic to 3 items |
| Hours per day | Frontend (HoursCommitsChart) | Tempo API (fetchWorklogs) | Rolling-7 window; existing service |
| Commits per day | Frontend (HoursCommitsChart) | GitLab API (fetchUserCommits) | 7 separate single-day calls OR one per-day bucket |

---

## Reuse Map

Verified against actual source. Every signature below is the real implementation.

### `fetchWorklogs` — `taskflow/src/services/tempo/worklogs.ts:28`

```ts
export async function fetchWorklogs(
  baseUrl: string,
  token: string,
  usernames: string[],   // query param: username=, one per entry
  from: string,          // YYYY-MM-DD (inclusive)
  to: string,            // YYYY-MM-DD (inclusive)
): Promise<TempoWorklog[]>
```

- Returns a **flat array** (no pagination envelope — Phase 61 probe confirmed). [VERIFIED: source file]
- Each `TempoWorklog.dateStarted` is normalized to `YYYY-MM-DD` via `.slice(0, 10)` inside the function. [VERIFIED: worklogs.ts:52]
- `TempoWorklog` fields used for bucketing: `dateStarted: string`, `timeSpentSeconds: number`. [VERIFIED: tempo/types.ts:18]
- **Current cache key** (WeeklyTrendChart): `['dashboard', 'tempo-week', jiraBaseUrl, weekStartDate, jiraUsername]` — keyed to the Monday of the current week. [VERIFIED: WeeklyTrendChart.tsx:89]
- **For Phase 86:** Use a rolling-7-day window `from = 6 days ago (en-CA)`, `to = today (en-CA)`. The cache key for the new component must differ — proposed: `['dashboard', 'tempo-7day', jiraBaseUrl, todayDate, jiraUsername]` (TODAY as anchor, so key auto-rotates at midnight without manual invalidation).
- **Date bucketing pattern to copy:** `buildWeekBuckets` in `dashboardMetrics.ts:180` — bucket by `wl.dateStarted === bucket.day` direct string equality on the pre-normalized field. For rolling-7, build a `buildRolling7Buckets(worklogs, todayDate)` equivalent. [VERIFIED: dashboardMetrics.ts:180]
- **UTC-shift trap:** `from`/`to` must be `new Date().toLocaleDateString('en-CA')` (local calendar), NOT `toISOString()`. [VERIFIED: WeeklyTrendChart.tsx:56, dashboardMetrics.ts:159–163]

### `fetchUserCommits` — `taskflow/src/services/gitlab.ts:1311`

```ts
export async function fetchUserCommits(
  baseUrl: string,
  token: string,
  projectId: number,
  date: string,                                                      // LOCAL date YYYY-MM-DD
  authorUsername: string | readonly string[],
  authorName?: string | readonly (string | null | undefined)[] | null,
  authorEmail?: string | readonly (string | null | undefined)[] | null,
): Promise<GitLabCommit[]>
```

- Accepts a **single date** (not a range). Internally converts `date` to local-midnight UTC boundaries for the API. [VERIFIED: gitlab.ts:1324–1325]
- Paginates internally up to 50 pages × 100 per page; dedupes by commit id; filters client-side by identity. [VERIFIED: gitlab.ts:1337–1366]
- `GitLabCommit.authored_date` is ISO 8601 (includes time + TZ). [VERIFIED: gitlab.ts:1272]
- **For the 7-day chart:** Must call `fetchUserCommits` ONCE PER DAY for each of the 7 days, OR batch them. Since `ActivityStrip` already calls it once per day (for yesterday), the pattern is known. Recommended: 7 parallel `useQueries` calls, one per day, each reusing the existing standup cache key pattern `['standup', 'commits', gitlabBaseUrl, activeGitlabProject, dayDate, gitlabUsername || gitlabName || '']` — this matches `ActivityStrip.tsx:159–166` exactly and will warm-cache-share with ActivityStrip's yesterday entry automatically.
- **GitLab not configured:** `enabled: !!gitlabBaseUrl && !!gitlabToken && ...` — when false, commits series stays all-zero. [VERIFIED: ActivityStrip.tsx:184–189]

### `fetchSprintIssues` — `taskflow/src/services/jira.ts:392`

```ts
export async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = true,          // pass false to get full sprint
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<JiraIssue[]>
```

- Passes `assignedToMe = false` → returns full sprint (caller filters personally). [VERIFIED: jira.ts:396–412]
- Returns parent issues + subtasks (subtasks appended in second query). Personal filter + subtask exclusion applied by the caller via `dashboardMetrics.filterNonSubtasks` + `assignee.displayName === jiraUserDisplayName`. [VERIFIED: index.tsx:117–125, dashboardMetrics.ts:28–30, 64–85]
- **Cache key (must reuse verbatim):** `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` — shared across index.tsx, SprintHealthSection, SprintBoardTab. [VERIFIED: index.tsx:102–108, SprintHealthSection.tsx:67]
- **`JiraIssue.fields.status.statusCategory.key`** values in use: `'new'`, `'indeterminate'`, `'done'`. [VERIFIED: dashboardMetrics.ts:97–112]
- **My Issues derivation pattern** (lift from `computePersonalTileCounts` in dashboardMetrics.ts:64):
  ```ts
  const myNonSubtasks = issues.filter(
    (i) => !i.fields.issuetype.subtask && i.fields.assignee?.displayName === jiraUserDisplayName,
  );
  // Then bucket by statusCategory.key:
  const toDo = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'new').length;
  const inProgress = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'indeterminate').length;
  const done = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'done').length;
  const total = myNonSubtasks.length;
  // Invariant: toDo + inProgress + done === total (assert in test)
  ```
  [VERIFIED: dashboardMetrics.ts:69–84, CONTEXT.md D-02/D-03/D-04]

### `fetchActiveSprint` — `taskflow/src/services/jira.ts:1341`

```ts
export async function fetchActiveSprint(
  baseUrl: string,
  token: string,
  projectKey: string,
  boardId?: number,
): Promise<JiraActiveSprint | null>
```

```ts
export interface JiraActiveSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  startDate?: string;   // ISO 8601 — used for sprint-day calc
  endDate?: string;     // ISO 8601 — used for sprint-day calc
  goal?: string;
  originBoardId?: number;
}
```

- Returns `null` when no active sprint (never throws). [VERIFIED: jira.ts:1379]
- **Cache key (must reuse verbatim):** `['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]` — used identically in Sidebar prefetch, SprintHealthSection, and index.tsx. [VERIFIED: Sidebar.tsx:150, SprintHealthSection.tsx:81, index.tsx:131]
- **Sprint-day subline calculation** (from UI-SPEC.md and verified CONTEXT.md D-13):
  ```ts
  // Both dates: local calendar, NOT toISOString()
  const today = new Date().toLocaleDateString('en-CA');
  const elapsed = differenceInCalendarDays(today, sprint.startDate) + 1;
  const total = differenceInCalendarDays(sprint.endDate, sprint.startDate) + 1;
  // "Sprint day {elapsed} of {total}"
  // Hide clause entirely when activeSprint === null
  ```
  Use date arithmetic via `Date.UTC` (same pattern as `addDays` in dashboardMetrics.ts:159) — avoid `new Date(startDate)` which can shift timezone. [VERIFIED: dashboardMetrics.ts:159–163]

### `fetchFixVersions` + `fetchReleaseIssues` + `getReleaseTimingLabel` — `DashboardReleaseCard.tsx`

**`fetchFixVersions(baseUrl, token, projectKey): Promise<JiraFixVersion[]>`** [VERIFIED: jira.ts:1084]

```ts
export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string;   // "YYYY-MM-DD" — absent when not set
  released: boolean;
  description?: string;
}
```

**`fetchReleaseIssues(baseUrl, token, projectKey, versionName): Promise<JiraIssue[]>`** [VERIFIED: jira.ts:1187]
- Returns only `fields.status` (minimal payload). Returns `[]` on any error (never throws). [VERIFIED: jira.ts:1210–1219]

**Cache keys (reuse verbatim):**
- Fix versions: `['jira-fix-versions', activeJiraProject]` [VERIFIED: DashboardReleaseCard.tsx:46]
- Release issues: `['jira-release-issues', activeJiraProject, version.name]` [VERIFIED: DashboardReleaseCard.tsx:63]

**Sorting for "next 3":** ascending by `releaseDate.localeCompare()`, NOT descending (ReleasesTab uses descending — dashboard needs ascending). [VERIFIED: DashboardReleaseCard.tsx:55–58]

**`getReleaseTimingLabel` — EXACT current implementation** [VERIFIED: DashboardReleaseCard.tsx:29–37]:
```ts
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

**"Tomorrow" case to ADD** per D-08 + UI-SPEC.md: `daysUntil === 1` → render "Tomorrow". The current implementation returns `{ daysUntil: 1 }` which is correctly handled by adding `if (timing.daysUntil === 1) return 'Tomorrow'` in the render. The function itself does NOT need modification — only the render layer in `UpcomingReleasesTimeline`. [VERIFIED: DashboardReleaseCard.tsx:110–112]

**`donePct` logic** [VERIFIED: DashboardReleaseCard.tsx:71–73]:
```ts
const doneCount = issueList.filter(i => i.fields.status.statusCategory?.key === 'done').length;
const donePct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
```

### `getTimeGreeting()` + first-name parser — `index.tsx`

**`getTimeGreeting()`** [VERIFIED: index.tsx:25–30]:
```ts
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}
```
- Returns trailing comma — hero renders `{timeGreeting} {firstName ?? 'there'}`.

**First-name parser** [VERIFIED: index.tsx:88–91]:
```ts
const tokens = (jiraUserDisplayName?.trim().split(/\s+/) ?? []).filter(
  (t) => !/^\[.*\]$/.test(t) && !/^\(.*\)$/.test(t),
);
const firstName = tokens.find((t) => t !== t.toUpperCase()) ?? tokens[0] ?? null;
```
- Strips `[X]` and `(X)` bracket tokens; prefers first mixed-case token; falls back to `tokens[0]`.
- Both functions MOVE to `index.tsx` (the new version) unchanged.

### `dashboardMetrics.ts` — survivor map

All 11 exports verified against every consumer: [VERIFIED: grep of all consumers above]

| Export | Current Consumers | Phase 86 Verdict |
|--------|------------------|-----------------|
| `filterNonSubtasks` | SprintHealthSection, computePersonalTileCounts, computeDonutData, computeSpDone, computeSpTotal | **KEEP** — needed by new MyIssuesCard derivation |
| `computePersonalTileCounts` | index.tsx | **DELETE** — old tile logic; MyIssuesCard derives inline or with new helper |
| `computeSpDone` | index.tsx, SprintHealthSection | **DELETE** — only used by deleted components |
| `computeSpTotal` | SprintHealthSection | **DELETE** — only used by deleted SprintHealthSection |
| `computeDonutData` | SprintHealthSection | **DELETE** — only used by deleted SprintHealthSection |
| `getDaysRemaining` | SprintHealthSection | **DELETE** — only used by deleted SprintHealthSection |
| `WeekBucket` (type) | WeeklyTrendChart | **DELETE** — component being deleted; new type defined in HoursCommitsChart |
| `DAILY_TARGET_HOURS` | WeeklyTrendChart | **DELETE** — 7-day chart does not use a fixed daily target |
| `buildWeekBuckets` | WeeklyTrendChart | **DELETE** — component being deleted; new `buildRolling7Buckets` replaces it |
| `ActivityEntry` (type) | ActivityStrip | **DELETE** — component being deleted |
| `mergeActivityEntries` | ActivityStrip | **DELETE** — component being deleted |
| `formatHoursMinutes` | WeeklyTrendChart, BurndownChart | **KEEP** — reused in HoursCommitsChart for hour labels |
| `VelocityPoint` (type) | VelocityChart | **DELETE** — component being deleted |
| `computePersonalVelocitySeries` | VelocityChart | **DELETE** — component being deleted |
| `BurndownPoint` (type) | BurndownChart | **DELETE** — component being deleted |
| `parseBurndownChanges` | BurndownChart | **DELETE** — component being deleted |
| `buildIdealGuideline` | BurndownChart | **DELETE** — component being deleted |

**Survivors in dashboardMetrics.ts:** `filterNonSubtasks` + `formatHoursMinutes`. Everything else is deleted from the file. The test file `dashboardMetrics.test.ts` must be pruned to only test survivors. [VERIFIED: consumer grep above]

---

## Removal Map

Complete enumeration with consumers. Every file tagged [DELETE] has been verified to have no consumers outside the dashboard widget cluster.

### Component files → DELETE

| File | Only Consumer | Disposition |
|------|--------------|-------------|
| `StatTile.tsx` | index.tsx (import line 17) | DELETE |
| `StatTile.test.tsx` | none | DELETE |
| `SprintHealthSection.tsx` | index.tsx (import line 20) | DELETE |
| `SprintHealthSection.test.tsx` | none | DELETE |
| `WeeklyTrendChart.tsx` | index.tsx (import line 22) | DELETE |
| `WeeklyTrendChart.test.tsx` | none | DELETE |
| `ActivityStrip.tsx` | index.tsx (import line 16) | DELETE |
| `DashboardReleaseCard.tsx` | index.tsx (import line 18) | DELETE |
| `DashboardReleaseCard.test.tsx` | none | DELETE |
| `VelocityChart.tsx` | index.tsx (import line 21) | DELETE |
| `BurndownChart.tsx` | index.tsx (import line 17) | DELETE |

Note: `ActivityStrip.tsx` has no dedicated test file.

### Service helpers → DELETE (confirmed no other consumer)

| Function | File | Other consumers? | Disposition |
|----------|------|-----------------|-------------|
| `fetchClosedSprints` | `services/jira.ts:2499` | VelocityChart.tsx only [VERIFIED] | DELETE from jira.ts |
| `fetchSprintIssuesBySprintId` | `services/jira.ts:2553` | VelocityChart.tsx only; `concurrency.ts:43` is a JSDoc comment only [VERIFIED] | DELETE from jira.ts |
| `fetchBurndown` | `services/jira/greenhopper/burndown.ts` (re-exported from jira.ts:2599) | BurndownChart.tsx only [VERIFIED] | DELETE from greenhopper + jira.ts re-export |
| `getVelocityLimit` | `lib/concurrency.ts:51` | VelocityChart.tsx only [VERIFIED] | DELETE from concurrency.ts |

### `dashboardMetrics.ts` — exports to DELETE from file

All non-survivor exports listed in the survivor map above: `computePersonalTileCounts`, `computeSpDone`, `computeSpTotal`, `computeDonutData`, `getDaysRemaining`, `WeekBucket`, `DAILY_TARGET_HOURS`, `buildWeekBuckets`, `ActivityEntry`, `mergeActivityEntries`, `VelocityPoint`, `computePersonalVelocitySeries`, `BurndownPoint`, `parseBurndownChanges`, `buildIdealGuideline`, and the internal `addDays` helper (used only by `buildWeekBuckets`).

The `dashboardMetrics.test.ts` file must keep only tests for `filterNonSubtasks` and `formatHoursMinutes`.

### Sidebar prefetch — DO NOT TOUCH

The Sidebar at `src/components/app/Sidebar.tsx:145–156` prefetches `['jira-active-sprint', ...]` with the comment "warm active-sprint for /dashboard so SprintHealthSection reads endDate". After Phase 86, `SprintHealthSection` is gone but the cache key is reused by `HoursCommitsChart` (needs `activeSprint` for sprint-day subline) and the hero subline. The prefetch benefits the new layout exactly as much as the old layout.

**Action for planner:** Keep Sidebar prefetch unchanged. Update the comment to remove the `SprintHealthSection` reference. [VERIFIED: Sidebar.tsx:145–156]

### `index.tsx` — imports to REMOVE (old), KEEP (new)

**Remove all imports of:** `StatTile`, `SprintHealthSection`, `WeeklyTrendChart`, `ActivityStrip`, `DashboardReleaseCard`, `VelocityChart`, `BurndownChart`, `computePersonalTileCounts`, `computeSpDone`, `Activity`, `CheckCircle2`, `Clock`, `Zap`.

**Keep:** `useQuery`, `useEffect`, `useState`, `useOutletContext`, `useBoardId`, `useDelayedLoading`, `fetchActiveSprint`, `fetchSprintIssues`, `readSecret`, `useAuthStore`, `useSettingsStore`, and the two local functions `getTimeGreeting()` + first-name parser.

**Add imports of:** `MyIssuesCard`, `UpcomingReleasesTimeline`, `HoursCommitsChart`, and any new token (e.g. `fetchFixVersions` for the releases timeline if the releases component is props-fed from index.tsx — or eliminate by making `UpcomingReleasesTimeline` self-contained like `DashboardReleaseCard`).

---

## `widget-removal.guard.test.ts` — Exact Assertion Pattern

[VERIFIED: widget-removal.guard.test.ts:1–72]

Pattern 1 — filesystem absence:
```ts
it('StatTile.tsx does not exist', () => {
  expect(fs.existsSync(path.join(DASHBOARD_DIR, 'StatTile.tsx'))).toBe(false);
});
```

Pattern 2 — source-string check (strips comment lines):
```ts
it('index.tsx does not import StatTile, SprintHealthSection, ...', () => {
  const indexSrc = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.tsx'), 'utf8');
  const nonCommentLines = indexSrc
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
    .join('\n');
  expect(nonCommentLines).not.toMatch(/StatTile/);
  expect(nonCommentLines).not.toMatch(/SprintHealthSection/);
  // ... etc
});
```

**Phase 86 additions needed:**

```ts
describe('dashboard subtree — Phase 86 widget removal guard', () => {
  // Filesystem absence (one assertion per deleted file):
  it('StatTile.tsx does not exist', ...);
  it('StatTile.test.tsx does not exist', ...);
  it('SprintHealthSection.tsx does not exist', ...);
  it('SprintHealthSection.test.tsx does not exist', ...);
  it('WeeklyTrendChart.tsx does not exist', ...);
  it('WeeklyTrendChart.test.tsx does not exist', ...);
  it('ActivityStrip.tsx does not exist', ...);
  it('DashboardReleaseCard.tsx does not exist', ...);
  it('DashboardReleaseCard.test.tsx does not exist', ...);
  it('VelocityChart.tsx does not exist', ...);
  it('BurndownChart.tsx does not exist', ...);

  // Source-string check (index.tsx imports none of the old components):
  it('index.tsx does not import old widgets', () => {
    // check for: StatTile, SprintHealthSection, WeeklyTrendChart, ActivityStrip,
    // DashboardReleaseCard, VelocityChart, BurndownChart
  });
});
```

---

## Recharts v3 Dual-Axis Grouped Bars (D-10)

All patterns verified against existing chart code in the repo (WeeklyTrendChart.tsx, BurndownChart.tsx). Web research not needed.

### ComposedChart structure for HoursCommitsChart

```tsx
'use no memo';
// ...
<div style={{ height: 280 }} className="w-full">
  <ChartContainer config={chartConfig} className="h-full w-full" aria-label="Hours and commits per day bar chart">
    <ComposedChart data={dayBuckets} responsive margin={{ top: 24, right: 40, left: 0, bottom: 0 }}>
      <XAxis dataKey="label" tick={<TodayAwareTick todayLabel={todayLabel} />} />
      <YAxis yAxisId="hours" orientation="left" tickFormatter={(v) => `${v}h`} />
      <YAxis yAxisId="commits" orientation="right" />
      <ReferenceLine
        yAxisId="hours"
        y={maxHours}
        strokeDasharray="4 4"
        stroke="var(--muted-foreground)"
      />
      <Bar yAxisId="hours" dataKey="hours" fill="var(--chart-1)" radius={[4,4,0,0]} isAnimationActive={false}>
        {dayBuckets.map((b) => (
          <Cell
            key={b.day}
            fill="var(--chart-1)"
            stroke={b.isToday ? 'var(--foreground)' : undefined}
            strokeWidth={b.isToday ? 2 : 0}
          />
        ))}
        <LabelList
          dataKey="hours"
          position="top"
          fontSize={12}
          fill="var(--muted-foreground)"
          formatter={(v: unknown) => {
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n) && n > 0 ? formatHoursMinutes(n) : '0h';
          }}
        />
      </Bar>
      <Bar yAxisId="commits" dataKey="commits" fill="var(--chart-2)" radius={[4,4,0,0]} isAnimationActive={false}>
        {dayBuckets.map((b) => (
          <Cell
            key={b.day}
            fill="var(--chart-2)"
            stroke={b.isToday ? 'var(--foreground)' : undefined}
            strokeWidth={b.isToday ? 2 : 0}
          />
        ))}
        <LabelList
          dataKey="commits"
          position="bottom"
          fontSize={12}
          fill="var(--muted-foreground)"
          formatter={(v: unknown) => String(Number.isFinite(Number(v)) ? Number(v) : 0)}
        />
      </Bar>
    </ComposedChart>
  </ChartContainer>
</div>
```

### Recharts v3 dual-axis pitfalls [ASSUMED — based on Recharts v3 behavior; verify from existing WeeklyTrendChart.tsx pattern which already navigates these]

| Pitfall | Symptom | Mitigation |
|---------|---------|-----------|
| Missing `yAxisId` on `<Bar>` when two `<YAxis>` exist | Bars disappear or all attach to left axis | Both `<Bar>` AND both `<YAxis>` must carry matching `yAxisId` string |
| `<LabelList position="bottom">` on commits bars clipping | Labels hidden behind X-axis | Increase `margin.bottom` or use `position="insideBottom"` as fallback |
| `<ReferenceLine>` without matching `yAxisId` | Line plots against wrong scale | `yAxisId="hours"` required on `<ReferenceLine>` |
| `responsive` prop on `<ComposedChart>` (not `<BarChart>`) | Check Recharts v3 docs — `responsive` may need to be at chart level | Existing WeeklyTrendChart.tsx uses `<BarChart data={...} responsive ...>` [VERIFIED: WeeklyTrendChart.tsx:147]; same prop on `<ComposedChart>` should work — verify in implementation |
| 0-value commits bars invisible | Height collapses to 0, label may not render | Recharts does not render a bar at value=0; test that "0" label still renders (may need `minPointSize={1}` on the commits Bar) |

### Today pill on X-axis

The UI-SPEC requires a custom `tick` renderer. Pattern from `WeeklyTrendChart.tsx` uses per-`<Cell>` stroke for today, but the pill is on the X-axis tick. Implement via a custom tick component:

```tsx
function TodayAwareTick({ x, y, payload, todayLabel }: CustomTickProps) {
  if (payload.value === todayLabel) {
    return (
      <foreignObject x={x - 16} y={y} width={32} height={20}>
        <div className="flex justify-center">
          <span className="text-xs font-normal bg-foreground text-background rounded-full px-2 py-0.5">
            {payload.value}
          </span>
        </div>
      </foreignObject>
    );
  }
  return <text x={x} y={y + 10} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">{payload.value}</text>;
}
```

[ASSUMED — no existing custom X-axis tick in the repo to verify against; the foreignObject pattern is a known Recharts approach for HTML-in-SVG tick rendering]

---

## Rolling-7 Bucket Logic

**New helper to write** (adapts `buildWeekBuckets` pattern from `dashboardMetrics.ts:180`):

```ts
interface DayBucket {
  day: string;      // YYYY-MM-DD local calendar
  label: string;    // short weekday "Mon", "Tue", ...
  isToday: boolean;
  hours: number;
  commits: number;
}

function buildRolling7Buckets(
  worklogs: TempoWorklog[],
  commits: Map<string, number>,  // day → commit count
  todayDate: string,             // YYYY-MM-DD local calendar
): DayBucket[] {
  // Build 7 buckets: 6 days ago → today
  const buckets: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(todayDate, i - 6);  // addDays from dashboardMetrics
    const d = new Date(`${day}T12:00:00`);  // noon to avoid DST edge
    return {
      day,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: day === todayDate,
      hours: 0,
      commits: commits.get(day) ?? 0,
    };
  });
  for (const wl of worklogs) {
    const b = buckets.find(b => b.day === wl.dateStarted);
    if (b) b.hours += wl.timeSpentSeconds / 3600;
  }
  return buckets;
}
```

**Date bucketing for commits:** `fetchUserCommits` takes a single date and returns commits for that day. Call it 7 times (once per day) and bucket by the `date` param (not by `authored_date` to avoid UTC offset issues). Build the commits map before calling `buildRolling7Buckets`. [VERIFIED: pattern established in ActivityStrip.tsx:157–189]

---

## Edge Cases and Landmines

### My Issues

| Case | Behavior | Implementation note |
|------|---------|-------------------|
| No active sprint | `fetchSprintIssues` returns `[]` (JQL `sprint in openSprints()` returns empty) → empty state "No issues assigned" | Handled by `myNonSubtasks.length === 0` check |
| 0 issues assigned to me | Empty state, NOT error | `myNonSubtasks.length === 0` → render empty state |
| 1 bucket has 0 count | Segment collapses to 0 width; legend shows "To Do 0" (honest zero) | No conditional hiding of segments |
| `toDo + inProgress + done !== total` | Should never happen but assert in test | Test with various mixed fixtures |
| `statusCategory` key undefined | Count falls through; guard with `?.key` | `i.fields.status.statusCategory?.key === 'new'` already optional-chains |

### Upcoming Releases

| Case | Behavior | Implementation note |
|------|---------|-------------------|
| 0 upcoming with due dates | Empty state "No upcoming releases" | `upcomingVersions.length === 0` |
| 1 or 2 releases | Render only existing dots; no placeholder | `slice(0, 3)` returns 1–2, timeline adjusts |
| `releaseDate` absent on a version | Excluded from `upcoming` list | `.filter(v => !v.released && !!v.releaseDate)` |
| 0% ready (no done issues) | Readiness bar at 0 width — honest | `donePct = 0` renders valid |
| `fetchReleaseIssues` fails | Returns `[]` silently (never throws) → `donePct = 0` | Function swallows errors [VERIFIED: jira.ts:1210] |
| `daysUntil === 1` | "Tomorrow" label | New render case; `getReleaseTimingLabel` returns `{ daysUntil: 1 }` — render layer handles it |

### 7-Day Hours & Commits Chart

| Case | Behavior | Implementation note |
|------|---------|-------------------|
| All-zero week | 7 flat bars with "0h" / "0" labels | `isEmpty={false}` always when tempoEnabled; `minPointSize={1}` on commits bar if 0-height is invisible |
| Today partial | Bars render what's recorded through "now" | Normal case — no special handling |
| Weekend with 0 activity | Flat bars at 0 (included, not omitted) | Rolling-7 always includes all 7 days |
| `tempoEnabled = false` | `isEmpty={!tempoEnabled}` → EmptyState "Tempo not connected" | Lifted from WeeklyTrendChart.tsx:108–123 [VERIFIED] |
| GitLab not configured | Commits series all-zero; no error shown for commits | `enabled: !!gitlabBaseUrl && ...` — each day's query fires if configured |
| UTC date shift in `fetchUserCommits` | Already handled: function converts local `date` to UTC boundaries internally [VERIFIED: gitlab.ts:1324] | Pass `toLocaleDateString('en-CA')` dates as the `date` param |
| `authored_date` vs bucket date | Do NOT bucket by `authored_date` — bucket by the `date` param passed to `fetchUserCommits` | Avoids UTC-shift on authored_date |

### Sprint-Day Subline

| Case | Behavior |
|------|---------|
| `activeSprint === null` | Subline shows date only, no sprint clause (never "Sprint day N of M") |
| `startDate` or `endDate` undefined | Hide sprint clause |
| Sprint start = today | "Sprint day 1 of N" |
| `elapsed > total` (overrun sprint not closed) | Render honestly — "Sprint day 12 of 10" is correct data |

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/routes/dashboard/
├── index.tsx                          # REWRITTEN — composes 3 new components only
├── MyIssuesCard.tsx                   # NEW — my sprint issues segmented bar
├── UpcomingReleasesTimeline.tsx       # NEW — 3-dot timeline
├── HoursCommitsChart.tsx              # NEW — dual-axis ComposedChart
├── dashboardMetrics.ts                # TRIMMED — keep only filterNonSubtasks + formatHoursMinutes
├── dashboardMetrics.test.ts           # TRIMMED — keep only tests for the 2 survivors
├── widget-removal.guard.test.ts       # EXTENDED — add Phase 86 absence assertions
└── index.test.tsx                     # REWRITTEN — test new 3-region layout
```

### Self-Contained vs Props-Fed Cards

**Recommendation:** Make all 3 new card components self-contained (own `useQuery` calls, own auth from `useAuthStore`), following the newer Phase 85 props-only pattern from `VelocityChart`/`BurndownChart` — **BUT** for the sprint-board issues query, pass `jiraToken` as a prop from index.tsx so the token is loaded once. The pattern is already established in `index.tsx`:

```tsx
// index.tsx loads tokens once, passes to cards as props
// Cards own their useQuery (cache-deduped via shared queryKey)
```

This keeps the D-16 pattern (single point of PAT load) intact.

### Independent Degradation Pattern (DASH-07)

Each of the 3 new components must own its own `isLoading`/`error`/`isEmpty` state. Pattern from SprintHealthSection:
- Loading: `useDelayedLoading` (200ms gate) → `<Skeleton>`
- Error: `<ErrorState error={e} onRetry={refetch} viewName="...">` 
- Empty: `<EmptyState icon={...} title="..." subtitle="...">`
- Data: render

`HoursCommitsChart` has two data sources (Tempo + GitLab). Follow ActivityStrip's independent-degradation for the two series — but per D-12, the chart never shows empty state for an all-zero week. `isEmpty={!tempoEnabled}` only; never `isEmpty={worklogs.length === 0}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Hours formatting | `toFixed(1) + 'h'` | `formatHoursMinutes` from `dashboardMetrics.ts` (survives) |
| Date arithmetic (addDays) | manual date math | `addDays` from `dashboardMetrics.ts` — copy inline if the rest of the file is deleted |
| Release timing label | custom string logic | `getReleaseTimingLabel` from `DashboardReleaseCard.tsx` — LIFT verbatim into `UpcomingReleasesTimeline.tsx` |
| Segmented progress bar | CSS width math inline | Standard flex layout with `width: ${pct}%` on each segment div |
| Chart loading/error/empty shell | per-chart if/else tree | `ChartWrapper` (bare + height props) |
| Local-calendar date | `new Date().toISOString().slice(0,10)` | `new Date().toLocaleDateString('en-CA')` |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vite.config.ts` (vitest config embedded) |
| Quick run command | `npm run test -- --reporter=verbose src/routes/dashboard/` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Command | File |
|-----|----------|-----------|---------|------|
| D-03 | `toDo + inProgress + done === total` | unit | `npm run test -- dashboardMetrics` | `dashboardMetrics.test.ts` (add) |
| D-05 | 0 issues → empty state in MyIssuesCard | unit/render | `npm run test -- MyIssuesCard` | `MyIssuesCard.test.tsx` (new) |
| D-06/D-08 | <3 releases renders only existing dots | unit/render | `npm run test -- UpcomingReleasesTimeline` | `UpcomingReleasesTimeline.test.tsx` (new) |
| D-12 | All-zero week renders flat bars not empty state | unit | `npm run test -- HoursCommitsChart` | `HoursCommitsChart.test.tsx` (new) |
| D-13 | No active sprint → no sprint clause in subline | render | `npm run test -- index` | `index.test.tsx` (rewrite) |
| REMOVE | Deleted files do not exist on disk | fs | `npm run test -- widget-removal.guard` | `widget-removal.guard.test.ts` (extend) |

### Wave 0 Gaps

- [ ] `src/routes/dashboard/MyIssuesCard.test.tsx` — covers D-02/D-03/D-04/D-05
- [ ] `src/routes/dashboard/UpcomingReleasesTimeline.test.tsx` — covers D-06/D-07/D-08
- [ ] `src/routes/dashboard/HoursCommitsChart.test.tsx` — covers D-09/D-10/D-11/D-12
- [ ] Extend `widget-removal.guard.test.ts` — 11 file-absence + 1 import-absence assertion

---

## Security Domain

`security_enforcement` not set to false in config — enabled by default.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no new auth surface | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes — `statusCategory.key` from API, `donePct` calculation | `?.key` optional chaining; `Math.round` with division-by-zero guard (`totalCount > 0 ? ... : 0`) |
| V6 Cryptography | No — PAT already in Stronghold; no new secrets | — |

| Threat Pattern | STRIDE | Mitigation |
|---------------|--------|-----------|
| `statusCategory.key` unknown value | Tampering | Default to 'new' (toDo) bucket via fallback; counts still sum to total |
| `donePct > 100` from bad API data | Tampering | `Math.min(100, Math.round(...))` clamp on render |
| Negative `daysUntil` from past releaseDate | Tampering | `getReleaseTimingLabel` already returns 'overdue' for `releaseDate < today` |

---

## Open Questions (RESOLVED — monitored at Plan 04 UAT)

1. **`fetchUserCommits` per-day call count:** For the 7-day chart, one call per day × 7 = 7 GitLab API calls. All 7 are parallel via `useQueries`. Is this acceptable for the GitLab instance? The standup page already makes this call daily; 7 in parallel is new but bounded. If this causes rate-limit issues, the mitigation is to add a single-range `since`/`until` spanning 7 days to the `fetchUserCommits` signature (but that would require a new function signature → check with user before implementing).
   - What we know: `fetchUserCommits` paginates internally per-day
   - What's unclear: GitLab rate limit tolerance for 7 parallel paginated requests
   - Recommendation: implement with `useQueries` × 7; monitor UAT for rate-limit errors; add range-call as fallback if needed

2. **`LabelList position="bottom"` on commits bar:** The UI-SPEC positions commits labels below the bar. At 0 value the bar is flat; the label may overlap the X-axis. May need `offset={-5}` or `position="insideBottom"`. Verify visually in implementation.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tooling (Recharts, shadcn, Vitest, TanStack Query) already installed and in use.

---

## Package Legitimacy Audit

Step: SKIPPED — Phase 86 installs zero new packages. All dependencies are existing project dependencies.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `responsive` prop works on `<ComposedChart>` same as `<BarChart>` in Recharts v3 | Recharts pitfalls | If not, use `<BarChart>` instead (can't combine dual-axis without ComposedChart — may need wrapper approach) |
| A2 | `foreignObject` in SVG tick renderer works in Tauri's WebKit | Today pill on X-axis | If WebKit rejects foreignObject, fall back to SVG `<text>` with `fill="var(--foreground)"` and `<rect>` background behind it |
| A3 | 7 parallel `fetchUserCommits` calls don't trigger GitLab rate limiting | Rolling-7 commits | If triggered, requires range-query approach or serial fetching |
| A4 | `LabelList position="bottom"` on flat 0-height bar still renders "0" label above the X-axis ticks | 0-value days | May require `minPointSize` or `offset` adjustment |

---

## Sources

### Primary (HIGH confidence — verified against actual source files)
- `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` — fetchWorklogs usage, cache key, buildWeekBuckets pattern, LabelList/Cell/today-highlight pattern
- `taskflow/src/routes/dashboard/ActivityStrip.tsx` — fetchUserCommits usage, cache key, per-day query pattern
- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` — fetchFixVersions/fetchReleaseIssues, getReleaseTimingLabel exact implementation, donePct logic
- `taskflow/src/routes/dashboard/index.tsx` — getTimeGreeting, first-name parser, cache key reuse, token load pattern
- `taskflow/src/routes/dashboard/dashboardMetrics.ts` — all exported function signatures and consumers
- `taskflow/src/routes/dashboard/SprintHealthSection.tsx` — computeDonutData/computeSpDone/computeSpTotal/getDaysRemaining consumers
- `taskflow/src/routes/dashboard/VelocityChart.tsx` — fetchClosedSprints/fetchSprintIssuesBySprintId consumers
- `taskflow/src/routes/dashboard/BurndownChart.tsx` — fetchBurndown consumer, parseBurndownChanges/buildIdealGuideline/formatHoursMinutes consumers
- `taskflow/src/routes/dashboard/widget-removal.guard.test.ts` — exact assertion pattern
- `taskflow/src/services/tempo/worklogs.ts` — fetchWorklogs signature, return type
- `taskflow/src/services/tempo/types.ts` — TempoWorklog type
- `taskflow/src/services/gitlab.ts:1265–1420` — GitLabCommit type, fetchUserCommits signature
- `taskflow/src/services/jira.ts:392–470, 1084–1220, 1315–1382, 2499–2574` — all reused/deleted service functions
- `taskflow/src/components/app/Sidebar.tsx:140–156` — active-sprint prefetch
- `taskflow/src/components/chart-wrapper.tsx` — ChartWrapper API (bare, height, isLoading, isEmpty, error)
- `taskflow/src/lib/concurrency.ts` — getVelocityLimit sole consumer verified
- `.planning/phases/86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w/86-UI-SPEC.md` — approved visual contract

### Secondary (MEDIUM confidence)
- `.planning/phases/86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w/86-CONTEXT.md` — locked decisions
- `.planning/phases/86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w/86-DESIGN-INTENT.md` — hard constraints

---

## Metadata

**Confidence breakdown:**
- Reuse map (signatures/cache keys): HIGH — all verified against source
- Removal map (delete vs retain): HIGH — consumer grep confirmed for every item
- Recharts dual-axis pattern: MEDIUM — `responsive` on `ComposedChart` and `foreignObject` tick tagged [ASSUMED]
- Edge cases: HIGH — lifted from verified source implementations

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable stack — no fast-moving dependencies)
