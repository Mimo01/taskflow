---
phase: quick-261001-qvu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/components/ui/tooltip-body.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts
  - taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  - taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx
autonomous: true
requirements: [QUICK-261001-qvu]

must_haves:
  truths:
    - "The headline Finish (hero strip) is the average of the available Count, SP and Time forecasts. Averaging is done separately for earliest, likely and latest, in working-day offsets from today, mapped back through the working calendar. It does not depend on the Count/SP/Time toggle"
    - "A metric contributes only when its forecast state is ok with nLikely > 0. Excluded metrics are listed in the Finish tooltip with a reason (e.g. 'no estimates', 'no logged time', 'loading worklogs', 'worklogs unavailable', 'too early to tell', 'stalled'). With no contributor, Finish falls back to Complete (only when all done) / Stalled / Not converging / Too early to tell"
    - "Confidence of the average is the lowest contributor confidence, downgraded one level when contributors disagree (likely spread > 50% of the mean likely)"
    - "Worklogs load in every mode, after first paint, so Time can contribute. Finish renders immediately from the available metrics and lists Time as 'loading worklogs' until they arrive"
    - "Forecasts skip weekends and, when Tempo is enabled and the schedule loads, Tempo HOLIDAY / NON_WORKING_DAY weekdays. This applies to both window sampling and the finish-date projection. The Finish tooltip says 'Excludes weekends and N holidays (Tempo)' or 'Excludes weekends (holidays unavailable)'"
    - "The CFD and Time charts' forecast line has one datapoint per calendar day from today to the latest date (capped at 260 points; flat on non-working days). Dots are hidden until hover. The hover tooltip shows the projected remaining, the range and 'N working days' from today"
    - "Each assignee row (avatar, name, bar, chips) is one tooltip trigger with the full breakdown. Each row still has exactly one tab stop and no nested interactive element"
    - "The hero caption and the status-bar legend sit visibly further from their bars than before"
    - "Every tooltip row has a leading marker. Status and series rows keep their colour swatch, line series get a line marker, and rows without a colour get a neutral dot"
    - "Risks render as severity-tinted chips with an icon (amber for warning, muted for info, never a status colour). The chips cover overdue / finish after the due date, stalled, scope growing, unestimated and unassigned. The tooltip has one row per risk with a marker, a count, a short explanation and up to 3 issue keys. A clean epic shows 'No risks' with a check icon"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "WorkCalendar (buildWorkCalendar, DEFAULT_CALENDAR, holidaysBetween), calendar-aware working-day helpers + forecasts + projection, averageForecasts, deriveRisks"
      exports: ["WorkCalendar", "DEFAULT_CALENDAR", "buildWorkCalendar", "holidaysBetween", "addCalendarDays", "averageForecasts", "AveragedForecast", "deriveRisks", "EpicRisk", "PROJECTION_MAX_POINTS"]
    - path: "taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts"
      provides: "useEpicWorkCalendar (Tempo schedule query, own key) + worklogs enabled in all modes"
      contains: "'epic-forecast'"
    - path: "taskflow/src/components/ui/tooltip-body.tsx"
      provides: "TooltipRow with a marker API (swatch | dot | line | dashed | icon), neutral dot by default"
      contains: "marker"
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      provides: "Averaged Finish tile + tooltip, redesigned Risks chips + tooltip, hero caption spacing"
      contains: "No risks"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "averageForecasts"
      via: "count + sp + time per-metric forecasts with the Tempo calendar"
      pattern: "averageForecasts\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts"
      to: "fetchUserSchedule"
      via: "useQuery queryFn gated on tempoEnabled + jiraUserKey"
      pattern: "fetchUserSchedule\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "deriveProjection"
      via: "active-metric forecast + calendar"
      pattern: "deriveProjection\\([^)]*calendar"
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx"
      to: "section time forecast"
      via: "forecast + calendar props (no local deriveTimeForecast)"
      pattern: "forecast"
---

<objective>
Fifth iteration of the epic detail progress section. The visual language from 261001-ilq is LOCKED: full-width divider layout, hero + stat strip, STATUS_CATEGORY_COLOR, TooltipBody/TooltipRow surface. Refine it, don't restyle it. This iteration covers:
- The headline Finish becomes the average of the Count, SP and Time forecasts.
- Working-day maths honours Tempo holidays.
- The forecast line gets daily hover datapoints.
- Assignee rows become fully hoverable.
- Legend spacing gets more room.
- Every tooltip row gets a leading marker.
- Risks are redesigned.

Purpose: the user's 7 feedback points from 261001-qvu-CONTEXT.md.
Output: one plan with 3 tasks. Each task is one commit (tests + impl together).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/261001-qvu-epic-progress-forecast-averaging-holiday/261001-qvu-CONTEXT.md
@.planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/261001-ilq-SUMMARY.md
@taskflow/src/lib/epic-progress.ts
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
@taskflow/src/components/ui/tooltip-body.tsx
@taskflow/src/services/tempo/schedule.ts

