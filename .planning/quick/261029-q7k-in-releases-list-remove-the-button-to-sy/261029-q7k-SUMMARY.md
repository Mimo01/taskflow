---
phase: quick-261029-q7k
plan: 01
subsystem: releases
tags: [cleanup, releases-list, deployment-package]
requirements: [QUICK-261029-q7k]
key-files:
  modified:
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.deploymentPackage.test.tsx
    - taskflow/src/routes/dashboard/release-detail/useDeploymentPackageSync.ts
    - taskflow/src/routes/dashboard/release-detail/useDeploymentPackageSync.test.tsx
    - taskflow/src/lib/deployment-package.ts
    - taskflow/src/lib/deployment-package.test.ts
metrics:
  completed: 2026-10-29
---

# Phase quick-261029-q7k Plan 01: Remove releases-list Sync packages button Summary

Removed the per-row "Sync deployment packages" button from the Releases list and all code that only it used; the derived package chip and release-detail per-row fixes are untouched.

## Commits
- 1ef5c252: refactor(quick-261029-q7k): remove Sync packages button from releases list
- 309770cd: refactor(quick-261029-q7k): drop dead bulk deployment package sync code

## What changed
- ReleasesTab.tsx: deleted sync state, handlers, status alert, confirm dialog, the button, the flex wrapper div around each row (key moved to the release-row button, `flex-1` dropped) and all now-unused imports (Alert*, Button, Dialog*, X, Package, planBulkSync, PackageStoryLike, fetchFixVersionIssues, useSettingsStore, useDeploymentPackageSync import).
- useDeploymentPackageSync.ts: removed executeDeploymentPackageSync, resolveShapesForCandidates, PackageSync* types, projectKeyOf; NOT_EDITABLE_REASON and resolvePackageEditShape are now file-local; doc comment rewritten.
- deployment-package.ts: removed planBulkSync (all helpers it used kept).
- Tests trimmed accordingly; the RM-enabled chip test now asserts `row-sync-packages` is absent.

## Deviations from Plan
None - plan executed as written.

## Notes
- The worktree had no node_modules; a symlink to the main checkout's node_modules was used (gitignored, not committed).
- Verification: tsc clean, biome clean on touched files, full vitest suite green in both pre-commit runs, grep gates for removed symbols return 0.

## Self-Check: PASSED
