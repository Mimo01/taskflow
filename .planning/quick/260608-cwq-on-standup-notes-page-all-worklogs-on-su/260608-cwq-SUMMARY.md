---
status: complete
---

# Quick Task 260608-cwq Summary

**Task:** On standup notes page, all worklogs on subtask/story are grouped together. I want to see each log separately with its description.
**Date:** 2026-06-08
**Commits:** abb5fcde, 63900847, 47531165

## What Changed

**`IssueActivityGroup.tsx`** — Added `description?: string` to `SubItem` interface. Worklog rows now render as a single line: duration in normal text + ` · description` in muted text (when present). Removed two-line flex-col layout and `mt-0.5` icon offset; both clickable-issue and plain div branches use `items-center` consistently.

**`YesterdayColumn.tsx`** — Replaced the `worklogByGroup` accumulation map with a flat push of one `SubItem` per raw `TempoWorklog`. Each worklog's `comment` populates the `description` field. Group `totalSeconds` accumulation preserved for the stat header. `generateMarkdown` updated to append description to worklog lines.

## Outcome

Each Tempo worklog entry on the standup notes page appears as its own row. Duration and description are on one line, visually consistent with other sub-item rows. Worklogs with no description show duration only (no placeholder clutter). Subtask click-through and group total-hours stat unchanged.
