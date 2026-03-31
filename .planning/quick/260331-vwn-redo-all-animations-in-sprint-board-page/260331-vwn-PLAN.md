---
phase: quick-260331-vwn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/components/ui/sheet.tsx
autonomous: false
requirements: [ANIM-01, ANIM-02, ANIM-03]

must_haves:
  truths:
    - "Sticky swimlane header appears/disappears smoothly without flicker or jump on scroll"
    - "Story swimlane expand/collapse animates height smoothly instead of instant show/hide"
    - "Issue detail sheet slides in/out smoothly without choppy or cut-off animation"
    - "Page loads normally on reload — no stuck sticky header blocking interaction"
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "Smooth sticky header, animated swimlane collapse, fixed reload bug"
    - path: "taskflow/src/routes/dashboard/StoryHeaderRow.tsx"
      provides: "Chevron rotation animation on expand/collapse"
    - path: "taskflow/src/components/ui/sheet.tsx"
      provides: "Improved slide-in/out animation for detail sheet"
  key_links:
    - from: "SprintBoardTab.tsx sticky header overlay"
      to: "VirtualizedSwimlanes onStickyHeaderChange"
      via: "setStickyHeader state + CSS transition"
      pattern: "transition.*opacity.*transform"
    - from: "SprintBoardTab.tsx renderSwimlane"
      to: "collapsedStories state"
      via: "isExpanded grid-template-rows animation"
      pattern: "gridTemplateRows"
---

<objective>
Fix all three animation problems on the sprint board page:

1. **Sticky header flicker** — The sticky swimlane header overlay uses `transition-[max-height,opacity]` with `maxHeight: '60px'/'0px'` which causes layout thrash. Replace with a cleaner opacity+translateY approach that avoids max-height transitions entirely.

2. **Choppy swimlane expand/collapse** — Currently uses conditional rendering (`{isExpanded && (...)}`) which gives instant show/hide with no animation. Add CSS grid height animation (`grid-template-rows: 0fr/1fr`) for smooth collapse/expand of subtask cells.

3. **Stuck sticky header on reload** — On page reload, the browser may restore scroll position before the virtualizer is ready, causing the sticky header to render with stale state and visually block the page. Clear sticky header state on initial mount and when data transitions from loading to loaded.

4. **Sheet slide animation** — The detail sheet uses only 2.5rem translate which creates a subtle, clipped-feeling animation. Increase translate distance and adjust easing for a smoother feel.

Purpose: Eliminate visual jank and animation bugs that make the sprint board feel unpolished.
Output: Updated SprintBoardTab.tsx, StoryHeaderRow.tsx, and sheet.tsx with smooth, reliable animations.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
@taskflow/src/routes/dashboard/StoryHeaderRow.tsx
@taskflow/src/components/ui/sheet.tsx
@taskflow/src/routes/dashboard/SprintBoardSkeleton.tsx
@taskflow/src/hooks/useDelayedLoading.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix sticky header, add swimlane collapse animation, fix reload bug</name>
  <files>taskflow/src/routes/dashboard/SprintBoardTab.tsx, taskflow/src/routes/dashboard/StoryHeaderRow.tsx</files>
  <action>
**SprintBoardTab.tsx — Sticky header overlay (lines ~922-948):**

Replace the current `transition-[max-height,opacity]` approach with a cleaner transform-based animation:
- Remove `maxHeight` inline style entirely — max-height transitions cause layout thrash
- Use `opacity` + `translateY(-8px)` for the hidden state, `opacity-100 translateY(0)` for the visible state
- Apply `transition-[opacity,transform] duration-150 ease-out` on the sticky header overlay div
- Use `pointer-events-none` when `!stickyHeader` to prevent invisible header from capturing clicks
- Change the container to NOT conditionally render `{stickyHeader && (...)}` — instead always render the StoryHeaderRow wrapper but hide it with CSS when null. This avoids mount/unmount flicker. When `stickyHeader` is null, render an empty div with the same height to avoid layout shift.

Actual implementation: Change the overlay div (line ~922) to:
```
className="absolute top-0 left-0 right-0 z-[9] bg-background border-b border-border/30 overflow-hidden transition-[opacity,transform] duration-150 ease-out"
style={{
  opacity: stickyHeader ? 1 : 0,
  transform: stickyHeader ? 'translateY(0)' : 'translateY(-100%)',
  pointerEvents: stickyHeader ? 'auto' : 'none',
}}
```
Remove the old `maxHeight` style. Keep the `stickyHeader && (...)` conditional for the inner content since we need the data to render.

**SprintBoardTab.tsx — Swimlane expand/collapse animation (renderSwimlane function, lines ~282-338, and non-virtual fallback lines ~366-426):**

