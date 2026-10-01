---
phase: quick-261001-hsz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/components/ui/tooltip.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
  - taskflow/src/routes/dashboard/EpicProgressCells.tsx
  - taskflow/src/routes/dashboard/EpicProgressCells.test.tsx
  - taskflow/src/routes/dashboard/EpicsPage.test.tsx
autonomous: true
requirements: [QUICK-261001-hsz]

must_haves:
  truths:
    - "Per-story estimate = sum of its subtask original estimates when > 0, else the story's own original estimate. It is used identically by tiles, status bar, assignee bars, stories-list mini bars and the Time burnup (Estimate formula decision)"
    - "The Estimated tile tooltip explains the formula in plain words, and the Remaining tile tooltip says it replaces Jira's remaining estimate"
    - "Time mode Remaining tile = Σ over open stories of max(estimate − logged, 0)"
    - "In Time mode the burnup plots two series, Estimate and Logged. Logged is cumulative daily worklog time (stories + subtasks). Estimate follows the collapse model: open stories contribute max(estimate, logged so far), done stories contribute their logged so far"
    - "Worklogs load lazily, only when Time is selected, under their own react-query key. While loading, a chart-height skeleton shows. On error, 'Couldn't load worklogs' and a Retry button show, and the tiles still render"
    - "Burnup hover in every mode shows a visible dashed vertical cursor and a tooltip with the full date (with year) and metric-formatted values. In Time mode it also shows a Remaining row"
    - "Hovering anywhere on the status bar or an assignee bar opens ONE tooltip with the full per-segment breakdown"
    - "Hovering the epics-list quick-peek bar opens a shared Tooltip with the Done / In Progress / To Do counts and SP. Native title is gone"
    - "Each Stories-list row shows a compact logged-vs-estimate mini bar, with overrun shown distinctly, and a tooltip (estimate, logged, remaining, formula note). The row stays one line"
    - "The progress section has no Card. It spans the full width, separated by top and bottom borders with generous vertical padding, and the skeleton matches"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchEpicWorklogs fetcher, timeoriginalestimate field on fetchEpicStories/JiraIssue, generic fetchAllWorklogPages"
      exports: ["fetchEpicWorklogs", "EpicWorklogDay"]
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "estimateOf, loggedOf, collapse-model deriveTimeBurnup, new remaining formula"
      exports: ["estimateOf", "loggedOf", "deriveTimeBurnup", "deriveTimeTotals", "ESTIMATE_FORMULA_NOTE"]
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx"
      provides: "Lazy Time-mode worklog query and Estimate/Logged burnup chart"
      contains: "jira-epic-worklogs"
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      provides: "Non-card full-width section, whole-bar tooltips, Time mode wiring"
      contains: "border-t"
    - path: "taskflow/src/routes/dashboard/EpicProgressCells.tsx"
      provides: "Quick-peek bar with shared Tooltip"
      contains: "TooltipTrigger"
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Per-story mini time bar in the Stories list, epicKey passed to section"
      contains: "story-time-bar"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx"
      to: "fetchEpicWorklogs"
      via: "useQuery queryFn"
      pattern: "fetchEpicWorklogs\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx"
      to: "deriveTimeBurnup"
      via: "lib call on query data"
      pattern: "deriveTimeBurnup\\("
    - from: "taskflow/src/lib/epic-progress.ts weightOf"
      to: "estimateOf"
      via: "metric === 'time' branch"
      pattern: "estimateOf\\(s\\)"
    - from: "taskflow/src/services/jira.ts fetchEpicWorklogs"
      to: "fetchAllSearchPagesConcurrent + fetchAllWorklogPages"
      via: "chunked search plus truncated-worklog top-up"
      pattern: "fetchAllSearchPagesConcurrent\\("
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "estimateOf / loggedOf"
      via: "mini bar computation"
      pattern: "estimateOf\\("
---

