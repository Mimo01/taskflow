---
phase: 50
slug: draggable-sidebar-resize
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 50-01-01 | 01 | 0 | SC-4 | — | N/A | unit | `cd taskflow && npm test -- src/stores/settings.store.test.ts` | ✅ exists (extend) | ⬜ pending |
| 50-02-01 | 02 | 1 | SC-1,SC-3 | — | N/A | manual | visual inspection — drag main nav sidebar | N/A | ⬜ pending |
| 50-03-01 | 03 | 1 | SC-2,SC-3 | — | N/A | manual | visual inspection — drag issue/MR/release panel | N/A | ⬜ pending |
| 50-04-01 | 04 | 2 | SC-4 | — | N/A | unit | `cd taskflow && npm test -- src/stores/settings.store.test.ts` | ✅ exists | ⬜ pending |
| 50-04-02 | 04 | 2 | SC-5 | — | N/A | manual | verify no layout jank during drag | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/stores/settings.store.test.ts` — add test cases for `sidebarWidth`, `issueDetailPanelWidth`, `mrDetailPanelWidth`, `releaseDetailPanelWidth` defaults, setters, and v14 migration guard
- [ ] `taskflow/src/hooks/useResizable.ts` — new file (created in Wave 1; no dedicated unit test required — hook behavior verified via manual drag integration)

*Existing infrastructure (Vitest + testing-library) covers all automated phase requirements — no new framework setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Main nav sidebar drag-to-resize | SC-1 | jsdom does not simulate real mouse drag physics across element boundaries | Drag right edge of sidebar; verify it resizes smoothly between 160px–320px |
| Detail page right panel drag-to-resize | SC-2 | Same jsdom limitation | Drag left border of issue/MR/release right panel; verify resize within bounds |
| Resize cursor + border highlight on hover | SC-3 | CSS cursor changes not testable in jsdom | Hover over drag zones; verify `ew-resize` cursor and `var(--ring)` border highlight |
| No layout jank during drag | SC-5 | Performance/visual quality is perceptual | Drag rapidly; verify no content reflow, no cursor flicker, no text selection |
| Width persistence across sessions | SC-4 (end-to-end) | Tauri plugin-store write requires a real app session | Resize sidebars, restart app, verify widths restored |
| Collapse toggle coexistence (D-01) | SC-1 | Interactive state machine requires real UI | Resize, then collapse (Cmd+B), then re-expand; verify last drag width is restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
