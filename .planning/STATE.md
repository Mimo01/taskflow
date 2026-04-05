---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Performance & Perceived Speed
status: Milestone complete
stopped_at: Completed quick-260405-usp-PLAN.md
last_updated: "2026-04-05T23:15:00.000Z"
last_activity: 2026-04-05
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 14
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 49 — fix-backlog-wiring-and-doc-debt

## Current Position

Phase: 49
Plan: Not started
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
- [Phase 47-01]: div-based CSS grid backlog with always-on virtualization; density-aware estimateSize (28/36/44px); per-row epic Skeleton for LOAD-04 progressive loading
- [Phase 47-02]: handleMoveToSprint optimistically updates both jira-backlog-issues and jira-sprint-stories caches for immediate visual feedback
- [Phase 47-02]: vi.resetAllMocks() required in backlog.test.ts beforeEach — clearAllMocks does not clear mockResolvedValueOnce queues
- [Phase 48-01]: mergedSprints derived from sprintList + sprintStories groupBy(sprint.id) — no longer depends on backlogView.sprints
- [Phase 48-01]: epicColorMap uses e.color field (EpicEnriched.color, not epicColor) — corrected at compile time
- [Phase 48]: resetMocks helper needed after vi.resetAllMocks() — re-establishes base mock implementations that resetAllMocks clears
- [Phase 49-fix-backlog-wiring-and-doc-debt]: MrAttentionTab.tsx confirmed removed entirely — annotation uses 'was later removed' not 'renamed'
- [Phase 49-fix-backlog-wiring-and-doc-debt]: Sprint-stories and backlog-issues prefetch fire immediately without boardId; only sprint-list prefetch is gated on boardId resolution

### Roadmap Evolution

- Phase 47 added: Optimize backlog view performance with progressive loading

### Pending Todos

None.

### Blockers/Concerns

- Apple Developer ID certificate ($99/yr) may not yet be acquired — blocks macOS notarization in Phase 41
- Windows code signing decision needed (Azure Trusted Signing vs OV/EV cert) — affects Phase 41 CI config
- Public GitHub repo for release hosting must exist before Phase 41
- Ed25519 signing key generation is irreversible — must be backed up in two locations during Phase 38

## Session Continuity

Last activity: 2026-04-05 - Completed quick task 260405-usp: New Taskflow logo with flow motif
Stopped at: Checkpoint in quick-260405-tci (awaiting human-verify)
Resume: `/gsd:plan-phase 38`

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
| 260401-bcs | Make the unassigned avatar nicer and match it closer to real jira | 2026-04-01 | 13fc317 | | [260401-bcs-make-the-unassigned-avatar-nicer-and-mat](./quick/260401-bcs-make-the-unassigned-avatar-nicer-and-mat/) |
| 260329-kyx | Replace GitHub Actions with local husky hooks + full local release.sh | 2026-03-29 | 8528c2a | Verified | [260329-kyx-replace-github-actions-with-local-proces](./quick/260329-kyx-replace-github-actions-with-local-proces/) |
| 260329-mxv | Make the changelogs look nicer. The update modals are too small. Refine the views | 2026-03-29 | a35bd3f | | [260329-mxv-make-the-changelogs-look-nicer-the-updat](./quick/260329-mxv-make-the-changelogs-look-nicer-the-updat/) |
| 260330-x87 | Right-click context menu on story header rows for status transitions | 2026-03-30 | fba5cbf | | [260330-x87-on-sprint-board-view-right-clicking-on-s](./quick/260330-x87-on-sprint-board-view-right-clicking-on-s/) |
| 260331-039 | On sprint board story headers I also want to see assignee | 2026-03-30 | 0b436b7 | | [260331-039-on-sprint-board-story-headers-i-also-wan](./quick/260331-039-on-sprint-board-story-headers-i-also-wan/) |
| 260331-0dp | Show assignee name (not just avatar) on sprint board story headers | 2026-03-30 | 92e6084 | | [260331-0dp-show-assignee-name-not-just-avatar-on-sp](./quick/260331-0dp-show-assignee-name-not-just-avatar-on-sp/) |
| 260331-0ir | Fix misaligned assignee on sprint board story headers | 2026-03-30 | 207ca56 | | [260331-0ir-fix-misaligned-assignee-on-sprint-board-](./quick/260331-0ir-fix-misaligned-assignee-on-sprint-board-/) |
| 260331-vwn | Redo all animations in sprint board page | 2026-03-31 | eb41471 | Verified | [260331-vwn-redo-all-animations-in-sprint-board-page](./quick/260331-vwn-redo-all-animations-in-sprint-board-page/) |
| 260331-w44 | Full discussion threads on MR detail page | 2026-03-31 | 23465b3 | Verified | [260331-w44-in-merge-request-detail-page-i-want-to-h](./quick/260331-w44-in-merge-request-detail-page-i-want-to-h/) |
| 260331-wzn | Remove the MR attention from sidebar and its page entirely without replacement | 2026-03-31 | 35f93d1 | | [260331-wzn-remove-the-mr-attention-from-sidebar-and](./quick/260331-wzn-remove-the-mr-attention-from-sidebar-and/) |
| 260331-wj7 | Reorganize MR detail page layout and discussion threads UI | 2026-03-31 | — | Verified | [260331-wj7-reorganize-mr-detail-page-layout-and-dis](./quick/260331-wj7-reorganize-mr-detail-page-layout-and-dis/) |
| 260401-bcs | Make the unassigned avatar nicer — person silhouette icon matching Jira style | 2026-04-01 | d98e0a9 | | [260401-bcs-make-the-unassigned-avatar-nicer-and-mat](./quick/260401-bcs-make-the-unassigned-avatar-nicer-and-mat/) |
| 260401-ffx | Remove checkboxes and bottom bulk bar from backlog; add right-click context menu to move issues to sprints | 2026-04-01 | 17d328a | Verified | [260401-ffx-remove-checkboxes-and-bottom-bar-in-back](./quick/260401-ffx-remove-checkboxes-and-bottom-bar-in-back/) |
| 260404-rub | Set up GitHub Actions release process based on pmkar project | 2026-04-04 | e9afd62 | | [260404-rub-set-up-github-actions-release-process-ba](./quick/260404-rub-set-up-github-actions-release-process-ba/) |
| 260405-tci | Change sprint from issue detail sidebar with confirmation + shared sprint menu component | 2026-04-05 | 1f4c3a8 | Verified | [260405-tci-change-sprint-of-a-story-from-issue-deta](./quick/260405-tci-change-sprint-of-a-story-from-issue-deta/) |
| 260405-usp | New Taskflow logo + sidebar branding redesign | 2026-04-05 | c8ed2c3 | Verified | [260405-usp-new-taskflow-logo-with-flow-motif-in-whi](./quick/260405-usp-new-taskflow-logo-with-flow-motif-in-whi/) |
