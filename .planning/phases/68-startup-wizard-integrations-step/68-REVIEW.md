---
phase: 68-startup-wizard-integrations-step
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - taskflow/src/components/app/OnboardingWizard.tsx
  - taskflow/src/components/integrations/AioBlock.tsx
  - taskflow/src/components/integrations/AioBlock.test.tsx
  - taskflow/src/routes/onboarding/IntegrationsStep.tsx
  - taskflow/src/routes/onboarding/IntegrationsStep.test.tsx
  - taskflow/src/routes/settings/IntegrationsSection.tsx
  - taskflow/src/stores/onboarding.store.ts
  - taskflow/src/stores/onboarding.store.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 68: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 68 ships `IntegrationsStep` (new wizard step), `AioBlock` (extracted shared component), and an updated `OnboardingWizard` shell. The store changes are minimal and correct. Test coverage is broad and the mocking strategy is sound.

Two critical defects were identified. The first is a race condition in both `AioBlock` and `IntegrationsStep` where the TanStack Query runs with a stale `null` token when `jiraBaseUrl` changes after initial mount; the query fires with the old (null) token before the async `readSecret` resolves. The second is that `fetchAioProjects` maps `jiraProjectKey` to `name`, so the project selector always shows raw Jira project keys (e.g. `PROJ`) rather than human-readable names — an existing data-layer bug surfaced by the new UI.

Four warnings cover: `continueDisabled` permitting forward navigation with a stale persisted project key, a type mismatch between `onValueChange: (v: string) => void` and `setSelectedAioProjectKey: (key: string | null) => void`, the `WelcomeStep` never being marked as completed in `completedSteps`, and a partially incomplete test case for the mixed-case sort check.

---

## Critical Issues

### CR-01: Query fires before `readSecret` resolves on `jiraBaseUrl` change — stale-token race in AioBlock and IntegrationsStep

**File:** `taskflow/src/components/integrations/AioBlock.tsx:30-46` and `taskflow/src/routes/onboarding/IntegrationsStep.tsx:40-52`

**Issue:** Both components derive `enabled` from `!!jiraBaseUrl && !!token`. On initial mount when `jiraBaseUrl` is already set (e.g., user revisits the wizard), `token` starts as `null`. The `useEffect` that calls `readSecret` is asynchronous; because `useQuery` evaluates `enabled` synchronously on the first render, there is a frame where `enabled` is `false`. That part is fine.

However, if `jiraBaseUrl` changes from a non-null value to a different non-null value during a session (e.g., the user reconnects to a different Jira instance mid-wizard without reloading), the `useEffect` re-runs, but `token` is momentarily still set to the **previous** token value (it was set by the previous `readSecret` call). The guard `!!jiraBaseUrl && !!token` therefore becomes `true` immediately with the old token and the new `jiraBaseUrl`, firing a network request with a mismatched token before the new `readSecret` resolves.

More practically: `readSecret` is a Tauri IPC call that can take tens of milliseconds. The query `enabled` depends on `token` being truthy, and once it is truthy it does not reset to `null` when `jiraBaseUrl` changes. The effect sets `token` to the resolved value of the new secret, but there is a window — from when `jiraBaseUrl` changes to when `readSecret` resolves — during which the query will (or already has) executed with the old token. TanStack Query will refetch when the queryKey changes (`jiraBaseUrl` is in the key), but that new fetch starts immediately with `token!` bound to the old value.

```diff
// AioBlock.tsx (same pattern in IntegrationsStep.tsx)
  useEffect(() => {
    if (!jiraBaseUrl) return;
+   setToken(null);          // reset before the async read so the query is disabled
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, [jiraBaseUrl]);
```

**Fix:** Set `token` back to `null` synchronously at the start of the effect, before the `readSecret` call. This ensures the guard `!!jiraBaseUrl && !!token` is `false` for the entire duration of the IPC call, preventing the query from firing with a stale credential.

---

### CR-02: `fetchAioProjects` maps `jiraProjectKey` to `name` — project selector shows raw keys, not display names

**File:** `taskflow/src/services/aio/projects.ts:126-130`

