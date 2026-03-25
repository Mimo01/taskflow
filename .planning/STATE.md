---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Release & Auto-Update Pipeline
status: Ready to plan
stopped_at: Phase 41 context gathered
last_updated: "2026-03-25T08:11:05.642Z"
last_activity: 2026-03-25
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 40 — settings-about-menu-integration

## Current Position

Phase: 41
Plan: Not started

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

### Pending Todos

None.

### Blockers/Concerns

- Apple Developer ID certificate ($99/yr) may not yet be acquired — blocks macOS notarization in Phase 41
- Windows code signing decision needed (Azure Trusted Signing vs OV/EV cert) — affects Phase 41 CI config
- Public GitHub repo for release hosting must exist before Phase 41
- Ed25519 signing key generation is irreversible — must be backed up in two locations during Phase 38

## Session Continuity

Last activity: 2026-03-25
Stopped at: Phase 41 context gathered
Resume: `/gsd:plan-phase 38`

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260319-qkn | Add global gitignore with .claude and remove .claude from git | 2026-03-19 | a7e1702 | [260319-qkn-add-global-gitignore-with-claude-and-rem](./quick/260319-qkn-add-global-gitignore-with-claude-and-rem/) |
| 260323-k3x | Add colored status badges to issue status transitions | 2026-03-23 | 6a06445 | [260323-k3x-add-colored-status-badges-to-issue-statu](./quick/260323-k3x-add-colored-status-badges-to-issue-statu/) |
| 260323-kw8 | Add editable fix version picker to issue detail | 2026-03-23 | 5d94455 | [260323-kw8-i-want-to-be-able-to-change-fix-version-](./quick/260323-kw8-i-want-to-be-able-to-change-fix-version-/) |
| 260323-l2k | Fix version picker: only show unreleased + last 10 released | 2026-03-23 | c0bcc3a | [260323-l2k-fix-version-picker-only-show-unreleased-](./quick/260323-l2k-fix-version-picker-only-show-unreleased-/) |
| 260324-0dn | Add edit mode toggle switch to dashboard | 2026-03-24 | 6ef49b1 | [260324-0dn-add-edit-mode-toggle-switch-to-dashboard](./quick/260324-0dn-add-edit-mode-toggle-switch-to-dashboard/) |
| 260324-0q0 | Fix broken settings for role and sidebar, unify sections, add sidebar section support | 2026-03-24 | 357f41f | [260324-0q0-fix-broken-settings-for-role-and-sidebar](./quick/260324-0q0-fix-broken-settings-for-role-and-sidebar/) |
