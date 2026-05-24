# Phase 68: Startup Wizard — Integrations Step - Research

**Researched:** 2026-05-24
**Domain:** React component extraction + onboarding wizard extension (Tauri/Vite/Zustand/TanStack Query)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Continue is enabled only when: AIO toggle is off, OR (AIO toggle is on AND a project has been successfully selected from the loaded list).
**D-02:** While projects are still loading (isLoading) → Continue is disabled.
**D-03:** If the project fetch errors → Continue is disabled. User must retry or disable the AIO toggle to advance.
**D-04:** If the project list loads but is empty → Continue is disabled. User must disable the AIO toggle to advance (same behavior as error: no project to pick).
**D-05:** Extract a shared component from `IntegrationsSection.tsx` rather than duplicating inline or adding a layout prop to IntegrationsSection.
**D-06:** The extracted component covers the AIO block only (toggle + conditional picker with all loading/error/empty states). The Tempo toggle is not extracted.
**D-07:** Full fidelity — the extracted component includes all edge case handling: loading spinner, error/retry button, stale key warning, and empty project list state.
**D-08:** Wizard step visual layout: `flex flex-col gap-6 max-w-lg mx-auto py-8`, matching JiraStep and GitLabStep.
**D-09:** Navigation buttons: Back (returns to GitLabStep) + Continue (advances to DoneStep, gated per D-01..D-04).
**D-10:** IntegrationsStep reads and writes `aioEnabled`, `tempoEnabled`, and `selectedAioProjectKey` directly from/to `useSettingsStore`. No wizard-local state. No deferred write on wizard completion.

### Claude's Discretion

- Location for the extracted shared component: `src/components/integrations/` or colocating with `src/components/aio/`.
- `completedSteps` handling: Integrations (step 3) has no Boolean validation flag. May leave it out of `completedSteps` (step shows as current while on it, not checkmarked when past it — consistent with DoneStep behavior). Alternatively, add `integrationsVisited` flag to onboarding store. Planner decides based on what's cleanest.
- Step label in StepIndicator: "Integrations".
- Order of commits (extract component → update IntegrationsSection → new IntegrationsStep → wizard/store wiring) — planner decides based on TypeScript-safe incremental ordering.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZ-01 | New "Integrations" step in wizard, between Connections (GitLab) and Done | OnboardingWizard.tsx STEP_LABELS/STEP_COMPONENTS arrays + onboarding.store.ts goNext limit bump (3 → 4) |
| WIZ-02 | Integrations step exposes AIO toggle; when on, shows project picker (same picker as Settings → Integrations) | Extracted AioBlock component from IntegrationsSection.tsx, all four states preserved |
| WIZ-03 | Integrations step exposes Tempo toggle | Inline Tempo toggle (not extracted) in IntegrationsStep — identical markup to IntegrationsSection.tsx Tempo block |
| WIZ-04 | Wizard completion writes Integrations selections into Settings store (single source of truth — no separate wizard state) | IntegrationsStep binds directly to useSettingsStore — same as IntegrationsSection today; no new store fields required |

</phase_requirements>

---

## Summary

Phase 68 is a surgical extension of the existing 4-step onboarding wizard (Welcome → Jira → GitLab → Done) to a 5-step wizard (Welcome → Jira → GitLab → Integrations → Done). The work breaks into three tightly-coupled pieces: (1) extract the AIO picker block from `IntegrationsSection.tsx` into a shared component, (2) create a new `IntegrationsStep` route component that uses that shared component plus an inline Tempo toggle, and (3) wire the new step into `OnboardingWizard.tsx` and bump the `goNext` limit in `onboarding.store.ts`.

All settings reads and writes go directly to `useSettingsStore` — the same store `IntegrationsSection` uses today. There is no new persisted state, no migration, and no new npm packages. The wizard shell (`OnboardingWizard.tsx`) needs only two data changes: a new entry in `STEP_LABELS`/`STEP_COMPONENTS`, and updated `completedSteps` derivation. The `onboarding.store.ts` needs one line changed: `Math.min(3, ...)` → `Math.min(4, ...)`. The existing `IntegrationsSection.test.tsx` covers most logic for the shared component; additional tests are needed for `IntegrationsStep` navigation gating and the store limit bump.

One important discrepancy: `IntegrationsSection.tsx` currently uses `font-medium` (weight 500) and `gap-1.5` (6px) in the AIO toggle label and picker container. The UI-SPEC (updated in commit `be69a770`) explicitly drops `font-medium` in favor of `font-normal` and replaces `gap-1.5` with `gap-2`. The **extracted component must use the corrected values** from the UI-SPEC, not copy verbatim from the source file.

