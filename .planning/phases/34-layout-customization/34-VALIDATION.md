---
phase: 34
slug: layout-customization
status: draft
nyquist_compliant: false
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | LAYOUT-01 | unit | `npx vitest run src/stores/__tests__/settingsStore.layout.test.ts` | ❌ W0 | ⬜ pending |
| 34-01-02 | 01 | 1 | LAYOUT-02 | unit | `npx vitest run src/stores/__tests__/settingsStore.layout.test.ts` | ❌ W0 | ⬜ pending |
| 34-02-01 | 02 | 1 | LAYOUT-03 | unit | `npx vitest run src/components/__tests__/SidebarSettings.test.tsx` | ❌ W0 | ⬜ pending |
| 34-02-02 | 02 | 1 | LAYOUT-04 | unit | `npx vitest run src/components/__tests__/SidebarSettings.test.tsx` | ❌ W0 | ⬜ pending |
| 34-03-01 | 03 | 2 | LAYOUT-05 | unit | `npx vitest run src/components/__tests__/DashboardGrid.test.tsx` | ❌ W0 | ⬜ pending |
| 34-03-02 | 03 | 2 | LAYOUT-06 | unit | `npx vitest run src/components/__tests__/DashboardGrid.test.tsx` | ❌ W0 | ⬜ pending |
| 34-03-03 | 03 | 2 | LAYOUT-07 | unit | `npx vitest run src/components/__tests__/DashboardGrid.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/settingsStore.layout.test.ts` — stubs for LAYOUT-01, LAYOUT-02 (sidebar persistence + presets)
- [ ] `src/components/__tests__/SidebarSettings.test.tsx` — stubs for LAYOUT-03, LAYOUT-04 (sidebar drag-and-drop + visibility)
- [ ] `src/components/__tests__/DashboardGrid.test.tsx` — stubs for LAYOUT-05, LAYOUT-06, LAYOUT-07 (widget grid + persistence + presets)

*Existing vitest infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop sidebar reorder | LAYOUT-03 | DnD interaction requires pointer events | Drag sidebar items in Settings > Appearance, verify order persists |
| Dashboard widget drag/resize | LAYOUT-05 | react-grid-layout interaction requires mouse events | Add widget, drag to new position, resize handle, verify layout saves |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
