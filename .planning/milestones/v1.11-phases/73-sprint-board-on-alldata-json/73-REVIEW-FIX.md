---
phase: 73-sprint-board-on-alldata-json
fixed_at: 2026-05-29T00:00:00Z
review_path: .planning/phases/73-sprint-board-on-alldata-json/73-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 73: Code Review Fix Report

**Fixed at:** 2026-05-29
**Source review:** `.planning/phases/73-sprint-board-on-alldata-json/73-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical + 6 Warning; 5 Info findings deferred per `fix_scope=critical_warning`)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: `TaskCard` `timeInColumn` badge fails to render when `enteredStatus === 0`

**Files modified:** `taskflow/src/routes/dashboard/TaskCard.tsx`
**Commit:** 211fdf2e
**Applied fix:** Replaced the truthy `{timeInColumn?.enteredStatus && (...)}` guard with an explicit `!= null` existence check so a legitimate `0` timestamp renders the badge instead of leaking the literal `0` into the DOM.

### WR-01: Stale invalidations target query keys that no longer exist (`GH-CUT-01`)

**Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
**Commit:** cc3c6d90
**Applied fix:** Removed four pairs of `invalidateQueries({ queryKey: ['jira-sprint-stories' | 'jira-sprint-subtasks'] })` from `handleTransition`, `handleToggleFlag`, `ErrorState onRetry`, and `StaleDataBanner onRetry`. Kept only `invalidateGhAllData(...)`. Replaced the misleading "kept for backward-compat" comment with a `GH-CUT-01`-anchored note explaining gh-all-data is the sole data source.

### WR-02: `useSettingsStore()` destructured without selector

**Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
**Commit:** f168187f
**Applied fix:** Replaced the full-store destructure with five per-key selector functions (`useSettingsStore((s) => s.storyPointsFieldKey)` etc.), matching the Sidebar.tsx convention so unrelated settings mutations do not re-render the sprint board.

### WR-03: `useGhTransitions` invoked with sentinel `(0, '')`

**Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
**Commit:** ab909949
**Applied fix:** Verified `useGhTransitions` in `services/jira/greenhopper/transitions.ts:354` already has `enabled: !!jiraBaseUrl && !!token && projectId > 0 && !!issueTypeId`. Added a documenting comment at the call site so future readers know the sentinel-zero fallback is safe (the query stays disabled until the envelope resolves with at least one issue).

### WR-04: `setState` ternary used for side-effects

**Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
**Commit:** 486c4d70
**Applied fix:** Replaced `next.has(key) ? next.delete(key) : next.add(key);` with a plain `if (next.has(key)) next.delete(key); else next.add(key);` — discards no return values, satisfies Biome `noUnusedExpressions`.

### WR-05: Per-render allocation of maps/arrays propagated to virtualizer child

**Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
**Commit:** 15d3a648
**Applied fix:** Wrapped `epicNameMap`, `epicColorMap`, `storyIssues`, `subtaskIssues`, and `swimlanes` in `useMemo` with appropriate deps (`[epicsBasic]` for the epic maps; `[localIssues]` for the issue partitions; `[storyIssues, subtaskIssues]` for swimlanes). Scoped the `subtasksByParent` intermediate inside the `swimlanes` useMemo since it has no other consumer.

### WR-06: `useEffect(() => setBannerDismissed(false), [])` is a no-op on mount

**Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
**Commit:** c18cd96c
**Applied fix:** Restored the intended dependency `[boardId]` so the stale-data banner dismissal resets when the user switches boards (dismissing the banner for board A no longer silences it for board B). Added an explanatory comment.

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Out-of-Scope (Info findings deferred)

The 5 Info findings (IN-01 through IN-05) were not addressed in this iteration per `fix_scope=critical_warning`. They cover documentation/perf micro-issues (formatTimeAgo `0` boundary asymmetry, per-call `Intl.RelativeTimeFormat` allocation, test helper rename, comment grammar, test fixture shape). All are non-blocking and can be picked up in a follow-up pass.

---

_Fixed: 2026-05-29_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
