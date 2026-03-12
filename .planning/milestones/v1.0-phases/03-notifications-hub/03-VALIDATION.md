---
phase: 3
slug: notifications-hub
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| **Config file** | `taskflow/vite.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose src/services/notifications.test.ts src/stores/notifications.store.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/services/notifications.test.ts`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | NOTF-01, NOTF-02, NOTF-03 | unit | `npx vitest run src/services/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | NOTF-04, NOTF-05, NOTF-06 | unit | `npx vitest run src/stores/notifications.store.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | NOTF-01 | unit | `npx vitest run src/routes/notifications/NotificationRow.test.tsx` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | NOTF-03 | unit | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | ❌ W0 | ⬜ pending |
| 3-01-05 | 01 | 0 | NOTF-04 | unit | `npx vitest run src/components/app/TopBar.test.tsx` | ❌ W0 | ⬜ pending |
| 3-01-06 | 01 | 1 | NOTF-01, NOTF-02 | unit | `npx vitest run src/services/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-07 | 01 | 1 | NOTF-03 | unit | `npx vitest run src/services/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-08 | 01 | 1 | NOTF-04, NOTF-05, NOTF-06 | unit | `npx vitest run src/stores/notifications.store.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | NOTF-01 | unit | `npx vitest run src/routes/notifications/NotificationRow.test.tsx` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | NOTF-03 | unit | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | NOTF-04 | unit | `npx vitest run src/components/app/TopBar.test.tsx` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 2 | NOTF-05, NOTF-06 | manual | — | — | ⬜ pending |
| 3-02-05 | 02 | 2 | NOTF-03 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/services/notifications.test.ts` — stubs for NOTF-01, NOTF-02, NOTF-03
- [ ] `taskflow/src/stores/notifications.store.test.ts` — stubs for NOTF-04, NOTF-05, NOTF-06
- [ ] `taskflow/src/routes/notifications/NotificationRow.test.tsx` — stub for NOTF-01 UI
- [ ] `taskflow/src/routes/notifications/NotificationPopover.test.tsx` — stub for NOTF-03 banner
- [ ] `taskflow/src/components/app/TopBar.test.tsx` — stub for NOTF-04 badge display

*All test files are Wave 0 gaps — none exist yet.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OS desktop notification appears on macOS/Windows/Linux | NOTF-03 | Requires real OS interaction; Tauri mock cannot verify OS notification dispatch | 1. Build app in dev mode. 2. Enable OS notifications in settings. 3. Trigger a new notification by polling. 4. Verify native OS notification appears with correct title/body format. |
| Clicking OS notification focuses app window | NOTF-03 | OS-level behavior; no programmable callback on desktop | 1. Minimize app. 2. Wait for OS notification. 3. Click notification. 4. Verify app window comes to foreground. |
| Permission-denied banner appears when OS notifications blocked | NOTF-03 | Requires real OS permission denial | 1. Deny notification permission in OS settings. 2. Enable OS notifications in app settings. 3. Verify in-app alert banner appears with actionable message. |
| Badge updates in real time as new items arrive | NOTF-04 | Requires live polling cycle | 1. Leave app running. 2. Have another user post a comment mentioning you in Jira. 3. Wait for poll interval. 4. Verify badge count increases without page refresh. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
