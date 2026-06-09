---
phase: quick-260609-iff
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/onboarding/DoneStep.tsx
autonomous: true
requirements: [WIZARD-SAVE-ON-STEP]

must_haves:
  truths:
    - "Reaching DoneStep persists onboardingComplete=true immediately, without requiring a button click"
    - "The 'Go to Dashboard' button still navigates to /dashboard"
    - "If the app is closed on DoneStep before clicking the button, the wizard does not reappear on next launch"
  artifacts:
    - path: "taskflow/src/routes/onboarding/DoneStep.tsx"
      provides: "DoneStep with useEffect that calls setOnboardingComplete(true) on mount"
      contains: "useEffect"
  key_links:
    - from: "taskflow/src/routes/onboarding/DoneStep.tsx"
      to: "taskflow/src/stores/settings.store.ts"
      via: "setOnboardingComplete called in useEffect on mount"
      pattern: "useEffect.*setOnboardingComplete"
---

<objective>
Save wizard completion state as soon as the user reaches DoneStep, not only when they click "Go to Dashboard".

Purpose: Currently, onboardingComplete is set only inside handleGoToDashboard. If the app crashes or is closed after the user has completed all wizard steps but before clicking the button, the wizard shows again on next launch — forcing re-entry of all credentials. Moving the save to a useEffect on DoneStep mount means the state is persisted the moment the user arrives at the final step.

Output: DoneStep.tsx with a useEffect that calls setOnboardingComplete(true) on mount. The button handler becomes navigate-only.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@taskflow/src/routes/onboarding/DoneStep.tsx
@taskflow/src/stores/settings.store.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Save onboardingComplete on DoneStep mount</name>
  <files>taskflow/src/routes/onboarding/DoneStep.tsx</files>
  <behavior>
    - On mount, setOnboardingComplete(true) is called immediately via useEffect (empty dep array)
    - handleGoToDashboard only calls navigate('/dashboard') — setOnboardingComplete removed from it
    - If setOnboardingComplete is called twice (mount + any legacy path), the second call is a no-op (idempotent store setter)
  </behavior>
  <action>
    Edit DoneStep.tsx:

    1. Add useEffect import alongside useNavigate (useEffect is already available from React).
    2. Add useEffect at the top of the component body that calls setOnboardingComplete(true) with an empty dependency array — fires once on mount.
    3. Remove setOnboardingComplete(true) from handleGoToDashboard — the handler now only calls navigate('/dashboard').

    The setOnboardingComplete action from useSettingsStore is already destructured in the file — no new import needed. The useEffect dep array must be empty ([] not omitted) to fire exactly once on mount.

    Result shape:
      useEffect(() => { setOnboardingComplete(true); }, []);
      const handleGoToDashboard = () => { navigate('/dashboard'); };
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm test -- --reporter=verbose --run DoneStep 2>&1 | tail -20</automated>
  </verify>
  <done>
    DoneStep mounts and immediately sets onboardingComplete=true in the settings store.
    "Go to Dashboard" button only navigates. npm run check GREEN.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| wizard state → settings store | Persisted via Tauri Store plugin — no external input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-iff-01 | Tampering | settings.store persist | accept | Local Tauri store, no network path, no PII in this flag |
</threat_model>

<verification>
1. Run `npm test -- --run DoneStep` — all tests pass
2. Run `npm run check` — biome + tsc clean
3. Manual: complete wizard to DoneStep — onboardingComplete is true in store before clicking button (verify via React DevTools or by closing/reopening the app at DoneStep)
</verification>

<success_criteria>
- DoneStep mounts → onboardingComplete=true persisted immediately
- Closing app on DoneStep without clicking button → wizard does not reappear on next launch
- "Go to Dashboard" still navigates to /dashboard
- npm run check GREEN
</success_criteria>

<output>
Create `.planning/quick/260609-iff-in-wizard-save-data-on-every-step-finish/260609-iff-01-SUMMARY.md` when done.
</output>
