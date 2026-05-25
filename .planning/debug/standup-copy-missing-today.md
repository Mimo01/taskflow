---
name: standup-copy-missing-today
status: resolved
trigger: "On standup notes page the copy markdown only copies yesterday, not today"
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **Expected:** Copy both yesterday and today sections when clicking "Copy Markdown" on the standup notes page
- **Actual:** Only yesterday's content is copied; today's entries are missing from clipboard output
- **Error messages:** None reported
- **Timeline:** Just noticed — not sure when it broke
- **Reproduction:** Open standup notes page, click Copy Markdown — happens every time

## Current Focus

- hypothesis: "handleCopyMarkdown in StandupNotesPage only calls generateMarkdown (yesterday data) — there is no today section generation at all"
- test: "code review of handleCopyMarkdown and generateMarkdown"
- expecting: "generateMarkdown returns only ## Yesterday block; no Today block is constructed or appended"
- next_action: "fix: extend handleCopyMarkdown to also generate a Today section and append it to the clipboard text"
- reasoning_checkpoint: "confirmed by reading StandupNotesPage.tsx lines 272-292 — handleCopyMarkdown calls generateMarkdown(yesterdayData) and writes that alone to clipboard. TodayColumn owns all today state internally and exposes no data or generator function upward."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  lines: 272-292
  note: "handleCopyMarkdown calls generateMarkdown() with only the four yesterday queries (tempo, jira, commits, mrEvents). No today data is read or passed. The function signature in YesterdayColumn.tsx line 111 confirms generateMarkdown only produces a ## Yesterday block."

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/standup-notes/TodayColumn.tsx
  lines: 86-312
  note: "TodayColumn owns all today state: sprintQuery (inProgress/upNext), todayTempoQuery, reviewerMrsQuery, participatingMrsQuery. None of these are hoisted to StandupNotesPage. TodayColumn exposes no generateTodayMarkdown export or callback."

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  lines: 111-154
  note: "generateMarkdown() only ever builds '## Yesterday (date)' lines. There is no Today section in its output."

## Eliminated

- UI rendering bug (today column renders fine — data fetch is not the problem)
- Missing today data in queries (queries exist in TodayColumn but are not exposed upward)

## Resolution

- root_cause: "handleCopyMarkdown in StandupNotesPage.tsx only calls generateMarkdown() which produces a Yesterday-only block. The today queries (sprint issues, today Tempo worklogs, reviewer MRs, participating MRs) live exclusively inside TodayColumn and are never passed up to the page-level copy handler. No generateTodayMarkdown function exists."
- fix: "Exported generateTodayMarkdown + todayQueryKeys from TodayColumn.tsx. In StandupNotesPage.tsx: added useQueryClient, storyPointsFieldKey, jiraUserDisplayName, todayStr; handleCopyMarkdown now reads TodayColumn's cached query data and concatenates yesterday + today markdown."
- verification: "tsc --noEmit passes clean"
- files_changed: "taskflow/src/routes/standup-notes/TodayColumn.tsx, taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