Repo layout: app in `taskflow/`, `.planning/` at the repo root. Run all commands from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Pre-commit hook: biome, `tsc` (includes tests; no `Array.prototype.at`, use `arr[arr.length - 1]`), full vitest. Combine tests and implementation into ONE commit per task. Never use `--no-verify`. Biome baseline drifts, so gate on "no NEW diagnostics in touched files", not on an absolute count. Do NOT fix the fetchAllSearchPages 200-step bug.

EpicDetailSheet.test text-collision rule (carried): no visible standalone text node equal to "Done" / "In Progress" and none containing "Stories". New visible strings in this plan ('No risks', lowercase chip texts) are safe. Tooltip content renders only on hover.

## Interfaces to build (Task 1). Executors in Tasks 2 and 3 consume these exactly.

WorkCalendar (lib/epic-progress.ts):
- `interface WorkCalendar { isWorkingDay(key: string): boolean; holidays: readonly string[]; source: 'tempo' | 'weekends' }`. `holidays` = sorted Mon–Fri date keys that Tempo marks HOLIDAY or NON_WORKING_DAY.
- `DEFAULT_CALENDAR: WorkCalendar`: Mon–Fri, `holidays: []`, `source: 'weekends'`.
- `buildWorkCalendar(schedule: ReadonlyMap<string, string> | null | undefined): WorkCalendar`. The map comes from fetchUserSchedule. A day is working iff it is Mon–Fri AND its map type is not HOLIDAY / NON_WORKING_DAY. Tempo WORKING_DAY on a weekend is ignored (per CONTEXT: "Mon–Fri default, minus Tempo NON_WORKING_DAY/HOLIDAY"). `source` is 'tempo' iff the map is non-empty. An empty or nullish map returns DEFAULT_CALENDAR.
- `holidaysBetween(cal, a, b): number` counts holiday keys d with a < d <= b.
- `addCalendarDays(key, n)`: export the existing private `addDays` under this name (keep the internal usage).

Calendar-aware helpers. Each gets an optional trailing `cal: WorkCalendar = DEFAULT_CALENDAR` parameter, so every existing call and test is unchanged:
- `addWorkingDays(key, n, cal?)`, `workingDaysBetween(a, b, cal?)`, and the private `prevWorkingDay` / `nextWorkingDay`.
- `forecastFromThroughput(input, today, cal?)`, `deriveAdaptiveForecast(stories, metric, spKey, epicCreated, today, cal?)`, `deriveTimeForecast(stories, logs, today, cal?)`.
- `deriveProjection(forecast, today, historyStart, cal?)`.

ProjectionPoint gains `wd: number` (working days from today) and `workingDay: boolean`. `withProjection` output rows gain `wd: number | null` and `workingDay: boolean | null`. History rows are null, the today row gets wd 0, and future rows get the projection values.

Averaging:
- `interface ForecastPart { metric: Metric; forecast: EpicForecast | null; pending?: 'loading' | 'error' }`
- `interface AveragedForecast { state: ForecastState; likely: string | null; optimistic: string | null; pessimistic: string | null; nLikely: number | null; nOpt: number | null; nPess: number | null; confidence: Confidence | null; disagree: boolean; parts: { metric: Metric; forecast: EpicForecast | null; included: boolean; reason: string | null }[]; explanation: string }`
- `averageForecasts(parts: ForecastPart[], today: string, cal?: WorkCalendar): AveragedForecast`
- `METRIC_LABEL: Record<Metric, string> = { count: 'Items', sp: 'Story points', time: 'Time' }`

