---
phase: 8
slug: dashboard-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard` |
| **Full suite command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard`
- **After every plan wave:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-W0-01 | W0 | 0 | DASH-01 | unit | `npx vitest run src/routes/dashboard/SubtasksPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 8-W0-02 | W0 | 0 | DASH-02 | unit | `npx vitest run src/routes/dashboard/MrHealthPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 8-W0-03 | W0 | 0 | DASH-03 | unit | `npx vitest run src/routes/dashboard/SprintHealthPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 8-W0-04 | W0 | 0 | DASH-04 | unit | `npx vitest run src/routes/dashboard/NotificationsPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 8-01-01 | 01 | 1 | DASH-01 | unit | `npx vitest run src/routes/dashboard/SubtasksPanel.test.tsx` | ✅ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | DASH-02 | unit | `npx vitest run src/routes/dashboard/MrHealthPanel.test.tsx` | ✅ W0 | ⬜ pending |
| 8-03-01 | 03 | 1 | DASH-03 | unit | `npx vitest run src/routes/dashboard/SprintHealthPanel.test.tsx` | ✅ W0 | ⬜ pending |
| 8-04-01 | 04 | 1 | DASH-04 | unit | `npx vitest run src/routes/dashboard/NotificationsPanel.test.tsx` | ✅ W0 | ⬜ pending |
| 8-05-01 | 05 | 2 | DASH-01,02,03,04 | unit | `npx vitest run src/routes/dashboard` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/SubtasksPanel.test.tsx` — stubs for DASH-01
- [ ] `src/routes/dashboard/MrHealthPanel.test.tsx` — stubs for DASH-02
- [ ] `src/routes/dashboard/SprintHealthPanel.test.tsx` — stubs for DASH-03
- [ ] `src/routes/dashboard/NotificationsPanel.test.tsx` — stubs for DASH-04

*Existing vitest + jsdom + @testing-library/react infrastructure covers all phase requirements — no new framework setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sprint endDate displays correctly for real Jira DC instance | DASH-03 | Orange Jira DC board discovery depends on real API | Open dashboard, verify days-remaining shows or is hidden gracefully |
| Notifications mark-as-read on inline click | DASH-04 | Requires live notification state mutation | Click notification row, verify it disappears from unread list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
