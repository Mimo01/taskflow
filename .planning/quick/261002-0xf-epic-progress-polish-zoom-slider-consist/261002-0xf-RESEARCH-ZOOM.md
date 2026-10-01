# Quick 261002-0xf: Epic chart zoom, research

**Researched:** 2026-10-02
**Domain:** Time-range zoom for two recharts 3.8 charts (CFD and Time burnup) in a Tauri/WKWebView app
**Confidence:** HIGH for the diagnosis (source read and fixtures run), MEDIUM for the recommendation (UX choice)

<user_constraints>
No CONTEXT.md (quick task). User ask, verbatim: "the sliders still do not work great, optimize it more. Look at different variants of it and make sure it works on many different date ranges."
Prior decisions still in force (261001-sqm, 261002-0et): one shared x-domain and one shared zoom for both charts, kept across metric tabs and keyed by dates; zoom chrome hidden for short domains; presets that don't cut any history are hidden; no recharts `<Legend>`; `'use no memo'` + `isAnimationActive={false}`; keep `data-x-from` / `data-x-to` / `data-zoomable` test hooks.
</user_constraints>

## Summary

The current zoom uses a recharts `<Brush>`, which is **index-based**. The chart data is **not evenly spaced in time**: history is sampled every `ceil(span/120)` days once it is longer than 120 days, while the projection is daily (up to 260 points). Once history passes 120 days, the Brush strip is no longer linear in time. In the fixtures, "today" sits 106 to 239 px away from its true time position on a 640 px strip, and zooming to 1M or 2W leaves a 9 to 21 px selection with two 6 px handles, which is impossible to grab. Zooming in also shows no extra detail, because the history is still 3 to 5 day samples. Axis ticks are counted from `from` rather than placed on calendar dates, so every tick label changes on each 1-day pan. The last tick can also stop 107 days before the end of the window, and the labels never show a year. On top of that, the whole section re-derives everything on every drag tick, and each re-render snaps the Brush handles back to sample positions.

**Primary recommendation:** Remove the recharts Brush. Add a date-continuous **range navigator**: a two-thumb base-ui `Slider` (already installed) measured in days, with a small overview sparkline drawn behind it on the same linear time scale. Dragging the middle of the selection pans it. Keep the presets as quick jumps, and choose the preset set by domain length. Also: derive history **daily**, then resample only the visible window to 260 points or fewer; place ticks on calendar boundaries (days, then Mondays, then months, then quarters); and keep the live drag range local to the chart, committing it to the section on release.

## Diagnosis (fixtures run against the real lib helpers; scratch vitest, not committed)

today = 2026-10-02, brush strip assumed 640 px wide. Data = `historyDates` + `projectFinish` points + `padToDomain`, which is exactly what the charts feed the Brush.

| Case | Domain | Points (hist step / future step) | "today" handle error | 1M / 2W selection width on strip | Ticks (All) |
|---|---|---|---|---|---|
| A 3w hist, +2w fc | 35d | 36 (1d / 1d) | 0 px | zoom disabled (<=42d) | ok |
| B 5w, +8w fc | 91d | 92 (1d/1d) | 0 | 211 / 98 px | Aug 28, Sep 16, Oct 5, Oct 24, Nov 12 (end Nov 27 unlabeled) |
| C 10w, no fc | 70d | 71 (1d) | 0 | 274 / 128 | ok |
| D 3mo, +1mo | 126d | 127 (1d/1d) | 0 | 152 / 71 | last tick Oct 15, end Nov 6 |
| E 4mo, +4mo | 250d | 189 (**2d**/1d) | **-106 px** | 54 / **27** | ok-ish |
| F 9mo, +3mo | 365d | 186 (**3d**/1d) | **-162 px** | 34 / **17** | "Jan 5 ... Jan 5" (no year) |
| G 12mo, +12mo (clipped) | 730d | 276 (**4d**/2d) | **-106 px** | 21 / **12** | "Oct 2 ... Oct 2" (no year) |
| H 18mo, +6mo | 728d | 291 (**5d**/1d) | **-239 px** | 16 / **9** | last tick Nov 7, end Mar 31 |

Root causes, each confirmed:

