---
phase: 26
slug: test-regression-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -30` |
| **Full suite command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -30`
- **After every plan wave:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | TEST-03 | fix | `cd taskflow && npx vitest run --reporter=verbose 2>&1 \| grep -E "FAIL\|PASS\|warn"` | ✅ | ⬜ pending |
| 26-02-01 | 02 | 1 | TEST-04 | fix | `cd taskflow && npx vitest run --reporter=verbose 2>&1 \| grep -i "warning\|teardown"` | ✅ | ⬜ pending |
| 26-03-01 | 03 | 1 | TEST-05 | fix | `cd taskflow && npx tsc --noEmit 2>&1 \| grep -c "error"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
