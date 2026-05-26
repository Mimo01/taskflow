# Phase 68: Startup Wizard — Integrations Step - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/integrations/AioBlock.tsx` | component | request-response + event-driven | `src/routes/settings/IntegrationsSection.tsx` | exact (extraction source) |
| `src/routes/onboarding/IntegrationsStep.tsx` | component | request-response | `src/routes/onboarding/GitLabStep.tsx` | exact |
| `src/routes/settings/IntegrationsSection.tsx` | component | request-response | self (modified to import AioBlock) | exact |
| `src/components/app/OnboardingWizard.tsx` | component | request-response | self (modified) | exact |
| `src/stores/onboarding.store.ts` | store | event-driven | self (modified) | exact |
| `src/stores/onboarding.store.test.ts` | test | — | self (modified) | exact |
| `src/components/integrations/AioBlock.test.tsx` | test | — | `src/routes/settings/IntegrationsSection.test.tsx` | exact |
| `src/routes/onboarding/IntegrationsStep.test.tsx` | test | — | `src/routes/settings/IntegrationsSection.test.tsx` | role-match |

---

## Pattern Assignments

### `src/components/integrations/AioBlock.tsx` (component, request-response)

**Analog:** `src/routes/settings/IntegrationsSection.tsx` (extraction source — lines 1–146)

**CRITICAL UI-SPEC corrections to apply during extraction:**
- Replace every `gap-1.5` with `gap-2` (3 occurrences in the AIO block)
- Replace `font-medium` with `font-normal` in the toggle label `<p>` (line 70)
- Source file has NOT been updated; extracted component must reflect UI-SPEC from commit `be69a770`

**Imports pattern** (lines 1–9 of IntegrationsSection.tsx):
```typescript
import { useQuery } from '@tanstack/react-query';
import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
```

**Fine-grained Zustand selector pattern** (IntegrationsSection.tsx lines 14–19):
```typescript
const aioEnabled = useSettingsStore((s) => s.aioEnabled);
const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
const setSelectedAioProjectKey = useSettingsStore((s) => s.setSelectedAioProjectKey);
// NOTE: tempoEnabled/setTempoEnabled are NOT extracted into AioBlock (D-06)
```

**Token fetch + query pattern** (IntegrationsSection.tsx lines 21–52):
```typescript
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  if (!jiraBaseUrl) return;
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, [jiraBaseUrl]);

const {
  data: projects,
  isLoading,
  isError,
  refetch,
} = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'projects'],
  queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
  enabled: !!jiraBaseUrl && !!token,
});

const sortedProjects = useMemo(
  () =>
    projects
      ? [...projects].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        )
      : [],
  [projects],
);

const selectedProject = projects?.find((p) => p.projectKey === selectedAioProjectKey);
const selectedKeyIsStale = !!selectedAioProjectKey && Array.isArray(projects) && !selectedProject;
```

