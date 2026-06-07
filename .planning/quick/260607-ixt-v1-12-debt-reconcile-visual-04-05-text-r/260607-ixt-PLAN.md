---
phase: quick-260607-ixt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/issueDisplayUtils.ts
  - taskflow/src/lib/issueDisplayUtils.test.ts
  - taskflow/src/services/jira/rank.ts
  - taskflow/src/services/jira/rank.test.ts
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
autonomous: true
requirements: [VISUAL-04, VISUAL-05]
must_haves:
  truths:
    - "REQUIREMENTS.md VISUAL-04/05 describe the shipped design (type stripe + priority footer icon), not a priority-driven stripe"
    - "ROADMAP.md Phase 76 success criteria no longer claims the left-edge stripe is priority-driven"
    - "priorityStripeClass and prioritySeverityFromIcon no longer exist in the codebase"
    - "rank.ts and rank.test.ts are deleted; rank-api.ts (rankIssueApi) is untouched"
    - "issueTypeStripeClass and its tests remain intact and wired to TaskCard.tsx"
    - "npm run check (biome + tsc) is GREEN and npm test passes after removal"
  artifacts:
    - path: "taskflow/src/lib/issueDisplayUtils.ts"
      provides: "issueTypeStripeClass + done-state utils, with dead priority-stripe code removed"
      contains: "issueTypeStripeClass"
    - path: ".planning/REQUIREMENTS.md"
      provides: "Reconciled VISUAL-04/05 requirement text"
      contains: "VISUAL-04"
  key_links:
    - from: "taskflow/src/components/.../TaskCard.tsx"
      to: "issueTypeStripeClass"
      via: "import from issueDisplayUtils"
      pattern: "issueTypeStripeClass"
---

<objective>
Resolve three v1.12 tech-debt items from the milestone audit: (1) reconcile VISUAL-04/05 requirement text with the shipped type-stripe + priority-icon design, (2) delete the dead client-side rank.ts/rank.test.ts, and (3) remove the dead priorityStripeClass family from issueDisplayUtils.ts and its tests.

Purpose: Make the milestone record internally consistent and strip verified dead code so the v1.12 close is clean.
Output: Reconciled docs + smaller source surface, with all quality gates GREEN.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260607-ixt-v1-12-debt-reconcile-visual-04-05-text-r/260607-ixt-CONTEXT.md
@.planning/quick/260607-ixt-v1-12-debt-reconcile-visual-04-05-text-r/260607-ixt-RESEARCH.md
@taskflow/src/lib/issueDisplayUtils.ts
@taskflow/src/lib/issueDisplayUtils.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reconcile VISUAL-04/05 requirement + roadmap text</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>
  <action>Rewrite REQUIREMENTS.md lines 15-16 so the requirements match the shipped UI (quick-260606-oyy, commit a553b75b): VISUAL-04 must describe that sprint board cards show a left-edge color stripe encoding issue TYPE (Bug/Story/Subtask/Epic via issueTypeStripeClass), and that issue PRIORITY is surfaced via the PriorityIcon footer image (Jira iconUrl) — not via the stripe. VISUAL-05 must state that the issue-type stripe is legible in both light and dark themes (WCAG ≥ 3:1 against the card surface). Add a brief parenthetical noting the original intent (at-a-glance priority visibility) is preserved via the approved UX change (priority now shown by icon). Keep the [x] checkbox state. Then update ROADMAP.md: the Phase 76 Goal line (~:201) and success-criterion #3 (~:208) currently say the stripe is "driven by issue priority" — reword both so they describe the type-driven stripe + priority-via-icon design, keeping them consistent with the reconciled REQUIREMENTS.md wording. Do NOT touch 76-VERIFICATION.md (historical override record). Exact wording is your discretion per CONTEXT.md.</action>
  <verify>
    <automated>! grep -niE "VISUAL-0[45].*priority" /Users/mimo/Documents/Projects/taskflow/.planning/REQUIREMENTS.md | grep -vi "icon" ; grep -c "VISUAL-04" /Users/mimo/Documents/Projects/taskflow/.planning/REQUIREMENTS.md</automated>
  </verify>
  <done>REQUIREMENTS.md VISUAL-04/05 and ROADMAP.md Phase 76 goal+criterion describe the type-stripe + priority-icon design; no remaining claim that the stripe is priority-driven; 76-VERIFICATION.md untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Delete dead rank.ts client-side LexoRank service</name>
  <files>taskflow/src/services/jira/rank.ts, taskflow/src/services/jira/rank.test.ts</files>
  <action>Re-confirm there is NO barrel/index re-export of rank.ts before deleting: run grep for "from './rank'" and "services/jira/rank'" across taskflow/src — the only expected hit is rank.test.ts importing from './rank'. (Research and a prior grep confirmed no barrel and zero production callers of rankIssue.) If any non-test re-export or production caller exists, STOP and report instead of deleting. Otherwise delete both taskflow/src/services/jira/rank.ts and taskflow/src/services/jira/rank.test.ts entirely. Do NOT touch taskflow/src/services/jira/rank-api.ts — rankIssueApi is the live server-side ranking used by BacklogPage and MUST stay.</action>
  <verify>
    <automated>test ! -f /Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/rank.ts && test ! -f /Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/rank.test.ts && test -f /Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/rank-api.ts && echo OK</automated>
  </verify>
  <done>rank.ts and rank.test.ts no longer exist; rank-api.ts remains; no remaining import references ./rank.</done>
