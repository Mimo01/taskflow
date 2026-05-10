---
status: complete
---

# Quick Task 260510-5b: Fix pre-commit hook failures

## What was done

**Task 1 — Biome formatter/import-sort errors (49 errors → 0)**

Ran `npx biome check --write` which auto-fixed 45 files:
- Formatter drift in source files and test files
- Unsorted import blocks
- `biome.json` itself had a formatting issue (object property expansion)

**Task 2 — Failing BacklogPage test**

`BACK-02 > moving an issue to a sprint invalidates jira-backlog-sprint-stories cache key` was failing because a `ConfirmSprintMoveDialog` was added after the test was written. Clicking a sprint option in the context menu now opens the dialog first; `addIssuesToSprint` and `invalidateQueries` are only called after confirming. Added the missing confirmation step:

```
await waitFor(() => { expect(screen.getByText('Move Issue')).toBeInTheDocument(); });
fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
```

## Result

- `npm run check`: 0 errors (576 warnings, all pre-existing)
- `npm run test`: 90/90 test files pass, 892 tests pass
- Pre-commit hook now passes cleanly
