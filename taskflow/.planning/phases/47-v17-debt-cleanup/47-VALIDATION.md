---
phase: 47
slug: v17-debt-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --reporter=verbose` |
| **Full suite command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --reporter=verbose`
- **After every plan wave:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | LOAD-03 | manual-only | N/A — doc status update | N/A | ⬜ pending |
| 47-01-02 | 01 | 1 | — | unit | `npm test src/routes/dashboard/BacklogPage.test.tsx` | ✅ | ⬜ pending |
| 47-01-03 | 01 | 1 | — | unit | `npm test src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| REQUIREMENTS.md checkboxes updated | LOAD-03 | Documentation-only change | Read REQUIREMENTS.md, verify LOAD-03 status is updated |
| ROADMAP.md plan checkboxes checked | — | Documentation-only change | Read ROADMAP.md, verify 43-01, 43-02, 45-03 are `[x]` |
| SUMMARY frontmatter corrected | — | Metadata-only change | Read SUMMARY files, verify `requirements-completed` key present |
| Nyquist VALIDATION.md sign-offs | — | Metadata-only change | Read VALIDATION.md files for phases 43-46, verify `nyquist_compliant: true` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
