---
phase: 68-startup-wizard-integrations-step
plan: "02"
subsystem: onboarding-wizard, integrations-step
tags: [tdd, wizard, settings, integrations, aio, tempo]
dependency_graph:
  requires:
    - 68-01 (onboarding store with integrationsVisited + AioBlock component)
  provides:
    - IntegrationsStep wizard route component (step 3)
    - Continue gating D-01..D-04 verified by tests
    - Tempo toggle inline (WIZ-03)
  affects:
    - taskflow/src/routes/onboarding/IntegrationsStep.tsx
    - taskflow/src/routes/onboarding/IntegrationsStep.test.tsx
tech_stack:
  added: []
  patterns:
    - TDD: RED test file first (import fails), then GREEN implementation
    - Option A duplicate useQuery with same queryKey for TanStack Query dedup
    - fine-grained Zustand selectors (one selector call per field, D-10)
    - AioBlock as self-contained mount (no props, D-05)
    - inline Tempo toggle (not extracted, D-06)
key_files:
  created:
    - taskflow/src/routes/onboarding/IntegrationsStep.tsx
    - taskflow/src/routes/onboarding/IntegrationsStep.test.tsx
  modified: []
decisions:
  - "Option A (duplicate useQuery same key) chosen for Continue gating — TanStack Query deduplicates AioBlock + IntegrationsStep subscriptions to single network call (RESEARCH Pattern 3)"
  - "No useState for aioEnabled/tempoEnabled/selectedAioProjectKey — all bound directly to useSettingsStore via fine-grained selectors (D-10)"
  - "AioBlock stubbed in IntegrationsStep tests as <div data-testid=aio-block /> to isolate navigation/gating logic from picker logic (tested separately in AioBlock.test.tsx)"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
  tests_added: 12
  completed_date: "2026-05-24"
---

# Phase 68 Plan 02: IntegrationsStep Component Summary

IntegrationsStep wizard route created with AioBlock mount, inline Tempo toggle, and TanStack Query-deduplicated Continue gating that enforces all four D-01..D-04 states; all 12 tests green, no new attack surface introduced.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write IntegrationsStep tests covering gating, Tempo toggle, store binding, navigation | 6e774d72 | IntegrationsStep.test.tsx |
| 2 | Implement IntegrationsStep component | 4424fc86 | IntegrationsStep.tsx |

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| IntegrationsStep | 12 | green |
| **Total** | **12** | **all green** |

## Deviations from Plan

### Setup Fix — node_modules symlink (Rule 3: blocking issue, carried from Plan 01)

**Found during:** Task 1 test execution
**Issue:** The worktree's `taskflow/` symlink to `node_modules` from Plan 01 was not present in this agent's worktree — `vitest` was not found on PATH, failing test execution immediately.
**Fix:** Re-created the symlink: `taskflow/node_modules` → `/Users/mimo/Documents/Projects/taskflow/taskflow/node_modules`. Same fix as Plan 01 (symlinks are not tracked by git; each fresh worktree agent needs to recreate it).
**Impact:** Tests run correctly after symlink creation. No code changes.

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| IntegrationsStep.test.tsx exists | PASS |
| `export default function IntegrationsStep` present | PASS |
| `import AioBlock from '@/components/integrations/AioBlock'` present | PASS |
| `<AioBlock />` mounted | PASS |
| queryKey `['aio', jiraBaseUrl, 'projects']` with dedup comment | PASS |
| `continueDisabled` expression gating D-01..D-04 | PASS |
| `set({ integrationsVisited: true })` in handleContinue | PASS |
| `aria-label="Enable Tempo Timesheets"` on Tempo checkbox | PASS |
| No useState for aioEnabled/tempoEnabled/selectedAioProjectKey | PASS |
| All 12 IntegrationsStep tests green | PASS |

## Known Stubs

None — all store bindings are live:
- `aioEnabled`, `selectedAioProjectKey` read from real `useSettingsStore` selectors
- `tempoEnabled`/`setTempoEnabled` bound directly to store (no intermediate state)
- Continue gating query uses real `fetchAioProjects` + `readSecret` path (deduped with AioBlock)
- `set({ integrationsVisited: true })` writes to the real onboarding store

## Threat Flags

None — no new attack surface introduced. The duplicate gating query reuses `readSecret('jira-pat')` + `fetchAioProjects` — the same path as AioBlock (T-68-03, accepted). No new network endpoints, auth flows, or trust boundary changes.

## Self-Check: PASSED

- `taskflow/src/routes/onboarding/IntegrationsStep.tsx` exists on disk
- `taskflow/src/routes/onboarding/IntegrationsStep.test.tsx` exists on disk
- Task 1 commit `6e774d72` verified in git log
- Task 2 commit `4424fc86` verified in git log
