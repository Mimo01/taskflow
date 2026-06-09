# Quick Task 260609-hvu: Wizard Advanced Error Log - Research

**Researched:** 2026-06-09
**Domain:** Wizard error display / expandable log panel
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Expandable inline section: toggle below the error message expands a scrollable log panel — no modal, stays in context
- "Show details" button (or similar secondary CTA) rendered below the error message, always visible when an error occurs

### Claude's Discretion
- Log content scope: include all wizard step results/progress, validation output, and the full error with stack trace — comprehensive but not raw API dumps unless they caused the failure
- Exact styling of the expanded log panel (monospace text, scrollable, subtle background)
- Whether to include a "Copy to clipboard" affordance for the log content
</user_constraints>

---

## Summary

The wizard is the onboarding flow in `OnboardingWizard.tsx`, with individual steps in `src/routes/onboarding/`. The two steps that can fail during validation are **JiraStep** and **GitLabStep**. Both use `useMutation` (TanStack Query) and currently display only `mutation.error.message` — a one-liner `<p>` tag — when the mutation fails.

There is no existing step-progress log buffer. The `useDebugLogStore` captures API-level entries from `apiFetch`, but only when `devToolsEnabled` is on in Settings. The wizard steps call `apiFetch` indirectly through `validateJira`/`validateGitLab`/`listJiraProjects`/`listGitLabProjects` in `src/services/jira.ts` and `src/services/gitlab.ts`. The operation labels passed to `apiFetch` ("Validate Connection", "Load Projects") are already defined and appear in debug-log entries.

The canonical expand/collapse pattern in the codebase is in `UpdatesSection.tsx` → `VersionHistoryList`: a `useState<string | null>` toggle, a `<button>` with `ChevronDown`/`ChevronUp` icons, and a conditionally-rendered `<div>` for expanded content. That is the exact pattern to reuse here.

**Primary recommendation:** Add a local `showDetails` boolean state to JiraStep and GitLabStep. When `mutation.isError`, render the existing error `<p>` plus a "Show details" `<button>` below it. Expand into a scrollable `<pre>` block that reconstructs a step-by-step log from available mutation state (attempted URL, operation sequence, error message, stack trace). No new store required for the basic case; for richer step-by-step content, collect a local log array during the `mutationFn` sequence.

---

## Where Errors Are Displayed Today

### JiraStep (`src/routes/onboarding/JiraStep.tsx`, lines 136–139)
```tsx
{mutation.isError && mutation.error && (
  <p className="text-sm text-destructive" role="alert">
    {mutation.error.message}
  </p>
)}
```

### GitLabStep (`src/routes/onboarding/GitLabStep.tsx`, lines 109–112)
```tsx
{mutation.isError && mutation.error && (
  <p className="text-sm text-destructive" role="alert">
    {mutation.error.message}
  </p>
)}
```

Both are the **only error display site** — no other component wraps or re-renders these.

---

## Log Content — What's Available Without New Infrastructure

The `mutationFn` in JiraStep runs two sequential async calls:
1. `validateJira(jiraUrl, jiraToken)` — maps to `apiFetch('jira', url, ..., 'Validate Connection')`
2. `listJiraProjects(jiraUrl, jiraToken)` — maps to `apiFetch('jira', url, ..., 'Load Projects')`

Either call can throw. The thrown error is an `Error` or `ApiError` (see `src/lib/api-error.ts`).

When devToolsEnabled is on, `apiFetch` writes entries to `useDebugLogStore` automatically. Those entries contain: `source`, `method`, `url`, `status`, `durationMs`, `responseBody`, `error`.

**For the log panel content, two options exist:**

**Option A — Read from `useDebugLogStore`** (entries written by `apiFetch` during this mutation run, filtered to source='jira' or 'gitlab', timestamped within the mutation window). Pro: zero extra code in services. Con: only populated when devToolsEnabled is on; empty when dev tools are off — not useful for normal users.

**Option B — Collect a local log array inside `mutationFn`** (append a log line before/after each call, capture the error). Pro: always available regardless of dev tools setting; exactly matches what the user wants (step-by-step narrative). Con: ~10 lines of new code in each step component.

**Recommendation: Option B.** The user wants to see "what happened step by step" — that requires narrating the sequence explicitly. Option A is unreliable for non-dev-tools users.

---

## Canonical Expand/Collapse Pattern

`UpdatesSection.tsx` → `VersionHistoryList` (lines 91, 130–170) [ASSUMED — read from codebase]:

```tsx
const [expandedTag, setExpandedTag] = useState<string | null>(null);

// Toggle button
<button
  type="button"
  onClick={() => setExpandedTag(expandedTag === tag ? null : tag)}
  className="flex items-center justify-between w-full py-3 text-left hover:bg-muted/50 px-2 -mx-2 rounded-md transition-colors"
>
  ...
  {expandedTag === tag ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
</button>

// Expanded body
{expandedTag === tag && (
  <div className="pb-3 border-l-2 border-muted pl-4 max-h-64 overflow-y-auto ...">
    ...
  </div>
)}
```

