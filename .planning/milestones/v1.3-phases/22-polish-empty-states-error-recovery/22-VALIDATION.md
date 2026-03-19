---
phase: 22
slug: polish-empty-states-error-recovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | POLISH-03 | unit | `cd taskflow && npx vitest run src/lib/api-error.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | POLISH-01 | unit | `cd taskflow && npx vitest run src/components/ui/empty-state.test.tsx -x` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | POLISH-02 | unit | `cd taskflow && npx vitest run src/components/ui/error-state.test.tsx -x` | ❌ W0 | ⬜ pending |
| 22-01-04 | 01 | 1 | POLISH-02 | unit | `cd taskflow && npx vitest run src/components/ui/stale-data-banner.test.tsx -x` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | POLISH-01, POLISH-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/MyTasksTab.test.tsx -x` | ✅ (update) | ⬜ pending |
| 22-02-02 | 02 | 2 | POLISH-01, POLISH-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -x` | ✅ (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/ui/empty-state.test.tsx` — stubs for POLISH-01
- [ ] `src/components/ui/error-state.test.tsx` — stubs for POLISH-02, POLISH-03
- [ ] `src/components/ui/stale-data-banner.test.tsx` — stubs for POLISH-02
- [ ] `src/lib/api-error.test.ts` — stubs for POLISH-03 (ApiError + isAuthError)

*Existing vitest infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual icon size/spacing in empty states | POLISH-01 | CSS visual verification | Inspect each view with empty data, verify icon is 48-64px muted |
| Reconnect button navigates to Settings > Connections | POLISH-03 | Navigation + visual | Trigger auth error, click Reconnect, verify Connections section visible |
| StaleDataBanner appears above stale data | POLISH-02 | Layout verification | Disconnect network, wait for refetch, verify banner + stale data visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
