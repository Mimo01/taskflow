# Quick 261105-fw7: Story vs subtask right-side alignment — Summary

Story rows in My Tasks and Standup Today now get a time bar longer than the subtask's by exactly the subtask indent (growing leftward), and subtask rows render no story-points slot.

## Changes
- My Tasks (`MyTaskRow.tsx`): `STORY_TIME_BAR_WIDTH_CLASS = 'w-[132px] @max-[580px]:hidden'` (96 + 36 indent) for stories; subtasks keep `TIME_BAR_WIDTH_CLASS` (w-24). SP slot rendered only for non-subtasks (placeholder removed). Header comment rewritten (removed stale w-36 / 720px tier).
- Standup (`TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`): `TODAY_STORY_TIME_BAR_WIDTH_CLASS = 'w-32 @max-[30rem]:hidden'` (96 + 32) for non-indented rows; SP block only when `showSp && !indented`, with `data-testid="standup-sp-slot"`; `showSp` now computed from story rows only.
- Tests: updated `MyTaskRow.test.tsx`; new `TodayIssueRows.test.tsx` (both sections).

## Commits
- 6ad73c69 My Tasks
- e633ca27 Standup Today

## Deviations
None in production code. Worktree HEAD was reset to the required base d6245cec at start. First pre-commit attempt for task 2 failed once (full suite flake); identical retry passed (281 files, 4403 tests). Pre-existing biome error in `src/lib/internalLinks.test.ts` is unrelated (staged-only check passes).

## Self-Check: PASSED
