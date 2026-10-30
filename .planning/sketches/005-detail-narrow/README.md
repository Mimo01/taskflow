---
sketch: 005
name: detail-narrow
question: "How do the header, facts and graph grid wrap at 420 / 640 / 900px?"
winner: "N2"
tags: [responsive, release-detail, phase-94]
---

# Sketch 005: Detail at narrow widths

## How to View
The main view is the hub: open .planning/sketches/003-release-detail-page/index.html. Pick a width and Stack/Compact in the bottom-right control. The old side-by-side page is still at 005-detail-narrow/index.html.

## Variants (on 003 variant A)
- **N1: Stack.** Header actions wrap under the title, and facts wrap without truncating. The graph row goes from 3 columns to 2 at ≤980px, then to 1 at ≤640px.
- **N2: Compact.** At ≤640px the actions become icon buttons pinned top-right. Assignee rows go full width, and the type columns and donut stay side by side until ≤440px. The burnup is 160px tall.

Container queries are on the scroll wrapper, not on the styled element (see the "container query not on self" memory). The task table anatomy is unchanged.

## Winner: N2, Compact (user, 2026-10-30), applied to 003 B
- **Header at ≤640px:** "Refreshed" is hidden. Pin / Edit / Open in Jira become icon-only outline buttons (title attributes carry the labels), and the title row may wrap.
- **B grid at ≤640px:** the burnup and the assignee rows span both columns; the MR donut and the type waffle sit side by side, with the donut values wrapping under the ring. At ≤440px everything is one column.
- **Burnup:** drops to 160px tall at ≤640px.
- **Side column:** labels and mismatches fold under the graphs at ≤980px.