**AIO block JSX — all four states** (IntegrationsSection.tsx lines 64–146, with UI-SPEC corrections):
```tsx
// Container: matches IntegrationsSection outer AIO wrapper
<div className="flex flex-col gap-4">
  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
    AIO Test Management
  </h3>
  <label className="flex items-center justify-between gap-4 cursor-pointer">
    <div>
      {/* UI-SPEC: font-normal NOT font-medium (source has font-medium — do not copy) */}
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
    {/* UI-SPEC: gap-2 NOT gap-1.5 (source has gap-1.5 — do not copy) */}
    <div className="flex flex-col gap-2">
      <Label htmlFor="aio-project">AIO Project</Label>
      {isLoading ? (
        // UI-SPEC: gap-2 NOT gap-1.5
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading projects…</span>
        </div>
      ) : isError ? (
        // UI-SPEC: gap-2 NOT gap-1.5
        <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <XCircle className="h-4 w-4" />
          <span>
            Couldn't load AIO projects.{' '}
            <button type="button" onClick={() => refetch()} className="underline hover:no-underline">
              Retry
            </button>
          </span>
        </div>
      ) : projects && projects.length === 0 ? (
        <Select disabled value="">
          <SelectTrigger id="aio-project" className="w-full">
            <span className="flex flex-1 text-left text-sm text-muted-foreground">
              No AIO projects available
            </span>
          </SelectTrigger>
          <SelectContent />
        </Select>
      ) : (
        <Select value={selectedAioProjectKey ?? ''} onValueChange={setSelectedAioProjectKey}>
          <SelectTrigger id="aio-project" className="w-full">
            <span className="flex flex-1 text-left text-sm">
              {selectedProject ? (
                selectedProject.name
              ) : (
                <span className="text-muted-foreground">Choose a project...</span>
              )}
            </span>
          </SelectTrigger>
          <SelectContent>
            {sortedProjects.map((p) => (
              <SelectItem key={p.projectKey} value={p.projectKey}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selectedKeyIsStale && (
        <p className="text-xs text-destructive">
          Previously selected project "{selectedAioProjectKey}" is no longer available. Pick
          another or clear the selection.
        </p>
      )}
      {!isLoading && !isError && projects && projects.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pick the AIO Test Management project this app shows.
        </p>
      )}
    </div>
  )}
</div>
```

**Export:** `export default function AioBlock()` — no props (self-contained per D-05/D-07).

---

### `src/routes/onboarding/IntegrationsStep.tsx` (component, request-response)

**Analog:** `src/routes/onboarding/GitLabStep.tsx`

**Imports pattern** (adapt from GitLabStep.tsx lines 10–19):
```typescript
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import AioBlock from '@/components/integrations/AioBlock';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';
```

**Step layout pattern** (GitLabStep.tsx line 67 — identical wrapper for all wizard steps):
```tsx
<div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
  <div>
    <h2 className="text-xl font-semibold">Set up Integrations</h2>
    <p className="text-sm text-muted-foreground mt-1">
      Enable optional plugins to see test execution and worklog data.
    </p>
  </div>
  {/* content */}
  <div className="flex gap-3">
    <Button variant="ghost" onClick={goBack}>Back</Button>
    <Button onClick={handleContinue} disabled={continueDisabled}>Continue</Button>
  </div>
</div>
```

**Navigation pattern** (GitLabStep.tsx lines 52–62):
```typescript
const { goBack, goNext } = useOnboardingStore();

const handleContinue = () => {
  useOnboardingStore.getState().set({ integrationsVisited: true }); // per RESEARCH open question resolution
  goNext();
};
```

**Continue gating pattern** (derived from CONTEXT.md specifics + RESEARCH Pattern 3):
```typescript
// Option A: duplicate query with same key — TanStack Query deduplicates to single network call
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);
useEffect(() => {
  if (!jiraBaseUrl) return;
  readSecret('jira-pat').then(setToken).catch(() => setToken(null));
}, [jiraBaseUrl]);
const { data: projects, isLoading, isError } = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'projects'],  // same key as AioBlock — intentional deduplication
  queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
  enabled: !!jiraBaseUrl && !!token,
});

const aioEnabled = useSettingsStore((s) => s.aioEnabled);
const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);

const continueDisabled = aioEnabled && (
  !selectedAioProjectKey ||
  isLoading ||
  isError ||
  (Array.isArray(projects) && projects.length === 0)
);
```

**Tempo toggle inline pattern** (IntegrationsSection.tsx lines 148–168 — NOT extracted per D-06):
```tsx
const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);

// JSX:
<div className="flex flex-col gap-4">
  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
    Tempo Timesheets
  </h3>
  <label className="flex items-center justify-between gap-4 cursor-pointer">
    <div>
      <p className="text-sm font-semibold">Enable Tempo Timesheets</p>
      <p className="text-xs text-muted-foreground">
        Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira instance.
      </p>
    </div>
    <input
      type="checkbox"
      aria-label="Enable Tempo Timesheets"
      checked={tempoEnabled}
      onChange={(e) => setTempoEnabled(e.target.checked)}
      className="h-4 w-4 accent-primary"
    />
  </label>
</div>
```

