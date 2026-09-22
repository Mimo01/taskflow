---
phase: quick-260922-cif
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/dashboard/TaskCard.tsx
  - src/routes/dashboard/StoryHeaderRow.tsx
  - src/routes/dashboard/SprintBoardTab.tsx
  - src/routes/dashboard/SprintGoalBanner.tsx
  - src/routes/dashboard/QuickFilterChipRow.tsx
  - src/routes/dashboard/SprintBoardSkeleton.tsx
autonomous: false
requirements: [QUICK-260922-cif]

must_haves:
  truths:
    - "In compact density, sprint board cards and story header rows are materially shorter than before — noticeably more cards fit on screen"
    - "In default and comfortable density, the sprint board looks byte-identical to before the change"
    - "No field, badge, avatar, chip or icon is hidden or dropped in compact mode — everything is still rendered, just smaller"
    - "Compact-mode font sizes still scale when the Appearance font-scale setting is changed to sm or xl"
    - "The sticky swimlane header push-out tracks the real story-row height at every density instead of a hardcoded 37px"
    - "Drop zones remain reliable drag targets in compact mode"
  artifacts:
    - path: "src/routes/dashboard/TaskCard.tsx"
      provides: "Compact-density variants on card padding, gaps, summary, key, chips, icons and badges"
      contains: "density-compact:"
    - path: "src/routes/dashboard/StoryHeaderRow.tsx"
      provides: "Compact-density variants on swimlane header row padding, gaps, text and pills"
      contains: "density-compact:"
    - path: "src/routes/dashboard/SprintBoardTab.tsx"
      provides: "Compact-density variants on column cells, drop zones and header bar; measured sticky header height"
      contains: "stickyHeaderInnerRef.current?.offsetHeight"
  key_links:
    - from: "src/routes/dashboard/SprintBoardTab.tsx"
      to: "sticky swimlane header offset calculation"
      via: "measured offsetHeight instead of HEADER_HEIGHT constant"
      pattern: "offsetHeight"
    - from: "src/index.css density-compact variant"
      to: "board-local components"
      via: "Tailwind density-compact: utility prefix"
      pattern: "density-compact:"
---

<objective>
Make the sprint board materially denser in **compact** density mode only. Today only four `density-compact:` declarations exist across the whole board and every one of them touches vertical padding — so compact mode subtracts roughly 4-8px per row and nothing else. Every font size, gap, icon size, chip padding, column-header height and horizontal padding is a fixed value with no density variant at all.

Purpose: the user reports the sprint board is too large even on compact view. Fix the root cause by adding `density-compact:` variants to the ~30 fixed-size class sites in the three board-local components plus the board chrome above them.

Output: tighter compact board, unchanged default/comfortable board, and a density-proof sticky-header offset.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260922-cif-on-sprint-board-the-text-cards-and-every/260922-cif-CONTEXT.md
@.planning/quick/260922-cif-on-sprint-board-the-text-cards-and-every/260922-cif-RESEARCH.md

@src/routes/dashboard/TaskCard.tsx
@src/routes/dashboard/StoryHeaderRow.tsx
@src/routes/dashboard/SprintBoardTab.tsx
</context>

<constraints>
These are locked. Violating any of them fails the task.

