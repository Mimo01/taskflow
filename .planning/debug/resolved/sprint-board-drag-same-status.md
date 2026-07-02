---
status: resolved
trigger: "On sprint board dragging issue from status to status, when the status doesnt change it should be no-op, it shouldn't call jira status transition"
created: 2026-06-30
updated: 2026-06-30
---

## Symptoms

- expected: Dragging an issue to the same status column it is already in should be a no-op — no Jira API call should be made
- actual: A Jira status transition API call fires even when the source and destination status are identical
- errors: None visible to user
- timeline: Unknown — unclear if a guard ever existed
- reproduction: On the sprint board, drag any issue card and drop it onto the same status column it started in

## Current Focus

hypothesis: "filterDroppableTransitions does not exclude transitions whose destination status ID (to.id) equals the card's current status ID. Global transitions (isGlobal, no fromStatusId) that loop back to the same status are included in the drop model, causing buildDropModel to mark the source column as 'single' or 'split' instead of 'invalid'. Dropping the card back in its own column resolves to a valid transitionId and fires the Jira API."
test: "Trace filterDroppableTransitions → buildDropModel → resolveDropTransitionId path for a drop on the source column"
expecting: "Guard in handleDragEnd comparing transition.to.id to draggedIssue.fields.status?.id suppresses the API call while leaving the column droppable"
next_action: "resolved"

## Evidence

- timestamp: 2026-06-30
  checked: "sprintBoardDragHelpers.ts filterDroppableTransitions"
  found: "Calls filterTransitionsForStatus(all, currentStatusId) which filters by fromStatusId only — no guard on to.id"
  implication: "A global transition whose to.id matches currentStatusId is included in droppable list"

- timestamp: 2026-06-30
  checked: "sprintBoardDragHelpers.ts buildDropModel"
  found: "Buckets transitions by t.to.statusCategory.key; no check whether destination status equals current status"
  implication: "Source column gets kind:'single' instead of kind:'invalid' when such a same-destination transition exists"

- timestamp: 2026-06-30
  checked: "SprintBoardTab.tsx handleDragEnd"
  found: "Calls resolveDropTransitionId then beginTransition with no same-status guard"
  implication: "A transitionId returned from same-column drop flows all the way to postTransition API call"

## Eliminated

- hypothesis: "Guard belongs in filterDroppableTransitions (exclude same-destination transitions from drop model)"
  reason: "Would make the source column kind:'invalid' — drop rejected visually. User confirmed the drop should still be accepted, just no API call."

## Resolution

root_cause: "handleDragEnd had no guard comparing transition.to.id to the dragged issue's current status ID. Global transitions with a self-loop destination were included in the drop model, so same-column drops resolved to a valid transitionId and called the Jira transition API."
fix: "Added D-13 guard in SprintBoardTab.tsx handleDragEnd: if transition.to.id === draggedIssue.fields.status?.id, return early before beginTransition. Column stays droppable; API call is suppressed."
verification: "15/15 unit tests pass. Test updated to document correct contract: self-loop transitions remain in drop model; no-op is enforced in handleDragEnd."
files_changed: ["taskflow/src/routes/dashboard/SprintBoardTab.tsx", "taskflow/src/routes/dashboard/sprintBoardDragHelpers.test.ts"]
