---
phase: 81
slug: charting-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-14
audited: 2026-06-14
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

> Reconstructed from executed artifacts (81-01/02/03 SUMMARY) during the 2026-06-14 audit. Each chart-render assertion depends on the Wave 0 ResizeObserver mock.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 81-01-2 | 01 | 0 | CHART-02 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` (ResizeObserver mock exercised by recharts integration test) | ✅ `src/test/setup.ts` | ✅ green |
| 81-02-1 | 02 | 1 | CHART-03 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` (loading/success/error/empty states) | ✅ `chart-wrapper.tsx` | ✅ green |
| 81-02-2 | 02 | 1 | CHART-03 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` (4 state tests, MemoryRouter error wrap) | ✅ `chart-wrapper.test.tsx` | ✅ green |
| 81-02-2 | 02 | 1 | CHART-02 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` (recharts integration — `.recharts-surface` mounts under jsdom, WR-04) | ✅ `chart-wrapper.test.tsx` | ✅ green |
| 81-03-1 | 03 | 2 | CHART-01 | — | N/A | unit | `npx vitest run src/components/chart-wrapper.test.tsx` (recharts mounts; `var(--chart-N)` theme tokens used in `SmokeTestChart`) | ✅ `SmokeTestChart.tsx` | ✅ green |
| 81-03-2 | 03 | 2 | CHART-01 | — | N/A | build | `ANALYZE=true npm run build` — recharts confirmed in `dashboard-*.js` lazy chunk only, absent from `index-*.js` main bundle | ✅ `routes.tsx` | ✅ green |
| 81-03-3 | 03 | 3 | CHART-02 | — | N/A | manual | Human UAT in real macOS Tauri WebKit — see Manual-Only below | ✅ | ✅ approved |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Full chart-wrapper suite: 5/5 green (verified 2026-06-14). Full project suite: 1917 passed.*

---

## Wave 0 Requirements

- [x] `src/test/setup.ts` — no-op `ResizeObserver` mock added (typed `ResizeObserverCallback`, stores callback, fires `contentRect` on `observe`; WR-05). Exercised by the recharts integration test.
- [x] Test helper — `ChartWrapper` error-state branch wrapped in `MemoryRouter` (`ErrorState` uses `useNavigate()`).
- [x] `recharts@^3.8.0` + `react-is@^19.2.7` installed (CHART-01 prerequisite). shadcn `chart` primitive generated at `src/components/ui/chart.tsx`.

*All Wave 0 infrastructure complete — chart-render tests run green.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smoke-test chart renders at expected dimensions (no 0×0 collapse) in real macOS Tauri build | CHART-02 | WebKit ResizeObserver/layout timing differs from jsdom + dev Chrome; 0×0 collapse only reproduces in real Tauri WebKit | `npm run tauri build` (or dev Tauri), open /dashboard, confirm smoke chart visible at expected size |
| Correct dark + light theme colors sourced from `--chart-1..5` tokens | CHART-02 | Visual/theme correctness across both themes in real WebKit | Toggle theme in real Tauri build; confirm chart series colors change and match OKLCH tokens |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (ResizeObserver mock, deps install)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (chart-wrapper suite ~0.5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (audit 2026-06-14)

---

## Validation Audit 2026-06-14

State A audit — VALIDATION.md was a stale pre-execution draft (placeholder `81-XX-XX` task IDs, all pending). Reconstructed Per-Task Map from executed 81-01/02/03 SUMMARY artifacts and verified live test state.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Findings:**
- CHART-03 (ChartWrapper 4 states): COVERED — `chart-wrapper.test.tsx` 5/5 green.
- CHART-02 (jsdom render): COVERED — recharts integration test mounts `.recharts-surface` (WR-04, guards ResizeObserver-mock integration).
- CHART-02 (real WebKit 0×0 + theme colors): MANUAL-ONLY (legitimate — jsdom cannot reproduce WebKit layout timing); Human UAT APPROVED per 81-03 SUMMARY.
- CHART-01 (code-split): COVERED — `ANALYZE=true npm run build` confirms recharts in `dashboard-*.js` lazy chunk only.

No MISSING automated gaps. Every automatable behavior has a green automated check; remaining manual-only items are inherently un-automatable WebKit render behaviors. Phase is Nyquist-compliant.