**Primary recommendation:** Create the extracted `AioBlock` component in `src/components/integrations/AioBlock.tsx`, update `IntegrationsSection` to import it, then build `IntegrationsStep` on top of it. Commit in TypeScript-safe order: extract → update consumer → new step → wizard wiring.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AIO toggle state (on/off) | Settings store (persisted) | — | Must survive wizard close; D-10 locks this to useSettingsStore |
| Tempo toggle state (on/off) | Settings store (persisted) | — | Same; D-10 |
| AIO project key selection | Settings store (persisted) | — | Same; D-10; selectedAioProjectKey already in store |
| AIO project list fetching | Frontend component (useQuery) | API service (fetchAioProjects) | TanStack Query in the extracted component owns the fetch lifecycle |
| Wizard step navigation | Onboarding store (ephemeral) | Wizard shell (OnboardingWizard) | goNext/goBack live in onboarding.store; wizard shell renders by step index |
| Step progress display | StepIndicator component | — | Already accepts steps[]/currentStep/completedSteps props |
| Continue button gating | IntegrationsStep (local derived) | Settings store (read) | Derived from store reads; no new store state needed |

---

## Standard Stack

### Core (no new installs — all already in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | Component rendering | Project standard |
| `zustand` | 5.0.11 | Settings + onboarding state | Project standard; useSettingsStore and useOnboardingStore already exist |
| `@tanstack/react-query` | 5.90.21 | AIO project list fetch with loading/error/refetch | Already used in IntegrationsSection.tsx |
| `@tauri-apps/plugin-stronghold` | 2.3.1 | Read Jira PAT for AIO fetch (readSecret) | Used in IntegrationsSection.tsx; same pattern needed in AioBlock |
| `lucide-react` | 0.577.0 | Loader2, XCircle icons | Already in IntegrationsSection.tsx |
| shadcn components | installed | Button, Label, Select, SelectTrigger, SelectContent, SelectItem | All installed; no new shadcn add needed |

**Installation:** No new packages. All dependencies already present. [VERIFIED: codebase inspection]

---

## Package Legitimacy Audit

No new packages are installed in this phase. All components and libraries are already present in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User (onboarding flow)
    │
    ▼
OnboardingWizard.tsx
    │  reads: useOnboardingStore().step
    │  renders: STEP_COMPONENTS[step]
    │
    ├─ step 0 → WelcomeStep
    ├─ step 1 → JiraStep
    ├─ step 2 → GitLabStep
    ├─ step 3 → IntegrationsStep  ← NEW
    │              │
    │              ├─ <AioBlock />  (extracted)
    │              │     ├─ reads/writes: useSettingsStore (aioEnabled, selectedAioProjectKey)
    │              │     ├─ reads: useAuthStore (jiraBaseUrl)
    │              │     ├─ reads: readSecret('jira-pat')  [Stronghold IPC]
    │              │     └─ fetches: fetchAioProjects()  [TanStack Query]
    │              │
    │              ├─ Tempo toggle (inline)
    │              │     └─ reads/writes: useSettingsStore (tempoEnabled)
    │              │
    │              └─ Navigation
    │                    ├─ Back → useOnboardingStore().goBack()
    │                    └─ Continue → useOnboardingStore().goNext()  [gated]
    │
    └─ step 4 → DoneStep

Settings → IntegrationsSection.tsx
    └─ <AioBlock />  (same extracted component — updated to import it)
```

### Recommended Project Structure

```
src/
├── components/
│   └── integrations/
│       └── AioBlock.tsx          # new — extracted from IntegrationsSection
├── routes/
│   ├── onboarding/
│   │   └── IntegrationsStep.tsx  # new wizard step
│   └── settings/
│       └── IntegrationsSection.tsx  # updated — imports AioBlock instead of inline
└── stores/
    └── onboarding.store.ts       # bump goNext limit 3 → 4
