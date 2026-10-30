---
sketch: 003
name: release-detail-page
question: "How should the full-width release detail page be arranged: graphs-area layout, type-graph form, facts-strip density, and does the F5 rocket card suit it?"
winner: null
tags: [layout, release-detail, graphs, phase-94]
---

# Sketch 003: Release detail page

## Design Question
Phase 94 D-10: full-width page (no sidebar) with four graphs (burnup, issues by type, issues by assignee, MR state donut), the sidebar's GitLab facts folded into compact chips, and every figure shown once.

## How to View
open .planning/sketches/003-release-detail-page/index.html

`render.js` + `page.css` are shared with sketches 004 and 005.

## Variants
- **A: Burnup leads.** Facts sit inline in the header Stat summary line. A wide done bar sits under the header, then a full-width burnup, then assignee rows · type **columns** · MR donut. Labels and package mismatches sit side by side, then the task table.
- **B: 2×2 grid + side column.** Facts form their own row of outlined chips. The graphs form a 2×2 grid, with labels and mismatches in a quiet right column. The type graph is a **waffle** (one square per issue).
- **C: Release card (rocket).** An F5-style Card with a faint rocket and a kicker holds the done bar and burnup. Facts are icon + value only, with labels in tooltips. The type graph is **tiles**. The card tests the "detail pages: no card panels" preference.

## What to Look For
- Which arrangement reads calmest while still showing four graphs.
- Fact density: inline (A), a separate chip row (B), or icon-only (C). Problems carry tone only (here: MR labels 2/24 missing).
- The type-graph form differs from the assignee rows (columns / waffle / tiles).
- Each figure appears once: "15 / 24 done" lives only in the done bar; status names appear in the bar tooltip; story points appear in the fact and in tooltips.
- Hover the burnup, bars, donut slices and facts for tooltips (≤4 rows).

## Data notes
- Today the MR state counts only cover merged / open / closed. The **draft** slice needs a draft flag read from the MRs.
- The burnup needs `created` and `resolutiondate` added to `fetchFixVersionIssues` (D-03).
