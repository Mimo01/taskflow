---
phase: quick-261103-fqd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/driftDetection.ts
  - taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
autonomous: true
requirements: [QUICK-261103-fqd]

must_haves:
  truths:
    - "A merged MR in release detail whose milestone differs from the release milestone shows a red, clickable MS cell that assigns the milestone"
    - "A merged MR's BR (target branch) cell stays an em dash — GitLab forbids retargeting merged MRs"
    - "A merged MR already on the release milestone shows an MS check; with no matched release milestone it shows an em dash"
    - "Closed/locked MRs still render em dashes in BR, MS and TASK"
    - "The 'no milestone' header count/filter includes merged MRs missing the milestone"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/driftDetection.ts"
      provides: "isMilestoneEvaluated gate; merged branch of buildDriftRows evaluates ms"
      contains: "export function isMilestoneEvaluated"
    - path: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      provides: "BR and MS cells gated independently in MrSubLine and TaskMrCell"
  key_links:
    - from: "driftDetection.ts buildDriftRows (merged branch)"
      to: "evaluateMilestoneDrift"
      via: "ms mark computed for merged MRs"
      pattern: "evaluateMilestoneDrift"
    - from: "UnifiedTaskTable.tsx MS cell"
      to: "DriftActionCell action=assign-milestone"
      via: "rendered regardless of row.evaluated"
      pattern: "assign-milestone"
---

<objective>
Let the user assign the release milestone to already-merged MRs from release detail. GitLab refuses a target_branch change on a merged MR but accepts milestone_id (PUT /projects/:id/merge_requests/:iid). Today `classifyMrState` (opened only) gates both BR and MS, so merged MRs show em dashes in both. Split the gate: BR stays opened-only, MS covers opened + merged, TASK stays opened + merged (unchanged).

Purpose: merged MRs missing the release milestone are real, fixable drift. Right now the table hides them.
Output: driftDetection.ts evaluates MS for merged MRs; UnifiedTaskTable renders the MS fix button for them; tests updated.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/CLAUDE.md
@taskflow/src/routes/dashboard/release-detail/driftDetection.ts
@taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx

Paths: .planning and git live at the repo root (/Users/mimo/Documents/Projects/taskflow). npm, vitest, biome and tsc run from the inner app dir (/Users/mimo/Documents/Projects/taskflow/taskflow).

Project rules (from memory):
- The pre-commit hook runs the full vitest suite plus biome and tsc. Put each task's test and implementation in ONE commit.
- Run `npx biome check --write` only on the files you touched, never on all of src. Do not bulk find-replace.
- Don't gate on an absolute biome diagnostic count. The bar is that none of the touched files is newly flagged.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Evaluate the MS column for merged MRs in buildDriftRows</name>
  <files>taskflow/src/routes/dashboard/release-detail/driftDetection.ts, taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts</files>
  <behavior>
    - isMilestoneEvaluated: true for 'opened' (including draft) and 'merged'; false for 'closed' and 'locked'
    - Merged MR, milestone null, matchedMilestoneId set → br 'na', ms 'flag', evaluated false, flagged true (even when task is 'ok')
    - Merged MR, milestone.id === matchedMilestoneId → ms 'ok'; flagged depends only on task
    - Merged MR, matchedMilestoneId null → ms 'na'
    - Closed MR → br/ms/task all 'na', flagged false (unchanged)
    - countMilestoneFlaggedMRs counts a merged MR with ms flag; countBranchFlaggedMRs does not (br stays na)
  </behavior>
  <action>
In driftDetection.ts:
- Add an exported `isMilestoneEvaluated(mr: GitLabMR): boolean` next to `isTaskEvaluated`. It returns true for state 'opened' or 'merged'. Same JSDoc style as its neighbours, plus a note on why: GitLab accepts milestone_id on a merged MR but rejects a target_branch change. Keep the existing D-10 warning that the gate must not check `draft`.
- In the `buildDriftRows` merged branch (the `!evaluated && isTaskEvaluated(mr)` block), compute `ms` with the same ternary the opened branch uses: 'na' when matchedMilestoneId is null, otherwise evaluateMilestoneDrift → 'flag'/'ok'. Guard it with `isMilestoneEvaluated(mr)` so the gate is explicit. Keep `br: 'na'` and `evaluated: false`. Set `flagged: task === 'flag' || ms === 'flag'`.
- The `evaluated` field now means "BR evaluated (opened)". Update the DriftRow `evaluated` doc comment, the module-header D-10 paragraph, the `classifyMrState` JSDoc (it now drives BR only; MS is the wider `isMilestoneEvaluated`) and the "Three cases" doc on buildDriftRows. The merged bullet should say BR stays na and MS + TASK are evaluated. Fix the inline comment "TASK only; BR/MS stay open-only" too. Do not rename `classifyMrState` or `evaluated`, because many consumers depend on them.
- Check the count helpers (countBrMsFlaggedMRs / countBranchFlaggedMRs / countMilestoneFlaggedMRs). They read row.br and row.ms directly, so a merged ms flag is counted in the MS badge and in BR+MS. That is intended because the item is fixable. No code change is expected; just confirm it.

