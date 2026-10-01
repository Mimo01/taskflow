# Quick Task 261002-0xf: Epic progress polish — zoom navigator, consistent cards, concise tooltips, decluttered risks - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Task Boundary

Ninth iteration on the epic detail progress section. User: "the sliders still do not work great, optimize it more. Look at different
variants of it and make sure it works on many different date ranges. Make sure to have the top 4 'cards' consistent across tabs.
Different things have different widths. The tooltips are way too long and there is way too much text. Risks are better but are too
cluttered. Overall polish this part way way more." Keep the established visual language (earlier: "I really like it, keep this style").

Inputs (MUST read):
- `261002-0xf-RESEARCH-ZOOM.md` — diagnosis of the Brush problems, Variant B design, test matrix of 8 range classes.
- `261002-0xf-UI-REVIEW.md` — card contract (A.3), tooltip inventory + budgets + exact strings (B), risks before/after (C),
  prioritized fixes P1/P2/P3 with file:line, minor recommendations (D).

</domain>

<decisions>
## Implementation Decisions

### Zoom (user choice: Variant B — date navigator)
- Replace recharts Brush entirely with a two-thumb DATE navigator under the plot: base-ui Slider (two thumbs, unit = whole days,
  linear in time), small overview sparkline behind it (Remaining + forecast, neutral), dragging the selection pans, min span 7 days.
  Label row: domain start · "Aug 14 – Nov 27 (105 d)" · domain end. Presets in the legend row.
- Data model per research: derive history DAILY, thin only the visible window to ≤ ~260 points (zoom in → daily detail).
- Calendar-aligned ticks by visible span (days / Mondays / month starts / quarters), year shown when it changes or spans years.
- During drag the range is local to the chart (no section-wide recompute per tick); shared zoom state updates on release (and on
  keyboard thumb moves). No remounting of the navigator when async data (forecast, history, worklogs) arrives.
- Accessible thumbs: aria-valuetext with dates, keyboard arrows (1 day), PageUp/PageDown (1 week), Home/End.
- Show zoom only when the shared domain spans > 28 days (user choice; change ZOOM_MIN_DAYS 42 → 28) and >1 meaningful preset.
  Presets adapt to domain length per research (thresholds ~90 / ~240 days; tune constants, tested).
- Zoom resets to All when switching epics (user choice); kept across Count/SP/Time tabs within the same epic.
- Implement and test the research's range matrix (2–6 weeks, 2–4 months, 6–18 months, forecast-heavy, etc.) in lib tests.

### Top 4 cards consistent (UI-REVIEW A.3, P1)
- One shared card component: three fixed rows (label / value / one sub-line), fixed height (~72px), `w-full`, content truncates, never wraps.
- Equal-column grid that switches 2×2 ↔ 4-across on its OWN width (container query), not viewport breakpoints; hero no longer 1.4×.
- Identical structure in Count / SP / Time and in every state (ok / too-early / stalled / no risks / many risks / loading).
- Skeletons match final card + chart heights exactly (no layout jump).

### Tooltips concise (UI-REVIEW B)
- Hard budget: ≤ 4 rows + ≤ 1 note of ≤ 8 words; no row repeating what the card/element already shows; no duplicated
  formula/data-source paragraphs. Use the exact rows/strings proposed in UI-REVIEW §B for all 13 tooltips/popovers (planner may tighten further).
- Data sources: keep in the hero tooltip but compress to ≤ 2 short rows (only show non-default/approximate sources).
- Consistent vocabulary across the section (pick one: "Finish", "Count", "Earliest/Latest" — no "pessimistic", "Projected finish", "Items").

### Risks decluttered (UI-REVIEW C)
- Card: value = "N risks" (or "No risks" ✓), sub-line = ≤ 4 small icon chips (no long text). Detail via the existing click popover.
- Risks are tab-independent: "Unestimated" counts open items with neither story points nor a time estimate (same in all tabs).
- Drop risks that duplicate the Finish card ("Stalled", "Scope growing"/not converging) — Finish already communicates them.
- Overdue/late: explanation only, no issue list (the Stories list below already shows open items) — supersedes 261002-0et WR-01.
- Popover: title + one ≤ 10-word explanation + issue rows (key · summary) for issue-based risks; keep keyboard behaviour from 261002-0et.

### Other polish (UI-REVIEW P1/P2 + D, planner selects all P1/P2, P3 where cheap)
- Identical Y-axis width in both charts (no 8px left-edge jump).
- Empty-estimate state: keep chart/bars layout with a calm inline message instead of collapsing ~400px; make "switch to Count" an actual button.
- Time tab shows the approximate-data source flag when relevant (no hard-coded null).
- Visible legend keeps "Completed" (EpicDetailSheet.test rule: no standalone "Done" / "In Progress" / "Stories" text nodes).

### Constraints carried over
- Update only intentionally changed existing tests; list them all (expect many — tooltip text, risks, zoom/Brush tests).
- No negative margins inside spaced containers. One row = one line.
- Pre-commit hook does NOT run biome effectively (memory: precommit-biome-checks-nothing) — run `npx biome check <touched files>` from
  taskflow/ manually before each commit; no new diagnostics. tsc incl tests (no `.at`) + full vitest gate commits; never --no-verify.
- zsh: use arrays for file loops.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261002-0xf-epic-progress-polish-zoom-slider-consist/261002-0xf-RESEARCH-ZOOM.md
- .planning/quick/261002-0xf-epic-progress-polish-zoom-slider-consist/261002-0xf-UI-REVIEW.md
- .planning/quick/261002-0et-epic-progress-simpler-confidence-conditi/ (previous iteration)

</canonical_refs>
