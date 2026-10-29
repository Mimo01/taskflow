---
sketch: 002
name: list-below-track
question: "What should replace the table under the A4 release track so the list feels nicer?"
winner: "F3"
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
- Released coloured green (user): green weekday band on released date blocks, green outline/tint on the released chip on the track; released rows no longer faded.
- Final list anatomy: A4 release-date track on top → Upcoming rail (undated first, overdue, TODAY badge, next card, later releases) → Released rail, faded.

## Round 3 — scale: 10–15 releases planned
- **S1a: window + condensed** — track shows an 8-week window with ‹ › pan and "+N later →"; rail keeps every release but those 3+ ahead (nothing started) condense to a mini date block + one line.
- **S1b: dots + collapsed** — track spans all ~4 months; only overdue / next / next+1 get chips (next always claims the top lane), the rest are dots with hover; rail shows undated, overdue, next, next+1, then a collapsed "Planned · N more" group (date range + total to do), released below.
- Both: chips and date labels are placed collision-free (second lane / hidden label when they would overlap).

## Winner: S1c — one rail (round 4)
- User: "s1a is the best. but i dont like that there are two timelines - unreleases and released".
- One chronological rail: "↑ Show earlier releases" → last 3 released (oldest first, green blocks) → overdue → TODAY → next (raised card) → next+1 → condensed planned (mini block, one line) → "No date" section at the end.
- Track = S1a: 8-week window, ‹ › pan in 4-week steps, "+N later →"; collision-free chip lanes with next release claiming the top lane.

## Winner: S1d — released last (round 5)
- User: released are the least important; don't put them on top.
- Rail starts at the overdue release → TODAY → next (raised card) → next+1 → condensed planned → "No date".
- Released at the very bottom: the 3 most recent shown (newest first, compact rows with green date blocks), then "Show older releases ↓" (user: "show some released, do not hide all"); the last released version stays on the track as a green chip.

## Winner: S1e — polished S1d (round 6)
- Page header carries the summary (`18 upcoming · 1 overdue · next Tue 03 Nov`); track loses its "Release track" title.
- Track: TODAY pill label on a thin line, softer late trail, range label `08 Oct – 05 Dec · +10 later` with ‹ ›; 8-week window wide, 4-week window starting just before the overdue release at ≤700px; redraws on resize.
- Rail: month dividers (NOVEMBER, DECEMBER, JANUARY 2027…) after TODAY; countdown pill switches to weeks from 14 days ("In 3 weeks"); "N days late" / "Tomorrow" / "Today".
- Next-release card: kicker, name + pill on one line, package + team on the next, thick bar + "15/24 done", breakdown text.
- Rows: hover background + trailing › in a fixed slot (no layout shift); counted section labels ("NO DATE 1", "RELEASED 3 recent"); "Show older releases ↓".
- Checked in light, dark and 640px.
- Mini date blocks keep the month line (weekday · day · month) — without it released/planned dates were ambiguous.

## Winner: S1f — app style (round 7)
- User: "make the releases more separated" + "better match the existing styles of the app".
- Separation: each release row ends in a hairline `border-b border-border`, rows get py-3 (mini py-2.25), rail blocks get more vertical margin.
- App tokens (from taskflow/src): compact toolbar header like ReleasesTab (`text-sm font-semibold` title, `text-xs` muted count, "Updated …", text-link Refresh); Card look for track and next-release card (`rounded-xl ring-1 ring-foreground/10`, no shadow); pills = `STATUS_PILL_LAYOUT_CLASS` geometry (rounded 4px, px-1.5 py-0.5, text-xs font-medium, min-w-[5.5rem]) with `CHIP_TONE_CLASS` tints (`bg-X-500/15 text-X-600`, muted = `bg-muted text-muted-foreground`); bars h-1.5 with green-500 / blue-500 segments (as AioCycleList); hover `bg-muted/50`; section labels `text-xs font-semibold` muted with count; month dividers sentence case; uppercase tracking only on the tiny weekday band / kicker (app uses `uppercase tracking-widest text-[10px]`).

