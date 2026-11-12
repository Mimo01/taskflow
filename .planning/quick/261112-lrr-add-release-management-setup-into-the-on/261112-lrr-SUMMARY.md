# Quick 261112-lrr: Release Management in onboarding wizard

Mounted the existing ReleaseManagementBlock in the wizard Integrations step (between AioBlock and Tempo), optional and non-gating. Subtitle updated.

- Task 1: commit 8a4f704c. IntegrationsStep.tsx + test (stub, ordering test, non-gating test). Full pre-commit suite passed (5045 tests), biome clean.
- Task 2 (checkpoint:human-verify): PENDING human UAT.
  1. Reset onboarding, run `npm run tauri dev` in taskflow/taskflow.
  2. Welcome > Jira > GitLab to Integrations.
  3. Confirm Release Management section appears under AIO, above Tempo, and the project list loads.
  4. Leave None, Continue works. Back, pick a project, Continue to Done.
  5. Settings > Integrations shows the same project selected.

Deviations: none. (Worktree base was reset to 81259e69 per branch check.)
