---
phase: quick-261028-mgp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/story-points-filter.ts
  - taskflow/src/lib/story-points-filter.test.ts
  - taskflow/src/stores/filter.store.ts
  - taskflow/src/stores/filter.store.test.ts
  - taskflow/src/components/UnifiedFilterBar.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
autonomous: true
requirements: [QUICK-261028-mgp]

must_haves:
  truths:
    - "Opening Filter on the Backlog AND on the Sprint Board shows a 'Story Points' dropdown next to Assignee/Status"
    - "Dropdown lists the distinct story-point values on the visible issues, numerically ascending (0.5, 1, 2, 3, 5, 8, 13 — not lexicographic)"
    - "A 'No estimate' option is pinned first, italic/muted with a divider (same as 'Unassigned'), and appears only when >=1 visible issue has no story points"
    - "Selecting one or more values shows only issues whose story points equal one of them (OR semantics); 'No estimate' matches only issues with null/missing story points"
    - "The selection is shared: picking '3' on the Backlog is still active when switching to the Sprint Board (same filter.store)"
    - "Active selections render as 'Story Points: 3' / 'Story Points: No estimate' chips, are removable, counted in the Filter badge, cleared by Clear, and saved/restored by quick filters"
    - "Previously saved quick filters (no storyPoints key) keep working and apply with no story-point filter"
  artifacts:
    - path: "taskflow/src/lib/story-points-filter.ts"
      provides: "Shared story-point filter primitives (sentinel, label, reader, option builder, predicate)"
      exports: ["NO_ESTIMATE_FILTER", "NO_ESTIMATE_LABEL", "readStoryPoints", "buildStoryPointOptions", "matchesStoryPointsFilter"]
    - path: "taskflow/src/lib/story-points-filter.test.ts"
      provides: "Vitest coverage of the helper"
    - path: "taskflow/src/stores/filter.store.ts"
      provides: "activeStoryPoints Set + toggleStoryPoints, cleared by clearAll, populated by applyQuickFilter"
      contains: "activeStoryPoints"
  key_links:
    - from: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      to: "matchesStoryPointsFilter"
      via: "applyFilters predicate + buildStoryPointOptions in filterOptions useMemo"
      pattern: "matchesStoryPointsFilter\\(issue, activeStoryPoints, storyPointsFieldKey\\)"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "matchesStoryPointsFilter"
      via: "applyFilters predicate + the 'any filter active' gate"
      pattern: "activeStoryPoints\\.size > 0"
    - from: "taskflow/src/components/UnifiedFilterBar.tsx"
      to: "useFilterStore.activeStoryPoints"
      via: "FilterDropdown label 'Story Points' with distinctValue NO_ESTIMATE_FILTER"
      pattern: "NO_ESTIMATE_FILTER"
---

<objective>
Add a story-points filter to the shared filter used by the Backlog and the Sprint Board. One filter state (filter.store) drives both views, and one shared helper is the single source of truth for options and matching. This follows the quick-260606-s09 assignee-filter pattern (`src/lib/assignee-filter.ts`).

Purpose: users can triage by size, e.g. show only the 8s and 13s, or find everything still unestimated.
Output: new `src/lib/story-points-filter.ts` with tests; filter.store extended; UnifiedFilterBar gets a "Story Points" dropdown; both views wired.

All paths below are relative to the repo root. App code, npm, vitest, biome and tsc all run from the INNER `taskflow/` dir (`/Users/mimo/Documents/Projects/taskflow/taskflow`).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/lib/assignee-filter.ts
@taskflow/src/lib/assignee-filter.test.ts
@taskflow/src/stores/filter.store.ts

<interfaces>
How story points are read today (copy this exact fallback chain; do NOT invent a new one):
- `src/routes/dashboard/BacklogRow.tsx:299-302` and `src/routes/my-tasks/MyTaskRow.tsx:169-172`:
  `(issue.fields[storyPointsFieldKey] as number | null | undefined) ?? (issue.fields.customfield_10016 as number | null | undefined) ?? null`