Risks:
- `type RiskKey = 'overdue' | 'late' | 'stalled' | 'scope' | 'unestimated' | 'unassigned'`
- `interface EpicRisk { key: RiskKey; severity: 'warning' | 'info'; label: string; text: string; count: number | null; detail: string; issueKeys: string[]; moreKeys: number }`. `label` is the tooltip name. `text` is the visible chip text, a single lowercase node.
- `deriveRisks(args: { stories: JiraIssue[]; metric: Metric; spKey: string; finish: AveragedForecast; dueDate: string | null | undefined; today: string }): EpicRisk[]`
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib — injectable working calendar, averaged multi-metric forecast, per-day projection, risk derivation</name>
  <files>taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts</files>
  <behavior>
    Calendar (WED = '2026-09-30', Fri 2026-10-02, Mon 2026-10-05):
    - Default calendar results stay identical. The existing 'addWorkingDays skips weekends' and 'workingDaysBetween ...' tests pass unchanged.
    - Holiday inside the projection: cal = buildWorkCalendar(Map{'2026-10-02': 'HOLIDAY'}). addWorkingDays(WED, 2, cal) === '2026-10-05'. workingDaysBetween(WED, '2026-10-05', cal) === 2. holidaysBetween(cal, WED, '2026-10-05') === 1.
    - Weekend + holiday adjacency: holiday Mon 2026-10-05. addWorkingDays('2026-10-02', 1, cal) === '2026-10-06'. A holiday start day counts from the next working day: addWorkingDays('2026-10-05', 1, cal) === '2026-10-06'.
    - Saturday marked WORKING_DAY by Tempo stays non-working. An empty map gives source 'weekends'. A map with entries gives 'tempo'.
    - Holiday inside the sampling window: 10 consecutive default working days ending WED, one completion (w 1) per day except a Thursday marked HOLIDAY with no completion. With the holiday cal, ratePerWeek === 5. With DEFAULT_CALENDAR on the same input, ratePerWeek < 5.
    - A forecast with the holiday cal gives a likely date one working day later than the default whenever a weekday holiday falls inside (today, likely].
    Averaging (build EpicForecast fixtures by spreading the existing `ok` fixture style):
    - Two ok parts: nLikely 10/20, nOpt 8/16, nPess 14/30, confidences medium/high. The result is nLikely 15, nOpt 12, nPess 22, likely === addWorkingDays(WED, 15). Spread 10 > 0.5 × 15, so disagree is true and confidence = min(medium, high) downgraded = 'low'.
    - Two ok parts with nLikely 5/6, both high: disagree false, confidence 'high'.
    - Count ok (nLikely 10). SP ok with nLikely 0 (unestimated): excluded, reason 'no estimates'. Time with pending 'loading': excluded, reason 'loading worklogs'. The result equals the count numbers and the explanation names Items only.
    - Time reasons: pending 'error' gives 'worklogs unavailable'. A too-early time forecast with completions 0 gives 'no logged time'.
    - No contributor: count stalled + sp too-early + time loading gives state 'stalled' with the stalled explanation. Count not-converging + sp too-early gives 'not-converging'. Count too-early only gives 'too-early'. Count 'done' gives state 'done' even while time is loading.
    - Rounding: nOpt <= nLikely <= nPess always, and all >= 1 when state is ok.
    Projection (intentional test changes, see list):
    - deriveProjection(ok, WED, '2026-09-01') returns one point per calendar day from WED to ok.pessimistic inclusive (13 points). It includes the optimistic, likely and pessimistic dates. points[0] is { forecast: 10, band: [10, 10], wd: 0 }. The likely point has forecast 0 and band [0, 10 - (10/8)*5]. The Sat/Sun points equal the preceding Friday's values with workingDay false. wd is non-decreasing. The invariants (>= 0, band[1] >= band[0]) still hold.
    - With a holiday cal, the holiday point has workingDay false and the same values as the previous day.
    - Clip test unchanged: last date '2026-11-29', clippedAfter '2026-11-29'.
    - Long history (historyStart '2025-01-01', far pessimistic): points.length <= PROJECTION_MAX_POINTS (260). The last date is the cap, and the optimistic and likely dates are still present.
    Risks:
    - The section 'stories' fixture shape: one done story with SP, one in progress, one open unassigned, one open without SP. In 'count' mode this yields exactly 'unestimated' (text '1 unestimated', info) and 'unassigned' (text '1 unassigned', info), with issueKeys containing the right keys.
    - dueDate before today with open work gives 'overdue' (warning, first in order). dueDate after today but before finish.likely gives 'late' (warning). All done gives no overdue or late.
    - Any part forecast 'stalled' gives a 'stalled' warning whose detail is that forecast's explanation. Any 'not-converging' gives a 'scope' warning. Count ok with scopeRatePerWeek >= 0.5 × ratePerWeek (> 0) gives a 'scope' info.
    - issueKeys is capped at 3, with moreKeys = the remainder. Order is warnings first, then info.
  </behavior>
  <action>
Implement in `taskflow/src/lib/epic-progress.ts` per the Interfaces block in context.

(a) Calendar, per CONTEXT "Holidays". Rename the current weekday predicate to a private `isWeekday`. Add WorkCalendar, DEFAULT_CALENDAR, buildWorkCalendar, holidaysBetween and addCalendarDays.
- addWorkingDays keeps the existing weekday fast path to get k. When cal.holidays is non-empty, set extra = holidaysBetween(cal, key, k), then step k forward one day at a time, decrementing extra only on cal.isWorkingDay(k), until extra is 0. Holidays crossed during the extension are skipped naturally.
- workingDaysBetween = the existing weekday count minus holidaysBetween(cal, a, b).
- prevWorkingDay and nextWorkingDay loop on cal.isWorkingDay.
- Thread `cal` through forecastFromThroughput (anchor, offsetOf, final date mapping), deriveAdaptiveForecast, deriveTimeForecast and deriveProjection. Every new parameter is optional and trailing, defaulting to DEFAULT_CALENDAR, so no existing call site or test breaks.
- Update the doc comments: "Mon-Fri" becomes "working days (Mon–Fri minus calendar holidays)".

