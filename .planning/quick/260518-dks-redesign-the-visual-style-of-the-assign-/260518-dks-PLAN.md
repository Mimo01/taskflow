---
phase: quick-260518-dks
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
autonomous: true
requirements:
  - DKS-01

must_haves:
  truths:
    - "When the issue is not assigned to the current user, the assignee popover shows a subtle text link reading 'Assign to me →'"
    - "The 'Assign to me' control has no background fill, no avatar, and no button-box appearance — it blends into the popover"
    - "On hover, the text gets slightly brighter (foreground color) but still has no background"
    - "When the issue is already assigned to the current user, the 'Assign to me' control is hidden (unchanged behavior)"
    - "Clicking the text link still triggers the existing handleAssignToMe handler and assigns the issue to the current user"
    - "The divider that previously separated the button from the search input is removed or made noticeably more subtle"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Restyled 'Assign to me' quick action inside assignee popover"
      contains: "assignee-assign-to-me"
  key_links:
    - from: "FieldsSection.tsx 'Assign to me' button"
      to: "handleAssignToMe"
      via: "onClick handler (must remain wired)"
      pattern: "onClick=\\{handleAssignToMe\\}"
    - from: "FieldsSection.tsx assignee popover render"
      to: "jiraUsername / f.assignee?.name visibility guard"
      via: "conditional render (must remain unchanged)"
      pattern: "jiraUsername && f\\.assignee\\?\\.name !== jiraUsername"
---

<objective>
Redesign the "Assign to me" quick action button inside the Jira assignee popover to be a subtle inline text link, not a filled button. Drop the avatar, drop the button-box look, soften (or remove) the divider, and keep the existing visibility/click behavior intact.

Purpose: The current implementation looks like a separate primary action with a CachedAvatar and hover background, which visually competes with the user search list below it. The user wants it to feel like a quiet shortcut that blends into the popover.
Output: Updated `FieldsSection.tsx` with restyled assignee quick action.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx

<interfaces>
<!-- Current "Assign to me" block (FieldsSection.tsx lines 441-458). The executor must restyle THIS block. -->

```tsx
{jiraUsername && f.assignee?.name !== jiraUsername && (
  <>
    <button
      data-testid="assignee-assign-to-me"
      type="button"
      onClick={handleAssignToMe}
      className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded flex items-center gap-1.5"
    >
      <CachedAvatar url={null} name={jiraUserDisplayName ?? jiraUsername} size={20} />
      <span>
        Assign to me
        {jiraUserDisplayName && (
          <span className="text-muted-foreground ml-1">({jiraUserDisplayName})</span>
        )}
      </span>
    </button>
    <div className="border-b my-1" />
  </>
)}
```

Surrounding context: the popover content uses `className="w-60 p-2"` and the search input below uses `h-7 text-xs`. The list items (`assigneeResults.map`) use `w-full text-left px-2 py-1 text-xs hover:bg-accent rounded`.

Tailwind tokens already in use elsewhere in this file:
- `text-muted-foreground` — for muted text (matches "subtle" requirement)
- `text-foreground` — primary readable text (matches "slightly brighter on hover")
- `border-b` — current divider class
- `hover:bg-accent` — the background that must be REMOVED from this control
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle "Assign to me" as subtle text link, soften divider, remove avatar</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</files>
  <action>
In the assignee popover block (currently lines 441-458, identified by `data-testid="assignee-assign-to-me"`), make exactly these changes — do not touch any other popover behavior:

1. Remove the `<CachedAvatar url={null} name={jiraUserDisplayName ?? jiraUsername} size={20} />` element from inside the button. The button must no longer render an avatar.
2. Replace the button's `className` so it looks like an inline muted text link, NOT a list-row button:
   - Drop `w-full`, `px-2 py-1`, `rounded`, `hover:bg-accent`, `flex items-center gap-1.5`.
   - Use `text-left text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors` and a small left padding `px-1` so it still aligns with the popover content but visually reads as text, not a button.
   - The button should size to its content (not full width).