1. **The Brush works on indexes, so the strip is not linear in time** [VERIFIED: `recharts/es6/cartesian/Brush.js` `createScale`/`getIndex` use a point scale over indexes]. The future part is denser than the history, so it takes up too much of the strip. The handles and the main axis disagree as soon as history is longer than 120 days (cases E to H).
2. **Zooming in shows no extra detail.** `historyDates` keeps the 2 to 5 day step at any zoom level. The 2W preset on case H shows 5 points, and `from` snaps back to Sep 14 instead of Sep 18 (`rangeIndexes` picks the previous sample). The stepAfter areas look blocky.
3. **The handles snap on every re-render** [VERIFIED: Brush `getDerivedStateFromProps` reruns `createScale` and resets `startX`/`endX` to `scale(index)` whenever `data !== prevData`]. Both the section and the charts are `'use no memo'`, and `withProjection`/`padToDomain` build a new array on every render. Each `onChange` therefore re-renders, the handle jumps to the floor sample position, and the leftover pixels are lost. Moving right, the handle falls behind the cursor; moving left, it runs ahead.
4. **Each drag tick re-renders the whole section.** `onRange` calls `setZoom` in `EpicProgressSection`, which reruns every forecast, `deriveCfd`, `deriveRisks`, and (in the Time chart) `deriveTimeBurnup` for each mouse move.
5. **Ticks** (`axisTicks`): the step is `ceil(span/5)` days counted from `from`. They are not on calendar dates, every label changes on each 1-day pan ("Jul 1|Jul 7..." becomes "Jul 2|Jul 8..."), the last tick can be far from `to`, and there is no year, so "Oct 2 ... Oct 2" is ambiguous over a two-year domain.
6. **Small hit targets and weak accessibility.** The strip is 20 px high with 6 px handles and no overview, so you can't see what you are selecting. The handles get `aria-label="Min value: undefined, Max value: undefined"` and `aria-valuenow` = pixel x [VERIFIED: Brush.js `getAriaLabel` reads `.name`, which our rows don't have]. Arrow keys move one index, which is 1 day in the future part and 5 days in the history.
7. **Remounts.** The Brush `key` combines epoch and domain, so the Brush remounts whenever the forecast loads (worklogs arrive and the domain changes). The handles jump, and an in-progress drag can be cut off.

## Variants

