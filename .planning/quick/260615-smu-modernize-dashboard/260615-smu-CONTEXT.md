# Quick Task 260615-smu: Polish and modernize the dashboard - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Task Boundary

Polish and modernize the dashboard (`src/routes/dashboard/`) so it looks modern,
matches the rest of the app's visual language, and is consistent. The dashboard
is functionally complete but visually dated versus pages like MyTasks and
SprintBoard: it uses raw `rounded-lg border border-border bg-card` divs instead
of the shared `<Card>` primitive, has an ambient orange/blue SVG-curve header
that no other page uses, and mixes inline Tailwind for spacing/typography.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **Polish + light restructure.** Restyle existing sections AND reorder/regroup
  them and tighten the grid for better visual hierarchy.
- NO new interactions this pass: stat tiles stay read-only (do NOT add
  clickable-filter / deep-link behavior). Behavior is unchanged; this is a
  visual + layout pass only.

### Header
- **Modernize to match the app.** Replace the ambient orange/blue SVG curves
  with the bold-title + subtitle (+ optional toolbar) pattern used by MyTasks /
  SprintBoard. Match their header typography and spacing.

### Cards
- **Fully adopt the shared `<Card>` primitive.** Wrap all dashboard sections
  (stat tiles, sprint health, weekly trend, activity, release, velocity,
  burndown) in `<Card>` with header/content slots so spacing/borders/radius are
  token-driven and consistent with the rest of the app. Replace inline
  `rounded-lg border` divs.

### Claude's Discretion
- Exact section ordering/grouping within the "light restructure" allowance.
- Whether the modern header gets a toolbar and what (if anything) goes in it.
- Spacing scale, typography hierarchy, and which existing tokens
  (`--radius`, `--chart-*`, `CHIP_TONE_CLASS`, `statusPillClass`) to apply.
- How to reconcile `<Card>` adoption with the existing `ChartWrapper` so chart
  loading/error/empty states are preserved.

</decisions>

<specifics>
## Specific Ideas

- Reuse existing primitives rather than inventing new ones: `Card`, `Badge`,
  `CachedAvatar`, `EmptyState`, `ErrorState`, `Skeleton`, `ChartWrapper`,
  `cn()`, and tokens in `lib/statusStyles.ts` / `src/index.css`.
- Mirror the header/layout language already set by `MyTasksPage` and
  `SprintBoardTab`.
- Preserve each section's independent loading / error / empty states.

</specifics>

<canonical_refs>
## Canonical References

- `src/routes/dashboard/index.tsx` (lines 1-307) — dashboard composition
- `src/routes/dashboard/StatTile.tsx`, `SprintHealthSection.tsx`,
  `ActivityStrip.tsx`, `DashboardReleaseCard.tsx`, `VelocityChart.tsx`,
  `BurndownChart.tsx`, `WeeklyTrendChart.tsx`
- `src/components/ui/card.tsx`, `badge.tsx`, `button.tsx`
- `src/components/chart-wrapper.tsx`
- `src/lib/statusStyles.ts`, `src/index.css`
- Pattern references: `MyTasksPage`, `SprintBoardTab`

</canonical_refs>
