---
phase: quick-260929-fnq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/my-tasks-sort.ts
  - taskflow/src/lib/my-tasks-sort.test.ts
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
autonomous: true
requirements: [QUICK-260929-fnq]

must_haves:
  truths:
    - "A story assigned to someone else, whose status name contains 'review' (case-insensitive), and which has at least one of my subtasks appears in a new My Day band labelled 'In Review — my subtasks' (D-01, D-03)"
    - "The new band renders between 'In Review with my MR' and 'In Progress' (D-01)"
    - "A qualifying story is lifted into the new band even when my subtask is In Progress, To Do or Done (D-02 subtree-min)"
    - "Flagged/blocked, overdue, or my-MR on the parent or any subtask still wins over the new band (D-02)"
    - "My own stories in review without my open MR still land in 'In Progress' (D-05, unchanged)"
    - "A done-category parent whose status contains 'review' (e.g. 'Reviewed') stays in 'Done' (D-03 must not qualify for done)"
  artifacts:
    - path: "taskflow/src/lib/my-tasks-sort.ts"
      provides: "7-band MY_DAY_BANDS, isForeignReviewWithMySubtask predicate, band-3 lift in groupByMyDay"
      contains: "in-review-my-subtasks"
      exports: ["MY_DAY_BANDS", "classifyBand", "subtreeBand", "groupByMyDay", "isForeignReviewWithMySubtask", "IN_REVIEW_MY_SUBTASKS_BAND", "DONE_BAND"]
    - path: "taskflow/src/lib/my-tasks-sort.test.ts"
      provides: "Renumbered index assertions + new-band cases"
      contains: "in-review-my-subtasks"
    - path: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      provides: "Label + indigo dot for the new band; maps typed Record<MyDayBand, string>"
      contains: "In Review — my subtasks"
  key_links:
    - from: "taskflow/src/lib/my-tasks-sort.ts groupByMyDay Pass 3"
      to: "isForeignReviewWithMySubtask"
      via: "Math.min(bandIndex, IN_REVIEW_MY_SUBTASKS_BAND) when predicate true and parent's own band is > 3 and != DONE_BAND"
      pattern: "isForeignReviewWithMySubtask\\("
    - from: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      to: "MyDayBand type"
      via: "MY_DAY_BAND_LABELS / MY_DAY_BAND_DOT typed Record<MyDayBand, string> so a missing key is a compile error"
      pattern: "Record<MyDayBand, string>"
---

<objective>
Add a My Day band "In Review — my subtasks" to the My Tasks page for stories that are in review, not assigned to me, but contain at least one of my subtasks. Implements locked decisions D-01..D-05 from 260929-fnq-CONTEXT.md (IDs assigned in order of the Decisions section: D-01 band position after in-review-my-mr / before in-progress; D-02 participates in subtree-min with higher bands winning; D-03 parent-level qualification rules; D-04 label with em dash + distinct dot color; D-05 own stories in review without my MR unchanged; plus the discretion item that hardcoded indices shift, done becomes 6).

Purpose: Today such stories fall into "In Progress" because classifyBand's band 2 requires my own open MR on the issue key, which never matches a story I do not own.
Output: Updated pure sort lib + tests, updated page label/dot maps.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260929-fnq-add-my-tasks-section-for-in-review-stori/260929-fnq-CONTEXT.md
@.planning/quick/260929-fnq-add-my-tasks-section-for-in-review-stori/260929-fnq-RESEARCH.md
@taskflow/src/lib/my-tasks-sort.ts
@taskflow/src/lib/my-tasks-sort.test.ts
@taskflow/src/routes/my-tasks/MyTasksPage.tsx

