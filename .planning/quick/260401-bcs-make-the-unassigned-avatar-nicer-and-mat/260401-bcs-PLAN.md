---
phase: quick
plan: 260401-bcs
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/cached-avatar.tsx
  - taskflow/src/components/ui/cached-avatar.test.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Unassigned issues show a generic person silhouette icon in a muted circle, matching Jira's unassigned avatar style"
    - "All locations that display assignee handle null/unassigned consistently with the same avatar component"
  artifacts:
    - path: "taskflow/src/components/ui/cached-avatar.tsx"
      provides: "Unassigned avatar rendering with User icon from lucide-react"
  key_links:
    - from: "cached-avatar.tsx"
      to: "lucide-react User icon"
      via: "import and render when name is 'Unassigned' and url is null/undefined"
      pattern: "User.*lucide"
---

<objective>
Make the unassigned avatar match Jira's style -- show a generic person silhouette icon in a soft gray circle instead of showing "U" initials or plain "Unassigned" text. Apply consistently across all views.

Purpose: Visual polish to match Jira's native unassigned indicator.
Output: Updated CachedAvatar component and consistent usage across all views.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/components/ui/cached-avatar.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
@taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update CachedAvatar to show person icon for unassigned</name>
  <files>taskflow/src/components/ui/cached-avatar.tsx, taskflow/src/components/ui/cached-avatar.test.tsx</files>
  <action>
Modify CachedAvatar to detect unassigned state and render a person silhouette icon instead of "U" initials:

1. Import `User` icon from `lucide-react`.
2. When `url` is null/undefined AND `name` matches the unassigned pattern, render the `User` icon instead of initials text. The detection should be: if there is no url AND name is exactly "Unassigned" (case-insensitive check). Do NOT change behavior when url exists or when name is a real person's name with no avatar URL -- those should still show initials.
3. Style the unassigned avatar to match Jira: slightly lighter/more muted background (bg-muted), the `User` icon in `text-muted-foreground` color, sized proportionally to the avatar size (for size 20: icon 12px, size 24: icon 14px, size 32: icon 18px, size 40: icon 22px).
4. Keep the same circular shape, same SIZE_MAP dimensions. The only visual change is icon vs "U" text inside the circle.

Update existing tests in cached-avatar.test.tsx:
- Add test: when name is "Unassigned" and url is null, renders with a User icon (check for svg element) not "U" text.
- Add test: when name is "Uma Thompson" and url is null, renders initials "UT" (not treated as unassigned).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/components/ui/cached-avatar.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>CachedAvatar shows a person silhouette icon for unassigned state, initials for real names with missing avatars. Tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Ensure consistent unassigned avatar usage across all views</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
Update all locations that show "Unassigned" as plain text to use CachedAvatar instead, for visual consistency:

1. **FieldsSection.tsx** (line ~354): Replace the plain text 'Unassigned' with `<CachedAvatar url={null} name="Unassigned" size={20} />` followed by the text "Unassigned". This matches the pattern when assignee exists (avatar + name). Import CachedAvatar if not already imported (it is already imported in this file).

2. **MergeRequestDetailPage.tsx** (line ~275): Replace `<span className="text-muted-foreground">Unassigned</span>` with a flex container containing `<CachedAvatar url={null} name="Unassigned" size={20} />` and the text "Unassigned" in muted-foreground. This matches the PersonDisplay pattern used when assignee exists.

3. **ReleaseDetailPage.tsx** (line ~579): Replace `<span className="text-xs text-muted-foreground">Unassigned</span>` with a flex container containing `<CachedAvatar url={null} name="Unassigned" size={20} />` and text "Unassigned" in text-xs text-muted-foreground. Import CachedAvatar at top of file.

4. **BacklogRow.tsx** (line ~165): Already uses CachedAvatar with name="Unassigned" -- no change needed, it will automatically pick up the icon from Task 1.

Keep consistent flex layout: `<span className="inline-flex items-center gap-1.5">` wrapping avatar + text, matching existing assigned-user patterns in each file.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>All views showing unassigned state use the CachedAvatar component with person icon. No plain-text-only "Unassigned" labels remain in assignee fields. All tests pass.</done>
</task>

</tasks>

<verification>
cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -40
cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | tail -10
</verification>

<success_criteria>
- Unassigned issues show a person silhouette icon in a muted circle (matching Jira's style) instead of "U" initials
- All 4 locations (BacklogRow, FieldsSection, MergeRequestDetailPage, ReleaseDetailPage) use CachedAvatar for unassigned state
- All existing tests pass, new tests cover unassigned icon rendering
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260401-bcs-make-the-unassigned-avatar-nicer-and-mat/260401-bcs-SUMMARY.md`
</output>
