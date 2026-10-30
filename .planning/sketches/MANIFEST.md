# Sketch Manifest

## Design Direction
Taskflow Releases list follow-up to Phase 93 UAT ("works but too plain"). Keep the app's neutral shadcn/Geist look, but give the page more character: at-a-glance status, a sense of time, richer per-release info and more visual weight. Core action: scan all upcoming releases. Constraints carried from user preferences: colour encodes status only, tooltips ≤4 rows, no legends, each figure shown once, list rows one line.

## Reference Points
Current shipped list (Phase 93) screenshots; AioCycleList column grid.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | upcoming-overview | How should Upcoming releases scan for health and timing? | A4: release-date axis track, next release emphasised, bars only where work started | layout, releases, list, timeline |
| 002 | list-below-track | What replaces the table under the track? | F5 (F1 track + rail with light dashboard polish, released in its own panel, dashboard-hero title) | layout, releases, list |
| 003 | release-detail-page | Full-width release detail: graphs arrangement, type-graph form, facts density, rocket card? | B: 2×2 graph grid + side column (labels, mismatches), facts as chip row, waffle type graph | layout, release-detail, graphs, phase-94 |
| 004 | detail-edge-states | Do slots/facts stay calm across loading/empty/released/undated/overdue/no-GitLab? | — | states, release-detail, phase-94 |
| 005 | detail-narrow | How do header, facts and graph grid wrap at 420/640/900px? | — | responsive, release-detail, phase-94 |

## Phase 94 direction (sketches 003–005)
Release detail page redesign (94-CONTEXT D-01…D-14). Full width, no sidebar. The header mirrors ReleasesHero. Four graphs (burnup, type, assignee, MR donut) count issues; story points appear in tooltips only. Colour encodes status only, no legends, tooltips have ≤4 rows, each figure appears once. 003 winner is B. 004 states and 005 widths render on B in the 003 hub (`003-release-detail-page/index.html`).

