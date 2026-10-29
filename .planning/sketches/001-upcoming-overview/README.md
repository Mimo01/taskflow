---
sketch: 001
name: upcoming-overview
question: "How should Upcoming releases be presented so health and timing scan at a glance, without the list feeling plain?"
winner: "A4"
tags: [layout, releases, list, phase-93]
---

# Sketch 001: Upcoming overview

## Design Question
Phase 93 UAT: the shipped Releases list "works but it is too plain". User wants at-a-glance status, a sense of time, richer per-release info and more visual polish; core action is scanning all upcoming releases.

## How to View
open .planning/sketches/001-upcoming-overview/index.html

## Variants
- **A: Timeline + rich rows** — 6-week time track with today marker and a red "late" trail for overdue releases above enriched list rows (bar, blocked badge, team avatars, countdown pill).
- **B: Release tiles** — upcoming releases as tiles headlined by the countdown, large segmented bar, Done / In progress / To do breakdown, health pill (On track / At risk / Overdue / No date); released stays a compact list. Page summary strip on top.
- **C: Rich rows only** — the shipped grid with more per row: countdown pill, segmented bar, blocked + team inline, left accent stripe on overdue/undated rows. Dashed "MRs" badge is the only GitLab-backed element (would bring GitLab back into the list load, reversing D-01).

## Round 2 (after user feedback: A preferred; releases usually weekly on Tuesday; no 'blocked' badge; no MR info — Jira tasks only)
- **A1: Tuesday axis** — A's continuous track gridded on Tuesdays; one release per week lands on a line in a single lane; last released version stays faded on the track; overdue trails red to today.
- **A2: Week slots** — the track as Tuesday-anchored week cards (one per week), this week outlined, past faded, empty weeks shown as a dashed "No release" slot so a broken cadence is visible; overdue keeps its week with a red outline.
- Both: blocked badges removed, no MR data; Due column reads "Tue 03 Nov".

## What to Look For
- Which one makes "what's late / next / at risk" obvious in 2 seconds
- Whether the timeline (A) earns its height once there are 10+ upcoming releases
- Tile density (B) vs one-line rows (A/C) — B breaks the one-row-one-line rule for upcoming by design
- Each figure shown once: pill = countdown/status, Due = date only
- Toolbar (bottom-right): theme toggle, 640 / 1100 / full width, ✎ Notes for per-variant rationale; hover bars for the ≤4-row tooltip

## Round 3 — real naming formats
- Fix versions look like `Standard 01.01.2026 - short text`; RM packages like `WEEK10 (01.01.2026 - 01.01.2026) STANDARD`.
- Sketch splits the fix-version name: short text as the title, `Standard`/`Hotfix` as a small kind tag, date shown only in Due (full name on hover). RM cell shows `WEEK45 RM-14`, full summary on hover.
- Added an off-cadence Hotfix (Thu 05 Nov) in the same week as a Tuesday Standard: A1 drops it to a second lane; A2 shows "+ 1 more (Hotfix)" in the week card.

## Round 4 — winner A3: Release-date axis
- User picked A1's track "but with the timeline dynamic with the actual release dates (not always tuesday)": gridlines + labels at each release's real date, with weekday ("Tue 03 Nov", "Thu 05 Nov").
- Close releases (< 5 days apart) drop to a second chip lane and a lower tick label.
- Rows show the **full** fix-version name verbatim (user rejected the split/kind tag). Track chips show the short text after " - " since the axis carries the date (full name on hover) — confirm at planning.
- No blocked badge, no MR data — Jira issues only.

## Round 5 — winner A4: started-only bars
- User observation: usually only the next release has work started; released ones are all done; releases 2+ ahead are empty.
- Issues cell is state-driven in a fixed slot: segmented bar + `N/M` only when work has started (next release, overdue); `17 to do` when nothing started; `✓ 25 done` for released; `No issues` when empty.
- Track: the next release is the emphasised chip (NEXT label, bar, `15/24 done`, dark border); other chips show name + `17 to do` / `✓ done`; overdue keeps its bar + red outline and red trail to today. Dots pinned to the axis on dashed date gridlines.

## Data notes
Blocked/flagged counts, assignees and the Done / In progress / To do split come from the same batched Jira search the list already does (no extra source). MR counts need GitLab.
