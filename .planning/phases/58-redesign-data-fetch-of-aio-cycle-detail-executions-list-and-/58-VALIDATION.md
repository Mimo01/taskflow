---
phase: 58
slug: redesign-data-fetch-of-aio-cycle-detail-executions-list-and
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test -- --reporter=verbose AioCycleDetailPage` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~30 seconds (quick), ~2 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test -- --reporter=verbose AioCycleDetailPage`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-probe-01 | probe | 0 | — | — | N/A | manual | — | — | ⬜ pending |
| 58-01-01 | 01 | 1 | progress-bar-decoupled | — | N/A | component | `npm test -- AioCycleDetailPage` | ⚠️ W0 | ⬜ pending |
| 58-01-02 | 01 | 1 | run-table-concurrent | — | N/A | component | `npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |
| 58-02-01 | 02 | 1 | defect-no-double-resolution | — | N/A | unit | `npm test -- issue-runs` | ❌ W0 | ⬜ pending |
| 58-02-02 | 02 | 1 | new-fetch-error-handling | — | N/A | unit | `npm test -- cycles` | ❌ W0 | ⬜ pending |
| 58-03-01 | 03 | 2 | credential-gate-no-401-flash | — | N/A | component | `npm test -- AioCycleDetailPage` | ⚠️ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/pages/aio/AioCycleDetailPage.test.tsx` — update to cover decoupled progress bar behavior
- [ ] `taskflow/src/services/aio/cycles.test.ts` — add coverage for any new fetch function discovered by probe
- [ ] `taskflow/src/services/aio/issue-runs.test.ts` — add test verifying defects are NOT double-resolved (service returns raw IDs, component resolves)

*Wave 0 gaps reduce if probe finds no new fetch function is needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New run-list endpoint exists and returns expected shape | Probe prerequisite | Requires live AIO instance access | Open DevTools on AIO cycle detail page, check Network tab for `/rest/aio-tcms/1.0` run list endpoints |
| Progress bar loads faster than run table | UX improvement | Timing/perception — automated tests cannot measure render perception | Navigate to a large cycle (100+ runs), observe progress bar appears before full run table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
