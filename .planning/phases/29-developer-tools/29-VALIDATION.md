---
phase: 29
slug: developer-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vitest.config.ts) |
| **Config file** | taskflow/vitest.config.ts |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | DEVT-03 | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 1 | DEVT-02 | unit | `cd taskflow && npx vitest run src/stores/operation-profiler.store.test.ts -x` | ❌ W0 | ⬜ pending |
| 29-03-01 | 03 | 2 | DEVT-01 | unit | `cd taskflow && npx vitest run src/routes/dev-tools/DevToolsPage.test.tsx -x` | ❌ W0 | ⬜ pending |
| 29-04-01 | 04 | 2 | DEVT-05 | unit | `cd taskflow && npx vitest run src/routes/dev-tools/WaterfallTab.test.tsx -x` | ❌ W0 | ⬜ pending |
| 29-05-01 | 05 | 3 | DEVT-04 | unit | `cd taskflow && npx vitest run src/lib/shortcuts.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/stores/operation-profiler.store.test.ts` — stubs for DEVT-02 (operation grouping logic)
- [ ] `taskflow/src/routes/dev-tools/DevToolsPage.test.tsx` — stubs for DEVT-01 (page structure, tabs)
- [ ] `taskflow/src/stores/settings.store.test.ts` — stubs for DEVT-03 (migration v7→v8, new toggles)
- [ ] `taskflow/src/routes/dev-tools/WaterfallTab.test.tsx` — stubs for DEVT-05 (waterfall bar rendering)
- [ ] `taskflow/src/lib/shortcuts.test.ts` — stubs for DEVT-04 (shortcut registration, sidebar removal)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cmd+Shift+D opens Dev Tools page | DEVT-04 | Keyboard shortcut integration requires Electron runtime | Press Cmd+Shift+D from any page — should navigate to /dev-tools |
| Waterfall bar positions are visually correct | DEVT-05 | Visual alignment of CSS percentage bars | Open Waterfall tab with logged operations — bars should align to timeline |
| Dev Tools not visible in Settings nav | DEVT-04 | Requires visual inspection of sidebar | Check Settings pages — no Developer Tools link should appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
