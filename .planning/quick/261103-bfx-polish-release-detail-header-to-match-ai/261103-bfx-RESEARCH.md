# Quick 261103-bfx: Release detail header polish - Research

**Researched:** 2026-11-03
**Domain:** In-repo UI refactor (React 19 + Tailwind v4 container queries). No new packages.
**Confidence:** HIGH. Every finding comes from reading the code in this session (`[VERIFIED: codebase]`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **MR labels + warning:** move them out of the MR donut slot into their own full-width strip directly under the graph section (above the deployment-package section and the task table). The orange "N MRs without label" warning chip comes first, then every label pill, with no "+N more" cap. Both keep their filter-toggle behaviour (UNLABELED_FILTER, aria-pressed). The donut slot then shows only the ring (no legend) and must look balanced in the band and in the 2x2/narrow layouts. The strip renders nothing when there are no labels and no unlabelled MRs, and under the same conditions that hide it today.
- **Done bar:** keep the full-width done bar (no KPI tiles). Restyle spacing, borders and section wrapping so header + done bar + graphs read as one coherent block, like AIO's header plus its bordered stats block (`border-b py-4`).
- **Meta line:** keep two lines (MetaLine for date/package, PropertyStrip for milestone/branch/merged-back/SP). Only align spacing, type sizes and visual treatment with CycleHeader.
- **Description:** stays below the meta line in the same position; tighten the spacing.
- **Responsive (LOCKED):** check the header, done bar, graph section and label strip at four widths: band (>= BAND_MIN_WIDTH), 2x2, `@max-[640px]/page` and `@max-[440px]/page`. Use the `@container/page` queries, not viewport breakpoints. Actions go icon-only and never push the title off. Meta lines and the label strip wrap. No horizontal page scroll. Keep things compact and side by side.

### Claude's Discretion
- Exact spacing and border values, title-row details (an optional mono key), aligning button styles with AIO.
- How the strip looks at narrow widths (pills wrap; the page never scrolls horizontally).

### Deferred / out of scope
- Task table, deployment-package section, graph internals.
</user_constraints>

## Project Constraints (CLAUDE.md / memory)
- The app lives in `taskflow/taskflow/` (src, npm, vitest, biome). `.planning` and git live at the outer root.
- The pre-commit hook runs the full vitest suite plus biome. Put RED and GREEN in one commit. Gate on "no NEW biome files flagged" and never on an absolute count. Don't run `biome --write` on all of src.
- Page header consistency rule, and "follow shipped pages": AIO cycle detail is the reference.

## 1. Header diff: AIO CycleHeader vs ReleaseDetailHeader

| Element | AIO (`aio-cycle/CycleHeader.tsx`) | Release (`release-detail/ReleaseHeader.tsx`) | Action |
|---|---|---|---|
| Container | `flex flex-none flex-col gap-1 px-6 pt-3 pb-2` | `... gap-1 px-6 pt-3 pb-3` (L160) | Change to `pb-2`. Add a bottom border only if the stats block doesn't carry one (see section 2). |
| Title row | `flex items-center justify-between gap-3` (no wrap) | `flex flex-wrap items-center gap-x-3 gap-y-1` (L162) | **Drop `flex-wrap`** and use `justify-between gap-3`. The actions are already icon-only below 640, and the title truncates (`min-w-0 truncate`), so wrapping is no longer needed. Wrapping is what lets the actions drop under the title. |
| Title group | `flex min-w-0 items-center gap-3` | `flex min-w-0 items-center gap-2` (L163) | `gap-3` |
| h1 | `min-w-0 truncate text-lg font-semibold` | same (+ `title={name}`) | Keep. A test asserts `text-lg font-semibold`. |
| Mono key | `font-mono text-xs text-muted-foreground {cycleKey}` | none | **Skip.** ReleaseHeader.test L176 asserts "no v{id} line". A version id has no user meaning, so there's no natural analogue. |
| Pill wrapper | `flex flex-none` | same | Keep (the statusPill-needs-flex-parent rule). |
| Actions group | `flex flex-none items-center gap-2` | `ml-auto flex flex-none items-center gap-1.5` (L171) | `gap-2`. `ml-auto` becomes redundant with `justify-between`. Harmless, but you can drop it. |
| Refreshed text | `hidden text-xs text-muted-foreground sm:inline` + string "Refreshed: hh:mm:ss" | `hidden ... sm:inline @max-[640px]/page:hidden` + "Refreshed: {t}" | Same text format already. Replace the viewport `hidden sm:inline` with the container-only `@max-[640px]/page:hidden` (a plain `text-xs text-muted-foreground` span). Test L137 only checks the text. |
| Refresh button | `inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground`, `RefreshCw size-3` | identical | No change. |
| Pin button | outline sm `flex-none gap-1.5 text-xs`, `Pin` icon with `fill-current text-primary` when pinned, text "Pin"/"Unpin" | outline sm `gap-1.5 text-xs`, `PinOff`/`Pin` icon, LABEL text "Pin release"/"Unpin release" | Optional: use AIO's single `Pin` icon with `fill-current text-primary` when pinned. **Keep the text "Pin release"/"Unpin release"**, because test L146-157 asserts the accessible name and the text content. Add `flex-none` to every action Button. |
| Edit / Open in Jira | outline sm, LABEL `@max-[640px]/page:sr-only` | same | Keep. Test L168 asserts the sr-only class. |
| Meta line | `flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground`, `·` in `text-border` | `MetaLine` in ReleaseFacts.tsx L33: **already identical** | No change. |
| Meta item icons | `size-3.5 flex-none`, `gap-1` | same | No change. |
| Description | n/a | `ReleaseDescription`: `text-[13px] text-muted-foreground max-w-[78ch] line-clamp-2` | Keep the position. Tighten with `mt-0.5` at most. The container's `gap-1` already spaces it. |
| PropertyStrip | n/a | `className="mt-2"` (L214), items `pl-4 pr-4` with `before:` hairline separators, `py-0.5` | Reduce to `mt-1`. Its hairline separators differ from the `·` in MetaLine by design (ReleaseFacts.test covers them). Leave the strip internals alone. |

Skeleton (`release-detail/ReleaseDetailSkeleton.tsx` L25-36) mirrors the header (`pt-3 pb-3`) and the done bar (`border-t px-6 pt-4`). **Update it in lockstep** so the loading-to-loaded transition doesn't shift. Its graph grid also has stale gaps (`gap-x-8 gap-y-7`, vs the live `gap-x-4 gap-y-5`). Fix those while you're in there.

## 2. Stats block: header → done bar → graphs → label strip

Current vertical rhythm, verified in ReleaseDetailPage.tsx L415-535:
- header `pb-3` (no border)
- `ReleaseDoneBar`: `border-t px-6 pt-4` (ReleaseHeader.tsx L230)
- graph grid: `px-6 pt-5`, no bottom padding or border
- `DeploymentPackageSection`: its own `mt-6` orange `border-l-[3px]` panel (DeploymentPackageSection.tsx L188)
- task table wrapper `px-6 pt-6 pb-6`

AIO: header `pt-3 pb-2` (no border), then `CycleKpiTiles` at `border-b border-border py-4 pr-8 pl-6`, then the sticky tab bar.

**Recommendation:** wrap the done bar, the graph grid and the new label strip in a single block, `<section data-testid="release-stats" className="flex flex-col gap-5 border-y px-6 py-4">`:
- `border-t` keeps today's header/stats split. `border-b` closes the block the way AIO does, so the package panel and the table start below a clear edge.
- Move `px-6` off the children (done bar and grid) onto the section, and drop the children's own `pt-4`/`pt-5` (the section's `gap-5` and `py-4` replace them).
- `ReleaseDoneBar` keeps `data-testid="release-done-bar"` but loses `border-t px-6 pt-4`. **Update ReleaseHeader.test L185-193**, which asserts `toHaveClass('border-t','px-6','pt-4')`. Assert instead that it sits inside `release-stats`, and assert the border on the section.
- When `noIssues` is set, the done bar and graphs aren't rendered today. Don't render an empty bordered section in that case: put the whole section behind `noIssues ? null : ...`.
- The task table wrapper keeps `pt-6`. The DeploymentPackageSection keeps its `mt-6`. Both now sit below `border-b`.

