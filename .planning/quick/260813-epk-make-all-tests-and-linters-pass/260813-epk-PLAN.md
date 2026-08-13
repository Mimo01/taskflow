---
quick_id: 260813-epk
description: make all tests and linters pass
date: 2026-08-13
status: planned
---

# Quick Task 260813-epk: make all tests and linters pass

## Baseline (measured at HEAD 3bb2deec)

| Gate | Command | Result |
|------|---------|--------|
| Tests | `npm run test` | PASS — 184 files, 2660 tests (2 skipped, 13 todo) |
| Types | `tsc --noEmit` | PASS — exit 0 |
| Legacy keys | `node scripts/check-legacy-backlog-keys.mjs` | PASS — "OK" |
| Lint+format | `npm run check` (`biome check ./src && tsc --noEmit`) | **FAIL** — 4 errors, 30 warnings |

Only `biome check` fails. The 4 errors are all `format` diagnostics (formatter output
differs from committed source) in:

- `src/routes/dashboard/BacklogRow.tsx`
- `src/routes/dashboard/TaskCard.tsx`
- `src/routes/dashboard/WikiRenderer.tsx`
- `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx`

The 30 warnings are the pre-existing baseline (`noNonNullAssertion` ×13,
`suppressions/unused` ×11, `noStaticElementInteractions` ×2, `noArrayIndexKey` ×2,
`useKeyWithClickEvents` ×2) across 4 files. Warnings do **not** affect the exit code —
`biome check` exits 0 with warnings present. Per the project's biome-baseline rule
(gate on "no NEW files flagged", never on an absolute count) these are out of scope.

## Tasks

### Task 1 — Reformat the 4 drifted files

- **files:** the 4 files listed above
- **action:** run `npx biome format --write ./src`. Use `format`, not `check --write`,
  so only whitespace/wrapping changes are applied and no lint autofix silently alters
  behaviour.
- **verify:** `git diff --stat` shows only those 4 files; `git diff` contains no
  token changes beyond whitespace/line-wrapping.
- **done:** `npx biome check ./src` reports 0 errors.

### Task 2 — Re-run every gate green

- **action:** run `npm run check`, `npm run test`, and
  `node scripts/check-legacy-backlog-keys.mjs`.
- **verify:** all three exit 0; test count still 2660 passed.
- **done:** full gate matrix green; record the surviving warning baseline in SUMMARY.md.

## must_haves

**truths**
- `npm run check` exits 0 (biome errors: 0; tsc: 0).
- `npm run test` exits 0 with no reduction in passing test count vs. baseline (2660).
- No production behaviour changes — the diff is formatting-only.

**artifacts**
- 4 reformatted `.tsx` files, one atomic commit.
- `260813-epk-SUMMARY.md`.

**key_links**
- `taskflow/biome.json` — formatter/linter config
- `taskflow/package.json` — `check`, `test`, `lint` scripts
