---
phase: 35
slug: restore-saved-filters
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | FILT-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 1 | FILT-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 35-01-03 | 01 | 1 | FILT-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 35-01-04 | 01 | 1 | FILT-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for saved filter CRUD operations (FILT-01, FILT-02, FILT-03)
- [ ] Test stubs for attachment delete prop wiring (FILT-04)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Saved filter appears in sidebar | FILT-02 | Visual UI rendering | 1. Save a filter 2. Check sidebar shows it |
| Command palette lists saved filters | FILT-02 | Visual UI rendering | 1. Open command palette 2. Verify filters listed |
| Attachment delete button renders | FILT-04 | Visual UI rendering | 1. Open issue with attachment 2. Verify delete button visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
