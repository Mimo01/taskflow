---
phase: 68-startup-wizard-integrations-step
plan: "01"
subsystem: onboarding-store, integrations-component
tags: [tdd, extraction, ui-spec-correction, wizard, settings]
dependency_graph:
  requires: []
  provides:
    - onboarding store step limit bumped to 4 with integrationsVisited flag
    - AioBlock self-contained component in src/components/integrations/
    - IntegrationsSection consumes AioBlock (no inline AIO logic)
  affects:
    - taskflow/src/stores/onboarding.store.ts
    - taskflow/src/stores/onboarding.store.test.ts
    - taskflow/src/components/integrations/AioBlock.tsx
    - taskflow/src/components/integrations/AioBlock.test.tsx
    - taskflow/src/routes/settings/IntegrationsSection.tsx
tech_stack:
  added: []
  patterns:
    - fine-grained Zustand selectors (one call per field)
    - self-contained TanStack Query component (query + token fetch owned by component)
    - TDD: RED test file first, then GREEN implementation
key_files:
  created:
    - taskflow/src/components/integrations/AioBlock.tsx
    - taskflow/src/components/integrations/AioBlock.test.tsx
  modified:
    - taskflow/src/stores/onboarding.store.ts
    - taskflow/src/stores/onboarding.store.test.ts
    - taskflow/src/routes/settings/IntegrationsSection.tsx
decisions:
  - "AioBlock placed in src/components/integrations/ to parallel src/services/aio/ (Claude Discretion A1)"
  - "integrationsVisited flag added to onboarding store for wizard step checkmark consistency with jiraValidated/gitlabValidated (Claude Discretion A3)"
  - "comments in AioBlock.tsx document UI-SPEC corrections (font-normal not font-medium, gap-2 not gap-1.5) for reviewer clarity"
  - "node_modules symlinked from main taskflow into worktree to enable npm test execution from worktree"
metrics:
  duration_minutes: 5
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
  tests_added: 22
  completed_date: "2026-05-24"
---

# Phase 68 Plan 01: Onboarding Store Extension and AioBlock Extraction Summary

Onboarding store bumped to 5 steps (0–4) with `integrationsVisited` flag; AIO toggle+picker extracted from IntegrationsSection into a self-contained `AioBlock` component with UI-SPEC-correct `font-normal`/`gap-2`; IntegrationsSection refactored from 171 to 37 lines by consuming the extracted component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Bump onboarding store step limit to 4 and add integrationsVisited flag | 86af7b41 | onboarding.store.ts, onboarding.store.test.ts |
| 2 | Extract AioBlock component with UI-SPEC corrections + tests | a620b337 | AioBlock.tsx, AioBlock.test.tsx |
| 3 | Update IntegrationsSection to import AioBlock | c319cdf6 | IntegrationsSection.tsx |

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| onboarding.store | 6 | green |
| AioBlock | 12 | green |
| IntegrationsSection | 18 | green |
| **Total** | **36** | **all green** |

## Deviations from Plan

### Setup Fix — node_modules symlink (Rule 3: blocking issue)

**Found during:** Task 1 test execution
**Issue:** The worktree's `taskflow/` subdirectory had no `node_modules` — vitest failed to start because `@vitejs/plugin-react` was not found. The worktree-local `node_modules/` directory existed at the root but was empty/separate; it could not satisfy the vitest config's imports.
**Fix:** Created a symlink: `taskflow/node_modules` → `/Users/mimo/Documents/Projects/taskflow/taskflow/node_modules`. This lets the worktree's vitest config resolve all dependencies from the shared main project `node_modules`.
**Impact:** Tests now run correctly from within the worktree's `taskflow/` directory. This symlink is not tracked by git (`.gitignore` excludes `node_modules`).

### TDD Note — integrationsVisited RED gate

The "set updates integrationsVisited" test passed before the GREEN implementation because Zustand's `setState` accepts arbitrary partial objects without TypeScript enforcement at runtime. The test is still correct — after GREEN, the field is properly typed in the interface. The primary RED gate ("goNext clamps at step 4") failed correctly before implementation.

## Known Stubs

None — no stub patterns found. All wiring is live:
- AioBlock reads real store selectors and runs a real TanStack Query
- IntegrationsSection mounts AioBlock directly
- onboarding store changes are behavioral (not display-only)

## Threat Flags

None — no new attack surface introduced. AioBlock is an extraction of existing IntegrationsSection logic with no new network endpoints, auth paths, or trust boundary changes. The Jira PAT continues to be read via `readSecret('jira-pat')` (T-68-01, accepted).

## Self-Check: PASSED

All created files exist on disk. All three task commits verified in git log.
