# Memory Index

- [GSD migrated cc→redux](project_gsd_redux_migration.md) — 2026-05-28: taskflow now runs @opengsd/get-shit-done-redux v1.1.0 (local, full); cc purged, global gsd-sdk removed
- [Release changelogs written by Claude](feedback_release_changelogs.md) — always write release notes personally from git log analysis, not delegated to executor
- [Milestone close: finalize fully](feedback_milestone_close_finalize.md) — push the release tag and commit leftover working-tree items at close, don't leave them local/loose
- [Release vs milestone close](project_release_vs_milestone.md) — vX.Y milestone tag ≠ vX.Y.Z release tag; closing a milestone doesn't release — run release.sh separately
- [v1.8 AIO Test Management milestone](project_v18_aio.md) — Phases 51-54; probe DONE: Bearer PAT confirmed, aio-tcms-api/1.0 base path verified, cycle/testrun/testcase endpoints working
- [Phase 71 GH migration gaps](project_phase71_gh_migration_gaps.md) — 4 blockers CLOSED 2026-05-27 (71-06/07/08), verified passed 4/4; lesson: verify adapters against PROBE-RESULTS, not fabricated fixtures
- [Visual bugs: inspect DOM before CSS](feedback_visual_bugs_dom_first.md) — for spacing/padding/layout bugs, get the rendered DOM before iterating on the cascade
- [Inline UAT gap fixes for trivial diagnoses](feedback_inline_uat_gap_fixes.md) — when debug agents return line-precise fixes (1-4 lines), offer inline option vs full planner ceremony
- [jira.ts dual-file gotcha](project_jira_ts_dual_file.md) — all 60 imports use legacy jira.ts, not jira/ modules; always edit jira.ts until unified
- [Scroll restore reverted](project_scroll_restore_reverted.md) — breadcrumb scroll restoration tried and reverted; main.overflow-auto never scrolls on h-full pages
- [No git stash for lint/test compare](feedback_no_git_stash_for_lint_compare.md) — don't stash to A/B compare findings; tree may be modified concurrently — diff/temp-copy instead
- [Wiki editor = shared TipTap WikiEditor](project_wiki_editor.md) — issue desc + comments use one TipTap WYSIWYG w/ Source toggle; Jira-wiki round-trip via jiraToTiptap/jiraWikiSerializer; task-lists need reconvertTaskItems post-pass
- [Biome baseline GREEN](project_biome_state.md) — `npm run check` (biome check + tsc) fully clean 05-31 (944260ea); lesson: `biome lint` ≠ `check` (lint falsely flags assist suppressions as unused — fix via biome.json override, not deletion)
- [v1.11 audit — one gap before close](project_v111_audit.md) — FieldsSection missing invalidateGhAllData (user fixing); run /gsd-complete-milestone v1.11 after
