# Quick 261102-st4: Release Progress graph polish

Commit: see `git log` (feat(quick-261102-st4)). All 5 locked decisions implemented in ReleaseBurnup.tsx, burnupLabelLayout.ts, GraphSlot.tsx.

1. Aside `since <name> · <date>`: name `text-foreground/80` truncates first, date shrink-0, one line; no previous -> `since Oct 1`; year in text and title when start not in current year. GraphSlot: title and icon shrink-0, aside has min-w-0 and pl-2 (found in the long-name sheets: title and icon were squeezed).
2. End dots r=3 with 1.5 background ring on done (green) and scope (muted); scope==done draws one (green). END_OFFSET raised so labels clear the dot; dot boxes are in the property test.
3. Room: X_AXIS_HEIGHT 30->22, top margin 16->14, marker band shortened, END_H 14->13, end-label background rect inset (x+1, y+2, h-4) so it no longer masks lines.
4. Markers 10px, fillOpacity 0.7, char width 7, legible in dark.
5. `yearAwareTicks` (burnup-local; lib/epic-progress.ts untouched, shared by epic charts): year on first tick when axis not entirely in current year, and on first tick of each new year (`Dec 28, 2025` / `Jan 2027`).

Tests: aside + year + dots + yearAwareTicks; property test now uses real headroom and includes dot boxes (dot-vs-dot excluded). Release-detail suite 635 pass, tsc and biome clean.

## Visual matrix
40 scenarios (previous 37 plus long previous name, no previous, previous-year start, year-boundary variants) in `screenshots/after-{light,dark}-w{280,400,560,760,1100}-h110-p{0,1,2}.png`, plus 140/200 and non-compact (light/dark) sheets at 400.
Viewed by me: light 400 p0/p1/p2, dark 400 p0, light 280 p2, dark 280 p1, dark 1100 p2. Not individually viewed: 560, 760, 140, 200, non-compact, other 1100/280 sheets.

Remaining trade-offs
- adv2 (45 scope, release 1 day after today at the far left): scope/done labels sit across the dashed RELEASE line (pre-existing crossing cost).
- adv1 (999/998) and "late": the flipped "998 done"/"28 done" label sits hard against the line below the scope line; the trimmed rect hides a few px of the green stroke next to the text.
- Axis year labels are wider; at 280px the tick count drops to 2-3.
- Scope dot is partly hidden behind the vertical TODAY line on steep rises (still visible).
- Preview scaffolding deleted; screenshots uncommitted.

## Orchestrator follow-up (81a0b5f4)

Spot-check of unviewed sheets (light 560/h110 p0, dark 760/h110 p2) found end labels laid across the RELEASE line when release is 1-2 days after today (1d-apart, 2d-apart, adv2). Root causes: crossing a marker cost only 20 vs flip-left 100 (and the first side with any candidate won); ReferenceLine shares zIndex 400 with the series and paints over labels/dots; trimmed 9px label rect let the dashed line show above/below the text.
Fix: crossing = hard cost (1000), best of both sides chosen; markers zIndex 150 (above area, under lines/dots/labels — also un-hides the scope dot behind TODAY); `onMarker` flag → full-height mask only when a crossing is unavoidable (TODAY at left edge). Tests: 1-2 day gap regression (proved failing pre-fix) + onMarker flag. Re-rendered 400/560 light + 400/h140 dark: clean.
