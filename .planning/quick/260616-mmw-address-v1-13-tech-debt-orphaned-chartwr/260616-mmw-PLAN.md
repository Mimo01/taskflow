---
phase: quick-260616-mmw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/chart-wrapper.tsx
  - taskflow/src/components/chart-wrapper.test.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/types.ts
  - taskflow/src/lib/my-tasks-sort.ts
  - taskflow/src/lib/my-tasks-sort.test.ts
  - taskflow/src/routes/dashboard/MyIssuesCard.tsx
  - taskflow/src/routes/dashboard/HoursCommitsChart.tsx
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [CHART-03, MYTASK-02, MYTASK-06, MYTASK-08, INSIGHT-01, INSIGHT-02, DASH-05]

must_haves:
  truths:
    - "ChartWrapper component and its test no longer exist in src"
    - "GreenHopperBurndown / BurndownChangeEntry types are gone from src (no re-export, no definition)"
    - "deriveCounts and its return type are gone from my-tasks-sort.ts and its test block is removed"
    - "MyIssuesCard and HoursCommitsChart cache-sharing comments name only real, live producers"
    - "REQUIREMENTS.md reflects INSIGHT-01/02 retired and MYTASK-06/08 UAT-reduced"
    - "npm run check (biome + tsc) is GREEN and the full vitest suite passes"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "Reconciled traceability for INSIGHT-01/02, MYTASK-06/08"
      contains: "retired"
  key_links:
    - from: "taskflow/src/services/jira/greenhopper/index.ts"
      to: "./types"
      via: "barrel wildcard export (must still compile after two interfaces removed)"
      pattern: "export \\* from './types'"
---

<objective>
Clear the non-blocking tech debt enumerated in `.planning/v1.13-MILESTONE-AUDIT.md`: delete orphaned dead code (ChartWrapper, burndown types, deriveCounts) along with their tests, correct two stale cache-sharing comments, and reconcile REQUIREMENTS.md traceability with the recorded Phase 86 retirements and Phase 82 UAT reductions.

Purpose: Leave the v1.13 codebase free of dead surface and stale documentation before milestone close, with zero behavior change to shipped components.
Output: 6 source files trimmed/corrected, 1 metadata file reconciled, `npm run check` GREEN, full test suite passing.

DEFERRED — NOT in scope: W-02 (`jira-release-issues` cold-cache in UpcomingReleasesTimeline). Sharing a warm key with ReleasesTab requires changing the query key/endpoint shape — a real behavior change with its own risk. It is intentionally deferred to keep this task purely non-behavioral. Do not touch UpcomingReleasesTimeline or ReleasesTab.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/v1.13-MILESTONE-AUDIT.md

# All dead-code scope below was pre-verified by grep (see <action> blocks). Do NOT re-litigate.
# npm commands run from the taskflow/ subdirectory (taskflow/package.json), NOT repo root.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete orphaned ChartWrapper, burndown types, and dead deriveCounts (plus their tests)</name>
  <files>taskflow/src/components/chart-wrapper.tsx, taskflow/src/components/chart-wrapper.test.tsx, taskflow/src/services/jira.ts, taskflow/src/services/jira/greenhopper/types.ts, taskflow/src/lib/my-tasks-sort.ts, taskflow/src/lib/my-tasks-sort.test.ts</files>
  <action>
Three independent dead-code removals. All confirmed zero-live-consumer by grep across taskflow/src:

(W-01) ChartWrapper — only references are the component and its own test. DELETE both files outright: `taskflow/src/components/chart-wrapper.tsx` and `taskflow/src/components/chart-wrapper.test.tsx`. (Use `git rm` or remove the files.) CHART-03 stays satisfied in spirit — HoursCommitsChart wraps shadcn ChartContainer directly.

