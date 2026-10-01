---
phase: quick-261001-ilq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/statusStyles.ts
  - taskflow/src/lib/statusStyles.test.ts
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/services/jira-changelog.ts
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/components/ui/tooltip-body.test.tsx
  - taskflow/src/components/ui/tooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx
  - taskflow/src/routes/dashboard/EpicProgressCells.tsx
  - taskflow/src/routes/dashboard/EpicProgressCells.test.tsx
  - taskflow/src/routes/dashboard/EpicsPage.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  - taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx
autonomous: true
requirements: [QUICK-261001-ilq]

must_haves:
  truths:
    - "In Count/SP mode the main chart is a cumulative flow diagram. Done, In progress and To do are stacked areas (bottom to top) in the status-category colours. The data comes from Jira status history, and an approximate current-state fallback is drawn while history loads or when it fails, with a note saying so"
    - "The CFD x-axis starts at the epic created date. Stories created earlier enter on that date"
    - "Both charts show a Remaining line. When the forecast state is ok, both also show a dashed forecast line from today's remaining to 0 at the likely date, with an optimistic–pessimistic range band extending into the future"
    - "The forecast adapts to epic age: a working-day EWMA window of clamp(age, 3, 30) working days, net of scope growth, with an analytic 80% range and a confidence label. Its states are done / too-early / stalled / not-converging / ok. A 3-day-old epic with high velocity forecasts ok, and a 1-week-old epic forecasts about 25 working days, not about 20 weeks"
    - "Time mode forecasts from the daily logged-time rate against the remaining time (estimate minus logged)"
    - "The top of the section is a hero (big %, segmented status bar, 'X of Y done · N in progress') followed by a 3-cell stat strip: Finish (likely date + range or state text), Remaining (active metric plus the other metrics), and Risks (chips, or None)"
    - "Assignee rows show a 20px CachedAvatar and the name, like the rest of the app. Unassigned shows the dashed placeholder. The trailing value is fixed-width, status-coloured, numbers-only count chips (done / in progress / to do, or logged / estimate in Time mode). Zero chips are dimmed"
    - "Every tooltip in the feature (tiles, hero, status bar, assignee bar, quick-peek bar, story mini bar, both charts) uses one surface (TOOLTIP_SURFACE) and one row layout (TooltipRow: swatch · label · value)"
    - "Status-category colours come from one source (STATUS_CATEGORY_COLOR / statusCategoryDotClass) everywhere in the feature. No ad-hoc gray/green chart colours remain"
    - "Status history and worklogs load lazily under their own react-query keys, which include the story-set signature. Status history is enabled only in Count/SP mode. Worklogs are enabled only in Time mode"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "Working-day helpers, adaptive forecast core + count/SP/time builders, summary, status-category lookup, CFD derivation, projection + chart-data merge"
      exports: ["forecastFromThroughput", "deriveAdaptiveForecast", "deriveTimeForecast", "deriveSummary", "deriveCfd", "deriveProjection", "withProjection", "buildStatusCategoryLookup", "addWorkingDays", "workingDaysBetween", "CAT_LABEL"]
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchEpicStatusHistory (chunked expand=changelog search + truncated-history top-up)"
      exports: ["fetchEpicStatusHistory", "StatusTransition", "EpicStatusHistory"]
    - path: "taskflow/src/lib/statusStyles.ts"
      provides: "CSS-colour map shared by charts and swatches"
      exports: ["STATUS_CATEGORY_COLOR", "statusCategoryColor"]
    - path: "taskflow/src/components/ui/tooltip-body.tsx"
      provides: "Shared tooltip surface + body + row"
      exports: ["TOOLTIP_SURFACE", "TooltipBody", "TooltipRow"]
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      provides: "Hero + stat strip"
      contains: "epic-hero"
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx"
      provides: "Stacked CFD + remaining + forecast/band on numeric time axis"
      contains: "stackId"
    - path: "taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts"
      provides: "Lazy worklog, status-history and status-list queries"
      contains: "jira-epic-status-history"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "deriveCfd"
      via: "status-history query data (or null fallback)"
      pattern: "deriveCfd\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts"
      to: "fetchEpicStatusHistory"
      via: "useQuery queryFn"
      pattern: "fetchEpicStatusHistory\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      to: "deriveAdaptiveForecast / deriveTimeForecast"
      via: "Finish cell"
      pattern: "Forecast\\("
    - from: "taskflow/src/components/ui/tooltip.tsx"
      to: "TOOLTIP_SURFACE"
      via: "TooltipContent className"
      pattern: "TOOLTIP_SURFACE"
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx"
      to: "STATUS_CATEGORY_COLOR"
      via: "Area fill/stroke"
      pattern: "STATUS_CATEGORY_COLOR"
---

<objective>
This is the fourth iteration of the epic detail progress section, responding to the UAT feedback on 261001-hsz. It covers seven items:
1. A cumulative flow diagram built from real status history, with Remaining and a forecast projection with a range band.
2. An adaptive forecast with explicit states.
3. A hero and stat strip at the top of the section.
4. Users displayed the way Jira shows them.
5. Status-coloured count chips on assignee rows.
6. One tooltip style.
7. Consistent status colours across the feature.

Purpose: the user found the old 4-week flat forecast wrong for young or fast epics. They want to see in-progress and remaining work in the chart, and they want one coherent visual language.

Output:
- Pure lib maths with case-table tests.
- A status-history fetcher.
- A shared tooltip body.
- The hero/strip and assignee redesign.
- The CFD and time charts with projection.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/261001-ilq-CONTEXT.md (locked user decisions)
@.planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/261001-ilq-RESEARCH.md (authoritative for the algorithm, constants, case table, Recharts recipe and pitfalls)
@taskflow/src/lib/epic-progress.ts
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx

Orchestrator resolution (locked): the Count/SP chart axis starts at the epic created date. Stories created earlier are clamped to it.

<interfaces>
Verified by the planner on main at 29decb5f.

epic-progress.ts:
- Exports:
  - `Metric`, `Cat`, `BurnupPoint`, `TimeBurnupPoint {date,label,estimate,logged}`, `StatusBucket`, `AssigneeBucket {id,name,done,inProgress,todo,remaining,logged,estimate}` (no avatar field yet), `TimeTotals`.
  - The old `Forecast {pctDone, finishDate, reason:'done'|'insufficient'|'ok', unestimated, unassignedOpen, total, doneTotal}`.
  - `formatDateKey`, `catOf`, `ESTIMATE_FORMULA_NOTE`, `estimateOf`, `loggedOf`, `weightOf`, `doneDateKey(s,today)`.
  - `deriveBurnup(stories,metric,spKey,epicCreated,today)`, `deriveStatusBuckets`, `deriveAssigneeBuckets`.
  - The old `deriveForecast(stories,metric,spKey,today)`.
  - `deriveTimeTotals`, `deriveTimeBurnup(stories,logs,epicCreated,today)`, `formatMetric`.
- Private: `toMs`, `addDays`, `diffDays`, `validKey`, `labelOf`, `spOf`, `secOf`, `buildAxis` (daily ≤31 days, else weekly + today), `CAT_ORDER`, `DAY_MS`.
- The test file uses `TODAY = '2026-10-01'` (a Thursday). New forecast tests must use their own Wednesday constant `WED = '2026-09-30'`.

