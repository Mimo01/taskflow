---
phase: quick-261119-rgb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx
  - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx
  - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx
  - taskflow/src/components/wiki-editor/toolbar/OverflowMenu.tsx
  - taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts
  - taskflow/src/components/wiki-editor/toolbar/toolbar-config.test.ts
  - taskflow/src/components/wiki-editor/toolbar/Toolbar.test.tsx
  - taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx
  - taskflow/src/components/wiki-editor/nodeviews/nodeviews.test.tsx
  - taskflow/src/components/ui/searchable-select.tsx
autonomous: true
requirements: [QUICK-261119-rgb]

must_haves:
  truths:
    - "The full-preset toolbar's top corners follow the frame's rounded border; no square background pokes over the rounded border, and scrolled content never shows in the corners"
    - "A pressed Bold/Italic/... button (main, bubble and table toolbars) is clearly distinguishable from an unpressed one and from hover, in light and dark themes, without brand colour"
    - "The ⋯ More menu sits directly after the inline formatting items, followed by a divider, then + Insert; the divider only renders when More renders"
    - "Overflow breakpoints are re-derived for the extra 13px divider; every inline set still fits the items region (lockstep test passes)"
    - "The code block header is a quiet strip: borderless ghost language trigger (label only, small chevron, hover fill) aligned with the code text; Noformat label aligned the same way"
  artifacts:
    - path: "taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx"
      provides: "Stronger neutral pressed style"
      contains: "ring-inset"
    - path: "taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts"
      provides: "Breakpoints shifted +16 (except the widest) for the More|Insert divider"
      contains: "strike: 676"
    - path: "taskflow/src/components/ui/searchable-select.tsx"
      provides: "Optional ghost trigger variant"
      contains: "variant"
  key_links:
    - from: "taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx"
      to: "SearchableSelect"
      via: "variant=\"ghost\" prop"
      pattern: "variant=\"ghost\""
    - from: "taskflow/src/components/wiki-editor/toolbar/toolbar-config.test.ts"
      to: "OVERFLOW_BREAKPOINTS"
      via: "fit test with pinned +13 when More is shown"
      pattern: "13"
---

<objective>
Polish the wiki editor visuals per the user's four complaints: (1) square toolbar corners over the frame's rounded border, (2) barely visible pressed state on formatting buttons, (3) "+ Insert" sitting before "⋯" so overflowed formatting (sub/sup) feels detached from the formatting, (4) an unpolished bordered language select squeezed into the code block header.

Purpose: The editor is a daily-use surface; these are all visible-at-a-glance roughness.
Output: Updated toolbar/frame/code-block styling, toolbar reorder with re-derived breakpoints, a minimal `variant` prop on the shared SearchableSelect, tests updated.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Repo layout: `.planning/` and git live at /Users/mimo/Documents/Projects/taskflow; app source, npm, vitest, biome, tsc run from the inner /Users/mimo/Documents/Projects/taskflow/taskflow. All paths below are relative to the inner app dir.

@.planning/STATE.md
@taskflow/src/components/wiki-editor/WikiEditor.tsx
@taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx
@taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts
@taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx
@taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx
@taskflow/src/components/ui/searchable-select.tsx