3. Update the label text to include a trailing arrow so it reads as a link: `Assign to me →`. Keep the optional `({jiraUserDisplayName})` suffix when `jiraUserDisplayName` exists, but render that suffix with the same `text-muted-foreground` so it does not become brighter than the main label. (One way: wrap the whole label content in a `<span>`; the existing inner `<span className="text-muted-foreground ml-1">` for the display name can stay, but adjust so that when the parent hovers to `text-foreground`, the display-name suffix still stays muted by giving it its own `text-muted-foreground` color override — i.e. keep it on the suffix span explicitly so it does not inherit hover brightness.)
4. Soften the divider: replace `<div className="border-b my-1" />` with `<div className="border-b border-border/40 my-2" />` (more subtle border using a faded border token + slightly more vertical breathing room). Do not delete the divider entirely — keeping a faint separator preserves grouping; the user said "removed or made more subtle" and we are choosing more subtle for visual rhythm. If `border-border/40` is not a valid Tailwind opacity token in this project's config, fall back to `border-muted` or `border-border` with reduced opacity via `opacity-40`.
5. Do NOT modify: the outer `{jiraUsername && f.assignee?.name !== jiraUsername && (...)}` visibility guard, the `data-testid="assignee-assign-to-me"` attribute, the `onClick={handleAssignToMe}` wiring, or anything in the user search section below the divider.
6. Remove the now-unused `CachedAvatar` import only if it is no longer used anywhere else in this file. Search the file first — `CachedAvatar` is also used for the assignee trigger (lines 426 and 435) and the reporter row (line 494), so the import MUST stay.

After editing, visually the popover should show: a small muted "Assign to me →" sitting at the top of the popover, a faint divider, then the search input and results.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && pnpm exec tsc --noEmit 2>&1 | grep -E "FieldsSection|error" | head -20</automated>
    <automated>grep -n "assignee-assign-to-me" /Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</automated>
    <automated>grep -n "Assign to me →" /Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</automated>
    <automated>grep -c "hover:bg-accent" /Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</automated>
    <!-- The third grep should still return a non-zero count because hover:bg-accent is used by the search results list and the assignee/priority triggers — we are only removing it from THIS button. Manually confirm the assignee-assign-to-me button line does NOT contain hover:bg-accent: -->
    <automated>awk '/data-testid="assignee-assign-to-me"/,/&lt;\/button&gt;/' /Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx | grep -c "hover:bg-accent"</automated>
    <!-- The awk grep above MUST output 0 (zero). -->
    <human-check>Open an issue detail page where the current user is NOT the assignee. Click the assignee field to open the popover. Verify: (1) "Assign to me →" appears as small muted text at the top of the popover with no background box, no avatar; (2) hovering the text makes it slightly brighter (foreground color), still no background; (3) divider below it is noticeably fainter than before; (4) clicking the text still assigns the issue to you; (5) reopen the popover on an issue already assigned to you — the "Assign to me" control is hidden.</human-check>
  </verify>
  <done>
    - TypeScript compiles with no new errors for FieldsSection.tsx
    - `data-testid="assignee-assign-to-me"` still present on the button
    - Button label reads "Assign to me →"
    - The "Assign to me" button no longer contains `hover:bg-accent` or a `CachedAvatar`
    - Divider class updated to a more subtle form (e.g. `border-border/40` or equivalent)
    - Visibility guard `{jiraUsername && f.assignee?.name !== jiraUsername && ...}` unchanged
    - `onClick={handleAssignToMe}` wiring unchanged
    - `CachedAvatar` import still present (used elsewhere in the file)
  </done>
</task>

</tasks>

<verification>
1. The "Assign to me" control visually reads as a subtle inline text link, not a button or list row
2. No avatar appears next to "Assign to me"
3. Hover changes only text color (muted → foreground), no background
4. Divider between the quick action and the search field is more subtle than before
5. Click still assigns the issue to the current user via the existing handler
6. Control still hidden when the issue is already self-assigned
</verification>

<success_criteria>
The redesigned "Assign to me" quick action in the assignee popover matches the user-decided "subtle text link" style: small muted text with arrow, no background fill on default or hover (just a color shift), no avatar, softer divider. All existing wiring (handler, visibility guard, test id) preserved.
</success_criteria>

<output>
Create `.planning/quick/260518-dks-redesign-the-visual-style-of-the-assign-/260518-dks-SUMMARY.md` when done.
</output>