(W-05) Burndown types — `GreenHopperBurndown` and `BurndownChangeEntry`. Their only former consumer (BurndownChart.tsx) and the `parseBurndownChanges` parser were both deleted in Phase 86; remaining references are a re-export and doc-comment mentions only. Before deleting, re-confirm with `grep -rn "GreenHopperBurndown\|BurndownChangeEntry" taskflow/src` — expect hits ONLY in `services/jira.ts` (the re-export) and `services/jira/greenhopper/types.ts` (the definitions + each other). If any OTHER live file references either type, STOP and keep that type. Otherwise: (a) in `taskflow/src/services/jira.ts`, remove the two names `BurndownChangeEntry` (~line 2486) and `GreenHopperBurndown` (~line 2499) from the `export type { ... } from './jira/greenhopper'` block — keep every other name in that block intact; (b) in `taskflow/src/services/jira/greenhopper/types.ts`, delete the two `export interface BurndownChangeEntry { ... }` (~lines 308-348, including its leading doc comment) and `export interface GreenHopperBurndown { ... }` (~lines 350-401, including its leading doc comment) blocks entirely — these are bounded by other interfaces before and after, so delete only the burndown pair. The `greenhopper/index.ts` barrel uses `export * from './types'` (wildcard) — no edit needed there; it recompiles cleanly with the interfaces gone. `greenhopper/burndown.ts` is already a comment-only stub with no importers — leave it as is.

(Phase 82 debt) deriveCounts — referenced only by its own test; MyTasksPage derives counts inline. In `taskflow/src/lib/my-tasks-sort.ts`: delete the `MyTaskCounts` interface (~lines 163-170, including its `/** Shape returned by deriveCounts. */` comment) and the entire `export function deriveCounts(...)` body (~lines 172-221, runs to end of file). In `taskflow/src/lib/my-tasks-sort.test.ts`: remove `deriveCounts` from the import block (line 6) and delete the whole `// --- deriveCounts ---` describe block (~lines 327-398, runs to end of file). Keep all other exports/tests (classifyBand, groupByMyDay, subtreeBand, MY_DAY_BANDS) untouched.

No behavior change to any shipped component — these are all dead surfaces.
  </action>
  <verify>
    <automated>cd taskflow && grep -rn "ChartWrapper\|chart-wrapper\|GreenHopperBurndown\|BurndownChangeEntry\|deriveCounts\|MyTaskCounts" src; test $? -eq 1 && echo NO_REFS_REMAIN</automated>
  </verify>
  <done>grep finds zero references to any of the six removed identifiers in taskflow/src; both chart-wrapper files deleted; jira.ts re-export block and types.ts retain all non-burndown members; my-tasks-sort.ts retains its other exports.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite two stale cache-sharing comments (no behavior change)</name>
  <files>taskflow/src/routes/dashboard/MyIssuesCard.tsx, taskflow/src/routes/dashboard/HoursCommitsChart.tsx</files>
  <action>
Comment-only edits. Do NOT change any query key, queryFn, or runtime behavior.

(W-04) `taskflow/src/routes/dashboard/MyIssuesCard.tsx` has two stale claims that the `['jira-issues','sprint-board',...]` key matches SprintHealthSection / SprintBoardTab. SprintHealthSection was deleted in Phase 86; SprintBoardTab reads a different key (`gh-all-data`). The real warm producer is the dedup query in `dashboard/index.tsx` (~line 138, comment "ONE shared cache key"). Rewrite BOTH the file-header line (~line 9: "Cache key MUST MATCH SprintHealthSection / SprintBoardTab exactly — shared cache entry.") and the inline comment (~line 46: "// CACHE KEY MUST MATCH SprintHealthSection / SprintBoardTab exactly") so each instead states that this query shares its cache entry with the warm-up query in `dashboard/index.tsx` (the producer) — they MUST use the identical `['jira-issues','sprint-board', activeJiraProject, storyPointsFieldKey]` key to dedupe. The dedup itself is correct; only the named partner is wrong.

