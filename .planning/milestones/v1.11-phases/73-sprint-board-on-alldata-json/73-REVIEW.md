---
phase: 73-sprint-board-on-alldata-json
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - taskflow/src/components/app/Sidebar.test.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/lib/formatTimeAgo.test.ts
  - taskflow/src/lib/formatTimeAgo.ts
  - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/TaskCard.test.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/services/jira.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/index.ts
  - taskflow/src/services/jira/greenhopper/useGhAllData.test.ts
  - taskflow/src/services/jira/greenhopper/useGhAllData.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 73: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 73 swaps SprintBoardTab from the legacy two-query path (sprint stories + sprint subtasks REST) to a single `useGhAllData` envelope plus caller-side adaptation. The hook, imperative twin, and invalidator in `useGhAllData.ts` are clean; the Sidebar prefetch swap is well-contained and properly chained on `boardId`. The TaskCard `timeInColumn` badge slot and the `formatTimeAgo*` helpers are small, focused, and well-tested.

The bulk of the risk lives in `SprintBoardTab.tsx`: a falsy-zero render guard on the `timeInColumn` badge, a non-selector `useSettingsStore()` destructure that defeats fine-grained reactivity, sentinel-zero invocations of `useGhTransitions` when the envelope has no issues, and leftover invalidations of `'jira-sprint-stories'` / `'jira-sprint-subtasks'` query keys that no longer exist after Plan 03's hard cutover (`GH-CUT-01`). The component also still uses ternary-for-side-effects on a `Set` mutation, which is an established Biome anti-pattern lint rule.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `TaskCard` `timeInColumn` badge fails to render when `enteredStatus === 0`

**File:** `taskflow/src/routes/dashboard/TaskCard.tsx:164`
**Severity:** BLOCKER
**Issue:** The guard `{timeInColumn?.enteredStatus && (...)}` uses the truthiness of `enteredStatus` as both the existence check AND the render guard. When `enteredStatus === 0` (unix epoch — uncommon but possible for clock-skewed, just-reset, or test-fixture envelopes), React will render the literal `0` to the DOM instead of the badge, exposing a stray `"0"` next to the story-points chip. The companion helpers `formatTimeAgoStrict(0)` and `formatTimeAgo(0)` are explicitly tested as non-throwing (see `formatTimeAgo.test.ts:46-48, 87-89`) — the contract is that `0` is a valid input, but this call site silently drops it AND leaks `0` into the DOM.
**Fix:**
```tsx
{timeInColumn?.enteredStatus != null && (
  <span
    className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none"
    title={`Entered status ${formatTimeAgo(timeInColumn.enteredStatus)} ago`}
  >
    {formatTimeAgoStrict(timeInColumn.enteredStatus)}
  </span>
)}
```

## Warnings

### WR-01: Stale invalidations target query keys that no longer exist (`GH-CUT-01`)

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:837-838, 886-887, 1247-1248, 1262-1263`
**Issue:** Four call sites still call `queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] })` and `... ['jira-sprint-subtasks']`. The header comment claims "legacy keys kept for backward-compat with any other consumer that registered them", but Plan 03 (`GH-CUT-01`, commit `0ec8f68f`) deleted `fetchSprintSubtasks` outright and the codebase comment at `jira.ts:1574-1575` confirms the legacy fetchers are gone. `fetchSprintStories` still exists at `jira.ts:468` but it is not registered under either of those query keys anywhere in the new code path. Result: four dead invalidations on every transition / flag toggle / retry / Reload board click. Confusing for future readers and an explicit invitation to forget about them.
**Fix:** Remove the two `invalidateQueries` calls from `handleTransition`, `handleToggleFlag`, the `ErrorState onRetry`, and the `StaleDataBanner onRetry`. Keep only `invalidateGhAllData(queryClient, boardId ?? undefined)`. If a future consumer needs the legacy keys, add them back when that consumer lands — not speculatively.

### WR-02: `useSettingsStore()` destructured without selector — defeats fine-grained reactivity

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:521-527`
**Issue:** `const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, epicColorFieldKey, flaggedFieldKey } = useSettingsStore();` subscribes to the entire settings store. Any mutation to ANY settings-store key (sidebar collapse, density, theme, dev-tools toggle, AIO project change, etc.) will re-render the entire SprintBoardTab — which is large, holds virtualizer state, and is the primary view in this product. The companion file `Sidebar.tsx:79-87` deliberately uses fine-grained selectors for exactly this reason, with an IN-01 comment documenting the pattern. SprintBoardTab violates the codebase's own convention.
**Fix:**
```tsx
const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
const epicLinkFieldKey = useSettingsStore((s) => s.epicLinkFieldKey);
const epicNameFieldKey = useSettingsStore((s) => s.epicNameFieldKey);
const epicColorFieldKey = useSettingsStore((s) => s.epicColorFieldKey);
const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);
```

