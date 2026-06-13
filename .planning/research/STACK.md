# Stack Research

**Domain:** Charting foundation for Tauri 2 desktop app (v1.13 Personal Workspace)
**Researched:** 2026-06-14
**Confidence:** HIGH

---

## Decision: Recharts v3 via shadcn/ui chart primitives

**Install:** `recharts` + `react-is` (peer dep). Copy the shadcn chart primitive via `npx shadcn@latest add chart`.

**Rationale in one line:** The project already uses shadcn/ui with `--chart-1..5` OKLCH tokens baked into both light and dark themes in `index.css`, runs Vite+Rolldown (excellent tree-shaking), and shadcn's copy-paste chart layer means the app is never locked into Recharts' API surface — the React Compiler issue is fully resolved by using the `responsive` prop (Recharts v3.3+) instead of `ResponsiveContainer`.

---

## Scope

v1.13 adds the app's first charting dependency. This file covers only the charting stack addition. The existing validated stack (Tauri 2, React 19, TypeScript, Zustand, TanStack Query, shadcn/ui, @base-ui/react, Tailwind v4, Vitest, Biome, @dnd-kit, @tanstack/react-virtual, react-hotkeys-hook, cmdk, babel-plugin-react-compiler) is not re-researched.

---

## Recommended Stack

### Core Technologies (additions only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| recharts | ^3.8.1 | SVG chart engine — donut/pie, stacked bar, line/area, sparklines | shadcn/ui chart primitive is a thin Recharts wrapper; `--chart-1..5` tokens already defined in both themes in `index.css`; v3.3+ ships a built-in `responsive` prop that bypasses `ResponsiveContainer` (the only known React Compiler conflict point); full TypeScript types built-in; React 19 peer dep confirmed |
| react-is | ^19.1.0 | Required peer dep by Recharts | Must match the React version in use (currently React 19.x per package.json); shadcn/ui docs explicitly call this out for React 19 |

### Supporting Libraries (chart layer only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn chart primitive (`src/components/ui/chart.tsx`) | — (copy-paste; not an npm package) | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` — thin wrappers that wire `--chart-*` CSS vars into Recharts color props via `ChartConfig` | Use for every chart in the Dashboard. Add via `npx shadcn@latest add chart`; the component is owned by the project, not locked behind a version |

### Development Tools (no changes needed)

| Tool | Purpose | Notes |
|------|---------|-------|
| `babel-plugin-react-compiler` (already installed) | Auto-memoization | No config change needed when using Recharts v3.3+ `responsive` prop instead of `ResponsiveContainer`. If `ResponsiveContainer` is ever used, add `sources: (filename) => !filename.includes('node_modules/recharts')` to the babel preset options in vite.config.ts |

---

## Charting Library Comparison

### Evaluation Criteria (load-bearing for this project)

1. **React Compiler compatibility** — `babel-plugin-react-compiler` runs over all source via `babel({ presets: [reactCompilerPreset()] })` in vite.config.ts with no exclusions
2. **React 19 support** — `package.json` shows `react: ^19.1.0`
3. **Bundle size / tree-shakeability** — Tauri portable binary; every kB matters
4. **Tailwind v4 + dark/light theming** — `--chart-1..5` OKLCH CSS vars already in both themes; theming must be CSS-var-driven
5. **shadcn/ui alignment** — project already uses shadcn/ui; a library that integrates with it avoids introducing a second design-system seam
6. **Chart types needed** — donut/pie (points by status), stacked bar (status breakdown), line/area (burndown + logged hours), sparklines (trend tiles), velocity bar

### Candidate Matrix

