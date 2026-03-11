---
status: resolved
trigger: "Interactive Buttons Not Working in Tasker App — comment button and status badge do nothing when clicked"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:00:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: RESOLVED — fix was already present in current codebase at time of fix session
test: read TaskRow.tsx and ran vitest — 8/9 tests pass; 1 unrelated skeleton test failure pre-existed
expecting: confirmed resolved
next_action: archive

## Symptoms

expected: Clicking the comment button on a task row opens an inline textarea. Clicking the status badge opens a popover.
actual: Both buttons do nothing when clicked. No UI changes occur.
errors: none reported
reproduction: Click comment button on any task row; click status badge on any task row
started: UAT Tests 3, 10, 11 — reported as broken

## Eliminated

- hypothesis: onClick handlers missing from TaskRow or StatusBadge/button elements
  evidence: TaskRow correctly wires onStatusClick and onCommentClick through to its child elements; buttons have proper onClick props
  timestamp: 2026-03-11

- hypothesis: InlineComment or StatusPopover components have internal state bugs
  evidence: Both components are well-implemented; InlineComment correctly guards on isOpen prop; StatusPopover correctly manages its own open state via Radix Popover
  timestamp: 2026-03-11

## Evidence

- timestamp: 2026-03-11
  checked: MyTasksTab.tsx lines 244-254 — TaskRow render call
  found: onStatusClick={() => {}} and onCommentClick={() => {}} — both are empty arrow functions (no-ops)
  implication: Every click is received by the button but immediately discarded; no state change occurs

- timestamp: 2026-03-11
  checked: grep for all imports of InlineComment across entire src/
  found: InlineComment is defined in InlineComment.tsx but never imported or rendered anywhere
  implication: Even if onCommentClick fired real logic, there is no InlineComment in the tree to show

- timestamp: 2026-03-11
  checked: grep for all imports of StatusPopover across entire src/
  found: StatusPopover is defined in StatusPopover.tsx but never imported or rendered anywhere
  implication: TaskRow renders its own dumb StatusBadge button (no popover), not StatusPopover; the popover component exists but is orphaned

## Resolution

root_cause: |
  TWO compounding root causes share the same file (MyTasksTab.tsx):

  1. COMMENT BUTTON — onCommentClick prop is a no-op stub `() => {}` (line 250). There is no
     useState for open/closed comment state, no handler that sets it, and InlineComment is never
     imported or rendered in MyTasksTab. The component exists but is fully disconnected.

  2. STATUS BADGE — onStatusClick prop is a no-op stub `() => {}` (line 249). TaskRow renders
     its own local StatusBadge (a plain button) rather than the StatusPopover component.
     StatusPopover exists as a complete, working component but is never imported or used anywhere
     in the application.

  In both cases the issue is the same pattern: placeholder stub callbacks were left in place and
  the real interactive components (InlineComment, StatusPopover) were never wired into MyTasksTab.

fix: |
  No code change required. The fix was already present in the codebase at the time of this session.
  TaskRow.tsx already imports StatusPopover and InlineComment, manages commentOpen state via
  useState, and MyTasksTab.tsx passes real onTransitionSelect and onCommentSubmit handlers.
  The diagnosis was accurate for an earlier version of the code; the fix had already been applied.

verification: |
  Ran vitest on MyTasksTab.test.tsx — 8/9 tests pass.
  The 1 failure ("renders skeleton when isLoading") is a pre-existing test infrastructure issue
  (the skeleton query requires jiraToken which loads asynchronously from a mocked stronghold,
  so isLoading is not true synchronously). This failure is unrelated to the interactive buttons bug.
  Both StatusPopover and InlineComment are confirmed to be fully wired in TaskRow.tsx.

files_changed: []