<interfaces>
Current (my-tasks-sort.ts):
- MY_DAY_BANDS = ['flagged-blocked','overdue','in-review-my-mr','in-progress','to-do','done'] as const; type MyDayBand
- classifyBand(issue, flaggedFieldKey, myOpenMRIssueKeys, today=new Date()): number — returns 0,1,2,3(in-progress),4(to-do),5(done)
- subtreeBand(parent, subtasks, flaggedFieldKey, myOpenMRIssueKeys, today): number — Math.min(parentBand, ...subtaskBands, 5)
- groupByMyDay(issues, myIssueKeys, flaggedFieldKey, myOpenMRIssueKeys, today) — Pass 1 split subtasks by parent key, Pass 2 eligibility (parent mine OR has my subtasks), Pass 3 `const bandIndex = subtreeBand(...)` per eligible parent
MyTasksPage.tsx: MY_DAY_BAND_LABELS (L50) and MY_DAY_BAND_DOT (L69) are Record<string,string>; groupByMyDay called at ~L564 already passes myIssueKeys (no call-site change).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add in-review-my-subtasks band to the pure sort lib (tests + impl, one commit)</name>
  <files>taskflow/src/lib/my-tasks-sort.ts, taskflow/src/lib/my-tasks-sort.test.ts</files>
  <behavior>
    - MY_DAY_BANDS equals exactly: flagged-blocked, overdue, in-review-my-mr, in-review-my-subtasks, in-progress, to-do, done (7 entries)
    - classifyBand: done → 6, in-progress (indeterminate) → 4, to-do → 5; bands 0/1/2 unchanged; classifyBand never returns 3
    - subtreeBand: empty subtasks with done parent → 6; existing in-progress/to-do expectations shift by +1
    - isForeignReviewWithMySubtask: true for non-subtask parent, key not in myIssueKeys, status name contains "review" case-insensitively ("CODE REVIEW" qualifies), ≥1 subtask key in myIssueKeys; false if parent key in myIssueKeys, false if no subtask is mine, false if status lacks "review", false if parent is itself a subtask
    - groupByMyDay: foreign "In Review" (indeterminate) parent + my subtask In Progress → band 'in-review-my-subtasks'; same with my subtask To Do and with my subtask Done → still 'in-review-my-subtasks'
    - groupByMyDay: parent key in myIssueKeys + "In Review", no MR → 'in-progress' (D-05 regression guard)
    - groupByMyDay: foreign "In Progress" parent (no "review") + my subtask → 'in-progress'; foreign "In Review" parent with no subtask of mine → excluded entirely
    - groupByMyDay precedence: my subtask overdue → 'overdue'; my subtask flagged → 'flagged-blocked'; parent key in myOpenMRIssueKeys → 'in-review-my-mr'; parent flagged → 'flagged-blocked'
    - groupByMyDay: parent status "Reviewed" with statusCategory done + my subtask done → 'done'
    - groupByMyDay ordering: with all three present, groups emitted in-review-my-mr → in-review-my-subtasks → in-progress
  </behavior>
  <action>
    In my-tasks-sort.ts (per D-01, D-02, D-03, D-05):
    1. Insert 'in-review-my-subtasks' into MY_DAY_BANDS at index 3 with comment "3 — parent in review, not mine, with ≥1 of my subtasks (computed in groupByMyDay, never by classifyBand)"; renumber the trailing comments (in-progress 4, to-do 5, done 6). Update the "D-04 band order" JSDoc line and classifyBand doc "(0–5)" to reflect 7 bands / 0–6.
    2. Add exported constants right after the MyDayBand type: IN_REVIEW_MY_SUBTASKS_BAND = MY_DAY_BANDS.indexOf('in-review-my-subtasks') and DONE_BAND = MY_DAY_BANDS.indexOf('done'). Use these instead of new numeric literals.
    3. In classifyBand, change the done return to DONE_BAND (6), in-progress return to 4, to-do return to 5, and update the "Band N" comments. Leave signature untouched — classifyBand stays pure and per-issue (discretion choice: classification lives in groupByMyDay, not in classifyBand/subtreeBand; do NOT add a param to subtreeBand).
    4. In subtreeBand, replace the literal cap 5 with DONE_BAND and update the "cap at 5 (done)" comment.
    5. Add exported pure predicate isForeignReviewWithMySubtask(parent: JiraIssue, subtasks: JiraIssue[], myIssueKeys: Set<string>): boolean with JSDoc: returns false if parent.fields.issuetype?.subtask, false if myIssueKeys.has(parent.key), false if parent.fields.status.name.toLowerCase() does not include 'review', otherwise subtasks.some(s => myIssueKeys.has(s.key)). Ownership only; precedence handled by caller.
    6. In groupByMyDay Pass 3, make bandIndex a let from subtreeBand(...), then if isForeignReviewWithMySubtask(parent, subtasks, myIssueKeys) (subtasks = the UNFILTERED subtasksByParent list), compute parentBand = classifyBand(parent, flaggedFieldKey, myOpenMRIssueKeys, today); when parentBand > IN_REVIEW_MY_SUBTASKS_BAND and parentBand !== DONE_BAND, set bandIndex = Math.min(bandIndex, IN_REVIEW_MY_SUBTASKS_BAND). The DONE_BAND guard is required so a done-category "Reviewed" parent is not lifted (D-03). Math.min preserves subtree wins by flagged/overdue/my-MR (D-02).
    In my-tasks-sort.test.ts: update the MY_DAY_BANDS toEqual (and rename "6 band labels" title to 7), shift index assertions per RESEARCH §3 (classifyBand L63 5→6, L89 4→5, L108/L113 3→4, L118 4→5; subtreeBand L159 3→4, L184 4→5, L199 3→4) and rename titles that cite old band numbers. Add a describe for isForeignReviewWithMySubtask and groupByMyDay cases for every behavior bullet above, reusing the file's existing issue-factory helpers. groupByMyDay tests assert band ids, so existing ones need no change.
    Tests and implementation MUST be committed together in ONE commit (pre-commit hook runs the full vitest suite; a RED-only commit is blocked). Do not use git stash.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/my-tasks-sort.test.ts && grep -c "in-review-my-subtasks" src/lib/my-tasks-sort.ts && ! grep -nE "return 3;|subtaskBands, 5\)" src/lib/my-tasks-sort.ts && grep -c "DONE_BAND" src/lib/my-tasks-sort.ts</automated>
  </verify>
  <done>my-tasks-sort.test.ts passes with all new cases; MY_DAY_BANDS has 7 entries; subtreeBand cap uses DONE_BAND and classifyBand never returns 3; predicate and constants exported.</done>
