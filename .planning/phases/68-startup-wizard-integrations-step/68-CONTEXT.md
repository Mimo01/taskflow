# Phase 68: Startup Wizard — Integrations Step - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a 5th step ("Integrations") to the onboarding wizard between GitLab (step 2) and Done (step 3). The new step exposes the AIO toggle + project picker and the Tempo toggle. All selections write directly to the existing `useSettingsStore` — no separate wizard-only state. The onboarding store's `goNext`/`goBack` step limits (currently hardcoded to 3) must be bumped to 4.

**New wizard step order:** Welcome (0) → Jira (1) → GitLab (2) → Integrations (3) → Done (4)

**Locked by requirements:** WIZ-01, WIZ-02, WIZ-03, WIZ-04

</domain>

<decisions>
## Implementation Decisions

### Continue gating (WIZ-02)
- **D-01:** Continue is **enabled only when**: AIO toggle is off, OR (AIO toggle is on AND a project has been successfully selected from the loaded list).
- **D-02:** While projects are still loading (isLoading) → Continue is disabled.
- **D-03:** If the project fetch errors → Continue is disabled. User must retry or disable the AIO toggle to advance.
- **D-04:** If the project list loads but is empty → Continue is disabled. User must disable the AIO toggle to advance (same behavior as error: no project to pick).

### Component extraction (WIZ-02, reuse)
- **D-05:** Extract a shared component from `IntegrationsSection.tsx` rather than duplicating inline or adding a layout prop to IntegrationsSection. Both `IntegrationsSection` and the new `IntegrationsStep` import the extracted component.
- **D-06:** The extracted component covers the AIO block only (toggle + conditional picker with all loading/error/empty states). The Tempo toggle is a single checkbox — not worth extracting.

### Integrations step fidelity (WIZ-02)
- **D-07:** Full fidelity — the extracted component includes all edge case handling from IntegrationsSection: loading spinner, error/retry button, stale key warning, and empty project list state.
- **D-08:** Wizard step visual layout: centered column, `max-w-lg mx-auto py-8`, matching JiraStep and GitLabStep. The extracted AIO component adapts to whatever container wraps it.
- **D-09:** Navigation buttons: **Back** (returns to GitLabStep) + **Continue** (advances to DoneStep, gated per D-01..D-04).

### WIZ-04 — Settings store as single source of truth
- **D-10:** The Integrations step reads and writes `aioEnabled`, `tempoEnabled`, and `selectedAioProjectKey` directly from/to `useSettingsStore` — same as IntegrationsSection does today. No wizard-local state for these fields. No deferred write on wizard completion.

### Claude's Discretion
- Location for the extracted shared component: planner/researcher chooses based on existing `src/components/` subdirectory conventions. `src/components/integrations/` or colocating with `src/components/aio/` are both reasonable.
- `completedSteps` in `OnboardingWizard.tsx`: Integrations (step 3) has no Boolean validation flag like `jiraValidated`/`gitlabValidated`. Claude may leave it out of `completedSteps` (step shows as current while on it; not checkmarked when past it — consistent with DoneStep behavior). Alternatively, add an `integrationsVisited` flag to onboarding store and push step 3 after Continue. Planner decides based on what's cleanest.
- Step label in StepIndicator: "Integrations" (from ROADMAP).
- Order of commits (extract component → update IntegrationsSection → new IntegrationsStep → wizard/store wiring) — planner decides based on TypeScript-safe incremental ordering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Startup Wizard (WIZ-01, WIZ-02, WIZ-03, WIZ-04) — exact acceptance criteria

### Wizard shell and navigation
- `taskflow/src/components/app/OnboardingWizard.tsx` — STEP_LABELS, STEP_COMPONENTS, completedSteps logic; must add Integrations entry and bump array indices
- `taskflow/src/stores/onboarding.store.ts` — `goNext: () => set({ step: Math.min(3, ...) })` must become `Math.min(4, ...)`; `goBack` limit is 0 (no change needed)

### Settings store (single source of truth)
- `taskflow/src/stores/settings.store.ts` — `aioEnabled`, `setAioEnabled`, `tempoEnabled`, `setTempoEnabled`, `selectedAioProjectKey`, `setSelectedAioProjectKey` — IntegrationsStep reads/writes these directly (no separate wizard state)

### AIO picker — source to extract from
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — full AIO picker + Tempo toggle; the AIO block (lines ~14–146) is the source for extraction; IntegrationsSection must be updated to import the extracted component after extraction

### Step patterns to follow
- `taskflow/src/routes/onboarding/GitLabStep.tsx` — step layout, navigation (Back + Continue), button gating pattern
- `taskflow/src/routes/onboarding/DoneStep.tsx` — final step reference

### Build verification
- `.planning/STATE.md` — use `npm run build`, not just `tsc` (Phase 59 standing rule)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSettingsStore()` — `aioEnabled`, `setAioEnabled`, `tempoEnabled`, `setTempoEnabled`, `selectedAioProjectKey`, `setSelectedAioProjectKey` — all already exist; IntegrationsStep binds directly to these
- `IntegrationsSection.tsx` AIO block — project fetch query, loading/error/empty/stale states, sorted project list, Select component — all to be extracted
- `useOnboardingStore().goNext` / `goBack` — navigation primitives used by all steps; limit bump required
- `StepIndicator` — accepts `steps: string[]`, `currentStep: number`, `completedSteps: number[]`; new step requires new label entry

### Established Patterns
- Wizard step layout: `flex flex-col gap-6 max-w-lg mx-auto py-8` (from GitLabStep/JiraStep)
- Navigation buttons: `<Button variant="ghost" onClick={goBack}>Back</Button>` + `<Button onClick={handleContinue} disabled={...}>Continue</Button>` (from GitLabStep)
- Settings store binds: fine-grained selectors per field (`useSettingsStore((s) => s.aioEnabled)`) to avoid re-renders — carry this pattern into IntegrationsStep
- AIO project fetch: `useQuery({ queryKey: ['aio', jiraBaseUrl, 'projects'], queryFn: ... , enabled: !!jiraBaseUrl && !!token })` with `readSecret('jira-pat')` in `useEffect`; same fetch pattern needed in IntegrationsStep

### Integration Points
- `IntegrationsSection.tsx` must be updated to import the extracted AIO component after extraction — net LOC in IntegrationsSection should decrease
- `OnboardingWizard.tsx` — add `IntegrationsStep` import, update `STEP_LABELS` and `STEP_COMPONENTS`, update `completedSteps` logic
- `onboarding.store.ts` — update `goNext` step limit (3 → 4)
- `src/routes/onboarding/index.tsx` — may export step components; check if IntegrationsStep needs an export here

</code_context>

<specifics>
## Specific Ideas

- The extracted AIO component should be **self-contained** (owns its own query, token fetch, sorted list, stale key check) so that both IntegrationsSection and IntegrationsStep just mount it without passing data props. The component reads from `useSettingsStore` and `useAuthStore` internally — same pattern as IntegrationsSection today.
- Continue button disabled state: `const continueDisabled = aioEnabled && (!selectedAioProjectKey || isLoading || isError || (projects && projects.length === 0))`. When `aioEnabled` is false, this is always false (enabled).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 68-Startup Wizard — Integrations Step*
*Context gathered: 2026-05-24*