---

### `src/routes/settings/IntegrationsSection.tsx` (modified — import AioBlock)

**Change:** Replace the AIO block (lines 14–18 store reads for aio fields, lines 21–52 token/query/sort/stale logic, lines 64–146 AIO JSX) with a single `<AioBlock />` import and mount. Retain the Tempo block (lines 148–168) and the outer `<div data-testid="section-integrations" ...>` wrapper unchanged.

**After modification the file structure is:**
```typescript
import AioBlock from '@/components/integrations/AioBlock';
import { useSettingsStore } from '@/stores/settings.store';

export default function IntegrationsSection() {
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);

  return (
    <div data-testid="section-integrations" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <AioBlock />
      <div className="flex flex-col gap-4">
        {/* Tempo block unchanged from lines 149–168 */}
      </div>
    </div>
  );
}
```

**Note:** All other imports (`useQuery`, `Loader2`, `XCircle`, `useEffect`, `useMemo`, `useState`, `Label`, `Select`, `fetchAioProjects`, `readSecret`, `useAuthStore`, aio-related store selectors) are removed from IntegrationsSection after extraction. Net LOC decreases.

---

### `src/components/app/OnboardingWizard.tsx` (modified — add step 3)

**Analog:** Self (existing file, lines 14–47)

**Current STEP_LABELS and STEP_COMPONENTS** (lines 21–23):
```typescript
const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Done'];
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, DoneStep];
```

**Updated pattern:**
```typescript
import IntegrationsStep from '@/routes/onboarding/IntegrationsStep';

const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Integrations', 'Done'];
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, IntegrationsStep, DoneStep];
```

**completedSteps pattern** (current lines 26–30; extend with integrationsVisited):
```typescript
// Current pattern (lines 26–30):
const { step, jiraValidated, gitlabValidated } = useOnboardingStore();
const completedSteps: number[] = [];
if (jiraValidated) completedSteps.push(1);
if (gitlabValidated) completedSteps.push(2);

// Updated pattern (add integrationsVisited — consistent with jiraValidated/gitlabValidated):
const { step, jiraValidated, gitlabValidated, integrationsVisited } = useOnboardingStore();
const completedSteps: number[] = [];
if (jiraValidated) completedSteps.push(1);
if (gitlabValidated) completedSteps.push(2);
if (integrationsVisited) completedSteps.push(3);
```

**StepIndicator usage** (line 38 — no change needed, already accepts dynamic arrays):
```tsx
<StepIndicator steps={STEP_LABELS} currentStep={step} completedSteps={completedSteps} />
```

---

### `src/stores/onboarding.store.ts` (modified — bump limit + integrationsVisited)

**Analog:** Self (existing file)

**Current interface and goNext** (lines 12–27, 42):
```typescript
interface OnboardingState {
  // ... existing fields ...
  jiraValidated: boolean;
  gitlabValidated: boolean;
  set: (partial: Partial<Omit<OnboardingState, 'set' | 'goNext' | 'goBack'>>) => void;
  goNext: () => void;
  goBack: () => void;
}

goNext: () => set({ step: Math.min(3, get().step + 1) }),  // line 42 — change 3 → 4
```

**Updated pattern:**
```typescript
interface OnboardingState {
  // ... existing fields unchanged ...
  jiraValidated: boolean;
  gitlabValidated: boolean;
  integrationsVisited: boolean;  // ADD: consistent with jiraValidated/gitlabValidated
  set: (partial: Partial<Omit<OnboardingState, 'set' | 'goNext' | 'goBack'>>) => void;
  goNext: () => void;
  goBack: () => void;
}

// In create():
integrationsVisited: false,  // ADD to initial state
goNext: () => set({ step: Math.min(4, get().step + 1) }),  // CHANGE 3 → 4
```

---

### `src/stores/onboarding.store.test.ts` (modified — update step limit tests)

**Analog:** Self (existing file, lines 1–62)

