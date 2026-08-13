---
quick_id: 260813-epk
description: make all tests and linters pass
date: 2026-08-13
status: complete
commit: 494ff60b
---

# Quick Task 260813-epk: make all tests and linters pass

## What was wrong

Only one gate was failing. Measured at HEAD `3bb2deec`:

| Gate | Command | Before | After |
|------|---------|--------|-------|
| Tests | `npm run test` | PASS (2660) | PASS (2660) |
| Types | `tsc --noEmit` | PASS | PASS |
| Legacy keys | `node scripts/check-legacy-backlog-keys.mjs` | PASS | PASS |
| Lint+format | `npm run check` | **FAIL** — 4 errors | **PASS** — exit 0 |

The 4 errors were all `format` diagnostics — committed source differed from what the
biome formatter would emit — in `BacklogRow.tsx`, `TaskCard.tsx`, `WikiRenderer.tsx`,
and `release-detail/UnifiedTaskTable.tsx`. Since `biome check` treats format drift as an
error, `npm run check` exited non-zero even though nothing was semantically wrong.

## What changed

Ran `npx biome format --write ./src` — deliberately `format`, **not** `check --write`,
so only whitespace/wrapping was touched and no lint autofix could silently change
behaviour. 4 files fixed, 188 insertions / 183 deletions.

`BacklogRow.tsx` accounts for 348 of those lines, but it is a single structural
re-wrap: the formatter de-nested the `React.forwardRef(function BacklogRow(...))`
callback onto the `forwardRef` line, which re-indented the whole component body.
`git diff -w` reduces the entire changeset to 17 insertions / 12 deletions, all of
them line joins or splits — no token changes.

Commit: `494ff60b` (code). The pre-commit hook ran biome on the staged files plus the
full vitest suite; both passed.

## Surviving warning baseline (out of scope, non-blocking)

`biome check` exits 0 with these 30 warnings present — they do not affect the exit
code, and per the project's biome-baseline rule the gate is "no NEW files flagged",
never an absolute count. Unchanged by this task:

| Rule | Count |
|------|-------|
| `lint/style/noNonNullAssertion` | 13 |
| `suppressions/unused` | 11 |
| `lint/a11y/noStaticElementInteractions` | 2 |
| `lint/suspicious/noArrayIndexKey` | 2 |
| `lint/a11y/useKeyWithClickEvents` | 2 |

Across 4 files: `components/ui/chart.tsx` (4), `dashboard/BacklogRow.tsx` (4),
`my-tasks/MyTasksPage.test.tsx` (9), `my-tasks/MyTasksPage.tsx` (13).

The 11 `suppressions/unused` are stale `biome-ignore` comments and would be a safe
cleanup; the 13 `noNonNullAssertion` in `MyTasksPage.tsx` are a real (if minor) code
smell. Both were left alone — clearing warnings was not needed to make the gates pass,
and touching `MyTasksPage.tsx` carries more risk than the task warrants.

## Verification

```
npm run check   → exit 0   (biome: 0 errors, 30 warnings; tsc: clean)
npm run test    → exit 0   (184 files passed, 2660 tests passed, 2 skipped, 13 todo)
check-legacy-backlog-keys.mjs → exit 0 ("OK")
```
