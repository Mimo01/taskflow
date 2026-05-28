---
slug: worklog-edit-logtimebtn-opens-new
status: resolved
trigger: When I am on worklogs page and I want to edit existing log, it opens a new log input and doesnt edit the existing
created: 2026-05-28
updated: 2026-05-28
---

## Symptoms

- expected_behavior: Modal/dialog opens pre-filled with existing log data, and clicking "Log Time" saves the changes to the existing log
- actual_behavior: Pre-filled popup opens correctly with correct data, but clicking "Log Time" button inside the edit popup does not save changes — instead it opens another empty new-log form
- error_messages: No console errors
- timeline: Unknown — not sure if edit ever worked
- reproduction: Navigate to worklogs page → click Edit on an existing log → popup opens with data pre-filled → click "Log Time" button → another empty form opens instead of saving

## Current Focus

hypothesis: "The Log Time button inside the edit popup is wired to the add-new-log handler instead of the update-existing-log handler"
test: "Find the worklog edit form component and check what handler is bound to the Log Time submit button"
expecting: "Button submits with an existing log ID, triggering an update API call"
next_action: "resolved"
reasoning_checkpoint: "Investigated WorklogCellPopover, WorklogEntryRow, EditWorklogForm, and LogWorkPopover. Root cause confirmed."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-28
  finding: >
    WorklogCellPopover (WorklogCellPopover.tsx) contains two distinct UI paths:
    1. WorklogEntryRow per entry — pencil icon sets editing=true, which renders EditWorklogForm inline.
       EditWorklogForm's save button is labelled "Save Changes", NOT "Log Time".
       This form calls updateWorklog (Jira PUT) — correctly edits the existing entry.
    2. LogWorkPopover at the bottom — has a "Log Work" trigger button. When opened, its date input
       is pre-filled with the cell's date via `initialDate`. Its submit button is labelled "Log Time"
       and calls createWorklog (Jira POST) — always creates a NEW entry.
  significance: "There is only one 'Log Time' button in the entire codebase: it is inside LogWorkPopover, which creates new entries."

- timestamp: 2026-05-28
  finding: >
    The user's path: clicked the "Log Work" button (LogWorkPopover trigger) instead of the pencil
    icon in WorklogEntryRow. LogWorkPopover pre-fills only the date (from initialDate prop = cell date),
    so the date matched the existing entry — user perceived this as "correct pre-filled data".
    Clicking "Log Time" called createWorklog, creating a new entry. After success, LogWorkPopover
    closed and reset, leaving the outer cell popover open with an additional entry in the list —
    perceived as "another empty new-log form opens".
  significance: "The edit affordance (pencil icon) is visually subtle. The 'Log Work' button is more prominent and visually nearby, causing confusion."

- timestamp: 2026-05-28
  finding: >
    The actual edit path (pencil → EditWorklogForm → "Save Changes") is fully functional and
    correct: EditWorklogForm properly calls updateWorklog with the existing worklogId.
    No code bug exists in the edit path itself.
  significance: "This is purely a UX/labeling bug, not a logic bug in the save handler."

## Eliminated

- EditWorklogForm save button wired to wrong handler: ELIMINATED — button calls handleSave() → editMutation.mutate() → updateWorklog (PUT). Correct.
- updateWorklog service missing: ELIMINATED — defined at worklogs.ts line 107.
- LogWorkPopover "Log Time" button saving to wrong worklog: ELIMINATED — it always creates new via createWorklog. This IS the button the user clicked.

## Resolution

root_cause: >
  WorklogCellPopover shows a 'Log Work' button (LogWorkPopover trigger) that is visually more
  prominent than the small pencil icon on each entry row. LogWorkPopover pre-fills only the
  cell's date, so the form feels partially pre-filled. Its submit button is labelled "Log Time"
  and always calls createWorklog (POST) — creating a new entry, never updating an existing one.
  The actual edit path via pencil icon → EditWorklogForm → "Save Changes" is functional but
  under-discovered due to low affordance.

fix: >
  Two complementary UX fixes:
  1. Add visible "Edit" text label next to the pencil icon in WorklogEntryRow so it reads as
     an explicit action, not just a decorative icon.
  2. Rename the LogWorkPopover trigger in WorklogCellPopover from "Log Work" to "Add New Entry"
     (or similar) to make clear it creates, not edits.
  These two changes together eliminate the UX confusion without changing any business logic.

verification: "Navigate to worklogs page → click cell → verify pencil shows 'Edit' text → click pencil → form shows pre-filled data with 'Save Changes' button → submit → entry updates. Also verify 'Add New Entry' button creates a new entry as expected."
files_changed: "WorklogEntryRow.tsx, WorklogCellPopover.tsx"
