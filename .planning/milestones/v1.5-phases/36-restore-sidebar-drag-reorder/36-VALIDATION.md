---
phase: 36
slug: restore-sidebar-drag-reorder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vitest.config.ts) |
| **Config file** | taskflow/vitest.config.ts |
| **Quick run command** | `cd taskflow && npx vitest run src/stores/settings.store.test.ts src/routes/settings/SidebarItemsList.test.tsx -x` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/stores/settings.store.test.ts src/routes/settings/SidebarItemsList.test.tsx -x`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | LAYOUT-02 | unit (store) | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | Yes | ⬜ pending |
| 36-01-02 | 01 | 1 | LAYOUT-02 | integration (component) | `cd taskflow && npx vitest run src/routes/settings/SidebarItemsList.test.tsx -x` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/settings/SidebarItemsList.test.tsx` — covers LAYOUT-02 UI integration (drag handle renders, reorder callback fires)

*Existing store tests cover reorderSidebarItem logic.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual drag overlay follows cursor smoothly | LAYOUT-02 | CSS transform animation not testable in jsdom | 1. Open Settings > Sidebar Items 2. Click+drag grip handle 3. Verify overlay tracks cursor |
| Reorder persists after page navigation | LAYOUT-02 | Requires full app navigation flow | 1. Reorder items 2. Navigate away 3. Return to Settings — order preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
