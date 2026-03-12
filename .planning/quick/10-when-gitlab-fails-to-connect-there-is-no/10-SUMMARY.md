---
phase: quick-10
plan: "01"
subsystem: ui-feedback
tags: [gitlab, banner, auth, reauth, ux]
dependency_graph:
  requires: [useAuthStore.gitlabConnected, useSettingsStore.onboardingComplete]
  provides: [GitLabReAuthBanner component]
  affects: [AppLayout, ReAuthBanner.tsx]
tech_stack:
  added: []
  patterns: [named-export alongside default export, conditional render in AppLayout]
key_files:
  created: []
  modified:
    - taskflow/src/components/app/ReAuthBanner.tsx
    - taskflow/src/main.tsx
decisions:
  - "GitLabReAuthBanner added as named export in existing ReAuthBanner.tsx file — keeps related banner logic co-located"
  - "Both banners render independently — stacking naturally when both services disconnected"
metrics:
  duration: "~1 min"
  completed: "2026-03-12"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-10 Plan 01: GitLab ReAuth Banner Summary

**One-liner:** Amber GitLab disconnection banner mirroring Jira banner, reads `gitlabConnected` from auth store and stacks below Jira banner when both are disconnected.

## What Was Built

Added `GitLabReAuthBanner` as a named export in `ReAuthBanner.tsx`, matching the existing Jira `ReAuthBanner` pattern exactly. The component reads `gitlabConnected` from `useAuthStore` and `onboardingComplete` from `useSettingsStore`, returning null when connected or before onboarding completes. When GitLab is disconnected post-onboarding, it renders an identical amber alert with "GitLab connection lost — check your URL and token in Settings" and a Settings link.

`AppLayout` in `main.tsx` now renders `GitLabReAuthBanner` conditionally on `!gitlabConnected`, immediately below the existing Jira banner line. Both banners are fully independent — they stack visually when both services are disconnected.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GitLabReAuthBanner export to ReAuthBanner.tsx | 8466c7c | taskflow/src/components/app/ReAuthBanner.tsx |
| 2 | Mount GitLabReAuthBanner in AppLayout | 5a1d3d4 | taskflow/src/main.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] taskflow/src/components/app/ReAuthBanner.tsx — modified, GitLabReAuthBanner export present
- [x] taskflow/src/main.tsx — modified, GitLabReAuthBanner imported and rendered
- [x] Commit 8466c7c — FOUND
- [x] Commit 5a1d3d4 — FOUND
- [x] TypeScript: no errors in main.tsx or ReAuthBanner.tsx (pre-existing errors in other files are out-of-scope per STATE.md)
