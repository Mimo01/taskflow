# Requirements: Taskflow

**Defined:** 2026-03-24
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.6 Requirements

Requirements for Release & Auto-Update Pipeline milestone. Each maps to roadmap phases.

### CI Pipeline

- [ ] **CI-01**: CI builds cross-platform artifacts (macOS aarch64+x86_64, Windows x86_64, Linux x86_64) on git tag push
- [ ] **CI-02**: CI publishes release artifacts to a separate public GitHub repo with GitHub Release notes
- [ ] **CI-03**: App version is derived from git tag at build time (no manual version bumps in config files)
- [ ] **CI-04**: Build-time metadata (commit SHA, build date) is injected and accessible at runtime

### Auto-Update

- [ ] **UPD-01**: App checks for updates on launch and at a configurable interval (1h/6h/12h/24h/manual)
- [ ] **UPD-02**: Update prompt dialog shows changelog (rendered markdown), new version, and "Update Now" / "Later" actions
- [ ] **UPD-03**: User can download, install, and restart the app in one click with a progress bar
- [ ] **UPD-04**: After updating, a "What's New" dialog shows the release notes for the version just installed

### Version Policy

- [ ] **POL-01**: Public repo hosts a version-policy.json defining softMinimum and hardMinimum version thresholds
- [ ] **POL-02**: App shows a persistent nag banner (dismissible once per session) when below softMinimum
- [ ] **POL-03**: App shows a full-screen blocking overlay (no dismiss) when below hardMinimum; fails open if policy unreachable

### App UI

- [ ] **UI-01**: About dialog displays version, build date, commit SHA, platform/arch, and update status
- [ ] **UI-02**: macOS menu bar has "About Taskflow" item that opens the About dialog
- [ ] **UI-03**: Settings has an "Updates" section with check frequency, manual check button, and current version
- [ ] **UI-04**: Settings Updates section includes a version history list showing all past releases with changelogs

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Update Enhancements

- **UPD-05**: Update available badge indicator on Settings sidebar navigation item
- **UPD-06**: Staged rollouts (percentage-based release to subset of users)
- **UPD-07**: Update adoption telemetry dashboard

### Enterprise

- **ENT-01**: Admin-managed update policies for multi-team deployment

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Silent auto-install without consent | Users lose work if app restarts mid-task; violates trust |
| Delta/differential updates | Tauri doesn't support it; full binary is ~10MB, trivial to download |
| Auto-update rollback UI | Creates version fragmentation; push patch releases instead |
| Multiple update channels (stable/beta/nightly) | Triples CI complexity; tiny user base doesn't justify it |
| P2P update distribution | NAT complexity; GitHub CDN is free and sufficient |
| Custom update server | Adds infrastructure; GitHub Releases serves static latest.json natively |
| In-app release notes editor | Scope creep; release notes belong in CI/release process |
| Code signing (Apple/Windows) | Requires paid certificates ($99-500/yr); defer to v1.7+ if needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CI-01 | Phase 41 | Pending |
| CI-02 | Phase 41 | Pending |
| CI-03 | Phase 38 | Pending |
| CI-04 | Phase 38 | Pending |
| UPD-01 | Phase 38 | Pending |
| UPD-02 | Phase 39 | Pending |
| UPD-03 | Phase 39 | Pending |
| UPD-04 | Phase 39 | Pending |
| POL-01 | Phase 39 | Pending |
| POL-02 | Phase 39 | Pending |
| POL-03 | Phase 39 | Pending |
| UI-01 | Phase 40 | Pending |
| UI-02 | Phase 40 | Pending |
| UI-03 | Phase 40 | Pending |
| UI-04 | Phase 40 | Pending |

**Coverage:**
- v1.6 requirements: 15 total
- Mapped to phases: 15/15
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
