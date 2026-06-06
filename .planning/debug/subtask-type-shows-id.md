---
status: diagnosed
trigger: "subtask type shows id instead of the name of the type"
created: 2026-06-07
updated: 2026-06-07
---

## Current Focus

hypothesis: CONFIRMED — base-ui Select.Value renders the raw selected value (id) because no `items` map or function child is provided to map id -> name.
test: read base-ui SelectValue.js + resolveValueLabel.js source
expecting: fallback path stringifies raw value
next_action: report diagnosis (find_root_cause_only)

## Symptoms

expected: subtask-type Select trigger shows issue-type NAME (e.g. "Sub-task")
actual: trigger shows raw type id (e.g. "10003")
errors: none
reproduction: Test 3 in 80-UAT.md — open Settings > Subtask Templates > Edit Rows
started: phase 80, always broken

## Evidence

- checked: SubtaskTemplatesSection.tsx:208-226
  found: <Select value={effectiveTypeId}>, <SelectValue placeholder="Select type"/>, SelectItem value={t.id} child {t.name}. No items map, no function child.
- checked: components/ui/select.tsx:20-28
  found: SelectValue is a thin wrapper over @base-ui SelectPrimitive.Value (NOT Radix).
- checked: node_modules @base-ui SelectRoot.d.ts:92-108
  found: items prop docs: "When specified, <Select.Value> renders the label of the selected item instead of the raw value."
- checked: @base-ui SelectValue.js:47-58 + resolveValueLabel.js resolveSelectedLabel
  found: with selected value and no items/function child -> fallback() -> stringifyAsLabel(value) -> serializeValue -> raw id string. SelectItem children only render the dropdown LIST, never the trigger.
- checked: SubtaskTemplateRow.tsx priority/assignee selects
  found: those "work" only because value === label (value="Blocker" child "Blocker", value="@inherit"). No id/name divergence.
- checked: BulkCreateSubtasksModal.tsx:539-550
  found: identical defect — subtask-type Select value={effectiveTypeId}, items render {t.name}, plain SelectValue. AFFECTED. (Template selector at 524-536 has same value!=label shape too.)

## Resolution

root_cause: base-ui Select.Value renders the raw bound value when value != label and no `items`/function-child mapping is supplied. The subtask-type Selects bind value=issuetype id but display label=issuetype name, so the trigger shows the id.
fix: give Select.Value a value->name mapping — either function child `<SelectValue>{(v) => subtaskTypes.find(t=>t.id===v)?.name ?? 'Select type'}</SelectValue>` OR pass `items={Object.fromEntries(subtaskTypes.map(t=>[t.id,t.name]))}` to <Select>. SelectItem markup is already correct.
verification: (not applied — diagnose-only)
files_changed: []
