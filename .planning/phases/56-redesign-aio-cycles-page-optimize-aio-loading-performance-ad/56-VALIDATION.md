---
phase: 56
slug: redesign-aio-cycles-page-optimize-aio-loading-performance-ad
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `taskflow/vite.config.ts` (vitest inline config) |
| **Quick run command** | `cd taskflow && npm test -- --reporter=dot` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test -- --reporter=dot`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-W0-01 | W0 | 0 | AION-03 | — | N/A | unit | `cd taskflow && npm test -- AioProjectOverviewPage` | ❌ W0 | ⬜ pending |
| 56-W0-02 | W0 | 0 | AIOC-03 | — | N/A | unit | `cd taskflow && npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |
| 56-W0-03 | W0 | 0 | D-14 | — | N/A | unit | `cd taskflow && npm test -- useAioCredentials` | ❌ W0 new | ⬜ pending |
| 56-01-01 | 01 | 1 | AION-03 | — | N/A | unit | `cd taskflow && npm test -- AioProjectOverviewPage` | ✅ exists | ⬜ pending |
| 56-02-01 | 02 | 1 | D-01/D-02 | — | N/A | unit | `cd taskflow && npm test -- AioCycleDetailPage` | ✅ exists | ⬜ pending |
| 56-03-01 | 03 | 1 | D-14/D-15 | T-56-01 | Token not exposed in query keys | unit | `cd taskflow && npm test -- useAioCredentials` | ❌ W0 | ⬜ pending |
| 56-04-01 | 04 | 2 | AIOC-03/D-08 | T-56-02 | Defect key encoded via encodeURIComponent | unit | `cd taskflow && npm test -- AioCycleDetailPage` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` — new cases: per-row stats skeleton renders, per-row stats loaded counts match normalizeStatus reduction (AION-03)
- [ ] `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` — new cases: Executions tab structure, run row click navigates to run detail, Defects tab enriched rows, Defects tab empty state (AIOC-03, D-08)
- [ ] `taskflow/src/hooks/useAioCredentials.test.ts` — new file: token loading, isLoading flag transition true→false, readSecret error path returns null (D-14/D-15)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cycles page loads within perceived performance budget | D-03 | Network timing requires real AIO backend | Load AIO project overview, observe skeleton→data transition under normal network |
| Defect enrichment graceful degradation | AIOC-03 | Requires partial-failure AIO response | Simulate defect fetch returning null; verify row shows key only without crashing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
