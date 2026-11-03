---
phase: quick-261103-lcd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
autonomous: true
requirements: [QUICK-261103-lcd]

must_haves:
  truths:
    - "In Time mode the epic Completed % moves when time is logged on open stories (logged time counts as done work)"
    - "In Time mode the Remaining tile uses Jira's remaining estimate (aggregatetimeestimate) for open stories, falling back to max(estimate - logged, 0) when Jira has none"
    - "Hero caption 'X of Y' in Time mode reads completed work of forecast total (logged + remaining), and Remaining tile == forecast total - completed == deriveTimeTotals.remaining"
    - "A story that only has a remaining estimate (Tempo-style, no original estimate) is not reported as unestimated and contributes estimate = remaining + logged"
    - "Count and SP modes produce exactly the same numbers as before"
    - "The Stories list row tooltip's Remaining row uses the same per-story remaining as the epic tiles"
    - "Time burnup's final-day gap (estimate - logged) still equals the Remaining tile"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "remainingOf, timeWeightOf, bandsOf; time-aware estimateOf/weightOf/deriveSummary/deriveAssigneeBuckets/deriveTimeTotals/deriveTimeBurnup"
      exports: ["remainingOf", "timeWeightOf", "bandsOf", "estimateOf", "loggedOf", "weightOf"]
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      provides: "Updated REMAINING_NOTE text"
      contains: "remaining estimate"
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Stories row remaining via remainingOf"
      contains: "remainingOf(story)"
  key_links:
    - from: "deriveSummary (time mode)"
      to: "bandsOf / remainingOf"
      via: "per-story band split"
      pattern: "bandsOf\\("
    - from: "deriveTimeTotals.remaining"
      to: "remainingOf"
      via: "sum over stories"
      pattern: "remainingOf\\(s\\)"
    - from: "IssueDetailContent Stories row"
      to: "remainingOf"
      via: "import from @/lib/epic-progress"
      pattern: "remainingOf\\(story\\)"
---

<objective>
Fix the epic detail Time-mode numbers so they reflect real progress: logged time and Jira's
remaining estimate must drive Completed %, the hero caption, the Remaining tile, assignee/status
bars and the Stories-row tooltip — not the original estimate alone.

Root cause (verified in code):
1. `weightOf(s,'time')` returns `estimateOf(s)` (original estimate only), so Completed % =
   done stories' estimate / total estimate; logging time on open stories never moves it.
2. `deriveTimeTotals.remaining` = Σ open max(estimate − logged, 0); Jira's `aggregatetimeestimate`
   is fetched by `fetchEpicStories` (services/jira.ts ~3310) and listed in `SecKey` but never read.
3. `estimateOf(s) === 0` (deriveSummary.unestimatedTime, deriveRisks 'unestimated' ~line 1583)
   flags Tempo-style stories that only carry a remaining estimate.
4. IssueDetailContent.tsx ~317 recomputes remaining inline as est − logged.

Purpose: Time mode must answer "how much is done / how much is left" truthfully.
Output: updated time model in epic-progress.ts with tests; text/consumer updates in the UI.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/lib/epic-progress.ts
@taskflow/src/routes/dashboard/issue-detail/aggregateTimeTracking.ts

Repo layout: `.planning/` and git live at outer `taskflow/`; npm/vitest/biome/tsc run inside the
inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Pre-commit hook runs the FULL vitest suite and blocks failing commits: tests + implementation go
in ONE commit per task, and any test elsewhere whose expectations shift because of the model
change must be updated in the same commit. Use `git commit -- <paths>` and check `git log -1`
(a failed hook can leave files staged). Scope biome to touched files only (never `biome --write`
on all of src). Fixtures use placeholder keys/names only.

## Data model (decided — implement exactly)

All in `taskflow/src/lib/epic-progress.ts`. Seconds everywhere. `secOf` already rejects
non-finite / negative values.

- `originalOf(s)` (new, NOT exported): the current body of `estimateOf` (subtask-sum of original
  estimates when any, else own original estimate).
- `jiraRemaining(s)` (new, NOT exported): `secOf(s, 'aggregatetimeestimate')` — number or null.
- `estimateOf(s)` (changed): `originalOf(s)` when > 0; otherwise, for NOT-done stories whose
  `jiraRemaining(s)` is > 0, return `jiraRemaining(s) + loggedOf(s)` (reconstructs the Tempo-style
  estimate: what is left plus what was spent); otherwise 0. Done stories never use the remaining
  fallback (Jira zeroes remaining on close) — same convention as aggregateTimeTracking.ts, but
  remaining+logged rather than remaining alone so a partly-logged Tempo story does not shrink its
  own estimate. Document this in the JSDoc.
