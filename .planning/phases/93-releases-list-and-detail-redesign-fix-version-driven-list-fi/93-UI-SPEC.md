---
phase: 93
slug: releases-list-and-detail-redesign
status: approved
reviewed_at: 2026-10-29
shadcn_initialized: true
preset: base-nova (neutral, cssVariables)
created: 2026-10-29
---

# Phase 93 — UI Design Contract

> Visual and interaction contract. Sources: 93-CONTEXT.md (locked D-01..D-15), existing app primitives (AioCycleList, statusStyles, aio-cycle-list), user memory preferences. No new tokens are introduced; everything reuses the existing design system.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json` present, style `base-nova`, base color neutral) |
| Preset | existing `base-nova`; not changed this phase |
| Component library | Base UI (shadcn base-nova) + Tailwind v4 |
| Icon library | lucide-react |
| Font | Geist Variable (`--font-sans`); user font-scale (sm/lg/xl) scales rem, so use rem-based Tailwind classes only |

Reused primitives (do not re-implement): `Card` (KPI tiles only), `Tooltip` + `TooltipBody`/`TooltipRow`, `EmptyState`, `ErrorState`, `StaleDataBanner`, `Skeleton`, `Button`, `STATUS_PILL_LAYOUT_CLASS` + `tonePillClass` (`lib/statusStyles.ts`), `PROGRESS_SEGMENT_CLASS` + `progressTooltipRows` pattern (`lib/aio-cycle-list.ts`), `useDelayedLoading`.

---

## Spacing Scale

Standard 4-multiple scale (Tailwind default step = 4px).

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | gap between pill icon/text, graph-to-figure gap (`gap-1`) |
| sm | 8px | cell horizontal padding `px-2`, header action gaps (`gap-2`) |
| md | 16px | row left/right edge padding (`pl-4`/`pr-4`), section heading to body |
| lg | 24px | spacing between detail body sections |
| xl | 32px | detail header to body |
| 2xl | 48px | not used |
| 3xl | 64px | not used |

Row vertical padding reuses `CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3'` (AioCycleList). Row height therefore follows the user's density setting; density changes padding and font only, never wraps content to a second line.

Exceptions: column widths are explicit-px `flex-none` (WebKit/Tauri 0-width collapse rule): version flex-1 min-w-0; RM package `w-44` (176px); date `w-28` (112px); status `w-28` (112px); issue graph `w-44` (176px). Graph bar height `h-2` (8px) in both list and detail. Every value listed (176, 112, 8) is a 4-multiple; no off-scale sizes.

---

## Typography

Matches AioCycleList (xs/sm only in rows) plus heading sizes already used on detail pages. 4 sizes, 2 weights.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (version name, row text, section body) | 14px (`text-sm`) | 400 | 1.5 |
| Label (column headers, date, RM week label, figure "N / M", pill text, group labels) | 12px (`text-xs`) | 600 for column headers and group labels, 400 elsewhere | 1.5 |
| Heading (detail section h3) | 16px (`text-base`) | 600 (`font-semibold`) | 1.2 |
| Display (detail header version name) | 20px (`text-xl`) | 600 | 1.2 |

Weights: exactly two, regular 400 and semibold 600. Column headers and group labels use `font-semibold` (600) at 12px; everything else is 400. Version name in list rows: 400 `text-sm`. RM child key and numeric figures: `font-mono text-xs` / `tabular-nums`.

---

## Color

