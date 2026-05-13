---
phase: 53
slug: cycle-detail-header-pinning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + React Testing Library 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test -- --reporter=dot` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test -- --reporter=dot`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Store migration | store | 1 | AIOP-03 | — | N/A | unit | `npm test -- pinned-tabs.store` | ❌ W0 (extend) | ⬜ pending |
| PinnedTabStrip cycle tabs | strip | 1 | AIOP-01 | — | N/A | component | `npm test -- PinnedTabStrip` | ❌ W0 (extend) | ⬜ pending |
| main.tsx wiring | wiring | 1 | AIOP-01/02 | — | N/A | integration | `npm test -- PinnedTabStrip` | ❌ W0 | ⬜ pending |
| AioCycleDetailPage render | page | 2 | AION-04 | — | N/A | component | `npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |
| Progress bar counts | page | 2 | AIOC-01 | — | N/A | unit | `npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |
| Filter chips | page | 2 | AIOC-02 | — | N/A | component | `npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |
| Defects section | page | 2 | AIOC-03 | — | N/A | component | `npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |
| Pin button | page | 2 | AIOP-01/02 | — | N/A | component | `npm test -- AioCycleDetailPage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/__tests__/AioCycleDetailPage.test.tsx` — stubs for AION-04, AIOC-01, AIOC-02, AIOC-03, AIOP-01, AIOP-02
- [ ] Extend `taskflow/src/stores/__tests__/pinned-tabs.store.test.ts` — v0→v1 migration, `pinnedCycleMeta` persistence (AIOP-03)
- [ ] Extend `taskflow/src/components/app/__tests__/PinnedTabStrip.test.tsx` — cycle tab rendering, FlaskConical icon (AIOP-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pinned cycle tabs persist across app restarts | AIOP-03 | Requires actual Zustand persist / localStorage reload simulation | Pin a cycle, reload the app, verify tab appears in strip |
| Cycle tab click routes to `/aio-cycle/:projectKey/:cycleKey` | AIOP-01 | Full router integration | Click tab, verify URL changes correctly |
| AioTestRun `executedDate` field name | AIOC-02 | Field name unconfirmed; executor must probe live endpoint | Log one live run JSON object before writing type |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