```

**Why `src/components/integrations/`:** There is no existing `src/components/aio/` directory. The `src/components/` directory currently holds only top-level app components (not organized by feature subdomain). Creating `integrations/` establishes a clean feature subdirectory consistent with how services are organized (`src/services/aio/`, `src/services/tempo/`). [VERIFIED: codebase inspection]

### Pattern 1: Fine-Grained Zustand Selectors

**What:** Each store field read as a separate selector rather than destructuring the whole store object.
**When to use:** Always for components that touch useSettingsStore — avoids re-rendering on unrelated store mutations.
**Example:**
```typescript
// Source: IntegrationsSection.tsx (existing pattern)
const aioEnabled = useSettingsStore((s) => s.aioEnabled);
const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
const setSelectedAioProjectKey = useSettingsStore((s) => s.setSelectedAioProjectKey);
const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);
```

### Pattern 2: AIO Project Fetch (self-contained component)

**What:** Token read via useEffect + Stronghold, then passed to useQuery with enabled guard.
**When to use:** Any component that needs the AIO project list.
**Example:**
```typescript
// Source: IntegrationsSection.tsx (existing pattern — carries into AioBlock)
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  if (!jiraBaseUrl) return;
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, [jiraBaseUrl]);

const { data: projects, isLoading, isError, refetch } = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'projects'],
  queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
  enabled: !!jiraBaseUrl && !!token,
});
```

### Pattern 3: Continue Gating Expression

**What:** Derived boolean from store reads — no new store state.
**When to use:** IntegrationsStep Continue button disabled prop.
**Example:**
```typescript
// Source: CONTEXT.md specifics block
const continueDisabled = aioEnabled && (
  !selectedAioProjectKey ||
  isLoading ||
  isError ||
  (Array.isArray(projects) && projects.length === 0)
);
```

### Pattern 4: Wizard Navigation

**What:** Call goNext()/goBack() from onboarding store for step transitions.
**When to use:** All wizard step components.
**Example:**
```typescript
// Source: GitLabStep.tsx:52-62
const handleContinue = () => {
  // IntegrationsStep: no validation needed, settings already written to store
  goNext();
};
// Back button:
<Button variant="ghost" onClick={goBack}>Back</Button>
<Button onClick={handleContinue} disabled={continueDisabled}>Continue</Button>
```

### Anti-Patterns to Avoid

- **Duplicating AIO block inline in IntegrationsStep:** Both IntegrationsSection and IntegrationsStep would then diverge. D-05 locks extraction.
- **Adding wizard-specific state for aioEnabled/tempoEnabled:** D-10 locks direct settings store binding. Do not add `aioEnabledDraft` or similar.
- **Copying gap-1.5 or font-medium from IntegrationsSection.tsx:** The UI-SPEC was updated (commit `be69a770`) to use `gap-2` and `font-normal`. The source file has not yet been updated. The extracted component must reflect the UI-SPEC, not the source file as it currently stands.
- **Adding IntegrationsStep to onboarding/index.tsx exports:** The index.tsx only re-exports/routes to `OnboardingWizard`. Step components are imported directly in `OnboardingWizard.tsx`. No index change needed.
- **Using `Math.min(3, ...)` in goNext test assertions without bumping:** The existing `onboarding.store.test.ts` has step-limit tests that will need to be updated to reflect the new max of 4.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AIO project fetch with loading/error/retry | Custom fetch logic | TanStack Query useQuery | Already implemented in IntegrationsSection; stale-while-revalidate, error states, refetch all handled |
| PAT token read from Stronghold | Direct Tauri IPC | `readSecret()` from `@/services/stronghold` | Already abstracted; handles IPC and failure |
| Project list alphabetical sort | Custom sort utility | `localeCompare` with `{ sensitivity: 'base' }` in useMemo | Already implemented; case-insensitive, consistent with IntegrationsSection |
| Step progress UI | Custom stepper | `StepIndicator` | Already accepts dynamic `steps[]` array — just add the new label |

**Key insight:** This phase is almost entirely extraction + wiring. The hard part (AIO fetch, sort, all four picker states, stale key detection) is already implemented in `IntegrationsSection.tsx`. The risk is divergence introduced during extraction — specifically the `gap-1.5` → `gap-2` and `font-medium` → `font-normal` corrections that must be applied during extraction.

---

## Common Pitfalls

### Pitfall 1: Copying gap-1.5 and font-medium from the source file

**What goes wrong:** The extracted `AioBlock` and `IntegrationsStep` render with non-spec spacing (6px instead of 8px) and wrong font weight.
**Why it happens:** `IntegrationsSection.tsx` currently uses `gap-1.5` in three places and `font-medium` in the toggle label. The UI-SPEC fix (`be69a770`) updated the design contract document but NOT the source file. A naive copy-paste propagates the old values.
**How to avoid:** When extracting, replace every `gap-1.5` with `gap-2` and `font-medium` with `font-normal` in the AIO block.
**Warning signs:** Review extracted file for `gap-1.5` or `font-medium` strings before committing.

### Pitfall 2: Not updating IntegrationsSection to import AioBlock

**What goes wrong:** AIO picker logic exists in two places — IntegrationsSection (old inline) and AioBlock (extracted). Any future AIO picker fix must be applied twice.
**Why it happens:** D-05 mandates that IntegrationsSection imports the extracted component. Easy to skip if testing IntegrationsStep in isolation first.
**How to avoid:** The extract step must include updating IntegrationsSection in the same commit or immediately after. Net LOC in IntegrationsSection should decrease.
**Warning signs:** IntegrationsSection.tsx still contains the AIO `<div className="flex flex-col gap-4">...</div>` block after the phase is done.

### Pitfall 3: goNext limit test in onboarding.store.test.ts

**What goes wrong:** Existing test `goNext increments step` passes, but a new test proving the limit is 4 (not 3) is missing, or the existing max-step clamping test (if any is added) checks for 3.
**Why it happens:** The store test file tests the current behavior (max 3). After bumping to 4, the test must be updated to assert the new limit.
**How to avoid:** Update `onboarding.store.test.ts` to assert `goNext` clamps at step 4, not step 3.
**Warning signs:** Running `npm test` passes without any assertion on the new max step value.

### Pitfall 4: AioBlock query key collision with IntegrationsSection

**What goes wrong:** None — TanStack Query deduplicates queries with the same key. Both components sharing `['aio', jiraBaseUrl, 'projects']` is correct and beneficial (single network request when both are mounted, which cannot happen since they live in separate routes).
**Why it happens:** Not actually a problem, but might cause confusion. Document that shared query keys are intentional.
**How to avoid:** No action needed. Same query key is correct.

### Pitfall 5: completedSteps for step 3 (Integrations)

**What goes wrong:** The wizard shows step 3 as "incomplete" when the user navigates to Done, which may look odd if the user did interact with integrations.
**Why it happens:** Unlike JiraStep (`jiraValidated`) and GitLabStep (`gitlabValidated`), there is no Boolean success flag for IntegrationsStep. The CONTEXT.md explicitly allows leaving step 3 out of completedSteps, consistent with DoneStep behavior.
**How to avoid:** The cleanest approach is to add `integrationsVisited: boolean` to `OnboardingState` in onboarding.store.ts, set it to `true` in IntegrationsStep's `handleContinue`, and push step 3 into `completedSteps` in OnboardingWizard when `integrationsVisited` is true. This is the same pattern as jiraValidated/gitlabValidated. Planner should choose this for consistency.
**Warning signs:** Step 3 shows as "current" circle (number 4, not checkmark) even after the user has passed through it to Done.

---

## Code Examples

### AioBlock extracted component skeleton

```typescript
// src/components/integrations/AioBlock.tsx
// Source pattern: IntegrationsSection.tsx lines 11-146 + UI-SPEC corrections
import { useQuery } from '@tanstack/react-query';
import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function AioBlock() {
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);
  const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
  const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
  const setSelectedAioProjectKey = useSettingsStore((s) => s.setSelectedAioProjectKey);

  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!jiraBaseUrl) return;
    readSecret('jira-pat').then(setToken).catch(() => setToken(null));
  }, [jiraBaseUrl]);

  const { data: projects, isLoading, isError, refetch } = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'projects'],
    queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
    enabled: !!jiraBaseUrl && !!token,
  });

  const sortedProjects = useMemo(
    () => projects ? [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })) : [],
    [projects],
  );

  const selectedProject = projects?.find((p) => p.projectKey === selectedAioProjectKey);
  const selectedKeyIsStale = !!selectedAioProjectKey && Array.isArray(projects) && !selectedProject;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        AIO Test Management
      </h3>
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          {/* UI-SPEC: font-normal NOT font-medium */}
          <p className="text-sm font-normal">Enable AIO Test Management</p>
          <p className="text-xs text-muted-foreground">
            Show test execution data from AIO TCMS. Requires AIO plugin on your Jira instance.
          </p>
        </div>
        <input
          type="checkbox"
          aria-label="Enable AIO Test Management"
          checked={aioEnabled}
          onChange={(e) => setAioEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>
      {aioEnabled && (
        {/* UI-SPEC: gap-2 NOT gap-1.5 */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="aio-project">AIO Project</Label>
          {/* ... loading / error / empty / loaded states identical to IntegrationsSection ... */}
        </div>
      )}
    </div>
  );
}
```

### IntegrationsStep skeleton

```typescript
// src/routes/onboarding/IntegrationsStep.tsx
// Source pattern: GitLabStep.tsx layout + DoneStep.tsx import of useSettingsStore
import { Button } from '@/components/ui/button';
import AioBlock from '@/components/integrations/AioBlock';
import { useSettingsStore } from '@/stores/settings.store';
import { useOnboardingStore } from '@/stores/onboarding.store';

