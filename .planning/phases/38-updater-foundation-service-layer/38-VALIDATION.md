---
phase: 38
slug: updater-foundation-service-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test -- --reporter=dot` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test -- --reporter=dot`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | CI-03 | unit | `npm test -- src/stores/update.store.test.ts` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | CI-04 | unit | `npm test -- src/lib/build-info.test.ts` | ❌ W0 | ⬜ pending |
| 38-02-01 | 02 | 1 | UPD-01 | unit | `npm test -- src/stores/update.store.test.ts` | ❌ W0 | ⬜ pending |
| 38-02-02 | 02 | 1 | UPD-01 | unit | `npm test -- src/stores/settings.store.test.ts` | ✅ | ⬜ pending |
| 38-02-03 | 02 | 1 | UPD-01 | unit | `npm test -- src/services/updater.test.ts` | ❌ W0 | ⬜ pending |
| 38-02-04 | 02 | 1 | UPD-01 | integration | manual-only | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/update.store.test.ts` — stubs for CI-03 version inject + UPD-01 state machine transitions
- [ ] `src/services/updater.test.ts` — stubs for UPD-01 service wrapper (mock `@tauri-apps/plugin-updater`)
- [ ] `src/lib/build-info.test.ts` — stubs for CI-04 `import.meta.env` constant presence

*Extending `src/stores/settings.store.test.ts` for `updateCheckInterval` migration — existing file, not a Wave 0 gap.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `useUpdatePolling` fires after launch delay and on configured interval | UPD-01 | Requires fake timers + mocked Tauri plugin runtime | Run app, verify first check fires ~5-10s after launch; change interval in settings, verify next check fires on new interval |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
