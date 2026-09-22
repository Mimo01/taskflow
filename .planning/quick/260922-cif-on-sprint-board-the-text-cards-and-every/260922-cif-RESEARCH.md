# Quick Task 260922-cif: Sprint board too large in compact view — Research

**Researched:** 2026-09-22
**Domain:** Tailwind v4 density variants / sprint board layout (local codebase)
**Confidence:** HIGH (all findings read directly from source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Density target:** Aggressive density in compact mode — smaller fonts, tighter padding, shorter row/card heights; prioritize fitting more on screen over breathing room.
- **Scope:** Apply tightening to the `density-compact:` variant **only**. Default/comfortable must NOT shrink.
- **Card content:** Just shrink existing elements (font size, padding, gaps, min-heights) — do **not** hide/drop any fields, badges, or avatars in compact mode.

### Claude's Discretion
- Exact numeric values for the compact variants.

### Deferred Ideas (OUT OF SCOPE)
- None recorded.
</user_constraints>

## Summary

The sprint board barely changes in compact mode because **only four `density-compact:` declarations exist across the entire board**, and they all touch vertical padding / min-height. Every font size, gap, icon size, avatar size, chip padding, column-header height and horizontal padding is a fixed value with no density variant at all. That is the root cause — compact mode currently subtracts roughly 4–8px per row and nothing else. [VERIFIED: grep across `src/`]

The three board-specific components (`TaskCard.tsx`, `StoryHeaderRow.tsx`, and the inline `TransitionDropZone` / column-cell markup in `SprintBoardTab.tsx`) are **sprint-board-local** — `SprintBoardTab.tsx` is their only consumer, so they can be tightened freely. The pieces they compose from (`statusPillClass`, `CachedAvatar`, `PriorityIcon`, `Badge`, `IssueTypeIcon`) are **shared app-wide** and must not have geometry changed in place. [VERIFIED: grep for imports]

**Primary recommendation:** Add `density-compact:` variants to the ~20 fixed-size class sites listed below (all inside the three board-local files), use **rem-based** arbitrary font sizes so the orthogonal `data-font-scale` setting still works, leave the shared `STATUS_PILL_LAYOUT_CLASS` and `CachedAvatar` untouched, and replace the hardcoded `HEADER_HEIGHT = 37` sticky-header constant with a measured height.

## How the density system works

| Fact | Detail |
|------|--------|
| Variant definition | `src/index.css:10-11` — Tailwind v4 `@variant density-compact (&:is([data-density="compact"] *));` |
| Applied by | `src/services/theme.ts:26-28` — sets/removes `data-density` on `document.documentElement` |
| State | `src/stores/settings.store.ts:16` — `type Density = 'compact' \| 'default' \| 'comfortable'`, default `'default'` |
| Selector shape | descendant-only (`[data-density="compact"] *`) — never matches `<html>` itself; fine for all board markup |
| Orthogonal setting | `src/index.css:163-171` — `html[data-font-scale='sm'\|'lg'\|'xl']` sets root `font-size: 87.5%/112.5%/125%` |

**Consequence of the font-scale setting:** use `text-[0.625rem]`-style rem values, **not** `text-[10px]`. A prior quick task (260812-mry, referenced at `src/routes/dashboard/TaskCard.test.tsx:86`) already swept px→rem for exactly this reason. Using px here would silently break the font-scale feature in compact mode. [VERIFIED: source comment + index.css]

## Existing `density-compact:` sites on the board (all four)

| File:line | Current classes | What it controls |
|-----------|-----------------|------------------|
| `src/routes/dashboard/SprintBoardTab.tsx:183` | `min-h-[80px] density-compact:min-h-[56px] density-comfortable:min-h-[96px]` | `TransitionDropZone` height |
| `src/routes/dashboard/SprintBoardTab.tsx:533` | `min-h-[80px] density-compact:min-h-[56px] … gap-1.5 p-2 density-compact:p-1 density-comfortable:p-3` | column cell (**virtualized path**) |
| `src/routes/dashboard/SprintBoardTab.tsx:708` | identical string to :533 | column cell (**non-virtual fallback path**) |
| `src/routes/dashboard/TaskCard.tsx:351` | `px-2 py-2 density-compact:py-1 density-comfortable:py-3 … gap-1 rounded-lg` | card outer wrapper |
| `src/routes/dashboard/StoryHeaderRow.tsx:102` | `gap-2 px-3 py-2 density-compact:py-1 density-comfortable:py-3` | story header row |

⚠️ **Lines 533 and 708 are byte-identical duplicates.** Any edit must be applied to **both** or compact mode will differ between the virtualized render and the jsdom/fallback render (which is what the tests exercise).

## Component ownership — safe vs shared

| Component | File | Consumers | Safe to tighten? |
|-----------|------|-----------|------------------|
| `TaskCard` | `src/routes/dashboard/TaskCard.tsx` | only `SprintBoardTab.tsx:563,588,735,760,1854` | ✅ board-local |
| `StoryHeaderRow` | `src/routes/dashboard/StoryHeaderRow.tsx` | only `SprintBoardTab.tsx:486,662,1687` | ✅ board-local |
| `TransitionDropZone` | inline, `SprintBoardTab.tsx:169-190` | board only | ✅ board-local |
| `statusPillClass` / `STATUS_PILL_LAYOUT_CLASS` | `src/lib/statusStyles.ts:69` | **app-wide** (backlog, AIO, issue detail, popovers) | ❌ do not edit in place |
| `CachedAvatar` | `src/components/ui/cached-avatar.tsx` | app-wide | ❌ see limitation below |
| `PriorityIcon` | `src/components/ui/priority-icon.tsx:17` | app-wide, but `className` prop is fully overridable per call site | ⚠️ override at call site only |
| `Badge` | `src/components/ui/badge.tsx` | app-wide | ⚠️ override via `className` at call site |

### `CachedAvatar` limitation (blocks avatar shrinking)

`size` is a **runtime prop** mapped through `SIZE_MAP = { 20: 'size-5', 24: 'size-6', 32: 'size-8', 40: 'size-10' }` (`cached-avatar.tsx:17`). The `className` prop is applied **only to the outer wrapper div** (`cached-avatar.tsx:65`) — the inner fallback div (`:67-80`) and the `<img>` (`:83-90`) get `sizeClass` only. So `className="density-compact:size-4"` shrinks the wrapper while the image stays 20px → overflow, not a smaller avatar. [VERIFIED: source]

Both board usages already pass the **smallest permitted** size (`size={20}`): `TaskCard.tsx:209`, `StoryHeaderRow.tsx:157`.

**Recommendation:** leave avatars at 20px. If the 20px avatar becomes the height floor of a compact row, the only correct fix is extending `SIZE_MAP` + `ICON_SIZE_MAP` with a `16` entry and applying `className` to all three inner elements — a shared-primitive change that exceeds this task's boundary. Flag it to the user rather than hacking a wrapper override.

### `statusPillClass` decision point

`STATUS_PILL_LAYOUT_CLASS` (`src/lib/statusStyles.ts:69`) = `shrink-0 min-w-[5.5rem] whitespace-nowrap text-center rounded px-1.5 py-0.5 text-xs font-medium`, and its docblock (`:56-59`) explicitly forbids callers adding `px-*`, `py-*`, `text-xs`, `min-w-*`.

Two options for the planner:
1. **Recommended:** leave it alone. The pill is used in `StoryHeaderRow.tsx:184` and `TaskCard.tsx:247` only; its `py-0.5 text-xs` sets a ~20px line box that will become the story-row height floor once padding shrinks. Accept ~22px compact rows.
2. **If the user wants pills to shrink too:** add `density-compact:px-1 density-compact:py-0 density-compact:text-[0.625rem] density-compact:min-w-[4.5rem]` **inside** `STATUS_PILL_LAYOUT_CLASS`. This is a deliberate app-wide compact change (backlog, AIO, issue detail all shrink in compact mode) — arguably consistent, but it exits the stated task boundary. **Requires user confirmation.**

## Concrete target values

All values below assume "aggressive" per the locked decision. Base/comfortable values are unchanged.

### `TaskCard.tsx` (card)

| Line | Current | Proposed compact addition |
|------|---------|---------------------------|
| 351 | `px-2 py-2 density-compact:py-1 … gap-1 rounded-lg` | `density-compact:px-1.5 density-compact:py-0.5 density-compact:gap-0.5 density-compact:rounded-md` |
| 158 / 174 | key: `text-xs font-mono` | `density-compact:text-[0.625rem]` |
| 185 | issue type: `text-[0.6875rem] … max-w-[50%]` | `density-compact:text-[0.625rem]` |
| 193 | summary: `text-sm leading-snug` | `density-compact:text-xs density-compact:leading-tight` |
| 205 | bottom row: `mt-1 flex items-center justify-between` | `density-compact:mt-0` |
| 206 / 217 | `gap-1.5` | `density-compact:gap-1` |
| 220-224 | `PriorityIcon` (default `w-3.5 h-3.5 shrink-0`) | pass explicit `className="w-3.5 h-3.5 shrink-0 density-compact:size-3"` — the prop **replaces** the default, so the full string is required |
| 228 / 238 | chips: `text-[0.6875rem] … px-1.5 py-0.5` | `density-compact:text-[0.625rem] density-compact:px-1 density-compact:py-0` |
| 262 | subtask toggle: `gap-1 p-1 -mx-1` | `density-compact:p-0.5 density-compact:-mx-0.5` |
| 265 | `Badge … text-xs py-0` | `density-compact:text-[0.625rem]` |
| 268 | chevrons `size-4` | `density-compact:size-3.5` |
| 152 | flag icon `size-3.5` | `density-compact:size-3` |

**Do not touch** the inline `WebkitLineClamp: 2` style at `TaskCard.tsx:194-199` — it's a JS style object, unreachable by a Tailwind variant, and dropping to 1 line would violate the "don't drop content" decision anyway. Reducing `text-sm`→`text-xs` plus `leading-snug`→`leading-tight` already saves ~8px on a 2-line summary.

### `StoryHeaderRow.tsx` (swimlane header)

| Line | Current | Proposed compact addition |
|------|---------|---------------------------|
| 102 | `gap-2 px-3 py-2 density-compact:py-1` | `density-compact:gap-1.5 density-compact:px-2 density-compact:py-0.5` |
| 126 | chevron `size-4` | `density-compact:size-3.5` |
| 131 | inner `gap-2` | `density-compact:gap-1.5` |
| 132 | flag `size-3.5` | `density-compact:size-3` |
| 137 | key `text-xs font-mono` | `density-compact:text-[0.625rem]` |
| 150 | `PriorityIcon` (default className) | pass `className="w-3.5 h-3.5 shrink-0 density-compact:size-3"` |
| 151 | summary `text-sm font-medium truncate` | `density-compact:text-xs` |
| 156 | assignee group `gap-1.5` | `density-compact:gap-1` |
| 158 | name `text-xs max-w-[120px]` | `density-compact:text-[0.625rem] density-compact:max-w-[90px]` |
| 173 | epic pill `px-1.5 py-0.5 text-xs` | `density-compact:px-1 density-compact:py-0 density-compact:text-[0.625rem]` |
| 187 | subtask count `min-w-[5rem] text-xs` | `density-compact:min-w-[4rem] density-compact:text-[0.625rem]` |
| 192 | transition error `text-xs` | `density-compact:text-[0.625rem]` |

### `SprintBoardTab.tsx` (columns + chrome)

| Line | Current | Proposed compact addition |
|------|---------|---------------------------|
| 183 | drop zone `min-h-[80px] density-compact:min-h-[56px]` | change compact to `min-h-[40px]`; add `density-compact:text-[0.625rem]` (currently `text-xs`) |
| 533 **and** 708 | `min-h-[80px] density-compact:min-h-[56px] … gap-1.5 p-2 density-compact:p-1` | compact → `min-h-[40px]`, `density-compact:gap-1`, `density-compact:p-0.5` |
| 1624 | header bar `h-10` — **no density variant at all** | `density-compact:h-7` |
| 1633 | header cell `px-3 gap-1.5` | `density-compact:px-2 density-compact:gap-1` |
| 1635 / 1638 | header labels `text-xs` | `density-compact:text-[0.625rem]` |
| 1644 | refresh cluster `px-3 gap-2` | `density-compact:px-2 density-compact:gap-1.5` |
| 539 / 552 | drop-zone stacks `gap-1` | `density-compact:gap-0.5` |

### Above-board chrome (vertical space competitors)

- `src/routes/dashboard/SprintGoalBanner.tsx:18` — `px-4 py-2` with **no** density variant. Add `density-compact:py-1 density-compact:px-3`. Only consumed by the board (`SprintBoardTab.tsx:1785`).
- `src/routes/dashboard/QuickFilterChipRow.tsx:44` — already `py-1.5 density-compact:py-1`. Board-local; can go to `density-compact:py-0.5`.
- `src/components/UnifiedFilterBar.tsx:92,315,540` — already density-aware but **shared app-wide** (backlog etc.). Leave alone.

## Pitfalls specific to this change

### 1. `HEADER_HEIGHT = 37` is a hardcoded magic number — will break sticky push-out
`src/routes/dashboard/SprintBoardTab.tsx:415` — `const HEADER_HEIGHT = 37; // StoryHeaderRow height in px (py-2 + text = ~37)`. It drives the sticky-header push-out offset (`:420-423`). It is **already wrong in compact mode today** (`py-1` → ~29px) and will be badly wrong after tightening (~22px). Symptom: the pinned header slides out too early/late and jitters at swimlane boundaries.

**Fix:** measure instead of assume — `stickyHeaderInnerRef.current?.offsetHeight ?? 37`. Density-proof and font-scale-proof. **HIGH priority; include in the plan.**

### 2. Duplicate column-cell class string (lines 533 & 708)
Edit both. Line 708 is the non-virtual fallback path, which is what `SprintBoardTab.test.tsx` renders under jsdom — an edit to only 533 will pass tests while shipping broken compact mode (or vice versa).

### 3. `virtualizer.estimateSize: () => 120` (`SprintBoardTab.tsx:280`)
Low risk — `measureElement` corrects real heights and `getItemKey` is keyed by story key (`:289`). After compact rows shrink to ~60px, the estimate is only used for unmeasured overscan rows; a brief scrollbar-length wobble on first paint is possible but self-corrects. Optional polish: density-aware estimate. Not required.

### 4. Existing test assertion on an exact class
`src/routes/dashboard/TaskCard.test.tsx:87-88` asserts the timeInColumn badge className **contains** `text-[0.6875rem]` and `bg-muted`. Since density variants are *added* alongside the base class, this still passes — but do not *replace* the base value. No other test asserts density or geometry classes. [VERIFIED: grep of `*.test.tsx`]

### 5. Repo-specific layout gotchas that apply here
- **Status pill needs a flex parent** for `min-w-[5.5rem] text-center` to hold. Both call sites are already direct children of flex rows (`TaskCard.tsx:217` group, `StoryHeaderRow.tsx:184` row). Don't move the pill into a non-flex wrapper while tightening.
- **`truncate` clips italic overhang** — no italic text on the board today; only relevant if a compact variant introduces one.
- **One row = one line at every density** — shrinking `gap`/`max-w` on `StoryHeaderRow` must not cause the header to wrap to a second line. The row has no `flex-wrap`, and every trailing element is `shrink-0` with `flex-1 min-w-0` on the summary group (`:131`) — so the summary truncates first. Safe, but verify at a narrow window: the fixed-width tail (`min-w-[5.5rem]` pill + `min-w-[4rem]` count + avatar + epic pill) is the horizontal floor.
- **0-width column collapse in `position:absolute` rows (WebKit/Tauri)** — the virtualized swimlanes render inside absolutely-positioned rows (`SprintBoardTab.tsx:631`). Column cells use `flex-1 min-w-0`, which is the pattern that collapsed in the Backlog table. Do **not** shrink the column cells' horizontal padding to zero or add `min-w-0` where there isn't one; keep `density-compact:p-0.5` rather than `p-0`.

### 6. Skeleton geometry mismatch
`src/routes/dashboard/SprintBoardSkeleton.tsx` uses fixed `p-4 gap-3 h-9 h-20` with no density awareness. Cards shrinking to ~52px while skeletons stay `h-20` causes a visible layout jump on load. Low severity; add `density-compact:` variants there for polish (`h-20` → `density-compact:h-12`, `p-4` → `density-compact:p-2`).

## Verification plan

No automated test covers density visuals. Verification is manual:
1. Settings → Appearance → set density to **Compact**; confirm sprint board row height drops materially.
2. Toggle to **Default** and **Comfortable** — confirm **zero** visual change from before (the locked constraint).
3. Cross-check `data-font-scale` at `sm` and `xl` in compact mode — rem-based sizes must scale; any `text-[Npx]` that slipped in will not.
4. Scroll a long board in compact mode and watch the sticky swimlane header push-out for jitter (validates the `HEADER_HEIGHT` fix).
5. Drag a card in compact mode — drop zones must still be tappable at `min-h-[40px]`.
6. Narrow the window — confirm story header stays one line and no column collapses to 0 width.
7. `npx vitest run src/routes/dashboard/TaskCard.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ~40px is a comfortable floor for drop zones to remain reliable dnd-kit targets | Concrete target values | Drops become fiddly in compact mode; raise to 48px |
| A2 | `density-compact:size-3` on `PriorityIcon` wins over the base `w-3.5 h-3.5` (variant selector has higher specificity via `:is()`) | TaskCard table | Icon doesn't shrink; verify visually, fall back to omitting `w-3.5 h-3.5` and using `size-3.5 density-compact:size-3` |
| A3 | Story-row height floor after tightening is the 20px avatar + 20px status pill line box | CachedAvatar limitation | Rows stop shrinking at ~22px; requires the shared-primitive change (user decision) |

## Open Questions

1. **Should status pills shrink app-wide in compact mode?**
   - Known: `STATUS_PILL_LAYOUT_CLASS` is shared; its `py-0.5 text-xs` becomes the story-row height floor.
   - Unclear: whether the user wants compact mode to affect backlog/AIO/issue-detail pills too.
   - Recommendation: ship without it first; if compact rows still feel tall, raise it as a follow-up with the user.

2. **Is a 16px avatar wanted in compact mode?**
   - Known: `CachedAvatar` minimum is 20; supporting 16 requires editing the shared primitive (SIZE_MAP, ICON_SIZE_MAP, and applying `className` to inner elements).
   - Recommendation: out of scope for this task; note it as the next lever if the result is still too tall.

## Sources

### Primary (HIGH confidence — read directly)
- `src/index.css:1-11, 160-172` — density variant + font-scale definitions
- `src/routes/dashboard/SprintBoardTab.tsx` — 169-190, 277-290, 415, 462-560, 645-710, 1615-1710, 1750-1830
- `src/routes/dashboard/TaskCard.tsx` — 131-273, 350-356
- `src/routes/dashboard/StoryHeaderRow.tsx` — 101-195
- `src/lib/statusStyles.ts:55-78`
- `src/components/ui/cached-avatar.tsx:17-96`
- `src/components/ui/priority-icon.tsx:17`
- `src/services/theme.ts:18-28`, `src/stores/settings.store.ts:16-43`
- `src/routes/dashboard/TaskCard.test.tsx:75-105`
- `package.json:83` — `tailwindcss ^4.2.1`

## Metadata

**Confidence breakdown:**
- Density touchpoint inventory: HIGH — exhaustive grep for `density-compact` across `src/`
- Component ownership (shared vs local): HIGH — import grep, single consumer confirmed
- Pitfalls: HIGH — `HEADER_HEIGHT`, duplicate class string, and test assertion read from source
- Specific numeric targets: MEDIUM — design judgment, verify visually

**Research date:** 2026-09-22
**Valid until:** stable (local codebase; invalidated only by edits to the files above)