<objective>
This is the third iteration of the epic detail progress section, following the 261001-g5q UAT feedback. It covers:
1. Worklog-based Time burnup using the estimate-collapse model.
2. A per-story estimate formula (subtasks if any, else the story's own estimate) with a tooltip that explains it.
3. Tooltips that work on every progress bar: burnup crosshair, epics-list quick peek, whole-bar status/assignee tooltips, and new Stories-list mini bars.
4. A non-card, full-width layout with dividers.

Purpose: the user wants Time progress to reflect daily logged work, with estimates collapsing into logged time when a story is done. They want a transparent estimate formula, and hover info on every bar.

Output: a new fetcher, lib math with tests, a new lazy child chart component, the reworked section, quick-peek tooltip, and Stories-list mini bars.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/261001-hsz-epic-progress-time-burnup-from-worklogs-/261001-hsz-CONTEXT.md
@.planning/quick/261001-hsz-epic-progress-time-burnup-from-worklogs-/261001-hsz-RESEARCH.md (authoritative for algorithm, fetcher, tooltip fix and test pitfalls)
@taskflow/src/lib/epic-progress.ts
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
@taskflow/src/components/ui/tooltip.tsx

<interfaces>
Existing (verified by the planner):
- `epic-progress.ts`:
  - `Metric = 'count'|'sp'|'time'`
  - private `secOf(s, key: SecKey)`, where SecKey is the 3 aggregate fields. Add `'timeoriginalestimate'`.
  - `weightOf` (the time branch currently returns the aggregate OE)
  - `doneDateKey(s, today)`
  - `deriveBurnup(stories, metric, spKey, epicCreated, today)`. It has an inline axis builder: daily if span ≤ 31, else weekly + today.
  - `StatusBucket.seconds`
  - `AssigneeBucket.logged/estimate`
  - `deriveTimeTotals(stories)`. It currently returns remaining = Σ aggregatetimeestimate.
  - `formatMetric`
  - private `validKey`, `labelOf`, `addDays`, `diffDays`
- `jira.ts`:
  - `fetchEpicStories`, line ~2685. Its fields Set already has the 3 aggregate fields.
  - Module-private `fetchAllSearchPagesConcurrent(baseSearchUrl, headers)` (line 372). It appends `&maxResults&startAt`.
  - `fetchAllWorklogPages(baseWorklogUrl, headers)` (line 440). It appends `?maxResults=200&startAt=`, never throws, and is typed `{author?:{displayName?}}`. Its only other caller is `fetchIssueWorklogs` (line 1646).
  - `SUBTASK_CHUNK_SIZE = 50` (289), `PAGE_CONCURRENCY = 6` (292).
  - JiraIssue fields type: aggregate fields at line ~182. A second JiraIssue-like fields type sits at ~1755 and only needs a change if tsc requires it.
- `jira.test.ts` mocks `@tauri-apps/plugin-http` fetch (line 35). Follow that pattern.
- Credentials pattern (IssueDetailSheet.tsx:78-91):
  - `const { jiraBaseUrl, jiraConnected } = useAuthStore()` from `@/stores/auth.store`.
  - `readSecret('jira-pat')` from `@/services/stronghold`.
- Section today: `const today = toLocalDateString(new Date())` (line 131).
- IssueDetailContent:
  - Renders `<EpicProgressSection stories={epicStories} storyPointsFieldKey epicCreated />` at line ~307. It has `issueKey` in scope.
  - The Stories list rows are `<button>`s at ~326-353, with key, then summary (flex-1 truncate), then assignee, then statusPillClass span.
- EpicProgressCells.tsx `EpicProgressCell`:
  - The ready state is a `div` bar with `title` + `data-testid="epic-progress-bar"`, followed by a `done/total` span.
  - `counts` = `{ total, done, inProgress, todo, points, donePoints }`.
- `tooltip.tsx` exports Tooltip (Root passthrough), TooltipTrigger (default delay 150), and TooltipContent.
- Recharts `ChartTooltipContent` `formatter(value, name, item, index, payload)` receives the full data point.
</interfaces>

<intentional_test_changes>
These existing expectations change ON PURPOSE. Each one must be updated, not weakened elsewhere, and each must be listed in the SUMMARY:
1. EpicProgressCells.test.tsx, "EPIC-05: breakdown title carries per-status counts on hover". The `toHaveAttribute('title', '5 Done · 3 In Progress · 2 To Do')` becomes `await user.hover(getByTestId('epic-progress-bar'))` followed by `findByText` of the tooltip breakdown. The retry-button `title` asserts at lines 61 and 100 stay unchanged.
7. EpicsPage.test.tsx:171-173, "EPIC-03/EPIC-05: renders the segmented breakdown …". The `toHaveAttribute('title', '5 Done · 3 In Progress · 2 To Do')` becomes `await user.hover(screen.getByTestId('epic-progress-bar'))` (userEvent.setup()) followed by `expect(await screen.findByText('5 Done')).toBeInTheDocument()`, plus '3 In Progress' and '2 To Do'. The '5/10' assertion stays unchanged.
2. EpicProgressSection.test.tsx, "wraps the section and skeleton in a Card". It now asserts there is NO `[data-slot="card"]` in either the region or the skeleton. The region carries the border-t/border-b dividers, and the `epic-progress-skeleton` testid still exists.
3. EpicProgressSection.test.tsx, "hovering a status segment shows …". It now hovers the whole bar (the `epic-status-bar` testid, which moves to the tooltip trigger wrapper) instead of a segment.
4. EpicProgressSection.test.tsx, "hovering an assignee name shows the breakdown". It now hovers the assignee bar trigger (`epic-assignee-bar`). Name and value become plain text.
5. EpicProgressSection.test.tsx, "… gives each assignee row one tab stop". It now counts `button, [tabindex="0"]` per row, which must be exactly 1: the bar trigger. The row no longer contains a `<button>`.
6. EpicProgressSection.test.tsx, "Time mode shows Estimated / Logged / Remaining / % logged tiles". The Remaining expectation changes from Σ aggregatetimeestimate to Σ open max(estimate − logged, 0). Time-mode tests also render inside a QueryClientProvider with the worklog fetcher, auth store and readSecret mocked.
</intentional_test_changes>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: fetchEpicWorklogs + estimate formula + collapse-model time burnup in the lib</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts, taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts</files>
  <behavior>
    - jira.test.ts: the existing fetchEpicStories fields test also expects 'timeoriginalestimate'.
    - jira.test.ts fetchEpicWorklogs:
      - (a) Story keys are chunked at 50. 120 keys produce 3 search calls, each with JQL `key in (...) OR parent in (...)`, fields including worklog, parent, issuetype.
      - (b) Subtask worklogs roll up under fields.parent.key, and a story's own logs go under its own key.
      - (c) A top-up GET `/rest/api/2/issue/{key}/worklog` happens ONLY when worklog.total > worklogs.length.
      - (d) If the top-up returns fewer entries than embedded, the embedded list is kept.
      - (e) Each entry is `{ day: started.slice(0,10), seconds: timeSpentSeconds }`, and entries with a non-finite or ≤ 0 timeSpentSeconds are dropped.
      - (f) Empty storyKeys gives an empty Map with no fetch.
      - (g) A non-ok search response rejects (fail-closed).
    - estimateOf:
      - own 3600, agg 10800 gives 7200 (subtasks).
      - own 3600, agg 3600 gives 3600 (no subtask estimates, so own).
      - own undefined, agg 7200 gives 7200 (old fixtures still valid).
      - All null gives 0. Negative or NaN coerces to 0.
    - loggedOf = aggregatetimespent ?? 0.
    - weightOf(s, 'time') === estimateOf(s). deriveStatusBuckets.seconds and deriveAssigneeBuckets.estimate use estimateOf. assignee logged uses loggedOf.
    - deriveTimeTotals: estimated = Σ estimateOf, logged = Σ loggedOf, remaining = Σ over non-done stories of max(estimateOf − loggedOf, 0), pctLogged unchanged semantics.
    - deriveTimeBurnup(stories, logs, epicCreated, today) returns TimeBurnupPoint[] `{date,label,estimate,logged}` in seconds:
      - Intermediate logs on an open story raise Logged while Estimate stays at its estimate.
      - A done story's Estimate collapses to its logged-so-far from its done date.
      - An overrun on an open story raises Estimate to logged.
      - A log dated before story creation starts the story at the log day, so Estimate ≥ Logged on every point.
      - A future-dated log is clamped to today.
      - Done with zero logs drops that story's estimate to 0 at its done date.
      - Invariant: on every point estimate ≥ logged, and on the final point estimate − logged equals deriveTimeTotals(...).remaining when worklog sums equal aggregatetimespent.
      - A story with null or invalid `created` and no logs is counted from the axis start (startDay fallback). On a fixture mixing it with a dated story, the final estimate − logged still equals deriveTimeTotals(...).remaining.
      - A story with invalid `created` but with logs starts at its first log day.
      - No story has a created day or a log, and epicCreated is invalid: returns [].
    - The existing deriveBurnup tests keep passing unchanged after the axis helper is extracted.
  </behavior>
  <action>
Per the CONTEXT "Estimate formula" and "Time burnup model" decisions, with the RESEARCH §1-§3 algorithms.

(a) jira.ts:
- Add `timeoriginalestimate?: number | null` (seconds, story's own) to the JiraIssue fields type next to the aggregate fields. Add `'timeoriginalestimate'` to the fetchEpicStories fields Set. This is a field add only. Do not touch its JQL or its fetchAllSearchPages call, per the shared-fetcher-key memory. Do NOT fix the fetchAllSearchPages 200-step bug, which is out of scope.
- Make fetchAllWorklogPages generic: `<T = JiraWorklog>` returning `T[]`. Import JiraWorklog from './jira/types' if it isn't already imported. fetchIssueWorklogs must still compile unchanged.
- Export `interface EpicWorklogDay { day: string; seconds: number }`.
- Export `async function fetchEpicWorklogs(baseUrl, token, storyKeys: string[]): Promise<Map<string, EpicWorklogDay[]>>`:
  - Chunk storyKeys by SUBTASK_CHUNK_SIZE.
  - For each chunk, run `fetchAllSearchPagesConcurrent` with JQL `key in (c) OR parent in (c)` (encodeURIComponent) and `fields=worklog,parent,issuetype`. Use the concurrent helper, NOT fetchAllSearchPages, so failures propagate and the UI shows retry.
  - For issues whose `fields.worklog.total > worklogs.length`, run the top-up with fetchAllWorklogPages on `${base}/rest/api/2/issue/${key}/worklog` with no query string. Bound concurrency at PAGE_CONCURRENCY using a simple worker loop over a queue. Keep the longer of embedded vs top-up.
  - Roll up into the map: the target key is `fields.parent?.key` when that key is in the storyKeys set, else the issue's own key if it is in the set, else skip.
  - Add a JSDoc noting the 20-embedded-worklog cap.
  - The worklog field typing on JiraIssue can be a local narrow cast inside the fetcher. Do not widen the global JiraIssue type with worklog.

(b) epic-progress.ts:
- Extend SecKey with 'timeoriginalestimate'.
- Export `estimateOf(s)`: subSum = max(0, (aggOE ?? 0) − (ownOE ?? 0)), return subSum > 0 ? subSum : (ownOE ?? 0).
- Export `loggedOf(s)`.
- Export `const ESTIMATE_FORMULA_NOTE = 'Per story: sum of its subtask estimates; stories without estimated subtasks use their own estimate.'`. It is the single source for the tooltip copy.
- Route weightOf's time branch, StatusBucket.seconds, and AssigneeBucket.estimate/logged through estimateOf/loggedOf.
- Rewrite deriveTimeTotals.remaining as described in the behavior block.
- Extract the date-axis builder from deriveBurnup into a private `buildAxis(start, today): string[]`, used by both burnup functions.
- Export `interface TimeBurnupPoint { date; label; estimate; logged }` and `deriveTimeBurnup(stories, logs: Map<string, EpicWorklogDay[]>, epicCreated, today)`, implementing RESEARCH §3:
  - Per-story sorted, clamped, validKey-filtered logs.
  - startDay = min of the non-null values of (createdDay, firstLogDay).
  - Axis start = min(epicCreated day, all non-null startDays). Return [] only when that set is empty.
  - Fallback: a story whose startDay is null (no valid created and no logs) gets startDay = axis start. It is counted on every point, so every story in deriveTimeTotals is also in the chart and the final gap always equals the Remaining tile.
  - For each date: L_s(d), then Logged = Σ L_s, and Estimate = Σ over started stories of (done by d ? L_s : max(estimateOf, L_s)).
- Import the EpicWorklogDay type from '@/services/jira' (type-only import).
- No Array.prototype.at; use index access.

(c) Tests:
- Extend the `st()` fixture in epic-progress.test.ts with optional `own` (timeoriginalestimate). Existing time fixtures, which only set `est`, must keep passing unchanged.
- Write the tests and the implementation together and commit them in ONE commit: `feat(261001-hsz): worklog fetcher and collapse-model time burnup`. The pre-commit hook runs biome + tsc + the full vitest suite. Never use --no-verify, and retry once on the known WorklogsPage flake.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts src/services/jira.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>
- All behaviors above are covered by passing tests.
- tsc is clean, and fetchIssueWorklogs still compiles against the generic helper.
- fetchEpicStories requests timeoriginalestimate and nothing else changed in it.
- The work lands in one commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Section rework: non-card layout, lazy Time burnup child, crosshair, whole-bar tooltips, formula tooltips</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/components/ui/tooltip.tsx (only if Root does not already forward trackCursorAxis), taskflow/src/routes/dashboard/IssueDetailContent.tsx (epicKey prop only)</files>
  <behavior>
    - The region "Epic progress" contains no [data-slot="card"]. Its className contains border-t and border-b. The skeleton (testid epic-progress-skeleton) also has no card slot and no region role.
    - Count/SP: the burnup and tiles are unchanged, and no worklog fetch happens (the fetchEpicWorklogs mock is not called).
    - Clicking Time:
      - First renders a testid epic-time-burnup-loading skeleton.
      - On success it renders testid epic-time-burnup, and the fetcher was called with the story keys.
      - On reject it shows "Couldn't load worklogs" and a Retry button. Clicking Retry calls the fetcher again. The 4 Time tiles are visible in every state.
    - Time tiles:
      - Remaining uses the new formula.
      - Hovering or focusing the Estimated tile shows ESTIMATE_FORMULA_NOTE text.
      - The Remaining tile tooltip mentions it replaces Jira's remaining estimate.
    - Status bar:
      - Hovering testid epic-status-bar (the trigger wrapper) shows every non-zero status line with name, value and percent.
      - Segments remain testid epic-status-segment children, and zero-value statuses are still omitted.
    - Assignee row:
      - Hovering testid epic-assignee-bar shows the full name and the done / in progress / to do breakdown in the active metric. In Time mode it also shows logged / estimate.
      - Each row has exactly one focusable element (the bar, tabIndex 0, with an aria-label summary) and no button.
    - Legend items are plain non-focusable text, and the visible 'In Review · 1 · 5 SP' text is unchanged.
    - All other existing section tests pass. The intentional changes 2-6 in the context are applied.
  </behavior>
  <action>
Per the CONTEXT "Separation / layout", "Time burnup model" and "Tooltips" decisions 1 and 3, and RESEARCH §1 (react-query wiring), §4 and §5.

(a) Create EpicTimeBurnup.tsx, exporting `EpicTimeBurnup({ epicKey, stories, epicCreated, today })`:
- `useQuery` with key `['jira-epic-worklogs', epicKey, jiraBaseUrl]`.
  - The queryFn reads the token via readSecret('jira-pat') (throws without credentials) and calls fetchEpicWorklogs(jiraBaseUrl, token, stories.map(s => s.key)).
  - `enabled: jiraConnected && !!jiraBaseUrl && stories.length > 0`, `staleTime: 60_000`.
  - Use the useAuthStore + readSecret pattern from IssueDetailSheet.tsx:78-91.
- States:
  - Loading: a Skeleton at the chart height with testid epic-time-burnup-loading.
  - Error: inline muted text "Couldn't load worklogs" plus `<button type="button">Retry</button>` that calls refetch.
  - Success: deriveTimeBurnup(stories, data, epicCreated, today), mapped to hours (`/3600`), rendered in a ChartContainer (testid epic-time-burnup).
- Chart: use the same explicit height, "use no memo" and isAnimationActive={false} conventions as the section's existing burnup.
  - Config `{ estimate: { label: 'Estimate', color: gray/muted }, logged: { label: 'Logged (from worklogs)', color: green } }`. Estimate is an Area and Logged is a Line.
  - Y-axis ticks are `${n}h`.
- Tooltip: ChartTooltip with `cursor={{ stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' }}`, the labelFormatter showing MMM d, yyyy (reuse the section's), and a formatter that renders swatch + label + formatDuration(value*3600).
  - For name 'logged' it also renders a full-width "Remaining" row computed from payload.estimate − payload.logged.
  - The Estimate legend/caption carries ESTIMATE_FORMULA_NOTE via a small caption under the chart, plus the note that done stories collapse to their logged time.
- Do NOT add worklog invalidations to FieldsSection/SprintBoardTab. Done dates come from the already-invalidated jira-epic-stories data, so the collapse stays fresh.

(b) EpicProgressSection.tsx:
- Add the required prop `epicKey: string`, and pass `epicKey={issueKey}` from IssueDetailContent.tsx. That one-line edit is the only IssueDetailContent change in this task.
- Layout:
  - Remove Card/CardHeader/CardContent and the card import.
  - The outer element is `<section aria-label="Epic progress" className="border-t border-b border-border py-5 my-6 space-y-5">` with no horizontal inset.
  - The header row is a flex justify-between with the `<h3>Progress</h3>` and the toggle.
  - Tiles are flat, without per-tile ring: `grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3`. Keep data-testid epic-stat-tile and the Tile button tooltip mechanism.
  - Rebuild EpicProgressSkeleton with the same geometry: border-t/b, py-5, my-6, header row, 4 tile skeletons, chart block.
- Time mode: render `<EpicTimeBurnup …/>` in place of the count/SP burnup (only mounted when metric === 'time' and estimated > 0; keep the existing "No time estimated" guard). Count/SP burnup gets the same dashed cursor prop.
- Tiles:
  - The Estimated tile tip is ESTIMATE_FORMULA_NOTE plus the duration.
  - The Remaining tip says "Open stories: estimate minus logged, never below 0. Replaces Jira's remaining estimate so it matches the chart."
  - Logged and % logged tips stay as they are.
- Whole-bar tooltips (RESEARCH §4 fix):
  - The status bar trigger is `<TooltipTrigger delay={0} render={<div …/>}>` wrapping the h-3 track. It carries `data-testid="epic-status-bar"`, `className="py-1.5 -my-1.5"`, `tabIndex={0}` and an aria-label summary. The Tooltip root gets `trackCursorAxis="x"`.
  - Segments become plain child divs, keeping testid epic-status-segment, width style and zero-value omission. The content is one line per non-zero bucket: dot, name, formatMetric(value), pct.
  - Legend items become plain spans with the identical visible text.
  - Each assignee row is the same shape: name is a plain `w-32 flex-none truncate pr-0.5` span with no tooltip trigger. The bar wrapper is the trigger (testid epic-assignee-bar, `bg-muted` visible track, tabIndex 0, aria-label). The right-hand value is plain text, and in Time mode it reads `logged / estimate`.
  - Tooltip content covers the full name and the done/in progress/to do breakdown via formatMetric. In Time mode it also covers logged / estimate.
  - Rows stay one line.
- Text-collision rules (EpicDetailSheet.test.tsx):
  - No visible text node containing capital "Stories", or equal to exactly "Done" or "In Progress". Use lowercase in sentences.
  - Tooltip popups only mount when open.

(c) Tests:
- Add a `renderTimed`-style helper that wraps in `QueryClientProvider` (retry: false) and use it for every Time-mode test.
- Mock fetchEpicWorklogs via `vi.mock('@/services/jira', async (orig) => ({ ...(await orig()), fetchEpicWorklogs: vi.fn() }))`.
- Mock `@/stores/auth.store` so useAuthStore works both called bare and with a selector, returning `{ jiraBaseUrl: 'https://jira.test', jiraConnected: true }`.
- Mock `@/services/stronghold` readSecret to resolve 'tok'.
- Add the new behavior tests and apply intentional changes 2-6 from the context exactly.
- Then also run EpicDetailSheet.test.tsx, IssueDetailContent.test.tsx and IssueDetailPage.progressive.test.tsx. If something breaks there on a collision or a button count, fix the component, not the old assertion.
- Run biome check on the touched files and fix new diagnostics (gate on no new findings).
- Commit in ONE commit: `feat(261001-hsz): epic progress time burnup, full-width layout, whole-bar tooltips`. Never use --no-verify.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/lib/epic-progress.test.ts && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx src/routes/dashboard/issue-detail/EpicProgressSection.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</automated>
  </verify>
  <done>
- The section is full width with dividers and no Card.
- Time mode lazily loads worklogs and shows the Estimate/Logged burnup with a crosshair and a Remaining row, plus loading and error/retry states.
- Status and assignee bars have one whole-bar tooltip each.
- The Estimated/Remaining tooltips explain the formulas.
- Count/SP never fetch worklogs.
- Intentional test changes 2-6 are applied and the neighbouring suites are green.
- The work lands in one commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Quick-peek tooltip in EpicProgressCells + Stories-list per-story mini time bars</name>
  <files>taskflow/src/routes/dashboard/EpicProgressCells.tsx, taskflow/src/routes/dashboard/EpicProgressCells.test.tsx, taskflow/src/routes/dashboard/EpicsPage.test.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx</files>
  <behavior>
    - EpicProgressCell ready state:
      - testid epic-progress-bar has no title attribute.
      - `await user.hover(epic-progress-bar)` shows lines "5 Done", "3 In Progress", "2 To Do" and an SP line `${donePoints} of ${points} SP done`.
      - Segment width tests, the '5/10' label, the pending/error/zero states and the retry title asserts are unchanged.
      - This is intentional change 1. EpicsPage.test.tsx EPIC-03/EPIC-05 asserts the same breakdown by hover (intentional change 7).
    - Stories list:
      - Each row renders a testid story-time-bar span before the status pill. The fill width is min(logged/estimate, 1)*100%.
      - When logged > estimate the fill uses an overrun color class (for example bg-red-500), and the bar carries data-overrun="true".
      - With no estimate, the track is muted with no fill and data-empty="true".
      - Hovering story-time-bar shows "Estimate {d}", "Logged {d}", "Remaining {d}" and ESTIMATE_FORMULA_NOTE.
      - Remaining is max(est − logged, 0) for open stories and 0 for done-category stories (catOf(story) === 'done'). This matches the collapse model and the Remaining tile. Test it with a done story that has est 2h and logged 1h: its tooltip shows "Remaining 0m". With no estimate it shows "No estimate" and Logged.
      - The row's button is still the only interactive element: the story-time-bar is a span with no tabindex and no nested button.
      - Clicking the row still calls onOpenIssue.
  </behavior>
  <action>
Per CONTEXT Tooltips decisions 2 and 4, and RESEARCH §4 (quick-peek and mini bar).

(a) EpicProgressCells.tsx:
- Wrap the ready-state bar in `<Tooltip><TooltipTrigger delay={0} render={<div …/>}>`, moving `data-testid="epic-progress-bar"` and the bar classes onto the rendered div.
- Add `py-1 -my-1` (or an outer padded wrapper) for a larger hit area, and remove `title`.
- The TooltipContent lists `${done} Done`, `${inProgress} In Progress`, `${todo} To Do`, and `${donePoints} of ${points} SP done`, one per line.
- Change nothing else: states, retry, and EpicPointsCell stay as they are.
- The row in EpicsPage is a div onClick, so hover reaches it.

(b) IssueDetailContent.tsx Stories list:
- Inside each row `<button>`, before the status pill, render `<Tooltip><TooltipTrigger delay={0} render={<span …/>}>`. It must be a span, because a div or the default button would nest inside the row button.
- Classes: `relative inline-flex h-1.5 w-16 flex-none overflow-hidden rounded-full bg-muted`, with `data-testid="story-time-bar"`.
- Inside it, a child span fill with width min(logged/est,1)*100%. Use the normal color (statusCategoryDotClass('done') or bg-emerald-500) and an overrun color (bg-red-500 plus data-overrun="true") when logged > est.
- Compute remaining as `catOf(story) === 'done' ? 0 : Math.max(est - logged, 0)`, which mirrors deriveTimeTotals.
- Use estimateOf/loggedOf/catOf/ESTIMATE_FORMULA_NOTE from '@/lib/epic-progress' and formatDuration from '@/services/jira/duration'.
- No visible text, so there are no collisions with "Stories"/"Done" assertions. One row stays one line, and the status pill keeps its flex parent (the row button).

(c) Tests:
- Update EPIC-05 per intentional change 1 (userEvent.setup + hover + findByText).
- Update EpicsPage.test.tsx:171-173 per intentional change 7. Grep `taskflow/src` for any other `'title'` assertion on epic-progress-bar and convert it the same way.
- Add the mini-bar tests to IssueDetailContent.test.tsx, using its existing epic render setup and adding fixture time fields.
- If IssueDetailContent.test.tsx has no epic-stories render path, add a minimal one there.
- Run biome on the touched files.
- Commit in ONE commit: `feat(261001-hsz): quick-peek and story mini-bar tooltips`. Never use --no-verify.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/EpicProgressCells.test.tsx src/routes/dashboard/EpicsPage.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/EpicProgressCells.tsx src/routes/dashboard/IssueDetailContent.tsx</automated>
  </verify>
  <done>
- The quick-peek bar uses the shared Tooltip with no native title.
- Stories-list rows show a mini logged-vs-estimate bar that shows overruns and has a tooltip with the formula note.
- There is no nested interactive element.
- Intentional changes 1 and 7 are applied, all listed suites pass, and the work lands in one commit.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira REST -> client | Issue keys, worklog timestamps/seconds, and names from the user's own Jira server |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hsz-01 | Tampering | fetchEpicWorklogs JQL | mitigate | Keys come from the Jira response and are placed in JQL inside encodeURIComponent, same as the sprint subtask chunk query; the chunk size of 50 bounds URL length |
| T-hsz-02 | Tampering | deriveTimeBurnup / estimateOf | mitigate | Non-finite or negative seconds coerce to 0 or are dropped; invalid `started` is dropped via validKey; future days are clamped to today |
| T-hsz-03 | Information disclosure / XSS | Tooltip content | mitigate | Jira strings are rendered as React text children only, never dangerouslySetInnerHTML |
| T-hsz-04 | Denial of service | Worklog top-ups | mitigate | Top-ups happen only for truncated issues and are bounded by PAGE_CONCURRENCY; the query is lazy (Time mode only) with staleTime 60s |
| T-hsz-SC | Tampering | package installs | accept | No new packages |
</threat_model>

<verification>
- cd taskflow && npm run test (full suite; also enforced by the pre-commit hook on each of the 3 commits)
- npx tsc --noEmit clean (no Array.prototype.at)
- grep confirms fetchEpicStories JQL is unchanged: `git diff HEAD~3 -- taskflow/src/services/jira.ts | grep -c '"Epic Link"'` returns 0
- SUMMARY lists intentional test changes 1-7 verbatim, including 7, and notes UAT must hover the bars in the real Tauri/WKWebView app (jsdom cannot prove WebKit hover)
</verification>

<success_criteria>
- The Time burnup shows Estimate and Logged under the collapse model from lazily loaded worklogs (stories + subtasks), with a crosshair and a Remaining row.
- One estimate formula (subtasks if any, else story) drives tiles, bars, mini bars and the chart, and the tooltips explain it.
- Tooltips work on the burnup, status bar, assignee bars, quick-peek bar and story mini bars.
- The section is full width with top and bottom dividers and no Card, and the skeleton matches.
- 3 commits, each with tests and implementation together, and the full suite is green.
</success_criteria>

<output>
Create `.planning/quick/261001-hsz-epic-progress-time-burnup-from-worklogs-/261001-hsz-SUMMARY.md` when done
</output>
