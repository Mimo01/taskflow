# Quick 261112-eep: Subtask create split control in Subtasks header - Research

**Researched:** 2026-11-12
**Domain:** In-repo UI composition (Base UI Menu + shared Button), no new packages
**Confidence:** HIGH (all findings verified by reading code in this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Empty state**
- Always render the "Subtasks" heading row (count suffix "(N)" only when N > 0).
- When the story has no subtasks, show a muted italic "No subtasks" line under the heading
  (same style as epic's "No stories in this epic": `text-sm text-muted-foreground italic`).
- Do NOT show "No subtasks" while subtasks exist but enrichment is loading (skeleton handles that).

**Create control (header right side)**
- User selected: single **split control**: primary "Add subtask" (Plus icon) action + a chevron
  dropdown containing "Bulk create subtasks…" (LayoutList icon). Use existing components/ui/button.tsx
  + dropdown-menu.tsx (no new split-button primitive exists, so build it inline or as a tiny local component).
- Style must match the issue-detail local button row: `variant="outline" size="sm"`, `text-xs`, `size-3.5` icons.
- User may still switch to two separate buttons after seeing it. Keep the control isolated in one small
  component so swapping is a trivial change.
- Header row layout follows the Activity / Progress precedent:
  `<div className="flex items-center justify-between mb-2">` + `<h3 className="text-sm font-medium text-muted-foreground">`.
  Header row height must not jump between empty/non-empty states; the buttons must not inflate the
  heading's vertical spacing vs other sections.

### Claude's Discretion
- Exact split-button seam styling (joined outline buttons, shared border).
- Narrow-width behaviour (label may collapse to icon via @container like the action row's
  COMPACT_ACTION_CLASS / COMPACT_LABEL_CLASS, if needed).
- Keep BulkCreateSubtasksModal wiring and onAddSubtask callback behaviour unchanged.

### Deferred Ideas (OUT OF SCOPE)
None listed.
</user_constraints>

## Project Constraints (from CLAUDE.md / memory)
- App code, vitest, and biome run in `taskflow/taskflow/`; `.planning` and git live in the outer `taskflow/`.
- Pre-commit hook runs the full vitest suite plus biome; lint errors block commits. Do not run `biome --write` over all of `src`. Lint only the touched files.
- "Match the local button row": the new control uses outline style like Refresh/Edit/Open in Jira.
- "Detail pages: no card panels": the section stays `h3` + content, no Card.
- Tailwind v4 `space-y` pitfall: a child's own `-my-*`/`m*` overrides `space-y`. The section is a direct child of `space-y-6` (IssueDetailContent.tsx:265), so put no margin on `<section>`.
- `not-sr-only` undoes `truncate`: if you collapse the label with `@[N]:not-sr-only`, add `@[N]:truncate`.

## Findings

### 1. DropdownMenuTrigger + Button composition
- `DropdownMenuTrigger` wraps Base UI `Menu.Trigger` (dropdown-menu.tsx:13-21). Use the Base UI **`render` prop**, not `asChild` (no `asChild` exists in this wrapper).
- `DropdownMenuContent` accepts `align` / `side` / `sideOffset` / `alignOffset` (dropdown-menu.tsx:23-34). Defaults are `align='start'` and `sideOffset=4`. Pass **`align="end"`** so the menu right-aligns under the chevron.
- In-repo precedents for an outline Button as the trigger:
  - `release-detail/DeploymentPackageSection.tsx:457-483`: `<DropdownMenuTrigger render={<Button type="button" variant="outline" size="xs" … aria-label="Choose a fix" />}>Apply<ChevronDown aria-hidden /></DropdownMenuTrigger>` + `<DropdownMenuContent align="end">` + `DropdownMenuItem className="cursor-pointer text-xs" onClick={…}`.
  - `release-detail/NotCoveredFixActions.tsx:63-90`: the same pattern.
- The outline variant already styles the open state (`aria-expanded:bg-muted aria-expanded:text-foreground`, button.tsx:11-12). The chevron half therefore shows pressed while the menu is open, with no extra code.
- `DropdownMenuItem` sets `[&_svg:not([class*='size-'])]:size-4` and `gap-1.5` (dropdown-menu.tsx:94). Give the LayoutList icon an explicit `size-3.5` and the item `text-xs cursor-pointer`, matching the precedent.

### 2. Joined split button
- **Precedent in the same file:** "Open in Jira | Copy link" at IssueDetailContent.tsx:494-520:
  `<div className="inline-flex items-stretch">` > left `Button variant="outline" size="sm" className="gap-1.5 rounded-r-none border-r-0 text-xs"` > right `Button variant="outline" size="icon-sm" className="rounded-l-none"`. Copy this pattern exactly so the two controls look the same.
- No other `rounded-r-none` / `rounded-l-none` / `-ml-px` usages in `src`. No ButtonGroup component exists. button.tsx has `in-data-[slot=button-group]:rounded-lg` hooks, but nothing uses them, so ignore them.
- Seam: `border-r-0` on the primary half, so the chevron's left border forms the single 1px divider. Do not use `-ml-px` (it differs from the precedent and adds a margin).
- Focus ring: `focus-visible:ring-3` on the left half is partly painted over by the later sibling. The existing precedent accepts this. Optional improvement: add `relative focus-visible:z-10` to both halves. This is harmless, but keep it consistent if you add it (you can leave the Jira pair as is).
- Chevron half: `size="icon-sm"` (size-7, button.tsx:30-31), `rounded-l-none`, `<ChevronDown className="size-3.5" />`, plus `aria-label="More subtask actions"` and a matching `title`. `ChevronDown` comes from lucide-react, which is already a dependency.

### 3. Height / size
- `h3 text-sm` gives a 20px line box. Sizes from button.tsx: `xs` = `h-6` (24px, :25), `sm` = `h-7` (28px, :27), `icon-xs` = `size-6`, `icon-sm` = `size-7`.
- The precedents keep header rows at 20px: Activity uses chips, and Progress uses `px-2 py-0.5 text-xs` buttons (EpicProgressSection.tsx:362-376, about 20px). So **`size="sm"` inflates the row by 8px** (28 vs 20). `xs` inflates it by 4px.
- **There is a tension in the locked decisions** ("size=sm" vs "must not inflate"). Recommendation that satisfies both:
  - Keep `size="sm"` / `icon-sm` so the control matches the action row and the Jira split.
  - Header row: `flex h-7 items-center justify-between mb-1`. It renders the same in empty and non-empty states, so there is no jump. The total vertical footprint is 28 + 4 = 32px, versus 20 + 8 = 28px for other sections (+4px, barely visible).
  - Zero-inflation alternative to show at UAT if the user objects: `size="xs"` / `icon-xs` with explicit `text-xs` and `size-3.5` icons, plus `h-6 mb-1`, which gives exactly 28px. Do not use a negative-margin (`-my-1`) hack (memory pitfall).
- Narrow widths: the section spans the full content width. The action row already collapses at `@[600px]`. The split control is only about 130px wide, so no `@container` collapse is needed. If one is added, label it `sr-only @[Npx]:not-sr-only @[Npx]:truncate`.

### 4. Tests affected
- `src/routes/dashboard/IssueDetailContent.test.tsx` (488 lines). **No existing test asserts "Add subtask", "Bulk Create Subtasks", onAddSubtask, bulkCreateOpen, or "No subtasks"** (grep across `src` found none). The only subtask-list test, DETAIL-02 (:237-267), uses `getByText('PROJ-11').closest('button')`. Moving buttons into the header does not break it, but the extra header buttons must not contain the text "PROJ-11".
- `BulkCreateSubtasksModal` is **not mocked** in this test file. It renders with `open={false}`, which is safe. If a new test opens it, you may need to mock it (`vi.mock('./BulkCreateSubtasksModal', …)`) to avoid its queries.
- How tests open Base UI menus in this repo: `fireEvent.click(screen.getByRole('button', { name: 'Choose a fix' }))` then `await screen.findAllByRole('menuitem')` (DeploymentPackageSection.test.tsx:318-321). `userEvent` is also imported in IssueDetailContent.test.tsx:64.
- New tests to add (story fixture `makeStoryIssue`, :96):
  1. `makeStoryIssue([])` with no `enrichedSubtasks`: heading "Subtasks" (no count) plus "No subtasks" are visible. With the current code this renders nothing, so the test fails before the fix.
  2. With subtasks: heading "Subtasks (1)" and no "No subtasks" text.
  3. Subtasks present, `enrichedSubtasks` undefined, `showSubtasksSkeleton`: skeleton shown, no "No subtasks".
  4. Clicking "Add subtask" calls `onAddSubtask('PROJ-…')`. Clicking the chevron and then the menuitem "Bulk create subtasks…" opens the modal (assert the modal's dialog or title, or a mocked modal's `open` prop).

### 5. Pitfalls
- **Enrichment never resolves for empty stories.** The enrichment query is `enabled:false` when `subtasks.length === 0`, so `enrichedSubtasks` stays `undefined` forever (comment at IssueDetailContent.tsx:335-338). The current `subtaskListContent` (:119-123) shows "No subtasks." only when `enrichedSubtasks !== undefined`, so it **never shows today** for stories without subtasks. The new rule must use the base field: **show "No subtasks" iff `subtasks.length === 0`**, independent of enrichment state.
- Heading count: compute it from `subtasks.length` (base field, synchronous), not `displaySubtasks`, so the label does not change when enrichment lands. Show `(N)` only when N > 0.
- Move the `<h3>` out of `subtaskListContent` into the new header row so it renders in all states (empty, skeleton, error, list).
- `SubtasksSkeleton` (issue-detail/SubtasksSkeleton.tsx) starts with an `h-6 w-40` heading-placeholder bar. Once the real heading always renders, drop that first bar, or it looks like a double heading.
- Text: use "No subtasks" with no trailing period, matching the epic's "No stories in this epic" (:308). The current string is "No subtasks.".
- Keep `<BulkCreateSubtasksModal open={bulkCreateOpen} …>` and `onAddSubtask?.(issueKey)` unchanged. Put the split control in a small local component (e.g. `SubtaskCreateControl({ onAdd, onBulk })`), so switching back to two buttons is a one-component change.
- Remove the old bottom `div.mt-1` button row (:350-371).

## Recommended shape (sketch)
```tsx
<section>
  <div className="flex h-7 items-center justify-between mb-1">
    <h3 className="text-sm font-medium text-muted-foreground">
      Subtasks{subtasks.length > 0 ? ` (${subtasks.length})` : ''}
    </h3>
    <SubtaskCreateControl onAdd={() => onAddSubtask?.(issueKey)} onBulk={() => setBulkCreateOpen(true)} />
  </div>
  {/* skeleton / error / list unchanged (list fn no longer renders h3) */}
  {subtasks.length === 0 && <p className="text-sm text-muted-foreground italic">No subtasks</p>}
  <BulkCreateSubtasksModal … />
</section>

function SubtaskCreateControl({ onAdd, onBulk }) {
  return (
    <div className="inline-flex items-stretch">
      <Button type="button" variant="outline" size="sm" onClick={onAdd}
        className="gap-1.5 rounded-r-none border-r-0 text-xs">
        <Plus className="size-3.5" />Add subtask
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm"
          className="rounded-l-none" aria-label="More subtask actions" title="More subtask actions" />}>
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer text-xs" onClick={onBulk}>
            <LayoutList className="size-3.5" />Bulk create subtasks…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

## Package Legitimacy Audit
No new packages. lucide-react `ChevronDown`, `@base-ui/react/menu`, and the shared Button are already used in the repo.

## Validation Architecture
- Framework: vitest + @testing-library/react (in `taskflow/taskflow`).
- Quick: `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailContent.test.tsx`
- Lint touched files only: `npx biome check src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx src/routes/dashboard/IssueDetailContent.test.tsx`
- Write each new test RED+GREEN in one commit (the pre-commit hook blocks RED commits).
- Manual UAT: open a story with 0 subtasks and one with N subtasks. Confirm the header height is the same in both and the menu aligns to the right edge.

## Security Domain
Not applicable (presentational change, no new input or data paths).

## Assumptions Log
| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | User accepts +4px header with `size="sm"` (vs exact parity with `xs`) | Low. Swap to the `xs` variant noted in §3 |

## Sources
Code read this session: IssueDetailContent.tsx (:108-150, :265, :332-379, :494-531), button.tsx, dropdown-menu.tsx, DeploymentPackageSection.tsx:457-483, DeploymentPackageSection.test.tsx:318-321, NotCoveredFixActions.tsx:63-90, FieldsSection.tsx:873-881, EpicProgressSection.tsx:360-380, ActivityTimeline.tsx:148-155, SubtasksSkeleton.tsx, IssueDetailContent.test.tsx.
