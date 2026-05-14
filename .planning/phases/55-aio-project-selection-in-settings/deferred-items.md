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

## Pre-existing Biome Errors During Phase 55-02 Commits

- **Files containing pre-existing errors:** Same `WikiRenderer.test.tsx` and other unrelated files (full `npm run check` reports 2 errors + 673 warnings across the codebase, none introduced by Phase 55-02).
- **Discovered:** 2026-05-14 during Phase 55-02 Task 1 and Task 2 commits.
- **Scope:** Files modified by 55-02 (`IntegrationsSection.tsx`, `IntegrationsSection.test.tsx`) pass `biome check` cleanly (warnings only, no errors).
- **Action taken:** Each task commit made with `--no-verify` per the user feedback memory.
- **Suggested fix:** Run `npm run fix` in a cleanup quick task; or pin Biome errors as a Phase 56 / quick-task cleanup item.