| Library | Bundle (gzip) | React 19 | React Compiler | Tailwind v4 theming | Donut | Bar | Line/Area | Sparkline | Verdict |
|---------|--------------|----------|----------------|---------------------|-------|-----|-----------|-----------|---------|
| **Recharts v3.8** | ~50 kB | YES (peer dep allows ^16–19) | CONDITIONAL — `ResponsiveContainer` breaks via displayName stripping; **fully resolved by v3.3+ `responsive` prop** | YES via `var(--chart-*)` — already wired in `index.css` | YES | YES | YES | YES (small chart, no axes) | **RECOMMENDED** |
| **shadcn chart wrapper** | ~0 kB extra | YES | Same as Recharts | YES — the whole point; `ChartContainer` reads `--chart-*` automatically | YES | YES | YES | YES | **USE alongside Recharts** |
| **visx (@visx/xychart)** | ~15 kB per pkg + react-spring | YES (no known issue) | UNKNOWN — last stable release 2 years ago; lodash + react-spring context patterns not audited against compiler; 4.0.1-alpha.0 active but unstable | Manual — must bridge to CSS vars manually | YES | YES | YES | YES | REJECT |
| **Nivo (@nivo/\*)** | 30-80 kB per chart pkg; 500 kB+ full | CONDITIONAL — peer dep conflicts with React 19 reported; may need `--legacy-peer-deps` | UNKNOWN — no public compiler audit | Manual | YES | YES | YES | YES | REJECT |
| **Tremor (@tremor/react)** | ~70 kB | React ^18.0.0 peer dep (NOT 19) | UNKNOWN | YES (built on Tailwind) | YES | YES | YES | YES | REJECT |
| **uPlot** | ~40 kB | YES (framework-agnostic) | N/A (Canvas, not React) | NO — Canvas rendering; CSS vars do not apply to canvas fills | NO | NO | YES | YES | REJECT |
| **Chart.js + react-chartjs-2** | ~50 kB + ~5 kB | YES | UNKNOWN (Canvas, ref-heavy) | NO — Canvas; requires imperative color reading on every theme change | YES | YES | YES | YES | REJECT |
| **Observable Plot** | ~75 kB | YES (ESM) | PROBLEMATIC — imperative D3-style, React integration uses `useEffect` + ref which conflicts with compiler's hook rules | Manual | YES | YES | YES | YES | REJECT |

### Why Recharts v3 Wins

**The React Compiler issue is fully resolved.** The `ResponsiveContainer` / React Compiler conflict (displayName stripping in production builds causes `isChart` check to fail) is solved by Recharts v3.3.0's built-in `responsive` prop. Write `<AreaChart responsive width="100%" height={300} data={data}>` and skip `ResponsiveContainer` entirely. shadcn's `ChartContainer` uses `min-h-[VALUE]` for sizing — no `ResponsiveContainer` needed at all.

**The theming path is already laid.** `--chart-1` through `--chart-5` are in OKLCH in both `:root` and `.dark` in `index.css` (a blue-to-indigo palette for both themes). shadcn's `ChartConfig` reads them via `var(--chart-*)`. Zero theme code to write.

**The copy-paste model eliminates API lock-in.** `chart.tsx` is owned by the project. If Recharts has a breaking change, update one file — not a wrapper library version.

**Bundle impact is minimal.** Recharts v3 is ~50 kB gzip with selective D3 submodule imports. Vite+Rolldown tree-shakes unused chart types. Only `PieChart`/`Pie`, `BarChart`/`Bar`, `AreaChart`/`Area`/`Line` will end up in the bundle.

**Why visx is rejected:** `@visx/xychart` last stable release is 2 years old (v3.12.0); the 4.0.x alpha is unstable; it pulls in `react-spring` (animation framework weight) and `lodash` (redundant in a modern ESM project); it requires building all axis/scale/theme plumbing manually; and it has not been audited against babel-plugin-react-compiler.

**Why Tremor is rejected:** Its npm peer dep is `react ^18.0.0` — it does not declare React 19 compatibility. It also wraps Recharts anyway, adding an abstraction layer with less control and a ~70 kB price tag instead of Recharts' ~50 kB.

**Why Nivo is rejected:** React 19 peer dep conflicts require `--legacy-peer-deps`, which is a maintenance liability. It is the right choice for 30+ chart types and server-side rendering — neither of which this project needs.

---

## Installation

```bash
# From taskflow/ directory:
npm install recharts react-is

# Add the shadcn chart primitive (copies chart.tsx into src/components/ui/):
npx shadcn@latest add chart
```

**React Compiler config:** No vite.config.ts change is required as long as charts use the `responsive` prop (Recharts v3.3+) and NOT `ResponsiveContainer`. If `ResponsiveContainer` is ever needed, add an exclusion:

```typescript
// vite.config.ts — only if ResponsiveContainer is ever used
babel({
  presets: [
    reactCompilerPreset({
      sources: (filename: string) => !filename.includes('node_modules/recharts'),
    }),
  ],
}),
```

---

