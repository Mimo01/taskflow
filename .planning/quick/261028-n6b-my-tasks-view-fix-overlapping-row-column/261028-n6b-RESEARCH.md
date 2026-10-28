# Quick 261028-n6b: My Tasks row overlap at narrow widths - Research

**Researched:** 2026-10-28 | **Confidence:** HIGH (codebase read directly; Tailwind docs fetched) | **New packages:** none

<user_constraints>
Locked (CONTEXT.md): Tier 1 hide SP slot + label chips; Tier 2 MR-health + Flagged chips icon-only (keep accessible name); Tier 3 time bar shrinks then hides. Always visible: type icon, key, summary (truncates), status pill, avatar. Subtask rows follow the same tiers. Key off the page `@container` (MyTasksPage.tsx:750) with `@`-variants on descendants, not viewport. Keep WebKit guards (explicit px widths, pill in flex parent, no negative margins). One row = one line.
Discretion: breakpoint values; whether the time bar narrows before hiding.
</user_constraints>

## 1. Root cause (verified in MyTaskRow.tsx)
- The row is `flex`: the LEFT region is `flex-1 min-w-0`, and RIGHT cluster is `shrink-0` (:207).
- RIGHT cluster is roughly 330-360px and never shrinks: pill `min-w-[5.5rem]` (88px, wider for long status names, `STATUS_PILL_LAYOUT_CLASS` statusStyles.ts:85) + 8 + SP 48 (inline style, :215) + 8 + time bar 144 (inline style, :64/:82) + 8 + avatar 24.
- The LEFT region can shrink to 0, but its children are all `shrink-0`: type icon 16, key ~65, priority 14, and every chip (`CHIP_BASE` includes `shrink-0`). Up to 2 labels can be up to 120px each, plus "+N", "Flagged" (~78px) and "Changes requested" (~140px). So the LEFT box shrinks while its content overflows (overflow is visible) and paints into the RIGHT cluster. That is the overlap. Only the summary actually truncates.
- Rough container width (C) needed. Row content = C − 32 (list `px-4`, :596/:693) − 16 (row `px-2`). Subtasks lose another 36 (`ml-9`), but their right edge is the same.
  - All chips at worst case: about 1200px.
  - No chips, full cluster: about 680px.
  - No SP: about 620px.
  - Time bar at 96px: about 570px.
  - No time bar: about 420px.

## 2. Tailwind v4 container variants (tailwindcss 4.2.2 installed) [CITED: tailwindcss.com/docs/responsive-design]
- Named variants are min-width: `@sm` 384, `@md` 448, `@lg` 512, `@xl` 576, `@2xl` 672, `@3xl` 768, `@4xl` 896, `@5xl` 1024, `@6xl` 1152, `@7xl` 1280.
- `@max-*` variants apply below a size. Ranges stack, e.g. `@sm:@max-md:`. Arbitrary values: `@min-[Npx]` / `@max-[Npx]`.
- The repo already uses the arbitrary min form `@[Npx]:`, which compiles fine in v4: `@[900px]` ×13, `@[720px]` ×9, `@[1000px]` on this page (:797) [VERIFIED: grep].
- `@[N]` means `width >= N` and `@max-[N]` means `width < N`, so the two partition cleanly with no off-by-one.
- The variants resolve against the nearest `@container` ancestor. That is the page root (:750), which has no padding of its own, so C = the full content-area width. When the peek panel narrows the page, C narrows too.
- The container itself is never styled by them. All the classes here go on row descendants, so that is fine.
- **Use `@max-[Npx]:` for the drop tiers.** The full desktop layout stays the base styles and each class reads as "drop below N".

## 3. Recommended tiers (Claude's discretion)
| C (container) | Change |
|---|---|
| < 1024 | Hide label chips (each chip + "+N": `@max-[1024px]:hidden`) and the SP slot (`@max-[1024px]:hidden`) |
| < 860 | Flagged/MR chip text in `<span className="@max-[860px]:sr-only">`; add `title` + `aria-label` on the chip |
| < 720 | Time bar `w-[144px] @max-[720px]:w-24` (96px); caption gets `truncate` |
| < 580 | Time bar `@max-[580px]:hidden` |

