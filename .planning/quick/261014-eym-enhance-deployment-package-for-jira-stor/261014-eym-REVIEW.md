# Review 261014-eym (advisory, quick depth) — no blockers; all warnings fixed

| ID | Finding | Resolution |
|----|---------|------------|
| WR-01 | "Set fix version" silently dropped other dated fix versions | Fix carries `removes`; suggestion/label read "R-43 (replaces R-44)" |
| WR-02 | Bulk sync overwrote package on multi-version stories | `planBulkSync` skips stories whose current package already matches another of their fix versions |
| WR-03 | Unparseable package treated as "no package" (offered overwrite) | `isPackageFieldUnreadable` → state `unresolved`, no fixes; bulk sync skips them |
| WR-04 | Release detail used only the active project's fix versions | Fix versions fetched per distinct story project; per-project list passed to evaluate and `applyFix` |
| WR-05 | Bulk sync used one story's editmeta shape for all | Shape resolved per project; non-editable projects reported as failed items, blocked only if none editable |
| WR-06 | `31.02.2026` accepted as a date | `toYmd` validates via `Date.UTC` round-trip |
| WR-07 | Week index limited to `created >= startOfYear(-1)` | `summary ~ "WEEK*"` query unbounded; only the fallback full scan bounded (`startOfYear(-2)`) |
| WR-08 | Other rows' sync buttons usable while prompt open | Disabled while `syncPrompt`/`syncRunning` |
| IN-03 | Invalid key retried 3x | `retry: false` on `useRmPackage` |
| IN-04 | Duplicate key regex | `ISSUE_KEY_RE` exported from lib, reused in jira.ts |
| IN-01 | Unused plan/run computed in Section | Removed the dead `plan`/`run`/`results`/`isRunning`/`blockedReason` from `useDeploymentPackageSync` (only `applyFix` was used); bulk sync stays in `executeDeploymentPackageSync` |
| IN-02 | "Open in Jira" not disabled while pending | Disabled while a write is pending |
| — | Raw Jira text on a failed single fix | `describeWriteError`: 401/403 and edit-screen errors become plain sentences (single and bulk writes) |
