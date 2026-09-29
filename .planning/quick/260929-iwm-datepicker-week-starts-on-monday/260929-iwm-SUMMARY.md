# Quick 260929-iwm: Datepicker week starts on Monday

Shared `Calendar` (calendar.tsx) now defaults `weekStartsOn = 1` and passes it to DayPicker before the `{...props}` spread, so every DatePicker shows Mon..Sun and callers can still override.

- Commit: 0790e2a5
- Files: taskflow/src/components/ui/calendar.tsx, taskflow/src/components/ui/date-picker.test.tsx
- Test "starts the week on Monday" was run first and failed (first header "Sunday"), then passed after the fix. Full vitest suite passed via pre-commit hook.
- Deviations: worktree base was reset to 42ccd13c per branch check; node_modules symlinked (gitignored) from main checkout to run tests.

## Self-Check: PASSED

## Human UAT
2026-09-29: Approved by user — date pickers start the week on Monday across the app.
