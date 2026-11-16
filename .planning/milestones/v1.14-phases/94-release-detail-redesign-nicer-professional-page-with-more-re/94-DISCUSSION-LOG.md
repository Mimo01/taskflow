# Phase 94: Release detail redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-30
**Phase:** 94-release-detail-redesign-nicer-professional-page-with-more-re
**Areas discussed:** Which release graphs, Page layout & sidebar, Header character, Actions & field edits

---

## Which release graphs

| Option | Description | Selected |
|--------|-------------|----------|
| Burnup over time | Scope vs done to the release date; needs created/resolutiondate | ✓ |
| Issues by type | Done-vs-open per type | ✓ |
| Issues by assignee | Per-person open vs done | ✓ |
| MR state graph | Merged/open/draft/closed | ✓ |

**Measure:** Issues, with SP in tooltips (picked over Story points or an Issues/SP toggle).

**Burnup axis start:** the user wrote "last release". Follow-up: previous version by date, released or not (picked over previous *released* version).

**Forecast line:** "you decide". Claude: no forecast; TODAY and release-date markers.

**Breakdown form:** "you decide, I want variety". Claude: burnup area chart, MR donut, assignee avatar rows with slim bars, type as compact stacked bars. Colour stays status-only.

**Sidebar counts:** fold into the graphs (picked over keeping the sidebar counts too).

---

## Page layout & sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Main column + slimmer sidebar | Keep the resizable sidebar for GitLab facts | |
| Full-width dashboard | No sidebar; facts strip; full-width graphs and table | ✓ |
| Tabs: Overview / Tasks | Graphs and table on separate tabs | |

**Sketch first:** yes (picked over locking the layout from the discussion).
**Facts strip form:** "you decide". Claude: chips with tooltip detail, inline create actions.
**Descriptions:** "you decide". Claude: muted 2-line clamp under the title.

---

## Header character

| Option | Description | Selected |
|--------|-------------|----------|
| F5 hero echo | Ambient curves, large title | |
| Calm standard header | text-xl standard bar | |
| Hero for next release only | Hero unreleased, muted released | |

**User's choice:** "you decide. see how we did the releases page in the app". Claude: mirror the shipped `ReleasesHero` (standard bar, text-3xl, Stat summary line, Updated · Refresh).
**Timing:** "you decide". Claude: the pill text carries the countdown, with the absolute date beside it.

---

## Actions & field edits

| Option | Description | Selected |
|--------|-------------|----------|
| Compact sticky bar on scroll | Slim bar once the header scrolls away | |
| Whole header sticky | Full header pinned | |
| Not sticky | Actions at top only | |

**User's choice:** "see how the rest of the app has it". Claude: the AIO cycle detail model. The header scrolls away and the table column header sticks.

**Field edits:** "you decide". Claude: keep EditReleaseModal; no inline editing.

---

## Claude's Discretion

- Burnup forecast (none), graph forms, facts-strip form, description placement, header style, timing display, field edits, loading and empty states, narrow-width grid, skeleton rebuild.

## Deferred Ideas

- Inline field editing; projected-finish forecast.