</task>

<task type="auto">
  <name>Task 2: Add label and dot for the new band in MyTasksPage, type maps by MyDayBand</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.tsx</files>
  <action>
    Per D-04: change the import on L33 to also import type MyDayBand from '@/lib/my-tasks-sort'. Retype MY_DAY_BAND_LABELS and MY_DAY_BAND_DOT from Record<string, string> to Record<MyDayBand, string> so the compiler enforces completeness. Add 'in-review-my-subtasks': 'In Review — my subtasks' (U+2014 em dash) directly after the in-review-my-mr label entry, and 'in-review-my-subtasks': 'bg-indigo-500' directly after the in-review-my-mr dot entry (indigo chosen at discretion: distinct from purple-500 my-MR, blue-500 in-progress, and amber used in MyTaskRow). If the lookups at ~L606/L608 index with a value typed as MyDayBand, keep the `?? band` fallback harmless; if `band` is typed string there, cast is unnecessary because groupByMyDay returns MyDayBand. No change to the groupByMyDay call site.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit -p . && grep -c "In Review — my subtasks" src/routes/my-tasks/MyTasksPage.tsx && grep -c "Record<MyDayBand, string>" src/routes/my-tasks/MyTasksPage.tsx && npx vitest run src/routes/my-tasks && npx biome check src/lib/my-tasks-sort.ts src/lib/my-tasks-sort.test.ts src/routes/my-tasks/MyTasksPage.tsx</automated>
  </verify>
  <done>Typecheck passes; label and indigo dot present; both maps typed Record&lt;MyDayBand, string&gt;; My Tasks route tests pass; biome reports no new diagnostics in the touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → client sort lib | Issue status names/keys from Jira are only compared as strings; no rendering of untrusted HTML added |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fnq-01 | Information disclosure | groupByMyDay band lift | accept | Only re-buckets issues already fetched and displayed; no new data fetched or exposed |
| T-fnq-02 | Tampering | Status name substring match | accept | Pure display classification; worst case is a mis-grouped row, no write path |
</threat_model>

<verification>
- cd taskflow && npx vitest run (full suite green)
- cd taskflow && npx tsc --noEmit -p .
- Manual (UAT): My Tasks → My Day view shows "In Review — my subtasks" (indigo dot) between "In Review with my MR" and "In Progress" for a foreign in-review story with my subtask.
</verification>

<success_criteria>
- 7-band order flagged-blocked → overdue → in-review-my-mr → in-review-my-subtasks → in-progress → to-do → done
- Foreign in-review parents with my subtask land in the new band; own-story behavior unchanged; done "Reviewed" parents stay Done
- All tests and typecheck pass
</success_criteria>

<output>
Create `.planning/quick/260929-fnq-add-my-tasks-section-for-in-review-stori/260929-fnq-SUMMARY.md` when done
</output>