**Issue:** The AIO REST API endpoint `GET /rest/aio-tcms/1.0/project` returns `{ ID, jiraProjectKey }` — there is no separate `name` field in the raw response. The mapping in `fetchAioProjects` sets both `projectKey` and `name` to `jiraProjectKey`:

```ts
return raw.map((item) => ({
  id: item.ID,
  projectKey: item.jiraProjectKey,
  name: item.jiraProjectKey,   // ← always a key like "PROJ", never "My Project"
}));
```

`AioBlock` renders `{selectedProject.name}` inside the Select trigger and `{p.name}` in the SelectItem list. Users will see raw keys like `PROJ` rather than friendly names. This is an existing service-layer defect, but it is the first phase that exposes it prominently in both the wizard and settings UI.

**Fix:** If the AIO project listing endpoint does not return a display name, the UI should either (a) document and accept this limitation by labeling the column "Project Key" rather than "Project", or (b) make a second call per project to fetch metadata. At minimum, the `AioProject.name` field should not be silently populated with the key — either the type should mark `name` as optional/note the caveat, or the service should return `name: item.name ?? item.jiraProjectKey` once a verified field name is known from a probe. Shipping the wizard with this issue will cause user confusion during onboarding.

---

## Warnings

### WR-01: `continueDisabled` allows forward navigation when selected key is stale (deleted project)

**File:** `taskflow/src/routes/onboarding/IntegrationsStep.tsx:60-62`

**Issue:** The `continueDisabled` expression is:

```ts
const continueDisabled =
  aioEnabled &&
  (!selectedAioProjectKey || isLoading || isError || (Array.isArray(projects) && projects.length === 0));
```

When `aioEnabled=true` and `selectedAioProjectKey` is a persisted key that is no longer in the fetched `projects` array (the stale-key case that `AioBlock` already surfaces as a warning message), `selectedAioProjectKey` is truthy and `isLoading`/`isError` are false and `projects.length > 0`, so `continueDisabled` evaluates to `false`. The user can click Continue and navigate past the step with a dangling project key that no longer resolves — the very situation the stale-key warning is trying to prevent.

**Fix:** Add a stale-key check to the gating expression:

```ts
const selectedKeyIsStale =
  !!selectedAioProjectKey &&
  Array.isArray(projects) &&
  !projects.find((p) => p.projectKey === selectedAioProjectKey);

const continueDisabled =
  aioEnabled &&
  (!selectedAioProjectKey ||
    selectedKeyIsStale ||
    isLoading ||
    isError ||
    (Array.isArray(projects) && projects.length === 0));
```

The test suite does not cover this case — a new test for the stale-key gating scenario should be added.

---

### WR-02: `onValueChange` type mismatch — `Select` passes `string`, store setter accepts `string | null`

**File:** `taskflow/src/components/integrations/AioBlock.tsx:121`

**Issue:**

```ts
<Select value={selectedAioProjectKey ?? ''} onValueChange={setSelectedAioProjectKey}>
```

`Select.onValueChange` is `(v: string) => void`. `setSelectedAioProjectKey` is typed as `(key: string | null) => void`. TypeScript accepts the assignment because `string` is assignable to `string | null`, but this wires the setter to receive only non-null strings from user interaction — the user can never clear the selection through the UI. There is no "clear" option in the select, and passing `''` (the empty string placeholder) will call `setSelectedAioProjectKey('')` (an empty string, not `null`). Downstream code checks `!!selectedAioProjectKey` to mean "a project has been selected", which would treat `''` as falsy and behave correctly; but `selectedAioProjectKey === ''` is semantically different from `null`, and the stale-key check (`!!selectedAioProjectKey && !selectedProject`) would not fire for the empty-string case.

**Fix:** Either (a) add an explicit "None / Clear" option with value `''` and handle `onValueChange={(v) => setSelectedAioProjectKey(v || null)}`, or (b) document that the empty-string and null cases are both treated as "no selection" and add the normalization call in the handler. Option (a) also solves the missing clear-selection UX.

---

### WR-03: `WelcomeStep` (step 0) is never pushed to `completedSteps` — indicator stays current forever after leaving it

**File:** `taskflow/src/components/app/OnboardingWizard.tsx:30-33`

**Issue:**

