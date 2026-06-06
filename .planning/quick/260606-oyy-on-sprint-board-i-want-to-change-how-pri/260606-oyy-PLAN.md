---
phase: quick-260606-oyy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/priority-icon.tsx
  - taskflow/src/lib/issueDisplayUtils.ts
  - taskflow/src/lib/issueDisplayUtils.test.ts
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
autonomous: true
requirements: [R1, R2, R3, R4, R5]
must_haves:
  truths:
    - "Sprint board cards no longer show a priority-colored left border"
    - "Sprint board cards show the actual Jira priority iconUrl image in the footer meta row"
    - "Cards with no/empty priority iconUrl render no icon and no broken image"
    - "The card left border color is driven by issue type (Bug=red, Story=green, Subtask=blue, Epic=purple, default/Task=blue) with dark-mode variants"
    - "Subtask cards use the uniform type-driven border (no special muted 2px border)"
    - "The story swimlane header shows the story's own priority iconUrl image (inline and sticky)"
  artifacts:
    - path: "taskflow/src/components/ui/priority-icon.tsx"
      provides: "Reusable PriorityIcon component rendering priority.iconUrl with truthiness guard"
      exports: ["PriorityIcon"]
    - path: "taskflow/src/lib/issueDisplayUtils.ts"
      provides: "issueTypeStripeClass() returning full literal Tailwind border-l class strings with dark variants"
      contains: "export function issueTypeStripeClass"
    - path: "taskflow/src/lib/issueDisplayUtils.test.ts"
      provides: "Unit tests asserting issueTypeStripeClass exact strings per type + subtask + default + null"
      contains: "issueTypeStripeClass"
  key_links:
    - from: "taskflow/src/routes/dashboard/TaskCard.tsx"
      to: "issueTypeStripeClass"
      via: "outerClassName border-l-4 + issueTypeStripeClass(issue.fields.issuetype)"
      pattern: "issueTypeStripeClass\\(issue\\.fields\\.issuetype"
    - from: "taskflow/src/routes/dashboard/TaskCard.tsx"
      to: "PriorityIcon"
      via: "footer meta row render of issue.fields.priority"
      pattern: "PriorityIcon"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "StoryHeaderRow"
      via: "priority={story.fields.priority} (inline x2) + priority={stickyHeader.story.fields.priority} (sticky x1)"
      pattern: "priority=\\{(stickyHeader\\.)?story\\.fields\\.priority"
---

<objective>
On the sprint board, replace the priority-colored card left border with a Jira priority icon, and repurpose the left border to encode issue type.

- Remove priority left border on cards (R1).
- Render the actual Jira `priority.iconUrl` image in the card footer meta row via a new reusable `PriorityIcon` component (R2).
- Add the story's priority icon to the swimlane header (R3).
- Drive the card left border color by issue type via a new `issueTypeStripeClass()` helper (R4).
- Make subtask cards uniform — drop the special muted border (R5).

Purpose: Match Jira's own priority encoding (icon already carries severity) and free the left border to communicate issue type at a glance.

Output: New `PriorityIcon` component, new `issueTypeStripeClass()` helper + tests, updated `TaskCard`, `StoryHeaderRow`, and `SprintBoardTab` call sites.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260606-oyy-on-sprint-board-i-want-to-change-how-pri/260606-oyy-CONTEXT.md
@.planning/quick/260606-oyy-on-sprint-board-i-want-to-change-how-pri/260606-oyy-RESEARCH.md

# Pattern sources (read before editing)
@taskflow/src/components/ui/issue-type-icon.tsx
@taskflow/src/lib/issueDisplayUtils.ts
@taskflow/src/routes/dashboard/TaskCard.tsx
@taskflow/src/routes/dashboard/StoryHeaderRow.tsx
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add PriorityIcon component + issueTypeStripeClass helper with tests</name>
  <files>taskflow/src/components/ui/priority-icon.tsx, taskflow/src/lib/issueDisplayUtils.ts, taskflow/src/lib/issueDisplayUtils.test.ts</files>
  <behavior>
    issueTypeStripeClass (exact return strings):
    - subtask flag true → 'border-l-blue-500 dark:border-l-blue-400' (checked FIRST, before name switch)
    - name 'Bug' → 'border-l-red-500 dark:border-l-red-400'
    - name 'Story' → 'border-l-green-600 dark:border-l-green-400'
    - name 'Subtask' → 'border-l-blue-500 dark:border-l-blue-400'
    - name 'Sub-task' → 'border-l-blue-500 dark:border-l-blue-400'
    - name 'Epic' → 'border-l-purple-500 dark:border-l-purple-400'
    - name 'Task' (default) → 'border-l-blue-500 dark:border-l-blue-400'
    - null / undefined issuetype → 'border-l-blue-500 dark:border-l-blue-400' (default branch)
    PriorityIcon:
    - priority null/undefined → renders nothing (returns null)
    - priority.iconUrl '' (empty string) → renders nothing
    - priority.iconUrl truthy → renders <img src> (covered manually; component render not unit-tested here)
  </behavior>
  <action>
