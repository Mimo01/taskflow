---
phase: 260609-hvu
reviewed: 2026-06-09T00:00:00Z
depth: quick
files_reviewed: 2
files_reviewed_list:
  - taskflow/src/routes/onboarding/GitLabStep.tsx
  - taskflow/src/routes/onboarding/JiraStep.tsx
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 260609-hvu: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** quick
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Both files received identical changes: a `useRef<string>` for log accumulation, a `useState` for show/hide toggle, a `try/catch` in `mutationFn` that builds a timestamped log string, and JSX for a toggle button and `<pre>` panel. The XSS concern is a non-issue — all log content is interpolated as React text nodes, never via `innerHTML`. The `<pre>` content is safe. The stale-ref pattern (reading `errorLogRef.current` from a render triggered by the toggle click) works correctly in practice. The real issues are one silent failure path on Stronghold write and two accessibility gaps on the toggle button.

## Critical Issues

### CR-01: `storeSecret` failure in `onSuccess` silently breaks the wizard — no error shown, project dropdown never appears

**Files:** `taskflow/src/routes/onboarding/GitLabStep.tsx:63-73` and `taskflow/src/routes/onboarding/JiraStep.tsx:85-89`

**Issue:** Both `onSuccess` callbacks are `async` and `await storeSecret(...)` as their first statement, before the call to `set({ gitlabProjects: projectList })` / `set({ jiraProjects: projectList })`. TanStack Query does not forward errors thrown from `onSuccess` to `mutation.isError` — they are swallowed by the library. If Stronghold fails (not initialized, vault locked, disk I/O error), the entire remainder of `onSuccess` is skipped: `gitlabProjects` / `jiraProjects` is never written to the store, `showProjectDropdown` stays `false`, and no error message is surfaced. The user sees the "Test & Continue" button re-enabled with no explanation and no way to proceed.

**Fix (GitLabStep — same pattern applies to JiraStep):**
```tsx
onSuccess: async ({ user, projectList }) => {
  try {
    await storeSecret('gitlab-pat', gitlabToken);
  } catch (e) {
    // Surface Stronghold failures through the mutation error path
    throw new Error(
      `Credentials validated but could not be saved: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  setGitlabUserId(user.id);
  setGitlabUsername(user.username);
  setGitlabName(user.name);
  setGitlabEmail(user.email);
  set({ gitlabProjects: projectList });
},
```

Note: throwing from `onSuccess` does re-trigger `onError` and set `mutation.isError` in TanStack Query v5, so the error log panel will display correctly.

## Warnings

### WR-01: Toggle button missing `aria-expanded` — state not exposed to assistive technology

**Files:** `taskflow/src/routes/onboarding/GitLabStep.tsx:136-152` and `taskflow/src/routes/onboarding/JiraStep.tsx:162-178`

**Issue:** The `<button>` that toggles the details panel has no `aria-expanded` attribute. Screen readers cannot determine whether the panel is collapsed or expanded. The visible label text changes ("Show details" / "Hide details"), but ARIA requires `aria-expanded` for disclosure widget patterns. The button also lacks `aria-controls` pointing to the panel, and the `<pre>` element has no `id` to be referenced.

**Fix:**
```tsx
// Add an id to the pre element:
<pre id="error-details-panel" ...>
  {errorLogRef.current || mutation.error.message}
</pre>

// Add aria-expanded and aria-controls to the button:
<button
  type="button"
  aria-expanded={showDetails}
  aria-controls="error-details-panel"
  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit transition-colors"
  onClick={() => setShowDetails((v) => !v)}
>
```

Both files have identical JSX, so the fix is identical.

### WR-02: `errorLogRef` populated only in `catch` — successful intermediate steps are not captured if a later step fails

**Files:** `taskflow/src/routes/onboarding/GitLabStep.tsx:44-61` and `taskflow/src/routes/onboarding/JiraStep.tsx:64-83`

**Issue:** In both `mutationFn` implementations, `errorLogRef.current = log.join('\n')` is only assigned inside the `catch` block. The `log` array is built incrementally and includes `OK` lines from steps that succeeded before the failure. This part is correct. However, if a network error is thrown synchronously before any `log.push` executes (e.g., an unchecked synchronous throw from a future refactor of `validateJira` / `validateGitLab`), `errorLogRef.current` remains `''` and the panel falls back to `mutation.error.message` via the `errorLogRef.current || mutation.error.message` expression. This fallback is intentional and works, but the inconsistency is fragile. More concretely: the log is also not written on the success path, meaning if the user clicks "Show details" after a previous error and then retriggers validation (which calls `setShowDetails(false)`), the ref is cleared to `''` by `handleValidate` — this is correct. No data corruption, but the approach is one missed `errorLogRef.current = log.join('\n')` call (placed in the `finally` block instead) away from being more robust.

**Fix:** Move the ref assignment to a `finally` block so it captures the log regardless of outcome:
```ts
} catch (err) {
  log.push(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    log.push(err.stack);
  }
  throw err;
} finally {
  if (log.length > 0) {
    errorLogRef.current = log.join('\n');
  }
}
```

This also means a successful run's log is captured in the ref (harmless since the panel is only rendered when `mutation.isError`), and future callers have a reliable audit trail.

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
