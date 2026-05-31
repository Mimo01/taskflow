# Quick Task 260531-3ey: Sprint Board filters row overflow - Research

**Researched:** 2026-05-31
**Domain:** Tailwind v4 flexbox layout (CSS-only)
**Confidence:** HIGH

## Summary

CSS-only fix in `UnifiedFilterBar.tsx`. The current primary row is a single flex
container holding (presets + wrapping chips + `flex-1` spacer + right-side action
buttons). The chips use `flex flex-wrap` with no `min-w-0` scroll region, and the
right buttons share the same flex line. On overflow the row widens past the viewport
and drags the page horizontally instead of scrolling internally.

Fix: split the row into a scrollable left region (`flex-1 min-w-0 overflow-x-auto
no-scrollbar` with `flex-nowrap` inner content) and a pinned right action group
(`shrink-0`). Remove the now-redundant `flex-1` spacer — the left region's `flex-1`
fills the space instead. Apply the same treatment to the `filtersOpen` expanded row.

**Primary recommendation:** Restructure both rows so chip content lives in a
`flex-1 min-w-0 overflow-x-auto no-scrollbar` wrapper with `flex-nowrap`; wrap right
buttons in a single `shrink-0` group; delete the `flex-1` spacer at line 481.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Left content (preset pills + active chips) in a scrollable `flex-1 min-w-0` region that scrolls horizontally.
- Right action buttons (Save / Save Filter / Filter+count) pinned right, `shrink-0`, never scroll.
- Chips: single-row, switch `flex-wrap` -> `flex-nowrap`.

### Claude's Discretion (resolved)
- Hidden scrollbar via existing `no-scrollbar` + `overflow-x-auto` (matches `QuickFilterChipRow`).
- Apply to BOTH primary row and expanded `filtersOpen` row.
- Leave `QuickFilterChipRow.tsx` as-is; only verify it is not the page-drag culprit.

## Findings

### 1. `no-scrollbar` utility — confirmed reusable
**[VERIFIED: codebase grep]** Defined as a Tailwind v4 `@utility` in
`/Users/mimo/Documents/Projects/taskflow/taskflow/src/index.css:70-76`:

```css
@utility no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
```

It is a global utility (already used in `QuickFilterChipRow.tsx:44`, `PinnedTabStrip.tsx`,
`command.tsx`). Free to use `overflow-x-auto no-scrollbar` in `UnifiedFilterBar.tsx`.

### 2. Root cause — CONFIRMED (multiple compounding factors)
Trace from page container down (`SprintBoardTab.tsx`):
- `1190`: `<div className="h-full overflow-auto">` — scroll container. Has NO width
  constraint of its own; if a child is wider than the viewport this scrolls the whole
  board horizontally (the "drags the page" symptom).
- `1251`: `<UnifiedFilterBar />` mounted directly inside, no wrapping width constraint.
- `UnifiedFilterBar.tsx:329`: primary row `<div className="flex items-center gap-1.5 px-3 py-1.5">`.

Inside that single flex row:
- Preset pills (`339-444`) are direct flex children (no scroll wrapper).
- Active chips (`447-478`) sit in `<div className="flex flex-wrap items-center gap-1">` (`450`).
- A `flex-1` spacer at `481`.
- Right buttons (Save `484`, Save Filter `497`, Filter toggle `548`) follow the spacer.

**Root cause:** there is no `min-w-0` scroll region. The chips + presets are intrinsic-width
flex children on the same line as the action buttons. `flex-wrap` lets them wrap, but the
combined intrinsic content width still forces the flex row wider than the viewport, and the
ancestor `overflow-auto` (line 1190) then scrolls the entire board. Adding `overflow-x-auto`
to a flex child alone would NOT scroll — a flex item refuses to shrink below its content's
intrinsic size unless it also has `min-w-0`. This is the critical gotcha. **[VERIFIED: flexbox spec — default `min-width:auto` on flex items]**

