---
phase: 80-subtask-templates-and-bulk-creation
plan: "02"
subsystem: dashboard-ui
tags: [component, shared-row, placeholder-chips, status-icons, advanced-expand]
dependency_graph:
  requires:
    - useSubtaskTemplatesStore (subtask-templates.store.ts)
    - resolveAssignee / PlaceholderContext (resolveRowPlaceholders.ts)
  provides:
    - SubtaskTemplateRow (shared row component for Settings editor and bulk modal)
    - RowState / RowStatus types (preview mode status contract)
  affects: []
tech_stack:
  added: []
  patterns:
    - Mode-aware component (settings/preview prop drives drag handle vs status icon)
    - Placeholder chip pattern (role=img span + color tokens by sentinel type)
    - Three-branch custom field render (allowedValues→Select, plain→Input)
key_files:
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
  modified: []
decisions:
  - "Drag handle uses native <button> not role=button on <div> — biome useFocusableInteractive rule; dragHandleProps typed as HTMLAttributes<HTMLButtonElement>"
  - "Placeholder chips use role=img to allow aria-label — biome useAriaPropsSupportedByRole requires a role on <span>"
  - "onValueChange null guards use ?? fallback (@unassigned for assignee, '' for custom fields) — base-ui Select passes null when value is cleared"
  - "Labels and components use comma-separated Input instead of multi-select — no multi-select primitive available; downstream parses comma-separated on change"
metrics:
  duration: "14m"
  completed_date: "2026-06-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 80 Plan 02: SubtaskTemplateRow Shared Component Summary

Shared row component with inline core fields, placeholder assignee chips with resolved hints, per-row status icons, and an Advanced expand exposing components + createmeta custom fields.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build SubtaskTemplateRow inline core fields + chips + status icons | `7a799f5c` | SubtaskTemplateRow.tsx (created) |
| fix | Biome lint and type errors (import order, aria roles, null guards) | `a88466ac` | SubtaskTemplateRow.tsx |

Note: Tasks 1 and 2 targeted the same file (both in `<files>` for SubtaskTemplateRow.tsx). Task 2's Advanced expand was included in the initial implementation and verified together.

## What Was Built

**`SubtaskTemplateRow.tsx`** — 419-line shared component. Accepts `mode: 'settings' | 'preview'` prop:

**Settings mode** — shows GripVertical drag handle (native `<button>` with `dragHandleProps`), all inline fields editable, Remove X ghost button far-right.

**Preview (bulk modal) mode** — shows placeholder chips with resolved hints in the assignee slot (requires `placeholderCtx`), status icon far-right (`Loader2` spinning / `CheckCircle2` green / `AlertCircle` red), all fields disabled when `rowState.status` is `'creating'` or `'created'` (Pitfall 6 guard, T-80-03 mitigation).

**Inline core fields** (left-to-right per UI-SPEC §2): Title (`flex-1`, `border-destructive` ring on empty), Assignee (`w-32`, placeholder select or chip), Priority select (`w-28`), Labels comma-input (`w-32`), Due Date (`w-32`), Estimate (`w-20`, `e.g. 2h`), Story Points (`w-16`), Advanced toggle (`aria-expanded`, `aria-controls="{row.id}-advanced"`), far-right control.

**Placeholder chips** — `PlaceholderChip` renders `role="img"` spans with `aria-label`: `@inherit` → `bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300`; `@current` → `bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300`; `@unassigned` → `bg-muted text-muted-foreground`. Hint suffix resolved via `resolveAssignee(row.assignee, placeholderCtx)`.

**Advanced expand** — collapsible panel `id="{row.id}-advanced"` with `bg-muted/30 border-l-2 border-border` container. Contains Components comma-input and createmeta-derived custom fields via three-branch pattern (allowedValues → Select, plain → Input). All inputs disabled when `rowState` is creating/created.

## Verification

- `biome check ./src`: **clean** (457 files, no fixes)
- `tsc --noEmit` (via main repo node_modules against worktree files): **clean**, no SubtaskTemplateRow errors
- All acceptance criteria passed:
  - `mode: 'settings' | 'preview'` prop: present
  - Three chip color classes: 3 matches
  - Status icons (Loader2, CheckCircle2, AlertCircle): 6 matches (import + usage)
  - `aria-label="Remove row"` and `aria-controls`: 2 matches
  - `"Advanced fields"` label: present
  - `creatmetaFields` usage: 3 matches
  - Component size: 419 lines (> 120 min)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Style] Biome lint: import order, aria roles, focusable interactive**
- **Found during:** Task 1 biome verification
- **Issues:** (a) `import { useState }` before lucide imports — biome organizeImports; (b) `aria-label` on plain `<span>` not valid without a role — biome useAriaPropsSupportedByRole; (c) `role="button"` on `<div>` without `tabIndex` — biome useFocusableInteractive + useSemanticElements; (d) minor formatting (single-line const, long ternary)
- **Fix:** Reordered imports alphabetically; added `role="img"` to placeholder chip spans; changed drag handle from `<div role="button">` to native `<button>` element; reformatted multi-line constructs
- **Files modified:** SubtaskTemplateRow.tsx
- **Commit:** `a88466ac`

**2. [Rule 1 - Bug] TypeScript: onValueChange null coercion**
- **Found during:** Task 1 tsc verification (run against main repo node_modules)
- **Issue:** base-ui `Select.onValueChange` passes `string | null` but handlers passed value directly to `string`-typed fields
- **Fix:** Added `?? ''` fallback for advanced field handler; `?? '@unassigned'` fallback for assignee (semantically correct — null selection = unassigned)
- **Files modified:** SubtaskTemplateRow.tsx
- **Commit:** `a88466ac`

## Known Stubs

None — this is a pure UI component. No data flows from a stub to rendering; all field values come from the `row` prop passed by the consumer (Settings editor or bulk modal).

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. T-80-03 (required title enforced with `border-destructive` ring + `aria-invalid`) mitigated as planned. T-80-04 (field values rendered as controlled React inputs, no `dangerouslySetInnerHTML`) confirmed. Inputs disabled guard during creation prevents mid-flight edits.

## Self-Check: PASSED

Files exist:
- `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx` ✓ (419 lines)

Commits exist:
- `7a799f5c` feat(80-02): build SubtaskTemplateRow with inline fields, chips, status icons, and Advanced expand ✓
- `a88466ac` style(80-02): fix biome lint and type errors in SubtaskTemplateRow ✓
