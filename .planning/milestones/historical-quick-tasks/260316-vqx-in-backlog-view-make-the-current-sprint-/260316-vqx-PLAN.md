---
phase: quick
plan: 260316-vqx
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Active sprint section header sticks to the top of the scroll area when user scrolls past it"
    - "Other sprint headers (future, backlog) do NOT stick — only the active sprint"
    - "Sticky header does not overlap or obscure content when scrolling back up"
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      provides: "Sticky active sprint header via CSS position sticky"
  key_links: []
---

<objective>
Make the active sprint section header in the backlog view stick to the top of the scroll container as the user scrolls down, so they always know which sprint they are looking at.

Purpose: When the backlog has many issues, scrolling down loses sight of which sprint section you are in. Sticky header keeps context visible.
Output: Active sprint header sticks to top of scrollable area during scroll.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/BacklogPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sticky positioning to active sprint section header</name>
  <files>taskflow/src/routes/dashboard/BacklogPage.tsx</files>
  <action>
In the `renderSection` function, conditionally apply `position: sticky; top: 0; z-index: 5;` to the section header button ONLY when the section's badge is 'Active' (i.e., it is the active sprint).

Implementation:
1. Add a new parameter `isSticky: boolean` to the `renderSection` function.
2. On the section header `<button>`, conditionally add Tailwind classes `sticky top-0 z-[5]` when `isSticky` is true. The header already has `bg-muted/40` which provides a background — change it to an opaque background when sticky to prevent content showing through. Use `bg-muted` (fully opaque) instead of `bg-muted/40` when sticky, so scrolling content does not bleed through.
3. In the sprint sections `.map()` call (around line 432), pass `isSticky: sprint.state === 'active'` so only the active sprint gets the sticky header.
4. In the backlog section `renderSection` call (around line 443), pass `isSticky: false`.

The sticky positioning works relative to the nearest scroll ancestor, which is the `div.flex-1.overflow-auto` container on line 397. The header will stick to `top: 0` of that scroll container.

Add a subtle bottom shadow to the sticky header when it is stuck, using `shadow-[0_1px_3px_rgba(0,0,0,0.1)]` for a polished look that signals the header is floating above content.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Active sprint section header has sticky top-0 z-[5] classes with opaque background and subtle shadow. Future sprint and backlog section headers do NOT have sticky positioning. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` passes with no errors
- Visual: Open backlog view, scroll down within active sprint issues — the "Sprint X [Active]" header remains pinned at top of scroll area
- Visual: Scroll into future sprint or backlog section — those headers scroll normally, not sticky
</verification>

<success_criteria>
Active sprint header sticks to top of scroll container. Other section headers scroll normally. No visual bleed-through of content behind the sticky header.
</success_criteria>

<output>
After completion, create `.planning/quick/260316-vqx-in-backlog-view-make-the-current-sprint-/260316-vqx-SUMMARY.md`
</output>
