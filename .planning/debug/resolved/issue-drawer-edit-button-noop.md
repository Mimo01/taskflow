---
status: resolved
trigger: "On issue drawer preview, the edit button doesn't work, it doesn't open the edit modal"
created: 2026-06-12
updated: 2026-06-12
---

# Debug Session: issue-drawer-edit-button-noop

## Symptoms

<!-- DATA_START -->
- **Expected behavior:** Clicking the edit button on the issue drawer preview opens the edit modal.
- **Actual behavior:** Nothing happens at all — no modal, no visible console error.
- **Error messages:** None reported.
- **Timeline:** Unknown when it started.
- **Reproduction:** Open the issue drawer preview, click the edit button.
- **Scope:** Broken only in the drawer preview. The edit button works correctly on the full issue detail page.
<!-- DATA_END -->

## Current Focus

hypothesis: CONFIRMED — PeekPanel never passed onEdit/onClone/onAddSubtask to IssueDetailView; IssueDetailContent optional-chained them into silence.
test: TypeScript typecheck passes (tsc --noEmit clean)
expecting: human verification that modal opens in the running app
next_action: human verify — open peek panel, click Edit, confirm modal opens

reasoning_checkpoint:
  hypothesis: "IssueDetailContent.onEdit?.(…) is a no-op because PeekPanel never passed onEdit to IssueDetailView (optional chain on undefined = silent void)"
  confirming_evidence:
    - "PeekPanel.tsx line 175 (before fix): <IssueDetailView … /> with no onEdit/onClone/onAddSubtask props"
    - "IssueDetailContent.tsx line 420: onClick={() => onEdit?.({…})} — optional chain, no-op when undefined"
    - "IssueDetailPage wires onEdit={openEdit} from outlet context; PeekPanel has no outlet, so it must pass props directly"
  falsification_test: "If adding onEdit to PeekPanel still didn't open the modal, this hypothesis is wrong"
  fix_rationale: "Propagate handleOpenEdit/handleOpenClone/handleOpenAddSubtask from main.tsx through PeekPanelProps into IssueDetailView — the optional chain becomes a live callback"
  blind_spots: "onClone and onAddSubtask had the same issue — fixed all three together"

## Evidence

- timestamp: 2026-06-12
  checked: PeekPanel.tsx line 175
  found: IssueDetailView rendered with only issueKey, layout, onOpenIssue — no onEdit/onClone/onAddSubtask
  implication: All three action callbacks are undefined inside IssueDetailView when rendered from peek

- timestamp: 2026-06-12
  checked: IssueDetailContent.tsx line 416-434
  found: Edit button onClick uses onEdit?.({…}) — optional chain; no-op when undefined
  implication: Button renders and is clickable but the modal never opens

- timestamp: 2026-06-12
  checked: IssueDetailPage.tsx lines 24-28, 86-88
  found: openEdit/openClone/openAddSubtask come from useOutletContext, wired into IssueDetailView — explains why full page works
  implication: Peek panel lacks this outlet context entirely; must have props wired directly

- timestamp: 2026-06-12
  checked: main.tsx lines 468-493, 622-635
  found: handleOpenEdit/handleOpenClone/handleOpenAddSubtask defined at top level but NOT passed to <PeekPanel>
  implication: Fix is to add the three props to PeekPanelProps and wire them through

- timestamp: 2026-06-12
  checked: tsc --noEmit after fix
  found: no type errors
  implication: Types align; fix is structurally sound

## Eliminated

## Resolution

root_cause: PeekPanel did not pass onEdit, onClone, or onAddSubtask to IssueDetailView. IssueDetailContent calls these via optional chains (onEdit?.(…)), which silently no-op when the callbacks are undefined. The full-page route wires them via outlet context; PeekPanel had no such wiring.
fix: Added onEdit/onClone/onAddSubtask to PeekPanelProps; destructured them in PeekPanel and forwarded to IssueDetailView; wired handleOpenEdit/handleOpenClone/handleOpenAddSubtask from main.tsx into <PeekPanel>.
verification: tsc --noEmit clean; human smoke-test confirmed fixed 2026-06-12
files_changed:
  - taskflow/src/components/app/PeekPanel.tsx
  - taskflow/src/main.tsx
