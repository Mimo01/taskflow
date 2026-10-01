# Quick 261001-rtw Summary: Epic progress — one forecast, neutral markers, unified tabs, spacing

One averaged forecast now drives both charts, colour is reserved for statuses, Count/SP/Time render through one status-bands model, and the legend spacing root cause (`-my-1.5` overriding `space-y`) is gone.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 3f080cf7 | one-forecast projection, status bands model, shared finish helpers |
| 2 | cf7fb70a | one shared forecast in both charts, neutral markers and series |
| 2b | 293b6a14 | neutral story mini bar fill and icon tooltip markers (split per plan-checker advisory) |
| 3 | 6d2fdc8a | unified Count/SP/Time bands, neutral tooltip markers, legend spacing fix |

## What changed

- `lib/epic-progress.ts`: `ProjectionSource`, `projectFinish`, `Bands/BANDS/bandTotal/bandPct/summaryBands`, `formatChip`, `FINISH_STATE_TEXT`, `formatFinishDate`, `finishDateRows`. No existing behaviour changed.
- `tooltip-body.tsx`: `MarkerGlyph`, markers `status | line | dashed | band | icon`, tone `strong | muted`; `dashed` prop removed.
- `epic-markers.tsx` (new): `MARKER_ICON`, `METRIC_ICON`, `SERIES`.
- Both charts project `projectFinish(finish, ownRemaining, ...)`; not-ok finish shows `Forecast: <state text>` in the legend; chart tooltips add Likely/Earliest/Latest rows identical to the Finish tooltip.
- `EpicBands.tsx` (new): `BandBar`, `BandChips`, `BandBreakdown`. Time-mode person bar and chips now show the same three estimate values; logged/estimate are neutral icon rows in the tooltip.
- Spacing: status block is `flex flex-col gap-1.5` with `py-1.5` trigger (bar to legend = 12px); assignee trigger `py-0.5`, no negative margins. Compensation without negatives: chart, status block and assignee list sit in a plain `flex flex-col` group with `mt-3.5` (chart to bar, so 14 + 6 trigger padding = 20px as before) and `mt-4.5` (legend to rows, 18 + 2 = 20px). Hero caption `mt-1.5` (gap-1.5 + mt-1.5 = 12px).

## Neutral series values (dark-mode legibility)

- Remaining: stroke `var(--color-foreground)` 1.5 solid.
- Forecast: stroke `var(--color-foreground)` 1.5, dash `4 4`.
- Range band: fill `var(--color-muted-foreground)` opacity 0.15.
- Logged: stroke `var(--color-muted-foreground)` 2 solid.
- Estimate: fill `var(--color-muted-foreground)` opacity 0.08 with a 1px muted-foreground stroke (stroke carries legibility; the fill is the lowest permitted by the plan, the 0.15 minimum in the brief applies to the band). Needs visual UAT in dark mode.
- Glyph `band` marker: muted/foreground colour at `opacity-30` plus 1px border.

## Intentional existing-test changes (1–11)

1. tooltip-body.test dashed glyph rewritten to `marker="dashed"`, neutral border colour.
2. tooltip-body.test no-colour row now muted `line` glyph.
3. tooltip-body.test `marker line` uses tone colour, ignores passed colour.
4. tooltip-body.test icon marker: `text-muted-foreground`, empty `style.color`.
5. EpicChartTooltip.test From today row: `data-marker="icon"` instead of `rounded-full`.
6. Section 'renders all panels': `In Review · 1` (was `· 5 SP`).
7. g5q Time hero test renamed; `33%`, `1h of 3h done · 0m in progress`.
8. g5q Time assignee chips test renamed; `done 1h / in progress 0m / to do 2h`, no `logged` chip.
9. g5q row tooltip hover target is `getByLabelText('to do 2h')`.
10. hsz hero: `1h of 3h done`.
11. qvu spacing test renamed `bar-to-legend spacing uses no negative margins`; `mt-1.5`, `epic-status-block` flex-col/gap-1.5, no `-m` tokens.

No other existing assertion changed; the full vitest suite (3053 tests) passes on every commit through the pre-commit hook.

## Deviations from Plan

1. Story mini bar split into its own commit (293b6a14), as allowed.
2. Stalled risk icon changed Hourglass to CirclePause (as the plan specified, listed here per its output instruction).
3. [Rule 1 - minor] EpicChartTooltip.test fixture needed non-null forecast dates for `averageForecasts` to treat it as usable (test-only fix).
4. Hero big text is `—` when `summary.total` is 0 (per spec), including the edge case of all-done with SP total 0 where `pctDone` is 100.
5. Moved the new Bands block above the "Cumulative flow diagram" section header in `epic-progress.ts` (comment/position only).
6. Section `<>` fragment removed (biome noUselessFragments) after the chart moved into the lower group.
7. Hero bar segment widths are now unrounded `value/total*100%` (previously rounded integers); no test asserted exact widths.

No threat flags. `fetchAllSearchPages` untouched. Known stubs: none.

## UAT still needed (real Tauri app)

Forecast line/band contrast in light and dark (especially Estimate fill 0.08), both charts ending at the Finish tile dates, visible bar to legend gap, Time-mode person rows.

## Self-Check: PASSED

Commits 3f080cf7, cf7fb70a, 293b6a14, 6d2fdc8a exist; `EpicBands.tsx`, `epic-markers.tsx` present.
