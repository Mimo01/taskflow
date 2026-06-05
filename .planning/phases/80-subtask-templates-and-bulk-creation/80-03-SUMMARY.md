---
phase: 80-subtask-templates-and-bulk-creation
plan: "03"
subsystem: settings-ui
tags: [settings, crud, dnd-kit, createmeta, subtask-templates, row-editor]
dependency_graph:
  requires:
    - useSubtaskTemplatesStore (subtask-templates.store.ts) — Plan 01
    - SubtaskTemplateRow (create-edit-issue/SubtaskTemplateRow.tsx) — Plan 02
    - fetchCreatemeta / apiFetch / readSecret (services/jira.ts, lib/apiFetch.ts, services/stronghold.ts)
  provides:
    - SubtaskTemplatesSection (Settings UI for template CRUD + row editing)
    - Settings.tsx section registration (type union, SECTIONS, render block)
  affects:
    - taskflow/src/routes/settings/Settings.tsx (additive surgical insertions)
tech_stack:
  added: []
  patterns:
    - dnd-kit fixed-height DragOverlay (P78/P79 pattern — onDragEnd only, never live clone)
    - TanStack Query createmeta chain (issuetypes → fields, reusing useCreateEditQueries pattern)
    - Mode-aware settings section with per-template inline expand
key_files:
  created:
    - taskflow/src/routes/settings/SubtaskTemplatesSection.tsx
  modified:
    - taskflow/src/routes/settings/Settings.tsx
decisions:
  - "TemplateRowEditor is an inline helper component in SubtaskTemplatesSection.tsx — no separate file needed given single-consumer usage"
  - "T-80-06 fallback: if stored subtaskIssueTypeId absent from current project's subtask types, silently fall back to first available — never hard-fail the editor"
  - "useSensors(PointerSensor) with activationConstraint distance:5 — same as P78/P79 pattern to prevent accidental drags on click"
metrics:
  duration: "17m"
  completed_date: "2026-06-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 80 Plan 03: SubtaskTemplatesSection and Settings Registration Summary

Settings "Subtask Templates" section with full template CRUD, inline row editor using shared SubtaskTemplateRow, subtask-type selector from createmeta, and registration in Settings.tsx nav.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | SubtaskTemplatesSection — template list, CRUD, empty state, dnd reorder | `d52c1771` | SubtaskTemplatesSection.tsx (created) |
| 2 | Inline row editor + Settings.tsx registration | `b3a9cf7a` | SubtaskTemplatesSection.tsx (expanded), Settings.tsx (modified) |

## What Was Built

**`SubtaskTemplatesSection.tsx`** — 430-line default-export Settings section:

**Template list:** Each template renders as a card row (`flex items-center gap-2 rounded-lg border bg-background px-3 py-2`) with:
- `GripVertical` drag handle (native `<button>` with dnd-kit attrs, `cursor-grab`)
- Inline name `<input>` with blur-save (non-empty saves via `renameTemplate`, empty restores previous — T-80-05)
- `"Edit Rows"` / `"Done"` ghost button toggling the row editor (one open at a time)
- `Trash2` ghost icon (`text-destructive`, `aria-label="Delete template {name}"`) — removes immediately via `removeTemplate`

**Empty state:** `flex flex-col items-center gap-3 py-12 text-center` with `"No templates yet"` heading, body copy, and outline `"New Template"` CTA.

**New Template button:** `variant="outline" size="sm"` top-right above the list; creates with `id: crypto.randomUUID()`, name `"Untitled Template"`, opens editor.

**Template reorder:** `DndContext` + `SortableContext` (verticalListSortingStrategy) + `SortableTemplateCard` using `useSortable`. `DragOverlay` portaled to `document.body` with fixed-height static clone (`dropAnimation={null}`). `onDragEnd` only — no `onDragOver` reorder.

