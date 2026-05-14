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