export default function IntegrationsStep() {
  const { goBack, goNext } = useOnboardingStore();
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);
  const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
  // isLoading and isError come from AioBlock — see Pitfall note below

  // NOTE: continueDisabled needs isLoading/isError from the query.
  // Options: (a) lift the query up into IntegrationsStep and pass down to AioBlock,
  // or (b) keep AioBlock self-contained and duplicate the query here with same key
  // (TanStack Query deduplicates — same network request).
  // Option (b) is simpler and consistent with the self-contained pattern in D-05/specifics.

  const handleContinue = () => {
    // optionally: set({ integrationsVisited: true }) in onboarding store
    goNext();
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
      <div>
        <h2 className="text-xl font-semibold">Set up Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enable optional plugins to see test execution and worklog data.
        </p>
      </div>
      <AioBlock />
      {/* Tempo toggle — inline, not extracted (D-06) */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tempo Timesheets
        </h3>
        {/* ... toggle markup ... */}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={goBack}>Back</Button>
        <Button onClick={handleContinue} disabled={continueDisabled}>Continue</Button>
      </div>
    </div>
  );
}
```

### OnboardingWizard.tsx changes

```typescript
// Add to imports:
import IntegrationsStep from '@/routes/onboarding/IntegrationsStep';

// Update:
const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Integrations', 'Done'];
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, IntegrationsStep, DoneStep];

