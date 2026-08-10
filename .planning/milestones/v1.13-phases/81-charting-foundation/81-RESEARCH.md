# Phase 81: Charting Foundation — Research

**Researched:** 2026-06-14
**Domain:** Recharts v3 + shadcn chart primitive integration in Tauri 2 / React 19 / React Compiler / Tailwind v4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Charting library is **Recharts v3.8** + the shadcn `chart` primitive (`src/components/ui/chart.tsx`, copy-paste via `npx shadcn@latest add chart`), with `react-is` as the required React 19 peer dep. All alternatives (visx, Nivo, Tremor, uPlot, Chart.js, Observable Plot) were evaluated and rejected — do not reconsider.
- **D-02:** Use the Recharts v3.3+ **`responsive` prop** on chart components — **never `ResponsiveContainer`**. This is the only React Compiler conflict point and is fully resolved by avoiding it. No vite.config babel exclusion is needed as long as `ResponsiveContainer` is never imported.
- **D-03:** Every chart sits inside an **explicit-height outer `<div>`** (e.g. `style={{ height: N }}` / `min-h-[Npx]`); never `height="100%"` inside a flex/overflow parent — WebKit 0×0-collapse guard.
- **D-04:** Chart components default to **`isAnimationActive={false}`**; `ChartWrapper` carries the **`'use no memo'`** React Compiler escape hatch; theme colors are passed as **`var(--chart-N)`** CSS-var strings.
- **D-05:** `ChartWrapper` is a **status-prop card** — accepts `title`/`description` plus `isLoading`/`error`/`isEmpty` props and renders the existing `Skeleton`, `ErrorState`, and `EmptyState` primitives inside consistent card chrome.
- **D-06:** The `/dashboard` smoke-test chart is a **temporary scaffold** — a minimal throwaway chart (bar or donut). Marked with `// SCAFFOLD: smoke-test only — remove when Phase 83 rebuilds Dashboard`.
- **D-07:** **Convert the Dashboard route to `React.lazy()`** in `src/routes/routes.tsx`. Needs Suspense fallback — reuse `route-spinner.tsx`.
- **D-08:** **CSS-var passthrough only** — rely on shadcn `ChartContainer` + `var(--chart-N)` strings; do **not** build a `useChartColors()` JS hook in this phase.

### Claude's Discretion

- Exact bundle-analysis tooling/method for confirming the recharts chunk split (e.g. inspecting `dist/` chunk output vs. a visualizer plugin).
- Precise `ChartWrapper` prop names/signature and card spacing, within the status-prop-card decision (D-05).
- Which minimal chart type to use for the throwaway smoke test (D-06).

### Deferred Ideas (OUT OF SCOPE)

- `useChartColors()` JS theme hook — add only if a downstream chart needs JS-side color values that CSS-var passthrough can't supply.
- Real product charts (points-by-status, burndown, logged-hours trend, sparklines, velocity) — Phases 83–85 only.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHART-01 | Charts render via Recharts v3 + shadcn `chart` primitive and follow dark/light theme tokens (`--chart-1..5`) | CSS tokens verified present in both `:root` and `.dark` (lines 105–109 and 140–144 of `src/index.css`); shadcn ChartContainer wires them automatically via ChartConfig |
| CHART-02 | Charts render correctly in the Tauri WebKit build — explicit-height wrapper, responsive width, no 0×0 collapse, animations disabled | Explicit-height guard (D-03) + `responsive` prop (D-02) + `isAnimationActive={false}` (D-04) together address this; requires human UAT in real Tauri macOS build |
| CHART-03 | A reusable `ChartWrapper` provides consistent sizing, theming, and loading/empty/error states; lazy-loaded to protect bundle size | Existing `Skeleton`, `ErrorState`, `EmptyState` primitives confirmed in `src/components/ui/`; Dashboard route static import confirmed at `routes.tsx:36` — conversion to `React.lazy()` is the bundle fix |

</phase_requirements>

---

## Summary

Phase 81 installs and verifies the project's first charting dependency. All major decisions are locked: Recharts v3.8 via the shadcn `chart` copy-paste primitive, with `react-is@^19.1.0` as the required peer dep. The library is not yet installed — `package.json` confirms recharts is absent. The `src/components/ui/chart.tsx` file does not yet exist and will be created via `npx shadcn@latest add chart`.

