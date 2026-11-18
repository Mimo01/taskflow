---
quick_id: 261118-kbp
mode: quick
---
# Quick 261118-kbp: scope the pre-commit hook

**Problem:** every commit ran tsc plus the full vitest suite. The hook had not changed since May (a93a8676). The suite grew from 318 to 463 test files in a week (phases 96-102), and 360 of 717 commits since 11-11 staged no taskflow/ files at all (GSD docs).

## Task 1: rewrite taskflow/.husky/pre-commit
- Nothing staged under taskflow/: exit 0.
- biome check --staged (unchanged).
- package(-lock).json, tsconfig*, vitest/vite config, src/test/, or deleted/renamed src: tsc + full suite.
- Other staged src .ts/.tsx: tsc + `vitest related --run <files>`.
- Otherwise: skip tsc and tests.
- Under `sh -e`, every grep inside $(…) needs `|| true`.

**Verify:** run the hook against a temp GIT_INDEX_FILE for three cases: nothing staged, docs-only, one src file.