(b) Per-day projection, per CONTEXT "More forecast datapoints".
- Add `export const PROJECTION_MAX_POINTS = 260`.
- deriveProjection keeps its guards, cap and clip logic. It emits today, then every calendar day d in (today, end], where end = clip(pessimistic). Each point gets wd = workingDaysBetween(today, d, cal) and workingDay = cal.isWorkingDay(d). The forecast and band formulas are unchanged, so non-working days are flat.
- If the day count exceeds PROJECTION_MAX_POINTS - 1, keep every k-th day (k = ceil(days / (PROJECTION_MAX_POINTS - 1))), always add the clipped optimistic, likely and end dates, dedupe by date, and sort by t.
- withProjection copies wd and workingDay for future rows. It sets them on the today row (wd 0, workingDay from the projection's first point) and to null on other history rows. Extend the generic return type accordingly. This also resolves 261001-ilq review IN-02 (weekend slope).

(c) Averaging, per CONTEXT "Forecast = average of Count, SP and Time".
- A part is included iff forecast is non-null, state 'ok', nLikely > 0, and nOpt/nPess/likely are non-null.
- Reason for an excluded part: pending 'loading' gives 'loading worklogs'. pending 'error' gives 'worklogs unavailable'. A null forecast with no pending gives 'unavailable'. ok with nLikely 0 gives 'no estimates'. too-early with metric 'time' and completions 0 gives 'no logged time'. Other too-early gives 'too early to tell'. stalled gives 'stalled'. not-converging gives 'not converging'. done gives 'complete'.
- With at least one included part: nLikely = max(1, round(mean nLikely)). nOpt = min(nLikely, max(1, round(mean nOpt))). nPess = max(nLikely, round(mean nPess)). Dates = addWorkingDays(today, n, cal), never averaged raw calendar dates. confidence = the lowest of the contributors (low < medium < high). disagree = included >= 2 && (max nLikely - min nLikely) > 0.5 × mean nLikely. When disagree, downgrade one level (high to medium, medium to low). explanation = `Average of ${labels joined with ', ' and ' and '} forecasts.` using METRIC_LABEL. Add ' They disagree widely, so confidence is lowered.' when disagree.
- With no included part (fallback): 'done' if any part's forecast is 'done', because Count done means every story is done. Otherwise precedence is stalled > not-converging > too-early, taking state and explanation from the first part in that state. With no usable part at all, return too-early with 'No metric has enough data to project a date.' Date fields are null.
- Add named constants: `AVERAGE_DISAGREE_SPREAD = 0.5`.

(d) Risks, per CONTEXT "Risks nicer". deriveRisks, in order:
- overdue: dueDate is a valid key < today and not all stories done. Warning, label 'Overdue', text 'overdue', count null, detail `Due ${formatDateKey(due)} with ${n} open items.`
- late: not overdue, finish.state 'ok' and finish.likely > due. Warning, label 'Finish after due date', text 'late', detail `Due ${formatDateKey(due)}, forecast ${formatDateKey(likely)}.`
- stalled: any part forecast state 'stalled'. Warning, label 'Stalled', text 'stalled', detail = that forecast's explanation.
- scope: any part 'not-converging' gives a warning. Otherwise the count part being ok with scopeRatePerWeek > 0 and scopeRatePerWeek >= 0.5 × ratePerWeek gives an info risk with detail `+${round1(scope)} items/wk added vs ${round1(rate)}/wk done.` Label 'Scope growing', text 'scope growing'.
- unestimated (info): metric 'time' means open stories with estimateOf === 0, detail 'Open items without a time estimate.' Otherwise stories with spOf === null, using the same population as deriveSummary.unestimatedSp, detail 'Items without story points.' Text `${n} unestimated`, label 'Unestimated'.
- unassigned (info): open stories with no assignee. Text `${n} unassigned`, label 'Unassigned', detail 'Open items with no assignee.'
- issueKeys = the first 3 keys sorted, moreKeys = the rest. Warnings come before info.
- The due date comes from the epic's own `duedate`, which IssueDetailContent already has (JiraIssueDetail.fields.duedate). It is cheap, so overdue/late are in scope.

Tests in `taskflow/src/lib/epic-progress.test.ts`. Add new describes 'work calendar (261001-qvu)', 'averageForecasts', 'deriveProjection per-day points' and 'deriveRisks' covering every behavior bullet.

INTENTIONAL test changes (only these):
1. 'deriveProjection / withProjection' › 'projects today, optimistic, likely and pessimistic with a band': `points.map(p => p.date)` toEqual [WED, opt, likely, pess] is replaced by the 13-calendar-day list (Sep 30..Oct 12) and containment of the 3 key dates. The `points[2]` index for likely becomes `points.find(p => p.date === ok.likely)`. The value and band assertions are kept.
2. Same describe, 'withProjection pins today ...': `toHaveLength(5)` becomes `toHaveLength(14)` (2 history + 12 future days). `merged[2]` is still a null-series future point. Add `merged[1].wd === 0`.
Every other existing assertion in this file must pass untouched, including all forecastFromThroughput case-table tests and the clip test.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts && npx tsc --noEmit && npx biome check src/lib/epic-progress.ts src/lib/epic-progress.test.ts && test "$(grep -c '\.at(' src/lib/epic-progress.ts src/lib/epic-progress.test.ts | awk -F: '{s+=$2} END {print s}')" = "0"</automated>
  </verify>
  <done>All new calendar, averaging, projection and risk tests pass. Only test changes 1–2 were made to existing tests. Existing forecast and helper tests pass unchanged. Committed as `feat(261001-qvu): holiday-aware working calendar, averaged forecast, per-day projection, risks`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: data + section — Tempo calendar query, worklogs in all modes, averaged Finish, Risks redesign, TooltipRow marker API, legend spacing</name>
  <files>taskflow/src/components/ui/tooltip-body.tsx, taskflow/src/components/ui/tooltip-body.test.tsx, taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts, taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx, taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx, taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx</files>
  <behavior>
    - TooltipRow with `color` and no marker renders the same 4 direct children as today; the swatch's style.background is the colour. A row with neither color nor marker renders a visible neutral dot: child[0] has `rounded-full` and a non-transparent background. marker 'line' gives a short horizontal bar in the colour. dashed is unchanged. `icon` renders the icon inside child[0], coloured via style.color. The marker never adds text (rowTexts stay identical everywhere).
    - useEpicWorkCalendar: with tempoEnabled true and auth { jiraBaseUrl, jiraConnected, jiraUserKey: 'u1' }, it calls fetchUserSchedule(baseUrl, 'tok', today-120d, today+182d, 'u1') once. It returns calendar.source 'tempo', and a HOLIDAY weekday in the map is non-working. With tempoEnabled false or no jiraUserKey it never calls and returns DEFAULT_CALENDAR. When fetch rejects, it returns DEFAULT_CALENDAR.
    - The section fetches worklogs once on mount in Count mode, and toggling SP/Time does not refetch (same key).
    - Finish uses the average and is toggle-independent: the ok fixture shows 'Oct 7' and 'medium confidence' in Count AND SP mode. Hovering Finish lists the per-metric rows 'Items', 'Story points' (no estimates) and 'Time', plus the note 'Excludes weekends (holidays unavailable)'.
    - Risks chips show an icon plus a single text node: '1 unestimated' and '1 unassigned' with data-severity="info". A clean epic shows 'No risks'. A due date in the past shows an 'overdue' chip with data-severity="warning". Hovering Risks shows one tooltip row per risk ('Unestimated1', 'Unassigned1') and the issue keys (e.g. 'A-4').
    - Hero caption (data-testid epic-hero-caption) has extra top spacing. The status bar block uses the larger gap.
  </behavior>
  <action>
(a) `tooltip-body.tsx`, per CONTEXT "Tooltip sub-items have a left marker". Extend TooltipRow props with `marker?: 'swatch' | 'dot' | 'line'` and `icon?: ReactNode`, keeping `color`, `dashed`, `label`, `value` and `sub`. The marker stays ONE aria-hidden span as child[0], so existing structure tests hold.
- Default marker is 'swatch' when color is set, 'dot' otherwise.
- swatch: the current `size-2 rounded-[2px]` with background = color.
- dot: `size-2 rounded-full` with background = color ?? 'var(--color-muted-foreground)' plus `opacity-60` when no colour.
- line: `h-0.5 w-2.5 rounded-full` with background = color.
- dashed: unchanged.
- icon: a `flex size-3 shrink-0 items-center justify-center` span with style.color = color holding the icon. Size icons `size-3`.
Update the doc comment. Adoption: rows with no colour (Finish, Remaining, Risks) get the neutral dot automatically. Line series use marker 'line' in Task 3.

(b) `useEpicProgressQueries.ts`:
- useEpicWorklogs keeps its signature. Update its doc comment to "enabled in every mode (Finish averages Time in)".
- Add `useEpicWorkCalendar(today: string): { calendar: WorkCalendar; holidaysAvailable: boolean }`.
- Read auth by destructuring `{ jiraBaseUrl, jiraConnected, jiraUserKey }` from useAuthStore(). Read settings by destructuring `const { tempoEnabled } = useSettingsStore()` and compare `tempoEnabled === true`. Several neighbour test mocks ignore selectors, and this keeps those suites from enabling it.
- from = addCalendarDays(today, -120), to = addCalendarDays(today, 182) (about 26 weeks).
- Query key `['tempo', 'schedule', 'epic-forecast', jiraBaseUrl, from, to, jiraUserKey ?? '']`. This is its own key and does not collide with WorklogsPage's `['tempo','schedule',base,from,to,user]`.
- queryFn: readSecret('jira-pat') (throw 'No credentials' if missing), then fetchUserSchedule(jiraBaseUrl, token, from, to, jiraUserKey), imported from '@/services/tempo' like WorklogsPage.tsx:443.
- staleTime 24h, refetchOnWindowFocus false. enabled = tempoEnabled === true && !!jiraConnected && !!jiraBaseUrl && !!jiraUserKey.
- Return buildWorkCalendar(query.data) and holidaysAvailable = calendar.source === 'tempo'. Failures fall back silently to Mon–Fri.
- New test file `useEpicProgressQueries.test.tsx` uses renderHook plus QueryClientProvider (retry false). It mocks '@/stores/auth.store', '@/stores/settings.store' (mutable state object per test), '@/services/stronghold' and '@/services/tempo' (fetchUserSchedule: vi.fn()), and covers the hook bullets.

(c) `EpicProgressSection.tsx`:
- New prop `epicDueDate?: string | null`. Pass `epicDueDate={issue.fields.duedate}` from IssueDetailContent.tsx at line ~315.
- worklogs: `useEpicWorklogs(epicKey, storyKeys, true)`. Call `useEpicWorkCalendar(toLocalDateString(new Date()))` before the early returns (rules of hooks).
- Compute:
  - countF = deriveAdaptiveForecast(stories, 'count', spKey, epicCreated, today, calendar)
  - spF = deriveAdaptiveForecast(..., 'sp', ..., calendar)
  - timeF = worklogs.data ? deriveTimeForecast(stories, worklogs.data, today, calendar) : null, with pending = worklogs.data ? undefined : worklogs.isError || !worklogs.isFetching ? 'error' : 'loading'.
  - finish = averageForecasts([{metric:'count', forecast: countF}, {metric:'sp', forecast: spF}, {metric:'time', forecast: timeF, pending}], today, calendar).
  - risks = deriveRisks({ stories, metric, spKey, finish, dueDate: epicDueDate, today }).
- The CFD keeps the per-metric forecast (CONTEXT: chart line stays in the active metric's units): metricForecast = metric === 'sp' ? spF : countF, projected with `deriveProjection(metricForecast, today, start, calendar)`.
- Leave EpicTimeBurnup's props as they are in this task (Task 3 rewires them).
- Remove the ForecastStatus plumbing.
- Change the status bar block's `space-y-2` to `space-y-3` (legend spacing).

(d) `EpicProgressSummary.tsx`. New props: `finish: AveragedForecast`, `risks: EpicRisk[]`, `calendar: WorkCalendar`, `today`, `metric`, `summary`, `time`. Drop `forecast`/`forecastStatus` and the exported ForecastStatus type. Section is the only importer; grep to confirm.
- Hero: give the caption span `data-testid="epic-hero-caption"` and `mt-1`. Keep spans only, no p/div inside the button.
- FinishTile reads `finish`. The value/sub logic is identical to today: date + `${opt}–${pess} · ${confidence} confidence` when ok, and state text for done / too-early / stalled / not-converging, with no sub for state texts (keeps 'FinishToo early to tell' / 'FinishComplete' exact).
- Finish tooltip (title 'Projected finish'): when ok, Likely / Earliest / Latest rows with `${n} working days` sub, then one row per part in count, sp, time order. The label is METRIC_LABEL. The value is dateText(part.forecast.likely) when included, otherwise the reason. The sub is the confidence when included. The note is a fragment of two muted lines: finish.explanation, then the calendar line:
  - When calendar.source === 'tempo': `Excludes weekends and ${N} holidays (Tempo)`, where N = holidaysBetween(calendar, addCalendarDays(today, -42), finish.pessimistic ?? today). 42 is about the 30-working-day max window; add a named const HOLIDAY_NOTE_LOOKBACK_DAYS.
  - Otherwise: 'Excludes weekends (holidays unavailable)'.
- Risks tile (CONTEXT "Risks nicer"). Chips: `inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium` + tonePillClass(severity === 'warning' ? 'amber' : 'muted'), with `data-testid="epic-risk-chip"` and `data-severity`. Each chip has an aria-hidden lucide icon (size-3) plus `{r.text}` as ONE text node. Icons: overdue/late CalendarX, stalled Hourglass, scope TrendingUp, unestimated CircleDashed, unassigned UserX. All are verified present in lucide-react. Never use status colours for severity.
- Clean state: `<span className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-muted-foreground">` with CircleCheck (size-4, aria-hidden) and the text 'No risks'.
- Risks tooltip (TooltipBody title 'Risks'): per risk, a TooltipRow with icon = the same icon, color 'var(--color-amber-500)' for warning or 'var(--color-muted-foreground)' for info, label = r.label, value = r.count ?? ''. Under it, a `<div className="pl-5 text-muted-foreground">` with r.detail and, when issueKeys is non-empty, ` · ${issueKeys.join(', ')}${moreKeys ? ` +${moreKeys}` : ''}`. The clean state is one row with icon CircleCheck, label 'No risks found', value ''.

(e) Neighbour suites. Add `fetchEpicWorklogs: vi.fn().mockResolvedValue(new Map())` to the '@/services/jira' mock in IssueDetailContent.test.tsx, IssueDetailPage.progressive.test.tsx and EpicDetailSheet.test.tsx. Worklogs now load in Count mode, so these suites stay hermetic. No assertion changes there.

INTENTIONAL test changes in EpicProgressSection.test.tsx (only these):
3. 'EpicProgressSection time burnup, formulas (261001-hsz)' › 'Count and SP never fetch worklogs' is renamed 'worklogs load once in every mode for the averaged Finish'. It asserts mockWorklogs is called exactly once (waitFor) after toggling SP and Time.
4. 'hero, strip and assignee rows (261001-ilq)' › 'Count and SP never fetch worklogs' gets the same rewrite. Alternatively delete it as a duplicate of 3; record which in the SUMMARY.
5. 'Risks shows amber chips ... or None when clean' is renamed 'Risks shows severity chips ... or No risks when clean'. `getByText('1 unestimated')` and `getByText('1 unassigned')` are kept, plus data-severity="info" on both chips. `queryByText('None')` becomes `queryByText('No risks')`, and `getByText('None')` becomes `getByText('No risks')`.
6. 'review fixes (261001-ilq)' › 'Finish shows "—", not today, when only unestimated work remains in SP mode'. The Finish is now toggle-independent: Count has a stalled pace, so `toContain('—')` becomes `toContain('Stalled')`. It keeps `not.toMatch(/Today/i)` and adds an assertion that the Finish text is identical in Count and SP mode. Intent preserved: unestimated SP never yields today's date. Add a hover check that the Finish tooltip lists 'no estimates' for Story points.
Every other existing test must pass untouched. That includes 'Finish shows a date, range and confidence' (Count is the only contributor in that fixture), 'Finish shows the state text', the Time loading / error / Retry tests (the first worklog call now happens in Count mode; the counts still hold), 'fetches status history once ...', and all rowTexts assertions.

New tests: the behavior bullets above. Use the fake-timer ok fixture for toggle-independence and the hover note. Add a due-date overdue chip test via `epicDueDate={daysAgo(3)}`. Add a Risks tooltip test.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/tooltip-body.test.tsx src/routes/dashboard/issue-detail/useEpicProgressQueries.test.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/EpicProgressCells.test.tsx src/routes/dashboard/EpicsPage.test.tsx && npx tsc --noEmit && npx biome check src/components/ui/tooltip-body.tsx src/routes/dashboard/issue-detail src/routes/dashboard/IssueDetailContent.tsx</automated>
  </verify>
  <done>The Finish tile shows the averaged forecast, independent of the toggle, with per-metric rows and a holiday note in its tooltip. The Tempo calendar feeds every forecast. Worklogs load in all modes. Risks are icon chips with severity, a rich tooltip and a 'No risks' clean state. Every tooltip row has a marker. The legend spacing is increased. Only test changes 3–6 were made to existing tests. Committed as `feat(261001-qvu): averaged finish, Tempo holidays, risks redesign, tooltip row markers`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: charts + rows — per-day forecast hover datapoints in CFD and Time charts, fully hoverable assignee rows</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</files>
  <behavior>
    - EpicChartTooltip on a future datum with `wd: 7, workingDay: true` shows rows ['Forecast2', 'Range1–3.5', 'From today7 working days']. With `workingDay: false`, the third row's sub reads 'non-working day'. A datum without `wd` (the existing test) keeps exactly ['Forecast2', 'Range1–3.5']. The today row (wd 0) shows no 'From today' row.
    - The Remaining row in cfdRows and the Logged and Remaining rows in timeRows use marker 'line'. The existing swatch-colour assertions hold, because the colour stays on child[0]'s style.background.
    - Hovering an assignee row's name text, and separately its chips, opens the tooltip titled with the assignee and the same rows as hovering the bar. Each row still has exactly one `button, [tabindex="0"]` descendant and zero buttons.
    - EpicTimeBurnup no longer calls deriveTimeForecast: it receives `forecast` and `calendar` from the section.
  </behavior>
  <action>
(a) `EpicChartTooltip.tsx`, per CONTEXT "More forecast datapoints on hover":
- ChartDatum gains optional `wd?: number | null` and `workingDay?: boolean | null`. ChartRowSpec gains `marker?: 'swatch' | 'line'`, passed through to TooltipRow.
- In cfdRows, the Remaining row gets marker 'line'. In timeRows, Logged and Remaining get marker 'line' (they are Line series) and Estimate stays a swatch (Area).
- After the Range row, when hasForecast && typeof datum.wd === 'number' && datum.wd > 0, render `<TooltipRow label="From today" value={`${wd} working day${wd === 1 ? '' : 's'}`} sub={datum.workingDay === false ? 'non-working day' : undefined} />`. It gets the neutral dot marker.

(b) EpicCfdChart.tsx and EpicTimeBurnup.tsx: the forecast `<Line>` keeps `dot={false}` and gains `activeDot={{ r: 3, fill: FORECAST_COLOR, stroke: 'var(--color-background)', strokeWidth: 1 }}`, so dots show only on hover. The band Area keeps `activeDot={false}`. Update the CfdChartPoint type to include `wd` and `workingDay` from withProjection. Update the header comments to say there is one projected point per day (flat on non-working days) and that dots appear only on hover.

(c) EpicTimeBurnup:
- Add props `forecast: EpicForecast | null` and `calendar: WorkCalendar`. Remove the local deriveTimeForecast call; this removes the double computation left over from 261001-ilq WR-08.
- Build the projection as `deriveProjection({ ...forecast, remaining: forecast.remaining / HOUR }, today, base[0]?.date ?? null, calendar)` only when forecast is non-null. Without `?.` on an array index, use `base.length > 0 ? base[0].date : null`.
- In the section, pass `forecast={timeF}` and `calendar={calendar}`.

(d) EpicProgressSection assignee rows, per CONTEXT "Fully hoverable assignee rows".
- Keep the outer `<div data-testid="epic-assignee-row" className="text-xs">` wrapper. Its single child is `<Tooltip trackCursorAxis="x"><TooltipTrigger delay={0} render={<div />} data-testid="epic-assignee-trigger" role="img" tabIndex={0} aria-label={...existing bar label...} className="flex items-center gap-2 rounded-sm py-1.5 -my-1.5 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">`.
- The trigger contains the avatar + name span (unchanged classes), the bar `<div data-testid="epic-assignee-bar" className="min-w-0 flex-1">` with no role and no tabIndex holding the existing h-3 bar, and `<AssigneeChips>`. TooltipContent is the existing assigneeTip.
- No nested interactive elements. The chips keep role="img" and their aria-labels, so existing getByLabelText assertions hold. One line per row (no wrapping), per user preference.

Tests:
- EpicChartTooltip.test.tsx: add the 'From today' / non-working / wd 0 cases and a 'line' marker check on the CFD Remaining row (child[0] has class `h-0.5`). Existing assertions are unchanged.
- EpicProgressSection.test.tsx: add 'hovering the assignee name or chips opens the row tooltip' in Time mode. Hover `within(row).getByText('Amy')`, wait for tooltip-content, assert rowTexts equals the existing 5-row list, unhover, then hover the 'logged 1h 30m' chip and assert again.
No existing assertions change in this task. The 'hovering the assignee bar ...' test still hovers `epic-assignee-bar`, which now sits inside the trigger. The one-tab-stop tests still pass because the tab stop is a descendant of the row wrapper.
Note: recharts does not render in jsdom (0-size container). The per-day datapoints are proven by the Task 1 projection tests and the tooltip tests. Hover dots go to UAT.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/lib/epic-progress.test.ts src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail && grep -c "activeDot={{" src/routes/dashboard/issue-detail/EpicCfdChart.tsx src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx && test "$(grep -v '^\s*//' src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx | grep -c 'deriveTimeForecast')" = "0"</automated>
  </verify>
  <done>Both charts carry per-day forecast points with hover-only dots and a 'From today N working days' tooltip row. The Time chart reuses the section's forecast and calendar. Hovering anywhere on an assignee row opens its breakdown, with still one tab stop per row. No existing assertions changed. Committed as `feat(261001-qvu): per-day forecast hover points, fully hoverable assignee rows`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → Tempo (tempo-core/2 schedule) | Authenticated POST with the Jira PAT; the response is untrusted JSON |
| Jira data → UI | Issue keys, names and due date render in tooltips/chips |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-qvu-01 | Information disclosure | useEpicWorkCalendar | mitigate | Token read via readSecret('jira-pat') inside queryFn only, never placed in the query key; key carries baseUrl/date range/userKey only (same as WorklogsPage) |
| T-qvu-02 | Tampering | buildWorkCalendar | mitigate | Only date keys matching validKey (YYYY-MM-DD) and the literal types HOLIDAY / NON_WORKING_DAY are honoured; anything else is ignored → falls back to Mon–Fri |
| T-qvu-03 | Denial of service | deriveProjection / addWorkingDays | mitigate | Projection capped at PROJECTION_MAX_POINTS (260); holiday extension loop is bounded by the holiday count in range |
| T-qvu-04 | Information disclosure / XSS | risk tooltip issue keys, due date | accept | Rendered as React text nodes only (no HTML injection path); data is the user's own Jira data |
</threat_model>

<verification>
- Full pre-commit hook passes on each of the 3 commits (biome, tsc incl. tests, full vitest). No `--no-verify`.
- `grep -rn "\.at(" taskflow/src/lib/epic-progress.ts taskflow/src/routes/dashboard/issue-detail/*.tsx` gives no new matches.
- Existing-test changes are limited to the numbered list 1–6 and the neighbour mock additions in Task 2(e). The SUMMARY lists each one.
- `grep -n "fetchAllSearchPages" -r taskflow/src` shows that function untouched.
</verification>

<success_criteria>
- All 7 user feedback items from CONTEXT are delivered: averaged forecast, Tempo holidays, per-day hover datapoints, fully hoverable rows, legend spacing, tooltip row markers, risks redesign.
- Every locked decision in CONTEXT `<decisions>` is implemented as written: average in working-day offsets, availability rules, the confidence downgrade, worklogs in all modes, the Tempo gate and own key, the holiday note text, the ≤ 260 point cap, one tab stop per row, severity tints that avoid status colours, and the 'No risks' clean state.
- The 261001-ilq visual style is unchanged except where intentionally refined.
- UAT (real Tauri app): hover dots on the forecast line, the Tempo holiday note with a real schedule, risk chip tints in light and dark mode, and row hover highlight.
</success_criteria>

<output>
Create `.planning/quick/261001-qvu-epic-progress-forecast-averaging-holiday/261001-qvu-SUMMARY.md` when done, listing intentional test changes 1–6 (+ neighbour mock additions) and any deviations.
</output>
