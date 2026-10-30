---
sketch: 004
name: detail-edge-states
question: "Do the graph slots and facts stay calm and fixed-size across loading, empty, released, undated, overdue and no-GitLab states?"
winner: null
tags: [states, release-detail, phase-94]
---

# Sketch 004: Detail edge states

## Design Question
Phase 94 discretion items: skeletons in fixed slots, the "No issues" and "No MRs" placeholders, the no-GitLab case, a burnup with fewer than 2 points, and every sidebar state carried into the facts.

## How to View
The main view is the hub: open .planning/sketches/003-release-detail-page/index.html (the States row). The standalone page is still at 004-detail-edge-states/index.html.

## Variants (states, built on 003 variant A, the provisional winner)
- **Loading:** the header comes from cache; skeletons hold every slot's final size.
- **No issues:** a muted "No issues" per slot and an empty done track; the Create branch action sits inside its fact.
- **No GitLab:** the GitLab facts, MR donut and labels are hidden, and the graph row becomes 2 columns.
- **No MRs · fuzzy milestone:** a dashed fuzzy milestone, branch "Couldn't check" + Retry, and "No MRs in this milestone".
- **Released:** green pill, "Released · v33.4.0" branch, "Merged back" appears, and the burnup ends at the release date.
- **Undated:** amber "No date", "Set a release date first" and "Create the milestone first"; the burnup starts at the earliest created issue.
- **Overdue · problems:** red "Overdue"; the axis ends today and the Release marker sits before TODAY.
- **Burnup < 2 points:** a placeholder sentence in a fixed-height slot.

## What to Look For
- Nothing shifts between the loading and loaded states.
- Tone appears only on problems.
- No 0/0 charts.