### 3. `QuickFilterChipRow` is NOT the culprit
**[VERIFIED: codebase read]** `QuickFilterChipRow.tsx:41-45` is its own top-level row
(`flex items-center gap-2 px-3 py-1.5 overflow-x-auto no-scrollbar`) — it is a direct child
of the scroll container, full-width, and already self-contains its overflow. But note it is
MISSING `min-w-0`; it works only because it is not itself a flex child under pressure (its
parent is the block-level `overflow-auto` div, not a flex row). Leave it untouched per CONTEXT.

### 4. Exact recommended class structure

**Primary row (`UnifiedFilterBar.tsx:329-562`):**

Outer row stays flex but should not let content overflow it:
```jsx
<div className="flex items-center gap-1.5 px-3 py-1.5">
```
Wrap presets + chips in a single scrollable left region (replaces direct children +
the `flex flex-wrap` chip div):
```jsx
<div className="flex-1 min-w-0 flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar">
  {/* empty-state hint, preset pills, divider, active chips + Clear */}
</div>
```
- Change the inner chip container at line 450 from `flex flex-wrap` to `flex flex-nowrap`
  (or fold it into the left region). Keep `shrink-0` on individual chips so they don't squash.
- **Delete the `flex-1` spacer at line 481** — the left region's `flex-1` now fills space.

Wrap right-side buttons in a pinned group (replaces them sitting loose after the spacer):
```jsx
<div className="shrink-0 flex items-center gap-1.5">
  {/* Save, Save Filter, savingName input, Filter toggle */}
</div>
```

**Expanded `filtersOpen` row (`UnifiedFilterBar.tsx:575-637`):**
Same treatment. Outer `576` stays `flex items-center gap-1.5 px-3 py-1.5 ...`. The four
`FilterDropdown`s + divider + chips should live in a `flex-1 min-w-0 flex flex-nowrap
items-center gap-1.5 overflow-x-auto no-scrollbar` wrapper. Change the chip container at
line 607 from `flex flex-wrap` to `flex flex-nowrap`. (No right-pinned buttons here, but
the scroll region is still needed so the dropdown row does not drag the page.)

## Common Pitfalls

- **Missing `min-w-0`** — the #1 trap. Without it `overflow-x-auto` does nothing and the
  parent widens. It MUST be on the `flex-1` left region.
- **`flex-nowrap` on chips** — switching from `flex-wrap` is required; otherwise wrapped chips
  increase row height and never trigger horizontal scroll.
- **Vertical clipping** — `overflow-x-auto` also clips overflow-y. Keep `items-center` and
  ensure chips fit the row height; do not add tall elements (focus rings/borders are fine).
  If clipping appears, the row already has fixed-height children so risk is low.
- **Lost padding in scroll region** — `px-3` lives on the OUTER row, not the scroll wrapper,
  so left/right padding is preserved. Do not move `px-3` onto the scroll wrapper (scrolled
  content would lose end padding). Keep gap on the inner `flex-nowrap` instead.
- **`shrink-0` on chips** — individual chips/pills should keep their intrinsic width inside the
  nowrap scroll region; add `shrink-0` if any chip squashes.
- **Don't regress `QuickFilterChipRow.tsx`** — leave it untouched (it is a sibling row, not affected).
- **`savingName` input** — when active it replaces the Save buttons; keep it inside the right
  `shrink-0` group so it stays pinned.

## Validation

- TypeScript/lint gate: `npm run check` (biome check + tsc) must stay green per project baseline.
- Manual: on Sprint Board, add many filter chips / long preset names — left region scrolls
  horizontally (trackpad / shift-wheel), right buttons stay pinned, page does NOT drag.
- Existing test fixtures use `data-testid` on chips (lines 454, 611) — class changes do not
  affect testids, so no test changes expected.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | none | — | — |

All claims verified via codebase read/grep.

## Sources
- **HIGH** `src/index.css:70` (no-scrollbar `@utility`), `UnifiedFilterBar.tsx:327-642`,
  `QuickFilterChipRow.tsx:1-81`, `SprintBoardTab.tsx:1190-1252` — direct codebase read.
- **HIGH** Flexbox `min-width:auto` default behavior — CSS Flexbox spec, well-established.