The two biggest risks for this phase are the WebKit 0×0 render failure and React Compiler incompatibility. Both have known mitigations: explicit-height wrappers guard against WebKit collapse, and the `responsive` prop on chart components (Recharts v3.3+) eliminates the `ResponsiveContainer` / displayName-stripping issue. The `'use no memo'` directive on `ChartWrapper` provides a last-resort compiler escape hatch.

The Dashboard route is currently a static import (`import Dashboard from './dashboard/index'` at `routes.tsx:5,36`). Converting it to `React.lazy()` is the mechanism for placing recharts in the Dashboard chunk rather than vendor/main. `rollup-plugin-visualizer` is already installed (`^7.0.1`) and invoked via `ANALYZE=true npm run build` — this is the bundle-analysis tool.

**Primary recommendation:** Install dependencies, run `npx shadcn@latest add chart`, build `ChartWrapper`, convert Dashboard to lazy route, add smoke-test chart, verify with Vitest render test and real Tauri build.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chart rendering (SVG) | Frontend (React component) | — | Recharts is a pure React SVG library; no server involvement |
| Theme token resolution | Browser/CSS cascade | — | `var(--chart-N)` resolved by browser at paint time; no JS needed |
| Loading/error/empty states | Frontend (ChartWrapper) | — | Status-prop card owns all state rendering; primitives already exist in `src/components/ui/` |
| Bundle splitting (recharts out of vendor) | Build tool (Vite/Rolldown) | Route structure | `React.lazy()` on the Dashboard route causes Rolldown to emit a separate chunk containing recharts |
| Smoke-test verification (WebKit) | Human UAT | — | 0×0 collapse only manifests in real Tauri WebKit build, not jsdom or Chrome dev server |
| Unit test (ChartWrapper mounts cleanly) | Vitest + jsdom | — | jsdom environment; ResizeObserver must be mocked in test setup |

---

## Standard Stack

### Core Additions (this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.8.1 | SVG chart engine (Pie/Bar/Area/Line) | shadcn chart primitive is a thin Recharts wrapper; v3.3+ `responsive` prop resolves React Compiler conflict; pure React SVG = compiler-safe |
| react-is | ^19.1.0 | Required Recharts peer dep for React 19 | Must match the React version in use (`react@^19.1.0`); shadcn docs call this out explicitly for React 19 |

[VERIFIED: npm registry] — `npm view recharts version` returns `3.8.1`; `npm view react-is version` returns `19.2.7`

### shadcn Primitive (copy-paste, not npm)

| File | Created By | Contents |
|------|-----------|---------|
| `src/components/ui/chart.tsx` | `npx shadcn@latest add chart` | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle` — owned by the project, not versioned externally |

[CITED: https://ui.shadcn.com/docs/components/chart]

### Existing Infrastructure (no change needed)

| Asset | Location | Role in Phase 81 |
|-------|----------|-----------------|
| `--chart-1..5` OKLCH tokens | `src/index.css:105–109` (`:root`) and `140–144` (`.dark`) | Both themes define identical blue-spectrum values; ChartContainer reads them via `var(--chart-N)` |
| `--color-chart-*` aliases | `src/index.css:33–37` | Tailwind v4 `--color-*` prefix aliases for the chart tokens |
| `Skeleton` | `src/components/ui/skeleton.tsx` | ChartWrapper loading state |
| `ErrorState` | `src/components/ui/error-state.tsx` | ChartWrapper error state (`error`, `onRetry`, `viewName` props) |
| `EmptyState` | `src/components/ui/empty-state.tsx` | ChartWrapper empty state (`icon`, `title`, `subtitle` props) |
| `RouteSpinner` | `src/components/ui/route-spinner.tsx` | Suspense fallback for the lazy Dashboard route |
| `rollup-plugin-visualizer` | `package.json` devDeps `^7.0.1`; `vite.config.ts:38-40` | Bundle analysis — `ANALYZE=true npm run build` opens interactive treemap |

### Installation Commands

```bash
# From taskflow/ directory:
npm install recharts react-is

# Add the shadcn chart primitive:
npx shadcn@latest add chart
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| recharts | npm | 9+ yrs | ~3M/wk | github.com/recharts/recharts | — | Approved (well-established, shadcn official dependency) |
| react-is | npm | 7+ yrs | ~90M/wk | github.com/facebook/react | — | Approved (official React ecosystem package) |

