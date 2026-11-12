---
phase: quick-261112-lyx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/settings/DebugModeSection.tsx
  - taskflow/src/routes/settings/DebugModeSection.test.tsx
autonomous: true
requirements: [QUICK-261112-lyx]

must_haves:
  truths:
    - "Re-running the onboarding wizard (Settings -> Advanced -> Reset onboarding wizard -> Open Wizard) pre-selects the saved Jira sprint board for the active Jira project"
    - "On re-run with a multi-board project, Continue on the Jira step is not gated, because jiraBoardId is already set"
    - "When no board is saved for the active project (or there is no active project), jiraBoardId is seeded as null (same as today)"
    - "The stale jiraBoards list from a previous wizard run is cleared on reset"
  artifacts:
    - path: "taskflow/src/routes/settings/DebugModeSection.tsx"
      provides: "handleResetWizard seeds jiraBoardId from auth store jiraBoardIds[activeJiraProject] and resets jiraBoards"
      contains: "jiraBoardId:"
    - path: "taskflow/src/routes/settings/DebugModeSection.test.tsx"
      provides: "Regression test for reset-wizard seeding"
  key_links:
    - from: "taskflow/src/routes/settings/DebugModeSection.tsx"
      to: "useAuthStore jiraBoardIds"
      via: "selector read in component, used in handleResetWizard"
      pattern: "jiraBoardIds"
    - from: "handleResetWizard"
      to: "useOnboardingStore.set"
      via: "setWizardState({... jiraBoardId, jiraBoards: [] })"
      pattern: "jiraBoards: \\[\\]"
---

<objective>
Fix: when the user re-runs the onboarding wizard, every field is pre-filled except the Jira sprint board, which they have to pick again.

Root cause (orchestrator diagnosis, verified by the planner): `handleResetWizard` in `DebugModeSection.tsx` (around line 83) seeds the onboarding store with jiraUrl, jiraToken, jiraProject, gitlab* and so on, but it never seeds `jiraBoardId`. The saved board lives in `useAuthStore().jiraBoardIds[projectKey]`, which `setJiraBoardId` writes at JiraStep Continue. JiraStep passes the onboarding store's `jiraBoardId` to BoardPicker as its `value`. So on re-run with a multi-board project, the Select shows "Choose a board…" and `blockedOnBoardChoice` gates Continue. Single-board projects auto-select via BoardPicker's effect, so this only shows up when a project has several boards.

Verified non-issues (no change needed):
- JiraStep does not clear `jiraBoardId` on mount. `setSelectedProject` clears it only when the user changes the project, and the boards-mirror effect writes only `jiraBoards`.
- The Release Management picker added in 261112-lrr (`ReleaseManagementBlock` in IntegrationsStep) reads and writes `useSettingsStore.releaseManagementProjectKey` directly, with no wizard-local state. It is pre-filled already, so it has no matching bug.

Output: a one-site fix in handleResetWizard plus a new focused regression test.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/CLAUDE.md
@taskflow/src/routes/settings/DebugModeSection.tsx
@taskflow/src/stores/onboarding.store.ts
@taskflow/src/stores/auth.store.ts
@taskflow/src/routes/onboarding/JiraStep.tsx

Repo layout: git and .planning live in the outer `taskflow/`. Run npm, vitest and biome from the inner `taskflow/taskflow/`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Seed jiraBoardId (and reset jiraBoards) in handleResetWizard, with regression test</name>
  <files>taskflow/src/routes/settings/DebugModeSection.tsx, taskflow/src/routes/settings/DebugModeSection.test.tsx</files>
  <behavior>
    - Test 1: auth store has activeJiraProject 'PROJ' and jiraBoardIds { PROJ: 42, OTHER: 7 }, and the onboarding store has jiraBoardId null and a stale jiraBoards [{id:1,...}]. After clicking the "Reset" trigger and then the "Open Wizard" button, the onboarding store ends with jiraBoardId === 42, jiraBoards deep-equal to [], and jiraProject === 'PROJ'.
    - Test 2: activeJiraProject is 'PROJ' and jiraBoardIds is {} (no saved board). After reset, jiraBoardId === null.
    - Test 3: activeJiraProject is null. After reset, jiraBoardId === null (no lookup crash).
  </behavior>
  <action>