statusStyles.ts:
- Private `DOT_STYLES {new:'bg-gray-400', indeterminate:'bg-blue-500', done:'bg-green-500'}` and `BADGE_STYLES`.
- Exports `statusCategoryBadgeClass`, `statusCategoryDotClass`, `CHIP_TONE_CLASS`, `tonePillClass(tone)` (it has an 'amber' tone).
- There is no statusStyles.test.ts yet.

jira.ts:
- `SUBTASK_CHUNK_SIZE = 50` (291), `PAGE_CONCURRENCY = 6` (294).
- Module-private `fetchAllSearchPagesConcurrent(baseSearchUrl, headers)` (374) appends `&maxResults&startAt`.
- `fetchEpicWorklogs` (2745) is the template: key regex `/^[A-Z][A-Z0-9_]*-\d+$/`, chunk loop, worker pool over a `topUps` queue.
- `fetchAllJiraStatuses` is re-exported from '@/services/jira' (line 2859). It returns `JiraStatus {id,name,statusCategory:{id,key,name}}[]`. greenhopper/transitions.ts caches it under `['jira-statuses']` with staleTime/gcTime Infinity.
- JiraIssue.fields.assignee has the shape `{displayName,name?,avatarUrls:{'48x48'}} | null`.

jira-changelog.ts:
- `ChangelogHistory {id, created, author, items: {field, fieldtype?, fromString, toString}[]}`. It lacks `from`/`to`.

tooltip.tsx:
- TooltipContent Popup className is `max-w-xs rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-foreground/10 outline-none` plus the transition classes.

cached-avatar.tsx:
- `CachedAvatar({url,name,size})`, sizes 16|18|20|24|32|40.
- It renders initials as text, or a dashed `User` icon when url is falsy and name is 'Unassigned'.
- The fallback div has role="img" and aria-label={name}.

EpicProgressSection.tsx:
- Currently renders 4 `Tile`s (button TooltipTrigger, testid epic-stat-tile, spans only), the burnup (testid epic-burnup, caption 'Scope by story creation date'), the status bar (testid epic-status-bar, segments epic-status-segment), the status legend `${name} · ${count} · ${sp}`, and assignee rows (testid epic-assignee-row, bar epic-assignee-bar, trailing text).
- Time mode mounts `EpicTimeBurnup`, which owns `useQuery(['jira-epic-worklogs', epicKey, jiraBaseUrl, storyKeys.join(',')])` and has the testids epic-time-burnup / -loading / -error.

EpicProgressCells.tsx:104-111:
- The quick-peek TooltipContent has the lines `${done} Done`, `${inProgress} In Progress`, `${todo} To Do`, and `${donePoints} of ${points} SP done`.

IssueDetailContent.tsx:359-400:
- The story mini bar (testid story-time-bar) TooltipContent has the lines `Estimate X`, `Logged X`, `Remaining X` (or `No estimate`), plus ESTIMATE_FORMULA_NOTE.

Test harness facts:
- EpicProgressSection.test.tsx first describe uses bare `render(...)` with no QueryClientProvider. The later describe has `renderIt`/`renderTimed` helpers with a QueryClientProvider.
- It already partially mocks '@/services/jira' (fetchEpicWorklogs), '@/services/stronghold' and '@/stores/auth.store' (jiraConnected true).
- IssueDetailContent.test.tsx and IssueDetailPage.progressive.test.tsx mock '@/services/jira' with FULL factories.
- EpicDetailSheet.test.tsx does not mock '@/services/jira'. It has a QueryClientProvider wrapper and jiraConnected true.
</interfaces>

<new_contracts>
These are defined in Task 1 and consumed by Tasks 2-3. The shapes are binding; the exact field names may only be extended.
- `export type ForecastState = 'done' | 'too-early' | 'stalled' | 'not-converging' | 'ok'`
- `export type Confidence = 'low' | 'medium' | 'high'`
- `export interface EpicForecast`:
  - `state: ForecastState`
  - `likely: string | null`, `optimistic: string | null`, `pessimistic: string | null` (YYYY-MM-DD)
  - `nLikely: number | null`, `nOpt: number | null`, `nPess: number | null` (working days)
  - `remaining: number` (active unit)
  - `ratePerWeek: number`, `scopeRatePerWeek: number`
  - `windowDays: number`
  - `completions: number`
  - `confidence: Confidence | null`
  - `explanation: string` (plain-words method text)
- `export interface ThroughputInput`:
  - `completions: { day: string; w: number }[]`
  - `scopeAdds: { day: string; w: number }[]`
  - `remaining: number`
  - `allDone: boolean`
  - `firstActivity: string | null`
  - `eventCount: number`
  - `unit: Metric`
- `forecastFromThroughput(input: ThroughputInput, today: string): EpicForecast`. This is the pure core.
- `deriveAdaptiveForecast(stories, metric: 'count'|'sp', spKey, epicCreated, today): EpicForecast`
- `deriveTimeForecast(stories, logs: Map<string, EpicWorklogDay[]>, today): EpicForecast`
- `export interface EpicSummary`:
  - `count`, `doneCount`, `inProgressCount`, `todoCount`
  - Per active metric: `total`, `doneTotal`, `inProgressTotal`, `todoTotal`
  - `pctDone`
  - `remainingCount`, `remainingSp`, `remainingSeconds` (deriveTimeTotals().remaining)
  - `unestimatedSp` (stories with null SP, same rule as the old deriveForecast)
  - `unestimatedTime` (open stories with estimateOf === 0)
  - `unassignedOpen`
- `deriveSummary(stories, metric, spKey): EpicSummary`
- `export const CAT_LABEL: Record<Cat, string> = { done: 'Done', indeterminate: 'In progress', new: 'To do' }`
- `addWorkingDays(key, n)`, `workingDaysBetween(a, b)`. The latter counts Mon–Fri days d with a < d ≤ b.
- `buildStatusCategoryLookup(statusList: JiraStatus[] | undefined, stories): (id: string | null, name: string | null) => Cat`
- `export interface CfdPoint`:
  - `date`, `t` (UTC ms), `label`
  - `done: number | null`, `inProgress: number | null`, `todo: number | null`, `remaining: number | null`
  - `forecast?: number | null`, `band?: [number, number] | null`
- `deriveCfd({ stories, history: Map<string, EpicStatusHistory> | null, lookup, metric, spKey, epicCreated, today }): { points: CfdPoint[]; approximate: boolean }`
- `deriveProjection(forecast: EpicForecast, today, historyStart: string | null): { points: { date; t; forecast: number; band: [number, number] }[]; clippedAfter: string | null }`
- `withProjection<T extends { date: string; t: number }>(points: T[], projection): (T & { forecast: number | null; band: [number, number] | null })[]`. On the today point it sets forecast = remaining and band = [remaining, remaining]. It appends the future projection points, with every other series field null.
- jira.ts:
  - `export interface StatusTransition { at: string; fromId: string | null; fromName: string | null; toId: string | null; toName: string | null }`
  - `export interface EpicStatusHistory { transitions: StatusTransition[]; joinedAt: string | null }`
  - `fetchEpicStatusHistory(baseUrl, token, storyKeys, epicKey): Promise<Map<string, EpicStatusHistory>>`