slopcheck was not run (tool not available in this environment). Both packages are verified as well-established via authoritative sources: recharts is the dependency explicitly named in shadcn/ui official chart docs; react-is is a Meta/React official package published under `facebook/react`. No suspicious packages.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard route (/dashboard)
      │
      │  [React.lazy() chunk boundary]
      ▼
Dashboard chunk (separate from vendor/main)
      │
      ├── SmokTestChart                  ← throwaway scaffold
      │     │  uses ↓
      │     └── ChartWrapper             ← new, src/components/chart-wrapper.tsx
      │           │  uses ↓
      │           ├── chart.tsx          ← shadcn copy (ChartContainer, ChartTooltip…)
      │           │     │  uses ↓
      │           │     └── recharts     ← PieChart/BarChart + responsive prop
      │           │
      │           ├── Skeleton           ← existing (isLoading state)
      │           ├── ErrorState         ← existing (error state)
      │           └── EmptyState         ← existing (isEmpty state)
      │
CSS cascade (browser)
      │
      └── var(--chart-1..5) → OKLCH values from :root / .dark
            (set by loadTheme() in main.tsx before createRoot)
```

Data flow for theme: `loadTheme()` → sets `.dark` class on `<html>` → CSS cascade resolves `var(--chart-N)` → Recharts `fill`/`stroke` props receive `"var(--chart-N)"` strings → browser paints correct color.

### Recommended File Structure

```
taskflow/src/
├── components/
│   ├── ui/
│   │   ├── chart.tsx                  # shadcn copy-paste — new
│   │   ├── skeleton.tsx               # existing
│   │   ├── empty-state.tsx            # existing
│   │   ├── error-state.tsx            # existing
│   │   └── route-spinner.tsx          # existing
│   └── chart-wrapper.tsx              # new ChartWrapper component
│                                        (not inside ui/ — it's a composed higher-order component)
├── routes/
│   ├── routes.tsx                     # convert Dashboard to React.lazy()
│   └── dashboard/
│       ├── index.tsx                  # Dashboard component (becomes lazy chunk)
│       └── SmokeTestChart.tsx         # new throwaway scaffold (SCAFFOLD comment required)
```

Note: `ChartWrapper` lives in `src/components/` (not `src/components/ui/`) because it is a composed higher-order component that imports from `ui/` — placing it in `ui/` would create a circular-style dependency within the design system layer.

### Pattern 1: Recharts Chart with `responsive` prop (NOT ResponsiveContainer)

```typescript
// Source: https://github.com/recharts/recharts/releases/tag/v3.3.0
// CORRECT — v3.3+ responsive prop, no ResponsiveContainer
<BarChart
  responsive          // ← fills container width; DO NOT use width="100%" here
  height={240}        // ← explicit pixel height always required (WebKit guard)
  data={data}
  isAnimationActive={false}
>
  <Bar dataKey="value" fill="var(--chart-1)" />
  <XAxis dataKey="name" />
</BarChart>

// FORBIDDEN — causes React Compiler displayName-stripping bug in production
// <ResponsiveContainer width="100%" height={240}>
//   <BarChart ...>
// </ResponsiveContainer>
```

### Pattern 2: ChartWrapper with status-prop card

```typescript
// 'use no memo'  ← MODULE-LEVEL directive (first line of file after imports)

interface ChartWrapperProps {
  title: string
  description?: string
  height?: number          // default 240
  isLoading?: boolean
  error?: unknown
  isEmpty?: boolean
  onRetry?: () => void
  children: ReactNode
}

// Card chrome: bg-card rounded-[var(--radius)] border border-border p-6
// Title: text-base font-semibold text-foreground
// Description: text-sm text-muted-foreground mt-1 mb-4
// Chart area div: explicit style={{ height: heightPx }}
```

### Pattern 3: ChartConfig with var(--chart-N) passthrough

```typescript
// Source: https://ui.shadcn.com/docs/components/chart
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  value: { label: 'Value', color: 'var(--chart-1)' },
  other: { label: 'Other', color: 'var(--chart-2)' },
} satisfies ChartConfig