### WR-03: `useGhTransitions` invoked with sentinel `(0, '')` when envelope has no issues

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:735-742`
**Issue:** `sentinelProjectId` falls back to `0` and `sentinelIssueTypeId` falls back to `''` when `allData?.issuesData.issues[0]` is undefined (empty sprint, initial load before envelope resolves, or failure). `useGhTransitions(0, '')` is then called unconditionally on every render. Depending on the implementation of `useGhTransitions`, this either (a) issues a doomed request for projectId `0`, (b) writes a stale-sentinel entry into the query cache under key `[..., 0, '']`, or (c) is guarded internally — but the call site does not check, and there is no `enabled` gate visible here. The `handleReloadBoard` flow at line 778 explicitly guards with `Number.isFinite(pid) && pid > 0` for the invalidate path, confirming the author knows `0` is invalid; the hook call should match.
**Fix:** Add a `>0` gate before invoking, or pass the sentinels through and have `useGhTransitions` internally apply `enabled: !!projectId && !!issueTypeId`. Verify `useGhTransitions` already has such a gate — if so, document it; if not, add it.

### WR-04: `setState` ternary used for side-effects (Biome `noUnusedExpressions`)

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:544`
**Issue:** `next.has(key) ? next.delete(key) : next.add(key);` uses a conditional expression purely for its side-effects. Biome's `noUnusedExpressions` rule flags this; per the project's memory note (`Biome lint baseline post-260528-ct1: 0 errors, 0 warnings`), the codebase is intentionally maintained at zero-warning. Even if the rule is not currently enabled, it's an established anti-pattern (the return value of `Set.prototype.delete`/`.add` is discarded).
**Fix:**
```ts
if (next.has(key)) next.delete(key);
else next.add(key);
```

### WR-05: Per-render allocation of `epicNameMap` / `epicColorMap` propagated to virtualizer child

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:687-692`
**Issue:** `epicNameMap` and `epicColorMap` are constructed as new `Map` instances on every render and passed as props to `VirtualizedSwimlanes`. They are not memoised. Two consequences: (a) `VirtualizedSwimlanes` re-renders every time SprintBoardTab does — fine in isolation but interacts badly with the scroll-handler `useEffect` that intentionally avoids dep churn via refs (lines 175-194); (b) any future React.memo/useMemo on the child that includes these maps in its dependency list will silently never hit. This is documented in the file's own comments (line 185-188 explicitly calls out the new-array-every-render bug they hit with `filteredSwimlanes`). Same mistake, different prop.
**Fix:** Wrap both Map constructions in `useMemo(() => { ... }, [epicsBasic])`. While here, also memoise `swimlanes`, `storyIssues`, and `subtaskIssues` (lines 905-915) — same per-render allocation pattern.

### WR-06: `useEffect(() => setBannerDismissed(false), [])` is a no-op on mount

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:711-713`
**Issue:** This effect runs once on mount and calls `setBannerDismissed(false)`, but the state already initialises to `false` on the line above. The effect does nothing observable. It looks like a leftover from a deleted dependency (e.g., used to reset on sprint/board change). Dead code that obscures intent.
**Fix:** Either delete the effect entirely, or restore the original dependency (likely `[boardId]` or `[activeSprint?.id]`) so the banner-dismissed state resets when the user switches boards/sprints.

