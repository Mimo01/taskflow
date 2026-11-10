---
phase: 95
slug: notifications-redesign-research-driven-visual-redesign-polis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-10
---

# Phase 95 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 + @testing-library/react (jsdom; no React Compiler in tests) |
| **Config file** | `taskflow/vitest.config.ts` (inner app dir) |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/notifications src/stores/notifications.store.test.ts src/components/app/TopBar.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run && npx tsc --noEmit && npx biome lint ./src` |
| **Estimated runtime** | ~10 seconds (quick), several minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (+ `npx biome lint` on touched files)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | NOTIF-01 | — | N/A | component | `npx vitest run src/routes/notifications/NotificationRow.test.tsx` | rewrite | ⬜ pending |
| TBD | TBD | TBD | NOTIF-02 | — | N/A | unit | `npx vitest run src/routes/notifications/notification-view.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NOTIF-03 | — | N/A | component | `npx vitest run src/routes/notifications/NotificationRow.test.tsx` | rewrite | ⬜ pending |
| TBD | TBD | TBD | NOTIF-04 | — | N/A | store+component | `npx vitest run src/stores/notifications.store.test.ts src/routes/notifications/NotificationPopover.test.tsx` | extend | ⬜ pending |
| TBD | TBD | TBD | NOTIF-05 | — | N/A | component | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NOTIF-06 | — | N/A | component | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | extend | ⬜ pending |
| TBD | TBD | TBD | NOTIF-07 | — | N/A | component | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | extend | ⬜ pending |
| TBD | TBD | TBD | NOTIF-08 | T-95-02 | url opened only if http(s) | component | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | extend | ⬜ pending |
| TBD | TBD | TBD | NOTIF-09 | — | N/A | store | `npx vitest run src/stores/notifications.store.test.ts` | extend | ⬜ pending |
| TBD | TBD | TBD | NOTIF-10 | — | N/A | component | `npx vitest run src/components/app/TopBar.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky* — Task IDs filled in by the planner.

---

## Wave 0 Requirements

- [ ] `src/routes/notifications/notification-view.test.ts` — NOTIF-02 grouping/bucketing with injected `now`
- [ ] Keyboard cases in `NotificationPopover.test.tsx` — NOTIF-05 (pure entry builder + fallback render path)
- [ ] Rewrite `NotificationRow.test.tsx` class/testid expectations — NOTIF-01/03
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One-line truncation, no hover layout shift, avatar never drops, dark mode | NOTIF-01/03 | Layout/WKWebView not assertable in jsdom | Throwaway vite preview page (`@source '../src'`) at compact/default/comfortable density + popover widths; screenshot |
| Virtualized keyboard focus/scroll, OS notification still fires | NOTIF-05 | Virtual list not exercised in jsdom; Tauri runtime | Tauri smoke: bell opens, j/k/Enter/u/e work, OS notification fires |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