// Update completedSteps (if adding integrationsVisited):
const { step, jiraValidated, gitlabValidated, integrationsVisited } = useOnboardingStore();
const completedSteps: number[] = [];
if (jiraValidated) completedSteps.push(1);
if (gitlabValidated) completedSteps.push(2);
if (integrationsVisited) completedSteps.push(3);
```

### onboarding.store.ts change

```typescript
// Line 42: change 3 to 4
goNext: () => set({ step: Math.min(4, get().step + 1) }),
// Also add to OnboardingState interface and initial state (if using integrationsVisited):
integrationsVisited: boolean;
// in create:
integrationsVisited: false,
```

---

## Design Decision: isLoading/isError access from IntegrationsStep

The Continue button gating requires `isLoading` and `isError` from the AIO project query, but if `AioBlock` is self-contained (D-05 / specifics), those values are encapsulated inside it.

**Two valid approaches:**

**Option A: Duplicate query in IntegrationsStep** — TanStack Query uses the same query key `['aio', jiraBaseUrl, 'projects']`, so it deduplicates to a single network request. IntegrationsStep reads `isLoading`/`isError` from its own `useQuery` call. AioBlock remains fully self-contained.

**Option B: Lift query state up** — IntegrationsStep runs the query and passes `isLoading`/`isError`/`refetch`/`projects` as props to AioBlock. AioBlock becomes a pure display component.

**Recommendation: Option A** — consistent with the "self-contained" language in CONTEXT.md specifics, no prop drilling, and TanStack Query's deduplication guarantees a single network round-trip. The planner should use Option A.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Wizard hardcoded to 4 steps (0-3) | Bump to 5 steps (0-4); goNext max 3 → 4 | One line change in store, one array update in wizard |
| AIO toggle only in Settings | AIO toggle also in wizard step | No new store fields; direct settings store binding |

---

## Open Questions

1. **`integrationsVisited` flag vs. no completedSteps for step 3**
   - What we know: The CONTEXT.md Claude's Discretion explicitly allows either approach. DoneStep (step 4) is never in completedSteps either.
   - What's unclear: User preference for visual checkmark on step 3 after passing through.
   - Recommendation: Add `integrationsVisited: boolean` to the onboarding store and set it true in `handleContinue`. This is consistent with `jiraValidated`/`gitlabValidated`, costs one flag, and gives the step a proper checkmark. The planner should adopt this.

2. **Where AioBlock's `isLoading`/`isError` are read for Continue gating**
   - What we know: Both Option A (duplicate query) and Option B (prop lift) work correctly.
   - Recommendation: Option A (duplicate useQuery in IntegrationsStep with same key). Documents explicitly as "intentional deduplication".

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes with no external tool dependencies beyond the project's existing runtime.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZ-01 | IntegrationsStep renders in wizard at step 3 | unit | `cd taskflow && npm test -- onboarding.store` | Partial — store test exists; step render test needed |
| WIZ-01 | goNext clamps at step 4 (not 3) | unit | `cd taskflow && npm test -- onboarding.store` | ❌ Wave 0 — new test case needed in existing file |
| WIZ-02 | AioBlock shows all 4 states (loading/error/empty/loaded) | unit | `cd taskflow && npm test -- AioBlock` | ❌ Wave 0 — new file |
| WIZ-02 | Continue disabled when aioEnabled+loading | unit | `cd taskflow && npm test -- IntegrationsStep` | ❌ Wave 0 — new file |
| WIZ-02 | Continue enabled when aioEnabled=false | unit | `cd taskload && npm test -- IntegrationsStep` | ❌ Wave 0 — new file |
| WIZ-03 | Tempo toggle renders and writes tempoEnabled | unit | `cd taskflow && npm test -- IntegrationsStep` | ❌ Wave 0 — new file |
| WIZ-04 | IntegrationsStep writes to settings store directly | unit | `cd taskflow && npm test -- IntegrationsStep` | ❌ Wave 0 — new file |

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/components/integrations/AioBlock.test.tsx` — covers WIZ-02 picker states (loading/error/empty/loaded) — can adapt from `IntegrationsSection.test.tsx` mocks (Select mock, fetchAioProjects mock, readSecret mock patterns are reusable)
- [ ] `taskflow/src/routes/onboarding/IntegrationsStep.test.tsx` — covers WIZ-02 Continue gating (D-01..D-04), WIZ-03 Tempo toggle, WIZ-04 store binding
- [ ] New test case in `taskflow/src/stores/onboarding.store.test.ts` — goNext clamps at 4 and `integrationsVisited` flag (if added)

