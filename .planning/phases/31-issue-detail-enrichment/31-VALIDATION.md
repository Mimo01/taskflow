---
phase: 31
slug: issue-detail-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
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
| 31-01-01 | 01 | 1 | DETAIL-01 | unit | `cd taskflow && npx vitest run src/services/jira/changelog.test.ts -x` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | DETAIL-02 | unit | `cd taskflow && npx vitest run src/services/jira/changelog.test.ts -x` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | DETAIL-03 | unit | `cd taskflow && npx vitest run src/services/jira/comments.test.ts -x` | ✅ | ⬜ pending |
| 31-01-04 | 01 | 1 | DETAIL-04 | unit | `cd taskflow && npx vitest run src/services/jira/comments.test.ts -x` | ✅ | ⬜ pending |
| 31-02-01 | 02 | 1 | DETAIL-05 | unit | `cd taskflow && npx vitest run src/services/jira/watchers.test.ts -x` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 2 | DETAIL-10 | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/OverdueBadge.test.ts -x` | ❌ W0 | ⬜ pending |
| 31-03-02 | 03 | 2 | DETAIL-11 | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/clone.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/services/jira/changelog.test.ts` — stubs for DETAIL-01, DETAIL-02
- [ ] `taskflow/src/services/jira/watchers.test.ts` — stubs for DETAIL-05
- [ ] `taskflow/src/routes/dashboard/issue-detail/OverdueBadge.test.ts` — stubs for DETAIL-10
- [ ] `taskflow/src/routes/dashboard/issue-detail/clone.test.ts` — stubs for DETAIL-11

*Existing infrastructure covers DETAIL-03/DETAIL-04 (comment edit/delete already implemented with tests).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timeline visual rendering (card vs compact styles) | DETAIL-01 | CSS/layout visual correctness | Open issue detail, verify comments show as cards, field changes as compact lines |
| Filter chip highlighting | DETAIL-02 | Visual state (active chip highlight) | Click each filter chip, verify active state styling |
| Watcher toggle UI feedback | DETAIL-05 | Optimistic toggle animation | Click watch/unwatch, verify instant UI update before API returns |
| Overdue badge placement across views | DETAIL-10 | Multi-page visual check | Check detail sidebar, sprint board cards, backlog rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
