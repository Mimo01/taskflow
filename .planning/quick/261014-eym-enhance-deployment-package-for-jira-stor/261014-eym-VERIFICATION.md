---
phase: quick-261014-eym
verified: 2026-10-14T00:00:00Z
status: human_needed
score: 7/7 must-haves verified in code (live-Jira behaviour untested)
gaps: []
human_verification:
  - test: "Open a Story whose Deployment package is set and confirm the field's JSON shape ({key}, string, or array) is read correctly"
    expected: "Row shows the RM child key and summary"
    why_human: "Real customfield_15725 shape was never probed live"
  - test: "Click 'Set deployment package to RM-xxx' on a fix-version-only Story"
    expected: "Jira accepts the PUT (array or bare key per editmeta) and the warning clears after refetch"
    why_human: "PUT acceptance and edit-screen permissions can't be tested offline"
  - test: "With a real RM project, check the week index"
    expected: "WEEK parents list their per-application children (sub-task, parent, Epic Link or issue link) and the child match by project name resolves"
    why_human: "How RM children hang off the WEEK parent is unconfirmed (assumption A3); fetchRmWeekIndex tries all four mechanisms"
  - test: "Releases tab: run 'Sync deployment packages' on a test version"
    expected: "Confirm dialog shows N stories, writes happen, and the summary reports updated and failed keys; one row per line is kept"
    why_human: "Live write and visual layout"
  - test: "Use a Jira user or project where editmeta lacks customfield_15725"
    expected: "Sidebar shows 'Open in Jira' instead of the package button; bulk sync shows the not-editable reason and writes nothing"
    why_human: "Needs a real editmeta response"
---

# Quick 261014-eym: Deployment package sync Verification Report

**Goal:** Enhance the Deployment package (customfield_15725) for Stories only: RM child link, sync with fix version through the release-date-in-week-range rule, warnings with one-click fixes in the sidebar and on release detail, display and bulk sync on the Releases tab, and a pickable RM project in settings.
**Status:** human_needed. All code-checkable truths are verified. Live Jira behaviour is routed to human verification, as instructed.
**Re-verification:** No.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Settings RM picker; with no project selected, the feature is inert | VERIFIED | `ReleaseManagementBlock.tsx` has a Select with a None option and an explicit label in the trigger. It is mounted in `IntegrationsSection.tsx:15`. `settings.store.ts` has `releaseManagementProjectKey`, a setter, version 30, and a `version < 30` migrate step. `useRmWeekIndex` is `enabled` only when the key and base URL are set. The warning returns null if `!rmEnabled`. The release-detail section and the Releases tab chip and sync button are gated on `rmEnabled`. |
| 2 | Sidebar shows the RM child and a warning when only one field is set or the date is outside the week | VERIFIED | `FieldsSection.tsx` uses `useRmWeekIndex().childToWeek` for the row, and `extractDeploymentPackage` is extended for `{key}`. `DeploymentPackageWarning` is rendered at line 1128 directly under the Deployment package row. It calls `evaluatePackageSync`. The pure lib implements the none, ok, pkg-only, fv-only, mismatch and unresolved states with inclusive string-compare week ranges. |
| 3 | One-click fixes in both directions; clicking writes Jira and the warning clears on refetch | VERIFIED in code | `applyFix` calls `mutation.mutate` with `customfield_15725` (`buildPackageFieldValue` in the editmeta shape) or `fixVersions` (`computeFixVersionsForFix`). `useFieldMutation` does an optimistic update and then invalidates `jira-issue-detail`. A mismatch renders both buttons. The live write is a human item. |
| 4 | Epics and Subtasks never show the warning | VERIFIED | `active = rmEnabled && issueTypeName === 'Story'`. `planBulkSync` also filters `issuetype.name === 'Story'`. |
| 5 | Release detail lists Stories with disagreeing fix version and package, with fix actions, separate from MR drift | VERIFIED | `DeploymentPackageSection.tsx` (170 lines) is mounted in `ReleaseDetailPage.tsx:247` and uses `useDeploymentPackageSync.applyFix`. `driftDetection.ts` is unchanged (diff empty). Its tests pass. |
| 6 | Releases tab shows the derived package per row, plus a per-row sync that confirms, writes per story and reports per-item results | VERIFIED | `derivePackage` (findWeekForDate then findChildForProject) renders the chip `row-deployment-package`. There are no drift counts. A per-row `row-sync-packages` button runs `handleSyncClick`, which reuses the `['jira-fixversion-issues', id, storyPointsFieldKey]` key and `fetchQuery`. It shows the already-in-sync message when N=0, otherwise a confirm Dialog. `executeDeploymentPackageSync` writes sequentially with `bulkUpdateIssue`, collects `{key, ok, error}` without aborting, and invalidates queries. The status line lists the updated count and the failed keys. |
| 7 | When editmeta lacks the field, the fix buttons become a read-only warning plus an 'Open in Jira' link, and bulk sync is disabled with a reason | VERIFIED in code | `fetchDeploymentPackageEditShape` returns 'not-editable' if the field is absent or the response is non-ok. The sidebar shows 'Open in Jira' for set-package fixes. The hook returns `blocked` and `NOT_EDITABLE_REASON`. The Releases tab shows the reason inline on click, before the dialog and before any write (a documented deviation from pre-disabling the button; acceptable). |

