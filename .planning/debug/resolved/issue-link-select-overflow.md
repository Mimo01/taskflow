---
status: resolved
trigger: "In issue edit/create modal, when adding issue link. the ui is little broken. The select content overflows and since it sits low on the page the autocomplete can overflow the page"
created: 2026-10-07
updated: 2026-10-07
---

## Current Focus

hypothesis: confirmed
next_action: await user verification

## Symptoms

expected: Issue-link section in the issue edit/create modal lays out within the modal; the issue autocomplete dropdown stays within the viewport (flips/clamps/scrolls).
actual: Select content overflows its container; autocomplete popup, since the field sits low in the modal, extends past the page/viewport.
errors: none
timeline: unknown
reproduction: Open issue create or edit modal, add an issue link, open link type select / issue autocomplete.

## Eliminated

## Evidence

## Resolution

root_cause: (1) SelectContent popup width = anchor width (w-36 trigger) with nowrap items, so long link-type labels overflow. (2) Issue autocomplete was an absolute div inside the modal's overflow-y-auto Dialog.Popup, so it was clipped / extended past the viewport with no collision handling.
fix: Select popup w-auto min-w-(--anchor-width); autocomplete moved to Base UI Popover Positioner (portaled, collision-aware, inside dialog floating tree) with truncate rows.
verification: tsc, biome, vitest (20 pass) clean; visual check pending user.
files_changed: [taskflow/src/routes/dashboard/IssueLinkRow.tsx]
