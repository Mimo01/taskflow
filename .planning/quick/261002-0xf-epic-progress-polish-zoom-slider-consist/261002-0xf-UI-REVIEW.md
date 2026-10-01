# Quick 261002-0xf: Epic progress section UI review

**Audited:** 2026-10-02 (retroactive, after 261002-0et at HEAD 87aeda1b)
**Baseline:** Abstract 6-pillar standards, plus the user's style contract: full-width divider layout, hero + stat strip, status colours only for statuses, neutral glyph markers. No UI-SPEC.md exists.
**Screenshots:** Not captured. Vite answers on :1420, but Playwright isn't installed, and the epic view needs Tauri IPC and an authenticated Jira session. This is a code-only audit. Any finding marked *(verify in DOM)* depends on WebKit layout, so inspect the rendered DOM before changing CSS (see memory: visual bugs, DOM first).

**User feedback driving this review:** "Make the top 4 cards consistent across tabs. Different things have different widths. Tooltips are way too long, with way too much text. Risks are better but too cluttered. Polish this part way more." Keep the style; tighten it.

---

## Pillar Scores

| Pillar | Score | Key finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Tooltip notes reach 15–19 words. One concept has 3–4 names (Finish / Projected finish / Forecast; Latest / pessimistic; Items / Count). Explanations run up to 16 words. |
| 2. Visuals | 2/4 | The hero button is fit-content, so the hero bar's length follows the caption length in each tab. The hero has no label, so value rows don't line up. The Risks card uses a different structure (a list instead of label/value/sub). |
| 3. Color | 3/4 | Status-only colour mostly holds. Two `bg-primary` toggle groups compete in one section, and the overrun bar uses a hardcoded `bg-red-500`. |
| 4. Typography | 3/4 | 5 sizes (3xl/lg/sm/xs/`[11px]`). The Risks card switches between `text-lg` (clean) and `text-xs` (list). The arbitrary `text-[11px]` appears 3 times. |
| 5. Spacing | 2/4 | Off-scale half steps (`mt-3.5`, `mt-4.5`). The hero gap is asymmetric (6px vs 12px). Risk rows are indented 4px from the label. Skeleton heights don't match the real cards. The Y-axis width differs by 8px between tabs. |
| 6. Experience Design | 2/4 | The grid uses viewport breakpoints, so the 480px peek panel gets 4 columns of ~85px. Card height changes with state and tab. The Risks content changes with the tab. The empty SP/Time state collapses ~400px of layout. |

**Overall: 14/24**

---

## Top 3 Priority Fixes

1. **BLOCKER: the top strip has no fixed geometry.** Column widths come from viewport breakpoints (`sm:`/`lg:`), not from the container. The hero `<button>` is fit-content. Each card renders 2, 3 or N lines depending on state. **Impact:** widths differ between the hero (1.4fr) and the tiles (1fr), between `sm` (hero full row) and `lg`, and between tabs (hero bar length). The peek panel gets ~85px tiles that truncate everything. **Fix:** add a shared `StatCard` shell with a fixed 3-slot anatomy (72px tall, `w-full`) inside an equal-column container-query grid (§A.3).
2. **BLOCKER: tooltips exceed any reasonable budget.** The Finish tooltip has 10–11 lines and ~50 words. The Time-tab hero tooltip has ~11 lines and ~49 words (it includes a 15-word formula note). The Remaining tooltip repeats the card's three values and adds a 19-word note. Chart tooltips repeat the Finish tooltip. **Fix:** at most 4 rows, at most one note of 8 words or fewer, and no row that repeats the trigger. Exact rows are in §B.
3. **WARNING: the Risks card is a variable-height list whose content changes with the metric tab.** `unestimated` means "no SP" on Count/SP and "no time estimate" on Time. Stalled and scope-growth risks repeat the Finish card. The overdue popover lists every open story. **Fix:** show a count value plus one line of icon chips, make risks tab-independent, de-duplicate them against Finish, and drop the overdue list (§C).

There are 18 numbered fixes in total (P1 ×5, P2 ×6, P3 ×7). See the Prioritized Fix List at the end.

---

## A. Top 4 cards (hero, Finish, Remaining, Risks)

### A.1 What each card renders today (by code path)

Grid: `EpicProgressSummary.tsx:434` uses `grid-cols-1 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]`. The hero wrapper at `:435` is `sm:col-span-3 lg:col-span-1`.

