# Quick Task 260615-smu: Modernize Dashboard — Research

**Researched:** 2026-06-15
**Domain:** React + Tailwind v4 UI polish (codebase-internal patterns)
**Confidence:** HIGH (all findings from direct codebase inspection)

> All paths below are under `/Users/mimo/Documents/Projects/taskflow/taskflow/src/`.

## Summary

The dashboard (`routes/dashboard/index.tsx`) is visually dated versus the rest of the app on three axes: (1) a giant centered ambient-SVG hero header no other page uses, (2) raw `rounded-lg border border-border bg-card` divs everywhere instead of the shared `<Card>` primitive, and (3) ad-hoc per-row `relative px-6 pb-6` gutters. The fix is mechanical: mirror `MyTasksPage`'s header, swap section containers to `<Card>`, and unify the gutter/gap convention.

**Critical finding — token mismatch:** The `<Card>` primitive (`components/ui/card.tsx`) uses `rounded-xl` + `ring-1 ring-foreground/10` (NOT a border) and drives padding via a `--card-spacing` CSS var (`--spacing(4)` default, `--spacing(3)` for `size="sm"`). The rest of the dashboard currently uses `rounded-lg border border-border`. Adopting `<Card>` means accepting its ring+xl+spacing look — which IS the modern target. `<Card>` has essentially **zero existing consumers** (TaskCard.tsx defines its own local `CardBody`, it does NOT import the primitive), so the dashboard is the first real adopter. That's fine, but it means there's no in-app precedent to copy verbatim — follow the primitive's own composition contract below.

**Primary recommendation:** Header → mirror MyTasksPage exactly. Section containers (StatTile, SprintHealthSection outer, ActivityStrip, DashboardReleaseCard) → `<Card>`. Chart sections (Velocity, Burndown, WeeklyTrend, the donut inside SprintHealth) → **keep ChartWrapper, do NOT wrap in Card** (see ChartWrapper Reconciliation — wrapping doubles borders/padding). Instead, modernize ChartWrapper's own container to match Card's look.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Polish + light restructure.** Restyle existing sections AND reorder/regroup them and tighten the grid for better visual hierarchy.
- **NO new interactions:** stat tiles stay read-only (do NOT add clickable-filter / deep-link). Behavior unchanged — visual + layout only.
- **Header:** Replace ambient orange/blue SVG curves with the bold-title + subtitle (+ optional toolbar) pattern used by MyTasks / SprintBoard. Match their header typography and spacing.
- **Cards:** Fully adopt the shared `<Card>` primitive. Wrap all dashboard sections in `<Card>` with header/content slots. Replace inline `rounded-lg border` divs.

### Claude's Discretion
- Exact section ordering/grouping within the light restructure.
- Whether the modern header gets a toolbar and what goes in it.
- Spacing scale, typography hierarchy, which tokens (`--radius`, `--chart-*`, `CHIP_TONE_CLASS`, `statusPillClass`) to apply.
- How to reconcile `<Card>` adoption with existing `ChartWrapper`.

### Deferred Ideas (OUT OF SCOPE)
- (none recorded)
</user_constraints>

## 1. Card Adoption Recipe

`<Card>` composition contract (`components/ui/card.tsx`):
- `<Card size="default"|"sm">` — `flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 py-(--card-spacing)`. `size="sm"` reduces `--card-spacing` from `--spacing(4)` (1rem) to `--spacing(3)` (0.75rem).
- `<CardHeader>` — `grid auto-rows-min gap-1 px-(--card-spacing)`. Auto-handles a `CardAction` (right-aligned slot) and `CardDescription` rows.
- `<CardTitle>` — `text-base leading-snug font-medium` (becomes `text-sm` under `size="sm"`).
- `<CardDescription>` — `text-sm text-muted-foreground`.
- `<CardContent>` — `px-(--card-spacing)` only (no vertical padding; outer `py` + `gap` handle it).
- `<CardAction>` — top-right action slot (auto grid placement). Use for a toolbar/link in a section header.