## 3. MrLabels wiring and what becomes obsolete

Wiring today, verified in ReleaseDetailPage.tsx L104-105, 174-177 and 338-347:
- `labelSummary` and `labelCoverage` come from the GitLab hook.
- `labelFilter` is derived from `labelFilterState` scoped to `versionId`. `toggleLabelFilter(name)` toggles between the name and null.
- Both are passed to `ReleaseMrDonut` (props `labelCoverage`, `labelSummary`, `activeLabel`, `onToggleLabel`), which renders `<MrLabels>` next to the `AioDonut` in a `my-auto flex flex-wrap items-start justify-center gap-y-3 gap-x-3|6` row.
- `UNLABELED_FILTER = '__unlabeled__'` is exported from `graphs/MrLabels.tsx`. UnifiedTaskTable.tsx L29, L1253 and L1407 import it. **Keep the export where it is**, or re-export it if you move the file.
- Visibility today: the labels show only when `showDonut` (`hasMilestone && donutState !== 'empty'`) is true and GraphSlot renders children, which means `donutState === 'ready'`. Loading and error states hide them. **New strip gate:** `showDonut && donutState === 'ready'` (equivalent), and only inside the non-`noIssues` branch. MrLabels already returns null when there are no labels and `missing === 0`.

**Becomes obsolete when the strip is full width:**
- `MAX_LABEL_ROWS`, the `maxRows`/`rows` computation, the `grid grid-flow-col` grid with `gridTemplateRows: repeat(rows, auto)` and `gridAutoColumns: fit-content(9.5rem)` (MrLabels.tsx L70-75, 100-103, 143-150). Replace them with `flex flex-wrap items-center gap-1.5`.
- The `border-l pl-3` column hairline on the `mr-labels` root (L109).
- The full-width banner geometry (`w-full`, `rounded-r border-l-[3px]`). Context calls it a "chip first", so make it an inline chip at pill height: `inline-flex h-5 flex-none items-center gap-1 rounded px-1.5 bg-orange-500/10 text-orange-800 dark:bg-orange-400/10 dark:text-orange-200` with a TriangleAlert. Keep `aria-pressed` and the active ring classes. Note that **DeploymentPackageSection uses an orange `border-l-[3px]` panel right below**. A second orange left-accent bar directly above it would stack visually, which is another reason to make the warning a chip and not a banner.
- The `<hr data-testid="mr-labels-divider">` between banner and grid. In a single wrapping row, use a small vertical hairline (`h-4 border-l`, `aria-hidden`) between the warning chip and the first pill. Keep the testid so coverage survives, or drop it and update the tests deliberately.
- The `mr-labels-all` green check, shown when everything is labelled and there are no labels. It's effectively unreachable (with `allLabeled` and zero labels, the MRs would have labels). Keep it or drop it, but the strip must not render an empty bordered row just for it.
- `LabelPill` keeps `self-start justify-self-start` (grid leftovers, harmless in flex). The test at MrLabels.test L40 asserts `self-start`, so keep it or update that test.
- **Strip shape:** `<div data-testid="mr-labels" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 text-xs">`. Optionally lead with a muted `Tag` icon plus a "Labels" caption (`text-xs text-muted-foreground`) so the strip reads as a section. Inside the stats block, give it `border-t pt-3` (or rely on `gap-5`) so it sits under the graphs. Pills keep `max-w-full min-w-0` and the inner `truncate`, so one very long label can't cause horizontal scroll. Add a cap such as `max-w-[16rem]` on the name span, because the old `fit-content(9.5rem)` cap goes away.

