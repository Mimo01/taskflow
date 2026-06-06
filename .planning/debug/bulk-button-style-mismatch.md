---
status: diagnosed
trigger: "the button is there but it has different styling than the single subtask button, make them match"
created: 2026-06-07
updated: 2026-06-07
---

## Current Focus

hypothesis: CONFIRMED — the two controls are different element types with different styling treatments.
next_action: return diagnosis (find_root_cause_only)

## Symptoms

expected: "Bulk Create Subtasks" button visually matches the single "Add subtask" button (same variant/size/icon treatment).
actual: "the button is there but it has different styling than the single subtask button, make them match"
reproduction: Test 6 in .planning/phases/80-subtask-templates-and-bulk-creation/80-UAT.md

## Evidence

- timestamp: 2026-06-07
  checked: taskflow/src/routes/dashboard/IssueDetailContent.tsx lines 322-338
  found: "Add subtask" is a native <button> styled as a ghost/text link; "Bulk Create Subtasks" is the <Button> component with variant="outline" size="sm".
  implication: They render completely differently — one is borderless muted text, the other is a bordered outline button.

## Resolution

root_cause: The two controls are different element types with mismatched styling. "Add subtask" (lines 322-329) is a native <button> with className "mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer" (ghost/text-link look, no border). "Bulk Create Subtasks" (lines 330-338) uses the shadcn <Button variant="outline" size="sm" className="mt-1 gap-1.5"> which renders a bordered outline button with foreground text.
fix: (not applied — diagnose only) Make Bulk Create a native <button> matching the Add subtask treatment, or switch both to a shared style.
verification: (not applied)
files_changed: []