Facts established during planning (do not re-derive):
- `src/index.css`: `--accent` == `--muted` in BOTH themes (light 0.97/0.97, dark 0.269/0.269). The current pressed class `bg-accent text-accent-foreground` therefore equals the ghost hover (`hover:bg-muted`) and nearly equals the toolbar's muted-mixed background — that is why pressed is invisible. `--primary` is neutral (near-black / near-white), but a primary fill is too heavy; use a neutral foreground-alpha fill + hairline ring.
- Frame (WikiEditor.tsx ~606): `rounded-lg border border-input ...` with NO overflow-hidden (must stay that way: sticky toolbar + TableToolbar positioning). Its only children are the scroller `div.relative.overflow-auto` (contains sticky Toolbar first in full preset; BubbleToolbar/banners/content in compact), then CompactFooter (compact only, no bg — fine), then AttachmentPickerModal (portal). Inner radius = `calc(var(--radius-lg) - 1px)`.
- Banners (saveError / notice) have no background, so they don't need rounding. CompactFooter has no background.
- Toolbar `Divider` = `mx-1 w-px` (9px) + `gap-1` (4px) = 13px.
- Fit-test model (toolbar-config.test.ts): pinned = 214 (+37 Insert label at widest, -4 inline Link, -32 empty More). Adding a divider after More makes pinned +13 whenever More renders (the divider is hidden with More, so the no-overflow case is unchanged and the widest breakpoint / INSERT_LABEL_CLASS stay the same).
- Planner simulated the fit test: shifting every breakpoint EXCEPT the widest by +16 (keeps clean quarter-rem values) passes for compact from 358px and for full from 372px (Text style + Bold alone now need 371px; previously 358). Shifting by +13 also passes but gives x.0625rem values — use +16.
  - full: subsup 732 (unchanged), strike 676, mono 644, quote 612, colour 580, link 548, numbered 516, bullet 484, underline 444, italic 412
  - compact: strike 484 and mono 484 (both widest, unchanged), bullet 468, numbered 396, underline 364, italic 332
  - INLINE_CLASS rem = px/16: full 45.75 / 42.25 / 40.25 / 38.25 / 36.25 / 34.25 / 32.25 / 30.25 / 27.75 / 25.75; compact 30.25 / 30.25 / 29.25 / 24.75 / 22.75 / 20.75
  - INSERT_LABEL_CLASS unchanged (full `@[45.75rem]`, compact `@[30.25rem]`).
- Code frame `WIKI_CODE_FRAME` (prose.ts) is already `overflow-hidden rounded-md`, so the header's corners are clipped correctly; do NOT change WIKI_CODE_FRAME (shared with the read-only WikiRenderer). The pre body uses `p-3` (density-compact p-2, comfortable p-4).
- SearchableSelect trigger renders `selected.detail` (e.g. mono "java") next to the label and has `w-full`, a border, and `h-8` — in the code header that becomes a full-width bordered box. Tests reference it via `aria-label="Code language"` and `textContent` containing the label (nodeviews.test.tsx).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Round the toolbar/scroller top to the frame and make pressed buttons clearly visible</name>
  <files>taskflow/src/components/wiki-editor/WikiEditor.tsx, taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx, taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx, taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx</files>
  <action>
Corners (orchestrator direction 1): In Toolbar.tsx add `rounded-t-[calc(var(--radius-lg)-1px)]` to the root `role="toolbar"` div's className (keep everything else). In WikiEditor.tsx give the scroller `div` (`cn('relative overflow-auto', maxClass)`) a matching radius so content scrolled under the sticky toolbar is clipped at the corners: full preset → `rounded-[calc(var(--radius-lg)-1px)]` (it is the frame's only painted child, so all four corners); compact preset → `rounded-t-[calc(var(--radius-lg)-1px)]` only (CompactFooter sits below it). The scroller already has overflow-auto, so a radius adds no new clipping of popovers (they portal) and does not affect sticky. Do NOT add overflow-hidden to the frame. Use plain literal class strings (Tailwind v4 scanner).

