---
phase: quick-261102-rdn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx
autonomous: true
requirements: [QUICK-261102-rdn]

must_haves:
  truths:
    - "The release detail page MR donut has no legend row under the ring"
    - "The MR donut ring is visibly bigger (148px instead of 108px), filling the space the legend used to take"
    - "Hovering a slice still shows its per-state count in the AioDonut tooltip; the aria-label still lists the non-zero states"
    - "MrLabels column stays to the right of the donut, top-aligned with its border-l, unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx"
      provides: "MR donut without legend"
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx"
      provides: "DONUT_GRAPH_SIZE / COMPACT_DONUT_SIZE = 148"
  key_links:
    - from: "ReleaseMrDonut.tsx"
      to: "AioDonut size prop"
      via: "COMPACT_DONUT_SIZE / DONUT_GRAPH_SIZE"
      pattern: "size=\\{compact \\? COMPACT_DONUT_SIZE : DONUT_GRAPH_SIZE\\}"
---

<objective>
Remove the state legend (merged/open/draft/closed row) from the release detail page's MR donut and make the donut ring bigger so it takes up the vertical space the legend used. Segment detail stays available through the existing AioDonut hover tooltip (at most 4 rows) and the aria-label. This matches the user's "no legends" dashboard preference.

Output: an updated ReleaseMrDonut.tsx, new size constants in GraphSlot.tsx, and an updated test. All in one commit.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx

Notes:
- The repo root (with .planning and git) is /Users/mimo/Documents/Projects/taskflow. src, npm, vitest and biome all live in the inner taskflow/taskflow/ directory, so run all npm/npx commands from there.
- ReleaseDetailPage.tsx:333 always renders `<ReleaseMrDonut ... compact />`, so the live ring size is COMPACT_DONUT_SIZE (currently 108). DONUT_GRAPH_SIZE (currently 104) is used for the GraphSlot minHeight, the in-slot skeleton and ReleaseDetailSkeleton.tsx:46 (`skeleton-donut`). Both constants are used only by the MR donut.
- AioDonut (aio-cycle/AioDonut.tsx) already renders a recharts Tooltip with a SliceTooltip per slice. Do not change it.
- The pre-commit hook runs the full vitest suite plus biome lint and tsc. Make one commit that includes the code and the test change.
- Do not run `biome --write` on all of src. Only format the touched files.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove legend, enlarge ring, update test</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx, taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx</files>
  <action>
1. GraphSlot.tsx: set `DONUT_GRAPH_SIZE = 148` and `COMPACT_DONUT_SIZE = 148`. 148px is roughly the old 108px ring plus the two legend rows and gap, so the band height barely changes. The ReleaseDetailSkeleton and the GraphSlot minHeight pick up the new value automatically, so the skeleton stays the same size as the loaded state.

2. ReleaseMrDonut.tsx:
   - Delete the whole `data-testid="release-mr-legend"` div and its `slices.map`.
   - Remove the `flex flex-col items-center gap-2.5` wrapper div around AioDonut, so AioDonut is a direct child of the outer flex row next to MrLabels.
   - Replace the "Donut with its legend tucked underneath..." comment with a one-liner: no legend; slice counts come from the hover tooltip and the aria-label.
   - Leave the outer row classes unchanged (`my-auto flex flex-wrap items-start justify-center gap-y-3`, with gap-x by compact). Leave MrLabels unchanged.
   - Keep `slices` because AioDonut needs it. Keep the aria-label and the centre total/MRs content.
   - If the default-children skeleton (the 3 bar Skeletons beside AioDonutSkeleton) is still fine, leave it.

3. ReleaseMrDonut.test.tsx: in the test 'shows total and MRs in the centre and non-zero values beside it', rename it to 'shows total and MRs in the centre with no legend'. Keep the '4' and 'MRs' assertions. Replace the merged/draft/closed text assertions with `expect(screen.queryByTestId('release-mr-legend')).toBeNull()` and `expect(screen.queryByText('merged')).toBeNull()`. The aria-label test already covers per-state values.

4. Run `npx biome check --write` only on the three touched files. Then run tsc and the release-detail tests (see verify).

5. Commit from the repo root with message `fix(quick-261102-rdn): drop MR donut legend, enlarge ring to 148px`. End the message with the Co-Authored-By trailer.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage && npx tsc --noEmit -p . && grep -c "release-mr-legend" src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx | grep -qx 0</automated>
  </verify>
  <done>No legend markup in ReleaseMrDonut.tsx. Both donut size constants are 148. The release-detail tests and tsc pass. A single commit landed, and the pre-commit hook passed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Presentational change only; no new input, data or network surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rdn-01 | Information disclosure | ReleaseMrDonut | accept | Renders the same counts already on screen; no new data exposed |
</threat_model>

<verification>
- `grep release-mr-legend` finds nothing in src. If MrLabels.test.tsx refers to "legend", that is only in describe/it strings, which is fine to leave or reword.
- Visual check (UAT): on a release detail page the MR ring is larger, has no state row under it, the label pills sit to its right with the hairline, and hovering a slice shows the tooltip.
</verification>

<success_criteria>
- The legend is removed and the ring is 148px in both compact and non-compact modes.
- The skeleton size matches the loaded size.
- Tests, tsc and biome pass in one commit.
</success_criteria>

<output>
Create `.planning/quick/261102-rdn-on-release-detail-page-remove-the-legend/261102-rdn-SUMMARY.md` when done
</output>