**Current beforeEach reset state** (lines 7–21):
```typescript
act(() => {
  useOnboardingStore.setState({
    step: 0,
    // ... existing fields ...
    jiraValidated: false,
    gitlabValidated: false,
  });
});
```

**Updated beforeEach (add integrationsVisited):**
```typescript
act(() => {
  useOnboardingStore.setState({
    step: 0,
    // ... existing fields unchanged ...
    jiraValidated: false,
    gitlabValidated: false,
    integrationsVisited: false,  // ADD
  });
});
```

**New test case to add** (goNext clamps at 4, not 3):
```typescript
it('goNext clamps at step 4', () => {
  act(() => {
    // Advance past all steps
    useOnboardingStore.getState().goNext(); // 0→1
    useOnboardingStore.getState().goNext(); // 1→2
    useOnboardingStore.getState().goNext(); // 2→3
    useOnboardingStore.getState().goNext(); // 3→4
    useOnboardingStore.getState().goNext(); // clamped at 4
  });
  expect(useOnboardingStore.getState().step).toBe(4);
});

it('set updates integrationsVisited', () => {
  act(() => {
    useOnboardingStore.getState().set({ integrationsVisited: true });
  });
  expect(useOnboardingStore.getState().integrationsVisited).toBe(true);
});
```

---

### `src/components/integrations/AioBlock.test.tsx` (new test file)

**Analog:** `src/routes/settings/IntegrationsSection.test.tsx` (copy mock blocks verbatim)

**Mock block pattern** (IntegrationsSection.test.tsx lines 1–103 — copy entire vi.mock structure):
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import AioBlock from './AioBlock';  // adjusted import

const mockStore: {
  aioEnabled: boolean;
  setAioEnabled: ReturnType<typeof vi.fn>;
  selectedAioProjectKey: string | null;
  setSelectedAioProjectKey: ReturnType<typeof vi.fn>;
} = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
  selectedAioProjectKey: null,
  setSelectedAioProjectKey: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

// Copy the full Select mock from IntegrationsSection.test.tsx lines 48–103 verbatim
vi.mock('@/components/ui/select', () => { /* ... exact copy ... */ });
```

**beforeEach pattern** (IntegrationsSection.test.tsx lines 114–123):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockStore.aioEnabled = false;
  mockStore.selectedAioProjectKey = null;
  vi.mocked(fetchAioProjects).mockReset();
  vi.mocked(readSecret).mockResolvedValue('test-jira-token');
});
```

**Test cases to cover** (adapt from IntegrationsSection.test.tsx `AIO project picker` describe block, lines 156–326):
- Hides picker when `aioEnabled` is false
- Shows loading row while query is pending
- Shows error row + Retry button when query rejects
- Shows disabled Select with 'No AIO projects available' when `projects=[]`
- Renders project list and sorts alphabetically (case-insensitive) when resolved
- Calls `setSelectedAioProjectKey` with projectKey on selection
- WR-01: Shows stale-key warning when persisted key not in fetched projects
- WR-01: No stale-key warning when persisted key resolves to known project

---

### `src/routes/onboarding/IntegrationsStep.test.tsx` (new test file)

**Analog:** `src/routes/settings/IntegrationsSection.test.tsx` (mock structure) + `src/routes/onboarding/JiraStep.test.tsx` (navigation pattern)

**Additional mocks needed beyond AioBlock.test.tsx:**
```typescript
// Mock onboarding store
const mockOnboardingStore = {
  goBack: vi.fn(),
  goNext: vi.fn(),
  set: vi.fn(),
};
vi.mock('@/stores/onboarding.store', () => ({
  useOnboardingStore: () => mockOnboardingStore,
}));

// Mock AioBlock to isolate IntegrationsStep navigation logic
vi.mock('@/components/integrations/AioBlock', () => ({
  default: () => <div data-testid="aio-block" />,
}));
```

