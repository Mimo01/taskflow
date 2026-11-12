---
phase: quick-261112-lrr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/onboarding/IntegrationsStep.tsx
  - taskflow/src/routes/onboarding/IntegrationsStep.test.tsx
autonomous: false
requirements: [QUICK-261112-lrr]

must_haves:
  truths:
    - "During onboarding, the Integrations step shows the Release Management project picker (same control as Settings > Integrations)"
    - "Picking a project in the wizard sets settings.releaseManagementProjectKey; it then shows as selected in Settings > Integrations"
    - "Release Management stays optional: Continue is never blocked by it (None or no selection is fine, including while its project list loads or fails)"
    - "Existing AIO gating (D-01..D-04, WR-01) and the Tempo toggle behave exactly as before"
  artifacts:
    - path: "taskflow/src/routes/onboarding/IntegrationsStep.tsx"
      provides: "Integrations wizard step mounting ReleaseManagementBlock"
      contains: "ReleaseManagementBlock"
    - path: "taskflow/src/routes/onboarding/IntegrationsStep.test.tsx"
      provides: "Coverage that the RM block mounts and does not gate Continue"
      contains: "rm-block"
  key_links:
    - from: "taskflow/src/routes/onboarding/IntegrationsStep.tsx"
      to: "taskflow/src/components/integrations/ReleaseManagementBlock.tsx"
      via: "default import + JSX mount between AioBlock and Tempo"
      pattern: "<ReleaseManagementBlock />"
---

<objective>
Add Release Management setup to the onboarding wizard by mounting the existing, self-contained
`ReleaseManagementBlock` (already used by Settings > Integrations) in the wizard's Integrations step.

Why: the RM project (holds the WEEK issues) is configurable only in Settings, so new users finish
onboarding with deployment-package checks silently turned off. The wizard Integrations step already
mirrors Settings > Integrations (AioBlock + Tempo) but leaves out the RM block. This plan adds it.