| Card | Count tab | SP tab | Time tab | Lines |
|------|-----------|--------|----------|-------|
| **Hero** (`:151-205`) | `45%` (text-3xl) · BandBar h-2 · caption `3 of 12 done · 2 in progress` | `38%` · bar · `11.5 SP of 30 SP done · 6 SP in progress` | `52%` · bar · `120h 30m of 232h done · 64h 15m in progress` | 3 rows (no label row) ≈ 72px |
| **Finish** (`:207-272`), independent of the tab (averaged) | ok: label `Finish` · value `Oct 14` (or `Jan 3, 2027`) · sub `Oct 9–Oct 28` + meter `▂▄▆ Medium` | same | same | ok: 3 lines ≈ 55px |
| | too-early / stalled / not-converging / done: value `Too early to tell` / `Stalled` / `Not converging` / `Complete`, **no sub** | same | same | **2 lines ≈ 39px** |
| **Remaining** (`:417-462`) | `9 items` · sub `26 SP · 64h 15m` | `26 SP` · sub `9 items · 64h 15m` | `64h 15m` · sub `9 items · 26 SP` | 3 lines ≈ 55px |
| **Risks** (`:379-405`) | label + N buttons (`text-xs`, 20px each, gap 2px); `unestimated` = **open items without SP** | same set | `unestimated` = **open items without a time estimate**, so the count changes or the line appears/disappears | clean: 2 lines (`No risks` in text-lg) ≈ 39px · 1 risk ≈ 38px · 3 ≈ 82px · 5 ≈ 126px |
| | `+` Stalled duplicates the Finish value `Stalled`; `+` Scope growing duplicates `Not converging` | | | |

### A.2 Every width, height and line-count difference found

1. **Hero bar length changes per tab (BLOCKER).** The hero trigger is a `<button>` (`:188-191`, `flex flex-col` but no `w-full`). Under the HTML button layout rules, an auto-width button gets its fit-content width even with `display:flex`. Its width is therefore `min(max-content of the caption, column)`. The caption max-content is ~160px (Count), ~240px (SP) and ~290px (Time), against a hero column of ~260px in a ~900px main pane. The `w-full` BandBar (`:194`) is short on Count, longer on SP, and clamped on Time. This alone matches "different things have different widths". *(verify in DOM)*
2. **The Finish and Remaining tile buttons are also fit-content** (`Tile`, `:102`, `TILE_CLASS` at `:85` has no `w-full`). Their hit area and tooltip anchor (the tooltip centres on the trigger) move as the value text changes between tabs. Vertically, if WebKit stretches the button to the row height, the button centres its content. When Risks is taller than the hero (3+ risks), the Finish and Remaining labels then sit 5–27px below the Hero and Risks tops. *(verify in DOM)*
3. **The hero is 1.4fr and the tiles are 1fr** (`:434`). These are different widths by design, and that is the exact complaint.
4. **At `sm` (640–1023px window), the hero takes a full row** and the three tiles share the next row. At `lg`, all four share one row. A Tauri window resized across 1024px reshapes the strip.
5. **Peek panel (default 480px, `px-4`, ~448px content) on a ≥1024px window** gets the `lg` 4-column grid: hero ≈ 120px, tiles ≈ 85px. Several values then truncate: the Finish value `Jan 3, 2027`, the sub `Oct 9–Oct 28 Medium`, `Too early to tell`, and the Risks lines `3 unestim…`. Breakpoints are viewport-based (`sm:`/`lg:`). Nothing uses `@container`.
6. **The hero has no label row; the tiles do.** The hero's `45%` cap-top lines up with the tiles' label row, so the value rows sit on different baselines (the hero number is one row higher).
7. **Finish height changes by state.** It has 3 lines when `ok` and 2 lines in every other state (`:210-212`, with no `sub`). `Too early to tell` (17 chars in text-lg semibold, ~165px) truncates in any column under ~170px.
8. **Finish width changes by year.** `formatFinishDate` adds `, 2027` across a year boundary (`epic-progress.ts:1377-1380`), but the sub-line range (`:217`, `formatDateKey`) never shows a year, so `Dec 20–Jan 15` is ambiguous.
9. **The Remaining value width changes by tab** (`9 items` vs `26 SP` vs `312h 30m`). `formatDuration` (`services/jira/duration.ts:60`) always prints minutes, even at hundreds of hours.
10. **Risks height is unbounded** (1–5 lines) and **changes on a tab switch** (`epic-progress.ts:1531-1547`: metric-dependent `unestimated`).
11. **Risks typography switches by state.** Clean state: `text-lg font-semibold` plus a `size-4` icon (`:390`). Risk state: `text-xs` rows plus `size-3` icons (`:318-321`). Risk rows are indented 4px (`px-1`, `:318`) from the `Risks` label.
12. **The skeleton doesn't match** (`EpicProgressSection.tsx:138-142`). Hero `h-16` (64px) vs ~72px real; tiles `h-12` (48px) vs 39–126px real; and it uses the same viewport grid.

### A.3 Proposed fixed grid and per-card content contract

**Grid (identical in every tab and state):**

- Put `@container/epic` on the summary wrapper (or on the section).
- Grid: `grid grid-cols-2 gap-x-6 gap-y-4 @2xl/epic:grid-cols-4`. All columns are equal, `repeat(n, minmax(0,1fr))`. The 1.4fr hero is gone; hero emphasis comes from the type size only.
  - Container ≥ 672px: 4 equal columns, ~150px minimum each.
  - Smaller (the peek panel): 2×2 as `Hero | Finish` / `Remaining | Risks`, ~212px each in the default peek.