For the error details panel, simplify to a boolean `showDetails` toggle (there's only one expandable per error state):

```tsx
const [showDetails, setShowDetails] = useState(false);

// Reset on new mutation attempt
// mutation.isPending resets showDetails — handle in useEffect or set it false in handleValidate

{mutation.isError && mutation.error && (
  <div className="flex flex-col gap-2">
    <p className="text-sm text-destructive" role="alert">
      {mutation.error.message}
    </p>
    <button
      type="button"
      onClick={() => setShowDetails((v) => !v)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit"
    >
      {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {showDetails ? 'Hide details' : 'Show details'}
    </button>
    {showDetails && (
      <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-border">
        {errorLog}
      </pre>
    )}
  </div>
)}
```

---

## Log Content Construction (Option B)

Collect a `string[]` inside `mutationFn` using a local array, then join as the error log:

```tsx
const mutation = useMutation({
  mutationFn: async () => {
    const log: string[] = [];
    log.push(`[${new Date().toISOString()}] Starting Jira connection...`);
    log.push(`  URL: ${jiraUrl}`);
    try {
      log.push(`[step 1] Validating credentials (GET /rest/api/2/myself)...`);
      const user = await validateJira(jiraUrl, jiraToken);
      log.push(`  OK — authenticated as ${user.displayName} (${user.name})`);
      log.push(`[step 2] Loading projects (GET /rest/api/2/project)...`);
      const projectList = await listJiraProjects(jiraUrl, jiraToken);
      log.push(`  OK — found ${projectList.length} project(s)`);
      return { user, projectList };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error && err.stack ? `\n${err.stack}` : '';
      log.push(`  FAILED: ${msg}${stack}`);
      // Attach log to error so onError can read it
      (err as Error & { wizardLog?: string }).wizardLog = log.join('\n');
      throw err;
    }
  },
  ...
});
```

Then in the JSX, read `(mutation.error as Error & { wizardLog?: string })?.wizardLog ?? mutation.error?.message ?? 'Unknown error'` to populate `errorLog`.

Alternatively, use a `useRef` to accumulate log lines (avoids mutating the Error object):

```tsx
const errorLogRef = useRef<string>('');

// In mutationFn — write to errorLogRef.current = log.join('\n') in catch
// In JSX — read errorLogRef.current
```

The `useRef` approach is cleaner since it doesn't mutate the thrown object.

---

## Architecture Patterns

### Recommended Change Scope

| File | Change |
|------|--------|
| `src/routes/onboarding/JiraStep.tsx` | Add `showDetails` state, `errorLogRef`, log collection in `mutationFn`, expandable panel in JSX |
| `src/routes/onboarding/GitLabStep.tsx` | Same pattern as JiraStep (mirrors exactly) |

No new stores, no new components, no new services.

### Reset Behavior

`showDetails` should reset to `false` whenever a new validation attempt starts. Do this inside `handleValidate`:

```tsx
const handleValidate = () => {
  if (!jiraUrl || !jiraToken) return;
  setShowDetails(false);
  errorLogRef.current = '';
  mutation.mutate();
};
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Expand/collapse toggle | Custom animation/disclosure component | `useState` boolean + `ChevronDown/Up` from lucide-react (already used in UpdatesSection) |
| Copy to clipboard | Native clipboard API wrapped in custom hook | `navigator.clipboard.writeText(text)` directly, or skip — Claude's Discretion |
| Stack trace formatting | Custom stack parser | Include `err.stack` verbatim in the log string — browser/Node stack is readable as-is |

---

## Common Pitfalls

### Pitfall 1: showDetails not reset between attempts
If the user corrects their URL and retries, `showDetails` stays open showing stale log from the previous failure. Fix: reset in `handleValidate` (shown above).

### Pitfall 2: Log empty if error thrown before first log line
Wrap the entire body of `mutationFn` inside the try block, writing the first log line before the first await. This guarantees the log always has at least the attempted URL.

### Pitfall 3: `mutation.error.stack` is undefined in production builds
Tauri/Vite may strip stack traces in production. Include the stack if present but don't depend on it — the step narrative (which call failed) is the primary value.

### Pitfall 4: `useRef` value not triggering re-render
`useRef` is correct for storing the log string because the `<pre>` is only rendered when `mutation.isError` is true — by the time React re-renders for error state, `errorLogRef.current` is already populated (the mutation has finished and thrown).

---

## Sources

- `src/routes/onboarding/JiraStep.tsx` — error display site, mutation structure [ASSUMED: read from codebase]
- `src/routes/onboarding/GitLabStep.tsx` — mirrors JiraStep pattern [ASSUMED: read from codebase]
- `src/stores/onboarding.store.ts` — store shape, no log buffer [ASSUMED: read from codebase]
- `src/stores/debug-log.store.ts` — ApiLogEntry shape, devToolsEnabled gating [ASSUMED: read from codebase]
- `src/lib/apiFetch.ts` — operation labels, when entries are appended [ASSUMED: read from codebase]
- `src/routes/settings/UpdatesSection.tsx` → `VersionHistoryList` — canonical expand/collapse pattern [ASSUMED: read from codebase]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No existing step-progress log buffer in onboarding store or wizard components | Summary | Low — store shape is small and fully read |
| A2 | `useDebugLogStore` entries only populate when devToolsEnabled is true | Log Content | Medium — if always-on, Option A becomes viable |
| A3 | JiraStep and GitLabStep are the only wizard steps that can produce mutation errors | Where Errors Are Displayed | Low — WelcomeStep/DoneStep have no async calls; IntegrationsStep shows AioBlock errors separately |