- Backlog issues come from the GreenHopper adapter (`src/services/jira/greenhopper/adapter.ts:145`), which synthesizes ONLY `customfield_10016`. That is why the 10016 fallback is required.
- `storyPointsFieldKey` is already in scope in both views: BacklogPage destructures it from settings (~line 349), and SprintBoardTab line 793 has `const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey)`.
- `JiraIssue` type: `import type { JiraIssue } from '@/services/jira'` (the legacy jira.ts, as assignee-filter.ts does).

Existing filter wiring sites:
- `src/stores/filter.store.ts`: the `QuickFilter` interface and Sets for epics/labels/assignees/statuses; `applyQuickFilter` uses `new Set(filter.statuses ?? [])` for back-compat.
- `src/components/UnifiedFilterBar.tsx`: `UnifiedFilterBarProps.filterOptions` (l.183-191), destructure from useFilterStore (l.194-205), `hasActiveFilters`/`activeCount` (l.218-225), `handleSaveQuickFilter` (l.227-240), `isQuickFilterActive` (l.248-260), chips (l.274-305), chip testid regexes `/^(epic|label|assignee|status)-/` at l.441 and l.578, and the dropdown row (l.555-568), where Assignee uses `displayMap` + `distinctValue`.
- `src/routes/dashboard/BacklogPage.tsx`: useFilterStore destructure l.605, `filterOptions` useMemo l.645-675 (deps array l.675), `applyFilters` l.679-702.
- `src/routes/dashboard/SprintBoardTab.tsx`: useFilterStore destructure l.1528, filterOptions l.1531-1556 built from `localIssues`, `applyFilters` l.1558-1586, and the "any filter active" gate l.1591-1597.
- `src/routes/dashboard/BacklogFilterBar.tsx` is dead code (no importers). Do NOT touch it.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared story-points filter helper + store state (TDD, single commit)</name>
  <files>taskflow/src/lib/story-points-filter.ts, taskflow/src/lib/story-points-filter.test.ts, taskflow/src/stores/filter.store.ts, taskflow/src/stores/filter.store.test.ts</files>
  <behavior>
    story-points-filter.test.ts (fixtures cast via `as unknown as JiraIssue`, same style as assignee-filter.test.ts; use a custom key such as 'customfield_10028' as storyPointsFieldKey in some cases):
    - constants: NO_ESTIMATE_FILTER === '__no_estimate__', NO_ESTIMATE_LABEL === 'No estimate'
    - readStoryPoints: reads fields[storyPointsFieldKey]; falls back to customfield_10016 when the key field is null/undefined; returns null when both are missing; returns null for non-finite or non-number values (e.g. NaN, a string)
    - readStoryPoints keeps 0 as 0. Zero is an explicit estimate, not "no estimate".
    - buildStoryPointOptions: issues with SP [5, 13, 2, 0.5, 5, null] produce ['__no_estimate__', '0.5', '2', '5', '13'] (deduped, numeric ascending, sentinel first)
    - buildStoryPointOptions: when no issue is unestimated, there is no sentinel; an empty list gives []
    - matchesStoryPointsFilter: an empty active Set returns true for every issue
    - matchesStoryPointsFilter: Set{'5'} matches SP 5 only, not 13, 0.5 or null; Set{'0.5'} matches 0.5
    - matchesStoryPointsFilter: Set{'__no_estimate__'} matches null/missing only and does NOT match SP 0
    - matchesStoryPointsFilter: OR semantics, so Set{'__no_estimate__','8'} matches null and 8 but not 3
    - matchesStoryPointsFilter: an unparseable selected value (e.g. 'abc') never matches anything, including null
    filter.store.test.ts additions:
    - toggleStoryPoints adds and then removes a value; clearAll empties activeStoryPoints
    - applyQuickFilter with storyPoints ['3'] populates activeStoryPoints; applyQuickFilter WITHOUT a storyPoints key (legacy saved filter) yields an empty activeStoryPoints
  </behavior>
  <action>
