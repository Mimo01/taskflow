---
phase: 13
slug: epic-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | EPIC-01 | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | EPIC-01 | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | EPIC-02 | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | EPIC-02 | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 3 | EPIC-03 | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 13-04-01 | 04 | 4 | EPIC-04 | type | `npm run typecheck` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (TypeScript + vitest + Vite build pipeline already in place).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Epic list renders with story count and points | EPIC-01 | UI rendering in browser | Navigate to /epics, verify table shows name, status, story count, story points |
| Sprint board filters by selected epic | EPIC-02 | Cross-component interaction | Select an epic, verify sprint board shows only issues from that epic |
| Backlog filters by selected epic | EPIC-02 | Cross-component interaction | Select an epic, verify backlog shows only issues from that epic |
| Epic detail sheet opens with stories | EPIC-03 | UI interaction | Click epic, verify sheet opens showing all stories |
| Create epic form saves successfully | EPIC-04 | API integration + UI | Open create dialog, fill fields, submit, verify epic appears in list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
