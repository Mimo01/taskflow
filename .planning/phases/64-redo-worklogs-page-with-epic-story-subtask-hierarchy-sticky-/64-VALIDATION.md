---
phase: 64
slug: redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | taskflow/vite.config.ts |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 64-01-01 | 01 | 1 | REQ-TBD | — | N/A | unit | `cd taskflow && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/components/worklogs/` — test stubs for hierarchy rendering
- [ ] `taskflow/src/pages/WorklogsPage.test.tsx` — integration test stubs

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky headers/columns scroll behavior | UI behavior | CSS sticky positioning requires visual verification | Scroll the worklogs table and confirm headers stick |
| Breadcrumb navigation on task click | Navigation | Requires real Jira/Tempo API integration | Click a task row and verify breadcrumb updates |
| Log entry editing via popover | UX interaction | Popover dismiss/focus behavior needs visual check | Click worklog entry, edit, save, verify update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
