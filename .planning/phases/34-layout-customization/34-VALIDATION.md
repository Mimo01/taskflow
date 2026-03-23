---
phase: 34
slug: layout-customization
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-23
---

# Phase 34 — Validation Strategy

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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 34-01-01 | 01 | 1 | LAYOUT-01, LAYOUT-02 | unit | `npx vitest run src/stores/settings.store.test.ts -x` | ⬜ pending |
| 34-01-02 | 01 | 1 | LAYOUT-03, LAYOUT-07 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-02-01 | 02 | 2 | LAYOUT-01, LAYOUT-02 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-02-02 | 02 | 2 | LAYOUT-03 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-03-01 | 03 | 2 | LAYOUT-04, LAYOUT-05 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-03-02 | 03 | 2 | LAYOUT-06 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-04-01 | 04 | 3 | LAYOUT-04 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-04-02 | 04 | 3 | LAYOUT-04 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-04-03 | 04 | 3 | LAYOUT-04, LAYOUT-05 | typecheck | `npx tsc --noEmit --pretty 2>&1 \| head -30` | ⬜ pending |
| 34-05-01 | 05 | 4 | ALL | suite | `npx vitest run --reporter=verbose` | ⬜ pending |
| 34-05-02 | 05 | 4 | ALL | manual | Human visual verification | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 34-01 Task 1 creates tests directly in `src/stores/settings.store.test.ts` (TDD task with `tdd="true"` — tests are written as part of the RED phase before implementation). No separate Wave 0 stub files are needed because:

- The TDD task creates test stubs as its first step (RED phase)
- Plans 02, 03, 04 use TypeScript compilation (`tsc --noEmit`) as their automated verification — no test files needed
- Plan 05 Task 1 runs the full test suite as a regression check

*Existing vitest infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop sidebar reorder | LAYOUT-03 | DnD interaction requires pointer events | Drag sidebar items in Settings > Appearance, verify order persists |
| Dashboard widget drag/resize | LAYOUT-05 | react-grid-layout interaction requires mouse events | Add widget, drag to new position, resize handle, verify layout saves |
| Layout persistence across app restart | LAYOUT-06 | Requires full app lifecycle | Make changes, close app, reopen, verify state preserved |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] TDD task (34-01-01) creates tests inline — no separate Wave 0 stubs needed
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
