---
phase: 33
slug: board-sprint-filters
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | BOARD-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | BOARD-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 1 | BOARD-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-02-02 | 02 | 1 | BOARD-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-03-01 | 03 | 2 | BOARD-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-03-02 | 03 | 2 | BOARD-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-03-03 | 03 | 2 | BOARD-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-04-01 | 04 | 2 | FILT-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-04-02 | 04 | 2 | FILT-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-04-03 | 04 | 2 | FILT-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 33-04-04 | 04 | 2 | FILT-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for sprint goal banner (BOARD-01)
- [ ] Test stubs for quick filter chips (BOARD-02, BOARD-03, BOARD-04)
- [ ] Test stubs for bulk operations (BOARD-05, BOARD-06, BOARD-07)
- [ ] Test stubs for saved filter CRUD (FILT-01, FILT-02, FILT-03, FILT-04)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sprint goal banner visual rendering | BOARD-01 | Visual layout verification | Open sprint board, verify banner shows sprint goal text with proper styling |
| Quick filter chip toggle UX | BOARD-02 | Interactive toggle behavior | Click filter chips, verify board cards filter in real-time |
| Bulk select + drag interaction | BOARD-05 | DnD + checkbox coexistence | Select multiple cards, verify no DnD conflict on checkbox area |
| Command palette filter access | FILT-04 | E2E navigation flow | Open command palette, search for saved filter, verify it applies |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
