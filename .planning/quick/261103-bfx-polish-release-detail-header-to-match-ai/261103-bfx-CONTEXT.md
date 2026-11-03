# Quick Task 261103-bfx: Polish release detail header to match AIO cycle detail; relocate MR labels and without-label warning - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Task Boundary

User request (verbatim): "I want to polish the header part of the release detail page. I really like AIO CYCLE detail, get inspired by that. On the release detail i want to better match the top part and i dont like the placement of mr labels including the without label warning"

Scope: the top part of the release detail page — `ReleaseBreadcrumbHeader`, `ReleaseDetailHeader`, `ReleaseDoneBar` (taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx), the header/graph section of `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`, and the MR labels (`graphs/MrLabels.tsx`, rendered inside `graphs/ReleaseMrDonut.tsx`). Reference design: AIO cycle detail (`taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`, `aio-cycle/CycleHeader.tsx`, `aio-cycle/CycleKpiTiles.tsx`). Task table, deployment-package section, graph internals are out of scope.

</domain>

<decisions>
## Implementation Decisions

### MR labels + "N MRs without label" warning
- Move them OUT of the MR donut slot into their OWN full-width strip directly under the graph section (above the deployment-package section / task table).
- Strip content: the orange "N MRs without label" warning chip first, then every label pill (all shown — no '+N more' cap, per prior decision 261102-ers).
- Both the warning and the pills keep their current filter-toggle behaviour (toggle the task table label filter, UNLABELED_FILTER for the warning; aria-pressed state).
- The donut slot then shows just the ring (no legend, per prior decisions); it must still look balanced in the band and in the 2x2/narrow layouts.
- The strip renders nothing when there are no labels and no unlabeled MRs (and when there is no milestone / donut not shown — same conditions as today).

### Stats block / done bar
- KEEP the full-width done bar (no KPI tiles). Restyle spacing/borders/section wrapping so that header + done bar + graphs read as one coherent block, like AIO's header + bordered stats block (CycleKpiTiles: `border-b py-4` block under the header).

### Meta line
- KEEP two lines (date/package MetaLine + PropertyStrip with milestone/branch/merged-back/SP). Only align spacing, type sizes and visual treatment with AIO's CycleHeader (e.g. text-xs muted, `·` separators, title row gap-3, pt-3 pb-2).

### Description
- Keep below the meta line, same position; tighten spacing.

### Responsive behaviour (user follow-up, LOCKED)
- "Also make sure to optimize on different screen sizes": the header, done bar, graph section and the new label strip must be explicitly designed and checked at wide (band layout, >= BAND_MIN_WIDTH), medium (2x2 grid), narrow (@max-[640px]/page) and very narrow (@max-[440px]/page) container widths. Use the existing `@container/page` container queries (not viewport breakpoints). Title row: actions collapse to icon-only (existing LABEL sr-only pattern) and never push the title off; meta lines wrap; label strip wraps; no horizontal page scroll; respect "narrow layout preferences" memory (keep things compact, side-by-side where possible).

### Claude's Discretion
- Exact spacing/border values, title-row details (AIO shows a mono key next to the title — optional if a natural analogue exists), button styling alignment with AIO (outline sm buttons, refresh icon + "Refreshed" text).
- How the strip looks at narrow widths (wrap pills; never horizontal scroll of the page).

</decisions>

<specifics>
## Specific Ideas

- User preference memories that apply: page header consistency (standard header bar), "design: follow shipped pages" (AIO cycle detail is the shipped analogue), dashboard UI prefs (colour = status only, no legends), "Show all MR labels" (no +N more), "MR donut layout" (previous placement decision 261102-rdn/tg3 is now superseded for label placement — ring stays 120px/no legend), "one row = one line", "narrow layout preferences".
- Existing tests cover MrLabels / ReleaseMrDonut / ReleaseHeader (data-testid `mr-labels`, `mr-labels-unlabeled`, `mr-labels-divider`, `release-detail-header`, `release-done-bar`) — update tests to match the new placement, don't delete coverage.

</specifics>

<canonical_refs>
## Canonical References

- Reference page: taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, aio-cycle/CycleHeader.tsx, aio-cycle/CycleKpiTiles.tsx
- Skill: .claude/skills/sketch-findings-taskflow (release detail validated design — code is source of truth where UAT departed)

</canonical_refs>