(W-03) `taskflow/src/routes/dashboard/HoursCommitsChart.tsx` header (~line 15) claims the commits query key is "(same as ActivityStrip)". ActivityStrip was deleted in Phase 86. Rewrite that note to state the chart fetches its own GitLab commit queries on a cold cache (useQueries × 7) and only incidentally shares the same `['standup','commits',...]` key structure with StandupNotesPage — there is no warm-cache guarantee here. Keep behavior identical.
  </action>
  <verify>
    <automated>cd taskflow && grep -rln "SprintHealthSection\|same as ActivityStrip" src/routes/dashboard/MyIssuesCard.tsx src/routes/dashboard/HoursCommitsChart.tsx; test $? -eq 1 && echo STALE_COMMENTS_GONE</automated>
  </verify>
  <done>Neither file mentions SprintHealthSection or "same as ActivityStrip"; MyIssuesCard references dashboard/index.tsx as the cache-share partner; HoursCommitsChart describes its own cold-cache commit queries; query keys unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Reconcile REQUIREMENTS.md traceability + run full gate</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
Metadata reconciliation in `.planning/REQUIREMENTS.md`, mirroring the existing `[~]` DESCOPED convention already used for DASH-06 (line 40).

INSIGHT-01 (line 47) and INSIGHT-02 (line 48): change the leading `- [ ]` to `- [~]` and append a retired note to each, e.g.: "— **RETIRED** (Phase 86 D-01 clean slate, 2026-06-16): built and verified in Phase 85, then deleted by the Phase 86 dashboard redesign; not shipped in the live app." Keep the original requirement text (strike it through with `~~...~~` like DASH-06 if you want exact mirror, but text retention + the RETIRED note is sufficient).

Traceability table: INSIGHT-01 (line 98) and INSIGHT-02 (line 99) currently read "Pending (Conditional)". Change the Status cell of both to "Retired (Phase 86 D-01)".

MYTASK-06 (line 27) and MYTASK-08 (line 29): do NOT uncheck — both are satisfied per the accepted UAT overrides in 82-VERIFICATION.md. Append a brief inline note to each requirement line reflecting the accepted reduction: MYTASK-06 — note the right-click context menu was removed at Phase 82 UAT (inline actions retained); MYTASK-08 — note the grouping switcher was removed at Phase 82 UAT (always My Day; scope preference still persists). The traceability rows (lines 88, 90) stay "Complete".

Coverage tally (lines 103-105): the totals ("20 total", "Mapped to phases: 20/20", "Unmapped: 0") do not change — retiring/descoping does not remove a requirement from the mapped total. Update the "Last updated" line at the bottom to today (2026-06-16) noting the v1.13 audit reconciliation. If you add any clarifying breakdown of satisfied vs descoped/retired counts, keep it consistent with the audit: 17 satisfied, 1 descoped (DASH-06), 2 retired (INSIGHT-01/02).

After the edit, run the full gate from `taskflow/`.
  </action>
  <verify>
    <automated>cd taskflow && npm run check && npm test</automated>
  </verify>
  <done>REQUIREMENTS.md: INSIGHT-01/02 marked `[~]` + RETIRED with table status "Retired"; MYTASK-06/08 stay checked with UAT-reduction notes; coverage totals unchanged; `npm run check` GREEN and full vitest suite passes (with deleted tests gone).</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` exits 0 (biome clean + tsc no errors).
- `cd taskflow && npm test` passes — no broken or dangling tests after deletions.
- `grep -rn "ChartWrapper\|GreenHopperBurndown\|BurndownChangeEntry\|deriveCounts\|MyTaskCounts" taskflow/src` returns nothing.
- `grep -rn "SprintHealthSection\|same as ActivityStrip" taskflow/src/routes/dashboard` returns nothing.
- No diff to any query key, queryFn, or component runtime logic (comment + dead-code + doc edits only).
</verification>

<success_criteria>
- W-01, W-05, and the Phase 82 deriveCounts debt removed (code + tests).
- W-03 and W-04 stale comments corrected to name only live producers.
- REQUIREMENTS.md traceability reconciled (INSIGHT retired, MYTASK-06/08 UAT-noted).
- W-02 explicitly deferred and untouched.
- `npm run check` GREEN, full test suite passing.
- Zero behavior change to any shipped component.
</success_criteria>

<output>
Create `.planning/quick/260616-mmw-address-v1-13-tech-debt-orphaned-chartwr/260616-mmw-SUMMARY.md` when done.
</output>
