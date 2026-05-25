---
name: standup-copy-yesterday-label
status: resolved
trigger: "In standup notes, when I click on copy markdown the md says 'yesterday' even when last working day wasn't yesterday"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **Expected:** Copied markdown header should show the actual date (e.g. "Friday, May 23") instead of "Yesterday" when last working day was not the day before today
- **Actual:** Header reads `## Yesterday (2026-05-23)` even on Monday when last working day was Friday
- **Error messages:** None reported
- **Timeline:** First noticed today (Monday after weekend) — may have always been like this
- **Reproduction:** Open standup notes page on a Monday (or after any non-yesterday working day), click Copy Markdown

## Current Focus

- hypothesis: "generateMarkdown() hardcoded 'Yesterday' instead of calling getColumnHeading()"
- test: "generateMarkdown({}, '2026-05-22') with today pinned to 2026-05-26"
- expecting: "## Friday (2026-05-22)"
- next_action: "done"
- reasoning_checkpoint: "getColumnHeading() already existed and had correct logic; generateMarkdown just never called it"
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-26T14:31
  file: taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  finding: "Line 120 — const lines: string[] = [`## Yesterday (${date})`, '']; — hardcoded 'Yesterday'"
  eliminated: false

- timestamp: 2026-05-26T14:31
  file: taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  finding: "getColumnHeading(dateStr) at line 78 already returns 'Yesterday' when date == calYesterday, else the day name (Sunday/Monday/etc) — it just was not called from generateMarkdown"
  eliminated: false

## Eliminated

## Resolution

- root_cause: "generateMarkdown() on line 120 of YesterdayColumn.tsx hardcoded the string 'Yesterday' in the markdown header instead of calling the existing getColumnHeading(date) helper, which already implements the correct calendar comparison."
- fix: "Changed line 120 from `## Yesterday (${date})` to `## ${getColumnHeading(date)} (${date})`. One-character delta. Added regression tests covering both the 'Yesterday' case (date is calendar-yesterday) and the day-name case (date is before calendar-yesterday, e.g. Friday when today is Tuesday after a weekend)."
- verification: "8/8 tests pass in YesterdayColumn.test.ts including 2 new regression tests."
- files_changed: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx, taskflow/src/routes/standup-notes/YesterdayColumn.test.ts"
