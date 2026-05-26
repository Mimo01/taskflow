---
slug: worklogs-key-click-time-cursor
status: resolved
trigger: "On Worklogs page, the issues are clickable. But only the title column. Key should also be clickable. Time column shouldn't have cursor pointer (it doesn't do anything)"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **Expected:** On the Worklogs page, both the issue Title column AND the Key column should be clickable links to navigate to the issue.
- **Actual:** Only the Title column is clickable. The Key column is not clickable.
- **Extra issue:** The Time column has a cursor pointer style but clicking it does nothing — the pointer cursor should be removed.
- **Error messages:** None reported.
- **Timeline:** Unknown.
- **Reproduction:** Navigate to Worklogs page, observe the issue rows — only title is a link, key is plain text, time column shows pointer cursor.

## Current Focus

hypothesis: The Worklogs table renders Key as plain text instead of a link, and Time column has cursor-pointer CSS applied incorrectly
test: ~
expecting: ~
next_action: resolved

## Evidence

- timestamp: 2026-05-26
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx
  finding: |
    Three row types (epic, story, subtask) all had cursor-pointer on the <tr> element,
    causing the entire row — including the Time column — to show a pointer cursor.
    The Key <td> in each row rendered the key as plain text with no onClick handler.
    Only the Title <td> wrapped its content in a <button onClick={() => onIssueClick(key)}>.

## Eliminated

## Resolution

root_cause: |
  In WorklogsPage.tsx, the Key column <td> for epic, story, and subtask rows rendered
  the issue key as plain text with no click handler. Additionally, cursor-pointer was
  set on each <tr> element rather than only on the interactive button children, causing
  the Time column (and all other non-interactive cells) to incorrectly show a pointer cursor.

fix: |
  1. Added a <button onClick={() => onIssueClick(key)} className="cursor-pointer hover:underline">
     wrapper around the key text in each of the three row types (epic, story, subtask).
  2. Removed cursor-pointer from all three <tr> className values (epic, story, subtask rows).
     The pointer cursor is now scoped to the button elements inside Title and Key cells only.

verification: TypeScript type-check passes (tsc --noEmit, no errors).
files_changed: taskflow/src/routes/worklogs/WorklogsPage.tsx