1. **Compact only.** Every edit is an *added* `density-compact:` variant. Never change, replace or remove a base class value, and never touch `density-comfortable:` values. Default and comfortable rendering must be pixel-identical to `main`.
2. **Nothing is hidden.** Do not add `hidden`, `density-compact:hidden`, conditional rendering, or reduce `WebkitLineClamp`. Shrink only: font size, padding, gap, margin, min-height, min-width, icon size, border radius.
3. **rem, never px, for font sizes.** Use `density-compact:text-[0.625rem]`, never `text-[10px]`. The app has an orthogonal `html[data-font-scale]` root-font-size setting (`src/index.css:163-171`); px sizes silently break it. A prior quick task (260812-mry) already swept px→rem for this reason — see the comment at `src/routes/dashboard/TaskCard.test.tsx:86`.
4. **Do not edit shared primitives.** `src/lib/statusStyles.ts` (`STATUS_PILL_LAYOUT_CLASS`), `src/components/ui/cached-avatar.tsx`, `src/components/ui/badge.tsx` and `src/components/ui/priority-icon.tsx` are used app-wide. Shrink `PriorityIcon` and `Badge` via the `className` prop at the board call sites only. Leave the status pill and the 20px avatar alone — the avatar's `SIZE_MAP` minimum is 20 and `className` reaches only its outer wrapper, so a wrapper override would overflow rather than shrink.
5. **`PriorityIcon`'s `className` prop replaces its default** (`w-3.5 h-3.5 shrink-0`). Pass the full replacement string, not just the variant.
6. **Never shrink a column cell's horizontal padding to `p-0`.** The virtualized swimlanes render inside `position:absolute` rows with `flex-1 min-w-0` column cells — the exact pattern that collapsed to 0 width in the Backlog table under WebKit/Tauri. Floor at `density-compact:p-0.5`.
</constraints>

<tasks>

<task type="auto">
  <name>Task 1: Add compact-density variants to TaskCard and StoryHeaderRow</name>
  <files>src/routes/dashboard/TaskCard.tsx, src/routes/dashboard/StoryHeaderRow.tsx</files>
  <action>
Add `density-compact:` variants to the fixed-size classes in the two board-local card components. `SprintBoardTab.tsx` is the only consumer of both, so they can be tightened freely.

In `src/routes/dashboard/TaskCard.tsx`:
- Card outer wrapper (~line 351, the class string starting `group border rounded-lg px-2 py-2 density-compact:py-1`): add `density-compact:px-1.5 density-compact:py-0.5 density-compact:gap-0.5 density-compact:rounded-md`. The existing `density-compact:py-1` must be replaced by `density-compact:py-0.5` — that is the one permitted replacement, since it is itself a compact variant, not a base value.
- Flag icon `size-3.5` (~line 152): add `density-compact:size-3`.
- Issue key `text-xs font-mono` (~lines 158 and 174 — both branches): add `density-compact:text-[0.625rem]`.
- Issue type label `text-[0.6875rem]` (~line 185): add `density-compact:text-[0.625rem]`.
- Summary `text-sm leading-snug` (~line 193): add `density-compact:text-xs density-compact:leading-tight`. Leave the inline `WebkitLineClamp: 2` style object (~lines 194-199) untouched.
- Bottom row `mt-1 flex items-center justify-between` (~line 205): add `density-compact:mt-0`.
- The two `gap-1.5` groups (~lines 206 and 217): add `density-compact:gap-1`.
- `PriorityIcon` (~lines 220-224): pass `className="w-3.5 h-3.5 shrink-0 density-compact:size-3"` (full string — the prop replaces the default).
- Chips `text-[0.6875rem] ... px-1.5 py-0.5` (~lines 228 and 238): add `density-compact:text-[0.625rem] density-compact:px-1 density-compact:py-0`. Keep the base `text-[0.6875rem]` and `bg-muted` classes — `TaskCard.test.tsx:87-88` asserts the timeInColumn badge className *contains* them.
- Subtask toggle `gap-1 p-1 -mx-1` (~line 262): add `density-compact:p-0.5 density-compact:-mx-0.5`.
- `Badge` (~line 265, `text-xs py-0`): add `density-compact:text-[0.625rem]` to its `className`.
- Chevron icons `size-4` (~line 268): add `density-compact:size-3.5`.

