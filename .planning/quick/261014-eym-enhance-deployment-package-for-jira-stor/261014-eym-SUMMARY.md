---
phase: quick-261014-eym
plan: 01
subsystem: jira-deployment-package
tags: [jira, release-management, deployment-package, fix-version, settings]
requires: []
provides:
  - pure deployment-package lib (week range parsing, sync-state evaluation, bulk plan)
  - fetchRmWeekIndex / fetchDeploymentPackageEditShape in services/jira.ts
  - global Release Management project setting (settings store v30) and Integrations picker
  - sidebar warning with one-click fixes (Stories only)
  - release detail Deployment package drift section
  - Releases tab derived package chip and per-row bulk sync
affects: [FieldsSection, ReleaseDetailPage, ReleasesTab, IntegrationsSection]
tech-stack:
  added: []
  patterns: [editmeta-driven write shape, single shared week-index query, sequential bulk write with per-item results]
key-files:
  created:
    - taskflow/src/lib/deployment-package.ts
    - taskflow/src/hooks/useRmWeekIndex.ts
    - taskflow/src/components/integrations/ReleaseManagementBlock.tsx
    - taskflow/src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
    - taskflow/src/routes/dashboard/release-detail/useDeploymentPackageSync.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/settings/IntegrationsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
key-decisions:
  - "Package drift is a NEW DeploymentPackageSection; driftDetection.ts is untouched (MR-only module). Discretionary deviation from CONTEXT, which suggested extending driftDetection.ts."
  - "Bulk sync writes only fix version -> package. Per-row fixes (sidebar and release detail) cover both directions."
  - "Feature fully inert when releaseManagementProjectKey is null."
  - "Write shape comes from editmeta (array -> [key], else bare key); field absent from editmeta -> not-editable -> read-only warning + Open in Jira, bulk sync refused."
metrics:
  tasks: 3
  completed: 2026-10-14
---

# Quick 261014-eym: Deployment package <-> fix version sync Summary

Links the Jira Deployment package field (customfield_15725, an RM child issue) to a Story's fix version via the inclusive date range in the RM WEEK parent's summary, with warnings, one-click fixes, a Releases-tab package display and a bulk sync.

## Commits

- 8704309c: pure lib + tests, jira.ts fetchers, settings v30, RM picker
- 20e2060d: sidebar warning and one-click fixes
- a57b9417: release detail section, sync hook, Releases tab chip and bulk sync

## Deliberate decisions

1. **Package drift is a new `DeploymentPackageSection`; `driftDetection.ts` is left untouched** (it is an MR-only module). This is a discretionary deviation from CONTEXT, which suggested extending it. No drift counts appear on the Releases list.
2. **Bulk sync writes only fix version -> package.** The release's version is authoritative on the release screens. Per-row fixes (sidebar, release detail) cover both directions.

## Deviations from Plan

- **[Discretionary] `useReleaseDetail.ts` not modified.** It already exposes `releaseIssues` and `storyPointsFieldKey`; the extra fields come from the `fetchFixVersionIssues` change, so no edit was needed.
- **[Rule 3] `IntegrationsSection.test.tsx` updated.** Mounting the new picker collided with the existing test's Select stand-in (shared `data-testid`, shared "Loading projects" / "Retry" text). The picker is stubbed there and has its own `ReleaseManagementBlock.test.tsx`. Production code was not changed to fit the mocks.
- **`planBulkSync` signature** is `(stories, version, weeks, shape)`; the plan's unused `projectVersions` parameter was dropped (direction is fix version -> package, so it is not needed).
- **Not-editable on the Releases tab** is detected on click (editmeta of the first planned story, before the confirm dialog) rather than by pre-disabling the button, since the shape depends on a story fetched on demand. The user sees the reason inline and no dialog or write happens.
- **Releases-tab sync button** is a sibling of the row `<button>` (row wrapped in a flex div) to avoid nested interactive elements.
- **Extra tests** added: `ReleaseManagementBlock.test.tsx`, `DeploymentPackageSection.test.tsx`, `ReleasesTab.deploymentPackage.test.tsx`, `DeploymentPackageWarning.test.tsx`.
- Environment: worktree had no `taskflow/node_modules`; symlinked the main checkout's (gitignored, not committed).

## Assumptions not verified live

Field JSON shape, PUT acceptance, and how RM children hang off the WEEK parent were not probed against live Jira. Mitigations: tolerant reader, editmeta-driven write with read-only fallback, and `fetchRmWeekIndex` collecting children from sub-tasks, `parent`, Epic Link and issue links. Manual UAT per the plan remains required.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (project/issue keys are regex-validated before JQL/URLs; writes gated on editmeta; bulk loop sequential and confirmation-gated).

## Verification

- Full vitest suite green at each commit (pre-commit hook); `tsc --noEmit` clean.
- Biome: no new files flagged (remaining findings are pre-existing: chart.tsx, BacklogRow.tsx, MyTasksPage.test.tsx).

## Self-Check: PASSED