In driftDetection.test.ts:
- Add `isMilestoneEvaluated` to the import. Add a state-matrix test next to the existing classifyMrState and isTaskEvaluated tests (~line 218-230).
- Rewrite the test '261103-eu3: a merged MR with mismatched branch and no milestone contributes 0 to every BR/MS count' (~line 338). The new expectations: countBranchFlaggedMRs 0, countMilestoneFlaggedMRs 1, countBrMsFlaggedMRs 1. Rename it to 261103-fqd.
- Find the existing merged-MR tests that assert `ms` is 'na' (around lines 265-320 and 353-380) and update them for the new behaviour. Where the fixture has no milestone and buildOne passes a matchedMilestoneId, ms is now 'flag' and the row is flagged. Read what buildOne passes before you edit. Where a test's intent is the TASK reason only, give the fixture a milestone matching the matched id so it still isolates TASK, or update its assertion. Don't weaken the assertions.
- Add the behavior cases above as new `261103-fqd:` tests.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/driftDetection.test.ts</automated>
  </verify>
  <done>driftDetection tests pass. Merged MRs get real ms marks and br 'na'. Closed MRs are unchanged. The doc comments describe BR as opened-only and MS/TASK as opened + merged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Render the BR and MS cells independently in UnifiedTaskTable</name>
  <files>taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</files>
  <behavior>
    - A merged row (evaluated false, br 'na', ms 'flag', flagged true) renders drift-br as an em dash and drift-ms as an actionable BUTTON. Clicking it fires the assign-milestone mutation, like the existing opened-MR MS click test (~line 791)
    - A merged row with ms 'na' still renders em dashes in both columns
    - The merged MR sub-line (MrSubLine, e.g. the secondary/uncovered list or multi-MR sub-lines) also renders an actionable MS cell when ms is 'flag'
  </behavior>
  <action>
In UnifiedTaskTable.tsx:
- MrSubLine (~line 795). Replace the single `row.evaluated ? (BR+MS DriftActionCells) : (two na DriftMarkCells)` with two independent cells. BR keeps the `row.evaluated` gate: a DriftActionCell retarget when evaluated, otherwise `<DriftMarkCell mark="na" testId="drift-br" />`. MS always renders `<DriftActionCell action="assign-milestone" mark={row.ms} testId="drift-ms" fix={fix} />`. Closed rows carry ms 'na', and DriftActionCell already renders the na glyph for non-flag marks. Confirm that before relying on it. If it doesn't hold, gate MS on `row.ms !== 'na'` instead.
- TaskMrCell (~line 1115). Do the same split. The BR slot uses the `selected.evaluated` gate: the existing DriftCellSlot + DriftActionCell retarget when evaluated, otherwise an inert DriftCellSlot with the na BR mark. The MS slot always renders the DriftCellSlot with `interactive={isMrFixActionable(selected.ms, 'assign-milestone', fix)}` wrapping the DriftActionCell. Keep the CR-05 (derived interactive) and CR-07 (`key={\`ms-${mr.id}\`}` / `br-${mr.id}`) comments and keys. Split `naDriftCells` into `naBrCell` + `naMsCell`, or keep `naDriftCells` for the other call sites (~lines 966/994/1012/1030 are rows with no MR, where both stay na) and add an `naBrCell` constant for this one. Pick whichever needs the smaller diff.
- Update the selectDisplayMr doc comment (~line 856) to say `row.evaluated` means BR evaluated (opened). Merged rows can now be in the `flagged` pool through an MS flag, which is intended: the selected MR is the one with fixable drift. No logic change is needed there.
- Check the MS header filter (activeFilter 'ms', ~lines 1349 and 1503). It filters on row.ms === 'flag', so merged MRs are included automatically. Confirm only.

In UnifiedTaskTable.test.tsx:
- Keep the test 'a non-evaluated (merged) row renders an em dash in both BR/MS columns…' (~line 262) as it is. It uses ms 'na' and should still pass.
- Add a `261103-fqd:` test that renders a merged row with evaluated false, br 'na', ms 'flag', task 'ok', flagged true. Assert that drift-br shows '—', that drift-ms is a BUTTON, and that clicking it triggers the assign-milestone mutation. Mirror how the existing opened-MR MS click test (~line 785-801) mocks the mutation and uses DEFAULT_FIX.
- If any MrSubLine-path test renders merged rows, add one assertion that its MS cell is actionable when flagged.

Finally, from the inner dir, run biome check --write on the four touched files only, then `npx tsc --noEmit`. Commit both tasks' changes together (or one commit per task, each with its tests). The pre-commit hook runs the full suite.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/ && npx tsc --noEmit && npx biome check src/routes/dashboard/release-detail/driftDetection.ts src/routes/dashboard/release-detail/driftDetection.test.ts src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</automated>
  </verify>
  <done>A merged MR missing the release milestone shows a clickable red MS cell in both the task row and the sub-line. BR stays an em dash. The release-detail tests, tsc and biome on the touched files all pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → GitLab API | Existing PUT merge_requests/:iid milestone_id write, now reachable for merged MRs |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fqd-01 | Tampering | useMrFixMutation assign-milestone | accept | The write is the same user-initiated, PAT-scoped PUT that already exists. GitLab enforces permissions, and a merged MR accepts milestone_id. |
| T-fqd-02 | Tampering | retarget on merged MR | mitigate | The BR cell stays gated on `evaluated` (opened only), so no retarget button renders for merged MRs. A test asserts drift-br is an em dash. |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/release-detail/` passes
- `npx tsc --noEmit` is clean; biome on the touched files is clean
- Manual: open a release detail page that has a merged MR without the release milestone. Its MS cell is red and clickable, and clicking it assigns the milestone. The BR cell shows an em dash.
</verification>

<success_criteria>
From release detail, the user can assign the release milestone to a merged MR. Retargeting stays impossible for merged MRs, and closed MRs are unchanged.
</success_criteria>

<output>
Create `.planning/quick/261103-fqd-allow-assigning-milestone-to-merged-mrs-/261103-fqd-SUMMARY.md` when done
</output>