```ts
const completedSteps: number[] = [];
if (jiraValidated) completedSteps.push(1);
if (gitlabValidated) completedSteps.push(2);
if (integrationsVisited) completedSteps.push(3);
```

Step 0 (Welcome) is never added to `completedSteps`. Once the user advances past Welcome to step 1, `StepIndicator` will render step 0 with `isCurrent = (0 === currentStep)` false and `isCompleted = completedSteps.includes(0)` false, falling into the `isFuture` branch (`index > currentStep` is false but neither completed nor current), meaning it renders with muted/neutral styling rather than the green "completed" style. The Welcome step visually regresses to look like an unvisited future step as soon as the user leaves it.

**Fix:** Push `0` to `completedSteps` whenever `step > 0`:

```ts
if (step > 0) completedSteps.push(0);
```

---

### WR-04: Mixed-case sort assertion is declared but never executed in test

**File:** `taskflow/src/components/integrations/AioBlock.test.tsx:218-223`

**Issue:** The test "renders project list sorted alphabetically case-insensitive when resolved" (line 198) calls `vi.mocked(fetchAioProjects).mockResolvedValue([...])` with a second mock (lines 218-222) after the first `waitFor` block, but never awaits a re-render or makes any assertions on the new data. The second `mockResolvedValue` call sets up mock state that is never consumed — the mixed-case sort behaviour (`Alpha`, `bravo`, `charlie`) is not verified at all:

```ts
// Mixed case sort check
vi.mocked(fetchAioProjects).mockResolvedValue([
  { id: 3, projectKey: 'C', name: 'charlie' },
  { id: 1, projectKey: 'A', name: 'Alpha' },
  { id: 2, projectKey: 'B', name: 'bravo' },
]);
// ← no render, no waitFor, no expect — dead assertion block
```

This gives false confidence that the locale-insensitive sort is tested for mixed case.

**Fix:** Either remove the dead block, or complete the assertion:

```ts
// Re-render with mixed-case data and verify ordering
renderWithClient(<AioBlock />);
await waitFor(() => {
  const opts = Array.from(
    document.querySelectorAll('[data-testid="aio-project-select"] option'),
  );
  expect(opts.map((el) => el.textContent)).toEqual(['—', 'Alpha', 'bravo', 'charlie']);
});
```

---

## Info

### IN-01: `Tempo Timesheets` label text is inconsistent between `IntegrationsStep` and `IntegrationsSection`

**File:** `taskflow/src/routes/onboarding/IntegrationsStep.tsx:91` vs `taskflow/src/routes/settings/IntegrationsSection.tsx:20`

**Issue:** Both components render identical Tempo Timesheets markup — the toggle label, description text, and class names are copy-pasted verbatim. This creates a future maintenance burden: any text or accessibility change needs to be applied in two places. The design intent (D-06: not extracted because it is a "single checkbox") is documented, but even a single-checkbox block has label strings that could drift.

**Fix:** No action required for correctness, but if the Tempo block ever grows (e.g., gains a token input or project picker), it should be extracted to a `TempoBlock` component on the same model as `AioBlock`.

---

### IN-02: `jiraToken` in onboarding store is unused dead state

**File:** `taskflow/src/stores/onboarding.store.ts:16`

**Issue:** `OnboardingState` declares `jiraToken: string` and the initial state sets it to `''`. No component in the reviewed set reads or writes this field. Tokens are stored exclusively in Stronghold. This may be a leftover from an earlier design that never got cleaned up.

**Fix:** If `jiraToken` is confirmed unused across the whole codebase, remove it from the interface and initial state to avoid confusion about where tokens live.

---

### IN-03: `setSelectedAioProjectKey` type signature accepts `null` but has no UI path to null

**File:** `taskflow/src/stores/settings.store.ts:104` and `taskflow/src/components/integrations/AioBlock.tsx:121`

**Issue:** The store setter is typed `(key: string | null) => void`, implying callers can clear the selection, but `AioBlock` never passes `null` to it — `onValueChange` only delivers string values from a `<Select>`. There is no "clear" action exposed in the UI. The `null` branch of the setter type is effectively dead code at the call site.

**Fix:** Either add a "clear selection" UX path (see WR-02 fix suggestion), or narrow the setter type to `(key: string) => void` and handle clearing via a separate explicit reset action if needed.

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
