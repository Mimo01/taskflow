---
phase: quick
plan: 260317-wes
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/main.tsx
autonomous: true
requirements: [QUICK-260317-wes]
must_haves:
  truths:
    - "Sidebar no longer shows a Create Issue button"
    - "Create Issue still works from Command Palette (Cmd+K)"
    - "App compiles with zero TypeScript errors"
  artifacts:
    - path: "taskflow/src/components/app/Sidebar.tsx"
      provides: "Sidebar without Create Issue button"
  key_links:
    - from: "taskflow/src/components/app/CommandPalette.tsx"
      to: "onOpenCreate"
      via: "prop from main.tsx"
      pattern: "onOpenCreate"
---

<objective>
Remove the "Create Issue" button from the Sidebar component while keeping Create Issue available everywhere else (Command Palette, shortcuts).

Purpose: Declutter the sidebar navigation — Create Issue is accessible via Cmd+K command palette.
Output: Sidebar without Create Issue button, clean prop removal.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/components/app/Sidebar.tsx
@taskflow/src/main.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Create Issue button from Sidebar</name>
  <files>taskflow/src/components/app/Sidebar.tsx, taskflow/src/main.tsx</files>
  <action>
In Sidebar.tsx:
1. Remove the `onOpenCreate` prop from the `SidebarProps` interface (line 47) and from the destructured props (line 50). If `SidebarProps` becomes empty, remove the interface entirely and type the component as `export default function Sidebar()`.
2. Remove the Create Issue button block (lines 94-102): the `<button>` with `onClick={onOpenCreate}` and its children.
3. Remove the `PlusSquare` import from lucide-react (line 25) since it is no longer used.

In main.tsx:
4. Remove the `onOpenCreate={handleOpenCreate}` prop from the `<Sidebar>` call (line 371). Keep `handleOpenCreate` itself — it is still used by CommandPalette (line 404).

Do NOT touch CommandPalette.tsx — it keeps its onOpenCreate prop and create-issue action.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Sidebar renders without Create Issue button. TypeScript compiles cleanly. Command Palette still has Create Issue action.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` passes with zero errors
- Grep for "Create Issue" in Sidebar.tsx returns no results
- Grep for "onOpenCreate" in Sidebar.tsx returns no results
- Grep for "onOpenCreate" in CommandPalette.tsx still returns results (unchanged)
</verification>

<success_criteria>
- Sidebar has no Create Issue button
- Command Palette retains Create Issue action
- Zero TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260317-wes-remove-create-issue-from-the-sidebar-kee/260317-wes-SUMMARY.md`
</output>