| Variant | Pros | Cons | Verdict |
|---|---|---|---|
| (a) Keep recharts Brush, but feed it date-continuous daily data with a fixed density and a `<Brush>` panorama child | Smallest change; recharts draws the overview | Still index-based, so it is linear only if every row is exactly one day apart. Two years at 1 day each is about 730 rows (over the ~260 budget), or you need a uniform stride everywhere, which loses daily detail when zoomed. The handle snap and `aria` problems stay. The panorama re-renders the full series. | Fallback only |
| **(b) Date-based two-thumb navigator (base-ui Slider) + overview sparkline + pan by dragging the middle** | Linear in time by construction; 1-day snapping; real `<input type=range>` thumbs, so keyboard, Shift/PageUp and `aria-valuetext` come for free; controlled value with no remounts; data density decoupled from the control | About 150 lines of our own code (pan handle, sparkline); base-ui has no built-in "drag the range" [CITED: base-ui.com/react/components/slider, only thumbs drag] | **Primary** |
| (c) Drag across the plot to select a range, plus a Reset button | Very direct; no extra strip | Clashes with the hover tooltip and cursor; no way to pan; can't be discovered or used from the keyboard | Optional later complement |
| (d) Wheel or trackpad pinch to zoom, drag to pan | Natural on a trackpad | WKWebView sends pinch as `gesturestart/change/end`, **not** ctrl+wheel [CITED: d3-zoom#229, use-gesture#518; MEDIUM], so both paths must be handled. A plain wheel over the chart would take over page scrolling in the detail panel. No keyboard support. | Reject |
| (e) Presets only, with a smart set per domain length | Simple, robust, testable | Can't look at an arbitrary period (for example "around the March replan") | Keep as complement to (b) |

### Mockups

**Variant B (recommended): navigator under the plot, presets in the legend row**
```
 12 ┤            ▄▄▄▄▄▄▄
    │      ▄▄▄▄▄█████████▄▄▄ ╌╌╌╌ forecast
  0 ┼──────┬───────┬───────┬───────┬───────┬──
         Jul     Aug     Sep   │ Oct     Nov            <- calendar-aligned ticks
                             today
  ┌──────────────────────────────────────────────────┐
  │ ._.-‐‐‐‐‐‐‐‐‐‐-.__   ┃▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┃╌╌╌╌.    │  <- sparkline (Remaining + forecast)
  └──────────────────────────────────────────────────┘     selection = drag to pan, ┃ = thumbs
   Mar 2026            Aug 14 – Nov 27 (105 d)    Mar 2027
 ■ Completed ■ In progress ■ To do ─ Remaining ╌ Forecast     [All][6M][3M][1M][Forecast]
```

**Variant A (fallback): improved recharts Brush with panorama**
```
  ┼──────┬───────┬───────┬───────┬──
  ┌─────────────────────────────────┐
  │▁▂▃▅▆▇█▇▆▅▃▂▁┃░░░░░░░░░░┃▁▁▁▁▁▁▁▁│   <- Brush + <AreaChart> panorama, 28 px
  └─────────────────────────────────┘      (time-linear only if rows are uniformly spaced)
                                  [All][3M][1M][2W][Forecast]
```

**Variant E+C (minimal): presets + drag-select on the plot**
```
 12 ┤        ░░░░░░░░░░░                 <- drag across the plot to select
    │   ▄▄▄▄▄░░░░░░░░░░░▄▄▄
  0 ┼──────┬─░─────┬───░───┬──
         Jul     Aug     Sep
 Showing Aug 3 – Aug 29  [Reset]         [All][6M][3M][1M][Forecast]
```

## Recommended implementation (Variant B)

**Architecture tiers:** everything runs in the browser/client. The pure helpers belong in `src/lib/epic-progress.ts`, the controls in `EpicChartZoom.tsx`, and the committed zoom state stays in `EpicProgressSection`.

1. **Data model: days, not indexes.** The slider value is `[fromOffset, toOffset]` in whole days from `domain.from`, with `min=0`, `max=spanDays`, `step=1`, `largeStep=7`, `minStepsBetweenValues=MIN_SPAN` and `thumbCollisionBehavior="none"`. Helpers: `rangeToOffsets(range, domain)` and `offsetsToRange(o, domain)`. Delete `rangeIndexes` and the Brush.
2. **Daily history plus resampling of the visible window.** Change `historyDates` so it always returns daily dates (or add `historyDatesDaily`); two years is about 730 rows and cheap to derive. Add `viewSample(rows, range, max = 260)`. It keeps the rows inside `[from, to]` plus one neighbour on each side (so lines reach the plot edge), takes every `ceil(visibleDays / max)`-th row, and always keeps today, the optimistic, likely and pessimistic dates, and the last row. The overview sparkline uses `viewSample(rows, domain, 160)` with only Remaining and forecast. The rendered point count stays at 260 or fewer at every zoom level, and zooming in shows daily detail.
3. **Ticks: `timeTicks(from, to, widthPx)`.** Target `floor(width / 72)` labels, no fewer than 3. Pick the first unit from the ladder `1d, 2d, 1w (Mondays), 2w, 1mo (the 1st), 2mo, 3mo (quarter starts), 6mo, 1y` that fits. The format depends on the unit: days and weeks show "Sep 14"; months show "Sep", or "Jan 2027" on a year change. If the domain spans a year boundary, show the year on the first tick and on the January tick. Because ticks sit on calendar dates, they don't change while panning. Optionally add a faint "today" `ReferenceLine`.
4. **Minimum span and when zoom is shown.** `MIN_SPAN = 7` days. Show the zoom controls when the domain is longer than about 28 days (4 × MIN_SPAN), replacing the 42-day rule. `ZOOM_MIN_DAYS` is your call (see A2).
5. **Smart presets** (still filtered by "must cut history or future"): domain <= 90d: All, 2W, Forecast; 90–240d: All, 1M, 2W, Forecast; > 240d: All, 6M, 3M, 1M, Forecast. Show at most 5. Clicking a preset sets the slider value; touching the slider clears the preset (`aria-pressed=false`).
6. **Live drag vs commit.** The chart component holds `live: ChartRange | null`. `onValueChange` sets `live`, throttled with `requestAnimationFrame`. `onValueCommitted` calls `zoom.onRange(range)` and clears `live`. The section therefore re-renders only on release. Memoize `deriveTimeBurnup` in `EpicTimeBurnup` with an explicit `useMemo`, because the file is `'use no memo'`.
7. **Panning.** The `Slider.Indicator` (the selection) gets `onPointerDown`, then `setPointerCapture`, and on each move shifts both offsets by `round(dx / pxPerDay)`, keeping the span and clamping to `[0, span]`. Double-click resets to All. Use `touch-action: none` and `cursor: grab`. Don't rely on `pageX` deltas through window listeners.
8. **Keyboard and accessibility.** Each thumb gets `getAriaLabel(i)` ("Range start" / "Range end") and `getAriaValueText` (the formatted date). Arrow keys move ±1 day, and Shift or PageUp moves ±7. Wrap it in `role="group" aria-label="Chart range"`. Show a visible caption: "Aug 14 – Nov 27 (105 d)".
9. **Domain changes and persistence.** The state stays date-keyed in the section, shared across tabs, and resets when the epic changes. When the domain changes (forecast loads), apply `clampRange` with the min span. If the stored custom `to` was equal to the old `domain.to`, keep it pinned to the new end. Never remount. Session or local storage persistence is optional (A3).
10. **Height.** Plot 232 px plus navigator 28 px; the thumbs are 12 px wide with a 24 px hit area. `data-zoomable` keeps its meaning.

### Don't hand-roll
| Problem | Use | Why |
|---|---|---|
| Thumb drag, keyboard, ARIA, collisions | `@base-ui/react/slider` 1.3.0 (installed) | Native range inputs, `minStepsBetweenValues`, `largeStep`, `getAriaValueText` [VERIFIED: node_modules d.ts] |
| Date math | existing `addCalendarDays`, `dateKeyMs`, `diffDays` | One UTC day-key model already in use |
No new packages, so no package legitimacy audit is needed.

## Common pitfalls
- **Moving pixels instead of days.** Snap pan deltas to whole days and keep the remainder in a ref, otherwise you rebuild the Brush drift bug.
- **Forgetting the neighbour rows** in `viewSample`. stepAfter areas then start partway into the plot.
- **`allowDataOverflow` is required** once the Brush no longer slices the data. recharts adds the clip path only when it is set [VERIFIED: `GraphicalItemClipPath.js` `needClipX`].
- **Committing on every move** causes a section re-render storm. Commit only on release.
- **WKWebView:** pointer capture works, but Safari pinch arrives as `gesture*` events. If wheel or pinch is ever added, handle both.
- **jsdom:** Slider pointer geometry is zero, so test keyboard only and keep the logic in pure helpers.

## Validation architecture
Framework: vitest 4.1 (jsdom). Quick: `npx vitest run src/lib/epic-progress.test.ts`; full: `npx vitest run`.

| Case (today 2026-10-02) | Expected |
|---|---|
| A 3w hist + 2w fc (35d) | navigator shown (above 28d) or hidden (if the 42d rule is kept); presets All/2W/Forecast |
| B 5w + 8w fc (91d) | All/2W/Forecast (or plus 1M); Forecast = Sep 18..Nov 27; navigator today at 38% |
| C 10w, no fc | no Forecast preset; 1M = Sep 2..Oct 2 |
| D 3mo + 1mo | All/1M/2W/Forecast |
| E 4mo + 4mo (250d) | **today thumb at 50% of the track (time-linear)**; 2W renders 15 daily points |
| F 9mo + 3mo | All/6M/3M/1M/Forecast; ticks are month starts with the year at the Jan 2027 tick |
| G 12mo + 12mo, clipped | domain ends at the cap; `clippedAfter` respected; at most 260 points at All |
| H 18mo + 6mo | 2W shows Sep 18..Oct 2 daily (15 pts); All ≤ 260 pts; last tick within one unit of `to` |
| Pan 30d window by 1d | tick labels unchanged (calendar-aligned) |
| Keyboard | Arrow ±1 day; Shift+Arrow ±7; thumbs can't get closer than 7 days; `aria-valuetext` is a date |
| Domain grows (forecast loads) | custom range kept; range pinned to the end follows the new end; no remount |

New unit tests: `timeTicks`, `viewSample`, `rangeToOffsets`/`offsetsToRange`, `panRange`, `smartPresets`. Component tests: the existing `EpicProgressSection.test.tsx` `data-x-from/to` assertions, plus slider keyboard. Check manually in Tauri: drag a thumb, pan the selection, double-click to reset.

## Security domain
UI-only, client-side change with no input crossing a trust boundary. V5: slider values are clamped integers. No ASVS impact.

## Assumptions log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The chart and strip are about 640 px wide in the detail panel | The pixel errors scale with width, but the conclusions hold |
| A2 | Lowering the zoom threshold to 28d (from 42d) is wanted | Easy to keep at 42d |
| A3 | Zoom should reset when the epic changes (no storage) | Add sessionStorage keyed by epic if you want it kept |
| A4 | Deriving daily CFD history over about 730 days is cheap enough per render | If profiling disagrees, memoize the derivation with an explicit useMemo |
| A5 | The smart preset thresholds (90 / 240 days) | Cosmetic; tune during UAT |

## Sources
- `taskflow/node_modules/recharts/es6/cartesian/Brush.js` (3.8.0): `createScale`, `getIndex`, `getDerivedStateFromProps`, `getAriaLabel`. HIGH
- `taskflow/node_modules/@base-ui/react/slider/root/SliderRoot.d.ts`, `thumb/SliderThumb.d.ts` (1.3.0). HIGH
- https://base-ui.com/react/components/slider (range slider support; only the thumbs drag). HIGH
- https://github.com/d3/d3-zoom/issues/229, https://github.com/pmndrs/use-gesture/discussions/518 (Safari pinch uses gesture events). MEDIUM
- Fixture run: scratchpad `zoom/zoom.test.ts` against `src/lib/epic-progress.ts` (not committed). HIGH

**Valid until:** 2026-11-01
