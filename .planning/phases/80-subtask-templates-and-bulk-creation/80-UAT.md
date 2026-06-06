---
status: partial
phase: 80-subtask-templates-and-bulk-creation
source: [80-01-SUMMARY.md, 80-02-SUMMARY.md, 80-03-SUMMARY.md, 80-04-SUMMARY.md]
started: 2026-06-06T22:49:57Z
updated: 2026-06-06T22:55:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 3
name: Edit Rows — Fields, Subtask Type, Advanced Expand (re-verify)
expected: |
  RE-VERIFY after inline fixes (4a2cba26, 61b1f259). The row no longer overflows;
  the Title field has a readable width floor (wraps fields to a second line if
  needed). The subtask-type selector trigger shows the issue-type NAME, not the id.
awaiting: user response

## Tests

### 1. Settings → Subtask Templates Section
expected: Open Settings. A new "Subtask Templates" nav item (template icon) appears in the left nav after "Workflow". Clicking it shows an empty state with "No templates yet" heading and an outline "New Template" CTA.
result: pass

### 2. Create, Rename, Delete a Template
expected: Click "New Template" — a card appears named "Untitled Template" with the row editor open. Click the name and type a new name; clicking away (blur) saves it. Clearing the name and blurring restores the previous name (never saves empty). The Trash2 delete icon removes the template immediately.
result: pass

### 3. Edit Rows — Fields, Subtask Type, Advanced Expand
expected: With a template's "Edit Rows" open, "+ Add row" appends a blank row (assignee defaults to @inherit). Each row has inline Title, Assignee, Priority, Labels, Due Date, Estimate, Story Points. The subtask-type selector lists only subtask issue types. Clicking "Advanced" expands a panel with Components and any project custom fields.
result: [pending]
note: "re-verify after fixes 4a2cba26 (layout) + 61b1f259 (type name). Prior: 'row layout broken, overflows right; subtask type shows id not name; title squished to 0 width'"

### 4. Drag to Reorder Templates and Rows
expected: Grab a template card's drag handle and drop it elsewhere — order updates on drop (no jumpy live reordering, a fixed-height ghost follows the cursor). Same for reordering rows within a template's editor.
result: pass

### 5. Template Persistence Across Restart
expected: Create 2 templates with different names and rows. Quit the app completely and reopen, then return to Settings → Subtask Templates. Both templates appear with their original names, row counts, and field values unchanged.
result: pass

### 6. Bulk Create Subtasks Entry Point
expected: Open any parent issue's detail view. Near "Add subtask" there is a "Bulk Create Subtasks" button (list icon). Clicking it opens a modal titled "Bulk Create Subtasks" with a "Parent: {KEY}" subtitle, a template selector ("No template (ad-hoc)" + saved templates), and a subtask-type selector.
result: [pending]
note: "re-verify after fixes 4a2cba26 (modal layout, shared component) + 256ac361 (button styling). Prior: 'button styling differs from single subtask button; modal has similar layout problems as settings'"

### 7. Placeholder Chip Rendering in Modal
expected: Open a parent issue with assignee + priority set; open Bulk Create and select a template with @inherit / @current / @unassigned assignee rows. @inherit shows a blue chip "@inherit → {Parent Assignee Name}"; @current shows a violet chip "@current → {Your Display Name}"; @unassigned shows a muted "@unassigned" chip.
result: pass

### 8. Skipped-Fields Badge
expected: Select a template that includes a custom field not supported by the target project's subtask type. An amber "N field(s) skipped" badge appears in the toolbar; the unsupported field(s) are dropped from the rows. The badge is hidden when nothing is skipped.
result: skipped
reason: "can't test"

### 9. End-to-End Bulk Creation (Full Success)
expected: Apply a template, reorder a couple of rows, click "Create Subtasks". Progress shows "Creating N subtasks…" per row; rows complete in the displayed (reordered) order. On full success the modal closes and the parent's subtask list refreshes showing the new subtasks.
result: skipped
reason: "can't test"

### 10. Partial Failure and Retry (no duplicates)
expected: Force one middle row to fail (rows 0,1 succeed, row 2 fails). The modal stays open; the failed row shows a red icon with an error naming THAT row's title; succeeded rows show green icons. "Retry Failed" re-attempts only the failed row and never duplicates the already-created ones.
result: skipped
reason: "can't test"

## Summary

total: 10
passed: 5
issues: 0
pending: 2
skipped: 3
blocked: 0

<!-- 4 gaps diagnosed and fixed inline (commits 4a2cba26, 61b1f259, 256ac361). Tests 3 & 6 re-opened as [pending] for human re-verification. -->


## Gaps