## Info

### IN-01: `formatTimeAgo` and `formatTimeAgoStrict` disagree on the `diffSecs === 0` boundary

**File:** `taskflow/src/lib/formatTimeAgo.ts:33, 54`
**Issue:** `formatTimeAgoStrict(now)` returns `"0s"` (`< 0` guard, then `0 < MINUTE` → template); `formatTimeAgo(now)` returns `"now"` (`<= 0` guard). Both are individually tested. The asymmetry is intentional but undocumented; a reader of the badge "0s" with hover-title "now" will find the mismatch jarring.
**Fix:** Either align both to `<= 0` (strict returns `"now"` too), or add a brief comment at the top of the file documenting the deliberate asymmetry: strict-text always shows a duration unit; natural-phrasing collapses the just-now case to `"now"`.

### IN-02: `formatTimeAgo` allocates a new `Intl.RelativeTimeFormat` per call

**File:** `taskflow/src/lib/formatTimeAgo.ts:52`
**Issue:** Each invocation of `formatTimeAgo` constructs a new `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`. Called once per TaskCard render in a virtualized board with 50+ visible swimlanes, that's a measurable allocation. Move the formatter to module scope.
**Fix:**
```ts
const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function formatTimeAgo(enteredStatusMs: number): string {
  const diffSecs = Math.floor((Date.now() - enteredStatusMs) / 1000);
  // ... use RTF instead of `new Intl.RelativeTimeFormat(...)`
}
```
(Note: performance is out of v1 scope, but this also doubles as a correctness micro-issue — locale is fixed to `'en'`, so memoisation is safe and the per-call construction is purely waste.)

### IN-03: `Sidebar.test.tsx` `renderSidebar()` name is misleading

**File:** `taskflow/src/components/app/Sidebar.test.tsx:112-115`
**Issue:** `renderSidebar(aioEnabled, selectedAioProjectKey)` only mutates two module-level mock variables — it does not render anything. The actual `render()` call lives in every test below. The name implies a higher-level helper than the function delivers.
**Fix:** Rename to `setAioMocks(...)` (or `configureMocks(...)`), or extend it to also call `render(...)` and return the testing-library handle so the per-test boilerplate shrinks.

### IN-04: Comment block on `SprintBoardTab.tsx:733-735` contains an unfinished sentence

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:733-735`
**Issue:** The comment reads: "The sentinel issuetype id still comes from `localIssues[0]` since the adapter preserves `fields.issuetype.id` is absent on AdaptedIssue too — fall back to the raw envelope when needed." The grammar is broken (missing word / dangling clause) and the logic it describes is opaque to a reader who hasn't read R-04. Either rewrite the comment or split it into two: one for projectId sourcing, one for issuetype sourcing.
**Fix:** Rewrite as: "Sentinel issuetype id: `AdaptedIssue.fields.issuetype.id` is the canonical source when at least one local issue exists; otherwise we fall back to the raw GH envelope's `typeId` (stringified). R-04: do NOT use `fields.project` — the adapter does not populate it."

### IN-05: `useGhAllData.test.ts` fixture omits required envelope fields

**File:** `taskflow/src/services/jira/greenhopper/useGhAllData.test.ts:33-40`
**Issue:** `makeAllDataResponse()` returns `{ columnsData, sprintsData, issuesData, entityData }` cast as `GhAllDataResponse`. The real envelope (per `SprintBoardTab.test.tsx:220-239`) includes `rapidViewId`, `swimlanesData`, and richer `issuesData`/`columnsData` shapes. The `as unknown as` cast hides this. Today the hook passes raw through, so the test passes — but if any downstream consumer ever asserts on missing fields, this fixture will mask the regression.
**Fix:** Either fill in the minimal-correct shape (matching `SprintBoardTab.test.tsx:makeAllData`), or extract a single shared fixture helper used by both test files.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