In `src/routes/dashboard/StoryHeaderRow.tsx`:
- Row wrapper (~line 102, `gap-2 px-3 py-2 density-compact:py-1`): add `density-compact:gap-1.5 density-compact:px-2`, and change the existing compact variant to `density-compact:py-0.5`.
- Chevron `size-4` (~line 126): add `density-compact:size-3.5`.
- Inner `gap-2` (~line 131): add `density-compact:gap-1.5`. Keep its `flex-1 min-w-0`.
- Flag `size-3.5` (~line 132): add `density-compact:size-3`.
- Key `text-xs font-mono` (~line 137): add `density-compact:text-[0.625rem]`.
- `PriorityIcon` (~line 150): pass `className="w-3.5 h-3.5 shrink-0 density-compact:size-3"`.
- Summary `text-sm font-medium truncate` (~line 151): add `density-compact:text-xs`.
- Assignee group `gap-1.5` (~line 156): add `density-compact:gap-1`.
- Assignee name `text-xs max-w-[120px]` (~line 158): add `density-compact:text-[0.625rem] density-compact:max-w-[90px]`. (`max-w` is a width, not a font size, so a px value is correct here and the verify grep excludes it.)
- Epic pill `px-1.5 py-0.5 text-xs` (~line 173): add `density-compact:px-1 density-compact:py-0 density-compact:text-[0.625rem]`.
- Subtask count `min-w-[5rem] text-xs` (~line 187): add `density-compact:min-w-[4rem] density-compact:text-[0.625rem]`.
- Transition error `text-xs` (~line 192): add `density-compact:text-[0.625rem]`.

Leave the `statusPillClass` call sites (`TaskCard.tsx:247`, `StoryHeaderRow.tsx:184`) exactly as they are — its docblock forbids callers adding `px-*`/`py-*`/`text-xs`/`min-w-*`, and it stays a direct child of a flex row so its `min-w-[5.5rem] text-center` still holds. Its `py-0.5 text-xs` line box becomes the compact row height floor; that is accepted.

Line numbers are approximate — locate each site by its class string, not by line number.
  </action>
  <verify>
    <automated>npx vitest run src/routes/dashboard/TaskCard.test.tsx && test "$(grep -c 'density-compact:' src/routes/dashboard/TaskCard.tsx)" -ge 10 && test "$(grep -c 'density-compact:' src/routes/dashboard/StoryHeaderRow.tsx)" -ge 10 && test "$(grep -oE 'density-compact:[a-z-]*\[[0-9.]+px\]' src/routes/dashboard/TaskCard.tsx src/routes/dashboard/StoryHeaderRow.tsx | grep -v 'max-w' | grep -v 'min-h' | wc -l | tr -d ' ')" = "0" && npx tsc --noEmit</automated>
  </verify>
  <done>TaskCard.tsx and StoryHeaderRow.tsx each carry 10+ `density-compact:` variants covering padding, gaps, font sizes and icon sizes; zero px-unit arbitrary values were introduced in those variants apart from the permitted `max-w`/`min-h` sizing values; TaskCard tests and typecheck pass; no base class value or `density-comfortable:` value was altered.</done>
</task>

<task type="auto">
  <name>Task 2: Tighten board columns and chrome, and measure the sticky header height</name>
  <files>src/routes/dashboard/SprintBoardTab.tsx, src/routes/dashboard/SprintGoalBanner.tsx, src/routes/dashboard/QuickFilterChipRow.tsx, src/routes/dashboard/SprintBoardSkeleton.tsx</files>
  <action>
Part A — replace the hardcoded sticky-header height in `src/routes/dashboard/SprintBoardTab.tsx`:

`const HEADER_HEIGHT = 37; // StoryHeaderRow height in px (py-2 + text = ~37)` (~line 415) drives the sticky push-out offset at ~lines 420-423. It is already wrong in compact mode today (`py-1` gives ~29px) and will be badly wrong after Task 1 (~22px), causing the pinned header to slide out early and jitter at swimlane boundaries. Replace the constant with a measurement taken from the ref that is already in scope in that scope block — `stickyHeaderInnerRef` (declared at ~line 877, typed at ~line 250, passed as a prop at ~line 218). Use `stickyHeaderInnerRef.current?.offsetHeight ?? 37`, keeping 37 only as the pre-mount fallback. This is density-proof and font-scale-proof. Do not otherwise change the push-out math.

