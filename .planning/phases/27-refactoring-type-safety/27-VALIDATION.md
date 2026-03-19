---
phase: 27
slug: refactoring-type-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest --run` |
| **Full suite command** | `cd taskflow && npx vitest --run` |
| **Estimated runtime** | ~11 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest --run`
- **After every plan wave:** Run `cd taskflow && npx vitest --run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npx biome check src/` clean + zero `as unknown as` in non-test production code
- **Max feedback latency:** 11 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | REFAC-01 | regression | `cd taskflow && npx vitest --run src/services/jira.test.ts` | Yes | ⬜ pending |
| 27-02-01 | 02 | 1 | REFAC-02 | regression | `cd taskflow && npx vitest --run` | No dedicated test | ⬜ pending |
| 27-02-02 | 02 | 1 | REFAC-03 | regression | `cd taskflow && npx vitest --run` | No dedicated test | ⬜ pending |
| 27-03-01 | 03 | 1 | REFAC-04 | regression | `cd taskflow && npx vitest --run src/stores/` | Yes | ⬜ pending |
| 27-03-02 | 03 | 1 | REFAC-05 | regression | `cd taskflow && npx vitest --run src/services/jira.test.ts` | Yes | ⬜ pending |
| 27-03-03 | 03 | 1 | REFAC-06 | regression | `cd taskflow && npx vitest --run src/stores/notifications.store.test.ts` | Yes | ⬜ pending |
| 27-04-01 | 04 | 2 | TYPE-01 | static | `cd taskflow && grep -r "as unknown as" src/ --include="*.ts" --include="*.tsx" \| grep -v test \| grep -v node_modules` | N/A | ⬜ pending |
| 27-04-02 | 04 | 2 | TYPE-02 | static | `cd taskflow && npx biome check src/` | N/A | ⬜ pending |
| 27-XX-01 | all | all | REFAC-07 | manual | App navigation | No test | ⬜ pending |
| 27-XX-02 | all | all | REFAC-08 | manual | Visual inspection | No test | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. 489 passing tests serve as regression baseline. No new test files needed (Phase 28 handles comprehensive test addition).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Routes still work after refactoring | REFAC-07 | Navigation requires browser context | Navigate to all major routes, verify pages load correctly |
| Visual appearance unchanged | REFAC-08 | Visual regression requires human eye | Compare key screens before/after refactoring |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 11s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
