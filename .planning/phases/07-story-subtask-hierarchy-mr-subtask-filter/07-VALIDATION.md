---
phase: 7
slug: story-subtask-hierarchy-mr-subtask-filter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green (modulo 2 pre-existing failures)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | HIER-02 | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | HIER-01 | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/MyTasksTab.test.tsx` | ✅ | ⬜ pending |
| 7-03-01 | 03 | 2 | HIER-02 | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 3 | MRAT-01, MRAT-02 | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/MrAttentionTab.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` — stubs for HIER-02 (subtask grouping, column count, collapse toggle)

*All other required test infrastructure exists.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collapse state persists across 60s poll refetch | HIER-02 | Requires live polling observation | Open Sprint Board, expand a story, wait 60s, verify it stays expanded |
| "via [key]" label only shown on MRs that wouldn't appear without subtask path | MRAT-02 | Requires real MR/Jira data to distinguish assignment vs subtask path | Verify no "via" label on MRs already included via direct assignment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