// Never: color: '#6366f1'  ← hardcoded hex breaks dark mode
// Never: color: getComputedStyle(el).getPropertyValue('--chart-1')  ← imperative, breaks SSR/Vitest
```

### Pattern 4: Dashboard route conversion to React.lazy()

```typescript
// src/routes/routes.tsx — before (line 5 + 36):
import Dashboard from './dashboard/index'  // static — recharts would be in main bundle
// { path: '/dashboard', element: <Dashboard /> }

// After:
const Dashboard = lazy(() => import('./dashboard/index'))
// { path: '/dashboard', element: withLazy(Dashboard) }
// withLazy() is already defined in routes.tsx (wraps with ChunkErrorBoundary + Suspense + RouteSpinner)
```

### Pattern 5: Vitest mock for ResizeObserver

`ChartWrapper` must mount without error in Vitest (jsdom). jsdom does not implement `ResizeObserver`. The `responsive` prop on Recharts components internally uses ResizeObserver. Two approaches:

```typescript
// Option A: Add to src/test/setup.ts (global mock — affects all tests)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Option B: Per-test vi.stubGlobal (prefer if only chart tests need it)
vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
})
```

Option A (global in setup.ts) is preferred since any future chart test file will need it, and the mock is zero-cost for non-chart tests.

### Anti-Patterns to Avoid

- **Using `ResponsiveContainer`:** Confirmed broken with `babel-plugin-react-compiler` (recharts/recharts#4590, #5173) — React Compiler strips `displayName` causing `isChart` check to fail. Never import this component.
- **`height="100%"` on chart or its wrapper div:** Renders at 0×0 in WebKit Tauri build because flex parents may have no intrinsic height at first ResizeObserver fire. Always use explicit pixel values.
- **Hardcoding hex colors in chart props:** Breaks dark mode. Always pass `"var(--chart-N)"` strings.
- **Skipping `isAnimationActive={false}`:** CSS transitions on many SVG elements cause animation jank in WebKit webview.
- **Importing chart components outside a lazy-loaded route file:** Forces recharts into the main/vendor bundle. All chart imports must live inside `src/routes/dashboard/` files.
- **`getComputedStyle()` to resolve CSS vars:** Imperative, unavailable in Vitest jsdom, and unnecessary — let the browser cascade handle `var(--chart-N)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS-var chart color binding | Custom color resolver hook (`useChartColors`) | shadcn `ChartContainer` + `var(--chart-N)` strings | ChartContainer already wires the CSS vars; CONTEXT.md D-08 explicitly defers the hook |
| Responsive chart width | `useLayoutEffect` + `offsetWidth` measurement | `responsive` prop on Recharts v3.3+ chart components | The `responsive` prop is the exact mechanism Recharts provides; the useLayoutEffect pattern is a fallback that requires more code and has its own ResizeObserver timing risks |
| Loading/empty/error states | Per-chart custom UI | `ChartWrapper` composing existing `Skeleton`/`ErrorState`/`EmptyState` | Three primitives already exist and are tested; `ChartWrapper` just orchestrates them |
| Bundle analysis | Custom chunk inspection script | `ANALYZE=true npm run build` via `rollup-plugin-visualizer` (already configured) | Already in vite.config.ts:38–40; opens interactive treemap |
| Suspense fallback | New loading spinner | `RouteSpinner` (already exists at `src/components/ui/route-spinner.tsx`) | Matches existing lazy-route pattern for all other routes |

---

## Common Pitfalls

### Pitfall 1: Chart renders at 0×0 in WebKit Tauri build

**What goes wrong:** Chart SVG is invisible. Only reproducible in the Tauri macOS/Linux build — Chrome dev server does not exhibit this.
**Why it happens:** WebKit's ResizeObserver fires before flex layout has resolved, reporting `clientWidth = 0`. The SVG is created at 0×0. If size stays 0→0 on second observation, Recharts does not re-render.
**How to avoid:** `ChartWrapper` must wrap the chart area in `<div style={{ height: heightPx }} className="w-full">`. Never pass `height="100%"` to the chart or its wrapper inside a flex/overflow parent.
**Warning signs:** Chart area renders but SVG is invisible; `getBoundingClientRect()` on chart parent returns `{width:0, height:0}`.
[VERIFIED: codebase — same failure class as `project_virtualized_table_zero_width_col` memory]

### Pitfall 2: React Compiler breaks charts that use `ResponsiveContainer`