Key point: **do not add your own `p-4`/`p-6` or `rounded-lg border`** inside a Card — padding comes from `--card-spacing` and the slots' `px-`. Adding padding double-pads.

### Before/After — StatTile (`StatTile.tsx`)

Current root (line 33-37):
```tsx
<div role="region" aria-label={label}
  className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[80px]">
```

After — use `<Card asChild>`-style but Card renders a plain `div`, so pass the a11y props straight through (Card spreads `...props`):
```tsx
<Card size="sm" role="region" aria-label={label} className="min-h-[80px] gap-2">
  <CardContent className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <Icon className={cn('size-4', iconClass)} aria-hidden />
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
    <p className={cn('text-3xl font-semibold text-primary', valueClass)} aria-label={`${value} ${label}`}>
      {value}
    </p>
  </CardContent>
</Card>
```
`Card` forwards `role`/`aria-label` via `...props` — the StatTile test (`getByRole('region', { name: 'Open' })`) still passes. `size="sm"` keeps tiles compact.

### Before/After — non-chart section (DashboardReleaseCard `DashboardReleaseCard.tsx:75`)

Current: `<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">`

After:
```tsx
<Card className="min-h-[160px]">
  <CardHeader><CardTitle>Latest release</CardTitle></CardHeader>
  <CardContent className="flex flex-col gap-3"> … </CardContent>
</Card>
```
Same for `ActivityStrip.tsx:224` (its `<h2 className="text-base font-semibold">Recent activity</h2>` at line 226 becomes `<CardTitle>Recent activity</CardTitle>`).

## 2. Header Pattern (mirror MyTasksPage)