Pressed state (direction 2): in ToolbarButton.tsx replace `pressed && 'bg-accent text-accent-foreground'` with a neutral, theme-safe stronger state: `bg-foreground/10 text-foreground ring-1 ring-inset ring-foreground/15 hover:bg-foreground/15 dark:bg-foreground/15 dark:hover:bg-foreground/20` (rationale: accent==muted in this theme so it equals hover; foreground-alpha fill + hairline inset ring is clearly visible on the muted toolbar and in the popover-bg bubble/table toolbars, stays colourless per user preference that colour is for status). Export the class string as a named const `TOOLBAR_PRESSED_CLASS` from ToolbarButton.tsx so tests (and any future user) share it. Hover stays the ghost `hover:bg-muted`, which is lighter than the pressed fill and has no ring. BubbleToolbar and TableToolbar already use ToolbarButton — no edits needed there; grep `bg-accent` under src/components/wiki-editor/toolbar to confirm no other pressed-style copy exists for formatting buttons (ModeToggle's segmented control is out of scope — leave it).

Test: in ToolbarButton.test.tsx extend the pressed test to assert the button's className contains `ring-inset` and `bg-foreground/10` when `pressed`, and does not contain `ring-inset` when pressed is false/undefined.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/wiki-editor/toolbar && npx biome check src/components/wiki-editor/WikiEditor.tsx src/components/wiki-editor/toolbar/Toolbar.tsx src/components/wiki-editor/toolbar/ToolbarButton.tsx src/components/wiki-editor/toolbar/ToolbarButton.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Toolbar root carries the rounded-t inner radius; scroller is rounded per preset; pressed ToolbarButtons use TOOLBAR_PRESSED_CLASS (foreground-alpha fill + inset ring); toolbar tests, biome and tsc pass.</done>
</task>

<task type="auto">
  <name>Task 2: Move ⋯ More before a divider and + Insert; re-derive breakpoints in lockstep</name>
  <files>taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx, taskflow/src/components/wiki-editor/toolbar/OverflowMenu.tsx, taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts, taskflow/src/components/wiki-editor/toolbar/toolbar-config.test.ts, taskflow/src/components/wiki-editor/toolbar/Toolbar.test.tsx</files>
  <action>
Order (direction 3): in Toolbar.tsx the pinned sequence after the `data-toolbar-items` region becomes: (a) the overflowed-link hidden anchor `LinkPopover` (when `showLink && linkOverflowed`), (b) `<OverflowMenu items={overflowItems} />`, (c) `<Divider />` rendered only when `overflowItems.length > 0` (so it disappears together with More — this keeps the no-overflow width unchanged), (d) `<InsertMenu …/>`, then the existing flex-1 spacer, preview toggle and ModeToggle unchanged. Note: in source mode the colour item maps to no overflow entry, so gate the divider on `overflowItems.length`, the same thing OverflowMenu gates on. In OverflowMenu.tsx change `DropdownMenuContent align="end"` to `align="start"` since More now sits mid-bar next to the formatting it holds.

Breakpoints (lockstep): in toolbar-config.ts set OVERFLOW_BREAKPOINTS, INLINE_CLASS exactly to the values in the context section (full: subsup 732, strike 676, mono 644, quote 612, colour 580, link 548, numbered 516, bullet 484, underline 444, italic 412; compact: strike 484, mono 484, bullet 468, numbered 396, underline 364, italic 332; rem = px/16). INSERT_LABEL_CLASS stays as is. Edit the values one by one (no bulk find-replace). Update the doc comment: pinned controls 214px plus the 13px More|Insert divider whenever More shows (so -45 instead of -32 when More is empty), +37 Insert label, -4 inline Link; breakpoints except the widest moved +16 for the divider (rounded to quarter-rem); below ~371px Text style + Bold alone overflow (full).

Tests: in toolbar-config.test.ts update the fit test model — comment mentions the divider; `pinned` adds 13 when `overflow.length > 0` (keep the existing -32 for empty More); start the loop at 372 for full and 358 for compact (e.g. `const from = preset === 'full' ? 372 : 358`) and rename the it() text accordingly. Leave the INLINE_CLASS/INSERT_LABEL lockstep tests as they are (they must pass with the new values). Fix any existing splitToolbar expectation in that file that depends on old numbers (e.g. `splitToolbar('compact', 360)` — recompute from the new table; at 360 compact: italic 332 inline, underline 364 overflow, so overflow = ['strike','mono','bullet','numbered','underline']). In Toolbar.test.tsx add a test: at 360 (`at360()`), the More button precedes the Insert button in document order (`compareDocumentPosition` & DOCUMENT_POSITION_FOLLOWING) and an `[aria-hidden="true"].w-px` divider element sits between them outside the items region; and with no width measured (overflow empty, More absent) there is no divider directly before Insert. Existing "outside the shrinking items region" and "Full at 360" tests must stay green.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/wiki-editor && npx biome check src/components/wiki-editor/toolbar && npx tsc --noEmit</automated>
  </verify>
  <done>DOM order is items → [link anchor] → More → divider → Insert → spacer → mode controls; divider absent when More is absent; OVERFLOW_BREAKPOINTS/INLINE_CLASS/comment/test model updated in lockstep; all wiki-editor tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Quiet code block header with a ghost language trigger</name>
  <files>taskflow/src/components/ui/searchable-select.tsx, taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx, taskflow/src/components/wiki-editor/nodeviews/nodeviews.test.tsx</files>
  <action>
SearchableSelect (direction 4 — minimal optional prop, no fork): add `variant?: 'default' | 'ghost'` (default `'default'`, documented in the props JSDoc). For `'ghost'` the trigger class is a quiet inline control instead of the bordered field: `inline-flex h-6 w-auto max-w-full items-center gap-1 rounded-md border-0 bg-transparent px-1.5 text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground data-[popup-open]:bg-foreground/5 data-[popup-open]:text-foreground` plus the existing focus-visible ring and disabled classes; the selected `detail` is NOT rendered inside a ghost trigger (label only — the detail still shows in the popup rows), and the chevron is `size-3.5 opacity-60`. Build the trigger class with `cn(variant === 'ghost' ? GHOST : DEFAULT, className)` where DEFAULT is the current string unchanged, so every existing caller renders identically. Popup content is unchanged for both variants.

CodeBlockView.tsx: header div becomes `flex h-8 items-center border-b border-border/60 bg-muted/60 px-1.5 text-xs text-muted-foreground density-compact:h-7` (slightly taller, tone closer to the `bg-muted/40` body so it reads as one frame; the frame's own overflow-hidden rounded-md already rounds its top). Pass `variant="ghost"` to SearchableSelect and drop the `className="h-6 text-xs"`. The Noformat label becomes `<span className="px-1.5">Noformat</span>` so its text lines up with the trigger text at 12px from the frame edge, matching the code body's p-3. Do not touch WIKI_CODE_FRAME / WIKI_CODE_PRE (shared with the read-only renderer).

Test: in nodeviews.test.tsx extend "shows a language select" to assert the trigger text is the label only (`textContent` contains 'Java' and does not contain the mono detail 'java' as a separate token — e.g. assert `select.textContent?.trim()` equals 'Java'), and that the trigger className does not contain `border-input`. Check whether any other test file asserts SearchableSelect's trigger classes or detail rendering (grep `searchable-select-trigger` under src) and keep them green — default variant must be byte-identical.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/wiki-editor src/components/ui && npx biome check src/components/ui/searchable-select.tsx src/components/wiki-editor/nodeviews/CodeBlockView.tsx src/components/wiki-editor/nodeviews/nodeviews.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Code block header is h-8 quiet strip with a borderless label-only language trigger and an aligned Noformat label; SearchableSelect default variant unchanged for all other callers; tests, biome, tsc pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Styling, DOM order and a presentational prop only; no new input handling, network or storage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261119-01 | Denial of Service | toolbar overflow breakpoints | mitigate | Fit test in toolbar-config.test.ts proves no inline set is clipped at any width from the documented floor, so no control becomes unreachable |
| T-261119-02 | Tampering | SearchableSelect shared component | accept | Additive optional prop; default branch keeps the existing class string verbatim, existing tests guard other callers |
</threat_model>

<verification>
From /Users/mimo/Documents/Projects/taskflow/taskflow:
- `npx vitest run src/components/wiki-editor src/components/ui` green
- `npx biome check` on every touched file — no new diagnostics (do not run biome --write over src)
- `npx tsc --noEmit` clean
- Visual sanity for the user at UAT: open an issue description editor in light and dark — rounded toolbar corners, obvious Bold pressed state, ⋯ | + Insert order, quiet code language header.
</verification>

<success_criteria>
- No square toolbar background over the rounded frame border (full preset); scroller clips scrolled content at the corners
- Pressed formatting buttons are clearly visible and distinct from hover in both themes, colourless
- More sits right after the formatting items, then a divider, then Insert; breakpoints, INLINE_CLASS, comment and fit test updated in lockstep
- Code block header uses a ghost label-only language trigger aligned with the code text; Noformat matches
</success_criteria>

<output>
Create `.planning/quick/261119-rgb-polish-wiki-editor-toolbar-visuals/261119-rgb-SUMMARY.md` when done
</output>