Create `taskflow/src/lib/story-points-filter.ts`, modelled on `assignee-filter.ts`. Include a header doc comment that names quick-261028-mgp and says both views must call the shared predicate. Exports:
- `NO_ESTIMATE_FILTER = '__no_estimate__'` and `NO_ESTIMATE_LABEL = 'No estimate'`.
- `readStoryPoints(issue: JiraIssue, storyPointsFieldKey: string): number | null`. Use the exact fallback chain from <interfaces> (key field, then customfield_10016, then null). If the result is not a finite number (`typeof v === 'number' && Number.isFinite(v)`), return null.
- `buildStoryPointOptions(issues: JiraIssue[], storyPointsFieldKey: string): string[]`. Collect distinct numeric values in a Set<number>, sort them ascending with a numeric comparator `(a, b) => a - b`, and map them with `String(n)`. Prepend NO_ESTIMATE_FILTER only when at least one issue reads null.
- `matchesStoryPointsFilter(issue: JiraIssue, active: Set<string>, storyPointsFieldKey: string): boolean`:
  - An empty Set returns true.
  - If the issue's SP is null, return `active.has(NO_ESTIMATE_FILTER)`.
  - Otherwise, return true iff some selected value v other than the sentinel satisfies `Number(v) === sp`. Use exact numeric equality, never substring matching: '1' must not match 13.

Extend `taskflow/src/stores/filter.store.ts`:
- Add an optional `storyPoints?: string[]` to `QuickFilter`. It must be optional because persisted settings already hold quick filters without it, so no settings.store migration is needed.
- Add `activeStoryPoints: Set<string>` (initial empty), `setActiveStoryPoints`, and `toggleStoryPoints` (use the existing local `toggle` helper).
- `clearAll` resets activeStoryPoints.
- `applyQuickFilter` sets `activeStoryPoints: new Set(filter.storyPoints ?? [])`.
- Update the store's header comment if it enumerates the filters.

Write the tests first and confirm they fail (run vitest on the two files). Then implement until they pass. The pre-commit hook runs the full vitest suite, biome and tsc, so a RED commit cannot land. Make ONE commit containing both tests and implementation. Format only the touched files with biome (`npx biome check --write <files>`), never all of src.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/story-points-filter.test.ts src/stores/filter.store.test.ts</automated>
  </verify>
  <done>All behavior cases pass. The helper exports the 5 named symbols. filter.store exposes activeStoryPoints/toggleStoryPoints/setActiveStoryPoints, and clearAll/applyQuickFilter handle it (legacy quick filter gives an empty Set). One commit.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the Story Points dropdown into UnifiedFilterBar, BacklogPage and SprintBoardTab</name>
  <files>taskflow/src/components/UnifiedFilterBar.tsx, taskflow/src/routes/dashboard/BacklogPage.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
UnifiedFilterBar.tsx:
- Add `storyPoints: string[]` (required) to `UnifiedFilterBarProps.filterOptions`. Both consumers supply it, and no test constructs this prop.
- Destructure `activeStoryPoints` and `toggleStoryPoints` from useFilterStore.
- Include `activeStoryPoints.size` in `hasActiveFilters` and `activeCount`.
- Add `storyPoints: Array.from(activeStoryPoints)` in `handleSaveQuickFilter`.
- In `isQuickFilterActive`, add a `storyPointsMatch` that uses `(qf.storyPoints ?? [])` exactly like the statuses back-compat pattern, and AND it into the return.
- Push chips with key `storypoints-${v}`, category 'Story Points', and label `v === NO_ESTIMATE_FILTER ? NO_ESTIMATE_LABEL : v`. Place them after assignee chips and before status chips, matching the dropdown order.
- Extend both chip testid regexes (l.441 and l.578) to `/^(epic|label|assignee|storypoints|status)-/`. Edit these two sites individually, not with a find-replace on 'assignee', because that word also appears in labels.
- Render a new `<FilterDropdown label="Story Points" ...>` between Assignee and Status. Give it `options={filterOptions.storyPoints}`, `selected={activeStoryPoints}`, `onToggle={toggleStoryPoints}`, `displayMap={new Map([[NO_ESTIMATE_FILTER, NO_ESTIMATE_LABEL]])}` and `distinctValue={NO_ESTIMATE_FILTER}`. This copies the Assignee UI exactly, so the sentinel is italic/muted with a divider.
- Import the constants from '@/lib/story-points-filter'.