- Every card is a `StatCard` shell: `grid w-full min-w-0 grid-rows-[1rem_2rem_1rem] gap-1 self-start text-left` → **exactly 72px tall**. Interactive cards are `<button>`s with an explicit `w-full` (never rely on stretch).
- Slot rules:
  - **Label row** (h-4): `text-xs text-muted-foreground truncate`, a static word.
  - **Value row** (h-8): `flex items-end gap-2 leading-none`. The tiles use `text-lg font-semibold`; the hero uses `text-3xl font-semibold`. Values are bottom-aligned so baselines line up across cards. The value truncates and never wraps.
  - **Sub row** (h-4): `flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap`. One line, and the leftmost text truncates first. The slot always exists, even when empty (render an `aria-hidden` nbsp), so height never changes.
- The skeleton reuses `StatCard` geometry: four `h-[72px]` blocks in the same container grid.

**Per-card content contract:**

| Card | Label | Value (max) | Sub (one line max) | Truncation |
|------|-------|-------------|--------------------|------------|
| Hero | `Completed` (not `Done`: an always-visible exact `Done` node breaks the EpicDetailSheet text-collision rule) | `45%` / `—` (≤ 4 chars, text-3xl), followed inline by a muted text-xs caption: Count `3 of 12`, SP `11.5 of 30 SP`, Time `120h of 232h` (≤ 14 chars; compact duration, see A.4) | BandBar `h-2 w-full`, vertically centred in the h-4 slot | The caption truncates; the % never does |
| Finish | `Finish` | ok: `Oct 14` / `Jan 3, 2027` (≤ 12). Non-ok: `Too early` / `Stalled` / `No end date` / `Complete` (≤ 11) | ok: `Oct 9 – 28` (same month) or `Dec 20 – Jan 15` (add `'27` only across a year) + ConfidenceMeter (flex-none). Non-ok: a reason of 4 words or fewer: `Needs more completed work` / `No progress in 12 days` / `Scope grows faster than done` / `All work done` | The range truncates; the meter never does |
| Remaining | `Remaining` | Active metric: `9 items` / `26 SP` / `64h` (≤ 9) | The other two in the fixed order Items · SP · Time: `26 SP · 64h` | The sub truncates from the end |
| Risks | `Risks` | `No risks` (muted) / `1 risk` / `3 risks` (≤ 8) | Clean: empty slot. Otherwise a row of up to 4 icon chips (§C) | The chip row never wraps (de-dupe keeps it at 4 or fewer) |

The value is the only `font-semibold` text in each card. Labels and subs are muted xs. Status colour appears only in the hero BandBar.

### A.4 Number formatting

- Add `formatDurationCompact(sec)`: ≥ 10h → `312h` (rounded); < 10h → `4h 30m`. Use it in the hero caption, the Remaining value and sub, the Time-mode BandChips (`EpicBands.tsx:68-69`), and the assignee chips. Keep full `formatDuration` inside tooltips. In the Time tab today, `min-w-[3.5rem]` chips with `312h 30m` (~61px) grow per row, so the assignee bars' right edges don't line up (the flex-row sizing issue from memory).
- SP: write `11.5 of 30 SP`, not `11.5 SP of 30 SP` (`EpicProgressSummary.tsx:165`).
- Date ranges: one formatter (`formatDateRange(a,b,today)`) shared by the Finish sub, the Finish tooltip and the chart Range row.

---

## B. Tooltips: inventory and content budget

**Global budget (applies to every tooltip and popover in the section):**
- At most **4 rows**, plus an optional title only when it names the subject (a person or a chart date). No title that repeats the card label.
- At most **one note of 8 words or fewer**, single line, no wrapping (drop the inner `max-w-64` wrappers).
- **No row may repeat a value visible on the trigger** unless it adds something new (e.g. a %).
- Formula and provenance text is not tooltip content. Approximate-data warnings live in one place: the chart's `SourceFlag`.
- Sub-values (`8 working days`) appear at most once per tooltip.

