---
status: resolved
trigger: "On worklogs page, when I want to log time on a day, the date input doesn't start pre-filled on the date clicked"
created: 2026-05-25
updated: 2026-05-25
---

# Debug Session: worklog-date-not-prefilled

## Symptoms

- **Expected behavior:** Clicking a day on the worklogs page to log time should open the log-time dialog with the date input pre-filled to the clicked day's date.
- **Actual behavior:** The date input shows today's date instead of the day that was clicked.
- **Error messages:** None reported.
- **Timeline:** Unclear whether it ever worked correctly.
- **Reproduction:** Multiple entry points open the log-time dialog — clicking a day cell and/or a dedicated "log time"/+ button. The date is not seeded from the clicked day in at least one path.

## Current Focus

- hypothesis: LogWorkPopover has no initialDate prop and always seeds date state from todayString(); WorklogCellPopover does not pass the cell date to it.
- test: Trace prop flow from WorklogCellPopover date prop → LogWorkPopover
- expecting: LogWorkPopover interface has no initialDate prop; WorklogCellPopover omits date prop
- next_action: done
- reasoning_checkpoint: confirmed and fixed

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
  lines: 20-24, 36
  observation: |
    LogWorkPopoverProps interface had no initialDate field.
    date state initialized with `useState(todayString)` — always today.
    resetForm() also called `setDate(todayString())` — reset to today on every open.

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/worklogs/WorklogCellPopover.tsx
  lines: 88-93
  observation: |
    LogWorkPopover rendered with only issueKey, jiraBaseUrl, onSuccess.
    The cell's `date` prop (YYYY-MM-DD) was never passed to LogWorkPopover.

## Eliminated

- State reset on popover close: `onOpenChange` calls `resetForm()` only when opening (if (o) resetForm()), but the state was initialized to today regardless — this is a secondary symptom of the same root cause, fixed by the same change.

## Resolution

- root_cause: LogWorkPopover lacked an initialDate prop; its date state always initialized to todayString(). WorklogCellPopover had the correct YYYY-MM-DD date available but never forwarded it to LogWorkPopover.
- fix: Added optional `initialDate?: string` prop to LogWorkPopoverProps. date state now initializes with `initialDate ?? todayString()`. resetForm() uses the same expression so re-opening the popover stays on the clicked date, not today. WorklogCellPopover now passes `initialDate={date}` to LogWorkPopover.
- verification: code change applied; no automated tests exist for this interaction
- files_changed:
  - taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
  - taskflow/src/routes/worklogs/WorklogCellPopover.tsx
