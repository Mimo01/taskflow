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

## Pre-existing Biome Errors (Phase 55-03)

- **Scope:** Pre-existing biome errors/warnings in files NOT touched by Plan 55-03 (e.g., `LazyStore` mock at ~line 45 in test mocks, plus the WikiRenderer issue noted above).
- **Discovered:** 2026-05-14 during Phase 55-03 Task 1 commit (husky pre-commit `npm run check` failed with `Found 1 error. Found 670 warnings.`).
- **Files I modified (Sidebar.tsx, sidebar-items.ts) introduce 0 new errors** — biome reports only the same pre-existing warnings (e.g., `useNamingConvention` on `Tag` import, etc.) that existed before my edits.
- **Action taken:** Task 1 + Task 2 commits made with `--no-verify` per the standing approval (memory `feedback_no_verify_lint.md`).
- **Suggested fix:** `cd taskflow && npm run fix` in a cleanup commit / quick task.

## IN-02 — Direct v16→v17 migration test gap (Phase 55 code review)

- **File:** `taskflow/src/stores/settings.store.test.ts:319-327`
- **Issue:** Existing migration smoke test only asserts the in-memory default value, not the v16→v17 `migrate()` code path at `settings.store.ts:446-448`. If the migration block were deleted, the test would still pass because the default initializer supplies `null`.
- **Discovered:** 2026-05-14 during `/gsd-code-review 55 --fix --all`.
- **Why deferred:** Direct invocation of `migrate()` requires extracting the currently-inline migrate function as a named export from `settings.store.ts`. That's a production-code refactor outside Phase 55's scope ("AIO project selection in settings"). The persist-replay alternative (`useSettingsStore.persist.rehydrate()` against a mocked storage) would touch Zustand's internal API surface in a way that is not the established pattern in this test file.
- **Suggested fix:** In a follow-up cleanup, refactor `settings.store.ts` to export a named `migrateSettings(persisted, version)` function (zero-risk, same logic), reference it from the persist config, and add a direct unit test that exercises the v16→v17 branch with a fixture `{ aioEnabled: true }` (no `selectedAioProjectKey`) and asserts the post-migration result.

## Pre-existing Biome Errors (Phase 55-04)

- **Scope:** Same pre-existing biome errors as Phases 55-01/02/03 — full `npm run check` reports `Found 1 error. Found 675 warnings.` in files NOT touched by Plan 55-04.
- **Discovered:** 2026-05-14 during Phase 55-04 Task 2 commit (`routes.tsx` edit) — husky pre-commit `npm run check` failed on the same unrelated pre-existing errors.
- **Files I modified by Plan 55-04** (`routes.tsx` modification + 3 file deletions + `REQUIREMENTS.md` edit) introduce 0 new errors. Task 1 commit (deletions only, no `routes.tsx` edit) passed husky without `--no-verify`; Task 2 (`routes.tsx` edit) and Task 3 (`REQUIREMENTS.md` edit, no source change) trigger the same project-wide biome check failure as prior plans.
- **Action taken:** Task 2 + Task 3 commits made with `--no-verify` per the standing approval (memory `feedback_no_verify_lint.md`).
- **Suggested fix:** `cd taskflow && npm run fix` in a cleanup commit / quick task.
