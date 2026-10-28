---
status: resolved
trigger: "On some pages when i open a sidebar, some sections do not have the shadow of the sidebar. Example is table header"
created: 2026-10-28
updated: 2026-10-28
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "PeekPanel's box-shadow is hidden under sticky elements with z-index>0 inside <main> because main creates no stacking context, while PeekPanel is positioned z-auto (paints at layer 0)."
  confirming_evidence:
    - "PeekPanel (main.tsx:719) is a later flex sibling of <main>, class relative + shadow, no z-index"
    - "Many pages have sticky headers z-10/20/30 (AioCycleList, ExecutionsList, WorklogsPage th) inside main"
  falsification_test: "With isolate on main, sticky headers still cover the shadow"
  fix_rationale: "isolate makes main one stacking context at level 0; PeekPanel is later in DOM so paints above all of main's contents"
  blind_spots: "Not visually verified in Tauri; fixed/absolute popovers inside main with high z now capped below peek (clipped by overflow anyway)"

## Symptoms

expected: When the sidebar (detail panel/drawer) opens, its shadow falls over all page content beside it, including table headers.
actual: On some pages, some sections (e.g. the table header) do not show the sidebar's shadow.
errors: none (visual bug)
reproduction: Open a sidebar on affected pages; observe shadow missing over sticky header.
started: unknown

## Evidence

- checked: PeekPanel.tsx:119, main.tsx:703-736
  found: shadow-[-8px_0_24px_-12px] on relative z-auto panel; main has no stacking context
  implication: sticky z-index children of main paint above the panel's shadow

## Eliminated

- hypothesis: Sheet (ui/sheet.tsx) is the sidebar
  evidence: portaled z-50, only used by IssueDetailSheet

## Resolution

root_cause: <main> has no stacking context, so sticky headers (z-10/20/30) participate in the root stacking context and paint over the PeekPanel's (z-auto) shadow.
fix: added `isolate` to <main> in main.tsx
verification: tsc clean; user confirmed fixed visually 2026-10-28
files_changed: [taskflow/src/main.tsx]
