---
sketch: 005
name: detail-narrow
question: "How do the header, facts and graph grid wrap at 420 / 640 / 900px?"
winner: null
tags: [responsive, release-detail, phase-94]
---

# Sketch 005: Detail at narrow widths

## How to View
open .planning/sketches/005-detail-narrow/index.html (three frames side by side; scroll horizontally)

## Variants (on 003 variant A)
- **N1: Stack.** Header actions wrap under the title, and facts wrap without truncating. The graph row goes from 3 columns to 2 at ≤980px, then to 1 at ≤640px.
- **N2: Compact.** At ≤640px the actions become icon buttons pinned top-right. Assignee rows go full width, and the type columns and donut stay side by side until ≤440px. The burnup is 160px tall.

Container queries are on the scroll wrapper, not on the styled element (see the "container query not on self" memory). The task table anatomy is unchanged.
