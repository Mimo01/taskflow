---
phase: quick-261112-m5v
plan: 01
subsystem: onboarding
tags: [onboarding, wizard, versioning, zustand, migration]
requires: [261112-lrr, 261112-lyx]
provides: [versioned onboarding wizard, launch-time re-run]
affects: [settings.store, onboarding.store, AppLayout, DebugModeSection]
key-files:
  created:
    - taskflow/src/lib/onboarding-rerun.ts
    - taskflow/src/lib/onboarding-rerun.test.ts
    - taskflow/src/hooks/useWizardRerunCheck.ts
    - taskflow/src/hooks/useWizardRerunCheck.test.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/onboarding.store.ts
    - taskflow/src/components/app/OnboardingWizard.tsx
    - taskflow/src/routes/onboarding/index.tsx
    - taskflow/src/routes/onboarding/DoneStep.tsx
    - taskflow/src/main.tsx
    - taskflow/src/routes/settings/DebugModeSection.tsx
decisions:
  - Automatic re-run uses in-memory rerunActive, not onboardingComplete=false, so quitting mid-run re-runs pre-filled next launch
  - Manual reset also uses rerunActive (onboardingComplete stays true)
metrics:
  completed: 2026-11-12
  tasks: 3
---

# Phase quick-261112-m5v Plan 01: Re-run onboarding wizard on app update Summary

Versioned onboarding wizard (WIZARD_VERSION=2, per-step `since`) with a launch-time check that re-opens the pre-filled wizard at the first changed step (Integrations) for users on an older version.

## Commits
- 75f9efed: versioned model, pre-fill helper, persisted onboardingVersion + v37 migration, rerunActive
- e1a6bb9b: re-run gate (route + AppLayout), DoneStep records version, labels from WIZARD_STEPS
- 572a2d33: useWizardRerunCheck hook, manual reset via startWizardRerun(0)

## Deviations from Plan
- Behavioral note: the manual "Open Wizard" reset no longer flips onboardingComplete to false (it now uses rerunActive via the shared helper, as the plan specified). Test asserts onboardingComplete is unchanged.
- Environment: worktree had no node_modules; symlinked (gitignored) to the main checkout's node_modules to run tooling. Not committed.
- Worktree was reset to the specified base 60abcd85 (initial HEAD differed).

No other deviations. Full vitest suite (320 files), biome, and tsc passed in each commit's pre-commit hook.

## Known Stubs
None.

## Self-Check: PASSED
Created files exist; commits 75f9efed, e1a6bb9b, 572a2d33 on branch worktree-agent-ae7d5a5a29fd3c4b7.
