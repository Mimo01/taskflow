---
phase: 76
slug: visual-polish-and-shared-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 76 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/services/jira/rank.test.ts src/lib/issueDisplayUtils.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds (targeted) / full suite per project baseline |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/services/jira/rank.test.ts src/lib/issueDisplayUtils.test.ts`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds (targeted run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| issueDisplayUtils | 01 | 1 | VISUAL-01 | — | N/A | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ❌ W0 | ⬜ pending |
| isDoneStatus | 01 | 1 | VISUAL-01 | — | N/A | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ❌ W0 | ⬜ pending |
| priorityStripeClass (WCAG) | 01 | 1 | VISUAL-04/05 | — | N/A | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ❌ W0 | ⬜ pending |
| rankIssue null-low | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ W0 | ⬜ pending |
| rankIssue null-high | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ W0 | ⬜ pending |
| rankIssue between | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ W0 | ⬜ pending |
| rankIssue adjacent-gap | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ W0 | ⬜ pending |
| rankIssue 9-case table | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ W0 | ⬜ pending |
| rankFieldKey discovery | 02 | 2 | D-11 | — | N/A | unit | `npx vitest run src/stores/settings.store.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Strike/stripe rendering on `BacklogRow`, `TodayColumn`, `TaskCard` (VISUAL-01/02/03/04) is verified by unit tests on the underlying `issueDisplayUtils` functions plus the manual visual checks below — the class-application sites themselves are thin and covered by manual theme verification.*

---

## Wave 0 Requirements

- [ ] `taskflow/src/lib/issueDisplayUtils.test.ts` — stubs for `isDoneStatus`, `doneSummaryClass`, `priorityStripeClass` (VISUAL-01/04/05)
- [ ] `taskflow/src/services/jira/rank.test.ts` — stubs for all 9 edge cases from the LexoRank edge-case table (D-09)
- [ ] Vitest already configured (`taskflow/vitest.config.ts`) — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Done key struck-through on Backlog active-sprint list | VISUAL-01 | Visual rendering across theme | Load Backlog with a done story; confirm issue key `<span>` shows line-through in light + dark |
| Done key struck-through in Standup Today section | VISUAL-02 | Visual rendering; depends on a done item surfacing in Today | Open Standup Notes with a mid-day-transitioned done item in Today; confirm key strike |
| Dashboard per-story done strike | VISUAL-03 | Aggregate-only escape hatch | Confirm Dashboard has no per-story issue-key rows; if rows exist, confirm strike applied |
| Priority stripe legible ≥ 3:1 both themes | VISUAL-04/05 | Visual contrast verification | View sprint board cards across all priorities in light + dark; confirm red→gray ramp visible and stripe distinguishable from `bg-card` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
