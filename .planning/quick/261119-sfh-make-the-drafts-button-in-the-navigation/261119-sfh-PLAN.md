---
phase: quick-261119-sfh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/DraftsChip.tsx
  - taskflow/src/components/app/DraftsChip.test.tsx
autonomous: true
requirements: [QUICK-261119-sfh]

must_haves:
  truths:
    - "The Drafts trigger in the TopBar is a ghost button like Search/Bell/Recent: no border, no pill, no resting background, hover:bg-muted, bg-muted text-foreground while open"
    - "The trigger shows the PenLine icon at w-5 h-5 followed by the word 'Drafts' (text-sm)"
    - "The draft count is a neutral corner badge placed like the Bell's unread badge, never red, capped at '99+'"
    - "aria-label 'Drafts, N', data-active, aria-haspopup='dialog', the tooltip and the popover contents are unchanged"
  artifacts:
    - path: "taskflow/src/components/app/DraftsChip.tsx"
      provides: "Ghost-style Drafts trigger with neutral corner count badge"
      contains: "absolute -top-1 -right-1"
  key_links:
    - from: "taskflow/src/components/app/DraftsChip.tsx"
      to: "taskflow/src/components/app/TopBar.tsx sibling button classes"
      via: "same ghost button class set (relative flex items-center justify-center h-8 rounded hover:bg-muted transition-colors)"
      pattern: "relative flex items-center justify-center.*h-8.*rounded hover:bg-muted"
---

<objective>
Restyle the TopBar Drafts trigger so it matches its sibling ghost icon buttons (Search, Bell, Recent Items) instead of looking like a bordered pill. This is a visual-only change. Behaviour, the popover contents, the accessibility attributes and the dependencies stay exactly as they are.

Purpose: The Drafts trigger is the only bordered `rounded-full bg-muted` pill in the bar, so it clashes with the app's header style.
Output: The updated DraftsChip.tsx trigger, plus one added test assertion for the badge cap and neutral colour.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
Repo layout: .planning and git live at /Users/mimo/Documents/Projects/taskflow. Source, npm, vitest and biome live in the inner /Users/mimo/Documents/Projects/taskflow/taskflow. Run all commands from the inner dir.

@taskflow/src/components/app/DraftsChip.tsx
@taskflow/src/components/app/DraftsChip.test.tsx

Sibling reference (read-only, DO NOT modify):
- taskflow/src/components/app/TopBar.tsx lines ~170-202. The Search button and the Bell PopoverTrigger use `relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors` plus `bg-muted text-foreground` while open. Icons are `w-5 h-5`. The Bell unread badge is `absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5` and displays `{n > 99 ? '99+' : n}`.
- taskflow/src/components/app/RecentItemsPopover.tsx ~line 115 uses the same Clock trigger pattern.

Current Drafts trigger (DraftsChip.tsx ~line 140): `PopoverTrigger` with className `cn('flex items-center gap-1.5 rounded-full border bg-muted h-8 px-3 text-sm hover:bg-muted/70 transition-colors', open && 'text-foreground')`. Its children are `<PenLine size={14} />`, `<span>Drafts</span>` and `<span className="text-xs text-muted-foreground">{count}</span>`.

Existing tests that must stay green without edits: DraftsChip.test.tsx "shows \"Drafts, 2\" with the count" (asserts the accessible name `Drafts, 2` and that the text content includes 'Drafts' and '2'), and TopBar.test.tsx "renders the Drafts chip before Search only when a draft exists" (accessible name `Drafts, 1`, DOM order before Search). Because aria-label overrides the badge text, the accessible name stays `Drafts, N`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Restyle the Drafts trigger as a ghost button with a neutral corner count badge</name>
  <files>taskflow/src/components/app/DraftsChip.tsx, taskflow/src/components/app/DraftsChip.test.tsx</files>
  <behavior>
    - The existing test "shows \"Drafts, 2\" with the count" still passes unchanged.
    - New test: seeding 100 drafts renders the trigger with accessible name `Drafts, 100`. Its text content contains '99+', and the badge element (the trigger's descendant whose text is exactly '99+') has no class matching /red/.
    - New test: the trigger className has no `border` or `rounded-full` token. Use classList.contains('border') / classList.contains('rounded-full') to check, not a substring match, because `rounded` is legitimately present. The trigger gets `bg-muted` only after it is clicked open (data-active="true"), not at rest.
  </behavior>
  <action>
Per the locked decisions, change only the trigger in DraftsChip.tsx (the PopoverTrigger render prop and the TooltipTrigger children). Do not touch PopoverContent, the handlers, the tooltip text or any other file besides the test.

1. PopoverTrigger className becomes cn('relative flex items-center gap-1.5 h-8 px-2 rounded text-sm hover:bg-muted transition-colors', open && 'bg-muted text-foreground'). Remove `border`, `rounded-full`, the resting `bg-muted` and `hover:bg-muted/70`. Keep data-active, aria-haspopup="dialog" and aria-label={`Drafts, ${count}`} exactly as they are.
2. Children: render PenLine with className "w-5 h-5" (drop size={14}), then `<span>Drafts</span>`. Replace the inline muted count span with a corner badge span that uses the Bell geometry `absolute -top-1 -right-1 text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5`. Give it neutral colours that read in both themes, never red: `bg-muted-foreground text-background`. Do not add `tabular-nums` unless the digits look misaligned. The badge content is {count > 99 ? '99+' : count}. Add aria-hidden to the badge so the accessible name stays the aria-label. Always render the badge, because the chip only mounts when count is at least 1, so the count is never 0 while visible. If the open-state bg-muted makes the badge blend, that is acceptable because bg-muted-foreground contrasts with bg-muted.
3. Update the file header comment ("Drafts N" pill) so it describes a ghost button with a count badge.
4. Add the two tests from <behavior> to DraftsChip.test.tsx, reusing the existing seed/issueDraft helpers (generate 100 drafts with distinct ids). Do not change existing assertions, since none depend on the old markup.

No new dependencies. Do not run biome --write on src. Format only this file if needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/app/DraftsChip.test.tsx src/components/app/TopBar.test.tsx && npx biome check src/components/app/DraftsChip.tsx src/components/app/DraftsChip.test.tsx && npx tsc --noEmit -p .</automated>
  </verify>
  <done>Both test files pass, including the new 99+/neutral and ghost-style tests. Biome is clean on the two touched files and tsc has no errors. git diff shows changes only in DraftsChip.tsx (trigger and header comment) and DraftsChip.test.tsx.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Styling-only change to a local UI trigger. No new input, data flow or dependency. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261119-sfh-01 | Information disclosure | DraftsChip trigger | accept | Only a numeric count is rendered as React text. Draft content is not touched or logged. |
</threat_model>

<verification>
- vitest: DraftsChip.test.tsx and TopBar.test.tsx are green.
- biome check on the touched files only. tsc --noEmit is clean.
- grep -v '^ \*' src/components/app/DraftsChip.tsx | grep -c 'rounded-full border' returns 0.
- grep -c 'bg-red' src/components/app/DraftsChip.tsx returns 0.
</verification>

<success_criteria>
The Drafts trigger looks like a sibling of Search, Bell and Recent Items: a ghost button with a w-5 h-5 PenLine icon and the word "Drafts". It shows a neutral corner count badge capped at 99+ and is pressed (bg-muted) while open. No behaviour or accessibility regressions.
</success_criteria>

<output>
Create `.planning/quick/261119-sfh-make-the-drafts-button-in-the-navigation/261119-sfh-SUMMARY.md` when done
</output>