## Theming Integration

The project already has everything needed. `--chart-1..5` are OKLCH values in both themes in `index.css`:

```css
/* Already in index.css (:root and .dark both define these) */
--chart-1: oklch(0.809 0.105 251.813);  /* light blue */
--chart-2: oklch(0.623 0.214 259.815);
--chart-3: oklch(0.546 0.245 262.881);
--chart-4: oklch(0.488 0.243 264.376);
--chart-5: oklch(0.424 0.199 265.638);  /* deep indigo */
```

shadcn's `ChartContainer` maps these via `ChartConfig`:

```typescript
// Example for "points by status" donut
const chartConfig = {
  todo: { label: 'To Do', color: 'var(--chart-1)' },
  inProgress: { label: 'In Progress', color: 'var(--chart-2)' },
  done: { label: 'Done', color: 'var(--chart-3)' },
} satisfies ChartConfig;
```

The blue-to-indigo family works for both themes without needing separate palettes. Status-specific colors (e.g. Done = green) may warrant extending the `--chart-*` set with named semantic aliases in `index.css` rather than repurposing the numbered tokens.

---

## Chart Types Implementation Notes

| Chart Needed | Recharts Component | Key Props / Notes |
|---|---|---|
| Donut — points by status | `<PieChart>` + `<Pie innerRadius={...}>` | `innerRadius > 0` makes a donut; set `responsive` on `PieChart`; use `ChartTooltipContent` |
| Stacked bar — status breakdown | `<BarChart>` + one `<Bar stackId="s">` per status | All bars share the same `stackId`; use `layout="vertical"` for horizontal bars |
| Area — weekly logged hours | `<AreaChart responsive>` + `<Area type="monotone" fillOpacity={0.2}>` | `type="monotone"` for smooth curves; gradient fill via `<defs><linearGradient>` |
| Area/Line — burndown | `<ComposedChart responsive>` + `<Area>` ideal + `<Line>` actual | Two series on same chart; `ComposedChart` handles mixed types |
| Bar — velocity trend (sprints) | `<BarChart responsive>` | One bar per sprint; `dataKey="points"`; `XAxis dataKey="sprint"` |
| Sparklines (stat tiles) | Small `<AreaChart responsive height={40}>` with axes/grid omitted | Pass `hide` to `XAxis`/`YAxis`; omit `CartesianGrid`; no tooltip needed |

---

## Date Utilities: No New Dependency Needed

Date handling for chart axes is covered by existing code:

- `src/lib/standup-date.ts` — `toLocalDateString()` (YYYY-MM-DD from local components), `buildRecentDayOptions()` — timezone-safe, already tested
- `src/lib/formatTimeAgo.ts` — `Intl.RelativeTimeFormat` for human-readable durations

For chart axis tick formatting (e.g. "Mon", "Jun 14", sprint labels), use `Intl.DateTimeFormat` inline in the Recharts `tickFormatter` prop — no library needed. For week bucketing of Tempo worklogs, add a `getISOWeekBucket(dateStr: string): string` helper to `standup-date.ts` if needed.

