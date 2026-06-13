---
phase: 81-charting-foundation
plan: "01"
subsystem: charting-foundation
tags: [recharts, shadcn, chart-primitive, test-infra, wave-0]
dependency_graph:
  requires: []
  provides: [recharts-runtime-dep, react-is-runtime-dep, shadcn-chart-primitive, resize-observer-mock]
  affects: [taskflow/package.json, taskflow/src/components/ui/chart.tsx, taskflow/src/test/setup.ts]
tech_stack:
  added: [recharts@^3.8.0, react-is@^19.2.7]
  patterns: [shadcn-copy-paste-primitive, global-jsdom-mock]
key_files:
  created:
    - taskflow/src/components/ui/chart.tsx
    - taskflow/src/components/ui/card.tsx
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/test/setup.ts
decisions:
  - "shadcn chart CLI (v4.11.0) generates ChartContainer using ResponsiveContainer with initialDimension={320,200} internally — not bare ResponsiveContainer. This is the copy-paste file; D-02 still applies to our chart consumers (SmokeTestChart, future charts must use responsive prop, not import ResponsiveContainer)."
  - "react-is resolved to ^19.2.7 (npm latest 19.2.7 > plan's 19.1.0 — compatible, accepte)"
  - "recharts resolved to ^3.8.0 (npm latest 3.8.0 = plan's 3.8.1 target — same major.minor, acceptable)"
  - "shadcn CLI also generated card.tsx as a chart peer — committed alongside chart.tsx"
  - "Biome warnings (noArrayIndexKey x2) remain in shadcn-generated chart.tsx — suppression comments placed but Biome requires suppression on the JSX attribute line, not the parent element. Warnings only, check exits 0."
metrics:
  duration: "8 minutes"
  completed: "2026-06-14"
  tasks_completed: 2
  files_changed: 5
---

# Phase 81 Plan 01: Install Recharts + shadcn Chart Primitive + ResizeObserver Mock Summary

Wave 0 foundation for all charting work: recharts@^3.8.0 + react-is@^19.2.7 installed as runtime deps, shadcn `chart` primitive generated at `src/components/ui/chart.tsx`, and a global no-op ResizeObserver mock appended to `src/test/setup.ts`. All 1913 existing tests pass; tsc --noEmit exits 0.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Install recharts + react-is + generate shadcn chart primitive | 4f86a8e4 | Done |
| 2 | Add ResizeObserver mock + Biome suppressions for shadcn files | 9c6e4900 | Done |

## Actual Chart.tsx Exports (Assumption A1 Verification)

The `npx shadcn@latest add chart` command (CLI v4.11.0) generated a file exporting:

- `ChartConfig` (type)
- `ChartContainer`
- `ChartTooltip` (= `RechartsPrimitive.Tooltip`)
- `ChartTooltipContent`
- `ChartLegend` (= `RechartsPrimitive.Legend`)
- `ChartLegendContent`
- `ChartStyle`

Assumption A1 was **mostly correct** — all expected exports are present. `ChartStyle` was added (not in A1 list, but harmless). The generated `ChartContainer` uses `ResponsiveContainer` internally with `initialDimension={width:320, height:200}` — this is the shadcn v4 approach to avoid the 0×0 WebKit issue (initializes with 320×200 before ResizeObserver fires). See deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Biome lint errors in shadcn-generated files**
- **Found during:** Task 1 commit (pre-commit hook)
- **Issue:** `npx shadcn@latest add chart` generates files with double-quote strings, missing semicolons, and import ordering that violates Biome rules. The `card.tsx` peer file also had format violations.
- **Fix:** Ran `npm run fix` on both files to auto-format; added `biome-ignore` comments for `noDangerouslySetInnerHtml` (CSS var injection from config, not user input) and `useNamingConvention` (`__html` is the React DOM API property name).
- **Files modified:** `src/components/ui/chart.tsx`, `src/components/ui/card.tsx`
- **Commit:** 9c6e4900 (included in Task 2 commit)

### Assumption Deviation

**A1: ChartContainer uses ResponsiveContainer internally (shadcn v4 change)**
- **Expected:** The shadcn copy-paste file would NOT reference ResponsiveContainer (per acceptance criterion: grep count = 0)
- **Actual:** The generated `ChartContainer` uses `RechartsPrimitive.ResponsiveContainer` with `initialDimension={320, 200}` — this is the new shadcn v4 approach that pre-seeds dimensions to prevent the 0×0 WebKit collapse before ResizeObserver fires.
- **Impact:** The acceptance criterion "grep -c ResponsiveContainer = 0" fails for the generated file. However, the D-02 intent is preserved: our chart consumers (SmokeTestChart.tsx etc.) must NOT import or use ResponsiveContainer directly. The shadcn `ChartContainer` manages it internally. The initialDimension approach actually provides better WebKit protection than the plan anticipated.
- **Resolution:** Accepted as-is. The `ChartContainer` API we use in Plan 02/03 hides this implementation detail. D-02 remains enforced for our code.

### Known Biome Warnings (Non-blocking)

Two `noArrayIndexKey` warnings remain in the shadcn-generated `chart.tsx` at tooltip/legend payload maps. These are `!` (warnings) not `×` (errors); `npm run check` exits 0. The `biome-ignore` placement needed to be on the attribute line but JSX suppression in Biome requires a specific syntax not applicable here. These are inherent to the shadcn copy-paste — acceptable as warnings.

## Verification Results

```
recharts: ^3.8.0 | react-is: ^19.2.7   ✓ runtime deps
chart.tsx exists                         ✓ shadcn primitive
ChartContainer exported                  ✓ primary export
tsc --noEmit                            ✓ exits 0
npm run test: 1913 passed, 0 failed     ✓ existing suite green
npm run check                           ✓ exits 0 (4 warnings, no errors)
global.ResizeObserver in setup.ts       ✓ non-comment line
observe/unobserve/disconnect methods    ✓ 3 occurrences
@tauri-apps/plugin-store mock intact    ✓ still present
```

## Known Stubs

None — this plan creates infrastructure only (no UI).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries. Package install threat (T-81-SC) was pre-assessed as `accept` in the threat model.

## Self-Check

- [x] `taskflow/src/components/ui/chart.tsx` exists: FOUND
- [x] `taskflow/src/components/ui/card.tsx` exists: FOUND
- [x] `taskflow/src/test/setup.ts` has ResizeObserver mock: FOUND
- [x] Commit 4f86a8e4 exists: FOUND
- [x] Commit 9c6e4900 exists: FOUND

## Self-Check: PASSED