BacklogPage.tsx:
- Add `activeStoryPoints` to the useFilterStore destructure at l.605.
- In the filterOptions useMemo, add `storyPoints: buildStoryPointOptions(allIssues, storyPointsFieldKey)` and add `storyPointsFieldKey` to the deps array.
- In `applyFilters`, add `const storyPointsMatch = matchesStoryPointsFilter(issue, activeStoryPoints, storyPointsFieldKey);` and AND it into `result`.
- Add a short comment next to the existing assignee comment noting that this is the shared helper.

SprintBoardTab.tsx:
- Add `activeStoryPoints` to the destructure at l.1528.
- Add `storyPoints: buildStoryPointOptions(localIssues, storyPointsFieldKey)` to `filterOptions`.
- Add `storyPointsMatch` via `matchesStoryPointsFilter` in `applyFilters` and AND it into the return.
- Add `activeStoryPoints.size > 0 ||` to the "Apply local filters" gate (l.1591-1597). Without it the filter silently does nothing on the board.
- Keep the existing story/subtask semantics unchanged: a story lane shows if the story or any subtask matches, and only matching subtasks show. This is identical to assignee behavior.

Do not re-inline any SP predicate in the views. Both views must call the helper (assignee-filter precedent). Run biome on only these three files.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit -p . && npx biome check src/components/UnifiedFilterBar.tsx src/routes/dashboard/BacklogPage.tsx src/routes/dashboard/SprintBoardTab.tsx src/lib/story-points-filter.ts src/stores/filter.store.ts && grep -c "matchesStoryPointsFilter(issue, activeStoryPoints, storyPointsFieldKey)" src/routes/dashboard/BacklogPage.tsx src/routes/dashboard/SprintBoardTab.tsx && grep -c "activeStoryPoints.size > 0" src/routes/dashboard/SprintBoardTab.tsx && npx vitest run src/routes/dashboard src/stores src/lib/story-points-filter.test.ts</automated>
  </verify>
  <done>tsc is clean and biome flags no new diagnostics on the touched files. Both views call matchesStoryPointsFilter once each, and SprintBoardTab's active-filter gate includes activeStoryPoints. The Story Points dropdown renders between Assignee and Status with a pinned, distinct-styled 'No estimate' sentinel. Chips, count badge, Clear and quick-filter save/match include story points. Existing dashboard and store tests pass. One commit.</done>
  <human-check>Run the app (npm run tauri dev). On the Backlog, open Filter, then Story Points. Confirm that values are sorted numerically, 'No estimate' is first and italic, and selecting '3' leaves only 3-pt rows with a 'Story Points: 3' chip. Switch to the Sprint Board and confirm the same filter is active. Save a quick filter, clear it, and re-apply it.</human-check>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API to client | Story-point field values come from Jira/GreenHopper JSON and may be null, missing, or a non-number |
| localStorage to filter.store | Persisted quick filters predate the storyPoints key |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-mgp-01 | Tampering | readStoryPoints | mitigate | Non-finite or non-number field values are coerced to null (treated as "No estimate"). They never become an option string or crash the sort. |
| T-mgp-02 | Spoofing | matchesStoryPointsFilter sentinel | mitigate | The sentinel '__no_estimate__' is matched only when SP is null. Named values use exact Number() equality, so '__no_estimate__'/'abc' parse to NaN and match nothing. No substring matching ('1' never matches 13). |
| T-mgp-03 | Denial of service | applyQuickFilter on legacy persisted filters | mitigate | `storyPoints` is optional on QuickFilter and read as `?? []` everywhere, so old filters apply cleanly with no migration. |
</threat_model>

<verification>
- `npx vitest run` passes in full (the pre-commit hook enforces this)
- `npx tsc --noEmit` is clean; biome adds no new diagnostics on touched files (baseline drifts, so gate on "no new", not on a count)
- Both views import from `@/lib/story-points-filter`, and neither contains an inline story-point comparison
</verification>

<success_criteria>
The Backlog and the Sprint Board share one Story Points filter, numerically sorted, with a conditional 'No estimate' sentinel pinned first. It is persisted in quick filters (back-compatible), shown as chips, and backed by a single tested helper.
</success_criteria>

<output>
Create `.planning/quick/261028-mgp-sprint-board-and-backlog-shared-filter-b/261028-mgp-SUMMARY.md` when done
</output>
