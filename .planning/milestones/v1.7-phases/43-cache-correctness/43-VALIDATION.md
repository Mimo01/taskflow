---
phase: 43
slug: cache-correctness
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --reporter=verbose` |
| **Full suite command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --reporter=verbose`
- **After every plan wave:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | LOAD-02 | unit | `npm test -- --reporter=verbose src/hooks/useIsActiveRoute.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-02 | 01 | 1 | QOPT-04 | unit | `npm test -- --reporter=verbose src/hooks/useIsActiveRoute.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-03 | 01 | 1 | QOPT-04 | unit | `npm test -- --reporter=verbose src/hooks/useIsActiveRoute.test.ts` | ❌ W0 | ⬜ pending |
| 43-02-01 | 02 | 2 | QOPT-05 | manual-only | DevTools Network tab: no background requests when app minimized | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/hooks/useIsActiveRoute.test.ts` — stubs for QOPT-04 (route matching logic) and LOAD-02 (integration check)
- No framework install needed — vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Polling stops when app minimized | QOPT-05 | jsdom cannot simulate `document.visibilityState` reliably; TanStack Query's `focusManager` uses native browser API | 1. Open Tauri dev build 2. Navigate to a polling view (e.g., Sprint Board) 3. Open DevTools Network tab 4. Minimize the app 5. Wait 30s — no polling requests should appear 6. Restore the app — polling should resume within one interval |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete (Phase 47 cleanup)
