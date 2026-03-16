---
status: resolved
trigger: "Subtask cards on the sprint board are visually shifted/moved to the right compared to regular task cards."
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: TaskCard applies `ml-4` margin-left to all subtask cards unconditionally, causing rightward shift on sprint board where indentation is not needed
test: Check all callers of TaskCard isSubtask prop — sprint board passes isSubtask=true via DraggableCard
expecting: Removing or conditionalizing ml-4 on sprint board cards fixes the alignment
next_action: Apply fix — remove ml-4 from TaskCard for sprint board context

## Symptoms

expected: Subtask cards should be aligned the same as regular task cards in sprint board columns
actual: Subtask cards appear shifted/moved to the right
errors: None reported - visual/layout issue
reproduction: View the sprint board - subtask cards are visually offset to the right
started: Unknown - likely since TaskCard added isSubtask ml-4 styling

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: TaskCard.tsx line 62
  found: `isSubtask && 'ml-4 border-l-2 border-l-muted'` — unconditionally applies 1rem left margin when isSubtask is true
  implication: On the sprint board, subtask cards are rendered inside DroppableCell swimlane columns already scoped to their parent story. The ml-4 indentation is meant for hierarchical list views, not board columns where cards should be flush-aligned.

- timestamp: 2026-03-16T00:00:00Z
  checked: DraggableCard.tsx and SprintBoardTab.tsx
  found: SprintBoardTab passes isSubtask={card.fields.issuetype.subtask} to DraggableCard, which passes it through to TaskCard. The sprint board always marks actual subtasks as isSubtask=true.
  implication: Every subtask on the sprint board gets the ml-4 shift. The board layout (swimlane columns) already provides visual grouping, so indentation is redundant and harmful.

## Resolution

root_cause: TaskCard.tsx applies `ml-4 border-l-2 border-l-muted` unconditionally when isSubtask=true. On the sprint board, subtask cards are already grouped under their parent story swimlane, so the left margin causes unwanted rightward shift.
fix: Remove `ml-4` from the isSubtask styling in TaskCard, keeping only the `border-l-2 border-l-muted` visual indicator which provides subtle nesting cue without shifting the card.
verification: All 17 SprintBoardTab tests pass. ml-4 removed from subtask cards; border-l-2 retained for visual nesting cue.
files_changed: [taskflow/src/routes/dashboard/TaskCard.tsx]
