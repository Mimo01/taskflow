# Phase 55 — Deferred Items

Out-of-scope issues discovered during plan execution. Track here; do not auto-fix.

## Pre-existing Biome Formatter Error (Phase 55-01)

- **File:** `taskflow/src/routes/dashboard/WikiRenderer.test.tsx:202-204`
- **Rule:** `format` — multi-line `.filter((c) => ...)` should be a single line.
- **Discovered:** 2026-05-14 during Phase 55-01 execution; husky pre-commit `npm run check` failed.
- **Root cause:** Introduced in commit `613568e` (quick task `260514-k2u`).
- **Scope:** Unrelated to Phase 55 settings store work.
- **Action taken:** Commit made with `--no-verify` (approved per user feedback memory: "Pre-commit hook --no-verify approved when lint hook fails on pre-existing unrelated warnings").
- **Suggested fix:** Run `npm run fix` (auto-format) in a follow-up cleanup commit or quick task.

## Pre-existing Biome Errors (Phase 55-03)

- **Scope:** Pre-existing biome errors/warnings in files NOT touched by Plan 55-03 (e.g., `LazyStore` mock at ~line 45 in test mocks, plus the WikiRenderer issue noted above).
- **Discovered:** 2026-05-14 during Phase 55-03 Task 1 commit (husky pre-commit `npm run check` failed with `Found 1 error. Found 670 warnings.`).
- **Files I modified (Sidebar.tsx, sidebar-items.ts) introduce 0 new errors** — biome reports only the same pre-existing warnings (e.g., `useNamingConvention` on `Tag` import, etc.) that existed before my edits.
- **Action taken:** Task 1 + Task 2 commits made with `--no-verify` per the standing approval (memory `feedback_no_verify_lint.md`).
- **Suggested fix:** `cd taskflow && npm run fix` in a cleanup commit / quick task.
