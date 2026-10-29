---
sketch: 002
name: list-below-track
question: "What should replace the table under the A4 release track so the list feels nicer?"
winner: "S1"
tags: [layout, releases, list, phase-93]
---

# Sketch 002: List below the track

## Design Question
User on sketch 001 A4: "i dont like the table, make something nicer there". Keep the A4 release-date track; replace the column-header table below it.

## How to View
open .planning/sketches/002-list-below-track/index.html

## Variants
- **Current: A4 table** — the sketch-001 winner, for comparison.
- **L1: Agenda rail** — vertical timeline mirroring the track: date + weekday on the left, rail with status dots, a TODAY marker between overdue and next; the next release expands into a card (full breakdown, package, team); others are one quiet line; released fades below.
- **L2: Week groups** — releases grouped under WEEKnn · dd.mm – dd.mm headers (RM keys on the right, "no RM package" otherwise); soft rows without column header; the next release row is tinted.
- **L3: Date blocks** — calendar-style date block per release (weekday band coloured by status for late / next / undated), full name with RM package beneath; next release is a raised card with bar and breakdown.

## Round 2 — user likes L1 and L3
- **S1: Blocks on rail** — L3's calendar blocks sit on L1's rail (the line connects the blocks); TODAY badge on the rail splits overdue from next; next release is the raised card with bar + breakdown; name with package beneath.
- **S2: Rail + stacked rows** — L1's slim rail with text dates and dots, L3's stacked rows (package beneath name) and a raised next-release card.

## Winner: S1 (blocks on rail)
- User liked L1 and S1; chose calendar blocks on the rail and stacked rows (package beneath name).
- Added L1's "NEXT RELEASE" kicker to S1's raised next-release card.
- Final list anatomy: A4 release-date track on top → Upcoming rail (undated first, overdue, TODAY badge, next card, later releases) → Released rail, faded.

## What to Look For
- Which reads as a nice overview, not a table
- How clearly the next release stands out without a second "hero" widget
- Each figure once: countdown lives only in the pill; package not repeated where the week header already says it (L2)
- All variants keep A4 rules: full fix-version names, bars only where work started, Jira issues only
