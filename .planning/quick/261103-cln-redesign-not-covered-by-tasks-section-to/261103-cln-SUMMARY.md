---
phase: quick-261103-cln
plan: 01
subsystem: release-detail
tags: [ui, jira, gitlab, callout, fix-actions]
requires: []
provides:
  - calloutSection shared orange-callout constants
  - addIssueFixVersion (Jira update.fixVersions add verb)
  - updateMergeRequest title support
  - useNotCoveredFixes / prependTaskKeyToTitle
  - ApplyFixVersionAction / LinkTaskAction
affects: [UnifiedTaskTable, DeploymentPackageSection, ReleaseDetailPage]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/calloutSection.ts
    - taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts
    - taskflow/src/routes/dashboard/release-detail/notCoveredFixes.test.tsx
    - taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
decisions:
  - Apply uses update.fixVersions add verb (keeps other versions), not fields.fixVersions
  - Link task is pessimistic (write, then patch caches from response) with section-level pending/errors keyed by mr.id
  - Per-reason chips dropped; single count pill
metrics:
  completed: 2026-11-03
---

# Phase quick-261103-cln Plan 01: Not-covered section as orange callout with fixes Summary

The "Not covered by tasks above" section now matches "Deployment package mismatches" (shared orange callout constants), with per-row Apply (adds the release fix version, keeping other versions) and Link task (searchable release-issue picker that prepends the key to the MR title, draft prefix preserved).

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1. Service writes + title helper + fix hook | aa5e5d59 | updateMergeRequest title, addIssueFixVersion, useNotCoveredFixes, tests |
| 2. Callout constants + restyled section + actions | 72460870 | calloutSection.ts, NotCoveredFixActions.tsx, UnifiedTaskTable restyle, tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PopoverContent has no `align` prop**
- **Issue:** the plan asked for `align="end"` on the Link task PopoverContent, but the shared `components/ui/popover.tsx` wrapper does not forward positioner props (tsc error).
- **Fix:** dropped `align`; the Base UI positioner's default collision handling keeps the popup on screen. The shared component was not modified.
- **Files:** NotCoveredFixActions.tsx

**2. Header label wording** - the MR-state column header is now "MR state" (plan list) so it does not collide with the new leading "State" pill column.

No production code was bent to satisfy test mocks.

## Known Stubs

None.

## Threat Flags

None. No new endpoints beyond the planned Jira/GitLab writes; ISSUE_KEY_RE guards the Jira path (T-cln-01).

## Verification

- Full vitest suite: 4281 passed (pre-commit hook, both commits); tsc clean; biome clean on touched files.
- Pending human UAT (per plan verification): visual comparison with the package callout, narrow-width one-line rows, live Apply / Link task against Jira/GitLab (RESEARCH A1: if Jira DC rejects add-by-id, fall back to `{add:{name}}`).

## Self-Check: PASSED
