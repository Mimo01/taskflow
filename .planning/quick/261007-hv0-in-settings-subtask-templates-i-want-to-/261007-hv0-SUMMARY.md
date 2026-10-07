---
phase: quick-261007-hv0
plan: 01
status: complete
completed: 2026-10-07
key-files:
  modified:
    - taskflow/src/stores/subtask-templates.store.ts
    - taskflow/src/stores/subtask-templates.store.test.ts
    - taskflow/src/routes/settings/SubtaskTemplatesSection.tsx
---

# Quick 261007-hv0: Duplicate subtask template

Added a `duplicateTemplate` store action (copy inserted right after the source, named "<name> (copy)", fresh UUIDs for template and rows, cloned labels/components/customFieldValues) and a Copy icon button on each template card in Settings that duplicates and opens the copy's row editor.

## Commits
- bdaded6a: store action + tests (3 tests)
- 7dab588d: Duplicate button on template card

## Deviations
- Worktree HEAD was reset to the required base c66c3010 (per branch check).
- jsdom here lacks `crypto.randomUUID`; the tests stub it (as the plan allowed).
- Symlinked `taskflow/node_modules` in the worktree to the main checkout so tests/tsc could run (untracked, not committed).

## Verification
Full vitest suite (pre-commit) passed, tsc clean, biome clean on touched files.
