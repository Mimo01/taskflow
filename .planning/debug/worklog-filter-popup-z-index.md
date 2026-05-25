---
status: resolved
trigger: "On worklogs page, when filtering a person, the popup list to select a person sometimes has low z-index and is hidden behind the table"
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **expected**: Popup appears and is fully usable — renders above the table and all other elements
- **actual**: Popup is partially hidden — part of the list is obscured by the table rows
- **errors**: No console errors — purely a visual/CSS stacking context issue
- **timeline**: Intermittent — sometimes works fine, sometimes the popup is hidden behind the table
- **reproduction**: Open worklogs page, click the person filter button — popup sometimes renders behind the table

## Current Focus

- hypothesis: "sticky table cells (z-30) escape the table wrapper's stacking context and beat the filter bar (z-10) at the root level"
- test: "confirmed table wrapper has no position+z-index, so it does not form a stacking context — sticky z-30 cells propagate to root stacking context"
- expecting: "isolate on table wrapper contains its children's z-index values inside a new stacking context"
- next_action: "resolved — correct fix applied"
- reasoning_checkpoint: "overflow:auto alone does NOT create a stacking context. A stacking context requires position+z-index (non-auto), or opacity<1, transform, will-change, isolation:isolate, etc. The table wrapper had none of those. Sticky z-30 cells inside the table therefore participated in the ROOT stacking context at z=30, which beat the filter bar stacking context at z=10."

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  finding: "People filter dropdown ul uses `absolute z-20` inside `div.relative` inside `div.relative.z-10` (filter bar)"
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx:907,924-925
  significance: "medium"

- timestamp: 2026-05-25T00:00:00Z
  finding: "Table wrapper uses `flex-1 overflow-auto min-h-0` — overflow:auto ALONE does NOT create a stacking context; requires position+z-index or other triggers"
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx:962
  significance: "critical"

- timestamp: 2026-05-25T00:00:00Z
  finding: "Sticky thead cells use z-30; sticky tfoot cells use z-20; sticky tbody cells use z-10. These are positioned elements with z-index, so they create stacking contexts. Their nearest stacking-context ancestor was the ROOT div (not the table wrapper), so they compared at z=30 in the root context."
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx:971-1270
  significance: "critical"

- timestamp: 2026-05-25T00:00:00Z
  finding: "Filter bar is `relative z-10` — a proper stacking context at z=10 in the root. But z=10 < z=30 (sticky headers), so sticky headers painted over the dropdown."
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx:864
  significance: "critical"

- timestamp: 2026-05-25T00:00:00Z
  finding: "Previous fix of z-10 on filter bar was insufficient: it raised the filter bar stacking context but sticky cells at z-30 still beat it since overflow:auto on the table wrapper does not contain its children's z-index values into a new stacking context."
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx:864
  significance: "high"

## Eliminated

- "Dropdown z-index too low globally" — z-20 is sufficient once stacking contexts are correct
- "overflow:auto creates a stacking context" — FALSE; overflow!=visible alone does not create a stacking context (requires position+z-index or other CSS triggers)
- "z-10 on filter bar sufficient" — FALSE; sticky cells at z-30 still escaped the table wrapper and beat z=10 in the root context

## Resolution

- root_cause: "The table wrapper (`flex-1 overflow-auto min-h-0`) did not form a stacking context. `overflow: auto` alone does NOT create a stacking context — you also need `position` + a non-auto `z-index`, or another trigger like `transform`, `opacity < 1`, or `isolation: isolate`. Without a stacking context on the table wrapper, its sticky positioned children (z-30 thead cells) participated directly in the root stacking context at z=30, which beat the filter bar's z=10 stacking context. The dropdown (z-20 inside the filter bar context) was thus hidden behind the sticky headers."
- fix: "Added `isolate` (CSS `isolation: isolate`) to the table wrapper div (line 962). This creates a new stacking context for the table container without requiring `position` + `z-index`. All sticky children (z-30/z-20/z-10) are now contained within the table's stacking context. The table wrapper itself participates in the root context at z=auto (effectively z=0), which the filter bar's z=10 beats. The dropdown is now guaranteed to render above all table content."
- verification: "Open worklogs page, click person filter — dropdown should render above all sticky table rows consistently, even when table has scrolled to show sticky headers"
- files_changed: "taskflow/src/routes/worklogs/WorklogsPage.tsx (line 962: flex-1 overflow-auto min-h-0 → flex-1 overflow-auto min-h-0 isolate)"