## Winner: S1g — compact rows (round 8)
- User: rows looked off; "why say 15 done twice?"; polish and compact more.
- Every figure once: next card shows bar + "15/24 done" only; Done / In progress / To do breakdown moved to the bar tooltip.
- One-line rows: full name, RM package inline as muted text after it, issues slot, team, pill, hover ›; hairline between rows; ~43px row height.
- Mini date blocks (weekday · day · month, 36px) on every row; only the next release keeps the full block.
- Next card is two lines: name · package · team · pill, then a thick bar + figure.

## Current: S1h — branched from S1e (round 9)
- User: "s1e was the best so far, branch from there" — S1f (app tokens) and S1g (one-line compaction) set aside.
- S1e look kept (stacked name + package, S1e pills/typography, next-release card).
- Fixes carried over: next card shows "15/24 done" once (breakdown only in the bar tooltip); releases separated by an inset hairline with slightly more row padding; mini blocks keep the month.

## Round 10 — planned-release row styles (on S1h)
User: "i dont like the style of upcoming releases" (the planned rows after next+1).
- **U1: quiet list** — dot on the rail, text date, name, "8 to do · in 12 days" muted; no block, no pill.
- **U2: month grid** — planned releases as small cards in a grid under each month (date + countdown, name, count + team).
- **U3: mini cards** — each planned release its own separated card with the mini date block inside.

## Current: F1 — L1 + U1 (round 11)
- User: "i like l1 the best now. u1 is also good".
- L1 agenda rail (text date + weekday left, dots on a slim rail, TODAY line) replaces calendar blocks.
- Overdue / next+1 / No date rows: L1 one-line style with package beneath, bar where started, team, pill.
- Next release: L1 card — kicker, name + pill, package + team, thick bar + one figure.
- Planned (nothing started): U1 quiet lines — "Tue 10 Nov · name · **8 to do** · in 12 days", small dot; month dividers.
- Released: 3 recent as quiet lines with green dots and "✓ 25 done", then "Show older releases ↓".
- Header summary + windowed track carried from S1e.

## Current: F2 — calendar + quiet lines (round 12)
- User: "i liked the calendar" (after F1 replaced blocks with text dates).
- S1h rail with calendar blocks; overdue / next card / next+1 / undated keep full rows.
- Planned and released: mini calendar block + quiet line — name, then "**8 to do** · in 12 days" / "**✓ 25 done**"; no pill, no avatars, no package line.

## Current: F3 — calendar only for key releases (round 13)
- User: "calendar only for the most important".
- Calendar blocks: overdue, next (ringed, raised card), next+1, undated.
- Planned + released: dot on the rail (grey / green), text date "Tue 10 Nov", name, "**8 to do** · in 12 days" / "**✓ 25 done**"; hairline between lines.
- L1 date stamps (user: "i like the date stamps from l1"): planned + released rows show "**10 Nov** / Tue" left of the rail next to their dot (replaces the inline "Tue 10 Nov"); key releases keep calendar blocks on the rail.
- One label system (user: "make the styles of the labels and calendar match better"): weekday band, stamp weekday, month dividers, NO DATE / RELEASED, NEXT RELEASE kicker and TODAY badge share 10px / 650 / tracked uppercase; stamps mirror the block order (weekday over "10 Nov" in the block's numeral weight); state colours shared — amber undated, green released.
- Alignment (user: "the calendars are on the right, the labels are more to the left"): calendar blocks moved into the date column, right-aligned to the same edge as the text stamps; every row gets a state-coloured dot on the rail.
- Responsive track (user: "on smaller screens the graph gets squished"): weeks shown = track width / ~115px, clamped 3–8; window starts just before the overdue release; ‹ › pan; redraws on resize; side "No date" box hidden under ~620px.
- Released separated (user: "separate released from unreleased better"): rail ends after the last unreleased item, full-width divider + 26px gap, green "Released · 3 recent" heading, released rail restarts as a dashed green line, rows slightly muted.

## What to Look For
- Which reads as a nice overview, not a table
- How clearly the next release stands out without a second "hero" widget
- Each figure once: countdown lives only in the pill; package not repeated where the week header already says it (L2)
- All variants keep A4 rules: full fix-version names, bars only where work started, Jira issues only
