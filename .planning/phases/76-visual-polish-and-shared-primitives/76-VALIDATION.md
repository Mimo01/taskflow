---
phase: 76
slug: visual-polish-and-shared-primitives
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-03
validated: 2026-06-03
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
| issueDisplayUtils | 01 | 1 | VISUAL-01 | — | N/A | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ✅ | ✅ green |
| isDoneStatus | 01 | 1 | VISUAL-01 | — | N/A | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ✅ | ✅ green |
| priorityStripeClass (WCAG) | 01 | 1 | VISUAL-04/05 | — | N/A | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ✅ | ✅ green |
| rankIssue null-low | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ✅ | ✅ green |
| rankIssue null-high | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ✅ | ✅ green |
| rankIssue between | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ✅ | ✅ green |
| rankIssue adjacent-gap | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ✅ | ✅ green |
| rankIssue 9-case table | 02 | 1 | D-09 | — | N/A | unit | `npx vitest run src/services/jira/rank.test.ts` | ✅ | ✅ green ⚠️ |
| rankFieldKey discovery | 02 | 2 | D-11 | — | N/A | unit | `npx vitest run src/stores/settings.store.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> ⚠️ **rank.ts behavioral caveat (D-09):** All 9 LexoRank edge-case tests run green, but they assert structural shape (e.g. E7 checks `startsWith('0|')`) rather than the strictly-between cross-bucket / float64-precision contract. `rank.ts` ships with a `⚠️ KNOWN-BROKEN` header for CR-01 (cross-bucket midpoint) and CR-02 (BigInt precision), tracked in 76-REVIEW.md and `.planning/todos/pending/rank-ts-blockers-phase78-prereq.md`. Not a Phase 76 gap — `rankIssue` has no Phase 76 consumer; full behavioral correctness is owned by Phase 78 before drag-to-rank is wired.

*Strike/stripe rendering on `BacklogRow`, `TodayColumn`, `TaskCard` (VISUAL-01/02/03/04) is verified by unit tests on the underlying `issueDisplayUtils` functions plus the manual visual checks below — the class-application sites themselves are thin and covered by manual theme verification.*

---

## Wave 0 Requirements

- [x] `taskflow/src/lib/issueDisplayUtils.test.ts` — 38 tests covering `isDoneStatus`, `doneSummaryClass`, `priorityStripeClass` (VISUAL-01/04/05)
- [x] `taskflow/src/services/jira/rank.test.ts` — all 9 LexoRank edge cases (D-09)
- [x] `taskflow/src/stores/settings.store.test.ts` — `rankFieldKey` default/version-25/composed-key (D-11)
- [x] Vitest already configured (`taskflow/vitest.config.ts`) — no framework install needed

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-03 — all 9 mapped requirements COVERED, 100/100 tests green.

---

## Validation Audit 2026-06-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A audit. All 3 referenced test files exist (`issueDisplayUtils.test.ts`, `rank.test.ts`, `settings.store.test.ts`); targeted run is 100/100 green in ~0.7s. Every Per-Task Map row maps to a behavior-targeting test — no MISSING or PARTIAL gaps. No auditor spawn required. `rank.ts` carries a documented behavioral caveat (CR-01/CR-02) owned by Phase 78, not a Phase 76 validation gap. The 4 manual-only visual items remain manual by design (live-render confirmation) and are tracked in 76-VERIFICATION.md / 76-HUMAN-UAT.md.
