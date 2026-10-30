---
phase: 94
slug: release-detail-redesign
status: draft
shadcn_initialized: true
preset: base-nova (neutral, lucide)
created: 2026-10-30
---

# Phase 94 — UI Design Contract

> Visual and interaction contract for the release detail page (`/release/:versionId`). Source of truth: sketch 003 variant B (round-2 app-style header) + sketch 004 (edge states) + sketch 005 (N2 Compact), packaged in `.claude/skills/sketch-findings-taskflow/references/release-detail-page.md` and `release-detail-states.md`. Where the sketch conflicts with 94-CONTEXT.md D-08 (fact chips) and D-11 (ReleasesHero 30px header), **the sketch wins** (user asked the header to "match the app style"). All other CONTEXT decisions (D-01..D-07, D-09, D-10, D-12..D-14) bind unchanged.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json` present, already initialized; no new init) |
| Preset | base-nova, baseColor neutral (existing) |
| Component library | base-ui (shadcn base-nova; Select needs Root `items`, portal autocomplete via Popover) |
| Icon library | lucide-react |
| Font | Geist (app default, `taskflow/src/index.css`); mono for branch names and issue keys |
| Charts | recharts via `components/ui/chart.tsx` (burnup); SVG donut following `aio-cycle/AioDonut.tsx` |

Reuse, do not re-specify: `Card` is NOT used on this page (no card panels on detail pages). `Tooltip` + `TooltipBody`/`TooltipRow`, `Button` (outline, `sm`), `Skeleton`, `CachedAvatar`, `ReleaseStatusPill`, `RELEASE_SEGMENT_CLASS` / `RELEASE_SEGMENT_ORDER` / `releaseTooltipRows` (`lib/release-list.ts`), `STATUS_PILL_LAYOUT_CLASS`, `CHIP_TONE_CLASS`/`tonePillClass`, `EpicChartTooltip`, `EpicTimeBurnup` pattern. Do not reference deleted `StatTile`/`ChartWrapper`.

---

## Layout Contract

Page structure (full width, no sidebar; D-07, D-13):

Focal-point hierarchy: title + status pill (largest type, first read) -> done bar (full-width, sole progress figure) -> burnup (largest graph, top-left of the quad). Everything else is supporting detail.

1. Fixed `ReleaseBreadcrumbHeader` (unchanged). Everything below scrolls as one page inside a scroll wrapper with `container-type: inline-size` (named `page`). Container queries are applied to children of this wrapper, never to the wrapper itself.
2. Header (CycleHeader style, `aio-cycle/CycleHeader.tsx`): `flex flex-none flex-col gap-1 px-6 pt-3 pb-2`, no `border-b`.
   - Title row: `h1 text-lg font-semibold truncate` (title = full name) + `ReleaseStatusPill` in a flex wrapper. Right side: "Refreshed: HH:MM:SS" (`text-xs text-muted-foreground hidden sm:inline`), icon-only refresh button (`RefreshCw size-3`, `aria-label="Refresh release"`), then outline `sm` buttons **Pin release · Edit release · Open in Jira** (`gap-1.5 text-xs`, `size-3.5` icons). Refresh stays upstream-first (quick 261029-qez).
   - Meta line: `flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground`, items separated by `<span aria-hidden class="text-border">·</span>`. Order: date (`CalendarDays size-3.5`; red when overdue; "No release date" amber when undated) · RM package (package icon + `WEEK45 RM-14`, hidden when no RM project configured, P93 D-12) · facts as `Name: value` (name `text-muted-foreground`, value `text-foreground`, both weight 400; distinguished by colour only): Milestone, Branch, Merged back, MR labels, Story points.
   - Timing comes from the pill text (In N days / Due today / Overdue / Released / No date); no separate countdown figure (D-12).
   - Description under meta: `text-[13px] text-muted-foreground max-w-[78ch]`, `line-clamp-2`, "more"/"less" toggle only when the text overflows. GitLab milestone description only when it differs, prefixed by small uppercase "MILESTONE" label.
3. Done bar: `border-t` then `px-6 pt-4` row: full-width segmented bar (`h-2`, `SegmentedBar`, `RELEASE_SEGMENT_CLASS`) + "**N** / M done" right-aligned (`text-xs`). Sole owner of the done figure. Tooltip rows (4 max): Done / In Progress / To Do / exact status names.
4. Graph grid: `grid grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-8 px-6 pt-6`.
   - Left "quad": `grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-8 gap-y-7`; order: Progress (burnup) | Merge requests (donut); By assignee | By type (waffle).
   - Right side column: `border-l pl-8`: Labels (`LabelSummarySection` chips, unchanged look) then Deployment package mismatches (`DeploymentPackageSection`, rows `border-t`, mono key, truncate summary, amber state chip, muted "why" line, `xs` outline fix button).
   - Section headings: `h3 text-sm font-semibold` + muted `size-3.5` lucide icon. Burnup heading has right-aligned muted aside "since {prev version name} · {d Mon}".
5. Unified task table, full width, anatomy unchanged (P89/P90/P91.1). Only its column header becomes sticky via the `--aio-sticky-top` pattern. Header and graphs scroll away; no extra sticky compact bar.

Removed: `ReleaseDetailSidebar` as a column, `useResizable`, `releaseDetailPanelWidth` setting and its migration handling.

### Responsive (N2 Compact; container queries on children of the `page` wrapper)

| Width | Behaviour |
|-------|-----------|
| <= 980px | Side column folds under the quad (`border-t pt-6`, no `border-l`); outer grid single column |
| <= 640px | Header: "Refreshed" hidden, action buttons icon-only (label in `title` + `aria-label`), title row may wrap. Quad 2 columns, burnup and assignee rows span both (assignee ordered after donut + type). Donut values wrap under ring. Burnup 160px tall |
| <= 440px | Quad single column |
| <= 860px | Task table assignee name drops to avatar (existing behaviour) |

Meta line chips wrap; state words never truncate. One row = one line at every density.

---

## Graph Specs

All graphs count **issues**. Story points appear only in tooltips and the Story points fact. Colour = status only. No legends (direct labels). Tooltips <= 4 rows. Segment colours: done = green (`--done`), in progress = blue (`--progress`), to do = `--todo` (all via `RELEASE_SEGMENT_CLASS`).

| Graph | Form | Spec |
|-------|------|------|
| Progress (burnup) | recharts line + area | Height 196px (160px at <=640px). Scope: dashed `muted-foreground` line. Done: green line over green 12% area. End labels "24 scope" / "15 done" (flip to left of last point at right edge). Markers: TODAY (solid, foreground) and RELEASE (dashed, muted) with `text-xs uppercase tracking-wide` labels (12px) above plot. Y-axis <= 4 integer ticks (step 5/10); X-axis: start, Mondays, end, `interval={0}`, UTC-safe ticks. Hover: guide line + tooltip rows: date, Scope, Done, Story points done. No forecast, no ideal line (D-04). Axis rules per D-03 / states table below |
| Merge requests | donut | ~104px, ring 0.36–0.48 of size (AioDonut pattern). Centre: total + "MRs" beneath. Values to the right: swatch, count, lowercase state. Colours: merged green, open blue, draft blue/40, closed muted. Requires adding a draft flag to `mrStateCounts`. Streams with MR channels |
| By assignee | avatar rows | Row `grid-cols-[22px_minmax(70px,1fr)_minmax(60px,1.2fr)_40px]`, `h-[30px]`: `CachedAvatar` 22px (explicit px sizing) · name (`text-xs truncate`) · slim `h-1.5` segmented bar · "5/6" right-aligned muted. Unassigned last: dashed empty avatar, muted name. Hover tint `hover:bg-muted/50`. Tooltip: Done / In Progress / To Do / Story points. Sorted by total desc |
| By type | waffle | One row per issue type: 110px label (muted type icon + name + muted "7/12") then one 12px square per issue (`gap-1` 4px, 16px pitch, `rounded-sm`), ordered done -> in progress -> to do. Tooltip: Done / In Progress / To Do / Story points. Must stay a different shape from assignee rows |

Data: add `created` and `resolutiondate` additively to `fetchFixVersionIssues` (JQL and order unchanged; no changelog). Done = `statusCategory = done` dated by `resolutiondate`; scope = `created` clamped to axis start. Axis start = previous fix version by date (released or not, from `jira-fix-versions` cache), fallback earliest `created`. Axis end = release date; today when undated or past-and-unreleased.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Header `gap-1`, icon gaps |
| sm | 8px | Meta item gaps (`gap-x-2`), compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Header/page horizontal padding (`px-6`), section top padding, narrow quad gap |
| xl | 32px | Grid gaps (`gap-8`, `gap-x-8`, side column `pl-8`) |
| 2xl / 3xl | 48px / 64px | Not used on this page (removed from active scale) |

Exceptions (sketch-locked, in px): header `pt-3` 12px; quad `gap-y-7` 28px; waffle squares 12px with 4px gaps; assignee row 30px with 22px avatar; burnup 196/160px; donut ~104px; side column min 260px; inline action buttons `h-6` 24px (existing `RowAction`); icon sizes `size-3`/`size-3.5`. Interactive touch targets rely on existing app button sizes (desktop Tauri app).

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (description, row names) | 13px (`text-[13px]`) | 400 | 1.5 |
| Label (meta line, tooltips, "N / M done", axis, buttons) | 12px (`text-xs`) | 400 | 1.5 |
| Heading (section h3) | 14px (`text-sm`) | 600 | 1.2 |
| Display (page title h1) | 18px (`text-lg`) | 600 | 1.2 (28px leading per sketch) |

Weights: exactly two, regular 400 and semibold 600. No `font-medium`; meta-line values and label chips are weight 400 (values differ from names by colour). Uppercase marker labels (TODAY/RELEASE, MILESTONE) are 12px (`text-xs uppercase tracking-wide`), weight 400. Sizes: exactly 12, 13, 14, 18. Italic text inside `truncate` needs `pr-0.5`.

---

## Color

Uses existing app tokens (neutral shadcn); no new palette.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` | Page surface (no card panels) |
| Secondary (30%) | `--muted` / `--border` | Skeletons, hairlines, hover tints, placeholder dashed boxes, muted text |
| Accent (10%) | status colours only: `--done` green, `--progress` blue, warn orange, bad red | See reserved list |
| Destructive | existing `--destructive` | No destructive actions in this phase (Pin/Edit/Create are non-destructive) |