Note: The existing `IntegrationsSection.test.tsx` Select mock and store mock pattern is the exact template to follow for `AioBlock.test.tsx` — copy the vi.mock blocks verbatim.

---

## Security Domain

ASVS categories for this phase:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No | No user-entered text in this step |
| V6 Cryptography | No — adjacent | PAT read via readSecret() already handled by Stronghold; no crypto hand-rolled |

No new security surface. The Stronghold token read follows the established `readSecret('jira-pat')` pattern already in IntegrationsSection.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/components/integrations/` is the right directory for AioBlock (Claude's Discretion) | Architecture Patterns | Low — planner can choose `src/components/aio/` instead without any other changes |
| A2 | Option A (duplicate useQuery in IntegrationsStep) is cleaner than Option B (prop lift) for isLoading/isError access | Design Decision section | Low — both approaches are functionally equivalent; risk is minor structural preference |
| A3 | Adding `integrationsVisited` flag to onboarding store is the right call for completedSteps (Claude's Discretion) | Open Questions | Low — explicit CONTEXT.md permission to skip it; only aesthetic consequence |

**All locked decisions (D-01 through D-10) are VERIFIED against CONTEXT.md and codebase inspection. No assumed facts in the locked decision space.**

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — source of extraction; all AIO block logic confirmed by direct read
- `taskflow/src/components/app/OnboardingWizard.tsx` — STEP_LABELS/STEP_COMPONENTS/completedSteps confirmed by direct read
- `taskflow/src/stores/onboarding.store.ts` — goNext Math.min(3,...) confirmed by direct read
- `taskflow/src/stores/settings.store.ts` — aioEnabled, tempoEnabled, selectedAioProjectKey confirmed by direct read
- `taskflow/src/routes/onboarding/GitLabStep.tsx` — layout and navigation pattern confirmed by direct read
- `.planning/phases/68-startup-wizard-integrations-step/68-CONTEXT.md` — all decisions confirmed
- `.planning/phases/68-startup-wizard-integrations-step/68-UI-SPEC.md` — confirmed; gap-2/font-normal corrections from commit be69a770
- `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — confirmed test patterns and mocks

### Secondary (MEDIUM confidence)
- None needed — all decisions are locked in CONTEXT.md or directly verifiable in codebase

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, versions confirmed from package.json
- Architecture: HIGH — all integration points confirmed by direct code inspection
- Pitfalls: HIGH — gap-1.5/font-medium discrepancy confirmed by comparing source file vs UI-SPEC commit; test gap verified by inspecting test files

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable codebase, no fast-moving external dependencies)
