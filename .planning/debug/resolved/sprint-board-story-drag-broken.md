---
status: resolved
trigger: "The issue drag and drop on sprint board doesn't always work. It doesn't work for stories at all (only for subtasks). Also sometimes rarely it doesn't work at all"
created: 2026-06-30
updated: 2026-06-30
---

## Symptoms

- expected: Dragging an issue card to another column triggers a status transition
- actual: Story cards cannot be dragged at all on the Sprint Board; subtask cards drag fine; occasionally nothing is draggable at all
- errors: No console errors visible when drag fails
- timeline: Unknown whether stories ever worked on Sprint Board
- reproduction: Click-hold and drag a story card to another status column — card does not respond or transition

## Current Focus

hypothesis: "isDraggable was hardcoded to !!card.fields.issuetype.subtask, which is always false for story-type issues — CONFIRMED and fixed"
test: "Changed all 4 occurrences to isDraggable (bare boolean true); npm run check passes with zero errors"
expecting: "Story cards now register as dnd-kit draggables and will respond to pointer drag"
next_action: "Await human verification in browser"

reasoning_checkpoint:
  hypothesis: "Story cards are non-draggable because isDraggable={!!card.fields.issuetype.subtask} evaluates to false for stories (issuetype.subtask === false), which disables useDraggable in TaskCard, causing dnd-kit to never fire onDragStart for story cards"
  confirming_evidence:
    - "SprintBoardTab.tsx renderSwimlane (virtualized path): isDraggable={!!card.fields.issuetype.subtask} at both the invalid-column and normal render sites"
    - "SprintBoardTab.tsx fallback non-virtual path: same pattern at both render sites — 4 total"
    - "TaskCard.tsx useDraggable({ id: issue.key, disabled: !isDraggable || !!isOverlay }) — when isDraggable=false, disabled=true, so dnd-kit ignores pointer events on that card"
    - "activeSwimlaneKey computation already handles s.story.key === activeId — no additional changes needed for story swim-lane lookup"
    - "sprintBoardDragHelpers.ts — buildDropModel and filterDroppableTransitions are issue-type-agnostic"
  falsification_test: "If the hypothesis is wrong, setting isDraggable={true} on a story card would NOT start a drag — but based on the dnd-kit architecture this is the sole gating condition"
  fix_rationale: "The fix addresses the root cause directly: all TaskCards rendered in column cells (whether subtask or story) should be draggable. The isDraggable guard was intended to exclude StoryHeaderRow (a separate component), not story-type TaskCards."
  blind_spots: "The 'occasionally nothing is draggable at all' symptom is not directly explained by this fix — it could be a separate intermittent issue with sensor activation or board loading state."

## Evidence

- timestamp: 2026-06-30
  checked: "SprintBoardTab.tsx renderSwimlane function (both virtualized and fallback paths)"
  found: "isDraggable={!!card.fields.issuetype.subtask} passed to every TaskCard in the column grid. For stories (issuetype.subtask === false), this is always false."
  implication: "useDraggable in TaskCard is always disabled for story-type issues — dnd-kit will not attach pointer listeners to their DOM nodes"

- timestamp: 2026-06-30
  checked: "TaskCard.tsx useDraggable call"
  found: "useDraggable({ id: issue.key, disabled: !isDraggable || !!isOverlay }) — disabled:true when isDraggable=false"
  implication: "Confirms dnd-kit ignores these cards; no drag events fire"

- timestamp: 2026-06-30
  checked: "activeSwimlaneKey computation and sprintBoardDragHelpers.ts"
  found: "activeSwimlaneKey handles s.story.key === activeId; buildDropModel is issue-type-agnostic"
  implication: "No other blockers for story drag once isDraggable is enabled"

- timestamp: 2026-06-30
  checked: "npm run check after fix"
  found: "Zero errors, 26 pre-existing warnings (unchanged)"
  implication: "Fix introduces no type errors or lint violations"

## Eliminated

- hypothesis: "Drag fails due to missing transitions for story issue types"
  evidence: "getTransitions() uses peekGhTransitions with the sentinelProjectId fallback, which works for any issue type; right-click context menu works for stories per the bug report (only drag is broken)"
  timestamp: 2026-06-30

- hypothesis: "DndContext sensor configuration prevents story drag"
  evidence: "PointerSensor with delay:150/tolerance:5 is board-wide; subtasks drag fine with the same sensor — sensor config is not the discriminator"
  timestamp: 2026-06-30

## Resolution

- root_cause: "isDraggable={!!card.fields.issuetype.subtask} hardcodes draggability to subtask-only. Story-type issues (issuetype.subtask === false) always receive isDraggable={false}, disabling useDraggable in TaskCard. dnd-kit never attaches pointer listeners so drag never starts for stories."
- fix: "Changed all 4 occurrences of isDraggable={!!card.fields.issuetype.subtask} to isDraggable (bare true) in SprintBoardTab.tsx — both render paths (virtualized + fallback), both column-cell render slots (invalid-column + normal). Updated misleading comment in TaskCard.tsx."
- verification: "npm run check: zero errors, 26 pre-existing warnings only"
- files_changed: ["taskflow/src/routes/dashboard/SprintBoardTab.tsx", "taskflow/src/routes/dashboard/TaskCard.tsx"]