- truth: "Settings row editor lays out inline fields cleanly within the panel width; the Title field is readable (non-zero width) and rows do not overflow horizontally."
  status: fixed
  reason: "User reported: row layout is broken, it overflows to the right; the (title) name is squished and with 0 width; the layout overall is broken"
  severity: major
  test: 3
  root_cause: "SubtaskTemplateRow row container (SubtaskTemplateRow.tsx:182) is `flex items-center gap-2` with no flex-wrap, holding ~7 fixed-width shrink-0 controls (~712px) + gaps that exceed the available container width (modal ~812px, settings narrower). Title is the only flexible child (`flex-1 min-w-0`, line 205) so it absorbs the entire deficit and collapses to 0 while shrink-0 controls (esp. native date input) push past the right edge. Same component → breaks in both Settings editor and Bulk modal."
  artifacts:
    - path: "taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx"
      issue: "row container flex with too many shrink-0 fixed-width children, no wrap; Title min-w-0 collapses to 0"
  missing:
    - "Add `flex-wrap` to the row container (line 182) and give Title a width floor: change `flex-1 min-w-0` → `flex-1 min-w-[180px]` (line 205)"
    - "Alternatively move secondary fields (Labels/Estimate/Story points/Due date) into Advanced expand, or switch to a responsive grid"
  debug_session: ".planning/debug/subtask-row-layout-overflow.md"
  fix: "4a2cba26 — flex-wrap on row container + Title min-w-[180px] (SubtaskTemplateRow.tsx)"

- truth: "The Bulk Create Subtasks rows in the modal lay out cleanly within the modal width — same row layout fix as the Settings editor (shared SubtaskTemplateRow component)."
  status: fixed
  reason: "User reported: the modal works but has similar layout problems as the settings"
  severity: major
  test: 6
  root_cause: "Same shared-component cause as the Settings gap — BulkCreateSubtasksModal renders the same SubtaskTemplateRow inside a w-[860px] px-6 popup (~812px), just under the row's fixed budget so Title squishes / row overflows. Fixing SubtaskTemplateRow fixes both consumers."
  artifacts:
    - path: "taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx"
      issue: "hosts shared SubtaskTemplateRow at w-[860px] px-6 — inherits the overflow"
  missing:
    - "Resolved by the SubtaskTemplateRow layout fix above (shared component); verify modal width still accommodates the wrapped/min-width layout"
  debug_session: ".planning/debug/subtask-row-layout-overflow.md"
  fix: "4a2cba26 — resolved by the shared SubtaskTemplateRow layout fix"

- truth: "The 'Bulk Create Subtasks' button visually matches the single 'Add subtask' button styling (same variant/size)."
  status: fixed
  reason: "User reported: the button is there but it has different styling than the single subtask button, make them match"
  severity: cosmetic
  test: 6
  root_cause: "The two controls are different element types. 'Add subtask' (IssueDetailContent.tsx:322-329) is a native <button> styled as a borderless ghost text link (text-muted-foreground, hover:bg-accent). 'Bulk Create Subtasks' (lines 330-338) is the shadcn <Button variant=\"outline\" size=\"sm\"> which renders a bordered outline button. Icon size (size-3.5) and gap (gap-1.5) already match — only the element/variant differs."
  artifacts:
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      issue: "Bulk Create uses <Button variant=outline size=sm> vs Add subtask's native ghost-text <button>"
  missing:
    - "Replace the Bulk Create <Button variant=outline size=sm> (lines 330-338) with a native <button type=button> using the identical className as Add subtask, keeping onClick + LayoutList icon"
  debug_session: ".planning/debug/bulk-button-style-mismatch.md"
  fix: "256ac361 — Bulk Create swapped to native ghost-text button matching Add subtask (IssueDetailContent.tsx)"

- truth: "The subtask-type selector in the Settings row editor displays the human-readable issue-type name, not the raw type id."
  status: fixed
  reason: "User reported: subtask type shows id instead of the name of the type"
  severity: major
  test: 3
  root_cause: "base-ui @base-ui/react/select renders the raw bound `value` in <Select.Value> when value≠label and no `items` map / function child is supplied. The subtask-type Select binds value={effectiveTypeId} (the id) while SelectItem children render {t.name}; SelectItem children only populate the popup, not the trigger, so the trigger falls back to stringifying the id. Other Selects (priority/assignee) only work because their value equals their visible label. Same defect in the bulk modal's subtask-type Select (BulkCreateSubtasksModal.tsx:539-550) and likely the template selector (:524-536)."
  artifacts:
    - path: "taskflow/src/routes/settings/SubtaskTemplatesSection.tsx"
      issue: "lines 208-226: <SelectValue> has no value→name mapping (the reported bug)"
    - path: "taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx"
      issue: "lines 539-550 (subtask type) + 524-536 (template) same value≠label defect"
  missing:
    - "Add a function child to <SelectValue>: {(v) => subtaskTypes.find(t => t.id === v)?.name ?? 'Select type'} (or pass `items` map to Select root)"
    - "Apply the same mapping to the bulk modal's subtask-type Select (and template selector); SelectItem markup is already correct"
  debug_session: ".planning/debug/subtask-type-shows-id.md"
  fix: "61b1f259 — SelectValue function child maps id→name on subtask-type (Settings + modal) and template selector"