- statusStyles.ts:
  - `export const STATUS_CATEGORY_COLOR = { new: 'var(--color-gray-400)', indeterminate: 'var(--color-blue-500)', done: 'var(--color-green-500)' } as const`
  - `statusCategoryColor(cat?: string): string`
- tooltip-body.tsx:
  - `TOOLTIP_SURFACE` (the exact surface string from today's TooltipContent minus max-w/outline/transition)
  - `TooltipBody({ title?, children, note? })`
  - `TooltipRow({ color?, label, value, sub?, dashed? })`. Its root is `<div data-slot="tooltip-row">`, with swatch, label, value and sub as DIRECT children.
</new_contracts>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lib + services — status colour map, adaptive forecast, summary, CFD derivation, projection, fetchEpicStatusHistory</name>
  <files>taskflow/src/lib/statusStyles.ts, taskflow/src/lib/statusStyles.test.ts, taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts, taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts, taskflow/src/services/jira-changelog.ts</files>
  <behavior>
    - statusStyles.test.ts (new):
      - For each of new/indeterminate/done, `statusCategoryDotClass(k) === 'bg-' + <name parsed from STATUS_CATEGORY_COLOR[k]>`.
      - `statusCategoryColor(undefined)` and `statusCategoryColor('bogus')` return the `new` colour.
    - Working days:
      - `addWorkingDays('2026-09-30', 3) === '2026-10-05'` (it skips the weekend).
      - `addWorkingDays(x, 0) === x`.
      - `workingDaysBetween('2026-09-25', '2026-09-30') === 3`, i.e. Mon, Tue, Wed. The Fri-to-Wed span excludes the start day.
      - `workingDaysBetween(a, a) === 0`.
    - Forecast case table: tests run through deriveAdaptiveForecast on fixtures, with WED = '2026-09-30' and count mode.
      - (1) 1-week-old. The fixture is pinned exactly; do not tune thresholds to make it pass.
        - All stories are created 2026-09-20, before firstActivity, so there is no scope-after growth.
        - firstActivity is 2026-09-24 (Thu, working-day offset 4), set by one open indeterminate story with statuscategorychangedate 2026-09-24. Inclusive age = 5.
        - 2 done: one resolved 2026-09-29 (offset 1), one resolved 2026-09-25 (offset 3). 10 open in total, the indeterminate story included.
        - Expected maths: W=5, h=2, μ ≈ 1.0607/2.8107 ≈ 0.377/wd, n ≈ 26.5, so nLikely = 27.
        - Assert: windowDays 5, state ok, confidence low, nLikely between 15 and 40, nLikely < 50 (NOT ~20 weeks).
      - (2) 3-day high velocity. Pinned fixture: 2 done on each of working-day offsets 0, 1 and 2 (2026-09-30, 09-29, 09-28). firstActivity = 2026-09-28, age 3. 6 open, all created on or before 2026-09-28. Expected: windowDays 3, μ = 2/wd, nLikely = 3, state ok (NOT too-early), confidence low.
      - (3) Steady long-running. 1 done every working day for 60 working days, 20 open. Expected: windowDays 30, nLikely 20, confidence high, and (nPess − nOpt)/nLikely ≤ 0.5.
      - (4) Stalled. The last done was 15 working days ago and age is 40. Expected: state stalled, likely/optimistic/pessimistic null.
      - (5) Scope growth. 1 done per working day, plus 1.5 stories created per working day after firstActivity, age 20. Expected: state not-converging, and the explanation mentions both rates.
      - (6) Too early. 1 working day old, 1 done, others open. Expected: too-early.
      - (7) Done. All done. Expected: done.
      - (8) Time mode, through deriveTimeForecast. 2h logged per working day over 10+ working days, and deriveTimeTotals remaining = 20h. Expected: nLikely ≈ 10, state ok.
      - Every ok case satisfies optimistic ≤ likely ≤ pessimistic.
      - A weekend completion counts toward the following Monday.
      - A 0-completion epic whose in-progress activity (statuscategorychangedate) is ≥ 10 working days old is stalled, not too-early.
      - SP mode with remaining 0 and an unestimated open story gives state ok with likely = today and an explanation mentioning unestimated work.
    - deriveSummary:
      - Port the old "counts unestimated and unassigned open; SP mode counts unestimated as 0" fixture. In count mode: unestimatedSp 2, unassignedOpen 1, pctDone 50. In SP mode: pctDone 75, total 4, doneTotal 3.
      - Also check: in-progress/to-do totals per metric, remainingCount/Sp/Seconds, and unestimatedTime counts only open stories with estimateOf 0.
    - deriveAssigneeBuckets: each bucket has `avatarUrl` = assignee.avatarUrls['48x48'] when it is a non-empty string, else null. Unassigned → null.
    - buildStatusCategoryLookup resolves in this order: id via the status list, then name via the status list, then name via the current stories' fields.status.statusCategory, then 'new'.
    - deriveCfd:
      - (a) Real history. A story created Sep 1 moves To Do→In Progress on Sep 10, then →Done on Sep 15. It counts todo from Sep 1, inProgress from Sep 10 and done from Sep 15. approximate is false.
      - (b) A story created before epicCreated enters on epicCreated, in the category its history gives for that day. The axis starts at epicCreated.
      - (c) Truncated changelog. The first transition's fromId sets the initial category; e.g. the first item is In Progress→Done, so the story is inProgress before that.
      - (d) An unmapped status id with a known name maps via the name. A fully unknown status maps to 'new'.
      - (e) history null gives the fallback: created→todo, indeterminate→inProgress from statuscategorychangedate, done→done from doneDateKey. approximate is true.
      - (f) A history map missing one story uses the fallback for that story only, and approximate is true.
      - (g) Each point has remaining === inProgress + todo, and on every point done + inProgress + todo equals the sum of weights of the stories entered by that date. SP mode uses current SP weights.
      - (h) A done date later than local today clamps to today. Port the old deriveBurnup "clamps a done date past local today" intent.
      - (i) The axis is daily up to 120 days. A 400-day span yields ≤ 150 points, and its last point is today.
      - (j) No created dates and no epicCreated gives points [].
    - deriveProjection:
      - state ok with R=10, nOpt 4, nLikely 5, nPess 8 gives sorted points at today, optimistic, likely and pessimistic.
      - forecast at the likely date is 0.
      - band at the likely date is [0, R − (R/nPess)·5].
      - Every value is ≥ 0.
      - A pessimistic date beyond the cap (today + max(60 days, history span)) is clipped to the cap, and clippedAfter is set.
      - A non-ok state gives points [].
    - withProjection: the today point gets forecast = band bound = its remaining value. Future points have null CFD fields. Points stay sorted by t.
    - fetchEpicStatusHistory (jira.test.ts, using the existing plugin-http fetch mock pattern):
      - (a) 60 valid keys give 3 search calls of ≤ 25 keys, each with `expand=changelog` and `fields=status,created`. Malformed keys are filtered out before the JQL.
      - (b) Histories are sorted ascending even when the response is newest-first. Only `field === 'status'` items become transitions, with from/to ids and names.
      - (c) `changelog.total > histories.length` triggers GET `/rest/api/2/issue/{key}?expand=changelog&fields=status`, and its histories replace the embedded ones. Without truncation there is no top-up.
      - (d) A failed top-up keeps the embedded histories.
      - (e) A non-ok search rejects.
      - (f) Empty keys give an empty Map with no fetch.
      - (g) An issue with zero histories still gets an entry with transitions [].
      - (h) An `Epic Link` item whose toString contains the epic key sets joinedAt.
  </behavior>
  <action>
Implements CONTEXT "Forecast (Adaptive range)", "Status history" and "colours" decisions using RESEARCH §1, §2 and §5. Pure functions only, with `today` injected and no Date.now. No `Array.prototype.at`.

(a) statusStyles.ts:
- Add STATUS_CATEGORY_COLOR as literal `var(--color-…)` strings, so Tailwind v4 keeps emitting the theme variables, and add `statusCategoryColor`.
- Create statusStyles.test.ts.

(b) jira-changelog.ts: add optional `from?: string | null; to?: string | null` to the item type. This is a type-only change.

(c) jira.ts:
- Export StatusTransition, EpicStatusHistory and `fetchEpicStatusHistory(baseUrl, token, storyKeys, epicKey)`.
- Copy the fetchEpicWorklogs structure:
  - Use the same key regex.
  - Use a local `STATUS_HISTORY_CHUNK = 25`, since changelog payloads are heavy (the standup timeout lesson).
  - Run the chunks through a bounded worker pool of PAGE_CONCURRENCY rather than a sequential loop. Each chunk calls `fetchAllSearchPagesConcurrent` with `${base}/rest/api/2/search?jql=${encodeURIComponent('key in (…)')}&fields=status,created&expand=changelog`.
  - Fail closed: a search error rejects.
  - Dedupe by key.
- Per issue:
  - Sort `changelog.histories` ascending by `created` (Cloud returns newest-first).
  - If `changelog.total > histories.length`, queue a top-up. The top-up is an apiFetch GET of `/rest/api/2/issue/${encodeURIComponent(key)}?expand=changelog&fields=status`, run through the same worker-pool pattern. Fail open, and replace only when the top-up returns more histories. Do NOT use `/issue/{key}/changelog`, which is Cloud-only.
  - Map `field === 'status'` items to `{at: history.created, fromId: from ?? null, fromName: fromString, toId: to ?? null, toName: toString}`.
  - joinedAt is the `created` of the last `Epic Link` item whose `toString` includes epicKey, else null. This rests on assumption A3: harmless if absent.
- Use a local narrow type for the changelog search response. Do not widen the global JiraIssue.
- Add a JSDoc about the Cloud 100-history cap and the DC order difference.
- Do NOT touch fetchEpicStories or fetchAllSearchPages, and do NOT fix the 200-step bug.

(d) epic-progress.ts. Add the new_contracts exports:
- Working days:
  - Mon–Fri only. Derive the weekday from `new Date(toMs(key)).getUTCDay()`.
  - Snapping: a weekend day snaps forward to Monday, clamped to the window anchor. The anchor is today, or the previous Friday when today is a weekend.
- forecastFromThroughput implements RESEARCH §2 steps 1-10 exactly. Use exported named constants FORECAST_MIN_WINDOW=3, FORECAST_MAX_WINDOW=30, FORECAST_STALL_WD=10, FORECAST_Z=1.28 and FORECAST_MIN_EVENTS=2.
  - Window: W = clamp(inclusive working-day age, 3, 30).
  - EWMA half-life: h = max(2, W/3).
  - scopeAfter counts only additions on days after firstActivity. It is zeroed when age < 5.
  - Net mean μ and weighted σ, with inflation σ·(1+2/W) and floor σ ≥ 0.15μ.
  - State order: done → too-early → stalled → not-converging → ok.
    - Stalled: working days since the last completion (or since firstActivity when there are none) ≥ 10, and age ≥ 10.
    - Not-converging: μ ≤ 0 or μ < 0.1·μ_d.
  - Range: normal-approximation quadratic (s± formula), n_pess = s₊², n_opt = s₋².
  - Rounding: always use `Math.ceil(n - 1e-9)` for nLikely/nOpt/nPess and for the dates via addWorkingDays(today, …). Float error otherwise makes ceil(R/μ) land one high, which breaks the exact nLikely === 20 and ≈ 10 assertions. Store the rounded integers in nLikely/nOpt/nPess.
  - Confidence thresholds as in RESEARCH step 9.
  - explanation examples:
    - ok: "Based on the last 12 working days (recent days weigh more): 3.1 done/wk, scope +0.4/wk."
    - stalled: "No progress in 15 working days."
    - not-converging: "Scope grew 7.5/wk vs 5/wk done."
    - too-early: "Needs a little more completed work to project a date."
    - Format rates via formatMetric for SP, a plain number for count, and formatDuration for time.
- deriveAdaptiveForecast builds ThroughputInput from cheap data only:
  - completions: doneDateKey with weightOf.
  - scopeAdds: enter day = max(created clamped ≤ today, epicCreated). Stories created before epicCreated enter on epicCreated, matching the CFD rule.
  - firstActivity: the earliest of the first done date and the earliest statuscategorychangedate of indeterminate stories.
  - eventCount: number of done stories.
  - remaining: total − done.
  - allDone: stories.length > 0 && every catOf done.
- deriveTimeForecast:
  - completions: per-day worklog seconds summed across all stories (validKey-filtered, clamped ≤ today).
  - scopeAdds: [].
  - remaining: deriveTimeTotals(stories).remaining.
  - firstActivity: the earliest log day.
  - eventCount: distinct log days.
  - allDone: as above.
- deriveSummary per new_contracts. The pctDone rule is copied from the old deriveForecast (allDone → 100).
- AssigneeBucket gets `avatarUrl: string | null`, set in deriveAssigneeBuckets.
- buildStatusCategoryLookup, deriveCfd, deriveProjection and withProjection follow RESEARCH §1 ("Per-story timeline", "CFD sweep", "Fallback") and §3 ("Band", "Axis cap"):
  - CFD axis start = epicCreated day when valid and ≤ today, else the earliest created (the orchestrator lock).
  - Daily up to 120 days, else step ceil(span/120) days with today always included.
  - Transition days come from toLocalDateString(new Date(at)) via '@/lib/local-date', clamped to [enter, today]. Document in a comment that the worklog/done paths use the server-offset slice. Use mid-day timestamps in test fixtures.
  - `t` = toMs(date).
- Keep deriveBurnup, BurnupPoint, the old Forecast and the old deriveForecast UNCHANGED in this task so the section still compiles. They are removed in Tasks 2/3.

(e) Tests: add every behavior above. Existing tests stay unchanged; the only exception is that bucket expectations may need `avatarUrl` if they use toEqual (grep first and list any in the SUMMARY).

Commit ONE commit: `feat(261001-ilq): adaptive forecast, CFD derivation, status-history fetcher, status colour map`. The pre-commit hook runs biome + tsc (tests included) + the full vitest suite. Never use --no-verify. Retry once on the known WorklogsPage flake.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts src/lib/statusStyles.test.ts src/services/jira.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>
- All 8 forecast case-table cases plus the edge cases pass.
- deriveCfd, projection, lookup and fetcher tests pass.
- tsc is clean. The section is untouched and still compiles.
- The work lands in one green commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared tooltip body + hero/stat strip + Jira-like assignee rows with chips + tooltip/colour adoption (section, quick-peek, story mini bars)</name>
  <files>taskflow/src/components/ui/tooltip-body.tsx, taskflow/src/components/ui/tooltip-body.test.tsx, taskflow/src/components/ui/tooltip.tsx, taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts, taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/EpicProgressCells.tsx, taskflow/src/routes/dashboard/EpicProgressCells.test.tsx, taskflow/src/routes/dashboard/EpicsPage.test.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx, taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts</files>
  <behavior>
    - tooltip-body.test.tsx:
      - TooltipRow renders `[data-slot="tooltip-row"]` with a swatch whose inline background equals `color`. `dashed` gives a dashed-border swatch.
      - Label, value and sub are direct children of the row.
      - TooltipBody renders the title and the note (muted, top border).
      - TOOLTIP_SURFACE contains 'ring-1' and 'rounded-lg'.
    - The hero (testid epic-hero, a button TooltipTrigger containing spans only):
      - Count/SP: shows the big `${pctDone}%` as its own text node, then a segmented bar (testid epic-hero-bar, done/indeterminate/new in statusCategoryDotClass), then ONE text node `${done} of ${total} done · ${inProgress} in progress` in the active metric.
      - Time: shows the big pctLogged% (or '—'), a logged (done colour) / remaining (indeterminate colour) bar, and ONE text node `${logged} of ${estimated} logged`.
      - Tooltip: TooltipBody rows per category using CAT_LABEL + STATUS_CATEGORY_COLOR, with value and pct sub. In Time mode the rows are Logged / Remaining / Estimate, with the note ESTIMATE_FORMULA_NOTE.
    - The stat strip has exactly 3 testid epic-stat-tile cells: Finish, Remaining, Risks.
      - Finish value by state:
        - ok: formatDateKey(likely), with `, yyyy` appended when the year ≠ today's year. sub = `${opt}–${pess} · ${confidence} confidence`.
        - done: 'Complete'.
        - too-early: 'Too early to tell'.
        - stalled: 'Stalled'.
        - not-converging: 'Not converging'.
        - Time mode while worklogs are pending: '—' with sub 'Loading worklogs'. On error: sub 'Worklogs unavailable'.
        - The tooltip = forecast.explanation plus the range lines.
      - Remaining: the active metric is primary (count `N items`/`1 item`, SP formatMetric, time formatDuration). The other two metrics are shown as a muted sub joined by ' · '.
        - The Time-mode tooltip keeps "Open stories: estimate minus logged, never below 0. Replaces Jira's remaining estimate so it matches the chart."
      - Risks: amber chips (tonePillClass('amber') + AlertTriangle icon), each a single lowercase text node:
        - `${n} unestimated`: unestimatedSp in Count/SP, unestimatedTime in Time.
        - `${n} unassigned`.
        - 'stalled' when the forecast is stalled.
        - 'scope growing' when it is not-converging.
        - With no risks it shows a muted 'None'.
      - Layout: the hero and strip stack at narrow widths. One row = one line inside each cell (truncate).
    - Assignee rows:
      - Each row shows `CachedAvatar url={a.avatarUrl} name={a.name} size={20}` + a `truncate pr-0.5` name inside a `w-40 flex-none flex items-center gap-1.5 min-w-0` cell, then the bar (testid epic-assignee-bar, unchanged), then chips.
      - Chips (testid epic-assignee-chip, data-cat):
        - Count/SP: three fixed slots done / indeterminate / new, using statusCategoryBadgeClass tint, `min-w-[2.25rem] text-center tabular-nums rounded px-1 text-[11px]`. The text is the number only. The aria-label is e.g. `done 1` / `in progress 0` / `to do 2`. Zero → opacity-40.
        - Time: two slots, logged (done tint) and estimate (new tint), `min-w-[3.5rem]`, aria-labels `logged 1h 30m` / `estimate 3h`.
      - No chip or avatar is focusable. The row still has exactly one focusable element (the bar).
      - The assignee tooltip is TooltipBody title=name with rows Done/In progress/To do (and Logged/Estimate in Time mode).
    - The status bar tooltip uses TooltipRow (label = status name, value = formatMetric, sub = pct%). The existing hover test (`findByText('Done').parentElement` contains '50%') passes unchanged.
    - Quick-peek (EpicProgressCells): TooltipBody rows Done/In progress/To do with STATUS_CATEGORY_COLOR swatches and the count values, plus the note `${donePoints} of ${points} SP done`.
    - Story mini bar (IssueDetailContent):
      - TooltipBody rows: Estimate (new colour), Logged (done colour, or red-500 when overrun), Remaining (indeterminate colour), with the note ESTIMATE_FORMULA_NOTE.
      - With no estimate: title 'No estimate', then a Logged row.
      - Bar fill colours are unchanged.
    - The worklog query is lifted into useEpicWorklogs. The section calls it with enabled = metric === 'time', and EpicTimeBurnup receives the query result via props and no longer calls useQuery itself. Count/SP still never call fetchEpicWorklogs.
  </behavior>
  <action>
Implements CONTEXT "Top info (Hero + stat strip)", "Users (Jira-like)", "User row trailing value", and "Tooltips unified + colours consistent", using RESEARCH §4-§7 and pitfalls 1-4.

(a) tooltip-body.tsx (new, presentational, no portal):
- TOOLTIP_SURFACE = 'rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-foreground/10'.
- TooltipBody is a `grid min-w-36 gap-1`. The title is font-medium. The note is `mt-0.5 border-t border-border/50 pt-1 text-muted-foreground`.
- TooltipRow is a flex items-center gap-2:
  - swatch: `size-2 shrink-0 rounded-[2px]` with style background=color; dashed → transparent background + `border border-dashed` in that colour.
  - label: text-muted-foreground.
  - value: `ml-auto pl-3 font-mono font-medium tabular-nums`.
  - sub: muted tabular-nums.

(b) tooltip.tsx: TooltipContent Popup className = cn('max-w-xs outline-none', TOOLTIP_SURFACE, the existing transition classes, className). There is no visual change. Leave chart.tsx alone; it has other consumers.

(c) useEpicProgressQueries.ts (new): export `useEpicWorklogs(epicKey, storyKeys: string[], enabled)`.
- Read auth by destructuring, `const { jiraBaseUrl, jiraConnected } = useAuthStore()`, exactly as EpicTimeBurnup does today. NEVER use a selector: the EpicDetailSheet.test auth mock ignores selectors.
- Move EpicTimeBurnup's existing queryFn and key EXACTLY: `['jira-epic-worklogs', epicKey, jiraBaseUrl, sortedKeys.join(',')]`, staleTime 60_000, readSecret('jira-pat') + useAuthStore, enabled && jiraConnected && jiraBaseUrl && keys.length > 0.
- Return the useQuery result.
- Task 3 adds the history hooks to this file.

(d) lib/epic-progress.ts:
- Delete the old `Forecast` interface and `deriveForecast`. Grep `taskflow/src` first and confirm the section is the only consumer.
- Delete the `describe('deriveForecast')` block in epic-progress.test.ts (intentional change 1).

(e) EpicProgressSummary.tsx (new): export `EpicProgressSummary({ metric, summary, time, forecast, forecastStatus: 'ready'|'loading'|'error', today })`.
- Renders the hero + strip per the behavior block.
- Move the `Tile` component here. Extend it with an optional `sub` and `children` (Risks chips), keeping spans only (no p/div inside the button) and testid epic-stat-tile.
- All tooltip contents use TooltipBody/TooltipRow.
- Text-collision rule (EpicDetailSheet.test): no visible text node that equals exactly 'Done' or 'In Progress', and no 'Stories' with a capital S. All sentences are lowercase single template-literal nodes.

(f) EpicProgressSection.tsx:
- Call the hooks BEFORE the early returns, with storyKeys from `stories ?? []`.
- Compute deriveSummary, deriveTimeTotals, and the forecast:
  - metric 'time' → deriveTimeForecast(stories, worklogs.data, today) when data is present. forecastStatus is 'loading' when `!data && (isFetching || isPending-enabled)` and 'error' when isError. Branch on `!data && !isFetching` per prior WR-02.
  - otherwise → deriveAdaptiveForecast(stories, metric, spKey, epicCreated, today).
- Replace the 4-tile grid with <EpicProgressSummary/>.
- Convert statusBarTip and assigneeTip to TooltipBody/TooltipRow.
- Rebuild the assignee rows per the behavior block.
- Pass `query={worklogs}` to EpicTimeBurnup.
- Update the skeleton geometry to the hero + strip shape. Keep the testid and border-t/b.
- The chart (deriveBurnup) is unchanged in this task.

(g) EpicTimeBurnup.tsx: remove the internal useQuery, readSecret and auth imports. Take `query: Pick<UseQueryResult<Map<string, EpicWorklogDay[]>>, 'data' | 'isError' | 'isFetching' | 'refetch'>` and keep the same states, testids and Retry. The chart itself is unchanged in this task.

(h) EpicProgressCells.tsx quick-peek and IssueDetailContent.tsx story mini bar: switch to TooltipBody/TooltipRow as described, with swatches from STATUS_CATEGORY_COLOR. No other change.

(i) Tests:
- Create tooltip-body.test.tsx.
- In EpicProgressSection.test.tsx:
  - Add a shared `renderSection(props)` helper wrapping QueryClientProvider (retry false) and use it for EVERY render, including the first describe's bare renders. This is a harness-only change.
  - Add mocks `fetchEpicStatusHistory: vi.fn().mockResolvedValue(new Map())` and `fetchAllJiraStatuses: vi.fn().mockResolvedValue([])` to the existing '@/services/jira' partial mock, ready for Task 3.
  - Add a `rowTexts()` helper that reads `document.querySelectorAll('[data-slot="tooltip-row"]')` textContent.
  - Add the new tests:
    - Hero text in count and SP mode.
    - Finish states ok / too-early / done.
    - Remaining sub line.
    - Risks chips and 'None'.
    - Assignee avatar (role img, aria-label = name) and chips (aria-labels, opacity-40 on zero).
    - The one-tab-stop rule still holds.
    - Count/SP never call fetchEpicWorklogs.
- Apply intentional changes 1-15 below exactly.
- Then run EpicDetailSheet.test.tsx, IssueDetailPage.progressive.test.tsx and IssueDetailContent.test.tsx. If something breaks on a text collision or a button count, fix the component, not the assertion.
- Run biome check on the touched files (gate: no new findings).

Commit ONE commit: `feat(261001-ilq): hero + stat strip, Jira-like assignee rows, unified tooltips and status colours`. Never use --no-verify.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/tooltip-body.test.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/EpicProgressCells.test.tsx src/routes/dashboard/EpicsPage.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/lib/epic-progress.test.ts && npx tsc --noEmit && npx biome check src/components/ui/tooltip-body.tsx src/components/ui/tooltip.tsx src/routes/dashboard/issue-detail src/routes/dashboard/EpicProgressCells.tsx src/routes/dashboard/IssueDetailContent.tsx</automated>
  </verify>
  <done>
- The hero + 3-cell strip renders with the adaptive Finish (time mode included, via the lifted worklog query).
- Assignee rows show avatars and status-coloured chips.
- Every tooltip in the feature uses TooltipBody/TooltipRow on TOOLTIP_SURFACE.
- The old deriveForecast is gone.
- Intentional changes 1-15 are applied, the neighbouring suites are green, and the work lands in one commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: CFD chart + Time chart with Remaining and forecast band, lazy status-history queries, unified chart tooltip</name>
  <files>taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts, taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx, taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx, taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx</files>
  <behavior>
    - useEpicStatusHistory:
      - Key `['jira-epic-status-history', epicKey, jiraBaseUrl, sortedKeys.join(',')]`, enabled only when metric !== 'time' (and connected, base URL set, keys > 0).
      - The queryFn calls fetchEpicStatusHistory(base, token, sortedKeys, epicKey).
    - useJiraStatusList: key `['jira-statuses']`, fetchAllJiraStatuses, staleTime/gcTime Infinity, same enable rule. This is the same data shape as the greenhopper cache, so sharing the key is safe.
    - In Count/SP mode the section calls fetchEpicStatusHistory once with the sorted keys and the epic key. In Time mode it does not call it.
    - The CFD (testid epic-burnup kept on the explicit-height wrapper, with `data-history="real"|"approx"`):
      - Renders while history is pending, errored, or resolved. A skeleton never replaces it.
      - The note (testid epic-cfd-note) reads:
        - pending → 'Approximate — loading status history'
        - error → 'Approximate — status history unavailable'
        - resolved but approximate → 'Approximate for some items'
        - resolved and real → 'From Jira status history'
      - The custom legend (testid epic-cfd-legend) has single-node labels 'Completed', 'In progress', 'To do', 'Remaining', plus 'Forecast' only when the projection is non-empty. There is no recharts <Legend>.
      - 'No timeline data' still shows when deriveCfd returns [].
    - The Time chart (testid epic-time-burnup):
      - Series Estimate (STATUS_CATEGORY_COLOR.new area), Logged (done line), and Remaining = estimate − logged (indeterminate line).
      - A dashed forecast + band from deriveTimeForecast when ok.
      - A numeric time axis. Loading/error/Retry are unchanged.
    - EpicChartTooltip.test.tsx (rendered directly with a fake recharts payload):
      - A history datum shows a title with the full date and year, then rows in fixed order Completed / In progress / To do / Remaining, with metric-formatted values and STATUS_CATEGORY_COLOR swatches.
      - A future datum shows Forecast (dashed swatch) and Range `low–high` rows, and no CFD rows.
      - When clippedAfter is set, the note says `pessimistic after {date}`.
      - Inactive or empty payload renders null.
    - epic-progress.ts no longer exports deriveBurnup/BurnupPoint, and the private buildAxis remains only if deriveTimeBurnup still uses it.
  </behavior>
  <action>
Implements CONTEXT "Graph (Cumulative flow + forecast)" and "Chart tooltip lists every series", with RESEARCH §1 (category resolution), §3 (Recharts recipe) and pitfalls 1, 2, 3, 5 and 7.

(a) useEpicProgressQueries.ts: add useEpicStatusHistory and useJiraStatusList, following the useEpicWorklogs credentials pattern. Auth comes from destructuring `const { jiraBaseUrl, jiraConnected } = useAuthStore()`, with no selectors (the EpicDetailSheet.test mock ignores them). Import the fetchers from '@/services/jira' so the test mocks apply.

(b) EpicChartTooltip.tsx: `EpicChartTooltip({ active, payload, metric, rows })`.
- Read `payload[0].payload` (the datum), not the per-item values, so the order is fixed and range arrays never reach a formatter.
- Render `<div className={TOOLTIP_SURFACE}><TooltipBody title=…>`.
- `rows` is a function datum → TooltipRow specs. Each chart passes its own: CFD rows, or time rows Estimate / Logged / Remaining. Future points get Forecast + Range rows.
- Title = `${formatDateKey(date)}, ${year}`.

(c) EpicCfdChart.tsx: `EpicCfdChart({ data, metric, approximateNote, hasProjection, clippedAfter })`.
- Keep the 'use no memo' + explicit 220px height wrapper + isAnimationActive={false} conventions.
- ComposedChart with XAxis `type="number" dataKey="t" scale="time" domain={['dataMin','dataMax']}`, ticks via formatDateKey of the ISO day of t, minTickGap 24.
- Three `<Area stackId="cfd" type="stepAfter">` in the order done → inProgress → todo. Fill and stroke come from STATUS_CATEGORY_COLOR (done/indeterminate/new), fillOpacity ≈ 0.35.
- `<Line dataKey="remaining">` solid in var(--foreground), strokeWidth 1.5, no dots, stepAfter.
- `<Line dataKey="forecast" strokeDasharray="4 4" connectNulls>` in var(--muted-foreground), type linear.
- `<Area dataKey="band">` with NO stackId, fill var(--muted-foreground), fillOpacity 0.12, no stroke.
- Tooltip: `content={(p) => <EpicChartTooltip …/>}` with the dashed cursor (BAR_CURSOR).
- Y ticks: count → integers, SP → numbers.
- Then the custom legend (swatches via TooltipRow-like spans; plain non-focusable text) and the note.
- The Remaining line and forecast use non-status colours, so they never collide with a status colour.

(d) EpicProgressSection.tsx (Count/SP branch):
- lookup = buildStatusCategoryLookup(statuses.data, stories).
- `{points, approximate} = deriveCfd({ stories, history: history.data ?? null, lookup, metric, spKey, epicCreated, today })`.
- projection = deriveProjection(forecast, today, points[0]?.date ?? null) (index access, no `.at`).
- data = withProjection(points, projection).
- Render <EpicCfdChart/> in place of the burnup. Remove chartConfig, the deriveBurnup import, the ChartTooltipContent usage and the 'Scope by story creation date' caption.

(e) EpicTimeBurnup.tsx:
- Map deriveTimeBurnup points to hours, add `t` and `remaining = (estimate − logged)/3600`, then merge withProjection(deriveProjection(deriveTimeForecast(stories, data, today) converted to hours)).
  - The projection math is unit-agnostic. Convert the forecast's remaining to hours, or project in seconds and divide. Pick one and comment it.
- Numeric time axis as above. Estimate Area (new colour), Logged Line (done colour), Remaining Line (indeterminate colour), forecast dashed + band.
- EpicChartTooltip with time rows formatted via formatDuration(h·3600).
- Custom legend 'Estimate', 'Logged', 'Remaining', 'Forecast'. Keep the existing caption with ESTIMATE_FORMULA_NOTE as a combined sentence, NOT an exact standalone node.

(f) lib cleanup:
- Delete deriveBurnup and BurnupPoint, after grepping that there are no other consumers. Keep buildAxis only if deriveTimeBurnup uses it.
- In epic-progress.test.ts, delete the deriveBurnup describe block and the other deriveBurnup usages (the clamp test ~lines 207-222 and the time-metric burnup ~line 300). Their intent is already covered by the deriveCfd tests from Task 1 (h) and (g). Remove the import. This is intentional change 16.

(g) Neighbour test mocks:
- Add `fetchEpicStatusHistory: vi.fn().mockResolvedValue(new Map())` and `fetchAllJiraStatuses: vi.fn().mockResolvedValue([])` to the FULL '@/services/jira' mock factories in IssueDetailContent.test.tsx and IssueDetailPage.progressive.test.tsx, but only for files whose render path mounts the section with stories.
- For EpicDetailSheet.test.tsx (no jira mock, jiraConnected true), add a partial `vi.mock('@/services/jira', async (orig) => ({ ...(await orig()), fetchEpicStatusHistory: vi.fn().mockResolvedValue(new Map()), fetchAllJiraStatuses: vi.fn().mockResolvedValue([]) }))` so no real request is attempted.
- Its existing assertions (/Stories/, 'In Progress', 'Done') must pass UNCHANGED. The CFD legend uses 'Completed' / 'In progress' / 'To do' precisely to avoid these collisions, and to avoid the `/Done · 1/` legend test collision.

(h) EpicProgressSection.test.tsx: apply intentional changes 17-18. Add tests:
- The status history fetch is called in Count mode (once, with sorted keys + epic key) and not in Time mode.
- The note texts for resolved-real (mock returns an entry per story), pending (a never-resolving promise) and rejected.
- The epic-burnup wrapper renders in all three states.
- The legend includes 'Forecast' only for an ok fixture, and not for a too-early fixture. Make it deterministic:
  - In those tests only, call `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(new Date('2026-09-30T12:00:00'))`, a Wednesday. Faking only Date keeps react-query/userEvent timers real.
  - Restore with `vi.useRealTimers()` in afterEach.
  - Use fixed ISO dates, e.g. the steady case: 1 done per working day over the prior 15+ working days and a few open.
  - Do NOT build weekday-dependent fixtures with daysAgo.
- In Time mode, epic-time-burnup renders and its legend includes 'Remaining'.

Test series values through the lib, not the SVG DOM (jsdom has no pointer events).

Run biome on the touched files. Commit ONE commit: `feat(261001-ilq): cumulative flow diagram and time chart with remaining and forecast band`. Never use --no-verify.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/lib/epic-progress.test.ts && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail src/lib/epic-progress.ts</automated>
  </verify>
  <done>
- Count/SP shows the stacked CFD from status history (with a fallback and note), plus Remaining and the forecast with its range band.
- Time shows Estimate/Logged/Remaining plus the forecast.
- Both charts use EpicChartTooltip on the unified surface.
- deriveBurnup is removed.
- The neighbouring suites are green with their original assertions intact.
- The work lands in one commit, and the full suite is green.
  </done>
</task>

</tasks>

<intentional_test_changes>
These existing expectations change ON PURPOSE. Each must be updated as described, never weakened elsewhere, and listed verbatim in the SUMMARY.

Task 2:
1. epic-progress.test.ts: the whole `describe('deriveForecast')` block (4 tests) is deleted and the `deriveForecast` import removed.
   - The "counts unestimated and unassigned open" intent was ported to deriveSummary in Task 1.
   - The throughput intents are superseded by the forecast case table.
2. EpicProgressSection.test.tsx 'renders all panels': `getAllByTestId('epic-stat-tile')` length 4 → 3, plus `getByTestId('epic-hero')` present. The other assertions stay unchanged.
3. 'shows "Not enough data" for insufficient throughput' is renamed to 'shows "Too early to tell" …' and asserts `getByText('Too early to tell')`. The fixture has 1 completion 2 days ago, so it gives too-early in the new algorithm.
4. 'shows Complete and no projected date at 100%': `queryByText('Not enough data')` → `queryByText('Too early to tell')`. '100%' and 'Complete' are unchanged.
5. 'Time mode shows Estimated / Logged / Remaining / % logged tiles': this now asserts that the hero shows the same % logged value and the `X of Y logged` line with the same durations as before.
   - tiles length 3, and tiles[1].textContent starts with 'Remaining' followed by the same Remaining value the old test asserted.
   - Rename the test accordingly.
6. 'Time mode assignee row shows logged / estimate': `getByText('1h 30m / 3h')` → `within(row).getByLabelText('logged 1h 30m')` and `getByLabelText('estimate 3h')`. Use the same values as the old assertion.
7. 'keyboard focus on a tile shows the raw counts': the 4th Tab now lands on epic-hero (assert document.activeElement). The tooltip shows tooltip rows for Done / In progress / To do with the fixture values (assert via rowTexts). This replaces `findByText('1 of 2 done')`.
8. 'hovering the assignee bar shows the breakdown in the active metric': 'done: 1h' / 'to do: 2h' / '1h 30m logged of 3h' → the tooltip title 'Amy' plus rows Done 1h, To do 2h, Logged 1h 30m, Estimate 3h (assert via rowTexts content).
9. 'Time mode shows a loading skeleton then the chart…' and 'shows an error with Retry…': `getAllByTestId('epic-stat-tile')` length 4 → 3. The fetch/Retry assertions are unchanged.
10. 'Estimated tile uses the subtask-sum formula and its tooltip explains it': this now asserts that the hero shows the 3h estimate in its line, and hovers `epic-hero` (Time mode) to find ESTIMATE_FORMULA_NOTE.
11. 'Remaining tile tooltip says it replaces the Jira remaining estimate': it hovers `getAllByTestId('epic-stat-tile')[1]` instead of `[2]`.
12. Harness: every bare `render(<EpicProgressSection …/>)` in EpicProgressSection.test.tsx goes through a QueryClientProvider helper. The '@/services/jira' partial mock gains fetchEpicStatusHistory and fetchAllJiraStatuses. Assertions are unchanged.
13. EpicProgressCells.test.tsx EPIC-05 (lines 45-48):
    - `findByText('5 Done')`, `getByText('3 In Progress')` and `getByText('2 To Do')` → tooltip rows Done/5, In progress/3, To do/2 (via `[data-slot="tooltip-row"]` textContent).
    - `getByText('8 of 20 SP done')` is unchanged.
14. EpicsPage.test.tsx (lines 174-176): the same conversion as 13. '5/10' and the hover step are unchanged.
15. IssueDetailContent.test.tsx story mini bar tests:
    - 'Logged 30m' (line 289 and 297), 'Estimate 2h' (296), 'Remaining 1h 30m' (298) and 'Remaining 0m' (306) → TooltipRow label/value pairs, asserted via row textContent ('Logged30m', 'Estimate2h', 'Remaining1h 30m', 'Remaining0m').
    - 'No estimate' (288) and the ESTIMATE_FORMULA_NOTE assertion are unchanged.

Task 3:
16. epic-progress.test.ts: delete `describe('deriveBurnup')`, the deriveBurnup assertions in 'clamps a done date past local today…' (~207-222) and the time-metric deriveBurnup test (~300), and remove the import. They are covered by deriveCfd tests (h)/(g) from Task 1.
17. EpicProgressSection.test.tsx 'renders all panels': `getByText('Scope by story creation date')` → `getByTestId('epic-cfd-note')` present, and `getByText('Completed')` in epic-cfd-legend. `getByTestId('epic-burnup')` is unchanged.
18. EpicProgressSection.test.tsx 'shows "No timeline data"…' is unchanged in text, but it must still pass with the CFD (no created + no epicCreated → []).

Must remain UNCHANGED: EpicDetailSheet.test.tsx assertions at lines 125/153/158, the status-bar hover test (`findByText('Done').parentElement` contains '50%'), the legend 'In Review · 1 · 5 SP' and `/Done · 1/` tests, the one-tab-stop-per-row test, '25%'/'10%' toggle test, 'Count and SP never fetch worklogs', and the skeleton/no-Card test.
</intentional_test_changes>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira REST -> client | Issue keys, changelog histories (status ids/names, Epic Link strings), statuses list, worklog seconds come from the user's Jira server |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ilq-01 | Tampering | fetchEpicStatusHistory JQL/URL | mitigate | Keys are filtered with `/^[A-Z][A-Z0-9_]*-\d+$/` before JQL interpolation. JQL goes through encodeURIComponent and top-up paths through encodeURIComponent(key). The chunk of 25 bounds URL length |
| T-ilq-02 | Denial of service | expand=changelog payloads | mitigate | Only this epic's stories, 25 keys per chunk, PAGE_CONCURRENCY-bounded pool, top-ups only for truncated issues. The query is lazy (Count/SP only) with its own key, and the CFD falls back instead of blocking |
| T-ilq-03 | Tampering | deriveCfd / forecast inputs | mitigate | validKey date filtering, clamping to [enter, today], unknown statuses → 'new', non-finite weights → 0. The forecast guards μ ≤ 0 and division by zero |
| T-ilq-04 | Information disclosure / XSS | Tooltips, chips, legend | mitigate | Jira strings are rendered only as React text children. There is no dangerouslySetInnerHTML |
| T-ilq-SC | Tampering | package installs | accept | No new packages (Recharts 3.8.0, base-ui, Tailwind already installed) |
</threat_model>

<verification>
- `cd taskflow && npm run check && npm test`: full suite. The pre-commit hook also enforces this on each of the 3 commits.
- `npx tsc --noEmit` is clean. Count `.at(` call sites in the touched files, excluding comments: `grep -v '^\s*//' taskflow/src/lib/epic-progress.ts | grep -c '\.at('` returns 0.
- Confirm fetchEpicStories is untouched: `git diff HEAD~3 -U0 -- taskflow/src/services/jira.ts | grep -c 'issuetype != Sub-task'` returns 0.
- Confirm no ad-hoc chart colours remain. In the CFD and time chart files, `grep -n "color-gray-400\|color-green-500" taskflow/src/routes/dashboard/issue-detail/*.tsx` returns no matches, because colours come via STATUS_CATEGORY_COLOR.
- The SUMMARY:
  - Lists intentional test changes 1-18 verbatim.
  - Notes UAT items for the real Tauri/WKWebView app: hover tooltips, CFD shapes against real DC changelog, and Epic Link joinedAt assumption A3.
  - Records any forecast threshold observations.
</verification>

<success_criteria>
- The CFD with Done/In progress/To do from status history, plus Remaining and a forecast with a range band, replaces the scope/done burnup. The Time chart adds Remaining and its forecast.
- The adaptive forecast handles the 1-week, 3-day high-velocity, steady, stalled, scope-growth, too-early and done cases as specified, and its tooltip explains the method.
- The hero + stat strip replaces the 4 tiles, and the Finish cell shows likely date + range + confidence or the state text.
- Assignee rows show avatars like Jira and status-coloured count chips.
- One tooltip style and one status-colour source across the section, epics-list quick peek and stories-list mini bars.
- 3 commits, each with tests and implementation together, and the full suite is green.
</success_criteria>

<output>
Create `.planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/261001-ilq-SUMMARY.md` when done
</output>
