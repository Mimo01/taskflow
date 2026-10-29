# Sketch Manifest

## Design Direction
Taskflow Releases list follow-up to Phase 93 UAT ("works but too plain"). Keep the app's neutral shadcn/Geist look, but give the page more character: at-a-glance status, a sense of time, richer per-release info and more visual weight. Core action: scan all upcoming releases. Constraints carried from user preferences: colour encodes status only, tooltips ≤4 rows, no legends, each figure shown once, list rows one line.

## Reference Points
Current shipped list (Phase 93) screenshots; AioCycleList column grid.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | upcoming-overview | How should Upcoming releases scan for health and timing? | A4: release-date axis track, next release emphasised, bars only where work started | layout, releases, list, timeline |
| 002 | list-below-track | What replaces the table under the track? | F2 (calendar-block rail, quiet lines for planned/released, S1e header + windowed track): one rail of calendar blocks (overdue → TODAY → next card → condensed planned → No date), released collapsed at the bottom, under an 8-week windowed track | layout, releases, list |
