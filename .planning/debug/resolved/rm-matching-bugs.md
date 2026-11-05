---
status: resolved
trigger: "the release management matching works correctly for stories. But it doesnt for bugs"
created: 2026-11-05
updated: 2026-11-05
---

## Symptoms
- expected: Deployment package (customfield_15725) ↔ fix version matching (sidebar warning + release-detail "Deployment package" section) applies to Bugs as it does to Stories
- actual: Bugs never get a warning / never appear in the release-detail drift list
- timeline: since quick 261014-eym (feature built Story-only)

## Current Focus
hypothesis: CONFIRMED — matching is hard-gated to issuetype 'Story'
next_action: widen gate to Story + Bug via shared helper

## Evidence
- timestamp: 2026-11-05 — DeploymentPackageWarning.tsx:60 `active = rmEnabled && issueTypeName === 'Story'`
- timestamp: 2026-11-05 — DeploymentPackageSection.tsx:182 `stories.filter(s => issuetype.name === 'Story')`
- timestamp: 2026-11-05 — services/jira.ts fetchStoriesWithPackageNoFixVersion JQL `issuetype = Story`

## Eliminated

## Resolution
root_cause: three hardcoded Story-only gates (sidebar warning, release-detail filter, package-without-fix-version JQL)
fix: shared PACKAGE_ISSUE_TYPES / isPackageIssueType (Story, Bug) in lib/deployment-package.ts used by all three
verification: 2 new regression tests (Bug warning in sidebar, Bug row in release section) fail on Story-only gate, pass with fix; 69/69 targeted tests, tsc + biome clean. UAT approved 2026-11-05.
files_changed: src/lib/deployment-package.ts, src/services/jira.ts, src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx(+test), src/routes/dashboard/release-detail/DeploymentPackageSection.tsx(+test)