- Safety net: add `overflow-hidden` to the LEFT region (:266, :325). Below about 420px the chips clip instead of painting over the right cluster. The focus ring is on the row, not this region, so it is unaffected.

## 4. Lock-step / alignment
- **There is no column header row.** `GroupHeader` (:165) only puts an "N pts" total at the right; it is not column-aligned and needs no change. The donut uses its own `@[1000px]`.
- `rightCluster` is one shared JSX for parent and subtask, so tier classes there apply to both automatically.
- **Pitfall:** `StackedTimeBar` has TWO branches: the empty spacer at :64 and the filled bar at :82. Both must carry identical width/hidden classes, or rows with no time data misalign.
- The subtask SP placeholder sits inside the same SP slot, so it is covered.
- Existing gap: status pill width varies with the status name, so right-cluster columns can already drift between rows. This is out of scope; note it only.

## 5. Pitfalls
- **Inline style beats classes.** `style={{ width: 144 }}` / `{{ width: 48 }}` must become explicit-px classes (`w-[144px]`, `w-12`/`w-[48px]`). Otherwise the container variants have no effect.
  - This still honours the "explicit px" WebKit guard. That guard was about WebKit collapsing the 0-width column in the virtualized table (memory: virtualized-table-zero-width-col); here it is a plain `shrink-0` flex item with a definite width.
  - Keep `shrink-0` on every fixed column.
- **Base `flex` vs `@max-…:hidden`.** Variant rules are emitted after base utilities, so `hidden` wins. Don't put `hidden` and `flex` in the same variant.
- **Use `sr-only`, not `hidden`, for chip text.** That keeps the accessible name and keeps `getByText` working.
  - `sr-only` is `position:absolute`, so it is not a flex item and no stray `gap-0.5`.
  - The icon-only chip is about 24px wide (`px-1.5` + `size-3` icon).
- **The status pill stays in its `flex` wrapper (:209).** Don't add geometry classes to the pill (memory: statuspill-needs-flex-parent).
- **No wrapping:** keep `whitespace-nowrap`/`truncate`. No negative margins (memory: tailwind4 space-y; the list uses `space-y-0.5`).
- **Don't hide via JS/ResizeObserver.** CSS-only keeps jsdom tests and React Compiler behaviour simple.

## 6. Tests
- `MyTaskRow.test.tsx` (142 lines) only asserts `line-through` on key/summary. Unaffected.
- `MyTasksPage.test.tsx` uses `getByText('Approved')` (:415), `getByText('Changes requested')` (:427) and the time caption (:330). All of these still pass because the text stays in the DOM.
- jsdom does not evaluate container queries or Tailwind CSS, so test the class strings, not visibility. Suggested additions to MyTaskRow.test.tsx:
  - The SP slot and label chip have `@max-[1024px]:hidden`.
  - The Flagged text span has `@max-[860px]:sr-only`, and the chip has `aria-label`/`title`.
  - The time bar (both branches: with and without time data) has `@max-[580px]:hidden`.
  - Use `toHaveClass('@max-[1024px]:hidden')`; it splits on whitespace, so the bracket characters are fine.
  - `isIssueFlagged` is mocked at :18; set it to `true` for the Flagged case.
- Commands, run from inner `taskflow/taskflow/`:
  - Quick: `npx vitest run src/routes/my-tasks`
  - The pre-commit hook runs the full suite + biome + tsc. Combine RED and GREEN in one commit.
- Visual check: render at C ≈ 1200 / 950 / 800 / 650 / 500 in Tauri/WebKit. Checking at different widths is the only real way to confirm there is no overlap.

## Sources
- Codebase: MyTaskRow.tsx, MyTasksPage.tsx (:165, :596, :693, :750, :797), statusStyles.ts:85, both test files; `node_modules/tailwindcss` 4.2.2.
- https://tailwindcss.com/docs/responsive-design (container queries section).