- `remainingOf(s)` (new, exported): 0 when `catOf(s) === 'done'`; else `jiraRemaining(s)` when it is
  not null (trust Jira, including an explicit 0); else `max(estimateOf(s) − loggedOf(s), 0)`.
- `timeWeightOf(s)` (new, exported) = the story's forecast total:
  done → `loggedOf(s) > 0 ? loggedOf(s) : estimateOf(s)` (closing an unlogged story still counts);
  open → `loggedOf(s) + remainingOf(s)`.
  Note: for an open story without Jira remaining this equals max(estimate, logged), so the existing
  `weightOf time` tests (est only / bad values → 0 / own+agg subtask case) keep passing.
- `weightOf(s,'time',…)` returns `timeWeightOf(s)`. Count and SP branches untouched.
- `bandsOf(s, metric, spKey): Bands` (new, exported): Count/SP → the whole `weightOf` goes into the
  band of `catOf(s)` (done / inProgress for 'indeterminate' / todo for 'new') — identical to today.
  Time → done story: `{ done: timeWeightOf(s), inProgress: 0, todo: 0 }`; open story:
  `{ done: loggedOf(s), inProgress|todo: remainingOf(s) }` (remaining goes into the band of its
  category). Chosen split: done band = completed work (done stories' weight + time logged on open
  stories); in-progress / to-do bands = what is left on stories in that category. Therefore for any
  story set: done+inProgress+todo == Σ timeWeightOf, and inProgress+todo == Σ remainingOf.
  (`Bands` interface is declared further down the file; TS interface hoisting makes that fine.)

Consumers inside epic-progress.ts:
- `deriveSummary`: `total += weightOf(...)`; band totals come from `bandsOf` (doneTotal +=
  b.done, inProgressTotal += b.inProgress, todoTotal += b.todo) for every story, including open
  ones (in time mode an open story adds its logged time to doneTotal; doneCount is unchanged —
  counts stay status-based). Keep the existing `continue` structure for count fields, unestimated,
  unassigned. `remainingSeconds` = `deriveTimeTotals(stories).remaining`. pctDone formula
  unchanged (allDone → 100). Result: Remaining tile (time) == inProgressTotal + todoTotal ==
  remainingSeconds. For Count/SP every field must equal current output.
- `deriveAssigneeBuckets`: add `bandsOf` result to done/inProgress/todo; `remaining` stays
  inProgress+todo; `logged`/`estimate` fields keep loggedOf / estimateOf (estimate stays the
  labelled "estimate").
- `deriveStatusBuckets`: unchanged code (value = weightOf, so time value = forecast total;
  `seconds` stays estimateOf as its doc says).
- `deriveTimeTotals`: estimated = Σ estimateOf, logged = Σ loggedOf, remaining = Σ remainingOf,
  pctLogged unchanged (logged / estimated — an overrun signal vs the estimate). Do not add new
  fields (summary.total already is the forecast total).
- `deriveTimeBurnup`: per item, `est` = for NOT-done stories with `jiraRemaining(s) !== null`:
  `loggedOf(s) + remainingOf(s)`; otherwise `estimateOf(s)` (keeps today's behaviour byte-identical
  for stories without a Jira remaining, so existing burnup tests hold). Rest of the function
  unchanged; update the doc comment: open-story estimate line = max(current forecast total, logged
  so far) so the final gap == Remaining tile.
- `deriveTimeForecast` doc comment: remaining = Jira remaining estimate (fallback estimate −
  logged). Code unchanged (it already uses deriveTimeTotals.remaining).
- `deriveRisks` 'unestimated' and `deriveSummary.unestimatedTime` keep `estimateOf(s) === 0`;
  the estimateOf fallback fixes the Tempo case automatically.
