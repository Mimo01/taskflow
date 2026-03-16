---
phase: 21
slug: header-redesign-pinned-issue-tabs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react (jsdom) |
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
| 21-01-01 | 01 | 1 | HEADER-01 | unit | `cd taskflow && npx vitest run src/components/app/TopBar.test.tsx -x` | ✅ (needs update) | ⬜ pending |
| 21-01-02 | 01 | 1 | HEADER-01 | unit | `cd taskflow && npx vitest run src/components/app/Sidebar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | HEADER-05 | unit | `cd taskflow && npx vitest run src/stores/pinned-tabs.store.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | HEADER-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -x` | ✅ (needs update) | ⬜ pending |
| 21-03-01 | 03 | 2 | HEADER-03 | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | ❌ W0 | ⬜ pending |
| 21-03-02 | 03 | 2 | HEADER-04 | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | ❌ W0 | ⬜ pending |
| 21-03-03 | 03 | 2 | HEADER-06 | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | ❌ W0 | ⬜ pending |
| 21-03-04 | 03 | 2 | HEADER-07 | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | ❌ W0 | ⬜ pending |
| 21-04-01 | 04 | 2 | KEYS-04 | unit | `cd taskflow && npx vitest run src/hooks/useListNavigation.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-04-02 | 04 | 2 | KEYS-04 | unit | `cd taskflow && npx vitest run src/routes/dashboard/MyTasksTab.test.tsx -x` | ✅ (needs update) | ⬜ pending |
| 21-04-03 | 04 | 2 | KEYS-05 | unit | `cd taskflow && npx vitest run src/routes/notifications/NotificationsPage.test.tsx -x` | ❌ W0 | ⬜ pending |
| 21-04-04 | 04 | 2 | KEYS-06 | unit | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/pinned-tabs.store.test.ts` — stubs for HEADER-05 (persistence)
- [ ] `src/components/app/PinnedTabStrip.test.tsx` — stubs for HEADER-03, HEADER-04, HEADER-06, HEADER-07
- [ ] `src/hooks/useListNavigation.test.ts` — stubs for shared J/K logic (KEYS-04/05/06)
- [ ] `src/routes/notifications/NotificationsPage.test.tsx` — stubs for KEYS-05
- [ ] `src/routes/dashboard/BacklogPage.test.tsx` — stubs for KEYS-06

*Existing infrastructure covers TopBar and IssueDetailSheet tests (need updates, not new files).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logo renders correctly as app icon | HEADER-01 | Visual appearance | Open app, verify logo + "Taskflow" text in top bar left side |
| Tab strip visual appearance | HEADER-03 | Visual styling | Pin 3+ issues, verify tab strip looks like browser tabs with type icons |
| Smooth scroll on J/K focus | KEYS-04/05/06 | Scroll behavior | Navigate to bottom of list with J, verify focused row scrolls into view smoothly |
| Persist across restart | HEADER-05 | Requires app restart | Pin tabs, close app, reopen, verify same tabs visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
