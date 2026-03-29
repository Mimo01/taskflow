---
phase: 40
slug: settings-about-menu-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via existing config) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | UI-01 | unit | `vitest run src/components/about` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | UI-02 | unit | `vitest run src/components/about` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 1 | UI-03 | unit | `vitest run src/components/settings` | ❌ W0 | ⬜ pending |
| 40-02-02 | 02 | 1 | UI-04 | unit | `vitest run src/components/settings` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for About dialog component (UI-01, UI-02)
- [ ] Test stubs for Settings Updates section (UI-03, UI-04)
- [ ] Test stubs for version history fetching and rendering

*Existing vitest infrastructure covers framework needs — no new install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS menu bar shows "About Taskflow" item | UI-02 | Requires native macOS menu rendering | Click app menu → verify "About TaskFlow" item appears → click it → verify custom dialog opens |
| About dialog displays correct platform/arch | UI-01 | Requires runtime Tauri API | Open About dialog → verify platform and architecture match host system |
| "Check Now" button triggers real update check | UI-03 | Requires network + Tauri updater API | Click "Check Now" → verify spinner appears → verify result displays |
| Version history loads from GitHub Releases | UI-04 | Requires network access to GitHub API | Open Settings → Updates → scroll to version history → verify releases render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