In `DebugModeSection.tsx`, add a selector next to the existing auth selectors (around lines 61-64): `const jiraBoardIds = useAuthStore((s) => s.jiraBoardIds);`. In `handleResetWizard`, add two keys to the `setWizardState({...})` object right after `jiraProjects: []`:
- `jiraBoards: []`
- `jiraBoardId: activeJiraProject ? (jiraBoardIds[activeJiraProject] ?? null) : null`

Add a short comment saying the saved board must be seeded so BoardPicker shows it pre-selected and a multi-board project doesn't gate Continue (261112-lyx). Leave every other key and behaviour unchanged.

Create `DebugModeSection.test.tsx` next to the component, using the conventions in `ConnectionsSection.test.tsx`:
- Wrap the component in `QueryClientProvider`, because it calls `useQueryClient`, and in `MemoryRouter`, because it calls `useNavigate`.
- Mock `@/services/stronghold` with `readSecret` resolving 'fake-token' and `removeSecret` resolving undefined. The component imports it relatively (`../../services/stronghold`), but vi.mock resolves both to the same module id. If the mock doesn't apply, mock the relative path from the test instead.
- Mock `@/services/avatarCache` with `clearAvatarCache: vi.fn()`, because it pulls in Tauri plugins at import time.
- Use the real zustand stores and seed them in `beforeEach` with `useAuthStore.setState({...})` and `useOnboardingStore.setState({...})`. Do not vi.mock the stores; the test must exercise the real `set`.
- Open the dialog with `screen.getByRole('button', { name: 'Reset' })`. If several buttons match, scope to the "Reset onboarding wizard" row via `within`. Then click the "Open Wizard" button.
- Use `await waitFor(...)` to assert on `useOnboardingStore.getState()`, because handleResetWizard awaits readSecret.

The pre-commit hook runs the full vitest suite, so make one commit that holds both the fix and the test. Do not commit a failing (RED) test on its own. Before the fix, temporarily run the test to confirm Test 1 fails (jiraBoardId stays null), then apply the fix.

Lint only the two touched files: `npx biome check src/routes/settings/DebugModeSection.tsx src/routes/settings/DebugModeSection.test.tsx`. Never run biome --write across src.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/settings/DebugModeSection.test.tsx src/routes/onboarding && npx biome check src/routes/settings/DebugModeSection.tsx src/routes/settings/DebugModeSection.test.tsx && npx tsc --noEmit -p .</automated>
  </verify>
  <done>
- All 3 new tests pass, and Test 1 was seen failing before the fix.
- Existing onboarding tests still pass.
- biome is clean on both touched files and tsc is clean.
- One commit contains both the fix and the test (`fix(quick-261112-lyx): pre-fill Jira sprint board when re-running onboarding wizard`), and `git log -1 --stat` shows only those two files plus any planning docs.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Local-only state copy between two in-memory zustand stores; no new input, network, or secret handling |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lyx-01 | Tampering | handleResetWizard board seed | accept | Board id comes from the app's own persisted auth store keyed by the active project, so it cannot cross projects. JiraStep still clears it on a user project change (WR-02 unchanged). |
</threat_model>

<verification>
- Manual (optional, after merge): Settings -> Advanced -> Reset onboarding wizard -> Open Wizard, then Test & Continue on the Jira step. The multi-board project's saved board is pre-selected and Continue is enabled.
</verification>

<success_criteria>
Re-running the onboarding wizard pre-fills the Jira sprint board for the active project. A regression test guards this.
</success_criteria>

<output>
Create `.planning/quick/261112-lyx-onboarding-wizard-pre-fill-jira-sprint-b/261112-lyx-SUMMARY.md` when done
</output>
