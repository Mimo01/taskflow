---
status: resolved
trigger: "when running the onboarding wizard, the done step is not shown"
created: 2026-11-12
updated: 2026-11-12
---

## Symptoms
- expected: after Integrations → Continue, the "You're all set!" Done step shows with a Go to Dashboard button
- actual: wizard jumps straight to /dashboard; Done step never visible
- timeline: noticed after 261112-m5v (wizard re-run); first-run path was already broken since 260609-iff (DoneStep persists onboardingComplete on mount)

## Resolution
root_cause: DoneStep's mount effect sets onboardingComplete=true (and, since m5v, rerunActive=false). Both gates — routes/onboarding/index.tsx (`onboardingComplete && !rerunActive` → Navigate /dashboard) and AppLayout in main.tsx — then treat the wizard as finished and redirect before Done paints.
fix: DoneStep still persists onboardingComplete + WIZARD_VERSION on mount, but sets rerunActive=true to hold the wizard open; Go to Dashboard clears it and navigates. rerunActive doc updated to "keep wizard shown despite onboardingComplete".
verification: new src/routes/onboarding/index.test.tsx renders the real gate at step 4 — fails 2/3 on old DoneStep (first run + re-run), passes after fix; onboarding/wizard/rerun/DebugMode suites 50/50; tsc + biome clean.
files_changed: src/routes/onboarding/DoneStep.tsx, DoneStep.test.tsx, index.test.tsx (new), src/stores/onboarding.store.ts
