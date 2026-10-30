# Sketch Wrap-Up Summary

**Date:** 2026-10-29
**Sketches processed:** 2
**Design areas:** Page layout & header · Timeline graph · Release list
**Skill output:** `./.claude/skills/sketch-findings-taskflow/` (temporary)

> **Lifecycle:** temporary. The user does not want any of this to persist once the Releases page is finished. When Phase 94 closes (93 and 94 both done), archive `.planning/sketches/` and `.claude/skills/sketch-findings-taskflow/`, for example by moving them under the Phase 93 directory or the milestone archive. No `CLAUDE.md` routing line was added, on purpose.
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

---

# Wrap-Up 2: release detail page (Phase 94)

**Date:** 2026-10-30
**Sketches processed:** 3 (003, 004, 005)
**Design areas:** Release detail page · Release detail states
**Skill output:** appended to `./.claude/skills/sketch-findings-taskflow/` (still temporary; still no CLAUDE.md routing line, by choice)

> `.claude/` is gitignored. Planners and executors should use the committed sources here, `.planning/sketches/003-release-detail-page/index.html` (B ★, Compact ★, States row), plus the READMEs, or the skill's absolute path.

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 003 | release-detail-page | B + round-2 app-style header | Release detail page |
| 004 | detail-edge-states | all 8 states (on B) | Release detail states |
| 005 | detail-narrow | N2 Compact | Release detail page (responsive) |

## Excluded Sketches
none

## Design Direction
The release detail page matches the app's other detail pages (AIO cycle detail). Header: a `text-lg` title + pill, Refreshed + icon refresh + Pin / Edit / Open in Jira, and a single `text-xs` meta line. Below it: one done bar, then a calm 2×2 graph grid with the labels/mismatches column beside it, then the task table.

## Key Decisions
- **Header:** follows `CycleHeader`, not ReleasesHero. **This supersedes 94-CONTEXT D-11.**
- **Facts:** `Name: value` items in the meta line, with inline Create branch / Create milestone / Retry actions and tone only on problems. **This supersedes D-08's chips.**
- **Graphs:** a quad with burnup | MR donut on top and by assignee (avatar rows) | by type (waffle, one square per issue) below. Labels + Deployment package mismatches sit in a right side column that folds under the graphs at ≤980px.
- **States:**
  - Every slot has a fixed size; skeletons hold that size while loading.
  - Empty data shows muted placeholders, never 0/0 charts.
  - Without GitLab, the burnup spans the row; with no labels and no mismatches, the grid goes single-column.
- **Burnup axis:** starts at the previous version (fallback: the earliest created issue). It ends at the release date, or at today when undated or overdue.
- **Narrow (N2 Compact):** icon-only actions; donut + waffle side by side until 440px; burnup 160px tall.
- **Data needs:** an MR draft flag (for the draft slice), plus `created` and `resolutiondate` on `fetchFixVersionIssues`.
