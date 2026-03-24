# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- ✅ **v1.3 UX & Branding** — Phases 18-24 (shipped 2026-03-19)
- ✅ **v1.4 Internal Quality & Performance** — Phases 25-30 (shipped 2026-03-20)
- ✅ **v1.5 Dashboard Redesign & Feature Parity** — Phases 31-37 (shipped 2026-03-24)
- 🚧 **v1.6 Release & Auto-Update Pipeline** — Phases 38-41 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-12</summary>

- [x] Phase 1: Foundation (6/6 plans) — completed 2026-03-11
- [x] Phase 2: Developer Dashboard (7/7 plans) — completed 2026-03-11
- [x] Phase 3: Notifications Hub (2/2 plans) — completed 2026-03-12
- [x] Phase 4: PM Dashboard + Search (5/5 plans) — completed 2026-03-12

See archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Polish (Phases 5-8) — SHIPPED 2026-03-13</summary>

- [x] Phase 5: API Foundation + Quick Wins (8/8 plans) — completed 2026-03-12
- [x] Phase 6: Workload + Sprint Progress Enrichment (3/3 plans) — completed 2026-03-12
- [x] Phase 7: Story/Subtask Hierarchy + MR Subtask Filter (5/5 plans) — completed 2026-03-13
- [x] Phase 8: Dashboard Enrichment (8/8 plans) — completed 2026-03-13

See archive: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Jira Parity (Phases 9-17) — SHIPPED 2026-03-15</summary>

- [x] Phase 9: Custom Field Discovery + Issue Detail Foundation (8/8 plans) — completed 2026-03-14
- [x] Phase 10: Sprint Board Redesign (4/4 plans) — completed 2026-03-14
- [x] Phase 11: Create/Edit Issue Form (5/5 plans) — completed 2026-03-14
- [x] Phase 12: Backlog View (4/4 plans) — completed 2026-03-14
- [x] Phase 13: Epic Management (5/5 plans) — completed 2026-03-14
- [x] Phase 14: Fix v1.2 Wiring and Credential Bugs (3/3 plans) — completed 2026-03-15
- [x] Phase 15: Fix BOARD-04 statusId Bug — completed 2026-03-15
- [x] Phase 16: Write Missing Phase 10 + 11 VERIFICATION.md — completed 2026-03-15
- [x] Phase 17: Nyquist Validation — Phases 9–14 — completed 2026-03-15

See archive: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v1.3 UX & Branding (Phases 18-24) — SHIPPED 2026-03-19</summary>

- [x] Phase 18: App Icon + Multi-Page Settings (6/6 plans) — completed 2026-03-15
- [x] Phase 19: Keyboard Foundation (6/6 plans) — completed 2026-03-15
- [x] Phase 20: Command Palette + Recent Items (6/6 plans) — completed 2026-03-16
- [x] Phase 21: Header Redesign + Pinned Issue Tabs (5/5 plans) — completed 2026-03-16
- [x] Phase 22: Polish — Empty States + Error Recovery (3/3 plans) — completed 2026-03-16
- [x] Phase 23: Fix J/K Guard (architecturally resolved) — completed 2026-03-19
- [x] Phase 24: Verify Phase 22 (1/1 plan) — completed 2026-03-19

See archive: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.4 Internal Quality & Performance (Phases 25-30) — SHIPPED 2026-03-20</summary>

- [x] Phase 25: Tooling & Dependencies (2/2 plans) — completed 2026-03-19
- [x] Phase 26: Test Regression Fixes (3/3 plans) — completed 2026-03-19
- [x] Phase 27: Refactoring & Type Safety (5/5 plans) — completed 2026-03-19
- [x] Phase 28: Test Coverage, Performance & Accessibility (5/5 plans) — completed 2026-03-20
- [x] Phase 29: Developer Tools (3/3 plans) — completed 2026-03-20
- [x] Phase 30: Fix A11Y-01 Test Regression & Checkbox Cleanup (1/1 plan) — completed 2026-03-20

See archive: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>✅ v1.5 Dashboard Redesign & Feature Parity (Phases 31-37) — SHIPPED 2026-03-24</summary>

- [x] Phase 31: Issue Detail Enrichment (4/4 plans) — completed 2026-03-22
- [x] Phase 32: Time Tracking, Attachments & Mentions (5/5 plans) — completed 2026-03-22
- [x] Phase 33: Board, Sprint & Filters (6/6 plans) — completed 2026-03-23
- [x] Phase 34: Layout Customization (5/5 plans) — completed 2026-03-23
- [x] Phase 35: Restore Saved Filters (3/3 plans) — completed 2026-03-24
- [x] Phase 36: Restore Sidebar Drag-Reorder (1/1 plan) — completed 2026-03-24
- [x] Phase 37: Wire Saved Filters to Sprint Board (1/1 plan) — completed 2026-03-24

See archive: `.planning/milestones/v1.5-ROADMAP.md`

