---
status: complete
---
# Summary 261102-euc

- `MrLabels`/`ReleaseMrDonut`: pills become `aria-pressed` toggle buttons when `onToggleLabel` is given (ring on active).
- `ReleaseDetailPage`: owns `labelFilter` (keyed by versionId so it resets per release), passes to graph and table.
- `UnifiedTaskTable`: `labelFilter` ANDs with br/ms filter on primary + secondary rows; notice text and Clear filter cover both.
- Tests added in MrLabels.test.tsx and UnifiedTaskTable.test.tsx; dashboard suite + tsc + biome green.
Unlabelled MRs are not filterable (out of scope).