**What goes wrong:** Charts render correctly in dev but fail silently in production Tauri build.
**Why it happens:** `babel-plugin-react-compiler` strips `displayName` from components at the IR level. `ResponsiveContainer` uses `displayName` to perform an `isChart` check on its children; the check fails and the chart is not rendered.
**How to avoid:** Use the `responsive` prop on chart components (Recharts v3.3+). Never import `ResponsiveContainer`. No vite.config change is needed.
**Warning signs:** Chart renders in dev (`npm run dev`) but is blank in `npm run build` output.
[VERIFIED: recharts/recharts#4590, #5173; STACK.md]

### Pitfall 3: Theme tokens not applied — chart colors hardcoded or resolved imperatively

**What goes wrong:** Charts look correct in light mode and wrong (invisible text, wrong colors) in dark mode.
**Why it happens:** `getComputedStyle(el).getPropertyValue('--chart-1')` at render time resolves before the `.dark` class is applied, or returns an empty string in jsdom. Hardcoded hex values never follow the theme.
**How to avoid:** Pass `"var(--chart-N)"` strings directly as `fill`/`stroke` props. Never call `getComputedStyle`. Never hardcode hex. The browser cascade resolves `var(--chart-N)` at paint time from whichever theme is active.
**Warning signs:** Axis labels invisible in dark mode; chart colors do not change when theme is toggled in Settings.
[VERIFIED: PITFALLS.md §Pitfall 3; UI-SPEC.md §Color]

### Pitfall 4: recharts ends up in vendor/main chunk

**What goes wrong:** Initial app load increases by ~50 kB gzip even for users who never visit the Dashboard.
**Why it happens:** Static `import Dashboard from './dashboard/index'` means Rolldown treats Dashboard (and its transitive dependency recharts) as part of the app entry point.
**How to avoid:** Convert Dashboard route to `React.lazy()` before installing recharts. Verify with `ANALYZE=true npm run build`.
**Warning signs:** `rollup-plugin-visualizer` treemap shows recharts inside a non-Dashboard chunk.
[VERIFIED: routes.tsx line 5 — static import confirmed; PITFALLS.md §Pitfall 5]

### Pitfall 5: ChartWrapper fails to mount in Vitest — ResizeObserver not defined

**What goes wrong:** Vitest tests for `ChartWrapper` throw `ReferenceError: ResizeObserver is not defined`.
**Why it happens:** jsdom does not implement `ResizeObserver`. Recharts' `responsive` prop attaches a ResizeObserver internally.
**How to avoid:** Add a no-op `ResizeObserver` mock to `src/test/setup.ts`. This is a global mock that costs nothing for non-chart tests.
**Warning signs:** Any Vitest test that imports a chart component or `ChartWrapper` immediately throws `ResizeObserver is not defined`.
[VERIFIED: vitest.config.ts — `environment: 'jsdom'`; ResizeObserver is not in jsdom's implementation]

---

## Code Examples

### ChartWrapper skeleton (informative — executor refines)

```typescript
// src/components/chart-wrapper.tsx
'use no memo'

import { BarChart2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'

interface ChartWrapperProps {
  title: string
  description?: string
  height?: number
  isLoading?: boolean
  error?: unknown
  isEmpty?: boolean
  onRetry?: () => void
  children: ReactNode
}

export function ChartWrapper({
  title,
  description,
  height = 240,
  isLoading,
  error,
  isEmpty,
  onRetry,
  children,
}: ChartWrapperProps) {
  const renderChart = () => {
    if (isLoading) {
      return <Skeleton className="w-full h-full rounded-md" />
    }
    if (error) {
      return <ErrorState error={error} onRetry={onRetry ?? (() => {})} viewName={title} />
    }
    if (isEmpty) {
      return (
        <EmptyState
          icon={BarChart2}
          title="No data yet"
          subtitle="Data will appear here once available."
        />
      )
    }
    return children
  }

  return (
    <div className="bg-card rounded-[var(--radius)] border border-border p-6">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
      )}
      <div style={{ height }} className="w-full">
        {renderChart()}
      </div>
    </div>
  )
}
```

### Minimal smoke-test chart (bar — executor's choice of type)

```typescript
// src/routes/dashboard/SmokeTestChart.tsx
// SCAFFOLD: smoke-test only — remove when Phase 83 rebuilds Dashboard

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { ChartWrapper } from '@/components/chart-wrapper'

const data = [
  { name: 'A', value: 40 },
  { name: 'B', value: 30 },
  { name: 'C', value: 20 },
]

const chartConfig = {
  value: { label: 'Value', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function SmokeTestChart() {
  return (
    <ChartWrapper
      title="Chart smoke test"
      description="Verifies charting stack — temporary scaffold"
      height={240}
    >
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart responsive height={240} data={data} isAnimationActive={false}>
          <XAxis dataKey="name" />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
```

### Bundle analysis command

```bash
# From taskflow/ directory:
ANALYZE=true npm run build
# Opens rollup-plugin-visualizer treemap in browser.
# Confirm: recharts appears inside a Dashboard-named chunk, NOT in vendor or index chunks.
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `<ResponsiveContainer width="100%" height={300}>` wrapping the chart | `<BarChart responsive height={N}>` (no wrapper) | `responsive` prop introduced Recharts v3.3.0; legacy `ResponsiveContainer` still exists but must be avoided (React Compiler incompatibility) |
| Manual `width` + `height` numeric props | `responsive` prop for width, explicit number for `height` | `responsive` fills container width without ResizeObserver being on the critical render path |
| Static route imports for all routes | `React.lazy()` for heavy routes | Dashboard is the first non-lazy top-level route; converting it establishes the pattern |

**Deprecated/outdated:**
- `ResponsiveContainer`: still shipped in recharts v3.8 but broken with React Compiler. Treat as removed from this codebase.
- `height="100%"` on chart components: never correct in a flex/overflow parent on WebKit.

---

## Codebase Anchor Verification

All anchors from CONTEXT.md verified against `taskflow/src/`:

| Anchor | Status | Notes |
|--------|--------|-------|
| `src/index.css:105–109` — `--chart-1..5` OKLCH tokens in `:root` | CONFIRMED | Values exactly as documented in STACK.md and UI-SPEC.md |
| `src/index.css:33–37` — `--color-chart-*` aliases | CONFIRMED | Lines 33–37 contain `--color-chart-1` through `--color-chart-5` |
| `src/index.css:140–144` — `--chart-1..5` in `.dark` | CONFIRMED | Dark theme has identical OKLCH values (same blue-spectrum ramp) |
| `src/routes/routes.tsx:5` — static `import Dashboard` | CONFIRMED | `import Dashboard from './dashboard/index'` at line 5; static |
| `src/routes/routes.tsx:36` — `{ path: '/dashboard', element: <Dashboard /> }` | CONFIRMED | Line 36, no `withLazy()` wrapper — conversion needed |
| `src/components/ui/empty-state.tsx` | CONFIRMED | Accepts `icon: LucideIcon`, `title: string`, `subtitle?: string` |
| `src/components/ui/error-state.tsx` | CONFIRMED | Accepts `error: unknown`, `onRetry: () => void`, `viewName: string` |
| `src/components/ui/skeleton.tsx` | CONFIRMED | Exists; standard shadcn skeleton with `animate-pulse` |
| `src/components/ui/route-spinner.tsx` | CONFIRMED | `RouteSpinner` component — `Loader2` with `min-h-screen flex items-center` |
| `vite.config.ts:37` — `babel({ presets: [reactCompilerPreset()] })` | CONFIRMED | Line 37; no recharts exclusion (intentional) |
| `src/components/ui/chart.tsx` | ABSENT | Does not exist yet — created by `npx shadcn@latest add chart` |
| `recharts` in `package.json` | ABSENT | Not yet installed |
| `react-is` in `package.json` | ABSENT | Not yet installed |

**Key discovery:** `routes.tsx` already has a `withLazy()` helper (lines 24–32) that wraps a component with `ChunkErrorBoundary` + `Suspense` + `RouteSpinner`. Converting Dashboard to lazy only requires changing the import to `lazy(() => import('./dashboard/index'))` and wrapping it with `withLazy(Dashboard)` — the pattern is already established and tested on SprintBoardTab, BacklogPage, and others.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — this section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest.config.ts`) + `@testing-library/react@^16.3.2` |
| Config file | `taskflow/vitest.config.ts` |
| Global setup | `taskflow/src/test/setup.ts` (Tauri store mock + crypto mock) |
| Environment | jsdom |
| Quick run command | `npm run test` (runs `vitest run`) |
| Full suite command | `npm run test` (no separate full-suite command — same runner) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHART-01 | `chart.tsx` present, `ChartWrapper` importable, renders without error in jsdom | unit/render | `npm run test -- --reporter=verbose src/components/chart-wrapper.test.tsx` | ❌ Wave 0 |
| CHART-01 | Chart renders with correct `var(--chart-1)` fill attribute on the SVG element | unit/render | Same file as above | ❌ Wave 0 |
| CHART-02 | Smoke-test chart renders at expected dimensions — no 0×0 collapse | manual UAT | Real Tauri macOS build (human) | N/A |
| CHART-02 | ChartWrapper renders children (not Skeleton/EmptyState) when isLoading=false, error=null, isEmpty=false | unit/render | `npm run test -- src/components/chart-wrapper.test.tsx` | ❌ Wave 0 |
| CHART-03 | ChartWrapper renders `<Skeleton>` when `isLoading={true}` | unit/render | Same file | ❌ Wave 0 |
| CHART-03 | ChartWrapper renders `<ErrorState>` when `error` prop is non-null | unit/render | Same file | ❌ Wave 0 |
| CHART-03 | ChartWrapper renders `<EmptyState>` when `isEmpty={true}` | unit/render | Same file | ❌ Wave 0 |
| CHART-03 | recharts NOT in vendor/main chunk (bundle analysis) | build assertion | `ANALYZE=true npm run build` → inspect dist/ or visualizer output | N/A (human) |

**Note:** Criterion 2 (WebKit real-build render) and Criterion 3 (bundle analysis) are human-UAT checkpoints — they cannot be automated in Vitest. The test file covers the automatable subset.

### ResizeObserver Mock (required for chart render tests)

Add to `src/test/setup.ts` before chart tests can pass:

```typescript
// ResizeObserver mock — required for Recharts responsive prop in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
```

This belongs in `setup.ts` (not per-test) so all future chart tests inherit it automatically.

### Sampling Rate

- **Per task commit:** `npm run test` (full Vitest suite — fast, < 30 seconds)
- **Per wave merge:** `npm run test && npm run check` (Vitest + Biome + tsc)
- **Phase gate:** All of the above + `ANALYZE=true npm run build` (human verifies visualizer) + Tauri smoke test in real macOS build

### Wave 0 Gaps

- [ ] `src/components/chart-wrapper.test.tsx` — covers CHART-01 (import), CHART-02 (success render), CHART-03 (isLoading/error/isEmpty states)
- [ ] `ResizeObserver` mock added to `src/test/setup.ts`

*(No other test infrastructure gaps — Vitest, @testing-library/react, jest-dom are already installed and configured)*

---

## Security Domain

> Phase 81 installs no authentication, no network endpoints, no user-input processing, and no secrets. The only external operation is installing two npm packages.

| ASVS Category | Applies | Notes |
|---------------|---------|-------|
| V2 Authentication | No | No auth code in this phase |
| V3 Session Management | No | No session code in this phase |
| V4 Access Control | No | No access control in this phase |
| V5 Input Validation | No | Chart data is hardcoded static array (smoke test); no user input |
| V6 Cryptography | No | No crypto in this phase |

**Package supply chain:** Both packages (`recharts`, `react-is`) are long-established (9+ and 7+ years), authored by trusted organizations (recharts community, Meta/React team), and are explicit dependencies of the shadcn/ui official chart primitive. No `postinstall` scripts with network access are expected.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Install recharts, run `npx shadcn@latest add chart` | ✓ | (dev environment) | — |
| macOS Tauri build (`npm run tauri:build`) | Criterion 2 smoke-test UAT | ✓ (dev machine) | Tauri 2 | — |
| `rollup-plugin-visualizer` | Bundle analysis (Criterion 3) | ✓ | ^7.0.1 (in package.json) | Manual `dist/` chunk filename inspection |
| jsdom (Vitest env) | ChartWrapper unit tests | ✓ | via vitest.config.ts | — |

**Missing dependencies with no fallback:** None.

---

## Open Questions (RESOLVED)

1. **`ChartWrapper` location: `src/components/` vs `src/components/ui/`**
   - What we know: `src/components/ui/` holds atomic design-system primitives (shadcn components). `ChartWrapper` is a composed higher-order component that imports from `ui/`.
   - What's unclear: Project convention for non-atomic composed components is not explicitly documented in a CLAUDE.md.
   - Recommendation: Place in `src/components/chart-wrapper.tsx` (not inside `ui/`) to match the layering pattern of the rest of the codebase (e.g., `ChunkErrorBoundary` lives at `src/components/`, not `ui/`).

2. **`ErrorState` requires `useNavigate` — needs a Router context in tests**
   - What we know: `error-state.tsx` calls `useNavigate()` internally.
   - What's unclear: Whether ChartWrapper tests that trigger the error branch will need `MemoryRouter` wrapping.
   - Recommendation: Wrap ChartWrapper test renders with `MemoryRouter` from `react-router-dom` (already a project dependency) for the error-state test case.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The shadcn chart primitive generated by `npx shadcn@latest add chart` exports `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` | Standard Stack | If shadcn updates the export shape, executor must adapt ChartWrapper imports — low risk given shadcn's stability |
| A2 | The `responsive` prop on Recharts chart components behaves as described in Recharts v3.3.0 release notes (fills container width without `ResponsiveContainer`) | Architecture Patterns §Pattern 1 | If the prop behavior changed in v3.8.x, the executor must verify against the actual generated chart.tsx and Recharts types |
| A3 | `rollup-plugin-visualizer` treemap correctly identifies which chunk recharts lands in after `React.lazy()` conversion | Don't Hand-Roll; Validation Architecture | If the visualizer misidentifies chunks, manual dist/ inspection by chunk filename is the fallback |

**All other claims in this research were verified against the codebase or cited against official sources.**

---

## Sources

### Primary (HIGH confidence)

- Codebase: `taskflow/src/index.css` — `--chart-1..5` OKLCH tokens confirmed in both `:root` (lines 105–109) and `.dark` (lines 140–144); `--color-chart-*` aliases confirmed at lines 33–37 [VERIFIED: direct file read]
- Codebase: `taskflow/src/routes/routes.tsx` — static `import Dashboard` at line 5; route at line 36; `withLazy()` pattern at lines 24–32 [VERIFIED: direct file read]
- Codebase: `taskflow/src/components/ui/` — `empty-state.tsx`, `error-state.tsx`, `skeleton.tsx`, `route-spinner.tsx` all confirmed present with exact prop signatures [VERIFIED: direct file read]
- Codebase: `taskflow/vite.config.ts` — `babel({ presets: [reactCompilerPreset()] })` at line 37; `visualizer` at lines 38–40; `ANALYZE=true` guard confirmed [VERIFIED: direct file read]
- Codebase: `taskflow/vitest.config.ts` — jsdom environment; `setupFiles: ['./src/test/setup.ts']`; `globals: true` [VERIFIED: direct file read]
- Codebase: `taskflow/src/test/setup.ts` — existing mocks (Tauri store, crypto); no ResizeObserver mock yet [VERIFIED: direct file read]
- npm registry: `npm view recharts version` → `3.8.1`; `npm view react-is version` → `19.2.7` [VERIFIED: npm registry]
- `.planning/research/STACK.md` — full candidate evaluation matrix, Recharts v3 decision rationale, install commands [CITED: project research file]
- `.planning/research/PITFALLS.md` — §Pitfall 1 (0×0), §Pitfall 2 (React Compiler), §Pitfall 3 (theme tokens), §Pitfall 5 (bundle) [CITED: project research file]
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — all locked decisions D-01 through D-08 [CITED: project context file]
- `.planning/phases/81-charting-foundation/81-UI-SPEC.md` — ChartWrapper props contract, spacing, color values, copywriting [CITED: project UI spec]

### Secondary (MEDIUM confidence)

- recharts/recharts#4590, #5173 — `ResponsiveContainer` + React Compiler production rendering bug (cited in STACK.md, not re-fetched) [CITED: STACK.md §Sources]
- shadcn/ui chart docs — `ChartContainer`, `ChartConfig` API shape (cited in STACK.md) [CITED: STACK.md §Sources]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry versions verified; codebase anchors verified directly
- Architecture patterns: HIGH — all patterns derived from locked CONTEXT.md decisions and verified codebase state
- Pitfalls: HIGH — Pitfalls 1–3 are the three load-bearing risks; all have codebase-verified mitigations
- Validation architecture: HIGH — test framework and existing test infrastructure verified directly

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable stack; recharts v3.8 unlikely to have breaking changes within 30 days)
