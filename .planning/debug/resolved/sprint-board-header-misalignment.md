---
status: resolved
trigger: "sprint board column headers misaligned - IN PROGRESS and DONE offset from cards"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: Header row has 4 flex children (3 columns + refresh button) while card rows have only 3 flex-1 children, causing unequal column widths
test: Compare header flex layout vs card row flex layout
expecting: Header columns are narrower due to extra refresh element stealing space
next_action: Fix by making refresh button not participate in flex-1 distribution

## Symptoms

expected: Column headers (TODO, IN PROGRESS, DONE) should be centered/aligned directly above their respective card columns
actual: TODO column is fine (leftmost), but IN PROGRESS and DONE headers are offset from the cards below them
errors: None
reproduction: Navigate to the sprint board page and observe header/card alignment
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-03-16
  checked: SprintBoardTab.tsx header row layout (line 327)
  found: Header row is a single flex container with 4 children - 3 flex-1 column divs + 1 shrink-0 refresh div. Card rows (line 443) have only 3 flex-1 children. The refresh div steals width from the header columns, making them narrower than card columns.
  implication: This is the root cause. First column aligns because both start at x=0, but cumulative width difference shifts IN PROGRESS and DONE headers leftward.

## Resolution

root_cause: Header bar was a flat flex row with 4 children (3 flex-1 column headers + 1 refresh button area). Card rows below only have 3 flex-1 children. The refresh button area consumed space from the header flex distribution, making each header column narrower than its corresponding card column. First column appeared aligned (both start at left edge) but IN PROGRESS and DONE headers were progressively offset.
fix: Wrapped the 3 column headers in their own inner flex container so they distribute space identically to card rows. Positioned the refresh button absolutely (right-0, top-0) so it overlays the right edge without affecting column width calculation.
verification: All 17 SprintBoardTab tests pass. TypeScript compiles. Visual alignment now correct since header and card rows both use 3-way flex-1 distribution.
files_changed: [taskflow/src/routes/dashboard/SprintBoardTab.tsx]
