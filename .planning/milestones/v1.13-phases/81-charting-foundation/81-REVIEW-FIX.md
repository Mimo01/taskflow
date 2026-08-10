---
phase: 81-charting-foundation
fixed_at: 2026-06-14T15:00:00Z
review_path: .planning/phases/81-charting-foundation/81-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 81: Code Review Fix Report

**Fixed at:** 2026-06-14T15:00:00Z
**Source review:** .planning/phases/81-charting-foundation/81-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 through WR-05; 0 critical, 4 Info out of scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: SmokeTestChart mixes two conflicting recharts v3 sizing models

**Files modified:** `taskflow/src/routes/dashboard/SmokeTestChart.tsx`
**Commit:** 081bc864
**Applied fix:** Dropped both the `responsive` prop and the explicit `height={240}` from the `<BarChart>` inside `<ChartContainer>`, letting the ResponsiveContainer (rendered by ChartContainer) be the single sizing authority. This is the canonical pattern future chart authors will copy.

### WR-02: ChartWrapper renders a dead "Retry" button when onRetry is omitted

**Files modified:** `taskflow/src/components/ui/error-state.tsx`, `taskflow/src/components/chart-wrapper.tsx`
**Commit:** 551ef3f7
**Applied fix:** Made `ErrorState`'s `onRetry` prop optional and wrapped the generic Retry `AlertAction` in `{onRetry && ...}` so it only renders when a real handler exists (the auth-error branch's "Reconnect" button is unaffected, as it always has a valid navigate action). `ChartWrapper` now passes `onRetry` through directly instead of the `onRetry ?? (() => {})` no-op fallback. Verified all 40+ existing `ErrorState` callers still pass a handler, so making the prop optional is backward-compatible.

### WR-03: ChartWrapper state precedence ignores error while loading

**Files modified:** `taskflow/src/components/chart-wrapper.tsx`
**Commit:** 551ef3f7
**Applied fix:** Reordered `renderChart()` precedence to error > loading > empty > success so a background retry after a failed fetch (TanStack Query `isError` + `isFetching`) surfaces the error instead of hiding it behind a skeleton. Added a contract comment documenting the intended precedence for consumers in later phases.

**Note:** This is a state-handling/logic change. The reorder behaves correctly per the documented contract and the full suite passes, but a developer should confirm the error > loading precedence matches the intended UX for charts that legitimately want to show a skeleton during a silent background refetch.

### WR-04: ChartWrapper unit test does not assert the success path actually renders a chart

**Files modified:** `taskflow/src/components/chart-wrapper.test.tsx`, `taskflow/src/test/setup.ts`
**Commit:** 9c24a6cc
**Applied fix:** Added a "recharts integration" test that mounts a real `ChartContainer` + `BarChart` through `ChartWrapper` and asserts both `[data-slot="chart"]` and `.recharts-surface` are present. This converts the manual smoke test into an automated regression guard and exercises the ResizeObserver mock. To make recharts actually produce an SVG surface under jsdom (which reports 0x0 layout and otherwise refuses to render), the ResizeObserver mock's `observe()` now synchronously delivers a non-zero `contentRect` (600x400) to the stored callback. Verified the new test plus the full suite (1918 passed, 0 regressions) — the active callback does not destabilize other tests.

### WR-05: ResizeObserver mock is untyped and lacks the standard constructor signature

**Files modified:** `taskflow/src/test/setup.ts`
**Commit:** 5ff2b55e (further extended in 9c24a6cc as part of WR-04)
**Applied fix:** Typed the mock against the DOM interface (`as unknown as typeof ResizeObserver`), gave it the real `constructor(callback)` signature, and stored the callback. The WR-04 commit then made `observe()` invoke that callback with a non-zero `contentRect` so the mock is no longer inert and actually drives recharts sizing.

## Skipped Issues

None — all in-scope findings were fixed.

_Out of scope (Info tier, fix_scope=critical_warning): IN-01 (dev-gate SmokeTestChart), IN-02 ('use no memo' comment), IN-03 (empty-title guard), IN-04 (recharts presence guard test). These were not attempted._

---

_Fixed: 2026-06-14T15:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
