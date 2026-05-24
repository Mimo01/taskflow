---
phase: 68
slug: startup-wizard-integrations-step
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 68 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| WIZ-01-store | 01 | 0 | WIZ-01 | — | N/A | unit | `cd taskflow && npm test -- onboarding.store` | ✅ (new case) | ⬜ pending |
| WIZ-02-aio | 01 | 0 | WIZ-02 | — | N/A | unit | `cd taskflow && npm test -- AioBlock` | ❌ W0 | ⬜ pending |
| WIZ-02-step | 01 | 1 | WIZ-02 | — | N/A | unit | `cd taskflow && npm test -- IntegrationsStep` | ❌ W0 | ⬜ pending |
| WIZ-03-tempo | 01 | 1 | WIZ-03 | — | N/A | unit | `cd taskflow && npm test -- IntegrationsStep` | ❌ W0 | ⬜ pending |
| WIZ-04-store | 01 | 1 | WIZ-04 | — | N/A | unit | `cd taskflow && npm test -- IntegrationsStep` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/components/integrations/AioBlock.test.tsx` — covers WIZ-02 picker states (loading/error/empty/loaded) — adapt from `IntegrationsSection.test.tsx` mocks
- [ ] `taskflow/src/routes/onboarding/IntegrationsStep.test.tsx` — covers WIZ-02 Continue gating (D-01..D-04), WIZ-03 Tempo toggle, WIZ-04 store binding
- [ ] New test case in `taskflow/src/stores/onboarding.store.test.ts` — goNext clamps at step 4 (not 3) and integrationsVisited flag (if added by planner)
