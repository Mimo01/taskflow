# Quick 261112-o9i: Allow clearing notification cache at 0 items

Removed `disabled={itemCount === 0}` from the Settings Advanced "Clear notification cache" button, made the subtitle and dialog copy count-aware, and added regression tests (enabled at 0, all three cursors reset, count still shown for N>0).

- Commit: c2851e18
- Files: taskflow/src/routes/settings/DebugModeSection.tsx, DebugModeSection.test.tsx
- Deviations: none. Worktree was reset to base b804cdd1 per branch check. Full suite passed in pre-commit.