Create `taskflow/src/components/ui/priority-icon.tsx` exporting a named PascalCase `PriorityIcon`, mirroring the `IssueTypeIcon` convention (named export, `className` prop defaulting to 'w-3.5 h-3.5 shrink-0'). Props: `priority: { name?: string | null; iconUrl?: string | null } | null | undefined` and optional `className?: string`. Guard with `if (!priority?.iconUrl) return null;` — this single truthiness check covers null priority, missing iconUrl, AND empty-string iconUrl (resolvePriority returns iconUrl: '' on a miss per RESEARCH §2; per the iconUrl guard constraint). Render `<img src={priority.iconUrl} alt="" title={priority.name ?? undefined} className={className} />`. Do NOT wrap in AuthImage — priority iconUrls are absolute and need no auth (RESEARCH §3). Copy the exact `<img>` idiom from FieldsSection.tsx:620.

Add `issueTypeStripeClass(issuetype: { name?: string | null; subtask?: boolean } | null | undefined): string` to `taskflow/src/lib/issueDisplayUtils.ts`, mirroring the existing `priorityStripeClass` structure. Check `issuetype?.subtask` truthiness FIRST (return the blue class) so renamed subtask types still get blue (RESEARCH §4, jira.ts:165 — subtask flag is authoritative over name), then a `switch (issuetype?.name)` over the exact variants in the behavior block. Return ONLY full literal Tailwind class strings (e.g. 'border-l-red-500 dark:border-l-red-400') — never template-interpolated class names (Tailwind JIT purge, issueDisplayUtils.ts:31-35). Do NOT touch, rename, or delete `priorityStripeClass` or its maps — keep the helper per the CONTEXT keep-priorityStripeClass decision (do not delete even though, after Task 2, it has no remaining runtime card consumer).

Add a new `describe('issueTypeStripeClass')` block to `taskflow/src/lib/issueDisplayUtils.test.ts`, mirroring the existing `priorityStripeClass` tests (Vitest: describe/expect/it). Assert each exact string from the behavior block: Bug, Story, Subtask, Sub-task, Epic, Task/default, null, undefined, and the subtask-flag-overrides-name case (e.g. { name: 'Bug', subtask: true } → blue).
  </action>
  <verify>
    <automated>cd taskflow && npm run test -- issueDisplayUtils 2>&1 | tail -20</automated>
  </verify>
  <done>PriorityIcon component exists and returns null for null/empty iconUrl; issueTypeStripeClass returns the exact strings above; new test block passes; priorityStripeClass untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Swap TaskCard border to issue type + add PriorityIcon to footer</name>
  <files>taskflow/src/routes/dashboard/TaskCard.tsx</files>
  <action>
Update the import at TaskCard.tsx:42 to import `issueTypeStripeClass` from '@/lib/issueDisplayUtils' and drop `priorityStripeClass` from that import (it is no longer used in this file — confirmed only at :345). Keep `isDoneStatus`. Add an import of `PriorityIcon` from '@/components/ui/priority-icon'.

Replace the `outerClassName` border logic (TaskCard.tsx:339-351). Remove the `isSubtask ? 'border-l-2 border-l-muted' : [...]` ternary entirely (R5 — subtasks uniform). The new classes: keep the base group/border/rounded string, then always apply `'border-l-4'` and `issueTypeStripeClass(issue.fields.issuetype)` (R1 removes priority border, R4 adds type border), then keep the existing `isFlagged && '...'` branch unchanged.

After removing the ternary, `isSubtask` has NO remaining use in this file (it was only read at :341/:342). Keep the optional `isSubtask?: boolean` in the props interface (:52) so callers still type-check, BUT do not leave a live unused destructured binding — biome baseline is GREEN and an unused destructured binding fails `npm run check`. At the destructure (TaskCard.tsx:270) either drop `isSubtask` from the list entirely OR rename it to `isSubtask: _isSubtask` (underscore prefix = intentionally-unused, biome-clean). Update the doc comment at line ~12 to remove the "muted left border" claim (subtasks no longer get indent/muted border).

