---
phase: quick-261103-kvp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/time-progress.ts
  - taskflow/src/lib/time-progress.test.ts
  - taskflow/src/components/jira/StackedTimeBar.tsx
  - taskflow/src/components/jira/StackedTimeBar.test.tsx
  - taskflow/src/routes/my-tasks/MyTaskRow.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/TimeTrackingSummary.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/WorklogProgressBar.tsx
  - taskflow/src/routes/dashboard/issue-detail/WorklogProgressBar.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/aggregateTimeTracking.ts
  - taskflow/src/routes/dashboard/issue-detail/aggregateTimeTracking.test.ts
autonomous: true
requirements: [QUICK-261103-kvp]

must_haves:
  truths:
    - "A closed issue with spent 2h / original 4h (Jira remaining=0, aggregateprogress.percent=100) shows a 50% GREEN bar in the issue-detail sidebar, not a full bar"
    - "Every time-tracking bar (My Tasks rows, standup Today rows, issue-detail sidebar, issue-detail Worklog bar) fills by spent / ORIGINAL estimate"
    - "spent > estimate is red regardless of status; spent == estimate is green when done, amber when not done; under estimate is green when done, green <75% / amber >=75% when not done"
    - "A done issue with no original estimate shows no bar (each component's existing no-estimate rendering) - remaining estimate is never used as the estimate on a done issue"
  artifacts:
    - path: "taskflow/src/lib/time-progress.ts"
      provides: "timeProgress({ spentSeconds, estimateSeconds, isDone }) -> { fillPct, indicatorClass, overrun }"
      exports: ["timeProgress"]
    - path: "taskflow/src/lib/time-progress.test.ts"
      provides: "colour matrix tests"
  key_links:
    - from: "StackedTimeBar.tsx, TimeTrackingSummary.tsx, WorklogProgressBar.tsx"
      to: "lib/time-progress.ts"
      via: "import { timeProgress }"
      pattern: "timeProgress\\("
    - from: "TimeTrackingSummary.tsx"
      to: "aggregateprogress"
      via: "MUST NOT be referenced"
      pattern: "aggregateprogress"
---

