# Phase 81: Charting Foundation - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a verified, theme-aware charting stack — Recharts v3 via the shadcn `chart` primitive — that renders correctly in the real Tauri WebKit build, plus a reusable `ChartWrapper` that all downstream chart work (Phases 83–85) builds on. This phase proves the stack works and ships the wrapper; it does not build any real product chart (those are Phase 83+).

</domain>

<decisions>
## Implementation Decisions

### Library & Render Approach (locked by research + success criteria — not re-litigated)
- **D-01:** Charting library is **Recharts v3.8** + the shadcn `chart` primitive (`src/components/ui/chart.tsx`, copy-paste via `npx shadcn@latest add chart`), with `react-is` as the required React 19 peer dep. All alternatives (visx, Nivo, Tremor, uPlot, Chart.js, Observable Plot) were evaluated and rejected in research — do not reconsider.
- **D-02:** Use the Recharts v3.3+ **`responsive` prop** on chart components — **never `ResponsiveContainer`**. This is the only React Compiler conflict point and is fully resolved by avoiding it. No vite.config babel exclusion is needed as long as `ResponsiveContainer` is never imported.
- **D-03:** Every chart sits inside an **explicit-height outer `<div>`** (e.g. `style={{ height: N }}` / `min-h-[Npx]`); never `height="100%"` inside a flex/overflow parent — this is the WebKit 0×0-collapse guard (same failure class as the virtualized-table 0-width-column bug).
- **D-04:** Chart components default to **`isAnimationActive={false}`**; `ChartWrapper` carries the **`'use no memo'`** React Compiler escape hatch; theme colors are passed as **`var(--chart-N)`** CSS-var strings.

### ChartWrapper API (CHART-03)
- **D-05:** **Status-prop card** design. `ChartWrapper` accepts `title` / `description` plus `isLoading` / `error` / `isEmpty` props and renders the *existing* `Skeleton`, `ErrorState`, and `EmptyState` primitives from `src/components/ui/` inside a consistent card chrome with an explicit height. Chart children render only on the success state. Goal: maximum reuse, minimal per-chart boilerplate at downstream call sites, and consistent loading/empty/error treatment across all future charts.

### Smoke-Test Chart (CHART-02 verification)
- **D-06:** The `/dashboard` smoke-test chart is a **temporary scaffold** — a minimal throwaway chart (e.g. a tiny donut or bar) whose sole purpose is verifying real-Tauri-build rendering and theme tokens. Mark it clearly as scaffolding; it is removed/replaced when Phase 83 rebuilds the Dashboard. This keeps Phase 81 pure foundation and avoids pulling Phase 83 product work forward.

### Lazy-Loading / Bundle (CHART-01 / criterion 3)
- **D-07:** **Convert the Dashboard route to `React.lazy()`** in `src/routes/routes.tsx` (currently a static `import Dashboard from './dashboard/index'`). This splits the whole Dashboard chunk — including recharts — out of `vendor/main`, matches the "Dashboard lazy-loaded route chunk" wording in the success criteria, and establishes the lazy-route pattern for later pages. Needs a Suspense fallback — reuse the existing `route-spinner.tsx`. Bundle analysis must confirm recharts is NOT in `vendor/main`.

### Theme Color Access
- **D-08:** **CSS-var passthrough only** for now — rely on shadcn `ChartContainer` + `var(--chart-N)` strings; do **not** build a `useChartColors()` JS hook in this phase. This matches the "zero theme code to write" research finding (the `--chart-1..5` OKLCH tokens already exist in both `:root` and `.dark` in `src/index.css`) and criterion 4. A `useChartColors()` hook is deferred — add later only if a specific downstream chart genuinely needs JS-side color values.

