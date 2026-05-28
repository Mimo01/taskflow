---
phase: 72
slug: workflow-transitions-via-greenhopper
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `pnpm --filter taskflow test -- --run` |
| **Full suite command** | `pnpm --filter taskflow test -- --run && pnpm --filter taskflow lint` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command (vitest --run, narrowed by file when possible)
- **After every plan wave:** Run full suite (vitest + biome)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 72-01-01 | 01 | 1 | GH-TRANS-01 | — | N/A | unit | `pnpm --filter taskflow test -- --run src/services/jira/greenhopper/transitions.test.ts` | ❌ W0 | ⬜ pending |

*Planner fills in the remaining rows during plan generation; this row is a Wave 0 seed.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/jira/greenhopper/transitions.test.ts` — stubs for GH-TRANS-01 / GH-TRANS-02 / GH-TRANS-03 (envelope indexing, adapter shape, warn-once)
- [ ] `src/services/jira/statuses.test.ts` — stub for `fetchAllJiraStatuses` + map build
- [ ] Existing vitest + React Testing Library setup is reused — no framework install

*Existing infrastructure covers all phase requirements except the new test files above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No per-issue `/rest/api/2/issue/*/transitions` GET in the network log when transitioning on the sprint board | GH-TRANS-02 | Network-tab assertion is operator-driven | 1) Open sprint board for a project; 2) DevTools → Network → filter `transitions`; 3) Drag an issue between columns; 4) Confirm only one `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N` per fresh project (or zero on cache hit), and zero per-issue REST hits |
| Manual refresh toolbar action invalidates and refetches | GH-TRANS-03 | Visual confirmation of toast/inline label + refetch | 1) Click "Reload workflow transitions" in sprint-board toolbar; 2) Confirm both `['gh-transitions', N]` and `['jira-statuses']` queries refetch; 3) Confirm success indicator surfaces |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