**Score:** 7/7 code-verified.

## Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `lib/deployment-package.ts` | VERIFIED | 299 lines. Exports all the plan's functions plus `computeFixVersionsForFix` and `indexChildToWeek`. Pure, no Date objects. |
| `lib/deployment-package.test.ts` | VERIFIED | Passes. |
| `services/jira.ts` | VERIFIED | `fetchRmWeekIndex` (key regex check, quoted JQL, paginated, children from subtasks, parent, Epic Link and issuelinks). `fetchDeploymentPackageEditShape` (key regex check, editmeta). `fetchFixVersionIssues` appends 3 fields only; its JQL and order are unchanged. |
| `hooks/useRmWeekIndex.ts` | VERIFIED | Key `['rm-week-index', rmProject, baseUrl]`, staleTime 5 min. Also exports the edit-shape hook (30 min). |
| `settings.store.ts` | VERIFIED | v30 migration. |
| `DeploymentPackageWarning.tsx` | VERIFIED | 146 lines, wired into FieldsSection. |
| `DeploymentPackageSection.tsx` and `useDeploymentPackageSync.ts` | VERIFIED | Wired into ReleaseDetailPage and ReleasesTab. |

## Key Links

All WIRED: FieldsSection to DeploymentPackageWarning to evaluatePackageSync; the warning to mutation with `customfield_15725`; ReleasesTab to `planBulkSync` and `executeDeploymentPackageSync`; useRmWeekIndex to `fetchRmWeekIndex`. ReleasesTab uses the exported `executeDeploymentPackageSync` rather than `useDeploymentPackageSync` directly, so the link is wired through the shared function, which is equivalent.

## Behavioral Spot-Checks

| Check | Result |
|-------|--------|
| `tsc --noEmit -p .` | Clean |
| vitest: lib, settings store, routes/dashboard, components/integrations, routes/settings | 87 files passed, 1590 tests passed, 0 failures |
| Debt markers (TBD, FIXME, XXX) in new files | None |

## Requirements

QUICK-261014-eym: satisfied in code. All CONTEXT decisions are implemented (Stories only, inclusive week range, child match by project name, both fix directions, Releases tab display and bulk sync, global RM picker, inert when unset).

## Anti-Patterns

None blocking. Minor notes (not gaps):
- The optimistic fixVersions update writes `{id}` only (no name), so the sidebar may briefly show an unnamed version until the refetch. This is the same payload shape the existing fix-versions edit uses.
- The sidebar warning is suppressed while `weeks.length === 0`. If the RM index loads empty or errors, there is no warning. This is deliberate, to avoid a flash.
- Bulk sync is one-directional (fix version to package), as documented and as the plan specified. Per-row fixes cover both directions.

## Human Verification Required

See the frontmatter. Five items, all dependent on live Jira: the field JSON shape, PUT acceptance, RM child linkage, the bulk sync write and layout, and the editmeta not-editable fallback.

## Gaps Summary

No code gaps. The phase goal is implemented and wired, and tests and tsc pass. The remaining risk is the unprobed live Jira assumptions listed above.

---
_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