| # | Tooltip | File:line | Now: rows / ~words | Proposed rows (exact) | Budget |
|---|---------|-----------|--------------------|-----------------------|--------|
| 1 | **Hero** (Count/SP) | `EpicProgressSummary.tsx:166-184`, DataSources `:129-149`, lib `:1797-1831` | 3 band rows + divider + `Data sources` + 3 source lines = **7 lines / ~29 words** | `Completed 3 · 25%`, `In progress 2 · 17%`, `To do 7 · 58%`. Note only when not real history: `Approximate: status history loading` | 3 rows + ≤1 note |
| 1b | **Hero** (Time) | same | 5 rows + `Data sources` + 4 lines; the 15-word ESTIMATE_FORMULA_NOTE wraps 2–3 lines = **~11 lines / ~49 words** | The 3 band rows (estimate-weighted) + `Logged 120h 30m`. Drop `Estimate`: it equals the band total. No note | 4 rows |
| 2 | **Finish** (ok) | `:230-268` | Title `Projected finish` + 3 date rows each with `N working days` + Confidence + reason line + 3 metric rows + explanation note = **10–11 lines / ~50 words**. The note `They disagree widely, so confidence is lowered.` repeats the reason `Views disagree by N working days` | `Likely Oct 14 · 8 working days`, `Range Oct 9 – Oct 28`, `Confidence ▂▄▆ Medium`, `Based on Items · SP · Time` (included metrics only). Note = `confidenceReason` (already ≤ 8 words, e.g. `Only 4 completions in 12 working days`). No title, no explanation note, no per-metric dates | 4 rows + 1 note |
| 2b | **Finish** (non-ok) | same | Title + 3 metric rows (`too early to tell` / `loading worklogs`) + explanation note of up to 13 words | `Items too early`, `SP too early`, `Time loading` (state word per metric). No note: the card sub-line already carries the reason | 3 rows |
| 3 | **Remaining** | `:443-461`, note `:121-122` | 3 rows (**the same three values the card shows**) + a 19-word note = **4–5 lines / ~25 words** | One line, no rows: `Open items · Time = estimate − logged` | 1 note |
| 4 | **Risks** (card) | `:379-405` | None (risk popovers, see #12) | None | n/a |
| 5 | **Status bar** | `EpicProgressSection.tsx:86-102` | One row per non-empty status (typically 4–8) with value + %. The value duplicates the legend `In Review · 3` (`:402-409`) | Same rows with `value = %` only (no sub). The legend already carries the count | N rows (status-bound) |
| 6 | **Assignee row** | `:104-124` | Title + 3 band rows (the same numbers as the chips) + (Time) `Logged` + `Estimate` = **4–6 lines** | Title `{name}`, then `Completed · 25%`, `In progress · 17%`, `To do · 58%` (share added: the chips show the values). Time: + `Logged 12h`. Drop `Estimate` (= band total) | Title + ≤4 rows |
| 7 | **CFD chart, history day** | `EpicChartTooltip.tsx:66-98, 145-170` | Title `Oct 2, 2026` + 4 rows; on today's datum also `Forecast` (= Remaining, because `withProjection` sets `forecast = remaining` at today, `epic-progress.ts:1168-1176`) = **5–6 lines** | Title `Oct 2` (year only when ≠ current). `Completed`, `In progress`, `To do`, `Remaining`. Skip the Forecast row when `!isFuture` | Title + 4 rows |
| 7b | **CFD chart, future day** | `:171-210` | Title + Forecast + Range + From today (+ `non-working day` sub) + 0–3 key-date rows (repeating `From today`'s working-day count) + Confidence + note `pessimistic after Oct X` = **4–8 lines / ~20–30 words** | Title `Oct 14` or `Oct 14 · Likely finish` (the key-date label merged into the title). `Forecast 3`, `Range 1–6`, `From today 8 working days` (value `non-working day` on such days). Drop the Confidence row (the legend shows it) and the key-date rows. Note only when clipped: `Latest falls after Dec 31` | Title + 3 rows + ≤1 note |
| 8 | **Time chart** (history / future) | `EpicChartTooltip.tsx:101-126`, `EpicTimeBurnup.tsx:184-198` | Title + Estimate/Logged/Remaining (+ Forecast at today); future = as 7b | Same contract as 7/7b with 3 history rows | Title + ≤3 rows + ≤1 note |
| 9 | **Forecast legend** (not a tooltip) | `EpicCfdChart.tsx:93-117` | `Forecast ▂▄▆ Medium`; `Forecast: Too early to tell`; `Forecast: Oct 14 · nothing left in this view` (8 words) | `Forecast ▂▄▆ Medium`; `Forecast: Too early`; `Forecast: Oct 14` (drop `· nothing left in this view`) | 1 item |
| 10 | **Source flag** | `EpicCfdChart.tsx:120-136`, text `epic-progress.ts:1768-1773` | 1 line, 3–5 words. Count/SP only: Time passes `sourceFlag={null}` (`EpicProgressSection.tsx:355`) | Keep. Becomes the **only** provenance surface. Wire the Time tab: `Approximate: worklogs loading` / `Worklogs unavailable` | 1 line ≤ 5 words |
| 11 | **Story mini bar** (Stories list) | `IssueDetailContent.tsx:389-421` | Title `No estimate` (when none) + up to 4 rows + the 15-word ESTIMATE_FORMULA_NOTE on **every** story = **up to 6–7 lines / ~25 words** | `Estimate 4h`, `Logged 5h`, then `Remaining 0m` **or** `Over by 1h` (they are mutually exclusive: overrun means remaining = 0). No-estimate case: `Logged 2h` + note `No estimate`. Drop the formula note | ≤3 rows |
| 12 | **Risk popover** (the "quick-peek" of affected issues; there's no other quick-peek tooltip in scope. The PeekPanel is the host for A.2 #5) | `EpicProgressSummary.tsx:323-374` | Header `Unestimated · 3` (a different word order from the trigger `3 unestimated`) + detail sentence + up to N rows (max-h-48). The overdue popover lists **every open story** | See §C.2 | Header + 1 line + rows (unestimated / unassigned only) |
| 13 | **Metric toggle / zoom presets** | `EpicProgressSection.tsx:308-323`, `EpicChartZoom.tsx:60-86` | No tooltip | None needed | n/a |

**Duplication to cut (summary):**
- `N working days` appears in Finish ×3 rows, chart future ×1–4 rows, and the confidence reason. Keep it once (the Likely row, or `From today` in charts).
- Confidence appears in the Finish tile, the Finish tooltip, the chart future tooltip and the forecast legend. Keep it in the tile sub, the Finish tooltip and the legend. Drop it from chart tooltips.
- Provenance appears in the hero DataSources block and the chart SourceFlag. Keep only the SourceFlag.
- The estimate formula appears in the hero (Time) and on every story-bar tooltip. Drop both, or move it to one place outside tooltips if the user wants it kept.
- `Estimate` equals the band total in Time-mode hero and assignee tooltips. Drop it.
- Remaining tooltip rows equal the card value + sub. Drop them.

**Lib string changes needed** (`epic-progress.ts`; each must be 8 words or fewer if surfaced):
- `:521` `Remaining work is unestimated, so no rate-based date can be projected.` → `Remaining work is unestimated`
- `:598` `Needs a little more completed work to project a date.` → `Needs more completed work`
- `:616` `Nothing has been completed yet, so there is no pace to project from.` → `Nothing completed yet`
- `:1334` `No metric has enough data to project a date.` → `Not enough data yet`
- `:1363-1364` `Average of … forecasts. They disagree widely, so confidence is lowered.` → no longer rendered (replaced by the `Based on` row). Keep it for tests or delete it.
- `:652` `Based on the last W working days (recent days weigh more): …` (16 words) isn't rendered anywhere today. Shorten or delete it to avoid future leakage.
- `:1371`/`:1373` FINISH_STATE_TEXT → `Too early`, `No end date`. Add `FINISH_STATE_SUB` with the 4-word sub-lines from A.3.
- `:1785-1787`, `:1791-1793`, `:1811-1812`, `:1826-1827` → dataSourceLines is no longer rendered in the hero. Keep only the strings the SourceFlag uses.

---

## C. Risks

### C.1 Current structure (`EpicProgressSummary.tsx:274-405`, lib `:1448-1565`)

- The card is a label plus a vertical list of 1–5 full-width `text-xs` buttons, each `icon + text` (`Overdue 4 days`, `Late by 6 days`, `Stalled`, `Scope growing`, `3 unestimated`, `2 unassigned`).
- Each button opens a `w-80` popover: header `{label} · {count}`, a detail sentence, and for overdue / unestimated / unassigned a scrollable key + summary list.
- Clutter sources:
  1. The variable list height pushes the whole strip's row height.
  2. `Stalled` and `Scope growing` repeat the Finish card's state.
  3. `unestimated` depends on the active tab (`:1531-1547`), so the list changes on a tab switch.
  4. The overdue list repeats the Stories list directly below (all open items).
  5. The header word order differs from the trigger.
  6. Scope detail units differ by source: `items/wk` (`:1525`) vs the metric unit from the forecast explanation (`:624`, `:1508`).
  7. `Late by N days` / `Overdue N days` use calendar days, while every forecast count uses working days. Units aren't labelled.

### C.2 Decluttered proposal

**Card (fixed 72px, A.3):**
- Value: `No risks` / `1 risk` / `{n} risks`.
- Sub row: one non-wrapping line of chips, warnings first, **max 4**. Each chip is a `<button>` (h-4, `gap-1`, `px-0`, no indentation relative to the label) containing a `size-3` icon + a token of 4 chars or fewer. Its `aria-label` is the full text.

| Risk | Icon (unchanged) | Chip token | aria-label / popover header (= trigger text) | Popover detail (≤ 8 words) | Issue list |
|------|------------------|------------|-----------------------------------------------|---------------------------|------------|
| overdue (warning) | CalendarX, amber | `4d` | `Overdue 4 days` | `Was due Sep 28 · 7 items open` | **None** (the Stories list is right below) |
| late (warning) | CalendarX, amber | `+6d` | `Finishes 6 days after due date` | `Due Oct 30 · forecast Nov 5` | None |
| stalled (warning) | CirclePause, amber | (icon only) | `Stalled` | `No progress in 12 working days` | None. **Only shown when Finish is ok** (a single metric stalled); when `finish.state === 'stalled'` the Finish card already says so |
| scope (warning / info) | TrendingUp | (icon only) | `Scope growing` | `+3 items/wk added vs 2/wk done` (always Count units) | None. **Omitted when `finish.state === 'not-converging'`** (the Finish card shows `No end date` / `Scope grows faster than done`) |
| unestimated (info) | CircleDashed | `3` | `3 unestimated` | `Open items missing points or time estimate` | Yes. Rows `KEY summary` + right-aligned muted tag `no SP` / `no time` / `none`. **Tab-independent** (union of both checks) |
| unassigned (info) | UserX | `2` | `2 unassigned` | `Open items with no assignee` | Yes |

With these rules the maximum is 4 chips (overdue|late, stalled|scope, unestimated, unassigned), which is ≤ ~150px. The chip row never wraps.

**Popover:** keep the existing keyboard model (Enter opens, arrows/Home/End move, Escape closes, initial focus on the first row) and the WR-01 plain-text fallback. Changes:
- The header text equals the aria-label.
- Use `w-72`.
- Row key: `font-mono text-xs` (matches the Stories list, `IssueDetailContent.tsx:345`), replacing `text-[11px]`.
- Keep `max-h-48`.

Keep the EpicDetailSheet.test rules: no keys or summaries in the DOM until a popover opens, and no exact `Done` / `In Progress` / `Stories` nodes. The chip tokens are numbers, so they're safe.

---

## D. Other polish

- **Spacing rhythm** (use a 4px scale: 4 / 8 / 16 / 20 / 24):
  - `SECTION_CLASS` already has `space-y-5` (`EpicProgressSection.tsx:79`), and the inner wrapper repeats it (`:325`). Keep one.
  - Chart → status block `mt-3.5` (`:371`) and status → assignees `mt-4.5` (`:412`) → both `mt-4`.
  - Hero: `gap-1.5` plus caption `mt-1.5` (`EpicProgressSummary.tsx:191,197`) gives 6px above the bar and 12px below. This goes away with the StatCard anatomy (uniform `gap-1`).
  - Risk trigger `px-1` (`:318`) indents rows 4px from the label. Removed with the chips.
- **Chart alignment across tabs:** YAxis `width={32}` (CFD, `EpicCfdChart.tsx:182`) vs `width={40}` (Time, `EpicTimeBurnup.tsx:181`) shifts the plot's left edge by 8px on a tab switch. This contradicts the "switching tabs never shifts the axis" comment (`EpicProgressSection.tsx:253`). Use one width (40) for both.
- **Typography:** sizes in scope are 3xl ×1, lg ×2, sm ×7, xs ×14 and arbitrary `[11px]` ×3 (`EpicProgressSummary.tsx:357,364`, `EpicBands.tsx:68`). Weights: medium, semibold, plus mono. Target: 3xl (hero value), lg (tile values), xs (everything else in the strip/legends/tooltips), sm (empty-state sentences only). Replace popover keys with `text-xs`. Keep chips at one named size: define `text-[11px]` once as a constant if it's kept.
- **Colour:**
  - Metric toggle and zoom presets both use `bg-primary` selected states (`EpicProgressSection.tsx:317`, `EpicChartZoom.tsx:78`), giving two accent-filled groups in one section. Make the zoom preset selected state `bg-accent font-medium text-foreground` so the metric tab stays the single accent.
  - Story overrun bar `bg-red-500` (`IssueDetailContent.tsx:378`) is a hardcoded non-token colour. Use `bg-destructive`.
  - Amber warning icons are acceptable (semantic, not status).
- **Loading:**
  - Skeleton geometry should match the real layout: four 72px cards, chart height `PLOT_HEIGHT` (232) unless zoomable. Currently `h-[252px]` (`:144`) jumps 20px for short domains.
  - Header toggle skeleton `h-6 w-32` vs the real ~20px-tall toggles.
  - The Finish card changes when worklogs arrive (the Time part joins the average) and nothing marks it. Acceptable, but don't show `loading worklogs` text anywhere visible (per B #2b).
- **Empty states:**
  - `No story points estimated — switch to Count` / `No time estimated — switch to Count` (`:337-344`) removes the chart, status and assignee blocks (~400px collapse on a tab switch), and "Count" isn't clickable. Render it as a `min-h-[232px]` block and make `Count` a link-style button calling `setMetric('count')`.
  - `No timeline data` (`EpicCfdChart.tsx:163`, `EpicTimeBurnup.tsx:154`) and `No worklog data` (`EpicTimeBurnup.tsx:104`) are fine.
- **Focus styles:** Hero and Tile triggers have no `focus-visible` ring, while risk items and assignee rows use `ring-1 ring-ring`. Add the same ring to StatCard.
- **Vocabulary:**
  - Always-visible text must say `Completed` (text-collision rule). Make the hero/assignee tooltip rows (`CAT_LABEL.done`, `epic-progress.ts:307-311`) match the legend's `Completed`, so one word is used everywhere.
  - Use `Finish` (date) and `Forecast` (chart line) consistently. Drop `Projected finish`.
  - Never `pessimistic` / `optimistic` in UI text (`EpicChartTooltip.tsx:156`).
  - Use `Items` / `SP` / `Time` consistently (the Finish `Based on` row and the Remaining sub). Avoid `Story points` in one place and `SP` in another.
- **Semantics note (P3, for the user to decide):** the Time-tab hero % weights done stories by *estimate*, while the Time chart plots *logged*. `time.pctLogged` exists but isn't shown. Don't add it to the card. Just be aware that the 45% doesn't equal logged/estimate.

---

## Pillar detail

### 1. Copywriting (2/4)
- WARNING: `REMAINING_NOTE` is 19 words (`EpicProgressSummary.tsx:121-122`), and `ESTIMATE_FORMULA_NOTE` is 15 words, shown on every story bar (`IssueDetailContent.tsx:392`) and in the hero (`epic-progress.ts:1811`).
- WARNING: explanations of 10–16 words (`epic-progress.ts:521,598,616,652,1334,1363`).
- WARNING: jargon leak `pessimistic after …` (`EpicChartTooltip.tsx:156`) where the UI word is `Latest`.
- WARNING: one concept, several names: `Finish` / `Projected finish` / `Forecast`; `Items` / `Count`; `Story points` / `SP`; `Done` / `Completed`.
- WARNING: the risk header `Unestimated · 3` vs the trigger `3 unestimated` (`:331`).
- `Forecast: Oct 14 · nothing left in this view` (`EpicCfdChart.tsx:111`) is 8 words for an edge case.

### 2. Visuals (2/4)
- BLOCKER: the hero bar width follows the caption length per tab (A.2 #1).
- WARNING: the hero has no label, so value rows don't line up (A.2 #6). The hero is 1.4fr vs tiles 1fr (A.2 #3).
- WARNING: the Risks card has no value row and swaps type scales by state (A.2 #11).
- Kept: the divider section, hero + strip, neutral glyph markers. All are good and should stay.

### 3. Color (3/4)
- WARNING: two `bg-primary` toggle groups (`EpicProgressSection.tsx:317`, `EpicChartZoom.tsx:78`).
- WARNING: hardcoded `bg-red-500` (`IssueDetailContent.tsx:378`).
- Pass: status colours appear only in the bands, status bar, chips, CFD areas, and Logged/Remaining/Estimate (documented mapping in `epic-markers.tsx:1-7`). The confidence meter, forecast and band are neutral. No hex colours in the scope TSX.

### 4. Typography (3/4)
- WARNING: `text-[11px]` ×3 is off-scale (`EpicProgressSummary.tsx:357,364`, `EpicBands.tsx:68`).
- WARNING: the Risks card uses `text-lg` when clean and `text-xs` in the list (`:390` vs `:318`).
- WARNING: `312h 30m` in a `text-lg` value; minute precision at that magnitude is noise (A.4).
- Weights: medium + semibold only. Fine.

### 5. Spacing (2/4)
- WARNING: `mt-3.5`, `mt-4.5` (`EpicProgressSection.tsx:371,412`), and the duplicated `space-y-5` (`:79`, `:325`).
- WARNING: the hero's 6px vs 12px internal gaps (`EpicProgressSummary.tsx:191,197`), and the 4px risk indent (`:318`).
- WARNING: skeleton heights `h-16` / `h-12` / `h-[252px]` don't match the real geometry (`EpicProgressSection.tsx:139,141,144`).
- WARNING: the YAxis 32px vs 40px shift between tabs.

### 6. Experience Design (2/4)
- BLOCKER: viewport breakpoints inside the 480px PeekPanel (`EpicProgressSummary.tsx:434`; PeekPanel renders `IssueDetailView` → `IssueDetailContent` → this section).
- WARNING: tab-dependent risks (`epic-progress.ts:1531-1547`) and the Stalled/Scope duplication with Finish (`:1487-1527`).
- WARNING: the SP/Time empty state collapses the layout, and its "switch to Count" isn't actionable (`EpicProgressSection.tsx:337-344`).
- WARNING: the Time tab never shows a SourceFlag (`EpicProgressSection.tsx:355`).
- Pass: loading skeletons, the worklog error with Retry (`EpicTimeBurnup.tsx:78-95`), the risk popover keyboard model, and the WR-01 plain-text fallback.

---

## Prioritized Fix List

### P1: fix before anything else (user-visible inconsistency)

1. **StatCard shell + container grid.** In `EpicProgressSummary.tsx:85-119` (Tile), `:186-204` (Hero) and `:434-436` (grid), add `StatCard` (grid rows `1rem/2rem/1rem`, `gap-1`, `w-full`, `self-start`, 72px). Wrap the strip in `@container/epic`. Use `grid-cols-2 @2xl/epic:grid-cols-4` with equal columns. Remove `sm:col-span-3 lg:col-span-1`. Mirror this in the skeleton at `EpicProgressSection.tsx:138-142`. Add a test: every `epic-stat-tile` / `epic-hero` has the same class contract, and the hero trigger has `w-full`.
2. **Hero content.** At `EpicProgressSummary.tsx:164-165,193-200`: label `Completed`, value `45%` + inline caption `3 of 12` / `11.5 of 30 SP` / `120h of 232h`, and the bar in the sub slot. Delete the `· N in progress` clause.
3. **Finish always 3 lines.** At `EpicProgressSummary.tsx:207-222` and `epic-progress.ts:1369-1374`: short `FINISH_STATE_TEXT` (`Too early`, `No end date`) and a new `FINISH_STATE_SUB`. Add a range formatter with year handling (A.4).
4. **Risks card redesign.** In `EpicProgressSummary.tsx:274-405`: a count value plus a chip row (C.2). In `epic-progress.ts:1448-1565`: tab-independent unestimated (with a per-issue `missing: 'sp' | 'time' | 'both'`), suppress stalled/scope when Finish already shows that state, drop the overdue `issues`, and make all `text`/`detail` strings match C.2 (header = trigger text). Remove the `metric` arg if it's no longer needed.
5. **Tooltip budgets (Hero / Finish / Remaining).** In `EpicProgressSummary.tsx:128-149,166-184` (delete DataSources), `:230-268` (4 rows + reason note; non-ok = per-metric state rows) and `:121-122,443-461` (one-line note). Shorten the lib explanation strings (`epic-progress.ts:521,598,616,1334`).

### P2: tighten

6. **Chart tooltips.** At `EpicChartTooltip.tsx:145-210`: title without the current year, merge the key-date label into the title, drop the Confidence and key-date rows, skip Forecast when `!isFuture`, and change the clipped note to `Latest falls after {date}`.
7. **Assignee and hero Time duplicates.** Drop the `Estimate` rows (`EpicProgressSection.tsx:108-121`, `EpicProgressSummary.tsx:169-182`) and add `%` to the assignee band rows.
8. **Story mini-bar tooltip.** At `IssueDetailContent.tsx:389-421`: drop the `ESTIMATE_FORMULA_NOTE` note, make Remaining and Over mutually exclusive, and change `bg-red-500` (`:378`) to `bg-destructive`.
9. **Compact durations.** Add `formatDurationCompact`. Use it in the hero caption, the Remaining card and `BandChips` (`EpicBands.tsx:57-79`; fixed chip width `w-9`/`w-12` instead of `min-w-[…]`).
10. **YAxis parity.** `EpicCfdChart.tsx:182` and `EpicTimeBurnup.tsx:181` should share one width constant in `EpicChartZoom.tsx`.
11. **Data sources → SourceFlag only.** Wire the Time tab's SourceFlag from `worklogSource` (`EpicProgressSection.tsx:355`). Trim `dataSourceLines` (`epic-progress.ts:1797-1831`), or keep it test-only and delete it if unused.

### P3: polish

12. **Spacing rhythm.** `mt-3.5`/`mt-4.5` → `mt-4` (`EpicProgressSection.tsx:371,412`). Remove the duplicate `space-y-5` (`:325`).
13. **Skeleton.** Chart `h-[232px]` unless zoomable, toggle skeleton `h-5`, and cards at 72px (`EpicProgressSection.tsx:131-152`).
14. **Typography.** Popover keys `text-xs` (`EpicProgressSummary.tsx:357,364`). Name the chip size once.
15. **Zoom preset selected state** → `bg-accent font-medium` (`EpicChartZoom.tsx:78`), leaving one accent group.
16. **Empty SP/Time state.** Reserve `min-h-[232px]` and make `Count` a button (`EpicProgressSection.tsx:337-344`).
17. **Focus ring on StatCard** (`focus-visible:ring-1 ring-ring`) to match risk and assignee rows.
18. **Vocabulary.** `CAT_LABEL.done` → `Completed` in tooltips (`epic-progress.ts:307-311`; check chip aria-labels/tests). `Items · SP · Time` everywhere. Legend `Forecast: Oct 14` (`EpicCfdChart.tsx:111`).

**Constraints for the planner** (from 0et):
- Respect the EpicDetailSheet.test text-collision rule. Never add visible exact `Done` / `In Progress` / `Stories`.
- No negative margins inside spaced containers. One row = one line.
- Update only the tests whose behaviour intentionally changes, and list them.
- Pre-commit runs biome + tsc + the full vitest suite, so combine RED/GREEN in one commit.
- Inspect the rendered DOM (WebKit) for A.2 #1/#2 before and after.

---

## Files Audited

- taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
- taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
- taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx
- taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx
- taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
- taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
- taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
- taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
- taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
- taskflow/src/components/ui/tooltip.tsx
- taskflow/src/components/ui/tooltip-body.tsx
- taskflow/src/lib/epic-progress.ts (strings, deriveSummary, deriveRisks, averageForecasts, confidenceReason, dataSourceLines, withProjection)
- taskflow/src/routes/dashboard/IssueDetailContent.tsx (Stories list mini-bar tooltip, section host)
- taskflow/src/components/app/PeekPanel.tsx, taskflow/src/routes/dashboard/IssueDetailView.tsx (host widths/padding)
- taskflow/src/services/jira/duration.ts (formatDuration)
- .planning/quick/261002-0et-…/261002-0et-CONTEXT.md, 261002-0et-SUMMARY.md

Registry audit: skipped (no UI-SPEC registry table; the scope uses only local shadcn/base-ui primitives).
