---
phase: 66-roles-removal
plan: "02"
subsystem: settings-ui, onboarding-wizard, onboarding-store, test-files
tags: [roles-removal, ui-cleanup, wizard, wave-2]
dependency_graph:
  requires:
    - 66-01 (getDefaultSidebarItems no-arg, settings store role-free at v22)
  provides:
    - 4-step onboarding wizard with no RoleStep (ROLES-01)
    - Settings with no preset buttons and no role section (ROLES-02, ROLES-03)
    - onboarding.store role-free (ROLES-01)
    - Full test suite green, npm run build passes (ROLES-05)
  affects:
    - taskflow/src/routes/settings/SidebarSection.tsx
    - taskflow/src/routes/settings/AppearanceSection.tsx
    - taskflow/src/components/app/OnboardingWizard.tsx
    - taskflow/src/stores/onboarding.store.ts
    - taskflow/src/routes/settings/Settings.test.tsx
    - taskflow/src/routes/settings/ConnectionsSection.test.tsx
    - taskflow/src/routes/settings/SidebarItemsList.test.tsx
    - taskflow/src/stores/onboarding.store.test.ts
    - taskflow/src/lib/tauri-storage.test.ts
tech_stack:
  added: []
  patterns:
    - File deletion after removing all importers (PresetButtons.tsx, RoleSection.tsx, RoleStep.tsx, RoleStep.test.tsx)
    - Mock cleanup: remove deleted store fields from test mocks to keep mocks in sync with store interfaces
key_files:
  created: []
  modified:
    - taskflow/src/routes/settings/SidebarSection.tsx
    - taskflow/src/routes/settings/AppearanceSection.tsx
    - taskflow/src/routes/settings/Settings.tsx
    - taskflow/src/components/app/OnboardingWizard.tsx
    - taskflow/src/stores/onboarding.store.ts
    - taskflow/src/stores/onboarding.store.test.ts
    - taskflow/src/lib/tauri-storage.test.ts
    - taskflow/src/routes/settings/SidebarItemsList.test.tsx
    - taskflow/src/routes/settings/Settings.test.tsx
    - taskflow/src/routes/settings/ConnectionsSection.test.tsx
  deleted:
    - taskflow/src/routes/settings/PresetButtons.tsx
    - taskflow/src/routes/settings/RoleSection.tsx
    - taskflow/src/routes/onboarding/RoleStep.tsx
    - taskflow/src/routes/onboarding/RoleStep.test.tsx
decisions:
  - "SidebarSection and AppearanceSection both had PresetButtons; removed from both; deleted the file once zero importers remained"
  - "RoleSection was dead code (Settings.tsx had only a stale comment, no import); deleted without further ceremony"
  - "ROLES-05 grep confirmed zero role-gated conditionals in components/ and routes/ — condition was pre-satisfied by D-11"
  - "node_modules symlinked from main repo into worktree taskflow/ to allow vitest to resolve @vitejs/plugin-react"
metrics:
  duration: "8m"
  completed_date: "2026-05-24"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 10
  files_deleted: 4
---

# Phase 66 Plan 02: Roles Removal — UI Cleanup & Test Updates Summary

**One-liner:** Deleted four role-related files (PresetButtons, RoleSection, RoleStep, RoleStep.test), collapsed the onboarding wizard from 5 to 4 steps, stripped the `role` field from the in-memory onboarding store, and updated five test files — full vitest suite passes (1358 tests) and `npm run build` succeeds.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove PresetButtons from SidebarSection + AppearanceSection, delete PresetButtons.tsx and RoleSection.tsx | 75a407b6 | SidebarSection.tsx, AppearanceSection.tsx, PresetButtons.tsx (deleted), RoleSection.tsx (deleted), Settings.tsx |
| 2 | Collapse wizard to 4 steps, remove RoleStep, strip role from onboarding store, delete RoleStep files | b45bdad9 | OnboardingWizard.tsx, onboarding.store.ts, RoleStep.tsx (deleted), RoleStep.test.tsx (deleted) |
| 3 | Update remaining test files, run full suite, run production build, verify ROLES-05 grep | b2e40060 | onboarding.store.test.ts, tauri-storage.test.ts, SidebarItemsList.test.tsx, Settings.test.tsx, ConnectionsSection.test.tsx |

## What Was Built

**Task 1 — Settings UI cleanup:**
- `SidebarSection.tsx`: removed `import PresetButtons` and `<PresetButtons />` JSX; updated doc comment to drop "plus preset buttons for quick layout resets" clause; `<SidebarItemsList />` and `data-testid="section-sidebar"` preserved
- `AppearanceSection.tsx`: removed `import PresetButtons` and `<PresetButtons />` from the "Sidebar Items section" div; `<SidebarItemsList />` and `Sidebar Items` label preserved
- `PresetButtons.tsx`: deleted (no remaining importers after above edits)
- `RoleSection.tsx`: deleted (confirmed dead code — Settings.tsx had no import, only a stale comment; stale comment also removed)
- `Settings.tsx`: removed stale `- RoleSection: existing, unchanged` line from file doc comment