**Canonical reference is `MyTasksPage.tsx:714-825`** (SprintBoardTab has no clean page header — it's a virtualized board, do NOT mirror it).

MyTasks header markup to copy:
```tsx
<div className="flex items-center justify-between gap-4 px-6 pt-5 pb-5 border-b border-border/50 shrink-0">
  <div className="flex flex-col gap-1 min-w-0">
    <h1 className="text-3xl font-semibold text-foreground">My Tasks</h1>
    <p className="text-xs text-muted-foreground tabular-nums mt-1 truncate"> … subtitle … </p>
  </div>
  <div className="flex items-center gap-4 shrink-0"> … optional toolbar … </div>
</div>
```

Tokens to mirror: title = `text-3xl font-semibold text-foreground`; subtitle = `text-xs text-muted-foreground`; container = `px-6 pt-5 pb-5 border-b border-border/50`.

**Replaces** dashboard `index.tsx:160-187** — the entire `<section className="relative px-8 py-20 text-center overflow-hidden">` block: delete `AMBIENT_CURVES` (lines 31-41), the `<svg>` (162-181), the `text-6xl` `<h1>` (183-185), and the centered date `<p>`.

Proposed replacement (keeps the greeting + date, which the index test only checks as text presence — `text-6xl`/SVG are not asserted, so this is safe):
```tsx
<div className="flex items-end justify-between gap-4 px-6 pt-5 pb-5 border-b border-border/50 shrink-0">
  <div className="flex flex-col gap-1 min-w-0">
    <h1 className="text-3xl font-semibold text-foreground">{timeGreeting} {firstName ?? 'there'}</h1>
    <p className="text-xs text-muted-foreground mt-1">{today}</p>
  </div>
  {/* Discretion: optional toolbar (e.g. project name chip). Stat tiles stay read-only. */}
</div>
```
Greeting tests (`index.test.tsx:109-160`) assert only `getByText(/Alice/)`, `/Jane/`, `/there/`, and the en-GB date string — all preserved.

## 3. ChartWrapper Reconciliation (avoid double borders)

`chart-wrapper.tsx:49` already renders its own container: `bg-card rounded-[var(--radius)] border border-border p-6` + a `text-base font-semibold` title + description + loading/error/empty precedence. **Wrapping a ChartWrapper inside a `<Card>` double-pads (p-6 inside py-4) and double-borders (border + ring).**

**Recommendation: modernize ChartWrapper's own container to the Card look; do NOT wrap chart sections in Card.**

Change ChartWrapper's outer div (line 49) from:
```tsx
<div className="bg-card rounded-[var(--radius)] border border-border p-6">
```
to match Card's surface treatment:
```tsx
<div className="bg-card rounded-xl ring-1 ring-foreground/10 p-(--card-spacing) [--card-spacing:--spacing(6)]">
```
(Or simply `rounded-xl ring-1 ring-foreground/10 p-6` if you don't want the var.) This gives chart sections the identical `rounded-xl` + `ring` look as `<Card>` without the nesting hazard. Velocity/Burndown/WeeklyTrend (all three use ChartWrapper) inherit it for free.

**SprintHealthSection special case (`SprintHealthSection.tsx:107-185`):** it has an OUTER `rounded-lg border border-border bg-card p-6` div that ALSO contains a `<ChartWrapper>` (the donut) at line 150 — that is ALREADY a double-border today. Convert the outer div to `<Card>` and the inner ChartWrapper must NOT keep a competing border. Options: (a) outer `<Card>`, and pass the donut's title/empty/error through ChartWrapper but give ChartWrapper a "bare" variant, or (b) keep outer `<Card>` and inline the donut without ChartWrapper's container. Simplest: add a `bare?: boolean` prop to ChartWrapper that drops the container classes (renders just title + chart body), used when it sits inside a Card. Preserve the `role="region" aria-label="Sprint health"` on the outer Card (test `SprintHealthSection.test.tsx:284` asserts it).

## 4. Spacing / Grid System

Modern pages (`MyTasksPage`) use:
- **Page gutter:** `px-6` horizontal everywhere. Header `pt-5 pb-5`; content sections `px-6 py-4`.
- **Section separators:** `border-b border-border/50` between header and stat row.
- **Grid gap:** dashboard currently uses `gap-4` between cards (`index.tsx:192,208,240,259,288`) — keep `gap-4` (consistent).

Current dashboard repeats `relative px-6 pb-6` on each row wrapper (lines 190, 239, 258, 287). The `relative` was only needed for the ambient SVG z-index — **drop `relative` everywhere once the SVG is gone.**

Recommended page shell (replaces `index.tsx:159` root `relative flex flex-col min-h-full`):
```tsx
<div className="flex flex-col h-full overflow-auto">
  {/* header (border-b) */}
  <div className="flex flex-col gap-4 px-6 py-4">
    {/* stat tile grid */}
    {/* sections — each is a grid row */}
  </div>
</div>
```
Wrapping all section rows in one `px-6 py-4` flex-col `gap-4` container removes the repeated per-row gutter. Grid recipes already in place and worth keeping: stat tiles `grid grid-cols-2 sm:grid-cols-4 gap-4`; paired sections `grid grid-cols-1 lg:grid-cols-2 gap-4`.

## 5. Tokens to Apply

| Hardcoded today | Replace with | Where |
|-----------------|--------------|-------|
| `rounded-lg border border-border bg-card p-4` | `<Card>` (rounded-xl + ring + `--card-spacing`) | StatTile, ActivityStrip, ReleaseCard, SprintHealth outer |
| `rounded-[var(--radius)] border border-border p-6` | `rounded-xl ring-1 ring-foreground/10 p-6` | ChartWrapper container |
| `text-6xl font-semibold` hero | `text-3xl font-semibold text-foreground` | header h1 |
| donut colors `var(--chart-1..3)` | already correct (`SprintHealthSection.tsx:47-50`) — leave as-is | donutConfig |
| status/category color strings | `statusPillClass(categoryKey)` / `CHIP_TONE_CLASS[tone]` from `lib/statusStyles.ts` | only if any section hand-rolls status colors (none currently do) |

`--chart-1..5` are defined identically in light+dark (`index.css:105-109, 140-144`) — no dark-mode work needed for charts. `CHIP_TONE_CLASS` (`statusStyles.ts:110`) is the source of truth for tinted chips; use it instead of inline `bg-blue-500/15 text-blue-600 dark:text-blue-400` if you add any new chips (you shouldn't need to — behavior unchanged).

## 6. Pitfalls

| Pitfall | Detail / Mitigation |
|---------|---------------------|
| **A11y regression** | StatTile must keep `role="region"` + `aria-label` (test `StatTile.test.tsx:27,33`); SprintHealthSection must keep `role="region" aria-label="Sprint health"` (`SprintHealthSection.test.tsx:284`). `<Card>` forwards `...props`, so pass these to `<Card>` directly. |
| **Double border/padding** | Never nest `<ChartWrapper>` inside `<Card>` (border+ring, p-6+py-4). See §3. SprintHealthSection already double-borders today — fix during conversion, don't replicate. |
| **No-op `relative`** | The `relative` on each row wrapper exists only for SVG z-index. Drop it with the SVG, else dead class. |
| **Card look ≠ old look** | Card is `rounded-xl` + `ring`, not `rounded-lg` + `border`. This is intentional (modern target) but visually shifts every section — verify dark mode (`ring-foreground/10` is theme-aware, fine). |
| **`size="sm"` typography** | Under `size="sm"`, `CardTitle` shrinks to `text-sm`. Use default size for sections with real titles; `sm` for compact stat tiles. |
| **StatTile loading skeleton** | The skeleton block (`index.tsx:192-202`) hand-rolls `rounded-lg border border-border bg-card p-4 min-h-[80px]` to match the tile. Update it to mirror the new `<Card size="sm">` geometry (`rounded-xl ring-1 ring-foreground/10`) so skeleton↔loaded don't jump. |
| **Biome `cn()` ordering** | `biome.json` uses `recommended: true` only (no `useSortedClasses` nursery rule enabled — grep found no class-sort config). So className order is NOT lint-enforced; run `npm run check` (biome check + tsc) after edits per project memory `project_biome_state`. Keep using `cn()` for conditional classes. |
| **`'use no memo'` directive** | index.tsx, StatTile, SprintHealthSection, ChartWrapper all start with `'use no memo';` — preserve it (React Compiler opt-out). |
| **`overflow-hidden` on Card** | Card sets `overflow-hidden`. If any section has content that must overflow (popovers/tooltips escaping the card), verify it still renders. Dashboard sections are self-contained — low risk. |

## Validation

- Run `npm run check` (biome check + tsc, must stay GREEN per memory).
- Run dashboard tests: `StatTile.test.tsx`, `SprintHealthSection.test.tsx`, `index.test.tsx`, `DashboardReleaseCard.test.tsx`, `ActivityStrip.test.tsx`, `WeeklyTrendChart.test.tsx`. The a11y/region/greeting assertions above are the load-bearing ones — they must continue to pass unchanged (behavior unchanged).
- Visual: per project memory `feedback_visual_bugs_dom_first`, inspect rendered DOM for spacing before iterating CSS.

## Sources

All HIGH confidence — direct file inspection:
- `routes/dashboard/index.tsx` (header §160-187, grids §190-304)
- `routes/my-tasks/MyTasksPage.tsx:714-825` (canonical header)
- `components/ui/card.tsx` (Card contract)
- `components/chart-wrapper.tsx:49` (container)
- `routes/dashboard/StatTile.tsx`, `SprintHealthSection.tsx`, `ActivityStrip.tsx:224`, `DashboardReleaseCard.tsx:75`
- `lib/statusStyles.ts:110` (CHIP_TONE_CLASS), `index.css:104-144` (radius/chart tokens)
- Tests: `StatTile.test.tsx`, `SprintHealthSection.test.tsx:284`, `index.test.tsx:109-160`
- `biome.json` (recommended-only, no class-sort rule)