<objective>
Time-tracking progress bars show FULL on closed issues because Jira zeroes the remaining estimate on close and the bars derive progress from remaining (or from Jira's `aggregateprogress.percent` = spent/(spent+remaining)). Route every time-tracking bar through one shared pure helper that fills by spent / ORIGINAL estimate and colours honestly by done-state (locked decisions 1-6 from the orchestrator).

Output: `taskflow/src/lib/time-progress.ts` + tests; StackedTimeBar, TimeTrackingSummary, WorklogProgressBar (and aggregateTimeTracking) rewired; callers thread `isDone`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/CLAUDE.md

Repo root (.planning, git) = /Users/mimo/Documents/Projects/taskflow. App (src, npm, vitest, biome) = /Users/mimo/Documents/Projects/taskflow/taskflow. All `src/...` paths below are under the inner app dir.

Grep sweep result (decision 5, already done by planner): the only time-tracking bars in the app are
- `src/components/jira/StackedTimeBar.tsx` — callers: `src/routes/my-tasks/MyTaskRow.tsx:214`, `src/routes/standup-notes/TodayInProgressSection.tsx:141`, `src/routes/standup-notes/TodayUpNextSection.tsx:145`. All callers already pass ORIGINAL estimate (MyTasksPage.accumulateTime sums `originalEstimateSeconds`; standup passes `timetracking.originalEstimateSeconds`) — only `isDone` must be threaded.
- `src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx` (rendered by `FieldsSection.tsx:1268`) — uses `aggregateprogress.percent` and falls back to `aggregatetimeestimate` / `remainingEstimateSeconds`.
- `src/routes/dashboard/issue-detail/WorklogProgressBar.tsx` (rendered by `IssueDetailView.tsx:584` with the full `issue`) + `aggregateTimeTracking.ts` — falls back to remaining per issue/subtask.
Other `<Progress>` users (BulkProgressIndicator) and epic/AIO/release/status bars are NOT time-tracking — leave alone. `MyTasksPage.tsx` needs no change.

Interfaces:
- MyTaskRow has `const statusCategoryKey = issue.fields.status.statusCategory?.key;` (line 142).
- Standup rows have `issue.fields.status.statusCategory?.key` in scope (used for statusPillClass).
- FieldsSection has `f = issue.fields` in scope with `f.status`.
- Subtask enrichment (`fetchEnrichedSubtasks`, services/jira.ts ~2096) returns `fields.status: { name; statusCategory: unknown }` alongside `timetracking`.
- Existing colour classes: `bg-green-500`, `bg-amber-500`, `bg-red-500` (StackedTimeBar + TimeTrackingSummary append ` rounded-full`; WorklogProgressBar does not).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared timeProgress helper + StackedTimeBar and its callers (My Tasks, standup)</name>
  <files>src/lib/time-progress.ts, src/lib/time-progress.test.ts, src/components/jira/StackedTimeBar.tsx, src/components/jira/StackedTimeBar.test.tsx, src/routes/my-tasks/MyTaskRow.tsx, src/routes/standup-notes/TodayInProgressSection.tsx, src/routes/standup-notes/TodayUpNextSection.tsx</files>
  <behavior>
    time-progress.test.ts (decision 1, 6):
    - no estimate (undefined / 0 / negative): fillPct 0, indicatorClass undefined, overrun false
    - not done, spent 1h / est 4h (25%): fillPct 25, bg-green-500
    - not done, 3h / 4h (75%): bg-amber-500 (threshold inclusive); 2.9h/4h (~73%): green
    - not done, 4h / 4h: fillPct 100, bg-amber-500, overrun false ("time exhausted, still not done")
    - not done, 3.99h / 4h (rounds to 100, not exceeding): amber, overrun false
    - done, 2h / 4h: fillPct 50, bg-green-500; done 3.5h / 4h (88%): green (not amber)
    - done, 4h / 4h: fillPct 100, bg-green-500
    - over (done AND not done), 5h / 4h: fillPct 100 (capped), bg-red-500, overrun true
    - spent 0 with estimate: fillPct 0, green
    StackedTimeBar.test.tsx additions: isDone + spent 2h / total 4h -> progressbar indicator has bg-green-500 and ~50% fill; not done + spent==total -> bg-amber-500 (not red); spent > total -> bg-red-500. Keep the 3 existing tests passing. Inspect how the Progress primitive (src/components/ui/progress.tsx) exposes value/indicator to pick a stable assertion (aria-valuenow or indicator class/style).
  </behavior>
  <action>
    Create `src/lib/time-progress.ts` exporting `timeProgress({ spentSeconds, estimateSeconds, isDone }: { spentSeconds: number; estimateSeconds: number | null | undefined; isDone: boolean }): { fillPct: number; indicatorClass: string | undefined; overrun: boolean }` per locked decision 1: when estimate is not a positive number return `{ fillPct: 0, indicatorClass: undefined, overrun: false }`; otherwise fillPct = min(100, round(spent / estimate * 100)) (clamp below at 0); overrun = spent > estimate -> 'bg-red-500'; else if fillPct >= 100 -> isDone ? 'bg-green-500' : 'bg-amber-500'; else if isDone -> 'bg-green-500'; else fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500'. Return bare colour classes (no rounded-full) so each caller keeps its own shape classes. Add a short doc comment stating fill is ALWAYS spent vs ORIGINAL estimate, never remaining / Jira aggregateprogress (Jira zeroes remaining on close), and the colour matrix. Also export a tiny `isDoneStatus(statusCategoryKey: unknown): boolean` (true iff === 'done') per decision 3 so callers don't re-inline the predicate.

    StackedTimeBar: add optional prop `isDone?: boolean` (default false), replace its inline fillPct/indicatorColor computation with `timeProgress({ spentSeconds, estimateSeconds: totalSeconds, isDone })`, appending ' rounded-full' to the returned class when defined. Keep the spacer/alwaysShowTrack/caption behaviour unchanged. Update the doc comment on the prop.

    Callers (decision 3, row's OWN status for parent rows): MyTaskRow passes `isDone={isDoneStatus(statusCategoryKey)}`; TodayInProgressSection and TodayUpNextSection pass `isDone={isDoneStatus(issue.fields.status.statusCategory?.key)}` on their StackedTimeBar. Do not change the spent/total values these callers pass (they already use original estimate).

    Write tests and implementation together and commit once (pre-commit runs the full vitest suite; no RED-only commit). Run biome only on touched files, never `biome --write` over all of src.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/time-progress.test.ts src/components/jira/StackedTimeBar.test.tsx src/routes/my-tasks src/routes/standup-notes && npx tsc --noEmit -p . && npx biome check src/lib/time-progress.ts src/lib/time-progress.test.ts src/components/jira/StackedTimeBar.tsx src/components/jira/StackedTimeBar.test.tsx src/routes/my-tasks/MyTaskRow.tsx src/routes/standup-notes/TodayInProgressSection.tsx src/routes/standup-notes/TodayUpNextSection.tsx</automated>
  </verify>
  <done>Helper exists with full colour-matrix tests passing; StackedTimeBar computes fill/colour only via timeProgress; all three callers pass isDone from the row's own status; tsc + biome clean on touched files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Issue detail — TimeTrackingSummary and WorklogProgressBar use original estimate + timeProgress</name>
  <files>src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx, src/routes/dashboard/issue-detail/TimeTrackingSummary.test.tsx, src/routes/dashboard/issue-detail/FieldsSection.tsx, src/routes/dashboard/issue-detail/WorklogProgressBar.tsx, src/routes/dashboard/issue-detail/WorklogProgressBar.test.tsx, src/routes/dashboard/issue-detail/aggregateTimeTracking.ts, src/routes/dashboard/issue-detail/aggregateTimeTracking.test.ts</files>
  <behavior>
    TimeTrackingSummary.test.tsx:
    - REGRESSION (decision 6): isDone, aggregatetimespent 7200, aggregatetimeoriginalestimate 14400, aggregatetimeestimate 0 -> bar at 50%, bg-green-500, caption "2h / 4h" (if the test file currently passes aggregateprogress, drop it — the prop no longer exists).
    - not done, original absent, aggregatetimeestimate 14400, spent 3600 -> falls back to remaining: bar at 25%, caption "1h / 4h" (existing fallback test keeps working, with isDone false).
    - done, original absent everywhere, remaining 14400, spent 3600 -> NO bar, shows existing "Spent: 1h" + "No estimate" rendering.
    - not done, spent == original -> bg-amber-500 (was red); spent > original -> bg-red-500 with fill capped at 100.
    - Delete/replace the "uses aggregateprogress.percent when present" test.
    aggregateTimeTracking.test.ts:
    - with opts.isDone true, own remainingEstimateSeconds is NOT used when original is absent (estimate 0).
    - subtask whose fields.status.statusCategory.key === 'done' with only remainingEstimateSeconds contributes 0 estimate; a not-done subtask still falls back to remaining (existing tests keep passing with isDone false).
    WorklogProgressBar.test.tsx: make makeIssue accept an optional statusCategoryKey (fields.status.statusCategory.key); add: done issue spent 2h / original 4h -> green, ~50%; not done spent == estimate -> bg-amber-500; update the existing "red when spent >= estimate" test to spent > estimate (spent == estimate not-done is now amber).
  </behavior>
  <action>
    TimeTrackingSummary (decisions 2, 4): add required prop `isDone: boolean`; REMOVE the `aggregateprogress` prop and its use entirely (only FieldsSection passes it; the field type in services/jira types stays untouched). Resolve estimate as: `aggregatetimeoriginalestimate` ?? `timetracking.originalEstimateSeconds` first; only when !isDone fall back to `aggregatetimeestimate` ?? `timetracking.remainingEstimateSeconds`; else 0. Compute fill/colour via `timeProgress({ spentSeconds: spent, estimateSeconds: estimate, isDone })`, appending ' rounded-full'. Keep the three render branches (No time logged / bar+caption / Spent + No estimate) unchanged. Rewrite the doc comment paragraph about `aggregateprogress.percent` to say: fill is spent vs ORIGINAL estimate via the shared timeProgress helper; Jira's aggregateprogress / remaining estimate are deliberately not used because Jira zeroes remaining on close, which made closed issues show a full bar; remaining is only an estimate fallback for not-done issues. Also fix the colour description in the header comment to match the new matrix.

    FieldsSection.tsx (~line 1268): drop `aggregateprogress={f.aggregateprogress}`, add `isDone={isDoneStatus(f.status?.statusCategory?.key)}` (import from '@/lib/time-progress').

    aggregateTimeTracking (decision 2): extend opts to `{ isSubtask: boolean; isDone?: boolean }`. Own estimate: original, falling back to remaining only when !opts.isDone. Extend `SubtaskWithTimeTracking.fields` with optional `status?: { statusCategory?: unknown }`; per subtask, fall back to remaining only when that subtask is not done (read key defensively: statusCategory is `unknown` from enrichment — narrow via a typeof-object check, then use isDoneStatus) AND the parent is not done. Update the doc comment bullet about the remaining fallback.

    WorklogProgressBar: derive `isDone = isDoneStatus(issue.fields.status?.statusCategory?.key)` from the issue it already receives (no IssueDetailView change), pass it to aggregateTimeTracking opts, and replace inline fillPct/indicatorColor with `timeProgress(...)`. Keep the Epic / no-estimate `return null` behaviour. Update the header comment's "color thresholds" mention to reference the shared helper.

    Tests + implementation in one commit. biome only on touched files.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/routes/dashboard/IssueDetailPage.progressive.test.tsx && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx src/routes/dashboard/issue-detail/TimeTrackingSummary.test.tsx src/routes/dashboard/issue-detail/FieldsSection.tsx src/routes/dashboard/issue-detail/WorklogProgressBar.tsx src/routes/dashboard/issue-detail/WorklogProgressBar.test.tsx src/routes/dashboard/issue-detail/aggregateTimeTracking.ts src/routes/dashboard/issue-detail/aggregateTimeTracking.test.ts && test "$(grep -v '^\s*\*' src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx | grep -c aggregateprogress)" = "0"</automated>
  </verify>
  <done>Closed issue with remaining=0 and spent&lt;original shows partial green fill in the sidebar and Worklog bar; aggregateprogress no longer referenced in code; remaining estimate used only for not-done issues/subtasks; issue-detail tests pass; tsc + biome clean on touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira REST -> UI | Numeric time-tracking fields rendered as bar width/caption |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kvp-01 | Tampering | timeProgress | accept | Pure display math on already-typed numbers; fill clamped 0-100, non-positive estimate returns no bar; no new data flow, network call, or package |
</threat_model>

<verification>
- `cd taskflow && npx vitest run` full suite green (pre-commit enforces it).
- `grep -rn "timeProgress(" taskflow/src --include='*.tsx'` shows StackedTimeBar, TimeTrackingSummary, WorklogProgressBar.
- No remaining inline `bg-red-500` threshold ternaries in those three components.
</verification>

<success_criteria>
All time-tracking bars fill by spent / original estimate and use the shared colour matrix; closed issues no longer show a full bar unless spent >= original; full vitest suite, tsc and biome (touched files) pass.
</success_criteria>

<output>
Create `.planning/quick/261103-kvp-time-tracking-progress-bars-reflect-actu/261103-kvp-SUMMARY.md` when done
</output>