**Do not install `date-fns`, `dayjs`, or `luxon`.**

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Recharts v3 | visx (@visx/xychart) | Building a bespoke custom charting library with pixel-level design control, willing to own all scale/axis/tooltip code, and maintenance cadence is not a concern |
| Recharts v3 | Nivo | When React 19 peer dep resolves and Canvas rendering is needed for 10K+ data point charts |
| Recharts v3 | Chart.js + react-chartjs-2 | When Canvas rendering is required for massive datasets and CSS theming can be handled imperatively |
| Recharts v3 | Observable Plot | D3-first analytical notebook apps where imperative API is acceptable |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tremor/react` | Wraps Recharts behind a second abstraction; peer dep is React ^18 not ^19; 70 kB for something the project gets for free via shadcn chart | shadcn chart primitive on Recharts directly |
| `@visx/xychart` | Last stable release 2 years old; react-spring + lodash weight; unaudited against React Compiler; high implementation cost | Recharts for all XY charts |
| `d3` (full package) | Recharts imports only the D3 submodules it needs; adding the full `d3` package duplicates them and inflates the bundle | Nothing — Recharts includes what's needed |
| `date-fns` / `dayjs` / `luxon` | Date utilities already covered by `standup-date.ts` + `Intl.DateTimeFormat`; adding a date library for chart tick labels is unnecessary | `Intl.DateTimeFormat` inline in `tickFormatter`; extend `standup-date.ts` for any new helpers |
| `react-spring` | visx pulls this in; Recharts has its own CSS-transition animations; adding react-spring separately for chart animations conflicts with React Compiler patterns | Recharts built-in `isAnimationActive` |
| `ResponsiveContainer` (Recharts component) | Confirmed to break with `babel-plugin-react-compiler` via displayName stripping in production builds (recharts/recharts#4590, #5173) | `responsive` prop on the chart component directly (Recharts v3.3+) |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| recharts | ^3.8.1 | react@^19.1.0 | Peer dep allows ^16.8 \|\| ^17 \|\| ^18 \|\| ^19 |
| react-is | ^19.1.0 | recharts@^3.8.1 | Must match React version; shadcn docs call this out explicitly for React 19 |
| recharts | ^3.8.1 | babel-plugin-react-compiler@1.0.0 | Safe when using `responsive` prop; avoid `ResponsiveContainer` |
| recharts | ^3.8.1 | tailwindcss@^4.2.1 | CSS var theming via `var(--chart-*)` in ChartConfig; OKLCH values already in `index.css` |
| recharts | ^3.8.1 | @vitejs/plugin-react@^6 + @rolldown/plugin-babel | Rolldown tree-shakes unused chart types; no special config needed |

---

## Sources

- [recharts/recharts GitHub](https://github.com/recharts/recharts) — v3.8.1 confirmed latest via `npm view recharts version`; peer deps verified; `responsive` prop introduced in v3.3.0 — HIGH confidence
- [Recharts v3.3.0 release notes](https://github.com/recharts/recharts/releases/tag/v3.3.0) — built-in `responsive` prop; `ResponsiveContainer` legacy remains — HIGH confidence
- [recharts/recharts #4590](https://github.com/recharts/recharts/issues/4590) — `ResponsiveContainer` + React Compiler rendering bug (React 19 RC) — HIGH confidence (first-hand issue)
- [recharts/recharts #5173](https://github.com/recharts/recharts/issues/5173) — `ComposedChart` in `ResponsiveContainer` with React 19 production bug — HIGH confidence
- [shadcn/ui chart docs](https://ui.shadcn.com/docs/components/radix/chart) — ChartContainer, ChartConfig, CSS var theming; updated for Recharts v3 and React 19 — HIGH confidence
- [shadcn/ui React 19 guide](https://ui.shadcn.com/docs/react-19) — `react-is` peer dep requirement for React 19 — HIGH confidence
- [react.dev — Compiling Libraries](https://react.dev/reference/react-compiler/compiling-libraries) — library consumer guidance for React Compiler compatibility — HIGH confidence
- [Context7 /recharts/recharts](https://context7.com/recharts/recharts) — Pie/PieChart innerRadius/outerRadius, React 16-19 peer dep — HIGH confidence
- [Context7 /airbnb/visx](https://context7.com/airbnb/visx) — XYChart theming, react-spring dependency, @visx/xychart architecture — HIGH confidence
- [@visx/xychart npm](https://www.npmjs.com/package/@visx/xychart) — v3.12.0, last published 2 years ago; 4.0.1-alpha.0 in progress — HIGH confidence
- [bundlephobia recharts](https://bundlephobia.com/package/recharts) — ~50 kB gzip — MEDIUM confidence (third-party tool)
- [PkgPulse — Recharts v3 vs Tremor vs Nivo 2026](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026) — bundle comparison — MEDIUM confidence
- [LogRocket — Best React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/) — ecosystem overview — MEDIUM confidence
- Taskflow `src/index.css` — `--chart-1..5` OKLCH values confirmed present in both `:root` and `.dark` — HIGH confidence (source verified)
- Taskflow `vite.config.ts` — React Compiler invoked via `babel({ presets: [reactCompilerPreset()] })` with no exclusions — HIGH confidence (source verified)
- Taskflow `package.json` — `react: ^19.1.0`, no recharts installed yet, shadcn/ui already present — HIGH confidence (source verified)

---

*Stack research for: Taskflow v1.13 charting foundation (Tauri 2 + React 19 + React Compiler + Tailwind v4 + shadcn/ui)*
*Researched: 2026-06-14*