Design choice (Claude's discretion, no CONTEXT.md): reuse the existing step and do NOT add a new
wizard step. The Settings page groups RM under Integrations, the block writes straight to
`useSettingsStore` (wizard rule: no wizard-local state), and a new step would mean re-indexing
STEP_LABELS/STEP_COMPONENTS, `goNext`'s `Math.min(4, …)` clamp, and the completedSteps logic for
a single optional picker.

Output: updated IntegrationsStep.tsx + test.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/onboarding/IntegrationsStep.tsx
@taskflow/src/routes/onboarding/IntegrationsStep.test.tsx
@taskflow/src/components/integrations/ReleaseManagementBlock.tsx
@taskflow/src/routes/settings/IntegrationsSection.tsx

Repo layout: .planning and git sit at the outer `taskflow/`. src, npm, vitest and biome run in the
inner `taskflow/taskflow/`. Run all commands from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Facts already checked (no need to re-explore):
- `ReleaseManagementBlock` is self-contained. It reads `jiraBaseUrl` from `useAuthStore`, reads the
  token via `readSecret('jira-pat')`, fetches `listJiraProjects` under query key
  `['jira-projects-rm', jiraBaseUrl]` (shared with useReleasePackages, so don't change it), and
  writes `setReleaseManagementProjectKey`. It defaults to "None" and handles its own loading,
  error/Retry and stale-key states.
- JiraStep (wizard step 1) stores `jira-pat` and calls `setJiraConnected(true, jiraUrl)` before
  step 3, so the block has a URL and token when it renders in the wizard.
- `IntegrationsSection.test.tsx` stubs the block (`vi.mock('@/components/integrations/ReleaseManagementBlock', …)`)
  because its "Loading projects…" / "Retry" text clashes with AIO assertions. The wizard test needs
  the same stub.
- Pre-commit hook runs the full vitest suite + biome + tsc. Put the test and implementation in ONE commit.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Mount ReleaseManagementBlock in the onboarding Integrations step (optional, non-gating)</name>
  <files>taskflow/src/routes/onboarding/IntegrationsStep.tsx, taskflow/src/routes/onboarding/IntegrationsStep.test.tsx</files>
  <behavior>
    - The step renders the RM block (stubbed in the test as `<div data-testid="rm-block" />`) next to the aio-block stub.
    - DOM order is aio-block, then rm-block, then the "Enable Tempo Timesheets" checkbox, the same as Settings > Integrations. Assert with `compareDocumentPosition`.
    - With aioEnabled=false, Continue stays enabled and clicking it still calls set({ integrationsVisited: true }) and goNext. RM selection never affects gating.
    - Subtitle text is updated (see action) and the heading test regex matches it.
    - All existing D-01..D-04 / WR-01 / Tempo tests still pass unchanged.
  </behavior>
  <action>
In IntegrationsStep.tsx:
1. Add `import ReleaseManagementBlock from '@/components/integrations/ReleaseManagementBlock';` next to the AioBlock import (keep biome's sorted import order).
2. Render `<ReleaseManagementBlock />` straight after `<AioBlock />` and before the Tempo block, matching the order in `routes/settings/IntegrationsSection.tsx`. Add a short JSX comment: optional, never gates Continue, writes settings.releaseManagementProjectKey directly (no wizard-local state).
3. Leave `continueDisabled` alone. Do NOT add an RM projects query or any RM term to the gating. RM is optional and "None" is valid.
4. Change the subtitle from "Enable optional plugins to see test execution and worklog data." to "Enable optional plugins and pick the Release Management project for test execution, worklog and deployment package data."
5. Update the file header doc comment so it says the step also mounts ReleaseManagementBlock, which is optional and non-gating.

In IntegrationsStep.test.tsx:
1. Add a stub next to the AioBlock stub: `vi.mock('@/components/integrations/ReleaseManagementBlock', () => ({ default: () => <div data-testid="rm-block" /> }))`, with a comment pointing to ReleaseManagementBlock.test.tsx for the block's own coverage.
2. Update the subtitle regex in the "renders the step heading and subtitle" test to the new text.
3. Add a test "mounts the ReleaseManagementBlock stub between AIO and Tempo". It asserts `getByTestId('rm-block')` exists and that aio-block DOCUMENT_POSITION_FOLLOWING rm-block DOCUMENT_POSITION_FOLLOWING the Tempo checkbox (`getByRole('checkbox', { name: /enable tempo timesheets/i })`).
4. Add a test "Release Management never gates Continue". With aioEnabled=false and fetchAioProjects resolving [], Continue is enabled. Clicking it calls mockOnboardingStore.set with { integrationsVisited: true } and calls goNext once.

Do NOT edit ReleaseManagementBlock.tsx, OnboardingWizard.tsx, onboarding.store.ts or settings.store.ts. Fixtures and placeholders use example.com values only (no customer data).
Run `npx biome check` only on the two touched files, never `--write` across all of src. Commit test + impl together in one commit using `git commit -- <paths>`, then check `git log -1 --stat`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/onboarding/IntegrationsStep.test.tsx src/components/integrations/ReleaseManagementBlock.test.tsx src/routes/settings/IntegrationsSection.test.tsx && npx biome check src/routes/onboarding/IntegrationsStep.tsx src/routes/onboarding/IntegrationsStep.test.tsx && npx tsc --noEmit -p . && grep -c "<ReleaseManagementBlock />" src/routes/onboarding/IntegrationsStep.tsx</automated>
  </verify>
  <done>
    - IntegrationsStep renders ReleaseManagementBlock between AioBlock and Tempo.
    - Continue gating is unchanged and RM-independent. The new tests prove both.
    - The three vitest files pass, biome is clean on the touched files, tsc passes. One commit holds both files.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify the RM picker in the live onboarding wizard</name>
  <what-built>The wizard Integrations step now includes the Release Management project picker (Task 1).</what-built>
  <how-to-verify>
    1. Reset onboarding (clear onboardingComplete in the persisted settings, or use the dev-tools reset if one exists) and run `npm run tauri dev` in taskflow/taskflow.
    2. Go through Welcome > Jira > GitLab to the Integrations step.
    3. Check that a "Release Management" section shows under AIO and above Tempo, and that its project list loads.
    4. Leave it at None and check that Continue works. Go Back, pick a project, then Continue to Done.
    5. Open Settings > Integrations and check that the same project shows as selected there.
  </how-to-verify>
  <files>none (verification only)</files>
  <action>Run `npm run tauri dev` from taskflow/taskflow so the user can go through the wizard. Then pause for the user to check the steps in how-to-verify. Make no code changes.</action>
  <verify><automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/onboarding/IntegrationsStep.test.tsx</automated></verify>
  <done>The user confirms the RM picker shows in the wizard, None does not block Continue, and a chosen project shows in Settings > Integrations.</done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app -> Jira REST | Existing listJiraProjects call made by the reused block, using the stored PAT |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lrr-01 | Information disclosure | ReleaseManagementBlock token read | accept | Reuses the existing readSecret('jira-pat') path unchanged. No new secret handling or logging. |
| T-lrr-02 | Tampering | releaseManagementProjectKey | accept | Value is limited to keys returned by Jira or null via the existing Select. Same setter as Settings. |
</threat_model>

<verification>
- Targeted vitest files pass. The full suite passes via the pre-commit hook.
- `grep -c "<ReleaseManagementBlock />" src/routes/onboarding/IntegrationsStep.tsx` returns 1.
- `git show --stat HEAD` for the Task 1 commit touches only the two planned files.
</verification>

<success_criteria>
A new user can pick the Release Management project during onboarding. The choice persists to the
same settings key Settings uses, and skipping it (None) never blocks the wizard.
</success_criteria>

<output>
Create `.planning/quick/261112-lrr-add-release-management-setup-into-the-on/261112-lrr-SUMMARY.md` when done
</output>
