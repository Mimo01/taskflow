---
phase: 37
slug: wire-saved-filters-to-board
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | taskflow/vitest.config.ts |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | FILT-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -t "saved filter"` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | FILT-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -t "clear saved filter"` | ❌ W0 | ⬜ pending |
| 37-01-03 | 01 | 1 | FILT-04 | unit | `cd taskflow && npx vitest run src/components/SavedFilterList.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add saved filter integration tests to `SprintBoardTab.test.tsx` — covers FILT-02
- [ ] Mock `useSavedFilterStore` in SprintBoardTab test setup — required for new tests

*Existing infrastructure covers FILT-04 (sidebar/command palette already tested).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual filter banner appears when saved filter active | FILT-02 | UI rendering verification | 1. Click a saved filter in sidebar 2. Verify banner shows filter name 3. Click "Clear" 4. Verify banner disappears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
