---
status: resolved
trigger: "when i add issue to fix version from not covered by tasks above and it has a version mismatch, it appears correctly in deployment ackage mismatches but there is no fix/apply button"
created: 2026-11-03
updated: 2026-11-03
---

## Symptoms

- **Expected:** After adding an issue to the fix version via the "Not covered by tasks" section (release detail page), if that issue then shows a version mismatch in the Deployment Package mismatches section, its row should offer the fix/apply button like other mismatch rows.
- **Actual:** The issue appears correctly in the Deployment Package mismatches list, but its row has no fix/apply button.
- **Errors:** None reported.
- **Timeline:** Not-covered section with fix actions was just redesigned (quick task 261103-cln, commits 431774e0, 1e64432a, 2c08b55a). Unknown whether this flow ever worked.
- **Reproduction:** Release detail page → "Not covered by tasks" section → use action to add an issue to the fix version → issue has a version mismatch → it appears under Deployment Package mismatches without a fix/apply button.

## Context hints

- App code lives in inner dir taskflow/taskflow/ (src, npm, vitest, biome); .planning/git at outer taskflow/.
- RM deployment package: Parent Link links RM task→WEEK parent; RM loading is lazy (see quick 261014-eym).
- Likely suspects: the button's render condition depends on data that is stale/missing for the freshly-added issue (e.g. cached lightweight issue/version data not invalidated after the add-to-fix-version mutation, or the mismatch row derived from a different source than the action's eligibility check). Compare against a mismatch row that DOES show the button.
- Repo uses React Compiler in app (not in vitest); TanStack Query v5.

## Current Focus

hypothesis: mismatch row has result.fixes==[] (button renders only when fixes.length>=1); evaluatePackageSync yields no fix when (a) project has 0 or 2+ versions in the package week (setFixVersionFix) AND (b) setPackageFix fails: >1 dated fix versions (likely right after add: old+new), no RM child matching project name under release week, or week not loaded. Not stale-cache: add flow invalidates jira-fixversion-issues correctly.
next_action: need live data for one affected issue (fixVersions, package key+week, project) to pick the branch; then fix (likely surface the reason in the mismatch hint and/or add a third fix 'remove the added fix version')

## Evidence

- checked: DeploymentPackageSection.tsx L430-475; lib/deployment-package.ts evaluatePackageSync L321-408
  found: Apply button rendered only if result.fixes.length>=1 (no else branch). In the 'mismatch' state fixes = [setFixVersionFix?] + [setPackageFix?]; both can be null, and the reason from setPackageFix is discarded (hint only has date-range text).
- checked: notCoveredFixes.ts applyFixVersion + useReleaseDetail query key
  found: invalidation of ['jira-fixversion-issues', versionId] prefix-matches the real key; section re-evaluates with fresh issue fields. Cache staleness ruled out.

## Eliminated

## Resolution

root_cause: "Add fix version" appends, so the issue ends up with 2+ dated fix versions. In the mismatch branch of evaluatePackageSync, setPackageFix bails with "Several fix versions ... ambiguous" when dated.length > 1, and setFixVersionFix needs exactly one project version in the package week (0 here). fixes=[] -> no Apply button, and the reason was discarded from the hint.
fix: mismatch branch now tries setPackageFix per dated fix version and offers a set-package fix for each resolvable week (deduped, excluding the current package). If still no fix, the reason is appended to the hint/detail. fv-only behaviour unchanged.
verification: 2 regression tests failed pre-fix, pass post-fix; deployment-package + release-detail suites 725/725; tsc + biome clean. User approved in app (2026-11-03).
files_changed: taskflow/src/lib/deployment-package.ts, taskflow/src/lib/deployment-package.test.ts