Part B — add compact variants to the board's own markup in `src/routes/dashboard/SprintBoardTab.tsx`:
- `TransitionDropZone` (~line 183, `min-h-[80px] density-compact:min-h-[56px] density-comfortable:min-h-[96px]`): change the compact value to `density-compact:min-h-[40px]`, and add `density-compact:text-[0.625rem]` to its `text-xs` label.
- Column cell class string at **~line 533 AND ~line 708** — these two strings are byte-identical duplicates (533 is the virtualized path, 708 is the non-virtual fallback path that `SprintBoardTab.test.tsx` renders under jsdom). Apply the identical edit to **both** or compact mode will diverge between the two render paths. Change `density-compact:min-h-[56px]` to `density-compact:min-h-[40px]`, and add `density-compact:gap-1 density-compact:p-0.5`. Do **not** go to `p-0` (see constraint 6).
- Drop-zone stacks `gap-1` (~lines 539 and 552): add `density-compact:gap-0.5`.
- Header bar `h-10` (~line 1624, currently has no density variant at all): add `density-compact:h-7`.
- Header cell `px-3 gap-1.5` (~line 1633): add `density-compact:px-2 density-compact:gap-1`.
- Header labels `text-xs` (~lines 1635 and 1638): add `density-compact:text-[0.625rem]`.
- Refresh cluster `px-3 gap-2` (~line 1644): add `density-compact:px-2 density-compact:gap-1.5`.

Part C — board chrome above the grid (vertical-space competitors, both board-local):
- `src/routes/dashboard/SprintGoalBanner.tsx` (~line 18, `px-4 py-2`, no density variant): add `density-compact:py-1 density-compact:px-3`.
- `src/routes/dashboard/QuickFilterChipRow.tsx` (~line 44, `py-1.5 density-compact:py-1`): change the compact value to `density-compact:py-0.5`.
- Do **not** touch `src/components/UnifiedFilterBar.tsx` — it is already density-aware and shared app-wide (backlog and others).

Part D — keep skeletons in sync so load does not visibly jump. In `src/routes/dashboard/SprintBoardSkeleton.tsx`, add compact variants matching the new card geometry: `h-20` → add `density-compact:h-12`, `p-4` → add `density-compact:p-2`, `h-9` → add `density-compact:h-7`, `gap-3` → add `density-compact:gap-1.5`.

Leave `virtualizer.estimateSize: () => 120` (~line 280) as-is — `measureElement` corrects real heights and `getItemKey` is keyed by story key, so a first-paint scrollbar wobble self-corrects.

Line numbers are approximate — locate each site by its class string.
  </action>
  <verify>
    <automated>npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx && grep -q 'stickyHeaderInnerRef.current?.offsetHeight' src/routes/dashboard/SprintBoardTab.tsx && test "$(grep -c 'density-compact:min-h-\[40px\]' src/routes/dashboard/SprintBoardTab.tsx)" -eq 3 && test "$(grep -c 'density-compact:min-h-\[56px\]' src/routes/dashboard/SprintBoardTab.tsx)" -eq 0 && test "$(grep -oE 'density-compact:[a-z-]*\[[0-9.]+px\]' src/routes/dashboard/SprintBoardTab.tsx | grep -v 'min-h' | grep -v 'max-w' | wc -l | tr -d ' ')" = "0" && grep -q 'density-compact:' src/routes/dashboard/SprintGoalBanner.tsx && grep -q 'density-compact:' src/routes/dashboard/SprintBoardSkeleton.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/SprintBoardTab.tsx src/routes/dashboard/SprintGoalBanner.tsx src/routes/dashboard/QuickFilterChipRow.tsx src/routes/dashboard/SprintBoardSkeleton.tsx</automated>
  </verify>
  <done>`HEADER_HEIGHT` is replaced by a measured `offsetHeight` with a 37 fallback; all three `min-h-[56px]` compact values (drop zone + both duplicate column-cell strings) became `min-h-[40px]` with zero stragglers; header bar, banner, chip row and skeleton carry compact variants; only rem font sizes were introduced; SprintBoardTab tests, typecheck and biome pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Compact-density variants across the three board-local components (`TaskCard`, `StoryHeaderRow`, the column cells and `TransitionDropZone` in `SprintBoardTab`), plus the board header bar, sprint goal banner, quick filter chip row and load skeleton. The hardcoded 37px sticky-header offset was replaced by a live measurement.
  </what-built>
  <how-to-verify>