</task>

<task type="auto">
  <name>Task 3: Remove dead priorityStripeClass family + tests, keep gates GREEN</name>
  <files>taskflow/src/lib/issueDisplayUtils.ts, taskflow/src/lib/issueDisplayUtils.test.ts</files>
  <action>In taskflow/src/lib/issueDisplayUtils.ts remove the dead priority-stripe code and its JSDoc: the functions priorityStripeClass (:131) and prioritySeverityFromIcon (:110), and the constants PRIORITY_STRIPE (:39), ICON_SEVERITY_STRIPE (:80), and DEFAULT_STRIPE (:101). Keep isDoneStatus, doneSummaryClass, and issueTypeStripeClass exactly as-is — issueTypeStripeClass inlines its own Tailwind strings and references none of the removed constants, so it cannot break. Update the file-header JSDoc (:1-8) so it no longer claims to provide "priority stripe styling" (reword to done-state + issue-type stripe). In taskflow/src/lib/issueDisplayUtils.test.ts remove the three dead describe blocks: describe('priorityStripeClass', …) (:62), describe('prioritySeverityFromIcon', …) (:147), and describe('priorityStripeClass — icon-severity ramp (custom priority schemes)', …) (:167). Drop priorityStripeClass and prioritySeverityFromIcon from the import on lines 3-9 (keep doneSummaryClass, isDoneStatus, issueTypeStripeClass). Also remove the top-level const test fixtures (BLOCKER, MAJOR, HIGHEST, HIGH, YELLOW, GRAY_500, GRAY_600, GRAY_700, icon at :12-20) that become unused once the dead describes are gone — but verify each is not referenced by the retained issueTypeStripeClass describe before removing; remove only the now-unused ones so biome does not flag unused vars. Keep the issueTypeStripeClass describe (:96) and the isDoneStatus/doneSummaryClass describes intact.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && ! grep -rn "priorityStripeClass\|prioritySeverityFromIcon\|PRIORITY_STRIPE\|ICON_SEVERITY_STRIPE\|DEFAULT_STRIPE" src/lib/issueDisplayUtils.ts src/lib/issueDisplayUtils.test.ts && grep -c "issueTypeStripeClass" src/lib/issueDisplayUtils.ts && npm run check && npm test -- --run src/lib/issueDisplayUtils.test.ts</automated>
  </verify>
  <done>priorityStripeClass, prioritySeverityFromIcon, and the three *_STRIPE constants are gone from source and tests; issueTypeStripeClass + its tests remain; npm run check GREEN and the issueDisplayUtils test suite passes with the dead describes removed.</done>
</task>

</tasks>

<verification>
After all tasks, from the taskflow/ subdirectory:
- `npm run check` (biome check + tsc) GREEN across the repo.
- `npm test` passes — the removed rank.test.ts (12 tests) and the dead issueDisplayUtils describes no longer exist and no suite imports deleted symbols.
- `grep -rn "priorityStripeClass\|prioritySeverityFromIcon\|rankIssue\b" taskflow/src` (excluding rankIssueApi) returns no production hits.
</verification>

<success_criteria>
- VISUAL-04/05 in REQUIREMENTS.md and Phase 76 in ROADMAP.md describe the shipped type-stripe + priority-icon design; 76-VERIFICATION.md untouched.
- rank.ts + rank.test.ts deleted; rank-api.ts intact.
- priorityStripeClass family removed from source + tests; issueTypeStripeClass retained and still wired to TaskCard.tsx.
- npm run check GREEN; npm test passes.
</success_criteria>

<output>
Create `.planning/quick/260607-ixt-v1-12-debt-reconcile-visual-04-05-text-r/260607-ixt-SUMMARY.md` when done.
</output>