Replace the instant `{isExpanded && (...)}` with an animated CSS grid approach:
- Wrap the subtask cells div in an outer div with: `className="grid transition-[grid-template-rows] duration-200 ease-out"` and `style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}`
- The inner subtask cells div gets `className="overflow-hidden min-h-0"` (the `overflow-hidden` is critical — without it content leaks out during collapse)
- This applies to BOTH the virtual renderSwimlane function AND the non-virtual fallback
- Keep the existing `flex bg-muted/10` classes on the inner content div

**SprintBoardTab.tsx — Fix stuck header on reload:**

In the `SprintBoardTab` component, add a useEffect that clears sticky header state when `showSkeleton` transitions from true to false (data finished loading):
```typescript
// Clear stale sticky header when data finishes loading (fixes stuck header on reload)
const prevShowSkeletonRef = useRef(true);
useEffect(() => {
  if (prevShowSkeletonRef.current && !showSkeleton) {
    setStickyHeader(null);
    if (stickyHeaderInnerRef.current) {
      stickyHeaderInnerRef.current.style.transform = '';
    }
  }
  prevShowSkeletonRef.current = showSkeleton;
}, [showSkeleton]);
```

Also, in the `VirtualizedSwimlanes` useEffect that sets up the scroll listener (line ~168), add an explicit clear of the sticky header at the very start before setting up the listener:
```typescript
// Clear any stale sticky header from previous render/reload
if (lastStickyKeyRef.current !== null) {
  lastStickyKeyRef.current = null;
  onStickyHeaderChangeRef.current(null);
}
```
Move this BEFORE the `onScroll` function definition in that effect, so it runs on every re-mount.

**StoryHeaderRow.tsx — Animate chevron rotation:**

Replace the conditional `{isExpanded ? <ChevronDown .../> : <ChevronRight .../>}` with a single `ChevronRight` icon that rotates:
```tsx
<ChevronRight className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-90")} />
```
Remove the `ChevronDown` import since it is no longer needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Sticky header uses opacity+transform animation (no max-height)
    - Swimlane expand/collapse uses CSS grid height animation in both virtual and non-virtual paths
    - Sticky header clears on data load transition (reload fix)
    - Chevron rotates smoothly instead of swapping icons
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Improve sheet slide animation</name>
  <files>taskflow/src/components/ui/sheet.tsx</files>
  <action>
In `SheetContent` (line ~55), update the animation properties for a smoother, more noticeable slide:

1. Change the translate distance from `2.5rem` to `5rem` for all sides — this gives the sheet a more noticeable entrance and prevents the "barely moves" feeling:
   - `data-[side=right]:data-ending-style:translate-x-[5rem]` (was 2.5rem)
   - `data-[side=right]:data-starting-style:translate-x-[5rem]` (was 2.5rem)
   - `data-[side=left]:data-ending-style:translate-x-[-5rem]` (was -2.5rem)
   - `data-[side=left]:data-starting-style:translate-x-[-5rem]` (was -2.5rem)
   - `data-[side=top]:data-ending-style:translate-y-[-5rem]` (was -2.5rem)
   - `data-[side=top]:data-starting-style:translate-y-[-5rem]` (was -2.5rem)
   - `data-[side=bottom]:data-ending-style:translate-y-[5rem]` (was 2.5rem)
   - `data-[side=bottom]:data-starting-style:translate-y-[5rem]` (was 2.5rem)

2. Change the transition duration from `duration-200` to `duration-250` for a slightly more deliberate feel.

3. Change `ease-in-out` to `ease-out` for entry (starting-style resolves to resting state = entry) — ease-out feels snappier for entrances.

Keep the overlay backdrop transition at `duration-150` as-is — the overlay should appear slightly faster than the sheet to establish context.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Sheet slides in from further away (5rem instead of 2.5rem) for more visible animation
    - Easing changed to ease-out for snappier entry
    - Duration slightly longer (250ms) for smoother feel
    - All four side variants updated consistently
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 3: Verify all sprint board animations</name>
  <files>taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
Human verification of all animation changes. Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm run dev` to start the dev server, then verify visually in the browser.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
    User confirms: sticky headers smooth, swimlane collapse animated, no stuck header on reload, sheet slides smoothly. All tests pass.
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles: `cd taskflow && npx tsc --noEmit`
- Tests pass: `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20`
- No regressions in SprintBoardTab tests: `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx --reporter=verbose`
</verification>

<success_criteria>
- Sprint board loads cleanly on reload with no stuck header
- Sticky swimlane header transitions smoothly on scroll (no flicker, no layout jump)
- Swimlane expand/collapse animates height over ~200ms
- Chevron icon rotates instead of swapping
- Issue detail sheet slides in/out with visible, smooth animation
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260331-vwn-redo-all-animations-in-sprint-board-page/260331-vwn-SUMMARY.md`
</output>