Neutral base-nova theme. Colour encodes status only (user preference).

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` | page, list rows, detail body |
| Secondary (30%) | `--muted` / `--border` | column header strip, group hairlines, graph empty track (`bg-muted`), row hover (`hover:bg-muted/50`), sidebar |
| Accent (10%) | status tones only (below); `--primary` neutral for buttons | see reserved list |
| Destructive | `--destructive` | none in this phase |

Accent reserved for: (1) status pill tones, (2) graph segment fills, (3) the Overdue/No date emphasis via pill only. No coloured text, icons, borders or row backgrounds elsewhere. Hover/focus use neutral tokens and the standard focus ring.

Status pill (one per row and in the detail header; built on `STATUS_PILL_LAYOUT_CLASS` + `tonePillClass`, in a flex parent):

| State | Tone | Label |
|-------|------|-------|
| Released | green | `Released` |
| Overdue | red | `Overdue` |
| Due today | blue | `Due today` |
| Upcoming with date | muted | `In N days` (`In 1 day` singular) |
| Unreleased, no date | amber | `No date` |

Precedence: released > no date > overdue > due today > in N days.

Issue graph segments (reuse category colours, no legend): Done `bg-green-500`, In Progress `bg-blue-500`, To Do `bg-muted` (track). Segment order left to right: Done, In Progress, To Do. Zero issues: muted empty track with the text `No issues` (`text-xs text-muted-foreground`), never a 0/0 bar.

---

## Layout and Interaction Contract

### List (ReleasesTab)

- Focal point: the version name and status pill are the primary scan path of each row (leftmost, largest text, only coloured element); the issue graph is secondary and Package/Date are tertiary muted text.
- Page title row: `Releases` (text-sm font-semibold) + count (text-xs muted tabular-nums) + Refresh button on the right, matching AIO cycles refresh control from quick 261029-qez (ghost button, `RefreshCw size-3`, `animate-spin` while refetching, `aria-label="Refresh releases"`). Refresh forces upstream-first reload; the list never blanks (no skeleton on revalidate).
- Column header strip (once, above groups): `border-b border-border text-xs font-semibold text-muted-foreground`, columns: Version, Package, Date, Status, Issues. Header cells use the same `COL` classes as rows.
- Group labels `Upcoming` and `Released` as small `text-xs font-semibold text-muted-foreground` rows with a hairline (`border-b border-border`) and count; Upcoming first, hidden when empty.
- Rows: div+flex, `border-b border-border`, one line per row at every density, single full-row overlay button (`absolute inset-0` sibling, `aria-label="Open release {name}"`), content cells `pointer-events-none relative`. No nested anchors. Hover `bg-muted/50`, keyboard focus-visible ring on the overlay.
- Row cells: Version (`text-sm truncate`, title attr), Package (formatted week label `text-xs` + mono child key `text-xs text-muted-foreground`; tooltip with full summaries; week without child: muted label + tooltip; no week: muted `–`), Date (`text-xs tabular-nums text-muted-foreground`, `–` if none), Status pill, Issues graph (`w-44` (176px, matches the Issues column) `h-2` bar + `done/total` figure `text-xs tabular-nums text-muted-foreground`; tooltip max 4 rows: Done / In Progress / To Do / Total).
- Narrow widths: Package and Date hide via container queries on the content wrapper (`hidden @[720px]:flex` style, container on an outer wrapper, not on self); Version, Status, Issues always remain.
- When no RM project is configured the Package column and header cell are not rendered.
- Ordering (locked D-04): Upcoming = undated first, then dated by date descending; Released = date descending. Released shows 5, then a full-width text button row `Show 10 more` (or `Show N more` when fewer remain), adds 10 per click.
- Loading (D-09): names/dates/pills render at first paint. Package and Issues cells render fixed-size skeleton slots (`Skeleton` at the cell's exact width/height, `h-3`) until data arrives; no layout shift. Initial first-paint skeleton (`ReleasesSkeleton`) restyled to the same header strip and group layout, shown via `useDelayedLoading` only when no cached data exists.
- Stale/error: existing `StaleDataBanner` above the list; `ErrorState` for fetch failure of fix versions; per-cell failure of graph/package shows muted `–` with no chip. No GitLab chips.

### Detail (ReleaseDetailPage)

- Header (replaces `ReleaseTitleHeading`): left block = version name (Display 20px/600), status pill (same component as list), date (`text-xs muted`), RM package (same cell content as list, inline). Right block = `Pin`, `Edit`, `Open in Jira` as `Button variant="outline" size="sm"` (icon + label, lucide `Pin`/`PinOff`, `Pencil`, `ExternalLink`), `gap-2`. Single-word labels `Pin`, `Unpin` and `Edit` are deliberate: they sit beside the release title, so the noun is implied (icons reinforce). Rocket icon and `v{id}` mono line removed.
- Below the title row: wide issue graph (`h-2`, full available width up to `max-w-xl`) with figure `N / M done` (`text-xs tabular-nums`) at its right; same segments and a ≤4-row tooltip. This is the only place the done figure appears on the page.
- Header renders immediately from cached fix-version and graph data when arriving from the list; deep link without cache uses the existing skeleton, restyled to the header shape. Body sections stream under their own placeholders.
- Sidebar: remove Status and Date rows; keep Milestone, Branch, Merged back, MR Labels, MRs, Issues (per-status breakdown), Story points, Descriptions. Edit button leaves the sidebar Details heading.
- Body: sections use `h3` Heading style (16px/600) with `border-b` hairline underneath where the existing sections have one, `space-y` 24px between sections (no negative margins on children), no card panels. Label summary, deployment-package mismatches and unified task table follow this heading and spacing scale. Unified task table header: remove progress bar and done badge, keep flagged-MR count. Table anatomy otherwise untouched.
- Pin state: pinned button shows `PinOff` and label `Unpin`; pinned tabs (`REL-{id}`) keep working.

### Accessibility

- Overlay row button is the sole tab stop per row; graph has `role="img"` with `aria-label="{done} of {total} issues done"`; pill text is the status (not colour alone); tooltip content is not the only carrier of information (figure is visible text).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (list) | `Refresh` (icon button, aria-label `Refresh releases`) |
| Primary CTA (detail) | `Edit` (header), `Pin`/`Unpin`, `Open in Jira` |
| Empty state heading | `No releases yet` |
| Empty state body | `Fix versions from your Jira projects will appear here once they are created.` |
| Error state | `Couldn't load releases. Check your Jira connection, then press Refresh.` |
| Group labels | `Upcoming`, `Released` |
| Load more | `Show {N} more` |
| Graph empty | `No issues` |
| Destructive confirmation | none in this phase (no destructive actions) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | existing: button, skeleton, tooltip, empty-state, card (no new blocks added) | not required |
| Third-party | none | not applicable (`registries: {}`) |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (single-word Edit/Pin/Unpin/Refresh — justified, non-blocking)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-10-29
