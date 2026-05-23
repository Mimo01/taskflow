---
phase: quick-11
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/Sidebar.tsx
autonomous: true
requirements:
  - QUICK-11
must_haves:
  truths:
    - "The active nav link has a visually distinct background and text color"
    - "Non-active links retain their existing hover-only style"
    - "Active state updates immediately on navigation"
  artifacts:
    - path: taskflow/src/components/app/Sidebar.tsx
      provides: "Active-highlighted nav links using NavLink"
      contains: "NavLink"
  key_links:
    - from: taskflow/src/components/app/Sidebar.tsx
      to: react-router-dom NavLink
      via: "className ({ isActive }) callback"
      pattern: "isActive"
---

<objective>
Highlight the sidebar nav link that corresponds to the currently active route so users always know which page they are on.

Purpose: Visual orientation — users can tell at a glance where they are in the app.
Output: Updated Sidebar.tsx where the active link has a distinct background/text style.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch sidebar links to NavLink with active styling</name>
  <files>taskflow/src/components/app/Sidebar.tsx</files>
  <action>
Replace all `Link` imports and usages with `NavLink` from `react-router-dom`. Use NavLink's `className` prop (which accepts a function `({ isActive }) => string`) to apply active styling.

Concrete changes:

1. Change import: `import { NavLink } from 'react-router-dom';` (remove `Link`).

2. Define two class constants instead of one:
   ```ts
   const NAV_LINK_CLASS =
     'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
   const navLinkClass = ({ isActive }: { isActive: boolean }) =>
     isActive
       ? `${NAV_LINK_CLASS} bg-accent text-accent-foreground font-semibold`
       : `${NAV_LINK_CLASS} hover:bg-accent`;
   ```

3. Replace every `<Link to="..." className={NAV_LINK_CLASS}>` with `<NavLink to="..." className={navLinkClass}>`. This applies to all links: /dashboard, /my-tasks, /sprint-board, /mr-attention, /sprint-progress, /workload, /releases, /debug-logs, /settings.

4. Remove the `aria-label="Settings"` from the settings NavLink only if it was only there to compensate for missing text label — keep it as it improves accessibility regardless.

Do NOT change any icon sizes, gap, padding, border-radius, or transition classes. Only the active/hover color logic changes.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep -i "sidebar" || echo "No Sidebar TS errors"</automated>
  </verify>
  <done>Every nav link uses NavLink. Active link shows bg-accent + text-accent-foreground + font-semibold. Non-active links show hover:bg-accent only. TypeScript compiles with no new errors in Sidebar.tsx.</done>
</task>

</tasks>

<verification>
After implementation:
1. Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` — no new TypeScript errors.
2. Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --passWithNoTests 2>&1 | tail -5` — existing tests still pass.
</verification>

<success_criteria>
- NavLink replaces Link in Sidebar.tsx
- Active route link is visually distinct (bg-accent, text-accent-foreground, font-semibold)
- Inactive links retain hover-only style
- No TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/11-add-active-page-indicator-in-sidebar/11-SUMMARY.md`
</output>