Add the priority icon to the card footer meta row: prepend `<PriorityIcon priority={issue.fields.priority} />` as the first child of the right cluster `<div className="flex items-center gap-1.5 shrink-0">` at TaskCard.tsx:213, before the story-points badge. `issue` is already in scope here (CardBody receives the full issue). Use default sizing (w-3.5 h-3.5 shrink-0) matching the existing meta icons.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "issueTypeStripeClass(issue.fields.issuetype" src/routes/dashboard/TaskCard.tsx && grep -q "PriorityIcon" src/routes/dashboard/TaskCard.tsx && ! grep -q "priorityStripeClass" src/routes/dashboard/TaskCard.tsx && ! grep -q "border-l-muted" src/routes/dashboard/TaskCard.tsx && npm run check 2>&1 | tail -5</automated>
  </verify>
  <done>Card left border driven by issueTypeStripeClass with border-l-4; priority left border + muted subtask border removed; PriorityIcon rendered in footer meta row; priorityStripeClass no longer referenced in TaskCard; no unused isSubtask binding; npm run check (biome + tsc) GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Add priority icon to swimlane header (StoryHeaderRow + call sites)</name>
  <files>taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
In `StoryHeaderRow.tsx`: add an optional prop `priority?: { name?: string | null; iconUrl?: string | null } | null` to `StoryHeaderRowProps` (cleaner single prop matching PriorityIcon's shape, RESEARCH §6). Destructure it in the component signature. Import `PriorityIcon` from '@/components/ui/priority-icon'. Render `<PriorityIcon priority={priority} />` inside the key+summary flex block (`<div className="flex items-center gap-2 flex-1 min-w-0">` at :123), placed just before the summary `<span>` at :140 (after the key `<button>`). No issue-type left border on the header (CONTEXT — header only gets the priority icon). PriorityIcon's own guard handles missing priority, so no conditional wrapper needed.

In `SprintBoardTab.tsx`: pass the story's priority to all THREE StoryHeaderRow call sites. NOTE the call sites use different in-scope identifiers for the story issue — verified by reading the file:
  - :484 (inline, non-sticky) — local var `story` → pass `priority={story.fields.priority}`
  - :656 (inline, nested column) — local var `story` → pass `priority={story.fields.priority}`
  - :1663 (sticky overlay header) — there is NO `story` var in scope here; the story issue is `stickyHeader.story` (matching the sibling props at :1664-:1691, e.g. `stickyHeader.story.fields.summary`) → pass `priority={stickyHeader.story.fields.priority}`.
The `fields.priority` is carried by the GH adapter JiraIssue at every site (RESEARCH §6).
  </action>
  <verify>
    <automated>cd taskflow && grep -q "PriorityIcon" src/routes/dashboard/StoryHeaderRow.tsx && test $(grep -cE "priority=\{(stickyHeader\.)?story\.fields\.priority\}" src/routes/dashboard/SprintBoardTab.tsx) -eq 3 && npm run check 2>&1 | tail -5</automated>
  </verify>
  <done>StoryHeaderRow accepts a priority prop and renders PriorityIcon in the header flex; all 3 SprintBoardTab call sites pass priority (story.fields.priority x2 inline, stickyHeader.story.fields.priority x1 sticky); npm run check (biome + tsc) stays GREEN.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run test -- issueDisplayUtils` passes (new issueTypeStripeClass tests green, existing priorityStripeClass tests still green).
- `cd taskflow && npm run check` is GREEN (biome + tsc) — required per memory (Biome baseline GREEN). Watch specifically for an unused `isSubtask` binding after Task 2 (Task 2's own verify now runs `npm run check` to catch this at its source).
- Manual: load the sprint board — cards show no priority left border, show the Jira priority icon in the footer, and have a left border colored by issue type (Bug red / Story green / Subtask blue / Epic purple / default blue). Subtask cards use the same border treatment. Cards with unknown priority show no icon (no broken image). The story swimlane header — both inline and the sticky overlay header — shows the story's priority icon.
</verification>

<success_criteria>
- R1: Priority-colored left border removed from cards.
- R2: Jira priority iconUrl image rendered in card footer meta row; null/empty guarded.
- R3: Priority icon shown in story swimlane header at all 3 call sites (2 inline + 1 sticky).
- R4: Card left border color driven by issueTypeStripeClass (full literal classes + dark variants).
- R5: Subtask cards uniform — muted 2px border removed.
- priorityStripeClass helper retained per CONTEXT decision; no remaining card consumer after this change (note: the reference at adapter.ts:128 is a stale comment, not a runtime caller).
- npm run check GREEN.
</success_criteria>

<output>
Create `.planning/quick/260606-oyy-on-sprint-board-i-want-to-change-how-pri/260606-oyy-SUMMARY.md` when done.
</output>
