---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: v1.6.3 milestone complete
stopped_at: Completed 47-01-PLAN.md
last_updated: "2026-03-30T16:33:17Z"
last_activity: 2026-03-30
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Planning next milestone

## Current Position

Milestone v1.6.3 complete. No active phase.

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.6 roadmap]: Coarse granularity — 4 phases covering foundation, update UX, settings/about UI, and CI pipeline
- [v1.6 roadmap]: CI pipeline last — all app-side code must be correct before end-to-end validation
- [v1.6 roadmap]: Phases 39 and 40 are independent (both depend only on 38) — can execute in either order
- [Phase 38]: vi.hoisted() required for vi.mock factory when mock variable declared with const — hoisting order issue in Vitest
- [Phase 38]: #[cfg(desktop)] guard on updater plugin registration — mobile/web targets don't need updater
- [Phase 39-update-ux-version-policy]: Used invoke('plugin:process|relaunch') instead of @tauri-apps/plugin-process — package not in project dependencies
- [Phase 39-update-ux-version-policy]: compare-versions library used for semver comparison with pre-release tag handling
- [Phase 39-update-ux-version-policy]: version-policy.json safe defaults 0.0.0/0.0.0 — no enforcement until intentionally bumped; VERSION_POLICY_URL placeholder for Phase 41
- [Phase 40-01]: Used DialogFooter with explicit Button for close — consistent with UpdateDialog pattern, cleaner control over button styling
- [Phase 40]: Used placeholder GitHub Releases API URL (PLACEHOLDER/PLACEHOLDER) — real repo path to be set in Phase 41
- [Phase 40]: Used level:2 heading selector and isolated QueryClient per-test to fix TanStack Query caching in tests
- [Phase 41-ci-pipeline]: RELEASES_REPO_TOKEN (not GITHUB_TOKEN) for cross-repo publish to Mimo01/taskflow-releases
- [Phase 41-ci-pipeline]: releaseDraft: false for fully automatic release publish without manual approval
- [Phase 41-ci-pipeline]: shell: bash on inject-version and tag_body steps for Windows PowerShell cross-platform compatibility
- [Phase 45-01]: fetchSprintIssues kept as deprecated wrapper for fetchMyTasksHierarchy backward compat
- [Phase 45-01]: BacklogViewData epicNames/epicColors made optional (not removed) for backward compat with existing consumers
- [Phase 45-02]: storyIssues/subtaskIssues rename to avoid variable collision with stories query result in SprintBoardTab
- [Phase 45-02]: BacklogPage imports BacklogViewData from @/services/jira/types (not jira.ts) to match optional epicNames/epicColors
- [Phase 45-02]: BacklogPage imports fetchBacklogView from @/services/jira/backlog (new module); boardId passed to queryFn but NOT in queryKey
- [Phase 45-02]: settings.store bumped to persist version 13 with jiraConcurrencyLimit default 6
- [Phase 47-01]: Replace literal staleTime values with STALE_TIME_MS constant from @/lib/query-constants — single source of truth enforced

### Pending Todos

None.

### Blockers/Concerns

- Apple Developer ID certificate ($99/yr) may not yet be acquired — blocks macOS notarization in Phase 41
- Windows code signing decision needed (Azure Trusted Signing vs OV/EV cert) — affects Phase 41 CI config
- Public GitHub repo for release hosting must exist before Phase 41
- Ed25519 signing key generation is irreversible — must be backed up in two locations during Phase 38

## Session Continuity

Last activity: 2026-03-30
Stopped at: Completed 47-01-PLAN.md (stale constants, dead mock, stats.html cleanup)
Resume: Phase 47 v17-debt-cleanup plan 01 complete — continue with plan 02 if exists

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260319-qkn | Add global gitignore with .claude and remove .claude from git | 2026-03-19 | a7e1702 | [260319-qkn-add-global-gitignore-with-claude-and-rem](./quick/260319-qkn-add-global-gitignore-with-claude-and-rem/) |
| 260323-k3x | Add colored status badges to issue status transitions | 2026-03-23 | 6a06445 | [260323-k3x-add-colored-status-badges-to-issue-statu](./quick/260323-k3x-add-colored-status-badges-to-issue-statu/) |
| 260323-kw8 | Add editable fix version picker to issue detail | 2026-03-23 | 5d94455 | [260323-kw8-i-want-to-be-able-to-change-fix-version-](./quick/260323-kw8-i-want-to-be-able-to-change-fix-version-/) |
| 260323-l2k | Fix version picker: only show unreleased + last 10 released | 2026-03-23 | c0bcc3a | [260323-l2k-fix-version-picker-only-show-unreleased-](./quick/260323-l2k-fix-version-picker-only-show-unreleased-/) |
| 260324-0dn | Add edit mode toggle switch to dashboard | 2026-03-24 | 6ef49b1 | [260324-0dn-add-edit-mode-toggle-switch-to-dashboard](./quick/260324-0dn-add-edit-mode-toggle-switch-to-dashboard/) |
| 260324-0q0 | Fix broken settings for role and sidebar, unify sections, add sidebar section support | 2026-03-24 | 357f41f | [260324-0q0-fix-broken-settings-for-role-and-sidebar](./quick/260324-0q0-fix-broken-settings-for-role-and-sidebar/) |
| 260325-k0s | Add CI workflow for lint/typecheck/tests on push and PR to main | 2026-03-25 | 4d3e312 | [260325-k0s-set-up-a-proper-process-for-pipelines-ch](./quick/260325-k0s-set-up-a-proper-process-for-pipelines-ch/) |
| 260326-ivv | Add generate-changelog.sh and update release.sh for auto-generated categorized changelogs | 2026-03-26 | a9685fe | [260326-ivv-fix-release-history-changelog-build-prop](./quick/260326-ivv-fix-release-history-changelog-build-prop/) |
| 260326-j2q | Remove saved filters from the sidebar | 2026-03-26 | fb6f8cd | [260326-j2q-remove-saved-filters-from-the-sidebar](./quick/260326-j2q-remove-saved-filters-from-the-sidebar/) |
| 260326-mfp | release version 1.6.1 | 2026-03-26 | 3f30b56 | [260326-mfp-release-version-1-6-1](./quick/260326-mfp-release-version-1-6-1/) |
| 260327-edt | re-release v1.6.1 macOS universal binary (local build) | 2026-03-27 | — | | [260327-edt-re-release-version-1-6-1-build-releases-](./quick/260327-edt-re-release-version-1-6-1-build-releases-/) |
| 260329-k5y | Implement changelog and versioning process inspired by pmkar project | 2026-03-29 | e5ba721 | Verified | [260329-k5y-implement-changelog-and-versioning-proce](./quick/260329-k5y-implement-changelog-and-versioning-proce/) |
| 260329-kyx | Replace GitHub Actions with local husky hooks + full local release.sh | 2026-03-29 | 8528c2a | Verified | [260329-kyx-replace-github-actions-with-local-proces](./quick/260329-kyx-replace-github-actions-with-local-proces/) |
| 260329-mxv | Make the changelogs look nicer. The update modals are too small. Refine the views | 2026-03-29 | a35bd3f | | [260329-mxv-make-the-changelogs-look-nicer-the-updat](./quick/260329-mxv-make-the-changelogs-look-nicer-the-updat/) |