**Test cases to cover** (per RESEARCH Validation Architecture):
- WIZ-02: Continue disabled when `aioEnabled=true` and `isLoading=true`
- WIZ-02: Continue disabled when `aioEnabled=true` and `isError=true`
- WIZ-02: Continue disabled when `aioEnabled=true` and `projects=[]`
- WIZ-02: Continue disabled when `aioEnabled=true` and `selectedAioProjectKey=null` (projects loaded)
- WIZ-02: Continue enabled when `aioEnabled=false` (regardless of project state)
- WIZ-02: Continue enabled when `aioEnabled=true` and project is selected and loaded
- WIZ-03: Tempo toggle renders and calls `setTempoEnabled` on change
- WIZ-04: `goNext` called on Continue click; `set({ integrationsVisited: true })` called
- WIZ-01: `goBack` called on Back button click

---

## Shared Patterns

### Fine-grained Zustand selectors
**Source:** `src/routes/settings/IntegrationsSection.tsx` lines 14–19
**Apply to:** `AioBlock.tsx`, `IntegrationsStep.tsx`
```typescript
// One selector call per field — avoids re-render on unrelated store mutations
const aioEnabled = useSettingsStore((s) => s.aioEnabled);
const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
```

### Wizard step layout container
**Source:** `src/routes/onboarding/GitLabStep.tsx` line 67
**Apply to:** `IntegrationsStep.tsx`
```tsx
<div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
```

### Navigation button row
**Source:** `src/routes/onboarding/GitLabStep.tsx` lines 139–163
**Apply to:** `IntegrationsStep.tsx`
```tsx
<div className="flex gap-3">
  <Button variant="ghost" onClick={goBack}>Back</Button>
  <Button onClick={handleContinue} disabled={continueDisabled}>Continue</Button>
</div>
```

### Step heading/subtext block
**Source:** `src/routes/onboarding/GitLabStep.tsx` lines 69–73
**Apply to:** `IntegrationsStep.tsx`
```tsx
<div>
  <h2 className="text-xl font-semibold">{title}</h2>
  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
</div>
```

### Test renderWithClient helper
**Source:** `src/routes/settings/IntegrationsSection.test.tsx` lines 105–111
**Apply to:** `AioBlock.test.tsx`, `IntegrationsStep.test.tsx`
```typescript
function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={makeClient()}>{ui}</QueryClientProvider>);
}
```

### Select mock for jsdom
**Source:** `src/routes/settings/IntegrationsSection.test.tsx` lines 48–103
**Apply to:** `AioBlock.test.tsx` (copy verbatim)
```typescript
// Replace base-ui Select with deterministic <select>+<option> stand-in.
// Reason: floating-ui portal does not lay out in jsdom.
vi.mock('@/components/ui/select', () => { /* full mock — copy from source */ });
```

---

## No Analog Found

No files in this phase are without analog. All new files have direct extraction sources or step-pattern matches.

---

## CSS Correction Reference (Critical)

The following values in `src/routes/settings/IntegrationsSection.tsx` are **wrong per UI-SPEC** and must NOT be copied into extracted/new files:

| Source (wrong) | Correct | Location in source | Apply to |
|---|---|---|---|
| `gap-1.5` | `gap-2` | Line 84 (picker container) | `AioBlock.tsx` |
| `gap-1.5` | `gap-2` | Line 87 (loading row) | `AioBlock.tsx` |
| `gap-1.5` | `gap-2` | Line 92 (error row) | `AioBlock.tsx` |
| `font-medium` | `font-normal` | Line 70 (toggle label `<p>`) | `AioBlock.tsx` |

**Source of truth:** UI-SPEC commit `be69a770` updated the design contract. The source `.tsx` was not updated in that commit — this phase corrects it during extraction.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/onboarding/`, `taskflow/src/routes/settings/`, `taskflow/src/stores/`, `taskflow/src/components/app/`
**Files scanned:** 10 (IntegrationsSection.tsx, GitLabStep.tsx, JiraStep.tsx, DoneStep.tsx, OnboardingWizard.tsx, StepIndicator.tsx, onboarding.store.ts, settings.store.ts, IntegrationsSection.test.tsx, onboarding.store.test.ts)
**Pattern extraction date:** 2026-05-24
