---
phase: 39
slug: update-ux-version-policy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | UPD-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 39-01-02 | 01 | 1 | UPD-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 39-01-03 | 01 | 1 | UPD-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 39-02-01 | 02 | 1 | POL-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 39-02-02 | 02 | 1 | POL-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 39-02-03 | 02 | 1 | POL-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/updateStore.test.ts` — stubs for UPD-02, UPD-03, UPD-04
- [ ] `src/stores/__tests__/versionPolicyStore.test.ts` — stubs for POL-01, POL-02, POL-03
- [ ] `src/components/__tests__/UpdateDialog.test.tsx` — component render stubs
- [ ] `src/components/__tests__/VersionPolicyBanner.test.tsx` — component render stubs

*Existing vitest infrastructure covers framework needs — no new install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Download progress bar animation | UPD-03 | Visual rendering | Trigger update, observe progress bar fills smoothly |
| Full-screen blocking overlay | POL-03 | Visual + interaction | Set version below hardMinimum, verify overlay blocks all interaction |
| Relaunch after install | UPD-03 | OS-level process restart | Click "Update Now", verify app restarts to new version |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