- `deriveCfd` / `deriveAdaptiveForecast`: no code change (CFD is skipped in time mode;
  adaptive forecast is count/sp only).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Time model — remainingOf / timeWeightOf / bandsOf and time-aware aggregates</name>
  <files>taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</files>
  <behavior>
    Use the existing `st()` fixture helper (`est` = aggregate original, `own`, `spent`, `rem` =
    aggregatetimeestimate, `cat`). New describe block 'time model (261103-lcd)':
    - remainingOf: done → 0 even with rem 3600; open with rem 1800, est 7200, spent 600 → 1800;
      open with rem 0, est 3600 → 0 (explicit Jira 0 is trusted); open no rem, est 3600, spent 600 →
      3000; open no rem, est 3600, spent 7200 → 0.
    - estimateOf Tempo fallback: open { rem: 3600, spent: 1800 } (no est/own) → 5400; done
      { rem: 3600 } → 0; open { rem: 0, spent: 600 } → 0; original present wins: open
      { est: 7200, rem: 1800 } → 7200.
    - timeWeightOf: done { est: 3600, spent: 5400 } → 5400; done { est: 3600 } (no log) → 3600;
      open { est: 7200, spent: 1800, rem: 3600 } → 5400; open { est: 3600 } → 3600.
    - bandsOf count/sp: same placement as before (done sp 3 → {done:3,...}; 'indeterminate'
      count → {inProgress:1}); time open 'indeterminate' { est: 7200, spent: 1800, rem: 3600 } →
      { done: 1800, inProgress: 3600, todo: 0 }; time done { est: 3600, spent: 5400 } →
      { done: 5400, inProgress: 0, todo: 0 }.
    - deriveSummary time: stories [done {est 3600, spent 5400}, indeterminate {est 7200, spent
      1800, rem 3600}, new {est 3600}] → total 14400, doneTotal 7200, inProgressTotal 3600,
      todoTotal 3600, pctDone 50, remainingSeconds 7200 (== inProgressTotal + todoTotal).
    - Logging time on an open story raises pctDone: same story set with the open story's spent
      raised and rem lowered accordingly yields a higher pctDone.
    - Count/SP invariance: for the existing `deriveSummary` describe's `stories` array plus a
      timed variant, `deriveSummary(...,'count'|'sp',SP)` and `deriveAssigneeBuckets(...,'count'|'sp',SP)`
      produce the same values as the existing expectations (existing tests must pass untouched).
    - deriveSummary unestimatedTime: open { rem: 3600 } (Tempo-only) is NOT counted; open {} is.
    - deriveRisks 'unestimated' does not include an open story with only rem > 0 and no SP
      (follow the existing deriveRisks test setup in this file).
    - deriveTimeTotals: open { est: 14400, spent: 3600, rem: 7200 } → remaining 7200 (Jira wins
      over 10800).
    - deriveTimeBurnup: an open story { est 4h, spent 1h, rem 2h } with a 1h worklog → last point
      estimate − logged === deriveTimeTotals(stories).remaining (2h); follow the existing
      'deriveTimeBurnup (261001-hsz)' fixtures/helpers for logs and dates.
    Update the existing 'assignee buckets ... weight by estimate in time mode' test to the new
    band model: A done { est 3600, spent 1800 }, B open { est 7200, spent 600 } → time bucket
    { estimate: 10800, logged: 2400, done: 2400, todo: 6600, remaining: 6600 }; rename the test
    to say it weights by completed/remaining time. Count bucket expectation unchanged.
  </behavior>
  <action>
    Implement the data model exactly as specified in the context section (originalOf, jiraRemaining,
    estimateOf fallback, remainingOf, timeWeightOf, weightOf time branch, bandsOf, deriveSummary,
    deriveAssigneeBuckets, deriveTimeTotals, deriveTimeBurnup est per item, doc comments for
    deriveTimeBurnup / deriveTimeForecast / estimateOf / TimeTotals.remaining). Export
    remainingOf, timeWeightOf and bandsOf. Do NOT change Count/SP code paths' results.
    Write the behavior tests above in taskflow/src/lib/epic-progress.test.ts (add the new
    exports to its import list) and make them pass.
    Then run the EpicProgressSection component tests: the 'time metric, card and tooltips
    (261001-g5q)' fixture (T-1 done est 3600 spent 5400 rem 0; T-2 new est 7200 rem 3600) now
    yields total 9000 / done 5400 → '60%' and caption '1h 30m of 2h 30m' (confirm exact string
    from formatDurationCompact output); update those hero expectations (around lines 318-322 and
    any other time-mode hero/remaining/assignee number assertions that the new model shifts, e.g.
    ~524) with a short comment explaining the arithmetic. Do not touch the REMAINING_NOTE text
    assertions (task 2). Only change expectations whose shift you can explain from the model;
    if a failure is unexplained, investigate rather than rewrite the assertion.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow &amp;&amp; npx vitest run src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail/ src/routes/dashboard/release-detail/ &amp;&amp; npx tsc --noEmit &amp;&amp; npx biome check src/lib/epic-progress.ts src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</automated>
  </verify>
  <done>
    New tests pass; all pre-existing Count/SP expectations in epic-progress.test.ts and
    release-detail tests pass unchanged; time-mode summary satisfies done+inProgress+todo == total
    and inProgress+todo == remainingSeconds == deriveTimeTotals.remaining; tsc clean; one commit
    `fix(261103-lcd): epic time mode counts logged time and Jira remaining estimate`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UI consumers — Remaining note text and Stories-row remaining</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx</files>
  <behavior>
    - Remaining tile tooltip shows exactly one line:
      'Open items · Time = Jira remaining estimate, else estimate − logged' (update the two
      assertions at ~532 and ~1272 in EpicProgressSection.test.tsx; still zero tooltip rows).
    - Stories row (IssueDetailContent.test.tsx, 'story-time-bar' describe): extend the local
      `epicStory` fixture with an optional `rem` → `aggregatetimeestimate`. New cases:
      open { est 7200, spent 1800, rem 3600 } → rows ['Estimate2h', 'Logged30m', 'Remaining1h'];
      Tempo-only open { spent 3600, rem 7200 } (no est) → bar not data-empty, rows
      ['Estimate3h', 'Logged1h', 'Remaining2h']. Existing cases (no rem) keep their expectations,
      including 'Over by replaces Remaining (never both)'.
  </behavior>
  <action>
    EpicProgressSummary.tsx: change REMAINING_NOTE to
    'Open items · Time = Jira remaining estimate, else estimate − logged' (single line,
    no new tooltip rows — ≤4-row tooltip rule). No other UI change in the hero/tiles.
    EpicProgressSection.tsx: update the `assigneeBands` doc comment (~line 130) to describe the
    time unit as completed (logged / closed) vs remaining seconds instead of "estimate seconds".
    No layout/colour changes.
    IssueDetailContent.tsx (~314-317): import `remainingOf` from '@/lib/epic-progress' and set
    `const remaining = remainingOf(story)`; drop the inline catOf/est−logged math (remove the
    `catOf` import only if it becomes unused). Keep the existing row rules: Remaining row shown
    when est > 0 and not overrun; Over by replaces Remaining. Keep one row = one line; no new
    elements.
    Write the behavior tests first in the same commit, then implement.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow &amp;&amp; npx vitest run src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx &amp;&amp; npx tsc --noEmit &amp;&amp; npx biome check src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/issue-detail/EpicProgressSummary.tsx src/routes/dashboard/issue-detail/EpicProgressSection.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</automated>
  </verify>
  <done>
    Remaining tooltip shows the new single line; Stories-row Remaining uses remainingOf (Jira
    remaining wins, Tempo-only story shows a non-empty bar with Estimate = remaining + logged);
    full suite green via the pre-commit hook; one commit
    `fix(261103-lcd): stories row and remaining note use Jira remaining estimate`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira REST → client | Numeric time-tracking fields (aggregatetimeestimate etc.) arrive untyped |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261103-lcd-01 | Tampering | secOf in epic-progress.ts | mitigate | All new reads go through `secOf`, which rejects non-number / NaN / Infinity / negative values so bad Jira data yields 0, never NaN in tiles |
| T-261103-lcd-02 | Information Disclosure | test fixtures | accept | Placeholder keys/names only; no customer data |
</threat_model>

<verification>
- `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run` green.
- `npx tsc --noEmit` clean; biome check on touched files reports nothing new.
- Grep: `grep -n "remainingOf(story)" src/routes/dashboard/IssueDetailContent.tsx` matches;
  `grep -n "Math.max(est - logged" src/routes/dashboard/IssueDetailContent.tsx` returns nothing.
- Count/SP expectations in epic-progress.test.ts, EpicProgressSection.test.tsx and
  release-detail tests unchanged.
</verification>

<success_criteria>
- Time-mode Completed % = completed work / (logged + remaining) and moves when time is logged.
- Remaining tile (time) = Σ Jira remaining estimate on open stories, falling back to
  max(estimate − logged, 0); equals the hero's total − done and the burnup final gap.
- Tempo-only stories count as estimated.
- Count and SP numbers unchanged.
</success_criteria>

<output>
Create `.planning/quick/261103-lcd-epic-detail-time-numbers-consider-remain/261103-lcd-SUMMARY.md` when done
</output>