Run the app (`npm run tauri dev`) and open the sprint board, then:

1. Settings → Appearance → Density → **Compact**. Confirm the board is materially denser — rows and cards visibly shorter, noticeably more content on screen than before. Confirm nothing is cut off, clipped, or missing: every key, issue-type label, summary, priority icon, status pill, chip, avatar, epic pill and subtask count is still rendered.
2. Switch to **Default**, then **Comfortable**. Confirm **zero** visual change versus before this task — the locked constraint is that only compact shrinks.
3. Back in Compact, Settings → Appearance → Font scale → **sm**, then **xl**. Confirm board text scales with the setting in both directions. If any text stays fixed, a `px` value slipped into a compact variant.
4. Scroll a long board in compact mode and watch the pinned swimlane header push-out at swimlane boundaries — it should hand off cleanly with no jitter or early slide-out. (This validates the `HEADER_HEIGHT` fix.)
5. Drag a card in compact mode onto a transition drop zone. The 40px zone must still be an easy, reliable drop target.
6. Narrow the window as far as it goes. Confirm each story header row stays on **one line** (summary truncates first) and no column cell collapses to 0 width.
  </how-to-verify>
  <resume-signal>Type "approved", or describe what is still too large / what broke (include which density and font-scale you were in).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none introduced | Change is presentational Tailwind class additions plus one DOM measurement read; no new input, network, storage or privilege boundary is crossed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-cif-01 | Denial of Service | `stickyHeaderInnerRef.current?.offsetHeight` read in the scroll path | mitigate | Read is a single already-mounted-node property access guarded by optional chaining with a `?? 37` fallback; no loop, no layout write in the same frame, so no forced-reflow thrash or null crash |
| T-cif-02 | Tampering | npm/pip/cargo installs | mitigate | Not applicable — this plan installs no packages; no `package.json` change is permitted |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/TaskCard.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx` passes
- `npx tsc --noEmit` clean
- `npx biome check` flags no **new** files beyond the known ~16-diagnostic baseline
- `git diff` shows only *added* `density-compact:` tokens plus the two permitted compact-value retunes (`py-1`→`py-0.5`, `min-h-[56px]`→`min-h-[40px]`) and the `HEADER_HEIGHT` replacement — no base class and no `density-comfortable:` value modified
- `git diff -- package.json` is empty
- Human verification checkpoint approved
</verification>

<success_criteria>
- Compact-mode sprint board rows and cards are materially shorter; measurably more cards fit in the same viewport
- Default and comfortable density render identically to before
- No board content is hidden or dropped at any density
- Compact font sizes respond to the `data-font-scale` setting (all rem, no px)
- Sticky swimlane header push-out is correct at every density and font scale
- Drop zones remain reliable drag targets in compact mode
- Story header rows stay on one line at narrow widths; no column collapses to 0 width
</success_criteria>

<output>
Create `.planning/quick/260922-cif-on-sprint-board-the-text-cards-and-every/260922-cif-SUMMARY.md` when done
</output>
