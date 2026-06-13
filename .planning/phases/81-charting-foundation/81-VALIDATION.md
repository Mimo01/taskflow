---
phase: 81
slug: charting-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 81 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vite.config.ts` (test block) + `src/test/setup.ts` |
| **Quick run command** | `npx vitest run src/components/chart-wrapper.test.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds (quick); full suite per project baseline |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched component
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green AND real-Tauri-build smoke check passed (manual)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled per-plan by the planner. Each chart-render assertion depends on the Wave 0 ResizeObserver mock.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 81-XX-XX | XX | 0 | CHART-02 | — | N/A | unit | `npx vitest run` (ResizeObserver mock) | ❌ W0 | ⬜ pending |
| 81-XX-XX | XX | 1 | CHART-01 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` | ❌ W0 | ⬜ pending |
| 81-XX-XX | XX | 1 | CHART-03 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` | ❌ W0 | ⬜ pending |
| 81-XX-XX | XX | 2 | CHART-01 | — | N/A | build | `ANALYZE=true npm run build` (recharts NOT in vendor/main) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/setup.ts` — add no-op `ResizeObserver` mock (jsdom lacks it; Recharts `responsive` prop attaches one). Blocks ALL chart-render tests.
- [ ] Test helper — wrap `ChartWrapper` error-state branch in `MemoryRouter` (`ErrorState` uses `useNavigate()`).
- [ ] `recharts` + `react-is` installed (CHART-01 prerequisite for any render test).

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smoke-test chart renders at expected dimensions (no 0×0 collapse) in real macOS Tauri build | CHART-02 | WebKit ResizeObserver/layout timing differs from jsdom + dev Chrome; 0×0 collapse only reproduces in real Tauri WebKit | `npm run tauri build` (or dev Tauri), open /dashboard, confirm smoke chart visible at expected size |
| Correct dark + light theme colors sourced from `--chart-1..5` tokens | CHART-02 | Visual/theme correctness across both themes in real WebKit | Toggle theme in real Tauri build; confirm chart series colors change and match OKLCH tokens |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (ResizeObserver mock, deps install)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
