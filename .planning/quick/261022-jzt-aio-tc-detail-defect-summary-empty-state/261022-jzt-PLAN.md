---
phase: quick-261022-jzt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx
  - taskflow/src/routes/dashboard/aio-cycle/DefectSummary.test.tsx
autonomous: true
requirements: [QUICK-261022-jzt]

must_haves:
  truths:
    - "On an AIO test cycle detail page with no linked defects, the Defect Summary section shows a compact centred empty state (green round badge with a BugOff icon, 'No linked defects' title, muted subline) instead of an empty grey ring"
    - "Loading skeleton and populated Status/Priority/Severity donuts are unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx"
      provides: "CycleDefectDonuts empty branch rendering icon badge + text"
      contains: "BugOff"
    - path: "taskflow/src/routes/dashboard/aio-cycle/DefectSummary.test.tsx"
      provides: "Empty-state test (text present, no ring)"
      contains: "defect-donut-empty"
  key_links:
    - from: "CycleDefectDonuts (statusSlices.length === 0 branch)"
      to: "lucide-react BugOff"
      via: "import"
      pattern: "import \\{ BugOff \\} from 'lucide-react'"
---

<objective>
Replace the empty grey ring shown in the AIO cycle detail "Defect Summary" section (when the cycle has no linked defects) with a compact, friendly centred empty state.

Purpose: The muted empty donut ring with tiny text looks broken/odd; a positive "no defects" badge reads as intended.
Output: Updated `CycleDefectDonuts` empty branch + a regression test.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
App lives in the INNER dir `taskflow/taskflow` (src, npm, vitest, biome, tsc run there); `.planning` and git root are the outer `taskflow/`.

@taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx
@taskflow/src/routes/dashboard/aio-cycle/DefectSummary.test.tsx

Facts established during planning:
- Empty branch is at DefectSummary.tsx ~line 112: `if (statusSlices.length === 0) return <AioDonutSkeleton testId="defect-donut-empty" pulse={false}>No linked defects</AioDonutSkeleton>`.
- `AioDonutSkeleton` `children` prop is STILL used by `ExecutionDonut.tsx` (exec-donut-empty) — do NOT remove it from AioDonut.tsx. `AioDonutSkeleton` itself stays imported in DefectSummary.tsx (used by `DonutBlockSkeleton`).
- The ring `AioDonutSkeleton` renders is a `div.rounded-full.border-muted` — the test can assert its absence via `.border-muted`.
- `BugOff` from `lucide-react` is already used in CycleKpiTiles.tsx (available in installed version).
- The Section wrapper body in CycleKpiTiles.tsx is `flex min-w-0 flex-1 items-center`, so the empty state needs `w-full` to centre horizontally.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Compact empty state for Defect Summary + test</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx, taskflow/src/routes/dashboard/aio-cycle/DefectSummary.test.tsx</files>
  <behavior>
    - With defects=[] and loading=false: `getByTestId('defect-donut-empty')` exists, contains text 'No linked defects' and the subline "No defects raised against this cycle's runs".
    - Same render: `queryByTestId('defect-status-donut')` is null and the empty element has no `.border-muted` ring descendant (`querySelector('.border-muted')` is null).
    - Existing key and loading-skeleton tests still pass unchanged.
  </behavior>
  <action>
    In DefectSummary.tsx, replace ONLY the `statusSlices.length === 0` branch of `CycleDefectDonuts`. Do NOT use the shared page-sized `@/components/ui/empty-state` (too large for this section). Render a wrapper div with `data-testid="defect-donut-empty"` and className `flex w-full flex-col items-center justify-center gap-2 text-center`. Inside: (1) a round badge div with className `flex size-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:bg-green-400/10 dark:text-green-400` containing lucide `BugOff` with className `size-5` and `aria-hidden`; (2) a div grouping two lines: title `No linked defects` (`text-sm font-medium`) and subline `No defects raised against this cycle's runs` (`text-xs text-muted-foreground`) — escape the apostrophe as needed for JSX/biome (e.g. `&apos;` or a `{"..."}` string, whichever biome accepts without complaint). Add `import { BugOff } from 'lucide-react';` at the top in biome-sorted order. Keep the `AioDonutSkeleton` import (still used by DonutBlockSkeleton). Leave the loading branch and populated `DefectDonuts` untouched. Do not touch AioDonut.tsx (its `children` prop is still used by ExecutionDonut.tsx). Update the `CycleDefectDonuts` doc comment: replace "skeleton rings, an empty ring, or the pair" wording with skeleton rings, a compact no-defects empty state, or the donuts (drop the claim that the empty state keeps the same height if it no longer strictly does — say the section stays roughly stable).
    In DefectSummary.test.tsx add a `describe('defect donut empty state', ...)` block with one `it` implementing the behaviour above (render `<CycleDefectDonuts defects={[]} loading={false} />`).
    Commit code + test in ONE commit (pre-commit hook runs full vitest; a RED-only commit would be blocked). Edit with Edit tool, not bulk sed; do not run `biome --write` on all of src — only on the two changed files if needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow &amp;&amp; npx vitest run src/routes/dashboard/aio-cycle &amp;&amp; npx biome check src/routes/dashboard/aio-cycle/DefectSummary.tsx src/routes/dashboard/aio-cycle/DefectSummary.test.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <done>Empty-state test passes alongside existing aio-cycle tests; biome reports no diagnostics on the two files; tsc clean; DefectSummary.tsx empty branch contains BugOff and no AioDonutSkeleton for defect-donut-empty; single commit `fix(261022-jzt): friendlier Defect Summary empty state`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Pure presentational change; static strings, no new data input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261022-jzt-01 | Information disclosure | DefectSummary empty branch | accept | Renders static copy only; no user/customer data introduced |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/aio-cycle` green
- `npx biome check` on both changed files clean
- `npx tsc --noEmit` clean
</verification>

<success_criteria>
A cycle with zero linked defects shows a green BugOff badge, "No linked defects" and a muted subline centred in the Defect Summary section; no grey ring; other states unchanged.
</success_criteria>

<output>
Create `.planning/quick/261022-jzt-aio-tc-detail-defect-summary-empty-state/261022-jzt-SUMMARY.md` when done
</output>