**ReleaseMrDonut after the move:** drop the props `labelCoverage`, `labelSummary`, `activeLabel` and `onToggleLabel` and the `MrLabels` import (it's the only caller, at ReleaseDetailPage L339). The child becomes the `AioDonut` alone. Use `my-auto flex justify-center` and drop `flex-wrap` and the `compact` gap branch. `compact` still picks `COMPACT_DONUT_SIZE`, which equals `DONUT_GRAPH_SIZE` = 120. The skeleton (L52-61) still shows three legend-like bars beside the donut. **Remove those bars** so the skeleton matches the ring-only slot (no layout shift, no fake legend, per the release-detail design prefs memory).

Donut slot balance per layout:
- **Band (>= 1180):** the grid column is `auto` (`grid-cols-[minmax(220px,1.1fr)_auto_minmax(250px,1.1fr)_minmax(260px,1.1fr)]`). The MR column shrinks to about max(120px ring, the "Merge requests" heading) and the other three columns get the freed width. The ring is vertically centred by `my-auto` against the row height that the lists set. Good as is.
- **2x2 (< 1180, > 640):** right column `minmax(0,1fr)` beside the burnup. The ring is centred horizontally in the cell. Fine.
- **<= 640:** the burnup spans the row. Row 2 is MR ring | type waffle (the assignee list moves to `order-4`, full width). The ring is centred in its half.
- **<= 440:** one column. The ring is centred alone in a full-width row. Acceptable, and nothing overflows.
- The fallback when there's no donut (`ReleaseStatusRows` + "No merge requests in this milestone yet") is unchanged and has no labels.

## 4. Responsive breakpoints in play

| Breakpoint | Source | Header | Done bar | Graphs | Label strip |
|---|---|---|---|---|---|
| `pageWidth >= 1180` (JS `BAND_MIN_WIDTH`, ResizeObserver on `release-detail-scroll`; the skeleton uses `@min-[1180px]/page`) | ReleaseDetailPage L41, L287-300 | Full labels, Refreshed text visible | full width | 4-col band | one wrapping row |
| 2x2 (< 1180) | L516-533 | same | same | `[1.4fr_1fr]` | wraps |
| `@max-[640px]/page` | LABEL const, grid classes | buttons icon-only (`sr-only`), Refreshed hidden, title truncates (no wrap after the fix) | same | grid-cols-2, burnup and assignee full row | wraps; pills truncate |
| `@max-[440px]/page` | grid classes | same; the title gets whatever is left after about 4 icon buttons (~150px) | same | 1 col | wraps; consider hiding the optional "Labels" caption with `@max-[440px]/page:sr-only` |

- The `@container/page` container is the scroll wrapper `release-detail-scroll` (L412). The header, the stats block and the strip are all **descendants**, so the `/page` variants apply. The skeleton declares its own `@container/page` (Skeleton L23).
- `ReleaseBreadcrumbHeader` renders **outside** the container (L398, before the scroll div). It can't use `/page` variants. It already truncates; leave it alone.
- The meta line already uses `flex-wrap`. PropertyStrip wraps with `-ml-4` inside `overflow-hidden`, so it's safe.
- `px-6` with no right-side asymmetry. AIO's stats block uses `pr-8 pl-6`, but don't copy that: the release graphs have their own dividers.

## 5. Tests to update (don't delete coverage)

| File | Lines | Current assertion | Change |
|---|---|---|---|
| `src/routes/dashboard/ReleaseDetailPage.test.tsx` | L457-473 | `release-graph-mrs` **contains** `mr-labels` | Assert that `mr-labels` is **not** inside `release-graph-mrs`, that it sits inside the stats block / after `release-graph-grid`, and that it comes before the task table. Rename the test. |
| same | L475-486 | no `mr-labels` when By-status replaces the MR cell | Keep (the gate stays the same). |
| `src/routes/dashboard/release-detail/graphs/MrLabels.test.tsx` | L45-52, L115 | root `border-l` hairline | Assert a flex-wrap strip instead. |
| same | L64-80 | banner `border-l-[3px]`, `border-orange-500`, `w-full`, not inside `mr-labels-grid`, next sibling `mr-labels-divider` | Rewrite for the chip: it comes first in the strip, has orange tone, `aria-pressed`, and the divider follows it (if you keep the testid). |
| same | L109-129 | 5-row cap, `grid-flow-col`, `repeat(4/3, auto)` | **Delete or replace** with "all pills in one flex-wrap container, no `+N more`" (L101-107 already covers no-cap). |
| same | L131-136 | banner only: no grid, no divider | Keep, adapting the testid if `mr-labels-grid` goes away. |
| same | L139-154 | `ReleaseMrDonut labels column`: the MR cell contains the labels | Invert: ReleaseMrDonut renders **no** `mr-labels` (and the props are gone). |
| `src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx` | L28-33 | centre total, no legend | Keep. Optionally add "skeleton has no legend bars". |
| `src/routes/dashboard/release-detail/ReleaseHeader.test.tsx` | L79-87 | h1 `text-lg font-semibold`; header **not** `border-b` | Keep. If you add the border to the header instead of the section, flip this deliberately. |
| same | L185-193 | done bar `border-t px-6 pt-4` | Update to the new block structure. |
| same | L134-169 | Refreshed text, pin names, `@max-[640px]/page:sr-only` | Keep the strings, as described in section 1. |

## Common Pitfalls (from project memory)

1. **Container query not on self:** `@max-[640px]/page:*` must sit on descendants of the `@container/page` element and never on the scroll div itself. The new `release-stats` section and the strip are descendants, so they're fine. Don't add `/page` variants to `release-detail-scroll`'s own className.
2. **`not-sr-only` undoes truncate:** if you add a responsive "Labels" caption or reveal a button label with `@[N]:not-sr-only`, add `truncate` alongside it. The current LABEL pattern is `@max-[640px]/page:sr-only` (hide when narrow) and has no not-sr-only, so it's safe. Keep that direction.
3. **statusPill needs a flex parent:** `ReleaseStatusPill` must stay wrapped in `<div className="flex flex-none">` (it already is). Don't unwrap it during the title-row refactor.
4. **Italic truncate clip:** GraphSlot error text is italic with `pr-0.5`. If the strip shows any italic copy (for example an "All MRs labelled" note), add `pr-0.5` next to `truncate`.
5. **Hover affordance, no layout shift:** chip and pill hover states must only change colour or brightness (`hover:brightness-95`, `hover:bg-orange-500/15`). Never toggle the visibility of a width-taking element. The active state uses `ring-2`, which takes no layout space, so keep it that way.
6. **React Compiler module reads:** the app compiles with React Compiler but vitest doesn't. Pass `labelFilter`, `labelSummary` and `labelCoverage` as props from the page's hook state into the strip. Don't read them from a module-level variable or store snapshot inside the new strip component, or it will go stale only in the app.
7. **Narrow layout prefs / one row = one line:** the label strip is the one place where wrapping is intended (the locked decision). Header rows must not wrap: the title truncates and the actions stay on the same row.
8. **Verify scripted edits:** if you move classes with python or sed after a biome reformat, grep every site afterwards. Replacements fail silently.
9. **Two orange accents stacked:** the DeploymentPackageSection orange panel sits right below the stats block. Keep the unlabelled warning a compact chip so the two don't merge visually.

## Environment Availability
Skipped: code-only change, no new dependencies.

## Validation Architecture
- Framework: vitest (+ @testing-library/react), run from `taskflow/taskflow/`.
- Quick: `npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage.test.tsx`
- Full: `npx vitest run` (the pre-commit hook runs it), plus `npx biome check <touched files>` and `npx tsc --noEmit`.
- Manual or visual: render at about 1300, 1000, 600 and 400px container widths (the throwaway vite page plus cached Chromium approach from memory) to confirm: no horizontal scroll, the title is never pushed off, the strip wraps, and the donut is centred.

## Security Domain
Not applicable: a pure presentational refactor. No new inputs. The label names are already rendered as text.

## Sources
- `[VERIFIED: codebase]` ReleaseHeader.tsx, ReleaseDetailPage.tsx L41-44 and L250-600, ReleaseFacts.tsx (MetaLine L33, PropertyStrip L287), graphs/ReleaseMrDonut.tsx, graphs/MrLabels.tsx, graphs/GraphSlot.tsx, ReleaseDetailSkeleton.tsx, DeploymentPackageSection.tsx L186-188, components/release/ReleaseIssueGraph.tsx, AioCycleDetailPage.tsx, aio-cycle/CycleHeader.tsx, aio-cycle/CycleKpiTiles.tsx L75, and the four test files listed above.
- `.claude/skills/sketch-findings-taskflow/references/release-detail-page.md`: the sketch-era header and labels design, superseded by the code and this task's decisions.

**Valid until:** until the next edit to these files.