**Task 2 — Wizard collapse + onboarding store:**
- `OnboardingWizard.tsx`: updated doc comment from 5-step to 4-step; removed `import RoleStep`; changed `STEP_LABELS` to `['Welcome', 'Jira', 'GitLab', 'Done']`; changed `STEP_COMPONENTS` to `[WelcomeStep, JiraStep, GitLabStep, DoneStep]`; removed `role` from store destructure; removed `if (role) completedSteps.push(3)`
- `onboarding.store.ts`: removed `role: 'developer' | 'pm' | 'tech-lead' | null` from `OnboardingState` interface; removed `role: null` from initial state
- `RoleStep.tsx`: deleted (no remaining importers)
- `RoleStep.test.tsx`: deleted (todos-only orphan)

**Task 3 — Test file updates:**
- `onboarding.store.test.ts`: removed `role: null` from beforeEach setState; removed `role: 'developer'` from set() call and `expect(state.role).toBe('developer')` assertion in the "set updates partial state" test
- `tauri-storage.test.ts`: removed `role: 'developer'` from first test fixture state and `expect(parsed.state.role).toBe('developer')` assertion; `theme: 'system'` and `version: 21` assertions preserved
- `SidebarItemsList.test.tsx`: changed import from `DEV_SIDEBAR_PRESET` to `getDefaultSidebarItems`; replaced `DEV_SIDEBAR_PRESET.map(...)` with `getDefaultSidebarItems().map(...)` in beforeEach; updated inline comment
- `Settings.test.tsx`: removed `role: 'developer' as ...` and `setRole: vi.fn()` and `applyPreset: vi.fn()` from `mockSettingsStore`
- `ConnectionsSection.test.tsx`: removed `role: 'developer' as ...` and `setRole: vi.fn()` from `mockSettingsStore`

## Verification Results

- `npx vitest run` — 1358 passed, 0 failed, 2 skipped, 35 todo
- `npm run build` — exits 0 (built in 3.72s)
- File deletions confirmed: `PresetButtons.tsx`, `RoleSection.tsx`, `RoleStep.tsx`, `RoleStep.test.tsx` do not exist
- `grep -rn "PresetButtons\|RoleSection\|RoleStep" taskflow/src` — no matches (only stale Settings.tsx comment, cleaned up)
- `grep -rn "\.role\b" src/components src/routes | grep -v "(payload|user|author|aria)-role"` — ROLES-05-GREP-CLEAN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale RoleSection comment in Settings.tsx doc block**
- **Found during:** Task 1 post-deletion grep
- **Issue:** `grep -rn "RoleSection" src/` returned a hit in Settings.tsx line 12 — a doc comment `- RoleSection: existing, unchanged`. This was not an import but would leave a false reference to a deleted file.
- **Fix:** Removed the stale line from the Settings.tsx JSDoc comment.
- **Files modified:** `taskflow/src/routes/settings/Settings.tsx`
- **Commit:** 75a407b6

**2. [Rule 3 - Blocking] node_modules not present in worktree taskflow directory**
- **Found during:** Task 3 vitest run
- **Issue:** `npx vitest run` from the worktree's `taskflow/` directory failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@vitejs/plugin-react'` — the worktree has no `taskflow/node_modules`, only the main repo does.
- **Fix:** Created a symlink: `taskflow/node_modules -> /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules`. This is safe — worktrees share the same node_modules in this project setup. The symlink is not committed (node_modules is in .gitignore).
- **Files modified:** none (symlink not tracked by git)

## Known Stubs

None — no placeholder data, no TODO markers, no hardcoded empty values introduced.

## Threat Flags

None — this plan deletes UI files and test fixtures and removes an in-memory store field. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check

**Files deleted confirmed:**
- `test ! -f taskflow/src/routes/settings/PresetButtons.tsx` — FOUND (deleted)
- `test ! -f taskflow/src/routes/settings/RoleSection.tsx` — FOUND (deleted)
- `test ! -f taskflow/src/routes/onboarding/RoleStep.tsx` — FOUND (deleted)
- `test ! -f taskflow/src/routes/onboarding/RoleStep.test.tsx` — FOUND (deleted)

**Commits exist:**
- 75a407b6: feat(66-02): remove PresetButtons from settings sections, delete PresetButtons.tsx and RoleSection.tsx
- b45bdad9: feat(66-02): collapse wizard to 4 steps, delete RoleStep files, strip role from onboarding store
- b2e40060: feat(66-02): update test files to remove role fixtures, DEV_SIDEBAR_PRESET, and role mock entries

## Self-Check: PASSED