**Inline row editor (`TemplateRowEditor`):** Shown below the template card when "Edit Rows" is active:
- Container `flex flex-col gap-4 rounded-lg border bg-muted/30 px-4 py-4 mt-1`
- `"ROWS"` subsection heading (`text-xs font-semibold text-muted-foreground uppercase tracking-wide`)
- Subtask type `<Select>` (right-aligned in header row) — filtered by `issuetype.subtask === true` (D-05, never name comparison)
- T-80-06: if `template.subtaskIssueTypeId` absent from current project's subtask types, falls back to `subtaskTypes[0]?.id`
- Createmeta query chain: `['createmeta-issuetypes', projectKey]` → `['createmeta', projectKey, typeId, 'Subtask']`
- Each row rendered via `<SubtaskTemplateRow mode="settings" />` with `SortableRow` wrapper (dnd-kit row reorder via splice, not step-by-step up/down)
- `"+ Add row"` ghost button appends blank row with `assignee: '@inherit'` (D-10)

**Settings.tsx (4 surgical insertions):**
1. `'subtask-templates'` added to `SettingsSection` union
2. `{ id: 'subtask-templates', label: 'Subtask Templates', icon: <LayoutTemplate className="h-4 w-4" /> }` added to SECTIONS after `'workflow'`
3. `import SubtaskTemplatesSection from './SubtaskTemplatesSection'`
4. `{activeSection === 'subtask-templates' && <SubtaskTemplatesSection />}` render block

## Verification

- `biome check ./src`: **clean** (458 files, 0 errors)
- `tsc --noEmit` (via main repo node_modules): **no errors in SubtaskTemplatesSection.tsx or Settings.tsx** — pre-existing JSX-runtime/module-not-found noise on unrelated files is the same infrastructure limitation as Plan 02
- All acceptance criteria passed:
  - `data-testid="section-subtask-templates"`: present
  - Store actions (`addTemplate|removeTemplate|renameTemplate|moveTemplate`): 5 matches
  - Copy strings (`No templates yet|Untitled Template|New Template`): 4 matches
  - `onDragOver` usage in SubtaskTemplatesSection: 0 (only in comment, then removed)
  - Settings.tsx `subtask-templates|SubtaskTemplatesSection|LayoutTemplate`: 6 matches
  - `.subtask` flag filter: 6 matches; no `issuetype.name ===` comparison for subtask detection
  - `"+ Add row"` and `"ROWS"`: present
  - `@inherit` default for new row: present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Style] Biome: import order + line-length format fixes in both files**
- **Found during:** Task 2 biome verification
- **Issues:** (a) `SubtaskTemplatesSection` import not alphabetically placed before `UpdatesSection` in Settings.tsx; (b) `SubtaskTemplate, SubtaskTemplateRow as RowType` type import order; (c) single-line `useSensors()` call vs multi-line; (d) multi-line template card object in SECTIONS array
- **Fix:** `biome check --write` applied safe fixes (organizeImports + format)
- **Files modified:** Settings.tsx, SubtaskTemplatesSection.tsx
- **Commit:** `b3a9cf7a` (included in Task 2 commit)

## Known Stubs

None — all implementations are complete. Template CRUD fully functional and persisted via store. Row editor wires SubtaskTemplateRow with real createmeta-driven fields and subtask type selector. No data flows through a stub to UI rendering.

## Threat Surface Scan

No new network endpoints. The createmeta fetch in `TemplateRowEditor` uses the existing `apiFetch('jira', ...)` authenticated path — same auth boundary as `useCreateEditQueries`. T-80-05 mitigated (template name empty on blur restores previous; row title `border-destructive` ring via SubtaskTemplateRow). T-80-06 mitigated (fallback to first available subtask type when stored typeId absent).

## Self-Check: PASSED

Files exist:
- `taskflow/src/routes/settings/SubtaskTemplatesSection.tsx` ✓
- `taskflow/src/routes/settings/Settings.tsx` ✓ (modified)

Commits exist:
- `d52c1771` feat(80-03): build SubtaskTemplatesSection with template list, CRUD, empty state, and dnd reorder ✓
- `b3a9cf7a` feat(80-03): add inline row editor to SubtaskTemplatesSection and register section in Settings.tsx ✓