### Claude's Discretion
- Exact bundle-analysis tooling/method for confirming the recharts chunk split (e.g. inspecting `dist/` chunk output vs. a visualizer plugin) — planner/researcher choice.
- Precise `ChartWrapper` prop names/signature and card spacing, within the status-prop-card decision (D-05).
- Which minimal chart type to use for the throwaway smoke test (D-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Charting stack research (HIGH confidence, codebase-verified)
- `.planning/research/STACK.md` — Recharts v3 + shadcn primitive decision, candidate matrix, why each alternative was rejected, install commands, versions (`recharts ^3.8.1`, `react-is ^19.1.0`)
- `.planning/research/PITFALLS.md` §Pitfall 1 — 0×0 collapse / ResponsiveContainer-ResizeObserver in flex/overflow/WebKit; the explicit-height guard
- `.planning/research/PITFALLS.md` §Pitfall 2 — React Compiler incompatibility; `responsive` prop resolution; `'use no memo'` last-resort opt-out
- `.planning/research/PITFALLS.md` §Pitfall 3 — theme/color tokens, CSS-var passthrough, dark-mode correctness

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — CHART-01, CHART-02, CHART-03 (lines 14–16)
- `.planning/ROADMAP.md` §Phase 81 (lines 370–381) — goal + 4 success criteria (the binding acceptance bar)

### Codebase anchors
- `taskflow/src/index.css` — `--chart-1..5` OKLCH tokens (lines 105–109) + `--color-chart-*` aliases (lines 33–37), defined for both themes
- `taskflow/src/routes/routes.tsx:5,36` — current static Dashboard import to convert to lazy (D-07)
- `taskflow/src/components/ui/{empty-state,error-state,skeleton}.tsx` — state primitives ChartWrapper composes (D-05)
- `taskflow/src/components/ui/route-spinner.tsx` — Suspense fallback for the lazy Dashboard route
- `taskflow/vite.config.ts:37` — `babel({ presets: [reactCompilerPreset()] })`, no recharts exclusion (intentional; D-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmptyState` / `ErrorState` / `Skeleton` (`src/components/ui/`): composed inside `ChartWrapper` for its loading/empty/error states (D-05).
- `route-spinner.tsx`: Suspense fallback when Dashboard becomes lazy (D-07).
- `--chart-1..5` + `--color-chart-*` CSS tokens already present in both themes — no theme code to write (D-08).
- Settings store exposes `theme: 'light' | 'dark' | 'system'` (`src/stores/settings.store.ts`) — available if a `useChartColors()` hook is ever needed later, but NOT used this phase.

### Established Patterns
- shadcn/ui + Tailwind v4 design system already in `src/components/ui/`; `chart.tsx` is added as a project-owned copy-paste file, not an npm wrapper.
- React Compiler runs over all source with no node_modules exclusion — the `responsive`-prop + `'use no memo'` approach keeps it that way.
- Theme applied pre-render in `main.tsx` (`loadTheme()` before `createRoot`) — charts inherit the correct theme on first paint.

### Integration Points
- New `src/components/ui/chart.tsx` (shadcn copy) + new `ChartWrapper` component.
- `src/routes/routes.tsx` Dashboard route converted to `React.lazy()` + Suspense.
- Smoke-test chart mounted temporarily inside `src/routes/dashboard/`.

</code_context>

<specifics>
## Specific Ideas

- Smoke test must be verified in a **real macOS Tauri build** (not just `npm run dev` in Chrome) — WebKit timing differs and is where 0×0 collapse appears. This is human-UAT territory for criterion 2.
- ChartWrapper must be importable and render without error in the **Vitest** environment (criterion 4) — design it so it does not hard-require a real layout/ResizeObserver to mount.

</specifics>

<deferred>
## Deferred Ideas

- **`useChartColors()` JS theme hook** — deferred (D-08). Add only if a downstream chart needs JS-side color values that CSS-var passthrough can't supply.
- **Real product charts** (points-by-status, burndown, logged-hours trend, sparklines, velocity) — Phases 83–85, not Phase 81. The smoke test stays a throwaway scaffold (D-06).

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 81-charting-foundation*
*Context gathered: 2026-06-14*