Accent reserved for: segmented bar / waffle / assignee-bar status segments; burnup done line + area; MR donut slices (merged green, open blue, draft blue/40, closed muted); problem tone on meta facts (orange warn for fuzzy milestone, missing branch/milestone, "Likely not into main", "N/M missing" MR labels; red for overdue date/pill); green on healthy facts only where the old sidebar used it (branch exists, merged back, all labeled); amber for "No release date" and mismatch state chips. Not used for buttons, links, headings, or decoration. No orange elsewhere. Primary buttons are not used; all actions are outline.

---

## State Contract

Every slot keeps its final size; nothing renders a 0/0 chart; hidden facts hide with their separator (no "—").

| State | Contract |
|-------|----------|
| Loading | Name/pill/date/package from list cache on first paint. Done bar = skeleton track. Each graph slot = `Skeleton` at final size (burnup block, donut circle + 3 value lines, 5 assignee rows, waffle rows); issue-based graphs render when `jira-fixversion-issues` resolves; MR donut streams separately; table skeleton rows. Rebuild `ReleaseDetailSkeleton` to mirror header + meta + done bar + quad + side column + table |
| No issues | `Branch: Missing` + Create branch if applicable. Empty done track and "No issues". Burnup/assignee/type slots show dashed-border muted "No issues" at slot height. Table: "No issues in this fix version" |
| No GitLab | Milestone/Branch/Merged back/MR labels hidden; Story points stays; RM package stays if configured. Donut slot removed, burnup spans the quad row (`col-span-full`). Labels gone; if mismatches also empty, grid becomes single column |
| No MRs / fuzzy milestone | `Milestone:` dashed underline + orange, candidate in tooltip. `Branch: Couldn't check` + inline "Retry branch check". Donut slot keeps size with "No MRs in this milestone" |
| Released | Green Released pill; `Branch: Released · v33.4.0` (tag in tooltip); `Merged back: into main · 21 Oct` green; `MR labels: All 23 labeled` green. Burnup ends at release date, no TODAY marker, RELEASE marker at end |
| Undated | Amber "No date" pill; "No release date" warn; no package; `Milestone: Set a release date first`, `Branch: Create the milestone first` (no actions). Burnup starts at earliest `created`, ends today, TODAY at end, no RELEASE marker |
| Overdue | Red pill + red date; problem facts toned. Axis ends today; dashed RELEASE marker before TODAY |
| Burnup < 2 points | Slot keeps height with muted sentence below |

