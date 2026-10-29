# Sketch Wrap-Up Summary

**Date:** 2026-10-29
**Sketches processed:** 2
**Design areas:** Page layout & header · Timeline graph · Release list
**Skill output:** `./.claude/skills/sketch-findings-taskflow/` (temporary)

> **Lifecycle:** temporary. The user does not want any of this to persist once the Releases page is finished. When Phase 93 closes, archive `.planning/sketches/` and `.claude/skills/sketch-findings-taskflow/`, for example by moving them under the Phase 93 directory or the milestone archive. No `CLAUDE.md` routing line was added, on purpose.
>
> **Note:** `.claude/` is gitignored, so the skill is local-only and is NOT visible inside executor worktrees. When planning or executing, reference the committed sketch sources here (`.planning/sketches/002-list-below-track/index.html`, tab "F5: final", plus its README), or pass the skill's absolute path `/Users/mimo/Documents/Projects/taskflow/.claude/skills/sketch-findings-taskflow/` to executors.

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | upcoming-overview | A4 (partial: real-date axis, full names, started-only bars, rejected directions) | Timeline graph |
| 002 | list-below-track | F5 (final) | Page layout & header · Timeline graph · Release list |

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|
| — | — | none. 001's A4 chip/track styling is superseded by F5 and was not carried forward |

## Design Direction
The page keeps the app's neutral look with more character: a dashboard-hero title, a real-date timeline graph, an agenda-rail list in which the next release is the main focus, and a separate Released panel.

## Key Decisions
- **Header:** ambient-curve hero, "Releases" at ~34px, and the summary line "17 planned · 1 overdue · 1 without date". No stat strip, and no repeat of the next release.
- **Graph:**
  - Uncarded, on a faint full-bleed band, with no divider under it.
  - Responsive 3–8 weeks; `range · +N later  [Today] ‹ ›`, where Today and ‹ are disabled at the base view.
  - Chips per release; only the next chip has a bar. Small filled axis dots; no orange; no No-date box.
- **List:**
  - L1 date stamps, a plain grey rail and F4 hollow rings (dark ring for next, red for overdue, dashed amber for undated). No orange.
  - The next-release Card keeps the rocket and stays the main focus.
  - One column system: issues (92px bar + "18/20" / "**8** to do" / "No issues yet") · team · timing.
  - Pills only on overdue, next, next+1 and undated rows; planned rows use plain countdown text, switching to weeks from 14 days.
- **Released:** a muted panel with the 3 most recent, "✓ N done" in green, and "Show older releases".
- **Names:** fix versions shown verbatim; RM packages shown as `WEEKnn RM-xx` with the full text on hover; Jira issues only (no GitLab/MR data).
