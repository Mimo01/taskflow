---
phase: quick-261103-cln
verified: 2026-11-03T09:30:00Z
status: human_needed
score: 8/8 must-haves verified (code level)
human_verification:
  - test: "Open a release detail page with MRs in each state and compare the callout against Deployment package mismatches. Resize narrow."
    expected: "Matching orange callout look. Every row stays on one line at every width. State pill collapses to an icon at narrow widths. Show all N expands."
    why_human: "Visual appearance and responsive layout cannot be checked by grep or vitest."
  - test: "Click Apply on a Not-in-version row against live Jira DC."
    expected: "The fix version is added, the task's other fixVersions are kept, and the MR moves to the primary table."
    why_human: "The add-by-id verb (update.fixVersions add) is unproven against live Jira. The code comment names the add-by-name fallback."
  - test: "Use Link task on a No-task row, including a Draft: MR, against live GitLab."
    expected: "The title becomes 'KEY title' with the draft prefix preserved, and the MR moves to the primary table."
    why_human: "Live GitLab PUT title behavior."
---

# Quick 261103-cln Verification

**Goal:** Restyle the "Not covered by tasks above" section like "Deployment package mismatches" (same position) and add per-row fixes: Apply (Not in version), Link task (No task), none (Not evaluated).

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Orange callout in the same place, inside UnifiedTaskTable under the task list | VERIFIED | `UnifiedTaskTable.tsx:1600` `secondary-section` div uses `CALLOUT_SECTION_CLASS`. The h3 has AlertTriangle, the title, a `secondary-count` pill and a hint. The header strip uses `CALLOUT_HEADER_CLASS`, the list uses `CALLOUT_LIST_CLASS` and rows use `CALLOUT_ROW_CLASS`. The amber state pill is at `:189`. |
| 2 | First 5 rows plus Show all N, based on filtered rows | VERIFIED | `:1322-1323` slice `filteredSecondaryRows` by `CALLOUT_VISIBLE_ROWS`. The `secondary-show-all` button is at `:1705`. |
| 3 | Not in version: Apply adds the fix version and keeps the others; per-key dropdown when there are several keys | VERIFIED | `addIssueFixVersion` (jira.ts) sends `update.fixVersions [{add:{id}}]` after an ISSUE_KEY_RE check. `ApplyFixVersionAction` renders a button for one key and a dropdown for several. `applyFixVersion` awaits invalidation of `jira-fixversion-issues`. |
| 4 | No task: Link task picker over this release's issues prepends the key to the MR title, draft prefix preserved | VERIFIED | `LinkTaskAction` uses Popover plus cmdk over `releaseIssues` (primaryRows' issues). `linkTask` calls `updateMergeRequest` with `prependTaskKeyToTitle`. The draft regex covers `[draft]`, `(draft)`, `draft:` and `wip:`. The caches are patched and invalidated only after success. |
| 5 | Not evaluated: muted pill, no action | VERIFIED | `actionCell` is only set for the not-in-fix-version and no-linked-task reasons. The unevaluated pill uses `MUTED_STATE_PILL_CLASS`. |
| 6 | Per-row pending, plus an inline role=alert error that survives re-render | VERIFIED | `useNotCoveredFixes` keeps `pending` and `errors` at section level, keyed by mr.id. `MrSubLine` renders the error with `role="alert"` (`:786`). |
| 7 | One line per row at every width | UNCERTAIN (visual) | Row classes follow the callout pattern with sr-only and hidden columns. This needs a human check. |
| 8 | BR/MS Retarget / Assign-milestone still work on secondary rows | VERIFIED | The BR/MS cells are kept in `MrSubLine`. The UnifiedTaskTable tests pass. |

Wiring: `ReleaseDetailPage.tsx:569` passes `jiraFix={versionId ? {baseUrl, versionId} : undefined}`. `gitlab.ts` `updateMergeRequest` accepts `title` and keeps the explicit pick. `DeploymentPackageSection` imports from `calloutSection` (values copied verbatim).

## Spot-checks
- `npx vitest run src/routes/dashboard src/services/gitlab.test.ts src/services/jira.test.ts`: 105 files passed, 2153 tests passed.
- `npx tsc --noEmit`: clean.
- No TBD/FIXME/XXX in the new files.

## Gaps
None found at code level. Live Jira/GitLab behavior and visual layout are routed to the human items above.
