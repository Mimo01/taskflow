---
phase: quick-260329-mxv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/update/UpdateDialog.tsx
  - taskflow/src/components/update/WhatsNewDialog.tsx
  - taskflow/src/components/update/HardMinimumOverlay.tsx
  - taskflow/src/routes/settings/UpdatesSection.tsx
autonomous: true
requirements: [QUICK-MXV]
must_haves:
  truths:
    - "Update modals are wider and taller, giving changelog content room to breathe"
    - "Changelog markdown renders with clear visual hierarchy (headings, lists, spacing)"
    - "Settings release history changelogs render cleanly with full width"
  artifacts:
    - path: "taskflow/src/components/update/UpdateDialog.tsx"
      provides: "Wider dialog with taller changelog area"
    - path: "taskflow/src/components/update/WhatsNewDialog.tsx"
      provides: "Wider dialog with taller changelog area"
    - path: "taskflow/src/routes/settings/UpdatesSection.tsx"
      provides: "Refined changelog rendering in release history"
  key_links:
    - from: "UpdateDialog.tsx"
      to: "DialogContent"
      via: "className prop override for max-width"
      pattern: "sm:max-w-lg"
---

<objective>
Refine the changelog and update modal UI to be more spacious and readable.

Purpose: The update dialogs (UpdateDialog, WhatsNewDialog) use the default sm:max-w-sm (384px) dialog size which is too cramped for changelog content. The changelog markdown areas are height-constrained and the prose styling needs refinement.

Output: Wider, taller update dialogs with improved changelog typography.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/components/update/UpdateDialog.tsx
@taskflow/src/components/update/WhatsNewDialog.tsx
@taskflow/src/components/update/HardMinimumOverlay.tsx
@taskflow/src/components/ui/dialog.tsx
@taskflow/src/routes/settings/UpdatesSection.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Widen update dialogs and expand changelog areas</name>
  <files>
    taskflow/src/components/update/UpdateDialog.tsx
    taskflow/src/components/update/WhatsNewDialog.tsx
  </files>
  <action>
Both UpdateDialog and WhatsNewDialog use DialogContent with default sizing (sm:max-w-sm = 384px). Override via className prop to make them wider and give changelog content more room.

UpdateDialog.tsx changes:
- On DialogContent, add className="sm:max-w-lg" (512px instead of 384px)
- Change the changelog div from "max-h-48" (192px) to "max-h-72" (288px) — 50% more vertical space
- Add "max-w-none" to the prose div so markdown content uses full dialog width (currently constrained by prose default max-width)
- Add release date display: below the version arrow description, if releaseDate is set, show it formatted as "Released Mon DD, YYYY" in text-xs text-muted-foreground

WhatsNewDialog.tsx changes:
- On DialogContent, add className="sm:max-w-lg"
- Change the changelog div from "max-h-64" (256px) to "max-h-80" (320px)
- Add "max-w-none" to the prose div
- Add a subtle description below the title: "Here's what changed in this update" using DialogDescription (import it)

For both dialogs, ensure the changelog markdown container has these combined classes:
"overflow-y-auto prose prose-sm dark:prose-invert max-w-none [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4"

This tightens heading/list spacing within the constrained scroll area so more content is visible without scrolling.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && npx vitest run taskflow/src/components/update/UpdateDialog.test.tsx taskflow/src/components/update/WhatsNewDialog.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Both dialogs render at sm:max-w-lg (512px) instead of sm:max-w-sm (384px)
    - Changelog scroll areas are taller (max-h-72 and max-h-80)
    - Prose uses max-w-none for full-width markdown rendering
    - Markdown heading/list spacing tightened via Tailwind arbitrary selectors
    - WhatsNewDialog has a subtitle description
    - UpdateDialog shows release date when available
    - All existing tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Polish settings release history changelog rendering</name>
  <files>
    taskflow/src/routes/settings/UpdatesSection.tsx
  </files>
  <action>
The VersionHistoryList in UpdatesSection.tsx renders expanded changelogs inline. Refine the styling for consistency with the updated dialog changelog treatment.

Changes to the expanded changelog div (currently "pb-3 prose prose-sm dark:prose-invert max-w-none"):
- Add the same tightened spacing selectors: "[&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4"
- Add a max-h-64 overflow-y-auto so very long changelogs don't blow out the settings page — they scroll within a bounded area
- Add a subtle left border for visual separation: "border-l-2 border-muted pl-4" on the changelog container

Also polish the release row styling:
- Add "hover:bg-muted/50 px-2 -mx-2 rounded-md transition-colors" to the button element for a subtle hover state on each release row
- For prerelease items, show a small "pre-release" badge next to the tag name using the existing Badge component with variant="outline"
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && npx vitest run taskflow/src/routes/settings/UpdatesSection.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Expanded changelogs in settings have consistent prose styling with dialog changelogs
    - Long changelogs scroll within max-h-64 container
    - Left border visually separates changelog from release row
    - Release rows have hover state
    - Pre-release items show a badge
    - All existing tests pass
  </done>
</task>

</tasks>

<verification>
Run full test suite for update components:
```bash
cd /Users/mimo/Desktop/Tasker && npx vitest run taskflow/src/components/update/ taskflow/src/routes/settings/UpdatesSection.test.tsx --reporter=verbose
```

Manually verify (after execution):
- Open the app, trigger an update check or set store state to 'available' — dialog should be noticeably wider
- Check that changelog markdown renders with proper spacing and full width
- Visit Settings > Updates > Release History — expanded changelogs should have left border, scroll for long content
</verification>

<success_criteria>
- Update dialogs are visually wider (512px vs 384px) and changelog areas are taller
- Markdown content uses full dialog width with tightened heading/list spacing
- Settings release history has consistent styling, hover states, and scroll containment
- All existing tests continue to pass with no modifications needed
</success_criteria>

<output>
After completion, create `.planning/quick/260329-mxv-make-the-changelogs-look-nicer-the-updat/260329-mxv-SUMMARY.md`
</output>