</details>

### v1.6 Release & Auto-Update Pipeline (In Progress)

**Milestone Goal:** Ship Taskflow to users via a public GitHub repo with automated cross-platform builds, in-app auto-updates, version policy enforcement, and a proper About dialog.

- [x] **Phase 38: Updater Foundation + Service Layer** — Rust plugins, config, signing key, update service/store, build-time version injection (completed 2026-03-24)
- [x] **Phase 39: Update UX + Version Policy** — Update check, prompt dialog, download/install flow, what's new dialog, force-update enforcement (completed 2026-03-24)
- [ ] **Phase 40: Settings, About & Menu Integration** — Updates settings section, version history, About dialog, macOS menu bar integration
- [ ] **Phase 41: CI Pipeline** — GitHub Actions workflow, cross-platform builds, public repo publishing, end-to-end validation

## Phase Details

### Phase 38: Updater Foundation + Service Layer
**Goal**: The app has all infrastructure to detect, download, and manage updates — plugins registered, services testable, state machine operational
**Depends on**: Phase 37 (v1.5 complete)
**Requirements**: CI-03, CI-04, UPD-01
**Success Criteria** (what must be TRUE):
  1. App version displayed at runtime matches the git tag it was built from (no hardcoded version strings in config files)
  2. Build metadata (commit SHA, build date) is accessible at runtime via injected constants
  3. App checks for updates on launch and at the user's configured interval (1h/6h/12h/24h/manual) without blocking the UI
  4. Update check results (available version, changelog, errors) flow through a deterministic state machine with no impossible states
**Plans**: 3 plans
Plans:
- [x] 38-01-PLAN.md — Version injection pipeline (git tag to runtime constants)
- [x] 38-02-PLAN.md — Tauri updater plugin, service wrapper, and state machine store
- [x] 38-03-PLAN.md — Update polling hook, settings extension, and tauri.conf.json updater config

### Phase 39: Update UX + Version Policy
**Goal**: Users experience a complete update lifecycle — from notification through installation — and the app enforces minimum version requirements
**Depends on**: Phase 38
**Requirements**: UPD-02, UPD-03, UPD-04, POL-01, POL-02, POL-03
**Success Criteria** (what must be TRUE):
  1. User sees an update prompt dialog showing the new version, rendered markdown changelog, and "Update Now" / "Later" actions
  2. User can download, install, and restart the app in one click with a visible progress bar
  3. After updating, a "What's New" dialog shows the release notes for the version just installed
  4. When the app version is below softMinimum (from version-policy.json on the public repo), a persistent nag banner appears that is dismissible once per session
  5. When the app version is below hardMinimum, a full-screen blocking overlay prevents app use until the user updates; the overlay does not appear if the policy file is unreachable (fail-open)
**Plans**: 2 plans
Plans:
- [x] 39-01-PLAN.md — UpdateDialog lifecycle + WhatsNewDialog + settings store v11 migration
- [x] 39-02-PLAN.md — Version policy service + SoftMinimumBanner + HardMinimumOverlay

### Phase 40: Settings, About & Menu Integration
**Goal**: Users can view version info, control update preferences, browse release history, and access an About dialog from the menu bar
**Depends on**: Phase 38
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. About dialog displays the current version, build date, commit SHA, platform/architecture, and update status
  2. macOS menu bar contains an "About Taskflow" item that opens the About dialog
  3. Settings has an "Updates" section with a check frequency dropdown, a manual "Check Now" button, and the current version
  4. Settings Updates section includes a version history list showing past releases with rendered markdown changelogs
**Plans**: TBD
**UI hint**: yes

### Phase 41: CI Pipeline
**Goal**: A git tag push on the private repo triggers automated cross-platform builds and publishes a release to the public repo — the full distribution pipeline works end-to-end
**Depends on**: Phase 38, Phase 39, Phase 40
**Requirements**: CI-01, CI-02
**Success Criteria** (what must be TRUE):
  1. Pushing a semver git tag (e.g., v1.6.0) to the private repo triggers a GitHub Actions workflow that builds macOS (aarch64 + x86_64), Windows (x86_64), and Linux (x86_64) artifacts
  2. The workflow publishes signed artifacts and a GitHub Release (with release notes) to the separate public repo
  3. An installed copy of Taskflow detects the new release via the updater endpoint and can download + install it (end-to-end update cycle verified)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 38 → 39 → 40 → 41
Note: Phases 39 and 40 both depend only on Phase 38 and are independent of each other.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 38. Updater Foundation + Service Layer | v1.6 | 3/3 | Complete    | 2026-03-24 |
| 39. Update UX + Version Policy | v1.6 | 2/2 | Complete   | 2026-03-24 |
| 40. Settings, About & Menu Integration | v1.6 | 0/TBD | Not started | - |
| 41. CI Pipeline | v1.6 | 0/TBD | Not started | - |