Fact states to keep reachable one-to-one with old sidebar testids (`ReleaseDetailSidebar.test.tsx` coverage moves to facts tests): milestone link / fuzzy / missing + Create milestone / set date first; branch exists / missing + Create branch / couldn't check + Retry branch check / create milestone first / released tag; merged back into main / likely not / couldn't verify (hidden when verdict hidden); MR labels all labeled / N of M missing (tooltip lists unlabeled MRs, <= 4 rows); story points (tooltip Done / Total). Create branch / Create milestone dialogs unchanged (confirm-gated, close only on success). `EditReleaseModal` unchanged, opened from Edit (D-14).

Interaction: tooltips on pill, facts, done bar and every graph; assignee and type rows are not click targets in this phase; Pin toggles pinned tab (`REL-{id}`); Open in Jira opens externally; focus-visible ring on all buttons/links; icon-only buttons carry `aria-label`; graph slots expose `aria-label` summaries (e.g. "Merge requests: 12 merged, 3 open").

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Header actions (all outline): "Pin release", "Edit release", "Open in Jira"; inline: "Create branch", "Create milestone", "Retry branch check" |
| Empty state heading | "No issues" (graph slots); "No MRs in this milestone" (donut slot) |
| Empty state body | Table: "No issues in this fix version". Burnup: "Not enough history yet — the burnup starts after the first day". Dashed-box placeholders carry no extra body |
| Error state | "Couldn't check" (branch) with inline "Retry branch check"; "Couldn't verify" (merged back) with reason in tooltip; graph data failure: "Couldn't load issues. Refresh to try again." |
| Destructive confirmation | None in this phase. Create branch / Create milestone keep their existing confirm dialogs (e.g. "Create branch: Create release/03.11.2026 from main?" unchanged copy from P88) |

Other fixed strings: "Refreshed: HH:MM:SS"; fact names "Milestone", "Branch", "Merged back", "MR labels", "Story points"; "Missing", "Set a release date first", "Create the milestone first", "Likely not into main", "All N labeled", "N/M missing", "No release date"; section headings "Progress", "Merge requests", "By assignee", "By type", "Labels", "Deployment package mismatches N"; "Unassigned"; markers "TODAY", "RELEASE".

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | existing components only (button, tooltip, skeleton, chart) | not required |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
