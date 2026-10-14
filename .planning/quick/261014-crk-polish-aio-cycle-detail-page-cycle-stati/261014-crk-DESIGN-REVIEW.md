# 261014-crk — Design review of the cycle stats block

Reviewed: `CycleKpiTiles.tsx`, `AioTile.tsx`, `AioDonut.tsx`, `ExecutionDonut.tsx`,
`DefectSummary.tsx` against `CycleHeader.tsx`, `AioCycleDetailPage.tsx` and the shared
`EpicStatCard` / `Card` primitives. Judged from the CSS (no browser screenshot).

## What is off, ranked

1. **One text style for three hierarchy levels.** The section headings ("Cycle Statistics"),
   the tile labels ("Pass rate") and the donut key titles ("Status") all use `TITLE_CLASS`
   (xs, uppercase, semibold, muted). Nothing tells the eye what contains what. Every other
   detail page in the app heads its sections with `h3.text-sm.font-medium.text-muted-foreground`
   (`EpicProgressSection`, `ActivityTimeline`, `RunSection`); this block is the odd one out.
2. **Three donut sizes/strokes on one row.** Execution donut 160 px, defect donuts 112 px, both
   with a proportional 14 % stroke (22 px vs 16 px). They read as two different components.
3. **Broken reflow between ~770 px and ~1300 px.** The two chart sections are `flex-none`
   (~190 px + ~540 px) and the tile grid takes the remainder, so at a 1000 px container each
   tile is ~75 px wide and the labels truncate. Below 768 px everything stacks into a
   ~610 px tall block. There is no middle layout.
4. **Uneven rhythm around the dividers.** Section 1 has `pr-6`, the row has `gap-6`, the
   divided sections have `pl-6`: 48 px before each rule, 24 px after. The block itself sits
   `pt-1` under the header's `pb-2`: the first heading is 12 px from the metadata line while
   the tiles have 16-24 px everywhere else.
5. **Unbalanced vertical alignment.** All sections are `content-start`, so the 112 px defect
   donuts hang from the heading with ~100 px of empty space under them beside a 208 px tile grid.
6. **Layout jumps while loading.** The whole "Defect Summary" section is unmounted while defects
   resolve, then appears (width + height change). Tile skeletons are centred (`items-center`,
   `self-center`) while live tiles are left-aligned, so the content shifts on load. An empty
   cycle shows "No runs recorded" wrapped inside a ring with 24 px side padding.
7. **Key rows do not match the app's marker language.** The key uses a round dot; the tooltip
   that opens on the same slice uses the shared `MarkerGlyph` square swatch. Values are not
   aligned (no fixed key width), so the two keys ragged-edge against each other.
8. **Sub-line wording inconsistent.** Three tiles say "of …", the re-runs tile says "(8%)".

## What was done

- Section headings use the detail-page `h3` style (sm / medium / muted); tile labels are plain
  xs muted (the `StatCardBody` default, same as the epic tiles); key titles are xs / medium.
- One `DONUT_SIZE` (120 px) and one stroke (12 % of size, 14 px) for every donut; skeleton ring
  uses the same stroke. Centre text keeps `VALUE_CLASS`.
- Three container-query layouts on the block's own `@container`:
  - < 768 px: sections stacked, tiles 2x2.
  - >= 768 px (`@3xl`): tiles 4-across on row 1; Execution | Defect Summary on row 2 under a
    hairline. Block is ~360 px tall instead of ~480 px.
  - >= 1280 px (`@7xl`): tiles 2x2 | Execution | Defect Summary in one row, vertical rules.
  Rules get 24 px on both sides at every breakpoint; the block has `py-4` so the first heading
  sits 24 px under the header metadata line.
- Chart bodies are vertically centred against the tile grid at the wide layout.
- "Defect Summary" is always mounted: skeleton rings while resolving, a single muted ring with
  "No linked defects" when there are none (same treatment as the empty execution ring).
  Tile skeletons are left-aligned like the live tiles.
- Key rows use `MarkerGlyph` (status swatch) + muted label + right-aligned tabular value in a
  fixed-width column, so both keys align and match the tooltip rows.
- Re-runs sub-line is "8% of cases" (same "of …" pattern as the other three).
- The execution donut deliberately stays keyless: the Executions tab's status chips directly
  below already show every per-status count, so a key would show each figure twice.

## Not verified visually

- Actual glyph widths at the `@7xl` boundary (tile label "Unlinked failures" needs ~125 px; the
  tile column gets ~390 px / 2 at a 1280 px container, so it should fit with margin).
- Dark-mode contrast of the `gray-300` "Not run" slice (unchanged palette).
