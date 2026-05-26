---
phase: 68
slug: startup-wizard-integrations-step
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-24
audited: 2026-05-24
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
| WIZ-01-store | 01 | 0 | WIZ-01 | — | N/A | unit | `cd taskflow && npm test -- onboarding.store` | ✅ | ✅ green |
| WIZ-02-aio | 01 | 0 | WIZ-02 | — | N/A | unit | `cd taskflow && npm test -- AioBlock` | ✅ | ✅ green |
| WIZ-02-step | 01 | 1 | WIZ-02 | — | N/A | unit | `cd taskflow && npm test -- IntegrationsStep` | ✅ | ✅ green |
| WIZ-03-tempo | 01 | 1 | WIZ-03 | — | N/A | unit | `cd taskflow && npm test -- IntegrationsStep` | ✅ | ✅ green |
| WIZ-04-store | 01 | 1 | WIZ-04 | — | N/A | unit | `cd taskflow && npm test -- IntegrationsStep` | ✅ | ✅ green |
| WIZ-01-wizard | 03 | 1 | WIZ-01 | — | N/A | integration | `cd taskflow && npm test -- OnboardingWizard` | ✅ (new) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/components/integrations/AioBlock.test.tsx` — covers WIZ-02 picker states (loading/error/empty/loaded)
- [x] `taskflow/src/routes/onboarding/IntegrationsStep.test.tsx` — covers WIZ-02 Continue gating (D-01..D-04), WIZ-03 Tempo toggle, WIZ-04 store binding
- [x] `taskflow/src/stores/onboarding.store.test.ts` — goNext clamps at step 4 and integrationsVisited flag
- [x] `taskflow/src/components/app/OnboardingWizard.test.tsx` — covers WIZ-01 wizard wiring: 5-step labels, IntegrationsStep at index 3, completedSteps derivation

---

## Validation Audit 2026-05-24

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap resolved:** WIZ-01-wizard — `OnboardingWizard.test.tsx` created with 4 tests covering wizard wiring (IntegrationsStep at index 3, 5-step labels, completedSteps derivation). All 35 phase tests green.
